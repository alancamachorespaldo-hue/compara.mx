---
name: crear-guia-oferta-amazon
description: Crea un artículo-guía de oferta Amazon interactivo para comparalo.mx (guias/laptops/, guias/celulares/, guias/electrodomesticos/, etc.) a partir de un JSON de productos generado por ChatGPT. El artículo tiene hero verde, TOC sticky, tarjetas de producto con comparativa dinámica, configurador de filtros y secciones SEO, y cumple todas las políticas de Amazon Associates. Úsalo cuando Alan diga "crea el artículo de X", "crea la guía oferta Amazon de Y", "publica la guía de Y" o te pase un JSON con productos para convertir en artículo.
---

Eres el especialista en crear artículos-guía de oferta Amazon interactivos para comparalo.mx. Tu objetivo: convertir un JSON de productos (generado por ChatGPT u otro proceso) en un artículo HTML completo, interactivo, con el diseño de la casa y en pleno cumplimiento con las políticas de Amazon Associates, listo para publicar con `sync-site.js`.

## Regla de oro: copia la estructura VIVA, no la memoria

Lee siempre el molde antes de escribir una sola línea:

- **Molde principal (artículo interactivo con comparador):** `guias/laptops/mejores-macbook-calidad-precio/index.html`
- **Referencia de colores y CSS compartido:** `assets/css/cmx-site.css`
- **Reglas del sitio:** `CLAUDE.md` (obligatorio; tag afiliado, GA4, onboarding.js, check-site.js)

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

<!-- CSS local del artículo — ver sección CSS más abajo -->
<style>...</style>
</head>
```

### 2. CSS local (copia del molde, ajustando colores si la categoría lo requiere)

Incluye **íntegro** el bloque `<style>` del molde MacBook. Ajusta solo:
- `--amz` si la categoría es de Amazon (default `#f90`)  
- `--ac` siempre `#006847` (verde comparalo)
- Si la categoría incluye Mercado Libre: añade botón `.ml-btn` con `background:var(--ml)` y `color:#111`

El CSS cubre: hero, layout 2 columnas (artículo + TOC sticky), tarjetas `.product`, configurador `.config`, comparador `.compare-controls` / `.compare-output`, tabla `.cmp-table`, FAQ `.faq`, checklist `.checklist`, callout `.callout`, disclosure de afiliado.

### 3. `<body>`: header + breadcrumb (gestionados por sync-site.js)

```html
<!-- cmx-header:start -->...(deja que sync-site.js lo llene)...<!-- cmx-header:end -->
<!-- cmx-bc:start --><div class="cmx-bc"><ol aria-label="Ruta de navegación"><li><a href="/">Inicio</a></li><li><a href="/guias-compra/">Guías de compra</a></li><li><a href="/{categoria_padre}/">{categoria_legible}</a></li><li aria-current="page">{titulo_corto}</li></ol></div><!-- cmx-bc:end -->
```

### 4. Hero verde

```html
<section class="hero"><div class="wrap">
  <div class="eyebrow">Guía de compra · {Categoría} · México · Actualizada {mes_año}</div>
  <h1>{titulo}</h1>
  <p>{bajada: 2-3 oraciones sobre qué compara la guía y cómo ayuda al lector}</p>
  <div class="hero-meta">
    <span class="pill">Comparativa editorial</span>
    <span class="pill">{N} modelos analizados</span>
    <span class="pill">Solo Amazon México</span>
  </div>
</div></section>
```

### 5. Layout principal: `<main class="wrap layout">`

Dentro: `<article class="article">` con todo el contenido editorial + `<aside class="toc">` con el índice sticky.

**Secciones obligatorias del artículo** (en este orden):

1. **Disclosure de afiliado** (justo después de `<article>`)
   ```html
   <div class="amz-disclosure"><strong>Como Afiliado de Amazon, percibo dinero con las compras elegibles.</strong> Algunos enlaces de esta guía son de afiliado: si compras a través de ellos, comparalo.mx puede recibir una comisión sin costo adicional para ti. La selección y el análisis se basan en las características y necesidades de compra, no en la comisión.</div>
   ```

2. **Notice editorial** (metodología breve)

3. **`<h2 id="respuesta">` Respuesta rápida** — grid de 3 tarjetas `.quick` (mejor para X, mejor para Y, mejor para Z)

