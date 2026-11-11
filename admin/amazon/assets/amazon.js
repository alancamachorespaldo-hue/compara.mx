import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const config=window.AMAZON_SUPABASE_CONFIG;
const statusEl=document.querySelector("#app-status"),authView=document.querySelector("#auth-view"),dashboard=document.querySelector("#dashboard"),loginForm=document.querySelector("#login-form"),logoutButton=document.querySelector("#logout-button");
function status(message,type="info"){statusEl.textContent=message;statusEl.dataset.type=type}
function showDashboard(visible){authView.hidden=visible;dashboard.hidden=!visible;logoutButton.hidden=!visible}
function display(value){return value==null||value===""?"—":String(value)}
if(!config?.url||!config?.publishableKey){status("Falta configurar admin/amazon/config.js. Consulta el README del módulo.","error");loginForm.querySelector("button").disabled=true}
else{
 const supabase=createClient(config.url,config.publishableKey);
 async function loadDashboard(){
  const [p,c,g]=await Promise.all([supabase.from("amazon_products").select("id",{count:"exact",head:true}),supabase.from("amazon_categories").select("id",{count:"exact",head:true}),supabase.from("amazon_guide_packages").select("id",{count:"exact",head:true})]);
  const err=p.error||c.error||g.error;if(err)throw err;
  document.querySelector("#count-products").textContent=p.count??0;document.querySelector("#count-categories").textContent=c.count??0;document.querySelector("#count-packages").textContent=g.count??0;
  const {data,error}=await supabase.from("amazon_products").select("id,name,brand,asin,review_status,created_at").order("created_at",{ascending:false}).limit(10);if(error)throw error;
  const tbody=document.querySelector("#products-table tbody");tbody.replaceChildren();
  for(const item of data||[]){const tr=document.createElement("tr");for(const value of [item.name,item.brand,item.asin,item.review_status]){const td=document.createElement("td");td.textContent=display(value);tr.append(td)}tbody.append(tr)}
  document.querySelector("#empty-products").hidden=Boolean(data?.length);document.querySelector("#products-table").hidden=!data?.length;
 }
 async function enter(session){
  if(!session){showDashboard(false);status("Inicia sesión con el usuario administrador autorizado.");return}
  try{const {error}=await supabase.from("amazon_categories").select("id").limit(1);if(error)throw error;showDashboard(true);status("Sesión iniciada. Conexión con Supabase verificada.","success");await loadDashboard()}
  catch(error){showDashboard(false);status("No se pudo validar el acceso a la base de datos: "+error.message,"error")}
 }
 loginForm.addEventListener("submit",async event=>{event.preventDefault();const button=loginForm.querySelector("button");button.disabled=true;status("Validando credenciales…");const values=new FormData(loginForm);const {data,error}=await supabase.auth.signInWithPassword({email:values.get("email"),password:values.get("password")});button.disabled=false;if(error){status("No se pudo iniciar sesión: "+error.message,"error");return}loginForm.reset();await enter(data.session)});
 logoutButton.addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();if(error)status(error.message,"error");else await enter(null)});
 supabase.auth.onAuthStateChange((_event,session)=>{if(!session)showDashboard(false)});
 supabase.auth.getSession().then(({data,error})=>error?status(error.message,"error"):enter(data.session));
}