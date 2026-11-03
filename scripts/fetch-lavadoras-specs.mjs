/**
 * fetch-lavadoras-specs.mjs
 * Obtiene de la API de ML: nombre, marca, imagen, precio, estrellas, reseñas
 * y specs de lavadora (capacidad, tipo de carga, centrifugado, tinas, profundidad).
 *
 * Uso:
 *   node scripts/fetch-lavadoras-specs.mjs            # dry run, imprime tabla
 *   node scripts/fetch-lavadoras-specs.mjs --aplicar  # aplica al HTML y merged-admin
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(__dir, '..');
const API     = 'https://api.mercadolibre.com';
const APPLY   = process.argv.includes('--aplicar');
const CONC    = 5; // llamadas paralelas

// ── Credenciales ─────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Falta ML_CLIENT_ID o ML_CLIENT_SECRET en el entorno.');
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

// ── Extracción de atributos ───────────────────────────────────────────────────
// IDs de atributos en el catálogo ML para lavadoras (se verifican con normalización)
const ATTR_MAP = {
  // IDs reales de la API ML (en mayúsculas; se compara en uppercase)
  'BRAND':                      'marca',
  'WASHING_MACHINE_CAPACITY':   'capacidadKg',   // "11 kg" → 11
  'LOADING_TYPE':               'tipoCarga',      // "Superior" | "Frontal"
  'SPIN_SPEED':                 'rpm',            // "1350 rpm" → 1350
  'DRUMS_NUMBER':               'tinas',          // "2" → 2
  'DEPTH':                      'profundidad',    // "40 cm" → 40
};

function extractAttr(attributes) {
  const out = {};
  if (!Array.isArray(attributes)) return out;
  for (const a of attributes) {
    const key = (a.id || '').toUpperCase();
    const dest = ATTR_MAP[key];
    if (!dest) continue;
    const raw = a.value_name || a.values?.[0]?.name || '';
    if (!raw) continue;
    if (dest === 'marca' || dest === 'tipoCarga') {
      out[dest] = raw;
    } else {
      // Extraer número (ej "10 kg" → 10, "1200 RPM" → 1200, "55 cm" → 55)
      const num = parseFloat(raw.replace(',', '.'));
      if (!isNaN(num)) out[dest] = num;
    }
  }
  return out;
}

// Tipo de carga normalizado al valor que usa filters-panel.js
function normalizaTipo(tipoCarga) {
  if (!tipoCarga) return null;
  const t = tipoCarga.toLowerCase();
  if (t.includes('frontal'))      return 'frontal';
  if (t.includes('superior') || t.includes('top')) return 'superior';
  if (t.includes('semi'))         return 'semiautomatica';
  if (t.includes('compacta') || t.includes('compact')) return 'compacta';
  return 'automatica'; // fallback genérico
}

// ── Precio desde /products/{id}/items ───────────────────────────────────────
function listedPrice(results) {
  if (!results?.length) return null;
  const prices = results
    .filter(i => i.price > 0 && i.available_quantity > 0)
    .map(i => i.price);
  if (!prices.length) return null;
  return Math.min(...prices);
}

async function fetchProductData(mlId) {
  const [prod, itemsRes] = await Promise.all([
    apiFetch(`/products/${mlId}`),
    apiFetch(`/products/${mlId}/items?limit=20`),
  ]);
  if (!prod) return null;

  const attrs   = extractAttr(prod.attributes);
  const precio  = listedPrice(itemsRes?.results) ?? null;

  // Imagen: primera de pictures o thumbnail
  const img = prod.pictures?.[0]?.url
    || prod.pictures?.[0]?.secure_url
    || prod.thumbnail
    || '';

  // Estrellas y reseñas: en /products/{id} vienen en reviews_rating_average y reviews_count
  const estrellas = prod.reviews_rating_average ?? prod.rating ?? null;
  const resenas   = prod.reviews_count           ?? prod.sold_quantity ?? null;

  // Nombre del producto
  const nombre = prod.name || prod.title || '';

  // Marca: primero de atributos, luego del objeto principal
  const marca = attrs.marca || prod.brand || '';

  return {
    nombre,
    marca,
    img,
    precio,
    precioML: precio,
    estrellas: estrellas ? Math.round(estrellas * 10) / 10 : null,
    resenas:   resenas   ? Math.round(resenas) : null,
    // Specs de lavadora
    capacidadKg: attrs.capacidadKg ?? null,
    tipo:        normalizaTipo(attrs.tipoCarga),
    tipoCargaRaw: attrs.tipoCarga ?? null,
    rpm:         attrs.rpm        ?? null,
    tinas:       attrs.tinas      ?? null,
    profundidad: attrs.profundidad ?? null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
TOKEN = await getToken();

const adminPath  = resolve(ROOT, 'scripts/merged-admin.json');
const htmlPath   = resolve(ROOT, 'electrodomesticos/lavadoras/index.html');
const admin      = JSON.parse(readFileSync(adminPath, 'utf8'));
const lavadoras  = admin.lavadoras || [];

console.log(`🫧 Obteniendo specs de ${lavadoras.length} lavadoras desde ML...\n`);

const results = await pool(lavadoras, CONC, async (p, i) => {
  const data = await fetchProductData(p.mlId);
  if (!data) {
    console.log(`  ⚠  [${i + 1}/${lavadoras.length}] ${p.mlId} — sin datos`);
    return null;
  }
  const cap  = data.capacidadKg != null ? `${data.capacidadKg} kg` : '—';
  const rpm  = data.rpm         != null ? `${data.rpm} RPM`         : '—';
  const tipo = data.tipoCargaRaw || data.tipo || '—';
  const img  = data.img ? '✓' : '✗';
  const est  = data.estrellas != null ? `★${data.estrellas}` : '—';
  console.log(
    `  [${String(i + 1).padStart(2)}] ${p.mlId}  $${data.precio?.toLocaleString('es-MX') ?? '—'}` +
    `  ${cap.padEnd(7)}  ${rpm.padEnd(9)}  ${tipo.substring(0, 16).padEnd(16)}  img:${img}  ${est}` +
    `  ${data.nombre.substring(0, 40)}`
  );
  return data;
});

// Guardar resultado crudo para revisión
const reportPath = resolve(ROOT, 'scripts/lavadoras-specs-report.json');
const report = lavadoras.map((p, i) => ({ id: p.id, mlId: p.mlId, linkML: p.linkML, ...results[i] }));
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📊 Reporte guardado en scripts/lavadoras-specs-report.json`);

if (!APPLY) {
  console.log('\n💡 Corre con --aplicar para escribir los cambios al HTML y merged-admin.json');
  process.exit(0);
}

// ── Aplicar: actualizar merged-admin.json ────────────────────────────────────
let applied = 0;
for (let i = 0; i < lavadoras.length; i++) {
  const d = results[i];
  if (!d) continue;
  const p = lavadoras[i];
  if (d.nombre)      p.nombre      = d.nombre;
  if (d.marca)       p.marca       = d.marca;
  if (d.img)         p.img         = d.img;
  if (d.precioML != null) p.precioML = d.precioML;
  if (d.estrellas != null) { p.estrellas = d.estrellas; p.estrellasML = d.estrellas; }
  if (d.resenas   != null) { p.resenas   = d.resenas;   p.resenasML   = d.resenas; }
  if (d.capacidadKg != null) p.capacidadKg = d.capacidadKg;
  if (d.tipo)        p.tipo        = d.tipo;
  if (d.rpm         != null) p.rpm         = d.rpm;
  if (d.tinas       != null) p.tinas       = d.tinas;
  if (d.profundidad != null) p.profundidad = d.profundidad;
  applied++;
}
writeFileSync(adminPath, JSON.stringify(admin, null, 2));
console.log(`\n✅ merged-admin.json: ${applied} lavadoras actualizadas`);

// ── Aplicar: parchear el array JS en el HTML ─────────────────────────────────
let html = readFileSync(htmlPath, 'utf8');

// Localizar el array const productos = [...]
const arrMatch = html.match(/(?:const|var|let)\s+productos\s*=\s*\[/m);
if (!arrMatch) { console.error('❌ No se encontró el array productos en el HTML'); process.exit(1); }
const arrStart = html.indexOf('[', arrMatch.index);
let depth = 0, arrEnd = -1;
for (let i = arrStart; i < html.length; i++) {
  if (html[i] === '[') depth++;
  else if (html[i] === ']' && --depth === 0) { arrEnd = i + 1; break; }
}

// Reconstruir cada bloque de producto
function fmtVal(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

const blocks = [];
for (let i = 0; i < lavadoras.length; i++) {
  const p  = lavadoras[i];
  const d  = results[i];
  const nombre = d?.nombre || p.nombre;
  const marca  = d?.marca  || p.marca  || '';
  const img    = d?.img    || p.img    || '';
  const prML   = p.precioML  != null ? p.precioML  : 'null';
  const prAmz  = p.precioAmz != null ? p.precioAmz : 'null';
  const est    = p.estrellas  != null ? p.estrellas  : 'null';
  const estML  = p.estrellasML != null ? p.estrellasML : 'null';
  const res    = p.resenas    != null ? p.resenas    : 'null';
  const resML  = p.resenasML  != null ? p.resenasML  : 'null';
  const capKg  = p.capacidadKg != null ? p.capacidadKg : 'null';
  const tipo   = p.tipo   ? JSON.stringify(p.tipo)   : 'null';
  const rpm    = p.rpm    != null ? p.rpm    : 'null';
  const tinas  = p.tinas  != null ? p.tinas  : 'null';
  const prof   = p.profundidad != null ? p.profundidad : 'null';

  blocks.push(
    `  { id: ${p.id}, mlId: ${JSON.stringify(p.mlId)}, nombre: ${JSON.stringify(nombre)}, marca: ${JSON.stringify(marca)}, tipo: ${tipo}, capacidadKg: ${capKg}, rpm: ${rpm}, tinas: ${tinas}, profundidad: ${prof}, precio: ${prML}, precioML: ${prML}, precioAmz: ${prAmz}, estrellas: ${est}, estrellasML: ${estML}, estrellasAmz: null, resenas: ${res}, resenasML: ${resML}, resenasAmz: null, badges: [{t:'ML',c:'b-ml'}], linkML: ${JSON.stringify(p.linkML)}, linkAmz: ${JSON.stringify(p.linkAmz || '')}, img: ${JSON.stringify(img)} }`
  );
}

const newArray = `[\n${blocks.join(',\n')}\n]`;
html = html.slice(0, arrStart) + newArray + html.slice(arrEnd);
writeFileSync(htmlPath, html);
console.log(`✅ electrodomesticos/lavadoras/index.html: array productos reescrito (${lavadoras.length} entradas)`);
