#!/usr/bin/env node
/**
 * generar-ofertas.js — arma la página /ofertas/: una fila por categoría con los productos
 * que BAJARON de precio en los últimos 30 días.
 *
 * Qué cuenta como oferta de los últimos 30 días (no se inventa nada):
 *   1. Bajada vigente de la base (`mejorBajada` de _ofertas.js): el precio de Mercado Libre
 *      está por debajo de `_precioMLAntes` y la racha tiene menos de 30 días. Es la MISMA
 *      bajada que ya anuncian las tarjetas de cada categoría, con el mismo "antes".
 *   2. Si no hay racha viva, el histórico de 30 días (assets/data/historico/<cat>.json):
 *      el precio de hoy está debajo del MÁXIMO del periodo por al menos PCT_MIN %.
 *      Se exige serie graficable (>= 7 registros) y sin saltos atípicos, porque un salto
 *      atípico casi siempre es un mlId mal asignado, no una bajada real.
 * En los dos casos el producto tiene que seguir vendible (`vendible` + `publicado`), con
 * link de Mercado Libre y precio: una oferta no sobrevive a la baja del producto.
 *
 * Escribe:
 *   · ofertas/index.html            entre marcadores (resumen, índice, secciones, datos)
 *   · assets/data/historico/ofertas.json  histórico recortado a los productos de la página,
 *     con claves "<categoria>:<id>" (los ids se repiten entre categorías), para que la página
 *     baje UN archivo en vez de los 24 de /assets/data/historico/.
 *
 * Uso: node scripts/generar-ofertas.js [--dry-run]
 * Corre en update-prices.yml después de generar-historico.js y sync-pausas.js.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mejorBajada, publicado, vendible, DIAS_OFERTA_ML } from './_ofertas.js';
import { clavesDeDatos, principalDe, paginasDe, tituloDe } from './categorias.js';
import { nombresDe } from './_nombres.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

/** Bajada mínima para publicar una oferta que sale del histórico (no de la racha de la base). */
const PCT_MIN = 3;
/** Tarjetas por fila/categoría en el HTML. El resto se ve en la página de la categoría. */
const TOPE = 8;

/* ── Grupos del índice ────────────────────────────────────────────────────────
   Solo presentación: una categoría registrada en scripts/categorias.js que no esté aquí
   entra sola al grupo "Más categorías" con la URL de su página. Nada se queda fuera. */
const GRUPOS = [
  { id: 'celulares', titulo: 'Celulares', icono: '📱', cats: ['celulares_android', 'celulares_iphone'] },
  { id: 'computo', titulo: 'Cómputo', icono: '💻', cats: ['laptops'] },
  { id: 'electro', titulo: 'Electrodomésticos', icono: '🏠', cats: ['freidoras', 'microondas', 'cafeteras', 'refrigeradores', 'lavadoras', 'ollas'] },
  { id: 'tecnologia', titulo: 'Tecnología', icono: '⌚', cats: ['tecnologia_smartwatches', 'tecnologia_audifonos', 'tecnologia_bocinas', 'streaming'] },
  { id: 'suplementos', titulo: 'Suplementos', icono: '💪', cats: ['proteina', 'creatina', 'omega3', 'magnesio', 'complejo_b', 'vitamina_d'] },
  { id: 'videojuegos', titulo: 'Videojuegos', icono: '🎮', cats: ['videojuegos_consolas', 'videojuegos_controles', 'videojuegos_juegos'] },
  { id: 'bicis', titulo: 'Bicicletas', icono: '🚲', cats: ['bicis', 'bicisMontana', 'bicisGravelRuta'] },
  { id: 'otras', titulo: 'Más categorías', icono: '🏷️', cats: [] },
];

/** Páginas dedicadas que son mejor destino que el hub compartido. */
const URL_FIJA = {
  bicis: '/bicicletas/bici-electricas/',
  bicisMontana: '/bicicletas/bici-montana/',
  bicisGravelRuta: '/bicicletas/bici-gravel/',
};

/* ── Características ─────────────────────────────────────────────────────────
   La mayoría de las categorías traen `especs`; refrigeradores, ollas y lavadoras guardan sus
   características sueltas en el producto. Se muestran hasta 5 por tarjeta, en este orden. */
