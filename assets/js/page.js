// Главная страница портфолио (продуктовая /product и обычная /web):
// шапка и меню контактов, первый экран с портретом, анимации при скролле, блок проектов.

import { revealIfNeeded } from './ascii.js'
import { initChrome } from './ui.js'
import { mountWater } from './water.js?v=23'
import { initProjects } from './projects.js'
import { initSmoothScroll, scrollToY } from './smooth.js?v=3'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const root = document.documentElement
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const smooth = initSmoothScroll()

/* ---------- ASCII-кнопки, меню контактов, копирование почты ---------- */
initChrome()
const hdr = document.querySelector('.hdr')

/* ---------- якоря (#works) с учётом шапки ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]')
  if (!a) return
  const id = a.getAttribute('href').slice(1)
  const target = id && document.getElementById(id)
  if (!target) return
  e.preventDefault()
  const off = hdr ? hdr.getBoundingClientRect().height : 0
  scrollToY(smooth, target.getBoundingClientRect().top + window.scrollY - off, 1.4)
  history.replaceState(null, '', '#' + id)
})

/* ---------- портрет ---------- */
const box = document.querySelector('.hero__box')
const portraitHost = document.querySelector('.hero__portrait')
const hudRight = document.querySelector('.hud__r')
// ?nokoi в адресе — главный экран без анимации карпа (для проверки, влияет ли она на плавность прокрутки)
if (portraitHost && !/[?&]nokoi\b/.test(location.search)) mountWater(portraitHost, hudRight)

/* ---------- появление первого экрана (после ASCII-перехода, если он был) ---------- */
const introEls = [...document.querySelectorAll('[data-intro]')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
introEls.forEach((el, i) => el.style.setProperty('--d', (0.15 + i * 0.08).toFixed(2) + 's'))
revealIfNeeded().then(() => {
  if (!root.classList.contains('fx-pre')) return
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.classList.add('fx-in')
      setTimeout(() => {
        root.classList.remove('fx-pre', 'fx-in')
        heroScroll()
      }, 2200)
    })
  )
})

/* ---------- параллакс первого экрана при скролле ---------- */
const heroTexts = introEls.filter((el) => !el.classList.contains('hero__portrait'))
let heroTick = false
let lastP = -1
// отступы фрейма от краёв экрана — на столько он раздвигается при прокрутке
const frame = box && box.parentElement
let gapL = 0
let gapR = 0
function measureGaps() {
  if (!frame) return
  const r = frame.getBoundingClientRect()
  gapL = Math.max(0, r.left)
  gapR = Math.max(0, document.documentElement.clientWidth - r.right)
  lastP = -1
  heroScroll()
}
window.addEventListener('resize', measureGaps)
requestAnimationFrame(measureGaps)
function heroScroll() {
  heroTick = false
  if (!box || reduce) return
  if (root.classList.contains('fx-pre')) return // интро ещё идёт
  // прогресс ухода первого экрана: 0 — страница в начале, 1 — экран целиком прокручен
  const p = clamp(window.scrollY / Math.max(1, box.offsetHeight), 0, 1)
  if (p === lastP) return // ничего не изменилось — ничего не делаем
  lastP = p
  const e = easeOut(p)
  portraitHost && (portraitHost.style.translate = p ? '0 ' + (p * 22).toFixed(2) + '%' : '')
  heroTexts.forEach((el, i) => {
    // параллакс: каждый текст уезжает вверх со своей скоростью (data-par)
    const k = parseFloat(el.dataset.par || '') || 1 + i * 0.25
    el.style.translate = p ? '0 ' + (-p * 150 * k).toFixed(1) + 'px' : ''
    el.style.opacity = p ? String(clamp(1 - p * 1.6, 0, 1)) : ''
  })
}
/* ---------- шапка: пока виден первый экран — прозрачная, по центру; ниже — обычная белая ---------- */
const hdrHome = document.querySelector('.hdr--home')
function hdrState() {
  if (!hdrHome || !box) return
  const on = box.getBoundingClientRect().bottom > hdrHome.offsetHeight + 1
  if (on !== hdrHome.classList.contains('is-hero')) hdrHome.classList.toggle('is-hero', on)
}
hdrState()
window.addEventListener('scroll', hdrState, { passive: true })
window.addEventListener('resize', hdrState)

window.addEventListener(
  'scroll',
  () => {
    // сразу в обработчике прокрутки, без ожидания следующего кадра — элементы не отстают и не дёргаются
    heroScroll()
  },
  { passive: true }
)

/* ---------- блок проектов ---------- */
const works = document.getElementById('works')
const proj = initProjects(works, { smooth })

// открыли кейс — запоминаем, какой; вернулись по «назад» — сразу показываем этот проект, без первого экрана
if (works) works.querySelectorAll('.ps__panel').forEach((panel, i) =>
  panel.querySelectorAll('a[href*="projects/"]').forEach((a) =>
    a.addEventListener('click', () => {
      try { sessionStorage.setItem('worksIndex', String(i)) } catch (e) {}
    })
  )
)
let back = null
try {
  back = sessionStorage.getItem('returnToWorks')
  sessionStorage.removeItem('returnToWorks')
} catch (e) {}
if (back !== null && proj) {
  requestAnimationFrame(() => {
    window.scrollTo({ top: proj.yFor(parseInt(back, 10) || 0), left: 0, behavior: 'instant' })
    root.classList.remove('rw')
  })
} else root.classList.remove('rw')
// стопор: сильная прокрутка с первого экрана останавливается на первом проекте, а не пролетает его
// стопор перед блоком кейсов убран: при прокрутке вниз он давал рывок, прокрутка теперь сплошная

/* ---------- обложки кейсов готовим заранее ----------
   Раньше они грузились и декодировались «лениво» — ровно в момент, когда при прокрутке вниз
   появлялся блок кейсов: браузер распаковывал крупные картинки посреди прокрутки, и она дёргалась
   (вверх — уже нет, картинки готовы). Теперь после загрузки страницы, в свободное время,
   обложки грузятся и декодируются заранее. */
function warmCovers() {
  const imgs = [...document.querySelectorAll('.ps__media img')]
  let i = 0
  const next = () => {
    const img = imgs[i++]
    if (!img) return
    img.loading = 'eager'
    let fired = false
    const done = () => { if (fired) return; fired = true; window.requestIdleCallback ? requestIdleCallback(next, { timeout: 800 }) : setTimeout(next, 120) }
    if (img.complete && img.naturalWidth) {
      if (img.decode) img.decode().then(done, done)
      else done()
    } else {
      img.addEventListener('load', () => (img.decode ? img.decode().then(done, done) : done()), { once: true })
      img.addEventListener('error', () => setTimeout(() => (img.complete && img.naturalWidth ? done() : null), 50), { once: true })
      // запасной таймер: если картинку так и не удалось получить, не блокируем остальные
      setTimeout(done, 4000)
    }
  }
  next()
}
if (document.readyState === 'complete') setTimeout(warmCovers, 300)
else window.addEventListener('load', () => setTimeout(warmCovers, 300), { once: true })
