# Skill: crear-guia

Crea una página de guía editorial para comparalo.mx. Hay dos tipos de guía; elige el correcto antes de escribir código.

---

## TIPOS DE GUÍA

### Tipo A — Comparativa de productos
Guías que muestran y comparan productos que se venden en ML/Amazon.  
Ejemplos: "Mejores celulares menos de $5,000", "Mejores laptops gaming".  
**Elementos obligatorios:** sidebar izquierdo con lista de productos, botones FAB móviles, drawer móvil, barra de comparación, tarjetas de productos, secciones editoriales con tarjeta sticky.

### Tipo B — Guía informativa
Guías editoriales sin productos directos (tutoriales, "qué es X", calendarios, comparativos de servicios).  
Ejemplos: "Qué es Xuper TV", "Cómo detectar ofertas reales".  
**Elementos obligatorios:** panel CTA lateral derecho (botón flotante `float-right`) que enlaza a la categoría o a productos relacionados, secciones editoriales, FAQ. Sin sidebar izquierdo, sin tarjetas de comparación.

> Si la guía menciona productos con precio y link, úsala como **Tipo A**. Si es puramente informativa, **Tipo B**.

---

## FLUJO DE TRABAJO

### 1. Identificar tipo y recopilar datos

**Preguntar si no está claro:**
- Tipo A o B
- Slug y ruta: `guias/<categoria>/<slug>/index.html`
- Categoría de referencia (celulares, laptops, streaming…)
- Productos (Tipo A) o tema principal (Tipo B)
- Texto editorial base

### 2. Consultar productos (solo Tipo A)

Lee `scripts/merged-admin.json` para obtener precios reales, links, imágenes y specs. No inventes datos.

### 3. Agregar al sitemap

Agrega la URL en `sitemap.xml` con `<priority>0.7</priority>` y la fecha de hoy como `<lastmod>`.

### 4. Copiar el `<style>` completo de la guía de referencia

La referencia canónica es `/guias/celulares/mejores-celulares-menos-5000/index.html`.  
Copia el bloque `<style>` completo; no lo reconstruyas. Cambia sólo el color del hero si la categoría lo requiere.

---

## ESTRUCTURA `<head>` (igual para ambos tipos)

```html
<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TÍTULO SEO (año al final)</title>
<meta name="description" content="DESCRIPCIÓN 150-160 CHARS">
<link rel="canonical" href="https://comparalo.mx/guias/<cat>/<slug>/">
<meta property="og:type" content="article">
<meta property="og:url" content="https://comparalo.mx/guias/<cat>/<slug>/">
<meta property="og:title" content="TÍTULO">
<meta property="og:description" content="DESCRIPCIÓN CORTA">
<meta property="og:image" content="https://comparalo.mx/fotos/og/<cat>-og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:locale" content="es_MX">
<meta property="og:site_name" content="comparalo.mx">
<meta property="article:published_time" content="YYYY-MM-DD">
<meta property="article:section" content="Categoría con mayúscula">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@comparalomx">
<meta name="twitter:image" content="https://comparalo.mx/fotos/og/<cat>-og.jpg">
<meta name="twitter:title" content="TÍTULO">
<meta name="twitter:description" content="DESCRIPCIÓN">
<meta name="robots" content="index, follow">
<meta name="geo.region" content="MX">

<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"Article","headline":"...","description":"...","image":"https://comparalo.mx/fotos/og/<cat>-og.jpg","datePublished":"YYYY-MM-DD","dateModified":"YYYY-MM-DD","author":{"@type":"Organization","name":"comparalo.mx","url":"https://comparalo.mx/sobre-nosotros/"},"publisher":{"@type":"Organization","name":"comparalo.mx","url":"https://comparalo.mx","logo":{"@type":"ImageObject","url":"https://comparalo.mx/logopng.png"}},"url":"https://comparalo.mx/guias/<cat>/<slug>/","inLanguage":"es-MX"},
  {"@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Inicio","item":"https://comparalo.mx/"},
    {"@type":"ListItem","position":2,"name":"Categoría","item":"https://comparalo.mx/<cat>/"},
    {"@type":"ListItem","position":3,"name":"Título corto","item":"https://comparalo.mx/guias/<cat>/<slug>/"}
  ]},
  {"@type":"FAQPage","mainEntity":[
    {"@type":"Question","name":"¿Pregunta?","acceptedAnswer":{"@type":"Answer","text":"Respuesta."}}
    /* 4-6 preguntas */
  ]}
]}
</script>

<link rel="icon" type="image/png" href="/logopng.png">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 28'%3E%3Cpath d='M1,0 L15,14 L1,28 L7,28 L21,14 L7,0 Z' fill='%23006847'/%3E%3Ccircle cx='23' cy='14' r='3.8' fill='%23006847'/%3E%3Cpath d='M25,0 L39,14 L25,28 L31,28 L45,14 L31,0 Z' fill='%23CE1126'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preload" as="style" href="https://api.fontshare.com/v2/css?f[]=satoshi@800,700,600,500,400,300&display=swap">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@800,700,600,500,400,300&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://api.fontshare.com/v2/css?f[]=satoshi@800,700,600,500,400,300&display=swap" rel="stylesheet"></noscript>
<script>if(location.search.includes('bot=claude'))window['ga-disable-G-9TKZ4ER13X']=true;</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9TKZ4ER13X"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-9TKZ4ER13X');</script>
<script src="/assets/js/analytics.js" defer></script>

<!-- PEGAR AQUÍ EL BLOQUE <style> COMPLETO DE LA GUÍA DE REFERENCIA -->
<link rel="stylesheet" href="/assets/css/cmx-site.css">
</head>
```

