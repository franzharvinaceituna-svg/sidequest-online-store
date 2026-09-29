-- ============================================================================
-- SIDE QUEST — Phase 2 foundation
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- Contains: tables, constraints, RLS, storefront/admin views, server-side
-- inventory + order functions, audit triggers, storage bucket + policies.
-- Contains NO demo products (see supabase/seed_demo.sql, optional).
--
-- Security model
--   • anon / customers: read ONLY the storefront_* views + categories; write ONLY
--     through place_order() and submit_contact_message().
--   • admins: rows in admin_profiles (OWNER or STAFF + permissions). All admin
--     writes go through SECURITY DEFINER functions that check permissions.
--   • Base tables have RLS enabled. No table is readable by anon.
--   • Costs are visible only with VIEW_COST (OWNER has every permission).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create sequence if not exists public.inventory_item_seq start 123;
create sequence if not exists public.order_number_seq start 1001;

-- ---------------------------------------------------------------------------
-- Admin profiles & permissions
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text,
  role         text not null default 'STAFF' check (role in ('OWNER','STAFF')),
  permissions  text[] not null default '{}' check (permissions <@ array['VIEW_INVENTORY','EDIT_INVENTORY','MANAGE_ORDERS','MANAGE_PRODUCTS','VIEW_COST','MANAGE_SETTINGS']::text[]),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger admin_profiles_updated before update on public.admin_profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_profiles where user_id = auth.uid() and active)
$$;

create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_profiles where user_id = auth.uid() and active and (role = 'OWNER' or p = any(permissions)))
$$;

