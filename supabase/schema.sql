create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  password_hash text not null,
  role text not null check (role in ('admin','ufficio','agente','laboratorio')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  priority text not null check (priority in ('Alta','Media','Bassa')),
  notes text not null default '',
  status text not null check (status in ('ORDINE DA LAVORARE','ORDINE IN LAVORAZIONE','ORDINE PRONTO')),
  created_by_user_id uuid not null references public.app_users(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  category_lock text null
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  sku_snapshot text not null,
  product_name_snapshot text not null,
  category_snapshot text not null,
  quantity integer not null check (quantity > 0),
  sort_order integer not null default 1
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_lines_order_id on public.order_lines(order_id);
