# Eventos y GA4 en las guías

## 1. Cómo está implementado (auditado el 15-nov-2026)

- **gtag.js directo**, propiedad `G-9TKZ4ER13X`, en el `<head>` de cada página. No hay Google Tag
  Manager. `?bot=claude` desactiva la medición.
- `/assets/js/analytics.js` (**no se modifica**) expone `trackEvent(nombre, params)`,
  `buildComparisonId(ids)` y dispara solo `comparison_section_view` cuando un contenedor con
  `data-ga-section="comparison"` entra 40 % en pantalla. Su auto-tracking de afiliados está
  **desactivado**: cada botón mide con su propio `onclick`.
- `page_view` lo manda `gtag('config')`: las visitas a cada guía **ya se miden** por ruta.

### Eventos que ya existen (no renombrar)

| Evento | Dónde | Parámetros en uso |
|---|---|---|
| `affiliate_click_ml` | Todo el sitio (225 usos) | `event_category:'afiliado'`, `event_label` (nombre del producto), `value` (precio), `page_section`; algunas guías usan `location` en vez de `page_section` |
| `affiliate_click_amazon` | Páginas con Amazon | igual |
| `cta_click` | Guías (68 usos) | `cta`, `location` |
| `select_product` | Guías de celulares | `item_id`, `item_name`, `page` |
| `compare_start`, `compare_2_products`, `compare_3_products` | Guías y categorías | `comparison_id`, `count` |
| `comparison_section_view` | `analytics.js` | `page_path`, `category` |
| `click_fab` | Guías de cafeteras/bicis | `event_category:'mob_fab'`, `event_label` (`toc`, `sheet_ver_todas`…) |
| `click_toc_aside` | Cafeteras, laptops | `event_category:'aside'`, `event_label:'toc_card'` |
| `scroll_profundidad` | 4 guías | `porcentaje`, `pagina` |
| `guide_open` | **Listados de categoría** (abrir "cómo elegir") | `page_section`, `guide_type` |

Variantes sueltas que conviene no propagar: `affiliate_click_amz`, `click_ml`, `nav_click`,
`guia_comparar`, `guia_seleccion`, `guia_filtro`, `guia_configurador`, `click_comparar_<cat>`.

### Inconsistencias detectadas
- `affiliate_click_ml` lleva tres formas dentro de una misma guía: `event_label` con el nombre del
  producto en unas partes y con el código del enlace (`ml-1YNrnqo`) en la tabla; `page_section` en
  unas y `location` en otras. En GA4 eso parte los informes.
- Varios `onclick="gtag(…)"` sin `typeof gtag==='function'`: si un bloqueador impide gtag, lanzan
  error (no impiden la navegación, pero ensucian la consola).
- Ninguna guía mide índice, secciones ni apertura de ofertas de forma uniforme.

## 2. Estructura recomendada (compatible con lo existente)

Principio: **conservar los nombres que ya alimentan informes** y añadir una familia `guide_*` solo
para lo que hoy no se mide.

| Interacción | Evento | Estado |
|---|---|---|
| Visita a la guía | `page_view` (automático) | Conservado. No crear `guide_view`: duplicaría `page_view` |
| Abrir índice | `guide_index_open` | **Nuevo** |
| Ir a una sección | `guide_section_click` | **Nuevo** |
| Abrir ofertas | `guide_offers_open` | **Nuevo** |
| Consultar producto (ir a su análisis / abrir ficha) | `guide_product_click` | **Nuevo** |
| Seleccionar producto para comparar | `select_product` | Conservado (+ parámetros comunes). No crear `guide_compare_select` |
| Quitar producto | `guide_compare_remove` | **Nuevo** |
| Abrir panel/barra de comparación | `guide_compare_open` | **Nuevo** |
| Ver comparativa completa | `compare_start` (+ `compare_2_products` / `compare_3_products`) | Conservado |
| Clic a Mercado Libre | `affiliate_click_ml` | Conservado. No crear `affiliate_outbound_click` |
| Ver más ofertas / ir a categoría / otros CTA | `cta_click` | Conservado, con `cta` descriptivo |

No usar `guide_open` en guías: ya significa otra cosa en los listados.

### Parámetros comunes

Nombres en ASCII (GA4 no admite acentos: `guía_title` no es válido), ≤40 caracteres.

| Parámetro | Valor | En qué eventos |
|---|---|---|
| `guide_id` | slug de la guía (`mejores-celulares-menos-5000`) | todos |
| `guide_category` | categoría madre (`celulares`) | todos |
| `section_id` | `id` de la sección (`sec-comparativa`) | `guide_section_click` |
| `item_id` | `dbId` de `merged-admin.json` | producto, selección, afiliado |
| `item_name` | nombre del producto | producto, selección, afiliado |
| `position` | posición 1..n en su lista | producto, afiliado, ofertas |
| `page_section` | dónde ocurrió: `tabla`, `ficha`, `analisis`, `ofertas`, `barra_movil`, `indice`, `conclusion`… | todos |
| `action_type` | `open` / `close` / `add` / `remove` solo cuando haga falta distinguir | paneles |
| `is_offer` | `true` si el clic sale de «Ofertas del día» | afiliado |

`affiliate_click_ml` conserva además `event_category:'afiliado'`, `event_label` (= nombre del
producto) y `value` (precio) para no romper los informes actuales.

No se envía nada personal: ni correo, ni texto de búsqueda libre, ni identificadores de usuario.

### Implementación
- En las guías nuevas los eventos salen de **un solo lugar**: `assets/js/cmx-guia.js`, con un
  listener delegado que lee atributos `data-ga-ev` / `data-ga-*` del elemento. Sin `onclick` en
  línea repetidos. `cmx-guia.js` usa `window.trackEvent` (de `analytics.js`).
- `<body data-guide-id="…" data-category="…">` da los parámetros comunes.
- Un elemento, un evento: si se migra un botón que tenía `onclick="gtag(…)"`, se quita el `onclick`
  en el mismo cambio para no disparar doble.
- La barra móvil usa `data-nav="index|offers|compare|category"`; el nombre del evento no depende de
  la etiqueta visible, así «Android» y «Cafeteras» se miden igual.

### Lo que requiere autorización de Alan
1. Unificar `location` → `page_section` y `event_label` = nombre del producto en
   `affiliate_click_ml` de la guía que se esté tocando (cambia parámetros, no el nombre).
2. Añadir la familia `guide_*`.
3. Registrar en GA4 (Administrar → Definiciones personalizadas) las dimensiones `guide_id`,
   `guide_category`, `section_id`, `page_section`, `item_id`, `position`. Sin ese registro los
   parámetros llegan pero no aparecen en los informes. Esto lo hace Alan en la consola de GA4.

## 3. Validación
1. Abrir la guía local y, en la consola: `dataLayer.filter(e => e[0]==='event').map(e => [e[1], e[2]])`
   después de pulsar cada control. Cada interacción debe dar **una** entrada.
2. En producción: GA4 → Administrar → DebugView, o Informes → Tiempo real.
3. Entregar el inventario: evento, disparador, parámetros, conservado/nuevo.