---

## ESTRUCTURA `<body>`

### Bloques de cabecera (ambos tipos)

```html
<body>
<!-- cmx-header:start --><!-- cmx-header:end -->
<!-- cmx-bc:start --><!-- cmx-bc:end -->

<div class="hero">
  <div class="hero-eyebrow">GUÍA DE COMPRA · MÉXICO</div>  <!-- o GUÍA INFORMATIVA -->
  <h1>TÍTULO EN MAYÚSCULAS</h1>
  <p class="hero-meta">Por <strong>comparalo.mx</strong> · Actualizado: <time datetime="YYYY-MM">mes de año</time></p>
  <p class="hero-intro">Párrafo introductorio adaptado del texto editorial.</p>
</div>
```

---

## TIPO A — Comparativa de productos

### Sidebar izquierdo (desktop ≥1041px)

```html
<div class="sidebar" id="sidebar">
  <div class="sidebar-panel">
    <div class="sidebar-header">
      <span class="sidebar-htitle">PRODUCTOS</span>
      <span class="sidebar-hsub">Selecciona para comparar</span>
    </div>
    <div class="sidebar-phones" id="sidebar-phones">
      <!-- Repetir por cada producto -->
      <div class="sidebar-phone" data-idx="0" tabindex="0" role="button" aria-pressed="false"
           onclick="toggleSelectGuia('MODELO_BASE');renderSidebar();renderMobDrawer()">
        <img class="sidebar-phone-img" src="URL_IMG_ML" alt="NOMBRE" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">
        <div class="sidebar-phone-info">
          <div class="sidebar-phone-price" data-cmx-precio="MODELO_BASE">$X,XXX</div>
          <div class="sidebar-phone-name">NOMBRE MODELO</div>
          <div class="sidebar-phone-tag">BADGE · DESTACA</div>
          <a class="sidebar-phone-ml" href="LINK_ML" target="_blank" rel="sponsored nofollow noopener"
             onclick="event.stopPropagation();typeof gtag==='function'&&gtag('event','affiliate_click_ml',{'event_category':'afiliado','event_label':'sidebar','page_section':'sidebar'})">
            <img src="/logomercado.png" style="height:10px" alt="ML"> Clic para ir
          </a>
        </div>
        <div class="sidebar-phone-chk" aria-hidden="true">✓</div>
      </div>
    </div>
    <div class="sidebar-banners">
      <a class="sidebar-banner" href="/<cat>/">
        <span class="sidebar-banner-ico">🔍</span>
        <span>
          <span class="sidebar-banner-ttl">Ver catálogo</span>
          <span class="sidebar-banner-sub">Todos los productos</span>
        </span>
      </a>
    </div>
  </div>
  <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Ver productos" aria-expanded="false"
          onclick="toggleSidebar()">
    <span class="sidebar-toggle-ico">📦</span>
    <span class="sidebar-toggle-lbl">PRODUCTOS</span>
    <span class="sidebar-badge" id="sidebar-badge"></span>
  </button>
</div>
```

### Float-right (desktop ≥1041px) — botón derecho de comparación

