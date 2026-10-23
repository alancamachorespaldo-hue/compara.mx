#!/usr/bin/env node
/**
 * fix-cafeteras-especs.mjs
 * Re-fetcha atributos de ML para las cafeteras nuevas y actualiza especs en merged-admin.json
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.mercadolibre.com';
const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getToken() {
  const rf = process.env.ML_REFRESH_TOKEN;
  if (rf) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: rf }),
    });
    if (r.ok) return (await r.json()).access_token;
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  return (await r.json()).access_token;
}

async function apiFetch(path, token) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
      if (r.ok) return r.json();
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i+1)); continue; }
      return null;
    } catch { await sleep(800 * (i+1)); }
  }
  return null;
}

function get(attrs, ...ids) {
  for (const id of ids) {
    const a = attrs.find(x => x.id === id);
    if (a?.value_name && a.value_name !== 'No aplica') return a.value_name;
  }
  return '';
}

function buildEspecs(attrs = [], nombre = '') {
  // Tipo de cafetera
  let tipo = get(attrs, 'COFFEE_MAKER_TYPES');
  // Normalizar tipo
  if (tipo) {
    tipo = tipo.replace(/^Expreso$/i, 'Espresso').replace(/^De goteo$/i, 'Goteo').replace(/^Percoladora$/i, 'Percoladora');
  }
  // Si no hay tipo, inferir del nombre
  if (!tipo) {
    const n = nombre.toLowerCase();
    if (/espresso|expreso|espres/i.test(n)) tipo = 'Espresso';
    else if (/goteo|drip|filter/i.test(n)) tipo = 'Goteo';
    else if (/percolador|urna|urn/i.test(n)) tipo = 'Percoladora';
    else if (/cápsula|capsul|nespresso|dolce|vertuo/i.test(n)) tipo = 'Cápsulas';
    else if (/superauto|super auto/i.test(n)) tipo = 'Espresso';
    else if (/molinillo|grinder/i.test(n)) tipo = 'Molinillo';
  }

  const tecnologia = get(attrs, 'TECHNOLOGY');
  const cap = get(attrs, 'WATER_CAPACITY', 'WATER_TANK_CAPACITY');
  // Presion: buscar en nombre si no hay atributo
  let pres = get(attrs, 'PRESSURE', 'PUMP_PRESSURE');
  if (!pres) {
    const m = nombre.match(/(\d+)\s*ba[rR]/);
    if (m) pres = m[1] + ' bar';
  }
  const vapAttr = get(attrs, 'WITH_VAPOUR_EMISSION');
  const vap = vapAttr === 'Sí' ? 'Sí' : '';
  const pot = get(attrs, 'POWER');
  // Compatible con cápsulas
  const comp = get(attrs, 'COMPATIBLE_CAPSULE_TYPE', 'CAPSULE_COMPATIBILITY');
  // Molinillo
  const molAttr = get(attrs, 'GRINDER', 'BUILT_IN_GRINDER', 'GRINDER_TYPE');
  let mol = '';
  if (molAttr && molAttr !== 'No') mol = 'Sí';
  else if (/molinillo|molino|grinder/i.test(nombre)) mol = 'Sí';

  const tazas = get(attrs, 'CUPS_CAPACITY');
  // Programable
  const progAttr = get(attrs, 'INCLUDES_TIMER');
  const prog = progAttr === 'Sí' ? 'Sí' : '';
  // Jarra
  const filtro = get(attrs, 'FILTER_TYPES');
  // Bebidas recomendadas
  const bebidas = get(attrs, 'RECOMMENDED_DRINKS');

  return { tipo, tecnologia, capacidad: cap, presion: pres, vaporizador: vap, potencia: pot, compatible: comp, molinillo: mol, tazas, programable: prog, filtro, bebidas };
}

function getImage(prod, firstItemId) {
  const pics = prod?.pictures || prod?.main_pictures || [];
  for (const p of pics) {
    const url = p.url || p.secure_url || '';
    if (url) return url;
  }
  return '';
}

async function main() {
  const token = await getToken();
  console.log('🔑 Token OK\n');

  const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
  const admin = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));

  // IDs a reparar: los que tienen especs.tipo vacío (todos los nuevos)
  const toFix = admin.cafeteras.filter(p => !p.especs?.tipo);
  console.log(`Reparando especs de ${toFix.length} cafeteras...`);

  for (let i = 0; i < toFix.length; i++) {
    const p = toFix[i];
    process.stdout.write(`[${i+1}/${toFix.length}] ${p.mlId} ... `);

    const prod = await apiFetch(`/products/${p.mlId}`, token);
    if (!prod) { console.log('❌ no encontrado'); await sleep(300); continue; }

    // Actualizar imagen si falta
    if (!p.imagen) {
      const img = getImage(prod);
      if (img) p.imagen = img;
    }

    // Actualizar nombre si es genérico
    if (!p.nombre || p.nombre === p.mlId) {
      p.nombre = (prod.name || prod.short_name || p.nombre || p.mlId).trim();
    }

    // Marca
    if (!p.marca) {
      const brandAttr = (prod.attributes || []).find(a => a.id === 'BRAND');
      p.marca = brandAttr?.value_name || prod.brand || '';
    }

    // Estrellas y reseñas
    if (!p.estrellas && prod.reviews?.rating_average) {
      p.estrellas = Math.round(prod.reviews.rating_average * 10) / 10;
    }
    if (!p.resenas && prod.reviews?.total) {
      p.resenas = prod.reviews.total;
    }

    // Especs completos
    const attrs = prod.attributes || [];
    p.especs = buildEspecs(attrs, p.nombre);

    console.log(`✓ tipo:${p.especs.tipo||'?'} | cap:${p.especs.capacidad||'—'} | ${p.especs.potencia||'—'}`);
    await sleep(180);
  }

  writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
  console.log(`\n✓ merged-admin.json actualizado con especs de ${toFix.length} cafeteras`);
}

main().catch(e => { console.error(e); process.exit(1); });
