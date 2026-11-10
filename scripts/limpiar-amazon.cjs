#!/usr/bin/env node
/**
 * limpiar-amazon.js
 * Quita toda presencia de Amazon de las páginas públicas.
 * NO toca merged-admin.json (la BD se preserva).
 *
 * Qué hace:
 * 1. Páginas con arrays JS: quita productos solo-Amazon, limpia props Amazon de los que quedan
 * 2. Páginas con HTML estático (celulares): quita cards data-platform="amz"
 * 3. Quita filtros/botones de Amazon de barras laterales
 * 4. Limpia descuentos.json (quita ofertas de Amazon)
 * 5. Limpia bajadas.json (quita bajadas de Amazon)
 * 6. Limpia catalog-mini.json (quita props Amazon)
 * 7. Quita referencia a Amazon de la sección de ofertas del home
 *
 * Uso: node scripts/limpiar-amazon.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');

let stats = {
  productosEliminados: 0,
  productosLimpiados: 0,
  cardsEliminadas: 0,
  descuentosEliminados: 0,
  bajadasEliminadas: 0,
  filtrosQuitados: 0,
  archivosModificados: [],
};

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeFile(rel, content) {
  if (DRY) {
    console.log(`  [dry-run] escribiría ${rel}`);
  } else {
    fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
  }
  if (!stats.archivosModificados.includes(rel)) {
    stats.archivosModificados.push(rel);
  }
}

// ─── 1. Páginas con arrays JS ────────────────────────────────────────────

const JS_ARRAY_PAGES = [
  { file: 'laptops/index.html', arrays: ['productos'] },
  { file: 'electrodomesticos/freidoras/index.html', arrays: ['productos'] },
  { file: 'electrodomesticos/microondas/index.html', arrays: ['micros'] },
  { file: 'electrodomesticos/cafeteras/index.html', arrays: ['productos'] },
  { file: 'electrodomesticos/lavadoras/index.html', arrays: ['productos'] },
  { file: 'electrodomesticos/ollas/index.html', arrays: ['productos'] },
  { file: 'electrodomesticos/refrigeradores/index.html', arrays: ['productos'] },
  { file: 'bicis/index.html', arrays: ['ELECTRICAS', 'MONTANA', 'RUTA', 'GRAVEL'] },
  { file: 'suplementos/index.html', arrays: ['productos'] },
  { file: 'suplementos/proteina/index.html', arrays: ['productos'] },
  { file: 'suplementos/creatina/index.html', arrays: ['productos'] },
  { file: 'suplementos/omega3/index.html', arrays: ['productos'] },
  { file: 'suplementos/magnesio/index.html', arrays: ['productos'] },
  { file: 'suplementos/complejo-b/index.html', arrays: ['PRODUCTOS'] },
  { file: 'suplementos/vitamina-d/index.html', arrays: ['PRODUCTOS'] },
  { file: 'tecnologia/smartwatches/index.html', arrays: ['productos'] },
  { file: 'tecnologia/bocinas/index.html', arrays: ['productos'] },
  { file: 'tecnologia/audifonos/index.html', arrays: ['productos'] },
  { file: 'videojuegos/juegos/index.html', arrays: ['productos'] },
  { file: 'videojuegos/controles/index.html', arrays: ['productos'] },
  { file: 'videojuegos/consolas/index.html', arrays: ['productos'] },
  { file: 'entretenimiento/streaming/index.html', arrays: ['productos'] },
  { file: 'video-resenas.html', arrays: ['productos'] },
];

function findArrayBounds(html, varName) {
  // Busca "const varName = [" o "var varName = [" o "let varName = ["
  const re = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\[`, 'g');
  const m = re.exec(html);
  if (!m) return null;

  const startOfDecl = m.index;
  const startOfArray = m.index + m[0].length - 1; // position of '['

  // Find matching ']' (respecting nesting, strings)
  let depth = 0;
  let inStr = false;
  let strChar = '';
  let escaped = false;

  for (let i = startOfArray; i < html.length; i++) {
    const ch = html[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inStr) { escaped = true; continue; }
    if (inStr) {
      if (ch === strChar) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true;
      strChar = ch;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        return { start: startOfDecl, arrayStart: startOfArray, end: i + 1 };
      }
    }
  }
  return null;
}

function processJSArrayPage(pageInfo) {
  const filePath = pageInfo.file;
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠ No existe: ${filePath}`);
    return;
  }

  let html = readFile(filePath);
  let changed = false;

  for (const arrayName of pageInfo.arrays) {
    const bounds = findArrayBounds(html, arrayName);
    if (!bounds) {
      console.log(`  ⚠ Array ${arrayName} no encontrado en ${filePath}`);
      continue;
    }

    const arrayStr = html.substring(bounds.arrayStart, bounds.end);
    let products;
    try {
      products = eval(arrayStr);
    } catch (e) {
      console.log(`  ⚠ No se pudo parsear ${arrayName} en ${filePath}: ${e.message}`);
      continue;
    }

    const before = products.length;
    const cleaned = [];

    for (const p of products) {
      const hasML = p.linkML && p.linkML !== null;
      const hasAmz = p.linkAmz && p.linkAmz !== null;

      if (!hasML && hasAmz) {
        // Solo Amazon → eliminar
        stats.productosEliminados++;
        continue;
      }

      // Limpiar propiedades de Amazon
      if (hasAmz || p.precioAmz || p.linkAmz || p.estrellasAmz || p.resenasAmz) {
        p.linkAmz = null;
        p.precioAmz = null;
        if ('estrellasAmz' in p) p.estrellasAmz = null;
        if ('resenasAmz' in p) p.resenasAmz = null;

        // Si el precio principal era el de Amazon, usar ML
        if (p.precioML && p.precio && !hasML) {
          // No tiene ML tampoco → ya se eliminó arriba
        } else if (p.precioML) {
          p.precio = p.precioML;
        }

        // Limpiar badges AMZ
        if (Array.isArray(p.badges)) {
          p.badges = p.badges.filter(b => b.t !== 'AMZ' && b.c !== 'b-amz');
          if (p.badges.length === 0) {
            // Si no quedan badges, agregar ML si tiene link
            if (hasML) p.badges = [{ t: 'ML', c: 'b-ml' }];
          }
        }

        // Si estrellas generales venían de Amazon, usar ML
        if (p.estrellas && !p.estrellasML && p.estrellasAmz === null) {
          // Las estrellas generales podrían haber sido de Amazon
          // Mantener como están si hay estrellasML
          if (p.estrellasML) {
            p.estrellas = p.estrellasML;
            p.resenas = p.resenasML;
          }
        }

        stats.productosLimpiados++;
      }

      cleaned.push(p);
    }

    if (cleaned.length !== before || stats.productosLimpiados > 0) {
      // Serializar de vuelta
      const indent = '  ';
      const serialized = serializeProductArray(cleaned, indent);
      const newDecl = `${html.substring(bounds.start, bounds.arrayStart)}${serialized}`;
      html = html.substring(0, bounds.start) + newDecl + html.substring(bounds.end);
      changed = true;
      console.log(`  ${filePath} → ${arrayName}: ${before} → ${cleaned.length} productos`);
    }
  }

  // Quitar filtro de Amazon del sidebar
  const filterResult = removeAmazonFilter(html);
  if (filterResult.changed) {
    html = filterResult.html;
    changed = true;
    stats.filtrosQuitados++;
  }

  // Quitar lógica de Amazon del render (amzBox, btn-amz references en funciones)
  const renderResult = cleanRenderFunction(html);
  if (renderResult.changed) {
    html = renderResult.html;
    changed = true;
  }

  if (changed) {
    writeFile(filePath, html);
  }
}

function serializeProductArray(products, indent) {
  // Serialize as a JS array that matches the style of the source code
  const items = products.map(p => {
    const lines = [];
    lines.push(indent + '{');
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined) continue;
      const valStr = serializeValue(v, indent + '  ');
      lines.push(`${indent}  ${k}: ${valStr},`);
    }
    lines.push(indent + '}');
    return lines.join('\n');
  });
  return '[\n' + items.join(',\n') + '\n]';
}

function serializeValue(v, indent) {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    // Check if it's a simple array of strings/numbers
    if (v.every(item => typeof item === 'string' || typeof item === 'number')) {
      const inner = v.map(item => JSON.stringify(item)).join(', ');
      if (inner.length < 80) return `[${inner}]`;
    }
    // Array of objects (like badges, uso, variantes)
    if (v.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      if (v.length <= 3 && v.every(item => Object.keys(item).length <= 3)) {
        // Short objects inline
        const inner = v.map(item => {
          const pairs = Object.entries(item).map(([k2,v2]) => `${k2}: ${serializeValue(v2, indent)}`);
          return `{ ${pairs.join(', ')} }`;
        });
        const oneLine = `[${inner.join(', ')}]`;
        if (oneLine.length < 100) return oneLine;
      }
      // Multi-line
      const items = v.map(item => {
        const pairs = Object.entries(item).map(([k2,v2]) => `${k2}: ${serializeValue(v2, indent + '  ')}`);
        return `${indent}  { ${pairs.join(', ')} }`;
      });
      return `[\n${items.join(',\n')}\n${indent}]`;
    }
    const inner = v.map(item => `${indent}  ${serializeValue(item, indent + '  ')}`).join(',\n');
    return `[\n${inner}\n${indent}]`;
  }
  if (typeof v === 'object') {
    const pairs = Object.entries(v).map(([k2,v2]) => `${JSON.stringify(k2)}: ${serializeValue(v2, indent + '  ')}`);
    if (pairs.join(', ').length < 80) return `{ ${pairs.join(', ')} }`;
    return `{\n${pairs.map(p => indent + '  ' + p).join(',\n')}\n${indent}}`;
  }
  return String(v);
}

// ─── 2. Páginas con HTML estático (celulares) ────────────────────────────

const STATIC_CARD_PAGES = [
  'celulares/android/index.html',
  'celulares/iphone/index.html',
];

function processStaticCardPage(filePath) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠ No existe: ${filePath}`);
    return;
  }

  let html = readFile(filePath);
  let changed = false;

  // Quitar cards con data-platform="amz" completas
  // Pattern: <article class="card" data-platform="amz" ...>...</article>
  const cardRe = /<article\s+class="card"\s+data-platform="amz"[^>]*>[\s\S]*?<\/article>\s*/g;
  const matches = html.match(cardRe);
  if (matches) {
    html = html.replace(cardRe, '');
    stats.cardsEliminadas += matches.length;
    changed = true;
    console.log(`  ${filePath}: ${matches.length} cards Amazon eliminadas`);
  }

  // En cards con ambas plataformas, quitar el botón/sección de Amazon
  // Pattern: <a class="btn-amz" href="..." ...>Ir a Amazon</a>
  const btnAmzRe = /<a\s+class="btn-amz"[^>]*>[^<]*<\/a>/g;
  const btnMatches = html.match(btnAmzRe);
  if (btnMatches) {
    html = html.replace(btnAmzRe, '');
    changed = true;
    console.log(`  ${filePath}: ${btnMatches.length} botones Amazon quitados`);
  }

  // Quitar filtro de Amazon
  const filterResult = removeAmazonFilter(html);
  if (filterResult.changed) {
    html = filterResult.html;
    changed = true;
    stats.filtrosQuitados++;
  }

  if (changed) {
    writeFile(filePath, html);
  }
}

