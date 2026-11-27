---
name: comparalo-crear-guia-oferta-amazon
description: Crea un artículo-guía de oferta Amazon interactivo para comparalo.mx (guias/laptops/, guias/celulares/, guias/electrodomesticos/, etc.) a partir de un JSON de productos generado por ChatGPT. El artículo usa la plantilla cg de tres columnas (índice y comparador a la izquierda, artículo al centro, consejos de compra a la derecha) con barra de comparación, veredictos, filtros y paneles móviles, y cumple todas las políticas de Amazon Associates. Úsalo cuando Alan diga "crea el artículo de X", "crea la guía oferta Amazon de Y", "publica la guía de Y" o te pase un JSON con productos para convertir en artículo.
---

Eres el especialista en crear artículos-guía de oferta Amazon interactivos para comparalo.mx. Tu objetivo: convertir un JSON de productos (generado por ChatGPT u otro proceso) en un artículo HTML completo, interactivo, con el diseño de la casa y en pleno cumplimiento con las políticas de Amazon Associates, listo para publicar con `sync-site.js`.

## Regla de oro: copia la estructura VIVA, no la memoria

Lee siempre el molde antes de escribir una sola línea:

- **Molde principal (plantilla `cg`, la vigente desde nov-2026):** `guias/laptops/macbook-reacondicionadas/index.html`
- **CSS compartido:** `assets/css/cmx-site.css` + `assets/css/cmx-guia.css` + `assets/css/cmx-guia-amz.css`
- **JS compartido:** `assets/js/cmx-guia-amz.js` (lee el contrato en su cabecera antes de escribir)
- **Ejemplo con 6 productos y fichas repetidas:** `guias-compra/smartwatches/mejores-smartwatches-xiaomi-en-mexico/index.html`
- **Reglas del sitio:** `CLAUDE.md` (obligatorio; tag afiliado, GA4, onboarding.js, check-site.js)

> **La plantilla vieja (`.product` / `.cards` / `.toc` con CSS en línea, como
> `guias/laptops/mejores-macbook-calidad-precio/`) ya NO se usa para guías nuevas.** Era una
> columna de artículo con un comparador propio escrito a mano en cada guía. La plantilla `cg`
> es de tres columnas, reutiliza CSS y JS del sitio y trae barra de comparación, paneles
> móviles y veredictos. No copies el molde viejo ni mezcles las dos.

---

## Workflow de entrada: JSON + HTML de ChatGPT

Alan te pasará **dos archivos**:
1. **JSON** (`comparalo-*.json`) — fuente de verdad con ASINs, URLs de imagen de Amazon CDN, URLs de afiliado, specs técnicas verificadas y notas de discrepancias
2. **HTML** de ChatGPT — contenido editorial ya redactado (secciones, análisis, FAQ, fuentes)

Tu trabajo es **combinarlos** en el HTML final de comparalo.mx: tomar el contenido editorial del HTML de ChatGPT y adaptarlo a la estructura de la casa (hero, TOC sticky, tarjetas con comparador), añadiendo los datos del JSON (imágenes, links, specs).

Notas clave al leer el JSON:
- Usa el campo `asin` para construir el link directo: `https://www.amazon.com.mx/dp/{ASIN}?tag=guiasdecomp01-20`
- **No uses** los `affiliate_url` del JSON si son `link.amazon/...` (acortadores que ocultan el destino y no pasan check-site.js); construye siempre el link directo con ASIN + tag
- Usa `image_url` del JSON para las imágenes de tarjeta. Si el HTML corregido trae una imagen mejor (p. ej. de Lenovo PSREF oficial), úsala, pero anótalo como "imagen de referencia"
- Si hay `internal_notes` con advertencias o `discrepancies`, ponlas en el `<div class="caution">` de la tarjeta
- Productos con `review_status: "pending"` y datos muy contradictorios (rating=1, 1 sola reseña, specs sin confirmar) se pueden excluir si ChatGPT ya los dejó fuera del análisis

---

## Regla de precios: nunca publicar precios concretos

