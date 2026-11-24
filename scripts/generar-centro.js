#!/usr/bin/env node
/**
 * generar-centro.js — arma scripts/centro-datos.json, el archivo que lee el
 * Centro de Control (artifact).
 *
 * NO toca nada: solo lee merged-admin.json, disponibilidad-report.json,
 * ml-report.json y ml-sugerencias.json y los resume.
 *
 *   node scripts/generar-centro.js
 *
 * El artifact se publica con este JSON al lado, así que después de correrlo hay
 * que volver a publicar el Centro de Control para que vea los datos nuevos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS } from './categorias.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(DIR, '..');
const leer = (p, def = null) => {
  try { return JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8')); }
  catch { return def; }
};

const base = leer('scripts/merged-admin.json', {});
const disp = leer('scripts/disponibilidad-report.json', {});
const mlRep = leer('scripts/ml-report.json', {});
const sug = leer('scripts/ml-sugerencias.json', {});

const DIAS_OFERTA_AMZ = 7;
const hoy = new Date();
const dias = (f) => (f ? Math.round((hoy - new Date(f)) / 86400000) : null);

const urlDe = (file) => '/' + String(file || '').replace(/index\.html$/, '');

// título/página por clave de DATOS (varias páginas pueden compartir la misma clave)
const porDatos = {};
for (const [clave, c] of Object.entries(CATEGORIAS)) {
  const k = c.datos || clave;
  if (!porDatos[k] || c.principal !== false) {
    porDatos[k] = { titulo: c.titulo, file: c.file, varName: c.varName, clavePagina: clave };
  }
}

const tieneBajada = (p) => {
  if (p._precioMLAntes && p.precioML && p._precioMLAntes > p.precioML) return true;
  if (p._precioAmzAntes && p.precioAmz && p._precioAmzAntes > p.precioAmz) {
    const d = dias(p._precioAmzFecha);
    return d !== null && d <= DIAS_OFERTA_AMZ;
  }
  return false;
};

// ¿Se ve hoy en la página? Mismo criterio con el que sync-pausas.js escribe el HTML:
// un producto sale de la lista cuando se queda sin ninguna tienda con link y sin pausa.
const visibilidad = (p) => {
  if (p._eliminado === true) return [false, 'eliminado'];
  if (p.activo === false) return [false, 'inactivo'];
  if (p._publicar === false) return [false, 'sin_publicar'];
  const ml = !!p.linkML && !p.pausaML;
  const amz = !!p.linkAmz && !p.pausaAmz;
  if (ml || amz) return [true, ml && amz ? 'ambas' : (ml ? 'solo_ml' : 'solo_amazon')];
  if (!p.linkML && p._necesitaLink) return [false, 'necesita_link'];
  if (!p.linkML && !p.linkAmz) return [false, 'sin_tienda'];
  return [false, p._motivoPausa || p._dispEstado || 'pausado'];
};

const estadoFila = (p) => {
  if (p.activo === false) return 'inactivo';
  if (p.pausaML && p.pausaAmz) return 'pausado';
  if (p.pausaML) return 'pausado-ml';
  if (p.pausaAmz) return 'pausado-amz';
  if (!p.linkML && !p.linkAmz) return 'sin-tienda';
  if (!p.mlId) return 'sin-id';
  return 'ok';
};

const productos = [];
const categorias = [];
let sinRegistrar = [];

for (const [clave, lista] of Object.entries(base)) {
  if (!Array.isArray(lista)) continue;
  const meta = porDatos[clave];
  if (!meta) sinRegistrar.push(clave);

  const filas = lista.map((p) => {
    const [visible, motivo] = visibilidad(p);
    return {
    cat: clave,
    catTitulo: meta?.titulo || clave,
    id: String(p.id ?? ''),
    nombre: p.nombre || '(sin nombre)',
    marca: p.marca || null,
    mlId: p.mlId || null,
    mlIdFuente: p.mlIdFuente || null,
    linkML: p.linkML || null,
    linkAmz: p.linkAmz || null,
    precioML: p.precioML ?? null,
    precioAmz: p.precioAmz ?? null,
    precioMLAntes: p._precioMLAntes ?? null,
    precioAmzAntes: p._precioAmzAntes ?? null,
    bajada: tieneBajada(p),
    activo: p.activo !== false,
    publicado: p._publicar !== false,
    enWeb: p._enWeb === true,
    pausaML: !!p.pausaML,
    pausaAmz: !!p.pausaAmz,
    pausaAuto: !!p._pausaAuto,
    motivoPausa: p._motivoPausa || null,
    pausaFecha: p._pausaFecha || null,
    estadoML: p.estadoML || null,
    dispEstado: p._dispEstado || null,
    dispFecha: p._dispFecha || null,
    dispFallos: p._dispFallos ?? null,
    revisado: p._mlCheckedAt || p._dispFecha || null,
    imagen: p.imagen || null,
    estado: estadoFila(p),
    visible,
    motivo,
    especs: p.especs && typeof p.especs === 'object' && Object.keys(p.especs).length ? p.especs : null,
    estrellas: p.estrellas ?? null,
    resenas: p.resenas ?? null,
    mlCatalogo: p._mlCatalogo || null,
    mlItemId: p._mlItemId || null,
    linkRevisar: p._linkRevisar || null,
    dispDesde: p._dispDesde || null,
    necesitaLink: p._necesitaLink === true,
    linkMuerto: p._linkMuerto || null,
    linkMuertoFecha: p._linkMuertoFecha || null,
    linkMuertoMotivo: p._linkMuertoMotivo || null,
    eliminado: p._eliminado === true,
    pausaAuto: !!p._pausaAuto,
    actualizado: p._updatedAt || null,
  };
  });
  productos.push(...filas);

  const cuenta = (f) => filas.filter(f).length;
  const precios = filas.map((f) => f.precioML).filter((n) => typeof n === 'number' && n > 0);
  categorias.push({
    clave,
    titulo: meta?.titulo || clave,
    file: meta?.file || null,
    url: meta ? urlDe(meta.file) : null,
    varName: meta?.varName || null,
    registrada: !!meta,
    total: filas.length,
    activos: cuenta((f) => f.activo),
    visibles: cuenta((f) => f.visible),
    pausados: cuenta((f) => f.pausaML || f.pausaAmz),
    pausadosAuto: cuenta((f) => f.pausaAuto),
    sinMlId: cuenta((f) => !f.mlId),
    necesitaLink: cuenta((f) => f.necesitaLink),
    sinLinkML: cuenta((f) => !f.linkML),
    conAmz: cuenta((f) => !!f.linkAmz),
    bajadas: cuenta((f) => f.bajada),
    problemas: cuenta((f) => ['link_roto', 'link_otro', 'no_existe', 'pausado', 'sin_id'].includes(f.dispEstado)),
    nuncaRevisado: cuenta((f) => !f.dispEstado),
    precioMin: precios.length ? Math.min(...precios) : null,
    precioMax: precios.length ? Math.max(...precios) : null,
    ultimaRevision: filas.map((f) => f.dispFecha).filter(Boolean).sort().pop() || null,
    disp: disp?.resumen?.[clave] || null,
  });
}

categorias.sort((a, b) => b.total - a.total);

const cuentaT = (f) => productos.filter(f).length;
const totales = {
  categorias: categorias.length,
  productos: productos.length,
  activos: cuentaT((p) => p.activo),
  pausados: cuentaT((p) => p.pausaML || p.pausaAmz),
  pausadosAuto: cuentaT((p) => p.pausaAuto),
  pausadosManual: cuentaT((p) => (p.pausaML || p.pausaAmz) && !p.pausaAuto),
  sinMlId: cuentaT((p) => !p.mlId),
  sinMlIdConLink: cuentaT((p) => !p.mlId && !!p.linkML),
  sinLinkML: cuentaT((p) => !p.linkML),
  conAmz: cuentaT((p) => !!p.linkAmz),
  bajadas: cuentaT((p) => p.bajada),
  visibles: cuentaT((p) => p.visible),
  ocultos: cuentaT((p) => !p.visible),
  problemas: cuentaT((p) => ['link_roto', 'link_otro', 'no_existe', 'sin_id'].includes(p.dispEstado)),
  nuncaRevisado: cuentaT((p) => !p.dispEstado),
  necesitaLink: cuentaT((p) => p.necesitaLink),
};

const cola = (f, n = 400) => productos.filter(f).slice(0, n).map((p) => ({
  cat: p.cat, catTitulo: p.catTitulo, id: p.id, nombre: p.nombre,
  linkML: p.linkML, mlId: p.mlId, precioML: p.precioML, imagen: p.imagen,
  linkMuerto: p.linkMuerto, linkMuertoFecha: p.linkMuertoFecha, necesitaLink: p.necesitaLink,
  dispEstado: p.dispEstado, dispFecha: p.dispFecha, motivoPausa: p.motivoPausa,
  pausaML: p.pausaML, pausaAuto: p.pausaAuto, activo: p.activo,
}));

const colas = {
  sinId: cola((p) => !p.mlId && p.activo),
  linkRoto: cola((p) => p.dispEstado === 'link_roto' || p.dispEstado === 'link_otro'),
  noExiste: cola((p) => p.dispEstado === 'no_existe' || p.dispEstado === 'pausado'),
  pausadoAuto: cola((p) => p.pausaAuto),
  nuncaRevisado: cola((p) => !p.dispEstado && p.activo),
  enObservacion: cola((p) => (p.dispFallos ?? 0) > 0 && !p.pausaML),
  sinTienda: cola((p) => !p.linkML && !p.linkAmz && p.activo && !p.necesitaLink),
  necesitaLink: cola((p) => p.necesitaLink && p.activo),
};

// duplicados por link de ML y por nombre normalizado
const porLink = {};
for (const p of productos) {
  if (!p.linkML) continue;
  (porLink[p.linkML] ||= []).push(`${p.cat}:${p.id}`);
}
const duplicados = Object.entries(porLink)
  .filter(([, v]) => v.length > 1)
  .map(([link, refs]) => ({ link, refs }))
  .slice(0, 200);

const sugerencias = Object.entries(sug || {})
  .filter(([k]) => k !== 'generado' && k !== 'fecha')
  .map(([cat, v]) => ({ cat, n: Array.isArray(v) ? v.length : 0 }));

const salida = {
  generado: new Date().toISOString(),
  fuente: {
    base: 'scripts/merged-admin.json',
    disponibilidad: disp?.fecha || null,
    dispConLinks: disp?.conLinks ?? null,
    dispAplicado: disp?.aplicado ?? null,
    mlReport: mlRep?.fecha || mlRep?.generado || null,
  },
  totales,
  disponibilidad: { fecha: disp?.fecha || null, totales: disp?.totales || null },
  // Cómo le fue a la última corrida de precios. Si no actualizó ni uno, la API no está
  // respondiendo y los precios del sitio se están quedando viejos sin que nada avise.
  precios: {
    fecha: mlRep?.fecha || null,
    actualizados: mlRep?.totales?.actualizados ?? null,
    sinCambio: mlRep?.totales?.sin_cambio ?? null,
    sinPrecio: mlRep?.totales?.sin_precio ?? null,
    noEncontrado: mlRep?.totales?.no_encontrado ?? null,
  },
  categoriasSinRegistrar: sinRegistrar,
  categorias,
  colas,
  duplicados,
  sugerencias,
  productos,
};

const dest = path.join(RAIZ, 'scripts', 'centro-datos.json');
fs.writeFileSync(dest, JSON.stringify(salida));
const kb = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`centro-datos.json escrito (${kb} KB)`);
console.log(`  ${totales.categorias} categorías · ${totales.productos} productos · ${totales.activos} activos`);
console.log(`  sin mlId: ${totales.sinMlId} (con link: ${totales.sinMlIdConLink}) · pausados: ${totales.pausados} (auto ${totales.pausadosAuto})`);
console.log(`  problemas de disponibilidad: ${totales.problemas} · nunca revisados: ${totales.nuncaRevisado}`);
if (sinRegistrar.length) console.log(`  OJO categorías sin registrar en categorias.js: ${sinRegistrar.join(', ')}`);
