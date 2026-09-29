-- ============================================================================
-- SIDE QUEST — 0004: checkout & contact abuse limits
-- Requires 0001–0003. Safe to re-run (idempotent).
--
-- Problem: place_order() is public (guest checkout) and every order reserves real,
-- often one-of-a-kind, inventory for 24 hours. A script could place orders with
-- throwaway emails and hold every slab in the store, blocking real customers.
--
-- This migration adds limits enforced inside the database:
--   • open (unpaid, still-reserved) orders per email, per phone, per connection
--   • maximum units in one order
--   • contact-form messages per email / per connection per hour
-- Limits live in one editable row: public.checkout_limits (Table Editor).
-- Connection = client IP from the API gateway headers, stored only as a salted
-- MD5 hash (never the raw IP). Best-effort: it stops casual abuse, not a
-- determined attacker. A captcha at checkout is the next layer (app phase).
--
-- Nothing in 0001–0003 is recreated or altered: place_order(), submit_contact_message()
-- and all admin functions are unchanged. The limits are triggers that only act on
-- customer checkouts (sq.actor = 'customer', set by place_order) and contact messages.
-- Admin actions and the expiry job are never limited.
-- ============================================================================

-- 1) Editable limits (single row)
create table if not exists public.checkout_limits (
  id                              boolean primary key default true check (id),
  max_open_orders_per_email       int not null default 3  check (max_open_orders_per_email >= 1),
  max_open_orders_per_phone       int not null default 3  check (max_open_orders_per_phone >= 1),
  max_open_orders_per_ip          int not null default 5  check (max_open_orders_per_ip >= 1),
  max_units_per_order             int not null default 20 check (max_units_per_order >= 1),
  max_contact_per_email_per_hour  int not null default 5  check (max_contact_per_email_per_hour >= 1),
  max_contact_per_ip_per_hour     int not null default 10 check (max_contact_per_ip_per_hour >= 1),
  updated_at                      timestamptz not null default now()
);
insert into public.checkout_limits (id) values (true) on conflict (id) do nothing;

-- 2) Hashed request log (for per-connection limits)
create table if not exists public.request_log (
  log_id     bigint generated always as identity primary key,
  kind       text not null check (kind in ('ORDER','CONTACT')),
  ip_hash    text not null,
  order_id   uuid,                                   -- no FK: written before the order row exists
  created_at timestamptz not null default now()
);
create index if not exists request_log_lookup on public.request_log (kind, ip_hash, created_at);
create index if not exists request_log_order  on public.request_log (order_id) where order_id is not null;

-- Private: RLS on, no policies, no API grants
alter table public.checkout_limits enable row level security;
alter table public.request_log     enable row level security;
revoke all on public.checkout_limits, public.request_log from public, anon, authenticated;

-- Lookup indexes for the limit checks (open reservations only)
create index if not exists orders_open_email_idx on public.orders (lower(shipping_email)) where stock_state = 'RESERVED';
create index if not exists orders_open_phone_idx on public.orders (right(regexp_replace(shipping_phone, '\D', '', 'g'), 10)) where stock_state = 'RESERVED';
create index if not exists contact_messages_email_time_idx on public.contact_messages (lower(email), created_at);

-- 3) Client connection hash from PostgREST request headers (null in SQL Editor / cron)
create or replace function public._client_ip_hash() returns text
language plpgsql stable security definer set search_path = public as $$
declare h json; ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  ip := nullif(trim(coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1))), '');
  return case when ip is null then null else md5('sidequest:' || ip) end;
end $$;

-- 4) Order limits (BEFORE INSERT on orders — customer checkouts only)
create or replace function public._enforce_checkout_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  L checkout_limits%rowtype; n int;
  v_ip text := public._client_ip_hash();
  v_phone text := right(regexp_replace(coalesce(new.shipping_phone, ''), '\D', '', 'g'), 10);
