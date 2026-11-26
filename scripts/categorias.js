#!/usr/bin/env node
/**
 * categorias.js — REGISTRO ÚNICO de categorías de comparalo.mx.
 *
 * Antes cada script llevaba su propia lista (CATALOG en ml-update.js, PAGES en sync-pausas.js,
 * CATALOGOS en generar-catalog-mini.js, DESCUENTOS en generar-bajadas.js…), y una categoría
 * nueva entraba en unas y se olvidaba en otras: por eso cafeteras, smartwatches, refrigeradores,
 * streaming e iPhone recibían precio pero NO recibían pausas — un producto caído se quedaba
 * anunciado en la página aunque estuviera pausado en la base.
 *
 * Ahora la categoría se registra AQUÍ UNA VEZ y entra sola en:
 *   · ml-update.js              precios de Mercado Libre
 *   · revisar-disponibilidad.js detección de catálogos caídos/pausados
 *   · sync-pausas.js            ocultar en la página lo pausado
 *   · generar-catalog-mini.js   catálogo que leen las guías   (si lleva `catalogMini`)
 *   · generar-bajadas.js        bajadas de precio             (si lleva `descuentos`)
 *   · check-site.js             avisa si una categoría de la base no está registrada
 *
 * CÓMO AGREGAR UNA CATEGORÍA NUEVA (televisiones, lentes inteligentes, …):
 *   1. Agrega una entrada a CATEGORIAS con su clave de merged-admin.json, su página y el
 *      nombre del array JS de productos del HTML.
 *   2. Corre `node scripts/sync-pausas.js` una vez (inserta el bloque de pausas en la página).
 *   3. Listo: el workflow diario ya le actualiza precios, le revisa disponibilidad y la pausa.
 *
 * Campos:
 *   clave (la del objeto)  identificador de la PÁGINA. Normalmente igual al de los datos.
 *   datos                  clave en merged-admin.json. Solo se pone si difiere de la clave
 *                          (p. ej. una página dedicada que muestra la misma lista que el hub).
 *   titulo                 nombre legible, para los reportes.
 *   file                   HTML que muestra la lista.
 *   varName                nombre del array JS dentro de ese HTML.
 *   tipo                   'plano' (un objeto por producto) | 'familias' (celulares: familia
 *                          con variantes, cada variante con su propio id).
 *   principal              false en las páginas espejo: no duplican el producto en los reportes.
 *   catalogMini            { salida:[...segmentos de ruta], especs:[...] } si la categoría
 *                          publica catalog-mini.json para las guías.
 *   descuentos             ruta del descuentos.json de la categoría, si lo tiene.
 *   descubrir              configuración del descubrimiento de productos nuevos en el catálogo
 *                          de Mercado Libre (`descubrir-catalogo.mjs`). Solo las categorías que
 *                          la llevan entran en esa corrida. Campos:
 *                            terminos    términos de búsqueda para /products/search.
 *                            categoriasML  categorías de Mercado Libre para el ranking de más
 *                                        vendidos (`/highlights`), la única fuente que asegura
 *                                        que el producto tiene vendedor hoy.
 *                            dominios    domain_id que SÍ son de esta categoría. Lo demás se
 *                                        descarta (un libro de repostería no es proteína).
 *                            clase       { atributos:[…], rx } — además del dominio, el valor de
 *                                        alguno de esos atributos tiene que casar con rx.
 *                            mapa        atributo de ML → clave del esquema `especs` de la
 *                                        categoría. Mapear es decisión de categoría, por eso
 *                                        vive aquí y no en el script.
 *                            obligatorias  claves de `especs` sin las cuales no se deja publicar.
 *                                        Solo se ponen aquí las que la API suele dar: una que
 *                                        nunca da no es un requisito, es un bloqueo.
 *                            recomendadas  las que se avisan en rojo pero no bloquean; si se
 *                                        publica sin ellas entran como `null`, nunca deducidas.
 */

