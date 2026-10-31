/* comparalo.mx — el texto editorial de las guías muestra el mismo precio que las tarjetas.
 *
 * Las guías ya bajan /celulares/catalog-mini.json para refrescar sus tarjetas, pero la tabla,
 * las fichas y las tarjetas "decide" llevaban el precio escrito a mano, así que la misma página
 * podía enseñar dos cifras distintas del mismo celular (oct-2026: el Pixel 9a salía a $8,999 en
 * la ficha y a $20,794 en la tarjeta de abajo).
 *
 * Este módulo pinta esos puntos con el mismo mapa que ya usan las tarjetas. Si un producto no
 * tiene precio vivo, se quita el número en lugar de dejar uno congelado.
 *
 * La guía lo llama dentro del fetch que ya tiene:  cmxPreciosGuia(familias, mapaPorLinkML)
 * Cada precio del HTML se marca con data-cmx-precio="<modeloBase>".
 */
(function () {
  function fmt(n) { return '$' + Number(n).toLocaleString('es-MX'); }

  function primerTexto(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return n;
    return null;
  }

  // Acepta las dos formas que usan las guías: {modeloBase, variantes:[{linkML}]} y {id, linkML}.
  function idDe(f) { return f.modeloBase || f.id; }
  function linkDe(f) { return f.linkML || (f.variantes && f.variantes[0] && f.variantes[0].linkML) || null; }

  // El aviso solo tiene sitio donde el precio va suelto. En la tabla, en la barra lateral
  // y en la tarjeta del comparador el hueco es de una línea y no cabe.
  var SIN_AVISO = ['tbl-price', 'aside-prod-price', 'pcard-price'];

  function aviso(el, texto) {
    var sig = el.nextElementSibling;
    if (sig && sig.className === 'cmx-rango') sig.parentNode.removeChild(sig);
    if (!texto) return;
    for (var i = 0; i < SIN_AVISO.length; i++) if (el.classList.contains(SIN_AVISO[i])) return;
    var s = document.createElement('span');
    s.className = 'cmx-rango';
    s.textContent = texto;
    el.parentNode.insertBefore(s, el.nextSibling);
  }

  // rango: {min, max} del título de la guía. Si el precio de hoy se sale, se dice.
  window.cmxPreciosGuia = function (familias, mapa, rango) {
    if (!familias || !mapa) return;
    familias.forEach(function (f) {
      var link = linkDe(f);
      var vivo = link ? mapa[link] : null;
      var nodos = document.querySelectorAll('[data-cmx-precio="' + idDe(f) + '"]');

      for (var i = 0; i < nodos.length; i++) {
        var el = nodos[i];

        if (vivo == null) {
          // Sin dato vivo no se deja una cifra vieja: deja de haber precio en ese punto.
          aviso(el, null);
          if (el.classList.contains('cmx-precio-nd')) continue;
          el.classList.add('cmx-precio-nd');
          el.textContent = 'Ver en Amazon';
          continue;
        }

        var t = primerTexto(el);
        if (!t || !/\$[\d,]+/.test(t.nodeValue)) continue;
        // Se sustituye el nodo entero, no solo la cifra: hay celdas con rango o prefijo
        // ("desde ~$2,900", "~$3,800–$4,500") donde un reemplazo parcial dejaría un texto roto.
        t.nodeValue = fmt(vivo) + (/MXN/.test(t.nodeValue) ? ' MXN' : '');

        // "Precio visto: octubre 2026" deja de ser cierto en cuanto se refresca el número.
        var small = el.querySelector('small');
        if (small && /precio visto/i.test(small.textContent)) {
          small.textContent = 'Precio de Mercado Libre, se actualiza a diario';
        }

        // Si hoy se salió del rango que promete el título, que lo diga la propia ficha.
        aviso(el, !rango ? null
          : rango.max && vivo > rango.max ? 'Hoy está en ' + fmt(vivo) + ', por encima de los ' + fmt(rango.max) + ' de esta guía.'
          : rango.min && vivo < rango.min ? 'Hoy está en ' + fmt(vivo) + ', por debajo de los ' + fmt(rango.min) + ' de esta guía.'
          : null);
      }
    });
  };
})();
