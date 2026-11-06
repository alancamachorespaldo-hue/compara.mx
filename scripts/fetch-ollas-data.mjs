#!/usr/bin/env node
/**
 * fetch-ollas-data.mjs
 * Obtiene nombre real, imagen, marca y características (capacidad, potencia, material, programable)
 * desde la API de Mercado Libre para los 45 productos de ollas.
 * Actualiza merged-admin.json y electrodomesticos/ollas/index.html
 *
 * Uso: node scripts/fetch-ollas-data.mjs [--dry-run]
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const API = 'https://api.mercadolibre.com';
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 3;

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

let TOKEN = null;

async function getToken() {
  const refreshToken = process.env.ML_REFRESH_TOKEN;
  if (refreshToken) {
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken }),
    });
    if (res.ok) { const d = await res.json(); console.log('🔑 Token OAuth OK\n'); return d.access_token; }
    console.warn('⚠ refresh_token falló — usando client_credentials');
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(API + path, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      await sleep(800 * (i + 1));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1200 * 2 ** i); continue; }
    console.warn(`  ⚠ ${path} → ${res.status}`);
    return null;
  }
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

function extractAttr(attributes, ids) {
  for (const id of ids) {
    const a = attributes.find(a => a.id === id);
    if (a?.value_name) return a.value_name;
    if (a?.values?.[0]?.name) return a.values[0].name;
  }
  return null;
}

function extractAttrNum(attributes, ids) {
  for (const id of ids) {
    const a = attributes.find(a => a.id === id);
    const v = a?.value_struct?.number ?? parseFloat(a?.value_name);
    if (!isNaN(v)) return v;
  }
  return null;
}

function isProgramable(attributes) {
  // Busca atributos relacionados con programación/timer
  const progIds = ['HAS_PROGRAMMABLE_TIMER', 'IS_PROGRAMMABLE', 'PROGRAMMABLE', 'HAS_CLOCK', 'DELAYED_START'];
  for (const id of progIds) {
    const a = attributes.find(a => a.id === id);
    if (a) {
      const v = (a.value_name || '').toLowerCase();
      if (v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1') return true;
      if (v === 'no' || v === 'false' || v === '0') return false;
    }
  }
  // Busca en el nombre si tiene "programable"
  return null;
}

// Limpiar URL de imagen para usar versión grande
function cleanImageUrl(url) {
  if (!url) return '';
  // Reemplaza sufijo de tamaño ML por versión grande (sin sufijo de dimensión)
  return url.replace(/-[A-Z]\.jpg/, '-O.jpg').replace(/-[A-Z]\.webp/, '-O.webp');
}

async function fetchProductData(mlId) {
  const data = await apiFetch(`/products/${mlId}`);
  if (!data) return null;

  const attrs = data.attributes || [];

  const nombre = data.name || null;
  // Imagen: primera foto disponible
  const imgRaw = data.pictures?.[0]?.url || data.thumbnail || null;
  const img = imgRaw ? cleanImageUrl(imgRaw) : '';

  // Marca
  const marca = extractAttr(attrs, ['BRAND']) ||
    data.domain_attributes?.find(a => a.id === 'BRAND')?.value_name || null;

  // Capacidad en litros
  const capacidadL = extractAttrNum(attrs, ['CAPACITY_LITERS', 'CAPACITY', 'BOWL_CAPACITY_LITERS', 'JAR_CAPACITY_LITERS', 'POT_CAPACITY_LITERS']) ||
    (() => {
      const a = attrs.find(a => a.id.includes('CAPACITY') && a.value_struct?.unit === 'L');
      return a?.value_struct?.number ?? null;
    })();

  // Potencia en watts
  const potenciaW = extractAttrNum(attrs, ['POWER_WATTAGE', 'WATTAGE', 'POWER_W', 'NOMINAL_POWER_WATTAGE']) ||
    (() => {
      const a = attrs.find(a => a.id.includes('POWER') && a.value_struct?.unit === 'W');
      return a?.value_struct?.number ?? null;
    })();

  // Material del inserto (bowl)
  const material = extractAttr(attrs, ['BOWL_MATERIAL', 'MATERIAL', 'INNER_BOWL_MATERIAL', 'INSERT_MATERIAL', 'BOWL_COATING']);

  // Programable
  const programable = isProgramable(attrs);

  return { nombre, img, marca, capacidadL, potenciaW, material, programable };
}

// ── Main ──────────────────────────────────────────────────────────────────────

TOKEN = await getToken();

const adminPath = resolve(ROOT, 'scripts/merged-admin.json');
const admin = JSON.parse(readFileSync(adminPath, 'utf8'));
const ollas = admin.ollas;

console.log(`📦 Fetching datos ML para ${ollas.length} ollas...\n`);

const results = await pool(ollas, CONCURRENCY, async (p, i) => {
  if (!p.mlId || !/^MLM\d/.test(p.mlId)) {
    console.log(`  [${i+1}] id:${p.id} sin mlId — skip`);
    return null;
  }
  const d = await fetchProductData(p.mlId);
  if (!d) {
    console.log(`  [${i+1}] id:${p.id} ${p.mlId} → ERROR`);
    return null;
  }
  console.log(`  [${i+1}] id:${p.id} ${p.mlId} → "${d.nombre?.substring(0,50)}" cap:${d.capacidadL}L pot:${d.potenciaW}W mat:${d.material} prog:${d.programable}`);
  return { id: p.id, ...d };
});

// Aplica resultados a merged-admin.json
let updated = 0;
for (const r of results) {
  if (!r) continue;
  const p = ollas.find(o => o.id === r.id);
  if (!p) continue;
  if (r.nombre && r.nombre !== `Olla de cocción lenta #${p.id}`) p.nombre = r.nombre;
  if (r.img) p.img = r.img;
  if (r.marca) p.marca = r.marca;
  if (r.capacidadL !== null && !isNaN(r.capacidadL)) p.capacidadL = r.capacidadL;
  if (r.potenciaW !== null && !isNaN(r.potenciaW)) p.potenciaW = r.potenciaW;
  if (r.material) p.material = r.material;
  if (r.programable !== null) p.programable = r.programable;
  updated++;
}

console.log(`\n✅ ${updated}/${ollas.length} productos actualizados`);

if (!DRY_RUN) {
  writeFileSync(adminPath, JSON.stringify(admin, null, 2), 'utf8');
  console.log('💾 merged-admin.json guardado');
} else {
  console.log('🔍 DRY-RUN: no se guardaron cambios');
}

// ── Parchear el HTML ───────────────────────────────────────────────────────────
const htmlPath = resolve(ROOT, 'electrodomesticos/ollas/index.html');
let html = readFileSync(htmlPath, 'utf8');

// Construir mapa de datos por id
const dataMap = new Map(results.filter(Boolean).map(r => [r.id, r]));

for (const [id, d] of dataMap) {
  const p = ollas.find(o => o.id === id);
  if (!p) continue;

  // Parchear nombre
  if (d.nombre && d.nombre !== `Olla de cocción lenta #${id}`) {
    // nombre: "Olla de cocción lenta #N"  →  nombre: "NOMBRE REAL"
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)nombre:\\s*)"[^"]*"`, 's'),
      `$1"${d.nombre.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    );
  }

  // Parchear img
  if (d.img) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)img:\\s*)"[^"]*"`, 's'),
      `$1"${d.img}"`
    );
  }

  // Parchear marca
  if (d.marca) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)marca:\\s*)null`, 's'),
      `$1"${d.marca.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    );
  }

  // Parchear capacidadL
  if (d.capacidadL !== null && !isNaN(d.capacidadL)) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)capacidadL:\\s*)null`, 's'),
      `$1${d.capacidadL}`
    );
  }

  // Parchear potenciaW
  if (d.potenciaW !== null && !isNaN(d.potenciaW)) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)potenciaW:\\s*)null`, 's'),
      `$1${d.potenciaW}`
    );
  }

  // Parchear material
  if (d.material) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)material:\\s*)null`, 's'),
      `$1"${d.material.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    );
  }

  // Parchear programable
  if (d.programable !== null) {
    html = html.replace(
      new RegExp(`(id:\\s*${id}\\s*,(?:[^{}]*?)programable:\\s*)null`, 's'),
      `$1${d.programable}`
    );
  }
}

if (!DRY_RUN) {
  writeFileSync(htmlPath, html, 'utf8');
  console.log('💾 electrodomesticos/ollas/index.html actualizado');
}

console.log('\n🎉 Listo. Ahora corre: node scripts/generar-admin.js');
