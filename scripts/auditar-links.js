#!/usr/bin/env node
/**
 * auditar-links.js — Revisa los links de afiliado de una categoría contra la ficha real
 * de Mercado Libre y corrige el ID de catálogo (mlId).
 *
 * Sirve para dos cosas que antes se hacían a mano en el artifact:
 *  1. Rellenar el mlId de los productos que tienen link pero no ID, que por eso nunca
 *     reciben precio y se quedan con la cifra escrita a mano.
 *  2. Detectar un mlId equivocado. Nov-2026, bicis: la AMYET SE1 llevaba el catálogo de
 *     la AMYET EB26 y su oferta de $3,999 se publicó en el inicio como una bajada del 72%
 *     de una bici de $25,000 que además está pausada.
 *
 * Un link "caído" ya no abre ningún producto: la página de afiliado muestra entonces su
 * tarjeta destacada por defecto, la misma para todos, así que se reconoce porque varios
 * productos sin relación resuelven al mismo catálogo y el nombre no se parece en nada.
 *
 * Uso:
 *   node scripts/auditar-links.js --categoria=magnesio,laptops [--aplicar]
 *   node scripts/auditar-links.js --todas [--aplicar]
 *
 * Sin --aplicar solo escribe scripts/links-report.json. Con --aplicar corrige el mlId
 * en merged-admin.json; nunca borra un producto: lo que esté caído o pausado se reporta
 * para decidirlo a mano.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { resolverAfiliado } from './resolver-afiliado.js';

const ROOT = resolve(import.meta.dirname, '..');
const ADMIN = resolve(ROOT, 'scripts/merged-admin.json');
const REPORTE = resolve(ROOT, 'scripts/links-report.json');
const APLICAR = process.argv.includes('--aplicar');
const TODAS = process.argv.includes('--todas');
const CATS = process.argv.find(a => a.startsWith('--categoria='))?.split('=')[1]?.split(',').filter(Boolean) ?? [];
const CONCURRENCIA = 3;

const db = JSON.parse(readFileSync(ADMIN, 'utf8'));
const claves = TODAS ? Object.keys(db).filter(k => Array.isArray(db[k])) : CATS;
if (!claves.length) {
  console.error('Faltan categorías. Usa --categoria=a,b o --todas.');
  console.error('Disponibles:', Object.keys(db).filter(k => Array.isArray(db[k])).join(', '));
  process.exit(1);
}
for (const k of claves) if (!Array.isArray(db[k])) { console.error(`No existe la categoría ${k}`); process.exit(1); }

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'en', 'y', 'a', 'por', 'sin', 'color', 'sabor', 'the', 'and', 'with', 'for']);
const palabras = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !PALABRAS_VACIAS.has(t));
function parecido(a, b) {
  const A = new Set(palabras(a)), B = new Set(palabras(b));
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return 2 * i / (A.size + B.size);
}

const tareas = [];
for (const k of claves) for (const p of db[k]) if (p.linkML) tareas.push({ cat: k, p });
console.log(`\n🔗 ${tareas.length} links por revisar en ${claves.length} categoría(s)\n`);

const filas = [];
let hechos = 0;
const pendientes = tareas.slice();
await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
  while (pendientes.length) {
    const { cat, p } = pendientes.shift();
    const r = await resolverAfiliado(p.linkML).catch(e => ({ ok: false, motivo: e.message }));
    filas.push({
      categoria: cat, id: String(p.id), nombre: p.nombre, marca: p.marca ?? null,
      linkML: p.linkML, afiliado: Boolean(r.afiliado),
      mlIdGuardado: p.mlId ?? null, mlIdReal: r.mlId ?? null, itemId: r.itemId ?? null,
      tituloReal: r.titulo ?? null, precioGuardado: p.precioML ?? null, precioReal: r.precio ?? null,
      pausada: Boolean(r.pausada), ok: Boolean(r.ok), motivo: r.motivo ?? null,
      parecido: Math.round(100 * parecido(`${p.marca || ''} ${p.nombre}`, r.titulo)),
    });
    if (++hechos % 20 === 0) console.log(`  ${hechos}/${tareas.length}…`);
    await new Promise(s => setTimeout(s, 250));
  }
}));

// Tarjeta por defecto del perfil: varios productos distintos cayendo en el mismo catálogo.
const cuenta = {};
for (const f of filas) if (f.mlIdReal) cuenta[f.mlIdReal] = (cuenta[f.mlIdReal] || 0) + 1;
for (const f of filas) {
  const compartido = f.mlIdReal ? cuenta[f.mlIdReal] : 0;
  f.estado = !f.ok ? 'link_roto'
    // La tarjeta por defecto del perfil no siempre es la misma (se han visto una consola
    // Switch y un PlayStation 5), así que basta con que dos productos sin relación caigan
    // en el mismo catálogo y el nombre no se parezca: el iPhone 18 Pro Max de 512 GB y el
    // de 1 TB abrían los dos el mismo PS5 de $13,932.
    : (f.parecido < 20 && compartido >= 2) ? 'link_caido'
      : f.pausada ? 'pausada'
        : !f.mlIdReal ? 'sin_catalogo'
          : f.parecido < 20 ? 'revisar'
            : !f.mlIdGuardado ? 'id_nuevo'
              : f.mlIdGuardado !== f.mlIdReal ? 'id_corregido'
                : 'ok';
}

filas.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.id.localeCompare(b.id));
writeFileSync(REPORTE, JSON.stringify({ generadoEn: new Date().toISOString(), total: filas.length, items: filas }, null, 1), 'utf8');

const resumen = {};
for (const f of filas) ((resumen[f.categoria] ||= {})[f.estado] = (resumen[f.categoria][f.estado] || 0) + 1);
console.log('\n📋 Resultado');
for (const [k, v] of Object.entries(resumen)) console.log(`  ${k.padEnd(18)} ${JSON.stringify(v)}`);

for (const f of filas.filter(f => f.estado === 'id_corregido')) {
  console.log(`\n  ⚠ ${f.categoria}:${f.id} ${f.nombre.slice(0, 44)}`);
  console.log(`     guardado ${f.mlIdGuardado} → real ${f.mlIdReal} · "${(f.tituloReal || '').slice(0, 52)}"`);
}
for (const f of filas.filter(f => f.estado === 'revisar')) {
  console.log(`\n  ? ${f.categoria}:${f.id} parecido ${f.parecido}% — "${f.nombre.slice(0, 40)}" vs "${(f.tituloReal || '').slice(0, 44)}"`);
}

if (APLICAR) {
  const porClave = new Map(filas.map(f => [`${f.categoria}|${f.id}`, f]));
  let puestos = 0, corregidos = 0, marcados = 0;
  for (const k of claves) for (const p of db[k]) {
    const f = porClave.get(`${k}|${String(p.id)}`);
    if (!f) continue;
    if ((f.estado === 'id_nuevo' || f.estado === 'id_corregido') && f.mlIdReal) {
      if (p.mlId !== f.mlIdReal) (p.mlId ? corregidos++ : puestos++);
      p.mlId = f.mlIdReal;
      p.mlIdFuente = 'afiliado-resuelto';
      p._mlCheckedAt = new Date().toISOString();
    }
    // No se borra nada: solo se deja anotado para revisarlo en el gestor.
    if (f.estado === 'link_caido' || f.estado === 'pausada' || f.estado === 'link_roto') {
      p._linkRevisar = f.estado;
      marcados++;
    } else if (p._linkRevisar) delete p._linkRevisar;
  }
  writeFileSync(ADMIN, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n💾 merged-admin.json: ${puestos} IDs nuevos · ${corregidos} corregidos · ${marcados} marcados para revisar`);
} else {
  console.log(`\n🔍 Solo lectura. Corre otra vez con --aplicar para escribir los IDs.`);
}
console.log(`📄 Detalle en scripts/links-report.json\n`);
