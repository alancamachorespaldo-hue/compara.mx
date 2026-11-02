#!/usr/bin/env node
/**
 * fetch-streaming.mjs — Obtiene datos de dispositivos streaming desde el catálogo de ML.
 *
 *   node scripts/fetch-streaming.mjs
 *
 * Lee la lista hardcodeada de mlIds + linkML, consulta /products/{mlId},
 * extrae specs y guarda scripts/streaming-fetch-result.json listo para
 * pegarse en merged-admin.json bajo la clave "streaming".
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const API = 'https://api.mercadolibre.com';

// ── Lista de productos a buscar ──────────────────────────────────────────────
const ITEMS = [
  { mlId: 'MLM78712965',   linkML: 'https://meli.la/14mAHof' },
  { mlId: 'MLM78543309',   linkML: 'https://meli.la/1X2maGj' },
  { mlId: 'MLM74872790',   linkML: 'https://meli.la/2FB34ax' },
  { mlId: 'MLM70368801',   linkML: 'https://meli.la/1AoXxtD' },
  { mlId: 'MLM70170007',   linkML: 'https://meli.la/2CoqHr7' },
  { mlId: 'MLM69616538',   linkML: 'https://meli.la/2mLpCHs' },
  { mlId: 'MLM69328828',   linkML: 'https://meli.la/1o7inJg' },
  { mlId: 'MLM69121414',   linkML: 'https://meli.la/19L6GBZ' },
  { mlId: 'MLM68271138',   linkML: 'https://meli.la/1vdFoUx' },
  { mlId: 'MLM64203785',   linkML: 'https://meli.la/2Ds7PEW' },
  { mlId: 'MLM6304839',    linkML: 'https://meli.la/2wjdqK2' },
  { mlId: 'MLM61673543',   linkML: 'https://meli.la/17gsLhz' },
  { mlId: 'MLM61654517',   linkML: 'https://meli.la/1NEi5SM' },
  { mlId: 'MLM59121128',   linkML: 'https://meli.la/2Fobk4G' },
  { mlId: 'MLM56680191',   linkML: 'https://meli.la/1aX42uz' },
  { mlId: 'MLM56348232',   linkML: 'https://meli.la/1QaRWds' },
  { mlId: 'MLM54342433',   linkML: 'https://meli.la/1bStAeR' },
  { mlId: 'MLM54014512',   linkML: 'https://meli.la/2sTRcfN' },
  { mlId: 'MLM53300025',   linkML: 'https://meli.la/2sZuotp' },
  { mlId: 'MLM53162653',   linkML: 'https://meli.la/1vXEN4W' },
  { mlId: 'MLM52897968',   linkML: 'https://meli.la/1R69Kxw' },
  { mlId: 'MLM50849914',   linkML: 'https://meli.la/1oETC5n' },
  { mlId: 'MLM47354226',   linkML: 'https://meli.la/1YLV9u2' },
  { mlId: 'MLM47307231',   linkML: 'https://meli.la/19sVgda' },
  { mlId: 'MLM45424692',   linkML: 'https://meli.la/2suZNRv' },
  { mlId: 'MLM42615803',   linkML: 'https://meli.la/2DSmUkF' },
  { mlId: 'MLM42419435',   linkML: 'https://meli.la/1tBh2bL' },
  { mlId: 'MLM42248736',   linkML: 'https://meli.la/2vagDrh' },
  { mlId: 'MLM41947159',   linkML: 'https://meli.la/12T8JDt' },
  { mlId: 'MLM30068620',   linkML: 'https://meli.la/1D1quXg' },
  { mlId: 'MLM29268937',   linkML: 'https://meli.la/2xBQNfv' },
  { mlId: 'MLM24219631',   linkML: 'https://meli.la/1Mkzm24' },
  { mlId: 'MLM21459431',   linkML: 'https://meli.la/2rDK15c' },
  { mlId: 'MLM2124867366', linkML: 'https://meli.la/1AVA8CJ' },
  { mlId: 'MLM2108624374', linkML: 'https://meli.la/1z4Mj6R' },
  { mlId: 'MLM2108517006', linkML: 'https://meli.la/2WHdV8w' },
  { mlId: 'MLM2106976037', linkML: 'https://meli.la/1zm9vuY' },
  { mlId: 'MLM2106027939', linkML: 'https://meli.la/1qrpMEw' },
  { mlId: 'MLM2099185941', linkML: 'https://meli.la/1sUprys' },
  { mlId: 'MLM2097744257', linkML: 'https://meli.la/1V6Giie' },
  { mlId: 'MLM2079978966', linkML: 'https://meli.la/1woYCcb' },
  { mlId: 'MLM2070571240', linkML: 'https://meli.la/2ZBopJT' },
  { mlId: 'MLM2064292950', linkML: 'https://meli.la/1Yb8KCW' },
  { mlId: 'MLM2055300725', linkML: 'https://meli.la/1yhdTgD' },
  { mlId: 'MLM2039622790', linkML: 'https://meli.la/2fwwG2M' },
  { mlId: 'MLM2026483463', linkML: 'https://meli.la/2oFJwRS' },
  { mlId: 'MLM19682828',   linkML: 'https://meli.la/1ZYmnq4' },
  { mlId: 'MLM18593745',   linkML: 'https://meli.la/1pcefoy' },
];

// ── Auth ─────────────────────────────────────────────────────────────────────
let TOKEN;
async function getToken() {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: process.env.ML_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`Token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(path) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1000 * 2 ** i)); continue; }
    console.warn(`  ✗ ${path} → ${r.status}`);
    return null;
  }
  return null;
}

// ── Extraer specs ─────────────────────────────────────────────────────────────
function extractSpecs(prod) {
  const attrs = Object.fromEntries((prod.attributes || []).map(x => [x.id, x.value_name ?? x.values?.[0]?.name ?? null]));
  const val = (...keys) => { for (const k of keys) if (attrs[k]) return attrs[k]; return null; };
  const especs = {};

  const almac = val('STORAGE_CAPACITY', 'INTERNAL_MEMORY');
  if (almac) especs.almacenamiento = almac;

  const res = val('MAX_VIDEO_RESOLUTION', 'COMPATIBLE_VIDEO_RESOLUTIONS');
  if (res) especs.resolucion = res;

  const formato = val('DEVICE_FORMAT', 'PRODUCT_TYPE');
  if (formato) especs.formato = formato;

  const apps = val('COMPATIBLE_APPS');
  if (apps) especs.apps = apps;

  const asistente = val('INTEGRATED_VOICE_ASSISTANTS', 'VOICE_ASSISTANT');
  if (asistente) especs.asistente = asistente;

  const so = val('OPERATING_SYSTEM_NAME', 'OPERATING_SYSTEM');
  if (so) especs.so = so;

  // HDMI, WiFi como extras útiles
  const hdmi = val('HDMI_VERSION');
  if (hdmi) especs.hdmi = hdmi;

  const wifi = val('WIFI_CONNECTIVITY', 'WIFI_STANDARD');
  if (wifi) especs.wifi = wifi;

  return especs;
}

// ── Main ──────────────────────────────────────────────────────────────────────
TOKEN = await getToken();
console.log('✓ Token obtenido\n');

const results = [];
const failed = [];
let idx = 1;

for (const { mlId, linkML } of ITEMS) {
  process.stdout.write(`[${String(idx).padStart(2)}/${ITEMS.length}] ${mlId} … `);
  const prod = await api(`/products/${mlId}`);
  if (!prod) {
    console.log('✗ sin datos');
    failed.push(mlId);
    idx++;
    continue;
  }

  const marca = prod.attributes?.find(a => a.id === 'BRAND')?.value_name
    ?? prod.name?.split(' ')[0]
    ?? '';

  const especs = extractSpecs(prod);
  const imagen = prod.pictures?.[0]?.url ?? prod.thumbnail ?? '';

  const entry = {
    id: `streaming-${idx}`,
    nombre: prod.name ?? '',
    marca,
    imagen,
    precioML: null,
    precioAmz: null,
    linkML,
    linkAmz: null,
    mlId,
    activo: false,
    especs,
  };

  console.log(`✓ ${entry.nombre.slice(0, 60)}`);
  results.push(entry);
  idx++;
}

const outPath = resolve(import.meta.dirname, 'streaming-fetch-result.json');
writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

console.log(`\n✓ ${results.length} productos guardados en scripts/streaming-fetch-result.json`);
if (failed.length) console.log(`✗ ${failed.length} fallaron: ${failed.join(', ')}`);
console.log('\nRevisa el resultado y luego ejecuta:\n  node scripts/apply-streaming.mjs');
