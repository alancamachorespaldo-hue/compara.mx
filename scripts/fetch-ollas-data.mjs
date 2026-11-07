#!/usr/bin/env node
/**
 * fetch-ollas-data.mjs
 * Obtiene datos de producto desde ML API para los 45 productos de ollas.
 * Campos: nombre, img, marca, capacidadL, potenciaW, material, programable,
 *         mantenerCaliente, displayDigital, tapaMaterial, color
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

function attr(attributes, ids) {
  for (const id of ids) {
    const a = attributes.find(a => a.id === id);
    if (a?.value_name) return a.value_name;
    if (a?.values?.[0]?.name) return a.values[0].name;
  }
  return null;
}

// Parsea número desde "4.7 L", "210 W", "4.732 L" etc.
function parseNum(str) {
  if (!str) return null;
  const m = String(str).match(/[\d]+\.?[\d]*/);
  return m ? parseFloat(m[0]) : null;
}

// Parsea Sí/No/Yes/No → true/false/null
function parseBool(str) {
  if (!str) return null;
  const v = str.toLowerCase().trim();
  if (v === 'sí' || v === 'si' || v === 'yes') return true;
  if (v === 'no' || v === 'false') return false;
  return null;
}

// Limpia material: queda solo el primer material y se capitaliza
function cleanMaterial(str) {
  if (!str) return null;
  // Toma el primer material antes de coma, paréntesis o punto y coma
  const first = str.split(/[,;(]/)[0].trim();
  // Capitaliza primera letra
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Limpiar URL de imagen para versión grande
function cleanImageUrl(url) {
  if (!url) return '';
  return url.replace(/-[A-Z]\.jpg$/, '-O.jpg').replace(/-[A-Z]\.webp$/, '-O.webp');
}

async function fetchProductData(mlId) {
  const data = await apiFetch(`/products/${mlId}`);
  if (!data) return null;

  const attrs = data.attributes || [];

  const nombre = data.name || null;
  const imgRaw = data.pictures?.[0]?.url || data.thumbnail || null;
  const img = imgRaw ? cleanImageUrl(imgRaw) : '';
  const marca = attr(attrs, ['BRAND']) || null;

  // Capacidad: "4.7 L" → 4.7
  const capStr = attr(attrs, ['VOLUME_CAPACITY', 'CAPACITY_LITERS', 'JAR_CAPACITY_LITERS', 'BOWL_CAPACITY_LITERS']);
  const capacidadL = parseNum(capStr);

  // Potencia: "210 W" → 210
  const powStr = attr(attrs, ['POWER', 'POWER_WATTAGE', 'WATTAGE', 'NOMINAL_POWER_WATTAGE']);
  const potenciaW = parseNum(powStr);

  // Material del inserto (primer material)
  const matStr = attr(attrs, ['MATERIALS', 'BOWL_MATERIAL', 'MATERIAL', 'INNER_BOWL_MATERIAL', 'INSERT_MATERIAL']);
  const material = cleanMaterial(matStr);

  // Programable
  const progStr = attr(attrs, ['IS_PROGRAMMABLE', 'HAS_PROGRAMMABLE_TIMER', 'PROGRAMMABLE']);
  const programable = parseBool(progStr);

  // Mantener caliente
  const keepStr = attr(attrs, ['WITH_KEEP_WARM_FUNCTION', 'HAS_KEEP_WARM', 'KEEP_WARM']);
  const mantenerCaliente = parseBool(keepStr);

  // Display digital
  const dispStr = attr(attrs, ['WITH_DIGITAL_DISPLAY', 'HAS_DIGITAL_DISPLAY', 'DIGITAL_DISPLAY']);
  const displayDigital = parseBool(dispStr);

  // Tapa material
  const tapaStr = attr(attrs, ['LID_MATERIAL', 'COVER_MATERIAL']);
  const tapaMaterial = tapaStr ? (tapaStr.charAt(0).toUpperCase() + tapaStr.slice(1).toLowerCase()) : null;

  // Color
  const colorStr = attr(attrs, ['COLOR', 'MAIN_COLOR']);
  const color = colorStr ? (colorStr.charAt(0).toUpperCase() + colorStr.slice(1).toLowerCase()) : null;

  return { nombre, img, marca, capacidadL, potenciaW, material, programable, mantenerCaliente, displayDigital, tapaMaterial, color };
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
  console.log(`  [${i+1}] id:${p.id} ${p.mlId} | cap:${d.capacidadL}L pot:${d.potenciaW}W mat:${d.material} prog:${d.programable} keep:${d.mantenerCaliente} disp:${d.displayDigital}`);
  return { id: p.id, ...d };
});

// Aplica resultados a merged-admin.json
let updated = 0;
for (const r of results) {
  if (!r) continue;
  const p = ollas.find(o => o.id === r.id);
  if (!p) continue;
  if (r.nombre) p.nombre = r.nombre;
  if (r.img)    p.img = r.img;
  if (r.marca)  p.marca = r.marca;
  if (r.capacidadL !== null)    p.capacidadL = r.capacidadL;
  if (r.potenciaW !== null)     p.potenciaW = r.potenciaW;
  if (r.material)               p.material = r.material;
  if (r.programable !== null)   p.programable = r.programable;
  if (r.mantenerCaliente !== null) p.mantenerCaliente = r.mantenerCaliente;
  if (r.displayDigital !== null)   p.displayDigital = r.displayDigital;
  if (r.tapaMaterial)           p.tapaMaterial = r.tapaMaterial;
  if (r.color)                  p.color = r.color;
  // Asegurar que los nuevos campos existen aunque sean null
  if (!('mantenerCaliente' in p)) p.mantenerCaliente = null;
  if (!('displayDigital'   in p)) p.displayDigital   = null;
  if (!('tapaMaterial'     in p)) p.tapaMaterial     = null;
  if (!('color'            in p)) p.color            = null;
  updated++;
}

console.log(`\n✅ ${updated}/${ollas.length} productos actualizados`);

if (!DRY_RUN) {
  writeFileSync(adminPath, JSON.stringify(admin, null, 2), 'utf8');
  console.log('💾 merged-admin.json guardado');
}

// ── Parchear el HTML ───────────────────────────────────────────────────────────
const htmlPath = resolve(ROOT, 'electrodomesticos/ollas/index.html');
let html = readFileSync(htmlPath, 'utf8');

const dataMap = new Map(results.filter(Boolean).map(r => [r.id, r]));

// Helper: reemplaza un campo en el bloque del producto
function patchField(html, id, field, value) {
  const escaped = typeof value === 'string'
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : String(value);

  // Intenta reemplazar valor existente (null, true, false o string)
  const rx = new RegExp(
    `(id:\\s*${id}\\s*,(?:(?!id:\\s*\\d).)*?${field}:\\s*)(?:null|true|false|"[^"]*")`,
    's'
  );
  const replaced = html.replace(rx, `$1${escaped}`);
  if (replaced !== html) return replaced;

  // Si el campo no existe, insértalo después del campo anterior conocido
  // (insertar después de programable, o de material)
  const insertAfter = {
    mantenerCaliente: 'programable',
    displayDigital:   'mantenerCaliente',
    tapaMaterial:     'displayDigital',
    color:            'tapaMaterial',
  }[field];
  if (insertAfter) {
    const rx2 = new RegExp(
      `(id:\\s*${id}\\s*,(?:(?!id:\\s*\\d).)*?${insertAfter}:\\s*(?:null|true|false|"[^"]*"))`,
      's'
    );
    return html.replace(rx2, `$1, ${field}: ${escaped}`);
  }
  return html;
}

for (const [id, d] of dataMap) {
  if (d.nombre)              html = patchField(html, id, 'nombre',          d.nombre);
  if (d.img)                 html = patchField(html, id, 'img',             d.img);
  if (d.marca)               html = patchField(html, id, 'marca',           d.marca);
  if (d.capacidadL !== null) html = patchField(html, id, 'capacidadL',      d.capacidadL);
  if (d.potenciaW !== null)  html = patchField(html, id, 'potenciaW',       d.potenciaW);
  if (d.material)            html = patchField(html, id, 'material',        d.material);
  if (d.programable !== null) html = patchField(html, id, 'programable',    d.programable);
  if (d.mantenerCaliente !== null) html = patchField(html, id, 'mantenerCaliente', d.mantenerCaliente);
  if (d.displayDigital !== null)   html = patchField(html, id, 'displayDigital',   d.displayDigital);
  if (d.tapaMaterial)        html = patchField(html, id, 'tapaMaterial',    d.tapaMaterial);
  if (d.color)               html = patchField(html, id, 'color',           d.color);
}

if (!DRY_RUN) {
  writeFileSync(htmlPath, html, 'utf8');
  console.log('💾 electrodomesticos/ollas/index.html actualizado');
}

console.log('\n🎉 Listo. Ahora corre: node scripts/generar-admin.js');
