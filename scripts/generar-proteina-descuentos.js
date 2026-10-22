#!/usr/bin/env node
/**
 * Genera suplementos/proteina/descuentos.json desde merged-admin.json.
 * Incluye:
 *  - Productos donde precioML < precio (bajada de precio real)
 *  - Completa con mejores precio/calidad si hay menos de 4 bajadas
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const { readFileSync: fs_read, writeFileSync: fs_write } = { readFileSync, writeFileSync };
const fs = { readFileSync, writeFileSync };
const path = { join };

const merged = JSON.parse(readFileSync(join(__dirname, 'merged-admin.json'), 'utf8'));
const productos = (merged.proteina || []).filter(p =>
  p.activo !== false && p.precioML && p.linkML && p.imagen
);

function costoPor25g(especs) {
  if (!especs?.costoPor25g) return 999;
  return parseFloat(especs.costoPor25g.replace(/[^0-9.]/g, '')) || 999;
}

// Productos con bajada real de precio
const bajadas = productos
  .filter(p => p.precio && p.precioML < p.precio)
  .map(p => ({
    id: String(p.id),
    nombre: p.nombre,
    imagen: p.imagen,
    precioML: p.precioML,
    precioAmz: p.precioAmz || null,
    precioAntes: p.precio,
    ahorro: Math.round(p.precio - p.precioML),
    pct: Math.round((p.precio - p.precioML) / p.precio * 100),
    linkML: p.linkML,
    linkAmz: p.linkAmz || null,
    especs: p.especs ? {
      tipo: p.especs.tipoProteina || null,
      proteina: p.especs.proteinaPorPorcion || null,
      costo25g: p.especs.costoPor25g || null,
    } : null,
    _updatedAt: p._updatedAt || new Date().toISOString(),
  }))
  .sort((a, b) => b.pct - a.pct);

// Si hay menos de 4 bajadas, completa con mejores precio/calidad (sin repetir)
const bajadaIds = new Set(bajadas.map(p => p.id));
const relleno = productos
  .filter(p => !bajadaIds.has(String(p.id)) && p.especs?.costoPor25g)
  .sort((a, b) => costoPor25g(a.especs) - costoPor25g(b.especs))
  .slice(0, Math.max(0, 4 - bajadas.length))
  .map(p => ({
    id: String(p.id),
    nombre: p.nombre,
    imagen: p.imagen,
    precioML: p.precioML,
    precioAmz: p.precioAmz || null,
    precioAntes: null,
    ahorro: null,
    pct: null,
    linkML: p.linkML,
    linkAmz: p.linkAmz || null,
    especs: p.especs ? {
      tipo: p.especs.tipoProteina || null,
      proteina: p.especs.proteinaPorPorcion || null,
      costo25g: p.especs.costoPor25g || null,
    } : null,
    _updatedAt: p._updatedAt || new Date().toISOString(),
  }));

const output = {
  generadoEn: new Date().toISOString(),
  descuentos: [...bajadas, ...relleno].slice(0, 8),
};

const outPath = join(__dirname, '..', 'suplementos', 'proteina', 'descuentos.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✓ ${output.descuentos.length} productos escritos en ${outPath}`);
output.descuentos.forEach(p => {
  const tag = p.pct ? `↓${p.pct}%` : 'top precio';
  console.log(`  [${tag}] ${p.nombre.slice(0, 50)}`);
});
