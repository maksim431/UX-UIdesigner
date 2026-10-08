// Лёгкий ASCII-след за курсором: при движении мыши за ним остаются и гаснут несколько символов.
// Только для мыши/тачпада; при «уменьшении движения» выключен. Никаких постоянных циклов:
// символы рождаются на mousemove и анимируются средствами браузера (Web Animations).

const CHARS = ['░', '▒', '▓', '█', '▪', '·', ':', '+', '*', '#', '0', '1']
const POOL = 16
const STEP = 24 // px пути между символами
const MIN_DT = 28 // мс между символами

export function initCursor() {
  if (window.__asciiCursor) return
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduce || !Element.prototype.animate) return
  window.__asciiCursor = true

  const layer = document.createElement('div')
  layer.className = 'ascii-cursor'
  layer.setAttribute('aria-hidden', 'true')
  const pool = []
  for (let i = 0; i < POOL; i++) {
    const s = document.createElement('span')
    layer.appendChild(s)
    pool.push(s)
  }
  document.body.appendChild(layer)

  let idx = 0
  let lx = -1e4
  let ly = -1e4
  let lt = 0
  window.addEventListener(
    'mousemove',
    (e) => {
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      const now = performance.now()
      if (dx * dx + dy * dy < STEP * STEP || now - lt < MIN_DT) return
      lx = e.clientX
      ly = e.clientY
      lt = now
      const s = pool[idx]
      idx = (idx + 1) % POOL
      s.textContent = CHARS[(Math.random() * CHARS.length) | 0]
      const x = e.clientX + 10 + (Math.random() * 8 - 4)
      const y = e.clientY + 14 + (Math.random() * 8 - 4)
      s.getAnimations().forEach((a) => a.cancel())
      s.animate(
        [
          { transform: `translate(${x}px, ${y}px)`, opacity: 0.55 },
          { transform: `translate(${x}px, ${y + 14}px)`, opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }
      )
    },
    { passive: true }
  )
}
