---
name: crear-guia-ofertas
description: >
  Publica una guía editorial de ofertas/compra que Alan trae ya redactada (normalmente desde
  ChatGPT) como HTML o texto, y la deja lista y conforme a las reglas de Amazon: botones de
  afiliado bien configurados con el tag guiasdecomp01-20, divulgación obligatoria, sin precios
  de Amazon escritos a mano, y la tarjeta insertada arriba del sub-hub de /guias-compra/. Úsala
  cuando Alan diga "sube esta guía", "publica la guía que te paso", "aquí está la guía de
  ChatGPT", "guía de ofertas de X" o similar.
---

# Skill: crear-guia-ofertas

Convierte una guía que **Alan trae ya escrita** (casi siempre generada en ChatGPT, pegada como
HTML o texto) en una página de guía de comparalo.mx **publicada y conforme al reglamento de
Amazon**, dentro del apartado **Guías de compra** (`/guias-compra/`).

El trabajo de esta skill es: **maquetar el contenido de Alan en la plantilla de la casa, cablear
los botones de afiliado de Amazon correctamente, y publicar** (página + tarjeta en el sub-hub +
sitemap + validación). **El contenido editorial lo escribe Alan; tú no inventas productos,
precios ni características.**

> Para la mecánica de la plantilla (head, header, secciones, sidebar/FAB, JS) reutiliza la skill
> [`crear-guia`](../crear-guia/SKILL.md). Esta skill **añade la capa de cumplimiento de Amazon y
> el paso de publicación en `/guias-compra/`**. Si hay conflicto, mandan las reglas de Amazon de
> abajo.

---

## 0. REGLAS DE AMAZON QUE NUNCA SE ROMPEN

Salen de los documentos oficiales del programa de afiliados que aceptó Alan (Acuerdo Operativo +
Políticas del Programa, cuenta **StoreID `guiasdecomp01-20`**). Son la razón de ser de esta skill:
una guía que las incumpla pone en riesgo la cuenta (ya fue dada de baja dos veces).

1. **Tag de afiliado: `guiasdecomp01-20`.** Va como parámetro `?tag=guiasdecomp01-20` en **cada**
   enlace a amazon.com.mx. **No** usar `comparalo20-20` (ese es de la cuenta vieja). No usar el tag
   de estas guías para otra cosa que no sean comisiones de Amazon Associates.

2. **Divulgación obligatoria y visible.** La página debe mostrar, cerca de los enlaces (arriba del
   contenido), la frase textual (Sección 5 del Acuerdo):
   > **Como Afiliado de Amazon, percibo dinero con las compras elegibles.**
   El aviso del pie (`cmx-footer`) ayuda, pero **no sustituye** esta frase dentro del contenido.

3. **NUNCA precios de Amazon escritos a mano.** El reglamento (Requisitos 2b) solo permite mostrar
   precio/disponibilidad de Amazon si vienen de un enlace/widget que da Amazon **o** de la Product
   Advertising API. La PA-API no se habilita hasta tener 3 ventas calificadas, así que en estas
   guías **el precio de Amazon no se muestra**: solo un botón **"Ver precio en Amazon"** sin cifra.
   - Si la guía de ChatGPT trae precios de Amazon en texto ("$8,999 en Amazon"), **quítalos** y
     cámbialos por "Consulta el precio en Amazon".

4. **Nada de seguimiento ni alertas de precio sobre Amazon** (Requisitos 6-y). No apliques a
   productos de Amazon: `price-drops.js`, `data-cmx-precio`, `bajadas.json`, `guias-precios.js`,
   badges de "↓ bajó de precio", "antes $X" ni "oferta detectada". Esas funciones son solo para
   Mercado Libre.

5. **Solo enlaces a páginas de producto reales** de amazon.com.mx (`/dp/<ASIN>`) o a listados con
   contenido original relevante al lado. Nada de enlaces a Amazon en pop-ups/intersticiales ni
   acortadores que oculten que el enlace va a Amazon. `rel="sponsored nofollow noopener"` y
   `target="_blank"` en cada enlace.

