// «Geometric / image + motion study» — анимированный портрет на canvas (вместо mp4).
//
// Оптимизированная версия. Что изменилось относительно компонента во Framer:
//  • тяжёлая штриховка силуэта (≈230 000 вычислений на кадр) и контур считаются ОДИН раз
//    в несколько готовых «кадров-вариантов» (растровые слои), а в анимации они просто
//    подставляются картинкой — это почти ничего не стоит процессору;
//  • крупные пиксели пересчитываются ~12 раз в секунду, а не на каждом кадре;
//  • 400 вертикальных штрихов рисуются пятью пачками вместо 400 отдельных вызовов;
//  • «звёздная пыль» — три готовых контура вместо ~1300 прямоугольников с разной прозрачностью;
//  • подписи и уголки (HUD) — обычный HTML, а не текст на canvas;
//  • 30 кадров в секунду вместо 60, плотность пикселей canvas ограничена 1.5;
//  • анимация полностью останавливается, когда портрет не виден на экране,
//    вкладка скрыта или включено «уменьшение движения» в системе.

const STAGE_W = 1920
const STAGE_H = 1080
const BASE_TOP = -102
const BASE_HEIGHT = 1181

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function hash(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function loadField(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      const W = img.naturalWidth
      const H = img.naturalHeight
      const c = makeCanvas(W, H)
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, W, H).data
      const L = new Float32Array(W * H)
      for (let i = 0; i < W * H; i++) {
        const v = d[i * 4]
        L[i] = v === 0 ? -1 : v / 255
      }
      resolve({ W, H, L })
    }
    img.onerror = reject
    img.src = src
  })
}

export const PORTRAIT_DEFAULTS = {
  bg: [44, 64, 199],
  line: [210, 218, 255],
  block: [214, 220, 255],
  fit: 'bottom',
  focusY: 0.5,
  narrowWidth: 1150,
  speed: 1.5,
  lineGap: 3,
  lineWidth: 1.3,
  blockSize: 16,
  hatch: 0.29,
  blocks: 0.81,
  sparkle: 0,
  streaks: 400,
  squares: 10,
  spikes: true,
  portraitScale: 0.9,
  portraitX: 0,
  portraitY: 66,
  fps: 30,
  maxDpr: 1.5,
  variants: 4,
}

