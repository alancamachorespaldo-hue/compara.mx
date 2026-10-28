#!/usr/bin/env node
/**
 * sync-cupon.js — Lee cupon-config.json e inyecta (o quita) el banner de cupón
 * en todos los index.html del sitio.
 * Uso: node scripts/sync-cupon.js [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CUPON_PATH = resolve(ROOT, 'scripts/cupon-config.json');
const DRY = process.argv.includes('--dry-run');

if (!existsSync(CUPON_PATH)) {
  console.error('❌ No existe scripts/cupon-config.json — guarda el artifact primero y ejecuta extraer-artifact.js');
  process.exit(1);
}

const cupon = JSON.parse(readFileSync(CUPON_PATH, 'utf8'));
console.log(`Cupón: activo=${cupon.activo} · código="${cupon.codigo}" · descuento="${cupon.descuento}"`);
if (DRY) console.log('(--dry-run: no se escribe nada)\n');

const MARKER_START = '<!-- cupon-banner:start -->';
const MARKER_END   = '<!-- cupon-banner:end -->';

function buildBanner(c) {
  const safe = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const linkHtml = c.linkProductos
    ? `<a href="${safe(c.linkProductos)}" target="_blank" rel="noopener sponsored" style="color:#006847;font-weight:700;font-size:12px;text-decoration:underline;white-space:nowrap;margin-left:auto">Ver productos válidos →</a>`
    : '';
  const condHtml = c.condiciones
    ? `<span style="color:#555;font-size:12px">${safe(c.condiciones)}</span>`
    : '';
  return `${MARKER_START}
<div id="cupon-banner-ml" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;padding:10px 18px;background:#ffe600;color:#1a1a2e;font:13px/1.35 system-ui,sans-serif;border-bottom:2px solid #d4c100">
  <span style="font-size:16px">🏷️</span>
  <strong style="font-size:14px">Cupón ML: <span style="font-family:monospace;letter-spacing:.05em">${safe(c.codigo)}</span></strong>
  <span style="font-weight:600;color:#333">${safe(c.descuento)}</span>
  ${condHtml}
  ${linkHtml}
</div>
${MARKER_END}`;
}

function stripBanner(html) {
  const re = new RegExp(`\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'g');
  return html.replace(re, '');
}

// Directorios a excluir
const EXCLUDE = new Set(['.git', '.claude', 'node_modules', 'scripts', '.github']);

function findIndexFiles(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    if (EXCLUDE.has(name)) continue;
    const full = join(dir, name);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) { findIndexFiles(full, acc); }
    else if (name === 'index.html') acc.push(full);
  }
  return acc;
}

const files = findIndexFiles(ROOT);
let updated = 0, unchanged = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let html = stripBanner(original);

  if (cupon.activo && cupon.codigo) {
    html = html.replace('</body>', buildBanner(cupon) + '\n</body>');
  }

  if (html === original) { unchanged++; continue; }
  if (!DRY) writeFileSync(file, html, 'utf8');
  updated++;
  console.log(`  ${cupon.activo ? '+ banner' : '- banner'}  ${relative(ROOT, file)}`);
}

const action = cupon.activo ? `banner inyectado (código: ${cupon.codigo})` : 'banner eliminado';
console.log(`\n✓ ${action} · ${updated} páginas actualizadas · ${unchanged} sin cambios`);
if (DRY && updated) console.log('  Ejecuta sin --dry-run para aplicar los cambios.');
if (!DRY && updated) console.log('  Haz commit y push para que aparezca en el sitio.');
