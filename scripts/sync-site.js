#!/usr/bin/env node
/**
 * sync-site.js — escribe el encabezado, el breadcrumb, "Sigue explorando" y el pie
 * compartidos en todas las páginas públicas, entre marcadores:
 *   <!-- cmx-header:start/end -->  <!-- cmx-bc:start/end -->
 *   <!-- cmx-related:start/end --> <!-- cmx-footer:start/end -->
 * Estilos en /assets/css/cmx-site.css; categorías en /js/categorias.js.
 *
 * Uso: node scripts/sync-site.js [--only=header,footer,related,head] [--dry-run] [--check]
 * Idempotente. Al agregar una página nueva, correrlo y revisar `git diff --stat`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '_interno', 'scripts', '.git', '.github', '.claude', 'assets', 'js', 'fotos']);
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const ONLY = (arg('only') || 'head,header,footer,related').split(',');
const DRY = process.argv.includes('--dry-run');
const CHECK = process.argv.includes('--check');

/* ── Datos ─────────────────────────────────────────────── */
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'js/categorias.js'), 'utf8'), ctx);
const BY_URL = {};
[...ctx.window.CMX_CATS, ...ctx.window.CMX_SUBS].forEach((c) => { BY_URL[c.url] = c; });

const NAV_LINKS = [
  ['Celulares', '/celulares/'], ['Laptops', '/laptops/'], ['Electrodomésticos', '/electrodomesticos/'],
  ['Suplementos', '/suplementos/'], ['Bicicletas', '/bicis/'], ['Videojuegos', '/videojuegos/'],
  ['Tecnología', '/tecnologia/'], ['Guías', '/guias/'],
];

const ARTICLES = new Set([
  '/suplementos/amazon-vs-mercado-libre-suplementos-mexico/', '/suplementos/como-comprar-suplementos-originales/',
  '/suplementos/complejo-b/complejo-b-cual-comprar/', '/suplementos/creatina/creatina-mexico-cual-comprar/',
  '/suplementos/creatina/creatina-monohidratada-guia-completa/', '/suplementos/creatina/creatina-vs-proteina/',
  '/suplementos/magnesio/magnesio-para-dormir-mexico/', '/suplementos/magnesio/tipos-de-magnesio-cual-comprar/',
  '/suplementos/omega3/omega3-cual-comprar/', '/suplementos/proteina/mejor-proteina-vegana/',
  '/suplementos/proteina/proteina-concentrada-vs-aislada-vs-vegana/', '/suplementos/proteina/proteina-para-mujeres-mexico/',
  '/suplementos/proteina/proteina-por-precio-mexico-2026/', '/suplementos/proteina/proteina-whey-cual-comprar/',
  '/suplementos/suplementos-mas-comprados/', '/suplementos/suplementos-por-edad/',
  '/bicis/bicicleta-electrica-vale-la-pena/', '/bicis/como-elegir-bicicleta-electrica/',
  '/laptops/como-elegir-laptop/', '/laptops/laptop-gamer-menos-20000-pesos/', '/laptops/laptop-para-universidad/',
  '/celulares/iphone/iphone-18-pro-precio/', '/celulares/iphone/iphone-18-pro-vs-iphone-17-pro/',
  '/celulares/iphone/iphone-18-pro-vs-samsung-s26-ultra/', '/celulares/iphone/iphone-duo-plegable-precio/',
]);

