#!/usr/bin/env node
// Genera electrodomesticos/cafeteras/descuentos.json
// Solo muestra cafeteras con bajada real de precio (ML: _precioMLAntes; Amazon: _precioAmzAntes vigente).
// Si no hay descuentos, escribe un array vacío (la sección desaparece del home).
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mejorBajada, camposOferta } from './_ofertas.js';
const __dirname = dirname(fileURLToPath(import.meta.url));

const merged = JSON.parse(readFileSync(join(__dirname, 'merged-admin.json'), 'utf8'));
const productos = (merged.cafeteras || []).filter(p => p.activo !== false && p.imagen);

const drops = productos
  .map(p => ({ p, b: mejorBajada(p) }))
  .filter(x => x.b)
  .map(({ p, b }) => ({
    id:          p.id,
    nombre:      p.nombre,
    imagen:      p.imagen,
    precioML:    p.precioML || null,
    precioAmz:   p.precioAmz || null,
    ...camposOferta(b),
    linkML:      p.linkML || null,
    linkAmz:     p.linkAmz || null,
    especs: {
      tipo:        (p.especs && p.especs.tipo)      || null,
      capacidad:   (p.especs && p.especs.capacidad) || null,
      presion:     (p.especs && p.especs.presion)   || null,
      vaporizador: (p.especs && p.especs.vaporizador) || null,
    },
    _updatedAt: (b.plataforma === 'amazon' ? p._precioAmzFecha : p._mlCheckedAt) || null,
  }))
  .sort((a, b) => b.pct - a.pct);

const output = {
  generadoEn: new Date().toISOString(),
  descuentos: drops,
};

const outPath = join(__dirname, '..', 'electrodomesticos', 'cafeteras', 'descuentos.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✓ cafeteras: ${drops.length} con descuento real escritas en ${outPath}`);
drops.forEach(p => console.log(`  [↓${p.pct}% ${p.plataforma}] ${p.nombre.slice(0, 55)}`));
if (!drops.length) console.log('  (sin descuentos hoy — descuentos.json vacío)');
