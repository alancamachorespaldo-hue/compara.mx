#!/usr/bin/env node
/**
 * sync-ofertas-cta.js — pone en cada página de categoría el acceso a /ofertas/.
 *
 * Son dos piezas, las dos escritas por este script (no editarlas a mano):
 *   1. El chip de la primera pantalla, junto al contador de resultados:
 *      "Ofertas de hoy en todo el sitio →". Solo en las páginas con la plantilla de listado
 *      (las que tienen <p class="cl-count" id="cl-count">).
 *   2. La banda verde al terminar el listado: <aside class="cl-ofcta">, con el botón a
 *      /ofertas/ y —donde existe el filtro de la plantilla— un botón que enciende el filtro
 *      "Bajó de precio" de esa misma página.
 *
 * Las páginas salen del registro scripts/categorias.js y los nombres de scripts/_nombres.js,
 * así que una categoría nueva entra sola: se registra y se vuelve a correr esto.
 * Los estilos (.cl-oflink y .cl-ofcta) viven en assets/css/cmx-site.css, que cargan todas las
 * páginas, para que la banda también sirva en los listados que todavía no usan cmx-list.
 *
 * Uso: node scripts/sync-ofertas-cta.js [--check] [--dry-run]
 * Idempotente: vuelve a escribir las dos piezas tal como deben quedar.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { entradas, tituloDe } from './categorias.js';
import { nombresDe } from './_nombres.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry-run') || CHECK;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const IC_TAG = '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>';
const IC_ARROW = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>';
const svg = (d, n, sw) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ga = (seccion, origen) => `if(typeof gtag==='function')gtag('event','click_ofertas_cta',{page_section:'${seccion}',origen:'${origen}'})`;

/** Chip junto al contador (primera pantalla). */
function chipHtml(seccion) {
  return `    <div class="cl-mainhd">
      <p class="cl-count" id="cl-count" aria-live="polite"></p>
      <a class="cl-oflink" href="/ofertas/" onclick="${ga(seccion, 'listado_top')}">${svg(IC_TAG, 15, 2.2)} Ofertas de hoy en todo el sitio <span aria-hidden="true">&#8594;</span></a>
    </div>`;
}

/** Banda al terminar el listado. `filtro` = la página tiene el filtro de bajadas de la plantilla. */
function bandaHtml(seccion, muchos, filtro, sangria = '    ', suelta = false) {
  const alt = filtro
    ? `\n${sangria}    <button type="button" class="cl-ofcta-alt" onclick="var c=document.getElementById('cl-drop');if(c){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));}">Solo ${esc(muchos)} que bajaron</button>`
    : '';
  return `${sangria}<!-- cmx-ofcta (lo escribe scripts/sync-ofertas-cta.js; no editar a mano) -->
${sangria}<aside class="cl-ofcta${suelta ? ' cl-ofcta--solo' : ''}" aria-labelledby="cl-ofcta-h">
${sangria}  <span class="cl-ofcta-ic" aria-hidden="true">${svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.4" fill="currentColor"/>', 30, 2)}</span>
${sangria}  <div class="cl-ofcta-tx">
${sangria}    <h2 id="cl-ofcta-h">¿Solo quieres ver lo que bajó de precio?</h2>
${sangria}    <p>En <b>Ofertas</b> juntamos las bajadas de los últimos 30 días de todas las categorías del sitio —${esc(muchos)} incluidas— cada una con su histórico de precios de Mercado Libre.</p>
${sangria}  </div>
${sangria}  <div class="cl-ofcta-btns">
${sangria}    <a class="cl-ofcta-go" href="/ofertas/" onclick="${ga(seccion, 'listado_banda')}">Ver todas las ofertas ${svg(IC_ARROW, 17, 2.6)}</a>${alt}
${sangria}  </div>
${sangria}</aside>`;
}

/* ── Páginas del registro (una vez por archivo) ─────────────────────────────── */
const paginas = new Map();
for (const [, c] of entradas()) {
  const p = paginas.get(c.file) || { file: c.file, datos: [] };
  if (!p.datos.includes(c.datos)) p.datos.push(c.datos);
  paginas.set(c.file, p);
}

let cambiadas = 0, saltadas = 0;
const pendientes = [];

for (const { file, datos } of paginas.values()) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) { console.log(`  · ${file}: no existe, se omite`); saltadas++; continue; }
  const antes = readFileSync(abs, 'utf8');
  let html = antes;

  // Una página que muestra varias categorías (el hub de bicis) habla de "productos".
  const seccion = datos[0];
  const [, muchos] = datos.length === 1 ? nombresDe(datos[0], tituloDe(datos[0])) : ['producto', 'productos'];
  const conFiltro = html.includes('/assets/js/cmx-list.js');

  // 1. Chip junto al contador
  if (/<div class="cl-mainhd">[\s\S]*?<\/div>/.test(html)) {
    html = html.replace(/[ \t]*<div class="cl-mainhd">[\s\S]*?<\/div>/, chipHtml(seccion));
  } else if (/<p class="cl-count" id="cl-count"[^>]*><\/p>/.test(html)) {
    html = html.replace(/[ \t]*<p class="cl-count" id="cl-count"[^>]*><\/p>/, chipHtml(seccion));
  }

  // 2. Banda
  const reBanda = /[ \t]*<!-- cmx-ofcta [^>]*-->\n[ \t]*<aside class="cl-ofcta[\s\S]*?<\/aside>/;
  if (reBanda.test(html)) {
    const sangria = (reBanda.exec(html)[0].match(/^[ \t]*/) || [''])[0];
    html = html.replace(reBanda, bandaHtml(seccion, muchos, conFiltro, sangria, !html.includes('cl-below-main')));
  } else if (html.includes('<aside class="cl-ofcta"')) {
    // Versión escrita a mano antes de existir este script: se reemplaza entera.
    html = html.replace(/[ \t]*<!-- Acceso a \/ofertas\/[^\n]*\n[ \t]*<aside class="cl-ofcta[\s\S]*?<\/aside>/,
      bandaHtml(seccion, muchos, conFiltro, '      ', false));
  } else if (html.includes('<div class="cl-below-main">')) {
    html = html.replace('<div class="cl-below-main">', '<div class="cl-below-main">\n' + bandaHtml(seccion, muchos, conFiltro, '      ', false));
  } else if (html.includes('<!-- cmx-related:start -->')) {
    html = html.replace('<!-- cmx-related:start -->', bandaHtml(seccion, muchos, conFiltro, '', true) + '\n<!-- cmx-related:start -->');
  } else if (html.includes('<!-- cmx-footer:start -->')) {
    html = html.replace('<!-- cmx-footer:start -->', bandaHtml(seccion, muchos, conFiltro, '', true) + '\n<!-- cmx-footer:start -->');
  } else {
    console.log(`  · ${file}: sin lugar donde poner la banda (no tiene cl-below-main, cmx-related ni cmx-footer)`);
    saltadas++;
    continue;
  }

  if (html === antes) continue;
  cambiadas++;
  pendientes.push(file);
  if (!DRY) writeFileSync(abs, html);
}

if (CHECK) {
  if (cambiadas) {
    console.log(`Faltan ${cambiadas} página(s) por actualizar: ${pendientes.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ ${paginas.size} páginas con el acceso a /ofertas/ al día`);
} else {
  console.log(`${DRY ? 'Cambiarían' : 'Actualizadas'}: ${cambiadas} de ${paginas.size} páginas${saltadas ? ` (${saltadas} omitidas)` : ''}`);
  for (const f of pendientes) console.log('  · ' + f);
}
