# comparalo.mx

Sitio estático de afiliados que compara el mismo producto en Amazon MX y Mercado Libre.
HTML/CSS/JS puro publicado con **GitHub Pages** desde `alancamachorespaldo-hue/compara.mx`, rama `main`
(el deploy es automático 1-2 min después del push; no hay ningún otro servicio de hosting
conectado al repositorio).

## Reglas que nunca se rompen

- **Tag de afiliado Amazon: `tag=guiasdecomp01-20`, en todo el sitio y sin excepciones.**
  Es el StoreID de la cuenta vigente (nov-2026). Las cuentas viejas `comparalo20-20` y
  `comparabici-20` ya no existen: un enlace con esos tags no paga comisión, así que
  `check-site.js` los marca como error. El 20-nov-2026 se migraron de golpe las 1,043
  apariciones de `comparalo20-20` que quedaban. Si aparece una nueva, viene de una página
  vieja sin confirmar o de un script que la genera: corrígela, no agregues el tag a la lista.
- **GA4 `G-9TKZ4ER13X`** debe estar en todas las páginas HTML. No quitarlo, reemplazarlo ni reimplementarlo.
- No modificar `/assets/js/analytics.js`.
- No cambiar precios, especificaciones, ratings, número de reseñas, imágenes, links ni IDs de productos
  salvo que el usuario lo pida explícitamente para ese producto.
- No introducir React, Next.js, Astro, Vue ni ningún framework o build step.
- Todas las páginas cargan `<script src="/js/onboarding.js" defer></script>` antes de `</body>`.

## Git: cómo trabajar sin pisar trabajo previo

En oct-2026 un `git stash pop` aplicó un stash olvidado del 16-sep y sobrescribió 13 páginas públicas
con versiones de 3 semanas atrás (commit `40259fe`, revertido en `4aec04d`). Para que no se repita:

0. **Una sola sesión de Claude a la vez en esta carpeta.** Dos sesiones en el mismo directorio se pisan
   (una hace stash o commit de lo que la otra está editando). Para trabajo en paralelo, usar un worktree
   aparte por sesión.
1. **Al iniciar cada sesión: `git status` y luego `git pull --rebase`.** Si `git status` muestra cambios
   que esta sesión no hizo, son de otra sesión o del usuario: no tocarlos, no descartarlos, preguntar.
   Los workflows de GitHub Actions hacen commits (precios, syncs), así que el remoto casi siempre va adelante.
2. **No usar `git stash`** (bloqueado en `.claude/settings.json`). Si hay cambios sin commit que estorban,
   hacer commit o preguntar.
3. **Agregar archivos por nombre**, nunca `git add -A` ni `git add .` (también bloqueados).
4. **Antes de cada commit revisar `git status` y `git diff --stat`.** Si aparecen páginas públicas que
   no se tocaron a propósito, detenerse y averiguar por qué.
5. Un commit = un tema. Un cambio del admin no debe incluir páginas públicas.
6. Antes de hacer push: `node scripts/check-site.js` (lo mismo corre en CI en cada push).

## Estructura de URLs

URLs limpias con slash final; **no se enlaza a archivos `.html`** (excepto `aviso-afiliados.html`,
`privacidad.html`, `terminos.html`). Los `.html` en la raíz son redirecciones de URLs viejas: no editarlos
como páginas ni enlazarlos.

| Sección | Ruta | Array JS de productos |
|---|---|---|
| Inicio | `/index.html` | — (hero con carrusel "Cómo usar", sección "Nuestro método" y leads) |
| Laptops | `/laptops/` | `productos` |
| Bicis | `/bicis/` | `ELECTRICAS`, `MONTANA`, `RUTA`, `GRAVEL` |
| Electrodomésticos | `/electrodomesticos/` | — (portada) |
| Freidoras | `/electrodomesticos/freidoras/` | `productos` |
| Microondas | `/electrodomesticos/microondas/` | `micros` |
| Suplementos | `/suplementos/` | `productos` (hub de categorías) |
| Proteína / Omega 3 / Magnesio / Creatina | `/suplementos/<sub>/` | `productos` |
| Complejo B | `/suplementos/complejo-b/` | `PRODUCTOS` |
| Vitamina D | `/suplementos/vitamina-d/` | `PRODUCTOS` |
| Celulares | `/celulares/`, `/celulares/iphone/`, `/celulares/android/` | — |
| Ofertas (todas las categorías) | `/ofertas/` | — (la arma `generar-ofertas.js`) |

`/celulares/alta-gama/` y `/celulares/smartphones/` redirigen a `/celulares/android/` a propósito.
Errores de URL ya vistos: `/celularesalta-gama`, `/electrodomesticosfreidoras` (falta la barra).

## Datos y scripts (`scripts/`)

- **EL PROCESO DE DATOS (nov-2026). Los precios ya no salen de la API.** El 23-nov-2026
  Mercado Libre cerró `/products/{id}/items` con `403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES`
  (`blocked_by: PolicyAgent`): sin token, con las dos apps, con token de usuario y de
  aplicación, desde la máquina local y desde Actions, y también con productos de otros países.
  No es la cuenta, ni la app, ni el token, ni el código; no hubo aviso en el changelog y hay un
  caso de soporte abierto (497988778). **Lo único cerrado son los precios**: `/products/{id}`
  sigue dando 200 con nombre, atributos, imágenes y `status`. De ahí el reparto de hoy:

  | Dato | De dónde sale |
  |---|---|
  | Características, imagen, nombre, ¿sigue existiendo? | API, `/products/{id}` → `especs-por-id.mjs` |
  | Enlace de afiliado | **a mano**, pegado en el gestor (no hay API que lo dé) |
  | Precio | la página del enlace de afiliado → `precios-por-link.mjs` |

  **Alta de un producto:** pegas categoría + ID de catálogo + tu enlace en el gestor (botón 🔗),
  guardas, y corres `especs-por-id.mjs` y `precios-por-link.mjs` de esa categoría. Entra apagado;
  publicarlo es decisión tuya. También se puede de una: `especs-por-id.mjs --nuevo=cat:MLM…:enlace --aplicar`.
  **Mantenimiento:** `precios-por-link.mjs` por categoría o `--todas`, a diario en `precios-por-link.yml`.

  **Qué pasa con lo caído** (lo decide `precios-por-link.mjs`, no hay que acordarse de nada):
  · **Pausada en ML** → se pausa y empiezan **5 días de gracia** (`--dias-gracia`), con los días
  restantes a la vista en el reporte y en el Centro. Si a los 5 días sigue pausada, se borra.
  · **Ya no existe** (404 de `/products/{id}`) → se borra de una; un catálogo borrado no vuelve.
  · **Enlace muerto** → no se borra el producto, se retira el enlace: el catálogo sigue vivo, lo
  que murió es nuestro enlace, y con pegarle uno nuevo vuelve.
  · **Cae en la "tarjeta por defecto del perfil"** (estado `tarjeta_defecto`) → **el producto ya
  no existe: se borra**, confirmado en DOS corridas como un enlace muerto, porque esto se deduce
  de raspar una página. Esa tarjeta no es un enlace nuestro apuntando mal: cuando el destino
  desaparece, ML le devuelve al usuario **sus propias búsquedas recientes**, y en esta cuenta eso
  son gafas inteligentes (de cuando se armó `/tecnologia/lentes-inteligentes/`). Así que el
  `MLM2051584545` que sale en los reportes no tiene nada que ver con el producto ni con el enlace:
  es el síntoma de que el producto murió. No se le busca enlace nuevo ni se deja esperando.
  Hasta el 25-nov-2026 esto se trataba como `link_roto` —se retiraba el enlace y el producto se
  quedaba esperando uno que nunca iba a llegar—; ese día Alan lo aclaró, se borraron a mano los 8
  celulares que seguían en esa cola y la corrida pasó a borrarlos sola.
  **Borrar es borrar**: el objeto sale de `merged-admin.json` *y* del array de su página, en ese
  orden (al revés, nada quedaría en la base que le dijera a `sync-pausas.js` que esa tarjeta
  sobra, y se quedaría anunciada para siempre). Queda copia completa en
  `scripts/papelera-productos.json`.

  Se retiraron: `ml-update.js`, `ml-report.json`, `update-prices.yml` y los cinco
  `update-prices-<categoria>.yml`. `revisar-disponibilidad.yml` quedó a mano. `generar-admin.js`
  ya no aplica precios: solo lee el reporte para enseñarlo en el gestor.
