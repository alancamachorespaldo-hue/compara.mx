#!/usr/bin/env node
/**
 * ml-search.js — Busca productos nuevos en ML por categoría/keyword
 * y muestra los que NO están ya en el catálogo de comparalo.mx
 *
 * Uso: node scripts/ml-search.js --q="bicicleta electrica" [--limit=20]
 *      node scripts/ml-search.js --categoria=MLM1276 [--limit=20]
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

const ROOT  = resolve(import.meta.dirname, '..');
const QUERY = process.argv.find(a => a.startsWith('--q='))?.split('=').slice(1).join('=') ?? '';
const CAT   = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? '';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '20');

// Categorías ML México más usadas
const ML_CATEGORIES = {
  'bicis-electricas':  'MLM1276',   // Bicicletas eléctricas
  'laptops':           'MLM1648',   // Laptops y accesorios
  'freidoras':         'MLM5726',   // Freidoras de aire
  'microondas':        'MLM1580',   // Microondas
  'suplementos':       'MLM1296',   // Suplementos deportivos
};

async function getToken() {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

// Recopilar todos los IDs MLM que ya están en el catálogo
function getExistingIds() {
  const files = [
    'bicis/index.html',
    'suplementos/index.html',
    'suplementos/magnesio/index.html',
    'laptops/index.html',
    'electrodomesticos/freidoras/index.html',
    'electrodomesticos/microondas/index.html',
    'celulares/index.html',
    'celulares/android/index.html',
    'celulares/iphone/index.html',
  ];
  const ids = new Set();
  for (const f of files) {
    try {
      const html = readFileSync(resolve(ROOT, f), 'utf8');
      const matches = html.match(/MLM\d+/g) ?? [];
      matches.forEach(id => ids.add(id));
    } catch {}
  }
  return ids;
}

async function search(token) {
  const params = new URLSearchParams({ limit: String(LIMIT), site_id: 'MLM' });
  if (QUERY)  params.set('q', QUERY);
  if (CAT)    params.set('category', ML_CATEGORIES[CAT] ?? CAT);

  const url = `https://api.mercadolibre.com/sites/MLM/search?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Search error ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  if (!QUERY && !CAT) {
    console.log('Uso:');
    console.log('  node scripts/ml-search.js --q="bicicleta electrica plegable"');
    console.log('  node scripts/ml-search.js --categoria=bicis-electricas');
    console.log('\nCategorías disponibles:', Object.keys(ML_CATEGORIES).join(', '));
    process.exit(0);
  }

  console.log(`\n🔍 Buscando en ML: "${QUERY || CAT}" (límite: ${LIMIT})\n`);

  const token = await getToken();
  console.log('🔑 Token obtenido\n');

  const existingIds = getExistingIds();
  console.log(`📦 IDs ya en catálogo: ${existingIds.size}\n`);

  const data = await search(token);
  const results = data.results ?? [];

  console.log(`📋 ${results.length} resultados de ML\n`);
  console.log('─'.repeat(80));

  let nuevos = 0;
  for (const item of results) {
    const isNew = !existingIds.has(item.id);
    const tag = isNew ? '🆕 NUEVO' : '  ya en catálogo';
    const precio = `$${item.price.toLocaleString('es-MX')} MXN`;
    const stars = item.reviews?.rating_average ? `⭐${item.reviews.rating_average}` : '';
    const sold = item.sold_quantity ? `${item.sold_quantity} vendidos` : '';

    console.log(`${tag} | ${item.id} | ${precio} | ${stars} ${sold}`);
    console.log(`        ${item.title.substring(0, 70)}`);
    console.log(`        ${item.permalink}`);
    console.log();

    if (isNew) nuevos++;
  }

  console.log('─'.repeat(80));
  console.log(`\n✅ ${nuevos} productos nuevos encontrados (no están en el catálogo)\n`);
})();
