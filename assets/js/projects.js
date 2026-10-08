// Блок «мои работы»: карточки проектов на весь экран под шапкой. Блок закрепляется,
// при прокрутке следующая карточка «стирает» предыдущую снизу вверх, картинка оседает,
// тексты выезжают снизу, индекс показывает активный проект.
// Пересчёт — только на прокрутке/ресайзе (в покое процессор не занят).

import { scrollToY } from './smooth.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function headerBottom() {
  const h = document.querySelector('.hdr')
  if (!h) return 0
  const r = h.getBoundingClientRect()
  return Math.max(0, Math.round(r.height))
}

export function initProjects(root, { smooth, stepVh = 100, hold = 0.3 } = {}) {
  if (!root) return
  const sticky = root.querySelector('.ps__sticky')
  const panels = [...root.querySelectorAll('.ps__panel')]
  const navBtns = [...root.querySelectorAll('.ps__nav button')]
  const n = panels.length
  const parts = panels.map((p) => ({
    el: p,
    inner: p.querySelector('.ps__inner'),
    img: p.querySelector('.ps__media img, .ps__soon'),
    rise: [...p.querySelectorAll('[data-rise]')],
    state: -1,
  }))
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------- размеры ----------
  let box = { w: 0, vh: 0, hdr: 0, innerH: 0 }
  let lastW = -1
  let lastVh = -1
  function measure(force) {
    const w = root.clientWidth || window.innerWidth
    const ih = window.innerHeight
    // высоту меняем только при смене ширины/ориентации или заметной разнице (не от панели браузера на телефоне)
    const vh = force || lastVh < 0 || w !== lastW || Math.abs(ih - lastVh) > 140 ? ih : lastVh
    lastW = w
    lastVh = vh
    const hdr = headerBottom()
    const innerH = Math.max(240, vh - hdr)
    box = { w, vh, hdr, innerH }
    const stack = w < 700 || w / innerH < 1.25
    const phone = w < 810
    root.classList.toggle('ps--stack', stack)
    root.classList.toggle('ps--wide', !stack)
    root.classList.toggle('ps--phone', phone)
    const s = clamp(Math.min((w - 80) / 1840, (innerH - 40) / 963), 0.3, 1.25)
    const title = Math.round(clamp(Math.min(w * (phone ? 0.11 : 0.085), innerH * 0.075), 28, 72))
    const st = root.style
    st.setProperty('--s', s.toFixed(4))
    st.setProperty('--title', title + 'px')
    st.setProperty('--hdr-off', hdr + 'px')
    st.setProperty('--inner-h', innerH + 'px')
    st.height = innerH + ((n - 1) * (vh * stepVh)) / 100 + 'px'
    apply()
  }

  // ---------- состояние карточек от прокрутки ----------
  let active = -1
  let checkedSticky = false
  let transformMode = false
  function apply() {
    const r = root.getBoundingClientRect()
    const { hdr, innerH } = box
    const total = Math.max(1, r.height - innerH)
    const raw = clamp((hdr - r.top) / total, 0, 1)

    if (!checkedSticky && r.top < hdr - 40 && r.bottom > hdr + innerH + 40) {
      checkedSticky = true
      if (Math.abs(sticky.getBoundingClientRect().top - hdr) > 4) transformMode = true
    }
    sticky.style.transform = transformMode ? 'translate3d(0,' + clamp(hdr - r.top, 0, total) + 'px,0)' : ''

    const pos = raw * (n - 1)
    let k = Math.floor(pos)
    let f = pos - k
    if (k >= n - 1) {
      k = n - 1
      f = 0
    }
    const t = reduce ? (f > 0.5 ? 1 : 0) : easeInOut(clamp(f / (1 - hold), 0, 1))
    for (let i = 0; i < n; i++) {
      const p = parts[i]
      const reveal = i <= k ? 1 : i === k + 1 ? t : 0
      // ничего не трогаем, если карточка уже в итоговом состоянии
      const key = reveal >= 1 ? 1 : reveal <= 0 ? 0 : 2
      if (key !== 2 && p.state === key && !(i === k && k < n - 1)) {
        if (p.innerShift) {
          p.inner.style.transform = ''
          p.innerShift = false
        }
        continue
      }
      p.state = key
      p.el.style.clipPath = 'inset(' + ((1 - reveal) * 100).toFixed(3) + '% 0 0 0)'
      p.el.style.visibility = reveal <= 0 ? 'hidden' : 'visible'
      const e = 1 - reveal
      if (i > 0) {
        if (p.img) p.img.style.transform = reveal >= 1 ? '' : 'translate3d(0,' + (-3 * e).toFixed(3) + '%,0) scale(' + (1 + 0.06 * e).toFixed(4) + ')'
        p.rise.forEach((node, j) => {
          const d = clamp(e * (1 + j * 0.25), 0, 1)
          node.style.transform = reveal >= 1 ? '' : 'translate3d(0,' + (d * 60).toFixed(2) + '%,0)'
        })
      }
      // предыдущая карточка слегка уходит под новую
      if (i === k && k < n - 1) {
        p.inner.style.transform = 'translate3d(0,' + (-t * 4).toFixed(3) + '%,0)'
        p.innerShift = true
      } else if (p.innerShift) {
        p.inner.style.transform = ''
        p.innerShift = false
      }
    }
    const a = t > 0.5 ? Math.min(n - 1, k + 1) : k
    if (a !== active) {
      active = a
      navBtns.forEach((b, i) => b.setAttribute('aria-current', i === a ? 'true' : 'false'))
    }
  }

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      apply()
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => measure(false))
  window.addEventListener('orientationchange', () => measure(true))
  // шапка могла появиться/сжаться позже
  setTimeout(() => measure(false), 600)

  // переход к проекту по индексу
  navBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      const total = root.offsetHeight - box.innerH
      const top = root.getBoundingClientRect().top + window.scrollY - box.hdr
      scrollToY(smooth, top + (total * i) / Math.max(1, n - 1) + 2, 1.2)
    })
  )

  // появление первой карточки при входе блока в экран
  const intro = [root.querySelector('.ps__panel .ps__top'), root.querySelector('.ps__panel .ps__cta'), root.querySelector('.ps__nav')].filter(Boolean)
  if (!reduce && 'IntersectionObserver' in window && root.getBoundingClientRect().top > window.innerHeight * 0.8) {
    intro.forEach((el) => el.classList.add('ps-pre'))
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return
        io.disconnect()
        intro.forEach((el) => {
          el.classList.add('ps-in')
          el.classList.remove('ps-pre')
        })
      },
      { threshold: 0.12 }
    )
    io.observe(root)
  }

  measure(true)

  return {
    // координата прокрутки, при которой полностью показана карточка i
    yFor(i) {
      const total = root.offsetHeight - box.innerH
      const top = root.getBoundingClientRect().top + window.scrollY - box.hdr
      return top + (total * clamp(i, 0, n - 1)) / Math.max(1, n - 1) + 2
    },
  }
}
