#!/usr/bin/env node
/**
 * revisar-disponibilidad.js — Revisa en Mercado Libre si cada producto publicado SIGUE EXISTIENDO
 * y, cuando no, lo pausa en la base para que desaparezca del sitio.
 *
 * El problema que resuelve: ml-update.js ya detectaba los catálogos caídos (estado
 * "no_encontrado" en ml-report.json), pero nadie actuaba sobre ese dato. El producto se quedaba
 * en la página con su precio viejo escrito a mano. Nov-2026, laptops: más de la mitad de lo
 * anunciado ya no existía en ML.
 *
 * Uso:
 *   node scripts/revisar-disponibilidad.js --todas                 (solo revisa y reporta)
 *   node scripts/revisar-disponibilidad.js --todas --aplicar       (además pausa lo caído)
 *   node scripts/revisar-disponibilidad.js --categoria=laptops,cafeteras [--aplicar]
 *   node scripts/revisar-disponibilidad.js --todas --aplicar --umbral=1   (pausa a la primera)
 *   node scripts/revisar-disponibilidad.js --todas --links [--aplicar]    (+ revisa los links)
 *   node scripts/revisar-disponibilidad.js --todas --aplicar --forzar     (salta el freno)
 *
 * DOS CAPAS de revisión:
 *
 *   1. Catálogo (siempre, rápida — ~2 min para todo el sitio, va en el workflow diario):
 *      GET /products/{mlId}        → 404 = ya no existe · status != active = pausado en ML
 *      GET /products/{mlId}/items  → sin ofertas con precio = nadie lo vende hoy
 *
 *   2. Link de afiliado (opcional, con --links; lenta, ~20 min: abre cada meli.la):
 *      El catálogo puede estar vivo y aun así el link de la tarjeta ya no abrir ese
 *      producto — cae en la tarjeta por defecto del perfil de afiliado. Para el visitante
 *      eso es exactamente igual de malo que un producto inexistente, y es lo que pasaba
 *      en laptops. Úsala semanalmente o antes de una revisión a fondo.
 *
 * Estados: ok · sin_ofertas · pausado · no_existe · link_roto · link_otro · sin_id · error
 *
 * Dos reglas para no pausar de más (pausar de más también quita credibilidad):
 *   1. `error` (timeout, 429, 5xx, red) NUNCA cambia nada. Un fallo de la API no es un
 *      producto caído.
 *   2. UMBRAL de corridas: la primera vez que un producto se ve caído se le anota la racha
 *      (_dispFallos). Se pausa cuando la racha llega al umbral (2 por defecto, o sea dos
 *      días seguidos). Si vuelve a aparecer, la racha se borra sola.
 *
 * Un link de afiliado CAÍDO no se pausa: se RETIRA (ver scripts/_link-muerto.js). Pasa a
 * _linkMuerto, el producto se queda sin linkML —y por tanto fuera de la página— y entra en la
 * cola "necesita link nuevo" conservando su mlId, su precio y sus características. Antes se
 * pausaba, y entonces había que volver a abrir cada domingo un link que nunca iba a revivir.
 *
 * Qué escribe en merged-admin.json con --aplicar (todo reversible, nada se borra):
 *   pausaML: true · _pausaAuto: true · _motivoPausa · _pausaFecha
 *   y al reaparecer, si la pausa era automática, la quita sola.
 *   Una pausa puesta a mano en el gestor (pausaML sin _pausaAuto) NUNCA se toca.
 *   El linkML y el precio se conservan: reactivar es poner "Se muestra" en el gestor.
 *
 * Después de --aplicar hay que correr `node scripts/sync-pausas.js` para que las páginas
 * dejen de mostrar lo pausado (el workflow lo hace solo).
 *
 * Reporte: scripts/disponibilidad-report.json (lo lee el gestor de productos).
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { clavesDeDatos, tituloDe } from './categorias.js';
import { resolverAfiliado } from './resolver-afiliado.js';
import { LINK_MUERTO, retirarLink } from './_link-muerto.js';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://api.mercadolibre.com';
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH = resolve(ROOT, 'scripts/disponibilidad-report.json');

const APLICAR = process.argv.includes('--aplicar');
// Salta el freno de emergencia de abajo. Solo para cuando de verdad se cayó medio catálogo.
const FORZAR = process.argv.includes('--forzar');
const TODAS = process.argv.includes('--todas');
const LINKS = process.argv.includes('--links');
const CATS_ARG = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1]?.split(',').filter(Boolean) ?? [];
const UMBRAL = Number(process.argv.find(a => a.startsWith('--umbral='))?.split('=')[1] ?? 2);
const CONCURRENCIA = 4;
// A partir de cuánto más cara que lo publicado consideramos que la ficha desmiente al sitio.
const UMBRAL_PRECIO = 0.05;
/**
 * Cuántos días vale el precio leído de la ficha. La revisión con --links corre cada domingo, así
 * que 8 días cubren hasta la siguiente. Mientras esté vigente, ml-update.js no publica un precio
 * MENOR que el de la ficha: el sitio nunca promete menos de lo que el visitante va a ver.
 * Si la API sube por encima de la ficha, gana la API, que es el dato más fresco.
 */
