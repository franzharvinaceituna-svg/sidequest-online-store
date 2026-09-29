// SIDE QUEST — backend selector. The UI only ever uses window.SQStore.
// Picks Supabase when configured, otherwise the local browser backend (safe fallback).
(function () {
  if (window.SQStore) return;
  const t0 = Date.now();
  function pick() {
    const cfg = window.SQ_RUNTIME_CONFIG;
    const waiting = Date.now() - t0 < 4000;
    if ((!cfg || !window.SQStoreLocal) && waiting) return setTimeout(pick, 25);
    const wantsSupabase = cfg && cfg.BACKEND === 'supabase';
    if (wantsSupabase && !window.SQStoreSupabase && waiting) return setTimeout(pick, 25);
    if (wantsSupabase && window.SQStoreSupabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
      window.SQStoreSupabase.configure(cfg);
      window.SQStore = window.SQStoreSupabase;
    } else {
      if (wantsSupabase) console.warn('[SIDE QUEST] BACKEND is "supabase" but URL/key are missing. Using the local demo backend.');
      window.SQStore = window.SQStoreLocal;
    }
  }
  pick();
})();