export function createPortrait(host, field, baseOpts, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d', { alpha: false })

  let opts = { ...PORTRAIT_DEFAULTS, ...baseOpts }
  let pre = null // предрасчёт в координатах кадра 1920×1080
  let layers = null // растровые слои под текущий размер
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let view = { k: 1, ox: 0, oy: 0 }
  let links = 0

  /* ---------- предрасчёт (зависит только от настроек портрета) ---------- */
  function sampler() {
    const { W, H, L } = field
    const ph = BASE_HEIGHT * opts.portraitScale
    const pw = (ph * W) / H
    const px = STAGE_W / 2 - pw / 2 + opts.portraitX
    const py = BASE_TOP + BASE_HEIGHT / 2 - ph / 2 + opts.portraitY
    return (sx, sy) => {
      const mx = ((sx - px) / pw) * W
      const my = ((sy - py) / ph) * H
      if (mx < 0 || my < 0 || mx >= W || my >= H) return -1
      return L[(my | 0) * W + (mx | 0)]
    }
  }

  function precompute() {
    const S = sampler()
    const gap = opts.lineGap
    const stepX = 3
    const nx = Math.ceil(STAGE_W / stepX)
    const rows = []
    let x0 = STAGE_W
    let x1 = 0
    let y0 = STAGE_H
    for (let y = gap / 2, ri = 0; y < STAGE_H; y += gap, ri++) {
      const a = new Float32Array(nx)
      let any = false
      for (let i = 0; i < nx; i++) {
        const v = S(i * stepX + 1, y)
        a[i] = v
        if (v >= 0) {
          any = true
          if (i * stepX < x0) x0 = i * stepX
          if (i * stepX > x1) x1 = i * stepX
          if (y < y0) y0 = y
        }
      }
      rows.push(any ? a : null)
    }
    const cStep = 4
    const contour = new Float32Array(Math.ceil(STAGE_W / cStep))
    const cols = []
    let topY = STAGE_H
    for (let i = 0; i < contour.length; i++) {
      const x = i * cStep
      contour[i] = -1
      for (let y = 0; y < STAGE_H; y += 2) {
        if (S(x, y) >= 0) {
          contour[i] = y
          cols.push(i)
          if (y < topY) topY = y
          break
        }
      }
    }
    let hx = 0
    let hn = 0
    for (let i = 0; i < contour.length; i++) {
      if (contour[i] >= 0 && contour[i] < topY + 120) {
        hx += i * cStep
        hn++
      }
    }
    const head = { x: hn ? hx / hn : STAGE_W / 2, y: topY + 270 * opts.portraitScale, r: 300 * opts.portraitScale, top: topY }
    const B = opts.blockSize
    const gw = Math.ceil(STAGE_W / B)
    const gh = Math.ceil(STAGE_H / B)
    const cells = []
    for (let cy = 0; cy < gh; cy++) {
      for (let cx = 0; cx < gw; cx++) {
        let sum = 0
        let cov = 0
        for (let j = 0; j < 4; j++) {
          for (let k = 0; k < 4; k++) {
            const v = S(cx * B + ((k + 0.5) * B) / 4, cy * B + ((j + 0.5) * B) / 4)
            if (v >= 0) {
              sum += v
              cov++
            }
          }
        }
        if (cov >= 10) cells.push(cx, cy, sum / cov, hash(cx, cy, 99) * 5)
      }
    }
    // область силуэта (+ запас под глитч-сдвиги и контур)
    const box = {
      x: Math.max(0, x0 - 48),
      y: Math.max(0, Math.min(y0, topY) - 8),
      w: 0,
      h: 0,
    }
    box.w = Math.min(STAGE_W, x1 + 52) - box.x
    box.h = STAGE_H - box.y
    pre = { rows, nx, stepX, contour, cStep, cols, head, cells: new Float32Array(cells), box }
  }

  /* ---------- раскладка кадра под размер блока ---------- */
  function layout() {
    let k, ox, oy
    if (opts.fit === 'cover') {
      k = Math.max(cssW / STAGE_W, cssH / STAGE_H)
      ox = (cssW - STAGE_W * k) / 2
      oy = (cssH - STAGE_H * k) * opts.focusY
    } else {
      k = Math.min(cssW / STAGE_W, cssH / STAGE_H)
      if (cssW / cssH < 0.9) k = Math.min(cssW / opts.narrowWidth, cssH / STAGE_H)
      ox = (cssW - STAGE_W * k) / 2
      oy = cssH - STAGE_H * k
    }
    view = { k, ox, oy }
  }

  /* ---------- растровые слои: штриховка + контур (N вариантов) ---------- */
  function drawHatchVariant(g, tick) {
    const lw = opts.lineWidth
    const bright = new Path2D()
    const dim = new Path2D()
    for (let ri = 0; ri < pre.rows.length; ri++) {
      const row = pre.rows[ri]
      if (!row) continue
      const y = ri * opts.lineGap + opts.lineGap / 2 - lw / 2
      const gl = hash(ri >> 2, tick >> 1, 7)
      const shift = gl > 0.965 ? (hash(ri, tick, 8) - 0.5) * 70 : 0
      let start = -1
      let bsum = 0
      for (let i = 0; i <= pre.nx; i++) {
        const v = i < pre.nx ? row[i] : -1
        const thr = opts.hatch + (hash(i >> 3, ri, tick) - 0.5) * 0.22
        if (v >= 0 && v > thr) {
          if (start < 0) {
            start = i
            bsum = 0
          }
          bsum += v
        } else if (start >= 0) {
          const len = (i - start) * pre.stepX
          ;(bsum / (i - start) > 0.6 ? bright : dim).rect(start * pre.stepX + shift, y, len, lw)
          start = -1
        }
      }
    }
    g.fillStyle = rgba(opts.line, 0.42)
    g.fill(dim)
    g.fillStyle = rgba(opts.line, 0.9)
    g.fill(bright)
    // контур силуэта
    g.strokeStyle = rgba(opts.line, 0.85)
    g.lineWidth = 1.4
    g.beginPath()
    let pen = false
    for (let i = 0; i < pre.contour.length; i++) {
      const y = pre.contour[i]
      if (y < 0) {
        pen = false
        continue
      }
      const x = i * pre.cStep
      const j = (hash(i >> 2, tick >> 2, 9) - 0.5) * 2
      if (pen) g.lineTo(x, y + j)
      else g.moveTo(x, y + j)
      pen = true
    }
    g.stroke()
  }

  function buildLayers() {
    if (!pre) return
    const box = pre.box
    // разрешение слоёв: пикселей устройства на единицу кадра (с запасом под «дыхание»)
    const T = Math.min(dpr, 1.25) * view.k * 1.02
    const w = Math.ceil(box.w * T)
    const h = Math.ceil(box.h * T)
    const hatch = []
    const make = (v) => {
      const c = makeCanvas(w, h)
      const g = c.getContext('2d')
      g.setTransform(T, 0, 0, T, -box.x * T, -box.y * T)
      drawHatchVariant(g, v * 7 + 3)
      return c
    }
    hatch.push(make(0))
    layers = { T, box, hatch, size: w + 'x' + h }
    // остальные варианты — в свободное время, чтобы не тормозить загрузку
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 30))
    const my = layers
    let v = 1
    const next = () => {
      if (layers !== my || v >= opts.variants) return
      my.hatch.push(make(v++))
      idle(next)
    }
    idle(next)
    // «звёздная пыль»: три группы мерцают по-разному
    const r = rng(679)
    const dn = Math.min(1600, Math.round((cssW * cssH) / 1300))
    const groups = [new Path2D(), new Path2D(), new Path2D()]
    for (let i = 0; i < dn; i++) {
      const x = r() * cssW
      const y = r() * cssH
      const s = r() < 0.85 ? 1 : 1.6
      r() // базовая яркость — общая на группу
      const ph = r()
      r()
      groups[(ph * 3) | 0].rect(x, y, s, s)
    }
    layers.dust = groups
    blocksCache.key = -1
  }

  /* ---------- крупные пиксели: пересчёт ~12 раз в секунду ---------- */
  const blocksCache = { key: -1, path: null, tex: null }
  let texturePattern = null
  function blocksPath(t) {
    const key = Math.floor(t * 12)
    if (key === blocksCache.key) return blocksCache
    blocksCache.key = key
    const B = opts.blockSize
    const path = new Path2D()
    const c = pre.cells
    const sp = 2.2 * opts.speed
    for (let i = 0; i < c.length; i += 4) {
      const cx = c[i]
      const cy = c[i + 1]
      const a = c[i + 2]
      const slow = Math.floor(t * sp + c[i + 3])
      const n = hash(cx, cy, slow)
      const on = a > opts.blocks + (n - 0.5) * 0.18 || (a > 0.3 && hash(cx, slow, cy + 31) < opts.sparkle)
      if (on) path.rect(cx * B, cy * B, B + 0.5, B + 0.5)
    }
    blocksCache.path = path
    return blocksCache
  }
  function getTexture() {
    if (texturePattern) return texturePattern
    const g = opts.lineGap
    const c = makeCanvas(4, g)
    const x = c.getContext('2d')
    x.fillStyle = 'rgba(40,50,110,0.13)'
    x.fillRect(0, 2 % g, 4, 1)
    texturePattern = ctx.createPattern(c, 'repeat')
    return texturePattern
  }

  /* ---------- кадр ---------- */
  const streakPaths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()]
  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = rgba(opts.bg, 1)
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!pre || !layers) return

    // пыль
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = rgba(opts.line, 1)
    for (let gI = 0; gI < 3; gI++) {
      ctx.globalAlpha = 0.33 * (0.55 + 0.45 * Math.sin(t * (0.9 + gI * 0.8) + gI * 2.1))
      ctx.fill(layers.dust[gI])
    }
    ctx.globalAlpha = 1

    // кадр + лёгкое «дыхание» портрета
    const { k, ox, oy } = view
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy)
    ctx.save()
    ctx.translate(STAGE_W / 2, STAGE_H)
    const sc = 1 + 0.008 * Math.sin(t * 0.7)
    ctx.scale(sc, sc)
    ctx.rotate(0.004 * Math.sin(t * 0.5))
    ctx.translate(-STAGE_W / 2, -STAGE_H + 5 * Math.sin(t * 1.1))

    // вертикальные штрихи от контура — пятью пачками по прозрачности
    if (opts.streaks > 0 && pre.cols.length) {
      for (let i = 0; i < 5; i++) streakPaths[i] = new Path2D()
      const tt = t * 0.9
      for (let s = 0; s < opts.streaks; s++) {
        const h3 = hash(s, 0, 3) * 7
        const ep = Math.floor(tt + h3)
        const life = (tt + h3) % 1
        const a = (0.1 + 0.4 * hash(s, ep, 4)) * Math.sin(life * Math.PI)
        if (a < 0.04) continue
        const ci = pre.cols[Math.floor(hash(s, ep, 1) * pre.cols.length)]
        const x = ci * pre.cStep + 0.5
        const y0 = pre.contour[ci]
        const len = 30 + Math.pow(hash(s, ep, 2), 2) * 440
        const p = streakPaths[Math.min(4, (a / 0.1) | 0)]
        p.moveTo(x, y0 + 2)
        p.lineTo(x, y0 - len)
      }
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = rgba(opts.line, (0.05 + i * 0.1).toFixed(2))
        ctx.stroke(streakPaths[i])
      }
    }

    // штриховка + контур — готовый слой
    const tick = Math.floor(t * 10 * opts.speed)
    const hv = layers.hatch
    const img = hv[Math.floor(hash(tick, 1, 1) * hv.length)]
    const b = layers.box
    ctx.imageSmoothingQuality = 'low'
    ctx.drawImage(img, b.x, b.y, b.w, b.h)

    // крупные пиксели
    const bc = blocksPath(t)
    ctx.fillStyle = rgba(opts.block, 1)
    ctx.fill(bc.path)
    ctx.fillStyle = getTexture()
    ctx.fill(bc.path)

    // рамки вокруг головы и связи между ними
    links = 0
    if (opts.squares > 0) {
      const H = pre.head
      const centers = []
      ctx.lineWidth = 1.1
      for (let s = 0; s < opts.squares; s++) {
        const per = 3.5 + hash(s, 1, 1) * 3
        const tt = t * opts.speed + hash(s, 2, 2) * per
        const cyc = Math.floor(tt / per)
        const u = (tt / per) % 1
        const ang = hash(s, cyc, 3) * Math.PI * 2
        const rad = Math.sqrt(hash(s, cyc, 4)) * H.r
        const x = H.x + Math.cos(ang) * rad * 1.05 + Math.sin(t * 0.7 + s) * 18
        const y = H.y + Math.sin(ang) * rad * 0.95 + Math.cos(t * 0.6 + s) * 14
        const size = (70 + hash(s, cyc, 5) * 110) * opts.portraitScale
        const rot = (hash(s, cyc, 6) - 0.5) * 1.2 + t * (hash(s, cyc, 7) - 0.5) * 0.5
        const a = Math.pow(Math.sin(u * Math.PI), 0.6) * 0.75
        if (a < 0.03) continue
        centers.push(x, y, a)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rot)
        ctx.strokeStyle = rgba(opts.line, a.toFixed(2))
        const h = size / 2
        ctx.beginPath()
        ctx.rect(-h, -h * 0.82, size, size * 0.82)
        const kind = hash(s, cyc, 8)
        if (kind < 0.45) {
          ctx.moveTo(-h, 0)
          ctx.lineTo(h, 0)
          ctx.moveTo(0, -h * 0.82)
          ctx.lineTo(0, h * 0.82)
        } else if (kind < 0.8) {
          ctx.moveTo(-h, -h * 0.27)
          ctx.lineTo(h, -h * 0.27)
          ctx.moveTo(-h, h * 0.27)
          ctx.lineTo(h, h * 0.27)
        } else {
          ctx.moveTo(-h * 0.2, -h * 0.82)
          ctx.lineTo(-h * 0.2, h * 0.82)
        }
        ctx.stroke()
        ctx.restore()
      }
      const lt = Math.floor(t * 1.3)
      for (let i = 0; i < centers.length; i += 3) {
        for (let j = i + 3; j < centers.length; j += 3) {
          const dx = centers[i] - centers[j]
          const dy = centers[i + 1] - centers[j + 1]
          if (dx * dx + dy * dy < 48400 && hash(i / 3, j / 3, lt) < 0.5) {
            ctx.strokeStyle = rgba(opts.line, (Math.min(centers[i + 2], centers[j + 2]) * 0.6).toFixed(2))
            ctx.beginPath()
            ctx.moveTo(centers[i], centers[i + 1])
            ctx.lineTo(centers[j], centers[j + 1])
            ctx.stroke()
            links++
          }
        }
      }
    }

    // всплески над кепкой
    if (opts.spikes && hash(Math.floor(t * 1.2), 5, 5) > 0.3) {
      const H = pre.head
      const wt = Math.floor(t * 9)
      const base = H.top + 165 * opts.portraitScale
      const w = 260 * opts.portraitScale
      ctx.strokeStyle = rgba(opts.line, 0.8)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const x = H.x - w / 2 + (i / 24) * w
        const sp = Math.pow(hash(i, wt, 11), 4) * 120 * opts.portraitScale
        const y = base - sp - hash(i, wt, 12) * 8
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  /* ---------- HUD (DOM): счётчик узлов обновляется ~1.6 раза в секунду ---------- */
  let hudKey = -1
  function updateHud(t) {
    if (!hud) return
    const key = Math.floor(t * 1.6)
    if (key === hudKey) return
    hudKey = key
    const nodes = 170 + Math.floor(hash(key, 1, 1) * 8)
    const lk = 26 + links + Math.floor(hash(key, 2, 2) * 12)
    hud.textContent = '679 — ' + nodes + ' NODES / ' + lk + ' LINKS'
  }

  /* ---------- размер / видимость / цикл ---------- */
  let layerTimer = 0
  function resize() {
    // размеры без учёта CSS-трансформаций (интро/параллакс не должны пересоздавать canvas)
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(opts.maxDpr, window.devicePixelRatio || 1)
    if (w === cssW && h === cssH && d === dpr && layers) return
    cssW = w
    cssH = h
    dpr = d
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    layout()
    // слои пересобираем после того, как размер «устоится»
    clearTimeout(layerTimer)
    if (!layers) buildLayers()
    else layerTimer = setTimeout(() => {
      buildLayers()
      draw(last || 1.2)
    }, 150)
    draw(last || 1.2)
  }

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')
  let running = false
  let visible = false
  let raf = 0
  let t0 = 0
  let tPaused = 1.2
  let last = 0
  let lastFrame = 0
  let minDt = 1000 / opts.fps
  let slow = 0

  function draw(t) {
    last = t
    render(t)
    updateHud(t)
  }

  function frame(now) {
    raf = 0
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (now - lastFrame < minDt - 2) return
    lastFrame = now
    if (!t0) t0 = now - tPaused * 1000
    const t = (now - t0) / 1000
    tPaused = t
    const s = performance.now()
    draw(t)
    // если кадр дорогой (слабый компьютер) — снижаем частоту до 20 кадров/с
    const cost = performance.now() - s
    slow = slow * 0.9 + cost * 0.1
    minDt = slow > 9 ? 1000 / 20 : 1000 / opts.fps
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

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting
    update()
  })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)

  precompute()
  resize()

  return {
    setOptions(o) {
      const prev = opts
      opts = { ...PORTRAIT_DEFAULTS, ...o }
      minDt = 1000 / opts.fps
      const geo = ['lineGap', 'blockSize', 'portraitScale', 'portraitX', 'portraitY'].some((k) => prev[k] !== opts[k])
      if (geo) {
        texturePattern = null
        precompute()
      }
      layout()
      buildLayers()
      draw(last || 1.2)
    },
    destroy() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
      canvas.remove()
    },
  }
}

/* ---------- монтирование на странице: настройки по брейкпоинтам как во Framer ---------- */
const BREAKPOINT_OPTS = [
  { mq: '(max-width: 809.98px)', o: { narrowWidth: 850, portraitScale: 1, portraitY: 4 } },
  { mq: '(min-width: 810px) and (max-width: 1199.98px)', o: { fit: 'cover', narrowWidth: 1010, portraitScale: 0.77, portraitY: 132 } },
  { mq: '(min-width: 1200px) and (max-width: 1919.98px)', o: { fit: 'cover' } },
  { mq: '(min-width: 1920px)', o: {} },
]

export async function mountPortrait(host, mapUrl, hud) {
  const optsFor = () => {
    for (const b of BREAKPOINT_OPTS) if (window.matchMedia(b.mq).matches) return b.o
    return {}
  }
  let field
  try {
    field = await loadField(mapUrl)
  } catch (e) {
    return null
  }
  const p = createPortrait(host, field, optsFor(), hud)
  for (const b of BREAKPOINT_OPTS) {
    const m = window.matchMedia(b.mq)
    const on = () => m.matches && p.setOptions(optsFor())
    if (m.addEventListener) m.addEventListener('change', on)
  }
  return p
}
