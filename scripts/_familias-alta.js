/**
 * _familias-alta.js — la regla única para dar de alta un catálogo de Mercado Libre en una página
 * de FAMILIAS (celulares). Decide a qué familia pertenece, cómo se llama la variante y qué se
 * escribe en la base; escribir el HTML es de `agregarVariantes()` en `_html-precios.js`.
 *
 * EL PROBLEMA QUE RESUELVE. En proteína o freidoras, un catálogo de ML es una tarjeta: se empuja
 * al final del array de la página y listo. En `/celulares/iphone/` el array no guarda productos,
 * guarda familias —iPhone 17 Pro— y dentro de cada una sus variantes de almacenamiento. Un
 * catálogo nuevo («iPhone 17 Pro (sólo eSIM) 256GB color plata») no es una tarjeta: es una
 * VARIANTE de una familia que casi siempre ya existe. Así que antes de escribir hay que contestar
 * dos preguntas, y si cualquiera de las dos queda en duda NO se publica:
 *
 *   1. ¿De qué familia es?  Del atributo `MODEL` de la API, normalizado, comparado con el
 *      `nombre` de cada familia de la página y exigiendo coincidencia EXACTA. «iPhone 17 Pro
 *      (sólo eSIM)» → «iphone 17 pro» → familia `iphone-17-pro`. No hay coincidencia por
 *      prefijo ni «se parece bastante»: «iPhone 17» NO cae en «iPhone 17 Pro», y un iPhone 15
 *      —que no tiene familia en la página— se reporta en vez de colarse en la de al lado.
 *      El nombre comercial del anuncio no se usa para esto: es texto de vendedor («Smartphone
 *      Apple iPhone 17 Pro Max 512GB Liberado Nuevo Sellado Garantía») y adivinar ahí es
 *      exactamente la clase de atajo que mete una variante en la familia equivocada.
 *   2. ¿Cuántos GB?  Del atributo `INTERNAL_MEMORY`. Es la llave de la variante: sin ella no hay
 *      dónde colocarla. Por eso `almacenamiento` es la única obligatoria de la categoría.
 *
 * POR QUÉ NO CREA FAMILIAS NUEVAS SOLO. Una familia no es un contenedor: es la ficha editorial
 * del modelo (chip, pulgadas, Hz, versión de USB, aumento del teleobjetivo, colores, y los
 * mensajes de «por $5,000 más duplicas el almacenamiento»). La API no da ni el USB ni el zoom ni
 * los saltos —en esta página son números y textos escritos a mano—, así que una familia creada
 * de oficio saldría medio vacía y la página la pintaría igual que a las curadas, con sus filtros
 * de chip y de cámara en blanco. Entre eso y una línea en el reporte, la línea en el reporte.
 * Un modelo nuevo entra cuando Alan escribe su familia; después, sus variantes entran solas.
 *
 * SE PUEDE FORZAR, Y A MANO. Si el `MODEL` viene raro o es un modelo que Alan quiere colocar él,
 * el JSON de publicación acepta `modeloBase: 'iphone-17-pro'` para esa ficha: eso NO adivina, es
 * una decisión suya y se respeta tal cual (si ese modeloBase no está en la página, se rechaza).
 */

/**
 * Normaliza un nombre de modelo —de la API o de la página— a algo comparable: sin acentos, sin
 * paréntesis («(sólo eSIM)»), sin las palabras que no distinguen un modelo de otro.
 */
