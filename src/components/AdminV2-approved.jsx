// SIDE QUEST — AdminV2 (Command Center)
// Drop into src/components/. Requires: ./dc-compat.js, ./ProductImage.jsx, and window.SQStore / window.SQView (already loaded by main.jsx).
// Uses the existing store service for every read/write — no new database calls or write paths.
// NOT yet wired into StoreApp.jsx; mount with <AdminV2 tab="dashboard" onToast={fn} /> when integrating.
// Ported from Admin v2.dc.html (approved Admin v2 design) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import ProductImage from './ProductImage.jsx';

// Admin-only CSS (skeleton pulse + hover/focus states). Injected once; prefixed so it can't collide with storefront styles.
const ADMIN_V2_CSS = "@keyframes sqpulse{0%,100%{opacity:1}50%{opacity:.45}}\n.sqa2p0:hover{background:var(--color-neutral-200) !important}\n.sqa2p1:hover{background:var(--color-neutral-200) !important;color:var(--color-text) !important}\n.sqa2p2:hover{border-color:var(--color-text) !important}\n.sqa2p3:hover{background:var(--color-surface) !important}\n.sqa2p4:hover{background:var(--color-surface) !important;color:var(--color-text) !important}\n.sqa2p5:hover{border-color:var(--color-accent) !important}";
if (typeof document !== 'undefined' && !document.getElementById('sq-admin-v2-css')) {
  const el = document.createElement('style'); el.id = 'sq-admin-v2-css'; el.textContent = ADMIN_V2_CSS; document.head.appendChild(el);
}

const IC = {
  dash: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  inv: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  orders: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4',
  cust: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  mkt: 'M2 5h20v14H2zM2 7l10 6 10-6',
  store: 'M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8M10 21v-5h4v5',
  set: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  tag: 'M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4zM7 7h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
};
const TABS = ['dashboard', 'inventory', 'orders', 'customers', 'marketing', 'store', 'settings'];
const TAB_META = {
  dashboard: ['Command Center', 'Your SIDE QUEST business at a glance.'],
  inventory: ['Inventory', 'Every physical unit is its own inventory row.'],
  orders: ['Orders', 'Payment, fulfilment and holds for every order.'],
  customers: ['Customers', 'Who is buying from SIDE QUEST.'],
  marketing: ['Marketing', 'Collector Club and customer communication.'],
  store: ['Store', 'What the storefront shows right now.'],
  settings: ['Settings', 'Store configuration and your account.'],
};
const SB_KEY = 'sq_admin_sidebar_collapsed';
const ORDER_GROUPS = {
  all: null,
  awaiting: ['PENDING', 'PAYMENT_PENDING'],
  fulfil: ['PAID', 'PROCESSING', 'PACKED'],
  shipped: ['SHIPPED'],
  closed: ['COMPLETED', 'CANCELLED', 'REFUNDED'],
};

export default class AdminV2 extends React.Component {
  state = {
    edit: null,
    editErr: '',
    orderView: null,
    adminQ: '',
    saving: false,
    itemImgType: 'FRONT',
    loginEmail: '',
    loginPw: '',
    loginMsg: '',
    loginOk: false,
    loginBusy: false,
    vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
    vh: typeof window !== 'undefined' ? window.innerHeight : 900,
    hash: typeof location !== 'undefined' ? location.hash : '',
    collapsed: null,
    menuOpen: false,
    fCat: '',
    fStatus: '',
    fAvail: '',
    fSort: 'updated',
    oQ: '',
    oGroup: 'all',
    confirm: null,
    toast: '',
    now: Date.now(),
  };
  resize(file, cb) {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1600 / Math.max(img.width, img.height)),
          c = document.createElement('canvas');
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((blob) => cb({ blob, dataUrl: c.toDataURL('image/jpeg', 0.85) }), 'image/jpeg', 0.85);
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  act(p, okMsg) {
    return Promise.resolve(p).then((res) => {
      this.showToast(res && res.ok ? okMsg : (res && res.msg) || 'Something went wrong.');
      return res;
    });
  }
  componentDidMount() {
    let c = null;
    try {
      const v = localStorage.getItem(SB_KEY);
      if (v !== null) c = v === '1';
    } catch (e) {}
    this.setState({ collapsed: c });
    this.onResize = () => this.setState({ vw: window.innerWidth, vh: window.innerHeight });
    this.onHash = () => this.setState({ hash: location.hash, menuOpen: false, orderView: null, edit: null });
    window.addEventListener('resize', this.onResize);
    window.addEventListener('hashchange', this.onHash);
    this.clock = setInterval(() => this.setState({ now: Date.now() }), 30000);
    this.tryInit();
  }
  tryInit = () => {
    const S = window.SQStore;
    if (S && window.SQ_SEED && window.SQView) {
      S.init(window.SQ_SEED);
      if (!this.unsub) this.unsub = S.subscribe(() => this.forceUpdate());
      this.forceUpdate();
    } else this.initT = setTimeout(this.tryInit, 40);
  };
  componentWillUnmount() {
    clearTimeout(this.initT);
    clearTimeout(this.toastT);
    clearInterval(this.clock);
    if (this.unsub) this.unsub();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('hashchange', this.onHash);
  }
  componentDidUpdate(pp) {
    if (pp.tab !== this.props.tab && (this.state.orderView || this.state.edit))
      this.setState({ orderView: null, edit: null });
  }
  showToast(m) {
    if (this.props.onToast) return this.props.onToast(m);
    clearTimeout(this.toastT);
    this.setState({ toast: m });
    this.toastT = setTimeout(() => this.setState({ toast: '' }), 2800);
  }
  ask(title, body, label, run) {
    this.setState({ confirm: { title, body, label, run } });
  }
  go(tab) {
    const h = tab === 'dashboard' ? '#/admin' : '#/admin/' + tab;
    if (location.hash !== h) location.hash = h;
    else this.setState({ hash: h });
  }
  currentTab() {
    const m = (this.state.hash || '').match(/^#\/admin\/?([a-z]*)/);
    if (m) return TABS.includes(m[1]) ? m[1] : 'dashboard';
    return TABS.includes(this.props.tab) ? this.props.tab : 'dashboard';
  }
  rel(t) {
    const d = (this.state.now - new Date(t).getTime()) / 60000;
    if (!isFinite(d)) return '';
    if (d < 1) return 'just now';
    if (d < 60) return Math.round(d) + 'm ago';
    if (d < 1440) return Math.round(d / 60) + 'h ago';
    if (d < 10080) return Math.round(d / 1440) + 'd ago';
    return SQView.fmtDate(t);
  }

  renderVals() {
    const S = window.SQStore,
      st = this.state;
    const v = { stop: (e) => e.stopPropagation(), toast: st.toast, hasToast: !!st.toast };
    if (!S || !window.SQView || !this.unsub) return Object.assign(v, { skeleton: true });
    v.isLocal = S.backend !== 'supabase';
    const A = S.auth;
    v.canSignOut = !!A;
    v.signOut = () => A && A.signOut();
    if (A) {
      if (!A.ready()) return Object.assign(v, { skeleton: true });
      if (!A.user()) {
        const doLogin = () => {
          if (this.state.loginBusy) return;
          this.setState({ loginBusy: true, loginMsg: '' });
          A.signIn(this.state.loginEmail.trim(), this.state.loginPw).then((r) =>
            this.setState({
              loginBusy: false,
              loginOk: false,
              loginMsg: r.ok ? '' : r.msg,
              loginPw: r.ok ? '' : this.state.loginPw,
            }),
          );
        };
        return Object.assign(v, {
          gateLogin: true,
          loginEmail: st.loginEmail,
          loginPw: st.loginPw,
          loginLabel: st.loginBusy ? 'SIGNING IN…' : 'SIGN IN',
          onLoginEmail: (e) => this.setState({ loginEmail: e.target.value }),
          onLoginPw: (e) => this.setState({ loginPw: e.target.value }),
          onLoginKey: (e) => {
            if (e.key === 'Enter') doLogin();
          },
          doLogin,
          doReset: () => {
            const em = this.state.loginEmail.trim();
            if (!em) return this.setState({ loginMsg: 'Enter your email first.', loginOk: false });
            A.sendPasswordReset(em).then((r) =>
              this.setState({ loginMsg: r.ok ? 'Check your email for a reset link.' : r.msg, loginOk: r.ok }),
            );
          },
          hasLoginMsg: !!st.loginMsg,
          loginMsg: st.loginMsg,
          loginMsgBg: st.loginOk ? 'var(--color-neutral-200)' : 'var(--color-accent-100)',
          loginMsgFg: st.loginOk ? 'var(--color-text)' : 'var(--color-accent-800)',
        });
      }
      v.userEmail = A.user().email;
      if (!A.isAdmin()) return Object.assign(v, { gateDenied: true });
      const prof = A.profile() || {};
      v.roleLabel =
        { OWNER: 'Owner', STAFF: 'Staff' }[String(prof.role || '').toUpperCase()] || 'Admin · role not loaded';
    } else {
      v.userEmail = 'Local admin';
      v.roleLabel = 'Local demo';
    }
    v.initials =
      (v.userEmail || 'SQ')
        .replace(/[^a-z]/gi, '')
        .slice(0, 2)
        .toUpperCase() || 'SQ';
    v.dbDot = v.isLocal ? 'var(--color-accent)' : 'var(--color-text)';
    v.dbLabel = v.isLocal ? 'Local demo' : 'Live database';
    v.shell = true;
    this.layoutVals(v);
    this.adminVals(v, S, this.currentTab());
    return v;
  }

  layoutVals(v) {
    const st = this.state,
      vw = st.vw,
      mobile = vw < 768,
      tablet = vw >= 768 && vw < 1100,
      short = (st.vh || 900) < 720;
    const collapsed = st.collapsed === null ? tablet || !!this.props.startCollapsed : st.collapsed;
    const sbW = mobile ? 0 : collapsed ? 76 : 248;
    Object.assign(v, {
      isMobile: mobile,
      showSidebar: !mobile,
      sbOpen: !collapsed,
      sbClosed: collapsed,
      sbW,
      sbPad: collapsed ? 16 : 20,
      sbInset: 12,
      sbItemPad: collapsed ? 14 : 12,
      sbItemH: short ? 38 : 44,
      sbNavPadY: short ? 10 : 16,
      sbDivM: short ? 8 : 14,
      sbFootPadY: short ? 10 : 14,
      sbFootGap: short ? 8 : 10,
      sbHeadDir: collapsed ? 'column' : 'row',
      sbHeadPadY: short ? 10 : 14,
      sbLogoH: short ? 40 : 48,
      kpiCols: mobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fit,minmax(min(100%,168px),1fr))',
      kpiPad: mobile ? '14px 14px 12px' : '18px 20px 16px',
      kpiGap: mobile ? 8 : 10,
      metaAlign: mobile ? 'flex-start' : 'flex-end',
      sbToggleLabel: collapsed ? 'Expand sidebar' : 'Collapse sidebar',
      toggleSidebar: () => {
        const n = !collapsed;
        try {
          localStorage.setItem(SB_KEY, n ? '1' : '0');
        } catch (e) {}
        this.setState({ collapsed: n });
      },
      wideTable: vw - sbW >= 880,
      narrowTable: vw - sbW < 880,
      menuOpen: mobile && st.menuOpen,
      openMenu: () => this.setState({ menuOpen: true }),
      closeMenu: () => this.setState({ menuOpen: false }),
      nowText: new Date(st.now).toLocaleString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    });
  }

