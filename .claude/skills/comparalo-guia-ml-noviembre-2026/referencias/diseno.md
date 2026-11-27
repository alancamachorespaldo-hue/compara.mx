# Diseño oficial de las guías de Mercado Libre

Especificación visual: `img/escritorio.webp` (manda), `img/movil-1.webp`, `img/movil-2.webp`.
Las imágenes móviles se pueden adaptar para leer mejor; la de escritorio no se reinterpreta.
No sustituir componentes del mockup por equivalentes genéricos.

Tokens de la casa: `--ac:#006847` (verde), `--ml:#f0c000` (amarillo ML), fuente Satoshi.
Encabezados de sección con el doble chevrón verde/rojo del logotipo, como en el mockup.

## 1. Escritorio (≥1200 px): tres columnas

```
┌ header del sitio (cmx-header) ────────────────────────────────────────────┐
│ ÍNDICE (≈220px, sticky) │ ARTÍCULO (fluido, máx ≈680px) │ OFERTAS (≈290px) │
└ barra de comparación fija abajo (solo con ≥1 producto seleccionado) ───────┘
```

Entre 1041 y 1199 px: se oculta la columna de ofertas y la columna izquierda gana el botón
«🔥 Ver ofertas del día», que abre el mismo panel de ofertas. ≤1040 px: experiencia móvil.
El header del sitio es sticky (64 px): las columnas laterales usan `top:76px` y las secciones
`scroll-margin-top:78px`.

### 1.1 Columna izquierda — índice y herramientas
`position:sticky; top:<alto del header + 12px>`. **Sin `overflow` ni alto fijo en el contenedor**:
si el índice no cabe, se compactan los subapartados (acordeón "Mejores modelos"), no se le pone
scroll propio.

1. **Guía de contenido**: lista numerada de las secciones H2; la activa resaltada (scroll-spy con
   `IntersectionObserver`, `aria-current="true"`). "Mejores modelos" despliega un subíndice con cada
   producto analizado.
2. **Consejo clave** (opcional): una recomendación contextual corta tomada del propio artículo.
3. **Comparar productos**: miniaturas de los seleccionados (hasta 3), casilla «+ Agregar», botón
   «Comparar ahora (n/3)» y «Limpiar selección».

### 1.2 Columna central — artículo
Orden del mockup; se adapta al contenido (ver `componentes-y-contenido.md`):

1. Breadcrumb (`cmx-bc`, lo escribe `sync-site.js`).
2. Etiqueta «GUÍA DE COMPRA · MÉXICO · 2026», **H1**, entradilla, fila de metadatos
   (Actualizado · Lectura · Precios de referencia) e imagen de cabecera a la derecha.
3. **Respuesta rápida** (caja verde con ✓ y botón «Ver resumen →» que baja a la conclusión).
4. **¿Qué debes revisar antes de comprar?** — rejilla de criterios con icono.
5. **Comparativa rápida** — tabla con nombre enlazado a su análisis, precio (`data-cmx-precio`),
   especificaciones y casilla «Comparar». Enlace «Ver tabla completa →».
6. **Modelos recomendados** — pestañas/etiquetas por perfil y fichas (componentes B/C).
7. Análisis individuales, recomendaciones según necesidad, FAQ, conclusión, metodología y aviso.

El artículo se desplaza con la página y conserva todo su contenido.

### 1.3 Columna derecha — Ofertas del día
Caja con cabecera «🔥 Ofertas del día · Ver todas →». Cada tarjeta: imagen, nombre, variante,
precio anterior tachado **solo si está verificado**, precio actual, chip de descuento **solo si
está comprobado**, botón amarillo «Ver en Mercado Libre ↗» y corazón de favoritos
(`assets/js/favorites.js`).

- Fuente de datos: `descuentos.json` de la categoría o `assets/data/bajadas.json`. **Nunca** un
  `precioRef` escrito a mano en la guía.
- La lista tiene desplazamiento propio (`max-height` + `overflow-y:auto`, o paginado con flechas)
  para ver más ofertas sin salir del artículo.
- Sin ofertas verificadas: la caja muestra los productos de la guía con su precio actual bajo el
  título «Precios de hoy» (sin tachados ni %). No se oculta la columna.
- Debajo: caja de confianza («Envíos rápidos y seguros…») y acceso a la comparación.

