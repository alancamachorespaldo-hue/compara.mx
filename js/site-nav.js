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
  var MOBILE = 1100;

  // Categorías: lista única en /js/categorias.js (compartida con el buscador de escritorio).
  function withCats(fn) {
    if (window.CMX_CATS) { fn(); return; }
    var q = (window.__cmxQ = window.__cmxQ || []);
    q.push(fn);
    if (!window.__cmxL) {
      window.__cmxL = 1;
      var sc = document.createElement('script');
      sc.src = '/js/categorias.js';
      document.head.appendChild(sc);
    }
  }

  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var ga = function (name, params) { if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} } };

  function injectCSS() {
    if (document.getElementById('sitenav-css')) return;
    var css = [
      '#sitenav-bar{display:none}',
      '@media(max-width:' + MOBILE + 'px){',
      '  [data-sitenav-hide]{display:none!important}',
      '  #sitenav-bar{display:flex;align-items:center;gap:10px;position:sticky;top:64px;z-index:95;background:#fff;border-bottom:1px solid #e2e2dc;padding:10px 16px}',
      '  #sitenav-bar button{flex:1;display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border:1.5px solid #e2e2dc;border-radius:24px;background:#f7f7f5;color:#64748b;font:inherit;font-size:14px;cursor:pointer;text-align:left;font-family:inherit}',
      '  #sitenav-bar button:focus-visible{outline:2px solid #006847;outline-offset:2px}',
      '}',
      '@media(max-width:' + MOBILE + 'px){#cmx-ns-wrap{display:none!important}}',
      '#sitenav-ov{position:fixed;inset:0;z-index:300;background:rgba(15,23,42,.5);display:none;align-items:flex-start;justify-content:center;padding:0}',
      '#sitenav-ov.open{display:flex}',
      '#sitenav-panel{background:#fff;width:100%;max-width:560px;max-height:100dvh;display:flex;flex-direction:column;border-radius:0 0 16px 16px;box-shadow:0 12px 40px rgba(0,0,0,.2)}',
      '#sitenav-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #eef0ee}',
      '#sitenav-top .ic{color:#64748b;flex-shrink:0}',
      '#sitenav-input{flex:1;min-width:0;border:none;outline:none;font:inherit;font-size:16px;color:#0F172A;background:transparent;font-family:inherit}',
      '#sitenav-close{all:unset;cursor:pointer;color:#64748b;font-size:20px;line-height:1;padding:4px 8px;border-radius:8px}',
      '#sitenav-close:hover{background:#f1f5f9}',
      '#sitenav-list{overflow-y:auto;padding:10px 10px 16px}',
      '#sitenav-list .ttl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;padding:8px 8px 6px}',
      '.sitenav-cat{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:12px;text-decoration:none;color:#0F172A}',
      '.sitenav-cat:hover,.sitenav-cat:focus-visible{background:#f3f6f4;outline:none}',
      '.sitenav-cat .em{font-size:22px;width:30px;text-align:center;flex-shrink:0}',
      '.sitenav-cat .tx{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.sitenav-cat .nm{font-size:15px;font-weight:700;letter-spacing:-.01em}',
      '.sitenav-cat .ds{font-size:12px;color:#64748b;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sitenav-cat .ar{color:#cbd5e1;flex-shrink:0}',
      '#sitenav-empty{padding:24px 12px;text-align:center;color:#64748b;font-size:13px}',
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
    ov.setAttribute('aria-label', 'Buscar categoría');
    ov.innerHTML =
      '<div id="sitenav-panel">' +
      '  <div id="sitenav-top">' +
      '    <svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '    <input id="sitenav-input" type="search" placeholder="Buscar categoría…" autocomplete="off" aria-label="Buscar">' +
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
    var CATS = window.CMX_CATS || [];
    var SUBS = window.CMX_SUBS || [];
    var n = norm(q);
    function hit(c) {
      return norm(c.name).includes(n) || norm(c.sub).includes(n) || (c.tags || []).some(function (t) { return norm(t).includes(n) || n.includes(norm(t)); });
    }
    var cats = CATS.filter(function (c) { return !n || hit(c); });
    var subs = n ? SUBS.filter(function (c) { return hit(c) && !cats.some(function (x) { return x.url === c.url; }); }) : [];
    function row(c) {
      return '<a class="sitenav-cat" href="' + c.url + '" data-cat="' + c.name + '"><span class="em">' + c.icon + '</span><span class="tx"><span class="nm">' + c.name + '</span><span class="ds">' + c.sub + '</span></span><span class="ar">›</span></a>';
    }
    var html = '';
    if (cats.length) html += '<div class="ttl">Nuestras comparativas</div>' + cats.map(row).join('');
    if (subs.length) html += '<div class="ttl">Más destinos</div>' + subs.map(row).join('');
    if (!cats.length && !subs.length) html = '<div id="sitenav-empty">Sin coincidencias. Prueba con «proteína», «celulares», «laptop»…</div>';
    list.innerHTML = html;
    [].forEach.call(list.querySelectorAll('.sitenav-cat'), function (a) {
      a.addEventListener('click', function () { ga('category_click', { category: a.getAttribute('data-cat') || '', source: 'mobile_search' }); });
    });
  }

  function openPanel() {
    buildOverlay();
    withCats(function () { renderList(''); });
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

  function injectBar() {
    var sbtn = document.getElementById('cmx-hd-searchbtn');
    if (sbtn) { sbtn.addEventListener('click', openPanel); return; }
    if (document.getElementById('sitenav-bar')) return;
    var nav = document.getElementById('cmx-hd') || document.querySelector('nav');
    var bar = document.createElement('div');
    bar.id = 'sitenav-bar';
    bar.innerHTML = '<button type="button" aria-label="Buscar categoría"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Buscar categoría…</span></button>';
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('button').addEventListener('click', openPanel);
    // La barra se pega justo debajo del menú, sea cual sea su altura en cada página.
    function syncTop() {
      var pos = nav ? getComputedStyle(nav).position : '';
      bar.style.top = (pos === 'sticky' || pos === 'fixed') ? nav.offsetHeight + 'px' : '0px';
    }
    syncTop();
    window.addEventListener('resize', syncTop);
    window.addEventListener('load', syncTop);
  }

  function init() {
    injectCSS();
    injectBar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
