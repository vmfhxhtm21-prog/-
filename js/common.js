/* 서브 페이지 공통: 헤더, 헬퍼, 카드, 계산 */
const $ = s => document.querySelector(s);
const won = n => n.toLocaleString('ko-KR') + '원';
const salePrice = p => Math.round(p.price * (100 - p.discount_rate) / 100);
const fmtN = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 1600); }
function header() {
  $('#hdr').outerHTML = `<header class="hdr"><a class="logo" href="index.html">네물내산</a>
  <form class="search" action="index.html"><input name="q" type="search" placeholder="상품명, 태그 검색" aria-label="검색"></form>
  <nav class="icons"><a href="wishlist.html" aria-label="위시리스트">♡<b id="wishCount" hidden>0</b></a>
  <a href="cart.html" aria-label="장바구니">🛒<b id="cartCount" hidden>0</b></a><a href="admin.html">관리자</a></nav></header>`;
  updateBadges();
}
async function updateBadges() {
  const [c, w] = await Promise.all([api.getCart(), api.getWishlist()]);
  const n = c.reduce((s, i) => s + i.qty, 0);
  $('#cartCount').textContent = n; $('#cartCount').hidden = !n;
  $('#wishCount').textContent = w.length; $('#wishCount').hidden = !w.length;
}
async function cartItems() {
  const c = await api.getCart(), ps = await Promise.all(c.map(i => api.getProduct(i.product_id)));
  return c.map((i, k) => ({ p: ps[k], qty: i.qty })).filter(x => x.p);
}
function calc(items) { // 배송비: 5만원 이상 무료 / 쿠폰 WELCOME10 = 10% 할인
  const sub = items.reduce((s, x) => s + salePrice(x.p) * x.qty, 0);
  const ship = !sub || sub >= 50000 ? 0 : 3000;
  const disc = localStorage.getItem('shop_coupon') === 'WELCOME10' ? Math.floor(sub * 0.1) : 0;
  return { sub, ship, disc, total: sub + ship - disc };
}
function card(p) {
  const badge = p.stock === 0 ? '<span class="badge out">품절</span>' : p.discount_rate ? `<span class="badge">SALE ${p.discount_rate}%</span>` : '';
  return `<article class="card" data-id="${p.id}"><a class="thumb" href="product.html?id=${p.id}"><img src="${p.thumbnail}" alt="${p.name}" loading="lazy">${badge}
  <button class="heart ${p.wished ? 'on' : ''}" data-act="wish" aria-label="위시리스트">${p.wished ? '♥' : '♡'}</button></a>
  <div class="info"><a class="nm" href="product.html?id=${p.id}">${p.name}</a>
  ${p.discount_rate ? `<span class="old">${won(p.price)}</span>` : ''}<span class="price">${p.discount_rate ? `<em>${p.discount_rate}%</em>` : ''}${won(salePrice(p))}</span>
  <span class="stat">♥ ${p.like_count} · 조회 ${fmtN(p.view_count)}</span>
  <button class="add" data-act="cart" ${p.stock === 0 ? 'disabled' : ''}>${p.stock === 0 ? '품절' : '장바구니 담기'}</button></div></article>`;
}
document.addEventListener('click', async e => { // 카드 버튼
  const b = e.target.closest('.card [data-act]'); if (!b) return; e.preventDefault();
  const id = +b.closest('.card').dataset.id;
  if (b.dataset.act === 'wish') toast((await api.toggleWishlist(id)) ? '위시리스트에 담았어요' : '위시리스트에서 뺐어요');
  if (b.dataset.act === 'cart') { await api.addToCart(id); toast('장바구니에 담았어요'); }
  updateBadges(); window.onChange && window.onChange();
});
