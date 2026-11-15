---
name: guia-ml-noviembre-2026
description: >
  Procedimiento oficial de comparalo.mx para crear, actualizar, rediseñar y mantener las guías de
  compra con enlaces de afiliado de Mercado Libre (carpeta /guias/): diseño de tres columnas en
  escritorio (índice · artículo · Ofertas del día), experiencia móvil con barra inferior
  (Índice · Ofertas · Compáralo · Categoría), integración editorial de productos, comparativa,
  SEO, eventos GA4 y revisión de disponibilidad de productos en Mercado Libre. Úsala cuando Alan
  diga "crea una guía de X", "actualiza la guía de Y", "rediseña la guía", "pasa esta guía al
  diseño nuevo", "revisa los productos de la guía", "revisa los eventos de la guía" o
  "¿qué guías tienen productos caídos?". NO es para las guías de Amazon de /guias-compra/
  (esas usan la skill crear-guia-ofertas).
---

# Skill: guia-ml-noviembre-2026

Sistema editorial de las guías de Mercado Libre de comparalo.mx. Una guía debe ayudar a
**investigar, comprender, comparar y decidir**; el diseño se adapta al contenido, nunca al revés.

Sustituye a `crear-guia` para todo lo que sea guía con productos de Mercado Libre. `crear-guia`
queda solo como referencia histórica del CSS anterior.

## Alcance

| Sí | No |
|---|---|
| Guías en `/guias/<categoria>/<slug>/` con enlaces `meli.la` | Guías de Amazon en `/guias-compra/` → `crear-guia-ofertas` |
| Crear, actualizar, rediseñar, sumar productos, revisar precios/eventos/disponibilidad | Listados de categoría → `aplicar-plantilla-listado` / `crear-apartado` |

En estas guías **no hay botones de compra de Amazon**. Si la guía vieja trae alguno o un comentario
`<!-- PENDIENTE: link afiliado Amazon … -->`, se retira (los datos de Amazon siguen en
`merged-admin.json`; ver CLAUDE.md).

## Archivos de referencia (léelos cuando toque, no todos de golpe)

| Archivo | Cuándo leerlo |
|---|---|
| `referencias/diseno.md` | Antes de tocar HTML/CSS: escritorio, móvil, barra inferior, estados, densidad |
| `referencias/img/escritorio.webp`, `movil-1.webp`, `movil-2.webp` | Siempre que se maquete. **Son la especificación**; escritorio manda |
| `referencias/componentes-y-contenido.md` | Al integrar productos, estructurar el artículo, SEO y "Sigue explorando" |
| `referencias/ga4.md` | Antes de añadir o cambiar cualquier evento |
| `referencias/disponibilidad-ml.md` | Al revisar productos/IDs o cuando un producto dejó de existir |

## Reglas que nunca se rompen

1. **No inventar**: enlaces, precios, precios "antes", descuentos, calificaciones ni reseñas. Si el
   dato no está en `scripts/merged-admin.json`, `descuentos.json` o `assets/data/bajadas.json`, no
   se muestra. Las cifras de los mockups (★ 4.6, 4,892 reseñas, −14 %) son relleno de diseño.
2. **No reemplazar el artículo por texto genérico** ni recortar contenido para compactar.
3. **No sustituir ni retirar un producto sin aprobación de Alan** (ver `disponibilidad-ml.md`).
4. **No cambiar nombres ni parámetros de eventos GA4 existentes sin autorización**; no tocar
   `/assets/js/analytics.js`.
5. Todo lo de CLAUDE.md sigue vigente: GA4 `G-9TKZ4ER13X`, `onboarding.js`, sin frameworks, URLs
   con slash final, bloques `cmx-*` solo vía `sync-site.js`, reglas de git (sin `stash`, archivos
   por nombre, `check-site.js` antes del push).
6. **Fidelidad a los mockups, una guía a la vez**: al terminar una guía se detiene, se enseñan
   capturas y se espera aprobación antes de seguir con otra.

