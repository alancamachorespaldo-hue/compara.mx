/**
 * comparalo.mx — cargador del buscador de categorías.
 *
 * Antes este archivo también mostraba el modal de onboarding; se retiró (nov-2026).
 * Se conserva el nombre porque todas las páginas ya lo cargan (check-site.js y sync-site.js
 * dependen de él) y de aquí se carga /js/nav-search.js.
 */
(function () {
  var s = document.createElement('script');
  s.src = '/js/nav-search.js';
  document.head.appendChild(s);
})();
