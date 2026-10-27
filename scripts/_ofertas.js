// Lógica compartida de ofertas: la usan generar-*-descuentos.js y extraer-artifact.js.
// Mercado Libre: _precioMLAntes lo escribe generar-admin.js al aplicar ml-report.json.
// Amazon: _precioAmzAntes + _precioAmzFecha los escribe el artifact cuando se captura un precio menor.
export const DIAS_OFERTA_AMZ = 7;
// Un producto "nuevo" (hallado por la búsqueda de ML) no se muestra hasta que se publica desde el artifact (_publicar).
export const publicado = p => !(p.estadoML === 'nuevo' && !p._publicar);
const AMZ_TAG = 'comparalo20-20';
const tagOk = u => new RegExp('[?&]tag=' + AMZ_TAG + '(?:[&#]|$)').test(u || '');

export function amzVigente(p, ahora = Date.now()) {
  const t = Date.parse(p._precioAmzFecha);
  return p._precioAmzAntes > 0 && isFinite(t) && ahora - t <= DIAS_OFERTA_AMZ * 864e5;
}

const conPct = b => ({ ...b, ahorro: Math.round(b.antes - b.precio), pct: Math.round((b.antes - b.precio) / b.antes * 100) });

export function bajadaML(p) {
  if (!p.precioML || !p.linkML || !(p._precioMLAntes > p.precioML)) return null;
  return conPct({ plataforma: 'ml', precio: p.precioML, antes: p._precioMLAntes, link: p.linkML });
}

export function bajadaAmz(p, ahora = Date.now()) {
  if (!p.precioAmz || !p.linkAmz || !tagOk(p.linkAmz) || p.pausaAmz) return null;
  if (!amzVigente(p, ahora) || !(p._precioAmzAntes > p.precioAmz)) return null;
  const b = conPct({ plataforma: 'amazon', precio: p.precioAmz, antes: p._precioAmzAntes, link: p.linkAmz });
  return b.pct >= 1 ? b : null;
}

// La bajada de mayor porcentaje entre las dos tiendas, o null.
export function mejorBajada(p, ahora = Date.now()) {
  return [bajadaML(p), bajadaAmz(p, ahora)].filter(Boolean).sort((a, b) => b.pct - a.pct)[0] || null;
}

// Campos que los consumidores (inicio, páginas, guías) leen para pintar la oferta.
export const camposOferta = b => ({
  plataforma: b.plataforma, precioOferta: b.precio, precioAntes: b.antes, ahorro: b.ahorro, pct: b.pct, link: b.link,
});
