#!/usr/bin/env node
/**
 * historico-precios.js — registro histórico de precios de Mercado Libre de comparalo.mx.
 *
 * Por qué existe: la API de Mercado Libre NO entrega histórico de precios de publicaciones
 * ajenas (nov-2026: /items/{id} y /items/{id}/prices dan 403 con nuestras credenciales, y
 * /marketplace/items/{id}/prices/history da 403 "Invalid caller.id" porque exige ser el
 * vendedor dueño). El único precio que podemos leer es el de hoy, vía /products/{mlId}/items.
 * Así que el histórico lo construimos nosotros, con el precio que ya baja ml-update.js.
 *
 * Dos modos:
 *   node scripts/historico-precios.js            → añade el precio de HOY desde
 *                                                   scripts/merged-admin.json (lo que corre en CI)
 *   node scripts/historico-precios.js --backfill → reconstruye TODO desde el historial de git
 *                                                   de merged-admin.json (un snapshot por día)
 *   ...--dry-run                                 → no escribe, solo informa
 *
 * El backfill no inventa nada: lee los precios que el sitio publicó cada día, tal como
 * quedaron commiteados. No hay registros anteriores al primer commit de merged-admin.json.
 *
 * Escribe scripts/historico-precios.json (fuente canónica, acumulativa).
 * generar-historico.js lo convierte en los archivos ligeros que baja el navegador.
 */

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const OUT = resolve(ROOT, 'scripts/historico-precios.json');

const BACKFILL = process.argv.includes('--backfill');
const DRY = process.argv.includes('--dry-run');

/** Días de histórico que se conservan. 30 es lo que muestra el sitio; guardamos mucho más
 *  para poder mirar hacia atrás sin volver a depender de git. */
const DIAS_MAX = 400;

const git = (args, mb = 1e9) => execFileSync('git', args, { maxBuffer: mb, cwd: ROOT }).toString();
const hoy = () => new Date().toISOString().slice(0, 10);

// ── Lectura de un snapshot ───────────────────────────────────────────────────
/** Devuelve Map("categoria|id" → { precio, mlId }) con los productos que ese día tenían precio ML. */
function leerSnapshot(data) {
  const out = new Map();
  for (const [cat, lista] of Object.entries(data)) {
    if (!Array.isArray(lista)) continue;
    for (const p of lista) {
      if (typeof p.precioML !== 'number' || !(p.precioML > 0)) continue;
      if (p.id == null) continue;
      out.set(cat + '|' + p.id, { precio: p.precioML, mlId: p.mlId || null });
    }
  }
  return out;
}

// ── Estructura del archivo ───────────────────────────────────────────────────
// {
//   generado, dias, fechas: [ "2026-09-30", … ],       ← todos los días con snapshot
//   series: {
//     "laptops|exp_MLM65737068": {
//       mlId, desde, ultimo, n,                        ← n = días con precio registrado
//       r: [["2026-10-17","2026-11-02"], …],           ← tramos de días CON registro
//       p: [["2026-10-17",17099], ["2026-11-05",16919]] ← solo los cambios de precio
//     }
//   }
// }
// Un día del sitio que no aparece en ningún tramo de una serie es un HUECO real de ese
// producto (pausado, sin stock, sin precio). No se rellena ni se interpola.

function vacio() {
  return { generado: null, dias: DIAS_MAX, fechas: [], series: {} };
}

/** Clave libre para una serie que se rompe (cambió el mlId: es otra publicación). */
function claveNueva(series, base) {
  for (let i = 2; ; i++) if (!series[base + '#' + i]) return base + '#' + i;
}

/**
 * Incorpora un día al histórico. `fecha` debe ser >= la última registrada.
 * Si la fecha ya es la última, la sustituye (la última corrida del día manda).
 */
function agregarDia(hist, fecha, snap) {
  const fechas = hist.fechas;
  const ultima = fechas[fechas.length - 1] || null;
  if (ultima && fecha < ultima) throw new Error(`fecha ${fecha} anterior a la última (${ultima})`);

  const repetida = fecha === ultima;
  if (repetida) quitarUltimoDia(hist, fecha);
  fechas.push(fecha);
  const anterior = fechas[fechas.length - 2] || null;

  for (const [clave0, { precio, mlId }] of snap) {
    let clave = clave0;
    // Cadena de series rotas: siempre se trabaja sobre la última de la cadena.
    for (let i = 2; hist.series[clave0 + '#' + i]; i++) clave = clave0 + '#' + i;
    let s = hist.series[clave];

    // Cambió el ID de catálogo → es otra publicación: serie nueva, nunca empalmada.
    if (s && s.mlId && mlId && s.mlId !== mlId) {
      clave = claveNueva(hist.series, clave0);
      s = null;
    }
    if (!s) {
      s = hist.series[clave] = { mlId, desde: fecha, ultimo: fecha, n: 0, r: [], p: [] };
    }
    if (mlId && !s.mlId) s.mlId = mlId;

    // Tramo de días con registro: se extiende si el día anterior del SITIO también lo tuvo.
    const ult = s.r[s.r.length - 1];
    if (ult && anterior && ult[1] === anterior) ult[1] = fecha;
    else s.r.push([fecha, fecha]);

    // Punto de cambio: solo si el precio es distinto del último conocido.
    const prev = s.p[s.p.length - 1];
    if (!prev || prev[1] !== precio) s.p.push([fecha, precio]);

    s.ultimo = fecha;
    s.n++;
  }
}

