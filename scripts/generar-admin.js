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
const data = JSON.stringify(JSON.parse(readFileSync(resolve(ROOT, 'scripts/merged-admin.json'), 'utf8')));

const html = `<title>Admin Productos</title>
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
.table-wrap{overflow-x:auto;padding:0 20px}
table{width:100%;border-collapse:collapse;min-width:680px}
thead th{text-align:left;padding:7px 10px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--fg2);border-bottom:2px solid var(--border);background:var(--surface)}
tbody tr{border-bottom:1px solid var(--border)}
tbody tr:hover{background:var(--gray-light)}
tbody tr.pausado td.nombre-col{opacity:.4;text-decoration:line-through}
tbody tr.pausado{background:var(--gray-light)}
td{padding:8px 10px;vertical-align:middle;font-size:13px}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:11px;font-size:11px;font-weight:600;white-space:nowrap}
.b-actualizado{background:var(--green-light);color:var(--green)}
.b-sin_cambio{background:var(--gray-light);color:var(--gray)}
.b-sin_precio{background:var(--red-light);color:var(--red)}
.b-no_encontrado{background:var(--yellow-light);color:var(--yellow)}
.b-precio_sospechoso{background:var(--blue-light);color:var(--blue)}
.b-null{background:var(--gray-light);color:var(--fg2)}
.link-chip{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;text-decoration:none;margin-right:3px}
.lc-amz{background:#fff3ea;color:#b45309;border:1px solid #fcd34d}
.lc-ml{background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd}
.lc-none{background:var(--gray-light);color:var(--fg2);border:1px solid var(--border)}
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
</style>

<div class="top-bar">
  <h1>Admin Productos · comparalo.mx</h1>
  <div class="stats" id="stats"></div>
</div>
<div class="info-row">
  ℹ️ Haz tus cambios, copia el JSON con el botón verde y pégalo en <strong>scripts/productos.json</strong> en GitHub. El Action lo aplica automáticamente.
</div>
<div class="controls">
  <div class="cats" id="cats"></div>
  <div class="filters">
    <button class="filter-btn" id="f-sinprecio" onclick="toggleFilter('sinprecio')">🔴 Sin precio ML</button>
    <button class="filter-btn" id="f-noencontrado" onclick="toggleFilter('noencontrado')">⚠️ No encontrado</button>
    <button class="filter-btn" id="f-pausados" onclick="toggleFilter('pausados')">⏸ Pausados</button>
    <button class="filter-btn" id="f-sinlink" onclick="toggleFilter('sinlink')">🔗 Sin links</button>
  </div>
</div>
<div class="search-wrap">
  <input id="search" type="search" placeholder="Buscar por nombre o marca…" oninput="render()">
  <button class="btn-export" onclick="exportJSON()">📋 Copiar JSON actualizado</button>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th>Producto</th><th>Marca</th><th>Estado ML</th>
      <th>Links</th><th>Precio</th><th>Acciones</th>
    </tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="empty" hidden>Sin resultados para ese filtro.</div>
</div>

<div class="modal-bd" id="modal" hidden>
  <div class="modal">
    <h2 id="m-title">Editar producto</h2>
    <div class="sub" id="m-sub"></div>
    <label>Link Mercado Libre</label>
    <input id="ed-ml" type="url" placeholder="https://www.mercadolibre.com.mx/… (dejar vacío para quitar)">
    <label>Link Amazon (debe incluir ?tag=comparabici-20)</label>
    <input id="ed-amz" type="url" placeholder="https://www.amazon.com.mx/dp/…?tag=comparabici-20">
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
<div class="toast" id="toast"></div>

<script>
const INITIAL_DATA = ${data};
let DB = JSON.parse(JSON.stringify(INITIAL_DATA));
let activeCat = 'todas';
let activeFilters = new Set();
let editKey = null;

function allProds() {
  return Object.entries(DB).flatMap(([cat, prods]) => prods.map(p => ({...p, _cat: cat, _key: cat+'|'+p.id})));
}
function visibleProds() {
  const src = activeCat === 'todas' ? allProds() : (DB[activeCat]||[]).map(p => ({...p, _cat: activeCat, _key: activeCat+'|'+p.id}));
  const q = document.getElementById('search').value.toLowerCase();
  return src.filter(p => {
    if (q && !(p.nombre+' '+p.marca).toLowerCase().includes(q)) return false;
    if (activeFilters.has('sinprecio') && p.estadoML !== 'sin_precio') return false;
    if (activeFilters.has('noencontrado') && p.estadoML !== 'no_encontrado') return false;
    if (activeFilters.has('pausados') && p.activo !== false) return false;
    if (activeFilters.has('sinlink') && (p.linkAmz || p.linkML)) return false;
    return true;
  });
}

function renderStats() {
  const all = allProds();
  const t = all.length, ok = all.filter(p=>p.estadoML==='actualizado').length;
  const sp = all.filter(p=>p.estadoML==='sin_precio').length;
  const ne = all.filter(p=>p.estadoML==='no_encontrado').length;
  const pa = all.filter(p=>p.activo===false).length;
  document.getElementById('stats').innerHTML =
    st(t,'Total','')+st(ok,'OK','green')+st(sp,'Sin precio','red')+st(ne,'No encontrado','yellow')+(pa?st(pa,'Pausados','yellow'):'');
}
function st(n,l,c){return '<div class="stat '+c+'"><b>'+n+'</b>'+l+'</div>';}

function renderCats() {
  document.getElementById('cats').innerHTML = ['todas',...Object.keys(DB)].map(c =>
    '<button class="cat-btn'+(c===activeCat?' on':'')+'" onclick="setCat(\''+c+'\')">'+(c==='todas'?'Todas':c.charAt(0).toUpperCase()+c.slice(1))+'</button>'
  ).join('');
}

function render() {
  const prods = visibleProds();
  const tb = document.getElementById('tbody');
  document.getElementById('empty').hidden = prods.length > 0;
  if (!prods.length) { tb.innerHTML=''; return; }
  const ESTADO = {actualizado:'✓ Actualizado',sin_cambio:'= Sin cambio',sin_precio:'✗ Sin precio',no_encontrado:'⚠ No encontrado',precio_sospechoso:'? Sospechoso'};
  tb.innerHTML = prods.map(p => {
    const ecls = p.estadoML ? ('b-'+p.estadoML) : 'b-null';
    const elab = ESTADO[p.estadoML] || '— Sin ML';
    const lml = p.linkML ? '<a class="link-chip lc-ml" href="'+p.linkML+'" target="_blank" rel="noopener">ML↗</a>' : '<span class="link-chip lc-none">Sin ML</span>';
    const lamz = p.linkAmz ? '<a class="link-chip lc-amz" href="'+p.linkAmz+'" target="_blank" rel="noopener">AMZ↗</a>' : '<span class="link-chip lc-none">Sin AMZ</span>';
    const paBtn = p.activo!==false
      ? '<button class="btn-sm btn-pause" onclick="toggleActivo(\''+p._key+'\')">⏸ Pausar</button>'
      : '<button class="btn-sm btn-play" onclick="toggleActivo(\''+p._key+'\')">▶ Activar</button>';
    const precio = p.precioAmz ? '$'+p.precioAmz.toLocaleString('es-MX') : (p.precioML ? '$'+p.precioML.toLocaleString('es-MX') : '—');
    return '<tr class="'+(p.activo===false?'pausado':'')+'"><td class="nombre-col">'+p.nombre+'</td><td>'+p.marca+'</td><td><span class="badge '+ecls+'">'+elab+'</span></td><td>'+lml+lamz+'</td><td style="font-variant-numeric:tabular-nums">'+precio+'</td><td><div class="actions">'+paBtn+'<button class="btn-sm btn-edit" onclick="openEdit(\''+p._key+'\')">✏ Editar</button></div></td></tr>';
  }).join('');
}

function setCat(c){ activeCat=c; renderCats(); render(); }
function toggleFilter(f){
  activeFilters.has(f)?activeFilters.delete(f):activeFilters.add(f);
  document.getElementById('f-'+f).classList.toggle('on');
  render();
}
function toggleActivo(key){
  const [cat,id]=key.split('|');
  const p=DB[cat].find(p=>String(p.id)===id);
  if(!p)return;
  p.activo=p.activo!==false;
  renderStats(); render();
  toast(p.activo?'▶ Producto activado':'⏸ Producto pausado');
}
function openEdit(key){
  editKey=key;
  const [cat,id]=key.split('|');
  const p=DB[cat].find(p=>String(p.id)===id);
  document.getElementById('m-title').textContent='Editar · '+p.nombre;
  document.getElementById('m-sub').textContent=cat+' · id '+p.id;
  document.getElementById('ed-ml').value=p.linkML||'';
  document.getElementById('ed-amz').value=p.linkAmz||'';
  document.getElementById('del-confirm').hidden=true;
  document.getElementById('modal').hidden=false;
}
function saveEdit(){
  if(!editKey)return;
  const [cat,id]=editKey.split('|');
  const p=DB[cat].find(p=>String(p.id)===id);
  p.linkML=document.getElementById('ed-ml').value.trim()||null;
  p.linkAmz=document.getElementById('ed-amz').value.trim()||null;
  closeModal(); render(); toast('✓ Links actualizados');
}
function showDelConfirm(){document.getElementById('del-confirm').hidden=false;}
function confirmDelete(){
  if(!editKey)return;
  const [cat,id]=editKey.split('|');
  DB[cat]=DB[cat].filter(p=>String(p.id)!==id);
  closeModal(); renderStats(); render(); toast('🗑 Producto eliminado del registro');
}
function closeModal(){
  document.getElementById('modal').hidden=true;
  document.getElementById('del-confirm').hidden=true;
  editKey=null;
}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});

function exportJSON(){
  const out={};
  for(const [cat,prods] of Object.entries(DB)){
    out[cat]=prods.map(({id,nombre,marca,linkML,linkAmz,mlId,precioML,precioAmz,activo})=>({id,nombre,marca,linkML:linkML||null,linkAmz:linkAmz||null,mlId:mlId||null,precioML:precioML||null,precioAmz:precioAmz||null,activo:activo!==false}));
  }
  const json=JSON.stringify(out,null,2);
  navigator.clipboard.writeText(json).then(()=>toast('✓ JSON copiado — pégalo en scripts/productos.json en GitHub')).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=json;ta.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    toast('✓ JSON copiado');
  });
}

function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3000);
}

renderStats(); renderCats(); render();
</script>`;

writeFileSync(resolve(ROOT, 'scripts/admin-artifact.html'), html, 'utf8');
console.log('admin-artifact.html generado:', html.length, 'chars');
