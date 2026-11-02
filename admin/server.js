import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3737', 10);
const PROJECT_ROOT = path.join(__dirname, '..');

const SCRIPTS = {
  'generar-admin':      { args: [],            label: 'Generar artifact admin' },
  'generar-bajadas':    { args: [],            label: 'Generar bajadas de precio' },
  'sync-guias-precios': { args: [],            label: 'Sync guías precios (dry-run)' },
  'sync-guias-aplicar': { args: ['--aplicar'], label: 'Sync guías precios (aplicar)', script: 'sync-guias-precios' },
  'sync-html':          { args: [],            label: 'Sync HTML desde merged-admin' },
  'check-site':         { args: [],            label: 'Validar sitio (check-site)' },
};

function spawnCollect(cmd, args, opts = {}) {
  return new Promise(resolve => {
    const chunks = [];
    const proc = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: true, timeout: 120_000, ...opts });
    proc.stdout.on('data', d => chunks.push({ stream: 'out', text: d.toString() }));
    proc.stderr.on('data', d => chunks.push({ stream: 'err', text: d.toString() }));
    proc.on('close', code => resolve({ ok: code === 0, exitCode: code, chunks }));
    proc.on('error', e => resolve({ ok: false, exitCode: 1, chunks: [{ stream: 'err', text: e.message }] }));
  });
}

function runScript(scriptKey) {
  const def = SCRIPTS[scriptKey];
  if (!def) return null;
  const file = `scripts/${def.script || scriptKey}.js`;
  return spawnCollect(process.execPath, [file, ...def.args]);
}
const HOST = '127.0.0.1';
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const DB_PATH = path.join(SCRIPTS_DIR, 'merged-admin.json');
const MAX_BACKUPS = 10;

function backupAndWrite(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(SCRIPTS_DIR, `merged-admin.backup.${ts}.json`);
  fs.copyFileSync(DB_PATH, backupPath);

  const backups = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.startsWith('merged-admin.backup.') && f.endsWith('.json'))
    .sort();
  if (backups.length > MAX_BACKUPS) {
    backups.slice(0, backups.length - MAX_BACKUPS).forEach(f => {
      try { fs.unlinkSync(path.join(SCRIPTS_DIR, f)); } catch (_) {}
    });
  }

  fs.writeFileSync(DB_PATH, data, 'utf8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (pathname === '/api/status' && req.method === 'GET') {
    json(res, 200, { ok: true }); return;
  }

  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch (e) { json(res, 500, { error: e.message }); }
    return;
  }

  if (pathname === '/api/save' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      JSON.parse(body); // validate
      backupAndWrite(body);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 400, { error: e.message }); }
    return;
  }

  if (pathname === '/api/scripts' && req.method === 'GET') {
    const list = Object.entries(SCRIPTS).map(([key, def]) => ({ key, label: def.label }));
    json(res, 200, list); return;
  }

  if (pathname === '/api/run' && req.method === 'POST') {
    let scriptKey;
    try {
      const body = JSON.parse(await readBody(req));
      scriptKey = body.script;
    } catch (_) { json(res, 400, { error: 'JSON inválido' }); return; }

    if (!SCRIPTS[scriptKey]) { json(res, 400, { error: 'Script no permitido: ' + scriptKey }); return; }

    const result = await runScript(scriptKey);
    json(res, 200, result);
    return;
  }

  if (pathname === '/api/git-status' && req.method === 'GET') {
    const r = await spawnCollect('git', ['status', '--porcelain']);
    const raw = r.chunks.filter(c => c.stream === 'out').map(c => c.text).join('');
    const files = raw.split('\n').filter(Boolean).map(line => ({
      xy: line.slice(0, 2),
      file: line.slice(3).trimEnd(),
    }));
    json(res, 200, { ok: r.ok, files }); return;
  }

  if (pathname === '/api/git-pull' && req.method === 'POST') {
    const r = await spawnCollect('git', ['pull', '--rebase']);
    json(res, 200, r); return;
  }

  if (pathname === '/api/workflow' && req.method === 'POST') {
    let categoria = 'all';
    try { categoria = JSON.parse(await readBody(req)).categoria || 'all'; } catch (_) {}
    const r = await spawnCollect('gh', [
      'workflow', 'run', 'update-prices.yml',
      '--repo', 'alancamachorespaldo-hue/compara.mx',
      '--field', `categoria=${categoria}`,
    ]);
    json(res, 200, r); return;
  }

  if (pathname === '/api/push' && req.method === 'POST') {
    let files, message, runCheck = true;
    try { ({ files, message, runCheck = true } = JSON.parse(await readBody(req))); } catch (_) { json(res, 400, { error: 'JSON inválido' }); return; }
    if (!Array.isArray(files) || !files.length) { json(res, 400, { error: 'Sin archivos seleccionados' }); return; }
    if (!message?.trim()) { json(res, 400, { error: 'Falta el mensaje de commit' }); return; }

    const allChunks = [];
    const heading = t => allChunks.push({ stream: 'out', text: `\n── ${t} ──\n` });

    if (runCheck) {
      heading('Validar sitio');
      const r = await runScript('check-site');
      allChunks.push(...r.chunks);
      if (!r.ok) { json(res, 200, { ok: false, step: 'check', chunks: allChunks }); return; }
    }

    heading('git add');
    const addR = await spawnCollect('git', ['add', '--', ...files]);
    allChunks.push(...addR.chunks);
    if (!addR.ok) { json(res, 200, { ok: false, step: 'add', chunks: allChunks }); return; }

    heading('git commit');
    const commitR = await spawnCollect('git', ['commit', '-m', message]);
    allChunks.push(...commitR.chunks);
    if (!commitR.ok) { json(res, 200, { ok: false, step: 'commit', chunks: allChunks }); return; }

    heading('git push');
    const pushR = await spawnCollect('git', ['push']);
    allChunks.push(...pushR.chunks);
    json(res, 200, { ok: pushR.ok, step: 'push', exitCode: pushR.exitCode, chunks: allChunks }); return;
  }

  if (req.method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') {
      serveFile(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8'); return;
    }
    const safePath = path.normalize(path.join(__dirname, pathname)).replace(/\.\./g, '');
    if (safePath.startsWith(__dirname) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'text/plain';
      serveFile(res, safePath, mime); return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Admin local → http://${HOST}:${PORT}`);
  console.log(`DB: ${DB_PATH}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado. Usa PORT=<otro> node admin/server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
