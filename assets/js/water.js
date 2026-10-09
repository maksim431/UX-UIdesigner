// Первый экран: вид сверху (flat lay) в тёмную воду. Японский карп кои из пиксельной мозаики —
// светлые плитки с символами (S X 8 0 G…): белыми, красно-оранжевыми (узор кохаку) и голубыми,
// с холодным свечением (bloom) у головы. Края силуэта мягко размыты.
//
// Карп плавает по всему фрейму: медленно петляет по плавной траектории, поворачивает по ходу движения,
// тело изгибается волной от головы к хвосту (чем быстрее плывёт — тем чаще бьёт хвостом),
// грудные плавники слегка «гребут».
//
// Как устроено:
//  • каждый кадр контур карпа (с изгибом и поворотом) рисуется в маленькую маску размером с сетку плиток;
//  • маска сглаживается (среднее по соседям) — из неё прозрачность плиток: края выходят мягкими;
//  • окрас и символы привязаны к телу (координаты внутри рыбы), поэтому пятна плывут вместе с ней;
//  • bloom — уменьшенные копии слоя карпа поверх в режиме «осветление», плюс бирюзовый ореол у головы;
//  • canvas во всю ширину экрана: когда фрейм при прокрутке раздвигается, фон есть и по краям;
//  • анимация стоит, когда блок не виден, вкладка скрыта или включено «уменьшение движения».

