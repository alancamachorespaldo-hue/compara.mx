-- Categoría propia de celulares y clasificación de Samsung ya importados.
insert into public.amazon_categories (slug, name, sort_order)
values ('celulares', 'Celulares', 35)
on conflict (slug) do update set name = excluded.name, is_active = true;

-- Clasificar los registros Samsung importados previamente que quedaron sin categoría.
update public.amazon_products p
set category_id = c.id
from public.amazon_categories c
where c.slug = 'celulares'
  and p.category_id is null
  and (
    lower(coalesce(p.brand, '')) = 'samsung'
    or lower(coalesce(p.name, '')) like '%galaxy%'
    or lower(coalesce(p.model, '')) like '%galaxy%'
  );
