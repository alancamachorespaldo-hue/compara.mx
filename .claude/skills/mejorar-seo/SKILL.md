---
name: mejorar-seo
description: Audita y mejora el SEO de una página de comparalo.mx (categorías, guías o el inicio) leyendo el contenido real de la página —productos, precios, descuentos activos, filtros y estructura— para generar texto editorial específico, metadatos únicos y datos estructurados precisos. Úsala cuando quieras posicionar mejor una página, antes de publicar un apartado nuevo, o para atacar búsquedas de Google y ChatGPT/AI Overviews.
---

# Mejorar el SEO de una página de comparalo.mx

## Objetivo

Subir el posicionamiento real —Google y motores de IA como ChatGPT, Gemini y Perplexity— **sin cambiar precios, specs, links ni imágenes de productos** (lo prohíbe el `CLAUDE.md`). Se trabaja sobre metadatos, estructura y contenido editorial. Lee el `CLAUDE.md` antes de empezar: sus reglas son obligatorias.

---

## PASO 1 — Lee la página completa antes de escribir una sola línea

**Nunca trabajes de memoria ni con texto genérico.** La mejora SEO de esta skill se basa en lo que realmente hay en la página.

Lee el HTML de la página que te pidieron y extrae:

### 1a. Productos del catálogo
- Nombre completo de cada producto.
- Precios actuales (ML y Amazon si los hay).
- Si tiene badge de bajada de precio (`_precioMLAntes`, `_precioAmzAntes`, `cmxDropBadge`).
- Rating y número de reseñas visibles.
- Marcas presentes en el catálogo.
- Rango de precios: el más barato y el más caro de la página.

### 1b. Descuentos y bajadas de precio activos
- Mira si la página consume `descuentos.json` o `bajadas.json`.
- Extrae qué productos están en oferta, de qué plataforma (ML / Amazon) y el porcentaje de descuento.
- Si no hay descuentos, anótalo — no los menciones en el texto editorial.

### 1c. Filtros y organización de la página
- Qué filtros tiene (marca, precio, característica técnica, bajada de precio, etc.).
- Cómo están agrupados los productos (tabs, secciones, tipos).
- Qué hace el comparador (círculo de comparar, favoritos, sticky CTA).

### 1d. Contenido editorial existente
- Lee el `<h1>`, los `<h2>`, `<h3>` actuales.
- Lee el bloque editorial (párrafos introductorios, guía de compra).
- Lee el `<title>`, `<meta description>`, canonical y JSON-LD.
- Detecta qué falta, qué es genérico y qué ya está bien.

### 1e. Página de referencia del mismo tipo
Lee también una página bien posicionada del mismo tipo para copiar el patrón:
- Categoría → `electrodomesticos/freidoras/index.html` o `suplementos/magnesio/index.html`.
- Guía → `guias/celulares/mejores-celulares-menos-5000/index.html`.

---

## PASO 2 — Diagnóstico: qué está fallando

Con los datos del Paso 1, responde antes de editar:

| Elemento | ¿Está? | ¿Es correcto? | Acción |
|---|---|---|---|
| `<title>` único, 50-60 chars, keyword al inicio | | | |
| `<meta description>` 150-160 chars, propuesta de valor | | | |
| `<link rel="canonical">` → URL limpia con slash | | | |
| OG completo (title, description, image, url, type, locale) | | | |
| Twitter completo (card, title, description, image) | | | |
| Un solo `<h1>` con keyword principal | | | |
| Jerarquía h2/h3 sin saltos, subtemas reales | | | |
| Bloque editorial específico (no genérico) | | | |
| JSON-LD correcto y parseable | | | |
| `alt` descriptivos en imágenes de producto | | | |
| URL en `sitemap.xml` con slash final | | | |

---

## PASO 3 — Escribe contenido editorial específico a esta página

Este es el factor que más posiciona. **Usa los datos reales que extrajiste en el Paso 1.**

### Principios que guían cada palabra

