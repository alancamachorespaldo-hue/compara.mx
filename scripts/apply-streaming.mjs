#!/usr/bin/env node
/**
 * apply-streaming.mjs — Agrega los productos de streaming-fetch-result.json
 * a merged-admin.json bajo la clave "streaming".
 *
 * Uso: node scripts/apply-streaming.mjs [--aplicar]
 *   Sin --aplicar: sólo muestra lo que haría (vista previa).
 *   Con --aplicar: escribe en merged-admin.json.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const RESULT = resolve(ROOT, 'scripts/streaming-fetch-result.json');
const APPLY = process.argv.includes('--aplicar');

const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
const productos = JSON.parse(readFileSync(RESULT, 'utf8'));

if (!Array.isArray(db.streaming)) {
  db.streaming = [];
  console.log('→ Clave "streaming" creada en merged-admin.json');
}

const existingIds = new Set(db.streaming.map(p => p.mlId));
const nuevos = productos.filter(p => !existingIds.has(p.mlId));

console.log(`\nProductos en resultado:  ${productos.length}`);
console.log(`Ya en merged-admin:      ${existingIds.size}`);
console.log(`Nuevos a agregar:        ${nuevos.length}\n`);

for (const p of nuevos) {
  console.log(`  + ${p.id.padEnd(14)} ${p.nombre.slice(0, 60)}`);
  if (Object.keys(p.especs).length) {
    const specs = Object.entries(p.especs).map(([k,v]) => `${k}: ${v}`).join(' · ');
    console.log(`    specs: ${specs.slice(0, 100)}`);
  }
}

if (!APPLY) {
  console.log('\n(vista previa — agrega --aplicar para guardar)');
  process.exit(0);
}

db.streaming.push(...nuevos);
writeFileSync(ADMIN, JSON.stringify(db, null, 2), 'utf8');
console.log(`\n✓ ${nuevos.length} productos agregados a merged-admin.json`);
console.log('  Siguiente paso: abre el admin local → categoría "Streaming" → revisa y activa productos.');
