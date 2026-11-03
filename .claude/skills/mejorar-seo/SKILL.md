---
name: mejorar-seo
description: Audita y mejora el SEO de una página de comparalo.mx (categorías, guías o el inicio) sin tocar precios ni datos de productos. Revisa y corrige title, meta description, canonical, Open Graph/Twitter, H1 y jerarquía de encabezados, el bloque editorial, el JSON-LD (datos estructurados), los enlaces internos, el alt de las imágenes y el sitemap. Úsala cuando quieras posicionar mejor una página o antes de publicar un apartado nuevo.
---

# Mejorar el SEO de una página de comparalo.mx

Objetivo: subir el SEO de una página **sin cambiar precios, specs, links ni imágenes de productos** (eso lo prohíbe el `CLAUDE.md`). Trabajas sobre el HTML y los datos estructurados, no sobre el catálogo. Lee también el `CLAUDE.md`: sus reglas son obligatorias.

## Regla de oro: audita la página VIVA y compárala con una bien posicionada

No trabajes de memoria. Antes de cambiar nada:
1. Lee la página que te pidieron mejorar.
2. Lee una página de **referencia del mismo tipo** para copiar el patrón que ya funciona:
   - Categoría → `suplementos/magnesio/index.html`.
   - Guía/artículo → `guias/celulares/mejores-celulares-menos-5000/index.html`.
3. Si no te dicen qué página, pregunta cuál (o si es "todo el sitio", ve una por una y empieza por las de más tráfico).

Para una **auditoría completa con puntuación** (0–100, crawl, rendimiento), existe la skill `anthropic-skills:auditoría-seo`; úsala como diagnóstico y luego aplica los arreglos con esta. Esta skill es la **editora específica de la casa**.

## Principios (lo que recomienda Google y los mejores SEOs)

Guíate por esto en cada decisión, no por trucos viejos:

- **Contenido para personas, no para el buscador** (Google "Helpful Content"). El texto debe ayudar de verdad a decidir una compra; si solo repite la keyword, está mal.
- **E-E-A-T** (experiencia, pericia, autoridad, confianza): el ángulo propio de comparalo.mx es comparar el **mismo producto en Mercado Libre vs. Amazon** y mostrar el precio real. Ese es el valor que nadie más da; hazlo explícito en el texto.
- **Intención de búsqueda primero.** Antes de escribir, piensa qué busca realmente quien llega: ¿comparar?, ¿el más barato?, ¿cuál conviene para X? El contenido debe responder esa intención, no describir sin más.
- **Profundidad y entidades del tema.** Cubre los subtemas y términos que un comprador de ESA categoría busca (ver punto 6). Google premia cubrir bien el tema, no la densidad de keyword.
- **Nada de keyword stuffing.** Keyword principal en title, H1, primer párrafo y donde caiga natural; el resto, lenguaje humano.
- **Titles y descriptions únicos y descriptivos**, que digan qué hay en la página y den ganas de hacer clic (CTR). Sin clickbait.
- **Frescura**: año visible y precios que se actualizan solos ya juegan a favor; no prometas datos que no tengas.
- **Legible**: frases cortas, subtítulos claros, listas cuando ayuden. Original siempre (copyright).

## Qué revisar y corregir (checklist)

