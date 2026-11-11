# Centro de Productos Amazon

Aplicación privada HTML/CSS/JS conectada a Supabase. No modifica el catálogo público, `scripts/merged-admin.json`, `productos.json` ni sus sincronizaciones.

## Configuración local
1. Copia `config.example.js` como `config.js` y completa Project URL y Publishable key.
2. `config.js` está excluido de Git. Nunca uses Secret/service_role key en el navegador.
3. Desde la raíz del repositorio ejecuta `py -m http.server 8000`.
4. Abre `http://localhost:8000/admin/amazon/`.

## Módulos implementados
- Inventario: búsqueda, filtro por categoría/estado, alta, edición y eliminación.
- Captura manual: ficha general, categoría, estado, URLs, atributos JSON, notas y observación de precio interno.
- Importar texto: extracción preliminar de título, marca/modelo etiquetados, ASIN, URL y precio; revisión manual obligatoria antes de guardar. El parser es heurístico y no garantiza identificar todos los campos.
- Paquetes: creación, asociación de productos, eliminación y exportación JSON con observaciones disponibles.

## Criterios de datos
- Los precios capturados son observaciones internas con fecha; no son precios vigentes publicables.
- Los atributos específicos se guardan como JSONB y deben verificarse.
- No publicar imágenes, contenido, reseñas ni calificaciones de Amazon sin permisos aplicables.
- El parser no verifica datos: la persona administradora debe revisarlos.
- Los productos se guardan en tablas independientes del catálogo comparativo público.
