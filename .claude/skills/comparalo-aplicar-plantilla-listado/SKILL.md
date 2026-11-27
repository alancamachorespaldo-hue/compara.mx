---
name: comparalo-aplicar-plantilla-listado
description: Convierte el listado de una categoría EXISTENTE de comparalo.mx (audífonos, bocinas, streaming, consolas, lavadoras, laptops, suplementos, celulares, etc.) a la plantilla nueva de listado + selección + comparativa (cmx-list), conservando su catálogo, enlaces y contenido. Úsala cuando Alan diga "aplica la plantilla a X", "pasa X al diseño nuevo", "corrige la categoría X con la estructura nueva" o "sigue con la siguiente categoría". Una categoría por vez; se detiene para aprobación.
---

# Aplicar la plantilla de listado (cmx-list) a una categoría existente

Objetivo: que el listado de la categoría quede **igual en estructura, colores, botones, filtros, barra fija, dock, comparativa y vista móvil** que `/tecnologia/smartwatches/`, cambiando solo lo propio de la categoría. Lee también `CLAUDE.md`: sus reglas (git, GA4, validación, no tocar datos de productos) son obligatorias.

Modelo recomendado: Sonnet 5.5 a esfuerzo medio/alto para categorías de lista simple. Para Celulares (familias con variantes) usa un modelo más capaz y esfuerzo alto.

## Reglas que no se negocian

1. **Una categoría por ejecución.** Al terminar: reporte y ALTO. No sigas con la siguiente ni declares la página aprobada; aprueba Alan.
2. **Las referencias visuales mandan.** La página molde VIVA es `tecnologia/smartwatches/index.html` + `assets/css/cmx-list.css` + `assets/js/cmx-list.js`. Léelos antes de escribir. No reinterpretes el diseño ni inventes componentes.
3. **No se toca el catálogo.** El arreglo de productos (`const productos = [...]`, `PRODUCTOS`, `micros`…) queda byte por byte igual: lo actualizan `ml-update.js` y los workflows. Tampoco cambian links, ids, precios ni specs.
4. **Solo Mercado Libre.** Sin precios, botones ni enlaces de Amazon en tarjetas, dock o comparativa. Sin "MEJOR PRECIO" entre tiendas. Amazon vive en las guías de `/guias-compra/`.
5. **Ningún dato inventado.** Si los productos no traen calificación, reseñas o una característica, no se muestra. Las filas sin dato dicen "Sin dato". El veredicto de la comparativa solo declara ganador con evidencia (lo decide `cmx-list.js`).
6. **No edites `cmx-list.css` ni `cmx-list.js` para una sola categoría.** Lo específico va en la configuración `CmxList.init({...})` de la página. Si de verdad falta una capacidad en la plantilla, dilo en el reporte y pregunta antes de cambiarla: afecta a todas las páginas que ya la usan.
7. **Bicis queda fuera.** Decisión de Alan (nov-2026): se rehará aparte como hub `/bicis/` + cuatro listados separados (eléctricas, montaña, ruta, gravel), igual que Suplementos → proteína/creatina. No conviertas `/bicis/` con esta skill.

## Paso 0 — Preparación

- `git status` y `git pull --rebase`. Si hay cambios que no son tuyos, pregunta.
- Confirma que la página NO usa ya la plantilla (`grep -c "CmxList.init" <pagina>`).
- Identifica el tipo de datos:
  - **Lista simple** (`const productos = [ {id, nombre, marca, linkML, precioML, imagen|img, especs|campos…} ]`): caso directo.
  - **Familias con variantes** (`const familias`, celulares): la plantilla ya soporta variantes (`variants` en `CmxList.init`, ver abajo; primer uso: `/celulares/android/`). Una tarjeta por familia, chips de capacidad, filtros y orden con la variante más barata con enlace.
  - **Página con base remota** (`<base href="https://comparalo.mx/">`): cámbiala a `<base href="/">` o no se verá en localhost.

## Paso 1 — Perfilar los datos reales

Antes de decidir filtros o características, mide el catálogo con Node (evalúa el arreglo con `vm`, como hace `scripts/sync-hub-counts.js`):

