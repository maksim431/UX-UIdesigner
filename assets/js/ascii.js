// ASCII-эффекты сайта: «пиксельная» подмена букв при наведении и пиксельные переходы между страницами.

export const PIXEL_CHARS = ['█', '▓', '▒', '░', '▄', '▀', '■', '▪']
const RAMP = ' .:-=+*#%@'

/* ---------- скремблинг текста ---------- */
// mode: 'hover' — при наведении/фокусе, 'always' — постоянно (только пока элемент на экране)
export function scramble(el, { speed = 60, mode = 'hover', target } = {}) {
  const node = target || el
  const text = node.textContent
  // ширину фиксируем, чтобы кнопка не «дышала» от разной ширины символов
  let timer = 0
  const tick = () => {
    const idx = []
    for (let i = 0; i < text.length; i++) if (text[i] !== ' ') idx.push(i)
    const n = Math.min(idx.length, text.length <= 3 ? 1 : 2)
    const pick = new Set()
    while (pick.size < n) pick.add(idx[(Math.random() * idx.length) | 0])
    let out = ''
    for (let i = 0; i < text.length; i++) out += pick.has(i) ? PIXEL_CHARS[(Math.random() * PIXEL_CHARS.length) | 0] : text[i]
    node.textContent = out
  }
  const start = () => {
    if (!timer) timer = setInterval(tick, speed)
  }
  const stop = () => {
    clearInterval(timer)
    timer = 0
    node.textContent = text
  }
  if (!node.getAttribute('aria-label') && el === node) el.setAttribute('aria-label', text)
  if (mode === 'always') {
    const io = new IntersectionObserver((e) => (e[0].isIntersecting && !document.hidden ? start() : stop()))
    io.observe(el)
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()))
    return
  }
  el.addEventListener('mouseenter', start)
  el.addEventListener('mouseleave', stop)
  // фокус с клавиатуры — тоже «наведение»; программный фокус после клика мышью — нет
  el.addEventListener('focus', () => {
    try {
      if (el.matches(':focus-visible')) start()
    } catch (e) {
      start()
    }
  })
  el.addEventListener('blur', stop)
}

export function initScramble(root = document) {
  root.querySelectorAll('[data-scramble]').forEach((el) => {
    const speed = parseInt(el.getAttribute('data-scramble'), 10) || 60
    const mode = el.getAttribute('data-scramble-mode') || 'hover'
    const target = el.querySelector('[data-scramble-text]') || el
    scramble(el, { speed, mode, target })
  })
}

/* ---------- ASCII-сетка для прелоадера и переходов ---------- */
export const ASCII_COLORS = { bg: '#EDEDED', glyph: '#000000', light: '#FFFFFF', font: 'Fira Mono' }

export function makeAsciiGrid(canvas, cellSize = 40) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const size = Math.min(cellSize, Math.max(20, rect.width / 12))
  const cols = Math.max(8, Math.ceil(rect.width / size))
  const rows = Math.max(8, Math.ceil(rect.height / size))
  const rnd = new Float32Array(cols * rows)
  for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random()
  return { ctx, cols, rows, cw: rect.width / cols, ch: rect.height / rows, rnd }
}

