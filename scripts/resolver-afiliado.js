#!/usr/bin/env node
/**
 * resolver-afiliado.js — Resuelve un link de afiliado (meli.la/… o
 * mercadolibre.com.mx/social/…) al producto que realmente anuncia.
 *
 * Por qué existe: los links meli.la caen en la página de perfil del afiliado, no
 * en la ficha del producto, así que durante mucho tiempo no hubo forma de sacar
 * el ID de catálogo (mlId) de un link y los IDs se asignaban a mano o adivinando
 * por nombre. Eso produjo IDs equivocados — nov-2026: la AMYET SE1 tenía el
 * catálogo de la AMYET EB26, cuyo único precio ($3,999) se publicó en el inicio
 * como una "bajada del 72%" de una bici que en realidad cuesta $25,000 y está
 * pausada.
 *
 * Resulta que esa página sí trae el producto: en su JSON embebido, el primer
 * elemento de "polycards" es la tarjeta destacada (c_id .../card-featured/...)
 * y su metadata incluye el item (MLM…) y el product_id, que es el mlId de
 * catálogo. Lo demás de la página son recomendaciones: NO tomar el primer
 * /p/MLM… del HTML, que pertenece a esas recomendaciones.
 *
 * Uso:
 *   node scripts/resolver-afiliado.js <url> [<url>…]
 *   import { resolverAfiliado } from './resolver-afiliado.js'
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const TAG_AFILIADO = 'caal101482'; // matt_word de la cuenta de afiliado de comparalo.mx

const un = s => String(s || '').replace(/\\u002F/g, '/').replace(/\\\//g, '/');

/** Extrae el primer objeto JSON balanceado que empieza en `html[i]` ('{'). */
function bloque(html, i) {
  let d = 0, s = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { s = !s; continue; }
    if (s) continue;
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) return html.slice(i, j + 1); }
  }
  return null;
}

/**
 * @returns {Promise<{ok:boolean, motivo?:string, urlFinal:string, afiliado:boolean,
 *   itemId:string|null, mlId:string|null, titulo:string|null, precio:number|null,
 *   pausada:boolean, urlProducto:string|null}>}
 */
export async function resolverAfiliado(url, { timeoutMs = 20000 } = {}) {
  const base = { ok: false, urlFinal: url, afiliado: false, itemId: null, mlId: null, titulo: null, precio: null, pausada: false, urlProducto: null };
  let res, html;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-MX,es;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    html = await res.text();
  } catch (e) {
    return { ...base, motivo: `red: ${e.message}` };
  }
  base.urlFinal = res.url;
  if (!res.ok) return { ...base, motivo: `http ${res.status}` };
  base.afiliado = (res.url + html).includes(TAG_AFILIADO);

  const pc = html.indexOf('"polycards":[');
  if (pc < 0) return { ...base, motivo: 'sin polycards (¿link caído o página distinta?)' };
  const card = bloque(html, html.indexOf('{', pc + 13));
  if (!card) return { ...base, motivo: 'tarjeta destacada ilegible' };

  const meta = /"metadata"\s*:\s*\{/.exec(card);
  const metaObj = meta ? bloque(card, meta.index + meta[0].length - 1) : null;
  const pick = (src, k) => { const m = new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`).exec(src || ''); return m ? un(m[1]) : null; };

  const itemId = pick(metaObj, 'id');
  let mlId = pick(metaObj, 'product_id');
  if (!/^MLM\d{6,12}$/.test(mlId || '')) {
    const pid = pick(metaObj, 'pid'); // MLMP74471805 → MLM74471805
    mlId = /^MLMP\d{6,12}$/.test(pid || '') ? 'MLM' + pid.slice(4) : null;
  }
  const titulo = (/"title"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(card) || [])[1];
  const precio = (/"current_price"\s*:\s*\{\s*"value"\s*:\s*([\d.]+)/.exec(card) || [])[1];
  const urlProd = pick(metaObj, 'url');

  return {
    ...base,
    ok: Boolean(itemId || mlId),
    itemId: /^MLM\d{6,12}$/.test(itemId || '') ? itemId : null,
    mlId,
    titulo: titulo ? un(titulo).replace(/\\"/g, '"') : null,
    precio: precio ? Math.round(Number(precio)) : null,
    pausada: /"type"\s*:\s*"paused"/.test(card),
    urlProducto: urlProd ? (urlProd.startsWith('http') ? urlProd : 'https://' + urlProd) : null,
    motivo: itemId || mlId ? undefined : 'tarjeta sin ids',
  };
}

if (import.meta.filename === process.argv[1]) {
  for (const url of process.argv.slice(2)) {
    const r = await resolverAfiliado(url);
    console.log(`\n${url}`);
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.motivo ?? ''}`);
    console.log(`  afiliado : ${r.afiliado ? 'sí' : 'NO'}`);
    console.log(`  item     : ${r.itemId ?? '—'}`);
    console.log(`  mlId     : ${r.mlId ?? '—'}`);
    console.log(`  título   : ${(r.titulo ?? '—').substring(0, 80)}`);
    console.log(`  precio   : ${r.precio ?? '—'}${r.pausada ? '  ⏸ PAUSADA' : ''}`);
  }
}
