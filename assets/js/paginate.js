/* comparalo.mx — "Mostrar más" para listados largos.
   Cada página llama cmxPaginate(grid, lista) dentro de render() y pinta solo lo que devuelve.
   Los filtros, el orden y el comparador siguen actuando sobre la lista completa. */
(function () {
  var PAGE = 24;
  var shown = PAGE;
  var sig = '';
  var box = null;

  function ensureBox(grid) {
    if (box && box.parentNode) return box;
    box = document.createElement('div');
    box.className = 'cmx-more';
    box.innerHTML = '<button type="button" class="cmx-more-btn"></button>';
    grid.parentNode.insertBefore(box, grid.nextSibling);
    box.firstChild.addEventListener('click', function () {
      shown += PAGE;
      try { if (typeof window.gtag === 'function') window.gtag('event', 'show_more', { event_category: 'listado', page_path: location.pathname, shown: shown }); } catch (e) {}
      if (typeof window.render === 'function') window.render();
    });
    return box;
  }

  window.cmxPaginate = function (grid, lista) {
    var s = lista.length + ':' + lista.map(function (p) { return p && p.id; }).join(',');
    if (s !== sig) { sig = s; shown = PAGE; }
    var box = ensureBox(grid);
    var rest = lista.length - shown;
    if (rest > 0) {
      box.hidden = false;
      box.firstChild.textContent = 'Mostrar ' + Math.min(PAGE, rest) + ' más (' + rest + ' restantes)';
      var info = document.getElementById('result-info');
      if (info) info.textContent += ' · mostrando ' + shown;
      return lista.slice(0, shown);
    }
    box.hidden = true;
    return lista;
  };
})();
