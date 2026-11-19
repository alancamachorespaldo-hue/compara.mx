/**
 * fetch-televisiones.mjs — trae de la API de Mercado Libre los datos de catálogo de las
 * televisiones de scripts/televisiones-input.json (ID de catálogo MLM… + link de afiliado).
 *
 * Qué saca de /products/{mlId}: nombre, marca, imagen y las características de la ficha
 * (pulgadas, resolución, tipo de panel, sistema operativo, HDMI, HDR, Bluetooth…).
 * El precio sale de /products/{mlId}/items con la MISMA regla que ml-update.js
 * (la oferta más barata nueva con envío FULL), para que el día que corra el workflow
 * de precios la cifra no cambie por una razón distinta a que el precio cambió.
 *
 * La API no entrega calificaciones ni unidades vendidas de publicaciones ajenas
 * (reviews_rating_average / reviews_count vienen vacíos): no se inventan.
 *
 * Uso:
 *   node scripts/fetch-televisiones.mjs            → solo escribe el reporte
 *   node scripts/fetch-televisiones.mjs --aplicar  → además crea/actualiza la categoría
 *                                                    `televisiones` en merged-admin.json
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT  = resolve(import.meta.dirname, '..');
const API   = 'https://api.mercadolibre.com';
const APPLY = process.argv.includes('--aplicar');
const CONC  = 5;

const { ML_CLIENT_ID: CLIENT_ID, ML_CLIENT_SECRET: CLIENT_SECRET, ML_REFRESH_TOKEN: REFRESH_TOKEN } = process.env;
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Falta ML_CLIENT_ID o ML_CLIENT_SECRET.'); process.exit(1); }

async function getToken() {
  if (REFRESH_TOKEN) {
    const r = await fetch(`${API}/oauth/token`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN }) });
    if (r.ok) { console.log('Token OAuth OK\n'); return (await r.json()).access_token; }
  }
  const r = await fetch(`${API}/oauth/token`, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }) });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  console.log('Token client_credentials OK\n');
  return (await r.json()).access_token;
}

let TOKEN = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1000 * 2 ** i); continue; }
      return null;
    } catch { await sleep(800 * (i + 1)); }
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

/* Misma regla de precio que ml-update.js: la oferta más barata nueva con envío FULL. */
function listedPrice(results = []) {
  const ok = results.filter((i) => i.price > 0);
  const nuevos = ok.filter((i) => i.condition === 'new');
  const pick = nuevos.length ? nuevos : ok;
  if (!pick.length) return null;
  const full = pick.filter((i) => i.shipping?.logistic_type === 'fulfillment');
  const elegidos = full.length ? full : pick;
  return Math.min(...elegidos.map((i) => i.price));
}

const num = (raw) => { if (raw == null) return null; const n = parseFloat(String(raw).replace(/,/g, '.').replace(/[^\d.]/g, '')); return isFinite(n) ? n : null; };
const si = (raw) => (raw == null ? null : /^s[íi]$/i.test(String(raw).trim()) ? true : /^no$/i.test(String(raw).trim()) ? false : null);

function attrs(list) {
  const m = {};
  for (const a of list || []) {
    const v = a.value_name ?? a.values?.[0]?.name;
    if (v != null && v !== '') m[(a.id || '').toUpperCase()] = v;
  }
  return m;
}

async function uno(mlId) {
  const [prod, items] = await Promise.all([api(`/products/${mlId}`), api(`/products/${mlId}/items?limit=20`)]);
  if (!prod || prod.error) return { error: 'sin_ficha' };
  const a = attrs(prod.attributes);
  let precio = listedPrice(items?.results);
  if (precio == null && prod.buy_box_winner?.price > 0) precio = prod.buy_box_winner.price;

  return {
    nombre:      prod.name || prod.title || '',
    estadoFicha: prod.status || null,
    img:         prod.pictures?.[0]?.secure_url || prod.pictures?.[0]?.url || prod.thumbnail || '',
    precioML:    precio,
    marca:       a.BRAND || null,
    modelo:      a.ALPHANUMERIC_MODEL || a.MODEL || null,
    pulgadas:    num(a.DISPLAY_SIZE),
    resolucion:  a.RESOLUTION_TYPE || null,
    panel:       a.DISPLAY_TYPE || null,
    so:          a.OPERATIVE_SYSTEM || null,
    hz:          num(a.REFRESH_RATE),
    hdmi:        num(a.HDMI_PORTS_NUMBER),
    usb:         num(a.USB_PORTS_NUMBER),
    bocinas:     num(a.SPEAKERS_NUMBER),
    smart:       si(a.IS_SMART),
    hdr:         si(a.WITH_HDR),
    bluetooth:   si(a.WITH_BLUETOOTH),
    wifi:        si(a.WITH_WI_FI),
    curva:       si(a.IS_CURVED),
    comandoVoz:  si(a.WITH_INTEGRATED_VOICE_COMMAND),
    /* La API no da calificación ni unidades vendidas de catálogos ajenos. */
    estrellas:   prod.reviews_rating_average ?? null,
    resenas:     prod.reviews_count ?? null,
    _attrs:      a,
  };
}

