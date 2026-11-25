#!/usr/bin/env node
/**
 * precios-por-link.mjs — PLAN B DE PRECIOS. Saca el precio de cada producto abriendo su
 * enlace de afiliado, no preguntándole a la API de Mercado Libre.
 *
 * POR QUÉ EXISTE. Desde el 23-nov-2026 la API responde 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES
 * (blocked_by: PolicyAgent) en GET /products/{id}/items, que es de donde ml-update.js saca TODOS
 * los precios. Falla sin token, con las dos apps, desde dos máquinas y con productos de otros
 * países: no es la cuenta ni el código, lo cerraron en silencio. El ml-report del 23-nov: 0
 * actualizados, 1,314 sin precio. Mientras siga así, la fuente de precios es esta.
 *
 * VENTAJA SOBRE LA API. Devuelve el precio de la publicación a la que lleva NUESTRO enlace, que
 * es el que verá el visitante al hacer clic — no la oferta más barata del catálogo, que muchas
 * veces es otra. Por eso el precio se guarda también en `_precioFicha`, la misma clave que ya
 * escribía `revisar-disponibilidad.js --links` y que `generar-admin.js` usa como piso para que
 * el reporte de la API no publique nunca menos de lo que se ve al dar clic.
 *
 * UNA CORRIDA, DOS COSAS. Abrir el enlace comprueba a la vez que siga vivo y cuánto cuesta, así
 * que esto sustituye también a la capa de links de revisar-disponibilidad.js mientras dure.
 *
 * Uso:
 *   node scripts/precios-por-link.mjs --todas                  (solo revisa y reporta)
 *   node scripts/precios-por-link.mjs --todas --aplicar        (además escribe la base)
 *   node scripts/precios-por-link.mjs --categoria=laptops,cafeteras [--aplicar]
 *   node scripts/precios-por-link.mjs --todas --aplicar --max-salto=40
 *   node scripts/precios-por-link.mjs --todas --aplicar --forzar   (salta el freno)
 *
 * Estados: ok · sin_cambio · pausada · link_roto · link_otro · salto · sin_precio · error
 *
 * CANDADOS (ninguno es opcional):
 *   · Tope de salto (--max-salto, 25%): un precio que se aleja más de eso del guardado NO se
 *     escribe; va al reporte para mirarlo a mano. Mismo criterio que sync-guias-precios.js.
 *   · Freno de emergencia: si no sale bien ninguno, o si más de la mitad de la corrida falla o
 *     se ve caída, NO se escribe nada en la base. Si ML cambia la estructura de esa página todo
 *     se vería "roto" a la vez: eso tiene que parar en seco, nunca escribir precios raros ni
 *     retirar 1,200 enlaces buenos. --forzar lo salta.
 *   · Un error de red o un 5xx NUNCA pausa ni retira nada.
 *   · Un link_roto/link_otro se confirma en DOS corridas (--umbral) antes de actuar, y se trata
 *     con _link-muerto.js: se RETIRA el enlace, no se pausa.
 *   · Una pausa puesta a mano (pausaML sin _pausaAuto) no se toca jamás.
 *
 * Después de --aplicar hay que correr `node scripts/sync-pausas.js` (el workflow lo hace solo).
 *
 * Reporte: scripts/precios-link-report.json (lo lee generar-centro.js → Centro de Control).
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { clavesDeDatos, tituloDe, paginasDe } from './categorias.js';
import { escribirPrecios, quitarProductos } from './_html-precios.js';
import { resolverAfiliado } from './resolver-afiliado.js';
import { LINK_MUERTO, retirarLink } from './_link-muerto.js';
import { actualizarRachaML, publicado } from './_ofertas.js';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://api.mercadolibre.com';
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH = resolve(ROOT, 'scripts/precios-link-report.json');
const PAPELERA_PATH = resolve(ROOT, 'scripts/papelera-productos.json');

const arg = (n, def) => {
  const v = process.argv.find(a => a.startsWith('--' + n + '='))?.split('=')[1];
  return v === undefined ? def : v;
};

const APLICAR = process.argv.includes('--aplicar');
const FORZAR = process.argv.includes('--forzar');
const TODAS = process.argv.includes('--todas');
const CATS_ARG = (arg('categoria', '') || '').split(',').filter(Boolean);
const CONCURRENCIA = Math.max(1, Math.min(8, Number(arg('concurrencia', 4))));
const MAX_SALTO = Math.max(1, Number(arg('max-salto', 25))) / 100;
const UMBRAL = Number(arg('umbral', 2));
/**
 * Días de gracia de una publicación pausada en Mercado Libre antes de borrarla. Una pausa suele
 * ser falta de stock de unos días; si a los 5 sigue pausada, no va a volver y no tiene sentido
 * arrastrarla. Mientras está en gracia sale en el reporte con los días que le quedan.
 */
