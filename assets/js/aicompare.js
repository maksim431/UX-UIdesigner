// Блок «Если вы решите создать продукт самостоятельно в нейросети» (только в кейсах для бизнеса).
// Макеты — результат одного простого промта, без продумывания UX. Перенесено из компонента Framer AiCompare.

const CASES = {
  scplab: {
    prompt: 'Сделай дизайн мобильного приложения для тренировок спортсменов',
    intro: 'Картинка получилась яркой, но нейросеть не знает, в каких условиях работает спортсмен: зал, сбитое дыхание, потные руки, секунды между подходами. Она не продумывает, когда предложить подписку и с чего начать тренировку. В итоге приложение красиво на скриншоте, но неудобно в зале — его бросают после пары тренировок и не покупают подписку. Приложение, за которое люди платят каждый месяц, нужно проектировать с пониманием пользователя.',
    issues: [
      'Подписку предлагают на первом экране — до того, как человек понял, за что платит.',
      'Мелкие кнопки и иконки: в зале, с потными руками, в них не попасть.',
      'Главный экран перегружен цифрами — непонятно, с чего начать тренировку.',
    ],
  },
  foodbot: {
    prompt: 'Сделай личный кабинет сервиса, где кафе создают Telegram-бота для доставки',
    intro: 'Кабинет выглядит современно, но нейросеть не знает, что владелец кафе — не программист и весь день на ногах. Она копирует сложные интерфейсы: технические поля, десятки разделов, работа только с компьютера. Владелец не сможет сам запустить бота, будет писать в поддержку или уйдёт к конкуренту. Сервис, через который бизнес принимает заказы и деньги, нужно разрабатывать с пониманием того, как устроен день клиента.',
    issues: [
      'С первого экрана просит API-токен и webhook — владелец кафе не знает, что это.',
      'Десяток разделов в меню без подсказок: где начать — неясно.',
      'Только версия для компьютера: принять заказ с телефона на кухне не получится.',
    ],
    issuesMobile: [
      'С первого экрана просит API-токен и webhook — владелец кафе не знает, что это.',
      'Десяток разделов без подсказок: на маленьком экране новый заказ теряется среди меню.',
      'Мобильная версия — просто сжатый компьютерный кабинет: мелкие поля и кнопки не для работы на ходу.',
    ],
  },
  vici: {
    prompt: 'Сделай сайт для производителя морепродуктов',
    intro: 'Сайт выглядит аккуратно, но нейросеть делает то, что видела тысячи раз, — каталог «как у всех». Она не задаётся вопросом, зачем человек пришёл на сайт производителя: не за весом упаковки, а за идеей ужина. Без этого понимания сайт не приводит покупателей в магазин и не окупает вложения. Сайт крупного бренда должен продавать, а для этого его проектируют с пониманием поведения покупателей.',
    issues: [
      'Обычный каталог без рецептов — посетитель не понимает, что приготовить.',
      'Карточки товаров ведут в тупик: после них некуда идти дальше.',
      'Нет причины вернуться на сайт или пойти с ним в магазин.',
    ],
  },
}

