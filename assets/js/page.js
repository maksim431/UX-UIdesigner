// Главная страница портфолио (продуктовая /product и обычная /web):
// шапка и меню контактов, первый экран с портретом, анимации при скролле, блок проектов.

import { initScramble, revealIfNeeded } from './ascii.js'
import { mountPortrait } from './portrait.js'
import { initProjects } from './projects.js'
import { initSmoothScroll, scrollToY } from './smooth.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const root = document.documentElement
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const smooth = initSmoothScroll()

/* ---------- ASCII-кнопки ---------- */
initScramble()

/* ---------- меню контактов ---------- */
const hdr = document.querySelector('.hdr')
const menu = document.getElementById('contacts')
const tg = menu && menu.querySelector('[data-always]')
const tgFx = tg ? makeAlways(tg, 600) : null
let lastFocus = null

function makeAlways(el, speed) {
  // «Всегда»-эффект запускаем только пока меню открыто
  const text = el.textContent
  const chars = ['█', '▓', '▒', '░', '▄', '▀', '■', '▪']
  let timer = 0
  return {
    start() {
      if (timer) return
      timer = setInterval(() => {
        const idx = []
        for (let i = 0; i < text.length; i++) if (text[i] !== ' ') idx.push(i)
        const pick = new Set()
        while (pick.size < Math.min(2, idx.length)) pick.add(idx[(Math.random() * idx.length) | 0])
        let out = ''
        for (let i = 0; i < text.length; i++) out += pick.has(i) ? chars[(Math.random() * chars.length) | 0] : text[i]
        el.textContent = out
      }, speed)
    },
    stop() {
      clearInterval(timer)
      timer = 0
      el.textContent = text
    },
  }
}

function setMenu(open) {
  if (!menu) return
  menu.classList.toggle('is-open', open)
  hdr.classList.toggle('is-open', open)
  menu.setAttribute('aria-hidden', open ? 'false' : 'true')
  root.classList.toggle('no-scroll', open)
  document.body.style.overflow = open ? 'hidden' : ''
  document.querySelectorAll('[data-open-contacts]').forEach((b) => b.setAttribute('aria-expanded', open ? 'true' : 'false'))
  if (open) {
    lastFocus = document.activeElement
    // постоянный ASCII-эффект на telegram — только на планшете и телефоне
    if (tgFx && window.matchMedia('(max-width: 1199.98px)').matches) tgFx.start()
    const first = menu.querySelector('a, button')
    first && first.focus({ preventScroll: true })
  } else {
    tgFx && tgFx.stop()
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true })
  }
}
document.querySelectorAll('[data-open-contacts]').forEach((b) => b.addEventListener('click', () => setMenu(true)))
document.querySelectorAll('[data-close-contacts]').forEach((b) => b.addEventListener('click', () => setMenu(false)))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) setMenu(false)
})

/* ---------- копирование почты ---------- */
document.querySelectorAll('[data-copy]').forEach((el) => {
  const value = el.getAttribute('data-copy')
  const tip = document.createElement('div')
  tip.className = 'copy-tip'
  tip.setAttribute('role', 'status')
  tip.textContent = 'копировать'
  document.body.appendChild(tip)
  let copied = false
  let timer = 0
  const place = (e) => {
    tip.style.transform = ''
    tip.style.left = e.clientX + 15 + 'px'
    tip.style.top = e.clientY + 15 + 'px'
  }
  el.addEventListener('mouseenter', (e) => {
    place(e)
    tip.classList.add('is-on')
  })
  el.addEventListener('mousemove', place)
  el.addEventListener('mouseleave', () => {
    tip.classList.remove('is-on')
    setTimeout(() => {
      copied = false
      tip.textContent = 'копировать'
    }, 300)
  })
  el.addEventListener('click', (e) => {
    if (copied) return
    if (e.clientX || e.clientY) place(e)
    else {
      const r = el.getBoundingClientRect()
      tip.style.left = r.left + r.width / 2 + 'px'
      tip.style.top = r.bottom + 8 + 'px'
    }
    const done = () => {
      copied = true
      tip.textContent = 'скопировано!'
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const d = 25 + Math.random() * 20
        const p = document.createElement('i')
        p.style.setProperty('--dx', Math.cos(a) * d + 'px')
        p.style.setProperty('--dy', Math.sin(a) * d + 'px')
        tip.appendChild(p)
        setTimeout(() => p.remove(), 520)
      }
      tip.classList.add('is-on')
      clearTimeout(timer)
      timer = setTimeout(() => {
        copied = false
        tip.textContent = 'копировать'
        if (!el.matches(':hover')) tip.classList.remove('is-on')
      }, 2000)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, done)
    else done()
  })
})

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
if (portraitHost) mountPortrait(portraitHost, portraitHost.getAttribute('data-map'), hudRight)

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
  box.style.clipPath = p > 0 ? 'inset(0 ' + (e * 2.2).toFixed(3) + '% 0 ' + (e * 2.2).toFixed(3) + '% round ' + (e * 14).toFixed(1) + 'px)' : ''
  heroTexts.forEach((el, i) => {
    el.style.translate = p ? '0 ' + (-p * (90 + i * 22)).toFixed(1) + 'px' : ''
    el.style.opacity = p ? String(clamp(1 - p * 1.6, 0, 1)) : ''
  })
}
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
initProjects(document.getElementById('works'), { smooth })
