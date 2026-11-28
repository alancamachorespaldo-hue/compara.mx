/**
 * _geo-mx.js — coordenadas para el mapa de la sección Analítica del Centro.
 *
 * GA4 da la ciudad y el estado de cada visita, pero NO da latitud ni longitud,
 * y el Centro corre en un artifact que no puede llamar a ningún geocodificador.
 * Así que las coordenadas viajan ya resueltas dentro de `analitica.json`, y
 * salen de aquí.
 *
 * Las claves son los nombres TAL COMO LOS ESCRIBE GA4 (en inglés y sin acentos:
 * «Mexico City», «State of Mexico», «Nuevo Leon»), normalizados con `clave()`.
 * La ciudad va con su estado porque hay nombres repetidos: Guadalupe es de
 * Nuevo León y de Zacatecas, La Paz de BCS y del Estado de México.
 *
 * Una ciudad que no está en la tabla (o «(not set)») cae en el centro de su
 * estado y se marca como aproximada (`p:'estado'`): el mapa la pinta, pero el
 * círculo no pretende estar en el lugar exacto. Para afinar una ciudad que
 * pese mucho, se agrega aquí y se vuelve a correr `analitica.mjs`.
 */


export const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* centro aproximado de la zona poblada de cada estado (nombre GA4 → [lat, lon]) */
const ESTADOS = {
  'aguascalientes': [21.88, -102.30], 'baja california': [31.6, -116.0], 'baja california sur': [24.6, -111.0],
  'campeche': [19.2, -90.4], 'chiapas': [16.5, -92.8], 'chihuahua': [28.6, -106.1], 'coahuila': [26.8, -101.8],
  'colima': [19.15, -103.85], 'durango': [24.6, -104.7], 'guanajuato': [20.85, -101.1], 'guerrero': [17.6, -99.7],
  'hidalgo': [20.4, -98.9], 'jalisco': [20.6, -103.5], 'mexico city': [19.38, -99.13], 'state of mexico': [19.4, -99.5],
  'michoacan': [19.5, -101.7], 'morelos': [18.8, -99.1], 'nayarit': [21.7, -104.9], 'nuevo leon': [25.7, -100.3],
  'oaxaca': [17.0, -96.6], 'puebla': [19.0, -98.0], 'queretaro': [20.6, -100.2], 'quintana roo': [20.0, -87.6],
  'san luis potosi': [22.2, -100.6], 'sinaloa': [25.0, -107.6], 'sonora': [29.3, -110.5], 'tabasco': [18.0, -92.9],
  'tamaulipas': [24.3, -98.4], 'tlaxcala': [19.35, -98.2], 'veracruz': [19.4, -96.7], 'yucatan': [20.9, -89.2],
  'zacatecas': [22.9, -102.6]
};

/* nombre en español para enseñar en el Centro (GA4 los da en inglés) */
const NOMBRE_ESTADO = {
  'mexico city': 'Ciudad de México', 'state of mexico': 'Estado de México', 'nuevo leon': 'Nuevo León',
  'michoacan': 'Michoacán', 'queretaro': 'Querétaro', 'san luis potosi': 'San Luis Potosí', 'yucatan': 'Yucatán'
};

