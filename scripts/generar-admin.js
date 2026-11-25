#!/usr/bin/env node
/**
 * generar-admin.js — Prepara merged-admin.json y genera scripts/admin-artifact.html
 *   1. Completa mlId (ID de catálogo ML) desde links /p/MLM… y _mlCatalogo
 *   2. Lee scripts/precios-link-report.json SOLO para enseñarlo en el gestor (ya no aplica precios:
 *      los escribe precios-por-link.mjs, la única fuente desde que la API cerró los precios)
 *   3. Agrega candidatos de scripts/ml-sugerencias.json a productos sin mlId
 *   4. Rellena scripts/admin-template.html con los datos
 * Uso: node scripts/generar-admin.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { clavesDeDatos, tituloDe } from './categorias.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT          = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PATH    = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH   = resolve(ROOT, 'scripts/precios-link-report.json');
const DISP_PATH     = resolve(ROOT, 'scripts/disponibilidad-report.json');
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

// 2. Reporte de precios — SOLO PARA MOSTRARLO EN EL GESTOR.
//
// Hasta nov-2026 este paso APLICABA scripts/ml-report.json a la base: escribía precioML,
// movía la racha de bajadas y pausaba o desactivaba por "no_encontrado". Ya no. Desde que la
// API cerró /products/{id}/items, el precio lo escribe precios-por-link.mjs directamente en la
// base al leer la página del enlace de afiliado, que es la única fuente. Que dos scripts
// escribieran el mismo campo era además la receta para pisarse: este paso deshacía en la misma
// corrida las correcciones que acababa de escribir el otro.
//
// Aquí solo se lee el reporte para enseñarlo en el gestor.
const report = readJson(REPORT_PATH);

// 3. Candidatos de ID (una lista vacía guardada en el producto = ya revisado, no se reemplaza)
const sug = readJson(SUG_PATH);
const disp = readJson(DISP_PATH);
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
console.log(`✓ merged-admin.json: ${fromLinks} IDs desde links · ${withSug} con candidatos de ID`);

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
      .filter(p => p.estado !== 'sin_cambio' && p.estado !== 'error')
      .map(p => ({
        categoria:   p.categoria,
        id:          p.id,
        nombre:      p.nombre,
        estado:      p.estado,
        mlId:        p.mlId || null,
        // El reporte de precios por enlace nombra distinto las dos cifras; el gestor espera
        // precioAntes/precioNuevo, así que se traducen aquí en vez de tocar la plantilla.
        precioAntes: p.precioEnSitio ?? null,
        precioNuevo: p.precioEnLink ?? null,
      })),
  } : null,
  sugerencias: sug ? { generado: sug.generado || null } : null,
  // Nombres de categoría del registro único: una categoría nueva sale con su nombre en el gestor.
  cats: Object.fromEntries(clavesDeDatos().map(k => [k, tituloDe(k)])),
  // Revisión de disponibilidad (scripts/revisar-disponibilidad.js): solo lo que tiene problema,
  // que es lo que el gestor muestra y deja pausar de un clic.
  disponibilidad: disp ? {
    generado: disp.generado || null,
    aplicado: !!disp.aplicado,
    umbral: disp.umbral ?? null,
    totales: disp.totales || null,
    productos: (disp.productos || [])
      .filter(p => ['no_existe', 'pausado', 'link_roto', 'link_otro', 'sin_ofertas', 'precio_no_coincide'].includes(p.estado))
      .map(p => ({
        categoria: p.categoria, id: p.id, nombre: p.nombre, estado: p.estado,
        detalle: p.detalle || null, linkML: p.linkML || null, mlId: p.mlId || null,
        pausaML: !!p.pausaML, fallos: p.fallos ?? null,
      })),
  } : null,
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
