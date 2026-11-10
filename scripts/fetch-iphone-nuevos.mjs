/**
 * fetch-iphone-nuevos.mjs
 * Descubre, desde la API de ML, qué es cada mlId de catálogo que Alan pasó:
 * nombre, talla de almacenamiento, specs (chip, pantalla, cámara, color, RAM),
 * imagen, precio, estrellas y reseñas. Empareja cada mlId con su enlace de
 * afiliado (meli.la) ya conocido.
 *
 * NO toca merged-admin.json ni la página: solo genera un reporte para revisar
 * qué modelo/talla es cada ID antes de cablearlos (así no adivinamos nada).
 *
 * Uso:
 *   node scripts/fetch-iphone-nuevos.mjs
 *   → escribe scripts/iphone-nuevos-report.json e imprime una tabla.
 *
 * Requiere ML_CLIENT_ID / ML_CLIENT_SECRET / (ML_REFRESH_TOKEN) en .env
 * (hoy viven en los secrets de GitHub; para correr local hay que ponerlos
 *  en .env o generar el refresh con `node scripts/ml-oauth.js`).
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '..');
const API   = 'https://api.mercadolibre.com';
const CONC  = 4;

// ── Los 26 IDs de catálogo + su enlace de afiliado, tal como los pasó Alan ────
const ENTRADAS = [
  { mlId: 'MLM1027172667', linkML: 'https://meli.la/1f9Hodi' },
  { mlId: 'MLM27172667',   linkML: 'https://meli.la/2usLB7N' },
  { mlId: 'MLM2027172669', linkML: 'https://meli.la/31CV8nv' },
  { mlId: 'MLM40287808',   linkML: 'https://meli.la/1THU9GK' },
  { mlId: 'MLM1040287802', linkML: 'https://meli.la/2bfbC1d' },
  { mlId: 'MLM1046217031', linkML: 'https://meli.la/232u2Wf' },
  { mlId: 'MLM46217553',   linkML: 'https://meli.la/1YjuqqM' },
  { mlId: 'MLM1054107040', linkML: 'https://meli.la/2jgKjdz' },
  { mlId: 'MLM54107044',   linkML: 'https://meli.la/1boaVdH' },
  { mlId: 'MLM1054107045', linkML: 'https://meli.la/1tTG1bf' },
  { mlId: 'MLM1054106837', linkML: 'https://meli.la/2zqDZQt' },
  { mlId: 'MLM1054106842', linkML: 'https://meli.la/1wmxv6T' },
  { mlId: 'MLM1055308605', linkML: 'https://meli.la/11nLWYk' },
  { mlId: 'MLM1077719859', linkML: 'https://meli.la/1rtkPHj' },
  { mlId: 'MLM77712569',   linkML: 'https://meli.la/1TLmVyc' },
  { mlId: 'MLM1077712590', linkML: 'https://meli.la/2cyRjrt' },
  { mlId: 'MLM1077872017', linkML: 'https://meli.la/2Fj8xni' },
  { mlId: 'MLM1077855485', linkML: 'https://meli.la/32hT6yZ' },
  { mlId: 'MLM77871560',   linkML: 'https://meli.la/2VP2HBb' },
  { mlId: 'MLM1077855529', linkML: 'https://meli.la/2g95xLC' },
  { mlId: 'MLM54107093',   linkML: 'https://meli.la/2oX2CcE' },
  { mlId: 'MLM1077712479', linkML: 'https://meli.la/2aK18T2' },
  { mlId: 'MLM1066131408', linkML: 'https://meli.la/2G2hf6D' },
  { mlId: 'MLM66131407',   linkML: 'https://meli.la/1a9v1H1' },
  { mlId: 'MLM1066131405', linkML: 'https://meli.la/1LPqNrp' },
  { mlId: 'MLM1055308649', linkML: 'https://meli.la/2SMr7gK' },
];

// ── Credenciales ──────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID / ML_CLIENT_SECRET en .env.');
  console.error('   Ponelos en .env (están en los secrets de GitHub) o corré `node scripts/ml-oauth.js`.');
  process.exit(1);
}

async function getToken() {
  if (REFRESH_TOKEN) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN }),
    });
    if (r.ok) { console.log('🔑 Token OAuth OK\n'); return (await r.json()).access_token; }
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  console.log('🔑 Token client_credentials OK\n');
  return (await r.json()).access_token;
}

let TOKEN = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + path, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1000 * 2 ** i); continue; }
      return { _error: r.status };
    } catch { await sleep(800 * (i + 1)); }
  }
  return { _error: 'timeout' };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// Atributos de celular que nos interesan (IDs reales del catálogo ML, en mayúsculas)
const ATTR_KEYS = {
  BRAND: 'marca',
  LINE: 'linea',
  MODEL: 'modelo',
  INTERNAL_MEMORY: 'almacenamiento',   // "128 GB"
  RAM: 'ram',                          // "6 GB"
  COLOR: 'color',
  MAIN_REAR_CAMERA_RESOLUTION: 'camMP', // "48 Mpx"
  PROCESSOR_MODEL: 'chip',
  DISPLAY_SIZE: 'pantalla',            // "6.1 \""
  DETAILED_MODEL: 'modeloDetallado',
};

function extractAttr(attributes) {
  const out = {}, raw = {};
  if (!Array.isArray(attributes)) return { out, raw };
  for (const a of attributes) {
    const id = (a.id || '').toUpperCase();
    const val = a.value_name || a.values?.[0]?.name || '';
    if (val) raw[id] = val;
    const dest = ATTR_KEYS[id];
    if (dest && val) out[dest] = val;
  }
  return { out, raw };
}

function listedPrice(results) {
  if (!results?.length) return null;
  const prices = results.filter(i => i.price > 0 && (i.available_quantity == null || i.available_quantity > 0)).map(i => i.price);
  return prices.length ? Math.min(...prices) : null;
}

async function fetchOne({ mlId, linkML }) {
  const [prod, items] = await Promise.all([
    apiFetch(`/products/${mlId}`),
    apiFetch(`/products/${mlId}/items?limit=20`),
  ]);
  if (!prod || prod._error) return { mlId, linkML, _error: prod?._error ?? 'sin datos' };

  const { out: attrs, raw } = extractAttr(prod.attributes);
  const img = prod.pictures?.[0]?.secure_url || prod.pictures?.[0]?.url || prod.thumbnail || '';
  return {
    mlId,
    linkML,
    nombre: prod.name || prod.title || '',
    marca: attrs.marca || prod.brand || '',
    almacenamiento: attrs.almacenamiento ?? null,
    ram: attrs.ram ?? null,
    color: attrs.color ?? null,
    chip: attrs.chip ?? null,
    pantalla: attrs.pantalla ?? null,
    camMP: attrs.camMP ?? null,
    precioML: listedPrice(items?.results),
    estrellas: prod.reviews_rating_average != null ? Math.round(prod.reviews_rating_average * 10) / 10 : null,
    resenas: prod.reviews_count ?? null,
    img,
    _attrsRaw: raw,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
TOKEN = await getToken();
console.log(`📱 Consultando ${ENTRADAS.length} IDs de iPhone en la API de ML...\n`);

const results = await pool(ENTRADAS, CONC, async (e, i) => {
  const d = await fetchOne(e);
  if (d._error) {
    console.log(`  ⚠  [${String(i + 1).padStart(2)}] ${e.mlId.padEnd(16)} — ${d._error}`);
    return d;
  }
  console.log(
    `  [${String(i + 1).padStart(2)}] ${d.mlId.padEnd(16)} ` +
    `${(d.almacenamiento || '—').padEnd(8)} ` +
    `$${d.precioML?.toLocaleString('es-MX') ?? '—'}`.padEnd(11) + ' ' +
    `${d.estrellas != null ? '★' + d.estrellas : '—'}`.padEnd(6) +
    `img:${d.img ? '✓' : '✗'}  ${(d.nombre || '').substring(0, 46)}`
  );
  return d;
});

const reportPath = resolve(ROOT, 'scripts/iphone-nuevos-report.json');
writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📊 Reporte guardado en scripts/iphone-nuevos-report.json`);
console.log('   Revisá qué modelo/talla es cada ID antes de cablearlos a la página.');
