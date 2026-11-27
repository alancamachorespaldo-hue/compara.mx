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
 *                            firma       claves de `especs` con las que se arma el aviso de
 *                                        «posible duplicado» (marca + esas claves). Sin ella no
 *                                        hay aviso: en iPhone esas claves no están en la base y
 *                                        una firma vacía casaría con todos los productos.
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
      // Con qué claves se arma la firma del aviso «posible duplicado». Es un aviso, nunca un
      // descarte: un sabor o un tamaño distinto es otro producto.
      firma: ['contenidoGramos', 'sabor'],
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
    /* catalog-mini.json propio: el de Android (celulares/catalog-mini.json) solo trae
       `android-*`, así que una guía de iPhone no encontraba ahí ni precio vivo ni oferta
       verificada. Las guías de iPhone leen este archivo en C.catalogUrl. */
    catalogMini: {
      salida: ['celulares', 'iphone', 'catalog-mini.json'],
      especs: ['pantalla', 'chip', 'almacenamiento', 'hz'],
    },
    /* Descubrimiento por catálogo en una página de FAMILIAS (nov-2026). A diferencia de
       proteína, aquí un catálogo de ML no es una tarjeta: es una VARIANTE de almacenamiento
       dentro de una familia (iPhone 17 Pro 256 GB ⊂ «iPhone 17 Pro»). Quién decide la familia y
       qué pasa cuando no está claro vive en `scripts/_familias-alta.js`; aquí solo se declara
       de dónde salen los candidatos y qué atributo de ML es cada campo. */
    descubrir: {
      // Términos por generación: la búsqueda tiene offset máximo 100, así que la cobertura se
      // gana con más términos. Se pide de iPhone 15 en adelante porque de ahí para atrás el
      // catálogo de ML está lleno de fichas de reacondicionados viejos que el sitio no cubre.
      terminos: [
        'iphone 18 pro', 'iphone 18', 'iphone 17 pro max', 'iphone 17 pro', 'iphone 17e',
        'iphone 17', 'iphone air', 'iphone 16 pro max', 'iphone 16 pro', 'iphone 16e',
        'iphone 16 plus', 'iphone 16', 'iphone 15 pro max', 'iphone 15 pro', 'iphone 15',
      ],
      // MLM1055 «Celulares y Smartphones» — no tiene subcategorías, y su ranking de más
      // vendidos da 20 productos de todas las marcas; el filtro de clase deja solo los iPhone.
      categoriasML: ['MLM1055'],
      // Medido el 26-nov-2026: los celulares son MLM-CELLPHONES y los accesorios tienen dominio
      // propio (MLM-CELLPHONE_CASES_AND_COVERS, MLM-CELLPHONE_CAMERA_PROTECTORS, MLM-BOOKS…),
      // así que este filtro solo deja teléfonos. Buscar «iphone 17» trae 10 fundas de cada 10.
      dominios: ['MLM-CELLPHONES'],
      // Dos cosas a la vez: que sea Apple y que sea de una generación que el sitio cubre. Sin lo
      // segundo la bandeja se llena de iPhone 6/7/8 —la búsqueda devuelve decenas— que no tienen
      // familia en la página ni sentido comercial.
      clase: { atributos: ['BRAND', 'LINE', 'MODEL'], rx: /iphone\s*(?:1[5-9]|[2-9]\d)|iphone\s*air/i },
      // Coverage real sobre 63 catálogos de iPhone activos (26-nov-2026): MODEL 100%,
      // INTERNAL_MEMORY 98%, DISPLAY_SIZE 96%, cámara 90%, PROCESSOR_MODEL 92% en los viejos
      // pero 5/8 en los nuevos, DISPLAY_REFRESH_RATE 0% en la muestra.
      // NO se mapean `usb` ni `zoom`: en esta página son números editoriales (versión de USB y
      // aumento del tele), no lo que da la API («USB-C»). Volcarlos ahí pintaría basura.
      mapa: {
        MODEL: 'modeloML',
        INTERNAL_MEMORY: 'almacenamiento',
        DISPLAY_SIZE: 'pantalla',
        MAIN_REAR_CAMERA_RESOLUTION: 'camPrincipal',
        PROCESSOR_MODEL: 'chip',
        DISPLAY_REFRESH_RATE: 'hz',
        COLOR: 'color',
      },
      // Solo `almacenamiento` bloquea, y no por rigor: es LA LLAVE de la variante. Sin saber si
      // son 256 o 512 GB no hay dónde meter el producto dentro de su familia. Todo lo demás es
      // de la familia (que ya lo tiene) o editorial, así que exigirlo convertiría cada alta en
      // una captura a mano — el error que ya se pagó en proteína con proteinaPorPorcion.
      obligatorias: ['almacenamiento'],
      recomendadas: ['pantalla', 'camPrincipal', 'chip', 'hz', 'color'],
    },
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
