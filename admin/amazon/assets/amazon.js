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

const mobileFields=["family","model_year","condition","variant","processor","cpu_cores","display_technology","display_size","resolution","refresh_rate","ram_gb","storage_gb","main_camera_mp","front_camera_mp","battery_mah","charging_w","connectivity","memory_expansion","rating","review_count","seller","warranty"];
function isMobileCategory(id){return categories.some(c=>c.id===id&&c.slug==="celulares")}
function toggleMobileSpecs(form){const section=form.querySelector("#mobile-specs");if(section)section.hidden=!isMobileCategory(form.elements.category_id?.value)}
function mobileAttributesFromForm(form){
 const data={};for(const key of mobileFields){const el=form.elements["mobile_"+key];if(!el||!el.value.trim())continue;data[key]=el.type==="number"?Number(el.value):el.value.trim()}
 return data;
}
function fillMobileForm(form,attrs){
 const mobile=attrs?.mobile||{};
 for(const key of mobileFields){const el=form.elements["mobile_"+key];if(el)el.value=mobile[key]??""}
 toggleMobileSpecs(form);
}
function mapMobileConfiguration(p){
 const c=p.configuration||{},l=p.listing||{},out={};
 const pick=(...values)=>values.find(v=>v!==undefined&&v!==null&&v!=="");
 const aliases={
 family:pick(p.family,c.family,c.product_family),model_year:pick(p.model_year,c.model_year),condition:pick(p.condition,c.condition),variant:pick(p.variant,c.color,c.colour,c.variant),
 processor:pick(c.processor,c.chipset,c.cpu,c.processor_model_clean),cpu_cores:pick(c.cpu_cores,c.processor_cores),
 display_technology:pick(c.display_main_type,c.display_technology,c.screen_technology),display_size:pick(c.display_main_inches,c.display_size_inches,c.screen_size_inches,c.display_size),
 resolution:pick(c.display_main_resolution_listing,c.display_main_resolution,c.resolution,c.display_resolution),refresh_rate:pick(c.refresh_rate_hz,c.refresh_rate),
 ram_gb:pick(c.ram_gb,c.ram_gb_capacity,c.ram),storage_gb:pick(c.storage_gb,c.storage_capacity_gb,c.storage),
 main_camera_mp:pick(c.rear_camera_main_mp,c.main_camera_mp,c.rear_camera_mp),front_camera_mp:pick(c.front_camera_mp,c.selfie_camera_mp),
 battery_mah:pick(c.battery_capacity_mah_listing,c.battery_capacity_mah_typical_official,c.battery_mah,c.battery_capacity_mah),
 charging_w:pick(c.charging_w,c.charging_power_w),connectivity:[c.mobile_network,c.connectivity].filter(Boolean).join(" · "),
 memory_expansion:c.storage_expandable===false?"No":pick(c.memory_expansion),rating:pick(l.rating),review_count:pick(l.review_count),
 seller:pick(l.seller),warranty:pick(l.warranty)
 };
 for(const [k,v] of Object.entries(aliases))if(v!==undefined&&v!==null&&v!=="")out[k]=v;
 return out;
}