**Nunca** incluyas un precio numérico ($23,999, $21,799, etc.) en ninguna parte del HTML publicado:
- Los precios del JSON son **observaciones históricas internas**, no precios vigentes
- Publicar un precio que no es en tiempo real (sin PA API) es violación de políticas de Amazon
- En su lugar, usa el botón "Ver precio en Amazon →" o frases como "precio verificado en Amazon"
- Si quieres dar contexto de rango (opcional, solo si añade valor editorial), usa frases como:
  - "la opción más accesible de esta selección" / "la variante de mayor precio de las tres"
  - "entre $20,000 y $30,000 MXN según el momento" (rango amplio, solo si lo puedes respaldar)
- **No menciones** los precios observados del JSON en el HTML final

---

## Qué necesitas para empezar

Antes de escribir el HTML, extrae del JSON y del HTML de ChatGPT:

| Campo | Descripción |
|---|---|
| `slug` | Ruta final, p. ej. `guias/laptops/mejores-laptops-gaming` |
| `categoria_padre` | Para el breadcrumb y la card en el índice, p. ej. `guias-compra/laptops/` |
| `titulo` | H1 del artículo |
| `descripcion` | Meta description (155 chars max) |
| `fecha` | `YYYY-MM-DD` |
| `productos[]` | Array con los datos de cada producto (ver estructura abajo) |
| `filtros[]` | Dimensiones del configurador (condición, marca, RAM, precio…) |
| `faq[]` | Preguntas frecuentes (5–8) |
| `fuentes[]` | Links a specs oficiales |

### Estructura de cada producto en el JSON

```json
{
  "id": "slug-unico",
  "nombre": "Nombre completo del modelo",
  "imagen": "URL de imagen (CDN oficial preferido; fallback emoji en caution)",
  "badges": ["Nuevo", "Intel Core Ultra 7"],
  "specs_line": "Procesador · RAM · SSD · Pantalla",
  "bullets": ["Punto 1", "Punto 2", "Punto 3", "Punto 4"],
  "caution": "Advertencia sobre el anuncio/datos (opcional)",
  "link_amz": "https://www.amazon.com.mx/dp/ASIN?tag=guiasdecomp01-20",
  "data": {
    "condition": "new|renewed",
    "brand": "asus|hp|lenovo|apple|acer|dell|otro",
    "ram": "8|16|32",
    "ssd": "256|512|1000",
    "precio_rango": "bajo|medio|alto"
  },
  "specs_completas": {
    "Procesador": "...",
    "RAM": "...",
    "Almacenamiento": "...",
    "Pantalla": "...",
    "Batería": "...",
    "Puertos": "...",
    "Peso": "...",
    "Uso ideal": "..."
  }
}
```

---

## Estructura del HTML que debes generar

### 1. `<head>` completo

```html
<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
<title>{titulo} | comparalo.mx</title>
<meta name="description" content="{descripcion}">
<link rel="canonical" href="https://comparalo.mx/{slug}/">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="author" content="comparalo.mx">
<meta name="theme-color" content="#006847">
<meta name="geo.region" content="MX">
<link rel="alternate" hreflang="es-MX" href="https://comparalo.mx/{slug}/">

<!-- OG / Twitter -->
<meta property="og:type" content="article">
<meta property="og:url" content="https://comparalo.mx/{slug}/">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descripcion}">
<meta property="og:locale" content="es_MX">
<meta property="og:site_name" content="comparalo.mx">
<meta property="article:published_time" content="{fecha}">
<meta property="article:section" content="{categoria_legible}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@comparalomx">
<meta name="twitter:title" content="{titulo}">
<meta name="twitter:description" content="{descripcion}">

<!-- JSON-LD: Article + BreadcrumbList + FAQPage -->
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"Article","headline":"{titulo}","description":"{descripcion}","datePublished":"{fecha}","dateModified":"{fecha}","inLanguage":"es-MX","author":{"@type":"Organization","name":"comparalo.mx","url":"https://comparalo.mx/sobre-nosotros/"},"publisher":{"@type":"Organization","name":"comparalo.mx","url":"https://comparalo.mx","logo":{"@type":"ImageObject","url":"https://comparalo.mx/logopng.png"}},"mainEntityOfPage":"https://comparalo.mx/{slug}/","url":"https://comparalo.mx/{slug}/"},
 {"@type":"BreadcrumbList","itemListElement":[
   {"@type":"ListItem","position":1,"name":"Inicio","item":"https://comparalo.mx/"},
   {"@type":"ListItem","position":2,"name":"Guías de compra","item":"https://comparalo.mx/guias-compra/"},
   {"@type":"ListItem","position":3,"name":"{categoria_legible}","item":"https://comparalo.mx/{categoria_padre}/"},
   {"@type":"ListItem","position":4,"name":"{titulo_corto}","item":"https://comparalo.mx/{slug}/"}
 ]},
 {"@type":"FAQPage","mainEntity":[
   {para cada FAQ: {"@type":"Question","name":"...","acceptedAnswer":{"@type":"Answer","text":"..."}}}
 ]}
]}
</script>

<!-- GA4 — NO modificar -->
<script>if(location.search.includes('bot=claude'))window['ga-disable-G-9TKZ4ER13X']=true;</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9TKZ4ER13X"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-9TKZ4ER13X');</script>
<script src="/assets/js/analytics.js" defer></script>

<!-- Fuentes + íconos -->
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preload" as="style" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap" rel="stylesheet"></noscript>
<link rel="icon" type="image/png" href="/logopng.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/assets/css/cmx-site.css">
<link rel="stylesheet" href="/assets/css/cmx-guia.css">
<link rel="stylesheet" href="/assets/css/cmx-guia-amz.css">

<!-- Único <style> del <head>: el aviso de afiliados. Todo lo demás va en el CSS compartido -->
<style>
.cg-amz-disc{background:#fff8ec;border:1px solid #f1dcae;border-left:4px solid var(--amz);border-radius:10px;padding:13px 16px;margin:0 0 16px;font-size:13.5px;color:#6b4e14;line-height:1.55}
.cg-amz-disc strong{color:#4d3a0f}
</style>
</head>
```

