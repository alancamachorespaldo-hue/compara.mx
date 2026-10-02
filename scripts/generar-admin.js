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

// Base64-encode the JSON to avoid any HTML/JS parse issues (&, <, >, quotes, etc.)
const jsonRaw = JSON.stringify(JSON.parse(readFileSync(adminPath, 'utf8')));
const data = Buffer.from(jsonRaw, 'utf8').toString('base64');
// Marker used to split the page source for self-republishing
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
.stats{display:flex;gap:8px;flex-wrap:wrap}
.stat{background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:4px 10px;font-size:11px;color:var(--fg2)}
.stat b{font-size:15px;font-weight:700;display:block;line-height:1.2}
.stat.red b{color:var(--red)}.stat.yellow b{color:var(--yellow)}.stat.green b{color:var(--green)}
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
tbody tr.selected:hover{background:var(--accent-light)}
.sel-bar{display:none;align-items:center;gap:10px;padding:8px 20px;background:var(--accent-light);border-bottom:1px solid var(--border);font-size:13px;color:var(--accent);font-weight:600}
.sel-bar.show{display:flex}
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
.modal-bd{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:var(--surface);border-radius:12px;padding:24px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.modal h2{font-size:15px;font-weight:700;margin-bottom:4px}
.modal .sub{font-size:12px;color:var(--fg2);margin-bottom:14px}
.modal label{display:block;font-size:11px;font-weight:600;color:var(--fg2);margin-bottom:3px;margin-top:10px;text-transform:uppercase;letter-spacing:.05em}
.modal input{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--fg);font-size:13px;outline:none;font-family:monospace}
.modal input:focus{border-color:var(--accent)}
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
.tab-bar{display:flex;gap:0;border-bottom:2px solid var(--border);background:var(--surface);padding:0 20px;position:sticky;top:env(safe-area-inset-top,0px);z-index:99}
.tab-btn{padding:10px 18px;font-size:13px;font-weight:600;color:var(--fg2);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap}
.tab-btn:hover{color:var(--fg)}
.tab-btn.on{color:var(--accent);border-bottom-color:var(--accent)}
.tab-section{display:none}
.tab-section.on{display:block}
/* Catálogo table */
.cat-search{padding:10px 20px 6px;display:flex;gap:8px;align-items:center}
.cat-search input{flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--fg);font-size:13px;outline:none}
.cat-search input:focus{border-color:var(--accent)}
.spec-chip{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;background:var(--blue-light);color:var(--blue);font-weight:500;white-space:nowrap}
.spec-null{color:var(--fg2);font-size:11px}
.precio-col{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.precio-ml{color:var(--blue)}
.precio-amz{color:#b45309}
/* Catalog sticky header */
#cat-table-container{overflow:auto;max-height:calc(100vh - 170px)}
#cat-table thead th{position:sticky;top:0;z-index:5;background:var(--surface);box-shadow:0 1px 0 var(--border)}
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
    <button class="btn-export" style="background:var(--blue)" onclick="openAddModal()">＋ Agregar</button>
  </div>
</div>
<div class="tab-bar">
  <button class="tab-btn on" data-tab="gestion">⚙ Gestión</button>
  <button class="tab-btn" data-tab="catalogo">📋 Catálogo Laptops</button>
</div>
<div id="tab-gestion" class="tab-section on">
<div class="info-row">
  ℹ️ Haz cambios y copia el JSON con el botón verde → pégalo en <strong>scripts/productos.json</strong> en GitHub. El Action lo aplica automáticamente.
</div>
<div class="tiles" id="tiles"></div>
<div class="controls">
  <div class="cats" id="cats"></div>
  <div class="filters">
    <button class="filter-btn" id="f-sinprecio" onclick="toggleFilter('sinprecio')">🔴 Sin precio ML</button>
    <button class="filter-btn" id="f-noencontrado" onclick="toggleFilter('noencontrado')">✗ No producto encontrado</button>
    <button class="filter-btn" id="f-pausados" onclick="toggleFilter('pausados')">⏸ Pausados</button>
    <button class="filter-btn" id="f-sinlink" onclick="toggleFilter('sinlink')">🔗 Sin links</button>
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
  <button class="btn-export-sel" onclick="exportJSON(true)">📋 Copiar JSON de seleccionados</button>
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

</div><!-- /tab-gestion -->

<div id="tab-catalogo" class="tab-section">
  <div class="cat-search">
    <input id="cat-search" type="search" placeholder="Buscar laptop…" oninput="renderCatalogo()">
    <span id="cat-count" style="font-size:12px;color:var(--fg2);white-space:nowrap"></span>
    <button id="cat-clear-filters" class="btn-export" style="display:none;background:var(--red);padding:5px 12px;font-size:12px" onclick="clearCatFilters()">✕ Filtros</button>
  </div>
  <div id="cat-active-filters" style="padding:0 20px 4px;display:flex;gap:4px;flex-wrap:wrap"></div>
  <div class="table-wrap" style="padding:0 20px">
    <div id="cat-table-container">
      <table id="cat-table">
        <thead><tr id="cat-thead-row"></tr></thead>
        <tbody id="cat-tbody"></tbody>
      </table>
      <div class="empty" id="cat-empty" hidden>Sin resultados.</div>
    </div>
  </div>
</div>

<div class="modal-bd" id="modal" hidden>
  <div class="modal">
    <h2 id="m-title">Editar producto</h2>
    <div class="sub" id="m-sub"></div>
    <label>Link Mercado Libre</label>
    <input id="ed-ml" type="url" placeholder="https://www.mercadolibre.com.mx/… (dejar vacío para quitar)">
    <label>Precio ML (MXN) — dejar vacío para quitar</label>
    <input id="ed-pml" type="number" min="0" step="0.01" placeholder="Ej. 4999">
    <label>Link Amazon (debe incluir ?tag=comparabici-20)</label>
    <input id="ed-amz" type="url" placeholder="https://www.amazon.com.mx/dp/…?tag=comparabici-20">
    <label>Precio Amazon (MXN) — dejar vacío para quitar</label>
    <input id="ed-pamz" type="number" min="0" step="0.01" placeholder="Ej. 5299">
    <div class="del-confirm" id="del-confirm" hidden>
      ¿Eliminar este producto del registro?
      <button class="btn-yes" onclick="confirmDelete()">Sí, eliminar</button>
      <button class="btn-no" onclick="document.getElementById('del-confirm').hidden=true">No</button>
    </div>
    <div class="modal-footer">
      <button class="btn-del-sm" onclick="showDelConfirm()">🗑 Eliminar</button>
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" onclick="saveEdit()">Guardar</button>
    </div>
  </div>
</div>

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
    <label>Link Amazon (con ?tag=comparabici-20)</label>
    <input id="add-amz" type="url" placeholder="https://www.amazon.com.mx/dp/…?tag=comparabici-20">
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
  // Solo usar localStorage si fue guardado DESPUÉS de que se generó este artifact
  if (s && ts && ts > BUILT_AT) { DB = JSON.parse(s); }
  else if (s && ts && ts <= BUILT_AT) {
    // Artifact más nuevo: limpiar localStorage stale
    localStorage.removeItem('admin_db'); localStorage.removeItem('admin_db_ts');
  }
} catch(e) {}
let activeCat = 'todas';
let activeFilters = new Set();
let activeTile = null;
let activePlat = null;
let editKey = null;
let selected = new Set();

function allProds() {
  return Object.entries(DB).flatMap(([cat, prods]) => prods.map(p => ({...p, _cat: cat, _key: cat+'|'+p.id})));
}
function visibleProds() {
  const src = activeCat === 'todas' ? allProds() : (DB[activeCat]||[]).map(p => ({...p, _cat: activeCat, _key: activeCat+'|'+p.id}));
  const q = document.getElementById('search').value.toLowerCase();
  return src.filter(p => {
    if (q && !(p.nombre+' '+p.marca).toLowerCase().includes(q)) return false;
    if (activeTile && activeTile !== 'todas') {
      if (activeTile === 'sin_cambio' && p.estadoML !== 'sin_cambio') return false;
      else if (activeTile === 'actualizado' && p.estadoML !== 'actualizado') return false;
      else if (activeTile === 'sin_precio' && p.estadoML !== 'sin_precio') return false;
      else if (activeTile === 'no_encontrado' && p.estadoML !== 'no_encontrado') return false;
      else if (activeTile === 'precio_sospechoso' && p.estadoML !== 'precio_sospechoso') return false;
      else if (activeTile === 'nuevo' && p.estadoML !== 'nuevo') return false;
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
  document.getElementById('cats').innerHTML = ['todas',...Object.keys(DB)].map(c =>
    '<button class="cat-btn'+(c===activeCat?' on':'')+'" data-cat="'+c+'">'+(c==='todas'?'Todas':c.charAt(0).toUpperCase()+c.slice(1))+'</button>'
  ).join('');
  document.querySelectorAll('.cat-btn[data-cat]').forEach(el => el.onclick = () => setCat(el.dataset.cat));
}

function render() {
  const prods = visibleProds();
  const tb = document.getElementById('tbody');
  document.getElementById('empty').hidden = prods.length > 0;
  if (!prods.length) { tb.innerHTML=''; return; }
  const ESTADO = {actualizado:'✓ Actualizado',sin_cambio:'= Sin cambio',sin_precio:'✗ Sin precio',no_encontrado:'✗ No producto encontrado',precio_sospechoso:'? Sospechoso',nuevo:'★ Nuevo'};
  tb.innerHTML = prods.map(p => {
    const ecls = p.estadoML ? ('b-'+p.estadoML) : 'b-null';
    const elab = ESTADO[p.estadoML] || '— Sin ML';
    const lml = p.linkML ? '<a class="link-chip lc-ml" href="'+p.linkML+'" target="_blank" rel="noopener">ML↗</a>' : '<span class="link-chip lc-none">Sin ML</span>';
    const lamz = p.linkAmz ? '<a class="link-chip lc-amz" href="'+p.linkAmz+'" target="_blank" rel="noopener">AMZ↗</a>' : (p.estadoML==='nuevo' ? '<span class="link-chip lc-amz-pending">⚠ Sin AMZ</span>' : '<span class="link-chip lc-none">Sin AMZ</span>');
    const paBtn = p.activo!==false
      ? '<button class="btn-sm btn-pause" data-act="pause" data-key="'+p._key+'">⏸ Pausar</button>'
      : '<button class="btn-sm btn-play" data-act="play" data-key="'+p._key+'">▶ Activar</button>';
    const pml = p.precioML ? '<span style="font-size:11px;color:var(--fg2)">ML </span>$'+Math.round(p.precioML).toLocaleString('es-MX') : '';
    const pamz = p.precioAmz ? '<span style="font-size:11px;color:var(--fg2)">'+(pml?' AMZ ':' AMZ ')+'</span>$'+Math.round(p.precioAmz).toLocaleString('es-MX') : '';
    const precio = (pml||pamz) ? (pml+(pml&&pamz?'<br>':'')+pamz) : '—';
    const upd = p._updatedAt ? fmtDate(p._updatedAt) : '<span style="color:var(--fg2)">—</span>';
    const isSel = selected.has(p._key);
    return '<tr class="'+(p.activo===false?'pausado':'')+(isSel?' selected':'')+'"><td class="chk-col"><input type="checkbox" data-act="chk" data-key="'+p._key+'"'+(isSel?' checked':'')+' style="cursor:pointer;width:15px;height:15px"></td><td class="nombre-col">'+p.nombre+'</td><td>'+p.marca+'</td><td><span class="badge '+ecls+'">'+elab+'</span></td><td>'+lml+lamz+'</td><td style="font-variant-numeric:tabular-nums">'+precio+'</td><td style="font-size:11px;white-space:nowrap;color:var(--fg2)">'+upd+'</td><td><div class="actions">'+paBtn+'<button class="btn-sm btn-edit" data-act="edit" data-key="'+p._key+'">✏ Editar</button></div></td></tr>';
  }).join('');
}

function fmtDate(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}

document.getElementById('tbody').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const key = btn.dataset.key;
  if (btn.dataset.act === 'edit') openEdit(key);
  else if (btn.dataset.act === 'pause' || btn.dataset.act === 'play') toggleActivo(key);
  else if (btn.dataset.act === 'chk') {
    if (btn.checked) selected.add(key); else selected.delete(key);
    btn.closest('tr').classList.toggle('selected', btn.checked);
    updateSelBar();
  }
});
document.getElementById('chk-all').addEventListener('change', e => {
  const vis = visibleProds();
  if (e.target.checked) vis.forEach(p => selected.add(p._key));
  else vis.forEach(p => selected.delete(p._key));
  render(); updateSelBar();
});
function updateSelBar(){
  const n = selected.size;
  const bar = document.getElementById('sel-bar');
  bar.classList.toggle('show', n > 0);
  document.getElementById('sel-count').textContent = n + ' producto'+(n!==1?'s':'')+' seleccionado'+(n!==1?'s':'');
  document.getElementById('chk-all').checked = n > 0 && visibleProds().every(p => selected.has(p._key));
  document.getElementById('chk-all').indeterminate = n > 0 && !visibleProds().every(p => selected.has(p._key));
}
function clearSelection(){ selected.clear(); render(); updateSelBar(); }
function selectVisible(){ visibleProds().forEach(p=>selected.add(p._key)); render(); updateSelBar(); }

function encodeDB(){
  const bytes=new TextEncoder().encode(JSON.stringify(DB));
  let bin='';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function autoSave(){
  try{localStorage.setItem('admin_db',JSON.stringify(DB));localStorage.setItem('admin_db_ts',new Date().toISOString());}catch(e){}
  document.getElementById('save-status').textContent='● Sin guardar';
}
function toB64(str){
  const bytes=new TextEncoder().encode(str);
  let bin='';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64){
  return new TextDecoder().decode(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
}
async function saveState(){
  const btn=document.getElementById('btn-save');
  btn.disabled=true;btn.textContent='💾 Guardando…';
  try{
    const artifact=await claude.use('artifact');
    if(!artifact){toast('⚠ Guardar no disponible — usa Copiar JSON como respaldo');btn.disabled=false;btn.textContent='💾 Guardar';return;}
    const newB64=encodeDB();
    const pa=fromB64(document.getElementById('_srca').textContent);
    const pb=fromB64(document.getElementById('_srcb').textContent);
    const tags='\\n<script id="_srca" type="text/plain">'+toB64(pa)+'<\\/script>\\n<script id="_srcb" type="text/plain">'+toB64(pb)+'<\\/script>';
    const content=pa+newB64+pb+tags;
    const SKEL='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#f8f9fa}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
    await artifact.publish(SKEL+content+'</body></html>');
    try{localStorage.removeItem('admin_db');}catch(e){}
    document.getElementById('save-status').textContent='✓ Guardado';
    toast('✅ Guardado — la página se actualizará con tus cambios');
  }catch(e){
    toast('⚠ Error al guardar: '+(e.message||String(e)));
    btn.disabled=false;btn.textContent='💾 Guardar';
  }
}

function setCat(c){ activeCat=c; renderCats(); render(); }
function setTile(k){ activeTile=(activeTile===k?null:k); renderStats(); render(); }
function setPlat(p){
  activePlat=(activePlat===p?null:p);
  ['ml','amz','ambas'].forEach(id=>{
    const btn=document.getElementById('pb-'+id);
    btn.className='plat-btn'+(activePlat===id?' on-'+id:'');
  });
  render();
}
document.querySelectorAll('.plat-btn[data-plat]').forEach(el=>el.addEventListener('click',()=>setPlat(el.dataset.plat)));
function toggleFilter(f){
  activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);
  document.getElementById('f-'+f).classList.toggle('on');
  render();
}
function toggleActivo(key){
  const [cat,id]=key.split('|');
  const p=DB[cat]&&DB[cat].find(p=>String(p.id)===id);
  if(!p)return;
  p.activo=(p.activo===false);
  p._updatedAt=new Date().toISOString();
  renderStats(); render(); autoSave();
  toast(p.activo?'▶ Producto activado':'⏸ Producto pausado');
}
function openEdit(key){
  editKey=key;
  const [cat,id]=key.split('|');
  const p=DB[cat]&&DB[cat].find(p=>String(p.id)===id);
  if(!p){toast('⚠ Producto no encontrado');return;}
  document.getElementById('m-title').textContent='Editar · '+p.nombre;
  document.getElementById('m-sub').textContent=cat+' · id '+p.id;
  document.getElementById('ed-ml').value=p.linkML||'';
  document.getElementById('ed-pml').value=p.precioML||'';
  document.getElementById('ed-amz').value=p.linkAmz||'';
  document.getElementById('ed-pamz').value=p.precioAmz||'';
  document.getElementById('del-confirm').hidden=true;
  document.getElementById('modal').hidden=false;
}
function saveEdit(){
  if(!editKey)return;
  const [cat,id]=editKey.split('|');
  const p=DB[cat].find(p=>String(p.id)===id);
  p.linkML=document.getElementById('ed-ml').value.trim()||null;
  p.precioML=parseFloat(document.getElementById('ed-pml').value)||null;
  p.linkAmz=document.getElementById('ed-amz').value.trim()||null;
  p.precioAmz=parseFloat(document.getElementById('ed-pamz').value)||null;
  p._updatedAt=new Date().toISOString();
  closeModal(); renderStats(); render(); autoSave(); toast('✓ Producto actualizado');
}
function showDelConfirm(){document.getElementById('del-confirm').hidden=false;}
function confirmDelete(){
  if(!editKey)return;
  const [cat,id]=editKey.split('|');
  DB[cat]=DB[cat].filter(p=>String(p.id)!==id);
  closeModal(); renderStats(); render(); autoSave(); toast('🗑 Producto eliminado del registro');
}
function closeModal(){
  document.getElementById('modal').hidden=true;
  document.getElementById('del-confirm').hidden=true;
  editKey=null;
}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});

function exportJSON(onlySelected){
  const out={};
  for(const [cat,prods] of Object.entries(DB)){
    const filtrados = onlySelected
      ? prods.filter(p => selected.has(cat+'|'+p.id))
      : prods;
    if(filtrados.length===0) continue;
    out[cat]=filtrados.map(({id,nombre,marca,linkML,linkAmz,mlId,precioML,precioAmz,activo})=>({id,nombre,marca,linkML:linkML||null,linkAmz:linkAmz||null,mlId:mlId||null,precioML:precioML||null,precioAmz:precioAmz||null,activo:activo!==false}));
  }
  const json=JSON.stringify(out,null,2);
  const msg = onlySelected
    ? '✓ JSON de '+selected.size+' productos copiado — pégalo en scripts/productos.json en GitHub'
    : '✓ JSON completo copiado — pégalo en scripts/productos.json en GitHub';
  navigator.clipboard.writeText(json).then(()=>toast(msg)).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=json;ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    toast(msg);
  });
}