- cuántos productos hay, cuántos tienen `linkML`, cuántos precio;
- qué campos existen y **en cuántos productos** está cada uno;
- valores distintos de cada campo candidato a filtro (y su conteo);
- rango de precios; si hay bajadas en `assets/data/bajadas.json` para esa categoría.

Con eso propón a Alan, en una tabla corta, y espera su visto bueno si hay duda:
- **Características de la tarjeta** (máx. 5–6, las que más productos tienen y más ayudan a decidir). **Confianza del comprador (obligatorio cuando exista el dato):** `Calificación` como estrellas con las opiniones entre paréntesis (p. ej. `4.9 (3,914)`, el valor que traiga la ficha/API, nunca redondeado ni inventado) y `Vendidos` (cantidad de unidades vendidas, p. ej. `1,200 vendidos`). Ir en la tarjeta (filas arriba, con iconos `star` y `cart`) y en la comparativa. Si el producto no trae el dato, la fila no se muestra (tarjeta) o dice "Sin dato" (comparativa). Alan: saber cuánta gente ya compró y cómo lo calificó es de lo que más pesa en la decisión. En la comparativa `Calificación` solo puntúa con ≥ 30 opiniones y `Vendidos` puntúa por cantidad.
  Antes de proponer, mide cuántos productos tienen estrellas, opiniones y vendidos y dilo en la tabla. Si la categoría no los tiene (la API de ML con nuestras credenciales da 403 en `/reviews` y en `/items/{id}`, o sea no entrega ni calificaciones ni `sold_quantity`), dilo en el reporte: no se llenan a mano ni se inventan.
- **Histórico de precio**: mide cuántos productos de la categoría tienen datos en
  `assets/data/historico/<categoria>.json` y en qué estado (`completo` / `parcial` / `nuevo` /
  `insuficiente`). Dilo en la tabla. Si el archivo no existe o casi ningún producto llega a 7
  registros, la categoría va **sin** histórico y se reporta; no se activa "para que se vea".
- **Filtros** (Marca casi siempre; el resto según los datos). Un campo con menos de ~40 % de cobertura no sirve de filtro.
- **Criterios de comparación** y cuáles pueden puntuarse ("más es mejor", "menos es mejor", sí/no). Si no se puede decir objetivamente cuál es mejor, la fila va sin `score`.

Guía por tipo de categoría (adáptala a lo que EXISTA en los datos):
- Tecnología: compatibilidad, pantalla, batería, conectividad.
- Electrodomésticos: capacidad, potencia, dimensiones, funciones, consumo.
- Suplementos: contenido, porciones, cantidad por porción, forma/tipo, **costo por porción** (menos es mejor).
- Laptops: procesador, RAM, almacenamiento, pantalla, gráficos.
- Videojuegos: plataforma, tipo, formato/género, condición.

## Paso 2 — Reescribir la página

Trabaja con un script Node de reemplazos con ancla verificada (si un ancla no aparece, el script debe fallar, no seguir). Estructura final, copiada del molde:

1. `<html lang="es-MX">` sin `data-cmx-layout`/`data-cmx-filters`.
2. En `<head>`: quita `cards.css` y el `<style>` en línea del listado viejo; deja `cmx-site.css` y agrega `cmx-list.css` después. Conserva title, description, canonical, JSON-LD, GA4 y `analytics.js`.
3. `<body class="list-page" data-category="…">` (conserva `data-category`).
4. `<main class="cl">` con: hero (`cl-hero`, h1 único, buscador, 3 fotos `data-cmx-img`), centinela + barra fija (`cl-sentinel`, `cl-sticky` con pasos y `cl-bar`: Filtros, chips, Ordenar, Guardados), `cl-layout` (aside `cl-filters` vacío + `cl-main` con contador, grid, vacío, mostrar más) y `cl-below` (guías, cómo elegir, FAQ, editorial). **`cl-below` va DENTRO de `cl-layout`** (como último hijo, después de `cl-main`), no como hermano: así el panel de filtros sigue fijo hasta el final del contenido de la página y no desaparece al bajar al texto editorial (CSS: `.cl-layout > .cl-below`). Smartwatches aún tiene `cl-below` como hermano; pendiente de moverlo con el OK de Alan.
   **Formulario "¿No encuentras lo que buscas? Te comparamos."**: justo después de `</main>`, el bloque `<section class="hub-leads">…</section>` copiado tal cual de `/celulares/index.html` (mismo Google Form), envuelto en `<div class="hub-page" style="margin:0;background:transparent">`, y cargar `/assets/css/cmx-hub.css` (después de `cmx-list.css`) y `/assets/js/cmx-hub.js` (defer, al pie). Va en todas las categorías convertidas.
