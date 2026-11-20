# comparalo.mx

Sitio estático de afiliados que compara el mismo producto en Amazon MX y Mercado Libre.
HTML/CSS/JS puro publicado con **GitHub Pages** desde `alancamachorespaldo-hue/compara.mx`, rama `main`
(el deploy es automático 1-2 min después del push; no se usa Netlify).

## Reglas que nunca se rompen

- **Tag de afiliado Amazon: `tag=guiasdecomp01-20`, en todo el sitio y sin excepciones.**
  Es el StoreID de la cuenta vigente (nov-2026). Las cuentas viejas `comparalo20-20` y
  `comparabici-20` ya no existen: un enlace con esos tags no paga comisión, así que
  `check-site.js` los marca como error. El 20-nov-2026 se migraron de golpe las 1,043
  apariciones de `comparalo20-20` que quedaban. Si aparece una nueva, viene de una página
  vieja sin confirmar o de un script que la genera: corrígela, no agregues el tag a la lista.
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
| Ofertas (todas las categorías) | `/ofertas/` | — (la arma `generar-ofertas.js`) |

`/celulares/alta-gama/` y `/celulares/smartphones/` redirigen a `/celulares/android/` a propósito.
Errores de URL ya vistos: `/celularesalta-gama`, `/electrodomesticosfreidoras` (falta la barra).

## Datos y scripts (`scripts/`)

- `categorias.js` — **registro único de categorías**. Una categoría se declara aquí UNA vez (clave de
  `merged-admin.json`, página, nombre del array JS, y opcionalmente `descuentos` y `catalogMini`) y
  entra sola en `ml-update.js`, `revisar-disponibilidad.js`, `sync-pausas.js`, `generar-catalog-mini.js`
  y `generar-bajadas.js`. Antes cada script llevaba su propia lista y se desincronizaban: cafeteras,
  smartwatches, refrigeradores, streaming, ollas e iPhone recibían precios pero **no** pausas, así que
  pausar un producto en el gestor no lo quitaba de su página. Al registrar una categoría nueva hay que
  correr `node scripts/sync-pausas.js` una vez para que su página reciba el bloque de pausas;
  `check-site.js` falla si una categoría de la base no está registrada o si a su página le falta ese bloque.
