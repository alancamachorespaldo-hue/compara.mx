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
 * de la categoría, que parsea antes de escribir.
 *
 * DOS FORMAS DE PÁGINA, Y LA DIFERENCIA IMPORTA. En una categoría plana (proteína, freidoras) el
 * catálogo es una tarjeta y entra con `agregarProductos()`. En una de FAMILIAS (celulares) el
 * array guarda modelos con sus variantes de almacenamiento dentro, así que el catálogo es una
 * VARIANTE: `_familias-alta.js` decide de qué familia es —exigiendo que el modelo de la API case
 * exacto con el nombre de una familia de la página— y `agregarVariantes()` la mete ahí dentro, en
 * su sitio por capacidad. Si la familia no existe o queda en duda, ese producto NO se publica y
 * se dice por qué: una variante en la familia equivocada enseñaría dos teléfonos distintos bajo
 * el mismo nombre, que es mucho peor que un alta que se queda pendiente.
 * Borrar desde la bandeja es LÓGICO: el producto queda con estado `eliminado` y su fecha, nunca
 * se toca la base ni ningún producto ya publicado.
 *
 * Después de correrlo: `node scripts/sync-pausas.js`, `node scripts/generar-centro.js`.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { entradas } from './categorias.js';
import { agregarProductos, agregarVariantes, leerArray } from './_html-precios.js';
import { resolverFamilia, altaVariante } from './_familias-alta.js';
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
const ES_FAMILIAS = (cat.tipo ?? 'plano') === 'familias';
const PAGINA = resolve(ROOT, cat.file);

/* En una página de familias hay que LEER la página antes de decidir: la familia a la que
   pertenece el catálogo vive ahí, no en la base. Si no se puede leer, no se publica nada. */
let familiasPagina = [];
if (ES_FAMILIAS) {
  const r = leerArray(PAGINA, cat.varName);
  if (!r.ok) {
    console.error(`No se pudo leer ${cat.file} (${r.motivo}). Sin eso no hay forma de saber en qué familia va cada producto.`);
    process.exit(1);
  }
  familiasPagina = r.datos;
}
/* Ids ya tomados, en la base Y en la página: el id de la variante nueva no puede pisar ninguno. */
const idsUsados = new Set([
  ...prods.map(p => String(p.id)),
  ...familiasPagina.flatMap(f => (f.variantes ?? []).map(v => v && String(v.id))),
].filter(Boolean));

