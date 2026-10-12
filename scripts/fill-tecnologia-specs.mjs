/**
 * fill-tecnologia-specs.mjs — rellena nombre, marca, imagen y especs desde ML
 * para los productos de tecnologia_bocinas y tecnologia_audifonos que tengan
 * nombre vacío.
 *
 *   node scripts/fill-tecnologia-specs.mjs [--dry-run]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MERGED = resolve(ROOT, 'scripts/merged-admin.json');
const API    = 'https://api.mercadolibre.com';
const DRY    = process.argv.includes('--dry-run');

// ── Mapeo de atributos ML → campos especs ──────────────────────────────────
// Para cada campo, lista de posibles nombres de atributo ML (lower-case, sin acento)
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

const MAPS = {
  tecnologia_bocinas: [
    { key:'modelo',        match:['modelo','model'] },
    { key:'asistentes',    match:['asistente virtual','asistente de voz','asistente','compatible con','asistentes'] },
    { key:'potencia',      match:['potencia de salida','potencia maxima de salida','potencia','watt','w rms'] },
    { key:'alimentacion',  match:['tipo de alimentacion','alimentacion','fuente de alimentacion','tipo de fuente'] },
    { key:'sistemas',      match:['sistemas operativos compatibles','sistema operativo compatible','sistema operativo','compatible con sistemas'] },
    { key:'camara',        match:['tiene camara','con camara','camara incorporada','camara'] },
    { key:'pantallaTactil',match:['pantalla tactil','con pantalla tactil','touchscreen','pantalla'] },
  ],
  tecnologia_audifonos: [
    { key:'formato',          match:['tipo de audifonos','tipo de auricular','formato','tipo'] },
    { key:'inalambrico',      match:['conexion','tipo de conexion','inalambrico','wireless','conectividad'] },
    { key:'microfono',        match:['tiene microfono','microfono incorporado','microfono','con microfono'] },
    { key:'resistenciaAgua',  match:['resistencia al agua','resistencia a la humedad','resistencia','ipx','ip'] },
    { key:'bateria',          match:['duracion de la bateria','autonomia','vida util de la bateria','bateria'] },
    { key:'manosLibres',      match:['modo manos libres','funcion manos libres','manos libres','hands free'] },
    { key:'cancelacionRuido', match:['cancelacion de ruido','cancelacion activa de ruido','anc','noise cancelling'] },
    { key:'cargaInalambrica', match:['carga inalambrica','carga sin cables','qi','wireless charging'] },
  ],
};

function matchAttr(attrs, matchers) {
  for (const { key, match } of matchers) {
    for (const attr of attrs) {
      const attrNorm = norm(attr.name || attr.id || '');
      if (match.some(m => attrNorm.includes(m))) {
        const val = attr.value_name || attr.value_struct?.number
          ? String(attr.value_name ?? (attr.value_struct?.number + ' ' + (attr.value_struct?.unit ?? '')).trim())
          : null;
        if (val && val !== 'No aplica') return { key, val };
        break;
      }
    }
  }
  return null;
}

// ── API ──────────────────────────────────────────────────────────────────────
let TOKEN;
async function getToken() {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: process.env.ML_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`Token: ${res.status}`);
  return (await res.json()).access_token;
}

async function apiGet(path) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) {
      await new Promise(s => setTimeout(s, 1200 * 2 ** i));
      continue;
    }
    if (r.status !== 404) {
      const body = await r.text();
      console.error(`  ✗ ${path.slice(0,60)} → ${r.status}: ${body.slice(0,80)}`);
    }
    return null;
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
TOKEN = await getToken();
const db = JSON.parse(readFileSync(MERGED, 'utf8'));

for (const cat of ['tecnologia_bocinas', 'tecnologia_audifonos']) {
  const matchers = MAPS[cat];
  const pending  = (db[cat] || []).filter(p => !p.nombre);
  console.log(`\n── ${cat} (${pending.length} pendientes) ──`);

  for (const p of pending) {
    process.stdout.write(`  ${p.mlId} … `);
    const data = await apiGet(`/products/${p.mlId}`);
    if (!data) { console.log('sin datos'); continue; }

    const attrs = data.attributes || [];
    const especs = {};
    for (const m of matchers) {
      for (const attr of attrs) {
        const attrNorm = norm(attr.name || attr.id || '');
        if (m.match.some(kw => attrNorm.includes(kw))) {
          const raw = attr.value_name ?? null;
          if (raw && raw !== 'No aplica' && raw !== 'N/A') {
            especs[m.key] = raw;
          }
          break;
        }
      }
    }

    const nombre = (data.name || '').slice(0, 80);
    const marca  = (data.brand?.name || attrs.find(a => norm(a.name).includes('marca'))?.value_name || '');
    const imagen = data.pictures?.[0]?.url || '';

    console.log(nombre.slice(0, 55) || '(sin nombre)');
    if (Object.keys(especs).length) {
      console.log('    specs:', JSON.stringify(especs));
    }

    if (!DRY) {
      p.nombre = nombre;
      p.marca  = marca;
      p.imagen = imagen;
      p.especs = especs;
      if (data.price) p.precioML = data.price;
    }
  }
}

if (!DRY) {
  writeFileSync(MERGED, JSON.stringify(db, null, 2));
  console.log('\n✓ merged-admin.json actualizado');
} else {
  console.log('\n(dry-run: sin cambios)');
}