function resetProduct(){const f=$("#product-form");f.reset();f.elements.id.value="";f.elements.review_status.value="pending";$("#product-form-title").textContent="Capturar producto"}
function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function parseAttributes(value){if(!value.trim())return {};const obj=JSON.parse(value);if(!obj||Array.isArray(obj)||typeof obj!=="object")throw new Error("Los atributos deben ser un objeto JSON.");return obj}
async function refreshData(){const [c,p,g]=await Promise.all([supabase.from("amazon_categories").select("*").eq("is_active",true).order("sort_order"),supabase.from("amazon_products").select("*").order("created_at",{ascending:false}),supabase.from("amazon_guide_packages").select("*").order("created_at",{ascending:false})]);const err=c.error||p.error||g.error;if(err)throw err;categories=c.data||[];products=p.data||[];packages=g.data||[];$("#count-products").textContent=products.length;$("#count-categories").textContent=categories.length;$("#count-packages").textContent=packages.length;fillCategories();renderInventory();renderPackageProducts();renderPackages()}
function renderInventory(){const term=$("#product-search").value.trim().toLowerCase(),cat=$("#filter-category").value,st=$("#filter-status").value;const rows=products.filter(p=>(!cat||p.category_id===cat)&&(!st||p.review_status===st)&&[p.name,p.brand,p.model,p.asin].some(v=>(v||"").toLowerCase().includes(term)));const body=$("#inventory-body");body.replaceChildren();rows.forEach(p=>{const tr=document.createElement("tr");const imageCell=p.image_url?'<a class="inventory-image-link" href="'+esc(p.image_url)+'" target="_blank" rel="noopener noreferrer" aria-label="Ver imagen de '+esc(p.name)+'"><img class="inventory-image" src="'+esc(p.image_url)+'" alt="'+esc(p.name)+'" loading="lazy" referrerpolicy="no-referrer"></a>':'<span class="inventory-image-empty">Sin imagen</span>';const hist=p.source_record?.listing?.price_mxn;const price=hist==null?"—":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(hist));const link=p.affiliate_url||p.product_url;const linkCell=link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Consultar en Amazon</a>':'<small>Sin enlace</small>';tr.innerHTML='<td>'+imageCell+'</td><td><strong>'+esc(p.name)+'</strong><small>'+linkCell+'</small></td><td>'+esc(p.brand)+'<small>'+esc(p.model)+'</small></td><td>'+esc(p.asin)+'</td><td>'+esc(price)+'</td><td>'+esc(categoryName(p.category_id))+'</td><td><span class="tag">'+esc(p.review_status)+'</span></td><td><div class="action-group"><button class="action" data-edit="'+p.id+'">Editar</button><button class="action danger" data-delete="'+p.id+'">Eliminar</button></div></td>';body.append(tr)});$("#inventory-empty").hidden=rows.length>0}
async function saveProduct(form,method,sourceText=""){const v=formObject(form);if(!v.name.trim())throw new Error("El nombre del producto es obligatorio.");const attrs=parseAttributes(v.attributes||"");const mobile=mobileAttributesFromForm(form);if(Object.keys(mobile).length)attrs.mobile=mobile;else delete attrs.mobile;const record={name:v.name.trim(),brand:v.brand||null,model:v.model||null,asin:v.asin.trim()||null,category_id:v.category_id||null,product_url:v.product_url||null,affiliate_url:v.affiliate_url||null,image_url:v.image_url||null,attributes:attrs,source_text:sourceText||null,capture_method:method,review_status:v.review_status||"pending",internal_notes:v.internal_notes||null};let result;if(v.id){result=await supabase.from("amazon_products").update(record).eq("id",v.id).select().single()}else{result=await supabase.from("amazon_products").insert(record).select().single()}if(result.error)throw result.error;const price=Number(v.observed_price);if(v.observed_price&&Number.isFinite(price)&&price>=0){const obs=await supabase.from("amazon_product_observations").insert({product_id:result.data.id,observation_type:"price",amount:price,currency:"MXN",source:"manual_observation",notes:"Precio observado durante la captura; dato interno, no publicar como precio vigente."});if(obs.error)throw obs.error}await refreshData();return result.data}
async function editProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 switchTab("manual");const f=$("#product-form");
 const obs=await supabase.from("amazon_product_observations").select("*").eq("product_id",p.id).eq("observation_type","price").order("observed_at",{ascending:false}).limit(1);
 const historical=p.source_record?.listing?.price_mxn??obs.data?.[0]?.amount??"";
 for(const [k,v] of Object.entries({id:p.id,name:p.name,brand:p.brand,model:p.model,asin:p.asin,category_id:p.category_id,product_url:p.product_url,affiliate_url:p.affiliate_url,image_url:p.image_url,observed_price:historical,attributes:JSON.stringify(p.attributes||{},null,2),review_status:p.review_status,internal_notes:p.internal_notes}))if(f.elements[k])f.elements[k].value=v??"";
 const mapped=mapMobileConfiguration({configuration:p.attributes||{},listing:p.source_record?.listing||{},family:p.attributes?.family,model_year:p.attributes?.model_year,condition:p.attributes?.condition});
 fillMobileForm(f,{mobile:p.attributes?.mobile||mapped});
 $("#product-form-title").textContent="Editar producto";
}
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

let jsonImportPayload=null,jsonImportRows=[];
function jsonProductName(p){return p?.listing?.title||p?.model_name||p?.name||p?.id||"Producto sin nombre"}
function jsonProductAsin(p){return String(p?.listing?.asin||p?.asin||"").trim().toUpperCase()}
function jsonProductPrice(p){const n=Number(p?.listing?.price_mxn??p?.price_mxn);return Number.isFinite(n)&&n>=0?n:null}
function jsonProductUrl(p){const u=p?.listing?.product_url||p?.listing?.url||p?.product_url||p?.listing?.amazon_short_url||p?.listing?.affiliate_url||p?.amazon_short_url||"";return /^https?:\/\/(?:www\.)?amazon\.com\.mx\//i.test(u)?u:""}
function jsonProductIssues(p,duplicate){
 const issues=[];
 if(!jsonProductAsin(p))issues.push("ASIN pendiente");
 if(duplicate)issues.push("ASIN repetido o ya registrado");
 if(p?.capture_status)issues.push("Estado: "+p.capture_status);
 if(Array.isArray(p?.discrepancies))issues.push(...p.discrepancies.map(x=>typeof x==="string"?x:JSON.stringify(x)));
 const short=p?.listing?.amazon_short_url||p?.listing?.affiliate_url||p?.amazon_short_url;
 if(short)issues.push("Enlace corto por verificar");
 return issues;
}
function renderJsonPreview(){
 const body=$("#json-preview-body");body.replaceChildren();
 const existing=new Set(products.map(p=>(p.asin||"").toUpperCase()).filter(Boolean));
 const seen=new Set();
 jsonImportRows=jsonImportPayload.products.map((p,index)=>{
  const asin=jsonProductAsin(p),duplicate=!!asin&&(existing.has(asin)||seen.has(asin));
  if(asin)seen.add(asin);
  const issues=jsonProductIssues(p,duplicate);
  const tr=document.createElement("tr");
  const price=jsonProductPrice(p);
  const short=p?.listing?.amazon_short_url||p?.listing?.affiliate_url||p?.amazon_short_url||"—";
  tr.innerHTML='<td><input type="checkbox" class="json-import-check" data-index="'+index+'" '+(duplicate?'disabled':'checked')+'></td><td><strong>'+esc(jsonProductName(p))+'</strong><small>'+esc([p.brand,p.family,p.model_name,p.condition].filter(Boolean).join(" · "))+'</small></td><td>'+esc(asin||"Pendiente")+'</td><td>'+(price===null?"—":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(price))+'</td><td><small>'+esc(short)+'</small></td><td><small>'+esc(issues.join(" | ")||"Sin incidencia detectada")+'</small></td>';
  body.append(tr);
  return {product:p,duplicate,issues,index};
 });
 const duplicates=jsonImportRows.filter(x=>x.duplicate).length;
 $("#json-preview-title").textContent=(jsonImportPayload.collection||"Colección JSON")+" · "+jsonImportRows.length+" productos";
 $("#json-preview-summary").textContent=jsonImportRows.length+" registros detectados. "+duplicates+" bloqueados por ASIN duplicado. Los demás quedan seleccionados para importación, pero todos entrarán como Pendientes.";
 $("#json-preview").hidden=false;
}
function jsonCategoryId(p){
 const raw=String(p.category||jsonImportPayload.collection||"").toLowerCase();
 const mobile=/smartphone|celular|samsung|iphone|telefon/.test(raw)||/galaxy|iphone/i.test(jsonProductName(p));
 const match=mobile?categories.find(c=>c.slug==="celulares"):categories.find(c=>raw.includes(c.slug)||raw.includes(c.name.toLowerCase()));
 return match?.id||null;
}
async function importSelectedJson(){
 const selected=[...document.querySelectorAll(".json-import-check:checked")].map(x=>Number(x.dataset.index));
 if(!selected.length)throw new Error("Selecciona al menos un producto para importar.");
 const batchResult=await supabase.from("amazon_import_batches").insert({capture_method:"json_import",source_text:null,parsed_data:jsonImportPayload,status:"review_pending"}).select().single();
 if(batchResult.error)throw batchResult.error;
 const batchId=batchResult.data.id,created=[];
 try{
  for(const index of selected){
   const p=jsonImportRows[index].product,listing=p.listing||{},config=p.configuration||{};
   const asin=jsonProductAsin(p)||null;
   const name=jsonProductName(p);
   const short=listing.amazon_short_url||listing.affiliate_url||p.amazon_short_url||"";
   const discrepancies=[...(Array.isArray(p.discrepancies)?p.discrepancies.map(x=>typeof x==="string"?x:JSON.stringify(x)):[]),...(Array.isArray(p.research_notes)?p.research_notes.map(x=>typeof x==="string"?x:JSON.stringify(x)):[])];
   if(short)discrepancies.push("Enlace corto conservado en el registro original; verificar destino, ASIN y variante antes de utilizarlo.");
   const notes=["Importado desde JSON histórico. Requiere revisión manual.",p.capture_status?"Estado de captura original: "+p.capture_status:"",...discrepancies].filter(Boolean).join("\n");
   const originalAffiliate=listing.amazon_short_url||listing.affiliate_url||p.amazon_short_url||p.affiliate_url||"";
   const record={name,brand:p.brand||null,model:p.model_name||p.model||null,asin,category_id:jsonCategoryId(p),product_url:jsonProductUrl(p)||originalAffiliate||null,affiliate_url:originalAffiliate||null,image_url:listing.image_url||listing.image_url_temporary_reference||p.image_url||null,attributes:{...config,mobile:mapMobileConfiguration(p),family:p.family??null,condition:p.condition??null,model_year:p.model_year??null,ranking_group:p.ranking_group??null,seller:listing.seller??null,warranty:listing.warranty??null},source_text:null,capture_method:"json_import",review_status:"pending",internal_notes:notes,source_record:p};
   const saved=await supabase.from("amazon_products").insert(record).select().single();
   if(saved.error)throw new Error(name+": "+saved.error.message);
   created.push(saved.data.id);
   const price=jsonProductPrice(p);
   if(price!==null){const obs=await supabase.from("amazon_product_observations").insert({product_id:saved.data.id,observation_type:"price",amount:price,currency:"MXN",source:"historical_json_import",notes:"Precio histórico importado del JSON original; no representa precio vigente."});if(obs.error)throw obs.error}
  }
  const upd=await supabase.from("amazon_import_batches").update({status:"confirmed"}).eq("id",batchId);
  if(upd.error)throw upd.error;
  await refreshData();
  status("Importación terminada: "+created.length+" productos guardados como Pendientes. Se conservó el JSON original.", "success");
  $("#json-preview").hidden=true;$("#json-file").value="";$("#json-file-feedback").textContent="";
 }catch(error){
  status("La importación se detuvo después de guardar "+created.length+" productos. El lote original quedó conservado para revisión. Detalle: "+error.message,"error");
  await refreshData();
 }
}

function renderPackageProducts(){const box=$("#package-products");if(!products.length){box.innerHTML='<p class="empty">Primero captura productos en el inventario.</p>';return}box.innerHTML=products.map(p=>`<label class="product-option"><input type="checkbox" name="package_product" value="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.brand)} · ${esc(categoryName(p.category_id))} · ${esc(p.asin||"Sin ASIN")}</small></span></label>`).join("")}
async function renderPackages(){const box=$("#packages-list");if(!packages.length){box.innerHTML='<p class="empty">Aún no hay paquetes.</p>';return}box.replaceChildren();for(const p of packages){const {count}=await supabase.from("amazon_guide_package_items").select("*",{count:"exact",head:true}).eq("package_id",p.id);const div=document.createElement("div");div.className="package-item";div.innerHTML=`<div><strong>${esc(p.title)}</strong><small>${esc(categoryName(p.category_id))} · ${count||0} productos · ${esc(p.status)}</small></div><div class="action-group"><button class="action" data-export="${p.id}">Exportar JSON</button><button class="action danger" data-delete-package="${p.id}">Eliminar</button></div>`;box.append(div)}}
async function exportPackage(id){const pkg=packages.find(x=>x.id===id);const {data:links,error}=await supabase.from("amazon_guide_package_items").select("product_id,sort_order,editorial_note").eq("package_id",id).order("sort_order");if(error)throw error;const ids=(links||[]).map(x=>x.product_id);const {data:items,error:e}=await supabase.from("amazon_products").select("*").in("id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]);if(e)throw e;const {data:obs,error:oe}=await supabase.from("amazon_product_observations").select("*").in("product_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"]).order("observed_at",{ascending:false});if(oe)throw oe;const payload={exported_at:new Date().toISOString(),project:"Compáralo.mx",package:pkg,products:(items||[]).map(p=>({...p,category_name:categoryName(p.category_id),observations:(obs||[]).filter(o=>o.product_id===p.id)})),editorial_notes:links||[],notice:"Datos internos de investigación. Verificar especificaciones y disponibilidad en fuentes vigentes antes de publicar."};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(pkg.title||"paquete").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".json";a.click();URL.revokeObjectURL(url)}
async function initializeLocal(){try{const check=await fetch("/__local/status");const cfg=await check.json();if(!cfg.configured)throw new Error("Configura .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Consulta admin/amazon/README.md.");showDashboard();status("Modo local activo. Conexión segura con Supabase verificada.","success");await refreshData()}catch(error){showDashboard();status("No se pudo conectar: "+error.message,"error");console.error(error)}}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.go)));
$("#product-category").addEventListener("change",()=>toggleMobileSpecs($("#product-form")));$("#product-search").addEventListener("input",renderInventory);$("#filter-category").addEventListener("change",renderInventory);$("#filter-status").addEventListener("change",renderInventory);
$("#product-form").addEventListener("submit",async e=>{e.preventDefault();try{await saveProduct(e.currentTarget,"manual");status("Producto guardado correctamente.","success");resetProduct();switchTab("inventory")}catch(err){status("No se pudo guardar: "+err.message,"error")}});
$("#reset-product").addEventListener("click",()=>{resetProduct();toggleMobileSpecs($("#product-form"))});
$("#inventory-body").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit)editProduct(edit.dataset.edit);if(del&&confirm("¿Eliminar este producto y sus observaciones?")){const {error}=await supabase.from("amazon_products").delete().eq("id",del.dataset.delete);if(error)status("No se pudo eliminar: "+error.message,"error");else{await refreshData();status("Producto eliminado.","success")}}});
$("#parse-text").addEventListener("click",()=>{const text=$("#source-text").value.trim();if(!text){status("Pega primero el texto de una publicación.","error");return}const d=extractText(text),f=$("#import-form");for(const [k,v] of Object.entries(d))if(f.elements[k]&&typeof v==="string")f.elements[k].value=v;if(f.elements.attributes)f.elements.attributes.value=JSON.stringify(d.attributes||{},null,2);if(d.category){const match=categories.find(c=>keyCategory(c.slug)===d.category||keyCategory(c.name)===d.category);if(match)f.elements.category_id.value=match.id}f.elements.source_text.value=text;$("#import-review").hidden=false;status("Se detectaron "+d.detected_fields+" características. Revisa los campos y las especificaciones antes de guardar.","success")});
$("#clear-import").addEventListener("click",()=>{$("#source-text").value="";$("#import-review").hidden=true;$("#import-form").reset()});
$("#import-form").addEventListener("submit",async e=>{e.preventDefault();try{const v=formObject(e.currentTarget);const saved=await saveProduct(e.currentTarget,"pasted_text",v.source_text);const batch=await supabase.from("amazon_import_batches").insert({capture_method:"pasted_text",source_text:v.source_text,parsed_data:{name:v.name,brand:v.brand,model:v.model,asin:v.asin,product_url:v.product_url,observed_price:v.observed_price},status:"confirmed"});if(batch.error)throw batch.error;status("Producto importado y guardado para revisión editorial.","success");$("#source-text").value="";$("#import-review").hidden=true;switchTab("inventory")}catch(err){status("No se pudo importar: "+err.message,"error")}});