TOKEN = await getToken();
const entrada = JSON.parse(readFileSync(resolve(ROOT, 'scripts/televisiones-input.json'), 'utf8'));
console.log(`${entrada.length} televisiones a consultar en Mercado Libre...\n`);

const datos = await pool(entrada, CONC, async ([mlId, linkML], i) => {
  const d = await uno(mlId);
  const et = `[${String(i + 1).padStart(3)}/${entrada.length}]`;
  if (d.error) { console.log(`  !  ${et} ${mlId} — ${d.error}`); return { mlId, linkML, ...d }; }
  console.log(`  ${et} ${mlId.padEnd(14)} $${String(d.precioML ?? '—').padStart(8)}  ` +
    `${String(d.pulgadas ?? '—').padStart(3)}"  ${String(d.resolucion ?? '—').padEnd(13)} ` +
    `${String(d.panel ?? '—').padEnd(6)} ${String(d.so ?? '—').padEnd(12)} ${d.nombre.slice(0, 40)}`);
  return { mlId, linkML, ...d };
});

writeFileSync(resolve(ROOT, 'scripts/televisiones-report.json'), JSON.stringify(datos, null, 2));
console.log(`\nReporte: scripts/televisiones-report.json`);
console.log(`   sin ficha: ${datos.filter((d) => d.error).length} · sin precio: ${datos.filter((d) => !d.error && d.precioML == null).length}`);

if (!APPLY) { console.log('\nCorre con --aplicar para escribir la categoría en merged-admin.json'); process.exit(0); }

// ── Aplicar a merged-admin.json ──────────────────────────────────────────────
const adminPath = resolve(ROOT, 'scripts/merged-admin.json');
const admin = JSON.parse(readFileSync(adminPath, 'utf8'));
const previos = new Map((admin.televisiones || []).map((p) => [p.mlId, p]));

const lista = [];
let id = 0;
for (const d of datos) {
  if (d.error) continue;   // sin ficha en el catálogo: no hay nada que publicar
  const prev = previos.get(d.mlId) || {};
  /* Sin precio de catálogo hoy no se puede publicar la tarjeta (no hay cifra que comparar).
     Entra a la base como `activo:false` + `estadoML:'nuevo'`: así el workflow de precios le
     sigue buscando precio todos los días y aparece en el gestor para que Alan lo publique,
     pero `publicado()` lo deja fuera del histórico, de las ofertas y del HTML. */
  const sinPrecio = d.precioML == null;
  lista.push({
    ...prev,
    id: ++id,
    mlId: d.mlId,
    nombre: d.nombre,
    marca: d.marca || '',
    modelo: d.modelo || '',
    pulgadas: d.pulgadas,
    resolucion: d.resolucion,
    panel: d.panel,
    so: d.so,
    hz: d.hz,
    hdmi: d.hdmi,
    usb: d.usb,
    bocinas: d.bocinas,
    smart: d.smart,
    hdr: d.hdr,
    bluetooth: d.bluetooth,
    wifi: d.wifi,
    curva: d.curva,
    comandoVoz: d.comandoVoz,
    precio: d.precioML,
    precioML: d.precioML,
    precioAmz: null,
    estrellas: null, estrellasML: null, estrellasAmz: null,
    resenas: null, resenasML: null, resenasAmz: null,
    linkML: d.linkML,
    linkAmz: '',
    img: d.img,
    activo: !sinPrecio,
    ...(sinPrecio ? { estadoML: 'nuevo' } : {}),
  });
}
admin.televisiones = lista;
writeFileSync(adminPath, JSON.stringify(admin, null, 2));
console.log(`\nmerged-admin.json → televisiones: ${lista.length} productos`);
