/**
 * _link-muerto.js — la regla única para un link de afiliado que ya no abre su producto.
 *
 * POR QUÉ EXISTE. Hasta nov-2026 un `link_roto` solo se PAUSABA: el link muerto se quedaba en la
 * base y el producto volvía a revisarse cada semana en la capa de links (20 min de corrida) sin
 * que nada cambiara nunca, porque un link de afiliado caído no resucita. Encima hacía falta una
 * excepción ("un pausado por link roto solo se reactiva con --links") para que la corrida diaria
 * no lo devolviera al sitio con el link roto intacto.
 *
 * LA REGLA. Un link que ya no abre su producto se RETIRA: sale de `linkML` y se guarda en
 * `_linkMuerto` como constancia. Con eso:
 *   · el producto deja de tener tienda, así que `sync-pausas.js` lo quita de la página;
 *   · la capa de links deja de revisarlo (no hay link que abrir): la corrida es más corta;
 *   · no hace falta la excepción de reactivación: sin link no hay nada que reactivar;
 *   · queda en la cola "necesita link nuevo" con su `mlId`, que es lo único que se requiere para
 *     generar uno nuevo desde la ficha de catálogo.
 * Nada se borra: nombre, precio, imagen, características, `mlId` y el propio link muerto se
 * conservan. Pegar un link nuevo en `linkML` devuelve el producto a la página.
 *
 * LO QUE NUNCA TOCA: una pausa puesta a mano (`pausaML` sin `_pausaAuto`). Si tú lo pausaste,
 * la pausa se queda como está; solo se retira el link.
 */

/** Estados de la revisión que significan "este link ya no sirve". */
export const LINK_MUERTO = new Set(['link_roto', 'link_otro']);

/**
 * ¿Este producto arrastra un link muerto CONFIRMADO por la revisión?
 * Vale el último resultado de la capa de links o el motivo de una pausa automática. La marca
 * suelta `_linkRevisar: 'link_caido'` NO basta: la dejó una auditoría y en algún producto la
 * revisión posterior dijo que el link estaba bien, así que retirar por esa marca borraría links
 * que sí funcionan. Esos se listan aparte con marcadoPorAuditoria().
 */
export function tieneLinkMuerto(p) {
  if (!p.linkML) return false;
  if (p._dispEstado === 'ok') return false;
  if (LINK_MUERTO.has(p._dispEstado)) return true;
  if (p._pausaAuto && LINK_MUERTO.has(p._motivoPausa)) return true;
  return false;
}

/**
 * Marcado como caído por la auditoría de links pero nunca confirmado por la revisión. No se
 * retira: primero hay que pasarle la capa de links (`--links`), que abre el link y comprueba
 * a dónde lleva de verdad.
 */
export function marcadoPorAuditoria(p) {
  return !!p.linkML && p._linkRevisar === 'link_caido' && !tieneLinkMuerto(p) && p._dispEstado !== 'ok';
}

/** El motivo con el que se retira, para dejarlo anotado. */
export function motivoLinkMuerto(p) {
  if (LINK_MUERTO.has(p._dispEstado)) return p._dispEstado;
  if (LINK_MUERTO.has(p._motivoPausa)) return p._motivoPausa;
  return 'link_caido';
}

/**
 * Retira el link muerto de un producto (muta el objeto) y devuelve lo que hizo.
 * `hoy` en formato YYYY-MM-DD.
 */
export function retirarLink(p, motivo, hoy) {
  const muerto = p.linkML;
  if (!muerto) return null;

  p._linkMuerto = muerto;
  p._linkMuertoFecha = hoy;
  p._linkMuertoMotivo = motivo;
  p.linkML = null;
  p._necesitaLink = true;

  // La pausa automática ya no pinta nada: lo que oculta el producto es quedarse sin tienda.
  // Una pausa puesta a mano se respeta.
  if (p._pausaAuto && LINK_MUERTO.has(p._motivoPausa)) {
    p.pausaML = false;
    delete p._pausaAuto;
    delete p._motivoPausa;
    delete p._pausaFecha;
  }

  p._dispEstado = 'sin_link';
  p._dispFecha = hoy;
  delete p._dispFallos;
  delete p._dispDesde;
  delete p._linkRevisar;
  delete p._linkSinProducto;

  return {
    id: String(p.id),
    nombre: p.nombre,
    motivo,
    linkMuerto: muerto,
    mlId: p.mlId || null,
    // Sin mlId no hay ficha de catálogo de donde sacar un link nuevo: esos hay que buscarlos
    // en Mercado Libre otra vez, o darlos de baja.
    recuperable: !!p.mlId,
    ficha: p.mlId ? `https://www.mercadolibre.com.mx/p/${p.mlId}` : null,
  };
}
