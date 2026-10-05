#!/usr/bin/env node
/**
 * generar-admin.js — Genera el HTML del artifact "Admin Productos"
 * con los datos embebidos desde merged-admin.json
 * Uso: node scripts/generar-admin.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Sincronizar precios de ml-report.json → merged-admin.json antes de generar
const reportPath = resolve(ROOT, 'scripts/ml-report.json');
const adminPath  = resolve(ROOT, 'scripts/merged-admin.json');
const adminData  = JSON.parse(readFileSync(adminPath, 'utf8'));
try {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  let synced = 0;
  for (const row of report.productos || []) {
    const cat = adminData[row.categoria];
    if (!cat) continue;
    const prod = cat.find(p => p.nombre === row.nombre);
    if (prod) {
      if (row.precioML != null) prod.precioML = row.precioML;
      prod.estadoML = row.estado;
      synced++;
    }
  }
  if (synced > 0) {
    writeFileSync(adminPath, JSON.stringify(adminData, null, 2), 'utf8');
    console.log(`✓ ${synced} precios ML sincronizados desde ml-report.json`);
  }
} catch (e) { /* ml-report.json puede no existir */ }

const jsonRaw = JSON.stringify(JSON.parse(readFileSync(adminPath, 'utf8')));
const data = Buffer.from(jsonRaw, 'utf8').toString('base64');
const SPLIT_MARK = "atob('";

