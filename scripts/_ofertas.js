// Lógica compartida de ofertas: la usan generar-*-descuentos.js y extraer-artifact.js.
// Mercado Libre: _precioMLAntes lo escribe generar-admin.js al aplicar ml-report.json.
// Amazon: _precioAmzAntes + _precioAmzFecha los escribe el artifact cuando se captura un precio menor.
export const DIAS_OFERTA_AMZ = 30;
export const DIAS_OFERTA_ML = 30;
// Un producto "nuevo" (hallado por la búsqueda de ML) no se muestra hasta que se publica desde el artifact (_publicar).
export const publicado = p => !(p.estadoML === 'nuevo' && !p._publicar);
const AMZ_TAG = 'comparalo20-20';
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
  if (!p.precioML || !p.linkML || !(p._precioMLAntes > p.precioML)) return null;
  if (!mlVigente(p, ahora)) return null;
  return conPct({ plataforma: 'ml', precio: p.precioML, antes: p._precioMLAntes, link: p.linkML });
}

export function bajadaAmz(p, ahora = Date.now()) {
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
