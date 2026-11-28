#!/usr/bin/env node
/**
 * analitica-db.js — parte `scripts/analitica.json` en documentos para la base
 * (capacidad `db`) del Centro de Control, para que la sección Analítica se
 * actualice SIN republicar la página (28-nov-2026).
 *
 *   node scripts/analitica-db.js <carpeta-salida>
 *
 * Por qué así: republicar el Centro exige leer antes la versión viva completa
 * (~300 KB), y eso no es algo que deba pasar cada mañana. En cambio un
 * documento de la base se escribe desde un archivo sin tocar la página. El
 * límite de la base es 256 KiB por documento y `analitica.json` pesa más, así
 * que va partido: `analitica/meta` ({generado, partes, bytes}) y
 * `analitica/p0…pN` ({s: trozo del JSON compacto}). El Centro junta los trozos
 * y usa lo que sea más nuevo entre la base y el `analitica.json` publicado.
 *
 * Escribe un archivo por documento en <carpeta-salida> (meta.json, p0.json…)
 * e imprime un JSON con la lista, que es lo que usa la tarea programada
 * «Centro · analítica al día» para mandarlos con ArtifactData (file_path).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const salida = process.argv[2];
if (!salida) { console.error('Uso: node scripts/analitica-db.js <carpeta-salida>'); process.exit(2); }

const a = JSON.parse(fs.readFileSync(path.join(DIR, 'analitica.json'), 'utf8'));
const txt = JSON.stringify(a);
/* 150 000 caracteres por trozo: al guardarse como cadena las comillas se
   escapan (\") y el documento crece; así queda holgado bajo 256 KiB */
const TAM = 150000;
const partes = [];
for (let i = 0; i < txt.length; i += TAM) partes.push(txt.slice(i, i + TAM));

fs.mkdirSync(salida, { recursive: true });
const docs = [];
partes.forEach((s, i) => {
  const f = path.join(salida, 'p' + i + '.json');
  fs.writeFileSync(f, JSON.stringify({ s }));
  const kb = fs.statSync(f).size / 1024;
  if (kb > 250) { console.error('El trozo p' + i + ' pesa ' + kb.toFixed(0) + ' KiB: baja TAM'); process.exit(1); }
  docs.push({ doc_id: 'p' + i, file_path: f });
});
const meta = path.join(salida, 'meta.json');
fs.writeFileSync(meta, JSON.stringify({ generado: a.generado, estado: a.estado, partes: partes.length, bytes: txt.length }));
docs.unshift({ doc_id: 'meta', file_path: meta });

console.log(JSON.stringify({ collection: 'analitica', generado: a.generado, estado: a.estado, partes: partes.length, docs }, null, 2));
