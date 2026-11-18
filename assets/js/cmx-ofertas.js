/* comparalo.mx — página /ofertas/ (nov-2026).
   Las tarjetas y el texto los escribe scripts/generar-ofertas.js en el HTML (para buscadores y
   para quien no ejecuta JS). Este archivo solo agrega lo que necesita interacción:
     · selección de 2 a 3 productos DE LA MISMA categoría y comparativa completa,
     · favoritos compartidos con la página de cada categoría,
     · histórico de precio de 30 días (assets/data/historico/ofertas.json, vía cmx-historico.js),
     · flechas de cada fila e índice de categorías que marca dónde vas.
   Reglas de la casa: solo Mercado Libre y nada inventado. La comparativa no declara un "ganador":
   señala lo que se puede medir (precio, bajada, mínimo de 30 días) y deja el resto en la tabla. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('es-MX') + ' MXN'; };
  var corto = function (n) { return '$' + Math.round(n).toLocaleString('es-MX'); };
  var ga = function (name, params) {
    if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} }
  };
  var svg = function (d, n, sw) {
    return '<svg width="' + (n || 16) + '" height="' + (n || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'
      + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  var IC = {
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>',
    down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/>',
    chart: '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="12" width="3.5" height="7"/><rect x="10.2" y="7" width="3.5" height="12"/><rect x="15.4" y="14" width="3.5" height="5"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>'
  };
  var ML_IC = '<img class="cl-ml-ic" src="/logomercado-ic.png" alt="">';

  /* ── Datos que dejó el generador ── */
  var DATA = (function () {
    var el = $('of-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  })();
  if (!DATA || !DATA.categorias) return;

  var CAT = {}, ITEM = {};
  DATA.categorias.forEach(function (c) {
    CAT[c.c] = c;
    (c.items || []).forEach(function (it) { ITEM[c.c + ':' + it.i] = it; });
  });
  var clave = function (cat, id) { return cat + ':' + id; };
  var de = function (cat, id) { return ITEM[clave(cat, id)] || null; };

  if (window.cmxHist) window.cmxHist.init(['ofertas']);

  /* ── Favoritos: misma llave que la página de la categoría (comparalo:fav:<categoria>) ── */
  function favSet(cat) {
    try { return new Set(JSON.parse(localStorage.getItem('comparalo:fav:' + cat) || '[]')); }
    catch (e) { return new Set(); }
  }
  function favGuardar(cat, set) {
    try { localStorage.setItem('comparalo:fav:' + cat, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  /* El panel global de guardados (cmx-saved.js) lee 'comparalo:favmeta'. Aquí se agrega o se quita
     SOLO el producto que se tocó: lo demás lo mantiene la página de la categoría. */
  function favMeta(cat, id, on) {
    var c = CAT[cat], it = de(cat, id);
    if (!c || !it) return;
    try {
      var all = JSON.parse(localStorage.getItem('comparalo:favmeta') || '{}') || {};
      var entry = all[cat] || { t: c.t, u: c.u, s: cat, items: {} };
      entry.t = c.t; entry.u = c.u; entry.s = cat; entry.items = entry.items || {};
      if (on) entry.items[String(id)] = { n: it.n, i: it.g, p: typeof it.p === 'number' ? it.p : null, l: it.l || '' };
      else delete entry.items[String(id)];
      if (Object.keys(entry.items).length) all[cat] = entry; else delete all[cat];
      localStorage.setItem('comparalo:favmeta', JSON.stringify(all));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('cmx:favs', { detail: { src: 'ofertas' } }));
  }
  function pintarFavs() {
    var cache = {};
    [].forEach.call(document.querySelectorAll('.cl-card[data-cat]'), function (art) {
      var cat = art.getAttribute('data-cat'), id = art.getAttribute('data-id');
      var set = cache[cat] || (cache[cat] = favSet(cat));
      var b = art.querySelector('[data-fav]');
      if (b) b.setAttribute('aria-pressed', set.has(String(id)) ? 'true' : 'false');
    });
  }

  /* ── Selección (siempre dentro de una sola categoría) ── */
  var sel = { cat: null, ids: [] };

  function toast(msg) {
    var t = $('cl-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  function pick(cat, id) {
    id = String(id);
    if (sel.cat && sel.cat !== cat) {
      sel.cat = cat; sel.ids = [id];
      toast('Se comparan productos de la misma categoría: empezamos de nuevo con ' + (CAT[cat] ? CAT[cat].t : cat) + '.');
    } else {
      sel.cat = cat;
      var i = sel.ids.indexOf(id);
      if (i >= 0) sel.ids.splice(i, 1);
      else if (sel.ids.length >= 3) { toast('Máximo 3 productos. Quita uno para agregar otro.'); return; }
      else {
        sel.ids.push(id);
        ga('click_seleccionar_comparar', { page_section: 'ofertas', categoria: cat, value: sel.ids.length });
      }
      if (!sel.ids.length) sel.cat = null;
    }
    pintarSel();
  }

  function pintarSel() {
    [].forEach.call(document.querySelectorAll('.cl-card[data-cat]'), function (art) {
      var on = art.getAttribute('data-cat') === sel.cat && sel.ids.indexOf(String(art.getAttribute('data-id'))) >= 0;
      art.classList.toggle('is-sel', on);
      var b = art.querySelector('[data-pick]');
      if (b) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.innerHTML = '<i></i>' + (on ? 'Comparando' : 'Comparar');
      }
    });
    [].forEach.call(document.querySelectorAll('[data-cmp]'), function (b) {
      var mio = b.getAttribute('data-cmp') === sel.cat, n = mio ? sel.ids.length : 0;
      b.disabled = n < 2;
      b.classList.toggle('is-on', n >= 2);
      var c = CAT[b.getAttribute('data-cmp')];
      b.innerHTML = (n >= 2 ? 'Comparar los ' + n + ' elegidos' : 'Comparar ' + (c ? c.muchos : 'productos') + ' elegidos')
        + ' ' + svg(IC.arrow, 16, 2.6);
    });
    dock();
  }

  function dock() {
    var el = $('cl-dock'), n = sel.ids.length;
    if (!el) return;
    el.classList.toggle('is-on', n > 0);
    document.body.classList.toggle('has-dock', n > 0);
    if (!n) { el.classList.remove('is-open'); return; }
    var c = CAT[sel.cat];
    var slots = sel.ids.map(function (id) {
      var it = de(sel.cat, id);
      if (!it) return '';
      return '<div class="cl-dock-item"><img src="' + esc(it.g) + '" alt="" referrerpolicy="no-referrer"><span>' + esc(nombreCorto(it.n))
        + '</span><button type="button" data-unpick="' + esc(id) + '" aria-label="Quitar ' + esc(nombreCorto(it.n)) + ' de la comparación">×</button></div>';
    }).join('');
    if (n < 2) slots += '<div class="cl-dock-empty">Elige otro producto de ' + esc(c ? c.t : '') + '</div>';
    el.querySelector('.cl-dock-items').innerHTML = slots;
    el.querySelector('.cl-dock-lead b').textContent = n === 1 ? '1 producto elegido' : 'Comparando ' + n + ' productos';
    el.querySelector('.cl-dock-lead span').textContent = (c ? c.t + ' · ' : '')
      + (n === 1 ? 'Elige al menos otro' : n >= 3 ? 'Máximo alcanzado' : 'Puedes agregar uno más');
    el.querySelector('.cl-dock-go').disabled = n < 2;
  }

  function nombreCorto(s) {
    s = String(s || '');
    if (s.length <= 40) return s;
    s = s.slice(0, 40);
    var i = s.lastIndexOf(' ');
    return (i > 18 ? s.slice(0, i) : s) + '…';
  }

  /* ── Comparativa ── */
  function filas(items) {
    var base = [
      { label: 'Precio en Mercado Libre', icon: 'tag', get: function (it) { return money(it.p); }, score: function (it) { return -it.p; } },
      { label: 'Bajada de precio', icon: 'down', get: function (it) { return '−' + it.d + ' % · ' + money(it.s) + ' menos'; }, score: function (it) { return it.d; } },
      { label: 'Precio anterior', icon: 'tag', get: function (it) { return money(it.a) + (it.o === 'max30' ? ' (máximo de 30 días)' : ''); } },
      { label: 'Mínimo de 30 días', icon: 'chart', get: function (it) { return it.m == null ? null : money(it.m) + (it.m === it.p ? ' · es el precio de hoy' : ''); } },
      { label: 'Máximo de 30 días', icon: 'chart', get: function (it) { return it.x == null ? null : money(it.x); } },
      { label: 'Variación de 30 días', icon: 'chart', get: function (it) { return it.v == null ? null : (it.v > 0 ? '+' : '') + it.v.toFixed(1) + ' %'; } },
      { label: 'Marca', icon: 'tag', get: function (it) { return it.b ? String(it.b).charAt(0).toUpperCase() + String(it.b).slice(1) : null; } }
    ];
    // Características: la unión de las etiquetas que traen los elegidos, en el orden en que aparecen.
    var vistas = {}, orden = [];
    items.forEach(function (it) {
      (it.e || []).forEach(function (par) {
        if (!vistas[par[0]]) { vistas[par[0]] = 1; orden.push(par[0]); }
      });
    });
    orden.forEach(function (lbl) {
      base.push({ label: lbl, icon: 'tag', get: function (it) {
        var hit = (it.e || []).filter(function (p) { return p[0] === lbl; })[0];
        return hit ? hit[1] : null;
      } });
    });
    return base;
  }

  function comparar() {
    if (sel.ids.length < 2) return;
    var cat = sel.cat, c = CAT[cat] || { t: cat, muchos: 'productos', u: '/' };
    var items = sel.ids.map(function (id) { return de(cat, id); }).filter(Boolean);
    if (items.length < 2) return;

    var rows = filas(items);
    var body = rows.map(function (r) {
      var vals = items.map(r.get);
      if (vals.every(function (v) { return v == null || v === ''; })) return '';
      var sc = r.score ? items.map(r.score) : items.map(function () { return null; });
      var conocidos = sc.filter(function (x) { return x != null; }), best = null;
      if (conocidos.length >= 2 && Math.max.apply(null, conocidos) > Math.min.apply(null, conocidos)) best = Math.max.apply(null, conocidos);
      var celdas = vals.map(function (v, i) {
        if (v == null || v === '') return '<td class="cl-nd">Sin dato<small>Verifícalo en la publicación de Mercado Libre</small></td>';
        return '<td>' + (best != null && sc[i] === best ? '<span class="cl-best">' + esc(v) + '</span>' : esc(v)) + '</td>';
      }).join('');
      return '<tr><td><span class="cl-row-lbl">' + svg(IC[r.icon] || IC.tag, 18) + esc(r.label) + '</span></td>' + celdas + '</tr>';
    }).join('');

    var head = items.map(function (it) {
      return '<th><div class="cl-th"><img src="' + esc(it.g) + '" alt="' + esc(it.n) + '" referrerpolicy="no-referrer"><b>' + esc(it.n) + '</b>'
        + btnML(it) + '</div></th>';
    }).join('');

    // Observaciones: solo lo que se puede medir. Nada de "ganador en general".
    var barato = items.slice().sort(function (a, b) { return a.p - b.p; })[0];
    var bajo = items.slice().sort(function (a, b) { return b.d - a.d; })[0];
    var enMinimo = items.filter(function (it) { return it.m != null && it.p <= it.m; });
    var obs = '<p>El <b>' + esc(nombreCorto(barato.n)) + '</b> es el más barato de los elegidos (' + money(barato.p) + ').</p>';
    if (bajo !== barato) obs += '<p>El que más bajó es el <b>' + esc(nombreCorto(bajo.n)) + '</b>: −' + bajo.d + ' % (' + money(bajo.s) + ' menos).</p>';
    else obs += '<p>Además es el que más bajó: −' + bajo.d + ' % (' + money(bajo.s) + ' menos).</p>';
    if (enMinimo.length) {
      obs += '<p>' + (enMinimo.length === 1
        ? 'El <b>' + esc(nombreCorto(enMinimo[0].n)) + '</b> está en su precio más bajo de los últimos 30 días.'
        : enMinimo.length + ' de los elegidos están en su precio más bajo de los últimos 30 días.') + '</p>';
    }
    obs += '<p>Una bajada mayor no significa mejor compra: compara también las características de la tabla y el precio final en la publicación.</p>';

    var ticks = function (a) {
      return '<ul class="cl-ticks">' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    };
    var nRows = (body.match(/<tr>/g) || []).length;
    var logo = '<img src="/logopng.png" alt="">';

    $('cl-cmp-view').innerHTML = '<div class="cl-cmp-back"><button type="button" data-cmp-close>' + svg(IC.back, 20, 2.6)
      + ' Volver a las ofertas</button><span></span>' + logo + '<b>comparalo<i>.mx</i></b></div>'
      + '<div class="cl-cmp-hero"><div class="cl-cmp-hero-in"><div><p class="cl-cmp-crumb">Inicio › Ofertas › ' + esc(c.t) + '</p>'
      + '<h2>Comparativa de ' + esc(c.t) + ' en oferta</h2><p class="vs">'
      + items.map(function (it) { return esc(nombreCorto(it.n)); }).join(' <b>vs</b> ') + '</p></div>'
      + '<div class="cl-cmp-art">' + items.map(function (it) { return '<img src="' + esc(it.g) + '" alt="" referrerpolicy="no-referrer">'; }).join('<em>VS</em>')
      + '</div></div></div>'
      + '<div class="cl-cmp-body">'
      + '<div class="cl-panel"><h3>Resumen de la comparación</h3><div class="cl-note"><h4>' + logo + '¿Qué dicen los datos?</h4>' + obs + '</div>'
      + ticks(['Comparamos ' + nRows + ' datos de cada producto', 'Precios de catálogo de Mercado Libre México',
        'Bajadas medidas contra los últimos 30 días', 'Las características salen de la ficha de cada producto']) + '</div>'
      + '<div class="cl-cmp-mid"><div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Dato</th>' + head + '</tr></thead><tbody>'
      + body + '</tbody></table></div><div id="of-cmp-hist"></div>'
      + '<p class="cl-cmp-foot">Los precios pueden cambiar; confirma el precio final y la disponibilidad en Mercado Libre. '
      + 'Donde dice «Sin dato», abre la publicación y revisa la ficha técnica: ahí suele aparecer. '
      + 'Si compras desde estos enlaces podemos recibir una comisión, sin costo adicional para ti.</p></div>'
      + '<div class="cl-panel cl-verdict"><h3>' + logo + 'Siguiente paso</h3>'
      + '<div class="cl-winner">Más barato de los elegidos:<b>' + esc(nombreCorto(barato.n)) + '</b></div>'
      + '<div class="cl-note"><h4>Antes de comprar:</h4>' + ticks([
        'Abre el histórico de 30 días y mira si el precio de hoy está cerca del mínimo.',
        'Revisa en la tabla las características que de verdad te importan.',
        'Confirma el precio final y el envío en la publicación de Mercado Libre.'])
      + '</div><a class="of-cmp-cat" href="' + esc(c.u) + '">Ver todos los ' + esc(c.muchos) + ' ' + svg(IC.arrow, 16, 2.6) + '</a></div>'
      + '</div>';

    var view = $('cl-cmp-view');
    view.classList.add('is-on');
    view.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    if (location.hash !== '#comparativa') { try { history.pushState({ ofCmp: 1 }, '', '#comparativa'); } catch (e) {} }
    ga('click_comparar_categoria', { page_section: 'ofertas', categoria: cat, value: items.length });

    if (window.cmxHist) {
      var cont = $('of-cmp-hist');
      var lista = items.filter(function (it) { return it.h; }).map(function (it) {
        return { id: clave(cat, it.i), nombre: nombreCorto(it.n) };
      });
      if (lista.length) {
        window.cmxHist.cargar().then(function () {
          if (!cont || !cont.parentNode) return;
          cont.innerHTML = window.cmxHist.comparativa(lista);
          if (!cont.firstChild) return;
          ga('historico_comparativa_view', { productos: lista.length, page_section: 'ofertas', categoria: cat, origen: 'comparativa' });
        });
      }
    }
  }

  function btnML(it) {
    return '<a class="cl-btn-ml" href="' + esc(it.l) + '" target="_blank" rel="sponsored nofollow noopener" data-n="' + esc(it.n)
      + '" data-v="' + (it.p || 0) + '">' + ML_IC + '<span class="lg">Ver en Mercado Libre</span><span class="sm">Ver en ML</span> <span aria-hidden="true">&#8599;</span></a>';
  }

  function cerrarCmp(desdePop) {
    var v = $('cl-cmp-view');
    if (!v || !v.classList.contains('is-on')) return;
    v.classList.remove('is-on');
    document.body.style.overflow = '';
    if (!desdePop && location.hash === '#comparativa') { try { history.back(); } catch (e) {} }
  }

  /* ── Histórico desde la tarjeta ── */
  function abrirHist(btn) {
    if (!window.cmxHist) return;
    var art = btn.closest('.cl-card'), cat = art.getAttribute('data-cat'), id = art.getAttribute('data-id');
    var it = de(cat, id);
    window.cmxHist.abrir(btn.getAttribute('data-hist'), {
      nombre: it ? it.n : '', img: it ? it.g : '', precio: it ? it.p : null,
      section: 'ofertas', origen: 'ofertas',
    });
  }

  /* ── Eventos ── */
  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('.cl-btn-ml[data-n]'))) {
      ga('affiliate_click_ml', {
        platform: 'mercado_libre', product_name: el.getAttribute('data-n'),
        price: parseFloat(el.getAttribute('data-v')) || 0, page_section: 'ofertas',
      });
      return;
    }
    if ((el = t.closest('[data-hist]'))) { abrirHist(el); return; }
    if ((el = t.closest('[data-unpick]'))) { pick(sel.cat, el.getAttribute('data-unpick')); return; }
    if ((el = t.closest('[data-cmp]'))) { comparar(); return; }
    if (t.closest('[data-cmp-close]')) { cerrarCmp(); return; }
    if ((el = t.closest('[data-nav]'))) {
      var row = el.parentNode.querySelector('.of-row');
      if (row) row.scrollBy({ left: +el.getAttribute('data-nav') * Math.max(260, row.clientWidth * 0.8), behavior: 'smooth' });
      return;
    }
    if ((el = t.closest('[data-fav]'))) {
      var art = el.closest('.cl-card'), cat = art.getAttribute('data-cat'), id = String(art.getAttribute('data-id'));
      var set = favSet(cat), on = !set.has(id);
      if (on) set.add(id); else set.delete(id);
      favGuardar(cat, set);
      favMeta(cat, id, on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      var it = de(cat, id);
      ga(on ? 'favorito_guardar' : 'favorito_quitar', { product_name: it ? it.n : '', page_section: 'ofertas', categoria: cat });
      return;
    }
    if ((el = t.closest('[data-ix]'))) { ga('ofertas_indice', { categoria: el.getAttribute('data-ix').replace(/^of-/, '') }); return; }
    if ((el = t.closest('.cl-card[data-cat]')) && !t.closest('a')) {
      pick(el.getAttribute('data-cat'), el.getAttribute('data-id'));
    }
  });

  var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
  on('cl-dock-go', 'click', comparar);
  on('cl-dock-clear', 'click', function () { sel = { cat: null, ids: [] }; pintarSel(); });
  on('cl-dock-toggle', 'click', function () { $('cl-dock').classList.toggle('is-open'); });
  window.addEventListener('popstate', function () { if (location.hash !== '#comparativa') cerrarCmp(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarCmp(); });
  window.addEventListener('cmx:favs', function (e) { if (e.detail && e.detail.src !== 'ofertas') pintarFavs(); });

  /* ── Índice: marca la categoría que se está viendo y actualiza las flechas de cada fila ── */
  function flechas() {
    [].forEach.call(document.querySelectorAll('.of-row-wrap'), function (w) {
      var row = w.querySelector('.of-row');
      if (!row) return;
      var max = row.scrollWidth - row.clientWidth - 4;
      var prev = w.querySelector('.of-prev'), next = w.querySelector('.of-next');
      if (prev) prev.hidden = max <= 0 || row.scrollLeft <= 4;
      if (next) next.hidden = max <= 0 || row.scrollLeft >= max;
    });
  }
  (function () {
    var secs = [].slice.call(document.querySelectorAll('.of-sec'));
    var links = {};
    [].forEach.call(document.querySelectorAll('[data-ix]'), function (a) { links[a.getAttribute('data-ix')] = a; });
    if (!secs.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          var a = links[en.target.id];
          if (a) a.classList.toggle('is-on', en.isIntersecting);
        });
      }, { rootMargin: '-96px 0px -70% 0px' });
      secs.forEach(function (s) { io.observe(s); });
    }
    [].forEach.call(document.querySelectorAll('.of-row'), function (r) { r.addEventListener('scroll', flechas, { passive: true }); });
    window.addEventListener('resize', flechas);
    // Las fotos de las tarjetas cambian el alto, no el ancho, pero el primer cálculo puede
    // caer antes de que el navegador termine el acomodo: se repite al terminar de cargar.
    window.addEventListener('load', flechas);
  })();

  pintarFavs();
  pintarSel();
  flechas();
  if (!window.__cmxSavedLoaded) {
    window.__cmxSavedLoaded = 1;
    var sv = document.createElement('script');
    sv.src = '/assets/js/cmx-saved.js';
    sv.defer = true;
    document.head.appendChild(sv);
  }
})();
