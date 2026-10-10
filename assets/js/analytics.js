// Статистика посещений: Яндекс Метрика + «этапы» страниц (до какого места человек дошёл).
// Номер счётчика записывает админка (вкладка «статистика»). 0 — статистика выключена.
(function () {
  var COUNTER_ID = 0
  if (!COUNTER_ID) return
  try { if (localStorage.getItem('noTrack') === '1') return } catch (e) {} // визиты владельца сайта не считаем

  ;(function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) }
    m[i].l = 1 * new Date()
    for (var j = 0; j < document.scripts.length; j++) if (document.scripts[j].src === r) return
    k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')
  window.ym(COUNTER_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true })

  // какая это страница
  var me = document.currentScript && document.currentScript.src
  var root = me ? new URL('../../', me).pathname : '/'
  var rel = location.pathname.indexOf(root) === 0 ? location.pathname.slice(root.length) : location.pathname
  rel = rel.replace(/index\.html$/, '')
  var lang = /^en\//.test(rel) ? 'en' : 'ru'
  var r = rel.replace(/^en\//, '')
  var m
  var page = r === '' ? 'first screen' : (m = r.match(/^(product|web)\//)) ? 'главная ' + m[1] : (m = r.match(/^projects\/([^/]+)\//)) ? 'кейс ' + m[1] : r
  var key = page + ' · ' + lang

  var sent = {}
  function stage(label) {
    if (sent[label]) return
    sent[label] = 1
    var p = {}; p[key] = label
    window.ym(COUNTER_ID, 'params', { 'этап': p })
  }
  stage('00 · открыл страницу')

  function seen(el, label) {
    if (!el || !('IntersectionObserver' in window)) return
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { stage(label); io.disconnect() }
    }, { threshold: 0.01, rootMargin: '0px 0px -30% 0px' })
    io.observe(el)
  }
  function pad(n) { return (n < 10 ? '0' : '') + n }

  function setup() {
    // кейс: каждый раздел «Задача», «Аналитика»… и конец страницы
    var secs = document.querySelectorAll('.cs [id^="s"]')
    for (var i = 0; i < secs.length; i++) {
      var h = secs[i].querySelector('h2,h3,h4')
      var n = parseInt(secs[i].id.slice(1), 10)
      if (n) seen(secs[i], pad(n) + ' · ' + (h ? h.textContent.trim().toLowerCase() : secs[i].id))
    }
    seen(document.querySelector('.cs-btns'), '99 · дочитал до конца')

    // главная: блок работ и каждая карточка проекта
    var works = document.getElementById('works')
    if (works) {
      seen(works, '01 · блок «мои работы»')
      var btns = works.querySelectorAll('.ps__nav button')
      var panels = works.querySelectorAll('.ps__panel')
      var mark = function () {
        for (var k = 0; k < btns.length; k++) if (btns[k].getAttribute('aria-current') === 'true') {
          var t = panels[k] && panels[k].querySelector('.ps__title')
          stage(pad(k + 2) + ' · проект ' + (k + 1) + (t ? ': ' + t.textContent.trim() : ''))
        }
      }
      if (btns.length && 'MutationObserver' in window) {
        new MutationObserver(function () { if (works.getBoundingClientRect().top < innerHeight * 0.5) mark() })
          .observe(works, { subtree: true, attributes: true, attributeFilter: ['aria-current'] })
        seen(panels[0], '02 · проект 1' + (panels[0] && panels[0].querySelector('.ps__title') ? ': ' + panels[0].querySelector('.ps__title').textContent.trim() : ''))
      }
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('#works a[href*="projects/"]')
        if (a) stage('98 · открыл кейс')
      })
    }

    // first screen: какую версию выбрал
    var opts = document.querySelectorAll('.fs-opt')
    for (var o = 0; o < opts.length; o++) opts[o].addEventListener('click', function () {
      stage('01 · выбрал ' + (/web\//.test(this.getAttribute('href')) ? 'веб-версию' : 'продуктовую версию'))
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup)
  else setup()
})()
