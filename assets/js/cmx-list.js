/* comparalo.mx — motor de la plantilla de listado (rediseño nov-2026).
   Filtros con contador, chips activos, tarjetas con selección, favoritos, dock de comparación y
   comparativa completa con veredicto. Cada página lo configura con CmxList.init({...}) y sus propios
   datos; aquí no hay nada específico de una categoría.
   Reglas: solo Mercado Libre (sin precios ni botones de Amazon) y ningún dato inventado: lo que no
   está en el producto no se muestra, y el veredicto solo declara ganador con evidencia. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('es-MX') + ' MXN'; };
  var ga = function (name, params) { if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} } };
  var svg = function (d, n, sw) { return '<svg width="' + (n || 16) + '" height="' + (n || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IC = {
    screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/><rect x="5" y="10" width="6" height="4" fill="currentColor" stroke="none"/>',
    gps: '<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    nfc: '<path d="M5 12a7 7 0 0 1 7-7"/><path d="M8.5 12A3.5 3.5 0 0 1 12 8.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M19 12a7 7 0 0 1-7 7"/><path d="M15.5 12a3.5 3.5 0 0 1-3.5 3.5"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
    up: '<polyline points="6 15 12 9 18 15"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
    filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  };
  var ML_IC = '<img class="cl-ml-ic" src="/logomercado.png" alt="">';
  var EMPTY_ART = '<svg width="180" height="120" viewBox="0 0 180 120" fill="none" aria-hidden="true"><ellipse cx="86" cy="62" rx="74" ry="46" fill="#EAF7EF"/><rect x="58" y="6" width="40" height="18" rx="5" fill="#00843D"/><rect x="58" y="94" width="40" height="20" rx="5" fill="#00843D"/><rect x="48" y="20" width="60" height="78" rx="14" fill="#fff" stroke="#111827" stroke-width="5"/><polyline points="68 60 76 68 90 52" stroke="#00843D" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="122" cy="80" r="19" fill="#fff" stroke="#111827" stroke-width="6"/><line x1="136" y1="94" x2="152" y2="110" stroke="#111827" stroke-width="8" stroke-linecap="round"/><line x1="128" y1="14" x2="134" y2="26" stroke="#F6D94A" stroke-width="5" stroke-linecap="round"/><line x1="146" y1="18" x2="140" y2="30" stroke="#F6D94A" stroke-width="5" stroke-linecap="round"/></svg>';

  function init(cfg) {
    var items = cfg.items || [];
    var PAGE = 24;
    var st = { sel: {}, max: null, drop: false, favOnly: false, q: '', sort: 'default', shown: PAGE, picked: [] };
    var favKey = 'comparalo:fav:' + (cfg.favKey || cfg.section);
    var favs = (function () { try { return new Set(JSON.parse(localStorage.getItem(favKey) || '[]')); } catch (e) { return new Set(); } })();
    var price = cfg.price, byId = {};
    items.forEach(function (p) { byId[String(p.id)] = p; });
    var prices = items.map(price).filter(function (v) { return typeof v === 'number'; });
    var PMIN = prices.length ? Math.floor(Math.min.apply(null, prices) / 100) * 100 : 0;
    var PMAX = prices.length ? Math.ceil(Math.max.apply(null, prices) / 100) * 100 : 0;
    var getDrop = function (p) { return window.cmxGetDrop ? window.cmxGetDrop(p) : null; };
    var noun = function (n) { return n === 1 ? cfg.noun.one : cfg.noun.many; };

    /* ── Facetas: opciones y contadores salen de los datos ── */
    var facets = (cfg.facets || []).map(function (f) {
      var opts;
      if (f.options) opts = f.options.map(function (o) { return { v: o[0], label: o[1], test: o[2] }; });
      else {
        var counts = {};
        items.forEach(function (p) { var v = f.get(p); if (v != null && v !== '') counts[v] = (counts[v] || 0) + 1; });
        opts = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).map(function (v) {
          return { v: v, label: (f.labels && f.labels[v]) || v, test: function (p) { return String(f.get(p)) === v; } };
        });
      }
      opts.forEach(function (o) { o.n = items.filter(o.test).length; });
      opts = opts.filter(function (o) { return o.n > 0; });
      st.sel[f.id] = new Set();
      return { id: f.id, title: f.title, mode: f.mode || 'or', limit: f.limit || 0, opts: opts };
    }).filter(function (f) { return f.opts.length; });

    function pass(p) {
      for (var i = 0; i < facets.length; i++) {
        var f = facets[i], s = st.sel[f.id];
        if (!s.size) continue;
        var on = f.opts.filter(function (o) { return s.has(o.v); });
        var ok = f.mode === 'and' ? on.every(function (o) { return o.test(p); }) : on.some(function (o) { return o.test(p); });
        if (!ok) return false;
      }
      if (st.max != null) { var v = price(p); if (typeof v !== 'number' || v > st.max) return false; }
      if (st.drop && !getDrop(p)) return false;
      if (st.favOnly && !favs.has(String(p.id))) return false;
      if (st.q) { if ((cfg.text(p) || '').toLowerCase().indexOf(st.q) < 0) return false; }
      return true;
    }
    function activeChips() {
      var out = [];
      facets.forEach(function (f) { f.opts.forEach(function (o) { if (st.sel[f.id].has(o.v)) out.push({ k: 'f:' + f.id + ':' + o.v, label: o.label }); }); });
      if (st.max != null) out.push({ k: 'max', label: 'Hasta ' + money(st.max).replace(' MXN', '') });
      if (st.drop) out.push({ k: 'drop', label: 'Bajó de precio' });
      if (st.q) out.push({ k: 'q', label: '“' + st.q + '”' });
      return out;
    }
    function removeChip(k) {
      if (k === 'max') st.max = null; else if (k === 'drop') st.drop = false; else if (k === 'fav') st.favOnly = false; else if (k === 'q') { st.q = ''; var i = $('cl-search-in'); if (i) i.value = ''; }
      else { var parts = k.split(':'); st.sel[parts[1]].delete(parts.slice(2).join(':')); }
      syncFilters(); render();
    }
    function clearAll(all) {
      ga('filtros_limpiar', { page_section: cfg.section });
      facets.forEach(function (f) { st.sel[f.id].clear(); });
      st.max = null; st.drop = false; st.q = ''; if (all) st.favOnly = false;
      var i = $('cl-search-in'); if (i) i.value = '';
      syncFilters(); render();
    }

    /* ── Panel de filtros ── */
    function buildFilters() {
      var el = $('cl-filters'); if (!el) return;
      var groups = facets.map(function (f) {
        var rows = f.opts.map(function (o, i) {
          return '<label class="cl-f-opt' + (f.limit && i >= f.limit ? ' cl-f-extra' : '') + '"><input type="checkbox" data-f="' + esc(f.id) + '" data-v="' + esc(o.v) + '"><span>' + esc(o.label) + ' <em>(' + o.n + ')</em></span></label>';
        }).join('');
        var more = f.limit && f.opts.length > f.limit ? '<button type="button" class="cl-f-more" data-more>Ver las ' + f.opts.length + '</button>' : '';
        return '<details class="cl-f-group" open><summary>' + esc(f.title) + '</summary><div class="cl-f-body">' + rows + more + '</div></details>';
      }).join('');
      el.innerHTML = '<div class="cl-f-head"><h2 class="cl-f-title">Filtros</h2><button type="button" class="cl-f-clear" data-clear>Limpiar todo</button>'
        + '<button type="button" class="cl-f-close" data-close>' + svg(IC.x, 18, 2.6) + ' Cerrar</button></div>'
        + '<p class="cl-f-active" id="cl-f-active"></p>'
        + '<div class="cl-f-scroll">'
        + '<details class="cl-f-group" open><summary>Precio máximo</summary><div class="cl-f-body"><input class="cl-range" id="cl-range" type="range" min="' + PMIN + '" max="' + PMAX + '" step="100" value="' + PMAX + '" aria-label="Precio máximo"><p class="cl-range-val" id="cl-range-val"></p></div></details>'
        + '<label class="cl-f-opt cl-f-check"><input type="checkbox" id="cl-drop"><span><b>Solo bajó de precio</b><small>Mostrar únicamente productos que bajaron de precio.</small></span></label>'
        + '<label class="cl-f-opt cl-f-check"><input type="checkbox" id="cl-fav-only"><span><b>Mis guardados <em id="cl-fav-n"></em></b><small>Mostrar solo los productos que guardaste con el corazón.</small></span></label>'
        + groups
        + '</div>'
        + '<div class="cl-f-foot"><button type="button" class="cl-btn-out" data-clear>Limpiar todo</button><button type="button" class="cl-btn-green" data-close id="cl-f-apply"></button></div>';
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t.dataset.f) { var s = st.sel[t.dataset.f]; if (t.checked) { s.add(t.dataset.v); ga('filtro_aplicar', { filtro: t.dataset.f, valor: t.dataset.v, page_section: cfg.section }); } else s.delete(t.dataset.v); }
        else if (t.id === 'cl-drop') { st.drop = t.checked; if (st.drop) ga('filtro_bajada_precio', { page_path: location.pathname }); }
        else if (t.id === 'cl-fav-only') { st.favOnly = t.checked; if (st.favOnly) ga('filtro_guardados', { origen: 'panel', value: favs.size, page_section: cfg.section }); }
        else if (t.id === 'cl-range') { if (st.max != null) ga('filtro_aplicar', { filtro: 'precio_max', valor: String(st.max), page_section: cfg.section }); return; }
        render();
      });
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'cl-range') return;
        var v = +e.target.value; st.max = v >= PMAX ? null : v; render();
      });
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-clear],[data-close],[data-more]'); if (!t) return;
        if (t.hasAttribute('data-clear')) clearAll();
        else if (t.hasAttribute('data-close')) drawer(false);
        else { t.closest('.cl-f-group').classList.add('is-all'); t.remove(); }
      });
    }
    function syncFilters() {
      var el = $('cl-filters'); if (!el) return;
      [].forEach.call(el.querySelectorAll('input[data-f]'), function (i) { i.checked = st.sel[i.dataset.f].has(i.dataset.v); });
      var d = $('cl-drop'); if (d) d.checked = st.drop;
      var fo = $('cl-fav-only'); if (fo) fo.checked = st.favOnly;
      var r = $('cl-range'); if (r) r.value = st.max == null ? PMAX : st.max;
    }
    function drawer(open) {
      var el = $('cl-filters'), bd = $('cl-backdrop'); if (!el) return;
      el.classList.toggle('is-open', open); if (bd) bd.classList.toggle('is-on', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    /* ── Tarjeta ── */
    function card(p) {
      var on = st.picked.indexOf(String(p.id)) >= 0, fav = favs.has(String(p.id)), d = getDrop(p), v = price(p);
      var specs = cfg.specs.map(function (s) { var val = s.get(p); return val == null || val === '' ? '' : '<li>' + svg(IC[s.icon] || IC.tag, 15) + '<span><b>' + esc(s.label) + ':</b> ' + esc(val) + '</span></li>'; }).join('');
      if (!specs) specs = '<li class="is-none">Especificaciones no disponibles</li>';
      var name = esc(cfg.name(p));
      return '<article class="cl-card' + (on ? ' is-sel' : '') + '" data-id="' + esc(p.id) + '">'
        + '<div class="cl-card-top"><button type="button" class="cl-cmp" data-pick aria-pressed="' + on + '" aria-label="' + (on ? 'Quitar de la comparación: ' : 'Comparar: ') + name + '"><i></i>' + (on ? 'Comparando' : 'Comparar') + '</button>'
        + '<button type="button" class="cl-fav" data-fav aria-pressed="' + fav + '" aria-label="' + (fav ? 'Quitar de favoritos' : 'Guardar en favoritos') + '">' + svg(IC.heart, 22, 2.2) + '</button></div>'
        + (d ? '<span class="cl-drop">&#8722;' + d.pct + '% · Bajó ' + money(d.ahorro).replace(' MXN', '') + '</span>' : '')
        + '<div class="cl-card-img"><img src="' + esc(cfg.img(p)) + '" alt="' + name + '" loading="lazy" referrerpolicy="no-referrer"></div>'
        + '<h3 class="cl-card-name">' + name + '</h3>'
        + '<ul class="cl-specs">' + specs + '</ul>'
        + '<div class="cl-price"><div class="cl-price-store">' + ML_IC + '<span>Mercado<br>Libre</span></div>'
        + '<div class="cl-price-row">' + (typeof v === 'number' ? '<strong>' + money(v) + '</strong>' : '<strong>Consulta el precio</strong>') + (d ? '<s>' + money(d.antes) + '</s>' : '') + '</div>'
        + buy(p, v) + '</div></article>';
    }
    function buy(p, v) {
      return '<a class="cl-btn-ml" href="' + esc(cfg.link(p)) + '" target="_blank" rel="sponsored nofollow noopener" data-n="' + esc(cfg.name(p)) + '" data-v="' + (v || 0) + '"><span class="lg">Ver en Mercado Libre</span><span class="sm">Ver en ML</span> <span aria-hidden="true">&#8599;</span></a>';
    }

    /* ── Listado ── */
    function sorted(list) {
      var a = list.slice();
      if (st.sort === 'precio-asc') a.sort(function (x, y) { return (price(x) == null ? Infinity : price(x)) - (price(y) == null ? Infinity : price(y)); });
      else if (st.sort === 'precio-desc') a.sort(function (x, y) { return (price(y) || 0) - (price(x) || 0); });
      else if (cfg.rank) a.sort(function (x, y) { return cfg.rank(y) - cfg.rank(x); });
      return a;
    }
    function render() {
      var list = sorted(items.filter(pass)), chips = activeChips();
      var chipHtml = chips.map(function (c) { return '<button type="button" class="cl-chip" data-chip="' + esc(c.k) + '" aria-label="Quitar filtro ' + esc(c.label) + '">' + esc(c.label) + '</button>'; }).join('');
      $('cl-chips').innerHTML = chipHtml + (chips.length ? '<button type="button" class="cl-chips-clear" data-clear-chips>' + svg(IC.trash, 15) + ' Limpiar filtros</button>' : '');
      $('cl-count').textContent = list.length + ' ' + noun(list.length) + (st.max != null ? ' · hasta ' + money(st.max) : '');
      var act = $('cl-f-active'); if (act) { act.textContent = chips.length + (chips.length === 1 ? ' filtro activo' : ' filtros activos'); act.classList.toggle('is-on', chips.length > 0); }
      var ob = $('cl-open-n'); if (ob) { ob.textContent = chips.length; ob.classList.toggle('is-on', chips.length > 0); }
      var ap = $('cl-f-apply'); if (ap) ap.innerHTML = 'Ver ' + list.length + ' ' + noun(list.length) + ' ' + svg(IC.arrow, 18, 2.6);
      var nf = items.filter(function (p) { return favs.has(String(p.id)); }).length;
      var fn = $('cl-fav-n'); if (fn) fn.textContent = '(' + nf + ')';
      var sb = $('cl-saved'); if (sb) { $('cl-saved-n').textContent = nf; sb.setAttribute('aria-pressed', st.favOnly); sb.classList.toggle('has-favs', nf > 0); sb.setAttribute('aria-label', (st.favOnly ? 'Mostrar todos los productos' : 'Ver solo mis guardados') + ' (' + nf + ')'); }
      var rv = $('cl-range-val'); if (rv) rv.textContent = st.max == null ? 'Sin límite' : 'Hasta: ' + money(st.max);
      var grid = $('cl-grid'), empty = $('cl-empty'), more = $('cl-more');
      if (!list.length) {
        grid.innerHTML = ''; more.hidden = true; empty.hidden = false; stick();
        empty.innerHTML = EMPTY_ART + '<h2>No encontramos ' + esc(cfg.noun.many) + ' con esos filtros</h2><p>Prueba quitando o ajustando alguno de los filtros:</p><div class="cl-chips">' + chipHtml + (st.favOnly ? '<button type="button" class="cl-chip" data-chip="fav" aria-label="Dejar de ver solo guardados">Solo guardados</button>' : '') + '</div><button type="button" class="cl-btn-green" data-clear>' + esc(cfg.noun.all) + ' ' + svg(IC.arrow, 18, 2.6) + '</button>';
        return;
      }
      empty.hidden = true;
      grid.innerHTML = list.slice(0, st.shown).map(card).join('');
      more.hidden = list.length <= st.shown;
      if (!more.hidden) more.firstElementChild.textContent = 'Mostrar más (' + (list.length - st.shown) + ' restantes)';
      stick();
    }

    /* ── Selección y dock ── */
    function toast(msg) {
      var t = $('cl-toast'); if (!t) return;
      t.textContent = msg; t.classList.add('is-on');
      clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
    }
    function pick(id) {
      id = String(id);
      var i = st.picked.indexOf(id);
      if (i >= 0) st.picked.splice(i, 1);
      else { if (st.picked.length >= 3) { toast('Máximo 3 productos. Quita uno para agregar otro.'); return; } st.picked.push(id); ga('click_seleccionar_comparar', { page_section: cfg.section, value: st.picked.length }); }
      dock(); render();
    }
    function dock() {
      var el = $('cl-dock'), n = st.picked.length; if (!el) return;
      var sn = $('cl-step-n'); if (sn) { sn.textContent = n + '/3'; sn.classList.toggle('is-on', n > 0); }
      el.classList.toggle('is-on', n > 0);
      document.body.classList.toggle('has-dock', n > 0);
      if (!n) { el.classList.remove('is-open'); return; }
      var slots = st.picked.map(function (id) {
        var p = byId[id];
        return '<div class="cl-dock-item"><img src="' + esc(cfg.img(p)) + '" alt="" referrerpolicy="no-referrer"><span>' + esc(short(p)) + '</span><button type="button" data-unpick="' + esc(id) + '" aria-label="Quitar ' + esc(short(p)) + ' de la comparación">×</button></div>';
      }).join('');
      if (n < 2) slots += '<div class="cl-dock-empty">Elige otro producto para comparar</div>';
      el.querySelector('.cl-dock-items').innerHTML = slots;
      el.querySelector('.cl-dock-lead b').textContent = n === 1 ? '1 producto elegido' : 'Comparando ' + n + ' productos';
      el.querySelector('.cl-dock-lead span').textContent = n === 1 ? 'Elige al menos otro' : n === 3 ? 'Máximo alcanzado' : 'Puedes agregar uno más';
      el.querySelector('.cl-dock-go').disabled = n < 2;
    }
    function short(p) {
      var s = cfg.name(p); if (s.length <= 40) return s;
      s = s.slice(0, 40); var i = s.lastIndexOf(' '); return (i > 18 ? s.slice(0, i) : s) + '…';
    }

    /* ── Comparativa completa ── */
    function compare() {
      var ps = st.picked.map(function (id) { return byId[id]; }).filter(Boolean);
      if (ps.length < 2) return;
      var rows = [{ id: 'precio', label: 'Precio en Mercado Libre', icon: 'tag', get: function (p) { var v = price(p); return typeof v === 'number' ? money(v) : null; }, score: function (p) { var v = price(p); return typeof v === 'number' ? -v : null; }, why: 'menor precio', pick: 'Buscas el precio más bajo' }].concat(cfg.compare.rows);
      var wins = ps.map(function () { return []; });
      var body = rows.map(function (r) {
        var vals = ps.map(r.get), sc = r.score ? ps.map(r.score) : ps.map(function () { return null; });
        if (vals.every(function (v) { return v == null || v === ''; })) return '';
        var known = sc.filter(function (x) { return x != null; }), best = null;
        if (known.length >= 2 && Math.max.apply(null, known) > Math.min.apply(null, known)) best = Math.max.apply(null, known);
        var cells = vals.map(function (v, i) {
          if (v == null || v === '') return '<td class="cl-nd">Sin dato</td>';
          var win = best != null && sc[i] === best;
          if (win) wins[i].push(r);
          return '<td>' + (win ? '<span class="cl-best">' + esc(v) + '</span>' : esc(v)) + '</td>';
        }).join('');
        return '<tr><td><span class="cl-row-lbl">' + svg(IC[r.icon] || IC.tag, 18) + esc(r.label) + '</span></td>' + cells + '</tr>';
      }).join('');
      var head = ps.map(function (p) { return '<th><div class="cl-th"><img src="' + esc(cfg.img(p)) + '" alt="' + esc(cfg.name(p)) + '" referrerpolicy="no-referrer"><b>' + esc(cfg.name(p)) + '</b>' + buy(p, price(p)) + '</div></th>'; }).join('');

      // Veredicto: solo hay ganador si un producto gana en más criterios que los demás (y al menos en 2)
      var counts = wins.map(function (w) { return w.length; }), top = Math.max.apply(null, counts);
      var leaders = counts.filter(function (c) { return c === top; }).length, W = top >= 2 && leaders === 1 ? counts.indexOf(top) : -1;
      var list = function (w) { return w.map(function (r) { return r.why; }).join(', ').replace(/, ([^,]*)$/, ' y $1'); };
      var resumen = '', ticks = function (a) { return '<ul class="cl-ticks">' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; };
      if (W >= 0) {
        resumen = '<p>El <b>' + esc(short(ps[W])) + '</b> destaca por ' + esc(list(wins[W])) + '.</p>';
        ps.forEach(function (p, i) { if (i !== W && wins[i].length) resumen += '<p>El <b>' + esc(short(p)) + '</b> es mejor en ' + esc(list(wins[i])) + '.</p>'; });
      } else if (top > 0) {
        resumen = '<p>No hay un ganador claro: cada uno sobresale en algo distinto.</p>';
        ps.forEach(function (p, i) { if (wins[i].length) resumen += '<p>El <b>' + esc(short(p)) + '</b> destaca por ' + esc(list(wins[i])) + '.</p>'; });
      } else resumen = '<p>Con los datos disponibles no hay diferencias que permitan declarar un ganador. Revisa las características en la tabla.</p>';
      var nRows = (body.match(/<tr>/g) || []).length;
      var veredicto = W >= 0
        ? '<div class="cl-winner">Ganador en general:<b>' + esc(short(ps[W])) + '</b></div><h4>Destaca por:</h4>' + ticks(wins[W].map(function (r) { return r.why.charAt(0).toUpperCase() + r.why.slice(1) + '.'; }))
        : '<div class="cl-winner">Sin ganador en general<b>Depende de lo que priorices</b></div>';
      ps.forEach(function (p, i) {
        if (i === W || !wins[i].length) return;
        veredicto += '<div class="cl-note"><h4>Elige el ' + esc(short(p)) + ' si:</h4>' + ticks(wins[i].map(function (r) { return r.pick + '.'; })) + '</div>';
      });
      if (W >= 0) veredicto += '<div class="cl-note"><h4>Elige el ' + esc(short(ps[W])) + ' si:</h4>' + ticks(wins[W].map(function (r) { return r.pick + '.'; })) + '</div>';

      var logo = '<img src="/logopng.png" alt="">';
      $('cl-cmp-view').innerHTML = '<div class="cl-cmp-back"><button type="button" data-cmp-close>' + svg(IC.back, 20, 2.6) + ' Volver al listado</button><span></span>' + logo + '<b>comparalo<i>.mx</i></b></div>'
        + '<div class="cl-cmp-hero"><div class="cl-cmp-hero-in"><div><p class="cl-cmp-crumb">Inicio › ' + esc(cfg.title) + ' › Comparativa</p><h2>Comparativa de ' + esc(cfg.title) + '</h2><p class="vs">' + ps.map(function (p) { return esc(short(p)); }).join(' <b>vs</b> ') + '</p></div>'
        + '<div class="cl-cmp-art">' + ps.map(function (p) { return '<img src="' + esc(cfg.img(p)) + '" alt="" referrerpolicy="no-referrer">'; }).join('<em>VS</em>') + '</div></div></div>'
        + '<div class="cl-cmp-body">'
        + '<div class="cl-panel"><h3>Resumen de la comparación</h3><div class="cl-note"><h4>' + logo + '¿Cuál conviene más?</h4>' + resumen + '</div>'
        + ticks(['Comparamos ' + nRows + ' características', 'Precios de Mercado Libre México', 'Datos tomados de la ficha de cada producto', 'Conclusión basada solo en los datos disponibles']) + '</div>'
        + '<div class="cl-cmp-mid"><div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Característica</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<p class="cl-cmp-foot">Los precios pueden cambiar; confirma el precio final y la disponibilidad en Mercado Libre. Si compras desde estos enlaces podemos recibir una comisión, sin costo adicional para ti. La comisión no influye en el veredicto.</p></div>'
        + '<div class="cl-panel cl-verdict"><h3>' + logo + 'Veredicto de Compáralo</h3>' + veredicto + '</div>'
        + '</div>';
      $('cl-cmp-view').classList.add('is-on');
      $('cl-cmp-view').scrollTop = 0;
      document.body.style.overflow = 'hidden';
      if (location.hash !== '#comparativa') { try { history.pushState({ clCmp: 1 }, '', '#comparativa'); } catch (e) {} }
      ga('click_comparar_categoria', { page_section: cfg.section, value: ps.length });
    }
    function closeCompare(fromPop) {
      var v = $('cl-cmp-view'); if (!v || !v.classList.contains('is-on')) return;
      v.classList.remove('is-on'); document.body.style.overflow = '';
      if (!fromPop && location.hash === '#comparativa') { try { history.back(); } catch (e) {} }
    }

    /* ── Barra fija (pasos + controles): se compacta al pegarse y avisa su alto a los filtros ── */
    function stick() {
      var s = $('cl-sticky'), z = $('cl-sentinel'); if (!s || !z) return;
      var hd = $('cmx-hd') ? $('cmx-hd').offsetHeight : 0;
      s.classList.toggle('is-stuck', z.getBoundingClientRect().top <= hd + 36);
      document.body.style.setProperty('--cl-stick', s.offsetHeight + 'px');
    }

    /* ── Eventos ── */
    document.addEventListener('click', function (e) {
      var t = e.target, el;
      if ((el = t.closest('.cl-btn-ml[data-n]'))) { ga('affiliate_click_ml', { platform: 'mercado_libre', product_name: el.getAttribute('data-n'), price: parseFloat(el.getAttribute('data-v')) || 0, page_section: cfg.section }); return; }
      if ((el = t.closest('[data-chip]'))) { removeChip(el.getAttribute('data-chip')); return; }
      if ((el = t.closest('[data-unpick]'))) { pick(el.getAttribute('data-unpick')); return; }
      if (t.closest('[data-cmp-close]')) { closeCompare(); return; }
      if (t.closest('#cl-empty [data-clear]')) { clearAll(true); return; }
      if (t.closest('[data-clear-chips]')) { clearAll(); return; }
      if ((el = t.closest('[data-fav]'))) {
        var id = String(el.closest('.cl-card').getAttribute('data-id'));
        if (favs.has(id)) favs.delete(id); else favs.add(id);
        try { localStorage.setItem(favKey, JSON.stringify(Array.from(favs))); } catch (err) {}
        ga(favs.has(id) ? 'favorito_guardar' : 'favorito_quitar', { product_name: byId[id] ? cfg.name(byId[id]) : '', value: favs.size, page_section: cfg.section });
        render();
        return;
      }
      if ((el = t.closest('.cl-card')) && !t.closest('a')) pick(el.getAttribute('data-id'));
    });
    var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    on('cl-sort', 'change', function (e) { st.sort = e.target.value; ga('ordenar_listado', { criterio: st.sort, page_section: cfg.section }); st.shown = PAGE; render(); });
    on('cl-search-form', 'submit', function (e) { e.preventDefault(); var g = $('cl-layout'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    on('cl-search-in', 'input', function (e) { st.q = e.target.value.trim().toLowerCase(); st.shown = PAGE; render(); });
    on('cl-search-in', 'change', function (e) { var q = e.target.value.trim(); if (q) ga('buscar_listado', { search_term: q, page_section: cfg.section }); });
    on('cl-open', 'click', function () {
      if (window.matchMedia('(max-width: 900px)').matches) { drawer(true); return; }
      var off = document.body.classList.toggle('cl-nofilters');
      $('cl-open').setAttribute('aria-expanded', String(!off)); stick();
    });
    on('cl-saved', 'click', function () { st.favOnly = !st.favOnly; if (st.favOnly) ga('filtro_guardados', { origen: 'boton', value: favs.size, page_section: cfg.section }); st.shown = PAGE; syncFilters(); render(); });
    window.addEventListener('scroll', stick, { passive: true });
    window.addEventListener('resize', stick);
    on('cl-backdrop', 'click', function () { drawer(false); });
    on('cl-more-btn', 'click', function () { st.shown += PAGE; render(); });
    on('cl-dock-go', 'click', compare);
    on('cl-dock-clear', 'click', function () { st.picked = []; dock(); render(); });
    on('cl-dock-toggle', 'click', function () { $('cl-dock').classList.toggle('is-open'); });
    window.addEventListener('popstate', function () { if (location.hash !== '#comparativa') closeCompare(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeCompare(); drawer(false); } });
    document.addEventListener('cmx:drops', render);

    buildFilters(); render(); dock();
  }

  window.CmxList = { init: init };
})();