// английская версия текстов (макеты и так на английском)
const CASES_EN = {
  scplab: {
    prompt: 'Design a mobile workout app for athletes',
    intro: "The picture came out bright, but the AI doesn't know the conditions an athlete works in: the gym, heavy breathing, sweaty hands, seconds between sets. It doesn't think about when to offer a subscription or how to start a workout. As a result, the app looks great in a screenshot but is awkward in the gym — people drop it after a couple of workouts and never subscribe. An app people pay for every month has to be designed with an understanding of the user.",
    issues: [
      'The subscription is offered on the first screen — before the person understands what they are paying for.',
      'Small buttons and icons: impossible to hit in the gym with sweaty hands.',
      'The home screen is overloaded with numbers — it is unclear how to start a workout.',
    ],
  },
  foodbot: {
    prompt: 'Make a dashboard for a service where cafés create a Telegram delivery bot',
    intro: "The dashboard looks modern, but the AI doesn't know that a café owner is not a programmer and is on their feet all day. It copies complex interfaces: technical fields, dozens of sections, desktop-only work. The owner won't be able to launch a bot on their own, will keep writing to support or leave for a competitor. A service a business uses to take orders and money has to be built with an understanding of the client's day.",
    issues: [
      'The first screen asks for an API token and a webhook — a café owner has no idea what those are.',
      'A dozen menu sections with no hints: it is unclear where to start.',
      'Desktop only: you can’t accept an order from your phone in the kitchen.',
    ],
    issuesMobile: [
      'The first screen asks for an API token and a webhook — a café owner has no idea what those are.',
      'A dozen sections with no hints: on a small screen a new order gets lost among the menu items.',
      'The mobile version is just a squeezed desktop dashboard: tiny fields and buttons, not made for work on the go.',
    ],
  },
  vici: {
    prompt: 'Make a website for a seafood producer',
    intro: "The site looks neat, but the AI does what it has seen thousands of times — a catalog like everyone else's. It never asks why a person visits a producer's website: not for the pack weight, but for a dinner idea. Without that understanding the site doesn't bring buyers to the store and doesn't pay off. A big brand's website has to sell, and for that it is designed with an understanding of shopper behavior.",
    issues: [
      'A plain catalog with no recipes — visitors don’t know what to cook.',
      'Product cards are dead ends: there is nowhere to go next.',
      'No reason to come back to the site or take it to the store.',
    ],
  },
}
const EN = document.documentElement.lang === 'en'
const L = EN
  ? { title: 'If you decide to build the product yourself with AI', prompt: 'prompt', issues: 'What’s wrong with this example:' }
  : { title: 'Если вы решите создать продукт самостоятельно в нейросети', prompt: 'промт', issues: 'Что не так в этом примере:' }

/* ---------- маленький помощник: div со стилями ---------- */
const UNITLESS = new Set(['fontWeight', 'opacity', 'lineHeight', 'flex', 'zIndex'])
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const css = (o) =>
  Object.entries(o)
    .map(([k, v]) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + (typeof v === 'number' && !UNITLESS.has(k) ? v + 'px' : v))
    .join(';')
const h = (style, ...kids) => `<div style="${css(style)}">${kids.flat().map((k) => (k == null ? '' : k)).join('')}</div>`
const t = (style, text) => h(style, esc(text))
const span = (text) => `<span>${esc(text)}</span>`
const UI = 'Inter, -apple-system, Segoe UI, Roboto, sans-serif'

