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
const CUPON_PATH    = resolve(ROOT, 'scripts/cupon-config.json');

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
let synced = 0, keptManual = 0, pausados = 0, desactivados = 0;
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
    if (row.estado === 'actualizado' && row.precioAntes != null) {
      const mismaRacha = p._precioMLAntes === row.precioAntes;
      p._precioMLAntes = row.precioAntes;
      if (!mismaRacha || !p._precioMLFecha) p._precioMLFecha = new Date().toISOString().slice(0, 10);
    } else { delete p._precioMLAntes; delete p._precioMLFecha; }
    // Pausa automática: 404/inactivo en ML → pausaML:true + rastrea días sin precio.
    // Día 1: pausaML:true. Día 3+: activo:false (desaparece de la web y del catálogo).
    // Si el catálogo vuelve → se limpia todo y se reactiva.
    if (row.estado === 'no_encontrado') {
      p.pausaML = true;
      if (!p._mlSinPrecioDesde) p._mlSinPrecioDesde = new Date().toISOString().slice(0, 10);
      const diasSin = Math.floor((Date.now() - new Date(p._mlSinPrecioDesde).getTime()) / 86400000);
      if (diasSin >= 3 && p.activo !== false) {
        p.activo = false;
        p._desactivadoPorML = true;
        desactivados++;
        console.log(`  🗑 Desactivado (${diasSin} días sin precio): ${p.nombre} (id:${p.id}, cat:${row.categoria})`);
      } else if (p.activo !== false) {
        pausados++;
      }
    } else if ((row.estado === 'actualizado' || row.estado === 'sin_cambio') && p._mlSinPrecioDesde) {
      // Volvió a tener precio → limpiar pausa automática
      delete p._mlSinPrecioDesde;
      delete p.pausaML;
      if (p._desactivadoPorML) { p.activo = true; delete p._desactivadoPorML; }
    }
    if (p.estadoML !== 'nuevo') p.estadoML = row.estado;
    if (gen) { p._mlCheckedAt = gen; delete p._activadoPendiente; }
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
const extraLog = pausados || desactivados ? ` · ${pausados} pausados ML · ${desactivados} desactivados (3d sin precio)` : '';
console.log(`✓ merged-admin.json: ${fromLinks} IDs desde links · ${synced} precios del reporte (${keptManual} con edición manual más reciente)${extraLog} · ${withSug} con candidatos`);

// 4. Página
const safe = v => JSON.stringify(v).replace(/</g, '\\u003c');
const cupon = readJson(CUPON_PATH) || { activo: false, codigo: '', descuento: '+10% OFF', condiciones: '', linkProductos: '' };
const meta = {
  built: new Date().toISOString(),
  reporte: report ? {
    generado: report.generado || null,
    categorias: report.categorias || null,
    totales: report.totales || null,
    productos: (report.productos || [])
      .filter(p => p.estado !== 'sin_id' && p.estado !== 'sin_cambio')
      .map(p => ({
        categoria:   p.categoria,
        id:          p.id,
        nombre:      p.nombre,
        estado:      p.estado,
        mlId:        p.mlId || null,
        precioAntes: p.precioAntes != null ? p.precioAntes : null,
        precioNuevo: p.precioNuevo != null ? p.precioNuevo : (p.precioML != null ? p.precioML : null),
      })),
  } : null,
  sugerencias: sug ? { generado: sug.generado || null } : null,
};
const data =
  `<script type="application/json" id="meta">${safe(meta)}</script>\n` +
  `<script type="application/json" id="db">${safe(admin)}</script>\n` +
  `<script type="application/json" id="cupon">${safe(cupon)}</script>\n` +
  `<script type="application/json" id="save">${safe('gen-' + Date.now().toString(36))}</script>`;

const tpl = readFileSync(TEMPLATE_PATH, 'utf8').replace(/\r\n/g, '\n');
if (tpl.split('<!--DATA-->').length !== 2) throw new Error('admin-template.html debe contener exactamente un <!--DATA-->');
const html = tpl.replace('<!--DATA-->', () => data);
writeFileSync(OUT_PATH, html, 'utf8');
console.log(`admin-artifact.html generado: ${html.length.toLocaleString('es-MX')} chars (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
