// Первый экран: вид сверху (flat lay) в тёмную воду. По центру — японский карп кои из пиксельной мозаики:
// светлые плитки с символами (S X 8 0 G…) — белыми, красно-оранжевыми (узор кохаку) и голубыми,
// с сильным холодным свечением (bloom) у головы, как в референсе.
// Фон — глубокий тёмно-синий с мягким пятном света; по всей воде — мелкие тусклые символы,
// которые мерцают под бликами каустики, и те же блики скользят по карпу. Сам карп неподвижен.
//
// Как устроено:
//  • силуэт карпа (контур) рисуется один раз в маску размером с сетку плиток;
//  • в кадре: фон-градиент → тусклые символы воды → тень → плитки карпа → bloom (уменьшенные копии
//    слоя карпа поверх в режиме «осветление») + холодный ореол у головы → виньетка;
//  • canvas во всю ширину экрана: когда фрейм при прокрутке раздвигается, вода есть и по краям;
//  • анимация стоит, когда блок не виден, вкладка скрыта или включено «уменьшение движения».

const GLYPHS = 'SX80G8SX08S8X0G!<>$%'
const WATER = '.·:+*'
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

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
function koiOutline() {
  const right = []
  for (const [y, w] of BODY) {
    right.push([w, y])
    // грудной плавник: округлый веер
    if (y === -0.32) right.push([0.15, -0.3], [0.2, -0.265], [0.215, -0.22], [0.19, -0.19], [0.14, -0.195], [0.112, -0.21])
    // брюшной плавник
    if (y === -0.02) right.push([0.13, 0.0], [0.155, 0.04], [0.13, 0.065], [0.085, 0.055])
  }
  // хвост: широкий мягкий веер с волнистым краем
  const tail = [[0.06, 0.29], [0.13, 0.36], [0.175, 0.43], [0.165, 0.485], [0.12, 0.47], [0.07, 0.45], [0.03, 0.43], [0, 0.415],
    [-0.03, 0.43], [-0.07, 0.45], [-0.12, 0.47], [-0.165, 0.485], [-0.175, 0.43], [-0.13, 0.36], [-0.06, 0.29]]
  const left = right.slice().reverse().map(([x, y]) => [-x, y])
  return right.concat(tail, left)
}
const KOI = koiOutline()

// поза: плавный S-изгиб тела, голова — вверху слева, хвост — внизу справа
const ANGLE = (-34 * Math.PI) / 180
function pose(x, y) {
  const bx = x + 0.07 * Math.sin((y + 0.5) * Math.PI * 1.15) - 0.03
  return [bx * Math.cos(ANGLE) - y * Math.sin(ANGLE), bx * Math.sin(ANGLE) + y * Math.cos(ANGLE)]
}
function koiPath(g, cx, cy, len, k) {
  const pts = KOI.map(([x, y]) => { const [px, py] = pose(x, y); return [cx + px * len * k, cy + py * len * k] })
  const n = pts.length
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]
  g.beginPath()
  let m = mid(n - 1)
  g.moveTo(m[0], m[1])
  for (let i = 0; i < n; i++) { m = mid(i); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]) }
  g.closePath()
}

