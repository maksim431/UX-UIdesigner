// Страница кейса: шапка и контакты, появление картинок, кнопка «наверх», блок про нейросеть.

import { revealIfNeeded } from './ascii.js'
import { initChrome } from './ui.js'
import { initAiCompare } from './aicompare.js'
import { initSmoothScroll, scrollToY } from './smooth.js'

window.__caseReady = true
const root = document.documentElement
const smooth = initSmoothScroll()
initChrome()
initAiCompare()

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const anim = root.classList.contains('cs-anim')

/* ---------- появление первого экрана (как на главной; после ASCII-перехода, если он был) ---------- */
const introEls = [...document.querySelectorAll('[data-intro]')].filter((el) => el.getClientRects().length)
introEls
  .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
  .forEach((el, i) => el.style.setProperty('--d', (0.15 + i * 0.08).toFixed(2) + 's'))
revealIfNeeded().then(() => {
  if (!root.classList.contains('fx-pre')) return
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.classList.add('fx-in')
      setTimeout(() => root.classList.remove('fx-pre', 'fx-in'), 2400)
    })
  )
})

/* ---------- тексты и блоки поднимаются при прокрутке ---------- */
if (anim && 'IntersectionObserver' in window) {
  const sel = '.cs-flow .rt:not([data-intro]), .cs-hooks:not([data-intro]), .cs-btns, .aic'
  // только то, что ниже экрана: видимое сразу не прячем, чтобы ничего не мигало
  const els = [...document.querySelectorAll(sel)].filter((el) => !el.closest('.cs-hooks[data-intro]') && el.getBoundingClientRect().top > window.innerHeight)
  els.forEach((el) => el.classList.add('cs-rise'))
  const rio = new IntersectionObserver(
    (entries) => {
      const shown = entries.filter((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)
      shown
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((e, i) => {
          e.target.style.setProperty('--rd', Math.min(i * 0.08, 0.4).toFixed(2) + 's')
          e.target.classList.add('is-in')
          rio.unobserve(e.target)
        })
    },
    { rootMargin: '0px 0px -6% 0px' }
  )
  els.forEach((el) => rio.observe(el))
}

/* ---------- параллакс картинок внутри рамки ---------- */
if (anim) {
  const imgs = new Set()
  let tick = false
  const pio = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? imgs.add(e.target) : imgs.delete(e.target)))
    if (!tick) {
      tick = true
      requestAnimationFrame(para)
    }
  })
  document.querySelectorAll('.cs-fig__box').forEach((b) => pio.observe(b))
  const para = () => {
    tick = false
    const vh = window.innerHeight
    imgs.forEach((box) => {
      const r = box.getBoundingClientRect()
      // -1 — картинка внизу экрана, 1 — вверху
      const k = clamp((vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2), -1, 1)
      box.firstElementChild.style.transform = 'translate3d(0,' + (k * 4).toFixed(2) + '%,0) scale(1.1)'
    })
  }
  window.addEventListener('scroll', () => {
    if (!tick) {
      tick = true
      requestAnimationFrame(para)
    }
  }, { passive: true })
  window.addEventListener('resize', para)
  requestAnimationFrame(para)
}

/* картинки появляются, когда доходят до экрана */
const boxes = [...document.querySelectorAll('.cs-fig__box')].filter((b) => !b.closest('.cs-fig--cover'))
if ('IntersectionObserver' in window && root.classList.contains('cs-anim')) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      })
    },
    { rootMargin: '0px 0px -8% 0px' }
  )
  boxes.forEach((b) => io.observe(b))
} else {
  root.classList.remove('cs-anim')
}

/* кнопка «наверх» */
const top = document.querySelector('.totop')
if (top) {
  let on = false
  let tick = false
  const upd = () => {
    tick = false
    const v = window.scrollY > window.innerHeight * 0.6
    if (v !== on) top.classList.toggle('is-on', (on = v))
  }
  window.addEventListener('scroll', () => {
    if (!tick) {
      tick = true
      requestAnimationFrame(upd)
    }
  }, { passive: true })
  upd()
  top.addEventListener('click', (e) => {
    e.preventDefault()
    scrollToY(smooth, 0, 1.2)
  })
}