const DIAS_GRACIA = Number(arg('dias-gracia', 5));
const HOY = new Date().toISOString().slice(0, 10);
const diasDesde = f => {
  const t = Date.parse(f);
  return isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : 0;
};

// Cuánto parecido mínimo entre el nombre que tenemos y el de la tarjeta para dar por bueno que
// el enlace sigue llevando a SU producto. Mismo número que revisar-disponibilidad.js.
const PARECIDO_MIN = 20;
/**
 * El listón sube cuando la tarjeta es, además, la de por defecto del perfil: varios productos
 * sin relación cayendo en el mismo catálogo Y ese catálogo no es el nuestro. Nov-2026 los cuatro
 * enlaces muertos del sitio abrían el MISMO microondas GE; tres se detectaron y el cuarto —un
 * frigobar Midea— se salvó por dos puntos (22% de parecido contra el 20% del listón) y se fue a
 * la cola del tope de salto. Con dos señales independientes (misma tarjeta repetida + no es
 * nuestro catálogo) 60% es seguro: un parecido así de bajo entre dos catálogos distintos no es
 * un nombre mal escrito, es otro producto.
 */
const PARECIDO_DEFECTO = 60;

// Estados de caída, los de aquí y los que pudo dejar revisar-disponibilidad.js: la racha de
// _dispFallos es la misma cola, venga de la capa de catálogo o de esta.
const CAIDO = new Set(['pausada', 'pausado', 'link_roto', 'link_otro', 'no_existe', 'sin_ofertas']);

// ── Utilidades ───────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => (n == null ? '—' : '$' + Number(n).toLocaleString('es-MX'));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/** ¿El motivo del fallo es culpa nuestra/de la red y no del enlace? Esos nunca tocan la base. */
const esErrorNuestro = motivo => /^red:/.test(motivo || '') || /^http (429|5\d\d)/.test(motivo || '');
/** La página no trae la tarjeta: o el enlace murió, o ML cambió la estructura (lo vigila el freno). */
const sinTarjeta = motivo => /polycards|tarjeta destacada ilegible|tarjeta sin ids/.test(motivo || '');

/** Abre el enlace, con dos reintentos cuando el fallo es de red o un 5xx. */
async function abrir(url) {
  let r = null;
  for (let i = 0; i < 3; i++) {
    r = await resolverAfiliado(url).catch(e => ({ ok: false, motivo: 'red: ' + e.message }));
    if (r.ok || !esErrorNuestro(r.motivo)) return r;
    await sleep(1200 * (i + 1));
  }
  return r;
}

// ── Parecido entre nombres (igual que revisar-disponibilidad.js) ─────────────
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
 * Token de aplicación para las llamadas que SÍ siguen funcionando. Ojo: aquí no se pide ningún
 * precio. Lo único cerrado es /products/{id}/items; /products/{id} responde 200 y trae el
 * `status` del catálogo, que es lo que distingue "pausado" de "ya no existe".
 */
async function tokenApp() {
  const id = process.env.ML_CLIENT_ID, secret = process.env.ML_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const r = await fetch(API + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
      signal: AbortSignal.timeout(15000),
    });
    return r.ok ? (await r.json()).access_token : null;
  } catch { return null; }
}

/**
 * ¿El catálogo sigue existiendo? Solo se pregunta por los que el enlace dejó en duda, no por los
 * 1,000 que resolvieron bien: son unas decenas de llamadas por corrida.
 *
 * Devuelve 'no_existe' | 'pausado' | 'activo' | null (null = no se sabe, y entonces NO se toca
 * nada: el 24-nov-2026 tratar un fallo de API como "caído" pausó 1,137 productos a la venta).
 */
async function estadoCatalogo(mlId, token) {
  if (!mlId || !token) return null;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(API + '/products/' + mlId, {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) return 'no_existe';
      if (!r.ok) { if (r.status >= 500 || r.status === 429) { await sleep(900 * (i + 1)); continue; } return null; }
      const d = await r.json();
      return d?.status && d.status !== 'active' ? 'pausado' : 'activo';
    } catch { await sleep(900 * (i + 1)); }
  }
  return null;
}

/**
 * ¿La API de precios volvió? Una sola llamada al final, a /products/{id}/items.
 * Si responde 200 se puede volver a pensar en actualizar precios por API.
 */
async function sondearApi(mlId, token) {
  if (!mlId) return { probado: false, viva: false };
  try {
    const r = await fetch(API + '/products/' + mlId + '/items?limit=1', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      signal: AbortSignal.timeout(15000),
    });
    return { probado: true, mlId, conToken: !!token, status: r.status, viva: r.status === 200 };
  } catch (e) {
    return { probado: true, mlId, conToken: !!token, status: null, viva: false, detalle: e.message };
  }
}

