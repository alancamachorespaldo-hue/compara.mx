#!/usr/bin/env node
/**
 * analitica-resumen.js — imprime en Markdown cómo le fue a la última corrida de
 * `analitica.mjs`. Lo usa el workflow para su resumen, y sirve para ver los
 * números de la semana sin abrir el Centro:
 *
 *   node scripts/analitica-resumen.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let A = null;
try { A = JSON.parse(fs.readFileSync(path.join(DIR, 'analitica.json'), 'utf8')); }
catch { console.log('### Analítica\n\nNo hay `scripts/analitica.json`: la corrida no llegó a escribirlo.'); process.exit(0); }

const n = (v) => (typeof v === 'number' ? v.toLocaleString('es-MX') : '—');
const pc = (v) => (typeof v === 'number' ? (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%' : '—');
const ESTADOS = {
  ok: '✅ completa', parcial: '⚠️ parcial', error: '❌ falló',
  'sin-credencial': '🔑 falta la credencial'
};

console.log('### Analítica · ' + (ESTADOS[A.estado] || A.estado));
console.log('');
console.log('Generada el ' + String(A.generado).slice(0, 16).replace('T', ' ') + ' UTC.');
console.log('');

const s = A.semana;
if (s) {
  console.log('**Últimos 7 días** (' + s.desde + ' → ' + s.hasta + ')');
  console.log('');
  console.log('| Métrica | Valor | vs. 7 días antes |');
  console.log('|---|---:|---:|');
  console.log('| Usuarios | ' + n(s.usuarios) + ' | ' + pc(s.cambio.usuarios) + ' |');
  console.log('| Sesiones | ' + n(s.sesiones) + ' | — |');
  console.log('| Clics a tienda | ' + n(s.clicsTienda) + ' | ' + pc(s.cambio.clicsTienda) + ' |');
  console.log('| · Mercado Libre | ' + n(s.clicsML) + ' | — |');
  console.log('| · Amazon | ' + n(s.clicsAmz) + ' | — |');
  console.log('| Impresiones en Google | ' + n(s.impresiones) + ' | ' + pc(s.cambio.impresiones) + ' |');
  console.log('| Clics desde Google | ' + n(s.clicsBusqueda) + ' | ' + pc(s.cambio.clicsBusqueda) + ' |');
  console.log('| CTR | ' + (typeof s.ctr === 'number' ? (s.ctr * 100).toFixed(1) + '%' : '—') + ' | — |');
  console.log('| Posición media | ' + (typeof s.posicion === 'number' ? s.posicion.toFixed(1) : '—') + ' | — |');
  console.log('');
}

if (A.errores && A.errores.length) {
  console.log('**Lo que no se pudo traer**');
  console.log('');
  A.errores.forEach((e) => console.log('- `' + e.donde + '`: ' + e.mensaje));
  console.log('');
}

if (A.estado === 'sin-credencial') {
  console.log('Falta el secret `GOOGLE_SERVICE_ACCOUNT_JSON` con el JSON de la cuenta de servicio,');
  console.log('y que esa cuenta tenga lectura en la propiedad de GA4 y en la de Search Console.');
}
