#!/usr/bin/env node
/**
 * probar-api-ml.mjs — dice en 10 segundos qué deja hacer hoy la API de Mercado Libre.
 *
 *   node scripts/probar-api-ml.mjs
 *
 * Nació el 24-nov-2026, cuando ML empezó a responder 403
 * (PA_UNAUTHORIZED_RESULT_FROM_POLICIES · PolicyAgent) en /products/{id}/items, el endpoint del
 * que salen TODOS los precios del sitio. El token refrescaba bien y /products/{id} contestaba
 * 200, así que no era el token: era un permiso de la aplicación. Esto lo deja claro de un
 * vistazo y sirve para comprobar, después de tocar algo en el portal de desarrolladores, si el
 * acceso ya volvió — sin tener que lanzar una corrida de 20 minutos.
 *
 * Solo hace GET y nunca imprime credenciales.
 */
import 'dotenv/config';

const API = 'https://api.mercadolibre.com';
const { ML_CLIENT_ID: ID, ML_CLIENT_SECRET: SECRET, ML_REFRESH_TOKEN: REFRESH,
        ML2_CLIENT_ID: ID2, ML2_CLIENT_SECRET: SECRET2 } = process.env;
if (!ID || !SECRET || !REFRESH) {
  console.error('Faltan ML_CLIENT_ID, ML_CLIENT_SECRET o ML_REFRESH_TOKEN en .env');
  process.exit(1);
}

// Un producto cualquiera que exista; se puede pasar otro como argumento.
const MLID = process.argv.find(a => /^MLM\d+$/i.test(a))?.toUpperCase() || 'MLM65737068';

async function token(grant) {
  const body = grant === 'app'
    ? { grant_type: 'client_credentials', client_id: ID, client_secret: SECRET }
    : { grant_type: 'refresh_token', client_id: ID, client_secret: SECRET, refresh_token: REFRESH };
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, t: j.access_token, scope: j.scope, user: j.user_id, msg: j.message || j.error };
}

async function probar(t, ruta) {
  const r = await fetch(API + ruta, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
  const txt = await r.text();
  let nota = '';
  try {
    const d = JSON.parse(txt);
    if (r.ok) {
      if (d.price != null) nota = `precio ${d.price}`;
      else if (Array.isArray(d.results)) nota = `${d.results.length} resultado(s)`;
      else if (typeof d.status === 'string') nota = `status ${d.status}`;
      else if (d.nickname) nota = `cuenta ${d.nickname}`;
      else nota = 'ok';
    } else nota = d.code || d.error || d.message || '';
  } catch { nota = txt.slice(0, 60); }
  return { status: r.status, nota };
}

// Segunda aplicación, opcional: sirve para saber si el bloqueo es de UNA app o de la cuenta
// entera. Se pone en .env como ML2_CLIENT_ID y ML2_CLIENT_SECRET; su secret nunca se imprime.
async function segundaApp(mlid) {
  if (!ID2 || !SECRET2) return;
  const r = await fetch(API + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: ID2, client_secret: SECRET2 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log('Segunda app (' + ID2 + '): el token falló (' + r.status + ' ' + (j.message || j.error || '') + ')' + String.fromCharCode(10)); return; }
  const a = await probar(j.access_token, '/products/' + mlid + '/items?limit=5');
  console.log('Segunda app (' + ID2 + ') sobre el endpoint de ofertas: ' + a.status + (a.nota ? ' · ' + a.nota : '') +
    (a.status === 200 ? '  <-- ESTA SÍ PUEDE: cambia las credenciales del pipeline a esta app' : '') + String.fromCharCode(10));
}

const RUTAS = [
  ['/users/me', 'quién soy (siempre debería funcionar)'],
  [`/products/${MLID}`, 'ficha de catálogo: existe y si está activa'],
  [`/products/${MLID}/items?limit=5`, 'OFERTAS Y PRECIOS — lo que mueve todo el sitio'],
  ['/products/search?site_id=MLM&q=laptop&limit=1', 'buscar en el catálogo (sin precios)'],
  ['/sites/MLM/search?q=laptop&limit=1', 'buscar publicaciones'],
];

const usuario = await token('user');
console.log(`\nToken de usuario: ${usuario.ok ? 'OK' : 'FALLÓ (' + usuario.status + ' ' + (usuario.msg || '') + ')'}` +
  (usuario.ok ? ` · user_id ${usuario.user}` : ''));
if (usuario.scope) console.log(`Scopes: ${usuario.scope.split(' ').filter(s => !s.startsWith('urn:')).join(' ')} (+${usuario.scope.split(' ').filter(s => s.startsWith('urn:')).length} urn:…)`);
// Que el refresh token esté muerto no impide seguir: el token de aplicación
// (client_credentials) solo necesita id y secret, y sirve para probar los permisos.
if (!usuario.ok) {
  console.log('   El refresh token ya no sirve. Es de un solo uso: cada refresco devuelve uno nuevo');
  console.log('   y el anterior deja de valer, así que basta con haberlo gastado varias veces.');
  console.log('   Hay que volver a autorizar la app para generar otro. Sigo con el token de aplicación.');
}

const app = await token('app');
console.log(`Token de aplicación: ${app.ok ? 'OK' : 'FALLÓ (' + app.status + ')'}\n`);

await segundaApp(MLID);

let precios = false;
for (const [ruta, que] of RUTAS) {
  const u = usuario.ok ? await probar(usuario.t, ruta) : { status: '—', nota: 'sin token de usuario' };
  const a = app.ok ? await probar(app.t, ruta) : { status: '—', nota: '' };
  if (ruta.includes('/items') && (u.status === 200 || a.status === 200)) precios = true;
  const ref = u.status === '—' ? a.status : u.status;
  const marca = ref === 200 ? '✓' : (ref === 403 ? '⛔' : '·');
  console.log(`${marca} ${String(u.status).padEnd(4)} (app ${String(a.status).padEnd(4)}) ${ruta}`);
  console.log(`       ${que}${u.nota ? ' → ' + u.nota : ''}`);
}

console.log(precios
  ? '\n✓ El endpoint de ofertas responde: los precios se pueden volver a actualizar.\n  Corre `node scripts/ml-update.js --categoria=laptops --dry-run` para confirmarlo.\n'
  : '\n⛔ El endpoint de ofertas sigue bloqueado: sin él no hay precios ni revisión de disponibilidad real.\n' +
    '  Si dice PolicyAgent / PA_UNAUTHORIZED_RESULT_FROM_POLICIES es un permiso de la aplicación,\n' +
    '  no del token: se resuelve en el portal de desarrolladores de Mercado Libre.\n');
