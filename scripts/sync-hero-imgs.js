#!/usr/bin/env node
// Mantiene vivas las fotos decorativas (hero y tarjetas de guías) de los listados con la plantilla
// cmx-list. Esas fotos son de productos del catálogo y se cargan desde Mercado Libre; si el
// producto se da de baja, la foto desaparece y queda un hueco.
//
// Uso: node scripts/sync-hero-imgs.js [--check]
//
// Para cada <img data-cmx-img ... src="..."> de una página con CmxList.init:
//   - sigue igual si la foto responde y pertenece a un producto que aún está en el catálogo;
//   - se sustituye si la foto ya no existe (404/410) o su producto salió del catálogo.
// El reemplazo es la foto del producto más completo de ESA misma página que responda y que no
// esté ya usada en ella. Un error de red no cuenta como foto caída: ante la duda no se toca nada.
// Nunca termina con error: corre dentro del workflow de precios y no debe detenerlo.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SKIP = new Set(['node_modules', '_interno', 'scripts', '.git', '.github', '.claude', 'admin', 'assets', 'js', 'fotos']);
const ARRAYS = ['productos', 'micros', 'PRODUCTOS', 'familias', 'RUTA', 'ELECTRICAS', 'MONTANA'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP.has(name)) walk(p, out); }
    else if (name === 'index.html') out.push(p);
  }
  return out;
}

function catalogo(html) {
  for (const name of ARRAYS) {
    const i = html.search(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\[`));
    if (i < 0) continue;
    const start = html.indexOf('[', i), end = html.indexOf('\n];', start);
    if (end < 0) continue;
    try { const arr = vm.runInNewContext('(' + html.slice(start, end + 2) + ')', {}, { timeout: 3000 }); if (Array.isArray(arr) && arr.length) return arr; } catch { /* siguiente */ }
  }
  return [];
}
const fotoDe = (p) => p.imagen || p.img || p.image || (Array.isArray(p.variantes) && p.variantes[0] && (p.variantes[0].imagen || p.variantes[0].img)) || '';
const completitud = (p) => Object.values(p.especs || p).filter((v) => v != null && v !== '' && typeof v !== 'object').length;

// 'ok' | 'caida' | 'duda'
const cache = new Map();
async function estado(url) {
  if (cache.has(url)) return cache.get(url);
  let r = 'duda';
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(12000) });
    // Mercado Libre no responde 404: redirige las fotos borradas a una imagen 'img-not-available'
    const perdida = /img-not-available/.test(res.url || '');
    r = perdida || res.status === 404 || res.status === 410 ? 'caida' : (res.ok || res.status === 206) ? 'ok' : 'duda';
  } catch { r = 'duda'; }
  cache.set(url, r);
  return r;
}

let cambios = 0;
try {
  for (const abs of walk(ROOT)) {
    let html = readFileSync(abs, 'utf8');
    if (!html.includes('data-cmx-img') || !html.includes('CmxList.init')) continue;
    const file = relative(ROOT, abs).replace(/\\/g, '/');
    const prods = catalogo(html);
    if (!prods.length) { console.warn(`  · ${file}: sin catálogo legible, no se revisa`); continue; }
    const vivas = new Set(prods.map(fotoDe).filter(Boolean));
    const candidatos = prods.filter(fotoDe).sort((a, b) => completitud(b) - completitud(a)).map(fotoDe);
    const tags = [...html.matchAll(/<img\b[^>]*\bdata-cmx-img\b[^>]*>/g)].map((m) => m[0]);
    const usadas = new Set(tags.map((t) => (t.match(/\bsrc="([^"]+)"/) || [])[1]).filter(Boolean));
    for (const tag of tags) {
      const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
      if (!src || !/^https?:/.test(src)) continue; // archivo propio del repo: no se toca
      const fuera = !vivas.has(src);
      const st = fuera ? 'caida' : await estado(src);
      if (st !== 'caida') continue;
      let nuevo = null;
      for (const c of candidatos) { if (usadas.has(c)) continue; if (await estado(c) === 'ok') { nuevo = c; break; } }
      if (!nuevo) { console.warn(`  · ${file}: ${src} ${fuera ? 'ya no está en el catálogo' : 'no responde'} y no hay reemplazo disponible`); continue; }
      usadas.add(nuevo);
      html = html.replace(tag, tag.replace(src, nuevo));
      cambios++;
      console.log(`  ${file}: ${fuera ? 'producto fuera del catálogo' : 'foto caída'} → ${nuevo}`);
    }
    if (!CHECK && html !== readFileSync(abs, 'utf8')) writeFileSync(abs, html, 'utf8');
  }
  console.log(`${CHECK ? 'Cambiarían' : 'Sustituidas'}: ${cambios} foto(s)`);
} catch (e) {
  console.warn('sync-hero-imgs: se omitió por un error inesperado:', e.message);
}
