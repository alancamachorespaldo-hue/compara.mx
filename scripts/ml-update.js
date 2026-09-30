#!/usr/bin/env node
/**
 * ml-update.js — Actualiza precios ML en comparalo.mx
 * Flujo:
 *   1. /products/search → catalog product ID (activo o inactivo)
 *   2. Si inactivo → children_ids[0] como ID activo
 *   3. /products/{id}/items → precio mínimo
 *
 * Uso:
 *   node scripts/ml-update.js [--dry-run] [--categoria=bicis|suplementos|laptops|freidoras|microondas|all]
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPORT = [];   // acumula resultados de todas las categorías

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const CAT_ARG = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] ?? 'all';
const ROOT    = resolve(import.meta.dirname, '..');

const CATALOG = {
  bicis:       { file: 'bicis/index.html',                        varName: 'ELECTRICAS' },
  suplementos: { file: 'suplementos/index.html',                  varName: 'productos'  },
  laptops:     { file: 'laptops/index.html',                      varName: 'productos'  },
  freidoras:   { file: 'electrodomesticos/freidoras/index.html',  varName: 'productos'  },
  microondas:  { file: 'electrodomesticos/microondas/index.html', varName: 'micros'     },
};

const ENTRIES = CAT_ARG === 'all'
  ? Object.entries(CATALOG)
  : Object.entries(CATALOG).filter(([k]) => k === CAT_ARG);

// ── Token ────────────────────────────────────────────────────────────────────
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
  return (await res.json()).access_token;
}

// ── Buscar catalog product por nombre ────────────────────────────────────────
async function findCatalogProduct(nombre, marca, token) {
  const q = `${marca} ${nombre}`.trim().substring(0, 80);
  const url = `https://api.mercadolibre.com/products/search?site_id=MLM&q=${encodeURIComponent(q)}&limit=3`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

// ── Obtener precio mínimo para un catalog product ID ─────────────────────────
// Maneja tanto productos activos como inactivos (con children)
async function getMinPrice(productId, token) {
  // Intentar directo primero
  const iRes = await fetch(
    `https://api.mercadolibre.com/products/${productId}/items?limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (iRes.ok) {
    const iData = await iRes.json();
    const prices = (iData.results ?? [])
      .filter(i => i.condition === 'new' && i.price > 0)
      .map(i => i.price);
    if (prices.length) return Math.min(...prices);
    // fallback sin filtro de condición
    const allPrices = (iData.results ?? []).map(i => i.price).filter(p => p > 0);
    if (allPrices.length) return Math.min(...allPrices);
  }

  // Producto inactivo → buscar children
  const pRes = await fetch(
    `https://api.mercadolibre.com/products/${productId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!pRes.ok) return null;
  const prod = await pRes.json();

  const children = prod.children_ids ?? [];
  for (const cid of children.slice(0, 3)) {
    await new Promise(r => setTimeout(r, 200));
    const ciRes = await fetch(
      `https://api.mercadolibre.com/products/${cid}/items?limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!ciRes.ok) continue;
    const ciData = await ciRes.json();
    const prices = (ciData.results ?? []).map(i => i.price).filter(p => p > 0);
    if (prices.length) return Math.min(...prices);
  }
  return null;
}

// ── Extraer productos del array JS en el HTML ─────────────────────────────────
function extractProducts(html, varName) {
  const arrayMatch = html.match(
    new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*\\[`, 'mi')
  );
  if (!arrayMatch) return [];

  const start = html.indexOf('[', arrayMatch.index);
  let depth = 0, i = start, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return [];

  const arrayStr = html.slice(start, end + 1);
  const products = [];
  let blockStart = -1, bDepth = 0;
  for (let j = 0; j < arrayStr.length; j++) {
    if (arrayStr[j] === '{') { if (bDepth === 0) blockStart = j; bDepth++; }
    else if (arrayStr[j] === '}') {
      bDepth--;
      if (bDepth === 0 && blockStart !== -1) {
        const block = arrayStr.slice(blockStart, j + 1);
        const nombre = block.match(/nombre:\s*['"`]([^'"`\n]+)['"`]/)?.[1];
        const marca  = block.match(/marca:\s*['"`]([^'"`\n]+)['"`]/)?.[1] ?? '';
        // Preferir precioML (precio en ML) sobre precio genérico
        const precioML  = parseFloat(block.match(/\bprecioML:\s*([\d.]+)/)?.[1] ?? '0');
        const precioGen = parseFloat(block.match(/\bprecio:\s*([\d.]+)/)?.[1] ?? '0');
        const precio = precioML > 0 ? precioML : precioGen;
        if (nombre && precio > 0) products.push({ nombre, marca, precio });
        blockStart = -1;
      }
    }
  }
  const seen = new Set();
  return products.filter(p => { if (seen.has(p.nombre)) return false; seen.add(p.nombre); return true; });
}

// ── Parchear precio en HTML ───────────────────────────────────────────────────
function patchPrice(html, nombreExacto, nuevoPrecio) {
  const escapedNombre = nombreExacto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Preferir precioML si existe, si no usar precio
  const reML = new RegExp(
    `(nombre:\\s*['"\`]${escapedNombre}['"\`][\\s\\S]{0,400}?)(\\bprecioML:\\s*)(\\d+)`,
    'm'
  );
  const re = new RegExp(
    `(nombre:\\s*['"\`]${escapedNombre}['"\`][\\s\\S]{0,300}?)(\\bprecio:\\s*)(\\d+)`,
    'm'
  );
  const useRe = reML.test(html) ? reML : re;
  const match = html.match(useRe);
  if (!match) return { changed: false, html };
  const oldPrecio = parseInt(match[3]);
  if (oldPrecio === nuevoPrecio) return { changed: false, html };
  return {
    changed: true,
    html: html.replace(useRe, `$1$2${nuevoPrecio}`),
    oldPrecio,
    nuevoPrecio,
  };
}

// ── Procesar archivo ─────────────────────────────────────────────────────────
async function processFile(key, config, token) {
  const abs = resolve(ROOT, config.file);
  if (!existsSync(abs)) {
    console.log(`  ⚠ No encontrado: ${config.file}`);
    return;
  }
  let html = readFileSync(abs, 'utf8');
  const products = extractProducts(html, config.varName);
  if (products.length === 0) {
    console.log(`  ⚠ Sin productos (varName=${config.varName}): ${config.file}`);
    return;
  }

  console.log(`\n📄 ${config.file} — ${products.length} productos`);
  let changed = 0;

  for (const prod of products) {
    const label = `${prod.marca} ${prod.nombre}`.substring(0, 45).padEnd(45);
    process.stdout.write(`  🔍 ${label} `);

    await new Promise(r => setTimeout(r, 350)); // rate limit

    const mlProduct = await findCatalogProduct(prod.nombre, prod.marca, token);
    if (!mlProduct) {
      console.log('→ no encontrado');
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'no_encontrado', mlId: null, precioML: null });
      continue;
    }

    await new Promise(r => setTimeout(r, 250));
    const minPrice = await getMinPrice(mlProduct.id, token);

    if (!minPrice) {
      console.log(`→ ${mlProduct.id} sin precio`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'sin_precio', mlId: mlProduct.id, precioML: null });
      continue;
    }

    const { changed: didChange, html: patched, oldPrecio, nuevoPrecio } =
      patchPrice(html, prod.nombre, Math.round(minPrice));

    // Sanity check: ignorar si el precio nuevo es < 20% o > 400% del actual
    const ratio = Math.round(minPrice) / prod.precio;
    if (ratio < 0.2 || ratio > 4.0) {
      console.log(`⚠ $${prod.precio.toLocaleString()} → $${Math.round(minPrice).toLocaleString()} precio sospechoso (ratio ${ratio.toFixed(1)}x), ignorado`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'precio_sospechoso', mlId: mlProduct.id, precioML: Math.round(minPrice) });
      continue;
    }

    if (didChange) {
      html = patched;
      changed++;
      console.log(`✅ $${oldPrecio?.toLocaleString()} → $${nuevoPrecio?.toLocaleString()} (${mlProduct.id})`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: oldPrecio, precioNuevo: nuevoPrecio, estado: 'actualizado', mlId: mlProduct.id, precioML: Math.round(minPrice) });
    } else {
      console.log(`= $${prod.precio.toLocaleString()} (${mlProduct.id})`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'sin_cambio', mlId: mlProduct.id, precioML: Math.round(minPrice) });
    }
  }

  if (changed > 0 && !DRY_RUN) {
    writeFileSync(abs, html, 'utf8');
    console.log(`\n  💾 Guardado (${changed} precios actualizados)`);
  } else if (changed > 0) {
    console.log(`\n  🔍 DRY RUN — ${changed} cambios pendientes`);
  } else {
    console.log(`\n  ✓ Sin cambios`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  if (ENTRIES.length === 0) {
    console.error(`❌ Categoría "${CAT_ARG}". Opciones: ${Object.keys(CATALOG).join(', ')}, all`);
    process.exit(1);
  }
  console.log(`\n🛒 comparalo.mx — Actualizador ML`);
  console.log(`   Modo: ${DRY_RUN ? 'DRY RUN' : 'ESCRITURA'} · Categoría: ${CAT_ARG}\n`);

  let token;
  try {
    token = await getToken();
    console.log('🔑 Token OK\n');
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }

  const fecha = new Date().toISOString().slice(0, 10);

  for (const [key, config] of ENTRIES) {
    await processFile(key, config, token);
  }

  // Guardar reporte JSON
  if (!DRY_RUN) {
    const reportPath = resolve(ROOT, 'scripts/ml-report.json');
    const resumen = {
      fecha,
      generado: new Date().toISOString(),
      totales: {
        actualizados:      REPORT.filter(r => r.estado === 'actualizado').length,
        sin_cambio:        REPORT.filter(r => r.estado === 'sin_cambio').length,
        sin_precio:        REPORT.filter(r => r.estado === 'sin_precio').length,
        no_encontrado:     REPORT.filter(r => r.estado === 'no_encontrado').length,
        precio_sospechoso: REPORT.filter(r => r.estado === 'precio_sospechoso').length,
      },
      productos: REPORT,
    };
    writeFileSync(reportPath, JSON.stringify(resumen, null, 2), 'utf8');
    console.log(`📊 Reporte guardado en scripts/ml-report.json\n`);
  }

  console.log('\n✅ Listo\n');
})();