const html = `<title>Gestión Productos</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
:root{
  --bg:#f8f9fa;--surface:#fff;--border:#e5e7eb;--fg:#111827;--fg2:#6b7280;
  --accent:#006847;--accent-light:#e6f4ef;
  --red:#dc2626;--red-light:#fef2f2;
  --yellow:#d97706;--yellow-light:#fffbeb;
  --green:#16a34a;--green-light:#f0fdf4;
  --blue:#2563eb;--blue-light:#eff6ff;
  --gray:#6b7280;--gray-light:#f9fafb;
  font-family:'Inter',system-ui,sans-serif;
}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){
  --bg:#0f172a;--surface:#1e293b;--border:#334155;--fg:#f1f5f9;--fg2:#94a3b8;
  --red:#f87171;--red-light:#200a0a;--yellow:#fbbf24;--yellow-light:#1a1000;
  --green:#4ade80;--green-light:#052e16;--blue:#60a5fa;--blue-light:#0f172a;
  --gray:#94a3b8;--gray-light:#1e293b;color-scheme:dark;
}}
:root[data-theme=dark]{
  --bg:#0f172a;--surface:#1e293b;--border:#334155;--fg:#f1f5f9;--fg2:#94a3b8;
  --red:#f87171;--red-light:#200a0a;--yellow:#fbbf24;--yellow-light:#1a1000;
  --green:#4ade80;--green-light:#052e16;--blue:#60a5fa;--blue-light:#0f172a;
  --gray:#94a3b8;--gray-light:#1e293b;color-scheme:dark;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-size:14px;line-height:1.5;padding-bottom:40px}
.top-bar{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:env(safe-area-inset-top,0px);z-index:100}
.top-bar h1{font-size:15px;font-weight:700;color:var(--accent)}
.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 20px 6px}
.cats{display:flex;gap:4px;flex-wrap:wrap}
.cat-btn{padding:4px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--fg2);cursor:pointer;font-size:12px;font-weight:500}
.cat-btn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.filters{display:flex;gap:5px;flex-wrap:wrap;margin-left:auto}
.filter-btn{padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--fg2);cursor:pointer;font-size:12px}
.filter-btn.on{background:var(--red-light);border-color:var(--red);color:var(--red)}
.search-wrap{padding:0 20px 8px;display:flex;gap:8px;align-items:center}
.search-wrap input{flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--fg);font-size:13px;outline:none}
.search-wrap input:focus{border-color:var(--accent)}
.btn-export{padding:7px 16px;border-radius:7px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}
#btn-save{transition:opacity .2s}#btn-save:disabled{opacity:.5;cursor:default}
.table-wrap{overflow-x:auto;padding:0 20px}
table{width:100%;border-collapse:collapse;min-width:680px}
thead th{text-align:left;padding:7px 10px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);border-bottom:2px solid var(--border);background:var(--surface)}
th.chk-col,td.chk-col{width:32px;padding:8px 6px 8px 10px}
tbody tr.selected{background:var(--accent-light)}
.sel-bar{display:none;align-items:center;gap:10px;padding:8px 20px;background:var(--accent-light);border-bottom:1px solid var(--border);font-size:13px;color:var(--accent);font-weight:600}
.sel-bar.show{display:flex}
.cat-sel-bar{display:none;align-items:center;gap:10px;padding:6px 20px;background:var(--accent-light);border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:13px;color:var(--accent);font-weight:600}
.cat-sel-bar.show{display:flex}
.btn-export-sel{padding:7px 16px;border-radius:7px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap}
.btn-clear-sel{padding:5px 12px;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:12px}
tbody tr{border-bottom:1px solid var(--border)}
tbody tr:hover{background:var(--gray-light)}
tbody tr.pausado td.nombre-col{opacity:.4;text-decoration:line-through}
tbody tr.pausado{background:var(--gray-light)}
td{padding:8px 10px;vertical-align:middle;font-size:13px}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:11px;font-size:11px;font-weight:600;white-space:nowrap}
.b-actualizado{background:var(--green-light);color:var(--green)}
.b-sin_cambio{background:var(--gray-light);color:var(--gray)}
.b-sin_precio{background:var(--red-light);color:var(--red)}
.b-no_encontrado{background:var(--red-light);color:var(--red)}
.b-precio_sospechoso{background:var(--blue-light);color:var(--blue)}
.b-null{background:var(--gray-light);color:var(--fg2)}
.b-nuevo{background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-weight:700}
.link-chip{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;text-decoration:none;margin-right:3px}
.lc-amz{background:#fff3ea;color:#b45309;border:1px solid #fcd34d}
.lc-ml{background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd}
.lc-none{background:var(--gray-light);color:var(--fg2);border:1px solid var(--border)}
.lc-amz-pending{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-weight:700}
.actions{display:flex;gap:4px;align-items:center}
.btn-sm{padding:3px 9px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--fg2);cursor:pointer;font-size:11px;font-weight:500;white-space:nowrap}
.btn-pause{color:var(--yellow)}.btn-play{color:var(--green)}.btn-edit{color:var(--blue)}
.modal-bd{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}
.modal{background:var(--surface);border-radius:12px;padding:24px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.3);margin:auto}
.modal h2{font-size:15px;font-weight:700;margin-bottom:4px}
.modal .sub{font-size:12px;color:var(--fg2);margin-bottom:14px}
.modal label{display:block;font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:3px;margin-top:10px;text-transform:uppercase;letter-spacing:.05em}
.modal input{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--fg);font-size:13px;outline:none;font-family:monospace}
.modal input:focus{border-color:var(--accent)}
.modal-section{margin-top:14px;padding-top:10px;border-top:1px solid var(--border)}
.modal-section-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.specs-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;align-items:center}
.del-confirm{background:var(--red-light);border:1px solid var(--red);border-radius:7px;padding:8px 12px;font-size:12px;color:var(--red);display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.btn-cancel{padding:7px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--fg2);cursor:pointer;font-size:13px}
.btn-save{padding:7px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;font-weight:600}
.btn-del-sm{padding:3px 10px;border:1px solid var(--red);border-radius:5px;background:transparent;color:var(--red);cursor:pointer;font-size:11px;font-weight:600}
.btn-yes{padding:3px 10px;border:none;border-radius:5px;background:var(--red);color:#fff;cursor:pointer;font-size:12px;font-weight:600}
.btn-no{padding:3px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--fg2);cursor:pointer;font-size:12px}
.toast{position:fixed;bottom:20px;right:20px;background:var(--fg);color:var(--bg);padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;z-index:300;opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:none}
.toast.show{opacity:1;transform:translateY(0)}
.empty{text-align:center;padding:40px 20px;color:var(--fg2)}
.info-row{background:var(--accent-light);border-bottom:1px solid var(--border);padding:8px 20px;font-size:12px;color:var(--accent);display:flex;gap:6px;align-items:center}
.tiles{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px 0}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;min-width:110px;flex:1;cursor:pointer;transition:border-color .12s,background .12s;user-select:none}
.tile:hover{border-color:var(--accent)}
.tile.on{border-color:var(--accent);background:var(--accent-light)}
.tile-lbl{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--fg2);margin-bottom:2px}
.tile-num{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}
.tile-num.ok{color:var(--green)}.tile-num.warn{color:var(--yellow)}.tile-num.err{color:var(--red)}.tile-num.blue{color:var(--blue)}.tile-num.muted{color:var(--fg2)}
.add-modal input,.add-modal select{width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--fg);font-size:13px;outline:none;margin-bottom:2px}
.add-modal input:focus,.add-modal select:focus{border-color:var(--accent)}
.plat-filters{display:flex;gap:6px;align-items:center;padding:4px 20px 10px}
.plat-label{font-size:11px;color:var(--fg2);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-right:2px}
.plat-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;font-size:12px;font-weight:600;transition:all .15s;color:var(--fg2)}
.plat-btn:hover{filter:brightness(.95)}
.plat-btn.on-ml{background:#fff8e7;border-color:#ffe030;color:#333}
.plat-btn.on-amz{background:#fff3ea;border-color:#ff9900;color:#c45000}
.plat-btn.on-ambas{background:linear-gradient(90deg,#fff8e7 50%,#fff3ea 50%);border-color:#ffb700;color:#333}
/* Tabs */
.tab-bar{display:flex;gap:0;border-bottom:2px solid var(--border);background:var(--surface);padding:0 20px;position:sticky;top:env(safe-area-inset-top,0px);z-index:99;overflow-x:auto}
.tab-btn{padding:10px 16px;font-size:13px;font-weight:600;color:var(--fg2);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap}
.tab-btn:hover{color:var(--fg)}
.tab-btn.on{color:var(--accent);border-bottom-color:var(--accent)}
.tab-section{display:none}
.tab-section.on{display:block}
/* Sub-tabs (Suplementos) */
.tab-toolbar{display:flex;align-items:center;gap:10px;padding:10px 20px 8px;border-bottom:1px solid var(--border)}
.btn-gh-action{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:opacity .15s}
.btn-gh-action:hover{opacity:.85}
.publish-pending{animation:pub-pulse 1.4s infinite;box-shadow:0 0 0 0 rgba(255,140,0,.6)}
@keyframes pub-pulse{0%{box-shadow:0 0 0 0 rgba(255,140,0,.6)}70%{box-shadow:0 0 0 8px rgba(255,140,0,0)}100%{box-shadow:0 0 0 0 rgba(255,140,0,0)}}
.subtab-bar{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--bg);padding:0 20px;overflow-x:auto}
.subtab-btn{padding:8px 14px;font-size:12px;font-weight:600;color:var(--fg2);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.subtab-btn:hover{color:var(--fg)}
.subtab-btn.on{color:var(--accent);border-bottom-color:var(--accent)}
/* Catálogo table */
.cat-search{padding:10px 20px 6px;display:flex;gap:8px;align-items:center}
.cat-search input{flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--fg);font-size:13px;outline:none}
.cat-search input:focus{border-color:var(--accent)}
.spec-chip{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;background:var(--blue-light);color:var(--blue);font-weight:500;white-space:nowrap}
.spec-null{color:var(--fg2);font-size:11px}
.precio-col{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.precio-ml{color:var(--blue)}
.precio-amz{color:#b45309}
.cat-table-wrap{overflow:auto;max-height:calc(100vh - 200px);padding:0 20px}
.cat-table-wrap thead th{position:sticky;top:0;z-index:5;background:var(--surface);box-shadow:0 1px 0 var(--border)}
.col-filter-btn{background:none;border:none;cursor:pointer;color:var(--fg2);font-size:9px;padding:0 0 0 3px;vertical-align:middle;opacity:.55;line-height:1;transition:opacity .15s}
.col-filter-btn:hover,.col-filter-btn.active{opacity:1;color:var(--accent)}
.filter-dropdown{position:fixed;z-index:400;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:6px;min-width:160px;max-width:260px;max-height:300px;overflow-y:auto}
.fd-item{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:12px;user-select:none;white-space:nowrap}
.fd-item:hover{background:var(--bg)}
.fd-footer{display:flex;gap:6px;padding:6px 4px 2px;border-top:1px solid var(--border);margin-top:4px;position:sticky;bottom:0;background:var(--surface)}
.fd-footer button{flex:1;padding:4px 0;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--fg2);cursor:pointer;font-size:11px;font-weight:600}
.fd-footer .fd-apply{background:var(--accent);border-color:var(--accent);color:#fff}
.cat-filter-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 10px;background:var(--accent-light);border:1px solid var(--accent);border-radius:20px;font-size:11px;color:var(--accent);font-weight:600;white-space:nowrap}
.cat-filter-badge button{background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px;padding:0 0 0 4px;line-height:1}
</style>

<div class="top-bar">
  <h1>comparalo.mx · Gestión de Productos</h1>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <span id="save-status" style="font-size:11px;color:var(--fg2)"></span>
    <button class="btn-export" style="background:var(--green)" id="btn-save" onclick="saveState()">💾 Guardar</button>
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions" target="_blank" rel="noopener" class="btn-export" id="btn-publish" style="background:#e07d00;text-decoration:none;display:inline-flex;align-items:center;gap:5px">🚀 Publicar sitio</a>
    <button class="btn-export" style="background:var(--blue)" onclick="openAddModal()">+ Agregar</button>
  </div>
</div>
<div class="tab-bar">
  <button class="tab-btn on" data-tab="gestion">⚙ Gestión</button>
  <button class="tab-btn" data-tab="laptops">💻 Laptops</button>
  <button class="tab-btn" data-tab="freidoras">🍟 Freidoras</button>
  <button class="tab-btn" data-tab="bicis">🚲 Bicis</button>
  <button class="tab-btn" data-tab="suplementos">💊 Suplementos</button>
  <button class="tab-btn" data-tab="microondas">📟 Microondas</button>
  <button class="tab-btn" data-tab="auditoria">🔍 Auditoría</button>
</div>

<!-- ── TAB: GESTIÓN ─────────────────────────────────────────────────── -->
<div id="tab-gestion" class="tab-section on">
<div class="info-row">
  ℹ️ Haz cambios y guarda con el botón verde para publicar el artifact actualizado.
</div>
<div class="tiles" id="tiles"></div>
<div class="controls">
  <div class="cats" id="cats"></div>
  <div class="filters">
    <button class="filter-btn" id="f-sinprecio" onclick="toggleFilter(\'sinprecio\')">🔴 Sin precio ML</button>
    <button class="filter-btn" id="f-noencontrado" onclick="toggleFilter(\'noencontrado\')">✗ No encontrado</button>
    <button class="filter-btn" id="f-pausados" onclick="toggleFilter(\'pausados\')">⏸ Pausados</button>
    <button class="filter-btn" id="f-sinlink" onclick="toggleFilter(\'sinlink\')">🔗 Sin links</button>
  </div>
</div>
<div class="plat-filters">
  <span class="plat-label">Plataforma:</span>
  <button class="plat-btn" id="pb-ml" data-plat="ml">
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="4" fill="#FFE030"/><text x="16" y="22" text-anchor="middle" font-size="13" font-weight="900" font-family="Arial" fill="#333E48">ML</text></svg>
    Mercado Libre
  </button>
  <button class="plat-btn" id="pb-amz" data-plat="amz">
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="4" fill="#FF9900"/><text x="16" y="22" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial" fill="#fff">amz</text></svg>
    Amazon
  </button>
  <button class="plat-btn" id="pb-ambas" data-plat="ambas">
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect width="16" height="32" rx="4" fill="#FFE030"/><rect x="16" width="16" height="32" rx="4" fill="#FF9900"/></svg>
    Ambas
  </button>
</div>
<div class="search-wrap">
  <input id="search" type="search" placeholder="Buscar por nombre o marca…" oninput="render()">
  <button class="btn-export" style="background:var(--blue);white-space:nowrap" onclick="selectVisible()">☑ Sel. visibles</button>
  <button class="btn-export" onclick="exportJSON()">📋 Copiar JSON</button>
</div>
<div class="sel-bar" id="sel-bar">
  <span id="sel-count">0 seleccionados</span>
  <button class="btn-export-sel" onclick="exportJSON(true)">📋 Copiar JSON seleccionados</button>
  <button class="btn-clear-sel" onclick="clearSelection()">✕ Deseleccionar</button>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th class="chk-col"><input type="checkbox" id="chk-all" title="Seleccionar todos los visibles"></th>
      <th>Producto</th><th>Marca</th><th>Estado ML</th>
      <th>Links</th><th>Precio</th><th>Modificado</th><th>Acciones</th>
    </tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="empty" hidden>Sin resultados para ese filtro.</div>
</div>
</div>

<!-- ── TAB: LAPTOPS ─────────────────────────────────────────────────── -->
<div id="tab-laptops" class="tab-section">
  <div class="tab-toolbar">
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions/workflows/update-prices-laptops.yml" target="_blank" rel="noopener" class="btn-gh-action">🔄 Actualizar precios ML</a>
  </div>
  <div id="ct-laptops"></div>
</div>

<!-- ── TAB: FREIDORAS ──────────────────────────────────────────────── -->
<div id="tab-freidoras" class="tab-section">
  <div class="tab-toolbar">
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions/workflows/update-prices-freidoras.yml" target="_blank" rel="noopener" class="btn-gh-action">🔄 Actualizar precios ML</a>
  </div>
  <div id="ct-freidoras"></div>
</div>

<!-- ── TAB: BICIS ──────────────────────────────────────────────────── -->
<div id="tab-bicis" class="tab-section">
  <div class="tab-toolbar">
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions/workflows/update-prices-bicis.yml" target="_blank" rel="noopener" class="btn-gh-action">🔄 Actualizar precios ML</a>
  </div>
  <div id="ct-bicis"></div>
</div>

<!-- ── TAB: SUPLEMENTOS ────────────────────────────────────────────── -->
<div id="tab-suplementos" class="tab-section">
  <div class="tab-toolbar">
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions/workflows/update-prices-suplementos.yml" target="_blank" rel="noopener" class="btn-gh-action">🔄 Actualizar precios ML</a>
  </div>
  <div class="subtab-bar" id="subtab-bar">
    <button class="subtab-btn on" data-sup="proteina">🥛 Proteína</button>
    <button class="subtab-btn" data-sup="omega3">🐟 Omega 3</button>
    <button class="subtab-btn" data-sup="magnesio">⚡ Magnesio</button>
    <button class="subtab-btn" data-sup="creatina">💪 Creatina</button>
    <button class="subtab-btn" data-sup="complejo_b">🅱✏ Complejo B</button>
  </div>
  <div id="ct-suplementos"></div>
</div>

<!-- ── TAB: MICROONDAS ─────────────────────────────────────────────── -->
<div id="tab-microondas" class="tab-section">
  <div class="tab-toolbar">
    <a href="https://github.com/alancamachorespaldo-hue/compara.mx/actions/workflows/update-prices-microondas.yml" target="_blank" rel="noopener" class="btn-gh-action">🔄 Actualizar precios ML</a>
  </div>
  <div id="ct-microondas"></div>
</div>

<!-- ── TAB: AUDITORÍA ─────────────────────────────────────────────── -->
<div id="tab-auditoria" class="tab-section">
  <div class="tab-toolbar" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
    <span style="font-size:13px;color:var(--fg2)">Productos con link genérico <code style="background:var(--gray-light);padding:2px 6px;border-radius:4px">/p/MLM</code> — pueden apuntar a la variante equivocada en ML. Haz clic en el link para verificar y en ✏ para corregir.</span>
    <button class="btn-export" style="background:var(--accent);font-size:12px;padding:5px 12px" onclick="renderAuditoria()">↺ Actualizar</button>
  </div>
  <div id="audit-body" style="padding:0 20px 20px"></div>
</div>

<!-- ── EDIT MODAL ──────────────────────────────────────────────────── -->
<div class="modal-bd" id="modal" hidden>
  <div class="modal">
    <h2 id="m-title">Editar producto</h2>
    <div class="sub" id="m-sub"></div>
    <label>Link Mercado Libre</label>
    <input id="ed-ml" type="url" placeholder="https://www.mercadolibre.com.mx/…">
    <label>Precio ML (MXN)</label>
    <input id="ed-pml" type="number" min="0" step="0.01" placeholder="Ej. 4999">
    <label>Link Amazon (debe incluir ?tag=comparalo20-20)</label>
    <input id="ed-amz" type="url" placeholder="https://www.amazon.com.mx/dp/…?tag=comparalo20-20">
    <label>Precio Amazon (MXN)</label>
    <input id="ed-pamz" type="number" min="0" step="0.01" placeholder="Ej. 5299">
    <div class="modal-section" id="specs-section" hidden>
      <div class="modal-section-title">Especificaciones</div>
      <div class="specs-grid" id="specs-fields"></div>
    </div>
    <div class="del-confirm" id="del-confirm" hidden>
      ¿Eliminar este producto del registro?
      <button class="btn-yes" onclick="confirmDelete()">Sí, eliminar</button>
      <button class="btn-no" onclick="document.getElementById(\'del-confirm\').hidden=true">No</button>
    </div>
    <div class="modal-footer">
      <button class="btn-del-sm" onclick="showDelConfirm()">🗑 Eliminar</button>
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" onclick="saveEdit()">Guardar</button>
    </div>
  </div>
</div>

<!-- ── ADD MODAL ───────────────────────────────────────────────────── -->
<div class="modal-bd add-modal" id="add-modal" hidden>
  <div class="modal">
    <h2>Agregar producto</h2>
    <div class="sub">El producto se añadirá al JSON exportado</div>
    <label>Categoría</label>
    <select id="add-cat"></select>
    <label>Nombre del producto</label>
    <input id="add-nombre" type="text" placeholder="Ej. ASUS Vivobook 15 Core i5 8GB 512GB">
    <label>Marca</label>
    <input id="add-marca" type="text" placeholder="Ej. ASUS">
    <label>Link Mercado Libre</label>
    <input id="add-ml" type="url" placeholder="https://meli.la/…">
    <label>Link Amazon (con ?tag=comparalo20-20)</label>
    <input id="add-amz" type="url" placeholder="https://www.amazon.com.mx/dp/…?tag=comparalo20-20">
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeAddModal()">Cancelar</button>
      <button class="btn-save" onclick="saveAdd()">Agregar</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const INITIAL_DATA = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob('${data}'),c=>c.charCodeAt(0))));
const BUILT_AT = '${new Date().toISOString()}';
let DB = JSON.parse(JSON.stringify(INITIAL_DATA));
try {
  const s = localStorage.getItem('admin_db');
  const ts = localStorage.getItem('admin_db_ts');
  if (s && ts && ts > BUILT_AT) { DB = JSON.parse(s); }
  else if (s && ts && ts <= BUILT_AT) {
    localStorage.removeItem('admin_db'); localStorage.removeItem('admin_db_ts');
  }
} catch(e) {}

let activeCat = 'todas', activeFilters = new Set(), activeTile = null, activePlat = null;
let editKey = null, selected = new Set();
let curSupKey = 'proteina';

// ── CATALOG DEFS ────────────────────────────────────────────────────────────
const CATALOG_DEFS = {
  laptops: {
    label: 'laptops', catKey: 'laptops',
    cols: [
      {key:'precioML',      label:'Precio ML',       filterable:true},
      {key:'precioAmz',     label:'Precio AMZ',      filterable:true},
      {key:'enlace',        label:'Enlace',          filterable:false},
      {key:'marca',         label:'Marca',           filterable:true},
      {key:'nombre',        label:'Nombre',          filterable:true},
      {key:'procesador',    label:'Procesador',      filterable:true,  sk:'procesador'},
      {key:'ram',           label:'RAM',             filterable:true,  sk:'ram'},
      {key:'almacenamiento',label:'Almacenamiento',  filterable:true,  sk:'almacenamiento'},
      {key:'pantalla',      label:'Pantalla',        filterable:true,  sk:'pantalla'},
      {key:'gpu',           label:'GPU',             filterable:true,  sk:'gpu'},
      {key:'so',            label:'SO',              filterable:true,  sk:'so'},
      {key:'peso',          label:'Peso',            filterable:true,  sk:'peso'},
      {key:'touch',         label:'Touch',           filterable:true,  sk:'touch'},
      {key:'estadoML',      label:'Estado',          filterable:true},
      {key:'_updatedAt',    label:'Últ. Mod.',       filterable:true},
      {key:'_actions',      label:'Estado web',      filterable:true},
      {key:'_edit',         label:'Editar',          filterable:false},
    ]
  },
  freidoras: {
    label: 'freidoras', catKey: 'freidoras',
    cols: [
      {key:'precioML',     label:'Precio ML',    filterable:true},
      {key:'precioAmz',    label:'Precio AMZ',   filterable:true},
      {key:'enlace',       label:'Enlace',       filterable:false},
      {key:'marca',        label:'Marca',        filterable:true},
      {key:'nombre',       label:'Nombre',       filterable:true},
      {key:'tipo',         label:'Tipo',         filterable:true,  sk:'tipo'},
      {key:'capacidad',    label:'Capacidad',    filterable:true,  sk:'capacidad'},
      {key:'potencia',     label:'Potencia',     filterable:true,  sk:'potencia'},
      {key:'tempMax',      label:'Temp. Máx.',   filterable:true,  sk:'tempMax'},
      {key:'panel',        label:'Panel',        filterable:true,  sk:'panel'},
      {key:'canastos',     label:'Canastos',     filterable:true,  sk:'canastos'},
      {key:'ventana',      label:'Ventana',      filterable:true,  sk:'ventana'},
      {key:'antiadherente',label:'Antiadherente',filterable:true,  sk:'antiadherente'},
      {key:'estadoML',     label:'Estado',       filterable:true},
      {key:'_updatedAt',   label:'Últ. Mod.',    filterable:true},
      {key:'_actions',     label:'Estado web',   filterable:true},
      {key:'_edit',        label:'Editar',       filterable:false},
    ]
  },
  bicis: {
    label: 'bicis', catKey: 'bicis',
    cols: [
      {key:'precioML',   label:'Precio ML',  filterable:true},
      {key:'precioAmz',  label:'Precio AMZ', filterable:true},
      {key:'enlace',     label:'Enlace',     filterable:false},
      {key:'marca',      label:'Marca',      filterable:true},
      {key:'nombre',     label:'Nombre',     filterable:true},
      {key:'tipo',       label:'Tipo',       filterable:true,  sk:'tipo'},
      {key:'autonomia',  label:'Autonomía',  filterable:true,  sk:'autonomia'},
      {key:'velocidad',  label:'Vel. Máx.',  filterable:true,  sk:'velocidad'},
      {key:'motor',      label:'Motor',      filterable:true,  sk:'motor'},
      {key:'bateria',    label:'Batería',    filterable:true,  sk:'bateria'},
      {key:'rueda',      label:'Rueda',      filterable:true,  sk:'rueda'},
      {key:'cargaMax',   label:'Carga Máx.', filterable:true,  sk:'cargaMax'},
      {key:'ip',         label:'IP',         filterable:true,  sk:'ip'},
      {key:'estadoML',   label:'Estado',     filterable:true},
      {key:'_updatedAt', label:'Últ. Mod.',  filterable:true},
      {key:'_actions',   label:'Estado web', filterable:true},
      {key:'_edit',      label:'Editar',     filterable:false},
    ]
  },
  microondas: {
    label: 'microondas', catKey: 'microondas',
    cols: [
      {key:'precioML',   label:'Precio ML',  filterable:true},
      {key:'precioAmz',  label:'Precio AMZ', filterable:true},
      {key:'enlace',     label:'Enlace',     filterable:false},
      {key:'marca',      label:'Marca',      filterable:true},
      {key:'nombre',     label:'Nombre',     filterable:true},
      {key:'estadoML',   label:'Estado',     filterable:true},
      {key:'_updatedAt', label:'Últ. Mod.',  filterable:true},
      {key:'_actions',   label:'Estado web', filterable:true},
      {key:'_edit',      label:'Editar',     filterable:false},
    ]
  },
  proteina: {
    label: 'proteína', catKey: 'proteina',
    cols: [
      {key:'precioML',           label:'Precio ML',      filterable:true},
      {key:'precioAmz',          label:'Precio AMZ',     filterable:true},
      {key:'enlace',             label:'Enlace',         filterable:false},
      {key:'marca',              label:'Marca',          filterable:true},
      {key:'nombre',             label:'Nombre',         filterable:true},
      {key:'tipoProteina',       label:'Tipo',           filterable:true,  sk:'tipoProteina'},
      {key:'fuenteProteina',     label:'Fuente',         filterable:true,  sk:'fuenteProteina'},
      {key:'gramosPorPorcion',   label:'g/Porción',      filterable:true,  sk:'gramosPorPorcion'},
      {key:'proteinaPorPorcion', label:'Prot/Porción',   filterable:true,  sk:'proteinaPorPorcion'},
      {key:'costoPorPorcion',    label:'Costo/Porción',  filterable:true,  sk:'costoPorPorcion'},
      {key:'vegana',             label:'Vegana',         filterable:true,  sk:'vegana'},
      {key:'glutenFree',         label:'Gluten Free',    filterable:true,  sk:'glutenFree'},
      {key:'estadoML',           label:'Estado',         filterable:true},
      {key:'_updatedAt',         label:'Últ. Mod.',      filterable:true},
      {key:'_actions',           label:'Estado web',     filterable:true},
      {key:'_edit',              label:'Editar',         filterable:false},
    ]
  },
  omega3: {
    label: 'omega 3', catKey: 'omega3',
    cols: [
      {key:'precioML',        label:'Precio ML',      filterable:true},
      {key:'precioAmz',       label:'Precio AMZ',     filterable:true},
      {key:'enlace',          label:'Enlace',         filterable:false},
      {key:'marca',           label:'Marca',          filterable:true},
      {key:'nombre',          label:'Nombre',         filterable:true},
      {key:'epa',             label:'EPA',            filterable:true,  sk:'epa'},
      {key:'dha',             label:'DHA',            filterable:true,  sk:'dha'},
      {key:'omegaTotal',      label:'Omega Total',    filterable:true,  sk:'omegaTotal'},
      {key:'fuenteOmega',     label:'Fuente',         filterable:true,  sk:'fuenteOmega'},
      {key:'ifos',            label:'IFOS',           filterable:true,  sk:'ifos'},
      {key:'metalesPesados',  label:'Sin Metales',    filterable:true,  sk:'metalesPesados'},
      {key:'costoPorPorcion', label:'Costo/Porción',  filterable:true,  sk:'costoPorPorcion'},
      {key:'estadoML',        label:'Estado',         filterable:true},
      {key:'_updatedAt',      label:'Últ. Mod.',      filterable:true},
      {key:'_actions',        label:'Estado web',     filterable:true},
      {key:'_edit',           label:'Editar',         filterable:false},
    ]
  },
  magnesio: {
    label: 'magnesio', catKey: 'magnesio',
    cols: [
      {key:'precioML',        label:'Precio ML',      filterable:true},
      {key:'precioAmz',       label:'Precio AMZ',     filterable:true},
      {key:'enlace',          label:'Enlace',         filterable:false},
      {key:'marca',           label:'Marca',          filterable:true},
      {key:'nombre',          label:'Nombre',         filterable:true},
      {key:'formaMagnesio',   label:'Forma',          filterable:true,  sk:'formaMagnesio'},
      {key:'mgMagnesio',      label:'mg Magnesio',    filterable:true,  sk:'mgMagnesio'},
      {key:'mgElemental',     label:'mg Elemental',   filterable:true,  sk:'mgElemental'},
      {key:'absorcion',       label:'Absorción',      filterable:true,  sk:'absorcion'},
      {key:'vegano',          label:'Vegano',         filterable:true,  sk:'vegano'},
      {key:'costoPorPorcion', label:'Costo/Porción',  filterable:true,  sk:'costoPorPorcion'},
      {key:'estadoML',        label:'Estado',         filterable:true},
      {key:'_updatedAt',      label:'Últ. Mod.',      filterable:true},
      {key:'_actions',        label:'Estado web',     filterable:true},
      {key:'_edit',           label:'Editar',         filterable:false},
    ]
  },
  creatina: {
    label: 'creatina', catKey: 'creatina',
    cols: [
      {key:'precioML',        label:'Precio ML',      filterable:true},
      {key:'precioAmz',       label:'Precio AMZ',     filterable:true},
      {key:'enlace',          label:'Enlace',         filterable:false},
      {key:'marca',           label:'Marca',          filterable:true},
      {key:'nombre',          label:'Nombre',         filterable:true},
      {key:'tipoCreatina',    label:'Tipo',           filterable:true,  sk:'tipoCreatina'},
      {key:'presentacion',    label:'Presentación',   filterable:true,  sk:'presentacion'},
      {key:'grPorPorcion',    label:'g/Porción',      filterable:true,  sk:'grPorPorcion'},
      {key:'pura',            label:'Pura',           filterable:true,  sk:'pura'},
      {key:'costoPorPorcion', label:'Costo/Porción',  filterable:true,  sk:'costoPorPorcion'},
      {key:'costoPor5g',      label:'Costo/5g',       filterable:true,  sk:'costoPor5g'},
      {key:'estadoML',        label:'Estado',         filterable:true},
      {key:'_updatedAt',      label:'Últ. Mod.',      filterable:true},
      {key:'_actions',        label:'Estado web',     filterable:true},
      {key:'_edit',           label:'Editar',         filterable:false},
    ]
  },
  complejo_b: {
    label: 'complejo B', catKey: 'complejo_b',
    cols: [
      {key:'precioML',        label:'Precio ML',      filterable:true},
      {key:'precioAmz',       label:'Precio AMZ',     filterable:true},
      {key:'enlace',          label:'Enlace',         filterable:false},
      {key:'marca',           label:'Marca',          filterable:true},
      {key:'nombre',          label:'Nombre',         filterable:true},
      {key:'capsulasPorDia',  label:'Cáps./Día',      filterable:true,  sk:'capsulasPorDia'},
      {key:'costoPorPorcion', label:'Costo/Porción',  filterable:true,  sk:'costoPorPorcion'},
      {key:'b1',  label:'B1',  filterable:true,  sk:'b1'},
      {key:'b6',  label:'B6',  filterable:true,  sk:'b6'},
      {key:'b9',  label:'B9',  filterable:true,  sk:'b9'},
      {key:'b12', label:'B12', filterable:true,  sk:'b12'},
      {key:'formaB12',        label:'Forma B12',      filterable:true,  sk:'formaB12'},
      {key:'estadoML',        label:'Estado',         filterable:true},
      {key:'_updatedAt',      label:'Últ. Mod.',      filterable:true},
      {key:'_actions',        label:'Estado web',     filterable:true},
      {key:'_edit',           label:'Editar',         filterable:false},
    ]
  },
};

// Per-catalog filter state: catKey → {filters: {colKey: Set}, search: ''}
const catState = {};
function getCatState(catKey) {
  if (!catState[catKey]) catState[catKey] = {filters:{}, search:'', plat:null, selected:new Set(), sortCol:'_updatedAt', sortDir:'desc', tileFilter:null};
  return catState[catKey];
}

// ── GESTIÓN TAB ──────────────────────────────────────────────────────────────
function allProds() {
  return Object.entries(DB).flatMap(([cat, prods]) => prods.map(p => ({...p, _cat: cat, _key: cat+'|'+p.id})));
}
function visibleProds() {
  const src = activeCat === 'todas' ? allProds() : (DB[activeCat]||[]).map(p => ({...p, _cat: activeCat, _key: activeCat+'|'+p.id}));
  const q = document.getElementById('search').value.toLowerCase();
  return src.filter(p => {
    if (q && !(p.nombre+' '+p.marca).toLowerCase().includes(q)) return false;
    if (activeTile && activeTile !== 'todas') {
      if (activeTile !== p.estadoML) return false;
    }
    if (activePlat === 'ml' && !p.linkML) return false;
    if (activePlat === 'amz' && !p.linkAmz) return false;
    if (activePlat === 'ambas' && !(p.linkML && p.linkAmz)) return false;
    if (activeFilters.has('sinprecio') && p.estadoML !== 'sin_precio') return false;
    if (activeFilters.has('noencontrado') && p.estadoML !== 'no_encontrado') return false;
    if (activeFilters.has('pausados') && p.activo !== false) return false;
    if (activeFilters.has('sinlink') && (p.linkAmz || p.linkML)) return false;
    return true;
  });
}

function renderStats() {
  const all = allProds();
  const counts = {todas:all.length, actualizado:0, sin_cambio:0, sin_precio:0, no_encontrado:0, precio_sospechoso:0, nuevo:0};
  all.forEach(p=>{if(counts[p.estadoML]!==undefined)counts[p.estadoML]++;});
  const pa = all.filter(p=>p.activo===false).length;
  const TILES = [
    {k:'todas',l:'Total',cls:'muted'},
    {k:'actualizado',l:'Actualizados',cls:'ok'},
    {k:'sin_cambio',l:'Sin cambio',cls:'muted'},
    {k:'sin_precio',l:'Sin precio',cls:'err'},
    {k:'no_encontrado',l:'No encontrado',cls:'err'},
    {k:'precio_sospechoso',l:'Sospechoso',cls:'blue'},
    {k:'nuevo',l:'Nuevos ML',cls:'ok'},
  ];
  document.getElementById('tiles').innerHTML = TILES.map(t =>
    '<div class="tile'+(activeTile===t.k?' on':'')+'" data-tile="'+t.k+'"><div class="tile-lbl">'+t.l+'</div><div class="tile-num '+t.cls+'">'+counts[t.k]+'</div></div>'
  ).join('') + (pa ? '<div class="tile" style="cursor:default"><div class="tile-lbl">Pausados</div><div class="tile-num warn">'+pa+'</div></div>' : '');
  document.querySelectorAll('.tile[data-tile]').forEach(el => el.onclick = () => setTile(el.dataset.tile));
}

function renderCats() {
  const CAT_LABELS = {todas:'Todas',laptops:'Laptops',freidoras:'Freidoras',bicis:'Bicis',microondas:'Microondas',proteina:'Proteína',omega3:'Omega 3',magnesio:'Magnesio',creatina:'Creatina',complejo_b:'Complejo B'};
  document.getElementById('cats').innerHTML = ['todas',...Object.keys(DB)].map(c =>
    '<button class="cat-btn'+(c===activeCat?' on':'')+'" data-cat="'+c+'">'+(CAT_LABELS[c]||c.charAt(0).toUpperCase()+c.slice(1))+'</button>'
  ).join('');
  document.querySelectorAll('.cat-btn[data-cat]').forEach(el => el.onclick = () => setCat(el.dataset.cat));
}

function render() {
  const prods = visibleProds();
  const tb = document.getElementById('tbody');
  document.getElementById('empty').hidden = prods.length > 0;
  if (!prods.length) { tb.innerHTML=''; return; }
  const ESTADO = {actualizado:'✓ Actualizado',sin_cambio:'= Sin cambio',sin_precio:'✗ Sin precio',no_encontrado:'✗ No encontrado',precio_sospechoso:'? Sospechoso',nuevo:'★ Nuevo'};
  tb.innerHTML = prods.map(p => {
    const ecls = p.estadoML ? ('b-'+p.estadoML) : 'b-null';
    const elab = ESTADO[p.estadoML] || '— Sin ML';
    const lml = p.linkML ? '<a class="link-chip lc-ml" href="'+p.linkML+'" target="_blank" rel="noopener">ML↗</a>' : '<span class="link-chip lc-none">Sin ML</span>';
    const lamz = p.linkAmz ? '<a class="link-chip lc-amz" href="'+p.linkAmz+'" target="_blank" rel="noopener">AMZ↗</a>' : (p.estadoML==='nuevo' ? '<span class="link-chip lc-amz-pending">⚠ Sin AMZ</span>' : '<span class="link-chip lc-none">Sin AMZ</span>');
    const paBtn = p.activo!==false
      ? '<button class="btn-sm btn-pause" data-act="pause" data-key="'+p._key+'">⏸ Pausar</button>'
      : '<button class="btn-sm btn-play" data-act="play" data-key="'+p._key+'">▶ Activar</button>';
    const pml = p.precioML ? 'ML $'+Math.round(p.precioML).toLocaleString(\'es-MX\') : \'\';
    const pamz = p.precioAmz ? \'AMZ $\'+Math.round(p.precioAmz).toLocaleString(\'es-MX\') : \'\';
    const precio = (pml||pamz) ? (pml+(pml&&pamz?\' / \':\'\')+pamz) : \'—\';
    const upd = p._updatedAt ? fmtDate(p._updatedAt) : \'<span style="color:var(--fg2)">—</span>\';
    const isSel = selected.has(p._key);
    return \'<tr class="\'+(p.activo===false?\'pausado\':\'\')+(isSel?\' selected\':\'\')+\'"><td class="chk-col"><input type="checkbox" data-act="chk" data-key="\'+p._key+\'"\'+(isSel?\' checked\':\'\')+\' style="cursor:pointer;width:15px;height:15px"></td><td class="nombre-col">\'+p.nombre+\'</td><td>\'+p.marca+\'</td><td><span class="badge \'+ecls+\'">\'+elab+\'</span></td><td>\'+lml+lamz+\'</td><td>\'+precio+\'</td><td style="font-size:11px;white-space:nowrap;color:var(--fg2)">\'+upd+\'</td><td><div class="actions">\'+paBtn+\'<button class="btn-sm btn-edit" data-act="edit" data-key="\'+p._key+\'">✏ Editar</button></div></td></tr>\';
  }).join(\'\');
}

function fmtDate(iso){
  const d=new Date(iso);
  return d.toLocaleDateString(\'es-MX\',{day:\'2-digit\',month:\'short\',year:\'numeric\'})+\' \'+d.toLocaleTimeString(\'es-MX\',{hour:\'2-digit\',minute:\'2-digit\'});
}

document.getElementById(\'tbody\').addEventListener(\'click\', e => {
  const btn = e.target.closest(\'[data-act]\');
  if (!btn) return;
  const key = btn.dataset.key;
  if (btn.dataset.act === \'edit\') openEdit(key);
  else if (btn.dataset.act === \'pause\' || btn.dataset.act === \'play\') toggleActivo(key);
  else if (btn.dataset.act === \'chk\') {
    if (btn.checked) selected.add(key); else selected.delete(key);
    btn.closest(\'tr\').classList.toggle(\'selected\', btn.checked);
    updateSelBar();
  }
});
document.getElementById(\'chk-all\').addEventListener(\'change\', e => {
  const vis = visibleProds();
  if (e.target.checked) vis.forEach(p => selected.add(p._key));
  else vis.forEach(p => selected.delete(p._key));
  render(); updateSelBar();
});
function updateSelBar(){
  const n = selected.size;
  const bar = document.getElementById(\'sel-bar\');
  bar.classList.toggle(\'show\', n > 0);
  document.getElementById(\'sel-count\').textContent = n + \' producto\'+(n!==1?\'s\':\'\')+\' seleccionado\'+(n!==1?\'s\':\'\')+\'\';
  document.getElementById(\'chk-all\').checked = n > 0 && visibleProds().every(p => selected.has(p._key));
  document.getElementById(\'chk-all\').indeterminate = n > 0 && !visibleProds().every(p => selected.has(p._key));
}
function clearSelection(){ selected.clear(); render(); updateSelBar(); }
function selectVisible(){ visibleProds().forEach(p=>selected.add(p._key)); render(); updateSelBar(); }

function encodeDB(){
  const bytes=new TextEncoder().encode(JSON.stringify(DB));
  let bin=\'\';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function autoSave(){
  try{localStorage.setItem(\'admin_db\',JSON.stringify(DB));localStorage.setItem(\'admin_db_ts\',new Date().toISOString());}catch(e){}
  document.getElementById(\'save-status\').textContent=\'● Sin guardar\';
  // Iluminar el botón Publicar sitio para recordar publicar cambios
  const pbtn=document.getElementById(\'btn-publish\');
  if(pbtn&&!pbtn.classList.contains(\'publish-pending\')){
    pbtn.classList.add(\'publish-pending\');
    pbtn.title=\'Hay cambios sin publicar en la web — haz clic para publicar\';
  }
}
function toB64(str){
  const bytes=new TextEncoder().encode(str);
  let bin=\'\';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64){
  return new TextDecoder().decode(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
}
async function saveState(){
  const btn=document.getElementById(\'btn-save\');
  btn.disabled=true;btn.textContent=\'💾 Guardando…\';
  try{
    const artifact=await claude.use(\'artifact\');
    if(!artifact){toast(\'⚠ Guardar no disponible — usa Copiar JSON como respaldo\');btn.disabled=false;btn.textContent=\'💾 Guardar\';return;}
    const newB64=encodeDB();
    const pa=fromB64(document.getElementById(\'_srca\').textContent);
    const pb=fromB64(document.getElementById(\'_srcb\').textContent);
    const tags=\'\\\\n<script id="_srca" type="text/plain">\'+toB64(pa)+\'<\\\\/script>\\\\n<script id="_srcb" type="text/plain">\'+toB64(pb)+\'<\\\\/script>\';
    const content=pa+newB64+pb+tags;
    const SKEL=\'<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#f8f9fa}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\';
    await artifact.publish(SKEL+content+\'</body></html>\');
    try{localStorage.removeItem(\'admin_db\');}catch(e){}
    document.getElementById(\'save-status\').textContent=\'✓ Guardado\';
    // Descargar merged-admin.json actualizado para poder commitear en GitHub
    const fullDB={};
    for(const [cat,prods] of Object.entries(DB)){
      fullDB[cat]=prods.map(p=>{const o={};Object.keys(p).forEach(k=>{o[k]=p[k];});return o;});
    }
    const jsonStr=JSON.stringify(fullDB,null,2);
    try{
      if(window.claude&&window.claude.downloads){
        await window.claude.downloads.save({filename:\'merged-admin.json\',content:jsonStr,mimeType:\'application/json\'});
      } else {
        const jblob=new Blob([jsonStr],{type:\'application/json\'});
        const ja=document.createElement(\'a\');ja.href=URL.createObjectURL(jblob);ja.download=\'merged-admin.json\';
        document.body.appendChild(ja);ja.click();document.body.removeChild(ja);URL.revokeObjectURL(ja.href);
      }
    }catch(de){console.warn(\'download failed\',de);}
    toast(\'✅ Guardado — se descargó merged-admin.json, cópialo al repo para commitear\');
  }catch(e){
    toast(\'⚠ Error al guardar: \'+(e.message||String(e)));
    btn.disabled=false;btn.textContent=\'💾 Guardar\';
  }
}

function setCat(c){ activeCat=c; renderCats(); render(); }
function setTile(k){ activeTile=(activeTile===k?null:k); renderStats(); render(); }
function setPlat(p){
  activePlat=(activePlat===p?null:p);
  [\'ml\',\'amz\',\'ambas\'].forEach(id=>{
    const btn=document.getElementById(\'pb-\'+id);
    btn.className=\'plat-btn\'+(activePlat===id?\' on-\'+id:\'\')+\'\';
  });
  render();
}
document.querySelectorAll(\'.plat-btn[data-plat]\').forEach(el=>el.addEventListener(\'click\',()=>setPlat(el.dataset.plat)));
function toggleFilter(f){
  activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);
  document.getElementById(\'f-\'+f).classList.toggle(\'on\');
  render();
}
function toggleActivo(key){
  const [cat,id]=key.split(\'|\');
  const p=DB[cat]&&DB[cat].find(p=>String(p.id)===id);
  if(!p)return;
  p.activo=(p.activo===false);
  p._updatedAt=new Date().toISOString();
  renderStats(); render(); autoSave();
  // Re-renderizar el catálogo de la categoría afectada
  _renderCatBody(cat);
  toast(p.activo?\'● Producto activado\':\'⏸ Producto pausado\');
}

// ── EDIT MODAL ───────────────────────────────────────────────────────────────
function openEdit(key){
  editKey=key;
  const [cat,id]=key.split(\'|\');
  const p=DB[cat]&&DB[cat].find(p=>String(p.id)===id);
  if(!p){toast(\'⚠ Producto no encontrado\');return;}
  document.getElementById(\'m-title\').textContent=\'Editar · \'+p.nombre;
  document.getElementById(\'m-sub\').textContent=cat+\' · id \'+p.id;
  document.getElementById(\'ed-ml\').value=p.linkML||\'\';\
  document.getElementById(\'ed-pml\').value=p.precioML||\'\';\
  document.getElementById(\'ed-amz\').value=p.linkAmz||\'\';\
  document.getElementById(\'ed-pamz\').value=p.precioAmz||\'\';\
  // Render specs fields for catalog categories
  const def = CATALOG_DEFS[cat];
  const specsSection = document.getElementById(\'specs-section\');
  const specsFields = document.getElementById(\'specs-fields\');
  if(def && p.especs){
    const especs = p.especs||{};
    const skCols = def.cols.filter(c=>c.sk);
    specsFields.innerHTML = skCols.map(c=>
      \'<div><label>\'+c.label+\'</label><input data-sk="\'+c.sk+\'" value="\'+(_esc(especs[c.sk]||\'\')+\'">\')
    ).join(\'\');
    specsSection.hidden=false;
  } else {
    specsFields.innerHTML=\'\';
    specsSection.hidden=true;
  }
  document.getElementById(\'del-confirm\').hidden=true;
  document.getElementById(\'modal\').hidden=false;
}
function _esc(s){ return String(s).replace(/&/g,\'&amp;\').replace(/"/g,\'&quot;\').replace(/</g,\'&lt;\'); }

function saveEdit(){
  if(!editKey)return;
  const [cat,id]=editKey.split(\'|\');
  const p=DB[cat].find(p=>String(p.id)===id);
  p.linkML=document.getElementById(\'ed-ml\').value.trim()||null;
  p.precioML=parseFloat(document.getElementById(\'ed-pml\').value)||null;
  p.linkAmz=document.getElementById(\'ed-amz\').value.trim()||null;
  p.precioAmz=parseFloat(document.getElementById(\'ed-pamz\').value)||null;
  // Save specs
  const specsSection = document.getElementById(\'specs-section\');
  if(!specsSection.hidden && p.especs!==undefined){
    if(!p.especs) p.especs={};
    document.querySelectorAll(\'#specs-fields [data-sk]\').forEach(inp=>{
      const val=inp.value.trim();
      if(val) p.especs[inp.dataset.sk]=val;
      else delete p.especs[inp.dataset.sk];
    });
  }
  p._updatedAt=new Date().toISOString();
  closeModal(); renderStats(); render(); autoSave(); toast(\'✓ Producto actualizado\');
  // Re-render the catalog tab if open
  const activeTab = document.querySelector(\'.tab-btn.on\');
  if(activeTab && activeTab.dataset.tab && activeTab.dataset.tab!==\'gestion\') {
    renderCatalogTab(activeTab.dataset.tab);
  }
}
function showDelConfirm(){document.getElementById(\'del-confirm\').hidden=false;}
function confirmDelete(){
  if(!editKey)return;
  const [cat,id]=editKey.split(\'|\');
  DB[cat]=DB[cat].filter(p=>String(p.id)!==id);
  closeModal(); renderStats(); render(); autoSave(); toast(\'🗑 Producto eliminado del registro\');
}
function closeModal(){
  document.getElementById(\'modal\').hidden=true;
  document.getElementById(\'del-confirm\').hidden=true;
  editKey=null;
}
document.getElementById(\'modal\').addEventListener(\'click\',e=>{if(e.target===document.getElementById(\'modal\'))closeModal();});

function exportJSON(onlySelected){
  const out={};
  for(const [cat,prods] of Object.entries(DB)){
    const filtrados = onlySelected ? prods.filter(p => selected.has(cat+\'|\'+p.id)) : prods;
    if(filtrados.length===0) continue;
    out[cat]=filtrados.map(({id,nombre,marca,linkML,linkAmz,mlId,precioML,precioAmz,activo,especs})=>({id,nombre,marca,linkML:linkML||null,linkAmz:linkAmz||null,mlId:mlId||null,precioML:precioML||null,precioAmz:precioAmz||null,activo:activo!==false,especs:especs||undefined}));
  }
  const json=JSON.stringify(out,null,2);
  const msg = onlySelected ? \'✓ JSON de \'+selected.size+\' productos copiado\' : \'✓ JSON completo copiado\';
  navigator.clipboard.writeText(json).then(()=>toast(msg)).catch(()=>{
    const ta=document.createElement(\'textarea\');
    ta.value=json;ta.style.cssText=\'position:fixed;opacity:0\';
    document.body.appendChild(ta);ta.select();document.execCommand(\'copy\');document.body.removeChild(ta);
    toast(msg);
  });
}

function openAddModal(){
  const sel=document.getElementById(\'add-cat\');
  const CAT_LABELS={laptops:\'Laptops\',freidoras:\'Freidoras\',bicis:\'Bicis\',microondas:\'Microondas\',proteina:\'Proteína\',omega3:\'Omega 3\',magnesio:\'Magnesio\',creatina:\'Creatina\',complejo_b:\'Complejo B\'};
  sel.innerHTML=Object.keys(DB).map(c=>\'<option value="\'+c+\'">\'+(CAT_LABELS[c]||c)+\'</option>\').join(\'\');
  [\'add-nombre\',\'add-marca\',\'add-ml\',\'add-amz\'].forEach(id=>document.getElementById(id).value=\'\');
  document.getElementById(\'add-modal\').hidden=false;
}
function closeAddModal(){document.getElementById(\'add-modal\').hidden=true;}
function saveAdd(){
  const cat=document.getElementById(\'add-cat\').value;
  const nombre=document.getElementById(\'add-nombre\').value.trim();
  const marca=document.getElementById(\'add-marca\').value.trim();
  const linkML=document.getElementById(\'add-ml\').value.trim()||null;
  const linkAmz=document.getElementById(\'add-amz\').value.trim()||null;
  if(!nombre||!marca){toast(\'⚠ Nombre y marca son obligatorios\');return;}
  const ids=(DB[cat]||[]).map(p=>p.id).filter(x=>typeof x===\'number\');
  const newId=ids.length?Math.max(...ids)+1:1;
  if(!DB[cat]) DB[cat]=[];
  DB[cat].push({id:newId,nombre,marca,linkML,linkAmz,mlId:null,precioML:null,precioAmz:null,activo:true,estadoML:null,especs:{}});
  closeAddModal(); renderStats(); renderCats(); render(); autoSave();
  toast(\'✓ Producto agregado a \'+cat);
}
document.getElementById(\'add-modal\').addEventListener(\'click\',e=>{if(e.target===document.getElementById(\'add-modal\'))closeAddModal();});

function toast(msg){
  const el=document.getElementById(\'toast\');
  el.textContent=msg;el.classList.add(\'show\');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove(\'show\'),3000);
}

renderStats(); renderCats(); render();

// Limpiar badge "pendiente" de Publicar sitio cuando el usuario hace click
document.getElementById(\'btn-publish\').addEventListener(\'click\',()=>{
  const pbtn=document.getElementById(\'btn-publish\');
  pbtn.classList.remove(\'publish-pending\');
  pbtn.title=\'\';
});

// ── TABS ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(\'.tab-btn[data-tab]\').forEach(btn => {
  btn.addEventListener(\'click\', () => {
    document.querySelectorAll(\'.tab-btn\').forEach(b => b.classList.remove(\'on\'));
    document.querySelectorAll(\'.tab-section\').forEach(s => s.classList.remove(\'on\'));
    btn.classList.add(\'on\');
    document.getElementById(\'tab-\'+btn.dataset.tab).classList.add(\'on\');
    renderCatalogTab(btn.dataset.tab);
  });
});

document.querySelectorAll(\'.subtab-btn[data-sup]\').forEach(btn => {
  btn.addEventListener(\'click\', () => {
    document.querySelectorAll(\'.subtab-btn\').forEach(b => b.classList.remove(\'on\'));
    btn.classList.add(\'on\');
    curSupKey = btn.dataset.sup;
    renderCatalog(curSupKey, document.getElementById(\'ct-suplementos\'));
  });
});

function renderCatalogTab(tab){
  if(tab === \'gestion\') return;
  if(tab === \'auditoria\'){ renderAuditoria(); return; }
  if(tab === \'suplementos\'){
    renderCatalog(curSupKey, document.getElementById(\'ct-suplementos\'));
  } else if(CATALOG_DEFS[tab]){
    renderCatalog(tab, document.getElementById(\'ct-\'+tab));
  }
}

function renderAuditoria(){
  const body=document.getElementById(\'audit-body\');
  if(!body) return;
  const CAT_LABELS={laptops:\'💻 Laptops\',freidoras:\'🍟 Freidoras\',bicis:\'🚲 Bicis\',microondas:\'📟 Microondas\',proteina:\'🥛 Proteína\',omega3:\'🐟 Omega 3\',magnesio:\'💊 Magnesio\',creatina:\'💪 Creatina\',complejo_b:\'🅱 Complejo B\'};
  let html=\'\';
  let totalGen=0, totalSinLink=0;
  for(const [cat,prods] of Object.entries(DB)){
    const genericos=prods.filter(p=>p.linkML&&p.linkML.includes(\'/p/MLM\'));
    const sinLink=prods.filter(p=>!p.linkML&&!p.linkAmz);
    totalGen+=genericos.length; totalSinLink+=sinLink.length;
    if(!genericos.length&&!sinLink.length) continue;
    html+=\'<div style="margin-top:20px"><div style="font-weight:700;font-size:14px;color:var(--accent);padding:6px 0;border-bottom:2px solid var(--border);margin-bottom:8px">\'+(CAT_LABELS[cat]||cat)+\' — <span style="color:var(--red)">\'+ genericos.length+\' genéricos</span>\'+( sinLink.length?\'  <span style="color:var(--gray)">· \'+sinLink.length+\' sin link</span>\':\'\')+\'</div>\';
    html+=\'<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--gray-light)"><th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--fg2)">Producto</th><th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--fg2)">Link ML actual</th><th style="padding:6px 10px;font-size:11px;text-transform:uppercase;color:var(--fg2)">Estado</th><th style="padding:6px 10px"></th></tr></thead><tbody>\';
    for(const p of [...genericos,...sinLink]){
      const key=cat+\'|\'+p.id;
      const isGen=p.linkML&&p.linkML.includes(\'/p/MLM\');
      const badge=isGen
        ?\'<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">⚠ Genérico</span>\'
        :\'<span style="background:var(--red-light);color:var(--red);padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">✗ Sin link</span>\';
      const linkCell=p.linkML
        ?\'<a href="\'+p.linkML+\'" target="_blank" rel="noopener" style="color:var(--accent);font-size:11px;word-break:break-all;text-decoration:none">\'+ p.linkML.replace(\'https://www.mercadolibre.com.mx\',\'meli.mx\')+\'↗</a>\'
        :\'<span style="color:var(--fg2);font-size:11px">—</span>\';
      html+=\'<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;max-width:220px"><div style="font-weight:500">\'+ p.nombre+\'</div><div style="font-size:11px;color:var(--fg2)">\'+ p.marca+\' · id \'+p.id+\'</div></td><td style="padding:7px 10px">\'+ linkCell+\'</td><td style="padding:7px 10px;white-space:nowrap">\'+badge+\'</td><td style="padding:7px 10px"><button class="btn-sm btn-edit" onclick="openEdit(\\\'\'+ key+\'\\\')" style="font-size:11px;padding:3px 10px">✏ Editar</button></td></tr>\';
    }
    html+=\'</tbody></table></div>\';
  }
  if(!totalGen&&!totalSinLink){
    body.innerHTML=\'<div style="padding:40px;text-align:center;color:var(--green);font-weight:600;font-size:15px">✅ Todos los productos tienen links específicos. ¡Sin pendientes!</div>\';
    return;
  }
  body.innerHTML=\'<div style="padding:12px 0 4px;color:var(--fg2);font-size:13px">\'+ totalGen+\' links genéricos · \'+totalSinLink+\' sin link en total</div>\'+html;
}

// ── GENERALIZED CATALOG RENDER ───────────────────────────────────────────────
function _colVal(p, col) {
  if (col.sk) return (p.especs||{})[col.sk] ?? null;
  if (col.key === 'enlace') return (p.linkML||p.linkAmz) ? 'con enlace' : null;
  if (col.key === '_edit') return null;
  if (col.key === '_actions') return p.activo === false ? 'Pausado' : 'Activo';
  if (col.key === 'precioML') return p.precioML ? '$'+Math.round(p.precioML).toLocaleString('es-MX') : null;
  if (col.key === 'precioAmz') return p.precioAmz ? '$'+Math.round(p.precioAmz).toLocaleString('es-MX') : null;
  if (col.key === '_updatedAt') {
    if (!p._updatedAt) return null;
    const d = new Date(p._updatedAt);
    return d.toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'});
  }
  return p[col.key] ?? null;
}

function _renderCatTiles(catKey) {
  const prods = DB[catKey] || [];
  const counts = {total:prods.length, actualizado:0, sin_cambio:0, sin_precio:0, no_encontrado:0, precio_sospechoso:0, nuevo:0, pausado:0};
  prods.forEach(p => {
    if (p.activo === false) counts.pausado++;
    if (counts[p.estadoML] !== undefined) counts[p.estadoML]++;
  });
  const TILES = [
    {k:'total',             l:'Total',         cls:'muted', v:counts.total},
    {k:'actualizado',       l:'Actualizados',  cls:'ok',    v:counts.actualizado},
    {k:'sin_cambio',        l:'Sin cambio',    cls:'muted', v:counts.sin_cambio},
    {k:'sin_precio',        l:'Sin precio',    cls:'err',   v:counts.sin_precio},
    {k:'no_encontrado',     l:'No encontrado', cls:'err',   v:counts.no_encontrado},
    {k:'precio_sospechoso', l:'Sospechoso',    cls:'blue',  v:counts.precio_sospechoso},
    {k:'nuevo',             l:'Nuevos ML',     cls:'ok',    v:counts.nuevo},
    {k:'pausado',           l:'Pausados',      cls:'warn',  v:counts.pausado},
  ];
  const el = document.getElementById('ctiles-'+catKey);
  if (!el) return;
  const active = getCatState(catKey).tileFilter;
  el.innerHTML = TILES.map(t => {
    const isOn = active === t.k || (t.k === 'total' && !active);
    return '<div class="tile'+(isOn?' on':'')+'" data-ctile="'+catKey+'" data-ctileval="'+t.k+'" style="min-width:80px;padding:8px 12px"><div class="tile-lbl">'+t.l+'</div><div class="tile-num '+t.cls+'">'+t.v+'</div></div>';
  }).join('');
  el.querySelectorAll('[data-ctile]').forEach(tile => {
    tile.addEventListener('click', () => {
      const cst = getCatState(tile.dataset.ctile);
      const val = tile.dataset.ctileval;
      cst.tileFilter = (cst.tileFilter === val || val === 'total') ? null : val;
      _renderCatTiles(tile.dataset.ctile);
      _renderCatBody(tile.dataset.ctile);
    });
  });
}

function renderCatalog(catKey, container) {
  const def = CATALOG_DEFS[catKey];
  if (!def || !container) return;
  const st = getCatState(catKey);
  const searchId = 'cs-'+catKey;
  const countId  = 'cc-'+catKey;
  const afId     = 'caf-'+catKey;
  const cfId     = 'ccf-'+catKey;
  const theadId  = 'cth-'+catKey;
  const tbodyId  = 'ctb-'+catKey;
  const emptyId  = 'ce-'+catKey;

  const platId = 'cpf-'+catKey;
  if (!container.querySelector('[data-cat-key]')) {
    container.innerHTML =
      '<div class="tiles" id="ctiles-'+catKey+'" style="padding:12px 20px 8px"></div>'+
      '<div class="cat-search"><input id="'+searchId+'" type="search" placeholder="Buscar..."><span id="'+countId+'" style="font-size:12px;color:var(--fg2);white-space:nowrap"></span><button id="'+cfId+'" class="btn-export" style="display:none;background:var(--red);padding:5px 12px;font-size:12px">✕ Filtros</button></div>'+
      '<div style="display:flex;gap:6px;align-items:center;padding:0 20px 8px;flex-wrap:wrap">'+
        '<span style="font-size:11px;color:var(--fg2);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tienda:</span>'+
        '<button class="plat-btn" id="'+platId+'-ml" data-cpcat="'+catKey+'" data-cpplat="ml"><svg width="14" height="14" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#FFE030"/><text x="16" y="22" text-anchor="middle" font-size="13" font-weight="900" font-family="Arial" fill="#333E48">ML</text></svg> Mercado Libre</button>'+
        '<button class="plat-btn" id="'+platId+'-amz" data-cpcat="'+catKey+'" data-cpplat="amz"><svg width="14" height="14" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#FF9900"/><text x="16" y="22" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial" fill="#fff">amz</text></svg> Amazon</button>'+
        '<button class="plat-btn" id="'+platId+'-ambas" data-cpcat="'+catKey+'" data-cpplat="ambas"><svg width="14" height="14" viewBox="0 0 32 32"><rect width="16" height="32" rx="4" fill="#FFE030"/><rect x="16" width="16" height="32" rx="4" fill="#FF9900"/></svg> Ambas</button>'+
      '</div>'+
      '<div id="'+afId+'" style="padding:0 20px 4px;display:flex;gap:4px;flex-wrap:wrap"></div>'+
      '<div class="cat-sel-bar" id="csel-'+catKey+'">'+
        '<span id="csel-cnt-'+catKey+'">0 seleccionados</span>'+
        '<button class="btn-export-sel" id="csel-copy-'+catKey+'">📋 Copiar JSON seleccionados</button>'+
        '<button class="btn-clear-sel" id="csel-clear-'+catKey+'">✕ Deseleccionar</button>'+
      '</div>'+
      '<div class="cat-table-wrap" data-cat-key="'+catKey+'">'+
        '<table><thead><tr id="'+theadId+'"></tr></thead><tbody id="'+tbodyId+'"></tbody></table>'+
        '<div class="empty" id="'+emptyId+'" hidden>Sin resultados.</div>'+
      '</div>';
    container.querySelector('#'+searchId).addEventListener('input', () => {
      getCatState(catKey).search = container.querySelector('#'+searchId).value;
      _renderCatBody(catKey);
    });
    container.querySelector('#'+cfId).addEventListener('click', () => clearCatFilters(catKey));
    container.querySelectorAll('[data-cpcat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = getCatState(catKey);
        const p = btn.dataset.cpplat;
        st.plat = (st.plat === p ? null : p);
        ['ml','amz','ambas'].forEach(id => {
          const el = document.getElementById(platId+'-'+id);
          if (el) el.className = 'plat-btn'+(st.plat===id?' on-'+id:'');
        });
        _renderCatBody(catKey);
      });
    });
    document.getElementById('csel-copy-'+catKey).addEventListener('click', () => _exportCatSelected(catKey));
    document.getElementById('csel-clear-'+catKey).addEventListener('click', () => {
      getCatState(catKey).selected.clear();
      _renderCatBody(catKey);
    });
  }

  container.querySelector('#'+searchId).value = st.search;
  _buildCatThead(catKey);
  _updateCatBadges(catKey);
  _renderCatTiles(catKey);
  _renderCatBody(catKey);
}

function _updateCatSelBar(catKey) {
  const st = getCatState(catKey);
  const bar = document.getElementById('csel-'+catKey);
  const cnt = document.getElementById('csel-cnt-'+catKey);
  if (!bar) return;
  const n = st.selected.size;
  if (n > 0) { bar.classList.add('show'); if(cnt) cnt.textContent = n+' seleccionado'+(n>1?'s':''); }
  else bar.classList.remove('show');
}

function _exportCatSelected(catKey) {
  const st = getCatState(catKey);
  const prods = (DB[catKey]||[]).filter(p => st.selected.has(String(p.id)));
  if (!prods.length) { toast('⚠ Ningún producto seleccionado'); return; }
  const out = {}; out[catKey] = prods;
  navigator.clipboard.writeText(JSON.stringify(out,null,2))
    .then(()=>toast('✓ JSON de '+prods.length+' productos copiado'))
    .catch(()=>{ const ta=document.createElement('textarea');ta.value=JSON.stringify(out,null,2);ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('✓ JSON copiado'); });
}

function _buildCatThead(catKey) {
  const def = CATALOG_DEFS[catKey];
  const tr = document.getElementById('cth-'+catKey);
  if (!tr) return;
  const st = getCatState(catKey);
  const allVis = _catVisibleList(catKey);
  const allSel = allVis.length > 0 && allVis.every(p => st.selected.has(String(p.id)));
  const chkTh = '<th class="chk-col"><input type="checkbox" id="cchk-all-'+catKey+'"'+(allSel?' checked':'')+' title="Seleccionar todos los visibles"></th>';
  tr.innerHTML = chkTh + def.cols.map(col => {
    const active = st.filters[col.key] && st.filters[col.key].size > 0;
    const isSort = st.sortCol === col.key;
    const sortIco = isSort ? (st.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    const lbl = active ? '<span style="color:var(--accent)">'+col.label+sortIco+'</span>' : col.label+sortIco;
    const fBtn = col.filterable
      ? '<button class="col-filter-btn'+(active?' active':'')+'" data-fcat="'+catKey+'" data-fcol="'+col.key+'">▼</button>'
      : '';
    const sortable = col.key !== '_edit' && col.key !== 'enlace';
    const thStyle = sortable ? ' style="cursor:pointer;user-select:none"' : '';
    return '<th data-col="'+col.key+'"'+(sortable?' data-sortcat="'+catKey+'" data-sortcol="'+col.key+'"':'')+thStyle+'>'+lbl+fBtn+'</th>';
  }).join('');
  tr.onclick = e => {
    const fBtn = e.target.closest('[data-fcat]');
    if (fBtn) { openCatFilter(e, fBtn.dataset.fcat, fBtn.dataset.fcol); return; }
    const th = e.target.closest('[data-sortcat]');
    if (th) {
      const cst = getCatState(th.dataset.sortcat);
      if (cst.sortCol === th.dataset.sortcol) cst.sortDir = cst.sortDir === 'asc' ? 'desc' : 'asc';
      else { cst.sortCol = th.dataset.sortcol; cst.sortDir = 'asc'; }
      _buildCatThead(th.dataset.sortcat);
      _renderCatBody(th.dataset.sortcat);
    }
  };
  const chkAll = document.getElementById('cchk-all-'+catKey);
  if (chkAll) chkAll.addEventListener('change', () => {
    const vis = _catVisibleList(catKey);
    if (chkAll.checked) vis.forEach(p => getCatState(catKey).selected.add(String(p.id)));
    else vis.forEach(p => getCatState(catKey).selected.delete(String(p.id)));
    _renderCatBody(catKey);
  });
}

function openCatFilter(evt, catKey, colKey) {
  evt.stopPropagation();
  closeCatDropdown();
  const def = CATALOG_DEFS[catKey];
  if (!def) return;
  const col = def.cols.find(c => c.key === colKey);
  if (!col) return;
  const prods = (DB[catKey]||[]);
  const vals = [...new Set(prods.map(p => _colVal(p, col)).filter(v => v != null).map(String))].sort((a,b) => {
    const na=parseFloat(a), nb=parseFloat(b);
    return (!isNaN(na)&&!isNaN(nb)) ? na-nb : a.localeCompare(b,'es-MX');
  });
  const st = getCatState(catKey);
  const active = st.filters[colKey]; // undefined = sin filtro (todos); Set = filtro activo
  const allChk = !active; // solo true cuando no hay filtro, no cuando el Set está vacío
  const dd = document.createElement('div');
  dd.className = 'filter-dropdown'; dd.id = 'cat-dd';
  dd.innerHTML =
    '<div class="fd-item"><input type="checkbox" id="fd-all"'+(allChk?' checked':'')+' data-fdtype="all"> <label for="fd-all" style="cursor:pointer;font-weight:600">(Todos)</label></div>'
    + vals.map((v,i) => '<div class="fd-item"><input type="checkbox" id="fd-v'+i+'"'+((!active||active.has(v))?'  checked':'')+' data-fdtype="val" data-val="'+v.replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'"> <label for="fd-v'+i+'" style="cursor:pointer">'+v+'</label></div>').join('')
    + '<div class="fd-footer"><button data-fdtype="clear">Limpiar</button><button class="fd-apply" data-fdtype="ok">OK</button></div>';
  dd.addEventListener('change', e => {
    const inp = e.target;
    if (inp.dataset.fdtype === 'all') { toggleCatFilterAll(catKey, colKey, inp.checked); }
    else if (inp.dataset.fdtype === 'val') { toggleCatFilterVal(catKey, colKey, inp, vals); }
  });
  dd.addEventListener('click', e => {
    const btn = e.target.closest('button[data-fdtype]');
    if (!btn) return;
    if (btn.dataset.fdtype === 'clear') { clearOneCatFilter(catKey, colKey); }
    else if (btn.dataset.fdtype === 'ok') { closeCatDropdown(); }
  });
  document.body.appendChild(dd);
  const btn = evt.target.closest('[data-fcat]') || evt.target;
  const rect = btn.getBoundingClientRect();
  dd.style.top  = Math.min(rect.bottom+4, window.innerHeight-dd.offsetHeight-8)+'px';
  dd.style.left = Math.max(0, Math.min(rect.left, window.innerWidth-270))+'px';
  setTimeout(() => document.addEventListener('click', _closeDDHandler, {once:true}), 0);
}
function _closeDDHandler(e) { if (!e.target.closest('#cat-dd')) closeCatDropdown(); }
function closeCatDropdown() { document.getElementById('cat-dd')?.remove(); }

function toggleCatFilterAll(catKey, colKey, isChecked) {
  const st = getCatState(catKey);
  if (isChecked) {
    // Seleccionar todos → quitar filtro
    delete st.filters[colKey];
    document.querySelectorAll('#cat-dd input[data-fdtype="val"]').forEach(cb => cb.checked = true);
  } else {
    // Deseleccionar todos → filtro vacío (ninguna fila pasa)
    st.filters[colKey] = new Set();
    document.querySelectorAll('#cat-dd input[data-fdtype="val"]').forEach(cb => cb.checked = false);
  }
  _applyCatFilters(catKey);
}
function toggleCatFilterVal(catKey, colKey, cb, allVals) {
  const st = getCatState(catKey);
  // Si no hay filtro activo, empezar con todos seleccionados menos el que se desmarca
  if (!st.filters[colKey]) {
    st.filters[colKey] = new Set(allVals.map(String));
  }
  if (cb.checked) st.filters[colKey].add(cb.dataset.val);
  else st.filters[colKey].delete(cb.dataset.val);
  // Si todos seleccionados → quitar filtro (equivale a Todos)
  if (st.filters[colKey].size === allVals.length) delete st.filters[colKey];
  const allEl = document.getElementById('fd-all');
  if (allEl) allEl.checked = !st.filters[colKey];
  _applyCatFilters(catKey);
}
function clearOneCatFilter(catKey, colKey) {
  const st = getCatState(catKey);
  delete st.filters[colKey];
  _applyCatFilters(catKey);
  closeCatDropdown();
}
function clearCatFilters(catKey) {
  const st = getCatState(catKey);
  st.filters = {};
  _buildCatThead(catKey);
  _updateCatBadges(catKey);
  _renderCatBody(catKey);
}
function _applyCatFilters(catKey) {
  _buildCatThead(catKey);
  _updateCatBadges(catKey);
  _renderCatBody(catKey);
}
function _updateCatBadges(catKey) {
  const def = CATALOG_DEFS[catKey];
  const st = getCatState(catKey);
  const entries = Object.entries(st.filters).filter(([,v]) => v.size > 0);
  const cfEl = document.getElementById('ccf-'+catKey);
  const afEl = document.getElementById('caf-'+catKey);
  if (cfEl) cfEl.style.display = entries.length ? '' : 'none';
  if (afEl) {
    afEl.innerHTML = entries.map(([k,vals]) => {
      const col = def?.cols.find(c => c.key === k);
      return '<span class="cat-filter-badge">'+(col?.label||k)+': '+[...vals].join(', ')
        +'<button data-badgecat="'+catKey+'" data-badgecol="'+k+'">✕</button></span>';
    }).join('');
    afEl.querySelectorAll('button[data-badgecat]').forEach(btn => {
      btn.addEventListener('click', () => clearOneCatFilter(btn.dataset.badgecat, btn.dataset.badgecol));
    });
  }
}

function _catVisibleList(catKey) {
  const def = CATALOG_DEFS[catKey];
  if (!def) return [];
  const st = getCatState(catKey);
  let list = (DB[catKey]||[]);
  if (st.tileFilter === 'pausado') list = list.filter(p => p.activo === false);
  else if (st.tileFilter) list = list.filter(p => p.estadoML === st.tileFilter);
  if (st.search) {
    const q = st.search.toLowerCase();
    list = list.filter(p => (p.nombre+' '+p.marca).toLowerCase().includes(q));
  }
  if (st.plat === 'ml')    list = list.filter(p => p.linkML);
  if (st.plat === 'amz')   list = list.filter(p => p.linkAmz);
  if (st.plat === 'ambas') list = list.filter(p => p.linkML && p.linkAmz);
  for (const [k, vals] of Object.entries(st.filters)) {
    if (!vals.size) continue;
    const col = def.cols.find(c => c.key === k);
    if (!col) continue;
    list = list.filter(p => { const v = _colVal(p, col); return v != null && vals.has(String(v)); });
  }
  if (st.sortCol) {
    const col = def.cols.find(c => c.key === st.sortCol);
    const dir = st.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      // Para _updatedAt comparar ISO directamente (orden cronológico exacto)
      if (st.sortCol === '_updatedAt') {
        const av = a._updatedAt || '';
        const bv = b._updatedAt || '';
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      const av = col ? _colVal(a, col) : (a[st.sortCol] ?? '');
      const bv = col ? _colVal(b, col) : (b[st.sortCol] ?? '');
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const na = parseFloat(av), nb = parseFloat(bv);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(av).localeCompare(String(bv), 'es-MX') * dir;
    });
  }
  return list;
}

function _renderCatBody(catKey) {
  const def = CATALOG_DEFS[catKey];
  if (!def) return;
  const tb    = document.getElementById('ctb-'+catKey);
  const ccEl  = document.getElementById('cc-'+catKey);
  const emEl  = document.getElementById('ce-'+catKey);
  if (!tb) return;

  const st = getCatState(catKey);
  const list = _catVisibleList(catKey);

  if (ccEl) ccEl.textContent = list.length+' '+def.label;
  if (emEl) emEl.hidden = list.length > 0;

  const ESTADO = {actualizado:'✓',sin_cambio:'=',sin_precio:'✗',no_encontrado:'✗',precio_sospechoso:'?',nuevo:'★'};
  const ECLS = {actualizado:'b-actualizado',sin_cambio:'b-sin_cambio',sin_precio:'b-sin_precio',no_encontrado:'b-no_encontrado',precio_sospechoso:'b-precio_sospechoso',nuevo:'b-nuevo'};
  const sp = v => v ? '<span class="spec-chip">'+v+'</span>' : '<span class="spec-null">—</span>';

  tb.innerHTML = list.map(p => {
    const e = p.especs||{};
    const key = catKey+'|'+p.id;
    const isSel = st.selected.has(String(p.id));
    const rowStyle = isSel ? ' class="selected"' : (p.activo===false ? ' style="opacity:.45;background:var(--gray-light)"' : '');
    const chkCell = '<td class="chk-col"><input type="checkbox" data-catsel="'+catKey+'" data-catid="'+p.id+'"'+(isSel?' checked':'')+' style="cursor:pointer"></td>';
    const cells = chkCell + def.cols.map(col => {
      if (col.key === '_actions') {
        const paused = p.activo === false;
        const pa = paused
          ? '<button class="btn-sm" style="color:#fff;background:var(--yellow);border-color:var(--yellow);font-size:10px;padding:3px 8px" data-catact="play"  data-key="'+key+'" title="Pausado — clic para activar">⏸ Pausado</button>'
          : '<button class="btn-sm" style="color:#fff;background:var(--green);border-color:var(--green);font-size:10px;padding:3px 8px"  data-catact="pause" data-key="'+key+'" title="Activo — clic para pausar">● Activo</button>';
        return '<td>'+pa+'</td>';
      }
      if (col.key === '_edit') {
        return '<td><button class="btn-sm btn-edit" data-catact="edit" data-key="'+key+'">✏ Editar</button></td>';
      }
      if (col.key === 'precioML') return '<td class="precio-col">'+(p.precioML?' <span class="precio-ml">$'+Math.round(p.precioML).toLocaleString('es-MX')+'</span>':' <span class="spec-null">—</span>')+'</td>';
      if (col.key === 'precioAmz') return '<td class="precio-col">'+(p.precioAmz?' <span class="precio-amz">$'+Math.round(p.precioAmz).toLocaleString('es-MX')+'</span>' : '<span class="spec-null">—</span>')+'</td>';
      if (col.key === 'enlace'){
        const lml = p.linkML ? '<a class="link-chip lc-ml" href="'+p.linkML+'" target="_blank" rel="noopener">ML↗</a>' : '';
        const lamz = p.linkAmz ? '<a class="link-chip lc-amz" href="'+p.linkAmz+'" target="_blank" rel="noopener">AMZ↗</a>' : '';
        return '<td style="white-space:nowrap">'+(lml||lamz?lml+lamz:'<span class="spec-null">—</span>')+'</td>';
      }
      if (col.key === 'estadoML') {
        const est = p.estadoML ? '<span class="badge '+(ECLS[p.estadoML]||' b-null ')+'">'+( ESTADO[p.estadoML]||p.estadoML)+'</span>' : '<span class="spec-null">—</span>';
        return '<td>'+est+'</td>';
      }
      if (col.key === '_updatedAt') return '<td>'+(p._updatedAt?' <span style="font-size:11px;white-space:nowrap;color:var(--fg2)">'+fmtDate(p._updatedAt)+'</span>' : '<span class="spec-null">—</span>')+'</td>';
      if (col.key === 'nombre') return '<td style="max-width:200px;white-space:normal;font-size:12px">'+p.nombre+'</td>';
      if (col.key === 'marca') return '<td>'+p.marca+'</td>';
      if (col.sk) return '<td>'+sp(e[col.sk])+'</td>';
      return '<td>'+sp(p[col.key])+'</td>';
    }).join('');
    return '<tr'+rowStyle+'>'+cells+'</tr>';
  }).join('');

  tb.onclick = e => {
    const btn = e.target.closest('[data-catact]');
    if (btn) {
      const act = btn.dataset.catact, k = btn.dataset.key;
      if (act === 'pause' || act === 'play') toggleActivo(k);
      else if (act === 'edit') openEdit(k);
      return;
    }
    const chk = e.target.closest('[data-catsel]');
    if (chk) {
      const cst = getCatState(chk.dataset.catsel);
      if (chk.checked) cst.selected.add(String(chk.dataset.catid));
      else cst.selected.delete(String(chk.dataset.catid));
      _updateCatSelBar(chk.dataset.catsel);
      _buildCatThead(chk.dataset.catsel);
      // update row highlight without full re-render
      const row = chk.closest('tr');
      if (row) { if(chk.checked) row.classList.add('selected'); else row.classList.remove('selected'); }
    }
  };
  _updateCatSelBar(catKey);
  _buildCatThead(catKey);
}
<\/script>`;

// Split the page at the data boundary for self-republishing
const splitIdx = html.indexOf(SPLIT_MARK) + SPLIT_MARK.length;
const pa = html.slice(0, splitIdx);
const pb = html.slice(splitIdx + data.length);
const paB64 = Buffer.from(pa, 'utf8').toString('base64');
const pbB64 = Buffer.from(pb, 'utf8').toString('base64');
const finalHtml = html
  + `\n<script id="_srca" type="text/plain">${paB64}<\/script>`
  + `\n<script id="_srcb" type="text/plain">${pbB64}<\/script>`;

writeFileSync(resolve(ROOT, 'scripts/admin-artifact.html'), finalHtml, 'utf8');
console.log('admin-artifact.html generado:', finalHtml.length, 'chars');