const HUB = {
  celulares: '/celulares/', iphone: '/celulares/iphone/', proteina: '/suplementos/proteina/', creatina: '/suplementos/creatina/',
  magnesio: '/suplementos/magnesio/', omega3: '/suplementos/omega3/', complejob: '/suplementos/complejo-b/', suplementos: '/suplementos/',
  bicis: '/bicis/', laptops: '/laptops/', cafeteras: '/electrodomesticos/cafeteras/', freidoras: '/electrodomesticos/freidoras/',
  microondas: '/electrodomesticos/microondas/', electro: '/electrodomesticos/', audifonos: '/tecnologia/audifonos/',
  bocinas: '/tecnologia/bocinas/', smartwatches: '/tecnologia/smartwatches/', tecnologia: '/tecnologia/', videojuegos: '/videojuegos/',
};
const RELATED_CATS = {
  celulares: ['/celulares/android/', '/celulares/iphone/', '/laptops/'],
  iphone: ['/celulares/android/', '/tecnologia/smartwatches/', '/tecnologia/audifonos/'],
  proteina: ['/suplementos/creatina/', '/suplementos/magnesio/', '/suplementos/omega3/'],
  creatina: ['/suplementos/proteina/', '/suplementos/magnesio/', '/suplementos/omega3/'],
  magnesio: ['/suplementos/omega3/', '/suplementos/complejo-b/', '/suplementos/proteina/'],
  omega3: ['/suplementos/magnesio/', '/suplementos/complejo-b/', '/suplementos/creatina/'],
  complejob: ['/suplementos/magnesio/', '/suplementos/omega3/', '/suplementos/proteina/'],
  suplementos: ['/suplementos/proteina/', '/suplementos/creatina/', '/suplementos/magnesio/'],
  bicis: ['/tecnologia/smartwatches/', '/tecnologia/audifonos/', '/suplementos/'],
  laptops: ['/celulares/', '/tecnologia/audifonos/', '/videojuegos/'],
  cafeteras: ['/electrodomesticos/freidoras/', '/electrodomesticos/microondas/', '/electrodomesticos/'],
  freidoras: ['/electrodomesticos/microondas/', '/electrodomesticos/cafeteras/', '/electrodomesticos/'],
  microondas: ['/electrodomesticos/freidoras/', '/electrodomesticos/cafeteras/', '/electrodomesticos/'],
  electro: ['/electrodomesticos/freidoras/', '/electrodomesticos/microondas/', '/electrodomesticos/cafeteras/'],
  audifonos: ['/tecnologia/bocinas/', '/tecnologia/smartwatches/', '/celulares/'],
  bocinas: ['/tecnologia/audifonos/', '/tecnologia/smartwatches/', '/celulares/'],
  smartwatches: ['/tecnologia/audifonos/', '/tecnologia/bocinas/', '/celulares/iphone/'],
  tecnologia: ['/celulares/', '/laptops/', '/videojuegos/'],
  videojuegos: ['/tecnologia/audifonos/', '/laptops/', '/tecnologia/bocinas/'],
};

function topicOf(p) {
  if (p.startsWith('/celulares/iphone/')) return 'iphone';
  if (p === '/celulares/comparar/') return null;
  if (p.startsWith('/celulares/') || p.startsWith('/guias/celulares/')) return 'celulares';
  if (p.startsWith('/suplementos/proteina') || p.includes('proteina')) return 'proteina';
  if (p.startsWith('/suplementos/creatina/')) return 'creatina';
  if (p.startsWith('/suplementos/magnesio/')) return 'magnesio';
  if (p.startsWith('/suplementos/omega3/')) return 'omega3';
  if (p.startsWith('/suplementos/complejo-b/')) return 'complejob';
  if (p.startsWith('/suplementos/')) return 'suplementos';
  if (p.startsWith('/bicis/') || p.startsWith('/bicicletas/')) return 'bicis';
  if (p.startsWith('/laptops/')) return 'laptops';
  if (p.startsWith('/electrodomesticos/cafeteras/') || p.startsWith('/guias/cafeteras/') || p.startsWith('/guias/electrodomesticos/')) return 'cafeteras';
  if (p.startsWith('/electrodomesticos/freidoras/')) return 'freidoras';
  if (p.startsWith('/electrodomesticos/microondas/')) return 'microondas';
  if (p === '/electrodomesticos/') return 'electro';
  if (p.startsWith('/guias/tecnologia/')) {
    if (/audifonos/.test(p)) return 'audifonos';
    if (/bocina/.test(p)) return 'bocinas';
    if (/smartwatch/.test(p)) return 'smartwatches';
    return 'tecnologia';
  }
  if (p.startsWith('/tecnologia/audifonos/')) return 'audifonos';
  if (p.startsWith('/tecnologia/bocinas/')) return 'bocinas';
  if (p.startsWith('/tecnologia/smartwatches/')) return 'smartwatches';
  if (p.startsWith('/tecnologia/')) return 'tecnologia';
  if (p.startsWith('/videojuegos/') || p.startsWith('/guias/videojuegos/')) return 'videojuegos';
  return null;
}
const isGuide = (p) => (p.startsWith('/guias/') && p !== '/guias/' && topicOf(p)) || ARTICLES.has(p);

