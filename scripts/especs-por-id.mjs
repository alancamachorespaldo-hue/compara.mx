#!/usr/bin/env node
/**
 * especs-por-id.mjs — trae de la API de Mercado Libre lo que SIGUE funcionando: nombre,
 * características e imagen de un catálogo, a partir de su `mlId`.
 *
 * EL PROCESO (nov-2026). La API cerró `/products/{id}/items`, que es de donde salían los
 * precios, pero `/products/{id}` responde 200 y trae 18-73 atributos, las fotos y el `status`.
 * Así que el reparto queda:
 *     · la API  → características, imagen, nombre, si el catálogo sigue vivo
 *     · tú      → el enlace de afiliado, que se pega a mano
 *     · el enlace → el precio (scripts/precios-por-link.mjs)
 *
 * NUNCA PISA LO TUYO. Una característica que ya tiene valor en la base se respeta; solo se
 * rellenan las vacías. Las diferencias se enseñan al final para que decidas tú. Lo mismo con el
 * nombre y la imagen: solo se ponen si faltan, salvo que pidas --forzar-imagen.
 *
 * Uso:
 *   node scripts/especs-por-id.mjs --categoria=freidoras [--aplicar]
 *   node scripts/especs-por-id.mjs --todas [--aplicar]
 *   node scripts/especs-por-id.mjs --id=MLM22374539            (solo mirar qué trae un catálogo)
 *   node scripts/especs-por-id.mjs --nuevo=freidoras:MLM22374539:https://meli.la/abc123 [--aplicar]
 *
 * `--nuevo` es el alta de producto del proceso nuevo: le pasas categoría, ID de catálogo y tu
 * enlace de afiliado, y queda creado con sus características e imagen puestas por la API y
 * `activo:false` hasta que lo revises y lo publiques en el gestor.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { clavesDeDatos, tituloDe } from './categorias.js';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://api.mercadolibre.com';
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const REPORT_PATH = resolve(ROOT, 'scripts/especs-report.json');

const arg = n => process.argv.find(a => a.startsWith('--' + n + '='))?.split('=').slice(1).join('=');
const APLICAR = process.argv.includes('--aplicar');
const FORZAR_IMAGEN = process.argv.includes('--forzar-imagen');
const TODAS = process.argv.includes('--todas');
const CATS_ARG = (arg('categoria') ?? '').split(',').filter(Boolean);
const SOLO_ID = arg('id');
const NUEVO = arg('nuevo');
const CONCURRENCIA = 4;
const MLID_RX = /^MLM\d{6,12}$/;
const HOY = new Date().toISOString().slice(0, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const vacio = v => v == null || String(v).trim() === '';

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

let TOKEN = null, LLAMADAS = 0;

async function getToken() {
  const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secret, ML_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret) throw new Error('Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  if (refresh) {
    const r = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh }),
    });
    if (r.ok) return (await r.json()).access_token;
  }
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!r.ok) throw new Error(`Token error ${r.status}`);
  return (await r.json()).access_token;
}

/** @returns {Promise<{ok:boolean, status?:number, data?:object}>} */
async function ficha(mlId) {
  for (let i = 0; i < 3; i++) {
    LLAMADAS++;
    let res;
    try {
      res = await fetch(`${API}/products/${mlId}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch { await sleep(800 * (i + 1)); continue; }
    if (res.ok) return { ok: true, data: await res.json() };
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * 2 ** i); continue; }
    return { ok: false, status: res.status };
  }
  return { ok: false };
}

/**
 * Atributos de la ficha → { "Nombre del atributo": "valor" }. Se queda con el texto que enseña
 * Mercado Libre (`value_name`), que es el que ya usan las páginas, no con el id interno.
 */
function atributos(d) {
  const out = {};
  for (const a of d?.attributes ?? []) {
    const nombre = String(a.name || '').trim();
    const valor = String(a.value_name ?? '').trim();
    if (!nombre || !valor || valor === '-') continue;
    out[nombre] = valor;
  }
  return out;
}

const imagenDe = d => (d?.pictures ?? [])[0]?.url ?? (d?.pictures ?? [])[0]?.secure_url ?? null;

/**
 * Vuelca la ficha en el producto sin pisar nada puesto a mano.
 *
 * OJO CON `especs`. Cada categoría tiene su esquema de claves cortas y curadas, que es el que
 * leen las páginas: freidoras usa `potencia`, `capacidad`, `panel`. La API devuelve los nombres
 * que enseña Mercado Libre: `Potencia`, `Capacidad en volumen`, `Tipos de control`. Volcar unos
 * sobre otros llenaría `especs` de claves paralelas —`potencia` y `Potencia` a la vez— que
 * ninguna página pinta y que ensucian el gestor para siempre. Así que:
 *   · lo que trae la API se guarda crudo en `_mlAtributos`, que no pisa nada y queda disponible;
 *   · `especs` SOLO se siembra cuando el producto no tiene ninguna, que es el caso de un alta
 *     nueva: ahí no hay esquema que romper y es mejor tener los datos que no tenerlos.
 * Mapear un atributo de ML a una clave del esquema es decisión de categoría, y para eso ya está
 * el gestor (y `aplicar-especs.mjs`).
 */
function aplicarFicha(p, d, fila) {
  const attrs = atributos(d);
  const antes = p._mlAtributos ?? {};
  p._mlAtributos = attrs;
  fila.atributos = Object.keys(attrs).length;
  fila.atributosNuevos = Object.keys(attrs).filter(k => vacio(antes[k])).length;

  const tieneEsquema = p.especs && typeof p.especs === 'object' && Object.keys(p.especs).length > 0;
  if (!tieneEsquema) {
    if (Object.keys(attrs).length) {
      p.especs = { ...attrs };
      fila.rellenadas = Object.keys(attrs);
      fila.sembrada = true;
    }
  } else {
    // Hay esquema: no se inventa ninguna clave. Solo se rellenan las que YA existen y están
    // vacías, emparejando por nombre normalizado ("Capacidad en volumen" → "capacidad").
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const porNorm = new Map(Object.entries(attrs).map(([k, v]) => [norm(k), v]));
    for (const clave of Object.keys(p.especs)) {
      const v = porNorm.get(norm(clave));
      if (v === undefined) continue;
      if (vacio(p.especs[clave])) { p.especs[clave] = v; fila.rellenadas.push(clave); }
      else if (String(p.especs[clave]).trim().toLowerCase() !== v.toLowerCase()) {
        fila.difieren.push({ campo: clave, tuyo: p.especs[clave], ml: v });
      }
    }
  }
  const img = imagenDe(d);
  if (img && (FORZAR_IMAGEN || vacio(p.imagen))) {
    if (p.imagen !== img) { p.imagen = img; fila.imagen = true; }
  }
  if (vacio(p.nombre) && d?.name) { p.nombre = d.name; fila.nombre = true; }
  if (vacio(p.marca) && attrs.Marca) { p.marca = attrs.Marca; fila.marca = true; }
  p._especsFecha = HOY;
  p._especsFuente = 'api';
  fila.estadoCatalogo = d?.status ?? null;
}

async function main() {
  try { TOKEN = await getToken(); } catch (e) { console.error('❌', e.message); process.exit(1); }

  // ── Solo mirar qué trae un catálogo ───────────────────────────────────────
  if (SOLO_ID) {
    if (!MLID_RX.test(SOLO_ID)) { console.error(`❌ "${SOLO_ID}" no parece un ID de catálogo (MLM…)`); process.exit(1); }
    const f = await ficha(SOLO_ID);
    if (!f.ok) { console.error(`❌ ${SOLO_ID}: la API respondió ${f.status ?? 'nada'}`); process.exit(1); }
    const attrs = atributos(f.data);
    console.log(`\n${SOLO_ID} · ${f.data.status}`);
    console.log(`  nombre : ${f.data.name}`);
    console.log(`  imagen : ${imagenDe(f.data) ?? '—'}`);
    console.log(`  ${Object.keys(attrs).length} característica(s):`);
    for (const [k, v] of Object.entries(attrs)) console.log(`    ${k.padEnd(28)} ${v}`);
    console.log('');
    return;
  }

  const db = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
  const registradas = clavesDeDatos();

  // ── Alta de un producto nuevo ─────────────────────────────────────────────
  if (NUEVO) {
    const [cat, mlId, ...resto] = NUEVO.split(':');
    const link = resto.join(':');
    if (!registradas.includes(cat)) {
      console.error(`❌ Categoría "${cat}" no registrada en scripts/categorias.js`);
      console.error('   Disponibles:', registradas.join(', '));
      process.exit(1);
    }
    if (!MLID_RX.test(mlId || '')) { console.error(`❌ "${mlId}" no parece un ID de catálogo (MLM…)`); process.exit(1); }
    if (!/^https?:\/\//.test(link || '')) { console.error('❌ Falta el enlace de afiliado: --nuevo=categoria:MLM…:https://meli.la/…'); process.exit(1); }

    const yaEsta = (db[cat] ?? []).find(p => p.mlId === mlId || p.linkML === link);
    if (yaEsta) { console.error(`❌ Ya existe en ${tituloDe(cat)}: id ${yaEsta.id} — ${yaEsta.nombre}`); process.exit(1); }

    const f = await ficha(mlId);
    if (!f.ok) { console.error(`❌ ${mlId}: la API respondió ${f.status ?? 'nada'}`); process.exit(1); }

    // Id nuevo que no choque con los de la categoría.
    const usados = new Set((db[cat] ?? []).map(p => String(p.id)));
    let n = (db[cat] ?? []).length + 1;
    while (usados.has(String(n))) n++;

    const p = {
      id: String(n), nombre: f.data.name, marca: atributos(f.data).Marca ?? null,
      mlId, mlIdFuente: 'manual', linkML: link, precioML: null,
      // Entra apagado a propósito: primero lo miras en el gestor y le sacas el precio con
      // precios-por-link.mjs; publicarlo es decisión tuya, no de un script.
      activo: false, _publicar: false, _altaFecha: HOY,
    };
    const fila = { categoria: cat, id: p.id, nombre: p.nombre, rellenadas: [], difieren: [] };
    aplicarFicha(p, f.data, fila);

    console.log(`\n✅ ${tituloDe(cat)} · id ${p.id}`);
    console.log(`   ${p.nombre}`);
    console.log(`   catálogo ${mlId} (${f.data.status}) · ${fila.rellenadas.length} característica(s) · imagen ${p.imagen ? 'sí' : 'no'}`);
    console.log(`   enlace: ${link}`);
    if (!APLICAR) { console.log('\n   (no se guardó: repite con --aplicar)\n'); return; }

    (db[cat] ??= []).push(p);
    writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log('\n💾 Guardado en merged-admin.json (apagado hasta que lo publiques)');
    console.log(`   👉 node scripts/precios-por-link.mjs --categoria=${cat} --aplicar   (para traerle el precio)\n`);
    return;
  }

  // ── Rellenar características de lo que ya existe ──────────────────────────
  const claves = TODAS ? registradas : CATS_ARG;
  if (!claves.length) {
    console.error('Faltan categorías. Usa --todas, --categoria=a,b, --id=MLM… o --nuevo=cat:MLM…:enlace');
    console.error('Disponibles:', registradas.join(', '));
    process.exit(1);
  }
  const desconocidas = claves.filter(k => !registradas.includes(k));
  if (desconocidas.length) {
    console.error(`❌ Categoría(s) no registrada(s) en scripts/categorias.js: ${desconocidas.join(', ')}`);
    process.exit(1);
  }

  const tareas = [];
  for (const cat of claves) {
    for (const p of db[cat] ?? []) {
      if (p._eliminado === true) continue;
      if (!p.mlId || !MLID_RX.test(p.mlId)) continue;
      tareas.push({ cat, p });
    }
  }

  console.log('\n📋 comparalo.mx — Características e imagen desde la API de Mercado Libre');
  console.log(`   Modo: ${APLICAR ? 'APLICAR a la base' : 'solo reporte'} · ${tareas.length} producto(s) con ID de catálogo\n`);
  if (!tareas.length) { console.log('   Nada que hacer.\n'); return; }

  const t0 = Date.now();
  let hechos = 0;
  const filas = await pool(tareas, CONCURRENCIA, async ({ cat, p }) => {
    const fila = {
      categoria: cat, titulo: tituloDe(cat), id: String(p.id), nombre: p.nombre, mlId: p.mlId,
      rellenadas: [], difieren: [], atributos: 0, atributosNuevos: 0, sembrada: false,
      imagen: false, marca: false, error: null,
    };
    const f = await ficha(p.mlId);
    if (++hechos % 100 === 0) console.log(`   … ${hechos}/${tareas.length}`);
    if (!f.ok) {
      // La API no contesta: no se toca el producto. Nunca se vacía una característica por un fallo.
      fila.error = f.status === 404 ? 'el catálogo ya no existe (404)' : `la API respondió ${f.status ?? 'nada'}`;
      fila.noExiste = f.status === 404;
      return fila;
    }
    if (APLICAR) aplicarFicha(p, f.data, fila);
    else {
      // En modo reporte se calcula lo mismo sobre una copia, para enseñar qué pasaría.
      const copia = { ...p, especs: { ...(p.especs ?? {}) } };
      aplicarFicha(copia, f.data, fila);
    }
    return fila;
  });

  if (APLICAR) {
    writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log('\n💾 merged-admin.json actualizado');
  }

  const conRelleno = filas.filter(f => f.rellenadas.length);
  const conDif = filas.filter(f => f.difieren.length);
  const conError = filas.filter(f => f.error);
  const noExisten = filas.filter(f => f.noExiste);
  const totalCampos = filas.reduce((a, f) => a + f.rellenadas.length, 0);
  const totalAttrs = filas.reduce((a, f) => a + f.atributos, 0);
  const sembradas = filas.filter(f => f.sembrada).length;
  const conImagen = filas.filter(f => f.imagen).length;

  writeFileSync(REPORT_PATH, JSON.stringify({
    fecha: HOY, generado: new Date().toISOString(), aplicado: APLICAR, categorias: claves,
    totales: {
      revisados: filas.length, con_relleno: conRelleno.length, campos: totalCampos,
      atributos: totalAttrs, sembradas,
      imagenes: conImagen, con_diferencias: conDif.length, errores: conError.length,
      no_existen: noExisten.length,
    },
    productos: filas,
  }, null, 2), 'utf8');

  console.log(`\n📊 ${filas.length} revisados · ${totalCampos} característica(s) rellenada(s) en ${conRelleno.length} producto(s) · ${conImagen} imagen(es)`);
  if (conDif.length) {
    console.log(`\n⚖ ${conDif.length} producto(s) donde lo tuyo y lo de ML no coinciden (NO se tocó nada):`);
    for (const f of conDif.slice(0, 6)) {
      const d = f.difieren[0];
      console.log(`   · ${f.titulo}: ${String(f.nombre).slice(0, 32)} — ${d.campo}: tuyo "${String(d.tuyo).slice(0, 20)}" / ML "${String(d.ml).slice(0, 20)}"`
        + (f.difieren.length > 1 ? ` (+${f.difieren.length - 1})` : ''));
    }
    if (conDif.length > 6) console.log(`   … y ${conDif.length - 6} más en el reporte`);
  }
  if (noExisten.length) {
    console.log(`\n🗑 ${noExisten.length} catálogo(s) que ya no existen — precios-por-link.mjs los borra en su corrida:`);
    for (const f of noExisten.slice(0, 6)) console.log(`   · ${f.titulo}: ${String(f.nombre).slice(0, 44)}`);
  }
  const otrosErrores = conError.length - noExisten.length;
  if (otrosErrores > 0) console.log(`\n❌ ${otrosErrores} sin respuesta de la API (no se tocaron)`);
  if (!APLICAR) console.log('\n   (modo reporte: no se cambió nada — agrega --aplicar)');
  console.log(`\n   ${LLAMADAS} llamadas · ${((Date.now() - t0) / 1000).toFixed(0)} s · 📄 scripts/especs-report.json\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