const GLYPHS = 'SX80G8SX08S8X0G!<>$%'
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
// гладкий шум для пятен окраса
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi + s, yi), b = hash(xi + 1 + s, yi), c = hash(xi + s, yi + 1), d = hash(xi + 1 + s, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/* ---------- кои, вид сверху: голова вверх, длина 1 (y от -0.5 до 0.5) ---------- */
const BODY = [
  [-0.5, 0], [-0.485, 0.04], [-0.455, 0.07], [-0.4, 0.094], [-0.32, 0.108], [-0.22, 0.113],
  [-0.12, 0.108], [-0.02, 0.095], [0.06, 0.078], [0.13, 0.058], [0.19, 0.042], [0.24, 0.032],
]
// точки контура помечены: 0 — тело, 1 — грудной плавник, 2 — брюшной, 3 — хвост
function koiOutline() {
  const right = []
  for (const [y, w] of BODY) {
    right.push([w, y, 0])
    if (y === -0.32) [[0.15, -0.3], [0.2, -0.265], [0.215, -0.22], [0.19, -0.19], [0.14, -0.195], [0.112, -0.21]].forEach((p) => right.push([p[0], p[1], 1]))
    if (y === -0.02) [[0.13, 0.0], [0.155, 0.04], [0.13, 0.065], [0.085, 0.055]].forEach((p) => right.push([p[0], p[1], 2]))
  }
  const tail = [[0.06, 0.29], [0.13, 0.36], [0.175, 0.43], [0.165, 0.485], [0.12, 0.47], [0.07, 0.45], [0.03, 0.43], [0, 0.415],
    [-0.03, 0.43], [-0.07, 0.45], [-0.12, 0.47], [-0.165, 0.485], [-0.175, 0.43], [-0.13, 0.36], [-0.06, 0.29]].map((p) => [p[0], p[1], 3])
  const left = right.slice().reverse().map(([x, y, k]) => [-x, y, k])
  return right.concat(tail, left)
}
const KOI = koiOutline()

export function mountWater(host, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'water'
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d', { alpha: false })
  const layer = document.createElement('canvas') // слой карпа — из него же делается свечение
  const lctx = layer.getContext('2d')
  const b2 = document.createElement('canvas'), b4 = document.createElement('canvas'), b8 = document.createElement('canvas'), b16 = document.createElement('canvas')
  const g2 = b2.getContext('2d'), g4 = b4.getContext('2d'), g8 = b8.getContext('2d'), g16 = b16.getContext('2d')
  const mask = document.createElement('canvas')
  const mctx = mask.getContext('2d', { willReadFrequently: true })

  let W = 1, H = 1, FW = 1, dpr = 1, tile = 12, tcols = 0, trows = 0, len = 1
  let dots = null, dcell = 12
  let font = getComputedStyle(document.body).fontFamily || 'monospace'

  /* ---------- движение: плавная петляющая траектория по всему фрейму ---------- */
  // фрейм в координатах canvas (canvas шире фрейма и стоит по центру)
  function frameBox() {
    const ox = (W - FW) / 2
    return { x0: ox, x1: ox + FW, y0: 0, y1: H }
  }
  function pathAt(t) {
    const f = frameBox()
    const mx = len * 0.32, my = len * 0.32
    const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2
    const ax = (f.x1 - f.x0) / 2 - mx, ay = (f.y1 - f.y0) / 2 - my
    // сумма медленных синусоид с «некратными» частотами — путь не повторяется на глаз
    const x = cx + ax * (0.62 * Math.sin(t * 0.071 + 0.4) + 0.38 * Math.sin(t * 0.163 + 2.1))
    const y = cy + ay * (0.58 * Math.sin(t * 0.093 + 1.3) + 0.42 * Math.cos(t * 0.137 + 0.2))
    return [x, y]
  }

  let heading = 0, prevHeading = 0, phase = 0, lastT = -1, turn = 0
  function step(t) {
    const [x, y] = pathAt(t)
    const [x2, y2] = pathAt(t + 0.25)
    const vx = x2 - x, vy = y2 - y
    const sp = Math.hypot(vx, vy) / 0.25 // пикселей в секунду
    const target = Math.atan2(vx, -vy)
    if (lastT < 0) heading = target
    let d = target - heading
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const dt = lastT < 0 ? 0 : clamp(t - lastT, 0, 0.1)
    heading += d * Math.min(1, dt * 3)
    let dh = heading - prevHeading
    while (dh > Math.PI) dh -= 2 * Math.PI
    while (dh < -Math.PI) dh += 2 * Math.PI
    turn = turn * 0.9 + (dt ? dh / dt : 0) * 0.1
    prevHeading = heading
    // частота взмахов хвоста растёт со скоростью
    phase += dt * (2.2 + 4 * clamp(sp / len, 0, 1.2))
    lastT = t
    return { x, y, sp }
  }

  // поза: волна по телу (амплитуда растёт к хвосту) + изгиб на повороте + поворот по курсу
  function poseFn(st) {
    const c = Math.cos(heading), s = Math.sin(heading)
    const bendTurn = clamp(-turn * 0.35, -0.12, 0.12)
    return (x, y, k) => {
      const u = y + 0.5 // 0 у головы, 1 у хвоста
      const amp = 0.012 + 0.075 * u * u
      let bx = x + amp * Math.sin(u * 5.2 - phase) + bendTurn * u * u
      if (k === 1) bx *= 1 + 0.12 * Math.sin(phase * 0.6) // грудные плавники гребут
      return [st.x + (bx * c - y * s) * len, st.y + (bx * s + y * c) * len]
    }
  }

  function resize() {
    FW = Math.max(1, host.clientWidth)
    const w = Math.max(FW, document.documentElement.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(1.5, window.devicePixelRatio || 1)
    if (w === W && h === H && d === dpr && tcols) return
    W = w; H = h; dpr = d
    canvas.style.width = W + 'px'
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    layer.width = canvas.width
    layer.height = canvas.height
    b2.width = Math.max(1, canvas.width >> 1); b2.height = Math.max(1, canvas.height >> 1)
    b4.width = Math.max(1, canvas.width >> 2); b4.height = Math.max(1, canvas.height >> 2)
    b8.width = Math.max(1, canvas.width >> 3); b8.height = Math.max(1, canvas.height >> 3)
    b16.width = Math.max(1, canvas.width >> 4); b16.height = Math.max(1, canvas.height >> 4)
    const phone = FW < 810
    tile = phone ? 9 : FW < 1200 ? 11 : 12
    len = phone ? Math.min(H * 0.46, FW * 0.95) : Math.min(H * 0.6, FW * 0.36)
    tcols = Math.ceil(W / tile)
    trows = Math.ceil(H / tile)
    mask.width = tcols
    mask.height = trows
    buildDots()
    draw(last)
  }

  // неподвижная россыпь едва заметных точек на фоне (как в референсе) — рисуется один раз
  function buildDots() {
    dcell = FW < 810 ? 10 : 12
    dots = document.createElement('canvas')
    dots.width = canvas.width
    dots.height = canvas.height
    const g = dots.getContext('2d')
    const cols = Math.ceil(W / dcell), rows = Math.ceil(H / dcell)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const s = hash(r * 977 + c, 13)
      if (s > 0.55) continue
      g.fillStyle = 'rgba(70,170,190,' + (0.05 + s * 0.12).toFixed(3) + ')'
      const sz = Math.max(1, Math.round(dpr * (s < 0.08 ? 2 : 1)))
      g.fillRect(Math.round((c + 0.5) * dcell * dpr), Math.round((r + 0.5) * dcell * dpr), sz, sz)
    }
  }

  let last = 0, hudKey = -1
  function updateHud(t, st) {
    if (!hud) return
    const k = Math.floor(t * 2)
    if (k === hudKey) return
    hudKey = k
    const f = frameBox()
    hud.textContent = '679 — KOI ' + clamp((st.x - f.x0) / (f.x1 - f.x0), 0, 1).toFixed(2) + ' / ' + clamp(st.y / H, 0, 1).toFixed(2)
  }

  function draw(t) {
    last = t
    if (!tcols) return
    const st = step(t)
    const P = poseFn(st)
    const sc = dpr

    // маска силуэта в разрешении сетки
    mctx.setTransform(1, 0, 0, 1, 0, 0)
    mctx.clearRect(0, 0, tcols, trows)
    const pts = KOI.map(([x, y, k]) => { const [a, b] = P(x, y, k); return [a / tile, b / tile] })
    const n = pts.length
    const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]
    mctx.beginPath()
    let m = mid(n - 1)
    mctx.moveTo(m[0], m[1])
    for (let i = 0; i < n; i++) { m = mid(i); mctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]) }
    mctx.closePath()
    mctx.fillStyle = '#fff'
    mctx.fill()
    // границы, где есть рыба (+ запас на размытие)
    let x0 = tcols, x1 = 0, y0 = trows, y1 = 0
    for (const [a, b] of pts) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b) }
    x0 = clamp(Math.floor(x0) - 2, 0, tcols - 1); x1 = clamp(Math.ceil(x1) + 2, 0, tcols - 1)
    y0 = clamp(Math.floor(y0) - 2, 0, trows - 1); y1 = clamp(Math.ceil(y1) + 2, 0, trows - 1)
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    const d = mctx.getImageData(x0, y0, bw, bh).data
    const A = (c, r) => (c < 0 || r < 0 || c >= bw || r >= bh ? 0 : d[(r * bw + c) * 4 + 3] / 255)

    // фон: глубокий синий с мягким светлым пятном около головы
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    const [hx, hy] = P(0, -0.4, 0)
    const bg = ctx.createRadialGradient(hx * sc, hy * sc, 0, hx * sc, hy * sc, Math.max(W, H) * 0.85 * sc)
    bg.addColorStop(0, '#0f3762')
    bg.addColorStop(0.45, '#0a2246')
    bg.addColorStop(1, '#040b1d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (dots) ctx.drawImage(dots, 0, 0)

    // плитки карпа
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, layer.width, layer.height)
    lctx.font = '500 ' + Math.round(tile * 0.82 * sc) + 'px ' + font
    lctx.textAlign = 'center'
    lctx.textBaseline = 'middle'
    const tick = Math.floor(t * 8)
    const ts = tile * sc
    const gap = Math.max(1, Math.round(sc))
    const ch = Math.cos(heading), sh = Math.sin(heading)
    for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) {
      // размытие края: среднее по соседям 3×3, из него — прозрачность плитки
      let sum = 0
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sum += A(c + i, r + j)
      const soft = sum / 9
      if (soft < 0.12) continue
      const fade = sstep(0.12, 0.85, soft)
      const gc = c + x0, gr = r + y0
      const px = (gc + 0.5) * tile, py = (gr + 0.5) * tile
      // координаты внутри рыбы (без учёта изгиба): u — от головы к хвосту, v — поперёк
      const lx = ((px - st.x) * ch + (py - st.y) * sh) / len
      const ly = (-(px - st.x) * sh + (py - st.y) * ch) / len
      const u = clamp(ly + 0.5, 0, 1)
      const head01 = 1 - u
      // окрас кохаку в координатах рыбы — пятна плывут вместе с ней
      const red = vnoise(lx * 9 + 4, ly * 9 + 4, 3) > 0.55 || (u > 0.05 && u < 0.14 && vnoise(lx * 18, ly * 18, 9) > 0.35)
      const id = Math.floor((lx + 1) * 40) * 131 + Math.floor((ly + 1) * 40)
      const s = hash(id, 21)
      let L = 0.55 + 0.25 * head01 * head01 + (s - 0.5) * 0.22
      L = clamp(L, 0.4, 0.9) * (0.75 + 0.25 * fade)
      const tileA = (0.72 + 0.23 * L) * fade
      let fr, fg, fb
      if (red && s > 0.25) { fr = 236; fg = 205 - 25 * (1 - L); fb = 198 - 30 * (1 - L) }
      else { fr = 214 + 30 * L; fg = 222 + 26 * L; fb = 232 + 20 * L }
      lctx.globalAlpha = tileA
      lctx.fillStyle = 'rgb(' + Math.round(fr * L) + ',' + Math.round(fg * L) + ',' + Math.round(fb * L) + ')'
      const x = Math.round(gc * ts), y = Math.round(gr * ts)
      lctx.fillRect(x, y, ts - gap, ts - gap)
      if (s > 0.12 && fade > 0.35) {
        const flick = hash(id, tick) < 0.035
        const glyph = GLYPHS[Math.floor((flick ? hash(id, tick + 7) : s) * GLYPHS.length) % GLYPHS.length]
        const q = hash(id, 77)
        let col
        if (red) col = q < 0.55 ? '#d8402a' : q < 0.85 ? '#ec7444' : (L > 0.7 ? '#5b6680' : '#ffffff')
        else col = q < 0.5 ? (L > 0.7 ? '#58637c' : '#c9d3e6') : q < 0.72 ? (L > 0.75 ? '#8a96b0' : '#ffffff') : q < 0.9 ? '#3f8cf0' : '#d8402a'
        lctx.globalAlpha = fade
        lctx.fillStyle = col
        lctx.fillText(glyph, x + (ts - gap) / 2, y + (ts - gap) / 2 + sc)
      }
    }
    lctx.globalAlpha = 1

    // мягкий ореол-размытие под плитками (края силуэта расплываются)
    g2.clearRect(0, 0, b2.width, b2.height)
    g2.drawImage(layer, 0, 0, b2.width, b2.height)
    g4.clearRect(0, 0, b4.width, b4.height)
    g4.drawImage(b2, 0, 0, b4.width, b4.height)
    g8.clearRect(0, 0, b8.width, b8.height)
    g8.drawImage(b4, 0, 0, b8.width, b8.height)
    g16.clearRect(0, 0, b16.width, b16.height)
    g16.drawImage(b8, 0, 0, b16.width, b16.height)
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = 0.55
    ctx.drawImage(b4, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.9
    ctx.drawImage(layer, 0, 0)
    ctx.globalAlpha = 0.35
    ctx.drawImage(b2, 0, 0, canvas.width, canvas.height)

    // bloom «осветлением» и бирюзовый ореол у головы
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.22
    ctx.drawImage(b4, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.34
    ctx.drawImage(b8, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.34
    ctx.drawImage(b16, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
    const pulse = 0.9 + 0.1 * Math.sin(t * 1.3)
    const hr = len * 0.24 * sc
    const hg = ctx.createRadialGradient(hx * sc, hy * sc, 0, hx * sc, hy * sc, hr)
    hg.addColorStop(0, 'rgba(150,240,255,' + (0.26 * pulse).toFixed(3) + ')')
    hg.addColorStop(0.4, 'rgba(90,200,240,' + (0.1 * pulse).toFixed(3) + ')')
    hg.addColorStop(1, 'rgba(40,120,200,0)')
    ctx.fillStyle = hg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // виньетка: края фрейма уходят в темноту
    ctx.globalCompositeOperation = 'source-over'
    const vg = ctx.createRadialGradient(W * 0.5 * sc, H * 0.45 * sc, Math.min(W, H) * 0.35 * sc, W * 0.5 * sc, H * 0.5 * sc, Math.max(W, H) * 0.75 * sc)
    vg.addColorStop(0, 'rgba(2,6,16,0)')
    vg.addColorStop(1, 'rgba(2,6,16,0.55)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    updateHud(t, st)
  }

  /* ---------- цикл ---------- */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')
  let running = false, visible = false, raf = 0, t0 = 0, lastFrame = 0, minDt = 1000 / 30, cost = 0
  function frame(now) {
    raf = 0
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (now - lastFrame < minDt - 2) return
    lastFrame = now
    if (!t0) t0 = now - last * 1000
    const s = performance.now()
    draw((now - t0) / 1000)
    cost = cost * 0.9 + (performance.now() - s) * 0.1
    minDt = cost > 18 ? 1000 / 20 : 1000 / 30
  }
  function update() {
    const should = visible && !document.hidden && !(reduce && reduce.matches)
    if (should && !running) {
      running = true
      t0 = 0
      lastFrame = 0
      lastT = -1
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ready.then(() => { font = getComputedStyle(document.body).fontFamily || font; lastT = -1; draw(last) })
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  window.addEventListener('resize', resize)
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; update() })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)
  last = 4
  resize()
}