export const CATEGORIAS = {
  // ── Cómputo ────────────────────────────────────────────────────────────────
  laptops: {
    titulo: 'Laptops', file: 'laptops/index.html', varName: 'productos',
    descuentos: 'laptops/descuentos.json',
  },

  // ── Electrodomésticos ──────────────────────────────────────────────────────
  freidoras: {
    titulo: 'Freidoras de aire', file: 'electrodomesticos/freidoras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/freidoras/descuentos.json',
  },
  microondas: {
    titulo: 'Microondas', file: 'electrodomesticos/microondas/index.html', varName: 'micros',
    descuentos: 'electrodomesticos/microondas/descuentos.json',
  },
  cafeteras: {
    titulo: 'Cafeteras', file: 'electrodomesticos/cafeteras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/cafeteras/descuentos.json',
    catalogMini: {
      salida: ['electrodomesticos', 'cafeteras', 'catalog-mini.json'],
      especs: ['tipo', 'capacidad', 'presion', 'vaporizador', 'potencia', 'molinillo'],
    },
  },
  refrigeradores: {
    titulo: 'Refrigeradores', file: 'electrodomesticos/refrigeradores/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/refrigeradores/descuentos.json',
  },
  lavadoras: {
    titulo: 'Lavadoras', file: 'electrodomesticos/lavadoras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/lavadoras/descuentos.json',
  },
  ollas: {
    titulo: 'Ollas', file: 'electrodomesticos/ollas/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/ollas/descuentos.json',
  },

  // ── Suplementos ────────────────────────────────────────────────────────────
  proteina: {
    titulo: 'Proteína', file: 'suplementos/proteina/index.html', varName: 'productos',
    descuentos: 'suplementos/proteina/descuentos.json',
    // Piloto del descubrimiento por catálogo (nov-2026). Los términos salen de la prueba real:
    // con offset máximo 100 la API da ~150 productos por término, así que la cobertura se
    // consigue con varios términos, no paginando más hondo.
    descubrir: {
      terminos: [
        'proteina whey', 'whey protein', 'proteina vegana', 'proteina aislada',
        'proteina isolate', 'proteina en polvo', 'caseina', 'proteina hidrolizada',
        'proteina concentrada', 'whey isolate',
      ],
      // Categorías de ML de las que se pide el RANKING de más vendidos. Es la única fuente que
      // garantiza que el producto se vende hoy: de los 21 pausados conocidos, 0 salen ahí
      // (medido el 26-nov-2026). Da ~20 por categoría, así que es poco pero bueno.
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: { atributos: ['SUPPLEMENT_CLASS', 'MAIN_SUPPLEMENT', 'TRADE_NAME'], rx: /prote|whey|case/i },
      mapa: {
        BRAND: 'marca',
        FLAVOR: 'sabor',
        NET_WEIGHT: 'contenidoGramos',
        SERVING_WEIGHT: 'gramosPorPorcion',
        SERVINGS_NUMBER: 'porciones',
        SUPPLEMENT_CLASS: 'tipoProteina',
        IS_VEGAN: 'vegana',
        IS_GLUTEN_FREE: 'glutenFree',
        SUPPLEMENT_FORMAT: 'presentacion',
      },
      // `obligatorias` BLOQUEA la publicación; `recomendadas` solo avisa. La diferencia la
      // decidió el uso: proteinaPorPorcion no la da la API en NINGÚN producto (0% medido, porque
      // NUTRITIONAL_VALUES_PER_SERVING es texto libre), así que exigirla convertía dar de alta
      // 150 fichas en 150 capturas a mano. Queda como recomendada: se ve en rojo, se puede
      // llenar aquí mismo, y si se publica sin ella entra como `null` —que es lo que esa página
      // ya hace con las fichas incompletas— en vez de deducirla del nombre comercial.
      obligatorias: ['contenidoGramos', 'porciones', 'gramosPorPorcion'],
      recomendadas: ['proteinaPorPorcion', 'sabor', 'tipoProteina'],
    },
  },
  omega3: {
    titulo: 'Omega 3', file: 'suplementos/omega3/index.html', varName: 'productos',
    descuentos: 'suplementos/omega3/descuentos.json',
  },
  magnesio: {
    titulo: 'Magnesio', file: 'suplementos/magnesio/index.html', varName: 'productos',
    descuentos: 'suplementos/magnesio/descuentos.json',
  },
  creatina: {
    titulo: 'Creatina', file: 'suplementos/creatina/index.html', varName: 'productos',
    descuentos: 'suplementos/creatina/descuentos.json',
    catalogMini: {
      salida: ['suplementos', 'creatina', 'catalog-mini.json'],
      especs: ['tipoCreatina', 'presentacion', 'contenidoGramos', 'grPorPorcion', 'porciones', 'costoPor5g', 'pura'],
    },
  },
  complejo_b: {
    titulo: 'Complejo B', file: 'suplementos/complejo-b/index.html', varName: 'PRODUCTOS',
    descuentos: 'suplementos/complejo-b/descuentos.json',
  },
  vitamina_d: {
    titulo: 'Vitamina D', file: 'suplementos/vitamina-d/index.html', varName: 'PRODUCTOS',
    descuentos: 'suplementos/vitamina-d/descuentos.json',
  },

  // ── Videojuegos ────────────────────────────────────────────────────────────
  videojuegos_consolas: {
    titulo: 'Consolas', file: 'videojuegos/consolas/index.html', varName: 'productos',
    descuentos: 'videojuegos/consolas/descuentos.json',
    catalogMini: {
      salida: ['videojuegos', 'consolas', 'catalog-mini.json'],
      especs: ['generacion', 'tipoConsola', 'almacenamiento', 'lectorDiscos', 'formatoJuegos', 'accesorios', 'condicion'],
    },
  },
  videojuegos_controles: {
    titulo: 'Controles', file: 'videojuegos/controles/index.html', varName: 'productos',
    descuentos: 'videojuegos/controles/descuentos.json',
  },
  videojuegos_juegos: {
    titulo: 'Juegos', file: 'videojuegos/juegos/index.html', varName: 'productos',
    descuentos: 'videojuegos/juegos/descuentos.json',
    catalogMini: {
      salida: ['videojuegos', 'juegos', 'catalog-mini.json'],
      especs: ['plataforma', 'formato', 'desarrollador', 'anio', 'genero', 'multijugador'],
    },
  },

  // ── Tecnología ─────────────────────────────────────────────────────────────
  tecnologia_bocinas: {
    titulo: 'Bocinas inteligentes', file: 'tecnologia/bocinas/index.html', varName: 'productos',
    descuentos: 'tecnologia/bocinas/descuentos.json',
  },
  tecnologia_audifonos: {
    titulo: 'Audífonos', file: 'tecnologia/audifonos/index.html', varName: 'productos',
    descuentos: 'tecnologia/audifonos/descuentos.json',
  },
  tecnologia_smartwatches: {
    titulo: 'Smartwatches', file: 'tecnologia/smartwatches/index.html', varName: 'productos',
    descuentos: 'tecnologia/smartwatches/descuentos.json',
  },
  tecnologia_lentes: {
    titulo: 'Lentes inteligentes', file: 'tecnologia/lentes-inteligentes/index.html', varName: 'productos',
  },

  // ── Entretenimiento ────────────────────────────────────────────────────────
  streaming: {
    titulo: 'Streaming', file: 'entretenimiento/streaming/index.html', varName: 'productos',
    descuentos: 'entretenimiento/streaming/descuentos.json',
  },
  televisiones: {
    titulo: 'Televisiones', file: 'entretenimiento/televisiones/index.html', varName: 'productos',
    descuentos: 'entretenimiento/televisiones/descuentos.json',
    /* Las especs de televisiones son campos del propio producto, no un objeto `especs`;
       generar-catalog-mini.js las busca en los dos lugares. */
    catalogMini: {
      salida: ['entretenimiento', 'televisiones', 'catalog-mini.json'],
      especs: ['pulgadas', 'resolucion', 'panel', 'so', 'hdmi', 'hdr', 'bluetooth'],
    },
  },

  // ── Bicis ──────────────────────────────────────────────────────────────────
  // El hub /bicis/ y las páginas dedicadas /bicicletas/… muestran las MISMAS listas:
  // las dedicadas van como espejo (principal:false) para no contar dos veces el producto.
  bicis: {
    titulo: 'Bicis eléctricas', file: 'bicis/index.html', varName: 'ELECTRICAS',
    descuentos: 'bicis/descuentos.json',
  },
  bicisElectricasDed: {
    datos: 'bicis', titulo: 'Bicis eléctricas (página dedicada)', principal: false,
    file: 'bicicletas/bici-electricas/index.html', varName: 'ELECTRICAS',
  },
  bicisMontana: {
    titulo: 'Bicis de montaña', file: 'bicis/index.html', varName: 'MONTANA',
    descuentos: 'bicis/descuentos.json',
  },
  bicisMontanaDed: {
    datos: 'bicisMontana', titulo: 'Bicis de montaña (página dedicada)', principal: false,
    file: 'bicicletas/bici-montana/index.html', varName: 'MONTANA',
  },
  bicisGravelRuta: {
    titulo: 'Bicis gravel y ruta', file: 'bicis/index.html', varName: 'GRAVELRUTA',
    descuentos: 'bicis/descuentos.json',
  },
  bicisGravelDed: {
    datos: 'bicisGravelRuta', titulo: 'Bicis gravel (página dedicada)', principal: false,
    file: 'bicicletas/bici-gravel/index.html', varName: 'GRAVEL',
  },

  // ── Celulares (familias + variantes) ───────────────────────────────────────
  celulares_android: {
    titulo: 'Android', file: 'celulares/android/index.html', varName: 'familias',
    tipo: 'familias', prefix: 'android',
    descuentos: 'celulares/descuentos.json',
    catalogMini: {
      salida: ['celulares', 'catalog-mini.json'],
      especs: ['pantalla', 'ram', 'almacenamiento', 'cam'],
    },
  },
  celulares_iphone: {
    titulo: 'iPhone', file: 'celulares/iphone/index.html', varName: 'familias',
    tipo: 'familias', prefix: 'iphone',
    descuentos: 'celulares/descuentos.json',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Entradas normalizadas: [clavePagina, {datos, tipo, principal, …}] */
export function entradas() {
  return Object.entries(CATEGORIAS).map(([clave, c]) => [clave, {
    tipo: 'plano', principal: true, ...c, datos: c.datos || clave, clave,
  }]);
}

/** Solo las páginas con array plano de productos. */
export const planas = () => entradas().filter(([, c]) => c.tipo === 'plano');

/** Solo las páginas de familias+variantes (celulares). */
export const familias = () => entradas().filter(([, c]) => c.tipo === 'familias');

/** Claves de merged-admin.json registradas (sin duplicar las páginas espejo). */
export function clavesDeDatos() {
  return [...new Set(entradas().map(([, c]) => c.datos))];
}

/** Todas las páginas que muestran una clave de datos dada. */
export function paginasDe(dato) {
  return entradas().filter(([, c]) => c.datos === dato).map(([, c]) => c);
}

/** La entrada principal (no espejo) de una clave de datos. */
export function principalDe(dato) {
  return entradas().find(([, c]) => c.datos === dato && c.principal)?.[1] ?? null;
}

/** Mapa { 'ruta/descuentos.json': ['clave de datos', …] } para generar-bajadas.js. */
export function mapaDescuentos() {
  const out = {};
  for (const [, c] of entradas()) {
    if (!c.descuentos) continue;
    (out[c.descuentos] ??= []).includes(c.datos) || out[c.descuentos].push(c.datos);
  }
  return out;
}

/** Categorías que publican catalog-mini.json para las guías. */
export function conCatalogMini() {
  return entradas().filter(([, c]) => c.catalogMini).map(([, c]) => c);
}

/** Categorías con descubrimiento por catálogo de Mercado Libre configurado. */
export function conDescubrir() {
  return entradas().filter(([, c]) => c.descubrir).map(([, c]) => c);
}

/** Título legible de una clave de datos. */
export function tituloDe(dato) {
  return principalDe(dato)?.titulo ?? dato;
}
