#!/usr/bin/env node
/**
 * limpiar-links-muertos.mjs — retira de la base los links de afiliado que la revisión ya marcó
 * como muertos (`link_roto` / `link_otro`), en vez de dejarlos pausados para siempre.
 *
 *   node scripts/limpiar-links-muertos.mjs                 # solo reporte, no escribe nada
 *   node scripts/limpiar-links-muertos.mjs --aplicar       # lo escribe en merged-admin.json
 *   node scripts/limpiar-links-muertos.mjs --categoria=streaming,cafeteras [--aplicar]
 *
 * La regla está en scripts/_link-muerto.js, que también usa revisar-disponibilidad.js para que
 * los links que mueran de aquí en adelante se retiren solos en la corrida de los domingos.
 *
 * Después de --aplicar:
 *   node scripts/sync-pausas.js        (quita de las páginas lo que se quedó sin tienda)
 *   node scripts/generar-centro.js     (refresca el Centro de Control)
 *
 * Escribe scripts/links-muertos-report.json con lo retirado y con los que NO tienen mlId, que
 * son los únicos que no se pueden recuperar desde la ficha de catálogo.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIAS } from './categorias.js';
import { tieneLinkMuerto, motivoLinkMuerto, retirarLink, marcadoPorAuditoria } from './_link-muerto.js';

const ROOT = resolve(import.meta.dirname, '..');
const RUTA = resolve(ROOT, 'scripts/merged-admin.json');
const APLICAR = process.argv.includes('--aplicar');
const SOLO = (process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1] || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const HOY = new Date().toISOString().slice(0, 10);

const db = JSON.parse(readFileSync(RUTA, 'utf8'));
const titulo = {};
for (const [clave, c] of Object.entries(CATEGORIAS)) titulo[c.datos || clave] = c.titulo;

const retirados = [];
const sinFicha = [];
const porConfirmar = [];
const porCat = {};

for (const [cat, lista] of Object.entries(db)) {
  if (!Array.isArray(lista)) continue;
  if (SOLO.length && !SOLO.includes(cat)) continue;
  for (const p of lista) {
    if (marcadoPorAuditoria(p)) {
      porConfirmar.push({ cat, catTitulo: titulo[cat] || cat, id: String(p.id), nombre: p.nombre, linkML: p.linkML, mlId: p.mlId || null });
    }
    if (!tieneLinkMuerto(p)) continue;
    const motivo = motivoLinkMuerto(p);
    const antes = { linkML: p.linkML, pausaML: p.pausaML, mlId: p.mlId };
    const r = APLICAR ? retirarLink(p, motivo, HOY) : {
      id: String(p.id), nombre: p.nombre, motivo, linkMuerto: antes.linkML, mlId: antes.mlId,
      recuperable: !!antes.mlId,
      ficha: antes.mlId ? `https://www.mercadolibre.com.mx/p/${antes.mlId}` : null,
    };
    if (!r) continue;
    r.cat = cat;
    r.catTitulo = titulo[cat] || cat;
    retirados.push(r);
    if (!r.recuperable) sinFicha.push(r);
    porCat[cat] = (porCat[cat] || 0) + 1;
  }
}

if (APLICAR && retirados.length) writeFileSync(RUTA, JSON.stringify(db, null, 2));

writeFileSync(resolve(ROOT, 'scripts/links-muertos-report.json'), JSON.stringify({
  fecha: HOY, aplicado: APLICAR, total: retirados.length,
  recuperables: retirados.filter(r => r.recuperable).length,
  sinFicha: sinFicha.length,
  porConfirmar,
  porCategoria: porCat,
  productos: retirados,
}, null, 2));

const ancho = Object.keys(porCat).reduce((a, k) => Math.max(a, (titulo[k] || k).length), 10);
console.log(`\nLinks de afiliado muertos${APLICAR ? ' — RETIRADOS' : ' (solo reporte)'} · ${HOY}\n`);
for (const [cat, n] of Object.entries(porCat).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + (titulo[cat] || cat).padEnd(ancho) + String(n).padStart(4));
}
console.log(`\n  ${retirados.length} producto(s) · ${retirados.filter(r => r.recuperable).length} con ficha de catálogo para generar un link nuevo` +
  (sinFicha.length ? ` · ${sinFicha.length} SIN mlId (hay que buscarlos otra vez o darlos de baja)` : ''));
if (sinFicha.length) for (const r of sinFicha.slice(0, 10)) console.log(`     · ${r.catTitulo}: ${r.nombre.slice(0, 60)}`);
if (porConfirmar.length) console.log(`
  ${porConfirmar.length} más los marcó la auditoría como caídos pero la revisión nunca los confirmó:
` +
  `     no se tocan. Pásales la capa de links para saberlo de verdad:
` +
  `     node scripts/revisar-disponibilidad.js --todas --links --aplicar`);
console.log(APLICAR
  ? '\n  Escrito en merged-admin.json. Ahora: node scripts/sync-pausas.js && node scripts/generar-centro.js'
  : '\n  No se escribió nada. Agrega --aplicar para retirarlos.');
console.log('  Reporte: scripts/links-muertos-report.json\n');
