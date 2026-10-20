#!/usr/bin/env node
// Elimina entradas duplicadas (mismo id) en celulares_android de merged-admin.json.
// Para cada grupo de duplicados: conserva el que tiene mlId (si alguno lo tiene),
// o el de menor precioML en caso de empate.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'merged-admin.json');
const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const android = db.celulares_android || [];

const seen = new Map();   // id → index in deduped
const deduped = [];
let removed = 0;

for (const p of android) {
  if (!seen.has(p.id)) {
    seen.set(p.id, deduped.length);
    deduped.push(Object.assign({}, p));
  } else {
    const prev = deduped[seen.get(p.id)];
    if (p.mlId && !prev.mlId) {
      // Este tiene mlId y el anterior no → absorber mlId y precio
      prev.mlId = p.mlId;
      if (p.mlIdFuente) prev.mlIdFuente = p.mlIdFuente;
      if (p.precioML) prev.precioML = p.precioML;
      if (p._updatedAt && p._updatedAt > (prev._updatedAt || '')) prev._updatedAt = p._updatedAt;
    } else if (!p.mlId && !prev.mlId && p.precioML != null && (prev.precioML == null || p.precioML < prev.precioML)) {
      // Ambos sin mlId → conservar el precio más bajo
      prev.precioML = p.precioML;
    }
    removed++;
  }
}

if (removed === 0) {
  console.log('Sin duplicados — merged-admin.json no modificado.');
  process.exit(0);
}

db.celulares_android = deduped;
fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
console.log(`dedup-android: ${removed} duplicado(s) eliminado(s). celulares_android ahora tiene ${deduped.length} productos.`);
