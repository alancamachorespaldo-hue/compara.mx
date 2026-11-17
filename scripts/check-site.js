#!/usr/bin/env node
// Validaciones del sitio. Uso: node scripts/check-site.js   (exit 1 si hay errores)
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { entradas, clavesDeDatos } from './categorias.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '_interno', 'scripts', '.git', '.github', '.claude', 'admin']);
const HTML_LINK_ALLOW = /^\/?(index|aviso-afiliados|privacidad|terminos)\.html$/;
const SECTIONS = 'electrodomesticos|celulares|suplementos|bicicletas|laptops|guias';

// Contenido que no debe desaparecer (protege contra regresiones como 40259fe)
const MUST_CONTAIN = {
  'index.html': ['id="metodo"', 'leads-section'],
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

const SITEMAP = new Set([...readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const SITEMAP_EXEMPT = new Set(['celulares/comparar/index.html']);
const LAYOUT_EXEMPT = new Set(['video-resenas.html']); // herramienta interna con noindex

const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
let pages = 0, redirects = 0;

for (const abs of walk(ROOT)) {
  const file = relative(ROOT, abs).replace(/\\/g, '/');
  const html = readFileSync(abs, 'utf8');
  const isRedirect = html.length < 3000 && /http-equiv="refresh"|location\.replace\(/i.test(html);
  isRedirect ? redirects++ : pages++;

  if (!html.includes('G-9TKZ4ER13X')) err(file, 'falta GA4 G-9TKZ4ER13X');
  if (!isRedirect && file !== '404.html' && !html.includes('/js/onboarding.js')) err(file, 'falta /js/onboarding.js');

  // Tags de afiliado Amazon permitidos: el legado (cuenta vieja) y el nuevo de
  // la cuenta nov-2026 que usan las guías de /guias-compra/ (StoreID guiasdecomp01-20).
  const TAGS_OK = ['comparalo20-20', 'guiasdecomp01-20'];
  for (const m of html.matchAll(/[?&](?:amp;)?tag=([\w-]+)/g))
    if (!TAGS_OK.includes(m[1])) err(file, `tag de afiliado incorrecto: tag=${m[1]}`);

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

  // Encabezado y pie compartidos (los escribe scripts/sync-site.js)
  if (!isRedirect && !LAYOUT_EXEMPT.has(file)) {
    for (const marker of ['cmx-header', 'cmx-footer'])
      if (!html.includes(`<!-- ${marker}:start -->`)) err(file, `falta el bloque ${marker}; corre node scripts/sync-site.js`);
    const ft = html.match(/<!-- cmx-footer:start -->([\s\S]*?)<!-- cmx-footer:end -->/);
    if (ft && !ft[1].includes('href="/aviso-afiliados/"')) err(file, 'el pie no enlaza al aviso de afiliados');
    if (!html.includes('/assets/css/cmx-site.css')) err(file, 'falta /assets/css/cmx-site.css');
  }

  // Sitemap: toda página indexable debe estar listada
  if (!isRedirect && file.endsWith('/index.html') && !/noindex/i.test(html) && !SITEMAP_EXEMPT.has(file)) {
    const url = 'https://comparalo.mx/' + file.replace(/index\.html$/, '');
    if (!SITEMAP.has(url)) err(file, 'no está en sitemap.xml');
  }

  for (const needle of MUST_CONTAIN[file] || [])
    if (!html.includes(needle)) err(file, `falta contenido esperado: ${needle}`);
}

// Histórico de precios (assets/data/historico/*.json, lo escribe scripts/generar-historico.js).
// Protege la regla de transparencia: nada de fechas futuras, variaciones con pocos datos,
// estados que no corresponden al número de registros ni gráficas con menos de 7 puntos.
const HIST_DIR = join(ROOT, 'assets/data/historico');
if (existsSync(HIST_DIR)) {
  const HOY = new Date().toISOString().slice(0, 10);
  for (const name of readdirSync(HIST_DIR).filter((n) => n.endsWith('.json'))) {
    const file = 'assets/data/historico/' + name;
    let j;
    try { j = JSON.parse(readFileSync(join(HIST_DIR, name), 'utf8')); }
    catch (e) { err(file, `JSON inválido: ${e.message.slice(0, 60)}`); continue; }
    const f = j.fechas;
    if (!Array.isArray(f) || !f.length) { err(file, 'sin arreglo de fechas'); continue; }
    if (f.some((d, i) => i && d <= f[i - 1])) err(file, 'las fechas no van en orden ascendente');
    if (f[f.length - 1] > HOY) err(file, `fecha futura: ${f[f.length - 1]}`);
    if (j.ventana !== f.length) err(file, 'ventana no coincide con el número de fechas');
    for (const [id, p] of Object.entries(j.productos || {})) {
      const ref = `producto ${id}`;
      if (!(p.n > 0)) { err(file, `${ref}: sin registros`); continue; }
      if (p.n > f.length) err(file, `${ref}: más registros (${p.n}) que días de la ventana`);
      if (p.desde < f[0] || p.desde > HOY) err(file, `${ref}: "desde" fuera de la ventana (${p.desde})`);
      const esperado = p.n >= 28 ? 'completo' : p.n >= 7 ? 'parcial' : (p.estado === 'nuevo' ? 'nuevo' : 'insuficiente');
      if (p.estado !== esperado) err(file, `${ref}: estado "${p.estado}" con ${p.n} registros`);
      if (p.var !== undefined && p.n < 14) err(file, `${ref}: variación con solo ${p.n} registros`);
      if (p.n >= 7 && !(p.p || []).length) err(file, `${ref}: sin puntos para la gráfica`);
      if ((p.p || []).some(([i]) => i < 0 || i >= f.length)) err(file, `${ref}: punto fuera de la ventana`);
      if (p.min > p.actual || p.max < p.actual) err(file, `${ref}: precio actual fuera del rango min/max`);
    }
  }
}


// ── Registro de categorías ───────────────────────────────────────────────────
// Red para que una categoría nueva no se quede a medias: si está en merged-admin.json
// pero no en scripts/categorias.js, no recibe revisión de disponibilidad ni pausas, y un
// producto caído se seguiría anunciando. Y si su página no tiene el bloque de pausas,
// pausarlo en el gestor no lo quita del sitio.
{
  const ADMIN = join(ROOT, 'scripts/merged-admin.json');
  if (existsSync(ADMIN)) {
    let db = null;
    try { db = JSON.parse(readFileSync(ADMIN, 'utf8')); } catch { /* lo valida validar-datos.js */ }
    if (db) {
      const registradas = clavesDeDatos();
      for (const k of Object.keys(db)) {
        if (!Array.isArray(db[k]) || !db[k].length) continue;
        if (!registradas.includes(k))
          err('scripts/categorias.js', `la categoría "${k}" existe en merged-admin.json pero no está registrada: no recibirá precios, revisión de disponibilidad ni pausas`);
      }
    }
  }
  for (const [clave, c] of entradas()) {
    const abs = join(ROOT, c.file);
    if (!existsSync(abs)) { err('scripts/categorias.js', `${clave}: no existe la página ${c.file}`); continue; }
    const html = readFileSync(abs, 'utf8');
    if (!new RegExp(String.raw`(?:const|var|let)\s+${c.varName}\s*=\s*\[`).test(html))
      err(c.file, `${clave}: no se encontró el array ${c.varName} (lo necesitan ml-update.js y sync-pausas.js)`);
    else if (!html.includes('/*PAUSAS*/'))
      err(c.file, `${clave}: falta el bloque de pausas — corre "node scripts/sync-pausas.js"`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s) en ${pages} páginas:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${pages} páginas y ${redirects} redirecciones sin problemas`);
