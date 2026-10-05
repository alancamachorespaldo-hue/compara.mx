#!/usr/bin/env node
/**
 * ml-bicis.js — Características y nuevas bicis eléctricas desde el catálogo de Mercado Libre.
 *
 *   node scripts/ml-bicis.js especs [--aplicar]
 *     Lee la ficha (/products/{mlId}) de cada bici con mlId, llena SOLO los campos vacíos
 *     en merged-admin.json y en bicis/index.html, y lista las diferencias con lo ya capturado.
 *   node scripts/ml-bicis.js nuevas [--aplicar]
 *     Toma el ranking de más vendidas (Bicicletas Eléctricas) y agrega como estado "nuevo"
 *     (sin publicar, sin link de afiliado) las que no tengamos y tengan stock (Full o 2+ vendedores).
 * Sin --aplicar solo muestra lo que haría.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const HTML = resolve(ROOT, 'bicis/index.html');
const API = 'https://api.mercadolibre.com';
const CATEGORY = 'MLM123977';
const MODE = process.argv[2];
const APPLY = process.argv.includes('--aplicar');

let TOKEN;
async function getToken() {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: process.env.ML_CLIENT_ID, client_secret: process.env.ML_CLIENT_SECRET, refresh_token: process.env.ML_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(`Token ${res.status}`);
  return (await res.json()).access_token;
}
async function api(path) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1000 * 2 ** i)); continue; }
    return null;
  }
  return null;
}

const num = s => { const m = String(s ?? '').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : null; };
const compact = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const yes = v => v == null ? null : /^s[ií]/i.test(v) ? true : /^no/i.test(v) ? false : null;
const fmt = n => String(Math.round(n * 10) / 10);

// Ficha de ML → campos de bici. Cada campo: [clave en especs (texto), clave en el HTML, valor texto, valor HTML].
function fromAttributes(p) {
  const a = Object.fromEntries((p.attributes || []).map(x => [x.name, x]));
  const val = n => a[n]?.value_name ?? null;
  const unit = n => a[n]?.value_struct?.unit ?? String(val(n) ?? '').replace(/[\d.,\s]/g, '');
  const f = {};
  const w = num(val('Potencia'));
  if (w) f.motor = [`${fmt(w)} W`, 'motorStr', `${fmt(w)} W`];
  const v = num(val('Velocidad máxima'));
  if (v) f.velocidad = [`${fmt(v)} km/h`, 'velocidad', v];
  const volts = num(val('Voltaje de la batería'));
  let ah = num(val('Capacidad de la batería'));
  if (ah && /mah/i.test(unit('Capacidad de la batería')) && ah >= 1000) ah = ah / 1000;
  if (volts && ah && ah >= 3 && ah <= 60) { const wh = Math.round(volts * ah * 10) / 10; f.bateria = [`${fmt(wh)} Wh`, 'batWh', wh]; }
  if (volts) f.voltaje = [`${fmt(volts)} V`, 'batV', volts];
  const tipo = val('Tipo de batería');
  if (tipo) { const t = /litio/i.test(tipo) ? 'Li-ion' : /plomo/i.test(tipo) ? 'Plomo-ácido' : tipo; f.batTipo = [t, 'batTipo', t]; }
  const rem = yes(val('Con batería removible'));
  if (rem != null) f.removible = [rem ? 'Sí' : 'No', 'batRemovible', rem];
  const rueda = num(val('Rodado'));
  if (rueda) f.rueda = [`${fmt(rueda)}"`, 'rueda', `${fmt(rueda)}"`];
  const carga = num(val('Peso máximo soportado'));
  if (carga) f.cargaMax = [`${fmt(carga)} kg`, 'cargaMax', carga];
  const peso = num(val('Peso'));
  if (peso) f.peso = [`${fmt(peso)} kg`, 'peso', peso];
  const auto = num(val('Autonomía de la bicicleta eléctrica'));
  if (auto && /km/i.test(unit('Autonomía de la bicicleta eléctrica'))) f.autonomia = [`${fmt(auto)} km`, 'autonomia', auto];
  const pleg = yes(val('Es plegable'));
  if (pleg != null) f.plegable = [pleg ? 'Sí' : 'No', 'plegable', pleg];
  const luces = yes(val('Con luces'));
  if (luces != null) f.luces = [luces ? 'Sí' : 'No', 'luces', luces];
  return { fields: f, autonomiaDudosa: auto && !/km/i.test(unit('Autonomía de la bicicleta eléctrica')) ? val('Autonomía de la bicicleta eléctrica') : null };
}

// ── Array ELECTRICAS en bicis/index.html (mismo formato que escribe sync-html.js) ──
function readHtmlBikes() {
  const html = readFileSync(HTML, 'utf8');
  const m = html.match(/(?:const|var|let)\s+ELECTRICAS\s*=\s*\[/m);
  const start = html.indexOf('[', m.index);
  let depth = 0, end = -1;
  for (let i = start; i < html.length; i++) { if (html[i] === '[') depth++; else if (html[i] === ']' && --depth === 0) { end = i; break; } }
  return { html, start, end, list: new Function(`return ${html.slice(start, end + 1)}`)() };
}
function writeHtmlBikes({ html, start, end }, list) {
  const text = JSON.stringify(list, null, 2).replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:');
  writeFileSync(HTML, html.slice(0, start) + text + html.slice(end + 1), 'utf8');
}
const isEmpty = v => v == null || v === '' || /^n\/?d/i.test(String(v)) || v === 0;

async function especs() {
  const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
  const page = readHtmlBikes();
  const htmlById = new Map(page.list.map(b => [String(b.id), b]));
  const cache = {};
  let filledAdmin = 0, filledHtml = 0;
  const diffs = [], dudosas = [];
  for (const p of db.bicis.filter(x => x.mlId)) {
    const prod = cache[p.mlId] ??= await api(`/products/${p.mlId}`);
    if (!prod) { console.log(`  ✗ ${p.nombre}: no se pudo leer ${p.mlId}`); continue; }
    const { fields, autonomiaDudosa } = fromAttributes(prod);
    if (autonomiaDudosa && isEmpty(p.especs?.autonomia)) dudosas.push(`${p.nombre}: ML dice "${autonomiaDudosa}"`);
    p.especs = p.especs || {};
    const h = htmlById.get(String(p.id));
    const added = [];
    for (const [key, [texto, hKey, hVal]] of Object.entries(fields)) {
      if (isEmpty(p.especs[key])) { p.especs[key] = texto; filledAdmin++; added.push(key); }
      else if (num(p.especs[key]) != null && num(texto) != null && Math.abs(num(p.especs[key]) - num(texto)) / Math.max(num(texto), 1) > 0.05)
        diffs.push(`${p.nombre.padEnd(26)} ${key.padEnd(10)} tuyo: ${String(p.especs[key]).padEnd(16)} ML: ${texto}`);
      if (h && isEmpty(h[hKey])) { h[hKey] = hVal; filledHtml++; if (hKey === 'autonomia') h.autonomiaStr = texto; }
    }
    if (added.length) console.log(`  + ${p.nombre.padEnd(30)} ${added.join(', ')}`);
  }
  console.log(`\n${filledAdmin} datos nuevos en la base · ${filledHtml} en la página`);
  if (diffs.length) console.log(`\nDiferencias (no se cambiaron, revísalas):\n  ${diffs.join('\n  ')}`);
  if (dudosas.length) console.log(`\nAutonomía con unidad dudosa en ML (no se usó):\n  ${dudosas.join('\n  ')}`);
  if (!APPLY) { console.log('\n(vista previa — agrega --aplicar para guardar)'); return; }
  writeFileSync(ADMIN, JSON.stringify(db, null, 2), 'utf8');
  writeHtmlBikes(page, page.list);
  console.log('💾 Guardado en merged-admin.json y bicis/index.html');
}

async function nuevas() {
  const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
  const ours = new Set(db.bicis.map(p => p.mlId).filter(Boolean));
  const ourNames = db.bicis.map(p => compact(p.marca + p.nombre + p.id));
  const ranking = (await api(`/highlights/MLM/category/${CATEGORY}`))?.content || [];
  const now = new Date().toISOString();
  const added = [];
  for (const c of ranking.filter(x => x.type === 'PRODUCT')) {
    if (ours.has(c.id)) continue;
    const p = await api(`/products/${c.id}`);
    if (!p || p.domain_id !== 'MLM-ELECTRIC_BICYCLES') continue;
    const attr = n => (p.attributes || []).find(a => a.name === n)?.value_name ?? '';
    if (/cargador|repuesto|refacci/i.test(p.name) || !(attr('Potencia') || attr('Rodado'))) continue;
    const key = compact(attr('Marca')) + compact(attr('Modelo'));
    if (ourNames.some(n => n.includes(compact(attr('Modelo'))) && n.includes(compact(attr('Marca'))))) continue;
    const offers = ((await api(`/products/${c.id}/items?limit=20`))?.results || []).filter(i => i.condition === 'new' && i.price > 0);
    const full = offers.some(i => i.shipping?.logistic_type === 'fulfillment');
    const sellers = new Set(offers.map(i => i.seller_id)).size;
    if (!offers.length || !(full || sellers >= 2)) { console.log(`  · #${c.position} ${p.name.slice(0, 50)} — sin stock suficiente`); continue; }
    const precio = Math.round(Math.min(...offers.map(i => i.price)));
    const { fields } = fromAttributes(p);
    const especs = Object.fromEntries(Object.entries(fields).map(([k, [t]]) => [k, t]));
    especs.tipo = fields.plegable?.[2] ? 'plegable' : 'urbana';
    const id = `${compact(attr('Marca'))}-${compact(attr('Modelo'))}`.replace(/^-|-$/g, '') || c.id.toLowerCase();
    const item = {
      id, nombre: p.name, marca: attr('Marca'), linkML: null, linkAmz: null, mlId: c.id, mlIdFuente: 'nuevo',
      precioML: precio, precioAmz: null, precio, imagen: p.pictures?.[0]?.url || null, especs,
      activo: false, estadoML: 'nuevo', _updatedAt: now,
      _nuevo: { ranking: c.position, vendedores: sellers, full, encontrado: now.slice(0, 10) },
    };
    added.push(item);
    ourNames.push(key);
    console.log(`  ★ #${c.position} ${p.name.slice(0, 55)} — $${precio} · ${sellers} vendedor(es)${full ? ' · Full' : ''}`);
  }
  console.log(`\n${added.length} bicis nuevas`);
  if (!APPLY) { console.log('(vista previa — agrega --aplicar para guardar)'); return; }
  db.bicis.push(...added);
  writeFileSync(ADMIN, JSON.stringify(db, null, 2), 'utf8');
  console.log('💾 Agregadas a merged-admin.json como "nuevo" (no aparecen en la web hasta publicarlas)');
}

if (!['especs', 'nuevas'].includes(MODE)) { console.error('Uso: node scripts/ml-bicis.js especs|nuevas [--aplicar]'); process.exit(1); }
TOKEN = await getToken();
await (MODE === 'especs' ? especs() : nuevas());
