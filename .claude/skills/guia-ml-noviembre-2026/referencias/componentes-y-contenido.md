# Componentes, estructura editorial, SEO y enlazado

## 1. Componentes de producto: cuál usar

Los productos aparecen de forma natural dentro de la explicación. Elegir por el valor que aportan;
no poner los cuatro en cada sección.

| Componente | Cuándo | Contiene |
|---|---|---|
| **A. Mención con enlace** | El texto nombra un producto de paso (criterios, FAQ, conclusión) | Nombre enlazado a su análisis en la misma guía (`#sec-<modeloBase>`). Si no tiene análisis, al listado de la categoría. Nunca directo a ML desde texto corrido sin que se note que es enlace de compra |
| **B. Ficha compacta** | Lista de recomendados, "Más opciones" | Imagen, nombre, 3–4 características, precio verificado, «Ver en Mercado Libre ↗», casilla «Seleccionar para comparar» |
| **C. Recomendación destacada** | El análisis individual de cada modelo y la elección principal | Imagen grande, nombre, precio, tabla de especificaciones, ventajas, desventajas, motivo de la recomendación, botón ML, «Seleccionar para comparar» |
| **D. Carrusel de relacionados** | Alternativas que no merecen sección propia | Tarjetas mini (imagen, nombre, precio, «Ver en ML ↗») con desplazamiento horizontal propio |

Reglas:

- **Precio**: `<span data-cmx-precio="<modeloBase>">$4,299</span>`. Una cifra dentro de un párrafo
  también va anotada; un precio suelto en el texto se queda viejo (pasó en la conclusión y el FAQ de
  la guía de menos de $5,000).
- **Calificación y reseñas**: solo si `merged-admin.json` las trae para ese producto. Si no, el
  bloque no se pinta.
- **Ventajas / desventajas / motivo**: salen del texto editorial existente o de especificaciones
  verificables. Toda recomendación tiene justificación escrita.
- **Botón ML**: clase única, amarillo `--ml`, logotipo `/logomercado.png`, texto «Ver en Mercado
  Libre ↗» (en espacios chicos «Ver en ML ↗»), `rel="sponsored nofollow noopener"`, `target="_blank"`
  y atributos de medición (ver `ga4.md`).
- **Un solo origen de datos por guía**: el array `familias…` con `modeloBase` + `dbId`. Los
  botones de selección pasan **`modeloBase`** (no `dbId`): mezclarlos rompe la comparación.

## 2. Estructura editorial

Base; se adapta a la intención de búsqueda (no todas las guías llevan todo):

1. H1 (título SEO) · 2. Introducción · 3. Respuesta rápida · 4. Índice ·
5. Qué revisar antes de comprar · 6. Características importantes · 7. Productos recomendados ·
8. Análisis individuales · 9. Comparativa rápida · 10. Cuál conviene según la necesidad ·
11. Preguntas frecuentes · 12. Conclusión (+ metodología y aviso de afiliados).

| Intención | Ajuste |
|---|---|
| "mejores X por menos de $N" | Respuesta rápida y comparativa arriba; análisis por modelo; "cuál conviene" por perfil |
| "X vs Y" | Comparativa primero, con veredicto; análisis de solo esos dos; alternativas en carrusel |
| "cómo elegir X" | Criterios extensos primero; productos como ejemplos (A y B), pocos C |
| Ofertas / temporada | Ofertas verificadas arriba; fecha visible; el resto compacto |

- Un solo H1. Cada sección del índice es un H2 con `id="sec-…"`; los subtemas son H3. No usar H2
  para subpreguntas de una misma sección (en la guía vieja había siete H2 con `style` en línea).
- Al rediseñar: se **conserva** el texto; se reordena y se corrigen jerarquías. Lo que se quite se
  lista en la entrega con su motivo.

## 3. SEO

- Palabra clave principal en `<title>`, H1, primer párrafo, description y un H2; secundarias y
  variaciones semánticas en H2/H3 y FAQ. No rellenar.
- `<title>` ≤60 caracteres con el año; description 150–160.
- `canonical`, OG y Twitter completos (plantilla de `<head>` en `crear-guia/SKILL.md`, sigue vigente).
- JSON-LD `@graph`: `Article` (`dateModified` = fecha real de la edición), `BreadcrumbList`
  (Inicio › Categoría › Subcategoría si existe › Guía) y `FAQPage` **con las mismas preguntas y
  respuestas que el FAQ visible**. Sin `Product`/`Offer`/`AggregateRating` con datos no verificados.
- "Actualizado: mes de año" visible debe coincidir con `dateModified`.
- Las URL no cambian en un rediseño. Si un producto se retira, su `#sec-…` no se reutiliza para otro.
- Usar la skill `mejorar-seo` para la auditoría fina.

## 4. Comparativa

Misma lógica que la categoría madre; no se crea una versión reducida que la contradiga.

- Selección de 2 a 3 productos desde tabla, fichas, índice y panel móvil; un solo estado compartido.
- «Comparar ahora» lleva al comparador de la categoría (celulares: guarda en
  `localStorage.cmp_celulares` y abre `/celulares/comparar/`; otras categorías: su mecanismo actual,
  normalmente `/<categoria>/?comparar=…`). Antes de maquetar, abrir la categoría madre y copiar su
  contrato de datos.
- La tabla en la guía es el resumen editorial: características, precio, diferencias marcadas (✓ en
  el valor ganador solo cuando es objetivo), «¿Cuál conviene?» y salida a Mercado Libre.

## 5. Afiliación Mercado Libre

- Usar los enlaces `meli.la` que ya están en `merged-admin.json` para ese `id`. No construir ni
  adivinar enlaces; si falta, el producto no lleva botón y se reporta.
- Ojo: en la BD hay enlaces ML compartidos entre productos distintos (24 en nov-2026). Emparejar
  siempre por `id`, nunca por enlace ni por nombre.
- El aviso de afiliados de la guía habla de Mercado Libre. El pie del sitio (`cmx-footer`) no se toca.

## 6. Guías relacionadas (al final)

Orden obligatorio, de arriba a abajo:

1. **Guías de la misma categoría** (hasta 4–6): las demás guías de `/guias/<misma categoría>/`.
2. **Guías de categorías madre** (3–4): una entrada por categoría hermana con guías
   («Guías de laptops», «Guías de electrodomésticos», «Guías de suplementos»…), enlazando a su
   mejor guía o a su sección en `/guias/`.
3. Acceso al comparador de la categoría y «Ver todas las guías».

Hoy `sync-site.js` (`relatedHtml`) ya escribe el bloque `cmx-related` con: comparativa de la
categoría → hasta 4 guías del mismo tema → otras **categorías** (no guías). Para cumplir el punto 2
hay que ampliar `relatedHtml` con un grupo «Guías de otras categorías» después de «Guías
relacionadas» (cambio en el script, afecta a todas las guías; pedir aprobación y correr
`sync-site.js`). **No editar el bloque a mano.**

Además, dentro del artículo: 2–4 enlaces contextuales a guías hermanas donde el texto lo pida
(«si tu presupuesto es menor, mira la guía de menos de $3,000»).
