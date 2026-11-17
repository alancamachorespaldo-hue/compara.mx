---
name: revisar-disponibilidad
description: Revisa en Mercado Libre si los productos que anuncia comparalo.mx siguen existiendo (catálogo caído, publicación pausada, link de afiliado que ya no lleva al producto), pausa lo que esté caído en merged-admin.json y lo quita de las páginas. Úsala cuando Alan diga "revisa disponibilidad", "revisa los productos de X", "¿qué productos ya no existen?", "limpia los links caídos", "revisa si siguen vivos los productos" o antes de publicar una categoría nueva.
---

# Revisar disponibilidad de productos en Mercado Libre

Objetivo: que comparalo.mx no anuncie nunca un producto que ya no existe, está pausado en ML o
cuyo link de afiliado manda a otra cosa. Eso es lo que más credibilidad le quita al sitio.

Lee también el `CLAUDE.md` del repo: sus reglas de git (nada de `git stash`, archivos por nombre,
`check-site.js` antes de push) son obligatorias aquí.

## Cómo funciona

`scripts/revisar-disponibilidad.js` revisa en dos capas:

| Capa | Qué comprueba | Cuánto tarda | Cuándo |
|---|---|---|---|
| 1. Catálogo | `/products/{mlId}` y sus ofertas: existe, está activo, alguien lo vende | ~2–3 min todo el sitio | diaria, dentro de `update-prices.yml` |
| 2. Links (`--links`) | abre cada `meli.la` y comprueba que siga llevando a SU producto | ~20 min | semanal (`revisar-disponibilidad.yml`) o a mano |

Estados: `ok` · `sin_ofertas` · `pausado` · `no_existe` · `link_roto` · `link_otro` · `sin_id` · `error`,
y con `--links` también `precio_no_coincide`.

**`precio_no_coincide` no se pausa.** El producto existe y se vende; lo que pasa es que la ficha que
abre el link es más cara que el precio publicado (el nuestro sale de la oferta más barata con envío
FULL del catálogo y ML puede destacar otra). Quien da clic llega esperando un precio y ve otro, así
que va en el informe y en el gestor, pero **nunca cambies el precio por tu cuenta**: es decisión de
Alan, y la regla del CLAUDE.md de no tocar precios sigue vigente.

Dos reglas de seguridad que **no se tocan**:
- `error` (timeout, 429, 5xx) nunca pausa nada: un fallo de la API no es un producto caído.
- Un producto se pausa cuando se ve caído en **dos corridas seguidas** (`--umbral`), y se reactiva
  solo si vuelve a estar disponible. Las pausas que Alan puso a mano nunca se tocan.

## Procedimiento

1. **Antes de nada:** `git status` y `git pull --rebase`. Si hay cambios que no son de esta sesión,
   pregunta; no los descartes.

2. **Revisa primero sin aplicar** (así Alan ve el tamaño del problema antes de que cambie nada):

   ```bash
   node scripts/revisar-disponibilidad.js --todas
   ```

   Para una categoría: `--categoria=laptops,cafeteras`. Para incluir los links: `--links`.

3. **Entrega el informe a Alan antes de pausar nada.** El script ya imprime la tabla; tu trabajo es
   pasarla a la respuesta, en este orden y sin adornos:

   **a) Tabla por categoría** — una fila por categoría y una de TOTAL:

   | Categoría | En la web | Revisados | Bien | Problemas | Ya pausados | Sin ID |
   |---|---|---|---|---|---|---|

   - *En la web*: productos activos de esa categoría (incluidos los que no se pueden revisar).
   - *Revisados*: los que tienen ID de catálogo y sí se pudieron comprobar.
   - *Problemas*: lo caído de esta corrida. *Ya pausados*: los que hoy están ocultos.
   - *Sin ID*: no verificables; son trabajo pendiente, dilo.

   **b) Qué hay que corregir**, agrupado por motivo (ya no existe / pausado en ML / link roto /
   link a otro producto / sin ofertas), con los ejemplos que imprime el script.

   **b2) Precios que la ficha desmiente** (solo con `--links`): cuántos y los peores, con la
   diferencia. No se pausan ni se corrigen solos.

   **c) Señales de alarma.** Si una categoría tiene **más de la cuarta parte** caída, dilo aparte:
   casi siempre es un problema de datos (`mlId` mal asignados), no 20 productos agotados el mismo
   día. Ahí toca `auditar-links.js`, no pausar en masa.

   **d) Qué propones hacer** y qué queda sin resolver.

4. **Aplica solo cuando Alan lo pida** (o cuando él mismo pidió "revisa y pausa"):

   ```bash
   node scripts/revisar-disponibilidad.js --todas --aplicar
   node scripts/sync-pausas.js
   ```

   `--aplicar` escribe `pausaML`, `_pausaAuto`, `_motivoPausa` y `_pausaFecha` en
   `merged-admin.json`. **No borra nada**: ni el producto, ni el link, ni el precio. `sync-pausas.js`
   es el que hace que desaparezca de la página.

   Si Alan quiere pausar hoy mismo lo que se vio caído una sola vez: `--umbral=1`.

5. **Deja el gestor al día:** `node scripts/generar-admin.js`. Ahí Alan toma las decisiones:

   - Panel 📋 → tarjeta **"Disponibilidad en Mercado Libre"**: los caídos con su motivo y botones
     para pausar de uno en uno o todos.
   - Columna **"Revisado en ML"** en la tabla: cuándo se revisó cada producto y qué salió
     (*Disponible*, *Link roto*, *Sin revisar*…). Se puede ordenar por esa columna para ver lo
     que lleva más tiempo sin mirarse.
   - Colas: **"Pausados por la revisión"** (los que ocultó el script; se reactivan con el
     interruptor), **"En observación"** (vistos caídos una vez) y **"Nunca revisados"**.

   Si Alan tenía el artifact abierto, recuérdale que hay que volver a publicarlo (ver la entrada
   de CLAUDE.md sobre publicar el artifact).

6. **Valida y publica:** `node scripts/check-site.js` y `node scripts/validar-datos.js` antes del
   push. Commit con los archivos por nombre; un commit = un tema.

## Cuando la causa es el `mlId` y no el producto

Si ves muchos `link_otro` o productos cuyo link abre algo sin relación, el problema es el ID de
catálogo mal asignado, no el stock. Ahí la herramienta es otra:

```bash
node scripts/auditar-links.js --categoria=<clave> --aplicar
```

Saca el `mlId` real del link de afiliado y lo corrige. Córrelo **antes** de pausar: pausar
productos vivos por un ID equivocado es el error contrario y también cuesta credibilidad.

## El reporte acumula

`disponibilidad-report.json` **no se borra** al revisar una sola categoría: conserva lo que ya se
sabía de las demás y guarda en `revisadas` la fecha de la última revisión de cada una. Por eso el
gestor siempre muestra la foto completa, aunque la última corrida fuera de una categoría.

## Qué reportar al terminar

- La tabla del punto 3 (aunque ya la hayas mostrado antes de pausar, con los números finales).
- Qué se pausó, qué se reactivó y qué quedó "en observación".
- Lo que **no** se pudo verificar: productos sin `mlId` y los que dieron `error` de API.
- Si corriste con `--links` o solo con la capa de catálogo — no afirmes que los links están bien
  si no los abriste.
- Si el sitio quedó publicado o no (commit y push), y si falta republicar el artifact del gestor.
