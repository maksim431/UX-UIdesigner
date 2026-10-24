// Статистика посещений: Яндекс Метрика + «этапы» страниц (до какого места человек дошёл).
// Номер счётчика записывает админка (вкладка «статистика»). 0 — статистика выключена.
// Метрика (cookie, вебвизор) включается только после согласия посетителя — 152-ФЗ «О персональных данных».
(function () {
  var COUNTER_ID = 113740716
  var me = document.currentScript && document.currentScript.src
  var root = me ? new URL('../../', me).pathname : '/'
  var rel = location.pathname.indexOf(root) === 0 ? location.pathname.slice(root.length) : location.pathname
  rel = rel.replace(/index\.html$/, '')
  var lang = /^en\//.test(rel) || document.documentElement.lang === 'en' ? 'en' : 'ru'
  var KEY = 'cookieConsent'
  function getC() { try { return localStorage.getItem(KEY) } catch (e) { return null } }
  function setC(v) { try { localStorage.setItem(KEY, v) } catch (e) {} }

  /* ---------- плашка согласия на cookie ---------- */
  var T = lang === 'en'
    ? { text: 'This site uses cookies to get better.', yes: 'accept', more: 'learn more', label: 'Cookies' }
    : { text: 'Сайт использует cookie для того, чтобы стать лучше.', yes: 'принять', more: 'подробнее', label: 'Cookie' }
  var policy = root + (lang === 'en' ? 'en/' : '') + 'privacy/'
  var bar = null
  function hide() { if (bar) { bar.classList.remove('is-in'); var b = bar; setTimeout(function () { b.hidden = true }, 300) } }
  function show() {
    if (!bar) {
      bar = document.createElement('div')
      bar.className = 'cc'
      bar.setAttribute('role', 'region')
      bar.setAttribute('aria-label', T.label)
      bar.innerHTML = '<p class="cc__t">' + T.text + '</p>' +
        '<div class="cc__b"><button type="button" class="cc__yes">' + T.yes + '</button><a class="cc__no" href="' + policy + '">' + T.more + '</a></div>'
      document.body.appendChild(bar)
      bar.querySelector('.cc__yes').addEventListener('click', function () { setC('yes'); hide(); start() })
    }
    bar.hidden = false
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-in') }) })
  }
  // кнопка «настройки cookie» в подвале
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-cookie-settings]')
    if (b) { e.preventDefault(); show() }
  })
  function boot() {
    var c = getC()
    if (c === 'yes') start()
    else if (c !== 'no') show()
  }
  if (document.body) boot()
  else document.addEventListener('DOMContentLoaded', boot)

  var started = false
  function start() {
  if (started || !COUNTER_ID) return
  started = true
  try { if (localStorage.getItem('noTrack') === '1') return } catch (e) {} // визиты владельца сайта не считаем

  ;(function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) }
    m[i].l = 1 * new Date()
    for (var j = 0; j < document.scripts.length; j++) if (document.scripts[j].src === r) return
    k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')
  window.ym(COUNTER_ID, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true })

  // какая это страница
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

    // версия для клиентов: до какого блока дочитали
    ;[['tasks', '10 · задачи'], ['results', '20 · результаты'], ['reviews', '30 · отзывы'], ['audit', '35 · бесплатный разбор'], ['process', '40 · как проходит работа'],
      ['prices', '50 · цены'], ['terms', '60 · условия'], ['compare', '65 · сравнение'], ['about', '70 · обо мне'], ['faq', '75 · вопросы'], ['contact', '85 · финальный призыв']]
      .forEach(([id, label]) => seen(document.getElementById(id), label))

    // блок «другие проекты»
    seen(document.getElementById('other'), '90 · блок «другие проекты»')
    seen(document.getElementById('end'), '95 · дошёл до конца страницы')

    // first screen: какую версию выбрал
    var opts = document.querySelectorAll('.fs-opt')
    for (var o = 0; o < opts.length; o++) opts[o].addEventListener('click', function () {
      stage('01 · выбрал ' + (/web\//.test(this.getAttribute('href')) ? 'веб-версию' : 'продуктовую версию'))
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup)
  else setup()
  }
})()