### 2. CSS: compartido, no local

**No copies un bloque `<style>` gigante dentro de la guía.** La plantilla `cg` vive en archivos
del sitio y se enlaza en este orden exacto:

```html
<link rel="stylesheet" href="/assets/css/cmx-site.css">
<link rel="stylesheet" href="/assets/css/cmx-guia.css">
<link rel="stylesheet" href="/assets/css/cmx-guia-amz.css">
```

`cmx-guia.css` trae la rejilla de tres columnas, el índice, el hero, la respuesta rápida, los
criterios, las tablas, las fichas de modelo, el FAQ, la barra de comparación y los paneles
móviles. `cmx-guia-amz.css` es el hermano para guías **solo de Amazon**: botón naranja, tarjetas
de dos por fila, caución, columna derecha editorial y el bloque del veredicto.

Lo único que va en un `<style>` propio de la guía son dos cosas pequeñas:
1. `.cg-amz-disc` (el aviso de afiliados sobre el artículo), y
2. el bloque de los filtros (`.config`, `.config-row`, `.filter`, `.config-result`,
   `.cg-card[hidden]`, `.compare-output`), que va al final junto a su script.

Cópialos tal cual del molde. Si necesitas un estilo nuevo que otras guías vayan a usar, va a
`cmx-guia-amz.css`, no a la página.

### 3. `<body>`: clase `cg` y los datos de la guía

```html
<body class="cg" data-guide-id="{slug-corto}" data-category="{categoria}-amazon">
```

Después, header y breadcrumb entre marcadores (los llena `sync-site.js`):

```html
<!-- cmx-header:start -->…<!-- cmx-header:end -->
<!-- cmx-bc:start --><div class="cmx-bc"><ol aria-label="Ruta de navegación"><li><a href="/">Inicio</a></li><li><a href="/guias-compra/">Guías de compra</a></li><li><a href="/{categoria_padre}">{categoria_legible}</a></li><li aria-current="page">{titulo_corto}</li></ol></div><!-- cmx-bc:end -->
```

### 4. Las tres columnas: `<div class="cg-wrap">`

```
cg-wrap
├── aside.cg-left    → índice + consejo + módulo Compáralo + botón de consejos
├── main.cg-main     → el artículo entero
└── aside.cg-right   → consejos de compra, confianza y más guías (NO ofertas: Amazon no deja precios)
```

**Columna izquierda** (copia el molde y cambia solo los textos):

