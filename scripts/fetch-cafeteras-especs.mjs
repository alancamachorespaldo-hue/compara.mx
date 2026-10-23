/**
 * fetch-cafeteras-especs.mjs
 * Consulta la API de ML para obtener imagen y specs de cada cafetera.
 * Actualiza merged-admin.json y reconstruye electrodomesticos/cafeteras/index.html.
 *
 * Uso: node scripts/fetch-cafeteras-especs.mjs [--dry-run]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const API = 'https://api.mercadolibre.com';
const DRY = process.argv.includes('--dry-run');

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID / ML_CLIENT_SECRET en .env');
  process.exit(1);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function getToken() {
  const rt = process.env.ML_REFRESH_TOKEN;
  if (rt) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rt }),
    });
    if (r.ok) { const d = await r.json(); console.log('🔑 Token de usuario OK'); return d.access_token; }
    console.warn('⚠ refresh_token falló — usando client_credentials');
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  return (await r.json()).access_token;
}

let TOKEN;
async function apiFetch(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1000 * 2 ** i); continue; }
      return null;
    } catch { await sleep(600 * (i + 1)); }
  }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Atributos que nos interesan ───────────────────────────────────────────────
const ATTR_MAP = {
  COFFEE_MAKER_TYPES:    'tipo',
  PRESSURE:              'presion',
  WATER_CAPACITY:        'capacidad',
  WITH_VAPOUR_EMISSION:  'vaporizador',
  POWER:                 'potencia',
  COMPATIBLE_CAPSULES:   'compatible',
  // fallbacks con IDs alternativos
  TYPE_OF_COFFEE_MAKER:  'tipo',
  EXTRACTION_PRESSURE:   'presion',
  CAPACITY_VOLUME:       'capacidad',
  WATER_TANK_CAPACITY:   'deposito',
  INCLUDES_MILK_FROTHER: 'vaporizador',
  COMPATIBLE_WITH:       'compatible',
};

// Mapeo de valores ML → español legible
const BOOL_MAP = { 'Sí': 'Sí', 'No': 'No', 'Yes': 'Sí', 'Si': 'Sí' };

function extractAttrs(attributes = []) {
  const out = {};
  for (const a of attributes) {
    const field = ATTR_MAP[a.id];
    if (field && !out[field]) {
      let val = a.value_name || '';
      if (BOOL_MAP[val]) val = BOOL_MAP[val];
      out[field] = val;
    }
    // Molinillo: inferir desde ACCESSORIES_INCLUDED
    if (a.id === 'ACCESSORIES_INCLUDED' && !out['molinillo']) {
      const acc = (a.value_name || '').toLowerCase();
      out['molinillo'] = (acc.includes('molinillo') || acc.includes('moledor')) ? 'Sí' : 'No';
    }
    // Vaporizador adicional: WITH_STEAM_NOZZLE
    if (a.id === 'WITH_STEAM_NOZZLE' && !out['vaporizador']) {
      out['vaporizador'] = BOOL_MAP[a.value_name] || a.value_name;
    }
  }
  return out;
}

// Convierte URL de imagen ML a tamaño más grande (sustituye -O.jpg o similar)
function bestImg(url) {
  if (!url) return null;
  // ML images: ends in -{size}.jpg — swap to 400x400
  return url.replace(/-[A-Z]\.jpg(\?.*)?$/, '-O.jpg').replace(/^http:/, 'https:');
}

// ── Fetch datos de un producto ────────────────────────────────────────────────
async function fetchData(mlId) {
  // 1. Catálogo: /products/{mlId} — imagen de catálogo y attrs
  const cat = await apiFetch(`/products/${mlId}`);
  let img = null;
  const attrs = {};

  if (cat) {
    // Imagen de mayor resolución del catálogo
    const pics = cat.pictures || [];
    if (pics.length) img = bestImg(pics[0].secure_url || pics[0].url);
    // Specs
    Object.assign(attrs, extractAttrs(cat.attributes || []));
  }

  // 2. Items: /products/{mlId}/items?limit=5 — imagen real de la publicación
  const items = await apiFetch(`/products/${mlId}/items?limit=5`);
  if (items?.results?.length) {
    // Preferir ítem con fulfillment
    const sorted = [...items.results].sort((a, b) =>
      (a.shipping?.logistic_type === 'fulfillment' ? 0 : 1) -
      (b.shipping?.logistic_type === 'fulfillment' ? 0 : 1)
    );
    const best = sorted[0];
    // Imagen del ítem (mayor res que thumbnail)
    const ipics = best.pictures || [];
    if (ipics.length) {
      const itemImg = bestImg(ipics[0].secure_url || ipics[0].url);
      if (itemImg) img = itemImg; // preferir img del ítem sobre la del catálogo
    } else if (best.thumbnail) {
      img = best.thumbnail.replace(/^http:/, 'https:').replace(/-I\.jpg/, '-O.jpg');
    }
    // Attrs del ítem (complementan los del catálogo)
    const iAttrs = extractAttrs(best.attributes || []);
    for (const [k, v] of Object.entries(iAttrs)) {
      if (!attrs[k]) attrs[k] = v;
    }
  }

  return { img, attrs };
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  TOKEN = await getToken();
  console.log('');

  const adminPath = resolve(ROOT, 'scripts/merged-admin.json');
  const data = JSON.parse(readFileSync(adminPath, 'utf8'));
  const cafeteras = data.cafeteras;

  let updated = 0;
  for (let i = 0; i < cafeteras.length; i++) {
    const p = cafeteras[i];
    if (!p.mlId || !/^MLM\d{6,12}$/.test(p.mlId)) {
      console.log(`  ⏭  [${p.id}] sin mlId, omitido`);
      continue;
    }

    const { img, attrs } = await fetchData(p.mlId);

    let changed = false;
    if (img && !p.imagen) { p.imagen = img; changed = true; }
    for (const [field, val] of Object.entries(attrs)) {
      if (val && !p.especs[field]) { p.especs[field] = val; changed = true; }
    }
    if (changed) updated++;

    const flags = [img ? '📷' : '  ', Object.keys(attrs).length ? '📋' : '  '].join('');
    console.log(`  ${flags} [${p.mlId}] ${p.nombre?.slice(0, 50) || '?'}`);

    if (i % 5 === 4) await sleep(300);
  }

  console.log(`\n✅ ${updated}/${cafeteras.length} cafeteras actualizadas`);

  if (DRY) {
    console.log('(dry-run — no se escribió nada)');
    return;
  }

  writeFileSync(adminPath, JSON.stringify(data, null, 2));
  console.log('✅ merged-admin.json guardado');

  // ── Reconstruir el HTML ───────────────────────────────────────────────────
  const htmlPath = resolve(ROOT, 'electrodomesticos/cafeteras/index.html');
  let html = readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');

  const activeCafeteras = cafeteras.filter(p => p.activo !== false);

  // Reemplazar const productos = [...]
  const arrayRe = /(const productos\s*=\s*)\[[\s\S]*?\](\s*;)/;
  if (!arrayRe.test(html)) {
    console.error('❌ No se encontró "const productos = [...]" en el HTML');
    process.exit(1);
  }
  html = html.replace(arrayRe, (_, pre, post) => pre + JSON.stringify(activeCafeteras, null, 2) + post);

  // Actualizar JSON-LD ItemList
  const jldRe = /("@type":\s*"ItemList"[\s\S]*?"itemListElement":\s*\[)([\s\S]*?)(\])/;
  const newItems = activeCafeteras.map((p, i) =>
    `\n        { "@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(p.nombre)} }`
  ).join(',');
  html = html.replace(jldRe, (_, pre, _old, post) => pre + newItems + '\n      ' + post);

  writeFileSync(htmlPath, html);
  console.log(`✅ cafeteras/index.html reconstruido con ${activeCafeteras.length} productos`);
})();
