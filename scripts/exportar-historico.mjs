#!/usr/bin/env node
/**
 * exportar-historico.mjs — saca el histórico de precios a algo que se pueda abrir y guardar:
 * un CSV por categoría más una copia congelada del archivo canónico.
 *
 * POR QUÉ EXISTE. El histórico vive en `scripts/historico-precios.json` en un formato comprimido
 * —tramos de días con registro y solo los PUNTOS DE CAMBIO de precio— que es perfecto para el
 * sitio y espantoso para mirarlo. Esto lo expande a una fila por producto y día, que es como se
 * lee en Excel o en cualquier cosa. Y de paso deja una copia fechada: si un script se equivoca
 * mañana, los días ya registrados siguen estando.
 *
 * LO QUE NO HACE: no interpola. Un día sin registro para un producto se queda vacío, porque un
 * hueco es un dato (pausado, sin stock, sin precio), no un fallo que haya que tapar.
 *
 * LA COSTURA. Cada día lleva de dónde salió su precio:
 *     api              hasta el 22-nov-2026, la oferta más barata del CATÁLOGO
 *     sin_observacion  23 y 24-nov-2026: la API ya daba 403 y no se observó nada
 *     link             del 25-nov en adelante, el precio de la PUBLICACIÓN de nuestro enlace
 * No son la misma medida. Comparar un día `api` con uno `link` inventa subidas y bajadas que
 * nunca pasaron, así que el CSV trae la fuente en cada fila y el resumen avisa.
 *
 * Uso:
 *   node scripts/exportar-historico.mjs                       (todo, a historico-export/<fecha>/)
 *   node scripts/exportar-historico.mjs --categoria=laptops,freidoras
 *   node scripts/exportar-historico.mjs --desde=2026-11-01 --hasta=2026-11-25
 *   node scripts/exportar-historico.mjs --salida=C:/ruta/que/quieras
 *   node scripts/exportar-historico.mjs --solo-cambios        (una fila por cambio de precio)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { pathToFileURL } from 'url';
import { tituloDe } from './categorias.js';

const ROOT = resolve(import.meta.dirname, '..');
const HIST_PATH = resolve(ROOT, 'scripts/historico-precios.json');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');

const arg = n => process.argv.find(a => a.startsWith('--' + n + '='))?.split('=').slice(1).join('=');
const CATS_ARG = (arg('categoria') ?? '').split(',').filter(Boolean);
const DESDE = arg('desde') ?? null;
const HASTA = arg('hasta') ?? null;
const SOLO_CAMBIOS = process.argv.includes('--solo-cambios');
const HOY = new Date().toISOString().slice(0, 10);
const SALIDA = arg('salida') ?? resolve(ROOT, 'historico-export', HOY);

/** Comillas al estilo CSV, y punto y coma como separador para que Excel en español lo abra bien. */
const SEP = ';';
const campo = v => {
  if (v == null) return '';
  const s = String(v);
  return /["\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const fila = arr => arr.map(campo).join(SEP);

/** Expande una serie comprimida a { fecha → precio } solo para los días CON registro. */
function expandir(serie, fechas) {
  const out = new Map();
  const tramos = serie.r ?? [];
  const puntos = serie.p ?? [];
  let iPunto = 0, precio = null;
  for (const f of fechas) {
    while (iPunto < puntos.length && puntos[iPunto][0] <= f) precio = puntos[iPunto++][1];
    const dentro = tramos.some(([a, b]) => f >= a && f <= b);
    if (dentro && precio != null) out.set(f, precio);
  }
  return out;
}

function main() {
  if (!existsSync(HIST_PATH)) { console.error('❌ No está scripts/historico-precios.json'); process.exit(1); }
  const hist = JSON.parse(readFileSync(HIST_PATH, 'utf8'));
  const db = existsSync(ADMIN_PATH) ? JSON.parse(readFileSync(ADMIN_PATH, 'utf8')) : {};

  let fechas = hist.fechas ?? [];
  if (DESDE) fechas = fechas.filter(f => f >= DESDE);
  if (HASTA) fechas = fechas.filter(f => f <= HASTA);
  if (!fechas.length) { console.error('❌ No hay días en ese rango'); process.exit(1); }
  const fuentes = hist.fuentes ?? {};

  // Nombre y categoría de cada serie. La clave es "categoria|id", con "#2", "#3"… cuando la
  // serie se rompió porque el producto cambió de catálogo (es otra publicación, no se empalma).
  const nombreDe = (cat, id) => {
    const p = (db[cat] ?? []).find(x => String(x.id) === String(id));
    return p ? (p.nombre ?? '') : '';
  };

  const porCat = {};
  for (const [clave, serie] of Object.entries(hist.series ?? {})) {
    const corte = clave.lastIndexOf('|');
    if (corte < 0) continue;
    const cat = clave.slice(0, corte);
    if (CATS_ARG.length && !CATS_ARG.includes(cat)) continue;
    const idBruto = clave.slice(corte + 1);
    const partes = idBruto.split('#');
    (porCat[cat] ??= []).push({
      clave, id: partes[0], tramo: partes[1] ? Number(partes[1]) : 1,
      nombre: nombreDe(cat, partes[0]), serie,
    });
  }

  const cats = Object.keys(porCat).sort();
  if (!cats.length) { console.error('❌ Ninguna categoría coincide'); process.exit(1); }

  mkdirSync(SALIDA, { recursive: true });

  const resumen = [];
  let filasTotales = 0;

  for (const cat of cats) {
    const lineas = [fila(['categoria', 'id', 'tramo', 'nombre', 'mlId', 'fecha', 'precio', 'fuente'])];
    let n = 0;
    for (const item of porCat[cat].sort((a, b) => String(a.id).localeCompare(String(b.id)) || a.tramo - b.tramo)) {
      const precios = expandir(item.serie, fechas);
      let previo = null;
      for (const f of fechas) {
        const precio = precios.get(f);
        if (precio == null) { previo = null; continue; }
        // --solo-cambios: una fila por cambio, que es como está guardado y pesa mucho menos.
        if (SOLO_CAMBIOS && previo === precio) continue;
        previo = precio;
        lineas.push(fila([cat, item.id, item.tramo, item.nombre, item.serie.mlId ?? '', f, precio, fuentes[f] ?? '']));
        n++;
      }
    }
    const archivo = join(SALIDA, `${cat}.csv`);
    // BOM para que Excel reconozca el UTF-8 y no destroce los acentos.
    writeFileSync(archivo, '\ufeff' + lineas.join('\r\n') + '\r\n', 'utf8');
    resumen.push({ categoria: cat, titulo: tituloDe(cat), series: porCat[cat].length, filas: n, archivo: `${cat}.csv` });
    filasTotales += n;
  }

  // Copia congelada del archivo canónico: lo que de verdad conserva el histórico.
  const copia = join(SALIDA, 'historico-precios.json');
  writeFileSync(copia, JSON.stringify(hist));

  // Un CSV de todo junto, para quien prefiera una sola hoja.
  const todo = [fila(['categoria', 'id', 'tramo', 'nombre', 'mlId', 'fecha', 'precio', 'fuente'])];
  for (const cat of cats) {
    const txt = readFileSync(join(SALIDA, `${cat}.csv`), 'utf8').replace(/^\ufeff/, '').split('\r\n');
    todo.push(...txt.slice(1).filter(Boolean));
  }
  writeFileSync(join(SALIDA, 'TODO.csv'), '\ufeff' + todo.join('\r\n') + '\r\n', 'utf8');

  const porFuente = {};
  for (const f of fechas) { const k = fuentes[f] ?? 'desconocida'; porFuente[k] = (porFuente[k] ?? 0) + 1; }

  writeFileSync(join(SALIDA, 'resumen.json'), JSON.stringify({
    generado: new Date().toISOString(), desde: fechas[0], hasta: fechas[fechas.length - 1],
    dias: fechas.length, soloCambios: SOLO_CAMBIOS, filas: filasTotales,
    series: cats.reduce((a, c) => a + porCat[c].length, 0),
    diasPorFuente: porFuente, categorias: resumen,
  }, null, 2), 'utf8');

  console.log('\n📦 comparalo.mx — Histórico de precios exportado');
  console.log(`   ${fechas[0]} → ${fechas[fechas.length - 1]} · ${fechas.length} día(s) · ${filasTotales.toLocaleString('es-MX')} filas\n`);
  console.log('   Categoría                 Series   Filas');
  console.log('   ' + '─'.repeat(46));
  for (const r of resumen.sort((a, b) => b.filas - a.filas)) {
    console.log('   ' + String(r.titulo).substring(0, 24).padEnd(25) + String(r.series).padStart(7) + String(r.filas).padStart(8));
  }
  console.log('   ' + '─'.repeat(46));
  console.log('   ' + 'TOTAL'.padEnd(25) + String(cats.reduce((a, c) => a + porCat[c].length, 0)).padStart(7) + String(filasTotales).padStart(8));

  console.log('\n   Días por fuente del precio:');
  for (const [k, v] of Object.entries(porFuente)) {
    const nota = k === 'api' ? 'oferta más barata del catálogo'
      : k === 'link' ? 'precio de la publicación de nuestro enlace'
        : k === 'sin_observacion' ? '⚠ la API ya no respondía: ese día no se observó nada' : '';
    console.log(`     ${k.padEnd(16)} ${String(v).padStart(3)} día(s)   ${nota}`);
  }
  if (porFuente.api && porFuente.link) {
    console.log('\n   ⚠ La serie cruza las dos fuentes, que NO miden lo mismo. Una diferencia entre un');
    console.log('     día "api" y uno "link" puede no ser un cambio de precio, sino un cambio de regla.');
  }
  console.log(`\n   📁 ${SALIDA}`);
  console.log('      · un CSV por categoría + TODO.csv (punto y coma, UTF-8 con BOM: Excel lo abre directo)');
  console.log('      · historico-precios.json — copia congelada del archivo canónico');
  console.log('      · resumen.json\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
