#!/usr/bin/env node
/**
 * explorar-ml.js — Busca productos nuevos en ML y los agrega a merged-admin.json
 *
 * Uso:
 *   node scripts/explorar-ml.js --categoria=laptops
 *   node scripts/explorar-ml.js --categoria=laptops --dry-run   (solo muestra, no guarda)
 *   node scripts/explorar-ml.js --categoria=laptops --limit=30  (máx resultados por búsqueda)
 *
 * Categorías disponibles: laptops, freidoras, microondas, bicis, suplementos
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT     = resolve(import.meta.dirname, '..');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const DRY_RUN  = process.argv.includes('--dry-run');
const CAT_ARG  = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? 'laptops';
const LIMIT    = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '50');

const QUERIES = {
  laptops: [
    'laptop HP', 'laptop Lenovo', 'laptop ASUS', 'laptop Acer',
    'laptop Dell', 'MacBook', 'laptop MSI', 'laptop gaming',
    'laptop Chromebook', 'laptop ultrabook',
  ],
  freidoras: [
    'freidora de aire', 'air fryer digital', 'freidora horno',
    'freidora dual', 'air fryer vidrio',
  ],
  microondas: [
    'microondas', 'horno microondas digital', 'microondas espejo',
  ],
  bicis: [
    'bicicleta eléctrica plegable', 'bicicleta eléctrica ciudad',
    'ebike 48v', 'bicicleta electrica adulto',
  ],
  suplementos: [
    'omega 3 capsulas', 'complejo b vitaminas', 'proteína whey',
    'colágeno hidrolizado', 'vitamina D3',
  ],
};

if (!QUERIES[CAT_ARG]) {
  console.error(`❌ Categoría "${CAT_ARG}". Disponibles: ${Object.keys(QUERIES).join(', ')}`);
  process.exit(1);
}

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;

if (!REFRESH_TOKEN) { console.error('❌ Falta ML_REFRESH_TOKEN en .env'); process.exit(1); }

async function getToken() {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Devuelve { price, itemId, permalink } del ítem más barato del catálogo
async function getBestItem(productId, token) {
  const res = await fetch(
    `https://api.mercadolibre.com/products/${productId}/items?limit=8`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items = (data.results ?? []).filter(i => i.price > 0);
  if (!items.length) return null;
  items.sort((a, b) => a.price - b.price);
  const best = items[0];
  const itemId = best.item_id;
  // Fetch permalink del ítem (URL individual que acepta el programa de afiliados)
  try {
    const itemRes = await fetch(
      `https://api.mercadolibre.com/items/${itemId}?attributes=permalink`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (itemRes.ok) {
      const itemData = await itemRes.json();
      return { price: best.price, itemId, permalink: itemData.permalink ?? null };
    }
  } catch { /* no permalink, usa URL corta */ }
  return { price: best.price, itemId, permalink: `https://www.mercadolibre.com.mx/${itemId}` };
}