  adminVals(v, S, tab) {
    const st = this.state,
      allP = S.products({ includeInactive: true }),
      orders = S.orders()
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const pLabel = (s) => ({ ACTIVE: 'PUBLISHED', DRAFT: 'DRAFT', ARCHIVED: 'ARCHIVED' })[s] || s;
    const awaitingN = orders.filter((o) => ORDER_GROUPS.awaiting.includes(o.order_status)).length;
    const mk = (k, label, icon, count) => ({
      label,
      href: k === 'dashboard' ? '#/admin' : '#/admin/' + k,
      icon,
      active: tab === k,
      idle: tab !== k,
      hasCount: !!count,
      count,
      bg: tab === k ? 'var(--color-text)' : 'transparent',
      fg: tab === k ? 'var(--color-bg)' : 'var(--color-text)',
    });
    v.navMain = [
      mk('dashboard', 'Dashboard', IC.dash),
      mk('inventory', 'Inventory', IC.inv),
      mk('orders', 'Orders', IC.orders, awaitingN),
      mk('customers', 'Customers', IC.cust),
      mk('marketing', 'Marketing', IC.mkt),
      mk('store', 'Store', IC.store),
    ];
    v.navSys = [mk('settings', 'Settings', IC.set)];
    v.navAll = v.navMain.concat(v.navSys);
    TABS.forEach((t) => {
      v[
        'is' +
          {
            dashboard: 'Dash',
            inventory: 'Inv',
            orders: 'Orders',
            customers: 'Customers',
            marketing: 'Marketing',
            store: 'Store',
            settings: 'Settings',
          }[t]
      ] = tab === t;
    });
    const [title, sub] = TAB_META[tab];
    v.pageTitle = title;
    v.pageSub = sub;
    v.tabLabel = title;
    v.kicker = tab === 'dashboard' ? 'SIDE QUEST HQ' : 'COMMAND CENTER · ' + title.toUpperCase();

    const open = (id) => () => this.setState({ orderView: id });
    const orderRow = (o) => {
      const s = SQView.statusStyle(o.order_status),
        ps = SQView.statusStyle(o.payment_status);
      return {
        id: o.order_id,
        date: SQView.fmtDate(o.created_at),
        customer: o.customer_information.name,
        email: o.customer_information.email,
        itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
        total: SQView.peso(o.total) + (o.shipping_confirmed ? '' : ' + ship'),
        status: SQView.label(o.order_status),
        bg: s.bg,
        fg: s.fg,
        payStatus: SQView.label(o.payment_status),
        pBg: ps.bg,
        pFg: ps.fg,
        method: SQView.PAY[o.payment_method] || o.payment_method,
        onView: open(o.order_id),
      };
    };
    const invRow = (p) => {
      const s = SQView.statusStyle(p.status),
        arch = p.status === 'ARCHIVED',
        av = p.available_quantity,
        out = av <= 0;
      return {
        image: SQView.imgVM(p),
        name: p.name,
        sku: p.sku,
        type: SQView.TYPES[p.product_type],
        cat: SQView.catName(p.category),
        price: SQView.peso(p.price),
        hasSale: S.isOnSale(p),
        salePrice: SQView.peso(p.sale_price),
        statusLabel: pLabel(p.status),
        stBg: s.bg,
        stFg: s.fg,
        featured: !!p.featured,
        availText: arch ? '—' : out ? (p.reserved_quantity > 0 ? 'All reserved' : 'Sold out') : av + ' available',
        availColor: !arch && out ? 'var(--color-accent-700)' : 'var(--color-text)',
        unitText:
          p.reserved_quantity > 0
            ? p.reserved_quantity + ' reserved · ' + p.quantity + ' on hand'
            : p.quantity + ' on hand',
        op: arch ? 0.55 : 1,
        archiveLabel: arch ? 'Restore' : 'Archive',
        onEdit: () => this.openEdit(p.product_id),
        onArchive: () =>
          arch
            ? this.act(S.setProductStatus(p.product_id, 'DRAFT'), 'Restored as draft')
            : this.ask(
                'Archive product?',
                'This will remove “' +
                  p.name +
                  '” from active inventory and the storefront. You can restore it as a draft later.',
                'Archive',
                () => this.act(S.setProductStatus(p.product_id, 'ARCHIVED'), 'Archived'),
              ),
      };
    };
    v.openNew = () =>
      this.setState({
        editErr: '',
        menuOpen: false,
        edit: {
          isNew: true,
          d: {
            product_id: '',
            sku: '',
            name: '',
            category: 'pokemon',
            subcategory: '',
            description: '',
            pokemon: '',
            set: '',
            card_number: '',
            language: 'English',
            condition: 'NM',
            product_type: 'SINGLE',
            grading_company: '',
            grade: null,
            price: '',
            cost: '',
            sale_price: null,
            quantity: 1,
            reserved_quantity: 0,
            images: [],
            tags: [],
            featured: false,
            sale: false,
            status: 'DRAFT',
            track_items: true,
          },
        },
      });

    const active = allP.filter((p) => p.status === 'ACTIVE'),
      drafts = allP.filter((p) => p.status === 'DRAFT'),
      archived = allP.filter((p) => p.status === 'ARCHIVED');
    const tsOf = (p) => p.updated_at || p.created_at || '';

    if (tab === 'dashboard') {
      const openOrders = orders.filter((o) => !ORDER_GROUPS.closed.includes(o.order_status));
      const paid = orders.filter((o) => o.payment_status === 'PAID');
      const holds = orders.filter((o) => o.stock === 'RESERVED' && o.payment_status !== 'PAID');
      const availU = active.reduce((s, p) => s + Math.max(0, p.available_quantity), 0);
      const resU = allP.filter((p) => p.status !== 'ARCHIVED').reduce((s, p) => s + (p.reserved_quantity || 0), 0);
      v.kpis = [
        {
          label: 'ACTIVE LISTINGS',
          icon: IC.tag,
          value: active.length,
          sub: drafts.length + ' draft · ' + archived.length + ' archived',
        },
        { label: 'AVAILABLE UNITS', icon: IC.inv, value: availU, sub: 'Ready to sell now' },
        {
          label: 'RESERVED',
          icon: IC.clock,
          value: resU,
          sub: holds.length
            ? 'Held by ' + holds.length + ' unpaid order' + (holds.length === 1 ? '' : 's')
            : 'No active holds',
        },
        { label: 'OPEN ORDERS', icon: IC.orders, value: openOrders.length, sub: orders.length + ' all time' },
        {
          span: 'auto',
          label: 'SALES',
          icon: IC.trend,
          value: SQView.peso(paid.reduce((s, o) => s + o.total, 0)),
          sub: paid.length
            ? 'From ' + paid.length + ' paid order' + (paid.length === 1 ? '' : 's')
            : 'No paid orders yet',
        },
      ];
      v.kpis = v.kpis.map((k, i) => ({ ...k, span: v.isMobile && i === v.kpis.length - 1 ? '1 / -1' : 'auto' }));
      v.recentOrders = orders.slice(0, 5).map(orderRow);
      v.noOrders = !orders.length;
      v.invSnap = allP
        .filter((p) => p.status !== 'ARCHIVED')
        .sort((a, b) => String(tsOf(b)).localeCompare(String(tsOf(a))))
        .slice(0, 5)
        .map(invRow);
      v.noProducts = !v.invSnap.length;
      const soon = Date.now() + 6 * 3600e3;
      const att = [
        {
          n: orders.filter((o) => o.payment_status === 'PENDING_VERIFICATION').length,
          title: 'Payments to verify',
          sub: 'Customer says they paid. Check GCash or bank.',
          tab: 'orders',
          group: 'awaiting',
          c: 'gold',
        },
        {
          n: holds.filter((o) => o.expires_at && new Date(o.expires_at).getTime() < soon).length,
          title: 'Holds expiring within 6 hours',
          sub: 'Unpaid orders auto-cancel at the deadline.',
          tab: 'orders',
          group: 'awaiting',
          c: 'red',
        },
        {
          n: orders.filter((o) => ORDER_GROUPS.fulfil.includes(o.order_status)).length,
          title: 'Orders to pack or ship',
          sub: 'Paid and waiting for fulfilment.',
          tab: 'orders',
          group: 'fulfil',
          c: 'ink',
        },
        {
          n: active.filter((p) => p.available_quantity <= 0).length,
          title: 'Published but unavailable',
          sub: 'Sold out or fully reserved listings.',
          tab: 'inventory',
          avail: 'out',
          status: 'ACTIVE',
          c: 'soft',
        },
        {
          n: drafts.length,
          title: 'Drafts not yet published',
          sub: 'Hidden from the storefront.',
          tab: 'inventory',
          status: 'DRAFT',
          c: 'soft',
        },
      ].filter((a) => a.n > 0);
      const col = {
        gold: ['var(--sq-gold)', 'var(--color-text)'],
        red: ['var(--color-accent)', '#fff'],
        ink: ['var(--color-text)', 'var(--color-bg)'],
        soft: ['var(--color-neutral-200)', 'var(--color-text)'],
      };
      v.attention = att.map((a) => ({
        count: a.n,
        title: a.title,
        sub: a.sub,
        bg: col[a.c][0],
        fg: col[a.c][1],
        href: '#/admin/' + a.tab,
        onGo: () =>
          this.setState(
            a.tab === 'orders'
              ? { oGroup: a.group }
              : { fStatus: a.status || '', fAvail: a.avail || '', fCat: '', adminQ: '' },
          ),
      }));
      v.allClear = !att.length;
      const ev = [];
      orders.forEach((o) => {
        ev.push({
          t: o.created_at,
          event: 'Order placed',
          ref: o.order_id + ' · ' + o.customer_information.name + ' · ' + SQView.peso(o.total),
          dot: 'var(--color-accent)',
        });
        if (o.updated_at && new Date(o.updated_at) - new Date(o.created_at) > 60000)
          ev.push({
            t: o.updated_at,
            event: 'Order ' + SQView.label(o.order_status).toLowerCase(),
            ref: o.order_id + ' · payment ' + SQView.label(o.payment_status).toLowerCase(),
            dot: 'var(--color-text)',
          });
      });
      if (typeof S.orderEvents === 'function')
        S.orderEvents().forEach((e) =>
          ev.push({
            t: e.created_at,
            event: e.field === 'expires_at' ? 'Hold extended' : 'Order updated',
            ref: e.order_id + (e.notes ? ' · ' + e.notes : ''),
            dot: 'var(--sq-gold)',
          }),
        );
      allP.forEach((p) => {
        if (p.created_at)
          ev.push({ t: p.created_at, event: 'Product added', ref: p.name, dot: 'var(--color-neutral-500)' });
        if (p.updated_at && p.created_at && new Date(p.updated_at) - new Date(p.created_at) > 60000)
          ev.push({
            t: p.updated_at,
            event:
              p.status === 'ARCHIVED'
                ? 'Product archived'
                : p.status === 'ACTIVE'
                  ? 'Listing updated'
                  : 'Draft updated',
            ref: p.name,
            dot: 'var(--color-neutral-500)',
          });
      });
      v.activity = ev
        .filter((e) => e.t)
        .sort((a, b) => new Date(b.t) - new Date(a.t))
        .slice(0, 8)
        .map((e) => ({ ...e, when: this.rel(e.t) }));
      v.noActivity = !v.activity.length;
    }

    if (tab === 'inventory') {
      const aq = st.adminQ.trim().toLowerCase();
      v.adminQ = st.adminQ;
      v.onAdminQ = (e) => this.setState({ adminQ: e.target.value });
      v.resetDemo = () =>
        this.ask(
          'Reset demo data?',
          'Products, orders, cart and wishlist in this browser go back to the starting demo set. This only affects the local demo backend.',
          'Reset',
          () => {
            S.resetDemoData();
            this.showToast('Demo data restored');
          },
        );
      const set = (k) => (e) => this.setState({ [k]: e.target.value });
      v.invFilters = [
        {
          label: 'Category',
          value: st.fCat,
          onChange: set('fCat'),
          options: [{ v: '', l: 'All categories' }, ...S.categories().map((c) => ({ v: c.category_id, l: c.label }))],
        },
        {
          label: 'Status',
          value: st.fStatus,
          onChange: set('fStatus'),
          options: [
            ['', 'All statuses'],
            ['ACTIVE', 'Published'],
            ['DRAFT', 'Draft'],
            ['ARCHIVED', 'Archived'],
          ].map(([a, b]) => ({ v: a, l: b })),
        },
        {
          label: 'Availability',
          value: st.fAvail,
          onChange: set('fAvail'),
          options: [
            ['', 'Any availability'],
            ['avail', 'Available'],
            ['reserved', 'Has reserved units'],
            ['out', 'Sold out / fully reserved'],
          ].map(([a, b]) => ({ v: a, l: b })),
        },
        {
          label: 'Sort',
          value: st.fSort,
          onChange: set('fSort'),
          options: [
            ['updated', 'Recently updated'],
            ['name', 'Name A–Z'],
            ['priceDesc', 'Price high → low'],
            ['priceAsc', 'Price low → high'],
            ['avail', 'Most available'],
          ].map(([a, b]) => ({ v: a, l: b })),
        },
      ];
      let list = allP.filter(
        (p) =>
          (!aq || [p.sku, p.name, p.set, p.pokemon].join(' ').toLowerCase().includes(aq)) &&
          (!st.fCat || p.category === st.fCat) &&
          (!st.fStatus || p.status === st.fStatus) &&
          (!st.fAvail ||
            (st.fAvail === 'avail'
              ? p.available_quantity > 0
              : st.fAvail === 'reserved'
                ? p.reserved_quantity > 0
                : p.available_quantity <= 0 && p.status !== 'ARCHIVED')),
      );
      const cmp = {
        updated: (a, b) => String(tsOf(b)).localeCompare(String(tsOf(a))),
        name: (a, b) => a.name.localeCompare(b.name),
        priceDesc: (a, b) => b.price - a.price,
        priceAsc: (a, b) => a.price - b.price,
        avail: (a, b) => b.available_quantity - a.available_quantity,
      }[st.fSort];
      if (cmp) list = list.slice().sort(cmp);
      v.invRows = list.map(invRow);
      v.hasInvFilters = !!(aq || st.fCat || st.fStatus || st.fAvail);
      v.clearInvFilters = () => this.setState({ adminQ: '', fCat: '', fStatus: '', fAvail: '', fSort: 'updated' });
      v.invCountText = list.length + ' of ' + allP.length + ' product' + (allP.length === 1 ? '' : 's');
      v.invEmpty = !list.length;
      v.invEmptyTitle = allP.length ? 'No products match these filters.' : 'No products yet.';
      v.invEmptySub = allP.length
        ? 'Try a different search or clear the filters.'
        : 'Add your first listing to open the store.';
      if (!list.length) {
        v.wideTable = false;
        v.narrowTable = false;
      }
    }

    if (tab === 'orders') {
      const q = st.oQ.trim().toLowerCase();
      v.oQ = st.oQ;
      v.onOQ = (e) => this.setState({ oQ: e.target.value });
      v.orderTabs = [
        ['all', 'All'],
        ['awaiting', 'Awaiting payment'],
        ['fulfil', 'To fulfil'],
        ['shipped', 'Shipped'],
        ['closed', 'Closed'],
      ].map(([k, l]) => {
        const g = ORDER_GROUPS[k],
          on = st.oGroup === k;
        return {
          label: l,
          count: g ? orders.filter((o) => g.includes(o.order_status)).length : orders.length,
          on,
          bg: on ? 'var(--color-text)' : 'var(--color-bg)',
          fg: on ? 'var(--color-bg)' : 'var(--color-text)',
          onClick: () => this.setState({ oGroup: k }),
        };
      });
      const g = ORDER_GROUPS[st.oGroup];
      const list = orders.filter(
        (o) =>
          (!g || g.includes(o.order_status)) &&
          (!q ||
            [o.order_id, o.customer_information.name, o.customer_information.email]
              .join(' ')
              .toLowerCase()
              .includes(q)),
      );
      v.orderRows = list.map(orderRow);
      v.ordersEmpty = !list.length;
      v.ordersEmptyTitle = orders.length ? 'No orders match.' : 'No orders yet.';
      v.ordersEmptySub = orders.length ? 'Try another status or search.' : 'Your store is ready for its first order.';
      if (!list.length) {
        v.wideTable = false;
        v.narrowTable = false;
      }
    }

    if (tab === 'customers') {
      const m = {};
      orders.forEach((o) => {
        const ci = o.customer_information || {},
          k = (ci.email || ci.name || '').toLowerCase();
        if (!k) return;
        const c =
          m[k] || (m[k] = { name: ci.name, email: ci.email, n: 0, paid: 0, first: o.created_at, last: o.created_at });
        c.n++;
        if (o.payment_status === 'PAID') c.paid += o.total;
        if (o.created_at < c.first) c.first = o.created_at;
        if (o.created_at > c.last) c.last = o.created_at;
      });
      v.customerRows = Object.values(m)
        .sort((a, b) => String(b.last).localeCompare(String(a.last)))
        .map((c) => ({
          name: c.name,
          email: c.email,
          orders: c.n,
          paid: SQView.peso(c.paid),
          first: SQView.fmtDate(c.first),
          last: SQView.fmtDate(c.last),
        }));
      v.hasCustomers = v.customerRows.length > 0;
      v.noCustomers = !v.hasCustomers;
    }

    if (tab === 'marketing') {
      v.mktCells = [
        {
          label: 'SUBSCRIBERS',
          title: 'Collector Club members',
          sub: 'Your SIDE QUEST Collector Club will appear here.',
        },
        { label: 'CONSENT', title: 'Marketing consent', sub: 'Opt-in captured at checkout, with date and source.' },
        { label: 'OFFER', title: '10% off first purchase', sub: 'Single-use code issued when a customer joins.' },
        { label: 'CAMPAIGNS', title: 'Email campaigns', sub: 'Compose and schedule sends to members.' },
        { label: 'FRESH DROPS', title: 'New arrival alerts', sub: 'Notify members when new listings go live.' },
        { label: 'RESTOCKS', title: 'Restock alerts', sub: 'Tell wishlisters when a card is back.' },
      ];
    }

    if (tab === 'store') {
      const toInv = (s) => () => {
        this.setState({ fStatus: s, fAvail: '', fCat: '', adminQ: '' });
        this.go('inventory');
      };
      v.visCells = [
        { label: 'PUBLISHED', value: active.length, sub: 'Visible in the shop', onClick: toInv('ACTIVE') },
        { label: 'DRAFT', value: drafts.length, sub: 'Hidden, not yet published', onClick: toInv('DRAFT') },
        { label: 'ARCHIVED', value: archived.length, sub: 'Removed from inventory', onClick: toInv('ARCHIVED') },
      ];
      const row = (p) => ({
        image: SQView.imgVM(p),
        name: p.name,
        meta:
          SQView.catName(p.category) +
          ' · ' +
          (S.isOnSale(p) ? SQView.peso(p.sale_price) + ' (was ' + SQView.peso(p.price) + ')' : SQView.peso(p.price)) +
          ' · ' +
          pLabel(p.status).toLowerCase(),
        onEdit: () => this.openEdit(p.product_id),
      });
      const feat = allP.filter((p) => p.featured && p.status !== 'ARCHIVED'),
        sale = allP.filter((p) => p.sale && p.status !== 'ARCHIVED');
      v.storeLists = [
        {
          title: 'Featured on homepage',
          hint: 'Set “Featured” in the product editor',
          rows: feat.map(row),
          empty: !feat.length,
          emptyText: 'No featured products. The homepage shows its default selection.',
        },
        {
          title: 'On sale',
          hint: 'Set “On sale” and a sale price',
          rows: sale.map(row),
          empty: !sale.length,
          emptyText: 'No products are on sale.',
        },
      ];
    }

    if (tab === 'settings') {
      const SET = S.SETTINGS;
      v.settingsGroups = [
        {
          title: 'Account',
          rows: [
            { k: 'Signed in as', v: v.userEmail },
            { k: 'Role', v: v.roleLabel },
            { k: 'Database', v: v.dbLabel },
          ],
        },
        {
          title: 'Checkout',
          rows: [
            { k: 'Payment methods', v: (SET.enabled_payment_methods || []).map((m) => SQView.PAY[m] || m).join(' · ') },
            { k: 'Currency', v: SET.currency },
            { k: 'Shipping fee', v: SET.shipping ? 'Automatic by region' : 'Confirmed manually after checkout' },
          ],
        },
        {
          title: 'Reservations',
          rows: [
            { k: 'Unpaid order hold', v: SET.reservation_hours + ' hours, then auto-cancel' },
            { k: 'Extend hold', v: '+24h per admin action, recorded in the audit log' },
          ],
        },
      ];
    }

    const cf = st.confirm;
    v.confirming = !!cf;
    if (cf)
      Object.assign(v, {
        confirmTitle: cf.title,
        confirmBody: cf.body,
        confirmLabel: cf.label,
        cancelConfirm: () => this.setState({ confirm: null }),
        runConfirm: () => {
          this.setState({ confirm: null });
          cf.run();
        },
      });

    const ed = st.edit;
    v.editing = !!ed;
    if (ed) {
      const d = ed.d,
        avail = Math.max(0, (Number(d.quantity) || 0) - (Number(d.reserved_quantity) || 0));
      const setD = (k, val) =>
        this.setState((s) => ({ editErr: '', edit: { ...s.edit, d: { ...s.edit.d, [k]: val } } }));
      const F = (k, label, type = 'text', o = {}) => {
        const val = k === 'tags' ? (d.tags || []).join(', ') : d[k] == null ? '' : d[k];
        return {
          label,
          value: val,
          type: type === 'number' ? 'number' : 'text',
          span: o.full ? '1 / -1' : 'auto',
          isInput: type === 'text' || type === 'number',
          isSelect: type === 'select',
          isTextarea: type === 'area',
          isCheck: type === 'check',
          notCheck: type !== 'check',
          checked: !!d[k],
          options: (o.options || []).map((x) => (Array.isArray(x) ? { v: x[0], l: x[1] } : { v: x, l: x || '—' })),
          onChange: (e) => {
            const t = e.target;
            if (type === 'check') return setD(k, t.checked);
            if (k === 'tags')
              return setD(
                k,
                t.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              );
            if (type === 'number' || k === 'grade') return setD(k, t.value === '' ? null : Number(t.value));
            setD(k, t.value);
          },
        };
      };
      v.editTitle = ed.isNew ? 'Add product' : d.name || 'Edit product';
      v.editKicker = ed.isNew ? 'NEW LISTING' : 'EDIT · ' + d.sku;
      v.editExisting = !ed.isNew;
      v.editAvail = avail;
      const items = ed.isNew
        ? []
        : S.inventoryItems(d.product_id).filter((i) => i.status !== 'SOLD' && i.status !== 'ARCHIVED');
      v.hasEditItems = items.length > 0;
      v.itemImgType = st.itemImgType;
      v.onItemType = (e) => this.setState({ itemImgType: e.target.value });
      v.itemTypeOpts = ['FRONT', 'BACK', 'SLAB', 'DETAIL', 'OTHER'].map((x) => ({ v: x, l: x }));
      v.editItems = items.map((i) => {
        const s = SQView.statusStyle(i.status);
        return {
          id: i.inventory_item_id,
          status: i.status,
          bg: s.bg,
          fg: s.fg,
          order: i.order_id ? '· ' + i.order_id : i.hold_reason ? '· ' + i.hold_reason : '',
          ledger: i.card_ledger_id || '',
          photos: (i.images || []).map((im) => ({
            type: im.image_type,
            image: { url: im.url, kind: 'item', title: im.image_type },
            onRemove: () => this.act(S.removeItemImage(i.inventory_item_id, im.image_id), 'Photo removed'),
          })),
          onUpload: (e) => {
            const files = [...(e.target.files || [])];
            e.target.value = '';
            files.forEach((f) =>
              this.resize(f, ({ blob, dataUrl }) =>
                this.act(
                  S.addItemImage(i.inventory_item_id, { blob, url: dataUrl, type: this.state.itemImgType }),
                  'Photo added to ' + i.inventory_item_id,
                ),
              ),
            );
          },
          onLedgerBlur: (e) => {
            const val = e.target.value.trim();
            if (val === (i.card_ledger_id || '')) return;
            this.act(S.updateInventoryItem(i.inventory_item_id, { card_ledger_id: val }), 'Card Ledger ID saved');
          },
        };
      });
      v.qaReserve = () => {
        if (avail > 0) setD('reserved_quantity', (Number(d.reserved_quantity) || 0) + 1);
      };
      v.qaRelease = () => {
        if (d.reserved_quantity > 0) setD('reserved_quantity', d.reserved_quantity - 1);
      };
      v.qaSold = () => {
        if (d.quantity > 0) {
          setD('_mark_sold', (d._mark_sold || 0) + 1);
          setD('quantity', d.quantity - 1);
          if (d.reserved_quantity > d.quantity - 1) setD('reserved_quantity', Math.max(0, d.quantity - 1));
        }
      };
      const sec = (num, title, hint, fields, extra = {}) => ({
        num,
        title,
        hint,
        fields,
        hasFields: fields.length > 0,
        isMedia: false,
        isInv: false,
        ...extra,
      });
      v.editSections = [
        sec('01', 'Product', 'What the customer sees first.', [
          F('name', 'Product name', 'text', { full: true }),
          F('sku', 'SKU (becomes product ID)'),
          F('category', 'Category', 'select', { options: S.categories().map((c) => [c.category_id, c.label]) }),
          F('subcategory', 'Subcategory'),
          F('product_type', 'Product type', 'select', { options: Object.entries(SQView.TYPES) }),
          F('description', 'Description', 'area', { full: true }),
          F('tags', 'Tags (comma separated)', 'text', { full: true }),
        ]),
        sec('02', 'Card details', 'Set, number, language and grading.', [
          F('pokemon', 'Pokémon'),
          F('set', 'Set'),
          F('card_number', 'Card number'),
          F('language', 'Language', 'select', { options: ['English', 'Japanese', 'Chinese', 'Korean', 'Other'] }),
          F('condition', 'Condition', 'select', { options: ['', 'NM', 'LP', 'MP', 'HP', 'DMG', 'New', 'Sealed'] }),
          F('grading_company', 'Grading company', 'select', { options: ['', 'PSA', 'BGS', 'CGC', 'Other'] }),
          F('grade', 'Grade', 'select', {
            options: [['', '—'], ...[10, 9.5, 9, 8.5, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => [g, String(g)])],
          }),
        ]),
        sec('03', 'Pricing', 'Cost is visible to admins only.', [
          F('price', 'Price (₱)', 'number'),
          F('sale_price', 'Sale price (₱)', 'number'),
          F('cost', 'Cost (₱, admin only)', 'number'),
        ]),
        sec(
          '04',
          'Inventory',
          'One physical unit, one inventory row.',
          [
            F('quantity', 'Units on hand', 'number'),
            F('reserved_quantity', 'Reserved', 'number'),
            F('track_items', 'Track unique physical items', 'check'),
          ],
          { isInv: true },
        ),
        sec('05', 'Media', 'The first photo is the main listing image.', [], { isMedia: true }),
        sec('06', 'Store', 'Visibility on the storefront.', [
          F('status', 'Status', 'select', {
            options: [
              ['ACTIVE', 'Published (Active)'],
              ['DRAFT', 'Draft'],
              ['ARCHIVED', 'Archived'],
            ],
          }),
          F('featured', 'Featured on homepage', 'check'),
          F('sale', 'On sale', 'check'),
        ]),
      ];
      v.editPhotos = (d.images || []).map((im, i) => ({
        image: { ...SQView.imgVM(d, i) },
        label: i === 0 ? 'Main' : (im.kind || 'photo').replace(/_/g, ' '),
        notMain: i > 0,
        bd: i === 0 ? 'var(--color-text)' : 'var(--color-divider)',
        onMain: () =>
          this.setState((s) => {
            const imgs = [...s.edit.d.images];
            const [x] = imgs.splice(i, 1);
            imgs.unshift(x);
            return { edit: { ...s.edit, d: { ...s.edit.d, images: imgs } } };
          }),
        onRemove: () =>
          this.setState((s) => ({
            edit: { ...s.edit, d: { ...s.edit.d, images: s.edit.d.images.filter((_, j) => j !== i) } },
          })),
      }));
      v.photoNote =
        S.backend === 'supabase'
          ? 'Listing photos upload to Supabase Storage (product-images/products/<SKU>/). Exact photos of each physical card go on the units above.'
          : 'Local demo: photos are resized and kept in this browser. With Supabase they upload to Storage.';
      v.onUpload = (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        const push = (url, storage_path) =>
          this.setState((s) => {
            const dd = s.edit.d;
            return {
              edit: {
                ...s.edit,
                d: {
                  ...dd,
                  images: [
                    ...(dd.images || []),
                    {
                      image_id:
                        storage_path || 'IMG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                      url,
                      storage_path: storage_path || null,
                      kind: 'product',
                      alt: dd.name,
                      is_primary: false,
                      sort_order: 0,
                    },
                  ],
                },
              },
            };
          });
        files.forEach((file) =>
          this.resize(file, ({ blob, dataUrl }) => {
            if (S.backend !== 'supabase') return push(dataUrl);
            Promise.resolve(S.uploadProductImage(this.state.edit.d.sku, blob)).then((r) =>
              r.ok ? push(r.image.url, r.image.storage_path) : this.setState({ editErr: r.msg }),
            );
          }),
        );
      };
      const orig = !ed.isNew && allP.find((p) => p.product_id === d.product_id);
      v.canArchiveEdit = !!orig;
      v.archiveEditLabel = orig && orig.status === 'ARCHIVED' ? 'Restore as draft' : 'Archive';
      v.archiveEdit = () => {
        if (!orig) return;
        if (orig.status === 'ARCHIVED')
          return this.act(S.setProductStatus(orig.product_id, 'DRAFT'), 'Restored as draft').then(() =>
            this.setState({ edit: null }),
          );
        this.ask('Archive product?', 'This will remove the product from active inventory.', 'Archive', () =>
          this.act(S.setProductStatus(orig.product_id, 'ARCHIVED'), 'Archived').then((r) => {
            if (r && r.ok) this.setState({ edit: null });
          }),
        );
      };
      v.hasEditErr = !!st.editErr;
      v.editErr = st.editErr;
      v.closeEdit = () => this.setState({ edit: null, editErr: '' });
      v.saving = st.saving;
      v.saveLabel = st.saving ? 'Saving…' : 'Save product';
      v.saveEdit = () => {
        if (this.state.saving) return;
        this.setState({ saving: true, editErr: '' });
        Promise.resolve(S.saveProduct(this.state.edit.d, this.state.edit.isNew)).then((res) => {
          if (!res.ok) return this.setState({ editErr: res.msg, saving: false });
          this.setState({ edit: null, saving: false });
          this.showToast('Product saved');
        });
      };
    }

    const o = st.orderView ? S.order(st.orderView) : null;
    v.viewingOrder = !!o;
    if (o) {
      v.payStatusOpts = S.PAYMENT_STATUSES.map((x) => ({ v: x, l: SQView.label(x) }));
      v.orderStatusOpts = S.ORDER_STATUSES.map((x) => ({ v: x, l: SQView.label(x) }));
      v.closeOrder = () => this.setState({ orderView: null });
      const ss = SQView.statusStyle(o.order_status);
      const hist = [{ t: o.created_at, text: 'Order placed · ' + (SQView.PAY[o.payment_method] || o.payment_method) }];
      if (typeof S.orderEvents === 'function')
        S.orderEvents(o.order_id).forEach((e) =>
          hist.push({
            t: e.created_at,
            text: e.field === 'expires_at' ? 'Hold extended to ' + SQView.fmtDate(e.new) : 'Updated ' + e.field,
            note: e.notes,
          }),
        );
      if (o.updated_at && new Date(o.updated_at) - new Date(o.created_at) > 60000)
        hist.push({
          t: o.updated_at,
          text: 'Now ' + SQView.label(o.order_status) + ' · payment ' + SQView.label(o.payment_status),
        });
      v.ov = {
        id: o.order_id,
        date: SQView.fmtDate(o.created_at),
        statusLabel: SQView.label(o.order_status),
        bg: ss.bg,
        fg: ss.fg,
        payment_status: o.payment_status,
        order_status: o.order_status,
        stock: SQView.label(o.stock),
        method: SQView.PAY[o.payment_method] || o.payment_method,
        hasRef: !!o.payment_reference,
        ref: o.payment_reference || '',
        shipInput: o.shipping_fee == null ? '' : o.shipping_fee,
        onPay: (e) => this.act(S.setPaymentStatus(o.order_id, e.target.value), 'Payment status updated'),
        onStatus: (e) => this.act(S.setOrderStatus(o.order_id, e.target.value), 'Order status updated'),
        onShip: (e) => {
          const val = e.target.value;
          clearTimeout(this.shipT);
          this.shipT = setTimeout(
            () =>
              Promise.resolve(S.setShippingFee(o.order_id, val)).then((res) => {
                if (!res.ok) this.showToast(res.msg);
              }),
            S.backend === 'supabase' ? 600 : 0,
          );
        },
        canRestock: o.stock === 'COMMITTED' && ['CANCELLED', 'REFUNDED'].includes(o.order_status),
        hasHold: o.stock === 'RESERVED' && o.payment_status !== 'PAID' && !!o.expires_at,
        expiresText: o.expires_at ? SQView.fmtDate(o.expires_at) : '',
        onExtend: () => {
          const note = prompt(
            'Reason for extending the hold (saved to the audit log):',
            'Customer requested more time',
          );
          if (note === null) return;
          const who = S.auth && S.auth.user() ? S.auth.user().email : 'local-admin';
          this.act(S.extendHold(o.order_id, note, who), 'Hold extended by 24 hours');
        },
        onRestock: () =>
          this.ask(
            'Return items to stock?',
            'The physical units on this order become available for sale again. This is recorded in the audit log.',
            'Return to stock',
            () => this.act(S.restockOrder(o.order_id), 'Items returned to stock'),
          ),
        name: o.customer_information.name,
        email: o.customer_information.email,
        mobile: o.customer_information.mobile,
        shipTo: SQView.shipToText(o.shipping_address),
        hasNotes: !!o.notes,
        notes: o.notes,
        items: o.items.map((i) => ({
          ...i,
          lineText: SQView.peso(i.line_total),
          invText: i.inventory_item_ids.length
            ? '· ' +
              i.inventory_item_ids
                .map((id) => {
                  const it = S.inventoryItems(i.product_id).find((x) => x.inventory_item_id === id);
                  return id + (it ? ' (' + it.status + ')' : '');
                })
                .join(', ')
            : '',
        })),
        subtotalText: SQView.peso(o.subtotal),
        shipText: o.shipping_confirmed ? SQView.peso(o.shipping_fee) : 'TBD',
        totalText: SQView.peso(o.total) + (o.shipping_confirmed ? '' : ' + shipping'),
        history: hist
          .filter((h) => h.t)
          .sort((a, b) => new Date(a.t) - new Date(b.t))
          .map((h) => ({ text: h.text, note: h.note || '', hasNote: !!h.note, when: SQView.fmtDate(h.t) })),
        historyNote:
          S.backend === 'supabase'
            ? 'Every status change is recorded server-side in the order audit log.'
            : 'Local demo history.',
      };
    }
  }

