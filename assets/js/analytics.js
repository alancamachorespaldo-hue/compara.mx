/* comparalo.mx — Global Analytics Helper v1.0
 *
 * Exposes:
 *   window.trackEvent(name, params)  — wrapper seguro sobre gtag()
 *   window.buildComparisonId(ids[])  — ID estable para una comparación
 *
 * Auto-tracking de afiliados (captura global):
 *   Detecta clics a Amazon/ML por URL real y dispara:
 *     affiliate_click_amazon  |  affiliate_click_ml
 *   No requiere onclick por producto. Funciona automáticamente
 *   para cualquier <a href="...amazon.com.mx..."> o <a href="...meli.la...">
 *
 * Enriquecimiento de contexto (opcional):
 *   · data-ga-label="Nombre del producto"  en el <a>
 *   · data-category="categoria_slug"       en el <body>
 *   · data-product-id="slug"               en la .card contenedora
 *   · data-product-name="Nombre"           en la .card contenedora
 *   · data-brand="Marca"                   en la .card contenedora
 *
 * Para evitar doble disparo:
 *   Si el inline onclick del botón ya llama a trackEvent() para el mismo
 *   evento, añade event.stopPropagation() en ese onclick y elimina la
 *   llamada a trackEvent() — este helper se encarga desde la fase de
 *   captura (antes de que stopPropagation tenga efecto en bubbling).
 *   Un flag interno (_cmxTracked) previene el doble disparo.
 *
 * Eventos de comparador (llamar manualmente desde cada página):
 *   trackEvent('select_product',    { item_id, item_name, brand, category, selection_count })
 *   trackEvent('compare_start',     { comparison_id, products_compared, product_count, category })
 *   trackEvent('compare_2_products',{ comparison_id, products_compared, product_count, category })
 *   trackEvent('compare_3_products',{ comparison_id, products_compared, product_count, category })
 *
 * --- CÓMO AGREGAR UN PRODUCTO NUEVO ---
 *   1. Añade el objeto al array de productos de la página con:
 *        linkAmz: 'https://www.amazon.com.mx/dp/...'   (si tiene Amazon)
 *        linkML:  'https://meli.la/...'                 (si tiene ML)
 *   2. El enlace queda medido automáticamente. Sin código extra.
 *   3. Para riqueza de datos añade data-ga-label="nombre" en el <a>.
 *
 * --- PARA HACER UN PRODUCTO COMPARABLE ---
 *   Asegúrate de que el objeto tenga un campo único (modeloBase / id / slug).
 *   Llama trackEvent('select_product', {...}) cuando se seleccione,
 *   y trackEvent('compare_start'/'compare_2_products'/'compare_3_products', {...})
 *   al abrir la comparación.  buildComparisonId([id1, id2]) genera el ID estable.
 *
 * --- PARA MEDIR comparison_section_view EN UNA NUEVA CATEGORÍA ---
 *   Añade data-ga-section="comparison" al contenedor principal del comparador:
 *     <div class="grid-wrap" data-ga-section="comparison">
 *   El observer global lo detecta automáticamente y dispara el evento
 *   una sola vez cuando el 40 % del contenedor entra en el viewport.
 */
(function () {
  'use strict';

  /* ── Helper principal ───────────────────────────────────────────── */
  window.trackEvent = function (name, params) {
    try {
      if (typeof gtag === 'function') gtag('event', name, params || {});
    } catch (e) {}
  };

  /* ── ID de comparación ──────────────────────────────────────────── */
  window.buildComparisonId = function (ids) {
    return [].concat(ids).sort().join('__');
  };

  /* ── Auto-tracking global de afiliados ──────────────────────────────
   * DESACTIVADO: el tracking de afiliados se maneja con onclick inline
   * en cada botón de producto usando affiliate_click_amazon / affiliate_click_ml.
   * Esto evita doble disparo y asegura que el evento siempre lleva el
   * nombre correcto independientemente del formato de la URL del enlace.
   * ─────────────────────────────────────────────────────────────────── */

  /* ── comparison_section_view ────────────────────────────────────── */
  /* Dispara UNA SOLA VEZ cuando [data-ga-section="comparison"] entra
   * al viewport con al menos 40 % visible.
   * Para activarlo en cualquier página: añade data-ga-section="comparison"
   * al contenedor principal del comparador (p.ej. <div class="grid-wrap">). */
  if (typeof IntersectionObserver !== 'undefined') {
    var _cmpObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        _cmpObserver.unobserve(entry.target); /* dispara solo una vez */
        var cat = document.body && document.body.dataset && document.body.dataset.category;
        var params = { page_path: window.location.pathname };
        if (cat) params.category = cat;
        window.trackEvent('comparison_section_view', params);
      });
    }, { threshold: 0.4 });

    /* Observar en cuanto el DOM esté listo */
    function _initCmpObserver() {
      var el = document.querySelector('[data-ga-section="comparison"]');
      if (el) _cmpObserver.observe(el);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _initCmpObserver);
    } else {
      _initCmpObserver();
    }
  }

})();

