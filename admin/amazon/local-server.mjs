import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.PORT || 8000);
const ENV_FILE = path.join(ROOT, ".env.local");
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLES = new Set(["amazon_categories","amazon_products","amazon_product_observations","amazon_guide_packages","amazon_guide_package_items","amazon_import_batches"]);
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
function send(res,status,body,type="application/json; charset=utf-8"){res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(body)}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks).toString("utf8")}
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host||"";
 if(!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(host)){send(res,403,JSON.stringify({error:"Solo se permite acceso local."}));return}
 const url=new URL(req.url,"http://localhost:"+PORT);
 if(url.pathname==="/__local/status"){send(res,200,JSON.stringify({ok:true,configured:Boolean(SUPABASE_URL&&SERVICE_KEY)}));return}
 if(url.pathname.startsWith("/__local/db/")){
  if(!SUPABASE_URL||!SERVICE_KEY){send(res,503,JSON.stringify({error:"Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"}));return}
  const table=url.pathname.slice("/__local/db/".length);
  if(!TABLES.has(table)){send(res,404,JSON.stringify({error:"Tabla no permitida"}));return}
  const target=new URL(SUPABASE_URL+"/rest/v1/"+table);
  for(const [k,v] of url.searchParams)target.searchParams.append(k,v);
  const headers={"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,"Accept":"application/json"};
  if(req.headers["content-type"])headers["Content-Type"]=req.headers["content-type"];
  if(req.headers.prefer)headers.Prefer=req.headers.prefer;
  try{
   const upstream=await fetch(target,{method:req.method,headers,body:["GET","HEAD"].includes(req.method)?undefined:await body(req)});
   const text=upstream.status===204?"":await upstream.text();
   res.writeHead(upstream.status,{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store",...(upstream.headers.get("content-range")?{"Content-Range":upstream.headers.get("content-range")}:{})});
   res.end(text);
  }catch(e){send(res,502,JSON.stringify({error:"No se pudo conectar con Supabase: "+e.message}))}
  return;
 }
 if(req.method!=="GET"&&req.method!=="HEAD"){send(res,405,"Método no permitido","text/plain; charset=utf-8");return}
 let pathname=decodeURIComponent(url.pathname);
 if(pathname==="/")pathname="/index.html";
 const file=path.resolve(ROOT,"."+pathname);
 if(!file.startsWith(ROOT+path.sep)||pathname.includes("/.env")||pathname.includes("/.git")){send(res,403,"Prohibido","text/plain; charset=utf-8");return}
 try{const stat=fs.statSync(file);if(!stat.isFile())throw Error();send(res,200,fs.readFileSync(file),MIME[path.extname(file)]||"application/octet-stream")}catch{send(res,404,"No encontrado","text/plain; charset=utf-8")}
});
server.listen(PORT,"127.0.0.1",()=>console.log("Centro Amazon local: http://localhost:"+PORT+"/admin/amazon/"));
