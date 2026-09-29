-- ============================================================================
-- SIDE QUEST — 0002: schedule the 24-hour unpaid-order expiry (server-side)
-- Requires 0001_foundation.sql. Safe to re-run (idempotent).
--
-- Every 10 minutes pg_cron calls public.expire_unpaid_orders() (defined in 0001):
--   • any order with stock_state = 'RESERVED' and payment_status <> 'PAID' whose
--     expires_at has passed (UNPAID, PENDING_VERIFICATION, FAILED; order status
--     PENDING or PAYMENT_PENDING) → status CANCELLED
--   • its reserved units → AVAILABLE, order lines released, stock_state RELEASED
--   • audit: inventory_events (EXPIRED, actor 'system') + order_events via triggers
--   • PAID orders are never touched (their stock is COMMITTED, not RESERVED)
-- The only way to keep a hold longer is the admin action admin_extend_hold().
-- ============================================================================

-- 1) Scheduler extension (Supabase installs pg_cron into pg_catalog; jobs live in schema "cron")
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- 2) Make sure the foundation function exists before scheduling it
do $$
begin
  if to_regprocedure('public.expire_unpaid_orders()') is null then
    raise exception 'public.expire_unpaid_orders() not found. Run 0001_foundation.sql first.';
  end if;
end $$;

-- 3) (Re)create the job: remove any previous copy, then schedule every 10 minutes
do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname = 'sq-expire-unpaid-orders' loop
    perform cron.unschedule(j);
  end loop;
  perform cron.schedule('sq-expire-unpaid-orders', '*/10 * * * *', 'select public.expire_unpaid_orders();');
end $$;

-- ----------------------------------------------------------------------------
-- Verify:
--   select jobid, jobname, schedule, command, active from cron.job where jobname = 'sq-expire-unpaid-orders';
-- Run history (after ~10 minutes):
--   select status, return_message, start_time, end_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'sq-expire-unpaid-orders')
--   order by start_time desc limit 10;
-- Run once manually (returns number of orders expired):
--   select public.expire_unpaid_orders();
-- Pause / resume:
--   select cron.alter_job((select jobid from cron.job where jobname = 'sq-expire-unpaid-orders'), active := false);
-- ----------------------------------------------------------------------------
