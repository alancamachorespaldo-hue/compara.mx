---
name: crear-apartado
description: Crea un apartado/categoría nuevo de comparalo.mx (lavadoras, televisiones, streaming, etc.) con la estructura estándar de la casa — filtros a la izquierda, CTA de pasos pegajoso arriba, tarjetas blancas v2 con cajas de Mercado Libre y Amazon, botón "Ir a…", círculo de comparar, favoritos, bajadas de precio, ancho completo y bloque editorial SEO. Úsala cada vez que vayas a crear la página de una categoría nueva.
---

# Crear un apartado nuevo de comparalo.mx

Objetivo: que una categoría nueva quede **idéntica en estructura** a las que ya existen, sin re-explicar la estructura ni rehacer el trabajo. Lee también el `CLAUDE.md` del repo: sus reglas (git, tag de afiliado, GA4, validación) son obligatorias.

## Regla de oro: no inventes la estructura, cópiala de la página molde VIVA

La estructura evoluciona. **No te fíes de ejemplos de memoria ni de páginas antiguas.** Antes de escribir una sola línea, LEE estos archivos y copia lo que veas ahí:

- **Molde estructural (el stack moderno completo):** `suplementos/magnesio/index.html`. Trae todo: `data-cmx-layout="v2"` + `data-cmx-filters="panel"`, el CTA `how-strip`, el layout `cmx-fp-layout` con `<aside id="cmx-fp">` a la izquierda y `#grid` a la derecha, tarjetas de doble tienda (`.pcard-plats`/`.pplat`), favoritos y bajadas.
- **Capa compartida que NO se duplica** (se reutiliza tal cual): `assets/css/cmx-site.css`, `assets/css/cards.css`, `assets/js/filters-panel.js`, `scripts/sync-site.js`.

Ojo: la "plantilla de referencia: freidoras" del CLAUDE.md es solo para **colores y estilo visual** (`--ac:#006847`, `--ml:#f0c000`, `--amz:#f90`, fuente Satoshi). Freidoras NO usa v2 ni panel; no la copies como estructura. Si Alan nombra otra categoría como molde, usa esa.

## Qué debe tener el apartado nuevo (verifícalo contra el molde, no contra esta lista)

1. `<html lang="es-MX" data-cmx-layout="v2" data-cmx-filters="panel">` — los dos flags. `v2` da tarjetas blancas; `panel` activa el panel de filtros genérico.
2. GA4 `G-9TKZ4ER13X`, `<link rel="stylesheet" href="/assets/css/cmx-site.css">`, `cards.css`, y antes de `</body>`: `onboarding.js`. Nunca quites ni reimplementes GA4; no toques `/assets/js/analytics.js`.
3. Layout `cmx-fp-layout` con `<aside id="cmx-fp">` (lo llena `filters-panel.js`) y el catálogo con `#toolbar` + `#grid`.

   El input `precio-max` que activa el filtro de precio en el panel va **dentro de `#toolbar`** (que está en el `.filters` que ya se oculta con `display:none`), así que **NO le pongas `style="display:none"`**: `filters-panel.js` lo saca del DOM y lo inserta en el aside como el campo "Máx.", y si tiene el estilo inline sigue invisible en el panel. Patrón correcto:

   ```html
   <div class="filters" style="display:none">
     <div class="filters-row" id="toolbar">
       <input type="number" id="precio-max" min="0" step="100" oninput="render()">
       <select id="f-sort" onchange="render()">…</select>
     </div>
   </div>
   ```

   El panel mostrará automáticamente **Mín. — Máx.** (dos inputs) cuando el `id="precio-max"` exista.
4. El CTA de pasos `how-strip` arriba (3–4 pasos: elige, compara, ve el precio). Es pegajoso en móvil por CSS de la capa compartida.
5. Un array JS de productos (como `const productos = [...]` en el molde) y una función que pinte cada tarjeta con: imagen (fondo blanco), nombre, specs en filas con icono, las dos cajas `.pplat` (Mercado Libre y Amazon) con botón **"Ir a"** + logo, y el corazón de favoritos. El círculo de comparar y el ocultar la vieja línea "Seleccionar para comparar" ya los pone `cards.css` solo (`.card::before`); no los dupliques.

   ### Especificaciones con icono (patrón obligatorio)

   Las specs **NO** van en mini-cajas de grid (`.spec`). Usan filas con icono izquierda / label centro / valor derecha — copia el patrón de `suplementos/proteina/index.html`. CSS mínimo que siempre va en la `<style>` de la página nueva:

   ```css
   .pcard-metrics{display:flex;flex-direction:column;gap:0;margin-bottom:.4rem}
   .pmetric-row{display:flex;align-items:center;gap:7px;padding:5px 1px;border-bottom:1px dashed var(--bd)}
   .pmetric-row:last-child{border-bottom:none}
   .pmetric-ic{color:var(--ac);flex-shrink:0;display:flex;opacity:.85}
   .pmetric-lbl2{font-size:11.5px;color:var(--tx2);flex:1;min-width:0}
   .pmetric-val2{font-size:12.5px;font-weight:700;color:var(--tx);text-align:right;white-space:nowrap;margin-left:6px}
   ```

   En el JS define `const ico = { … }` con un SVG de 14×14 para cada clave de spec de la categoría. Iconos genéricos reutilizables (elige los que apliquen y añade los propios):

   ```js
   const ico = {
     // precio / costo
     precio:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
     costo:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
     // tipo / categoría
     tipo:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>`,
     // contenido / peso / capacidad
     contenido: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
     // porciones / capas / niveles
     porciones: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
     // almacenamiento / disco
     almacenamiento:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
     // pantalla / pulgadas / monitor
     pantalla:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
     // potencia / watts / energía
     potencia:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
     // procesador / CPU
     procesador:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
     // RAM / memoria
     ram:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="6" y2="18"/><line x1="10" y1="12" x2="10" y2="18"/><line x1="14" y1="12" x2="14" y2="18"/><line x1="18" y1="12" x2="18" y2="18"/></svg>`,
     // marca
     marca:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
     // condición / estado (nuevo / reacondicionado)
     condicion: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
     // accesorios / extras
     accesorios:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
     // generación / año
     generacion:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
     // lector de discos / disco físico
     lectorDiscos:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
     // comodín
     extras:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
   };
   ```

   Render de las filas de specs (extrae las claves relevantes de `p.especs` o del producto):

   ```js
   // array de [clave_ico, 'Etiqueta', valor_o_null]
   const metrics = [
     ['tipo',           'Tipo',          p.especs?.tipo ?? null],
     ['almacenamiento', 'Almacenamiento', p.especs?.almacenamiento ?? null],
     ['potencia',       'Potencia',       p.especs?.potenciaW ? p.especs.potenciaW + ' W' : null],
     // … añade las claves propias de la categoría
   ].filter(m => m[2] != null);

   const metricsHTML = metrics.length
     ? `<div class="pcard-metrics">${metrics.map(m =>
         `<div class="pmetric-row">
           <span class="pmetric-ic" aria-hidden="true">${ico[m[0]] || ico.extras}</span>
           <span class="pmetric-lbl2">${m[1]}</span>
           <span class="pmetric-val2">${m[2]}</span>
         </div>`).join('')}</div>`
     : '';
   ```