- `precios-por-link.mjs [--todas|--categoria=a,b] [--aplicar] [--concurrencia=4] [--max-salto=25]
  [--umbral=2] [--dias-gracia=5] [--forzar]` — **la corrida de datos**. Abre la página de cada
  enlace de afiliado con `resolverAfiliado()` y de ahí saca el precio y la salud del enlace; al
  que queda en duda le pregunta al catálogo por `/products/{id}` (que sí responde) para separar
  "pausado" de "ya no existe". ~4 min para los ~1,190 con `linkML`, concurrencia 4. El precio que
  devuelve es el de la publicación a la que lleva NUESTRO enlace —el que verá quien dé clic—, no
  la oferta más barata del catálogo; se guarda también en `_precioFicha`. La racha de bajada la
  fija `actualizarRachaML()` de `_ofertas.js`, la misma de siempre, para que una oferta se
  comporte igual venga de donde venga. Estados: `ok`, `sin_cambio`, `pausada`, `no_existe`,
  `tarjeta_defecto`, `link_roto`, `link_otro`, `salto`, `sin_precio`, `error`. Candados:
  **tope de salto** (25%; lo que se pasa va al reporte y no se escribe); **freno de emergencia**
  (si no sale bien casi ninguno no se escribe nada y la corrida falla: si ML cambia esa página
  todo se vería roto a la vez, y un `link_roto` retira enlaces); un `error` de red o un 5xx nunca
  pausa, borra ni retira nada; `link_roto`/`link_otro`/`tarjeta_defecto` se confirman en DOS
  corridas; una pausa puesta a mano no se toca jamás. **Escribe el precio en la base Y en el array de la página**: el
  precio que ve el visitante sale del array, no de la base, y antes eso lo hacía `ml-update.js`.
  Reconoce la **tarjeta por defecto del perfil de afiliado** (varios productos cayendo en el mismo
  catálogo ajeno) y la recuerda entre corridas en `tarjetaDefecto`, porque una corrida de una sola
  categoría no tiene repetición que la delate: nov-2026 los cuatro enlaces muertos del sitio abrían
  el mismo microondas GE, y el cuarto se salvaba por dos puntos de parecido. Esa tarjeta son **las
  búsquedas recientes de la cuenta**, lo que ML devuelve cuando el destino ya no existe, así que
  caer ahí es `tarjeta_defecto` y el producto se **borra** (no se le retira el enlace).
  Reporte: `precios-link-report.json` (acumulativo por categoría, con la cola de gracia).
  Después de `--aplicar`: `sync-pausas.js`.
- `especs-por-id.mjs [--todas|--categoria=a,b] [--aplicar] [--forzar-imagen]`,
  `[--id=MLM…]`, `[--nuevo=categoria:MLM…:enlace]` — características, imagen y nombre desde
  `/products/{id}`. **No pisa nada puesto a mano**: una característica con valor se respeta y la
  diferencia se reporta. Los atributos crudos de ML van a `_mlAtributos`; `especs` solo se siembra
  cuando el producto no tiene ninguna. Por qué: cada categoría tiene su esquema de claves cortas
  (`potencia`, `capacidad`, `panel`) y la API devuelve los nombres que enseña ML (`Potencia`,
  `Capacidad en volumen`), así que volcar unos sobre otros llenaría `especs` de claves paralelas
  que ninguna página pinta. Mapear un atributo a una clave del esquema es decisión de categoría.
  `--id` solo enseña lo que trae un catálogo, sin tocar nada. Reporte: `especs-report.json`.
- **Descubrir productos nuevos (nov-2026).** `descubrir-catalogo.mjs [--categoria=a,b|--todas]
  [--aplicar] [--tope=150] [--paginas=3] [--concurrencia=4] [--terminos=a|b]` busca en
  `/products/search` productos de CATÁLOGO que todavía no tenemos y los deja apagados en
  `scripts/bandeja-nuevos.json`. **No toca la base ni ninguna página.** Qué deja hacer hoy la API,
  medido el 25-nov-2026 con las credenciales del repo: `/products/search` **200** (con atributos),
  `/products/{id}` **200** (imágenes, variantes, descripción), `/sites/MLM/search` **403**
  (publicaciones de vendedores: cerrado, como los precios). Así que se descubre por catálogo o no
  se descubre. **El `offset` máximo es 100** —con 150 responde 400, y `paging.total` dice 10000 y
  miente—, así que la cobertura se gana con MÁS TÉRMINOS, no paginando más hondo. `category_id` y
  `domain_id` se aceptan pero no filtran: el filtro lo hace el script sobre el `domain_id` del
  resultado más el atributo de clase (`dominios` y `clase` del bloque `descubrir` de
  `categorias.js`). ~45% del catálogo viene `inactive` y se descarta. Duplicados: por `mlId`, por
  `GTIN` (63% de cobertura) y, como AVISO y nunca como descarte, por marca+contenido+sabor —un
  sabor o un tamaño distinto es otro producto—. **La API no da precio** (`/products/{id}/items`
  sigue en 403 y `buy_box_winner` viene `null`), así que un producto nuevo entra sin precio y lo
  consigue al publicarse, de la página de su enlace. Tampoco da los datos nutricionales por
  porción como dato estructurado: `NUTRITIONAL_VALUES_PER_SERVING` es texto libre («22 gr de
  proteína», «110 kcal»), así que `proteinaPorPorcion` se escribe a mano y **no se deduce del
  nombre comercial**. Tampoco se puede saber aquí si el producto tiene vendedor hoy (ver la
  sección de la bandeja). Piloto: Proteína (570 productos de la categoría, 569 que no teníamos, en
  29 llamadas). Historial de búsquedas en `scripts/busquedas-catalogo.json`.
