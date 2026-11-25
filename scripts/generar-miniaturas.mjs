#!/usr/bin/env node
/**
 * generar-miniaturas.mjs — miniaturas empotradas para el Centro de Control.
 *
 * Por qué existe: el artifact corre con una CSP que bloquea TODA imagen externa
 * (solo deja scripts de unos pocos CDNs). Las URLs de http2.mlstatic.com y de
 * m.media-amazon.com que guarda merged-admin.json son correctas —se abren en el
 * navegador— pero dentro del Centro nunca cargan y las tarjetas salen vacías.
 * La única forma de que se vean es mandar los bytes con el artifact, así que
 * aquí se bajan en tamaño miniatura y se guardan como data: URI.
 *
 * Mercado Libre sirve la misma foto en varios tamaños cambiando la letra final
 * (…-F.jpg es la grande, 150 KB; …-I.webp son 90 px y ~1.3 KB) y Amazon con el
 * modificador _AC_SX90_. Bajar la grande y encogerla aquí haría falta sharp, que
 * no está instalado y no se va a instalar: el repo es HTML/CSS/JS puro.
 *
 * Salida: scripts/centro-imagenes.json  { "<categoria>:<id>": "data:image/webp;base64,…" }
 * Se publica al lado del Centro como imagenes.json.
 *
 *   node scripts/generar-miniaturas.mjs [--categoria=a,b] [--forzar] [--concurrencia=8]
 *
 * Es incremental: lo que ya está en el JSON no se vuelve a bajar salvo --forzar
 * o que la URL de origen del producto haya cambiado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(DIR, 'merged-admin.json');
const SALIDA = path.join(DIR, 'centro-imagenes.json');
const MAX_BYTES = 80 * 1024; // una miniatura que pesa más que esto no es miniatura

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const FORZAR = args.includes('--forzar');
const CONC = Number(flag('concurrencia') || 8);
const CATS = flag('categoria')?.split(',').map((s) => s.trim()).filter(Boolean) || null;

/** URL de la versión miniatura de la misma foto. */
export function urlMiniatura(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  if (/mlstatic\.com/.test(url)) {
    // …-F.jpg | …-O.webp | …-V.jpg  →  …-I.webp (90 px)
    const m = url.match(/^(.*)-[A-Z]\.(jpg|jpeg|png|webp)(\?.*)?$/i);
    return m ? `${m[1]}-I.webp` : url;
  }
  if (/media-amazon\.com/.test(url)) {
    // …/I/71ffz3rS1UL._AC_SX679_.jpg  →  …/I/71ffz3rS1UL._AC_SX90_.jpg
    const m = url.match(/^(.*\/I\/[^.]+)\.(?:.*\.)?(jpg|jpeg|png|webp)(\?.*)?$/i);
    return m ? `${m[1]}._AC_SX90_.${m[2]}` : url;
  }
  return url;
}

async function bajar(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; comparalo-mx/1.0)', accept: 'image/webp,image/*' },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const tipo = (r.headers.get('content-type') || 'image/webp').split(';')[0].trim();
  if (!tipo.startsWith('image/')) throw new Error(`no es imagen (${tipo})`);
  return { buf, tipo };
}

async function miniatura(url) {
  const mini = urlMiniatura(url);
  for (const u of mini && mini !== url ? [mini, url] : [url]) {
    try {
      const { buf, tipo } = await bajar(u);
      if (buf.length > MAX_BYTES) continue; // la grande no entra: seguimos al siguiente intento
      return `data:${tipo};base64,${buf.toString('base64')}`;
    } catch { /* probamos la siguiente */ }
  }
  return null;
}

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const previo = fs.existsSync(SALIDA) ? JSON.parse(fs.readFileSync(SALIDA, 'utf8')) : {};
const fuentes = previo.__fuentes || {};
const imagenes = { ...previo };
delete imagenes.__fuentes;

const pendientes = [];
const vigentes = new Set();
for (const [cat, lista] of Object.entries(base)) {
  if (!Array.isArray(lista)) continue;
  if (CATS && !CATS.includes(cat)) {
    for (const p of lista) vigentes.add(`${cat}:${p.id}`); // no se tocan las de otras categorías
    continue;
  }
  for (const p of lista) {
    const k = `${cat}:${p.id}`;
    vigentes.add(k);
    if (!p.imagen) continue;
    const yaEsta = imagenes[k] && fuentes[k] === p.imagen && !FORZAR;
    if (yaEsta) continue;
    pendientes.push({ k, url: p.imagen });
  }
}
// un producto borrado de la base se lleva su miniatura
for (const k of Object.keys(imagenes)) if (!vigentes.has(k)) { delete imagenes[k]; delete fuentes[k]; }

console.log(`Miniaturas: ${pendientes.length} por bajar · ${Object.keys(imagenes).length} ya guardadas`);

let ok = 0, fallo = 0, hechos = 0;
async function worker(cola) {
  for (;;) {
    const t = cola.pop();
    if (!t) return;
    const d = await miniatura(t.url);
    if (d) { imagenes[t.k] = d; fuentes[t.k] = t.url; ok++; } else { delete imagenes[t.k]; delete fuentes[t.k]; fallo++; }
    if (++hechos % 100 === 0) console.log(`  ${hechos}/${pendientes.length}…`);
  }
}
const cola = pendientes.slice().reverse();
await Promise.all(Array.from({ length: Math.max(1, CONC) }, () => worker(cola)));

const salida = { ...imagenes, __fuentes: fuentes };
fs.writeFileSync(SALIDA, JSON.stringify(salida));
const mb = (fs.statSync(SALIDA).size / 1048576).toFixed(2);
console.log(`\n${ok} bajadas · ${fallo} sin imagen · ${Object.keys(imagenes).length} en total`);
console.log(`scripts/centro-imagenes.json — ${mb} MB (se publica como imagenes.json)`);
if (fs.statSync(SALIDA).size > 15 * 1048576) console.warn('OJO: pasa de 15 MB, el artifact no lo va a aceptar.');
