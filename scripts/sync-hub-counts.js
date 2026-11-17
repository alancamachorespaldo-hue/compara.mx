#!/usr/bin/env node
// Escribe en las páginas de categoría (hub) cuántos productos tiene cada subcategoría, contando el
// arreglo real de productos de la página de destino. Uso: node scripts/sync-hub-counts.js [--check]
//
// En el hub cada contador es: <span data-cmx-count="/electrodomesticos/freidoras/">61</span>
// Se cuentan los productos del arreglo (productos | micros | PRODUCTOS) a los que les queda
// alguna tienda tras aplicar las pausas. Si la página de destino no se puede leer, el número NO se toca y se avisa.
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const HUBS = ['electrodomesticos/index.html', 'suplementos/index.html', 'tecnologia/index.html', 'entretenimiento/index.html', 'celulares/index.html', 'videojuegos/index.html'];
const ARRAYS = ['productos', 'micros', 'PRODUCTOS', 'familias'];

function contar(ruta) {
  const html = readFileSync(join(ROOT, ruta.replace(/^\//, ''), 'index.html'), 'utf8');
  for (const name of ARRAYS) {
    const i = html.search(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\[`));
    if (i < 0) continue;
    const start = html.indexOf('[', i);
    const end = html.indexOf('\n];', start);
    if (end < 0) continue;
    const arr = vm.runInNewContext('(' + html.slice(start, end + 2) + ')', {}, { timeout: 2000 });
    if (!Array.isArray(arr) || !arr.length) continue;
    let pausas = {};
    const pz = html.match(/<script type="application\/json" id="pausas">([\s\S]*?)<\/script>/);
    if (pz) { try { pausas = JSON.parse(pz[1] || '{}'); } catch { /* sin pausas */ } }
    // Mismo criterio que el bucle de pausas de la página: se cuenta lo que le queda alguna
    // tienda a la que mandar al visitante. Antes solo descartaba lo pausado en AMBAS, y desde la
    // baja de Amazon casi nada tiene linkAmz: el hub anunciaba 48 donde la página pintaba 31.
    // En celulares el arreglo son familias y el link vive en cada variante: se cuentan las
    // variantes con tienda, que es lo que la página enseña como modelos.
    const items = name === 'familias' ? arr.flatMap((f) => f.variantes || []) : arr;
    return items.filter((p) => {
      const z = pausas[p.id] || {};
      return (!z.ml && p.linkML) || (!z.amz && p.linkAmz);
    }).length;
  }
  throw new Error('no se encontró el arreglo de productos');
}

let cambios = 0;
for (const hub of HUBS) {
  const abs = join(ROOT, hub);
  let s = readFileSync(abs, 'utf8');
  const out = s.replace(/(<span data-cmx-count="([^"]+)">)(\d*)(<\/span>)/g, (m, a, ruta, viejo, z) => {
    let n;
    try { n = contar(ruta); } catch (e) { console.warn(`  · ${hub}: ${ruta} sin contar (${e.message})`); return m; }
    if (String(n) !== viejo) { cambios++; console.log(`  ${hub}: ${ruta} ${viejo || '—'} → ${n}`); }
    return a + n + z;
  });
  if (out !== s && !CHECK) writeFileSync(abs, out, 'utf8');
}
console.log(`${CHECK ? 'Cambiarían' : 'Actualizados'}: ${cambios} contador(es)`);
if (CHECK && cambios) process.exit(1);
