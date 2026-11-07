/* comparalo.mx — panel de filtros a la izquierda, mismo orden y piezas que el de proteína:
   Precio (mín–máx) · Disponibilidad (pills) · [Guardados, lo agrega favorites.js] · Ofertas ·
   facetas propias de la categoría · Marca (con buscador) · Características.
   Requiere <html data-cmx-filters="panel"> y <aside id="cmx-fp"> dentro de .cmx-fp-layout.
   Las opciones salen de los datos de cada página. Dentro de un grupo las casillas suman (O);
   entre grupos se combinan (Y). La página solo agrega en su filtro: if (window.cmxPass && !cmxPass(p)) return false; */
(function () {
  var aside, main, openBtn, backdrop, clearBtn, facets = [], sel = {}, L = [], minInput, maxInput;
  var path = location.pathname;

  /* ── Utilidades de datos ── */
  function products() {
    try { return typeof productos !== 'undefined' ? productos : PRODUCTOS; } catch (e) { return []; }
  }
  function priceOf(p) {
    try { if (typeof precioVigente === 'function') return precioVigente(p); } catch (e) {}
    return p.precio;
  }
  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(n) { return '$' + (n % 1 ? n.toFixed(2) : n); }

  function byValue(id, title, get, labels, order) {
    var counts = {};
    L.forEach(function (p) { var v = get(p); if (v != null && v !== '') counts[v] = (counts[v] || 0) + 1; });
    var vals = Object.keys(counts).sort(function (a, b) {
      if (order) { var ia = order.indexOf(a), ib = order.indexOf(b); if (ia < 0) ia = 99; if (ib < 0) ib = 99; if (ia !== ib) return ia - ib; }
      return counts[b] - counts[a];
    });
    return { id: id, title: title, mode: 'or', opts: vals.map(function (v) {
      return { v: v, label: (labels && labels[v]) || cap(v), test: function (p) { return get(p) === v; } };
    }) };
  }
  function buckets(id, title, get, edges) {
    var opts = [];
    for (var i = 0; i <= edges.length; i++) {
      (function (i) {
        var lo = i === 0 ? null : edges[i - 1], hi = i === edges.length ? null : edges[i];
        var label = lo === null ? 'Hasta ' + money(hi) : hi === null ? 'Más de ' + money(lo) : money(lo) + ' a ' + money(hi);
        opts.push({ v: 'b' + i, label: label, test: function (p) {
          var v = get(p); if (typeof v !== 'number') return false;
          return (lo === null || v > lo) && (hi === null || v <= hi);
        } });
      })(i);
    }
    return { id: id, title: title, mode: 'or', opts: opts };
  }
  function flags(id, title, list) {
    return { id: id, title: title, mode: 'and', opts: list.map(function (f) { return { v: f[0], label: f[1], test: f[2] }; }) };
  }
  function dropFacet() {
    return { id: 'bajada', title: 'Ofertas', mode: 'or', hidden: true, opts: [
      { v: 'drop', label: '↓ Solo con bajada de precio', test: function (p) { return !!(window.cmxGetDrop && window.cmxGetDrop(p)); } }] };
  }
  function platform(opts) { return { id: 'plataforma', title: 'Disponibilidad', mode: 'or', pills: true, opts: opts }; }
  function brand() { return byValue('marca', 'Marca', function (p) { return p.marca; }); }
  function cost(edges) { return buckets('costo', 'Costo por porción', function (p) { return p.costoPorPorcion; }, edges); }

  /* Cada factory devuelve: [plataforma(pills), ...facetas propias, marca, costo, características...] */
  var CONFIG = {
    '/suplementos/magnesio/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        byValue('forma', 'Forma', function (p) { return p.formaMagnesio; }, { treonato: 'L-Treonato', otro: 'Otros' }),
        byValue('absorcion', 'Absorción', function (p) { return p.absorcion; }, null, ['muy alta', 'alta', 'media', 'mixta']),
        brand(),
        cost([2, 5, 10]),
        flags('carac', 'Características', [['vegano', 'Vegano', function (p) { return p.vegano === true; }]])
      ];
    },
    '/suplementos/omega3/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Solo Mercado Libre', test: function (p) { return !!(p.linkML && !p.linkAmz); } },
          { v: 'amz', label: 'Solo Amazon', test: function (p) { return !!(p.linkAmz && !p.linkML); } }]),
        byValue('fuente', 'Fuente', function (p) { return p.fuenteOmega; }, { anchoa: 'Anchoa', linaza: 'Linaza', 'multi-pez': 'Multi-pez', salmon: 'Salmón', krill: 'Krill' }),
        brand(),
        cost([3, 6, 12]),
        flags('carac', 'Características', [
          ['metales', 'Libre de metales pesados', function (p) { return p.libreMetalesPesados === true; }],
          ['ifos', 'Certificado IFOS', function (p) { return p.certificadoIFOS === true; }]])
      ];
    },
    '/suplementos/complejo-b/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        byValue('b12', 'Forma de B12', function (p) { return p.formaB12; }),
        brand(),
        cost([2.5, 3.5, 6]),
        byValue('caps', 'Cápsulas por día', function (p) { return p.capsulasPorDia; }, { 1: '1 al día', 2: '2 al día' })
      ];
    },
    '/suplementos/vitamina-d/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        byValue('formato', 'Formato', function (p) { return p.formato; }, { gotas: 'Gotas', 'cápsula': 'Cápsulas' }),
        { id: 'k2', title: 'Con vitamina K2', mode: 'or', opts: [
          { v: 'si', label: 'Con K2', test: function (p) { return p.conK2 === 'Sí'; } },
          { v: 'no', label: 'Solo D3', test: function (p) { return p.conK2 !== 'Sí'; } }] },
        brand(),
        cost([2, 4, 10]),
        flags('carac', 'Características', [
          ['vegano', 'Vegano', function (p) { return p.vegano === 'Sí'; }],
          ['gluten', 'Sin gluten', function (p) { return p.sinGluten === 'Sí'; }],
          ['lactosa', 'Sin lactosa', function (p) { return p.sinLactosa === 'Sí'; }]])
      ];
    },
    '/electrodomesticos/lavadoras/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        byValue('tipo', 'Tipo', function (p) { return p.tipo; },
          { automatica: 'Automática', frontal: 'Carga frontal', superior: 'Carga superior', semiautomatica: 'Semiautomática', compacta: 'Compacta' }),
        { id: 'capacidad', title: 'Capacidad (kg)', mode: 'or', opts: [
          { v: 'c1', label: 'Hasta 7 kg', test: function (p) { return typeof p.capacidadKg === 'number' && p.capacidadKg <= 7; } },
          { v: 'c2', label: '8–10 kg', test: function (p) { return typeof p.capacidadKg === 'number' && p.capacidadKg > 7 && p.capacidadKg <= 10; } },
          { v: 'c3', label: 'Más de 10 kg', test: function (p) { return typeof p.capacidadKg === 'number' && p.capacidadKg > 10; } }] },
        brand(),
        flags('carac', 'Características', [
          ['inverter', 'Motor inverter', function (p) { return p.inverter === true; }],
          ['vapor', 'Función vapor', function (p) { return p.vapor === true; }]])
      ];
    },
    '/videojuegos/juegos/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'amz', label: '<img src="/logoamazon.png" alt="Amazon" style="height:16px;vertical-align:middle">', test: function (p) { return !!p.linkAmz; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        byValue('genero', 'Género', function (p) { return p.especs && p.especs.genero || null; }),
        byValue('plataforma', 'Plataforma', function (p) { return p.especs && p.especs.plataforma || null; }),
        byValue('formato', 'Formato', function (p) { return p.especs && p.especs.formato || null; })
      ];
    },
    '/videojuegos/consolas/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        byValue('tipo', 'Tipo', function (p) {
          if (!p.especs || !p.especs.tipoConsola) return null;
          var t = p.especs.tipoConsola.normalize('NFD').replace(/[̀-ͯ]/g, '');
          return t.charAt(0).toUpperCase() + t.slice(1);
        }, { 'Hibrida': 'Híbrida', 'Portatil': 'Portátil', 'Sobremesa': 'Sobremesa', 'Realidad virtual': 'Realidad virtual', 'Realidad mixta': 'Realidad mixta' }),
        brand(),
        byValue('cond', 'Estado', function (p) { return p.especs && p.especs.condicion || null; })
      ];
    },
    '/bicicletas/bici-ruta/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        byValue('marca', 'Marca', function (p) { return p.marca; }),
        { id: 'precio', title: 'Precio', mode: 'or', opts: [
          { v: 'p1', label: 'Hasta $10,000', test: function (p) { return p.precio <= 10000; } },
          { v: 'p2', label: '$10,000 – $25,000', test: function (p) { return p.precio > 10000 && p.precio <= 25000; } },
          { v: 'p3', label: 'Más de $25,000', test: function (p) { return p.precio > 25000; } }] },
        byValue('rueda', 'Rueda', function (p) { return p.rueda || null; })
      ];
    },
    '/bicicletas/bici-gravel/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        byValue('marca', 'Marca', function (p) { return p.marca; }),
        { id: 'precio', title: 'Precio', mode: 'or', opts: [
          { v: 'p1', label: 'Hasta $10,000', test: function (p) { return p.precio <= 10000; } },
          { v: 'p2', label: '$10,000 – $25,000', test: function (p) { return p.precio > 10000 && p.precio <= 25000; } },
          { v: 'p3', label: 'Más de $25,000', test: function (p) { return p.precio > 25000; } }] },
        byValue('rueda', 'Rueda', function (p) { return p.rueda || null; })
      ];
    },
    '/electrodomesticos/microondas/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'amz', label: '<img src="/logoamazon.png" alt="Amazon" style="height:16px;vertical-align:middle">', test: function (p) { return !!p.linkAmz; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        { id: 'color', title: 'Color', mode: 'or', opts: [
          { v: 'plateado', label: 'Plateado / Silver', test: function (p) { return ['plateado','plata','silver'].includes((p.color||'').toLowerCase()); } },
          { v: 'negro', label: 'Negro', test: function (p) { return (p.color||'').toLowerCase() === 'negro'; } },
          { v: 'blanco', label: 'Blanco', test: function (p) { return (p.color||'').toLowerCase() === 'blanco'; } },
          { v: 'gris', label: 'Gris', test: function (p) { return (p.color||'').toLowerCase() === 'gris'; } }
        ]},
        { id: 'capacidad', title: 'Capacidad', mode: 'or', opts: [
          { v: 'c1', label: 'Hasta 20 L', test: function (p) { return typeof p.capacidad === 'number' && p.capacidad <= 20; } },
          { v: 'c2', label: '21–30 L', test: function (p) { return typeof p.capacidad === 'number' && p.capacidad > 20 && p.capacidad <= 30; } },
          { v: 'c3', label: 'Más de 30 L', test: function (p) { return typeof p.capacidad === 'number' && p.capacidad > 30; } }
        ]},
        flags('func', 'Funciones', [
          ['desc-auto', 'Desc. automático', function (p) { return p.funciones && p.funciones.includes('descongelar-peso'); }],
          ['silencio', 'Silencio', function (p) { return p.funciones && p.funciones.includes('silencio'); }],
          ['caliente', 'Mantener caliente', function (p) { return p.funciones && p.funciones.includes('mantener-caliente'); }],
          ['ninos', 'Seg. niños', function (p) { return p.funciones && p.funciones.includes('seguridad-ninos'); }]
        ]),
        brand()
      ];
    },
    '/electrodomesticos/refrigeradores/': function () {
      return [
        platform([
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }]),
        brand(),
        byValue('puertas', 'Puertas', function (p) { return p.puertas != null ? String(p.puertas) : null; },
          { 1: '1 puerta', 2: '2 puertas', 3: '3 puertas', 4: '4 puertas' }, ['1', '2', '3', '4']),
        { id: 'capacidad', title: 'Capacidad', mode: 'or', opts: [
          { v: 'c1', label: 'Hasta 250 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL <= 250; } },
          { v: 'c2', label: '250 a 400 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL > 250 && p.capacidadL <= 400; } },
          { v: 'c3', label: '400 a 550 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL > 400 && p.capacidadL <= 550; } },
          { v: 'c4', label: 'Más de 550 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL > 550; } }] },
        flags('carac', 'Características', [
          ['freezer', 'Con freezer', function (p) { return p.conFreezer === true; }],
          ['hielo', 'Dispensador de hielo', function (p) { return p.dispensadorHielo === true; }]])
      ];
    },
    '/electrodomesticos/ollas/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'amz', label: '<img src="/logoamazon.png" alt="Amazon" style="height:16px;vertical-align:middle">', test: function (p) { return !!p.linkAmz; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        { id: 'capacidad', title: 'Capacidad', mode: 'or', opts: [
          { v: 'c1', label: 'Hasta 3 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL <= 3; } },
          { v: 'c2', label: '3 a 5 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL > 3 && p.capacidadL <= 5; } },
          { v: 'c3', label: 'Más de 5 L', test: function (p) { return typeof p.capacidadL === 'number' && p.capacidadL > 5; } }
        ]},
        byValue('material', 'Material', function (p) { return p.material || null; }),
        byValue('tapaMaterial', 'Material tapa', function (p) { return p.tapaMaterial || null; }),
        flags('carac', 'Características', [
          ['mantenerCaliente', 'Mantener caliente', function (p) { return p.mantenerCaliente === true; }],
          ['displayDigital',   'Display digital',   function (p) { return p.displayDigital === true; }],
          ['programable',      'Programable',       function (p) { return p.programable === true; }]
        ]),
        brand(),
        dropFacet()
      ];
    },
    '/tecnologia/smartwatches/': function () {
      return [
        { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
          { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
          { v: 'amz', label: '<img src="/logoamazon.png" alt="Amazon" style="height:16px;vertical-align:middle">', test: function (p) { return !!p.linkAmz; } },
          { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
        ]},
        byValue('marca', 'Marca', function (p) { return p.marca || null; }),
        byValue('compatibilidad', 'Compatibilidad', function (p) { return p.especs && p.especs.compatibilidad || null; }),
        flags('carac', 'Características', [
          ['gps', 'GPS integrado', function (p) { return p.especs && p.especs.gps === 'Sí'; }],
          ['nfc', 'Con NFC', function (p) { return p.especs && p.especs.nfc === 'Sí'; }]
        ]),
        { id: 'bateria', title: 'Duración de batería', mode: 'or', pills: false, opts: [
          { v: 'horas', label: 'Menos de 1 día', test: function (p) {
            var v = p.especs && p.especs.bateria; if (!v || v === '—') return false;
            var n = parseFloat(v); if (isNaN(n)) return false;
            return v.indexOf(' h') > -1 && n < 24;
          }},
          { v: '1a7d', label: '1 a 7 días', test: function (p) {
            var v = p.especs && p.especs.bateria; if (!v || v === '—') return false;
            var n = parseFloat(v); if (isNaN(n)) return false;
            var d = v.indexOf('día') > -1 ? n : v.indexOf('semana') > -1 ? n * 7 : v.indexOf(' h') > -1 ? n / 24 : -1;
            return d >= 1 && d <= 7;
          }},
          { v: '1a2sem', label: '1 a 2 semanas', test: function (p) {
            var v = p.especs && p.especs.bateria; if (!v || v === '—') return false;
            var n = parseFloat(v); if (isNaN(n)) return false;
            var d = v.indexOf('día') > -1 ? n : v.indexOf('semana') > -1 ? n * 7 : v.indexOf(' h') > -1 ? n / 24 : -1;
            return d > 7 && d <= 14;
          }},
          { v: 'mas2sem', label: 'Más de 2 semanas', test: function (p) {
            var v = p.especs && p.especs.bateria; if (!v || v === '—') return false;
            var n = parseFloat(v); if (isNaN(n)) return false;
            var d = v.indexOf('día') > -1 ? n : v.indexOf('semana') > -1 ? n * 7 : v.indexOf(' h') > -1 ? n / 24 : v.indexOf('mes') > -1 ? n * 30 : -1;
            return d > 14;
          }}
        ]}
      ];
    }
  };

  /* ── Filtrado ── */
  function pass(p, exceptId) {
    for (var i = 0; i < facets.length; i++) {
      var f = facets[i], s = sel[f.id];
      if (f.id === exceptId || !s || !s.length) continue;
      var chosen = f.opts.filter(function (o) { return s.indexOf(o.v) > -1; });
      var ok = f.mode === 'and' ? chosen.every(function (o) { return o.test(p); }) : chosen.some(function (o) { return o.test(p); });
      if (!ok) return false;
    }
    if (minInput && minInput.value) { var mn = parseFloat(minInput.value); if (mn > 0 && (priceOf(p) || 0) < mn) return false; }
    if (maxInput && maxInput.value) { var mx = parseFloat(maxInput.value); if (mx > 0 && (priceOf(p) || 0) > mx) return false; }
    return true;
  }
  // Filtro común: cada módulo (panel, favoritos, bajadas...) registra su regla; la página solo llama a cmxPass(p)
  window.cmxPassers = window.cmxPassers || [];
  window.cmxPass = window.cmxPass || function (p) { return window.cmxPassers.every(function (f) { return f(p); }); };
  var called = false;
  window.cmxPassers.push(function (p) { called = true; return pass(p, null); });
  function optCount(f, o) {
    return L.filter(function (p) { return pass(p, f.id) && o.test(p); }).length;
  }

  /* ── Interfaz ── */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }
  function activeCount() {
    var n = 0;
    facets.forEach(function (f) {
      (sel[f.id] || []).forEach(function (v) {
        var o = f.opts.filter(function (x) { return x.v === v; })[0];
        if (!o || !o.all) n++;
      });
    });
    if (minInput && minInput.value) n++;
    if (maxInput && maxInput.value) n++;
    return n;
  }
  function refresh() {
    facets.forEach(function (f) {
      f.opts.forEach(function (o) {
        var n = optCount(f, o);
        if (o.span) o.span.textContent = o.all ? '' : '(' + n + ')';
        if (o.row) o.row.classList.toggle('cmx-zero', n === 0 && (sel[f.id] || []).indexOf(o.v) < 0);
      });
    });
    var n = activeCount();
    clearBtn.classList.toggle('show', n > 0);
    var badge = openBtn.querySelector('.n');
    badge.textContent = n;
    badge.classList.toggle('show', n > 0);
  }
  function rerender() {
    if (typeof window.render === 'function') window.render(); else refresh();
    if (typeof window.cmxKeepInView === 'function') window.cmxKeepInView();
  }
  function clearAll() {
    facets.forEach(function (f) {
      var allOpt = f.opts.filter(function (o) { return o.all; })[0];
      sel[f.id] = allOpt ? [allOpt.v] : [];
      f.opts.forEach(function (o) {
        if (o.input) o.input.checked = sel[f.id].indexOf(o.v) > -1;
        if (o.row) o.row.classList.toggle('on', sel[f.id].indexOf(o.v) > -1);
      });
    });
    if (minInput) minInput.value = '';
    if (maxInput) maxInput.value = '';
    rerender();
  }
  function setOpen(v) {
    aside.classList.toggle('open', v);
    backdrop.classList.toggle('show', v);
    document.body.style.overflow = v ? 'hidden' : '';
  }

  function buildCheckRow(f, o, idx, LIMIT) {
    var row = el('label', 'cmx-fp-row');
    var input = el('input');
    input.type = 'checkbox';
    input.addEventListener('change', function () {
      var s = sel[f.id], i = s.indexOf(o.v);
      if (input.checked && i < 0) s.push(o.v);
      if (!input.checked && i > -1) s.splice(i, 1);
      if (f.id === 'bajada' && o.v === 'drop' && input.checked && typeof gtag === 'function') gtag('event', 'filtro_bajada_precio', { page_path: location.pathname });
      rerender();
    });
    var lbl = el('span', 'cmx-fp-lbl', o.label);
    var n = el('span', 'cmx-fp-n', '');
    row.appendChild(input); row.appendChild(lbl); row.appendChild(n);
    if (idx >= LIMIT) row.classList.add('cmx-fp-extra');
    o.row = row; o.input = input; o.span = n;
    return row;
  }
  function buildPillRow(f, o) {
    var btn = el('button', 'cmx-fp-pill', o.label);
    btn.type = 'button';
    btn.addEventListener('click', function () {
      sel[f.id] = [o.v];
      f.opts.forEach(function (x) { x.row.classList.toggle('on', x === o); });
      rerender();
    });
    o.row = btn;
    return btn;
  }

  function buildFacetSection(f) {
    var sec = el('div', 'cmx-fp-sec');
    sec.appendChild(el('h3', '', f.title));
    if (f.hidden) {
      sec.hidden = true;
      document.addEventListener('cmx:drops', function () { sec.hidden = !L.some(function (p) { return f.opts[0].test(p); }); });
    }
    if (f.pills) {
      var wrap = el('div', 'cmx-fp-pills');
      f.opts.forEach(function (o) { wrap.appendChild(buildPillRow(f, o)); });
      sec.appendChild(wrap);
    } else {
      if (f.id === 'marca') {
        var search = el('input', 'cmx-fp-search');
        search.type = 'text';
        search.placeholder = 'Buscar marca…';
        search.addEventListener('input', function () {
          var q = search.value.trim().toLowerCase();
          f.opts.forEach(function (o) { o.row.hidden = q && o.row.textContent.toLowerCase().indexOf(q) < 0; });
        });
        sec.appendChild(search);
      }
      var LIMIT = 7;
      f.opts.forEach(function (o, idx) { sec.appendChild(buildCheckRow(f, o, idx, LIMIT)); });
      if (f.opts.length > LIMIT) {
        var more = el('button', 'cmx-fp-more', 'Ver todas (' + f.opts.length + ')');
        more.type = 'button';
        more.addEventListener('click', function () {
          var open = sec.classList.toggle('cmx-fp-expanded');
          more.textContent = open ? 'Ver menos' : 'Ver todas (' + f.opts.length + ')';
        });
        sec.appendChild(more);
      }
    }
    return sec;
  }

  function build() {
    aside = document.getElementById('cmx-fp');
    var tb = document.getElementById('toolbar');
    var factory = CONFIG[path];
    if (!aside || !tb || !factory) return;
    main = aside.parentNode.querySelector('.cmx-fp-main');
    L = products();
    facets = factory().concat([dropFacet()]);
    // "Ofertas" va justo después de Disponibilidad, antes de las facetas propias de la categoría
    var plat = facets.shift();
    facets = [plat, facets.pop()].concat(facets);
    facets.forEach(function (f) {
      var allOpt = f.opts.filter(function (o) { return o.all; })[0];
      sel[f.id] = allOpt ? [allOpt.v] : [];
    });

    var head = el('div', 'cmx-fp-head');
    head.appendChild(el('span', 'cmx-fp-title', 'Filtros'));
    clearBtn = el('button', 'cmx-fp-clear', 'Limpiar todos');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', clearAll);
    var close = el('button', 'cmx-fp-close', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar filtros');
    close.addEventListener('click', function () { setOpen(false); });
    head.appendChild(clearBtn);
    head.appendChild(close);
    aside.appendChild(head);

    // Precio (MXN): mín y máx. Reutiliza el input "precio-max" que ya trae la página.
    maxInput = document.getElementById('precio-max');
    var sortSel = tb.querySelector('select');
    if (maxInput) {
      var ps = el('div', 'cmx-fp-sec');
      ps.appendChild(el('h3', '', 'Precio (MXN)'));
      var row = el('div', 'cmx-fp-price-row');
      minInput = el('input', 'cmx-fp-search');
      minInput.type = 'number'; minInput.min = '0'; minInput.placeholder = 'Mín.';
      maxInput.className += ' cmx-fp-search'; maxInput.placeholder = 'Máx.';
      row.appendChild(minInput);
      row.appendChild(el('span', 'cmx-fp-price-sep', '—'));
      row.appendChild(maxInput);
      ps.appendChild(row);
      aside.appendChild(ps);
      minInput.addEventListener('input', function () { setTimeout(rerender, 0); });
      maxInput.addEventListener('input', function () { setTimeout(rerender, 0); });
    }

    facets.forEach(function (f) { aside.appendChild(buildFacetSection(f)); });

    // Ordenar: fila propia sobre el listado
    if (sortSel) {
      var srow = el('div', 'cmx-fp-sort', 'Ordenar:');
      srow.appendChild(sortSel);
      sortSel.addEventListener('change', function () { if (window.cmxKeepInView) window.cmxKeepInView(); });
      var info = main.querySelector('.result-info');
      if (info) info.parentNode.insertBefore(srow, info); else main.insertBefore(srow, main.firstChild);
    }

    openBtn = el('button', 'cmx-fp-open', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtros <span class="n"></span>');
    openBtn.type = 'button';
    openBtn.addEventListener('click', function () { setOpen(true); });
    main.insertBefore(openBtn, main.firstChild);
    var strip = main.querySelector('.how-strip');
    if (strip) main.insertBefore(strip, main.firstChild);
    backdrop = el('div', 'cmx-fp-backdrop');
    backdrop.addEventListener('click', function () { setOpen(false); });
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

    // "Guardados" (favoritos) se inserta aquí, entre Disponibilidad y Ofertas, si favorites.js está cargado
    if (typeof window.cmxBuildFavSection === 'function') {
      var favSec = window.cmxBuildFavSection();
      if (favSec) {
        var ofertas = [].filter.call(aside.querySelectorAll('.cmx-fp-sec h3'), function (h) { return h.textContent === 'Ofertas'; })[0];
        aside.insertBefore(favSec, ofertas ? ofertas.parentNode : null);
      }
    }

    if (typeof window.render === 'function') {
      var orig = window.render;
      window.render = function () { var r = orig.apply(this, arguments); refresh(); return r; };
      window.render();
      // Si la página quedó guardada en caché sin el enlace a cmxPass, recarga una vez para traer la versión actual
      if (!called && L.length && !sessionStorage.getItem('cmx_fp_heal')) {
        try { sessionStorage.setItem('cmx_fp_heal', '1'); } catch (e) {}
        location.reload();
      }
    } else refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