```html
<aside class="cg-left" aria-label="Índice y comparador">
  <nav class="cg-box" aria-label="Contenido de la guía">
    <div class="cg-box-h">Guía de contenido</div>
    <div class="cg-box-b">
      <ol class="cg-toc" id="cg-toc">
        <li><a href="#sec-respuesta">Respuesta rápida</a></li>
        …
        <li data-cg-group><a href="#sec-modelos">Los modelos</a>
          <ul><li><a href="#sec-{id}">{corto}</a></li>…</ul>
        </li>
        …
      </ol>
    </div>
  </nav>
  <div class="cg-tip"><strong>💡 Consejo clave</strong>{una frase que resuelva la duda más cara de la categoría}</div>
  <div class="cg-box cg-cmpmod">
    <div class="cg-box-b">
      <h2><img src="/logopng.png" alt="" width="26" height="26"> Compáralo <small>hasta <span data-cg-max>3</span> {productos}</small></h2>
      <div class="cg-slots" id="cg-slots"></div>
      <button type="button" class="cg-btn cg-btn-ac cg-w100" data-cg-go data-ga-section="modulo_comparar" disabled><span>Comparar ahora (<span data-cg-count>0</span>/<span data-cg-max>3</span>)</span></button>
      <button type="button" class="cg-btn cg-btn-ghost cg-w100" data-cg-clear>Limpiar selección</button>
    </div>
  </div>
  <button type="button" class="cg-btn cg-btn-amz cg-of-open" data-cg-open="guide" data-ga-section="columna_izquierda">📋 Ver consejos de compra</button>
</aside>
```

El `id="cg-toc"` es obligatorio: el JS clona ese índice dentro del `<details class="cg-toc-mob">`
y del panel móvil. Nunca escribas el índice tres veces a mano.

**Columna derecha**: `.cg-box.cg-editorial` con consejos de compra concretos de la categoría,
`.cg-trust` con la nota de devoluciones, y un `.cg-box` de «Más guías de compra» con
`ul.cg-guias-rel`. Aquí **no van ofertas ni precios**.

### 5. El artículo (`main.cg-main`), sección por sección

Toda sección que deba aparecer en el índice lleva `id="sec-…"` **y** el atributo `data-cg-sec`
(es lo que usa el scroll-spy). En este orden:

1. **`header.cg-hero`** — `.cg-eyebrow`, `<h1>`, `p.cg-intro`, `ul.cg-meta` (autor, actualizado,
   lectura, «Solo productos de Amazon México») y `.cg-hero-img` con una imagen.
2. **`div.cg-amz-disc`** — el aviso de afiliados, **antes de cualquier enlace de afiliado**.
3. **`section.cg-quick#sec-respuesta`** — la respuesta rápida: `.cg-quick-ic`, una `<ul>` donde
   cada ítem es «{necesidad}: {producto enlazado} {motivo}» con su botón
   `button.cg-mini-cmp[data-cg-sel][data-cg-lbl="short"]`, un `p.cg-note` que diga que no hay
   ganador absoluto y un `a.cg-btn.cg-btn-ac` al resumen.
4. **`details.cg-toc-mob`** — con `<nav data-cg-toc-clone></nav>` vacío (lo llena el JS).
5. **Sección editorial previa** (`#sec-como-leer`, `#sec-que-revisar`…) — de dónde salen los
   datos, un `div.cg-callout` con la regla de la casa, y `ul.cg-crit` con 5-7 criterios
   (cada `<li>` lleva un `<svg>`, un `<strong>` y una frase corta).
6. **`section#sec-comparativa`** — tabla estática `table.cg-tbl` dentro de `div.cg-tblw`, con
   `p.cg-tbl-hint` encima y una última fila `<tr data-cg-card="tabla-row">` de casillas
   `input[type=checkbox][data-cg-sel]`. Si hay más de 4-5 productos, la tabla resume los
   **modelos distintos** y las fichas repetidas se explican en las tarjetas.
7. **`div#sec-comparativa-personalizada`** — el contenedor que llena el JS:
   ```html
   <div class="compare-output" id="cg-compare-output">
     <h3>Comparativa seleccionada</h3>
     <div id="cg-compare-verdict"></div>
     <p class="cg-note" style="margin-bottom:10px">Sin precios: los botones llevan a cada ficha en Amazon.</p>
     <div id="cg-compare-table"></div>
   </div>
   ```
8. **`section#sec-modelos`** — filtros `details.config.config-collapse` + `div.cg-cards#productCards`
   con las tarjetas + una ficha `div.cg-model#sec-{id}` por producto.