- `revisar-disponibilidad.js [--todas|--categoria=a,b] [--links] [--aplicar] [--umbral=N]` — revisa si
  cada producto publicado SIGUE existiendo en ML y pausa lo caído. Dos capas: la de catálogo
  (`/products/{mlId}` + sus ofertas, ~2 min todo el sitio, corre a diario en `update-prices.yml`) y la
  de links (`--links`: abre cada `meli.la` y comprueba que siga llevando a SU producto; ~20 min, corre
  los domingos en `revisar-disponibilidad.yml`). La segunda es la que descubre lo peor: nov-2026 dos
  laptops abrían una barra de sonido Sonos porque el link caído cae en la tarjeta por defecto del perfil
  de afiliado. Estados: `ok`, `sin_ofertas`, `pausado`, `no_existe`, `link_roto`, `link_otro`, `sin_id`,
  `error`. **Un `error` de API nunca pausa nada** y un producto se pausa solo si se ve caído en DOS
  corridas seguidas (`_dispFallos`, `--umbral`), porque pausar de más también quita credibilidad.
  `--aplicar` escribe `pausaML` + `_pausaAuto` + `_motivoPausa` + `_pausaFecha` sin borrar el producto,
  el link ni el precio, reactiva solo lo que él mismo pausó y **nunca toca una pausa puesta a mano**.
  Un producto pausado por `link_roto`/`link_otro` **solo se reactiva en una corrida con `--links`**:
  para la capa de catálogo ese producto se ve perfectamente disponible (lo que murió es el link de
  afiliado), así que sin esta regla la corrida diaria lo devolvía al sitio cada mañana con el link roto.
  También anota en cada producto revisado `_dispEstado` y `_dispFecha` (y `_dispFallos` mientras está
  en observación): el gestor los muestra en la columna "Revisado en ML" y en las colas "Pausados por
  la revisión", "En observación" y "Nunca revisados". El reporte **acumula**: revisar una categoría
  suelta no borra lo que se sabe de las demás.
  Escribe `disponibilidad-report.json`, que `generar-admin.js` embebe en el gestor (tarjeta
  "Disponibilidad en Mercado Libre", con botón para pausar). Después de `--aplicar` hay que correr
  `sync-pausas.js` para que las páginas lo reflejen.
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
- **Precios de las guías — dos capas.** Las 7 guías de celulares ya bajaban `/celulares/catalog-mini.json`
  para refrescar sus tarjetas, pero la tabla, las fichas y las tarjetas "decide" llevaban el precio escrito
  a mano, así que la misma página enseñaba dos cifras distintas del mismo celular. Ahora:
  1. `assets/js/guias-precios.js` expone `cmxPreciosGuia(familias, mapaPorLinkML)` y la guía lo llama
     dentro de ese `fetch`. Pinta cada `[data-cmx-precio="<modeloBase>"]` con el precio vivo; si el
     producto no tiene `linkML` en `catalog-mini.json` **no deja una cifra vieja**, escribe "Consulta el
     precio en la tienda". Se carga **sin `defer` y antes del script en línea**: con `defer` se ejecutaba
     después de que el `fetch` ya había resuelto y la llamada se saltaba en silencio.
  2. `sync-guias-precios.js` mantiene al día el HTML estático (lo que ven los buscadores y quien no
     ejecuta JS). Las dos capas usan la misma anotación `data-cmx-precio`.
  `cmxPreciosGuia(datos, mapa, rango)` acepta las dos formas de datos que hay en las guías:
  `{modeloBase, variantes:[{linkML}]}` (menos-5000, calidad-precio) y `{id, linkML}`
  (`celularesDataGuia` en menos-3000, 5000-10000 y buena-camara). Las 5 guías con precios están anotadas.
  El tercer argumento es el rango que promete el título (`{max:3000}`, `{min:5000,max:10000}`, `{max:7000}`,
  `{max:5000}`; calidad-precio no lleva porque se organiza por tramos). Si el precio de hoy se sale del
  rango, la ficha lo dice sola con un `.cmx-rango` — así una guía nunca anuncia un tope que su propio
  contenido incumple. No se pone en la tabla, la barra lateral ni la tarjeta del comparador: no cabe.
- `sync-guias-precios.js [--aplicar]` — las guías llevan el precio escrito a mano en la tabla, en las
  fichas y en su array `familias*`, y `ml-update.js` no las toca, así que se desfasan solas. Este script
  lleva el `precioML` de la BD a esos tres lugares **sin adivinar nada**: cada familia declara
  `dbId: '<id de merged-admin.json>'` y cada precio del HTML lleva `data-cmx-precio="<modeloBase>"`.
  Nunca empareja por nombre ni por número de id. **Tope de seguridad `MAX_SALTO` (25%)**: si la BD se
  aleja más de eso del precio de la guía no lo escribe y lo manda a `guias-precios-report.json` para
  revisarlo a mano (oct-2026 la BD tiene un Pixel 9a a $20,794 por un `mlId` mal asignado; el tope
  existe para que un dato así no acabe en una guía). Corre en `update-prices.yml`.
  Guías ya anotadas: `mejores-celulares-menos-5000`. Para sumar otra hay que anotarla primero.
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
- `sync-pausas.js` — lleva las pausas por plataforma (`pausaML`/`pausaAmz` de `merged-admin.json`) a
  TODAS las páginas del registro (no solo suplementos) sin tocar los links. **Empareja leyendo el
  array del HTML**: por id y, si no coincide, por `linkML`/`linkAmz`, porque el id de la página no
  siempre es el de la base (en streaming la base usa `streaming-2` y la página `2`, así que sus 17
  pausas no ocultaban nada). Quita el producto de la lista cuando se queda **sin ninguna tienda**
  —no solo cuando están pausadas las dos—, porque desde la baja de Amazon casi nada tiene `linkAmz`
  y la tarjeta se quedaba sin precio ni botón. Además reescribe el contador del hero
  ("N modelos para comparar") con lo que de verdad se ve. Avisa si un producto pausado no aparece
  en su página en vez de fallar en silencio. Lo que inyecta: inyecta un `<script id="pausas">` y un bucle que, antes de
  render, oculta la plataforma pausada (pone su link y precio en null) y quita el producto si están pausadas
  ambas. El link no se borra, se reactiva poniendo la pausa en "Se muestra" en el artifact.
