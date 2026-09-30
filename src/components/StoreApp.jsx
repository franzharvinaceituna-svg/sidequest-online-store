// SIDE QUEST — StoreApp
// Ported from SIDE QUEST Store v5.dc.html (approved V5 design) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import Admin from './AdminV2-approved.jsx';
import ProductCardV3 from './ProductCardV3.jsx';
import ProductImageV3 from './ProductImageV3.jsx';

export default class StoreApp extends React.Component {
  emptyF() {
    return {
      cat: '',
      group: '',
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
      patch.f = {
        ...this.emptyF(),
        sort: r.params.sort || this.state.f.sort,
        cat: r.params.cat || '',
        group: r.params.group || '',
        sale: r.params.sale === '1',
      };
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
  isChase(p) {
    return (
      (p.tags || []).some((t) => String(t).toLowerCase() === 'chase') ||
      (p.product_type === 'SINGLE' && (!!p.featured || window.SQStore.effectivePrice(p) >= 5000))
    );
  }
  vm(p) {
    const S = window.SQStore,
      av = p.available_quantity,
      onSale = S.isOnSale(p),
      wished = S.isWished(p.product_id);
    const a = SQView.availOf(av),
      b = SQView.badgeOf(p),
      meta = SQView.metaOf(p);
    const badges = [];
    if (av <= 0) badges.push({ t: 'SOLD OUT', bg: 'var(--color-neutral-700)', fg: 'var(--color-bg)' });
    else {
      if (onSale)
        badges.push({
          t: 'SALE −' + Math.round((1 - p.sale_price / p.price) * 100) + '%',
          bg: 'var(--color-accent)',
          fg: 'var(--color-bg)',
        });
      if (this.isChase(p)) badges.push({ t: 'CHASE', bg: 'var(--sq-gold)', fg: 'var(--color-text)' });
      if (Date.now() - new Date(p.created_at).getTime() < 14 * 864e5)
        badges.push({ t: 'NEW', bg: 'var(--color-text)', fg: 'var(--color-bg)' });
    }
    const metaTags = [];
    if (p.product_type === 'GRADED_CARD' && p.grading_company)
      metaTags.push({
        l: p.grading_company + ' ' + p.grade,
        bg: 'color-mix(in srgb, var(--sq-gold) 35%, transparent)',
      });
    if (p.product_type === 'SINGLE' && p.condition) metaTags.push({ l: p.condition, bg: 'transparent' });
    if (['SINGLE', 'GRADED_CARD', 'SEALED'].includes(p.product_type) && p.language)
      metaTags.push({ l: p.language, bg: 'transparent' });
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
      badges: badges.slice(0, 2),
      metaTags,
      isNew: Date.now() - new Date(p.created_at).getTime() < 14 * 864e5,
      saleText: onSale ? 'Sale −' + Math.round((1 - p.sale_price / p.price) * 100) + '%' : '',
      subline:
        p.product_type === 'SINGLE' || p.product_type === 'GRADED_CARD'
          ? [p.set, p.card_number ? '#' + p.card_number : ''].filter(Boolean).join(' · ')
          : [SQView.TYPES[p.product_type], p.subcategory]
              .filter(Boolean)
              .filter((x, i, a) => a.indexOf(x) === i)
              .join(' · '),
      details:
        p.product_type === 'GRADED_CARD'
          ? [p.grading_company && p.grade != null ? p.grading_company + ' ' + p.grade : '', p.language]
              .filter(Boolean)
              .join(' · ')
          : p.product_type === 'SINGLE'
            ? [p.condition, p.language].filter(Boolean).join(' · ')
            : p.product_type === 'SEALED'
              ? p.language || ''
              : '',
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
      mobile = st.w < 768;
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
    const HOBBY_CATS = ['accessories', 'collectibles', 'other'];
    const navActive = (k) =>
      pg === 'shop' &&
      ((k === 'all' && !st.f.cat && !st.f.group && !st.f.sale) ||
        (k === 'hobbies' && (st.f.group === 'hobbies' || HOBBY_CATS.includes(st.f.cat))) ||
        (k === st.f.cat && !st.f.sale));
    const navItems = [
      { k: 'all', label: 'Shop', href: '#/shop' },
      { k: 'pokemon', label: 'Pokémon', href: '#/shop?cat=pokemon' },
      { k: 'psa', label: 'Graded', href: '#/shop?cat=psa' },
      { k: 'sealed', label: 'Sealed', href: '#/shop?cat=sealed' },
      { k: 'hobbies', label: 'Hobbies', href: '#/shop?group=hobbies' },
    ].map((n) => ({
      ...n,
      color: navActive(n.k) ? 'var(--color-accent)' : 'var(--color-text)',
      menuColor: 'var(--color-text)',
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
      navGap: st.w < 1100 ? '20px' : '28px',
      wideHeader: st.w >= 1100,
      tabletSearch: !mobile && st.w < 1100,
      stripJustify: mobile ? 'center' : 'space-between',
      pagePad: mobile ? '20px 16px 48px' : '32px clamp(16px,3vw,32px) 80px',
      pagePad404: mobile ? '40px 16px 64px' : '64px clamp(16px,3vw,32px) 96px',
      denseCards: st.w < 560,
      contactCols: st.w >= 900 ? 'minmax(0,1fr) minmax(0,1.1fr)' : 'minmax(0,1fr)',
      prodCols: st.w >= 960 ? 'minmax(0,1.05fr) minmax(0,1fr)' : 'minmax(0,1fr)',
      focusSearch: () => {
        if ((this.state.route || {}).page !== 'shop') location.hash = '#/shop';
        setTimeout(() => {
          window.scrollTo(0, 0);
          const el = document.getElementById('sq-search-m');
          if (el) el.focus();
        }, 80);
      },
      navFont: st.w < 1180 ? '12px' : '13px',
      mainPadB: mobile ? '64px' : '0px',
      cardMin: mobile ? 'min(100%, 158px)' : '232px',
      gridGap: mobile ? '10px' : '18px',
      homeCardMin: mobile ? 'min(100%, 158px)' : '260px',
      heroCols: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.1fr)',
      brandCols: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.3fr)',
      serviceCols: st.w >= 700 ? 'repeat(3,minmax(0,1fr))' : 'minmax(0,1fr)',
      heroTileGap: mobile ? '8px' : '14px',
      heroArtMax: mobile ? '480px' : 'none',
      heroTileFont: mobile ? '12px' : '14px',
      ctaMin: mobile ? '0' : '180px',
      secPad: mobile ? '32px 16px' : 'clamp(40px,4.5vw,64px) clamp(16px,3vw,32px)',
      gridCols:
        st.w >= 1100 ? 'repeat(4,minmax(0,1fr))' : st.w >= 700 ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))',
      shopGridCols:
        st.w >= 1280 ? 'repeat(4,minmax(0,1fr))' : st.w >= 640 ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))',
      gridGapV: mobile ? '24px' : '36px',
      wishHas: wishCount > 0,
      cartHas: cartCount > 0,
      heroGap: mobile ? '36px' : 'clamp(32px,5vw,72px)',
      heroPad: mobile ? '28px 16px 36px' : 'clamp(40px,5vw,72px) clamp(16px,3vw,32px)',
      heroFont: mobile ? '34px' : 'clamp(38px,3.6vw,52px)',
      heroArtH: mobile ? '340px' : 'clamp(420px,40vw,560px)',
      ctaFlex: mobile ? '1 1 100%' : '0 0 auto',
      emptyArtMax: mobile ? '380px' : 'none',
      ctaJustify: mobile ? 'flex-start' : 'flex-end',
      angle: mobile ? '20px' : '36px',
      catGap: mobile ? '14px 10px' : '20px',
      catArrowDisplay: mobile ? 'none' : 'flex',
      catAspect: mobile ? '1/1' : '4/3',
      catPad: mobile ? '10px 10px 12px' : '14px 16px 16px',
      catNameSize: mobile ? '13px' : '15px',
      catNumSize: mobile ? '30px' : 'clamp(40px,4.4vw,64px)',
      railFlow: mobile ? 'column' : 'row',
      railAuto: mobile ? 'minmax(200px,66%)' : 'auto',
      railCols: mobile ? 'none' : 'repeat(4,minmax(0,1fr))',
      railOverflow: mobile ? 'auto' : 'visible',
      railSnap: mobile ? 'x mandatory' : 'none',
      railBleed: mobile ? '-16px' : '0',
      railPadR: mobile ? '16px' : '0',
      catCols: st.w >= 1000 ? 'repeat(6,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))',
      trustCols: st.w >= 1000 ? 'repeat(4,minmax(0,1fr))' : st.w >= 560 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
      lineTotalCol: mobile ? '2' : 'auto',
      lineTotalAlign: mobile ? 'left' : 'right',
      splitCols: st.w >= 960 ? 'minmax(0,1fr) minmax(320px,380px)' : 'minmax(0,1fr)',
      summaryPos: st.w >= 960 ? 'sticky' : 'static',
      menuOpen: st.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      stop: (e) => e.stopPropagation(),
      bn: {
        home: pg === 'home' ? red : ink,
        shop: pg === 'shop' || pg === 'product' ? red : ink,
        search: ink,
        wish: pg === 'wishlist' ? red : ink,
        acct: pg === 'account' ? red : ink,
      },
      bnBar: {
        home: pg === 'home' ? red : 'transparent',
        shop: pg === 'shop' || pg === 'product' ? red : 'transparent',
        search: 'transparent',
        wish: pg === 'wishlist' ? red : 'transparent',
        acct: pg === 'account' ? red : 'transparent',
      },
      footShop: navItems.slice(1, 7),
      hasToast: !!st.toast,
      toast: st.toast,
      toastCart: st.toastCart,
      toastBottom: mobile ? '76px' : '24px',
    };
    const all = S.products();

    if (pg === 'home') {
      const withPhoto = (p) =>
        !!(p.gallery && p.gallery[0] && p.gallery[0].url) || !!(p.images && p.images[0] && p.images[0].url);
      const inStock = all.filter((p) => p.available_quantity > 0);
      const byNew = inStock.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const per = mobile ? 4 : 8,
        per4 = mobile ? 4 : 4;
      const chase = inStock
        .filter((p) => this.isChase(p) || (p.product_type === 'GRADED_CARD' && p.featured))
        .sort((a, b) => S.effectivePrice(b) - S.effectivePrice(a));
      const ART = {
        pokemon: 'singles',
        psa: 'slab',
        sealed: 'sealed',
        accessories: 'accessories',
        collectibles: 'collectibles',
        other: 'hobby',
      };
      const photoPick = (ps) => ps.find((p) => p.featured && withPhoto(p)) || ps.find(withPhoto);
      const heroSrc = [
        ['psa', 'Graded', 'slab', 'ink'],
        ['pokemon', 'Singles', 'singles', 'red'],
        ['sealed', 'Sealed', 'sealed', 'gold'],
      ];
      Object.assign(v, {
        heroTiles: heroSrc.map(([cat, label, kind, tone], i) => {
          const rep = photoPick(inStock.filter((p) => p.category === cat));
          return {
            href: '#/shop?cat=' + cat,
            label,
            kind,
            tone,
            hasPhoto: !!rep,
            noPhoto: !rep,
            image: rep ? SQView.imgVM(rep) : null,
            offset: i === 1 ? '-28px' : '0',
          };
        }),
        hasNew: byNew.length > 0,
        newItems: byNew.slice(0, per).map((p) => this.vm(p)),
        homeCats: cats.map((c) => {
          const ps = inStock.filter((p) => p.category === c.category_id),
            rep = photoPick(ps);
          return {
            name:
              {
                pokemon: 'Pokémon',
                psa: 'PSA / Graded Cards',
                sealed: 'Sealed Products',
                accessories: 'Accessories',
                collectibles: 'Collectibles & Plush',
                other: 'Other Hobbies',
              }[c.category_id] ||
              c.label ||
              c.name,
            href: '#/shop?cat=' + c.category_id,
            hasCount: ps.length > 0,
            countText: String(ps.length),
            hasPhoto: !!rep,
            noPhoto: !rep,
            image: rep ? SQView.imgVM(rep) : null,
            kind: ART[c.category_id] || 'hobby',
          };
        }),
        hasChase: chase.length >= 2,
        chaseItems: chase.slice(0, per4).map((p) => this.vm(p)),
        hasSealed: inStock.some((p) => p.category === 'sealed'),
        sealedItems: inStock
          .filter((p) => p.category === 'sealed')
          .slice(0, per4)
          .map((p) => this.vm(p)),
        hasGraded: inStock.some((p) => p.product_type === 'GRADED_CARD'),
        gradedItems: inStock
          .filter((p) => p.product_type === 'GRADED_CARD')
          .slice(0, per4)
          .map((p) => this.vm(p)),
        hasHobby: inStock.some((p) => HOBBY_CATS.includes(p.category)),
        hobbyItems: inStock
          .filter((p) => HOBBY_CATS.includes(p.category))
          .slice(0, per4)
          .map((p) => this.vm(p)),
        services: [
          [
            'Nationwide shipping',
            'We ship orders throughout the Philippines.',
            '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle>',
          ],
          [
            'Packed with care',
            'Cards are sleeved and packed for protection.',
            '<path d="M16.5 9.4 7.55 4.24"></path><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.29 7 12 12l8.71-5"></path><path d="M12 22V12"></path>',
          ],
          [
            'Buy, sell and trade',
            'Looking for a card or want to trade? Get in touch.',
            '<path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path>',
          ],
        ].map(([title, text, path]) => ({
          title,
          text,
          icon: React.createElement('svg', {
            width: 22,
            height: 22,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            dangerouslySetInnerHTML: { __html: path },
          }),
        })),
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
      let list = f.cat
        ? base.filter((p) => p.category === f.cat)
        : f.group === 'hobbies'
          ? base.filter((p) => HOBBY_CATS.includes(p.category))
          : base;
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
        [f.cat, f.group, f.sub, f.min, f.max].filter(Boolean).length +
        f.cond.length +
        f.lang.length +
        f.grade.length +
        (f.inStock ? 1 : 0) +
        (f.sale ? 1 : 0);
      const catObj = S.category(f.cat);
      const CAT_NAME = {
        pokemon: 'Pokémon',
        psa: 'PSA / Graded Cards',
        sealed: 'Sealed Products',
        accessories: 'Accessories',
        collectibles: 'Collectibles & Plush',
        other: 'Other Hobbies',
      };
      const storeEmpty = all.length === 0;
      const catEmpty =
        !storeEmpty &&
        (f.cat
          ? !all.some((p) => p.category === f.cat)
          : f.group === 'hobbies'
            ? !all.some((p) => HOBBY_CATS.includes(p.category))
            : false);
      const refine = activeCount - (f.cat ? 1 : 0) - (f.group ? 1 : 0);
      const scoped = !!(f.cat || f.group);
      if (storeEmpty || catEmpty) {
        v.noResultsTitle = 'Nothing here yet';
        v.noResultsText = 'We’re getting the next quests ready.';
      } else if (q && !refine) {
        v.noResultsTitle = 'No results for “' + st.q.trim() + '”';
        v.noResultsText = 'Try a set name, Pokémon or card number.';
      } else {
        v.noResultsTitle = 'No products match your filters.';
        v.noResultsText = '';
      }
      v.hasNoResultsText = !!v.noResultsText;
      v.hasActiveFilters = refine > 0 && !storeEmpty && !catEmpty;
      v.showEmptyLink = scoped || !!q || storeEmpty;
      v.emptyLinkHref = scoped || q ? '#/shop' : '#/';
      v.emptyLinkText = scoped || q ? 'Browse all products →' : 'Back to home →';
      v.shopKicker = q ? 'SEARCH' : 'SHOP';
      v.shopIntro = q
        ? ''
        : f.cat
          ? (catObj && catObj.description) || ''
          : f.group === 'hobbies'
            ? 'Accessories, collectibles, plush and other hobby finds.'
            : 'Cards, sealed products, collectibles and hobby finds.';
      v.hasShopIntro = !!v.shopIntro;
      v.catTabs = ['', ...cats.map((c) => c.category_id)].map((id) => {
        const on = id ? f.cat === id : !f.cat && !f.group;
        return {
          label: id ? CAT_NAME[id] || (S.category(id) || {}).label || id : 'All',
          count: id ? base.filter((p) => p.category === id).length : base.length,
          on,
          fg: on ? 'var(--color-text)' : 'var(--color-neutral-800)',
          fw: on ? 600 : 400,
          bar: on ? 'var(--color-accent)' : 'transparent',
          dot: on ? 'var(--sq-gold)' : 'transparent',
          onClick: () => this.setF({ cat: id, group: '', sub: '' }),
        };
      });
      Object.assign(v, {
        shopTitle: f.sale
          ? 'Sale'
          : catObj
            ? CAT_NAME[f.cat] || catObj.label || catObj.name
            : f.group === 'hobbies'
              ? 'Hobbies'
              : q
                ? `Results for “${st.q.trim()}”`
                : 'Shop',
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
          // Only offer values that exist in the current catalog (no empty/fabricated filters)
          {
            title: 'Condition',
            opts: ['NM', 'LP', 'MP', 'HP', 'DMG', 'New', 'Sealed']
              .filter((c) => f.cond.includes(c) || base.some((p) => p.condition === c))
              .map((c) => chip(c, f.cond.includes(c), tog('cond', c))),
          },
          {
            title: 'Language',
            opts: [...new Set(base.map((p) => p.language).filter(Boolean))]
              .sort()
              .map((c) => chip(c, f.lang.includes(c), tog('lang', c))),
          },
          {
            title: 'Grading',
            opts: ['Raw', 'PSA', 'BGS', 'CGC', 'Other']
              .filter((c) => f.grade.includes(c) || base.some((p) => gradeOf(p) === c))
              .map((c) => chip(c, f.grade.includes(c), tog('grade', c))),
          },
          {
            title: 'Availability',
            opts: [
              chip('In stock only', f.inStock, () => this.setF({ inStock: !f.inStock })),
              ...(f.sale || base.some((p) => S.isOnSale(p))
                ? [chip('On sale', f.sale, () => this.setF({ sale: !f.sale }))]
                : []),
            ],
          },
        ].filter((g) => g.opts.length),
        clearFilters: () => this.setState({ f: { ...this.emptyF(), sort: this.state.f.sort }, q: '' }),
        openFilters: () => this.setState({ filtersOpen: true }),
        closeFilters: () => this.setState({ filtersOpen: false }),
        shopCols: mobile ? 'minmax(0,1fr)' : '220px minmax(0,1fr)',
        sortMin: mobile ? '0' : '170px',
        introPad: mobile ? '4px 0 16px' : '8px 0 22px',
        tabGap: mobile ? '22px' : '28px',
        tabBleed: mobile ? '-16px' : '0',
        tabBleedPad: mobile ? '16px' : '0',
        emptyPad: mobile ? '24px 0 40px' : '40px 0 64px',
        pricePad: f.cat && subs.length > 1 ? '16px 0 8px' : '4px 0 8px',
        priceMt: f.cat && subs.length > 1 ? '12px' : '0',
        priceBt: f.cat && subs.length > 1 ? '1px solid var(--color-divider)' : '0',
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
          ['Grade', p.grading_company ? `${p.grading_company} ${p.grade}` : ''],
          ['Condition', SQView.COND[p.condition] || p.condition],
          ['Language', p.language],
          ['Set', p.set],
          ['Card number', p.card_number],
          ['Pokémon', p.pokemon],
          ['Product type', SQView.TYPES[p.product_type]],
          ['SKU', p.sku],
          ['Inventory ID', p.track_items && av === 1 && inv ? inv.inventory_item_id : ''],
        ]
          .filter((x) => x[1])
          .map(([k, val]) => ({ k, v: val }));
        const unique = p.track_items && av === 1;
        Object.assign(v, {
          hasP: true,
          pNotFound: false,
          galleryPos: st.w >= 960 ? 'sticky' : 'static',
          pd: {
            ...base,
            catHref: '#/shop?cat=' + p.category,
            kicker: [base.catLabel, p.subcategory].filter(Boolean).join(' · '),
            chips,
            saveText: `Save ${SQView.peso(p.price - (p.sale_price || p.price))}`,
            hasBadge: !!(base.soldOut || base.hasSale || base.isNew),
            badge: base.soldOut ? 'Sold out' : base.hasSale ? base.saleText : base.isNew ? 'New' : '',
            badgeBg: base.soldOut
              ? 'var(--color-neutral-700)'
              : base.hasSale
                ? 'var(--color-accent)'
                : 'var(--color-text)',
            badgeFg: 'var(--color-bg)',
            hasSub: !!base.subline,
            hasThumbs: imgs.length > 1,
            isUnique: !!(unique && av > 0),
            mainImage: SQView.imgVM(gp, idx),
            thumbs: imgs.map((im, i) => ({
              image: SQView.imgVM(gp, i),
              label: 'Photo ' + (i + 1),
              bd: i === idx ? ink : 'var(--color-divider)',
              onClick: () => this.setState({ img: i }),
            })),
            availNote: av <= 0 ? '' : unique ? '' : inCart ? `· ${inCart} in your cart` : '',
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
            n: '',
            title: 'Contact details',
            fields: [
              fld('name', 'Full name', { full: true, auto: 'name' }),
              fld('email', 'Email', { type: 'email', im: 'email', auto: 'email', ph: 'you@email.com' }),
              fld('mobile', 'Mobile number', { type: 'tel', im: 'tel', auto: 'tel', ph: '09XX XXX XXXX' }),
            ],
          },
          {
            n: '',
            title: 'Shipping address',
            fields: [
              fld('address', 'House no., street, barangay', { full: true, auto: 'street-address' }),
              fld('city', 'City / Municipality', { auto: 'address-level2' }),
              fld('province', 'Province', { select: SQView.PROVINCES.map((x) => ({ v: x, l: x })) }),
              fld('postal', 'Postal code', { im: 'numeric', auto: 'postal-code', ph: 'e.g. 1100' }),
            ],
          },
          {
            n: '',
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
            tag: 'Not yet available',
          },
          // Only methods listed in the store's enabled_payment_methods setting are shown to customers.
          // To launch the gateway: add 'ONLINE_GATEWAY' to that setting and remove `disabled` above.
        ]
          .filter((m) =>
            ((S.SETTINGS && S.SETTINGS.enabled_payment_methods) || ['GCASH', 'BANK_TRANSFER']).includes(m.id),
          )
          .map((m) => {
            const on = co.payment === m.id;
            return {
              ...m,
              on,
              disabled: !!m.disabled,
              hasTag: !!m.tag,
              bd: on ? '1px solid var(--color-text)' : '1px solid var(--color-divider)',
              bg: on ? 'var(--color-surface)' : 'transparent',
              cursor: m.disabled ? 'not-allowed' : 'pointer',
              op: m.disabled ? 0.55 : 1,
              onPick: () => !m.disabled && this.setState((s) => ({ co: { ...s.co, payment: m.id } })),
            };
          });
        v.hasCoErr = !!st.coErr;
        v.coErr = st.coErr;
        v.placing = !!st.placing;
        v.placeLabel = st.placing ? 'Placing order…' : 'Place order';
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
            <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
              {' '}
              <div
                style={{
                  maxWidth: '1280px',
                  margin: '0 auto',
                  padding: '0 clamp(16px,3vw,32px)',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: v.stripJustify,
                  gap: '16px',
                  fontSize: '12px',
                  color: 'var(--color-neutral-800)',
                }}
              >
                {' '}
                {v.isDesktop ? (
                  <>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        letterSpacing: '.12em',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', background: 'var(--sq-gold)' }}></span>
                      {'COLLECT • TRADE • HOBBIES'}
                    </span>
                  </>
                ) : null}{' '}
                <span>{'Nationwide shipping across the Philippines'}</span>{' '}
              </div>
            </div>

            <header
              style={{
                position: 'sticky',
                top: '0',
                zIndex: '30',
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              {' '}
              {v.isDesktop ? (
                <>
                  {' '}
                  <div
                    style={{
                      maxWidth: '1280px',
                      margin: '0 auto',
                      padding: '10px clamp(16px,3vw,32px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '28px',
                    }}
                  >
                    {' '}
                    <a href={'#/'} aria-label={'SIDE QUEST home'} style={{ display: 'block', flex: 'none' }}>
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                        style={{ height: '52px', width: 'auto', display: 'block' }}
                      />
                    </a>{' '}
                    <nav aria-label={'Shop'} style={{ display: 'flex', gap: v.navGap }}>
                      {' '}
                      {L(v.navItems).map((n, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <a
                            href={n?.href}
                            className="sq5p0"
                            style={{
                              padding: '8px 0',
                              fontSize: '13px',
                              fontWeight: '600',
                              letterSpacing: '.06em',
                              textTransform: 'uppercase',
                              color: n?.color,
                              textDecoration: 'none',
                              borderBottom: `2px solid ${S(n?.bar)}`,
                            }}
                          >
                            {T(n?.label)}
                          </a>{' '}
                        </React.Fragment>
                      ))}{' '}
                    </nav>{' '}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {' '}
                      {v.wideHeader ? (
                        <>
                          <div
                            style={{
                              width: 'clamp(200px,22vw,300px)',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              background: 'var(--color-surface)',
                            }}
                          >
                            {' '}
                            <span
                              style={{ display: 'flex', padding: '0 6px 0 12px', color: 'var(--color-neutral-700)' }}
                            >
                              <svg
                                width={'17'}
                                height={'17'}
                                viewBox={'0 0 24 24'}
                                fill={'none'}
                                stroke={'currentColor'}
                                strokeWidth={'2'}
                                strokeLinecap={'round'}
                                strokeLinejoin={'round'}
                              >
                                <circle cx={'11'} cy={'11'} r={'8'}></circle>
                                <path d={'m21 21-4.3-4.3'}></path>
                              </svg>
                            </span>{' '}
                            <input
                              value={v.q}
                              onChange={v.onQ}
                              onKeyDown={v.onQKey}
                              placeholder={'Search cards, sets, sealed…'}
                              aria-label={'Search the store'}
                              style={{
                                flex: '1',
                                minWidth: '0',
                                height: '100%',
                                border: '0',
                                background: 'transparent',
                                padding: '0 12px 0 4px',
                                font: 'inherit',
                                fontSize: '14px',
                                color: 'var(--color-text)',
                                outline: 'none',
                              }}
                            />{' '}
                          </div>
                        </>
                      ) : null}{' '}
                      <a
                        href={'#/account'}
                        aria-label={'Account'}
                        className="sq5p0"
                        style={{
                          position: 'relative',
                          width: '42px',
                          height: '42px',
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
                          strokeWidth={'1.8'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path d={'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}></path>
                          <circle cx={'12'} cy={'7'} r={'4'}></circle>
                        </svg>
                      </a>{' '}
                      <a
                        href={'#/wishlist'}
                        aria-label={'Wishlist'}
                        className="sq5p0"
                        style={{
                          position: 'relative',
                          width: '42px',
                          height: '42px',
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
                          strokeWidth={'1.8'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path
                            d={
                              'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                            }
                          ></path>
                        </svg>
                        {v.wishHas ? (
                          <>
                            <span
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '0',
                                minWidth: '17px',
                                height: '17px',
                                padding: '0 4px',
                                background: 'var(--color-text)',
                                color: 'var(--color-bg)',
                                fontSize: '10px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {T(v.wishCount)}
                            </span>
                          </>
                        ) : null}
                      </a>{' '}
                      <a
                        href={'#/cart'}
                        aria-label={'Cart'}
                        className="sq5p0"
                        style={{
                          position: 'relative',
                          width: '42px',
                          height: '42px',
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
                          strokeWidth={'1.8'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <path d={'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'}></path>
                          <path d={'M3 6h18'}></path>
                          <path d={'M16 10a4 4 0 0 1-8 0'}></path>
                        </svg>
                        {v.cartHas ? (
                          <>
                            <span
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '0',
                                minWidth: '17px',
                                height: '17px',
                                padding: '0 4px',
                                background: 'var(--color-accent)',
                                color: 'var(--color-bg)',
                                fontSize: '10px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {T(v.cartCount)}
                            </span>
                          </>
                        ) : null}
                      </a>{' '}
                    </div>{' '}
                  </div>{' '}
                  {v.tabletSearch ? (
                    <>
                      {' '}
                      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 clamp(16px,3vw,32px) 12px' }}>
                        {' '}
                        <div
                          style={{
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--color-surface)',
                          }}
                        >
                          {' '}
                          <span style={{ display: 'flex', padding: '0 4px 0 12px', color: 'var(--color-neutral-700)' }}>
                            <svg
                              width={'17'}
                              height={'17'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2'}
                              strokeLinecap={'round'}
                              strokeLinejoin={'round'}
                            >
                              <circle cx={'11'} cy={'11'} r={'8'}></circle>
                              <path d={'m21 21-4.3-4.3'}></path>
                            </svg>
                          </span>{' '}
                          <input
                            value={v.q}
                            onChange={v.onQ}
                            onKeyDown={v.onQKey}
                            placeholder={'Search cards, sets, sealed…'}
                            aria-label={'Search the store'}
                            enterKeyHint={'search'}
                            style={{
                              flex: '1',
                              minWidth: '0',
                              height: '100%',
                              border: '0',
                              background: 'transparent',
                              padding: '0 12px 0 6px',
                              font: 'inherit',
                              fontSize: '16px',
                              color: 'var(--color-text)',
                              outline: 'none',
                            }}
                          />{' '}
                        </div>{' '}
                      </div>{' '}
                    </>
                  ) : null}{' '}
                </>
              ) : null}{' '}
              {v.isMobile ? (
                <>
                  {' '}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px' }}>
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
                        <path d={'M4 7h16M4 12h16M4 17h16'}></path>
                      </svg>
                    </button>{' '}
                    <a href={'#/'} aria-label={'SIDE QUEST home'} style={{ display: 'block', marginRight: 'auto' }}>
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST'}
                        style={{ height: '40px', width: 'auto', display: 'block' }}
                      />
                    </a>{' '}
                    <a
                      href={'#/cart'}
                      aria-label={'Cart'}
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '44px',
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
                        strokeWidth={'1.8'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <path d={'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z'}></path>
                        <path d={'M3 6h18'}></path>
                        <path d={'M16 10a4 4 0 0 1-8 0'}></path>
                      </svg>
                      {v.cartHas ? (
                        <>
                          <span
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '0',
                              minWidth: '17px',
                              height: '17px',
                              padding: '0 4px',
                              background: 'var(--color-accent)',
                              color: 'var(--color-bg)',
                              fontSize: '10px',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {T(v.cartCount)}
                          </span>
                        </>
                      ) : null}
                    </a>{' '}
                  </div>{' '}
                  <div style={{ padding: '0 12px 10px' }}>
                    {' '}
                    <div
                      style={{
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--color-surface)',
                      }}
                    >
                      {' '}
                      <span style={{ display: 'flex', padding: '0 4px 0 12px', color: 'var(--color-neutral-700)' }}>
                        <svg
                          width={'17'}
                          height={'17'}
                          viewBox={'0 0 24 24'}
                          fill={'none'}
                          stroke={'currentColor'}
                          strokeWidth={'2'}
                          strokeLinecap={'round'}
                          strokeLinejoin={'round'}
                        >
                          <circle cx={'11'} cy={'11'} r={'8'}></circle>
                          <path d={'m21 21-4.3-4.3'}></path>
                        </svg>
                      </span>{' '}
                      <input
                        value={v.q}
                        onChange={v.onQ}
                        onKeyDown={v.onQKey}
                        placeholder={'Search cards, sets, sealed…'}
                        aria-label={'Search the store'}
                        enterKeyHint={'search'}
                        id={'sq-search-m'}
                        style={{
                          flex: '1',
                          minWidth: '0',
                          height: '100%',
                          border: '0',
                          background: 'transparent',
                          padding: '0 12px 0 6px',
                          font: 'inherit',
                          fontSize: '16px',
                          color: 'var(--color-text)',
                          outline: 'none',
                        }}
                      />{' '}
                    </div>{' '}
                  </div>{' '}
                </>
              ) : null}
            </header>

            <main style={{ minHeight: '60vh', paddingBottom: v.mainPadB }}>
              {v.isHome ? (
                <>
                  {' '}
                  <section data-screen-label={'Home'} style={{ borderBottom: '1px solid var(--color-divider)' }}>
                    {' '}
                    <div
                      style={{
                        maxWidth: '1280px',
                        margin: '0 auto',
                        padding: v.heroPad,
                        display: 'grid',
                        gridTemplateColumns: v.heroCols,
                        gap: v.heroGap,
                        alignItems: 'center',
                      }}
                    >
                      {' '}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                          alignItems: 'flex-start',
                          minWidth: '0',
                        }}
                      >
                        {' '}
                        <h1
                          style={{
                            fontSize: v.heroFont,
                            lineHeight: '1.05',
                            letterSpacing: '-.02em',
                            fontWeight: '700',
                            margin: '0',
                            color: 'var(--color-text)',
                          }}
                        >
                          {'Find your next chase'}
                        </h1>{' '}
                        <p
                          style={{
                            maxWidth: '440px',
                            margin: '0',
                            fontSize: '17px',
                            lineHeight: '1.55',
                            color: 'var(--color-neutral-800)',
                            textWrap: 'pretty',
                          }}
                        >
                          {
                            'Pokémon TCG singles, graded cards and sealed product, plus collectibles and hobby finds. Shipped nationwide across the Philippines.'
                          }
                        </p>{' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            flexWrap: 'wrap',
                            marginTop: '8px',
                          }}
                        >
                          {' '}
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{
                              padding: '14px 22px',
                              fontSize: '15px',
                              fontWeight: '600',
                              gap: '28px',
                              justifyContent: 'space-between',
                              minWidth: v.ctaMin,
                            }}
                          >
                            {'Shop now '}
                            <span>{'→'}</span>
                          </a>{' '}
                          <a
                            href={'#/shop?cat=psa'}
                            className="sq5p0"
                            style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: 'var(--color-text)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '4px',
                              textDecorationThickness: '1px',
                            }}
                          >
                            {'Browse graded cards'}
                          </a>{' '}
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                          gap: v.heroTileGap,
                          minWidth: '0',
                          width: '100%',
                          maxWidth: v.heroArtMax,
                        }}
                      >
                        {' '}
                        {L(v.heroTiles).map((t, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <a
                              href={t?.href}
                              className="sq5p1"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                textDecoration: 'none',
                                color: 'var(--color-text)',
                                minWidth: '0',
                              }}
                            >
                              <div
                                style={{
                                  position: 'relative',
                                  aspectRatio: '3/4',
                                  background: 'var(--color-surface)',
                                  overflow: 'hidden',
                                }}
                              >
                                {' '}
                                <ProductImageV3
                                  image={t?.image}
                                  compact={true}
                                  __hostStyle={{ position: 'absolute', inset: '0' }}
                                />{' '}
                              </div>
                              <span
                                style={{
                                  fontSize: v.heroTileFont,
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {T(t?.label)}
                                {' →'}
                              </span>{' '}
                            </a>{' '}
                          </React.Fragment>
                        ))}{' '}
                      </div>{' '}
                    </div>{' '}
                  </section>{' '}
                  {v.hasNew ? (
                    <>
                      <section>
                        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '16px',
                              marginBottom: '20px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  letterSpacing: '.12em',
                                  color: 'var(--color-neutral-700)',
                                }}
                              >
                                <span style={{ color: 'var(--color-accent-700)' }}>{'SQ'}</span>
                                {' / NEW'}
                              </div>
                              <h2
                                style={{
                                  fontSize: 'clamp(20px,2vw,26px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  margin: '0',
                                  color: 'var(--color-text)',
                                }}
                              >
                                {'New arrivals'}
                              </h2>
                            </div>
                            <a
                              href={'#/shop?sort=newest'}
                              className="sq5p0"
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'View all →'}
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: v.gridCols,
                              gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                            }}
                          >
                            {L(v.newItems).map((p, $index) => (
                              <React.Fragment key={$index}>
                                <ProductCardV3 p={p} dense={v.denseCards} />
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </section>
                    </>
                  ) : null}{' '}
                  <section>
                    {' '}
                    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                      {' '}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          gap: '16px',
                          marginBottom: '20px',
                        }}
                      >
                        <h2
                          style={{
                            fontSize: 'clamp(20px,2vw,26px)',
                            fontWeight: '700',
                            letterSpacing: '-.01em',
                            margin: '0',
                            color: 'var(--color-text)',
                          }}
                        >
                          {'Shop by category'}
                        </h2>
                        <a
                          href={'#/shop'}
                          className="sq5p0"
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--color-text)',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {'View all →'}
                        </a>
                      </div>{' '}
                      <div style={{ display: 'grid', gridTemplateColumns: v.catCols, gap: v.catGap }}>
                        {' '}
                        {L(v.homeCats).map((c, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <a
                              href={c?.href}
                              className="sq5p1"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                textDecoration: 'none',
                                color: 'var(--color-text)',
                              }}
                            >
                              {' '}
                              <div
                                style={{
                                  position: 'relative',
                                  aspectRatio: '1/1',
                                  background: 'var(--color-surface)',
                                  overflow: 'hidden',
                                }}
                              >
                                {' '}
                                <ProductImageV3
                                  image={c?.image}
                                  compact={true}
                                  __hostStyle={{ position: 'absolute', inset: '0' }}
                                />{' '}
                              </div>{' '}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                {' '}
                                <span style={{ fontSize: v.catNameSize, fontWeight: '600', lineHeight: '1.25' }}>
                                  {T(c?.name)}
                                </span>{' '}
                                {c?.hasCount ? (
                                  <>
                                    <span
                                      style={{
                                        fontSize: '13px',
                                        color: 'var(--color-neutral-700)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {T(c?.countText)}
                                    </span>
                                  </>
                                ) : null}{' '}
                              </div>{' '}
                            </a>{' '}
                          </React.Fragment>
                        ))}{' '}
                      </div>{' '}
                    </div>{' '}
                  </section>{' '}
                  {v.hasChase ? (
                    <>
                      {' '}
                      <section style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
                        {' '}
                        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '16px',
                              marginBottom: '24px',
                            }}
                          >
                            {' '}
                            <div>
                              {' '}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: 'var(--sq-gold)',
                                  marginBottom: '6px',
                                }}
                              >
                                {'The Chase'}
                              </div>{' '}
                              <h2
                                style={{
                                  fontSize: 'clamp(22px,2.4vw,30px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  margin: '0',
                                  color: 'var(--color-bg)',
                                }}
                              >
                                {'Standout singles and slabs'}
                              </h2>{' '}
                            </div>{' '}
                            <a
                              href={'#/shop?cat=pokemon'}
                              className="sq5p2"
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--color-bg)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'View all →'}
                            </a>{' '}
                          </div>{' '}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: v.gridCols,
                              gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                            }}
                          >
                            {' '}
                            {L(v.chaseItems).map((p, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <div
                                  style={{ background: 'var(--color-bg)', padding: '12px 12px 14px', minWidth: '0' }}
                                >
                                  <ProductCardV3 p={p} dense={v.denseCards} />
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
                          </div>{' '}
                        </div>{' '}
                      </section>{' '}
                    </>
                  ) : null}{' '}
                  {v.hasSealed ? (
                    <>
                      <section>
                        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '16px',
                              marginBottom: '20px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  letterSpacing: '.12em',
                                  color: 'var(--color-neutral-700)',
                                }}
                              >
                                <span style={{ color: 'var(--color-accent-700)' }}>{'SQ'}</span>
                                {' / SEALED'}
                              </div>
                              <h2
                                style={{
                                  fontSize: 'clamp(20px,2vw,26px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  margin: '0',
                                  color: 'var(--color-text)',
                                }}
                              >
                                {'Sealed products'}
                              </h2>
                            </div>
                            <a
                              href={'#/shop?cat=sealed'}
                              className="sq5p0"
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'View all →'}
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: v.gridCols,
                              gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                            }}
                          >
                            {L(v.sealedItems).map((p, $index) => (
                              <React.Fragment key={$index}>
                                <ProductCardV3 p={p} dense={v.denseCards} />
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </section>
                    </>
                  ) : null}{' '}
                  {v.hasGraded ? (
                    <>
                      <section style={{ borderTop: '1px solid var(--color-divider)' }}>
                        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '16px',
                              marginBottom: '20px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  letterSpacing: '.12em',
                                  color: 'var(--color-neutral-700)',
                                }}
                              >
                                <span style={{ color: 'var(--color-accent-700)' }}>{'SQ'}</span>
                                {' / GRADED'}
                              </div>
                              <h2
                                style={{
                                  fontSize: 'clamp(20px,2vw,26px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  margin: '0',
                                  color: 'var(--color-text)',
                                }}
                              >
                                {'Graded cards'}
                              </h2>
                            </div>
                            <a
                              href={'#/shop?cat=psa'}
                              className="sq5p0"
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'View all →'}
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: v.gridCols,
                              gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                            }}
                          >
                            {L(v.gradedItems).map((p, $index) => (
                              <React.Fragment key={$index}>
                                <ProductCardV3 p={p} dense={v.denseCards} />
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </section>
                    </>
                  ) : null}{' '}
                  {v.hasHobby ? (
                    <>
                      <section style={{ borderTop: '1px solid var(--color-divider)' }}>
                        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: v.secPad }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-end',
                              gap: '16px',
                              marginBottom: '20px',
                            }}
                          >
                            <h2
                              style={{
                                fontSize: 'clamp(20px,2vw,26px)',
                                fontWeight: '700',
                                letterSpacing: '-.01em',
                                margin: '0',
                                color: 'var(--color-text)',
                              }}
                            >
                              {'Accessories & collectibles'}
                            </h2>
                            <a
                              href={'#/shop?group=hobbies'}
                              className="sq5p0"
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'View all →'}
                            </a>
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: v.gridCols,
                              gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                            }}
                          >
                            {L(v.hobbyItems).map((p, $index) => (
                              <React.Fragment key={$index}>
                                <ProductCardV3 p={p} dense={v.denseCards} />
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </section>
                    </>
                  ) : null}{' '}
                  <section style={{ borderTop: '1px solid var(--color-divider)' }}>
                    {' '}
                    <div
                      style={{
                        maxWidth: '1280px',
                        margin: '0 auto',
                        padding: v.secPad,
                        display: 'grid',
                        gridTemplateColumns: v.brandCols,
                        gap: v.heroGap,
                        alignItems: 'start',
                      }}
                    >
                      {' '}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--color-accent-700)',
                          }}
                        >
                          {'About SIDE QUEST'}
                        </div>{' '}
                        <h2
                          style={{
                            fontSize: 'clamp(20px,2vw,26px)',
                            fontWeight: '700',
                            letterSpacing: '-.01em',
                            margin: '0',
                          }}
                        >
                          {'A collector-focused shop for Pokémon TCG, collectibles and hobby finds.'}
                        </h2>{' '}
                        <a
                          href={'#/about'}
                          className="sq5p0"
                          style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--color-text)',
                            textDecoration: 'underline',
                            textUnderlineOffset: '4px',
                            textDecorationThickness: '1px',
                            alignSelf: 'flex-start',
                          }}
                        >
                          {'Learn more about us'}
                        </a>{' '}
                      </div>{' '}
                      <div style={{ display: 'grid', gridTemplateColumns: v.serviceCols, gap: '24px' }}>
                        {' '}
                        {L(v.services).map((t, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {' '}
                              <span style={{ color: 'var(--color-accent)' }}>{T(t?.icon)}</span>{' '}
                              <div style={{ fontSize: '15px', fontWeight: '600' }}>{T(t?.title)}</div>{' '}
                              <div style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--color-neutral-700)' }}>
                                {T(t?.text)}
                              </div>{' '}
                            </div>{' '}
                          </React.Fragment>
                        ))}{' '}
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
                    style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px clamp(16px,3vw,32px) 72px' }}
                  >
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: v.introPad }}>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          letterSpacing: '.12em',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        <span style={{ color: 'var(--color-accent-700)' }}>{'SQ'}</span>
                        {' / '}
                        {T(v.shopKicker)}
                      </div>{' '}
                      <h1
                        style={{
                          fontSize: 'clamp(28px,3.2vw,36px)',
                          fontWeight: '700',
                          letterSpacing: '-.02em',
                          lineHeight: '1.1',
                          margin: '0',
                        }}
                      >
                        {T(v.shopTitle)}
                      </h1>{' '}
                      {v.hasShopIntro ? (
                        <>
                          <p
                            style={{
                              margin: '2px 0 0',
                              fontSize: '15px',
                              lineHeight: '1.5',
                              color: 'var(--color-neutral-800)',
                              maxWidth: '560px',
                            }}
                          >
                            {T(v.shopIntro)}
                          </p>
                        </>
                      ) : null}{' '}
                    </div>{' '}
                    <nav
                      aria-label={'Categories'}
                      style={{
                        display: 'flex',
                        gap: v.tabGap,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        borderBottom: '1px solid var(--color-divider)',
                        margin: `0 ${S(v.tabBleed)}`,
                        padding: `0 ${S(v.tabBleedPad)}`,
                      }}
                    >
                      {' '}
                      {L(v.catTabs).map((c, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <button
                            onClick={c?.onClick}
                            aria-pressed={c?.on}
                            className="sq5p0"
                            style={{
                              flex: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '12px 0 11px',
                              marginBottom: '-1px',
                              border: '0',
                              borderBottom: `2px solid ${S(c?.bar)}`,
                              background: 'transparent',
                              font: 'inherit',
                              fontSize: '14px',
                              fontWeight: c?.fw,
                              color: c?.fg,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', flex: 'none', background: c?.dot }}></span>
                            {T(c?.label)}
                            <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--color-neutral-600)' }}>
                              {T(c?.count)}
                            </span>
                          </button>{' '}
                        </React.Fragment>
                      ))}{' '}
                    </nav>{' '}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0 20px' }}>
                      {' '}
                      {v.isMobile ? (
                        <>
                          {' '}
                          <button
                            onClick={v.openFilters}
                            className="btn"
                            style={{
                              minHeight: '40px',
                              gap: '8px',
                              padding: '0 14px',
                              fontSize: '14px',
                              fontWeight: '600',
                              border: '1px solid var(--color-text)',
                              background: 'transparent',
                              color: 'var(--color-text)',
                            }}
                          >
                            {' '}
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'1.8'}
                              strokeLinecap={'round'}
                            >
                              <path d={'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'}></path>
                            </svg>
                            {T(v.filterBtnLabel)}{' '}
                          </button>{' '}
                        </>
                      ) : null}{' '}
                      <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                        {T(v.resultText)}
                      </span>{' '}
                      <label
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          minWidth: '0',
                        }}
                      >
                        {' '}
                        {v.isDesktop ? (
                          <>
                            <span style={{ color: 'var(--color-neutral-700)' }}>{'Sort'}</span>
                          </>
                        ) : null}{' '}
                        <select
                          value={v.sort}
                          onChange={v.onSort}
                          aria-label={'Sort products'}
                          className="input"
                          style={{
                            width: 'auto',
                            minWidth: v.sortMin,
                            maxWidth: '100%',
                            minHeight: '40px',
                            background: 'var(--color-bg)',
                          }}
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
                                borderBottom: '1px solid var(--color-divider)',
                                paddingBottom: '12px',
                                marginBottom: '4px',
                              }}
                            >
                              {' '}
                              <div style={{ fontWeight: '700', fontSize: '20px' }}>{'Filters'}</div>{' '}
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
                        {v.hasSubs ? (
                          <>
                            {' '}
                            <div style={{ fontSize: '14px', fontWeight: '600', padding: '4px 0 8px' }}>
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
                                      whiteSpace: 'nowrap',
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
                            fontSize: '14px',
                            fontWeight: '600',
                            padding: v.pricePad,
                            marginTop: v.priceMt,
                            borderTop: v.priceBt,
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
                                fontSize: '14px',
                                fontWeight: '600',
                                padding: '16px 0 8px',
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
                                      whiteSpace: 'nowrap',
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
                            borderTop: '1px solid var(--color-divider)',
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
                                gridTemplateColumns: v.shopGridCols,
                                gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                              }}
                            >
                              {' '}
                              {L(v.results).map((p, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <ProductCardV3 p={p} dense={v.denseCards} />{' '}
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
                                padding: v.emptyPad,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                alignItems: 'flex-start',
                              }}
                            >
                              {' '}
                              <span
                                style={{
                                  width: '28px',
                                  height: '2px',
                                  background: 'var(--sq-gold)',
                                  marginBottom: '6px',
                                }}
                              ></span>{' '}
                              <p style={{ margin: '0', fontSize: '18px', fontWeight: '600' }}>{T(v.noResultsTitle)}</p>{' '}
                              {v.hasNoResultsText ? (
                                <>
                                  <p style={{ margin: '0', fontSize: '15px', color: 'var(--color-neutral-700)' }}>
                                    {T(v.noResultsText)}
                                  </p>
                                </>
                              ) : null}{' '}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '20px',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  marginTop: '6px',
                                }}
                              >
                                {' '}
                                {v.hasActiveFilters ? (
                                  <>
                                    <button
                                      onClick={v.clearFilters}
                                      className="sq5p0"
                                      style={{
                                        padding: '0',
                                        border: '0',
                                        background: 'transparent',
                                        font: 'inherit',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: 'var(--color-text)',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {'Clear filters'}
                                    </button>
                                  </>
                                ) : null}{' '}
                                {v.showEmptyLink ? (
                                  <>
                                    <a
                                      href={v.emptyLinkHref}
                                      className="sq5p0"
                                      style={{
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: 'var(--color-text)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      {T(v.emptyLinkText)}
                                    </a>
                                  </>
                                ) : null}{' '}
                              </div>{' '}
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
                    style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}
                  >
                    {' '}
                    {v.pNotFound ? (
                      <>
                        {' '}
                        <div
                          style={{
                            padding: '48px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <h1
                            style={{
                              fontSize: 'clamp(26px,3vw,32px)',
                              fontWeight: '700',
                              letterSpacing: '-.015em',
                              lineHeight: '1.15',
                              margin: '0',
                            }}
                          >
                            {'Product not found'}
                          </h1>
                          <p style={{ margin: '0', fontSize: '15px', color: 'var(--color-neutral-700)' }}>
                            {'This product may have sold or been removed.'}
                          </p>
                          <a
                            href={'#/shop'}
                            className="sq5p0"
                            style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: 'var(--color-text)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '4px',
                              textDecorationThickness: '1px',
                            }}
                          >
                            {'Browse all products'}
                          </a>
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.hasP ? (
                      <>
                        {' '}
                        <div
                          style={{
                            fontSize: '13px',
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
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: v.prodCols,
                            gap: 'clamp(24px,4vw,56px)',
                            marginTop: '16px',
                            alignItems: 'start',
                          }}
                        >
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: v.galleryPos,
                              top: '96px',
                              minWidth: '0',
                            }}
                          >
                            {' '}
                            <div
                              style={{ position: 'relative', aspectRatio: '1/1', background: 'var(--color-surface)' }}
                            >
                              {' '}
                              <ProductImageV3
                                image={v.pd?.mainImage}
                                __hostStyle={{ position: 'absolute', inset: '0' }}
                              />{' '}
                              {v.pd?.hasBadge ? (
                                <>
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: '12px',
                                      left: '12px',
                                      padding: '3px 8px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      background: v.pd?.badgeBg,
                                      color: v.pd?.badgeFg,
                                    }}
                                  >
                                    {T(v.pd?.badge)}
                                  </span>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                            {v.pd?.hasThumbs ? (
                              <>
                                {' '}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5,minmax(0,1fr))',
                                    gap: '8px',
                                  }}
                                >
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
                                          border: `1px solid ${S(t?.bd)}`,
                                          background: 'var(--color-surface)',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {' '}
                                        <ProductImageV3
                                          image={t?.image}
                                          compact={true}
                                          __hostStyle={{ position: 'absolute', inset: '0' }}
                                        />{' '}
                                      </button>{' '}
                                    </React.Fragment>
                                  ))}{' '}
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            {v.pd?.isUnique ? (
                              <>
                                {' '}
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'flex-start',
                                    fontSize: '14px',
                                    lineHeight: '1.45',
                                    color: 'var(--color-neutral-800)',
                                  }}
                                >
                                  <span style={{ flex: 'none', color: 'var(--color-text)', marginTop: '1px' }}>
                                    <svg
                                      width={'18'}
                                      height={'18'}
                                      viewBox={'0 0 24 24'}
                                      fill={'none'}
                                      stroke={'currentColor'}
                                      strokeWidth={'1.8'}
                                      strokeLinecap={'round'}
                                      strokeLinejoin={'round'}
                                    >
                                      <path
                                        d={
                                          'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z'
                                        }
                                      ></path>
                                      <path d={'m9 12 2 2 4-4'}></path>
                                    </svg>
                                  </span>
                                  <span>
                                    <strong style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                                      {'This exact card ships to you.'}
                                    </strong>
                                    {' It’s a single physical item, not one of several copies.'}
                                  </span>
                                </div>{' '}
                              </>
                            ) : null}{' '}
                          </div>{' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                            {' '}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {' '}
                              <a
                                href={v.pd?.catHref}
                                className="sq5p0"
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--color-neutral-700)',
                                  textDecoration: 'none',
                                  alignSelf: 'flex-start',
                                }}
                              >
                                {T(v.pd?.catLabel)}
                              </a>{' '}
                              <h1
                                style={{
                                  fontSize: 'clamp(24px,2.6vw,30px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.015em',
                                  lineHeight: '1.2',
                                  margin: '0',
                                  textWrap: 'pretty',
                                }}
                              >
                                {T(v.pd?.name)}
                              </h1>{' '}
                              {v.pd?.hasSub ? (
                                <>
                                  <div style={{ fontSize: '15px', color: 'var(--color-neutral-700)' }}>
                                    {T(v.pd?.subline)}
                                  </div>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                              {' '}
                              <span
                                style={{
                                  fontSize: '26px',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  color: v.pd?.priceColor,
                                }}
                              >
                                {T(v.pd?.priceText)}
                              </span>{' '}
                              {v.pd?.hasSale ? (
                                <>
                                  <span
                                    style={{
                                      fontSize: '16px',
                                      textDecoration: 'line-through',
                                      color: 'var(--color-neutral-600)',
                                    }}
                                  >
                                    {T(v.pd?.origPriceText)}
                                  </span>
                                  <span
                                    style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-accent-700)' }}
                                  >
                                    {T(v.pd?.saveText)}
                                  </span>
                                </>
                              ) : null}{' '}
                            </div>{' '}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                              <span
                                style={{ width: '8px', height: '8px', flex: 'none', background: v.pd?.availDot }}
                              ></span>
                              <span style={{ fontWeight: '600' }}>{T(v.pd?.availText)}</span>
                              <span style={{ color: 'var(--color-neutral-700)' }}>{T(v.pd?.availNote)}</span>
                            </div>{' '}
                            {v.pd?.canBuy ? (
                              <>
                                {' '}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {' '}
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    {' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        border: '1px solid var(--color-text)',
                                        height: '48px',
                                        flex: 'none',
                                      }}
                                    >
                                      {' '}
                                      <button
                                        onClick={v.pd?.onDec}
                                        disabled={v.pd?.decDisabled}
                                        aria-label={'Decrease quantity'}
                                        style={{
                                          width: '44px',
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
                                          width={'14'}
                                          height={'14'}
                                          viewBox={'0 0 24 24'}
                                          fill={'none'}
                                          stroke={'currentColor'}
                                          strokeWidth={'2'}
                                          strokeLinecap={'round'}
                                          strokeLinejoin={'round'}
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
                                          fontWeight: '600',
                                          fontSize: '16px',
                                        }}
                                      >
                                        {T(v.pd?.qty)}
                                      </div>{' '}
                                      <button
                                        onClick={v.pd?.onInc}
                                        disabled={v.pd?.incDisabled}
                                        aria-label={'Increase quantity'}
                                        style={{
                                          width: '44px',
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
                                          width={'14'}
                                          height={'14'}
                                          viewBox={'0 0 24 24'}
                                          fill={'none'}
                                          stroke={'currentColor'}
                                          strokeWidth={'2'}
                                          strokeLinecap={'round'}
                                          strokeLinejoin={'round'}
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
                                        minWidth: '0',
                                        height: '48px',
                                        padding: '0 20px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                      }}
                                    >
                                      {'Add to cart'}
                                    </button>{' '}
                                  </div>{' '}
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    {' '}
                                    <button
                                      onClick={v.pd?.onBuyNow}
                                      className="btn sq5p3"
                                      style={{
                                        flex: '1',
                                        height: '48px',
                                        padding: '0 20px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        border: '1px solid var(--color-text)',
                                        background: 'transparent',
                                        color: 'var(--color-text)',
                                      }}
                                    >
                                      {'Buy now'}
                                    </button>{' '}
                                    <button
                                      onClick={v.pd?.onWish}
                                      aria-label={v.pd?.wishLabel}
                                      aria-pressed={v.pd?.wished}
                                      className="sq5p4"
                                      style={{
                                        width: '48px',
                                        height: '48px',
                                        flex: 'none',
                                        border: '1px solid var(--color-divider)',
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
                                        strokeWidth={'1.8'}
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
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            {v.pd?.cantBuy ? (
                              <>
                                {' '}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {' '}
                                  <div
                                    style={{
                                      flex: '1',
                                      minWidth: '200px',
                                      padding: '13px 16px',
                                      background: 'var(--color-surface)',
                                      fontSize: '14px',
                                    }}
                                  >
                                    {T(v.pd?.cantBuyText)}
                                  </div>{' '}
                                  <button
                                    onClick={v.pd?.onWish}
                                    className="btn sq5p3"
                                    style={{
                                      minHeight: '48px',
                                      gap: '8px',
                                      padding: '0 16px',
                                      fontSize: '15px',
                                      fontWeight: '600',
                                      border: '1px solid var(--color-text)',
                                      background: 'transparent',
                                      color: v.pd?.heartColor,
                                    }}
                                  >
                                    <svg
                                      width={'18'}
                                      height={'18'}
                                      viewBox={'0 0 24 24'}
                                      fill={v.pd?.heartFill}
                                      stroke={'currentColor'}
                                      strokeWidth={'1.8'}
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
                            <div
                              style={{
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '18px',
                                marginTop: '4px',
                              }}
                            >
                              {' '}
                              <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '6px' }}>
                                {'Details'}
                              </h2>{' '}
                              {L(v.pd?.details).map((d, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'minmax(110px,38%) minmax(0,1fr)',
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
                            <div style={{ paddingTop: '6px' }}>
                              {' '}
                              <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '8px' }}>
                                {'Description'}
                              </h2>{' '}
                              <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.65', textWrap: 'pretty' }}>
                                {T(v.pd?.description)}
                              </p>{' '}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '16px',
                              }}
                            >
                              {' '}
                              <span style={{ flex: 'none', marginTop: '1px' }}>
                                <svg
                                  width={'20'}
                                  height={'20'}
                                  viewBox={'0 0 24 24'}
                                  fill={'none'}
                                  stroke={'currentColor'}
                                  strokeWidth={'1.8'}
                                  strokeLinecap={'round'}
                                  strokeLinejoin={'round'}
                                >
                                  <path d={'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'}></path>
                                  <path d={'M15 18H9'}></path>
                                  <path
                                    d={
                                      'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14'
                                    }
                                  ></path>
                                  <circle cx={'17'} cy={'18'} r={'2'}></circle>
                                  <circle cx={'7'} cy={'18'} r={'2'}></circle>
                                </svg>
                              </span>{' '}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '14px' }}>
                                <span style={{ fontWeight: '600' }}>{'Shipping throughout the Philippines'}</span>
                                <span style={{ color: 'var(--color-neutral-800)' }}>{T(v.pd?.shipText)}</span>
                              </div>{' '}
                            </div>{' '}
                          </div>{' '}
                        </div>{' '}
                        {v.hasRelated ? (
                          <>
                            {' '}
                            <div
                              style={{
                                marginTop: 'clamp(48px,6vw,80px)',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: 'clamp(32px,4vw,48px)',
                              }}
                            >
                              {' '}
                              <h2
                                style={{
                                  fontSize: 'clamp(20px,2vw,24px)',
                                  fontWeight: '700',
                                  letterSpacing: '-.01em',
                                  margin: '0 0 20px',
                                }}
                              >
                                {'More in '}
                                {T(v.pd?.catLabel)}
                              </h2>{' '}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: v.gridCols,
                                  gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                                }}
                              >
                                {' '}
                                {L(v.related).map((p, $index) => (
                                  <React.Fragment key={$index}>
                                    <ProductCardV3 p={p} dense={v.denseCards} />
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
                  <div data-screen-label={'Cart'} style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}>
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,32px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        lineHeight: '1.15',
                        margin: '0',
                        marginBottom: '20px',
                      }}
                    >
                      {'Your cart'}
                    </h1>{' '}
                    {v.cartEmpty ? (
                      <>
                        {' '}
                        <div
                          style={{
                            borderTop: '1px solid var(--color-divider)',
                            padding: '32px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            alignItems: 'flex-start',
                          }}
                        >
                          {' '}
                          <p style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                            {'Your cart is empty.'}
                          </p>{' '}
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{
                              padding: '14px 20px',
                              fontSize: '15px',
                              fontWeight: '600',
                              gap: '24px',
                              justifyContent: 'space-between',
                              whiteSpace: 'nowrap',
                              flex: 'none',
                            }}
                          >
                            {'Shop now '}
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
                          <div style={{ borderTop: '1px solid var(--color-divider)' }}>
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
                                    aria-label={l?.name}
                                    style={{
                                      position: 'relative',
                                      display: 'block',
                                      aspectRatio: '1/1',
                                      background: 'var(--color-surface)',
                                    }}
                                  >
                                    <ProductImageV3
                                      image={l?.image}
                                      compact={true}
                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                    />
                                  </a>{' '}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' }}>
                                    {' '}
                                    <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                      {T(l?.catLabel)}
                                    </div>{' '}
                                    <a
                                      href={l?.href}
                                      className="sq5p0"
                                      style={{
                                        fontWeight: '600',
                                        fontSize: '15px',
                                        lineHeight: '1.3',
                                        color: 'var(--color-text)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      {T(l?.name)}
                                    </a>{' '}
                                    {l?.hasMeta ? (
                                      <>
                                        <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                          {T(l?.meta)}
                                        </div>
                                      </>
                                    ) : null}{' '}
                                    <div style={{ fontSize: '13px', color: 'var(--color-neutral-800)' }}>
                                      {T(l?.unitText)}
                                      {' each'}
                                    </div>{' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        flexWrap: 'wrap',
                                        marginTop: '6px',
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
                                          aria-label={'Decrease quantity'}
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
                                            strokeWidth={'2'}
                                            strokeLinecap={'round'}
                                            strokeLinejoin={'round'}
                                          >
                                            <path d={'M5 12h14'}></path>
                                          </svg>
                                        </button>{' '}
                                        <div
                                          style={{
                                            width: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '600',
                                          }}
                                        >
                                          {T(l?.qty)}
                                        </div>{' '}
                                        <button
                                          onClick={l?.onInc}
                                          aria-label={'Increase quantity'}
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
                                            strokeWidth={'2'}
                                            strokeLinecap={'round'}
                                            strokeLinejoin={'round'}
                                          >
                                            <path d={'M5 12h14M12 5v14'}></path>
                                          </svg>
                                        </button>{' '}
                                      </div>{' '}
                                      <button
                                        onClick={l?.onRemove}
                                        className="sq5p0"
                                        style={{
                                          padding: '10px 0',
                                          border: '0',
                                          background: 'transparent',
                                          font: 'inherit',
                                          fontSize: '14px',
                                          color: 'var(--color-neutral-800)',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '3px',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {'Remove'}
                                      </button>{' '}
                                    </div>{' '}
                                    {l?.hasNote ? (
                                      <>
                                        <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                          {T(l?.note)}
                                        </div>
                                      </>
                                    ) : null}{' '}
                                  </div>{' '}
                                  <div
                                    style={{
                                      fontWeight: '700',
                                      fontSize: '16px',
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
                              className="sq5p0"
                              style={{
                                display: 'inline-block',
                                marginTop: '18px',
                                fontSize: '15px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                textDecoration: 'underline',
                                textUnderlineOffset: '4px',
                                textDecorationThickness: '1px',
                              }}
                            >
                              {'Continue shopping'}
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
                              top: '96px',
                            }}
                          >
                            {' '}
                            <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '4px' }}>
                              {'Order summary'}
                            </h2>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                fontSize: '15px',
                              }}
                            >
                              <span>
                                {'Subtotal ('}
                                {T(v.cartCount)}
                                {' items)'}
                              </span>
                              <span style={{ fontWeight: '600' }}>{T(v.subtotalText)}</span>
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
                              <span style={{ fontWeight: '600' }}>{T(v.shipText)}</span>
                            </div>{' '}
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)', marginTop: '-6px' }}>
                              {T(v.shipNote)}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '14px',
                              }}
                            >
                              <span style={{ fontWeight: '600', fontSize: '16px' }}>{'Total'}</span>
                              <span style={{ fontSize: '22px', fontWeight: '700' }}>{T(v.totalText)}</span>
                            </div>{' '}
                            <a
                              href={'#/checkout'}
                              className="btn btn-primary"
                              style={{
                                padding: '15px 20px',
                                fontSize: '15px',
                                fontWeight: '600',
                                gap: '24px',
                                justifyContent: 'space-between',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {'Checkout '}
                              <span>{'→'}</span>
                            </a>{' '}
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
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
                    style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}
                  >
                    {' '}
                    <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)', display: 'flex', gap: '6px' }}>
                      <a href={'#/cart'} style={{ color: 'inherit' }}>
                        {'Cart'}
                      </a>
                      <span>{'/'}</span>
                      <span>{'Checkout'}</span>
                    </div>{' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,32px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        lineHeight: '1.15',
                        margin: '0',
                        margin: '8px 0 20px',
                      }}
                    >
                      {'Checkout'}
                    </h1>{' '}
                    {v.cartEmpty ? (
                      <>
                        {' '}
                        <div
                          style={{
                            borderTop: '1px solid var(--color-divider)',
                            padding: '32px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <p style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>
                            {'There’s nothing in your cart to check out.'}
                          </p>
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{
                              padding: '14px 20px',
                              fontSize: '15px',
                              fontWeight: '600',
                              gap: '24px',
                              justifyContent: 'space-between',
                              whiteSpace: 'nowrap',
                              flex: 'none',
                            }}
                          >
                            {'Shop now '}
                            <span>{'→'}</span>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: '0' }}>
                            {' '}
                            {L(v.coSections).map((s, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <section style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '18px' }}>
                                  {' '}
                                  <h2
                                    style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '14px' }}
                                  >
                                    {T(s?.title)}
                                  </h2>{' '}
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
                            <section style={{ borderTop: '1px solid var(--color-divider)', paddingTop: '18px' }}>
                              {' '}
                              <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '14px' }}>
                                {'Payment method'}
                              </h2>{' '}
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
                                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{T(m?.label)}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                          {T(m?.desc)}
                                        </span>
                                      </div>{' '}
                                      {m?.hasTag ? (
                                        <>
                                          <span
                                            style={{
                                              fontSize: '12px',
                                              color: 'var(--color-neutral-700)',
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
                              <p
                                style={{
                                  margin: '14px 0 0',
                                  padding: '14px 16px',
                                  background: 'var(--color-surface)',
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                }}
                              >
                                <strong style={{ fontWeight: '600' }}>{'No payment is taken on this page.'}</strong>
                                {
                                  ' After you place your order we’ll send payment instructions and your confirmed shipping fee. Your order stays '
                                }
                                <strong style={{ fontWeight: '600' }}>{'Payment pending'}</strong>
                                {' until we verify your payment.'}
                              </p>{' '}
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
                              top: '96px',
                            }}
                          >
                            {' '}
                            <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginBottom: '4px' }}>
                              {'Your order'}
                            </h2>{' '}
                            {L(v.cartLines).map((l, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '56px minmax(0,1fr) auto',
                                    gap: '12px',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                  }}
                                >
                                  {' '}
                                  <div
                                    style={{ position: 'relative', aspectRatio: '1/1', background: 'var(--color-bg)' }}
                                  >
                                    <ProductImageV3
                                      image={l?.image}
                                      compact={true}
                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                    />
                                  </div>{' '}
                                  <div style={{ minWidth: '0' }}>
                                    <div style={{ fontWeight: '600', lineHeight: '1.3' }}>{T(l?.name)}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                                      {'Qty '}
                                      {T(l?.qty)}
                                    </div>
                                  </div>{' '}
                                  <span style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>{T(l?.lineText)}</span>{' '}
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                fontSize: '15px',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '12px',
                              }}
                            >
                              <span>{'Subtotal'}</span>
                              <span style={{ fontWeight: '600' }}>{T(v.subtotalText)}</span>
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '12px',
                                fontSize: '15px',
                              }}
                            >
                              <span>{'Shipping'}</span>
                              <span style={{ fontWeight: '600' }}>{T(v.shipText)}</span>
                            </div>{' '}
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)', marginTop: '-6px' }}>
                              {T(v.shipNote)}
                            </div>{' '}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                borderTop: '1px solid var(--color-divider)',
                                paddingTop: '14px',
                              }}
                            >
                              <span style={{ fontWeight: '600', fontSize: '16px' }}>{'Total'}</span>
                              <span style={{ fontSize: '22px', fontWeight: '700' }}>{T(v.totalText)}</span>
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
                                padding: '16px 20px',
                                fontSize: '15px',
                                fontWeight: '600',
                                gap: '24px',
                                justifyContent: 'space-between',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {T(v.placeLabel)} <span>{'→'}</span>
                            </button>{' '}
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                              {'Placing your order reserves your items for 24 hours while we wait for payment.'}
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
                      maxWidth: '880px',
                      margin: '0 auto',
                      padding: v.pagePad,
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
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'flex-start',
                            padding: '32px 0',
                          }}
                        >
                          <h1
                            style={{
                              fontSize: 'clamp(26px,3vw,32px)',
                              fontWeight: '700',
                              letterSpacing: '-.015em',
                              lineHeight: '1.15',
                              margin: '0',
                            }}
                          >
                            {'Order not found'}
                          </h1>
                          <p style={{ margin: '0', fontSize: '15px', color: 'var(--color-neutral-700)' }}>
                            {'Check the link from your confirmation, or contact us with your order number.'}
                          </p>
                          <a
                            href={'#/shop'}
                            className="sq5p0"
                            style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: 'var(--color-text)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '4px',
                              textDecorationThickness: '1px',
                            }}
                          >
                            {'Browse all products'}
                          </a>
                        </div>
                      </>
                    ) : null}{' '}
                    {v.hasO ? (
                      <>
                        {' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {' '}
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-accent-700)' }}>
                            {'Order received'}
                          </div>{' '}
                          <h1
                            style={{
                              fontSize: 'clamp(26px,3vw,32px)',
                              fontWeight: '700',
                              letterSpacing: '-.015em',
                              lineHeight: '1.15',
                              margin: '0',
                            }}
                          >
                            {'Thanks, '}
                            {T(v.od?.firstName)}
                            {'.'}
                          </h1>{' '}
                          <p style={{ margin: '0', fontSize: '16px', lineHeight: '1.55', maxWidth: '640px' }}>
                            {'We’ve received order '}
                            <strong style={{ fontWeight: '600' }}>{T(v.od?.id)}</strong>
                            {' and reserved your items. We’ll contact you at '}
                            <strong style={{ fontWeight: '600' }}>{T(v.od?.email)}</strong>
                            {' and '}
                            <strong style={{ fontWeight: '600' }}>{T(v.od?.mobile)}</strong>
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
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{'Order ID'}</div>
                            <div style={{ fontWeight: '600', fontSize: '16px' }}>{T(v.od?.id)}</div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{'Order status'}</div>
                            <div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: '4px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  background: v.od?.statusBg,
                                  color: v.od?.statusFg,
                                }}
                              >
                                {T(v.od?.statusLabel)}
                              </span>
                            </div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{'Payment'}</div>
                            <div style={{ fontWeight: '600', fontSize: '15px' }}>
                              {T(v.od?.payLabel)}
                              {' · '}
                              {T(v.od?.payStatus)}
                            </div>
                          </div>{' '}
                          <div style={{ background: 'var(--color-bg)', padding: '14px 16px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{'Total'}</div>
                            <div style={{ fontWeight: '600', fontSize: '16px' }}>{T(v.od?.totalText)}</div>
                          </div>{' '}
                        </div>{' '}
                        <div
                          style={{
                            background: 'var(--color-surface)',
                            padding: '18px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {' '}
                          <div style={{ fontWeight: '600', fontSize: '15px' }}>{'Payment not yet received'}</div>{' '}
                          <div style={{ fontSize: '15px', lineHeight: '1.6' }}>{T(v.od?.instructions)}</div>{' '}
                        </div>{' '}
                        <div style={{ borderTop: '1px solid var(--color-divider)' }}>
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
                                  <span style={{ fontWeight: '600' }}>{T(i?.name)}</span>{' '}
                                  <span style={{ color: 'var(--color-neutral-700)' }}>
                                    {'× '}
                                    {T(i?.quantity)}
                                  </span>
                                </span>
                                <span style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>{T(i?.lineText)}</span>
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
                            <span style={{ fontWeight: '600' }}>{T(v.od?.subtotalText)}</span>
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
                            <span style={{ fontWeight: '600' }}>{T(v.od?.shipText)}</span>
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
                            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>{'Ship to'}</div>
                            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{T(v.od?.shipTo)}</div>
                          </div>{' '}
                          {v.od?.hasNotes ? (
                            <>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>
                                  {'Notes'}
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{T(v.od?.notes)}</div>
                              </div>
                            </>
                          ) : null}{' '}
                        </div>{' '}
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <a
                            href={'#/shop'}
                            className="btn btn-primary"
                            style={{
                              padding: '14px 20px',
                              fontSize: '15px',
                              fontWeight: '600',
                              gap: '24px',
                              justifyContent: 'space-between',
                              whiteSpace: 'nowrap',
                              flex: 'none',
                            }}
                          >
                            {'Continue shopping '}
                            <span>{'→'}</span>
                          </a>
                          <a
                            href={'#/contact'}
                            className="sq5p0"
                            style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: 'var(--color-text)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '4px',
                              textDecorationThickness: '1px',
                            }}
                          >
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
                    style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,32px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        lineHeight: '1.15',
                        margin: '0',
                        marginBottom: '20px',
                      }}
                    >
                      {'Wishlist'}
                    </h1>{' '}
                    {v.wishEmpty ? (
                      <>
                        {' '}
                        <div
                          style={{
                            borderTop: '1px solid var(--color-divider)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            alignItems: 'flex-start',
                            padding: '32px 0',
                          }}
                        >
                          <p style={{ margin: '0', fontSize: '17px', fontWeight: '600' }}>{'Nothing saved yet.'}</p>
                          <p style={{ margin: '0', fontSize: '15px', color: 'var(--color-neutral-700)' }}>
                            {'Tap the heart on any product to save it here.'}
                          </p>
                          <a
                            href={'#/shop'}
                            className="sq5p0"
                            style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: 'var(--color-text)',
                              textDecoration: 'underline',
                              textUnderlineOffset: '4px',
                              textDecorationThickness: '1px',
                            }}
                          >
                            {'Browse all products'}
                          </a>
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: v.gridCols,
                        gap: `${S(v.gridGapV)} ${S(v.gridGap)}`,
                      }}
                    >
                      {' '}
                      {L(v.wishItems).map((p, $index) => (
                        <React.Fragment key={$index}>
                          <ProductCardV3 p={p} dense={v.denseCards} />
                        </React.Fragment>
                      ))}{' '}
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
                      maxWidth: '880px',
                      margin: '0 auto',
                      padding: v.pagePad,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,32px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        lineHeight: '1.15',
                        margin: '0',
                      }}
                    >
                      {'Account'}
                    </h1>{' '}
                    <p style={{ margin: '0', fontSize: '15px', lineHeight: '1.55', color: 'var(--color-neutral-800)' }}>
                      {
                        'You don’t need an account to order. Check out as a guest, and orders placed on this device appear below.'
                      }
                    </p>{' '}
                    <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0', marginTop: '14px' }}>
                      {'Your orders'}
                    </h2>{' '}
                    <div style={{ borderTop: '1px solid var(--color-divider)' }}>
                      {' '}
                      {L(v.myOrders).map((o, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <a
                            href={o?.href}
                            className="sq5p3"
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
                            <span style={{ fontWeight: '600' }}>{T(o?.id)}</span>
                            <span style={{ color: 'var(--color-neutral-700)' }}>{T(o?.date)}</span>
                            <span
                              style={{
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: o?.bg,
                                color: o?.fg,
                              }}
                            >
                              {T(o?.status)}
                            </span>
                            <span style={{ fontWeight: '600' }}>{T(o?.total)}</span>
                          </a>{' '}
                        </React.Fragment>
                      ))}{' '}
                      {v.noMyOrders ? (
                        <>
                          <p
                            style={{
                              padding: '14px 0',
                              margin: '0',
                              fontSize: '15px',
                              color: 'var(--color-neutral-700)',
                            }}
                          >
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
                  <div data-screen-label={'About'} style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}>
                    {' '}
                    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {' '}
                      <h1
                        style={{
                          fontSize: 'clamp(26px,3vw,32px)',
                          fontWeight: '700',
                          letterSpacing: '-.015em',
                          lineHeight: '1.15',
                          margin: '0',
                        }}
                      >
                        {'About SIDE QUEST'}
                      </h1>{' '}
                      <p style={{ margin: '0', fontSize: '18px', lineHeight: '1.55', textWrap: 'pretty' }}>
                        {
                          'SIDE QUEST is an independent online shop for Pokémon TCG and hobby collectors in the Philippines.'
                        }
                      </p>{' '}
                      <p
                        style={{
                          margin: '0',
                          fontSize: '16px',
                          lineHeight: '1.65',
                          color: 'var(--color-neutral-800)',
                          textWrap: 'pretty',
                        }}
                      >
                        {
                          'We sell Pokémon singles, graded cards and sealed product, along with accessories, plush and other collectibles. Single cards and graded slabs are listed as individual items, so the card you order is the card you receive.'
                        }
                      </p>{' '}
                      <p
                        style={{
                          margin: '0',
                          fontSize: '16px',
                          lineHeight: '1.65',
                          color: 'var(--color-neutral-800)',
                          textWrap: 'pretty',
                        }}
                      >
                        {
                          'We also buy and trade. If you’re looking for a specific card, or have cards you’d like to sell or trade, get in touch.'
                        }
                      </p>{' '}
                      <div
                        style={{
                          display: 'flex',
                          gap: '20px',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          marginTop: '8px',
                        }}
                      >
                        <a
                          href={'#/shop'}
                          className="btn btn-primary"
                          style={{
                            padding: '14px 20px',
                            fontSize: '15px',
                            fontWeight: '600',
                            gap: '24px',
                            justifyContent: 'space-between',
                            whiteSpace: 'nowrap',
                            flex: 'none',
                          }}
                        >
                          {'Shop now '}
                          <span>{'→'}</span>
                        </a>
                        <a
                          href={'#/contact'}
                          className="sq5p0"
                          style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--color-text)',
                            textDecoration: 'underline',
                            textUnderlineOffset: '4px',
                            textDecorationThickness: '1px',
                          }}
                        >
                          {'Contact us'}
                        </a>
                      </div>{' '}
                    </div>{' '}
                  </div>
                </>
              ) : null}

              {v.isContact ? (
                <>
                  {' '}
                  <div
                    data-screen-label={'Contact'}
                    style={{ maxWidth: '1280px', margin: '0 auto', padding: v.pagePad }}
                  >
                    {' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,32px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        lineHeight: '1.15',
                        margin: '0',
                        marginBottom: '20px',
                      }}
                    >
                      {'Contact us'}
                    </h1>{' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: v.contactCols,
                        gap: 'clamp(24px,5vw,64px)',
                        borderTop: '1px solid var(--color-divider)',
                        paddingTop: '24px',
                        alignItems: 'start',
                      }}
                    >
                      {' '}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '440px' }}>
                        {' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0' }}>{'Order questions'}</h2>
                          <p
                            style={{
                              margin: '0',
                              fontSize: '15px',
                              lineHeight: '1.55',
                              color: 'var(--color-neutral-800)',
                            }}
                          >
                            {'Include your order ID (for example SQ-ORD-1001) and we’ll get back to you.'}
                          </p>
                        </div>{' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0' }}>
                            {'Buying, selling or trading'}
                          </h2>
                          <p
                            style={{
                              margin: '0',
                              fontSize: '15px',
                              lineHeight: '1.55',
                              color: 'var(--color-neutral-800)',
                            }}
                          >
                            {
                              'Selling a collection or looking for a specific card? Tell us what you have or what you’re looking for.'
                            }
                          </p>
                        </div>{' '}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0' }}>{'Product questions'}</h2>
                          <p
                            style={{
                              margin: '0',
                              fontSize: '15px',
                              lineHeight: '1.55',
                              color: 'var(--color-neutral-800)',
                            }}
                          >
                            {'Ask for extra photos, condition details or grading information on any listing.'}
                          </p>
                        </div>{' '}
                      </div>{' '}
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          padding: 'clamp(20px,3vw,28px)',
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
                              <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0' }}>{'Message sent'}</h2>
                              <p style={{ margin: '0', fontSize: '15px' }}>
                                {'Thanks. Your message was sent to the SIDE QUEST inbox, and we’ll reply by email.'}
                              </p>
                              <button
                                onClick={v.ctReset}
                                className="btn sq5p5"
                                style={{
                                  padding: '12px 18px',
                                  fontSize: '15px',
                                  fontWeight: '600',
                                  border: '1px solid var(--color-text)',
                                  background: 'transparent',
                                  color: 'var(--color-text)',
                                }}
                              >
                                {'Send another message'}
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
                              style={{
                                padding: '14px 20px',
                                fontSize: '15px',
                                fontWeight: '600',
                                gap: '24px',
                                justifyContent: 'space-between',
                                whiteSpace: 'nowrap',
                                flex: 'none',
                              }}
                            >
                              {'Send message '}
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
                      maxWidth: '1280px',
                      margin: '0 auto',
                      padding: v.pagePad404,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {' '}
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-neutral-700)' }}>
                      {'404'}
                    </div>{' '}
                    <h1
                      style={{
                        fontSize: 'clamp(26px,3vw,34px)',
                        fontWeight: '700',
                        letterSpacing: '-.015em',
                        margin: '0',
                      }}
                    >
                      {'Page not found'}
                    </h1>{' '}
                    <p style={{ margin: '0', fontSize: '16px', color: 'var(--color-neutral-800)' }}>
                      {'The page may have moved, or the link is incomplete.'}
                    </p>{' '}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <a
                        href={'#/shop'}
                        className="btn btn-primary"
                        style={{
                          padding: '14px 20px',
                          fontSize: '15px',
                          fontWeight: '600',
                          gap: '24px',
                          justifyContent: 'space-between',
                          whiteSpace: 'nowrap',
                          flex: 'none',
                        }}
                      >
                        {'Shop all '}
                        <span>{'→'}</span>
                      </a>
                      <a
                        href={'#/'}
                        className="sq5p0"
                        style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: 'var(--color-text)',
                          textDecoration: 'underline',
                          textUnderlineOffset: '4px',
                          textDecorationThickness: '1px',
                        }}
                      >
                        {'Home'}
                      </a>
                    </div>{' '}
                  </div>
                </>
              ) : null}
            </main>

            <footer
              style={{
                borderTop: '1px solid var(--color-divider)',
                background: 'var(--color-bg)',
                paddingBottom: v.mainPadB,
              }}
            >
              {' '}
              <div
                style={{
                  maxWidth: '1280px',
                  margin: '0 auto',
                  padding: '40px clamp(16px,3vw,32px) 28px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                  gap: '28px',
                }}
              >
                {' '}
                <div>
                  <img
                    src={'/assets/sidequest-logo.png'}
                    alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                    style={{ width: '112px', height: 'auto', display: 'block' }}
                  />
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{'Shop'}</div>{' '}
                  {L(v.footShop).map((n, $index) => (
                    <React.Fragment key={$index}>
                      <a
                        href={n?.href}
                        className="sq5p0"
                        style={{ color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                      >
                        {T(n?.label)}
                      </a>
                    </React.Fragment>
                  ))}{' '}
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{'SIDE QUEST'}</div>{' '}
                  <a
                    href={'#/about'}
                    className="sq5p0"
                    style={{ color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                  >
                    {'About'}
                  </a>{' '}
                  <a
                    href={'#/contact'}
                    className="sq5p0"
                    style={{ color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                  >
                    {'Contact'}
                  </a>{' '}
                  <a
                    href={'#/account'}
                    className="sq5p0"
                    style={{ color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                  >
                    {'Your orders'}
                  </a>{' '}
                </div>{' '}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  {' '}
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{'Payments'}</div>{' '}
                  <span style={{ color: 'var(--color-neutral-800)' }}>{'GCash · Bank transfer'}</span>{' '}
                  <span style={{ color: 'var(--color-neutral-800)' }}>{'Prices in Philippine Peso (₱)'}</span>{' '}
                </div>{' '}
              </div>{' '}
              <div style={{ borderTop: '1px solid var(--color-divider)' }}>
                {' '}
                <div
                  style={{
                    maxWidth: '1280px',
                    margin: '0 auto',
                    padding: '14px clamp(16px,3vw,32px)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: 'var(--color-neutral-700)',
                  }}
                >
                  <span>{'© 2026 SIDE QUEST'}</span>
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
                  aria-label={'Primary'}
                  style={{
                    position: 'fixed',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    zIndex: '40',
                    background: 'var(--color-bg)',
                    borderTop: '1px solid var(--color-divider)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5,1fr)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                  }}
                >
                  {' '}
                  <a
                    href={'#/'}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.bn?.home,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '28%',
                        right: '28%',
                        height: '2px',
                        background: v.bnBar?.home,
                      }}
                    ></span>
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'1.8'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'}></path>
                      <path d={'M9 22V12h6v10'}></path>
                    </svg>
                    {'Home'}
                  </a>{' '}
                  <a
                    href={'#/shop'}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.bn?.shop,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '28%',
                        right: '28%',
                        height: '2px',
                        background: v.bnBar?.shop,
                      }}
                    ></span>
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'1.8'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7'}></path>
                      <path d={'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'}></path>
                      <path d={'M2 7h20'}></path>
                    </svg>
                    {'Shop'}
                  </a>{' '}
                  <button
                    onClick={v.focusSearch}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.bn?.search,
                      border: '0',
                      background: 'transparent',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '28%',
                        right: '28%',
                        height: '2px',
                        background: v.bnBar?.search,
                      }}
                    ></span>
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'1.8'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <circle cx={'11'} cy={'11'} r={'8'}></circle>
                      <path d={'m21 21-4.3-4.3'}></path>
                    </svg>
                    {'Search'}
                  </button>{' '}
                  <a
                    href={'#/wishlist'}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.bn?.wish,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '28%',
                        right: '28%',
                        height: '2px',
                        background: v.bnBar?.wish,
                      }}
                    ></span>
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'1.8'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path
                        d={
                          'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
                        }
                      ></path>
                    </svg>
                    {'Wishlist'}
                  </a>{' '}
                  <a
                    href={'#/account'}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      minHeight: '58px',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.bn?.acct,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '28%',
                        right: '28%',
                        height: '2px',
                        background: v.bnBar?.acct,
                      }}
                    ></span>
                    <svg
                      width={'22'}
                      height={'22'}
                      viewBox={'0 0 24 24'}
                      fill={'none'}
                      stroke={'currentColor'}
                      strokeWidth={'1.8'}
                      strokeLinecap={'round'}
                      strokeLinejoin={'round'}
                    >
                      <path d={'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}></path>
                      <circle cx={'12'} cy={'7'} r={'4'}></circle>
                    </svg>
                    {'Account'}
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
                    background: 'color-mix(in srgb, var(--color-neutral-900) 45%, transparent)',
                  }}
                >
                  {' '}
                  <div
                    onClick={v.stop}
                    style={{
                      width: 'min(340px,86%)',
                      height: '100%',
                      overflowY: 'auto',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 8px 8px 16px',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      <img
                        src={'/assets/sidequest-logo.png'}
                        alt={'SIDE QUEST'}
                        style={{ height: '40px', width: 'auto' }}
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
                          cursor: 'pointer',
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
                            alignItems: 'center',
                            minHeight: '52px',
                            padding: '0 20px',
                            borderBottom: '1px solid var(--color-divider)',
                            fontWeight: '600',
                            fontSize: '16px',
                            textDecoration: 'none',
                            color: n?.color,
                          }}
                        >
                          {T(n?.label)}
                        </a>{' '}
                      </React.Fragment>
                    ))}{' '}
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 20px', fontSize: '15px' }}>
                      {' '}
                      <a
                        href={'#/about'}
                        style={{ padding: '11px 0', color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                      >
                        {'About'}
                      </a>{' '}
                      <a
                        href={'#/contact'}
                        style={{ padding: '11px 0', color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                      >
                        {'Contact'}
                      </a>{' '}
                      <a
                        href={'#/account'}
                        style={{ padding: '11px 0', color: 'var(--color-neutral-800)', textDecoration: 'none' }}
                      >
                        {'Your orders'}
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
                    style={{
                      color: 'var(--sq-gold)',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                    }}
                  >
                    {'View cart'}
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
