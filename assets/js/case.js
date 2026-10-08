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
revealIfNeeded()

/* картинки появляются, когда доходят до экрана */
const boxes = document.querySelectorAll('.cs-fig__box')
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