- `aplicar-nuevos.mjs <cambios.json> [--aplicar]` — publica lo que Alan aprobó en el Centro. Es el
  ÚNICO camino de la bandeja al sitio. Antes de publicar comprueba, producto por producto: que
  siga en la bandeja, que tenga enlace de ML, que **ese enlace abra de verdad ese ID de catálogo**
  (`resolverAfiliado()`, el mismo de los precios: si abre otra cosa, no publica), que dé precio y
  no esté pausada, que estén las `obligatorias` de la categoría, que un `linkAmz` lleve
  `tag=guiasdecomp01-20` y que el ID no esté ya en la base. Escribe el producto en
  `merged-admin.json` **y** su tarjeta en el array JS de la página con `agregarProductos()` de
  `_html-precios.js`, que copia el esquema de campos del primer producto que ya está en esa página
  y parsea el array antes de escribirlo. Borrar desde la bandeja es lógico (`estado:'eliminado'`):
  no toca la base ni ningún producto publicado. Después: `sync-pausas.js`, `sync-hub-counts.js`,
  `generar-centro.js`, `check-site.js`.
- `sugerir-ids.mjs [--todas|--categoria=a,b]` — candidatos de `mlId` para los productos con
  enlace y sin ID, vía `/products/search` (que sigue respondiendo). Era el `--sugerir` de
  `ml-update.js`; se mudó aquí al retirarlo porque no es una llamada de precios. Perdió el
  desempate por cercanía de precio, que usaba el endpoint cerrado: ahora la nota es solo el
  parecido de nombre. Escribe `ml-sugerencias.json`; los enseña el gestor tras `generar-admin.js`.
- `_html-precios.js` — la regla única para tocar el array JS de una página: `locateArray`,
  `topBlocks`, `patchBlock`, `escribirPrecios()` y `quitarProductos()`. Empareja por `id` y, si no
  coincide, por `linkML` (el id de la página no siempre es el de la base). `quitarProductos`
  **parsea el array antes de escribirlo**: si una coma mal quitada lo dejara roto no escribe nada,
  porque una página con el JS roto no enseña ningún producto, que es mucho peor que una tarjeta de
  más. No cubre las páginas de familias (celulares): ahí el producto es una variante y se reporta
  para quitarla a mano, y el producto se queda en la base oculto en vez de borrarse.
- `categorias.js` — **registro único de categorías**. Una categoría se declara aquí UNA vez (clave de
  `merged-admin.json`, página, nombre del array JS, y opcionalmente `descuentos` y `catalogMini`) y
  entra sola en `precios-por-link.mjs`, `especs-por-id.mjs`, `sync-pausas.js`, `generar-catalog-mini.js`
  y `generar-bajadas.js`. Antes cada script llevaba su propia lista y se desincronizaban: cafeteras,
  smartwatches, refrigeradores, streaming, ollas e iPhone recibían precios pero **no** pausas, así que
  pausar un producto en el gestor no lo quitaba de su página. Al registrar una categoría nueva hay que
  correr `node scripts/sync-pausas.js` una vez para que su página reciba el bloque de pausas;
  `check-site.js` falla si una categoría de la base no está registrada o si a su página le falta ese bloque.
- `revisar-disponibilidad.js [--todas|--categoria=a,b] [--links] [--aplicar] [--umbral=N]` — revisa si
  cada producto publicado SIGUE existiendo en ML y pausa lo caído. Dos capas: la de catálogo
  (`/products/{mlId}` + sus ofertas; **la parte de ofertas ya no responde**, así que este script quedó a mano) y la
  de links (`--links`: abre cada `meli.la` y comprueba que siga llevando a SU producto; ~20 min, corre
  los domingos en `revisar-disponibilidad.yml`). La segunda es la que descubre lo peor: nov-2026 dos
  laptops abrían una barra de sonido Sonos porque el link caído cae en la tarjeta por defecto del perfil
  de afiliado. Estados: `ok`, `sin_ofertas`, `pausado`, `no_existe`, `link_roto`, `link_otro`, `sin_id`,
  `error`. **Un `error` de API nunca pausa nada** y un producto se pausa solo si se ve caído en DOS
  corridas seguidas (`_dispFallos`, `--umbral`), porque pausar de más también quita credibilidad.
  `--aplicar` escribe `pausaML` + `_pausaAuto` + `_motivoPausa` + `_pausaFecha` sin borrar el producto,
  el link ni el precio, reactiva solo lo que él mismo pausó y **nunca toca una pausa puesta a mano**.
  Un link de afiliado caído **no se pausa: se retira** (`_link-muerto.js`), porque no resucita y
  volver a abrirlo cada domingo era tiempo tirado. Antes se pausaba, y hacía falta la regla "un pausado
  por link_roto solo se reactiva con `--links`" para que la corrida diaria no lo devolviera al sitio
  con el link roto; esa excepción ya no existe.
  También anota en cada producto revisado `_dispEstado` y `_dispFecha` (y `_dispFallos` mientras está
  en observación): el gestor los muestra en la columna "Revisado en ML" y en las colas "Pausados por
  la revisión", "En observación" y "Nunca revisados". El reporte **acumula**: revisar una categoría
  suelta no borra lo que se sabe de las demás.
  Escribe `disponibilidad-report.json`, que `generar-admin.js` embebe en el gestor (tarjeta
  "Disponibilidad en Mercado Libre", con botón para pausar). Después de `--aplicar` hay que correr
  `sync-pausas.js` para que las páginas lo reflejen.
- `_link-muerto.js` — la regla única para un link de afiliado que ya no abre su producto: sale de
  `linkML` y queda en `_linkMuerto` + `_linkMuertoFecha` + `_linkMuertoMotivo` + `_necesitaLink`,
  se levanta la pausa automática que lo ocultaba (una pausa puesta a mano nunca se toca) y
  `_dispEstado` pasa a `sin_link`. El producto se queda sin tienda, así que `sync-pausas.js` lo saca
  de la página, y conserva `mlId`, precio, imagen y características: pegar un link nuevo lo devuelve.
  La usan `revisar-disponibilidad.js` (de aquí en adelante) y `limpiar-links-muertos.mjs` (para lo ya
  marcado). Solo retira lo **confirmado** por la revisión: la marca suelta `_linkRevisar:'link_caido'`
  de una auditoría no basta, porque en algún producto la revisión posterior dijo que el link servía.
- `limpiar-links-muertos.mjs [--categoria=a,b] [--aplicar]` — aplica esa regla a lo que ya está
  marcado en la base y escribe `links-muertos-report.json` (incluye los que no tienen `mlId`, que son
  los únicos irrecuperables, y los marcados por la auditoría sin confirmar). Después: `sync-pausas.js`.
- `aplicar-especs.mjs <archivo.json> [--aplicar]` — mete en `merged-admin.json` las características
  corregidas a mano en el Centro de Control (solo el campo `especs`; un valor vacío borra la clave).
  Avisa de las categorías que no pasan por `sync-html.js`, donde hay que editar el array del HTML.
