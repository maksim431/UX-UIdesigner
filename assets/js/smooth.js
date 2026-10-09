// Плавная прокрутка колесом мыши (инерция как у Lenis, без внешних библиотек).
// Работает только с мышью/тачпадом на компьютере; на телефонах прокрутка родная.
// Цикл анимации крутится только пока страница «доезжает» до цели — в покое ничего не считается.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export function initSmoothScroll({ lerp = 0.1 } = {}) {
  const fine = window.matchMedia('(pointer: fine)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduce) return null

  let target = window.scrollY
  let current = window.scrollY
  let animating = false
  let raf = 0
  let tween = null
  // «стопоры»: точки, через которые сильная прокрутка вниз не проскакивает
  const stops = []
  let lockUntil = 0
  let lockMax = 0
  const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const go = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' })

  const step = (time) => {
    raf = 0
    if (tween) {
      const k = clamp((time - tween.t0) / tween.d, 0, 1)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      current = tween.from + (tween.to - tween.from) * e
      target = current
      go(current)
      if (k >= 1) {
        tween = null
        animating = false
        return
      }
      raf = requestAnimationFrame(step)
      return
    }
    current += (target - current) * lerp
    if (Math.abs(target - current) < 0.4) {
      current = target
      go(current)
      animating = false
      return
    }
    go(current)
    raf = requestAnimationFrame(step)
  }
  const start = () => {
    if (!animating) {
      animating = true
      raf = requestAnimationFrame(step)
    }
  }

  const onWheel = (e) => {
    if (e.ctrlKey || e.defaultPrevented) return
    if (document.documentElement.classList.contains('no-scroll')) return
    let n = e.target
    while (n && n !== document.body && n.nodeType === 1) {
      const cs = getComputedStyle(n)
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight + 2) return
      n = n.parentElement
    }
    e.preventDefault()
    tween = null
    if (!animating) {
      current = window.scrollY
      target = window.scrollY
    }
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
    const now = performance.now()
    // после остановки на стопоре гасим ВСЮ оставшуюся инерцию тачпада/колеса этого жеста:
    // пока события идут без паузы — держим; новый жест (после паузы) прокручивает дальше.
    // Так страница не «дёргается», доезжая остаток инерции после остановки. Вверх не держим.
    if (dy > 0 && now < lockUntil) {
      lockUntil = Math.min(lockMax, now + 180)
      return
    }
    let next = clamp(target + dy, 0, maxY())
    if (dy > 0) {
      for (const fn of stops) {
        const y = Math.round(fn())
        if (target < y - 2 && next > y) {
          next = y
          lockUntil = now + Math.min(1200, Math.abs(y - current) * 1.2) + 300
          lockMax = now + 5000
          break
        }
      }
    }
    target = next
    start()
  }
  const onScroll = () => {
    if (!animating) {
      current = window.scrollY
      target = window.scrollY
    }
  }
  // если пользователь тянет полосу прокрутки или жмёт клавиши — отдаём управление браузеру
  const cancel = () => {
    if (animating && !tween) {
      cancelAnimationFrame(raf)
      raf = 0
      animating = false
    }
  }
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', cancel)
  window.addEventListener('pointerdown', cancel)

  return {
    // fn() возвращает координату стопора (пересчитывается на каждом шаге колеса)
    addStop(fn) {
      stops.push(fn)
    },
    scrollTo(y, duration = 1.2) {
      cancelAnimationFrame(raf)
      tween = { from: window.scrollY, to: clamp(y, 0, maxY()), t0: performance.now(), d: duration * 1000 }
      current = window.scrollY
      animating = true
      raf = requestAnimationFrame(step)
    },
  }
}

export function scrollToY(smooth, y, duration) {
  if (smooth) smooth.scrollTo(y, duration)
  else window.scrollTo({ top: y, behavior: 'smooth' })
}
