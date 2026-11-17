/* comparalo.mx — comportamiento de las guías de compra Amazon-only (piloto nov-2026).
 * Hermano de /assets/js/cmx-guia.js (guías de Mercado Libre) pero sin precios, sin
 * "Ofertas del día", sin histórico y sin favoritos: Amazon no permite comparativas de
 * precio en estas guías, así que no hay nada vivo que traer.
 *
 * La guía define window.CMX_GUIA_AMZ antes de cargar este archivo:
 *   { id, category, max (3 por defecto), categoryHref, categoryLabel,
 *     productos: [{ id, nombre, corto, img, link, especs:[[etiqueta,valor],…] }] }
 *
 * El HTML de la guía trae sus propias tarjetas/tabla/ficha (no se pintan por JS); este
 * archivo solo gestiona: índice con scroll-spy, selección para comparar (casillas y
 * botones [data-cg-sel]), tabla comparativa armada en el propio artículo, barra de
 * comparación, barra inferior móvil (Índice · Consejos · Compáralo · Categoría) y los
 * clics de medición (clic de afiliado vía [data-amz], [data-ga-ev] genérico).
 */
(function () {
  'use strict';
  var C = window.CMX_GUIA_AMZ;
  if (!C || !C.productos) return;
  var MAX = C.max || 3, sel = [], REG = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  C.productos.forEach(function (p, i) { REG[p.id] = { id: p.id, nombre: p.nombre, corto: p.corto || p.nombre, img: p.img, link: p.link, especs: p.especs || [], pos: i + 1 }; });

  /* ── Medición ── */
  function ev(name, p) {
    var o = { guide_id: C.id, guide_category: C.category }, k;
    for (k in p) if (p[k] != null && p[k] !== '') o[k] = p[k];
    try {
      if (typeof window.trackEvent === 'function') window.trackEvent(name, o);
      else if (typeof window.gtag === 'function') window.gtag('event', name, o);
    } catch (e) {}
  }
  function prodParams(it, section) { return { item_id: it.id, item_name: it.nombre, position: it.pos, page_section: section }; }

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
    if (i !== -1) { sel.splice(i, 1); ev('guide_compare_remove', prodParams(it, section)); }
    else {
      if (sel.length >= MAX) { toast('Puedes comparar hasta ' + MAX + ' productos. Quita uno para agregar otro.'); paint(); return; }
      sel.push(id);
      var p = prodParams(it, section); p.selection_count = sel.length;
      ev('select_product', p);
    }
    paint();
  }
  function clear() { sel = []; $('#cg-compare-output') && $('#cg-compare-output').classList.remove('show'); paint(); }
  function go(section) {
    if (sel.length < 2) return;
    var id = sel.slice().sort().join('__');
    ev('compare_start', { comparison_id: id, count: sel.length, page_section: section });
    if (sel.length === 2 || sel.length === 3) ev(sel.length === 2 ? 'compare_2_products' : 'compare_3_products', { comparison_id: id });
    var out = $('#cg-compare-output'), tbl = $('#cg-compare-table'), ver = $('#cg-compare-verdict');
    if (!out || !tbl) return;
    var rows = [], seen = {};
    sel.forEach(function (id2) { (REG[id2].especs || []).forEach(function (r2) { if (!seen[r2[0]]) { seen[r2[0]] = 1; rows.push(r2[0]); } }); });
    var html = '<table class="cg-tbl"><thead><tr><th>Característica</th>' + sel.map(function (id2) { return '<th>' + esc(REG[id2].corto) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (label) {
        return '<tr><td>' + esc(label) + '</td>' + sel.map(function (id2) {
          var r2 = (REG[id2].especs || []).find(function (x) { return x[0] === label; });
          return '<td>' + esc(r2 ? r2[1] : '—') + '</td>';
        }).join('') + '</tr>';
      }).join('')
      + '<tr class="cg-cmp-cta"><td>Ver en Amazon</td>' + sel.map(function (id2) {
        var it = REG[id2];
        return '<td><a class="cg-btn cg-btn-amz" href="' + esc(it.link) + '" target="_blank" rel="sponsored nofollow noopener" data-amz="' + esc(it.nombre) + '" data-loc="comparador">Ver en <img src="/logoamazon.png" alt="Amazon" onerror="this.outerHTML=\'Amazon\'"> <span aria-hidden="true">&#8599;</span></a></td>';
      }).join('') + '</tr></tbody></table>';
    tbl.innerHTML = html;
    if (ver) {
      var texto = (C.veredictos && C.veredictos[id]) || 'Compara las especificaciones de la tabla y revisa el checklist antes de decidir: en reacondicionadas, la configuración declarada no sustituye la verificación del vendedor.';
      ver.innerHTML = '<strong>¿Cuál conviene de estas ' + sel.length + '?</strong> ' + esc(texto);
    }
    out.classList.add('show');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Pintado ── */
  function paint() {
    var n = sel.length;
    $$('[data-cg-sel]').forEach(function (el) {
      var on = sel.indexOf(el.getAttribute('data-cg-sel')) !== -1;
      if (el.type === 'checkbox') el.checked = on;
      else if (el.hasAttribute('data-cg-lbl')) {
        var sh = el.getAttribute('data-cg-lbl') === 'short';
        el.setAttribute('aria-pressed', String(on));
        el.textContent = on ? (sh ? '✓ Comparando' : '✓ Seleccionado para comparar') : (sh ? '＋ Comparar' : '＋ Seleccionar para comparar');
      }
    });
    $$('tr[data-cg-card], .cg-card[data-cg-card]').forEach(function (el) { el.classList.toggle('is-sel', sel.indexOf(el.getAttribute('data-cg-card')) !== -1); });
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
      sl.innerHTML = C.productos.map(function (p) {
        var it = REG[p.id], on = sel.indexOf(p.id) !== -1;
        return '<button type="button" class="cg-sel-row' + (on ? ' is-sel' : '') + '" data-cg-sel="' + esc(it.id) + '" data-ga-section="panel_comparar" aria-pressed="' + on + '">'
          + '<img src="' + esc(it.img) + '" alt="" referrerpolicy="no-referrer"><span>' + esc(it.nombre) + '</span><i aria-hidden="true">' + (on ? '✓' : '') + '</i></button>';
      }).join('');
      var hint = $('#cg-sel-hint');
      if (hint) hint.textContent = n === 0 ? 'Elige de 2 a ' + MAX + ' productos para compararlos lado a lado.'
        : n === 1 ? 'Llevas 1. Agrega al menos otro (máx. ' + MAX + ').'
        : n < MAX ? 'Llevas ' + n + '. Ya puedes ver la comparativa o agregar más (máx. ' + MAX + ').'
        : 'Llevas ' + MAX + ', el máximo. Ya puedes ver la comparativa.';
    }
  }

  /* ── Paneles (móvil) ── */
  var openName = null, opener = null;
  var OPEN_EV = { index: 'guide_index_open', guide: 'guide_tips_open', compare: 'guide_compare_open' };
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

  /* ── Clics (delegado) ── */
  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-cg-sel]'))) { toggle(el.getAttribute('data-cg-sel'), el.getAttribute('data-ga-section') || 'articulo'); return; }
    if ((el = t.closest('a[data-amz]'))) {
      ev('affiliate_click_amazon', { event_category: 'afiliado', event_label: el.getAttribute('data-amz'), location: el.getAttribute('data-loc') || 'guia' });
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
