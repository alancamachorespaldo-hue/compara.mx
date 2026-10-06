# comparalo.mx

Sitio estático de afiliados que compara el mismo producto en Amazon MX y Mercado Libre.
HTML/CSS/JS puro publicado con **GitHub Pages** desde `alancamachorespaldo-hue/compara.mx`, rama `main`
(el deploy es automático 1-2 min después del push; no se usa Netlify).

## Reglas que nunca se rompen

- **Tag de afiliado Amazon: `tag=comparalo20-20`.** No cambiarlo ni volver a `comparabici-20`.
- **GA4 `G-9TKZ4ER13X`** debe estar en todas las páginas HTML. No quitarlo, reemplazarlo ni reimplementarlo.
- No modificar `/assets/js/analytics.js`.
- No cambiar precios, especificaciones, ratings, número de reseñas, imágenes, links ni IDs de productos
  salvo que el usuario lo pida explícitamente para ese producto.
- No introducir React, Next.js, Astro, Vue ni ningún framework o build step.
- Todas las páginas cargan `<script src="/js/onboarding.js" defer></script>` antes de `</body>`.

## Git: cómo trabajar sin pisar trabajo previo

En oct-2026 un `git stash pop` aplicó un stash olvidado del 16-sep y sobrescribió 13 páginas públicas
con versiones de 3 semanas atrás (commit `40259fe`, revertido en `4aec04d`). Para que no se repita:

0. **Una sola sesión de Claude a la vez en esta carpeta.** Dos sesiones en el mismo directorio se pisan
   (una hace stash o commit de lo que la otra está editando). Para trabajo en paralelo, usar un worktree
   aparte por sesión.
1. **Al iniciar cada sesión: `git status` y luego `git pull --rebase`.** Si `git status` muestra cambios
   que esta sesión no hizo, son de otra sesión o del usuario: no tocarlos, no descartarlos, preguntar.
   Los workflows de GitHub Actions hacen commits (precios, syncs), así que el remoto casi siempre va adelante.
2. **No usar `git stash`** (bloqueado en `.claude/settings.json`). Si hay cambios sin commit que estorban,
   hacer commit o preguntar.
3. **Agregar archivos por nombre**, nunca `git add -A` ni `git add .` (también bloqueados).
4. **Antes de cada commit revisar `git status` y `git diff --stat`.** Si aparecen páginas públicas que
   no se tocaron a propósito, detenerse y averiguar por qué.
5. Un commit = un tema. Un cambio del admin no debe incluir páginas públicas.
6. Antes de hacer push: `node scripts/check-site.js` (lo mismo corre en CI en cada push).

## Estructura de URLs

URLs limpias con slash final; **no se enlaza a archivos `.html`** (excepto `aviso-afiliados.html`,
`privacidad.html`, `terminos.html`). Los `.html` en la raíz son redirecciones de URLs viejas: no editarlos
como páginas ni enlazarlos.

| Sección | Ruta | Array JS de productos |
|---|---|---|
| Inicio | `/index.html` | — (hero con carrusel "Cómo usar", sección "Nuestro método" y leads) |
| Laptops | `/laptops/` | `productos` |
| Bicis | `/bicis/` | `ELECTRICAS`, `MONTANA`, `RUTA`, `GRAVEL` |
| Electrodomésticos | `/electrodomesticos/` | — (portada) |
| Freidoras | `/electrodomesticos/freidoras/` | `productos` |
| Microondas | `/electrodomesticos/microondas/` | `micros` |
| Suplementos | `/suplementos/` | `productos` (hub de categorías) |
| Proteína / Omega 3 / Magnesio / Creatina | `/suplementos/<sub>/` | `productos` |
| Complejo B | `/suplementos/complejo-b/` | `PRODUCTOS` |
| Vitamina D | `/suplementos/vitamina-d/` | `PRODUCTOS` |
| Celulares | `/celulares/`, `/celulares/iphone/`, `/celulares/android/` | — |

`/celulares/alta-gama/` y `/celulares/smartphones/` redirigen a `/celulares/android/` a propósito.
Errores de URL ya vistos: `/celularesalta-gama`, `/electrodomesticosfreidoras` (falta la barra).

## Datos y scripts (`scripts/`)