export function normalizarModelo(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(apple|smartphone|celular|telefono|movil|liberado|nuevo|sellado)\b/g, ' ')
    .replace(/\b(solo\s+)?e\s*-?\s*sim\b/g, ' ')
    .replace(/\bdual\s*sim\b/g, ' ')
    .replace(/\b[45]g\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "512 GB" | "1 TB" | "1024" → 1024. null si no se entiende: no se adivina. */
export function gbDeTexto(txt) {
  const m = String(txt ?? '').replace(',', '.').match(/([\d.]+)\s*(tb|gb|mb)?\b/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const u = (m[2] || 'gb').toLowerCase();
  if (u === 'tb') n *= 1024;
  if (u === 'mb') n /= 1024;
  n = Math.round(n);
  return n > 0 ? n : null;
}

/** 1024 → "1tb" · 256 → "256gb". El estilo de los ids que ya están en la página. */
const slugGb = gb => (gb % 1024 === 0 ? `${gb / 1024}tb` : `${gb}gb`);

/* `especs.almacenamiento` y el nombre van en GIGAS, siempre, porque es lo que ya hay en la base
   ("iPhone 17 Pro 1024GB", `almacenamiento: "1024 GB"`). Solo el id usa el estilo corto `1tb`,
   que también es el que ya está ahí (`apple-iphone-17-pro-1tb-esim`). */
const textoGb = gb => `${gb} GB`;

/**
 * ¿A qué familia de la página pertenece este catálogo?
 *
 * @param {Array<object>} familias  el array de la página, ya parseado
 * @param {{modelo?:string, modeloBase?:string}} datos
 * @returns {{ok:true, familia:object}|{ok:false, motivo:string}}
 */
export function resolverFamilia(familias, { modelo, modeloBase } = {}) {
  if (modeloBase) {
    const f = familias.find(x => x.modeloBase === modeloBase);
    return f ? { ok: true, familia: f }
      : { ok: false, motivo: `se pidió la familia "${modeloBase}" y no está en la página` };
  }
  const clave = normalizarModelo(modelo);
  if (!clave) {
    return { ok: false, motivo: 'la API no dio el modelo (atributo MODEL): no se puede saber de qué familia es' };
  }
  const iguales = familias.filter(f => normalizarModelo(f.nombre) === clave
    || normalizarModelo(f.modeloBase) === clave);
  if (!iguales.length) {
    return { ok: false, motivo: `no hay familia para "${modelo}" en la página (hay: ${familias.map(f => f.nombre).join(', ')})` };
  }
  // Varias familias con el mismo nombre: pasa cuando el modelo tiene ficha nueva y
  // reacondicionada. Gana la de equipo nuevo; si ni eso desempata, se reporta.
  const nuevas = iguales.filter(f => !f.reacondicionado);
  const cand = nuevas.length ? nuevas : iguales;
  if (cand.length > 1) {
    return { ok: false, motivo: `hay ${cand.length} familias llamadas "${modelo}": dime cuál con modeloBase` };
  }
  return { ok: true, familia: cand[0] };
}

/**
 * Arma la variante que va a la página y el producto que va a `merged-admin.json`.
 *
 * Las características del MODELO (chip, pulgadas, Hz, USB, zoom, serie) salen de la FAMILIA, no
 * de la API: es el mismo teléfono, la familia ya las tiene curadas y la API ni siquiera da el
 * USB ni el zoom en el formato que esta página pinta. La API solo rellena lo que la familia
 * tenga vacío. Lo que es de la variante —capacidad, precio, enlace, imagen— sale del catálogo y
 * del enlace de afiliado.
 *
 * @returns {{ok:true, variante:object, producto:object, avisos:string[]}|{ok:false, motivo:string}}
 */
export function altaVariante({ familia, mlId, especs = {}, precio, linkML, linkAmz = null, imagen = null, idsUsados = new Set() }) {
  const gb = gbDeTexto(especs.almacenamiento);
  if (!gb) return { ok: false, motivo: 'no se pudo leer el almacenamiento (`almacenamiento`): sin eso no hay variante' };
  if (!(precio > 0)) return { ok: false, motivo: 'sin precio' };

  // Id en el estilo de los que ya están: apple-iphone-17-pro-512gb. Si estuviera tomado se le
  // pone sufijo en vez de pisar nada.
  const raiz = `apple-${familia.modeloBase}-${slugGb(gb)}`;
  let id = raiz;
  for (let n = 2; idsUsados.has(id); n++) id = `${raiz}-${n}`;

  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  const pulgadas = num(familia.pantalla) ?? num(especs.pantalla);
  const avisos = [];
  if (!familia.chip && !especs.chip) avisos.push('sin chip: la ficha de la familia lo tiene vacío y la API no lo dio');
  if ((familia.saltos ?? []).length) {
    avisos.push(`revisa los «saltos» de ${familia.modeloBase}: entró una capacidad nueva y esos mensajes se escriben a mano`);
  }

  const variante = {
    id,
    almacenamientoGB: gb,
    precio,
    precioML: precio,
    precioAmz: null,
    linkML,
    linkAmz,
    img: imagen,
    estrellas: null,
    resenas: null,
    vendidos: null,
    preventa: familia.preventa ?? false,
    mlId,
  };

  const producto = {
    id,
    nombre: `${familia.nombre} ${gb}GB`,
    marca: 'Apple',
    mlId,
    mlIdFuente: 'descubrimiento-catalogo',
    linkML,
    linkAmz,
    precioML: precio,
    precioAmz: null,
    precio,
    imagen,
    activo: true,
    estadoML: 'ok',
    estrellas: null,
    resenas: null,
    /* La base guarda estas características como TEXTO con su unidad ("120 Hz", "USB 3", "16x",
       '6.3"') mientras la familia de la página las guarda como números. La conversión va aquí,
       en un solo sitio, y con lo que la familia no tenga se queda en null —nunca deducido. */
    especs: {
      chip: familia.chip ?? especs.chip ?? null,
      pantalla: pulgadas != null ? `${pulgadas}"` : null,
      hz: (num(familia.hz) ?? num(especs.hz)) != null ? `${num(familia.hz) ?? num(especs.hz)} Hz` : null,
      usb: num(familia.usb) != null ? `USB ${familia.usb}` : null,
      zoom: num(familia.zoom) != null ? `${familia.zoom}x` : null,
      almacenamiento: textoGb(gb),
      serie: familia.serie ?? null,
    },
    _modeloBase: familia.modeloBase,
  };

  return { ok: true, variante, producto, avisos };
}