5. Dock, backdrop, toast y vista de comparativa (`cl-dock`, `cl-backdrop`, `cl-toast`, `cl-cmp-view`) antes del script.
6. `<script src="/assets/js/cmx-historico.js"></script>` (solo si la categoría lleva histórico;
   **sin `defer` y antes** de `cmx-list.js`, que lo busca en `window.cmxHist` al iniciar),
   `<script src="/assets/js/cmx-list.js"></script>` y luego el script de la página: **el arreglo de productos intacto** + el bloque de pausas si existe + `CmxList.init({...})`. Se elimina la lógica vieja (cardHtml, render, toggleSelect, modal…).
7. Scripts del pie: quita `favorites.js`, `filters-panel.js`, `cards-enhance.js`, `filters-scroll.js`. Conserva `price-drops.js`, `onboarding.js`, `site-nav.js`, `share.js`.
8. Registra la ruta en `LISTS_V2` de `scripts/sync-site.js` y corre `node scripts/sync-site.js` (encabezado y pie nuevos). No edites esos bloques a mano.

### Configuración `CmxList.init`

```js
CmxList.init({
  items: productos,                       // el arreglo de la página
  section: 'tecnologia_smartwatches',     // = data-category; es el page_section de GA4
  favKey: 'tecnologia_smartwatches',      // conserva la clave que ya usaba favorites.js: ruta sin barras, con "_"
  title: 'Smartwatches',
  noun: { one: 'smartwatch', many: 'smartwatches', all: 'Ver todos los smartwatches' },
  name, img, link,                        // funciones (p) => …
  price: (p) => p.linkML ? p.precioML ?? null : null,   // solo precio de Mercado Libre
  text,                                   // texto donde busca el buscador
  rank,                                   // orden "Recomendados" (p. ej. completitud de datos)
  specs:  [{ label, icon, get }],         // renglones de la tarjeta
  facets: [{ id, title, get }             // opciones y contadores salen de los datos
           | { id, title, options: [[valor, etiqueta, test]], mode: 'and'|'or' }],
  compare: { rows: [{ label, icon, get, score?, why?, pick? }] },
  // Opcional, solo categorías con variantes (celulares). Sin esto la plantilla funciona igual que siempre:
  variants: { list: (p) => p.variantes, usable: (v) => !!v.linkML, chip: (v) => '256 GB' },
  drop: (p, v) => window.cmxGetDrop({ id: v.id, nombre: p.nombre, precioML: v.precio }),  // bajada de ESA variante
  // Opcional — histórico de precio (ver abajo). Sin esto la tarjeta sale exactamente como antes:
  historico: 'tecnologia_smartwatches',                 // archivo de assets/data/historico/
  histId: (p, v) => (v || cheapest(p) || {}).id         // solo con variantes; por defecto usa p.id
});
```

Con `variants`, `price`, `link` y los `get`/`score` de `specs` y `compare.rows` reciben `(p, v)` con la variante elegida; sin variante (filtros, orden, slider) `v` llega `undefined` y la función debe devolver lo de la variante más barata con enlace. Los chips repetidos (mismo texto) se colapsan en el primero; `chip` que devuelve `''` oculta ese dato. Los favoritos se guardan por producto, no por variante.

