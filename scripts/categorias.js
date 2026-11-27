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
 *                                        categoría (o varias claves: `TOTAL_CAPACITY:
 *                                        ['capacidadTotal','capacidadL']`, el mismo dato como
 *                                        texto y como número). Mapear es decisión de categoría,
 *                                        por eso vive aquí y no en el script.
 *                            tipos       cómo se guarda cada clave: 'texto' | 'numero' |
 *                                        'gramos' | 'bool' | 'slug'. Hace falta porque la misma
 *                                        clave se guarda distinto según la categoría: en
 *                                        celulares `pantalla` es el número 6.3 y en laptops el
 *                                        texto '15.6 "'; `contenidoGramos` es número en proteína
 *                                        y "450 g" en creatina.
 *                            valores     vocabulario CERRADO de una clave que la página usa para
 *                                        filtrar: { valor de ML normalizado → valor del sitio }.
 *                                        Lo que no está en la tabla NO se escribe y sale en rojo
 *                                        en el Centro. Es a propósito: el filtro de «formato» de
 *                                        audífonos conoce In-ear/On-ear/Over-ear, así que
 *                                        meterle el "Diadema" de ML no llena el dato, esconde el
 *                                        producto de su propio filtro.
 *                            especsPlanas  true en las cinco categorías que NO guardan un objeto
 *                                        `especs` en la base, sino campos del producto
 *                                        (microondas, refrigeradores, lavadoras, ollas,
 *                                        televisiones). `aplicar-nuevos.mjs` escribe el producto
 *                                        nuevo con la forma que ya tiene su categoría.
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
    /* Medido el 27-nov-2026 sobre la API: el dominio de una laptop es MLM-NOTEBOOKS y los
       accesorios tienen el suyo (MLM-LAPTOP_BRIEFCASES, MLM-LAPTOP_STANDS, MLM-RAM_MEMORY…),
       así que el filtro de dominio solo deja laptops y no hace falta filtro de clase.
       Cobertura de atributos sobre 76 catálogos activos: RAM 74, SSD 70, pantalla 68,
       procesador 63, GPU dedicada 40. */
    descubrir: {
      terminos: [
        'laptop', 'notebook', 'laptop gamer', 'macbook air', 'macbook pro', 'laptop hp',
        'laptop lenovo', 'laptop dell', 'laptop asus', 'laptop acer', 'laptop i7',
        'laptop i5', 'laptop ryzen 7', 'laptop 16gb ram', 'chromebook', 'laptop 2 en 1',
      ],
      categoriasML: ['MLM1652'],
      dominios: ['MLM-NOTEBOOKS'],
      mapa: {
        PROCESSOR_MODEL: 'procesador',
        RAM_MEMORY_MODULE_TOTAL_CAPACITY: 'ram',
        SSD_DATA_STORAGE_CAPACITY: 'almacenamiento',
        DISPLAY_SIZE: 'pantalla',
        DISPLAY_RESOLUTION: 'resolucion',
        DEDICATED_GRAPHIC_CARD_MODEL: 'gpu',
        OS_NAME: 'so',
        WEIGHT: 'peso',
        WITH_TOUCH_SCREEN: 'touch',
        COLOR: 'color',
      },
      /* `pantalla` va como TEXTO ('15.6 "') porque así está en esta base; en celulares la misma
         clave es el número 6.3. Por eso los tipos los declara la categoría. */
      tipos: { pantalla: 'texto', touch: 'texto' },
      obligatorias: ['ram', 'almacenamiento'],
      recomendadas: ['procesador', 'pantalla', 'resolucion', 'gpu', 'so', 'peso', 'touch'],
      firma: ['procesador', 'ram', 'almacenamiento'],
    },
  },

  // ── Electrodomésticos ──────────────────────────────────────────────────────
  freidoras: {
    titulo: 'Freidoras de aire', file: 'electrodomesticos/freidoras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/freidoras/descuentos.json',
    descubrir: {
      terminos: [
        'freidora de aire', 'air fryer', 'freidora de aire doble', 'horno freidora de aire',
        'freidora de aire 8 litros', 'freidora de aire grande', 'freidora sin aceite',
        'air fryer doble canasta', 'freidora de aire con ventana',
      ],
      categoriasML: ['MLM456045'],
      dominios: ['MLM-AIR_FRYERS'],
      mapa: {
        VOLUME_CAPACITY: 'capacidad',
        POWER: 'potencia',
        BASKETS_NUMBER: 'canastos',
        MAX_TEMPERATURE: 'tempMax',
        WITH_SEE_THROUGH_WINDOW: 'ventana',
        WITH_NON_STICK_SURFACE: 'antiadherente',
        WEIGHT: 'peso',
      },
      /* Todo texto con su unidad, como ya está en esta base ("4 L", "1300 W", "200 °C", "Sí").
         `potencia` pasa por wattsTexto porque la API da «1.4 kW» tanto como «1400 W». */
      tipos: {
        capacidad: 'texto', potencia: 'wattsTexto', canastos: 'texto', tempMax: 'texto',
        ventana: 'texto', antiadherente: 'texto', peso: 'texto',
      },
      obligatorias: ['capacidad'],
      /* `tipo` y `panel` NO se mapean: son vocabulario de la página ('freidora-aire',
         'horno-freidora', 'tactil', 'mecanico') y la API habla otro idioma ("Digital",
         "Botones"). Van como recomendadas, en rojo en el Centro, para llenarlas al publicar. */
      recomendadas: ['tipo', 'panel', 'potencia', 'canastos', 'tempMax', 'ventana', 'antiadherente', 'peso'],
      firma: ['capacidad', 'potencia'],
    },
  },
  microondas: {
    titulo: 'Microondas', file: 'electrodomesticos/microondas/index.html', varName: 'micros',
    descuentos: 'electrodomesticos/microondas/descuentos.json',
    descubrir: {
      terminos: [
        'horno de microondas', 'microondas', 'microondas con grill', 'microondas 20 litros',
        'microondas 1.1 pies', 'microondas digital', 'microondas espejo',
        'microondas empotrable', 'microondas inverter',
      ],
      categoriasML: ['MLM1577'],
      dominios: ['MLM-MICROWAVES'],
      // Esta categoría guarda las características como CAMPOS del producto, no en `especs`.
      especsPlanas: true,
      mapa: {
        VOLUME_CAPACITY: 'capacidad',
        POWER: 'potencia',
        POWER_LEVELS: 'nivelPotencia',
        VOLTAGE: 'voltaje',
        COLOR: 'color',
        ALPHANUMERIC_MODEL: 'modelo',
      },
      tipos: {
        capacidad: 'numero', potencia: 'watts', nivelPotencia: 'numero',
        voltaje: 'texto', color: 'slug',
      },
      obligatorias: ['capacidad'],
      // `panel` y `acabado` son vocabulario de la página ('mixto', 'espejo'): a mano.
      recomendadas: ['potencia', 'nivelPotencia', 'panel', 'acabado', 'color', 'modelo'],
      firma: ['capacidad', 'potencia'],
    },
  },
  cafeteras: {
    titulo: 'Cafeteras', file: 'electrodomesticos/cafeteras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/cafeteras/descuentos.json',
    catalogMini: {
      salida: ['electrodomesticos', 'cafeteras', 'catalog-mini.json'],
      especs: ['tipo', 'capacidad', 'presion', 'vaporizador', 'potencia', 'molinillo'],
    },
    descubrir: {
      terminos: [
        'cafetera', 'cafetera espresso', 'cafetera de capsulas', 'cafetera de goteo',
        'cafetera automatica', 'cafetera superautomatica', 'nespresso', 'dolce gusto',
        'cafetera con molino', 'cafetera italiana', 'cafetera percoladora', 'cafetera 12 tazas',
      ],
      categoriasML: ['MLM31573'],
      // Solo las eléctricas: las manuales (prensa francesa, moka) son otro dominio y otra página.
      dominios: ['MLM-ELECTRIC_COFFEE_MAKERS'],
      mapa: {
        COFFEE_MAKER_TYPES: 'tipo',
        WATER_CAPACITY: 'capacidad',
        PRESSURE: 'presion',
        POWER: 'potencia',
        TECHNOLOGY: 'tecnologia',
        RECOMMENDED_DRINKS: 'bebidas',
        COMPATIBLE_CAPSULES: 'compatible',
        INCLUDES_TIMER: 'programable',
      },
      tipos: {
        capacidad: 'texto', presion: 'texto', potencia: 'wattsTexto', programable: 'texto',
      },
      /* `tipo` es el filtro de la página y su vocabulario es el de la casa (Espresso, Goteo,
         Cápsulas, Percoladora); la API dice «Expreso», «Cápsulas monodosis», «De goteo». */
      valores: {
        tipo: {
          'expreso': 'Espresso', 'cafetera espresso': 'Espresso',
          'cafetera espresso cafetera de capsulas': 'Espresso',
          'capsulas monodosis': 'Cápsulas', 'cafetera de capsulas': 'Cápsulas',
          'capsulas monodosis expreso': 'Cápsulas',
          'de goteo': 'Goteo', 'cafetera de goteo': 'Goteo', 'con filtro goteo': 'Goteo',
          'percoladora': 'Percoladora',
        },
        tecnologia: {
          'automatica': 'Automática', 'semi automatica': 'Semi automática',
          'super automatica': 'Superautomática',
        },
      },
      obligatorias: ['capacidad'],
      recomendadas: ['tipo', 'potencia', 'presion', 'tecnologia', 'molinillo', 'vaporizador'],
      firma: ['capacidad', 'potencia'],
    },
  },
  refrigeradores: {
    titulo: 'Refrigeradores', file: 'electrodomesticos/refrigeradores/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/refrigeradores/descuentos.json',
    descubrir: {
      terminos: [
        'refrigerador', 'refrigerador french door', 'refrigerador side by side',
        'refrigerador 2 puertas', 'refrigerador top mount', 'refrigerador inverter',
        'frigobar', 'refrigerador 18 pies', 'refrigerador 11 pies', 'refrigerador con dispensador',
      ],
      categoriasML: ['MLM158119'],
      // Los congeladores son MLM-FREEZERS: otra cosa, fuera.
      dominios: ['MLM-REFRIGERATORS'],
      especsPlanas: true,
      mapa: {
        // El mismo dato en los dos formatos que ya usa esta base: texto y número.
        TOTAL_CAPACITY: ['capacidadTotal', 'capacidadL'],
        DOORS_NUMBER: 'puertas',
        WITH_FREEZER: 'conFreezer',
        WITH_ICE_DISPENSER: 'dispensadorHielo',
      },
      tipos: {
        capacidadTotal: 'texto', capacidadL: 'numero', puertas: 'numero',
        conFreezer: 'bool', dispensadorHielo: 'bool',
      },
      obligatorias: ['capacidadTotal'],
      // `dimensiones` es un texto armado («60 × 70 × 170 cm») y la API da los tres por separado.
      recomendadas: ['puertas', 'conFreezer', 'dispensadorHielo', 'dimensiones'],
      firma: ['capacidadTotal', 'puertas'],
    },
  },
  lavadoras: {
    titulo: 'Lavadoras', file: 'electrodomesticos/lavadoras/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/lavadoras/descuentos.json',
    descubrir: {
      terminos: [
        'lavadora', 'lavadora automatica', 'lavadora carga frontal', 'lavasecadora',
        'lavadora 20 kg', 'lavadora 16 kg', 'lavadora inverter', 'lavadora semiautomatica',
        'lavadora dos tinas', 'lavadora digital',
      ],
      categoriasML: ['MLM27576'],
      dominios: ['MLM-WASHING_MACHINES'],
      especsPlanas: true,
      mapa: {
        WASHING_MACHINE_CAPACITY: 'capacidadKg',
        LOADING_TYPE: 'tipo',
        DEPTH: 'profundidad',
      },
      tipos: { capacidadKg: 'numero', tipo: 'slug', profundidad: 'numero' },
      // El filtro de la página conoce exactamente estos dos valores.
      valores: { tipo: { superior: 'superior', frontal: 'frontal' } },
      obligatorias: ['capacidadKg'],
      recomendadas: ['tipo', 'tinas', 'rpm', 'profundidad'],
      firma: ['capacidadKg', 'tipo'],
    },
  },
  ollas: {
    titulo: 'Ollas', file: 'electrodomesticos/ollas/index.html', varName: 'productos',
    descuentos: 'electrodomesticos/ollas/descuentos.json',
    descubrir: {
      terminos: [
        'olla de presion electrica', 'olla arrocera', 'olla de coccion lenta',
        'multiolla electrica', 'olla electrica', 'olla programable', 'vaporera electrica',
        'olla multifuncional', 'arrocera electrica',
      ],
      categoriasML: ['MLM189675'],
      // Solo las ELÉCTRICAS: las de cocina (MLM-KITCHEN_POTS) no son de esta página.
      dominios: ['MLM-ELECTRIC_POTS_SKILLETS_AND_RICE_COOKERS'],
      especsPlanas: true,
      mapa: {
        VOLUME_CAPACITY: 'capacidadL',
        POWER: 'potenciaW',
        LID_MATERIAL: 'tapaMaterial',
        COLOR: 'color',
        WITH_DIGITAL_DISPLAY: 'displayDigital',
        IS_PROGRAMMABLE: 'programable',
        WITH_KEEP_WARM_FUNCTION: 'mantenerCaliente',
      },
      tipos: {
        capacidadL: 'numero', potenciaW: 'watts',
        displayDigital: 'bool', programable: 'bool', mantenerCaliente: 'bool',
      },
      obligatorias: ['capacidadL'],
      // POT_MATERIAL no existe en este dominio de ML (medido): `material` se llena a mano.
      recomendadas: ['potenciaW', 'material', 'programable', 'mantenerCaliente', 'tapaMaterial'],
      firma: ['capacidadL', 'potenciaW'],
    },
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
  /* Los cinco suplementos comparten dominio (MLM-SUPPLEMENTS) y ranking (MLM438195, el único
     «Suplementos Alimenticios» que responde), así que lo único que los separa es el filtro de
     clase: sin él, buscar «omega 3» y buscar «creatina» acabarían llenando la misma bandeja.
     Y comparten también el límite de la API: los datos por porción (EPA, DHA, mg de magnesio,
     las B, UI de vitamina D) viven en NUTRITIONAL_VALUES_PER_SERVING e INGREDIENTS, que son
     TEXTO LIBRE («690mg de Omega 3 forma TG, 330mg de EPA»). No se deducen: van como
     recomendadas y se escriben a mano, igual que `proteinaPorPorcion` en proteína.
     INGREDIENTS tampoco entra en el filtro de clase, y eso se aprendió probándolo: una proteína
     lleva creatina en la lista de ingredientes, y un multivitamínico lleva magnesio, así que con
     INGREDIENTS la primera corrida metió tres proteínas en la bandeja de creatina. El filtro usa
     lo que dice QUÉ ES el producto (MAIN_SUPPLEMENT, SUPPLEMENT_CLASS, TRADE_NAME, LINE). */
  omega3: {
    titulo: 'Omega 3', file: 'suplementos/omega3/index.html', varName: 'productos',
    descuentos: 'suplementos/omega3/descuentos.json',
    descubrir: {
      terminos: [
        'omega 3', 'omega 3 epa dha', 'aceite de pescado', 'omega 3 salmon', 'aceite de krill',
        'omega 3 1000 mg', 'omega 3 vegano', 'omega 3 de algas', 'omega 3 anchoa', 'fish oil',
      ],
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: {
        atributos: ['MAIN_SUPPLEMENT', 'SUPPLEMENT_CLASS', 'TRADE_NAME', 'LINE'],
        rx: /omega|pescado|fish\s*oil|krill|epa|dha/i,
      },
      mapa: { SERVINGS_NUMBER: 'porciones' },
      tipos: { porciones: 'numero' },
      obligatorias: ['porciones'],
      recomendadas: ['porPorcion', 'epa', 'dha', 'omegaTotal', 'fuenteOmega'],
      // Sin `firma`: la única clave que la API llena es `porciones`, y marca+porciones casaría
      // con medio catálogo. El `mlId` sigue impidiendo el duplicado de verdad.
    },
  },
  magnesio: {
    titulo: 'Magnesio', file: 'suplementos/magnesio/index.html', varName: 'productos',
    descuentos: 'suplementos/magnesio/descuentos.json',
    descubrir: {
      terminos: [
        'magnesio', 'citrato de magnesio', 'glicinato de magnesio', 'bisglicinato de magnesio',
        'magnesio malato', 'cloruro de magnesio', 'treonato de magnesio', 'magnesio en polvo',
        'magnesio capsulas', 'magnesio y potasio',
      ],
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: {
        atributos: ['MAIN_SUPPLEMENT', 'SUPPLEMENT_CLASS', 'TRADE_NAME', 'LINE'],
        rx: /magnesio|magnesium/i,
      },
      mapa: { SERVINGS_NUMBER: 'porciones', IS_VEGAN: 'vegano' },
      tipos: { porciones: 'numero', vegano: 'texto' },
      obligatorias: ['porciones'],
      recomendadas: ['formaMagnesio', 'compuesto', 'mgMagnesio', 'porPorcion', 'absorcion'],
    },
  },
  creatina: {
    titulo: 'Creatina', file: 'suplementos/creatina/index.html', varName: 'productos',
    descuentos: 'suplementos/creatina/descuentos.json',
    catalogMini: {
      salida: ['suplementos', 'creatina', 'catalog-mini.json'],
      especs: ['tipoCreatina', 'presentacion', 'contenidoGramos', 'grPorPorcion', 'porciones', 'costoPor5g', 'pura'],
    },
    descubrir: {
      terminos: [
        'creatina', 'creatina monohidratada', 'creatina micronizada', 'creapure',
        'creatina en polvo', 'creatina capsulas', 'creatina 300 g', 'creatina hcl',
        'creatina sin sabor',
      ],
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: {
        atributos: ['MAIN_SUPPLEMENT', 'SUPPLEMENT_CLASS', 'TRADE_NAME', 'LINE'],
        rx: /creatina|creatine/i,
      },
      mapa: {
        NET_WEIGHT: 'contenidoGramos',
        SERVING_WEIGHT: 'grPorPorcion',
        SERVINGS_NUMBER: 'porciones',
        SUPPLEMENT_FORMAT: 'presentacion',
      },
      /* Aquí `contenidoGramos` es TEXTO ("450 g") y en proteína es el número 450: la misma clave
         con dos formatos en dos páginas, que es justo para lo que existe `tipos`. Va por
         `gramosTexto` y no por `texto` porque la API da «2.27 kg» igual que «300 g», y un bote
         de "2.27 kg" junto a otro de "450 g" no se compara de un vistazo. */
      tipos: { contenidoGramos: 'gramosTexto', grPorPorcion: 'texto', porciones: 'numero', presentacion: 'slug' },
      valores: { presentacion: { polvo: 'polvo', capsula: 'capsulas', capsulas: 'capsulas' } },
      // Sin contenido no hay costo por 5 g, que es la columna con la que se compara en esta página.
      obligatorias: ['contenidoGramos'],
      recomendadas: ['tipoCreatina', 'presentacion', 'grPorPorcion', 'porciones', 'pura'],
      firma: ['contenidoGramos'],
    },
  },
  complejo_b: {
    titulo: 'Complejo B', file: 'suplementos/complejo-b/index.html', varName: 'PRODUCTOS',
    descuentos: 'suplementos/complejo-b/descuentos.json',
    descubrir: {
      terminos: [
        'complejo b', 'vitamina b12', 'complejo b12', 'vitaminas del complejo b', 'b complex',
        'metilcobalamina', 'complejo b capsulas', 'vitamina b1 b6 b12',
      ],
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: {
        atributos: ['MAIN_SUPPLEMENT', 'SUPPLEMENT_CLASS', 'TRADE_NAME', 'LINE'],
        rx: /complejo\s*b|complexo\s*b|vitamina\s*b|b-?\s*complex|cobalamina|b\s*12/i,
      },
      mapa: { SERVINGS_NUMBER: 'porciones' },
      tipos: { porciones: 'numero' },
      obligatorias: ['porciones'],
      recomendadas: ['porPorcion', 'capsulasPorDia', 'b12', 'formaB12'],
    },
  },
  vitamina_d: {
    titulo: 'Vitamina D', file: 'suplementos/vitamina-d/index.html', varName: 'PRODUCTOS',
    descuentos: 'suplementos/vitamina-d/descuentos.json',
    descubrir: {
      terminos: [
        'vitamina d3', 'vitamina d', 'vitamina d3 k2', 'vitamina d 5000 ui',
        'vitamina d3 2000 ui', 'vitamina d gotas', 'colecalciferol', 'vitamina d infantil',
      ],
      categoriasML: ['MLM438195'],
      dominios: ['MLM-SUPPLEMENTS'],
      clase: {
        atributos: ['MAIN_SUPPLEMENT', 'SUPPLEMENT_CLASS', 'TRADE_NAME', 'LINE'],
        rx: /vitamina\s*d|vitamin\s*d|colecalciferol|\bd3\b/i,
      },
      mapa: {
        SERVINGS_NUMBER: 'porciones',
        SUPPLEMENT_FORMAT: 'formato',
        IS_VEGAN: 'vegano',
        IS_GLUTEN_FREE: 'sinGluten',
        MIN_RECOMMENDED_AGE: 'edadMinima',
      },
      tipos: {
        porciones: 'numero', formato: 'slug', vegano: 'texto', sinGluten: 'texto',
        edadMinima: 'texto',
      },
      valores: { formato: { capsula: 'cápsula', capsulas: 'cápsula', gotas: 'gotas', tabletas: 'tabletas' } },
      obligatorias: ['porciones'],
      // `ui` y `conK2` salen del texto libre de la etiqueta: a mano.
      recomendadas: ['ui', 'formaVitD', 'formato', 'conK2'],
    },
  },

  // ── Videojuegos ────────────────────────────────────────────────────────────
  videojuegos_consolas: {
    titulo: 'Consolas', file: 'videojuegos/consolas/index.html', varName: 'productos',
    descuentos: 'videojuegos/consolas/descuentos.json',
    catalogMini: {
      salida: ['videojuegos', 'consolas', 'catalog-mini.json'],
      especs: ['generacion', 'tipoConsola', 'almacenamiento', 'lectorDiscos', 'formatoJuegos', 'accesorios', 'condicion'],
    },
    /* Los términos tienen que decir «consola»: buscar «playstation 5» a secas devuelve 71
       videojuegos de cada 77 resultados (medido), porque el catálogo de ML llama igual al juego
       y a la máquina. Con «consola …» el dominio ya sale MLM-GAME_CONSOLES. */
    descubrir: {
      terminos: [
        'consola playstation 5', 'playstation 5 pro', 'consola xbox series x',
        'consola xbox series s', 'consola nintendo switch 2', 'nintendo switch oled',
        'nintendo switch lite', 'steam deck', 'rog ally', 'meta quest 3',
      ],
      categoriasML: ['MLM167860'],
      dominios: ['MLM-GAME_CONSOLES'],
      mapa: {
        CAPACITY: 'almacenamiento',
        CONSOLE_TYPE: 'tipoConsola',
        ACCESSORIES_INCLUDED: 'accesorios',
      },
      tipos: { almacenamiento: 'texto' },
      valores: {
        tipoConsola: { 'de sobremesa': 'Sobremesa', hibrida: 'Híbrida', portatil: 'Portátil' },
      },
      obligatorias: ['almacenamiento'],
      // `generacion`, `formatoJuegos` y `condicion` son editoriales de esta página («9na
      // generación», «Físico y digital», «Reacondicionado»): la API no los da así.
      recomendadas: ['tipoConsola', 'generacion', 'lectorDiscos', 'formatoJuegos', 'condicion', 'accesorios'],
      firma: ['almacenamiento', 'tipoConsola'],
    },
  },
  videojuegos_controles: {
    titulo: 'Controles', file: 'videojuegos/controles/index.html', varName: 'productos',
    descuentos: 'videojuegos/controles/descuentos.json',
    descubrir: {
      terminos: [
        'control playstation 5', 'control dualsense', 'control xbox series x',
        'control xbox inalambrico', 'control pro nintendo switch', 'joy con nintendo switch 2',
        'control para pc', 'gamepad inalambrico', 'control retro usb',
      ],
      // MLM455266 es «Gamepads y Joysticks» de PS5, la única subcategoría de controles cuyo
      // ranking responde; su ranking trae controles de varias marcas.
      categoriasML: ['MLM455266'],
      // Las fundas y los cargadores de control tienen dominio propio: fuera.
      dominios: ['MLM-GAMEPADS_AND_JOYSTICKS'],
      mapa: {
        COMPATIBLE_DEVICES: 'dispositivosCompatibles',
        IS_WIRELESS: 'inalambrico',
        WITH_VIBRATION: 'vibracion',
        WITH_MOVEMENT_SENSOR: 'sensorMovimiento',
        WITH_LIGHT_BAR: 'barraLuz',
        POWER_SUPPLY_TYPES: 'alimentacion',
      },
      tipos: {
        inalambrico: 'texto', vibracion: 'texto', sensorMovimiento: 'texto',
        barraLuz: 'texto', alimentacion: 'texto',
      },
      obligatorias: ['dispositivosCompatibles'],
      recomendadas: ['inalambrico', 'vibracion', 'sensorMovimiento', 'barraLuz', 'alimentacion', 'condicion'],
      firma: ['dispositivosCompatibles'],
    },
  },
  videojuegos_juegos: {
    titulo: 'Juegos', file: 'videojuegos/juegos/index.html', varName: 'productos',
    descuentos: 'videojuegos/juegos/descuentos.json',
    catalogMini: {
      salida: ['videojuegos', 'juegos', 'catalog-mini.json'],
      especs: ['plataforma', 'formato', 'desarrollador', 'anio', 'genero', 'multijugador'],
    },
    descubrir: {
      terminos: [
        'juego ps5', 'juego ps4', 'juego nintendo switch 2', 'juego nintendo switch',
        'juego xbox series x', 'ea sports fc 26', 'call of duty', 'mario kart world',
        'pokemon switch', 'gran turismo', 'minecraft', 'the legend of zelda',
      ],
      categoriasML: ['MLM151595'],
      dominios: ['MLM-VIDEO_GAMES'],
      mapa: {
        CONSOLE_VERSION: 'plataforma',
        FORMAT: 'formato',
        GENRES: 'genero',
        DEVELOPERS: 'desarrollador',
        RELEASE_YEAR: 'anio',
        IS_MULTIPLAYER: 'multijugador',
      },
      tipos: { anio: 'texto', multijugador: 'texto' },
      /* `plataforma` es el filtro de la página y usa los nombres cortos de la casa. Lo que la API
         llame de otra forma se queda vacío y se elige a mano: meter «Xbox 360» donde el filtro
         espera «Xbox Series X|S» escondería el juego de su propia lista. */
      valores: {
        plataforma: {
          'playstation 5': 'PS5', 'playstation 4': 'PS4',
          'switch': 'Nintendo Switch', 'nintendo switch': 'Nintendo Switch',
          'switch 2': 'Switch 2', 'nintendo switch 2': 'Switch 2',
          'xbox one': 'Xbox One',
          'xbox series x': 'Xbox Series X|S', 'xbox series s': 'Xbox Series X|S',
          'xbox series x s': 'Xbox Series X|S', 'pc': 'PC',
        },
        formato: { fisico: 'Físico', digital: 'Digital' },
      },
      obligatorias: ['formato'],
      recomendadas: ['plataforma', 'genero', 'anio', 'desarrollador', 'multijugador'],
      // Sin `firma`: la «marca» de un juego es la editorial, y Nintendo+Switch marcaría como
      // duplicado cada juego de Nintendo contra el primero que haya en la base.
    },
  },

  // ── Tecnología ─────────────────────────────────────────────────────────────
  tecnologia_bocinas: {
    titulo: 'Bocinas inteligentes', file: 'tecnologia/bocinas/index.html', varName: 'productos',
    descuentos: 'tecnologia/bocinas/descuentos.json',
    descubrir: {
      terminos: [
        'bocina inteligente', 'bocina con alexa', 'echo dot', 'echo show', 'echo pop',
        'google nest audio', 'nest mini', 'nest hub', 'homepod mini',
        'bocina con google assistant',
      ],
      // MLM187752 «Asistentes Virtuales». MLM2868 «Bocinas» es el de bocinas normales, que no
      // son de esta página.
      categoriasML: ['MLM187752'],
      dominios: ['MLM-SMART_SPEAKERS'],
      mapa: {
        MODEL: 'modelo',
        VIRTUAL_ASSISTANTS: 'asistentes',
        POWER: 'potencia',
        POWER_SUPPLY_TYPES: 'alimentacion',
        WITH_TOUCHSCREEN: 'pantallaTactil',
        WITH_CAMERA: 'camara',
        OPERATIVE_SYSTEMS_COMPATIBILITY: 'sistemas',
      },
      tipos: { potencia: 'wattsTexto', pantallaTactil: 'texto', camara: 'texto' },
      obligatorias: ['modelo'],
      recomendadas: ['asistentes', 'potencia', 'alimentacion', 'pantallaTactil', 'camara', 'sistemas'],
      firma: ['modelo'],
    },
  },
  tecnologia_audifonos: {
    titulo: 'Audífonos', file: 'tecnologia/audifonos/index.html', varName: 'productos',
    descuentos: 'tecnologia/audifonos/descuentos.json',
    descubrir: {
      terminos: [
        'audifonos inalambricos', 'audifonos bluetooth', 'audifonos in ear', 'audifonos diadema',
        'audifonos con cancelacion de ruido', 'airpods', 'audifonos deportivos',
        'audifonos gamer', 'audifonos true wireless', 'audifonos over ear',
      ],
      categoriasML: ['MLM7533'],
      dominios: ['MLM-HEADPHONES'],
      mapa: {
        HEADPHONE_FORMAT: 'formato',
        IS_WIRELESS: 'inalambrico',
        WITH_MICROPHONE: 'microfono',
        HEADPHONE_MAX_BATTERY_LIFE: 'bateria',
        WITH_HANDS_FREE_MODE: 'manosLibres',
        WITH_WIRELESS_CHARGING: 'cargaInalambrica',
        WITH_NOISE_CANCELLING: 'cancelacionRuido',
      },
      tipos: {
        inalambrico: 'texto', microfono: 'texto', bateria: 'texto', manosLibres: 'texto',
        cargaInalambrica: 'texto', cancelacionRuido: 'texto',
      },
      /* `formato` es el filtro de esta página. «Diadema» y «Clip-ear» se quedan FUERA de la
         tabla a propósito: diadema no dice si es on-ear o over-ear, y adivinarlo pondría el
         producto en el tramo equivocado del filtro. Se llena a mano al publicar. */
      valores: {
        formato: {
          'in ear': 'In-ear', 'in ear style': 'In-ear', 'on ear': 'On-ear',
          'over ear': 'Over-ear', headset: 'Headset', neckband: 'Neckband',
        },
      },
      obligatorias: ['formato'],
      recomendadas: ['inalambrico', 'microfono', 'bateria', 'manosLibres', 'cargaInalambrica', 'cancelacionRuido'],
    },
  },
  tecnologia_smartwatches: {
    titulo: 'Smartwatches', file: 'tecnologia/smartwatches/index.html', varName: 'productos',
    descuentos: 'tecnologia/smartwatches/descuentos.json',
    descubrir: {
      terminos: [
        'smartwatch', 'reloj inteligente', 'apple watch', 'galaxy watch', 'amazfit',
        'smartwatch deportivo', 'reloj inteligente con gps', 'huawei watch', 'garmin',
        'smartwatch amoled', 'smartwatch con llamadas',
      ],
      categoriasML: ['MLM126793'],
      // Las correas y los protectores tienen dominio propio: fuera.
      dominios: ['MLM-SMARTWATCHES'],
      mapa: {
        SMARTWATCH_COMPATIBLE_OS: 'compatibilidad',
        DISPLAY_SIZE: 'pantalla',
        BATTERY_LIFE: 'bateria',
        WITH_GPS: 'gps',
        WITH_NFC: 'nfc',
      },
      // `pantalla` como texto ('1.85 "'), que es como está en esta base.
      tipos: { pantalla: 'texto', bateria: 'texto', gps: 'texto', nfc: 'texto' },
      valores: {
        compatibilidad: {
          'android ios': 'Android e iOS', 'ios android': 'Android e iOS',
          android: 'Android', ios: 'iOS',
        },
      },
      obligatorias: ['pantalla'],
      recomendadas: ['compatibilidad', 'bateria', 'gps', 'nfc', 'tieneIA'],
    },
  },
  tecnologia_lentes: {
    titulo: 'Lentes inteligentes', file: 'tecnologia/lentes-inteligentes/index.html', varName: 'productos',
    /* La categoría donde la API da menos: MLM459592 «Lentes Inteligentes» NO tiene ranking
       (404), así que aquí solo hay búsqueda, y de 150 resultados salen ~17 activos, casi todos
       genéricos. Los Ray-Ban Meta y Oakley Meta que esta página cura se siguen dando de alta a
       mano; esto sirve para ver si aparece algo nuevo. */
    descubrir: {
      terminos: [
        'lentes inteligentes', 'ray ban meta', 'gafas inteligentes', 'lentes con camara',
        'lentes inteligentes con ia', 'meta ray ban display', 'oakley meta', 'lentes bluetooth',
      ],
      categoriasML: [],
      dominios: ['MLM-SMART_GLASSES'],
      mapa: {
        FRAME_SHAPE: 'forma',
        COMPATIBLE_OPERATING_SYSTEM: 'compatibilidad',
        WITH_INTERCHANGEABLE_LENSES: 'intercambiables',
        FRAME_MATERIAL: 'armazon',
      },
      tipos: { intercambiables: 'texto' },
      valores: {
        forma: {
          rectangular: 'Rectangular', cuadrada: 'Cuadrada', redonda: 'Redonda', ovalada: 'Ovalada',
        },
        compatibilidad: {
          'android ios': 'Android e iOS', android: 'Solo Android', ios: 'Solo iOS',
        },
      },
      // Nada bloquea: lo que define a estos lentes en la página (familia, generación, micas) es
      // editorial y la API no lo da. El candado de verdad lo pone el enlace al publicar.
      obligatorias: [],
      recomendadas: ['familia', 'generacion', 'forma', 'micas', 'compatibilidad', 'armazon', 'intercambiables'],
    },
  },

  // ── Entretenimiento ────────────────────────────────────────────────────────
  streaming: {
    titulo: 'Streaming', file: 'entretenimiento/streaming/index.html', varName: 'productos',
    descuentos: 'entretenimiento/streaming/descuentos.json',
    descubrir: {
      terminos: [
        'fire tv stick', 'fire tv stick 4k', 'fire tv cube', 'chromecast google tv',
        'apple tv 4k', 'roku streaming stick', 'roku express', 'tv box android',
        'mi tv stick', 'reproductor de streaming',
      ],
      categoriasML: ['MLM126075'],
      /* Buscar «roku» trae 20 controles remotos de cada 61 resultados: los controles son
         MLM-TV_REMOTE_CONTROLS y las fundas otro dominio, así que este filtro es el que deja
         solo reproductores. */
      dominios: ['MLM-STREAMING_MEDIA_DEVICES'],
      mapa: {
        DEVICE_FORMAT: 'formato',
        MAX_VIDEO_RESOLUTION: 'resolucion',
        INTEGRATED_VOICE_ASSISTANTS: 'asistente',
      },
      valores: {
        formato: { stick: 'Stick', 'tv box': 'TV Box', 'pendant box': 'Pendant Box' },
        resolucion: { '4k': '4K', 'full hd': 'Full HD', hd: 'HD', '8k': '8K', 'hd 720p': 'HD' },
      },
      obligatorias: ['formato'],
      // INTERNAL_STORAGE_CAPACITY no existe en este dominio (medido): `almacenamiento` a mano.
      recomendadas: ['resolucion', 'almacenamiento', 'asistente'],
    },
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
    /* La categoría con mejor cobertura de toda la API: sobre 140 catálogos activos, pulgadas 138,
       smart 127, resolución 116, panel 112, HDR 102, Wi-Fi 93, sistema operativo 89. */
    descubrir: {
      terminos: [
        'smart tv 32 pulgadas', 'smart tv 43 pulgadas', 'smart tv 50 pulgadas',
        'smart tv 55 pulgadas', 'smart tv 65 pulgadas', 'smart tv 75 pulgadas',
        'tv qled', 'tv oled', 'tv mini led', 'pantalla 4k', 'smart tv google tv',
        'smart tv roku', 'smart tv 8k',
      ],
      categoriasML: ['MLM1002'],
      dominios: ['MLM-TELEVISIONS'],
      especsPlanas: true,
      mapa: {
        DISPLAY_SIZE: 'pulgadas',
        RESOLUTION_TYPE: 'resolucion',
        DISPLAY_TYPE: 'panel',
        OPERATIVE_SYSTEM: 'so',
        ALPHANUMERIC_MODEL: 'modelo',
        HDMI_PORTS_NUMBER: 'hdmi',
        USB_PORTS_NUMBER: 'usb',
        SPEAKERS_NUMBER: 'bocinas',
        DISPLAY_REFRESH_RATE: 'hz',
        WITH_HDR: 'hdr',
        WITH_BLUETOOTH: 'bluetooth',
        IS_CURVED: 'curva',
        IS_SMART: 'smart',
        WITH_WI_FI: 'wifi',
      },
      tipos: {
        pulgadas: 'numero', hdmi: 'numero', usb: 'numero', bocinas: 'numero', hz: 'numero',
        hdr: 'bool', bluetooth: 'bool', curva: 'bool', smart: 'bool', wifi: 'bool',
      },
      // Los tres filtros de la página, con el vocabulario de la casa.
      valores: {
        resolucion: {
          '4k': '4K', '4k uhd': '4K', uhd: '4K', 'smart 4k': '4K',
          'full hd': 'Full HD', hd: 'HD', '8k': '8K',
        },
        panel: {
          led: 'LED', dled: 'DLED', qled: 'QLED', oled: 'OLED', lcd: 'LCD', uled: 'ULED',
          qned: 'QNED', 'mini led': 'Mini-LED', 'neo qled 4k': 'QLED', 'lcd led': 'LED',
        },
        so: {
          'google tv': 'Google TV', google: 'Google TV', tizen: 'Tizen',
          'android tv': 'Android TV', android: 'Android TV', vidaa: 'Vidaa',
          'roku tv': 'Roku TV', 'roku os': 'Roku OS', roku: 'Roku TV',
          'fire tv': 'Fire TV', webos: 'webOS',
        },
      },
      obligatorias: ['pulgadas'],
      recomendadas: ['resolucion', 'panel', 'so', 'hdmi', 'usb', 'hdr', 'bluetooth', 'hz'],
      firma: ['pulgadas', 'resolucion', 'panel'],
    },
  },

  // ── Bicis ──────────────────────────────────────────────────────────────────
  // El hub /bicis/ y las páginas dedicadas /bicicletas/… muestran las MISMAS listas:
  // las dedicadas van como espejo (principal:false) para no contar dos veces el producto.
  bicis: {
    titulo: 'Bicis eléctricas', file: 'bicis/index.html', varName: 'ELECTRICAS',
    descuentos: 'bicis/descuentos.json',
    descubrir: {
      terminos: [
        'bicicleta electrica', 'bici electrica plegable', 'bicicleta electrica de montaña',
        'bicicleta electrica urbana', 'e-bike', 'bicicleta electrica 500w',
        'bicicleta electrica adulto', 'bicicleta electrica con acelerador',
      ],
      categoriasML: ['MLM123977'],
      dominios: ['MLM-ELECTRIC_BICYCLES'],
      mapa: {
        POWER: 'motor',
        MAX_SPEED: 'velocidad',
        BATTERY_CAPACITY: 'batAh',
        BATTERY_VOLTAGE: 'voltaje',
        BATTERY_TYPE: 'batTipo',
        IS_FOLDABLE: 'plegable',
        WHEEL_SIZE: 'rueda',
        WEIGHT: 'peso',
        MAX_WEIGHT_SUPPORTED: 'cargaMax',
        WITH_LIGHTS: 'luces',
        WITH_REMOVABLE_BATTERY: 'removible',
      },
      tipos: {
        motor: 'wattsTexto', velocidad: 'texto', batAh: 'numero', voltaje: 'texto',
        plegable: 'texto', rueda: 'texto', peso: 'texto', cargaMax: 'texto',
        luces: 'texto', removible: 'texto',
      },
      valores: {
        batTipo: { 'ion de litio': 'Li-ion', litio: 'Li-ion', 'plomo acido': 'Plomo-ácido' },
      },
      obligatorias: ['motor'],
      /* `autonomia` NO se mapea aunque la API tenga ELECTRIC_BICYCLE_AUTONOMY: ahí viene en HORAS
         («40 h») y esta página la enseña en KILÓMETROS. Convertirla sería inventarse la
         velocidad media, así que se escribe a mano. `tipo` (urbana/plegable/montaña) también. */
      recomendadas: ['tipo', 'velocidad', 'voltaje', 'batAh', 'batTipo', 'plegable', 'rueda', 'peso', 'cargaMax', 'autonomia'],
      firma: ['motor', 'batAh'],
    },
  },
  bicisElectricasDed: {
    datos: 'bicis', titulo: 'Bicis eléctricas (página dedicada)', principal: false,
    file: 'bicicletas/bici-electricas/index.html', varName: 'ELECTRICAS',
  },
  bicisMontana: {
    titulo: 'Bicis de montaña', file: 'bicis/index.html', varName: 'MONTANA',
    descuentos: 'bicis/descuentos.json',
    /* Montaña y gravel/ruta comparten el dominio MLM-BICYCLES, así que lo único que las separa
       es el atributo BICYCLE_TYPE («Mountain bike» / «De ruta»). Sin ese filtro, buscar
       «bicicleta de montaña» y «bicicleta de ruta» llenaría las dos bandejas con lo mismo. */
    descubrir: {
      terminos: [
        'bicicleta de montaña', 'bicicleta mtb', 'bicicleta montaña rodada 29',
        'bicicleta mtb doble suspension', 'bicicleta rodada 27.5', 'bicicleta montaña aluminio',
        'mtb 29', 'bicicleta montaña shimano',
      ],
      categoriasML: ['MLM62091'],
      dominios: ['MLM-BICYCLES'],
      clase: { atributos: ['BICYCLE_TYPE', 'LINE', 'MODEL'], rx: /mountain|monta[nñ]a|mtb/i },
      mapa: {
        WHEEL_SIZE: ['rodada', 'rueda'],
        SPEEDS_NUMBER: 'velocidades',
        SUSPENSION_TYPES: 'suspension',
        FRONT_BRAKE_TYPE: 'frenos',
        WEIGHT: 'peso',
        MAX_WEIGHT_SUPPORTED: 'cargaMax',
      },
      tipos: {
        rodada: 'texto', rueda: 'texto', velocidades: 'texto', peso: 'texto', cargaMax: 'texto',
      },
      valores: {
        suspension: { delantera: 'Delantera', 'delantera trasera': 'Doble' },
        frenos: {
          'disco hidraulico': 'Disco hidráulico', 'freno hidraulico': 'Disco hidráulico',
          'disco mecanico': 'Disco mecánico', 'v brakes': 'V-brake', 'v brake': 'V-brake',
          'freno de disco': 'Disco', discos: 'Disco', herradura: 'Herradura',
        },
      },
      obligatorias: ['rodada'],
      recomendadas: ['tipo', 'velocidades', 'suspension', 'frenos', 'peso', 'cargaMax'],
      firma: ['rodada', 'velocidades'],
    },
  },
  bicisMontanaDed: {
    datos: 'bicisMontana', titulo: 'Bicis de montaña (página dedicada)', principal: false,
    file: 'bicicletas/bici-montana/index.html', varName: 'MONTANA',
  },
  bicisGravelRuta: {
    titulo: 'Bicis gravel y ruta', file: 'bicis/index.html', varName: 'GRAVELRUTA',
    descuentos: 'bicis/descuentos.json',
    descubrir: {
      terminos: [
        'bicicleta de ruta', 'bicicleta gravel', 'bicicleta ruta carbono',
        'bicicleta ruta aluminio', 'bici gravel 700', 'bicicleta ruta shimano',
        'bicicleta de ruta 22 velocidades',
      ],
      categoriasML: ['MLM62091'],
      dominios: ['MLM-BICYCLES'],
      clase: { atributos: ['BICYCLE_TYPE', 'LINE', 'MODEL'], rx: /ruta|gravel|road|fixie/i },
      mapa: {
        WHEEL_SIZE: ['rodada', 'rueda'],
        SPEEDS_NUMBER: 'velocidades',
        SUSPENSION_TYPES: 'suspension',
        FRONT_BRAKE_TYPE: 'frenos',
        WEIGHT: 'peso',
        MAX_WEIGHT_SUPPORTED: 'cargaMax',
      },
      tipos: {
        rodada: 'texto', rueda: 'texto', velocidades: 'texto', peso: 'texto', cargaMax: 'texto',
      },
      valores: {
        suspension: { delantera: 'Delantera', 'delantera trasera': 'Doble' },
        frenos: {
          'disco hidraulico': 'Disco hidráulico', 'freno hidraulico': 'Disco hidráulico',
          'disco mecanico': 'Disco mecánico', 'v brakes': 'V-brake', 'v brake': 'V-brake',
          'freno de disco': 'Disco', discos: 'Disco', herradura: 'Herradura',
        },
      },
      obligatorias: ['rodada'],
      // `tipo` dice si es gravel o ruta, y eso lo decide quien publica: la API dice «De ruta» a
      // las dos.
      recomendadas: ['tipo', 'velocidades', 'suspension', 'frenos', 'peso', 'cargaMax'],
      firma: ['rodada', 'velocidades'],
    },
  },
  bicisGravelDed: {
    datos: 'bicisGravelRuta', titulo: 'Bicis gravel (página dedicada)', principal: false,
    file: 'bicicletas/bici-gravel/index.html', varName: 'GRAVEL',
  },

  // ── Celulares (familias + variantes) ───────────────────────────────────────
  /* ANDROID NO TIENE `descubrir`, Y NO ES UN OLVIDO (27-nov-2026). En esta página la variante no
     es la capacidad sola, es (capacidad, RAM) —`{id:'android-samsung-a16-5g-128gb-4gb',
     storage:128, ram:4}`— mientras iPhone guarda `{almacenamientoGB:512}`. Tres cosas dependen de
     esa forma y hoy solo saben leer la de iPhone: el «ya lo tenemos» de `descubrir-catalogo.mjs`
     (mira `v.almacenamientoGB`, así que en Android no encontraría ninguno y la bandeja saldría
     con cientos de Galaxy ya publicados), `agregarVariantes()` de `_html-precios.js`, y
     `altaVariante()` de `_familias-alta.js`, que escribe `apple-…` y `marca:'Apple'` a mano.
     Darle descubrimiento a Android es escribir primero esa regla para su forma; mientras no esté,
     un bloque aquí no ahorraría trabajo, lo crearía. */
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
