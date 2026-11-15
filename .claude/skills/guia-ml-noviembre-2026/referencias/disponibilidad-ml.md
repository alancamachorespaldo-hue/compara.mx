# Disponibilidad de productos de Mercado Libre en las guías

> Estado: la detección **ya existe** en el proyecto. La parte de avisar por guía y de
> ocultar/sustituir está **propuesta y sin implementar**. No implementar sustituciones ni retiros
> automáticos sin aprobación explícita de Alan.

## 1. Qué existe hoy (auditado el 15-nov-2026)

| Pieza | Qué hace |
|---|---|
| `scripts/merged-admin.json` | Fuente de verdad. Cada producto: `id`, `linkML` (`meli.la/…`), `mlId` (ID de **catálogo** `MLM…`), `precioML`, `estadoML`, `_mlCheckedAt`, `activo`, `pausaML` |
| `scripts/ml-update.js` | Para cada producto con `linkML` y `mlId`: precio vía `/products/{mlId}/items`; si no hay precio consulta `/products/{mlId}` para saber si el catálogo sigue vivo. Escribe `ml-report.json` |
| `update-prices.yml` | Lo corre **a diario a las 6:00 CDMX** (y manual), luego `generar-admin.js`, ofertas, `sync-guias-precios.js`, `check-site.js` y commit |
| `scripts/sync-guias-precios.js` | Lleva `precioML` a las guías anotadas con `dbId` + `data-cmx-precio`; tope de 25 % (`guias-precios-report.json`) |
| `assets/js/guias-precios.js` | En el navegador pinta el precio vivo; si el producto no tiene enlace en `catalog-mini.json` escribe «Consulta el precio en la tienda» |

Puntos clave:

- Lo verificable es el **`mlId` de catálogo**. El enlace `meli.la` no contiene el producto y la API
  responde 403 a IDs de publicación (`MLM-…`). **Sin `mlId` no hay forma de saber si el producto
  sigue vivo.**
- Las guías usan los **mismos productos e IDs** que las categorías (se enlazan por `dbId` o por
  `linkML`), así que la revisión diaria de la categoría ya cubre a la guía… si la guía declara
  `dbId`. En nov-2026 solo 2 de 20 guías lo declaran; el resto se cruza por enlace.

### Estados reales que devuelve el sistema

| `estado` en `ml-report.json` | Qué pasó en la API | Significado |
|---|---|---|
| `sin_cambio` / `actualizado` | `/products/{id}/items` devolvió ofertas | Activo y disponible |
| `sin_precio` | Sin ofertas, y `/products/{id}` responde `status: active` (o no se pudo comprobar) | Catálogo vivo **sin ofertas**: sin stock, normalmente temporal |
| `no_encontrado` | `/products/{id}` dio 404 **o** `status` distinto de `active` | Hoy mezcla dos casos: ID inexistente y catálogo pausado/inactivo |
| `precio_sospechoso` | Precio <0.2× o >4× del anterior | No se escribe; revisar el `mlId` |
| `sin_id` | Producto con enlace pero sin `mlId` | No verificable |
| `sin_revisar` / vacío (solo en `estadoML`) | Nunca pasó por el reporte | Pendiente de verificación |

Límite conocido: un error de red en `checkCatalog` devuelve `null` y el producto cae en
`sin_precio`; por eso un solo día en `sin_precio` no es prueba de nada.

## 2. Cómo revisar una guía (manual, hoy)

1. Sacar de la guía cada `dbId` y cada `https://meli.la/…`.
2. Buscarlos en `merged-admin.json` (por `id`; si la guía no declara `dbId`, por `linkML`, y
   desconfiar si ese enlace lo comparten varios productos).
3. Leer su `estado` en `ml-report.json` (fecha del reporte en `fecha`).
4. Revisar `guias-precios-report.json` → `revisar[]` (saltos >25 % sin escribir).
5. Reportar con la tabla del §6. No tocar productos todavía.

No ejecutar `ml-update.js` en local para "probar": usa las credenciales de producción. El reporte
del workflow del día es suficiente.

## 3. Política por estado (recomendación)

| Estado | Acción automática aceptable | Acción que necesita aprobación |
|---|---|---|
| Activo | Actualizar precio (ya ocurre) | — |
| `sin_precio` 1–6 días | Nada visible. El precio en vivo ya cae a «Consulta el precio en la tienda» | — |
| `sin_precio` ≥7 días seguidos | Marcar la guía «por revisar» en el reporte | **D** (ficha sin botón de compra, con nota «sin existencias al actualizar») o **B** (sustituir) |
| `no_encontrado` por catálogo pausado | Marcar «por revisar»; quitar precio y descuento | **D** mientras se confirma; a los 14 días tratar como inexistente |
| `no_encontrado` por 404 | Marcar «urgente»; quitarlo de «Ofertas del día» (comprobar que `_ofertas.js` ya lo excluye) | **B** si hay equivalente; si no, **A** (retirar ficha) + reescritura de las menciones |
| `sin_id` / `sin_revisar` | Listarlo en el reporte | Asignar `mlId` (Asignar IDs en el admin / `ml-update.js --sugerir`) |
| `precio_sospechoso` o salto >25 % | No escribir el precio (ya ocurre) | Confirmar el `mlId` y el precio a mano |

Alternativas: **A** ocultar · **B** sustituir · **C** marcar para revisión · **D** ficha histórica
sin CTA. **C es el paso por defecto**: nada editorial cambia solo; lo único automático es dejar de
mostrar precio/descuento de algo que no se puede comprar.

