#!/usr/bin/env node
/**
 * fetch-cafeteras-nuevas.mjs
 * Obtiene datos de 59 cafeteras nuevas desde la API de ML y las añade a merged-admin.json
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.mercadolibre.com';
const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

// Nuevas cafeteras: MLM ID → link de afiliado
const NUEVAS = [
  ['MLM50884583','https://meli.la/1eBJh2a'],
  ['MLM6076298','https://meli.la/2h1NkLH'],
  ['MLM64533182','https://meli.la/1sEA9GA'],
  ['MLM49827161','https://meli.la/1ToL96B'],
  ['MLM42416247','https://meli.la/1p9fMji'],
  ['MLM37257469','https://meli.la/1UWpM1G'],
  ['MLM45402536','https://meli.la/2zg27hb'],
  ['MLM18997648','https://meli.la/1kkh4qn'],
  ['MLM78600203','https://meli.la/2jUyzau'],
  ['MLM76430416','https://meli.la/2R8F8jT'],
  ['MLM38224698','https://meli.la/2UAYBMb'],
  ['MLM70336754','https://meli.la/1qV4GXP'],
  ['MLM63643363','https://meli.la/29hP8aj'],
  ['MLM54250784','https://meli.la/1dX2ezc'],
  ['MLM64639256','https://meli.la/1ppD1Bg'],
  ['MLM68516580','https://meli.la/1GhPMcE'],
  ['MLM37445228','https://meli.la/2J2ygRk'],
  ['MLM35544277','https://meli.la/1525Zg1'],
  ['MLM73678844','https://meli.la/1Vw6g2t'],
  ['MLM77618671','https://meli.la/1hSR3Vo'],
  ['MLM28613180','https://meli.la/2MxzqAb'],
  ['MLM61267315','https://meli.la/2BJhHF1'],
  ['MLM20789463','https://meli.la/2cqmRuc'],
  ['MLM70369653','https://meli.la/2CGs3Jb'],
  ['MLM65599139','https://meli.la/1VDnYh6'],
  ['MLM69359834','https://meli.la/2opDGiz'],
  ['MLM74606752','https://meli.la/2732foX'],
  ['MLM29101443','https://meli.la/2ubiz9N'],
  ['MLM34508264','https://meli.la/2v2KEtz'],
  ['MLM42113953','https://meli.la/1BhqhYb'],
  ['MLM45867011','https://meli.la/1fdhby3'],
  ['MLM62979610','https://meli.la/1ChoMdm'],
  ['MLM19722532','https://meli.la/1JCdy7X'],
  ['MLM55687063','https://meli.la/2myyu9C'],
  ['MLM73914997','https://meli.la/1s6AFWZ'],
  ['MLM79743127','https://meli.la/1iUT1cy'],
  ['MLM54800255','https://meli.la/1KmeFgS'],
  ['MLM44661804','https://meli.la/1hzZAqP'],
  ['MLM45002085','https://meli.la/1JCWu8v'],
  ['MLM54151687','https://meli.la/1cyNprf'],
  ['MLM64203067','https://meli.la/1hPNdaR'],
  ['MLM79605530','https://meli.la/12331No'],
  ['MLM49760227','https://meli.la/33d2oVW'],
  ['MLM61104879','https://meli.la/2zvpyoF'],
  ['MLM22728551','https://meli.la/176JnCp'],
  ['MLM55880167','https://meli.la/1b3sUjK'],
  ['MLM76442004','https://meli.la/1oVqY25'],
  ['MLM54150738','https://meli.la/28r3Vkm'],
  ['MLM37493062','https://meli.la/1hSzDR6'],
  ['MLM25961884','https://meli.la/2HsbzJu'],
  ['MLM39206420','https://meli.la/33vqSkK'],
  ['MLM61988930','https://meli.la/2YMkQWr'],
  ['MLM53768392','https://meli.la/1b1mFD4'],
  ['MLM32064349','https://meli.la/2BGv8zv'],
  ['MLM66507043','https://meli.la/1R9FjLD'],
  ['MLM80532654','https://meli.la/1Lgd7tt'],
  ['MLM37771795','https://meli.la/2cDD6Ny'],
  ['MLM73546686','https://meli.la/1uKbDY8'],
  ['MLM77506871','https://meli.la/2RF86B1'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getToken() {
  const rf = process.env.ML_REFRESH_TOKEN;
  if (rf) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rf }),
    });
    if (r.ok) { const d = await r.json(); console.log('🔑 Token OK'); return d.access_token; }
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  const d = await r.json();
  console.log('🔑 Token client_credentials OK');
  return d.access_token;
}

async function apiFetch(path, token, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i + 1)); continue; }
      return null;
    } catch { await sleep(800 * (i + 1)); }
  }
  return null;
}

function listedPrice(results = []) {
  const ok = results.filter(i => i.price > 0 && i.condition === 'new');
  if (!ok.length) return null;
  const full = ok.filter(i => i.shipping?.logistic_type === 'fulfillment');
  const pool = full.length ? full : ok;
  return Math.min(...pool.map(i => i.price));
}

// Extrae specs de los atributos de ML
function buildEspecs(attrs = []) {
  const get = (ids) => {
    for (const id of ids) {
      const a = attrs.find(x => x.id === id);
      if (a?.value_name && a.value_name !== 'No aplica') return a.value_name;
    }
    return '';
  };

  // Tipo de cafetera
  let tipo = get(['COFFEE_MAKER_TYPE','COFFEE_TYPE','PRODUCT_TYPE']);
  const nombre_lower = ''; // se rellena después
  if (!tipo) {
    const cap = get(['COFFEE_CAPSULE_TYPE','COMPATIBLE_CAPSULE_TYPE']);
    if (cap) tipo = 'Cápsulas';
  }

  const cap = get(['WATER_TANK_CAPACITY','WATER_TRAY_CAPACITY','WATER_CONTAINER_CAPACITY','CONTAINER_CAPACITY','CAPACITY']);
  const pres = get(['PRESSURE','MAX_PRESSURE']);
  const vap = get(['STEAM_PIPE','FROTHING_PIPE_TYPE','MILK_FROTHER']) ? 'Sí' : '';
  const pot = get(['POWER','ELECTRICAL_POWER']);
  const comp = get(['COMPATIBLE_CAPSULE_TYPE','CAPSULE_COMPATIBILITY','COFFEE_CAPSULE_TYPE']);
  const mol = get(['GRINDER','BUILT_IN_GRINDER','GRINDER_TYPE']) ? 'Sí' : '';
  const tazas = get(['CUPS_QUANTITY','MAX_CUPS','COFFEE_CUP_QUANTITY']);
  const prog = get(['PROGRAMMABLE','PROGRAMMING_FUNCTIONALITY']);
  const term = get(['THERMAL_JUG','JUG_TYPE','CARAFE_TYPE']);

  return { tipo, capacidad: cap, presion: pres, vaporizador: vap, potencia: pot, compatible: comp, molinillo: mol, tazas, programable: prog, jarra: term };
}

// Imagen principal del catálogo
function getImage(prod) {
  const pics = prod?.pictures || prod?.main_pictures || [];
  if (pics.length) {
    const p = pics[0];
    return (p.url || p.secure_url || '').replace('-O.jpg','-O.jpg');
  }
  return '';
}

async function main() {
  const token = await getToken();
  const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
  const admin = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
  const existing = admin.cafeteras || [];

  // IDs ya existentes para no duplicar
  const existingMlIds = new Set(existing.map(p => p.mlId).filter(Boolean));
  const nextNum = existing.length + 1;

  const results = [];
  let idx = nextNum;

  for (let i = 0; i < NUEVAS.length; i++) {
    const [mlId, link] = NUEVAS[i];
    if (existingMlIds.has(mlId)) {
      console.log(`  ⏭  ${mlId} ya existe`);
      continue;
    }

    process.stdout.write(`[${i+1}/${NUEVAS.length}] ${mlId} ... `);

    // Producto
    const prod = await apiFetch(`/products/${mlId}`, token);
    if (!prod) { console.log('❌ no encontrado'); results.push({ mlId, error: true }); await sleep(300); continue; }

    // Precio
    const itemsData = await apiFetch(`/products/${mlId}/items?limit=20`, token);
    let precio = listedPrice(itemsData?.results || []);
    if (!precio && prod.buy_box_winner?.price > 0) precio = prod.buy_box_winner.price;

    // Nombre corto
    const nombre = (prod.name || prod.short_name || prod.title || mlId).trim();
    // Marca
    const marcaAttr = (prod.attributes || []).find(a => a.id === 'BRAND');
    const marca = marcaAttr?.value_name || prod.brand || '';
    // Imagen
    let imagen = getImage(prod);
    if (!imagen) {
      // Intentar desde un item
      if (itemsData?.results?.length) {
        const item = await apiFetch(`/items/${itemsData.results[0].id}`, token);
        if (item?.pictures?.length) imagen = item.pictures[0].url || '';
      }
    }
    // Estrellas y reseñas
    const estrellas = prod.reviews?.rating_average ? Math.round(prod.reviews.rating_average * 10) / 10 : null;
    const resenas = prod.reviews?.total || null;

    // Specs
    const especs = buildEspecs(prod.attributes || []);

    const producto = {
      id: `cafetera-mlm${mlId.replace('MLM','').toLowerCase()}-${idx}`,
      nombre,
      marca,
      linkML: link,
      linkAmz: null,
      mlId,
      precioML: precio || null,
      precioAmz: null,
      activo: true,
      estadoML: precio ? 'actualizado' : 'sin_precio',
      imagen,
      estrellas,
      resenas,
      especs,
      _mlCheckedAt: new Date().toISOString(),
    };

    console.log(`✓ ${nombre.substring(0,50)} | $${precio||'—'}`);
    results.push(producto);
    idx++;
    await sleep(200);
  }

  const nuevos = results.filter(r => !r.error);
  console.log(`\n✅ ${nuevos.length} cafeteras nuevas obtenidas, ${results.filter(r=>r.error).length} errores`);

  if (nuevos.length > 0) {
    admin.cafeteras = [...existing, ...nuevos];
    writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
    console.log(`✓ merged-admin.json actualizado: ${admin.cafeteras.length} cafeteras total`);
  }

  // Guardar resumen
  writeFileSync(resolve(ROOT, 'scripts/cafeteras-nuevas-resultado.json'), JSON.stringify({ total: nuevos.length, errores: results.filter(r=>r.error).map(r=>r.mlId), productos: nuevos }, null, 2), 'utf8');
  console.log('✓ Resumen en scripts/cafeteras-nuevas-resultado.json');
}

main().catch(e => { console.error(e); process.exit(1); });