## Flujo de trabajo

### 0. Arranque
`git status` y `git pull --rebase`. Si hay cambios ajenos, no tocarlos. Identificar si es guía
**nueva** o **existente** y su categoría madre (define el 4.º botón móvil y los enlaces de vuelta).

### 1. Auditoría (siempre, antes de editar)
Para una guía existente, leerla **completa** y anotar:

- **Contenido**: H1/H2/H3, palabra clave principal y secundarias, FAQ (HTML y JSON-LD), enlaces
  internos, textos con precios escritos a mano fuera de `data-cmx-precio`.
- **Productos**: cada `dbId`, `modeloBase`, enlace `meli.la`, precio, imagen. Cruzarlos con
  `scripts/merged-admin.json` (`mlId`, `precioML`, `estadoML`, `activo`, `pausaML`) y con
  `scripts/ml-report.json` y `scripts/guias-precios-report.json`.
- **Eventos**: `grep -oE "(gtag\('event',|trackEvent\()\s*'[a-z0-9_]+'" <guía>` y sus parámetros.
- **Funcionamiento**: que los ids que pasan los botones de selección sean los mismos que usa el
  array de datos; que las anclas internas existan; que los "precios antes" tengan fuente.

Entregar el resultado a Alan con: qué se conserva, qué se corrige, qué productos requieren
atención y qué decisiones necesita tomar. **No se edita hasta que apruebe** si hay cambios de
productos, de precios escritos a mano o de eventos.

### 2. Estructura editorial
Proponer el índice según la intención de búsqueda (ver `componentes-y-contenido.md`). Conservar
todo el texto valioso; reordenar, no reescribir. Cada sección lleva `id` estable (`#sec-…`) porque
el índice, la barra móvil y GA4 dependen de él.

### 3. Maquetado
Aplicar `diseno.md` con los mockups a la vista. Reutilizar lo que ya existe:
`assets/css/cmx-site.css`, `assets/js/guias-precios.js` (precios vivos), `/celulares/comparar/` o
el comparador de la categoría madre, `descuentos.json` / `bajadas.json` para ofertas.
El CSS y JS comunes viven en `assets/css/cmx-guia.css` y `assets/js/cmx-guia.js`: **se enlazan,
no se copian** a cada guía.

### 4. Productos y enlaces
Datos desde `merged-admin.json`; cada familia declara `dbId` y cada precio lleva
`data-cmx-precio="<modeloBase>"` para que `sync-guias-precios.js` y `guias-precios.js` lo
mantengan. Botón amarillo con logotipo y texto **«Ver en Mercado Libre ↗»**,
`target="_blank" rel="sponsored nofollow noopener"`.

### 5. GA4
Seguir `ga4.md`: conservar lo existente, añadir solo los eventos aprobados, sin doble disparo.

### 6. SEO y enlazado
`<title>`, description, canonical, OG, JSON-LD (`Article` + `BreadcrumbList` + `FAQPage` idéntico
al FAQ visible), `dateModified` y "Actualizado" con la fecha real. Bloque final de guías
relacionadas: **primero guías de la misma categoría, después guías de categorías madre**
(ver `componentes-y-contenido.md` §6).

### 7. Sincronizar y validar
```bash
node scripts/sync-site.js
```
```bash
node scripts/sync-guias-precios.js
```
```bash
node scripts/check-site.js
```
Guía nueva: agregarla a `sitemap.xml` y al hub `/guias/`.

### 8. Verificación en navegador (obligatoria)
Servidor `sitio` de `.claude/launch.json`. Comprobar y capturar:

- **Escritorio ≥1200 px**: tres columnas; índice sticky sin scroll propio que estorbe; ofertas con
  su propio desplazamiento; barra de comparación con 0/1/2/3 productos.
- **Móvil 375 px**: header compacto, barra inferior con sus 4 accesos, panel de índice, panel de
  ofertas, panel Compáralo con 0/1/2/3 productos, sin scroll horizontal.
