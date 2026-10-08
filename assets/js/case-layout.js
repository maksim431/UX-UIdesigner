// Раскладка страницы кейса. Подключается обычным скриптом в конце <body>, чтобы сработать до первой отрисовки.
// На экранах от 1200px картинки (и блок про нейросеть) уезжают в правую колонку в порядке data-d,
// на планшете и телефоне возвращаются на свои места в тексте.
(function () {
  var media = document.querySelector('.cs-media')
  if (!media) return
  var items = Array.prototype.slice.call(document.querySelectorAll('.cs-flow [data-d]'))
  items.forEach(function (el) {
    var slot = document.createComment('')
    el.parentNode.insertBefore(slot, el)
    el._slot = slot
  })
  var sorted = items.slice().sort(function (a, b) { return a.getAttribute('data-d') - b.getAttribute('data-d') })
  var mq = window.matchMedia('(min-width: 1200px)')
  function apply() {
    if (mq.matches) sorted.forEach(function (el) { media.appendChild(el) })
    else items.forEach(function (el) { el._slot.parentNode.insertBefore(el, el._slot.nextSibling) })
  }
  apply()
  if (mq.addEventListener) mq.addEventListener('change', apply)
  else mq.addListener(apply)
})()