9. **`section#sec-cual-conviene`** — `div.cg-picks` con `div.cg-pick` por caso de uso
   (`<h3>`, `<p>`, `a.cg-btn.cg-btn-line` al análisis).
10. **Secciones editoriales propias de la categoría** (qué mirar, trampas, checklist…).
11. **`section.cg-sec.cg-faq#sec-faq`** — `<details><summary>…<span>+</span></summary><p class="cg-faq-b">`.
12. **`section#sec-fuentes`** — fuentes oficiales y cómo se seleccionó y ordenó.
13. **`p.cg-disc`** — el aviso de afiliados largo, al cierre.

### 6. Tarjeta de producto (`.cg-card`)

```html
<article class="cg-card" data-id="{id}" data-cg-card="{id}" data-{faceta}="{valor}" …>
  <div class="cg-card-top">
    <img src="{imagen}" alt="{nombre}" loading="lazy" referrerpolicy="no-referrer">
    <div><span class="cg-tag">ASIN {ASIN} · {dato corto}</span>
      <h3><a href="#sec-{id}" data-cg-prod="{id}" data-ga-section="tarjeta">{nombre}</a></h3>
      <ul><li>{bullet}</li>…</ul>
    </div>
  </div>
  <div class="cg-caution">{lo que no cuadra en la ficha, sin corregirlo}</div>
  <button type="button" class="cg-btn cg-btn-line" data-cg-sel="{id}" data-cg-lbl="full" data-ga-section="tarjeta" aria-pressed="false">＋ Seleccionar para comparar</button>
  <a class="cg-btn cg-btn-amz" href="https://www.amazon.com.mx/dp/{ASIN}?tag=guiasdecomp01-20" target="_blank" rel="sponsored nofollow noopener" data-amz="{nombre}" data-loc="tarjeta">Ver precio en <img src="/logoamazon.png" alt="Amazon" onerror="this.outerHTML='Amazon'"> <span aria-hidden="true">&#8599;</span></a>
</article>
```

El `onclick` con `gtag` **ya no se escribe**: el clic de afiliado lo mide `cmx-guia-amz.js` por
delegación a través de `data-amz` y `data-loc`. Poner los dos duplicaría el evento.

### 7. Ficha de modelo (`.cg-model`), una por producto

```html
<div class="cg-model" id="sec-{id}" data-cg-sec style="margin-top:28px">
  <div>
    <h3>{nombre corto}: {la frase que lo define}</h3>
    <p>{2-4 oraciones de análisis real: para quién es y qué sacrifica}</p>
    <div class="cg-pros"><h3>A favor</h3><ul><li>…</li></ul></div>
  </div>
  <aside class="cg-pc">
    <div class="cg-pc-img"><img src="{imagen}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
    <h3>{corto}</h3>
    <table class="cg-specs"><tr><th>{spec}</th><td>{valor}</td></tr>…</table>
    <a class="cg-btn cg-btn-amz cg-w100" href="…?tag=guiasdecomp01-20" target="_blank" rel="sponsored nofollow noopener" data-amz="{nombre}" data-loc="analisis">Ver precio en <img src="/logoamazon.png" alt="Amazon" onerror="this.outerHTML='Amazon'"> <span aria-hidden="true">&#8599;</span></a>
  </aside>
</div>
```

Cada `data-cg-prod="{id}"` del artículo debe tener su `#sec-{id}` o el enlace no lleva a ningún
lado. Si dos fichas son del mismo modelo, **cada una lleva su ancla y su análisis**: lo que las
distingue es justo lo que hay que contarle al lector.

### 8. Pie de página funcional: barra, paneles móviles y datos

Antes del footer, copia del molde (solo cambian los textos y el enlace de categoría):

- `div.cg-bar#cg-bar` con `#cg-bar-t`, `#cg-bar-chips` y los botones `[data-cg-go]` / `[data-cg-clear]`
- `div.cg-toast#cg-toast`
- `nav.cg-nav` con cuatro botones: Índice · Consejos · **Compáralo** (con `span#cg-nav-n`) · un
  `<a>` a la categoría del sitio
- `div.cg-bd#cg-bd` y los tres paneles `#cg-sheet-index`, `#cg-sheet-guide`, `#cg-sheet-compare`
  (este último con `#cg-sel-hint` y `#cg-sel-list`)