// mode: 'cover' — пиксели закрывают экран (k 0→1); 'reveal' — растворяются (k 0→1);
// 'load' — прелоадер (progress 0→1, dissolve 0→1)
export function drawAsciiFrame(g, t, { mode = 'cover', k = 0, progress = 1, dissolve = 0 }, c = ASCII_COLORS) {
  const { ctx, cols, rows, cw, ch, rnd } = g
  ctx.clearRect(0, 0, cols * cw, rows * ch)
  ctx.font = Math.round(Math.min(cw, ch) * 0.42) + 'px "' + c.font + '", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = cols / 2
  const cy = rows / 2
  const R = Math.min(cols, rows) * 0.62
  const scan = ((t * 9) % (rows + 6)) - 3
  const frame = Math.floor(t * 12)
  // сначала все «светлые» клетки и фон одной пачкой, потом символы — меньше переключений цвета
  const glyphs = []
  ctx.fillStyle = c.light
  const light = new Path2D()
  const dark = new Path2D()
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const r = rnd[i]
      let edge = false
      if (mode === 'cover') {
        if (r >= k) continue
        edge = r > k - 0.08
      } else if (mode === 'reveal') {
        if (r < k) continue
        edge = k > 0 && r < k + 0.06
      } else if (dissolve > 0) {
        if (r < dissolve) continue
        edge = r < dissolve + 0.06
      }
      const dx = (x - cx) / R
      const dy = (y - cy) / R
      const d = Math.sqrt(dx * dx + dy * dy)
      let v = Math.sin(x * 0.35 + t * 1.4) + Math.sin(y * 0.55 - t * 1.1) + Math.sin((x + y) * 0.22 + t * 0.8)
      v = (v + 3) / 6
      v = v * 0.55 + Math.max(0, 1 - d) * 0.6
      v = mode === 'load' ? v * (0.35 + progress * 0.75) : v * 1.1
      if (Math.abs(y - scan) < 1) v += 0.35
      v = Math.max(0, Math.min(0.999, v))
      const px = x * cw
      const py = y * ch
      if ((v > 0.82 && r > 0.55) || edge) {
        light.rect(px, py, cw + 0.5, ch + 0.5)
        continue
      }
      dark.rect(px, py, cw + 0.5, ch + 0.5)
      const glyph = (frame + i) % 17 === 0 ? (i % 2 ? '1' : '0') : RAMP[Math.floor(v * RAMP.length)]
      if (glyph !== ' ') glyphs.push(glyph, px + cw / 2, py + ch / 2 + 1, v > 0.6 ? 0.55 : v > 0.35 ? 0.35 : 0.2)
    }
  }
  ctx.fill(light)
  ctx.fillStyle = c.bg
  ctx.fill(dark)
  ctx.fillStyle = c.glyph
  for (let i = 0; i < glyphs.length; i += 4) {
    ctx.globalAlpha = glyphs[i + 3]
    ctx.fillText(glyphs[i], glyphs[i + 1], glyphs[i + 2])
  }
  ctx.globalAlpha = 1
}

function layer() {
  const wrap = document.createElement('div')
  wrap.className = 'ascii-layer'
  wrap.setAttribute('aria-hidden', 'true')
  wrap.setAttribute('data-ascii-transition', '')
  const canvas = document.createElement('canvas')
  wrap.appendChild(canvas)
  document.body.appendChild(wrap)
  return { wrap, canvas }
}

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FLAG = 'asciiTransition'

// Пиксели закрывают экран → переход на новую страницу (там они растворяются)
export function coverAndGo(href, { coverMs = 500, revealMs = 600, cellSize = 40 } = {}) {
  if (reduceMotion()) {
    location.href = href
    return
  }
  const { canvas } = layer()
  const g = makeAsciiGrid(canvas, cellSize)
  const t0 = performance.now()
  let gone = false
  const loop = (now) => {
    const k = Math.min(1, (now - t0) / coverMs)
    drawAsciiFrame(g, (now - t0) / 1000, { mode: 'cover', k: k * 1.08 })
    if (k >= 1 && !gone) {
      gone = true
      try {
        sessionStorage.setItem(FLAG, JSON.stringify({ time: Date.now(), reveal: revealMs, cellSize }))
      } catch (e) {}
      location.href = href
    }
    if (!gone || now - t0 < coverMs + 3000) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

// На новой странице: если пришли переходом — растворяем пиксели. Возвращает Promise, который
// выполняется, когда экран открыт (или сразу, если перехода не было).
export function revealIfNeeded() {
  let f = null
  try {
    f = JSON.parse(sessionStorage.getItem(FLAG) || 'null')
    sessionStorage.removeItem(FLAG)
  } catch (e) {}
  const unhide = () => document.documentElement.classList.remove('ascii-pending')
  if (!f || Date.now() - f.time > 6000 || reduceMotion()) {
    unhide()
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    const { wrap, canvas } = layer()
    wrap.style.pointerEvents = 'none'
    const g = makeAsciiGrid(canvas, f.cellSize || 40)
    drawAsciiFrame(g, 0.5, { mode: 'reveal', k: 0 })
    unhide()
    const ms = Math.max(150, f.reveal || 600)
    // ждём шрифт и первый кадр, чтобы не мелькнула незагруженная страница
    const go = () => {
      const start = performance.now()
      const loop = (now) => {
        const el = Math.max(0, now - start)
        if (el >= ms) {
          wrap.remove()
          resolve(true)
          return
        }
        drawAsciiFrame(g, 0.5 + el / 1000, { mode: 'reveal', k: (el / ms) * 1.08 })
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    }
    const ready = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve()
    ready.then(() => requestAnimationFrame(go))
  })
}