- `score(p)` devuelve un número (mayor = mejor) o `null` si no hay dato. Sin `score` la fila no participa en el veredicto.
- `why` completa "destaca por …"; `pick` completa "Elige X si: …". Escríbelos con base en el dato, sin exagerar.
- Iconos disponibles: `screen, battery, gps, nfc, phone, spark, tag, star, cart`. Si hace falta otro, es un cambio a la plantilla (regla 6).
- Normaliza para mostrar (p. ej. "1 semanas" → "1 semana") en `get`, nunca en el arreglo.
- **Datos poco creíbles no se muestran** (batería "5 mAh", RAM de 128 GB, pantalla de 5″ en un Pixel 9a…): mide rangos plausibles en el Paso 1 y filtra en `get` (queda "Sin dato"), sin tocar el arreglo, y repórtalo. Es mejor no decir nada que decir algo incorrecto (Alan, nov-2026).
- La comparativa ya avisa en cada celda "Sin dato" ("Verifícalo en la publicación de Mercado Libre") y en el pie explica dónde buscarlo; no hace falta configurarlo.
### Histórico de precio (30 días)

La plantilla puede mostrar cómo se movió el precio de cada producto en los últimos 30 días.
**Nunca es obligatorio**: sin `historico` en la configuración, la tarjeta sale igual que siempre.

**De dónde salen los datos.** La API de Mercado Libre **no** entrega histórico de publicaciones
ajenas (nov-2026: `/items/{id}` y `/items/{id}/prices` dan 403 con nuestras credenciales, y
`/marketplace/items/{id}/prices/history` exige ser el vendedor dueño). El histórico es nuestro:
`scripts/historico-precios.js` guarda cada día el `precioML` de `merged-admin.json` y
`scripts/generar-historico.js` publica `assets/data/historico/<categoria>.json`. Los dos corren en
`update-prices.yml`. No hay registros anteriores al 30-sep-2026 y **no se inventan**.

**Cómo se ve.** Una sola línea al pie de la tarjeta: «Histórico de precio · 30 días». **No expande
la tarjeta**: abre una ventana superpuesta (`.cl-hm`, la arma `assets/js/cmx-historico.js`) con la
gráfica grande, el eje de precios, las fechas, el mínimo marcado, el precio actual, el mínimo, el
máximo, la variación y el registro de cambios. En móvil el panel sube desde abajo y el registro va
plegado en un acordeón. Cierra con la ✕, con Escape o tocando fuera.

En la **comparativa** se agrega sola, bajo la tabla: una gráfica por producto, **con la misma escala
y el mismo periodo**, más una observación de cuál bajó más y cuál se mantuvo más estable. Esa
observación **no cambia el veredicto**: el histórico no puntúa y una bajada reciente no vuelve a un
producto mejor compra.

**Qué hay que hacer en la página**
1. `<script src="/assets/js/cmx-historico.js"></script>` sin `defer`, antes de `cmx-list.js`.
2. `historico: '<categoria>'` en `CmxList.init` — el nombre del archivo de
   `assets/data/historico/`, que es la clave de la categoría en `merged-admin.json`
   (`tecnologia_smartwatches`, `celulares_android`, `laptops`…). También acepta un arreglo de
   varias categorías, que se juntan (lo usan las guías que mezclan Android e iPhone).
3. Con variantes, `histId: (p, v) => …` devolviendo el id de la variante elegida — **el mismo id
   que usa `drop`**, porque el histórico se guarda por variante. Sin variantes no hace falta: usa `p.id`.
4. Nada más. El botón, la ventana y la sección de la comparativa salen de la plantilla.

**Reglas de transparencia (no se negocian)**
- Menos de 7 registros → **no hay gráfica**. El panel dice desde cuándo registramos ese producto
  (`insuficiente`) o que es un producto recién incorporado (`nuevo`).
- Entre 7 y 27 registros → gráfica con la leyenda **«Histórico en construcción: llevamos N de 30 días»**.
- La variación del periodo solo se publica con **14 registros o más**; si no, dice «Sin dato».
- Los días sin registro se dibujan **punteados** y se cuentan en una nota. **Jamás se interpolan.**
- Siempre visible de dónde viene: «Datos de comparalo.mx desde el <fecha> · N registros» y que es
  **el precio de catálogo de Mercado Libre (la oferta más barata con envío FULL), no el de un
  vendedor en particular**.
- Si el precio de la ficha no coincide con el último registrado, el panel lo dice con las dos
  cifras. No se corrige ninguna de las dos ni se agrega un punto al histórico para cuadrarlo.