create or replace function public.require_permission(p text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission(p) then raise exception 'Not authorized (%).', p using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  category_id text primary key,
  name        text not null,
  label       text,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table public.products (
  product_id      text primary key check (product_id ~ '^[A-Z0-9][A-Z0-9-]*$'),
  sku             text not null unique,
  name            text not null check (length(trim(name)) > 0),
  slug            text not null unique,
  category_id     text not null references public.categories on update cascade,
  subcategory     text,
  description     text,
  pokemon         text,
  set_name        text,
  card_number     text,
  language        text not null default 'English',
  condition       text check (condition in ('NM','LP','MP','HP','DMG','New','Sealed')),
  product_type    text not null check (product_type in ('SINGLE','GRADED_CARD','SEALED','ACCESSORY','COLLECTIBLE','PLUSH','OTHER')),
  grading_company text check (grading_company in ('PSA','BGS','CGC','Other')),
  grade           numeric(3,1) check (grade between 1 and 10),
  price           numeric(12,2) not null check (price > 0),
  cost            numeric(12,2) check (cost >= 0),          -- VIEW_COST only
  sale_price      numeric(12,2) check (sale_price > 0),
  featured        boolean not null default false,
  on_sale         boolean not null default false,
  status          text not null default 'DRAFT' check (status in ('ACTIVE','DRAFT','ARCHIVED')),
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sale_price_below_price check (not on_sale or (sale_price is not null and sale_price < price)),
  constraint graded_has_grade check (product_type <> 'GRADED_CARD' or (grading_company is not null and grade is not null))
);
create index products_category_idx on public.products (category_id) where status = 'ACTIVE';
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_images (
  image_id     uuid primary key default gen_random_uuid(),
  product_id   text not null references public.products on delete cascade on update cascade,
  storage_path text not null,                 -- product-images/products/<product_id>/<file>
  public_url   text,
  sort_order   int not null default 0,
  is_primary   boolean not null default false,
  alt_text     text,
  created_at   timestamptz not null default now()
);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- Customers (guests supported; auth_user_id linked later)
-- ---------------------------------------------------------------------------
create table public.customers (
  customer_id  uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users on delete set null,
  name         text not null,
  email        text not null,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index customers_email_key on public.customers (lower(email));
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  order_id             uuid primary key default gen_random_uuid(),
  order_number         text not null unique default ('SQ-ORD-' || nextval('public.order_number_seq')),
  customer_id          uuid references public.customers on delete set null,
  status               text not null default 'PAYMENT_PENDING' check (status in ('PENDING','PAYMENT_PENDING','PAID','PROCESSING','PACKED','SHIPPED','COMPLETED','CANCELLED','REFUNDED')),
  payment_method       text not null check (payment_method in ('GCASH','BANK_TRANSFER','ONLINE_GATEWAY','COD')),
  payment_status       text not null default 'UNPAID' check (payment_status in ('UNPAID','PENDING_VERIFICATION','PAID','FAILED','REFUNDED')),
  payment_reference    text,                    -- e.g. GCash ref no. Never card data.
  stock_state          text not null default 'RESERVED' check (stock_state in ('RESERVED','COMMITTED','RELEASED','RESTOCKED')),
  subtotal             numeric(12,2) not null check (subtotal >= 0),
  shipping_fee         numeric(12,2) check (shipping_fee >= 0),   -- null = TBD
  discount             numeric(12,2) not null default 0 check (discount >= 0),
  total                numeric(12,2) not null check (total >= 0),
  shipping_name        text not null,
  shipping_email       text not null,
  shipping_phone       text not null,
  shipping_address     text not null,
  shipping_city        text not null,
  shipping_province    text not null,
  shipping_postal_code text not null,
  customer_notes       text,
  access_token         uuid not null default gen_random_uuid(),   -- lets a guest view their own order
  expires_at           timestamptz,             -- unpaid reservation deadline
  cancel_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index orders_expiry_idx on public.orders (expires_at) where stock_state = 'RESERVED';
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory: ONE ROW PER PHYSICAL UNIT (singles, slabs AND bulk goods)
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  inventory_item_id text primary key default ('SQ-INV-' || lpad(nextval('public.inventory_item_seq')::text, 6, '0')),
  product_id        text not null references public.products on update cascade,
  card_ledger_id    text unique,               -- future Card Ledger physical item id
  sku               text,
  status            text not null default 'AVAILABLE' check (status in ('AVAILABLE','RESERVED','SOLD','ARCHIVED')),
  condition         text check (condition in ('NM','LP','MP','HP','DMG','New','Sealed')),
  grading_company   text,
  grade             numeric(3,1) check (grade between 1 and 10),
  cert_number       text unique,
  acquisition_cost  numeric(12,2) check (acquisition_cost >= 0),  -- VIEW_COST only
  internal_notes    text,
  reserved_order_id uuid references public.orders on delete set null,
  sold_order_id     uuid references public.orders on delete set null,
  hold_reason       text,                      -- manual admin reservation (no order)
  sold_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A unit is in exactly one state; the links must match it.
  constraint available_is_clean check (status <> 'AVAILABLE' or (reserved_order_id is null and sold_order_id is null and hold_reason is null)),
  constraint reserved_has_reason check (status <> 'RESERVED' or (sold_order_id is null and (reserved_order_id is not null or hold_reason is not null))),
  constraint only_reserved_links check (status = 'RESERVED' or (reserved_order_id is null and hold_reason is null)),
  constraint sold_has_date check (status <> 'SOLD' or sold_at is not null)
);
create index inventory_items_product_status on public.inventory_items (product_id, status);
create trigger inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();

create table public.inventory_item_images (
  image_id          uuid primary key default gen_random_uuid(),
  inventory_item_id text not null references public.inventory_items on delete cascade,
  storage_path      text not null,             -- product-images/inventory/<inventory_item_id>/<file>
  public_url        text,
  sort_order        int not null default 0,
  is_primary        boolean not null default false,
  image_type        text not null default 'OTHER' check (image_type in ('FRONT','BACK','SLAB','DETAIL','OTHER')),
  created_at        timestamptz not null default now()
);

create table public.order_items (
  order_item_id         uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders on delete cascade,
  product_id            text not null references public.products on update cascade,
  inventory_item_id     text not null references public.inventory_items,
  product_name_snapshot text not null,
  sku_snapshot          text,
  price_snapshot        numeric(12,2) not null check (price_snapshot >= 0),
  quantity              int not null default 1 check (quantity = 1),   -- one row per physical unit
  released_at           timestamptz,           -- set when reservation is released or the unit restocked
  created_at            timestamptz not null default now()
);
-- THE double-sell guard: a physical unit can be on at most one live order line.
create unique index order_items_one_live_line_per_unit on public.order_items (inventory_item_id) where released_at is null;
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table public.inventory_events (
  event_id          bigint generated always as identity primary key,
  inventory_item_id text not null references public.inventory_items on delete cascade,
  order_id          uuid references public.orders on delete set null,
  event_type        text not null,             -- CREATED, RESERVED, RELEASED, EXPIRED, HOLD_EXTENDED, SOLD, RETURNED_TO_STOCK, HOLD, ARCHIVED, STATUS_CHANGE
  previous_status   text,
  new_status        text,
  performed_by      uuid,                      -- auth user (null = customer checkout / system job)
  actor             text not null default 'system',   -- 'admin' | 'customer' | 'system'
  notes             text,
  created_at        timestamptz not null default now()
);
create index inventory_events_item_idx on public.inventory_events (inventory_item_id, created_at);

create table public.order_events (
  event_id     bigint generated always as identity primary key,
  order_id     uuid not null references public.orders on delete cascade,
  field        text not null,                  -- status | payment_status | shipping_fee | stock_state | expires_at
  previous     text,
  new          text,
  performed_by uuid,
  actor        text not null default 'system',
  notes        text,
  created_at   timestamptz not null default now()
);

create or replace function public._actor() returns text language sql stable as $$
  select case when auth.uid() is null then coalesce(nullif(current_setting('sq.actor', true), ''), 'system')
              when public.is_admin() then 'admin' else 'customer' end
$$;

create or replace function public.log_inventory_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_type text := nullif(current_setting('sq.event_type', true), '');
        v_note text := nullif(current_setting('sq.event_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into inventory_events (inventory_item_id, event_type, previous_status, new_status, performed_by, actor, notes)
    values (new.inventory_item_id, 'CREATED', null, new.status, auth.uid(), _actor(), v_note);
  elsif new.status is distinct from old.status then
    insert into inventory_events (inventory_item_id, order_id, event_type, previous_status, new_status, performed_by, actor, notes)
    values (new.inventory_item_id, coalesce(new.reserved_order_id, new.sold_order_id, old.reserved_order_id, old.sold_order_id),
            coalesce(v_type, 'STATUS_CHANGE'), old.status, new.status, auth.uid(), _actor(), v_note);
  end if;
  return new;
end $$;
create trigger inventory_items_audit after insert or update on public.inventory_items for each row execute function public.log_inventory_event();

create or replace function public.log_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_note text := nullif(current_setting('sq.event_note', true), '');
begin
  if new.status is distinct from old.status then insert into order_events (order_id, field, previous, new, performed_by, actor, notes) values (new.order_id, 'status', old.status, new.status, auth.uid(), _actor(), v_note); end if;
  if new.payment_status is distinct from old.payment_status then insert into order_events (order_id, field, previous, new, performed_by, actor, notes) values (new.order_id, 'payment_status', old.payment_status, new.payment_status, auth.uid(), _actor(), v_note); end if;
  if new.shipping_fee is distinct from old.shipping_fee then insert into order_events (order_id, field, previous, new, performed_by, actor, notes) values (new.order_id, 'shipping_fee', old.shipping_fee::text, new.shipping_fee::text, auth.uid(), _actor(), v_note); end if;
  if new.expires_at is distinct from old.expires_at and new.stock_state = 'RESERVED' and old.stock_state = 'RESERVED' then insert into order_events (order_id, field, previous, new, performed_by, actor, notes) values (new.order_id, 'expires_at', old.expires_at::text, new.expires_at::text, auth.uid(), _actor(), v_note); end if;
  if new.stock_state is distinct from old.stock_state then insert into order_events (order_id, field, previous, new, performed_by, actor, notes) values (new.order_id, 'stock_state', old.stock_state, new.stock_state, auth.uid(), _actor(), v_note); end if;
  return new;
end $$;
create trigger orders_audit after update on public.orders for each row execute function public.log_order_event();

-- ---------------------------------------------------------------------------
-- Wishlists (for future customer accounts; guests keep a device wishlist)
-- ---------------------------------------------------------------------------
create table public.wishlists (
  wishlist_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers on delete cascade,
  created_at  timestamptz not null default now()
);
create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists on delete cascade,
  product_id  text not null references public.products on delete cascade on update cascade,
  created_at  timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table public.contact_messages (
  message_id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, topic text, message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled on EVERY table
-- ---------------------------------------------------------------------------
alter table public.admin_profiles        enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.customers             enable row level security;
alter table public.orders                enable row level security;
alter table public.inventory_items       enable row level security;
alter table public.inventory_item_images enable row level security;
alter table public.order_items           enable row level security;
alter table public.inventory_events      enable row level security;
alter table public.order_events          enable row level security;
alter table public.wishlists             enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.contact_messages      enable row level security;

-- Public: categories only. Everything else public goes through storefront_* views.
create policy categories_public_read on public.categories for select using (true);

-- Admin reads. (No INSERT/UPDATE/DELETE policies: writes go through the functions below.)
create policy admin_profiles_self_or_owner on public.admin_profiles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('MANAGE_SETTINGS'));
create policy products_cost_readers on public.products for select to authenticated using (public.has_permission('VIEW_COST'));
create policy product_images_admin on public.product_images for select to authenticated using (public.is_admin());
create policy inventory_items_cost_readers on public.inventory_items for select to authenticated using (public.has_permission('VIEW_COST'));
create policy inventory_item_images_admin on public.inventory_item_images for select to authenticated using (public.is_admin());
create policy customers_orders_admin on public.customers for select to authenticated using (public.has_permission('MANAGE_ORDERS') or auth_user_id = auth.uid());
create policy orders_admin on public.orders for select to authenticated using (public.has_permission('MANAGE_ORDERS'));
create policy order_items_admin on public.order_items for select to authenticated using (public.has_permission('MANAGE_ORDERS'));
create policy inventory_events_admin on public.inventory_events for select to authenticated using (public.has_permission('VIEW_INVENTORY'));
create policy order_events_admin on public.order_events for select to authenticated using (public.has_permission('MANAGE_ORDERS'));
create policy contact_messages_admin on public.contact_messages for select to authenticated using (public.is_admin());
-- Future signed-in customers manage their own wishlist
create policy wishlists_owner on public.wishlists for all to authenticated
  using (customer_id in (select customer_id from public.customers where auth_user_id = auth.uid()))
  with check (customer_id in (select customer_id from public.customers where auth_user_id = auth.uid()));
create policy wishlist_items_owner on public.wishlist_items for all to authenticated
  using (wishlist_id in (select w.wishlist_id from public.wishlists w join public.customers c using (customer_id) where c.auth_user_id = auth.uid()))
  with check (wishlist_id in (select w.wishlist_id from public.wishlists w join public.customers c using (customer_id) where c.auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storefront views (public API). Run as view owner → expose safe columns only.
-- ---------------------------------------------------------------------------
create view public.storefront_products as
select p.product_id, p.sku, p.name, p.slug, p.category_id, p.subcategory, p.description, p.pokemon, p.set_name,
       p.card_number, p.language, p.condition, p.product_type, p.grading_company, p.grade, p.price, p.sale_price,
       p.featured, p.on_sale, p.tags, p.created_at, p.updated_at,
       (select count(*) from public.inventory_items i where i.product_id = p.product_id and i.status = 'AVAILABLE')::int as available_quantity
from public.products p
where p.status = 'ACTIVE';

create view public.storefront_product_images as
select pi.image_id, pi.product_id, pi.public_url, pi.storage_path, pi.sort_order, pi.is_primary, pi.alt_text
from public.product_images pi join public.products p using (product_id)
where p.status = 'ACTIVE';

create view public.storefront_items as
select i.inventory_item_id, i.product_id, i.condition, i.grading_company, i.grade, i.cert_number
from public.inventory_items i join public.products p using (product_id)
where p.status = 'ACTIVE' and i.status = 'AVAILABLE';

create view public.storefront_item_images as
select im.image_id, im.inventory_item_id, im.public_url, im.storage_path, im.sort_order, im.is_primary, im.image_type
from public.inventory_item_images im join public.storefront_items si using (inventory_item_id);

-- ---------------------------------------------------------------------------
-- Admin views (cost masked unless VIEW_COST; rows only for permitted staff)
-- ---------------------------------------------------------------------------
create view public.admin_products as
select p.product_id, p.sku, p.name, p.slug, p.category_id, p.subcategory, p.description, p.pokemon, p.set_name, p.card_number,
       p.language, p.condition, p.product_type, p.grading_company, p.grade, p.price,
       case when public.has_permission('VIEW_COST') then p.cost end as cost,
       p.sale_price, p.featured, p.on_sale, p.status, p.tags, p.created_at, p.updated_at,
       s.quantity, s.reserved_quantity, s.order_reserved, (s.quantity - s.reserved_quantity) as available_quantity
from public.products p
cross join lateral (
  select count(*) filter (where i.status in ('AVAILABLE','RESERVED'))::int as quantity,
         count(*) filter (where i.status = 'RESERVED')::int as reserved_quantity,
         count(*) filter (where i.status = 'RESERVED' and i.reserved_order_id is not null)::int as order_reserved
  from public.inventory_items i where i.product_id = p.product_id) s
where public.has_permission('VIEW_INVENTORY') or public.has_permission('MANAGE_PRODUCTS');

create view public.admin_inventory_items as
select i.inventory_item_id, i.product_id, i.card_ledger_id, i.sku, i.status, i.condition, i.grading_company, i.grade, i.cert_number,
       case when public.has_permission('VIEW_COST') then i.acquisition_cost end as acquisition_cost,
       i.internal_notes, i.hold_reason, i.sold_at, i.created_at, i.updated_at,
       ro.order_number as reserved_order_number, so.order_number as sold_order_number
from public.inventory_items i
left join public.orders ro on ro.order_id = i.reserved_order_id
left join public.orders so on so.order_id = i.sold_order_id
where public.has_permission('VIEW_INVENTORY');

create view public.admin_product_images as select * from public.product_images where public.is_admin();
create view public.admin_inventory_item_images as select * from public.inventory_item_images where public.is_admin();
create view public.admin_orders as
select order_id, order_number, customer_id, status, payment_method, payment_status, payment_reference, stock_state, subtotal, shipping_fee,
       discount, total, shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_province,
       shipping_postal_code, customer_notes, expires_at, cancel_reason, created_at, updated_at
from public.orders where public.has_permission('MANAGE_ORDERS');
create view public.admin_order_items as select * from public.order_items where public.has_permission('MANAGE_ORDERS');
create view public.admin_inventory_events as select * from public.inventory_events where public.has_permission('VIEW_INVENTORY');

-- Grants: anon gets views + categories only; tables stay RLS-protected.
revoke all on all tables in schema public from anon;
grant select on public.categories, public.storefront_products, public.storefront_product_images,
                public.storefront_items, public.storefront_item_images to anon, authenticated;
grant select on public.admin_products, public.admin_inventory_items, public.admin_product_images, public.admin_inventory_item_images,
                public.admin_orders, public.admin_order_items, public.admin_inventory_events to authenticated;
revoke select on public.admin_products, public.admin_inventory_items, public.admin_product_images, public.admin_inventory_item_images,
                 public.admin_orders, public.admin_order_items, public.admin_inventory_events from anon;

-- ---------------------------------------------------------------------------
-- Customer-facing functions
-- ---------------------------------------------------------------------------
-- place_order: prices come from the database, never the browser. Units are locked
-- with FOR UPDATE SKIP LOCKED so two checkouts can never take the same unit.
create or replace function public.place_order(p_customer jsonb, p_address jsonb, p_payment_method text, p_items jsonb, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid; v_customer_id uuid; v_line jsonb; v_product products%rowtype; v_qty int;
  v_units text[]; v_price numeric; v_subtotal numeric := 0; v_order orders%rowtype;
begin
  if p_payment_method not in ('GCASH','BANK_TRANSFER') then raise exception 'Please choose an available payment method.'; end if;
  if coalesce(trim(p_customer->>'name'),'') = '' or coalesce(trim(p_customer->>'email'),'') !~ '^\S+@\S+\.\S+$' or coalesce(trim(p_customer->>'phone'),'') = '' then
    raise exception 'Missing contact details.'; end if;
  if coalesce(trim(p_address->>'address'),'') = '' or coalesce(trim(p_address->>'city'),'') = '' or coalesce(trim(p_address->>'province'),'') = '' or coalesce(trim(p_address->>'postal_code'),'') !~ '^\d{4}$' then
    raise exception 'Missing shipping address.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Too many items in one order.'; end if;
  perform set_config('sq.actor', 'customer', true);

  insert into customers (name, email, phone) values (trim(p_customer->>'name'), lower(trim(p_customer->>'email')), trim(p_customer->>'phone'))
  on conflict (lower(email)) do update set name = excluded.name, phone = excluded.phone
  returning customer_id into v_customer_id;

  insert into orders (customer_id, payment_method, subtotal, total, shipping_name, shipping_email, shipping_phone, shipping_address,
                      shipping_city, shipping_province, shipping_postal_code, customer_notes, expires_at)
  values (v_customer_id, p_payment_method, 0, 0, trim(p_customer->>'name'), lower(trim(p_customer->>'email')), trim(p_customer->>'phone'),
          trim(p_address->>'address'), trim(p_address->>'city'), trim(p_address->>'province'), trim(p_address->>'postal_code'),
          nullif(trim(coalesce(p_notes,'')), ''), now() + interval '24 hours')
  returning order_id into v_order_id;

  perform set_config('sq.event_type', 'RESERVED', true);
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Invalid quantity.'; end if;
    select * into v_product from products where product_id = v_line->>'product_id' and status = 'ACTIVE';
    if not found then raise exception 'An item in your cart is no longer available.'; end if;
    v_price := case when v_product.on_sale and v_product.sale_price < v_product.price then v_product.sale_price else v_product.price end;

    select array_agg(inventory_item_id) into v_units from (
      select inventory_item_id from inventory_items
      where product_id = v_product.product_id and status = 'AVAILABLE'
      order by inventory_item_id limit v_qty for update skip locked) u;
    if coalesce(array_length(v_units, 1), 0) < v_qty then
      raise exception 'Only % of % available now.', coalesce(array_length(v_units, 1), 0), v_product.name; end if;

    update inventory_items set status = 'RESERVED', reserved_order_id = v_order_id where inventory_item_id = any(v_units);
    insert into order_items (order_id, product_id, inventory_item_id, product_name_snapshot, sku_snapshot, price_snapshot)
    select v_order_id, v_product.product_id, u, v_product.name, v_product.sku, v_price from unnest(v_units) u;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  update orders set subtotal = v_subtotal, total = v_subtotal where order_id = v_order_id returning * into v_order;
  return jsonb_build_object('order_id', v_order.order_id, 'order_number', v_order.order_number, 'access_token', v_order.access_token);
end $$;

-- Guests read their own order with the token returned by place_order.
create or replace function public.get_guest_order(p_order_number text, p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'access_token' - 'customer_id',
    'items', coalesce((select jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'inventory_item_id', oi.inventory_item_id,
                        'product_name_snapshot', oi.product_name_snapshot, 'sku_snapshot', oi.sku_snapshot, 'price_snapshot', oi.price_snapshot))
                      from order_items oi where oi.order_id = o.order_id), '[]'::jsonb))
  from orders o where o.order_number = p_order_number and o.access_token = p_token
$$;

create or replace function public.submit_contact_message(p_name text, p_email text, p_topic text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_email),'') !~ '^\S+@\S+\.\S+$' or coalesce(trim(p_message),'') = '' then raise exception 'Please add your name, a valid email and a message.'; end if;
  insert into contact_messages (name, email, topic, message) values (trim(p_name), lower(trim(p_email)), p_topic, left(trim(p_message), 5000));
end $$;

-- ---------------------------------------------------------------------------
-- Stock state transitions (internal)
-- ---------------------------------------------------------------------------
create or replace function public._commit_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sq.event_type', 'SOLD', true);
  update inventory_items i set status = 'SOLD', sold_order_id = p_order_id, reserved_order_id = null, sold_at = now()
  from order_items oi where oi.order_id = p_order_id and oi.released_at is null and oi.inventory_item_id = i.inventory_item_id
    and i.status = 'RESERVED' and i.reserved_order_id = p_order_id;
  update orders set stock_state = 'COMMITTED', expires_at = null where order_id = p_order_id;
end $$;

create or replace function public._release_order(p_order_id uuid, p_type text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('sq.event_type', p_type, true);
  perform set_config('sq.event_note', coalesce(p_reason, ''), true);
  update inventory_items set status = 'AVAILABLE', reserved_order_id = null where reserved_order_id = p_order_id and status = 'RESERVED';
  update order_items set released_at = now() where order_id = p_order_id and released_at is null;
  update orders set stock_state = 'RELEASED', expires_at = null, cancel_reason = p_reason where order_id = p_order_id;
end $$;
revoke execute on function public._commit_order(uuid), public._release_order(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: orders
-- ---------------------------------------------------------------------------
-- Payment transitions (no correction workflow yet):
--   UNPAID / PENDING_VERIFICATION / FAILED  → each other, or → PAID (only while stock is still RESERVED)
--   PAID     → REFUNDED only (inventory untouched; use admin_return_items_to_stock to restock)
--   REFUNDED → final
create or replace function public.admin_set_payment_status(p_order_id uuid, p_status text, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform require_permission('MANAGE_ORDERS');
  select * into o from orders where order_id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if p_status not in ('UNPAID','PENDING_VERIFICATION','PAID','FAILED','REFUNDED') then raise exception 'Unknown payment status.'; end if;
  if o.payment_status = 'REFUNDED' and p_status <> 'REFUNDED' then
    raise exception 'This order was refunded. Its payment status is final.'; end if;
  if o.payment_status = 'PAID' and p_status not in ('PAID','REFUNDED') then
    raise exception 'A paid order can only be marked REFUNDED.'; end if;
  if p_status = 'REFUNDED' and o.payment_status not in ('PAID','REFUNDED') then
    raise exception 'Only a paid order can be refunded. Cancel the order instead.'; end if;
  if p_status = 'PAID' and o.payment_status <> 'PAID' and o.stock_state <> 'RESERVED' then
    raise exception 'This order no longer holds its items (they were released). It can’t be marked paid.'; end if;
  update orders set payment_status = p_status, payment_reference = coalesce(p_reference, payment_reference),
         status = case when p_status = 'PAID' and status in ('PENDING','PAYMENT_PENDING') then 'PAID' else status end
  where order_id = p_order_id;
  if p_status = 'PAID' and o.stock_state = 'RESERVED' then perform _commit_order(p_order_id); end if;
  -- REFUNDED never changes inventory.
end $$;

-- Order status rules that keep payment_status and stock_state consistent:
--   • released/restocked orders are closed (only CANCELLED/REFUNDED labels, and REFUNDED needs a real payment)
--   • PACKED / SHIPPED / COMPLETED require payment PAID (no UNPAID + COMMITTED)
--   • PAID (order) = admin marks payment PAID → same checks as admin_set_payment_status
--   • REFUNDED (order) requires a paid/refunded payment; never touches inventory
--   • once paid, the order can't go back to PENDING / PAYMENT_PENDING
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform require_permission('MANAGE_ORDERS');
  select * into o from orders where order_id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if p_status not in ('PENDING','PAYMENT_PENDING','PAID','PROCESSING','PACKED','SHIPPED','COMPLETED','CANCELLED','REFUNDED') then raise exception 'Unknown order status.'; end if;
  if o.stock_state in ('RELEASED','RESTOCKED') and p_status not in ('CANCELLED','REFUNDED') then
    raise exception 'Cancelled orders can’t be reopened because their items were released. Create a new order instead.'; end if;
  if p_status = 'REFUNDED' and o.payment_status not in ('PAID','REFUNDED') then
    raise exception 'Nothing was paid on this order, so it can’t be refunded. Cancel it instead.'; end if;
  if p_status = 'PAID' and o.payment_status = 'REFUNDED' then
    raise exception 'This order was refunded. It can’t be marked paid again.'; end if;
  if p_status = 'PAID' and o.payment_status <> 'PAID' and o.stock_state <> 'RESERVED' then
    raise exception 'This order no longer holds its items (they were released). It can’t be marked paid.'; end if;
  if p_status in ('PACKED','SHIPPED','COMPLETED') and o.payment_status <> 'PAID' then
    raise exception 'Mark the payment as PAID before packing or shipping.'; end if;
  if p_status in ('PENDING','PAYMENT_PENDING') and o.payment_status in ('PAID','REFUNDED') then
    raise exception 'This order is already paid. It can’t go back to pending.'; end if;
  perform set_config('sq.event_note', coalesce(p_note, ''), true);
  update orders set status = p_status,
         payment_status = case when p_status = 'PAID' then 'PAID' when p_status = 'REFUNDED' then 'REFUNDED' else payment_status end
  where order_id = p_order_id;
  if o.stock_state = 'RESERVED' then
    if p_status = 'CANCELLED' then perform _release_order(p_order_id, 'RELEASED', coalesce(p_note, 'Cancelled by admin'));
    elsif p_status = 'PAID' then perform _commit_order(p_order_id);
    end if;
  end if;
  -- Refund after the sale is final does NOT touch inventory. See admin_return_items_to_stock.
end $$;

create or replace function public.admin_return_items_to_stock(p_order_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform require_permission('MANAGE_ORDERS'); perform require_permission('EDIT_INVENTORY');
  select * into o from orders where order_id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.stock_state <> 'COMMITTED' or o.status not in ('CANCELLED','REFUNDED') then
    raise exception 'Only cancelled or refunded orders whose sale was finalized can be restocked.'; end if;
  perform set_config('sq.event_type', 'RETURNED_TO_STOCK', true);
  perform set_config('sq.event_note', coalesce(p_note, 'Returned to stock by admin'), true);
  update inventory_items set status = 'AVAILABLE', sold_order_id = null, sold_at = null where sold_order_id = p_order_id and status = 'SOLD';
  update order_items set released_at = now() where order_id = p_order_id and released_at is null;
  update orders set stock_state = 'RESTOCKED' where order_id = p_order_id;
end $$;

-- EXTEND HOLD: deliberate admin action. Keeps the reservation and pushes expires_at by 24 hours.
create or replace function public.admin_extend_hold(p_order_id uuid, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_new timestamptz; v_note text := coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Hold extended 24h by admin');
begin
  perform require_permission('MANAGE_ORDERS');
  select * into o from orders where order_id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.stock_state <> 'RESERVED' or o.payment_status = 'PAID' then raise exception 'Only unpaid orders that still hold reserved items can be extended.'; end if;
  v_new := greatest(coalesce(o.expires_at, now()), now()) + interval '24 hours';
  perform set_config('sq.event_note', v_note, true);
  update orders set expires_at = v_new where order_id = p_order_id;          -- order_events row via trigger (performed_by = auth.uid())
  insert into inventory_events (inventory_item_id, order_id, event_type, previous_status, new_status, performed_by, actor, notes)
  select i.inventory_item_id, p_order_id, 'HOLD_EXTENDED', i.status, i.status, auth.uid(), 'admin', v_note || ' → ' || to_char(v_new, 'YYYY-MM-DD HH24:MI TZ')
  from inventory_items i where i.reserved_order_id = p_order_id and i.status = 'RESERVED';
  return v_new;
end $$;

-- Shipping fee (NULL = TBD). Only while the order is still active.
create or replace function public.admin_set_shipping_fee(p_order_id uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform require_permission('MANAGE_ORDERS');
  if p_fee is not null and p_fee < 0 then raise exception 'Shipping fee must be ₱0 or more.'; end if;
  select * into o from orders where order_id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status in ('COMPLETED','CANCELLED','REFUNDED') or o.stock_state in ('RELEASED','RESTOCKED') then
    raise exception 'This order is finalized (%), so its shipping fee can’t be changed.', o.status; end if;
  update orders set shipping_fee = p_fee, total = subtotal - discount + coalesce(p_fee, 0) where order_id = p_order_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: products & inventory
-- ---------------------------------------------------------------------------
create or replace function public.admin_upsert_product(p jsonb, p_is_new boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_id text := upper(trim(p->>'sku')); v_can_cost boolean := public.has_permission('VIEW_COST');
begin
  perform require_permission('MANAGE_PRODUCTS');
  if coalesce(v_id, '') = '' then raise exception 'SKU is required.'; end if;
  if p_is_new then
    if exists (select 1 from products where product_id = v_id) then raise exception 'That SKU already exists.'; end if;
    insert into products (product_id, sku, name, slug, category_id, subcategory, description, pokemon, set_name, card_number, language, condition,
                          product_type, grading_company, grade, price, cost, sale_price, featured, on_sale, status, tags)
    values (v_id, v_id, trim(p->>'name'), lower(regexp_replace(trim(p->>'name') || '-' || v_id, '[^a-zA-Z0-9]+', '-', 'g')),
            p->>'category_id', nullif(p->>'subcategory',''), nullif(p->>'description',''), nullif(p->>'pokemon',''), nullif(p->>'set_name',''),
            nullif(p->>'card_number',''), coalesce(nullif(p->>'language',''), 'English'), nullif(p->>'condition',''), p->>'product_type',
            nullif(p->>'grading_company',''), nullif(p->>'grade','')::numeric, (p->>'price')::numeric,
            case when v_can_cost then nullif(p->>'cost','')::numeric end, nullif(p->>'sale_price','')::numeric,
            coalesce((p->>'featured')::boolean, false), coalesce((p->>'on_sale')::boolean, false), coalesce(nullif(p->>'status',''), 'DRAFT'),
            coalesce(array(select jsonb_array_elements_text(p->'tags')), '{}'));
  else
    update products set name = trim(p->>'name'), category_id = p->>'category_id', subcategory = nullif(p->>'subcategory',''),
      description = nullif(p->>'description',''), pokemon = nullif(p->>'pokemon',''), set_name = nullif(p->>'set_name',''),
      card_number = nullif(p->>'card_number',''), language = coalesce(nullif(p->>'language',''), 'English'), condition = nullif(p->>'condition',''),
      product_type = p->>'product_type', grading_company = nullif(p->>'grading_company',''), grade = nullif(p->>'grade','')::numeric,
      price = (p->>'price')::numeric, cost = case when v_can_cost then nullif(p->>'cost','')::numeric else cost end,
      sale_price = nullif(p->>'sale_price','')::numeric, featured = coalesce((p->>'featured')::boolean, false),
      on_sale = coalesce((p->>'on_sale')::boolean, false), status = coalesce(nullif(p->>'status',''), status),
      tags = coalesce(array(select jsonb_array_elements_text(p->'tags')), '{}')
    where product_id = v_id;
    if not found then raise exception 'Product not found.'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_set_product_status(p_product_id text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_permission('MANAGE_PRODUCTS');
  update products set status = p_status where product_id = p_product_id;
  if not found then raise exception 'Product not found.'; end if;
end $$;

-- Sets on-hand quantity (AVAILABLE + RESERVED units) and manual holds.
-- Adds new AVAILABLE units, or removes AVAILABLE units as ARCHIVED (or SOLD for offline sales).
-- Units reserved by open orders are never touched.
create or replace function public.admin_set_stock(p_product_id text, p_quantity int, p_holds int, p_mark_sold int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare v_live int; v_order_res int; v_holds int; v_prod products%rowtype;
begin
  perform require_permission('EDIT_INVENTORY');
  select * into v_prod from products where product_id = p_product_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if p_mark_sold > 0 then
    perform set_config('sq.event_type', 'SOLD', true); perform set_config('sq.event_note', 'Marked sold by admin (offline sale)', true);
    update inventory_items set status = 'SOLD', sold_at = now() where inventory_item_id in (
      select inventory_item_id from inventory_items where product_id = p_product_id and status = 'AVAILABLE' order by inventory_item_id limit p_mark_sold for update);
  end if;
  select count(*) filter (where status in ('AVAILABLE','RESERVED')), count(*) filter (where status = 'RESERVED' and reserved_order_id is not null),
         count(*) filter (where status = 'RESERVED' and hold_reason is not null)
  into v_live, v_order_res, v_holds from inventory_items where product_id = p_product_id;
  if p_quantity < v_order_res then raise exception '% unit(s) are reserved by open orders, so quantity can’t go below %.', v_order_res, v_order_res; end if;
  if p_holds < 0 or p_holds + v_order_res > p_quantity then raise exception 'Too many units on hold.'; end if;
  if p_quantity > v_live then
    perform set_config('sq.event_note', 'Added by admin', true);
    insert into inventory_items (product_id, sku, condition, grading_company, grade)
    select p_product_id, v_prod.sku, v_prod.condition, v_prod.grading_company, v_prod.grade from generate_series(1, p_quantity - v_live);
  elsif p_quantity < v_live then
    perform set_config('sq.event_type', 'ARCHIVED', true); perform set_config('sq.event_note', 'Removed from stock by admin', true);
    update inventory_items set status = 'ARCHIVED', hold_reason = null where inventory_item_id in (
      select inventory_item_id from inventory_items where product_id = p_product_id and (status = 'AVAILABLE' or (status = 'RESERVED' and hold_reason is not null))
      order by (status = 'AVAILABLE') desc, inventory_item_id desc limit v_live - p_quantity);
  end if;
  select count(*) filter (where status = 'RESERVED' and hold_reason is not null) into v_holds from inventory_items where product_id = p_product_id;
  if p_holds > v_holds then
    perform set_config('sq.event_type', 'HOLD', true); perform set_config('sq.event_note', 'Manual hold by admin', true);
    update inventory_items set status = 'RESERVED', hold_reason = 'Manual hold' where inventory_item_id in (
      select inventory_item_id from inventory_items where product_id = p_product_id and status = 'AVAILABLE' order by inventory_item_id limit p_holds - v_holds);
  elsif p_holds < v_holds then
    perform set_config('sq.event_type', 'RELEASED', true); perform set_config('sq.event_note', 'Manual hold released by admin', true);
    update inventory_items set status = 'AVAILABLE', hold_reason = null where inventory_item_id in (
      select inventory_item_id from inventory_items where product_id = p_product_id and status = 'RESERVED' and hold_reason is not null limit v_holds - p_holds);
  end if;
end $$;

create or replace function public.admin_update_inventory_item(p_item_id text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_permission('EDIT_INVENTORY');
  update inventory_items set card_ledger_id = nullif(p->>'card_ledger_id',''), cert_number = nullif(p->>'cert_number',''),
    condition = coalesce(nullif(p->>'condition',''), condition), internal_notes = nullif(p->>'internal_notes',''),
    acquisition_cost = case when public.has_permission('VIEW_COST') and p ? 'acquisition_cost' then nullif(p->>'acquisition_cost','')::numeric else acquisition_cost end
  where inventory_item_id = p_item_id;
  if not found then raise exception 'Inventory item not found.'; end if;
end $$;

create or replace function public.admin_replace_product_images(p_product_id text, p_images jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_permission('MANAGE_PRODUCTS');
  delete from product_images where product_id = p_product_id;
  insert into product_images (product_id, storage_path, public_url, sort_order, is_primary, alt_text)
  select p_product_id, x->>'storage_path', x->>'public_url', ord - 1, ord = 1, x->>'alt_text'
  from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) with ordinality as t(x, ord)
  where coalesce(x->>'storage_path', '') <> '';
end $$;

create or replace function public.admin_add_item_image(p_item_id text, p_storage_path text, p_public_url text, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int;
begin
  perform require_permission('EDIT_INVENTORY');
  select count(*) into v_n from inventory_item_images where inventory_item_id = p_item_id;
  insert into inventory_item_images (inventory_item_id, storage_path, public_url, image_type, sort_order, is_primary)
  values (p_item_id, p_storage_path, p_public_url, coalesce(p_type, 'OTHER'), v_n, v_n = 0) returning image_id into v_id;
  return v_id;
end $$;

create or replace function public.admin_remove_item_image(p_image_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  perform require_permission('EDIT_INVENTORY');
  delete from inventory_item_images where image_id = p_image_id returning storage_path into v_path;
  return v_path;   -- client deletes the storage object
end $$;

-- ---------------------------------------------------------------------------
-- 24-hour expiry of unpaid orders (scheduled in 0002_schedule_expiry.sql)
-- ---------------------------------------------------------------------------
create or replace function public.expire_unpaid_orders() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform set_config('sq.actor', 'system', true);
  for r in select order_id from orders
           -- Every unpaid reservation expires, including PENDING_VERIFICATION. Only admin_extend_hold() can push the deadline.
           where stock_state = 'RESERVED' and payment_status <> 'PAID' and expires_at < now()
           for update skip locked loop
    perform set_config('sq.event_note', 'Expired: unpaid after 24 hours', true);
    update orders set status = 'CANCELLED' where order_id = r.order_id;
    perform _release_order(r.order_id, 'EXPIRED', 'Expired: unpaid after 24 hours');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;

-- Function execute grants
revoke execute on all functions in schema public from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, jsonb, text), public.get_guest_order(text, uuid),
                          public.submit_contact_message(text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin(), public.has_permission(text),
  public.admin_set_payment_status(uuid, text, text), public.admin_set_order_status(uuid, text, text),
  public.admin_return_items_to_stock(uuid, text), public.admin_extend_hold(uuid, text), public.admin_set_shipping_fee(uuid, numeric),
  public.admin_upsert_product(jsonb, boolean), public.admin_set_product_status(text, text),
  public.admin_set_stock(text, int, int, int), public.admin_update_inventory_item(text, jsonb),
  public.admin_replace_product_images(text, jsonb), public.admin_add_item_image(text, text, text, text),
  public.admin_remove_item_image(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one public-read bucket, admin-only writes
--   product-images/products/<product_id>/<file>
--   product-images/inventory/<inventory_item_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "product-images admin list" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (
    ((storage.foldername(name))[1] = 'products'  and public.has_permission('MANAGE_PRODUCTS')) or
    ((storage.foldername(name))[1] = 'inventory' and public.has_permission('EDIT_INVENTORY'))));
create policy "product-images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Real categories (production data, not demo)
-- ---------------------------------------------------------------------------
insert into public.categories (category_id, name, label, description, sort_order) values
  ('pokemon', 'Pokémon', 'Pokémon Singles', 'Raw singles, sorted by condition', 1),
  ('psa', 'PSA Slabs', 'PSA / Graded Cards', 'PSA, BGS and CGC graded cards', 2),
  ('sealed', 'Sealed Products', 'Sealed Products', 'Booster boxes, ETBs and bundles', 3),
  ('accessories', 'Accessories', 'Accessories', 'Sleeves, holders and binders', 4),
  ('collectibles', 'Collectibles', 'Collectibles & Plush', 'Figures, plush and display pieces', 5),
  ('other', 'Other Hobbies', 'Other Hobbies', 'Other TCGs and hobby goods', 6)
on conflict (category_id) do nothing;