- `extraer-artifact.js <archivo.html>` — pasa los datos de un artifact guardado a `merged-admin.json`. Además detecta
  bajadas de precio de Amazon capturadas con una versión del artifact que no las registraba (compara contra la base
  actual y escribe `_precioAmzAntes`/`_precioAmzFecha`). La base de comparación es `merged-admin.json` tal como está:
  no la confirmes (commit) hasta que el usuario termine de capturar precios, o se pierde la referencia.
- **Ofertas (`descuentos.json`)** — `_ofertas.js` es la lógica compartida de `generar-descuentos.js` (celulares),
  `generar-laptops-descuentos.js`, `generar-proteina-descuentos.js` y `generar-cafeteras-descuentos.js`. Hay oferta si
  `_precioMLAntes > precioML` (lo escribe `generar-admin.js` con cada reporte de ML) o si el precio de Amazon bajó:
  el artifact guarda `_precioAmzAntes` + `_precioAmzFecha` al capturar un `precioAmz` menor (anclado al precio más alto
  de la racha; si sube hasta el precio anterior se quita) y la oferta de Amazon vale 7 días (`DIAS_OFERTA_AMZ`, en
  `_ofertas.js` y en `admin-template.html`; cambiar en ambos). Requiere link con el tag y `pausaAmz` apagado. Gana la
  tienda con mayor %; cada oferta trae `plataforma` (`ml`|`amazon`), `precioOferta` y `link`.
  Todos los generadores filtran con `vendible()` de `_ofertas.js` (activo, no eliminado, sin `pausaML`,
  `estadoML` distinto de `no_encontrado`/`pausado`). Hasta nov-2026 la función existía pero no la
  llamaba ninguno —filtraban solo por `activo`—, así que un producto pausado en ML podía seguir
  anunciándose como oferta en el inicio. Al agregar un generador nuevo, usar `vendible(p)`, no `p.activo`. Los consumen la sección
  de ofertas del inicio, `/celulares/`, `/celulares/android/` y las 3 guías de celulares con `descuentos.json`.
- `generar-bajadas.js` — escribe `assets/data/bajadas.json` con TODOS los productos que bajaron de precio por
  categoría (bajada oficial de `_ofertas.js` + lo que ya anuncia cada `descuentos.json`, que tiene tope de 5–8).
  Corre en `update-prices.yml` tras las ofertas. `assets/js/price-drops.js` lo lee: pinta "↓ % · Bajó $ · Antes $"
  en la tarjeta y da el filtro "Bajó de precio" (chip sobre el listado, sección "Ofertas" en el panel, y en
  proteína/creatina su filtro propio). Solo muestra una bajada si id, nombre y precio actual coinciden con la página.
