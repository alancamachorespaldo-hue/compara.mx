-- Recuperar los enlaces originales y precios de los productos JSON ya importados.
-- No sobrescribe enlaces afiliados que el usuario haya capturado manualmente.
update public.amazon_products
set
  affiliate_url = coalesce(
    nullif(affiliate_url, ''),
    nullif(source_record #>> '{listing,amazon_short_url}', ''),
    nullif(source_record #>> '{listing,affiliate_url}', ''),
    nullif(source_record ->> 'amazon_short_url', ''),
    nullif(source_record ->> 'affiliate_url', '')
  ),
  product_url = coalesce(
    nullif(product_url, ''),
    nullif(source_record #>> '{listing,product_url}', ''),
    nullif(source_record #>> '{listing,url}', ''),
    nullif(source_record #>> '{listing,amazon_short_url}', ''),
    nullif(source_record ->> 'amazon_short_url', '')
  )
where source_record is not null;

-- Las observaciones históricas ya creadas por la importación no se duplican.
-- Este índice ayuda a consultar las observaciones recientes por producto.
create index if not exists amazon_observations_type_date_idx
on public.amazon_product_observations(product_id, observation_type, observed_at desc);
