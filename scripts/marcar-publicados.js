#!/usr/bin/env node
/**
 * marcar-publicados.js — Anota en merged-admin.json qué productos están realmente
 * publicados en su página (`_enWeb`), leyendo el array de cada página.
 *
 * Por qué: el gestor solo ve la base, y la base no coincide con el sitio. Nov-2026:
 * laptops tenía 75 productos activos y la página 48; omega3 29 contra 12. El campo
 * `activo` no sirve para saberlo — `sync-html.js` solo cubre 5 categorías y solo
 * borra del HTML, nunca agrega, así que la base acumula productos que nunca se
 * publicaron (en laptops, 30 de ellos son de Amazon, de cuando existía esa cuenta).
 *
 * No cambia `activo` ni toca las páginas: solo deja la anotación para que el gestor
 * pueda mostrar "En la web" y su cuenta real.
 *
 * Uso: node scripts/marcar-publicados.js [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const DRY = process.argv.includes('--dry-run');

// clave de la base → [archivo, nombre del array]. Las que no estén aquí no se anotan.
const PAGINAS = {
  laptops: ['laptops/index.html', 'productos'],
  freidoras: ['electrodomesticos/freidoras/index.html', 'productos'],
  microondas: ['electrodomesticos/microondas/index.html', 'micros'],
  cafeteras: ['electrodomesticos/cafeteras/index.html', 'productos'],
  refrigeradores: ['electrodomesticos/refrigeradores/index.html', 'productos'],
  lavadoras: ['electrodomesticos/lavadoras/index.html', 'productos'],
  ollas: ['electrodomesticos/ollas/index.html', 'productos'],
  proteina: ['suplementos/proteina/index.html', 'productos'],
  omega3: ['suplementos/omega3/index.html', 'productos'],
  magnesio: ['suplementos/magnesio/index.html', 'productos'],
  creatina: ['suplementos/creatina/index.html', 'productos'],
  complejo_b: ['suplementos/complejo-b/index.html', 'PRODUCTOS'],
  vitamina_d: ['suplementos/vitamina-d/index.html', 'PRODUCTOS'],
  videojuegos_consolas: ['videojuegos/consolas/index.html', 'productos'],
  videojuegos_controles: ['videojuegos/controles/index.html', 'productos'],
  videojuegos_juegos: ['videojuegos/juegos/index.html', 'productos'],
  tecnologia_bocinas: ['tecnologia/bocinas/index.html', 'productos'],
  tecnologia_audifonos: ['tecnologia/audifonos/index.html', 'productos'],
  tecnologia_smartwatches: ['tecnologia/smartwatches/index.html', 'productos'],
  streaming: ['entretenimiento/streaming/index.html', 'productos'],
  bicis: ['bicis/index.html', 'ELECTRICAS'],
  bicisMontana: ['bicis/index.html', 'MONTANA'],
  bicisGravelRuta: ['bicis/index.html', 'GRAVELRUTA'],
};
// Celulares: familias con variantes, el id de la base se arma aparte.
const FAMILIAS = {
  celulares_android: ['celulares/android/index.html', 'familias'],
  celulares_iphone: ['celulares/iphone/index.html', 'familias'],
};

function leerArray(rel, nombre) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return null;
  const L = readFileSync(abs, 'utf8').split('\n');
  const i = L.findIndex(l => l.trimStart().startsWith(`const ${nombre} = [`));
  if (i < 0) return null;
  let j = i;
  while (j < L.length && !/^\s*\];/.test(L[j])) j++;
  try {
    return new Function(`return ${L.slice(i, j + 1).join('\n').replace(/^\s*const \w+ =/, '').replace(/;\s*$/, '')}`)();
  } catch (e) {
    console.error(`  ⚠ ${rel} ${nombre}: no se pudo leer (${e.message})`);
    return null;
  }
}

const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
let cambios = 0;
const resumen = [];

for (const [clave, [rel, nombre]] of Object.entries(PAGINAS)) {
  const lista = db[clave];
  if (!Array.isArray(lista)) continue;
  const pag = leerArray(rel, nombre);
  if (!pag) { console.error(`  ⚠ ${clave}: sin array ${nombre} en ${rel}`); continue; }
  const ids = new Set(pag.map(p => String(p.id)));
  // Se compara por id, no por link: hay links repetidos entre productos distintos y
  // compararlos infla la cuenta (creatina y consolas daban uno y dos de más).
  // Algunas páginas numeran sus productos (1, 2, 3…) mientras la base les pone prefijo
  // ("streaming-1"). Solo en ese caso se compara también por el número final.
  const porNumero = pag.every(p => /^\d+$/.test(String(p.id))) && lista.some(p => /^[a-z_]+-\d+$/i.test(String(p.id)));
  let n = 0;
  for (const p of lista) {
    const id = String(p.id);
    const enWeb = ids.has(id) || (porNumero && ids.has(id.replace(/^[a-z_]+-/i, '')));
    if (p._enWeb !== enWeb) { p._enWeb = enWeb; cambios++; }
    if (enWeb) n++;
  }
  resumen.push([clave, lista.length, n, pag.length]);
}

// Los links de las variantes identifican al producto en la base mejor que el id compuesto.
for (const [clave, [rel, nombre]] of Object.entries(FAMILIAS)) {
  const lista = db[clave];
  if (!Array.isArray(lista)) continue;
  const fam = leerArray(rel, nombre);
  if (!fam) { console.error(`  ⚠ ${clave}: sin array ${nombre} en ${rel}`); continue; }
  const links = new Set();
  const ids = new Set();
  let variantes = 0;
  for (const f of fam) for (const v of f.variantes || []) {
    variantes++;
    if (v.linkML) links.add(v.linkML);
    if (v.id) ids.add(String(v.id));
  }
  let n = 0;
  for (const p of lista) {
    // Solo por id: hay variantes distintas que comparten el mismo link de afiliado
    // (el iPhone 17 de 256 y el de 512 GB, por ejemplo), y compararlas por link las
    // daba a las dos por publicadas.
    const enWeb = ids.has(String(p.id));
    if (p._enWeb !== enWeb) { p._enWeb = enWeb; cambios++; }
    if (enWeb) n++;
  }
  resumen.push([clave, lista.length, n, variantes]);
}

console.log('categoría                 en la base   en la web   (la página muestra)');
for (const [k, total, n, pag] of resumen) {
  const aviso = n === pag ? '' : '  ←';
  console.log(`  ${k.padEnd(24)}${String(total).padStart(6)}${String(n).padStart(12)}${String(pag).padStart(14)}${aviso}`);
}
console.log(`\n${cambios} anotaciones cambiadas`);
if (DRY) { console.log('🔍 DRY RUN — no se escribió nada'); process.exit(0); }
writeFileSync(ADMIN, JSON.stringify(db, null, 2), 'utf8');
console.log('💾 merged-admin.json actualizado');
