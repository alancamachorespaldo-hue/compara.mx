---
name: filtro-bajadas
description: Añade el filtro "↓ Bajó de precio" a una página de comparalo.mx — tanto en la barra lateral (panel) como en el chip sobre el grid. Registra el evento GA4 "filtro_bajada_precio". Úsala cada vez que Alan pida añadir el filtro de bajada a una página nueva o que pregunte por qué no aparece el filtro en una categoría.
---

# Filtro "Bajó de precio" — cómo añadirlo a una página

El sistema de bajadas ya existe y funciona con dos capas:

1. **`bajadas.json`** (`assets/data/bajadas.json`) — se regenera diario en el workflow `update-prices.yml`. Contiene los productos con bajada activa (< 30 días) por categoría.
2. **`price-drops.js`** (`assets/js/price-drops.js`) — lee `bajadas.json`, expone `window.cmxGetDrop(p)` y `window.cmxDropBadge(d)`, y pinta el badge "↓ X% · Bajó $Y" en cada tarjeta. En páginas sin panel añade automáticamente un chip "↓ Bajó de precio" sobre el grid. En páginas con panel (`filters-panel.js`), el filtro aparece en la barra lateral como sección "Ofertas" (lo agrega `dropFacet()` en `filters-panel.js`).

**GA4:** el evento `filtro_bajada_precio` se dispara al activar el filtro — ya implementado en `price-drops.js`, `filters-panel.js`, y en las páginas con manejo nativo (proteína, creatina).

**Ventana de tiempo:** 30 días tanto para ML (`DIAS_OFERTA_ML`) como para Amazon (`DIAS_OFERTA_AMZ`). Un producto que bajó hace más de 30 días no aparece aunque su precio no haya subido.

---

## Checklist para añadir el filtro a una página

### 1. Verificar que la URL está en el MAP de `price-drops.js`

Abre `assets/js/price-drops.js` y busca el objeto `MAP`. Si la URL de la página (`/mi-categoria/`) no está ahí, añádela:

```js
'/mi-categoria/': 'clave_en_bajadas_json',
```

La clave debe coincidir con el nombre de categoría en `bajadas.json` y en `merged-admin.json`. Convención: minúsculas, guión bajo para espacios (ej. `tecnologia_audifonos`).

### 2. Verificar que `generar-bajadas.js` cubre la categoría

Abre `scripts/generar-bajadas.js`. Si la categoría no aparece en el bucle principal (porque no existe como clave en `merged-admin.json`) o en el objeto `DESCUENTOS`, añádela en `DESCUENTOS`:

```js
'mi-categoria/descuentos.json': ['clave_en_bajadas_json'],
```

Esto hace que las ofertas que ya genera `generar-*-descuentos.js` también aparezcan en `bajadas.json`.

### 3. Verificar que `price-drops.js` está cargado en la página

Antes de `</body>` debe haber:

```html
<script src="/assets/js/price-drops.js" defer></script>
```

Ponlo después de `cards-enhance.js` y antes de `onboarding.js`. Si no está, añádelo.

### 4. Páginas SIN panel genérico (`filters-panel.js`)

No hace falta nada más. `price-drops.js` añade el chip "↓ Bajó de precio" automáticamente sobre el `#grid` cuando hay productos con bajada. El evento GA4 ya está en el chip.

### 5. Páginas CON panel genérico (`data-cmx-filters="panel"` + `filters-panel.js`)

`filters-panel.js` ya añade `dropFacet()` a todas las páginas con panel — aparece como sección "Ofertas" en la barra lateral. Solo verifica que `price-drops.js` esté cargado (paso 3) y que la URL esté en el MAP (paso 1). No añadas nada más.

### 6. Páginas con manejo NATIVO (proteína, creatina)

Estas páginas manejan la bajada ellas mismas con `getDrop()` / `setSoloBajada()`. No usar `price-drops.js` en ellas (lo marca `NATIVE = typeof window.getDrop === 'function'`). Si añades una página parecida, copia el patrón completo de `suplementos/proteina/index.html`:
- Función `getDrop(p)` que llama a `window.cmxGetDrop(p)`
- Sección `#prt-section-bajada` en el panel lateral con `<input id="chk-bajada" onchange="setSoloBajada(this.checked)">`
- Función `setSoloBajada(checked)` que actualiza `filters.soloBajada` y dispara el GA4:
  ```js
  function setSoloBajada(checked) { filters.soloBajada = checked; if (checked && typeof gtag === 'function') gtag('event', 'filtro_bajada_precio', { page_path: location.pathname }); afterFilterChange(); }
  ```
- En `initFilterLists()`: contar `bajadaCount` y mostrar/ocultar `#prt-section-bajada`
- En el render de tarjeta: pintar `dropHTML` con la clase `.prt-bajada`

---

## Cómo funciona la ventana de 30 días

**ML:** `generar-admin.js` escribe `_precioMLFecha` (fecha ISO `YYYY-MM-DD`) cuando detecta que el precio bajó. Si es la misma racha (mismo `_precioMLAntes`) no actualiza la fecha. Al subir el precio borra `_precioMLAntes` y `_precioMLFecha`. `_ofertas.js` → `mlVigente(p)` rechaza bajadas con más de `DIAS_OFERTA_ML` (30) días.

**Amazon:** `_precioAmzFecha` la escribe el artifact al capturar un precio menor. `_ofertas.js` → `amzVigente(p)` usa `DIAS_OFERTA_AMZ` (30 días).

**Cliente:** `price-drops.js` → `cmxGetDrop(p)` también verifica el campo `fecha` del JSON (que `generar-bajadas.js` incluye). Si han pasado más de 30 días no devuelve la bajada aunque esté en `bajadas.json`.

---

## Checklist rápido al terminar

- [ ] La URL de la categoría está en el MAP de `price-drops.js`
- [ ] `price-drops.js` está cargado en la página (antes de `onboarding.js`)
- [ ] `generar-bajadas.js` cubre la categoría (en el bucle principal o en `DESCUENTOS`)
- [ ] El filtro aparece en el navegador cuando hay bajadas (probar en http://localhost:8765)
- [ ] `node scripts/check-site.js` pasa sin errores
