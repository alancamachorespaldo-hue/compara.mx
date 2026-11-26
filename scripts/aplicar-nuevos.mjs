#!/usr/bin/env node
/**
 * aplicar-nuevos.mjs — publica (o descarta) los productos de la BANDEJA que Alan aprobó en el
 * Centro de Control. Es el único camino por el que un producto descubierto por la API entra al
 * sitio: `descubrir-catalogo.mjs` solo llena la bandeja y nunca toca la base ni las páginas.
 *
 *   node scripts/aplicar-nuevos.mjs cambios.json            (simulación: dice qué haría)
 *   node scripts/aplicar-nuevos.mjs cambios.json --aplicar
 *
 * El archivo es el JSON del botón «Copiar cambios» del Gestor:
 *   { "categoria": "proteina",
 *     "publicar": [ { "id":"MLM44664907", "linkML":"https://meli.la/…", "linkAmz":"…" ,
 *                     "nombre":"…", "marca":"…", "especs":{ "proteinaPorPorcion":25, … } } ],
 *     "eliminar": [ "MLM123…" ] }
 *
 * QUÉ COMPRUEBA ANTES DE PUBLICAR (si algo falla, ese producto no entra y los demás sí):
 *   1. que siga en la bandeja de esa categoría;
 *   2. que tenga enlace de afiliado de Mercado Libre;
 *   3. que ese enlace ABRA DE VERDAD el producto aprobado — se resuelve con `resolverAfiliado()`
 *      y se compara el `mlId` de la tarjeta contra el ID de catálogo. Es la comprobación que
 *      pidió Alan ("entro con el ID del catálogo para verificar si es tal"), y de paso es lo que
 *      evita el desastre conocido: un enlace que acaba en la tarjeta por defecto del perfil;
 *   4. que el enlace traiga precio (sin precio la tarjeta sale vacía) y que no esté pausada;
 *   5. que estén las especificaciones obligatorias de la categoría (`categorias.js`);
 *   6. que un `linkAmz`, si lo hay, lleve el tag vigente guiasdecomp01-20;
 *   7. que el ID de catálogo no esté ya en la base (nunca se duplica un producto publicado).
 *
 * Lo que escribe: `merged-admin.json` (producto nuevo, `activo:true`) y el array JS de la página
 * de la categoría, con `agregarProductos()` de `_html-precios.js`, que parsea antes de escribir.
 * Borrar desde la bandeja es LÓGICO: el producto queda con estado `eliminado` y su fecha, nunca
 * se toca la base ni ningún producto ya publicado.
 *
 * Después de correrlo: `node scripts/sync-pausas.js`, `node scripts/generar-centro.js`.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { entradas } from './categorias.js';
import { agregarProductos } from './_html-precios.js';
import { resolverAfiliado } from './resolver-afiliado.js';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const BANDEJA_PATH = resolve(ROOT, 'scripts/bandeja-nuevos.json');
const TAG_AMZ = 'tag=guiasdecomp01-20';

const APLICAR = process.argv.includes('--aplicar');
const archivo = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!archivo) { console.error('Uso: node scripts/aplicar-nuevos.mjs <cambios.json> [--aplicar]'); process.exit(1); }

const cambios = JSON.parse(readFileSync(resolve(archivo), 'utf8'));
const cat = Object.fromEntries(entradas())[cambios.categoria]
  ?? entradas().map(([, c]) => c).find(c => c.datos === cambios.categoria);
if (!cat) { console.error(`Categoría "${cambios.categoria}" no registrada en categorias.js`); process.exit(1); }

const base = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
const bandeja = existsSync(BANDEJA_PATH) ? JSON.parse(readFileSync(BANDEJA_PATH, 'utf8')) : { categorias: {} };
const enBandeja = bandeja.categorias?.[cat.datos]?.productos ?? [];
const porId = new Map(enBandeja.map(p => [p.id, p]));
const prods = base[cat.datos] ?? (base[cat.datos] = []);
const obligatorias = cat.descubrir?.obligatorias ?? [];

/** Siguiente id numérico libre, mirando la base Y la página (no siempre coinciden). */
function siguienteId() {
  let max = 0;
  for (const p of prods) { const n = Number(p.id); if (isFinite(n)) max = Math.max(max, n); }
  const abs = resolve(ROOT, cat.file);
  if (existsSync(abs)) {
    const html = readFileSync(abs, 'utf8');
    for (const m of html.matchAll(/^\s*id:\s*(\d+)\s*,/gm)) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Campos derivados: aritmética sobre datos que ya tenemos, nunca un dato inventado. */
function derivar(o) {
  const { precioML: pr, porciones: po, contenidoGramos: cg, gramosPorPorcion: gp, proteinaPorPorcion: pp } = o;
  const out = {};
  if (pr > 0 && po > 0) out.costoPorPorcion = +(pr / po).toFixed(2);
  if (pr > 0 && cg > 0) out.costoPor5g = +(pr / (cg / 5)).toFixed(2);
  if (pp > 0 && gp > 0) out.concentracionProteina = +((pp / gp) * 100).toFixed(2);
  if (pr > 0 && cg > 0 && gp > 0 && pp > 0) {
    const totalProteina = (cg / gp) * pp;
    if (totalProteina > 0) out.costoPor25gProteina = +(pr / (totalProteina / 25)).toFixed(2);
  }
  return out;
}

const hechos = [], fallos = [];
const paraPagina = [];

for (const item of cambios.publicar ?? []) {
  const nota = m => { fallos.push({ id: item.id, motivo: m }); };
  /* Un rechazo que demuestra que el producto NO SIRVE saca la ficha de la bandeja ahí mismo.
     Es la comprobación de disponibilidad que la API no deja hacer: aquí sí se sabe, porque el
     enlace se abrió de verdad. Así, pegar enlaces y mandar a publicar limpia la bandeja sola y
     no hay que revisar nada a mano antes. Lo que NO da de baja: un error de red o un enlace
     ilegible, que no prueban nada. */
  const baja = (m, motivoCorto) => {
    fallos.push({ id: item.id, motivo: m, baja: true });
    const reg = porId.get(item.id);
    if (reg) { reg.estado = 'eliminado'; reg.eliminadoEn = new Date().toISOString(); reg._motivoBaja = motivoCorto; }
  };
  const enB = porId.get(item.id);
  if (!enB) { nota('no está en la bandeja de esta categoría'); continue; }
  if (prods.some(p => p.mlId === item.id)) { nota('ese ID de catálogo ya está publicado en la base'); continue; }

  const linkML = (item.linkML ?? enB.linkML ?? '').trim();
  if (!linkML) { nota('sin enlace de afiliado de Mercado Libre'); continue; }
  const linkAmz = (item.linkAmz ?? enB.linkAmz ?? '').trim() || null;
  if (linkAmz && !linkAmz.includes(TAG_AMZ)) { nota(`el enlace de Amazon no lleva ${TAG_AMZ}`); continue; }

  const especs = { ...(enB.especs ?? {}), ...(item.especs ?? {}) };
  const faltan = obligatorias.filter(k => especs[k] == null || especs[k] === '');
  if (faltan.length) { nota(`faltan características obligatorias: ${faltan.join(', ')}`); continue; }

  const r = await resolverAfiliado(linkML).catch(e => ({ ok: false, motivo: 'red: ' + e.message }));
  if (!r.ok) { nota(`el enlace no se pudo leer (${r.motivo})`); continue; }
  if (r.mlId && r.mlId !== item.id) { nota(`el enlace abre ${r.mlId}, no ${item.id}`); continue; }
  if (!r.mlId) { nota('el enlace no deja ver a qué producto de catálogo lleva'); continue; }
  if (r.pausada) { baja('la publicación está pausada en ML · fuera de la bandeja', 'pausada'); continue; }
  if (!(r.precio > 0)) { baja('sin precio: hoy no lo vende nadie · fuera de la bandeja', 'sin_precio'); continue; }

  const id = siguienteId();
  const nombre = item.nombre ?? enB.nombre;
  const nuevo = {
    id,
    nombre,
    marca: item.marca ?? enB.marca ?? null,
    mlId: item.id,
    mlIdFuente: 'descubrimiento-catalogo',
    linkML,
    linkAmz,
    precioML: r.precio,
    precioAmz: null,
    precio: r.precio,
    imagen: item.imagen ?? enB.imagen ?? null,
    activo: true,
    estadoML: 'ok',
    especs,
    gtin: enB.gtin ?? [],
    _mlAtributos: enB._mlAtributos ?? {},
    _precioFicha: r.precio,
    _precioLinkFecha: new Date().toISOString(),
    _altaDesde: 'catalogo-ml',
    _altaFecha: new Date().toISOString(),
    _updatedAt: new Date().toISOString(),
  };
  prods.push(nuevo);

  const pagina = {
    id, nombre, marca: nuevo.marca,
    precio: r.precio, precioML: r.precio, precioAmz: null,
    linkML, linkAmz,
    img: nuevo.imagen, imagen: nuevo.imagen,
    sabor: especs.sabor ?? null,
    saboresDisponibles: especs.sabor ? [especs.sabor] : [],
    estrellas: null, resenas: null,
    ...especs,
  };
  Object.assign(pagina, derivar({ ...especs, precioML: r.precio }));
  paraPagina.push(pagina);
  enB.estado = 'publicado';
  enB.idBase = id;
  enB.publicadoEn = new Date().toISOString();
  enB.linkML = linkML;
  enB.linkAmz = linkAmz;
  enB.precioML = r.precio;
  hechos.push({ id: item.id, idBase: id, nombre, precio: r.precio });
}

for (const id of cambios.eliminar ?? []) {
  const enB = porId.get(id);
  if (!enB) { fallos.push({ id, motivo: 'no está en la bandeja' }); continue; }
  enB.estado = 'eliminado';
  enB.eliminadoEn = new Date().toISOString();
  hechos.push({ id, accion: 'eliminado de la bandeja (papelera lógica)' });
}

// ── informe ──
console.log(`\nCategoría: ${cat.titulo} (${cat.datos})`);
for (const h of hechos) {
  console.log(h.accion ? `  · ${h.id} — ${h.accion}`
    : `  ✓ ${h.id} → id ${h.idBase} · $${h.precio} · ${String(h.nombre).slice(0, 60)}`);
}
for (const f of fallos) console.log(`  ${f.baja ? 'x' : '⛔'} ${f.id} — ${f.motivo}`);
const dadosDeBaja = fallos.filter(f => f.baja).length;
console.log(`\n  publicados ${hechos.filter(h => !h.accion).length} · eliminados ${hechos.filter(h => h.accion).length} · rechazados ${fallos.length}` +
  (dadosDeBaja ? ` · ${dadosDeBaja} salieron de la bandeja por no estar disponibles` : ''));

if (!APLICAR) { console.log('\n(simulación — nada escrito; agrega --aplicar)'); process.exit(0); }

// Las bajas se guardan aunque no se publique ni un producto: son el resultado de la
// comprobación, y perderlas obligaría a volver a abrir los mismos enlaces muertos.
const guardarBandeja = () => {
  if (bandeja.categorias?.[cat.datos]) bandeja.categorias[cat.datos].actualizado = new Date().toISOString();
  writeFileSync(BANDEJA_PATH, JSON.stringify(bandeja, null, 1));
};

if (paraPagina.length) {
  const res = agregarProductos(resolve(ROOT, cat.file), cat.varName, cat.tipo ?? 'plano', paraPagina);
  if (!res.ok) {
    console.error(`\n⛔ la página NO se tocó: ${res.motivo}`);
    console.error('   Tampoco se escribe la base, para que no queden desparejas.');
    guardarBandeja();
    process.exit(1);
  }
  console.log(`\n✓ ${cat.file}: ${res.agregados} producto(s) agregados al array ${cat.varName}`);
}

writeFileSync(ADMIN_PATH, JSON.stringify(base, null, 2), 'utf8');
guardarBandeja();
console.log('✓ scripts/merged-admin.json y scripts/bandeja-nuevos.json actualizados');
console.log('  Siguiente: node scripts/sync-pausas.js · node scripts/sync-hub-counts.js · node scripts/generar-centro.js · node scripts/check-site.js');
