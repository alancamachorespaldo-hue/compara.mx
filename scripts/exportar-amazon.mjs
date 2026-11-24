#!/usr/bin/env node
/**
 * exportar-amazon.mjs — saca una copia de SOLO LECTURA del Centro de Productos
 * Amazon (Supabase) y la deja en scripts/amazon-datos.json, que es lo que lee el
 * módulo "Guías Amazon" del Centro de Control.
 *
 *   node scripts/exportar-amazon.mjs                  # usa ./.env.local
 *   node scripts/exportar-amazon.mjs --env="C:\\ruta\\.env.local"
 *
 * Solo hace GET. No escribe nada en Supabase y la clave nunca sale de aquí:
 * el JSON que genera no contiene credenciales.
 *
 * Tablas (migración 001 y siguientes): amazon_categories, amazon_products,
 * amazon_product_observations, amazon_guide_packages, amazon_guide_package_items.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');

const envPath = arg('env') || path.join(RAIZ, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`No encontré ${envPath}.\nCrea .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, o pásalo con --env=<ruta>.`);
  process.exit(1);
}
const env = {};
for (const linea of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_BASE = (env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!URL_BASE || !KEY) { console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ' + envPath); process.exit(1); }

async function tabla(nombre, query = 'select=*') {
  const r = await fetch(`${URL_BASE}/rest/v1/${nombre}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i;
const TAG_BUENO = 'guiasdecomp01-20';
const TAGS_MUERTOS = ['comparalo20-20', 'comparabici-20'];

function estadoLink(url) {
  const v = String(url || '').trim();
  if (!v) return 'sin_link';
  let u;
  try { u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); } catch { return 'invalido'; }
  if (!/amazon\.com\.mx$|amzn\.to$|link\.amazon\.|amazon\.com$/i.test(u.hostname)) return 'invalido';
  const tag = u.searchParams.get('tag');
  if (tag && TAGS_MUERTOS.includes(tag)) return 'tag_viejo';
  if (tag && tag !== TAG_BUENO) return 'tag_ajeno';
  if (tag === TAG_BUENO) return 'ok';
  return /amzn\.to$|link\.amazon\./i.test(u.hostname) ? 'corto' : 'sin_tag';
}

const [cats, prods, obs, paquetes, items] = await Promise.all([
  tabla('amazon_categories', 'select=*&order=sort_order'),
  tabla('amazon_products', 'select=*&order=created_at.desc'),
  tabla('amazon_product_observations', 'select=*&order=observed_at.desc'),
  tabla('amazon_guide_packages', 'select=*&order=created_at.desc'),
  tabla('amazon_guide_package_items', 'select=*&order=sort_order'),
]);

const nombreCat = (id) => cats.find((c) => c.id === id)?.name || 'Sin categoría';
const slugCat = (id) => cats.find((c) => c.id === id)?.slug || null;

const precioDe = (pid) => {
  const o = obs.filter((x) => x.product_id === pid && x.observation_type === 'price');
  if (!o.length) return { precio: null, fecha: null, n: 0 };
  return { precio: Number(o[0].amount), fecha: o[0].observed_at, n: o.length };
};

const vistoAsin = new Map();
const productos = prods.map((p) => {
  const asin = (p.asin || '').trim().toUpperCase() ||
    (ASIN_RE.exec(p.product_url || '')?.[1] || ASIN_RE.exec(p.affiliate_url || '')?.[1] || '').toUpperCase();
  const pr = precioDe(p.id);
  const a = p.attributes || {};
  if (asin) vistoAsin.set(asin, (vistoAsin.get(asin) || 0) + 1);
  return {
    id: p.id,
    nombre: p.name,
    marca: p.brand || null,
    modelo: p.model || null,
    asin: asin || null,
    asinDeclarado: !!(p.asin || '').trim(),
    categoria: nombreCat(p.category_id),
    catSlug: slugCat(p.category_id),
    estado: p.review_status,
    captura: p.capture_method,
    linkProducto: p.product_url || null,
    linkAfiliado: p.affiliate_url || null,
    estadoLink: estadoLink(p.affiliate_url),
    imagen: p.image_url || null,
    precio: pr.precio,
    precioFecha: pr.fecha,
    precioObs: pr.n,
    notas: p.internal_notes || null,
    familia: a.family ?? null,
    anio: a.model_year ?? null,
    condicion: a.condition ?? null,
    vendedor: a.seller ?? null,
    garantia: a.warranty ?? null,
    rating: a.mobile?.rating ?? a.laptop?.rating ?? null,
    resenas: a.mobile?.review_count ?? a.laptop?.review_count ?? null,
    mobile: a.mobile && Object.keys(a.mobile).length ? a.mobile : null,
    laptop: a.laptop && Object.keys(a.laptop).length ? a.laptop : null,
    atributos: Object.fromEntries(Object.entries(a).filter(([k]) => !['mobile', 'laptop'].includes(k))),
    creado: p.created_at,
    actualizado: p.updated_at,
  };
});
for (const p of productos) p.asinDuplicado = !!(p.asin && vistoAsin.get(p.asin) > 1);

const ESTADOS = ['pending', 'in_review', 'verified', 'ready', 'archived'];
const cuenta = (f) => productos.filter(f).length;

const categorias = cats.map((c) => {
  const l = productos.filter((p) => p.catSlug === c.slug);
  return {
    slug: c.slug, nombre: c.name, activa: c.is_active, orden: c.sort_order,
    total: l.length,
    listos: l.filter((p) => p.estado === 'ready').length,
    pendientes: l.filter((p) => p.estado === 'pending').length,
    sinLink: l.filter((p) => p.estadoLink === 'sin_link').length,
    sinAsin: l.filter((p) => !p.asin).length,
    conPrecio: l.filter((p) => p.precio != null).length,
  };
}).sort((a, b) => b.total - a.total);

const guias = paquetes.map((g) => {
  const ids = items.filter((i) => i.package_id === g.id);
  const prodsG = ids.map((i) => productos.find((p) => p.id === i.product_id)).filter(Boolean);
  return {
    id: g.id, titulo: g.title, categoria: nombreCat(g.category_id), tema: g.topic || null,
    estado: g.status, instrucciones: g.editorial_instructions || null,
    creado: g.created_at, actualizado: g.updated_at,
    productos: prodsG.map((p, i) => ({
      id: p.id, nombre: p.nombre, asin: p.asin, estado: p.estado, estadoLink: p.estadoLink,
      precio: p.precio, nota: ids[i]?.editorial_note || null,
    })),
    listos: prodsG.filter((p) => p.estado === 'ready' && p.estadoLink === 'ok').length,
    bloqueados: prodsG.filter((p) => p.estadoLink !== 'ok' || !p.asin).length,
  };
});

const salida = {
  generado: new Date().toISOString(),
  origen: { proyecto: URL_BASE.replace(/^https?:\/\//, '').split('.')[0], tablas: 5 },
  totales: {
    productos: productos.length,
    categorias: categorias.filter((c) => c.total > 0).length,
    categoriasTotales: categorias.length,
    ...Object.fromEntries(ESTADOS.map((e) => [e, cuenta((p) => p.estado === e)])),
    sinAsin: cuenta((p) => !p.asin),
    asinDuplicado: cuenta((p) => p.asinDuplicado),
    sinLink: cuenta((p) => p.estadoLink === 'sin_link'),
    linkSinTag: cuenta((p) => ['sin_tag', 'corto'].includes(p.estadoLink)),
    linkTagViejo: cuenta((p) => ['tag_viejo', 'tag_ajeno'].includes(p.estadoLink)),
    linkInvalido: cuenta((p) => p.estadoLink === 'invalido'),
    linkOk: cuenta((p) => p.estadoLink === 'ok'),
    conPrecio: cuenta((p) => p.precio != null),
    observaciones: obs.length,
    guias: guias.length,
    guiasPublicadas: guias.filter((g) => g.estado === 'published').length,
  },
  categorias,
  guias,
  productos,
};

const dest = path.join(RAIZ, 'scripts', 'amazon-datos.json');
fs.writeFileSync(dest, JSON.stringify(salida));
const t = salida.totales;
console.log(`amazon-datos.json escrito (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
console.log(`  ${t.productos} productos en ${t.categorias} categorías · ${t.observaciones} observaciones de precio`);
console.log(`  estados: pending ${t.pending} · in_review ${t.in_review} · verified ${t.verified} · ready ${t.ready} · archived ${t.archived}`);
console.log(`  enlaces: ok ${t.linkOk} · sin link ${t.sinLink} · sin tag/corto ${t.linkSinTag} · tag viejo o ajeno ${t.linkTagViejo} · inválido ${t.linkInvalido}`);
console.log(`  ASIN: ${t.sinAsin} sin ASIN · ${t.asinDuplicado} repetidos`);
console.log(`  guías: ${t.guias} (${t.guiasPublicadas} publicadas)`);
