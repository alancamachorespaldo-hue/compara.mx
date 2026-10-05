#!/usr/bin/env node
/**
 * generar-admin.js — Prepara merged-admin.json y genera scripts/admin-artifact.html
 *   1. Completa mlId (ID de catálogo ML) desde links /p/MLM… y _mlCatalogo
 *   2. Aplica scripts/ml-report.json por id (las ediciones manuales posteriores al reporte ganan)
 *   3. Agrega candidatos de scripts/ml-sugerencias.json a productos sin mlId
 *   4. Rellena scripts/admin-template.html con los datos
 * Uso: node scripts/generar-admin.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT          = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PATH    = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH   = resolve(ROOT, 'scripts/ml-report.json');
const SUG_PATH      = resolve(ROOT, 'scripts/ml-sugerencias.json');
const TEMPLATE_PATH = resolve(ROOT, 'scripts/admin-template.html');
const OUT_PATH      = resolve(ROOT, 'scripts/admin-artifact.html');

const readJson = p => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const admin = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));

// 1. ID de catálogo desde links existentes
let fromLinks = 0;
for (const list of Object.values(admin)) {
  for (const p of list) {
    if (p.mlId) continue;
    const m = String(p.linkML || p._mlCatalogo || '').match(/\/p\/(MLM\d{6,12})/i);
    if (m) { p.mlId = m[1].toUpperCase(); p.mlIdFuente = 'link'; fromLinks++; }
  }
}

// 2. Reporte de precios
const report = readJson(REPORT_PATH);
let synced = 0, keptManual = 0;
if (report) {
  const gen = report.generado || '';
  for (const row of report.productos || []) {
    const list = admin[row.categoria];
    if (!list || row.estado === 'sin_id') continue;
    const p = (row.id != null && list.find(x => String(x.id) === String(row.id))) || list.find(x => x.nombre === row.nombre);
    if (!p) continue;
    if (gen && p._updatedAt && p._updatedAt > gen) { keptManual++; continue; }
    if (row.estado === 'precio_sospechoso') p._precioMLSospechoso = row.precioML;
    else { delete p._precioMLSospechoso; if (row.precioML != null) p.precioML = row.precioML; }
    if (row.estado === 'actualizado' && row.precioAntes != null) p._precioMLAntes = row.precioAntes;
    else delete p._precioMLAntes;
    p.estadoML = row.estado;
    if (gen) p._mlCheckedAt = gen;
    synced++;
  }
}

// 3. Candidatos de ID (una lista vacía guardada en el producto = ya revisado, no se reemplaza)
const sug = readJson(SUG_PATH);
let withSug = 0;
for (const [cat, list] of Object.entries(admin)) {
  for (const p of list) {
    if (p.mlId) { delete p._mlSug; continue; }
    const cands = sug?.items?.[`${cat}|${p.id}`];
    if (!cands || (Array.isArray(p._mlSug) && p._mlSug.length === 0)) continue;
    p._mlSug = cands;
    if (cands.length) withSug++;
  }
}

writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
console.log(`✓ merged-admin.json: ${fromLinks} IDs desde links · ${synced} precios del reporte (${keptManual} con edición manual más reciente) · ${withSug} con candidatos`);

// 4. Página
const safe = v => JSON.stringify(v).replace(/</g, '\\u003c');
const meta = {
  built: new Date().toISOString(),
  reporte: report ? { generado: report.generado || null, categorias: report.categorias || null, totales: report.totales || null } : null,
  sugerencias: sug ? { generado: sug.generado || null } : null,
};
const data =
  `<script type="application/json" id="meta">${safe(meta)}</script>\n` +
  `<script type="application/json" id="db">${safe(admin)}</script>\n` +
  `<script type="application/json" id="save">${safe('gen-' + Date.now().toString(36))}</script>`;

const tpl = readFileSync(TEMPLATE_PATH, 'utf8').replace(/\r\n/g, '\n');
if (tpl.split('<!--DATA-->').length !== 2) throw new Error('admin-template.html debe contener exactamente un <!--DATA-->');
const html = tpl.replace('<!--DATA-->', () => data);
writeFileSync(OUT_PATH, html, 'utf8');
console.log(`admin-artifact.html generado: ${html.length.toLocaleString('es-MX')} chars (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