6. **Sin afirmaciones engañosas** sobre especificaciones, precio o promociones (Requisitos 2b). No
   digas "el más barato", "precio garantizado" ni "oferta por tiempo limitado" salvo que sea verdad
   y verificable; si mencionas una promo temporal, hay que quitarla cuando termine.

7. **Imágenes.** Las imágenes de productos de Amazon son Contenido del Programa y requieren PA-API;
   **no se scrapean** de las fichas de Amazon. Usa imágenes propias de `/fotos/`, imágenes que ya
   estén en `merged-admin.json`/el sitio, o las de Mercado Libre. Si la guía de ChatGPT trae URLs
   `m.media-amazon.com` / `images-na.ssl-images-amazon.com`, **reemplázalas o quítalas**.

8. **Contenido original obligatorio** (Requisitos 1). El texto debe ser análisis/opinión propia, no
   copiar descripciones de la ficha de Amazon. Lo que trae Alan de ChatGPT suele cumplir; aun así
   revisa que no sean párrafos calcados de Amazon.

9. **No incentivar el clic** (Requisitos 6-g). Prohibido "compra por mi enlace y te doy…", puntos,
   sorteos o recompensas por usar los enlaces.

---

## 1. RECIBIR Y ENTENDER LA GUÍA DE ALAN

Alan pega un HTML o texto. Extrae de ahí (pregunta solo si falta algo esencial):

- **Categoría** (`cat`): celulares, laptops, electrodomesticos, tecnologia… (debe existir un
  sub-hub en `/guias-compra/<cat>/`; si no existe, avísale a Alan antes de seguir).
- **Slug** y ruta final: `guias/<cat>/<slug>/index.html`.
- **Tipo de guía** (ver `crear-guia`): **Tipo A** si compara productos con ficha y enlace; **Tipo B**
  si es informativa.
- **Productos**: por cada uno, nombre exacto, **ASIN o URL de Amazon**, imagen (propia/ML), y el
  texto editorial. Si Alan no trae el ASIN/URL de Amazon de un producto, **no inventes el enlace**:
  deja el botón pendiente y pídeselo.
- **FAQ** y metadatos (título SEO, descripción).

---

## 2. MAQUETAR EN LA PLANTILLA DE LA CASA

1. Crea `guias/<cat>/<slug>/index.html` siguiendo `crear-guia` (head completo con GA4
   `G-9TKZ4ER13X`, canonical, OG, JSON-LD Article+Breadcrumb+FAQ, Satoshi, `onboarding.js`, bloque
   `<style>` copiado de la guía de referencia `/guias/celulares/mejores-celulares-menos-5000/`).
2. Vierte el contenido de Alan **dentro** de las secciones de la casa (`.ed-section`, `.section`,
   fichas `.prd-card`, FAQ con `<details>`), no como HTML suelto. Respeta su texto; tú solo maquetas.
3. **Divulgación**: justo después del `.hero`, antes del contenido, inserta:
   ```html
   <div class="disclosure" style="margin:0 auto 1rem;max-width:var(--maxw,1100px)">
     <strong>Como Afiliado de Amazon, percibo dinero con las compras elegibles.</strong>
     Algunos enlaces de esta guía son de afiliado: si compras a través de ellos, comparalo.mx
     puede recibir una comisión sin costo adicional para ti.
   </div>
   ```

---

## 3. BOTONES DE AMAZON (lo central)

Por cada producto, un botón **sin precio**. Formato exacto:

```html
<a class="btn-cta-amz"
   href="https://www.amazon.com.mx/dp/<ASIN>?tag=guiasdecomp01-20"
   target="_blank" rel="sponsored nofollow noopener"
   onclick="typeof gtag==='function'&&gtag('event','affiliate_click_amazon',{event_category:'afiliado',event_label:'<Nombre del producto>',location:'editorial_guide'})">
  Ver precio en Amazon
</a>
```