- `aplicar-productos.mjs <archivo.json> [--aplicar] [--forzar]` — lo mismo para los **campos del
  producto** editados en la pestaña «Editar» del Centro: `nombre`, `marca`, `precioML`,
  `precioAmz`, `linkML`, `linkAmz`, `mlId`, `activo`, `pausaML`, `pausaAmz`, `_eliminado`. Viaja
  **solo lo que cambió**, campo por campo, así que no pisa lo que haya escrito una corrida entre
  medias —el defecto de `extraer-artifact.js`, que reescribía la base entera—. Cadena vacía borra
  el dato (precio a `null`, enlace retirado). Candados: **tope de salto del 25%** en los precios
  (lo que se pasa se reporta y no se escribe, salvo `--forzar`), un `linkAmz` sin
  `tag=guiasdecomp01-20` se rechaza, un campo fuera de la lista se rechaza, y `_eliminado` solo
  **marca** (borrar de verdad sigue siendo cosa de `precios-por-link.mjs`, con papelera). Una pausa
  puesta aquí queda como **a mano** (`_pausaAuto:false`), así que ninguna corrida la levanta sola; y
  pegar un `linkML` nuevo limpia `_linkMuerto`/`_necesitaLink`. Escribe la base **y** el precio en
  el array JS de todas las páginas de esa categoría (`_html-precios.js`). Después: `sync-pausas.js`
  y `generar-centro.js`.
- **Histórico de precios.** `scripts/historico-precios.json` es la fuente canónica y guarda
  **400 días** (`DIAS_MAX`), no 30; los 30 son solo lo que publica `generar-historico.js` para
  que lo baje el navegador. Está versionado, así que cada commit es una copia congelada. Formato
  comprimido: tramos de días CON registro (`r`) y solo los PUNTOS DE CAMBIO de precio (`p`); un
  día que no cae en ningún tramo es un hueco real (pausado, sin stock) y **no se interpola**.
  Cada día lleva además en `fuentes` de dónde salió su precio, y esto importa:
  `api` (hasta el 22-nov-2026, la oferta más barata del CATÁLOGO) y `link` (del 25-nov en
  adelante, el precio de la PUBLICACIÓN de nuestro enlace) **no miden lo mismo**, así que una
  diferencia que cruce la costura puede no ser un cambio de precio sino un cambio de regla — de
  ahí los 111 "saltos atípicos" del 25-nov. El 23 y el 24-nov quedan como `sin_observacion`: la
  API ya daba 403 y no se observó nada (el 23 el snapshot repitió los precios del 22, y leerlo
  como un día de precios planos sería falso; el 24 no hubo snapshot).
- `exportar-historico.mjs [--categoria=a,b] [--desde=] [--hasta=] [--solo-cambios] [--salida=]`
  — expande el histórico a un CSV por categoría (más `TODO.csv`), con la fuente en cada fila,
  además de una copia fechada del JSON canónico y un `resumen.json`. Punto y coma y UTF-8 con
  BOM, para que Excel en español lo abra sin pelear. Escribe en `historico-export/<fecha>/`,
  que está en `.gitignore` **a propósito**: el repo es el sitio, así que commitearlo publicaría
  el histórico completo en comparalo.mx. 25-nov-2026: 1,633 series, 56 días, 48,930 filas, 12 MB
  (con `--solo-cambios`, una fila por cambio, es una fracción).
- `generar-centro.js` — resume la base y los reportes en `centro-datos.json`, que lee el **Centro de
  Control** (`scripts/centro-control.html`, publicado como artifact con ese JSON al lado, que ahí se
  llama `datos.json`). El Centro es **el panel** (ver "El panel: Centro de Control" más abajo); de
  este JSON solo lee: calcula si cada producto **se ve o no en la página** y por qué, con el mismo criterio con
  el que `sync-pausas.js` escribe el HTML. Su bloque `preciosLink` lleva al Centro cómo le fue a la
  última corrida de precios por enlace (cuándo, cuántos cambiaron, cuántos enlaces se vieron rotos,
  cuántos quedaron fuera por el tope de salto, si se frenó y si la API volvió); el dashboard avisa en
  rojo si la corrida se frenó o si lleva dos días o más sin pasar, porque un sitio con precios viejos
  no se queja solo.
- `generar-miniaturas.mjs [--categoria=a,b] [--forzar] [--concurrencia=8]` — las miniaturas del
  Centro, en `scripts/centro-imagenes.json` (se publica al lado como `imagenes.json`, ~4 MB).
  Existe porque **el artifact corre con una CSP que bloquea toda imagen externa**: las URLs de
  `http2.mlstatic.com` y `m.media-amazon.com` que guarda la base son correctas —se abren en el
  navegador— pero dentro del Centro no cargan nunca y las tarjetas salían vacías (25-nov-2026). Lo
  único que pasa esa CSP son los bytes que viajan con el artifact, así que baja cada foto en tamaño
  miniatura y la guarda como `data:` URI con la clave `<categoria>:<id>`. No encoge nada: pide el
  tamaño chico al propio servidor (ML cambia la letra final, `…-F.jpg` → `…-I.webp`, 90 px y ~1.3 KB;
  Amazon con `_AC_SX90_`), porque redimensionar aquí pediría `sharp` y el repo no tiene build step.
  Es **incremental**: solo baja lo que no está o cuya URL de origen cambió, y borra la miniatura del
  producto que ya no está en la base. El Centro lo pide con `fetch` solo al abrir el Gestor, no al
  arrancar. Correrlo después de dar de alta productos o de `especs-por-id.mjs`, que es quien trae
  la imagen.
- `merged-admin.json` — **fuente de verdad** de productos (precios, links, `activo`, specs) por categoría.
- `productos.json` — base que `sync-html.js` combina con `merged-admin.json`.
- `sync-html.js` — aplica `activo`, links y `precioML`/`precioAmz` de la BD a los arrays JS de los HTML.
  Un producto con `activo:false` se elimina del HTML. **Solo cubre las 5 categorías de su `CATALOG`**
  (laptops, suplementos, bicis, freidoras, microondas) y además necesita que la categoría exista en
  `productos.json`: las subpáginas de suplementos (creatina, proteína, omega3, magnesio, complejo B,
  vitamina D) nunca se sincronizan y sus links viven solo en el HTML. Por eso la BD y esas páginas
  pueden divergir; no sincronizar la BD hacia ellas sin revisar primero (oct-2026: 85 links de Amazon
  y 65 de ML de la BD están compartidos entre productos distintos de varias categorías, asignados por
  número de id; los de las páginas son los buenos).
- **Precios de las guías — dos capas.** Las 7 guías de celulares ya bajaban `/celulares/catalog-mini.json`
  para refrescar sus tarjetas, pero la tabla, las fichas y las tarjetas "decide" llevaban el precio escrito
  a mano, así que la misma página enseñaba dos cifras distintas del mismo celular. Ahora:
  1. `assets/js/guias-precios.js` expone `cmxPreciosGuia(familias, mapaPorLinkML)` y la guía lo llama
     dentro de ese `fetch`. Pinta cada `[data-cmx-precio="<modeloBase>"]` con el precio vivo; si el
     producto no tiene `linkML` en `catalog-mini.json` **no deja una cifra vieja**, escribe "Consulta el
     precio en la tienda". Se carga **sin `defer` y antes del script en línea**: con `defer` se ejecutaba
     después de que el `fetch` ya había resuelto y la llamada se saltaba en silencio.
  2. `sync-guias-precios.js` mantiene al día el HTML estático (lo que ven los buscadores y quien no
     ejecuta JS). Las dos capas usan la misma anotación `data-cmx-precio`.
  `cmxPreciosGuia(datos, mapa, rango)` acepta las dos formas de datos que hay en las guías:
  `{modeloBase, variantes:[{linkML}]}` (menos-5000, calidad-precio) y `{id, linkML}`
  (`celularesDataGuia` en menos-3000, 5000-10000 y buena-camara). Las 5 guías con precios están anotadas.
  El tercer argumento es el rango que promete el título (`{max:3000}`, `{min:5000,max:10000}`, `{max:7000}`,
  `{max:5000}`; calidad-precio no lleva porque se organiza por tramos). Si el precio de hoy se sale del
  rango, la ficha lo dice sola con un `.cmx-rango` — así una guía nunca anuncia un tope que su propio
  contenido incumple. No se pone en la tabla, la barra lateral ni la tarjeta del comparador: no cabe.
