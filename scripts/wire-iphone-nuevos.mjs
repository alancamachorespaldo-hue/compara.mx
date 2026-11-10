/**
 * wire-iphone-nuevos.mjs
 * Fusiona scripts/iphone-nuevos-report.json (datos reales de la API de ML) al
 * array `const familias` de celulares/iphone/index.html.
 *
 * Por cada (modelo, talla):
 *  - actualiza/crea la variante con su mlId, enlace de afiliado (meli.la) e imagen reales;
 *  - el PRECIO: conserva el de la página si la variante ya existe (precios curados);
 *    para variantes NUEVAS usa el precio de la API solo si es sano (descarta grises);
 *  - descarta los 2 IDs que no son iPhone (muñeco / "iPhone Duo").
 *
 * Uso:
 *   node scripts/wire-iphone-nuevos.mjs            # dry-run: imprime el plan
 *   node scripts/wire-iphone-nuevos.mjs --aplicar  # escribe el HTML
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--aplicar');
const HTML  = resolve(ROOT, 'celulares/iphone/index.html');
const REPORT= resolve(ROOT, 'scripts/iphone-nuevos-report.json');

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
let html = readFileSync(HTML, 'utf8');

// ── Extraer const familias = [...] ────────────────────────────────────────────
const marker = 'const familias = [';
const mStart = html.indexOf(marker);
if (mStart === -1) throw new Error('No encontré const familias');
const arrStart = html.indexOf('[', mStart);
let depth = 0, j = arrStart;
for (; j < html.length; j++) {
  const c = html[j];
  if (c === '[' || c === '{') depth++;
  else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  else if (c === '"' || c === "'" || c === '`') {
    const q = c; j++;
    while (j < html.length) { if (html[j] === '\\') { j += 2; continue; } if (html[j] === q) break; j++; }
  }
}
const arrEnd = j + 1;
const familias = Function('"use strict"; return ' + html.slice(arrStart, arrEnd))();

// ── Normalizar nombre de modelo del reporte → nombre de familia ───────────────
function modelName(nombre) {
  const n = nombre.replace(/Apple |Smartphone /g, '');
  const pats = [
    ['iPhone 18 Pro Max', /iPhone\s*18\s*Pro\s*Max/i],
    ['iPhone 18 Pro',     /iPhone\s*18\s*Pro/i],
    ['iPhone 17 Pro Max', /iPhone\s*17\s*Pro\s*Max/i],
    ['iPhone 17 Pro',     /iPhone\s*17\s*Pro/i],
    ['iPhone 17e',        /iPhone\s*17e/i],
    ['iPhone 17',         /iPhone\s*17/i],
    ['iPhone 16e',        /iPhone\s*16e/i],
    ['iPhone 16',         /iPhone\s*16/i],
    ['iPhone 15',         /iPhone\s*15/i],
    ['iPhone Air',        /iPhone\s*Air/i],
  ];
  for (const [name, re] of pats) if (re.test(n)) return name;
  return null;
}
function storageGB(almac) {
  if (!almac) return null;
  const s = almac.toLowerCase();
  if (s.includes('tb')) return parseFloat(s) * 1024;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
const esGris = nombre => /distribuidor/i.test(nombre);

// ── Agrupar reporte por modelo+talla, elegir mejor candidato ──────────────────
const grupos = {}; // modelName -> storageGB -> {mlId, linkML, img, precioML, nombre}
const descartados = [];
for (const d of report) {
  if (!d || d._error) continue;
  const nm = d.nombre || '';
  if (!/iphone/i.test(nm) || /duo/i.test(nm)) { descartados.push(d); continue; }
  const model = modelName(nm);
  const gb = storageGB(d.almacenamiento);
  if (!model || !gb) { descartados.push(d); continue; }
  grupos[model] ??= {};
  const prev = grupos[model][gb];
  const cand = { mlId: d.mlId, linkML: d.linkML, img: d.img, precioML: d.precioML, nombre: nm, gris: esGris(nm) };
  // preferir vendedor no-"Distribuidor"; entre iguales, menor precio con precio presente
  if (!prev) grupos[model][gb] = cand;
  else {
    const better = (!cand.gris && prev.gris) ||
      (cand.gris === prev.gris && (cand.precioML ?? 1e9) < (prev.precioML ?? 1e9));
    if (better) grupos[model][gb] = cand;
  }
}

// ── Precio sano para variante NUEVA ───────────────────────────────────────────
function precioSano(gb, api, familia) {
  if (api == null) return { precio: null, nota: 'sin precio API' };
  if (api < 4000 || api > 70000) return { precio: null, nota: `fuera de rango ($${api})` };
  const sib = (familia.variantes || []).map(v => v.precioML).filter(p => p != null);
  if (sib.length) {
    const ref = sib.reduce((a, b) => a + b, 0) / sib.length;
    if (api < ref * 0.5 || api > ref * 2.2) return { precio: null, nota: `atípico vs hermanas ($${api})` };
  }
  return { precio: api, nota: null };
}

// ── Fusionar ──────────────────────────────────────────────────────────────────
const plan = [];
for (const [model, porTalla] of Object.entries(grupos)) {
  // familia: por nombre, prefiriendo la NO reacondicionada
  const cands = familias.filter(f => f.nombre === model);
  const familia = cands.find(f => !f.reacondicionado) || cands[0];
  if (!familia) { plan.push({ model, accion: '⚠ sin familia en la página — SE OMITE' }); continue; }
  for (const gb of Object.keys(porTalla).map(Number).sort((a, b) => a - b)) {
    const c = porTalla[gb];
    const existente = (familia.variantes || []).find(v => v.almacenamientoGB === gb);
    if (existente) {
      const cambios = [];
      if (existente.linkML !== c.linkML) cambios.push('link');
      if (existente.img !== c.img) cambios.push('img');
      if (existente.mlId !== c.mlId) cambios.push('mlId');
      plan.push({ model, gb, accion: cambios.length ? `actualiza ${cambios.join('+')} (precio se conserva: $${existente.precioML ?? '—'})` : 'sin cambios', _apply: () => {
        existente.linkML = c.linkML; existente.img = c.img; existente.mlId = c.mlId;
      }});
    } else {
      const base = (familia.variantes || [])[0] || {};
      const { precio, nota } = precioSano(gb, c.precioML, familia);
      plan.push({ model, gb, accion: `NUEVA variante ${gb}GB — precio ${precio != null ? '$' + precio : 'null (' + nota + ')'}`, _apply: () => {
        const nueva = {
          id: `apple-${familia.modeloBase}-${gb}gb`,
          almacenamientoGB: gb,
          precio: precio, precioML: precio, precioAmz: null,
          linkML: c.linkML, linkAmz: null,
          img: c.img,
          estrellas: base.estrellas ?? null,
          resenas: base.resenas ?? null,
          vendidos: null,
          preventa: familia.preventa ?? false,
          mlId: c.mlId,
        };
        familia.variantes.push(nueva);
        familia.variantes.sort((a, b) => a.almacenamientoGB - b.almacenamientoGB);
      }});
    }
  }
}

// ── Serializador fiel al estilo actual del archivo ───────────────────────────
// Escalares y strings con comillas dobles (JSON.stringify para strings).
function scal(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v); // string → comillas dobles
}
// Objeto en una sola línea: { k: v, k: v }
function inlineObj(o) {
  return '{ ' + Object.keys(o).map(k => `${k}: ${scal(o[k])}`).join(', ') + ' }';
}
// Array inline de primitivos: ["a", "b"]  (o [] )
function inlineArr(a) {
  return '[' + a.map(scal).join(', ') + ']';
}
// Una familia completa, campos multilínea; variantes/saltos como one-liners con coma final.
function serFamilia(f) {
  const lines = [];
  for (const k of Object.keys(f)) {
    const v = f[k];
    if (k === 'variantes' || k === 'saltos') {
      const arr = Array.isArray(v) ? v : [];
      if (!arr.length) { lines.push(`    ${k}: []`); continue; }
      const items = arr.map(o => `      ${inlineObj(o)},`).join('\n');
      lines.push(`    ${k}: [\n${items}\n    ]`);
    } else if (Array.isArray(v)) {
      lines.push(`    ${k}: ${v.length ? inlineArr(v) : '[]'}`);
    } else {
      lines.push(`    ${k}: ${scal(v)}`);
    }
  }
  return '  {\n' + lines.join(',\n') + '\n  }';
}
function serFamilias(fams) {
  return '[\n' + fams.map(serFamilia).join(',\n') + '\n]';
}

// ── Reporte ───────────────────────────────────────────────────────────────────
console.log('DESCARTADOS (no iPhone válido):');
for (const d of descartados) console.log(`  ${d.mlId} — ${(d.nombre || '').slice(0, 50)}`);
console.log('\nPLAN DE CABLEADO:');
let nuevas = 0, actualiza = 0;
for (const p of plan) {
  console.log(`  ${(p.model + (p.gb ? ' ' + p.gb + 'GB' : '')).padEnd(26)} ${p.accion}`);
  if (/NUEVA/.test(p.accion)) nuevas++;
  if (/actualiza/.test(p.accion)) actualiza++;
}
console.log(`\nResumen: ${nuevas} variantes nuevas, ${actualiza} actualizadas.`);

if (!APPLY) { console.log('\n💡 Corré con --aplicar para escribir el HTML.'); process.exit(0); }

for (const p of plan) p._apply?.();
let newArr = serFamilias(familias);
// El HTML usa CRLF; el serializador emite LF → convertir para no mezclar finales de línea.
const fileCRLF = html.includes('\r\n');
if (fileCRLF) newArr = newArr.replace(/\r?\n/g, '\r\n');
html = html.slice(0, arrStart) + newArr + html.slice(arrEnd);
writeFileSync(HTML, html);
console.log('\n✅ celulares/iphone/index.html: familias actualizado.');
