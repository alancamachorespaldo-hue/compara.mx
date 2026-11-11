# Centro de Productos Amazon

Módulo privado e independiente del catálogo público y del administrador actual.

## Arquitectura

- Interfaz: HTML, CSS y JavaScript modular.
- Persistencia: Supabase PostgreSQL.
- Autenticación: Supabase Auth, un único usuario administrador.
- Autorización: tabla privada `private.allowed_admins` y políticas RLS.
- Exportación: JSON local para paquetes de investigación y guías.
- No modifica `scripts/merged-admin.json`, `productos.json` ni los procesos actuales de sincronización.

## Estado

Esta primera entrega prepara la arquitectura y el esquema de datos. La interfaz conectada se implementará después de configurar Supabase y registrar el usuario administrador.

## Configuración de Supabase

1. Crear un proyecto Supabase.
2. Ejecutar `supabase/migrations/001_centro_productos_amazon.sql` en SQL Editor.
3. En Authentication > Users, crear un usuario con correo y contraseña.
4. Copiar el UUID de ese usuario.
5. Ejecutar en SQL Editor:

```sql
insert into private.allowed_admins (user_id)
values ('UUID-DEL-UNICO-ADMIN');
```

6. Obtener Project URL y Publishable key desde Project Settings > API.
7. Configurar esos valores en el módulo cuando se implemente el cliente. Nunca guardar service_role key en el navegador ni en Git.

## Modelo de datos

- `amazon_categories`: categorías y subcategorías.
- `amazon_products`: ficha general y atributos específicos en JSONB.
- `amazon_product_observations`: precios/observaciones con fecha y origen.
- `amazon_guide_packages`: paquetes editoriales.
- `amazon_guide_package_items`: productos asociados a cada paquete.
- `amazon_import_batches`: capturas pegadas pendientes de revisión.
- `amazon_audit_logs`: historial de acciones.

## Reglas de datos

- Un precio capturado manualmente es una observación histórica interna, no un precio vigente publicable.
- El texto pegado conserva su procedencia y requiere revisión.
- No publicar imágenes, contenido, reseñas o calificaciones de Amazon sin los permisos aplicables.
- Los campos no identificados deben quedar vacíos; nunca inventar valores.
