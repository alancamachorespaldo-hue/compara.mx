#!/usr/bin/env node
/**
 * descubrir-catalogo.mjs — busca en el CATÁLOGO de Mercado Libre productos de una categoría que
 * todavía no tenemos y los deja en una bandeja aparte (`scripts/bandeja-nuevos.json`), apagados
 * y sin tocar nada del sitio.
 *
 * POR QUÉ ESTE CAMINO Y NO OTRO (prueba real del 25-nov-2026, con las credenciales del repo):
 *   ✓ 200  /products/search?site_id=MLM&q=…   descubre productos de CATÁLOGO, con atributos
 *   ✓ 200  /products/{id}                      ficha: imágenes, variantes, descripción, status
 *   ⛔ 403  /sites/MLM/search                   buscar PUBLICACIONES de vendedores — cerrado
 *   ⛔ 403  /products/{id}/items                ofertas y PRECIOS — cerrado (PolicyAgent)
 * O sea: la API sirve para DESCUBRIR e identificar, no para precios. El precio lo sigue sacando
 * `precios-por-link.mjs` de la página del enlace de afiliado, que es lo único que hoy lo da. Por
 * eso un producto de la bandeja no puede publicarse sin que Alan le pegue antes su enlace.
 *
 * LÍMITES MEDIDOS DE LA API (no supuestos):
 *   · `offset` máximo = 100 (con 150 responde 400), así que son ~150 productos por término.
 *     `paging.total` dice 10000 y es mentira. La cobertura se gana con MÁS TÉRMINOS.
 *   · `limit` hasta 50 cómodo.
 *   · `category_id` y `domain_id` se aceptan pero no filtran de verdad: el filtro lo hacemos
 *     aquí sobre el `domain_id` de cada resultado.
 *   · ~45% del catálogo viene `status:"inactive"`: se descarta.
 *
 * DE DÓNDE SALEN LOS CANDIDATOS (dos fuentes, y la diferencia importa):
 *   · `ranking`  — `/highlights/MLM/category/{id}`, los más vendidos de la categoría. Un producto
 *     que está en ese ranking SE ESTÁ VENDIENDO, así que tiene vendedor y stock. De los 21
 *     catálogos que la revisión tenía marcados como pausados, 0 aparecen ahí (medido el
 *     26-nov-2026). Es la única señal de disponibilidad que queda abierta. Da unos 20 productos
 *     por categoría: poco, pero todo aprovechable.
 *   · `busqueda` — `/products/search`, que trae cientos pero SIN saber si se venden; ahí caen los
 *     «no disponible por el momento» (8 de cada 10 en la muestra que revisó Alan).
 * Cada ficha guarda su `fuente`, las del ranking van primero y el Centro las marca «se vende hoy».
 *
 * LO QUE NO PODEMOS SABER AQUÍ: si un producto de la BÚSQUEDA tiene vendedor y stock hoy. Se
 * probó por cuatro caminos y ninguno sirve: `/products/{id}/items` responde 403;
 * `buy_box_winner` viene `null` incluso para el nº1 en ventas, con token de usuario y de
 * aplicación; ningún campo de `/products/{id}` separa 21 pausados de 199 vivos (status, tags,
 * quality_type, ttr y last_updated se solapan por completo); y la ficha pública `/p/MLM…`
 * contesta con el muro de tráfico sospechoso de ML en vez de la página. `status:"active"` del
 * catálogo solo dice que la FICHA existe, no que alguien lo venda. Dónde sí se sabe: al publicar,
 * cuando `aplicar-nuevos.mjs` abre el enlace de afiliado —ahí el precio y la pausa son visibles—
 * y un producto sin stock se queda fuera.
 *
 * LO QUE NUNCA HACE: no escribe en merged-admin.json, no toca ninguna página, no publica nada.
 * Eso es cosa de `aplicar-nuevos.mjs`, y solo con lo que Alan aprueba en el Centro de Control.
 *
 * Uso:
 *   node scripts/descubrir-catalogo.mjs --categoria=proteina
 *   node scripts/descubrir-catalogo.mjs --categoria=proteina --aplicar
 *   node scripts/descubrir-catalogo.mjs --todas --aplicar --tope=200
 *
 * Opciones:
 *   --categoria=a,b   categorías a buscar (tienen que tener `descubrir` en categorias.js)
 *   --todas           todas las que lo tengan
 *   --aplicar         escribe la bandeja y el historial (sin esto solo informa)
 *   --tope=N          máximo de productos NUEVOS que se guardan por corrida (0 = sin tope, 150)
 *   --paginas=N       páginas de 50 por término (1-3; la API no deja más, 3)
 *   --fuente=X        ranking (solo los más vendidos, de los que sabemos que se venden) |
                     busqueda | ambas (por defecto)
   --concurrencia=N  fichas en paralelo (4)
 *   --terminos=a|b    términos a mano, en vez de los de categorias.js
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { entradas, conDescubrir } from './categorias.js';
import { leerArray } from './_html-precios.js';
import { resolverFamilia, gbDeTexto } from './_familias-alta.js';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://api.mercadolibre.com';
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const BANDEJA_PATH = resolve(ROOT, 'scripts/bandeja-nuevos.json');
const LOG_PATH = resolve(ROOT, 'scripts/busquedas-catalogo.json');
const MAX_HISTORIAL = 60;

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const TODAS = process.argv.includes('--todas');
const APLICAR = process.argv.includes('--aplicar');
const TOPE = arg('tope') != null ? Number(arg('tope')) : 150;
const PAGINAS = Math.min(Math.max(Number(arg('paginas') ?? 3), 1), 3);
const CONC = Number(arg('concurrencia') ?? 4);
const TERMINOS_ARG = (arg('terminos') ?? '').split('|').map(s => s.trim()).filter(Boolean);
const FUENTE = arg('fuente') ?? 'ambas';   // ranking | busqueda | ambas
const CATS_ARG = (arg('categoria') ?? '').split(',').map(s => s.trim()).filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const leerJSON = (p, def) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : def);

// ── normalización y comparación ──────────────────────────────────────────────
const norm = s => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** "2.27 kg" | "480 g" | "5 lb" → gramos. null si no se entiende: no se inventa. */
function aGramos(txt) {
  const m = String(txt ?? '').replace(',', '.').match(/([\d.]+)\s*(kg|g|gr|lb|lbs|oz)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const u = m[2].toLowerCase();
  if (u === 'kg') return Math.round(n * 1000);
  if (u === 'lb' || u === 'lbs') return Math.round(n * 453.592);
  if (u === 'oz') return Math.round(n * 28.3495);
  return Math.round(n);
}
const aNumero = txt => {
  const m = String(txt ?? '').replace(',', '.').match(/[\d.]+/);
  const n = m ? parseFloat(m[0]) : NaN;
  return isFinite(n) ? n : null;
};
const aBool = txt => (/^s[ií]$/i.test(String(txt ?? '').trim()) ? true
  : /^no$/i.test(String(txt ?? '').trim()) ? false : null);

/**
 * "1300 W" | "1.4 kW" → 1300 / 1400. En watts, SIEMPRE.
 * Existe porque la API mezcla las dos unidades en el mismo atributo —de 49 microondas, 8 traen
 * «1.1 kW» y 9 «700 W»— y leer el número a secas dejaba un microondas de 1.1 W en la base.
 */
function aWatts(txt) {
  const m = String(txt ?? '').replace(',', '.').match(/([\d.]+)\s*(kw|w)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(m[2].toLowerCase() === 'kw' ? n * 1000 : n);
}

const CLAVES_GRAMOS = new Set(['contenidoGramos', 'gramosPorPorcion', 'pesoNeto']);
const CLAVES_NUMERO = new Set(['porciones', 'potencia', 'capacidad',
  // Celulares: la página pinta estos tres como números (6.3 pulgadas, 48 MP, 120 Hz) y la
  // API los da con su unidad pegada («6.3 "», «48 Mpx», «120 Hz»).
  'pantalla', 'camPrincipal', 'hz']);
const CLAVES_BOOL = new Set(['vegana', 'glutenFree', 'sugarFree', 'pura', 'organico']);

/** "Carga frontal" → "carga-frontal". El estilo de las claves que las páginas usan para filtrar. */
const aSlug = txt => String(txt ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Atributos de ML → claves del esquema `especs` de la categoría, con su conversión.
 *
 * TRES COSAS QUE DECIDE LA CATEGORÍA, no este script (todas en su bloque `descubrir`):
 *   · `mapa`     atributo de ML → clave (o VARIAS claves: `TOTAL_CAPACITY: ['capacidadTotal',
 *                'capacidadL']`, que es el mismo dato guardado como texto y como número, tal
 *                como ya está en refrigeradores).
 *   · `tipos`    cómo se guarda cada clave: 'texto' | 'numero' | 'gramos' (número en g) |
 *                'gramosTexto' ("2270 g") | 'bool' | 'slug' | 'watts' (número en W) |
 *                'wattsTexto' ("1400 W"). Los de unidad normalizan: la API mezcla «2.27 kg» con
 *                «450 g» y «1.4 kW» con «1400 W» en el mismo atributo.
 *                Hace falta porque la MISMA clave se guarda distinto según la categoría: en
 *                celulares `pantalla` es el número 6.3 y en laptops y smartwatches es el texto
 *                '15.6"'; `contenidoGramos` es número en proteína y "450 g" en creatina. Sin
 *                esto, los nombres de clave globales de abajo decidían por todas y escribían el
 *                formato de una categoría en la base de otra.
 *   · `valores`  vocabulario CERRADO de una clave que la página usa para filtrar: { valor de ML
 *                normalizado → valor del sitio }. Lo que no esté en la tabla NO SE ESCRIBE y
 *                sale en rojo en el Centro para llenarlo a mano. Es a propósito: el filtro de
 *                «formato» de audífonos conoce In-ear/On-ear/Over-ear, así que meterle el
 *                "Diadema" de ML no llena el dato, esconde el producto de su propio filtro.
 */
function mapearEspecs(attrs, cfg = {}) {
  const { mapa, tipos = {}, valores = {} } = cfg;
  const out = {};
  for (const [idAttr, destino] of Object.entries(mapa ?? {})) {
    const v = attrs[idAttr];
    if (v == null || v === '' || v === '-') continue;
    for (const clave of [].concat(destino)) {
      const tipo = tipos[clave] ?? (CLAVES_GRAMOS.has(clave) ? 'gramos'
        : CLAVES_NUMERO.has(clave) ? 'numero'
        : CLAVES_BOOL.has(clave) ? 'bool' : 'texto');
      let val = tipo === 'gramos' ? aGramos(v)
        : tipo === 'numero' ? aNumero(v)
        : tipo === 'bool' ? aBool(v)
        : tipo === 'slug' ? aSlug(v)
        : tipo === 'gramosTexto' ? (aGramos(v) == null ? null : `${aGramos(v)} g`)
        : tipo === 'watts' ? aWatts(v)
        : tipo === 'wattsTexto' ? (aWatts(v) == null ? null : `${aWatts(v)} W`)
        : String(v);
      const tabla = valores[clave];
      if (tabla) val = Object.prototype.hasOwnProperty.call(tabla, norm(v)) ? tabla[norm(v)] : null;
      if (val == null || val === '') continue;
      out[clave] = val;
    }
  }
  return out;
}

// ── API ──────────────────────────────────────────────────────────────────────
let TOKEN = null, LLAMADAS = 0;
const ERRORES = [];

async function getToken() {
  const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secret, ML_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret) throw new Error('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  if (refresh) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh }),
    });
    if (r.ok) return (await r.json()).access_token;
    console.warn(`⚠ refresh_token falló (${r.status}) — se intenta client_credentials`);
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  return (await r.json()).access_token;
}

async function api(ruta, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    LLAMADAS++;
    let res;
    try {
      res = await fetch(API + ruta, {
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) { await sleep(800 * (i + 1)); continue; }
    if (res.ok) return { ok: true, data: await res.json() };
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** i); continue; }
    return { ok: false, status: res.status };
  }
  return { ok: false, status: 0 };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

const attrsDe = d => Object.fromEntries((d?.attributes ?? [])
  .map(a => [a.id, String(a.value_name ?? '').trim()])
  .filter(([, v]) => v && v !== '-'));

/** Los atributos tal como los enseña ML, para guardarlos crudos en `_mlAtributos`. */
const attrsLegibles = d => Object.fromEntries((d?.attributes ?? [])
  .map(a => [String(a.name ?? '').trim(), String(a.value_name ?? '').trim()])
  .filter(([k, v]) => k && v && v !== '-'));

// ── descubrimiento de una categoría ──────────────────────────────────────────
async function descubrir(cat, base, bandejaPrevia) {
  const cfg = cat.descubrir;
  const terminos = TERMINOS_ARG.length ? TERMINOS_ARG : cfg.terminos;
  const crudos = new Map();
  const porTermino = [];

  // ── fuente 1: el ranking de más vendidos (los que SÍ se venden) ──
  const rankings = [];
  if (FUENTE !== 'busqueda') {
    for (const catML of cfg.categoriasML ?? []) {
      const r = await api(`/highlights/MLM/category/${catML}`);
      if (!r.ok) { ERRORES.push({ ranking: catML, status: r.status }); continue; }
      const ids = (r.data?.content ?? []).filter(x => x.type === 'PRODUCT');
      rankings.push({ categoria: catML, productos: ids.length });
      // El ranking solo da el id, así que la ficha se pide aparte.
      const fichas = await pool(ids, CONC, async x => (await api(`/products/${x.id}`)).data ?? null);
      fichas.forEach((d, i) => {
        if (!d) return;
        crudos.set(d.id, { ...d, _termino: `más vendidos ${catML}`, _fuente: 'ranking', _pos: ids[i].position ?? i });
      });
    }
  }

  // ── fuente 2: la búsqueda por términos (mucho más, pero sin saber si se venden) ──
  if (FUENTE !== 'ranking') for (const q of terminos) {
    let n = 0, err = null;
    for (let p = 0; p < PAGINAS; p++) {
      const off = p * 50;
      const r = await api(`/products/search?site_id=MLM&q=${encodeURIComponent(q)}&limit=50&offset=${off}`);
      if (!r.ok) { err = r.status; ERRORES.push({ termino: q, offset: off, status: r.status }); break; }
      const res = r.data?.results ?? [];
      // La posición en los resultados es lo más cerca que estamos de «qué tan buscado es»; se
      // guarda para ordenar la bandeja por ahí y no por cuántos atributos trae la ficha, que no
      // tiene nada que ver con que el producto se venda.
      res.forEach((it, i) => { n++; if (!crudos.has(it.id)) crudos.set(it.id, { ...it, _termino: q, _fuente: 'busqueda', _pos: off + i }); });
      if (res.length < 50) break;
    }
    porTermino.push({ termino: q, resultados: n, error: err });
  }

  // ── filtro de pertenencia a la categoría ──
  const dominios = new Set(cfg.dominios ?? []);
  const descartes = { inactivo: 0, dominio: 0, clase: 0 };
  const ejemplosDescarte = [];
  const relevantes = [];
  for (const it of crudos.values()) {
    if (it.status !== 'active') { descartes.inactivo++; continue; }
    if (dominios.size && !dominios.has(it.domain_id)) {
      descartes.dominio++;
      if (ejemplosDescarte.length < 8) ejemplosDescarte.push({ id: it.id, motivo: `dominio ${it.domain_id}`, nombre: it.name });
      continue;
    }
    if (cfg.clase) {
      const txt = cfg.clase.atributos.map(a => attrsDe(it)[a] ?? '').join(' ');
      if (!cfg.clase.rx.test(txt)) {
        descartes.clase++;
        if (ejemplosDescarte.length < 8) ejemplosDescarte.push({ id: it.id, motivo: `clase "${txt.trim() || '(sin clase)'}"`, nombre: it.name });
        continue;
      }
    }
    relevantes.push(it);
  }

  // ── duplicados contra la base y contra la bandeja ──
  const prods = base[cat.datos] ?? [];
  const porMlId = new Map(prods.filter(p => p.mlId).map(p => [p.mlId, p]));
  const porGtin = new Map();
  for (const p of prods) for (const g of [].concat(p.gtin ?? [])) if (g) porGtin.set(String(g).replace(/^0+/, ''), p);
  /* ── Categorías de FAMILIAS: el duplicado es «mismo modelo, misma capacidad» ───────────────
     En proteína cada catálogo es un producto distinto, así que basta comparar `mlId` y GTIN. En
     celulares no: Mercado Libre tiene varias fichas de catálogo del MISMO teléfono (la normal,
     la «sólo eSIM», la del distribuidor autorizado…), cada una con su propio MLM. Comparar solo
     el `mlId` dejaba la bandeja con 300 iPhones de los que ~9 de cada 10 eran el iPhone 17 Pro
     256 GB que ya está publicado, con otro número.
     Lo que de verdad identifica el teléfono en esta página es (familia, capacidad): si ya hay un
     iPhone 17 Pro de 512 GB en la página, otra ficha de iPhone 17 Pro de 512 GB es ese mismo
     teléfono y no cabe —`agregarVariantes` la rechazaría al publicar—, así que se cuenta como
     duplicado aquí y no se le hace perder el tiempo a nadie.
     Lo que NO se descarta: un modelo que no tiene familia en la página (un iPhone 15 Pro) o una
     capacidad que falta. Eso es justo lo que vale la pena descubrir, y se guarda con `_familia`
     apuntando a la familia que le toca —o a null, que significa «hay que escribir su familia
     antes de poder publicarlo»— para que el reporte y el alta lo digan sin volver a adivinar. */
  let familiasPagina = null;
  if (cat.tipo === 'familias') {
    const r = leerArray(resolve(ROOT, cat.file), cat.varName);
    if (!r.ok) {
      ERRORES.push({ pagina: cat.file, motivo: r.motivo });
      console.warn(`⚠ no se pudo leer ${cat.file} (${r.motivo}): no se podrá decir de qué familia es cada candidato`);
    } else familiasPagina = r.datos;
  }
  const yaEnPagina = new Set();
  if (familiasPagina) {
    for (const f of familiasPagina) {
      for (const v of f.variantes ?? []) if (v?.almacenamientoGB) yaEnPagina.add(`${f.modeloBase}|${v.almacenamientoGB}`);
    }
    // La base manda igual que la página: un producto puede estar en la base y oculto en la
    // página (pausado), y volver a descubrirlo no ayuda a nadie.
    for (const p of prods) {
      const gb = gbDeTexto(p.especs?.almacenamiento);
      const mb = p._modeloBase ?? null;
      if (mb && gb) yaEnPagina.add(`${mb}|${gb}`);
    }
  }
  /** (familia, capacidad) de un candidato, o null si no se puede saber. */
  const sitioEnPagina = (attrs, esp) => {
    if (!familiasPagina) return null;
    const fam = resolverFamilia(familiasPagina, { modelo: attrs.MODEL });
    const gb = gbDeTexto(esp.almacenamiento ?? attrs.INTERNAL_MEMORY);
    return { modeloBase: fam.ok ? fam.familia.modeloBase : null, gb, motivo: fam.ok ? null : fam.motivo };
  };

  /* La firma marca+características es un AVISO de posible duplicado, no un descarte, y cada
     categoría dice con qué claves se arma (`descubrir.firma`). Una categoría sin firma declarada
     no recibe ese aviso, a propósito: en iPhone esas claves no existen en la base, y una firma
     vacía casa con TODOS los productos de la categoría —marcaría cada candidato como duplicado
     de un iPhone al azar—. Lo que de verdad impide duplicar algo es el `mlId`, que sí se compara
     siempre, y en las páginas de familias, además, que esa capacidad ya exista en la familia. */
  const clavesFirma = cfg.firma ?? null;
  const firma = vals => (vals.slice(1).some(v => v !== '' && v != null) ? vals.join('|') : null);
  const firmaBase = p => firma([norm(p.marca), ...clavesFirma.map(k => norm(p.especs?.[k]))]);
  const porFirma = new Map(clavesFirma ? prods.map(p => [firmaBase(p), p]).filter(([f]) => f) : []);
  const yaEnBandeja = new Map((bandejaPrevia?.productos ?? []).map(p => [p.id, p]));

  const nuevos = [], duplicados = [], revisar = [];
  for (const it of relevantes) {
    const a = attrsDe(it);
    const gtins = (a.GTIN ?? '').split(/[,;]/).map(s => s.trim().replace(/^0+/, '')).filter(Boolean);
    const dupId = porMlId.get(it.id);
    const dupGtin = gtins.map(g => porGtin.get(g)).find(Boolean);
    if (dupId || dupGtin) {
      duplicados.push({ id: it.id, nombre: it.name, motivo: dupId ? 'mlId' : 'gtin', base: (dupId || dupGtin).id });
      continue;
    }
    const sitio = sitioEnPagina(a, mapearEspecs(a, cfg));
    if (sitio && sitio.modeloBase && sitio.gb && yaEnPagina.has(`${sitio.modeloBase}|${sitio.gb}`)) {
      duplicados.push({ id: it.id, nombre: it.name, motivo: 'modelo+capacidad', base: `${sitio.modeloBase} ${sitio.gb} GB` });
      continue;
    }
    // Firma marca+contenido+sabor: NO descarta, marca para revisión. Un sabor o un tamaño
    // distinto es otro producto; confundirlos sería peor que tener una tarjeta de más.
    const esp = mapearEspecs(a, cfg);
    const f = clavesFirma ? firma([norm(a.BRAND), ...clavesFirma.map(k => norm(esp[k]))]) : null;
    const posible = f ? porFirma.get(f) : null;
    const reg = { it, a, gtins, sitio, posible: posible ? { id: posible.id, nombre: posible.nombre } : null };
    if (posible) revisar.push(reg); else nuevos.push(reg);
  }

  // Orden: PRIMERO los del ranking de ventas —los únicos de los que sabemos que tienen vendedor—
  // y después los de búsqueda por su posición en los resultados. Hasta el 26-nov-2026 se ordenaba
  // por número de atributos, que no dice nada sobre si el producto se vende: por eso los primeros
  // de la bandeja salían «no disponible» 8 de cada 10.
  const puntua = r => (r.it._fuente === 'ranking' ? 0 : 10000) + (r.it._pos ?? 9999);
  const candidatos = [...nuevos, ...revisar].sort((x, y) => puntua(x) - puntua(y));
  const tope = TOPE > 0 ? TOPE : candidatos.length;
  const aFichar = candidatos.filter(r => !yaEnBandeja.has(r.it.id)).slice(0, tope);

  // ── ficha completa: imágenes, variantes, descripción ──
  const fichas = await pool(aFichar, CONC, async r => (await api(`/products/${r.it.id}`)).data ?? null);

  const ahora = new Date().toISOString();
  const productos = [];
  aFichar.forEach((r, i) => {
    const d = fichas[i] ?? r.it;
    const a = { ...r.a, ...attrsDe(d) };
    const pics = (d.pictures ?? []).map(p => p.secure_url || p.url).filter(Boolean);
    productos.push({
      id: r.it.id,                       // ID de producto de CATÁLOGO (el que va a `mlId`)
      catalogId: d.catalog_product_id ?? r.it.id,
      categoria: cat.datos,
      estado: r.posible ? 'revisar' : 'new_unpublished',
      nombre: d.name ?? r.it.name,
      marca: a.BRAND ?? null,
      modelo: a.MODEL ?? a.TRADE_NAME ?? a.LINE ?? null,
      dominio: d.domain_id ?? r.it.domain_id,
      statusML: d.status ?? r.it.status,
      gtin: r.gtins,
      imagen: pics[0] ?? null,
      imagenes: pics.slice(0, 6),
      descripcion: d.short_description?.content ?? null,
      caracteristicas: (d.main_features ?? []).map(f => f.text).filter(Boolean),
      variantes: (d.pickers ?? []).flatMap(p => (p.products ?? []).map(v => ({
        picker: p.picker_name, etiqueta: v.picker_label, id: v.product_id,
      }))),
      urlML: `https://www.mercadolibre.com.mx/p/${r.it.id}`,
      // Cuándo tocó ML esta ficha por última vez. NO dice si hay stock —eso no lo sabemos, ver
      // abajo—, pero una ficha que lleva semanas sin moverse suele ser una sin vendedores, así
      // que se enseña en el Centro como pista para decidir a cuál pedirle enlace primero.
      actualizadoML: d.last_updated ?? r.it.last_updated ?? null,
      especs: mapearEspecs(a, cfg),
      _mlAtributos: attrsLegibles(d),
      obligatoriasFaltantes: (cfg.obligatorias ?? []).filter(k => mapearEspecs(a, cfg)[k] == null),
      recomendadasFaltantes: (cfg.recomendadas ?? []).filter(k => mapearEspecs(a, cfg)[k] == null),
      posibleDuplicadoDe: r.posible,
      /* Páginas de familias: a qué familia de la página le toca esta variante. null significa
         que ese modelo todavía no tiene familia escrita, así que no se puede publicar hasta que
         Alan la escriba; `_familiaMotivo` dice por qué no se pudo saber. */
      _familia: r.sitio ? r.sitio.modeloBase : undefined,
      _familiaMotivo: r.sitio && !r.sitio.modeloBase ? r.sitio.motivo : undefined,
      termino: r.it._termino,
      fuente: r.it._fuente ?? 'busqueda',
      // true solo para los del ranking: de esos sabemos que alguien los está vendiendo. En los de
      // búsqueda no lo sabemos, y decir que sí sería inventarlo.
      seVende: r.it._fuente === 'ranking',
      detectadoEn: ahora,
      linkML: null,
      linkAmz: null,
      precioML: null,                    // la API no da precio: sale del enlace de afiliado
    });
  });

  return {
    productos,
    resumen: {
      terminos: terminos.length, porTermino,
      crudos: crudos.size, relevantes: relevantes.length,
      descartes, ejemplosDescarte,
      duplicados: duplicados.length, duplicadosDetalle: duplicados.slice(0, 20),
      duplicadosPorMotivo: duplicados.reduce((o, d) => ({ ...o, [d.motivo]: (o[d.motivo] ?? 0) + 1 }), {}),
      /* Solo en páginas de familias: cuántos de los guardados ya tienen familia donde entrar y
         cuántos piden que se escriba antes la ficha del modelo. */
      conFamilia: cat.tipo === 'familias' ? productos.filter(p => p._familia).length : undefined,
      sinFamilia: cat.tipo === 'familias' ? productos.filter(p => p._familia === null).length : undefined,
      posiblesDuplicados: revisar.length,
      nuevos: productos.filter(p => p.estado === 'new_unpublished').length,
      rankings,
      delRanking: productos.filter(p => p.seVende).length,
      guardados: productos.length,
      candidatos: candidatos.length,
      yaEnBandeja: candidatos.filter(r => yaEnBandeja.has(r.it.id)).length,
      errores: ERRORES.length,
    },
  };
}

/**
 * Funde lo nuevo con lo que ya hay en la bandeja SIN pisar el trabajo manual: si Alan ya pegó
 * un enlace, corrigió una especificación o descartó un producto, eso manda. Repetir la búsqueda
 * no puede volver a crear lo mismo ni deshacer lo hecho: ese es el requisito del punto 11.
 */
function fundir(previos, frescos) {
  const porId = new Map(previos.map(p => [p.id, p]));
  for (const nuevo of frescos) {
    const viejo = porId.get(nuevo.id);
    if (!viejo) { porId.set(nuevo.id, nuevo); continue; }
    porId.set(nuevo.id, {
      ...nuevo,
      estado: viejo.estado,                                   // lo que decidió Alan manda
      linkML: viejo.linkML ?? nuevo.linkML,
      linkAmz: viejo.linkAmz ?? nuevo.linkAmz,
      precioML: viejo.precioML ?? nuevo.precioML,
      especs: { ...nuevo.especs, ...(viejo.especs ?? {}) },   // lo editado a mano gana
      nombre: viejo._nombreEditado ? viejo.nombre : nuevo.nombre,
      _nombreEditado: viejo._nombreEditado,
      detectadoEn: viejo.detectadoEn,
      _revisadoEn: viejo._revisadoEn,
    });
  }
  return [...porId.values()];
}

// ── main ─────────────────────────────────────────────────────────────────────
const registro = Object.fromEntries(entradas());
const cats = TODAS
  ? conDescubrir()
  : CATS_ARG.map(c => {
      const e = registro[c] ?? conDescubrir().find(x => x.datos === c);
      if (!e) throw new Error(`Categoría "${c}" no existe en categorias.js`);
      if (!e.descubrir) throw new Error(`La categoría "${c}" no tiene bloque \`descubrir\` en categorias.js`);
      return e;
    });

if (!cats.length) {
  console.error('Usa --categoria=proteina o --todas. Categorías con descubrimiento: ' +
    conDescubrir().map(c => c.clave).join(', '));
  process.exit(1);
}

TOKEN = await getToken();
const base = leerJSON(ADMIN_PATH, {});
const bandeja = leerJSON(BANDEJA_PATH, { generado: null, categorias: {} });
const historial = leerJSON(LOG_PATH, { busquedas: [] });

for (const cat of cats) {
  const t0 = Date.now();
  const previa = bandeja.categorias[cat.datos] ?? { productos: [] };
  const { productos, resumen } = await descubrir(cat, base, previa);
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n═══ ${cat.titulo} (${cat.datos}) ═══`);
  console.log(`  términos ${resumen.terminos} · ${resumen.crudos} de catálogo · ${resumen.relevantes} de la categoría`);
  console.log(`  descartados: ${resumen.descartes.inactivo} inactivos · ${resumen.descartes.dominio} de otro dominio · ${resumen.descartes.clase} de otra clase`);
  console.log(`  duplicados en la base: ${resumen.duplicados} · posibles duplicados: ${resumen.posiblesDuplicados}`);
  if (Object.keys(resumen.duplicadosPorMotivo).length) {
    console.log(`    por: ${Object.entries(resumen.duplicadosPorMotivo).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  }
  console.log(`  NUEVOS guardados: ${resumen.guardados} de ${resumen.candidatos} candidatos (ya en bandeja: ${resumen.yaEnBandeja})`);
  console.log(`  de ellos, del ranking de más vendidos (se venden hoy): ${resumen.delRanking}`);
  if (resumen.conFamilia !== undefined) {
    console.log(`  con familia en la página (publicables con su enlace): ${resumen.conFamilia} · sin familia (hay que escribirla antes): ${resumen.sinFamilia}`);
  }
  console.log(`  ${LLAMADAS} llamadas · ${segundos}s · errores de API: ${resumen.errores}`);
  if (resumen.ejemplosDescarte.length) {
    console.log('  ejemplos descartados:');
    for (const e of resumen.ejemplosDescarte.slice(0, 5)) console.log(`    · ${e.motivo} — ${String(e.nombre).slice(0, 60)}`);
  }

  if (APLICAR) {
    const fundidos = fundir(previa.productos ?? [], productos);
    bandeja.categorias[cat.datos] = {
      titulo: cat.titulo,
      actualizado: new Date().toISOString(),
      productos: fundidos,
      ultimaBusqueda: resumen,
    };
    historial.busquedas.unshift({
      fecha: new Date().toISOString(), categoria: cat.datos, titulo: cat.titulo,
      terminos: (TERMINOS_ARG.length ? TERMINOS_ARG : cat.descubrir.terminos),
      encontrados: resumen.crudos, relevantes: resumen.relevantes, nuevos: resumen.guardados,
      duplicados: resumen.duplicados, posiblesDuplicados: resumen.posiblesDuplicados,
      descartados: resumen.descartes, errores: ERRORES.slice(0, 10), llamadas: LLAMADAS, segundos: Number(segundos),
    });
  }
}

if (APLICAR) {
  bandeja.generado = new Date().toISOString();
  historial.busquedas = historial.busquedas.slice(0, MAX_HISTORIAL);
  writeFileSync(BANDEJA_PATH, JSON.stringify(bandeja, null, 1));
  writeFileSync(LOG_PATH, JSON.stringify(historial, null, 1));
  console.log(`\n✓ escritos scripts/bandeja-nuevos.json y scripts/busquedas-catalogo.json`);
  console.log('  Siguiente: node scripts/generar-centro.js y republicar el Centro de Control.');
} else {
  console.log('\n(simulación — nada escrito; agrega --aplicar)');
}