- `generar-ofertas.js [--dry-run]` — arma **`/ofertas/`**, la página que junta en una fila por
  categoría todo lo que bajó de precio en los últimos 30 días. Un producto entra si tiene bajada
  vigente en la base (`mejorBajada`, la misma que ya anuncia su categoría) o si el histórico de 30
  días lo pone al menos 3 % debajo del máximo del periodo; siempre con `vendible` + `publicado`,
  link de ML y precio, así que lo pausado o caído no aparece. Escribe el HTML **estático** de las
  tarjetas entre los marcadores `<!-- ofertas:resumen|indice|secciones|datos -->` (para buscadores)
  más un `<script type="application/json" id="of-data">` que lee `assets/js/cmx-ofertas.js`
  (selección de 2 a 3 productos *de la misma categoría*, comparativa, favoritos, índice lateral).
  También escribe `assets/data/historico/ofertas.json`: el histórico recortado a los productos de
  la página, con claves `"<categoria>:<id>"` porque los ids se repiten entre categorías; así la
  página baja un archivo y no los 24. Los productos con salto atípico en la serie se publican pero
  van al final de su fila: ese salto casi siempre es un cambio de la oferta de referencia del
  catálogo, no una rebaja. Tope de 8 tarjetas por categoría (`TOPE`); el resto se ve en la categoría.
  Corre en `update-prices.yml` y en `revisar-disponibilidad.yml`. Los grupos del índice viven en el
  propio script: una categoría nueva de `categorias.js` entra sola en "Más categorías".
- `sync-ofertas-cta.js [--check] [--dry-run]` — pone el acceso a `/ofertas/` en las 26 páginas del
  registro: el chip junto al contador (`cl-oflink`, primera pantalla, solo donde existe
  `<p class="cl-count" id="cl-count">`) y la banda verde al terminar el listado (`cl-ofcta`, dentro
  de `cl-below-main`; en las páginas que todavía no usan cmx-list va suelta antes de "Sigue
  explorando" con la clase `cl-ofcta--solo`). Donde está la plantilla, la banda trae además un botón
  que enciende el filtro "Bajó de precio" de esa misma página. Los textos salen de
  `scripts/_nombres.js` (singular/plural de cada categoría, compartido con `generar-ofertas.js`) y
  los estilos de `assets/css/cmx-site.css`, que cargan todas las páginas. Es idempotente y **no se
  edita a mano**: para cambiar el texto se cambia el script y se vuelve a correr. Los dos accesos
  mandan el evento GA4 `click_ofertas_cta` con `page_section` y `origen`
  (`listado_top` | `listado_banda`). Una categoría nueva entra sola: se registra en `categorias.js`
  y se corre esto una vez.
- `sync-site.js [--only=header,footer,related,head] [--check]` — escribe entre marcadores el encabezado
  (`cmx-header`, con el botón de favoritos si la página lo tiene), el breadcrumb (`cmx-bc`, solo en páginas que ya
  lo tenían en el menú; sale del JSON-LD), "Sigue explorando" (`cmx-related`) y el pie con aviso de afiliados
  (`cmx-footer`). **No editar esos bloques a mano**: se cambian en el script o en `assets/css/cmx-site.css`
  y se vuelve a correr. Una página nueva debe correrlo (y estar en `sitemap.xml`) o `check-site.js` falla.
  Las categorías del buscador (escritorio y panel móvil) viven en `js/categorias.js`.
  "Sigue explorando" cierra siempre con la tarjeta de **Ofertas** (`/ofertas/`), y el botón
  "Ofertas" del encabezado lleva a esa página (antes abría `/#ofertas`). En el inicio, el botón
  "Ver todas las ofertas" de la sección de bajadas también enlaza a `/ofertas/`.
- `sync-hub-counts.js [--check]` — números de producto en los hubs. Cuenta con el mismo criterio
  que las páginas (lo que conserva alguna tienda tras las pausas) y, en celulares, cuenta variantes,
  no familias. Corre después de `sync-pausas.js` en los dos workflows de datos.
- `check-site.js` — validaciones del sitio (ver abajo).

Admin: Claude Artifact https://claude.ai/artifact/BTt8aRBCUZQNWvGAS81rTt (se publica desde
`scripts/admin-artifact.html`). Para traer lo que el usuario guardó ahí: leer el artifact con la herramienta
Artifact, `node scripts/extraer-artifact.js <html guardado>` y luego `node scripts/generar-admin.js`.
El artifact se reconstruye a sí mismo al guardar; si se edita `admin-template.html`, regenerar y republicar.