- El texto del botón es **"Ver precio en Amazon"** (lleva al usuario a ver el precio en la tienda).
  Nunca pongas la cifra en el botón ni junto a él.
- Si Alan trae una URL completa de Amazon (con `/dp/ASIN...`), consérvala pero **asegúrate de que
  `tag=guiasdecomp01-20`** sea el único `tag=` (quita cualquier `tag=comparalo20-20` u otro).
- `location`: usa `editorial_guide` en las secciones de texto y `decide_section` en tarjetas de
  "¿cuál te conviene?".
- Si además hay enlace de **Mercado Libre**, ese sí puede llevar precio vivo (`data-cmx-precio` +
  `guias-precios.js`), botón `.btn-cta-ml` con evento `affiliate_click_ml`. El precio vivo es **solo
  para ML**, nunca para Amazon (regla 0.3 y 0.4).

---

## 3b. BOTÓN DE AFILIADO EN CADA MENCIÓN

Pon un botón/enlace de afiliado **cada vez que se menciona o recomienda un producto**, no solo en su
tarjeta: en el veredicto ("Elige X si…"), en la **tabla comparativa** (en la cabecera de cada modelo y/o
una fila CTA al final), en las secciones de recomendación ("¿Cuál elegir?"), y en cualquier "quick pick".
Si el inicio de la guía tiene una tabla de comparativa rápida, esa tabla **debe** llevar su clic de
afiliado. Reutiliza el mismo enlace del producto (mismo ASIN/búsqueda + `tag=guiasdecomp01-20`). Usa
`.amz` (botón completo) o `.amz-mini` (compacto, para tabla y menciones inline).

## 3c. EVENTOS DE GOOGLE ANALYTICS (GA4)

Instrumenta la guía para poder medir qué funciona. Usa **delegación** para el clic de afiliado (un solo
listener; cada enlace lleva `data-amz="<producto>"` y `data-loc="<tabla|veredicto|tarjeta|recomendacion|…>"`):

```html
<script>
document.addEventListener('click',function(e){
  var a=e.target.closest('a[data-amz]');
  if(a&&typeof gtag==='function')gtag('event','affiliate_click_amazon',{event_category:'afiliado',event_label:a.dataset.amz,location:a.dataset.loc||'guia'});
});
</script>
```

Eventos que debe emitir cada guía (todos con guardia `typeof gtag==='function'`):
- `affiliate_click_amazon` — en **todos** los enlaces a Amazon (por delegación, ver arriba).
- `scroll_profundidad` — al cruzar 25/50/75/100 % de la página (`{porcentaje, pagina:'<slug>'}`).
- `guia_filtro` / `guia_configurador` — al tocar un chip de filtro (`{facet, valor}`).
- `guia_comparar` — al generar la tabla comparativa (`{modelos}`).
- `guia_seleccion` — al marcar/desmarcar un modelo (opcional, `{modelo, estado}`).

No midas precios de Amazon ni nada que implique seguimiento de precio (regla 0.4).

## 3d. MÓVIL PRIMERO

- El panel de **filtros/configurador va plegable en móvil**: envuélvelo en `<details class="config-collapse">`
  con un `<summary>` tipo "Filtrar modelos ▾" (colapsado por defecto en móvil para no empujar el contenido),
  y en escritorio fuérzalo abierto por CSS:
  ```css
  @media(min-width:721px){
    details.config-collapse>summary{display:none}
    details.config-collapse>*:not(summary){display:revert}
  }
  ```
- Tarjetas a 1 columna, tabla comparativa como bloques apilados, botones de afiliado a lo ancho y
  "tap-targets" de al menos 44 px. Probar siempre a 375 px antes de publicar.

## 4. PUBLICAR EN EL APARTADO (que "aparezca arriba")

