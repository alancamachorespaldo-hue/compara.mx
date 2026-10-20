/**
 * Actualiza las 3 guías de celulares con datos reales del catálogo.
 * Lee merged-admin.json y reemplaza fallbackCelularesData en cada guía.
 * Ejecutar: node scripts/actualizar-guias-celulares.js
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminPath = join(__dirname, "merged-admin.json");
const admin = JSON.parse(readFileSync(adminPath, "utf8"));
const todos = (admin.celulares_android || []).filter(p => p.activo && p.imagen && p.linkML && p.precioML);

function pick(ids) {
  return ids.map(id => {
    const p = todos.find(x => x.id === id) || admin.celulares_android.find(x => x.id === id && x.activo && x.imagen);
    if (!p) { console.warn("No encontrado:", id); return null; }
    return {
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      precioML: p.precioML || null,
      precioAmz: p.precioAmz || null,
      precioReferencia: p.precioML || p.precioAmz || null,
      linkML: p.linkML || null,
      linkAmz: p.linkAmz || null,
      pantalla: p.especs?.pantalla || null,
      ram: p.especs?.ram || null,
      almacenamiento: p.especs?.almacenamiento || null,
      cam: p.especs?.cam || null,
      chip: p.especs?.chip || null,
      bateria: p.especs?.bateria || null,
    };
  }).filter(Boolean);
}

// === Guía: menos de $3,000 ===
const ids3k = [
  "android-motorola-g34-128gb-8gb",          // $2,965 Snapdragon 695 120Hz
  "android-samsung-a16-5g-128gb-4gb",         // $2,701 5G NFC
  "android-samsung-a16-128gb-4gb",            // $2,599 económico
  "android-motorola-moto-g17-128gb-4gb",      // $2,792 G-series confiable
  "android-motorola-moto-g06-256gb-4gb",      // $2,699 256GB almacenamiento
  "android-honor-x5c-plus-128gb-4gb",         // $2,399 Honor accesible
];

// === Guía: $5,000 – $10,000 ===
const ids5k = [
  "android-nothing-phone-3a-lite-256gb-8gb",              // $5,374
  "android-motorola-celular-moto-edge-60-neo-12-256gb-12gb", // $5,919
  "android-samsung-galaxy-a37-5g-256gb-8gb",              // $6,119
  "android-xiaomi-redmi-note-14-pro-plus-5g-256gb-8gb",   // $6,299 200MP
  "android-nothing-nothing-phone-3a-128gb-8gb",           // $7,004
  "android-samsung-galaxy-a56-256gb-12gb",                // $7,299 (si existe)
  "android-xiaomi-redmi-note-15-pro-512gb-8gb",           // $7,672 200MP + Amazon
  "android-google-pixel-9a-128gb-8gb",                    // $8,699
];

// === Guía: buena cámara económica ===
const idsCam = [
  "android-xiaomi-redmi-note-15-pro-512gb-8gb",           // $7,672 200MP + Amazon
  "android-xiaomi-redmi-note-14-pro-plus-5g-256gb-8gb",   // $6,299 200MP
  "android-honor-magic-8-lite-256gb-8gb",                 // $6,199 108MP
  "android-xiaomi-redmi-17-256gb-4gb",                    // $4,599 108MP
  "android-xiaomi-redmi-17-128gb-4gb",                    // $4,265 108MP
  "android-cubot-p90-256gb-12gb",                         // $3,524 100MP
];

const guias = [
  {
    file: join(__dirname, "..", "guias", "celulares", "celulares-menos-3000-mexico", "index.html"),
    ids: ids3k,
    varName: "fallbackCelularesData",
    label: "menos-3000",
  },
  {
    file: join(__dirname, "..", "guias", "celulares", "celulares-5000-10000-mexico", "index.html"),
    ids: ids5k,
    varName: "fallbackCelularesData",
    label: "5000-10000",
  },
  {
    file: join(__dirname, "..", "guias", "celulares", "celulares-buena-camara-economicos", "index.html"),
    ids: idsCam,
    varName: "fallbackCelularesData",
    label: "buena-camara",
  },
];

for (const guia of guias) {
  const productos = pick(guia.ids);
  const json = JSON.stringify(productos, null, 4)
    .replace(/\n/g, "\n    ");           // indent inside <script>
  const bloque = `const ${guia.varName} = ${json};`;

  let html = readFileSync(guia.file, "utf8");
  const regex = new RegExp(
    `(?:var|const|let) ${guia.varName}\\s*=\\s*\\[[\\s\\S]*?\\];`,
    "m"
  );
  if (!regex.test(html)) {
    console.error(`[${guia.label}] No se encontró ${guia.varName} en el HTML`);
    continue;
  }
  html = html.replace(regex, bloque);
  writeFileSync(guia.file, html, "utf8");
  console.log(`[${guia.label}] Actualizado con ${productos.length} productos:`,
    productos.map(p => p.nombre.substring(0, 30)).join(", "));
}
