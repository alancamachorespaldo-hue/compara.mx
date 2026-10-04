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
  laptops:    { file: 'laptops/index.html',                        varName: 'productos'  },
  freidoras:  { file: 'electrodomesticos/freidoras/index.html',    varName: 'productos'  },
  bicis:      { file: 'bicis/index.html',                          varName: 'ELECTRICAS' },
  microondas: { file: 'electrodomesticos/microondas/index.html',   varName: 'micros'     },
  proteina:   { file: 'suplementos/proteina/index.html',           varName: 'productos'  },
  omega3:     { file: 'suplementos/omega3/index.html',             varName: 'productos'  },
  magnesio:   { file: 'suplementos/magnesio/index.html',           varName: 'productos'  },
  creatina:   { file: 'suplementos/creatina/index.html',           varName: 'productos'  },
  complejo_b: { file: 'suplementos/complejo-b/index.html',         varName: 'PRODUCTOS'  },
};

const SUPLEMENTOS = ['proteina', 'omega3', 'magnesio', 'creatina', 'complejo_b'];

const ENTRIES =
  CAT_ARG === 'all'         ? Object.entries(CATALOG) :
  CAT_ARG === 'suplementos' ? SUPLEMENTOS.map(k => [k, CATALOG[k]]) :
  Object.entries(CATALOG).filter(([k]) => k === CAT_ARG);

// ── Token ────────────────────────────────────────────────────────────────────
async function getToken() {
  const refreshToken = process.env.ML_REFRESH_TOKEN;

  if (refreshToken) {
    // OAuth de usuario: acceso completo a items y búsqueda
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log('🔑 Token OAuth de usuario OK (refresh_token)\n');
      return data.access_token;
    }
    console.warn(`⚠ refresh_token falló (${res.status}) — usando client_credentials como fallback\n`);
  }

  // Fallback: client_credentials (solo catalog products, sin items individuales)
  console.warn('⚠ ML_REFRESH_TOKEN no encontrado — usando client_credentials (acceso limitado)\n');
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

