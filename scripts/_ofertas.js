// Lógica compartida de ofertas: la usan generar-*-descuentos.js y extraer-artifact.js.
// Mercado Libre: _precioMLAntes lo escribe generar-admin.js al aplicar ml-report.json.
// Amazon: _precioAmzAntes + _precioAmzFecha los escribe el artifact cuando se captura un precio menor.
export const DIAS_OFERTA_AMZ = 30;
export const DIAS_OFERTA_ML = 30;
// Un producto "nuevo" (hallado por la búsqueda de ML) no se muestra hasta que se publica desde el
// artifact (_publicar) — PERO si ya está escrito en su página, está publicado y punto. Nov-2026:
// las 27 proteínas del 28-oct (commit 3d927a09) se escribieron en la página y en la base el mismo
// día, sin pasar nunca por esa aprobación, así que para el sitio llevaban un mes vendiendo y para
// esta función seguían siendo candidatas. Resultado: la corrida de precios las saltaba (el Mutant
// Whey Triple Chocolate anunciaba $986 del 22-nov cuando costaba $883), su ficha decía "todavía no
// tenemos histórico" sobre un mes de datos ya registrados, y ni ofertas ni bajadas las miraban.
// `_enWeb` lo anota marcar-publicados.js leyendo el array de cada página, así que esto dice
// exactamente lo que se ve en el sitio. Lo que NO está en la web se sigue callando igual que antes.
export const publicado = p => p._enWeb === true || !(p.estadoML === 'nuevo' && !p._publicar);
// Un producto que ya no se vende no puede anunciar una oferta. Nov-2026: la AMYET SE1
// estaba con activo:false y _eliminado:true y aun así el inicio la anunciaba con −72%
// ($3,999 contra $14,499) cuando su publicación está pausada en $25,000 — el precio venía
// además del catálogo equivocado. Sin este filtro la oferta sobrevive a la baja del producto.
// Lo usan TODOS los generadores de ofertas y bajadas. Hasta nov-2026 estaba escrito pero no se
// llamaba en ninguno: filtraban solo por `activo !== false`, así que un producto pausado en ML
// (a mano o por revisar-disponibilidad.js) podía seguir anunciándose como oferta en el inicio.
export const vendible = p => p.activo !== false && !p._eliminado && !p.pausaML
  && p.estadoML !== 'no_encontrado' && p.estadoML !== 'pausado';
const AMZ_TAG = 'guiasdecomp01-20';
const tagOk = u => new RegExp('[?&]tag=' + AMZ_TAG + '(?:[&#]|$)').test(u || '');

export function amzVigente(p, ahora = Date.now()) {
  const t = Date.parse(p._precioAmzFecha);
  return p._precioAmzAntes > 0 && isFinite(t) && ahora - t <= DIAS_OFERTA_AMZ * 864e5;
}

const conPct = b => ({ ...b, ahorro: Math.round(b.antes - b.precio), pct: Math.round((b.antes - b.precio) / b.antes * 100) });

export function mlVigente(p, ahora = Date.now()) {
  if (!p._precioMLFecha) return true; // sin fecha → retrocompatible, siempre vigente
  const t = Date.parse(p._precioMLFecha);
  return isFinite(t) && ahora - t <= DIAS_OFERTA_ML * 864e5;
}

// Racha de bajada de ML (_precioMLAntes / _precioMLFecha) tras aplicar una fila de ml-report.json.
// La bajada dura DIAS_OFERTA_ML días aunque en las corridas siguientes el precio ya no cambie:
// antes se borraba en la primera corrida "sin_cambio" y la bajada desaparecía de la web al día siguiente.
//  - bajó hoy: ancla = precio anterior (o el más alto de la racha si ya venía bajando) y la fecha se renueva;
//  - sin cambio / subió sin llegar al ancla / dato dudoso: se conserva mientras siga por debajo del ancla;
//  - volvió al ancla o más, o sin precio: se borra.
export function actualizarRachaML(p, row, hoy = new Date().toISOString().slice(0, 10), ahora = Date.now()) {
  const antes = p._precioMLAntes, fecha = p._precioMLFecha;
  const racha = antes > 0 && (!fecha || (isFinite(Date.parse(fecha)) && ahora - Date.parse(fecha) <= DIAS_OFERTA_ML * 864e5));
  const bajo = row.estado === 'actualizado' && row.precioAntes != null && typeof p.precioML === 'number' && p.precioML < row.precioAntes;
  if (bajo) {
    p._precioMLAntes = racha && antes > row.precioAntes ? antes : row.precioAntes;
    if (antes !== row.precioAntes || !fecha) p._precioMLFecha = hoy;
  } else if (!(racha && typeof p.precioML === 'number' && p.precioML < antes)) {
    delete p._precioMLAntes; delete p._precioMLFecha;
  }
}

export function bajadaML(p, ahora = Date.now()) {
  if (!vendible(p)) return null;
  if (!p.precioML || !p.linkML || !(p._precioMLAntes > p.precioML)) return null;
  if (!mlVigente(p, ahora)) return null;
  return conPct({ plataforma: 'ml', precio: p.precioML, antes: p._precioMLAntes, link: p.linkML });
}

export function bajadaAmz(p, ahora = Date.now()) {
  if (!vendible(p)) return null;
  // POLÍTICA: no se publican precios ni ofertas de Amazon en el sitio. Amazon nunca
  // genera una bajada/oferta pública. Se conserva la lógica abajo (inalcanzable) por si
  // se revierte la política; _precioAmzAntes/_precioAmzFecha siguen guardándose en los datos.
  return null;
  if (!p.precioAmz || !p.linkAmz || !tagOk(p.linkAmz) || p.pausaAmz) return null;
  if (!amzVigente(p, ahora) || !(p._precioAmzAntes > p.precioAmz)) return null;
  const b = conPct({ plataforma: 'amazon', precio: p.precioAmz, antes: p._precioAmzAntes, link: p.linkAmz });
  return b.pct >= 1 ? b : null;
}

// La bajada de mayor porcentaje entre las dos tiendas, o null.
export function mejorBajada(p, ahora = Date.now()) {
  return [bajadaML(p, ahora), bajadaAmz(p, ahora)].filter(Boolean).sort((a, b) => b.pct - a.pct)[0] || null;
}

// Campos que los consumidores (inicio, páginas, guías) leen para pintar la oferta.
export const camposOferta = b => ({
  plataforma: b.plataforma, precioOferta: b.precio, precioAntes: b.antes, ahorro: b.ahorro, pct: b.pct, link: b.link,
});
