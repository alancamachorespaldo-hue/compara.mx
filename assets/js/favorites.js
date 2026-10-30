/* comparalo.mx — favoritos ("Guardados"), mismo patrón que suplementos/proteina:
   corazón en cada tarjeta, guardado en localStorage del navegador (no sale del dispositivo),
   y la sección "Guardados" en el panel de filtros con "Ver solo guardados". */
(function () {
  var cat = location.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '_');
  if (!cat) return;
  var KEY = 'comparalo:fav:' + cat;
  var favs = load();
  var soloFavs = false;
  var countEls = [];

  function load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
  }
  function save() {
    var arr = []; favs.forEach(function (v) { arr.push(v); });
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function has(id) { return favs.has(String(id)); }

  window.cmxPassers = window.cmxPassers || [];
  window.cmxPass = window.cmxPass || function (p) { return window.cmxPassers.every(function (f) { return f(p); }); };
  window.cmxPassers.push(function (p) { return !soloFavs || has(p.id); });

  var ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  function toggle(id) {
    id = String(id);
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    save();
    paint();
    updateCount();
    try { if (typeof gtag === 'function') gtag('event', favs.has(id) ? 'save_product' : 'unsave_product', { item_id: id, page_section: cat }); } catch (e) {}
    if (soloFavs && typeof window.render === 'function') window.render();
  }

  function cardId(card) { return (card.id || '').replace(/^card-/, ''); }

  function ensureBtn(card) {
    var btn = card.querySelector(':scope > .fav-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-btn';
      btn.innerHTML = ICON;
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(cardId(card)); });
      card.insertBefore(btn, card.firstChild);
    }
    return btn;
  }

  function paint() {
    [].forEach.call(document.querySelectorAll('#grid .card[id]'), function (card) {
      var btn = ensureBtn(card);
      var on = has(cardId(card));
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? 'Quitar de guardados' : 'Guardar producto';
    });
  }

  function updateCount() {
    countEls.forEach(function (el) { el.textContent = favs.size; });
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; paint(); });
  }

  /* El panel de filtros (filters-panel.js) inserta esto entre "Disponibilidad" y "Ofertas". */
  window.cmxBuildFavSection = function () {
    var sec = document.createElement('div');
    sec.className = 'cmx-fp-sec';
    sec.innerHTML = '<h3>Guardados</h3>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmx-fp-favtoggle';
    btn.innerHTML = '♥ Ver solo guardados <span class="cmx-fp-n"></span>';
    var count = btn.querySelector('.cmx-fp-n');
    count.textContent = favs.size;
    countEls.push(count);
    btn.addEventListener('click', function () {
      soloFavs = !soloFavs;
      btn.classList.toggle('on', soloFavs);
      if (typeof window.render === 'function') window.render();
      if (typeof window.cmxKeepInView === 'function') window.cmxKeepInView();
    });
    sec.appendChild(btn);
    return sec;
  };

  function start() {
    paint();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