async function getProductDetails(productId, token) {
  const res = await fetch(
    `https://api.mercadolibre.com/products/${productId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// Normaliza nombre para comparación (minúsculas, sin puntuación extra)
function normalizar(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Palabras que indican que NO es una laptop sino un accesorio
const EXCLUIR_PALABRAS = [
  'bisagra', 'mochila', 'maletín', 'maletin', 'cargador', 'bateria', 'batería',
  'tornillo', 'pantalla', 'teclado', 'candado', 'funda', 'soporte',
  'mouse ', 'auricular', 'audífono', 'adaptador', 'hub usb', 'ratón',
  'cooling fan', 'ventilador', 'memoria ram ', 'disco duro', 'bocina',
  'smartwatch', 'tablet ', 'proyector', 'drone', 'reflector',
];
function esAccesorio(nombre) {
  const n = nombre.toLowerCase();
  return EXCLUIR_PALABRAS.some(p => n.includes(p));
}

// Extrae especificaciones completas de los atributos ML
function extraerEspecs(attributes = []) {
  const especs = {};
  const map = {
    procesador:     ['PROCESSOR_MODEL', 'PROCESSOR_BRAND'],
    ram:            ['RAM', 'TOTAL_RAM_INSTALLED', 'RAM_MEMORY'],
    almacenamiento: ['INTERNAL_MEMORY', 'SSD_CAPACITY', 'HDD_CAPACITY', 'STORAGE_CAPACITY'],
    pantalla:       ['SCREEN_SIZE', 'DISPLAY_SIZE'],
    resolucion:     ['DISPLAY_RESOLUTION', 'DISPLAY_RESOLUTION_TYPE'],
    gpu:            ['VIDEO_RAM', 'GPU_MODEL', 'GRAPHICS_CARD_TYPE'],
    so:             ['OPERATING_SYSTEM'],
    peso:           ['WEIGHT', 'ITEM_WEIGHT'],
    bateria:        ['BATTERY_CAPACITY', 'BATTERY_DURATION'],
    touch:          ['TOUCHSCREEN'],
    color:          ['COLOR'],
  };
  for (const [key, ids] of Object.entries(map)) {
    for (const id of ids) {
      const attr = attributes.find(a => a.id === id);
      if (attr?.value_name) { especs[key] = attr.value_name; break; }
    }
  }
  return especs;
}

// ── Main ────────────────────────────────────────────────────────────────────
const token = await getToken();
console.log('🔑 Token OK\n');

const adminData = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
const existentes = adminData[CAT_ARG] ?? [];

// Construir set de nombres normalizados existentes
const nombresExistentes = new Set(existentes.map(p => normalizar(p.nombre)));
// También IDs ML existentes
const idsExistentes = new Set(
  existentes
    .map(p => p.linkML?.match(/MLM\d+/)?.[0])
    .filter(Boolean)
);

console.log(`🔍 Buscando ${CAT_ARG} nuevos en ML...`);
console.log(`   Productos existentes: ${existentes.length}\n`);

const candidatos = new Map(); // id → producto

for (const query of QUERIES[CAT_ARG]) {
  const url = `https://api.mercadolibre.com/products/search?site_id=MLM&q=${encodeURIComponent(query)}&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { console.warn(`  ⚠ Búsqueda fallida: "${query}"`); continue; }
  const data = await res.json();
  const results = data.results ?? [];
  process.stdout.write(`  "${query}" → ${results.length} resultados\n`);

  for (const p of results) {
    if (candidatos.has(p.id)) continue;
    if (idsExistentes.has(p.id)) continue;
    const nombre = p.name ?? p.title ?? '';
    if (!nombre) continue;
    if (esAccesorio(nombre)) continue;
    const marca = p.attributes?.find(a => a.id === 'BRAND')?.value_name ?? '';
    if (nombresExistentes.has(normalizar(nombre))) continue;
    candidatos.set(p.id, { id: p.id, nombre, marca, query });
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n📦 ${candidatos.size} candidatos únicos sin precio verificado\n`);

// Verificar precio y detalles para cada candidato
const nuevos = [];
let verificados = 0;

for (const [id, cand] of candidatos) {
  verificados++;
  process.stdout.write(`  [${verificados}/${candidatos.size}] ${cand.nombre.substring(0, 50)}...`);

  const bestItem = await getBestItem(id, token);
  if (!bestItem) {
    process.stdout.write(' sin precio\n');
    await new Promise(r => setTimeout(r, 200));
    continue;
  }

  const detalle = await getProductDetails(id, token);
  const imagen = detalle?.pictures?.[0]?.url ?? detalle?.thumbnail ?? null;
  const especs = extraerEspecs(detalle?.attributes ?? []);
  // linkML = permalink del ítem individual (válido para programa de afiliados ML)
  // linkCatalogo = URL de catálogo (útil como referencia)
  const linkML = bestItem.permalink ?? `https://www.mercadolibre.com.mx/${bestItem.itemId}`;

  process.stdout.write(` ✅ $${bestItem.price.toLocaleString('es-MX')} [${bestItem.itemId}]\n`);
  nuevos.push({
    id:          `exp_${id}`,
    nombre:      cand.nombre,
    marca:       cand.marca || '',
    linkML,
    linkAmz:     null,
    precioML:    Math.round(bestItem.price),
    precioAmz:   null,
    imagen:      imagen ?? null,
    especs,
    activo:      true,
    estadoML:    'nuevo',
    _mlItemId:   bestItem.itemId,
    _mlCatalogo: `https://www.mercadolibre.com.mx/p/${id}`,
    _updatedAt:  new Date().toISOString(),
  });

  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✨ ${nuevos.length} productos nuevos con precio encontrados`);

if (nuevos.length === 0) {
  console.log('ℹ Sin productos nuevos para agregar.');
  process.exit(0);
}

// Mostrar resumen
console.log('\n─'.repeat(60));
nuevos.forEach((p, i) => {
  console.log(`${i + 1}. ${p.marca} ${p.nombre.substring(0, 50)}`);
  console.log(`   💰 $${p.precioML.toLocaleString('es-MX')}  🔗 ${p.linkML}`);
  if (p.especs?.procesador) console.log(`   CPU: ${p.especs.procesador}`);
  if (p.especs?.ram) console.log(`   RAM: ${p.especs.ram}`);
  if (p.especs?.almacenamiento) console.log(`   SSD: ${p.especs.almacenamiento}`);
  if (p.especs?.pantalla) console.log(`   Pantalla: ${p.especs.pantalla}"`);
  if (p.especs?.so) console.log(`   OS: ${p.especs.so}`);
  console.log('');
});

if (DRY_RUN) {
  console.log('🔍 DRY RUN — no se guardaron cambios.');
  process.exit(0);
}

// Agregar al inicio de la categoría (para que aparezcan primero en el artifact)
adminData[CAT_ARG] = [...nuevos, ...existentes];
writeFileSync(ADMIN_PATH, JSON.stringify(adminData, null, 2), 'utf8');
console.log(`✅ ${nuevos.length} productos agregados a merged-admin.json → categoría "${CAT_ARG}"`);
console.log('   Próximo paso: node scripts/generar-admin.js  para refrescar el artifact');
