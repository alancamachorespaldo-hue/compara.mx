#!/usr/bin/env node
/**
 * ml-update.js — Actualiza precios ML usando el ID de catálogo guardado (mlId)
 * en merged-admin.json: una llamada directa a /products/{mlId}/items por producto.
 *
 * Uso:
 *   node scripts/ml-update.js [--dry-run] [--categoria=<cat>|suplementos|all]
 *   node scripts/ml-update.js --sugerir [--categoria=...]
 *     → busca en el catálogo de ML candidatos para los productos con link ML sin mlId
 *       y los guarda en scripts/ml-sugerencias.json (el artifact los muestra para confirmar).
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

const ROOT        = resolve(import.meta.dirname, '..');
const API         = 'https://api.mercadolibre.com';
const DRY_RUN     = process.argv.includes('--dry-run');
const SUGERIR     = process.argv.includes('--sugerir');
const CAT_ARG     = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? 'all';
const CONCURRENCY = 4;
const ADMIN_PATH  = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH = resolve(ROOT, 'scripts/ml-report.json');
const SUG_PATH    = resolve(ROOT, 'scripts/ml-sugerencias.json');

const CATALOG = {
  laptops:    { file: 'laptops/index.html',                        varName: 'productos'  },
  freidoras:  { file: 'electrodomesticos/freidoras/index.html',    varName: 'productos'  },
  bicis:      { file: 'bicis/index.html',                          varName: 'ELECTRICAS' },
  microondas: { file: 'electrodomesticos/microondas/index.html',   varName: 'micros'     },
  proteina:   { file: 'suplementos/proteina/index.html',           varName: 'productos'  },
  omega3:     { file: 'suplementos/omega3/index.html',             varName: 'productos'  },
  magnesio:   { file: 'suplementos/magnesio/index.html',           varName: 'productos'  },
  creatina:   { file: 'suplementos/creatina/index.html',           varName: 'productos'  },
  complejo_b: { file: 'suplementos/complejo-b/index.html',         varName: 'PRODUCTOS'  },
  vitamina_d: { file: 'suplementos/vitamina-d/index.html',         varName: 'PRODUCTOS'  },
};
const SUPLEMENTOS = ['proteina', 'omega3', 'magnesio', 'creatina', 'complejo_b', 'vitamina_d'];
const ENTRIES =
  CAT_ARG === 'all'         ? Object.entries(CATALOG) :
  CAT_ARG === 'suplementos' ? SUPLEMENTOS.map(k => [k, CATALOG[k]]) :
  Object.entries(CATALOG).filter(([k]) => k === CAT_ARG);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MLID_RX = /^MLM\d{6,12}$/;

// ── Token ────────────────────────────────────────────────────────────────────
async function getToken() {
  const refreshToken = process.env.ML_REFRESH_TOKEN;
  if (refreshToken) {
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken }),
    });
    if (res.ok) { console.log('🔑 Token OAuth de usuario OK\n'); return (await res.json()).access_token; }
    console.warn(`⚠ refresh_token falló (${res.status}) — usando client_credentials\n`);
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

// ── API con reintentos (429 / 5xx / red) ─────────────────────────────────────
let TOKEN = null;
let CALLS = 0;
async function api(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    let res;
    CALLS++;
    try {
      res = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
    } catch {
      await sleep(800 * (i + 1));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** i); continue; }
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

// Publicamos la oferta más barata con envío FULL (fulfillment): es la que se acerca a lo que ML
// destaca en la ficha para la mayoría de los compradores. La ficha exacta depende del CP de quien
// mira y del ranking de ML, que no vienen en la API, así que no se puede clavar al 100%.
// Si el catálogo no tiene ninguna oferta FULL, caemos a la más barata disponible.
function listedPrice(results = []) {
  const ok = results.filter(i => i.price > 0);
  const nuevos = ok.filter(i => i.condition === 'new');
  const pick = nuevos.length ? nuevos : ok;
  if (!pick.length) return null;
  const full = pick.filter(i => i.shipping?.logistic_type === 'fulfillment');
  const pool = full.length ? full : pick;
  return Math.min(...pool.map(i => i.price));
}

// Precio de un producto de catálogo; si no tiene ofertas, prueba buy box e hijos (variantes).
async function catalogPrice(id, { deep = true } = {}) {
  const direct = listedPrice((await api(`/products/${id}/items?limit=20`))?.results);
  if (direct || !deep) return direct;
  const prod = await api(`/products/${id}`);
  if (prod?.buy_box_winner?.price > 0) return prod.buy_box_winner.price;
  for (const cid of (prod?.children_ids ?? []).slice(0, 3)) {
    const p = listedPrice((await api(`/products/${cid}/items?limit=20`))?.results);
    if (p) return p;
  }
  return null;
}

// ID de catálogo a partir de lo guardado (mlId, link /p/MLM…, _mlCatalogo).
function catalogId(p) {
  if (p.mlId && MLID_RX.test(p.mlId)) return p.mlId;
  const m = String(p.linkML || p._mlCatalogo || '').match(/\/p\/(MLM\d{6,12})/i);
  return m ? m[1].toUpperCase() : null;
}

// ── Array de productos dentro del HTML del sitio ─────────────────────────────
function locateArray(html, varName) {
  const m = html.match(new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*\\[`, 'm'));
  if (!m) return null;
  const start = html.indexOf('[', m.index);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']' && --depth === 0) return { start, end: i + 1 };
  }
  return null;
}

const BLOCK_ID_RX = /(?:^|[{,\s])["']?id["']?\s*:\s*["'`]?([^,"'`\s}]+)/;
function topBlocks(text) {
  const blocks = [];
  let depth = 0, s = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth++ === 0) s = i; }
    else if (text[i] === '}' && --depth === 0) {
      const body = text.slice(s, i + 1);
      blocks.push({ s, e: i + 1, id: body.match(BLOCK_ID_RX)?.[1] ?? null });
    }
  }
  return blocks;
}

// Lee un número de un campo del bloque, venga como 90, "90" o "$2.44".
const campoNum = (block, campo) => {
  const m = block.match(new RegExp(`["']?\\b${campo}["']?\\s*:\\s*["']?\\$?([\\d.]+)`));
  return m ? parseFloat(m[1]) : null;
};
// Reescribe un campo derivado conservando su formato (número suelto o cadena con $).
const setCampo = (block, campo, valor) => block.replace(
  new RegExp(`(["']?\\b${campo}["']?\\s*:\\s*)(["'])?\\$?[\\d.]+(["'])?`),
  (_, pre, q1, q2) => pre + (q1 ? `${q1}$${valor.toFixed(2)}${q2 || q1}` : +valor.toFixed(2)),
);

// Costo por porción (y por 5 g / 1000 UI) = precio ÷ porciones: al cambiar el precio hay que
// recalcularlos o quedan mintiendo. Usan el precio que muestra la tarjeta (el nuevo precioML).
function patchBlock(block, price) {
  let out = /["']?\bprecioML["']?\s*:/.test(block)
    ? block.replace(/(["']?\bprecioML["']?\s*:\s*)(null|[\d.]+)/, `$1${price}`)
    : block.replace(/(["']?\bprecio["']?\s*:\s*)[\d.]+/, `$1${price}`);
  const porciones = campoNum(out, 'porciones');
  if (porciones > 0) {
    const porPorcion = price / porciones;
    if (/["']?\bcostoPorPorcion["']?\s*:/.test(out)) out = setCampo(out, 'costoPorPorcion', porPorcion);
    const g = campoNum(out, 'contenidoGramos');
    if (/["']?\bcostoPor5g["']?\s*:/.test(out) && g > 0) out = setCampo(out, 'costoPor5g', price / (g / 5));
    const ui = campoNum(out, 'ui');
    if (/["']?\bcostoPor1000ui["']?\s*:/.test(out) && ui > 0) out = setCampo(out, 'costoPor1000ui', porPorcion / (ui / 1000));
  }
  return out;
}

// ── Modo precios ─────────────────────────────────────────────────────────────
async function updateCategory(key, config, admin, REPORT) {
  const abs = resolve(ROOT, config.file);
  if (!existsSync(abs)) { console.log(`  ⚠ No encontrado: ${config.file}`); return; }
  let html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, config.varName);
  if (!loc) { console.log(`  ⚠ Sin array ${config.varName} en ${config.file}`); return; }

  const arrayText = html.slice(loc.start, loc.end);
  const htmlProds = new Function(`return ${arrayText}`)();
  const blocks = topBlocks(arrayText);
  const htmlById = new Map();
  htmlProds.forEach((p, i) => {
    if (blocks[i] && blocks[i].id === String(p.id)) htmlById.set(String(p.id), { obj: p, block: blocks[i] });
  });

  const list = (admin[key] || []).filter(p => p.activo !== false);
  const targets = [];
  let soloAmz = 0, sinId = 0;
  for (const p of list) {
    const id = catalogId(p);
    // Sin link de afiliado ML el sitio no muestra precio ML: el catálogo solo sirve para leer características.
    if (!p.linkML && p.estadoML !== 'nuevo') { soloAmz++; continue; }
    if (!id) {
      sinId++;
      REPORT.push({ categoria: key, id: p.id, nombre: p.nombre, marca: p.marca, estado: 'sin_id', mlId: null, precioML: null });
      continue;
    }
    targets.push({ p, mlId: id, html: p.linkML ? htmlById.get(String(p.id)) || null : null });
  }

  console.log(`\n📄 ${key} — ${targets.length} con ID de catálogo · ${sinId} sin ID · ${soloAmz} solo Amazon`);
  const t0 = Date.now();
  const prices = await pool(targets, CONCURRENCY, t => catalogPrice(t.mlId));

  const patches = [];
  targets.forEach((t, i) => {
    const raw = prices[i];
    const label = `${t.p.marca} ${t.p.nombre}`.substring(0, 45).padEnd(45);
    const actual = t.html ? (t.html.obj.precioML ?? t.html.obj.precio ?? null) : (t.p.precioML ?? null);
    const row = { categoria: key, id: t.p.id, nombre: t.p.nombre, marca: t.p.marca, mlId: t.mlId, precioAntes: actual };
    if (!raw) {
      console.log(`  ✗ ${label} ${t.mlId} sin ofertas`);
      REPORT.push({ ...row, estado: 'sin_precio', precioML: null });
      return;
    }
    const nuevo = Math.round(raw);
    const ratio = actual ? nuevo / actual : 1;
    if (ratio < 0.2 || ratio > 4) {
      console.log(`  ⚠ ${label} $${actual} → $${nuevo} sospechoso (${ratio.toFixed(1)}x), ignorado`);
      REPORT.push({ ...row, estado: 'precio_sospechoso', precioML: nuevo });
      return;
    }
    if (actual === nuevo) {
      console.log(`  = ${label} $${nuevo.toLocaleString('es-MX')}`);
      REPORT.push({ ...row, estado: 'sin_cambio', precioML: nuevo });
      return;
    }
    console.log(`  ✅ ${label} $${actual ?? '—'} → $${nuevo.toLocaleString('es-MX')}`);
    REPORT.push({ ...row, estado: 'actualizado', precioNuevo: nuevo, precioML: nuevo });
    if (t.html) patches.push({ block: t.html.block, price: nuevo });
  });

  console.log(`  ⏱ ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!patches.length) { console.log('  ✓ Sin cambios en el HTML'); return; }

  let text = arrayText;
  for (const { block, price } of patches.sort((a, b) => b.block.s - a.block.s)) {
    text = text.slice(0, block.s) + patchBlock(text.slice(block.s, block.e), price) + text.slice(block.e);
  }
  html = html.slice(0, loc.start) + text + html.slice(loc.end);
  if (DRY_RUN) { console.log(`  🔍 DRY RUN — ${patches.length} precios cambiarían`); return; }
  writeFileSync(abs, html, 'utf8');
  console.log(`  💾 ${config.file}: ${patches.length} precios actualizados`);
}

// ── Modo sugerencias ─────────────────────────────────────────────────────────
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
function priceScore(price, ref) {
  if (!price || !ref) return 0.5;
  return Math.max(0, 1 - Math.abs(Math.log(price / ref)) / Math.log(3));
}

async function searchCatalog(q) {
  const data = await api(`/products/search?site_id=MLM&status=active&limit=6&q=${encodeURIComponent(q.substring(0, 90))}`);
  return data?.results ?? [];
}

async function suggestFor(p) {
  const full = `${p.marca || ''} ${p.nombre}`.trim();
  let results = await searchCatalog(full);
  if (!results.length) {
    const short = [p.marca, ...tokens(p.nombre).filter(t => t !== String(p.marca || '').toLowerCase()).slice(0, 4)].filter(Boolean).join(' ');
    if (short && short !== full) results = await searchCatalog(short);
  }
  const ranked = results
    .map(r => ({ id: r.id, n: String(r.name || '').substring(0, 110), ns: nameScore(full, r.name) }))
    .sort((a, b) => b.ns - a.ns)
    .slice(0, 3);
  const ref = p.precioML || p.precio || p.precioAmz || null;
  for (const c of ranked) {
    c.p = await catalogPrice(c.id, { deep: false });
    if (c.p) c.p = Math.round(c.p);
    c.s = Math.round(100 * (0.75 * c.ns + 0.25 * priceScore(c.p, ref)));
    delete c.ns;
  }
  return ranked.sort((a, b) => b.s - a.s);
}

async function suggestAll(admin) {
  const prev = existsSync(SUG_PATH) ? JSON.parse(readFileSync(SUG_PATH, 'utf8')) : { items: {} };
  const items = { ...(prev.items || {}) };
  const cats = ENTRIES.map(([k]) => k);
  const targets = [];
  for (const cat of cats) {
    for (const key of Object.keys(items)) if (key.startsWith(cat + '|')) delete items[key];
    for (const p of admin[cat] || []) if (p.linkML && !catalogId(p)) targets.push({ cat, p });
  }
  console.log(`\n🔎 Buscando candidatos para ${targets.length} productos sin ID de catálogo…\n`);
  const t0 = Date.now();
  let done = 0, withSug = 0;
  await pool(targets, CONCURRENCY, async ({ cat, p }) => {
    const sug = await suggestFor(p);
    items[`${cat}|${p.id}`] = sug;
    if (sug.length) withSug++;
    done++;
    const top = sug[0];
    console.log(`  [${String(done).padStart(3)}/${targets.length}] ${`${p.marca} ${p.nombre}`.substring(0, 42).padEnd(42)} ${top ? `${top.id} ${String(top.s).padStart(3)}% $${top.p ?? '—'}` : 'sin candidatos'}`);
  });
  const out = { generado: new Date().toISOString(), items };
  writeFileSync(SUG_PATH, JSON.stringify(out, null, 1), 'utf8');
  console.log(`\n💡 ${withSug}/${targets.length} con candidatos · ${CALLS} llamadas · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('   Guardado en scripts/ml-sugerencias.json — corre generar-admin.js para verlos en el artifact.\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!ENTRIES.length) {
    console.error(`❌ Categoría "${CAT_ARG}". Opciones: ${Object.keys(CATALOG).join(', ')}, suplementos, all`);
    process.exit(1);
  }
  console.log(`\n🛒 comparalo.mx — ${SUGERIR ? 'Sugerencias de ID ML' : 'Actualizador de precios ML'}`);
  console.log(`   Modo: ${DRY_RUN ? 'DRY RUN' : 'ESCRITURA'} · Categoría: ${CAT_ARG}\n`);

  try { TOKEN = await getToken(); }
  catch (e) { console.error('❌', e.message); process.exit(1); }

  const admin = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
  if (SUGERIR) { await suggestAll(admin); return; }

  const REPORT = [];
  const t0 = Date.now();
  for (const [key, config] of ENTRIES) await updateCategory(key, config, admin, REPORT);

  const count = e => REPORT.filter(r => r.estado === e).length;
  const totales = {
    actualizados: count('actualizado'), sin_cambio: count('sin_cambio'), sin_precio: count('sin_precio'),
    precio_sospechoso: count('precio_sospechoso'), sin_id: count('sin_id'),
  };
  console.log(`\n📊 ${JSON.stringify(totales)} · ${CALLS} llamadas · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  if (!DRY_RUN) {
    const generado = new Date().toISOString();
    writeFileSync(REPORT_PATH, JSON.stringify({
      fecha: generado.slice(0, 10), generado, categorias: ENTRIES.map(([k]) => k), totales, productos: REPORT,
    }, null, 2), 'utf8');
    console.log('📊 Reporte guardado en scripts/ml-report.json');
  }
  console.log('\n✅ Listo\n');
})();
