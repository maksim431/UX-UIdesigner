// Первый экран: абстрактная фигура из видео, нарисованная ASCII-символами поверх синего фона.
//
// Как устроено:
//  • видео assets/video/figure.mp4 (360×360, 16.7 с, бесшовная петля) играет скрыто, без звука;
//  • каждый кадр уменьшаем до сетки «колонки × строки» и берём яркость клетки;
//  • тёмная фигура на светлом фоне → чем темнее клетка, тем «плотнее» символ ( .:-=+*#%@ ),
//    блики на глянце превращаются в редкие точки — объём читается и в символах;
//  • символы заранее отрисованы в атлас, кадр — это несколько тысяч drawImage (дёшево);
//  • ASCII-эффекты: фигура «собирается» из символов при появлении, по ней пробегает полоса
//    со сменой символов на пиксельные (█▓▒░), отдельные символы мерцают;
//  • canvas прозрачный — синий фон остаётся фоном блока (как и был);
//  • анимация останавливается, когда блок не виден, вкладка скрыта или включено «уменьшение движения».

const RAMP = ' .,:-=+*#%@'
const PIX = '░▒▓█'
const COLOR = [214, 222, 255]
const FPS = 30

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// размер и положение фигуры в блоке: по центру, квадрат
function place(w, h) {
  const phone = w < 810
  const tablet = !phone && w < 1200
  const s = phone ? Math.min(w * 0.98, h * 0.62) : tablet ? Math.min(w * 0.8, h * 0.74) : Math.min(w * 0.6, h * 0.8)
  const cy = phone ? h * 0.52 : h * 0.47
  return { s, x: (w - s) / 2, y: cy - s / 2, cell: phone ? 5 : tablet ? 6 : clamp(Math.round(s / 105), 6, 9) }
}

