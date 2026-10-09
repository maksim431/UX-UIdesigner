// Главная страница портфолио (продуктовая /product и обычная /web):
// шапка и меню контактов, первый экран с портретом, анимации при скролле, блок проектов.

import { revealIfNeeded } from './ascii.js'
import { initChrome } from './ui.js'
import { mountWater } from './water.js?v=15'
import { initProjects } from './projects.js'
import { initSmoothScroll, scrollToY } from './smooth.js'

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
if (portraitHost) mountWater(portraitHost, hudRight)

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
  // синий фрейм раздвигается до краёв экрана (без скруглений), к трети прокрутки — на всю ширину
  const g = easeOut(clamp(p * 3, 0, 1))
  box.style.setProperty('--gl', p > 0 ? (g * gapL).toFixed(1) + 'px' : '0px')
  box.style.setProperty('--gr', p > 0 ? (g * gapR).toFixed(1) + 'px' : '0px')
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
    if (heroTick) return
    heroTick = true
    requestAnimationFrame(heroScroll)
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
if (smooth && works) smooth.addStop(() => works.getBoundingClientRect().top + window.scrollY - (hdr ? hdr.getBoundingClientRect().height : 0))
