// Первый экран: вид сверху (flat lay) на толщу воды. По всему фрейму — блики каустики, как на дне бассейна,
// нарисованные ASCII-символами и пикселями со свечением (bloom). По центру — неподвижный силуэт акулы
// и её тень на дне.
//
// Как устроено:
//  • фрейм разбит на сетку клеток; яркость клетки — «каустика» из нескольких искажённых синусоид
//    (светлые прожилки, которые медленно плывут), плюс крупные мягкие волны света;
//  • символ выбирается по яркости ( .:-=+*#%@ ), самые яркие места — пиксельные блоки █▓;
//  • акула и тень рисуются один раз в маленькую маску (по размеру сетки), в кадре только читаются;
//  • bloom: кадр уменьшается в 4 и 8 раз и накладывается сверху в режиме «осветление» — это дешёвое размытие;
//  • canvas шириной во весь экран: когда фрейм при прокрутке раздвигается до краёв, вода уже есть и там;
//  • анимация стоит, когда блок не виден, вкладка скрыта или включено «уменьшение движения».

const RAMP = ' .:-=+*#%@'
const PIX = '▓█'
// цвета символов по уровням яркости: от тёмной воды к белёсым бликам
const TINTS = [
  [70, 100, 214],
  [104, 140, 245],
  [150, 186, 255],
  [205, 228, 255],
  [236, 250, 255],
]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/* ---------- силуэт акулы, вид сверху: голова вверх, длина 1 (y от -0.5 до 0.5) ---------- */
// полуширина тела по длине
const BODY = [
  [-0.5, 0], [-0.47, 0.018], [-0.43, 0.036], [-0.37, 0.056], [-0.29, 0.075], [-0.2, 0.088],
  [0, 0.088], [0.1, 0.072], [0.18, 0.054], [0.25, 0.037], [0.31, 0.024], [0.35, 0.018],
]
function sharkOutline() {
  const right = []
  for (const [y, w] of BODY) {
    right.push([w, y])
    // грудной плавник: широкий у основания треугольник-серп, отведённый назад
    if (y === -0.2) right.push([0.17, -0.13], [0.25, -0.04], [0.31, 0.045], [0.25, 0.035], [0.16, -0.02], [0.093, -0.06])
    // брюшной плавник
    if (y === 0.1) right.push([0.09, 0.15], [0.105, 0.195], [0.06, 0.175])
  }
  // хвост: сверху — узкий раздвоенный серп
  const tail = [[0.045, 0.43], [0.07, 0.505], [0.045, 0.5], [0.012, 0.455], [0, 0.475], [-0.012, 0.455], [-0.045, 0.5], [-0.07, 0.505], [-0.045, 0.43]]
  const left = right.slice().reverse().map(([x, y]) => [-x, y])
  return right.concat(tail, left)
}
// хребет и спинной плавник (сверху — узкая полоска вдоль спины)
function spinePath(g, cx, cy, len, sx, sy) {
  const P = (x, y) => { const [px, py] = pose(x, y); return [cx + px * len * sx, cy + py * len * sy] }
  g.beginPath()
  const pts = [[0, -0.36], [0.006, -0.2], [0.014, -0.08], [0.012, 0.0], [0.004, 0.1], [0, 0.3], [-0.004, 0.1], [-0.012, 0.0], [-0.014, -0.08], [-0.006, -0.2]]
  pts.forEach(([x, y], k) => { const [a, b] = P(x, y); k ? g.lineTo(a, b) : g.moveTo(a, b) })
  g.closePath()
}
const SHARK = sharkOutline()

// поза: тело чуть изогнуто (акула скользит) и повёрнуто по диагонали
function pose(x, y) {
  const bx = x + 0.06 * Math.pow(y + 0.5, 2) - 0.015
  const a = (-14 * Math.PI) / 180
  return [bx * Math.cos(a) - y * Math.sin(a), bx * Math.sin(a) + y * Math.cos(a)]
}

function sharkPath(g, cx, cy, len, sx, sy) {
  const pts = SHARK.map(([x, y]) => {
    const [px, py] = pose(x, y)
    return [cx + px * len * sx, cy + py * len * sy]
  })
  g.beginPath()
  // сглаживаем ломаную: кривые через середины отрезков
  const n = pts.length
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]
  let m = mid(n - 1)
  g.moveTo(m[0], m[1])
  for (let i = 0; i < n; i++) {
    m = mid(i)
    g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1])
  }
  g.closePath()
}