function openAddModal(){
  const sel=document.getElementById('add-cat');
  sel.innerHTML=Object.keys(DB).map(c=>'<option value="'+c+'">'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>').join('');
  ['add-nombre','add-marca','add-ml','add-amz'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('add-modal').hidden=false;
}
function closeAddModal(){document.getElementById('add-modal').hidden=true;}
function saveAdd(){
  const cat=document.getElementById('add-cat').value;
  const nombre=document.getElementById('add-nombre').value.trim();
  const marca=document.getElementById('add-marca').value.trim();
  const linkML=document.getElementById('add-ml').value.trim()||null;
  const linkAmz=document.getElementById('add-amz').value.trim()||null;
  if(!nombre||!marca){toast('⚠ Nombre y marca son obligatorios');return;}
  const ids=DB[cat].map(p=>p.id).filter(x=>typeof x==='number');
  const newId=ids.length?Math.max(...ids)+1:1;
  DB[cat].push({id:newId,nombre,marca,linkML,linkAmz,mlId:null,precioML:null,precioAmz:null,activo:true,estadoML:null});
  closeAddModal(); renderStats(); renderCats(); render(); autoSave();
  toast('✓ Producto agregado a '+cat);
}
document.getElementById('add-modal').addEventListener('click',e=>{if(e.target===document.getElementById('add-modal'))closeAddModal();});

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3000);
}

