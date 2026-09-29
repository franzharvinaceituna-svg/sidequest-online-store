-- ============================================================================
-- SIDE QUEST — 0003: make storefront_* and admin_* views read-only
-- Requires 0001_foundation.sql (and 0002). Safe to re-run (idempotent).
--
-- Why: the views run with their owner's rights (that's how anon can read the
-- storefront without touching base tables). Supabase's default privileges gave
-- the "authenticated" role ALL rights on every new view, and single-table views
-- (storefront_products, admin_orders, admin_order_items, admin_inventory_events,
-- admin_product_images, admin_inventory_item_images) are auto-updatable in
-- PostgreSQL. So any signed-in user could INSERT/UPDATE/DELETE through them,
-- bypassing RLS, the admin_* functions (payment/stock rules) and permissions.
--
-- This migration changes privileges and view options only. No tables, columns,
-- functions, policies, triggers or data are altered.
-- ============================================================================

-- 1) Remove every write-type privilege on the views
revoke insert, update, delete, truncate, references, trigger on
  public.storefront_products, public.storefront_product_images,
  public.storefront_items, public.storefront_item_images,
  public.admin_products, public.admin_inventory_items,
  public.admin_product_images, public.admin_inventory_item_images,
  public.admin_orders, public.admin_order_items, public.admin_inventory_events
from public, anon, authenticated;

-- 2) Re-assert the legitimate read access (unchanged from 0001)
grant select on
  public.storefront_products, public.storefront_product_images,
  public.storefront_items, public.storefront_item_images
to anon, authenticated;

grant select on
  public.admin_products, public.admin_inventory_items,
  public.admin_product_images, public.admin_inventory_item_images,
  public.admin_orders, public.admin_order_items, public.admin_inventory_events
to authenticated;

revoke select on
  public.admin_products, public.admin_inventory_items,
  public.admin_product_images, public.admin_inventory_item_images,
  public.admin_orders, public.admin_order_items, public.admin_inventory_events
from public, anon;

-- 3) security_barrier: the view's own WHERE (status = 'ACTIVE', has_permission(...))
--    is always applied before any caller-supplied filter, so filters can't be used
--    to probe hidden rows.
alter view public.storefront_products          set (security_barrier = true);
alter view public.storefront_product_images    set (security_barrier = true);
alter view public.storefront_items             set (security_barrier = true);
alter view public.storefront_item_images       set (security_barrier = true);
alter view public.admin_products               set (security_barrier = true);
alter view public.admin_inventory_items        set (security_barrier = true);
alter view public.admin_product_images         set (security_barrier = true);
alter view public.admin_inventory_item_images  set (security_barrier = true);
alter view public.admin_orders                 set (security_barrier = true);
alter view public.admin_order_items            set (security_barrier = true);
alter view public.admin_inventory_events       set (security_barrier = true);

-- 4) Audit tables are append-only for API roles. (Their rows are written by the
--    SECURITY DEFINER triggers/functions, which run as the owner and are unaffected.)
revoke insert, update, delete, truncate on public.inventory_events, public.order_events
from public, anon, authenticated;

-- 5) Self-check: abort (and roll back) if any view in public is still writable by an API role
do $$
declare r record; bad text := '';
begin
  for r in
    select c.oid, c.relname, g.rolname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join (values ('anon'), ('authenticated')) g(rolname)
    where c.relkind = 'v'
  loop
    if has_table_privilege(r.rolname, r.oid, 'INSERT')
       or has_table_privilege(r.rolname, r.oid, 'UPDATE')
       or has_table_privilege(r.rolname, r.oid, 'DELETE') then
      bad := bad || format(' %s(%s)', r.relname, r.rolname);
    end if;
  end loop;
  if bad <> '' then raise exception 'Views still writable:%', bad; end if;
end $$;

-- ----------------------------------------------------------------------------
-- Verify (expected: can_select as described below, every can_insert/update/delete = false):
--   select c.relname as view, g.rolname as role,
--          has_table_privilege(g.rolname, c.oid, 'SELECT') as can_select,
--          has_table_privilege(g.rolname, c.oid, 'INSERT') as can_insert,
--          has_table_privilege(g.rolname, c.oid, 'UPDATE') as can_update,
--          has_table_privilege(g.rolname, c.oid, 'DELETE') as can_delete
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
--   cross join (values ('anon'), ('authenticated')) g(rolname)
--   where c.relkind = 'v' order by 1, 2;
-- ----------------------------------------------------------------------------