$("#json-file").addEventListener("change",async e=>{
 const file=e.target.files?.[0];$("#json-preview").hidden=true;jsonImportPayload=null;
 if(!file)return;
 try{
  const parsed=JSON.parse(await file.text());
  if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.products)||!parsed.products.length)throw new Error("El archivo debe contener un arreglo products con al menos un registro.");
  if(parsed.products.some(p=>!p||typeof p!=="object"||Array.isArray(p)))throw new Error("Todos los elementos de products deben ser objetos JSON.");
  jsonImportPayload=parsed;renderJsonPreview();
  $("#json-file-feedback").textContent="Archivo válido: "+file.name+" · "+parsed.products.length+" productos.";
  $("#json-file-feedback").dataset.type="success";
 }catch(err){$("#json-file-feedback").textContent="No se pudo leer el JSON: "+err.message;$("#json-file-feedback").dataset.type="error"}
});
$("#confirm-json-import").addEventListener("click",async e=>{e.currentTarget.disabled=true;try{await importSelectedJson()}catch(err){status("No se pudo iniciar la importación: "+err.message,"error")}finally{e.currentTarget.disabled=false}});
$("#cancel-json-import").addEventListener("click",()=>{$("#json-file").value="";$("#json-preview").hidden=true;$("#json-file-feedback").textContent="";jsonImportPayload=null;jsonImportRows=[]});

