import { createClient } from '@supabase/supabase-js'; // bundled from npm
// SIDE QUEST — Supabase backend. Implements the same API as store-service.js (window.SQStoreLocal)
// so the UI does not change. Reads are served from an in-memory cache (synchronous, like local);
// writes are async and return Promise<{ ok, msg }>. All stock/order rules run in the database
// (see supabase/migrations/0001_foundation.sql). Cart + guest wishlist stay on the device.
(function () {
  if (window.SQStoreSupabase) return;

  const BUCKET = 'product-images';
  const LS = { cart: 'sq_sb_cart', wish: 'sq_sb_wishlist', mine: 'sq_sb_my_orders' };
  const SETTINGS = { currency: 'PHP', shipping: null, reservation_hours: 24, low_stock_threshold: 2, enabled_payment_methods: ['GCASH', 'BANK_TRANSFER'] };
  const ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
  const PAYMENT_STATUSES = ['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED'];
  const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

  let cfg = null, sb = null, started = false;
  const st = { ready: false, error: null, categories: [], products: [], items: [], itemImages: [] };
  const adm = { loaded: false, products: [], items: [], productImages: [], itemImages: [], orders: [], orderItems: [] };
  const auth = { ready: false, session: null, isAdmin: false, profile: null };
  const mine = { cache: {}, fetching: {} };
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const ok = (x = {}) => Object.assign({ ok: true }, x);
  const fail = msg => ({ ok: false, msg });
  const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const now = () => new Date().toISOString();

  function friendly(e) {
    const m = (e && (e.message || e.error_description)) || String(e || 'Unknown error');
    const known = {
      sale_price_below_price: 'Sale price must be above ₱0 and lower than the regular price.',
      graded_has_grade: 'Graded cards need a grading company and grade.',
      products_sku_key: 'That SKU already exists.', products_pkey: 'That SKU already exists.',
      order_items_one_live_line_per_unit: 'That item was just reserved by another order.',
      products_product_id_check: 'SKU may only contain letters, numbers and dashes.',
      'Invalid login credentials': 'Email or password is incorrect.'
    };
    for (const k in known) if (m.includes(k)) return known[k];
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Connection problem. Please check your internet and try again.';
    return m;
  }
  async function call(fn) { try { const r = await fn(); if (r && r.error) throw r.error; return r ? r.data : null; } catch (e) { throw new Error(friendly(e)); } }
  const attempt = async (fn, after) => { try { const d = await fn(); if (after) await after(); return ok({ data: d }); } catch (e) { return fail(e.message); } };

  // ---------- mapping DB rows → the shape the UI already uses ----------
  const isOnSale = p => !!(p.sale && p.sale_price && p.sale_price < p.price);
  const effectivePrice = p => isOnSale(p) ? p.sale_price : p.price;
  const itemImg = im => ({ image_id: im.image_id, url: im.public_url, storage_path: im.storage_path, kind: (im.image_type || 'OTHER').toLowerCase(), image_type: im.image_type, item: im.inventory_item_id });
  function mapProduct(r, images, items, itemImages, admin) {
    const imgs = images.filter(i => i.product_id === r.product_id).sort((a, b) => a.sort_order - b.sort_order)
      .map(i => ({ image_id: i.image_id, url: i.public_url, storage_path: i.storage_path, kind: 'product', alt: i.alt_text, is_primary: i.is_primary, sort_order: i.sort_order }));
    const avail = items.filter(i => i.product_id === r.product_id && (!i.status || i.status === 'AVAILABLE'));
    const unit = avail.find(i => itemImages.some(im => im.inventory_item_id === i.inventory_item_id));
    const unitImgs = unit ? itemImages.filter(im => im.inventory_item_id === unit.inventory_item_id).sort((a, b) => a.sort_order - b.sort_order).map(itemImg) : [];
    const n = x => x == null ? null : Number(x);
    return {
      product_id: r.product_id, sku: r.sku, name: r.name, slug: r.slug, category: r.category_id, subcategory: r.subcategory || '',
      description: r.description || '', pokemon: r.pokemon || '', set: r.set_name || '', card_number: r.card_number || '',
      language: r.language || 'English', condition: r.condition || '', product_type: r.product_type, grading_company: r.grading_company || '',
      grade: n(r.grade), price: Number(r.price), cost: n(r.cost), sale_price: n(r.sale_price), featured: !!r.featured, sale: !!r.on_sale,
      status: r.status || 'ACTIVE', tags: r.tags || [], created_at: r.created_at, updated_at: r.updated_at,
      quantity: admin ? r.quantity : r.available_quantity, reserved_quantity: admin ? r.reserved_quantity : 0,
      order_reserved: admin ? r.order_reserved : 0, available_quantity: r.available_quantity,
      track_items: true, images: imgs, gallery: unitImgs.concat(imgs)
    };
  }
  function mapOrder(o, items) {
    const lines = {};
    items.filter(i => i.order_id === o.order_id).forEach(i => {
      const l = lines[i.product_id] || (lines[i.product_id] = { product_id: i.product_id, sku: i.sku_snapshot, name: i.product_name_snapshot, unit_price: Number(i.price_snapshot), quantity: 0, line_total: 0, inventory_item_ids: [] });
      l.quantity += 1; l.line_total += Number(i.price_snapshot); l.inventory_item_ids.push(i.inventory_item_id);
    });
    return {
      order_id: o.order_number, _uuid: o.order_id, customer_id: o.customer_id || null,
      customer_information: { name: o.shipping_name, email: o.shipping_email, mobile: o.shipping_phone },
      shipping_address: { address: o.shipping_address, city: o.shipping_city, province: o.shipping_province, postal: o.shipping_postal_code },
      items: Object.values(lines), subtotal: Number(o.subtotal), shipping_fee: o.shipping_fee == null ? null : Number(o.shipping_fee),
      shipping_confirmed: o.shipping_fee != null, discount: Number(o.discount || 0), total: Number(o.total),
      payment_method: o.payment_method, payment_status: o.payment_status, payment_reference: o.payment_reference || null,
      order_status: o.status, notes: o.customer_notes || '', stock: o.stock_state, expires_at: o.expires_at, cancel_reason: o.cancel_reason || null,
      created_at: o.created_at, updated_at: o.updated_at
    };
  }

  // ---------- loading ----------
  async function loadCatalog() {
    const [c, p, pi, it, ii] = await Promise.all([
      call(() => sb.from('categories').select('*').order('sort_order')),
      call(() => sb.from('storefront_products').select('*')),
      call(() => sb.from('storefront_product_images').select('*')),
      call(() => sb.from('storefront_items').select('*')),
      call(() => sb.from('storefront_item_images').select('*'))
    ]);
    st.categories = c || []; st.items = it || []; st.itemImages = ii || [];
    st.products = (p || []).map(r => mapProduct(r, pi || [], st.items, st.itemImages, false));
  }
  async function loadAdmin() {
    if (!auth.isAdmin) { Object.assign(adm, { loaded: false, products: [], items: [], orders: [], orderItems: [] }); return; }
    const [p, it, pi, ii, o, oi] = await Promise.all([
      call(() => sb.from('admin_products').select('*').order('created_at', { ascending: false })),
      call(() => sb.from('admin_inventory_items').select('*').order('inventory_item_id')),
      call(() => sb.from('admin_product_images').select('*')),
      call(() => sb.from('admin_inventory_item_images').select('*')),
      call(() => sb.from('admin_orders').select('*').order('created_at', { ascending: false })),
      call(() => sb.from('admin_order_items').select('*'))
    ]);
    adm.items = it || []; adm.itemImages = ii || []; adm.productImages = pi || []; adm.orderItems = oi || [];
    adm.products = (p || []).map(r => mapProduct(r, adm.productImages, adm.items, adm.itemImages, true));
    adm.orders = (o || []).map(r => mapOrder(r, adm.orderItems));
    adm.loaded = true;
  }
  async function refreshAll() { await loadCatalog(); await loadAdmin(); emit(); }
  async function onSession(session) {
    auth.session = session; auth.isAdmin = false; auth.profile = null;
    if (session) {
      try {
        auth.isAdmin = !!(await call(() => sb.rpc('is_admin')));
        if (auth.isAdmin) auth.profile = (await call(() => sb.from('admin_profiles').select('*').eq('user_id', session.user.id).maybeSingle())) || null;
      } catch (e) { console.warn('[SIDE QUEST] admin check failed', e); }
    }
    auth.ready = true;
    try { await loadAdmin(); } catch (e) { console.warn('[SIDE QUEST] admin data failed', e); }
    emit();
  }
  async function fetchMyOrder(number) {
    const ref = readLS(LS.mine, []).find(x => x.order_number === number);
    if (!ref || mine.fetching[number]) return;
    mine.fetching[number] = true;
    try {
      const d = await call(() => sb.rpc('get_guest_order', { p_order_number: number, p_token: ref.token }));
      mine.cache[number] = d ? mapOrder(d.order, (d.items || []).map(i => Object.assign({ order_id: d.order.order_id }, i))) : null;
    } catch (e) { mine.cache[number] = null; }
    mine.fetching[number] = false; emit();
  }

  const findP = id => (adm.loaded ? adm.products : st.products).find(p => p.product_id === id) || st.products.find(p => p.product_id === id);
  const pubP = id => st.products.find(p => p.product_id === id);
  const cart = () => readLS(LS.cart, []);
  const uuidOf = number => { const o = adm.orders.find(x => x.order_id === number); return o ? o._uuid : null; };
  const fileName = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';

  const api = {
    backend: 'supabase', SETTINGS, ORDER_STATUSES, PAYMENT_STATUSES, PRODUCT_STATUSES, isOnSale, effectivePrice,
    configure(c) { cfg = c; },
    isReady() { return st.ready; },
    loadError() { return st.error; },
    init() {
      if (started) return; started = true;
      (async () => {
        try {
          sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
          await loadCatalog();
          st.ready = true; emit();
          const { data } = await sb.auth.getSession();
          await onSession(data.session);
          sb.auth.onAuthStateChange((_e, session) => { onSession(session); });
        } catch (e) { st.error = friendly(e); st.ready = true; console.error('[SIDE QUEST] Supabase init failed', e); emit(); }
      })();
      window.addEventListener('storage', e => { if (Object.values(LS).includes(e.key)) emit(); });
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscriberCount() { return subs.size; },
    refresh() { return attempt(() => refreshAll()); },
    resetDemoData() { return fail('Reset is only available in the local demo backend.'); },

    // Catalog
    categories() { return st.categories.slice(); },
    category(id) { return st.categories.find(c => c.category_id === id) || null; },
    products({ includeInactive = false } = {}) { return (includeInactive && adm.loaded ? adm.products : st.products).map(p => Object.assign({}, p)); },
    product(id) { const p = findP(id); return p ? Object.assign({}, p) : null; },
    inventoryItems(productId) {
      const src = adm.loaded ? adm.items : st.items, imgs = adm.loaded ? adm.itemImages : st.itemImages;
      return src.filter(i => !productId || i.product_id === productId).map(i => ({
        inventory_item_id: i.inventory_item_id, product_id: i.product_id, status: i.status || 'AVAILABLE', card_ledger_id: i.card_ledger_id || null,
        cert_number: i.cert_number || null, condition: i.condition, hold_reason: i.hold_reason || null,
        order_id: i.reserved_order_number || i.sold_order_number || null, acquisition_cost: i.acquisition_cost ?? null,
        images: imgs.filter(im => im.inventory_item_id === i.inventory_item_id).sort((a, b) => a.sort_order - b.sort_order).map(itemImg)
      }));
    },
    orderReservedQty(productId) { const p = adm.products.find(x => x.product_id === productId); return p ? p.order_reserved : 0; },

    // Cart (device). Availability comes from the live catalog; the database re-checks at checkout.
    cartQty(id) { const l = cart().find(x => x.product_id === id); return l ? l.qty : 0; },
    cartCount() { return api.cartLines().reduce((s, l) => s + l.qty, 0); },
    cartLines() {
      return cart().map(l => {
        const p = pubP(l.product_id); if (!p) return null;
        const qty = Math.min(l.qty, p.available_quantity);
        return { product: Object.assign({}, p), qty, max: p.available_quantity, unit_price: effectivePrice(p), line_total: qty * effectivePrice(p), adjusted: qty !== l.qty };
      }).filter(l => l && l.max > 0 && l.qty > 0);
    },
    addToCart(id, qty = 1) {
      qty = Math.floor(Number(qty));
      if (!(qty >= 1)) return fail('Choose a quantity of at least 1.');
      const p = pubP(id); if (!p) return fail('This item is no longer available.');
      const av = p.available_quantity, c = cart(), line = c.find(l => l.product_id === id), cur = line ? line.qty : 0;
      if (av <= 0) return fail('Sorry, this item is sold out.');
      if (cur >= av) return fail(av === 1 ? 'This one-of-a-kind item is already in your cart.' : `Only ${av} available, and they're all in your cart.`);
      const add = Math.min(qty, av - cur);
      if (line) line.qty = cur + add; else c.push({ product_id: id, qty: add, added_at: now() });
      writeLS(LS.cart, c); emit();
      return ok({ added: add, msg: add < qty ? `Only ${av} available. Added ${add} to cart.` : 'Added to cart' });
    },
    setCartQty(id, qty) {
      const c = cart(), line = c.find(l => l.product_id === id), p = pubP(id);
      if (!line || !p) return fail('Item not in cart.');
      qty = Math.floor(Number(qty));
      if (!(qty >= 1)) return api.removeFromCart(id);
      line.qty = Math.min(qty, p.available_quantity);
      writeLS(LS.cart, c.filter(l => l.qty > 0)); emit(); return ok();
    },
    removeFromCart(id) { writeLS(LS.cart, cart().filter(l => l.product_id !== id)); emit(); return ok(); },
    clearCart() { writeLS(LS.cart, []); emit(); },

    // Guest wishlist lives on the device; the wishlists tables are ready for customer accounts.
    wishlist() { return readLS(LS.wish, []).map(w => findP(w.product_id)).filter(Boolean); },
    isWished(id) { return readLS(LS.wish, []).some(w => w.product_id === id); },
    toggleWish(id) {
      const w = readLS(LS.wish, []);
      writeLS(LS.wish, api.isWished(id) ? w.filter(x => x.product_id !== id) : [...w, { product_id: id, created_at: now() }]);
      emit(); return api.isWished(id);
    },
    shippingFor() { return null; },

    // Orders
    async placeOrder({ customer = {}, shipping_address = {}, payment_method, notes } = {}) {
      const lines = api.cartLines();
      if (!lines.length) return fail('Your cart is empty.');
      try {
        const r = await call(() => sb.rpc('place_order', {
          p_customer: { name: customer.name, email: customer.email, phone: customer.mobile },
          p_address: { address: shipping_address.address, city: shipping_address.city, province: shipping_address.province, postal_code: shipping_address.postal },
          p_payment_method: payment_method, p_notes: notes || null,
          p_items: lines.map(l => ({ product_id: l.product.product_id, quantity: l.qty }))
        }));
        writeLS(LS.mine, [{ order_number: r.order_number, token: r.access_token, created_at: now() }, ...readLS(LS.mine, [])]);
        writeLS(LS.cart, []);
        await fetchMyOrder(r.order_number);
        refreshAll().catch(() => {});
        return ok({ order: mine.cache[r.order_number] || { order_id: r.order_number } });
      } catch (e) { refreshAll().catch(() => {}); return fail(e.message); }
    },
    orders() {
      if (adm.loaded) return adm.orders.slice();
      return readLS(LS.mine, []).map(x => { if (!(x.order_number in mine.cache)) fetchMyOrder(x.order_number); return mine.cache[x.order_number]; }).filter(Boolean);
    },
    order(id) {
      const a = adm.orders.find(o => o.order_id === id); if (a) return a;
      if (id in mine.cache) return mine.cache[id];
      if (readLS(LS.mine, []).some(x => x.order_number === id)) { fetchMyOrder(id); return undefined; }   // undefined = loading
      return null;
    },
    customers() { return []; },
    expireOverdueOrders() { return 0; },   // runs server-side via pg_cron

    // Admin (every call is re-checked by the database)
    setPaymentStatus(id, status) { return attempt(() => call(() => sb.rpc('admin_set_payment_status', { p_order_id: uuidOf(id), p_status: status })), refreshAll); },
    setOrderStatus(id, status, note) { return attempt(() => call(() => sb.rpc('admin_set_order_status', { p_order_id: uuidOf(id), p_status: status, p_note: note || null })), refreshAll); },
    extendHold(id, note) { return attempt(() => call(() => sb.rpc('admin_extend_hold', { p_order_id: uuidOf(id), p_note: note || null })), refreshAll); },
    restockOrder(id, note) { return attempt(() => call(() => sb.rpc('admin_return_items_to_stock', { p_order_id: uuidOf(id), p_note: note || null })), refreshAll); },
    setShippingFee(id, fee) {
      const n = fee === '' || fee == null ? null : Number(fee);
      if (n != null && !(n >= 0)) return Promise.resolve(fail('Shipping fee must be ₱0 or more.'));
      return attempt(() => call(() => sb.rpc('admin_set_shipping_fee', { p_order_id: uuidOf(id), p_fee: n })), refreshAll);
    },
    async saveProduct(d, isNew) {
      if (!d.name || !String(d.name).trim()) return fail('Name is required.');
      if (!d.sku || !String(d.sku).trim()) return fail('SKU is required.');
      if (!(Number(d.price) > 0)) return fail('Price must be greater than ₱0.');
      if (d.sale && !(Number(d.sale_price) > 0 && Number(d.sale_price) < Number(d.price))) return fail('Sale price must be above ₱0 and lower than the regular price.');
      const id = String(d.sku).trim().toUpperCase();
      const payload = {
        sku: id, name: String(d.name).trim(), category_id: d.category, subcategory: d.subcategory || '', description: d.description || '',
        pokemon: d.pokemon || '', set_name: d.set || '', card_number: d.card_number || '', language: d.language || 'English',
        condition: d.condition || '', product_type: d.product_type, grading_company: d.grading_company || '',
        grade: d.grade == null || d.grade === '' ? '' : String(d.grade), price: String(d.price), cost: d.cost == null ? '' : String(d.cost),
        sale_price: d.sale_price ? String(d.sale_price) : '', featured: !!d.featured, on_sale: !!d.sale, status: d.status || 'DRAFT', tags: d.tags || []
      };
      const qty = Math.max(0, Math.floor(Number(d.quantity) || 0));
      const orderRes = isNew ? 0 : api.orderReservedQty(id);
      const holds = Math.max(0, Math.floor(Number(d.reserved_quantity) || 0) - orderRes);
      return attempt(async () => {
        await call(() => sb.rpc('admin_upsert_product', { p: payload, p_is_new: !!isNew }));
        await call(() => sb.rpc('admin_set_stock', { p_product_id: id, p_quantity: qty, p_holds: holds, p_mark_sold: Math.max(0, d._mark_sold || 0) }));
        await call(() => sb.rpc('admin_replace_product_images', { p_product_id: id, p_images: (d.images || []).filter(i => i.storage_path).map(i => ({ storage_path: i.storage_path, public_url: i.url, alt_text: d.name })) }));
      }, refreshAll);
    },
    setProductStatus(id, status) { return attempt(() => call(() => sb.rpc('admin_set_product_status', { p_product_id: id, p_status: status })), refreshAll); },
    updateInventoryItem(itemId, patch) { return attempt(() => call(() => sb.rpc('admin_update_inventory_item', { p_item_id: itemId, p: patch })), refreshAll); },
    saveMessage(m) { return attempt(() => call(() => sb.rpc('submit_contact_message', { p_name: m.name, p_email: m.email, p_topic: m.topic, p_message: m.message }))); },

    // Images → Supabase Storage (never base64 in the database)
    async uploadProductImage(productId, blob) {
      if (!productId) return fail('Enter a SKU before uploading photos.');
      const path = `products/${String(productId).toUpperCase()}/${fileName()}`;
      try {
        await call(() => sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
        const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        return ok({ image: { image_id: path, url, storage_path: path, kind: 'product' } });
      } catch (e) { return fail(e.message); }
    },
    async addItemImage(itemId, { blob, type }) {
      const path = `inventory/${itemId}/${fileName()}`;
      return attempt(async () => {
        await call(() => sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
        const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        await call(() => sb.rpc('admin_add_item_image', { p_item_id: itemId, p_storage_path: path, p_public_url: url, p_type: type || 'OTHER' }));
      }, refreshAll);
    },
    async removeItemImage(itemId, imageId) {
      return attempt(async () => {
        const path = await call(() => sb.rpc('admin_remove_item_image', { p_image_id: imageId }));
        if (path) await call(() => sb.storage.from(BUCKET).remove([path]));
      }, refreshAll);
    },

    // Admin authentication (Supabase Auth). Authorization = admin_profiles + RLS, never the browser.
    auth: {
      ready: () => auth.ready,
      user: () => auth.session ? auth.session.user : null,
      isAdmin: () => auth.isAdmin,
      profile: () => auth.profile,
      async signIn(email, password) {
        try { await call(() => sb.auth.signInWithPassword({ email, password })); return ok(); } catch (e) { return fail(e.message); }
      },
      async sendPasswordReset(email) {
        try { await call(() => sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] + '#/admin' })); return ok(); } catch (e) { return fail(e.message); }
      },
      async signOut() { await sb.auth.signOut(); return ok(); }
    }
  };

  window.SQStoreSupabase = api;
})();
