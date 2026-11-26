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
 *   --concurrencia=N  fichas en paralelo (4)
 *   --terminos=a|b    términos a mano, en vez de los de categorias.js
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { entradas, conDescubrir } from './categorias.js';

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

const CLAVES_GRAMOS = new Set(['contenidoGramos', 'gramosPorPorcion', 'pesoNeto']);
const CLAVES_NUMERO = new Set(['porciones', 'potencia', 'capacidad']);
const CLAVES_BOOL = new Set(['vegana', 'glutenFree', 'sugarFree', 'pura', 'organico']);

/** Atributos de ML → claves del esquema `especs` de la categoría, con su conversión. */
function mapearEspecs(attrs, mapa) {
  const out = {};
  for (const [idAttr, clave] of Object.entries(mapa ?? {})) {
    const v = attrs[idAttr];
    if (v == null || v === '' || v === '-') continue;
    out[clave] = CLAVES_GRAMOS.has(clave) ? aGramos(v)
      : CLAVES_NUMERO.has(clave) ? aNumero(v)
      : CLAVES_BOOL.has(clave) ? aBool(v)
      : String(v);
    if (out[clave] == null) delete out[clave];
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

  for (const q of terminos) {
    let n = 0, err = null;
    for (let p = 0; p < PAGINAS; p++) {
      const off = p * 50;
      const r = await api(`/products/search?site_id=MLM&q=${encodeURIComponent(q)}&limit=50&offset=${off}`);
      if (!r.ok) { err = r.status; ERRORES.push({ termino: q, offset: off, status: r.status }); break; }
      const res = r.data?.results ?? [];
      for (const it of res) { n++; if (!crudos.has(it.id)) crudos.set(it.id, { ...it, _termino: q }); }
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
  const firma = p => [norm(p.marca), p.especs?.contenidoGramos ?? '', norm(p.especs?.sabor)].join('|');
  const porFirma = new Map(prods.map(p => [firma(p), p]));
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
    // Firma marca+contenido+sabor: NO descarta, marca para revisión. Un sabor o un tamaño
    // distinto es otro producto; confundirlos sería peor que tener una tarjeta de más.
    const f = [norm(a.BRAND), aGramos(a.NET_WEIGHT) ?? '', norm(a.FLAVOR)].join('|');
    const posible = porFirma.get(f);
    const reg = { it, a, gtins, posible: posible ? { id: posible.id, nombre: posible.nombre } : null };
    if (posible) revisar.push(reg); else nuevos.push(reg);
  }

  // Orden: primero lo más completo (más atributos útiles), que es lo que menos trabajo manual
  // deja. Sin precio ni ventas no hay mejor criterio disponible: la API no los da.
  const puntua = r => Object.keys(r.a).length + (r.gtins.length ? 3 : 0);
  const candidatos = [...nuevos, ...revisar].sort((x, y) => puntua(y) - puntua(x));
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
      especs: mapearEspecs(a, cfg.mapa),
      _mlAtributos: attrsLegibles(d),
      obligatoriasFaltantes: (cfg.obligatorias ?? []).filter(k => mapearEspecs(a, cfg.mapa)[k] == null),
      posibleDuplicadoDe: r.posible,
      termino: r.it._termino,
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
      posiblesDuplicados: revisar.length,
      nuevos: productos.filter(p => p.estado === 'new_unpublished').length,
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
  console.log(`  NUEVOS guardados: ${resumen.guardados} de ${resumen.candidatos} candidatos (ya en bandeja: ${resumen.yaEnBandeja})`);
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