- **Contenido para personas, no para el buscador.** El texto ayuda a decidir una compra; si solo repite la keyword, está mal.
- **Intención de búsqueda primero.** ¿Qué busca quien llega a esta página: comparar precios, encontrar el más barato, elegir el mejor para un uso específico? Escríbele a esa persona.
- **E-E-A-T de comparalo.mx**: el ángulo único es comparar el **mismo producto en Mercado Libre vs. Amazon** con precio real. Eso es lo que nadie más da; hazlo explícito.
- **Frescura**: menciona el año, y si hay descuentos activos o bajadas de precio, refléjalos (sin inventar nada que no hayas leído en el Paso 1).
- **Legible**: frases cortas, subtítulos claros, listas donde ayuden. Original siempre, sin copiar de otro sitio.
- **SEO para IA (ChatGPT, Gemini, Perplexity)**: responde preguntas directas de forma concisa en el editorial. Los AI overviews premian párrafos que respondan "¿cuánto cuesta X?", "¿cuál conviene para Y?" con datos específicos.

### Estructura del bloque editorial

Sigue este patrón, pero los subtemas son **propios de esta categoría** (no uses el texto de otra):

```
<h2>[Keyword + ángulo con gancho: "Las mejores X para Y en México 2026"]</h2>
<p>Párrafo de entrada: qué hay en la página, rango de precios real (el más barato y el más caro que leíste), marcas presentes, y si hay descuentos activos menciónalos.</p>

<h3>¿Qué [categoría] conviene según tu uso?</h3>
<p>Tipos o variantes y cuál conviene para qué perfil. Usa los productos reales del catálogo como ejemplos.</p>

<h3>¿Cómo comparar el precio real de [categoría] en México?</h3>
<p>Explica la diferencia entre ML y Amazon para esta categoría, con datos concretos del catálogo.</p>

<h3>¿Qué [característica clave de la categoría] importa más?</h3>
<p>El criterio técnico principal que un comprador real de esta categoría busca.</p>

<h3>Mercado Libre vs. Amazon: ¿dónde conviene más comprar [categoría]?</h3>
<p>El ángulo único de comparalo.mx, aplicado a esta categoría con datos reales.</p>
```

### Entidades y subtemas por categoría (ejemplos de qué cubrir)

No uses texto genérico. Estos son ejemplos de qué le importa a cada comprador:

- **Lavadoras** → kg de capacidad, carga frontal vs. superior, consumo de agua y luz, nivel de ruido (dB), ciclos especiales, marcas y precio por capacidad.
- **Televisiones** → pulgadas y distancia recomendada, panel (OLED/QLED/LED), resolución y HDR, smart TV y apps disponibles, puertos HDMI, precio por pulgada.
- **Refrigeradores** → litros de capacidad, No-Frost, eficiencia energética, distribución de cajones, side by side vs. top mount vs. bottom freezer, ruido.
- **Freidoras** → litros de capacidad, potencia en watts, digital vs. manual, doble canasta, marcas líderes, ruido y espacio de contador.
- **Microondas** → watts de potencia, litros de capacidad, con/sin grill, digital vs. analógico, funciones de descongelado.
- **Laptops** → procesador y generación, RAM y si es expandible, tipo de almacenamiento (SSD vs. HDD), pantalla (resolución, brillo, Hz), batería en horas, peso, uso (escuela/trabajo/gaming).
- **Celulares** → procesador, RAM, cámara (MP y aperturas reales), batería y carga rápida, 5G, pantalla AMOLED vs. LCD, precio desbloqueado.
- **Suplementos (proteína)** → gramos de proteína por servicio, tipo (whey/caseína/vegana), sabores, tamaño del bote, precio por servicio, sellos de calidad.
- **Creatina** → monohidratada vs. otras formas, gramos por servicio, micronizada, sin sabor vs. con sabor, precio por gramo.
- **Streaming** → catálogo y estrenos, precio mensual vs. anual, pantallas simultáneas, 4K y HDR, con/sin anuncios, descargas offline, dispositivos compatibles.
- **Bicis** → tipo (urbana/MTB/ruta/gravel/eléctrica), talla de cuadro, grupo de cambios, frenos (disco vs. V-brake), material (acero/aluminio/carbono), peso, precio por componente.

