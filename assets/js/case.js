// Страница кейса: шапка и контакты, появление картинок, кнопка «наверх», блок про нейросеть.

import { revealIfNeeded } from './ascii.js'
import { initChrome } from './ui.js?v=2'
import { initAiCompare } from './aicompare.js'
import { initSmoothScroll, scrollToY } from './smooth.js'

window.__caseReady = true
const root = document.documentElement
const smooth = initSmoothScroll()
initChrome()
initAiCompare()

// «назад» ведёт к блоку проектов на главной, на тот проект, который открыли
document.querySelectorAll('.hdr__back').forEach((a) =>
  a.addEventListener('click', () => {
    try { sessionStorage.setItem('returnToWorks', sessionStorage.getItem('worksIndex') || '0') } catch (e) {}
  })
)

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

/* ---------- правая колонка с картинками (десктоп) прокручивается на 20% быстрее текста ---------- */
const media = document.querySelector('.cs-media')
const hdrEl = document.querySelector('.hdr')
// в кейсах-историях картинки стоят на уровне своих абзацев — колонка едет вместе с текстом
if (anim && media && !document.querySelector('.cs--story')) {
  const SPEED = 0.2
  const wide = window.matchMedia('(min-width: 1200px)')
  let top0 = 0
  let h0 = 0
  let ticking = false
  const measure = () => {
    media.style.transform = ''
    const r = media.getBoundingClientRect()
    top0 = r.top + window.scrollY
    h0 = media.offsetHeight
    update()
  }
  const update = () => {
    ticking = false
    if (!wide.matches) {
      media.style.transform = ''
      return
    }
    const vh = window.innerHeight
    const hh = hdrEl ? hdrEl.offsetHeight : 0
    // сколько прокручено от начала колонки
    const s = Math.max(0, window.scrollY - (top0 - hh))
    let off = s * SPEED
    // колонка не уезжает выше низа экрана: когда картинки кончаются, последняя «ждёт» внизу, пока догонит текст
    off = Math.min(off, Math.max(0, top0 + h0 - window.scrollY - vh))
    media.style.transform = off ? 'translate3d(0,' + (-off).toFixed(1) + 'px,0)' : ''
  }
  const req = () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }
  window.addEventListener('scroll', req, { passive: true })
  window.addEventListener('resize', measure)
  wide.addEventListener ? wide.addEventListener('change', measure) : wide.addListener(measure)
  // высота колонки меняется, когда догружаются картинки и блок про нейросеть
  new ResizeObserver(measure).observe(media)
  measure()
}

/* ссылки из «в этом кейсе» на разделы — плавная прокрутка с учётом шапки */
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('.hk__go')
  if (!a) return
  const target = document.querySelector(a.getAttribute('href'))
  if (!target) return
  e.preventDefault()
  const hh = hdrEl ? hdrEl.offsetHeight : 0
  // блок мог ещё не «подняться» (сдвинут вниз до появления) — сдвиг не учитываем
  const tr = getComputedStyle(target).transform
  const shift = tr && tr !== 'none' ? new DOMMatrixReadOnly(tr).m42 : 0
  scrollToY(smooth, target.getBoundingClientRect().top - shift + window.scrollY - hh - 24, 1.4)
})

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
