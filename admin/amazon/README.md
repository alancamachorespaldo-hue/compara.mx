# Centro de Productos Amazon

Módulo interno independiente del catálogo público de Compáralo.mx.

## Desarrollo local sin pantalla de inicio de sesión

El modo local usa un pequeño servidor Node que escucha exclusivamente en `127.0.0.1`. El navegador nunca recibe la clave privilegiada de Supabase.

1. Instala Node.js 18 o posterior.
2. En la raíz del repositorio crea un archivo llamado `.env.local`.
3. Copia estas variables y completa los valores desde Supabase:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SECRET_KEY_O_SERVICE_ROLE_KEY
```

La clave puede aparecer en Supabase como una clave `service_role` (legacy) o una secret key `sb_secret_...`. No uses la publishable/anon key en esta variable. Nunca compartas esta clave ni la pegues en el navegador. El archivo `.env.local` está excluido de Git.

4. Desde la raíz del repositorio ejecuta:

```powershell
node .\admin\amazon\local-server.mjs
```

5. Abre `http://localhost:8000/admin/amazon/`.

Para detener el servidor usa `Ctrl + C`. No abras este modo en una dirección pública ni configures el servidor para escuchar en `0.0.0.0`.

## Seguridad y publicación

- El puente local valida el nombre del host y escucha únicamente en loopback.
- La clave privilegiada solo se lee en el servidor local y no se entrega al navegador.
- El puente permite únicamente las tablas del Centro Amazon.
- Este modo es solo para desarrollo local. No debe desplegarse.
- La versión publicada debe volver a usar Supabase Auth, usuario administrador autorizado y políticas RLS. No se debe reutilizar la clave privilegiada en frontend ni en hosting estático.

## Datos y catálogo

El inventario editorial se almacena en Supabase y permanece separado de `scripts/merged-admin.json` y `productos.json`. Los datos capturados no se publican automáticamente. Los precios observados son históricos/internos; verifica especificaciones y disponibilidad antes de publicar.\n\nAntes de usar la importación JSON, ejecuta `supabase/migrations/002_amazon_json_import.sql` en el SQL Editor de Supabase, después de la migración 001. Para habilitar la categoría Celulares y clasificar productos Samsung importados previamente, ejecuta también `supabase/migrations/003_amazon_mobile_category.sql`. Esta migración agrega el campo `source_record` para conservar cada objeto original y habilita el método `json_import`.

## Captura

El módulo admite captura manual, pegado de texto e importación de colecciones JSON con un arreglo `products`. En JSON, cada producto se presenta para revisión; se detectan ASIN duplicados, se conserva el objeto original completo en `source_record` y el archivo completo en el lote de importación. Los precios se guardan como observaciones históricas. Los enlaces cortos no se convierten en enlaces afiliados verificados. Todos los registros importados quedan en estado `pending`.


### Ficha de celulares

La categoría `celulares` dispone de campos estructurados en la ficha de captura: familia, año, condición, variante, procesador, pantalla, memoria, cámaras, batería, conectividad, calificación, reseñas, vendedor y garantía. Estos datos se guardan dentro de `attributes.mobile`; el objeto original importado permanece en `source_record`. Los campos no presentes en la fuente quedan vacíos y no se completan por inferencia.


### Ficha de laptops

La categoría `laptops` utiliza campos estructurados independientes de celulares: familia, año, condición, SKU/modelo, procesador, núcleos/hilos, GPU/VRAM/TGP, RAM y ampliación, almacenamiento, pantalla, batería, peso, sistema operativo, conectividad, puertos, teclado, webcam, calificación, reseñas, vendedor y garantía. Se guardan en `attributes.laptop`; el JSON de origen completo permanece en `source_record`. Las ofertas y variantes se conservan como registros separados; no se fusionan por familia o modelo sin revisión.
