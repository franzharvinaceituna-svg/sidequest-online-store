// SIDE QUEST — shared presentation helpers (formatting, labels, image view-models).
// Pure functions used by the storefront and admin. No data writes here.
(function () {
  if (window.SQView) return;
  const GOLD = 'var(--sq-gold)';
  const COND = { NM: 'Near Mint (NM)', LP: 'Lightly Played (LP)', MP: 'Moderately Played (MP)', HP: 'Heavily Played (HP)', DMG: 'Damaged (DMG)', New: 'New', Sealed: 'Factory sealed' };
  const TYPES = { SINGLE: 'Single card', GRADED_CARD: 'Graded card', SEALED: 'Sealed product', ACCESSORY: 'Accessory', COLLECTIBLE: 'Collectible', PLUSH: 'Plush', OTHER: 'Other' };
  const PAY = { GCASH: 'GCash', BANK_TRANSFER: 'Bank transfer', ONLINE_GATEWAY: 'Online payment', COD: 'Cash on delivery' };
  const PROVINCES = ['Metro Manila','Abra','Agusan del Norte','Agusan del Sur','Aklan','Albay','Antique','Apayao','Aurora','Basilan','Bataan','Batanes','Batangas','Benguet','Biliran','Bohol','Bukidnon','Bulacan','Cagayan','Camarines Norte','Camarines Sur','Camiguin','Capiz','Catanduanes','Cavite','Cebu','Cotabato','Davao de Oro','Davao del Norte','Davao del Sur','Davao Occidental','Davao Oriental','Dinagat Islands','Eastern Samar','Guimaras','Ifugao','Ilocos Norte','Ilocos Sur','Iloilo','Isabela','Kalinga','La Union','Laguna','Lanao del Norte','Lanao del Sur','Leyte','Maguindanao del Norte','Maguindanao del Sur','Marinduque','Masbate','Misamis Occidental','Misamis Oriental','Mountain Province','Negros Occidental','Negros Oriental','Northern Samar','Nueva Ecija','Nueva Vizcaya','Occidental Mindoro','Oriental Mindoro','Palawan','Pampanga','Pangasinan','Quezon','Quirino','Rizal','Romblon','Samar','Sarangani','Siquijor','Sorsogon','South Cotabato','Southern Leyte','Sultan Kudarat','Sulu','Surigao del Norte','Surigao del Sur','Tarlac','Tawi-Tawi','Zambales','Zamboanga del Norte','Zamboanga del Sur','Zamboanga Sibugay'];

  const peso = n => '₱' + Math.round(Number(n) || 0).toLocaleString('en-PH');
  const label = s => String(s || '').replace(/_/g, ' ');
  const fmtDate = iso => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const shipToText = a => [a.address, a.city, a.province, a.postal].filter(Boolean).join(', ');
  const catName = id => { const c = window.SQStore && window.SQStore.category(id); return c ? c.name : ''; };
  const kindOf = p => ({ GRADED_CARD: 'slab', SINGLE: 'card', SEALED: 'box' }[p.product_type] || 'item');

  function imgVM(p, i = 0) {
    const im = (p.images || [])[i] || {}, k = kindOf(p), back = /back/.test(im.kind || '');
    let title = p.pokemon || p.name, sub = [p.set, p.card_number].filter(Boolean).join(' · ');
    if (k === 'box' || k === 'item') { title = p.name; sub = p.subcategory || catName(p.category); }
    return { url: im.url || '', kind: k, title, sub: sub || catName(p.category), side: back ? 'Back' : '', gradeCo: p.grading_company || '', grade: p.grade != null ? String(p.grade) : '' };
  }
  function metaOf(p) {
    const bits = [];
    if (p.product_type === 'GRADED_CARD') bits.push(`${p.grading_company} ${p.grade}`);
    else if (p.condition && p.product_type === 'SINGLE') bits.push(p.condition);
    if (['SINGLE', 'GRADED_CARD', 'SEALED'].includes(p.product_type) && p.language) bits.push(p.language);
    if (p.set && p.product_type !== 'SEALED') bits.push(p.set);
    return bits.join(' · ');
  }
  function availOf(av) {
    if (av <= 0) return { text: 'Sold out', dot: 'var(--color-neutral-500)' };
    if (av <= 3) return { text: av === 1 ? 'Only 1 left' : `Only ${av} left`, dot: GOLD };
    return { text: 'In stock', dot: 'var(--color-text)' };
  }
  function badgeOf(p) {
    const S = window.SQStore;
    if (p.available_quantity <= 0) return { t: 'SOLD OUT', bg: 'var(--color-neutral-700)', fg: 'var(--color-bg)' };
    if (S.isOnSale(p)) return { t: `SALE −${Math.round((1 - p.sale_price / p.price) * 100)}%`, bg: 'var(--color-accent)', fg: 'var(--color-bg)' };
    if (p.product_type === 'GRADED_CARD') return { t: `${p.grading_company} ${p.grade}`, bg: 'var(--color-text)', fg: 'var(--color-bg)' };
    if (Date.now() - new Date(p.created_at).getTime() < 14 * 864e5) return { t: 'NEW', bg: GOLD, fg: 'var(--color-text)' };
    return null;
  }
  function statusStyle(s) {
    const gold = [GOLD, 'var(--color-text)'], ink = ['var(--color-text)', 'var(--color-bg)'], soft = ['var(--color-neutral-200)', 'var(--color-neutral-800)'], red = ['var(--color-accent-100)', 'var(--color-accent-800)'];
    const m = { PENDING: gold, PAYMENT_PENDING: gold, PENDING_VERIFICATION: gold, UNPAID: red, FAILED: red, PAID: ink, PROCESSING: ink, PACKED: ink, SHIPPED: ink, COMPLETED: soft, CANCELLED: red, REFUNDED: soft, ACTIVE: ink, DRAFT: soft, ARCHIVED: soft, AVAILABLE: ink, RESERVED: gold, SOLD: soft };
    const [bg, fg] = m[s] || soft; return { bg, fg };
  }

  window.SQView = { GOLD, COND, TYPES, PAY, PROVINCES, peso, label, fmtDate, shipToText, catName, kindOf, imgVM, metaOf, availOf, badgeOf, statusStyle };
})();