export function mountWater(host, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'water'
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d', { alpha: false })
  const glow = document.createElement('canvas') // слой карпа — из него делается свечение
  const gctx = glow.getContext('2d')
  const b4 = document.createElement('canvas'), b8 = document.createElement('canvas'), b16 = document.createElement('canvas')
  const g4 = b4.getContext('2d'), g8 = b8.getContext('2d'), g16 = b16.getContext('2d')

  let W = 1, H = 1, FW = 1, dpr = 1
  let tile = 14, tcols = 0, trows = 0, cells = [], head = [0, 0], len = 1
  let wc = 12, wcols = 0, wrows = 0, wseed = null
  let font = getComputedStyle(document.body).fontFamily || 'monospace'

  // плитки карпа: позиция, яркость, окрас, символ — считаются один раз на размер
  function buildKoi() {
    const phone = FW < 810
    len = phone ? Math.min(H * 0.64, FW * 1.2) : Math.min(H * 0.8, FW * 0.5)
    const cx = W / 2, cy = H * (phone ? 0.55 : 0.52)
    tcols = Math.ceil(W / tile)
    trows = Math.ceil(H / tile)
    const m = document.createElement('canvas')
    m.width = tcols
    m.height = trows
    const g = m.getContext('2d', { willReadFrequently: true })
    g.fillStyle = '#fff'
    koiPath(g, cx / tile, cy / tile, len, 1 / tile)
    g.fill()
    const d = g.getImageData(0, 0, tcols, trows).data
    const [hx, hy] = pose(0, -0.4)
    head = [cx + hx * len, cy + hy * len]
    const [tx, ty] = pose(0, 0.35)
    const tail = [cx + tx * len, cy + ty * len]
    const axis = Math.hypot(tail[0] - head[0], tail[1] - head[1])
    cells = []
    for (let r = 0; r < trows; r++) for (let c = 0; c < tcols; c++) {
      const a = d[(r * tcols + c) * 4 + 3] / 255
      if (a < 0.3) continue
      const x = (c + 0.5) * tile, y = (r + 0.5) * tile
      const i = r * tcols + c
      // «головность»: 0 у головы, 1 у хвоста — голова светлее и сильнее светится
      const along = clamp(((x - head[0]) * (tail[0] - head[0]) + (y - head[1]) * (tail[1] - head[1])) / (axis * axis), 0, 1)
      // окрас кохаку: красные пятна по шуму + «шапочка» на голове
      const red = vnoise(c * 0.22, r * 0.22, 3) > 0.56 || (along < 0.13 && along > 0.04 && vnoise(c * 0.5, r * 0.5, 9) > 0.35)
      const edge = a < 0.85
      cells.push({ x: c * tile, y: r * tile, i, along, red, edge, s: hash(i, 21), a })
    }
  }

  function resize() {
    FW = Math.max(1, host.clientWidth)
    const w = Math.max(FW, document.documentElement.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(1.5, window.devicePixelRatio || 1)
    if (w === W && h === H && d === dpr && cells.length) return
    W = w; H = h; dpr = d
    canvas.style.width = W + 'px'
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    glow.width = canvas.width
    glow.height = canvas.height
    b4.width = Math.max(1, canvas.width >> 2); b4.height = Math.max(1, canvas.height >> 2)
    b8.width = Math.max(1, canvas.width >> 3); b8.height = Math.max(1, canvas.height >> 3)
    b16.width = Math.max(1, canvas.width >> 4); b16.height = Math.max(1, canvas.height >> 4)
    const phone = FW < 810
    tile = phone ? 9 : FW < 1200 ? 11 : 12
    wc = phone ? 10 : 12
    wcols = Math.ceil(W / wc)
    wrows = Math.ceil(H / wc)
    wseed = new Float32Array(wcols * wrows)
    for (let i = 0; i < wseed.length; i++) wseed[i] = hash(i, 5)
    buildWater()
    buildKoi()
    draw(last)
  }

  // атлас символов воды: WL уровней яркости
  const WL = 8
  let watlas = document.createElement('canvas')
  function buildWater() {
    const a = Math.ceil(wc * dpr)
    watlas = document.createElement('canvas')
    watlas.width = a * WL
    watlas.height = a
    const g = watlas.getContext('2d')
    g.font = Math.round(wc * 0.8 * dpr) + 'px ' + font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let l = 0; l < WL; l++) {
      const lvl = (l + 0.5) / WL
      g.fillStyle = 'rgba(' + Math.round(60 + 90 * lvl) + ',' + Math.round(150 + 80 * lvl) + ',' + Math.round(170 + 70 * lvl) + ',' + (0.08 + lvl * 0.35).toFixed(3) + ')'
      g.fillText(WATER[Math.min(WATER.length - 1, Math.floor(lvl * WATER.length))], l * a + a / 2, a / 2)
    }
  }

  // каустика: светлые прожилки из трёх искажённых волн (0…1)
  function caustic(x, y, t) {
    const w1 = Math.sin(x * 1.3 + t * 0.9 + Math.sin(y * 0.9 - t * 0.7) * 1.6)
    const w2 = Math.sin(y * 1.2 - t * 0.8 + Math.sin(x * 0.8 + t * 0.5) * 1.8)
    const w3 = Math.sin((x - y) * 0.75 + t * 0.6 + Math.sin((x + y) * 0.5 - t * 0.4) * 1.2)
    const v = 1 - Math.abs(w1 + w2 + w3) / 1.2
    return v > 0 ? v * v * v : 0
  }

  let last = 0, hudKey = -1
  function updateHud(t) {
    if (!hud) return
    const k = Math.floor(t * 1.2)
    if (k === hudKey) return
    hudKey = k
    hud.textContent = '679 — KOI / DEPTH ' + (1.8 + Math.sin(t * 0.3) * 0.1 + hash(k, 3) * 0.05).toFixed(2) + ' M'
  }

  function draw(t) {
    last = t
    if (!cells.length) return
    const sc = dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    // фон: глубокий синий, светлое пятно ближе к голове карпа
    const bg = ctx.createRadialGradient(head[0] * sc, head[1] * sc, 0, head[0] * sc, head[1] * sc, Math.max(W, H) * 0.9 * sc)
    bg.addColorStop(0, '#103a66')
    bg.addColorStop(0.45, '#0a2448')
    bg.addColorStop(1, '#040b1d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // вода: мелкие тусклые символы, ярче под бликами каустики (символы — из готового атласа)
    const k = 6 / Math.max(wcols, wrows)
    const aw = watlas.width / WL
    const ah = watlas.height
    for (let r = 0; r < wrows; r++) {
      for (let c = 0; c < wcols; c++) {
        const i = r * wcols + c
        const v = caustic(c * k * 5, r * k * 5, t)
        const s = wseed[i]
        if (v < 0.12 && s > 0.35) continue
        const lvl = Math.min(WL - 1, Math.floor(clamp(v * 1.2 + s * 0.15, 0, 1) * WL))
        ctx.drawImage(watlas, lvl * aw, 0, aw, ah, Math.round(c * wc * sc), Math.round(r * wc * sc), aw, ah)
      }
    }

    // карп: плитки с символами (рисуем на отдельный слой — он же источник свечения)
    gctx.setTransform(1, 0, 0, 1, 0, 0)
    gctx.clearRect(0, 0, glow.width, glow.height)
    gctx.font = '500 ' + Math.round(tile * 0.82 * sc) + 'px ' + font
    gctx.textAlign = 'center'
    gctx.textBaseline = 'middle'
    const tick = Math.floor(t * 8)
    const ts = tile * sc
    const gap = Math.max(1, Math.round(sc))
    const kw = 6 / Math.max(tcols, trows)
    for (const cl of cells) {
      // блики воды скользят по спине карпа
      const lightUp = caustic((cl.x / tile) * kw * 5, (cl.y / tile) * kw * 5, t)
      const head01 = 1 - cl.along
      let L = 0.55 + 0.25 * head01 * head01 + 0.14 * lightUp + (cl.s - 0.5) * 0.22
      if (cl.edge) L *= 0.82
      L = clamp(L, 0.4, 0.9)
      const tileA = cl.edge ? 0.6 : 0.7 + 0.25 * L
      let fr, fg, fb
      if (cl.red && cl.s > 0.25) { fr = 236; fg = 205 - 25 * (1 - L); fb = 198 - 30 * (1 - L) }
      else { fr = 214 + 30 * L; fg = 222 + 26 * L; fb = 232 + 20 * L }
      gctx.fillStyle = 'rgba(' + Math.round(fr * L) + ',' + Math.round(fg * L) + ',' + Math.round(fb * L) + ',' + tileA + ')'
      const x = Math.round(cl.x * sc), y = Math.round(cl.y * sc)
      gctx.fillRect(x, y, ts - gap, ts - gap)
      // символ: красный/оранжевый на пятнах окраса, иначе белый, серо-голубой или синий
      if (cl.s > 0.12) {
        const flick = hash(cl.i, tick) < 0.035
        const ch = GLYPHS[Math.floor((flick ? hash(cl.i, tick + 7) : cl.s) * GLYPHS.length) % GLYPHS.length]
        let col
        const q = hash(cl.i, 77)
        // на светлых плитках символы темнее, на тёмных — белые, чтобы читались всегда
        if (cl.red) col = q < 0.55 ? '#d8402a' : q < 0.85 ? '#ec7444' : (L > 0.7 ? '#5b6680' : '#ffffff')
        else col = q < 0.5 ? (L > 0.7 ? '#58637c' : '#c9d3e6') : q < 0.72 ? (L > 0.75 ? '#8a96b0' : '#ffffff') : q < 0.9 ? '#3f8cf0' : '#d8402a'
        gctx.fillStyle = col
        gctx.fillText(ch, x + (ts - gap) / 2, y + (ts - gap) / 2 + sc)
      }
    }
    // мягкая тень карпа на дне (смещённая, тёмная и размытая)
    g16.clearRect(0, 0, b16.width, b16.height)
    g16.drawImage(glow, 0, 0, b16.width, b16.height)
    ctx.imageSmoothingEnabled = true
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 0.45
    ctx.drawImage(b16, W * 0.03 * sc, H * 0.06 * sc, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.drawImage(glow, 0, 0)

    // bloom: уменьшенные копии слоя карпа поверх, «осветлением»; ореол у головы — холодный бирюзовый
    g4.clearRect(0, 0, b4.width, b4.height)
    g4.drawImage(glow, 0, 0, b4.width, b4.height)
    g8.clearRect(0, 0, b8.width, b8.height)
    g8.drawImage(b4, 0, 0, b8.width, b8.height)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.22
    ctx.drawImage(b4, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.34
    ctx.drawImage(b8, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 0.34
    ctx.drawImage(b16, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1
    const pulse = 0.9 + 0.1 * Math.sin(t * 1.3)
    const hr = len * 0.22 * sc
    const hg = ctx.createRadialGradient(head[0] * sc, head[1] * sc, 0, head[0] * sc, head[1] * sc, hr)
    hg.addColorStop(0, 'rgba(150,240,255,' + (0.26 * pulse).toFixed(3) + ')')
    hg.addColorStop(0.4, 'rgba(90,200,240,' + (0.12 * pulse).toFixed(3) + ')')
    hg.addColorStop(1, 'rgba(40,120,200,0)')
    ctx.fillStyle = hg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // виньетка: края и низ уходят в темноту
    ctx.globalCompositeOperation = 'source-over'
    const vg = ctx.createRadialGradient(W * 0.45 * sc, H * 0.42 * sc, Math.min(W, H) * 0.3 * sc, W * 0.5 * sc, H * 0.5 * sc, Math.max(W, H) * 0.75 * sc)
    vg.addColorStop(0, 'rgba(2,6,16,0)')
    vg.addColorStop(1, 'rgba(2,6,16,0.6)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
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
  ready.then(() => { font = getComputedStyle(document.body).fontFamily || font; if (wcols) buildWater(); draw(last) })
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  window.addEventListener('resize', resize)
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; update() })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)
  last = 2.5
  resize()
}