renderStats(); renderCats(); render();

// ── Tabs ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('on');
    if (btn.dataset.tab === 'catalogo') renderCatalogo();
  });
});

// ── Catálogo Laptops ─────────────────────────────────────────────────────────
const CAT_COLS = [
  {key:'precioML',      label:'Precio ML',       filterable:false},
  {key:'precioAmz',     label:'Precio AMZ',      filterable:false},
  {key:'enlace',        label:'Enlace',          filterable:false},
  {key:'marca',         label:'Marca',           filterable:true},
  {key:'nombre',        label:'Nombre',          filterable:false},
  {key:'procesador',    label:'Procesador',      filterable:true,  specsKey:'procesador'},
  {key:'ram',           label:'RAM',             filterable:true,  specsKey:'ram'},
  {key:'almacenamiento',label:'Almacenamiento',  filterable:true,  specsKey:'almacenamiento'},
  {key:'pantalla',      label:'Pantalla',        filterable:true,  specsKey:'pantalla'},
  {key:'gpu',           label:'GPU',             filterable:false, specsKey:'gpu'},
  {key:'so',            label:'SO',              filterable:true,  specsKey:'so'},
  {key:'peso',          label:'Peso',            filterable:false, specsKey:'peso'},
  {key:'touch',         label:'Touch',           filterable:true,  specsKey:'touch'},
  {key:'estadoML',      label:'Estado',          filterable:true},
  {key:'_updatedAt',    label:'Últ. Mod.',       filterable:false},
];
let catFilters = {};

