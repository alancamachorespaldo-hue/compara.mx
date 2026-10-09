#!/usr/bin/env node
/**
 * extraer-artifact.js — Toma el HTML guardado del artifact y escribe su base de datos
 * en scripts/merged-admin.json, mostrando cuántos productos cambiaron.
 * Uso: node scripts/extraer-artifact.js <archivo.html> [--forzar]
 *
 * --forzar  Permite que haya productos eliminados (cuando se borró un producto
 *           intencionalmente desde el artifact). No bypasea ninguna otra validación:
 *           JSON inválido, categorías ausentes o estructura incorrecta siguen
 *           siendo errores fatales aunque se use --forzar.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --test-db=PATH permite apuntar a un merged-admin.json alternativo (solo para pruebas).
const testDbArg = process.argv.find(a => a.startsWith('--test-db='));
const ADMIN_PATH = testDbArg
  ? resolve(testDbArg.slice('--test-db='.length))
  : resolve(ROOT, 'scripts/merged-admin.json');

const FORZAR = process.argv.includes('--forzar');

const file = process.argv.find(a => !a.startsWith('--') && !a.endsWith('extraer-artifact.js') && a !== process.execPath);
if (!file || !existsSync(file)) {
  console.error('Uso: node scripts/extraer-artifact.js <archivo.html> [--forzar]');
  process.exit(1);
}

// ── 1. Leer HTML ─────────────────────────────────────────────────────────────
const html = readFileSync(file, 'utf8');

// ── 2. Extraer JSON ───────────────────────────────────────────────────────────
let db = null;
const jsonBlock = html.match(/<script type="application\/json" id="db">([\s\S]*?)<\/script>/);
if (jsonBlock) {
  try { db = JSON.parse(jsonBlock[1]); }
  catch (e) {
    console.error(`❌ JSON malformado en <script id="db">: ${e.message}`);
    process.exit(1);
  }
} else {
  const legacy = html.match(/atob\('([A-Za-z0-9+/=]+)'\)/);
  if (legacy) {
    try { db = JSON.parse(Buffer.from(legacy[1], 'base64').toString('utf8')); }
    catch (e) {
      console.error(`❌ JSON malformado en bloque base64 legado: ${e.message}`);
      process.exit(1);
    }
  }
}
if (db === null) {
  console.error('❌ No encontré los datos del artifact en ese archivo');
  process.exit(1);
}

// ── 3. Estructura mínima (no bypaseable por --forzar) ────────────────────────
if (typeof db !== 'object' || Array.isArray(db) || db === null) {
  console.error('❌ La base extraída no es un objeto JSON: se esperaba { categoria: [...] }');
  process.exit(1);
}
for (const [cat, list] of Object.entries(db)) {
  if (!Array.isArray(list)) {
    console.error(`❌ La categoría "${cat}" no es un array`);
    process.exit(1);
  }
}

// ── 4. Cargar base actual ─────────────────────────────────────────────────────
const prev = existsSync(ADMIN_PATH) ? JSON.parse(readFileSync(ADMIN_PATH, 'utf8')) : {};

// ── 5. Todas las categorías actuales deben estar en el artifact ──────────────
// (no bypaseable por --forzar: un artifact sin categorías legacy es siempre un error)
const missingCats = Object.keys(prev).filter(cat => !(cat in db));
if (missingCats.length > 0) {
  console.error('❌ El artifact no contiene estas categorías del archivo actual:');
  for (const cat of missingCats) {
    console.error(`   • ${cat} (${prev[cat].length} producto${prev[cat].length !== 1 ? 's' : ''})`);
  }
  console.error('\nDescarga el artifact actualizado (versión que contiene las 13 categorías) e intenta de nuevo.');
  console.error('No se escribió ningún cambio.');
  process.exit(1);
}

// ── 6. Conteo de cambios y detección de eliminaciones ───────────────────────
let total = 0, changed = 0, added = 0, removed = 0;
const reductions = [];

for (const [cat, list] of Object.entries(db)) {
  const before = new Map((prev[cat] || []).map(p => [String(p.id), JSON.stringify(p)]));
  for (const p of list) {
    total++;
    const b = before.get(String(p.id));
    if (b === undefined) added++;
    else if (b !== JSON.stringify(p)) changed++;
    before.delete(String(p.id));
  }
  if (before.size > 0) {
    removed += before.size;
    reductions.push({ cat, count: before.size, ids: [...before.keys()].slice(0, 5) });
  }
}

// ── 7. Bloquear eliminaciones inesperadas a menos que se pase --forzar ───────
if (removed > 0 && !FORZAR) {
  console.error(`❌ El artifact eliminaría ${removed} producto${removed !== 1 ? 's' : ''} de la base actual:`);
  for (const r of reductions) {
    const extra = r.count > 5 ? `… (+${r.count - 5} más)` : '';
    console.error(`   • ${r.cat}: ${r.count} — IDs: ${r.ids.join(', ')}${extra}`);
  }
  console.error('\nSi la eliminación es intencional (borraste el producto desde el artifact),');
  console.error('ejecuta de nuevo con --forzar.');
  console.error('No se escribió ningún cambio.');
  process.exit(1);
}

// ── 8. Escribir (todas las validaciones pasaron) ─────────────────────────────
writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
const resumen = `${total} productos · ${changed} modificados · ${added} nuevos · ${removed} eliminados`;
if (removed > 0) {
  console.log(`⚠  merged-admin.json: ${resumen} (eliminaciones autorizadas con --forzar)`);
} else {
  console.log(`✓  merged-admin.json: ${resumen}`);
}