```html
<div class="float-right" id="float-right">
  <a class="float-right-btn" href="/<cat>/">
    <span class="float-right-btn-ico">🔍</span>Ver catálogo
  </a>
</div>
```

### Mobile FAB (≤1040px) — botones flotantes en móvil

Sustituye al sidebar en mobile. Aparece al hacer scroll más allá del hero.

```html
<div class="mob-fab" id="mob-fab" aria-hidden="true">
  <!-- Adaptar botones según categoría: Android/iPhone → Android/Categoría B, etc. -->
  <a class="mob-fab-btn mob-fab-android" href="/<cat>/" aria-label="Ver catálogo"
     onclick="typeof gtag==='function'&&gtag('event','cta_click',{cta:'mob_fab_cat',location:'mobile_fab'})">
    <span>🏠</span> Catálogo
  </a>
  <!-- Botón de ofertas — solo si la categoría tiene descuentos.json -->
  <a class="mob-fab-btn mob-fab-ofertas" id="mob-fab-ofertas" href="#sec-ofertas" aria-label="Ver ofertas"
     style="display:none"
     onclick="typeof gtag==='function'&&gtag('event','cta_click',{cta:'mob_fab_ofertas',location:'mobile_fab'})">
    🔥 Ofertas
  </a>
  <!-- Botón de comparar -->
  <button class="mob-fab-btn mob-fab-cmp" id="mob-fab-cmp-btn" aria-label="Comparar productos"
          onclick="typeof gtag==='function'&&gtag('event','cta_click',{cta:'mob_fab_comparar',location:'mobile_fab'});openMobDrawer()">
    <span>⚖️</span> Comparar
    <span class="mob-fab-badge" id="mob-fab-badge">0</span>
  </button>
</div>
```

### Mobile drawer (≤1040px) — lista desplegable de productos

```html
<div class="mob-drawer-backdrop" id="mob-backdrop" onclick="closeMobDrawer()"></div>
<div class="mob-drawer" id="mob-drawer" role="dialog" aria-modal="true" aria-label="Comparador">
  <div class="mob-drawer-handle"></div>
  <div class="mob-drawer-header">
    <span class="mob-drawer-htitle">📦 Selecciona para comparar</span>
    <button class="mob-drawer-close" onclick="closeMobDrawer()" aria-label="Cerrar">✕</button>
  </div>
  <div class="mob-drawer-phones" id="mob-drawer-phones"></div>
  <div class="mob-drawer-footer">
    <button class="btn-primary" style="flex:1" id="mob-drawer-cmp-btn"
            onclick="closeMobDrawer();doCompare()" disabled>Comparar</button>
    <button class="btn-secondary" onclick="closeMobDrawer()">Cerrar</button>
  </div>
</div>
```

### Barra de comparación (fija al fondo)

```html
<div class="cmp-bar" id="cmp-bar" role="status" aria-live="polite">
  <div>
    <div class="cmp-bar-txt" id="cmp-bar-txt">Selecciona 2 o 3 productos</div>
    <div class="cmp-bar-sub">para compararlos lado a lado</div>
  </div>
  <div class="cmp-bar-actions">
    <button class="btn-do-cmp" id="btn-do-cmp" disabled onclick="doCompare()">Comparar</button>
    <button class="btn-clr" onclick="clearSelection()">Limpiar</button>
  </div>
</div>
```

### Contenido principal (dentro de `<div class="page-wrap"><div class="content">`)