- `sync-guias-precios.js [--aplicar]` — las guías llevan el precio escrito a mano en la tabla, en las
  fichas y en su array `familias*`, y la corrida de precios no las toca, así que se desfasan solas. Este script
  lleva el `precioML` de la BD a esos tres lugares **sin adivinar nada**: cada familia declara
  `dbId: '<id de merged-admin.json>'` y cada precio del HTML lleva `data-cmx-precio="<modeloBase>"`.
  Nunca empareja por nombre ni por número de id. **Tope de seguridad `MAX_SALTO` (25%)**: si la BD se
  aleja más de eso del precio de la guía no lo escribe y lo manda a `guias-precios-report.json` para
  revisarlo a mano (oct-2026 la BD tiene un Pixel 9a a $20,794 por un `mlId` mal asignado; el tope
  existe para que un dato así no acabe en una guía). Corre en `precios-por-link.yml`.
  Guías ya anotadas: `mejores-celulares-menos-5000`. Para sumar otra hay que anotarla primero.
- Los links `meli.la` no contienen el producto: abren el perfil de afiliado. Lo que sí trae esa
  página es la tarjeta destacada con el producto y su precio, y de ahí lo saca `resolverAfiliado()`.
  El `mlId` se pega a mano en el gestor (botón 🔗) o sale del propio enlace.
- `generar-admin.js` — completa `mlId` desde links `/p/MLM…`, agrega candidatos de
  `ml-sugerencias.json` y genera `admin-artifact.html` desde `admin-template.html` (el CSS/JS del
  artifact se edita ahí, como HTML normal). **Ya no aplica precios**: los escribe
  `precios-por-link.mjs` directo en la base, y aquí solo se lee `precios-link-report.json` para
  enseñarlo en el gestor. Que dos scripts escribieran el mismo campo era además la receta para
  pisarse: este paso deshacía en la misma corrida lo que acababa de escribir el otro.
- `ml-bicis.js especs|nuevas [--aplicar]` — bicis: llena características vacías desde la ficha ML (nunca
  sobrescribe) y agrega bicis más vendidas con stock como `estadoML:"nuevo"`, `activo:false`. En el artifact se
  publican (requiere link de afiliado) y `sync-html.js` agrega las marcadas `_publicar` a `ELECTRICAS`.
- `sync-pausas.js` — lleva a TODAS las páginas del registro lo que no debe verse, sin tocar los links:
  las pausas por plataforma (`pausaML`/`pausaAmz`) y, desde nov-2026, lo **retirado** de la base
  (`_eliminado`, `activo:false`, `_publicar:false`), que se oculta entero. Lo segundo lo hacía solo
  `sync-html.js`, que cubre 5 categorías: Android, iPhone, Consolas y Juegos no los limpiaba nadie y
  las páginas anunciaban 12 productos que la base daba por muertos (un Galaxy S26 a $20,999, una Xbox
  Series X sin link de compra). **Empareja leyendo el
  array del HTML**: por id y, si no coincide, por `linkML`/`linkAmz`, porque el id de la página no
  siempre es el de la base (en streaming la base usa `streaming-2` y la página `2`, así que sus 17
  pausas no ocultaban nada). Quita el producto de la lista cuando se queda **sin ninguna tienda**
  —no solo cuando están pausadas las dos—, porque desde la baja de Amazon casi nada tiene `linkAmz`
  y la tarjeta se quedaba sin precio ni botón. Además reescribe el contador del hero
  ("N modelos para comparar") con lo que de verdad se ve. Avisa si un producto pausado no aparece
  en su página en vez de fallar en silencio. Lo que inyecta: inyecta un `<script id="pausas">` y un bucle que, antes de
  render, oculta la plataforma pausada (pone su link y precio en null) y quita el producto si están pausadas
  ambas. El link no se borra, se reactiva poniendo la pausa en "Se muestra" en el artifact.
- `extraer-artifact.js <archivo.html>` — pasa los datos de un artifact guardado a `merged-admin.json`. Además detecta
  bajadas de precio de Amazon capturadas con una versión del artifact que no las registraba (compara contra la base
  actual y escribe `_precioAmzAntes`/`_precioAmzFecha`). La base de comparación es `merged-admin.json` tal como está:
  no la confirmes (commit) hasta que el usuario termine de capturar precios, o se pierde la referencia.
- **Ofertas (`descuentos.json`)** — `_ofertas.js` es la lógica compartida de `generar-descuentos.js` (celulares),
  `generar-laptops-descuentos.js`, `generar-proteina-descuentos.js` y `generar-cafeteras-descuentos.js`. Hay oferta si
  `_precioMLAntes > precioML` (lo escribe `generar-admin.js` con cada reporte de ML) o si el precio de Amazon bajó:
  el artifact guarda `_precioAmzAntes` + `_precioAmzFecha` al capturar un `precioAmz` menor (anclado al precio más alto
  de la racha; si sube hasta el precio anterior se quita) y la oferta de Amazon vale 7 días (`DIAS_OFERTA_AMZ`, en
  `_ofertas.js` y en `admin-template.html`; cambiar en ambos). Requiere link con el tag y `pausaAmz` apagado. Gana la
  tienda con mayor %; cada oferta trae `plataforma` (`ml`|`amazon`), `precioOferta` y `link`.
  Todos los generadores filtran con `vendible()` de `_ofertas.js` (activo, no eliminado, sin `pausaML`,
  `estadoML` distinto de `no_encontrado`/`pausado`). Hasta nov-2026 la función existía pero no la
  llamaba ninguno —filtraban solo por `activo`—, así que un producto pausado en ML podía seguir
  anunciándose como oferta en el inicio. Al agregar un generador nuevo, usar `vendible(p)`, no `p.activo`. Los consumen la sección
  de ofertas del inicio, `/celulares/`, `/celulares/android/` y las 3 guías de celulares con `descuentos.json`.
- `generar-bajadas.js` — escribe `assets/data/bajadas.json` con TODOS los productos que bajaron de precio por
  categoría (bajada oficial de `_ofertas.js` + lo que ya anuncia cada `descuentos.json`, que tiene tope de 5–8).
  Corre en `precios-por-link.yml` tras las ofertas. `assets/js/price-drops.js` lo lee: pinta "↓ % · Bajó $ · Antes $"
  en la tarjeta y da el filtro "Bajó de precio" (chip sobre el listado, sección "Ofertas" en el panel, y en
  proteína/creatina su filtro propio). Solo muestra una bajada si id, nombre y precio actual coinciden con la página.