function activeSection(p) {
  if (p === '/guias/') return ['/guias/', 'page'];
  const t = topicOf(p);
  const map = {
    celulares: '/celulares/', iphone: '/celulares/', laptops: '/laptops/', cafeteras: '/electrodomesticos/', freidoras: '/electrodomesticos/',
    microondas: '/electrodomesticos/', electro: '/electrodomesticos/', proteina: '/suplementos/', creatina: '/suplementos/',
    magnesio: '/suplementos/', omega3: '/suplementos/', complejob: '/suplementos/', suplementos: '/suplementos/', bicis: '/bicis/',
    audifonos: '/tecnologia/', bocinas: '/tecnologia/', smartwatches: '/tecnologia/', tecnologia: '/tecnologia/', videojuegos: '/videojuegos/',
  };
  const url = map[t];
  if (!url) return [null, null];
  return [url, p === url ? 'page' : 'true'];
}

/* ── Utilidades ────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const mask = (s) => s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, ' '));
const stripEmoji = (s) => s.replace(/^[\s\p{Extended_Pictographic}️‍]+/u, '').trim();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, out); }
    else if (name === 'index.html' || (dir === ROOT && name === '404.html')) out.push(p);
  }
  return out;
}
const pathOf = (abs) => {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  return rel === '404.html' ? '/404.html' : '/' + rel.replace(/index\.html$/, '');
};
const isRedirect = (h) => h.length < 3000 && /http-equiv="refresh"|location\.replace\(/i.test(h);

const PAGES = walk(ROOT).map((abs) => ({ abs, path: pathOf(abs) }));
const h1Of = (html) => { const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i); return m ? stripEmoji(decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())) : ''; };
const GUIDES = [];
for (const pg of PAGES) {
  if (!isGuide(pg.path)) continue;
  const html = readFileSync(pg.abs, 'utf8');
  if (isRedirect(html)) continue;
  GUIDES.push({ path: pg.path, topic: topicOf(pg.path), title: h1Of(html) });
}
GUIDES.sort((a, b) => a.path.localeCompare(b.path));

/* ── Generadores ───────────────────────────────────────── */
const SHARE_BTN = '<button class="btn-share" onclick="shareCurrentPage()" title="Compartir esta p&#225;gina" aria-label="Compartir"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span class="share-txt">Compartir</span></button>';

function headerHtml(p, extra) {
  const [act, kind] = activeSection(p);
  const links = NAV_LINKS.map(([n, u]) => `<a href="${u}"${u === act ? ` aria-current="${kind}"` : ''}>${n}</a>`).join('\n      ');
  return `<!-- cmx-header:start -->
<div class="cmx-hd" id="cmx-hd">
  <div class="cmx-hd-in">
    <a class="cmx-hd-logo" href="/" aria-label="comparalo.mx, inicio"><img src="/logopng.png" alt="" width="28" height="28"><span>comparalo<i>.mx</i></span></a>
    <div class="cmx-hd-search" id="cmx-hd-search"></div>
    <div class="cmx-hd-links" role="navigation" aria-label="Navegación principal">
      ${links}
    </div>
    <div class="cmx-hd-act">
      <button class="cmx-hd-searchbtn" id="cmx-hd-searchbtn" type="button" aria-label="Buscar categoría"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
      <a class="cmx-hd-guias" href="/guias/">Guías</a>
      <!-- cmx-hd-extra:start -->${extra || ''}<!-- cmx-hd-extra:end -->
      ${SHARE_BTN}
    </div>
  </div>
</div>
<!-- cmx-header:end -->`;
}

