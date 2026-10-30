/* comparalo.mx — lista única de categorías para el buscador de escritorio (nav-search.js) y el panel móvil (site-nav.js). */
window.CMX_CATS = [
  { name: 'Suplementos',          sub: 'Proteína, Creatina, Magnesio, Complejo B, Omega 3', icon: '💊', url: '/suplementos/',                  tags: ['suplemento','nutricion','gym','vitamina','proteina','creatina','magnesio','omega','complejo b'] },
  { name: 'Bicicletas',           sub: 'Urbanas, eléctricas, montaña',                      icon: '🚲', url: '/bicis/',                        tags: ['bici','ciclo','bike','cycling','mountain','ruta','gravel','electrica'] },
  { name: 'Laptops',              sub: 'Universidad, gaming, trabajo',                      icon: '💻', url: '/laptops/',                      tags: ['laptop','computadora','notebook','portatil','pc','macbook','lenovo','hp','dell','asus','gaming','chromebook'] },
  { name: 'Electrodomésticos',    sub: 'Microondas, freidoras de aire',                     icon: '🏠', url: '/electrodomesticos/',            tags: ['electrodomestico','hogar','casa','cocina','appliance'] },
  { name: 'Microondas',           sub: 'Básico, grill, convección',                         icon: '📡', url: '/electrodomesticos/microondas/', tags: ['horno','microwave','grill'] },
  { name: 'Freidoras de Aire',    sub: 'Sin aceite, digital, compactas',                    icon: '🍟', url: '/electrodomesticos/freidoras/',  tags: ['freidora','air fryer','airfryer','freir','fry'] },
  { name: 'Android',              sub: 'Samsung, Pixel, Motorola y más',                    icon: '🤖', url: '/celulares/android/',            tags: ['samsung','google','pixel','motorola','xiaomi','redmi','celular','smartphone'] },
  { name: 'iPhone',               sub: 'iPhone 17, 18 Pro, 18 Pro Max',                     icon: '🍎', url: '/celulares/iphone/',             tags: ['apple','ios','celular'] },
  { name: 'Videojuegos',          sub: 'Consolas Nintendo, PlayStation, Xbox',              icon: '🎮', url: '/videojuegos/',                  tags: ['videojuego','juego','gaming','nintendo','playstation','xbox','ps5','switch'] },
  { name: 'Consolas',             sub: 'Switch 2, PS5, Xbox Series X',                      icon: '🕹️', url: '/videojuegos/consolas/',         tags: ['consola','console','switch','ps5','xbox','serie x'] },
  { name: 'Tecnología',           sub: 'Alexas, audífonos, smartwatches',                   icon: '🎧', url: '/tecnologia/',                   tags: ['gadget','alexa','echo','teclado','mouse','monitor'] },
  { name: 'Bocinas inteligentes', sub: 'Echo, Echo Dot, Google Nest',                       icon: '🔊', url: '/tecnologia/bocinas/',           tags: ['bocina','speaker','echo','alexa','google nest','nest','altavoz','bose','sonos'] },
  { name: 'Audífonos',            sub: 'In-ear, over-ear, true wireless',                   icon: '🎧', url: '/tecnologia/audifonos/',         tags: ['audifono','auricular','headphone','earphone','true wireless','airpods','inalambrico'] },
  { name: 'Smartwatches',         sub: 'Compatibles con iOS y Android',                     icon: '⌚', url: '/tecnologia/smartwatches/',      tags: ['smartwatch','reloj inteligente','apple watch','galaxy watch','garmin','fitbit','wearable'] }
];

/* Destinos directos que solo aparecen al escribir. */
window.CMX_SUBS = [
  { name: 'Celulares',   sub: 'iPhone y Android',                 icon: '📱', url: '/celulares/',                  tags: ['celular','smartphone','telefono'] },
  { name: 'Proteína',    sub: 'Whey, aislada, vegana',            icon: '💪', url: '/suplementos/proteina/',       tags: ['whey','proteina'] },
  { name: 'Creatina',    sub: 'Monohidratada, micronizada',       icon: '⚡', url: '/suplementos/creatina/',       tags: ['creatina'] },
  { name: 'Magnesio',    sub: 'Citrato, bisglicinato, L-treonato', icon: '🌙', url: '/suplementos/magnesio/',      tags: ['magnesio','dormir'] },
  { name: 'Omega 3',     sub: 'Aceite de pescado, EPA y DHA',     icon: '🐟', url: '/suplementos/omega3/',         tags: ['omega','pescado'] },
  { name: 'Complejo B',  sub: 'B12, B6, ácido fólico',            icon: '🧬', url: '/suplementos/complejo-b/',     tags: ['complejo b','b12','vitamina b'] },
  { name: 'Vitamina D',  sub: 'D3, con o sin K2',                 icon: '☀️', url: '/suplementos/vitamina-d/',     tags: ['vitamina d','d3'] },
  { name: 'Cafeteras',   sub: 'Espresso, cápsulas, automáticas',  icon: '☕', url: '/electrodomesticos/cafeteras/', tags: ['cafetera','cafe','nespresso','dolce gusto','espresso'] },
  { name: 'Controles',   sub: 'Para consola y PC',                icon: '🎮', url: '/videojuegos/controles/',      tags: ['control','joystick','gamepad'] },
  { name: 'Juegos',      sub: 'Físicos y digitales',              icon: '👾', url: '/videojuegos/juegos/',         tags: ['juego','videojuego'] }
];

(window.__cmxQ || []).forEach(function (fn) { try { fn(); } catch (e) {} });
window.__cmxQ = [];