### Criterios para sustituir (B)
El sustituto debe cumplir **todo**: misma categoría y tipo; cubre la misma necesidad por la que se
recomendó el original (su etiqueta: «batería», «5G económico»…); especificaciones clave iguales o
mejores; precio dentro del rango que promete el título y a ±15 % del original; existe en
`merged-admin.json` con `mlId`, `linkML` y estado activo; no está ya en la guía. Si falla uno, no
se sustituye: se pide revisión. Al sustituir se reescriben análisis, tabla, "cuál conviene", FAQ y
JSON-LD donde se nombraba al anterior.

### SEO al retirar un producto
- La URL de la guía no cambia. Se actualiza `dateModified` y «Actualizado».
- Si el producto tenía sección propia con buen texto: se convierte en ficha histórica (D) o se
  reaprovecha el contenido en la sección del sustituto; su `#sec-…` no se reutiliza.
- Se corrigen las menciones en respuesta rápida, conclusión y FAQ (visible y JSON-LD) para que no
  quede una recomendación de algo que ya no se vende.

### Comparativas que pierden un producto
- La fila sale de la tabla y de las listas de selección; si el usuario lo tenía seleccionado en
  `localStorage`, se descarta al cargar.
- Mínimo editorial: **3 productos comprables**. Con menos, la guía pasa a «urgente» y no se publica
  ninguna promesa de «mejores N».

## 4. Respuestas a las diez preguntas

1. **¿Cómo detectamos que desapareció?** Con lo que ya corre: `ml-update.js` marca
   `no_encontrado`. Falta separar 404 de "pausado" y cubrir los productos sin `mlId`.
2. **¿Cada cuánto consultar?** Diario, dentro de `update-prices.yml`. No hace falta un segundo ciclo.
3. **¿Sin stock temporal?** Se conserva la ficha; sin precio fijo. A los 7 días seguidos, revisión.
4. **¿Cuándo ocultar?** Solo con 404 confirmado dos días seguidos y sin sustituto, con aprobación.
5. **¿Cuándo sustituir?** Con 404 o pausa >14 días **y** un candidato que pase todos los criterios.
6. **¿Cómo evitar un sustituto inferior?** Con la lista de criterios y aprobación humana; el
   sistema propone, no publica.
7. **¿Cómo saber qué guías contienen un ID?** Índice inverso producto → guías: por `dbId` (exacto)
   y, mientras haya guías sin `dbId`, por `linkML`. Toda guía nueva o rediseñada declara `dbId`.
8. **¿Valor SEO al retirar?** Ver arriba: misma URL, ficha histórica o contenido reaprovechado,
   menciones corregidas, fecha actualizada.
9. **¿Comparativas incompletas?** Sale la fila; mínimo 3 productos; si no, urgente.
10. **¿Qué se automatiza?** Automático: detectar, fechar, reportar, dejar de mostrar precio y
    descuento. Con aprobación: ocultar, sustituir, cambiar textos y recomendaciones.

## 5. Propuesta de mantenimiento (pendiente de aprobación)

Reutiliza el sistema actual; no crea un segundo actualizador.

1. **`ml-update.js`** (cambio chico): distinguir `no_existe` (404) de `pausado` (status ≠ active) en
   vez de un solo `no_encontrado`, y guardar en `merged-admin.json` desde cuándo está así
   (`_mlIncidenciaDesde`). Hay que revisar quién lee `no_encontrado` (`generar-admin.js`, el admin)
   antes de cambiar el nombre; alternativa sin riesgo: conservar `no_encontrado` y añadir un campo
   `motivo: '404' | 'pausado'`.
2. **`scripts/guias-salud.js`** (nuevo, solo lectura): recorre `guias/**/index.html`, arma el índice
   producto → guías, lo cruza con `merged-admin.json` y `ml-report.json` y escribe
   `scripts/guias-salud-report.json`. No modifica ninguna guía.
3. **Workflow**: un paso más en `update-prices.yml` después de `sync-guias-precios.js`.
4. **Vista**: una pestaña «Salud de guías» en el admin local (o, de inicio, la tabla en el resumen
   del workflow de GitHub).
5. **Sugerencia de sustitutos** (etapa posterior): candidatos de la misma categoría en
   `merged-admin.json` que pasen los criterios; solo como propuesta en el reporte.

## 6. Qué debe mostrar el reporte

| Campo | Origen |
|---|---|
| Producto | `merged-admin.json` → `nombre` |
| ID de Mercado Libre | `mlId` |
| Guías donde aparece | índice inverso |
| Estado de la publicación | `ml-report.json` → `estado` (+ `motivo`) |
| Última verificación | `_mlCheckedAt` / `fecha` del reporte |
| Tipo de incidencia | sin stock · pausado · no existe · sin ID · precio fuera de tope · fuera del rango del título |
| Acción recomendada | tabla del §3 |
| Sustituto propuesto | etapa 5; vacío mientras no exista |
| Revisión editorial | `pendiente` / `aprobado` / `resuelto` (lo marca Alan) |

## 7. Foto del 15-nov-2026 (para comparar la próxima vez)

20 guías con enlaces de ML, 146 enlaces: 113 activos, 14 sin ofertas, 1 no encontrado, 4 sin
verificar por falta de `mlId`, 14 que no están en la base. Incidencias: Google Nest Hub 2 (no
encontrado, guía de bocinas Buen Fin); Xiaomi Redmi 17 sin `mlId` (4 guías de celulares);
Nintendo Switch 2 y Switch OLED sin ofertas y con `activo:false` en la base pero todavía enlazadas
en 3 guías de videojuegos; 4 cafeteras, Honor X5C Plus, Onn TV Stick 4K y Apple Watch SE 3 sin
ofertas; Samsung A16 5G con salto de 30 % ($2,701 en la guía, $3,500 en la base).