6. Scripts con el **orden correcto**: `favorites.js` debe ir **antes** de `filters-panel.js` (si no, la sección "Guardados" no aparece). Carga también `cards-enhance.js`, `price-drops.js`, `paginate.js` si el molde los trae. `sync-site.js` inserta estos tags por ti cuando corres el script; no pelees con él a mano.
7. **Ancho de página.** La página debe usar el ancho completo (~1800 px, como `celulares/android` y las subpáginas de suplementos). El layout compartido `.cmx-fp-layout` ya está a 1800 px en `cmx-site.css`, así que si copias el molde lo heredas — solo **no lo reduzcas** con una regla propia más angosta. Deja que el grid de tarjetas llene el espacio (3–4 columnas o más en escritorio) y que el bloque de contenido SEO abarque todo el ancho, no una tira angosta (la prosa larga sí puede ir en una columna de lectura de ~860 px, pero no todo el bloque).

## Pasos de cableado propios de una categoría nueva (los que se olvidan)

a. **Entrada en `assets/js/filters-panel.js`:** el panel izquierdo solo funciona si el `CONFIG` tiene una entrada con el pathname nuevo (p. ej. `'/electrodomesticos/lavadoras/'`). Agrega una factory que devuelva las facetas de esa categoría.

   **Filtro de tienda (obligatorio, siempre primero):** usa el objeto literal — NO el helper `platform()` — para poder poner el título "Tienda" y los logotipos de cada plataforma en el label (el constructor renderiza el label como innerHTML):

   ```js
   { id: 'plataforma', title: 'Tienda', mode: 'or', pills: true, opts: [
     { v: 'todos', label: 'Ambas', all: true, test: function () { return true; } },
     { v: 'amz', label: '<img src="/logoamazon.png" alt="Amazon" style="height:16px;vertical-align:middle">', test: function (p) { return !!p.linkAmz; } },
     { v: 'ml',  label: '<img src="/logomercado.png" alt="Mercado Libre" style="height:18px;vertical-align:middle">', test: function (p) { return !!p.linkML; } }
   ]},
   ```

   Después agrega las facetas propias: `byValue(...)` (marca, tipo, capacidad…) y `flags(...)` para booleanos. Mira cómo lo hacen magnesio/omega3/complejo-b. Si no tienes claro qué filtros pediría el usuario para esa categoría, **propón 3–4 y pregúntale a Alan** antes de inventarlos.
b. **`sitemap.xml`:** agrega la URL nueva (limpia, con slash final). `check-site.js` falla si la página existe y no está en el sitemap.
c. **Corre `node scripts/sync-site.js`:** escribe encabezado, breadcrumb, "Sigue explorando" y pie. Una página nueva DEBE correrlo.
d. **Corre `node scripts/check-site.js`:** tiene que pasar en verde antes de dar por terminado. Valida GA4, onboarding, tag de afiliado, que no haya links a `.html` de categorías ni URLs sin barra, y que el JS inline y el JSON-LD no tengan errores.
e. **Siempre haz commit y push al terminar.** Agrega los archivos por nombre (`git add <archivo1> <archivo2>…`), revisa `git diff --stat --cached`, haz commit con mensaje descriptivo y luego `git push`. No dejes cambios sin publicar.

## Contenido SEO (obligatorio)

Toda página de categoría lleva un **bloque editorial original** — es lo que la posiciona en Google. Copia el patrón del de magnesio ("Guía rápida: ¿cuál magnesio comprar en México?", con subtítulos sobre las formas de magnesio, elemental vs. compuesto, cómo comparar el precio real y Mercado Libre vs. Amazon) y escribe el equivalente **específico de la categoría nueva**:

- Un `<h2>` que enganche: "¿Qué <categoría> comprar en México?" o similar.
- Varios `<h3>` que cubran: qué es / para qué sirve, los **tipos o variantes** y cuál conviene según el objetivo, cómo comparar el **precio real** (no solo el número), y **Mercado Libre vs. Amazon** para esa categoría.
- Prosa **original y útil** (nunca copiada de otro sitio), con las palabras clave naturales de la categoría, pensada para que Google entienda de qué trata la página. No inventes datos de productos concretos ni cifras que no tengas.

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
