/* comparalo.mx — panel de filtros a la izquierda (casillas de selección múltiple con contador).
   Requiere <html data-cmx-filters="panel"> y <aside id="cmx-fp"> dentro de .cmx-fp-layout.
   Las opciones salen de los datos de cada página. Dentro de un grupo las opciones suman (O);
   entre grupos se combinan (Y). La página solo agrega en su filtro: if (window.cmxPass && !cmxPass(p)) return false; */
(function () {
  var aside, main, openBtn, backdrop, clearBtn, facets = [], sel = {}, L = [];
  var path = location.pathname;

  /* ── Utilidades de datos ── */
  function products() {
    try { return typeof productos !== 'undefined' ? productos : PRODUCTOS; } catch (e) { return []; }
  }
  function priceOf(p) {
    try { if (typeof precioVigente === 'function') return precioVigente(p); } catch (e) {}
    return p.precio;
  }
  function maxPrice() {
    var i = document.getElementById('precio-max');
    return (i && parseFloat(i.value)) || Infinity;
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
      { v: 'drop', label: 'Bajó de precio', test: function (p) { return !!(window.cmxGetDrop && window.cmxGetDrop(p)); } }] };
  }
  function brand() { return byValue('marca', 'Marca', function (p) { return p.marca; }); }
  function cost(edges) { return buckets('costo', 'Costo por porción', function (p) { return p.costoPorPorcion; }, edges); }

  var CONFIG = {
    '/suplementos/magnesio/': function () {
      return [
        byValue('forma', 'Forma', function (p) { return p.formaMagnesio; }, { treonato: 'L-Treonato', otro: 'Otros' }),
        byValue('absorcion', 'Absorción', function (p) { return p.absorcion; }, null, ['muy alta', 'alta', 'media', 'mixta']),
        { id: 'plataforma', title: 'Plataforma', mode: 'or', opts: [
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } },
          { v: 'ambas', label: 'En ambas', test: function (p) { return !!(p.linkML && p.linkAmz); } }] },
        cost([2, 5, 10]), brand(),
        flags('carac', 'Características', [['vegano', 'Vegano', function (p) { return p.vegano === true; }]])
      ];
    },
    '/suplementos/omega3/': function () {
      return [
        byValue('fuente', 'Fuente', function (p) { return p.fuenteOmega; }, { anchoa: 'Anchoa', linaza: 'Linaza', 'multi-pez': 'Multi-pez', salmon: 'Salmón', krill: 'Krill' }),
        { id: 'plataforma', title: 'Plataforma', mode: 'or', opts: [
          { v: 'ml', label: 'Solo Mercado Libre', test: function (p) { return !!(p.linkML && !p.linkAmz); } },
          { v: 'amz', label: 'Solo Amazon', test: function (p) { return !!(p.linkAmz && !p.linkML); } },
          { v: 'ambas', label: 'En ambas', test: function (p) { return !!(p.linkML && p.linkAmz); } }] },
        cost([3, 6, 12]), brand(),
        flags('carac', 'Características', [
          ['metales', 'Libre de metales pesados', function (p) { return p.libreMetalesPesados === true; }],
          ['ifos', 'Certificado IFOS', function (p) { return p.certificadoIFOS === true; }]])
      ];
    },
    '/suplementos/complejo-b/': function () {
      return [
        byValue('b12', 'Forma de B12', function (p) { return p.formaB12; }),
        { id: 'plataforma', title: 'Plataforma', mode: 'or', opts: [
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }] },
        cost([2.5, 3.5, 6]), brand(),
        byValue('caps', 'Cápsulas por día', function (p) { return p.capsulasPorDia; }, { 1: '1 al día', 2: '2 al día' })
      ];
    },
    '/suplementos/vitamina-d/': function () {
      return [
        byValue('formato', 'Formato', function (p) { return p.formato; }, { gotas: 'Gotas', 'cápsula': 'Cápsulas' }),
        { id: 'k2', title: 'Con vitamina K2', mode: 'or', opts: [
          { v: 'si', label: 'Con K2', test: function (p) { return p.conK2 === 'Sí'; } },
          { v: 'no', label: 'Solo D3', test: function (p) { return p.conK2 !== 'Sí'; } }] },
        { id: 'plataforma', title: 'Plataforma', mode: 'or', opts: [
          { v: 'ml', label: 'Mercado Libre', test: function (p) { return !!p.linkML; } },
          { v: 'amz', label: 'Amazon', test: function (p) { return !!p.linkAmz; } }] },
        cost([2, 4, 10]), brand(),
        flags('carac', 'Características', [
          ['vegano', 'Vegano', function (p) { return p.vegano === 'Sí'; }],
          ['gluten', 'Sin gluten', function (p) { return p.sinGluten === 'Sí'; }],
          ['lactosa', 'Sin lactosa', function (p) { return p.sinLactosa === 'Sí'; }]])
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
    return true;
  }
  // Filtro común: cada módulo registra su regla y la página solo llama a cmxPass(p)
  window.cmxPassers = window.cmxPassers || [];
  window.cmxPass = window.cmxPass || function (p) { return window.cmxPassers.every(function (f) { return f(p); }); };
  var called = false;
  window.cmxPassers.push(function (p) { called = true; return pass(p, null); });
  function underPrice(p) { var m = maxPrice(); return !(m < Infinity && (priceOf(p) || 0) > m); }
  function optCount(f, o) {
    return L.filter(function (p) { return underPrice(p) && pass(p, f.id) && o.test(p); }).length;
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
    facets.forEach(function (f) { n += (sel[f.id] || []).length; });
    var mx = document.getElementById('precio-max');
    if (mx && mx.value) n++;
    return n;
  }
  function refresh() {
    facets.forEach(function (f) {
      f.opts.forEach(function (o) {
        var n = optCount(f, o);
        o.span.textContent = '';
        o.row.classList.toggle('cmx-zero', n === 0 && (sel[f.id] || []).indexOf(o.v) < 0);
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
      sel[f.id] = [];
      f.opts.forEach(function (o) { o.input.checked = false; });
    });
    var mx = document.getElementById('precio-max');
    if (mx) mx.value = '';
    rerender();
  }
  function setOpen(v) {
    aside.classList.toggle('open', v);
    backdrop.classList.toggle('show', v);
    document.body.style.overflow = v ? 'hidden' : '';
  }

  function build() {
    aside = document.getElementById('cmx-fp');
    var tb = document.getElementById('toolbar');
    var factory = CONFIG[path];
    if (!aside || !tb || !factory) return;
    main = aside.parentNode.querySelector('.cmx-fp-main');
    L = products();
    facets = [dropFacet()].concat(factory());
    facets.forEach(function (f) { sel[f.id] = []; });

    var head = el('div', 'cmx-fp-head');
    head.appendChild(el('span', 'cmx-fp-title', 'Filtros'));
    clearBtn = el('button', 'cmx-fp-clear', 'Limpiar todo');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', clearAll);
    var close = el('button', 'cmx-fp-close', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar filtros');
    close.addEventListener('click', function () { setOpen(false); });
    head.appendChild(clearBtn);
    head.appendChild(close);
    aside.appendChild(head);

    // Precio máximo: se reutiliza el mismo input de la página
    var priceInput = document.getElementById('precio-max');
    var sortSel = tb.querySelector('select');
    if (priceInput) {
      var ps = el('div', 'cmx-fp-sec');
      ps.appendChild(el('h3', '', 'Precio máximo (MXN)'));
      ps.appendChild(priceInput);
      aside.appendChild(ps);
      priceInput.addEventListener('input', function () { setTimeout(function () { refresh(); if (window.cmxKeepInView) window.cmxKeepInView(); }, 0); });
    }

    facets.forEach(function (f) {
      var sec = el('div', 'cmx-fp-sec');
      sec.appendChild(el('h3', '', f.title));
      if (f.hidden) {
        sec.hidden = true;
        document.addEventListener('cmx:drops', function () { sec.hidden = !L.some(function (p) { return f.opts[0].test(p); }); });
      }
      var LIMIT = 7;
      f.opts.forEach(function (o, idx) {
        var row = el('label', 'cmx-fp-row');
        var input = el('input');
        input.type = 'checkbox';
        input.addEventListener('change', function () {
          var s = sel[f.id], i = s.indexOf(o.v);
          if (input.checked && i < 0) s.push(o.v);
          if (!input.checked && i > -1) s.splice(i, 1);
          rerender();
        });
        var lbl = el('span', 'cmx-fp-lbl', o.label);
        var n = el('span', 'cmx-fp-n', '');
        row.appendChild(input); row.appendChild(lbl); row.appendChild(n);
        if (idx >= LIMIT) row.classList.add('cmx-fp-extra');
        o.row = row; o.input = input; o.span = n;
        sec.appendChild(row);
      });
      if (f.opts.length > LIMIT) {
        var more = el('button', 'cmx-fp-more', 'Ver todas (' + f.opts.length + ')');
        more.type = 'button';
        more.addEventListener('click', function () {
          var open = sec.classList.toggle('cmx-fp-expanded');
          more.textContent = open ? 'Ver menos' : 'Ver todas (' + f.opts.length + ')';
        });
        sec.appendChild(more);
      }
      aside.appendChild(sec);
    });

    // Ordenar: fila propia sobre el listado
    if (sortSel) {
      var row = el('div', 'cmx-fp-sort', 'Ordenar:');
      row.appendChild(sortSel);
      sortSel.addEventListener('change', function () { if (window.cmxKeepInView) window.cmxKeepInView(); });
      var info = main.querySelector('.result-info');
      if (info) info.parentNode.insertBefore(row, info); else main.insertBefore(row, main.firstChild);
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
