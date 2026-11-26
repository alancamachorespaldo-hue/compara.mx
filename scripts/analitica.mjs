#!/usr/bin/env node
/**
 * analitica.mjs — trae los números de GA4 y de Search Console y escribe
 * `scripts/analitica.json`, el archivo que lee la sección Analítica del
 * Centro de Control (y, de ahí, el Planificador para sus KPI de la semana).
 *
 *   node scripts/analitica.mjs            # escribe scripts/analitica.json
 *   node scripts/analitica.mjs --dry-run  # lo imprime y no escribe nada
 *   node scripts/analitica.mjs --solo=ga4|gsc
 *
 * CREDENCIAL. Las dos APIs piden credencial de servidor (una página en el
 * navegador no puede guardarla sin exponerla), así que esto corre en GitHub
 * Actions con el secret `GOOGLE_SERVICE_ACCOUNT_JSON`: el JSON de una cuenta
 * de servicio de Google Cloud, tal cual o en base64. Para correrlo en la
 * máquina, el mismo JSON en `scripts/.google-sa.json` (está en .gitignore).
 *
 * NO lleva dependencias a propósito: el repo no tiene build step, así que la
 * firma del JWT va con `node:crypto` y las llamadas con `fetch`.
 *
 * QUÉ ESCRIBE. Dos periodos comparados contra el anterior (7 contra 7 días y
 * 28 contra 28), una serie diaria para la gráfica, y los cortes que sirven
 * para decidir: páginas, fuentes, eventos, consultas de búsqueda.
 *
 * SEARCH CONSOLE VA RETRASADO ~3 días, así que sus periodos terminan en
 * hoy-3 y no en hoy; si no, el último tramo siempre se vería cayendo.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(DIR, '..');
const SALIDA = path.join(DIR, 'analitica.json');

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d = null) => {
  const a = args.find((x) => x.startsWith('--' + n + '='));
  return a ? a.slice(n.length + 3) : d;
};
const DRY = flag('dry-run');
const SOLO = opt('solo', '');

const MEASUREMENT_ID = 'G-9TKZ4ER13X';     // el GA4 del sitio (regla de CLAUDE.md)
const DOMINIO = 'comparalo.mx';
const RETRASO_GSC = 3;                      // días que tarda Search Console en cerrar un día

/* eventos que valen dinero: un clic a tienda es lo más cerca de una venta que
   vemos, porque la conversión ocurre ya dentro de ML o de Amazon */
const EV_ML = ['affiliate_click_ml', 'click_ml'];
const EV_AMZ = ['affiliate_click_amazon', 'affiliate_click_amz'];
const EV_LEAD = ['leads_form_submit'];
const EV_CLAVE = [].concat(EV_ML, EV_AMZ, EV_LEAD, ['click_ofertas_cta', 'filtro_bajada_precio', 'guide_open', 'compare_start']);

/* ───────── fechas ───────── */
const iso = (d) => d.toISOString().slice(0, 10);
const menos = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - n); return x; };
/** ventana de `n` días que termina en `fin` (incluido), y la anterior del mismo largo */
function ventanas(fin, n) {
  const hasta = iso(fin), desde = iso(menos(fin, n - 1));
  const pHasta = iso(menos(fin, n)), pDesde = iso(menos(fin, n * 2 - 1));
  return { desde, hasta, prevDesde: pDesde, prevHasta: pHasta };
}

/* ───────── credencial ───────── */
function cuentaServicio() {
  const crudo = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';
  let txt = crudo.trim();
  if (!txt) {
    const local = path.join(DIR, '.google-sa.json');
    if (fs.existsSync(local)) txt = fs.readFileSync(local, 'utf8');
  }
  if (!txt) return null;
  // el secret puede venir en base64 para que GitHub no lo parta en líneas
  if (!txt.startsWith('{')) {
    try { txt = Buffer.from(txt, 'base64').toString('utf8'); } catch { /* se cae abajo */ }
  }
  let sa;
  try { sa = JSON.parse(txt); } catch { throw new Error('La credencial no es un JSON válido'); }
  if (!sa.client_email || !sa.private_key) throw new Error('A la credencial le falta client_email o private_key');
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}

const b64url = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function token(sa, scopes) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabeza = b64url({ alg: 'RS256', typ: 'JWT' });
  const cuerpo = b64url({
    iss: sa.client_email, scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token', exp: ahora + 3600, iat: ahora
  });
  const firma = crypto.createSign('RSA-SHA256').update(cabeza + '.' + cuerpo).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: cabeza + '.' + cuerpo + '.' + firma
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error('No se pudo autenticar con Google (' + r.status + '): ' + (j.error_description || j.error || 'sin detalle'));
  }
  return j.access_token;
}

