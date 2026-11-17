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

const CATALOGOS = [
  { categoria: "celulares_android", salida: ["celulares", "catalog-mini.json"],
    especs: ["pantalla", "ram", "almacenamiento", "cam"] },
  { categoria: "cafeteras", salida: ["electrodomesticos", "cafeteras", "catalog-mini.json"],
    especs: ["tipo", "capacidad", "presion", "vaporizador", "potencia", "molinillo"] },
  { categoria: "creatina", salida: ["suplementos", "creatina", "catalog-mini.json"],
    especs: ["tipoCreatina", "presentacion", "contenidoGramos", "grPorPorcion", "porciones", "costoPor5g", "pura"] },
  { categoria: "videojuegos_consolas", salida: ["videojuegos", "consolas", "catalog-mini.json"],
    especs: ["generacion", "tipoConsola", "almacenamiento", "lectorDiscos", "formatoJuegos", "accesorios", "condicion"] },
  { categoria: "videojuegos_juegos", salida: ["videojuegos", "juegos", "catalog-mini.json"],
    especs: ["plataforma", "formato", "desarrollador", "anio", "genero", "multijugador"] },
];

const admin = JSON.parse(readFileSync(join(__dirname, "merged-admin.json"), "utf8"));

for (const { categoria, salida, especs } of CATALOGOS) {
  const prods = admin[categoria] || [];
  const catalog = {};
  for (const p of prods) {
    if (!p.id || !p.activo) continue;
    const e = {};
    for (const k of especs) e[k] = (p.especs && p.especs[k]) || null;
    catalog[p.id] = {
      nombre:        p.nombre,
      imagen:        p.imagen || null,
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
