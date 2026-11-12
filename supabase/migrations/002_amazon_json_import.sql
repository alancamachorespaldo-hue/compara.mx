-- Conserva la procedencia completa de cada registro importado desde JSON.
-- Ejecutar después de 001_centro_productos_amazon.sql.

alter table public.amazon_products
  add column if not exists source_record jsonb;

alter table public.amazon_products
  drop constraint if exists amazon_products_capture_method_check;

alter table public.amazon_products
  add constraint amazon_products_capture_method_check
  check (capture_method in ('manual','pasted_text','json_import'));

alter table public.amazon_import_batches
  drop constraint if exists amazon_import_batches_capture_method_check;

alter table public.amazon_import_batches
  add constraint amazon_import_batches_capture_method_check
  check (capture_method in ('pasted_text','manual_import','json_import'));