// ─── 2b. Páginas de celulares (array familias con variantes) ─────────────

const CELULARES_PAGES = [
  'celulares/android/index.html',
  'celulares/iphone/index.html',
];

function processCelularesPage(filePath) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠ No existe: ${filePath}`);
    return;
  }

  let html = readFile(filePath);
  let changed = false;

  // Procesar el array 'familias'
  const bounds = findArrayBounds(html, 'familias');
  if (bounds) {
    const arrayStr = html.substring(bounds.arrayStart, bounds.end);
    let familias;
    try {
      familias = eval(arrayStr);
    } catch (e) {
      console.log(`  ⚠ No se pudo parsear familias en ${filePath}: ${e.message}`);
      return;
    }

    const before = familias.length;
    const cleaned = [];

    for (const fam of familias) {
      if (!Array.isArray(fam.variantes) || fam.variantes.length === 0) {
        cleaned.push(fam);
        continue;
      }

      const anyML = fam.variantes.some(v => v.linkML && v.linkML !== null);

      if (!anyML) {
        // Todas las variantes son solo Amazon → ver si alguna tiene linkML
        const anyAmz = fam.variantes.some(v => v.linkAmz && v.linkAmz !== null);
        if (anyAmz) {
          stats.productosEliminados++;
          console.log(`    Eliminada familia solo-Amazon: ${fam.nombre}`);
          continue;
        }
      }

      // Limpiar linkAmz de todas las variantes
      for (const v of fam.variantes) {
        if (v.linkAmz) {
          v.linkAmz = null;
          stats.productosLimpiados++;
        }
      }

      // Eliminar variantes que ahora no tienen ningún link
      fam.variantes = fam.variantes.filter(v => v.linkML || v.precio);

      cleaned.push(fam);
    }

    if (cleaned.length !== before || stats.productosLimpiados > 0) {
      const serialized = serializeFamiliasArray(cleaned);
      const newDecl = `${html.substring(bounds.start, bounds.arrayStart)}${serialized}`;
      html = html.substring(0, bounds.start) + newDecl + html.substring(bounds.end);
      changed = true;
      console.log(`  ${filePath} → familias: ${before} → ${cleaned.length} familias`);
    }
  }

  // Quitar botones/lógica de Amazon del render JS inline
  // Nullificar linkAmz en el render hace que no se muestren los botones
  // Pero hay CSS y JS que genera botones Amazon explícitamente

  // Quitar filtro de Amazon
  const filterResult = removeAmazonFilter(html);
  if (filterResult.changed) {
    html = filterResult.html;
    changed = true;
    stats.filtrosQuitados++;
  }

  if (changed) {
    writeFile(filePath, html);
  }
}

function serializeFamiliasArray(familias) {
  const lines = ['['];
  for (let i = 0; i < familias.length; i++) {
    const fam = familias[i];
    const famLines = [];
    famLines.push('  {');
    for (const [k, v] of Object.entries(fam)) {
      if (v === undefined) continue;
      if (k === 'variantes') {
        const varLines = v.map(variant => {
          const pairs = Object.entries(variant)
            .filter(([,val]) => val !== undefined)
            .map(([vk, vv]) => `${vk}: ${serializeValue(vv, '        ')}`);
          return `      { ${pairs.join(', ')} }`;
        });
        famLines.push(`    variantes: [\n${varLines.join(',\n')},\n    ],`);
      } else if (k === 'saltos' && Array.isArray(v)) {
        if (v.length === 0) {
          famLines.push(`    saltos: [],`);
        } else {
          const saltoLines = v.map(s => {
            const pairs = Object.entries(s)
              .filter(([,val]) => val !== undefined)
              .map(([sk, sv]) => `${sk}: ${serializeValue(sv, '        ')}`);
            return `      { ${pairs.join(', ')} }`;
          });
          famLines.push(`    saltos: [\n${saltoLines.join(',\n')}\n    ],`);
        }
      } else {
        famLines.push(`    ${k}: ${serializeValue(v, '    ')},`);
      }
    }
    famLines.push('  }' + (i < familias.length - 1 ? ',' : ''));
    lines.push(famLines.join('\n'));
  }
  lines.push(']');
  return lines.join('\n');
}

// ─── 3. Quitar filtro de Amazon del sidebar ──────────────────────────────

function removeAmazonFilter(html) {
  let changed = false;
  let before = html;

  // Pattern 1: <button ... data-group="plat" onclick="toggleFilter('plat','amz',...)">...(Amazon)...</button>
  html = html.replace(/<button\s+class="filter[^"]*"\s+data-group="plat"\s+onclick="toggleFilter\('plat','amz'[^"]*"[^>]*>[\s\S]*?<\/button>\s*/g, '');

  // Pattern 2: <button ... onclick="toggleFilter('plataforma','amz',...)">Solo AMZ</button>
  html = html.replace(/<button[^>]*onclick="toggleFilter\('plataforma','amz'[^"]*"[^>]*>[^<]*<\/button>\s*/g, '');

  // Pattern 3: <button ... data-plat="amz" ...>Amazon</button>
  html = html.replace(/<button[^>]*data-plat="amz"[^>]*>[\s\S]*?<\/button>\s*/g, '');

  // Pattern 4: "Ambas" button (toggleFilter('plataforma','ambas',...))
  // Quitar también "Ambas" porque ya solo hay una plataforma
  html = html.replace(/<button[^>]*onclick="toggleFilter\('plataforma','ambas'[^"]*"[^>]*>[^<]*<\/button>\s*/g, '');

  // Pattern 5: "Solo Mercado Libre" — renombrar a algo más neutral si es el único
  // (dejamos este botón, pero su lógica hará que muestre todos los que quedan)

  if (html !== before) changed = true;
  return { html, changed };
}

// ─── 4. Limpiar funciones de render ──────────────────────────────────────

function cleanRenderFunction(html) {
  let changed = false;
  const before = html;

  // Quitar líneas de filtro Amazon en varias formas:
  // if (filterState.plat === 'amz' && ...) return false;
  html = html.replace(/if\s*\(\s*filterState\.plat\s*===\s*'amz'[^)]*\)\s*return\s+false;\s*/g, '');
  // if (filtros.plataforma === 'amz') ...
  html = html.replace(/if\s*\(\s*filtros\.plataforma\s*===\s*'amz'\s*\)[^\n]*\n/g, '');
  // if (filters.plataforma === 'amz' && ...) return false;
  html = html.replace(/if\s*\(\s*filters\.plataforma\s*===\s*'amz'[^)]*\)\s*return\s+false;\s*/g, '');
  // if (filterState.plat === 'amz' && ...) return false; in celulares
  html = html.replace(/if\s*\(\s*filterState\.plat\s*===\s*'amz'[^\n]*\n/g, '');

  if (html !== before) changed = true;
  return { html, changed };
}

// ─── 5. Limpiar descuentos.json ──────────────────────────────────────────

function cleanDescuentos() {
  const files = findFiles(ROOT, 'descuentos.json');
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data.descuentos || !Array.isArray(data.descuentos)) continue;

      const before = data.descuentos.length;
      data.descuentos = data.descuentos.filter(d => d.plataforma !== 'amazon');

      // Limpiar propiedades Amazon de los que quedan
      for (const d of data.descuentos) {
        if ('linkAmz' in d) d.linkAmz = null;
        if ('precioAmz' in d) d.precioAmz = null;
      }

      const removed = before - data.descuentos.length;
      if (removed > 0 || before > 0) {
        writeFile(rel, JSON.stringify(data, null, 2) + '\n');
        stats.descuentosEliminados += removed;
        if (removed > 0) console.log(`  ${rel}: ${removed} ofertas Amazon eliminadas`);
      }
    } catch (e) {
      console.log(`  ⚠ Error en ${rel}: ${e.message}`);
    }
  }
}

// ─── 6. Limpiar bajadas.json ─────────────────────────────────────────────

function cleanBajadas() {
  const file = path.join(ROOT, 'assets/data/bajadas.json');
  if (!fs.existsSync(file)) return;

  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let totalRemoved = 0;

    for (const cat of Object.keys(data)) {
      if (!Array.isArray(data[cat])) continue;
      const before = data[cat].length;
      data[cat] = data[cat].filter(d => d.plataforma !== 'amazon');

      // Limpiar props Amazon
      for (const d of data[cat]) {
        if ('linkAmz' in d) d.linkAmz = null;
        if ('precioAmz' in d) d.precioAmz = null;
      }

      totalRemoved += before - data[cat].length;
    }

    if (totalRemoved > 0) {
      writeFile('assets/data/bajadas.json', JSON.stringify(data, null, 2) + '\n');
      stats.bajadasEliminadas = totalRemoved;
      console.log(`  bajadas.json: ${totalRemoved} bajadas Amazon eliminadas`);
    }
  } catch (e) {
    console.log(`  ⚠ Error en bajadas.json: ${e.message}`);
  }
}

// ─── 7. Limpiar catalog-mini.json ────────────────────────────────────────

function cleanCatalogMini() {
  const file = path.join(ROOT, 'celulares/catalog-mini.json');
  if (!fs.existsSync(file)) return;

  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let cleaned = 0;
    const keysToRemove = [];

    for (const [key, prod] of Object.entries(data)) {
      const hasML = prod.linkML && prod.linkML !== null;
      const hasAmz = prod.linkAmz && prod.linkAmz !== null;

      if (!hasML && hasAmz) {
        keysToRemove.push(key);
        continue;
      }

      if (hasAmz || prod.precioAmz) {
        prod.linkAmz = null;
        prod.precioAmz = null;
        cleaned++;
      }
    }

    for (const k of keysToRemove) {
      delete data[k];
    }

    if (keysToRemove.length > 0 || cleaned > 0) {
      writeFile('celulares/catalog-mini.json', JSON.stringify(data, null, 2) + '\n');
      console.log(`  catalog-mini.json: ${keysToRemove.length} eliminados, ${cleaned} limpiados`);
    }
  } catch (e) {
    console.log(`  ⚠ Error en catalog-mini.json: ${e.message}`);
  }
}

// ─── Utilidades ──────────────────────────────────────────────────────────

function findFiles(dir, name) {
  const results = [];
  function walk(d) {
    if (d.includes('.git') || d.includes('node_modules') || d.includes('.claude')) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === name) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ─── MAIN ────────────────────────────────────────────────────────────────

console.log(DRY ? '=== MODO DRY-RUN ===' : '=== Limpiando Amazon de páginas públicas ===');
console.log('');

console.log('1. Páginas con arrays JS...');
for (const page of JS_ARRAY_PAGES) {
  processJSArrayPage(page);
}

console.log('\n2. Páginas con HTML estático (celulares)...');
for (const page of STATIC_CARD_PAGES) {
  processStaticCardPage(page);
}

console.log('\n2b. Datos JS de celulares (familias)...');
for (const page of CELULARES_PAGES) {
  processCelularesPage(page);
}

console.log('\n3. Descuentos...');
cleanDescuentos();

console.log('\n4. Bajadas...');
cleanBajadas();

console.log('\n5. Catalog mini...');
cleanCatalogMini();

console.log('\n=== RESUMEN ===');
console.log(`Productos eliminados (solo Amazon): ${stats.productosEliminados}`);
console.log(`Productos limpiados (ambas → solo ML): ${stats.productosLimpiados}`);
console.log(`Cards HTML eliminadas: ${stats.cardsEliminadas}`);
console.log(`Descuentos Amazon eliminados: ${stats.descuentosEliminados}`);
console.log(`Bajadas Amazon eliminadas: ${stats.bajadasEliminadas}`);
console.log(`Filtros Amazon quitados: ${stats.filtrosQuitados}`);
console.log(`Archivos modificados: ${stats.archivosModificados.length}`);
if (stats.archivosModificados.length > 0) {
  for (const f of stats.archivosModificados) {
    console.log(`  - ${f}`);
  }
}