function _catColVal(p, col) {
  if (col.specsKey) return (p.especs||{})[col.specsKey] ?? null;
  if (col.key === 'enlace') return (p.linkML||p.linkAmz) ? 'con enlace' : null;
  return p[col.key] ?? null;
}

function buildCatThead() {
  const tr = document.getElementById('cat-thead-row');
  if (!tr) return;
  tr.innerHTML = CAT_COLS.map(col => {
    const active = catFilters[col.key] && catFilters[col.key].size > 0;
    const lbl = active ? '<span style="color:var(--accent)">'+col.label+'</span>' : col.label;
    const fBtn = col.filterable
      ? '<button class="col-filter-btn'+(active?' active':'')+'" onclick="openCatFilter(event,\\''+col.key+'\\')" title="Filtrar columna">▼</button>'
      : '';
    return '<th data-col="'+col.key+'">'+lbl+fBtn+'</th>';
  }).join('');
}

function openCatFilter(evt, colKey) {
  evt.stopPropagation();
  closeCatDropdown();
  const col = CAT_COLS.find(c => c.key === colKey);
  if (!col) return;
  const laptops = (DB.laptops || []).filter(p => p.activo !== false);
  const vals = [...new Set(laptops.map(p => _catColVal(p, col)).filter(v => v != null).map(String))].sort((a,b) => {
    const na=parseFloat(a), nb=parseFloat(b);
    return (!isNaN(na)&&!isNaN(nb)) ? na-nb : a.localeCompare(b,'es-MX');
  });
  const active = catFilters[colKey] || new Set();
  const allChk = active.size === 0;
  const dd = document.createElement('div');
  dd.className = 'filter-dropdown'; dd.id = 'cat-dd';
  dd.innerHTML =
    '<div class="fd-item"><input type="checkbox" id="fd-all"'+(allChk?' checked':'')+' onchange="toggleCatFilterAll(\\''+colKey+'\\')"> <label for="fd-all" style="cursor:pointer;font-weight:600">(Todos)</label></div>'
    + vals.map((v,i) => '<div class="fd-item"><input type="checkbox" id="fd-v'+i+'"'+((allChk||active.has(v))?' checked':'')+' data-val="'+v.replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'" onchange="toggleCatFilterVal(\\''+colKey+'\\',this)"> <label for="fd-v'+i+'" style="cursor:pointer">'+v+'</label></div>').join('')
    + '<div class="fd-footer"><button onclick="clearOneCatFilter(\\''+colKey+'\\')">Limpiar</button><button class="fd-apply" onclick="closeCatDropdown()">OK</button></div>';
  document.body.appendChild(dd);
  const rect = evt.currentTarget.getBoundingClientRect();
  dd.style.top  = Math.min(rect.bottom+4, window.innerHeight-dd.offsetHeight-8)+'px';
  dd.style.left = Math.min(rect.left, window.innerWidth-270)+'px';
  setTimeout(() => document.addEventListener('click', _closeDDHandler, {once:true}), 0);
}
function _closeDDHandler(e) { if (!e.target.closest('#cat-dd')) closeCatDropdown(); }
function closeCatDropdown() { document.getElementById('cat-dd')?.remove(); }

