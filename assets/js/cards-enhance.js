/* comparalo.mx — marca "Más barato" en la tienda con el menor precio de cada tarjeta.
   Solo compara los dos precios que la tarjeta ya muestra; no cambia datos ni enlaces. */
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
    chip.textContent = 'Más barato';
    price.appendChild(chip);
    card.setAttribute('data-cmx-cheap', '1');
  }

  var V2 = document.documentElement.getAttribute('data-cmx-layout') === 'v2';

  function tag(card) {
    if (!V2 || card.querySelector('.cmx-store-tag')) return;
    var ml = !!card.querySelector('.btn-ml'), amz = !!card.querySelector('.btn-amz');
    if (!ml && !amz) return;
    var t = document.createElement('div');
    t.className = 'cmx-store-tag';
    t.innerHTML = (ml ? '<span class="ml">Mercado Libre</span>' : '') + (amz ? '<span class="amz">Amazon</span>' : '');
    card.insertBefore(t, card.firstChild);
  }

  function run() {
    queued = false;
    [].forEach.call(document.querySelectorAll('.card'), function (c) { mark(c); tag(c); });
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
