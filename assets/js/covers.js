// Первый экран: обложки кейсов, нарисованные ASCII-символами поверх синего фона.
//
// Сцена с одной обложкой длится 5 секунд (камера медленно наезжает), затем за ~1.6 с «перетекает»
// в следующую: символы волной сменяются через пиксельные (█▓▒░), строки изгибаются, как жидкость,
// а яркость плавно переходит от старой обложки к новой.
//
// Обложки берутся те же, что в карточках «мои работы»: сначала assets/cases/<кейс>/01.*,
// если файла нет — картинка с Framer (сервер разрешает чтение пикселей, CORS).
// Синий фон — это фон блока, canvas прозрачный.

const RAMP = ' .,:-=+*#%@'
const PIX = '░▒▓█'
const COLOR = [214, 222, 255]
const FPS = 30
const HOLD = 5
const MORPH = 1.6

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (t) => t * t * (3 - 2 * t)

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// пробуем адреса по очереди; внешние — с crossOrigin, чтобы можно было читать пиксели
function loadFirst(list) {
  return new Promise((resolve) => {
    let k = 0
    const next = () => {
      if (k >= list.length) return resolve(null)
      const src = list[k++]
      const img = new Image()
      img.decoding = 'async'
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = next
      img.src = src
    }
    next()
  })
}

// уровни яркости обложки (3-й и 97-й перцентили) — чтобы любая картинка давала полный диапазон символов
function levels(img) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 48
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, 64, 48)
  let d
  try { d = g.getImageData(0, 0, 64, 48).data } catch (e) { return null }
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++
  const n = 64 * 48
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.03) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.03) { hi = v; break } }
  return { lo, span: Math.max(40, hi - lo) }
}

// область обложки: по центру блока, 4:3
function place(w, h) {
  const phone = w < 810
  const tablet = !phone && w < 1200
  const ww = phone ? w * 0.94 : tablet ? Math.min(w * 0.6, h * 0.56 * 4 / 3) : Math.min(w * 0.44, h * 0.62 * 4 / 3)
  const hh = (ww * 3) / 4
  const cy = phone ? h * 0.53 : h * 0.47
  return { w: ww, h: hh, x: (w - ww) / 2, y: cy - hh / 2, cell: phone ? 4.5 : tablet ? 5.5 : clamp(Math.round(ww / 150), 6, 8) }
}

