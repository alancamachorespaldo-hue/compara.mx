#!/usr/bin/env node
/**
 * sugerir-ids.mjs — busca candidatos de ID de catálogo (mlId) para los productos que tienen
 * enlace de ML pero no ID, y los deja en scripts/ml-sugerencias.json para confirmarlos a mano
 * en el gestor.
 *
 * POR QUÉ ESTÁ AQUÍ. Vivía dentro de ml-update.js como `--sugerir`. Ese script se retiró en
 * nov-2026 porque sacaba los precios de /products/{id}/items, que Mercado Libre cerró. Esto no
 * es precio: usa /products/search, que sigue respondiendo 200, así que no tenía por qué morir
 * con él.
 *
 * QUÉ CAMBIÓ AL MUDARSE. Antes el candidato se puntuaba mezclando parecido de nombre (75%) y
 * cercanía de precio (25%), y el precio salía del endpoint que ya no responde. Ahora la nota es
 * solo el parecido de nombre: inventarse un empate de precios con un dato que no existe sería
 * peor que no tenerlo.
 *
 * Uso:
 *   node scripts/sugerir-ids.mjs --todas
 *   node scripts/sugerir-ids.mjs --categoria=laptops,cafeteras
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { clavesDeDatos, tituloDe } from './categorias.js';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://api.mercadolibre.com';
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const SUG_PATH = resolve(ROOT, 'scripts/ml-sugerencias.json');
const CONCURRENCIA = 4;
const MLID_RX = /^MLM\d{6,12}$/;

const TODAS = process.argv.includes('--todas');
const CATS_ARG = (process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? '').split(',').filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

let TOKEN = null, LLAMADAS = 0;

async function getToken() {
  const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secret, ML_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret) throw new Error('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  if (refresh) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh }),
    });
    if (r.ok) return (await r.json()).access_token;
    console.warn(`⚠ refresh_token falló (${r.status}) — se usa client_credentials`);
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  return (await r.json()).access_token;
}

async function api(path, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    LLAMADAS++;
    let res;
    try {
      res = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
    } catch { await sleep(800 * (i + 1)); continue; }
    if (res.ok) return await res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** i); continue; }
    return null;
  }
  return null;
}

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'en', 'y', 'a', 'por', 'sin', 'the', 'and', 'with', 'for', 'color', 'sabor']);
const tokens = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !STOP.has(t));

function nameScore(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return 0.6 * (inter / A.size) + 0.4 * (2 * inter / (A.size + B.size));
}

const catalogId = p => {
  if (p.mlId && MLID_RX.test(p.mlId)) return p.mlId;
  const m = String(p.linkML || p._mlCatalogo || '').match(/\/p\/(MLM\d{6,12})/i);
  return m ? m[1].toUpperCase() : null;
};

const buscar = async q =>
  (await api(`/products/search?site_id=MLM&status=active&limit=6&q=${encodeURIComponent(String(q).substring(0, 90))}`))?.results ?? [];

async function candidatos(p) {
  const full = `${p.marca || ''} ${p.nombre}`.trim();
  let res = await buscar(full);
  if (!res.length) {
    const corto = [p.marca, ...tokens(p.nombre).filter(t => t !== String(p.marca || '').toLowerCase()).slice(0, 4)].filter(Boolean).join(' ');
    if (corto && corto !== full) res = await buscar(corto);
  }
  return res
    .map(r => ({ id: r.id, n: String(r.name || '').substring(0, 110), s: Math.round(100 * nameScore(full, r.name)) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
}

async function main() {
  const registradas = clavesDeDatos();
  const claves = TODAS ? registradas : CATS_ARG;
  if (!claves.length) {
    console.error('Faltan categorías. Usa --todas o --categoria=a,b');
    console.error('Disponibles:', registradas.join(', '));
    process.exit(1);
  }
  const desconocidas = claves.filter(k => !registradas.includes(k));
  if (desconocidas.length) {
    console.error(`❌ Categoría(s) no registrada(s) en scripts/categorias.js: ${desconocidas.join(', ')}`);
    process.exit(1);
  }

  try { TOKEN = await getToken(); } catch (e) { console.error('❌', e.message); process.exit(1); }

  const db = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
  const prev = existsSync(SUG_PATH) ? JSON.parse(readFileSync(SUG_PATH, 'utf8')) : { items: {} };
  const items = { ...(prev.items || {}) };

  const objetivos = [];
  for (const cat of claves) {
    // Lo de esta categoría se recalcula entero; lo de las demás se conserva.
    for (const k of Object.keys(items)) if (k.startsWith(cat + '|')) delete items[k];
    for (const p of db[cat] ?? []) if (p.linkML && !catalogId(p)) objetivos.push({ cat, p });
  }

  console.log(`\n🔎 Candidatos de ID para ${objetivos.length} producto(s) con enlace y sin ID de catálogo\n`);
  if (!objetivos.length) { console.log('   Nada que buscar.\n'); return; }

  const t0 = Date.now();
  let hechos = 0, conSug = 0;
  await pool(objetivos, CONCURRENCIA, async ({ cat, p }) => {
    const sug = await candidatos(p);
    items[`${cat}|${p.id}`] = sug;
    if (sug.length) conSug++;
    const top = sug[0];
    console.log(`  [${String(++hechos).padStart(3)}/${objetivos.length}] ${tituloDe(cat).substring(0, 14).padEnd(15)}` +
      `${`${p.marca || ''} ${p.nombre}`.substring(0, 40).padEnd(40)} ` +
      (top ? `${top.id} ${String(top.s).padStart(3)}%` : 'sin candidatos'));
  });

  writeFileSync(SUG_PATH, JSON.stringify({ generado: new Date().toISOString(), items }, null, 1), 'utf8');
  console.log(`\n💡 ${conSug}/${objetivos.length} con candidatos · ${LLAMADAS} llamadas · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('   Guardado en scripts/ml-sugerencias.json — corre generar-admin.js para verlos en el gestor.\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
