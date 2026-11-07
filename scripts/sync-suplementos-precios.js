#!/usr/bin/env node
/**
 * sync-suplementos-precios.js — Lleva de merged-admin.json a las subpáginas de
 * suplementos (proteína, creatina, omega3, magnesio, complejo B, vitamina D):
 *
 *   1) El precio de Amazon capturado a mano (precioAmz). Solo lo escribe cuando:
 *      - el producto existe en la página con el MISMO id,
 *      - el link de Amazon de la BD y el de la página apuntan al MISMO ASIN
 *        (misma ficha de Amazon) — los links de la BD para suplementos no son
 *        confiables, los buenos son los de la página; el ASIN evita escribir el
 *        precio de otro producto,
 *      - Amazon no está pausado en la BD (eso lo maneja sync-pausas.js),
 *      - y el salto contra el precio de la página no pasa MAX_SALTO (25%).
 *      Lo que no cumple se omite y se anota en suplementos-precios-report.json.
 *
 *   2) Pausar / eliminar: un producto marcado activo:false en la BD (pausado o
 *      eliminado con _eliminado desde el admin) se quita de la página, confirmando
 *      identidad por nombre para no borrar por un id de otra categoría.
 *
 * No toca `precio` (valor curado para orden/filtro) ni precioML (eso es ml-update.js).
 * No empareja por nombre ni por número de id a ciegas.
 *
 * Uso: node scripts/sync-suplementos-precios.js [--aplicar] [--categoria=proteina]
 *   Sin --aplicar es dry-run (no escribe el HTML; sí escribe el reporte).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APLICAR = process.argv.includes('--aplicar');
const CAT_ARG = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? null;
const MAX_SALTO = 0.25;

const PAGES = {
  proteina:   { file: 'suplementos/proteina/index.html',   varName: 'productos' },
  creatina:   { file: 'suplementos/creatina/index.html',   varName: 'productos' },
  omega3:     { file: 'suplementos/omega3/index.html',     varName: 'productos' },
  magnesio:   { file: 'suplementos/magnesio/index.html',   varName: 'productos' },
  complejo_b: { file: 'suplementos/complejo-b/index.html', varName: 'PRODUCTOS' },
  vitamina_d: { file: 'suplementos/vitamina-d/index.html', varName: 'PRODUCTOS' },
};

const merged = JSON.parse(readFileSync(resolve(ROOT, 'scripts/merged-admin.json'), 'utf8'));
const REPORT = [];

// ── Helpers (mismo patrón seguro que ml-update.js) ──────────────────────────
const asin = u => {
  const m = String(u || '').match(/\/(?:dp|gp\/product|d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
};
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Comparten identidad si los primeros tokens del nombre coinciden (guarda contra id de otra categoría).
function mismoNombre(a, b) {
  const ta = norm(a).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const tb = norm(b).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const setb = new Set(tb);
  const comunes = ta.filter(t => setb.has(t)).length;
  return comunes >= Math.min(4, Math.min(ta.length, tb.length));
}

function locateArray(html, varName) {
  const m = html.match(new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*\\[`, 'm'));
  if (!m) return null;
  const start = html.indexOf('[', m.index);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']' && --depth === 0) return { start, end: i + 1 };
  }
  return null;
}

const BLOCK_ID_RX = /(?:^|[{,\s])["']?id["']?\s*:\s*["'`]?([^,"'`\s}]+)/;
function topBlocks(text) {
  const blocks = [];
  let depth = 0, s = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth++ === 0) s = i; }
    else if (text[i] === '}' && --depth === 0) {
      const body = text.slice(s, i + 1);
      blocks.push({ s, e: i + 1, id: body.match(BLOCK_ID_RX)?.[1] ?? null });
    }
  }
  return blocks;
}

// Reescribe precioAmz conservando el formato de la clave (con o sin comillas).
function setPrecioAmz(block, valor) {
  const num = Number.isInteger(valor) ? String(valor) : String(valor);
  return block.replace(/(["']?\bprecioAmz["']?\s*:\s*)(null|["']?\$?[\d.]+["']?)/, `$1${num}`);
}

function procesar(key) {
  const cfg = PAGES[key];
  const abs = resolve(ROOT, cfg.file);
  if (!existsSync(abs)) { console.log(`  ⚠ No encontrado: ${cfg.file}`); return; }
  let html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, cfg.varName);
  if (!loc) { console.log(`  ⚠ Sin array ${cfg.varName} en ${cfg.file}`); return; }

  const arrayText = html.slice(loc.start, loc.end);
  const htmlProds = new Function(`return ${arrayText}`)();
  const blocks = topBlocks(arrayText);
  if (blocks.length !== htmlProds.length) { console.log(`  ⚠ ${key}: bloques (${blocks.length}) ≠ productos (${htmlProds.length}); se omite por seguridad`); return; }

  const admById = new Map((merged[key] || []).map(p => [String(p.id), p]));

  // patches: { i, block, nuevo }  ·  removals: [i]
  const patches = [];
  const removals = [];
  let precios = 0, pausados = 0, omitidos = 0;

  htmlProds.forEach((p, i) => {
    const a = admById.get(String(p.id));
    if (!a) return; // no está en la BD → la página manda, no se toca

    // Pausar / eliminar (activo:false) → quitar, confirmando identidad por nombre
    if (a.activo === false) {
      if (mismoNombre(a.nombre, p.nombre)) { removals.push(i); pausados++; }
      else { REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'omitido_eliminar', motivo: 'id no coincide por nombre con la BD' }); omitidos++; }
      return;
    }

    // Precio de Amazon
    if (a.precioAmz == null) return;        // nada capturado
    if (a.pausaAmz) return;                 // pausa de plataforma → sync-pausas.js
    // Solo se actualiza un campo que la página ya tiene: nunca se inserta ni reestructura.
    // Algunas páginas (p. ej. complejo B) no usan precioAmz; esas quedan para revisión manual.
    if (!('precioAmz' in p)) { REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'omitido_precio', motivo: 'la página no usa el campo precioAmz (no se inserta)', precioBD: a.precioAmz }); omitidos++; return; }
    const asinPag = asin(p.linkAmz), asinBd = asin(a.linkAmz);
    if (!asinPag) { if (a.precioAmz !== p.precioAmz) { REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'omitido_precio', motivo: 'la página no tiene link de Amazon' }); omitidos++; } return; }
    if (!asinBd || asinBd !== asinPag) { REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'omitido_precio', motivo: asinBd ? `ASIN distinto (página ${asinPag} vs BD ${asinBd})` : 'el link de Amazon de la BD no tiene ASIN', precioBD: a.precioAmz, precioPagina: p.precioAmz ?? null }); omitidos++; return; }

    const viejo = p.precioAmz;
    if (viejo === a.precioAmz) return;      // sin cambio
    if (viejo != null && viejo > 0 && Math.abs(a.precioAmz - viejo) / viejo > MAX_SALTO) {
      const pct = Math.round(Math.abs(a.precioAmz - viejo) / viejo * 100);
      REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'omitido_precio', motivo: `salto ${pct}% supera el tope ${MAX_SALTO * 100}%`, precioBD: a.precioAmz, precioPagina: viejo });
      omitidos++; return;
    }
    patches.push({ i, nuevo: a.precioAmz, viejo });
    REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, accion: 'precio', precioAntes: viejo ?? null, precioNuevo: a.precioAmz });
    precios++;
  });

  if (!patches.length && !removals.length) { console.log(`  ${key}: sin cambios${omitidos ? ` (${omitidos} omitidos, ver reporte)` : ''}`); return; }

  // Texto de cada bloque, con el parche de precio ya aplicado si lo hubiera.
  const patchByIdx = new Map(patches.map(x => [x.i, x.nuevo]));
  const removeSet = new Set(removals);
  const blockText = i => patchByIdx.has(i) ? setPrecioAmz(arrayText.slice(blocks[i].s, blocks[i].e), patchByIdx.get(i)) : arrayText.slice(blocks[i].s, blocks[i].e);

  let newArray;
  if (!removeSet.size) {
    // Solo parches de precio: splice de atrás hacia adelante (diff mínimo, estructura intacta).
    newArray = arrayText;
    for (const x of [...patches].sort((a, b) => b.i - a.i)) {
      newArray = newArray.slice(0, blocks[x.i].s) + setPrecioAmz(newArray.slice(blocks[x.i].s, blocks[x.i].e), x.nuevo) + newArray.slice(blocks[x.i].e);
    }
  } else {
    // Hay remociones: reconstruir desde los bloques conservados, con el separador original.
    const sep = blocks.length > 1 ? arrayText.slice(blocks[0].e, blocks[1].s) : ',\n';
    const kept = [];
    for (let i = 0; i < blocks.length; i++) if (!removeSet.has(i)) kept.push(blockText(i));
    const head = arrayText.slice(0, blocks[0].s);                       // '[' + sangría inicial
    const tail = arrayText.slice(blocks[blocks.length - 1].e);          // sangría final + ']'
    newArray = kept.length ? head + kept.join(sep) + tail : '[]';
  }

  // Validar que el array sigue siendo JS parseable y con el conteo esperado.
  let parsed;
  try { parsed = new Function(`return ${newArray}`)(); }
  catch (e) { console.error(`  ✗ ${key}: el resultado no parsea (${e.message.slice(0, 60)}); NO se escribe`); return; }
  const esperado = htmlProds.length - removals.length;
  if (parsed.length !== esperado) { console.error(`  ✗ ${key}: conteo inesperado (${parsed.length} ≠ ${esperado}); NO se escribe`); return; }
  // Confirmar que cada precio parcheado quedó escrito con el valor exacto.
  const parsedById = new Map(parsed.map(p => [String(p.id), p]));
  for (const x of patches) {
    const got = parsedById.get(String(htmlProds[x.i].id));
    if (!got || got.precioAmz !== x.nuevo) { console.error(`  ✗ ${key}: el precio de id ${htmlProds[x.i].id} no se escribió (${got?.precioAmz} ≠ ${x.nuevo}); NO se escribe`); return; }
  }

  if (APLICAR) writeFileSync(abs, html.slice(0, loc.start) + newArray + html.slice(loc.end), 'utf8');
  console.log(`  ✓ ${key}: ${precios} precios Amazon, ${pausados} quitados${omitidos ? `, ${omitidos} omitidos` : ''}${APLICAR ? '' : ' (dry-run)'}`);
}

const cats = CAT_ARG ? [CAT_ARG] : Object.keys(PAGES);
console.log(`Sync Amazon → suplementos${APLICAR ? '' : ' (dry-run; usa --aplicar para escribir)'}\n`);
for (const key of cats) {
  if (!PAGES[key]) { console.log(`  ⚠ Categoría desconocida: ${key}`); continue; }
  procesar(key);
}

writeFileSync(resolve(ROOT, 'scripts/suplementos-precios-report.json'), JSON.stringify(REPORT, null, 2), 'utf8');
const cambios = REPORT.filter(r => r.accion === 'precio').length;
const omit = REPORT.filter(r => r.accion.startsWith('omitido')).length;
console.log(`\n${cambios} precios aplicables · ${omit} omitidos (revisa scripts/suplementos-precios-report.json)`);
