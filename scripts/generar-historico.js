#!/usr/bin/env node
/**
 * generar-historico.js — convierte scripts/historico-precios.json en los archivos ligeros
 * que baja el navegador: assets/data/historico/<categoria>.json (uno por categoría, para que
 * una página no descargue el histórico de todo el sitio).
 *
 * Todo viene calculado para que la tarjeta no haga cuentas: precio actual, mínimo y máximo de
 * los últimos 30 días con su fecha, precio al inicio del periodo, variación %, desde cuándo
 * tenemos datos, cuántos registros hay y en qué estado está la serie.
 *
 * NO se inventa nada: los días sin registro quedan marcados como huecos y no se interpolan;
 * una serie con menos de 7 registros no se grafica (estado "insuficiente" / "nuevo").
 *
 * Corre en update-prices.yml después de historico-precios.js.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { publicado } from './_ofertas.js';

const ROOT = resolve(import.meta.dirname, '..');
const HIST = resolve(ROOT, 'scripts/historico-precios.json');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const DIR = resolve(ROOT, 'assets/data/historico');

/** Ventana que muestra el sitio. */
const VENTANA = 30;
/** Registros mínimos para dibujar una gráfica. */
const MIN_GRAFICA = 7;
/** Registros mínimos para publicar una variación porcentual. */
const MIN_VARIACION = 14;
/** A partir de cuántos registros consideramos el histórico "completo" (de 30 días). */
const MIN_COMPLETO = 28;
/** Un salto mayor a esto entre dos días se marca como atípico: casi siempre es un mlId mal
 *  asignado en la base, no un cambio real de precio (oct-2026: Pixel 9a a $20,794). Se registra
 *  el dato tal cual, pero queda señalado para que la gráfica pueda tratarlo aparte. */
const SALTO_ATIPICO = 0.6;

const hist = JSON.parse(readFileSync(HIST, 'utf8'));
const admin = JSON.parse(readFileSync(ADMIN, 'utf8'));

const ventana = hist.fechas.slice(-VENTANA);
const idx = new Map(ventana.map((f, i) => [f, i]));
const desdeVentana = ventana[0];
const hastaVentana = ventana[ventana.length - 1];

/** La serie vigente de un producto: la última de la cadena cuando hubo cambio de mlId. */
function serieDe(clave) {
  let s = hist.series[clave], k = clave;
  for (let i = 2; hist.series[clave + '#' + i]; i++) { k = clave + '#' + i; s = hist.series[k]; }
  return s;
}

/** Precio del día `f` según los puntos de cambio (null si ese día no hubo registro). */
function precioEn(s, f) {
  if (!s.r.some((t) => f >= t[0] && f <= t[1])) return null;
  let v = null;
  for (const [pf, pv] of s.p) { if (pf <= f) v = pv; else break; }
  return v;
}

function resumen(s) {
  const dias = [];
  for (const f of ventana) {
    const v = precioEn(s, f);
    if (v != null) dias.push([idx.get(f), v, f]);
  }
  const n = dias.length;
  const nacio = s.desde >= desdeVentana;           // la serie empezó dentro de la ventana
  const estado = n >= MIN_COMPLETO ? 'completo'
    : n >= MIN_GRAFICA ? 'parcial'
      : nacio ? 'nuevo' : 'insuficiente';

  const out = { estado, desde: n ? dias[0][2] : s.desde, n, dias: ventana.length };
  if (!n) return out;

  const vals = dias.map((d) => d[1]);
  const min = Math.min(...vals), max = Math.max(...vals);
  out.actual = dias[dias.length - 1][1];
  out.actualFecha = dias[dias.length - 1][2];
  out.inicio = dias[0][1];
  out.min = min; out.minFecha = dias.find((d) => d[1] === min)[2];
  out.max = max; out.maxFecha = dias.find((d) => d[1] === max)[2];
  if (n >= MIN_VARIACION && out.inicio > 0) {
    out.var = Math.round(((out.actual - out.inicio) / out.inicio) * 1000) / 10;
  }
  // Puntos de la gráfica: [índice del día en la ventana, precio]. Solo los cambios; entre dos
  // puntos el precio se mantiene. Los días que no aparecen en ningún tramo son huecos.
  out.p = [];
  let prev = null;
  for (const [i, v] of dias) { if (v !== prev) { out.p.push([i, v]); prev = v; } }
  const huecos = ventana.map((f, i) => (precioEn(s, f) == null ? i : -1)).filter((i) => i >= 0);
  if (huecos.length) out.huecos = huecos;
  // Saltos atípicos (posible mlId mal asignado en la base).
  const raros = [];
  for (let i = 1; i < out.p.length; i++) {
    const a = out.p[i - 1][1], b = out.p[i][1];
    if (a > 0 && Math.abs(b - a) / a >= SALTO_ATIPICO) raros.push(out.p[i][0]);
  }
  if (raros.length) out.atipicos = raros;
  return out;
}

mkdirSync(DIR, { recursive: true });
const escritos = new Set();
let totalProd = 0, conGrafica = 0, conAtipicos = 0;

for (const [cat, lista] of Object.entries(admin)) {
  if (!Array.isArray(lista)) continue;
  const productos = {};
  for (const p of lista) {
    if (p.activo === false || !publicado(p) || p.id == null) continue;
    const s = serieDe(cat + '|' + p.id);
    if (!s) continue;
    const r = resumen(s);
    if (!r.n) continue;
    // nombre y precio actual van en el archivo para que la tarjeta pueda confirmar que el
    // histórico es de ESE producto antes de dibujarlo (igual que hace price-drops.js).
    r.nombre = p.nombre;
    if (s.mlId) r.mlId = s.mlId;
    productos[String(p.id)] = r;
    totalProd++;
    if (r.estado === 'completo' || r.estado === 'parcial') conGrafica++;
    if (r.atipicos) conAtipicos++;
  }
  if (!Object.keys(productos).length) continue;
  const file = `${cat}.json`;
  writeFileSync(resolve(DIR, file), JSON.stringify({
    generado: hist.generado, categoria: cat, ventana: ventana.length,
    desde: desdeVentana, hasta: hastaVentana, fechas: ventana, productos,
  }));
  escritos.add(file);
}

// Categorías que ya no existen: se borra su archivo para que el sitio no sirva datos viejos.
if (existsSync(DIR)) {
  for (const f of readdirSync(DIR)) {
    if (f.endsWith('.json') && !escritos.has(f)) { unlinkSync(resolve(DIR, f)); console.log(`  🗑 ${f} (categoría sin datos)`); }
  }
}

console.log(`📊 Histórico publicado: ${escritos.size} categorías · ${totalProd} productos`);
console.log(`   con gráfica (≥${MIN_GRAFICA} registros): ${conGrafica} · sin suficiente histórico: ${totalProd - conGrafica}`);
console.log(`   ventana: ${desdeVentana} → ${hastaVentana} (${ventana.length} días)`);
if (conAtipicos) console.log(`   ⚠ ${conAtipicos} productos con saltos atípicos (revisar su mlId en la base)`);
