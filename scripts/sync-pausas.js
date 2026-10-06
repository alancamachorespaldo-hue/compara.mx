#!/usr/bin/env node
/**
 * sync-pausas.js — Lleva las pausas por plataforma (pausaML / pausaAmz) de merged-admin.json
 * a las páginas de suplementos, sin tocar los links.
 *
 * Inserta en cada página:
 *   1. <script type="application/json" id="pausas">{...}</script>  (antes del <script> del array)
 *   2. un pequeño bucle /*PAUSAS* / que, antes de render(), oculta la plataforma pausada
 *      (pone su link y precio en null); si están pausadas ambas, quita el producto.
 * El link no se borra de la base: se reactiva poniendo la pausa en "Se muestra".
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const db = JSON.parse(readFileSync(resolve(ROOT, 'scripts/merged-admin.json'), 'utf8'));

const PAGES = {
  creatina:   ['suplementos/creatina/index.html',   'productos'],
  proteina:   ['suplementos/proteina/index.html',   'productos'],
  omega3:     ['suplementos/omega3/index.html',     'productos'],
  magnesio:   ['suplementos/magnesio/index.html',   'productos'],
  complejo_b: ['suplementos/complejo-b/index.html', 'PRODUCTOS'],
  vitamina_d: ['suplementos/vitamina-d/index.html', 'PRODUCTOS'],
};

const loopFor = v => `\n/*PAUSAS*/try{var _PZ=JSON.parse(document.getElementById('pausas').textContent||'{}');for(var _i=${v}.length-1;_i>=0;_i--){var _z=_PZ[${v}[_i].id];if(!_z)continue;if(_z.ml){${v}[_i].linkML=null;${v}[_i].precioML=null;${v}[_i].pausaML=true;}if(_z.amz){${v}[_i].linkAmz='';${v}[_i].precioAmz=null;${v}[_i].pausaAmz=true;}if(_z.ml&&_z.amz)${v}.splice(_i,1);}}catch(e){}\n`;

let total = 0;
for (const [cat, [file, v]] of Object.entries(PAGES)) {
  const abs = resolve(ROOT, file);
  let html = readFileSync(abs, 'utf8');

  const data = {};
  for (const p of (db[cat] || [])) {
    if (!p.pausaML && !p.pausaAmz) continue;
    data[p.id] = Object.assign(p.pausaML ? { ml: 1 } : {}, p.pausaAmz ? { amz: 1 } : {});
  }
  const tag = `<script type="application/json" id="pausas">${JSON.stringify(data)}</script>`;

  // 1. Tag de datos: reemplazar si existe, si no insertarlo justo antes del <script> del array.
  if (/<script type="application\/json" id="pausas">/.test(html)) {
    html = html.replace(/<script type="application\/json" id="pausas">[\s\S]*?<\/script>/, tag);
  } else {
    const re = new RegExp(String.raw`(?:const|var|let)\s+` + v + String.raw`\s*=\s*\[`);
    const m = html.match(re);
    if (!m) { console.log(cat + ': no se encontró el array ' + v); continue; }
    const scriptStart = html.lastIndexOf('<script', m.index);
    html = html.slice(0, scriptStart) + tag + '\n' + html.slice(scriptStart);
  }

  // 2. Bucle que aplica las pausas. Se reemplaza en cada corrida para quedar al día.
  html = html.replace(/\n?\/\*PAUSAS\*\/[\s\S]*?catch\(e\)\{\}\n?/, '\n');
  {
    const re = new RegExp(String.raw`(?:const|var|let)\s+` + v + String.raw`\s*=\s*\[`);
    const m = html.match(re);
    if (!m) { console.log(cat + ': no se encontró el array ' + v); continue; }
    const s = html.indexOf('[', m.index);
    let d = 0, end = -1;
    for (let i = s; i < html.length; i++) { if (html[i] === '[') d++; else if (html[i] === ']' && --d === 0) { end = i; break; } }
    let ins = end + 1; if (html[ins] === ';') ins++;
    html = html.slice(0, ins) + loopFor(v) + html.slice(ins);
  }

  writeFileSync(abs, html);
  const n = Object.keys(data).length;
  total += n;
  console.log(cat.padEnd(11) + n + ' producto(s) con pausa por plataforma');
}
console.log('\n✓ sync-pausas: ' + total + ' pausas aplicadas en las páginas');
