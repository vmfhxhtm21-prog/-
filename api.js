/* api.js — 데이터 접근은 전부 여기서만.
   지금은 샘플 데이터 + localStorage. 다음 주에 각 함수 안을 fetch('/api/...')로 교체하면 됩니다. */
(function () {
  const CATEGORIES = [
    { id: 1, name: '의류', parent_id: null }, { id: 11, name: '상의', parent_id: 1 }, { id: 12, name: '하의', parent_id: 1 }, { id: 13, name: '아우터', parent_id: 1 },
    { id: 2, name: '전자기기', parent_id: null }, { id: 21, name: '오디오', parent_id: 2 }, { id: 22, name: '액세서리', parent_id: 2 },
    { id: 3, name: '생활', parent_id: null }, { id: 31, name: '주방', parent_id: 3 }, { id: 32, name: '인테리어', parent_id: 3 }
  ];
  // 등록된 상품만 표시합니다. 예시 상품 데이터는 포함하지 않습니다.
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('shop_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem('shop_' + k, JSON.stringify(v))
  };
  const PRODUCTS = [...store.get('custom', [])];
  const withUser = p => { const l = store.get('likes', []), w = store.get('wish', []);
    return { ...p, like_count: p.like_count + (l.includes(p.id) ? 1 : 0), view_count: p.view_count + (store.get('views', {})[p.id] || 0), liked: l.includes(p.id), wished: w.includes(p.id) }; };
  const descendants = id => [id, ...CATEGORIES.filter(c => c.parent_id === id).map(c => c.id)];

  window.api = {
    async getCategories() { return CATEGORIES; },
    async getTags() {
      const n = {}; PRODUCTS.forEach(p => p.tags.forEach(t => n[t] = (n[t] || 0) + 1));
      return Object.entries(n).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    },
    // 옵션: category, tags[](OR), q, sort, page, limit, featured, inStock, minPrice, maxPrice
    async getProducts(o = {}) {
      let r = PRODUCTS.map(withUser);
      if (o.category) { const ids = descendants(o.category); r = r.filter(p => ids.includes(p.category_id)); }
      if (o.tags?.length) r = r.filter(p => p.tags.some(t => o.tags.includes(t)));
      if (o.q) { const q = o.q.toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(q) || p.tags.some(t => t.includes(q))); }
      if (o.featured) r = r.filter(p => p.is_featured);
      if (o.inStock) r = r.filter(p => p.stock > 0);
      if (o.minPrice) r = r.filter(p => p.price >= o.minPrice);
      if (o.maxPrice) r = r.filter(p => p.price <= o.maxPrice);
      const S = { latest: (a, b) => b.id - a.id, likes: (a, b) => b.like_count - a.like_count, views: (a, b) => b.view_count - a.view_count,
        price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price };
      r.sort(S[o.sort || 'latest']);
      const total = r.length, limit = o.limit || total || 1, page = o.page || 1;
      return { items: r.slice((page - 1) * limit, page * limit), total, page, pages: Math.ceil(total / limit) };
    },
    async getMyProducts() { return PRODUCTS.map(withUser).sort((a, b) => b.id - a.id); },
    async getProduct(id) { const p = PRODUCTS.find(p => p.id === id); return p && withUser(p); },
    async increaseView(id) { const v = store.get('views', {}); v[id] = (v[id] || 0) + 1; store.set('views', v); },
    async toggleLike(id) { const l = store.get('likes', []); const i = l.indexOf(id); i < 0 ? l.push(id) : l.splice(i, 1); store.set('likes', l); return i < 0; },
    async toggleWishlist(id) { const w = store.get('wish', []); const i = w.indexOf(id); i < 0 ? w.push(id) : w.splice(i, 1); store.set('wish', w); return i < 0; },
    async getWishlist() { return store.get('wish', []); },
    async getCart() { return store.get('cart', []); }, // [{product_id, qty}]
    async addToCart(id, qty = 1) { const c = store.get('cart', []); const x = c.find(i => i.product_id === id); x ? x.qty += qty : c.push({ product_id: id, qty }); store.set('cart', c); return c; }
  };
  Object.assign(window.api, {
    async updateCartQty(id, qty) { let c = store.get('cart', []); c = qty < 1 ? c.filter(i => i.product_id !== id) : c.map(i => i.product_id === id ? { ...i, qty } : i); store.set('cart', c); return c; },
    async removeFromCart(id) { return this.updateCartQty(id, 0); },
    async getRelated(id, n = 4) { const p = PRODUCTS.find(p => p.id === id); return PRODUCTS.filter(x => x.id !== id && x.category_id === p.category_id).slice(0, n).map(withUser); },
    async createOrder(info) { // 다음 주: POST /api/orders
      const items = store.get('cart', []).map(i => { const p = PRODUCTS.find(p => p.id === i.product_id); return { product_id: p.id, name: p.name, qty: i.qty, price: Math.round(p.price * (100 - p.discount_rate) / 100) }; });
      const o = { id: Date.now(), items, ...info, created_at: new Date().toISOString() };
      store.set('orders', [...store.get('orders', []), o]); store.set('cart', []); localStorage.removeItem('shop_coupon'); return o; },
    async getOrders() { return store.get('orders', []); },
    async addProduct(d) { // 다음 주: POST /api/products (이미지는 파일 업로드)
      const id = Math.max(0, ...PRODUCTS.map(p => p.id)) + 1, cat = CATEGORIES.find(c => c.id === d.category_id);
      const p = { id, like_count: 0, view_count: 0, created_at: new Date().toISOString().slice(0, 10), category: cat.name, thumbnail: d.images[0], ...d };
      PRODUCTS.push(p); store.set('custom', [...store.get('custom', []), p]); return p; },
    async deleteProduct(id) { store.set('custom', store.get('custom', []).filter(p => p.id !== id)); const i = PRODUCTS.findIndex(p => p.id === id); if (i >= 0) PRODUCTS.splice(i, 1); }
  });
})();
