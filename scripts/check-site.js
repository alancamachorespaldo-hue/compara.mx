#!/usr/bin/env node
// Validaciones del sitio. Uso: node scripts/check-site.js   (exit 1 si hay errores)
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '_interno', 'scripts', '.git', '.github', '.claude']);
const HTML_LINK_ALLOW = /^\/?(index|aviso-afiliados|privacidad|terminos)\.html$/;
const SECTIONS = 'electrodomesticos|celulares|suplementos|bicicletas|laptops|guias';

// Contenido que no debe desaparecer (protege contra regresiones como 40259fe)
const MUST_CONTAIN = {
  'index.html': ['id="como-usar"', 'id="metodo"', 'leads-section'],
  'electrodomesticos/index.html': ['href="/electrodomesticos/microondas/"', 'href="/electrodomesticos/freidoras/"'],
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, out); }
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
let pages = 0, redirects = 0;

for (const abs of walk(ROOT)) {
  const file = relative(ROOT, abs).replace(/\\/g, '/');
  const html = readFileSync(abs, 'utf8');
  const isRedirect = html.length < 3000 && /http-equiv="refresh"|location\.replace\(/i.test(html);
  isRedirect ? redirects++ : pages++;

  if (!isRedirect) {
    if (!html.includes('G-9TKZ4ER13X')) err(file, 'falta GA4 G-9TKZ4ER13X');
    if (file !== '404.html' && !html.includes('/js/onboarding.js')) err(file, 'falta /js/onboarding.js');
  }

  for (const m of html.matchAll(/[?&](?:amp;)?tag=([\w-]+)/g))
    if (m[1] !== 'comparalo20-20') err(file, `tag de afiliado incorrecto: tag=${m[1]}`);

  for (const m of html.matchAll(/href="([^"#?]+\.html)(?:[#?][^"]*)?"/g)) {
    const h = m[1];
    if (/^https?:\/\//.test(h) && !/comparalo\.mx/.test(h)) continue;
    const path = h.replace(/^https?:\/\/(www\.)?comparalo\.mx/, '');
    if (!HTML_LINK_ALLOW.test(path)) err(file, `link a .html: ${h}`);
  }

  for (const m of html.matchAll(new RegExp(`(?:comparalo\\.mx|href=")\\/(${SECTIONS})([a-z][\\w-]*)`, 'g')))
    err(file, `URL sin barra: /${m[1]}${m[2]}`);

  if (!isRedirect) {
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/application\/ld\+json/.test(m[1])) {
        try { JSON.parse(m[2]); } catch (e) { err(file, `JSON-LD inválido: ${e.message.slice(0, 80)}`); }
      } else if (!/type="(?!text\/javascript|module)/.test(m[1])) {
        try { new vm.Script(m[2]); } catch (e) { err(file, `error de sintaxis JS: ${e.message.slice(0, 80)}`); }
      }
    }
  }

  for (const needle of MUST_CONTAIN[file] || [])
    if (!html.includes(needle)) err(file, `falta contenido esperado: ${needle}`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s) en ${pages} páginas:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${pages} páginas y ${redirects} redirecciones sin problemas`);
