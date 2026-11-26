#!/usr/bin/env node
/**
 * limpiar-anclas.mjs — suelta las referencias de "precio antes" que el histórico desmiente.
 *
 * Por qué existe: una bajada se anuncia comparando `precioML` con `_precioMLAntes`, que
 * `actualizarRachaML()` ancla en el precio más alto de la racha. Esa función ve dos precios
 * seguidos, no la serie, así que una lectura suelta y disparatada se queda de referencia y el
 * sitio presume un descuento que nunca ocurrió. Nov-2026: la Oster BVSTDCO5 llevaba un mes
 * entre $245 y $349, la API marcó $632 el día 20 —era la oferta más barata del CATÁLOGO, de
 * otro vendedor que se agotó, no el precio de nuestra publicación— y la tarjeta acabó
 * anunciando "−61%, antes $632". Así estaban 23 productos, hasta −72%.
 *
 * Aquí sí se mira la serie entera. Se suelta el ancla cuando las dos cosas son ciertas:
 *   · el "antes" está FACTOR veces por encima de la mediana de los últimos 30 días, y
 *   · el precio de hoy está pegado a esa mediana (±MARGEN).
 * O sea: el producto nunca se movió de su precio de siempre, y lo que se anuncia como rebaja
 * es la caída de un pico de lectura. Una bajada de verdad —el precio sale de su mediana hacia
 * abajo— no cumple la segunda condición y no se toca.
 *
 * Solo quita `_precioMLAntes` y `_precioMLFecha`: el precio, el enlace y el histórico se
 * quedan igual, y si mañana baja de verdad, la racha se vuelve a armar sola.
 *
 *   node scripts/limpiar-anclas.mjs [--aplicar] [--factor=1.5] [--margen=0.25] [--minimo=10]
 *
 * Reporte: scripts/anclas-report.json. Después de --aplicar: los generadores de descuentos,
 * generar-bajadas.js y generar-ofertas.js (el workflow ya los corre a continuación).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = path.join(DIR, 'merged-admin.json');
const HIST = path.join(DIR, 'historico-precios.json');
const REPORTE = path.join(DIR, 'anclas-report.json');

const args = process.argv.slice(2);
const num = (n, def) => {
  const v = args.find(a => a.startsWith(`--${n}=`))?.split('=')[1];
  return v == null ? def : Number(v);
};
const APLICAR = args.includes('--aplicar');
const FACTOR = num('factor', 1.5);   // cuánto debe pasarse el ancla sobre la mediana
const MARGEN = num('margen', 0.25);  // cuán pegado a la mediana está el precio de hoy
const MINIMO = num('minimo', 10);    // días observados mínimos para opinar
const HOY = new Date().toISOString().slice(0, 10);

const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
const hist = JSON.parse(readFileSync(HIST, 'utf8'));
const ventana = (hist.fechas ?? []).slice(-30);

/** Precio de cada día de la ventana en que hubo registro (los huecos no se inventan). */
function serieDiaria(s) {
  const out = [];
  for (const f of ventana) {
    if (!(s.r ?? []).some(([a, b]) => f >= a && f <= b)) continue;
    let v = null;
    for (const [fe, pv] of (s.p ?? [])) { if (fe <= f) v = pv; else break; }
    if (v != null) out.push(v);
  }
  return out;
}
const mediana = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };

const sueltas = [];
let conBajada = 0, sinSerie = 0, pocosDatos = 0;

for (const [cat, lista] of Object.entries(db)) {
  if (!Array.isArray(lista)) continue;
  for (const p of lista) {
    if (!(p._precioMLAntes > 0 && typeof p.precioML === 'number' && p.precioML > 0)) continue;
    if (!(p._precioMLAntes > p.precioML)) continue;
    conBajada++;
    const s = hist.series?.[`${cat}|${p.id}`];
    if (!s) { sinSerie++; continue; }
    const dias = serieDiaria(s);
    if (dias.length < MINIMO) { pocosDatos++; continue; }
    const m = mediana(dias);
    if (!m) continue;
    const rel = p._precioMLAntes / m, hoyRel = p.precioML / m;
    if (!(rel >= FACTOR && hoyRel >= 1 - MARGEN && hoyRel <= 1 + MARGEN)) continue;
    sueltas.push({
      categoria: cat, id: p.id, nombre: p.nombre ?? null, mlId: p.mlId ?? null,
      anclaSoltada: p._precioMLAntes, precioHoy: p.precioML, mediana30: m,
      pctQueAnunciaba: Math.round((1 - p.precioML / p._precioMLAntes) * 100),
      vecesSobreLaMediana: Number(rel.toFixed(2)), dias: dias.length,
    });
    if (APLICAR) { p._precioMLAntes = undefined; p._precioMLFecha = undefined; }
  }
}

sueltas.sort((a, b) => b.pctQueAnunciaba - a.pctQueAnunciaba);
// JSON.stringify ignora las claves con undefined, así que esto las quita de verdad del archivo.
if (APLICAR && sueltas.length) writeFileSync(ADMIN, JSON.stringify(db, null, 2) + '\n');
writeFileSync(REPORTE, JSON.stringify({
  fecha: HOY, generado: new Date().toISOString(), aplicado: APLICAR,
  factor: FACTOR, margen: MARGEN, minimo: MINIMO,
  totales: { bajadasVigentes: conBajada, soltadas: sueltas.length, sinSerie, pocosDatos },
  soltadas: sueltas,
}, null, 2) + '\n');

console.log(`⚓ Anclas de bajada — ${conBajada} bajadas vigentes · ${sueltas.length} que el histórico desmiente`);
if (sinSerie || pocosDatos) console.log(`   (${sinSerie} sin serie · ${pocosDatos} con menos de ${MINIMO} días: no se opina)`);
for (const x of sueltas.slice(0, 20)) {
  console.log(`   −${x.pctQueAnunciaba}%  ${x.categoria}/${x.id}  antes $${x.anclaSoltada} · hoy $${x.precioHoy} · mediana $${x.mediana30}  ${String(x.nombre ?? '').slice(0, 38)}`);
}
if (sueltas.length > 20) console.log(`   … y ${sueltas.length - 20} más en scripts/anclas-report.json`);
console.log(APLICAR ? '\n✅ Sueltas. Faltan los generadores de descuentos, generar-bajadas.js y generar-ofertas.js.'
                    : '\n(ensayo: nada escrito; con --aplicar se sueltan)');
