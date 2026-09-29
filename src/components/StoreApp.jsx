// SIDE QUEST — StoreApp
// Ported from SIDE QUEST Store.dc.html (Claude Design Component) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import Admin from './Admin.jsx';
import ProductCard from './ProductCard.jsx';
import ProductImage from './ProductImage.jsx';

export default class StoreApp extends React.Component {
  emptyF() {
    return {
      cat: '',
      sub: '',
      min: '',
      max: '',
      cond: [],
      lang: [],
      grade: [],
      inStock: false,
      sale: false,
      sort: 'featured',
    };
  }
  state = {
    ready: false,
    route: this.parse(),
    w: window.innerWidth,
    q: '',
    f: this.emptyF(),
    filtersOpen: false,
    menuOpen: false,
    qty: 1,
    img: 0,
    toast: null,
    toastCart: false,
    co: {
      name: '',
      email: '',
      mobile: '',
      address: '',
      city: '',
      province: 'Metro Manila',
      postal: '',
      notes: '',
      payment: 'GCASH',
    },
    coErr: '',
    ct: { name: '', email: '', topic: 'Product inquiry', message: '' },
    ctSent: false,
    ctErr: '',
    edit: null,
    editErr: '',
    orderView: null,
    adminQ: '',
  };

  toastFn = (m) => this.showToast(m);
  parse() {
    const h = (location.hash || '#/').slice(1);
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    (qs || '')
      .split('&')
      .filter(Boolean)
      .forEach((kv) => {
        const [k, v] = kv.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      });
    return { page: parts[0] || 'home', id: parts[1] || null, params };
  }
  routePatch(r) {
    const patch = { route: r, qty: 1, img: 0, menuOpen: false, filtersOpen: false, orderView: null };
    if (r.page === 'shop') {
      patch.f = { ...this.emptyF(), sort: this.state.f.sort, cat: r.params.cat || '', sale: r.params.sale === '1' };
      patch.q = r.params.q || '';
    }
    return patch;
  }
  componentDidMount() {
    this.onHash = () => {
      this.setState(this.routePatch(this.parse()));
      window.scrollTo(0, 0);
    };
    this.onResize = () => this.setState({ w: window.innerWidth });
    window.addEventListener('hashchange', this.onHash);
    window.addEventListener('resize', this.onResize);
    const tryInit = () => {
      if (window.SQ_SEED && window.SQStore && window.SQView) {
        window.SQStore.init(window.SQ_SEED);
        this.unsub = window.SQStore.subscribe(() => this.forceUpdate());
        this.unsubS = window.SQStore;
        this.setState({ ready: true, ...this.routePatch(this.parse()) });
      } else this.initT = setTimeout(tryInit, 40);
    };
    tryInit();
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHash);
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.initT);
    clearTimeout(this.toastT);
    if (this.unsub) this.unsub();
  }

  showToast(msg, cart) {
    clearTimeout(this.toastT);
    this.setState({ toast: msg, toastCart: !!cart });
    this.toastT = setTimeout(() => this.setState({ toast: null }), 2800);
  }
  add(id, qty = 1) {
    const r = window.SQStore.addToCart(id, qty);
    this.showToast(r.msg, r.ok);
    return r;
  }
  setF(patch) {
    this.setState((s) => ({ f: { ...s.f, ...patch } }));
  }
  vm(p) {
    const S = window.SQStore,
      av = p.available_quantity,
      onSale = S.isOnSale(p),
      wished = S.isWished(p.product_id);
    const a = SQView.availOf(av),
      b = SQView.badgeOf(p),
      meta = SQView.metaOf(p);
    return {
      id: p.product_id,
      href: '#/product/' + p.product_id,
      name: p.name,
      catLabel: SQView.catName(p.category),
      priceText: SQView.peso(onSale ? p.sale_price : p.price),
      origPriceText: SQView.peso(p.price),
      hasSale: onSale,
      priceColor: onSale ? 'var(--color-accent-700)' : 'var(--color-text)',
      availText: a.text,
      availDot: a.dot,
      hasBadge: !!b,
      badge: b ? b.t : '',
      badgeBg: b ? b.bg : '',
      badgeFg: b ? b.fg : '',
      meta,
      hasMeta: !!meta,
      wished,
      heartFill: wished ? 'currentColor' : 'none',
      heartColor: wished ? 'var(--color-accent)' : 'var(--color-text)',
      soldOut: av <= 0,
      addLabel: av <= 0 ? 'Sold out' : 'Add to cart',
      onWish: (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const on = S.toggleWish(p.product_id);
        this.showToast(on ? 'Saved to wishlist' : 'Removed from wishlist');
      },
      onAdd: () => this.add(p.product_id, 1),
      image: SQView.imgVM(p, 0),
    };
  }
  renderVals() {
    try {
      return this.buildVals();
    } catch (e) {
      console.error('[SIDE QUEST] render failed', e);
      return {
        fatal: true,
        loading: false,
        isStore: false,
        isAdmin: false,
        hasToast: false,
        reload: () => location.reload(),
      };
    }
  }
  buildVals() {
    const S = window.SQStore;
    if (S && S.loadError && S.loadError())
      return {
        fatal: true,
        loading: false,
        isStore: false,
        isAdmin: false,
        hasToast: false,
        reload: () => location.reload(),
      };
    if (
      !this.state.ready ||
      !S ||
      !window.SQ_SEED ||
      !window.SQView ||
      (S.isReady && !S.isReady() && S.backend === 'supabase')
    )
      return { loading: true, isStore: false, isAdmin: false, hasToast: false };
    S.init(window.SQ_SEED);
    if (!this.unsubS || this.unsubS !== S) {
      if (this.unsub) this.unsub();
      this.unsub = S.subscribe(() => this.forceUpdate());
      this.unsubS = S;
    }
    const st = this.state,
      r = st.route,
      page = r.page,
      mobile = st.w < 1024;
    const cartCount = S.cartCount(),
      wishCount = S.wishlist().length;
    const cats = S.categories();
    const isAdmin = page === 'admin';
    const known = [
      'home',
      'shop',
      'product',
      'cart',
      'checkout',
      'order',
      'wishlist',
      'about',
      'contact',
      'account',
      'admin',
    ];
    const pg = known.includes(page) ? page : 'notfound';
    const navActive = (k) =>
      pg === 'shop' &&
      ((k === 'all' && !st.f.cat && !st.f.sale) || (k === 'sale' && st.f.sale) || (k === st.f.cat && !st.f.sale));
    const navItems = [
      { k: 'all', label: 'SHOP ALL', href: '#/shop' },
      ...cats.map((c) => ({ k: c.category_id, label: c.name.toUpperCase(), href: '#/shop?cat=' + c.category_id })),
      { k: 'sale', label: 'SALE', href: '#/shop?sale=1' },
    ].map((n) => ({
      ...n,
      color: n.k === 'sale' ? 'var(--color-accent)' : navActive(n.k) ? 'var(--color-accent)' : 'var(--color-text)',
      menuColor: n.k === 'sale' ? 'var(--color-accent)' : 'var(--color-text)',
      bar: navActive(n.k) ? 'var(--color-accent)' : 'transparent',
    }));
    const red = 'var(--color-accent)',
      ink = 'var(--color-text)';

    const v = {
      loading: false,
      isStore: !isAdmin,
      isAdmin,
      isDesktop: !mobile,
      isMobile: mobile,
      isHome: pg === 'home',
      isShop: pg === 'shop',
      isProduct: pg === 'product',
      isCart: pg === 'cart',
      isCheckout: pg === 'checkout',
      isOrder: pg === 'order',
      isWishlist: pg === 'wishlist',
      isAbout: pg === 'about',
      isContact: pg === 'contact',
      isAccount: pg === 'account',
      isNotFound: pg === 'notfound',
      navItems,
      cartCount,
      hasCart: cartCount > 0,
      wishCount,
      hasWish: wishCount > 0,
      q: st.q,
      onQ: (e) => this.setState({ q: e.target.value }),
      doSearch: () => {
        location.hash = '#/shop?q=' + encodeURIComponent(this.state.q.trim());
      },
      onQKey: (e) => {
        if (e.key === 'Enter') {
          location.hash = '#/shop?q=' + encodeURIComponent(this.state.q.trim());
        }
      },
      navGap: st.w < 1180 ? '18px' : '32px',
      navFont: st.w < 1180 ? '12px' : '13px',
      mainPadB: mobile ? '64px' : '0px',
      cardMin: mobile ? 'min(100%, 158px)' : '232px',
      gridGap: mobile ? '10px' : '18px',
      homeCardMin: mobile ? 'min(100%, 158px)' : '260px',
      catCols:
        st.w >= 1180 ? 'repeat(6,minmax(0,1fr))' : st.w >= 700 ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))',
      trustCols: st.w >= 1000 ? 'repeat(4,minmax(0,1fr))' : st.w >= 560 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
      lineTotalCol: mobile ? '2' : 'auto',
      lineTotalAlign: mobile ? 'left' : 'right',
      splitCols: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(320px,400px)',
      summaryPos: mobile ? 'static' : 'sticky',
      menuOpen: st.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      stop: (e) => e.stopPropagation(),
      bn: {
        home: pg === 'home' ? red : ink,
        shop: pg === 'shop' || pg === 'product' ? red : ink,
        cats: st.menuOpen ? red : ink,
        wish: pg === 'wishlist' ? red : ink,
        acct: pg === 'account' ? red : ink,
      },
      footShop: navItems.slice(1, 7),
      hasToast: !!st.toast,
      toast: st.toast,
      toastCart: st.toastCart,
      toastBottom: mobile ? '76px' : '24px',
    };
    const all = S.products();

    if (pg === 'home') {
      const heroPool = all.filter((p) => p.featured && p.available_quantity > 0);
      const pick = (id, i) => {
        const p = all.find((x) => x.product_id === id && x.available_quantity > 0) || heroPool[i] || all[i] || all[0];
        if (!p) return { href: '#/shop', image: { kind: 'item', title: 'SIDE QUEST' }, name: 'Shop all', price: '' };
        return {
          href: '#/product/' + p.product_id,
          image: SQView.imgVM(p),
          name: p.name,
          price: SQView.peso(S.effectivePrice(p)),
        };
      };
      Object.assign(v, {
        hasHeroProducts: all.length > 0,
        hero0: pick('SQ-PIKA-085', 0),
        hero1: pick('SQ-CHAR-199', 1),
        hero2: pick('SQ-PRE-ETB', 2),
        homeCats: cats.map((c, i) => {
          const ps = all.filter((p) => p.category === c.category_id),
            rep = ps.find((p) => p.featured) || ps[0];
          return {
            n: String(i + 1).padStart(2, '0'),
            name: c.name,
            desc: c.description,
            countText: ps.length + (ps.length === 1 ? ' item' : ' items'),
            href: '#/shop?cat=' + c.category_id,
            image: rep ? SQView.imgVM(rep) : { kind: 'item', title: c.name },
          };
        }),
        featured: all
          .filter((p) => p.featured)
          .sort((a, b) => (b.available_quantity > 0) - (a.available_quantity > 0))
          .slice(0, 8)
          .map((p) => this.vm(p)),
      });
    }

    if (pg === 'shop') {
      const f = st.f,
        q = st.q.trim().toLowerCase(),
        ep = (p) => S.effectivePrice(p);
      let base = all;
      if (q)
        base = base.filter((p) =>
          [p.name, p.pokemon, p.set, p.card_number, p.sku, p.subcategory, ...(p.tags || [])]
            .join(' ')
            .toLowerCase()
            .includes(q),
        );
      let list = f.cat ? base.filter((p) => p.category === f.cat) : base;
      const subs = [...new Set(list.map((p) => p.subcategory).filter(Boolean))];
      if (f.sub) list = list.filter((p) => p.subcategory === f.sub);
      if (f.min !== '') list = list.filter((p) => ep(p) >= Number(f.min));
      if (f.max !== '') list = list.filter((p) => ep(p) <= Number(f.max));
      if (f.cond.length) list = list.filter((p) => f.cond.includes(p.condition));
      if (f.lang.length) list = list.filter((p) => f.lang.includes(p.language));
      const gradeOf = (p) =>
        p.product_type === 'GRADED_CARD' ? p.grading_company : p.product_type === 'SINGLE' ? 'Raw' : '';
      if (f.grade.length) list = list.filter((p) => f.grade.includes(gradeOf(p)));
      if (f.inStock) list = list.filter((p) => p.available_quantity > 0);
      if (f.sale) list = list.filter((p) => S.isOnSale(p));
      const byNew = (a, b) => b.created_at.localeCompare(a.created_at);
      const sorters = {
        featured: (a, b) =>
          b.featured - a.featured || (b.available_quantity > 0) - (a.available_quantity > 0) || byNew(a, b),
        newest: byNew,
        price_asc: (a, b) => ep(a) - ep(b),
        price_desc: (a, b) => ep(b) - ep(a),
        name: (a, b) => a.name.localeCompare(b.name),
      };
      list = list.slice().sort(sorters[f.sort] || sorters.featured);
      const chip = (label, on, onClick) => ({
        label,
        on,
        onClick,
        bg: on ? ink : 'transparent',
        fg: on ? 'var(--color-bg)' : ink,
        bd: on ? ink : 'var(--color-divider)',
      });
      const tog = (key, val) => () =>
        this.setState((s) => {
          const a = s.f[key];
          return { f: { ...s.f, [key]: a.includes(val) ? a.filter((x) => x !== val) : [...a, val] } };
        });
      const activeCount =
        [f.cat, f.sub, f.min, f.max].filter(Boolean).length +
        f.cond.length +
        f.lang.length +
        f.grade.length +
        (f.inStock ? 1 : 0) +
        (f.sale ? 1 : 0);
      const catObj = S.category(f.cat);
      const storeEmpty = all.length === 0;
      v.noResultsTitle = storeEmpty ? 'New stock coming soon' : 'No products match';
      v.hasActiveFilters = !storeEmpty;
      v.noResultsText = storeEmpty
        ? 'We’re photographing and listing our first cards now. Check back soon.'
        : f.cat && !all.some((p) => p.category === f.cat)
          ? 'Nothing in this category right now. Check back soon, or browse everything.'
          : q
            ? 'Nothing matched your search. Try a set name, Pokémon or card number.'
            : 'Try removing a filter or two.';
      Object.assign(v, {
        shopTitle: f.sale ? 'Sale' : catObj ? catObj.name : q ? `Results for “${st.q.trim()}”` : 'Shop all',
        results: list.map((p) => this.vm(p)),
        hasResults: list.length > 0,
        noResults: list.length === 0,
        resultCount: list.length,
        resultText: `${list.length} ${list.length === 1 ? 'product' : 'products'}`,
        filterBtnLabel: activeCount ? `Filters (${activeCount})` : 'Filters',
        sort: f.sort,
        onSort: (e) => this.setF({ sort: e.target.value }),
        sortOpts: [
          ['featured', 'Featured'],
          ['newest', 'Newest'],
          ['price_asc', 'Price: Low to High'],
          ['price_desc', 'Price: High to Low'],
          ['name', 'Name'],
        ].map(([v2, l]) => ({ v: v2, l })),
        catRows: [
          { id: '', label: 'All products', count: base.length },
          ...cats.map((c) => ({
            id: c.category_id,
            label: c.label,
            count: base.filter((p) => p.category === c.category_id).length,
          })),
        ].map((c) => {
          const on = f.cat === c.id;
          return {
            ...c,
            bg: on ? ink : 'transparent',
            fg: on ? 'var(--color-bg)' : ink,
            fw: on ? 800 : 400,
            onClick: () => this.setF({ cat: c.id, sub: '' }),
          };
        }),
        hasSubs: !!f.cat && subs.length > 1,
        subChips: subs.map((s) => chip(s, f.sub === s, () => this.setF({ sub: f.sub === s ? '' : s }))),
        fMin: f.min,
        fMax: f.max,
        onMin: (e) => this.setF({ min: e.target.value }),
        onMax: (e) => this.setF({ max: e.target.value }),
        filterGroups: [
          {
            title: 'Condition',
            opts: ['NM', 'LP', 'MP', 'HP', 'DMG', 'New', 'Sealed'].map((c) =>
              chip(c, f.cond.includes(c), tog('cond', c)),
            ),
          },
          { title: 'Language', opts: ['English', 'Japanese'].map((c) => chip(c, f.lang.includes(c), tog('lang', c))) },
          {
            title: 'Grading',
            opts: ['Raw', 'PSA', 'BGS', 'CGC'].map((c) => chip(c, f.grade.includes(c), tog('grade', c))),
          },
          {
            title: 'Availability & sale',
            opts: [
              chip('In stock only', f.inStock, () => this.setF({ inStock: !f.inStock })),
              chip('On sale', f.sale, () => this.setF({ sale: !f.sale })),
            ],
          },
        ],
        clearFilters: () => this.setState({ f: { ...this.emptyF(), sort: this.state.f.sort }, q: '' }),
        openFilters: () => this.setState({ filtersOpen: true }),
        closeFilters: () => this.setState({ filtersOpen: false }),
        shopCols: mobile ? 'minmax(0,1fr)' : '250px minmax(0,1fr)',
        asideDisplay: mobile ? (st.filtersOpen ? 'block' : 'none') : 'block',
        asidePos: mobile ? 'fixed' : 'sticky',
        asideTop: mobile ? '0px' : '150px',
        asideBottom: mobile ? '0px' : 'auto',
        asideZ: mobile ? 95 : 1,
        asideMaxH: mobile ? 'none' : 'calc(100vh - 170px)',
        asidePad: mobile ? '12px 20px 32px' : '0 6px 0 0',
      });
    }

    if (pg === 'product') {
      const p = S.product(r.id);
      if (!p || p.status !== 'ACTIVE') Object.assign(v, { pNotFound: true, hasP: false });
      else {
        const base = this.vm(p),
          av = p.available_quantity,
          inCart = S.cartQty(p.product_id),
          maxAdd = Math.max(0, av - inCart);
        const qty = Math.max(1, Math.min(st.qty, maxAdd || 1));
        const imgs = p.gallery && p.gallery.length ? p.gallery : p.images && p.images.length ? p.images : [{}],
          gp = { ...p, images: imgs },
          idx = Math.min(st.img, imgs.length - 1);
        const inv = S.inventoryItems(p.product_id).find((i) => i.status === 'AVAILABLE');
        const chips = [];
        if (p.product_type === 'GRADED_CARD') chips.push(`${p.grading_company} ${p.grade}`);
        if (p.condition) chips.push(SQView.COND[p.condition] || p.condition);
        if (['SINGLE', 'GRADED_CARD', 'SEALED'].includes(p.product_type)) chips.push(p.language);
        const details = [
          ['SKU', p.sku],
          ['Pokémon', p.pokemon],
          ['Set', p.set],
          ['Card number', p.card_number],
          ['Language', p.language],
          ['Condition', SQView.COND[p.condition] || p.condition],
          ['Grading', p.grading_company ? `${p.grading_company} ${p.grade}` : ''],
          ['Product type', SQView.TYPES[p.product_type]],
          ['Inventory ID', p.track_items && av === 1 && inv ? inv.inventory_item_id : ''],
        ]
          .filter((x) => x[1])
          .map(([k, val]) => ({ k, v: val }));
        const unique = p.track_items && av === 1;
        Object.assign(v, {
          hasP: true,
          pNotFound: false,
          galleryPos: mobile ? 'static' : 'sticky',
          pd: {
            ...base,
            catHref: '#/shop?cat=' + p.category,
            kicker: [base.catLabel, p.subcategory].filter(Boolean).join(' · '),
            chips,
            saveText: `SAVE ${SQView.peso(p.price - (p.sale_price || p.price))}`,
            mainImage: SQView.imgVM(gp, idx),
            thumbs: imgs.map((im, i) => ({
              image: SQView.imgVM(gp, i),
              label: 'Photo ' + (i + 1),
              bd: i === idx ? ink : 'var(--color-divider)',
              onClick: () => this.setState({ img: i }),
            })),
            availNote:
              av <= 0
                ? ''
                : unique
                  ? '· One physical item. This exact card ships to you.'
                  : inCart
                    ? `· ${inCart} in your cart`
                    : '',
            canBuy: maxAdd > 0,
            cantBuy: maxAdd <= 0,
            cantBuyText:
              av <= 0
                ? "Sold out. Save it to your wishlist and we'll keep it on your radar."
                : 'All available units are already in your cart.',
            wishLabel: base.wished ? 'Saved' : 'Save to wishlist',
            qty,
            decDisabled: qty <= 1,
            incDisabled: qty >= maxAdd,
            decOp: qty <= 1 ? 0.35 : 1,
            incOp: qty >= maxAdd ? 0.35 : 1,
            onDec: () => this.setState((s) => ({ qty: Math.max(1, s.qty - 1) })),
            onInc: () => this.setState((s) => ({ qty: Math.min(maxAdd, s.qty + 1) })),
            onAdd: () => {
              this.add(p.product_id, qty);
              this.setState({ qty: 1 });
            },
            onBuyNow: () => {
              const res = window.SQStore.addToCart(p.product_id, qty);
              if (res.ok || window.SQStore.cartQty(p.product_id) > 0) location.hash = '#/checkout';
              else this.showToast(res.msg);
            },
            details,
            description: p.description || '—',
            shipText:
              'Cards ship sleeved, in a toploader or slab sleeve, inside a rigid mailer. We confirm your shipping fee after you order.',
          },
          related: all
            .filter((x) => x.category === p.category && x.product_id !== p.product_id)
            .slice(0, 4)
            .map((x) => this.vm(x)),
        });
        v.hasRelated = v.related.length > 0;
      }
    }

    if (pg === 'cart' || pg === 'checkout') {
      const lines = S.cartLines(),
        subtotal = lines.reduce((s, l) => s + l.line_total, 0);
      const ship = S.shippingFor(st.co.province);
      Object.assign(v, {
        cartEmpty: !lines.length,
        cartHas: lines.length > 0,
        lineCols: mobile ? '80px minmax(0,1fr)' : '104px minmax(0,1fr) auto',
        cartLines: lines.map((l) => {
          const p = l.product,
            atMax = l.qty >= l.max,
            meta = SQView.metaOf(p);
          return {
            href: '#/product/' + p.product_id,
            image: SQView.imgVM(p),
            name: p.name,
            catLabel: SQView.catName(p.category),
            meta,
            hasMeta: !!meta,
            unitText: SQView.peso(l.unit_price),
            qty: l.qty,
            lineText: SQView.peso(l.line_total),
            decOp: l.qty <= 1 ? 0.35 : 1,
            incOp: atMax ? 0.35 : 1,
            incDisabled: atMax,
            onDec: () => (l.qty <= 1 ? S.removeFromCart(p.product_id) : S.setCartQty(p.product_id, l.qty - 1)),
            onInc: () => S.setCartQty(p.product_id, l.qty + 1),
            onRemove: () => S.removeFromCart(p.product_id),
            hasNote: atMax,
            note: l.max === 1 ? 'One of one. This is the only unit.' : `Max available: ${l.max}`,
          };
        }),
        subtotalText: SQView.peso(subtotal),
        shipText: ship == null ? 'TBD' : SQView.peso(ship),
        shipNote: ship == null ? 'Calculated after checkout. We confirm the fee with you before you pay.' : '',
        totalText: ship == null ? `${SQView.peso(subtotal)} + shipping` : SQView.peso(subtotal + ship),
      });
      if (pg === 'checkout') {
        const co = st.co;
        const set = (k) => (e) => {
          const val = e.target.value;
          this.setState((s) => ({ co: { ...s.co, [k]: val }, coErr: '' }));
        };
        const fld = (k, label, o = {}) => ({
          k,
          label,
          value: co[k],
          onChange: set(k),
          type: o.type || 'text',
          inputMode: o.im || 'text',
          auto: o.auto || 'on',
          ph: o.ph || '',
          span: o.full ? '1 / -1' : 'auto',
          isInput: !o.select && !o.area,
          isSelect: !!o.select,
          isTextarea: !!o.area,
          options: o.select || [],
        });
        v.coSections = [
          {
            n: '01',
            title: 'Contact',
            fields: [
              fld('name', 'Full name', { full: true, auto: 'name' }),
              fld('email', 'Email', { type: 'email', im: 'email', auto: 'email', ph: 'you@email.com' }),
              fld('mobile', 'Mobile number', { type: 'tel', im: 'tel', auto: 'tel', ph: '09XX XXX XXXX' }),
            ],
          },
          {
            n: '02',
            title: 'Shipping address',
            fields: [
              fld('address', 'House no., street, barangay', { full: true, auto: 'street-address' }),
              fld('city', 'City / Municipality', { auto: 'address-level2' }),
              fld('province', 'Province', { select: SQView.PROVINCES.map((x) => ({ v: x, l: x })) }),
              fld('postal', 'Postal code', { im: 'numeric', auto: 'postal-code', ph: 'e.g. 1100' }),
            ],
          },
          {
            n: '03',
            title: 'Order notes',
            fields: [fld('notes', 'Anything we should know? (optional)', { full: true, area: true })],
          },
        ];
        v.payMethods = [
          {
            id: 'GCASH',
            label: 'GCash',
            desc: "We'll send our GCash details and the exact amount after you place your order.",
          },
          {
            id: 'BANK_TRANSFER',
            label: 'Bank transfer',
            desc: "We'll send our bank details after you place your order.",
          },
          {
            id: 'ONLINE_GATEWAY',
            label: 'Card / online payment',
            desc: 'Pay online with card or e-wallet through a payment gateway.',
            disabled: true,
            tag: 'COMING SOON',
          },
        ].map((m) => {
          const on = co.payment === m.id;
          return {
            ...m,
            on,
            disabled: !!m.disabled,
            hasTag: !!m.tag,
            bd: on ? '2px solid var(--color-text)' : '1px solid var(--color-divider)',
            bg: on ? 'var(--color-surface)' : 'transparent',
            cursor: m.disabled ? 'not-allowed' : 'pointer',
            op: m.disabled ? 0.55 : 1,
            onPick: () => !m.disabled && this.setState((s) => ({ co: { ...s.co, payment: m.id } })),
          };
        });
        v.hasCoErr = !!st.coErr;
        v.coErr = st.coErr;
        v.placing = !!st.placing;
        v.placeLabel = st.placing ? 'PLACING ORDER…' : 'PLACE ORDER';
        v.placeOrder = () => {
          const c = this.state.co,
            errs = [];
          if (!c.name.trim()) errs.push('your full name');
          if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) errs.push('a valid email');
          const m = c.mobile.replace(/[\s-]/g, '');
          if (!/^(09\d{9}|\+639\d{9})$/.test(m)) errs.push('a valid PH mobile number (09XXXXXXXXX)');
          if (!c.address.trim()) errs.push('your street address');
          if (!c.city.trim()) errs.push('your city');
          if (!/^\d{4}$/.test(c.postal.trim())) errs.push('a 4-digit postal code');
          if (errs.length) return this.setState({ coErr: 'Please enter ' + errs.join(', ') + '.' });
          if (this.state.placing) return;
          this.setState({ placing: true, coErr: '' });
          const res = S.placeOrder({
            customer: { name: c.name.trim(), email: c.email.trim(), mobile: m },
            shipping_address: {
              address: c.address.trim(),
              city: c.city.trim(),
              province: c.province,
              postal: c.postal.trim(),
              country: 'PH',
            },
            payment_method: c.payment,
            notes: c.notes.trim(),
          });
          Promise.resolve(res).then((r) => {
            this.setState({ placing: false });
            if (!r.ok) return this.setState({ coErr: r.msg });
            location.hash = '#/order/' + r.order.order_id;
          });
        };
      }
    }

    if (pg === 'order') {
      const o = S.order(r.id);
      if (o === undefined) Object.assign(v, { oLoading: true, oNotFound: false, hasO: false });
      else if (!o) Object.assign(v, { oNotFound: true, hasO: false });
      else {
        const ss = SQView.statusStyle(o.order_status);
        const instr = {
          GCASH: `We'll message you with our GCash details and the final amount (including shipping) shortly. Send the payment, then reply with your GCash reference number. Your items are held for ${S.SETTINGS.reservation_hours} hours.`,
          BANK_TRANSFER: `We'll message you with our bank details and the final amount (including shipping) shortly. Send the transfer, then reply with a screenshot of your receipt. Your items are held for ${S.SETTINGS.reservation_hours} hours.`,
          ONLINE_GATEWAY: "Online payment is not yet available. We'll contact you to arrange payment.",
        }[o.payment_method];
        Object.assign(v, {
          hasO: true,
          oNotFound: false,
          od: {
            id: o.order_id,
            firstName: o.customer_information.name.split(' ')[0],
            email: o.customer_information.email,
            mobile: o.customer_information.mobile,
            statusLabel: SQView.label(o.order_status),
            statusBg: ss.bg,
            statusFg: ss.fg,
            payLabel: SQView.PAY[o.payment_method],
            payStatus: SQView.label(o.payment_status).toLowerCase(),
            totalText: o.shipping_confirmed ? SQView.peso(o.total) : `${SQView.peso(o.subtotal)} + shipping`,
            subtotalText: SQView.peso(o.subtotal),
            shipText: o.shipping_confirmed ? SQView.peso(o.shipping_fee) : "TBD — we'll confirm",
            instructions: instr,
            items: o.items.map((i) => ({ ...i, lineText: SQView.peso(i.line_total) })),
            shipTo: `${o.customer_information.name}, ${SQView.shipToText(o.shipping_address)}`,
            hasNotes: !!o.notes,
            notes: o.notes,
          },
        });
      }
    }

    if (pg === 'wishlist') {
      const w = S.wishlist().filter((p) => p.status === 'ACTIVE');
      Object.assign(v, { wishItems: w.map((p) => this.vm(p)), wishEmpty: !w.length });
    }

    if (pg === 'account') {
      const os = S.orders();
      v.myOrders = os.map((o) => {
        const s = SQView.statusStyle(o.order_status);
        return {
          href: '#/order/' + o.order_id,
          id: o.order_id,
          date: SQView.fmtDate(o.created_at),
          status: SQView.label(o.order_status),
          bg: s.bg,
          fg: s.fg,
          total: SQView.peso(o.total),
        };
      });
      v.noMyOrders = !os.length;
    }

    if (pg === 'contact') {
      const ct = st.ct,
        set = (k) => (e) => {
          const val = e.target.value;
          this.setState((s) => ({ ct: { ...s.ct, [k]: val }, ctErr: '' }));
        };
      Object.assign(v, {
        ctSent: st.ctSent,
        ctForm: !st.ctSent,
        hasCtErr: !!st.ctErr,
        ctErr: st.ctErr,
        ctFields: [
          { label: 'Name', value: ct.name, onChange: set('name'), type: 'text', isInput: true },
          { label: 'Email', value: ct.email, onChange: set('email'), type: 'email', isInput: true },
          {
            label: 'Topic',
            value: ct.topic,
            onChange: set('topic'),
            isSelect: true,
            options: ['Product inquiry', 'Order question', 'Buy / Sell / Trade', 'Other'].map((x) => ({ v: x, l: x })),
          },
          { label: 'Message', value: ct.message, onChange: set('message'), isTextarea: true },
        ],
        ctSubmit: () => {
          const c = this.state.ct;
          if (!c.name.trim() || !/^\S+@\S+\.\S+$/.test(c.email) || !c.message.trim())
            return this.setState({ ctErr: 'Please add your name, a valid email and a message.' });
          Promise.resolve(S.saveMessage({ ...c })).then((r) => {
            if (r && r.ok === false) return this.setState({ ctErr: r.msg });
            this.setState({ ctSent: true, ct: { name: '', email: '', topic: 'Product inquiry', message: '' } });
          });
        },
        ctReset: () => this.setState({ ctSent: false }),
      });
    }

    if (isAdmin) {
      v.adminTab = ['inventory', 'orders'].includes(r.id) ? r.id : 'dashboard';
      v.toastFn = this.toastFn;
    }
    return v;
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] StoreApp.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        {v.loading ? (
          <>
            {' '}
            <div
              style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg)',
              }}
            >
              <img src={'/assets/sidequest-logo.png'} alt={'SIDE QUEST'} style={{ width: '180px', opacity: '.9' }} />
            </div>
          </>
        ) : null}

        {v.fatal ? (
          <>
            {' '}
            <div
              style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                alignItems: 'flex-start',
                justifyContent: 'center',
                maxWidth: '560px',
                margin: '0 auto',
                padding: '24px',
              }}
            >
              {' '}
              <img
                src={'/assets/sidequest-logo.png'}
                alt={'SIDE QUEST'}
                style={{ width: '160px', height: 'auto' }}
              />{' '}
              <h1 style={{ margin: '0', textTransform: 'uppercase', fontSize: '32px' }}>{'Something went wrong'}</h1>{' '}
              <p style={{ margin: '0', color: 'var(--color-neutral-800)' }}>
                {'Please reload the page. Your cart and wishlist are saved.'}
              </p>{' '}
              <a
                href={'#/'}
                onClick={v.reload}
                className="btn btn-primary"
                style={{ minWidth: '200px', justifyContent: 'space-between' }}
              >
                {'RELOAD '}
                <span>{'→'}</span>
              </a>{' '}
            </div>
          </>
        ) : null}

        {v.isStore ? (
          <>
            <div
              style={{
                background: 'var(--color-text)',
                color: 'var(--color-bg)',
                fontSize: '12px',
                letterSpacing: '.08em',
              }}
            >
              {' '}
              <div
                style={{
                  maxWidth: '1320px',
                  margin: '0 auto',
                  padding: '8px clamp(16px,4vw,40px)',
                  display: 'flex',
                  gap: '24px',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {' '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
                  <span style={{ display: 'flex', gap: '3px' }}>
                    <span style={{ width: '14px', height: '3px', background: 'var(--sq-gold)' }}></span>
                    <span style={{ width: '14px', height: '3px', background: 'var(--color-accent)' }}></span>
                  </span>
                  {'COLLECT • TRADE • HOBBIES'}
                </div>{' '}
                {v.isDesktop ? (
                  <>
                    <span style={{ opacity: '.85' }}>{'Nationwide shipping across the Philippines'}</span>
                  </>
                ) : null}{' '}
              </div>
            </div>

            <header
              style={{
                position: 'sticky',
                top: '0',
                zIndex: '30',
                background: 'var(--color-bg)',
                borderBottom: '2px solid var(--color-text)',
              }}
            >
              {' '}
              {v.isDesktop ? (
                <>
                  {' '}
                  <div
                    style={{
                      maxWidth: '1320px',
                      margin: '0 auto',
                      padding: '12px clamp(16px,4vw,40px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'clamp(20px,3vw,40px)',
                    }}
                  >
                    {' '}
                    <a href={'#/'} aria-label={'SIDE QUEST home'} style={{ display: 'block', flex: 'none' }}>
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                        style={{ height: '64px', width: 'auto', display: 'block' }}
                      />
                    </a>{' '}
                    <div
                      style={{
                        flex: '1',
                        maxWidth: '640px',
                        display: 'flex',
                        border: '2px solid var(--color-text)',
                        background: 'var(--color-bg)',
                      }}
                    >
                      {' '}
                      <input
                        value={v.q}
                        onChange={v.onQ}
                        onKeyDown={v.onQKey}
                        placeholder={'Search cards, sets, sealed products…'}
                        aria-label={'Search'}
                        style={{
                          flex: '1',
                          minWidth: '0',
                          border: '0',
                          background: 'transparent',
                          padding: '11px 14px',
                          font: 'inherit',
                          fontSize: '15px',
                          color: 'var(--color-text)',
                          outline: 'none',
                        }}
                      />{' '}
                      <button
                        onClick={v.doSearch}
                        aria-label={'Search'}
                        className="sqp0"
                        style={{
                          border: '0',
                          background: 'var(--color-text)',
                          color: 'var(--color-bg)',
                          width: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {' '}
                        <svg
                          width={'18'}
                          height={'18'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2.5'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <circle cx={'11'} cy={'11'} r={'8'}></circle>
                          <path d={'m21 21-4.3-4.3'}></path>
                        </svg>{' '}
                      </button>{' '}
                    </div>{' '}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                      {' '}
                      <a
                        href={'#/account'}
                        className="sqp1"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '6px 10px',
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          letterSpacing: '.06em',
                        }}
                      >
                        {' '}
                        <svg
                          width={'22'}
                          height={'22'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path d={'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}></path>
                          <circle cx={'12'} cy={'7'} r={'4'}></circle>
                        </svg>
                        {'ACCOUNT'}
                      </a>{' '}
                      <a
                        href={'#/wishlist'}
                        className="sqp1"
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '6px 10px',
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          letterSpacing: '.06em',
                        }}
                      >
                        {' '}
                        <svg
                          width={'22'}
                          height={'22'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path
                            d={
                              'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                            }
                          ></path>
                        </svg>
                        {'WISHLIST '}
                        {v.hasWish ? (
                          <>
                            <span
                              style={{
                                position: 'absolute',
                                top: '0',
                                right: '8px',
                                minWidth: '18px',
                                height: '18px',
                                padding: '0 4px',
                                background: 'var(--color-text)',
                                color: 'var(--color-bg)',
                                fontSize: '11px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {T(v.wishCount)}
                            </span>
                          </>
                        ) : null}{' '}
                      </a>{' '}
                      <a
                        href={'#/cart'}
                        className="sqp1"
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '6px 10px',
                          color: 'var(--color-text)',
                          textDecoration: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          letterSpacing: '.06em',
                        }}
                      >
                        {' '}
                        <svg
                          width={'22'}
                          height={'22'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path d={'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'}></path>
                          <path d={'M3 6h18'}></path>
                          <path d={'M16 10a4 4 0 0 1-8 0'}></path>
                        </svg>
                        {'CART '}
                        {v.hasCart ? (
                          <>
                            <span
                              style={{
                                position: 'absolute',
                                top: '0',
                                right: '4px',
                                minWidth: '18px',
                                height: '18px',
                                padding: '0 4px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                fontSize: '11px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {T(v.cartCount)}
                            </span>
                          </>
                        ) : null}{' '}
                      </a>{' '}
                    </div>{' '}
                  </div>{' '}
                  <nav style={{ borderTop: '1px solid var(--color-divider)' }}>
                    {' '}
                    <div
                      style={{
                        maxWidth: '1320px',
                        margin: '0 auto',
                        padding: '0 clamp(16px,4vw,40px)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        columnGap: v.navGap,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {' '}
                      {L(v.navItems).map((n, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <a
                            href={n?.href}
                            className="sqp1"
                            style={{
                              padding: '13px 0 10px',
                              fontSize: v.navFont,
                              fontWeight: '800',
                              letterSpacing: '.07em',
                              color: n?.color,
                              textDecoration: 'none',
                              borderBottom: `3px solid ${S(n?.bar)}`,
                            }}
                          >
                            {T(n?.label)}
                          </a>{' '}
                        </React.Fragment>
                      ))}{' '}
                    </div>{' '}
                  </nav>{' '}
                </>
              ) : null}{' '}
              {v.isMobile ? (
                <>
                  {' '}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                    {' '}
                    <button
                      onClick={v.openMenu}
                      aria-label={'Menu'}
                      style={{
                        width: '44px',
                        height: '44px',
                        border: '0',
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {' '}
                      <svg
                        width={'24'}
                        height={'24'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2.2'}
                        strokeLinecap={'round'}
                      >
                        <path d={'M4 6h16M4 12h16M4 18h16'}></path>
                      </svg>{' '}
                    </button>{' '}
                    <a href={'#/'} aria-label={'SIDE QUEST home'} style={{ display: 'block' }}>
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST'}
                        style={{ height: '46px', width: 'auto', display: 'block' }}
                      />
                    </a>{' '}
                    <a
                      href={'#/cart'}
                      aria-label={'Cart'}
                      style={{
                        position: 'relative',
                        marginLeft: 'auto',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text)',
                      }}
                    >
                      {' '}
                      <svg
                        width={'24'}
                        height={'24'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <path d={'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'}></path>
                        <path d={'M3 6h18'}></path>
                        <path d={'M16 10a4 4 0 0 1-8 0'}></path>
                      </svg>{' '}
                      {v.hasCart ? (
                        <>
                          <span
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '2px',
                              minWidth: '18px',
                              height: '18px',
                              padding: '0 4px',
                              background: 'var(--color-accent)',
                              color: 'var(--color-bg)',
                              fontSize: '11px',
                              fontWeight: '800',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {T(v.cartCount)}
                          </span>
                        </>
                      ) : null}{' '}
                    </a>{' '}
                  </div>{' '}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--color-divider)' }}>
                    {' '}
                    <input
                      value={v.q}
                      onChange={v.onQ}
                      onKeyDown={v.onQKey}
                      placeholder={'Search cards, sets, sealed…'}
                      aria-label={'Search'}
                      style={{
                        flex: '1',
                        minWidth: '0',
                        border: '0',
                        background: 'transparent',
                        padding: '12px 16px',
                        font: 'inherit',
                        fontSize: '16px',
                        color: 'var(--color-text)',
                        outline: 'none',
                      }}
                    />{' '}
                    <button
                      onClick={v.doSearch}
                      aria-label={'Search'}
                      style={{
                        border: '0',
                        borderLeft: '1px solid var(--color-divider)',
                        background: 'transparent',
                        width: '52px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text)',
                      }}
                    >
                      {' '}
                      <svg
                        width={'20'}
                        height={'20'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2.5'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <circle cx={'11'} cy={'11'} r={'8'}></circle>
                        <path d={'m21 21-4.3-4.3'}></path>
                      </svg>{' '}
                    </button>{' '}
                  </div>{' '}
                </>
              ) : null}
            </header>

            <main style={{ minHeight: '60vh', paddingBottom: v.mainPadB }}>
              {v.isHome ? (
                <>
                  {' '}
                  <section
                    data-screen-label={'Home'}
                    style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}
                  >
                    {' '}
                    <div
                      style={{
                        maxWidth: '1320px',
                        margin: '0 auto',
                        padding: 'clamp(40px,7vw,96px) clamp(16px,4vw,40px)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))',
                        gap: 'clamp(32px,5vw,64px)',
                        alignItems: 'center',
                      }}
                    >
                      {' '}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.16em',
                            color: 'var(--sq-gold)',
                          }}
                        >
                          <span style={{ display: 'flex', gap: '3px' }}>
                            <span style={{ width: '22px', height: '4px', background: 'var(--sq-gold)' }}></span>
                            <span style={{ width: '22px', height: '4px', background: 'var(--color-accent)' }}></span>
                          </span>
                          {'COLLECT • TRADE • HOBBIES'}
                        </div>{' '}
                        <h1
                          style={{
                            fontSize: 'clamp(38px,8.2vw,116px)',
                            lineHeight: '.9',
                            letterSpacing: '-.035em',
                            margin: '0',
                            textTransform: 'uppercase',
                            color: 'var(--color-bg)',
                          }}
                        >
                          {'Find your next'}
                          <br />
                          <span style={{ color: 'var(--color-accent)' }}>{'Quest'}</span>
                        </h1>{' '}
                        <p
                          style={{
                            fontSize: 'clamp(14px,1.3vw,17px)',
                            fontWeight: '600',
                            letterSpacing: '.14em',
                            lineHeight: '1.8',
                            margin: '0',
                            color: 'var(--color-neutral-300)',
                          }}
                        >
                          {'POKÉMON • COLLECTIBLES'}
                          <br />
                          {'ACCESSORIES • AND MORE'}
                        </p>{' '}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {' '}
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{
                              padding: '17px 20px',
                              fontSize: '15px',
                              letterSpacing: '.06em',
                              minWidth: '220px',
                              justifyContent: 'space-between',
                              gap: '24px',
                            }}
                          >
                            {'SHOP NOW '}
                            <svg
                              width={'18'}
                              height={'18'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2.5'}
                              strokeLinecap={'round'}
                              strokeLinejoin={'round'}
                            >
                              <path d={'M5 12h14M12 5l7 7-7 7'}></path>
                            </svg>
                          </a>{' '}
                          <a
                            href={'#/shop?cat=psa'}
                            className="btn sqp2"
                            style={{
                              padding: '17px 20px',
                              fontSize: '15px',
                              letterSpacing: '.06em',
                              border: '1px solid var(--color-neutral-600)',
                              color: 'var(--color-bg)',
                            }}
                          >
                            {'PSA SLABS'}
                          </a>{' '}
                        </div>{' '}
                      </div>{' '}
                      {v.hasHeroProducts ? (
                        <>
                          {' '}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.15fr 1fr',
                              gridTemplateRows: '1fr 1fr',
                              gap: '12px',
                              height: 'clamp(380px,42vw,560px)',
                            }}
                          >
                            {' '}
                            <a
                              href={v.hero0?.href}
                              style={{
                                gridRow: '1 / 3',
                                position: 'relative',
                                display: 'block',
                                background: 'var(--color-surface)',
                                textDecoration: 'none',
                              }}
                            >
                              {' '}
                              <ProductImage
                                image={v.hero0?.image}
                                __hostStyle={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '44px' }}
                              />{' '}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '0',
                                  right: '0',
                                  bottom: '0',
                                  height: '44px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '0 14px',
                                  background: 'var(--color-bg)',
                                  color: 'var(--color-text)',
                                  borderTop: '2px solid var(--color-text)',
                                  fontSize: '13px',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: '600',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {T(v.hero0?.name)}
                                </span>
                                <span style={{ fontWeight: '800', color: 'var(--color-accent-700)' }}>
                                  {T(v.hero0?.price)}
                                </span>
                              </div>{' '}
                            </a>{' '}
                            <a
                              href={v.hero1?.href}
                              style={{
                                position: 'relative',
                                display: 'block',
                                background: 'var(--color-surface)',
                                textDecoration: 'none',
                              }}
                            >
                              {' '}
                              <ProductImage
                                image={v.hero1?.image}
                                __hostStyle={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '38px' }}
                              />{' '}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '0',
                                  right: '0',
                                  bottom: '0',
                                  height: '38px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '0 12px',
                                  background: 'var(--color-bg)',
                                  color: 'var(--color-text)',
                                  borderTop: '2px solid var(--color-text)',
                                  fontSize: '12px',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: '600',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {T(v.hero1?.name)}
                                </span>
                                <span style={{ fontWeight: '800', color: 'var(--color-accent-700)' }}>
                                  {T(v.hero1?.price)}
                                </span>
                              </div>{' '}
                            </a>{' '}
                            <a
                              href={v.hero2?.href}
                              style={{
                                position: 'relative',
                                display: 'block',
                                background: 'var(--color-surface)',
                                textDecoration: 'none',
                              }}
                            >
                              {' '}
                              <ProductImage
                                image={v.hero2?.image}
                                __hostStyle={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '38px' }}
                              />{' '}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '0',
                                  right: '0',
                                  bottom: '0',
                                  height: '38px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '0 12px',
                                  background: 'var(--color-bg)',
                                  color: 'var(--color-text)',
                                  borderTop: '2px solid var(--color-text)',
                                  fontSize: '12px',
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: '600',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {T(v.hero2?.name)}
                                </span>
                                <span style={{ fontWeight: '800', color: 'var(--color-accent-700)' }}>
                                  {T(v.hero2?.price)}
                                </span>
                              </div>{' '}
                            </a>{' '}
                          </div>{' '}
                        </>
                      ) : null}{' '}
                    </div>{' '}
                  </section>{' '}
                  <section
                    style={{
                      maxWidth: '1320px',
                      margin: '0 auto',
                      padding: 'clamp(48px,6vw,88px) clamp(16px,4vw,40px) 0',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        gap: '16px',
                        flexWrap: 'wrap',
                        borderBottom: '2px solid var(--color-text)',
                        paddingBottom: '14px',
                      }}
                    >
                      {' '}
                      <div>
                        {' '}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.14em',
                            color: 'var(--color-accent-700)',
                            marginBottom: '6px',
                          }}
                        >
                          {'01 — CATEGORIES'}
                        </div>{' '}
                        <h2 style={{ fontSize: 'clamp(28px,3.4vw,44px)', margin: '0', textTransform: 'uppercase' }}>
                          {'Shop by category'}
                        </h2>{' '}
                      </div>{' '}
                      <a href={'#/shop'} className="btn btn-ghost" style={{ fontSize: '14px' }}>
                        {'View all products →'}
                      </a>{' '}
                    </div>{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: v.catCols,
                        gap: '1px',
                        background: 'var(--color-divider)',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      {' '}
                      {L(v.homeCats).map((c, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <a
                            href={c?.href}
                            className="sqp3"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              textDecoration: 'none',
                              color: 'var(--color-text)',
                              background: 'var(--color-bg)',
                            }}
                          >
                            {' '}
                            <div style={{ position: 'relative', aspectRatio: '4/3' }}>
                              <ProductImage image={c?.image} __hostStyle={{ position: 'absolute', inset: '0' }} />
                            </div>{' '}
                            <div
                              style={{
                                padding: '14px 16px 18px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                              }}
                            >
                              {' '}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ fontWeight: '800', color: 'var(--color-accent-700)' }}>{T(c?.n)}</span>
                                <span style={{ color: 'var(--color-neutral-700)' }}>{T(c?.countText)}</span>
                              </div>{' '}
                              <div
                                style={{
                                  fontWeight: '800',
                                  fontSize: '18px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '-.01em',
                                }}
                              >
                                {T(c?.name)}
                              </div>{' '}
                              <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{T(c?.desc)}</div>{' '}
                            </div>{' '}
                          </a>{' '}
                        </React.Fragment>
                      ))}{' '}
                    </div>{' '}
                  </section>{' '}
                  <section
                    style={{
                      maxWidth: '1320px',
                      margin: '0 auto',
                      padding: 'clamp(48px,6vw,88px) clamp(16px,4vw,40px)',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        gap: '16px',
                        flexWrap: 'wrap',
                        borderBottom: '2px solid var(--color-text)',
                        paddingBottom: '14px',
                        marginBottom: '20px',
                      }}
                    >
                      {' '}
                      <div>
                        {' '}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.14em',
                            color: 'var(--color-accent-700)',
                            marginBottom: '6px',
                          }}
                        >
                          {'02 — FEATURED'}
                        </div>{' '}
                        <h2 style={{ fontSize: 'clamp(28px,3.4vw,44px)', margin: '0', textTransform: 'uppercase' }}>
                          {'Featured finds'}
                        </h2>{' '}
                      </div>{' '}
                      <a href={'#/shop'} className="btn btn-ghost" style={{ fontSize: '14px' }}>
                        {'Shop all →'}
                      </a>{' '}
                    </div>{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill,minmax(${S(v.homeCardMin)},1fr))`,
                        gap: v.gridGap,
                      }}
                    >
                      {' '}
                      {L(v.featured).map((p, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <ProductCard p={p} />{' '}
                        </React.Fragment>
                      ))}{' '}
                    </div>{' '}
                  </section>{' '}
                  <section
                    style={{
                      borderTop: '2px solid var(--color-text)',
                      borderBottom: '2px solid var(--color-text)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        maxWidth: '1320px',
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: v.trustCols,
                        gap: '1px',
                        background: 'var(--color-divider)',
                      }}
                    >
                      {' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: '32px clamp(16px,3vw,32px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {' '}
                        <svg
                          width={'28'}
                          height={'28'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <path
                            d={
                              'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'
                            }
                          ></path>
                          <path d={'m9 12 2 2 4-4'}></path>
                        </svg>{' '}
                        <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '.04em' }}>
                          {'AUTHENTIC PRODUCTS'}
                        </div>{' '}
                        <div style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                          {'Sourced from trusted suppliers'}
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: '32px clamp(16px,3vw,32px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {' '}
                        <svg
                          width={'28'}
                          height={'28'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <path d={'M16.5 9.4 7.55 4.24'}></path>
                          <path
                            d={
                              'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'
                            }
                          ></path>
                          <path d={'M3.29 7 12 12l8.71-5'}></path>
                          <path d={'M12 22V12'}></path>
                        </svg>{' '}
                        <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '.04em' }}>
                          {'SECURE PACKAGING'}
                        </div>{' '}
                        <div style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                          {'Cards packed carefully for protection'}
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: '32px clamp(16px,3vw,32px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {' '}
                        <svg
                          width={'28'}
                          height={'28'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <path d={'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'}></path>
                          <path d={'M15 18H9'}></path>
                          <path
                            d={'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14'}
                          ></path>
                          <circle cx={'17'} cy={'18'} r={'2'}></circle>
                          <circle cx={'7'} cy={'18'} r={'2'}></circle>
                        </svg>{' '}
                        <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '.04em' }}>
                          {'NATIONWIDE SHIPPING'}
                        </div>{' '}
                        <div style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                          {'Shipping throughout the Philippines'}
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: '32px clamp(16px,3vw,32px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {' '}
                        <svg
                          width={'28'}
                          height={'28'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <path d={'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'}></path>
                          <circle cx={'9'} cy={'7'} r={'4'}></circle>
                          <path d={'M22 21v-2a4 4 0 0 0-3-3.87'}></path>
                          <path d={'M16 3.13a4 4 0 0 1 0 7.75'}></path>
                        </svg>{' '}
                        <div style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '.04em' }}>
                          {'HOBBY COMMUNITY'}
                        </div>{' '}
                        <div style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                          {'Buy • Sell • Trade • Connect'}
                        </div>{' '}
                      </div>{' '}
                    </div>{' '}
                  </section>
                </>
              ) : null}

              {v.isShop ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Shop'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '24px clamp(16px,4vw,40px) 72px' }}
                  >
                    {' '}
                    <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', display: 'flex', gap: '6px' }}>
                      <a href={'#/'} style={{ color: 'inherit' }}>
                        {'Home'}
                      </a>
                      <span>{'/'}</span>
                      <span>{'Shop'}</span>
                    </div>{' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '8px 0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {T(v.shopTitle)}
                    </h1>{' '}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                        borderTop: '2px solid var(--color-text)',
                        borderBottom: '1px solid var(--color-divider)',
                        padding: '10px 0',
                        marginBottom: '24px',
                      }}
                    >
                      {' '}
                      {v.isMobile ? (
                        <>
                          {' '}
                          <button
                            onClick={v.openFilters}
                            className="btn btn-secondary"
                            style={{ minHeight: '44px', gap: '8px' }}
                          >
                            {' '}
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2'}
                              strokeLinecap={'round'}
                            >
                              <path d={'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'}></path>
                            </svg>
                            {T(v.filterBtnLabel)}{' '}
                          </button>{' '}
                        </>
                      ) : null}{' '}
                      <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>{T(v.resultText)}</span>{' '}
                      <label
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        {' '}
                        <span style={{ color: 'var(--color-neutral-700)' }}>{'Sort'}</span>{' '}
                        <select
                          value={v.sort}
                          onChange={v.onSort}
                          className="input"
                          style={{ width: 'auto', minWidth: '180px', minHeight: '40px', background: 'var(--color-bg)' }}
                        >
                          {L(v.sortOpts).map((o, $index) => (
                            <React.Fragment key={$index}>
                              <option value={o?.v}>{T(o?.l)}</option>
                            </React.Fragment>
                          ))}
                        </select>{' '}
                      </label>{' '}
                    </div>{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: v.shopCols,
                        gap: 'clamp(24px,3vw,40px)',
                        alignItems: 'start',
                      }}
                    >
                      {' '}
                      <aside
                        style={{
                          display: v.asideDisplay,
                          position: v.asidePos,
                          top: v.asideTop,
                          left: '0',
                          right: '0',
                          bottom: v.asideBottom,
                          zIndex: v.asideZ,
                          maxHeight: v.asideMaxH,
                          overflowY: 'auto',
                          scrollbarWidth: 'thin',
                          background: 'var(--color-bg)',
                          padding: v.asidePad,
                        }}
                      >
                        {' '}
                        {v.isMobile ? (
                          <>
                            {' '}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '2px solid var(--color-text)',
                                paddingBottom: '12px',
                                marginBottom: '4px',
                              }}
                            >
                              {' '}
                              <div style={{ fontWeight: '800', fontSize: '20px', textTransform: 'uppercase' }}>
                                {'Filters'}
                              </div>{' '}
                              <button
                                onClick={v.closeFilters}
                                aria-label={'Close filters'}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  border: '0',
                                  background: 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--color-text)',
                                }}
                              >
                                <svg
                                  width={'22'}
                                  height={'22'}
                                  viewBox={'0 0 24 24'}
                                  fill={'none'}
                                  stroke={'currentColor'}
                                  strokeWidth={'2.2'}
                                  strokeLinecap={'round'}
                                >
                                  <path d={'M18 6 6 18M6 6l12 12'}></path>
                                </svg>
                              </button>{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            padding: '14px 0 10px',
                          }}
                        >
                          {'Category'}
                        </div>{' '}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {' '}
                          {L(v.catRows).map((c, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <button
                                onClick={c?.onClick}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  width: '100%',
                                  minHeight: '38px',
                                  padding: '8px 10px',
                                  border: '0',
                                  background: c?.bg,
                                  color: c?.fg,
                                  font: 'inherit',
                                  fontSize: '14px',
                                  fontWeight: c?.fw,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <span>{T(c?.label)}</span>
                                <span style={{ fontSize: '12px', opacity: '.7' }}>{T(c?.count)}</span>
                              </button>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                        {v.hasSubs ? (
                          <>
                            {' '}
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                letterSpacing: '.1em',
                                textTransform: 'uppercase',
                                padding: '16px 0 10px',
                                marginTop: '12px',
                                borderTop: '1px solid var(--color-divider)',
                              }}
                            >
                              {'Subcategory'}
                            </div>{' '}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {' '}
                              {L(v.subChips).map((o, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <button
                                    onClick={o?.onClick}
                                    style={{
                                      padding: '7px 10px',
                                      minHeight: '34px',
                                      font: 'inherit',
                                      fontSize: '13px',
                                      border: `1px solid ${S(o?.bd)}`,
                                      background: o?.bg,
                                      color: o?.fg,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {T(o?.label)}
                                  </button>{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            padding: '16px 0 10px',
                            marginTop: '12px',
                            borderTop: '1px solid var(--color-divider)',
                          }}
                        >
                          {'Price (₱)'}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          {' '}
                          <input
                            type={'number'}
                            inputMode={'numeric'}
                            min={'0'}
                            placeholder={'Min'}
                            value={v.fMin}
                            onChange={v.onMin}
                            className="input"
                            style={{ background: 'var(--color-bg)' }}
                          />{' '}
                          <span style={{ color: 'var(--color-neutral-600)' }}>{'–'}</span>{' '}
                          <input
                            type={'number'}
                            inputMode={'numeric'}
                            min={'0'}
                            placeholder={'Max'}
                            value={v.fMax}
                            onChange={v.onMax}
                            className="input"
                            style={{ background: 'var(--color-bg)' }}
                          />{' '}
                        </div>{' '}
                        {L(v.filterGroups).map((g, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                letterSpacing: '.1em',
                                textTransform: 'uppercase',
                                padding: '16px 0 10px',
                                marginTop: '12px',
                                borderTop: '1px solid var(--color-divider)',
                              }}
                            >
                              {T(g?.title)}
                            </div>{' '}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {' '}
                              {L(g?.opts).map((o, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <button
                                    onClick={o?.onClick}
                                    style={{
                                      padding: '7px 10px',
                                      minHeight: '34px',
                                      font: 'inherit',
                                      fontSize: '13px',
                                      border: `1px solid ${S(o?.bd)}`,
                                      background: o?.bg,
                                      color: o?.fg,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {T(o?.label)}
                                  </button>{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                          </React.Fragment>
                        ))}{' '}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginTop: '20px',
                            paddingTop: '16px',
                            borderTop: '2px solid var(--color-text)',
                          }}
                        >
                          {' '}
                          {v.isMobile ? (
                            <>
                              <button
                                onClick={v.closeFilters}
                                className="btn btn-primary"
                                style={{ justifyContent: 'space-between', padding: '14px 16px', fontSize: '15px' }}
                              >
                                {'Show '}
                                {T(v.resultCount)}
                                {' results '}
                                <span>{'→'}</span>
                              </button>
                            </>
                          ) : null}{' '}
                          <button
                            onClick={v.clearFilters}
                            className="btn btn-secondary"
                            style={{ justifyContent: 'flex-start', padding: '10px 12px' }}
                          >
                            {'Clear all filters'}
                          </button>{' '}
                        </div>{' '}
                      </aside>{' '}
                      <div style={{ minWidth: '0' }}>
                        {' '}
                        {v.hasResults ? (
                          <>
                            {' '}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fill,minmax(${S(v.cardMin)},1fr))`,
                                gap: v.gridGap,
                              }}
                            >
                              {' '}
                              {L(v.results).map((p, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <ProductCard p={p} />{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                        {v.noResults ? (
                          <>
                            {' '}
                            <div
                              style={{
                                border: '2px solid var(--color-text)',
                                padding: '40px clamp(20px,4vw,48px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                alignItems: 'flex-start',
                              }}
                            >
                              {' '}
                              <div style={{ fontWeight: '800', fontSize: '22px', textTransform: 'uppercase' }}>
                                {T(v.noResultsTitle)}
                              </div>{' '}
                              <p style={{ margin: '0', color: 'var(--color-neutral-700)' }}>{T(v.noResultsText)}</p>{' '}
                              {v.hasActiveFilters ? (
                                <>
                                  <button onClick={v.clearFilters} className="btn btn-primary">
                                    {'Clear filters'}
                                  </button>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                      </div>{' '}
                    </div>{' '}
                  </div>
                </>
              ) : null}

              {v.isProduct ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Product'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '20px clamp(16px,4vw,40px) 80px' }}
                  >
                    {' '}
                    {v.pNotFound ? (
                      <>
                        {' '}
                        <div
                          style={{
                            padding: '64px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <h1 style={{ textTransform: 'uppercase', margin: '0' }}>{'Product not found'}</h1>
                          <p style={{ margin: '0', color: 'var(--color-neutral-700)' }}>
                            {'It may have sold or been removed.'}
                          </p>
                          <a href={'#/shop'} className="btn btn-primary">
                            {'Back to shop'}
                          </a>
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.hasP ? (
                      <>
                        {' '}
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-neutral-700)',
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <a href={'#/'} style={{ color: 'inherit' }}>
                            {'Home'}
                          </a>
                          <span>{'/'}</span>
                          <a href={'#/shop'} style={{ color: 'inherit' }}>
                            {'Shop'}
                          </a>
                          <span>{'/'}</span>
                          <a href={v.pd?.catHref} style={{ color: 'inherit' }}>
                            {T(v.pd?.catLabel)}
                          </a>
                          <span>{'/'}</span>
                          <span style={{ color: 'var(--color-text)' }}>{T(v.pd?.name)}</span>
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))',
                            gap: 'clamp(24px,4vw,64px)',
                            marginTop: '16px',
                            alignItems: 'start',
                          }}
                        >
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              position: v.galleryPos,
                              top: '150px',
                            }}
                          >
                            {' '}
                            <div
                              style={{
                                position: 'relative',
                                aspectRatio: '1/1',
                                border: '1px solid var(--color-divider)',
                              }}
                            >
                              {' '}
                              <ProductImage
                                image={v.pd?.mainImage}
                                __hostStyle={{ position: 'absolute', inset: '0' }}
                              />{' '}
                              {v.pd?.hasBadge ? (
                                <>
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: '14px',
                                      left: '14px',
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      fontWeight: '800',
                                      letterSpacing: '.06em',
                                      background: v.pd?.badgeBg,
                                      color: v.pd?.badgeFg,
                                    }}
                                  >
                                    {T(v.pd?.badge)}
                                  </span>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
                              {' '}
                              {L(v.pd?.thumbs).map((t, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <button
                                    onClick={t?.onClick}
                                    aria-label={t?.label}
                                    style={{
                                      position: 'relative',
                                      aspectRatio: '1/1',
                                      padding: '0',
                                      border: `2px solid ${S(t?.bd)}`,
                                      background: 'var(--color-surface)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {' '}
                                    <ProductImage
                                      image={t?.image}
                                      compact={true}
                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                    />{' '}
                                  </button>{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                          </div>{' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: '0' }}>
                            {' '}
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                letterSpacing: '.12em',
                                textTransform: 'uppercase',
                                color: 'var(--color-accent-700)',
                              }}
                            >
                              {T(v.pd?.kicker)}
                            </div>{' '}
                            <h1
                              style={{
                                fontSize: 'clamp(28px,3.2vw,44px)',
                                margin: '-8px 0 0',
                                letterSpacing: '-.02em',
                                textWrap: 'pretty',
                              }}
                            >
                              {T(v.pd?.name)}
                            </h1>{' '}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {' '}
                              {L(v.pd?.chips).map((c, $index) => (
                                <React.Fragment key={$index}>
                                  <span
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      border: '1px solid var(--color-text)',
                                    }}
                                  >
                                    {T(c)}
                                  </span>
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                            <div
                              style={{
                                borderTop: '2px solid var(--color-text)',
                                paddingTop: '16px',
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: '12px',
                                flexWrap: 'wrap',
                              }}
                            >
                              {' '}
                              <span
                                style={{
                                  fontSize: 'clamp(32px,3.4vw,42px)',
                                  fontWeight: '800',
                                  letterSpacing: '-.02em',
                                  color: v.pd?.priceColor,
                                }}
                              >
                                {T(v.pd?.priceText)}
                              </span>{' '}
                              {v.pd?.hasSale ? (
                                <>
                                  <span
                                    style={{
                                      fontSize: '18px',
                                      textDecoration: 'line-through',
                                      color: 'var(--color-neutral-600)',
                                    }}
                                  >
                                    {T(v.pd?.origPriceText)}
                                  </span>
                                  <span
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '12px',
                                      fontWeight: '800',
                                      background: 'var(--color-accent)',
                                      color: 'var(--color-bg)',
                                    }}
                                  >
                                    {T(v.pd?.saveText)}
                                  </span>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                              }}
                            >
                              <span style={{ width: '10px', height: '10px', background: v.pd?.availDot }}></span>
                              {T(v.pd?.availText)}
                              <span style={{ fontWeight: '400', color: 'var(--color-neutral-700)' }}>
                                {T(v.pd?.availNote)}
                              </span>
                            </div>{' '}
                            {v.pd?.canBuy ? (
                              <>
                                {' '}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                                  {' '}
                                  <div
                                    style={{ display: 'flex', border: '2px solid var(--color-text)', height: '52px' }}
                                  >
                                    {' '}
                                    <button
                                      onClick={v.pd?.onDec}
                                      disabled={v.pd?.decDisabled}
                                      aria-label={'Decrease quantity'}
                                      style={{
                                        width: '48px',
                                        border: '0',
                                        background: 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: 'var(--color-text)',
                                        opacity: v.pd?.decOp,
                                      }}
                                    >
                                      <svg
                                        width={'16'}
                                        height={'16'}
                                        viewBox={'0 0 24 24'}
                                        fill={'none'}
                                        stroke={'currentColor'}
                                        strokeWidth={'2.5'}
                                        strokeLinecap={'round'}
                                      >
                                        <path d={'M5 12h14'}></path>
                                      </svg>
                                    </button>{' '}
                                    <div
                                      style={{
                                        width: '44px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '800',
                                        fontSize: '17px',
                                        borderLeft: '1px solid var(--color-divider)',
                                        borderRight: '1px solid var(--color-divider)',
                                      }}
                                    >
                                      {T(v.pd?.qty)}
                                    </div>{' '}
                                    <button
                                      onClick={v.pd?.onInc}
                                      disabled={v.pd?.incDisabled}
                                      aria-label={'Increase quantity'}
                                      style={{
                                        width: '48px',
                                        border: '0',
                                        background: 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: 'var(--color-text)',
                                        opacity: v.pd?.incOp,
                                      }}
                                    >
                                      <svg
                                        width={'16'}
                                        height={'16'}
                                        viewBox={'0 0 24 24'}
                                        fill={'none'}
                                        stroke={'currentColor'}
                                        strokeWidth={'2.5'}
                                        strokeLinecap={'round'}
                                      >
                                        <path d={'M5 12h14M12 5v14'}></path>
                                      </svg>
                                    </button>{' '}
                                  </div>{' '}
                                  <button
                                    onClick={v.pd?.onAdd}
                                    className="btn btn-primary"
                                    style={{
                                      flex: '1',
                                      minWidth: '180px',
                                      height: '52px',
                                      justifyContent: 'space-between',
                                      padding: '0 18px',
                                      fontSize: '15px',
                                      letterSpacing: '.04em',
                                    }}
                                  >
                                    {'ADD TO CART '}
                                    <svg
                                      width={'18'}
                                      height={'18'}
                                      viewBox={'0 0 24 24'}
                                      fill={'none'}
                                      stroke={'currentColor'}
                                      strokeWidth={'2.5'}
                                      strokeLinecap={'round'}
                                    >
                                      <path d={'M5 12h14M12 5v14'}></path>
                                    </svg>
                                  </button>{' '}
                                </div>{' '}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  {' '}
                                  <button
                                    onClick={v.pd?.onBuyNow}
                                    className="btn sqp2"
                                    style={{
                                      flex: '1',
                                      height: '52px',
                                      justifyContent: 'space-between',
                                      padding: '0 18px',
                                      fontSize: '15px',
                                      letterSpacing: '.04em',
                                      background: 'var(--color-text)',
                                      color: 'var(--color-bg)',
                                    }}
                                  >
                                    {'BUY NOW '}
                                    <svg
                                      width={'18'}
                                      height={'18'}
                                      viewBox={'0 0 24 24'}
                                      fill={'none'}
                                      stroke={'currentColor'}
                                      strokeWidth={'2.5'}
                                      strokeLinecap={'round'}
                                      strokeLinejoin={'round'}
                                    >
                                      <path d={'M5 12h14M12 5l7 7-7 7'}></path>
                                    </svg>
                                  </button>{' '}
                                  <button
                                    onClick={v.pd?.onWish}
                                    aria-label={'Toggle wishlist'}
                                    style={{
                                      width: '52px',
                                      height: '52px',
                                      border: '2px solid var(--color-text)',
                                      background: 'transparent',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      color: v.pd?.heartColor,
                                    }}
                                  >
                                    <svg
                                      width={'20'}
                                      height={'20'}
                                      viewBox={'0 0 24 24'}
                                      fill={v.pd?.heartFill}
                                      stroke={'currentColor'}
                                      strokeWidth={'2'}
                                      strokeLinecap={'round'}
                                      strokeLinejoin={'round'}
                                    >
                                      <path
                                        d={
                                          'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                                        }
                                      ></path>
                                    </svg>
                                  </button>{' '}
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            {v.pd?.cantBuy ? (
                              <>
                                {' '}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  {' '}
                                  <div
                                    style={{
                                      flex: '1',
                                      minWidth: '200px',
                                      padding: '14px 16px',
                                      background: 'var(--color-surface)',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                    }}
                                  >
                                    {T(v.pd?.cantBuyText)}
                                  </div>{' '}
                                  <button
                                    onClick={v.pd?.onWish}
                                    className="btn btn-secondary"
                                    style={{ minHeight: '52px', gap: '8px', color: v.pd?.heartColor }}
                                  >
                                    <svg
                                      width={'18'}
                                      height={'18'}
                                      viewBox={'0 0 24 24'}
                                      fill={v.pd?.heartFill}
                                      stroke={'currentColor'}
                                      strokeWidth={'2'}
                                      strokeLinecap={'round'}
                                      strokeLinejoin={'round'}
                                    >
                                      <path
                                        d={
                                          'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                                        }
                                      ></path>
                                    </svg>
                                    {T(v.pd?.wishLabel)}
                                  </button>{' '}
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            <div>
                              {' '}
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  letterSpacing: '.1em',
                                  textTransform: 'uppercase',
                                  padding: '14px 0 8px',
                                  borderTop: '2px solid var(--color-text)',
                                }}
                              >
                                {'Product details'}
                              </div>{' '}
                              {L(v.pd?.details).map((d, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'minmax(110px,38%) 1fr',
                                      gap: '12px',
                                      padding: '9px 0',
                                      borderBottom: '1px solid var(--color-divider)',
                                      fontSize: '14px',
                                    }}
                                  >
                                    <span style={{ color: 'var(--color-neutral-700)' }}>{T(d?.k)}</span>
                                    <span style={{ fontWeight: '600', overflowWrap: 'anywhere' }}>{T(d?.v)}</span>
                                  </div>{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                            <div>
                              {' '}
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  letterSpacing: '.1em',
                                  textTransform: 'uppercase',
                                  padding: '14px 0 8px',
                                  borderTop: '2px solid var(--color-text)',
                                }}
                              >
                                {'Description'}
                              </div>{' '}
                              <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', textWrap: 'pretty' }}>
                                {T(v.pd?.description)}
                              </p>{' '}
                            </div>{' '}
                            <div
                              style={{
                                background: 'var(--color-surface)',
                                padding: '18px 20px',
                                display: 'flex',
                                gap: '14px',
                                alignItems: 'flex-start',
                              }}
                            >
                              {' '}
                              <svg
                                width={'22'}
                                height={'22'}
                                viewBox={'0 0 24 24'}
                                fill={'none'}
                                stroke={'currentColor'}
                                strokeWidth={'2'}
                                strokeLinecap={'round'}
                                strokeLinejoin={'round'}
                                style={{ flex: 'none', color: 'var(--color-accent)', marginTop: '2px' }}
                              >
                                <path d={'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'}></path>
                                <path d={'M15 18H9'}></path>
                                <path
                                  d={'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14'}
                                ></path>
                                <circle cx={'17'} cy={'18'} r={'2'}></circle>
                                <circle cx={'7'} cy={'18'} r={'2'}></circle>
                              </svg>{' '}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                                <strong style={{ fontWeight: '800' }}>{'Shipping throughout the Philippines'}</strong>
                                <span style={{ color: 'var(--color-neutral-800)' }}>{T(v.pd?.shipText)}</span>
                              </div>{' '}
                            </div>{' '}
                          </div>{' '}
                        </div>{' '}
                        {v.hasRelated ? (
                          <>
                            {' '}
                            <div style={{ marginTop: 'clamp(48px,6vw,88px)' }}>
                              {' '}
                              <div
                                style={{
                                  borderBottom: '2px solid var(--color-text)',
                                  paddingBottom: '12px',
                                  marginBottom: '20px',
                                }}
                              >
                                <h2
                                  style={{
                                    fontSize: 'clamp(24px,2.8vw,34px)',
                                    margin: '0',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {'More in '}
                                  {T(v.pd?.catLabel)}
                                </h2>
                              </div>{' '}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: `repeat(auto-fill,minmax(${S(v.cardMin)},1fr))`,
                                  gap: v.gridGap,
                                }}
                              >
                                {' '}
                                {L(v.related).map((p, $index) => (
                                  <React.Fragment key={$index}>
                                    <ProductCard p={p} />
                                  </React.Fragment>
                                ))}{' '}
                              </div>{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                      </>
                    ) : null}{' '}
                  </div>
                </>
              ) : null}

              {v.isCart ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Cart'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px clamp(16px,4vw,40px) 80px' }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '0 0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'Your cart'}
                    </h1>{' '}
                    {v.cartEmpty ? (
                      <>
                        {' '}
                        <div
                          style={{
                            borderTop: '2px solid var(--color-text)',
                            padding: '40px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            alignItems: 'flex-start',
                          }}
                        >
                          {' '}
                          <div style={{ fontWeight: '800', fontSize: '22px', textTransform: 'uppercase' }}>
                            {'Your cart is empty'}
                          </div>{' '}
                          <p style={{ margin: '0', color: 'var(--color-neutral-700)' }}>
                            {'Your next quest starts in the shop.'}
                          </p>{' '}
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{ padding: '14px 18px', minWidth: '200px', justifyContent: 'space-between' }}
                          >
                            {'SHOP NOW '}
                            <span>{'→'}</span>
                          </a>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.cartHas ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: v.splitCols,
                            gap: 'clamp(24px,4vw,56px)',
                            alignItems: 'start',
                          }}
                        >
                          {' '}
                          <div style={{ borderTop: '2px solid var(--color-text)' }}>
                            {' '}
                            {L(v.cartLines).map((l, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: v.lineCols,
                                    gap: '16px',
                                    padding: '18px 0',
                                    borderBottom: '1px solid var(--color-divider)',
                                    alignItems: 'start',
                                  }}
                                >
                                  {' '}
                                  <a
                                    href={l?.href}
                                    style={{
                                      position: 'relative',
                                      display: 'block',
                                      aspectRatio: '1/1',
                                      border: '1px solid var(--color-divider)',
                                    }}
                                  >
                                    <ProductImage
                                      image={l?.image}
                                      compact={true}
                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                    />
                                  </a>{' '}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
                                    {' '}
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        letterSpacing: '.1em',
                                        textTransform: 'uppercase',
                                        color: 'var(--color-accent-700)',
                                        fontWeight: '600',
                                      }}
                                    >
                                      {T(l?.catLabel)}
                                    </div>{' '}
                                    <a
                                      href={l?.href}
                                      style={{
                                        fontWeight: '800',
                                        fontSize: '16px',
                                        lineHeight: '1.25',
                                        color: 'var(--color-text)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      {T(l?.name)}
                                    </a>{' '}
                                    {l?.hasMeta ? (
                                      <>
                                        <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(l?.meta)}
                                        </div>
                                      </>
                                    ) : null}{' '}
                                    <div style={{ fontSize: '13px' }}>
                                      {T(l?.unitText)}
                                      {' each'}
                                    </div>{' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        flexWrap: 'wrap',
                                        marginTop: '4px',
                                      }}
                                    >
                                      {' '}
                                      <div
                                        style={{
                                          display: 'flex',
                                          border: '1px solid var(--color-text)',
                                          height: '40px',
                                        }}
                                      >
                                        {' '}
                                        <button
                                          onClick={l?.onDec}
                                          aria-label={'Decrease'}
                                          style={{
                                            width: '40px',
                                            border: '0',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--color-text)',
                                            opacity: l?.decOp,
                                          }}
                                        >
                                          <svg
                                            width={'14'}
                                            height={'14'}
                                            viewBox={'0 0 24 24'}
                                            fill={'none'}
                                            stroke={'currentColor'}
                                            strokeWidth={'2.5'}
                                            strokeLinecap={'round'}
                                          >
                                            <path d={'M5 12h14'}></path>
                                          </svg>
                                        </button>{' '}
                                        <div
                                          style={{
                                            width: '36px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '800',
                                          }}
                                        >
                                          {T(l?.qty)}
                                        </div>{' '}
                                        <button
                                          onClick={l?.onInc}
                                          aria-label={'Increase'}
                                          disabled={l?.incDisabled}
                                          style={{
                                            width: '40px',
                                            border: '0',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--color-text)',
                                            opacity: l?.incOp,
                                          }}
                                        >
                                          <svg
                                            width={'14'}
                                            height={'14'}
                                            viewBox={'0 0 24 24'}
                                            fill={'none'}
                                            stroke={'currentColor'}
                                            strokeWidth={'2.5'}
                                            strokeLinecap={'round'}
                                          >
                                            <path d={'M5 12h14M12 5v14'}></path>
                                          </svg>
                                        </button>{' '}
                                      </div>{' '}
                                      <button
                                        onClick={l?.onRemove}
                                        className="btn btn-ghost"
                                        style={{ fontSize: '13px', minHeight: '40px' }}
                                      >
                                        {'Remove'}
                                      </button>{' '}
                                    </div>{' '}
                                    {l?.hasNote ? (
                                      <>
                                        <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(l?.note)}
                                        </div>
                                      </>
                                    ) : null}{' '}
                                  </div>{' '}
                                  <div
                                    style={{
                                      fontWeight: '800',
                                      fontSize: '17px',
                                      whiteSpace: 'nowrap',
                                      gridColumn: v.lineTotalCol,
                                      textAlign: v.lineTotalAlign,
                                    }}
                                  >
                                    {T(l?.lineText)}
                                  </div>{' '}
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
                            <a
                              href={'#/shop'}
                              className="btn btn-ghost"
                              style={{ marginTop: '16px', fontSize: '14px' }}
                            >
                              {'← Continue shopping'}
                            </a>{' '}
                          </div>{' '}
                          <div
                            style={{
                              background: 'var(--color-surface)',
                              padding: '24px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: v.summaryPos,
                              top: '150px',
                            }}
                          >
                            {' '}
                            <div
                              style={{
                                fontWeight: '800',
                                fontSize: '18px',
                                textTransform: 'uppercase',
                                borderBottom: '2px solid var(--color-text)',
                                paddingBottom: '10px',
                              }}
                            >
                              {'Order summary'}
                            </div>{' '}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                              <span>
                                {'Subtotal ('}
                                {T(v.cartCount)}
                                {' items)'}
                              </span>
                              <strong>{T(v.subtotalText)}</strong>
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                fontSize: '15px',
                              }}
                            >
                              <span>{'Estimated shipping'}</span>
                              <strong>{T(v.shipText)}</strong>
                            </div>{' '}
                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', marginTop: '-6px' }}>
                              {T(v.shipNote)}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                borderTop: '2px solid var(--color-text)',
                                paddingTop: '12px',
                              }}
                            >
                              <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Total'}</span>
                              <span style={{ fontSize: '26px', fontWeight: '800' }}>{T(v.totalText)}</span>
                            </div>{' '}
                            <a
                              href={'#/checkout'}
                              className="btn btn-primary"
                              style={{
                                justifyContent: 'space-between',
                                padding: '16px 18px',
                                fontSize: '15px',
                                letterSpacing: '.04em',
                              }}
                            >
                              {'PROCEED TO CHECKOUT '}
                              <span>{'→'}</span>
                            </a>{' '}
                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                              {'Items are reserved for you when you place your order.'}
                            </div>{' '}
                          </div>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                  </div>
                </>
              ) : null}

              {v.isCheckout ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Checkout'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px clamp(16px,4vw,40px) 80px' }}
                  >
                    {' '}
                    <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', display: 'flex', gap: '6px' }}>
                      <a href={'#/cart'} style={{ color: 'inherit' }}>
                        {'Cart'}
                      </a>
                      <span>{'/'}</span>
                      <span>{'Checkout'}</span>
                    </div>{' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '8px 0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'Checkout'}
                    </h1>{' '}
                    {v.cartEmpty ? (
                      <>
                        {' '}
                        <div
                          style={{
                            borderTop: '2px solid var(--color-text)',
                            padding: '40px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{ fontWeight: '800', fontSize: '22px', textTransform: 'uppercase' }}>
                            {'Nothing to check out'}
                          </div>
                          <a href={'#/shop'} className="btn btn-primary">
                            {'Go to shop'}
                          </a>
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.cartHas ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: v.splitCols,
                            gap: 'clamp(24px,4vw,56px)',
                            alignItems: 'start',
                          }}
                        >
                          {' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                            {' '}
                            {L(v.coSections).map((s, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <section style={{ borderTop: '2px solid var(--color-text)', paddingTop: '14px' }}>
                                  {' '}
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '10px',
                                      alignItems: 'baseline',
                                      marginBottom: '14px',
                                    }}
                                  >
                                    <span
                                      style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-accent-700)' }}
                                    >
                                      {T(s?.n)}
                                    </span>
                                    <span style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase' }}>
                                      {T(s?.title)}
                                    </span>
                                  </div>{' '}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                                      gap: '14px',
                                    }}
                                  >
                                    {' '}
                                    {L(s?.fields).map((f, $index) => (
                                      <React.Fragment key={$index}>
                                        {' '}
                                        <div className="field" style={{ gridColumn: f?.span }}>
                                          {' '}
                                          <label>{T(f?.label)}</label>{' '}
                                          {f?.isInput ? (
                                            <>
                                              <input
                                                type={f?.type}
                                                inputMode={f?.inputMode}
                                                autoComplete={f?.auto}
                                                placeholder={f?.ph}
                                                value={f?.value}
                                                onChange={f?.onChange}
                                                className="input"
                                                style={{
                                                  minHeight: '46px',
                                                  fontSize: '16px',
                                                  background: 'var(--color-bg)',
                                                }}
                                              />
                                            </>
                                          ) : null}{' '}
                                          {f?.isSelect ? (
                                            <>
                                              <select
                                                value={f?.value}
                                                onChange={f?.onChange}
                                                className="input"
                                                style={{
                                                  minHeight: '46px',
                                                  fontSize: '16px',
                                                  background: 'var(--color-bg)',
                                                }}
                                              >
                                                {L(f?.options).map((o, $index) => (
                                                  <React.Fragment key={$index}>
                                                    <option value={o?.v}>{T(o?.l)}</option>
                                                  </React.Fragment>
                                                ))}
                                              </select>
                                            </>
                                          ) : null}{' '}
                                          {f?.isTextarea ? (
                                            <>
                                              <textarea
                                                placeholder={f?.ph}
                                                value={f?.value}
                                                onChange={f?.onChange}
                                                className="input"
                                                style={{ fontSize: '16px', background: 'var(--color-bg)' }}
                                              ></textarea>
                                            </>
                                          ) : null}{' '}
                                        </div>{' '}
                                      </React.Fragment>
                                    ))}{' '}
                                  </div>{' '}
                                </section>{' '}
                              </React.Fragment>
                            ))}{' '}
                            <section style={{ borderTop: '2px solid var(--color-text)', paddingTop: '14px' }}>
                              {' '}
                              <div
                                style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '14px' }}
                              >
                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-accent-700)' }}>
                                  {'04'}
                                </span>
                                <span style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase' }}>
                                  {'Payment method'}
                                </span>
                              </div>{' '}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {' '}
                                {L(v.payMethods).map((m, $index) => (
                                  <React.Fragment key={$index}>
                                    {' '}
                                    <label
                                      style={{
                                        display: 'flex',
                                        gap: '14px',
                                        alignItems: 'flex-start',
                                        padding: '16px',
                                        border: m?.bd,
                                        background: m?.bg,
                                        cursor: m?.cursor,
                                        opacity: m?.op,
                                      }}
                                    >
                                      {' '}
                                      <input
                                        type={'radio'}
                                        name={'pay'}
                                        checked={m?.on}
                                        disabled={m?.disabled}
                                        onChange={m?.onPick}
                                        style={{
                                          accentColor: 'var(--color-accent)',
                                          width: '18px',
                                          height: '18px',
                                          margin: '2px 0 0',
                                        }}
                                      />{' '}
                                      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <span style={{ fontWeight: '800', fontSize: '15px' }}>{T(m?.label)}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                          {T(m?.desc)}
                                        </span>
                                      </div>{' '}
                                      {m?.hasTag ? (
                                        <>
                                          <span
                                            style={{
                                              padding: '3px 8px',
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              letterSpacing: '.06em',
                                              background: 'var(--color-neutral-200)',
                                              color: 'var(--color-neutral-800)',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {T(m?.tag)}
                                          </span>
                                        </>
                                      ) : null}{' '}
                                    </label>{' '}
                                  </React.Fragment>
                                ))}{' '}
                              </div>{' '}
                              <div
                                style={{
                                  marginTop: '14px',
                                  padding: '16px 18px',
                                  background: 'var(--color-text)',
                                  color: 'var(--color-bg)',
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                }}
                              >
                                {' '}
                                <strong style={{ color: 'var(--sq-gold)', letterSpacing: '.06em' }}>
                                  {'NO PAYMENT IS TAKEN ON THIS PAGE.'}
                                </strong>
                                {
                                  " After you place your order we'll send payment instructions and your confirmed shipping fee. Your order stays "
                                }
                                <strong>{'Payment pending'}</strong>
                                {' until we verify your payment. '}
                              </div>{' '}
                            </section>{' '}
                          </div>{' '}
                          <div
                            style={{
                              background: 'var(--color-surface)',
                              padding: '24px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: v.summaryPos,
                              top: '150px',
                            }}
                          >
                            {' '}
                            <div
                              style={{
                                fontWeight: '800',
                                fontSize: '18px',
                                textTransform: 'uppercase',
                                borderBottom: '2px solid var(--color-text)',
                                paddingBottom: '10px',
                              }}
                            >
                              {'Your order'}
                            </div>{' '}
                            {L(v.cartLines).map((l, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '56px 1fr auto',
                                    gap: '12px',
                                    alignItems: 'center',
                                    fontSize: '13px',
                                  }}
                                >
                                  {' '}
                                  <div
                                    style={{
                                      position: 'relative',
                                      aspectRatio: '1/1',
                                      border: '1px solid var(--color-divider)',
                                    }}
                                  >
                                    <ProductImage
                                      image={l?.image}
                                      compact={true}
                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                    />
                                  </div>{' '}
                                  <div style={{ minWidth: '0' }}>
                                    <div style={{ fontWeight: '600', lineHeight: '1.3' }}>{T(l?.name)}</div>
                                    <div style={{ color: 'var(--color-neutral-700)' }}>
                                      {'Qty '}
                                      {T(l?.qty)}
                                    </div>
                                  </div>{' '}
                                  <strong style={{ whiteSpace: 'nowrap' }}>{T(l?.lineText)}</strong>{' '}
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '15px',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '12px',
                              }}
                            >
                              <span>{'Subtotal'}</span>
                              <strong>{T(v.subtotalText)}</strong>
                            </div>{' '}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                              <span>{'Shipping'}</span>
                              <strong>{T(v.shipText)}</strong>
                            </div>{' '}
                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', marginTop: '-6px' }}>
                              {T(v.shipNote)}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                borderTop: '2px solid var(--color-text)',
                                paddingTop: '12px',
                              }}
                            >
                              <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Total'}</span>
                              <span style={{ fontSize: '26px', fontWeight: '800' }}>{T(v.totalText)}</span>
                            </div>{' '}
                            {v.hasCoErr ? (
                              <>
                                <div
                                  role={'alert'}
                                  style={{
                                    padding: '12px 14px',
                                    background: 'var(--color-accent-100)',
                                    color: 'var(--color-accent-800)',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                  }}
                                >
                                  {T(v.coErr)}
                                </div>
                              </>
                            ) : null}{' '}
                            <button
                              onClick={v.placeOrder}
                              disabled={v.placing}
                              className="btn btn-primary"
                              style={{
                                justifyContent: 'space-between',
                                padding: '17px 18px',
                                fontSize: '15px',
                                letterSpacing: '.04em',
                              }}
                            >
                              {T(v.placeLabel)} <span>{'→'}</span>
                            </button>{' '}
                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                              {'By placing your order, your items are reserved for 24 hours while we wait for payment.'}
                            </div>{' '}
                          </div>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                  </div>
                </>
              ) : null}

              {v.isOrder ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Order confirmation'}
                    style={{
                      maxWidth: '920px',
                      margin: '0 auto',
                      padding: '36px clamp(16px,4vw,40px) 80px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '24px',
                    }}
                  >
                    {' '}
                    {v.oLoading ? (
                      <>
                        <p style={{ margin: '0', fontSize: '16px', color: 'var(--color-neutral-700)' }}>
                          {'Loading your order…'}
                        </p>
                      </>
                    ) : null}{' '}
                    {v.oNotFound ? (
                      <>
                        <h1 style={{ textTransform: 'uppercase' }}>{'Order not found'}</h1>
                        <a href={'#/shop'} className="btn btn-primary">
                          {'Back to shop'}
                        </a>
                      </>
                    ) : null}{' '}
                    {v.hasO ? (
                      <>
                        {' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '12px',
                              fontWeight: '800',
                              letterSpacing: '.14em',
                              color: 'var(--color-accent-700)',
                            }}
                          >
                            <span style={{ display: 'flex', gap: '3px' }}>
                              <span style={{ width: '18px', height: '4px', background: 'var(--sq-gold)' }}></span>
                              <span style={{ width: '18px', height: '4px', background: 'var(--color-accent)' }}></span>
                            </span>
                            {'ORDER RECEIVED'}
                          </div>{' '}
                          <h1
                            style={{
                              fontSize: 'clamp(34px,5vw,60px)',
                              margin: '0',
                              textTransform: 'uppercase',
                              letterSpacing: '-.025em',
                            }}
                          >
                            {'Thanks, '}
                            {T(v.od?.firstName)}
                            {'.'}
                          </h1>{' '}
                          <p style={{ margin: '0', fontSize: '16px', maxWidth: '640px' }}>
                            {"We've received order "}
                            <strong>{T(v.od?.id)}</strong>
                            {" and reserved your items. We'll contact you at "}
                            <strong>{T(v.od?.email)}</strong>
                            {' and '}
                            <strong>{T(v.od?.mobile)}</strong>
                            {'.'}
                          </p>{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                            gap: '1px',
                            background: 'var(--color-divider)',
                            border: '1px solid var(--color-divider)',
                          }}
                        >
                          {' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                letterSpacing: '.1em',
                                color: 'var(--color-neutral-700)',
                                fontWeight: '600',
                              }}
                            >
                              {'ORDER ID'}
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '17px' }}>{T(v.od?.id)}</div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                letterSpacing: '.1em',
                                color: 'var(--color-neutral-700)',
                                fontWeight: '600',
                              }}
                            >
                              {'ORDER STATUS'}
                            </div>
                            <div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: '4px',
                                  padding: '3px 8px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  background: v.od?.statusBg,
                                  color: v.od?.statusFg,
                                }}
                              >
                                {T(v.od?.statusLabel)}
                              </span>
                            </div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                letterSpacing: '.1em',
                                color: 'var(--color-neutral-700)',
                                fontWeight: '600',
                              }}
                            >
                              {'PAYMENT'}
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '15px' }}>
                              {T(v.od?.payLabel)}
                              {' · '}
                              {T(v.od?.payStatus)}
                            </div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                letterSpacing: '.1em',
                                color: 'var(--color-neutral-700)',
                                fontWeight: '600',
                              }}
                            >
                              {'TOTAL'}
                            </div>
                            <div style={{ fontWeight: '800', fontSize: '17px' }}>{T(v.od?.totalText)}</div>
                          </div>{' '}
                        </div>{' '}
                        <div
                          style={{
                            background: 'var(--color-text)',
                            color: 'var(--color-bg)',
                            padding: '22px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {' '}
                          <div style={{ fontWeight: '800', letterSpacing: '.06em', color: 'var(--sq-gold)' }}>
                            {'PAYMENT NOT YET RECEIVED'}
                          </div>{' '}
                          <div style={{ fontSize: '15px', lineHeight: '1.6' }}>{T(v.od?.instructions)}</div>{' '}
                        </div>{' '}
                        <div style={{ borderTop: '2px solid var(--color-text)' }}>
                          {' '}
                          {L(v.od?.items).map((i, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: '16px',
                                  padding: '12px 0',
                                  borderBottom: '1px solid var(--color-divider)',
                                  fontSize: '14px',
                                }}
                              >
                                <span>
                                  <strong>{T(i?.name)}</strong>{' '}
                                  <span style={{ color: 'var(--color-neutral-700)' }}>
                                    {'× '}
                                    {T(i?.quantity)}
                                  </span>
                                </span>
                                <strong style={{ whiteSpace: 'nowrap' }}>{T(i?.lineText)}</strong>
                              </div>{' '}
                            </React.Fragment>
                          ))}{' '}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '10px 0 0',
                              fontSize: '14px',
                            }}
                          >
                            <span>{'Subtotal'}</span>
                            <strong>{T(v.od?.subtotalText)}</strong>
                          </div>{' '}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '6px 0',
                              fontSize: '14px',
                            }}
                          >
                            <span>{'Shipping'}</span>
                            <strong>{T(v.od?.shipText)}</strong>
                          </div>{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
                            gap: '24px',
                          }}
                        >
                          {' '}
                          <div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                letterSpacing: '.1em',
                                marginBottom: '6px',
                              }}
                            >
                              {'SHIP TO'}
                            </div>
                            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{T(v.od?.shipTo)}</div>
                          </div>{' '}
                          {v.od?.hasNotes ? (
                            <>
                              <div>
                                <div
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    letterSpacing: '.1em',
                                    marginBottom: '6px',
                                  }}
                                >
                                  {'NOTES'}
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{T(v.od?.notes)}</div>
                              </div>
                            </>
                          ) : null}{' '}
                        </div>{' '}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{ padding: '14px 18px', minWidth: '220px', justifyContent: 'space-between' }}
                          >
                            {'CONTINUE SHOPPING '}
                            <span>{'→'}</span>
                          </a>
                          <a href={'#/contact'} className="btn btn-secondary" style={{ padding: '14px 18px' }}>
                            {'Questions? Contact us'}
                          </a>
                        </div>{' '}
                      </>
                    ) : null}{' '}
                  </div>
                </>
              ) : null}

              {v.isWishlist ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Wishlist'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px clamp(16px,4vw,40px) 80px' }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '0 0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'Wishlist'}
                    </h1>{' '}
                    <div style={{ borderTop: '2px solid var(--color-text)', paddingTop: '20px' }}>
                      {' '}
                      {v.wishEmpty ? (
                        <>
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '14px',
                              alignItems: 'flex-start',
                              padding: '20px 0',
                            }}
                          >
                            <div style={{ fontWeight: '800', fontSize: '22px', textTransform: 'uppercase' }}>
                              {'Nothing saved yet'}
                            </div>
                            <p style={{ margin: '0', color: 'var(--color-neutral-700)' }}>
                              {'Tap the heart on any product to keep track of it here.'}
                            </p>
                            <a href={'#/shop'} className="btn btn-primary">
                              {'Browse the shop'}
                            </a>
                          </div>{' '}
                        </>
                      ) : null}{' '}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(auto-fill,minmax(${S(v.cardMin)},1fr))`,
                          gap: v.gridGap,
                        }}
                      >
                        {' '}
                        {L(v.wishItems).map((p, $index) => (
                          <React.Fragment key={$index}>
                            <ProductCard p={p} />
                          </React.Fragment>
                        ))}{' '}
                      </div>{' '}
                    </div>{' '}
                  </div>
                </>
              ) : null}

              {v.isAccount ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Account'}
                    style={{
                      maxWidth: '920px',
                      margin: '0 auto',
                      padding: '28px clamp(16px,4vw,40px) 80px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                    }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '0',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'Account'}
                    </h1>{' '}
                    <div
                      style={{
                        border: '2px solid var(--color-text)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {' '}
                      <div style={{ fontWeight: '800', fontSize: '18px', textTransform: 'uppercase' }}>
                        {'Customer accounts are coming soon'}
                      </div>{' '}
                      <p style={{ margin: '0', color: 'var(--color-neutral-800)' }}>
                        {'For now, you can check out as a guest. Orders placed on this device are listed below.'}
                      </p>{' '}
                    </div>{' '}
                    <div style={{ borderTop: '2px solid var(--color-text)' }}>
                      {' '}
                      {L(v.myOrders).map((o, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <a
                            href={o?.href}
                            className="sqp3"
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '12px',
                              flexWrap: 'wrap',
                              padding: '14px 0',
                              borderBottom: '1px solid var(--color-divider)',
                              color: 'var(--color-text)',
                              textDecoration: 'none',
                              fontSize: '14px',
                            }}
                          >
                            <strong>{T(o?.id)}</strong>
                            <span style={{ color: 'var(--color-neutral-700)' }}>{T(o?.date)}</span>
                            <span
                              style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: '800',
                                background: o?.bg,
                                color: o?.fg,
                              }}
                            >
                              {T(o?.status)}
                            </span>
                            <strong>{T(o?.total)}</strong>
                          </a>{' '}
                        </React.Fragment>
                      ))}{' '}
                      {v.noMyOrders ? (
                        <>
                          <p style={{ padding: '14px 0', margin: '0', color: 'var(--color-neutral-700)' }}>
                            {'No orders yet.'}
                          </p>
                        </>
                      ) : null}{' '}
                    </div>{' '}
                  </div>
                </>
              ) : null}

              {v.isAbout ? (
                <>
                  {' '}
                  <div data-screen-label={'About'}>
                    {' '}
                    <section
                      style={{
                        position: 'relative',
                        background: 'var(--color-text)',
                        minHeight: 'clamp(280px,38vw,520px)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        overflow: 'hidden',
                      }}
                    >
                      {' '}
                      <img
                        src={'/assets/store-mockup.png'}
                        alt={'SIDE QUEST store interior'}
                        style={{
                          position: 'absolute',
                          inset: '0',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: '.55',
                        }}
                      />{' '}
                      <div
                        style={{
                          position: 'relative',
                          maxWidth: '1320px',
                          width: '100%',
                          margin: '0 auto',
                          padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,40px)',
                          color: 'var(--color-bg)',
                        }}
                      >
                        {' '}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            letterSpacing: '.16em',
                            color: 'var(--sq-gold)',
                            marginBottom: '10px',
                          }}
                        >
                          {'ABOUT SIDE QUEST'}
                        </div>{' '}
                        <h1
                          style={{
                            fontSize: 'clamp(40px,6vw,84px)',
                            lineHeight: '.95',
                            margin: '0',
                            textTransform: 'uppercase',
                            letterSpacing: '-.03em',
                            color: 'var(--color-bg)',
                          }}
                        >
                          {'Good finds.'}
                          <br />
                          {'Better people.'}
                        </h1>{' '}
                      </div>{' '}
                    </section>{' '}
                    <section
                      style={{
                        maxWidth: '1320px',
                        margin: '0 auto',
                        padding: 'clamp(40px,6vw,80px) clamp(16px,4vw,40px)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
                        gap: 'clamp(24px,5vw,72px)',
                      }}
                    >
                      {' '}
                      <p
                        style={{
                          margin: '0',
                          fontSize: 'clamp(20px,2.2vw,28px)',
                          fontWeight: '600',
                          lineHeight: '1.35',
                          textWrap: 'pretty',
                        }}
                      >
                        {
                          'SIDE QUEST is a hobby and collectibles shop for Pokémon TCG players and collectors in the Philippines, with room for every other hobby worth chasing.'
                        }
                      </p>{' '}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          fontSize: '16px',
                          lineHeight: '1.65',
                        }}
                      >
                        {' '}
                        <p style={{ margin: '0' }}>
                          {
                            'We carry singles, graded slabs, sealed product, accessories, plush and collectibles. Every card listing is a real item in our inventory. The card in the photos is the card you get.'
                          }
                        </p>{' '}
                        <p style={{ margin: '0' }}>
                          {"Collect, trade, or just talk hobbies with us. That's the side quest."}
                        </p>{' '}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{ padding: '14px 18px', minWidth: '200px', justifyContent: 'space-between' }}
                          >
                            {'SHOP NOW '}
                            <span>{'→'}</span>
                          </a>
                          <a href={'#/contact'} className="btn btn-secondary" style={{ padding: '14px 18px' }}>
                            {'Buy • Sell • Trade'}
                          </a>
                        </div>{' '}
                      </div>{' '}
                    </section>{' '}
                  </div>
                </>
              ) : null}

              {v.isContact ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Contact'}
                    style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px clamp(16px,4vw,40px) 80px' }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(32px,4.4vw,56px)',
                        margin: '0 0 16px',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'Contact'}
                    </h1>{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))',
                        gap: 'clamp(24px,5vw,72px)',
                        borderTop: '2px solid var(--color-text)',
                        paddingTop: '24px',
                        alignItems: 'start',
                      }}
                    >
                      {' '}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Order questions'}</div>
                          <div style={{ color: 'var(--color-neutral-800)' }}>
                            {"Include your order ID (e.g. SQ-ORD-1001) and we'll get back to you."}
                          </div>
                        </div>{' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Buy • Sell • Trade'}</div>
                          <div style={{ color: 'var(--color-neutral-800)' }}>
                            {
                              "Selling a collection or looking for a specific card? Tell us what you have or what you're hunting for."
                            }
                          </div>
                        </div>{' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Product inquiries'}</div>
                          <div style={{ color: 'var(--color-neutral-800)' }}>
                            {'Ask for extra photos, condition details or grading info on any listing.'}
                          </div>
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: 'clamp(20px,3vw,32px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                        }}
                      >
                        {' '}
                        {v.ctSent ? (
                          <>
                            {' '}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                alignItems: 'flex-start',
                              }}
                            >
                              <div style={{ fontWeight: '800', fontSize: '20px', textTransform: 'uppercase' }}>
                                {'Message saved'}
                              </div>
                              <p style={{ margin: '0' }}>
                                {'Thanks! Your message was sent to the SIDE QUEST inbox. We’ll reply by email.'}
                              </p>
                              <button onClick={v.ctReset} className="btn btn-secondary">
                                {'Send another'}
                              </button>
                            </div>{' '}
                          </>
                        ) : null}{' '}
                        {v.ctForm ? (
                          <>
                            {' '}
                            {L(v.ctFields).map((f, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <div className="field">
                                  {' '}
                                  <label>{T(f?.label)}</label>{' '}
                                  {f?.isInput ? (
                                    <>
                                      <input
                                        type={f?.type}
                                        value={f?.value}
                                        onChange={f?.onChange}
                                        className="input"
                                        style={{ minHeight: '46px', fontSize: '16px', background: 'var(--color-bg)' }}
                                      />
                                    </>
                                  ) : null}{' '}
                                  {f?.isSelect ? (
                                    <>
                                      <select
                                        value={f?.value}
                                        onChange={f?.onChange}
                                        className="input"
                                        style={{ minHeight: '46px', fontSize: '16px', background: 'var(--color-bg)' }}
                                      >
                                        {L(f?.options).map((o, $index) => (
                                          <React.Fragment key={$index}>
                                            <option value={o?.v}>{T(o?.l)}</option>
                                          </React.Fragment>
                                        ))}
                                      </select>
                                    </>
                                  ) : null}{' '}
                                  {f?.isTextarea ? (
                                    <>
                                      <textarea
                                        value={f?.value}
                                        onChange={f?.onChange}
                                        className="input"
                                        style={{ fontSize: '16px', minHeight: '140px', background: 'var(--color-bg)' }}
                                      ></textarea>
                                    </>
                                  ) : null}{' '}
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
                            {v.hasCtErr ? (
                              <>
                                <div
                                  role={'alert'}
                                  style={{
                                    padding: '10px 12px',
                                    background: 'var(--color-accent-100)',
                                    color: 'var(--color-accent-800)',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                  }}
                                >
                                  {T(v.ctErr)}
                                </div>
                              </>
                            ) : null}{' '}
                            <button
                              onClick={v.ctSubmit}
                              className="btn btn-primary"
                              style={{ justifyContent: 'space-between', padding: '15px 18px', fontSize: '15px' }}
                            >
                              {'SEND MESSAGE '}
                              <span>{'→'}</span>
                            </button>{' '}
                          </>
                        ) : null}{' '}
                      </div>{' '}
                    </div>{' '}
                  </div>
                </>
              ) : null}

              {v.isNotFound ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Not found'}
                    style={{
                      maxWidth: '1320px',
                      margin: '0 auto',
                      padding: '64px clamp(16px,4vw,40px) 96px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        letterSpacing: '.14em',
                        color: 'var(--color-accent-700)',
                      }}
                    >
                      {'404'}
                    </div>{' '}
                    <h1
                      style={{
                        fontSize: 'clamp(34px,5vw,64px)',
                        margin: '0',
                        textTransform: 'uppercase',
                        letterSpacing: '-.025em',
                      }}
                    >
                      {'This quest doesn’t exist'}
                    </h1>{' '}
                    <p style={{ margin: '0', fontSize: '16px', color: 'var(--color-neutral-800)' }}>
                      {'The page may have moved, or the link is incomplete.'}
                    </p>{' '}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <a
                        href={'#/shop'}
                        className="btn btn-primary"
                        style={{ padding: '14px 18px', minWidth: '200px', justifyContent: 'space-between' }}
                      >
                        {'SHOP ALL '}
                        <span>{'→'}</span>
                      </a>
                      <a href={'#/'} className="btn btn-secondary" style={{ padding: '14px 18px' }}>
                        {'Home'}
                      </a>
                    </div>{' '}
                  </div>
                </>
              ) : null}
            </main>

            <footer style={{ borderTop: '2px solid var(--color-text)', paddingBottom: v.mainPadB }}>
              {' '}
              <div
                style={{
                  maxWidth: '1320px',
                  margin: '0 auto',
                  padding: '48px clamp(16px,4vw,40px) 32px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
                  gap: '32px',
                }}
              >
                {' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                  <img
                    src={'/assets/sidequest-logo.png'}
                    alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                    style={{ width: '180px', height: 'auto' }}
                  />
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '.1em', marginBottom: '4px' }}>
                    {'SHOP'}
                  </div>{' '}
                  {L(v.footShop).map((n, $index) => (
                    <React.Fragment key={$index}>
                      <a href={n?.href} className="sqp1" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                        {T(n?.label)}
                      </a>
                    </React.Fragment>
                  ))}{' '}
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '.1em', marginBottom: '4px' }}>
                    {'SIDE QUEST'}
                  </div>{' '}
                  <a href={'#/about'} className="sqp1" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                    {'About'}
                  </a>{' '}
                  <a href={'#/contact'} className="sqp1" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                    {'Contact'}
                  </a>{' '}
                  <a
                    href={'#/wishlist'}
                    className="sqp1"
                    style={{ color: 'var(--color-text)', textDecoration: 'none' }}
                  >
                    {'Wishlist'}
                  </a>{' '}
                  <a href={'#/cart'} className="sqp1" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                    {'Cart'}
                  </a>{' '}
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '.1em', marginBottom: '4px' }}>
                    {'PAYMENTS'}
                  </div>{' '}
                  <span>{'GCash · Bank transfer'}</span>{' '}
                  <span style={{ color: 'var(--color-neutral-700)' }}>{'Online payments coming soon'}</span>{' '}
                  <span style={{ color: 'var(--color-neutral-700)' }}>{'All prices in Philippine Peso (₱)'}</span>{' '}
                </div>{' '}
              </div>{' '}
              <div style={{ borderTop: '1px solid var(--color-divider)' }}>
                {' '}
                <div
                  style={{
                    maxWidth: '1320px',
                    margin: '0 auto',
                    padding: '14px clamp(16px,4vw,40px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    fontSize: '12px',
                    color: 'var(--color-neutral-700)',
                  }}
                >
                  <span>{'© 2026 SIDE QUEST. Collect • Trade • Hobbies.'}</span>
                  <a href={'#/admin'} style={{ color: 'inherit' }}>
                    {'Store admin'}
                  </a>
                </div>{' '}
              </div>
            </footer>

            {v.isMobile ? (
              <>
                {' '}
                <nav
                  style={{
                    position: 'fixed',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    zIndex: '40',
                    background: 'var(--color-bg)',
                    borderTop: '2px solid var(--color-text)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5,1fr)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                  }}
                >
                  {' '}
                  <a
                    href={'#/'}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '.06em',
                      color: v.bn?.home,
                    }}
                  >
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'2'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'}></path>
                      <path d={'M9 22V12h6v10'}></path>
                    </svg>
                    {'HOME'}
                  </a>{' '}
                  <a
                    href={'#/shop'}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '.06em',
                      color: v.bn?.shop,
                    }}
                  >
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'2'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7'}></path>
                      <path d={'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'}></path>
                      <path d={'M2 7h20'}></path>
                    </svg>
                    {'SHOP'}
                  </a>{' '}
                  <button
                    onClick={v.openMenu}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '58px',
                      border: '0',
                      background: 'transparent',
                      font: 'inherit',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '.06em',
                      color: v.bn?.cats,
                    }}
                  >
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'2'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <rect x={'3'} y={'3'} width={'7'} height={'7'}></rect>
                      <rect x={'14'} y={'3'} width={'7'} height={'7'}></rect>
                      <rect x={'14'} y={'14'} width={'7'} height={'7'}></rect>
                      <rect x={'3'} y={'14'} width={'7'} height={'7'}></rect>
                    </svg>
                    {'CATEGORIES'}
                  </button>{' '}
                  <a
                    href={'#/wishlist'}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '.06em',
                      color: v.bn?.wish,
                    }}
                  >
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'2'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path
                        d={
                          'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                        }
                      ></path>
                    </svg>
                    {'WISHLIST'}
                  </a>{' '}
                  <a
                    href={'#/account'}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '.06em',
                      color: v.bn?.acct,
                    }}
                  >
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'2'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}></path>
                      <circle cx={'12'} cy={'7'} r={'4'}></circle>
                    </svg>
                    {'ACCOUNT'}
                  </a>{' '}
                </nav>
              </>
            ) : null}

            {v.menuOpen ? (
              <>
                {' '}
                <div
                  onClick={v.closeMenu}
                  style={{
                    position: 'fixed',
                    inset: '0',
                    zIndex: '90',
                    background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
                  }}
                >
                  {' '}
                  <div
                    onClick={v.stop}
                    style={{
                      width: 'min(360px,88%)',
                      height: '100%',
                      overflowY: 'auto',
                      background: 'var(--color-bg)',
                      borderRight: '2px solid var(--color-text)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px 10px 16px',
                        borderBottom: '2px solid var(--color-text)',
                      }}
                    >
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST'}
                        style={{ height: '46px', width: 'auto' }}
                      />
                      <button
                        onClick={v.closeMenu}
                        aria-label={'Close menu'}
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '0',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-text)',
                        }}
                      >
                        <svg
                          width={'22'}
                          height={'22'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2.2'}
                          strokeLinecap={'round'}
                        >
                          <path d={'M18 6 6 18M6 6l12 12'}></path>
                        </svg>
                      </button>
                    </div>{' '}
                    {L(v.navItems).map((n, $index) => (
                      <React.Fragment key={$index}>
                        {' '}
                        <a
                          href={n?.href}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: '54px',
                            padding: '0 20px',
                            borderBottom: '1px solid var(--color-divider)',
                            fontWeight: '800',
                            fontSize: '15px',
                            letterSpacing: '.06em',
                            textDecoration: 'none',
                            color: n?.menuColor,
                          }}
                        >
                          {T(n?.label)}
                          <span>{'→'}</span>
                        </a>{' '}
                      </React.Fragment>
                    ))}{' '}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '12px 20px',
                        gap: '2px',
                        fontSize: '15px',
                      }}
                    >
                      {' '}
                      <a
                        href={'#/about'}
                        style={{ padding: '10px 0', color: 'var(--color-text)', textDecoration: 'none' }}
                      >
                        {'About'}
                      </a>{' '}
                      <a
                        href={'#/contact'}
                        style={{ padding: '10px 0', color: 'var(--color-text)', textDecoration: 'none' }}
                      >
                        {'Contact'}
                      </a>{' '}
                      <a
                        href={'#/account'}
                        style={{ padding: '10px 0', color: 'var(--color-text)', textDecoration: 'none' }}
                      >
                        {'Account'}
                      </a>{' '}
                    </div>{' '}
                  </div>{' '}
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {v.isAdmin ? (
          <>
            {' '}
            <Admin tab={v.adminTab} onToast={v.toastFn} />
          </>
        ) : null}

        {v.hasToast ? (
          <>
            {' '}
            <div
              role={'status'}
              style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: v.toastBottom,
                zIndex: '100',
                background: 'var(--color-text)',
                color: 'var(--color-bg)',
                padding: '12px 14px 12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-lg)',
                fontSize: '14px',
                fontWeight: '600',
                maxWidth: 'calc(100vw - 24px)',
              }}
            >
              {' '}
              <span>{T(v.toast)}</span>{' '}
              {v.toastCart ? (
                <>
                  <a
                    href={'#/cart'}
                    style={{ color: 'var(--sq-gold)', fontWeight: '800', whiteSpace: 'nowrap', textDecoration: 'none' }}
                  >
                    {'VIEW CART →'}
                  </a>
                </>
              ) : null}{' '}
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
