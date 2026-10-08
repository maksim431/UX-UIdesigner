// Общее для всех страниц с шапкой: ASCII-кнопки, меню контактов, копирование почты.

import { initScramble, PIXEL_CHARS } from './ascii.js'
import { initCursor } from './cursor.js'

const root = document.documentElement

// постоянный ASCII-эффект (telegram в меню на планшете и телефоне)
function makeAlways(el, speed) {
  const text = el.textContent
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
        for (let i = 0; i < text.length; i++) out += pick.has(i) ? PIXEL_CHARS[(Math.random() * PIXEL_CHARS.length) | 0] : text[i]
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

function initContacts() {
  const hdr = document.querySelector('.hdr')
  const menu = document.getElementById('contacts')
  if (!menu) return
  const tg = menu.querySelector('[data-always]')
  const tgFx = tg ? makeAlways(tg, 600) : null
  let lastFocus = null

  const setMenu = (open) => {
    menu.classList.toggle('is-open', open)
    hdr && hdr.classList.toggle('is-open', open)
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
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false)
  })
}

function initCopy() {
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
}

export function initChrome() {
  initScramble()
  initContacts()
  initCopy()
  initCursor()
}