async function api(url, tk, cuerpo) {
  const r = await fetch(url, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + tk, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* respuesta rara */ }
  if (!r.ok) {
    const det = (j && j.error && (j.error.message || j.error.status)) || txt.slice(0, 200);
    const e = new Error('HTTP ' + r.status + ': ' + det);
    e.status = r.status;
    throw e;
  }
  return j;
}

/* ───────── GA4 ───────── */
async function propiedadGA4(tk) {
  if (process.env.GA4_PROPERTY_ID) {
    const id = String(process.env.GA4_PROPERTY_ID).replace(/^properties\//, '');
    return { id: 'properties/' + id, nombre: null, medicion: MEASUREMENT_ID };
  }
  // sin ID a mano: se busca la propiedad cuyo flujo web tiene el measurement id del sitio
  const res = await api('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', tk);
  const props = [];
  for (const a of res.accountSummaries || []) {
    for (const p of a.propertySummaries || []) props.push({ id: p.property, nombre: p.displayName });
  }
  if (!props.length) throw new Error('La cuenta de servicio no ve ninguna propiedad de GA4: falta darle acceso de lectura en Analytics');
  for (const p of props) {
    let flujos;
    try { flujos = await api('https://analyticsadmin.googleapis.com/v1beta/' + p.id + '/dataStreams?pageSize=50', tk); }
    catch { continue; }
    for (const f of flujos.dataStreams || []) {
      const mid = f.webStreamData && f.webStreamData.measurementId;
      if (mid === MEASUREMENT_ID) return { id: p.id, nombre: p.nombre || p.displayName, medicion: mid };
    }
  }
  throw new Error('Ninguna propiedad visible tiene el flujo ' + MEASUREMENT_ID + ' (vistas: ' + props.map((p) => p.nombre).join(', ') + ')');
}

const ga4Url = (prop) => 'https://analyticsdata.googleapis.com/v1beta/' + prop + ':runReport';

const filaGA4 = (f) => ({
  dims: (f.dimensionValues || []).map((d) => d.value),
  mets: (f.metricValues || []).map((m) => (m.value == null ? 0 : Number(m.value)))
});

/** una corrida de runReport ya desarmada en filas simples */
async function reporte(tk, prop, cuerpo) {
  const j = await api(ga4Url(prop), tk, cuerpo);
  return (j.rows || []).map(filaGA4);
}

/** totales de un rango: usuarios, sesiones, vistas y los eventos que importan */
async function totalesGA4(tk, prop, desde, hasta) {
  const base = await reporte(tk, prop, {
    dateRanges: [{ startDate: desde, endDate: hasta }],
    metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    keepEmptyRows: true
  });
  const m = base[0] ? base[0].mets : [0, 0, 0, 0];
  const evs = await reporte(tk, prop, {
    dateRanges: [{ startDate: desde, endDate: hasta }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    limit: 200
  });
  const porEvento = {};
  evs.forEach((f) => { porEvento[f.dims[0]] = f.mets[0]; });
  const suma = (lista) => lista.reduce((a, n) => a + (porEvento[n] || 0), 0);
  const clicsML = suma(EV_ML), clicsAmz = suma(EV_AMZ);
  return {
    desde, hasta,
    usuarios: m[0], sesiones: m[1], vistas: m[2], eventos: m[3],
    clicsML, clicsAmz, clicsTienda: clicsML + clicsAmz,
    leads: suma(EV_LEAD),
    porEvento
  };
}

async function traerGA4(tk, hoy) {
  const prop = await propiedadGA4(tk);
  const out = {
    propiedad: prop.id, nombre: prop.nombre, medicion: MEASUREMENT_ID,
    periodos: {}, serie: [], paginas: [], fuentes: [], eventos: []
  };

  for (const n of [7, 28]) {
    const v = ventanas(hoy, n);
    const act = await totalesGA4(tk, prop.id, v.desde, v.hasta);
    const ant = await totalesGA4(tk, prop.id, v.prevDesde, v.prevHasta);
    out.periodos[n + 'd'] = { dias: n, actual: act, previo: ant };
  }

  // serie diaria de 56 días: alcanza para ver 8 semanas en la gráfica
  const vs = ventanas(hoy, 56);
  const serie = await reporte(tk, prop.id, {
    dateRanges: [{ startDate: vs.desde, endDate: vs.hasta }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 400
  });
  const serieEv = await reporte(tk, prop.id, {
    dateRanges: [{ startDate: vs.desde, endDate: vs.hasta }],
    dimensions: [{ name: 'date' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [].concat(EV_ML, EV_AMZ) } } },
    limit: 1000
  });
  const clicsDia = {};
  serieEv.forEach((f) => { clicsDia[f.dims[0]] = (clicsDia[f.dims[0]] || 0) + f.mets[0]; });
  out.serie = serie.map((f) => {
    const d = f.dims[0];
    return {
      fecha: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
      usuarios: f.mets[0], sesiones: f.mets[1], vistas: f.mets[2], clicsTienda: clicsDia[d] || 0
    };
  });

  const v28 = ventanas(hoy, 28);
  const pags = await reporte(tk, prop.id, {
    dateRanges: [{ startDate: v28.desde, endDate: v28.hasta }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 30
  });
  out.paginas = pags.map((f) => ({ ruta: f.dims[0], vistas: f.mets[0], usuarios: f.mets[1] }));

  const fuentes = await reporte(tk, prop.id, {
    dateRanges: [{ startDate: v28.desde, endDate: v28.hasta }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 15
  });
  out.fuentes = fuentes.map((f) => ({ fuente: f.dims[0], sesiones: f.mets[0], usuarios: f.mets[1] }));

  // eventos: el periodo actual contra el anterior, para ver qué se movió
  const a = out.periodos['28d'].actual.porEvento, b = out.periodos['28d'].previo.porEvento;
  const nombres = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
  out.eventos = nombres.map((n) => ({ evento: n, conteo: a[n] || 0, previo: b[n] || 0, clave: EV_CLAVE.indexOf(n) >= 0 }))
    .sort((x, y) => y.conteo - x.conteo);

  // el desglose completo ya viajó en `eventos`; no hace falta duplicarlo
  for (const k of Object.keys(out.periodos)) {
    delete out.periodos[k].actual.porEvento;
    delete out.periodos[k].previo.porEvento;
  }
  return out;
}

/* ───────── Search Console ───────── */
async function sitioGSC(tk) {
  if (process.env.GSC_SITE) return process.env.GSC_SITE;
  const j = await api('https://www.googleapis.com/webmasters/v3/sites', tk);
  const sitios = (j.siteEntry || []).map((s) => s.siteUrl);
  if (!sitios.length) throw new Error('La cuenta de servicio no ve ningún sitio en Search Console: falta agregarla como usuario de la propiedad');
  const mios = sitios.filter((s) => s.indexOf(DOMINIO) >= 0);
  if (!mios.length) throw new Error('Ningún sitio visible es ' + DOMINIO + ' (vistos: ' + sitios.join(', ') + ')');
  // la propiedad de dominio cubre www y http, así que gana si existe
  return mios.find((s) => s.startsWith('sc-domain:')) || mios[0];
}

async function consultaGSC(tk, sitio, cuerpo) {
  const url = 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(sitio) + '/searchAnalytics/query';
  const j = await api(url, tk, cuerpo);
  return j.rows || [];
}

function totalGSC(filas, desde, hasta) {
  let clics = 0, imp = 0, posPond = 0;
  filas.forEach((r) => { clics += r.clicks; imp += r.impressions; posPond += r.position * r.impressions; });
  return {
    desde, hasta, clics, impresiones: imp,
    ctr: imp ? clics / imp : 0,
    posicion: imp ? posPond / imp : 0
  };
}

async function traerGSC(tk, hoy) {
  const sitio = await sitioGSC(tk);
  const fin = menos(hoy, RETRASO_GSC);
  const out = { sitio, retrasoDias: RETRASO_GSC, periodos: {}, semanas: [], serieDias: [], consultas: [], paginas: [] };

  for (const n of [7, 28]) {
    const v = ventanas(fin, n);
    const act = await consultaGSC(tk, sitio, { startDate: v.desde, endDate: v.hasta, dimensions: ['date'], rowLimit: 100 });
    const ant = await consultaGSC(tk, sitio, { startDate: v.prevDesde, endDate: v.prevHasta, dimensions: ['date'], rowLimit: 100 });
    out.periodos[n + 'd'] = {
      dias: n,
      actual: totalGSC(act, v.desde, v.hasta),
      previo: totalGSC(ant, v.prevDesde, v.prevHasta)
    };
  }

  // 12 semanas de serie diaria, agrupadas por semana que empieza en lunes
  const v84 = ventanas(fin, 84);
  const dias = await consultaGSC(tk, sitio, { startDate: v84.desde, endDate: v84.hasta, dimensions: ['date'], rowLimit: 200 });
  const lunes = (f) => {
    const d = new Date(f + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return iso(d);
  };
  const sem = {};
  dias.forEach((r) => {
    const k = lunes(r.keys[0]);
    const s = sem[k] || (sem[k] = { semana: k, clics: 0, impresiones: 0, posPond: 0 });
    s.clics += r.clicks; s.impresiones += r.impressions; s.posPond += r.position * r.impressions;
  });
  out.semanas = Object.keys(sem).sort().map((k) => {
    const s = sem[k];
    return {
      semana: s.semana, clics: s.clics, impresiones: s.impresiones,
      ctr: s.impresiones ? s.clics / s.impresiones : 0,
      posicion: s.impresiones ? s.posPond / s.impresiones : 0
    };
  });
  out.serieDias = dias.map((r) => ({ fecha: r.keys[0], clics: r.clicks, impresiones: r.impressions }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  const v28 = ventanas(fin, 28);
  const base = { startDate: v28.desde, endDate: v28.hasta, rowLimit: 40 };
  const cons = await consultaGSC(tk, sitio, Object.assign({}, base, { dimensions: ['query'] }));
  out.consultas = cons.map((r) => ({ consulta: r.keys[0], clics: r.clicks, impresiones: r.impressions, ctr: r.ctr, posicion: r.position }));
  const pags = await consultaGSC(tk, sitio, Object.assign({}, base, { dimensions: ['page'] }));
  out.paginas = pags.map((r) => ({
    url: r.keys[0], ruta: r.keys[0].replace(/^https?:\/\/[^/]+/, ''),
    clics: r.clicks, impresiones: r.impressions, ctr: r.ctr, posicion: r.position
  }));
  return out;
}

/* ───────── corrida ───────── */
const hoy = new Date(iso(new Date()) + 'T00:00:00Z');
const salida = { generado: new Date().toISOString(), estado: 'ok', ga4: null, gsc: null, errores: [] };

let sa = null;
try { sa = cuentaServicio(); }
catch (e) { salida.errores.push({ donde: 'credencial', mensaje: e.message }); }

if (!sa) {
  salida.estado = 'sin-credencial';
  if (!salida.errores.length) {
    salida.errores.push({ donde: 'credencial', mensaje: 'Falta GOOGLE_SERVICE_ACCOUNT_JSON (o scripts/.google-sa.json en la máquina)' });
  }
} else {
  if (SOLO !== 'gsc') {
    try {
      const tk = await token(sa, ['https://www.googleapis.com/auth/analytics.readonly']);
      salida.ga4 = await traerGA4(tk, hoy);
    } catch (e) { salida.errores.push({ donde: 'ga4', mensaje: e.message }); }
  }
  if (SOLO !== 'ga4') {
    try {
      const tk = await token(sa, ['https://www.googleapis.com/auth/webmasters.readonly']);
      salida.gsc = await traerGSC(tk, hoy);
    } catch (e) { salida.errores.push({ donde: 'gsc', mensaje: e.message }); }
  }
  if (!salida.ga4 && !salida.gsc) salida.estado = 'error';
  else if (salida.errores.length) salida.estado = 'parcial';
}

/* resumen corto: es lo que el Planificador usa como KPI de la semana sin tener
   que volver a sumar nada */
const pct = (a, b) => (b ? (a - b) / b : null);
if (salida.ga4 || salida.gsc) {
  const g = salida.ga4 && salida.ga4.periodos['7d'];
  const s = salida.gsc && salida.gsc.periodos['7d'];
  salida.semana = {
    desde: (g && g.actual.desde) || (s && s.actual.desde) || null,
    hasta: (g && g.actual.hasta) || (s && s.actual.hasta) || null,
    usuarios: g ? g.actual.usuarios : null,
    sesiones: g ? g.actual.sesiones : null,
    vistas: g ? g.actual.vistas : null,
    clicsTienda: g ? g.actual.clicsTienda : null,
    clicsML: g ? g.actual.clicsML : null,
    clicsAmz: g ? g.actual.clicsAmz : null,
    impresiones: s ? s.actual.impresiones : null,
    clicsBusqueda: s ? s.actual.clics : null,
    ctr: s ? s.actual.ctr : null,
    posicion: s ? s.actual.posicion : null,
    cambio: {
      usuarios: g ? pct(g.actual.usuarios, g.previo.usuarios) : null,
      clicsTienda: g ? pct(g.actual.clicsTienda, g.previo.clicsTienda) : null,
      impresiones: s ? pct(s.actual.impresiones, s.previo.impresiones) : null,
      clicsBusqueda: s ? pct(s.actual.clics, s.previo.clics) : null
    }
  };
}

const txt = JSON.stringify(salida, null, 2);
if (DRY) console.log(txt);
else {
  fs.writeFileSync(SALIDA, txt + '\n');
  console.log('Escrito ' + path.relative(RAIZ, SALIDA) + ' · estado ' + salida.estado);
}
salida.errores.forEach((e) => console.error('  ! ' + e.donde + ': ' + e.mensaje));
process.exit(salida.estado === 'error' ? 1 : 0);
