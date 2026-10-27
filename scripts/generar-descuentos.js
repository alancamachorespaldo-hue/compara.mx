#!/usr/bin/env node
// Genera celulares/descuentos.json con las 3 bajadas de precio más recientes.
// Se corre en CI después de ml-update.js.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mejorBajada, camposOferta, publicado } from "./_ofertas.js";
const __dirname = dirname(fileURLToPath(import.meta.url));

const adminPath  = join(__dirname, "merged-admin.json");
const outputPath = join(__dirname, "..", "celulares", "descuentos.json");

const admin = JSON.parse(readFileSync(adminPath, "utf8"));
const prods = admin.celulares_android || [];

const drops = prods
  .filter(p => p.activo && !p.ignorarDescuento && p.imagen && publicado(p))
  .map(p => ({ p, b: mejorBajada(p) }))
  .filter(x => x.b)
  .map(({ p, b }) => ({
    id:            p.id,
    nombre:        p.nombre,
    imagen:        p.imagen,
    precioML:      p.precioML || null,
    precioAmz:     p.precioAmz || null,
    ...camposOferta(b),
    linkML:        p.linkML || null,
    linkAmz:       p.linkAmz || null,
    especs: {
      pantalla:       (p.especs && p.especs.pantalla)       || null,
      ram:            (p.especs && p.especs.ram)            || null,
      almacenamiento: (p.especs && p.especs.almacenamiento) || null,
      cam:            (p.especs && p.especs.cam)            || null,
    },
    _updatedAt: p._updatedAt || null,
  }))
  .sort((a, b) => b.ahorro - a.ahorro)
  .slice(0, 3);

const output = {
  generadoEn: new Date().toISOString(),
  descuentos: drops,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(`descuentos.json: ${drops.length} ofertas → ${outputPath}`);
if (drops.length > 0) {
  drops.forEach(d => console.log(`  -${d.pct}% [${d.plataforma}] ${d.nombre}: $${d.precioAntes} → $${d.precioOferta} (ahorro $${d.ahorro})`));
}
