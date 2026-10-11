// Блок «другие проекты» (все версии портфолио, все размеры экрана).
// 1) Появление: блок въезжает снизу — фото раскрывается из-под маски, заголовок поднимается.
// 2) Блок закрепляется под шапкой: фото поднимается на весь экран, «другие проекты» из маленькой
//    строки по центру вырастает в крупный жирный заголовок (состояние 2) и дальше стоит на месте.
// 3) Обычная плавная горизонтальная прокрутка карточек вслед за прокруткой страницы.
// Всё считается только на прокрутке/ресайзе.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const span = (v, a, b) => clamp((v - a) / (b - a), 0, 1)

// метрики Fira Mono: высота строки шрифта 1.2em, базовая линия на 0.935em, середина строчных букв ≈ 0.27em над ней
const ASC = 0.935
const MID = 0.27

export function initOther(root) {
  if (!root) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stage = root.querySelector('.op__stage')
  const view = root.querySelector('.op__view')
  const track = root.querySelector('.op__track')
  const cards = [...root.querySelectorAll('.op__card')]
  const small = root.querySelector('.op__title')
  if (!stage || !view || !track || !small || !cards.length) return
  const n = cards.length

  // крупный заголовок (состояние 2) — копия слов маленького, только для глаз
  const big = document.createElement('div')
  big.className = 'op__big'
  big.setAttribute('aria-hidden', 'true')
  const wS = [...small.querySelectorAll('.op__w')]
  wS.forEach((w) => {
    const c = document.createElement('span')
    c.className = 'op__w'
    c.textContent = w.textContent
    big.appendChild(c)
  })
  stage.appendChild(big)
  const wB = [...big.querySelectorAll('.op__w')]

  let on = false
  let lastW = -1
  let lastVh = -1
  let g = null // размеры

  function boxOf(el, lh) {
    // положение слова в координатах сцены без трансформаций + точка привязки (середина строчных букв)
    const f = parseFloat(getComputedStyle(el).fontSize) || 16
    let x = 0, y = 0, e = el
    while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent }
    const w = el.offsetWidth
    const base = (lh * f - 1.2 * f) / 2 + ASC * f
    return { x, y, w, f, ox: w / 2, oy: base - MID * f, ax: x + w / 2, ay: y + base - MID * f }
  }

  function measure() {
    on = root.offsetParent !== null
    if (!on) { g = null; return }
    const hdrEl = document.querySelector('.hdr')
    const hdr = hdrEl ? Math.round(hdrEl.getBoundingClientRect().height) : 0
    const W = root.clientWidth
    // высоту экрана меняем только при смене ширины или заметной разнице — не от панели браузера на телефоне
    const ih = window.innerHeight
    const vh = W !== lastW || lastVh < 0 || Math.abs(ih - lastVh) > 140 ? ih : lastVh
    lastW = W
    lastVh = vh
    const innerH = Math.max(320, vh - hdr)
    const s = W / 1920
    const band = Math.min(723 * s, innerH * 0.72) // белая полоса с маленьким заголовком в состоянии 1 (в макете 723 при 1920)
    // карточки как в макете: 1446×1080. На компьютере — по высоте экрана, на узком/вертикальном экране — по ширине
    const portrait = innerH > W * 0.95
    // вертикальный экран (телефон, планшет): карточки чуть уже экрана и выше — фото обрезается по краям, а не мельчит
    const cw = Math.round(portrait ? W * (W < 810 ? 0.86 : 0.8) : Math.min(innerH * 1446 / 1080, W * 0.9))
    const ch = Math.round(portrait ? Math.min(innerH * 0.64, cw * 1.15) : cw * 1080 / 1446)
    const k = ch / 1080
    const stripTop = Math.round((innerH - ch) / 2) // где стоит лента карточек в состоянии 2
    const st = root.style
    st.setProperty('--s', s.toFixed(4))
    st.setProperty('--op-cw', cw + 'px')
    st.setProperty('--k', k.toFixed(4))
    st.setProperty('--inner-h', innerH + 'px')
    st.setProperty('--hdr-off', hdr + 'px')
    st.setProperty('--ch', ch + 'px')
    st.setProperty('--strip-top', stripTop + 'px')
    st.setProperty('--t1y', ((band - small.offsetHeight) / 2).toFixed(1) + 'px')
    const Lb = Math.max(band * 1.25, innerH * 0.6) // переход в состояние 2
    const hold = innerH * 0.2 // короткая пауза в состоянии 2
    const Lc = Math.max(0, n * cw - W) // горизонтальная прокрутка: 1px вниз = 1px вбок
    st.setProperty('--op-h', innerH + Lb + hold + Lc + 'px')
    // сбрасываем трансформации, чтобы измерить слова в исходных местах
    ;[...wS, ...wB].forEach((w) => { w.style.transform = ''; w.style.opacity = '' })
    const A = wS.map((w) => boxOf(w, 0.8))
    const B = wB.map((w) => boxOf(w, 1.2))
    g = { hdr, vh, W, innerH, band, Lb, hold, Lc, A, B, k, stripTop }
    apply()
  }

  let lastKey = ''
  function apply() {
    if (!on || !g) return
    const { hdr, vh, W, innerH, band, Lb, hold, Lc, A, B, k, stripTop } = g
    const top = root.getBoundingClientRect().top
    const d = hdr - top // сколько прокручено от момента закрепления
    // 1) появление, пока блок въезжает снизу
    const enter = clamp((vh - top) / Math.max(1, vh - hdr), 0, 1)
    // 2) переход в состояние 2
    const pB = clamp(d / Lb, 0, 1)
    const E = reduce ? (pB > 0.5 ? 1 : 0) : easeInOut(pB)
    // 3) горизонталь
    const pC = clamp((d - Lb - hold) / Math.max(1, Lc), 0, 1)
    const key = enter.toFixed(4) + '|' + E.toFixed(4) + '|' + pC.toFixed(5) + '|' + W
    if (key === lastKey) return
    lastKey = key

    // фото: в состоянии 1 начинается под белой полосой, в состоянии 2 — на весь экран
    const ee = reduce ? 1 : easeOut(span(enter, 0.15, 1))
    const lift = easeInOut(pB)
    view.style.transform = 'translate3d(0,' + lerp(band, stripTop, lift).toFixed(2) + 'px,0)'
    const side = (1 - ee) * 8
    view.style.clipPath = ee >= 1 ? '' : 'inset(' + ((1 - ee) * 14).toFixed(3) + '% ' + side.toFixed(3) + '% 0 ' + side.toFixed(3) + '%)'
    const img0 = cards[0].querySelector('img')
    if (img0) img0.style.transform = ee >= 1 ? '' : 'scale(' + (1 + 0.06 * (1 - ee)).toFixed(4) + ')'

    track.style.transform = 'translate3d(' + (-pC * Lc).toFixed(2) + 'px,0,0)'
    // подписи уменьшаются вместе с переходом заголовка: 71.49 → 48
    root.style.setProperty('--cap', Math.max(lerp(71.49, 48, E) * k, lerp(17, 13, E)).toFixed(2) + 'px')

    // заголовок: каждое слово едет и растёт из маленького в крупное, начертание меняется плавной сменой слоёв
    const fade = span(E, 0.18, 0.55)
    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = B[i]
      const ax = lerp(a.ax, b.ax, E)
      const ay = lerp(a.ay, b.ay, E)
      const w = lerp(a.w, b.w, E)
      const f = lerp(a.f, b.f, E)
      // появление маленьких слов снизу
      const ek = reduce ? 1 : easeOut(span(enter, 0.55 + i * 0.1, 0.9 + i * 0.1))
      const rise = (1 - ek) * a.f * 0.9
      const sA = wS[i].style
      sA.transformOrigin = a.ox.toFixed(2) + 'px ' + a.oy.toFixed(2) + 'px'
      sA.transform = 'translate3d(' + (ax - a.ax).toFixed(2) + 'px,' + (ay - a.ay + rise).toFixed(2) + 'px,0) scale(' + (w / a.w).toFixed(4) + ',' + (f / a.f).toFixed(4) + ')'
      sA.opacity = String(Math.min(ek, 1 - fade))
      const sB = wB[i].style
      sB.transformOrigin = b.ox.toFixed(2) + 'px ' + b.oy.toFixed(2) + 'px'
      sB.transform = 'translate3d(' + (ax - b.ax).toFixed(2) + 'px,' + (ay - b.ay).toFixed(2) + 'px,0) scale(' + (w / b.w).toFixed(4) + ',' + (f / b.f).toFixed(4) + ')'
      sB.opacity = String(fade)
      sB.visibility = fade > 0 ? 'visible' : 'hidden'
    }
  }

  // фото грузим заранее, когда блок уже близко (горизонтальные карточки сами не попадают в зону «ленивой» загрузки)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return
      io.disconnect()
      cards.forEach((c, i) => {
        const img = c.querySelector('img')
        if (!img) return
        setTimeout(() => { img.loading = 'eager'; if (img.decode) img.decode().catch(() => {}) }, i * 120)
      })
    }, { rootMargin: '150% 0px' })
    io.observe(root)
  }

  let ticking = false
  window.addEventListener('scroll', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => { ticking = false; apply() })
  }, { passive: true })
  let rT = 0
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(measure, 80) })
  measure()
  setTimeout(measure, 600) // шапка могла сжаться позже
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure)
}
