---
name: mejorar-movil
description: Mejora la experiencia móvil de una página de categoría de comparalo.mx — hero compacto con imagen, selector de tipos con iconos, barra sticky "Cómo elegir / Filtrar", drawer de filtros, y tarjetas en dos columnas conservando todas las características técnicas. Aplica cuando Alan diga "mejora el móvil de X" o "aplica la skill de móvil a X".
---

# Mejorar experiencia móvil de una categoría

Objetivo: añadir a una página de categoría **ya existente** los componentes de UX móvil definidos en el diseño de referencia, sin romper nada en escritorio ni en los datos/links/GA4.

Lee el `CLAUDE.md` antes de tocar nada. Sus reglas (tag afiliado, GA4, git, check-site) son obligatorias.

---

## Paso 0 — Auditoría antes de tocar nada

Lee el HTML de la categoría y responde:

1. ¿Usa `data-cmx-layout="v2"` y `data-cmx-filters="panel"`?
2. ¿Qué filtros existen? Lista los `id` de cada `<input>`/`<select>` que alimenta `render()`.
3. ¿Cuántas características muestra cada tarjeta (`.spec-row` o equivalente)?
4. ¿Tiene comparador? ¿Tiene `.cmx-compare-bar` o barra inferior de selección?
5. ¿Tiene `how-strip` ya? ¿Es sticky?
6. ¿Qué CSS propio tiene la página (bloque `<style>` inline o archivo exclusivo)?

Presenta un diagnóstico de **5-8 líneas** antes de escribir código. No avances sin él.

---

## Paso 1 — Hero compacto móvil

**Solo en móvil** (`@media (max-width: 767px)`). En escritorio no cambia nada.

El hero reemplaza visualmente el encabezado existente: **no borres el `<h1>` ni el texto del `<p>` del SEO**, solo los ocultás con CSS en móvil y mostrás el nuevo bloque `.cmx-hero-m`.

```html
<!-- Justo antes del how-strip o del bloque de filtros -->
<div class="cmx-hero-m">
  <div class="cmx-hero-m__bg" style="background-image:url('IMAGEN_OG_O_PRODUCTO.webp')"></div>
  <div class="cmx-hero-m__content">
    <h2 class="cmx-hero-m__title">NOMBRE_CATEGORÍA</h2>
    <p class="cmx-hero-m__sub">DESCRIPCIÓN_BREVE (máx 2 líneas)</p>
    <span class="cmx-hero-m__count"><svg …></svg> N modelos para comparar</span>
  </div>
  <!-- Selector de tipos (Paso 2) va aquí -->
  <button class="cmx-hero-m__scroll" onclick="document.getElementById('grid').scrollIntoView({behavior:'smooth'})">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
    <span>Desplázate para ver modelos</span>
  </button>
</div>
```

**CSS para el hero** (añadir al `<style>` de la página):

```css
/* ── Hero móvil ───────────────────────────────────── */
@media (max-width: 767px) {
  .page-header { display: none }   /* oculta el encabezado original en móvil */

  .cmx-hero-m {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    margin: 12px 12px 0;
    min-height: 160px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .cmx-hero-m__bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(.45);
  }
  .cmx-hero-m__content {
    position: relative;
    padding: 14px 14px 8px;
    color: #fff;
  }
  .cmx-hero-m__title {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0 0 4px;
    line-height: 1.2;
  }
  .cmx-hero-m__sub {
    font-size: .82rem;
    margin: 0 0 6px;
    opacity: .88;
    line-height: 1.35;
  }
  .cmx-hero-m__count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: .78rem;
    background: rgba(255,255,255,.18);
    border-radius: 20px;
    padding: 3px 10px;
  }
  .cmx-hero-m__scroll {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px;
    background: rgba(255,255,255,.12);
    border: none;
    color: #fff;
    font-size: .78rem;
    cursor: pointer;
    backdrop-filter: blur(4px);
    border-top: 1px solid rgba(255,255,255,.15);
  }
}
```

**Imagen del hero**: usa la OG de la categoría si existe en `fotos/og/`, o la foto del primer producto. Si no hay imagen adecuada, usa `background: linear-gradient(135deg, var(--ac) 0%, #004a30 100%)` sin la capa `__bg`.

---

## Paso 2 — Selector de tipos con iconos

Va dentro de `.cmx-hero-m__content`, debajo de `.cmx-hero-m__count`.

```html
<div class="cmx-types">
  <!-- Repite por cada tipo relevante de la categoría -->
  <button class="cmx-type-chip" data-filter="ATRIBUTO" data-value="VALOR" onclick="cmxTypeFilter(this)">
    <span class="cmx-type-chip__icon"><!-- SVG Lucide de 20×20 --></span>
    <span>Nombre</span>
  </button>
</div>
```