/** Apunta en la papelera lo que se borra, para que "borrado" no signifique "perdido". */
function aPapelera(entradas) {
  if (!entradas.length) return;
  let prev = [];
  try { prev = JSON.parse(readFileSync(PAPELERA_PATH, 'utf8')).productos ?? []; } catch { /* no había */ }
  writeFileSync(PAPELERA_PATH, JSON.stringify({
    actualizado: new Date().toISOString(),
    nota: 'Productos borrados de merged-admin.json por precios-por-link.mjs. Están completos: '
      + 'para revivir uno, vuelve a pegarlo en su categoría.',
    productos: [...entradas, ...prev],
  }, null, 2), 'utf8');
}

// ── Principal ────────────────────────────────────────────────────────────────
async function main() {
  const registradas = clavesDeDatos();
  const claves = TODAS ? registradas : CATS_ARG;
  if (!claves.length) {
    console.error('Faltan categorías. Usa --todas o --categoria=a,b');
    console.error('Disponibles:', registradas.join(', '));
    process.exit(1);
  }
  const desconocidas = claves.filter(k => !registradas.includes(k));
  if (desconocidas.length) {
    console.error('❌ Categoría(s) no registrada(s) en scripts/categorias.js: ' + desconocidas.join(', '));
    process.exit(1);
  }

  console.log('\n🔗 comparalo.mx — Precios por enlace de afiliado (plan B mientras la API de ML esté cerrada)');
  console.log('   Modo: ' + (APLICAR ? 'APLICAR a la base' : 'solo reporte') +
    ' · Tope de salto: ' + Math.round(MAX_SALTO * 100) + '% · Umbral: ' + UMBRAL + ' corrida(s) · Concurrencia: ' + CONCURRENCIA);
  console.log('   Categorías: ' + claves.length + '\n');

  const db = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));

  // 1. Qué revisar: lo que tiene enlace de ML y no está dado de baja.
  //    Lo pausado SÍ entra: su precio se refresca para que esté al día el día que se reactive,
  //    y su enlace se comprueba igual. Lo que no tiene enlace (_necesitaLink) no da precio: fuera.
  const tareas = [];
  let sinLink = 0;
  for (const cat of claves) {
    for (const p of (db[cat] ?? [])) {
      if (p.activo === false || p._eliminado === true || !publicado(p)) continue;
      if (!p.linkML) { sinLink++; continue; }
      tareas.push({ cat, p });
    }
  }
  console.log('📦 ' + tareas.length + ' productos con enlace de Mercado Libre · ' + sinLink + ' sin enlace (no hay precio que sacar)\n');
  if (!tareas.length) { console.log('   Nada que hacer.\n'); return; }

  // 2. Abrir cada enlace
  const t0 = Date.now();
  let hechos = 0;
  const brutos = await pool(tareas, CONCURRENCIA, async t => {
    const r = await abrir(t.p.linkML);
    await sleep(150);
    if (++hechos % 50 === 0) console.log('   … ' + hechos + '/' + tareas.length);
    return r;
  });

  // La página de un enlace caído enseña la tarjeta por defecto del perfil de afiliado: se
  // reconoce porque varios productos sin relación entre sí resuelven al MISMO catálogo.
  const cuenta = {};
  for (const r of brutos) if (r.mlId) cuenta[r.mlId] = (cuenta[r.mlId] || 0) + 1;

  // Esa cuenta solo funciona cuando se revisa el sitio entero: en una corrida de una categoría
  // suelta los enlaces caídos aparecen de uno en uno y la tarjeta por defecto no se delata. Por
  // eso las que ya se conocen se recuerdan de una corrida a otra — la del perfil es siempre la
  // misma (nov-2026: un microondas GE, al que caían los cuatro enlaces muertos del sitio).
  const previoDefecto = (() => {
    try {
      const prev = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
      if (prev.tarjetaDefecto?.length) return prev.tarjetaDefecto;
      // Reportes anteriores a que se guardara la lista: se deduce de los enlaces que ya se
      // dieron por rotos, que es de donde habría salido.
      return [...new Set((prev.productos ?? [])
        .filter(p => p.estado === 'link_roto' && p.mlIdEnLink)
        .map(p => p.mlIdEnLink))];
    } catch { return []; }
  })();
  for (const m of previoDefecto) cuenta[m] = Math.max(cuenta[m] || 0, 2);

  // 3. Clasificar (sin tocar nada todavía: primero hay que ver los totales, que es lo que mira el freno)
  const filas = tareas.map((t, i) => {
    const p = t.p;
    const r = brutos[i];
    const sim = Math.round(100 * parecido((p.marca || '') + ' ' + p.nombre, r.titulo));
    const base = typeof p.precioML === 'number' && p.precioML > 0 ? p.precioML : null;

    const fila = {
      categoria: t.cat, titulo: tituloDe(t.cat), id: String(p.id), nombre: p.nombre, marca: p.marca ?? null,
      mlId: p.mlId ?? null, linkML: p.linkML, precioEnSitio: base, precioEnLink: r.precio ?? null,
      tituloEnLink: r.titulo ?? null, mlIdEnLink: r.mlId ?? null, parecido: sim,
      pausaML: !!p.pausaML, pausaAuto: !!p._pausaAuto,
      estado: null, detalle: null, accion: null, variacion: null,
    };

    if (!r.ok && esErrorNuestro(r.motivo)) { fila.estado = 'error'; fila.detalle = r.motivo; return fila; }
    if (!r.ok) {
      fila.estado = 'link_roto';
      fila.detalle = sinTarjeta(r.motivo)
        ? 'la página no trae la tarjeta del producto (' + r.motivo + ')'
        : (r.motivo || 'el enlace no abre ningún producto');
      return fila;
    }
    if (r.pausada) {
      fila.estado = 'pausada';
      fila.detalle = 'la publicación está pausada en Mercado Libre';
      // Los días de gracia se calculan al clasificar, no al escribir: así una corrida de solo
      // reporte también dice cuántos días le quedan a cada una, que es justo lo que hay que
      // poder mirar sin aplicar nada.
      fila.pausadaDesde = p._pausadaDesde ?? HOY;
      fila.diasPausada = diasDesde(fila.pausadaDesde);
      fila.diasRestantes = Math.max(0, DIAS_GRACIA - fila.diasPausada);
      return fila;
    }
    const repetida = r.mlId && (cuenta[r.mlId] || 0) >= 2;
    const ajena = r.mlId && p.mlId && r.mlId !== p.mlId;
    if (repetida && (sim < PARECIDO_MIN || (ajena && sim < PARECIDO_DEFECTO))) {
      fila.estado = 'link_roto';
      fila.detalle = 'cae en la tarjeta por defecto del perfil de afiliado'
        + (ajena ? ' (abre ' + r.mlId + ', no ' + p.mlId + ')' : '');
      return fila;
    }
    if (r.mlId && p.mlId && r.mlId !== p.mlId && sim < PARECIDO_MIN) {
      fila.estado = 'link_otro';
      fila.detalle = 'el enlace abre "' + String(r.titulo || '').slice(0, 60) + '"';
      return fila;
    }
    if (!(r.precio > 0)) { fila.estado = 'sin_precio'; fila.detalle = 'la tarjeta no trae precio'; return fila; }

    if (base && Math.abs(r.precio - base) / base > MAX_SALTO) {
      fila.estado = 'salto';
      fila.variacion = Math.round(100 * (r.precio - base) / base);
      fila.detalle = fmt(base) + ' → ' + fmt(r.precio) + ' (' + (fila.variacion > 0 ? '+' : '') + fila.variacion +
        '%), más del ' + Math.round(MAX_SALTO * 100) + '% permitido: no se escribe';
      return fila;
    }
    fila.estado = base === r.precio ? 'sin_cambio' : 'ok';
    if (fila.estado === 'ok') {
      fila.variacion = base ? Math.round(100 * (r.precio - base) / base) : null;
      fila.detalle = base ? fmt(base) + ' → ' + fmt(r.precio) : 'precio nuevo: ' + fmt(r.precio);
    }
    return fila;
  });

  // 3b. CONFIRMAR CON EL CATÁLOGO lo que el enlace dejó en duda. Solo para esos: el que
  //     resolvió bien ya está confirmado por su propia tarjeta. /products/{id} sigue dando 200
  //     —lo único cerrado son los precios—, y es lo que distingue "pausado" de "ya no existe".
  const TOKEN = await tokenApp();
  const dudosos = filas.map((f, i) => ({ f, i })).filter(x =>
    ['pausada', 'link_roto', 'link_otro', 'sin_precio'].includes(x.f.estado) && tareas[x.i].p.mlId);
  if (dudosos.length) {
    console.log(`\n🔎 Preguntando al catálogo por ${dudosos.length} producto(s) dudoso(s)…`);
    await pool(dudosos, CONCURRENCIA, async x => {
      const est = await estadoCatalogo(tareas[x.i].p.mlId, TOKEN);
      x.f.catalogo = est;
      // Un 404 del catálogo es la única prueba de que el producto ya no existe. Si la API no
      // contesta (null), no se toca el diagnóstico del enlace: nunca se agrava por un fallo.
      if (est === 'no_existe') {
        x.f.estado = 'no_existe';
        x.f.detalle = 'el catálogo ya no existe en Mercado Libre (404)';
      } else if (est === 'pausado' && x.f.estado !== 'pausada') {
        x.f.catalogoPausado = true;
      }
    });
  }

  const cuentaEstado = e => filas.filter(f => f.estado === e).length;
  const totales = {
    revisados: filas.length, sin_enlace: sinLink,
    ok: cuentaEstado('ok'), sin_cambio: cuentaEstado('sin_cambio'), pausada: cuentaEstado('pausada'),
    link_roto: cuentaEstado('link_roto'), link_otro: cuentaEstado('link_otro'),
    salto: cuentaEstado('salto'), sin_precio: cuentaEstado('sin_precio'), error: cuentaEstado('error'),
    no_existe: cuentaEstado('no_existe'), borrados: 0, en_gracia: 0,
    // Se cuentan al clasificar, no al escribir: así una corrida de solo reporte también dice
    // cuántos bajaron, que es lo primero que se mira en el Centro de Control.
    bajaron: filas.filter(f => f.estado === 'ok' && f.variacion < 0).length,
    subieron: filas.filter(f => f.estado === 'ok' && f.variacion > 0).length,
    pausados_ahora: 0, reactivados_ahora: 0, links_retirados: 0, en_observacion: 0,
  };

  // 4. FRENO DE EMERGENCIA. Una corrida en la que casi nada sale bien no es el catálogo
  //    cayéndose: es Mercado Libre cambiando esa página o cerrándonos la puerta. El 24-nov-2026
  //    un 403 en todas las llamadas hizo que revisar-disponibilidad.js pausara 1,137 productos
  //    que estaban a la venta; aquí sería peor, porque un link_roto RETIRA el enlace. Si la
  //    proporción es absurda no se escribe nada (el reporte sí, para poder mirarlo).
  const resueltos = totales.ok + totales.sin_cambio;
  const malos = totales.error + totales.link_roto + totales.link_otro + totales.sin_precio;
  const sospechoso = filas.length >= 20 && (resueltos === 0 || malos / filas.length > 0.5);

  // 5. Aplicar a la base
  const generado = new Date().toISOString();
  let escribio = false;
  const frenado = APLICAR && sospechoso && !FORZAR;
  if (frenado) {
    console.log('\n  ⛔ NO SE ESCRIBIÓ NADA EN LA BASE.');
    console.log('     Solo ' + resueltos + ' de ' + filas.length + ' productos se resolvieron bien y ' + malos + ' fallaron o se vieron caídos.');
    console.log('     Eso no son cientos de enlaces muriéndose a la vez: es la página de Mercado Libre');
    console.log('     cambiando de estructura, o un bloqueo. Mira scripts/precios-link-report.json');
    console.log('     antes de insistir. Si de verdad quieres aplicarlo tal cual, repite con --forzar.');
    process.exitCode = 1;
  } else if (APLICAR) {
    // Lo que se va a borrar de la base en esta corrida: se junta aquí y se ejecuta al final,
    // porque borrar mientras se recorre la lista desordena el recorrido.
    const aBorrar = [];
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const p = tareas[i].p;
      const r = brutos[i];

      if (f.estado === 'error') { f.accion = 'ninguna (error de red)'; continue; }

      // YA NO EXISTE: confirmado por un 404 del catálogo. Fuera de una, sin periodo de gracia:
      // un catálogo borrado en Mercado Libre no vuelve.
      if (f.estado === 'no_existe') {
        aBorrar.push({ i, motivo: 'no_existe' });
        f.accion = 'borrado (el catálogo ya no existe)';
        continue;
      }

      // PAUSADA: se pausa y empieza el periodo de gracia. Una pausa suele ser falta de stock de
      // unos días; pasados los de gracia sin volver, se borra.
      if (f.estado === 'pausada') {
        p._pausadaDesde ??= f.pausadaDesde;
        const dias = f.diasPausada;
        p._dispEstado = 'pausado';
        p._dispFecha = HOY;
        if (dias > DIAS_GRACIA) {
          aBorrar.push({ i, motivo: 'pausada_' + dias + 'd' });
          f.accion = 'borrado (' + dias + ' días pausada, más de los ' + DIAS_GRACIA + ' de gracia)';
          continue;
        }
        // Una pausa puesta a mano no se toca; la automática se pone o se mantiene.
        if (!p.pausaML) {
          p.pausaML = true;
          p._pausaAuto = true;
          p._motivoPausa = 'pausado';
          p._pausaFecha = HOY;
          totales.pausados_ahora++;
          f.accion = 'pausado · ' + f.diasRestantes + ' día(s) de gracia';
        } else {
          f.accion = 'sigue pausado · ' + f.diasRestantes + ' día(s) de gracia';
        }
        totales.en_gracia++;
        continue;
      }

      // Enlaces muertos: se confirman en DOS corridas y se retira el enlace (no se borra el
      // producto: el catálogo sigue vivo, lo que murió es nuestro enlace).
      if (LINK_MUERTO.has(f.estado)) {
        const fallos = (CAIDO.has(p._dispEstado) ? (p._dispFallos ?? 1) : 0) + 1;
        f.fallos = fallos;
        p._dispEstado = f.estado;
        p._dispFallos = fallos;
        p._dispFecha = HOY;
        p._dispDesde ??= HOY;
        if (fallos >= UMBRAL && p.linkML) {
          const info = retirarLink(p, f.estado, HOY);
          totales.links_retirados++;
          f.accion = 'enlace retirado' + (info.recuperable
            ? ' · queda su ficha de catálogo para generar otro'
            : ' · SIN mlId: hay que buscarlo otra vez');
          f.linkRetirado = info.linkMuerto;
        } else if (!p.linkML) {
          f.accion = 'ya no tenía enlace';
        } else {
          totales.en_observacion++;
          f.accion = 'en observación (' + fallos + '/' + UMBRAL + ')';
        }
        continue;
      }

      // El enlace está bien. Se anota la revisión aunque el precio no cambie: así en el Centro
      // se ve de un vistazo qué se revisó hoy y qué lleva semanas sin mirarse.
      p._dispEstado = 'ok';
      p._dispFecha = HOY;
      delete p._dispFallos;
      delete p._dispDesde;
      // Volvió a estar a la venta: se le borra el reloj de gracia, no vaya a arrastrar días
      // viejos y acabe borrado por una pausa de la que ya salió.
      delete p._pausadaDesde;
      if (p.pausaML && p._pausaAuto) {
        // Solo la pausa automática. Si la pusiste tú en el gestor, se queda.
        p.pausaML = false;
        delete p._pausaAuto; delete p._motivoPausa; delete p._pausaFecha;
        totales.reactivados_ahora++;
        f.accion = 'reactivado (el enlace volvió a abrir su producto)';
      }
      // Un mlId que no teníamos y la tarjeta sí: dato nuevo, nunca sobrescribe el guardado.
      if (!p.mlId && r.mlId) { p.mlId = r.mlId; p.mlIdFuente = 'link'; f.mlIdNuevo = r.mlId; }

      if (f.estado === 'salto' || f.estado === 'sin_precio') {
        f.accion = f.estado === 'salto'
          ? 'precio NO escrito (tope de salto) — revísalo a mano'
          : 'sin precio en la tarjeta';
        continue;
      }

      // El precio. `_precioFicha` es el piso que respeta generar-admin.js el día que la API
      // vuelva; `actualizarRachaML` es la MISMA función que fija el ancla de las bajadas cuando
      // el precio viene de ml-report.json, para que una oferta se comporte igual venga de donde venga.
      const antes = f.precioEnSitio;
      p.precioML = r.precio;
      p._precioFicha = r.precio;
      p._precioFichaFecha = HOY;
      p._precioLinkFecha = HOY;
      actualizarRachaML(p, { estado: 'actualizado', precioAntes: antes ?? r.precio }, HOY);
      if (f.estado === 'ok') {
        f.accion = antes ? 'precio actualizado' : 'precio escrito por primera vez';
      } else {
        f.accion = 'sin cambio';
      }
    }
    // BORRADOS. Primero salen de la página y después de la base, nunca al revés: una vez
    // borrado el registro, nada queda que le diga a sync-pausas.js que esa tarjeta sobra, y se
    // quedaría anunciada para siempre sin nada en la base que la delate. Copia a la papelera
    // antes de tocar nada, para que "borrado" no acabe significando "perdido".
    if (aBorrar.length) {
      const porCat = {};
      for (const { i, motivo } of aBorrar) {
        (porCat[filas[i].categoria] ??= []).push({ i, motivo, p: tareas[i].p });
      }
      aPapelera(aBorrar.map(({ i, motivo }) => ({
        fecha: HOY, categoria: filas[i].categoria, motivo,
        detalle: filas[i].detalle ?? null, producto: tareas[i].p,
      })));

      for (const [cat, lista] of Object.entries(porCat)) {
        const quitables = lista.map(x => ({ id: x.p.id, linkML: x.p.linkML }));
        let fueraDeLaPagina = true;
        for (const pag of paginasDe(cat)) {
          const r = quitarProductos(resolve(ROOT, pag.file), pag.varName, pag.tipo, quitables);
          if (!r.ok) {
            fueraDeLaPagina = false;
            console.log('   ⚠ ' + pag.file + ': ' + r.motivo + ' — no se borra de la base para no dejar la tarjeta huérfana');
            continue;
          }
          if (r.quitados) console.log('   🗑 ' + pag.file + ': ' + r.quitados + ' producto(s) quitados de la página');
        }
        // Si alguna de sus páginas no se pudo limpiar, el producto se queda en la base (oculto
        // con las marcas de siempre) y se dice por qué. Mejor eso que una tarjeta sin dueño.
        if (!fueraDeLaPagina) {
          for (const x of lista) {
            x.p.activo = false;
            x.p._eliminado = true;
            x.p._motivoEliminado = x.motivo;
            x.p._eliminadoFecha = HOY;
            filas[x.i].accion = 'oculto, NO borrado: hay que quitarlo a mano de su página';
          }
          continue;
        }
        const quitar = new Set(lista.map(x => String(x.p.id)));
        db[cat] = (db[cat] ?? []).filter(p => !quitar.has(String(p.id)));
        totales.borrados += lista.length;
      }
    }

    writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
    escribio = true;
    console.log('\n💾 merged-admin.json actualizado'
      + (totales.borrados ? ' · ' + totales.borrados + ' producto(s) borrados (copia en scripts/papelera-productos.json)' : ''));

    // El precio que ve el visitante NO sale de la base: sale del array JS escrito dentro de cada
    // página. El único que lo parcheaba era ml-update.js, así que al relevarlo había que relevar
    // esto también o la base diría $1,699 mientras la página sigue anunciando $1,920.
    // Se escribe en TODAS las páginas que muestran la categoría, incluidas las espejo.
    const porPagina = {};
    filas.forEach((f, i) => {
      if (f.estado !== 'ok' && f.estado !== 'sin_cambio') return;
      const precio = brutos[i].precio;
      if (!(precio > 0)) return;
      (porPagina[f.categoria] ??= []).push({ id: tareas[i].p.id, linkML: tareas[i].p.linkML, precio });
    });
    let enHtml = 0;
    for (const [cat, lista] of Object.entries(porPagina)) {
      for (const pag of paginasDe(cat)) {
        const r = escribirPrecios(resolve(ROOT, pag.file), pag.varName, pag.tipo, lista);
        if (!r.ok) { console.log('   ⚠ ' + pag.file + ': ' + r.motivo); continue; }
        enHtml += r.cambios;
        if (r.cambios) console.log('   📄 ' + pag.file + ': ' + r.cambios + ' precio(s) escrito(s)' +
          (r.sinEncontrar ? ' · ' + r.sinEncontrar + ' producto(s) de la base no están en esta página' : ''));
      }
    }
    totales.precios_en_html = enHtml;
    console.log('💾 ' + enHtml + ' precios escritos en las páginas');
  } else {
    const QUE_PASARIA = {
      ok: 'se escribiría el precio', sin_cambio: 'nada que cambiar',
      salto: 'se dejaría como está (tope de salto)', error: 'ninguna (error de red)',
      sin_precio: 'sin precio en la tarjeta',
      pausada: 'se pausaría y empezarían sus ' + DIAS_GRACIA + ' días de gracia',
      no_existe: 'se borraría (el catálogo ya no existe)',
      link_roto: 'se retiraría el enlace al confirmarse', link_otro: 'se retiraría el enlace al confirmarse',
    };
    for (const f of filas) f.accion = QUE_PASARIA[f.estado] ?? null;
  }

  // 6. ¿Volvió la API? Una sola llamada, con un mlId cualquiera de los que acabamos de ver.
  const api = await sondearApi(tareas.find(t => t.p.mlId)?.p.mlId ?? null);

  // 7. Reporte — ACUMULA: revisar una categoría suelta no borra lo que se sabe de las demás.
  let previo = null;
  try { previo = JSON.parse(readFileSync(REPORT_PATH, 'utf8')); } catch { /* no había */ }
  const deOtras = (previo?.productos ?? []).filter(p => !claves.includes(p.categoria));
  const revisadas = { ...(previo?.revisadas ?? {}) };
  for (const cat of claves) revisadas[cat] = HOY;
  const porCategoria = {};
  for (const f of filas) {
    const c = (porCategoria[f.categoria] ??= { total: 0, ok: 0, sin_cambio: 0, pausada: 0, link_roto: 0, link_otro: 0, salto: 0, sin_precio: 0, error: 0 });
    c.total++; c[f.estado]++;
  }

  writeFileSync(REPORT_PATH, JSON.stringify({
    fecha: HOY, generado, aplicado: APLICAR, escribio, frenado,
    maxSalto: MAX_SALTO, umbral: UMBRAL, categorias: claves, revisadas,
    // Los catálogos que hacen de tarjeta por defecto del perfil, para reconocerlos en las
    // corridas de una sola categoría, donde no hay repetición que delate.
    tarjetaDefecto: [...new Set([
      ...previoDefecto,
      ...filas.filter(f => f.estado === 'link_roto' && f.mlIdEnLink).map(f => f.mlIdEnLink),
    ])],
    api: { ...api, mensaje: api.viva ? 'la API volvió, se puede retomar ml-update.js' : 'la API sigue cerrada' },
    diasGracia: DIAS_GRACIA,
    // La cola que hay que seguir mirando: pausadas con los días que les quedan antes de borrarse.
    enGracia: filas.filter(f => f.estado === 'pausada').map(f => ({
      categoria: f.categoria, titulo: f.titulo, id: f.id, nombre: f.nombre,
      pausadaDesde: f.pausadaDesde ?? null, diasPausada: f.diasPausada ?? null,
      diasRestantes: f.diasRestantes ?? null, linkML: f.linkML, mlId: f.mlId,
    })),
    borrados: filas.filter(f => String(f.accion || '').startsWith('borrado')).map(f => ({
      categoria: f.categoria, titulo: f.titulo, id: f.id, nombre: f.nombre,
      estado: f.estado, detalle: f.detalle, accion: f.accion,
    })),
    totales, porCategoria: { ...(previo?.porCategoria ?? {}), ...porCategoria },
    productos: [...filas.map(f => ({ ...f, fecha: HOY })), ...deOtras],
  }, null, 2), 'utf8');

  // 8. Informe en pantalla
  const col = (v, n) => String(v).padStart(n);
  console.log('\n📊 Informe por categoría\n');
  console.log('   Categoría                 Revisados  Precio  Igual  Tope  Caídos  Error');
  console.log('   ' + '─'.repeat(72));
  for (const cat of claves) {
    const c = porCategoria[cat];
    if (!c) continue;
    const caidos = c.pausada + c.link_roto + c.link_otro;
    console.log('   ' + tituloDe(cat).substring(0, 24).padEnd(25) + col(c.total, 10) + col(c.ok || '·', 8) +
      col(c.sin_cambio || '·', 7) + col(c.salto || '·', 6) + col(caidos || '·', 8) + col(c.error || '·', 7));
  }
  console.log('   ' + '─'.repeat(72));
  console.log('   ' + 'TOTAL'.padEnd(25) + col(totales.revisados, 10) + col(totales.ok, 8) +
    col(totales.sin_cambio, 7) + col(totales.salto, 6) +
    col(totales.pausada + totales.link_roto + totales.link_otro, 8) + col(totales.error, 7));

  const muestra = (titulo, lista, n = 6) => {
    if (!lista.length) return;
    console.log('\n' + titulo + ' — ' + lista.length);
    for (const f of lista.slice(0, n)) console.log('   · ' + f.titulo + ': ' + String(f.nombre).slice(0, 40) + ' — ' + f.detalle);
    if (lista.length > n) console.log('   … y ' + (lista.length - n) + ' más en el reporte');
  };
  muestra('💸 Bajaron de precio', filas.filter(f => f.estado === 'ok' && f.variacion < 0));
  muestra('📈 Subieron de precio', filas.filter(f => f.estado === 'ok' && f.variacion > 0));
  muestra('⚠ Fuera por el tope de salto (revísalos a mano)', filas.filter(f => f.estado === 'salto'));
  muestra('🔗 El enlace ya no abre su producto', filas.filter(f => LINK_MUERTO.has(f.estado)));
  muestra('🗑 Ya no existen en Mercado Libre (se borran)', filas.filter(f => f.estado === 'no_existe'));
  const enGracia = filas.filter(f => f.estado === 'pausada' && f.diasRestantes != null);
  if (enGracia.length) {
    console.log('\n⏸ Pausadas en Mercado Libre — ' + enGracia.length + ' (se borran al pasar ' + DIAS_GRACIA + ' días)');
    for (const f of enGracia.sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 10)) {
      console.log('   · ' + f.titulo + ': ' + String(f.nombre).slice(0, 38) +
        ' — pausada desde ' + f.pausadaDesde + ', le queda(n) ' + f.diasRestantes + ' día(s)');
    }
    if (enGracia.length > 10) console.log('   … y ' + (enGracia.length - 10) + ' más en el reporte');
  } else {
    muestra('⏸ Publicación pausada en Mercado Libre', filas.filter(f => f.estado === 'pausada'));
  }
  muestra('❌ No se pudieron abrir (no se tocó nada)', filas.filter(f => f.estado === 'error'));

  if (escribio) {
    console.log('\n   💲 ' + totales.bajaron + ' bajaron · ' + totales.subieron + ' subieron · ⏸ ' +
      totales.pausados_ahora + ' pausado(s) · ✂ ' + totales.links_retirados + ' enlace(s) retirado(s) · ▶ ' +
      totales.reactivados_ahora + ' reactivado(s) · 👀 ' + totales.en_observacion + ' en observación');
  } else if (!APLICAR) {
    console.log('\n   (modo reporte: no se cambió nada — agrega --aplicar para escribir la base)');
  }

  console.log('\n   🔌 API de Mercado Libre: ' + (api.probado
    ? '/products/' + api.mlId + '/items → ' + (api.status ?? 'sin respuesta')
    : 'no se pudo sondear'));
  if (api.viva) {
    console.log('   ✅ LA API VOLVIÓ: responde 200. Se puede retomar ml-update.js y volver a programar update-prices.yml.');
  } else if (api.probado) {
    console.log('   La API sigue cerrada: el precio por enlace sigue siendo la fuente buena.');
  }
  console.log('\n   ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s · 📄 Reporte: scripts/precios-link-report.json');
  if (escribio) console.log('   👉 Corre `node scripts/sync-pausas.js` para aplicarlo a las páginas.\n');
  else console.log('');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
