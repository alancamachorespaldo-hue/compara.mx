#!/usr/bin/env node
/**
 * aplicar-productos.mjs — mete en merged-admin.json los cambios de producto que se hicieron a mano
 * en el Centro de Control (pestaña «Editar» del gestor de productos).
 *
 *   node scripts/aplicar-productos.mjs <archivo.json>                 # solo reporte
 *   node scripts/aplicar-productos.mjs <archivo.json> --aplicar
 *   node scripts/aplicar-productos.mjs <archivo.json> --aplicar --forzar   # salta el tope de salto
 *
 * Es el relevo de `extraer-artifact.js` para el Centro. La diferencia importa: el gestor guardaba
 * la base ENTERA dentro de su HTML y al extraerla se escribía completa, así que una corrida de
 * precios ocurrida mientras el gestor estaba abierto se perdía. Aquí viaja solo lo que cambió,
 * campo por campo, y todo lo demás del producto se queda como esté en la base.
 *
 * El Centro guarda cada edición en el almacenamiento del artifact (colección `productos`), de
 * donde sale un JSON con esta forma — es el que copia el botón «Copiar cambios»:
 *   [ { "cat": "laptops", "id": "exp_MLM65737068",
 *       "cambios": { "precioML": 17459, "linkML": "https://meli.la/…", "pausaML": false } }, … ]
 * También vale el volcado directo de la colección: { "laptops__exp_MLM65737068": { … } }.
 *
 * Campos que acepta (cualquier otro se rechaza y se dice cuál):
 *   nombre · marca · precioML · precioAmz · linkML · linkAmz · mlId · activo · pausaML · pausaAmz
 *   · _eliminado
 * Cadena vacía = borrar el dato (precio a null, link retirado, marca sin valor).
 *
 * Candados, los mismos que ya tiene la corrida de precios:
 *   · **Tope de salto (25%)**: un precio que se aleja más de eso del que hay en la base no se
 *     escribe y se reporta, salvo --forzar. Un cero mal tecleado no llega a la página.
 *   · **Tag de Amazon**: un `linkAmz` sin `tag=guiasdecomp01-20` se rechaza; sin el tag no paga
 *     comisión, así que publicarlo es peor que no tener link.
 *   · **_eliminado marca, no borra.** Borrar de verdad (sacarlo de la base y del array de la
 *     página) lo hace `precios-por-link.mjs` cuando el catálogo ya no existe, con copia en
 *     `papelera-productos.json`. Desde aquí solo se oculta.
 *   · Una pausa puesta aquí es **a mano**: se le quita `_pausaAuto`, así que ninguna corrida la
 *     levanta sola.
 *
 * Qué escribe: la base Y el precio en el array JS de las páginas de esa categoría (incluidas las
 * espejo), con la misma regla única de `_html-precios.js` que usa la corrida de precios. Las
 * pausas, lo inactivo y lo eliminado los aplica después `sync-pausas.js`.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIAS, paginasDe } from './categorias.js';
import { escribirPrecios } from './_html-precios.js';

const ROOT = resolve(import.meta.dirname, '..');
const RUTA = resolve(ROOT, 'scripts/merged-admin.json');
const APLICAR = process.argv.includes('--aplicar');
const FORZAR = process.argv.includes('--forzar');
const MAX_SALTO = 25;
const TAG_AMZ = 'guiasdecomp01-20';
const HOY = new Date().toISOString().slice(0, 10);

const archivo = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!archivo) {
  console.error('Uso: node scripts/aplicar-productos.mjs <archivo.json> [--aplicar] [--forzar]');
  process.exit(1);
}

const CAMPOS = {
  nombre: 'texto', marca: 'texto', precioML: 'precio', precioAmz: 'precio',
  linkML: 'enlace', linkAmz: 'enlaceAmz', mlId: 'mlId',
  activo: 'si_no', pausaML: 'si_no', pausaAmz: 'si_no', _eliminado: 'si_no',
};
const ETIQUETA = {
  nombre: 'Nombre', marca: 'Marca', precioML: 'Precio ML', precioAmz: 'Precio Amazon',
  linkML: 'Enlace ML', linkAmz: 'Enlace Amazon', mlId: 'ID de catálogo',
  activo: 'Activo', pausaML: 'Pausa ML', pausaAmz: 'Pausa Amazon', _eliminado: 'Eliminado',
};

const vacio = v => v == null || String(v).trim() === '';
const money = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX');
const texto = v => v == null ? '—' : String(v);

/** Normaliza y valida un valor. Devuelve {ok, valor} o {ok:false, error}. */
function limpiar(campo, bruto) {
  const tipo = CAMPOS[campo];
  switch (tipo) {
    case 'texto': {
      const s = String(bruto ?? '').trim();
      if (campo === 'nombre' && !s) return { ok: false, error: 'el nombre no puede quedar vacío' };
      return { ok: true, valor: s || null };
    }
    case 'precio': {
      if (vacio(bruto)) return { ok: true, valor: null };
      const n = Number(String(bruto).replace(/[$,\s]/g, ''));
      if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `"${bruto}" no es un precio` };
      return { ok: true, valor: Math.round(n) };
    }
    case 'enlace': {
      if (vacio(bruto)) return { ok: true, valor: null };
      const s = String(bruto).trim();
      if (!/^https?:\/\//i.test(s)) return { ok: false, error: 'el enlace tiene que empezar con http' };
      return { ok: true, valor: s };
    }
    case 'enlaceAmz': {
      if (vacio(bruto)) return { ok: true, valor: null };
      const s = String(bruto).trim();
      if (!/^https?:\/\//i.test(s)) return { ok: false, error: 'el enlace tiene que empezar con http' };
      if (!s.includes('tag=' + TAG_AMZ)) return { ok: false, error: `le falta tag=${TAG_AMZ}: sin el tag no paga comisión` };
      return { ok: true, valor: s };
    }
    case 'mlId': {
      if (vacio(bruto)) return { ok: true, valor: null };
      const s = String(bruto).trim().toUpperCase();
      const m = /MLM\d{6,12}/.exec(s);
      if (!m) return { ok: false, error: `"${bruto}" no parece un ID de catálogo (MLM…)` };
      return { ok: true, valor: m[0] };
    }
    case 'si_no': {
      if (typeof bruto === 'boolean') return { ok: true, valor: bruto };
      const s = String(bruto).trim().toLowerCase();
      if (['true', 'sí', 'si', '1'].includes(s)) return { ok: true, valor: true };
      if (['false', 'no', '0', ''].includes(s)) return { ok: true, valor: false };
      return { ok: false, error: `"${bruto}" no es sí ni no` };
    }
    default:
      return { ok: false, error: 'campo desconocido' };
  }
}

const crudo = JSON.parse(readFileSync(resolve(process.cwd(), archivo), 'utf8'));
const lista = Array.isArray(crudo) ? crudo : Object.entries(crudo).map(([k, v]) => ({
  cat: v.cat ?? k.split('__')[0],
  id: String(v.id ?? k.split('__').slice(1).join('__')),
  cambios: v.cambios || {},
}));

const db = JSON.parse(readFileSync(RUTA, 'utf8'));
const titulo = {};
for (const [clave, c] of Object.entries(CATEGORIAS)) titulo[c.datos || clave] = c.titulo;

const hechos = [], fallos = [], frenados = [], pendientes = new Set();
const preciosPorCat = {};

for (const entrada of lista) {
  const cat = entrada.cat, id = String(entrada.id);
  const arr = db[cat];
  if (!Array.isArray(arr)) { fallos.push(`${cat}: no existe esa categoría en la base`); continue; }
  const p = arr.find(x => String(x.id) === id);
  if (!p) { fallos.push(`${cat}/${id}: no existe ese producto`); continue; }

  const cambios = [];
  let tocaPagina = false;

  for (const [campo, bruto] of Object.entries(entrada.cambios || {})) {
    if (!(campo in CAMPOS)) { fallos.push(`${cat}/${id}: "${campo}" no es un campo editable`); continue; }
    const r = limpiar(campo, bruto);
    if (!r.ok) { fallos.push(`${cat}/${id} · ${ETIQUETA[campo]}: ${r.error}`); continue; }

    const antes = p[campo] ?? null;
    const despues = r.valor;
    if (CAMPOS[campo] === 'si_no' ? (!!antes === !!despues) : (String(antes ?? '') === String(despues ?? ''))) continue;

    // Tope de salto: un precio que se despega demasiado del que hay en la base no se escribe.
    if (CAMPOS[campo] === 'precio' && antes != null && despues != null) {
      const salto = Math.abs(despues - antes) / antes * 100;
      if (salto > MAX_SALTO && !FORZAR) {
        frenados.push(`${titulo[cat] || cat} · ${p.nombre.slice(0, 40)} · ${ETIQUETA[campo]}: ${money(antes)} → ${money(despues)} (${salto.toFixed(0)}%)`);
        continue;
      }
    }

    if (APLICAR) {
      p[campo] = despues;
      if (campo === 'pausaML' || campo === 'pausaAmz') {
        // Una pausa puesta desde el Centro es a mano: ninguna corrida la levanta sola.
        if (despues) { p._pausaAuto = false; p._motivoPausa = 'a mano desde el Centro'; p._pausaFecha = HOY; }
        else { delete p._pausaAuto; delete p._motivoPausa; delete p._pausaFecha; }
      }
      if (campo === 'linkML' && despues) {
        // Pegar un enlace nuevo revive un producto que se había quedado sin tienda.
        delete p._linkMuerto; delete p._linkMuertoFecha; delete p._linkMuertoMotivo; delete p._necesitaLink;
      }
    }
    cambios.push(`${ETIQUETA[campo]}: ${CAMPOS[campo] === 'precio' ? money(antes) + ' → ' + money(despues)
      : CAMPOS[campo] === 'si_no' ? (antes ? 'sí' : 'no') + ' → ' + (despues ? 'sí' : 'no')
      : texto(antes).slice(0, 48) + ' → ' + texto(despues).slice(0, 48)}`);
    if (['precioML', 'linkML'].includes(campo)) tocaPagina = true;
    if (['activo', 'pausaML', 'pausaAmz', '_eliminado', 'linkML', 'linkAmz'].includes(campo)) pendientes.add('pausas');
  }

  if (!cambios.length) continue;
  if (APLICAR) { p._editadoCentro = HOY; p._updatedAt = new Date().toISOString(); }
  if (tocaPagina && p.precioML > 0 && p.linkML) {
    (preciosPorCat[cat] ??= []).push({ id: p.id, linkML: p.linkML, precio: p.precioML });
  }
  hechos.push({ cat, catTitulo: titulo[cat] || cat, id, nombre: p.nombre, cambios });
}

if (APLICAR && hechos.length) writeFileSync(RUTA, JSON.stringify(db, null, 2));

/* ── El precio de la página sale del array JS, no de la base: hay que escribirlo ahí también ── */
let enHtml = 0;
if (APLICAR) {
  for (const [cat, precios] of Object.entries(preciosPorCat)) {
    for (const pag of paginasDe(cat)) {
      const r = escribirPrecios(resolve(ROOT, pag.file), pag.varName, pag.tipo, precios);
      if (!r.ok) { console.log('   ⚠ ' + pag.file + ': ' + r.motivo); continue; }
      enHtml += r.cambios;
      if (r.cambios) console.log('   📄 ' + pag.file + ': ' + r.cambios + ' precio(s) escrito(s)');
    }
  }
}

console.log(`\nCambios de producto${APLICAR ? ' aplicados' : ' (solo reporte)'} · ${hechos.length} producto(s)\n`);
for (const h of hechos) {
  console.log(`  ${h.catTitulo} · ${h.nombre.slice(0, 50)} (${h.id})`);
  for (const c of h.cambios) console.log(`      ${c}`);
}
if (!hechos.length) console.log('  Nada que cambiar: la base ya dice lo mismo.');

if (frenados.length) {
  console.log(`\n  🚧 Tope de salto (${MAX_SALTO}%) — no se escribieron, revísalos:`);
  for (const f of frenados) console.log('      · ' + f);
  console.log('      Si el precio de verdad cambió tanto, repite con --forzar.');
}
if (fallos.length) {
  console.log('\n  ❌ No se pudieron aplicar:');
  for (const f of fallos) console.log('      · ' + f);
}

if (APLICAR && hechos.length) {
  console.log(`\n  💾 merged-admin.json actualizado${enHtml ? ` · ${enHtml} precio(s) escritos en las páginas` : ''}`);
  const pasos = ['node scripts/generar-centro.js'];
  if (pendientes.has('pausas')) pasos.unshift('node scripts/sync-pausas.js');
  pasos.push('node scripts/check-site.js && node scripts/validar-datos.js');
  console.log('  👉 Ahora:\n' + pasos.map(s => '       ' + s).join('\n'));
} else if (!APLICAR) {
  console.log('\n  No se escribió nada. Agrega --aplicar.');
}
console.log('');