const ETIQUETAS = {
  pantalla: 'Pantalla', ram: 'RAM', almacenamiento: 'Almacenamiento', cam: 'Cámara', chip: 'Procesador',
  bateria: 'Batería', nfc: 'NFC', hz: 'Refresco', procesador: 'Procesador', disco: 'Almacenamiento',
  pulgadas: 'Pantalla', tarjeta: 'Gráficos', capacidad: 'Capacidad', potencia: 'Potencia', litros: 'Capacidad',
  tipo: 'Tipo', material: 'Material', presion: 'Presión', vaporizador: 'Vaporizador', molinillo: 'Molinillo',
  compatibilidad: 'Compatibilidad', gps: 'GPS', bluetooth: 'Bluetooth', cancelacion: 'Cancelación de ruido',
  resolucion: 'Resolución', plataforma: 'Plataforma', formato: 'Formato', genero: 'Género', anio: 'Año',
  desarrollador: 'Desarrollador', multijugador: 'Multijugador', generacion: 'Generación',
  tipoConsola: 'Tipo', lectorDiscos: 'Lector de discos', formatoJuegos: 'Formato', accesorios: 'Accesorios',
  condicion: 'Condición', sabor: 'Sabor', porciones: 'Porciones', proteinaPorPorcion: 'Proteína por porción',
  tipoProteina: 'Tipo de proteína', tipoCreatina: 'Tipo de creatina', presentacion: 'Presentación',
  contenidoGramos: 'Contenido', grPorPorcion: 'Gramos por porción', costoPor5g: 'Costo por 5 g', pura: 'Pura',
  epa: 'EPA', dha: 'DHA', mg: 'Miligramos', dosis: 'Dosis', vitaminas: 'Vitaminas', ui: 'UI',
  motor: 'Motor', autonomia: 'Autonomía', velocidades: 'Velocidades', rodada: 'Rodada', suspension: 'Suspensión',
  frenos: 'Frenos', cuadro: 'Cuadro', peso: 'Peso', bateriaWh: 'Batería',
  capacidadTotal: 'Capacidad', capacidadL: 'Capacidad', puertas: 'Puertas', conFreezer: 'Congelador',
  dispensadorHielo: 'Dispensador de hielo', dimensiones: 'Dimensiones', potenciaW: 'Potencia',
  programable: 'Programable', mantenerCaliente: 'Mantener caliente', displayDigital: 'Display digital',
  tapaMaterial: 'Tapa', color: 'Color', capacidadKg: 'Capacidad', tinas: 'Tinas', profundidad: 'Profundidad',
};
/** Características sueltas (sin `especs`) que sí se muestran, por categoría. */
const PLANAS = {
  refrigeradores: ['capacidadTotal', 'puertas', 'conFreezer', 'dispensadorHielo', 'dimensiones'],
  ollas: ['capacidadL', 'potenciaW', 'material', 'programable', 'mantenerCaliente'],
  lavadoras: ['capacidadKg', 'tipo', 'tinas', 'profundidad'],
};
/** Icono de la lista de características según la etiqueta (los dibuja cmx-ofertas.js). */
const ICONOS = {
  Pantalla: 'screen', Batería: 'battery', GPS: 'gps', NFC: 'nfc', RAM: 'tag', Almacenamiento: 'tag',
  Cámara: 'tag', Procesador: 'tag', Capacidad: 'tag', Potencia: 'tag', Tipo: 'tag',
};

const etiqueta = (k) => ETIQUETAS[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase());
const valor = (v) => (v === true ? 'Sí' : v === false ? 'No' : v == null || v === '' ? null : String(v));

function especsDe(cat, p) {
  const out = [];
  const src = p.especs && typeof p.especs === 'object' ? p.especs : null;
  if (src) {
    for (const [k, v] of Object.entries(src)) {
      const val = valor(v);
      if (val) out.push([etiqueta(k), val]);
    }
  }
  for (const k of PLANAS[cat] || []) {
    const val = valor(p[k]);
    if (val) out.push([etiqueta(k), val]);
  }
  return out.slice(0, 5);
}