- Un cambio de `mlId` abre una serie nueva: dos publicaciones distintas nunca se empalman.
- Un salto de 60 % o más entre dos días se marca como atípico y el panel avisa que seguramente
  cambió la oferta de referencia del catálogo. Si aparecen muchos en una categoría, repórtalo:
  suele ser un `mlId` mal asignado en la base.

**Eventos GA4** (los dispara la plantilla, no hay que escribirlos): `historico_abrir`,
`historico_cerrar`, `historico_sin_datos` y `historico_comparativa_view`. Todos llevan
`page_section` y `origen` (`tarjeta` | `comparativa` | `guia`). No sustituyen ni duplican ninguno
de los que ya existen.

### Contenido que se conserva

- **Texto editorial / SEO:** se traslada palabra por palabra a `cl-editorial` y a las preguntas frecuentes. No redactes contenido nuevo ni borres el existente; si sobra texto, va completo en `cl-editorial`.
- **Guías:** solo destinos que existan (`ls` antes de enlazar). Si hay menos de tres, completa con el hub de la categoría.
- **Fotos del hero y de las guías:** tres productos del propio catálogo, los más completos y con foto limpia de fondo blanco, cada `<img>` con `data-cmx-img`. Si existe un archivo propio `fotos/hero/<categoria>.webp`, úsalo en su lugar (sin `data-cmx-img`). `scripts/sync-hero-imgs.js` (workflow de precios) y `cmx-list.js` sustituyen solas las que desaparezcan. No uses imágenes generadas como si fueran productos.

## Paso 3 — Verificar (obligatorio antes de reportar)

`.claude/launch.json` → servidor `sitio` en http://localhost:8765. Comprueba en la página, a ~1400 px y a 375 px:

- [ ] Consola sin errores; un solo `<h1>`; sin scroll horizontal.
- [ ] El número de productos del contador coincide con el catálogo.
- [ ] Cada filtro cambia resultados y contador; chips se quitan uno a uno y con "Limpiar filtros"; precio máximo; "Solo bajó de precio".
- [ ] Buscador y orden funcionan; "Mostrar más" carga más.
- [ ] Corazón guarda; "Guardados (X)" cuenta y filtra; contador independiente de "n/3".
- [ ] Selección: 1, 2 y 3 productos; el 4.º muestra el aviso; dock con miniaturas, quitar uno, limpiar.
- [ ] Comparativa: abre, tabla con valores reales, resaltados correctos, veredicto coherente con los datos, botones a Mercado Libre, cierra y conserva la selección.
- [ ] Barra fija: se pega bajo el encabezado, no tapa el panel de filtros ni el contenido; en móvil el drawer abre, aplica, limpia y cierra.
- [ ] Botones "Ver en Mercado Libre": `href` igual al `linkML` del producto, `rel="sponsored nofollow noopener"`.
- [ ] Precio máximo: el slider arranca a la derecha ("Sin límite"), al moverlo cambia el contador y las tarjetas, y vuelve a 90/N al soltarlo al máximo.
- [ ] Carga automática: al bajar por el listado aparecen más productos hasta el total (el botón "Mostrar más" queda de respaldo).
- [ ] Panel de filtros fijo: baja con la página hasta el final del contenido (también junto al texto editorial) y se desplaza por dentro. Al filtrar, ordenar, quitar chips, limpiar, usar Guardados o aplicar en el drawer móvil estando abajo, la página vuelve sola al inicio de los resultados.
- [ ] Logo de ML nítido en tarjetas y comparativa (usa `/logomercado-ic.png`, 96×66, recorte del óvalo; nunca escales `logomercado.png` de 2000 px a 30 px ni lo recortes con `object-fit: cover`).
- [ ] Comparativa con un "Sin dato": la celda muestra la nota de verificar en la publicación.
- [ ] Histórico (si la categoría lo lleva): el botón **no expande la tarjeta**; abre la ventana;
      la gráfica trae eje de precios y fechas; cierra con ✕, Escape y tocando fuera; el scroll de
      la página se bloquea al abrir y se libera al cerrar.
- [ ] Histórico: **no se baja ningún JSON hasta abrir el primero** (revisa la pestaña Red).
- [ ] Histórico: un producto sin datos abre la ventana con el aviso, no con una gráfica vacía.
- [ ] Histórico con variantes: al cambiar el chip, el `data-hist` del botón cambia de variante.
- [ ] Histórico en la comparativa: una gráfica por producto, **misma escala en todas**, y el
      veredicto sigue igual que sin histórico.