Si la categoría no está en esta lista, investígala antes de escribir.

---

## PASO 4 — Metadatos

### `<title>` — 50-60 caracteres

Formato recomendado para categorías:
```
Mejor [Categoría] en México 2026: Compara Precios ML y Amazon
```
Para guías:
```
[Pregunta o ángulo específico] – comparalo.mx 2026
```

Reglas:
- Keyword principal al inicio.
- Menciona "México" y el año.
- Único en todo el sitio.
- Refleja lo que realmente hay en la página (marcas, tipos, rango si cabe).

### `<meta name="description">` — 150-160 caracteres

Incluye:
- Keyword natural en la primera frase.
- Propuesta de valor de comparalo.mx (mismo producto, dos tiendas, precio real).
- Si hay descuentos activos, mencionarlos sube el CTR.
- Llama a la acción: "Compara ahora", "Encuentra el mejor precio".

Ejemplo para freidoras:
```
Compara las mejores freidoras de aire en Mercado Libre y Amazon México 2026. Precios actualizados, reseñas reales y hasta 30% de descuento. ¡Encuentra la tuya!
```

### Open Graph (obligatorio y completo)

```html
<meta property="og:title" content="[mismo que title o ligeramente diferente]">
<meta property="og:description" content="[mismo que meta description]">
<meta property="og:image" content="https://comparalo.mx/fotos/og/[imagen-og.jpg]">
<meta property="og:url" content="https://comparalo.mx/[ruta-con-slash/]">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
```

### Twitter / X

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[title]">
<meta name="twitter:description" content="[description]">
<meta name="twitter:image" content="https://comparalo.mx/fotos/og/[imagen-og.jpg]">
```

---

## PASO 5 — Datos estructurados (JSON-LD)

### Categoría de productos

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://comparalo.mx/[ruta/]",
      "name": "[título de la página]",
      "description": "[meta description]",
      "url": "https://comparalo.mx/[ruta/]",
      "inLanguage": "es-MX",
      "dateModified": "[YYYY-MM-DD de hoy]"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://comparalo.mx/"},
        {"@type": "ListItem", "position": 2, "name": "[Categoría padre si aplica]", "item": "https://comparalo.mx/[cat-padre/]"},
        {"@type": "ListItem", "position": 3, "name": "[Esta categoría]"}
      ]
    },
    {
      "@type": "ItemList",
      "name": "[Título de la lista de productos]",
      "numberOfItems": [N],
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Product",
            "name": "[nombre real del producto]",
            "offers": {
              "@type": "AggregateOffer",
              "lowPrice": "[precio más bajo entre ML y Amazon]",
              "highPrice": "[precio más alto entre ML y Amazon]",
              "priceCurrency": "MXN",
              "offerCount": 2
            }
          }
        }
      ]
    },
    {
      "@type": "Organization",
      "name": "comparalo.mx",
      "url": "https://comparalo.mx/"
    }
  ]
}
```

**Reglas para ItemList:**
- Incluye TODOS los productos activos de la página (los que leíste en el Paso 1).
- Los precios deben coincidir con los que se muestran en la página — no inventes ni pongas precios de la BD sin verificar que están en el HTML.
- Si hay descuentos activos, usa `lowPrice` con el precio de oferta.

