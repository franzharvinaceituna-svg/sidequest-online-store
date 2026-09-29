# SIDE QUEST Online Store — Architecture (Phase 2)

## Live status (Sep 29, 2026)
- The production project (`qkgcfnkwmslipcphezbc`) has migrations 0001–0004 installed.
- The store now runs on `BACKEND: 'supabase'`.
- Security check as a public visitor: all 9 attempts were refused (tables, admin views, writing through a view, inserting a category, admin and expiry functions, limits table).
- To go back to the offline demo, set `BACKEND: 'local'` in `src/config/runtime-config.js`.

## Backends
The UI only uses `window.SQStore`, and `src/services/index.js` decides what that is:
- **supabase**: `src/services/supabase-store-service.js`. It's used when `src/config/runtime-config.js` has BACKEND `'supabase'` plus a URL and anon key.
- **local** (fallback): `src/services/store-service.js`, which keeps browser demo data in localStorage. It's also used by `Store QA Tests.dc.html` (36 rule tests).

Both backends expose the same methods. Supabase reads are served from an in-memory cache. Its writes return Promises, and the UI handles both kinds of result.

## Files
| Purpose | File |
|---|---|
| DB schema, RLS, views, functions, audit, storage | `supabase/migrations/0001_foundation.sql` |
| 24-hour expiry job (pg_cron) | `supabase/migrations/0002_schedule_expiry.sql` |
| Optional demo data (never on production) | `supabase/seed_demo.sql` |
| Runtime config / future env vars | `src/config/runtime-config.js`, `.env.example` |
| Storefront / Admin / reusable parts | `SIDE QUEST Store.dc.html`, `Admin.dc.html`, `ProductCard.dc.html`, `ProductImage.dc.html` |
| Formatting helpers | `src/lib/view-helpers.js` |
| Setup steps | `SUPABASE_SETUP.md` |

## Data model (Supabase)
- `categories`: public read.
- `products`: the listing (`product_id` = SKU, e.g. SQ-PIKA-085). Holds cost (VIEW_COST only), `on_sale` / `sale_price` constraint, and `status`.
- `inventory_items`: **one row per physical unit, for every product type.** Fields: `inventory_item_id` (SQ-INV-000123), `card_ledger_id` (unique, null for now), `status` AVAILABLE/RESERVED/SOLD/ARCHIVED, `reserved_order_id`, `sold_order_id`, `hold_reason`, `acquisition_cost`, `internal_notes`.
  - Check constraints make the state and its links consistent, so a unit can't be both reserved and sold.
  - Stock is a count of units. There's no quantity column to drift out of sync.
- `product_images`: listing photos. `inventory_item_images`: exact-unit photos typed FRONT/BACK/SLAB/DETAIL/OTHER.
- `orders`: guest checkout, with flat shipping fields and `order_number` SQ-ORD-1001. Also holds `stock_state`, `expires_at`, and an `access_token` so guests can view their own order.
- `order_items`: one row per physical unit, with `inventory_item_id`, a snapshot of the product name and SKU, and `price_snapshot`.
- `customers`: upserted by email, with `auth_user_id` ready for future accounts. `wishlists` / `wishlist_items`: ready for accounts. Guests keep a wishlist on their device.
- `admin_profiles`: `role` OWNER/STAFF plus `permissions[]` (VIEW_INVENTORY, EDIT_INVENTORY, MANAGE_ORDERS, MANAGE_PRODUCTS, VIEW_COST, MANAGE_SETTINGS).
- `inventory_events` / `order_events`: audit rows written by triggers, recording who (`performed_by` plus actor), what (event_type and previous/new value), when, and a note.
- `contact_messages`: insert-only for the public.

## Double-sell protection (in the database, not the browser)
1. `place_order()` locks available units with `FOR UPDATE SKIP LOCKED`. Two checkouts can never take the same unit.
2. A unique partial index `order_items(inventory_item_id) where released_at is null` means a unit can be on only one live order line.
3. Unit-state check constraints.
4. Prices are read from the database at checkout. The browser's prices are ignored.

## Order and stock lifecycle
- **Place order:** units go AVAILABLE → RESERVED. The order is PAYMENT_PENDING / UNPAID and expires 24 hours after it's placed.
- **Commit** (units → SOLD) happens once, when payment is marked PAID or the order is marked PAID, PACKED, SHIPPED or COMPLETED.
- **Cancel, refund or expire before commit:** units go back to AVAILABLE and the order is locked.
- **Refund after commit:** units stay SOLD. Only **Return items to stock** (`admin_return_items_to_stock`) sets them back to AVAILABLE, and it's logged.
- **Expiry:** `expire_unpaid_orders()` runs every 10 minutes via pg_cron and is logged as EXPIRED. It covers **every** unpaid reservation, including PENDING_VERIFICATION.
- **Extend hold:** `admin_extend_hold()` is the only way to keep a reservation longer. It's an admin-only action that adds 24 hours to `expires_at` and keeps the reserved units. It writes an `order_events` row (field `expires_at`) and a `HOLD_EXTENDED` inventory event for each unit, both recording `performed_by` and a reason.

## Security (RLS)
- RLS is on for every table. Anonymous visitors can read only `categories` and the `storefront_*` views, which exclude cost, notes, customers and orders. They can write only through `place_order()`, `get_guest_order()` and `submit_contact_message()`.
- Admins read through `admin_*` views, where cost is hidden unless they have VIEW_COST. Every admin write is a SECURITY DEFINER function that checks permissions server-side.
- Storage bucket `product-images` is public-read. Only admins can write to it: `products/<product_id>/…` needs MANAGE_PRODUCTS and `inventory/<inventory_item_id>/…` needs EDIT_INVENTORY.
- The admin area uses Supabase Auth email/password with public sign-up disabled. No passwords, flags or secrets live in the browser.

## Before production
- Run everything against a real Supabase project and re-test there. So far it has only been tested on the local backend.
- Move the build to Vite + Netlify, with env vars from `.env.example`.
- Set up custom SMTP for auth emails and order notifications.
- Add rate limiting or a captcha to checkout (Netlify / Supabase edge).
- Add pagination to admin lists once there are 1,000+ items.
- Add backups (paid plan, or scheduled exports).
- Write privacy policy and terms pages.

## Card Ledger (later)
The Card Ledger becomes the owner of `inventory_items`:
1. It writes units through a server-side sync, using a service key only in an Edge Function.
2. It sets `card_ledger_id` on each unit.
3. It listens to `inventory_events` so both systems agree on RESERVED and SOLD.

The store keeps owning listings, orders and photos.