begin
  if coalesce(current_setting('sq.actor', true), '') <> 'customer' then return new; end if;
  select * into L from checkout_limits where id;
  if not found then return new; end if;

  -- serialize concurrent checkouts for the same email so the count can't be raced
  perform pg_advisory_xact_lock(hashtext('sq-checkout:' || lower(new.shipping_email)));

  select count(*) into n from orders where stock_state = 'RESERVED' and lower(shipping_email) = lower(new.shipping_email);
  if n >= L.max_open_orders_per_email then
    raise exception 'You already have % unpaid order(s). Please complete payment on those first, or wait for them to expire.', n;
  end if;

  if v_phone <> '' then
    select count(*) into n from orders where stock_state = 'RESERVED' and right(regexp_replace(shipping_phone, '\D', '', 'g'), 10) = v_phone;
    if n >= L.max_open_orders_per_phone then
      raise exception 'You already have % unpaid order(s). Please complete payment on those first, or wait for them to expire.', n;
    end if;
  end if;

  if v_ip is not null then
    select count(*) into n from request_log l join orders o on o.order_id = l.order_id
    where l.kind = 'ORDER' and l.ip_hash = v_ip and o.stock_state = 'RESERVED';
    if n >= L.max_open_orders_per_ip then
      raise exception 'Too many unpaid orders from this connection. Please complete payment on an existing order first.';
    end if;
    insert into request_log (kind, ip_hash, order_id) values ('ORDER', v_ip, new.order_id);
  end if;
  return new;
end $$;

drop trigger if exists orders_checkout_limits on public.orders;
create trigger orders_checkout_limits before insert on public.orders
  for each row execute function public._enforce_checkout_limits();

-- 5) Units per order (AFTER INSERT on order_items — one row per physical unit)
create or replace function public._enforce_units_per_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_max int; n int;
begin
  if coalesce(current_setting('sq.actor', true), '') <> 'customer' then return null; end if;
  select max_units_per_order into v_max from checkout_limits where id;
  if v_max is null then return null; end if;
  select count(*) into n from order_items where order_id = new.order_id and released_at is null;
  if n > v_max then
    raise exception 'Orders are limited to % items. For larger purchases, please contact us.', v_max;
  end if;
  return null;
end $$;

drop trigger if exists order_items_units_limit on public.order_items;
create trigger order_items_units_limit after insert on public.order_items
  for each row execute function public._enforce_units_per_order();

-- 6) Contact form limits (BEFORE INSERT on contact_messages)
create or replace function public._enforce_contact_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare L checkout_limits%rowtype; n int; v_ip text := public._client_ip_hash();
begin
  select * into L from checkout_limits where id;
  if not found then return new; end if;
  select count(*) into n from contact_messages where lower(email) = lower(new.email) and created_at > now() - interval '1 hour';
  if n >= L.max_contact_per_email_per_hour then
    raise exception 'You''ve sent several messages recently. Please wait a little before sending another.';
  end if;
  if v_ip is not null then
    select count(*) into n from request_log where kind = 'CONTACT' and ip_hash = v_ip and created_at > now() - interval '1 hour';
    if n >= L.max_contact_per_ip_per_hour then
      raise exception 'You''ve sent several messages recently. Please wait a little before sending another.';
    end if;
    insert into request_log (kind, ip_hash) values ('CONTACT', v_ip);
  end if;
  return new;
end $$;

drop trigger if exists contact_messages_limits on public.contact_messages;
create trigger contact_messages_limits before insert on public.contact_messages
  for each row execute function public._enforce_contact_limits();

-- 7) Internal functions are not callable through the API
revoke execute on function public._client_ip_hash(), public._enforce_checkout_limits(),
  public._enforce_units_per_order(), public._enforce_contact_limits()
from public, anon, authenticated;

-- 8) Self-check
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_checkout_limits' and not tgisinternal) then raise exception 'orders_checkout_limits trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'order_items_units_limit' and not tgisinternal) then raise exception 'order_items_units_limit trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'contact_messages_limits' and not tgisinternal) then raise exception 'contact_messages_limits trigger missing'; end if;
  if (select count(*) from public.checkout_limits) <> 1 then raise exception 'checkout_limits must have exactly one row'; end if;
  if has_table_privilege('anon', 'public.request_log', 'SELECT') or has_table_privilege('authenticated', 'public.request_log', 'SELECT')
     or has_table_privilege('anon', 'public.checkout_limits', 'SELECT') or has_table_privilege('authenticated', 'public.checkout_limits', 'SELECT') then
    raise exception 'limit tables must not be readable by API roles';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Verify / adjust:
--   select * from public.checkout_limits;
--   update public.checkout_limits set max_units_per_order = 30, updated_at = now();
-- Contact limit test (changes nothing):
--   begin;
--   select public.submit_contact_message('Test', 'limit-test@example.com', 'Test', 'hello') from generate_series(1, 6);
--   rollback;      -- expected: error "You've sent several messages recently..." on the 6th
-- ----------------------------------------------------------------------------
