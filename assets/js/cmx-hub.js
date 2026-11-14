/* comparalo.mx — comportamiento de las páginas de categoría (hub) del rediseño.
   1. Carrusel "Ofertas destacadas": lee los descuentos.json que la página declara en
      <div id="hub-deals" data-sources='["/ruta/descuentos.json", ...]' data-section="...">.
      Solo ofertas de Mercado Libre con precio anterior comprobado; nunca precios ni botones de Amazon.
   2. Formulario "Solicitar comparativa": envía al mismo Google Form de siempre, sin salir de la página. */
(function () {
  'use strict';
  var fmt = function (n) { return '$' + Number(n).toLocaleString('es-MX'); };
  var esc = function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var ga = function (name, params) { if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} } };
  var CHEV = function (pts) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="' + pts + '"/></svg>'; };

  function deals() {
    var box = document.getElementById('hub-deals');
    if (!box) return;
    var sources = [];
    try { sources = JSON.parse(box.getAttribute('data-sources') || '[]'); } catch (e) {}
    var section = box.getAttribute('data-section') || 'hub_ofertas';
    Promise.all(sources.map(function (u) {
      return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (res) {
      var all = [];
      res.forEach(function (j) {
        (j && Array.isArray(j.descuentos) ? j.descuentos : []).forEach(function (d) {
          if (!d || d.plataforma === 'amazon' || !d.linkML || !d.imagen || !d.pct || !d.precioAntes) return;
          if (/amazon./i.test(d.imagen)) return; // sin fotos alojadas en Amazon
          all.push(d);
        });
      });
      all.sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); });
      all = all.slice(0, 12);
      if (!all.length) return;
      box.innerHTML = '<div class="hub-deals-outer"><div class="hub-deals-track" role="list">' + all.map(function (d) {
        var precio = d.precioOferta || d.precioML, baja = d.ahorro || (d.precioAntes - precio);
        return '<a class="hub-deal" role="listitem" href="' + esc(d.linkML) + '" target="_blank" rel="sponsored nofollow noopener" data-ga-label="' + esc(d.nombre) + '" data-ga-val="' + precio + '">'
          + '<span class="hub-deal-img"><img src="' + esc(d.imagen) + '" alt="' + esc(d.nombre) + '" loading="lazy" referrerpolicy="no-referrer"></span>'
          + '<span class="hub-deal-bad"><span class="hub-pct">&#8722;' + d.pct + '%</span><span class="hub-drop">&#8595; Bajó ' + fmt(baja) + '</span></span>'
          + '<span class="hub-deal-name">' + esc(d.nombre) + '</span>'
          + '<span class="hub-deal-price"><b>' + fmt(precio) + ' MXN</b><s>' + fmt(d.precioAntes) + ' MXN</s></span>'
          + '<span class="hub-deal-btn"><img class="hub-ml-ic" src="/logomercado.png" alt=""> Ver en Mercado Libre <span aria-hidden="true">&#8599;</span></span></a>';
      }).join('') + '</div>'
        + '<button type="button" class="hub-arrow hub-arrow-prev" aria-label="Ofertas anteriores">' + CHEV('15 18 9 12 15 6') + '</button>'
        + '<button type="button" class="hub-arrow hub-arrow-next" aria-label="Más ofertas">' + CHEV('9 18 15 12 9 6') + '</button>'
        + '</div><div class="hub-dots" aria-hidden="true"></div>';

      var track = box.querySelector('.hub-deals-track'), prev = box.querySelector('.hub-arrow-prev'), next = box.querySelector('.hub-arrow-next'), dots = box.querySelector('.hub-dots');
      track.addEventListener('click', function (e) {
        var a = e.target.closest('.hub-deal');
        if (a) ga('affiliate_click_ml', { event_category: 'afiliado', event_label: a.getAttribute('data-ga-label') || '', value: parseFloat(a.getAttribute('data-ga-val')) || 0, page_section: section });
      });
      function pages() { return Math.max(1, Math.round(track.scrollWidth / Math.max(1, track.clientWidth))); }
      function update() {
        prev.setAttribute('aria-disabled', track.scrollLeft <= 4 ? 'true' : 'false');
        next.setAttribute('aria-disabled', track.scrollLeft + track.clientWidth >= track.scrollWidth - 4 ? 'true' : 'false');
        var n = Math.min(pages(), 6), cur = Math.min(n - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
        if (dots.children.length !== n) { dots.innerHTML = new Array(n + 1).join('<i></i>'); }
        [].forEach.call(dots.children, function (el, i) { el.className = i === cur ? 'on' : ''; });
      }
      prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }); });
      next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }); });
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      var sec = box.closest('[hidden]');
      if (sec) sec.hidden = false;
      requestAnimationFrame(update);
    });
  }

  function form() {
    var f = document.getElementById('hub-form');
    if (!f) return;
    var msg = document.getElementById('hub-form-msg'), btn = f.querySelector('button[type=submit]'), sink = document.getElementById('hub-form-sink');
    var started = false, sending = false;
    f.addEventListener('focusin', function () {
      if (started) return; started = true;
      ga('leads_form_start', { event_category: 'leads', event_label: location.pathname });
    });
    f.addEventListener('submit', function () {
      // La validación nativa (required, type=email) ya pasó si llegamos aquí.
      sending = true; btn.disabled = true;
      msg.className = 'hub-form-msg'; msg.textContent = 'Enviando…';
      ga('leads_form_submit', { event_category: 'leads', event_label: location.pathname });
      setTimeout(function () { if (sending) done(); }, 6000);
    });
    function done() {
      if (!sending) return; sending = false; btn.disabled = false;
      msg.className = 'hub-form-msg ok';
      msg.textContent = '¡Listo! Recibimos tu solicitud. Te avisaremos por correo cuando la comparativa esté lista.';
      f.reset();
    }
    if (sink) sink.addEventListener('load', done);
  }

  function start() { deals(); form(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