- `generar-ofertas.js [--dry-run]` — arma **`/ofertas/`**, la página que junta en una fila por
  categoría todo lo que bajó de precio en los últimos 30 días. Un producto entra si tiene bajada
  vigente en la base (`mejorBajada`, la misma que ya anuncia su categoría) o si el histórico de 30
  días lo pone al menos 3 % debajo del máximo del periodo; siempre con `vendible` + `publicado`,
  link de ML y precio, así que lo pausado o caído no aparece. Escribe el HTML **estático** de las
  tarjetas entre los marcadores `<!-- ofertas:resumen|indice|secciones|datos -->` (para buscadores)
  más un `<script type="application/json" id="of-data">` que lee `assets/js/cmx-ofertas.js`
  (selección de 2 a 3 productos *de la misma categoría*, comparativa, favoritos, índice lateral).
  También escribe `assets/data/historico/ofertas.json`: el histórico recortado a los productos de
  la página, con claves `"<categoria>:<id>"` porque los ids se repiten entre categorías; así la
  página baja un archivo y no los 24. Los productos con salto atípico en la serie se publican pero
  van al final de su fila: ese salto casi siempre es un cambio de la oferta de referencia del
  catálogo, no una rebaja. Tope de 8 tarjetas por categoría (`TOPE`); el resto se ve en la categoría.
  Corre en `precios-por-link.yml`. Los grupos del índice viven en el
  propio script: una categoría nueva de `categorias.js` entra sola en "Más categorías".
