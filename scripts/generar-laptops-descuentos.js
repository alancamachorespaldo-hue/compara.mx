#!/usr/bin/env node
// Genera laptops/descuentos.json con bajadas de precio reales primero,
// luego rellena con mejores laptops por precio hasta 6 productos.
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const merged = JSON.parse(readFileSync(join(__dirname, 'merged-admin.json'), 'utf8'));
const productos = (merged.laptops || []).filter(p =>
  p.activo !== false && p.precioML && p.linkML && p.imagen
);

const drops = productos
  .filter(p => p._precioMLAntes && p._precioMLAntes > p.precioML)
  .map(p => ({
    id:          String(p.id),
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
      ram:            (p.especs && p.especs.ram)            || null,
      almacenamiento: (p.especs && p.especs.almacenamiento) || null,
      procesador:     (p.especs && p.especs.procesador)     || null,
    },
    _updatedAt: p._updatedAt || null,
  }))
  .sort((a, b) => b.pct - a.pct);

const dropIds = new Set(drops.map(p => p.id));
const relleno = productos
  .filter(p => !dropIds.has(String(p.id)))
  .sort((a, b) => a.precioML - b.precioML)
  .slice(0, Math.max(0, 6 - drops.length))
  .map(p => ({
    id:          String(p.id),
    nombre:      p.nombre,
    imagen:      p.imagen,
    precioML:    p.precioML,
    precioAmz:   p.precioAmz || null,
    precioAntes: null,
    ahorro:      null,
    pct:         null,
    linkML:      p.linkML,
    linkAmz:     p.linkAmz || null,
    especs: {
      ram:            (p.especs && p.especs.ram)            || null,
      almacenamiento: (p.especs && p.especs.almacenamiento) || null,
      procesador:     (p.especs && p.especs.procesador)     || null,
    },
    _updatedAt: p._updatedAt || null,
  }));

const output = {
  generadoEn: new Date().toISOString(),
  descuentos: [...drops, ...relleno].slice(0, 6),
};

const outPath = join(__dirname, '..', 'laptops', 'descuentos.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✓ ${output.descuentos.length} laptops escritos en ${outPath}`);
output.descuentos.forEach(p => {
  const tag = p.pct ? `↓${p.pct}%` : 'top precio';
  console.log(`  [${tag}] ${p.nombre.slice(0, 55)}`);
});
