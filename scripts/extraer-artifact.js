#!/usr/bin/env node
/**
 * extraer-artifact.js — Toma el HTML guardado del artifact y escribe su base de datos
 * en scripts/merged-admin.json, mostrando cuántos productos cambiaron.
 * Uso: node scripts/extraer-artifact.js <archivo.html>
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');
const file = process.argv[2];
if (!file || !existsSync(file)) { console.error('Uso: node scripts/extraer-artifact.js <archivo.html>'); process.exit(1); }

const html = readFileSync(file, 'utf8');
let db = null;
const json = html.match(/<script type="application\/json" id="db">([\s\S]*?)<\/script>/);
if (json) db = JSON.parse(json[1]);
else {
  const legacy = html.match(/atob\('([A-Za-z0-9+/=]+)'\)/);
  if (legacy) db = JSON.parse(Buffer.from(legacy[1], 'base64').toString('utf8'));
}
if (!db || typeof db !== 'object') { console.error('❌ No encontré los datos del artifact en ese archivo'); process.exit(1); }

const prev = existsSync(ADMIN_PATH) ? JSON.parse(readFileSync(ADMIN_PATH, 'utf8')) : {};
let total = 0, changed = 0, added = 0, removed = 0;
for (const [cat, list] of Object.entries(db)) {
  const before = new Map((prev[cat] || []).map(p => [String(p.id), JSON.stringify(p)]));
  for (const p of list) {
    total++;
    const b = before.get(String(p.id));
    if (b === undefined) added++;
    else if (b !== JSON.stringify(p)) changed++;
    before.delete(String(p.id));
  }
  removed += before.size;
}
writeFileSync(ADMIN_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log(`✓ merged-admin.json: ${total} productos · ${changed} modificados · ${added} nuevos · ${removed} eliminados`);