/* ── Utilidades ──────────────────────────────────────────────────────────────── */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const money = (n) => '$' + Math.round(n).toLocaleString('es-MX');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "2026-11-18" → "18 de noviembre" (sin new Date(): las fechas ISO se corren un día por zona horaria). */
const fechaLarga = (f) => {
  const p = String(f || '').split('-');
  return p.length === 3 ? `${+p[2]} de ${MESES[+p[1] - 1]}` : '';
};
/* Los iconos se escriben UNA vez como <symbol> al inicio de las secciones y las tarjetas los
   reusan con <use>. Con 227 tarjetas, repetir el SVG completo pesaba medio mega de más. */
const svg = (d, n = 16, sw = 2) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ic = (name, n = 16) => `<svg width="${n}" height="${n}" aria-hidden="true"><use href="#of-i-${name}"/></svg>`;
function sprite() {
  const uno = (k) => `<symbol id="of-i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</symbol>`;
  return `<svg class="of-sprite" aria-hidden="true" focusable="false">${Object.keys(IC).map(uno).join('')}</svg>`;
}
const IC = {
  chart: '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="12" width="3.5" height="7"/><rect x="10.2" y="7" width="3.5" height="12"/><rect x="15.4" y="14" width="3.5" height="5"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/><rect x="5" y="10" width="6" height="4" fill="currentColor" stroke="none"/>',
  gps: '<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  nfc: '<path d="M5 12a7 7 0 0 1 7-7"/><path d="M8.5 12A3.5 3.5 0 0 1 12 8.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M19 12a7 7 0 0 1-7 7"/><path d="M15.5 12a3.5 3.5 0 0 1-3.5 3.5"/>',
};

function bloque(html, nombre, contenido) {
  const re = new RegExp(`(<!-- ofertas:${nombre}:start -->)[\\s\\S]*?(<!-- ofertas:${nombre}:end -->)`);
  if (!re.test(html)) throw new Error(`ofertas/index.html: falta el marcador ofertas:${nombre}`);
  return html.replace(re, (m, a, b) => a + '\n' + contenido + '\n' + b);
}

/* ── Datos ───────────────────────────────────────────────────────────────────── */
const merged = JSON.parse(readFileSync(join(ROOT, 'scripts/merged-admin.json'), 'utf8'));
const histCache = {};
function historico(cat) {
  if (!(cat in histCache)) {
    const f = join(ROOT, 'assets/data/historico', cat + '.json');
    try { histCache[cat] = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; }
    catch { histCache[cat] = null; }
  }
  return histCache[cat];
}
const graficable = (d) => !!(d && d.p && d.p.length && d.estado !== 'nuevo' && d.estado !== 'insuficiente');

/** La oferta de un producto, o null. */
function ofertaDe(cat, p, h) {
  if (!(vendible(p) && publicado(p))) return null;
  if (!p.linkML || typeof p.precioML !== 'number' || !(p.precioML > 0)) return null;
  const d = h && h.productos ? h.productos[String(p.id)] : null;
  const b = mejorBajada(p);
  let antes = null, fecha = null, origen = null;
  if (b && b.plataforma === 'ml') {
    antes = b.antes; fecha = p._precioMLFecha || null; origen = 'racha';
  } else if (graficable(d) && !(d.atipicos && d.atipicos.length) && d.max > d.actual) {
    const pct = ((d.max - d.actual) / d.max) * 100;
    if (pct < PCT_MIN) return null;
    antes = d.max; fecha = d.actualFecha || null; origen = 'max30';
  } else return null;
  // El "antes" se compara siempre contra el precio publicado de hoy.
  if (!(antes > p.precioML)) return null;
  const ahorro = Math.round(antes - p.precioML);
  const pct = Math.round(((antes - p.precioML) / antes) * 100);
  if (pct < 1) return null;
  return {
    id: String(p.id), nombre: p.nombre, marca: p.marca || null,
    imagen: p.imagen || p.img || '', link: p.linkML, precio: p.precioML,
    antes, ahorro, pct, fecha, origen,
    especs: especsDe(cat, p),
    hist: graficable(d) ? { min: d.min, minFecha: d.minFecha, max: d.max, maxFecha: d.maxFecha, var: d.var, n: d.n } : null,
    // Un salto atípico en la serie casi siempre es un cambio de la oferta de referencia del
    // catálogo, no una rebaja del vendedor. La oferta se publica igual (es el mismo dato que
    // muestra la categoría), pero va al final de la fila para no encabezarla.
    atipico: !!(d && d.atipicos && d.atipicos.length),
  };
}

