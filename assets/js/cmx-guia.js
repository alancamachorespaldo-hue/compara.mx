/* comparalo.mx — comportamiento de las guías de Mercado Libre (skill guia-ml-noviembre-2026).
 *
 * La guía define window.CMX_GUIA antes de cargar este archivo:
 *   { id, category, legacyPage, familias, rango:{min,max}, max (productos a comparar, 5 por defecto),
 *     catalogUrl, bajadasUrl, bajadasKey, idDe(dbId) -> id del producto en el listado de la categoría,
 *     compare:{ url }   listado de la categoría; se abre su comparativa con  url#comparar=id1,id2…
 *     fav:{ key, title, url, section }   mismos valores que el listado (favKey, title, ruta, section)
 *     specsDe(fam, especs, variante) -> [[etiqueta, icono, valor], …]   especificaciones de la tarjeta
 *     ofertaOk(catalogo, bajada) -> bool                             filtra las ofertas del día
 *     varianteDe(especs, fam) -> texto corto                            línea de la fila de ofertas
 *       Los dos son opcionales: sin ellos se pintan las especificaciones de celular. }
 * familias: [{ modeloBase, dbId, nombre, corto, img, destaca, chip, pantalla, camPrincipal, bateria, red, nfc,
 *              especs (opcional, para categorías que no son celulares),
 *              variantes:[{ precio, linkML, ram, storage }] }]
 *   modeloBase debe ser el mismo id que usa el listado de la categoría (ahí f.id = f.modeloBase).
 *
 * Las tarjetas de producto son las del listado (clases cl-* de /assets/css/cmx-list.css): se pintan aquí.
 *   [data-cg-cards]               rejilla con todos los productos de la guía
 *   [data-cg-cardfor="<id>"]      una tarjeta (análisis de cada modelo)
 *   [data-cg-rail]                carrusel compacto
 *   [data-cg-offers]              ofertas verificadas (también se pueden comparar y guardar)
 * Controles (sin onclick en línea):
 *   [data-cg-sel="<id>"] agrega/quita de la comparación · [data-cg-fav="<id>"] guarda/quita de Guardados
 *   [data-cg-go] [data-cg-clear] · [data-nav] barra inferior · [data-cg-open] [data-cg-close] paneles
 *   [data-cg-sec] secciones del índice · [data-cg-prod] enlace al análisis · [data-ga-ev] medición genérica
 *
 * Eventos GA4: conserva affiliate_click_ml, cta_click, select_product, compare_start, compare_2_products,
 * compare_3_products, favorito_guardar y favorito_quitar; añade la familia guide_*.
 */
