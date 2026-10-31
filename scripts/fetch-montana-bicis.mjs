#!/usr/bin/env node
/**
 * Fetches ML catalog product data for mountain bike MLM IDs
 * Usage: node scripts/fetch-montana-bicis.mjs
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.mercadolibre.com';

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

async function getToken() {
  const refreshToken = process.env.ML_REFRESH_TOKEN;
  if (refreshToken) {
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken }),
    });
    if (res.ok) { const d = await res.json(); console.log('🔑 Token OK\n'); return d.access_token; }
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

const MONTANA_BICIS = [
  { mlId: 'MLM46070719', linkML: 'https://meli.la/1DLv1v4' },
  { mlId: 'MLM46070718', linkML: 'https://meli.la/2tDjgA5' },
  { mlId: 'MLM41534921', linkML: 'https://meli.la/2vwDsES' },
  { mlId: 'MLM54104134', linkML: 'https://meli.la/2kW2Pvn' },
  { mlId: 'MLM53277742', linkML: 'https://meli.la/1NX6xMM' },
  { mlId: 'MLM46688555', linkML: 'https://meli.la/2JhMu8g' },
  { mlId: 'MLM47063986', linkML: 'https://meli.la/1z195hd' },
  { mlId: 'MLM36510187', linkML: 'https://meli.la/1fBhjVs' },
  { mlId: 'MLM54104132', linkML: 'https://meli.la/2HmAC3B' },
  { mlId: 'MLM80174258', linkML: 'https://meli.la/1YfkUoA' },
  { mlId: 'MLM35186457', linkML: 'https://meli.la/2HfaRso' },
  { mlId: 'MLM46070720', linkML: 'https://meli.la/13eRQNK' },
  { mlId: 'MLM41507382', linkML: 'https://meli.la/1rPCU7T' },
  { mlId: 'MLM44075899', linkML: 'https://meli.la/1ibUmcH' },
  { mlId: 'MLM38092519', linkML: 'https://meli.la/2jyzTcR' },
  { mlId: 'MLM19628090', linkML: 'https://meli.la/1FPzfAa' },
  { mlId: 'MLM23140215', linkML: 'https://meli.la/1BfmZiL' },
  { mlId: 'MLM4706398',  linkML: 'https://meli.la/1z195hd' },
  { mlId: 'MLM23986376', linkML: 'https://meli.la/1pab5Nt' },
  { mlId: 'MLM23241278', linkML: 'https://meli.la/1LGSjQR' },
  { mlId: 'MLM67564234', linkML: 'https://meli.la/11tbsfo' },
  { mlId: 'MLM68065505', linkML: 'https://meli.la/1mZxWUK' },
  { mlId: 'MLM36499917', linkML: 'https://meli.la/2dttyWs' },
  { mlId: 'MLM75744756', linkML: 'https://meli.la/1CYqFzo' },
  { mlId: 'MLM26811150', linkML: 'https://meli.la/2KKZNgU' },
  { mlId: 'MLM47064081', linkML: 'https://meli.la/2L2JwTt' },
  { mlId: 'MLM39312277', linkML: 'https://meli.la/2Nu3SVW' },
  { mlId: 'MLM63605019', linkML: 'https://meli.la/2SmLm3P' },
  { mlId: 'MLM25800531', linkML: 'https://meli.la/1FyFgBK' },
  { mlId: 'MLM65113408', linkML: 'https://meli.la/1G88582' },
  { mlId: 'MLM54838981', linkML: 'https://meli.la/2GUCY48' },
  { mlId: 'MLM63755146', linkML: 'https://meli.la/1nPBBLX' },
  { mlId: 'MLM21027397', linkML: 'https://meli.la/2kce3hz' },
  { mlId: 'MLM65357379', linkML: 'https://meli.la/2ehki6w' },
  { mlId: 'MLM26811149', linkML: 'https://meli.la/2o2opd7' },
  { mlId: 'MLM63604812', linkML: 'https://meli.la/2ukUMWQ' },
  { mlId: 'MLM63545513', linkML: 'https://meli.la/2x6cC66' },
  { mlId: 'MLM54498400', linkML: 'https://meli.la/2tPt7YZ' },
  { mlId: 'MLM38093414', linkML: 'https://meli.la/2Ki3bMR' },
  { mlId: 'MLM38296020', linkML: 'https://meli.la/2aUzURQ' },
  { mlId: 'MLM41510131', linkML: 'https://meli.la/2gu1S1b' },
  { mlId: 'MLM72078278', linkML: 'https://meli.la/24tiVFP' },
  { mlId: 'MLM23518169', linkML: 'https://meli.la/2rDBKWt' },
];

const token = await getToken();
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const { mlId, linkML } of MONTANA_BICIS) {
  const r = await fetch(`${API}/products/${mlId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.warn(`  ⚠ ${mlId} → HTTP ${r.status}`);
    results.push({ mlId, linkML, error: r.status });
    await sleep(500);
    continue;
  }
  const d = await r.json();
  const attr = (id) => (d.attributes || []).find(a => a.id === id)?.value_name ?? null;
  const attrN = (id) => {
    const v = (d.attributes || []).find(a => a.id === id)?.value_name;
    return v ? Number(v) : null;
  };
  const pic = (d.pictures || [])[0]?.url ?? null;
  const precio = d.buy_box_winner?.price ?? null;

  const item = {
    mlId,
    linkML,
    nombre:   d.name ?? null,
    marca:    attr('BRAND'),
    precioML: precio,
    imagen:   pic ? pic.replace(/-[A-Z]\.jpg$/, '-F.jpg').replace(/-[A-Z]\.webp$/, '-F.webp') : null,
    estrellas: null,
    resenas:   null,
    especs: {
      tipo:          'montaña',
      rodada:        attr('WHEEL_SIZE'),
      velocidades:   attr('NUMBER_OF_GEARS') || attr('GEARS'),
      suspension:    attr('SUSPENSION_TYPE'),
      frenos:        attr('BRAKE_TYPE'),
      peso:          attrN('ITEM_WEIGHT'),
      cargaMax:      attrN('MAXIMUM_LOAD_WEIGHT'),
      cambios:       attr('GEARSHIFT_TYPE'),
      cuadro:        attr('FRAME_MATERIAL'),
    },
  };
  const tag = precio ? `$${precio}` : 'sin precio';
  console.log(`  ✓ ${mlId} → ${item.nombre?.slice(0,55)} | ${tag}`);
  results.push(item);
  await sleep(300);
}

const outPath = resolve(__dirname, 'montana-fetch-result.json');
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\n✓ ${results.length} bicis escritas en ${outPath}`);
const ok = results.filter(r => !r.error).length;
const err = results.filter(r => r.error).length;
console.log(`  OK: ${ok}  Errores: ${err}`);