### 9. Los datos: `window.CMX_GUIA_AMZ`

**No escribas el comparador.** Ya existe en `assets/js/cmx-guia-amz.js`. La guía solo declara sus
datos antes de cargarlo:

```html
<script>
window.CMX_GUIA_AMZ={
  id:'{slug-corto}', category:'{categoria}-amazon', max:3,
  categoryHref:'/{categoria del sitio}/', categoryLabel:'{Categoría}',
  veredictoFallback:'{qué mirar en esta categoría cuando no hay veredicto escrito para esa combinación}',
  productos:[
    {id:'{id}', nombre:'{nombre completo}', corto:'{nombre corto para la tabla}', img:'{imagen}', link:'https://www.amazon.com.mx/dp/{ASIN}?tag=guiasdecomp01-20', especs:[['{etiqueta}','{valor}'],…]},
    …
  ],
  veredictos:{
    '{idA}__{idB}':'{qué conviene de esos dos y por qué}',
    …
  }
};
</script>
<script src="/assets/js/cmx-guia-amz.js" defer></script>
<script src="/assets/js/share.js" defer></script>
<script src="/js/onboarding.js" defer></script>
```

Reglas de este objeto:

- **`especs` usa las MISMAS etiquetas en todos los productos**, en el mismo orden. El comparador
  arma las filas con la unión de las etiquetas y pone «—» donde falte, así que etiquetas distintas
  para el mismo dato («Pantalla» y «Display») producen dos filas medio vacías.
- Cuando un valor de la ficha no se puede interpretar, escribe `'Ver nota'` y explícalo en la
  caución. Nunca inventes ni normalices un dato técnico; el GPS y cosas así se normalizan **solo
  en lo que se muestra**, y se dice en metodología.
- **Las claves de `veredictos` son los ids ordenados alfabéticamente y unidos por `__`**
  (`sel.slice().sort().join('__')`). Si la clave no está ordenada, nunca se usa.
- Escribe **todos los pares** (con N productos son N·(N−1)/2) y los tríos que de verdad alguien
  compararía. Para el resto, `veredictoFallback` da un texto de categoría; sin él se usa un
  texto genérico escrito para guías de reacondicionados que no encaja en otras categorías.
- Un veredicto dice **qué conviene y por qué**, no repite la tabla. Si dos fichas son del mismo
  modelo, el veredicto es exactamente eso: cuál anuncio describe mejor lo que compras.

### 10. Filtros (el único JS propio de la guía)

Al final, el bloque de filtros con sus `data-*` y su `<style>`. Cópialo del molde y cambia las
facetas por las de la categoría. Las facetas del HTML (`data-serie`, `data-gps`…) y las claves del
objeto `filters` del JS **deben coincidir una a una**, y los `data-val` de los botones deben
coincidir con los valores de las tarjetas. Cierra con `<script src="/js/site-nav.js" defer></script>`.

---

## Configurador: qué filtros generar según categoría

| Categoría | Facetas recomendadas |
|---|---|
| Laptops | condition (Nuevo/Reacondicionado), brand (marca), ram (8/16/32 GB), ssd (256/512/1 TB) |
| Celulares | condition, brand, ram, almacenamiento |
| Freidoras/Electrodomésticos | brand, capacidad, tipo |
| Suplementos | brand, presentación, sabor |

Adapta los `data-*` del HTML y los `facets` del JS a las dimensiones reales de los productos.

---

## Tabla comparativa rápida (sección `#sec-comparativa`)

Tabla estática `table.cg-tbl` dentro de `div.cg-tblw`, con una última fila de casillas `[data-cg-sel]` en lugar de la fila de CTA (los botones ya están en las tarjetas, en las fichas y en el comparador). Mínimo de columnas útiles: 4 (Característica + 3 modelos). Con más de 5 productos, la tabla resume los **modelos distintos** y las variantes repetidas se tratan en las tarjetas: una tabla de 7 columnas no se lee en el teléfono.

---

## Cumplimiento Amazon Associates (obligatorio — cada artículo debe pasar estas reglas)

Estas reglas vienen del Acuerdo Operativo y las Políticas del Programa de Amazon Associates (oct 2025 / abr 2026). Un artículo que las incumple puede resultar en rechazo de solicitud o suspensión de cuenta.