  openEdit(id) {
    const S = window.SQStore,
      p = S.products({ includeInactive: true }).find((x) => x.product_id === id);
    if (!p) return;
    const d = JSON.parse(JSON.stringify(p));
    delete d.available_quantity;
    this.setState({ edit: { isNew: false, d }, editErr: '', menuOpen: false });
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] AdminV2.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        <div
          data-screen-label={'Admin'}
          style={{
            minHeight: '100vh',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {v.skeleton ? (
            <>
              {' '}
              <div style={{ display: 'flex', minHeight: '100vh' }}>
                {' '}
                <div
                  style={{
                    width: '248px',
                    flex: 'none',
                    borderRight: '2px solid var(--color-text)',
                    background: 'var(--color-surface)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      height: '48px',
                      width: '120px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      height: '12px',
                      width: '90px',
                      background: 'var(--color-neutral-200)',
                      marginTop: '20px',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      height: '36px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      height: '36px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      height: '36px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                </div>{' '}
                <div
                  style={{
                    flex: '1',
                    minWidth: '0',
                    padding: '40px clamp(16px,3vw,40px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      height: '14px',
                      width: '120px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      height: '40px',
                      width: 'min(420px,80%)',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        height: '108px',
                        background: 'var(--color-neutral-200)',
                        animation: 'sqpulse 1.4s infinite',
                      }}
                    ></div>
                    <div
                      style={{
                        height: '108px',
                        background: 'var(--color-neutral-200)',
                        animation: 'sqpulse 1.4s infinite',
                      }}
                    ></div>
                    <div
                      style={{
                        height: '108px',
                        background: 'var(--color-neutral-200)',
                        animation: 'sqpulse 1.4s infinite',
                      }}
                    ></div>
                    <div
                      style={{
                        height: '108px',
                        background: 'var(--color-neutral-200)',
                        animation: 'sqpulse 1.4s infinite',
                      }}
                    ></div>
                    <div
                      style={{
                        height: '108px',
                        background: 'var(--color-neutral-200)',
                        animation: 'sqpulse 1.4s infinite',
                      }}
                    ></div>
                  </div>{' '}
                  <div
                    style={{
                      height: '280px',
                      background: 'var(--color-neutral-200)',
                      animation: 'sqpulse 1.4s infinite',
                    }}
                  ></div>{' '}
                  <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>
                    {'Connecting to the store database…'}
                  </div>{' '}
                </div>{' '}
              </div>
            </>
          ) : null}

          {v.gateLogin ? (
            <>
              {' '}
              <div
                style={{
                  minHeight: '100vh',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))',
                }}
              >
                {' '}
                <div
                  style={{
                    background: 'var(--color-text)',
                    color: 'var(--color-bg)',
                    padding: 'clamp(28px,5vw,64px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '40px',
                  }}
                >
                  {' '}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ width: '18px', height: '5px', background: 'var(--sq-gold)' }}></span>
                    <span style={{ width: '18px', height: '5px', background: 'var(--color-accent)' }}></span>
                  </div>{' '}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {' '}
                    <div
                      style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '.18em', color: 'var(--sq-gold)' }}
                    >
                      {'SIDE QUEST · HQ'}
                    </div>{' '}
                    <div
                      style={{
                        fontSize: 'clamp(36px,5vw,64px)',
                        fontWeight: '800',
                        lineHeight: '.95',
                        letterSpacing: '-.02em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {'Command'}
                      <br />
                      {'Center'}
                    </div>{' '}
                    <div style={{ fontSize: '15px', color: 'var(--color-neutral-300)', maxWidth: '360px' }}>
                      {'Inventory, orders and customers for the SIDE QUEST store.'}
                    </div>{' '}
                  </div>{' '}
                  <div style={{ fontSize: '12px', letterSpacing: '.14em', color: 'var(--color-neutral-400)' }}>
                    {'COLLECT • TRADE • HOBBIES'}
                  </div>{' '}
                </div>{' '}
                <div style={{ display: 'flex', alignItems: 'center', padding: 'clamp(28px,5vw,64px)' }}>
                  {' '}
                  <div
                    style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                  >
                    {' '}
                    <img
                      src={'/assets/sidequest-logo.png'}
                      alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                      style={{ width: '132px', height: 'auto', display: 'block' }}
                    />{' '}
                    <div
                      style={{
                        borderTop: '2px solid var(--color-text)',
                        paddingTop: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {' '}
                      <h1
                        style={{ margin: '0', textTransform: 'uppercase', fontSize: '28px', letterSpacing: '-.01em' }}
                      >
                        {'Admin sign in'}
                      </h1>{' '}
                      <p style={{ margin: '0', fontSize: '14px', color: 'var(--color-neutral-800)' }}>
                        {'Only accounts listed as SIDE QUEST admins can manage the store.'}
                      </p>{' '}
                    </div>{' '}
                    <div className="field">
                      <label>{'Email'}</label>
                      <input
                        type={'email'}
                        autoComplete={'username'}
                        value={v.loginEmail}
                        onChange={v.onLoginEmail}
                        className="input"
                        style={{ minHeight: '46px', fontSize: '16px', background: 'var(--color-bg)' }}
                      />
                    </div>{' '}
                    <div className="field">
                      <label>{'Password'}</label>
                      <input
                        type={'password'}
                        autoComplete={'current-password'}
                        value={v.loginPw}
                        onChange={v.onLoginPw}
                        onKeyDown={v.onLoginKey}
                        className="input"
                        style={{ minHeight: '46px', fontSize: '16px', background: 'var(--color-bg)' }}
                      />
                    </div>{' '}
                    {v.hasLoginMsg ? (
                      <>
                        <div
                          role={'alert'}
                          style={{
                            padding: '10px 12px',
                            background: v.loginMsgBg,
                            color: v.loginMsgFg,
                            fontSize: '14px',
                            fontWeight: '600',
                          }}
                        >
                          {T(v.loginMsg)}
                        </div>
                      </>
                    ) : null}{' '}
                    <button
                      onClick={v.doLogin}
                      className="btn btn-primary"
                      style={{
                        justifyContent: 'space-between',
                        padding: '15px 18px',
                        fontSize: '15px',
                        minHeight: '50px',
                      }}
                    >
                      {T(v.loginLabel)} <span>{'→'}</span>
                    </button>{' '}
                    <button
                      onClick={v.doReset}
                      className="btn btn-ghost"
                      style={{ alignSelf: 'flex-start', fontSize: '13px' }}
                    >
                      {'Forgot password?'}
                    </button>{' '}
                  </div>{' '}
                </div>{' '}
              </div>
            </>
          ) : null}

          {v.gateDenied ? (
            <>
              {' '}
              <div
                style={{
                  maxWidth: '560px',
                  margin: '0 auto',
                  padding: '72px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  alignItems: 'flex-start',
                }}
              >
                {' '}
                <img
                  src={'/assets/sidequest-logo.png'}
                  alt={'SIDE QUEST'}
                  style={{ width: '120px', height: 'auto' }}
                />{' '}
                <h1
                  style={{
                    margin: '0',
                    textTransform: 'uppercase',
                    fontSize: '30px',
                    borderTop: '2px solid var(--color-text)',
                    paddingTop: '16px',
                    alignSelf: 'stretch',
                  }}
                >
                  {'Not authorized'}
                </h1>{' '}
                <p style={{ margin: '0', fontSize: '15px' }}>
                  {"You're signed in as "}
                  <strong>{T(v.userEmail)}</strong>
                  {", but this account isn't a SIDE QUEST admin. Ask the owner to add you."}
                </p>{' '}
                <button onClick={v.signOut} className="btn btn-secondary">
                  {'Sign out'}
                </button>{' '}
              </div>
            </>
          ) : null}

          {v.shell ? (
            <>
              <div style={{ display: 'flex', minHeight: '100vh' }}>
                {' '}
                {v.showSidebar ? (
                  <>
                    {' '}
                    <aside
                      aria-label={'Admin navigation'}
                      style={{
                        position: 'sticky',
                        top: '0',
                        height: '100vh',
                        width: `${S(v.sbW)}px`,
                        flex: 'none',
                        background: 'var(--color-surface)',
                        borderRight: '2px solid var(--color-text)',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'width .18s ease',
                        overflow: 'hidden',
                      }}
                    >
                      {' '}
                      <div
                        style={{
                          flex: 'none',
                          display: 'flex',
                          flexDirection: v.sbHeadDir,
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: `${S(v.sbHeadPadY)}px ${S(v.sbPad)}px`,
                          borderBottom: '1px solid var(--color-divider)',
                          boxSizing: 'border-box',
                        }}
                      >
                        {' '}
                        {v.sbOpen ? (
                          <>
                            <a href={'#/admin'} aria-label={'Command Center'} style={{ display: 'block' }}>
                              <img
                                src={'/assets/sidequest-logo.png'}
                                alt={'SIDE QUEST — Collect • Trade • Hobbies'}
                                style={{ height: `${S(v.sbLogoH)}px`, width: 'auto', display: 'block' }}
                              />
                            </a>
                          </>
                        ) : null}{' '}
                        {v.sbClosed ? (
                          <>
                            <a
                              href={'#/admin'}
                              aria-label={'SIDE QUEST Command Center'}
                              title={'Command Center'}
                              style={{ display: 'block', width: '44px', height: '28px' }}
                            >
                              <img
                                src={'/assets/sidequest-logo.png'}
                                alt={'SIDE QUEST'}
                                style={{ width: '44px', height: '28px', objectFit: 'contain', display: 'block' }}
                              />
                            </a>
                          </>
                        ) : null}{' '}
                        <button
                          onClick={v.toggleSidebar}
                          aria-label={v.sbToggleLabel}
                          title={v.sbToggleLabel}
                          className="sqa2p0"
                          style={{
                            width: '40px',
                            height: '40px',
                            flex: 'none',
                            border: '1px solid var(--color-divider)',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                          }}
                        >
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
                            <path d={'M3 3h18v18H3zM9 3v18'}></path>
                          </svg>
                        </button>{' '}
                      </div>{' '}
                      <nav
                        style={{
                          flex: '1 1 auto',
                          minHeight: '0',
                          overflowY: 'auto',
                          overscrollBehavior: 'contain',
                          scrollbarWidth: 'thin',
                          padding: `${S(v.sbNavPadY)}px 0`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {' '}
                        {v.sbOpen ? (
                          <>
                            <div
                              style={{
                                padding: '0 20px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '.16em',
                                color: 'var(--color-neutral-600)',
                              }}
                            >
                              {'COMMAND CENTER'}
                            </div>
                          </>
                        ) : null}{' '}
                        {L(v.navMain).map((n, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            {n?.active ? (
                              <>
                                <a
                                  href={n?.href}
                                  aria-current={'page'}
                                  title={n?.label}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    minHeight: `${S(v.sbItemH)}px`,
                                    margin: `0 ${S(v.sbInset)}px`,
                                    padding: `0 ${S(v.sbItemPad)}px`,
                                    background: 'var(--color-text)',
                                    color: 'var(--color-bg)',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    letterSpacing: '.02em',
                                  }}
                                >
                                  <svg
                                    width={'18'}
                                    height={'18'}
                                    viewBox={'0 0 24 24'}
                                    fill={'none'}
                                    stroke={'currentColor'}
                                    strokeWidth={'1.8'}
                                    strokeLinecap={'round'}
                                    strokeLinejoin={'round'}
                                    style={{ flex: 'none' }}
                                  >
                                    <path d={n?.icon}></path>
                                  </svg>
                                  {v.sbOpen ? (
                                    <>
                                      <span style={{ flex: '1' }}>{T(n?.label)}</span>
                                      <span
                                        style={{ width: '6px', height: '6px', background: 'var(--color-accent)' }}
                                      ></span>
                                    </>
                                  ) : null}
                                </a>
                              </>
                            ) : null}{' '}
                            {n?.idle ? (
                              <>
                                <a
                                  href={n?.href}
                                  title={n?.label}
                                  className="sqa2p1"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    minHeight: `${S(v.sbItemH)}px`,
                                    margin: `0 ${S(v.sbInset)}px`,
                                    padding: `0 ${S(v.sbItemPad)}px`,
                                    color: 'var(--color-text)',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    transition: 'background .12s',
                                  }}
                                >
                                  <svg
                                    width={'18'}
                                    height={'18'}
                                    viewBox={'0 0 24 24'}
                                    fill={'none'}
                                    stroke={'currentColor'}
                                    strokeWidth={'1.8'}
                                    strokeLinecap={'round'}
                                    strokeLinejoin={'round'}
                                    style={{ flex: 'none' }}
                                  >
                                    <path d={n?.icon}></path>
                                  </svg>
                                  {v.sbOpen ? (
                                    <>
                                      <span style={{ flex: '1' }}>{T(n?.label)}</span>
                                      {n?.hasCount ? (
                                        <>
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '700',
                                              padding: '1px 6px',
                                              background: 'var(--sq-gold)',
                                              color: 'var(--color-text)',
                                            }}
                                          >
                                            {T(n?.count)}
                                          </span>
                                        </>
                                      ) : null}
                                    </>
                                  ) : null}
                                </a>
                              </>
                            ) : null}{' '}
                          </React.Fragment>
                        ))}{' '}
                        <div
                          style={{
                            flex: 'none',
                            height: '1px',
                            background: 'var(--color-divider)',
                            margin: `${S(v.sbDivM)}px 20px`,
                          }}
                        ></div>{' '}
                        {v.sbOpen ? (
                          <>
                            <div
                              style={{
                                padding: '0 20px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '.16em',
                                color: 'var(--color-neutral-600)',
                              }}
                            >
                              {'SYSTEM'}
                            </div>
                          </>
                        ) : null}{' '}
                        {L(v.navSys).map((n, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            {n?.active ? (
                              <>
                                <a
                                  href={n?.href}
                                  aria-current={'page'}
                                  title={n?.label}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    minHeight: `${S(v.sbItemH)}px`,
                                    margin: `0 ${S(v.sbInset)}px`,
                                    padding: `0 ${S(v.sbItemPad)}px`,
                                    background: 'var(--color-text)',
                                    color: 'var(--color-bg)',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '700',
                                  }}
                                >
                                  <svg
                                    width={'18'}
                                    height={'18'}
                                    viewBox={'0 0 24 24'}
                                    fill={'none'}
                                    stroke={'currentColor'}
                                    strokeWidth={'1.8'}
                                    strokeLinecap={'round'}
                                    strokeLinejoin={'round'}
                                    style={{ flex: 'none' }}
                                  >
                                    <path d={n?.icon}></path>
                                  </svg>
                                  {v.sbOpen ? (
                                    <>
                                      <span style={{ flex: '1' }}>{T(n?.label)}</span>
                                      <span
                                        style={{ width: '6px', height: '6px', background: 'var(--color-accent)' }}
                                      ></span>
                                    </>
                                  ) : null}
                                </a>
                              </>
                            ) : null}{' '}
                            {n?.idle ? (
                              <>
                                <a
                                  href={n?.href}
                                  title={n?.label}
                                  className="sqa2p1"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    minHeight: `${S(v.sbItemH)}px`,
                                    margin: `0 ${S(v.sbInset)}px`,
                                    padding: `0 ${S(v.sbItemPad)}px`,
                                    color: 'var(--color-text)',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                  }}
                                >
                                  <svg
                                    width={'18'}
                                    height={'18'}
                                    viewBox={'0 0 24 24'}
                                    fill={'none'}
                                    stroke={'currentColor'}
                                    strokeWidth={'1.8'}
                                    strokeLinecap={'round'}
                                    strokeLinejoin={'round'}
                                    style={{ flex: 'none' }}
                                  >
                                    <path d={n?.icon}></path>
                                  </svg>
                                  {v.sbOpen ? (
                                    <>
                                      <span>{T(n?.label)}</span>
                                    </>
                                  ) : null}
                                </a>
                              </>
                            ) : null}{' '}
                          </React.Fragment>
                        ))}{' '}
                        <a
                          href={'#/'}
                          title={'View store'}
                          className="sqa2p1"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minHeight: `${S(v.sbItemH)}px`,
                            margin: `0 ${S(v.sbInset)}px`,
                            padding: `0 ${S(v.sbItemPad)}px`,
                            color: 'var(--color-neutral-700)',
                            textDecoration: 'none',
                            fontSize: '14px',
                          }}
                        >
                          <svg
                            width={'18'}
                            height={'18'}
                            viewBox={'0 0 24 24'}
                            fill={'none'}
                            stroke={'currentColor'}
                            strokeWidth={'1.8'}
                            strokeLinecap={'round'}
                            strokeLinejoin={'round'}
                            style={{ flex: 'none' }}
                          >
                            <path d={'M15 3h6v6M10 14 21 3M21 14v7H3V3h7'}></path>
                          </svg>
                          {v.sbOpen ? (
                            <>
                              <span>{'View store'}</span>
                            </>
                          ) : null}
                        </a>{' '}
                      </nav>{' '}
                      <div
                        style={{
                          flex: 'none',
                          borderTop: '2px solid var(--color-text)',
                          background: 'var(--color-surface)',
                          padding: `${S(v.sbFootPadY)}px ${S(v.sbPad)}px`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: `${S(v.sbFootGap)}px`,
                        }}
                      >
                        {' '}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0' }}>
                          {' '}
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              flex: 'none',
                              background: 'var(--color-text)',
                              color: 'var(--color-bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '800',
                              fontSize: '14px',
                            }}
                          >
                            {T(v.initials)}
                          </div>{' '}
                          {v.sbOpen ? (
                            <>
                              <div style={{ minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {T(v.userEmail)}
                                </span>
                                <span
                                  style={{
                                    display: 'flex',
                                    gap: '6px',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    color: 'var(--color-neutral-700)',
                                  }}
                                >
                                  <span style={{ width: '6px', height: '6px', background: v.dbDot }}></span>
                                  {T(v.roleLabel)}
                                </span>
                              </div>
                            </>
                          ) : null}{' '}
                        </div>{' '}
                        {v.canSignOut ? (
                          <>
                            <button
                              onClick={v.signOut}
                              title={'Sign out'}
                              className="sqa2p2"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                minHeight: '40px',
                                padding: '0 10px',
                                border: '1px solid var(--color-divider)',
                                background: 'transparent',
                                font: 'inherit',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <svg
                                width={'16'}
                                height={'16'}
                                viewBox={'0 0 24 24'}
                                fill={'none'}
                                stroke={'currentColor'}
                                strokeWidth={'1.8'}
                                strokeLinecap={'round'}
                                strokeLinejoin={'round'}
                                style={{ flex: 'none' }}
                              >
                                <path d={'M9 21H5V3h4M16 17l5-5-5-5M21 12H9'}></path>
                              </svg>
                              {v.sbOpen ? (
                                <>
                                  <span>{'Sign out'}</span>
                                </>
                              ) : null}
                            </button>
                          </>
                        ) : null}{' '}
                      </div>{' '}
                    </aside>{' '}
                  </>
                ) : null}{' '}
                <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
                  {' '}
                  {v.isMobile ? (
                    <>
                      {' '}
                      <div
                        style={{
                          position: 'sticky',
                          top: '0',
                          zIndex: '40',
                          background: 'var(--color-bg)',
                          borderBottom: '2px solid var(--color-text)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 8px',
                        }}
                      >
                        {' '}
                        <button
                          onClick={v.openMenu}
                          aria-label={'Open admin menu'}
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
                          >
                            <path d={'M3 6h18M3 12h18M3 18h18'}></path>
                          </svg>
                        </button>{' '}
                        <a href={'#/admin'} style={{ display: 'block' }}>
                          <img
                            src={'/assets/sidequest-logo.png'}
                            alt={'SIDE QUEST'}
                            style={{ height: '36px', width: 'auto', display: 'block' }}
                          />
                        </a>{' '}
                        <span
                          style={{
                            marginLeft: '8px',
                            marginRight: 'auto',
                            fontSize: '12px',
                            fontWeight: '700',
                            letterSpacing: '.12em',
                            textTransform: 'uppercase',
                            color: 'var(--color-neutral-700)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {T(v.tabLabel)}
                        </span>{' '}
                        <button
                          onClick={v.openNew}
                          aria-label={'Add product'}
                          style={{
                            width: '44px',
                            height: '44px',
                            border: '0',
                            background: 'var(--color-accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <svg
                            width={'20'}
                            height={'20'}
                            viewBox={'0 0 24 24'}
                            fill={'none'}
                            stroke={'currentColor'}
                            strokeWidth={'2.4'}
                            strokeLinecap={'round'}
                          >
                            <path d={'M5 12h14M12 5v14'}></path>
                          </svg>
                        </button>{' '}
                      </div>{' '}
                    </>
                  ) : null}{' '}
                  {v.isLocal ? (
                    <>
                      {' '}
                      <div
                        style={{
                          background: 'var(--color-accent-100)',
                          color: 'var(--color-accent-800)',
                          borderBottom: '1px solid var(--color-accent-300)',
                          padding: '10px clamp(16px,3vw,40px)',
                          fontSize: '13px',
                        }}
                      >
                        <strong>{'Local demo backend, not the live database.'}</strong>
                        {' Data is saved only in this browser.'}
                      </div>{' '}
                    </>
                  ) : null}{' '}
                  <main
                    style={{
                      flex: '1',
                      width: '100%',
                      maxWidth: '1440px',
                      boxSizing: 'border-box',
                      padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px) 96px',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '16px',
                        flexWrap: 'wrap',
                        paddingBottom: '18px',
                        borderBottom: '2px solid var(--color-text)',
                        marginBottom: '24px',
                      }}
                    >
                      {' '}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          marginRight: 'auto',
                          minWidth: '0',
                        }}
                      >
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '.16em',
                            color: 'var(--color-neutral-700)',
                          }}
                        >
                          <span style={{ display: 'flex', gap: '3px' }}>
                            <span style={{ width: '10px', height: '3px', background: 'var(--sq-gold)' }}></span>
                            <span style={{ width: '10px', height: '3px', background: 'var(--color-accent)' }}></span>
                          </span>
                          {T(v.kicker)}
                        </div>{' '}
                        <h1
                          style={{
                            margin: '0',
                            fontSize: 'clamp(28px,3.6vw,44px)',
                            lineHeight: '1',
                            letterSpacing: '-.02em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {T(v.pageTitle)}
                        </h1>{' '}
                        <p style={{ margin: '0', fontSize: '14px', color: 'var(--color-neutral-800)' }}>
                          {T(v.pageSub)}
                        </p>{' '}
                      </div>{' '}
                      <div
                        style={{
                          flex: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: v.metaAlign,
                          gap: '4px',
                          fontSize: '12px',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '700',
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            minWidth: 'max-content',
                          }}
                        >
                          <span style={{ width: '7px', height: '7px', flex: 'none', background: v.dbDot }}></span>
                          {T(v.dbLabel)}
                        </span>
                        <span>{T(v.nowText)}</span>
                      </div>{' '}
                    </div>{' '}
                    {v.isDash ? (
                      <>
                        {' '}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                          {' '}
                          <button
                            onClick={v.openNew}
                            className="btn btn-primary"
                            style={{ gap: '8px', minHeight: '44px' }}
                          >
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2.4'}
                              strokeLinecap={'round'}
                            >
                              <path d={'M5 12h14M12 5v14'}></path>
                            </svg>
                            {'Add product'}
                          </button>{' '}
                          <a
                            href={'#/admin/inventory'}
                            className="btn btn-secondary"
                            style={{ minHeight: '44px', textDecoration: 'none' }}
                          >
                            {'Manage inventory'}
                          </a>{' '}
                          <a
                            href={'#/admin/orders'}
                            className="btn btn-secondary"
                            style={{ minHeight: '44px', textDecoration: 'none' }}
                          >
                            {'View orders'}
                          </a>{' '}
                          <a
                            href={'#/'}
                            className="btn btn-ghost"
                            style={{ minHeight: '44px', textDecoration: 'none', gap: '8px' }}
                          >
                            {'View store '}
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
                              <path d={'M15 3h6v6M10 14 21 3M21 14v7H3V3h7'}></path>
                            </svg>
                          </a>{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: v.kpiCols,
                            gap: '0',
                            borderTop: '2px solid var(--color-text)',
                            borderLeft: '2px solid var(--color-text)',
                            marginBottom: '32px',
                          }}
                        >
                          {' '}
                          {L(v.kpis).map((k, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <div
                                style={{
                                  gridColumn: k?.span,
                                  background: 'var(--color-bg)',
                                  borderRight: '2px solid var(--color-text)',
                                  borderBottom: '2px solid var(--color-text)',
                                  padding: v.kpiPad,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: `${S(v.kpiGap)}px`,
                                  minWidth: '0',
                                }}
                              >
                                {' '}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      letterSpacing: '.14em',
                                      color: 'var(--color-neutral-700)',
                                    }}
                                  >
                                    {T(k?.label)}
                                  </span>
                                  <svg
                                    width={'18'}
                                    height={'18'}
                                    viewBox={'0 0 24 24'}
                                    fill={'none'}
                                    stroke={'currentColor'}
                                    strokeWidth={'1.6'}
                                    strokeLinecap={'round'}
                                    strokeLinejoin={'round'}
                                    style={{ color: 'var(--color-neutral-500)', flex: 'none' }}
                                  >
                                    <path d={k?.icon}></path>
                                  </svg>
                                </div>{' '}
                                <span
                                  style={{
                                    fontSize: 'clamp(28px,2.6vw,36px)',
                                    fontWeight: '800',
                                    letterSpacing: '-.02em',
                                    lineHeight: '1',
                                    fontVariantNumeric: 'tabular-nums',
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {T(k?.value)}
                                </span>{' '}
                                <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(k?.sub)}</span>{' '}
                              </div>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,520px),1fr))',
                            gap: '32px 40px',
                            alignItems: 'start',
                          }}
                        >
                          {' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: '0' }}>
                            {' '}
                            <section>
                              {' '}
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '4px 16px',
                                  borderBottom: '2px solid var(--color-text)',
                                  paddingBottom: '10px',
                                }}
                              >
                                <h2
                                  style={{
                                    margin: '0',
                                    fontSize: '15px',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    flex: '1 1 auto',
                                    minWidth: '0',
                                  }}
                                >
                                  {'Recent orders'}
                                </h2>
                                <a
                                  href={'#/admin/orders'}
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {'View all orders →'}
                                </a>
                              </div>{' '}
                              {L(v.recentOrders).map((o, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <button
                                    onClick={o?.onView}
                                    className="sqa2p3"
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'minmax(0,1fr) auto',
                                      gap: '4px 16px',
                                      width: '100%',
                                      padding: '12px 8px',
                                      border: '0',
                                      borderBottom: '1px solid var(--color-divider)',
                                      background: 'transparent',
                                      font: 'inherit',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      color: 'var(--color-text)',
                                    }}
                                  >
                                    {' '}
                                    <span
                                      style={{
                                        display: 'flex',
                                        gap: '10px',
                                        alignItems: 'baseline',
                                        minWidth: '0',
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <strong style={{ fontSize: '14px' }}>{T(o?.id)}</strong>
                                      <span
                                        style={{
                                          fontSize: '14px',
                                          color: 'var(--color-neutral-800)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {T(o?.customer)}
                                      </span>
                                    </span>{' '}
                                    <strong
                                      style={{
                                        fontSize: '14px',
                                        textAlign: 'right',
                                        whiteSpace: 'nowrap',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}
                                    >
                                      {T(o?.total)}
                                    </strong>{' '}
                                    <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                      {T(o?.date)}
                                      {' · '}
                                      {T(o?.method)}
                                    </span>{' '}
                                    <span
                                      style={{
                                        justifySelf: 'end',
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        letterSpacing: '.06em',
                                        background: o?.bg,
                                        color: o?.fg,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {T(o?.status)}
                                    </span>{' '}
                                  </button>{' '}
                                </React.Fragment>
                              ))}{' '}
                              {v.noOrders ? (
                                <>
                                  <div
                                    style={{ padding: '28px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}
                                  >
                                    <strong style={{ fontSize: '15px' }}>{'No orders yet.'}</strong>
                                    <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                                      {'Your store is ready for its first order.'}
                                    </span>
                                  </div>
                                </>
                              ) : null}{' '}
                            </section>{' '}
                            <section>
                              {' '}
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '4px 16px',
                                  borderBottom: '2px solid var(--color-text)',
                                  paddingBottom: '10px',
                                }}
                              >
                                <h2
                                  style={{
                                    margin: '0',
                                    fontSize: '15px',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    flex: '1 1 auto',
                                    minWidth: '0',
                                  }}
                                >
                                  {'Inventory · recently updated'}
                                </h2>
                                <a
                                  href={'#/admin/inventory'}
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {'View inventory →'}
                                </a>
                              </div>{' '}
                              {L(v.invSnap).map((r, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <button
                                    onClick={r?.onEdit}
                                    className="sqa2p3"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '14px',
                                      width: '100%',
                                      padding: '10px 8px',
                                      border: '0',
                                      borderBottom: '1px solid var(--color-divider)',
                                      background: 'transparent',
                                      font: 'inherit',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      color: 'var(--color-text)',
                                    }}
                                  >
                                    {' '}
                                    <div
                                      style={{
                                        position: 'relative',
                                        width: '48px',
                                        height: '48px',
                                        flex: 'none',
                                        border: '1px solid var(--color-divider)',
                                        background: 'var(--color-surface)',
                                      }}
                                    >
                                      <ProductImage
                                        image={r?.image}
                                        compact={true}
                                        __hostStyle={{ position: 'absolute', inset: '0' }}
                                      />
                                    </div>{' '}
                                    <span
                                      style={{
                                        flex: '1',
                                        minWidth: '0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                      }}
                                    >
                                      <strong
                                        style={{
                                          fontSize: '14px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {T(r?.name)}
                                      </strong>
                                      <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                        {T(r?.cat)}
                                        {' · '}
                                        {T(r?.price)}
                                      </span>
                                    </span>{' '}
                                    <span
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        gap: '4px',
                                        flex: 'none',
                                      }}
                                    >
                                      <span
                                        style={{
                                          padding: '3px 8px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          letterSpacing: '.06em',
                                          background: r?.stBg,
                                          color: r?.stFg,
                                        }}
                                      >
                                        {T(r?.statusLabel)}
                                      </span>
                                      <span style={{ fontSize: '12px', fontWeight: '600', color: r?.availColor }}>
                                        {T(r?.availText)}
                                      </span>
                                    </span>{' '}
                                  </button>{' '}
                                </React.Fragment>
                              ))}{' '}
                              {v.noProducts ? (
                                <>
                                  <div
                                    style={{
                                      padding: '28px 0',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '10px',
                                      alignItems: 'flex-start',
                                    }}
                                  >
                                    <strong style={{ fontSize: '15px' }}>{'No products yet.'}</strong>
                                    <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                                      {'Add your first listing to open the store.'}
                                    </span>
                                    <button onClick={v.openNew} className="btn btn-secondary">
                                      {'Add product'}
                                    </button>
                                  </div>
                                </>
                              ) : null}{' '}
                            </section>{' '}
                          </div>{' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', minWidth: '0' }}>
                            {' '}
                            <section>
                              {' '}
                              <div style={{ borderBottom: '2px solid var(--color-text)', paddingBottom: '10px' }}>
                                <h2
                                  style={{
                                    margin: '0',
                                    fontSize: '15px',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {'Needs attention'}
                                </h2>
                              </div>{' '}
                              {L(v.attention).map((a, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <a
                                    href={a?.href}
                                    onClick={a?.onGo}
                                    className="sqa2p4"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '14px',
                                      padding: '14px 8px',
                                      borderBottom: '1px solid var(--color-divider)',
                                      textDecoration: 'none',
                                      color: 'var(--color-text)',
                                    }}
                                  >
                                    {' '}
                                    <span
                                      style={{
                                        minWidth: '36px',
                                        height: '36px',
                                        padding: '0 6px',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '800',
                                        fontSize: '16px',
                                        background: a?.bg,
                                        color: a?.fg,
                                      }}
                                    >
                                      {T(a?.count)}
                                    </span>{' '}
                                    <span
                                      style={{
                                        flex: '1',
                                        minWidth: '0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                      }}
                                    >
                                      <strong style={{ fontSize: '14px' }}>{T(a?.title)}</strong>
                                      <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                        {T(a?.sub)}
                                      </span>
                                    </span>{' '}
                                    <span aria-hidden={'true'} style={{ fontSize: '16px' }}>
                                      {'→'}
                                    </span>{' '}
                                  </a>{' '}
                                </React.Fragment>
                              ))}{' '}
                              {v.allClear ? (
                                <>
                                  <div
                                    style={{
                                      padding: '20px 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      fontSize: '14px',
                                    }}
                                  >
                                    <span
                                      style={{ width: '8px', height: '8px', background: 'var(--color-text)' }}
                                    ></span>
                                    {'All clear. Nothing is waiting on you.'}
                                  </div>
                                </>
                              ) : null}{' '}
                            </section>{' '}
                            <section>
                              {' '}
                              <div style={{ borderBottom: '2px solid var(--color-text)', paddingBottom: '10px' }}>
                                <h2
                                  style={{
                                    margin: '0',
                                    fontSize: '15px',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {'Recent activity'}
                                </h2>
                              </div>{' '}
                              {L(v.activity).map((e, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '10px minmax(0,1fr) auto',
                                      gap: '12px',
                                      alignItems: 'baseline',
                                      padding: '11px 0',
                                      borderBottom: '1px solid var(--color-divider)',
                                    }}
                                  >
                                    {' '}
                                    <span
                                      style={{
                                        width: '8px',
                                        height: '8px',
                                        background: e?.dot,
                                        transform: 'translateY(-1px)',
                                      }}
                                    ></span>{' '}
                                    <span
                                      style={{ minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }}
                                    >
                                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{T(e?.event)}</span>
                                      <span
                                        style={{
                                          fontSize: '12px',
                                          color: 'var(--color-neutral-700)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {T(e?.ref)}
                                      </span>
                                    </span>{' '}
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        color: 'var(--color-neutral-700)',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {T(e?.when)}
                                    </span>{' '}
                                  </div>{' '}
                                </React.Fragment>
                              ))}{' '}
                              {v.noActivity ? (
                                <>
                                  <div
                                    style={{ padding: '20px 0', fontSize: '14px', color: 'var(--color-neutral-700)' }}
                                  >
                                    {'Activity appears here as products and orders change.'}
                                  </div>
                                </>
                              ) : null}{' '}
                            </section>{' '}
                          </div>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.isInv ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            marginBottom: '12px',
                          }}
                        >
                          {' '}
                          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '0' }}>
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2'}
                              strokeLinecap={'round'}
                              style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-neutral-600)',
                              }}
                            >
                              <path d={'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'}></path>
                            </svg>
                            <input
                              placeholder={'Search name, SKU or set'}
                              value={v.adminQ}
                              onChange={v.onAdminQ}
                              className="input"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '44px',
                                paddingLeft: '36px',
                                background: 'var(--color-bg)',
                              }}
                            />
                          </div>{' '}
                          {v.isLocal ? (
                            <>
                              <button onClick={v.resetDemo} className="btn btn-ghost" style={{ minHeight: '44px' }}>
                                {'Reset demo data'}
                              </button>
                            </>
                          ) : null}{' '}
                          <button
                            onClick={v.openNew}
                            className="btn btn-primary"
                            style={{ minHeight: '44px', gap: '8px' }}
                          >
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2.4'}
                              strokeLinecap={'round'}
                            >
                              <path d={'M5 12h14M12 5v14'}></path>
                            </svg>
                            {'Add product'}
                          </button>{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))',
                            gap: '8px',
                            marginBottom: '12px',
                          }}
                        >
                          {' '}
                          {L(v.invFilters).map((f, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <label
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  letterSpacing: '.1em',
                                  color: 'var(--color-neutral-700)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {T(f?.label)}
                                <select
                                  value={f?.value}
                                  onChange={f?.onChange}
                                  className="input"
                                  style={{
                                    minHeight: '40px',
                                    background: 'var(--color-bg)',
                                    fontSize: '14px',
                                    textTransform: 'none',
                                    letterSpacing: '0',
                                    color: 'var(--color-text)',
                                    fontWeight: '400',
                                  }}
                                >
                                  {L(f?.options).map((o, $index) => (
                                    <React.Fragment key={$index}>
                                      <option value={o?.v}>{T(o?.l)}</option>
                                    </React.Fragment>
                                  ))}
                                </select>
                              </label>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '13px',
                            color: 'var(--color-neutral-700)',
                            padding: '8px 0',
                            borderBottom: '2px solid var(--color-text)',
                          }}
                        >
                          {' '}
                          <span style={{ marginRight: 'auto' }}>{T(v.invCountText)}</span>{' '}
                          {v.hasInvFilters ? (
                            <>
                              <button
                                onClick={v.clearInvFilters}
                                className="btn btn-ghost"
                                style={{ fontSize: '13px', minHeight: '32px' }}
                              >
                                {'Clear filters'}
                              </button>
                            </>
                          ) : null}{' '}
                        </div>{' '}
                        {v.wideTable ? (
                          <>
                            {' '}
                            <table className="table" style={{ width: '100%', tableLayout: 'auto' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '56px' }}></th>
                                  <th>{'Product'}</th>
                                  <th>{'Category'}</th>
                                  <th style={{ textAlign: 'right' }}>{'Price'}</th>
                                  <th>{'Status'}</th>
                                  <th>{'Availability'}</th>
                                  <th style={{ textAlign: 'right' }}>{'Actions'}</th>
                                </tr>
                              </thead>

                              <tbody>
                                {L(v.invRows).map((r, $index) => (
                                  <React.Fragment key={$index}>
                                    {' '}
                                    <tr style={{ opacity: r?.op }}>
                                      <td>
                                        <div
                                          style={{
                                            position: 'relative',
                                            width: '44px',
                                            height: '44px',
                                            border: '1px solid var(--color-divider)',
                                            background: 'var(--color-surface)',
                                          }}
                                        >
                                          <ProductImage
                                            image={r?.image}
                                            compact={true}
                                            __hostStyle={{ position: 'absolute', inset: '0' }}
                                          />
                                        </div>
                                      </td>

                                      <td style={{ minWidth: '200px' }}>
                                        <div style={{ fontWeight: '700' }}>{T(r?.name)}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(r?.sku)}
                                          {' · '}
                                          {T(r?.type)}
                                        </div>
                                      </td>

                                      <td>{T(r?.cat)}</td>

                                      <td
                                        style={{
                                          textAlign: 'right',
                                          whiteSpace: 'nowrap',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        <strong>{T(r?.price)}</strong>
                                        {r?.hasSale ? (
                                          <>
                                            <div style={{ fontSize: '12px', color: 'var(--color-accent-700)' }}>
                                              {'Sale '}
                                              {T(r?.salePrice)}
                                            </div>
                                          </>
                                        ) : null}
                                      </td>

                                      <td>
                                        <span
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            letterSpacing: '.06em',
                                            background: r?.stBg,
                                            color: r?.stFg,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {T(r?.statusLabel)}
                                        </span>
                                        {r?.featured ? (
                                          <>
                                            <div
                                              style={{
                                                fontSize: '11px',
                                                marginTop: '4px',
                                                color: 'var(--color-neutral-700)',
                                              }}
                                            >
                                              {'Featured'}
                                            </div>
                                          </>
                                        ) : null}
                                      </td>

                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        <strong style={{ color: r?.availColor }}>{T(r?.availText)}</strong>
                                        <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(r?.unitText)}
                                        </div>
                                      </td>

                                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        <button
                                          onClick={r?.onEdit}
                                          className="btn btn-ghost"
                                          style={{ fontSize: '13px' }}
                                        >
                                          {'Edit'}
                                        </button>
                                        <button
                                          onClick={r?.onArchive}
                                          className="btn btn-ghost"
                                          style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}
                                        >
                                          {T(r?.archiveLabel)}
                                        </button>
                                      </td>
                                    </tr>{' '}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>{' '}
                          </>
                        ) : null}{' '}
                        {v.narrowTable ? (
                          <>
                            {' '}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {' '}
                              {L(v.invRows).map((r, $index) => (
                                <React.Fragment key={$index}>
                                  {' '}
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '64px minmax(0,1fr)',
                                      gap: '12px',
                                      padding: '14px 0',
                                      borderBottom: '1px solid var(--color-divider)',
                                      opacity: r?.op,
                                    }}
                                  >
                                    {' '}
                                    <div
                                      style={{
                                        position: 'relative',
                                        width: '64px',
                                        height: '64px',
                                        border: '1px solid var(--color-divider)',
                                        background: 'var(--color-surface)',
                                      }}
                                    >
                                      <ProductImage
                                        image={r?.image}
                                        compact={true}
                                        __hostStyle={{ position: 'absolute', inset: '0' }}
                                      />
                                    </div>{' '}
                                    <div
                                      style={{ minWidth: '0', display: 'flex', flexDirection: 'column', gap: '6px' }}
                                    >
                                      {' '}
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <div style={{ flex: '1', minWidth: '0' }}>
                                          <div style={{ fontWeight: '700', fontSize: '15px' }}>{T(r?.name)}</div>
                                          <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                            {T(r?.sku)}
                                            {' · '}
                                            {T(r?.cat)}
                                          </div>
                                        </div>
                                        <strong style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                          {T(r?.price)}
                                        </strong>
                                      </div>{' '}
                                      <div
                                        style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
                                      >
                                        <span
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            letterSpacing: '.06em',
                                            background: r?.stBg,
                                            color: r?.stFg,
                                          }}
                                        >
                                          {T(r?.statusLabel)}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: r?.availColor }}>
                                          {T(r?.availText)}
                                        </span>
                                      </div>{' '}
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          onClick={r?.onEdit}
                                          className="btn btn-secondary"
                                          style={{ minHeight: '40px', flex: '1' }}
                                        >
                                          {'Edit'}
                                        </button>
                                        <button
                                          onClick={r?.onArchive}
                                          className="btn btn-ghost"
                                          style={{ minHeight: '40px', color: 'var(--color-neutral-700)' }}
                                        >
                                          {T(r?.archiveLabel)}
                                        </button>
                                      </div>{' '}
                                    </div>{' '}
                                  </div>{' '}
                                </React.Fragment>
                              ))}{' '}
                            </div>{' '}
                          </>
                        ) : null}{' '}
                        {v.invEmpty ? (
                          <>
                            <div
                              style={{
                                padding: '40px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                alignItems: 'flex-start',
                              }}
                            >
                              <strong style={{ fontSize: '16px' }}>{T(v.invEmptyTitle)}</strong>
                              <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                                {T(v.invEmptySub)}
                              </span>
                            </div>
                          </>
                        ) : null}{' '}
                      </>
                    ) : null}{' '}
                    {v.isOrders ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            marginBottom: '12px',
                          }}
                        >
                          {' '}
                          <div
                            role={'tablist'}
                            aria-label={'Order status'}
                            style={{
                              display: 'flex',
                              flexWrap: 'nowrap',
                              flex: '0 1 auto',
                              minWidth: '0',
                              maxWidth: '100%',
                              overflowX: 'auto',
                              overscrollBehaviorX: 'contain',
                              scrollbarWidth: 'none',
                              border: '2px solid var(--color-text)',
                            }}
                          >
                            {' '}
                            {L(v.orderTabs).map((t, $index) => (
                              <React.Fragment key={$index}>
                                <button
                                  onClick={t?.onClick}
                                  aria-pressed={t?.on}
                                  style={{
                                    flex: 'none',
                                    whiteSpace: 'nowrap',
                                    minHeight: '44px',
                                    padding: '0 14px',
                                    border: '0',
                                    borderRight: '1px solid var(--color-divider)',
                                    background: t?.bg,
                                    color: t?.fg,
                                    font: 'inherit',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    gap: '6px',
                                    alignItems: 'center',
                                  }}
                                >
                                  {T(t?.label)}
                                  <span style={{ fontWeight: '500', opacity: '.75' }}>{T(t?.count)}</span>
                                </button>
                              </React.Fragment>
                            ))}{' '}
                          </div>{' '}
                          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '0' }}>
                            <svg
                              width={'16'}
                              height={'16'}
                              viewBox={'0 0 24 24'}
                              fill={'none'}
                              stroke={'currentColor'}
                              strokeWidth={'2'}
                              strokeLinecap={'round'}
                              style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-neutral-600)',
                              }}
                            >
                              <path d={'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'}></path>
                            </svg>
                            <input
                              placeholder={'Search order, customer or email'}
                              value={v.oQ}
                              onChange={v.onOQ}
                              className="input"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: '44px',
                                paddingLeft: '36px',
                                background: 'var(--color-bg)',
                              }}
                            />
                          </div>{' '}
                        </div>{' '}
                        <div style={{ borderTop: '2px solid var(--color-text)' }}></div>{' '}
                        {v.wideTable ? (
                          <>
                            {' '}
                            <table className="table" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th>{'Order'}</th>
                                  <th>{'Customer'}</th>
                                  <th>{'Date'}</th>
                                  <th>{'Items'}</th>
                                  <th style={{ textAlign: 'right' }}>{'Amount'}</th>
                                  <th>{'Payment'}</th>
                                  <th>{'Status'}</th>
                                  <th></th>
                                </tr>
                              </thead>

                              <tbody>
                                {L(v.orderRows).map((o, $index) => (
                                  <React.Fragment key={$index}>
                                    {' '}
                                    <tr onClick={o?.onView} style={{ cursor: 'pointer' }}>
                                      <td>
                                        <strong>{T(o?.id)}</strong>
                                      </td>

                                      <td style={{ minWidth: '160px' }}>
                                        {T(o?.customer)}
                                        <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(o?.email)}
                                        </div>
                                      </td>

                                      <td style={{ whiteSpace: 'nowrap' }}>{T(o?.date)}</td>

                                      <td>{T(o?.itemCount)}</td>

                                      <td
                                        style={{
                                          textAlign: 'right',
                                          whiteSpace: 'nowrap',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        <strong>{T(o?.total)}</strong>
                                      </td>

                                      <td style={{ whiteSpace: 'nowrap' }}>
                                        {T(o?.method)}
                                        <div style={{ marginTop: '4px' }}>
                                          <span
                                            style={{
                                              padding: '2px 6px',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              letterSpacing: '.06em',
                                              background: o?.pBg,
                                              color: o?.pFg,
                                            }}
                                          >
                                            {T(o?.payStatus)}
                                          </span>
                                        </div>
                                      </td>

                                      <td>
                                        <span
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            letterSpacing: '.06em',
                                            background: o?.bg,
                                            color: o?.fg,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {T(o?.status)}
                                        </span>
                                      </td>

                                      <td style={{ textAlign: 'right' }}>
                                        <button
                                          onClick={o?.onView}
                                          className="btn btn-ghost"
                                          style={{ fontSize: '13px' }}
                                        >
                                          {'Open'}
                                        </button>
                                      </td>
                                    </tr>{' '}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>{' '}
                          </>
                        ) : null}{' '}
                        {v.narrowTable ? (
                          <>
                            {' '}
                            {L(v.orderRows).map((o, $index) => (
                              <React.Fragment key={$index}>
                                {' '}
                                <button
                                  onClick={o?.onView}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    width: '100%',
                                    padding: '14px 0',
                                    border: '0',
                                    borderBottom: '1px solid var(--color-divider)',
                                    background: 'transparent',
                                    font: 'inherit',
                                    textAlign: 'left',
                                    color: 'var(--color-text)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {' '}
                                  <span style={{ display: 'flex', gap: '8px', alignItems: 'baseline', width: '100%' }}>
                                    <strong style={{ fontSize: '15px', marginRight: 'auto' }}>{T(o?.id)}</strong>
                                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{T(o?.total)}</strong>
                                  </span>{' '}
                                  <span style={{ fontSize: '14px' }}>
                                    {T(o?.customer)}{' '}
                                    <span style={{ color: 'var(--color-neutral-700)' }}>
                                      {'· '}
                                      {T(o?.itemCount)}
                                      {' item(s)'}
                                    </span>
                                  </span>{' '}
                                  <span
                                    style={{
                                      display: 'flex',
                                      gap: '8px',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      fontSize: '12px',
                                      color: 'var(--color-neutral-700)',
                                    }}
                                  >
                                    <span
                                      style={{
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        letterSpacing: '.06em',
                                        background: o?.bg,
                                        color: o?.fg,
                                      }}
                                    >
                                      {T(o?.status)}
                                    </span>
                                    {T(o?.method)}
                                    {' · '}
                                    {T(o?.date)}
                                  </span>{' '}
                                </button>{' '}
                              </React.Fragment>
                            ))}{' '}
                          </>
                        ) : null}{' '}
                        {v.ordersEmpty ? (
                          <>
                            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <strong style={{ fontSize: '16px' }}>{T(v.ordersEmptyTitle)}</strong>
                              <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                                {T(v.ordersEmptySub)}
                              </span>
                            </div>
                          </>
                        ) : null}{' '}
                      </>
                    ) : null}{' '}
                    {v.isCustomers ? (
                      <>
                        {' '}
                        <div style={{ fontSize: '13px', color: 'var(--color-neutral-700)', marginBottom: '12px' }}>
                          {'Built from order records. Customers without an order do not appear here yet.'}
                        </div>{' '}
                        <div style={{ borderTop: '2px solid var(--color-text)' }}></div>{' '}
                        {v.hasCustomers ? (
                          <>
                            {' '}
                            {v.wideTable ? (
                              <>
                                {' '}
                                <table className="table" style={{ width: '100%' }}>
                                  <thead>
                                    <tr>
                                      <th>{'Customer'}</th>
                                      <th>{'Orders'}</th>
                                      <th style={{ textAlign: 'right' }}>{'Paid purchases'}</th>
                                      <th>{'First order'}</th>
                                      <th>{'Last order'}</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {L(v.customerRows).map((c, $index) => (
                                      <React.Fragment key={$index}>
                                        <tr>
                                          <td>
                                            <strong>{T(c?.name)}</strong>
                                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                              {T(c?.email)}
                                            </div>
                                          </td>
                                          <td>{T(c?.orders)}</td>
                                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            <strong>{T(c?.paid)}</strong>
                                          </td>
                                          <td style={{ whiteSpace: 'nowrap' }}>{T(c?.first)}</td>
                                          <td style={{ whiteSpace: 'nowrap' }}>{T(c?.last)}</td>
                                        </tr>
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>{' '}
                              </>
                            ) : null}{' '}
                            {v.narrowTable ? (
                              <>
                                {' '}
                                {L(v.customerRows).map((c, $index) => (
                                  <React.Fragment key={$index}>
                                    <div
                                      style={{
                                        padding: '14px 0',
                                        borderBottom: '1px solid var(--color-divider)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                      }}
                                    >
                                      <span style={{ display: 'flex', gap: '8px' }}>
                                        <strong style={{ marginRight: 'auto' }}>{T(c?.name)}</strong>
                                        <strong>{T(c?.paid)}</strong>
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '13px',
                                          color: 'var(--color-neutral-700)',
                                          overflowWrap: 'anywhere',
                                        }}
                                      >
                                        {T(c?.email)}
                                      </span>
                                      <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                        {T(c?.orders)}
                                        {' order(s) · last '}
                                        {T(c?.last)}
                                      </span>
                                    </div>
                                  </React.Fragment>
                                ))}{' '}
                              </>
                            ) : null}{' '}
                          </>
                        ) : null}{' '}
                        {v.noCustomers ? (
                          <>
                            <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <strong style={{ fontSize: '16px' }}>{'No customers yet.'}</strong>
                              <span style={{ fontSize: '14px', color: 'var(--color-neutral-700)' }}>
                                {'Customers will appear here after they interact with your store.'}
                              </span>
                            </div>
                          </>
                        ) : null}{' '}
                      </>
                    ) : null}{' '}
                    {v.isMarketing ? (
                      <>
                        {' '}
                        <div
                          style={{
                            background: 'var(--color-text)',
                            color: 'var(--color-bg)',
                            padding: 'clamp(24px,4vw,40px)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
                            gap: '24px',
                            alignItems: 'end',
                            marginBottom: '32px',
                          }}
                        >
                          {' '}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {' '}
                            <span
                              style={{
                                alignSelf: 'flex-start',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '.12em',
                                background: 'var(--sq-gold)',
                                color: 'var(--color-text)',
                              }}
                            >
                              {'PLANNED'}
                            </span>{' '}
                            <div
                              style={{
                                fontSize: 'clamp(28px,3.4vw,44px)',
                                fontWeight: '800',
                                lineHeight: '1',
                                letterSpacing: '-.02em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {'Join SIDE QUEST'}
                            </div>{' '}
                            <div style={{ fontSize: '15px', color: 'var(--color-neutral-300)' }}>
                              {'Collector Club. Opt in at checkout for 10% off a first purchase.'}
                            </div>{' '}
                          </div>{' '}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              fontSize: '14px',
                              color: 'var(--color-neutral-200)',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '.14em',
                                color: 'var(--color-neutral-400)',
                              }}
                            >
                              {'MEMBERS WILL RECEIVE'}
                            </span>
                            {
                              'Fresh drops · Restocks · New arrivals · Exclusive releases · Collector updates · Promotions'
                            }
                          </div>{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))',
                            gap: '0',
                            borderTop: '2px solid var(--color-text)',
                            borderLeft: '2px solid var(--color-text)',
                          }}
                        >
                          {' '}
                          {L(v.mktCells).map((m, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <div
                                style={{
                                  background: 'var(--color-bg)',
                                  borderRight: '2px solid var(--color-text)',
                                  borderBottom: '2px solid var(--color-text)',
                                  padding: '20px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  minHeight: '130px',
                                }}
                              >
                                {' '}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      letterSpacing: '.14em',
                                      color: 'var(--color-neutral-700)',
                                    }}
                                  >
                                    {T(m?.label)}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      letterSpacing: '.1em',
                                      padding: '2px 6px',
                                      border: '1px solid var(--color-divider)',
                                      color: 'var(--color-neutral-700)',
                                    }}
                                  >
                                    {'COMING SOON'}
                                  </span>
                                </div>{' '}
                                <strong style={{ fontSize: '15px' }}>{T(m?.title)}</strong>{' '}
                                <span style={{ fontSize: '13px', color: 'var(--color-neutral-700)' }}>{T(m?.sub)}</span>{' '}
                              </div>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                        <p style={{ fontSize: '13px', color: 'var(--color-neutral-700)', margin: '16px 0 0' }}>
                          {
                            'No subscriber data is collected yet. Numbers will appear here once consent capture is built into checkout.'
                          }
                        </p>{' '}
                      </>
                    ) : null}{' '}
                    {v.isStore ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))',
                            gap: '0',
                            borderTop: '2px solid var(--color-text)',
                            borderLeft: '2px solid var(--color-text)',
                            marginBottom: '32px',
                          }}
                        >
                          {' '}
                          {L(v.visCells).map((c, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <button
                                onClick={c?.onClick}
                                className="sqa2p3"
                                style={{
                                  background: 'var(--color-bg)',
                                  padding: '18px 20px',
                                  border: '0',
                                  borderRight: '2px solid var(--color-text)',
                                  borderBottom: '2px solid var(--color-text)',
                                  font: 'inherit',
                                  textAlign: 'left',
                                  color: 'var(--color-text)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    letterSpacing: '.14em',
                                    color: 'var(--color-neutral-700)',
                                  }}
                                >
                                  {T(c?.label)}
                                </span>
                                <span style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>
                                  {T(c?.value)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                  {T(c?.sub)}
                                  {' →'}
                                </span>
                              </button>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))',
                            gap: '32px 40px',
                          }}
                        >
                          {' '}
                          {L(v.storeLists).map((L, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <section>
                                {' '}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'baseline',
                                    gap: '4px 16px',
                                    borderBottom: '2px solid var(--color-text)',
                                    paddingBottom: '10px',
                                  }}
                                >
                                  <h2
                                    style={{
                                      margin: '0',
                                      fontSize: '15px',
                                      letterSpacing: '.08em',
                                      textTransform: 'uppercase',
                                      flex: '1 1 auto',
                                      minWidth: '0',
                                    }}
                                  >
                                    {T(L?.title)}
                                  </h2>
                                  <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                    {T(L?.hint)}
                                  </span>
                                </div>{' '}
                                {L(L?.rows).map((r, $index) => (
                                  <React.Fragment key={$index}>
                                    {' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 0',
                                        borderBottom: '1px solid var(--color-divider)',
                                      }}
                                    >
                                      {' '}
                                      <div
                                        style={{
                                          position: 'relative',
                                          width: '44px',
                                          height: '44px',
                                          flex: 'none',
                                          border: '1px solid var(--color-divider)',
                                          background: 'var(--color-surface)',
                                        }}
                                      >
                                        <ProductImage
                                          image={r?.image}
                                          compact={true}
                                          __hostStyle={{ position: 'absolute', inset: '0' }}
                                        />
                                      </div>{' '}
                                      <span
                                        style={{
                                          flex: '1',
                                          minWidth: '0',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '2px',
                                        }}
                                      >
                                        <strong
                                          style={{
                                            fontSize: '14px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {T(r?.name)}
                                        </strong>
                                        <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                          {T(r?.meta)}
                                        </span>
                                      </span>{' '}
                                      <button
                                        onClick={r?.onEdit}
                                        className="btn btn-ghost"
                                        style={{ fontSize: '13px', minHeight: '40px' }}
                                      >
                                        {'Edit'}
                                      </button>{' '}
                                    </div>{' '}
                                  </React.Fragment>
                                ))}{' '}
                                {L?.empty ? (
                                  <>
                                    <div
                                      style={{ padding: '20px 0', fontSize: '14px', color: 'var(--color-neutral-700)' }}
                                    >
                                      {T(L?.emptyText)}
                                    </div>
                                  </>
                                ) : null}{' '}
                              </section>{' '}
                            </React.Fragment>
                          ))}{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.isSettings ? (
                      <>
                        {' '}
                        <div style={{ maxWidth: '760px' }}>
                          {' '}
                          {L(v.settingsGroups).map((g, $index) => (
                            <React.Fragment key={$index}>
                              {' '}
                              <section style={{ marginBottom: '28px' }}>
                                {' '}
                                <h2
                                  style={{
                                    margin: '0',
                                    fontSize: '15px',
                                    letterSpacing: '.08em',
                                    textTransform: 'uppercase',
                                    borderBottom: '2px solid var(--color-text)',
                                    paddingBottom: '10px',
                                  }}
                                >
                                  {T(g?.title)}
                                </h2>{' '}
                                {L(g?.rows).map((r, $index) => (
                                  <React.Fragment key={$index}>
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))',
                                        gap: '4px 16px',
                                        padding: '12px 0',
                                        borderBottom: '1px solid var(--color-divider)',
                                        fontSize: '14px',
                                      }}
                                    >
                                      <span style={{ color: 'var(--color-neutral-700)' }}>{T(r?.k)}</span>
                                      <strong style={{ overflowWrap: 'anywhere' }}>{T(r?.v)}</strong>
                                    </div>
                                  </React.Fragment>
                                ))}{' '}
                              </section>{' '}
                            </React.Fragment>
                          ))}{' '}
                          <p style={{ fontSize: '13px', color: 'var(--color-neutral-700)', margin: '0' }}>
                            {
                              'These values are set in the database and deployment configuration. They are shown here read-only.'
                            }
                          </p>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                  </main>{' '}
                </div>
              </div>
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
                  zIndex: '95',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 50%, transparent)',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  style={{
                    width: 'min(320px,86%)',
                    height: '100%',
                    background: 'var(--color-surface)',
                    borderRight: '2px solid var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 8px 10px 16px',
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
                      >
                        <path d={'M18 6 6 18M6 6l12 12'}></path>
                      </svg>
                    </button>
                  </div>{' '}
                  <div
                    style={{
                      padding: '16px 16px 6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '.16em',
                      color: 'var(--color-neutral-600)',
                    }}
                  >
                    {'COMMAND CENTER'}
                  </div>{' '}
                  {L(v.navAll).map((n, $index) => (
                    <React.Fragment key={$index}>
                      <a
                        href={n?.href}
                        onClick={v.closeMenu}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          minHeight: '50px',
                          padding: '0 16px',
                          background: n?.bg,
                          color: n?.fg,
                          textDecoration: 'none',
                          fontSize: '15px',
                          fontWeight: '600',
                          borderBottom: '1px solid var(--color-divider)',
                        }}
                      >
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
                          <path d={n?.icon}></path>
                        </svg>
                        {T(n?.label)}
                      </a>
                    </React.Fragment>
                  ))}{' '}
                  <a
                    href={'#/'}
                    onClick={v.closeMenu}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minHeight: '50px',
                      padding: '0 16px',
                      color: 'var(--color-text)',
                      textDecoration: 'none',
                      fontSize: '15px',
                      borderBottom: '1px solid var(--color-divider)',
                    }}
                  >
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
                      <path d={'M15 3h6v6M10 14 21 3M21 14v7H3V3h7'}></path>
                    </svg>
                    {'View store'}
                  </a>{' '}
                  <div
                    style={{
                      marginTop: 'auto',
                      borderTop: '2px solid var(--color-text)',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {' '}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', overflowWrap: 'anywhere' }}>
                        {T(v.userEmail)}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        {T(v.roleLabel)}
                      </span>
                    </div>{' '}
                    {v.canSignOut ? (
                      <>
                        <button onClick={v.signOut} className="btn btn-secondary" style={{ minHeight: '44px' }}>
                          {'Sign out'}
                        </button>
                      </>
                    ) : null}{' '}
                  </div>{' '}
                </div>{' '}
              </div>
            </>
          ) : null}

          {v.editing ? (
            <>
              {' '}
              <div
                onClick={v.closeEdit}
                style={{
                  position: 'fixed',
                  inset: '0',
                  zIndex: '90',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 50%, transparent)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  role={'dialog'}
                  aria-label={v.editTitle}
                  style={{
                    width: 'min(820px,100%)',
                    height: '100%',
                    overflowY: 'auto',
                    background: 'var(--color-bg)',
                    borderLeft: '2px solid var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      position: 'sticky',
                      top: '0',
                      zIndex: '2',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 20px',
                      borderBottom: '2px solid var(--color-text)',
                    }}
                  >
                    {' '}
                    <div style={{ marginRight: 'auto', minWidth: '0' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        {T(v.editKicker)}
                      </div>
                      <div
                        style={{
                          fontWeight: '800',
                          fontSize: '20px',
                          textTransform: 'uppercase',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {T(v.editTitle)}
                      </div>
                    </div>{' '}
                    <button
                      onClick={v.closeEdit}
                      aria-label={'Close'}
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
                      >
                        <path d={'M18 6 6 18M6 6l12 12'}></path>
                      </svg>
                    </button>{' '}
                  </div>{' '}
                  <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column' }}>
                    {' '}
                    {L(v.editSections).map((s, $index) => (
                      <React.Fragment key={$index}>
                        {' '}
                        <section
                          style={{
                            padding: '20px 0',
                            borderBottom: '1px solid var(--color-divider)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px 24px',
                          }}
                        >
                          {' '}
                          <div
                            style={{
                              flex: '1 1 160px',
                              maxWidth: '220px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '.14em',
                                color: 'var(--color-neutral-600)',
                              }}
                            >
                              {T(s?.num)}
                            </span>
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: '800',
                                letterSpacing: '.08em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {T(s?.title)}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(s?.hint)}</span>
                          </div>{' '}
                          <div
                            style={{
                              flex: '999 1 400px',
                              minWidth: '0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '14px',
                            }}
                          >
                            {' '}
                            {s?.hasFields ? (
                              <>
                                {' '}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))',
                                    gap: '12px',
                                  }}
                                >
                                  {' '}
                                  {L(s?.fields).map((f, $index) => (
                                    <React.Fragment key={$index}>
                                      {' '}
                                      <div className="field" style={{ gridColumn: f?.span }}>
                                        {' '}
                                        {f?.notCheck ? (
                                          <>
                                            <label>{T(f?.label)}</label>
                                          </>
                                        ) : null}{' '}
                                        {f?.isInput ? (
                                          <>
                                            <input
                                              type={f?.type}
                                              value={f?.value}
                                              onChange={f?.onChange}
                                              className="input"
                                              style={{ background: 'var(--color-bg)', minHeight: '42px' }}
                                            />
                                          </>
                                        ) : null}{' '}
                                        {f?.isSelect ? (
                                          <>
                                            <select
                                              value={f?.value}
                                              onChange={f?.onChange}
                                              className="input"
                                              style={{ background: 'var(--color-bg)', minHeight: '42px' }}
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
                                              style={{ background: 'var(--color-bg)', minHeight: '96px' }}
                                            ></textarea>
                                          </>
                                        ) : null}{' '}
                                        {f?.isCheck ? (
                                          <>
                                            <label
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                fontSize: '14px',
                                                color: 'var(--color-text)',
                                                cursor: 'pointer',
                                                minHeight: '42px',
                                                margin: '0',
                                                textTransform: 'none',
                                                letterSpacing: '0',
                                              }}
                                            >
                                              <input
                                                type={'checkbox'}
                                                checked={f?.checked}
                                                onChange={f?.onChange}
                                                style={{
                                                  accentColor: 'var(--color-accent)',
                                                  width: '18px',
                                                  height: '18px',
                                                }}
                                              />
                                              {T(f?.label)}
                                            </label>
                                          </>
                                        ) : null}{' '}
                                      </div>{' '}
                                    </React.Fragment>
                                  ))}{' '}
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            {s?.isMedia ? (
                              <>
                                {' '}
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  {' '}
                                  {L(v.editPhotos).map((ph, $index) => (
                                    <React.Fragment key={$index}>
                                      {' '}
                                      <div
                                        style={{ width: '104px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                                      >
                                        {' '}
                                        <div
                                          style={{
                                            position: 'relative',
                                            width: '104px',
                                            height: '104px',
                                            border: `2px solid ${S(ph?.bd)}`,
                                          }}
                                        >
                                          <ProductImage
                                            image={ph?.image}
                                            compact={true}
                                            __hostStyle={{ position: 'absolute', inset: '0' }}
                                          />
                                        </div>{' '}
                                        <div
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            letterSpacing: '.06em',
                                            textTransform: 'uppercase',
                                          }}
                                        >
                                          {T(ph?.label)}
                                        </div>{' '}
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                                          {ph?.notMain ? (
                                            <>
                                              <button
                                                onClick={ph?.onMain}
                                                style={{
                                                  border: '0',
                                                  background: 'transparent',
                                                  padding: '0',
                                                  font: 'inherit',
                                                  color: 'var(--color-accent-700)',
                                                  cursor: 'pointer',
                                                }}
                                              >
                                                {'Make main'}
                                              </button>
                                            </>
                                          ) : null}
                                          <button
                                            onClick={ph?.onRemove}
                                            style={{
                                              border: '0',
                                              background: 'transparent',
                                              padding: '0',
                                              font: 'inherit',
                                              color: 'var(--color-neutral-700)',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            {'Remove'}
                                          </button>
                                        </div>{' '}
                                      </div>{' '}
                                    </React.Fragment>
                                  ))}{' '}
                                  <label
                                    className="sqa2p5"
                                    style={{
                                      width: '104px',
                                      height: '104px',
                                      border: '2px dashed var(--color-divider)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      letterSpacing: '.08em',
                                    }}
                                  >
                                    <svg
                                      width={'20'}
                                      height={'20'}
                                      viewBox={'0 0 24 24'}
                                      fill={'none'}
                                      stroke={'currentColor'}
                                      strokeWidth={'2'}
                                      strokeLinecap={'round'}
                                    >
                                      <path d={'M5 12h14M12 5v14'}></path>
                                    </svg>
                                    {'UPLOAD'}
                                    <input
                                      type={'file'}
                                      accept={'image/*'}
                                      multiple={true}
                                      onChange={v.onUpload}
                                      style={{ display: 'none' }}
                                    />
                                  </label>{' '}
                                </div>{' '}
                                <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                  {T(v.photoNote)}
                                </div>{' '}
                              </>
                            ) : null}{' '}
                            {s?.isInv ? (
                              <>
                                {' '}
                                {v.editExisting ? (
                                  <>
                                    {' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: '8px',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: 'var(--color-surface)',
                                      }}
                                    >
                                      {' '}
                                      <span style={{ fontSize: '13px', marginRight: 'auto' }}>
                                        {'Available now: '}
                                        <strong>{T(v.editAvail)}</strong>
                                      </span>{' '}
                                      <button
                                        onClick={v.qaReserve}
                                        className="btn btn-secondary"
                                        style={{ minHeight: '38px', fontSize: '13px' }}
                                      >
                                        {'Mark reserved +1'}
                                      </button>{' '}
                                      <button
                                        onClick={v.qaRelease}
                                        className="btn btn-secondary"
                                        style={{ minHeight: '38px', fontSize: '13px' }}
                                      >
                                        {'Release −1'}
                                      </button>{' '}
                                      <button
                                        onClick={v.qaSold}
                                        className="btn btn-secondary"
                                        style={{ minHeight: '38px', fontSize: '13px' }}
                                      >
                                        {'Mark sold −1'}
                                      </button>{' '}
                                    </div>{' '}
                                  </>
                                ) : null}{' '}
                                {v.hasEditItems ? (
                                  <>
                                    {' '}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        flexWrap: 'wrap',
                                        paddingTop: '4px',
                                      }}
                                    >
                                      {' '}
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          letterSpacing: '.12em',
                                          marginRight: 'auto',
                                        }}
                                      >
                                        {'PHYSICAL UNITS · EXACT PHOTOS'}
                                      </div>{' '}
                                      <label
                                        style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                      >
                                        {'New photo type '}
                                        <select
                                          value={v.itemImgType}
                                          onChange={v.onItemType}
                                          className="input"
                                          style={{ width: 'auto', minHeight: '32px', background: 'var(--color-bg)' }}
                                        >
                                          {L(v.itemTypeOpts).map((o, $index) => (
                                            <React.Fragment key={$index}>
                                              <option value={o?.v}>{T(o?.l)}</option>
                                            </React.Fragment>
                                          ))}
                                        </select>
                                      </label>{' '}
                                    </div>{' '}
                                    {L(v.editItems).map((it, $index) => (
                                      <React.Fragment key={$index}>
                                        {' '}
                                        <div
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '10px 0',
                                            borderTop: '1px solid var(--color-divider)',
                                          }}
                                        >
                                          {' '}
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              flexWrap: 'wrap',
                                              fontSize: '13px',
                                            }}
                                          >
                                            {' '}
                                            <strong>{T(it?.id)}</strong>
                                            <span
                                              style={{
                                                padding: '2px 6px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                background: it?.bg,
                                                color: it?.fg,
                                              }}
                                            >
                                              {T(it?.status)}
                                            </span>
                                            <span style={{ color: 'var(--color-neutral-700)' }}>{T(it?.order)}</span>{' '}
                                            <label
                                              style={{
                                                marginLeft: 'auto',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '12px',
                                                color: 'var(--color-neutral-700)',
                                              }}
                                            >
                                              {'Card Ledger ID '}
                                              <input
                                                defaultValue={it?.ledger}
                                                onBlur={it?.onLedgerBlur}
                                                placeholder={'not linked'}
                                                className="input"
                                                style={{
                                                  width: '150px',
                                                  minHeight: '30px',
                                                  fontSize: '12px',
                                                  background: 'var(--color-bg)',
                                                }}
                                              />
                                            </label>{' '}
                                          </div>{' '}
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {' '}
                                            {L(it?.photos).map((ph, $index) => (
                                              <React.Fragment key={$index}>
                                                {' '}
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '2px',
                                                    width: '72px',
                                                  }}
                                                >
                                                  {' '}
                                                  <div
                                                    style={{
                                                      position: 'relative',
                                                      width: '72px',
                                                      height: '72px',
                                                      border: '1px solid var(--color-divider)',
                                                    }}
                                                  >
                                                    <ProductImage
                                                      image={ph?.image}
                                                      compact={true}
                                                      __hostStyle={{ position: 'absolute', inset: '0' }}
                                                    />
                                                  </div>{' '}
                                                  <div
                                                    style={{
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      fontSize: '10px',
                                                      fontWeight: '700',
                                                    }}
                                                  >
                                                    <span>{T(ph?.type)}</span>
                                                    <button
                                                      onClick={ph?.onRemove}
                                                      aria-label={'Remove photo'}
                                                      style={{
                                                        border: '0',
                                                        background: 'transparent',
                                                        padding: '0',
                                                        font: 'inherit',
                                                        color: 'var(--color-neutral-700)',
                                                        cursor: 'pointer',
                                                      }}
                                                    >
                                                      {'Remove'}
                                                    </button>
                                                  </div>{' '}
                                                </div>{' '}
                                              </React.Fragment>
                                            ))}{' '}
                                            <label
                                              className="sqa2p5"
                                              style={{
                                                width: '72px',
                                                height: '72px',
                                                border: '2px dashed var(--color-divider)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                              }}
                                            >
                                              {'+ PHOTO'}
                                              <input
                                                type={'file'}
                                                accept={'image/*'}
                                                multiple={true}
                                                onChange={it?.onUpload}
                                                style={{ display: 'none' }}
                                              />
                                            </label>{' '}
                                          </div>{' '}
                                        </div>{' '}
                                      </React.Fragment>
                                    ))}{' '}
                                  </>
                                ) : null}{' '}
                              </>
                            ) : null}{' '}
                          </div>{' '}
                        </section>{' '}
                      </React.Fragment>
                    ))}{' '}
                  </div>{' '}
                  <div
                    style={{
                      position: 'sticky',
                      bottom: '0',
                      marginTop: 'auto',
                      background: 'var(--color-bg)',
                      borderTop: '2px solid var(--color-text)',
                      padding: '12px 20px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {' '}
                    {v.canArchiveEdit ? (
                      <>
                        <button
                          onClick={v.archiveEdit}
                          className="btn btn-ghost"
                          style={{ color: 'var(--color-accent-700)', minHeight: '44px' }}
                        >
                          {T(v.archiveEditLabel)}
                        </button>
                      </>
                    ) : null}{' '}
                    {v.hasEditErr ? (
                      <>
                        <span
                          role={'alert'}
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--color-accent-700)',
                            flex: '1 1 200px',
                          }}
                        >
                          {T(v.editErr)}
                        </span>
                      </>
                    ) : null}{' '}
                    <button
                      onClick={v.closeEdit}
                      className="btn btn-secondary"
                      style={{ marginLeft: 'auto', minHeight: '44px' }}
                    >
                      {'Cancel'}
                    </button>{' '}
                    <button
                      onClick={v.saveEdit}
                      disabled={v.saving}
                      className="btn btn-primary"
                      style={{ minWidth: '160px', minHeight: '44px', justifyContent: 'space-between' }}
                    >
                      {T(v.saveLabel)} <span>{'→'}</span>
                    </button>{' '}
                  </div>{' '}
                </div>{' '}
              </div>
            </>
          ) : null}

          {v.viewingOrder ? (
            <>
              {' '}
              <div
                onClick={v.closeOrder}
                style={{
                  position: 'fixed',
                  inset: '0',
                  zIndex: '90',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 50%, transparent)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  role={'dialog'}
                  aria-label={'Order detail'}
                  style={{
                    width: 'min(680px,100%)',
                    height: '100%',
                    overflowY: 'auto',
                    background: 'var(--color-bg)',
                    borderLeft: '2px solid var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {' '}
                  <div
                    style={{
                      position: 'sticky',
                      top: '0',
                      zIndex: '2',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 20px',
                      borderBottom: '2px solid var(--color-text)',
                    }}
                  >
                    {' '}
                    <div
                      style={{
                        marginRight: 'auto',
                        minWidth: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        {'ORDER'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '20px' }}>{T(v.ov?.id)}</strong>
                        <span
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '.06em',
                            background: v.ov?.bg,
                            color: v.ov?.fg,
                          }}
                        >
                          {T(v.ov?.statusLabel)}
                        </span>
                      </div>
                    </div>{' '}
                    <button
                      onClick={v.closeOrder}
                      aria-label={'Close'}
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
                      >
                        <path d={'M18 6 6 18M6 6l12 12'}></path>
                      </svg>
                    </button>{' '}
                  </div>{' '}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
                    {' '}
                    {v.ov?.hasHold ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                            padding: '14px',
                            background: 'var(--sq-gold)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {' '}
                          <div style={{ fontSize: '13px', marginRight: 'auto' }}>
                            <strong>
                              {'Reservation expires '}
                              {T(v.ov?.expiresText)}
                            </strong>
                            <div style={{ fontSize: '12px' }}>
                              {'Unpaid orders auto-cancel at the deadline, even while payment is being verified.'}
                            </div>
                          </div>{' '}
                          <button
                            onClick={v.ov?.onExtend}
                            className="btn btn-secondary"
                            style={{ background: 'var(--color-bg)' }}
                          >
                            {'Extend hold +24h'}
                          </button>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                        }}
                      >
                        {'CUSTOMER'}
                      </div>{' '}
                      <div style={{ fontSize: '14px', lineHeight: '1.7', paddingTop: '10px' }}>
                        <strong>{T(v.ov?.name)}</strong>
                        <br />
                        {T(v.ov?.email)}
                        {' · '}
                        {T(v.ov?.mobile)}
                        <br />
                        {T(v.ov?.shipTo)}
                      </div>{' '}
                      {v.ov?.hasNotes ? (
                        <>
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px 12px',
                              background: 'var(--color-surface)',
                              fontSize: '14px',
                            }}
                          >
                            {'Note: '}
                            {T(v.ov?.notes)}
                          </div>
                        </>
                      ) : null}{' '}
                    </section>{' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                        }}
                      >
                        {'ORDER · '}
                        {T(v.ov?.date)}
                      </div>{' '}
                      {L(v.ov?.items).map((i, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '10px 0',
                              borderBottom: '1px solid var(--color-divider)',
                              fontSize: '14px',
                            }}
                          >
                            <div style={{ minWidth: '0' }}>
                              <strong>{T(i?.name)}</strong>
                              {' × '}
                              {T(i?.quantity)}
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--color-neutral-700)',
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {T(i?.sku)} {T(i?.invText)}
                              </div>
                            </div>
                            <strong style={{ whiteSpace: 'nowrap' }}>{T(i?.lineText)}</strong>
                          </div>{' '}
                        </React.Fragment>
                      ))}{' '}
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}
                      >
                        <span>{'Subtotal'}</span>
                        <strong>{T(v.ov?.subtotalText)}</strong>
                      </div>{' '}
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px' }}
                      >
                        <span>{'Shipping'}</span>
                        <strong>{T(v.ov?.shipText)}</strong>
                      </div>{' '}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderTop: '2px solid var(--color-text)',
                          fontSize: '16px',
                          marginTop: '4px',
                        }}
                      >
                        <strong>{'Total'}</strong>
                        <strong>{T(v.ov?.totalText)}</strong>
                      </div>{' '}
                    </section>{' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                          marginBottom: '12px',
                        }}
                      >
                        {'PAYMENT'}
                      </div>{' '}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
                          gap: '12px',
                        }}
                      >
                        {' '}
                        <div className="field">
                          <label>{'Method'}</label>
                          <div
                            style={{
                              minHeight: '42px',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: '14px',
                              fontWeight: '600',
                            }}
                          >
                            {T(v.ov?.method)}
                          </div>
                        </div>{' '}
                        <div className="field">
                          <label>{'Payment status'}</label>
                          <select
                            value={v.ov?.payment_status}
                            onChange={v.ov?.onPay}
                            className="input"
                            style={{ background: 'var(--color-bg)', minHeight: '42px' }}
                          >
                            {L(v.payStatusOpts).map((o, $index) => (
                              <React.Fragment key={$index}>
                                <option value={o?.v}>{T(o?.l)}</option>
                              </React.Fragment>
                            ))}
                          </select>
                        </div>{' '}
                      </div>{' '}
                      {v.ov?.hasRef ? (
                        <>
                          <div style={{ fontSize: '13px', marginTop: '8px' }}>
                            {'Reference: '}
                            <strong>{T(v.ov?.ref)}</strong>
                          </div>
                        </>
                      ) : null}{' '}
                    </section>{' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                          marginBottom: '12px',
                        }}
                      >
                        {'FULFILLMENT'}
                      </div>{' '}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
                          gap: '12px',
                        }}
                      >
                        {' '}
                        <div className="field">
                          <label>{'Order status'}</label>
                          <select
                            value={v.ov?.order_status}
                            onChange={v.ov?.onStatus}
                            className="input"
                            style={{ background: 'var(--color-bg)', minHeight: '42px' }}
                          >
                            {L(v.orderStatusOpts).map((o, $index) => (
                              <React.Fragment key={$index}>
                                <option value={o?.v}>{T(o?.l)}</option>
                              </React.Fragment>
                            ))}
                          </select>
                        </div>{' '}
                        <div className="field">
                          <label>{'Shipping fee (₱), blank = TBD'}</label>
                          <input
                            type={'number'}
                            min={'0'}
                            value={v.ov?.shipInput}
                            onChange={v.ov?.onShip}
                            className="input"
                            style={{ background: 'var(--color-bg)', minHeight: '42px' }}
                          />
                        </div>{' '}
                      </div>{' '}
                      <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', marginTop: '10px' }}>
                        {'Stock: '}
                        <strong style={{ color: 'var(--color-text)' }}>{T(v.ov?.stock)}</strong>
                        {
                          '. Marking payment as PAID, or the order as PACKED or SHIPPED, finalizes the sale. CANCELLED or REFUNDED before that releases the reserved items. The database enforces every transition.'
                        }
                      </div>{' '}
                      {v.ov?.canRestock ? (
                        <>
                          <button onClick={v.ov?.onRestock} className="btn btn-secondary" style={{ marginTop: '12px' }}>
                            {'Return items to stock'}
                          </button>
                        </>
                      ) : null}{' '}
                    </section>{' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          letterSpacing: '.14em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                        }}
                      >
                        {'STATUS HISTORY'}
                      </div>{' '}
                      {L(v.ov?.history).map((h, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '10px minmax(0,1fr) auto',
                              gap: '12px',
                              alignItems: 'baseline',
                              padding: '10px 0',
                              borderBottom: '1px solid var(--color-divider)',
                              fontSize: '14px',
                            }}
                          >
                            <span style={{ width: '8px', height: '8px', background: 'var(--color-text)' }}></span>
                            <span style={{ minWidth: '0' }}>
                              {T(h?.text)}
                              {h?.hasNote ? (
                                <>
                                  <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                    {T(h?.note)}
                                  </div>
                                </>
                              ) : null}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>
                              {T(h?.when)}
                            </span>
                          </div>{' '}
                        </React.Fragment>
                      ))}{' '}
                      <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', paddingTop: '8px' }}>
                        {T(v.ov?.historyNote)}
                      </div>{' '}
                    </section>{' '}
                  </div>{' '}
                </div>{' '}
              </div>
            </>
          ) : null}

          {v.confirming ? (
            <>
              {' '}
              <div
                onClick={v.cancelConfirm}
                className="dialog-backdrop"
                style={{
                  position: 'fixed',
                  inset: '0',
                  zIndex: '120',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  role={'alertdialog'}
                  aria-label={v.confirmTitle}
                  className="dialog"
                  style={{
                    width: 'min(440px,100%)',
                    background: 'var(--color-bg)',
                    border: '2px solid var(--color-text)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  {' '}
                  <div style={{ fontSize: '20px', fontWeight: '800', textTransform: 'uppercase' }}>
                    {T(v.confirmTitle)}
                  </div>{' '}
                  <p style={{ margin: '0', fontSize: '14px', color: 'var(--color-neutral-800)' }}>{T(v.confirmBody)}</p>{' '}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      marginTop: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button onClick={v.cancelConfirm} className="btn btn-secondary" style={{ minHeight: '44px' }}>
                      {'Cancel'}
                    </button>
                    <button onClick={v.runConfirm} className="btn btn-primary" style={{ minHeight: '44px' }}>
                      {T(v.confirmLabel)}
                    </button>
                  </div>{' '}
                </div>{' '}
              </div>
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
                  bottom: '24px',
                  transform: 'translateX(-50%)',
                  zIndex: '130',
                  background: 'var(--color-text)',
                  color: 'var(--color-bg)',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: 'var(--shadow-md)',
                  maxWidth: 'calc(100vw - 32px)',
                }}
              >
                {T(v.toast)}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
