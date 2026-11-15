/**
 * cmx-historico.js — histórico de precios de Mercado Libre de los últimos 30 días.
 *
 * Lee assets/data/historico/<categoria>.json (lo escribe scripts/generar-historico.js) y lo muestra
 * en dos lugares:
 *   1. desde la tarjeta de un listado, en una VENTANA SUPERPUESTA (no expande la tarjeta);
 *   2. dentro de la comparativa, como una gráfica por producto bajo la tabla de características.
 *
 * Reglas (ver CLAUDE.md y la skill aplicar-plantilla-listado):
 *  - no se inventa ni se interpola nada: los días sin registro se dibujan punteados;
 *  - con menos de 7 registros NO hay gráfica, solo el aviso de desde cuándo registramos;
 *  - la variación solo se publica con 14 registros o más (la trae el JSON o no viene);
 *  - el precio es el de catálogo de Mercado Libre (la oferta más barata con envío FULL),
 *    no el de un vendedor en particular, y así se dice en el pie.
 *
 * El JSON se baja UNA sola vez y solo cuando alguien abre el primer histórico de la página.
 */
(function () {
  'use strict';

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var money = function (n) { return '$' + Math.round(n).toLocaleString('es-MX'); };
  var mxn = function (n) { return money(n) + ' MXN'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /** "2026-10-17" → "17 oct" | "17 de octubre" | "17 de noviembre de 2026".
   *  Sin new Date(): evita el corrimiento de un día por zona horaria de las fechas ISO. */
  var fecha = function (f, modo) {
    var p = String(f || '').split('-');
    if (p.length !== 3) return '';
    var d = +p[2], m = +p[1] - 1;
    if (modo === 'larga') return d + ' de ' + MESES_L[m];
    if (modo === 'completa') return d + ' de ' + MESES_L[m] + ' de ' + p[0];
    return d + ' ' + MESES[m];
  };
  var svgIc = function (d, n, sw) {
    return '<svg width="' + (n || 16) + '" height="' + (n || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'
      + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };
  var IC_CHART = '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="12" width="3.5" height="7"/><rect x="10.2" y="7" width="3.5" height="12"/><rect x="15.4" y="14" width="3.5" height="5"/>';
  var IC_TABLE = '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="9" y1="9.5" x2="9" y2="20"/>';
  var IC_INFO = '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.6" x2="12.01" y2="7.6"/>';
  var IC_CHEV = '<polyline points="6 9 12 15 18 9"/>';

  var CATS = [], datos = null, pendiente = null;

  /**
   * Declara de qué categoría (o categorías) es esta página. No baja nada todavía.
   * Una guía puede mezclar productos de varias: init(['celulares_android', 'celulares_iphone']).
   */
  function init(categorias) {
    CATS = [].concat(categorias || []).filter(Boolean);
  }

  function cargar() {
    if (datos) return Promise.resolve(datos);
    if (pendiente) return pendiente;
    if (!CATS.length) return Promise.resolve(null);
    pendiente = Promise.all(CATS.map(function (c) {
      return fetch('/assets/data/historico/' + c + '.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    })).then(function (lista) {
      var ok = lista.filter(Boolean);
      if (!ok.length) return null;
      if (ok.length === 1) { datos = ok[0]; return datos; }
      // Todos los archivos se generan en la misma corrida y comparten la ventana de 30 días.
      // Si alguno trae otra ventana no se mezcla: dos periodos distintos no van en una gráfica.
      var base = ok.slice().sort(function (a, b) { return (b.fechas || []).length - (a.fechas || []).length; })[0];
      var clave = (base.fechas || []).join();
      var productos = {};
      ok.forEach(function (j) {
        if ((j.fechas || []).join() !== clave) return;
        Object.keys(j.productos || {}).forEach(function (id) {
          if (!(id in productos)) productos[id] = j.productos[id];
        });
      });
      datos = { generado: base.generado, ventana: base.ventana, desde: base.desde, hasta: base.hasta, fechas: base.fechas, productos: productos };
      return datos;
    });
    return pendiente;
  }

  function de(id) { return (datos && datos.productos && datos.productos[String(id)]) || null; }
  /** ¿Se puede dibujar? Con menos de 7 registros, no. */
  function graficable(d) { return !!(d && d.p && d.p.length && d.estado !== 'nuevo' && d.estado !== 'insuficiente'); }

  /* ── Serie diaria ─────────────────────────────────────────────────────────
     El precio se mantiene hasta el siguiente cambio: eso es lo que de verdad pasó.
     Los días sin registro quedan en null y se dibujan punteados. */
  function diaria(d, nDias) {
    var huecos = {}; (d.huecos || []).forEach(function (i) { huecos[i] = 1; });
    var val = [], actual = null, k = 0;
    for (var i = 0; i < nDias; i++) {
      while (k < d.p.length && d.p[k][0] <= i) { actual = d.p[k][1]; k++; }
      val.push(huecos[i] ? null : actual);
    }
    return val;
  }
  function tramos(val) {
    var seg = [], cur = null;
    for (var j = 0; j < val.length; j++) {
      if (val[j] == null) { if (cur) { seg.push(cur); cur = null; } continue; }
      if (!cur) cur = [];
      cur.push([j, val[j]]);
    }
    if (cur) seg.push(cur);
    return seg;
  }

  /** Escalones "bonitos" para el eje de precios. */
  function ticks(lo, hi, n) {
    var span = hi - lo || Math.max(1, hi * 0.05);
    var crudo = span / Math.max(1, n - 1);
    var mag = Math.pow(10, Math.floor(Math.log(crudo) / Math.LN10));
    var paso = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (p) { return p >= crudo; })[0] || mag * 10;
    var ini = Math.floor(lo / paso) * paso, out = [];
    for (var v = ini; v <= hi + paso * 0.001; v += paso) if (v >= lo - paso * 0.001) out.push(Math.round(v));
    return out;
  }

  /**
   * Gráfica SVG.
   * @param o.w,o.h   tamaño del viewBox
   * @param o.lo,o.hi escala forzada (la comparativa la comparte entre productos)
   * @param o.ejeY    etiquetas de precio a la izquierda
   * @param o.badge   globo con el último precio registrado
   * @param o.minimo  marca del mínimo del periodo
   * @param o.marcas  cuántas fechas poner abajo
   */
  function chart(d, fechas, o) {
    o = o || {};
    var n = fechas.length, val = diaria(d, n), seg = tramos(val);
    if (!seg.length) return '';
    var W = o.w || 640, H = o.h || 250;
    var PT = o.badge ? 26 : 12, PB = 26, PR = o.badge ? 58 : 10, PL = o.ejeY ? 52 : 6;
    var lo = o.lo != null ? o.lo : d.min, hi = o.hi != null ? o.hi : d.max;
    var ejes = ticks(lo, hi, 5);
    if (ejes.length) { lo = Math.min(lo, ejes[0]); hi = Math.max(hi, ejes[ejes.length - 1]); }
    var span = hi - lo || Math.max(1, hi * 0.05);
    var x = function (i) { return PL + (i / Math.max(1, n - 1)) * (W - PL - PR); };
    var y = function (v) { return PT + (1 - (v - lo) / span) * (H - PT - PB); };

    var rejilla = ejes.map(function (v) {
      return '<line x1="' + PL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y(v).toFixed(1) + '" stroke="#EDF0F3" stroke-width="1"/>'
        + (o.ejeY ? '<text x="' + (PL - 8) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="11" fill="#64748b">' + money(v) + '</text>' : '');
    }).join('');

    // Área bajo la línea + línea escalonada.
    var area = '', lineas = seg.map(function (s) {
      var dd = 'M' + x(s[0][0]).toFixed(1) + ' ' + y(s[0][1]).toFixed(1);
      for (var m = 1; m < s.length; m++) dd += ' H' + x(s[m][0]).toFixed(1) + ' V' + y(s[m][1]).toFixed(1);
      if (o.area !== false) {
        area += '<path d="' + dd + ' V' + y(lo).toFixed(1) + ' H' + x(s[0][0]).toFixed(1) + ' Z" fill="#00843D" opacity=".08"/>';
      }
      return '<path d="' + dd + '" fill="none" stroke="#00843D" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');

    var puentes = '';
    for (var s2 = 1; s2 < seg.length; s2++) {
      var a = seg[s2 - 1][seg[s2 - 1].length - 1], b = seg[s2][0];
      puentes += '<path d="M' + x(a[0]).toFixed(1) + ' ' + y(a[1]).toFixed(1) + ' L' + x(b[0]).toFixed(1) + ' ' + y(b[1]).toFixed(1)
        + '" fill="none" stroke="#9ca3af" stroke-width="1.6" stroke-dasharray="4 4"/>';
    }

    var ult = seg[seg.length - 1][seg[seg.length - 1].length - 1];
    var cx = x(ult[0]), cy = y(ult[1]);
    var punto = '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="#00843D" stroke="#fff" stroke-width="2"/>';

    var badge = '';
    if (o.badge) {
      var bw = 78, bh = 30, bx = Math.min(W - bw - 2, cx - bw / 2 + 24), by = Math.max(2, cy - bh - 12);
      badge = '<g><rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw + '" height="' + bh + '" rx="7" fill="#00843D"/>'
        + '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + 13).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">' + money(ult[1]) + '</text>'
        + '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + 24).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#CFEBDA">(' + esc(fecha(fechas[ult[0]])) + ')</text></g>';
    }

    // Marca del mínimo del periodo (solo si no coincide con el último punto).
    var marcaMin = '';
    if (o.minimo && d.min !== ult[1]) {
      var im = -1;
      for (var q = 0; q < val.length; q++) if (val[q] === d.min) { im = q; break; }
      if (im >= 0) {
        var mx = x(im), my = y(d.min), mw = 74, bx2 = Math.min(W - PR - mw, Math.max(PL, mx - mw / 2));
        marcaMin = '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="3.4" fill="#fff" stroke="#00843D" stroke-width="2"/>'
          + '<g><rect x="' + bx2.toFixed(1) + '" y="' + (my - 40).toFixed(1) + '" width="' + mw + '" height="28" rx="6" fill="#fff" stroke="#D8E6DD"/>'
          + '<text x="' + (bx2 + mw / 2).toFixed(1) + '" y="' + (my - 29).toFixed(1) + '" text-anchor="middle" font-size="9" fill="#64748b">Mínimo</text>'
          + '<text x="' + (bx2 + mw / 2).toFixed(1) + '" y="' + (my - 18).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">' + money(d.min) + '</text></g>';
      }
    }

    var cuantas = o.marcas || 6;
    var idxs = [];
    for (var t = 0; t < cuantas; t++) idxs.push(Math.round((t / (cuantas - 1)) * (n - 1)));
    idxs = idxs.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    var fechasTxt = idxs.map(function (i) {
      var anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="' + anchor + '" font-size="10.5" fill="#64748b">' + esc(fecha(fechas[i])) + '</text>';
    }).join('');

    return '<svg class="cl-h-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
      + ' aria-label="Precio de los últimos ' + n + ' días: de ' + mxn(d.inicio) + ' a ' + mxn(d.actual)
      + ', mínimo ' + mxn(d.min) + ' el ' + fecha(d.minFecha, 'larga') + ', máximo ' + mxn(d.max) + ' el ' + fecha(d.maxFecha, 'larga') + '.">'
      + rejilla + area + puentes + lineas + marcaMin + punto + badge + fechasTxt + '</svg>';
  }

  /* ── Piezas de texto ─────────────────────────────────────────────────────── */
  function variacion(d) {
    if (d.var === undefined) return '<em>Sin dato</em>';
    var cls = d.var < 0 ? 'is-down' : d.var > 0 ? 'is-up' : '';
    var flecha = d.var < 0 ? '↘' : d.var > 0 ? '↗' : '';
    return '<b class="' + cls + '">' + (d.var > 0 ? '+' : '') + d.var.toFixed(1) + '% ' + flecha + '</b>';
  }

  function notas(d, fechas, precioTarjeta) {
    var out = '';
    if (d.estado === 'parcial') out += '<p class="cl-h-nota">Histórico en construcción: llevamos ' + d.n + ' de ' + d.dias + ' días.</p>';
    if (d.var === undefined) out += '<p class="cl-h-nota">No publicamos la variación del periodo con menos de 14 registros.</p>';
    if (d.huecos && d.huecos.length) {
      out += '<p class="cl-h-nota">' + d.huecos.length + (d.huecos.length === 1 ? ' día sin registro' : ' días sin registro')
        + ' (línea punteada): ese día el producto no tenía precio disponible.</p>';
    }
    if (d.atipicos && d.atipicos.length) {
      out += '<p class="cl-h-nota">Hay un cambio de precio inusual el ' + esc(fecha(fechas[d.atipicos[0]], 'larga'))
        + '. Suele significar que cambió la oferta de referencia del catálogo, no que el vendedor subiera o bajara tanto.</p>';
    }
    if (typeof precioTarjeta === 'number' && Math.abs(precioTarjeta - d.actual) > Math.max(1, d.actual * 0.005)) {
      out += '<p class="cl-h-nota">El precio de la ficha (' + mxn(precioTarjeta) + ') no coincide con el último que registramos ('
        + mxn(d.actual) + ', del ' + esc(fecha(d.actualFecha, 'larga')) + '). La gráfica muestra lo que registramos, no lo inventa.</p>';
    }
    return out;
  }

  function pieDatos(d) {
    return '<p class="cl-h-fuente">' + svgIc(IC_INFO, 14, 1.8)
      + '<span>Última actualización: ' + esc(fecha(d.actualFecha, 'completa'))
      + '. Datos de la publicación en Mercado Libre registrados por comparalo.mx desde el ' + esc(fecha(d.desde, 'larga'))
      + ' (' + d.n + (d.n === 1 ? ' registro' : ' registros') + '). Es el precio de catálogo (la oferta más barata con envío FULL), no el de un vendedor en particular.</span></p>';
  }

  /** Registro de precios: los cambios del periodo, del más reciente al más antiguo. */
  function registro(d, fechas) {
    var filas = d.p.slice().reverse().map(function (x) {
      return '<div class="cl-h-reg-i"><span>' + esc(fecha(fechas[x[0]])) + '</span><b>' + mxn(x[1]) + '</b></div>';
    }).join('');
    return '<div class="cl-h-reg">' + filas + '</div>'
      + '<p class="cl-h-nota">Solo aparecen los días en que el precio cambió; entre una fecha y la siguiente se mantuvo igual.</p>';
  }

  function sinDatos(d) {
    if (!d) return '<p class="cl-h-none">Todavía no tenemos histórico de precio de este producto. Empezamos a registrarlo cuando entra a nuestro seguimiento diario.</p>';
    return '<p class="cl-h-none">' + (d.estado === 'nuevo'
      ? 'Producto recién incorporado: empezamos a registrar su precio el ' + esc(fecha(d.desde, 'larga')) + '. Necesitamos al menos 7 días para dibujar la gráfica.'
      : 'Todavía no tenemos suficiente histórico de este producto (' + d.n + (d.n === 1 ? ' registro' : ' registros') + '). Necesitamos al menos 7 días.') + '</p>';
  }

  /* ── Ventana superpuesta ─────────────────────────────────────────────────── */
  var modal = null, ultimoFoco = null, abiertoEn = 0, ctxActual = null;

  function cerrar() {
    if (!modal) return;
    if (ctxActual) {
      ga('historico_cerrar', {
        product_id: ctxActual.id, origen: ctxActual.origen || 'tarjeta', page_section: ctxActual.section || '',
        segundos_abierto: Math.round((Date.now() - abiertoEn) / 1000),
      });
    }
    modal.remove(); modal = null; ctxActual = null;
    document.body.classList.remove('cmx-hm-open');
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  var ga = function (name, params) {
    if (typeof window.gtag === 'function') { try { window.gtag('event', name, params || {}); } catch (e) {} }
  };

  /**
   * Abre la ventana del histórico.
   * @param id  id del producto o de la variante
   * @param ctx { nombre, img, chip, precio, section, origen }
   */
  function abrir(id, ctx) {
    ctx = ctx || {};
    ultimoFoco = document.activeElement;
    cerrar();
    modal = document.createElement('div');
    modal.className = 'cl-hm';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Histórico de precio de ' + (ctx.nombre || 'el producto'));
    modal.innerHTML = '<div class="cl-hm-bd" data-hm-close></div><div class="cl-hm-box"><p class="cl-h-load">Cargando el histórico…</p></div>';
    document.body.appendChild(modal);
    document.body.classList.add('cmx-hm-open');
    abiertoEn = Date.now();
    ctxActual = { id: String(id), origen: ctx.origen || 'tarjeta', section: ctx.section || '' };

    cargar().then(function () {
      if (!modal) return;
      var d = de(id), fechas = (datos && datos.fechas) || [], hay = graficable(d);
      modal.querySelector('.cl-hm-box').innerHTML = cuerpo(d, fechas, ctx, hay);
      var x = modal.querySelector('.cl-hm-x'); if (x) x.focus();
      ga(hay ? 'historico_abrir' : 'historico_sin_datos', {
        product_id: String(id), product_name: ctx.nombre || '', page_section: ctx.section || '',
        origen: ctx.origen || 'tarjeta', dias_disponibles: d ? d.n : 0, estado: d ? d.estado : 'sin_datos',
      });
    });
  }

  function cuerpo(d, fechas, ctx, hay) {
    var cab = '<header class="cl-hm-hd">' + svgIc(IC_CHART, 20, 1.8)
      + '<h2>Histórico de precio <span>Últimos 30 días</span></h2>'
      + '<button type="button" class="cl-hm-x" data-hm-close aria-label="Cerrar el histórico">' + svgIc('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 20, 2.2) + '</button></header>';

    if (!hay) return cab + '<div class="cl-hm-body"><div class="cl-hm-main">' + sinDatos(d) + '</div></div>';

    var precio = typeof ctx.precio === 'number' ? ctx.precio : d.actual;
    var lado = '<aside class="cl-hm-side">'
      + (ctx.img ? '<img src="' + esc(ctx.img) + '" alt="" referrerpolicy="no-referrer">' : '')
      + '<p class="cl-hm-name">' + esc(ctx.nombre || '') + '</p>'
      + (ctx.chip ? '<span class="cl-hm-chip">' + esc(ctx.chip) + '</span>' : '')
      + '<div class="cl-hm-now"><span>Precio actual</span><b>' + mxn(precio) + '</b></div>'
      + '<dl class="cl-hm-stats">'
      + '<div><dt>Mínimo (30 días)</dt><dd>' + mxn(d.min) + ' <span>' + esc(fecha(d.minFecha, 'larga')) + '</span></dd></div>'
      + '<div><dt>Máximo (30 días)</dt><dd>' + mxn(d.max) + ' <span>' + esc(fecha(d.maxFecha, 'larga')) + '</span></dd></div>'
      + '<div><dt>Variación del periodo</dt><dd>' + variacion(d) + '</dd></div>'
      + '</dl></aside>';

    var tabs = '<div class="cl-hm-tabs" role="tablist">'
      + '<button type="button" class="is-on" role="tab" aria-selected="true" data-tab="graf">' + svgIc(IC_CHART, 16, 1.8) + ' Gráfica de precios</button>'
      + '<button type="button" role="tab" aria-selected="false" data-tab="reg">' + svgIc(IC_TABLE, 16, 1.8) + ' Registro de precios</button></div>';

    // En escritorio el registro va bajo la gráfica (hay espacio); en móvil, en el acordeón.
    var panelGraf = '<div class="cl-hm-panel" data-panel="graf">'
      + '<div class="cl-h-graf">' + chart(d, fechas, { w: 640, h: 250, ejeY: true, badge: true, minimo: true, marcas: 6 }) + '</div>'
      + pieDatos(d) + notas(d, fechas, ctx.precio)
      + '<div class="cl-hm-regwrap"><h3 class="cl-hm-h3">Registro de precios (últimos 30 días)</h3>' + registro(d, fechas) + '</div>'
      + '</div>';

    var panelReg = '<div class="cl-hm-panel" data-panel="reg" hidden>'
      + '<h3 class="cl-hm-h3">Registro de precios (últimos 30 días)</h3>' + registro(d, fechas) + '</div>';

    // En móvil el registro va plegado bajo la gráfica (no hay pestañas).
    var acordeon = '<div class="cl-hm-acc">'
      + '<button type="button" class="cl-hm-acc-b" aria-expanded="false" data-acc>' + svgIc(IC_TABLE, 16, 1.8)
      + '<span>Registro de precios</span>' + svgIc(IC_CHEV, 16, 2.4) + '</button>'
      + '<div class="cl-hm-acc-p" hidden>' + registro(d, fechas) + '</div></div>';

    return cab + '<div class="cl-hm-body">' + lado + '<div class="cl-hm-main">' + tabs + panelGraf + panelReg + acordeon + '</div></div>';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('[data-hm-close]')) { cerrar(); return; }
    var tab = t.closest && t.closest('[data-tab]');
    if (tab && modal) {
      var cual = tab.getAttribute('data-tab');
      modal.querySelectorAll('[data-tab]').forEach(function (b) {
        var on = b === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      modal.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== cual; });
      return;
    }
    var acc = t.closest && t.closest('[data-acc]');
    if (acc) {
      var abierto = acc.getAttribute('aria-expanded') === 'true';
      acc.setAttribute('aria-expanded', abierto ? 'false' : 'true');
      acc.parentNode.querySelector('.cl-hm-acc-p').hidden = abierto;
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal) cerrar(); });

  /* ── Bloque para la comparativa ───────────────────────────────────────────
     Una gráfica por producto, con la MISMA escala y el mismo periodo, para que se
     puedan comparar de un vistazo. No decide nada: una bajada reciente no hace
     que un producto sea mejor compra. */
  function comparativa(lista) {
    if (!datos) return '';
    var items = lista.map(function (it) { return { it: it, d: de(it.id) }; });
    var conDatos = items.filter(function (x) { return graficable(x.d); });
    if (!conDatos.length) return '';

    var fechas = datos.fechas || [];
    var lo = Math.min.apply(null, conDatos.map(function (x) { return x.d.min; }));
    var hi = Math.max.apply(null, conDatos.map(function (x) { return x.d.max; }));

    var cols = items.map(function (x) {
      var nom = '<h4>' + esc(x.it.nombre || '') + '</h4>';
      if (!graficable(x.d)) return '<div class="cl-hc-col">' + nom + sinDatos(x.d) + '</div>';
      var d = x.d;
      return '<div class="cl-hc-col">' + nom
        + '<div class="cl-h-graf">' + chart(d, fechas, { w: 420, h: 170, ejeY: true, badge: true, marcas: 5, lo: lo, hi: hi }) + '</div>'
        + '<dl class="cl-hc-stats">'
        + '<div><dt>Actual</dt><dd>' + money(d.actual) + '</dd></div>'
        + '<div><dt>Mínimo</dt><dd>' + money(d.min) + '</dd></div>'
        + '<div><dt>Máximo</dt><dd>' + money(d.max) + '</dd></div>'
        + '<div><dt>Variación</dt><dd>' + variacion(d) + '</dd></div>'
        + '</dl></div>';
    }).join('');

    // Observación, no veredicto.
    var obs = '';
    var conVar = conDatos.filter(function (x) { return x.d.var !== undefined; });
    if (conVar.length > 1) {
      var bajo = conVar.slice().sort(function (a, b) { return a.d.var - b.d.var; })[0];
      var estable = conVar.slice().sort(function (a, b) { return Math.abs(a.d.var) - Math.abs(b.d.var); })[0];
      if (bajo.d.var < 0) {
        obs = 'En estos 30 días, ' + esc(bajo.it.nombre) + ' es el que más bajó (' + bajo.d.var.toFixed(1) + ' %)'
          + (estable !== bajo ? ' y ' + esc(estable.it.nombre) + ' el que se mantuvo más estable' : '') + '. '
          + 'Que un precio haya bajado no lo vuelve la mejor compra: revisa también las características y el precio final en Mercado Libre.';
      }
    }
    var ultima = conDatos.map(function (x) { return x.d.actualFecha; }).sort().pop();

    return '<section class="cl-hc">'
      + '<h3>' + svgIc(IC_CHART, 18, 1.8) + ' Histórico de precio · últimos 30 días</h3>'
      + '<div class="cl-hc-grid">' + cols + '</div>'
      + (obs ? '<p class="cl-hc-obs">' + obs + '</p>' : '')
      + '<p class="cl-h-fuente">' + svgIc(IC_INFO, 14, 1.8) + '<span>Todas las gráficas usan el mismo periodo y la misma escala. '
      + 'Última actualización: ' + esc(fecha(ultima, 'completa'))
      + '. Precios de catálogo de Mercado Libre registrados por comparalo.mx; no se rellenan los días sin registro.</span></p></section>';
  }

  window.cmxHist = {
    init: init, cargar: cargar, de: de, abrir: abrir, cerrar: cerrar,
    comparativa: comparativa, graficable: graficable, fecha: fecha,
  };
})();
