#!/usr/bin/env node
// Genera los catalog-mini.json (imagen + precio + especs por producto) que leen las guías.
// Se corre en CI después de ml-update.js y generar-admin.js.
//
// Cada entrada de CATALOGOS dice de qué categoría de merged-admin.json sale, dónde se escribe
// y qué especificaciones se publican. Las guías lo bajan en C.catalogUrl: ahí toman el precio
// vivo (por linkML), las especs de la tarjeta y la verificación de las ofertas del día.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Qué categorías publican catalog-mini.json sale del registro único scripts/categorias.js.
import { conCatalogMini } from "./categorias.js";

const CATALOGOS = conCatalogMini().map(c => ({ categoria: c.datos, ...c.catalogMini }));

const admin = JSON.parse(readFileSync(join(__dirname, "merged-admin.json"), "utf8"));

for (const { categoria, salida, especs } of CATALOGOS) {
  const prods = admin[categoria] || [];
  const catalog = {};
  for (const p of prods) {
    if (!p.id || !p.activo) continue;
    const e = {};
    /* Cada categoría guarda sus especificaciones donde le toca: cafeteras y suplementos las
       llevan en `p.especs`, pero televisiones (y los listados nacidos del Excel) las tienen
       como campos del propio producto (`pulgadas`, `resolucion`, `panel`…). Se busca primero
       en `especs` y, si ahí no hay nada, en el producto; así una categoría nueva no necesita
       duplicar sus datos para publicar catalog-mini.json. Ojo: `false` y `0` son valores
       válidos (hdr:false), por eso no se usa `||`. */
    for (const k of especs) {
      let v = p.especs ? p.especs[k] : undefined;
      if (v === undefined || v === '') v = p[k];
      e[k] = v === undefined || v === '' ? null : v;
    }
    catalog[p.id] = {
      nombre:        p.nombre,
      imagen:        p.imagen || p.img || null,   /* televisiones y otros listados guardan la foto en `img` */
      precioML:      p.precioML || null,
      precioAmz:     p.precioAmz || null,
      linkML:        p.linkML || null,
      linkAmz:       p.linkAmz || null,
      especs:        e,
      _updatedAt:    p._updatedAt || null,
    };
  }
  const outputPath = join(__dirname, "..", ...salida);
  writeFileSync(outputPath, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`catalog-mini.json: ${Object.keys(catalog).length} productos (${categoria}) → ${outputPath}`);
}
