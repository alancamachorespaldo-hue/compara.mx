## Checklist antes de mezclar

- [ ] `node scripts/check-site.js` en verde — valida GA4 (`G-9TKZ4ER13X`), onboarding, tags de afiliado, enlaces sin `.html`, URLs sin barra, JSON-LD y el registro de categorías
- [ ] `node scripts/validar-datos.js` en verde — los JSON de datos se leen, no traen marcas de conflicto y no se quedaron vacíos
- [ ] Todos los enlaces de afiliado de Amazon llevan **`tag=guiasdecomp01-20`**, el único tag del sitio
- [ ] El sitio abre bien en el navegador (`.claude/launch.json` levanta http://localhost:8765)
- [ ] No se eliminaron productos ni datos existentes
- [ ] `git diff --stat` solo muestra los archivos de este cambio: un commit, un tema

> `comparalo20-20` y `comparabici-20` son cuentas viejas que ya no existen y no se reponen.
> `check-site.js` solo acepta `guiasdecomp01-20` y falla con cualquier otro.
> Ver la sección «Reglas que nunca se rompen» de `CLAUDE.md`.

Los dos scripts corren también en CI (`check-site.yml`) en cada push y en cada PR, así que
este checklist es para detectar el problema antes, no para sustituirlos.