```html
<div class="page-wrap">
<div class="content">

  <!-- 1. TABLA COMPARATIVA -->
  <div class="section">
    <p class="section-eyebrow">Comparativa editorial</p>
    <h2>TÍTULO: DIFERENCIAS CLAVE</h2>
    <p style="font-size:.9rem;color:var(--tx3);margin-bottom:.75rem">Precios de referencia editorial.</p>

    <div class="table-outer" role="region" aria-label="Tabla comparativa">
      <table class="cmp-tbl">
        <thead><tr>
          <th scope="col">Modelo</th>
          <th scope="col">Spec 1</th><th scope="col">Spec 2</th><th scope="col">Spec 3</th>
          <th scope="col">Precio</th><th scope="col">Ver en ML</th>
        </tr></thead>
        <tbody>
          <tr>
            <td><div class="tbl-modelo">
              <img class="tbl-img" src="URL_IMG" alt="" loading="lazy" onerror="this.style.display='none'">
              <strong>NOMBRE</strong>
            </div></td>
            <td>VALOR</td><td>VALOR</td><td>VALOR</td>
            <td><span class="tbl-price" data-cmx-precio="MODELO_BASE">$X,XXX</span><sup class="tbl-sup">*</sup></td>
            <td><a class="tbl-btn-ml" href="LINK_ML" target="_blank" rel="sponsored nofollow noopener"
                   onclick="if(typeof gtag==='function'){gtag('event','affiliate_click_ml',{'event_category':'afiliado','event_label':'tabla','page_section':'tabla'});}">
              Clic para ir <img src="/logomercado.png" style="height:11px;vertical-align:middle;margin-left:3px" alt="ML">
            </a></td>
          </tr>
          <!-- repetir por cada producto -->
        </tbody>
      </table>
    </div>
    <p class="tbl-note">* Precios de referencia editorial. Pueden cambiar según tienda, vendedor, capacidad, color y promociones.</p>
  </div>

  <!-- 2. CTA BLOQUE POST-TABLA -->
  <div class="cta-block">
    <div class="cta-block-txt">
      <h3>¿Ya tienes favoritos?</h3>
      <p>Selecciona los productos y compáralos lado a lado.</p>
    </div>
    <div class="cta-block-actions">
      <a class="btn-primary" href="/<cat>/">Ver catálogo</a>
    </div>
  </div>

  <!-- 3. MOBILE STRIP (solo visible en móvil) -->
  <div class="mobile-cta-strip">
    <p>📦 Compara o explora más opciones</p>
    <div class="btn-strip-row">
      <a class="btn-primary" href="/<cat>/" style="font-size:13px;padding:10px 18px">Ver catálogo</a>
    </div>
  </div>

  <!-- 4. QUICK PICKS -->
  <div class="section">
    <p class="section-eyebrow">Según lo que buscas</p>
    <h2>¿Cuál te conviene?</h2>
    <div class="picks-grid">
      <div class="pick-card">
        <span class="pick-label">BADGE</span>
        <span class="pick-name">NOMBRE MODELO</span>
        <span class="pick-why">Puede convenirte si priorizas X.</span>
        <button class="pick-btn" onclick="selectFromPick('MODELO_BASE')" aria-label="Seleccionar NOMBRE para comparar">＋ Seleccionar</button>
      </div>
      <!-- repetir por cada producto -->
    </div>
  </div>

  <!-- 5. TARJETAS SELECCIONABLES -->
  <div class="section">
    <p class="section-eyebrow">Selecciona para comparar</p>
    <h2>Elige los que quieres comparar</h2>
    <p style="font-size:.88rem;color:var(--tx3);margin-bottom:1rem">Selecciona 2 o 3 y compáralos lado a lado.</p>
    <div class="cards-grid" id="cards-grid"></div>
    <p class="tbl-note">* Precios de referencia editorial.</p>
    <div style="text-align:center;margin-top:1.5rem">
      <a class="btn-secondary" href="/<cat>/">Ver más en Compáralo →</a>
    </div>
  </div>

  <!-- 6. SECCIONES EDITORIALES POR PRODUCTO -->
  <!-- Una por cada producto principal -->
  <div class="ed-section">
    <div class="section-layout">
      <div class="section-text">
        <h2>MODELO: BENEFICIO PRINCIPAL</h2>
        <p>Texto editorial del producto (2-3 párrafos).</p>
        <h3>Puede convenirte si:</h3>
        <ul>
          <li>prioridad 1</li>
          <li>prioridad 2</li>
          <li>prioridad 3</li>
        </ul>
        <button class="compare-cta-btn" onclick="selectFromPick('MODELO_BASE')" aria-label="Seleccionar para comparar">＋ Seleccionar para comparar</button>
      </div>
      <div class="section-sticky">
        <div class="prd-card">
          <div class="prd-card-img">
            <img src="URL_IMG_ML" alt="NOMBRE" loading="lazy" referrerpolicy="no-referrer">
          </div>
          <div class="prd-card-body">
            <div class="prd-kicker">BADGE · DESTACA</div>
            <h3 class="prd-name">NOMBRE MODELO</h3>
            <div class="prd-price" data-cmx-precio="MODELO_BASE">$X,XXX MXN<small>Precio de Mercado Libre, se actualiza a diario</small></div>
            <div class="prd-specs">
              <div class="spec-row"><span class="spec-row-label">Spec 1</span><span class="spec-row-value">Valor</span></div>
              <div class="spec-row"><span class="spec-row-label">Spec 2</span><span class="spec-row-value">Valor</span></div>
              <div class="spec-row"><span class="spec-row-label">Spec 3</span><span class="spec-row-value">Valor</span></div>
            </div>
            <div style="padding:12px 16px;display:flex;flex-direction:column;gap:6px">
              <a class="btn-cta-ml" href="LINK_ML" target="_blank" rel="sponsored nofollow noopener"
                 onclick="if(typeof gtag==='function'){gtag('event','affiliate_click_ml',{'event_category':'afiliado','event_label':'MODELO_BASE','page_section':'articulo'});}">
                Clic para ir
              </a>
              <!-- Agregar btn-cta-amz si hay link de Amazon -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 7. SECCIÓN DE OFERTAS (oculta hasta que JS detecte bajadas) -->
  <div class="ed-section" id="sec-ofertas" style="display:none">
    <h2>Ofertas detectadas</h2>
    <p style="font-size:.9rem;color:var(--tx3)">Bajadas de precio detectadas automáticamente en Mercado Libre.</p>
    <div id="ofertas-list" class="cards-grid"></div>
  </div>

  <!-- 8. FAQ -->
  <div class="section">
    <p class="section-eyebrow">Preguntas frecuentes</p>
    <h2>Lo que más nos preguntan</h2>
    <div class="faq-list">
      <details class="faq-item">
        <summary>¿Pregunta?</summary>
        <div class="faq-body">Respuesta.</div>
      </details>
      <!-- 4-6 preguntas -->
    </div>
  </div>

  <!-- 9. CTA FINAL -->
  <div class="final-cta">
    <h2>COMPARA MÁS OPCIONES</h2>
    <p>Encuentra el precio más bajo entre Mercado Libre y Amazon.</p>
    <div class="final-cta-btns">
      <a class="btn-final-pri" href="/<cat>/">Ver catálogo</a>
    </div>
  </div>

  <p class="disclosure">Algunos enlaces son de afiliado. Si compras a través de ellos, recibimos una pequeña comisión sin costo adicional para ti.</p>

</div><!-- /content -->
</div><!-- /page-wrap -->
```