- [ ] Histórico en móvil 375 px: el panel sube desde abajo, sin pestañas, con el registro plegado.
- [ ] Formulario "Te comparamos" visible al final, con su envío funcionando igual que en los hubs.- [ ] Cero enlaces a Amazon en la página.
- [ ] Eventos GA4 (carga con `?bot=claude` y envuelve `window.gtag` para capturarlos): `affiliate_click_ml`, `click_seleccionar_comparar`, `click_comparar_categoria`, `filtro_bajada_precio`, `favorito_guardar/quitar`, `filtro_guardados`, `filtro_aplicar`, `filtros_limpiar`, `ordenar_listado`, `buscar_listado`.
- [ ] `node scripts/check-site.js`, `node scripts/sync-site.js --check` y `node scripts/sync-hero-imgs.js --check` sin cambios pendientes ni errores.
- [ ] La categoría está en `scripts/categorias.js` con su `file` y su `varName` actualizados (si la
      página cambió de ruta o el array cambió de nombre, hay que corregirlos ahí o el precio, la
      revisión de disponibilidad y las pausas dejan de encontrarla). Después, `node scripts/sync-pausas.js`.
- [ ] `node scripts/revisar-disponibilidad.js --categoria=<clave> --links`: ningún producto con
      link roto ni con link que abra otro producto. Si los hay, pausa esos antes de publicar.
- [ ] `git status`: solo la página, `scripts/sync-site.js` y nada más.

Si las capturas del navegador salen ilegibles o el panel está oculto, dilo en el reporte: la revisión visual le toca a Alan. No afirmes que "se ve igual" sin haberlo visto.

## Paso 4 — Reporte y alto

Entrega, en este orden: qué cambió; tabla de características/filtros/criterios elegidos y por qué; diferencias frente a Smartwatches (datos que no existen, guías faltantes); qué verificaste y qué no; archivos modificados. **No hagas commit ni push** hasta que Alan lo pida; cuando lo pida, agrega archivos por nombre y un commit por categoría.

## Errores ya cometidos (no repetir)

- `items.map(price)`: `map` pasa el índice como 2.º argumento y con variantes lo tomaba por la variante elegida, dejando el slider de precio roto (min = max). Pasa siempre `function (p) { return price(p); }`. Con `variants`, toda función de la config que acepte `(p, v)` debe tolerar `v === undefined`.
- Probar solo la primera pantalla: el slider, la carga automática y el panel fijo solo se notan a 1400 px bajando por todo el listado y hasta el pie.
- Dar por buena la comparativa sin probar un par con "Sin dato".
- Restilizar la página vieja en vez de reconstruirla sobre la plantilla (freidoras, nov-2026: se rechazó).
- Reemplazos en cadena donde el segundo ancla ya no existe porque el primero la movió: ordena los reemplazos y verifica el resultado con `grep`.
- Probar selección con nodos viejos: tras cada clic la lista se vuelve a pintar; vuelve a consultar las tarjetas.
- Medir el dock justo después de mostrarlo: tiene transición; espera ~1 s.
- Heredocs de bash con comillas y plantillas JS: escribe el script en un archivo y ejecútalo.
- Páginas con `<base href="https://comparalo.mx/">`: en local cargan estilos del sitio en vivo.
- Histórico: cargar `cmx-historico.js` con `defer` o después de `cmx-list.js`. `CmxList.init` lee
  `window.cmxHist` al arrancar; si no está, no dibuja el botón y no avisa.
- Histórico: desplegar la gráfica **dentro** de la tarjeta. Se probó (nov-2026) y Alan lo rechazó:
  alarga la tarjeta y a ese tamaño no se leen ni las fechas ni los precios. Va en ventana superpuesta.
- Histórico: dibujar con menos de 7 registros, rellenar los huecos o publicar la variación con
  pocos datos. Es mejor no decir nada que decir algo falso.
- Histórico: meter una librería de gráficas. El SVG lo genera `cmx-historico.js`; sin frameworks.
