# SIDE QUEST — Supabase setup (Phase 2)

Takes about 20 minutes and uses the free tier. Nothing goes live until you do step 6.

## 1. Create the project
1. Go to supabase.com → **New project**. Name it `sidequest-store` and choose the region **Southeast Asia (Singapore)**.
2. Save the database password in your password manager.

## 2. Create the database
1. Go to **SQL Editor**, open a new query, and paste all of `supabase/migrations/0001_foundation.sql`. Click **Run**.
2. Go to **Database → Extensions** and enable **pg_cron**.
3. Back in the SQL Editor, run `supabase/migrations/0002_schedule_expiry.sql`. This turns on the 24-hour expiry for unpaid orders.
4. Run `supabase/migrations/0003_lock_view_writes.sql`. It makes the storefront and admin views read-only.
5. *Optional, test project only:* run `supabase/seed_demo.sql` to load the 20 demo products. **Don't run it on your production project.**

## 3. Create your owner login
1. Go to **Authentication → Providers**. Keep Email on.
2. Go to **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up". Only people you invite can have accounts.
3. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick "Auto confirm".
4. In the SQL Editor, make yourself the owner. Replace the email with yours:
   ```sql
   insert into public.admin_profiles (user_id, display_name, role)
   select id, 'Owner', 'OWNER' from auth.users where email = 'you@example.com';
   ```
   To add staff later, create the user the same way, then:
   ```sql
   insert into public.admin_profiles (user_id, display_name, role, permissions)
   select id, 'Staff name', 'STAFF', array['VIEW_INVENTORY','MANAGE_ORDERS']
   from auth.users where email = 'staff@example.com';
   ```
   Staff never see costs unless you add `VIEW_COST`.

## 4. Connect the store
1. Go to **Project Settings → API**. Copy the **Project URL** and the **anon / publishable** key.
2. Open `src/config/runtime-config.js` and fill it in:
   ```js
   BACKEND: 'supabase',
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...'
   ```
   The anon key is meant to be public, because Row Level Security protects the data. **Never** paste the `service_role` key anywhere in the site.
3. Go to **Authentication → URL Configuration** and add your preview and site URLs to *Redirect URLs*. The password reset link needs this.

## 5. Check it works
- Open the store. Products come from the database (empty unless you ran the demo seed).
- Open `#/admin`. You should see a sign-in screen. Sign in as the owner. The banner should read "Live database · Owner".
- Place a test order, then check Admin → Orders. The units show RESERVED in the product editor.
- In the SQL Editor, run `select public.expire_unpaid_orders();` after changing a test order's `expires_at` to the past. The order should become CANCELLED and its unit AVAILABLE again.
- Check the audit trail: `select * from inventory_events order by created_at desc limit 20;`

## 6. Before going live (not yet)
Deploy on Netlify with the environment variables from `.env.example`, set up email delivery (Supabase custom SMTP), remove the demo data, and complete the checklist in ARCHITECTURE.md.

## Fallback
Set `BACKEND: 'local'` to switch back to the browser demo at any time. Nothing in Supabase is touched.
