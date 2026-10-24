// Версия для клиентов (/web/): шапка, появление блоков, частые вопросы и фон с карпом в финальном блоке.
// Общая логика страницы (первый экран, контакты, «другие проекты») — в page.js.
import { mountWater } from './water.js?v=32'

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- шапка: на самом верху прозрачная, после начала прокрутки — светлая с размытием ---------- */
const hdr = document.querySelector('.hdr--cl')
if (hdr) {
  const upd = () => {
    const top = window.scrollY < 8
    if (top !== hdr.classList.contains('is-top')) hdr.classList.toggle('is-top', top)
  }
  upd()
  window.addEventListener('scroll', upd, { passive: true })
}

/* ---------- меню на телефоне: пункт раздела — закрываем меню и едем к разделу ---------- */
document.querySelectorAll('.contacts__link').forEach((a) =>
  a.addEventListener('click', () => {
    const close = document.querySelector('[data-close-contacts]')
    if (close) close.click()
  })
)

/* ---------- блоки появляются при прокрутке ---------- */
const rv = [...document.querySelectorAll('.cl-rv')]
if (reduce || !('IntersectionObserver' in window)) rv.forEach((el) => el.classList.add('is-in'))
else {
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      io.unobserve(e.target)
    })
  }, { rootMargin: '0px 0px -8% 0px' })
  rv.forEach((el) => io.observe(el))
  // элементы одного ряда появляются по очереди
  document.querySelectorAll('.cl-tasks__grid, .cl-gets__grid, .cl-reviews__row, .cl-segs, .cl-process__steps, .cl-results__list').forEach((g) =>
    [...g.querySelectorAll(':scope > .cl-rv')].forEach((el, i) => (el.style.transitionDelay = ((i % 3) * 0.08).toFixed(2) + 's'))
  )
}

/* ---------- частые вопросы: раскрытие ответа ---------- */
document.querySelectorAll('.cl-q__b').forEach((b) =>
  b.addEventListener('click', () => {
    const q = b.closest('.cl-q')
    const open = !q.classList.contains('is-open')
    q.classList.toggle('is-open', open)
    b.setAttribute('aria-expanded', String(open))
  })
)

/* ---------- финальный блок: тот же синий фон с карпом, закреплён на экране ----------
   Фон показываем и анимируем только пока блок рядом с экраном — в остальное время карп не тратит ресурсы. */
const fin = document.querySelector('.cl-final')
const finBg = fin && fin.querySelector('.cl-final__bg')
const finWater = fin && fin.querySelector('.cl-final__water')
if (fin && finBg && finWater) {
  let mounted = false
  finBg.style.display = 'none'
  const show = (on) => {
    finBg.style.display = on ? '' : 'none'
    if (on && !mounted && !/[?&]nokoi\b/.test(location.search)) {
      mounted = true
      requestAnimationFrame(() => mountWater(finWater, null))
    }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => show(es[0].isIntersecting), { rootMargin: '10% 0px 10% 0px' }).observe(fin)
  else show(true)
}
