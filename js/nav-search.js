/**
 * comparalo.mx — buscador de categorías del menú (escritorio).
 * Se carga desde onboarding.js. Los datos viven en /js/categorias.js.
 */
(function () {
  'use strict';

  function withCats(fn) {
    if (window.CMX_CATS) { fn(); return; }
    var q = (window.__cmxQ = window.__cmxQ || []);
    q.push(fn);
    if (!window.__cmxL) {
      window.__cmxL = 1;
      var s = document.createElement('script');
      s.src = '/js/categorias.js';
      document.head.appendChild(s);
    }
  }

  var CATS = [];
  var SUBS = [];
  var activeIdx = -1;

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function score(cat, q) {
    var n = norm(cat.name);
    var s = norm(cat.sub);
    if (n === q) return 5;
    if (n.indexOf(q) === 0) return 4;
    if (n.indexOf(q) > -1) return 3;
    if (s.indexOf(q) > -1) return 2;
    var t = (cat.tags || []).map(norm);
    if (t.some(function (x) { return x.indexOf(q) === 0; })) return 1.5;
    if (t.some(function (x) { return x.indexOf(q) > -1; })) return 1;
    return 0;
  }

  function rank(list, q) {
    return list
      .map(function (c) { return { cat: c, s: score(c, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (r) { return r.cat; });
  }

  function doSearch(q) {
    var cats = rank(CATS, q);
    var subs = rank(SUBS, q).filter(function (s) {
      return !cats.some(function (c) { return c.url === s.url; });
    });
    return cats.concat(subs).slice(0, 8);
  }

  function itemHtml(c, i) {
    var subHtml = c.sub ? '<span class="cmx-ns-item-sub">' + c.sub + '</span>' : '';
    return '<a class="cmx-ns-item" role="option" href="' + c.url + '" data-i="' + i + '">'
      + '<span class="cmx-ns-item-ic">' + c.icon + '</span>'
      + '<span class="cmx-ns-item-text"><span class="cmx-ns-item-nm">' + c.name + '</span>' + subHtml + '</span>'
      + '</a>';
  }

  function renderDd(dd, results, isAll) {
    activeIdx = -1;
    if (!results.length) {
      dd.innerHTML = '<div class="cmx-ns-empty">Sin coincidencias. Prueba con «proteína», «laptop» o «iphone».</div>';
      dd.hidden = false;
      return;
    }
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
      '.cmx-ns{position:relative;flex:0 1 300px;min-width:180px;margin:0 8px}',
      '.cmx-ns-box{display:flex;align-items:center;background:var(--s1,#f7f7f5);',
      'border:1.5px solid var(--bd,#e2e2dc);border-radius:8px;padding:0 10px;',
      'gap:6px;height:36px;transition:border-color .15s}',
      '.cmx-ns-box:focus-within{border-color:var(--ac,#006847);background:#fff}',
      '.cmx-ns-ico{flex-shrink:0;opacity:.45;pointer-events:none}',
      '.cmx-ns-in{border:none;background:transparent;font-family:inherit;font-size:13px;',
      'color:var(--tx,#0F172A);width:100%;min-width:0;outline:none}',
      '.cmx-ns-in::placeholder{color:var(--tx2,#64748b)}',
      '.cmx-ns-dd{position:absolute;top:calc(100% + 6px);left:0;',
      'background:#fff;border:1.5px solid var(--bd2,#d0d0c8);border-radius:14px;',
      'box-shadow:0 12px 36px rgba(15,23,42,.14);z-index:9998;overflow:hidden;',
      'min-width:260px;width:max-content;max-width:320px;max-height:480px;overflow-y:auto}',
      '.cmx-ns-hdr{padding:9px 14px 5px;font-size:10px;font-weight:800;',
      'letter-spacing:.08em;text-transform:uppercase;color:var(--tx2,#64748b)}',
      '.cmx-ns-empty{padding:14px;font-size:13px;color:var(--tx2,#64748b);max-width:260px}',
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
      '@media(max-width:1100px){.cmx-ns{flex:0 1 220px;min-width:140px}}',
      '@media(max-width:900px){.cmx-ns{flex:1;max-width:200px}}',
      '@media(max-width:600px){.cmx-ns{flex:1;max-width:none;margin:0 0 0 8px}.cmx-ns-box{height:32px}}'
    ].join('');
    var el = document.createElement('style');
    el.id = 'cmx-ns-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  var SEARCH_ICON = '<svg class="cmx-ns-ico" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  function init() {
    var slot = document.getElementById('cmx-hd-search');
    if (!slot || document.getElementById('cmx-ns-wrap')) return;

    CATS = window.CMX_CATS || [];
    SUBS = window.CMX_SUBS || [];
    injectCss();

    var wrap = document.createElement('div');
    wrap.className = 'cmx-ns';
    wrap.id = 'cmx-ns-wrap';
    wrap.innerHTML = '<div class="cmx-ns-box">'
      + SEARCH_ICON
      + '<input class="cmx-ns-in" id="cmx-ns-in" type="text" role="combobox" aria-expanded="false" aria-controls="cmx-ns-dd" aria-autocomplete="list" placeholder="Buscar categoría…" autocomplete="off" aria-label="Buscar categoría" spellcheck="false">'
      + '</div>'
      + '<div class="cmx-ns-dd" id="cmx-ns-dd" hidden role="listbox" aria-label="Categorías"></div>';

    slot.appendChild(wrap);

    var input = document.getElementById('cmx-ns-in');
    var dd = document.getElementById('cmx-ns-dd');

    function sync() { input.setAttribute('aria-expanded', dd.hidden ? 'false' : 'true'); }
    function show() {
      var q = norm(input.value.trim());
      if (q) renderDd(dd, doSearch(q), false);
      else renderDd(dd, CATS, true);
      sync();
    }
    function hide() { dd.hidden = true; sync(); }

    input.addEventListener('input', show);
    input.addEventListener('focus', show);

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
      } else if (e.key === 'Enter') {
        var pick = items[activeIdx >= 0 ? activeIdx : 0];
        if (pick && !dd.hidden && (activeIdx >= 0 || input.value.trim())) {
          e.preventDefault();
          pick.click();
        }
      } else if (e.key === 'Escape') {
        hide();
        this.blur();
      }
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) hide();
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

  function start() { withCats(init); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
