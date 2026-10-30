/**
 * comparalo.mx — nav category search
 * Se carga dinámicamente desde onboarding.js (ya presente en todas las páginas).
 * Inyecta un buscador de categorías en .nav antes de .nav-links.
 */
(function () {
  'use strict';

  var CATS = [
    { name: 'Suplementos',         sub: 'Proteína, Creatina, Magnesio, Complejo B, Omega 3', icon: '💊', url: '/suplementos/',                     tags: ['suplemento','nutricion','gym','vitamina','proteina','creatina','magnesio','omega'] },
    { name: 'Bicicletas',          sub: 'Urbanas, eléctricas, montaña',                       icon: '🚲', url: '/bicis/',                           tags: ['bici','bicicleta','ciclo','bike','cycling','mountain','ruta','gravel','electrica'] },
    { name: 'Laptops',             sub: 'Universidad, gaming, trabajo',                       icon: '💻', url: '/laptops/',                         tags: ['laptop','computadora','notebook','portatil','pc','macbook','lenovo','hp','dell','asus','gaming'] },
    { name: 'Electrodomésticos',   sub: 'Microondas, freidoras de aire',                      icon: '🏠', url: '/electrodomesticos/',               tags: ['electrodomestico','hogar','casa','cocina','appliance'] },
    { name: 'Microondas',          sub: 'Básico, grill, convección',                          icon: '📡', url: '/electrodomesticos/microondas/',    tags: ['microondas','horno','microwave','grill'] },
    { name: 'Freidoras de Aire',   sub: 'Sin aceite, digital, compactas',                     icon: '🍟', url: '/electrodomesticos/freidoras/',     tags: ['freidora','air fryer','airfryer','freir','fry'] },
    { name: 'Android',             sub: 'Samsung, Pixel, Motorola y más',                     icon: '🤖', url: '/celulares/android/',               tags: ['android','samsung','google','pixel','motorola','xiaomi','redmi','celular','smartphone'] },
    { name: 'iPhone',              sub: 'iPhone 17, 18 Pro, 18 Pro Max',                      icon: '🍎', url: '/celulares/iphone/',                tags: ['iphone','apple','ios'] },
    { name: 'Videojuegos',         sub: 'Consolas Nintendo, PlayStation, Xbox',               icon: '🎮', url: '/videojuegos/',                     tags: ['videojuego','juego','gaming','nintendo','playstation','xbox','ps5','switch'] },
    { name: 'Consolas',            sub: 'Switch 2, PS5, Xbox Series X',                       icon: '🕹️', url: '/videojuegos/',                     tags: ['consola','console','switch','ps5','xbox','serie x'] },
    { name: 'Tecnología',          sub: 'Alexas, audífonos, smartwatches',                    icon: '🎧', url: '/tecnologia/',                      tags: ['tecnologia','tecnología','gadget','alexa','echo','teclado','mouse','monitor'] },
    { name: 'Bocinas inteligentes',sub: 'Echo, Echo Dot, Google Nest',                        icon: '🔊', url: '/tecnologia/',                      tags: ['bocina','speaker','echo','alexa','google nest','nest','altavoz','bose','sonos'] },
    { name: 'Audífonos',           sub: 'In-ear, over-ear, true wireless',                    icon: '🎧', url: '/tecnologia/',                      tags: ['audifono','audífono','auricular','headphone','earphone','true wireless','airpods','inalambrico'] },
    { name: 'Smartwatches',        sub: 'Compatibles con iOS y Android',                      icon: '⌚', url: '/tecnologia/',                      tags: ['smartwatch','reloj inteligente','apple watch','galaxy watch','garmin','fitbit','wearable'] },
  ];

  var activeIdx = -1;

  function score(cat, q) {
    var n = cat.name.toLowerCase();
    var s = (cat.sub || '').toLowerCase();
    if (n === q) return 5;
    if (n.startsWith(q)) return 4;
    if (n.includes(q)) return 3;
    if (s.includes(q)) return 2;
    if (cat.tags && cat.tags.some(function (t) { return t.startsWith(q); })) return 1.5;
    if (cat.tags && cat.tags.some(function (t) { return t.includes(q); })) return 1;
    return 0;
  }

  function doSearch(q) {
    return CATS
      .map(function (c) { return { cat: c, s: score(c, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8)
      .map(function (r) { return r.cat; });
  }

  function itemHtml(c, i) {
    var subHtml = c.sub ? '<span class="cmx-ns-item-sub">' + c.sub + '</span>' : '';
    return '<a class="cmx-ns-item" href="' + c.url + '" data-i="' + i + '">'
      + '<span class="cmx-ns-item-ic">' + c.icon + '</span>'
      + '<span class="cmx-ns-item-text"><span class="cmx-ns-item-nm">' + c.name + '</span>' + subHtml + '</span>'
      + '</a>';
  }

  function renderDd(dd, results, isAll) {
    activeIdx = -1;
    if (!results.length) { dd.hidden = true; return; }
    var hdr = isAll ? '<div class="cmx-ns-hdr">Nuestras comparativas</div>' : '';
    dd.innerHTML = hdr + results.map(itemHtml).join('');
    dd.hidden = false;
  }

  function setActive(items, idx) {
    items.forEach(function (el, i) { el.classList.toggle('cmx-ns-active', i === idx); });
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  function injectCss() {
    if (document.getElementById('cmx-ns-css')) return;
    var css = [
      /* wrapper */
      '.cmx-ns{position:relative;flex:0 1 300px;min-width:180px;margin:0 8px}',
      /* input box */
      '.cmx-ns-box{display:flex;align-items:center;background:var(--s1,#f7f7f5);',
      'border:1.5px solid var(--bd,#e2e2dc);border-radius:8px;padding:0 10px;',
      'gap:6px;height:36px;transition:border-color .15s}',
      '.cmx-ns-box:focus-within{border-color:var(--ac,#006847);background:#fff}',
      /* icon */
      '.cmx-ns-ico{flex-shrink:0;opacity:.45;pointer-events:none}',
      /* input */
      '.cmx-ns-in{border:none;background:transparent;font-family:inherit;font-size:13px;',
      'color:var(--tx,#0F172A);width:100%;min-width:0;outline:none}',
      '.cmx-ns-in::placeholder{color:var(--tx3,#94a3b8)}',
      /* dropdown */
      '.cmx-ns-dd{position:absolute;top:calc(100% + 6px);left:0;',
      'background:#fff;border:1.5px solid var(--bd2,#d0d0c8);border-radius:14px;',
      'box-shadow:0 12px 36px rgba(15,23,42,.14);z-index:9998;overflow:hidden;',
      'min-width:260px;width:max-content;max-width:320px;max-height:480px;overflow-y:auto}',
      /* header */
      '.cmx-ns-hdr{padding:9px 14px 5px;font-size:10px;font-weight:800;',
      'letter-spacing:.08em;text-transform:uppercase;color:var(--tx3,#94a3b8)}',
      /* item */
      '.cmx-ns-item{display:flex;align-items:center;gap:10px;padding:7px 14px;',
      'text-decoration:none;color:var(--tx,#0F172A);transition:background .1s;',
      'border-bottom:1px solid var(--bd,#e2e2dc)}',
      '.cmx-ns-item:last-child{border-bottom:none}',
      '.cmx-ns-item:hover,.cmx-ns-item.cmx-ns-active{background:#f0f8f3;text-decoration:none}',
      '.cmx-ns-item-ic{font-size:18px;flex-shrink:0;width:24px;text-align:center;line-height:1}',
      '.cmx-ns-item-text{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.cmx-ns-item-nm{font-size:13px;font-weight:700;color:var(--tx,#0F172A);white-space:nowrap}',
      '.cmx-ns-item:hover .cmx-ns-item-nm,.cmx-ns-item.cmx-ns-active .cmx-ns-item-nm{color:var(--ac,#006847)}',
      '.cmx-ns-item-sub{font-size:11px;color:var(--tx2,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      /* responsive */
      '@media(max-width:1100px){.cmx-ns{flex:0 1 220px;min-width:140px}}',
      '@media(max-width:900px){.cmx-ns{flex:1;max-width:200px}}',
      '@media(max-width:600px){.cmx-ns{flex:1;max-width:none;margin:0 0 0 8px}.cmx-ns-box{height:32px}}',
    ].join('');
    var el = document.createElement('style');
    el.id = 'cmx-ns-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  var SEARCH_ICON = '<svg class="cmx-ns-ico" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  function init() {
    var nav = document.querySelector('.nav');
    if (!nav || document.getElementById('cmx-ns-wrap')) return;
    if (nav.querySelector('.nav-search, .nav-search-wrap, input[type=search], input[type=text]')) return;

    injectCss();

    var wrap = document.createElement('div');
    wrap.className = 'cmx-ns';
    wrap.id = 'cmx-ns-wrap';
    wrap.innerHTML = '<div class="cmx-ns-box">'
      + SEARCH_ICON
      + '<input class="cmx-ns-in" id="cmx-ns-in" type="text" placeholder="Buscar categoría…" autocomplete="off" aria-label="Buscar categoría" spellcheck="false">'
      + '</div>'
      + '<div class="cmx-ns-dd" id="cmx-ns-dd" hidden role="listbox"></div>';

    var navLinks = nav.querySelector('.nav-links');
    if (navLinks && navLinks.parentNode) navLinks.parentNode.insertBefore(wrap, navLinks);
    else nav.appendChild(wrap);

    var input = document.getElementById('cmx-ns-in');
    var dd    = document.getElementById('cmx-ns-dd');

    input.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (!q) { renderDd(dd, CATS, true); return; }
      renderDd(dd, doSearch(q), false);
    });

    input.addEventListener('focus', function () {
      var q = this.value.trim().toLowerCase();
      if (q) renderDd(dd, doSearch(q), false);
      else renderDd(dd, CATS, true);
    });

    input.addEventListener('keydown', function (e) {
      var items = [].slice.call(dd.querySelectorAll('.cmx-ns-item'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        setActive(items, activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        setActive(items, activeIdx);
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        if (items[activeIdx]) items[activeIdx].click();
      } else if (e.key === 'Escape') {
        dd.hidden = true;
        this.blur();
      }
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) dd.hidden = true;
    });

    dd.addEventListener('click', function (e) {
      var item = e.target.closest('.cmx-ns-item');
      if (item) {
        try {
          if (typeof gtag === 'function') {
            var nm = item.querySelector('.cmx-ns-item-nm');
            gtag('event', 'nav_search_select', {
              event_category: 'nav_search',
              event_label: nm ? nm.textContent : item.href
            });
          }
        } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
