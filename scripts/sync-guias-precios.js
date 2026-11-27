#!/usr/bin/env node
/* sync-guias-precios.js — lleva el precio de Mercado Libre de merged-admin.json a las guías.
 *
 * Las tablas y fichas de las guías tienen el precio escrito a mano y ml-update.js no las toca
 * (solo parchea los arrays de las páginas de categoría), así que se desfasan sin que nadie lo note.
 *
 * Cómo sabe qué precio va dónde, sin adivinar:
 *   · cada familia del array de la guía declara `dbId: '<id de merged-admin.json>'`
 *   · cada precio del HTML lleva `data-cmx-precio="<modeloBase>"`
 * Nada se empareja por nombre ni por número de id.
 *
 * Tope de seguridad: si el precio de la base se aleja más de MAX_SALTO del que tiene la guía,
 * NO se escribe. Un mlId mal asignado en la base (p. ej. un Pixel 9a a $20,794) no debe
 * colarse a una guía de "calidad-precio". Esos casos salen en guias-precios-report.json
 * para revisarlos a mano.
 *
 * Uso:  node scripts/sync-guias-precios.js [--aplicar]      (sin --aplicar solo informa)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const MAX_SALTO = 0.25; // 25%

const GUIAS = [
  'guias/celulares/precios-iphone-mexico/index.html',
  'guias/celulares/iphone-menos-20000-mexico/index.html',
  'guias/celulares/mejores-celulares-menos-5000/index.html',
  'guias/celulares/celulares-menos-3000-mexico/index.html',
  'guias/celulares/mejores-celulares-calidad-precio/index.html',
  'guias/cafeteras/espresso-menos-2000/index.html',
  'suplementos/creatina/creatina-mexico-cual-comprar/index.html',
  'guias/videojuegos/que-consola-comprar-gta-6/index.html',
  'guias/videojuegos/gta-6-guia-completa/index.html',
  'guias/televisiones/smart-tv-menos-5000/index.html',
  'guias/televisiones/smart-tv-menos-3000/index.html',
];

const APLICAR = process.argv.includes('--aplicar');

/* Los ids numéricos se repiten entre categorías (el 1 de laptops y el 1 de creatina), así que
   la búsqueda es por categoría: cada guía declara  category: '<clave de merged-admin.json>'  en
   su CMX_GUIA. Solo si esa clave no existe en la base se cae al mapa global, que es como se
   comportaba antes (las guías de celulares declaran 'celulares' y la base tiene
   'celulares_android', pero sus dbId son cadenas únicas y no colisionan). */
function cargarBase() {
  const db = JSON.parse(readFileSync(join(AQUI, 'merged-admin.json'), 'utf8'));
  const porCat = new Map();
  const global = new Map();
  for (const cat of Object.keys(db)) {
    const m = new Map();
    for (const p of db[cat] || []) if (p.id) { m.set(String(p.id), p); global.set(String(p.id), p); }
    porCat.set(cat, m);
  }
  return { porCat, global };
}

/* Redondeado a pesos, igual que money() de cmx-guia.js: la base guarda precios con centavos
   (televisiones: 4559.24) y una guía que escribiera "$4,559.24" dejaría al siguiente paso un
   precio imposible de volver a emparejar. */
const fmt = (n) => '$' + Math.round(Number(n)).toLocaleString('es-MX');

function procesar(rel, base, reporte) {
  const abs = join(RAIZ, rel);
  let s = readFileSync(abs, 'utf8');
  const original = s;

  // modeloBase → { dbId, precioGuia }
  const familias = new Map();
  /* El precio del array puede traer centavos (`precio: 4559.24`): se captura completo y se
     guarda tal cual, porque la sustitución tiene que coincidir con el texto entero. Si solo
     se leyera la parte entera, al escribir el nuevo precio quedaría "4559.24.24". */
  const re = /modeloBase: *'([^']+)',[\s\S]{0,400}?dbId: *'([^']+)',[\s\S]{0,2000}?precio: *([\d.]+)/g;
  let m;
  while ((m = re.exec(s))) familias.set(m[1], { dbId: m[2], precioGuia: +m[3], precioRaw: m[3] });

  if (!familias.size) {
    reporte.push({ guia: rel, estado: 'sin familias con dbId' });
    return 0;
  }

  const cat = (s.match(/category: *'([^']+)'/) || [])[1] || null;
  const mapaCat = (cat && base.porCat.get(cat)) || null;
  if (cat && !mapaCat) console.log('  · ' + cat + ' no es una categoría de merged-admin.json: se busca por id global');

  let cambios = 0;
  for (const [mb, info] of familias) {
    const p = (mapaCat && mapaCat.get(String(info.dbId))) || base.global.get(String(info.dbId));
    if (!p) { reporte.push({ guia: rel, modeloBase: mb, motivo: 'dbId no existe en la base', dbId: info.dbId }); continue; }
    const nuevo = p.precioML;
    if (!nuevo || nuevo <= 0) { reporte.push({ guia: rel, modeloBase: mb, motivo: 'la base no tiene precioML' }); continue; }
    if (nuevo === info.precioGuia) continue;

    const salto = Math.abs(nuevo - info.precioGuia) / info.precioGuia;
    if (salto > MAX_SALTO) {
      reporte.push({
        guia: rel, modeloBase: mb, motivo: 'salto mayor a ' + Math.round(MAX_SALTO * 100) + '%, no se escribe',
        precioGuia: info.precioGuia, precioBase: nuevo, variacion: Math.round(salto * 100) + '%',
      });
      console.log('  ⚠ ' + mb + ': ' + fmt(info.precioGuia) + ' → ' + fmt(nuevo) + ' (' + Math.round(salto * 100) + '%) · se deja como está');
      continue;
    }

    // Precio dentro del array de la guía
    const reArr = new RegExp("(modeloBase: *'" + mb + "',[\\s\\S]{0,2200}?precio: *)"
      + info.precioRaw.replace(/\./g, '\\.') + "(?![\\d.])");
    if (!reArr.test(s)) { reporte.push({ guia: rel, modeloBase: mb, motivo: 'no se encontró el precio en el array' }); continue; }
    s = s.replace(reArr, (_, pre) => pre + nuevo);

    // Precios estáticos marcados con data-cmx-precio
    const reHtml = new RegExp('(data-cmx-precio="' + mb + '"[^>]*>)\\$[\\d,.]+', 'g');
    const n = (s.match(reHtml) || []).length;
    s = s.replace(reHtml, (_, abre) => abre + fmt(nuevo));

    console.log('  ✓ ' + mb + ': ' + fmt(info.precioGuia) + ' → ' + fmt(nuevo) + '  (' + n + ' en el HTML + 1 en el array)');
    cambios++;
  }

  if (cambios && APLICAR && s !== original) writeFileSync(abs, s, 'utf8');
  return cambios;
}

function main() {
  const base = cargarBase();
  const reporte = [];
  let total = 0;
  for (const g of GUIAS) {
    console.log(g);
    total += procesar(g, base, reporte);
  }
  writeFileSync(join(AQUI, 'guias-precios-report.json'),
    JSON.stringify({ fecha: new Date().toISOString(), maxSalto: MAX_SALTO, revisar: reporte }, null, 2) + '\n', 'utf8');

  console.log('\n' + total + ' producto(s) con precio nuevo' + (APLICAR ? ' · escrito' : ' · simulación, usa --aplicar'));
  if (reporte.length) console.log(reporte.length + ' caso(s) para revisar a mano en scripts/guias-precios-report.json');
}

main();