- Consola sin errores; cada botón amarillo abre su `meli.la`; cada evento aparece una sola vez
  (`window.dataLayer` o red `collect?`).
- Accesibilidad: foco visible, `aria-expanded` en paneles, `aria-current` en el índice, contraste.

### 9. Entrega
Reportar: archivos modificados, capturas escritorio/móvil, inventario de eventos (conservados /
nuevos), productos que requieren atención y decisiones pendientes. No hacer commit ni push sin
que Alan lo pida.

## Guía de referencia y archivos compartidos

- **Molde**: `guias/celulares/mejores-celulares-menos-5000/index.html` (primera guía con el
  sistema, 15-nov-2026). Para una guía nueva se copia su estructura de `<body>` y se cambia el
  contenido.
- `assets/css/cmx-guia.css` — todo el diseño (prefijo `cg-`). No se copia a la guía: se enlaza.
- `assets/js/cmx-guia.js` — selección y comparación, índice con sección activa, barra inferior y
  paneles, ofertas verificadas, precios vivos y **todos los eventos**. Se configura con
  `window.CMX_GUIA` (ver el comentario inicial del archivo) y con atributos `data-cg-*` /
  `data-ga-*`; la guía no lleva `onclick` en línea.
- Las ofertas salen de `assets/data/bajadas.json` cruzado con el `catalog-mini.json` de la
  categoría, filtradas al rango de precio de la guía. Si no hay, la caja pasa a «Precios de hoy».
- Categorías sin `catalog-mini.json` o con otro comparador: revisar su contrato y, si hace falta,
  ampliar `cmx-guia.js` (no bifurcarlo por guía).
- `guias-precios.js` (compartido) escribe «Ver en Amazon» cuando un producto pierde su precio vivo;
  `cmx-guia.js` lo corrige a «Consulta el precio en Mercado Libre» en estas guías.

## Reglas de coherencia con la categoría (pedidas por Alan, 15-nov-2026)

La guía debe verse y funcionar como el listado de su categoría madre (referencia: `/celulares/android/`):

- **Encabezado**: el del rediseño (`.cmx-hd2`: Categorías · Comparativas · Guías de compra · Ofertas ·
  Guardados · buscador). Se activa agregando la ruta de la guía a `GUIAS_V2` en `scripts/sync-site.js`.
- **Tipografía**: Satoshi en peso 800 para títulos, nombres, precios y botones; texto en 500. Nada delgado.
- **Logotipo real** (`/logopng.png`) en los títulos de sección, en el módulo «Compáralo» y en la barra
  móvil. No dibujar chevrones propios ni usar la balanza.
- **Tarjeta de producto**: la `cl-card` del listado (`/assets/css/cmx-list.css`), pintada por
  `cmx-guia.js`. No crear tarjetas distintas.
- **Comparativa**: la del listado de la categoría, abierta con `/<categoria>/#comparar=id1,id2…`.
  Nunca `/celulares/comparar/` (es la comparativa vieja). `modeloBase` de la guía = id del listado.
- **Hasta 5 productos** por comparación en guías (`max: 5`); el listado sigue eligiendo hasta 3.
- **Todo producto citado se puede comparar**: tabla, respuesta rápida, fichas, análisis, «cuál
  conviene», carrusel y **ofertas del día**.
- **Guardados**: corazón en cada tarjeta y oferta; comparte almacenamiento con el listado
  (`fav.key` = `favKey` del listado) y con el panel «Guardados» del encabezado (`cmx-saved.js`).

## Estado de la skill (nov-2026)

- Fase 1 y Fase 2 hechas (auditoría, skill y primera guía).
- Pendiente de decisión de Alan: ampliar `relatedHtml` de `sync-site.js` para citar guías de otras
  categorías.
- Mantenimiento automático de disponibilidad: **propuesto, no implementado** (ver
  `disponibilidad-ml.md` §5). No implementarlo sin aprobación explícita.