## GitHub Actions

- `update-prices.yml` ("Actualizar precios Mercado Libre") — **el único workflow de precios
  programado y el que usa el usuario**: diario 6:00 CDMX y manual con selector de categoría. Corre
  todo el pipeline (`ml-update.js`, `generar-admin.js`, histórico, `generar-catalog-mini.js`,
  descuentos, bajadas, pausas, `sync-guias-precios.js`, `check-site.js`) y hace commit. El artifact
  enlaza a este workflow. Una categoría o una guía nuevas entran solas: basta registrarlas en su
  script (`CATALOG` de `ml-update.js`, `CATALOGOS` de `generar-catalog-mini.js`, `GUIAS` de
  `sync-guias-precios.js`); el commit usa `git add -u`, no una lista de rutas.
  (`ml-update.yml` hacía lo mismo cuatro horas antes; se retiró el 16-nov-2026.)
- `revisar-disponibilidad.yml` ("Revisar disponibilidad en Mercado Libre") — domingos 5:00 CDMX y
  manual (con opciones de aplicar/links/umbral). Corre la revisión completa **con la capa de links**,
  pausa lo caído, aplica pausas a las páginas, regenera el gestor y valida. La capa rápida ya corre
  a diario dentro de `update-prices.yml`.
- `update-prices-<categoria>.yml` — manual por categoría (mismo pipeline, sin `check-site.js`).
- `sync-productos.yml` — al cambiar `productos.json` o `merged-admin.json`, corre `sync-html.js`.
- `check-site.yml` — corre `check-site.js` y `validar-datos.js` en cada push y PR.
- Secrets: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN`.
- **Ningún workflow usa `git stash`.** Confirman primero y después hacen `git fetch` + `git rebase`;
  si el rebase choca, abortan y fallan. Todos comparten `concurrency: datos-comparalo`, porque todos
  escriben `merged-admin.json`. El 16-nov-2026 un `git pull --rebase --autostash` de dos corridas
  traslapadas publicó la base con 1,065 bloques de conflicto; no volver a meter stash aquí.

## Validación

`node scripts/check-site.js` revisa en todas las páginas: GA4 presente, onboarding presente, tag de
afiliado correcto, sin links a `.html` de categorías, sin URLs sin barra tipo `/celularesalta-gama`,
y que los scripts inline y el JSON-LD no tengan errores de sintaxis. Además revisa el registro de
categorías: que toda categoría de `merged-admin.json` esté en `scripts/categorias.js`, que su página
exista con el array declarado y que tenga el bloque `/*PAUSAS*/` (si no, pausar un producto en el
gestor no lo quitaría del sitio). Si falla, no hacer push.

`node scripts/validar-datos.js` revisa los JSON de datos (la base, los reportes, el histórico,
`descuentos.json`, `catalog-mini.json`): que no tengan marcas de conflicto de git, que se puedan
leer y que `merged-admin.json` no se haya quedado vacío. Corre en cada push y antes de cada commit
de los workflows. Es la red que faltaba el 16-nov-2026, cuando `git add` + `git commit` publicaron
la base con marcas de conflicto sin que nada fallara.

## Diseño

Plantilla de referencia: `/electrodomesticos/freidoras/`. Colores `--ac:#006847`, `--ml:#f0c000`,
`--amz:#f90`. Fuente Satoshi (fontshare). Antes de dar por terminado un cambio visual, probarlo en el
navegador (`.claude/launch.json` levanta el sitio en http://localhost:8765).
