#!/usr/bin/env node
// Genera electrodomesticos/cafeteras/descuentos.json
// Solo muestra cafeteras con bajada real de precio (_precioMLAntes > precioML).
// Si no hay descuentos, escribe un array vacío (la sección desaparece del home).
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const merged = JSON.parse(readFileSync(join(__dirname, 'merged-admin.json'), 'utf8'));
const productos = (merged.cafeteras || []).filter(p =>
  p.activo !== false && p.precioML && p.linkML && p.imagen
);

const drops = productos
  .filter(p => p._precioMLAntes && p._precioMLAntes > p.precioML)
  .map(p => ({
    id:          p.id,
    nombre:      p.nombre,
    imagen:      p.imagen,
    precioML:    p.precioML,
    precioAmz:   p.precioAmz || null,
    precioAntes: p._precioMLAntes,
    ahorro:      Math.round(p._precioMLAntes - p.precioML),
    pct:         Math.round((p._precioMLAntes - p.precioML) / p._precioMLAntes * 100),
    linkML:      p.linkML,
    linkAmz:     p.linkAmz || null,
    especs: {
      tipo:        (p.especs && p.especs.tipo)      || null,
      capacidad:   (p.especs && p.especs.capacidad) || null,
      presion:     (p.especs && p.especs.presion)   || null,
      vaporizador: (p.especs && p.especs.vaporizador) || null,
    },
    _updatedAt: p._mlCheckedAt || null,
  }))
  .sort((a, b) => b.pct - a.pct);

const output = {
  generadoEn: new Date().toISOString(),
  descuentos: drops,
};

const outPath = join(__dirname, '..', 'electrodomesticos', 'cafeteras', 'descuentos.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✓ cafeteras: ${drops.length} con descuento real escritas en ${outPath}`);
drops.forEach(p => console.log(`  [↓${p.pct}%] ${p.nombre.slice(0, 55)}`));
if (!drops.length) console.log('  (sin descuentos hoy — descuentos.json vacío)');