// ── Obtener precio directo desde un link de ML (meli.la o URL completa) ────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getPriceFromLink(url, token) {
  try {
    // 1. Extraer MLM ID directamente de la URL original (evita problemas de redirect)
    let mlmId = url.match(/\bMLM\d{6,}\b/i)?.[0]?.toUpperCase();
    const isCatalogUrl = url.includes('/p/MLM');

    // Si la URL original tiene el ID y es una URL de catálogo, usarla directo
    if (mlmId && isCatalogUrl) {
      const price = await getMinPrice(mlmId, token);
      return price ? { price, itemId: mlmId } : null;
    }

    // 2. Para URLs cortas o sin ID claro, seguir redirects
    let finalUrl = url;
    for (let i = 0; i < 4; i++) {
      const res = await fetch(finalUrl, {
        redirect: 'manual',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      const loc = res.headers.get('location');
      if (!loc) break;
      finalUrl = loc.startsWith('http') ? loc : new URL(loc, finalUrl).href;
    }

    // 3. Extraer ID de la URL final si no se encontró antes
    if (!mlmId) mlmId = finalUrl.match(/\bMLM\d{6,}\b/i)?.[0]?.toUpperCase();

    // 4. Si aún no hay ID, buscar en HTML de la página
    if (!mlmId) {
      const pageRes = await fetch(finalUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      const html = await pageRes.text();
      mlmId = (
        html.match(/data-item-id=[\"'](MLM\d+)[\"']/i)?.[1] ||
        html.match(/\"itemId\":\s*\"(MLM\d+)\"/i)?.[1] ||
        html.match(/\"item_id\":\s*\"(MLM\d+)\"/i)?.[1]
      )?.toUpperCase();
    }

    if (!mlmId) return null;

    // 5. URL tipo /p/MLM... → catalog product → usar getMinPrice
    if (finalUrl.includes('/p/MLM')) {
      const price = await getMinPrice(mlmId, token);
      return price ? { price, itemId: mlmId } : null;
    }

    // 6. URL de item individual → /items/{id}
    const itemRes = await fetch(`https://api.mercadolibre.com/items/${mlmId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!itemRes.ok) return null;
    const item = await itemRes.json();
    return item.price > 0 ? { price: item.price, itemId: mlmId } : null;
  } catch { return null; }
}

// ── Buscar precio de item via search API (requiere OAuth de usuario) ─────────
async function searchItemPrice(nombre, marca, token) {
  try {
    const q = `${marca} ${nombre}`.trim().substring(0, 80);
    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLM/search?q=${encodeURIComponent(q)}&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.results?.[0];
    return first?.price > 0 ? { price: first.price, itemId: first.id } : null;
  } catch { return null; }
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

  // Índice de merged-admin.json para obtener linkML por nombre
  const adminPath = resolve(ROOT, 'scripts/merged-admin.json');
  const adminIndex = {};
  try {
    const adminData = JSON.parse(readFileSync(adminPath, 'utf8'));
    for (const p of (adminData[key] ?? [])) adminIndex[p.nombre] = p;
  } catch {}

  console.log(`\n📄 ${config.file} — ${products.length} productos`);
  let changed = 0;

  for (const prod of products) {
    const adminProd = adminIndex[prod.nombre];

    // Saltar productos nuevos del explorador (no tienen precio publicado en el sitio)
    if (adminProd?.estadoML === 'nuevo') {
      process.stdout.write(`  ⏭ ${`${prod.marca} ${prod.nombre}`.substring(0, 45).padEnd(45)} (nuevo, omitido)\n`);
      continue;
    }

    const label = `${prod.marca} ${prod.nombre}`.substring(0, 45).padEnd(45);
    process.stdout.write(`  🔍 ${label} `);

    await new Promise(r => setTimeout(r, 350)); // rate limit

    const linkML = adminProd?.linkML;
    let mlProductId = null;
    let minPrice = null;

    if (linkML) {
      // Usar el link directo del producto para obtener precio exacto
      const result = await getPriceFromLink(linkML, token);
      if (result) {
        minPrice = result.price;
        mlProductId = result.itemId;
      } else {
        console.log(`→ link sin precio (${linkML})`);
        REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'sin_precio', mlId: null, precioML: null });
        continue;
      }
    } else {
      // Primero: búsqueda por nombre en catálogo
      const mlProduct = await findCatalogProduct(prod.nombre, prod.marca, token);
      if (!mlProduct) {
        // Fallback con search API (solo disponible con OAuth de usuario)
        await new Promise(r => setTimeout(r, 200));
        const searchResult = await searchItemPrice(prod.nombre, prod.marca, token);
        if (!searchResult) {
          console.log('→ no encontrado');
          REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'no_encontrado', mlId: null, precioML: null });
          continue;
        }
        minPrice = searchResult.price;
        mlProductId = searchResult.itemId;
      } else {
        mlProductId = mlProduct.id;
        await new Promise(r => setTimeout(r, 250));
        minPrice = await getMinPrice(mlProduct.id, token);
        // Si catalog no tiene precio, intentar search API
        if (!minPrice && process.env.ML_REFRESH_TOKEN) {
          await new Promise(r => setTimeout(r, 200));
          const searchResult = await searchItemPrice(prod.nombre, prod.marca, token);
          if (searchResult) { minPrice = searchResult.price; mlProductId = searchResult.itemId; }
        }
      }
    }

    if (!minPrice) {
      console.log(`→ ${mlProductId} sin precio`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'sin_precio', mlId: mlProductId, precioML: null });
      continue;
    }

    const { changed: didChange, html: patched, oldPrecio, nuevoPrecio } =
      patchPrice(html, prod.nombre, Math.round(minPrice));

    // Sanity check: ignorar si el precio nuevo es < 20% o > 400% del actual
    const ratio = Math.round(minPrice) / prod.precio;
    if (ratio < 0.2 || ratio > 4.0) {
      console.log(`⚠ $${prod.precio.toLocaleString()} → $${Math.round(minPrice).toLocaleString()} precio sospechoso (ratio ${ratio.toFixed(1)}x), ignorado`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'precio_sospechoso', mlId: mlProductId, precioML: Math.round(minPrice) });
      continue;
    }

    if (didChange) {
      html = patched;
      changed++;
      console.log(`✅ $${oldPrecio?.toLocaleString()} → $${nuevoPrecio?.toLocaleString()} (${mlProductId})`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: oldPrecio, precioNuevo: nuevoPrecio, estado: 'actualizado', mlId: mlProductId, precioML: Math.round(minPrice) });
    } else {
      console.log(`= $${prod.precio.toLocaleString()} (${mlProductId})`);
      REPORT.push({ categoria: key, nombre: prod.nombre, marca: prod.marca, precioAntes: prod.precio, estado: 'sin_cambio', mlId: mlProductId, precioML: Math.round(minPrice) });
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
    console.error(`❌ Categoría "${CAT_ARG}". Opciones: ${Object.keys(CATALOG).join(', ')}, suplementos, all`);
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
