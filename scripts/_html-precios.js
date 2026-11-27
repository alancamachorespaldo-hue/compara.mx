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

/**
 * Agrega productos NUEVOS al final del array JS de una página.
 *
 * POR QUÉ AQUÍ. Es la misma regla de siempre —el array del HTML es lo que ve el visitante— pero
 * al revés que `quitarProductos`. Vive junto a sus hermanas para que nadie vuelva a escribir una
 * segunda forma de tocar ese array.
 *
 * EL ESQUEMA LO MANDA LA PÁGINA, NO LA BASE. Cada categoría tiene su propio juego de campos
 * (proteína pinta `proteinaPorPorcion`, freidoras `potencia`) y el renderizador de la tarjeta lee
 * esos nombres. Así que las claves del bloque nuevo se copian del PRIMER producto que ya existe
 * en la página: lo que no sepamos entra como `null` —que es justo lo que esas páginas ya hacen
 * con las fichas incompletas— y nada se inventa ni se agrega una clave que nadie pinta.
 *
 * Igual que `quitarProductos`, PARSEA el array antes de escribirlo: si el bloque nuevo lo dejara
 * roto, la página no enseñaría ni un producto, que es mucho peor que no agregar el producto.
 *
 * @param {string} abs      ruta absoluta del HTML
 * @param {string} varName  nombre del array dentro del HTML
 * @param {'plano'|'familias'} tipo
 * @param {Array<object>} productos  objetos ya listos (sus claves se filtran contra el esquema)
 * @param {{dryRun?:boolean}} opts
 */
export function agregarProductos(abs, varName, tipo, productos, opts = {}) {
  const vacio = { agregados: 0, pedidos: productos.length };
  if (tipo === 'familias') return { ok: false, motivo: 'página de familias: la variante se agrega a mano', ...vacio };
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo', ...vacio };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}`, ...vacio };

  const arrayText = html.slice(loc.start, loc.end);
  let actuales;
  try { actuales = new Function('return ' + arrayText)(); } catch (e) {
    return { ok: false, motivo: `el array de la página no se pudo leer (${e.message})`, ...vacio };
  }
  if (!Array.isArray(actuales) || !actuales.length) {
    return { ok: false, motivo: 'la página no tiene ningún producto del que copiar el esquema', ...vacio };
  }

  const esquema = Object.keys(actuales[0]);
  const yaEstan = new Set(actuales.map(p => String(p.id)));
  const porLink = new Set(actuales.map(p => p.linkML).filter(Boolean));
  const nuevos = productos.filter(p => !yaEstan.has(String(p.id)) && !(p.linkML && porLink.has(p.linkML)));
  if (!nuevos.length) return { ok: true, agregados: 0, pedidos: productos.length, yaEstaban: productos.length };

  const lit = v => {
    if (v === undefined || v === null) return 'null';
    if (typeof v === 'number') return Number.isFinite(v) ? String(+v.toFixed(2)) : 'null';
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
    if (typeof v === 'object') return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ') + ' }';
    return JSON.stringify(String(v));
  };
  const bloques = nuevos.map(p => '  {\n' +
    esquema.map(k => `    ${k}: ${lit(p[k])},`).join('\n') +
    '\n  }');

  const cierre = arrayText.lastIndexOf(']');
  let antes = arrayText.slice(0, cierre).replace(/\s*$/, '');
  if (!antes.replace(/\s/g, '').endsWith('[')) antes += antes.endsWith(',') ? '' : ',';
  const text = `${antes}\n${bloques.join(',\n')},\n]`;

  try {
    const arr = new Function('return ' + text)();
    if (!Array.isArray(arr) || arr.length !== actuales.length + nuevos.length) throw new Error('cuenta inesperada');
  } catch (e) {
    return { ok: false, motivo: `el array quedaría roto (${e.message}): no se tocó la página`, ...vacio };
  }

  if (opts.dryRun) return { ok: true, agregados: nuevos.length, pedidos: productos.length };
  writeFileSync(abs, html.slice(0, loc.start) + text + html.slice(loc.end), 'utf8');
  return { ok: true, agregados: nuevos.length, pedidos: productos.length };
}

/**
 * Lee y PARSEA el array JS de una página, para poder decidir antes de escribir.
 *
 * Existe porque las páginas de familias no se pueden tratar a ciegas: para saber si un catálogo
 * nuevo es una variante de una familia que ya está —y de cuál— hay que leer la página primero.
 *
 * @returns {{ok:boolean, motivo?:string, datos?:Array<object>}}
 */
