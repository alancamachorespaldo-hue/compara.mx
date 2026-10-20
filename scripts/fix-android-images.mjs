#!/usr/bin/env node
/**
 * fix-android-images.mjs — Refresca las imágenes rotas en celulares/android/index.html
 * Llama a /products/{mlId} en la API de ML para obtener la URL de imagen actual.
 *
 * Uso: node scripts/fix-android-images.mjs [--dry-run]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT        = resolve(import.meta.dirname, '..');
const HTML_FILE   = resolve(ROOT, 'celulares/android/index.html');
const ADMIN_FILE  = resolve(ROOT, 'scripts/merged-admin.json');
const API         = 'https://api.mercadolibre.com';
const DRY_RUN     = process.argv.includes('--dry-run');
const CLIENT_ID   = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

// URL con formato antiguo (solo mes sin año, o 3 dígitos)
const OLD_URL_RX = /^https?:\/\/http2\.mlstatic\.com\/.*_\d{2,3}-F\.(jpg|webp)$/;

async function getToken() {
  const refresh = process.env.ML_REFRESH_TOKEN;
  if (refresh) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh }),
    });
    if (r.ok) return (await r.json()).access_token;
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  return (await r.json()).access_token;
}

async function getProductImage(mlId, token) {
  const r = await fetch(`${API}/products/${mlId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const pics = data?.pictures ?? [];
  if (!pics.length) return null;
  // Prefer secure_url, fallback to url
  return pics[0].secure_url || pics[0].url || null;
}

async function main() {
  const token = await getToken();
  console.log('🔑 Token OK\n');

  const html   = readFileSync(HTML_FILE, 'utf8');
  const admin  = JSON.parse(readFileSync(ADMIN_FILE, 'utf8'));

  // Build map: modeloBase → mlId (from merged-admin.json celulares_android)
  const modeloMap = new Map(); // modeloBase → mlId
  for (const p of (admin.celulares_android || [])) {
    if (!p.mlId) continue;
    // id format: "android-{modeloBase}-{storage}gb-{ram}gb"
    // extract modeloBase from id
    const m = p.id?.match(/^android-(.+)-\d+gb-\d+gb$/);
    if (m && !modeloMap.has(m[1])) modeloMap.set(m[1], p.mlId);
  }

  // Find all img: '...' occurrences in HTML and collect broken ones
  const imgRx = /img:\s*'([^']+)'/g;
  let match;
  const broken = []; // { index, imgUrl, modeloBase }

  // Also build a map of familia modeloBase by parsing around each img
  // We need to find the modeloBase near each img occurrence
  const famBlocks = [...html.matchAll(/modeloBase:\s*'([^']+)'/g)];
  const modeloPositions = famBlocks.map(m => ({ pos: m.index, modeloBase: m[1] }));

  while ((match = imgRx.exec(html)) !== null) {
    const imgUrl = match[1];
    if (!OLD_URL_RX.test(imgUrl)) continue;
    // Find closest modeloBase before this img
    const pos = match.index;
    let closest = null;
    for (const mp of modeloPositions) {
      if (mp.pos < pos) closest = mp.modeloBase;
      else break;
    }
    if (closest) broken.push({ index: match.index, fullMatch: match[0], imgUrl, modeloBase: closest });
  }

  console.log(`📷 ${broken.length} imágenes con URL antigua (de ${famBlocks.length} familias)\n`);

  // Fetch fresh images in series (avoid rate limits)
  let updated = 0;
  let newHtml = html;
  let offset = 0;

  for (const b of broken) {
    const mlId = modeloMap.get(b.modeloBase);
    if (!mlId) {
      console.log(`  ⚠ Sin mlId — ${b.modeloBase}`);
      continue;
    }
    const freshUrl = await getProductImage(mlId, token);
    if (!freshUrl) {
      console.log(`  ✗ Sin imagen en API — ${b.modeloBase} (${mlId})`);
      continue;
    }
    if (!freshUrl.includes('mlstatic') && !freshUrl.includes('amazon')) {
      console.log(`  ⚠ URL sospechosa — ${b.modeloBase}: ${freshUrl.substring(0,80)}`);
      continue;
    }
    console.log(`  ✅ ${b.modeloBase}`);
    console.log(`     vieja: ${b.imgUrl.substring(0,80)}`);
    console.log(`     nueva: ${freshUrl.substring(0,80)}`);
    if (!DRY_RUN) {
      const oldTag = `img: '${b.imgUrl}'`;
      const newTag = `img: '${freshUrl}'`;
      newHtml = newHtml.replace(oldTag, newTag);
      updated++;
    }
    await new Promise(r => setTimeout(r, 120)); // small delay
  }

  if (!DRY_RUN && updated > 0) {
    writeFileSync(HTML_FILE, newHtml, 'utf8');
    console.log(`\n💾 celulares/android/index.html: ${updated} imágenes actualizadas`);
  } else if (DRY_RUN) {
    console.log('\n(dry-run: no se escribió nada)');
  } else {
    console.log('\n✓ Sin cambios');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
