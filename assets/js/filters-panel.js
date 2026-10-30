/* comparalo.mx — panel de filtros a la izquierda para páginas con toolbar de chips.
   Mueve los mismos botones .filter del #toolbar a <aside id="cmx-fp"> (la lógica de cada página no cambia),
   agrega contadores y, en móvil, un cajón con botón "Filtros". Requiere <html data-cmx-filters="panel">. */
(function () {
  var aside, main, openBtn, backdrop, clearBtn;

  /* Contadores por página: cuántos productos quedan con esa opción y el resto de filtros activos. */
  function maxPrice() {
    var i = document.getElementById('precio-max');
    return (i && parseFloat(i.value)) || Infinity;
  }
  var COUNTERS = {
    '/suplementos/magnesio/': function (key, val) {
      var f = Object.assign({}, filters); f[key] = val; var mx = maxPrice();
      return productos.filter(function (p) {
        if (f.forma !== 'todos' && p.formaMagnesio !== f.forma) return false;
        if (f.absorcion !== 'todos' && p.absorcion !== f.absorcion) return false;
        if (f.plataforma === 'ml' && !p.linkML) return false;
        if (f.plataforma === 'amz' && !p.linkAmz) return false;
        if (f.plataforma === 'ambas' && !(p.linkML && p.linkAmz)) return false;
        return !(mx < Infinity && (p.precio || 0) > mx);
      }).length;
    },
    '/suplementos/omega3/': function (key, val) {
      var f = Object.assign({}, filtros); f[key] = val; var mx = maxPrice();
      return productos.filter(function (p) {
        if (f.fuente !== 'todos' && !(p.fuenteOmega || '').toLowerCase().includes(f.fuente)) return false;
        if (f.plataforma === 'ml' && !(p.linkML && !p.linkAmz)) return false;
        if (f.plataforma === 'amz' && !(p.linkAmz && !p.linkML)) return false;
        if (f.plataforma === 'ambas' && !(p.linkML && p.linkAmz)) return false;
        return !(mx < Infinity && p.precio > mx);
      }).length;
    },
    '/suplementos/complejo-b/': viaFiltrar,
    '/suplementos/vitamina-d/': viaFiltrar
  };
  function viaFiltrar(key, val) {
    var old = filters[key]; filters[key] = val;
    try { return filtrar().length; } finally { filters[key] = old; }
  }
  var path = location.pathname;
  function count(key, val) {
    var fn = COUNTERS[path];
    if (!fn) return null;
    try { return fn(key, val); } catch (e) { return null; }
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function parseKV(btn) {
    var m = (btn.getAttribute('onclick') || '').match(/toggleFilter\('([^']+)'\s*,\s*'([^']*)'/);
    return m ? { key: m[1], val: m[2] } : null;
  }

  function refresh() {
    var active = 0;
    [].forEach.call(aside.querySelectorAll('.filter'), function (b) {
      var kv = parseKV(b);
      if (!kv) return;
      var n = count(kv.key, kv.val);
      var span = b.querySelector('.cmx-fp-n');
      if (n !== null && span) { span.textContent = '(' + n + ')'; b.classList.toggle('cmx-zero', n === 0 && kv.val !== 'todos' && !b.classList.contains('on')); }
      if (b.classList.contains('on') && kv.val !== 'todos') active++;
    });
    var mx = document.getElementById('precio-max');
    if (mx && mx.value) active++;
    clearBtn.classList.toggle('show', active > 0);
    var badge = openBtn.querySelector('.n');
    badge.textContent = active;
    badge.classList.toggle('show', active > 0);
  }

  function clearAll() {
    var seen = {};
    [].forEach.call(aside.querySelectorAll('.filter'), function (b) {
      var kv = parseKV(b);
      if (kv && !seen[kv.key] && kv.val === 'todos') { seen[kv.key] = 1; b.click(); }
    });
    var mx = document.getElementById('precio-max');
    if (mx && mx.value) { mx.value = ''; mx.dispatchEvent(new Event('input', { bubbles: true })); }
    refresh();
  }

  function setOpen(v) {
    aside.classList.toggle('open', v);
    backdrop.classList.toggle('show', v);
    document.body.style.overflow = v ? 'hidden' : '';
  }

  function build() {
    aside = document.getElementById('cmx-fp');
    var tb = document.getElementById('toolbar');
    if (!aside || !tb) return;
    main = aside.parentNode.querySelector('.cmx-fp-main');

    var head = el('div', 'cmx-fp-head');
    head.appendChild(el('span', 'cmx-fp-title', 'Filtros'));
    clearBtn = el('button', 'cmx-fp-clear', 'Limpiar todo');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', clearAll);
    var close = el('button', 'cmx-fp-close', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');
    close.type = 'button';
    close.setAttribute('aria-label', 'Cerrar filtros');
    close.addEventListener('click', function () { setOpen(false); });
    head.appendChild(clearBtn);
    head.appendChild(close);
    aside.appendChild(head);

    // Grupos: .filter-label seguido de botones .filter, hasta un separador
    var sec = null;
    var nodes = [].slice.call(tb.querySelectorAll(':scope > *, :scope > .sort-wrap > *'));
    var sortSel = null, priceInput = null;
    nodes.forEach(function (n) {
      if (n.classList.contains('sort-wrap')) return;
      if (n.classList.contains('filter-label')) {
        var t = n.textContent.trim();
        if (/precio/i.test(t)) { sec = el('div', 'cmx-fp-sec'); sec.appendChild(el('h3', '', 'Precio máximo (MXN)')); aside.appendChild(sec); return; }
        sec = el('div', 'cmx-fp-sec'); sec.appendChild(el('h3', '', t)); aside.appendChild(sec); return;
      }
      if (n.classList.contains('filter-sep')) { return; }
      if (n.id === 'btn-clear-filters') { n.style.display = 'none'; return; }
      if (n.tagName === 'INPUT' && n.id === 'precio-max') { priceInput = n; if (sec) sec.appendChild(n); return; }
      if (n.tagName === 'SELECT') { sortSel = n; return; }
      if (n.classList.contains('sort-label')) return;
      if (n.classList.contains('filter') && sec) {
        if (parseKV(n)) n.appendChild(el('span', 'cmx-fp-n', ''));
        sec.appendChild(n);
      }
    });

    // Ordenar: fila propia sobre el listado
    if (sortSel) {
      var row = el('div', 'cmx-fp-sort', 'Ordenar:');
      row.appendChild(sortSel);
      var info = main.querySelector('.result-info');
      if (info) info.parentNode.insertBefore(row, info); else main.insertBefore(row, main.firstChild);
    }

    // Botón y fondo del cajón en móvil
    openBtn = el('button', 'cmx-fp-open', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtros <span class="n"></span>');
    openBtn.type = 'button';
    openBtn.addEventListener('click', function () { setOpen(true); });
    main.insertBefore(openBtn, main.firstChild);
    var strip = main.querySelector('.how-strip');
    if (strip) main.insertBefore(strip, main.firstChild);
    backdrop = el('div', 'cmx-fp-backdrop');
    backdrop.addEventListener('click', function () { setOpen(false); });
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

    // Recalcular contadores tras cada render de la página
    if (typeof window.render === 'function') {
      var orig = window.render;
      window.render = function () { var r = orig.apply(this, arguments); refresh(); return r; };
    }
    aside.addEventListener('click', function () { setTimeout(refresh, 0); });
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