export function leerArray(abs, varName) {
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo' };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}` };
  try {
    const datos = new Function('return ' + html.slice(loc.start, loc.end))();
    if (!Array.isArray(datos)) throw new Error('no es un array');
    return { ok: true, datos };
  } catch (e) {
    return { ok: false, motivo: `el array ${varName} no se pudo leer (${e.message})` };
  }
}

/** Cierre del `[` o `{` que abre en `i`, dentro de `txt`. -1 si no cierra. */
function cierreDe(txt, i) {
  const abre = txt[i], cierra = abre === '[' ? ']' : '}';
  let d = 0;
  for (let j = i; j < txt.length; j++) {
    if (txt[j] === abre) d++;
    else if (txt[j] === cierra && --d === 0) return j;
  }
  return -1;
}

/** Un objeto plano en una línea, con el estilo del archivo: { id: "x", almacenamientoGB: 256 }. */
function objEnLinea(obj, esquema) {
  const lit = v => {
    if (v === undefined || v === null) return 'null';
    if (typeof v === 'number') return Number.isFinite(v) ? String(+v.toFixed(2)) : 'null';
    if (typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
    return JSON.stringify(String(v));
  };
  return '{ ' + esquema.map(k => `${k}: ${lit(obj[k])}`).join(', ') + ' }';
}

/**
 * Agrega VARIANTES a las familias de una página de celulares (`tipo: 'familias'`).
 *
 * POR QUÉ NO SIRVE `agregarProductos` AQUÍ. En una página plana (proteína, freidoras) un
 * catálogo de Mercado Libre es una tarjeta, así que basta copiar el esquema del primer producto
 * y empujar el objeto al final del array. En celulares el array no guarda productos: guarda
 * FAMILIAS (iPhone 17 Pro) con sus variantes de almacenamiento dentro, y un catálogo nuevo es
 * una variante de una de ellas. Empujarlo al final crearía una familia fantasma sin nombre, sin
 * chip y sin pantalla que la página pintaría como un modelo más.
 *
 * LO QUE NUNCA HACE: inventar la familia. Esta función mete la variante en la familia que el
 * llamador le dice (por `modeloBase`, que es la llave de la página) y se niega —sin tocar el
 * archivo— si esa familia no está, si esa capacidad ya existe en ella o si el `mlId`/`linkML`
 * ya aparecen en otra variante del array. Meter un iPhone en la familia equivocada sería peor
 * que no publicarlo: quien entra a comparar 256 contra 512 GB vería dos teléfonos distintos
 * bajo el mismo nombre. Quién decide la familia está en `_familias-alta.js`.
 *
 * CÓMO ESCRIBE. Cirugía sobre el texto, no reescritura del array: cada variante que ya estaba se
 * copia tal cual, letra por letra, y lo único nuevo es una línea. Así el diff del commit enseña
 * exactamente lo que entró y el formato curado de las otras familias no se mueve. La variante
 * entra ORDENADA por capacidad, porque la página toma la primera como la de referencia y los
 * filtros de almacenamiento leen la lista en orden.
 *
 * RED DE SEGURIDAD: igual que sus hermanas, parsea el array resultante antes de escribirlo y
 * comprueba que el número de familias no cambió y que el de variantes subió exactamente en lo
 * que se pidió. Si algo no cuadra no se escribe nada: una página con el JS roto no enseña ni un
 * teléfono, que es mucho peor que no publicar el producto.
 *
 * @param {string} abs      ruta absoluta del HTML
 * @param {string} varName  nombre del array de familias
 * @param {Array<{modeloBase:string, variante:object}>} items
 * @param {{dryRun?:boolean}} opts
 * @returns {{ok:boolean, motivo?:string, agregadas:number, fallos:Array<{modeloBase:string,mlId:string|null,motivo:string}>}}
 */
export function agregarVariantes(abs, varName, items, opts = {}) {
  const vacio = { agregadas: 0, fallos: [] };
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo', ...vacio };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}`, ...vacio };

  const arrayText = html.slice(loc.start, loc.end);
  let familias;
  try { familias = new Function('return ' + arrayText)(); } catch (e) {
    return { ok: false, motivo: `el array de la página no se pudo leer (${e.message})`, ...vacio };
  }
  if (!Array.isArray(familias) || !familias.length) {
    return { ok: false, motivo: 'la página no tiene ninguna familia', ...vacio };
  }

  const EOL = html.includes('\r\n') ? '\r\n' : '\n';
  const todas = familias.flatMap(f => f.variantes ?? []).filter(v => v && typeof v === 'object');
  // El esquema de la variante lo manda la PÁGINA, no la base: sus claves son las que lee el
  // renderizador de la tarjeta. Lo que no sepamos entra como `null`, igual que ya hacen las
  // variantes incompletas que están ahí.
  const esquemaGlobal = Object.keys(todas.reduce((a, b) => (Object.keys(b).length > Object.keys(a || {}).length ? b : a), todas[0]) ?? {});
  const mlIds = new Set(todas.map(v => v.mlId).filter(Boolean));
  const links = new Set(todas.map(v => v.linkML).filter(Boolean));
  const ids = new Set(todas.map(v => v.id).filter(Boolean));

  const fallos = [];
  const porFamilia = new Map();
  /* Las capacidades ocupadas de cada familia, CONTANDO las que entran en esta misma llamada.
     Mirar solo las que ya estaban en el HTML no basta: Mercado Libre tiene una ficha de catálogo
     por COLOR, así que de una tanda salen seis «iPhone 16 Plus 128 GB» —negro, blanco, rosa…—
     que son el mismo teléfono y el mismo hueco. Sin esto, las seis pasaban el filtro (cada una
     comparada contra la página original, donde no había ninguna) y la familia acababa con seis
     variantes de 128 GB. Visto el 27-nov-2026 en la primera tanda de verdad, 46 enlaces. */
  const ocupadas = new Map();
  const capsDe = i => {
    if (!ocupadas.has(i)) {
      ocupadas.set(i, new Set((familias[i].variantes ?? []).map(x => x && x.almacenamientoGB).filter(Boolean)));
    }
    return ocupadas.get(i);
  };
  for (const it of items) {
    const v = it.variante ?? {};
    const nota = m => fallos.push({ modeloBase: it.modeloBase, mlId: v.mlId ?? null, motivo: m });
    const i = familias.findIndex(f => f.modeloBase === it.modeloBase);
    if (i === -1) { nota(`no hay ninguna familia con modeloBase "${it.modeloBase}" en la página`); continue; }
    const gb = v.almacenamientoGB;
    if (!(gb > 0)) { nota('la variante no trae almacenamientoGB: no hay dónde colocarla'); continue; }
    if (capsDe(i).has(gb)) {
      nota(`la familia ${it.modeloBase} ya tiene la variante de ${gb} GB`); continue;
    }
    if (v.mlId && mlIds.has(v.mlId)) { nota(`el catálogo ${v.mlId} ya está en otra variante de la página`); continue; }
    if (v.linkML && links.has(v.linkML)) { nota('ese enlace ya está en otra variante de la página'); continue; }
    if (v.id && ids.has(v.id)) { nota(`el id "${v.id}" ya está en la página`); continue; }
    capsDe(i).add(gb);
    if (v.mlId) mlIds.add(v.mlId);
    if (v.linkML) links.add(v.linkML);
    if (v.id) ids.add(v.id);
    if (!porFamilia.has(i)) porFamilia.set(i, []);
    porFamilia.get(i).push(v);
  }

  let pedidas = [...porFamilia.values()].reduce((n, l) => n + l.length, 0);
  if (!pedidas) return { ok: true, agregadas: 0, fallos };

  // Los bloques de primer nivel del texto son las familias, en el mismo orden que `familias`.
  const bloques = topBlocks(arrayText);
  if (bloques.length !== familias.length) {
    return { ok: false, motivo: 'el texto del array y su contenido no cuadran: no se toca la página', agregadas: 0, fallos };
  }

  let text = arrayText;
  // De atrás hacia adelante: cada inserción mueve los índices de lo que viene después.
  for (const i of [...porFamilia.keys()].sort((a, b) => b - a)) {
    const nuevas = porFamilia.get(i);
    const bloque = text.slice(bloques[i].s, bloques[i].e);
    const mv = bloque.match(/["']?variantes["']?\s*:\s*\[/);
    const vIni = mv ? bloque.indexOf('[', mv.index) : -1;
    const vFin = vIni >= 0 ? cierreDe(bloque, vIni) : -1;
    if (vFin < 0) {
      for (const v of nuevas) fallos.push({ modeloBase: familias[i].modeloBase, mlId: v.mlId ?? null, motivo: 'no se encontró su array `variantes` en el HTML' });
      pedidas -= nuevas.length;
      continue;
    }
    const vTexto = bloque.slice(vIni, vFin + 1);
    const partes = topBlocks(vTexto).map(b => vTexto.slice(b.s, b.e));
    /* El esquema se copia de la variante MÁS COMPLETA de la familia, no de la primera, y se le
       suman las claves que tengan las demás familias. La primera del iPhone 16 Plus no traía
       `mlId`, así que las seis variantes que entraron el 27-nov-2026 nacieron sin él: la base sí
       lo tenía y la página no, y eso es justo el dato con el que se vuelve a encontrar el
       producto en el catálogo. Una clave de más entra como `null`; una de menos se pierde. */
    const existentes = (familias[i].variantes ?? []).filter(v => v && typeof v === 'object');
    const rica = existentes.reduce((a, b) => (Object.keys(b).length > Object.keys(a || {}).length ? b : a), existentes[0]);
    const esquema = Object.keys(rica ?? {});
    for (const k of esquemaGlobal) if (!esquema.includes(k)) esquema.push(k);
    const orden = (familias[i].variantes ?? []).map(v => (v && v.almacenamientoGB) || 0);

    for (const v of nuevas.sort((a, b) => a.almacenamientoGB - b.almacenamientoGB)) {
      const texto = objEnLinea(v, esquema.length ? esquema : (esquemaGlobal.length ? esquemaGlobal : Object.keys(v)));
      let pos = orden.findIndex(gb => gb > v.almacenamientoGB);
      if (pos === -1) pos = partes.length;
      partes.splice(pos, 0, texto);
      orden.splice(pos, 0, v.almacenamientoGB);
    }

    // La sangría se copia del propio archivo; no se da por hecha.
    const sangria = vTexto.match(/\[\s*\r?\n([ \t]+)/)?.[1]
      ?? ' '.repeat((bloque.match(/^([ \t]*)["']?variantes/m)?.[1]?.length ?? 4) + 2);
    const sangriaCierre = sangria.slice(0, Math.max(0, sangria.length - 2));
    const nuevoVTexto = '[' + EOL + partes.map(p => sangria + p + ',').join(EOL) + EOL + sangriaCierre + ']';
    const nuevoBloque = bloque.slice(0, vIni) + nuevoVTexto + bloque.slice(vFin + 1);
    text = text.slice(0, bloques[i].s) + nuevoBloque + text.slice(bloques[i].e);
  }

  if (!pedidas) return { ok: true, agregadas: 0, fallos };

  try {
    const arr = new Function('return ' + text)();
    if (!Array.isArray(arr) || arr.length !== familias.length) throw new Error('cambió el número de familias');
    const ahora = arr.flatMap(f => f.variantes ?? []).length;
    if (ahora !== todas.length + pedidas) throw new Error(`se esperaban ${todas.length + pedidas} variantes y quedaron ${ahora}`);
  } catch (e) {
    return { ok: false, motivo: `el array quedaría mal (${e.message}): no se tocó la página`, agregadas: 0, fallos };
  }

  if (opts.dryRun) return { ok: true, agregadas: pedidas, fallos };
  writeFileSync(abs, html.slice(0, loc.start) + text + html.slice(loc.end), 'utf8');
  return { ok: true, agregadas: pedidas, fallos };
}

/**
 * Quita variantes de las familias de una página de celulares, por su `id`.
 *
 * La hermana de `agregarVariantes`, y hace falta por lo mismo que `quitarProductos` en las
 * páginas planas: cuando un producto sale de la base, su tarjeta tiene que salir de la página en
 * el mismo momento o se queda ahí para siempre, sin nada en la base que la delate.
 *
 * Nació el 27-nov-2026 limpiando un destrozo propio: el candado de «esa capacidad ya existe»
 * miraba la página en disco y no lo que llevaba añadido la misma corrida, así que entraron seis
 * variantes de 128 GB en el iPhone 16 Plus. Se quitan con esto, no a mano.
 *
 * NUNCA deja una familia vacía: si se pidiera quitar su última variante, se niega y lo reporta.
 * Una familia sin variantes se pinta igual, con su nombre y su ficha, pero sin nada que comprar.
 *
 * @param {string} abs      ruta absoluta del HTML
 * @param {string} varName  nombre del array de familias
 * @param {string[]} ids    ids de variante a quitar
 * @param {{dryRun?:boolean}} opts
 * @returns {{ok:boolean, motivo?:string, quitadas:number, fallos:Array<{id:string,motivo:string}>}}
 */
export function quitarVariantes(abs, varName, ids, opts = {}) {
  const vacio = { quitadas: 0, fallos: [] };
  if (!existsSync(abs)) return { ok: false, motivo: 'no existe el archivo', ...vacio };
  const html = readFileSync(abs, 'utf8');
  const loc = locateArray(html, varName);
  if (!loc) return { ok: false, motivo: `sin array ${varName}`, ...vacio };

  const arrayText = html.slice(loc.start, loc.end);
  let familias;
  try { familias = new Function('return ' + arrayText)(); } catch (e) {
    return { ok: false, motivo: `el array de la página no se pudo leer (${e.message})`, ...vacio };
  }

  const fallos = [];
  const porFamilia = new Map();
  for (const id of ids) {
    const i = familias.findIndex(f => (f.variantes ?? []).some(v => v && v.id === id));
    if (i === -1) { fallos.push({ id, motivo: 'no está en ninguna familia de la página' }); continue; }
    if (!porFamilia.has(i)) porFamilia.set(i, new Set());
    porFamilia.get(i).add(id);
  }
  for (const [i, set] of porFamilia) {
    if (set.size >= (familias[i].variantes ?? []).length) {
      for (const id of set) fallos.push({ id, motivo: `dejaría la familia ${familias[i].modeloBase} sin ninguna variante` });
      porFamilia.delete(i);
    }
  }

  const pedidas = [...porFamilia.values()].reduce((n, s) => n + s.size, 0);
  if (!pedidas) return { ok: true, quitadas: 0, fallos };

  const bloques = topBlocks(arrayText);
  if (bloques.length !== familias.length) {
    return { ok: false, motivo: 'el texto del array y su contenido no cuadran: no se toca la página', quitadas: 0, fallos };
  }

  const EOL = html.includes('\r\n') ? '\r\n' : '\n';
  const antes = familias.flatMap(f => f.variantes ?? []).length;
  let text = arrayText;
  for (const i of [...porFamilia.keys()].sort((a, b) => b - a)) {
    const fuera = porFamilia.get(i);
    const bloque = text.slice(bloques[i].s, bloques[i].e);
    const mv = bloque.match(/["']?variantes["']?\s*:\s*\[/);
    const vIni = mv ? bloque.indexOf('[', mv.index) : -1;
    const vFin = vIni >= 0 ? cierreDe(bloque, vIni) : -1;
    if (vFin < 0) {
      for (const id of fuera) fallos.push({ id, motivo: 'no se encontró su array `variantes` en el HTML' });
      continue;
    }
    const vTexto = bloque.slice(vIni, vFin + 1);
    const trozos = topBlocks(vTexto).map(b => vTexto.slice(b.s, b.e));
    const quedan = trozos.filter((t, k) => !fuera.has((familias[i].variantes[k] ?? {}).id));
    const sangria = vTexto.match(/\[\s*\r?\n([ \t]+)/)?.[1] ?? '      ';
    const nuevoVTexto = '[' + EOL + quedan.map(t => sangria + t + ',').join(EOL) + EOL + sangria.slice(0, -2) + ']';
    const nuevoBloque = bloque.slice(0, vIni) + nuevoVTexto + bloque.slice(vFin + 1);
    text = text.slice(0, bloques[i].s) + nuevoBloque + text.slice(bloques[i].e);
  }

  try {
    const arr = new Function('return ' + text)();
    if (!Array.isArray(arr) || arr.length !== familias.length) throw new Error('cambió el número de familias');
    const ahora = arr.flatMap(f => f.variantes ?? []).length;
    if (ahora !== antes - pedidas) throw new Error(`se esperaban ${antes - pedidas} variantes y quedaron ${ahora}`);
    if (arr.some(f => !(f.variantes ?? []).length)) throw new Error('alguna familia se quedaría sin variantes');
  } catch (e) {
    return { ok: false, motivo: `el array quedaría mal (${e.message}): no se tocó la página`, quitadas: 0, fallos };
  }

  if (opts.dryRun) return { ok: true, quitadas: pedidas, fallos };
  writeFileSync(abs, html.slice(0, loc.start) + text + html.slice(loc.end), 'utf8');
  return { ok: true, quitadas: pedidas, fallos };
}
