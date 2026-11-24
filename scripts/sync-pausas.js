#!/usr/bin/env node
/**
 * sync-pausas.js — Lleva las pausas por plataforma (pausaML / pausaAmz de merged-admin.json)
 * a las páginas del sitio, sin tocar los links.
 *
 * Inserta en cada página:
 *   1. <script type="application/json" id="pausas">{...}</script>  (antes del <script> del array)
 *   2. un pequeño bucle /*PAUSAS* / que, antes de render(), oculta la plataforma pausada
 *      (pone su link y precio en null) y quita el producto si se queda sin ninguna tienda.
 * El link no se borra de la base: se reactiva poniendo la pausa en "Se muestra".
 *
 * Las páginas salen del registro único scripts/categorias.js — TODAS, incluidas las dedicadas que
 * son espejo del hub. Antes esta lista se llevaba a mano y se quedó corta: cafeteras, smartwatches,
 * refrigeradores, streaming, ollas e iPhone recibían precio pero no pausas.
 *
 * EMPAREJAMIENTO (lo que falló en nov-2026): el id del HTML no siempre es el de la base. En
 * streaming la base usa "streaming-2" y la página usa 2, así que el bucle no encontraba nunca el
 * producto y las 17 pausas no ocultaban nada. Por eso ahora el script LEE el array del HTML y
 * empareja cada producto pausado por id y, si no coincide, por su linkML o su linkAmz; el bloque
 * que se escribe en la página lleva ya los ids del HTML. Si un producto pausado no aparece en la
 * página, se avisa en la salida en vez de fallar en silencio.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { planas, familias as familiasCats } from './categorias.js';

const ROOT = resolve(import.meta.dirname, '..');
const db = JSON.parse(readFileSync(resolve(ROOT, 'scripts/merged-admin.json'), 'utf8'));

// Loop para arrays planos. Quita el producto si al aplicar la pausa se queda SIN NINGUNA tienda:
// desde la baja de la cuenta de Amazon casi ningún producto tiene linkAmz, así que pausar ML
// dejaba la tarjeta en la página sin precio y sin botón.
const loopFor = v => `\n/*PAUSAS*/try{var _PZ=JSON.parse(document.getElementById('pausas').textContent||'{}');for(var _i=${v}.length-1;_i>=0;_i--){var _p=${v}[_i];var _z=_PZ[_p.id];if(!_z)continue;if(_z.ml){_p.linkML=null;_p.precioML=null;_p.pausaML=true;}if(_z.amz){_p.linkAmz='';_p.precioAmz=null;_p.pausaAmz=true;}if(!_p.linkML&&!_p.linkAmz)${v}.splice(_i,1);}}catch(e){}\n`;

// Loop para familias+variantes (celulares). Cada variante trae su propio id desde nov-2026.
const loopForCel = v => `\n/*PAUSAS*/try{var _PZ=JSON.parse(document.getElementById('pausas').textContent||'{}');for(var _fi=${v}.length-1;_fi>=0;_fi--){var _f=${v}[_fi];for(var _vi=(_f.variantes||[]).length-1;_vi>=0;_vi--){var _v=_f.variantes[_vi];var _z=_PZ[_v.id];if(!_z)continue;if(_z.ml){_v.linkML=null;_v.precio=null;_v.precioML=null;_v.pausaML=true;}if(_z.amz){_v.linkAmz=null;_v.precioAmz=null;_v.pausaAmz=true;}}_f.variantes=(_f.variantes||[]).filter(function(vv){return vv.linkML||vv.linkAmz;});if(!_f.variantes.length)${v}.splice(_fi,1);}}catch(e){}\n`;

/** Texto del array JS `varName` dentro del HTML (con los corchetes). */
function textoArray(html, varName) {
  const m = html.match(new RegExp(String.raw`(?:const|var|let)\s+${varName}\s*=\s*\[`));
  if (!m) return null;
  const s = html.indexOf('[', m.index);
  let d = 0;
  for (let i = s; i < html.length; i++) {
    if (html[i] === '[') d++;
    else if (html[i] === ']' && --d === 0) return { texto: html.slice(s, i + 1), inicio: s, fin: i + 1 };
  }
  return null;
}

/**
 * Lo que NO debe verse en la página de una categoría:
 *   · lo pausado por plataforma (pausaML / pausaAmz): se oculta solo esa tienda;
 *   · lo RETIRADO de la base (_eliminado, activo:false o _publicar:false): se oculta entero,
 *     marcando las dos plataformas, con lo que el bucle lo saca de la lista.
 * Lo segundo lo hacía sync-html.js, pero solo cubre 5 categorías y además necesita que la
 * categoría exista en productos.json, así que a Android, iPhone, Consolas y Juegos no los
 * limpiaba nadie: en nov-2026 las páginas seguían anunciando 12 productos que la base daba por
 * muertos (un Galaxy S26 a $20,999, una Xbox Series X sin link de compra). Aquí se cubren TODAS
 * las páginas del registro, con el mismo emparejamiento por id o por link.
 */
function ocultosDe(dato) {
  return (db[dato] || [])
    .filter(p => p.pausaML || p.pausaAmz || p._eliminado === true || p.activo === false ||
                 p._publicar === false || (!p.linkML && !p.linkAmz))
    .map(p => {
      // Sin ninguna tienda en la base tampoco debe verse: el array del HTML puede seguir
      // llevando un link viejo (es lo que pasa con un link muerto retirado, que sale de la base
      // pero sigue escrito en la página).
      const retirado = p._eliminado === true || p.activo === false || p._publicar === false ||
                       (!p.linkML && !p.linkAmz);
      return {
        id: String(p.id), linkML: p.linkML || null, linkAmz: p.linkAmz || null,
        // El link retirado sirve para emparejar: en la página sigue escrito, y en categorías como
        // streaming el id de la base (streaming-2) no es el del HTML (2), así que sin esto el
        // producto se quedaba a la vista con su link muerto.
        linkMuerto: p._linkMuerto || null,
        z: retirado ? { ml: 1, amz: 1 } : Object.assign(p.pausaML ? { ml: 1 } : {}, p.pausaAmz ? { amz: 1 } : {}),
        retirado,
        nombre: p.nombre,
      };
    });
}

/**
 * Empareja los pausados de la base con los productos del HTML y devuelve el mapa que se escribe
 * en la página, con los ids TAL COMO los usa el HTML. Primero por id, luego por link.
 */
function emparejar(itemsHtml, pausados) {
  const data = {};
  const porId = new Map(pausados.map(p => [p.id, p]));
  const porLink = new Map();
  for (const p of pausados) {
    if (p.linkML) porLink.set(p.linkML, p);
    if (p.linkAmz) porLink.set(p.linkAmz, p);
    if (p.linkMuerto) porLink.set(p.linkMuerto, p);
  }
  const usados = new Set();
  for (const it of itemsHtml) {
    if (it == null) continue;
    const id = String(it.id);
    const match = porId.get(id) || (it.linkML && porLink.get(it.linkML)) || (it.linkAmz && porLink.get(it.linkAmz));
    if (!match) continue;
    data[id] = match.z;
    usados.add(match);
  }
  return { data, sinEncontrar: pausados.filter(p => !usados.has(p)) };
}

/**
 * Escribe en una página el tag de datos (uno por página) y un bucle por cada array que tenga.
 * `specs` es [{ varName, tipo }]: una página puede llevar varios arrays (/bicis/ lleva
 * ELECTRICAS, MONTANA y GRAVELRUTA) y los tres comparten el mismo tag `#pausas`.
 */
function escribirEnPagina(file, specs, data, visibles = null) {
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) return false;
  let html = readFileSync(abs, 'utf8');
  const tag = `<script type="application/json" id="pausas">${JSON.stringify(data)}</script>`;

  // 1. Tag de datos: reemplazar si existe, si no insertar antes del <script> del primer array.
  if (/<script type="application\/json" id="pausas">/.test(html)) {
    html = html.replace(/<script type="application\/json" id="pausas">[\s\S]*?<\/script>/, tag);
  } else {
    const loc = textoArray(html, specs[0].varName);
    if (!loc) { console.log(file + ': no se encontró el array ' + specs[0].varName); return false; }
    const scriptStart = html.lastIndexOf('<script', loc.inicio);
    html = html.slice(0, scriptStart) + tag + '\n' + html.slice(scriptStart);
  }

  // 2. Bucles que aplican las pausas. Se borran TODOS los de la corrida anterior y se escribe uno
  // por array. Antes se escribía uno solo y, en una página con varios arrays, cada categoría
  // borraba el bucle y el tag de la anterior: en /bicis/ sobrevivía únicamente el de gravel/ruta,
  // así que 10 bicis pausadas en el gestor seguían publicándose (nov-2026).
  // `(?:\r?\n)*` y no `\n?`: estas páginas están guardadas con CRLF, así que con `\n?` quedaba un
  // salto suelto en cada corrida y, como el workflow corre a diario, acumulaban una línea en
  // blanco por día (se vio corriendo el script tres veces seguidas: +3, +4, +5 líneas).
  html = html.replace(/(?:\r?\n)*\/\*PAUSAS\*\/[\s\S]*?catch\(e\)\{\}(?:\r?\n)*/g, '\n');
  for (const s of specs) {
    const loop = s.tipo === 'familias' ? loopForCel(s.varName) : loopFor(s.varName);
    const loc = textoArray(html, s.varName);
    if (!loc) { console.log(file + ': no se encontró el array ' + s.varName + ' (2ª pasada)'); return false; }
    let ins = loc.fin;
    if (html[ins] === ';') ins++;
    html = html.slice(0, ins) + loop + html.slice(ins);
  }
  // Siempre exactamente una línea en blanco antes y después del bloque, corra una vez o cien.
  html = html.replace(/(?:\r?\n){2,}\/\*PAUSAS\*\//g, '\n/*PAUSAS*/')
             .replace(/(\/\*PAUSAS\*\/[^\n]*catch\(e\)\{\})(?:\r?\n){2,}/g, '$1\n\n');

  // El contador del hero ("48 modelos para comparar") está escrito en el HTML. Al pausar
  // productos dejaba de cuadrar con lo que la página muestra (streaming anunciaba 48 y pintaba
  // 31), así que se reescribe aquí con el número real.
  if (visibles != null) {
    html = html.replace(/(class="cmx-hero-m__count"[\s\S]{0,400}?)(\d+)(\s+modelos para comparar)/,
      (_, pre, _n, post) => pre + visibles + post);
  }

  writeFileSync(abs, html);
  return true;
}

/** Lee el array del HTML y devuelve la lista de productos (o de variantes, en celulares). */
function itemsDePagina(file, varName, tipo) {
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) return null;
  const html = readFileSync(abs, 'utf8');
  const loc = textoArray(html, varName);
  if (!loc) return null;
  let arr;
  try { arr = new Function(`return ${loc.texto}`)(); }
  catch (e) { console.log(`${file}: no se pudo leer el array ${varName} (${e.message.slice(0, 50)})`); return null; }
  return tipo === 'familias' ? arr.flatMap(f => f.variantes || []) : arr;
}

