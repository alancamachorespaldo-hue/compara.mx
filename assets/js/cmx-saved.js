/* comparalo.mx — "Guardados" global (botón del encabezado + panel).
   Lee 'comparalo:favmeta' (lo escribe /assets/js/cmx-list.js en cada categoría con la plantilla de listado) y muestra,
   por fila de categoría, todo lo que el usuario guardó en este dispositivo. Se puede comparar de 2 a 3 productos,
   pero solo dentro de la misma categoría: el botón Comparar lleva a esa categoría con la comparativa abierta. */
(function () {
  'use strict';
  if (window.__cmxSaved) return; window.__cmxSaved = 1;
  var META = 'comparalo:favmeta';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('es-MX') + ' MXN'; };
  var ga = function (n, p) { if (typeof window.gtag === 'function') { try { window.gtag('event', n, p || {}); } catch (e) {} } };
  var HEART = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  var sel = {}; /* categoría -> ids elegidos para comparar */
  var btn, panel, bd, lastFocus;

  function read() { try { return JSON.parse(localStorage.getItem(META) || '{}') || {}; } catch (e) { return {}; } }
  function cats() {
    var m = read(), here = location.pathname;
    var a = Object.keys(m).map(function (k) {
      var c = m[k] || {}, its = c.items || {};
      return { k: k, t: c.t || k, u: c.u || '/', s: c.s || k, items: Object.keys(its).map(function (id) { var o = its[id]; o.id = id; return o; }) };
    }).filter(function (c) { return c.items.length; });
    a.sort(function (x, y) { return (y.u === here) - (x.u === here); });
    return a;
  }
  var total = function () { return cats().reduce(function (n, c) { return n + c.items.length; }, 0); };

  function count() {
    var n = total(), e = document.getElementById('cmx-sv-n');
    if (e) e.textContent = n;
    if (btn) { btn.classList.toggle('has-favs', n > 0); btn.setAttribute('aria-label', 'Mis guardados (' + n + ')'); }
  }

  function body() {
    var cs = cats(), el = panel.querySelector('.cmx-sv-body');
    if (!cs.length) {
      el.innerHTML = '<div class="cmx-sv-empty">' + HEART + '<h3>Aún no guardas productos</h3><p>Toca el corazón de cualquier producto y aparecerá aquí, en este dispositivo, para que lo encuentres cuando vuelvas.</p></div>';
      return;
    }
    el.innerHTML = cs.map(function (c) {
      var ch = (sel[c.k] || []).filter(function (id) { return c.items.some(function (i) { return i.id === id; }); });
      sel[c.k] = ch;
      var cards = c.items.map(function (i) {
        var on = ch.indexOf(i.id) >= 0;
        return '<article class="cmx-sv-item' + (on ? ' is-on' : '') + '" data-id="' + esc(i.id) + '">'
          + '<button type="button" class="cmx-sv-x" data-rm aria-label="Quitar de guardados: ' + esc(i.n) + '">&times;</button>'
          + '<img src="' + esc(i.i) + '" alt="" referrerpolicy="no-referrer" loading="lazy">'
          + '<b>' + esc(i.n) + '</b>'
          + '<span class="cmx-sv-pr">' + (typeof i.p === 'number' ? money(i.p) : 'Consulta el precio') + '</span>'
          + '<label class="cmx-sv-pick"><input type="checkbox" data-pick' + (on ? ' checked' : '') + '><span>Comparar</span></label>'
          + (i.l ? '<a class="cmx-sv-ml" href="' + esc(i.l) + '" target="_blank" rel="sponsored nofollow noopener">Ver en Mercado Libre &#8599;</a>' : '')
          + '</article>';
      }).join('');
      var n = ch.length;
      return '<section class="cmx-sv-cat" data-k="' + esc(c.k) + '"><div class="cmx-sv-cathd"><h3>' + esc(c.t) + ' <em>(' + c.items.length + ')</em></h3><a href="' + esc(c.u) + '">Ver categoría &rarr;</a></div>'
        + '<div class="cmx-sv-row">' + cards + '</div>'
        + '<div class="cmx-sv-bar"><span>' + (c.items.length < 2 ? 'Guarda otro de esta categoría para poder comparar.' : n < 2 ? 'Elige 2 o 3 de ' + esc(c.t) + ' para compararlos.' : n + ' elegidos de ' + esc(c.t) + '.') + '</span>'
        + '<button type="button" class="cmx-sv-go" data-go' + (n < 2 ? ' disabled' : '') + '>Comparar' + (n ? ' (' + n + ')' : '') + '</button></div></section>';
    }).join('');
  }

  function open() {
    lastFocus = document.activeElement; body();
    bd.classList.add('is-on'); panel.classList.add('is-on'); document.body.style.overflow = 'hidden';
    var x = panel.querySelector('.cmx-sv-close'); if (x) x.focus();
    ga('guardados_abrir', { value: total(), page_path: location.pathname });
  }
  function close() {
    bd.classList.remove('is-on'); panel.classList.remove('is-on'); document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function remove(k, id) {
    try {
      var m = read(); if (m[k] && m[k].items) { delete m[k].items[id]; if (!Object.keys(m[k].items).length) delete m[k]; }
      localStorage.setItem(META, JSON.stringify(m));
      var key = 'comparalo:fav:' + k, a = JSON.parse(localStorage.getItem(key) || '[]').filter(function (x) { return String(x) !== String(id); });
      localStorage.setItem(key, JSON.stringify(a));
    } catch (e) {}
    ga('favorito_quitar', { product_name: id, page_section: k, origen: 'panel_guardados' });
    window.dispatchEvent(new CustomEvent('cmx:favs', { detail: { src: 'panel' } }));
    count(); body();
  }

  function mount() {
    var act = document.querySelector('.cmx-hd-act'); if (!act) return;
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'cmx-sv-btn'; btn.className = 'cmx-sv-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = HEART + '<span class="cmx-sv-tx">Guardados</span><em id="cmx-sv-n">0</em>';
    act.insertBefore(btn, document.getElementById('cmx-hd-searchbtn') || act.firstChild);
    bd = document.createElement('div'); bd.className = 'cmx-sv-bd';
    panel = document.createElement('aside'); panel.className = 'cmx-sv'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'cmx-sv-h');
    panel.innerHTML = '<div class="cmx-sv-head"><h2 id="cmx-sv-h">Mis guardados</h2><button type="button" class="cmx-sv-close" aria-label="Cerrar">&times;</button></div>'
      + '<p class="cmx-sv-sub">Se guardan en este dispositivo y siguen aquí cuando vuelvas. Solo puedes comparar productos de la misma categoría. El precio es el de tu última visita a cada categoría.</p>'
      + '<div class="cmx-sv-body"></div>';
    document.body.appendChild(bd); document.body.appendChild(panel);
    btn.addEventListener('click', open); bd.addEventListener('click', close);
    panel.addEventListener('click', function (e) {
      var t = e.target, it = t.closest('.cmx-sv-item'), cat = t.closest('.cmx-sv-cat');
      if (t.closest('.cmx-sv-close')) return close();
      if (t.closest('[data-rm]') && it && cat) return remove(cat.getAttribute('data-k'), it.getAttribute('data-id'));
      if (t.closest('[data-go]') && cat) {
        var k = cat.getAttribute('data-k'), ids = sel[k] || [], c = cats().filter(function (x) { return x.k === k; })[0];
        if (!c || ids.length < 2) return;
        ga('guardados_comparar', { page_section: c.s, value: ids.length });
        if (c.u === location.pathname) { close(); window.dispatchEvent(new CustomEvent('cmx:compare', { detail: { section: c.s, ids: ids } })); }
        else location.href = c.u + '#comparar=' + ids.map(encodeURIComponent).join(',');
      }
    });
    panel.addEventListener('change', function (e) {
      var inp = e.target.closest('[data-pick]'); if (!inp) return;
      var cat = inp.closest('.cmx-sv-cat'), k = cat.getAttribute('data-k'), id = inp.closest('.cmx-sv-item').getAttribute('data-id'), a = sel[k] = sel[k] || [], i = a.indexOf(id);
      if (inp.checked) { if (a.length >= 3) { inp.checked = false; return; } if (i < 0) a.push(id); } else if (i >= 0) a.splice(i, 1);
      body();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-on')) close(); });
    window.addEventListener('cmx:favs', function () { count(); if (panel.classList.contains('is-on')) body(); });
    window.addEventListener('storage', function (e) { if (e.key === META) { count(); if (panel.classList.contains('is-on')) body(); } });
    count();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
