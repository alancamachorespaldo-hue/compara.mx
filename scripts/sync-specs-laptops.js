#!/usr/bin/env node
/**
 * sync-specs-laptops.js — Extrae specs de laptops/index.html e inyecta en merged-admin.json
 * Uso: node scripts/sync-specs-laptops.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH  = resolve(ROOT, 'laptops/index.html');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');

// Extraer el array de productos del JS embebido en el HTML
const html = readFileSync(HTML_PATH, 'utf8');
const match = html.match(/const productos\s*=\s*(\[[\s\S]*?\n\];)/m);
if (!match) { console.error('❌ No se encontró const productos en laptops/index.html'); process.exit(1); }

// Evaluar el array (es JS válido con posibles \xNN)
let productos;
try {
  // eslint-disable-next-line no-eval
  productos = eval(match[1]);
} catch (e) {
  console.error('❌ Error al parsear productos:', e.message);
  process.exit(1);
}
console.log(`✓ ${productos.length} laptops encontradas en laptops/index.html`);

const adminData = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
const laptops = adminData.laptops ?? [];

let actualizados = 0;
let noEncontrados = 0;

for (const p of productos) {
  // Buscar por nombre exacto en merged-admin.json
  const admin = laptops.find(a => a.nombre === p.nombre);
  if (!admin) {
    console.log(`  ⚠ No en admin: ${p.nombre.substring(0, 60)}`);
    noEncontrados++;
    continue;
  }

  const especs = {
    procesador:     p.procesador     || null,
    ram:            p.ram != null    ? p.ram + ' GB'       : null,
    almacenamiento: p.almacenamiento != null ? p.almacenamiento + (p.ssd ? ' GB SSD' : ' GB HDD') : null,
    pantalla:       p.pantalla != null ? p.pantalla + '"'  : null,
    resolucion:     p.resolucion     || null,
    gpu:            p.gpu            || null,
    so:             p.os             || null,
    peso:           p.peso != null   ? p.peso + ' kg'      : null,
    touch:          p.touch != null  ? (p.touch ? 'Sí' : 'No') : null,
    gpuDedicada:    p.gpuDedicada != null ? (p.gpuDedicada ? 'Sí' : 'No') : null,
    vram:           p.vram != null   ? p.vram + ' GB'      : null,
    bateria:        p.duracionBateria != null ? p.duracionBateria + ' h' : null,
    uso:            p.uso?.length    ? p.uso.join(', ')     : null,
  };

  // Limpiar nulls
  for (const k of Object.keys(especs)) { if (especs[k] === null) delete especs[k]; }

  admin.especs = especs;

  // También sincronizar imagen, ratings, linkML si hay meli.la (más corto/mejor)
  if (p.img && !admin.imagen) admin.imagen = p.img;
  if (p.estrellas && !admin.estrellas) admin.estrellas = p.estrellas;
  if (p.resenas  && !admin.resenas)  admin.resenas  = p.resenas;

  actualizados++;
  const specsStr = [especs.procesador, especs.ram, especs.almacenamiento, especs.pantalla].filter(Boolean).join(' · ');
  console.log(`  ✅ ${p.nombre.substring(0, 55)}`);
  console.log(`     ${specsStr}`);
}

writeFileSync(ADMIN_PATH, JSON.stringify(adminData, null, 2), 'utf8');
console.log(`\n✨ ${actualizados} laptops actualizadas con specs`);
if (noEncontrados) console.log(`   ⚠ ${noEncontrados} no encontradas en merged-admin.json (pueden ser nuevas)`);
console.log('   Próximo paso: node scripts/generar-admin.js');
