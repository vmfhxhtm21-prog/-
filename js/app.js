const $ = s => document.querySelector(s);
const won = n => n.toLocaleString('ko-KR') + '원';
const state = { category: null, sub: null, tags: [], q: '', sort: 'latest', page: 1, inStock: false, minPrice: 0, maxPrice: 0 };
let cats = [];

function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 1600); }
const salePrice = p => Math.round(p.price * (100 - p.discount_rate) / 100);
const fmtN = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;

function card(p) {
  const badge = p.stock === 0 ? '<span class="badge out">품절</span>' : p.discount_rate ? `<span class="badge">SALE ${p.discount_rate}%</span>` : '';
  return `<article class="card" data-id="${p.id}">
    <a class="thumb" href="product.html?id=${p.id}"><img src="${p.thumbnail}" alt="${p.name}" loading="lazy">${badge}
      <button class="heart ${p.wished ? 'on' : ''}" data-act="wish" aria-label="위시리스트">${p.wished ? '♥' : '♡'}</button></a>
    <div class="info"><a class="nm" href="product.html?id=${p.id}">${p.name}</a>
      ${p.discount_rate ? `<span class="old">${won(p.price)}</span>` : ''}
      <span class="price">${p.discount_rate ? `<em>${p.discount_rate}%</em>` : ''}${won(salePrice(p))}</span>
      <span class="tg">${p.tags.map(t => '#' + t).join(' ')}</span>
      <span class="stat"><button data-act="like" style="border:0;background:none;padding:0;color:${p.liked ? 'var(--sale)' : 'inherit'}">${p.liked ? '♥' : '♡'} ${p.like_count}</button> · 조회 ${fmtN(p.view_count)}</span>
      <button class="add" data-act="cart" ${p.stock === 0 ? 'disabled' : ''}>${p.stock === 0 ? '품절' : '장바구니 담기'}</button></div></article>`;
}

async function updateBadges() {
  const [c, w] = await Promise.all([api.getCart(), api.getWishlist()]);
  const n = c.reduce((s, i) => s + i.qty, 0);
  $('#cartCount').textContent = n; $('#cartCount').hidden = !n;
  $('#wishCount').textContent = w.length; $('#wishCount').hidden = !w.length;
}

/* 카테고리 (대분류 > 소분류) */
function renderCats() {
  const top = cats.filter(c => !c.parent_id);
  $('#cats').innerHTML = `<button data-id="" class="${!state.category ? 'on' : ''}">전체</button>` +
    top.map(c => `<button data-id="${c.id}" class="${state.category === c.id ? 'on' : ''}">${c.name}</button>`).join('');
  const subs = cats.filter(c => c.parent_id === state.category);
  $('#subcats').innerHTML = subs.length ? `<button data-id="" class="${!state.sub ? 'on' : ''}">전체</button>` +
    subs.map(c => `<button data-id="${c.id}" class="${state.sub === c.id ? 'on' : ''}">${c.name}</button>`).join('') : '';
}
$('#cats').onclick = e => { const b = e.target.closest('button'); if (!b) return; state.category = +b.dataset.id || null; state.sub = null; state.page = 1; renderCats(); loadList(); };
$('#subcats').onclick = e => { const b = e.target.closest('button'); if (!b) return; state.sub = +b.dataset.id || null; state.page = 1; renderCats(); loadList(); };

/* 태그 (복수 선택, OR) */
async function renderTags() {
  const tags = await api.getTags();
  $('#tags').innerHTML = tags.map(t => `<button class="${state.tags.includes(t) ? 'on' : ''}" data-t="${t}">#${t}</button>`).join('');
}
$('#tags').onclick = e => { const t = e.target.dataset.t; if (!t) return;
  const i = state.tags.indexOf(t); i < 0 ? state.tags.push(t) : state.tags.splice(i, 1); state.page = 1; renderTags(); loadList(); };

/* 목록 */
async function loadList() {
  const r = await api.getProducts({ category: state.sub || state.category, tags: state.tags, q: state.q, sort: state.sort,
    page: state.page, limit: 8, inStock: state.inStock, minPrice: state.minPrice, maxPrice: state.maxPrice });
  const c = cats.find(c => c.id === (state.sub || state.category));
  $('#listTitle').textContent = (state.q ? `"${state.q}" 검색` : c ? c.name : '전체 상품') + ` (${r.total})`;
  $('#list').innerHTML = r.items.length ? r.items.map(card).join('') : '<p class="empty">조건에 맞는 상품이 없어요. 필터를 줄여보세요.</p>';
  $('#pager').innerHTML = r.pages > 1 ? Array.from({ length: r.pages }, (_, i) =>
    `<button class="${i + 1 === r.page ? 'on' : ''}" data-p="${i + 1}">${i + 1}</button>`).join('') : '';
}
$('#pager').onclick = e => { const p = +e.target.dataset.p; if (p) { state.page = p; loadList(); scrollTo({ top: $('#listTitle').offsetTop - 120, behavior: 'smooth' }); } };
$('#sort').onchange = e => { state.sort = e.target.value; state.page = 1; loadList(); };
$('#inStock').onchange = e => { state.inStock = e.target.checked; state.page = 1; loadList(); };
$('#minP').onchange = e => { state.minPrice = +e.target.value; state.page = 1; loadList(); };
$('#maxP').onchange = e => { state.maxPrice = +e.target.value; state.page = 1; loadList(); };
$('#searchForm').onsubmit = e => { e.preventDefault(); state.q = $('#q').value.trim(); state.page = 1; loadList(); };

/* 카드 버튼 (위시/좋아요/장바구니) */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  e.preventDefault();
  const id = +b.closest('.card').dataset.id, act = b.dataset.act;
  if (act === 'wish') { const on = await api.toggleWishlist(id); toast(on ? '위시리스트에 담았어요' : '위시리스트에서 뺐어요'); }
  if (act === 'like') await api.toggleLike(id);
  if (act === 'cart') { await api.addToCart(id); toast('장바구니에 담았어요'); }
  updateBadges(); loadList(); loadMyProducts();
});

async function loadMyProducts() {
  const items = await api.getMyProducts();
  $('#myProducts').innerHTML = items.length ? items.map(card).join('') :
    '<p class="empty">아직 등록한 상품이 없어요. <a href="admin.html">상품 등록하기</a></p>';
}

(async function init() {
  const u = new URLSearchParams(location.search); if (u.get('tag')) state.tags = [u.get('tag')]; if (u.get('q')) { state.q = u.get('q'); $('#q').value = state.q; }
  cats = await api.getCategories(); renderCats(); renderTags();
  updateBadges(); loadMyProducts(); loadList();
})();
