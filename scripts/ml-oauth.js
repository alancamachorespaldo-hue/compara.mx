#!/usr/bin/env node
/**
 * ml-oauth.js — Obtiene el refresh_token de ML vía OAuth 2.0
 * Uso: node scripts/ml-oauth.js
 *
 * 1. Abre el navegador para que autorices la app
 * 2. ML redirige a localhost:8080/callback con el código
 * 3. Intercambia el código por access_token + refresh_token
 * 4. Muestra el refresh_token para guardarlo en GitHub Secrets
 */
import 'dotenv/config';
import { createServer } from 'http';

const CLIENT_ID     = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:8080/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en .env');
  process.exit(1);
}

const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🔐 ML OAuth — Obtener refresh_token\n');
console.log('1. Abre este URL en tu navegador:\n');
console.log(`   ${authUrl}\n`);
console.log('2. Inicia sesión y autoriza la app.');
console.log('3. ML te redirigirá a localhost:8080 — espera aquí...\n');

// Intentar abrir el navegador automáticamente
try {
  const { execSync } = await import('child_process');
  execSync(`start "" "${authUrl}"`, { stdio: 'ignore' });
} catch {}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8080');
  if (url.pathname !== '/callback') {
    res.writeHead(404); res.end(); return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>❌ Error: no se recibió el código</h2>');
    server.close();
    return;
  }

  try {
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        client_id:    CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('❌ Error al obtener token:', JSON.stringify(data));
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h2>❌ Error: ${data.message}</h2>`);
      server.close();
      return;
    }

    console.log('\n✅ Tokens obtenidos:\n');
    console.log(`   access_token  (caduca en ${data.expires_in}s): ${data.access_token}`);
    console.log(`\n   🔑 REFRESH_TOKEN (guárdalo en GitHub Secrets como ML_REFRESH_TOKEN):\n`);
    console.log(`   ${data.refresh_token}\n`);
    console.log('📋 Pasos siguientes:');
    console.log('   1. Ve a tu repo → Settings → Secrets → Actions');
    console.log('   2. Agrega un secret llamado ML_REFRESH_TOKEN con el valor de arriba');
    console.log('   3. También agrégalo a tu .env local como ML_REFRESH_TOKEN=...\n');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>✅ ¡Autorizado! Cierra esta pestaña y revisa la terminal.</h2>`);
  } catch (e) {
    console.error('❌ Error:', e.message);
    res.writeHead(500); res.end('Error');
  }

  server.close();
}).listen(8080, () => {
  console.log('   (Servidor local escuchando en http://localhost:8080/callback)\n');
});