let total = 0;
const avisos = [];

// Las categorías se agrupan POR ARCHIVO: /bicis/ es la página de tres categorías y su tag
// `#pausas` tiene que llevar las pausas de las tres juntas, no las de la última que se procese.
const porArchivo = new Map();
for (const [clave, c] of [...planas(), ...familiasCats()]) {
  if (!porArchivo.has(c.file)) porArchivo.set(c.file, []);
  porArchivo.get(c.file).push([clave, c]);
}

for (const [file, grupo] of porArchivo) {
  const data = {};          // el tag de la página: las pausas de todas sus categorías
  const specs = [];         // un bucle por array del archivo
  const info = [];
  let visibles = 0, hayPlana = false;

  for (const [clave, c] of grupo) {
    const pausados = ocultosDe(c.datos);
    const items = itemsDePagina(c.file, c.varName, c.tipo);
    if (items === null) { avisos.push(`${clave}: no se pudo leer ${c.file}`); continue; }

    const { data: datosCat, sinEncontrar } = emparejar(items, pausados);
    Object.assign(data, datosCat);
    if (!specs.some(s => s.varName === c.varName)) specs.push({ varName: c.varName, tipo: c.tipo });
    // Cuántos quedan a la vista tras aplicar las pausas (para el contador del hero).
    if (c.tipo !== 'familias') {
      hayPlana = true;
      visibles += items.filter(it => {
        if (it == null) return false;
        const z = datosCat[String(it.id)] || {};
        return (!z.ml && it.linkML) || (!z.amz && it.linkAmz);
      }).length;
    }
    info.push({
      clave, n: Object.keys(datosCat).length, pausados: pausados.length,
      retirados: pausados.filter(p => p.retirado).length,
      // Un retirado que no está en la página es lo normal (nunca se publicó, o ya se borró del
      // HTML); solo se avisa de los PAUSADOS que no aparecen, que sí delatan ids descuadrados.
      sinEncontrar: sinEncontrar.filter(p => !p.retirado),
    });
  }

  if (!specs.length) continue;
  if (!escribirEnPagina(file, specs, data, hayPlana ? visibles : null)) continue;

  for (const { clave, n, pausados, retirados, sinEncontrar } of info) {
    total += n;
    console.log(clave.padEnd(24) + String(n).padStart(3) + ' de ' + String(pausados).padStart(3) +
      ' ocultamiento(s)' + (retirados ? ' (' + retirados + ' retirado(s) de la base)' : ''));
    // Un pausado que no está en la página no es un error: puede que nunca se publicara. Pero si
    // son muchos, suele significar que los ids de la página y los de la base ya no casan.
    if (sinEncontrar.length) {
      avisos.push(`${clave}: ${sinEncontrar.length} producto(s) pausado(s) no están en ${file}` +
        (sinEncontrar.length > 3 ? ' — revisa si los ids de la página y los de la base siguen casando' : ''));
    }
  }
}

console.log('\n✓ sync-pausas: ' + total + ' ocultamientos aplicados en las páginas (pausas + retirados)');
if (avisos.length) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log('  · ' + a);
}
