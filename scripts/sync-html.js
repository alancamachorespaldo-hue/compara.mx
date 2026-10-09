#!/usr/bin/env node
/**
 * sync-html.js — Lee scripts/productos.json y aplica cambios a los HTML:
 *   - Productos con activo:false se eliminan del array JS en el HTML
 *   - Links (linkML, linkAmz) se actualizan en el array
 * Uso: node scripts/sync-html.js [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

const CATALOG = {
  laptops:     { file: 'laptops/index.html',                       varName: 'productos'  },
  suplementos: { file: 'suplementos/index.html',                   varName: 'productos'  },
  bicis:       { file: 'bicis/index.html',                         varName: 'ELECTRICAS' },
  freidoras:   { file: 'electrodomesticos/freidoras/index.html',   varName: 'productos'  },
  microondas:  { file: 'electrodomesticos/microondas/index.html',  varName: 'micros'     },
};

const productosJson = JSON.parse(readFileSync(resolve(ROOT, 'scripts/productos.json'), 'utf8'));
// merged-admin.json es la fuente de verdad para activo/pausado
let mergedAdmin = {};
try { mergedAdmin = JSON.parse(readFileSync(resolve(ROOT, 'scripts/merged-admin.json'), 'utf8')); } catch(e) {}

// Combinar: productos.json base + activo/links de merged-admin.json
const config = {};
for (const [cat, prods] of Object.entries(productosJson)) {
  const adminProds = mergedAdmin[cat] || [];
  const adminById = {};
  for (const p of adminProds) adminById[String(p.id)] = p;
  config[cat] = prods.map(p => {
    const a = adminById[String(p.id)];
    if (!a) return p;
    return { ...p, activo: a.activo, linkML: a.linkML ?? p.linkML, linkAmz: a.linkAmz ?? p.linkAmz,
      ...(a.precioML  != null ? {precioML:  a.precioML}  : {}),
      ...(a.precioAmz != null ? {precioAmz: a.precioAmz} : {}),
    };
  });
}

let totalPausados = 0, totalLinksActualizados = 0;

for (const [cat, { file, varName }] of Object.entries(CATALOG)) {
  const catConfig = config[cat];
  if (!catConfig) continue;

  // Índice por id para lookup rápido
  const configById = {};
  for (const p of catConfig) configById[String(p.id)] = p;

  const filePath = resolve(ROOT, file);
  let html = readFileSync(filePath, 'utf8');

  // Extraer el array JS como string
  const re = new RegExp(`((?:const|var|let)\\s+${varName}\\s*=\\s*)\\[`, 'mi');
  const match = html.match(re);
  if (!match) { console.warn(`⚠ No se encontró ${varName} en ${file}`); continue; }

  const prefixEnd = match.index + match[0].length - 1;
  const start = html.indexOf('[', match.index);
  let depth = 0, i = start, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) { console.warn(`⚠ No se pudo cerrar array en ${file}`); continue; }

  // Parsear productos con Function constructor
  const arrayStr = html.slice(start, end + 1);
  let prods;
  try { prods = new Function('return ' + arrayStr)(); }
  catch (e) { console.error(`✗ ${cat}: parse error (${e.message.slice(0,60)})`); continue; }

  let pausados = 0, linksActualizados = 0, preciosActualizados = 0;
  const nuevosProds = [];

  for (const p of prods) {
    const cfg = configById[String(p.id)];
    if (!cfg) { nuevosProds.push(p); continue; } // no está en config → conservar

    // Verificar si está pausado
    if (cfg.activo === false) {
      pausados++;
      continue; // omitir del array → desaparece del HTML
    }

    // Actualizar links si cambiaron
    let changed = false;
    if (cfg.linkML !== undefined && cfg.linkML !== p.linkML) {
      p.linkML = cfg.linkML;
      changed = true;
    }
    if (cfg.linkAmz !== undefined && cfg.linkAmz !== p.linkAmz) {
      p.linkAmz = cfg.linkAmz;
      changed = true;
    }
    if (changed) linksActualizados++;

    // Actualizar precios si cambiaron
    let precioChanged = false;
    if (cfg.precioML != null && cfg.precioML !== p.precioML) {
      p.precioML = cfg.precioML;
      precioChanged = true;
    }
    if (cfg.precioAmz != null && cfg.precioAmz !== p.precioAmz) {
      p.precioAmz = cfg.precioAmz;
      precioChanged = true;
    }
    // precio (campo genérico usado en algunos HTML)
    const precioAdmin = cfg.precioML ?? cfg.precioAmz ?? cfg.precio;
    if (precioAdmin != null && precioAdmin !== p.precio) {
      p.precio = precioAdmin;
      precioChanged = true;
    }
    if (precioChanged) preciosActualizados++;

    nuevosProds.push(p);
  }

  if (pausados === 0 && linksActualizados === 0 && preciosActualizados === 0) {
    console.log(`  ${cat}: sin cambios`);
    continue;
  }

  // Serializar el array de vuelta a JS
  const nuevoArrayStr = JSON.stringify(nuevosProds, null, 2)
    .replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:'); // claves sin comillas

  const newHtml = html.slice(0, start) + nuevoArrayStr + html.slice(end + 1);

  if (!DRY_RUN) {
    writeFileSync(filePath, newHtml, 'utf8');
  }

  console.log(`✓ ${cat}: ${pausados} pausados, ${linksActualizados} links, ${preciosActualizados} precios actualizados${DRY_RUN ? ' (dry-run)' : ''}`);
  totalPausados += pausados;
  totalLinksActualizados += linksActualizados;
}

// ── Productos nuevos publicados desde el artifact (_publicar) ───────────────
// Patrón original: solo bicis (ELECTRICAS). Generalizado para reutilizarse con cualquier
// categoría que tenga su propio array de productos en una página HTML.
// Un producto entra al array cuando _publicar:true, activo!==false y tiene linkML o linkAmz;
// si deja de cumplirlo, se retira. Nunca toca productos de otra categoría ni genera enlaces.
function syncPublicados(cat, config, toHtmlProduct, label) {
  const publicar = (mergedAdmin[cat] || []).filter(p => p._publicar);
  if (!publicar.length) return;
  const filePath = resolve(ROOT, config.file);
  if (!existsSync(filePath)) { console.warn(`  ⚠ No encontrado: ${config.file}`); return; }
  const html = readFileSync(filePath, 'utf8');
  const m = html.match(new RegExp(`((?:const|var|let)\\s+${config.varName}\\s*=\\s*)\\[`, 'm'));
  if (!m) { console.warn(`⚠ No se encontró ${config.varName} en ${config.file}`); return; }
  const start = html.indexOf('[', m.index);
  let depth = 0, end = -1;
  for (let i = start; i < html.length; i++) { if (html[i] === '[') depth++; else if (html[i] === ']' && --depth === 0) { end = i; break; } }
  if (end === -1) { console.warn(`⚠ No se pudo cerrar array en ${config.file}`); return; }
  let prods = new Function('return ' + html.slice(start, end + 1))();
  const enHtml = new Set(prods.map(p => String(p.id)));
  let agregadas = 0, quitadas = 0;
  for (const p of publicar) {
    const listo = p.activo !== false && (p.linkML || p.linkAmz);
    if (listo && !enHtml.has(String(p.id))) { prods.push(toHtmlProduct(p)); agregadas++; }
    if (!listo && enHtml.has(String(p.id))) { prods = prods.filter(x => String(x.id) !== String(p.id)); quitadas++; }
  }
  if (agregadas || quitadas) {
    const text = JSON.stringify(prods, null, 2).replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:');
    if (!DRY_RUN) writeFileSync(filePath, html.slice(0, start) + text + html.slice(end + 1), 'utf8');
    console.log(`✓ ${label} nuevos: ${agregadas} publicados, ${quitadas} retirados${DRY_RUN ? ' (dry-run)' : ''}`);
  }
}

// ── Bicis (comportamiento sin cambios respecto a la versión anterior) ───────
const toNum = s => { const m = String(s ?? '').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : null; };
const siNo = v => v == null ? null : v === 'Sí';
function bikeForHtml(p) {
  const e = p.especs || {};
  return {
    id: p.id, nombre: p.nombre, marca: p.marca, tipo: e.tipo || 'urbana',
    precio: p.precioML ?? p.precioAmz ?? p.precio ?? null, precioML: p.precioML ?? null, precioAmz: p.precioAmz ?? null,
    linkML: p.linkML || null, linkAmz: p.linkAmz || null, img: p.imagen || null,
    estrellas: p.estrellas ?? null, resenas: p.resenas ?? null, vendidosDeclarados: null,
    autonomia: toNum(e.autonomia), autonomiaStr: e.autonomia || null, velocidad: toNum(e.velocidad), peso: toNum(e.peso),
    motorStr: e.motor || null, batWh: toNum(e.bateria), batTipo: e.batTipo || null, batRemovible: siNo(e.removible),
    rueda: e.rueda || null, velocidades: null, tiempoCarga: e.tiempoCarga || null, cargaMax: toNum(e.cargaMax), ip: e.ip || null,
    batV: toNum(e.voltaje), plegable: siNo(e.plegable), luces: siNo(e.luces),
    ofertaColor: null, discrepanciasCount: 0, pendientes: [],
    badges: [...(p.linkML ? [{ t: 'ML', c: 'b-ml' }] : []), ...(p.linkAmz ? [{ t: 'AMZ', c: 'b-amz' }] : [])],
  };
}
syncPublicados('bicis', CATALOG.bicis, bikeForHtml, 'bicis');

// ── Videojuegos (nuevo: mismo mecanismo, esquema genérico con especs por categoría) ──
const VIDEOJUEGOS = {
  videojuegos_consolas:  { file: 'videojuegos/consolas/index.html',  varName: 'productos',
    specKeys: ['generacion', 'almacenamiento', 'lectorDiscos', 'formatoJuegos', 'tipoConsola', 'accesorios', 'condicion'] },
  videojuegos_controles: { file: 'videojuegos/controles/index.html', varName: 'productos',
    specKeys: ['modelo', 'plataforma', 'tipoConexion', 'alimentacion', 'bateria', 'funcionesEspeciales', 'condicion'] },
  videojuegos_juegos:    { file: 'videojuegos/juegos/index.html',    varName: 'productos',
    specKeys: ['plataforma', 'edicion', 'formato', 'genero', 'clasificacion', 'idiomas', 'condicion'] },
};
// Solo copia las claves de especs definidas para ESA categoría — nunca mezcla specs entre categorías.
function videojuegoForHtml(specKeys) {
  return p => {
    const e = p.especs || {};
    const especs = {};
    for (const k of specKeys) if (e[k] != null && e[k] !== '') especs[k] = e[k];
    return {
      id: p.id, nombre: p.nombre, marca: p.marca || null,
      precioML: p.precioML ?? null, precioAmz: p.precioAmz ?? null,
      linkML: p.linkML || null, linkAmz: p.linkAmz || null,
      img: p.imagen || null, estrellas: p.estrellas ?? null, resenas: p.resenas ?? null,
      especs,
    };
  };
}
for (const [cat, cfg] of Object.entries(VIDEOJUEGOS)) {
  syncPublicados(cat, cfg, videojuegoForHtml(cfg.specKeys), cat);
}

console.log(`\n✅ Total: ${totalPausados} productos pausados, ${totalLinksActualizados} links actualizados`);