function breadcrumbItems(html, p, catText) {
  if (catText) return [['Inicio', '/'], [catText, null, 'breadcrumb-cat']];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1]); } catch { continue; }
    const nodes = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j];
    for (const n of nodes) {
      if (n && n['@type'] === 'BreadcrumbList' && Array.isArray(n.itemListElement)) {
        const els = [...n.itemListElement].sort((a, b) => (a.position || 0) - (b.position || 0));
        return els.map((e, i) => {
          const it = e.item; const url = typeof it === 'string' ? it : it && (it['@id'] || it.url);
          const name = e.name || (it && it.name) || '';
          const rel = url ? url.replace(/^https?:\/\/(www\.)?comparalo\.mx/, '') || '/' : null;
          return [name, i === els.length - 1 ? null : rel];
        });
      }
    }
  }
  return [['Inicio', '/'], [h1Of(html) || 'Esta página', null]];
}
function bcHtml(items) {
  const lis = items.map(([n, u, id]) => {
    if (u) return `<li><a href="${u}">${esc(n)}</a></li>`;
    return id ? `<li aria-current="page"><span id="${id}">${esc(n)}</span></li>` : `<li aria-current="page">${esc(n)}</li>`;
  });
  return `<!-- cmx-bc:start -->
<div class="cmx-bc"><ol aria-label="Ruta de navegación">${lis.join('')}</ol></div>
<!-- cmx-bc:end -->`;
}

function relatedHtml(p) {
  const t = topicOf(p);
  if (!t) return '';
  const guide = isGuide(p);
  const card = (href, k, title, desc, ic, cls = '') => `<a class="cmx-rel-card${cls}" href="${href}">${ic ? `<span class="cmx-rel-ic" aria-hidden="true">${ic}</span>` : ''}<span class="cmx-rel-tx"><span class="cmx-rel-k">${k}</span><span class="cmx-rel-t">${esc(title)}</span>${desc ? `<span class="cmx-rel-d">${esc(desc)}</span>` : ''}</span></a>`;
  let out = '';
  const hub = HUB[t];
  if (guide && hub && hub !== p) {
    const c = BY_URL[hub];
    out += `<h3>Compara los productos</h3><div class="cmx-rel-grid">${card(hub, 'Comparativa', c ? c.name : 'Ver productos', c ? c.sub : 'Precios en Amazon MX y Mercado Libre', c ? c.icon : '', ' cmx-rel-hub')}</div>`;
  }
  const guides = GUIDES.filter((g) => g.topic === t && g.path !== p).slice(0, 4);
  out += `<h3>${guides.length ? 'Guías relacionadas' : 'Guías de compra'}</h3><div class="cmx-rel-grid">${guides.map((g) => card(g.path, 'Guía', g.title)).join('')}${card('/guias/', 'Guías', 'Ver todas las guías de compra', 'Cómo elegir, comparativas y ofertas')}</div>`;
  const cats = (RELATED_CATS[t] || []).filter((u) => u !== p).map((u) => BY_URL[u]).filter(Boolean);
  if (cats.length) out += `<h3>Sigue con otras categorías</h3><div class="cmx-rel-grid">${cats.map((c) => card(c.url, 'Categoría', c.name, c.sub, c.icon)).join('')}</div>`;
  const lead = guide ? 'Pasa de la guía a la comparativa o sigue con otros temas.' : 'Guías de compra y categorías que combinan con esta.';
  return `<!-- cmx-related:start -->
<section class="cmx-rel" aria-labelledby="cmx-rel-h"><div class="cmx-rel-in"><h2 id="cmx-rel-h">Sigue explorando</h2><p class="cmx-rel-lead">${lead}</p>${out}</div></section>
<!-- cmx-related:end -->`;
}

