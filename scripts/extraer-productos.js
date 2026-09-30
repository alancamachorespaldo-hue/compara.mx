#!/usr/bin/env node
/**
 * extraer-productos.js
 * Extrae productos de cada HTML ejecutando el bloque JS en Node,
 * luego genera scripts/productos.json como registro central.
 * Uso: node scripts/extraer-productos.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CATALOG = {
  laptops:     { file: 'laptops/index.html',                       varName: 'productos'  },
  suplementos: { file: 'suplementos/index.html',                   varName: 'productos'  },
  bicis:       { file: 'bicis/index.html',                         varName: 'ELECTRICAS' },
  freidoras:   { file: 'electrodomesticos/freidoras/index.html',   varName: 'productos'  },
  microondas:  { file: 'electrodomesticos/microondas/index.html',  varName: 'micros'     },
};

function extractArrayStr(html, varName) {
  const re = new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*\\[`, 'mi');
  const match = html.match(re);
  if (!match) return null;
  const eqIdx = html.indexOf('=', match.index);
  const start  = html.indexOf('[', eqIdx);
  let depth = 0, i = start, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  return html.slice(start, end + 1);
}

const resultado = {};
let total = 0;

for (const [cat, { file, varName }] of Object.entries(CATALOG)) {
  const html = readFileSync(resolve(ROOT, file), 'utf8');
  const code = extractArrayStr(html, varName);
  if (!code) { console.warn(`⚠ No se encontró ${varName} en ${file}`); continue; }

  let prods = [];
  try {
    prods = new Function(`return ${code}`)();
  } catch(e) {
    console.error(`✗ ${cat}: error al evaluar (${e.message.slice(0,60)})`);
    resultado[cat] = [];
    continue;
  }
  resultado[cat] = prods.map(p => ({
    id:        p.id,
    nombre:    p.nombre ?? '',
    marca:     p.marca ?? '',
    linkML:    p.linkML ?? null,
    linkAmz:   p.linkAmz ?? null,
    mlId:      p.mlId ?? null,
    precioML:  p.precioML ?? null,
    precioAmz: p.precioAmz ?? null,
    activo:    p.activo !== false,
  }));
  console.log(`✓ ${cat}: ${prods.length} productos`);
  total += prods.length;
}

const outPath = resolve(ROOT, 'scripts/productos.json');
writeFileSync(outPath, JSON.stringify(resultado, null, 2), 'utf8');
console.log(`\n✅ scripts/productos.json → ${total} productos totales`);
