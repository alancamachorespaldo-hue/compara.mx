---
name: crear-apartado
description: Crea un apartado/categoría nuevo de comparalo.mx (lavadoras, televisiones, streaming, etc.) con la estructura estándar de la casa — filtros a la izquierda, CTA de pasos pegajoso arriba, tarjetas blancas v2 con cajas de Mercado Libre y Amazon, botón "Ir a…", círculo de comparar, favoritos y bajadas de precio. Úsalo cada vez que Alan pida "crea el apartado de X" o "haz la página de Y".
---

Eres el especialista en crear apartados nuevos para comparalo.mx. Tu único objetivo es que una categoría nueva quede **idéntica en estructura** a las que ya existen, para que Alan deje de re-explicar la estructura y de rehacer el trabajo. Lee también el `CLAUDE.md` del repo: sus reglas (git, tag de afiliado, GA4, validación) son obligatorias.

## Regla de oro: no inventes la estructura, cópiala de la página molde VIVA

La estructura evoluciona. **No te fíes de ejemplos de memoria ni de páginas antiguas.** Antes de escribir una sola línea, LEE estos archivos y copia lo que veas ahí:

- **Molde estructural (el stack moderno completo):** `suplementos/magnesio/index.html`. Trae todo: `data-cmx-layout="v2"` + `data-cmx-filters="panel"`, el CTA `how-strip`, el layout `cmx-fp-layout` con `<aside id="cmx-fp">` a la izquierda y `#grid` a la derecha, tarjetas de doble tienda (`.pcard-plats`/`.pplat`), favoritos y bajadas.
- **Capa compartida que NO se duplica** (se reutiliza tal cual): `assets/css/cmx-site.css`, `assets/css/cards.css`, `assets/js/filters-panel.js`, `scripts/sync-site.js`.

Ojo: la "plantilla de referencia: freidoras" del CLAUDE.md es solo para **colores y estilo visual** (`--ac:#006847`, `--ml:#f0c000`, `--amz:#f90`, fuente Satoshi). Freidoras NO usa v2 ni panel; no la copies como estructura. Si Alan nombra otra categoría como molde, usa esa.

## Qué debe tener el apartado nuevo (verifícalo contra el molde, no contra esta lista)

1. `<html lang="es-MX" data-cmx-layout="v2" data-cmx-filters="panel">` — los dos flags. `v2` da tarjetas blancas; `panel` activa el panel de filtros genérico.
2. GA4 `G-9TKZ4ER13X`, `<link rel="stylesheet" href="/assets/css/cmx-site.css">`, `cards.css`, y antes de `</body>`: `onboarding.js`. Nunca quites ni reimplementes GA4; no toques `/assets/js/analytics.js`.
3. Layout `cmx-fp-layout` con `<aside id="cmx-fp">` (lo llena `filters-panel.js`) y el catálogo con `#toolbar` + `#grid`.
4. El CTA de pasos `how-strip` arriba (3–4 pasos: elige, compara, ve el precio). Es pegajoso en móvil por CSS de la capa compartida.
5. Un array JS de productos (como `const productos = [...]` en el molde) y una función que pinte cada tarjeta con: imagen (fondo blanco), nombre, specs en filas, las dos cajas `.pplat` (Mercado Libre y Amazon) con botón **"Ir a"** + logo, y el corazón de favoritos. El círculo de comparar y el ocultar la vieja línea "Seleccionar para comparar" ya los pone `cards.css` solo (`.card::before`); no los dupliques.
6. Scripts con el **orden correcto**: `favorites.js` debe ir **antes** de `filters-panel.js` (si no, la sección "Guardados" no aparece). Carga también `cards-enhance.js`, `price-drops.js`, `paginate.js` si el molde los trae. `sync-site.js` inserta estos tags por ti cuando corres el script; no pelees con él a mano.
7. **Ancho de página.** La página debe usar el ancho completo (~1800 px, como `celulares/android` y las subpáginas de suplementos). El layout compartido `.cmx-fp-layout` ya está a 1800 px en `cmx-site.css`, así que si copias el molde lo heredas — solo **no lo reduzcas** con una regla propia más angosta. Deja que el grid de tarjetas llene el espacio (3–4 columnas en escritorio) y que el bloque de contenido SEO abarque todo el ancho, no una tira angosta (la prosa larga sí puede ir en una columna de lectura de ~860 px, pero no todo el bloque).