4. **`<h2 id="comparativa">` Comparativa rápida** — tabla `.cmp-table` con los modelos lado a lado + fila CTA con enlaces Amazon

5. **`<h2 id="modelos">` Elige tu configuración** — configurador `.config.config-collapse` + controles del comparador + grid de tarjetas `.cards`

6. **`<h2 id="elegir">` Qué modelo elegir según tu necesidad** — secciones H3 por caso de uso

7. **`<h2 id="specs">` Guía de especificaciones** — tabla de qué specs importan y para quién (RAM, procesador, pantalla, etc.)

8. **`<h2 id="metodologia">` Cómo seleccionamos los modelos** — transparencia editorial

9. **`<h2 id="faq">` Preguntas frecuentes** — `<div class="faq">` con `<details>/<summary>`

10. **`<h2 id="fuentes">` Fuentes y verificación** — links a specs oficiales

11. **Disclosure final** de afiliado (texto largo)

### 6. TOC sticky

```html
<aside class="toc"><strong>En esta guía</strong><nav>
<a href="#respuesta">Respuesta rápida</a>
<a href="#comparativa">Comparativa rápida</a>
<a href="#modelos">Elige tu configuración</a>
<a href="#elegir">Qué modelo elegir</a>
<a href="#specs">Guía de specs</a>
<a href="#metodologia">Metodología</a>
<a href="#faq">Preguntas frecuentes</a>
<a href="#fuentes">Fuentes</a>
</nav></aside>
```

### 7. Tarjetas de producto

Cada `<article class="product">` lleva atributos `data-*` para el configurador:

```html
<article class="product" data-id="{id}" data-condition="{new|renewed}" data-brand="{brand}" data-ram="{ram}" data-ssd="{ssd}" data-rango="{bajo|medio|alto}">
  <div class="product-img">
    <img src="{imagen}" alt="{nombre}" loading="lazy" referrerpolicy="no-referrer"
      onerror="this.parentElement.innerHTML='<div class=&quot;placeholder&quot;>💻</div>'">
  </div>
  <div class="product-body">
    <div class="badges">{badges como <span class="badge [new|renew]">}</div>
    <label class="select-product">
      <input class="product-select" type="checkbox" aria-label="Seleccionar {nombre} para comparar">
      <span>Agregar a comparativa</span>
    </label>
    <h3>{nombre}</h3>
    <div class="spec-line">{specs_line}</div>
    <ul>{bullets como <li>}</ul>
    {si hay caution: <div class="caution">{caution}</div>}
    <a class="amz-btn" href="{link_amz}" target="_blank" rel="sponsored nofollow noopener"
      onclick="typeof gtag==='function'&&gtag('event','affiliate_click_amazon',{event_category:'afiliado',event_label:'{nombre}',location:'editorial_guide'})">
      Ver en Amazon <img src="/logoamazon.png" alt="Amazon" onerror="this.style.display='none'">
    </a>
  </div>
</article>
```

**Tag de afiliado:** siempre `tag=guiasdecomp01-20`. **Nunca** `comparalo20-20` en guías nuevas.

### 8. Configurador + comparador (JS)

Al final de `<body>`, antes de `</body>`, incluye:

