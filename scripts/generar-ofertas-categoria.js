#!/usr/bin/env node
/**
 * Genera descuentos.json para cualquier categoría simple (id/nombre/imagen/precioML/precioAmz/
 * linkML/linkAmz en merged-admin.json) usando la misma lógica de _ofertas.js que ya usan
 * laptops/proteina/cafeteras/creatina. Pensado para categorías sin generador propio.
 *
 * Uso: node scripts/generar-ofertas-categoria.js --categoria=bicis --out=bicis/descuentos.json
 *      node scripts/generar-ofertas-categoria.js --todas   (corre la lista CATEGORIAS de abajo)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mejorBajada, camposOferta, publicado } from './_ofertas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const merged = JSON.parse(readFileSync(join(__dirname, 'merged-admin.json'), 'utf8'));

// Categorías sin generador propio: clave en merged-admin.json → ruta de salida.
const CATEGORIAS = {
  bicis:                  'bicis/descuentos.json',
  freidoras:              'electrodomesticos/freidoras/descuentos.json',
  microondas:             'electrodomesticos/microondas/descuentos.json',
  omega3:                 'suplementos/omega3/descuentos.json',
  magnesio:               'suplementos/magnesio/descuentos.json',
  complejo_b:             'suplementos/complejo-b/descuentos.json',
  vitamina_d:             'suplementos/vitamina-d/descuentos.json',
  videojuegos_consolas:   'videojuegos/consolas/descuentos.json',
  videojuegos_controles:  'videojuegos/controles/descuentos.json',
  videojuegos_juegos:     'videojuegos/juegos/descuentos.json',
  tecnologia_bocinas:     'tecnologia/bocinas/descuentos.json',
  tecnologia_audifonos:   'tecnologia/audifonos/descuentos.json',
};

function generar(categoria, outRel) {
  const productos = (merged[categoria] || []).filter(p =>
    p.activo !== false && p.imagen && publicado(p) && ((p.precioML && p.linkML) || (p.precioAmz && p.linkAmz))
  );

  const bajadas = productos
    .map(p => {
      const b = mejorBajada(p);
      if (!b) return null;
      return {
        id: String(p.id), nombre: p.nombre, imagen: p.imagen,
        precioML: p.precioML || null, precioAmz: p.precioAmz || null,
        ...camposOferta(b),
        linkML: p.linkML || null, linkAmz: p.linkAmz || null,
        _updatedAt: p._updatedAt || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  // Si hay menos de 6 bajadas reales, completa con el mejor precio (sin repetir).
  const bajadaIds = new Set(bajadas.map(p => p.id));
  const relleno = productos
    .filter(p => !bajadaIds.has(String(p.id)))
    .sort((a, b) => (a.precioML || a.precioAmz || Infinity) - (b.precioML || b.precioAmz || Infinity))
    .slice(0, Math.max(0, 6 - bajadas.length))
    .map(p => {
      const esAmz = !p.precioML && p.precioAmz;
      return {
        id: String(p.id), nombre: p.nombre, imagen: p.imagen,
        precioML: p.precioML || null, precioAmz: p.precioAmz || null,
        plataforma: esAmz ? 'amazon' : 'ml',
        precioOferta: esAmz ? p.precioAmz : p.precioML,
        link: esAmz ? p.linkAmz : p.linkML,
        precioAntes: null, ahorro: null, pct: null,
        linkML: p.linkML || null, linkAmz: p.linkAmz || null,
        _updatedAt: p._updatedAt || new Date().toISOString(),
      };
    });

  const output = { generadoEn: new Date().toISOString(), descuentos: [...bajadas, ...relleno].slice(0, 8) };
  const outPath = join(ROOT, outRel);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✓ ${categoria}: ${output.descuentos.length} productos → ${outRel}`);
  output.descuentos.forEach(p => {
    const tag = p.pct ? `↓${p.pct}% ${p.plataforma}` : 'top precio';
    console.log(`    [${tag}] ${(p.nombre || '').slice(0, 50)}`);
  });
}

const soloCategoria = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1];
const todas = process.argv.includes('--todas');

if (soloCategoria) {
  if (!CATEGORIAS[soloCategoria]) { console.error('Categoría no configurada:', soloCategoria); process.exit(1); }
  generar(soloCategoria, CATEGORIAS[soloCategoria]);
} else if (todas) {
  for (const [cat, out] of Object.entries(CATEGORIAS)) generar(cat, out);
} else {
  console.log('Uso: node scripts/generar-ofertas-categoria.js --todas');
  console.log('  o: node scripts/generar-ofertas-categoria.js --categoria=<cat>');
  console.log('Categorías:', Object.keys(CATEGORIAS).join(', '));
}
