/**
 * comparalo.mx — nav category search
 * Se carga dinámicamente desde onboarding.js (ya presente en todas las páginas).
 * Inyecta un buscador de categorías en .nav antes de .nav-links.
 */
(function () {
  'use strict';

  var CATS = [
    { name: 'Laptops',               icon: '💻', url: '/laptops/',                        tags: ['laptop','computadora','notebook','portatil','pc','macbook','lenovo','hp','dell','asus','gaming'] },
    { name: 'Bicicletas',            icon: '🚲', url: '/bicis/',                           tags: ['bici','bicicleta','ciclo','bike','cycling'] },
    { name: 'Bicicletas eléctricas', icon: '🚲', url: '/bicis/',                           tags: ['electrica','eléctrica','ebike','e-bike','electro'] },
    { name: 'Bicicletas de montaña', icon: '🚵', url: '/bicis/',                           tags: ['montana','montaña','mtb','mountain'] },
    { name: 'Bicicletas de ruta',    icon: '🚴', url: '/bicis/',                           tags: ['ruta','road','carretera'] },
    { name: 'Bicicletas gravel',     icon: '🚲', url: '/bicis/',                           tags: ['gravel','grava'] },
    { name: 'Electrodomésticos',     icon: '🏠', url: '/electrodomesticos/',               tags: ['electrodomestico','hogar','casa','cocina','appliance'] },
    { name: 'Freidoras de aire',     icon: '🍟', url: '/electrodomesticos/freidoras/',     tags: ['freidora','air fryer','airfryer','freir','freír','fry'] },
    { name: 'Microondas',            icon: '📡', url: '/electrodomesticos/microondas/',    tags: ['microondas','horno','microwave'] },
    { name: 'Cafeteras',             icon: '☕', url: '/electrodomesticos/cafeteras/',     tags: ['cafetera','cafe','café','nespresso','dolce gusto','espresso','coffee','capsula','cápsula'] },
    { name: 'Suplementos',           icon: '💊', url: '/suplementos/',                     tags: ['suplemento','nutricion','nutrición','deporte','gym','vitamina'] },
    { name: 'Proteína en polvo',     icon: '💪', url: '/suplementos/proteina/',            tags: ['proteina','whey','suero','proteína','polvo','musculo','músculo'] },
    { name: 'Proteína con creatina', icon: '💪', url: '/suplementos/proteina-con-creatina/', tags: ['proteina creatina','pack','combo'] },
    { name: 'Creatina',              icon: '💊', url: '/suplementos/creatina/',            tags: ['creatina','monohidratada','creatine'] },
    { name: 'Omega 3',               icon: '🐟', url: '/suplementos/omega3/',              tags: ['omega3','omega-3','omega 3','pescado','fish oil','aceite'] },
    { name: 'Magnesio',              icon: '💊', url: '/suplementos/magnesio/',            tags: ['magnesio','magnesium','mineral'] },
    { name: 'Complejo B',            icon: '💊', url: '/suplementos/complejo-b/',          tags: ['complejo b','vitamina b','b12','b6','b complex'] },
    { name: 'Vitamina D',            icon: '☀️', url: '/suplementos/vitamina-d/',          tags: ['vitamina d','vitamin d','sol','hueso'] },
    { name: 'Celulares',             icon: '📱', url: '/celulares/',                       tags: ['celular','movil','móvil','telefono','teléfono','smartphone','phone'] },
    { name: 'iPhone',                icon: '📱', url: '/celulares/iphone/',                tags: ['iphone','apple','ios'] },
    { name: 'Celulares Android',     icon: '📱', url: '/celulares/android/',               tags: ['android','samsung','google','pixel','motorola','xiaomi','redmi'] },
    { name: 'Videojuegos',           icon: '🎮', url: '/videojuegos/',                     tags: ['videojuego','juego','consola','playstation','xbox','nintendo','ps5','switch','gaming'] },
    { name: 'Tecnología',            icon: '🎧', url: '/tecnologia/',                      tags: ['tecnologia','tecnología','audifono','audífono','gadget','teclado','mouse','monitor','auricular'] },
  ];

  var activeIdx = -1;

  function score(cat, q) {
    var n = cat.name.toLowerCase();
    if (n === q) return 4;
    if (n.startsWith(q)) return 3;
    if (n.includes(q)) return 2;
    if (cat.tags && cat.tags.some(function (t) { return t.startsWith(q); })) return 1.5;
    if (cat.tags && cat.tags.some(function (t) { return t.includes(q); })) return 1;
    return 0;
  }

  function doSearch(q) {
    return CATS
      .map(function (c) { return { cat: c, s: score(c, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 7)
      .map(function (r) { return r.cat; });
  }

  function renderDd(dd, results) {
    activeIdx = -1;
    if (!results.length) { dd.hidden = true; return; }
    dd.innerHTML = results.map(function (c, i) {
      return '<a class="cmx-ns-item" href="' + c.url + '" data-i="' + i + '">'
        + '<span class="cmx-ns-item-ic">' + c.icon + '</span>'
        + '<span class="cmx-ns-item-nm">' + c.name + '</span>'
        + '</a>';
    }).join('');
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
      '.cmx-ns{position:relative;flex:0 1 220px;min-width:110px;margin:0 8px}',
      /* input box */
      '.cmx-ns-box{display:flex;align-items:center;background:var(--s1,#f7f7f5);',
      'border:1.5px solid var(--bd,#e2e2dc);border-radius:8px;padding:0 10px;',
      'gap:6px;height:36px;transition:border-color .15s}',
      '.cmx-ns-box:focus-within{border-color:var(--ac,#006847);background:#fff}',
      /* search icon (SVG) */
      '.cmx-ns-ico{flex-shrink:0;opacity:.45;pointer-events:none}',
      /* input */
      '.cmx-ns-in{border:none;background:transparent;font-family:inherit;font-size:13px;',
      'color:var(--tx,#0F172A);width:100%;min-width:0;outline:none}',
      '.cmx-ns-in::placeholder{color:var(--tx3,#94a3b8)}',
      /* dropdown */
      '.cmx-ns-dd{position:absolute;top:calc(100% + 6px);left:0;',
      'background:#fff;border:1.5px solid var(--bd2,#d0d0c8);border-radius:12px;',
      'box-shadow:0 10px 32px rgba(15,23,42,.13);z-index:9998;overflow:hidden;',
      'min-width:220px;width:max-content;max-width:280px}',
      /* item */
      '.cmx-ns-item{display:flex;align-items:center;gap:9px;padding:9px 14px;',
      'text-decoration:none;color:var(--tx,#0F172A);font-size:13px;font-weight:600;',
      'transition:background .1s;border-bottom:1px solid var(--bd,#e2e2dc)}',
      '.cmx-ns-item:last-child{border-bottom:none}',
      '.cmx-ns-item:hover,.cmx-ns-item.cmx-ns-active{background:#f0f8f3;color:var(--ac,#006847);text-decoration:none}',
      '.cmx-ns-item-ic{font-size:15px;flex-shrink:0;width:20px;text-align:center;line-height:1}',
      '.cmx-ns-item-nm{white-space:nowrap}',
      /* responsive */
      '@media(max-width:900px){.cmx-ns{flex:1;max-width:180px}}',
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
    if (navLinks) nav.insertBefore(wrap, navLinks);
    else nav.appendChild(wrap);

    var input = document.getElementById('cmx-ns-in');
    var dd    = document.getElementById('cmx-ns-dd');

    input.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (!q) { dd.hidden = true; return; }
      renderDd(dd, doSearch(q));
    });

    input.addEventListener('focus', function () {
      var q = this.value.trim().toLowerCase();
      if (q) renderDd(dd, doSearch(q));
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
