/* comparalo.mx — al cambiar un filtro u orden, deja visibles los productos filtrados.
   Sin esto, si el usuario había bajado por la página y la lista se acorta, el navegador lo deja
   en el texto de abajo y tiene que subir para ver los resultados. */
(function () {
  var FILTER_UI = '#cmx-fp, .prt-filters, .crt-filters, .aud-filters';
  var SORT_UI = '#sort-sel, #sortSel, .aud-sort-row select';

  window.cmxKeepInView = function () {
    var g = document.getElementById('grid');
    if (!g) return;
    setTimeout(function () {
      var top = g.getBoundingClientRect().top + window.scrollY;
      var strip = document.querySelector('.how-strip');
      var stuck = strip && getComputedStyle(strip).position === 'sticky' ? strip.offsetHeight : 0;
      var target = Math.max(0, top - 64 - stuck - 16);
      if (window.scrollY > target) window.scrollTo(0, target);
    }, 60);
  };

  document.addEventListener('change', function (e) {
    if (e.target.closest && (e.target.closest(FILTER_UI) || e.target.closest(SORT_UI))) window.cmxKeepInView();
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest(FILTER_UI + ' button, ' + FILTER_UI + ' .chip, ' + FILTER_UI + ' [role="button"]');
    if (t && !t.classList.contains('cmx-fp-more') && !t.classList.contains('cmx-fp-close')) window.cmxKeepInView();
  }, true);
})();
