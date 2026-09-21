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

  /* ── Auto-tracking global de afiliados ──────────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;

    /* Deduplicación: si este elemento ya fue registrado en este ciclo, omitir */
    if (a._cmxTracked) return;

    var href = a.getAttribute('href') || '';
    var isAmz = /amazon\.com\.mx|amzn\.to/i.test(href);
    var isML  = /mercadolibre\.com\.mx|meli\.la/i.test(href);
    if (!isAmz && !isML) return;

    /* Marcar y limpiar tras el ciclo del evento */
    a._cmxTracked = true;
    setTimeout(function () { a._cmxTracked = false; }, 500);

    /* Contexto del producto */
    var params = { platform: isAmz ? 'amazon' : 'mercado_libre' };
    if (a.dataset && a.dataset.gaLabel) params.product_name = a.dataset.gaLabel;

    var card = a.closest('[data-product-id],[data-product-name]') || a.closest('.card');
    if (card && card.dataset) {
      if (card.dataset.productId   && !params.product_id)   params.product_id   = card.dataset.productId;
      if (card.dataset.productName && !params.product_name) params.product_name = card.dataset.productName;
      if (card.dataset.brand)                               params.brand        = card.dataset.brand;
    }

    var cat = document.body && document.body.dataset && document.body.dataset.category;
    if (cat) params.category = cat;

    window.trackEvent(isAmz ? 'affiliate_click_amazon' : 'affiliate_click_ml', params);

  }, true); /* true = fase de captura → dispara antes que onclick inline */

})();