### Disclosure obligatorio (Sección 5 del Acuerdo Operativo)

El texto exacto **"Como Afiliado de Amazon, percibo dinero con las compras elegibles"** debe aparecer visible en la página, en español, **antes** de cualquier enlace de afiliado. Colócalo:
- Al inicio del `<article>` (en el `<div class="amz-disclosure">`)
- Al final del artículo (disclosure largo)
- **Nunca** dentro de un `<details>`, un tooltip oculto, ni en letra ilegible

### Precios: solo con disclaimer de vigencia

Los precios de Amazon se pueden mostrar **únicamente si** provienen de la PA API (Product Advertising API) o si Amazon los provee con enlace de precios. Si los precios son capturados manualmente (el caso habitual de comparalo.mx), **debes mostrar** el siguiente disclaimer junto a cada precio:

```html
<p class="price-disclaimer">Los precios y la disponibilidad del Producto son precisos en la fecha/hora indicadas y están sujetos a cambios. El precio final de compra se mostrará en la página de Amazon.</p>
```

Si no puedes garantizar que el precio es en tiempo real, **no muestres precio**; en su lugar usa:
```html
<span class="price-cta">Ver precio en Amazon →</span>
```

### Prohibido: calificaciones y reseñas de Amazon

**No incluyas** estrellas, ratings numéricos ("4.5/5 estrellas"), ni fragmentos de reseñas de clientes de Amazon a menos que provengan de la PA API (Creators API). Esto incluye:
- Estrellas decorativas referenciando Amazon
- Frases como "Miles de reseñas positivas en Amazon"
- Capturas de pantalla de ratings de Amazon

Puedes mencionar popularidad de forma editorial: "uno de los más vendidos en su categoría".

### Prohibido: incentivar clics

**No ofrezcas** ningún incentivo para que el usuario haga clic en enlaces de afiliado:
- Sin cashback, puntos, sorteos ni descuentos por clic
- Sin frases como "Haz clic aquí y gana X" o "Al comprar por este link recibes Y"
- Sin urgencia falsa vinculada al clic del afiliado ("Solo por este link, precio especial")

### Exactitud de specs: lo que se anuncia debe ser lo que se vende

Verifica que cada `link_amz` lleve al producto con las specs exactas que describes:
- Si describes "16 GB RAM", el ASIN debe ser el de 16 GB, no el de 8 GB
- Si hay varias variantes, elige el ASIN correspondiente o indica claramente la variante
- **No enlazar** a una página de producto diferente del spec anunciado

### Promociones y precios limitados: solo si siguen vigentes

Si el JSON incluye precios de oferta o promociones limitadas (Buen Fin, Prime Day, etc.):
- Verifica que sigan activas en Amazon **antes de publicar**
- Agrega una nota: "Precio verificado el {fecha}. Las ofertas de Amazon pueden terminar sin previo aviso"
- **Elimina o neutraliza** menciones de precio especial en cuanto Amazon restaure el precio normal (el workflow de precios de comparalo.mx o Alan lo hace manualmente)

### Sin marcas registradas de Amazon en meta, títulos ni URLs

**No uses** "Amazon", "Kindle", ni variantes en:
- El `<title>` o meta description como si fuera el nombre del sitio
- El slug/URL del artículo (`/guias/laptops/amazon-mejores-laptops/` ✗)
- Texto que implique que el sitio es propiedad de Amazon o está patrocinado por Amazon

Uso permitido: mencionar que el producto "está disponible en Amazon" con un enlace de afiliado.

### Sin acortar URLs que oculten el destino Amazon

**No uses** servicios de acortamiento (bit.ly, tinyurl, etc.) en los enlaces de afiliado. El usuario debe poder ver que el link va a Amazon. Los enlaces deben ser directos: `https://www.amazon.com.mx/dp/ASIN?tag=guiasdecomp01-20`.

### Contenido original con valor real

Cada artículo debe:
- Tener **contenido editorial propio** (análisis, comparativa, guía de specs) que agregue valor más allá de listar productos de Amazon
- Estar **actualizado** (menos de 60 días de antigüedad en la fecha del artículo o de la última revisión visible)
- No ser un clon de otro artículo del sitio con nombres distintos

### Resumen rápido (pasa este checklist antes de publicar)