const FOOT_CATS = [['Celulares', '/celulares/'], ['Android', '/celulares/android/'], ['iPhone', '/celulares/iphone/'], ['Laptops', '/laptops/'], ['Electrodomésticos', '/electrodomesticos/'], ['Suplementos', '/suplementos/'], ['Bicicletas', '/bicis/'], ['Videojuegos', '/videojuegos/'], ['Tecnología', '/tecnologia/']];
function footerHtml() {
  const li = (a) => a.map(([n, u]) => `<li><a href="${u}">${n}</a></li>`).join('');
  return `<!-- cmx-footer:start -->
<div class="cmx-ft" role="contentinfo" id="cmx-ft"><div class="cmx-ft-in">
<div class="cmx-ft-disc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div><h2>Aviso de afiliados</h2><p>comparalo.mx participa en los programas de afiliados de Amazon México y Mercado Libre. Si compras a través de nuestros enlaces recibimos una comisión, sin costo adicional para ti. Esa comisión no influye en el orden ni en las recomendaciones. <a href="/aviso-afiliados/">Más información</a></p></div></div>
<div class="cmx-ft-grid">
<div><span class="cmx-ft-brand"><img src="/logopng.png" alt="" width="28" height="28" loading="lazy">comparalo<i>.mx</i></span><p>Comparamos precios de Amazon MX y Mercado Libre para que decidas con datos, no a ciegas.</p></div>
<div><h3>Categorías</h3><ul>${li(FOOT_CATS)}</ul></div>
<div><h3>Recursos</h3><ul>${li([['Guías y artículos', '/guias/'], ['Cómo comparamos', '/#metodo'], ['Quiénes somos', '/sobre-nosotros/'], ['Contacto', '/contacto/'], ['Mapa del sitio', '/sitemap.xml']])}</ul></div>
<div><h3>Legal</h3><ul>${li([['Aviso de afiliados', '/aviso-afiliados/'], ['Privacidad', '/privacidad/'], ['Términos', '/terminos/']])}</ul></div>
</div>
<p class="cmx-ft-bottom">Los precios y la disponibilidad pueden cambiar en cualquier momento. Confirma el precio final en la tienda antes de pagar. © 2026 comparalo.mx</p>
</div></div>
<!-- cmx-footer:end -->`;
}

/* ── Aplicación por página ─────────────────────────────── */
const block = (s, name) => {
  const a = s.indexOf(`<!-- ${name}:start -->`), z = s.indexOf(`<!-- ${name}:end -->`);
  return a > -1 && z > a ? [a, z + `<!-- ${name}:end -->`.length] : null;
};
// Categorías con bajadas de precio (assets/js/price-drops.js; datos en assets/data/bajadas.json)
const DROP_PATHS = new Set(['/suplementos/proteina/', '/suplementos/creatina/', '/suplementos/magnesio/', '/suplementos/omega3/', '/suplementos/complejo-b/', '/suplementos/vitamina-d/',
  '/laptops/', '/bicis/', '/electrodomesticos/freidoras/', '/electrodomesticos/microondas/', '/electrodomesticos/cafeteras/', '/tecnologia/audifonos/', '/tecnologia/bocinas/',
  '/videojuegos/consolas/', '/videojuegos/controles/', '/videojuegos/juegos/', '/celulares/android/', '/celulares/iphone/']);
const FONT ='<link href="https://api.fontshare.com/v2/css?f[]=satoshi@800,700,600,500,400,300&display=swap" rel="stylesheet">';

