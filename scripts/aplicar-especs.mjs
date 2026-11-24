#!/usr/bin/env node
/**
 * aplicar-especs.mjs — mete en merged-admin.json las características que se corrigieron a mano
 * en el Centro de Control.
 *
 *   node scripts/aplicar-especs.mjs <archivo.json>              # solo reporte
 *   node scripts/aplicar-especs.mjs <archivo.json> --aplicar
 *
 * El Centro guarda cada corrección en el almacenamiento del artifact (colección `especs`), de
 * donde sale un JSON con esta forma — también vale el que copia el botón "Copiar correcciones":
 *   [ { "cat": "laptops", "id": "exp_MLM65737068",
 *       "especs": { "procesador": "Ryzen 5 7520U", "ram": "16 GB" } }, … ]
 * o el volcado directo de la colección: { "laptops__exp_MLM65737068": { … } }.
 *
 * Solo toca el campo `especs` del producto: ni links, ni precios, ni pausas. Una clave con el
 * texto vacío BORRA esa característica. Después hay que correr `node scripts/sync-html.js` o
 * editar la página, según la categoría: las características viven en el array JS del HTML y
 * sync-html.js solo cubre laptops, suplementos, bicis, freidoras y microondas — en las demás
 * este script deja el aviso de cuáles hay que pasar a mano.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIAS } from './categorias.js';

const ROOT = resolve(import.meta.dirname, '..');
const RUTA = resolve(ROOT, 'scripts/merged-admin.json');
const APLICAR = process.argv.includes('--aplicar');
const archivo = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!archivo) {
  console.error('Uso: node scripts/aplicar-especs.mjs <archivo.json> [--aplicar]');
  process.exit(1);
}

/** Categorías cuyo HTML se sincroniza solo desde la base. */
const SYNC_HTML = new Set(['laptops', 'proteina', 'omega3', 'magnesio', 'creatina', 'complejo_b', 'vitamina_d', 'bicis', 'freidoras', 'microondas']);

const crudo = JSON.parse(readFileSync(resolve(process.cwd(), archivo), 'utf8'));
// Acepta las dos formas: arreglo de correcciones, o volcado de la colección por clave.
const lista = Array.isArray(crudo) ? crudo
  : Object.entries(crudo).map(([k, v]) => ({ cat: v.cat ?? k.split('__')[0], id: String(v.id ?? k.split('__').slice(1).join('__')), especs: v.especs || {} }));

const db = JSON.parse(readFileSync(RUTA, 'utf8'));
const titulo = {};
for (const [clave, c] of Object.entries(CATEGORIAS)) titulo[c.datos || clave] = c.titulo;

const hechos = [], fallos = [], aMano = new Set();

for (const c of lista) {
  const arr = db[c.cat];
  if (!Array.isArray(arr)) { fallos.push(`${c.cat}: no existe esa categoría en la base`); continue; }
  const p = arr.find(x => String(x.id) === String(c.id));
  if (!p) { fallos.push(`${c.cat}/${c.id}: no existe ese producto`); continue; }
  const antes = { ...(p.especs || {}) };
  const despues = { ...antes };
  const cambios = [];
  for (const [k, v] of Object.entries(c.especs || {})) {
    const nuevo = String(v ?? '').trim();
    const viejo = antes[k] == null ? '' : String(antes[k]);
    if (nuevo === viejo) continue;
    if (!nuevo) { delete despues[k]; cambios.push(`${k}: "${viejo}" → (se borra)`); }
    else { despues[k] = nuevo; cambios.push(`${k}: ${viejo ? `"${viejo}" → ` : ''}"${nuevo}"`); }
  }
  if (!cambios.length) continue;
  if (APLICAR) {
    p.especs = despues;
    p._especsEditadas = new Date().toISOString().slice(0, 10);
  }
  hechos.push({ cat: c.cat, catTitulo: titulo[c.cat] || c.cat, id: String(c.id), nombre: p.nombre, cambios });
  if (!SYNC_HTML.has(c.cat)) aMano.add(titulo[c.cat] || c.cat);
}

if (APLICAR && hechos.length) writeFileSync(RUTA, JSON.stringify(db, null, 2));

console.log(`\nCaracterísticas${APLICAR ? ' aplicadas' : ' (solo reporte)'} · ${hechos.length} producto(s)\n`);
for (const h of hechos) {
  console.log(`  ${h.catTitulo} · ${h.nombre.slice(0, 50)} (${h.id})`);
  for (const c of h.cambios) console.log(`      ${c}`);
}
if (fallos.length) { console.log('\n  No se pudieron aplicar:'); for (const f of fallos) console.log('      · ' + f); }
if (!hechos.length) console.log('  Nada que cambiar: la base ya dice lo mismo.');
console.log(APLICAR
  ? '\n  Escrito en merged-admin.json. Ahora: node scripts/sync-html.js && node scripts/check-site.js'
  : '\n  No se escribió nada. Agrega --aplicar.');
if (aMano.size) console.log(`  OJO: ${[...aMano].join(', ')} no pasa(n) por sync-html.js — ahí hay que editar el array del HTML a mano.`);
console.log('');