1. **`<title>`** — único en todo el sitio, ~50–60 caracteres, con la keyword principal al inicio + "México" + el año. Sigue el formato de la casa: `Mejor <Categoría> México 2026: Compara Precios` (categoría) o un titular claro con keyword (guía). Nunca dos páginas con el mismo title.
2. **`<meta name="description">`** — 150–160 caracteres, con la keyword natural y la propuesta de valor real (comparar el mismo producto en Mercado Libre y Amazon). Sin relleno ni promesas falsas. Única por página.
3. **`<link rel="canonical">`** — apunta a la **URL limpia con slash final** de esa misma página (self-referencing). Nunca a `.html` ni a otra página.
4. **Open Graph y Twitter completos** — `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale`; y Twitter `summary_large_image` con `twitter:title`, `twitter:description`, `twitter:image`. Varias páginas solo traen `twitter:image`: complétalas. `og:url` = la URL canónica.
5. **Un solo `<h1>`**, con la keyword principal, y jerarquía correcta de `h2`/`h3` (sin saltos, sin usar encabezados por estilo). Los subtítulos deben describir subtemas reales.
6. **Bloque editorial, ADAPTADO a cada categoría** — es lo que más posiciona, y es el foco cuando te pidan "mejorar el SEO del texto". No uses un molde fijo: **piensa qué busca y qué duda tiene quien compra ESA categoría** y escribe para eso. El patrón estructural (un `<h2>` gancho + varios `<h3>`) sale del de magnesio, pero los **subtemas y las palabras son propios de la categoría**. Ejemplos de en qué se fija cada comprador:
   - Lavadoras → capacidad en kg, carga frontal vs. superior, consumo de agua/luz, nivel de ruido, ciclos.
   - Televisiones → pulgadas y a qué distancia, panel (OLED/QLED/LED), resolución y HDR, smart TV y apps, HDMI.
   - Streaming → catálogo y estrenos, precio mensual vs. anual, pantallas simultáneas, 4K, con/sin anuncios, dispositivos.
   Cubre siempre, en el lenguaje de la categoría: **qué es / para qué sirve y cómo elegir**, los **tipos o variantes y cuál conviene según el objetivo**, **cómo comparar el precio real** (no solo el número), y **Mercado Libre vs. Amazon** para ese producto. Si el bloque falta, agrégalo; si existe pero es genérico o pobre, reescríbelo con la profundidad y las entidades reales del tema. Prosa **original** (respeta copyright: nunca copies de otro sitio) y sin inventar datos de productos ni cifras. Si no conoces bien la categoría, investígala antes de escribir (y no te inventes especificaciones).
7. **Datos estructurados (JSON-LD)** apropiados al tipo de página, y que **parseen** (`check-site.js` lo valida):
   - Categoría: `WebPage` + `BreadcrumbList` + `ItemList` (con los productos de la página) + `Organization`.
   - Guía/artículo: `Article` + `BreadcrumbList` + `FAQPage` (si la página responde preguntas, con `Question`/`Answer` reales del contenido).
   - El `BreadcrumbList` debe coincidir con el breadcrumb visible. No metas datos que no estén en la página visible (Google penaliza el marcado que no corresponde al contenido).
8. **Enlaces internos** — breadcrumb correcto y la sección "Sigue explorando" (`cmx-related`) apuntando a guías y categorías relevantes. Enlaza categoría ↔ sus guías en ambos sentidos. Texto de enlace descriptivo, no "clic aquí".
9. **Imágenes** — `alt` descriptivo (nombre real del producto/tema, no vacío ni "imagen"), `loading="lazy"` y `width`/`height` para no mover el layout. No cambies las imágenes de producto, solo su `alt` si hace falta.
10. **`sitemap.xml`** — la URL indexable debe estar listada (con slash final). Si la página es `noindex` a propósito, no va.

## No negociables (del CLAUDE.md)

- **No cambies precios, specs, ratings, número de reseñas, imágenes, links ni IDs de productos.** El SEO se mejora en title/meta/estructura/contenido editorial, no tocando el catálogo.
- **GA4 `G-9TKZ4ER13X`** debe seguir en todas las páginas; no lo quites ni lo reimplementes. No toques `/assets/js/analytics.js`.
- URLs limpias con slash final; no enlaces a `.html` de categorías. Tag de afiliado `comparalo20-20` intacto en los links de Amazon.
- Sin frameworks ni build step. Contenido original (copyright). No inventes datos ni cifras.
- Git: agrega archivos **por nombre** (nunca `git add -A`/`.`), revisa `git status` y `git diff --stat`, no uses `git stash`, un commit = un tema, no commitees si no te lo piden. Respeta el **CRLF** de los HTML (ediciones byte-exactas).

## Cierre: valida y resume

- Corre `node scripts/check-site.js` — tiene que pasar en verde (valida JSON-LD, sitemap, GA4, tag, etc.). Si falla, no termines.
- Si el cambio es visible, pruébalo en el navegador (`.claude/launch.json`).
- Dile a Alan en pocas líneas: qué página tocaste, qué mejoraste (title/description/OG/JSON-LD/contenido/enlaces) y qué queda pendiente de criterio suyo (p. ej. elegir keyword o texto editorial).