1. **Tarjeta en el sub-hub.** Abre `/guias-compra/<cat>/index.html` e inserta la tarjeta como
   **primer hijo** de `<div class="ga-grid" id="ga-grid">` (arriba = primera posición):
   ```html
   <a class="ga-card" href="/guias/<cat>/<slug>/">
     <div class="ga-card-img"><img src="<imagen propia o ML>" alt="<título>" loading="lazy"></div>
     <div class="ga-card-body">
       <span class="ga-card-tag"><ETIQUETA, p.ej. GAMA MEDIA></span>
       <span class="ga-card-title"><Título de la guía></span>
       <span class="ga-card-desc"><Una línea de resumen></span>
       <span class="ga-card-cta">Ver guía</span>
     </div>
   </a>
   ```
   - Si el sub-hub aún muestra el bloque vacío `<div class="ga-empty" id="ga-empty">…</div>`,
     **bórralo** (ya hay al menos una guía).
2. **Sitemap.** Agrega `https://comparalo.mx/guias/<cat>/<slug>/` a `sitemap.xml` con
   `<priority>0.7</priority>` y la fecha de hoy en `<lastmod>`.
3. **Bloques de la casa.** Corre `node scripts/sync-site.js` para rellenar `cmx-header`, `cmx-bc`,
   `cmx-related` y `cmx-footer` de la página nueva. (El breadcrumb debe apuntar a
   `/guias-compra/` como sección padre.)

---

## 5. VALIDAR ANTES DE PUBLICAR

Checklist de cumplimiento Amazon (revísalo tú mismo, uno por uno):

- [ ] Todos los `href` de Amazon llevan `?tag=guiasdecomp01-20` (ninguno con `comparalo20-20` u otro).
- [ ] Ningún precio de Amazon escrito a mano; botón "Ver precio en Amazon" sin cifra.
- [ ] Frase de divulgación "Como Afiliado de Amazon, percibo dinero con las compras elegibles." visible.
- [ ] `rel="sponsored nofollow noopener"` y `target="_blank"` en cada enlace de afiliado.
- [ ] Sin `data-cmx-precio` / price-drops / "antes $" / "bajó de precio" sobre productos de Amazon.
- [ ] Imágenes propias o de ML (nada de `media-amazon.com`).
- [ ] Enlaces a `/dp/<ASIN>` reales; contenido original (no copiado de Amazon).
- [ ] GA4 `G-9TKZ4ER13X` y `/js/onboarding.js` presentes; tarjeta insertada arriba del sub-hub;
      URL en `sitemap.xml`.

Luego:

```bash
node scripts/check-site.js
```

Debe pasar sin errores (ya acepta el tag `guiasdecomp01-20`). Si falla, **no publiques**; corrige.

Prueba visual en `http://localhost:8765` (`.claude/launch.json`): hero, divulgación visible,
botones de Amazon abren la ficha correcta, y en móvil (375px) todo se ve bien.

---

## 6. COMMIT

Un commit = un tema. No mezcles con otras páginas. Revisa `git status` y `git diff --stat`: deben
aparecer solo la guía nueva, el sub-hub de `/guias-compra/<cat>/`, `sitemap.xml` y (si tocaste algo
de plantilla) nada más. Agrega los archivos **por nombre**, nunca `git add -A`.

---

## NOTA SOBRE EL TAG (importante para otras sesiones)

El `CLAUDE.md` histórico dice "tag de afiliado Amazon: `comparalo20-20`, no cambiarlo". Eso quedó de
la cuenta anterior. **La cuenta vigente (nov-2026) es `guiasdecomp01-20`** y es la que usan estas
guías. `check-site.js` ahora acepta **ambos** tags para no romper las páginas viejas que todavía
tienen `comparalo20-20`. No "corrijas" `guiasdecomp01-20` de vuelta a `comparalo20-20` en las guías
de `/guias-compra/`.
