// SIDE QUEST — store service (data layer).
// The UI ONLY talks to window.SQStore. Today it persists to this browser's localStorage;
// in Phase 2 each method is re-implemented against Supabase with the same signatures.
//
// Inventory model
//   product          = the listing (e.g. "Pikachu SVP 085 — PSA 10", product_id SQ-PIKA-085)
//   inventory_item   = one physical unit (e.g. SQ-INV-000123). Products with track_items=true
//                      get one item per unit, so the same physical card can never sell twice.
//   available_quantity = quantity − reserved_quantity (derived, never stored)
//
// Order stock states (order.stock)
//   RESERVED  → items held for the order (placed, not yet paid/packed)
//   COMMITTED → sale final: quantity reduced, items SOLD (payment PAID, or PACKED/SHIPPED/COMPLETED)
//   RELEASED  → cancelled/refunded before commit: items back to AVAILABLE. Order is closed.
//   RESTOCKED → cancelled/refunded after commit, and admin explicitly returned items to stock.
(function () {
  if (window.SQStoreLocal) return; // guard against the script being executed twice

  const SCHEMA = 3;
  let KEY = 'sq_store_v1';
  const SETTINGS = {
    currency: 'PHP',
    shipping: null,  // null = fee confirmed manually after checkout ("TBD"). Later: { metro_manila, provincial } or courier API
    reservation_hours: 24,
    low_stock_threshold: 2,
    enabled_payment_methods: ['GCASH', 'BANK_TRANSFER']
  };
  const ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
  const PAYMENT_STATUSES = ['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED'];
  const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'];
  const COMMIT_STATUSES = ['PACKED', 'SHIPPED', 'COMPLETED'];
  const CLOSE_STATUSES = ['CANCELLED', 'REFUNDED'];

  let db = null, seedRef = null, listening = false, statusSnap = {}, eventCtx = null, expiryTimer = null;
  const subs = new Set();
  const now = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));
  const ok = (extra = {}) => Object.assign({ ok: true }, extra);
  const fail = msg => ({ ok: false, msg });
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  function newItem(p) {
    const n = db.seq.inv++;
    return {
      inventory_item_id: 'SQ-INV-' + String(n).padStart(6, '0'), product_id: p.product_id, sku: p.sku,
      status: 'AVAILABLE', condition: p.condition || null, grading_company: p.grading_company || null,
      grade: p.grade ?? null, cert_number: null, cost: p.cost || 0, location: null, order_id: null,
      card_ledger_id: null, images: [], acquired_at: p.created_at || now(), sold_at: null
    };
  }
  function fresh(seed) {
    db = {
      schema: SCHEMA, version: seed.version, categories: clone(seed.categories), products: clone(seed.products),
      inventory_items: [], inventory_events: [], order_events: [], orders: [], customers: [], cart: [], wishlist: [], messages: [],
      seq: { order: 1001, inv: seed.inventory_start || 1, cus: 1 }
    };
    db.products.forEach(p => { if (p.track_items) for (let i = 0; i < p.quantity; i++) db.inventory_items.push(newItem(p)); });
    statusSnap = {}; logAudit();
    return db;
  }
  // Audit: every inventory status change is recorded (mirrors the inventory_events table).
  function snapStatuses() { statusSnap = {}; (db.inventory_items || []).forEach(i => { statusSnap[i.inventory_item_id] = i.status; }); }
  function logAudit() {
    const types = { 'AVAILABLE>RESERVED': 'RESERVED', 'RESERVED>SOLD': 'SOLD', 'AVAILABLE>SOLD': 'SOLD', 'RESERVED>AVAILABLE': 'RELEASED', 'SOLD>AVAILABLE': 'RETURNED_TO_STOCK' };
    db.inventory_events = db.inventory_events || [];
    db.inventory_items.forEach(i => {
      const prev = statusSnap[i.inventory_item_id];
      if (prev === i.status) return;
      db.inventory_events.push({
        event_id: db.inventory_events.length + 1, inventory_item_id: i.inventory_item_id, order_id: i.order_id || (eventCtx && eventCtx.order_id) || null,
        event_type: prev === undefined ? 'CREATED' : (eventCtx && eventCtx.type) || types[prev + '>' + i.status] || 'STATUS_CHANGE',
        previous_status: prev === undefined ? null : prev, new_status: i.status, performed_by: null,
        actor: (eventCtx && eventCtx.actor) || 'admin', notes: (eventCtx && eventCtx.note) || null, created_at: now()
      });
    });
    snapStatuses();
  }
  const withCtx = (ctx, fn) => { eventCtx = ctx; try { return fn(); } finally { eventCtx = null; } };
  function migrate(s) {
    if (!s.schema || s.schema < 2) {
      s.wishlist = (s.wishlist || []).map(x => typeof x === 'string' ? { customer_id: null, product_id: x, created_at: now() } : x);
      s.customers = s.customers || [];
      s.seq = Object.assign({ cus: 1 }, s.seq);
      (s.orders || []).forEach(o => { if (o.shipping_confirmed === undefined) o.shipping_confirmed = o.shipping_fee != null; });
      s.schema = 2;
    }
    if (s.schema < 3) {
      (s.inventory_items || []).forEach(i => { if (!('card_ledger_id' in i)) i.card_ledger_id = i.ledger_ref || null; delete i.ledger_ref; i.images = i.images || []; });
      (s.orders || []).forEach(o => { if (!('expires_at' in o)) o.expires_at = o.stock === 'RESERVED' ? (o.reserved_until || null) : null; });
      s.inventory_events = s.inventory_events || [];
      s.schema = 3;
    }
    s.order_events = s.order_events || [];
    return s;
  }
  function readStorage() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.products)) return migrate(s); } catch (e) {}
    return null;
  }
  // Pick up changes made in another tab before every write (simulates a shared backend).
  function sync() { const s = readStorage(); if (s) { db = s; snapStatuses(); } }
  function persist(notify = true) {
    logAudit();
    let saved = true;
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { saved = false; console.warn('SQStore: browser storage is full', e); }
    if (notify) emit();
    return saved;
  }

  const raw = id => db.products.find(p => p.product_id === id);
  const avail = p => Math.max(0, (p.quantity || 0) - (p.reserved_quantity || 0));
  function derive(p) {
    const out = Object.assign(clone(p), { available_quantity: avail(p) });
    // Storefront gallery: exact photos of the unit being sold first, then listing photos.
    const unit = p.track_items && db.inventory_items.find(i => i.product_id === p.product_id && i.status === 'AVAILABLE' && (i.images || []).length);
    out.gallery = (unit ? unit.images.map(im => ({ ...im, kind: (im.image_type || 'OTHER').toLowerCase(), item: unit.inventory_item_id })) : []).concat(out.images || []);
    return out;
  }
  const isOnSale = p => !!(p.sale && p.sale_price && p.sale_price < p.price);
  const effectivePrice = p => isOnSale(p) ? p.sale_price : p.price;
  const findOrder = id => db.orders.find(x => x.order_id === id);
  const isClosed = o => o.stock === 'RELEASED' || o.stock === 'RESTOCKED';
  const orderReserved = pid => db.orders.filter(o => o.stock === 'RESERVED')
    .reduce((s, o) => s + o.items.filter(i => i.product_id === pid).reduce((a, i) => a + i.quantity, 0), 0);

  function reconcileItems(p) {
    if (!p.track_items) return;
    let live = db.inventory_items.filter(i => i.product_id === p.product_id && i.status !== 'SOLD');
    while (live.length < p.quantity) { const it = newItem(p); db.inventory_items.push(it); live.push(it); }
    while (live.length > p.quantity) {
      const it = live.find(i => i.status === 'AVAILABLE') || live.find(i => !i.order_id) || live[live.length - 1];
      it.status = 'SOLD'; it.sold_at = now(); live = live.filter(i => i !== it);
    }
    let reserved = live.filter(i => i.status === 'RESERVED').length;
    for (const it of live) {
      if (reserved < p.reserved_quantity && it.status === 'AVAILABLE') { it.status = 'RESERVED'; reserved++; }
      else if (reserved > p.reserved_quantity && it.status === 'RESERVED' && !it.order_id) { it.status = 'AVAILABLE'; reserved--; }
    }
  }
  function commitStock(o) {
    o.items.forEach(li => {
      const p = raw(li.product_id); if (!p) return;
      p.quantity = Math.max(0, p.quantity - li.quantity);
      p.reserved_quantity = Math.max(0, Math.min(p.quantity, p.reserved_quantity - li.quantity));
      p.updated_at = now();
      db.inventory_items.filter(i => li.inventory_item_ids.includes(i.inventory_item_id)).forEach(i => { i.status = 'SOLD'; i.sold_at = now(); });
    });
    o.stock = 'COMMITTED'; o.expires_at = null;
  }
  function releaseStock(o, reason) {
    if (reason) o.cancel_reason = reason;
    o.expires_at = null;
    o.items.forEach(li => {
      const p = raw(li.product_id); if (!p) return;
      p.reserved_quantity = Math.max(0, p.reserved_quantity - li.quantity); p.updated_at = now();
      db.inventory_items.filter(i => li.inventory_item_ids.includes(i.inventory_item_id)).forEach(i => { i.status = 'AVAILABLE'; i.order_id = null; });
    });
    o.stock = 'RELEASED';
  }

  const api = {
    backend: 'local', auth: null, SETTINGS, ORDER_STATUSES, PAYMENT_STATUSES, PRODUCT_STATUSES, isOnSale, effectivePrice,
    isReady() { return !!db; },
    loadError() { return null; },

    init(seed, opts = {}) {
      if (opts.key) { KEY = opts.key; db = null; }
      if (db) return;
      seedRef = seed;
      db = opts.fresh ? null : readStorage();
      if (!db) { fresh(seed); persist(false); } else snapStatuses();
      api.expireOverdueOrders();
      if (!expiryTimer && !opts.noTimer) expiryTimer = setInterval(() => api.expireOverdueOrders(), 60000);
      if (!listening) {
        listening = true;
        window.addEventListener('storage', e => { if (e.key === KEY) { const s = readStorage(); if (s) { db = s; snapStatuses(); emit(); } } });
      }
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscriberCount() { return subs.size; },
    resetDemoData() { fresh(seedRef); persist(); },

    // Catalog
    categories() { return db.categories.slice().sort((a, b) => a.sort_order - b.sort_order); },
    category(id) { return db.categories.find(c => c.category_id === id) || null; },
    products({ includeInactive = false } = {}) { return db.products.filter(p => includeInactive || p.status === 'ACTIVE').map(derive); },
    product(id) { const p = raw(id); return p ? derive(p) : null; },
    inventoryItems(productId) { return clone(db.inventory_items.filter(i => !productId || i.product_id === productId)); },
    orderReservedQty(productId) { return orderReserved(productId); },

    // Cart — quantities can never exceed available_quantity
    cartQty(id) { const l = db.cart.find(x => x.product_id === id); return l ? l.qty : 0; },
    cartCount() { return api.cartLines().reduce((s, l) => s + l.qty, 0); },
    cartLines() {
      return db.cart.map(l => {
        const p = raw(l.product_id);
        if (!p || p.status !== 'ACTIVE') return null;
        const product = derive(p), qty = Math.min(l.qty, product.available_quantity);
        return { product, qty, max: product.available_quantity, unit_price: effectivePrice(p), line_total: qty * effectivePrice(p), adjusted: qty !== l.qty };
      }).filter(l => l && l.max > 0 && l.qty > 0);
    },
    addToCart(id, qty = 1) {
      sync();
      qty = Math.floor(Number(qty));
      if (!(qty >= 1)) return fail('Choose a quantity of at least 1.');
      const p = raw(id);
      if (!p || p.status !== 'ACTIVE') return fail('This item is no longer available.');
      const av = avail(p), cur = api.cartQty(id);
      if (av <= 0) return fail('Sorry, this item is sold out.');
      if (cur >= av) return fail(av === 1 ? 'This one-of-a-kind item is already in your cart.' : `Only ${av} available, and they're all in your cart.`);
      const add = Math.min(qty, av - cur);
      const line = db.cart.find(l => l.product_id === id);
      if (line) line.qty = cur + add; else db.cart.push({ product_id: id, qty: add, added_at: now() });
      persist();
      return ok({ added: add, msg: add < qty ? `Only ${av} available. Added ${add} to cart.` : 'Added to cart' });
    },
    setCartQty(id, qty) {
      sync();
      const p = raw(id), line = db.cart.find(l => l.product_id === id);
      if (!p || !line) return fail('Item not in cart.');
      qty = Math.floor(Number(qty));
      if (!(qty >= 1)) return api.removeFromCart(id);
      line.qty = Math.min(qty, avail(p));
      if (line.qty < 1) db.cart = db.cart.filter(l => l !== line);
      persist(); return ok();
    },
    removeFromCart(id) { sync(); db.cart = db.cart.filter(l => l.product_id !== id); persist(); return ok(); },
    clearCart() { sync(); db.cart = []; persist(); },

    // Wishlist (rows mirror the Supabase `wishlists` table; customer_id null = this device/guest)
    wishlist() { return db.wishlist.map(w => raw(w.product_id)).filter(Boolean).map(derive); },
    isWished(id) { return db.wishlist.some(w => w.product_id === id); },
    toggleWish(id) {
      sync();
      if (!raw(id)) return false;
      db.wishlist = api.isWished(id) ? db.wishlist.filter(w => w.product_id !== id) : [...db.wishlist, { customer_id: null, product_id: id, created_at: now() }];
      persist(); return api.isWished(id);
    },

    shippingFor(province) {
      if (!SETTINGS.shipping) return null;
      return province === 'Metro Manila' ? SETTINGS.shipping.metro_manila : SETTINGS.shipping.provincial;
    },

    // Orders — placing an order RESERVES stock + the exact physical items. No payment data is stored.
    placeOrder({ customer = {}, shipping_address = {}, payment_method, notes } = {}) {
      sync();
      const lines = api.cartLines();
      if (!lines.length) return fail('Your cart is empty.');
      if (!customer.name || !customer.email || !customer.mobile) return fail('Missing contact details.');
      if (!shipping_address.address || !shipping_address.city || !shipping_address.province || !shipping_address.postal) return fail('Missing shipping address.');
      if (!SETTINGS.enabled_payment_methods.includes(payment_method)) return fail('Please choose an available payment method.');
      for (const l of lines) {
        const p = raw(l.product.product_id);
        if (l.qty > avail(p)) return fail(`Only ${avail(p)} of ${p.name} available now.`);
        if (p.track_items && db.inventory_items.filter(i => i.product_id === p.product_id && i.status === 'AVAILABLE').length < l.qty)
          return fail(`${p.name} was just reserved by another order.`);
      }
      const order_id = 'SQ-ORD-' + db.seq.order++;
      let cust = db.customers.find(c => c.email.toLowerCase() === customer.email.toLowerCase());
      if (!cust) { cust = { customer_id: 'SQ-CUS-' + String(db.seq.cus++).padStart(5, '0'), created_at: now() }; db.customers.push(cust); }
      Object.assign(cust, { name: customer.name, email: customer.email, mobile: customer.mobile, updated_at: now() });
      const items = lines.map((l, idx) => {
        const p = raw(l.product.product_id);
        p.reserved_quantity += l.qty; p.updated_at = now();
        let ids = [];
        if (p.track_items) {
          const its = db.inventory_items.filter(i => i.product_id === p.product_id && i.status === 'AVAILABLE').slice(0, l.qty);
          its.forEach(i => { i.status = 'RESERVED'; i.order_id = order_id; });
          ids = its.map(i => i.inventory_item_id);
        }
        return { order_item_id: order_id + '-' + (idx + 1), product_id: p.product_id, sku: p.sku, name: p.name, unit_price: l.unit_price, quantity: l.qty, line_total: l.line_total, inventory_item_ids: ids };
      });
      const subtotal = items.reduce((s, i) => s + i.line_total, 0);
      const shipping_fee = api.shippingFor(shipping_address.province);
      const created = now();
      const order = {
        order_id, customer_id: cust.customer_id, customer_information: customer, shipping_address, items, subtotal, shipping_fee,
        discount: 0, total: subtotal + (shipping_fee || 0), shipping_confirmed: shipping_fee != null,
        payment_method, payment_status: 'UNPAID', payment_reference: null, order_status: 'PAYMENT_PENDING',
        notes: notes || '', stock: 'RESERVED', expires_at: new Date(Date.now() + SETTINGS.reservation_hours * 3600e3).toISOString(),
        created_at: created, updated_at: created
      };
      db.orders.unshift(order); db.cart = [];
      eventCtx = { actor: 'customer', order_id }; const saved = persist(); eventCtx = null;
      if (!saved) return fail('Could not save your order. Please try again.');
      return ok({ order: clone(order) });
    },
    orders() { return clone(db.orders); },
    order(id) { const o = findOrder(id); return o ? clone(o) : null; },
    customers() { return clone(db.customers); },

    // Mirrors admin_set_payment_status(): PAID → REFUNDED only; REFUNDED is final; PAID needs a live reservation.
    setPaymentStatus(id, status) {
      sync();
      const o = findOrder(id); if (!o) return fail('Order not found.');
      if (!PAYMENT_STATUSES.includes(status)) return fail('Unknown payment status.');
      const cur = o.payment_status;
      if (cur === 'REFUNDED' && status !== 'REFUNDED') return fail('This order was refunded. Its payment status is final.');
      if (cur === 'PAID' && !['PAID', 'REFUNDED'].includes(status)) return fail('A paid order can only be marked REFUNDED.');
      if (status === 'REFUNDED' && !['PAID', 'REFUNDED'].includes(cur)) return fail('Only a paid order can be refunded. Cancel the order instead.');
      if (status === 'PAID' && cur !== 'PAID' && o.stock !== 'RESERVED') return fail('This order no longer holds its items (they were released). It can’t be marked paid.');
      o.payment_status = status; o.updated_at = now();
      if (status === 'PAID') {
        if (o.stock === 'RESERVED') commitStock(o);
        if (['PENDING', 'PAYMENT_PENDING'].includes(o.order_status)) o.order_status = 'PAID';
      }
      persist(); return ok();
    },
    // Mirrors admin_set_order_status()
    setOrderStatus(id, status) {
      sync();
      const o = findOrder(id); if (!o) return fail('Order not found.');
      if (!ORDER_STATUSES.includes(status)) return fail('Unknown order status.');
      const pay = o.payment_status;
      if (isClosed(o) && !CLOSE_STATUSES.includes(status)) return fail('Cancelled orders can’t be reopened because their items were released. Create a new order instead.');
      if (status === 'REFUNDED' && !['PAID', 'REFUNDED'].includes(pay)) return fail('Nothing was paid on this order, so it can’t be refunded. Cancel it instead.');
      if (status === 'PAID' && pay === 'REFUNDED') return fail('This order was refunded. It can’t be marked paid again.');
      if (status === 'PAID' && pay !== 'PAID' && o.stock !== 'RESERVED') return fail('This order no longer holds its items (they were released). It can’t be marked paid.');
      if (COMMIT_STATUSES.includes(status) && pay !== 'PAID') return fail('Mark the payment as PAID before packing or shipping.');
      if (['PENDING', 'PAYMENT_PENDING'].includes(status) && ['PAID', 'REFUNDED'].includes(pay)) return fail('This order is already paid. It can’t go back to pending.');
      o.order_status = status; o.updated_at = now();
      if (status === 'PAID') o.payment_status = 'PAID';
      if (status === 'REFUNDED') o.payment_status = 'REFUNDED';
      if (o.stock === 'RESERVED') {
        if (status === 'CANCELLED') releaseStock(o, 'Cancelled by admin');
        else if (status === 'PAID') commitStock(o);
      }
      persist(); return ok();
    },
    // Only for orders cancelled/refunded AFTER the sale was final (e.g. a returned card).
    restockOrder(id) {
      sync();
      const o = findOrder(id); if (!o) return fail('Order not found.');
      if (o.stock !== 'COMMITTED' || !CLOSE_STATUSES.includes(o.order_status)) return fail('Only cancelled or refunded orders whose sale was finalized can be restocked.');
      o.items.forEach(li => {
        const p = raw(li.product_id); if (!p) return;
        p.quantity += li.quantity; p.updated_at = now();
        db.inventory_items.filter(i => li.inventory_item_ids.includes(i.inventory_item_id)).forEach(i => { i.status = 'AVAILABLE'; i.order_id = null; i.sold_at = null; });
      });
      o.stock = 'RESTOCKED'; o.updated_at = now();
      withCtx({ type: 'RETURNED_TO_STOCK', note: 'Returned to stock by admin', order_id: o.order_id }, () => persist()); return ok();
    },
    // EXTEND HOLD: deliberate admin action. Reservation is untouched; expires_at += 24h; audited.
    extendHold(id, note, performedBy) {
      sync();
      const o = findOrder(id); if (!o) return fail('Order not found.');
      if (o.stock !== 'RESERVED' || o.payment_status === 'PAID') return fail('Only unpaid orders that still hold reserved items can be extended.');
      const prev = o.expires_at || null, base = Math.max(prev ? new Date(prev).getTime() : Date.now(), Date.now());
      const next = new Date(base + SETTINGS.reservation_hours * 3600e3).toISOString();
      const who = performedBy || 'local-admin', why = (note && String(note).trim()) || 'Hold extended 24h by admin', at = now();
      o.expires_at = next; o.updated_at = at;
      db.order_events.push({ event_id: db.order_events.length + 1, order_id: o.order_id, field: 'expires_at', previous: prev, new: next, performed_by: who, actor: 'admin', notes: why, created_at: at });
      db.inventory_items.filter(i => i.order_id === o.order_id && i.status === 'RESERVED').forEach(i => db.inventory_events.push({
        event_id: db.inventory_events.length + 1, inventory_item_id: i.inventory_item_id, order_id: o.order_id, event_type: 'HOLD_EXTENDED',
        previous_status: 'RESERVED', new_status: 'RESERVED', performed_by: who, actor: 'admin', notes: why + ' → ' + next, created_at: at }));
      persist(); return ok({ expires_at: next });
    },
    orderEvents(id) { return clone((db.order_events || []).filter(e => !id || e.order_id === id)); },
    setShippingFee(id, fee) {
      sync();
      const o = findOrder(id); if (!o) return fail('Order not found.');
      const n = fee === '' || fee == null ? null : Number(fee);
      if (n != null && !(n >= 0)) return fail('Shipping fee must be ₱0 or more.');
      if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(o.order_status) || isClosed(o)) return fail(`This order is finalized (${o.order_status}), so its shipping fee can’t be changed.`);
      o.shipping_fee = n; o.shipping_confirmed = n != null;
      o.total = o.subtotal - o.discount + (n || 0); o.updated_at = now();
      persist(); return ok();
    },

    // Admin — inventory
    saveProduct(d, isNew) {
      sync();
      if (!d.name || !d.name.trim()) return fail('Name is required.');
      if (!d.sku || !d.sku.trim()) return fail('SKU is required.');
      if (!(Number(d.price) > 0)) return fail('Price must be greater than ₱0.');
      const p = clone(d);
      p.name = p.name.trim(); p.sku = p.sku.trim().toUpperCase();
      p.quantity = Math.max(0, Math.floor(Number(p.quantity) || 0));
      p.price = Number(p.price); p.cost = Number(p.cost) || 0;
      p.sale_price = p.sale_price ? Number(p.sale_price) : null;
      if (p.sale && !(p.sale_price > 0 && p.sale_price < p.price)) return fail('Sale price must be above ₱0 and lower than the regular price.');
      if (p.grade != null && p.grade !== '' && !(Number(p.grade) >= 1 && Number(p.grade) <= 10)) return fail('Grade must be between 1 and 10.');
      if (p.product_type === 'GRADED_CARD' && (!p.grading_company || p.grade == null)) return fail('Graded cards need a grading company and grade.');
      const locked = isNew ? 0 : orderReserved(p.product_id);
      if (p.quantity < locked) return fail(`${locked} unit(s) are reserved by open orders, so quantity can’t go below ${locked}.`);
      p.reserved_quantity = Math.min(p.quantity, Math.max(locked, Math.floor(Number(p.reserved_quantity) || 0)));
      p.images = (p.images || []).map((im, i) => Object.assign(im, { is_primary: i === 0, sort_order: i }));
      p.updated_at = now();
      delete p.available_quantity;
      const before = JSON.stringify(db);
      if (isNew) {
        p.product_id = p.sku;
        if (raw(p.product_id)) return fail('That SKU already exists.');
        p.created_at = p.updated_at;
        db.products.unshift(p);
      } else {
        const i = db.products.findIndex(x => x.product_id === p.product_id);
        if (i < 0) return fail('Product not found.');
        db.products[i] = p;
      }
      reconcileItems(p);
      if (!persist()) { db = JSON.parse(before); emit(); return fail('Browser storage is full. The photos are too large, so remove one or use a smaller image.'); }
      return ok({ product: derive(p) });
    },
    setProductStatus(id, status) {
      sync();
      const p = raw(id); if (!p) return fail('Product not found.');
      if (!PRODUCT_STATUSES.includes(status)) return fail('Unknown status.');
      p.status = status; p.updated_at = now(); persist(); return ok();
    },
    saveMessage(m) { sync(); db.messages.unshift(Object.assign({ message_id: 'MSG-' + Date.now(), created_at: now() }, m)); persist(); return ok(); },

    // 24h expiry. Local fallback runs in the browser; Supabase runs it server-side (pg_cron).
    expireOverdueOrders() {
      if (!db) return 0;
      sync();
      // Every unpaid reservation expires (incl. PENDING_VERIFICATION). Only extendHold() pushes the deadline.
      const due = db.orders.filter(o => o.stock === 'RESERVED' && o.payment_status !== 'PAID' && o.expires_at && new Date(o.expires_at).getTime() < Date.now());
      if (!due.length) return 0;
      due.forEach(o => {
        o.order_status = 'CANCELLED'; o.updated_at = now();
        withCtx({ type: 'EXPIRED', actor: 'system', note: 'Expired: unpaid after 24 hours', order_id: o.order_id }, () => { releaseStock(o, 'EXPIRED: unpaid after 24 hours'); logAudit(); });
      });
      persist();
      return due.length;
    },

    // Exact physical-item photos + Card Ledger link (local stores images as data URLs; Supabase uses Storage)
    addItemImage(itemId, { url, type }) {
      sync();
      const it = db.inventory_items.find(i => i.inventory_item_id === itemId); if (!it) return fail('Inventory item not found.');
      it.images = it.images || [];
      it.images.push({ image_id: itemId + '-IMG-' + Date.now().toString(36), url, storage_path: null, image_type: type || 'OTHER', sort_order: it.images.length, is_primary: it.images.length === 0 });
      const before = JSON.stringify(db);
      if (!persist()) { db = JSON.parse(before); it.images.pop(); emit(); return fail('Browser storage is full. Use a smaller photo.'); }
      return ok();
    },
    removeItemImage(itemId, imageId) {
      sync();
      const it = db.inventory_items.find(i => i.inventory_item_id === itemId); if (!it) return fail('Inventory item not found.');
      it.images = (it.images || []).filter(im => im.image_id !== imageId); persist(); return ok();
    },
    updateInventoryItem(itemId, patch) {
      sync();
      const it = db.inventory_items.find(i => i.inventory_item_id === itemId); if (!it) return fail('Inventory item not found.');
      if (patch.card_ledger_id && db.inventory_items.some(i => i !== it && i.card_ledger_id === patch.card_ledger_id)) return fail('That Card Ledger ID is already linked to another item.');
      ['card_ledger_id', 'cert_number', 'condition', 'internal_notes'].forEach(k => { if (k in patch) it[k] = patch[k] || null; });
      persist(); return ok();
    },
    inventoryEvents(itemId) { return clone((db.inventory_events || []).filter(e => !itemId || e.inventory_item_id === itemId)); }
  };

  window.SQStoreLocal = api;
})();