export function mountFigure(host, src, poster, hud) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.loop = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')
  video.setAttribute('aria-hidden', 'true')
  video.preload = 'auto'
  video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0'
  // VP9 (webm) там, где он есть, иначе H.264 (mp4) — Safari и старые браузеры
  const webm = src.replace(/\.mp4$/, '.webm')
  video.src = webm !== src && video.canPlayType('video/webm; codecs="vp9"') === 'probably' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? webm : src
  host.appendChild(video)

  const still = new Image()
  still.src = poster

  const sample = document.createElement('canvas')
  const sctx = sample.getContext('2d', { willReadFrequently: true })

  let W = 1, H = 1, dpr = 1, geo = null, cols = 0, rows = 0
  let atlas = null, glyphs = 0
  let font = '"Fira Mono", ui-monospace, monospace'
  let born = 0 // момент появления — для «сборки» из символов
  let seeds = null
  let mask = null, rl, rr, ct, cb
  const hist = new Uint32Array(256)

  // атлас: строка RAMP (яркость задана прозрачностью) + пиксельные символы
  function buildAtlas() {
    const c = geo.cell
    const chars = RAMP + PIX
    glyphs = chars.length
    atlas = document.createElement('canvas')
    atlas.width = Math.ceil(c * dpr) * glyphs
    atlas.height = Math.ceil(c * dpr * 1.6)
    const g = atlas.getContext('2d')
    const cw = Math.ceil(c * dpr)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 0; i < glyphs; i++) {
      const ch = chars[i]
      const pix = i >= RAMP.length
      const a = pix ? 0.85 : 0.3 + 0.7 * Math.pow(i / (RAMP.length - 1), 1.4)
      g.fillStyle = 'rgba(' + COLOR[0] + ',' + COLOR[1] + ',' + COLOR[2] + ',' + a + ')'
      g.font = Math.round((pix ? 1.25 : 1.45) * c * dpr) + 'px ' + font
      g.fillText(ch, i * cw + cw / 2, atlas.height / 2)
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
    cols = Math.max(24, Math.floor(geo.s / geo.cell))
    rows = Math.max(24, Math.floor(geo.s / (geo.cell * 1.6)))
    sample.width = cols
    sample.height = rows
    seeds = new Float32Array(cols * rows)
    for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i, 7)
    buildAtlas()
    draw(last)
  }

  let last = 0
  let hudKey = -1
  function updateHud(t, n) {
    if (!hud) return
    const key = Math.floor(t * 1.6)
    if (key === hudKey) return
    hudKey = key
    hud.textContent = '679 — ' + (n + Math.floor(hash(key, 1) * 40)) + ' CHARS / ' + (26 + Math.floor(hash(key, 2) * 12)) + ' LINKS'
  }

  function draw(t) {
    last = t
    if (!geo || !atlas) return
    const src = video.readyState >= 2 ? video : still.complete && still.naturalWidth ? still : null
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!src) return
    sctx.drawImage(src, 0, 0, cols, rows)
    const px = sctx.getImageData(0, 0, cols, rows).data

    const cw = geo.cell * dpr
    const ch = geo.cell * 1.6 * dpr
    const aw = Math.ceil(geo.cell * dpr)
    const ah = atlas.height
    const ox = Math.round(geo.x * dpr + (geo.s * dpr - cols * cw) / 2)
    const oy = Math.round(geo.y * dpr + (geo.s * dpr - rows * ch) / 2)
    const steps = RAMP.length - 1
    // появление: каждая клетка «проявляется» в свой момент за ~1.4 с
    const grow = born ? clamp((t - born) / 1.4, 0, 1) : 1
    // полоса со сменой символов на пиксельные, пробегает сверху вниз раз в ~6 с
    const band = ((t / 6) % 1) * (rows + 30) - 15
    const tick = Math.floor(t * 12)
    // маска фигуры: клетка внутри, если она между крайними тёмными клетками и по строке, и по столбцу
    // (так блики на глянце остаются частью фигуры, а белый фон — нет)
    const n2 = cols * rows
    if (!mask || mask.length !== n2) { mask = new Uint8Array(n2); rl = new Int16Array(rows); rr = new Int16Array(rows); ct = new Int16Array(cols); cb = new Int16Array(cols) }
    rl.fill(cols); rr.fill(-1); ct.fill(rows); cb.fill(-1)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (px[(r * cols + c) * 4] < 150) {
        if (c < rl[r]) rl[r] = c
        if (c > rr[r]) rr[r] = c
        if (r < ct[c]) ct[c] = r
        if (r > cb[c]) cb[c] = r
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mask[r * cols + c] = c >= rl[r] && c <= rr[r] && r >= ct[c] && r <= cb[c] ? 1 : 0

    // нормируем тон по самой фигуре (5-й и 98-й перцентили), чтобы блики и полутени читались в любом кадре
    hist.fill(0)
    let cnt = 0
    for (let i = 0; i < n2; i++) if (mask[i]) { hist[px[i * 4]]++; cnt++ }
    let lo = 0, hi = 255, acc = 0
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= cnt * 0.05) { lo = v; break } }
    acc = 0
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= cnt * 0.02) { hi = v; break } }
    const span = Math.max(24, hi - lo)

    let n = 0
    for (let r = 0; r < rows; r++) {
      const db = Math.abs(r - band)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        if (!mask[i]) continue
        const s = seeds[i]
        if (s > grow * 1.05) continue
        // тон внутри фигуры: тёмное тело — редкие тусклые символы, блики — плотные и яркие
        const tone = Math.pow(clamp((px[i * 4] - lo) / span, 0, 1), 0.55)
        let g = 4 + Math.round(tone * (steps - 4))
        const edge = c === 0 || r === 0 || c === cols - 1 || r === rows - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - cols] || !mask[i + cols]
        if (edge) g = Math.max(g, steps - 2)
        if (db < 2.5 && hash(i, tick) < 0.35) g = RAMP.length + Math.floor(hash(i, tick + 1) * PIX.length)
        else if (hash(i, tick) < 0.01) g = RAMP.length + Math.floor(s * PIX.length)
        else if (grow < 1 && s > grow - 0.12) g = RAMP.length + Math.floor(s * PIX.length)
        ctx.drawImage(atlas, g * aw, 0, aw, ah, ox + c * cw, oy + r * ch + (ch - ah) / 2, aw, ah)
        n++
      }
    }
    updateHud(t, n)
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
    const should = visible && !document.hidden && !(reduce && reduce.matches)
    if (should && !running) {
      running = true
      t0 = 0
      lastFrame = 0
      const p = video.play()
      if (p && p.catch) p.catch(() => {}) // режим энергосбережения: остаётся неподвижный кадр
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      video.pause()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      draw(last)
    }
  }

  // символы ждут шрифт, чтобы не перерисовывать атлас
  const cssFont = getComputedStyle(document.body).fontFamily
  if (cssFont) font = cssFont
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ready.then(() => { if (geo) { buildAtlas(); draw(last) } })

  video.addEventListener('loadeddata', () => draw(last))
  still.onload = () => draw(last)

  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver((e) => {
    visible = e[0].isIntersecting
    update()
  })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)

  born = 0.15
  resize()

  return {
    destroy() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
      video.pause()
      video.remove()
      canvas.remove()
    },
  }
}