function toggleCatFilterAll(colKey) {
  delete catFilters[colKey];
  _applyCatFilters();
  closeCatDropdown();
}
function toggleCatFilterVal(colKey, cb) {
  if (!catFilters[colKey]) catFilters[colKey] = new Set();
  if (cb.checked) catFilters[colKey].add(cb.dataset.val);
  else catFilters[colKey].delete(cb.dataset.val);
  if (!catFilters[colKey].size) delete catFilters[colKey];
  const allEl = document.getElementById('fd-all');
  if (allEl) allEl.checked = !catFilters[colKey];
  _applyCatFilters();
}
function clearOneCatFilter(colKey) {
  delete catFilters[colKey];
  _applyCatFilters();
  closeCatDropdown();
}
function clearCatFilters() {
  catFilters = {};
  renderCatalogo();
}
function _applyCatFilters() {
  buildCatThead();
  _updateCatBadges();
  _renderCatBody();
}
function _updateCatBadges() {
  const entries = Object.entries(catFilters).filter(([,v]) => v.size > 0);
  document.getElementById('cat-clear-filters').style.display = entries.length ? '' : 'none';
  document.getElementById('cat-active-filters').innerHTML = entries.map(([k,vals]) => {
    const col = CAT_COLS.find(c => c.key === k);
    return '<span class="cat-filter-badge">'+(col?.label||k)+': '+[...vals].join(', ')
      +'<button onclick="clearOneCatFilter(\\''+k+'\\')">✕</button></span>';
  }).join('');
}