- [ ] Disclosure Amazon visible antes del primer enlace de afiliado
- [ ] Si hay precios: disclaimer de vigencia junto a cada uno
- [ ] Sin estrellas ni ratings de Amazon (a menos que vengan de PA API)
- [ ] Sin incentivos por clic
- [ ] Cada ASIN corresponde exactamente a las specs anunciadas
- [ ] Sin "Amazon" en el slug, title o meta como nombre del sitio
- [ ] Links directos (no acortados)
- [ ] Contenido editorial original, no duplicado

---

## Checklist antes de guardar el archivo

- [ ] `tag=guiasdecomp01-20` en todos los links Amazon
- [ ] GA4 `G-9TKZ4ER13X` presente y sin modificar
- [ ] `<script src="/js/onboarding.js" defer></script>` antes de `</body>`
- [ ] JSON-LD válido (Article + BreadcrumbList + FAQPage)
- [ ] Disclosure de afiliado Amazon al inicio y al final del `<article>`
- [ ] Los tres CSS enlazados y en orden: `cmx-site.css`, `cmx-guia.css`, `cmx-guia-amz.css`
- [ ] `<body class="cg">` con `data-guide-id` y `data-category`
- [ ] `assets/js/cmx-guia-amz.js` enlazado DESPUÉS del `<script>` de `window.CMX_GUIA_AMZ`
- [ ] Un objeto en `productos` por cada tarjeta, con el mismo `id` que su `data-id`/`data-cg-card`
- [ ] `especs` con las mismas etiquetas y el mismo orden en todos los productos
- [ ] Claves de `veredictos` con los ids ordenados alfabéticamente y unidos por `__`; todos los pares escritos
- [ ] `veredictoFallback` escrito para la categoría
- [ ] Cada `data-cg-prod="{id}"` tiene su `#sec-{id}`; cada sección del índice lleva `data-cg-sec`
- [ ] Sin `onclick` de `gtag` en los botones de afiliado (lo mide el JS por `data-amz`)
- [ ] Todos los `data-*` de las `.cg-card` corresponden a las claves de `filters` y a los `data-val`
- [ ] `<!-- cmx-header:start -->` y `<!-- cmx-bc:start -->` presentes para que `sync-site.js` los llene
- [ ] Ruta del archivo: `guias/{categoria}/{slug}/index.html`
- [ ] Correr `node scripts/sync-site.js` después de crear el archivo
- [ ] Agregar la URL a `sitemap.xml`
- [ ] Agregar card al índice de la categoría padre (`guias-compra/{categoria}/index.html`)
- [ ] Correr `node scripts/check-site.js` y resolver todos los errores

---

## Cómo agregar la card al índice de categoría

En el `<div class="ga-grid">` del índice padre, agrega:

```html
<a class="ga-card" href="/{slug}/">
  <div class="ga-card-img">{emoji o <img>}</div>
  <div class="ga-card-body">
    <div class="ga-card-tag">{etiqueta, p. ej. "Gaming"}</div>
    <div class="ga-card-title">{titulo_corto}</div>
    <div class="ga-card-desc">{descripcion_corta}</div>
    <span class="ga-card-cta">Ver guía →</span>
  </div>
</a>
```

---

## Proceso paso a paso

1. **Lee** `guias/laptops/macbook-reacondicionadas/index.html` (el molde vivo) y la cabecera de `assets/js/cmx-guia-amz.js` (el contrato de datos).
2. **Parsea** el JSON/HTML que Alan te pase y extrae todos los productos.
3. **Pregunta** si falta algún campo clave (slug, título, FAQ, fuentes).
4. **Genera** el HTML completo del artículo en `guias/{categoria}/{slug}/index.html`.
5. **Genera** `window.CMX_GUIA_AMZ` con `productos`, `veredictos` (todos los pares) y `veredictoFallback`.
6. **Agrega** la card en el índice de la categoría padre.
7. **Agrega** la URL a `sitemap.xml`.
8. **Corre** `node scripts/sync-site.js` y luego `node scripts/check-site.js`.
9. **Prueba** en el navegador local: que el comparador abra la tabla con 2 y con 3 productos y pinte el veredicto correcto, que los filtros dejen el número de tarjetas que dicen, que no haya errores de consola y que a 375 px se vea la barra inferior y el panel de Compáralo.
10. **Propón** el commit: `feat(guias): artículo {titulo_corto}`.
