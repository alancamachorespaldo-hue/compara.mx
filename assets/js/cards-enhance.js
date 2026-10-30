/* comparalo.mx — mejoras compartidas de las tarjetas de producto:
   - "Mejor precio" en la tienda más barata de cada tarjeta con dos tiendas.
   - Tooltip accesible del círculo de "elegir para comparar" (el círculo en sí es CSS puro, ver cards.css). */
(function () {
  var queued = false;

  function num(t) {
    var n = String(t || '').replace(/[^0-9.]/g, '');
    return n ? parseFloat(n) : NaN;
  }

  function mark(card) {
    if (card.getAttribute('data-cmx-cheap') === '1') return;
    var cols = card.querySelectorAll('.card-btn-col');
    if (cols.length !== 2) return;
    var vals = [].map.call(cols, function (c) {
      var p = c.querySelector('.card-btn-col-price');
      return p ? num(p.textContent) : NaN;
    });
    if (isNaN(vals[0]) || isNaN(vals[1]) || vals[0] === vals[1]) return;
    var win = vals[0] < vals[1] ? 0 : 1;
    var price = cols[win].querySelector('.card-btn-col-price');
    if (price.querySelector('.cmx-cheap')) return;
    var chip = document.createElement('span');
    chip.className = 'cmx-cheap';
    chip.textContent = 'Mejor precio';
    price.appendChild(chip);
    card.setAttribute('data-cmx-cheap', '1');
  }

  function label(card) {
    var on = card.classList.contains('selected');
    var t = on ? 'Quitar de comparar' : 'Elegir para comparar';
    if (card.title !== t) card.title = t;
  }

  function run() {
    queued = false;
    [].forEach.call(document.querySelectorAll('.card'), function (c) { mark(c); label(c); });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  function start() {
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
