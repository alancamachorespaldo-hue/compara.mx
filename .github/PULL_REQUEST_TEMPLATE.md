## Checklist antes de hacer push

- [ ] Todos los archivos HTML modificados tienen el tag GA4 (G-9TKZ4ER13X)
- [ ] Los links de afiliado con tag comparabici-20 están intactos
- [ ] El sitio abre correctamente en el navegador
- [ ] No se eliminaron productos ni datos existentes

Para verificar GA4 ejecuta:

```bash
grep -rL "G-9TKZ4ER13X" --include="*.html" . | grep -v backup | grep -v "-hq" | grep -v "gestor"
```

Si devuelve resultados, hay páginas sin tracking — corrígelas primero.