### JS al final del `<body>` (Tipo A)

```html
<script>
// ── DATOS DE PRODUCTOS ──────────────────────────────────────────────
const PRODS = [
  {
    modeloBase: 'nombre-slug-producto',  // slug único, igual que en data-cmx-precio
    nombre: 'Nombre Completo Modelo',
    destaca: 'Badge · Categoría',
    img: 'URL_IMAGEN_ML',
    linkML: 'LINK_ML_AFILIADO',
    linkAmz: 'LINK_AMZ_TAG_comparalo20-20',  // null si no hay
    precio: 0,    // se actualiza desde data-cmx-precio
    specs: { 'Spec 1': 'Valor', 'Spec 2': 'Valor' }
  }
  // repetir por cada producto
];

// ── ESTADO ─────────────────────────────────────────────────────────
var sel = new Set();

function toggleSelectGuia(mb){ if(sel.has(mb)) sel.delete(mb); else if(sel.size<3) sel.add(mb); updateUI(); }
function selectFromPick(mb){ if(!sel.has(mb)&&sel.size<3) sel.add(mb); updateUI(); }
function clearSelection(){ sel.clear(); updateUI(); }

function doCompare(){
  var ids = PRODS.filter(p=>sel.has(p.modeloBase)).map(p=>p.modeloBase).join(',');
  if(ids) window.open('/<cat>/?comparar='+encodeURIComponent(ids),'_blank');
}

// ── RENDER TARJETAS ─────────────────────────────────────────────────
function renderCards(){
  var grid = document.getElementById('cards-grid');
  if(!grid) return;
  grid.innerHTML = PRODS.map(function(p,i){
    var isSel = sel.has(p.modeloBase);
    var precio = document.querySelector('[data-cmx-precio="'+p.modeloBase+'"]');
    var precioTxt = precio ? precio.textContent.trim() : '$—';
    return '<div class="pcard'+(isSel?' selected':'')+'" onclick="toggleSelectGuia(\''+p.modeloBase+'\')" role="button" tabindex="0" aria-pressed="'+(isSel?'true':'false')+'">'
      +(isSel?'<div class="sel-check">✓</div>':'')
      +'<div class="pcard-img-wrap"><img class="pcard-img" src="'+p.img+'" alt="'+p.nombre+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"></div>'
      +'<div class="pcard-body">'
      +'<span class="pcard-badge">'+p.destaca+'</span>'
      +'<p class="pcard-name">'+p.nombre+'</p>'
      +'<div class="pcard-specs">'
      +Object.entries(p.specs||{}).map(function(e){ return '<div class="spec"><div class="spec-label">'+e[0]+'</div><div class="spec-val">'+e[1]+'</div></div>'; }).join('')
      +'</div>'
      +'<div class="pcard-price-row"><span class="pcard-price">'+precioTxt+'</span><span class="pcard-price-note">ref. ML</span></div>'
      +'<div class="pcard-btns">'
      +(p.linkML?'<a class="btn-ml" href="'+p.linkML+'" target="_blank" rel="sponsored nofollow noopener" onclick="event.stopPropagation();typeof gtag===\'function\'&&gtag(\'event\',\'affiliate_click_ml\',{\'event_category\':\'afiliado\',\'event_label\':\'cards\',\'page_section\':\'cards\'})">Clic para ir</a>':'')
      +(p.linkAmz?'<a class="btn-amz" href="'+p.linkAmz+'" target="_blank" rel="sponsored nofollow noopener" onclick="event.stopPropagation()">Ver en Amazon</a>':'')
      +'</div>'
      +'<div class="pcard-sel-row">'+(isSel?'✓ Seleccionado':'○ Seleccionar para comparar')+'</div>'
      +'</div></div>';
  }).join('');
}

// ── SIDEBAR ────────────────────────────────────────────────────────
function renderSidebar(){
  var phones = document.getElementById('sidebar-phones');
  if(!phones) return;
  phones.innerHTML = PRODS.map(function(p,i){
    var isSel = sel.has(p.modeloBase);
    var precio = document.querySelector('[data-cmx-precio="'+p.modeloBase+'"]');
    var precioTxt = precio ? precio.textContent.trim() : '';
    return '<div class="sidebar-phone'+(isSel?' sp-sel':'')+'" data-idx="'+i+'" tabindex="0" role="button" aria-pressed="'+(isSel?'true':'false')+'" onclick="toggleSelectGuia(\''+p.modeloBase+'\');renderSidebar();renderMobDrawer()">'
      +'<img class="sidebar-phone-img" src="'+p.img+'" alt="'+p.nombre+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      +'<div class="sidebar-phone-info">'
      +'<div class="sidebar-phone-price">'+precioTxt+'</div>'
      +'<div class="sidebar-phone-name">'+p.nombre+'</div>'
      +'<div class="sidebar-phone-tag">'+p.destaca+'</div>'
      +(p.linkML?'<a class="sidebar-phone-ml" href="'+p.linkML+'" target="_blank" rel="sponsored nofollow noopener" onclick="event.stopPropagation()"><img src="/logomercado.png" style="height:10px" alt="ML"> Clic para ir</a>':'')
      +'</div>'
      +'<div class="sidebar-phone-chk" aria-hidden="true">'+(isSel?'✓':'')+'</div>'
      +'</div>';
  }).join('');
}

function toggleSidebar(){
  var sb = document.getElementById('sidebar');
  if(sb) sb.classList.toggle('open');
}

// ── MOBILE DRAWER ──────────────────────────────────────────────────
function openMobDrawer(){ document.getElementById('mob-drawer').classList.add('open'); document.getElementById('mob-backdrop').classList.add('open'); }
function closeMobDrawer(){ document.getElementById('mob-drawer').classList.remove('open'); document.getElementById('mob-backdrop').classList.remove('open'); }

function renderMobDrawer(){
  var el = document.getElementById('mob-drawer-phones');
  if(!el) return;
  el.innerHTML = PRODS.map(function(p){
    var isSel = sel.has(p.modeloBase);
    var precio = document.querySelector('[data-cmx-precio="'+p.modeloBase+'"]');
    var precioTxt = precio ? precio.textContent.trim() : '';
    return '<div class="mob-drawer-phone'+(isSel?' mp-sel':'')+'" onclick="toggleSelectGuia(\''+p.modeloBase+'\');renderMobDrawer()" role="button" tabindex="0">'
      +'<img class="mob-drawer-phone-img" src="'+p.img+'" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      +'<div class="mob-drawer-phone-info">'
      +'<div class="mob-drawer-phone-price">'+precioTxt+'</div>'
      +'<div class="mob-drawer-phone-name">'+p.nombre+'</div>'
      +'<div class="mob-drawer-phone-tag">'+p.destaca+'</div>'
      +'</div>'
      +'<div class="mob-drawer-phone-chk" aria-hidden="true">'+(isSel?'✓':'')+'</div>'
      +'</div>';
  }).join('');
  var btn = document.getElementById('mob-drawer-cmp-btn');
  if(btn) btn.disabled = sel.size < 2;
}

// ── COMPARE BAR + BADGES ───────────────────────────────────────────
function updateUI(){
  var n = sel.size;
  // Barra
  var bar = document.getElementById('cmp-bar');
  var btn = document.getElementById('btn-do-cmp');
  if(bar){ bar.classList.toggle('show', n>0); document.body.classList.toggle('bar-active', n>0); }
  if(btn){ btn.disabled = n<2; document.getElementById('cmp-bar-txt').textContent = n===0?'Selecciona 2 o 3 productos':n===1?'1 seleccionado — elige 1 más':n+' seleccionados'; }
  // Sidebar badge
  var sb = document.getElementById('sidebar-badge');
  if(sb){ sb.textContent=n; sb.classList.toggle('show',n>0); }
  // FAB badge
  var fb = document.getElementById('mob-fab-badge');
  if(fb){ fb.textContent=n; fb.classList.toggle('show',n>0); }
  // Redraw
  renderCards(); renderSidebar(); renderMobDrawer();
}

// ── SCROLL → MOSTRAR SIDEBAR Y FAB ────────────────────────────────
(function(){
  var hero = document.querySelector('.hero');
  var sb   = document.getElementById('sidebar');
  var fr   = document.getElementById('float-right');
  var fab  = document.getElementById('mob-fab');
  var bar  = document.getElementById('cmp-bar');
  function onScroll(){
    var heroH = hero ? hero.getBoundingClientRect().bottom : 0;
    var past  = heroH < 0;
    if(sb)  sb.classList.toggle('visible', past);
    if(fr)  fr.classList.toggle('visible', past);
    if(fab){ fab.classList.toggle('visible', past); fab.setAttribute('aria-hidden', past?'false':'true'); }
    if(fab && bar) fab.classList.toggle('cmp-open', bar.classList.contains('show'));
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

// ── OFERTAS (bajadas.json) ─────────────────────────────────────────
(async function(){
  try{
    var r = await fetch('/assets/data/bajadas.json');
    var data = await r.json();
    var IDS = PRODS.map(function(p){ return p.id; }).filter(Boolean); // agregar id a cada PROD si está en merged-admin
    var cat = data['<categoria_en_bajadas_json>']; // clave exacta usada en bajadas.json
    if(!cat||!IDS.length) return;
    var ofertas = cat.filter(function(p){ return IDS.includes(String(p.id)); });
    if(!ofertas.length) return;
    document.getElementById('sec-ofertas').style.display='';
    // Mostrar FAB de ofertas en móvil
    var fabOfertas = document.getElementById('mob-fab-ofertas');
    if(fabOfertas) fabOfertas.style.display='';
    var list = document.getElementById('ofertas-list');
    ofertas.forEach(function(p){
      var pct = p.pct || Math.round((1-p.precio/p.precioAntes)*100);
      list.insertAdjacentHTML('beforeend',
        '<div class="pcard">'
        +'<div class="pcard-body">'
        +'<span class="pcard-badge">↓ '+pct+'% · Oferta</span>'
        +'<p class="pcard-name">'+p.nombre+'</p>'
        +'<div class="pcard-price-row"><span class="pcard-price">$'+p.precio.toLocaleString('es-MX')+'</span>'
        +'<span class="pcard-price-note">Antes $'+p.precioAntes.toLocaleString('es-MX')+'</span></div>'
        +(p.link?'<div class="pcard-btns"><a class="btn-ml" href="'+p.link+'" target="_blank" rel="sponsored nofollow noopener">Ver oferta</a></div>':'')
        +'</div></div>');
    });
  }catch(e){}
})();

// ── INIT ───────────────────────────────────────────────────────────
renderCards();
</script>

<script src="/js/onboarding.js" defer></script>
<!-- cmx-footer:start --><!-- cmx-footer:end -->
<!-- cmx-related:start --><!-- cmx-related:end -->
</body>
</html>
```

