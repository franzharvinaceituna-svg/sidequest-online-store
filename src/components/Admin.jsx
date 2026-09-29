// SIDE QUEST — Admin
// Ported from Admin.dc.html (Claude Design Component) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import ProductImage from './ProductImage.jsx';

export default class Admin extends React.Component {
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
    if (this.unsub) this.unsub();
  }
  componentDidUpdate(pp) {
    if (pp.tab !== this.props.tab && (this.state.orderView || this.state.edit))
      this.setState({ orderView: null, edit: null });
  }
  showToast(m) {
    if (this.props.onToast) this.props.onToast(m);
  }
  renderVals() {
    const S = window.SQStore;
    if (!S || !window.SQView || !this.unsub) return { ready: false };
    const v = { ready: true, stop: (e) => e.stopPropagation(), isLocal: S.backend !== 'supabase', adminTabs: [] };
    const A = S.auth;
    if (A) {
      const st = this.state;
      v.signOut = () => A.signOut();
      if (!A.ready()) return Object.assign(v, { gateLoading: true });
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
      v.isSignedIn = true;
      v.roleLabel = prof.role === 'OWNER' ? 'Owner' : 'Staff';
    }
    this.adminVals(v, S, this.props.tab || 'dashboard');
    return v;
  }

  adminVals(v, S, tab) {
    const st = this.state,
      allP = S.products({ includeInactive: true }),
      orders = S.orders(),
      thr = S.SETTINGS.low_stock_threshold;
    v.isDash = tab === 'dashboard';
    v.isInv = tab === 'inventory';
    v.isOrders = tab === 'orders';
    v.adminTabs = [
      ['dashboard', 'DASHBOARD', '#/admin'],
      ['inventory', 'INVENTORY', '#/admin/inventory'],
      ['orders', 'ORDERS', '#/admin/orders'],
    ].map(([k, label, href]) => ({ label, href, bar: tab === k ? 'var(--color-accent)' : 'transparent' }));
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
        method: SQView.PAY[o.payment_method],
        onView: open(o.order_id),
      };
    };
    v.noOrders = !orders.length;
    const live = allP.filter((p) => p.status === 'ACTIVE');
    const low = live
      .filter((p) => p.available_quantity <= thr)
      .sort((a, b) => a.available_quantity - b.available_quantity);
    v.stats = [
      { label: 'Total products', value: allP.filter((p) => p.status !== 'ARCHIVED').length, sub: 'Excluding archived' },
      {
        label: 'Active listings',
        value: live.filter((p) => p.available_quantity > 0).length,
        sub: 'Live and in stock',
      },
      {
        label: 'Low stock',
        value: low.length,
        sub: `${thr} or fewer available`,
        color: low.length ? 'var(--color-accent-700)' : '',
      },
      { label: 'Orders', value: orders.length, sub: 'All time' },
      {
        label: 'Pending orders',
        value: orders.filter((o) => ['PENDING', 'PAYMENT_PENDING'].includes(o.order_status)).length,
        sub: 'Awaiting payment',
      },
      {
        label: 'Sales',
        value: SQView.peso(orders.filter((o) => o.payment_status === 'PAID').reduce((s, o) => s + o.total, 0)),
        sub: 'Paid orders',
      },
    ].map((s) => ({ ...s, color: s.color || 'var(--color-text)' }));
    v.lowRows = low.slice(0, 8).map((p) => {
      const out = p.available_quantity <= 0;
      return {
        name: p.name,
        sku: p.sku,
        availText: out ? 'SOLD OUT' : `${p.available_quantity} LEFT`,
        bg: out ? 'var(--color-accent-100)' : SQView.GOLD,
        fg: out ? 'var(--color-accent-800)' : 'var(--color-text)',
      };
    });
    v.recentOrders = orders.slice(0, 6).map(orderRow);
    v.orderRows = orders.map(orderRow);
    const aq = st.adminQ.trim().toLowerCase();
    v.adminQ = st.adminQ;
    v.onAdminQ = (e) => this.setState({ adminQ: e.target.value });
    v.resetDemo = () => {
      if (
        confirm(
          'Reset ALL demo data in this browser? Products, orders, cart and wishlist go back to the starting demo set.',
        )
      ) {
        S.resetDemoData();
        this.showToast('Demo data restored');
      }
    };
    v.invRows = allP
      .filter((p) => !aq || (p.sku + ' ' + p.name).toLowerCase().includes(aq))
      .map((p) => {
        const s = SQView.statusStyle(p.status),
          arch = p.status === 'ARCHIVED';
        return {
          image: SQView.imgVM(p),
          name: p.name,
          sku: p.sku,
          type: SQView.TYPES[p.product_type],
          cat: SQView.catName(p.category),
          price: SQView.peso(p.price),
          hasSale: S.isOnSale(p),
          salePrice: SQView.peso(p.sale_price),
          qty: p.quantity,
          reserved: p.reserved_quantity,
          avail: p.available_quantity,
          availColor: p.available_quantity <= 0 ? 'var(--color-accent-700)' : 'var(--color-text)',
          status: p.status,
          stBg: s.bg,
          stFg: s.fg,
          flags:
            [p.featured && '★ Featured', p.sale && 'Sale', p.track_items && 'Unique items']
              .filter(Boolean)
              .join(' · ') || '—',
          op: arch ? 0.55 : 1,
          archiveLabel: arch ? 'Restore' : 'Archive',
          onEdit: () => this.openEdit(p.product_id),
          onArchive: () =>
            this.act(
              S.setProductStatus(p.product_id, arch ? 'DRAFT' : 'ARCHIVED'),
              arch ? 'Restored as draft' : 'Archived',
            ),
        };
      });
    v.openNew = () =>
      this.setState({
        editErr: '',
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
      v.editTitle = ed.isNew ? 'Add product' : 'Edit product';
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
      v.editSections = [
        {
          title: 'Listing',
          fields: [
            F('name', 'Product name', 'text', { full: true }),
            F('sku', 'SKU (becomes product ID)'),
            F('status', 'Status', 'select', { options: S.PRODUCT_STATUSES }),
            F('category', 'Category', 'select', { options: S.categories().map((c) => [c.category_id, c.label]) }),
            F('subcategory', 'Subcategory'),
            F('product_type', 'Product type', 'select', { options: Object.entries(SQView.TYPES) }),
          ],
        },
        {
          title: 'Card details',
          fields: [
            F('pokemon', 'Pokémon'),
            F('set', 'Set'),
            F('card_number', 'Card number'),
            F('language', 'Language', 'select', { options: ['English', 'Japanese', 'Chinese', 'Korean', 'Other'] }),
            F('condition', 'Condition', 'select', { options: ['', 'NM', 'LP', 'MP', 'HP', 'DMG', 'New', 'Sealed'] }),
            F('grading_company', 'Grading company', 'select', { options: ['', 'PSA', 'BGS', 'CGC', 'Other'] }),
            F('grade', 'Grade', 'select', {
              options: [['', '—'], ...[10, 9.5, 9, 8.5, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => [g, String(g)])],
            }),
          ],
        },
        {
          title: 'Price & stock',
          fields: [
            F('price', 'Price (₱)', 'number'),
            F('sale_price', 'Sale price (₱)', 'number'),
            F('cost', 'Cost (₱, admin only)', 'number'),
            F('quantity', 'Quantity on hand', 'number'),
            F('reserved_quantity', 'Reserved', 'number'),
          ],
        },
        {
          title: 'Visibility',
          fields: [
            F('featured', 'Featured on homepage', 'check'),
            F('sale', 'On sale', 'check'),
            F('track_items', 'Track unique physical items', 'check'),
          ],
        },
        {
          title: 'Description',
          fields: [
            F('description', 'Description', 'area', { full: true }),
            F('tags', 'Tags (comma separated)', 'text', { full: true }),
          ],
        },
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
          ? 'Listing photos upload to Supabase Storage (product-images/products/<SKU>/). Exact photos of each physical card go on the item below.'
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
      v.ov = {
        id: o.order_id,
        date: SQView.fmtDate(o.created_at),
        payment_status: o.payment_status,
        order_status: o.order_status,
        stock: SQView.label(o.stock),
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
        onRestock: () => this.act(S.restockOrder(o.order_id), 'Items returned to stock'),
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
      };
    }
  }

  openEdit(id) {
    const S = window.SQStore,
      p = S.products({ includeInactive: true }).find((x) => x.product_id === id);
    if (!p) return;
    const d = JSON.parse(JSON.stringify(p));
    delete d.available_quantity;
    this.setState({ edit: { isNew: false, d }, editErr: '' });
  }

  render() {
    let rv = {};
    try {
      rv = this.renderVals() || {};
    } catch (e) {
      console.error('[SIDE QUEST] Admin.renderVals()', e);
    }
    const v = { ...this.props, ...rv };
    return (
      <div className="sc-host" style={this.props.__hostStyle}>
        {' '}
        <div data-screen-label={'Admin'} style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
          {' '}
          <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
            {' '}
            <div
              style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 clamp(16px,3vw,32px)',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(12px,3vw,32px)',
                flexWrap: 'wrap',
                minHeight: '60px',
              }}
            >
              {' '}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: '800',
                  letterSpacing: '.06em',
                }}
              >
                <span style={{ display: 'flex', gap: '3px' }}>
                  <span style={{ width: '14px', height: '4px', background: 'var(--sq-gold)' }}></span>
                  <span style={{ width: '14px', height: '4px', background: 'var(--color-accent)' }}></span>
                </span>
                {'SIDE QUEST '}
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    background: 'var(--sq-gold)',
                    color: 'var(--color-text)',
                  }}
                >
                  {'ADMIN'}
                </span>
              </div>{' '}
              <nav style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                {' '}
                {L(v.adminTabs).map((t, $index) => (
                  <React.Fragment key={$index}>
                    <a
                      href={t?.href}
                      style={{
                        padding: '19px 12px 16px',
                        fontSize: '13px',
                        fontWeight: '800',
                        letterSpacing: '.06em',
                        textDecoration: 'none',
                        color: 'var(--color-bg)',
                        borderBottom: `3px solid ${S(t?.bar)}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {T(t?.label)}
                    </a>
                  </React.Fragment>
                ))}{' '}
              </nav>{' '}
              <a
                href={'#/'}
                style={{
                  marginLeft: 'auto',
                  fontSize: '13px',
                  color: 'var(--color-neutral-300)',
                  textDecoration: 'none',
                }}
              >
                {'← View store'}
              </a>{' '}
            </div>{' '}
          </div>{' '}
          {v.isLocal ? (
            <>
              {' '}
              <div
                style={{
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent-800)',
                  borderBottom: '1px solid var(--color-accent-300)',
                }}
              >
                {' '}
                <div
                  style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '10px clamp(16px,3vw,32px)',
                    fontSize: '13px',
                  }}
                >
                  <strong>{'Local demo backend, not secured.'}</strong>
                  {
                    ' Data is saved only in this browser. Set BACKEND to "supabase" in src/config/runtime-config.js to use the secure live database.'
                  }
                </div>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.isSignedIn ? (
            <>
              {' '}
              <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)' }}>
                {' '}
                <div
                  style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    padding: '8px clamp(16px,3vw,32px)',
                    fontSize: '13px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {'Live database · Signed in as '}
                    <strong>{T(v.userEmail)}</strong>
                    {' · '}
                    {T(v.roleLabel)}
                  </span>
                  <button
                    onClick={v.signOut}
                    className="btn btn-ghost"
                    style={{ marginLeft: 'auto', fontSize: '13px' }}
                  >
                    {'Sign out'}
                  </button>
                </div>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.gateLoading ? (
            <>
              <div
                style={{
                  maxWidth: '1400px',
                  margin: '0 auto',
                  padding: '48px clamp(16px,3vw,32px)',
                  fontSize: '15px',
                  color: 'var(--color-neutral-700)',
                }}
              >
                {'Connecting to the store database…'}
              </div>
            </>
          ) : null}{' '}
          {v.gateLogin ? (
            <>
              {' '}
              <div
                style={{
                  maxWidth: '440px',
                  margin: '0 auto',
                  padding: '56px 20px 80px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
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
                  {'STORE ADMIN'}
                </div>{' '}
                <h1 style={{ margin: '0', textTransform: 'uppercase', fontSize: '34px' }}>{'Sign in'}</h1>{' '}
                <p style={{ margin: '0', fontSize: '14px', color: 'var(--color-neutral-800)' }}>
                  {'Only accounts listed as SIDE QUEST admins can manage inventory and orders.'}
                </p>{' '}
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
                  style={{ justifyContent: 'space-between', padding: '15px 18px', fontSize: '15px' }}
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
            </>
          ) : null}{' '}
          {v.gateDenied ? (
            <>
              {' '}
              <div
                style={{
                  maxWidth: '560px',
                  margin: '0 auto',
                  padding: '56px 20px 80px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                {' '}
                <h1 style={{ margin: '0', textTransform: 'uppercase', fontSize: '30px' }}>{'Not authorized'}</h1>{' '}
                <p style={{ margin: '0', fontSize: '15px' }}>
                  {"You're signed in as "}
                  <strong>{T(v.userEmail)}</strong>
                  {", but this account isn't a SIDE QUEST admin. Ask the owner to add you."}
                </p>{' '}
                <button onClick={v.signOut} className="btn btn-secondary">
                  {'Sign out'}
                </button>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px clamp(16px,3vw,32px) 80px' }}>
            {' '}
            {v.isDash ? (
              <>
                {' '}
                <h1 style={{ fontSize: 'clamp(28px,3.4vw,40px)', margin: '0 0 16px', textTransform: 'uppercase' }}>
                  {'Dashboard'}
                </h1>{' '}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                    gap: '1px',
                    background: 'var(--color-divider)',
                    border: '1px solid var(--color-divider)',
                    marginBottom: '32px',
                  }}
                >
                  {' '}
                  {L(v.stats).map((s, $index) => (
                    <React.Fragment key={$index}>
                      {' '}
                      <div
                        style={{
                          background: 'var(--color-bg)',
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '.1em',
                            color: 'var(--color-neutral-700)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {T(s?.label)}
                        </span>
                        <span style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-.02em', color: s?.color }}>
                          {T(s?.value)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(s?.sub)}</span>
                      </div>{' '}
                    </React.Fragment>
                  ))}{' '}
                </div>{' '}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))',
                    gap: '32px',
                  }}
                >
                  {' '}
                  <div>
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        borderBottom: '2px solid var(--color-text)',
                        paddingBottom: '8px',
                      }}
                    >
                      <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Low stock'}</span>
                      <a href={'#/admin/inventory'} style={{ fontSize: '13px' }}>
                        {'Inventory →'}
                      </a>
                    </div>{' '}
                    {L(v.lowRows).map((r, $index) => (
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
                          <span style={{ minWidth: '0' }}>
                            <strong>{T(r?.name)}</strong>{' '}
                            <span style={{ color: 'var(--color-neutral-700)' }}>{T(r?.sku)}</span>
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              fontSize: '12px',
                              fontWeight: '800',
                              background: r?.bg,
                              color: r?.fg,
                              whiteSpace: 'nowrap',
                              alignSelf: 'center',
                            }}
                          >
                            {T(r?.availText)}
                          </span>
                        </div>{' '}
                      </React.Fragment>
                    ))}{' '}
                  </div>{' '}
                  <div>
                    {' '}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        borderBottom: '2px solid var(--color-text)',
                        paddingBottom: '8px',
                      }}
                    >
                      <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>{'Recent orders'}</span>
                      <a href={'#/admin/orders'} style={{ fontSize: '13px' }}>
                        {'All orders →'}
                      </a>
                    </div>{' '}
                    {L(v.recentOrders).map((o, $index) => (
                      <React.Fragment key={$index}>
                        {' '}
                        <button
                          onClick={o?.onView}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            width: '100%',
                            padding: '10px 0',
                            border: '0',
                            borderBottom: '1px solid var(--color-divider)',
                            background: 'transparent',
                            font: 'inherit',
                            fontSize: '14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--color-text)',
                          }}
                        >
                          <strong>{T(o?.id)}</strong>
                          <span style={{ flex: '1', color: 'var(--color-neutral-700)' }}>{T(o?.customer)}</span>
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
                        </button>{' '}
                      </React.Fragment>
                    ))}{' '}
                    {v.noOrders ? (
                      <>
                        <p
                          style={{
                            padding: '12px 0',
                            margin: '0',
                            color: 'var(--color-neutral-700)',
                            fontSize: '14px',
                          }}
                        >
                          {'No orders yet. Place a test order from the store to see it here.'}
                        </p>
                      </>
                    ) : null}{' '}
                  </div>{' '}
                </div>{' '}
              </>
            ) : null}{' '}
            {v.isInv ? (
              <>
                {' '}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}
                >
                  {' '}
                  <h1
                    style={{
                      fontSize: 'clamp(28px,3.4vw,40px)',
                      margin: '0',
                      textTransform: 'uppercase',
                      marginRight: 'auto',
                    }}
                  >
                    {'Inventory'}
                  </h1>{' '}
                  <input
                    placeholder={'Search SKU or name'}
                    value={v.adminQ}
                    onChange={v.onAdminQ}
                    className="input"
                    style={{ width: '240px', minHeight: '40px', background: 'var(--color-bg)' }}
                  />{' '}
                  {v.isLocal ? (
                    <>
                      <button onClick={v.resetDemo} className="btn btn-secondary" style={{ minHeight: '40px' }}>
                        {'Reset demo data'}
                      </button>
                    </>
                  ) : null}{' '}
                  <button onClick={v.openNew} className="btn btn-primary" style={{ minHeight: '40px', gap: '8px' }}>
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
                    {'Add product'}
                  </button>{' '}
                </div>{' '}
                <div style={{ overflowX: 'auto', borderTop: '2px solid var(--color-text)' }}>
                  {' '}
                  <table className="table" style={{ minWidth: '1060px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '56px' }}></th>
                        <th>{'SKU / Product'}</th>
                        <th>{'Category'}</th>
                        <th>{'Price'}</th>
                        <th>{'Qty'}</th>
                        <th>{'Reserved'}</th>
                        <th>{'Available'}</th>
                        <th>{'Status'}</th>
                        <th>{'Flags'}</th>
                        <th></th>
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
                                }}
                              >
                                <ProductImage
                                  image={r?.image}
                                  compact={true}
                                  __hostStyle={{ position: 'absolute', inset: '0' }}
                                />
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: '800' }}>{T(r?.name)}</div>
                              <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                                {T(r?.sku)}
                                {' · '}
                                {T(r?.type)}
                              </div>
                            </td>

                            <td>{T(r?.cat)}</td>

                            <td style={{ whiteSpace: 'nowrap' }}>
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

                            <td>{T(r?.qty)}</td>

                            <td>{T(r?.reserved)}</td>

                            <td>
                              <strong style={{ color: r?.availColor }}>{T(r?.avail)}</strong>
                            </td>

                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  letterSpacing: '.04em',
                                  background: r?.stBg,
                                  color: r?.stFg,
                                }}
                              >
                                {T(r?.status)}
                              </span>
                            </td>

                            <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{T(r?.flags)}</td>

                            <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                              <button onClick={r?.onEdit} className="btn btn-ghost" style={{ fontSize: '13px' }}>
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
                </div>{' '}
              </>
            ) : null}{' '}
            {v.isOrders ? (
              <>
                {' '}
                <h1 style={{ fontSize: 'clamp(28px,3.4vw,40px)', margin: '0 0 16px', textTransform: 'uppercase' }}>
                  {'Orders'}
                </h1>{' '}
                <div style={{ overflowX: 'auto', borderTop: '2px solid var(--color-text)' }}>
                  {' '}
                  <table className="table" style={{ minWidth: '820px' }}>
                    <thead>
                      <tr>
                        <th>{'Order'}</th>
                        <th>{'Date'}</th>
                        <th>{'Customer'}</th>
                        <th>{'Items'}</th>
                        <th>{'Total'}</th>
                        <th>{'Payment'}</th>
                        <th>{'Status'}</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {L(v.orderRows).map((o, $index) => (
                        <React.Fragment key={$index}>
                          {' '}
                          <tr>
                            <td>
                              <strong>{T(o?.id)}</strong>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{T(o?.date)}</td>
                            <td>
                              {T(o?.customer)}
                              <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(o?.email)}</div>
                            </td>
                            <td>{T(o?.itemCount)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <strong>{T(o?.total)}</strong>
                            </td>

                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  background: o?.pBg,
                                  color: o?.pFg,
                                }}
                              >
                                {T(o?.payStatus)}
                              </span>
                              <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(o?.method)}</div>
                            </td>

                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  background: o?.bg,
                                  color: o?.fg,
                                }}
                              >
                                {T(o?.status)}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <button onClick={o?.onView} className="btn btn-ghost" style={{ fontSize: '13px' }}>
                                {'View'}
                              </button>
                            </td>
                          </tr>{' '}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>{' '}
                  {v.noOrders ? (
                    <>
                      <p style={{ padding: '16px 0', margin: '0', color: 'var(--color-neutral-700)' }}>
                        {'No orders yet. Place a test order from the store to see it here.'}
                      </p>
                    </>
                  ) : null}{' '}
                </div>{' '}
              </>
            ) : null}{' '}
          </div>{' '}
          {v.editing ? (
            <>
              {' '}
              <div
                onClick={v.closeEdit}
                style={{
                  position: 'fixed',
                  inset: '0',
                  zIndex: '90',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  style={{
                    width: 'min(780px,100%)',
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
                      style={{ fontWeight: '800', fontSize: '20px', textTransform: 'uppercase', marginRight: 'auto' }}
                    >
                      {T(v.editTitle)}
                    </div>{' '}
                    <button
                      onClick={v.closeEdit}
                      aria-label={'Close'}
                      style={{
                        width: '40px',
                        height: '40px',
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
                        strokeWidth={'2.2'}
                        strokeLinecap={'round'}
                      >
                        <path d={'M18 6 6 18M6 6l12 12'}></path>
                      </svg>
                    </button>{' '}
                  </div>{' '}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {' '}
                    <section>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          paddingBottom: '8px',
                          borderBottom: '1px solid var(--color-divider)',
                          marginBottom: '12px',
                        }}
                      >
                        {'Photos'}
                      </div>{' '}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {' '}
                        {L(v.editPhotos).map((ph, $index) => (
                          <React.Fragment key={$index}>
                            {' '}
                            <div style={{ width: '112px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {' '}
                              <div
                                style={{
                                  position: 'relative',
                                  width: '112px',
                                  height: '112px',
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
                                  fontWeight: '800',
                                  letterSpacing: '.06em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {T(ph?.label)}
                              </div>{' '}
                              <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
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
                          className="sqp4"
                          style={{
                            width: '112px',
                            height: '112px',
                            border: '2px dashed var(--color-divider)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '800',
                            textAlign: 'center',
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
                          >
                            <path d={'M5 12h14M12 5v14'}></path>
                          </svg>
                          {'UPLOAD '}
                          <input
                            type={'file'}
                            accept={'image/*'}
                            multiple={true}
                            onChange={v.onUpload}
                            style={{ display: 'none' }}
                          />{' '}
                        </label>{' '}
                      </div>{' '}
                      <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', marginTop: '8px' }}>
                        {T(v.photoNote)}
                      </div>{' '}
                    </section>{' '}
                    {v.editExisting ? (
                      <>
                        {' '}
                        <section>
                          {' '}
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '800',
                              letterSpacing: '.1em',
                              textTransform: 'uppercase',
                              paddingBottom: '8px',
                              borderBottom: '1px solid var(--color-divider)',
                              marginBottom: '12px',
                            }}
                          >
                            {'Quick stock actions'}
                          </div>{' '}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {' '}
                            <button onClick={v.qaReserve} className="btn btn-secondary">
                              {'Mark reserved (+1)'}
                            </button>{' '}
                            <button onClick={v.qaRelease} className="btn btn-secondary">
                              {'Release reserved (−1)'}
                            </button>{' '}
                            <button onClick={v.qaSold} className="btn btn-secondary">
                              {'Mark sold (−1 qty)'}
                            </button>{' '}
                            <span style={{ fontSize: '14px', marginLeft: 'auto' }}>
                              {'Available: '}
                              <strong>{T(v.editAvail)}</strong>
                            </span>{' '}
                          </div>{' '}
                          {v.hasEditItems ? (
                            <>
                              {' '}
                              <div
                                style={{
                                  marginTop: '16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  flexWrap: 'wrap',
                                  borderTop: '1px solid var(--color-divider)',
                                  paddingTop: '12px',
                                }}
                              >
                                {' '}
                                <div
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    letterSpacing: '.1em',
                                    textTransform: 'uppercase',
                                    marginRight: 'auto',
                                  }}
                                >
                                  {'Physical items · exact photos'}
                                </div>{' '}
                                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                      borderBottom: '1px solid var(--color-divider)',
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
                                          fontWeight: '800',
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
                                                fontWeight: '800',
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
                                        className="sqp4"
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
                                          fontWeight: '800',
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
                        </section>{' '}
                      </>
                    ) : null}{' '}
                    {L(v.editSections).map((s, $index) => (
                      <React.Fragment key={$index}>
                        {' '}
                        <section>
                          {' '}
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '800',
                              letterSpacing: '.1em',
                              textTransform: 'uppercase',
                              paddingBottom: '8px',
                              borderBottom: '1px solid var(--color-divider)',
                              marginBottom: '12px',
                            }}
                          >
                            {T(s?.title)}
                          </div>{' '}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
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
                                        style={{ background: 'var(--color-bg)' }}
                                      />
                                    </>
                                  ) : null}{' '}
                                  {f?.isSelect ? (
                                    <>
                                      <select
                                        value={f?.value}
                                        onChange={f?.onChange}
                                        className="input"
                                        style={{ background: 'var(--color-bg)' }}
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
                                        style={{ background: 'var(--color-bg)' }}
                                      ></textarea>
                                    </>
                                  ) : null}{' '}
                                  {f?.isCheck ? (
                                    <>
                                      <label
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          fontSize: '14px',
                                          color: 'var(--color-text)',
                                          cursor: 'pointer',
                                          minHeight: '36px',
                                          margin: '0',
                                        }}
                                      >
                                        <input
                                          type={'checkbox'}
                                          checked={f?.checked}
                                          onChange={f?.onChange}
                                          style={{ accentColor: 'var(--color-accent)', width: '18px', height: '18px' }}
                                        />
                                        {T(f?.label)}
                                      </label>
                                    </>
                                  ) : null}{' '}
                                </div>{' '}
                              </React.Fragment>
                            ))}{' '}
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
                      padding: '14px 20px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {' '}
                    {v.hasEditErr ? (
                      <>
                        <span
                          role={'alert'}
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--color-accent-700)',
                            marginRight: 'auto',
                          }}
                        >
                          {T(v.editErr)}
                        </span>
                      </>
                    ) : null}{' '}
                    <button onClick={v.closeEdit} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
                      {'Cancel'}
                    </button>{' '}
                    <button
                      onClick={v.saveEdit}
                      disabled={v.saving}
                      className="btn btn-primary"
                      style={{ minWidth: '160px', justifyContent: 'space-between' }}
                    >
                      {T(v.saveLabel)} <span>{'→'}</span>
                    </button>{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.viewingOrder ? (
            <>
              {' '}
              <div
                onClick={v.closeOrder}
                style={{
                  position: 'fixed',
                  inset: '0',
                  zIndex: '90',
                  background: 'color-mix(in srgb, var(--color-neutral-900) 55%, transparent)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {' '}
                <div
                  onClick={v.stop}
                  style={{
                    width: 'min(640px,100%)',
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
                      background: 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 20px',
                      borderBottom: '2px solid var(--color-text)',
                    }}
                  >
                    {' '}
                    <div style={{ marginRight: 'auto' }}>
                      <div style={{ fontWeight: '800', fontSize: '20px' }}>{T(v.ov?.id)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(v.ov?.date)}</div>
                    </div>{' '}
                    <button
                      onClick={v.closeOrder}
                      aria-label={'Close'}
                      style={{
                        width: '40px',
                        height: '40px',
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
                        strokeWidth={'2.2'}
                        strokeLinecap={'round'}
                      >
                        <path d={'M18 6 6 18M6 6l12 12'}></path>
                      </svg>
                    </button>{' '}
                  </div>{' '}
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    {' '}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
                        gap: '12px',
                      }}
                    >
                      {' '}
                      <div className="field">
                        <label>{'Payment status'}</label>
                        <select
                          value={v.ov?.payment_status}
                          onChange={v.ov?.onPay}
                          className="input"
                          style={{ background: 'var(--color-bg)' }}
                        >
                          {L(v.payStatusOpts).map((o, $index) => (
                            <React.Fragment key={$index}>
                              <option value={o?.v}>{T(o?.l)}</option>
                            </React.Fragment>
                          ))}
                        </select>
                      </div>{' '}
                      <div className="field">
                        <label>{'Order status'}</label>
                        <select
                          value={v.ov?.order_status}
                          onChange={v.ov?.onStatus}
                          className="input"
                          style={{ background: 'var(--color-bg)' }}
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
                          style={{ background: 'var(--color-bg)' }}
                        />
                      </div>{' '}
                    </div>{' '}
                    <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)', marginTop: '-12px' }}>
                      {'Stock: '}
                      <strong style={{ color: 'var(--color-text)' }}>{T(v.ov?.stock)}</strong>
                      {
                        '. Marking payment as PAID, or the order as PACKED or SHIPPED, finalizes the sale. CANCELLED or REFUNDED before that releases the reserved items.'
                      }
                    </div>{' '}
                    {v.ov?.hasHold ? (
                      <>
                        {' '}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                            padding: '12px 14px',
                            background: 'var(--color-surface)',
                            marginTop: '-10px',
                          }}
                        >
                          {' '}
                          <div style={{ fontSize: '13px', marginRight: 'auto' }}>
                            <strong>
                              {'Reservation expires '}
                              {T(v.ov?.expiresText)}
                            </strong>
                            <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
                              {'Unpaid orders auto-cancel at the deadline, even while payment is being verified.'}
                            </div>
                          </div>{' '}
                          <button onClick={v.ov?.onExtend} className="btn btn-secondary">
                            {'Extend hold +24h'}
                          </button>{' '}
                        </div>{' '}
                      </>
                    ) : null}{' '}
                    {v.ov?.canRestock ? (
                      <>
                        <button
                          onClick={v.ov?.onRestock}
                          className="btn btn-secondary"
                          style={{ alignSelf: 'flex-start', marginTop: '-10px' }}
                        >
                          {'Return items to stock'}
                        </button>
                      </>
                    ) : null}{' '}
                    <div>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          letterSpacing: '.1em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                        }}
                      >
                        {'CUSTOMER'}
                      </div>{' '}
                      <div style={{ fontSize: '14px', lineHeight: '1.7', paddingTop: '8px' }}>
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
                    </div>{' '}
                    <div>
                      {' '}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          letterSpacing: '.1em',
                          paddingBottom: '8px',
                          borderBottom: '2px solid var(--color-text)',
                        }}
                      >
                        {'ITEMS'}
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
                            <div>
                              <strong>{T(i?.name)}</strong>
                              {' × '}
                              {T(i?.quantity)}
                              <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>
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
                        }}
                      >
                        <strong>{'Total'}</strong>
                        <strong>{T(v.ov?.totalText)}</strong>
                      </div>{' '}
                    </div>{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </>
          ) : null}{' '}
        </div>
      </div>
    );
  }
}