- `sync-ofertas-cta.js [--check] [--dry-run]` — pone el acceso a `/ofertas/` en las 26 páginas del
  registro: el chip junto al contador (`cl-oflink`, primera pantalla, solo donde existe
  `<p class="cl-count" id="cl-count">`) y la banda verde al terminar el listado (`cl-ofcta`, dentro
  de `cl-below-main`; en las páginas que todavía no usan cmx-list va suelta antes de "Sigue
  explorando" con la clase `cl-ofcta--solo`). Donde está la plantilla, la banda trae además un botón
  que enciende el filtro "Bajó de precio" de esa misma página. Los textos salen de
  `scripts/_nombres.js` (singular/plural de cada categoría, compartido con `generar-ofertas.js`) y
  los estilos de `assets/css/cmx-site.css`, que cargan todas las páginas. Es idempotente y **no se
  edita a mano**: para cambiar el texto se cambia el script y se vuelve a correr. Los dos accesos
  mandan el evento GA4 `click_ofertas_cta` con `page_section` y `origen`
  (`listado_top` | `listado_banda`). Una categoría nueva entra sola: se registra en `categorias.js`
  y se corre esto una vez.
- `sync-site.js [--only=header,footer,related,head] [--check]` — escribe entre marcadores el encabezado
  (`cmx-header`, con el botón de favoritos si la página lo tiene), el breadcrumb (`cmx-bc`, solo en páginas que ya
  lo tenían en el menú; sale del JSON-LD), "Sigue explorando" (`cmx-related`) y el pie con aviso de afiliados
  (`cmx-footer`). **No editar esos bloques a mano**: se cambian en el script o en `assets/css/cmx-site.css`
  y se vuelve a correr. Una página nueva debe correrlo (y estar en `sitemap.xml`) o `check-site.js` falla.
  Las categorías del buscador (escritorio y panel móvil) viven en `js/categorias.js`.
  "Sigue explorando" cierra siempre con la tarjeta de **Ofertas** (`/ofertas/`), y el botón
  "Ofertas" del encabezado lleva a esa página (antes abría `/#ofertas`). En el inicio, el botón
  "Ver todas las ofertas" de la sección de bajadas también enlaza a `/ofertas/`.
- `sync-hub-counts.js [--check]` — números de producto en los hubs. Cuenta con el mismo criterio
  que las páginas (lo que conserva alguna tienda tras las pausas) y, en celulares, cuenta variantes,
  no familias. Corre después de `sync-pausas.js` en los dos workflows de datos.
- **Analítica (GA4 + Search Console, nov-2026).** `analitica.mjs [--dry-run] [--solo=ga4|gsc]` pregunta
  a la **GA4 Data API** y a la de **Search Console** y escribe `scripts/analitica.json`, que es lo que lee
  la sección Analítica del Centro. Corre en `analitica.yml` (diario 7:30 CDMX, media hora después de los
  precios) y **no en el navegador**: las dos APIs piden credencial de servidor y una página del artifact
  no puede guardarla sin exponerla. La credencial es una **cuenta de servicio de Google** en el secret
  `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON tal cual o en base64; en la máquina, `scripts/.google-sa.json`,
  que está en `.gitignore`), con lectura en la propiedad de GA4 y en la de Search Console. **Sin
  dependencias a propósito**: el repo no tiene build step, así que el JWT se firma con `node:crypto`.
  La propiedad de GA4 se busca sola por el measurement id `G-9TKZ4ER13X` y el sitio de GSC por el
  dominio; `GA4_PROPERTY_ID` y `GSC_SITE` solo hacen falta si eso no acierta. Escribe dos periodos
  comparados contra el anterior (7 contra 7 y 28 contra 28), serie diaria de 56 días, páginas, fuentes,
  eventos, consultas, y un bloque `semana` ya resumido que es el que usará el Planificador como KPI.
  **Search Console cierra con ~3 días de retraso**, así que sus periodos terminan en hoy-3: si no, el
  último tramo siempre se vería cayendo. Clics a tienda = `affiliate_click_ml` + `click_ml` +
  `affiliate_click_amazon` + `affiliate_click_amz`; es lo más cerca de una venta que vemos, porque la
  conversión ocurre ya dentro de ML o de Amazon. `analitica-resumen.js` imprime en Markdown cómo le fue
  a la última corrida (lo usa el resumen del workflow). Si falta la credencial no se inventa ni un
  número: el Centro enseña los pasos exactos para conectarla.
- `check-site.js` — validaciones del sitio (ver abajo).

## La bandeja de productos nuevos (el alta por API, nov-2026)

El flujo completo, de la API al sitio:

1. **Buscar.** En el Gestor del Centro, el botón «🔎 Buscar catálogo en API de Mercado Libre» abre
   el workflow `descubrir-catalogo.yml` (manual, con selector de categoría y tope). El Centro es un
   artifact: no puede guardar credenciales ni llamar a ML desde el navegador, por eso la búsqueda
   corre en Actions o en la máquina (`node scripts/descubrir-catalogo.mjs --categoria=proteina --aplicar`).
2. **Revisar.** En el Gestor, estado **«Nuevos sin publicar (bandeja)»** (más «pendientes de
   enlace» y «pendientes de validación»): otra tabla, con imagen, marca, características, ID de
   catálogo, estado y enlace. Los datos salen de `scripts/centro-bandeja.json`, que publica
   `generar-centro.js` al lado del Centro **como `bandeja.json`** y se pide con `fetch` solo al
   entrar al filtro. Las miniaturas son las de siempre (`generar-miniaturas.mjs`, clave
   `bandeja:<MLM…>`), porque la CSP del artifact bloquea toda imagen externa.
3. **Completar.** El enlace de afiliado se pega en la pestaña **Identificación** (es lo primero
   que uno quiere hacer al abrir la ficha) o en **Enlace y publicación**, que además trae el de
   Amazon, la corrección de características y la lista de validaciones. «Publicar producto» está
   **deshabilitado** hasta que pasen todas. Lo capturado vive en la colección `bandeja` del
   almacenamiento del Centro, nunca en el repo.
4. **Dar de alta, varios de una vez.** Cada fila tiene casilla y la cabecera marca todo lo que se
   ve. Con algo marcado aparecen **Dar de alta** y **Eliminar**: el alta mete en la cola de
   publicación solo lo que pasa las validaciones y dice en un aviso cuántos quedaron fuera y por
   qué («3 dados de alta · 2 sin enlace»).
5. **Publicar.** «Copiar para publicar» copia el JSON; se pega en el workflow
   **`publicar-nuevos.yml`** y ahí corre todo: abre cada enlace, saca el precio, escribe el
   producto en la base y su tarjeta en la página, y hace commit. En la máquina es lo mismo con
   `node scripts/aplicar-nuevos.mjs cambios.json --aplicar`. Nada se publica solo al pegar el enlace.

**Eliminar es en dos pasos, sin `confirm()`**: el artifact corre en un iframe de caja de arena,
donde `confirm()` no abre nada y devuelve `false` — por eso el botón Eliminar no hacía nada
(26-nov-2026). Ahora el primer clic lo pone en «¿Seguro?» y el segundo lo quita de la bandeja.
Quitar de la bandeja no toca la base ni ningún producto publicado.

**Obligatorias contra recomendadas.** `obligatorias` bloquea la publicación; `recomendadas` solo
avisa. Solo se ponen como obligatorias las que la API suele dar: `proteinaPorPorcion` pasó a
recomendada porque la API no la da en NINGÚN producto, así que exigirla convertía dar de alta 150
fichas en 150 capturas a mano. Si se publica sin ella entra como `null` —lo que esa página ya hace
con las fichas incompletas—, nunca deducida del nombre comercial.

**Las dos fuentes de candidatos, y por qué importa la diferencia (26-nov-2026).** Alan abrió 10
fichas de la bandeja y 8 decían «no está disponible por el momento». La causa: `status:"active"`
del catálogo dice que la FICHA existe, no que alguien lo venda.

Se buscó un dato que lo delatara y **no existe con nuestro acceso**, probado por cuatro caminos:
`/products/{id}/items` responde 403; `buy_box_winner` viene `null` **hasta para el nº1 en ventas**,
con token de usuario y de aplicación; ningún campo de `/products/{id}` separa 21 catálogos
pausados de 199 vivos (status, tags, quality_type, ttr, last_updated y date_created se solapan —
«ficha movida hace menos de 30 días» acierta el 95% cuando la tasa base ya era del 90%, o sea
nada); y la ficha pública `/p/MLM…` contesta con el muro antibots de ML, también desde un
navegador de verdad (captcha). Así que **no se puede filtrar al buscar ni revisar después**: las
dos ideas necesitan el mismo dato que no tenemos.

Lo que sí hay es **el ranking de más vendidos**, `/highlights/MLM/category/{id}` (200): un
producto que está ahí se está vendiendo. De los 21 pausados conocidos, **0** aparecen en él. Por
eso `descubrir-catalogo.mjs` tiene `--fuente`:
· `ranking` — solo los más vendidos de las `categoriasML` de la categoría. Seguros, pero **~20
por categoría de ML** (en proteína dieron 3 que no teníamos). Se guardan con `seVende:true` y el
Centro los marca **«↑ se vende hoy»**, con su propio filtro «Nuevos · se venden hoy».
· `busqueda` — `/products/search`, cientos de candidatos sin saber si se venden.
· `ambas` (por defecto) — las dos, con el ranking **primero** en la bandeja.
El orden de los de búsqueda es ahora su posición en los resultados, no cuántos atributos traen:
ordenar por atributos no tenía nada que ver con venderse, y por eso los primeros de la bandeja
salían muertos.

**El paso «comprobar» es manual, y no hay manera de que no lo sea** (26-nov-2026, decisión de
Alan tras encontrar 8 pausados de cada 10). Lo que se hizo es que cueste un clic: cada fila de la
bandeja lleva **Abrir ↗** (la ficha en ML), **✓ Sí** y **✗ No**. El ✗ saca el producto de la
bandeja para siempre —una búsqueda futura no lo vuelve a traer, porque `fundir()` respeta el
estado `eliminado`— y el ✓ lo deja marcado como comprobado (`revisado:'ok'` en el almacenamiento
del Centro). Los del ranking cuentan como comprobados de entrada. Filtros: **«Por comprobar en
ML»** y **«✓ Comprobados»**. Así el orden de trabajo es: comprobar en bloque primero (barato,
un vistazo por ficha) y pegar enlaces solo en los que sobreviven, en vez de ir alternando las dos
cosas producto por producto.

**El camino sin revisar a mano (26-nov-2026).** Comprobar abriendo fichas una por una sigue
disponible, pero no hace falta: el enlace de afiliado SÍ se puede abrir por programa —es lo que
hace la corrida de precios a diario— así que la publicación hace de comprobación. En el Centro,
**«Pegar enlaces en bloque»** acepta una línea por producto (ID y enlace en cualquier orden,
pegado de Excel tal cual) y los reparte por la bandeja. Después, al publicar,
`aplicar-nuevos.mjs` abre cada enlace y:
· da precio → publica el producto;
· está **pausada** o **no da precio** → el producto **sale solo de la bandeja**
(`estado:'eliminado'` + `_motivoBaja`), que es la comprobación hecha sin un clic de más;
· el enlace abre **otro** producto, o falla la red → NO da de baja nada: eso es un problema del
enlace, no del producto, y se reporta para revisarlo.
Las bajas se escriben aunque no se publique ni un producto, para no tener que volver a abrir los
mismos enlaces muertos.

Una categoría entra al descubrimiento agregándole un bloque `descubrir` en `categorias.js`
(términos, `categoriasML` para el ranking, dominios, clase, mapa de atributos → `especs`,
obligatorias, recomendadas) y sumándola a las opciones de los dos workflows. Hoy solo está Proteína, el piloto.

## El panel: Centro de Control (decisión del 25-nov-2026)

**Toda la gestión de productos vive en el Centro de Control. El gestor queda fuera.** Lo decidió
Alan: un solo panel que controla todo, no dos que se pisan. Así que **nunca lo mandes al gestor**
—ni a abrirlo, ni a capturar ahí, ni a guardar y extraer— y cuando algo tenga que verse o tocarse
en un panel, el panel es el Centro.

| | Artifact | Se publica desde | Qué es hoy |
|---|---|---|---|
| **Centro de Control** | https://claude.ai/artifact/ECZ49Kif8wHJMpZa878g41 | `scripts/centro-control.html` + `scripts/centro-datos.json` publicado al lado **como `datos.json`** | **el panel**. Lee `datos.json` y escribe en su propia base de artifact (capacidades `db` y `user`): correcciones de `especs`, tareas y objetivos |
| Gestión Productos (gestor) | https://claude.ai/artifact/BTt8aRBCUZQNWvGAS81rTt | `scripts/admin-artifact.html` (desde `admin-template.html` con `generar-admin.js`) | **retirado como panel.** Se sigue generando y no se ha borrado, pero no se le manda a Alan |

Republicar el Centro: `node scripts/generar-centro.js` y publicar `scripts/centro-control.html`
con `files: {"datos.json": "scripts/centro-datos.json", "imagenes.json": "scripts/centro-imagenes.json",
"bandeja.json": "scripts/centro-bandeja.json"}` sobre esa URL. **Las tres van siempre**: un publish que solo mande `datos.json` conserva el
`imagenes.json` anterior (lo que no se nombra no se toca), así que las altas recientes saldrían sin
foto hasta la siguiente corrida de `generar-miniaturas.mjs`. **Leer el artifact antes de
republicar** (lo exige la herramienta y evita pisar lo que Alan haya guardado dentro de la página).
Son dos artifacts distintos: republicar el gestor no cambia nada en el Centro, que fue justo la
confusión del 25-nov-2026.

**Editar un producto desde el Centro** (pestaña «Editar» del detalle, 25-nov-2026): nombre, marca,
`precioML`, `precioAmz`, `linkML`, `linkAmz`, `mlId`, `activo`, `pausaML`, `pausaAmz` y
`_eliminado`. Se guarda en la colección `productos` de su `db` —**solo los campos que cambiaron**,
no la base entera, que es la diferencia con el gestor: una corrida de precios que ocurra mientras
el Centro está abierto ya no se pisa—. El botón «Copiar cambios» da el JSON y
`aplicar-productos.mjs` lo mete a la base y a la página. Alta y baja de productos siguen fuera del
Centro: el alta es `especs-por-id.mjs --nuevo=…` y la baja la decide `precios-por-link.mjs`.

Camino viejo del gestor, por si hace falta tocarlo: leer el artifact con la herramienta Artifact,
`node scripts/extraer-artifact.js <html guardado>` y luego `node scripts/generar-admin.js`. El
artifact se reconstruye a sí mismo al guardar; si se edita `admin-template.html`, regenerar y
republicar.

## GitHub Actions

- `precios-por-link.yml` ("Precios por enlace de afiliado") — **el workflow de precios mientras
  la API esté cerrada**: diario 6:00 CDMX y manual con selector de categoría, de aplicar y de
  tope de salto. Corre `precios-por-link.mjs --aplicar` y después el pipeline de siempre
  (`generar-admin.js`, histórico, `generar-catalog-mini.js`, descuentos, `generar-bajadas.js`,
  `sync-pausas.js`, `sync-hub-counts.js`, `sync-guias-precios.js`, `generar-ofertas.js`,
  `generar-centro.js`, `check-site.js`, `validar-datos.js`) y hace commit. Como abre cada enlace,
  cubre también la capa de links que hacía `revisar-disponibilidad.yml` los domingos. Su resumen
  avisa si el freno paró la corrida y si la API volvió.
- `update-prices.yml` y los cinco `update-prices-<categoria>.yml` **se borraron** el
  25-nov-2026: su paso de precios llamaba a la API cerrada y el de disponibilidad fallaba a
  propósito, tumbando la corrida entera a mitad del pipeline.
- `descubrir-catalogo.yml` ("Buscar catálogo en API de Mercado Libre") — **manual a propósito**
  (descubrir productos es una decisión, no una rutina): selector de categoría, **fuente**
  (`ranking` | `ambas` | `busqueda`), tope y aplicar.
  Corre `descubrir-catalogo.mjs`, regenera el Centro, valida y commitea solo la bandeja, el
  historial y los JSON del Centro. No escribe `merged-admin.json` ni ninguna página; comparte el
  `concurrency: datos-comparalo` porque también commitea en main.
- `publicar-nuevos.yml` ("Publicar productos nuevos") — **manual**: recibe en `cambios` el JSON
  del botón «Copiar para publicar» del Centro y corre `aplicar-nuevos.mjs --aplicar` (un archivo
  por categoría), `sync-pausas.js`, `sync-hub-counts.js`, `marcar-publicados.js`,
  `generar-centro.js`, `check-site.js` y `validar-datos.js`, y hace commit. Es el camino por el
  que un producto de la bandeja llega al sitio sin tocar la máquina. Lo pegado viaja por variable
  de entorno, no interpolado en el shell.
- `revisar-disponibilidad.yml` ("Revisar disponibilidad en Mercado Libre") — **dormido**: su
  capa 1 es la API de precios. Lo que hacía su capa de links lo hace ahora a diario
  `precios-por-link.yml`, que abre cada enlace de todos modos. Era: domingos 5:00 CDMX y
  manual (con opciones de aplicar/links/umbral). Corre la revisión completa **con la capa de links**,
  pausa lo caído, aplica pausas a las páginas, regenera el gestor y valida. La capa rápida ya corre
  a diario dentro de `precios-por-link.yml`.
- `update-prices-<categoria>.yml` — manual por categoría (mismo pipeline, sin `check-site.js`).
- `sync-productos.yml` — al cambiar `productos.json` o `merged-admin.json`, corre `sync-html.js`.
- `check-site.yml` — corre `check-site.js` y `validar-datos.js` en cada push y PR.
- Secrets: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN`.
- **Ningún workflow usa `git stash`.** Confirman primero y después hacen `git fetch` + `git rebase`;
  si el rebase choca, abortan y fallan. Todos comparten `concurrency: datos-comparalo`, porque todos
  escriben `merged-admin.json`. El 16-nov-2026 un `git pull --rebase --autostash` de dos corridas
  traslapadas publicó la base con 1,065 bloques de conflicto; no volver a meter stash aquí.

## Validación

`node scripts/check-site.js` revisa en todas las páginas: GA4 presente, onboarding presente, tag de
afiliado correcto, sin links a `.html` de categorías, sin URLs sin barra tipo `/celularesalta-gama`,
y que los scripts inline y el JSON-LD no tengan errores de sintaxis. Además revisa el registro de
categorías: que toda categoría de `merged-admin.json` esté en `scripts/categorias.js`, que su página
exista con el array declarado y que tenga el bloque `/*PAUSAS*/` (si no, pausar un producto en el
gestor no lo quitaría del sitio). Si falla, no hacer push.

`node scripts/validar-datos.js` revisa los JSON de datos (la base, los reportes, el histórico,
`descuentos.json`, `catalog-mini.json`, la papelera): que no tengan marcas de conflicto de git, que se puedan
leer y que `merged-admin.json` no se haya quedado vacío. Corre en cada push y antes de cada commit
de los workflows. Es la red que faltaba el 16-nov-2026, cuando `git add` + `git commit` publicaron
la base con marcas de conflicto sin que nada fallara.

## Diseño

Plantilla de referencia: `/electrodomesticos/freidoras/`. Colores `--ac:#006847`, `--ml:#f0c000`,
`--amz:#f90`. Fuente Satoshi (fontshare). Antes de dar por terminado un cambio visual, probarlo en el
navegador (`.claude/launch.json` levanta el sitio en http://localhost:8765).