**CSS**:

```css
@media (max-width: 767px) {
  .cmx-types {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 10px 14px 2px;
    scrollbar-width: none;
    position: relative;
  }
  .cmx-types::-webkit-scrollbar { display: none }
  .cmx-type-chip {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: rgba(255,255,255,.18);
    border: 1px solid rgba(255,255,255,.25);
    border-radius: 12px;
    color: #fff;
    font-size: .72rem;
    cursor: pointer;
    transition: background .15s;
    white-space: nowrap;
  }
  .cmx-type-chip.active,
  .cmx-type-chip:active {
    background: rgba(255,255,255,.38);
    border-color: rgba(255,255,255,.6);
  }
  .cmx-type-chip__icon svg { width: 20px; height: 20px; stroke: currentColor }
}
```

**JS** — conecta el chip con el filtro real de la página. Añadirlo al bloque `<script>` inline:

```js
function cmxTypeFilter(btn) {
  // Encuentra el input/select de filtro correspondiente
  const attr = btn.dataset.filter;   // e.g. "f-tipo"
  const val  = btn.dataset.value;    // e.g. "Espresso"
  const el = document.getElementById(attr);
  if (!el) return;

  // Toggle: si ya está activo, limpiar; si no, aplicar
  const active = btn.classList.toggle('active');
  if (el.tagName === 'SELECT') {
    el.value = active ? val : '';
  } else if (el.type === 'checkbox') {
    el.checked = active;
  }
  // Disparar render() de la página
  if (typeof render === 'function') render();
}
```

**Por categoría** — defínelos según lo que la página ya filtra:

| Categoría | Chips sugeridos | id del filtro |
|---|---|---|
| Cafeteras | Espresso, Goteo, Cápsulas, Percoladora | `f-tipo` |
| Freidoras | 2 L, 4 L, 6 L+, Doble cesta | `f-cap` / `f-tipo` |
| Microondas | 20-23 L, 25-28 L, 30+ L, Grill, Convección | `f-cap` / `f-tipo` |
| Laptops | Gaming, Ultrabook, 2-en-1, Workstation | `f-uso` |
| Smartwatches | Apple/iOS, Android, Con GPS, Con NFC | `window._cmxChipFilter` (ver smartwatches como referencia) |
| Bicis | Eléctrica, Montaña, Ruta, Gravel | `f-tipo` |
| Suplementos | Según sub-categoría | varía |