### Guía / artículo

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "[h1 de la guía]",
      "description": "[meta description]",
      "datePublished": "[YYYY-MM-DD]",
      "dateModified": "[YYYY-MM-DD de hoy]",
      "author": {"@type": "Organization", "name": "comparalo.mx"},
      "publisher": {"@type": "Organization", "name": "comparalo.mx", "url": "https://comparalo.mx/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [ /* ... */ ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "[Pregunta real que responde la guía]",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "[Respuesta concisa y directa, extraída del contenido real de la guía]"
          }
        }
      ]
    }
  ]
}
```

**Regla**: Las `Question`/`Answer` del FAQPage deben corresponder a preguntas que realmente se responden en el texto visible. No agregues FAQs que no estén en el contenido.

---

## PASO 6 — Imágenes, enlaces internos y sitemap

### Imágenes
- `alt` descriptivo: nombre real del producto, marca y característica clave. No "imagen" ni vacío.
- Formato: `alt="[Marca] [Modelo] – comparalo.mx"` para productos, `alt="[tema descriptivo]"` para editoriales.
- No cambies `src`, `width`, `height` ni el archivo.

### Enlaces internos
- El breadcrumb debe coincidir con el JSON-LD y la estructura real del sitio.
- La sección `cmx-related` ("Sigue explorando") debe apuntar a guías y categorías relevantes para **esta** categoría. Enlaza en ambos sentidos (categoría ↔ guías propias).
- Texto de enlace descriptivo (nunca "clic aquí" o "ver más").
- No edites los bloques `<!-- cmx-header -->`, `<!-- cmx-footer -->`, `<!-- cmx-related -->` directamente: se regeneran con `sync-site.js`.

### Sitemap
- Verifica que `https://comparalo.mx/[ruta/]` esté en `sitemap.xml`.
- Si no está, agrégala con `<lastmod>` actualizado y `<priority>` apropiada (0.8 para categorías, 0.7 para guías).
- Nunca pongas en el sitemap páginas que tengan `noindex`.

---

## PASO 7 — SEO para motores de IA (ChatGPT, Gemini, Perplexity)

Los AI overviews y el modo IA de los buscadores extraen respuestas de páginas que:

1. **Responden preguntas directamente** con datos específicos, en los primeros párrafos.
2. **Usan estructuras claras**: listas, tablas comparativas, encabezados descriptivos.
3. **Dan datos concretos**: precios reales, rangos, porcentajes de descuento, nombres de marca.
4. **Cubren el tema con profundidad**: no hay que saltar a otra página para saber más.

Aplica esto en el editorial:
- El primer párrafo de cada `<h2>` responde directamente la pregunta implícita del encabezado.
- Si hay una comparativa ML vs. Amazon, ponla en tabla (`<table>`) cuando haya 3+ productos.
- Usa `<ul>` o `<ol>` para criterios de compra, no párrafos largos de criterios seguidos.
- Menciona cifras: "desde $X hasta $Y", "con hasta N% de descuento", "las marcas más vendidas son A, B y C".

---

## No negociables (del CLAUDE.md)

- **No cambies precios, specs, ratings, reseñas, imágenes, links ni IDs de productos.** El catálogo solo se lee, nunca se edita aquí.
- **GA4 `G-9TKZ4ER13X`** debe permanecer. No toques `/assets/js/analytics.js`.
- URLs limpias con slash final. Tag de afiliado `comparalo20-20` intacto.
- Sin frameworks ni build step. Contenido 100% original. Sin inventar datos ni cifras.
- Git: agrega por nombre (nunca `git add -A`/`.`), un commit = un tema, revisa `git status` y `git diff --stat` antes de cualquier commit, no commitees sin que te lo pidan.

---

## PASO 8 — Validar y cerrar

1. `node scripts/check-site.js` → debe pasar en verde. Si falla, no termines.
2. Si el cambio es visible, pruébalo en el navegador (`.claude/launch.json`, puerto 8765).
3. Reporta a Alan en pocas líneas:
   - Página tocada.
   - Qué se mejoró: title / description / OG / JSON-LD / editorial / imágenes / sitemap.
   - **Qué productos detectaste** con bajada de precio o descuento activo (para que lo sepa).
   - Qué queda pendiente de su criterio (keywords alternativas, fotos OG, decisiones de texto).
