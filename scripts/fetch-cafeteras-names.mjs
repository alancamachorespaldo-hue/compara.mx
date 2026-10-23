/**
 * Fetches real product names from ML items (not catalog) for cafeteras
 * and rebuilds the cafeteras/index.html products array.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';

const ROOT = 'C:/Users/alanc/Downloads/GestorCompara';
const API = 'https://api.mercadolibre.com';
const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ML_REFRESH_TOKEN;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getToken() {
  if (REFRESH_TOKEN) {
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN }),
    });
    if (res.ok) return (await res.json()).access_token;
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await res.json()).access_token;
}

async function apiFetch(path, token) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Extraer nombre limpio del primer ítem disponible en el catálogo
async function fetchName(mlId, token) {
  const data = await apiFetch(`/products/${mlId}/items?limit=5`, token);
  const results = data?.results;
  if (results?.length) {
    // Prefer new items with fulfillment, then any new, then any
    const sorted = [...results].sort((a, b) => {
      const af = a.shipping?.logistic_type === 'fulfillment' ? 0 : 1;
      const bf = b.shipping?.logistic_type === 'fulfillment' ? 0 : 1;
      return af - bf;
    });
    const item = sorted[0];
    if (item?.title) return { title: item.title, brand: item.attributes?.find(a => a.id === 'BRAND')?.value_name || '' };
  }
  // Fallback: catalog product name
  const prod = await apiFetch(`/products/${mlId}`, token);
  if (prod?.name) {
    // ML catalog names are sometimes PascalCase — insert spaces
    const fixed = prod.name
      .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2')
      .replace(/([A-ZÁÉÍÓÚÜÑ]+)([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ])/g, '$1 $2');
    const brand = prod.attributes?.find(a => a.id === 'BRAND')?.value_name || '';
    // Also extract specs from attributes
    const attrs = prod.attributes || [];
    const getAttr = (id) => attrs.find(a => a.id === id)?.value_name || '';
    return {
      title: fixed,
      brand,
      tipo: getAttr('TYPE_OF_COFFEE_MAKER'),
      capacidad: getAttr('CAPACITY_VOLUME'),
      presion: getAttr('EXTRACTION_PRESSURE'),
      vaporizador: getAttr('INCLUDES_MILK_FROTHER'),
      molinillo: getAttr('INCLUDES_GRINDER'),
    };
  }
  return null;
}

// Infer tipo from name if not set
function inferTipo(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes('nespresso') || n.includes('cápsula') || n.includes('capsula') || n.includes('dolce gusto')) return 'Cápsulas';
  if (n.includes('espresso') || n.includes('expresso')) return 'Espresso';
  if (n.includes('goteo') || n.includes('drip') || n.includes('filtro')) return 'Goteo';
  if (n.includes('prensa francesa') || n.includes('french press')) return 'Prensa francesa';
  if (n.includes('moka') || n.includes('stovetop')) return 'Moka';
  if (n.includes('percolador') || n.includes('percoladora')) return 'Percolador';
  if (n.includes('pour over') || n.includes('pour-over')) return 'Pour over';
  if (n.includes('molinillo') || n.includes('molino de café')) return 'Molinillo';
  return '';
}

(async () => {
  const token = await getToken();
  console.log('Token OK');

  const adminPath = `${ROOT}/scripts/merged-admin.json`;
  const data = JSON.parse(readFileSync(adminPath, 'utf8'));
  const cafeteras = data.cafeteras;

  for (let i = 0; i < cafeteras.length; i++) {
    const p = cafeteras[i];
    if (!p.mlId || !/^MLM\d{6,12}$/.test(p.mlId)) continue;

    const result = await fetchName(p.mlId, token);
    if (result?.title) {
      cafeteras[i].nombre = result.title;
      if (result.brand) cafeteras[i].marca = result.brand;
      if (result.tipo) cafeteras[i].especs.tipo = result.tipo;
      if (result.capacidad) cafeteras[i].especs.capacidad = result.capacidad;
      if (result.presion) cafeteras[i].especs.presion = result.presion;
      if (result.vaporizador) cafeteras[i].especs.vaporizador = result.vaporizador;
      if (result.molinillo) cafeteras[i].especs.molinillo = result.molinillo;
      // infer tipo if still empty
      if (!cafeteras[i].especs.tipo) {
        cafeteras[i].especs.tipo = inferTipo(result.title);
      }
      console.log(`  ✓ [${p.mlId}] → ${result.title.slice(0, 60)}`);
    } else {
      console.log(`  ✗ [${p.mlId}] sin nombre`);
    }
    if (i % 5 === 4) await sleep(300);
  }

  // Apply ml-report.json prices
  const reportPath = `${ROOT}/scripts/ml-report.json`;
  let report = {};
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch {}
  cafeteras.forEach(p => {
    const r = report[p.id];
    if (r?.precio_nuevo) p.precioML = r.precio_nuevo;
  });

  writeFileSync(adminPath, JSON.stringify(data, null, 2));
  console.log('\n✅ merged-admin.json actualizado');

  // Rebuild the cafeteras HTML productos array
  const htmlPath = `${ROOT}/electrodomesticos/cafeteras/index.html`;
  let html = readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n');

  const activeCafeteras = cafeteras.filter(p => p.activo !== false);
  const newArray = JSON.stringify(activeCafeteras, null, 2);

  // Replace const productos = [...] in the HTML
  const arrayRe = /(const productos\s*=\s*)\[[\s\S]*?\](\s*;)/;
  if (!arrayRe.test(html)) {
    console.error('❌ No se encontró const productos = [...] en el HTML');
    process.exit(1);
  }
  html = html.replace(arrayRe, (_, pre, post) => pre + newArray + post);

  // Update JSON-LD ItemList
  const jldRe = /("@type":\s*"ItemList"[\s\S]*?"itemListElement":\s*\[)([\s\S]*?)(\])/;
  const newItems = activeCafeteras.map((p, i) =>
    `\n        { "@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(p.nombre)} }`
  ).join(',');
  html = html.replace(jldRe, (_, pre, _old, post) => pre + newItems + '\n      ' + post);

  writeFileSync(htmlPath, html);
  console.log(`✅ cafeteras/index.html actualizado con ${activeCafeteras.length} productos`);
})();
