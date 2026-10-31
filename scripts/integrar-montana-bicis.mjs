#!/usr/bin/env node
/**
 * Integra los resultados de fetch-montana-bicis.mjs en merged-admin.json
 * y genera los nuevos entries para el array MONTANA en bicis/index.html.
 *
 * Uso: node scripts/integrar-montana-bicis.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const fetchResults = JSON.parse(readFileSync(resolve(__dirname, 'montana-fetch-result.json'), 'utf8'));
const admin = JSON.parse(readFileSync(resolve(__dirname, 'merged-admin.json'), 'utf8'));

// IDs ya usados en MONTANA: 101-106, 201-206 → usar 501+
let nextId = 501;

function extractRodada(nombre) {
  const m = nombre?.match(/[Rr](?:odad[ao]\s+)?(\d+\.?\d*)(?:\s|v|$|")/);
  if (m) return `${m[1]}"`;
  if (/26/i.test(nombre)) return '26"';
  if (/27\.5/i.test(nombre)) return '27.5"';
  if (/27"/i.test(nombre)) return '27"';
  if (/29/i.test(nombre)) return '29"';
  if (/24/i.test(nombre)) return '24"';
  return '';
}

function extractVelocidades(nombre) {
  const m = nombre?.match(/(\d+)\s*[Vv](?:el|oc)?(?:\.|$|\s|,)/);
  return m ? m[1] : '21';
}

function cleanNombre(raw) {
  // Capitaliza correctamente, acorta nombres muy largos
  return raw?.replace(/\s+/g, ' ').trim() || 'Bicicleta de Montaña';
}

const validos = fetchResults.filter(r => !r.error && r.imagen);

// Construir entradas para merged-admin.json
const bicisMontana = validos.map(r => {
  const id = nextId++;
  const rodada = r.especs?.rodada ? `${r.especs.rodada}"` : extractRodada(r.nombre);
  const velocidades = extractVelocidades(r.nombre);

  return {
    id,
    nombre:   cleanNombre(r.nombre),
    marca:    r.marca || '',
    mlId:     r.mlId,
    mlIdFuente: 'afiliado',
    linkML:   r.linkML,
    linkAmz:  null,
    precioML: r.precioML || null,
    precioAmz: null,
    imagen:   r.imagen,
    estrellas: null,
    resenas:   null,
    activo:    true,
    especs: {
      tipo:        'montaña',
      rodada,
      velocidades,
      suspension:  r.especs?.suspension || null,
      frenos:      r.especs?.frenos || null,
      peso:        r.especs?.peso || null,
      cargaMax:    r.especs?.cargaMax || null,
    },
    _updatedAt: new Date().toISOString(),
  };
});

// Guardar en merged-admin.json
admin.bicisMontana = bicisMontana;
writeFileSync(resolve(__dirname, 'merged-admin.json'), JSON.stringify(admin, null, 2));
console.log(`✓ ${bicisMontana.length} bicis guardadas en merged-admin.json bajo "bicisMontana"`);

// Generar snippet JS para insertar en MONTANA array de bicis/index.html
const mtLines = bicisMontana.map(b => {
  const rod = b.especs.rodada || '';
  const vel = b.especs.velocidades || '21';
  const imgUrl = (b.imagen || '').replace(/-[A-Z]\.jpg$/, '-F.jpg').replace(/-[A-Z]\.webp$/, '-F.webp');
  const nomCorto = b.nombre.replace(/'/g, "\\'").slice(0, 70);
  const marca = b.marca.replace(/'/g, "\\'");
  const link = b.linkML;
  return `  {id:${b.id},nombre:'${nomCorto}',marca:'${marca}',tipo:'mtb',\n`
       + `   precio:${b.precioML || 0},velocidad:0,peso:0,rueda:'${rod}',velocidades:'${vel}',cargaMax:0,\n`
       + `   estrellas:0,resenas:0,\n`
       + `   badges:[{t:'ML',c:'b-ml'}],\n`
       + `   linkML:'${link}',\n`
       + `   img:'${imgUrl}'}`;
}).join(',\n');

const snippetPath = resolve(__dirname, 'montana-entries-snippet.js');
writeFileSync(snippetPath, mtLines);
console.log(`✓ Snippet HTML guardado en ${snippetPath}`);
console.log('\nEntradas generadas:');
bicisMontana.forEach(b => console.log(`  [${b.id}] ${b.nombre.slice(0,55)} | ${b.especs.rodada} | ${b.mlId}`));
