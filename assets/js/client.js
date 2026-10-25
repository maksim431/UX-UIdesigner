// Версия для клиентов (/web/): шапка, появление блоков, частые вопросы и фон с карпом в финальном блоке.
// Общая логика страницы (первый экран, контакты, «другие проекты») — в page.js.
import { mountWater } from './water.js?v=38'
import { PIXEL_CHARS } from './ascii.js'

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
  document.querySelectorAll('.cl-tasks__grid, .cl-gets__list, .cl-reviews__row, .cl-segs, .cl-process__steps, .cl-results__list').forEach((g) =>
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

/* ---------- фон с карпом, закреплённый на экране: «что вы получаете» и финальный блок ----------
   Фон стоит на месте, а блок прокручивается поверх: карп появляется сверху и уходит за нижний край блока.
   Показываем и анимируем фон только пока блок рядом с экраном — в остальное время карп не тратит ресурсы. */
function fixedWater(sec, bgSel, hostSel) {
  const bg = sec && sec.querySelector(bgSel)
  const host = sec && sec.querySelector(hostSel)
  if (!bg || !host) return
  let mounted = false
  bg.style.display = 'none'
  const show = (on) => {
    bg.style.display = on ? '' : 'none'
    if (on && !mounted && !/[?&]nokoi\b/.test(location.search)) {
      mounted = true
      requestAnimationFrame(() => mountWater(host, null))
    }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => show(es[0].isIntersecting), { rootMargin: '10% 0px 10% 0px' }).observe(sec)
  else show(true)
}

/* ---------- «что вы получаете»: липкое окно справа, карп стоит головой вниз и «плывёт» вместе с прокруткой ----------
   Карп стоит по центру окна по вертикали; в начале блока выплывает из-за его верхнего края, в конце уходит за нижний; на компьютере центр карпа на ~68% ширины окна. */
const gets = document.querySelector('.cl-gets')
const getsWater = gets && gets.querySelector('.cl-gets__water')
if (getsWater && !/[?&]nokoi\b/.test(location.search)) {
  const place = (FW, H) => {
    const vw = document.documentElement.clientWidth
    if (vw < 1200) {
      const len = vw < 810 ? Math.min(H * 0.6, FW * 1.4) : Math.min(H * 0.62, FW * 1.2)
      return { x: FW / 2, y: H / 2 + len / 2, len }
    }
    const len = Math.min(H * 0.68, FW * 1.35)
    const left = getsWater.getBoundingClientRect().left
    const x = Math.max(len * 0.42, Math.min(FW - len * 0.42, vw * 0.681 - left))
    return { x, y: H / 2 + len / 2, len }
  }
  // окно показываем и анимируем только пока блок рядом с экраном
  const win = gets.querySelector('.cl-gets__sticky')
  let started = false
  win.style.display = 'none'
  const show = (on) => {
    win.style.display = on ? '' : 'none'
    if (on && !started) { started = true; requestAnimationFrame(() => mountWater(getsWater, null, { mode: 'scroll', place })) }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => show(es[0].isIntersecting), { rootMargin: '10% 0px 10% 0px' }).observe(gets)
  else show(true)
}
fixedWater(document.querySelector('.cl-final'), '.cl-final__bg', '.cl-final__water')

/* ---------- большие цифры: ASCII-счётчик при появлении ----------
   Числа «набегают» от нуля до своего значения, а знаки вокруг мерцают пиксельными символами
   и успокаиваются к концу. Длина строки не меняется — соседний текст не прыгает. */
function countUp(el, dur = 1600) {
  const final = el.dataset.final || el.textContent
  el.setAttribute('aria-label', final)
  const parts = final.split(/(\d+(?:[.,]\d+)?)/) // нечётные элементы — числа
  const nums = parts.map((p, i) => {
    if (i % 2 === 0) return null
    const sep = p.includes(',') ? ',' : p.includes('.') ? '.' : ''
    const dec = sep ? p.split(sep)[1].length : 0
    return { v: parseFloat(p.replace(',', '.')), sep, dec, len: p.length }
  })
  const glyph = () => PIXEL_CHARS[(Math.random() * PIXEL_CHARS.length) | 0]
  el.classList.add('cl-count')
  const t0 = performance.now()
  let last = 0
  const frame = (now) => {
    const k = Math.min(1, (now - t0) / dur)
    if (k < 1 && now - last < 45) return requestAnimationFrame(frame) // ~22 кадров в секунду, как у кнопок
    last = now
    const e = 1 - Math.pow(1 - k, 3)
    const noise = (1 - k) * 0.55
    let out = ''
    parts.forEach((p, i) => {
      if (i % 2 === 0) {
        for (const ch of p) out += ch !== ' ' && Math.random() < noise ? glyph() : ch
        return
      }
      const n = nums[i]
      let s = (n.v * e).toFixed(n.dec)
      if (n.sep === ',') s = s.replace('.', ',')
      // недостающие разряды — пиксельные символы, чтобы ширина числа была постоянной
      while (s.length < n.len) s = (k < 1 ? glyph() : ' ') + s
      out += s
    })
    el.textContent = k < 1 ? out : final
    if (k < 1) requestAnimationFrame(frame)
    else el.classList.remove('cl-count')
  }
  requestAnimationFrame(frame)
}
const bigs = [...document.querySelectorAll('.cl-res__big, .cl-seg__v, .cl-fact__v')]
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return
    io.unobserve(e.target)
    countUp(e.target)
  }), { threshold: 0.6 })
  bigs.forEach((el) => {
    // до появления цифры уже «зашумлены» — без вспышки готового значения перед стартом счётчика
    el.dataset.final = el.textContent
    el.setAttribute('aria-label', el.textContent)
    el.textContent = el.textContent.replace(/\d/g, () => PIXEL_CHARS[(Math.random() * PIXEL_CHARS.length) | 0])
    io.observe(el)
  })
}
