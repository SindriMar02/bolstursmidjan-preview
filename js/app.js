/* Bólstursmiðjan prototype. GSAP + ScrollTrigger, Lenis on fine pointers only.
   Every scroll reveal is position-tied (scrub) or a short scrubbed band, never a fixed duration.
   Reduced motion = a plain render branch (html.no-motion), no Lenis, no pins, everything visible. */
(() => {
  'use strict'
  const $ = (s, c = document) => c.querySelector(s)
  const $$ = (s, c = document) => [...c.querySelectorAll(s)]
  const root = document.documentElement
  const body = document.body
  const G = window.gsap
  const ST = window.ScrollTrigger
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const motion = !reduce && !!G && !!ST
  const home = body.classList.contains('pg-home')
  const wall = body.classList.contains('pg-wall')
  const BM = window.BM || {}
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const q = new URLSearchParams(location.search)
  if (!motion) root.classList.add('no-motion')
  if (motion) { G.registerPlugin(ST); ST.config({ ignoreMobileResize: true }) }
  let lenis = null
  const barH = () => (innerWidth < 900 ? 106 : 72)

  /* ---------------- smooth scroll (desktop only) ---------------- */
  if (motion && !touch && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true })
    window.__lenis = lenis
    lenis.on('scroll', ST.update)
    G.ticker.add((t) => lenis.raf(t * 1000))
    G.ticker.lagSmoothing(0)
  }
  const scrollToEl = (el, off = 0) => {
    const y = el.getBoundingClientRect().top + scrollY - barH() - 8 + off
    if (lenis) lenis.scrollTo(y, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) })
    else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' })
  }
  const lockScroll = (on) => { if (lenis) (on ? lenis.stop() : lenis.start()) }

  /* ---------------- header: tone, past-hero state, dropdowns, menu ---------------- */
  const bar = $('#bar')
  if (wall) body.classList.add('is-past')
  if (home) {
    const hero = $('.hero')
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        body.classList.toggle('is-past', !e.isIntersecting && e.boundingClientRect.top < 0)
      }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 }).observe(hero)
    }
  }
  const closeDD = () => $$('.nv__b[aria-expanded=true]').forEach((b) => b.setAttribute('aria-expanded', 'false'))
  $$('.nv__b').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = b.getAttribute('aria-expanded') === 'true'
    closeDD(); b.setAttribute('aria-expanded', String(!open))
  }))
  document.addEventListener('click', (e) => { if (!e.target.closest('.nv')) closeDD() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDD(); closeMenu() } })

  const burger = $('.burger'); const menu = $('#menu')
  let menuY = 0
  function openMenu() {
    menuY = scrollY; menu.hidden = false
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Loka valmynd')
    body.style.position = 'fixed'; body.style.top = `-${menuY}px`; body.style.left = '0'; body.style.right = '0'
  }
  function closeMenu() {
    if (!menu || menu.hidden) return
    menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Opna valmynd')
    body.style.position = ''; body.style.top = ''; body.style.left = ''; body.style.right = ''; scrollTo(0, menuY)
  }
  if (burger) {
    burger.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()))
    if (q.get('menu') === '1') setTimeout(openMenu, 400)
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu() })
  }

  /* ---------------- anchors ---------------- */
  function openService(k, scroll) {
    const item = $(`#thjonusta-${k}`); if (!item) return
    setService(item, true)
    if (scroll) {
      requestAnimationFrame(() => scrollToEl(item))
      setTimeout(() => { if (Math.abs(item.getBoundingClientRect().top - (barH() + 8)) > 8) scrollToEl(item) }, 680)
      if (motion) setTimeout(() => ST.refresh(), 700)
    }
  }
  function goHash(h, instant) {
    if (!h || h.length < 2) return
    const id = decodeURIComponent(h.slice(1))
    if (id.startsWith('thjonusta-')) return openService(id.slice(10), true)
    const el = document.getElementById(id)
    if (el) instant ? scrollTo(0, el.getBoundingClientRect().top + scrollY - barH() - 8) : scrollToEl(el)
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]'); if (!a || !home) return
    const u = new URL(a.href, location.href)
    if (u.pathname !== location.pathname || !u.hash) return
    if (a.matches('[data-svc-cta]')) return
    e.preventDefault(); history.pushState(null, '', u.hash)
    if (u.hash === '#top') return void (lenis ? lenis.scrollTo(0, { duration: 1.2 }) : scrollTo({ top: 0, behavior: 'smooth' }))
    goHash(u.hash)
  })

  /* ---------------- enquiry basket (the tufted + button) ---------------- */
  const store = {
    get() { try { return JSON.parse(sessionStorage.getItem('bm-basket') || '[]') } catch { return [] } },
    set(v) { try { sessionStorage.setItem('bm-basket', JSON.stringify(v)) } catch { /* private mode */ } },
  }
  let fabricChoice = null
  try { fabricChoice = JSON.parse(sessionStorage.getItem('bm-fabric') || 'null') } catch { /* */ }
  function syncBasket(bump) {
    const items = store.get()
    $$('[data-add]').forEach((b) => b.setAttribute('aria-pressed', String(items.some((i) => i.id === b.dataset.add))))
    $$('.cnt').forEach((c) => {
      c.hidden = !items.length; c.textContent = items.length
      if (bump && items.length) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump') }
    })
    const box = $('[data-picked]'); if (box) {
      box.hidden = !items.length
      const ul = $('ul', box); ul.innerHTML = ''
      items.forEach((i) => {
        const li = document.createElement('li')
        li.innerHTML = `<span></span><button type="button" aria-label="Fjarlægja"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button>`
        $('span', li).textContent = i.title
        $('button', li).addEventListener('click', () => { store.set(store.get().filter((x) => x.id !== i.id)); syncBasket() })
        ul.append(li)
      })
    }
  }
  function toggleAdd(id, title) {
    const items = store.get(); const has = items.some((i) => i.id === id)
    store.set(has ? items.filter((i) => i.id !== id) : [...items, { id, title }])
    syncBasket(!has)
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return
    e.preventDefault(); toggleAdd(b.dataset.add, b.dataset.title)
  })
  syncBasket()

  /* ---------------- text splitting ---------------- */
  function splitWords(el, mask = true) {
    if (el.dataset.done) return $$('.w>span, .sw2', el)
    el.dataset.done = '1'
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment()
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return
            if (/^\s+$/.test(t)) return frag.append(t)
            const w = document.createElement('span')
            if (mask) { w.className = 'w'; const s = document.createElement('span'); s.textContent = t; w.append(s) } else { w.className = 'sw2'; w.textContent = t }
            frag.append(w)
          })
          n.replaceWith(frag)
        } else if (n.nodeType === 1) walk(n)
      })
    }
    walk(el)
    return mask ? $$('.w>span', el) : $$('.sw2', el)
  }

  /* ---------------- hero ---------------- */
  function measureWord() {
    const word = $('[data-word]'); if (!word) return
    const h1 = word.parentElement
    const prev = h1.style.fontSize
    h1.style.fontSize = '100px'; h1.style.whiteSpace = 'nowrap'
    const w1 = $('.w1', word); const w2 = $('.w2', word)
    const a = w1.getBoundingClientRect().width; const b = w2.getBoundingClientRect().width
    const full = word.getBoundingClientRect().width
    h1.style.fontSize = prev; h1.style.whiteSpace = ''
    root.style.setProperty('--k', (full / 100 * 1.006).toFixed(3))
    root.style.setProperty('--k2', (Math.max(a, b) / 100 * 1.02).toFixed(3))
  }
  function splitChars() {
    $$('[data-word] .w1, [data-word] .w2').forEach((part) => {
      const t = part.textContent; part.textContent = ''
      ;[...t].forEach((c) => {
        const o = document.createElement('span'); o.className = 'cw'
        const i = document.createElement('span'); i.className = 'ch'; i.textContent = c
        o.append(i); part.append(o)
      })
    })
  }
  const HERO = BM.hero || []
  function setFootH() {
    const hero = $('.hero'); const f = $('.hero__foot'); if (hero && f) hero.style.setProperty('--foot-h', f.offsetHeight + 'px')
  }
  function initHero() {
    const hero = $('.hero'); if (!hero) return
    const chairs = $$('.chair', hero); const picks = $$('.hero__pick button', hero)
    const lab = $('.hero__lab', hero); const chars = $$('.ch', hero)
    let cur = 0
    const tone = (i) => {
      const p = HERO[i]; if (!p) return
      hero.dataset.tone = p.tone
      body.style.setProperty('--hero-fg', p.tone === 'light' ? '#1b1a18' : '#f3ece3')
      body.style.setProperty('--hero-bg', p.stage)
    }
    tone(0)
    setFootH()
    function select(i, instant) {
      if (i === cur) return
      const p = HERO[i]; const inn = chairs[i]
      picks.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)))
      lab.textContent = p.label
      if (!motion || instant) {
        chairs.forEach((c) => c.classList.toggle('is-on', c === inn)); hero.style.backgroundColor = p.stage; tone(i); cur = i; return
      }
      cur = i
      /* interruptible: every other piece leaves from wherever it is, the new one enters, nothing waits for anything */
      chairs.forEach((c) => {
        if (c === inn || !c.classList.contains('is-on')) return
        G.to(c, { y: '7%', rotate: -2.5, opacity: 0, duration: 0.32, ease: 'power2.in', overwrite: true, onComplete: () => { c.classList.remove('is-on'); G.set(c, { clearProps: 'transform,opacity' }) } })
      })
      G.to(hero, { backgroundColor: p.stage, duration: 0.8, ease: 'power3.inOut', overwrite: 'auto' })
      G.delayedCall(0.18, () => { if (cur === i) tone(i) })
      inn.classList.add('is-on')
      G.fromTo(inn, { y: '10%', rotate: 2, scale: 0.96, opacity: 0 }, { y: 0, rotate: 0, scale: 1, opacity: 1, duration: 0.85, ease: 'expo.out', delay: 0.1, overwrite: true })
      G.fromTo(chars, { yPercent: 22, opacity: 0.35 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.012, delay: 0.08, overwrite: 'auto' })
    }
    picks.forEach((b, i) => {
      b.addEventListener('click', () => select(i))
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); picks[(i + 1) % picks.length].focus(); select((i + 1) % picks.length) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const j = (i - 1 + picks.length) % picks.length; picks[j].focus(); select(j) }
      })
    })
    if (!motion) return
    /* entrance */
    const lead = $$('.hero__lead > *', hero); const pick = $('.hero__pick', hero)
    G.set(chars, { yPercent: 112 })
    G.set(chairs[0], { y: '14%', rotate: 1.6, scale: 0.97, opacity: 0 })
    G.set(lead, { y: 26, opacity: 0 }); G.set(pick, { y: 16, opacity: 0 })
    G.set($$('.bar__in > *'), { y: -14, opacity: 0 })
    root.classList.add('hero-in')
    const tl = G.timeline({ defaults: { ease: 'expo.out' } })
    tl.fromTo(hero, { clipPath: 'inset(100% 0% 0% 0% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 0.95, ease: 'power4.inOut' }, 0)
      .to(chars, { yPercent: 0, duration: 1.05, stagger: 0.025 }, 0.35)
      .to(chairs[0], { y: 0, rotate: 0, scale: 1, opacity: 1, duration: 1.2 }, 0.45)
      .to(lead, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07 }, 0.75)
      .to(pick, { y: 0, opacity: 1, duration: 0.8 }, 0.9)
      .to($$('.bar__in > *'), { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, clearProps: 'transform,opacity' }, 0.6)
      .add(() => G.set([hero, ...lead, pick, chairs[0]], { clearProps: 'clipPath' }), '>')
    /* leave: the card recedes, the word runs ahead of the chair */
    const leave = G.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    leave.to('.hero__word', { yPercent: -16, ease: 'none' }, 0)
      .to('.hero__stage', { yPercent: 6, scale: 0.96, ease: 'none' }, 0)
      .to('.hero__foot', { opacity: 0, y: -30, ease: 'none' }, 0)
      .to(hero, { scale: 0.965, ease: 'none', transformOrigin: '50% 100%' }, 0)
    /* pointer: the piece leans toward the cursor */
    if (fine) {
      const stage = $('.hero__stage'); const qx = G.quickTo(stage, 'x', { duration: 1.2, ease: 'power3' }); const qw = G.quickTo('.hero__word', 'x', { duration: 1.6, ease: 'power3' })
      hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width - 0.5; qx(nx * -16); qw(nx * 10) })
    }
  }

  /* ---------------- headings: masked words, scrubbed over a short band ---------------- */
  function initSplit() {
    if (!motion) return
    $$('[data-split]').forEach((el) => {
      const words = splitWords(el, true); if (!words.length) return
      G.fromTo(words, { yPercent: 118 }, {
        yPercent: 0, ease: 'none', stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 64%', scrub: true },
      })
    })
    $$('.sec > .wrap').forEach((w) => ST.create({ trigger: w, start: 'top 88%', once: true, onEnter: () => w.classList.add('is-in') }))
  }

  /* ---------------- works: FLIP filter ---------------- */
  function initFilter(list, itemSel, tabsEl, opts = {}) {
    const items = $$(itemSel, list); if (!items.length || !tabsEl) return
    const tabs = $$('[role=tab]', tabsEl)
    let key = 'allt'
    const big = items.find((i) => i.classList.contains('tile--big'))
    function apply(k, fromHash) {
      if (k === key && !fromHash) return
      const prevKey = key; key = k
      tabs.forEach((t) => { const on = t.dataset.f === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1 })
      const match = (it) => k === 'allt' || it.dataset.cat === k
      if (!motion || !opts.flip) {
        items.forEach((it) => it.classList.toggle('is-out', !match(it)))
        if (big) big.classList.toggle('tile--big', k === 'allt')
        if (motion) G.fromTo(items.filter(match), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.025, ease: 'expo.out', clearProps: 'all' })
        ST.refresh && ST.refresh()
        return
      }
      const before = new Map(items.filter((i) => !i.classList.contains('is-out')).map((i) => [i, i.getBoundingClientRect()]))
      items.forEach((it) => it.classList.toggle('is-out', !match(it)))
      if (big) big.classList.toggle('tile--big', k === 'allt')
      const stay = []; const fresh = []
      items.filter(match).forEach((it) => {
        const b = before.get(it); const a = it.getBoundingClientRect()
        if (b) stay.push([it, b, a]); else fresh.push(it)
      })
      stay.forEach(([it, b, a]) => G.fromTo(it, { x: b.left - a.left, y: b.top - a.top, scale: b.width / a.width || 1, transformOrigin: '0 0' }, { x: 0, y: 0, scale: 1, duration: 0.65, ease: 'expo.out', clearProps: 'transform' }))
      G.fromTo(fresh, { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out', stagger: 0.04, delay: 0.08, clearProps: 'transform,opacity' })
      G.delayedCall(0.8, () => ST.refresh())
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { apply(t.dataset.f); history.replaceState(null, '', wall ? '#' + t.dataset.f : location.pathname + location.search + location.hash) })
      t.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return
        e.preventDefault(); const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[j].focus(); apply(tabs[j].dataset.f)
      })
    })
    return apply
  }

  function initWorksReveal() {
    if (!motion) return
    $$('.tile').forEach((li, i) => {
      const box = $('.tile__box', li); const cap = $('.tile__cap', li)
      const dist = 56 + (i % 4) * 26
      G.fromTo([box, cap].filter(Boolean), { y: dist, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: li, start: 'top 98%', end: 'top 70%', scrub: true } })
    })
  }

  /* ---------------- fabric panel ---------------- */
  function mixHex(hex, t) {
    const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); const base = [250, 250, 248]
    return '#' + p.map((v, i) => Math.round(base[i] * (1 - t) + v * t).toString(16).padStart(2, '0')).join('')
  }
  function initFabric() {
    const panel = $('.fabric__panel'); if (!panel) return
    const strip = $('.sw', panel); const items = $$('.sw__i', panel); const res = $('[data-res]', panel)
    const sw = BM.swatches || []
    function render(k, explicit) {
      const s = sw.find((x) => x.k === k)
      items.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.k === k)))
      panel.style.setProperty('--wash', s ? mixHex(s.c, 0.2) : '#ecebe7')
      res.innerHTML = ''
      if (!s) { res.innerHTML = '<p class="fabric__hint">Veldu lit til að sjá verk í honum.</p>'; fabricChoice = null; sessionStorage.removeItem('bm-fabric'); syncFab(); return }
      if (explicit) {
        fabricChoice = { k: s.k, n: s.n }
        try { sessionStorage.setItem('bm-fabric', JSON.stringify(fabricChoice)) } catch { /* */ }
      }
      const t = document.createElement('p'); t.className = 'fabric__t'; t.innerHTML = `Verk í þessum lit <span></span>`; $('span', t).textContent = '(' + s.n.toLowerCase() + ')'; res.append(t)
      const made = s.pieces.map((ref) => {
        const [kind, id] = ref.split(':')
        const a = document.createElement('a'); a.className = 'res' + (kind === 'c' ? ' cut' : ''); a.href = `verk/#${id}`
        const meta = kind === 'c' ? BM.cuts[id] : BM.photos[id]
        a.setAttribute('aria-label', (meta && meta.t) || id)
        if (kind === 'c') a.style.setProperty('--tint', meta.tint)
        const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.src = `assets/img/${kind === 'c' ? 'cut' : 'photo'}/${id}.webp`
        a.append(img); res.append(a); return a
      })
      if (motion) G.from(made, { y: 26, opacity: 0, scale: 0.94, duration: 0.9, ease: 'expo.out', stagger: 0.07 })
      syncFab()
    }
    items.forEach((b) => b.addEventListener('click', () => { if (strip.dataset.moved) return; render(b.getAttribute('aria-checked') === 'true' ? null : b.dataset.k, true) }))
    items.forEach((b, i) => b.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return
      e.preventDefault(); const j = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, items.length - 1); items[j].focus(); items[j].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }))
    /* mouse drag; touch uses native scroll */
    let down = false; let sx = 0; let sl = 0
    strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = strip.scrollLeft; delete strip.dataset.moved })
    addEventListener('pointermove', (e) => {
      if (!down) return; const dx = e.clientX - sx
      if (Math.abs(dx) > 4) { strip.classList.add('is-drag'); strip.dataset.moved = '1' }
      strip.scrollLeft = sl - dx
    })
    addEventListener('pointerup', () => { if (!down) return; down = false; strip.classList.remove('is-drag'); setTimeout(() => delete strip.dataset.moved, 30) })
    if (motion) {
      G.from(items, { y: 60, opacity: 0, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: strip, start: 'top 96%', end: 'top 62%', scrub: true } })
    }
    const cta = $('[data-fab-cta]'); if (cta) cta.addEventListener('click', () => { const r = $('input[name=fabric][value=velja]'); if (r && fabricChoice) r.checked = true; syncFab() })
    const first = fabricChoice && sw.find((x) => x.k === fabricChoice.k) ? fabricChoice.k : sw[0] && sw[0].k
    if (first) render(first, false)
  }
  function syncFab() {
    const p = $('[data-fabpick]'); if (!p) return
    if (fabricChoice) { p.hidden = false; p.textContent = 'Valinn litur: ' + fabricChoice.n.toLowerCase() } else p.hidden = true
  }

  /* ---------------- services accordion ---------------- */
  function setService(item, open) {
    const list = $$('.acc__i')
    list.forEach((it) => {
      const on = it === item ? open : false
      it.classList.toggle('is-open', on)
      $('button', it).setAttribute('aria-expanded', String(on))
    })
    if (open) showSvcImg(item.dataset.k)
  }
  function showSvcImg(k) {
    const next = $(`.svc__img[data-k="${k}"]`); const prev = $('.svc__img.is-on')
    if (!next || next === prev) return
    $$('.svc__img.was').forEach((e) => e.classList.remove('was'))
    if (prev) { prev.classList.remove('is-on'); prev.classList.add('was') }
    next.classList.add('is-on')
    setTimeout(() => prev && prev.classList.remove('was'), 1250)
  }
  function holdPosition(el, ms) {
    const t0 = el.getBoundingClientRect().top; const end = performance.now() + ms
    const step = () => {
      const d = el.getBoundingClientRect().top - t0
      if (Math.abs(d) > 0.5) { if (lenis) lenis.scrollTo(lenis.scroll + d, { immediate: true }); else scrollBy(0, d) }
      if (performance.now() < end) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    if (motion) setTimeout(() => ST.refresh(), ms + 40)
  }
  function initAccordion() {
    $$('.acc__i').forEach((it) => $('button', it).addEventListener('click', () => { holdPosition($('button', it), 620); setService(it, !it.classList.contains('is-open')) }))
    $$('.dd [data-svc], .menu a[href*="thjonusta-"]').forEach((a) => a.addEventListener('click', (e) => {
      if (!home) return
      e.preventDefault(); const k = (a.getAttribute('href').match(/thjonusta-([a-z]+)/) || [])[1]; history.pushState(null, '', '#thjonusta-' + k); openService(k, true)
    }))
    $$('[data-svc-cta]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); history.pushState(null, '', '#fyrirspurn'); scrollToEl($('#fyrirspurn'))
    }))
  }

  /* ---------------- before / after: a circle of fabric opens from the control ---------------- */
  function initBA() {
    const stage = $('[data-ba]'); if (!stage) return
    const pairs = $$('.ba__pair', stage); const btns = $$('.ba__list button'); const ctl = $('.ba__ctl', stage); const sw = $$('.ba__ctl button', stage)
    let cur = pairs[0]; let auto = null
    const paint = (s) => { ctl.dataset.s = s; sw.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === s))) }
    function setState(s, animate = true, pair = cur) {
      paint(s)
      const a = $('.ba__a', pair); const target = s === 'eftir' ? '150%' : '0%'
      if (!motion || !animate) return void a.style.setProperty('--rad', target)
      G.killTweensOf(a)
      G.to(a, { '--rad': target, duration: s === 'eftir' ? 0.95 : 0.6, ease: s === 'eftir' ? 'expo.out' : 'power3.inOut' })
    }
    function pick(k) {
      const next = pairs.find((p) => p.dataset.k === k); if (!next || next === cur) return
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)))
      cur.classList.remove('is-on'); next.classList.add('is-on')
      $('.ba__a', next).style.setProperty('--rad', '0%'); cur = next
      paint('fyrir'); clearTimeout(auto); auto = setTimeout(() => setState('eftir'), 750)
    }
    btns.forEach((b) => b.addEventListener('click', () => pick(b.dataset.k)))
    sw.forEach((b) => b.addEventListener('click', () => { clearTimeout(auto); setState(b.dataset.s) }))
    pairs.forEach((p) => $('.ba__a', p).style.setProperty('--rad', '0%'))
    if (!motion) { setState('eftir', false); return }
    paint('fyrir')
    ST.create({ trigger: stage, start: 'top 68%', once: true, onEnter: () => { auto = setTimeout(() => setState('eftir'), 500) } })
    G.fromTo(stage, { clipPath: 'inset(8% 6% 0% 6% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', ease: 'none', scrollTrigger: { trigger: stage.parentElement, start: 'top 96%', end: 'top 55%', scrub: true } })
  }

  /* ---------------- build story: native sticky, scrubbed by position ---------------- */
  function initFlow() {
    const flow = $('.flow'); if (!flow || !motion) return
    const imgs = $$('.flow__img', flow); const lis = $$('.flow__list li', flow); const bar = $('.flow__bar span', flow); const n = imgs.length
    lis[0].classList.add('is-on')
    ST.create({
      trigger: flow, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: (s) => {
        const p = clamp((s.progress - 0.05) / 0.9); const qv = p * (n - 1)
        imgs.forEach((im, i) => {
          if (i === 0) { im.style.transform = `scale(${1 + qv * 0.02})`; return }
          const r = clamp(qv - (i - 1))
          im.style.clipPath = `inset(${((1 - r) * 100).toFixed(2)}% 0 0 0)`
          im.style.transform = `scale(${(1 + (1 - r) * 0.1).toFixed(4)})`
          im.style.zIndex = i
        })
        const act = Math.min(n - 1, Math.round(qv))
        lis.forEach((li, i) => li.classList.toggle('is-on', i === act))
        bar.style.transform = `scaleX(${p.toFixed(4)})`
      },
    })
    imgs.forEach((im, i) => { if (i) { im.style.clipPath = 'inset(100% 0 0 0)'; im.style.zIndex = i } })
  }

  /* ---------------- headboards, about, video ---------------- */
  function initHeads() {
    if (!motion) return
    $$('.ph').forEach((ph) => {
      const inn = $('.ph__in', ph); const im = $('img', ph)
      G.fromTo(inn, { clipPath: 'inset(14% 8% 0% 8% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', ease: 'none', scrollTrigger: { trigger: ph, start: 'top 96%', end: 'top 46%', scrub: true } })
      G.fromTo(im, { yPercent: -4, scale: 1.08 }, { yPercent: 4, scale: 1, ease: 'none', scrollTrigger: { trigger: ph, start: 'top bottom', end: 'bottom top', scrub: true } })
    })
  }
  function initAbout() {
    const lead = $('[data-scrub]'); if (!lead || !motion) return
    const words = splitWords(lead, false)
    G.set(words, { opacity: 0.16 })
    G.to(words, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 46%', scrub: true } })
    const c = $('.duo__c'); if (c) G.fromTo(c, { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.duo', start: 'top 70%', end: 'center 42%', scrub: true } })
    G.fromTo('.duo__in', { clipPath: 'inset(10% 8% 0% 8% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', ease: 'none', scrollTrigger: { trigger: '.duo', start: 'top 96%', end: 'top 50%', scrub: true } })
    $$('.facts dd').forEach((dd) => {
      const target = parseInt(dd.textContent, 10); const o = { v: target - 26 }
      G.to(o, { v: target, ease: 'none', onUpdate: () => (dd.textContent = Math.round(o.v)), scrollTrigger: { trigger: dd, start: 'top 94%', end: 'top 62%', scrub: true } })
    })
  }
  function initVideo() {
    const f = $('[data-yt]'); if (!f) return
    $('.vid__play', f).addEventListener('click', () => {
      const ifr = document.createElement('iframe')
      ifr.src = `https://www.youtube-nocookie.com/embed/${f.dataset.yt}?autoplay=1&rel=0&playsinline=1`
      ifr.title = 'Stóllinn, myndband frá Bólstursmiðjunni'; ifr.allow = 'autoplay; encrypted-media; picture-in-picture'; ifr.allowFullscreen = true
      f.replaceChildren(ifr)
    })
  }

  /* ---------------- thread ---------------- */
  function initThread() {
    const t = $('.thread'); if (!t || !motion || innerWidth < 1180) return
    const line = $('.thread__l', t); const dot = $('i', t)
    ST.create({ start: 0, end: 'max', onUpdate: (st) => {
      line.style.transform = 'translate3d(0,' + (-((st.scroll() * 0.55) % 16)).toFixed(2) + 'px,0)'
      dot.style.transform = 'translate3d(0,' + (st.progress * (innerHeight - 10)).toFixed(1) + 'px,0)'
    } })
  }

  /* ---------------- request form ---------------- */
  function initForm() {
    const form = $('#req'); if (!form) return
    const done = $('.done'); const errBox = $('.form__err', form)
    const files = []
    const branches = $$('[data-branch]', form)
    const setBranch = () => {
      const v = form.elements.type.value
      branches.forEach((b) => (b.hidden = b.dataset.branch !== v))
      $('#f-desc').placeholder = v === 'sersmidi' ? 'Til dæmis: bekkur í horn, 240 x 60 cm, með geymslu' : 'Til dæmis: stóll frá 1960, áklæðið er slitið'
    }
    $$('input[name=type]', form).forEach((r) => r.addEventListener('change', setBranch)); setBranch()
    const unk = form.elements.sizeUnknown; unk.addEventListener('change', () => { form.elements.size.disabled = unk.checked; if (unk.checked) form.elements.size.value = '' })
    $$('input[name=fabric]', form).forEach((r) => r.addEventListener('change', syncFab)); syncFab()

    /* uploads */
    const up = $('[data-up]', form); const input = $('input[type=file]', up); const list = $('.up__l', up); const uerr = $('.up__e', up)
    const MAX = 8; const MB = 10
    const say = (m) => { uerr.hidden = !m; uerr.textContent = m || '' }
    function addFiles(fl) {
      say('')
      const msgs = []
      ;[...fl].forEach((f) => {
        if (!f.type.startsWith('image/')) return msgs.push(`${f.name}: aðeins myndir eru leyfðar.`)
        if (f.size > MB * 1048576) return msgs.push(`${f.name}: skráin er stærri en ${MB} MB.`)
        if (files.length >= MAX) return msgs.push(`Hámark er ${MAX} myndir.`)
        const item = { f, url: URL.createObjectURL(f), pct: 0, fail: q.get('fixture') === 'upload-fail' && files.length === 1 }
        files.push(item); renderFile(item)
      })
      if (msgs.length) say([...new Set(msgs)].join(' '))
      input.value = ''
    }
    function renderFile(item) {
      const li = document.createElement('li')
      li.innerHTML = `<div class="up__th"><img alt=""><i><b></b></i></div><button type="button" class="up__x" aria-label="Fjarlægja mynd"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button><span class="up__n"></span>`
      $('img', li).src = item.url; $('.up__n', li).textContent = item.f.name
      $('.up__x', li).addEventListener('click', () => { files.splice(files.indexOf(item), 1); li.remove(); URL.revokeObjectURL(item.url); say('') })
      list.append(li)
      const b = $('b', li); let p = 0
      const iv = setInterval(() => {
        p += 12 + Math.random() * 14
        if (item.fail && p > 60) { clearInterval(iv); b.style.width = '60%'; $('.up__n', li).textContent = 'Mistókst, reyndu aftur'; $('.up__n', li).style.color = 'var(--accent-ink)'; return }
        if (p >= 100) { p = 100; clearInterval(iv) }
        b.style.width = p + '%'
      }, 90)
    }
    input.addEventListener('change', () => addFiles(input.files))
    ;['dragenter', 'dragover'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add('is-over') }))
    ;['dragleave', 'drop'].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.remove('is-over') }))
    up.addEventListener('drop', (e) => addFiles(e.dataTransfer.files))

    /* validate + submit (local only) */
    const bad = (name, msg) => {
      const fld = form.elements[name].closest('.fld'); fld.classList.add('is-bad')
      const e = document.createElement('p'); e.className = 'err'; e.id = 'err-' + name; e.textContent = msg; fld.append(e)
      form.elements[name].setAttribute('aria-describedby', e.id); form.elements[name].setAttribute('aria-invalid', 'true')
    }
    let sending = false
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      $$('.fld.is-bad', form).forEach((f) => { f.classList.remove('is-bad'); $('.err', f)?.remove(); $$('[aria-invalid]', f).forEach((i) => { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby') }) })
      errBox.hidden = true
      const v = (n) => form.elements[n].value.trim()
      let first = null
      if (!v('name')) { bad('name', 'Skrifaðu nafn.'); first ||= form.elements.name }
      if (!v('email')) { bad('email', 'Skrifaðu netfang svo við getum svarað.'); first ||= form.elements.email }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) { bad('email', 'Netfangið virðist ekki rétt. Dæmi: nafn@dæmi.is'); first ||= form.elements.email }
      if (first) { errBox.textContent = 'Það vantar upplýsingar. Lagaðu reitina sem eru merktir hér fyrir neðan.'; errBox.hidden = false; first.focus(); return }
      if (files.some((f) => f.fail)) { errBox.textContent = 'Ein mynd hlóðst ekki upp. Fjarlægðu hana eða veldu hana aftur.'; errBox.hidden = false; return }
      if (sending) return
      const btn = $('button[type=submit]', form); const lab = $('span', btn); const old = lab.textContent
      sending = true; btn.setAttribute('aria-busy', 'true'); lab.textContent = 'Sendi…'
      setTimeout(() => {
        sending = false; btn.removeAttribute('aria-busy'); lab.textContent = old
        if (q.get('fixture') === 'fail') { errBox.textContent = 'Ekki tókst að senda fyrirspurnina. Textinn þinn er enn hér, reyndu aftur eftir smá stund.'; errBox.hidden = false; return }
        showDone()
      }, 800)
    })
    function showDone() {
      const type = form.elements.type.value === 'sersmidi' ? 'Ný sérsmíði' : 'Endurbólstrun'
      const d = new Date(); const ref = 'BM-' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(Math.floor(1000 + Math.random() * 9000))
      const fab = { eigid: 'Á áklæði sjálf/ur', velja: 'Vill velja áklæði með ykkur', 'veit-ekki': 'Veit ekki enn' }[form.elements.fabric.value]
      const lines = [
        `Tegund: ${type}`,
        form.elements.type.value === 'endurbolstrun' ? `Hlutur: ${v2('piece') || 'ekki tilgreint'}${v2('qty') ? ' (' + v2('qty') + ' stk.)' : ''}` : `Fyrir: ${v2('use') || 'ekki tilgreint'}`,
        `Lýsing: ${v2('desc') || 'engin'}`,
        `Stærð: ${form.elements.sizeUnknown.checked ? 'veit ekki' : v2('size') || 'ekki tilgreint'}`,
        `Áklæði: ${fab}${fabricChoice ? ' (' + fabricChoice.n.toLowerCase() + ')' : ''}`,
        `Myndir: ${files.length ? files.map((f) => f.f.name).join(', ') : 'engar'}`,
        `Valin verk: ${store.get().map((i) => i.title).join(', ') || 'engin'}`,
        `Hvenær: ${v2('when')}`,
        '',
        `${v2('name')}${v2('phone') ? ' · ' + v2('phone') : ''}`,
        `${v2('email')}${v2('where') ? ' · ' + v2('where') : ''}`,
      ]
      $('.done__ref', done).textContent = 'Númer fyrirspurnar: ' + ref
      $('.done__brief', done).textContent = lines.join('\n')
      form.hidden = true; done.hidden = false; done.focus({ preventScroll: true })
      /* the form just vanished and the document got shorter: jump (no smooth scroll to a stale target) */
      const y = $('#fyrirspurn').getBoundingClientRect().top + scrollY - barH() - 8
      if (lenis) lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y)
      if (motion) setTimeout(() => ST.refresh(), 60)
    }
    const v2 = (n) => (form.elements[n] ? String(form.elements[n].value).trim() : '')
    $('[data-again]', done).addEventListener('click', () => { form.reset(); files.splice(0).forEach((f) => URL.revokeObjectURL(f.url)); list.innerHTML = ''; store.set([]); syncBasket(); setBranch(); form.elements.size.disabled = form.elements.sizeUnknown.checked; done.hidden = true; form.hidden = false })
  }

  /* ---------------- wall page: filter + lightbox ---------------- */
  function initWall() {
    const list = $('#masonry'); if (!list) return
    const apply = initFilter(list, '.wc', $('.tabs--wrap'), { flip: false })
    const lb = $('#lb'); const items = $$('.wc', list)
    let idx = -1; let opener = null
    const visible = () => items.filter((i) => !i.classList.contains('is-out'))
    function open(id, from) {
      const vis = visible(); idx = vis.findIndex((i) => i.dataset.id === id); if (idx < 0) { apply('allt', true); idx = items.findIndex((i) => i.dataset.id === id); if (idx < 0) return }
      opener = from || document.activeElement
      show(visible()[idx]); lb.hidden = false; lockScroll(true); body.style.overflow = 'hidden'; $('.lb__x', lb).focus()
    }
    function show(li) {
      const id = li.dataset.id; const isCut = li.classList.contains('wc--cut')
      const box = $('.lb__img', lb); box.className = 'lb__img' + (isCut ? ' cut' : '')
      box.style.background = isCut ? `color-mix(in srgb, ${getComputedStyle(li).getPropertyValue('--tint')} 60%, #f6f5f3)` : ''
      box.innerHTML = ''; const im = new Image(); im.alt = $('img', li).alt; im.src = $('img', li).currentSrc || $('img', li).src; box.append(im)
      $('.lb__t', lb).textContent = $('.wc__t', li).textContent
      const add = $('.lb__add', lb); add.dataset.add = id; add.dataset.title = $('.wc__t', li).textContent
      const on = store.get().some((i) => i.id === id); $('span', add).textContent = on ? 'Fjarlægja úr fyrirspurn' : 'Bæta við fyrirspurn'; add.setAttribute('aria-pressed', String(on))
      history.replaceState(null, '', '#' + id)
      if (motion) G.fromTo(im, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' })
    }
    function close() {
      lb.hidden = true; lockScroll(false); body.style.overflow = ''
      history.replaceState(null, '', location.pathname + (tabsKey() !== 'allt' ? '#' + tabsKey() : ''))
      opener && opener.focus && opener.focus()
    }
    const tabsKey = () => ($('.tabs--wrap [aria-selected=true]') || {}).dataset?.f || 'allt'
    const step = (d) => { const vis = visible(); idx = (idx + d + vis.length) % vis.length; show(vis[idx]) }
    list.addEventListener('click', (e) => { const a = e.target.closest('[data-open]'); if (a) { e.preventDefault(); open(a.dataset.open, a) } })
    lb.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close() })
    $('.lb__n--p', lb).addEventListener('click', () => step(-1)); $('.lb__n--n', lb).addEventListener('click', () => step(1))
    document.addEventListener('click', (e) => { if (e.target.closest('.lb__add')) setTimeout(() => { const on = store.get().some((i) => i.id === $('.lb__add', lb).dataset.add); $('.lb__add span', lb).textContent = on ? 'Fjarlægja úr fyrirspurn' : 'Bæta við fyrirspurn' }, 0) })
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return
      if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'Tab') { const f = $$('button,a[href]', lb).filter((x) => x.offsetParent); if (!f.length) return; const first = f[0]; const last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } }
    })
    const h = decodeURIComponent(location.hash.slice(1))
    const cats = ['stolar', 'sofar', 'kollar', 'innrettingar', 'fyrir-eftir', 'verkstaedi']
    if (cats.includes(h)) apply(h, true)
    else if (h && items.some((i) => i.dataset.id === h)) open(h)
    addEventListener('hashchange', () => {
      const n = decodeURIComponent(location.hash.slice(1))
      if (cats.includes(n)) { if (!lb.hidden) close(); apply(n, true) } else if (n && items.some((i) => i.dataset.id === n) && lb.hidden) open(n)
    })
    if (motion) G.from(items.slice(0, 16), { opacity: 0, y: 40, duration: 1, ease: 'expo.out', stagger: 0.04, delay: 0.15, clearProps: 'all' })
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (home) {
      splitChars(); measureWord()
      initHero(); initSplit(); initWorksReveal(); initFabric(); initAccordion(); initBA(); initFlow(); initHeads(); initAbout(); initVideo(); initThread(); initForm()
      const w = initFilter($('.grid'), '.tile', $('.works .tabs'), { flip: true })
      const h = location.hash
      if (h && h.length > 1) setTimeout(() => goHash(h, true), 60)
    }
    if (wall) initWall()
    if (motion) {
      addEventListener('load', () => ST.refresh())
      document.fonts && document.fonts.ready.then(() => { if (home) { measureWord(); setFootH() } ST.refresh() })
      let rt; let lastW = innerWidth
      addEventListener('resize', () => {
        clearTimeout(rt)
        rt = setTimeout(() => {
          if (touch && innerWidth === lastW) return
          lastW = innerWidth
          if (home) { measureWord(); setFootH() }
          ST.refresh()
        }, 200)
      })
    } else if (home) {
      document.fonts && document.fonts.ready.then(measureWord)
      addEventListener('resize', measureWord)
    }
    root.classList.add('ready')
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot()
  /* safety: if the script dies midway, never leave the hero hidden */
  setTimeout(() => { if (!root.classList.contains('ready')) root.classList.add('no-motion') }, 3500)
})()
