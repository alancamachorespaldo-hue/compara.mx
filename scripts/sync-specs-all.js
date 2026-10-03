#!/usr/bin/env node
/**
 * sync-specs-all.js — Extrae specs de todos los HTMLs de producto e inyecta en merged-admin.json
 * Uso: node scripts/sync-specs-all.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');

const adminData = JSON.parse(readFileSync(ADMIN, 'utf8'));

// ── Helpers ─────────────────────────────────────────────────────────────────
function extractArray(htmlPath, varName) {
  const html = readFileSync(resolve(ROOT, htmlPath), 'utf8');
  const rx = new RegExp(`const ${varName}\\s*=\\s*(\\[[\\s\\S]*?\\n\\];)`, 'm');
  const m = html.match(rx);
  if (!m) throw new Error(`No se encontró "const ${varName}" en ${htmlPath}`);
  return eval(m[1]); // eslint-disable-line no-eval
}

function cleanNull(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

function yn(val) { return val == null ? null : (val ? 'Sí' : 'No'); }
function fmt(n, unit) { return n != null ? `${n} ${unit}` : null; }
function fmtPeso(n) { return n != null ? `${n} kg` : null; }
function fmtMXN(n) { return n != null ? `$${Number(n).toFixed(2)}` : null; }

// Cargar índice de nombres de la categoría existente en admin para heredar links/precios
function buildAdminIndex(cat) {
  return Object.fromEntries((adminData[cat] || []).map(p => [p.nombre, p]));
}

function carryOver(htmlProd, adminProd) {
  // Prioridad: admin tiene los datos más actualizados de precios/links
  return {
    linkML:    adminProd?.linkML   || htmlProd.linkML  || null,
    linkAmz:   adminProd?.linkAmz  || htmlProd.linkAmz || null,
    precioML:  adminProd?.precioML  ?? htmlProd.precioML  ?? htmlProd.precio ?? null,
    precioAmz: adminProd?.precioAmz ?? htmlProd.precioAmz ?? null,
    estadoML:  adminProd?.estadoML  ?? null,
    activo:    adminProd?.activo    ?? true,
    _updatedAt: adminProd?._updatedAt ?? null,
    imagen:    adminProd?.imagen   || htmlProd.img || null,
    estrellas: htmlProd.estrellas  ?? htmlProd.estrellasML ?? null,
    resenas:   htmlProd.resenas    ?? htmlProd.resenasML   ?? null,
  };
}

function report(cat, added, updated, notFound) {
  console.log(`  ✅ ${cat}: ${updated} actualizados, ${added} nuevos` + (notFound ? `, ⚠ ${notFound} sin match` : ''));
}

// ── 1. FREIDORAS ─────────────────────────────────────────────────────────────
console.log('\n📦 Freidoras');
{
  const prods = extractArray('electrodomesticos/freidoras/index.html', 'productos');
  const idx   = buildAdminIndex('freidoras');
  let added = 0, updated = 0;

  adminData.freidoras = prods.map(p => {
    const adm = idx[p.nombre];
    const especs = cleanNull({
      tipo:           p.tipo  || null,
      capacidad:      fmt(p.capacidad, 'L'),
      potencia:       fmt(p.potencia, 'W'),
      tempMax:        fmt(p.tempMax, '°C'),
      panel:          p.panel || null,
      canastos:       p.canastos != null ? String(p.canastos) : null,
      ventana:        yn(p.ventana),
      antiadherente:  yn(p.antiadherente),
      programas:      p.programas != null ? String(p.programas) : null,
      peso:           fmtPeso(p.peso),
    });
    adm ? updated++ : added++;
    return {
      id: p.id,
      nombre: p.nombre,
      marca: p.marca,
      ...carryOver(p, adm),
      especs,
    };
  });
  report('freidoras', added, updated);
}

// ── 2. BICIS ─────────────────────────────────────────────────────────────────
console.log('\n🚲 Bicis');
{
  const prods = extractArray('bicis/index.html', 'ELECTRICAS');
  const idx   = Object.fromEntries((adminData.bicis || []).map(p => [p.id, p]));
  let added = 0, updated = 0;

  adminData.bicis = prods.map(p => {
    const adm = idx[p.id] || buildAdminIndex('bicis')[p.nombre];
    const especs = cleanNull({
      tipo:        p.tipo       || null,
      autonomia:   fmt(p.autonomia, 'km'),
      velocidad:   fmt(p.velocidad, 'km/h'),
      motor:       p.motorStr   || null,
      bateria:     fmt(p.batWh, 'Wh'),
      batTipo:     p.batTipo    || null,
      removible:   p.batRemovible != null ? yn(p.batRemovible) : null,
      rueda:       p.rueda      || null,
      tiempoCarga: p.tiempoCarga || null,
      cargaMax:    fmt(p.cargaMax, 'kg'),
      ip:          p.ip         || null,
      peso:        fmtPeso(p.peso),
    });
    adm ? updated++ : added++;
    return {
      id: p.id,
      nombre: p.nombre,
      marca: p.marca,
      ...carryOver(p, adm),
      especs,
    };
  });
  report('bicis', added, updated);
}

// ── 3. SUPLEMENTOS → subcategorías individuales ────────────────────────────
// Índice de suplementos existente para heredar precios/links
const supIdx = buildAdminIndex('suplementos');

function syncSuplementos(key, htmlPath, varName, especsFn) {
  console.log(`\n💊 ${key}`);
  const prods = extractArray(htmlPath, varName);
  let added = 0, updated = 0, notFound = 0;

  const existing = Object.fromEntries((adminData[key] || []).map(p => [p.nombre, p]));

  adminData[key] = prods.map(p => {
    const adm = existing[p.nombre] || supIdx[p.nombre];
    if (!adm) notFound++;
    adm ? updated++ : added++;
    const especs = cleanNull(especsFn(p));
    return {
      id: p.id,
      nombre: p.nombre,
      marca: p.marca,
      ...carryOver(p, adm),
      especs,
    };
  });
  report(key, added, updated, notFound);
}

// Proteína
syncSuplementos('proteina', 'suplementos/proteina/index.html', 'productos', p => ({
  tipoProteina:       p.tipoProteina      || null,
  fuenteProteina:     p.fuenteProteina    || null,
  contenidoGramos:    fmt(p.contenidoGramos, 'g'),
  gramosPorPorcion:   fmt(p.gramosPorPorcion, 'g'),
  proteinaPorPorcion: fmt(p.proteinaPorPorcion, 'g'),
  concentracion:      p.concentracionProteina != null ? `${p.concentracionProteina}%` : null,
  costoPorPorcion:    fmtMXN(p.costoPorPorcion),
  costoPor25g:        fmtMXN(p.costoPor25gProteina),
  calorias:           fmt(p.caloriasPorPorcion, 'kcal'),
  carbos:             fmt(p.carbohidratosPorPorcion, 'g'),
  grasas:             fmt(p.grasasPorPorcion, 'g'),
  vegana:             yn(p.vegana),
  glutenFree:         yn(p.glutenFree),
  sugarFree:          yn(p.sugarFree),
}));

// Omega 3
syncSuplementos('omega3', 'suplementos/omega3/index.html', 'productos', p => ({
  porciones:          p.porciones != null ? String(p.porciones) : null,
  porPorcion:         p.porPorcion   || null,
  epa:                fmt(p.epa, 'mg'),
  dha:                fmt(p.dha, 'mg'),
  omegaTotal:         fmt(p.omegaPorPorcion, 'mg'),
  costoPorPorcion:    fmtMXN(p.costoPorPorcion),
  fuenteOmega:        p.fuenteOmega  || null,
  metalesPesados:     yn(p.libreMetalesPesados),
  ifos:               yn(p.certificadoIFOS),
}));

// Magnesio
syncSuplementos('magnesio', 'suplementos/magnesio/index.html', 'productos', p => ({
  formaMagnesio:      p.formaMagnesio     || null,
  compuesto:          p.compuestoMagnesio || null,
  mgMagnesio:         fmt(p.mgMagnesio, 'mg'),
  mgElemental:        fmt(p.mgMagnesioElemental, 'mg'),
  porPorcion:         p.porPorcion        || null,
  capsulasPorDia:     p.capsulasPorDia != null ? String(p.capsulasPorDia) : null,
  costoPorPorcion:    fmtMXN(p.costoPorPorcion),
  absorcion:          p.absorcion         || null,
  vegano:             yn(p.vegano),
}));

// Creatina
syncSuplementos('creatina', 'suplementos/creatina/index.html', 'productos', p => ({
  tipoCreatina:       p.tipoCreatina      || null,
  presentacion:       p.presentacion      || null,
  contenidoGramos:    fmt(p.contenidoGramos, 'g'),
  grPorPorcion:       fmt(p.creatinaGramosPorPorcion, 'g'),
  costoPorPorcion:    fmtMXN(p.costoPorPorcion),
  costoPor5g:         fmtMXN(p.costoPor5gCreatina),
  pura:               yn(p.creatinaPura),
  adicionales:        Array.isArray(p.componentesAdicionales) && p.componentesAdicionales.length
                        ? p.componentesAdicionales.join(', ') : null,
}));

// Complejo B
syncSuplementos('complejo_b', 'suplementos/complejo-b/index.html', 'PRODUCTOS', p => ({
  capsulasPorDia:  p.capsulasPorDia != null ? String(p.capsulasPorDia) : null,
  porPorcion:      p.porPorcion     || null,
  costoPorPorcion: fmtMXN(p.costoPorPorcion),
  b1:  p.b1 || null, b2:  p.b2 || null, b3:  p.b3 || null,
  b5:  p.b5 || null, b6:  p.b6 || null, b7:  p.b7 || null,
  b9:  p.b9 || null, b12: p.b12 || null,
  formaB12:        p.formaB12 || null,
}));

// ── 4. Eliminar clave suplementos (reemplazada por subcategorías) ─────────
console.log('\n🗑  Eliminando clave "suplementos" (reemplazada por subcategorías)');
delete adminData.suplementos;

// ── 5. Guardar ───────────────────────────────────────────────────────────────
writeFileSync(ADMIN, JSON.stringify(adminData, null, 2), 'utf8');

const totalProds = Object.values(adminData).reduce((s, v) => s + v.length, 0);
console.log(`\n✨ merged-admin.json actualizado — ${totalProds} productos totales`);
const breakdown = Object.entries(adminData).map(([k,v]) => `${k}:${v.length}`).join(', ');
console.log(`   ${breakdown}`);