/** Las categorías con ofertas, agrupadas y ordenadas para la página. */
function recolectar() {
  const porCat = {};
  for (const cat of clavesDeDatos()) {
    const lista = merged[cat];
    if (!Array.isArray(lista) || !lista.length) continue;
    const h = historico(cat);
    const items = [];
    for (const p of lista) {
      const o = ofertaDe(cat, p, h);
      if (o) items.push(o);
    }
    if (!items.length) continue;
    items.sort((a, b) => (a.atipico ? 1 : 0) - (b.atipico ? 1 : 0) || b.pct - a.pct || b.ahorro - a.ahorro);
    const pag = principalDe(cat) || paginasDe(cat)[0];
    const url = URL_FIJA[cat] || '/' + (pag ? pag.file.replace(/index\.html$/, '') : '');
    const [uno, muchos] = nombresDe(cat, tituloDe(cat));
    porCat[cat] = { cat, titulo: tituloDe(cat), url, uno, muchos, items, total: items.length };
  }

  const usadas = new Set();
  const grupos = [];
  for (const g of GRUPOS) {
    const cats = (g.id === 'otras'
      ? Object.keys(porCat).filter((c) => !usadas.has(c))
      : g.cats.filter((c) => porCat[c]));
    cats.forEach((c) => usadas.add(c));
    const secciones = cats.map((c) => porCat[c]).sort((a, b) => b.total - a.total);
    if (secciones.length) grupos.push({ ...g, secciones });
  }
  return grupos;
}

/* ── HTML ────────────────────────────────────────────────────────────────────── */
function tarjeta(sec, o) {
  const name = esc(o.nombre);
  const specs = o.especs.length
    ? o.especs.map(([l, v]) => `<li>${ic(IC[ICONOS[l]] ? ICONOS[l] : 'tag', 15)}<span><b>${esc(l)}:</b> ${esc(v)}</span></li>`).join('')
    : '<li class="is-none">Especificaciones no disponibles</li>';
  const nota = o.origen === 'racha'
    ? `Bajó${o.fecha ? ' el ' + esc(fechaLarga(o.fecha)) : ''} desde ${esc(money(o.antes))}`
    : `Debajo de su máximo de 30 días (${esc(money(o.antes))})`;
  const minimo = o.hist ? `<span class="of-min">Mínimo 30 días: <b>${esc(money(o.hist.min))}</b></span>` : '';
  const histBtn = o.hist
    ? `<button type="button" class="cl-hist-b" data-hist="${esc(sec.cat + ':' + o.id)}">${ic('chart', 16)}<span class="lg">Histórico de precio · 30 días</span><span class="sm">Histórico · 30 días</span>${ic('arrow', 15)}</button>`
    : '';
  return `<article class="cl-card" data-id="${esc(o.id)}" data-cat="${esc(sec.cat)}">`
    + `<div class="cl-card-top"><button type="button" class="cl-cmp" data-pick aria-pressed="false" aria-label="Comparar: ${name}"><i></i>Comparar</button>`
    + `<button type="button" class="cl-fav" data-fav aria-pressed="false" aria-label="Guardar en favoritos: ${name}">${ic('heart', 22)}</button></div>`
    + `<span class="cl-drop">&#8722;${o.pct}% · Bajó ${esc(money(o.ahorro))}</span>`
    + `<div class="cl-card-img"><img src="${esc(o.imagen)}" alt="${name}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`
    + `<h3 class="cl-card-name">${name}</h3>`
    + `<ul class="cl-specs">${specs}</ul>`
    + `<div class="cl-price"><div class="cl-price-store"><img class="cl-ml-ic" src="/logomercado-ic.png" alt=""><span>Mercado<br>Libre</span></div>`
    + `<div class="cl-price-row"><strong>${esc(money(o.precio))} MXN</strong><s>${esc(money(o.antes))} MXN</s></div>`
    + `<p class="of-note">${nota}</p>${minimo}`
    + `<a class="cl-btn-ml" href="${esc(o.link)}" target="_blank" rel="sponsored nofollow noopener" data-n="${name}" data-v="${o.precio}"><img class="cl-ml-ic" src="/logomercado-ic.png" alt=""><span class="lg">Ver en Mercado Libre</span><span class="sm">Ver en ML</span> <span aria-hidden="true">&#8599;</span></a></div>`
    + `${histBtn}</article>`;
}

