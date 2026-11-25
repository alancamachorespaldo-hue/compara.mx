/**
 * _nombres.js — cómo se llama en singular y en plural lo que vende cada categoría.
 *
 * Lo usan generar-ofertas.js (filas de /ofertas/) y sync-ofertas-cta.js (el acceso a /ofertas/
 * dentro de cada listado), para que los dos digan lo mismo: "8 freidoras de aire", "Solo las
 * freidoras de aire que bajaron". La clave es la de merged-admin.json / scripts/categorias.js.
 *
 * Una categoría que no esté aquí no rompe nada: cae al título del registro en minúsculas.
 */
export const NOMBRES = {
  laptops: ['laptop', 'laptops'],
  freidoras: ['freidora de aire', 'freidoras de aire'],
  microondas: ['microondas', 'microondas'],
  cafeteras: ['cafetera', 'cafeteras'],
  refrigeradores: ['refrigerador', 'refrigeradores'],
  lavadoras: ['lavadora', 'lavadoras'],
  ollas: ['olla', 'ollas'],
  proteina: ['proteína', 'proteínas'],
  creatina: ['creatina', 'creatinas'],
  omega3: ['omega 3', 'omega 3'],
  magnesio: ['magnesio', 'magnesios'],
  complejo_b: ['complejo B', 'complejos B'],
  vitamina_d: ['vitamina D', 'vitaminas D'],
  videojuegos_consolas: ['consola', 'consolas'],
  videojuegos_controles: ['control', 'controles'],
  videojuegos_juegos: ['videojuego', 'videojuegos'],
  tecnologia_bocinas: ['bocina', 'bocinas'],
  tecnologia_audifonos: ['audífono', 'audífonos'],
  tecnologia_smartwatches: ['smartwatch', 'smartwatches'],
  tecnologia_lentes: ['lentes inteligentes', 'lentes inteligentes'],
  streaming: ['dispositivo de streaming', 'dispositivos de streaming'],
  televisiones: ['televisión', 'televisiones'],
  bicis: ['bici eléctrica', 'bicis eléctricas'],
  bicisMontana: ['bici de montaña', 'bicis de montaña'],
  bicisGravelRuta: ['bici de gravel o ruta', 'bicis de gravel y ruta'],
  celulares_android: ['celular Android', 'celulares Android'],
  celulares_iphone: ['iPhone', 'iPhone'],
};

/** [singular, plural] de una clave de datos; si no está, el título del registro en minúsculas. */
export function nombresDe(cat, titulo) {
  const t = String(titulo || cat).toLowerCase();
  return NOMBRES[cat] || [t, t];
}