export function mountWater(host, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'water'
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const scene = document.createElement('canvas')
  const sctx = scene.getContext('2d')
  const b4 = document.createElement('canvas')
  const b8 = document.createElement('canvas')
  const g4 = b4.getContext('2d')
  const g8 = b8.getContext('2d')

  let W = 1, H = 1, FW = 1, dpr = 1, cw = 7, ch = 10, cols = 0, rows = 0
  let atlas = null, aw = 0, ah = 0, body = null, shade = null, edge = null, spine = null, seeds = null
  let font = getComputedStyle(document.body).fontFamily || 'monospace'

  function buildAtlas() {
    const chars = RAMP + PIX
    aw = Math.ceil(cw * dpr)
    ah = Math.ceil(ch * dpr)
    atlas = document.createElement('canvas')
    atlas.width = aw * chars.length
    atlas.height = ah * TINTS.length
    const g = atlas.getContext('2d')
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let t = 0; t < TINTS.length; t++) {
      const [r, gg, b] = TINTS[t]
      for (let i = 0; i < chars.length; i++) {
        const pix = i >= RAMP.length
        g.fillStyle = 'rgba(' + r + ',' + gg + ',' + b + ',' + (pix ? 0.95 : 0.55 + 0.45 * (i / (RAMP.length - 1))) + ')'
        if (pix) {
          // «пиксель» — квадрат чуть меньше клетки, чтобы сетка читалась
          const s = Math.round(aw * 0.78)
          const a = i === RAMP.length ? 0.6 : 1
          g.globalAlpha = a
          g.fillRect(i * aw + (aw - s) / 2, t * ah + (ah - s) / 2, s, s)
          g.globalAlpha = 1
        } else {
          g.font = Math.round(ch * 1.05 * dpr) + 'px ' + font
          g.fillText(chars[i], i * aw + aw / 2, t * ah + ah / 2)
        }
      }
    }
  }

  // маски акулы (тело, контур) и тени — в разрешении сетки, считаются один раз на размер
  function buildMasks() {
    const phone = FW < 810
    const len = phone ? Math.min(H * 0.6, FW * 1.25) : Math.min(H * 0.8, FW * 0.55)
    const cx = W / 2 + (phone ? 0 : FW * 0.02)
    const cy = H * (phone ? 0.56 : 0.53)
    const m = document.createElement('canvas')
    m.width = cols
    m.height = rows
    const g = m.getContext('2d', { willReadFrequently: true })
    const sx = 1 / cw, sy = 1 / ch
    g.fillStyle = '#fff'
    sharkPath(g, cx * sx, cy * sy, len, sx, sy)
    g.fill()
    const d = g.getImageData(0, 0, cols, rows).data
    body = new Float32Array(cols * rows)
    for (let i = 0; i < body.length; i++) body[i] = d[i * 4 + 3] / 255
    g.clearRect(0, 0, cols, rows)
    spinePath(g, cx * sx, cy * sy, len, sx, sy)
    g.fill()
    const sp = g.getImageData(0, 0, cols, rows).data
    spine = new Uint8Array(cols * rows)
    for (let i = 0; i < spine.length; i++) spine[i] = sp[i * 4 + 3] > 90 ? 1 : 0
    edge = new Uint8Array(cols * rows)
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c
      if (body[i] > 0.5 && (body[i - 1] < 0.5 || body[i + 1] < 0.5 || body[i - cols] < 0.5 || body[i + cols] < 0.5)) edge[i] = 1
    }
    // тень на дне: смещена от света и размыта (рисуем в маленький холст и растягиваем)
    const s = document.createElement('canvas')
    s.width = Math.max(1, cols >> 2)
    s.height = Math.max(1, rows >> 2)
    const gs = s.getContext('2d')
    gs.fillStyle = '#fff'
    sharkPath(gs, (cx + len * 0.06) * sx / 4, (cy + len * 0.09) * sy / 4, len, sx / 4, sy / 4)
    gs.fill()
    g.clearRect(0, 0, cols, rows)
    g.imageSmoothingEnabled = true
    g.drawImage(s, 0, 0, cols, rows)
    const e = g.getImageData(0, 0, cols, rows).data
    shade = new Float32Array(cols * rows)
    for (let i = 0; i < shade.length; i++) shade[i] = e[i * 4 + 3] / 255
  }

  function resize() {
    // canvas во всю ширину экрана, по центру фрейма; фрейм обрезает лишнее
    FW = Math.max(1, host.clientWidth)
    const w = Math.max(FW, document.documentElement.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(1.5, window.devicePixelRatio || 1)
    if (w === W && h === H && d === dpr && atlas) return
    W = w; H = h; dpr = d
    canvas.style.width = W + 'px'
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    scene.width = canvas.width
    scene.height = canvas.height
    b4.width = Math.max(1, canvas.width >> 2); b4.height = Math.max(1, canvas.height >> 2)
    b8.width = Math.max(1, canvas.width >> 3); b8.height = Math.max(1, canvas.height >> 3)
    const phone = FW < 810
    cw = phone ? 4 : FW < 1200 ? 5 : 6
    ch = Math.round(cw * 1.45)
    cols = Math.ceil(W / cw)
    rows = Math.ceil(H / ch)
    seeds = new Float32Array(cols * rows)
    for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i, 11)
    buildAtlas()
    buildMasks()
    draw(last)
  }

  let last = 0, hudKey = -1
  function updateHud(t) {
    if (!hud) return
    const k = Math.floor(t * 1.2)
    if (k === hudKey) return
    hudKey = k
    const depth = (18 + Math.sin(t * 0.3) * 0.6 + hash(k, 3) * 0.2).toFixed(1)
    hud.textContent = '679 — DEPTH ' + depth + ' M / ' + (21 + Math.floor(hash(k, 5) * 2)) + '°C'
  }

  function draw(t) {
    last = t
    if (!atlas || !body) return
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.clearRect(0, 0, scene.width, scene.height)
    const k = 7.5 / Math.max(cols, rows * 1.45) // масштаб узора: одинаковый на любом экране
    const tick = Math.floor(t * 10)
    const px = cw * dpr, py = ch * dpr
    for (let r = 0; r < rows; r++) {
      const y = r * k * 1.45 * 5
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const x = c * k * 5
        // каустика: три искажённые волны, яркость — там, где их сумма близка к нулю (светлые прожилки)
        const w1 = Math.sin(x * 1.3 + t * 0.9 + Math.sin(y * 0.9 - t * 0.7) * 1.6)
        const w2 = Math.sin(y * 1.2 - t * 0.8 + Math.sin(x * 0.8 + t * 0.5) * 1.8)
        const w3 = Math.sin((x - y) * 0.75 + t * 0.6 + Math.sin((x + y) * 0.5 - t * 0.4) * 1.2)
        let v = 1 - Math.abs(w1 + w2 + w3) / 1.15
        v = v > 0 ? v * v * v * v : 0
        // крупные мягкие волны света по всей толще
        const swell = 0.55 + 0.45 * Math.sin(x * 0.18 + y * 0.12 - t * 0.35)
        // свет сильнее к центру, края фрейма уходят в глубину
        const dx = (c - cols / 2) / (cols / 2), dy = (r - rows / 2) / (rows / 2)
        const vig = 1 - 0.45 * Math.min(1, dx * dx * 0.6 + dy * dy * 0.8)
        let I = (v * (0.45 + 0.65 * swell) + 0.07 * swell) * vig
        const sh = shade[i]
        if (sh) I *= 1 - 0.8 * sh
        const bd = body[i]
        let tint
        let g
        if (bd > 0.5) {
          // акула: тёмная спина, на неё слабо ложатся блики; контур — чёткий
          // акула: плотная матовая «спина» из символов, без бликов; контур — чёткий и светлее
          // акула: плотный светлый силуэт из символов, контур — светящиеся пиксели, по спине — тёмный хребет
          if (edge[i]) { g = RAMP.length; tint = 3 }
          else if (spine[i]) { g = 3; tint = 1 }
          else {
            const sv = seeds[i]
            g = sv < 0.5 ? 8 : sv < 0.85 ? 7 : 9
            tint = 2
          }
        } else {
          if (I < 0.1 && seeds[i] > I * 6) continue
          I = clamp(I, 0, 1)
          g = Math.max(1, Math.round(I * (RAMP.length - 1)))
          tint = I > 0.88 ? 3 : I > 0.55 ? 1 : 0
          // самые яркие блики — пиксели (они и светятся сильнее всего)
          if (I > 0.9) g = RAMP.length
          else if (I > 0.8 && seeds[i] > 0.6) g = RAMP.length
          else if (hash(i, tick) < 0.004) { g = RAMP.length; tint = 3 } // искры
        }
        sctx.drawImage(atlas, g * aw, tint * ah, aw, ah, Math.round(c * px), Math.round(r * py), aw, ah)
      }
    }
    // bloom
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(scene, 0, 0)
    g4.clearRect(0, 0, b4.width, b4.height)
    g4.drawImage(scene, 0, 0, b4.width, b4.height)
    g8.clearRect(0, 0, b8.width, b8.height)
    g8.drawImage(b4, 0, 0, b8.width, b8.height)
    ctx.globalCompositeOperation = 'lighter'
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = 0.5
    ctx.drawImage(b4, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.45
    ctx.drawImage(b8, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    updateHud(t)
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
    // слабое устройство — снижаем частоту кадров
    cost = cost * 0.9 + (performance.now() - s) * 0.1
    minDt = cost > 18 ? 1000 / 15 : cost > 11 ? 1000 / 20 : 1000 / 30
  }
  function update() {
    const should = visible && !document.hidden && !(reduce && reduce.matches)
    if (should && !running) {
      running = true
      t0 = 0
      lastFrame = 0
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ready.then(() => { font = getComputedStyle(document.body).fontFamily || font; if (atlas) { buildAtlas(); draw(last) } })

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  window.addEventListener('resize', resize)
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting
    update()
  })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)
  last = 2.5
  resize()
}
