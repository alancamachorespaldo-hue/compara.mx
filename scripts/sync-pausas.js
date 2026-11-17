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

/** Los productos pausados de una categoría de la base. */
function pausadosDe(dato) {
  return (db[dato] || [])
    .filter(p => p.pausaML || p.pausaAmz)
    .map(p => ({
      id: String(p.id), linkML: p.linkML || null, linkAmz: p.linkAmz || null,
      z: Object.assign(p.pausaML ? { ml: 1 } : {}, p.pausaAmz ? { amz: 1 } : {}),
      nombre: p.nombre,
    }));
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

function escribirEnPagina(file, varName, data, loop, visibles = null) {
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) return false;
  let html = readFileSync(abs, 'utf8');
  const tag = `<script type="application/json" id="pausas">${JSON.stringify(data)}</script>`;

  // 1. Tag de datos: reemplazar si existe, si no insertar antes del <script> del array.
  if (/<script type="application\/json" id="pausas">/.test(html)) {
    html = html.replace(/<script type="application\/json" id="pausas">[\s\S]*?<\/script>/, tag);
  } else {
    const loc = textoArray(html, varName);
    if (!loc) { console.log(file + ': no se encontró el array ' + varName); return false; }
    const scriptStart = html.lastIndexOf('<script', loc.inicio);
    html = html.slice(0, scriptStart) + tag + '\n' + html.slice(scriptStart);
  }

  // 2. Bucle que aplica las pausas. Se reemplaza en cada corrida para quedar al día.
  // `(?:\r?\n)*` y no `\n?`: estas páginas están guardadas con CRLF, así que con `\n?` quedaba un
  // salto suelto en cada corrida y, como el workflow corre a diario, acumulaban una línea en
  // blanco por día (se vio corriendo el script tres veces seguidas: +3, +4, +5 líneas).
  html = html.replace(/(?:\r?\n)*\/\*PAUSAS\*\/[\s\S]*?catch\(e\)\{\}(?:\r?\n)*/, '\n');
  const loc = textoArray(html, varName);
  if (!loc) { console.log(file + ': no se encontró el array ' + varName + ' (2ª pasada)'); return false; }
  let ins = loc.fin;
  if (html[ins] === ';') ins++;
  html = html.slice(0, ins) + loop + html.slice(ins);
  // Siempre exactamente una línea en blanco antes y después del bloque, corra una vez o cien.
  html = html.replace(/(?:\r?\n){2,}\/\*PAUSAS\*\//, '\n/*PAUSAS*/')
             .replace(/(\/\*PAUSAS\*\/[^\n]*catch\(e\)\{\})(?:\r?\n){2,}/, '$1\n\n');

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

for (const [clave, c] of [...planas(), ...familiasCats()]) {
  const pausados = pausadosDe(c.datos);
  const items = itemsDePagina(c.file, c.varName, c.tipo);
  if (items === null) { avisos.push(`${clave}: no se pudo leer ${c.file}`); continue; }

  const { data, sinEncontrar } = emparejar(items, pausados);
  // Cuántos quedan a la vista tras aplicar las pausas (para el contador del hero).
  const visibles = items.filter(it => {
    if (it == null) return false;
    const z = data[String(it.id)] || {};
    return (!z.ml && it.linkML) || (!z.amz && it.linkAmz);
  }).length;
  const loop = c.tipo === 'familias' ? loopForCel(c.varName) : loopFor(c.varName);
  if (!escribirEnPagina(c.file, c.varName, data, loop, c.tipo === 'familias' ? null : visibles)) continue;

  const n = Object.keys(data).length;
  total += n;
  console.log(clave.padEnd(24) + String(n).padStart(3) + ' de ' + String(pausados.length).padStart(3) + ' pausa(s) aplicadas');
  // Un pausado que no está en la página no es un error: puede que nunca se publicara. Pero si
  // son muchos, suele significar que los ids de la página y los de la base ya no casan.
  if (sinEncontrar.length) {
    avisos.push(`${clave}: ${sinEncontrar.length} producto(s) pausado(s) no están en ${c.file}` +
      (sinEncontrar.length > 3 ? ' — revisa si los ids de la página y los de la base siguen casando' : ''));
  }
}

console.log('\n✓ sync-pausas: ' + total + ' pausas aplicadas en las páginas');
if (avisos.length) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log('  · ' + a);
}