/** Deshace el último día (para rehacerlo cuando el workflow corre dos veces el mismo día). */
function quitarUltimoDia(hist, fecha) {
  hist.fechas.pop();
  for (const [clave, s] of Object.entries(hist.series)) {
    const ult = s.r[s.r.length - 1];
    if (!ult || ult[1] !== fecha) continue;
    if (ult[0] === fecha) s.r.pop(); else ult[1] = hist.fechas[hist.fechas.length - 1] || ult[0];
    const pr = s.p[s.p.length - 1];
    if (pr && pr[0] === fecha) s.p.pop();
    s.n--;
    s.ultimo = s.r.length ? s.r[s.r.length - 1][1] : s.desde;
    if (s.n <= 0) delete hist.series[clave];
  }
}

/** Poda a DIAS_MAX días, conservando el precio vigente al inicio del periodo. */
function podar(hist) {
  if (hist.fechas.length <= DIAS_MAX) return;
  const corte = hist.fechas[hist.fechas.length - DIAS_MAX];
  hist.fechas = hist.fechas.filter((f) => f >= corte);
  for (const [clave, s] of Object.entries(hist.series)) {
    s.r = s.r.filter((t) => t[1] >= corte).map((t) => [t[0] < corte ? corte : t[0], t[1]]);
    if (!s.r.length) { delete hist.series[clave]; continue; }
    // El último punto anterior al corte se conserva, rebasado al corte: sin él no se sabría
    // a qué precio empezó el periodo.
    const antes = s.p.filter((x) => x[0] < corte).pop();
    s.p = s.p.filter((x) => x[0] >= corte);
    if (antes) s.p.unshift([corte, antes[1]]);
    s.desde = s.r[0][0];
    s.n = s.r.reduce((a, t) => a + diasEntre(hist.fechas, t[0], t[1]), 0);
  }
}

const diasEntre = (fechas, a, b) => fechas.filter((f) => f >= a && f <= b).length;

// ── Modos ────────────────────────────────────────────────────────────────────
function backfill() {
  const log = git(['log', '--format=%H|%ad', '--date=short', '--', 'scripts/merged-admin.json'], 1e8)
    .trim().split('\n').filter(Boolean);
  // git log va de nuevo a viejo: el primero de cada día es el último commit de ese día.
  const porDia = new Map();
  for (const l of log) { const [h, d] = l.split('|'); if (!porDia.has(d)) porDia.set(d, h); }
  const dias = [...porDia.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!dias.length) throw new Error('merged-admin.json no tiene historial en git');

  const hist = vacio();
  let saltados = 0;
  for (const [fecha, sha] of dias) {
    let data;
    try { data = JSON.parse(git(['show', `${sha}:scripts/merged-admin.json`])); }
    catch { saltados++; console.log(`  ⚠ ${fecha}: snapshot ilegible, se omite`); continue; }
    agregarDia(hist, fecha, leerSnapshot(data));
  }
  console.log(`📚 Backfill: ${hist.fechas.length} días (${hist.fechas[0]} → ${hist.fechas.at(-1)})`
    + (saltados ? `, ${saltados} omitidos` : ''));
  return hist;
}

function append() {
  const hist = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : vacio();
  if (!hist.fechas) throw new Error('historico-precios.json con formato desconocido');
  const fecha = hoy();
  const ultima = hist.fechas[hist.fechas.length - 1];
  if (ultima && fecha < ultima) {
    console.log(`⚠ Hoy (${fecha}) es anterior al último registro (${ultima}); no se escribe nada.`);
    return null;
  }
  agregarDia(hist, fecha, leerSnapshot(JSON.parse(readFileSync(ADMIN, 'utf8'))));
  console.log(`📈 Día ${fecha}${fecha === ultima ? ' (rehecho: segunda corrida del día)' : ''}`);
  return hist;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const hist = BACKFILL ? backfill() : append();
if (hist) {
  podar(hist);
  hist.generado = new Date().toISOString();
  hist.dias = DIAS_MAX;

  const series = Object.values(hist.series);
  const n = series.map((s) => s.n).sort((a, b) => a - b);
  const pc = (q) => n[Math.floor(n.length * q)] || 0;
  console.log(`   series: ${series.length} · días por serie p10/p50/p90: ${pc(0.1)}/${pc(0.5)}/${pc(0.9)}`);
  console.log(`   con ≥30 días: ${n.filter((x) => x >= 30).length} · con ≥7: ${n.filter((x) => x >= 7).length}`);
  console.log(`   series rotas por cambio de mlId: ${Object.keys(hist.series).filter((k) => k.includes('#')).length}`);

  const json = JSON.stringify(hist);
  if (DRY) console.log(`   (dry-run) ${(json.length / 1024).toFixed(0)} KB sin escribir`);
  else { writeFileSync(OUT, json); console.log(`✅ scripts/historico-precios.json · ${(json.length / 1024).toFixed(0)} KB`); }
}