export const DIAS_PRECIO_FICHA = 8;
export const fichaVigente = (p, ahora = Date.now()) => {
  const t = Date.parse(p?._precioFichaFecha);
  return p?._precioFicha > 0 && isFinite(t) && ahora - t <= DIAS_PRECIO_FICHA * 864e5;
};
const MLID_RX = /^MLM\d{6,12}$/;
const HOY = new Date().toISOString().slice(0, 10);

const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

// ── Utilidades ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function getToken() {
  const refreshToken = process.env.ML_REFRESH_TOKEN;
  if (refreshToken) {
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken }),
    });
    if (res.ok) { console.log('🔑 Token OAuth de usuario OK'); return (await res.json()).access_token; }
    console.warn(`⚠ refresh_token falló (${res.status}) — usando client_credentials`);
  }
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

let TOKEN = null;
let LLAMADAS = 0;

/** Devuelve { ok:true, data } | { ok:false, status } | { ok:false, red:true } */
async function api(path, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    LLAMADAS++;
    let res;
    try {
      res = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
    } catch {
      await sleep(800 * (i + 1));
      continue;
    }
    if (res.ok) return { ok: true, data: await res.json() };
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** i); continue; }
    return { ok: false, status: res.status };
  }
  return { ok: false, red: true };
}

/** ID de catálogo a partir de lo guardado (mlId o link /p/MLM…). */
function catalogId(p) {
  if (p.mlId && MLID_RX.test(p.mlId)) return p.mlId;
  const m = String(p.linkML || p._mlCatalogo || '').match(/\/p\/(MLM\d{6,12})/i);
  return m ? m[1].toUpperCase() : null;
}

