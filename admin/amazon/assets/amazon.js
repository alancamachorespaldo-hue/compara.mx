// Cliente local: las credenciales privilegiadas nunca llegan al navegador.
class LocalQuery {
 constructor(table){this.table=table;this.method="GET";this.params=new URLSearchParams();this.payload=null;this.returning=false;this.head=false;this.exact=false}
 select(columns="*",opts={}){this.params.set("select",columns);this.returning=this.method!=="GET";this.head=!!opts.head;this.exact=opts.count==="exact";return this}
 eq(k,v){this.params.append(k,"eq."+v);return this}
 in(k,values){this.params.append(k,"in.("+values.join(",")+")");return this}
 order(k,opts={}){this.params.append("order",k+"."+(opts.ascending===false?"desc":"asc"));return this}
 limit(n){this.params.set("limit",String(n));return this}
 insert(data){this.method="POST";this.payload=data;return this}
 update(data){this.method="PATCH";this.payload=data;return this}
 delete(){this.method="DELETE";return this}
 single(){this.params.set("limit","1");this.wantSingle=true;return this}
 then(resolve,reject){return this.execute().then(resolve,reject)}
 async execute(){
  const headers={};if(this.returning)headers.Prefer="return=representation";if(this.exact)headers.Prefer=(headers.Prefer?headers.Prefer+",":"")+"count=exact";
  if(this.method==="POST"||this.method==="PATCH")headers["Content-Type"]="application/json";
  const response=await fetch("/__local/db/"+this.table+"?"+this.params.toString(),{method:this.head?"HEAD":this.method,headers,body:this.payload===null?undefined:JSON.stringify(this.payload)});
  const raw=this.head?"":await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
  if(!response.ok)return {data:null,error:{message:data?.message||data?.error||raw||response.statusText,code:data?.code},count:null};
  if(this.wantSingle&&Array.isArray(data))data=data[0]||null;
  const range=response.headers.get("content-range"),count=range&&range.includes("/")?Number(range.split("/")[1]):null;
  return {data,error:null,count};
 }
}
const supabase={from(table){return new LocalQuery(table)}};
const $=s=>document.querySelector(s);
const statusEl=$("#app-status"),dashboard=$("#dashboard");
let categories=[],products=[],packages=[];
function status(message,type="info"){statusEl.textContent=message;statusEl.dataset.type=type}
function showDashboard(){dashboard.hidden=false}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function categoryName(id){return categories.find(c=>c.id===id)?.name||"Sin categoría"}
function keyCategory(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function fillCategories(){for(const id of ["product-category","import-category","package-category","filter-category"]){const el=$("#"+id);const keep=el.value;el.querySelectorAll("option:not(:first-child)").forEach(o=>o.remove());categories.forEach(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=c.name;el.append(o)});if(keep)el.value=keep}}
function switchTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".tab-panel").forEach(p=>p.hidden=p.id!=="panel-"+name);if(name==="inventory")renderInventory();if(name==="packages")renderPackageProducts()}
function resetProduct(){const f=$("#product-form");f.reset();f.elements.id.value="";f.elements.review_status.value="pending";$("#product-form-title").textContent="Capturar producto"}
function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function parseAttributes(value){if(!value.trim())return {};const obj=JSON.parse(value);if(!obj||Array.isArray(obj)||typeof obj!=="object")throw new Error("Los atributos deben ser un objeto JSON.");return obj}
async function refreshData(){const [c,p,g]=await Promise.all([supabase.from("amazon_categories").select("*").eq("is_active",true).order("sort_order"),supabase.from("amazon_products").select("*").order("created_at",{ascending:false}),supabase.from("amazon_guide_packages").select("*").order("created_at",{ascending:false})]);const err=c.error||p.error||g.error;if(err)throw err;categories=c.data||[];products=p.data||[];packages=g.data||[];$("#count-products").textContent=products.length;$("#count-categories").textContent=categories.length;$("#count-packages").textContent=packages.length;fillCategories();renderInventory();renderPackageProducts();renderPackages()}
function renderInventory(){const term=$("#product-search").value.trim().toLowerCase(),cat=$("#filter-category").value,st=$("#filter-status").value;const rows=products.filter(p=>(!cat||p.category_id===cat)&&(!st||p.review_status===st)&&[p.name,p.brand,p.model,p.asin].some(v=>(v||"").toLowerCase().includes(term)));const body=$("#inventory-body");body.replaceChildren();rows.forEach(p=>{const tr=document.createElement("tr");const imageCell=p.image_url?'<a class="inventory-image-link" href="'+esc(p.image_url)+'" target="_blank" rel="noopener noreferrer" aria-label="Ver imagen de '+esc(p.name)+'"><img class="inventory-image" src="'+esc(p.image_url)+'" alt="'+esc(p.name)+'" loading="lazy" referrerpolicy="no-referrer"></a>':'<span class="inventory-image-empty">Sin imagen</span>';tr.innerHTML='<td>'+imageCell+'</td><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.product_url||"")+'</small></td><td>'+esc(p.brand)+'<small>'+esc(p.model)+'</small></td><td>'+esc(p.asin)+'</td><td>'+esc(categoryName(p.category_id))+'</td><td><span class="tag">'+esc(p.review_status)+'</span></td><td><div class="action-group"><button class="action" data-edit="'+p.id+'">Editar</button><button class="action danger" data-delete="'+p.id+'">Eliminar</button></div></td>';body.append(tr)});$("#inventory-empty").hidden=rows.length>0}
async function saveProduct(form,method,sourceText=""){const v=formObject(form);if(!v.name.trim())throw new Error("El nombre del producto es obligatorio.");const attrs=parseAttributes(v.attributes||"");const record={name:v.name.trim(),brand:v.brand||null,model:v.model||null,asin:v.asin.trim()||null,category_id:v.category_id||null,product_url:v.product_url||null,affiliate_url:v.affiliate_url||null,image_url:v.image_url||null,attributes:attrs,source_text:sourceText||null,capture_method:method,review_status:v.review_status||"pending",internal_notes:v.internal_notes||null};let result;if(v.id){result=await supabase.from("amazon_products").update(record).eq("id",v.id).select().single()}else{result=await supabase.from("amazon_products").insert(record).select().single()}if(result.error)throw result.error;const price=Number(v.observed_price);if(v.observed_price&&Number.isFinite(price)&&price>=0){const obs=await supabase.from("amazon_product_observations").insert({product_id:result.data.id,observation_type:"price",amount:price,currency:"MXN",source:"manual_observation",notes:"Precio observado durante la captura; dato interno, no publicar como precio vigente."});if(obs.error)throw obs.error}await refreshData();return result.data}
function editProduct(id){const p=products.find(x=>x.id===id);if(!p)return;switchTab("manual");const f=$("#product-form");for(const [k,v] of Object.entries({id:p.id,name:p.name,brand:p.brand,model:p.model,asin:p.asin,category_id:p.category_id,product_url:p.product_url,affiliate_url:p.affiliate_url,image_url:p.image_url,attributes:JSON.stringify(p.attributes||{},null,2),review_status:p.review_status,internal_notes:p.internal_notes}))if(f.elements[k])f.elements[k].value=v??"";$("#product-form-title").textContent="Editar producto"}
function extractText(text){
 const clean=s=>String(s??"").replace(/<[^>]*>/g,"").replace(/&nbsp;/gi," ").replace(/&#x20;/gi," ").replace(/\\/g,"").trim();
 const key=s=>clean(s).replace(/\*\*/g,"").replace(/\*/g,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const pairs={};
 const ignored=new Set(["caracteristicas_y_especificaciones","estilo","materiales_y_cuidado","detalles_del_producto","medidas","guia_de_usuario","informacion_del_producto"]);
 for(const raw of lines){
  const line=raw.trim();
  if(/^\|?\s*:?-{2,}/.test(line))continue;
  let parts=null;
  if(line.includes("|")){
   const cells=line.replace(/^\|/,"").replace(/\|$/,"").split("|").map(x=>x.trim().replace(/^\*\*|\*\*$/g,"").replace(/^\*|\*$/g,""));
   if(cells.length>=2)parts=[cells[0],cells.slice(1).join(" ").trim()];
  }
  if(!parts&&/\t/.test(line)){const cells=line.split(/\t+/).map(x=>x.trim());if(cells.length>=2)parts=[cells[0],cells.slice(1).join(" ")]}
  if(!parts){const m=line.match(/^\*\*(.{2,70}?)\*\*\s+(.+)$/);if(m)parts=[m[1],m[2]]}
  if(!parts){const m=line.match(/^([^:：]{2,70}?)\s*[:：]\s*(.+)$/);if(m)parts=[m[1],m[2]]}
  if(parts){const k=key(parts[0]),v=clean(parts[1]).replace(/^\*\*|\*\*$/g,"");if(k&&v&&!ignored.has(k)&&!/^:?-+$/.test(v))pairs[k]=v}
 }
 const find=(...names)=>{for(const n of names){const v=pairs[key(n)];if(v)return v}return ""};
 const brand=find("Marca","Fabricante");
 const model=find("Número Modelo","Modelo","Número de modelo");
 const productType=find("Tipo de bicicleta","Tipo de producto","Tipo");
 const asin=(text.match(/\b(B0[A-Z0-9]{8})\b/i)||text.match(/\/dp\/([A-Z0-9]{10})/i)||[])[1]||"";
 const productLinks=[...text.matchAll(/https?:\/\/(?:www\.)?amazon\.com\.mx\/[^\s)\]]+/gi)];
 const productUrl=productLinks.map(m=>m[0].replace(/[),.;\]]+$/g,"")).find(u=>/\/(?:dp|gp\/product)\//i.test(u))||(asin?"https://www.amazon.com.mx/dp/"+asin:"");
 const imageUrl=(text.match(/https?:\/\/(?:m\.)?media-amazon\.com\/[^\s)\]]+/i)||text.match(/https?:\/\/[^\s)\]]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s)\]]*)?/i)||[])[0]?.replace(/[),.;\]]+$/g,"")||"";
 const titleLine=lines.find(l=>/\b(?:HONEYWHALE|Apple|Samsung|Xiaomi|Sony|LG|Philips|Ninja|Oster|Tefal|Huawei|Lenovo|HP|Dell|Acer|ASUS)\b/i.test(l)&&l.length>12&&!/^https?:/i.test(l))||"";
 const ratingMatch=text.match(/(\d(?:\.\d)?)\s*(?:de\s*)?5\s*estrellas?/i)||text.match(/(\d(?:\.\d)?)\s*\([^)]*\d[\d,.]*\s*(?:reseñas|opiniones)/i);
 const reviewMatch=text.match(/\(([\d,.]+)\)\s*(?:\||$)/)||text.match(/([\d,]+)\s*(?:calificaciones|reseñas|opiniones)/i);
 const rating=ratingMatch?ratingMatch[1]:"";
 const reviews=reviewMatch?reviewMatch[1].replace(/[,.]/g,""):"";
 const priceMatch=text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
 const categoryText=(productType+" "+text.slice(0,1800)).toLowerCase();
 let category="";
 if(/biciclet|\bbike\b/.test(categoryText))category="bicicletas";
 else if(/freidora/.test(categoryText))category="freidoras";
 else if(/microondas/.test(categoryText))category="microondas";
 else if(/horno/.test(categoryText))category="hornos";
 else if(/laptop|computadora portatil/.test(categoryText))category="laptops";
 else if(/omega.?3|creatina|proteina|suplemento|magnesio/.test(categoryText))category="suplementos";
 else if(/electronica|audifonos|celular|telefono/.test(categoryText))category="electronica";
 const excluded=new Set(["marca","fabricante","modelo","numero_modelo","asin","opinion_media_de_los_clientes","clasificacion_en_los_mas_vendidos_de_amazon"]);
 const attributes={};for(const [k,v] of Object.entries(pairs)){if(!excluded.has(k))attributes[k]=v}
 if(rating)attributes.calificacion_estrellas=rating;
 if(reviews)attributes.numero_resenas=reviews;
 const name=find("Nombre del producto","Nombre","Título","Titulo")||titleLine||[brand,model,productType].filter(Boolean).join(" ").trim();
 return{name,brand,model,asin,category,product_url:productUrl,image_url:imageUrl,observed_price:priceMatch?priceMatch[1].replace(/,/g,""):"",attributes,detected_fields:Object.keys(attributes).length};
}
function renderPackageProducts(){const box=$("#package-products");if(!products.length){box.innerHTML='<p class="empty">Primero captura productos en el inventario.</p>';return}box.innerHTML=products.map(p=>`<label class="product-option"><input type="checkbox" name="package_product" value="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.brand)} · ${esc(categoryName(p.category_id))} · ${esc(p.asin||"Sin ASIN")}</small></span></label>`).join("")}
async function renderPackages(){const box=$("#packages-list");if(!packages.length){box.innerHTML='<p class="empty">Aún no hay paquetes.</p>';return}box.replaceChildren();for(const p of packages){const {count}=await supabase.from("amazon_guide_package_items").select("*",{count:"exact",head:true}).eq("package_id",p.id);const div=document.createElement("div");div.className="package-item";div.innerHTML=`<div><strong>${esc(p.title)}</strong><small>${esc(categoryName(p.category_id))} · ${count||0} productos · ${esc(p.status)}</small></div><div class="action-group"><button class="action" data-export="${p.id}">Exportar JSON</button><button class="action danger" data-delete-package="${p.id}">Eliminar</button></div>`;box.append(div)}}
async function exportPackage(id){const pkg=packages.find(x=>x.id===id);const {data:links,error}=await supabase.from("amazon_guide_package_items").select("product_id,sort_order,editorial_note").eq("package_id",id).order("sort_order");if(error)throw error;const ids=(links||[]).map(x=>x.product_id);const {data:items,error:e}=await supabase.from("amazon_products").select("*").in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);if(e)throw e;const {data:obs,error:oe}=await supabase.from("amazon_product_observations").select("*").in("product_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]).order("observed_at",{ascending:false});if(oe)throw oe;const payload={exported_at:new Date().toISOString(),project:"Compáralo.mx",package:pkg,products:(items||[]).map(p=>({...p,category_name:categoryName(p.category_id),observations:(obs||[]).filter(o=>o.product_id===p.id)})),editorial_notes:links||[],notice:"Datos internos de investigación. Verificar especificaciones y disponibilidad en fuentes vigentes antes de publicar."};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(pkg.title||"paquete").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".json";a.click();URL.revokeObjectURL(url)}
async function initializeLocal(){try{const check=await fetch("/__local/status");const cfg=await check.json();if(!cfg.configured)throw new Error("Configura .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Consulta admin/amazon/README.md.");showDashboard();status("Modo local activo. Conexión segura con Supabase verificada.","success");await refreshData()}catch(error){showDashboard();status("No se pudo conectar: "+error.message,"error");console.error(error)}}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.go)));
$("#product-search").addEventListener("input",renderInventory);$("#filter-category").addEventListener("change",renderInventory);$("#filter-status").addEventListener("change",renderInventory);
$("#product-form").addEventListener("submit",async e=>{e.preventDefault();try{await saveProduct(e.currentTarget,"manual");status("Producto guardado correctamente.","success");resetProduct();switchTab("inventory")}catch(err){status("No se pudo guardar: "+err.message,"error")}});
$("#reset-product").addEventListener("click",resetProduct);
$("#inventory-body").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit)editProduct(edit.dataset.edit);if(del&&confirm("¿Eliminar este producto y sus observaciones?")){const {error}=await supabase.from("amazon_products").delete().eq("id",del.dataset.delete);if(error)status("No se pudo eliminar: "+error.message,"error");else{await refreshData();status("Producto eliminado.","success")}}});
$("#parse-text").addEventListener("click",()=>{const text=$("#source-text").value.trim();if(!text){status("Pega primero el texto de una publicación.","error");return}const d=extractText(text),f=$("#import-form");for(const [k,v] of Object.entries(d))if(f.elements[k]&&typeof v==="string")f.elements[k].value=v;if(f.elements.attributes)f.elements.attributes.value=JSON.stringify(d.attributes||{},null,2);if(d.category){const match=categories.find(c=>keyCategory(c.slug)===d.category||keyCategory(c.name)===d.category);if(match)f.elements.category_id.value=match.id}f.elements.source_text.value=text;$("#import-review").hidden=false;status("Se detectaron "+d.detected_fields+" características. Revisa los campos y las especificaciones antes de guardar.","success")});
$("#clear-import").addEventListener("click",()=>{$("#source-text").value="";$("#import-review").hidden=true;$("#import-form").reset()});
$("#import-form").addEventListener("submit",async e=>{e.preventDefault();try{const v=formObject(e.currentTarget);const saved=await saveProduct(e.currentTarget,"pasted_text",v.source_text);const batch=await supabase.from("amazon_import_batches").insert({capture_method:"pasted_text",source_text:v.source_text,parsed_data:{name:v.name,brand:v.brand,model:v.model,asin:v.asin,product_url:v.product_url,observed_price:v.observed_price},status:"confirmed"});if(batch.error)throw batch.error;status("Producto importado y guardado para revisión editorial.","success");$("#source-text").value="";$("#import-review").hidden=true;switchTab("inventory")}catch(err){status("No se pudo importar: "+err.message,"error")}});
$("#package-form").addEventListener("submit",async e=>{e.preventDefault();try{const v=formObject(e.currentTarget),selected=[...document.querySelectorAll('input[name="package_product"]:checked')].map(x=>x.value);const {data,error}=await supabase.from("amazon_guide_packages").insert({title:v.title,category_id:v.category_id||null,topic:v.topic||null,editorial_instructions:v.editorial_instructions||null,status:v.status}).select().single();if(error)throw error;if(selected.length){const {error:linkError}=await supabase.from("amazon_guide_package_items").insert(selected.map((product_id,i)=>({package_id:data.id,product_id,sort_order:i})));if(linkError)throw linkError}e.currentTarget.reset();await refreshData();status("Paquete guardado correctamente.","success")}catch(err){status("No se pudo guardar el paquete: "+err.message,"error")}});
$("#packages-list").addEventListener("click",async e=>{const ex=e.target.closest("[data-export]"),del=e.target.closest("[data-delete-package]");try{if(ex)await exportPackage(ex.dataset.export);if(del&&confirm("¿Eliminar este paquete? Los productos del inventario se conservarán.")){const {error}=await supabase.from("amazon_guide_packages").delete().eq("id",del.dataset.deletePackage);if(error)throw error;await refreshData();status("Paquete eliminado.","success")}}catch(err){status("Operación no completada: "+err.message,"error")}});

initializeLocal();
