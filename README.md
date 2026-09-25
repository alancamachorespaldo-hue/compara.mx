# comparalo.mx

## ⚠️ REGLA CRÍTICA — GA4 TRACKING

El tag de Google Analytics 4 con ID G-9TKZ4ER13X debe estar
presente en el `<head>` de TODOS los archivos HTML del proyecto
sin excepción.

El snippet exacto que debe aparecer es:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-9TKZ4ER13X"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-9TKZ4ER13X');
</script>
```

**REGLAS OBLIGATORIAS:**
1. Cada vez que crees un archivo HTML nuevo, incluye este tag
2. Cada vez que modifiques un archivo HTML existente, verifica que el tag siga presente antes de hacer commit
3. Nunca reemplaces el ID `G-9TKZ4ER13X` por otro
4. El tag debe ir dentro del `<head>`, antes del `</head>`
5. Al terminar cualquier tarea que modifique HTML, ejecuta este comando de verificación:

```bash
grep -rL "G-9TKZ4ER13X" --include="*.html" . | grep -v backup | grep -v "-hq" | grep -v "gestor"
```

Si ese comando devuelve archivos, significa que hay páginas sin el tag — corrígelas antes de hacer push.

Sitio estático de afiliados publicado en GitHub Pages (rama `main`).

## Carpeta `fotos/`

Las imágenes de categoría van aquí. En `index.html` los `<img>` están comentados dentro de cada `.photo` / `.thumb`; descoméntalos cuando subas el archivo correspondiente:

| Archivo esperado | Sección en index.html | Descripción |
|---|---|---|
| `fotos/suplementos.jpg` | Card grande "Suplementos" | Foto representativa de suplementos deportivos |
| `fotos/bicicletas.jpg` | Card "Bicicletas" | Foto de bicicleta MTB o eléctrica |
| `fotos/laptops.jpg` | Card "Laptops" | Foto de laptop en uso |
| `fotos/electrodomesticos.jpg` | Card "Electrodomésticos" | Foto de freidora de aire o microondas |

Tamaño recomendado: mínimo 800×600 px, formato JPEG, peso < 200 KB.