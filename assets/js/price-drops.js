/* comparalo.mx — bajadas de precio por categoría.
   Lee /assets/data/bajadas.json (lo regenera scripts/generar-bajadas.js en cada actualización de precios) y:
   - expone cmxGetDrop(p) para saber si un producto bajó y cuánto;
   - pinta la bajada en la tarjeta ("↓ 6% · Bajó $30 · Antes $569");
   - ofrece el filtro "Bajó de precio" (chip sobre el listado; en las páginas con panel lo agrega filters-panel.js). */
(function () {
  var MAP = {
    '/suplementos/proteina/': 'proteina', '/suplementos/creatina/': 'creatina', '/suplementos/magnesio/': 'magnesio',
    '/suplementos/omega3/': 'omega3', '/suplementos/complejo-b/': 'complejo_b', '/suplementos/vitamina-d/': 'vitamina_d',
    '/laptops/': 'laptops', '/bicis/': 'bicis', '/electrodomesticos/freidoras/': 'freidoras', '/electrodomesticos/microondas/': 'microondas',
    '/electrodomesticos/cafeteras/': 'cafeteras', '/tecnologia/audifonos/': 'tecnologia_audifonos', '/tecnologia/bocinas/': 'tecnologia_bocinas',
    '/videojuegos/consolas/': 'videojuegos_consolas', '/videojuegos/controles/': 'videojuegos_controles', '/videojuegos/juegos/': 'videojuegos_juegos',
    '/celulares/android/': 'celulares_android', '/celulares/iphone/': 'celulares_iphone'
  };
  var key = MAP[location.pathname];
  if (!key) return;

  window.cmxPassers = window.cmxPassers || [];
  window.cmxPass = window.cmxPass || function (p) { return window.cmxPassers.every(function (f) { return f(p); }); };

  var drops = {};
  var dropOnly = false;
  var hooked = false;
  var chip = null;
  var NATIVE = typeof window.getDrop === 'function'; // proteína y creatina ya pintan y filtran la bajada por su cuenta

  function list() {
    try { return typeof productos !== 'undefined' ? productos : (typeof PRODUCTOS !== 'undefined' ? PRODUCTOS : []); } catch (e) { return []; }
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function money(n) { return '$' + Math.round(n).toLocaleString('es-MX'); }

  /* Devuelve la bajada vigente del producto o null. Exige el mismo id y nombre, y que el precio actual de la
     tienda coincida con el de la bajada, para no mostrar un dato viejo si el precio volvió a cambiar. */
  window.cmxGetDrop = function (p) {
    var d = drops[String(p.id)];
    if (!d) return null;
    var a = norm(d.nombre), b = norm(p.nombre);
    if (a && b && a.slice(0, 14) !== b.slice(0, 14)) return null;
    var cur = d.plataforma === 'amazon' ? p.precioAmz : p.precioML;
    if (typeof cur === 'number' && Math.abs(cur - d.ahora) > 1) return null;
    return d;
  };
  window.cmxDropBadge = function (d) {
    return '<div class="cmx-drop" title="Bajó ' + money(d.ahorro) + ' desde ' + money(d.antes) + '"><b>↓ ' + d.pct + '%</b><span>Bajó ' + money(d.ahorro) + '</span><s>Antes ' + money(d.antes) + '</s></div>';
  };

  // Participa en el filtro común de la página (cmxPass), solo cuando el usuario activa el chip
  window.cmxPassers.push(function (p) { hooked = true; return !dropOnly || !!window.cmxGetDrop(p); });

  function wrapCards() {
    if (NATIVE) return;
    ['cardHTML', 'cardHtml'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig.__cmx) return;
      var w = function (p) {
        var h = orig.apply(this, arguments);
        var d = p && window.cmxGetDrop(p);
        if (!d || typeof h !== 'string') return h;
        // Etiqueta de apertura de la tarjeta, respetando comillas (un onclick puede traer ">")
        var badge = window.cmxDropBadge(d);
        return h.replace(/^\s*<(?:div|article)\b(?:[^>"']|"[^"]*"|'[^']*')*>/, function (open) { return open + badge; });
      };
      w.__cmx = true;
      window[name] = w;
    });
  }

  function rerender() {
    if (typeof window.render === 'function') window.render();
    if (typeof window.cmxKeepInView === 'function') window.cmxKeepInView();
  }

  function addChip() {
    if (NATIVE || chip || document.getElementById('cmx-fp') || !hooked) return;
    var g = document.getElementById('grid');
    if (!g) return;
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cmx-drop-chip';
    chip.innerHTML = '<span aria-hidden="true">↓</span> Bajó de precio';
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', function () {
      dropOnly = !dropOnly;
      chip.classList.toggle('on', dropOnly);
      chip.setAttribute('aria-pressed', String(dropOnly));
      rerender();
    });
    var anchor = g.closest('.grid-wrap') || g;
    anchor.parentNode.insertBefore(chip, anchor);
  }

  function load() {
    fetch('/assets/data/bajadas.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var arr = (j && j.categorias && j.categorias[key]) || [];
      arr.forEach(function (d) { drops[String(d.id)] = d; });
      var any = list().some(function (p) { return window.cmxGetDrop(p); });
      document.dispatchEvent(new Event('cmx:drops'));
      if (!any) return;
      if (!NATIVE) { wrapCards(); rerender(); addChip(); }
    }).catch(function () {});
  }

  function start() { wrapCards(); load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