function seccion(sec) {
  const n = sec.total;
  const mostrados = sec.items.slice(0, TOPE);
  const pctMaxSec = Math.max(...sec.items.map((o) => o.pct));
  const ahorroMax = Math.max(...sec.items.map((o) => o.ahorro));
  const lead = `${n === 1 ? 'Hay 1' : 'Hay ' + n} ${n === 1 ? sec.uno : sec.muchos} con bajada de precio en los últimos 30 días`
    + `: la mayor es de ${pctMaxSec} % y el mayor ahorro, ${money(ahorroMax)}.`;
  const resto = n > mostrados.length
    ? `<a class="of-all" href="${esc(sec.url)}#bajadas">Ver ${n - mostrados.length} más en ${esc(sec.titulo)} ${svg(IC.arrow, 15, 2.6)}</a>`
    : '';
  return `<section class="of-sec" id="of-${esc(sec.cat)}" data-cat="${esc(sec.cat)}" aria-labelledby="of-h-${esc(sec.cat)}">`
    + `<header class="of-sec-hd"><div><h2 id="of-h-${esc(sec.cat)}">${esc(sec.titulo)} <em>${n} ${n === 1 ? 'oferta' : 'ofertas'}</em></h2>`
    + `<p class="of-sec-lead">${esc(lead)}</p></div>`
    + `<a class="of-sec-link" href="${esc(sec.url)}">Ver todos los ${esc(sec.muchos)} ${svg(IC.arrow, 15, 2.6)}</a></header>`
    + `<div class="of-row-wrap"><button type="button" class="of-nav of-prev" data-nav="-1" aria-label="Ver ofertas anteriores de ${esc(sec.titulo)}">‹</button>`
    + `<div class="of-row" role="list">${mostrados.map((o) => tarjeta(sec, o)).join('')}${resto ? `<div class="of-more-card" role="listitem">${resto}</div>` : ''}</div>`
    + `<button type="button" class="of-nav of-next" data-nav="1" aria-label="Ver más ofertas de ${esc(sec.titulo)}">›</button></div>`
    + `<div class="of-sec-foot"><p class="of-pick">Elige de 2 a 3 ${esc(sec.muchos)} de esta fila para compararlos entre sí.</p>`
    + `<button type="button" class="of-cmp-btn" data-cmp="${esc(sec.cat)}" disabled>Comparar ${esc(sec.muchos)} elegidos ${svg(IC.arrow, 16, 2.6)}</button></div>`
    + `</section>`;
}

function indice(grupos) {
  return grupos.map((g) => `<div class="of-ix-g"><h3><span aria-hidden="true">${g.icono}</span> ${esc(g.titulo)}</h3><ul>`
    + g.secciones.map((s) => `<li><a href="#of-${esc(s.cat)}" data-ix="of-${esc(s.cat)}">${esc(s.titulo)} <em>${s.total}</em></a></li>`).join('')
    + '</ul></div>').join('');
}

/* ── Histórico recortado ─────────────────────────────────────────────────────── */
function historicoOfertas(grupos) {
  const cats = grupos.flatMap((g) => g.secciones.map((s) => s.cat));
  const base = cats.map(historico).filter(Boolean)
    .slice().sort((a, b) => (b.fechas || []).length - (a.fechas || []).length)[0];
  if (!base) return null;
  const clave = (base.fechas || []).join();
  const productos = {};
  let fuera = 0;
  for (const g of grupos) for (const s of g.secciones) {
    const h = historico(s.cat);
    if (!h || (h.fechas || []).join() !== clave) { if (h) fuera++; continue; }
    for (const o of s.items.slice(0, TOPE)) {
      const d = h.productos[o.id];
      if (graficable(d)) productos[s.cat + ':' + o.id] = d;
    }
  }
  if (fuera) console.log(`  aviso: ${fuera} categoría(s) con otra ventana de fechas quedaron sin histórico en la página`);
  return { generado: base.generado, ventana: base.ventana, desde: base.desde, hasta: base.hasta, fechas: base.fechas, productos };
}