/* 'ciudad|estado' → [lat, lon]. Las ciudades que más visitas traen, más las capitales. */
const CIUDADES = {
  'mexico city|mexico city': [19.43, -99.13],
  'guadalajara|jalisco': [20.67, -103.35], 'zapopan|jalisco': [20.72, -103.39], 'tlaquepaque|jalisco': [20.64, -103.31],
  'tonala|jalisco': [20.62, -103.24], 'el salto|jalisco': [20.52, -103.18], 'puerto vallarta|jalisco': [20.65, -105.23],
  'tepatitlan de morelos|jalisco': [20.82, -102.76], 'degollado|jalisco': [20.47, -102.15], 'chapala|jalisco': [20.30, -103.19],
  'tesistan|jalisco': [20.80, -103.48], 'lagos de moreno|jalisco': [21.36, -101.93],
  'monterrey|nuevo leon': [25.67, -100.31], 'garcia|nuevo leon': [25.81, -100.59], 'ciudad apodaca|nuevo leon': [25.78, -100.19],
  'general escobedo|nuevo leon': [25.79, -100.32], 'juarez|nuevo leon': [25.65, -100.10], 'guadalupe|nuevo leon': [25.68, -100.26],
  'san nicolas de los garza|nuevo leon': [25.74, -100.30], 'san pedro garza garcia|nuevo leon': [25.65, -100.40],
  'anahuac|nuevo leon': [27.24, -100.13],
  'puebla|puebla': [19.04, -98.21], 'izucar de matamoros|puebla': [18.60, -98.47], 'tehuacan|puebla': [18.46, -97.39],
  'atlixco|puebla': [18.91, -98.44], 'san pedro cholula|puebla': [19.06, -98.31],
  'merida|yucatan': [20.97, -89.62], 'valladolid|yucatan': [20.69, -88.20], 'tizimin|yucatan': [21.14, -88.15],
  'ecatepec de morelos|state of mexico': [19.60, -99.06], 'cuautitlan izcalli|state of mexico': [19.65, -99.25],
  'ciudad nezahualcoyotl|state of mexico': [19.40, -99.01], 'naucalpan de juarez|state of mexico': [19.48, -99.24],
  'ojo de agua|state of mexico': [19.68, -99.01], 'toluca|state of mexico': [19.29, -99.66],
  'ciudad lopez mateos|state of mexico': [19.56, -99.25], 'ciudad nicolas romero|state of mexico': [19.62, -99.31],
  'valle de chalco|state of mexico': [19.29, -98.94], 'chimalhuacan|state of mexico': [19.42, -98.95],
  'ixtapaluca|state of mexico': [19.32, -98.88], 'san mateo atenco|state of mexico': [19.27, -99.53],
  'tlalnepantla de baz|state of mexico': [19.54, -99.19], 'texcoco|state of mexico': [19.51, -98.88],
  'tepotzotlan|state of mexico': [19.71, -99.22], 'coacalco|state of mexico': [19.63, -99.10],
  'tultepec|state of mexico': [19.69, -99.13], 'chalco de diaz covarrubias|state of mexico': [19.26, -98.90],
  'lerma de villada|state of mexico': [19.28, -99.51], 'melchor ocampo|state of mexico': [19.71, -99.15],
  'cuernavaca|morelos': [18.92, -99.23], 'cuautla|morelos': [18.81, -98.95], 'jiutepec|morelos': [18.88, -99.18],
  'tlayacapan|morelos': [18.96, -98.98],
  'leon|guanajuato': [21.12, -101.68], 'guanajuato|guanajuato': [21.02, -101.26], 'irapuato|guanajuato': [20.68, -101.35],
  'celaya|guanajuato': [20.52, -100.81], 'salamanca|guanajuato': [20.57, -101.19], 'san miguel de allende|guanajuato': [20.91, -100.74],
  'uriangato|guanajuato': [20.14, -101.17], 'moroleon|guanajuato': [20.13, -101.19],
  'morelia|michoacan': [19.70, -101.19], 'patzcuaro|michoacan': [19.51, -101.61], 'uruapan|michoacan': [19.42, -102.06],
  'zamora|michoacan': [19.98, -102.28], 'apatzingan|michoacan': [19.09, -102.35],
  'tijuana|baja california': [32.51, -117.04], 'mexicali|baja california': [32.62, -115.45], 'ensenada|baja california': [31.87, -116.60],
  'tecate|baja california': [32.57, -116.63],
  'la paz|baja california sur': [24.14, -110.31], 'san jose del cabo|baja california sur': [23.06, -109.70],
  'cabo san lucas|baja california sur': [22.89, -109.92],
  'villahermosa|tabasco': [17.99, -92.93], 'cunduacan|tabasco': [18.07, -93.17], 'frontera|tabasco': [18.53, -92.65],
  'jalpa de mendez|tabasco': [18.18, -93.06],
  'santiago de queretaro|queretaro': [20.59, -100.39], 'san juan del rio|queretaro': [20.39, -99.99], 'zibata|queretaro': [20.68, -100.34],
  'aguascalientes|aguascalientes': [21.88, -102.29], 'calvillo|aguascalientes': [21.85, -102.72], 'jesus maria|aguascalientes': [21.96, -102.34],
  'chihuahua|chihuahua': [28.63, -106.07], 'ciudad juarez|chihuahua': [31.69, -106.42], 'jose mariano jimenez|chihuahua': [27.13, -104.92],
  'ciudad cuauhtemoc|chihuahua': [28.41, -106.87],
  'tuxtla gutierrez|chiapas': [16.75, -93.12], 'chiapa de corzo|chiapas': [16.71, -93.01], 'san cristobal de las casas|chiapas': [16.74, -92.64],
  'tapachula|chiapas': [14.90, -92.26], 'comitan de dominguez|chiapas': [16.25, -92.13],
  'cancun|quintana roo': [21.16, -86.85], 'playa del carmen|quintana roo': [20.63, -87.07], 'chetumal|quintana roo': [18.50, -88.30],
  'san miguel de cozumel|quintana roo': [20.51, -86.95],
  'navojoa|sonora': [27.07, -109.44], 'san luis rio colorado|sonora': [32.46, -114.77], 'ciudad obregon|sonora': [27.49, -109.94],
  'hermosillo|sonora': [29.07, -110.96], 'nogales|sonora': [31.31, -110.94], 'caborca|sonora': [30.72, -112.16],
  'cordoba|veracruz': [18.88, -96.93], 'heroica veracruz|veracruz': [19.17, -96.13], 'veracruz|veracruz': [19.17, -96.13],
  'xalapa|veracruz': [19.54, -96.91], 'tuxpam de rodriguez cano|veracruz': [20.96, -97.40], 'coatzacoalcos|veracruz': [18.13, -94.46],
  'las choapas|veracruz': [17.91, -94.10], 'orizaba|veracruz': [18.85, -97.10], 'poza rica|veracruz': [20.53, -97.46],
  'minatitlan|veracruz': [17.99, -94.55], 'panuco|veracruz': [22.05, -98.18], 'xico|veracruz': [19.42, -97.01],
  'culiacan|sinaloa': [24.80, -107.39], 'los mochis|sinaloa': [25.79, -108.99], 'mazatlan|sinaloa': [23.24, -106.41],
  'guasave|sinaloa': [25.57, -108.47],
  'tamazunchale|san luis potosi': [21.26, -98.79], 'san luis potosi|san luis potosi': [22.15, -100.98],
  'villa de reyes|san luis potosi': [21.80, -100.93], 'ciudad valles|san luis potosi': [21.99, -99.01], 'rioverde|san luis potosi': [21.93, -99.99],
  'durango|durango': [24.03, -104.66], 'gomez palacio|durango': [25.57, -103.50], 'lerdo|durango': [25.54, -103.52],
  'santiago papasquiaro|durango': [25.04, -105.42],
  'monclova|coahuila': [26.91, -101.42], 'piedras negras|coahuila': [28.70, -100.52], 'saltillo|coahuila': [25.42, -101.00],
  'ramos arizpe|coahuila': [25.54, -100.95], 'torreon|coahuila': [25.54, -103.41], 'ciudad acuna|coahuila': [29.32, -100.93],
  'chilapa de alvarez|guerrero': [17.59, -99.18], 'acapulco|guerrero': [16.85, -99.82], 'iguala|guerrero': [18.35, -99.54],
  'reynosa|tamaulipas': [26.08, -98.29], 'tampico|tamaulipas': [22.23, -97.86], 'nuevo laredo|tamaulipas': [27.48, -99.52],
  'ciudad victoria|tamaulipas': [23.74, -99.15], 'matamoros|tamaulipas': [25.87, -97.50], 'ciudad madero|tamaulipas': [22.28, -97.83],
  'ciudad mante|tamaulipas': [22.74, -98.97],
  'oaxaca|oaxaca': [17.06, -96.73], 'salina cruz|oaxaca': [16.17, -95.20], 'puerto escondido|oaxaca': [15.86, -97.07],
  'juchitan de zaragoza|oaxaca': [16.43, -95.02], 'san juan bautista tuxtepec|oaxaca': [18.09, -96.12],
  'santa cruz xoxocotlan|oaxaca': [17.03, -96.73],
  'tula|hidalgo': [20.05, -99.34], 'actopan|hidalgo': [20.27, -98.94], 'pachuca|hidalgo': [20.10, -98.76],
  'tulancingo|hidalgo': [20.08, -98.37], 'tizayuca|hidalgo': [19.84, -98.98], 'huejutla de reyes|hidalgo': [21.14, -98.42],
  'ciudad del carmen|campeche': [18.65, -91.83], 'campeche|campeche': [19.85, -90.53],
  'colima|colima': [19.24, -103.72], 'manzanillo|colima': [19.05, -104.32],
  'fresnillo|zacatecas': [23.17, -102.87], 'guadalupe|zacatecas': [22.75, -102.52], 'zacatecas|zacatecas': [22.77, -102.58],
  'tepic|nayarit': [21.50, -104.89],
  'tlaxcala|tlaxcala': [19.32, -98.24], 'chiautempan|tlaxcala': [19.31, -98.19]
};

/** [lat, lon, precisión] de una ciudad de GA4; precisión 'ciudad' | 'estado' | null (sin datos) */
export function ubicar(ciudad, estado) {
  const c = CIUDADES[clave(ciudad) + '|' + clave(estado)];
  if (c) return [c[0], c[1], 'ciudad'];
  const e = ESTADOS[clave(estado)];
  if (e) return [e[0], e[1], 'estado'];
  return null;
}

/** nombre del estado para mostrar: en español cuando cambia, si no el de GA4 */
export function nombreEstado(estado) {
  return NOMBRE_ESTADO[clave(estado)] || estado;
}