/* ---------- фитнес-приложение ---------- */
function fitnessPhone() {
  const tile = (e, l) => h({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }, t({ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }, e), t({ fontSize: 10, color: '#B9B4D6' }, l))
  const stat = (v, l, c) => h({ flex: '1', padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.06)' }, t({ fontSize: 18, fontWeight: 700, color: c }, v), t({ fontSize: 10, color: '#9C97BA', marginTop: 2 }, l))
  return h(
    { width: 390, height: 780, background: 'linear-gradient(180deg,#1B1035 0%,#0E0A1F 100%)', fontFamily: UI, color: '#fff', padding: '48px 20px 0', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' },
    h({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, h({}, t({ fontSize: 12, color: '#9C97BA' }, 'Good morning 👋'), t({ fontSize: 22, fontWeight: 800 }, 'FitPro AI 💪')), h({ width: 40, height: 40, borderRadius: 20, background: 'linear-gradient(135deg,#FF5FA2,#7B5CFF)' })),
    h(
      { marginTop: 18, padding: 18, borderRadius: 22, background: 'linear-gradient(135deg,#7B5CFF 0%,#FF5FA2 100%)' },
      t({ fontSize: 11, opacity: 0.85 }, '🔥 LIMITED OFFER'),
      t({ fontSize: 20, fontWeight: 800, marginTop: 4 }, 'Unlock PRO Training'),
      t({ fontSize: 12, opacity: 0.9, marginTop: 4 }, 'AI plans, nutrition, analytics & more'),
      t({ marginTop: 12, display: 'inline-block', padding: '9px 16px', borderRadius: 12, background: '#fff', color: '#1B1035', fontSize: 13, fontWeight: 700 }, 'Subscribe $19.99/mo')
    ),
    h({ display: 'flex', gap: 8, marginTop: 16 }, stat('1,240', 'Calories', '#FF8A5B'), stat('8,532', 'Steps', '#5BE3FF'), stat('72', 'BPM', '#FF5FA2')),
    t({ fontSize: 15, fontWeight: 700, marginTop: 20 }, 'Categories'),
    h({ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 12 }, [['🏋️', 'Strength'], ['🏃', 'Cardio'], ['🧘', 'Yoga'], ['🥗', 'Nutrition'], ['📊', 'Stats'], ['⏱', 'Timer'], ['🏆', 'Goals'], ['⚙️', 'More']].map(([e, l]) => tile(e, l))),
    t({ fontSize: 15, fontWeight: 700, marginTop: 20 }, 'Recommended'),
    h({ display: 'flex', gap: 10, marginTop: 10 }, ['Full Body Burn', 'Power Legs'].map((n) => h({ flex: '1', height: 96, borderRadius: 18, background: 'linear-gradient(160deg,#3A2B6E,#211741)', padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }, t({ fontSize: 12, fontWeight: 700 }, n), t({ fontSize: 10, color: '#9C97BA' }, '45 min · PRO 🔒')))),
    h({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, background: '#140D2B', display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: 18 }, ['🏠', '📅', '➕', '💬', '👤'].map(span))
  )
}

function fitnessTablet() {
  const stat = (v, l, c) => h({ flex: '1', padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.06)' }, t({ fontSize: 22, fontWeight: 700, color: c }, v), t({ fontSize: 12, color: '#9C97BA', marginTop: 2 }, l))
  const cats = [['🏋️', 'Strength'], ['🏃', 'Cardio'], ['🧘', 'Yoga'], ['🥗', 'Nutrition'], ['📊', 'Stats'], ['⏱', 'Timer'], ['🏆', 'Goals'], ['⚙️', 'More']]
  return h(
    { width: 820, height: 1000, background: 'linear-gradient(180deg,#1B1035 0%,#0E0A1F 100%)', fontFamily: UI, color: '#fff', padding: '40px 36px 0', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' },
    h({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, h({}, t({ fontSize: 14, color: '#9C97BA' }, 'Good morning 👋'), t({ fontSize: 30, fontWeight: 800 }, 'FitPro AI 💪')), h({ width: 52, height: 52, borderRadius: 26, background: 'linear-gradient(135deg,#FF5FA2,#7B5CFF)' })),
    h(
      { marginTop: 24, padding: 28, borderRadius: 28, background: 'linear-gradient(135deg,#7B5CFF 0%,#FF5FA2 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      h({}, t({ fontSize: 13, opacity: 0.85 }, '🔥 LIMITED OFFER'), t({ fontSize: 28, fontWeight: 800, marginTop: 6 }, 'Unlock PRO Training'), t({ fontSize: 14, opacity: 0.9, marginTop: 6 }, 'AI plans, nutrition, analytics & more')),
      t({ padding: '14px 22px', borderRadius: 14, background: '#fff', color: '#1B1035', fontSize: 15, fontWeight: 700 }, 'Subscribe $19.99/mo')
    ),
    h({ display: 'flex', gap: 12, marginTop: 22 }, stat('1,240', 'Calories', '#FF8A5B'), stat('8,532', 'Steps', '#5BE3FF'), stat('72', 'BPM', '#FF5FA2'), stat('3/5', 'Workouts', '#B7FF5B')),
    t({ fontSize: 19, fontWeight: 700, marginTop: 28 }, 'Categories'),
    h({ display: 'flex', justifyContent: 'space-between', marginTop: 14 }, cats.map(([e, l]) => h({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }, t({ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }, e), t({ fontSize: 12, color: '#B9B4D6' }, l)))),
    t({ fontSize: 19, fontWeight: 700, marginTop: 28 }, 'Recommended'),
    h({ display: 'flex', gap: 14, marginTop: 14 }, ['Full Body Burn', 'Power Legs', 'Core Blast'].map((n) => h({ flex: '1', height: 170, borderRadius: 22, background: 'linear-gradient(160deg,#3A2B6E,#211741)', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }, t({ fontSize: 15, fontWeight: 700 }, n), t({ fontSize: 12, color: '#9C97BA' }, '45 min · PRO 🔒')))),
    h({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, background: '#140D2B', display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: 24 }, ['🏠', '📅', '➕', '💬', '👤'].map(span))
  )
}

/* ---------- кабинет FoodBot ---------- */
const fbField = (label, ph, small) =>
  h({ marginBottom: small ? 10 : 14 }, t({ fontSize: small ? 11 : 12, color: '#4B5563', marginBottom: 5, fontWeight: 600 }, label), t({ height: small ? 32 : 38, borderRadius: 9, border: '1px solid #D9DEE8', background: '#fff', padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: small ? 10 : 12, color: '#9AA3B2', overflow: 'hidden', whiteSpace: 'nowrap' }, ph))
const FB_FIELDS = [['Bot Token *', '1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'], ['Webhook URL *', 'https://api.example.com/webhook/{bot_id}'], ['Secret Key', 'sk_live_••••••••••••••••'], ['Payment Provider ID', 'Enter provider ID']]
const FB_STATS = [['Total Orders', '1,284', '+12%'], ['Revenue', '$24,560', '+8%'], ['Active Bots', '3', '+1'], ['Conversion', '4.6%', '-0.4%']]
const fbStat = ([l, v, d]) => h({ flex: '1', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, t({ fontSize: 12, color: '#6B7280' }, l), t({ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }, v), t({ fontSize: 11, color: d.startsWith('-') ? '#EF4444' : '#10B981', marginTop: 2 }, d))
const fbButtons = (small) =>
  h({ display: 'flex', gap: small ? 6 : 10, marginTop: small ? 0 : 6 }, t({ padding: small ? '7px 10px' : '9px 16px', borderRadius: small ? 8 : 10, background: '#2747FF', color: '#fff', fontSize: small ? 10 : 12, fontWeight: 700 }, 'Save & Connect'), t({ padding: small ? '7px 10px' : '9px 16px', borderRadius: small ? 8 : 10, background: '#EEF1F8', color: '#374151', fontSize: small ? 10 : 12, fontWeight: 700 }, 'Test Webhook'))
const fbOrders = (list) => list.map((o, i) => h({ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0F2F7', fontSize: 12, color: '#374151' }, span(o), `<span style="color:${i < 2 ? '#F59E0B' : '#10B981'};font-weight:600">${i < 2 ? 'Pending' : 'Done'}</span>`))
const FB_ORDERS = ['#1042 · Burger Set · $18.50', '#1041 · Sushi Mix · $32.00', '#1040 · Pizza XL · $21.90', '#1039 · Latte ×2 · $7.80', '#1038 · Wok · $12.40']
const card = { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const fbHead = (size) => h({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, t({ fontSize: size, fontWeight: 800, color: '#111827' }, 'API Settings'), t({ padding: '10px 18px', borderRadius: 10, background: '#2747FF', color: '#fff', fontSize: 13, fontWeight: 700 }, '+ Create Bot'))

function foodbotDesktop() {
  const menu = ['Dashboard', 'Bots', 'Integrations', 'API Settings', 'Webhooks', 'Orders', 'Menu Builder', 'Customers', 'Analytics', 'Payments', 'Logs', 'Settings']
  return h(
    { width: 1200, height: 760, background: '#F4F6FB', fontFamily: UI, display: 'flex', overflow: 'hidden' },
    h({ width: 230, background: 'linear-gradient(180deg,#2747FF,#6A3BFF)', color: '#fff', padding: '28px 18px', boxSizing: 'border-box' }, t({ fontSize: 20, fontWeight: 800, marginBottom: 26 }, '🤖 BotFood'), menu.map((m, i) => t({ padding: '9px 12px', borderRadius: 10, fontSize: 13, marginBottom: 4, background: i === 3 ? 'rgba(255,255,255,0.18)' : 'transparent', opacity: i === 3 ? 1 : 0.85 }, m))),
    h(
      { flex: '1', padding: '28px 32px', boxSizing: 'border-box' },
      fbHead(24),
      h({ display: 'flex', gap: 16, marginTop: 20 }, FB_STATS.map(fbStat)),
      h(
        { display: 'flex', gap: 16, marginTop: 20 },
        h({ flex: '1', ...card }, t({ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }, 'Bot Configuration'), FB_FIELDS.map(([l, p]) => fbField(l, p)), fbButtons()),
        h({ width: 380, ...card }, t({ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }, 'Recent Orders'), fbOrders(FB_ORDERS))
      )
    )
  )
}

function foodbotTablet() {
  const icons = ['📊', '🤖', '🔌', '🔑', '🔗', '🧾', '🍔', '👥', '📈', '💳', '📜', '⚙️']
  return h(
    { width: 820, height: 1000, background: '#F4F6FB', fontFamily: UI, display: 'flex', overflow: 'hidden' },
    h({ width: 72, background: 'linear-gradient(180deg,#2747FF,#6A3BFF)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 22, gap: 8 }, t({ fontSize: 24, marginBottom: 14 }, '🤖'), icons.map((ic, i) => t({ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, background: i === 3 ? 'rgba(255,255,255,0.22)' : 'transparent' }, ic))),
    h(
      { flex: '1', padding: '28px 28px', boxSizing: 'border-box' },
      fbHead(26),
      h({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }, FB_STATS.map(fbStat)),
      h({ ...card, marginTop: 18 }, t({ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }, 'Bot Configuration'), FB_FIELDS.map(([l, p]) => fbField(l, p)), fbButtons()),
      h({ ...card, marginTop: 18 }, t({ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }, 'Recent Orders'), fbOrders(FB_ORDERS.slice(0, 3)))
    )
  )
}

function foodbotPhone() {
  const menu = ['Dashboard', 'Bots', 'Integrations', 'API Settings', 'Webhooks', 'Orders', 'Menu Builder']
  return h(
    { width: 390, height: 780, background: '#F4F6FB', fontFamily: UI, overflow: 'hidden' },
    h({ height: 96, background: 'linear-gradient(90deg,#2747FF,#6A3BFF)', color: '#fff', padding: '44px 16px 0', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between' }, t({ fontSize: 17, fontWeight: 800 }, '🤖 BotFood'), t({ fontSize: 20 }, '☰')),
    h({ display: 'flex', gap: 6, padding: '10px 12px', whiteSpace: 'nowrap', overflow: 'hidden' }, menu.map((m, i) => t({ padding: '5px 9px', borderRadius: 8, fontSize: 10, background: i === 3 ? '#2747FF' : '#E6E9F2', color: i === 3 ? '#fff' : '#374151', flexShrink: 0 }, m))),
    h(
      { padding: '4px 12px 0' },
      t({ fontSize: 17, fontWeight: 800, color: '#111827' }, 'API Settings'),
      h({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }, FB_STATS.map(([l, v]) => h({ background: '#fff', borderRadius: 10, padding: 10 }, t({ fontSize: 9, color: '#6B7280' }, l), t({ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 3 }, v)))),
      h({ background: '#fff', borderRadius: 10, padding: 12, marginTop: 10 }, t({ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 10 }, 'Bot Configuration'), FB_FIELDS.map(([l, p]) => fbField(l, p, true)), fbButtons(true))
    )
  )
}

/* ---------- сайт производителя морепродуктов ---------- */
const VICI_PRODUCTS = [['🦀', 'Crab Sticks', '200 g'], ['🦐', 'Shrimps', '500 g'], ['🐟', 'Herring Fillet', '300 g'], ['🍣', 'Salmon Slices', '150 g']]
const viciCard = ([e, n, w], small) =>
  h(
    { borderRadius: small ? 14 : 18, border: '1px solid #E7ECF3', padding: small ? 12 : 18, textAlign: 'center' },
    t({ height: small ? 80 : 120, borderRadius: 12, background: '#EEF7FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: small ? 38 : 56 }, e),
    t({ fontSize: small ? 13 : 16, fontWeight: 700, color: '#0F172A', marginTop: 10 }, n),
    t({ fontSize: small ? 11 : 13, color: '#64748B', marginTop: 2 }, w),
    t({ marginTop: 8, fontSize: small ? 11 : 13, fontWeight: 700, color: '#0B4F8A' }, 'Learn more →')
  )
const viciLogo = (size) => t({ fontSize: size, fontWeight: 800, color: '#0B4F8A' }, '🌊 OceanFresh')
const viciCta = (pad, size) => t({ marginTop: 22, display: 'inline-block', padding: pad, borderRadius: 999, background: '#fff', color: '#0B4F8A', fontWeight: 700, fontSize: size }, 'Explore Products →')

function viciDesktop() {
  return h(
    { width: 1200, height: 760, background: '#fff', fontFamily: UI, overflow: 'hidden' },
    h(
      { height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', borderBottom: '1px solid #EEF1F5' },
      viciLogo(22),
      h({ display: 'flex', gap: 28, fontSize: 14, color: '#334155' }, ['Home', 'Products', 'About Us', 'Quality', 'Contacts'].map(span)),
      t({ padding: '9px 18px', borderRadius: 999, background: '#0B4F8A', color: '#fff', fontSize: 13, fontWeight: 700 }, 'Contact Us')
    ),
    h(
      { height: 330, background: 'linear-gradient(120deg,#0B4F8A 0%,#1BA4D8 60%,#7FE0F5 100%)', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' },
      h({ maxWidth: 560 }, t({ fontSize: 46, fontWeight: 800, lineHeight: 1.1 }, 'Fresh From The Ocean To Your Table'), t({ fontSize: 16, opacity: 0.9, marginTop: 14 }, 'Premium quality seafood products since 1995. Trusted by millions of families.'), viciCta('12px 24px', 14)),
      t({ fontSize: 150, lineHeight: 1 }, '🐟')
    ),
    h(
      { padding: '34px 48px 0' },
      t({ textAlign: 'center', fontSize: 26, fontWeight: 800, color: '#0F172A' }, 'Our Products'),
      t({ textAlign: 'center', fontSize: 14, color: '#64748B', marginTop: 6 }, 'High quality products for every day'),
      h({ display: 'flex', gap: 20, marginTop: 24 }, VICI_PRODUCTS.map((p) => h({ flex: '1' }, viciCard(p, false))))
    )
  )
}

function viciTablet() {
  return h(
    { width: 820, height: 1000, background: '#fff', fontFamily: UI, overflow: 'hidden' },
    h({ height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid #EEF1F5' }, viciLogo(22), h({ display: 'flex', gap: 18, alignItems: 'center' }, t({ padding: '9px 18px', borderRadius: 999, background: '#0B4F8A', color: '#fff', fontSize: 13, fontWeight: 700 }, 'Contact Us'), t({ fontSize: 24, color: '#0F172A' }, '☰'))),
    h(
      { height: 360, background: 'linear-gradient(120deg,#0B4F8A 0%,#1BA4D8 60%,#7FE0F5 100%)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' },
      h({ maxWidth: 480 }, t({ fontSize: 42, fontWeight: 800, lineHeight: 1.1 }, 'Fresh From The Ocean To Your Table'), t({ fontSize: 16, opacity: 0.9, marginTop: 14 }, 'Premium quality seafood products since 1995. Trusted by millions of families.'), viciCta('12px 24px', 14)),
      t({ fontSize: 120, lineHeight: 1 }, '🐟')
    ),
    h({ padding: '32px 32px 0' }, t({ textAlign: 'center', fontSize: 26, fontWeight: 800, color: '#0F172A' }, 'Our Products'), t({ textAlign: 'center', fontSize: 14, color: '#64748B', marginTop: 6 }, 'High quality products for every day'), h({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 22 }, VICI_PRODUCTS.map((p) => viciCard(p, false))))
  )
}

function viciPhone() {
  return h(
    { width: 390, height: 780, background: '#fff', fontFamily: UI, overflow: 'hidden' },
    h({ height: 96, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 18px 16px', boxSizing: 'border-box', borderBottom: '1px solid #EEF1F5' }, viciLogo(18), t({ fontSize: 22, color: '#0F172A' }, '☰')),
    h(
      { background: 'linear-gradient(160deg,#0B4F8A 0%,#1BA4D8 70%,#7FE0F5 100%)', padding: '28px 18px', color: '#fff' },
      t({ fontSize: 60, lineHeight: 1 }, '🐟'),
      t({ fontSize: 28, fontWeight: 800, lineHeight: 1.12, marginTop: 12 }, 'Fresh From The Ocean To Your Table'),
      t({ fontSize: 13, opacity: 0.9, marginTop: 10 }, 'Premium quality seafood products since 1995.'),
      t({ marginTop: 16, display: 'inline-block', padding: '11px 20px', borderRadius: 999, background: '#fff', color: '#0B4F8A', fontWeight: 700, fontSize: 13 }, 'Explore Products →')
    ),
    h({ padding: '22px 18px 0' }, t({ textAlign: 'center', fontSize: 21, fontWeight: 800, color: '#0F172A' }, 'Our Products'), h({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }, VICI_PRODUCTS.map((p) => viciCard(p, true))))
  )
}

// какой макет на каком устройстве: [функция, ширина, высота]
const MOCKS = {
  scplab: { desktop: [fitnessPhone, 390, 780], tablet: [fitnessTablet, 820, 1000], phone: [fitnessPhone, 390, 780] },
  foodbot: { desktop: [foodbotDesktop, 1200, 760], tablet: [foodbotTablet, 820, 1000], phone: [foodbotPhone, 390, 780] },
  vici: { desktop: [viciDesktop, 1200, 760], tablet: [viciTablet, 820, 1000], phone: [viciPhone, 390, 780] },
}
const deviceOf = (w) => (w >= 1200 ? 'desktop' : w >= 810 ? 'tablet' : 'phone')

function mount(el) {
  const key = el.getAttribute('data-case')
  const data = (EN ? CASES_EN : CASES)[key]
  if (!data) return
  el.innerHTML =
    '<p class="aic__title">' + L.title + '</p>' +
    '<div class="aic__shot"><p class="aic__prompt">' + L.prompt + (EN ? ': “' : ': «') + esc(data.prompt) + (EN ? '”' : '»') + '</p><div class="aic__frame" aria-hidden="true"><div class="aic__mock"></div></div></div>' +
    '<p class="aic__intro">' + esc(data.intro) + '</p>' +
    '<div class="aic__issues"><p class="aic__issues-title">' + L.issues + '</p><ul></ul></div>'
  const frame = el.querySelector('.aic__frame')
  const mock = el.querySelector('.aic__mock')
  const list = el.querySelector('ul')
  let device = ''
  const layout = () => {
    const d = deviceOf(window.innerWidth)
    if (d !== device) {
      device = d
      const [fn] = MOCKS[key][d]
      mock.innerHTML = fn()
      const issues = d !== 'desktop' && data.issuesMobile ? data.issuesMobile : data.issues
      list.innerHTML = issues.map((s) => '<li>' + esc(s) + '</li>').join('')
    }
    const [, mw, mh] = MOCKS[key][device]
    const width = el.clientWidth
    const pad = width < 480 ? 24 : 40
    const inner = Math.max(200, width - pad * 2)
    const isPhone = mw < 600
    const isTablet = !isPhone && mw < 1000
    const boxW = isPhone ? Math.min(inner, 300) : isTablet ? Math.min(inner, 560) : inner
    const s = boxW / mw
    el.classList.toggle('aic--small', width < 480)
    frame.style.width = boxW + 'px'
    frame.style.height = mh * s + 'px'
    frame.style.borderRadius = (isPhone ? 28 : isTablet ? 18 : 8) + 'px'
    frame.style.alignSelf = isPhone || isTablet ? 'center' : 'stretch'
    mock.style.transform = 'scale(' + s + ')'
  }
  layout()
  new ResizeObserver(layout).observe(el)
}

export function initAiCompare(root = document) {
  root.querySelectorAll('.aic[data-case]').forEach(mount)
}