(function () {
  'use strict';
  var C = window.CMX_GUIA;
  if (!C || !C.familias) return;
  var F = C.familias, MAX = C.max || 5, sel = [], REG = {}, OFFERS = [], VERIFIED = false;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(Number(n)).toLocaleString('es-MX'); };
  var v0 = function (f) { return (f.variantes && f.variantes[0]) || {}; };
  var svg = function (d, n, sw) { return '<svg width="' + (n || 15) + '" height="' + (n || 15) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/><rect x="5" y="10" width="6" height="4" fill="currentColor" stroke="none"/>',
    nfc: '<path d="M5 12a7 7 0 0 1 7-7"/><path d="M8.5 12A3.5 3.5 0 0 1 12 8.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M19 12a7 7 0 0 1-7 7"/><path d="M15.5 12a3.5 3.5 0 0 1-3.5 3.5"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    /* electrodomésticos */
    cup: '<path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><line x1="4" y1="21" x2="16" y2="21"/>',
    drop: '<path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><line x1="12" y1="18" x2="16" y2="11"/><circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13.5 2 5 13h5l-1.5 9L17 11h-5z"/>',
    steam: '<path d="M8 4c0 1.5 1.5 2 1.5 3.5S8 9.5 8 11"/><path d="M12 3c0 1.6 1.6 2.1 1.6 3.7S12 8.9 12 10.5"/><path d="M16 4c0 1.5 1.5 2 1.5 3.5S16 9.5 16 11"/><path d="M5 14h14v2a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/>',
    mill: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4"/><line x1="12" y1="4.5" x2="12" y2="9.6"/><line x1="12" y1="14.4" x2="12" y2="19.5"/><line x1="4.5" y1="12" x2="9.6" y2="12"/><line x1="14.4" y1="12" x2="19.5" y2="12"/>',
    /* suplementos */
    shield: '<path d="M12 21.5s7.5-3.6 7.5-9.4V5.2L12 2.5 4.5 5.2v6.9c0 5.8 7.5 9.4 7.5 9.4z"/><polyline points="8.6 11.8 11.2 14.4 15.6 10"/>',
    cup2: '<path d="M5.5 4h13l-1.2 14.2a2.4 2.4 0 0 1-2.4 2.2H9.1a2.4 2.4 0 0 1-2.4-2.2z"/><line x1="7" y1="9.5" x2="17" y2="9.5"/>'
  };
  var ML_IC = '<img class="cl-ml-ic" src="/logomercado-ic.png" alt="">';
  var gb = function (n) { return n >= 1000 ? (n / 1024) + ' TB' : n + ' GB'; };

  /* ── Histórico de precio (assets/js/cmx-historico.js) ──
     La guía declara  historico: 'celulares_android'  o un arreglo si mezcla categorías.
     La clave de cada producto es su dbId (el id de merged-admin.json), que es con el que
     se publica assets/data/historico/<categoria>.json. El JSON se baja solo al abrir el
     primer histórico: una guía que nadie despliega no pesa nada de más. */
  var HIST = !!(C.historico && window.cmxHist);
  if (HIST) window.cmxHist.init(C.historico);
  var IC_CHART = '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="12" width="3.5" height="7"/><rect x="10.2" y="7" width="3.5" height="12"/><rect x="15.4" y="14" width="3.5" height="5"/>';
  var IC_ARROW = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>';
  function histBtn(it, section) {
    if (!HIST || !it || !it.dbId) return '';
    return '<button type="button" class="cl-hist-b" data-cg-hist="' + esc(it.dbId) + '" data-cg-histfor="' + esc(it.id)
      + '" data-ga-section="' + esc(section || 'articulo') + '">'
      + svg(IC_CHART, 16, 1.8) + '<span class="lg">Histórico de precio · 30 días</span><span class="sm">Histórico · 30 días</span>'
      + svg(IC_ARROW, 15, 2.4) + '</button>';
  }
  function abrirHist(el) {
    var it = REG[el.getAttribute('data-cg-histfor')] || {};
    var v = it.fam ? v0(it.fam) : null;
    window.cmxHist.abrir(el.getAttribute('data-cg-hist'), {
      nombre: it.nombre || '', img: it.img || '',
      chip: v && v.storage ? gb(v.storage) : (it.variante || ''),
      precio: price(it), section: (C.fav && C.fav.section) || C.category || '', origen: 'guia',
    });
  }

  /* ── Registro de productos: los de la guía y, después, las ofertas ── */
  /* Las especificaciones de la tarjeta son las de celulares por omisión. Una guía de otra
     categoría declara  specsDe(fam, especs, variante) -> [[etiqueta, icono, valor], …]
     y  varianteDe(especs, fam) -> texto corto  (la línea de la fila de ofertas y el chip del
     histórico). Sin esos dos, el comportamiento es el de las guías de celulares. */
  F.forEach(function (f, i) {
    var v = v0(f);
    REG[f.modeloBase] = { id: f.modeloBase, dbId: f.dbId, nombre: f.nombre, corto: f.corto || f.nombre, img: f.img, own: true, pos: i + 1, fam: f,
      especs: f.especs || null,
      variante: C.varianteDe ? (C.varianteDe(f.especs || null, f) || '') : '',
      specs: C.specsDe ? function () { return C.specsDe(f, this.especs || {}, v) || []; } : function () {
        return [['Pantalla', 'screen', f.pantalla ? f.pantalla + '″' + (f.hz ? ' · ' + f.hz + ' Hz' : '') : (this.especs && this.especs.pantalla) || null],
          ['Procesador', 'spark', f.chip || (this.especs && this.especs.chip) || null], ['RAM', 'tag', v.ram ? v.ram + ' GB' : null], ['Almacenamiento', 'tag', v.storage ? gb(v.storage) : null],
          ['Cámara trasera', 'phone', f.camPrincipal ? f.camPrincipal + ' MP' : null], ['Batería', 'battery', f.bateria || null],
          ['Red', 'nfc', f.red ? f.red + (f.nfc ? ' · NFC' : '') : null]];
      } };
  });
  var price = function (it) { return it.fam ? v0(it.fam).precio : it.precio; };
  var link = function (it) { return it.fam ? v0(it.fam).linkML : it.link; };

  /* ── Medición ── */
  function ev(name, p) {
    var o = { guide_id: C.id, guide_category: C.category }, k;
    for (k in p) if (p[k] != null && p[k] !== '') o[k] = p[k];
    try {
      if (typeof window.trackEvent === 'function') window.trackEvent(name, o);
      else if (typeof window.gtag === 'function') window.gtag('event', name, o);
    } catch (e) {}
  }
  function prodParams(it, section) {
    return { item_id: it.dbId || it.id, item_name: it.nombre, position: it.pos, page_section: section };
  }

  /* ── Guardados: mismo almacenamiento que el listado de la categoría y el panel del encabezado ── */
  var FAV = C.fav || null, FK = FAV ? 'comparalo:fav:' + FAV.key : null;
  function readFavs() { try { return new Set(JSON.parse(localStorage.getItem(FK) || '[]')); } catch (e) { return new Set(); } }
  var favs = FAV ? readFavs() : new Set();
  function toggleFav(id, section) {
    var it = REG[id]; if (!it || !FAV) return;
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    try {
      localStorage.setItem(FK, JSON.stringify(Array.from(favs)));
      var all = JSON.parse(localStorage.getItem('comparalo:favmeta') || '{}') || {};
      var cat = all[FAV.key] || { t: FAV.title, u: FAV.url, s: FAV.section, items: {} };
      cat.items = cat.items || {};
      if (favs.has(id)) cat.items[id] = { n: it.nombre, i: it.img, p: typeof price(it) === 'number' ? price(it) : null, l: link(it) || '' };
      else delete cat.items[id];
      if (Object.keys(cat.items).length) all[FAV.key] = cat; else delete all[FAV.key];
      localStorage.setItem('comparalo:favmeta', JSON.stringify(all));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('cmx:favs', { detail: { src: 'list' } }));
    ev(favs.has(id) ? 'favorito_guardar' : 'favorito_quitar', { product_name: it.nombre, item_id: it.dbId || it.id, value: favs.size, page_section: section });
    toast(favs.has(id) ? 'Guardado. Lo encuentras en «Guardados», arriba.' : 'Quitado de tus guardados.');
    paint();
  }
  window.addEventListener('cmx:favs', function (e) { if (e.detail && e.detail.src === 'panel') { favs = readFavs(); paint(); } });

  /* ── Selección ── */
  var toastT;
  function toast(msg) {
    var t = $('#cg-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }
  function toggle(id, section) {
    var it = REG[id]; if (!it) return;
    var i = sel.indexOf(id);
    if (i !== -1) {
      sel.splice(i, 1);
      ev('guide_compare_remove', prodParams(it, section));
    } else {
      if (sel.length >= MAX) { toast('Puedes comparar hasta ' + MAX + ' productos. Quita uno para agregar otro.'); paint(); return; }
      sel.push(id);
      var p = prodParams(it, section); p.selection_count = sel.length; if (C.legacyPage) p.page = C.legacyPage;
      ev('select_product', p);
    }
    paint();
  }
  function clear() { sel = []; paint(); }
  function go(section) {
    if (sel.length < 2 || !C.compare) return;
    var id = sel.slice().sort().join('__');
    var p = { comparison_id: id, count: sel.length, page_section: section }; if (C.legacyPage) p.page = C.legacyPage;
    ev('compare_start', p);
    if (sel.length === 2 || sel.length === 3) ev(sel.length === 2 ? 'compare_2_products' : 'compare_3_products', { comparison_id: id });
    try { sessionStorage.setItem('cmx:volver', JSON.stringify({ u: location.pathname })); } catch (e) {}
    window.location.href = C.compare.url + '#comparar=' + sel.map(encodeURIComponent).join(',');
  }

  /* ── Piezas ── */
  function mlBtn(it, section) {
    return '<a class="cl-btn-ml" href="' + esc(link(it)) + '" target="_blank" rel="sponsored nofollow noopener" data-cg-ml="' + esc(it.id) + '" data-ga-section="' + section + '" aria-label="Ver ' + esc(it.nombre) + ' en Mercado Libre">'
      + ML_IC + '<span class="lg">Ver en Mercado Libre</span><span class="sm">Ver en ML</span> <span aria-hidden="true">&#8599;</span></a>';
  }
  function cmpBtn(it, section, on) {
    return '<button type="button" class="cl-cmp" data-cg-sel="' + esc(it.id) + '" data-ga-section="' + section + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Quitar de la comparación: ' : 'Comparar: ') + esc(it.nombre) + '"><i></i>' + (on ? 'Comparando' : 'Comparar') + '</button>';
  }
  function favBtn(it, section) {
    if (!FAV) return '';
    var on = favs.has(it.id);
    return '<button type="button" class="cl-fav" data-cg-fav="' + esc(it.id) + '" data-ga-section="' + section + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Quitar de guardados: ' : 'Guardar: ') + esc(it.nombre) + '">' + svg(IC.heart, 22, 2.2) + '</button>';
  }
  /* Tarjeta del listado de la categoría (cl-card) */
  function card(it, section, withTag) {
    var on = sel.indexOf(it.id) !== -1, pr = price(it), r = C.rango || {};
    var specs = (it.specs ? it.specs() : []).filter(function (s) { return s[2]; }).map(function (s) {
      return '<li>' + svg(IC[s[1]] || IC.tag) + '<span><b>' + esc(s[0]) + ':</b> ' + esc(s[2]) + '</span></li>';
    }).join('') || '<li class="is-none">Especificaciones no disponibles</li>';
    var fuera = typeof pr === 'number' && ((r.max && pr > r.max) ? 'Hoy está en ' + money(pr) + ', por encima de los ' + money(r.max) + ' de esta guía.'
      : (r.min && pr < r.min) ? 'Hoy está en ' + money(pr) + ', por debajo de los ' + money(r.min) + ' de esta guía.' : '');
    return '<article class="cl-card' + (on ? ' is-sel' : '') + '" data-cg-card="' + esc(it.id) + '">'
      + '<div class="cl-card-top">' + cmpBtn(it, section, on) + favBtn(it, section) + '</div>'
      + (it.pct ? '<span class="cl-drop">&#8722;' + it.pct + '% · Bajó ' + money(it.antes - pr) + '</span>' : '')
      + '<div class="cl-card-img"><img src="' + esc(it.img) + '" alt="' + esc(it.nombre) + '" loading="lazy" referrerpolicy="no-referrer"></div>'
      + (withTag && it.fam && it.fam.destaca ? '<span class="cg-tag">' + esc(it.fam.destaca) + '</span>' : '')
      + '<h3 class="cl-card-name">' + (it.own ? '<a href="#sec-' + esc(it.id) + '" data-cg-prod="' + esc(it.id) + '" data-ga-section="' + section + '">' + esc(it.nombre) + '</a>' : esc(it.nombre)) + '</h3>'
      + '<ul class="cl-specs">' + specs + '</ul>'
      + '<div class="cl-price"><div class="cl-price-store">' + ML_IC + '<span>Mercado<br>Libre</span></div>'
      + '<div class="cl-price-row">' + (typeof pr === 'number' ? '<strong>' + money(pr) + ' MXN</strong>' : '<strong>Consulta el precio</strong>') + (it.pct ? '<s>' + money(it.antes) + ' MXN</s>' : '') + '</div>'
      + (fuera ? '<span class="cmx-rango">' + fuera + '</span>' : '')
      + mlBtn(it, section) + '</div>' + histBtn(it, section) + '</article>';
  }
  function offerRow(it) {
    var on = sel.indexOf(it.id) !== -1, pr = price(it);
    return '<div class="cg-of' + (on ? ' is-sel' : '') + '" data-cg-card="' + esc(it.id) + '">'
      + '<div class="cl-card-top">' + cmpBtn(it, 'ofertas', on) + favBtn(it, 'ofertas') + '</div>'
      + '<div class="cg-of-b"><img src="' + esc(it.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      + '<div><div class="cg-of-n">' + esc(it.nombre) + '</div>' + (it.variante ? '<div class="cg-of-v">' + esc(it.variante) + '</div>' : '')
      + '<div class="cg-of-p">' + (it.pct ? '<s>' + money(it.antes) + '</s>' : '') + '<b>' + money(pr) + '</b>' + (it.pct ? '<span class="cg-of-pct">−' + it.pct + '% · Bajó ' + money(it.antes - pr) + '</span>' : '') + '</div></div></div>'
      + mlBtn(it, 'ofertas') + '</div>';
  }
  function miniCard(it) {
    var on = sel.indexOf(it.id) !== -1, pr = price(it);
    return '<div class="cg-mini' + (on ? ' is-sel' : '') + '" data-cg-card="' + esc(it.id) + '">'
      + '<div class="cl-card-top">' + cmpBtn(it, 'precios_hoy', on) + favBtn(it, 'precios_hoy') + '</div>'
      + '<img src="' + esc(it.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"><strong>' + esc(it.nombre) + '</strong>'
      + '<div class="cg-price">' + (typeof pr === 'number' ? money(pr) : 'Consulta el precio') + '</div>' + mlBtn(it, 'precios_hoy') + '</div>';
  }

  /* ── Pintado ── */
  function paint() {
    var n = sel.length, own = F.map(function (f) { return REG[f.modeloBase]; });
    $$('[data-cg-cards]').forEach(function (b) { b.innerHTML = own.map(function (it) { return card(it, 'ficha', true); }).join(''); });
    $$('[data-cg-cardfor]').forEach(function (b) { var it = REG[b.getAttribute('data-cg-cardfor')]; if (it) b.innerHTML = card(it, 'analisis'); });
    $$('[data-cg-rail]').forEach(function (b) { b.innerHTML = own.map(miniCard).join(''); });
    var list = OFFERS.length ? OFFERS : own.filter(function (it) { return link(it) && price(it); });
    $$('[data-cg-offers]').forEach(function (b) { b.innerHTML = list.map(offerRow).join(''); });
    $$('[data-cg-offers-title]').forEach(function (t) { t.textContent = VERIFIED ? 'Ofertas del día' : 'Precios de hoy'; });
    /* Fichas del artículo: <div data-cmx-hist="<dbId>"></div> junto al data-cmx-precio */
    if (HIST) $$('[data-cmx-hist]').forEach(function (b) {
      var dbId = b.getAttribute('data-cmx-hist');
      var it = null;
      for (var k in REG) if (REG[k].dbId === dbId) { it = REG[k]; break; }
      b.innerHTML = histBtn(it || { id: '', dbId: dbId }, 'ficha_articulo');
    });
    $$('[data-cg-offers-foot]').forEach(function (t) {
      t.textContent = VERIFIED ? 'Bajadas de precio detectadas en Mercado Libre. El precio puede cambiar; confírmalo en la tienda.'
        : 'Hoy no detectamos bajadas en este rango. Estos son los precios actuales de los modelos de la guía.';
    });

    /* controles escritos en el HTML (casillas de la tabla, botones de «¿Cuál conviene?») */
    $$('[data-cg-sel]').forEach(function (el) {
      var on = sel.indexOf(el.getAttribute('data-cg-sel')) !== -1;
      if (el.type === 'checkbox') el.checked = on;
      else if (el.hasAttribute('data-cg-lbl')) { var sh = el.getAttribute('data-cg-lbl') === 'short'; el.setAttribute('aria-pressed', String(on)); el.textContent = on ? (sh ? '✓ Comparando' : '✓ Seleccionado para comparar') : (sh ? '＋ Comparar' : '＋ Seleccionar para comparar'); }
    });
    $$('tr[data-cg-card], .cg-pick[data-cg-card]').forEach(function (el) { el.classList.toggle('is-sel', sel.indexOf(el.getAttribute('data-cg-card')) !== -1); });
    $$('[data-cg-go]').forEach(function (b) { b.disabled = n < 2; });
    $$('[data-cg-count]').forEach(function (s) { s.textContent = n; });
    $$('[data-cg-max]').forEach(function (s) { s.textContent = MAX; });

    var slots = $('#cg-slots');
    if (slots) {
      var h = '';
      for (var i = 0; i < MAX; i++) {
        var it = REG[sel[i]];
        h += it
          ? '<div class="cg-slot" title="' + esc(it.nombre) + '"><img src="' + esc(it.img) + '" alt="' + esc(it.nombre) + '" referrerpolicy="no-referrer"><button type="button" data-cg-sel="' + esc(it.id) + '" data-ga-section="modulo_comparar" aria-label="Quitar ' + esc(it.nombre) + '">✕</button></div>'
          : '<a class="cg-slot is-empty" href="#sec-comparativa" aria-label="Agregar un producto">＋</a>';
      }
      slots.innerHTML = h;
    }

    var bar = $('#cg-bar'), chips = $('#cg-bar-chips');
    if (bar && chips) {
      bar.classList.toggle('is-on', n > 0);
      document.body.classList.toggle('has-bar', n > 0);
      var t = $('#cg-bar-t'); if (t) t.textContent = 'Comparando ' + n + (n === 1 ? ' producto' : ' productos');
      chips.innerHTML = sel.map(function (id) {
        var it = REG[id];
        return '<span class="cg-chip"><img src="' + esc(it.img) + '" alt="" referrerpolicy="no-referrer">' + esc(it.corto) + '<button type="button" data-cg-sel="' + esc(id) + '" data-ga-section="barra_comparar" aria-label="Quitar ' + esc(it.nombre) + '">✕</button></span>';
      }).join('') + (n < MAX ? '<a class="cg-chip cg-chip-add" href="#sec-comparativa">＋ Agregar otro (máx. ' + MAX + ')</a>' : '');
    }

    var badge = $('#cg-nav-n');
    if (badge) { badge.textContent = n; badge.classList.toggle('is-on', n > 0); }
    var navCmp = $('.cg-nav [data-nav="compare"]');
    if (navCmp) navCmp.setAttribute('aria-label', 'Comparar productos (' + n + ' seleccionados)');

    var sl = $('#cg-sel-list');
    if (sl) {
      var extra = sel.filter(function (id) { return !REG[id].own; }).map(function (id) { return REG[id]; });
      sl.innerHTML = own.concat(extra).map(function (it) {
        var on = sel.indexOf(it.id) !== -1, pr = price(it);
        return '<button type="button" class="cg-sel-row' + (on ? ' is-sel' : '') + '" data-cg-sel="' + esc(it.id) + '" data-ga-section="panel_comparar" aria-pressed="' + on + '">'
          + '<img src="' + esc(it.img) + '" alt="" referrerpolicy="no-referrer"><span>' + esc(it.nombre) + '<small>' + esc(it.own ? (it.fam.destaca || '') : 'Oferta del día') + (pr ? ' · ' + money(pr) : '') + '</small></span><i aria-hidden="true">' + (on ? '✓' : '') + '</i></button>';
      }).join('');
      var hint = $('#cg-sel-hint');
      if (hint) hint.textContent = n === 0 ? 'Elige de 2 a ' + MAX + ' productos para compararlos lado a lado. También puedes sumar ofertas del día.'
        : n === 1 ? 'Llevas 1. Agrega al menos otro (máx. ' + MAX + ').'
        : n < MAX ? 'Llevas ' + n + '. Ya puedes ver la comparativa o agregar más (máx. ' + MAX + ').'
        : 'Llevas ' + MAX + ', el máximo. Ya puedes ver la comparativa.';
    }
  }

  /* ── Paneles (móvil y ofertas en pantallas medianas) ── */
  var openName = null, opener = null;
  var OPEN_EV = { index: 'guide_index_open', offers: 'guide_offers_open', compare: 'guide_compare_open' };
  function sheet(name) { return document.getElementById('cg-sheet-' + name); }
  function close() {
    if (!openName) return;
    var s = sheet(openName); if (s) s.classList.remove('is-open');
    var bd = $('#cg-bd'); if (bd) bd.classList.remove('is-open');
    $$('.cg-nav [aria-expanded]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    openName = null;
    if (opener && opener.focus) opener.focus();
    opener = null;
  }
  function open(name, from, section) {
    if (openName === name) { close(); return; }
    close();
    var s = sheet(name); if (!s) return;
    s.classList.add('is-open');
    var bd = $('#cg-bd'); if (bd) bd.classList.add('is-open');
    var nb = $('.cg-nav [data-nav="' + name + '"]'); if (nb) nb.setAttribute('aria-expanded', 'true');
    openName = name; opener = from || null;
    var x = $('[data-cg-close]', s); if (x) x.focus();
    ev(OPEN_EV[name], { page_section: section, action_type: 'open' });
  }

  /* ── Índice ── */
  var secs = $$('[data-cg-sec]');
  function spy() {
    var cur = null, i;
    for (i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top <= 150) cur = secs[i].id;
    $$('.cg-toc a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    $$('.cg-toc li[data-cg-group]').forEach(function (li) { li.classList.toggle('is-open', !!$('a[aria-current="true"]', li)); });
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; spy(); });
  }, { passive: true });
  var toc = $('#cg-toc');
  if (toc) $$('[data-cg-toc-clone]').forEach(function (box) { var c = toc.cloneNode(true); c.removeAttribute('id'); box.appendChild(c); });

  /* ── Precios vivos + ofertas verificadas ── */
  function buildOffers(cat, baj) {
    var arr = (baj && baj.categorias && baj.categorias[C.bajadasKey]) || [], r = C.rango || {}, out = [];
    arr.forEach(function (b) {
      var c = cat[b.id];
      if (!(b.plataforma === 'ml' && c && c.linkML && Math.round(c.precioML) === Math.round(b.ahora) && b.antes > b.ahora && b.pct >= 1
        && (!r.max || b.ahora <= r.max) && (!r.min || b.ahora >= r.min))) return;
      /* ofertaOk: filtro propio de la guía (opcional). Una guía de espresso no debe anunciar
         cafeteras de goteo solo porque bajaron de precio dentro del mismo rango. */
      if (C.ofertaOk && !C.ofertaOk(c, b)) return;
      var id = C.idDe ? C.idDe(b.id) : b.id, it = REG[id], e = c.especs || {};
      if (!it) {
        it = REG[id] = { id: id, dbId: b.id, nombre: c.nombre.replace(/\s+\d+\s?(GB|TB)\/\d+\s?GB RAM$/i, ''), corto: c.nombre.replace(/\s+\d+\s?(GB|TB)\/\d+\s?GB RAM$/i, ''), img: c.imagen, precio: b.ahora, link: c.linkML, own: false, especs: e,
          variante: C.varianteDe ? (C.varianteDe(e, null) || '') : [e.almacenamiento, e.ram ? e.ram + ' RAM' : ''].filter(Boolean).join(' · ') };
      } else if (it.own) {
        it.variante = C.varianteDe ? (C.varianteDe(it.especs || e, it.fam) || '')
          : [v0(it.fam).storage ? gb(v0(it.fam).storage) : '', v0(it.fam).ram ? v0(it.fam).ram + ' GB RAM' : ''].filter(Boolean).join(' · ');
      }
      it.antes = Math.round(b.antes); it.pct = b.pct;
      if (out.indexOf(it) === -1) out.push(it);
    });
    out.sort(function (a, b) { return ((b.own ? 1 : 0) - (a.own ? 1 : 0)) || (b.pct - a.pct); });
    out = out.slice(0, 12);
    out.forEach(function (it, i) { if (!it.own) it.pos = i + 1; });
    return out;
  }
  function getJson(u) { return u ? fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null); }
  Promise.all([getJson(C.catalogUrl), getJson(C.bajadasUrl)]).then(function (res) {
    var cat = res[0], baj = res[1];
    if (!cat) return;
    var map = {};
    Object.keys(cat).forEach(function (k) { if (cat[k].linkML) map[cat[k].linkML] = cat[k].precioML; });
    F.forEach(function (f) {
      /* Un producto puede tener precio en la base pero ningún enlace guardado ahí (las
         subpáginas de suplementos conservan sus enlaces solo en el HTML, ver CLAUDE.md).
         En ese caso el enlace de la página es el bueno: se le asigna el precio de su dbId
         para que la ficha no se quede sin precio vivo teniéndolo registrado. */
      var cd = f.dbId ? cat[f.dbId] : null;
      if (cd && !cd.linkML && cd.precioML != null) (f.variantes || []).forEach(function (v) { if (v.linkML && map[v.linkML] == null) map[v.linkML] = cd.precioML; });
      (f.variantes || []).forEach(function (v) { if (v.linkML && map[v.linkML] != null) v.precio = map[v.linkML]; });
      if (f.dbId && cat[f.dbId]) REG[f.modeloBase].especs = cat[f.dbId].especs;
    });
    if (typeof window.cmxPreciosGuia === 'function') window.cmxPreciosGuia(F, map, C.rango);
    /* guias-precios.js es compartido: aquí se ajusta lo propio de las guías de Mercado Libre */
    $$('.cmx-precio-nd').forEach(function (el) { el.textContent = el.classList.contains('cg-p-inline') ? 'un precio que cambia a diario' : 'Consulta el precio en Mercado Libre'; });
    $$('[data-cmx-precio] + .cmx-rango').forEach(function (el) { el.parentNode.removeChild(el); });
    OFFERS = buildOffers(cat, baj); VERIFIED = OFFERS.length > 0;
    paint();
  });

  /* ── Clics (delegado) ── */
  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-cg-hist]'))) { abrirHist(el); return; }
    if ((el = t.closest('[data-cg-fav]'))) { toggleFav(el.getAttribute('data-cg-fav'), el.getAttribute('data-ga-section') || 'articulo'); return; }
    if ((el = t.closest('[data-cg-sel]'))) { toggle(el.getAttribute('data-cg-sel'), el.getAttribute('data-ga-section') || 'articulo'); return; }
    if ((el = t.closest('a[data-cg-ml]'))) {
      var it = REG[el.getAttribute('data-cg-ml')];
      if (it) {
        var p = prodParams(it, el.getAttribute('data-ga-section') || 'articulo');
        p.event_category = 'afiliado'; p.event_label = it.nombre; p.value = price(it) || 0;
        if (p.page_section === 'ofertas') p.is_offer = !!it.pct;
        ev('affiliate_click_ml', p);
      }
      return;
    }
    if ((el = t.closest('[data-cg-go]'))) { var sec = el.getAttribute('data-ga-section') || 'articulo'; close(); go(sec); return; }
    if ((el = t.closest('[data-cg-clear]'))) { clear(); return; }
    if ((el = t.closest('[data-cg-close]')) || t.id === 'cg-bd') { close(); return; }
    if ((el = t.closest('[data-cg-open]'))) { open(el.getAttribute('data-cg-open'), el, el.getAttribute('data-ga-section') || 'articulo'); return; }
    if ((el = t.closest('.cg-nav [data-nav]'))) {
      var nav = el.getAttribute('data-nav');
      if (nav === 'category') { ev('cta_click', { cta: 'nav_category', location: 'barra_movil' }); return; }
      open(nav, el, 'barra_movil');
      return;
    }
    if ((el = t.closest('.cg-toc a'))) {
      var inSheet = !!el.closest('.cg-sheet');
      ev('guide_section_click', { section_id: (el.getAttribute('href') || '').slice(1), page_section: inSheet ? 'panel_indice' : el.closest('.cg-toc-mob') ? 'indice_movil' : 'indice' });
      if (inSheet) close();
      var d = el.closest('details'); if (d) d.open = false;
      return;
    }
    if ((el = t.closest('[data-cg-prod]'))) {
      var ip = REG[el.getAttribute('data-cg-prod')];
      if (ip) ev('guide_product_click', prodParams(ip, el.getAttribute('data-ga-section') || 'articulo'));
      return;
    }
    if ((el = t.closest('[data-ga-ev]'))) {
      var name = el.getAttribute('data-ga-ev');
      if (name === 'cta_click') ev(name, { cta: el.getAttribute('data-ga-cta'), location: el.getAttribute('data-ga-section') });
      else ev(name, { page_section: el.getAttribute('data-ga-section'), section_id: el.getAttribute('data-ga-sec') });
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  var tocMob = $('.cg-toc-mob');
  if (tocMob) tocMob.addEventListener('toggle', function () { if (tocMob.open) ev('guide_index_open', { page_section: 'indice_movil', action_type: 'open' }); });

  paint();
  spy();
})();
