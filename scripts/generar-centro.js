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
import { leerArray } from './_html-precios.js';
import { resolverFamilia } from './_familias-alta.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(DIR, '..');
const leer = (p, def = null) => {
  try { return JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8')); }
  catch { return def; }
};

const base = leer('scripts/merged-admin.json', {});
const disp = leer('scripts/disponibilidad-report.json', {});
const sug = leer('scripts/ml-sugerencias.json', {});
const linkRep = leer('scripts/precios-link-report.json', {});
const especsRep = leer('scripts/especs-report.json', {});
const bandejaRaw = leer('scripts/bandeja-nuevos.json', { categorias: {} });
const historialRaw = leer('scripts/busquedas-catalogo.json', { busquedas: [] });

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
  // Quedarse sin tienda se dice antes que lo de la tarjeta: es la causa, y la tarjeta que
  // falta es la consecuencia (`sync-pausas.js` la quita al no haber link). Al revés, los 18
  // productos a los que la revisión del 24-nov les retiró el enlace muerto salían en el
  // panel como "su tarjeta no está en la página" —que invita a reescribir el HTML— cuando
  // lo único que necesitan es un enlace de afiliado nuevo pegado en el Centro.
  if (!p.linkML && p._necesitaLink) return [false, 'necesita_link'];
  if (!p.linkML && !p.linkAmz) return [false, 'sin_tienda'];
  // Estar sano en la base no basta: la tarjeta tiene que existir en el array de su página.
  // `marcar-publicados.js` lo comprueba leyendo el HTML y lo anota en `_enWeb`. Nov-2026, al
  // revivir 30 productos marcados como eliminados a mano, 22 seguían fuera del array de su
  // página: sin esto el panel los habría dado por publicados y nadie habría sabido que faltaba
  // devolverles la tarjeta. `undefined` no cuenta: hay categorías que ese script no mapea.
  if (p._enWeb === false) return [false, 'falta_en_la_pagina'];
  const ml = !!p.linkML && !p.pausaML;
  const amz = !!p.linkAmz && !p.pausaAmz;
  if (ml || amz) return [true, ml && amz ? 'ambas' : (ml ? 'solo_ml' : 'solo_amazon')];
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
    necesitaEspecs: p._necesitaEspecs === true,
    pausadaDesde: p._pausadaDesde || null,
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
    problemas: cuenta((f) => ['link_roto', 'link_otro', 'no_existe', 'tarjeta_defecto', 'pausado', 'sin_id'].includes(f.dispEstado)),
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
  problemas: cuentaT((p) => ['link_roto', 'link_otro', 'no_existe', 'tarjeta_defecto', 'sin_id'].includes(p.dispEstado)),
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
  noExiste: cola((p) => p.dispEstado === 'no_existe' || p.dispEstado === 'tarjeta_defecto' || p.dispEstado === 'pausado'),
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


/* ── Bandeja de productos nuevos (descubrir-catalogo.mjs) ────────────────────
   Va en su PROPIO archivo, no dentro de datos.json: son 150 fichas con todos sus atributos de
   Mercado Libre y engordarían el arranque del Centro para una vista que casi nunca se abre. El
   Centro lo pide con fetch solo cuando entras al filtro «Nuevos sin publicar», igual que hace
   con las miniaturas. En datos.json queda únicamente el conteo, que es lo que pinta el
   indicador de arriba. */
const PENDIENTES = new Set(['new_unpublished', 'revisar']);
/* En qué familia de la página entra cada ficha de la bandeja. Se calcula AQUÍ, contra la página
   tal como está hoy, y no se copia el `_familia` que dejó el descubrimiento: la página cambia
   por su cuenta —en cuanto se escribe la familia de un modelo, sus fichas dejan de estar
   huérfanas— y un valor guardado seguiría diciendo «sin familia» hasta la siguiente búsqueda.
   Es la misma pregunta que hace `aplicar-nuevos.mjs` al publicar, así que el Centro enseña
   exactamente lo que va a pasar. */
const familiasDe = {};
for (const clave of Object.keys(bandejaRaw.categorias || {})) {
  const cat = CATEGORIAS[clave];
  if (!cat || (cat.tipo ?? 'plano') !== 'familias') continue;
  const r = leerArray(path.join(RAIZ, cat.file), cat.varName);
  if (r.ok) familiasDe[clave] = r.datos;
  else console.warn(`  ⚠ no se pudo leer ${cat.file} (${r.motivo}): la bandeja de ${clave} irá sin familia`);
}
const familiaDe = (clave, p) => {
  const fams = familiasDe[clave];
  if (!fams) return { familia: undefined, motivo: null };
  const r = resolverFamilia(fams, { modelo: (p.especs || {}).modeloML || null });
  return r.ok ? { familia: r.familia.modeloBase, motivo: null } : { familia: null, motivo: r.motivo };
};
/* Las faltantes se RECALCULAN aquí, no se copian de la bandeja: la lista de obligatorias de la
   categoría cambia (en nov-2026 proteinaPorPorcion pasó de bloquear a solo avisar) y las fichas
   guardadas antes del cambio seguirían diciendo que les falta algo que ya no se exige. */
const faltanDe = (p, claves) => (claves || []).filter((k) => {
  const v = (p.especs || {})[k];
  return v === undefined || v === null || String(v).trim() === '';
});
const bandejaCats = [];
const bandejaDetalle = {};
for (const [clave, info] of Object.entries(bandejaRaw.categorias || {})) {
  const todos = info.productos || [];
  const pend = todos.filter((p) => PENDIENTES.has(p.estado));
  const obligatorias = CATEGORIAS[clave]?.descubrir?.obligatorias || [];
  const recomendadas = CATEGORIAS[clave]?.descubrir?.recomendadas || [];
  bandejaCats.push({
    clave,
    titulo: info.titulo || porDatos[clave]?.titulo || clave,
    actualizado: info.actualizado || null,
    nuevos: todos.filter((p) => p.estado === 'new_unpublished').length,
    revisar: todos.filter((p) => p.estado === 'revisar').length,
    sinEnlace: pend.filter((p) => !p.linkML).length,
    // Los del ranking de más vendidos: los únicos de los que sabemos que tienen vendedor hoy.
    seVenden: pend.filter((p) => p.seVende === true).length,
    sinValidar: pend.filter((p) => faltanDe(p, obligatorias).length).length,
    // Los que piden trabajo: sin enlace O sin las características obligatorias. Contados una
    // sola vez, no sumando las dos colas: casi siempre son el mismo producto.
    atencion: pend.filter((p) => !p.linkML || faltanDe(p, obligatorias).length).length,
    publicados: todos.filter((p) => p.estado === 'publicado').length,
    eliminados: todos.filter((p) => p.estado === 'eliminado').length,
    ultimaBusqueda: info.ultimaBusqueda
      ? {
          crudos: info.ultimaBusqueda.crudos, relevantes: info.ultimaBusqueda.relevantes,
          duplicados: info.ultimaBusqueda.duplicados, posiblesDuplicados: info.ultimaBusqueda.posiblesDuplicados,
          descartes: info.ultimaBusqueda.descartes, guardados: info.ultimaBusqueda.guardados,
          candidatos: info.ultimaBusqueda.candidatos, errores: info.ultimaBusqueda.errores,
          ejemplosDescarte: (info.ultimaBusqueda.ejemplosDescarte || []).slice(0, 5),
        }
      : null,
  });
  bandejaDetalle[clave] = {
    titulo: info.titulo || clave,
    actualizado: info.actualizado || null,
    obligatorias,
    recomendadas,
    /* true en las categorías de FAMILIAS (celulares): ahí un catálogo no es una tarjeta, es una
       variante de un modelo, así que la ficha lleva también la familia donde entra y sin ella no
       se puede publicar. El Centro lo usa para no dejar mandar al workflow un alta que
       aplicar-nuevos.mjs va a rechazar. */
    familias: (CATEGORIAS[clave]?.tipo ?? 'plano') === 'familias' || undefined,
    productos: pend.map((p) => ({
      id: p.id, catalogId: p.catalogId, estado: p.estado, nombre: p.nombre, marca: p.marca,
      modelo: p.modelo, gtin: p.gtin || [], imagen: p.imagen, imagenes: (p.imagenes || []).slice(0, 4),
      descripcion: (p.descripcion || '').slice(0, 700) || null,
      caracteristicas: (p.caracteristicas || []).slice(0, 6),
      variantes: (p.variantes || []).slice(0, 12),
      urlML: p.urlML, especs: p.especs || {}, atributos: p._mlAtributos || {},
      faltantes: faltanDe(p, obligatorias), avisos: faltanDe(p, recomendadas),
      posibleDuplicadoDe: p.posibleDuplicadoDe || null,
      termino: p.termino, detectadoEn: p.detectadoEn, actualizadoML: p.actualizadoML || null,
      fuente: p.fuente || 'busqueda', seVende: p.seVende === true,
      ...(() => { const f = familiaDe(clave, p); return f.familia === undefined ? {} : { familia: f.familia, familiaMotivo: f.motivo }; })(),
      linkML: p.linkML || null, linkAmz: p.linkAmz || null,
    })),
  };
}
const bandejaDest = path.join(RAIZ, 'scripts', 'centro-bandeja.json');
fs.writeFileSync(bandejaDest, JSON.stringify(bandejaDetalle));

const salida = {
  generado: new Date().toISOString(),
  fuente: {
    base: 'scripts/merged-admin.json',
    disponibilidad: disp?.fecha || null,
    dispConLinks: disp?.conLinks ?? null,
    dispAplicado: disp?.aplicado ?? null,
  },
  totales,
  disponibilidad: { fecha: disp?.fecha || null, totales: disp?.totales || null },
  // `precios` era el resumen de ml-report.json, el actualizador por API que se retiró en
  // nov-2026. Lo que hay ahora es `preciosLink`, abajo.
  // Cómo le fue a la última corrida de PRECIOS POR ENLACE (el plan B mientras la API de ML
  // esté cerrada). Lo importante aquí no es solo cuántos precios cambiaron, sino si la corrida
  // se frenó o lleva días sin ejecutarse: si nadie avisa, el sitio enseña precios viejos con
  // toda naturalidad, que es exactamente lo que pasó entre el 23 y el 24 de noviembre.
  preciosLink: (() => {
    const t = linkRep?.totales;
    if (!t) return null;
    const diasDesde = dias(linkRep.generado || linkRep.fecha);
    return {
      fecha: linkRep.fecha || null,
      generado: linkRep.generado || null,
      dias: diasDesde,
      aplicado: linkRep.aplicado ?? null,
      escribio: linkRep.escribio ?? null,
      frenado: linkRep.frenado === true,
      maxSalto: linkRep.maxSalto ?? null,
      categorias: linkRep.categorias || [],
      revisadas: linkRep.revisadas || {},
      porCategoria: linkRep.porCategoria || {},
      revisados: t.revisados ?? 0,
      cambiaron: t.ok ?? 0,
      bajaron: t.bajaron ?? 0,
      subieron: t.subieron ?? 0,
      sinCambio: t.sin_cambio ?? 0,
      fueraPorSalto: t.salto ?? 0,
      linksRotos: (t.link_roto ?? 0) + (t.link_otro ?? 0),
      yaNoExisten: (t.tarjeta_defecto ?? 0) + (t.no_existe ?? 0),
      linksRetirados: t.links_retirados ?? 0,
      pausados: t.pausados_ahora ?? 0,
      reactivados: t.reactivados_ahora ?? 0,
      enObservacion: t.en_observacion ?? 0,
      errores: t.error ?? 0,
      apiViva: linkRep.api?.viva === true,
      apiStatus: linkRep.api?.status ?? null,
      // Qué tiene que ver Alan en rojo en el dashboard, y por qué.
      alerta: linkRep.frenado === true
        ? 'La última corrida se frenó: casi nada se resolvió bien y no se escribió nada en la base.'
        : (diasDesde != null && diasDesde >= 2
          ? 'La última revisión de precios es de hace ' + diasDesde + ' días: los precios del sitio se están quedando viejos.'
          : null),
      // La cola de gracia: pausadas en ML con los días que les quedan antes de borrarse.
      diasGracia: linkRep.diasGracia ?? null,
      enGracia: (linkRep.enGracia || []).slice(0, 300),
      borrados: (linkRep.borrados || []).slice(0, 300),
      // Los que el tope de salto dejó fuera: hay que mirarlos a mano.
      revisar: (linkRep.productos || []).filter((p) => p.estado === 'salto').slice(0, 200).map((p) => ({
        cat: p.categoria, catTitulo: p.titulo, id: p.id, nombre: p.nombre,
        precioEnSitio: p.precioEnSitio, precioEnLink: p.precioEnLink,
        variacion: p.variacion, linkML: p.linkML, mlId: p.mlId, fecha: p.fecha,
      })),
    };
  })(),
  // Características e imagen traídas de la API (lo único que sigue respondiendo).
  especs: especsRep?.totales ? {
    fecha: especsRep.fecha || null, aplicado: especsRep.aplicado ?? null,
    ...especsRep.totales,
  } : null,
  // Altas pegadas en el gestor que todavía no han pasado por especs-por-id.mjs.
  necesitanEspecs: productos.filter((p) => p.necesitaEspecs).length,
  // La bandeja: solo el conteo. Las fichas van en bandeja.json, que el Centro pide aparte.
  bandeja: {
    generado: bandejaRaw.generado || null,
    categorias: bandejaCats,
    pendientes: bandejaCats.reduce((n, c) => n + c.nuevos + c.revisar, 0),
    sinEnlace: bandejaCats.reduce((n, c) => n + c.sinEnlace, 0),
    sinValidar: bandejaCats.reduce((n, c) => n + c.sinValidar, 0),
    atencion: bandejaCats.reduce((n, c) => n + c.atencion, 0),
    seVenden: bandejaCats.reduce((n, c) => n + c.seVenden, 0),
    historial: (historialRaw.busquedas || []).slice(0, 20),
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
console.log(`  bandeja: ${salida.bandeja.pendientes} sin publicar en ${bandejaCats.length} categoría(s) → centro-bandeja.json (${(fs.statSync(bandejaDest).size / 1024).toFixed(0)} KB)`);
if (sinRegistrar.length) console.log(`  OJO categorías sin registrar en categorias.js: ${sinRegistrar.join(', ')}`);