---

## TIPO B — Guía informativa

Estructura más simple: sin sidebar, sin tarjetas de comparación, sin FAB.  
**Sí incluye** el botón `float-right` (desktop) con link a la categoría relacionada.

```html
<body>
<!-- cmx-header:start --><!-- cmx-header:end -->
<!-- cmx-bc:start --><!-- cmx-bc:end -->

<div class="hero">
  <div class="hero-eyebrow">GUÍA INFORMATIVA · CATEGORÍA · MÉXICO</div>
  <h1>TÍTULO</h1>
  <p class="hero-meta">Por <strong>comparalo.mx</strong> · <time datetime="YYYY-MM">Mes de año</time></p>
  <p class="hero-intro">Intro.</p>
</div>

<!-- BOTÓN FLOTANTE DERECHO — enlaza a la categoría -->
<div class="float-right" id="float-right">
  <a class="float-right-btn" href="/<cat>/" aria-label="Ver productos relacionados">
    <span class="float-right-btn-ico">🔍</span>Ver productos
  </a>
</div>

<div class="content">

  <!-- Secciones editoriales -->
  <div class="ed-section">
    <h2>TÍTULO SECCIÓN</h2>
    <p>Contenido...</p>
    <!-- Usar .callout para notas importantes, .warning para advertencias -->
    <div class="callout"><strong>Nota:</strong> texto.</div>
  </div>

  <!-- Tabla informativa (si aplica) -->
  <div class="ed-section">
    <div class="table-outer">
      <table class="cmp-tbl">
        <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
        <tbody><tr><td>Dato</td><td>Dato</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- CTA a la categoría (después del contenido principal) -->
  <div class="cta-block">
    <div class="cta-block-txt">
      <h3>¿Buscas dispositivos compatibles?</h3>
      <p>Compara opciones en Compáralo.mx.</p>
    </div>
    <div class="cta-block-actions">
      <a class="btn-primary" href="/<cat>/">Ver catálogo</a>
    </div>
  </div>

  <!-- FAQ -->
  <div class="section">
    <p class="section-eyebrow">Preguntas frecuentes</p>
    <h2>Lo que más nos preguntan</h2>
    <div class="faq-list">
      <details class="faq-item">
        <summary>¿Pregunta?</summary>
        <div class="faq-body">Respuesta.</div>
      </details>
    </div>
  </div>

  <!-- CTA final -->
  <div class="final-cta">
    <h2>EXPLORA MÁS</h2>
    <p>Encuentra las mejores opciones en México.</p>
    <div class="final-cta-btns">
      <a class="btn-final-pri" href="/<cat>/">Ver catálogo</a>
    </div>
  </div>

  <p class="disclosure">Algunos enlaces de esta página pueden ser de afiliado.</p>

</div><!-- /content -->

<script>
// Mostrar float-right al pasar el hero
(function(){
  var hero = document.querySelector('.hero');
  var fr   = document.getElementById('float-right');
  function onScroll(){
    if(fr) fr.classList.toggle('visible', hero ? hero.getBoundingClientRect().bottom < 0 : true);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();
</script>
<script src="/js/onboarding.js" defer></script>
<!-- cmx-footer:start --><!-- cmx-footer:end -->
<!-- cmx-related:start --><!-- cmx-related:end -->
</body>
</html>
```

---

## REGLAS INVARIABLES

- **GA4 `G-9TKZ4ER13X`** en todas las páginas.
- **Tag Amazon `tag=comparalo20-20`** en todos los links de Amazon.
- **`onboarding.js`** antes de `</body>`.
- No usar frameworks ni build steps.
- Links a `.html` prohibidos; usar rutas con slash final.
- El sidebar sólo aparece en desktop (≥1041px). En móvil lo sustituye el FAB + drawer.
- `float-right` sólo aparece en desktop (≥1041px).
- Correr `node scripts/sync-site.js` para rellenar los marcadores `cmx-header`, `cmx-footer` y `cmx-related`.
- Agregar la URL a `sitemap.xml`.
- Correr `node scripts/check-site.js` antes del push.

## AL TERMINAR

1. Abrir el servidor local (`.claude/launch.json`, `http://localhost:8765`) y verificar la página.
2. Probar en móvil (DevTools → móvil 375px): FAB visible al hacer scroll, drawer funcional.
3. Probar en desktop: sidebar izquierdo visible, float-right visible.
4. Correr `node scripts/check-site.js` — debe pasar sin errores.
5. Reportar qué falta (IDs de ML, imágenes, contenido editorial).
