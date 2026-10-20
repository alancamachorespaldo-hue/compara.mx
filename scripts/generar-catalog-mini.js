#!/usr/bin/env node
// Genera celulares/catalog-mini.json con imagen + especs por producto del catálogo android.
// Se corre en CI después de ml-update.js y generar-admin.js.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

const adminPath  = join(__dirname, "merged-admin.json");
const outputPath = join(__dirname, "..", "celulares", "catalog-mini.json");

const admin = JSON.parse(readFileSync(adminPath, "utf8"));
const prods = admin.celulares_android || [];

const catalog = {};
for (const p of prods) {
  if (!p.id || !p.activo) continue;
  catalog[p.id] = {
    nombre:        p.nombre,
    imagen:        p.imagen || null,
    precioML:      p.precioML || null,
    precioAmz:     p.precioAmz || null,
    linkML:        p.linkML || null,
    linkAmz:       p.linkAmz || null,
    especs: {
      pantalla:      (p.especs && p.especs.pantalla)      || null,
      ram:           (p.especs && p.especs.ram)           || null,
      almacenamiento:(p.especs && p.especs.almacenamiento)|| null,
      cam:           (p.especs && p.especs.cam)           || null,
    },
    _updatedAt: p._updatedAt || null,
  };
}

writeFileSync(outputPath, JSON.stringify(catalog, null, 2), "utf8");
console.log(`catalog-mini.json: ${Object.keys(catalog).length} productos → ${outputPath}`);
