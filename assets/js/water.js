// Первый экран: вид сверху (flat lay) в тёмную воду. Японский карп кои из пиксельной мозаики —
// светлые плитки с символами (S X 8 0 G…): белыми, красно-оранжевыми (узор кохаку) и голубыми,
// с холодным свечением (bloom) у головы. Края силуэта мягко размыты.
//
// Карп плывёт вперёд и плавно петляет (поворачивает с инерцией, без резких разворотов); дойдя до края, уходит за него целиком и только тогда появляется с случайной стороны.
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
  let dcell = 12
  let font = getComputedStyle(document.body).fontFamily || 'monospace'

  /* ---------- движение: карп плывёт вперёд и плавно петляет; дойдя до края — уплывает за него
     и через мгновение появляется с случайной стороны фрейма ---------- */
  // фрейм в координатах canvas (canvas шире фрейма и стоит по центру)
  function frameBox() {
    const ox = (W - FW) / 2
    // видимая часть: по высоте — не ниже окна (первый экран выше окна на 20%)
    return { x0: ox, x1: ox + FW, y0: 0, y1: Math.min(H, window.innerHeight || H) }
  }
  const pellets = [] // корм: { x, y, t0, eaten }
  let chase = 0, gulp = -9
  // ~80% времени карп гуляет в кадре (у краёв мягко отворачивает), затем уплывает за край и заходит снова
  // поведение: «гуляет» по видимой части фрейма между случайными точками (разная скорость и характер
  // каждого отрезка: неспешное скольжение, рывок, почти зависание с лёгким дрейфом); примерно в каждом
  // шестом-седьмом выборе — уплывает за край, а через мгновение заплывает с случайной стороны.
  // В итоге около 80% времени карп в кадре и около 20% — за его пределами.
  let px = -1, py = -1, entering = false, leaving = false, heading = 0, omega = 0, phase = 0, lastT = -1, turn = 0, seed = Math.random() * 100
  let wx = 0, wy = 0, segSp = 1, spCur = 1, segTurn = 0.7, segUntil = 0
  // vigor — сила движений тела (0…1): от неё жёстко зависят и взмахи хвоста, и резкость поворотов, и скорость
  let vigor = 0.2, calm = 0.2, burstUntil = -1, ampK = 1
  // запас за краем, при котором карп (с плавниками, хвостом и свечением) уже целиком не виден
  const hidden = () => len * 0.68
  // видимая часть фрейма: фрейм выше окна на 20%, нижнюю пятую часть сразу не видно
  function viewBox() {
    const f = frameBox()
    return { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y0 + (f.y1 - f.y0) / 1.3 }
  }
  // новая цель «прогулки»: случайная точка внутри видимой области, не слишком близко к краю
  function pickWaypoint(t) {
    const v = viewBox()
    const mx = Math.min(len * 0.55, (v.x1 - v.x0) * 0.3), my = Math.min(len * 0.55, (v.y1 - v.y0) * 0.3)
    // не ближе ~0.6 длины тела к текущей точке, чтобы получался заметный путь
    for (let k = 0; k < 8; k++) {
      wx = v.x0 + mx + Math.random() * (v.x1 - v.x0 - 2 * mx)
      wy = v.y0 + my + Math.random() * (v.y1 - v.y0 - 2 * my)
      if (Math.hypot(wx - px, wy - py) > len * 0.6) break
    }
    // «бодрость» отрезка: чаще всего спокойное плавание, изредка — рывок всем телом
    calm = 0.12 + Math.random() * 0.2
    if (Math.random() < 0.16) burstUntil = t + 0.9 + Math.random() * 0.8
    segUntil = t + 14 + Math.random() * 10 // если цель «не даётся» — выбираем новую
  }
  // уйти за край: цель — точка за ближайшим (или случайным) краем
  function pickExit() {
    const f = frameBox()
    const m = hidden() * 1.6
    const side = Math.random() < 0.6 ? nearestSide() : Math.floor(Math.random() * 4)
    const k = 0.2 + Math.random() * 0.6
    if (side === 0) { wx = f.x0 + (f.x1 - f.x0) * k; wy = f.y0 - m }
    else if (side === 1) { wx = f.x1 + m; wy = f.y0 + (f.y1 - f.y0) * k }
    else if (side === 2) { wx = f.x0 + (f.x1 - f.x0) * k; wy = f.y1 + m }
    else { wx = f.x0 - m; wy = f.y0 + (f.y1 - f.y0) * k }
    calm = 0.3
    leaving = true
  }
  function nearestSide() {
    const v = viewBox()
    const d = [py - v.y0, v.x1 - px, v.y1 - py, px - v.x0]
    return d.indexOf(Math.min(...d))
  }
  // заход в кадр: снаружи со случайной стороны, курс — на случайную точку в видимой части
  function respawn(t) {
    const f = frameBox(), v = viewBox()
    const m = hidden()
    const side = Math.floor(Math.random() * 4)
    const k = 0.15 + Math.random() * 0.7
    if (side === 0) { px = f.x0 + (f.x1 - f.x0) * k; py = f.y0 - m }
    else if (side === 1) { px = f.x1 + m; py = v.y0 + (v.y1 - v.y0) * k }
    else if (side === 2) { px = f.x0 + (f.x1 - f.x0) * k; py = f.y1 + m }
    else { px = f.x0 - m; py = v.y0 + (v.y1 - v.y0) * k }
    wx = v.x0 + (v.x1 - v.x0) * (0.3 + Math.random() * 0.4)
    wy = v.y0 + (v.y1 - v.y0) * (0.3 + Math.random() * 0.4)
    heading = Math.atan2(wx - px, -(wy - py))
    omega = 0
    seed = Math.random() * 100
    entering = true
    leaving = false
    calm = 0.3; segUntil = t + 30
    resetTrail()
  }
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
  function step(t) {
    const f = frameBox(), v = viewBox()
    if (px < 0 && py < 0) respawn(t) // первый показ — тоже заплывает из-за края
    const dt = lastT < 0 ? 0 : clamp(t - lastT, 0, 0.1)
    const inset = len * 0.3
    const inside = px > v.x0 + inset && px < v.x1 - inset && py > v.y0 + inset && py < v.y1 - inset
    if (entering && inside) { entering = false; pickWaypoint(t) }
    // голова и ближайший корм
    const hx0 = px + Math.sin(heading) * len * 0.45, hy0 = py - Math.cos(heading) * len * 0.45
    let food = null, best = Infinity
    for (const q of pellets) {
      if (q.eaten >= 0) continue
      const dd = Math.hypot(q.x - hx0, q.y - hy0)
      if (dd < best) { best = dd; food = q }
    }
    chase += ((food ? 1 : 0) - chase) * Math.min(1, dt * 1.2)
    let tx, ty, slow = 1, vT
    if (food) {
      entering = false
      leaving = false
      tx = food.x; ty = food.y; vT = 0.65
      if (best < len * 0.09) { food.eaten = t; gulp = t; pickWaypoint(t) }
    } else {
      // цель прогулки достигнута (или «не даётся» слишком долго) — следующая цель или уход
      if (!entering && !leaving && (Math.hypot(wx - hx0, wy - hy0) < len * 0.35 || t > segUntil)) {
        if (Math.random() < 0.14) pickExit()
        else pickWaypoint(t)
      }
      tx = wx; ty = wy
      vT = t < burstUntil ? 1 : entering || leaving ? Math.max(calm, 0.35) : calm
    }
    const ang = wrap(Math.atan2(tx - hx0, -(ty - hy0)) - heading)
    const dist = Math.hypot(tx - hx0, ty - hy0)
    // цель рядом, но сбоку — тело работает тише (и он медленнее), доворачивая к цели
    if (dist < len * 0.9) slow = clamp(0.45 + 0.55 * Math.max(0, Math.cos(ang)), 0.45, 1)
    // сила движений: рывок разгоняется быстро, успокоение — плавное
    vigor += (vT - vigor) * Math.min(1, dt * (vT > vigor ? 5 : 0.9))
    const ve = clamp(vigor * slow, 0.06, 1)
    // ЖЁСТКАЯ СВЯЗЬ: резкость поворота, взмахи хвоста и скорость — всё от одной силы движений v
    const maxTurn = 0.18 + 1.05 * ve
    const wobble = ve * (0.12 * Math.sin(t * 0.7 + seed) + 0.07 * Math.sin(t * 1.9 + seed * 2.3))
    const want = clamp(ang * 0.9, -maxTurn, maxTurn) + (food ? 0 : wobble)
    omega += clamp(want - omega, -(0.4 + 2.2 * ve) * dt, (0.4 + 2.2 * ve) * dt)
    omega = clamp(omega, -maxTurn, maxTurn)
    heading = wrap(heading + omega * dt)
    // резкий поворот корпусом сам добавляет силы — и скорости
    const turnV = clamp(Math.abs(omega) / 1.2, 0, 1)
    const drive = Math.max(ve, turnV)
    // размах волны по телу: широкий и меняется плавно
    ampK += (0.85 + 0.6 * drive - ampK) * Math.min(1, dt * 1.5)
    const sp = len * (0.03 + 0.24 * drive)
    spCur = sp / (len * 0.12)
    px += Math.sin(heading) * sp * dt
    py += -Math.cos(heading) * sp * dt
    // новое появление — только когда карп целиком скрылся за краем (и не плывёт за кормом)
    const m = hidden()
    if (!food && !entering && (px < f.x0 - m || px > f.x1 + m || py < f.y0 - m || py > f.y1 + m)) respawn(t)
    turn = omega
    pushTrail()
    // частота взмахов хвоста растёт со скоростью
    phase += dt * (0.9 + 4.5 * drive) // частота взмахов — от силы движений (спокойно — редкие широкие взмахи)
    lastT = t
    return { x: px, y: py, sp }
  }

  // тело — упругая «резиновая» цепочка позвонков: голова ведёт, каждый следующий позвонок
  // тянется за предыдущим на постоянном расстоянии, а изгибы плавно распрямляются (жёсткость на изгиб).
  // Поворачивает влево — тело выгибается дугой вправо; частые смены курса — тело гибко волнится.
  // Между позвонками — гладкий сплайн, поэтому контур не «ломается».
  const NJ = 22
  const joints = []
  function headTip() { return [px + Math.sin(heading) * len * 0.5, py - Math.cos(heading) * len * 0.5] }
  function resetTrail() {
    joints.length = 0
    const [hx, hy] = headTip()
    const dx = Math.sin(heading), dy = -Math.cos(heading)
    const seg = (len * 1.05) / (NJ - 1)
    for (let i = 0; i < NJ; i++) joints.push([hx - dx * seg * i, hy - dy * seg * i])
  }
  let chainT = -1
  function pushTrail() {
    const [hx, hy] = headTip()
    if (!joints.length) { resetTrail(); return }
    if (Math.hypot(hx - joints[0][0], hy - joints[0][1]) > len * 0.5) { resetTrail(); return } // новое появление
    const seg = (len * 1.05) / (NJ - 1)
    const dt = chainT < 0 ? 0 : clamp(lastT - chainT, 0, 0.1)
    chainT = lastT
    joints[0][0] = hx; joints[0][1] = hy
    // 1) каждый позвонок тянется за предыдущим (как верёвка)
    for (let i = 1; i < NJ; i++) {
      const p0 = joints[i - 1], q = joints[i]
      let dx = q[0] - p0[0], dy = q[1] - p0[1]
      const d = Math.hypot(dx, dy) || 1
      q[0] = p0[0] + (dx / d) * seg; q[1] = p0[1] + (dy / d) * seg
    }
    // 2) жёсткость на изгиб: позвонок мягко тянется к продолжению предыдущего сегмента,
    //    а слишком острый угол ограничен — тело гнётся дугой, но не складывается
    const stiff = 1 - Math.pow(0.004, dt) // доля распрямления за кадр (не зависит от частоты кадров)
    for (let i = 2; i < NJ; i++) {
      // голова почти жёсткая, середина гнётся умеренно, хвост — гибче всего; изгиб распределяется по телу
      const u = i / (NJ - 1)
      const maxBend = u < 0.22 ? 0.05 : 0.09 + 0.07 * u
      const a0 = joints[i - 2], a1 = joints[i - 1], q = joints[i]
      const ang0 = Math.atan2(a1[1] - a0[1], a1[0] - a0[0])
      let ang1 = Math.atan2(q[1] - a1[1], q[0] - a1[0])
      let rel = ang1 - ang0
      while (rel > Math.PI) rel -= 2 * Math.PI
      while (rel < -Math.PI) rel += 2 * Math.PI
      rel *= 1 - stiff * 0.5
      rel = clamp(rel, -maxBend, maxBend)
      ang1 = ang0 + rel
      q[0] = a1[0] + Math.cos(ang1) * seg; q[1] = a1[1] + Math.sin(ang1) * seg
    }
  }
  function poseFn(st) {
    const seg = (len * 1.05) / (NJ - 1)
    // точка позвоночника на расстоянии d от головы (сплайн Катмулла — Рома) и касательная (по движению)
    const J = (i) => joints[clamp(i, 0, NJ - 1)]
    const spine = (d) => {
      let f = d / seg
      if (f > NJ - 1) f = NJ - 1
      if (f < 0) f = 0
      const i = Math.min(NJ - 2, Math.floor(f)), t = f - i
      const p0 = J(i - 1), p1 = J(i), p2 = J(i + 1), p3 = J(i + 2)
      const t2 = t * t, t3 = t2 * t
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      const dx = 0.5 * ((-p0[0] + p2[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t2)
      const dy = 0.5 * ((-p0[1] + p2[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t2)
      const l = Math.hypot(dx, dy) || 1
      // касательная направлена от хвоста к голове
      return [x, y, -dx / l, -dy / l]
    }
    return (x, y, k) => {
      const u = clamp(y + 0.5, 0, 1.1) // 0 у головы, 1 у хвоста
      const amp = (0.02 + 0.13 * u * u) * ampK
      let bx = x + amp * Math.sin(u * 3.8 - phase)
      if (k === 1) bx *= 1 + 0.12 * Math.sin(phase * 0.6) // грудные плавники гребут
      const [sx, sy, tx, ty] = spine((y + 0.5) * len)
      // нормаль вправо от направления движения
      return [sx - ty * bx * len, sy + tx * bx * len]
    }
  }


  function resize() {
    FW = Math.max(1, host.clientWidth)
    const w = Math.max(FW, document.documentElement.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const d = Math.min(1.25, window.devicePixelRatio || 1) // меньше пикселей — легче видеокарте при прокрутке
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
    const visH = Math.min(H, window.innerHeight || H) // размер считаем по видимой части первого экрана
    len = phone ? Math.min(visH * 0.42, FW * 0.78) : Math.min(visH * 0.46, FW * 0.3)
    tcols = Math.ceil(W / tile)
    trows = Math.ceil(H / tile)
    mask.width = tcols
    mask.height = trows
    buildDots()
    draw(last)
  }

  // фон: сетка ASCII-символов и пикселей; атлас из уровней яркости (последние — пиксели-квадраты)
  const BG = ' .·:-+=*#'
  const BL = BG.length + 2
  let batlas = null, bcols = 0, brows = 0, bseed = null
  function buildDots() {
    dcell = FW < 810 ? 10 : 12
    bcols = Math.ceil(W / dcell)
    brows = Math.ceil(H / dcell)
    bseed = new Float32Array(bcols * brows)
    for (let i = 0; i < bseed.length; i++) bseed[i] = hash(i, 13)
    const a = Math.ceil(dcell * dpr)
    batlas = document.createElement('canvas')
    batlas.width = a * BL
    batlas.height = a
    const g = batlas.getContext('2d')
    g.font = Math.round(dcell * 0.95 * dpr) + 'px ' + font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let l = 1; l < BL; l++) {
      if (l < BG.length) {
        const k = l / (BG.length - 1)
        g.fillStyle = 'rgba(' + Math.round(150 + 80 * k) + ',' + Math.round(170 + 70 * k) + ',255,' + (0.28 + 0.5 * k).toFixed(3) + ')'
        g.fillText(BG[l], l * a + a / 2, a / 2)
      } else {
        // пиксели: тусклый и яркий квадрат
        const sz = Math.round(a * (l === BG.length ? 0.5 : 0.7))
        g.fillStyle = l === BG.length ? 'rgba(170,190,255,0.55)' : 'rgba(225,235,255,0.9)'
        g.fillRect(l * a + (a - sz) / 2, (a - sz) / 2, sz, sz)
      }
    }
    // неподвижный фон рисуем ОДИН раз в отдельный холст; в кадре он ставится одной операцией
    bgStatic = document.createElement('canvas')
    bgStatic.width = canvas.width
    bgStatic.height = canvas.height
    const gs = bgStatic.getContext('2d')
    gs.fillStyle = '#2c40c7'
    gs.fillRect(0, 0, bgStatic.width, bgStatic.height)
    bcur = new Uint8Array(bcols * brows)
    const live = []
    for (let r = 0; r < brows; r++) for (let c = 0; c < bcols; c++) {
      const i = r * bcols + c
      const lv = baseLevel(bseed[i])
      bcur[i] = lv
      // 5% элементов фона «живые»: перебирают ASCII-символы; в готовый фон их не кладём,
      // а рисуем поверх в каждом кадре — так готовый холст не меняется и не перезагружается в видеопамять
      if (lv && hash(i, 71) < 0.05) { live.push(i); continue }
      if (lv) gs.drawImage(batlas, lv * a, 0, a, a, Math.round(c * dcell * dpr), Math.round(r * dcell * dpr), a, a)
    }
    bliveIdx = Uint32Array.from(live)
    bliveT = new Float32Array(live.length)
    for (let k = 0; k < live.length; k++) bliveT[k] = hash(live[k], 5) * 2.5
    bctx = gs
    bliveInit = false
  }
  // смена символов у «живых» клеток: дорисовываем в готовый фон только изменившиеся клетки
  function tickBg(t) {
    if (!bliveIdx) return
    if (!bliveInit) { for (let k = 0; k < bliveT.length; k++) bliveT[k] += t; bliveInit = true }
    for (let k = 0; k < bliveIdx.length; k++) {
      if (t < bliveT[k]) continue
      const i = bliveIdx[k]
      // короткая серия быстрых смен символа, затем пауза
      const burst = Math.random() < 0.7
      bliveT[k] = t + (burst ? 0.06 + Math.random() * 0.12 : 0.8 + Math.random() * 2.6)
      let lv = 1 + ((Math.random() * (BG.length - 2)) | 0)
      if (lv === bcur[i]) lv = lv === 1 ? 2 : lv - 1
      bcur[i] = lv
    }
  }
  function drawLive() {
    if (!bliveIdx) return
    const a = batlas.height
    for (let k = 0; k < bliveIdx.length; k++) {
      const i = bliveIdx[k]
      const r = (i / bcols) | 0, c = i - r * bcols
      ctx.drawImage(batlas, bcur[i] * a, 0, a, a, Math.round(c * dcell * dpr), Math.round(r * dcell * dpr), a, a)
    }
  }
  const baseLevel = (s) => (s < 0.3 ? 0 : s < 0.62 ? 1 : s < 0.8 ? 2 : s < 0.9 ? 3 : s < 0.95 ? 4 : s < 0.985 ? 5 : BG.length)
  let bgStatic = null, bctx = null, bcur = null, bliveIdx = null, bliveT = null, bliveInit = false

  // след на воде клином (как у плывущей рыбы): от боков головы непрерывно отходят «частицы волны»,
  // каждая расходится в сторону от курса и гаснет — вместе они рисуют два расходящихся луча за карпом.
  // От хвоста — короткая слабая полоса завихрений по центру следа.
  const wake = []
  let lastSpawn = -1
  function spawnWake(t, P, st) {
    if (lastSpawn < 0 || t < lastSpawn) lastSpawn = t
    const nx = Math.cos(heading), ny = Math.sin(heading) // нормаль вправо от курса
    while (t - lastSpawn > 0.06) {
      lastSpawn += 0.06
      const vs = st.sp * 0.5 + len * 0.01
      const [rx, ry] = P(0.1, -0.36, 0)
      const [lx, ly] = P(-0.1, -0.36, 0)
      wake.push({ x: rx, y: ry, nx, ny, v: vs, t0: lastSpawn, a: 0.8, life: 7 })
      wake.push({ x: lx, y: ly, nx: -nx, ny: -ny, v: vs, t0: lastSpawn, a: 0.8, life: 7 })
      if (Math.random() < 0.5) {
        const [tx, ty] = P((Math.random() - 0.5) * 0.08, 0.46, 3)
        wake.push({ x: tx, y: ty, nx: 0, ny: 0, v: 0, t0: lastSpawn, a: 0.45, life: 1.4 })
      }
    }
    for (let i = wake.length - 1; i >= 0; i--) if (t - wake[i].t0 > wake[i].life || t < wake[i].t0) wake.splice(i, 1)
    if (wake.length > 420) wake.splice(0, wake.length - 420)
  }
  let field = null, fox = null, foy = null
  const touched = []

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

    // фон: синий #2C40C7 и сетка ASCII-символов и пикселей, статичный (отрисован один раз); след от карпа — более светлые символы, без пикселей
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    const [hx, hy] = P(0, -0.4, 0)
    spawnWake(t, P, st)
    // поле волны: каждую частицу «штампуем» в ближайшие клетки фона (быстрее, чем перебирать всё)
    const nb = bcols * brows
    if (!field || field.length !== nb) { field = new Float32Array(nb); fox = new Float32Array(nb); foy = new Float32Array(nb); touched.length = 0 }
    for (let k = 0; k < touched.length; k++) { const i = touched[k]; field[i] = 0; fox[i] = 0; foy[i] = 0 }
    touched.length = 0
    for (const q of wake) {
      const age = t - q.t0
      const k = 1 - age / q.life
      const amp = q.a * Math.pow(k, 1.3) * Math.min(1, age * 1.5)
      const w = len * (0.014 + 0.006 * age)
      const x = q.x + q.nx * q.v * age, y = q.y + q.ny * q.v * age
      const c0 = Math.max(0, Math.floor((x - w * 2.5) / dcell)), c1 = Math.min(bcols - 1, Math.floor((x + w * 2.5) / dcell))
      const r0 = Math.max(0, Math.floor((y - w * 2.5) / dcell)), r1 = Math.min(brows - 1, Math.floor((y + w * 2.5) / dcell))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * dcell - x, dy = (r + 0.5) * dcell - y
        const e = (dx * dx + dy * dy) / (w * w)
        if (e > 6) continue
        const h = Math.exp(-e) * amp
        const i = r * bcols + c
        if (field[i] === 0) touched.push(i)
        field[i] += h
        fox[i] += q.nx * h * 1.8
        foy[i] += q.ny * h * 1.8
      }
    }
    // фон неподвижен: готовый холст одной операцией; перерисовываем только клетки, по которым идёт след
    tickBg(t)
    ctx.drawImage(bgStatic, 0, 0)
    drawLive()
    const ba = batlas.height
    for (let k = 0; k < touched.length; k++) {
      const i = touched[k]
      const wv = Math.min(1.2, field[i])
      if (wv <= 0.06) continue
      const r = (i / bcols) | 0, c = i - r * bcols
      const base = bcur[i]
      const l = Math.max(base === BG.length ? 0 : base, Math.min(BG.length - 3, Math.round(1.2 + wv * 4.5)))
      const x = Math.round(c * dcell * sc), y = Math.round(r * dcell * sc)
      // стираем исходный символ клетки и ставим символ гребня волны (чуть сдвинутый по ходу волны)
      ctx.fillStyle = '#2c40c7'
      ctx.fillRect(x, y, ba, ba)
      ctx.drawImage(batlas, l * ba, 0, ba, ba, Math.round(x + fox[i] * sc), Math.round(y + foy[i] * sc), ba, ba)
    }

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
    // корм: маленький светящийся пиксель; появляется с лёгким «плюхом», при поедании вспыхивает и исчезает
    for (let k = pellets.length - 1; k >= 0; k--) {
      const q = pellets[k]
      const age = t - q.t0
      let sz = tile * 0.72 * Math.min(1, age * 4) * (1 + 0.08 * Math.sin(t * 5 + q.t0))
      let a = 1
      if (q.eaten >= 0) {
        const e = (t - q.eaten) / 0.35
        if (e >= 1 || e < 0) { pellets.splice(k, 1); continue }
        sz *= 1 + e * 0.6
        a = 1 - e
      }
      const x = q.x * sc, y = q.y * sc, r = sz * sc
      const hg = lctx.createRadialGradient(x, y, 0, x, y, r * 3)
      hg.addColorStop(0, 'rgba(200,250,255,' + (0.55 * a).toFixed(3) + ')')
      hg.addColorStop(1, 'rgba(120,200,255,0)')
      lctx.fillStyle = hg
      lctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6)
      lctx.globalAlpha = a
      lctx.fillStyle = '#f2fdff'
      lctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), Math.round(r), Math.round(r))
      lctx.globalAlpha = 1
    }

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
    ctx.fillRect(hx * sc - hr, hy * sc - hr, hr * 2, hr * 2)

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
  ready.then(() => { font = getComputedStyle(document.body).fontFamily || font; lastT = -1; if (bcols) buildDots(); draw(last) })
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  window.addEventListener('resize', resize)
  // клик/тап по фрейму — бросить корм (не больше трёх пикселей одновременно)
  const box = host.parentElement || host
  box.classList.add('can-feed')
  box.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('a, button')) return
    if (reduce && reduce.matches) return
    if (pellets.filter((q) => q.eaten < 0).length >= 3) return
    const r = canvas.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    pellets.push({ x, y, t0: last, eaten: -1 })
    box.classList.add('fed') // подсказка «кликни, чтобы покормить» больше не нужна
    // от упавшего пикселя расходится маленький круг
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      wake.push({ x, y, nx: Math.cos(a), ny: Math.sin(a), v: len * 0.12, t0: last, a: 0.5, life: 1.6 })
    }
  })
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; update() })
  io.observe(host)
  document.addEventListener('visibilitychange', update)
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', update)
  last = 4
  resize()
}