// ── Revisión de un producto ──────────────────────────────────────────────────
// Estados: 'ok' | 'sin_ofertas' | 'pausado' | 'no_existe' | 'error'
async function revisar(mlId) {
  const prod = await api(`/products/${mlId}`);
  if (!prod.ok) {
    if (prod.status === 404) return { estado: 'no_existe' };
    return { estado: 'error', detalle: prod.red ? 'red' : `http_${prod.status}` };
  }
  if (prod.data?.status && prod.data.status !== 'active') {
    return { estado: 'pausado', detalle: `catálogo ${prod.data.status}` };
  }

  const items = await api(`/products/${mlId}/items?limit=20`);
  if (!items.ok) {
    // El catálogo existe y está activo: si la lista de ofertas no se puede leer, el problema es
    // nuestro, no del producto. SOLO un 404 limpio significa "esta ficha no tiene ofertas".
    // El 24-nov-2026 el token devolvió 403 en todas las llamadas y, como el 403 caía en la rama
    // de "sin ofertas", la corrida pausó 1,137 productos que estaban perfectamente a la venta.
    if (items.status === 404) return { estado: 'sin_ofertas', detalle: 'items http_404' };
    return { estado: 'error', detalle: items.red ? 'items red' : `items http_${items.status}` };
  }
  const ofertas = (items.data?.results ?? []).filter(i => i.price > 0);
  if (!ofertas.length) {
    // Antes de declararlo sin ofertas, probamos el buy box y las variantes hijas:
    // hay catálogos cuyo /items viene vacío pero que sí se venden.
    if (prod.data?.buy_box_winner?.price > 0) return { estado: 'ok', precio: Math.round(prod.data.buy_box_winner.price) };
    for (const hijo of (prod.data?.children_ids ?? []).slice(0, 3)) {
      const h = await api(`/products/${hijo}/items?limit=20`);
      const p = (h.data?.results ?? []).filter(i => i.price > 0);
      if (p.length) return { estado: 'ok', precio: Math.round(Math.min(...p.map(i => i.price))) };
    }
    return { estado: 'sin_ofertas' };
  }
  const nuevos = ofertas.filter(i => i.condition === 'new');
  const elegidos = nuevos.length ? nuevos : ofertas;
  return { estado: 'ok', precio: Math.round(Math.min(...elegidos.map(i => i.price))) };
}

const CAIDO = new Set(['no_existe', 'pausado', 'sin_ofertas', 'link_roto', 'link_otro']);
// Cuando las dos capas opinan, nos quedamos con el diagnóstico más grave.
const GRAVEDAD = { ok: 0, error: 0, sin_ofertas: 1, link_otro: 2, link_roto: 3, pausado: 4, no_existe: 5 };

// ── Parecido entre nombres (para saber si el link abre OTRO producto) ────────
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'en', 'y', 'a', 'por', 'sin', 'color', 'sabor', 'the', 'and', 'with', 'for']);
const palabras = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !VACIAS.has(t));
function parecido(a, b) {
  const A = new Set(palabras(a)), B = new Set(palabras(b));
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return 2 * i / (A.size + B.size);
}

/**
 * Capa 2: abre cada link de afiliado y comprueba que siga llevando al producto.
 * Modifica `resultados` en su lugar, quedándose con el diagnóstico más grave.
 */
async function revisarLinks(tareas, resultados) {
  const conLink = tareas.map((t, i) => ({ t, i })).filter(x => x.t.p.linkML);
  if (!conLink.length) return;
  console.log(`\n🔗 Capa 2: abriendo ${conLink.length} links de afiliado (tarda varios minutos)…`);
  let hechos = 0;
  const filas = await pool(conLink, 3, async x => {
    const r = await resolverAfiliado(x.t.p.linkML).catch(e => ({ ok: false, motivo: e.message }));
    await sleep(200);
    if (++hechos % 50 === 0) console.log(`   … ${hechos}/${conLink.length}`);
    return { x, r };
  });

  // La página de un link caído muestra la tarjeta destacada por defecto del perfil: se
  // reconoce porque varios productos sin relación entre sí resuelven al mismo catálogo.
  const cuenta = {};
  for (const { r } of filas) if (r.mlId) cuenta[r.mlId] = (cuenta[r.mlId] || 0) + 1;

  for (const { x, r } of filas) {
    const p = x.t.p;
    const sim = Math.round(100 * parecido(`${p.marca || ''} ${p.nombre}`, r.titulo));
    let estado = null, detalle = null;
    if (!r.ok) { estado = 'link_roto'; detalle = r.motivo || 'el link no abre ningún producto'; }
    else if (r.pausada) { estado = 'pausado'; detalle = 'publicación pausada en ML'; }
    else if (r.mlId && sim < 20 && (cuenta[r.mlId] || 0) >= 2) { estado = 'link_roto'; detalle = 'cae en la tarjeta por defecto del perfil de afiliado'; }
    else if (r.mlId && x.t.mlId && r.mlId !== x.t.mlId && sim < 20) { estado = 'link_otro'; detalle = `el link abre "${(r.titulo || '').slice(0, 50)}"`; }

    const previo = resultados[x.i] ?? { estado: 'ok' };
    previo.link = { titulo: r.titulo ?? null, mlId: r.mlId ?? null, precio: r.precio ?? null, parecido: sim };

    // El precio que publicamos sale de la API (la oferta más barata con envío FULL del catálogo) y
    // la ficha que abre el link puede enseñar otra oferta. Cuando la ficha es MÁS CARA, el visitante
    // llega esperando un precio y ve otro: eso quema la misma confianza que un link caído. No se
    // pausa ni se cambia el precio solo — se reporta para decidirlo (nov-2026: 7 de 28 de la
    // muestra, de +5% hasta +48%).
    const base = p.precioML ?? null;
    if (!estado && r.ok && r.precio > 0 && base > 0) {
      const dif = (r.precio - base) / base;
      if (dif >= UMBRAL_PRECIO) {
        previo.precioFicha = r.precio;
        previo.difPrecio = Math.round(dif * 100);
      }
    }
    if (estado && GRAVEDAD[estado] > (GRAVEDAD[previo.estado] ?? 0)) {
      resultados[x.i] = { ...previo, estado, detalle };
    }
  }
}