- `merged-admin.json` — **fuente de verdad** de productos (precios, links, `activo`, specs) por categoría.
- `productos.json` — base que `sync-html.js` combina con `merged-admin.json`.
- `sync-html.js` — aplica `activo`, links y `precioML`/`precioAmz` de la BD a los arrays JS de los HTML.
  Un producto con `activo:false` se elimina del HTML. **Solo cubre las 5 categorías de su `CATALOG`**
  (laptops, suplementos, bicis, freidoras, microondas) y además necesita que la categoría exista en
  `productos.json`: las subpáginas de suplementos (creatina, proteína, omega3, magnesio, complejo B,
  vitamina D) nunca se sincronizan y sus links viven solo en el HTML. Por eso la BD y esas páginas
  pueden divergir; no sincronizar la BD hacia ellas sin revisar primero (oct-2026: 85 links de Amazon
  y 65 de ML de la BD están compartidos entre productos distintos de varias categorías, asignados por
  número de id; los de las páginas son los buenos).
- `ml-update.js [--categoria=X] [--dry-run]` — precio ML de cada producto con link ML y `mlId`
  (ID de catálogo `MLM…` de la ficha `/p/MLM…`) vía `/products/{mlId}/items`; parchea el HTML por `id`
  y escribe `ml-report.json`. Categorías: `laptops`, `freidoras`, `bicis`, `microondas`, `proteina`,
  `omega3`, `magnesio`, `creatina`, `complejo_b`, o `suplementos`.
  `--sugerir` busca candidatos de ID para productos sin `mlId` y los guarda en `ml-sugerencias.json`.
- Los links `meli.la` no contienen el producto (abren el perfil de afiliado) y la API da 403 para IDs de
  publicación (`MLM-…`): sin `mlId` de catálogo no hay precio. El `mlId` se asigna en el artifact (Asignar IDs).
- `generar-admin.js` — completa `mlId` desde links `/p/MLM…`, aplica `ml-report.json` por `id` (si el producto
  se editó a mano después del reporte, gana la edición), agrega candidatos de `ml-sugerencias.json` y genera
  `admin-artifact.html` desde `admin-template.html` (el CSS/JS del artifact se edita ahí, como HTML normal).
- `ml-bicis.js especs|nuevas [--aplicar]` — bicis: llena características vacías desde la ficha ML (nunca
  sobrescribe) y agrega bicis más vendidas con stock como `estadoML:"nuevo"`, `activo:false`. En el artifact se
  publican (requiere link de afiliado) y `sync-html.js` agrega las marcadas `_publicar` a `ELECTRICAS`.
- `sync-pausas.js` — lleva las pausas por plataforma (`pausaML`/`pausaAmz` de `merged-admin.json`) a las
  páginas de suplementos sin tocar los links: inyecta un `<script id="pausas">` y un bucle que, antes de
  render, oculta la plataforma pausada (pone su link y precio en null) y quita el producto si están pausadas
  ambas. El link no se borra, se reactiva poniendo la pausa en "Se muestra" en el artifact.
- `extraer-artifact.js <archivo.html>` — pasa los datos de un artifact guardado a `merged-admin.json`.
- `check-site.js` — validaciones del sitio (ver abajo).

Admin: Claude Artifact https://claude.ai/artifact/BTt8aRBCUZQNWvGAS81rTt (se publica desde
`scripts/admin-artifact.html`). Para traer lo que el usuario guardó ahí: leer el artifact con la herramienta
Artifact, `node scripts/extraer-artifact.js <html guardado>` y luego `node scripts/generar-admin.js`.
El artifact se reconstruye a sí mismo al guardar; si se edita `admin-template.html`, regenerar y republicar.

## GitHub Actions

- `update-prices.yml` ("Actualizar precios Mercado Libre") — **el que usa el usuario** para actualizar
  precios: diario 6:00 CDMX y manual con selector de categoría. Corre `ml-update.js` + `generar-admin.js` +
  `check-site.js` y hace commit. El artifact enlaza a este workflow.
- `update-prices-<categoria>.yml` — manual por categoría (mismo pipeline, sin `check-site.js`).
- `sync-productos.yml` — al cambiar `productos.json` o `merged-admin.json`, corre `sync-html.js`.
- `check-site.yml` — corre `check-site.js` en cada push y PR.
- Secrets: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN`.

## Validación

`node scripts/check-site.js` revisa en todas las páginas: GA4 presente, onboarding presente, tag de
afiliado correcto, sin links a `.html` de categorías, sin URLs sin barra tipo `/celularesalta-gama`,
y que los scripts inline y el JSON-LD no tengan errores de sintaxis. Si falla, no hacer push.

## Diseño

Plantilla de referencia: `/electrodomesticos/freidoras/`. Colores `--ac:#006847`, `--ml:#f0c000`,
`--amz:#f90`. Fuente Satoshi (fontshare). Antes de dar por terminado un cambio visual, probarlo en el
navegador (`.claude/launch.json` levanta el sitio en http://localhost:8765).