Usa **SVG de Lucide** inline (20×20, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.75"`). No uses imágenes externas ni `<img>`. Elige el ícono que mejor represente el tipo visualmente.

---

## Paso 3 — Barra sticky "Cómo elegir / Filtrar"

La barra se **añade al DOM**, no reemplaza el `how-strip`. El `how-strip` existente se oculta en móvil cuando la barra sticky está presente.

```html
<!-- Justo después de .cmx-hero-m -->
<div class="cmx-sbar" id="cmxSbar">
  <button class="cmx-sbar__btn cmx-sbar__elegir" id="cmxBtnElegir" onclick="cmxToggleElegir()">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
    Cómo elegir
  </button>
  <button class="cmx-sbar__btn cmx-sbar__filtrar" id="cmxBtnFiltrar" onclick="cmxOpenFilters()">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    Filtrar
    <span class="cmx-sbar__badge" id="cmxBadge" style="display:none">0</span>
  </button>
</div>
```

**CSS**:

```css
@media (max-width: 767px) {
  /* Ocultar how-strip original en móvil si existe cmxSbar */
  .cmx-sbar ~ .how-strip,
  .cmx-sbar + * .how-strip { display: none }

  .cmx-sbar {
    display: flex;
    position: sticky;
    top: 56px;          /* ajustar si el header del sitio tiene otra altura */
    z-index: 200;
    background: #fff;
    border-bottom: 1px solid #e8e8e8;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    gap: 0;
  }
  .cmx-sbar__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 13px 8px;
    font-size: .88rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    background: #fff;
    color: #111;
    transition: background .12s;
  }
  .cmx-sbar__btn:active { background: #f4f4f4 }
  .cmx-sbar__filtrar {
    border-left: 1px solid #e8e8e8;
    color: var(--ac, #006847);
    background: #f0faf5;
  }
  .cmx-sbar__filtrar.has-filters { background: var(--ac, #006847); color: #fff }
  .cmx-sbar__badge {
    background: #e53935;
    color: #fff;
    font-size: .68rem;
    font-weight: 700;
    border-radius: 10px;
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
  }
}
@media (min-width: 768px) { .cmx-sbar { display: none } }
```

**JS** — badge de filtros activos. Llama a `cmxUpdateBadge()` cada vez que cambie un filtro (engancha desde la función `render()` existente, **no la reemplaces**):

```js
function cmxUpdateBadge() {
  // Cuenta inputs/selects con valor no vacío (excepto precio-max si está en default)
  const filters = document.querySelectorAll('#cmx-fp input, #cmx-fp select, .filters input, .filters select');
  let count = 0;
  filters.forEach(el => {
    if (el.type === 'checkbox' && el.checked) count++;
    else if (el.type !== 'checkbox' && el.value && el.value !== el.dataset.default) count++;
  });
  const badge = document.getElementById('cmxBadge');
  const btn   = document.getElementById('cmxBtnFiltrar');
  if (!badge || !btn) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
    btn.classList.add('has-filters');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-filters');
  }
}

// Enganchar al render existente: al final de la función render() añadir:
//   cmxUpdateBadge();
// NO reemplaces render(), solo añade esa línea al final.
```

---

## Paso 4 — Panel "Cómo elegir"

```html
<!-- Justo después de .cmx-sbar -->
<div class="cmx-panel-elegir" id="cmxPanelElegir" aria-hidden="true">
  <div class="cmx-panel-elegir__inner">
    <div class="cmx-panel-elegir__header">
      <strong>Cómo elegir</strong>
      <button onclick="cmxToggleElegir()" aria-label="Cerrar">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <!-- Pasos: 3 máximo, personalizar por categoría -->
    <div class="cmx-step">
      <span class="cmx-step__num">1</span>
      <div>
        <strong>TÍTULO DEL PASO 1</strong>
        <p>Descripción breve en máximo dos líneas.</p>
      </div>
    </div>
    <div class="cmx-step">
      <span class="cmx-step__num">2</span>
      <div>
        <strong>TÍTULO DEL PASO 2</strong>
        <p>Descripción breve.</p>
      </div>
    </div>
    <div class="cmx-step">
      <span class="cmx-step__num">3</span>
      <div>
        <strong>Compara y decide</strong>
        <p>Revisa características, precios y tiendas.</p>
      </div>
    </div>
  </div>
</div>
```

**CSS**:

```css
@media (max-width: 767px) {
  .cmx-panel-elegir {
    max-height: 0;
    overflow: hidden;
    transition: max-height .3s ease;
    background: #f8fdf9;
    border-bottom: 1px solid #d4ead9;
  }
  .cmx-panel-elegir.open { max-height: 400px }
  .cmx-panel-elegir__inner { padding: 14px 16px 16px }
  .cmx-panel-elegir__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: .95rem;
  }
  .cmx-panel-elegir__header button {
    background: none; border: none; cursor: pointer; padding: 2px; color: #555;
  }
  .cmx-step {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    align-items: flex-start;
  }
  .cmx-step__num {
    flex: 0 0 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--ac, #006847);
    color: #fff;
    font-size: .78rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;
  }
  .cmx-step strong { font-size: .88rem; display: block; margin-bottom: 2px }
  .cmx-step p { font-size: .8rem; color: #555; margin: 0; line-height: 1.4 }
}
@media (min-width: 768px) { .cmx-panel-elegir { display: none } }
```

**JS**:

```js
function cmxToggleElegir() {
  const panel = document.getElementById('cmxPanelElegir');
  if (!panel) return;
  panel.classList.toggle('open');
  panel.setAttribute('aria-hidden', panel.classList.contains('open') ? 'false' : 'true');
}
```

---

## Paso 5 — Drawer de filtros móvil

**Solo se activa en móvil.** En escritorio el filtro funciona igual que antes (panel lateral `filters-panel.js`).

La función `cmxOpenFilters()` (del botón Filtrar en la barra sticky) **reutiliza el panel existente** si la página usa `data-cmx-filters="panel"`. Si no, abre el div de filtros original.

```js
function cmxOpenFilters() {
  // Intentar abrir el panel genérico de filters-panel.js
  const aside = document.getElementById('cmx-fp');
  if (aside) {
    // filters-panel.js usa un botón toggle o expone toggleFiltersPanel()
    if (typeof toggleFiltersPanel === 'function') {
      toggleFiltersPanel();
      return;
    }
    // Fallback: cambiar visibilidad del aside como drawer
    aside.classList.toggle('cmx-drawer-open');
  }
}
```

**CSS adicional para convertir el aside en drawer en móvil** (si no es panel ya):

```css
@media (max-width: 767px) {
  #cmx-fp.cmx-drawer-open {
    position: fixed;
    inset: 0 0 0 0;
    z-index: 500;
    overflow-y: auto;
    background: #fff;
    padding: 16px;
    animation: cmxSlideUp .25s ease;
  }
  @keyframes cmxSlideUp {
    from { transform: translateY(100%) }
    to   { transform: translateY(0) }
  }
}
```

---

## Paso 6 — Tarjetas: botones Amazon / Mercado Libre con CTA claro

Los botones deben tener **texto completo** directamente en el HTML del `cardHtml`: `Ir a Mercado Libre` y `Ir a Amazon`. Sin logos ni íconos dentro del botón — el nombre de la tienda es suficiente para que el usuario sepa a dónde lo lleva.

**En el `cardHtml` de la página**, localiza donde se genera el `<a class="btn-ml">` y el `<a class="btn-amz">` y asegúrate de que el contenido sea solo texto:

```js
// ML
`<a class="btn-ml" href="${p.linkML}" target="_blank" rel="sponsored nofollow noopener" ...>Ir a Mercado Libre</a>`

// Amazon
`<a class="btn-amz" href="${amzUrl(p)}" target="_blank" rel="sponsored nofollow noopener" ...>Ir a Amazon</a>`
```

**No uses** `::before` CSS ni `<span class="btn-ira-txt">` — el texto va directo en el `<a>`. Esto funciona igual en escritorio y móvil sin CSS adicional.

Si la página oculta `.btn-ira-txt` en móvil con `display:none`, ese CSS queda obsoleto (no hace daño dejarlo, pero tampoco aplica si no hay ese span).

---

## Paso 7 — Tarjetas en 2 columnas: verificar y conservar

La mayoría de páginas ya tienen 2 columnas en móvil con `cards.css`. **Verificar que siga así** y que las características no se desborden.

```css
@media (max-width: 767px) {
  /* Verificar que el grid sea de 2 columnas */
  #grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 0 10px;
  }
  /* Si los títulos de producto son muy largos, recortar con 2 líneas */
  .pcard__name, .card-name {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: .8rem;
  }
  /* Specs: no ocultar, solo compactar */
  .spec-row, .pcard__spec {
    font-size: .72rem;
    padding: 1px 0;
  }
  .spec-row svg, .pcard__spec svg {
    width: 12px;
    height: 12px;
  }
}
```

**Regla crítica**: NO eliminar `.spec-row` ni características para "limpiar" el diseño. Las características son la propuesta de valor del sitio.

---

## Paso 8 — No romper escritorio ni GA4

Checklist antes de dar por terminado:

- [ ] `node scripts/check-site.js` pasa sin errores
- [ ] GA4 `G-9TKZ4ER13X` sigue presente
- [ ] Tag afiliado `comparalo20-20` intacto en todos los links
- [ ] En escritorio (≥768 px) no hay cambios visuales indeseados
- [ ] `.cmx-sbar`, `.cmx-hero-m`, `.cmx-panel-elegir` tienen `display:none` explícito en ≥768 px
- [ ] `filters-panel.js` sigue funcionando en escritorio
- [ ] Comparador sigue seleccionando productos y abriendo la tabla
- [ ] No hay scroll horizontal en 360-430 px (revisar en DevTools)
- [ ] Los eventos GA4 de clicks en Amazon/ML no se duplicaron

---

## Configuración por categoría

Cada vez que apliques la skill a una categoría nueva, personaliza estos valores:

```
NOMBRE_CATEGORÍA   → el <h1> existente (cópialo, no lo inventes)
DESCRIPCIÓN_BREVE  → el <meta name="description"> o el primer <p> del encabezado
N_MODELOS          → el contador real de productos del array JS
IMAGEN_HERO        → fotos/og/<categoría>-og.webp | fotos/og/<categoría>-og.svg | o primer producto
CHIPS DE TIPO      → ver tabla del Paso 2; conectar con id real del filtro
PASOS "CÓMO ELEGIR"→ 3 pasos específicos de esta categoría (no genéricos)
```

---

## Orden de trabajo al aplicar la skill

1. Auditoría (Paso 0) — presentar diagnóstico
2. Hero móvil (Paso 1)
3. Selector de tipos (Paso 2)
4. Barra sticky (Paso 3) + badge JS
5. Panel "Cómo elegir" (Paso 4)
6. Drawer filtros (Paso 5) — verificar que reutiliza el existente
7. Botones CTA tiendas (Paso 6)
8. Verificar 2 columnas y specs (Paso 7)
9. Checklist final (Paso 8) + `check-site.js`
10. Preview en DevTools móvil (375 px y 390 px) antes de commit

No apliques a otras categorías hasta que Alan confirme que la primera quedó bien.