function renderCatalogo() {
  buildCatThead();
  _updateCatBadges();
  _renderCatBody();
}

function _renderCatBody() {
  const laptops = (DB.laptops || []).filter(p => p.activo !== false);
  const q = (document.getElementById('cat-search')?.value || '').toLowerCase();
  const ESTADO = {actualizado:'✓',sin_cambio:'=',sin_precio:'✗',no_encontrado:'✗',precio_sospechoso:'?',nuevo:'★'};
  const ECLS = {actualizado:'b-actualizado',sin_cambio:'b-sin_cambio',sin_precio:'b-sin_precio',no_encontrado:'b-no_encontrado',precio_sospechoso:'b-precio_sospechoso',nuevo:'b-nuevo'};
  let list = q ? laptops.filter(p => (p.nombre+' '+p.marca+(p.especs?.procesador||'')).toLowerCase().includes(q)) : laptops;
  // Apply column filters
  for (const [k, vals] of Object.entries(catFilters)) {
    if (!vals.size) continue;
    const col = CAT_COLS.find(c => c.key === k);
    if (!col) continue;
    list = list.filter(p => { const v = _catColVal(p, col); return v != null && vals.has(String(v)); });
  }
  document.getElementById('cat-count').textContent = list.length + ' laptops';
  document.getElementById('cat-empty').hidden = list.length > 0;
  const sp = v => v ? '<span class="spec-chip">'+v+'</span>' : '<span class="spec-null">—</span>';
  document.getElementById('cat-tbody').innerHTML = list.map(p => {
    const e = p.especs || {};
    const pml = p.precioML ? '<span class="precio-ml">$'+Math.round(p.precioML).toLocaleString('es-MX')+'</span>' : '<span class="spec-null">—</span>';
    const pamz = p.precioAmz ? '<span class="precio-amz">$'+Math.round(p.precioAmz).toLocaleString('es-MX')+'</span>' : '<span class="spec-null">—</span>';
    const lml = p.linkML ? '<a class="link-chip lc-ml" href="'+p.linkML+'" target="_blank" rel="noopener">ML↗</a>' : '';
    const lamz = p.linkAmz ? '<a class="link-chip lc-amz" href="'+p.linkAmz+'" target="_blank" rel="noopener">AMZ↗</a>' : '';
    const enlace = (lml||lamz) ? lml+lamz : '<span class="spec-null">—</span>';
    const est = p.estadoML ? '<span class="badge '+(ECLS[p.estadoML]||'b-null')+'">'+(ESTADO[p.estadoML]||'?')+'</span>' : '<span class="spec-null">—</span>';
    const upd = p._updatedAt ? '<span style="font-size:11px;white-space:nowrap;color:var(--fg2)">'+fmtDate(p._updatedAt)+'</span>' : '<span class="spec-null">—</span>';
    return '<tr>'
      +'<td class="precio-col">'+pml+'</td>'
      +'<td class="precio-col">'+pamz+'</td>'
      +'<td style="white-space:nowrap">'+enlace+'</td>'
      +'<td>'+p.marca+'</td>'
      +'<td style="max-width:220px;white-space:normal;font-size:12px">'+p.nombre+'</td>'
      +'<td>'+sp(e.procesador)+'</td>'
      +'<td>'+sp(e.ram)+'</td>'
      +'<td>'+sp(e.almacenamiento)+'</td>'
      +'<td>'+sp(e.pantalla)+'</td>'
      +'<td>'+sp(e.gpu)+'</td>'
      +'<td>'+sp(e.so)+'</td>'
      +'<td>'+sp(e.peso)+'</td>'
      +'<td>'+sp(e.touch)+'</td>'
      +'<td>'+est+'</td>'
      +'<td>'+upd+'</td>'
      +'</tr>';
  }).join('');
}
</script>`;

// Split the page at the data boundary for self-republishing
const splitIdx = html.indexOf(SPLIT_MARK) + SPLIT_MARK.length;
const pa = html.slice(0, splitIdx);               // ends with: atob('
const pb = html.slice(splitIdx + data.length);    // starts with: '),c=>...
const paB64 = Buffer.from(pa, 'utf8').toString('base64');
const pbB64 = Buffer.from(pb, 'utf8').toString('base64');
const finalHtml = html
  + `\n<script id="_srca" type="text/plain">${paB64}<\/script>`
  + `\n<script id="_srcb" type="text/plain">${pbB64}<\/script>`;

writeFileSync(resolve(ROOT, 'scripts/admin-artifact.html'), finalHtml, 'utf8');
console.log('admin-artifact.html generado:', finalHtml.length, 'chars');
