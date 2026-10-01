#!/usr/bin/env node
/**
 * ml-oauth.js — Obtiene el refresh_token de ML vía OAuth 2.0
 * Uso: node scripts/ml-oauth.js
 *
 * Flujo manual (sin servidor local):
 * 1. Abre el URL de autorización en el navegador
 * 2. Autoriza la app — ML redirige a https://comparalo.mx/callback?code=XXX
 * 3. Copia el valor del parámetro "code" del URL y pégalo aquí
 */
import 'dotenv/config';
import { createInterface } from 'readline';

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REDIRECT_URI  = 'https://comparalo.mx/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🔐 ML OAuth — Obtener refresh_token\n');
console.log('Paso 1 — Abre este URL en tu navegador:\n');
console.log(`   ${authUrl}\n`);
console.log('Paso 2 — Inicia sesión y autoriza la app.');
console.log('         ML te redirigirá a comparalo.mx/callback?code=XXXX');
console.log('         (la página dará 404, eso es normal)\n');
console.log('Paso 3 — Copia el valor del parámetro "code" del URL y pégalo abajo.\n');

// Intentar abrir el navegador automáticamente
try {
  const { execSync } = await import('child_process');
  execSync(`start "" "${authUrl}"`, { stdio: 'ignore' });
} catch {}

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('   Pega el código aquí: ', async (code) => {
  rl.close();
  code = code.trim();

  if (!code) {
    console.error('❌ No se ingresó ningún código.');
    process.exit(1);
  }

  try {
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('\n❌ Error al obtener token:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('\n✅ Tokens obtenidos:\n');
    console.log(`   access_token (caduca en ${data.expires_in}s): ${data.access_token}`);
    console.log(`\n   🔑 REFRESH_TOKEN (guárdalo como ML_REFRESH_TOKEN):\n`);
    console.log(`   ${data.refresh_token}\n`);
    console.log('📋 Pasos siguientes:');
    console.log('   1. Ve a tu repo → Settings → Secrets → Actions');
    console.log('   2. Crea/actualiza el secret: ML_REFRESH_TOKEN = (valor de arriba)');
    console.log('   3. Agrégalo también a tu .env local: ML_REFRESH_TOKEN=...\n');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
});