export function mountCovers(host, covers, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const sa = document.createElement('canvas')
  const sb = document.createElement('canvas')
  const ga = sa.getContext('2d', { willReadFrequently: true })
  const gb = sb.getContext('2d', { willReadFrequently: true })

  const scenes = [] // загруженные обложки по порядку карточек
  const slots = covers.map(() => null)
  let W = 1, H = 1, dpr = 1, geo = null, cols = 0, rows = 0, atlas = null, aw = 0, seeds = null
  let font = getComputedStyle(document.body).fontFamily || 'monospace'

  function buildAtlas() {
    const c = geo.cell
    const chars = RAMP + PIX
    aw = Math.ceil(c * dpr)
    atlas = document.createElement('canvas')
    atlas.width = aw * chars.length
    atlas.height = Math.ceil(c * 1.6 * dpr)
    const g = atlas.getContext('2d')
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 0; i < chars.length; i++) {
      const pix = i >= RAMP.length
      const a = pix ? 0.85 : 0.42 + 0.58 * (i / (RAMP.length - 1))
      g.fillStyle = 'rgba(' + COLOR[0] + ',' + COLOR[1] + ',' + COLOR[2] + ',' + a + ')'
      g.font = Math.round((pix ? 1.25 : 1.45) * c * dpr) + 'px ' + font
      g.fillText(chars[i], i * aw + aw / 2, atlas.height / 2)
    }
  }

  function resize() {
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(2, window.devicePixelRatio || 1)
    if (w === W && h === H && d === dpr && atlas) return
    W = w; H = h; dpr = d
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    geo = place(W, H)
    cols = Math.max(30, Math.floor(geo.w / geo.cell))
    rows = Math.max(20, Math.floor(geo.h / (geo.cell * 1.6)))
    sa.width = sb.width = cols
    sa.height = sb.height = rows
    seeds = new Float32Array(cols * rows)
    for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i, 7)
    buildAtlas()
    draw(last)
  }

  // кадр обложки в сетку символов: «камера» медленно наезжает (z от 1 до 1.08) и чуть смещается
  function sample(g, sc, z, drift) {
    const img = sc.img
    const iw = img.naturalWidth, ih = img.naturalHeight
    const ar = cols / (rows * 1.6)
    let sw = iw, sh = iw / ar
    if (sh > ih) { sh = ih; sw = ih * ar }
    sw /= z; sh /= z
    const sx = (iw - sw) / 2 + drift * (iw - sw) * 0.5
    const sy = (ih - sh) / 2
    g.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows)
    return g.getImageData(0, 0, cols, rows).data
  }

  let last = 0
  let hudKey = ''
  function setHud(i) {
    if (!hud) return
    const k = String(i)
    if (k === hudKey) return
    hudKey = k
    const sc = scenes[i]
    hud.textContent = String(sc.n).padStart(2, '0') + ' / ' + String(covers.length).padStart(2, '0') + ' — ' + sc.name
  }

  function draw(t) {
    last = t
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!geo || !atlas || !scenes.length) return
    const cycle = HOLD + MORPH
    const n = scenes.length
    const pos = t / cycle
    const idx = Math.floor(pos) % n
    const local = (pos - Math.floor(pos)) * cycle // 0…cycle
    const A = scenes[idx]
    const B = scenes[(idx + 1) % n]
    const morph = n > 1 && local > HOLD ? (local - HOLD) / MORPH : 0
    setHud(morph > 0.5 ? (idx + 1) % n : idx)

    const za = 1 + 0.08 * (local / cycle)
    const pa = sample(ga, A, za, Math.sin(idx * 2.1) * 0.25 * (local / cycle))
    const pb = morph > 0 ? sample(gb, B, 1, 0) : null

    const cw = geo.cell * dpr
    const ch = geo.cell * 1.6 * dpr
    const ah = atlas.height
    const ox = Math.round(geo.x * dpr + (geo.w * dpr - cols * cw) / 2)
    const oy = Math.round(geo.y * dpr + (geo.h * dpr - rows * ch) / 2)
    const steps = RAMP.length - 1
    const tick = Math.floor(t * 12)
    const intro = reduce && reduce.matches ? 1 : clamp(t / 1.4, 0, 1) // при появлении обложка собирается из символов
    const band = local > 2 && local < 4 ? ((local - 2) / 2) * (rows + 20) - 10 : -99 // полоса посреди сцены
    const wave = Math.sin(morph * Math.PI) // сила изгиба строк при перетекании
    const front = morph * 1.5

    for (let r = 0; r < rows; r++) {
      // «жидкость»: строки сдвигаются синусоидой, пока идёт перетекание
      const shift = wave ? Math.round(Math.sin(r * 0.22 + t * 6) * wave * 4) : 0
      const db = Math.abs(r - band)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const s = seeds[i]
        if (s > intro * 1.05) continue
        const sc = clamp(c - shift, 0, cols - 1)
        const j = (r * cols + sc) * 4
        let la = (pa[j] * 77 + pa[j + 1] * 150 + pa[j + 2] * 29) >> 8
        la = clamp((la - A.lv.lo) / A.lv.span, 0, 1)
        let v = la
        let lp = 0
        if (pb) {
          // волна идёт по диагонали с «рваным» краем
          const th = (c / cols) * 0.6 + (r / rows) * 0.25 + s * 0.35
          lp = smooth(clamp((front - th) / 0.35, 0, 1))
          let lb = (pb[j] * 77 + pb[j + 1] * 150 + pb[j + 2] * 29) >> 8
          lb = clamp((lb - B.lv.lo) / B.lv.span, 0, 1)
          v = la + (lb - la) * lp
        }
        v = v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v) // S-кривая: контрастнее силуэты
        if (v < 0.07) continue
        let g = Math.round(v * steps)
        if (g < 1) continue
        if (lp > 0.12 && lp < 0.88 && hash(i, tick) < 0.7) g = RAMP.length + Math.floor(hash(i, tick + 3) * PIX.length)
        else if (db < 2 && hash(i, tick) < 0.35) g = RAMP.length + Math.floor(hash(i, tick + 1) * PIX.length)
        else if (hash(i, tick) < 0.006) g = RAMP.length + Math.floor(s * PIX.length)
        else if (intro < 1 && s > intro - 0.12) g = RAMP.length + Math.floor(s * PIX.length)
        ctx.drawImage(atlas, g * aw, 0, aw, ah, ox + c * cw, oy + r * ch + (ch - ah) / 2, aw, ah)
      }
    }
  }

  /* ---------- цикл ---------- */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')
  let running = false, visible = false, raf = 0, t0 = 0, lastFrame = 0

  function frame(now) {
    raf = 0
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (now - lastFrame < 1000 / FPS - 2) return
    lastFrame = now
    if (!t0) t0 = now - last * 1000
    draw((now - t0) / 1000)
  }
  function update() {
    const should = visible && !document.hidden && !(reduce && reduce.matches) && scenes.length > 0
    if (should && !running) {
      running = true
      t0 = 0
      lastFrame = 0
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      draw(last)
    }
  }

  // обложки грузим параллельно, в цикл они встают в порядке карточек
  covers.forEach((cv, k) => {
    loadFirst(cv.src).then((img) => {
      if (!img) return
      const lv = levels(img)
      if (!lv) return
      slots[k] = { img, lv, name: cv.name, n: k + 1 }
      const was = scenes.length
      scenes.length = 0
      slots.forEach((s) => s && scenes.push(s))
      if (!was) { last = Math.max(last, 0.01); draw(last) }
      update()
    })
  })

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ready.then(() => { font = getComputedStyle(document.body).fontFamily || font; if (geo) { buildAtlas(); draw(last) } })

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting
    update()
  })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)
  resize()
}