/* ── Salida ──────────────────────────────────────────────────────────────────── */
const grupos = recolectar();
const secciones = grupos.flatMap((g) => g.secciones);
const totalProd = secciones.reduce((n, s) => n + s.total, 0);
const totalEnPagina = secciones.reduce((n, s) => n + Math.min(s.total, TOPE), 0);
const ahorroMax = secciones.length ? Math.max(...secciones.flatMap((s) => s.items.map((o) => o.ahorro))) : 0;
const pctMax = secciones.length ? Math.max(...secciones.flatMap((s) => s.items.map((o) => o.pct))) : 0;
const hoy = new Date().toISOString().slice(0, 10);

const hist = historicoOfertas(grupos);

const resumen = `<p class="of-sum">`
  + `<span><b>${totalProd}</b> productos bajaron de precio</span>`
  + `<span><b>${secciones.length}</b> categorías con ofertas</span>`
  + `<span>Hasta <b>&#8722;${pctMax} %</b> de bajada</span>`
  + `<span>Mayor ahorro: <b>${money(ahorroMax)}</b></span>`
  + `</p>`
  // Una sola línea: el hero tiene que dejar ver las ofertas sin bajar. El detalle (cómo se
  // detecta la bajada, qué entra y qué no) está en los bloques de texto debajo de las filas.
  + `<p class="of-upd">Revisado el ${fechaLarga(hoy)} de ${hoy.slice(0, 4)} · ${totalEnPagina} ofertas aquí, hasta ${TOPE} por categoría`
  + ` · <a href="#of-intro-h">cómo las detectamos</a></p>`;

const datos = '<script type="application/json" id="of-data">' + JSON.stringify({
  generadoEn: new Date().toISOString(), ventana: DIAS_OFERTA_ML, tope: TOPE,
  categorias: secciones.map((s) => ({
    c: s.cat, t: s.titulo, u: s.url, n: s.total, uno: s.uno, muchos: s.muchos,
    items: s.items.slice(0, TOPE).map((o) => ({
      i: o.id, n: o.nombre, b: o.marca, g: o.imagen, l: o.link, p: o.precio, a: o.antes,
      d: o.pct, s: o.ahorro, f: o.fecha, o: o.origen,
      e: o.especs, h: hist && hist.productos[s.cat + ':' + o.id] ? 1 : 0,
      m: o.hist ? o.hist.min : null, x: o.hist ? o.hist.max : null, v: o.hist ? o.hist.var : null,
    })),
  })),
}).replace(/</g, '\\u003c') + '</script>';

const pagina = join(ROOT, 'ofertas/index.html');
let html = readFileSync(pagina, 'utf8');
html = bloque(html, 'resumen', resumen);
html = bloque(html, 'indice', indice(grupos));
html = bloque(html, 'secciones', sprite() + '\n' + secciones.map(seccion).join('\n'));
html = bloque(html, 'datos', datos);

if (DRY) {
  console.log('(dry-run, no se escribió nada)');
} else {
  writeFileSync(pagina, html);
  if (hist) writeFileSync(join(ROOT, 'assets/data/historico/ofertas.json'), JSON.stringify(hist) + '\n');
}

console.log(`ofertas: ${totalProd} productos con bajada en ${secciones.length} categorías (${totalEnPagina} en la página)`);
for (const g of grupos) {
  console.log(`  ${g.titulo}`);
  for (const s of g.secciones) console.log('    ' + s.cat.padEnd(24) + String(s.total).padStart(4) + '  ' + s.url);
}
if (hist) console.log(`  histórico recortado: ${Object.keys(hist.productos).length} productos`);
