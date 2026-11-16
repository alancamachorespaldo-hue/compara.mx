#!/usr/bin/env node
/**
 * Revisa que los archivos de datos estén sanos antes de confirmarlos (commit).
 *
 * Por qué existe: el 16-nov-2026 el workflow de precios subió scripts/merged-admin.json
 * con 1,065 bloques de conflicto («<<<<<<< Updated upstream» / «>>>>>>> Stashed changes»)
 * de un `git pull --rebase --autostash` que chocó contra otra corrida simultánea. El JSON
 * dejó de poder leerse y con él tronaron ml-update.js, generar-admin.js, sync-html.js,
 * generar-catalog-mini.js y sync-guias-precios.js. Nadie se enteró hasta el día siguiente
 * porque `git add` y `git commit` confirman un archivo con marcas de conflicto sin quejarse.
 *
 * Esto revisa dos cosas en cada JSON de datos:
 *   1. Que no tenga marcas de conflicto de git.
 *   2. Que se pueda leer con JSON.parse.
 * Y, en merged-admin.json, que no se haya quedado vacío (una base de 0 productos casi
 * siempre significa que un script falló a la mitad).
 *
 * Se corre en los workflows justo antes del commit. Si algo está mal, sale con código 1
 * y el workflow falla a la vista en lugar de publicar datos rotos.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

/* Dónde viven los datos: la base y los reportes, el histórico y los JSON que leen las
   páginas (descuentos.json, catalog-mini.json, bajadas.json). */
const CARPETAS = ['scripts', 'assets/data'];
const SUELTOS = ['sitemap.xml'];

/* Se buscan en cualquier posición, no solo al principio de la línea: un archivo sin salto
   final deja la marca pegada a la última llave («}<<<<<<< Updated upstream»). */
const MARCAS = /<{7} |>{7} |(^|\n)={7}(\r?\n|$)/;

function jsons(dir, salida = []) {
  if (!existsSync(dir)) return salida;
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) jsons(ruta, salida);
    else if (nombre.endsWith('.json')) salida.push(ruta);
  }
  return salida;
}

/* Los JSON que publican las páginas viven junto a cada listado */
function jsonsDePaginas(dir, salida = [], hondo = 0) {
  if (hondo > 3 || !existsSync(dir)) return salida;
  for (const nombre of readdirSync(dir)) {
    if (nombre.startsWith('.') || nombre === 'node_modules' || nombre === 'scripts' || nombre === 'assets') continue;
    const ruta = join(dir, nombre);
    let st;
    try { st = statSync(ruta); } catch { continue; }
    if (st.isDirectory()) jsonsDePaginas(ruta, salida, hondo + 1);
    else if (nombre === 'descuentos.json' || nombre === 'catalog-mini.json') salida.push(ruta);
  }
  return salida;
}

const archivos = [
  ...CARPETAS.flatMap((c) => jsons(join(RAIZ, c))),
  ...jsonsDePaginas(RAIZ),
  ...SUELTOS.map((f) => join(RAIZ, f)).filter(existsSync),
];

const problemas = [];
for (const abs of archivos) {
  const rel = relative(RAIZ, abs).replace(/\\/g, '/');
  let texto;
  try {
    texto = readFileSync(abs, 'utf8');
  } catch (e) {
    problemas.push(`${rel}: no se pudo leer (${e.message})`);
    continue;
  }
  if (MARCAS.test(texto)) {
    const linea = texto.split('\n').findIndex((l) => MARCAS.test(l)) + 1;
    problemas.push(`${rel}: tiene marcas de conflicto de git (línea ${linea})`);
    continue;
  }
  if (!abs.endsWith('.json')) continue;
  try {
    JSON.parse(texto);
  } catch (e) {
    problemas.push(`${rel}: no es JSON válido (${e.message})`);
  }
}

/* La base no puede quedarse vacía: si un script falló a la mitad, mejor no publicarla */
const base = join(RAIZ, 'scripts', 'merged-admin.json');
if (existsSync(base) && !problemas.some((p) => p.startsWith('scripts/merged-admin.json'))) {
  const db = JSON.parse(readFileSync(base, 'utf8'));
  const cats = Object.keys(db).length;
  const prods = Object.values(db).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  if (cats < 5 || prods < 100) problemas.push(`scripts/merged-admin.json: se quedó en ${cats} categorías y ${prods} productos`);
  else console.log(`merged-admin.json: ${cats} categorías, ${prods} productos`);
}

if (problemas.length) {
  console.error('\nDatos que no se deben confirmar:');
  for (const p of problemas) console.error('  ✗ ' + p);
  console.error('\nArregla el archivo (o descarta la corrida) antes de hacer commit.');
  process.exit(1);
}

console.log(`✓ ${archivos.length} archivos de datos sin marcas de conflicto y con formato válido`);