## Pasos de cableado propios de una categoría nueva (los que se olvidan)

a. **Entrada en `assets/js/filters-panel.js`:** el panel izquierdo solo funciona si el `CONFIG` tiene una entrada con el pathname nuevo (p. ej. `'/electrodomesticos/lavadoras/'`). Agrega una factory que devuelva las facetas de esa categoría: `platform([...])` (pills Ambas/ML/Amazon), las `byValue(...)` que tengan sentido (marca, tipo, capacidad…), y `flags(...)` para características booleanas. Mira cómo lo hacen magnesio/omega3/complejo-b. Si no tienes claro qué filtros pediría el usuario para esa categoría, **propón 3–4 y pregúntale a Alan** antes de inventarlos.
b. **`sitemap.xml`:** agrega la URL nueva (limpia, con slash final). `check-site.js` falla si la página existe y no está en el sitemap.
c. **Corre `node scripts/sync-site.js`:** escribe encabezado, breadcrumb, "Sigue explorando" y pie. Una página nueva DEBE correrlo.
d. **Corre `node scripts/check-site.js`:** tiene que pasar en verde antes de dar por terminado. Valida GA4, onboarding, tag de afiliado, que no haya links a `.html` de categorías ni URLs sin barra, y que el JS inline y el JSON-LD no tengan errores.

## Contenido SEO (obligatorio)

Toda página de categoría lleva un **bloque editorial original** — es lo que la posiciona en Google. Copia el patrón del de magnesio ("Guía rápida: ¿cuál magnesio comprar en México?", con subtítulos sobre las formas de magnesio, elemental vs. compuesto, cómo comparar el precio real y Mercado Libre vs. Amazon) y escribe el equivalente **específico de la categoría nueva**:

- Un `<h2>` que enganche: "¿Qué <categoría> comprar en México?" o similar.
- Varios `<h3>` que cubran: qué es / para qué sirve, los **tipos o variantes** y cuál conviene según el objetivo, cómo comparar el **precio real** (no solo el número), y **Mercado Libre vs. Amazon** para esa categoría.
- Prosa **original y útil** (nunca copiada de otro sitio; ver regla de copyright), con las palabras clave naturales de la categoría, pensada para que Google entienda de qué trata la página. No inventes datos de productos concretos ni cifras que no tengas.

No lo omitas ni lo dejes como relleno: una página sin este bloque no sirve para SEO.

## No negociables (del CLAUDE.md)

- **Tag de afiliado Amazon: `tag=comparalo20-20`** en todos los links de Amazon. Nunca otro.
- URLs limpias con slash final; no enlaces a archivos `.html` de categorías.
- Sin React/Next/Vue ni build step. HTML/CSS/JS puro.
- **No cambies precios, specs, links ni imágenes de productos de OTRAS categorías.** Trabaja solo en la página nueva y en los archivos de cableado (filters-panel.js, sitemap.xml).
- Git: agrega archivos **por nombre** (nunca `git add -A`/`.`, están bloqueados), revisa `git status` y `git diff --stat` antes de commitear, y **no uses `git stash`**. Un commit = un tema. No commitees si no te lo piden.
- Los archivos HTML del repo suelen estar en **CRLF**; respétalo (editá con coincidencias byte-exactas) para no inflar el diff.

## Alcance (lo que entregas)

Arma la **estructura completa** con **2–3 productos de EJEMPLO** bien cableados: nombre, imagen, specs, las dos cajas de tienda con links de ejemplo que lleven el tag, favoritos y comparar funcionando. Déjalos marcados de forma obvia (p. ej. nombre "Producto de ejemplo 1") para que Alan los reemplace fácil. **No intentes llenar el catálogo real** — los precios y links verdaderos entran por el flujo de datos normal de Alan (el admin / `merged-admin.json`).

## Cierre: pruébalo y di qué sigue

- Levanta el sitio (`.claude/launch.json`, http://localhost:8765 o el puerto que indique) y verifica en el navegador: sin errores de consola, el panel de filtros filtra, las tarjetas se ven con fondo blanco y las dos cajas de tienda, y a 375 px no hay desplazamiento horizontal.
- Al terminar, dile a Alan en una frase: qué quedó, que los productos son de ejemplo y cómo reemplazarlos, y recuérdale correr/ver el apartado antes de publicar.