```html
<script src="/js/onboarding.js" defer></script>
<script>
// ── Datos de specs para comparativa dinámica ──
const specs = {
  {id}: {name:'...', condition:'...', /* todos los campos de specs_completas */},
  ...
};

// ── Configurador: filtra tarjetas por los data-* ──
const facets = {condition:'all', brand:'all', ram:'all', ssd:'all'};
const cards = [...document.querySelectorAll('.product')];
function applyConfig(){
  let visibles = 0;
  cards.forEach(card => {
    const ok =
      (facets.condition==='all' || card.dataset.condition===facets.condition) &&
      (facets.brand==='all'    || card.dataset.brand===facets.brand) &&
      (facets.ram==='all'      || card.dataset.ram===facets.ram) &&
      (facets.ssd==='all'      || card.dataset.ssd===facets.ssd);
    card.hidden = !ok;
    if(ok) visibles++;
  });
  document.getElementById('configResult').textContent =
    `Mostrando ${visibles} de ${cards.length} modelos`;
}
document.querySelectorAll('[data-facet]').forEach(group => {
  group.addEventListener('click', e => {
    const btn = e.target.closest('.filter');
    if(!btn) return;
    group.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    facets[group.dataset.facet] = btn.dataset.val;
    applyConfig();
  });
});

// ── Comparador dinámico ──
const compareBtn = document.getElementById('compareBtn');
const clearBtn   = document.getElementById('clearBtn');
const countEl    = document.getElementById('selectedCount');
const output     = document.getElementById('compareOutput');
const dynTable   = document.getElementById('dynamicTable');
let selected = [];

document.querySelectorAll('.product-select').forEach(cb => {
  cb.addEventListener('change', () => {
    const id = cb.closest('.product').dataset.id;
    if(cb.checked){ if(selected.length < 3) selected.push(id); else cb.checked=false; }
    else selected = selected.filter(x => x!==id);
    countEl.textContent = `${selected.length} de 3 seleccionados`;
    compareBtn.disabled = selected.length < 2;
    document.querySelectorAll('.product').forEach(p =>
      p.classList.toggle('is-selected', selected.includes(p.dataset.id)));
  });
});

compareBtn.addEventListener('click', () => {
  if(selected.length < 2) return;
  const cols = selected.map(id => specs[id]);
  const rows = ['condition','Procesador','RAM','Almacenamiento','Pantalla','Batería','Puertos','Peso','Uso ideal'];
  const labels = {condition:'Condición',Procesador:'Procesador',RAM:'Memoria',Almacenamiento:'Almacenamiento',Pantalla:'Pantalla',Batería:'Batería',Puertos:'Puertos',Peso:'Peso','Uso ideal':'Uso ideal'};
  let html = '<thead><tr><th>Característica</th>' +
    cols.map(c=>`<th>${c.name}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(k => {
    html += `<tr><td>${labels[k]||k}</td>` +
      cols.map(c=>`<td>${c[k]||'—'}</td>`).join('') + '</tr>';
  });
  html += '<tr class="cmp-cta"><td>Ver en Amazon</td>' +
    selected.map(id => {
      const card = document.querySelector(`.product[data-id="${id}"] .amz-btn`);
      const href = card ? card.href : '#';
      return `<td><a class="amz-mini" href="${href}" target="_blank" rel="sponsored nofollow noopener">Ir a Amazon <img src="/logoamazon.png" alt="Amazon" onerror="this.style.display='none'"></a></td>`;
    }).join('') + '</tr></tbody>';
  dynTable.innerHTML = html;
  output.classList.add('show');
  output.scrollIntoView({behavior:'smooth', block:'nearest'});
});

clearBtn.addEventListener('click', () => {
  selected = [];
  document.querySelectorAll('.product-select').forEach(cb => cb.checked=false);
  document.querySelectorAll('.product').forEach(p => p.classList.remove('is-selected'));
  compareBtn.disabled = true;
  countEl.textContent = '0 de 3 seleccionados';
  output.classList.remove('show');
});
</script>
```

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

## Tabla comparativa rápida (sección `#comparativa`)

Genera la tabla estática con **todos** los productos. Incluye fila CTA con enlace Amazon por columna. Mínimo de columnas útiles: 4 (Característica + 3 modelos). Si hay más de 6 modelos, muestra solo los 4-5 más representativos y menciona el resto en la sección editorial.

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
- [ ] Todos los `data-*` de los `<article class="product">` corresponden a los `facets` del JS
- [ ] El objeto `specs` del JS tiene una entrada por cada `data-id` de las tarjetas
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

1. **Lee** `guias/laptops/mejores-macbook-calidad-precio/index.html` para tener el molde vivo.
2. **Parsea** el JSON/HTML que Alan te pase y extrae todos los productos.
3. **Pregunta** si falta algún campo clave (slug, título, FAQ, fuentes).
4. **Genera** el HTML completo del artículo en `guias/{categoria}/{slug}/index.html`.
5. **Genera** el `specs` object del JS con todos los productos.
6. **Agrega** la card en el índice de la categoría padre.
7. **Agrega** la URL a `sitemap.xml`.
8. **Corre** `node scripts/sync-site.js` y luego `node scripts/check-site.js`.
9. **Muestra** el resultado en el navegador local (`http://localhost:8765/guias/{categoria}/{slug}/`) para validar visualmente.
10. **Propón** el commit: `feat(guias): artículo {titulo_corto}`.
