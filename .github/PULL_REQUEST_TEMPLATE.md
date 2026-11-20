## Checklist antes de mezclar

- [ ] `node scripts/check-site.js` en verde — valida GA4 (`G-9TKZ4ER13X`), onboarding, tags de afiliado, enlaces sin `.html`, URLs sin barra, JSON-LD y el registro de categorías
- [ ] `node scripts/validar-datos.js` en verde — los JSON de datos se leen, no traen marcas de conflicto y no se quedaron vacíos
- [ ] Los enlaces de afiliado de Amazon conservan su tag: **`comparalo20-20`** en las páginas y guías existentes, **`guiasdecomp01-20`** en las guías nuevas de `/guias-compra/`
- [ ] El sitio abre bien en el navegador (`.claude/launch.json` levanta http://localhost:8765)
- [ ] No se eliminaron productos ni datos existentes
- [ ] `git diff --stat` solo muestra los archivos de este cambio: un commit, un tema

> El tag de Amazon **no** es `comparabici-20`: esa es la cuenta vieja y no se vuelve a ella.
> `check-site.js` acepta `comparalo20-20` y `guiasdecomp01-20`, y falla con cualquier otro.
> Ver la sección «Reglas que nunca se rompen» de `CLAUDE.md`.

Los dos scripts corren también en CI (`check-site.yml`) en cada push y en cada PR, así que
este checklist es para detectar el problema antes, no para sustituirlos.