$("#package-form").addEventListener("submit",async e=>{e.preventDefault();try{const v=formObject(e.currentTarget),selected=[...document.querySelectorAll('input[name="package_product"]:checked')].map(x=>x.value);const {data,error}=await supabase.from("amazon_guide_packages").insert({title:v.title,category_id:v.category_id||null,topic:v.topic||null,editorial_instructions:v.editorial_instructions||null,status:v.status}).select().single();if(error)throw error;if(selected.length){const {error:linkError}=await supabase.from("amazon_guide_package_items").insert(selected.map((product_id,i)=>({package_id:data.id,product_id,sort_order:i})));if(linkError)throw linkError}e.currentTarget.reset();await refreshData();status("Paquete guardado correctamente.","success")}catch(err){status("No se pudo guardar el paquete: "+err.message,"error")}});
$("#packages-list").addEventListener("click",async e=>{const ex=e.target.closest("[data-export]"),del=e.target.closest("[data-delete-package]");try{if(ex)await exportPackage(ex.dataset.export);if(del&&confirm("¿Eliminar este paquete? Los productos del inventario se conservarán.")){const {error}=await supabase.from("amazon_guide_packages").delete().eq("id",del.dataset.deletePackage);if(error)throw error;await refreshData();status("Paquete eliminado.","success")}}catch(err){status("Operación no completada: "+err.message,"error")}});

initializeLocal();
