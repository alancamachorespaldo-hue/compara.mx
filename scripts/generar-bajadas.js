#!/usr/bin/env node
/**
 * generar-bajadas.js — escribe assets/data/bajadas.json con TODOS los productos que hoy tienen
 * bajada de precio, por categoría de merged-admin.json. Lo lee assets/js/price-drops.js para
 * pintar la bajada en la tarjeta y para el filtro "Bajó de precio" de cada categoría.
 *
 * Misma definición que las ofertas del inicio (_ofertas.js): ML bajó desde la última
 * actualización (_precioMLAntes > precioML) o Amazon bajó en los últimos DIAS_OFERTA_AMZ días.
 * Corre en update-prices.yml después de generar-admin.js.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mejorBajada, publicado } from './_ofertas.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const merged = JSON.parse(readFileSync(join(root, 'scripts/merged-admin.json'), 'utf8'));

const categorias = {};
let total = 0;
for (const [cat, lista] of Object.entries(merged)) {
  if (!Array.isArray(lista)) continue;
  const bajadas = lista
    .filter((p) => p.activo !== false && publicado(p))
    .map((p) => ({ p, b: mejorBajada(p) }))
    .filter((x) => x.b)
    .map(({ p, b }) => ({
      id: String(p.id), nombre: p.nombre, plataforma: b.plataforma, antes: b.antes, ahora: b.precio, ahorro: b.ahorro, pct: b.pct,
    }))
    .sort((a, b) => b.pct - a.pct);
  if (bajadas.length) { categorias[cat] = bajadas; total += bajadas.length; }
}

// Lo que ya se anuncia como oferta en el inicio (descuentos.json de cada categoría) también es bajada,
// aunque esas listas tienen tope de 5-8 y usan reglas propias por categoría.
const DESCUENTOS = {
  'bicis/descuentos.json': ['bicis'], 'celulares/descuentos.json': ['celulares_android', 'celulares_iphone'],
  'electrodomesticos/cafeteras/descuentos.json': ['cafeteras'], 'electrodomesticos/freidoras/descuentos.json': ['freidoras'],
  'electrodomesticos/microondas/descuentos.json': ['microondas'], 'laptops/descuentos.json': ['laptops'],
  'suplementos/complejo-b/descuentos.json': ['complejo_b'], 'suplementos/creatina/descuentos.json': ['creatina'],
  'suplementos/magnesio/descuentos.json': ['magnesio'], 'suplementos/omega3/descuentos.json': ['omega3'],
  'suplementos/proteina/descuentos.json': ['proteina'], 'suplementos/vitamina-d/descuentos.json': ['vitamina_d'],
  'tecnologia/audifonos/descuentos.json': ['tecnologia_audifonos'], 'tecnologia/bocinas/descuentos.json': ['tecnologia_bocinas'],
  'videojuegos/consolas/descuentos.json': ['videojuegos_consolas'], 'videojuegos/controles/descuentos.json': ['videojuegos_controles'],
  'videojuegos/juegos/descuentos.json': ['videojuegos_juegos'],
};
for (const [file, cats] of Object.entries(DESCUENTOS)) {
  let data;
  try { data = JSON.parse(readFileSync(join(root, file), 'utf8')); } catch { continue; }
  for (const x of data.descuentos || []) {
    if (!(typeof x.precioAntes === 'number' && typeof x.precioOferta === 'number' && x.precioAntes > x.precioOferta)) continue;
    const e = { id: String(x.id), nombre: x.nombre, plataforma: x.plataforma === 'amazon' ? 'amazon' : 'ml', antes: x.precioAntes, ahora: x.precioOferta,
      ahorro: Math.round(x.precioAntes - x.precioOferta), pct: Math.round((x.precioAntes - x.precioOferta) / x.precioAntes * 100) };
    for (const cat of cats) {
      if (cat === 'celulares_android' && !e.id.startsWith('android-')) continue;
      if (cat === 'celulares_iphone' && !e.id.startsWith('apple-')) continue;
      const l = (categorias[cat] = categorias[cat] || []);
      const i = l.findIndex((y) => y.id === e.id);
      if (i < 0) { l.push(e); total++; } else if (e.pct > l[i].pct) l[i] = e;
    }
  }
}
for (const l of Object.values(categorias)) l.sort((a, b) => b.pct - a.pct);

mkdirSync(join(root, 'assets/data'), { recursive: true });
writeFileSync(join(root, 'assets/data/bajadas.json'), JSON.stringify({ generadoEn: new Date().toISOString(), categorias }, null, 1) + '\n');
console.log(`bajadas.json: ${total} bajadas en ${Object.keys(categorias).length} categorías`);
for (const [c, l] of Object.entries(categorias)) console.log('  ' + c.padEnd(24) + l.length);
