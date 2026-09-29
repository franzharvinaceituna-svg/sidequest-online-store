// SIDE QUEST — seed/demo data ONLY. Replace with Supabase rows later; no UI reads this file directly
// (everything goes through src/services/store-service.js).
// Images: url:null = "photo pending" placeholder. Real photos will live in Supabase Storage (storage_path).
window.SQ_SEED = (function () {
  const categories = [
    { category_id: 'pokemon', name: 'Pokémon', label: 'Pokémon Singles', description: 'Raw singles, sorted by condition', sort_order: 1 },
    { category_id: 'psa', name: 'PSA Slabs', label: 'PSA / Graded Cards', description: 'PSA, BGS and CGC graded cards', sort_order: 2 },
    { category_id: 'sealed', name: 'Sealed Products', label: 'Sealed Products', description: 'Booster boxes, ETBs and bundles', sort_order: 3 },
    { category_id: 'accessories', name: 'Accessories', label: 'Accessories', description: 'Sleeves, holders and binders', sort_order: 4 },
    { category_id: 'collectibles', name: 'Collectibles', label: 'Collectibles & Plush', description: 'Figures, plush and display pieces', sort_order: 5 },
    { category_id: 'other', name: 'Other Hobbies', label: 'Other Hobbies', description: 'Other TCGs and hobby goods', sort_order: 6 }
  ];

  const IMG_KINDS = { SINGLE: ['front', 'back'], GRADED_CARD: ['slab_front', 'slab_back'], SEALED: ['product', 'product_back'] };

  function P(o) {
    const base = {
      subcategory: '', description: '', pokemon: '', set: '', card_number: '', language: 'English',
      condition: '', product_type: 'SINGLE', grading_company: '', grade: null, cost: 0, sale_price: null,
      quantity: 1, reserved_quantity: 0, tags: [], featured: false, sale: false, status: 'ACTIVE',
      track_items: false, created_at: '2026-08-15T10:00:00+08:00', updated_at: '2026-09-01T10:00:00+08:00'
    };
    const p = Object.assign(base, o);
    p.product_id = p.product_id || p.sku;
    const kinds = IMG_KINDS[p.product_type] || ['product'];
    p.images = kinds.map((kind, i) => ({
      image_id: p.product_id + '-IMG-' + (i + 1), url: null, storage_path: null,
      kind, alt: p.name + (i ? ' (back)' : ''), is_primary: i === 0, sort_order: i
    }));
    return p;
  }

  const products = [
    P({ sku: 'SQ-PIKA-085', name: 'Pikachu SVP 085 — PSA 10', category: 'psa', subcategory: 'PSA', pokemon: 'Pikachu', set: 'Scarlet & Violet Black Star Promos', card_number: 'SVP 085', product_type: 'GRADED_CARD', grading_company: 'PSA', grade: 10, price: 18500, cost: 12000, featured: true, track_items: true, tags: ['promo', 'gem mint'], description: 'Gem Mint PSA 10 Pikachu promo. One physical slab — the exact card pictured is the one you receive.', created_at: '2026-09-22T10:00:00+08:00' }),
    P({ sku: 'SQ-UMBR-215', name: 'Umbreon VMAX 215/203 — PSA 9', category: 'psa', subcategory: 'PSA', pokemon: 'Umbreon', set: 'Evolving Skies', card_number: '215/203', product_type: 'GRADED_CARD', grading_company: 'PSA', grade: 9, price: 42000, cost: 33000, featured: true, track_items: true, tags: ['alt art', 'moonbreon'], description: 'The Evolving Skies alternate-art Umbreon VMAX, graded PSA 9 Mint.' }),
    P({ sku: 'SQ-CHAR-223-BGS', name: 'Charizard ex 223/197 — BGS 9.5', category: 'psa', subcategory: 'BGS', pokemon: 'Charizard', set: 'Obsidian Flames', card_number: '223/197', product_type: 'GRADED_CARD', grading_company: 'BGS', grade: 9.5, price: 14500, cost: 10500, track_items: true, tags: ['special illustration rare'], description: 'Special Illustration Rare Charizard ex, Beckett Gem Mint 9.5.' }),
    P({ sku: 'SQ-CHAR-199', name: 'Charizard ex 199/165 Special Illustration Rare', category: 'pokemon', subcategory: 'Special Illustration Rare', pokemon: 'Charizard', set: 'Pokémon 151', card_number: '199/165', condition: 'NM', price: 9800, sale_price: 8900, sale: true, cost: 6500, quantity: 2, featured: true, track_items: true, tags: ['151', 'sir'], description: 'Raw, Near Mint. Pulled and sleeved immediately; ships in a penny sleeve and toploader.' }),
    P({ sku: 'SQ-MEW-205', name: 'Mew ex 205/165 Hyper Rare', category: 'pokemon', subcategory: 'Hyper Rare', pokemon: 'Mew', set: 'Pokémon 151', card_number: '205/165', condition: 'NM', price: 3200, cost: 2100, quantity: 3, track_items: true, tags: ['151', 'gold'], description: 'Gold Hyper Rare Mew ex. Raw, Near Mint.' }),
    P({ sku: 'SQ-GENG-271', name: 'Gengar VMAX 271/264 Alternate Art', category: 'pokemon', subcategory: 'Alternate Art', pokemon: 'Gengar', set: 'Fusion Strike', card_number: '271/264', condition: 'LP', price: 6500, cost: 4800, track_items: true, tags: ['alt art'], description: 'Light play — minor edge whitening on the back, clean front. See photos for the exact card.' }),
    P({ sku: 'SQ-PIKA-132-JP', name: 'Pikachu ex 132/106 SAR (Japanese)', category: 'pokemon', subcategory: 'Special Art Rare', pokemon: 'Pikachu', set: 'Super Electric Breaker', card_number: '132/106', language: 'Japanese', condition: 'NM', price: 4200, cost: 2900, track_items: true, tags: ['japanese', 'sar'], description: 'Japanese Special Art Rare Pikachu ex. Raw, Near Mint.', created_at: '2026-09-25T10:00:00+08:00' }),
    P({ sku: 'SQ-151-BB', name: 'Pokémon 151 Booster Bundle', category: 'sealed', subcategory: 'Booster Bundles', set: 'Pokémon 151', condition: 'Sealed', product_type: 'SEALED', price: 1950, cost: 1400, quantity: 12, featured: true, tags: ['151'], description: 'Factory-sealed booster bundle with 6 Pokémon 151 booster packs.' }),
    P({ sku: 'SQ-PRE-ETB', name: 'Prismatic Evolutions Elite Trainer Box', category: 'sealed', subcategory: 'Elite Trainer Boxes', set: 'Prismatic Evolutions', condition: 'Sealed', product_type: 'SEALED', price: 5200, cost: 3900, quantity: 3, featured: true, tags: ['etb'], description: 'Factory-sealed Elite Trainer Box: 9 booster packs, sleeves, dice and storage box.' }),
    P({ sku: 'SQ-TF-BOX-JP', name: 'Terastal Festival ex Booster Box (Japanese)', category: 'sealed', subcategory: 'Booster Boxes', set: 'Terastal Festival ex', language: 'Japanese', condition: 'Sealed', product_type: 'SEALED', price: 3600, sale_price: 3300, sale: true, cost: 2600, quantity: 6, tags: ['japanese'], description: 'Shrink-wrapped Japanese booster box, 10 packs.' }),
    P({ sku: 'SQ-SSP-BOX', name: 'Surging Sparks Booster Box', category: 'sealed', subcategory: 'Booster Boxes', set: 'Surging Sparks', condition: 'Sealed', product_type: 'SEALED', price: 8900, cost: 7000, quantity: 0, tags: [], description: 'Factory-sealed English booster box, 36 packs.' }),
    P({ sku: 'SQ-ACC-UPSLV', name: 'Ultra PRO Pro-Fit Inner Sleeves (100)', category: 'accessories', subcategory: 'Sleeves', condition: 'New', product_type: 'ACCESSORY', price: 280, cost: 170, quantity: 40, tags: ['sleeves'], description: 'Perfect-fit inner sleeves for double-sleeving standard-size cards.' }),
    P({ sku: 'SQ-ACC-DSMAT', name: 'Dragon Shield Matte Sleeves — Black (100)', category: 'accessories', subcategory: 'Sleeves', condition: 'New', product_type: 'ACCESSORY', price: 650, cost: 450, quantity: 25, tags: ['sleeves'], description: 'Matte standard-size sleeves for play and storage.' }),
    P({ sku: 'SQ-ACC-MAG35', name: 'Magnetic One-Touch Holder 35pt', category: 'accessories', subcategory: 'Holders', condition: 'New', product_type: 'ACCESSORY', price: 180, cost: 95, quantity: 60, featured: true, tags: ['one touch'], description: 'UV-protected magnetic holder for standard 35pt cards.' }),
    P({ sku: 'SQ-ACC-BND9', name: '9-Pocket Side-Loading Zip Binder', category: 'accessories', subcategory: 'Binders', condition: 'New', product_type: 'ACCESSORY', price: 1450, cost: 950, quantity: 8, tags: ['binder'], description: 'Zippered binder, 20 side-loading pages, holds 360 sleeved cards.' }),
    P({ sku: 'SQ-PLSH-PIKA', name: 'Pikachu Plush 8"', category: 'collectibles', subcategory: 'Plush', condition: 'New', product_type: 'PLUSH', price: 1200, cost: 750, quantity: 5, featured: true, tags: ['plush'], description: 'Soft 8-inch Pikachu plush with tags.' }),
    P({ sku: 'SQ-PLSH-SNOR', name: 'Snorlax Plush 12"', category: 'collectibles', subcategory: 'Plush', condition: 'New', product_type: 'PLUSH', price: 2400, sale_price: 1990, sale: true, cost: 1400, quantity: 2, tags: ['plush'], description: 'Large 12-inch Snorlax plush.' }),
    P({ sku: 'SQ-COL-EEVEE', name: 'Eevee Figure', category: 'collectibles', subcategory: 'Figures', condition: 'New', product_type: 'COLLECTIBLE', price: 890, cost: 520, quantity: 4, tags: ['figure'], description: 'Boxed Eevee display figure.', created_at: '2026-09-20T10:00:00+08:00' }),
    P({ sku: 'SQ-OP-OP01', name: 'One Piece Card Game OP-01 Booster Pack', category: 'other', subcategory: 'One Piece TCG', condition: 'Sealed', product_type: 'SEALED', language: 'Japanese', price: 350, cost: 220, quantity: 30, tags: ['one piece'], description: 'Sealed OP-01 Romance Dawn booster pack (Japanese).' }),
    P({ sku: 'SQ-OTH-HG-RX78', name: 'HG 1/144 RX-78-2 Model Kit', category: 'other', subcategory: 'Model Kits', condition: 'New', product_type: 'OTHER', price: 950, cost: 600, quantity: 3, tags: ['gunpla'], description: 'High Grade 1/144 plastic model kit.' })
  ];

  return { version: '2026-09-28.1', categories, products, inventory_start: 123 };
})();