function locateNav(s) {
  const m = mask(s); const b = Math.max(0, m.indexOf('<body'));
  const i = m.indexOf('<nav', b); if (i < 0) return null;
  let j = m.indexOf('</nav>', i); if (j < 0) return null; j += 6;
  const pre = m.slice(0, i).match(/<header\b[^>]*>\s*$/), post = m.slice(j).match(/^\s*<\/header>/);
  if (pre && post) return [i - pre[0].length, j + post[0].length, s.slice(i, j)];
  return [i, j, s.slice(i, j)];
}
function locateFooter(s) {
  const m = mask(s); let last = -1, k = -1;
  while ((k = m.indexOf('<footer', k + 1)) > -1) last = k;
  if (last < 0) return null;
  const z = m.indexOf('</footer>', last); if (z < 0) return null;
  return [last, z + 9];
}

function processPage(pg) {
  const orig = readFileSync(pg.abs, 'utf8');
  if (isRedirect(orig)) return null;
  const eol = /\r\n/.test(orig) ? '\r\n' : '\n';
  let s = orig; const notes = [];
  const put = (str) => str.replace(/\n/g, eol);

  if (ONLY.includes('head')) {
    if (!s.includes('cmx-site.css')) s = s.replace(/<\/head>/i, put('<link rel="stylesheet" href="/assets/css/cmx-site.css">\n</head>'));
    if (!/fontshare/.test(s)) s = s.replace(/<\/head>/i, put(FONT + '\n</head>'));
    if (s.includes('cmxPaginate(') && !/paginate\.js/.test(s)) s = s.replace(/<\/head>/i, put('<script src="/assets/js/paginate.js"></script>\n</head>'));
    if (s.includes('data-cmx-filters="panel"') && !/filters-panel\.js/.test(s)) {
      const t = '<script src="/js/onboarding.js" defer></script>';
      s = s.includes(t) ? s.replace(t, put('<script src="/assets/js/filters-panel.js" defer></script>\n') + t) : s.replace(/<\/body>/i, put('<script src="/assets/js/filters-panel.js" defer></script>\n</body>'));
    }
    if (s.includes('id="grid"') && /cmx-fp|prt-filters|crt-filters|aud-filters/.test(s) && !/filters-scroll\.js/.test(s)) {
      const t = '<script src="/js/onboarding.js" defer></script>';
      s = s.includes(t) ? s.replace(t, put('<script src="/assets/js/filters-scroll.js" defer></script>\n') + t) : s.replace(/<\/body>/i, put('<script src="/assets/js/filters-scroll.js" defer></script>\n</body>'));
    }
    if (DROP_PATHS.has(pg.path) && !s.includes('src="/assets/js/price-drops.js"')) {
      const t = '<script src="/js/onboarding.js" defer></script>';
      s = s.includes(t) ? s.replace(t, put('<script src="/assets/js/price-drops.js" defer></script>\n') + t) : s.replace(/<\/body>/i, put('<script src="/assets/js/price-drops.js" defer></script>\n</body>'));
    }
    if (!/js\/site-nav\.js/.test(s)) s = s.replace(/<\/body>/i, put('<script src="/js/site-nav.js" defer></script>\n</body>'));
    if ((s.includes('card-btn-col-price') || s.includes('data-cmx-layout="v2"')) && !/cards-enhance\.js/.test(s)) {
      const t = '<script src="/js/onboarding.js" defer></script>';
      s = s.includes(t) ? s.replace(t, put('<script src="/assets/js/cards-enhance.js" defer></script>\n') + t) : s.replace(/<\/body>/i, put('<script src="/assets/js/cards-enhance.js" defer></script>\n</body>'));
    }
    if (!/assets\/js\/share\.js/.test(s)) {
      const t = '<script src="/js/onboarding.js" defer></script>';
      s = s.includes(t) ? s.replace(t, put('<script src="/assets/js/share.js" defer></script>\n') + t) : s.replace(/<\/body>/i, put('<script src="/assets/js/share.js" defer></script>\n</body>'));
    }
  }

  if (ONLY.includes('header')) {
    const hb = block(s, 'cmx-header'), bb = block(s, 'cmx-bc');
    let extra = '', hasBc = false, catText = null, a, z;
    if (hb) {
      const seg = s.slice(hb[0], hb[1]);
      const e = seg.match(/<!-- cmx-hd-extra:start -->([\s\S]*?)<!-- cmx-hd-extra:end -->/); extra = e ? e[1] : '';
      hasBc = !!bb;
      if (bb) { const c = s.slice(bb[0], bb[1]).match(/<span id="breadcrumb-cat">([^<]*)<\/span>/); if (c) catText = decode(c[1]); }
      a = hb[0]; z = bb ? Math.max(hb[1], bb[1]) : hb[1];
    } else {
      const loc = locateNav(s);
      if (!loc) { notes.push('sin <nav>'); }
      else {
        const [i, j, navHtml] = loc;
        if (!/href="(\/|\/index\.html|https?:\/\/(www\.)?comparalo\.mx\/?)"/.test(navHtml)) { notes.push('nav sin enlace al inicio, omitido'); }
        else {
          const fav = navHtml.match(/<button[^>]*id="nav-fav-btn"[\s\S]*?<\/button>/); extra = fav ? fav[0] : '';
          hasBc = /nav-breadcrumb|nav-bc\b|breadcrumb-cat|class="[^"]*breadcrumb/.test(navHtml);
          const c = navHtml.match(/<span id="breadcrumb-cat">([^<]*)<\/span>/); if (c) catText = decode(c[1]);
          a = i; z = j;
        }
      }
    }
    if (a !== undefined) {
      const items = hasBc ? breadcrumbItems(s, pg.path, catText) : null;
      const html = headerHtml(pg.path, extra) + (items ? '\n' + bcHtml(items) : '');
      s = s.slice(0, a) + put(html) + s.slice(z);
    }
  }

  if (ONLY.includes('footer') || ONLY.includes('related')) {
    let fb = block(s, 'cmx-footer');
    if (ONLY.includes('footer')) {
      if (fb) s = s.slice(0, fb[0]) + put(footerHtml()) + s.slice(fb[1]);
      else {
        const loc = locateFooter(s);
        if (loc) s = s.slice(0, loc[0]) + put(footerHtml()) + s.slice(loc[1]);
        else {
          const tag = '<script src="/js/onboarding.js" defer></script>';
          if (s.includes(tag)) s = s.replace(tag, put(footerHtml() + '\n') + tag);
          else s = s.replace(/<\/body>/i, put(footerHtml() + '\n</body>'));
          notes.push('pie agregado (no tenía)');
        }
      }
      fb = block(s, 'cmx-footer');
    }
    if (ONLY.includes('related') && fb) {
      const rb = block(s, 'cmx-related'); const rel = relatedHtml(pg.path);
      if (rb) s = s.slice(0, rb[0]) + (rel ? put(rel) : '') + s.slice(rb[1]);
      else if (rel) { const f = block(s, 'cmx-footer'); s = s.slice(0, f[0]) + put(rel + '\n') + s.slice(f[0]); }
    }
  }

  return { changed: s !== orig, s, notes };
}

let changed = 0; const issues = [];
for (const pg of PAGES) {
  const r = processPage(pg);
  if (!r) continue;
  if (r.notes.length) issues.push(`${pg.path}: ${r.notes.join('; ')}`);
  if (r.changed) { changed++; if (!DRY && !CHECK) writeFileSync(pg.abs, r.s, 'utf8'); }
}
issues.forEach((i) => console.log('  ·', i));
console.log(`${CHECK || DRY ? 'Cambiarían' : 'Actualizadas'}: ${changed} de ${PAGES.length} páginas (${ONLY.join(', ')})`);
if (CHECK && changed) process.exit(1);