### 1.4 Barra de comparación
Fija abajo, verde: «Comparando n productos», chips con ✕ por producto, «+ Agregar otro (máx. 3)»,
botón amarillo «Comparar ahora →» (activo con ≥2) y «Limpiar». Oculta con 0 productos.

## 2. Móvil (≤1040 px)

Columna única; el artículo ocupa la pantalla y se desplaza normalmente.

1. Header compacto del sitio.
2. Breadcrumb, etiqueta, H1, entradilla, metadatos, imagen de cabecera.
3. Respuesta rápida en lista («Para rendimiento y 5G: **Moto G75**»).
4. **«Contenido de esta guía»**: índice desplegable (`<details>`), cerrado por defecto.
5. Criterios en rejilla de 3×2 con icono.
6. Fichas de producto, comparativa compacta (2 productos lado a lado; con 3, desplazamiento
   horizontal dentro de la tabla, nunca de la página), «¿Cuál conviene?», carrusel «Más opciones
   de la guía», FAQ, conclusión.
7. **Barra inferior persistente**.

### 2.1 Barra inferior (4 accesos)

| # | Etiqueta | `data-nav` | Acción |
|---|---|---|---|
| 1 | Índice | `index` | Abre panel inferior con las secciones |
| 2 | Ofertas | `offers` | Abre panel inferior con las ofertas |
| 3 | Compáralo | `compare` | Abre panel de selección/comparación; lleva contador |
| 4 | *Categoría* | `category` | Enlace a la categoría madre |

- El 4.º botón se configura por guía: etiqueta, icono y destino (Android → `/celulares/android/`,
  Cafeteras → `/electrodomesticos/cafeteras/`, Freidoras, Omega 3…). El `data-nav` es siempre
  `category`; lo que cambia es el texto y el `href`. Así GA4 mide lo mismo en todas las guías.
- **«Compáralo» y no «Comparativa»**: «Comparativa» se lee como "ir a la tabla"; «Compáralo» es una
  acción, coincide con la marca y con el mockup aprobado. Para que no haya duda lleva icono de
  balanza/logotipo, contador de seleccionados y `aria-label="Comparar productos (n seleccionados)"`.
- Altura ≈56 px + `env(safe-area-inset-bottom)`; el `body` reserva ese espacio para que no tape
  contenido ni el pie.

### 2.2 Estados

| Elemento | Estados |
|---|---|
| Botón de la barra | normal (gris) · activo (verde, cuando su panel está abierto) |
| Panel inferior | cerrado · abierto (fondo oscurecido, `aria-modal`, cierra con ✕, fondo o Esc; un solo panel a la vez) |
| Contador Compáralo | oculto con 0 · número con 1–3 |
| Índice | sección actual marcada; al tocar una, cierra el panel y hace scroll |
| Ofertas | lista con scroll propio · estado vacío «Precios de hoy» |
| Comparación 0 | texto guía «Elige 2 o 3 productos» + lista para seleccionar |
| Comparación 1 | producto + «Agregar otro producto (máx. 3)»; botón desactivado |
| Comparación 2 | botón «Ver comparativa completa →» activo |
| Comparación 3 | lleno; «Agregar» oculto; tocar un 4.º muestra aviso en línea (no `alert()`) |

### 2.3 Densidad
- H1 ≈ 26 px, H2 ≈ 20 px, texto 15–16 px con interlineado 1.5; secundarios 12–13 px (nunca <12).
- Márgenes laterales 14–16 px; separación entre secciones 20–24 px.
- Especificaciones en viñetas compactas o tabla de dos columnas; mostrar 6–7 por ficha.
- Imágenes de producto ≥96 px en ficha compacta y ≥140 px en recomendación destacada.
- No se recorta texto editorial: lo largo se pliega con «Leer más» solo si es contenido secundario.

## 3. Accesibilidad y rendimiento
- Índice en `<nav aria-label="Contenido de la guía">`; paneles con foco atrapado y retorno al botón.
- Objetivos táctiles ≥44 px. Contraste AA (el texto sobre amarillo ML es oscuro, no blanco).
- Imágenes con `loading="lazy"`, `width`/`height` y `alt` descriptivo; la de cabecera sin lazy.
- `scroll-margin-top` en cada `#sec-…` para que el header no tape el título al saltar.
- `prefers-reduced-motion`: sin scroll suave ni animaciones de panel.
