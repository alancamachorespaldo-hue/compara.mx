-- Centro de Productos Amazon de Compáralo.mx
-- Ejecutar en Supabase SQL Editor después de crear el proyecto.
-- Acceso privado: un único usuario administrador autorizado.

create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists private.allowed_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function private.is_allowed_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.allowed_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed_admin() to authenticated;

create table if not exists public.amazon_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.amazon_categories(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.amazon_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.amazon_categories(id) on delete set null,
  brand text,
  name text not null,
  model text,
  asin text,
  product_url text,
  affiliate_url text,
  image_url text,
  attributes jsonb not null default '{}'::jsonb,
  source_text text,
  capture_method text not null check (capture_method in ('manual','pasted_text')),
  review_status text not null default 'pending'
    check (review_status in ('pending','in_review','verified','ready','archived')),
  internal_notes text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists amazon_products_asin_unique
  on public.amazon_products (asin) where asin is not null and asin <> '';
create index if not exists amazon_products_category_idx on public.amazon_products(category_id);
create index if not exists amazon_products_status_idx on public.amazon_products(review_status);
create index if not exists amazon_products_name_search_idx on public.amazon_products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(model,'')));

create table if not exists public.amazon_product_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.amazon_products(id) on delete cascade,
  observation_type text not null default 'price'
    check (observation_type in ('price','availability','rating_note','other')),
  amount numeric(12,2),
  currency char(3) not null default 'MXN',
  observed_at timestamptz not null default now(),
  source text not null default 'manual_observation',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists amazon_observations_product_date_idx
  on public.amazon_product_observations(product_id, observed_at desc);

create table if not exists public.amazon_guide_packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.amazon_categories(id) on delete set null,
  topic text,
  editorial_instructions text,
  status text not null default 'draft'
    check (status in ('draft','researching','ready_to_write','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.amazon_guide_package_items (
  package_id uuid not null references public.amazon_guide_packages(id) on delete cascade,
  product_id uuid not null references public.amazon_products(id) on delete cascade,
  sort_order integer not null default 0,
  editorial_note text,
  primary key (package_id, product_id)
);

create table if not exists public.amazon_import_batches (
  id uuid primary key default gen_random_uuid(),
  capture_method text not null check (capture_method in ('pasted_text','manual_import')),
  source_text text,
  parsed_data jsonb not null default '{}'::jsonb,
  status text not null default 'review_pending'
    check (status in ('review_pending','confirmed','discarded')),
  created_at timestamptz not null default now()
);

create table if not exists public.amazon_audit_logs (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_amazon_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists amazon_products_updated_at on public.amazon_products;
create trigger amazon_products_updated_at before update on public.amazon_products
for each row execute function public.set_amazon_updated_at();

drop trigger if exists amazon_guide_packages_updated_at on public.amazon_guide_packages;
create trigger amazon_guide_packages_updated_at before update on public.amazon_guide_packages
for each row execute function public.set_amazon_updated_at();

alter table public.amazon_categories enable row level security;
alter table public.amazon_products enable row level security;
alter table public.amazon_product_observations enable row level security;
alter table public.amazon_guide_packages enable row level security;
alter table public.amazon_guide_package_items enable row level security;
alter table public.amazon_import_batches enable row level security;
alter table public.amazon_audit_logs enable row level security;

-- Sin políticas para anon: acceso anónimo denegado.
-- El usuario autenticado solo obtiene acceso si está registrado en private.allowed_admins.
do $$
declare t text;
begin
  foreach t in array array[
    'amazon_categories','amazon_products','amazon_product_observations',
    'amazon_guide_packages','amazon_guide_package_items',
    'amazon_import_batches','amazon_audit_logs'
  ] loop
    execute format('drop policy if exists "solo_admin_autorizado" on public.%I', t);
    execute format(
      'create policy "solo_admin_autorizado" on public.%I for all to authenticated using (private.is_allowed_admin()) with check (private.is_allowed_admin())',
      t
    );
  end loop;
end $$;

grant select, insert, update, delete on
  public.amazon_categories,
  public.amazon_products,
  public.amazon_product_observations,
  public.amazon_guide_packages,
  public.amazon_guide_package_items,
  public.amazon_import_batches,
  public.amazon_audit_logs
to authenticated;

-- Categorías iniciales; se pueden ampliar desde el panel.
insert into public.amazon_categories (slug, name, sort_order) values
  ('freidoras','Freidoras de aire',10),
  ('hornos','Hornos',20),
  ('microondas','Microondas',30),
  ('laptops','Laptops',40),
  ('suplementos','Suplementos',50),
  ('bicicletas','Bicicletas',60),
  ('electronica','Electrónica',70),
  ('otros','Otros',999)
on conflict (slug) do nothing;

-- Después de crear tu usuario en Authentication > Users:
-- sustituye el UUID por el ID de tu usuario y ejecuta:
-- insert into private.allowed_admins (user_id) values ('TU-USER-UUID');
