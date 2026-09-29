# SIDE QUEST Online Store

Collect • Trade • Hobbies. React + Vite storefront and admin, backed by Supabase.

## Run locally (optional)
1. Install Node 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
4. `npm run dev` → open the printed address. Admin is at `/#/admin`.

## Deploy on Netlify (new site — not the Card Ledger)
1. Push this folder to a new GitHub repository.
2. Netlify → Add new site → Import from Git → choose the repository.
3. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).
4. Site configuration → Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy. Then add the site address in Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).

## Structure
- `src/main.jsx`: entry point (loads config, data layer, UI)
- `src/config/runtime-config.js`: reads the `VITE_` environment variables
- `src/services/`: data layer. `supabase-store-service.js` (live), `store-service.js` (offline demo), `index.js` (chooses one)
- `src/lib/view-helpers.js`: formatting (₱ prices, labels, statuses)
- `src/components/`: `StoreApp` (all public pages + router), `Admin`, `ProductCard`, `ProductImage`
- `src/styles/`: Modernist design system + SIDE QUEST colors
- `public/assets/`: logo
- `supabase/migrations/`: database migrations 0001–0004 (already applied to production)
- `docs/`: architecture and Supabase setup notes

## Security
The publishable key is public by design; Row Level Security protects the data. Never put the service_role / secret key in any `VITE_` variable or anywhere in this repository.
