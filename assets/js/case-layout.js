// Раскладка страницы кейса. Подключается обычным скриптом в конце <body>, чтобы сработать до первой отрисовки.
// На экранах от 1200px картинки (и блок про нейросеть) уезжают в правую колонку в порядке data-d,
// на планшете и телефоне возвращаются на свои места в тексте.
// Кейсы-истории (.cs--story): в правой колонке каждая картинка стоит на уровне абзаца, к которому относится.
(function () {
  var media = document.querySelector('.cs-media')
  if (!media) return
  var story = !!document.querySelector('.cs--story')
  var items = Array.prototype.slice.call(document.querySelectorAll('.cs-flow [data-d]'))
  items.forEach(function (el) {
    // метка места в тексте: на десктопе по ней выравниваем картинку, на мобильных возвращаем картинку сюда
    var slot = document.createElement('span')
    slot.className = 'cs-slot'
    slot.setAttribute('aria-hidden', 'true')
    el.parentNode.insertBefore(slot, el)
    el._slot = slot
  })
  var sorted = items.slice().sort(function (a, b) { return a.getAttribute('data-d') - b.getAttribute('data-d') })
  var mq = window.matchMedia('(min-width: 1200px)')
  var raf = 0
  var extra = 0
  var flow = document.querySelector('.cs-flow')
  var hdr = document.querySelector('.hdr')

  function place() {
    raf = 0
    if (!story || !mq.matches) return
    var top0 = media.getBoundingClientRect().top
    var bottom = 0
    sorted.forEach(function (el, i) {
      var want = i === 0 ? 0 : el._slot.getBoundingClientRect().top - top0
      var y = Math.max(want, bottom)
      el.style.top = Math.round(y) + 'px'
      bottom = y + el.offsetHeight
    })
    // картинок больше, чем текста: колонка с картинками едет чуть быстрее, чтобы закончиться вместе с текстом
    extra = Math.max(0, bottom - (flow.getBoundingClientRect().bottom - top0))
    // высота колонки в раскладке — не больше текста, иначе внизу страницы остаётся пустое место
    media.style.height = Math.round(bottom - extra) + 'px'
    drift()
  }
  function drift() {
    if (!story || !mq.matches || !extra) {
      media.style.transform = ''
      return
    }
    var hh = hdr ? hdr.offsetHeight : 0
    var start = flow.getBoundingClientRect().top + window.scrollY - hh
    var range = Math.max(1, flow.offsetHeight - (window.innerHeight - hh))
    var k = Math.min(1, Math.max(0, (window.scrollY - start) / range))
    media.style.transform = 'translate3d(0,' + (-extra * k).toFixed(1) + 'px,0)'
  }
  function schedule() {
    if (!raf) raf = requestAnimationFrame(place)
  }

  function apply() {
    if (mq.matches) {
      sorted.forEach(function (el) { media.appendChild(el) })
      if (story) {
        media.classList.add('cs-media--story')
        place()
      }
    } else {
      media.classList.remove('cs-media--story')
      media.style.height = ''
      media.style.transform = ''
      items.forEach(function (el) {
        el.style.top = ''
        el._slot.parentNode.insertBefore(el, el._slot.nextSibling)
      })
    }
  }
  apply()
  if (mq.addEventListener) mq.addEventListener('change', apply)
  else mq.addListener(apply)
  if (story) {
    // текст и картинки меняют высоту (шрифты, загрузка картинок, блок про нейросеть) — пересчитываем места
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(schedule)
      ro.observe(document.querySelector('.cs-flow'))
      items.forEach(function (el) { ro.observe(el) })
    }
    window.addEventListener('resize', schedule)
    var dt = 0
    window.addEventListener('scroll', function () {
      if (!dt) dt = requestAnimationFrame(function () { dt = 0; drift() })
    }, { passive: true })
    window.addEventListener('load', schedule)
  }
})()
