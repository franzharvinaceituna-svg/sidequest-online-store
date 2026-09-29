// SIDE QUEST runtime configuration, read from environment variables at build time.
// Set these in Netlify → Site configuration → Environment variables (or .env.local for local dev):
//   VITE_SUPABASE_URL       https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the publishable / anon key (public by design, protected by RLS)
//   VITE_BACKEND            optional: 'supabase' (default when URL+key are set) or 'local' (offline demo)
// NEVER put the service_role / secret key in any VITE_ variable: those are shipped to the browser.
const env = import.meta.env;
const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
window.SQ_RUNTIME_CONFIG = {
  BACKEND: env.VITE_BACKEND || (url && key ? 'supabase' : 'local'),
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key
};
