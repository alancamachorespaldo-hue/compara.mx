-- Agrega la categoría Smartwatches al Centro de Productos Amazon.
-- Idempotente: puede ejecutarse más de una vez sin crear duplicados.

insert into public.amazon_categories (slug, name, sort_order, is_active)
values ('smartwatches', 'Smartwatches', 45, true)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;
