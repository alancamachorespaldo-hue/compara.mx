/*
 * site-nav.js — Navegación móvil unificada para comparalo.mx
 * En móvil: oculta los botones horizontales de categorías del nav (que además
 * causaban scroll horizontal) y muestra un buscador prominente que, al tocarlo,
 * abre un panel con TODAS las categorías del sitio (enlaces reales). Escribir
 * filtra la lista de categorías. En escritorio no cambia nada.
 * Reutilizable: se carga en todas las páginas (como onboarding.js).
 */
(function () {
  'use strict';
  var MOBILE = 820;

  // Categorías reales del sitio (enlaces existentes). Imagen opcional por categoría.
  var CATS = [
    { icon: '📱', name: 'Celulares', url: '/celulares/', desc: 'iPhone y Android', sub: ['iphone', 'android', 'smartphone'] },
    { icon: '💊', name: 'Suplementos', url: '/suplementos/', desc: 'Proteína, creatina, magnesio…', sub: ['proteina', 'creatina', 'magnesio', 'omega', 'complejo b', 'vitamina'] },
    { icon: '🚲', name: 'Bicicletas', url: '/bicis/', desc: 'Montaña, eléctricas, ruta', sub: ['electrica', 'montaña', 'ruta', 'gravel'] },
    { icon: '🏠', name: 'Electrodomésticos', url: '/electrodomesticos/', desc: 'Freidoras, microondas', sub: ['freidora', 'microondas', 'horno'] },
    { icon: '💻', name: 'Laptops', url: '/laptops/', desc: 'Gaming, trabajo, estudio', sub: ['gaming', 'trabajo', 'chromebook'] },
  ];
  // Destinos extra para que el filtro encuentre subcategorías por nombre.
  var SUBS = [
    { name: 'Proteína', url: '/suplementos/proteina/' }, { name: 'Creatina', url: '/suplementos/creatina/' },
    { name: 'Magnesio', url: '/suplementos/magnesio/' }, { name: 'Omega 3', url: '/suplementos/omega3/' },
    { name: 'Complejo B', url: '/suplementos/complejo-b/' }, { name: 'Vitamina D', url: '/suplementos/vitamina-d/' },
    { name: 'Freidoras', url: '/electrodomesticos/freidoras/' }, { name: 'Microondas', url: '/electrodomesticos/microondas/' },
    { name: 'iPhone', url: '/celulares/iphone/' }, { name: 'Android', url: '/celulares/android/' },
  ];

  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var ga = function (name, params) { if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} } };

  function injectCSS() {
    if (document.getElementById('sitenav-css')) return;
    var css = [
      '#sitenav-bar{display:none}',
      '@media(max-width:' + MOBILE + 'px){',
      '  [data-sitenav-hide]{display:none!important}',
      '  #sitenav-bar{display:flex;align-items:center;gap:10px;position:sticky;top:64px;z-index:95;background:#fff;border-bottom:1px solid #e2e2dc;padding:10px 16px}',
      '  #sitenav-bar button{flex:1;display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border:1.5px solid #e2e2dc;border-radius:24px;background:#f7f7f5;color:#94a3b8;font:inherit;font-size:14px;cursor:pointer;text-align:left;font-family:inherit}',
      '  #sitenav-bar button:focus-visible{outline:2px solid #006847;outline-offset:2px}',
      '}',
      '#sitenav-ov{position:fixed;inset:0;z-index:300;background:rgba(15,23,42,.5);display:none;align-items:flex-start;justify-content:center;padding:0}',
      '#sitenav-ov.open{display:flex}',
      '#sitenav-panel{background:#fff;width:100%;max-width:560px;max-height:100dvh;display:flex;flex-direction:column;border-radius:0 0 16px 16px;box-shadow:0 12px 40px rgba(0,0,0,.2)}',
      '#sitenav-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #eef0ee}',
      '#sitenav-top .ic{color:#94a3b8;flex-shrink:0}',
      '#sitenav-input{flex:1;min-width:0;border:none;outline:none;font:inherit;font-size:16px;color:#0F172A;background:transparent;font-family:inherit}',
      '#sitenav-close{all:unset;cursor:pointer;color:#64748b;font-size:20px;line-height:1;padding:4px 8px;border-radius:8px}',
      '#sitenav-close:hover{background:#f1f5f9}',
      '#sitenav-list{overflow-y:auto;padding:10px 10px 16px}',
      '#sitenav-list .ttl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;padding:8px 8px 6px}',
      '.sitenav-cat{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:12px;text-decoration:none;color:#0F172A}',
      '.sitenav-cat:hover,.sitenav-cat:focus-visible{background:#f3f6f4;outline:none}',
      '.sitenav-cat .em{font-size:22px;width:30px;text-align:center;flex-shrink:0}',
      '.sitenav-cat .tx{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.sitenav-cat .nm{font-size:15px;font-weight:700;letter-spacing:-.01em}',
      '.sitenav-cat .ds{font-size:12px;color:#64748b;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sitenav-cat .ar{color:#cbd5e1;flex-shrink:0}',
      '#sitenav-empty{padding:24px 12px;text-align:center;color:#94a3b8;font-size:13px}',
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'sitenav-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function buildOverlay() {
    if (document.getElementById('sitenav-ov')) return;
    var ov = document.createElement('div');
    ov.id = 'sitenav-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Buscar y explorar categorías');
    ov.innerHTML =
      '<div id="sitenav-panel">' +
      '  <div id="sitenav-top">' +
      '    <svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '    <input id="sitenav-input" type="search" placeholder="Buscar productos o categorías…" autocomplete="off" aria-label="Buscar">' +
      '    <button id="sitenav-close" aria-label="Cerrar">✕</button>' +
      '  </div>' +
      '  <div id="sitenav-list"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closePanel(); });
    document.getElementById('sitenav-close').addEventListener('click', closePanel);
    document.getElementById('sitenav-input').addEventListener('input', function () { renderList(this.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
    renderList('');
  }

  function renderList(q) {
    var list = document.getElementById('sitenav-list');
    var n = norm(q);
    var cats = CATS.filter(function (c) { return !n || norm(c.name).includes(n) || norm(c.desc).includes(n) || (c.sub || []).some(function (s) { return norm(s).includes(n) || n.includes(norm(s)); }); });
    var subs = n ? SUBS.filter(function (s) { return norm(s.name).includes(n); }) : [];
    var html = '';
    if (cats.length) {
      html += '<div class="ttl">Explora nuestras categorías</div>';
      html += cats.map(function (c) {
        return '<a class="sitenav-cat" href="' + c.url + '" data-cat="' + c.name + '"><span class="em">' + c.icon + '</span><span class="tx"><span class="nm">' + c.name + '</span><span class="ds">' + c.desc + '</span></span><span class="ar">›</span></a>';
      }).join('');
    }
    if (subs.length) {
      html += '<div class="ttl">Subcategorías</div>';
      html += subs.map(function (s) {
        return '<a class="sitenav-cat" href="' + s.url + '" data-cat="' + s.name + '"><span class="em">→</span><span class="tx"><span class="nm">' + s.name + '</span></span><span class="ar">›</span></a>';
      }).join('');
    }
    if (!cats.length && !subs.length) html = '<div id="sitenav-empty">Sin coincidencias. Prueba con «proteína», «celulares», «laptop»…</div>';
    list.innerHTML = html;
    [].forEach.call(list.querySelectorAll('.sitenav-cat'), function (a) {
      a.addEventListener('click', function () { ga('category_click', { category: a.getAttribute('data-cat') || '', source: 'mobile_search' }); });
    });
  }

  function openPanel() {
    buildOverlay();
    document.getElementById('sitenav-ov').classList.add('open');
    document.body.style.overflow = 'hidden';
    var inp = document.getElementById('sitenav-input');
    renderList('');
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 40);
    ga('search_open', { source: 'mobile' });
  }
  function closePanel() {
    var ov = document.getElementById('sitenav-ov');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Oculta en móvil los contenedores del nav con >=2 enlaces de categoría (los botones horizontales).
  function hideHorizontalCats() {
    var catRe = /\/(celulares|suplementos|bicis|electrodomesticos|laptops)\//;
    [].forEach.call(document.querySelectorAll('nav'), function (nav) {
      var counts = new Map();
      [].forEach.call(nav.querySelectorAll('a[href]'), function (a) {
        if (!catRe.test(a.getAttribute('href') || '')) return;
        var cont = a.parentElement;
        if (!cont || cont === nav) return;
        counts.set(cont, (counts.get(cont) || 0) + 1);
      });
      counts.forEach(function (n, cont) {
        if (n >= 2 && !cont.querySelector('input')) cont.setAttribute('data-sitenav-hide', '1');
      });
    });
  }

  function injectBar() {
    if (document.getElementById('sitenav-bar')) return;
    var nav = document.querySelector('nav');
    var bar = document.createElement('div');
    bar.id = 'sitenav-bar';
    bar.innerHTML = '<button type="button" aria-label="Buscar productos o categorías"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Buscar productos o categorías…</span></button>';
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('button').addEventListener('click', openPanel);
  }

  function init() {
    injectCSS();
    hideHorizontalCats();
    injectBar();
    // Si la página ya tiene un buscador en el nav, en móvil también abre el panel al enfocarlo.
    var navInput = document.querySelector('nav input[type=search], nav .nav-search-input');
    if (navInput) navInput.addEventListener('focus', function () { if (window.matchMedia('(max-width:' + MOBILE + 'px)').matches) { navInput.blur(); openPanel(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