/** Siguiente id numérico libre, mirando la base Y la página (no siempre coinciden). */
function siguienteId() {
  let max = 0;
  for (const p of prods) { const n = Number(p.id); if (isFinite(n)) max = Math.max(max, n); }
  const abs = PAGINA;
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

const hechos = [], fallos = [], avisos = [];
/* mlId → lo que se apuntó para publicar, por si la página lo rechaza y hay que deshacerlo. */
const altas = new Map();
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

  const ahora = new Date().toISOString();
  const estadoPrevio = enB.estado;
  let nuevo, nombre, id;

  if (ES_FAMILIAS) {
    /* Página de familias: el catálogo es una variante de un modelo que ya está en la página.
       `item.modeloBase` es la salida de emergencia —Alan dice la familia a mano— y manda sobre
       lo que diga la API. Sin familia clara no se publica: se explica y se sigue con los demás. */
    /* El modelo tiene que venir del atributo MODEL de la API (`especs.modeloML`), nunca del
       campo `modelo` de la bandeja: ese cae en `TRADE_NAME` o en `LINE` cuando falta MODEL, y
       `LINE` de un iPhone 17 Pro es «iPhone 17» — justo el dato que metería la variante en la
       familia de al lado. Si no hay MODEL, se reporta y no se publica. */
    const fam = resolverFamilia(familiasPagina, {
      modelo: item.modeloML ?? especs.modeloML ?? null,
      modeloBase: item.modeloBase ?? enB.modeloBase ?? null,
    });
    if (!fam.ok) { nota(fam.motivo); continue; }

    const alta = altaVariante({
      familia: fam.familia,
      mlId: item.id,
      especs,
      precio: r.precio,
      linkML,
      linkAmz,
      imagen: item.imagen ?? enB.imagen ?? null,
      idsUsados,
    });
    if (!alta.ok) { nota(alta.motivo); continue; }

    id = alta.variante.id;
    nombre = alta.producto.nombre;
    idsUsados.add(id);
    nuevo = {
      ...alta.producto,
      gtin: enB.gtin ?? [],
      _mlAtributos: enB._mlAtributos ?? {},
      _precioFicha: r.precio,
      _precioLinkFecha: ahora,
      _altaDesde: 'catalogo-ml',
      _altaFecha: ahora,
      _updatedAt: ahora,
    };
    prods.push(nuevo);
    paraPagina.push({ modeloBase: fam.familia.modeloBase, variante: alta.variante });
    altas.set(item.id, { enB, estadoPrevio, nuevo });
    for (const a of alta.avisos) avisos.push({ id: item.id, aviso: a });
  } else {
    id = siguienteId();
    nombre = item.nombre ?? enB.nombre;
    nuevo = {
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
      _precioLinkFecha: ahora,
      _altaDesde: 'catalogo-ml',
      _altaFecha: ahora,
      _updatedAt: ahora,
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
  }

  enB.estado = 'publicado';
  enB.idBase = id;
  enB.publicadoEn = ahora;
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

/** Deshace un alta ya apuntada: sale de la base, de la página y de la cola, y la ficha vuelve
    a la bandeja como estaba. Se usa cuando algo se descubre DESPUÉS de resolver el enlace. */
function deshacerAlta(mlId, motivo) {
  fallos.push({ id: mlId, motivo });
  const i = paraPagina.findIndex(x => x.variante && x.variante.mlId === mlId);
  if (i >= 0) paraPagina.splice(i, 1);
  const reg = altas.get(mlId);
  if (!reg) return;
  const j = prods.indexOf(reg.nuevo);
  if (j >= 0) prods.splice(j, 1);
  reg.enB.estado = reg.estadoPrevio;
  delete reg.enB.idBase;
  delete reg.enB.publicadoEn;
  const k = hechos.findIndex(h => h.id === mlId);
  if (k >= 0) hechos.splice(k, 1);
}

/* ── Varias fichas para un mismo hueco: gana la más barata ───────────────────────────────────
   Mercado Libre tiene una ficha de catálogo por COLOR, pero la página guarda una variante por
   CAPACIDAD: de una tanda salen seis «iPhone 16 Plus 128 GB» —negro, blanco, rosa…— que son el
   mismo teléfono y el mismo sitio. Solo cabe una, y la que tiene que quedarse es la BARATA: el
   sitio existe para decir dónde conviene comprar, y publicar el mismo teléfono $900 más caro
   porque su ficha venía antes en la lista sería mentirle al visitante. El precio ya está
   resuelto a estas alturas —se acaba de abrir el enlace—, así que la comparación es real y no
   una estimación. Las que pierden se reportan con el precio que las dejó fuera, para poder
   revisarlo. Empate: gana la primera, que da igual cuál sea. */
if (ES_FAMILIAS && paraPagina.length) {
  const porHueco = new Map();
  for (const x of paraPagina) {
    const k = x.modeloBase + '|' + x.variante.almacenamientoGB;
    if (!porHueco.has(k)) porHueco.set(k, []);
    porHueco.get(k).push(x);
  }
  for (const [hueco, grupo] of porHueco) {
    if (grupo.length < 2) continue;
    const gana = grupo.reduce((a, b) => (b.variante.precio < a.variante.precio ? b : a));
    for (const x of grupo) {
      if (x === gana) continue;
      const donde = hueco.replace('|', ' de ') + ' GB';
      deshacerAlta(x.variante.mlId, gana.variante.precio < x.variante.precio
        ? `otra ficha del mismo ${donde} entró más barata ($${gana.variante.precio} contra $${x.variante.precio}): en la página solo cabe una por capacidad`
        : `otra ficha del mismo ${donde} entró al mismo precio ($${x.variante.precio}): en la página solo cabe una por capacidad`);
    }
  }
}

/* ── La página tiene la última palabra (solo en familias) ─────────────────────────────────────
   `agregarVariantes` es quien de verdad sabe si la variante cabe: puede rechazarla porque esa
   capacidad ya existe en la familia o porque el enlace ya está en otra variante. Se le pregunta
   EN SECO antes de escribir nada, y lo que rechace se deshace también en la base. Si no, la base
   diría que el producto está publicado y la página no lo tendría: justo la clase de desparejo
   que obliga después a averiguar a mano por qué falta una tarjeta. */
if (ES_FAMILIAS && paraPagina.length) {
  const prueba = agregarVariantes(PAGINA, cat.varName, paraPagina, { dryRun: true });
  if (!prueba.ok) {
    console.error(`\n⛔ ${cat.file} no se puede tocar: ${prueba.motivo}`);
    console.error('   No se escribe nada, ni en la base ni en la bandeja.');
    process.exit(1);
  }
  for (const f of prueba.fallos) deshacerAlta(f.mlId, f.motivo);
}

// ── informe ──
console.log(`\nCategoría: ${cat.titulo} (${cat.datos})`);
for (const h of hechos) {
  console.log(h.accion ? `  · ${h.id} — ${h.accion}`
    : `  ✓ ${h.id} → id ${h.idBase} · $${h.precio} · ${String(h.nombre).slice(0, 60)}`);
}
for (const f of fallos) console.log(`  ${f.baja ? 'x' : '⛔'} ${f.id} — ${f.motivo}`);
/* Solo los avisos de lo que de verdad entró: los demás se apuntaron antes de saber que esa ficha
   se iba a caer, y leer «revisa los saltos» de un producto que no se publicó solo despista. */
const publicados = new Set(hechos.filter(h => !h.accion).map(h => h.id));
for (const a of avisos) if (publicados.has(a.id)) console.log(`  ⚠ ${a.id} — ${a.aviso}`);
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
  const res = ES_FAMILIAS
    ? agregarVariantes(PAGINA, cat.varName, paraPagina)
    : agregarProductos(PAGINA, cat.varName, cat.tipo ?? 'plano', paraPagina);
  if (!res.ok) {
    console.error(`\n⛔ la página NO se tocó: ${res.motivo}`);
    console.error('   Tampoco se escribe la base, para que no queden desparejas.');
    guardarBandeja();
    process.exit(1);
  }
  const n = ES_FAMILIAS ? res.agregadas : res.agregados;
  console.log(`\n✓ ${cat.file}: ${n} ${ES_FAMILIAS ? 'variante(s) metida(s) en su familia' : 'producto(s) agregados'} en el array ${cat.varName}`);
}

writeFileSync(ADMIN_PATH, JSON.stringify(base, null, 2), 'utf8');
guardarBandeja();
console.log('✓ scripts/merged-admin.json y scripts/bandeja-nuevos.json actualizados');
console.log('  Siguiente: node scripts/sync-pausas.js · node scripts/sync-hub-counts.js · node scripts/generar-centro.js · node scripts/check-site.js');
