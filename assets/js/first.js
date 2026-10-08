// Первый экран: пиксельный ASCII-прелоадер, появление вопроса и переход по «да / нет».

import { initScramble, makeAsciiGrid, drawAsciiFrame, coverAndGo } from './ascii.js'
import { initCursor } from './cursor.js'

const root = document.documentElement
initScramble()
initCursor()

/* ---------- переход по «да / нет» ---------- */
document.querySelectorAll('[data-go]').forEach((a) =>
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return // новая вкладка — как обычная ссылка
    e.preventDefault()
    coverAndGo(a.getAttribute('href'), { coverMs: 500, revealMs: 600, cellSize: 40 })
  })
)

/* ---------- прелоадер ---------- */
function ease(x) {
  // быстрый старт, «подвисание» в середине, рывок в конце
  if (x < 0.3) return x * 1.6
  if (x < 0.55) return 0.48 + (x - 0.3) * 0.3
  return Math.min(1, 0.555 + (x - 0.55) * 0.99)
}

function runLoader() {
  const wrap = document.querySelector('.fs-loader')
  const canvas = wrap.querySelector('canvas')
  const card = wrap.querySelector('.fs-card')
  const bar = wrap.querySelector('.fs-card__bar')
  let g = makeAsciiGrid(canvas, 40)
  const onResize = () => (g = makeAsciiGrid(canvas, 40))
  window.addEventListener('resize', onResize)
  document.body.style.overflow = 'hidden'

  const durMs = 1200
  const holdMs = 350
  const dissolveMs = 900
  const start = performance.now()
  let lastPct = -1
  let revealed = false
  const barLen = 16

  const draw = (now) => {
    const el = Math.max(0, now - start) // метка кадра может быть чуть раньше старта
    const t = el / 1000
    let progress = 1
    let dissolve = 0
    if (el < durMs) progress = ease(el / durMs)
    else if (el >= durMs + holdMs) dissolve = (el - durMs - holdMs) / dissolveMs

    const pct = Math.round(progress * 100)
    if (pct !== lastPct) {
      lastPct = pct
      const filled = Math.round((pct / 100) * barLen)
      bar.textContent = '[' + '█'.repeat(filled) + '░'.repeat(barLen - filled) + '] ' + String(pct).padStart(3, '0') + '%'
    }
    if (dissolve > 0 && !revealed) {
      revealed = true
      card.remove()
      wrap.style.background = 'transparent'
      wrap.style.pointerEvents = 'none'
      root.classList.add('fs-reveal')
      root.classList.remove('fs-loading')
      wrap.style.display = 'block'
    }
    if (dissolve >= 1) {
      wrap.remove()
      document.body.style.overflow = ''
      window.removeEventListener('resize', onResize)
      return
    }
    drawAsciiFrame(g, t, { mode: 'load', progress, dissolve })
    requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
}

if (root.classList.contains('fs-loading')) {
  try {
    sessionStorage.setItem('loaderPlayed', '1')
  } catch (e) {}
  runLoader()
} else {
  const l = document.querySelector('.fs-loader')
  l && l.remove()
}
