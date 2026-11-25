/**
 * _html-precios.js — la regla única para ESCRIBIR un precio dentro del array JS de una página.
 *
 * POR QUÉ EXISTE. El precio que ve el visitante no sale de `merged-admin.json`: sale del array
 * de productos escrito dentro del HTML de cada página. Hasta nov-2026 el único que lo parcheaba
 * era `ml-update.js`, de modo que actualizar la base sin pasar por él dejaba el sitio con el
 * precio viejo — la base decía $1,699 y la página seguía anunciando $1,920. Al montar el plan B
 * de precios (`precios-por-link.mjs`) hacía falta el mismo parcheo, y copiar las funciones habría
 * repetido el error de las listas duplicadas: dos copias que se desincronizan. Viven aquí y las
 * importan los dos.
 *
 * LO QUE NO HACE: no decide qué precio escribir ni valida saltos. Eso es de quien lo llama.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

/** Delimita el array `varName` dentro del HTML. Devuelve {start,end} o null. */
export function locateArray(html, varName) {
  const m = html.match(new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*\\[`, 'm'));
  if (!m) return null;
  const start = html.indexOf('[', m.index);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']' && --depth === 0) return { start, end: i + 1 };
  }
  return null;
}

const BLOCK_ID_RX = /(?:^|[{,\s])["']?id["']?\s*:\s*["'`]?([^,"'`\s}]+)/;
const BLOCK_LINK_RX = /["']?linkML["']?\s*:\s*["'`]([^"'`]+)["'`]/;

/** Objetos de primer nivel del texto del array, con su id y su linkML. */
export function topBlocks(text) {
  const blocks = [];
  let depth = 0, s = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth++ === 0) s = i; }
    else if (text[i] === '}' && --depth === 0) {
      const body = text.slice(s, i + 1);
      blocks.push({
        s, e: i + 1,
        id: body.match(BLOCK_ID_RX)?.[1] ?? null,
        linkML: body.match(BLOCK_LINK_RX)?.[1] ?? null,
      });
    }
  }
  return blocks;
}

// Lee un número de un campo del bloque, venga como 90, "90" o "$2.44".
const campoNum = (block, campo) => {
  const m = block.match(new RegExp(`["']?\\b${campo}["']?\\s*:\\s*["']?\\$?([\\d.]+)`));
  return m ? parseFloat(m[1]) : null;
};
// Reescribe un campo derivado conservando su formato (número suelto o cadena con $).
const setCampo = (block, campo, valor) => block.replace(
  new RegExp(`(["']?\\b${campo}["']?\\s*:\\s*)(["'])?\\$?[\\d.]+(["'])?`),
  (_, pre, q1, q2) => pre + (q1 ? `${q1}$${valor.toFixed(2)}${q2 || q1}` : +valor.toFixed(2)),
);

/**
 * Escribe el precio en un bloque de producto. El costo por porción (y por 5 g / 1000 UI) se
 * recalcula: son precio ÷ porciones, y si no se tocan quedan mintiendo en la tarjeta.
 */
export function patchBlock(block, price) {
  let out = /["']?\bprecioML["']?\s*:/.test(block)
    ? block.replace(/(["']?\bprecioML["']?\s*:\s*)(null|[\d.]+)/, `$1${price}`)
    : block.replace(/(["']?\bprecio["']?\s*:\s*)[\d.]+/, `$1${price}`);
  const porciones = campoNum(out, 'porciones');
  if (porciones > 0) {
    const porPorcion = price / porciones;
    if (/["']?\bcostoPorPorcion["']?\s*:/.test(out)) out = setCampo(out, 'costoPorPorcion', porPorcion);
    const g = campoNum(out, 'contenidoGramos');
    if (/["']?\bcostoPor5g["']?\s*:/.test(out) && g > 0) out = setCampo(out, 'costoPor5g', price / (g / 5));
    const ui = campoNum(out, 'ui');
    if (/["']?\bcostoPor1000ui["']?\s*:/.test(out) && ui > 0) out = setCampo(out, 'costoPor1000ui', porPorcion / (ui / 1000));
  }
  return out;
}

/**
 * Lleva los precios de la base al array JS de una página.
 *
 * @param {string} abs       ruta absoluta del HTML
 * @param {string} varName   nombre del array dentro del HTML
 * @param {'plano'|'familias'} tipo
 * @param {Array<{id:string|number, linkML:string|null, precio:number}>} precios
 * @param {{dryRun?:boolean}} opts
 * @returns {{ok:boolean, motivo?:string, cambios:number, sinEncontrar:number, pedidos:number}}
 *
 * Se empareja por id y, si no coincide, por linkML: el id de la página no siempre es el de la
 * base (en streaming la base usa `streaming-2` y la página `2`), y sin esa segunda llave la
 * categoría entera se quedaba con el precio viejo mientras el script decía "sin cambios".
 * En las páginas de familias (celulares) el id vive en la variante, así que ahí manda el linkML,
 * que es único por variante.
 */
export function escribirPrecios(abs, varName, tipo, precios, opts = {}) {
  const vacio = { cambios: 0, sinEncontrar: 0, pedidos: precios.length };
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo', ...vacio };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}`, ...vacio };

  const arrayText = html.slice(loc.start, loc.end);
  let text = arrayText;
  let cambios = 0;
  const hallados = new Set();

  if (tipo === 'familias') {
    // El precio se escribe en la variante, localizada por su linkML (único en todo el array).
    for (const p of precios) {
      if (!p.linkML) continue;
      const idx = text.indexOf(p.linkML);
      if (idx === -1) continue;
      const bs = text.lastIndexOf('{', idx);
      const be = text.indexOf('}', idx) + 1;
      if (bs < 0 || be <= bs) continue;
      hallados.add(p);
      let block = text.slice(bs, be);
      const antes = block;
      block = block.replace(/(precioML:\s*)[\d.]+/, `$1${p.precio}`);
      block = block.replace(/((?<!precioM)precio:\s*)[\d.]+/, `$1${p.precio}`);
      if (block === antes) continue;
      text = text.slice(0, bs) + block + text.slice(be);
      cambios++;
    }
  } else {
    const porId = new Map(), porLink = new Map();
    for (const p of precios) {
      porId.set(String(p.id), p);
      if (p.linkML) porLink.set(p.linkML, p);
    }
    // De atrás hacia adelante: cada parche cambia la longitud del texto y movería los índices
    // de los bloques siguientes.
    const blocks = topBlocks(arrayText).sort((a, b) => b.s - a.s);
    for (const b of blocks) {
      const p = (b.id != null ? porId.get(String(b.id)) : undefined) ?? (b.linkML ? porLink.get(b.linkML) : undefined);
      if (!p) continue;
      hallados.add(p);
      const antes = text.slice(b.s, b.e);
      const nuevo = patchBlock(antes, p.precio);
      if (nuevo === antes) continue;
      text = text.slice(0, b.s) + nuevo + text.slice(b.e);
      cambios++;
    }
  }

  // Cuántos productos de la base no aparecen en la página por ninguna de las dos llaves: es la
  // señal de que la página y la base no casan, y vale la pena decirlo en vez de callarlo.
  const sinEncontrar = precios.length - hallados.size;

  if (!cambios || opts.dryRun) return { ok: true, cambios, sinEncontrar, pedidos: precios.length };
  writeFileSync(abs, html.slice(0, loc.start) + text + html.slice(loc.end), 'utf8');
  return { ok: true, cambios, sinEncontrar, pedidos: precios.length };
}

/**
 * Saca productos del array JS de una página, de verdad (no los oculta: los quita).
 *
 * POR QUÉ HACE FALTA. Mientras un producto retirado se marcaba en la base (`_eliminado`,
 * `activo:false`), `sync-pausas.js` lo quitaba de la página leyendo esa marca. Desde nov-2026
 * un producto que ya no existe en Mercado Libre se BORRA de `merged-admin.json`, así que esa
 * marca ya no está para que nadie la lea: si la página no se limpia en el mismo momento, la
 * tarjeta se queda ahí para siempre, sin nada en la base que la delate.
 *
 * RED DE SEGURIDAD: el array resultante se parsea antes de escribirlo. Si una coma mal quitada
 * lo dejara roto, no se escribe nada y se devuelve el motivo — una página con el JS roto no
 * enseña ningún producto, que es mucho peor que una tarjeta de más.
 *
 * No cubre las páginas de familias (celulares): ahí el producto es una variante dentro de una
 * familia y quitarla a ciegas puede dejar una familia vacía. Esas se reportan para mirarlas.
 *
 * @returns {{ok:boolean, motivo?:string, quitados:number, noEstaban:number}}
 */
export function quitarProductos(abs, varName, tipo, productos, opts = {}) {
  const vacio = { quitados: 0, noEstaban: productos.length };
  if (tipo === 'familias') return { ok: false, motivo: 'página de familias: hay que quitarlo a mano', ...vacio };
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo', ...vacio };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}`, ...vacio };

  const arrayText = html.slice(loc.start, loc.end);
  const porId = new Map(), porLink = new Map();
  for (const p of productos) {
    porId.set(String(p.id), p);
    if (p.linkML) porLink.set(p.linkML, p);
  }

  // De atrás hacia adelante: cada corte mueve los índices de lo que viene después.
  const blocks = topBlocks(arrayText).sort((a, b) => b.s - a.s);
  let text = arrayText;
  const hallados = new Set();
  for (const b of blocks) {
    const p = (b.id != null ? porId.get(String(b.id)) : undefined) ?? (b.linkML ? porLink.get(b.linkML) : undefined);
    if (!p) continue;
    hallados.add(p);
    let ini = b.s, fin = b.e;
    // La coma que lo unía al vecino sobra: se lleva la de después si la hay, si no la de antes.
    let j = fin;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] === ',') {
      fin = j + 1;
    } else {
      let k = ini - 1;
      while (k >= 0 && /\s/.test(text[k])) k--;
      if (text[k] === ',') ini = k;
    }
    text = text.slice(0, ini) + text.slice(fin);
  }

  const quitados = hallados.size;
  if (!quitados) return { ok: true, quitados: 0, noEstaban: productos.length };

  try {
    const arr = new Function('return ' + text)();
    if (!Array.isArray(arr)) throw new Error('el resultado no es un array');
  } catch (e) {
    return { ok: false, motivo: `el array quedaría roto (${e.message}): no se tocó la página`, quitados: 0, noEstaban: productos.length };
  }

  if (opts.dryRun) return { ok: true, quitados, noEstaban: productos.length - quitados };
  writeFileSync(abs, html.slice(0, loc.start) + text + html.slice(loc.end), 'utf8');
  return { ok: true, quitados, noEstaban: productos.length - quitados };
}
