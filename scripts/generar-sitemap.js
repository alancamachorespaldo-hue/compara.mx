#!/usr/bin/env node
// Genera sitemap.xml escaneando todos los index.html del sitio.
// Omite páginas con noindex y redireccionadores (meta refresh sin contenido real).
// Lastmod viene de git log para reflejar el último cambio real de cada archivo.

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, relative, join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const ROOT = resolve(__dirname, '..');
const BASE_URL = 'https://comparalo.mx';

// Directorios que no son páginas públicas
const SKIP_DIRS = new Set(['node_modules', '.git', 'scripts', 'assets']);

// Prioridades por sección
function getPriority(urlPath) {
  if (urlPath === '/') return '1.0';
  const depth = urlPath.replace(/^\/|\/$/g, '').split('/').length;
  const section = urlPath.split('/')[1];
  const lowPriority = new Set(['sobre-nosotros', 'aviso-afiliados', 'privacidad', 'terminos']);
  if (lowPriority.has(section)) return depth === 1 ? '0.5' : '0.3';
  if (depth === 1) return '0.9';
  if (depth === 2) return '0.85';
  return '0.75';
}

// Frecuencia por profundidad/sección
function getChangefreq(urlPath) {
  const lowFreq = new Set(['sobre-nosotros', 'aviso-afiliados', 'privacidad', 'terminos']);
  const section = urlPath.split('/')[1];
  if (lowFreq.has(section)) return 'yearly';
  const depth = urlPath.replace(/^\/|\/$/g, '').split('/').length;
  if (depth <= 1) return 'weekly';
  return 'monthly';
}

// Lastmod desde git; si el archivo no está en git, usa hoy
function getLastmod(filePath) {
  try {
    const rel = relative(ROOT, filePath).replace(/\\/g, '/');
    const date = execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    return date || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Detecta noindex y meta-refresh (redireccionadores)
function shouldSkip(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    // noindex
    if (/content=["'][^"']*noindex/i.test(content)) return true;
    // meta refresh (redireccionadores del root)
    if (/<meta[^>]+http-equiv=["']refresh["']/i.test(content)) return true;
    return false;
  } catch {
    return true;
  }
}

// Recorre el árbol de directorios
function collectPages(dir, pages = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return pages; }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPages(full, pages);
    } else if (entry.name === 'index.html') {
      const rel = relative(ROOT, full).replace(/\\/g, '/');
      // Convierte ruta del archivo a URL: foo/index.html -> /foo/
      let urlPath = '/' + rel.replace(/\/index\.html$/, '/').replace(/^index\.html$/, '');
      if (!urlPath.endsWith('/')) urlPath += '/';

      if (shouldSkip(full)) continue;

      pages.push({ urlPath, filePath: full });
    }
  }
  return pages;
}

const pages = collectPages(ROOT);

// Ordena: primero por sección, luego por profundidad
pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

for (const { urlPath, filePath } of pages) {
  const loc = BASE_URL + urlPath;
  const lastmod = getLastmod(filePath);
  const changefreq = getChangefreq(urlPath);
  const priority = getPriority(urlPath);
  lines.push(`  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
}

lines.push('</urlset>', '');

const outPath = join(ROOT, 'sitemap.xml');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`sitemap.xml generado: ${pages.length} URLs`);
pages.forEach(p => console.log(' ', p.urlPath));
