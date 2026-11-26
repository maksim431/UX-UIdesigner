const app = document.querySelector('#app');
const catalog = document.querySelector('#catalog');
const pizza = document.querySelector('#pizza');
const rolls = document.querySelector('#rolls');
const basket = document.querySelector('#basket');
const total = document.querySelector('#total');
const filters = document.querySelector('#filters');
const categoryButtons = document.querySelectorAll('nav button');
const items = new Map();
const price = 440;

function addCard(container, id, name, size, tags = []) {
  const card = document.createElement('article');
  card.className = 'card ' + size;
  const media = '<div class="card-media"><img src="assets/placeholder.svg" alt=""></div>';
  if (size === 'promo') {
    card.innerHTML = media;
  } else {
    const labels = tags.map(tag => '<span class="tag">' + tag + '</span>').join('');
    card.innerHTML = media + `
      <p class="card-name">${name}</p>
      <div class="card-action">
        <button type="button" class="price" data-delta="1">+ ${price} ₽</button>
        <div class="quantity" hidden>
          <button type="button" data-delta="1" aria-label="Добавить"><img src="assets/plus.svg" alt=""></button>
          <output aria-label="Количество">0</output>
          <button type="button" data-delta="-1" aria-label="Убрать"><img src="assets/minus.svg" alt=""></button>
        </div>
      </div>
      ${tags.length ? '<div class="tags">' + labels + '</div><span class="asset pepper"><img src="assets/pepper.png" alt="Острое"></span>' : ''}
    `;
    card.dataset.item = id;
    card.querySelector('.price').setAttribute('aria-label', name + ', + ' + price + ' ₽');
    items.set(id, { card, count: 0 });
  }
  container.append(card);
}

const recommendations = document.querySelector('#recommendations');
['Паста карбонара', 'Пицца 4 сыра сезонная', 'Ролл филадельфия'].forEach((name, index) => {
  addCard(recommendations, 'recommendation-' + index, name, 'small');
});

function fillCategory(section, name, promoIndex, hitIndex) {
  const grid = section.querySelector('.products');
  addCard(grid, section.id + '-large', name, 'large', ['От шефа', 'Рекомендуем']);
  for (let index = 0; index < 6; index += 1) {
    const size = index === promoIndex ? 'promo' : 'medium';
    const tag = index === hitIndex ? 'Хит!' : 'От шефа';
    addCard(grid, section.id + '-' + index, name, size, [tag]);
  }
}

fillCategory(pizza, 'Пицца', 3, 5);
fillCategory(rolls, 'Роллы', 2, -1);

function updateItem(item) {
  item.card.querySelector('output').value = String(item.count);
  item.card.querySelector('.price').hidden = item.count > 0;
  item.card.querySelector('.quantity').hidden = item.count === 0;
}

catalog.addEventListener('click', event => {
  const button = event.target.closest('[data-delta]');
  if (!button) return;
  const card = button.closest('[data-item]');
  const item = items.get(card.dataset.item);
  item.count = Math.max(0, item.count + Number(button.dataset.delta));
  updateItem(item);
  if (event.detail === 0 && (button.hidden || button.parentElement.hidden)) {
    card.querySelector(item.count ? '.quantity button' : '.price').focus({ preventScroll: true });
  }
  const count = [...items.values()].reduce((sum, entry) => sum + entry.count, 0);
  total.textContent = (count * price) + ' ₽';
  basket.hidden = count === 0;
});

function setCategory(category) {
  app.dataset.category = category;
  for (const button of categoryButtons) {
    if (button.dataset.category === category) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function openCategory(category) {
  setCategory(category);
  if (category === 'home') catalog.scrollTop = 0;
  if (category === 'pizza') {
    const scrollTo = rolls.offsetTop - Math.max(catalog.clientHeight - 27, 0);
    catalog.scrollTop = Math.max(pizza.offsetTop, scrollTo);
  }
  if (category === 'rolls') catalog.scrollTop = catalog.scrollHeight - catalog.clientHeight;
}

for (const button of categoryButtons) {
  button.addEventListener('click', () => openCategory(button.dataset.category));
}

catalog.addEventListener('scroll', () => {
  const position = catalog.scrollTop + Math.min(35, catalog.clientHeight / 4);
  if (position >= rolls.offsetTop) setCategory('rolls');
  else if (position >= pizza.offsetTop) setCategory('pizza');
  else setCategory('home');
}, { passive: true });

basket.addEventListener('click', () => {
  for (const item of items.values()) {
    if (!item.count) continue;
    item.count = 0;
    updateItem(item);
  }
  document.querySelector('#location-art').src = 'assets/cutlery.png';
  document.querySelector('#location-label').textContent = 'Заказ готовится';
  basket.hidden = true;
  openCategory('rolls');
});

filters.addEventListener('click', () => {
  const isClosed = app.classList.toggle('filters-closed');
  filters.setAttribute('aria-expanded', String(!isClosed));
});
