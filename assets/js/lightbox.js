/* Просмотр картинок кейса на весь экран.
   Клик/тап по картинке — открыть. Зум: колесо мыши или щипок на тачпаде/экране, двойной клик/тап (×2.5 ↔ ×1),
   кнопки «+ / −». Увеличенную картинку можно таскать. Листать: стрелки на экране и клавиатуре, свайп влево/вправо.
   Закрыть: ✕, Esc, клик по фону, свайп вниз. */
(function () {
  'use strict'
  var MAX = 5, DBL = 2.5
  var root = document.documentElement
  var en = root.lang === 'en'
  var T = en
    ? { close: 'Close', prev: 'Previous image', next: 'Next image', zin: 'Zoom in', zout: 'Zoom out', dlg: 'Image viewer' }
    : { close: 'Закрыть', prev: 'Предыдущая картинка', next: 'Следующая картинка', zin: 'Увеличить', zout: 'Уменьшить', dlg: 'Просмотр картинки' }

  function usable(img) {
    if (!img || img.style.display === 'none' || !img.naturalWidth) return false
    var ph = img.closest('.cs-fig__box--ph')
    return !ph || ph.classList.contains('is-loaded')
  }
  function gallery() {
    return Array.prototype.filter.call(document.querySelectorAll('.cs-fig img'), usable)
  }
  // для картинок с Framer берём оригинал, чтобы при зуме было чётко
  function full(img) {
    var s = img.currentSrc || img.src
    return /framerusercontent\.com/.test(s) ? s.replace(/\?.*$/, '') : s
  }

  var box, pic, cnt, bPrev, bNext, list = [], idx = 0, lastFocus = null
  var s = 1, x = 0, y = 0, bw = 0, bh = 0

  function btn(cls, label, html) {
    var b = document.createElement('button')
    b.type = 'button'; b.className = 'lb__btn ' + cls; b.setAttribute('aria-label', label); b.innerHTML = html
    return b
  }
  function build() {
    box = document.createElement('div')
    box.className = 'lb'
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', T.dlg)
    pic = document.createElement('img'); pic.className = 'lb__img'; pic.alt = ''; pic.draggable = false
    cnt = document.createElement('div'); cnt.className = 'lb__count'
    var bClose = btn('lb__close', T.close, '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3l14 14M17 3L3 17" stroke="currentColor" stroke-width="1.6"/></svg>')
    bPrev = btn('lb__prev', T.prev, '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>')
    bNext = btn('lb__next', T.next, '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M2 2l8 8-8 8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>')
    var zoom = document.createElement('div'); zoom.className = 'lb__zoom'
    var bOut = btn('lb__zout', T.zout, '−'), bIn = btn('lb__zin', T.zin, '+')
    zoom.append(bOut, bIn)
    box.append(pic, cnt, zoom, bPrev, bNext, bClose)
    document.body.appendChild(box)

    bClose.addEventListener('click', close)
    bPrev.addEventListener('click', function () { go(-1) })
    bNext.addEventListener('click', function () { go(1) })
    bIn.addEventListener('click', function () { zoomAt(s * 1.6, innerWidth / 2, innerHeight / 2, true) })
    bOut.addEventListener('click', function () { zoomAt(s / 1.6, innerWidth / 2, innerHeight / 2, true) })
    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('pointerdown', onDown)
    box.addEventListener('pointermove', onMove)
    box.addEventListener('pointerup', onUp)
    box.addEventListener('pointercancel', onUp)
    box.addEventListener('dblclick', function (e) { if (e.pointerType !== 'touch') toggleZoom(e.clientX, e.clientY) })
    pic.addEventListener('load', fit)
    window.addEventListener('resize', function () { if (box.classList.contains('is-open')) fit() })
  }

  // размер картинки при ×1: целиком в экране
  function fit() {
    var pad = innerWidth < 810 ? 0 : 48
    var vw = innerWidth - pad * 2, vh = innerHeight - pad * 2
    var r = Math.min(vw / (pic.naturalWidth || 1), vh / (pic.naturalHeight || 1))
    bw = Math.round((pic.naturalWidth || 1) * r); bh = Math.round((pic.naturalHeight || 1) * r)
    pic.style.width = bw + 'px'; pic.style.height = bh + 'px'
    set(1, 0, 0, false)
  }
  function clampXY() {
    var mx = Math.max(0, (bw * s - innerWidth) / 2), my = Math.max(0, (bh * s - innerHeight) / 2)
    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y))
  }
  function set(ns, nx, ny, anim) {
    s = Math.min(MAX, Math.max(1, ns)); x = nx; y = ny
    clampXY()
    pic.classList.toggle('is-anim', !!anim)
    pic.style.transform = 'translate(-50%, -50%) translate(' + x + 'px,' + y + 'px) scale(' + s + ')'
    box.classList.toggle('is-zoomed', s > 1.01)
  }
  // зум вокруг точки экрана (cx, cy): точка под пальцем/курсором остаётся на месте
  function zoomAt(ns, cx, cy, anim) {
    ns = Math.min(MAX, Math.max(1, ns))
    var ox = cx - innerWidth / 2, oy = cy - innerHeight / 2
    var k = ns / s
    set(ns, ox - (ox - x) * k, oy - (oy - y) * k, anim)
  }
  function toggleZoom(cx, cy) { if (s > 1.01) set(1, 0, 0, true); else zoomAt(DBL, cx, cy, true) }

  function show(i) {
    idx = (i + list.length) % list.length
    var img = list[idx]
    pic.removeAttribute('style')
    pic.style.opacity = '0'
    pic.onload = function () { pic.style.opacity = ''; fit() }
    pic.onerror = function () { if (pic.src !== img.src) pic.src = img.src }
    pic.alt = img.alt || ''
    pic.src = full(img)
    if (pic.complete && pic.naturalWidth) pic.onload()
    cnt.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : ''
    bPrev.hidden = bNext.hidden = list.length < 2
  }
  function go(d) { if (list.length > 1) show(idx + d) }

  function open(img) {
    if (!box) build()
    list = gallery()
    var i = list.indexOf(img)
    if (i < 0) return
    lastFocus = document.activeElement
    root.classList.add('no-scroll', 'lb-open')
    box.classList.add('is-open')
    show(i)
    box.querySelector('.lb__close').focus({ preventScroll: true })
    document.addEventListener('keydown', onKey)
  }
  function close() {
    box.classList.remove('is-open')
    root.classList.remove('no-scroll', 'lb-open')
    document.removeEventListener('keydown', onKey)
    pts.clear()
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true })
  }
  function onKey(e) {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
    else if (e.key === '+' || e.key === '=') zoomAt(s * 1.6, innerWidth / 2, innerHeight / 2, true)
    else if (e.key === '-') zoomAt(s / 1.6, innerWidth / 2, innerHeight / 2, true)
    else if (e.key === 'Tab') { // фокус не уходит из окна
      var f = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) { return !b.hidden })
      var a = f.indexOf(document.activeElement)
      e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus()
    }
  }

  function onWheel(e) {
    e.preventDefault(); e.stopPropagation()
    // щипок на тачпаде приходит как wheel с ctrlKey — он мельче, поэтому усиливаем
    var k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))
    zoomAt(s * k, e.clientX, e.clientY, false)
  }

  // указатели: один — перетаскивание/свайп, два — щипок
  var pts = new Map(), start = null, pinch = null, moved = false, lastTap = 0
  function onDown(e) {
    if (e.target.closest('.lb__btn')) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { box.setPointerCapture(e.pointerId) } catch (_) {}
    if (pts.size === 1) { start = { px: e.clientX, py: e.clientY, x: x, y: y, t: Date.now(), target: e.target }; moved = false }
    if (pts.size === 2) {
      var p = Array.from(pts.values())
      pinch = { d: dist(p), s: s, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, x: x, y: y }
      moved = true
    }
  }
  function onMove(e) {
    if (!pts.has(e.pointerId)) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size >= 2 && pinch) {
      var p = Array.from(pts.values())
      var ns = Math.min(MAX, Math.max(1, pinch.s * dist(p) / pinch.d))
      var cx = (p[0].x + p[1].x) / 2, cy = (p[1].y + p[0].y) / 2
      var ox = pinch.cx - innerWidth / 2, oy = pinch.cy - innerHeight / 2, k = ns / pinch.s
      set(ns, ox - (ox - pinch.x) * k + (cx - pinch.cx), oy - (oy - pinch.y) * k + (cy - pinch.cy), false)
      return
    }
    if (!start) return
    var dx = e.clientX - start.px, dy = e.clientY - start.py
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true
    if (s > 1.01) set(s, start.x + dx, start.y + dy, false)
    else if (moved) { // при ×1 картинка едет за пальцем: подсказка свайпа
      pic.classList.remove('is-anim')
      pic.style.transform = 'translate(-50%, -50%) translate(' + (Math.abs(dx) > Math.abs(dy) ? dx : 0) + 'px,' + (Math.abs(dy) >= Math.abs(dx) ? Math.max(0, dy) : 0) + 'px)'
    }
  }
  function onUp(e) {
    if (!pts.has(e.pointerId)) return
    pts.delete(e.pointerId)
    if (pts.size === 1 && pinch) { // после щипка продолжаем тащить оставшимся пальцем
      var r = Array.from(pts.values())[0]
      start = { px: r.x, py: r.y, x: x, y: y, t: Date.now(), target: null }
      pinch = null
      return
    }
    if (pts.size) return
    pinch = null
    if (!start) return
    var dx = e.clientX - start.px, dy = e.clientY - start.py, st = start
    start = null
    if (s <= 1.01 && moved) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return }
      if (dy > 90 && dy > Math.abs(dx)) { close(); return }
      set(1, 0, 0, true)
      return
    }
    if (moved) return
    // тап/клик без движения
    var now = Date.now()
    if (e.pointerType === 'touch' && now - lastTap < 300) { lastTap = 0; clearTimeout(tapTimer); toggleZoom(e.clientX, e.clientY); return }
    lastTap = now
    if (st.target === box && s <= 1.01) {
      // клик по фону закрывает (на телефоне — после паузы, чтобы не мешать двойному тапу)
      if (e.pointerType === 'touch') tapTimer = setTimeout(function () { if (lastTap === now) close() }, 300)
      else close()
    }
  }
  var tapTimer = 0
  function dist(p) { return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1 }

  // открываем по клику на картинку кейса (кроме мокапов блока «если сделать в нейросети»)
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.cs-fig img')
    if (!img || !usable(img)) return
    e.preventDefault()
    open(img)
  })
  // картинки кейса доступны с клавиатуры
  function a11y() {
    gallery().forEach(function (img) {
      if (img.tabIndex === 0) return
      img.tabIndex = 0; img.setAttribute('role', 'button')
      img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img) } })
    })
  }
  document.addEventListener('load', function (e) { if (e.target.closest && e.target.closest('.cs-fig')) a11y() }, true)
  window.addEventListener('load', a11y)
})()
