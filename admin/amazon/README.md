# Centro de Productos Amazon

Módulo privado e independiente del catálogo público y del administrador actual.

## Arquitectura
- Interfaz HTML, CSS y JavaScript modular, sin framework.
- Persistencia Supabase PostgreSQL; autenticación Supabase Auth; autorización mediante RLS y `private.allowed_admins`.
- No modifica `scripts/merged-admin.json`, `productos.json` ni los procesos actuales.

## Configuración
1. Ejecutar `supabase/migrations/001_centro_productos_amazon.sql` en SQL Editor.
2. Crear usuario en Authentication > Users y autorizar su UUID en `private.allowed_admins`.
3. Habilitar Data API y obtener Project URL y Publishable key.
4. Copiar `config.example.js` como `config.js` en esta carpeta; completar URL y Publishable key.
5. `config.js` está excluido de Git. Nunca colocar Secret key/service_role en frontend o repositorio.
6. Servir el repositorio por HTTP local (por ejemplo `python -m http.server 8000`) y abrir `http://localhost:8000/admin/amazon/`.

La Publishable key está diseñada para clientes públicos. La protección de datos depende de RLS. No uses la Secret key en el navegador.

## Funcionalidad inicial
- Login/logout con Supabase Auth.
- Comprobación de acceso mediante consulta protegida por RLS.
- Conteos de productos, categorías y paquetes; tabla de los diez productos recientes.
- Captura, edición, parser y paquetes se implementarán en siguientes fases.

## Modelo
Tablas: `amazon_categories`, `amazon_products`, `amazon_product_observations`, `amazon_guide_packages`, `amazon_guide_package_items`, `amazon_import_batches`, `amazon_audit_logs`. Los atributos variables se guardan en JSONB.

## Reglas
- Precios observados son históricos internos, no precios vigentes publicables.
- Texto pegado requiere revisión; no asumir que es verificado.
- No publicar imágenes, contenido, reseñas o calificaciones de Amazon sin permisos aplicables.
- Nunca inventar campos no identificados.