// ── Principal ────────────────────────────────────────────────────────────────
async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
    process.exit(1);
  }
  const registradas = clavesDeDatos();
  const claves = TODAS ? registradas : CATS_ARG;
  if (!claves.length) {
    console.error('Faltan categorías. Usa --todas o --categoria=a,b');
    console.error('Disponibles:', registradas.join(', '));
    process.exit(1);
  }
  const desconocidas = claves.filter(k => !registradas.includes(k));
  if (desconocidas.length) {
    console.error(`❌ Categoría(s) no registrada(s) en scripts/categorias.js: ${desconocidas.join(', ')}`);
    process.exit(1);
  }

  console.log('\n🔍 comparalo.mx — Revisión de disponibilidad en Mercado Libre');
  console.log(`   Modo: ${APLICAR ? 'APLICAR pausas' : 'solo reporte'} · Umbral: ${UMBRAL} corrida(s) · Categorías: ${claves.length}\n`);

  try { TOKEN = await getToken(); }
  catch (e) { console.error('❌', e.message); process.exit(1); }

  const db = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));

  // 1. Juntar todo lo que hay que revisar
  const tareas = [];
  const sinId = [];
  for (const cat of claves) {
    for (const p of (db[cat] ?? [])) {
      if (p.activo === false) continue;
      if (!p.linkML && !p.mlId) continue;          // solo Amazon o sin publicar: no aplica
      const mlId = catalogId(p);
      if (!mlId) { sinId.push({ categoria: cat, id: p.id, nombre: p.nombre, estado: 'sin_id' }); continue; }
      tareas.push({ cat, p, mlId });
    }
  }
  console.log(`📦 ${tareas.length} productos por revisar · ${sinId.length} sin ID de catálogo (no verificables)\n`);

  // 2. Revisar
  const t0 = Date.now();
  let hechos = 0;
  const resultados = await pool(tareas, CONCURRENCIA, async t => {
    const r = await revisar(t.mlId);
    hechos++;
    if (hechos % 50 === 0) process.stdout.write(`   … ${hechos}/${tareas.length}\n`);
    return r;
  });

  // 2b. Capa de links (opcional)
  if (LINKS) await revisarLinks(tareas, resultados);

  // 3. Decidir qué hacer con cada uno
  const productos = [...sinId];
  const desajustes = [];   // precios que la ficha desmiente (no se pausan, se reportan)
  const resumen = {};
  let pausados = 0, reactivados = 0, enRacha = 0, preciosCorregidos = 0, linksRetirados = 0;

  tareas.forEach((t, i) => {
    const { cat, p, mlId } = t;
    const r = resultados[i];
    resumen[cat] ??= { total: 0, ok: 0, sin_ofertas: 0, pausado: 0, no_existe: 0, link_roto: 0, link_otro: 0, error: 0, pausados_ahora: 0, reactivados_ahora: 0 };
    resumen[cat].total++;
    resumen[cat][r.estado]++;

    const fila = {
      categoria: cat, titulo: tituloDe(cat), id: p.id, nombre: p.nombre, marca: p.marca ?? null,
      mlId, estado: r.estado, detalle: r.detalle ?? null, linkML: p.linkML ?? null,
      precioEnSitio: p.precioML ?? null, precioEnML: r.precio ?? null,
      pausaML: !!p.pausaML, pausaAuto: !!p._pausaAuto,
      link: r.link ?? null, linkRevisar: p._linkRevisar ?? null,
    };

    if (r.estado === 'error') { fila.accion = 'ninguna (error de API)'; productos.push(fila); return; }

    if (CAIDO.has(r.estado)) {
      const fallos = (p._dispEstado && CAIDO.has(p._dispEstado) ? (p._dispFallos ?? 1) : 0) + 1;
      fila.fallos = fallos;
      fila.caidoDesde = p._dispDesde ?? HOY;
      if (APLICAR) {
        p._dispEstado = r.estado;
        p._dispFallos = fallos;
        p._dispFecha = HOY;
        p._dispDesde ??= HOY;
        if (fallos >= UMBRAL && LINK_MUERTO.has(r.estado) && p.linkML) {
          // Un link de afiliado que ya no abre su producto no resucita: se retira (queda en
          // _linkMuerto) en vez de dejarlo pausado y volver a abrirlo cada domingo. El producto
          // se queda sin tienda, así que sync-pausas.js lo saca de la página, y entra en la cola
          // "necesita link nuevo" con su mlId, que es lo único que hace falta para generar otro.
          const info = retirarLink(p, r.estado, HOY);
          linksRetirados++;
          fila.accion = 'link retirado' + (info.recuperable
            ? ' · queda su ficha de catálogo para generar uno nuevo'
            : ' · SIN mlId: hay que buscar el producto otra vez');
          fila.linkRetirado = info.linkMuerto;
          fila.pausaML = !!p.pausaML;
        } else if (fallos >= UMBRAL && !p.pausaML) {
          p.pausaML = true;
          p._pausaAuto = true;
          p._motivoPausa = r.estado;
          p._pausaFecha = HOY;
          pausados++;
          resumen[cat].pausados_ahora++;
          fila.accion = 'pausado';
          fila.pausaML = true;
          fila.pausaAuto = true;
        } else if (p.pausaML) {
          fila.accion = 'ya estaba pausado';
        } else {
          enRacha++;
          fila.accion = `en observación (${fallos}/${UMBRAL})`;
        }
      } else {
        fila.accion = fallos >= UMBRAL
          ? (LINK_MUERTO.has(r.estado) && p.linkML ? 'se retiraría el link' : 'se pausaría')
          : `en observación (${fallos}/${UMBRAL})`;
        if (p.pausaML) fila.accion = 'ya estaba pausado';
      }
      productos.push(fila);
      return;
    }

    // El catálogo está bien, pero la ficha que abre el link enseña un precio más alto que el
    // publicado. Manda la ficha: es lo que el visitante va a ver al hacer clic. El producto no se
    // pausa; se le corrige el precio y queda anotado de dónde salió.
    if (r.precioFicha) {
      const antes = p.precioML ?? 0;
      desajustes.push({
        ...fila, estado: 'precio_no_coincide',
        detalle: `publicábamos $${antes.toLocaleString('es-MX')} y la ficha dice $${r.precioFicha.toLocaleString('es-MX')} (+${r.difPrecio}%)`,
        precioEnML: r.precioFicha,
        accion: APLICAR ? 'precio corregido al de la ficha' : 'se corregiría al precio de la ficha',
      });
      if (APLICAR) {
        p._precioFicha = r.precioFicha;
        p._precioFichaFecha = HOY;
        p.precioML = r.precioFicha;
        preciosCorregidos++;
      }
    }

    // Está OK: anotar la revisión, limpiar la racha y, si la pausa era automática, reactivar.
    //
    // Pero un producto pausado porque su LINK estaba roto no se reactiva en una corrida que no
    // revisó links: la capa de catálogo lo ve perfectamente disponible (el catálogo sí existe,
    // lo que murió es el link de afiliado), así que la corrida diaria lo habría devuelto al sitio
    // cada mañana con su link roto intacto. Solo una corrida con --links puede levantarle la pausa.
    const pausadoPorLink = p._motivoPausa === 'link_roto' || p._motivoPausa === 'link_otro';
    const puedeReactivar = !pausadoPorLink || LINKS;
    if (APLICAR) {
      // Se anota en TODOS los que salen bien, no solo en los que venían de una racha: así en el
      // gestor se ve de un vistazo cuándo se revisó cada producto y cuáles llevan tiempo sin mirar.
      if (puedeReactivar) p._dispEstado = 'ok';
      p._dispFecha = HOY;
      delete p._dispFallos;
      delete p._dispDesde;
      if (p.pausaML && p._pausaAuto && puedeReactivar) {
        p.pausaML = false;
        delete p._pausaAuto; delete p._motivoPausa; delete p._pausaFecha;
        reactivados++;
        resumen[cat].reactivados_ahora++;
        fila.accion = 'reactivado (volvió a estar disponible)';
        fila.pausaML = false;
        productos.push(fila);
      }
    } else if (p.pausaML && p._pausaAuto && puedeReactivar) {
      fila.accion = 'se reactivaría (volvió a estar disponible)';
      productos.push(fila);
    } else if (p.pausaML && p._pausaAuto) {
      // Pausado por link roto y esta corrida no revisó links: sigue oculto, y se dice por qué.
      fila.estado = p._dispEstado || p._motivoPausa;
      fila.accion = 'sigue pausado (el catálogo está bien, falta revisar el link con --links)';
      productos.push(fila);
    }
  });

  // 4. Guardar — más abajo, en cuanto estén los totales: el freno de emergencia los necesita.

  const totales = {
    revisados: tareas.length, sin_id: sinId.length,
    ok: Object.values(resumen).reduce((a, r) => a + r.ok, 0),
    sin_ofertas: Object.values(resumen).reduce((a, r) => a + r.sin_ofertas, 0),
    pausado_en_ml: Object.values(resumen).reduce((a, r) => a + r.pausado, 0),
    no_existe: Object.values(resumen).reduce((a, r) => a + r.no_existe, 0),
    link_roto: Object.values(resumen).reduce((a, r) => a + r.link_roto, 0),
    link_otro: Object.values(resumen).reduce((a, r) => a + r.link_otro, 0),
    error: Object.values(resumen).reduce((a, r) => a + r.error, 0),
    pausados_ahora: pausados, reactivados_ahora: reactivados, en_observacion: enRacha,
    precio_no_coincide: desajustes.length,
  };

  // FRENO DE EMERGENCIA. Una corrida en la que casi nada sale bien no es el catálogo cayéndose:
  // es la API o el token. El 24-nov-2026 el token devolvió 403 en todas las llamadas a
  // /products/{id}/items y la corrida pausó 1,137 productos que estaban a la venta. Antes de
  // escribir se mira la proporción, y si es absurda no se toca la base (el reporte sí se escribe).
  const caidosT = totales.sin_ofertas + totales.no_existe + totales.pausado_en_ml + totales.link_roto + totales.link_otro;
  const sospechoso = totales.revisados >= 20 && (totales.ok === 0 || caidosT / totales.revisados > 0.5);
  if (APLICAR && sospechoso && !FORZAR) {
    console.log('\n  ⛔ NO SE ESCRIBIÓ NADA EN LA BASE.');
    console.log(`     ${caidosT} de ${totales.revisados} productos se vieron caídos y solo ${totales.ok} salieron bien.`);
    console.log(`     Eso no es el catálogo: es la API o el token. Mira el detalle en el reporte`);
    console.log(`     (p. ej. "items http_403" = el token no tiene permiso o caducó) y vuelve a correr.`);
    console.log('     Si de verdad se cayó medio catálogo y quieres aplicarlo, repite con --forzar.');
    process.exitCode = 1;
  } else if (APLICAR) {
    writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log('\n💾 merged-admin.json actualizado');
  }

  const generado = new Date().toISOString();

  // El reporte ACUMULA: una corrida de una sola categoría no borra lo que se sabe de las demás,
  // porque el gestor lo lee entero. Cada fila lleva la fecha de SU revisión, así se ve cuál está
  // al día y cuál no. Lo de las categorías revisadas ahora se reemplaza completo.
  let previo = null;
  try { previo = JSON.parse(readFileSync(REPORT_PATH, 'utf8')); } catch { /* no había */ }
  const deOtras = (previo?.productos ?? []).filter(p => !claves.includes(p.categoria));
  const resumenPrevio = Object.fromEntries(
    Object.entries(previo?.resumen ?? {}).filter(([k]) => !claves.includes(k)),
  );
  const fechaPorCat = { ...(previo?.revisadas ?? {}) };
  for (const cat of claves) fechaPorCat[cat] = HOY;

  writeFileSync(REPORT_PATH, JSON.stringify({
    fecha: HOY, generado, aplicado: APLICAR, umbral: UMBRAL, conLinks: LINKS,
    categorias: claves,          // las revisadas en ESTA corrida
    revisadas: fechaPorCat,      // fecha de la última revisión de cada categoría
    totales, resumen: { ...resumenPrevio, ...resumen },
    productos: [
      ...productos.map(p => ({ ...p, fecha: HOY })),
      ...desajustes.map(p => ({ ...p, fecha: HOY })),
      ...deOtras,
    ],
  }, null, 2), 'utf8');

  // 5. Informe en pantalla
  const col = (v, n) => String(v).padStart(n);
  console.log('\n📊 Informe por categoría\n');
  console.log('   Categoría                 En la web  Revisados   Bien  Problemas  Pausados  Sin ID');
  console.log('   ' + '─'.repeat(82));
  let totEnWeb = 0, totProblemas = 0, totPausadosCat = 0;
  const conAlerta = [];
  for (const cat of claves) {
    const r = resumen[cat];
    const enWeb = (db[cat] ?? []).filter(p => p.activo !== false).length;
    totEnWeb += enWeb;
    if (!r) { console.log(`   ${tituloDe(cat).substring(0, 24).padEnd(25)}${col(enWeb, 10)}${col(0, 11)}`); continue; }
    const problemas = r.no_existe + r.pausado + r.sin_ofertas + r.link_roto + r.link_otro;
    const yaPausados = (db[cat] ?? []).filter(p => p.pausaML).length;
    const sinIdCat = sinId.filter(x => x.categoria === cat).length;
    totProblemas += problemas;
    totPausadosCat += yaPausados;
    const pct = r.total ? problemas / r.total : 0;
    if (pct >= 0.25 && problemas >= 3) conAlerta.push([cat, problemas, r.total]);
    console.log(
      `   ${tituloDe(cat).substring(0, 24).padEnd(25)}` +
      col(enWeb, 10) + col(r.total, 11) + col(r.ok, 7) + col(problemas || '·', 11) +
      col(yaPausados || '·', 10) + col(sinIdCat || '·', 8) +
      (pct >= 0.25 && problemas >= 3 ? '  ⚠' : ''),
    );
  }
  console.log('   ' + '─'.repeat(82));
  console.log('   ' + 'TOTAL'.padEnd(25) + col(totEnWeb, 10) + col(tareas.length, 11) +
    col(Object.values(resumen).reduce((a, r) => a + r.ok, 0), 7) + col(totProblemas, 11) +
    col(totPausadosCat, 10) + col(sinId.length, 8));

  if (conAlerta.length) {
    console.log('\n   ⚠ Categorías con más de la cuarta parte caída (suele ser un problema de datos,');
    console.log('     no 20 productos agotados a la vez — revisa los mlId antes de pausar en masa):');
    for (const [cat, n, t] of conAlerta) console.log(`     · ${tituloDe(cat)}: ${n} de ${t}`);
  }

  if (desajustes.length) {
    console.log(`\n💲 El precio de la ficha no coincide con el publicado — ${desajustes.length}`);
    console.log(APLICAR
      ? `   (manda la ficha: ${preciosCorregidos} precio(s) corregidos al que verá quien dé clic)`
      : '   (la ficha que abre el link es más cara: el visitante llega esperando un precio y ve otro)');
    for (const d of desajustes.slice(0, 8)) console.log(`     · ${tituloDe(d.categoria)}: ${String(d.nombre).slice(0, 38)} — ${d.detalle}`);
    if (desajustes.length > 8) console.log(`     … y ${desajustes.length - 8} más en el reporte`);
  }

  // Lo que hay que corregir, agrupado por motivo.
  const porMotivo = {};
  for (const p of productos) {
    if (!CAIDO.has(p.estado)) continue;
    (porMotivo[p.estado] ??= []).push(p);
  }
  const NOMBRE_MOTIVO = {
    no_existe: 'Ya no existen en Mercado Libre',
    pausado: 'Publicación pausada en Mercado Libre',
    link_roto: 'El link de afiliado ya no abre el producto',
    link_otro: 'El link de afiliado abre OTRO producto',
    sin_ofertas: 'Hoy nadie los vende (el catálogo sigue vivo)',
  };
  if (Object.keys(porMotivo).length) {
    console.log('\n🔧 Qué hay que corregir\n');
    for (const [motivo, lista] of Object.entries(porMotivo).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`   ${NOMBRE_MOTIVO[motivo] || motivo} — ${lista.length}`);
      for (const p of lista.slice(0, 5)) console.log(`     · ${tituloDe(p.categoria)}: ${String(p.nombre).slice(0, 52)}`);
      if (lista.length > 5) console.log(`     … y ${lista.length - 5} más (están en el reporte y en el gestor)`);
    }
  }
  console.log(`\n   Caídos = ya no existe (${totales.no_existe}) + pausado en ML (${totales.pausado_en_ml}) + sin ofertas (${totales.sin_ofertas})`
    + (LINKS ? ` + link roto (${totales.link_roto}) + link a otro producto (${totales.link_otro})` : ''));
  if (!LINKS) console.log('   (sin --links no se comprobó que cada link de afiliado siga abriendo su producto)');
  if (APLICAR) console.log(`   ⏸ ${pausados} pausado(s) · ✂ ${linksRetirados} link(s) retirado(s) · ▶ ${reactivados} reactivado(s) · 👀 ${enRacha} en observación`);
  else console.log(`   (modo reporte: no se cambió nada — agrega --aplicar para pausar)`);
  console.log(`\n   ${LLAMADAS} llamadas a la API · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`   📄 Reporte: scripts/disponibilidad-report.json`);
  if (APLICAR && (pausados || reactivados)) console.log('   👉 Corre `node scripts/sync-pausas.js` para aplicarlo a las páginas.\n');
  else console.log('');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();

export { revisar, catalogId };
