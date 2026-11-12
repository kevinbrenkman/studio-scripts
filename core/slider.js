/*!
 * slider.js 1.9.0 (kevinbrenkman/studio-scripts/core)
 * Splide sliders from plain Webflow markup (static or CMS), set up with data attributes. Docs: docs/splide.md
 * Extracted from Paloma: CaseSlider 1.2.0, SliderMotion 1.1.0, SliderDrag 1.0.0, SliderFX 1.9.0.
 *
 * Works with core.js (Swup) and without it (plain Webflow site).
 * Loads Splide 4.1.4 itself, only on pages that have a slider. Splide's CSS is not needed.
 *
 * Markup
 *   [data-slider]                 slider root
 *     [data-slider-track]         Collection List Wrapper (CMS) or any div. Fallback: .w-dyn-list
 *       [data-slider-list]        Collection List (CMS) or any div. Fallback: .w-dyn-items. Its children are the slides.
 *     [data-slider-prev] / [data-slider-next]   optional arrow buttons, anywhere inside the root
 *
 * Dates (data-slider-start="upcoming"): each slide (or an element in it) has data-slider-date (Sort Date, any Webflow
 *   date format: 12/11/26 is read as day/month/year) and optionally data-slider-repeat ("Donderdag": a weekly event,
 *   it counts as its next occurrence). Slides are put in date order, past ones first, and the slider opens on the first
 *   upcoming one. Past events fill the space on the left when there are not enough upcoming ones.
 *   data-slider-order="cms" keeps the CMS order.
 * data-slider-drag="step": one slide per swipe (touch, mouse and trackpad). "free": momentum. Default: follows the finger.
 * data-slider-min="4": fewer slides than that = no slider, the list keeps its Webflow layout (grid), arrows hidden.
 * Add-ons (attributes on the root): data-slider-autoscroll, data-slider-reveal, data-slider-parallax, data-slider-edge="fade".
 * Trackpad drag is on by default (data-slider-trackpad="false" turns it off).
 * Fires 'slider:ready' on the root once mounted; the Splide instance is root._sp.
 */
(() => {
  if (window.__studioSlider) return; window.__studioSlider = '1.9.0';
  window.App = window.App || { inits: [], destroys: [] };

  const SPLIDE_SRC = 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const live = new Set();

  /* ---------- CSS: minimal Splide layout (no Splide CSS needed), no flash before mount ---------- */
  if (!document.getElementById('studio-slider-css')) {
    const st = document.createElement('style');
    st.id = 'studio-slider-css';
    st.textContent =
      '[data-slider] .splide__track{overflow:hidden;position:relative}' +
      // data-slider-overflow="visible": slides run past the slider to the edge, clip on a parent (overflow-x: clip on the section)
      '[data-slider][data-slider-overflow="visible"] .splide__track{overflow:visible}' +
      // CMS list in the slot of a static list wrapper: let it take the full width
      '[data-slider-list]>.w-dyn-list{flex:0 0 100%;min-width:0}' +
      // Finite sliders: the arrow at an end fades out (is-disabled), the other one stays
      '[data-slider-prev],[data-slider-next]{transition:opacity .3s ease,visibility 0s linear 0s}' +
      // Phones without a slider (data-slider-mobile="false"): the list stacks, upcoming events only
      '@media (max-width:767px){[data-slider][data-slider-mobile="false"] [data-slider-past]{display:none}}' +
      '[data-slider-prev].is-disabled,[data-slider-next].is-disabled{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s ease,visibility 0s linear .3s}' +
      '[data-slider].is-initialized .splide__list{display:flex;backface-visibility:hidden;margin:0!important;padding:0!important}' +
      '[data-slider].is-initialized .splide__slide{flex-shrink:0;position:relative;list-style:none}' +
      '[data-slider]:not(.is-slider-ready) [data-slider-list],[data-slider]:not(.is-slider-ready) .w-dyn-items{visibility:hidden}' +
      // Screen reader announcer shows "…" while sliding without Splide CSS: hide it visually only
      '.splide__sr{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}';
    document.head.appendChild(st);
  }

  let loading = null;
  const loadSplide = () => loading || (loading = window.Splide ? Promise.resolve() : new Promise((res) => {
    const s = document.createElement('script');
    s.src = SPLIDE_SRC; s.onload = s.onerror = res;
    document.head.appendChild(s);
  }));

  /* ---------- Options from attributes ---------- */
  const attr = (root, k) => root.getAttribute('data-slider-' + k);
  const val = (v, d) => (v == null || v === '' ? d : (isNaN(+v) ? v : +v)); // keeps units: '1.25rem', '11vw'
  const on = (v, d) => (v == null ? d : v !== 'false');

  // data-slider-gap="css": take the gap from the list's own column-gap (set in the Designer), as em so it scales.
  // Splide then owns the gap (slide margins) and the list's CSS gap is zeroed while mounted, or the loop drifts.
  const listOf = (root) => root.querySelector('[data-slider-list]') || root.querySelector('.w-dyn-items');
  const cssGap = (root) => {
    const l = listOf(root); if (!l) return 0;
    const c = getComputedStyle(l), g = parseFloat(c.columnGap) || 0;
    return g ? (g / (parseFloat(c.fontSize) || 16)).toFixed(4) + 'em' : 0;
  };

  /* ---------- Dates ---------- */
  const MONTHS = ['jan', 'feb', 'mar|maa|mrt', 'apr', 'may|mei', 'jun', 'jul', 'aug', 'sep', 'oct|okt', 'nov', 'dec'];
  const DAYS = ['sun|zon', 'mon|maa', 'tue|din', 'wed|woe', 'thu|don', 'fri|vri', 'sat|zat'];
  const parseDate = (v) => {
    v = (v || '').trim().toLowerCase(); if (!v) return null;
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                                   // 2026-11-12
    if (m) return new Date(+m[1], m[2] - 1, +m[3]);
    m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);                          // 12/11/26 = 12 November (Belgian order)
    if (m) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1]);
    const mi = MONTHS.findIndex((k) => new RegExp('(^|[^a-z])(' + k + ')').test(v));          // 12 november 2026, Nov 12, 2026
    const nums = v.match(/\d+/g) || [];
    if (mi > -1 && nums.length) {
      const y = nums.find((n) => n.length === 4) || new Date().getFullYear(), d = nums.find((n) => n.length <= 2);
      if (d) return new Date(+y, mi, +d);
    }
    const t = new Date(v); return isNaN(t) ? null : t;
  };
  const weekday = (v) => { v = (v || '').trim().toLowerCase(); if (!v) return -1; return DAYS.findIndex((k) => new RegExp('^(' + k + ')').test(v.replace(/^elke\s+|^every\s+/, ''))); };
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const read = (s, k) => { const el = s.matches('[data-slider-' + k + ']') ? s : s.querySelector('[data-slider-' + k + ']'); return el ? el.getAttribute('data-slider-' + k) : ''; };
  // When a slide happens: its date, or for a weekly event the next time it's on (today counts)
  const whenOf = (s) => {
    const wd = weekday(read(s, 'repeat'));
    if (wd > -1) { const t = today0(); t.setDate(t.getDate() + ((wd - t.getDay() + 7) % 7)); return t; }
    const d = parseDate(read(s, 'date')); if (d) d.setHours(0, 0, 0, 0); return d;
  };
  const orderByDate = (list) => {
    const slides = [...list.children].map((el, i) => ({ el, i, t: whenOf(el) }));
    slides.sort((a, b) => (a.t ? a.t.getTime() : Infinity) - (b.t ? b.t.getTime() : Infinity) || a.i - b.i);
    slides.forEach((x) => list.appendChild(x.el));
    // Past events get data-slider-past (only when something is still coming): hidden on phones when there is no slider
    const t = today0(), any = slides.some((x) => x.t && x.t >= t);
    slides.forEach((x) => x.el.toggleAttribute('data-slider-past', any && !!x.t && x.t < t));
  };

  const readOptions = (root, list) => {
    const a = (k) => attr(root, k);
    const gapCss = a('gap') === 'css', g = gapCss ? cssGap(root) : (a('gap') || '1.25rem');
    const o = {
      type: a('type') || 'loop',                 // loop | slide | fade
      autoWidth: on(a('auto-width'), true),      // slide width from Webflow, not from Splide
      perPage: val(a('per-page'), 1),            // only used when auto-width="false"
      gap: g,
      focus: val(a('focus'), 0),                 // 0 = left aligned, 'center' = centred
      speed: val(a('speed'), 1000),
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      arrows: false,                             // custom arrows via [data-slider-prev] / [data-slider-next]
      pagination: on(a('pagination'), false),
      // data-slider-drag="free": a flick glides on with momentum, then snaps to the nearest slide
      drag: a('drag') === 'free' ? 'free' : a('drag') === 'step' ? true : on(a('drag'), true),
      snap: a('drag') === 'free',
      flickPower: val(a('flick'), 150),
      flickMaxPages: 1,
      padding: { left: a('padding-left') || 0, right: a('padding-right') || 0 },
      breakpoints: {
        767: {
          gap: a('gap-mobile') || g,
          focus: val(a('focus-mobile'), val(a('focus'), 0)),
          padding: { left: a('padding-left-mobile') || a('padding-left') || 0, right: a('padding-right-mobile') || a('padding-right') || 0 }
        }
      }
    };
    // data-slider-autoplay="5000": advance every 5s, pauses on hover and focus (Splide's own Autoplay)
    const ap = parseFloat(a('autoplay'));
    if (ap > 0 && !RM) Object.assign(o, { autoplay: true, interval: ap, pauseOnHover: true, pauseOnFocus: true, resetProgress: false });
    // data-slider-mobile="false": no slider under 768px, the list falls back to its own Webflow layout
    if (a('mobile') === 'false') o.breakpoints[767].destroy = true;
    // data-slider-start="2" or "upcoming": first slide whose [data-slider-date] (on or in the slide) is today or later
    const st = a('start');
    if (st === 'upcoming') {
      const t = today0(), slides = [...(list || listOf(root) || root).children]; // the real slides (a CMS list in a slot: its items)
      const i = slides.findIndex((s) => { const d = whenOf(s); return d && d >= t; });
      o.start = i < 0 ? Math.max(0, slides.length - 1) : i;
    } else if (st && !isNaN(+st)) o.start = +st;
    // Finite sliders: the last index is the last position that still moves (no dead arrow clicks at the end)
    if (o.type === 'slide') o.omitEnd = true;
    if (o.autoWidth) delete o.perPage;
    if (RM) o.speed = 0;
    try { Object.assign(o, JSON.parse(a('options') || '{}')); } // escape hatch: data-slider-options='{"rewind":true}'
    catch (e) { console.warn('[slider] data-slider-options is not valid JSON', root); }
    return o;
  };

  /* ---------- Add-on: trackpad drag ---------- */
  // Horizontal trackpad swipe drags the slider with your fingers, settles on the nearest slide when you let go.
  // While swiping sideways the page does not scroll (Lenis gets nothing).
  const trackpad = (root, sp) => {
    if (attr(root, 'trackpad') === 'false' || !window.gsap) return null;
    const Move = sp.Components.Move, Ctrl = sp.Components.Controller;
    const step = attr(root, 'drag') === 'step';
    let lock = 0, lockT = 0, snapT = 0, snapTw = null, flashed = false, from = 0;
    const range = (i) => Math.max(0, Math.min(Ctrl.getEnd(), i));
    const flash = (sel) => {
      const btn = root.querySelector(sel); if (!btn) return;
      btn.classList.remove('is-flash'); void btn.offsetWidth; btn.classList.add('is-flash');
      clearTimeout(btn._fl); btn._fl = setTimeout(() => btn.classList.remove('is-flash'), 500);
    };
    const snap = () => {
      flashed = false;
      const pos = Move.getPosition(), o = { p: pos };
      let i = Move.toIndex(pos);
      if (step) i = range(Math.max(from - 1, Math.min(from + 1, i))); // one slide per swipe
      snapTw = gsap.to(o, { p: Move.toPosition(i), duration: RM ? 0 : 0.6, ease: 'power3.out', onUpdate: () => Move.translate(o.p), onComplete: () => { Ctrl.setIndex(i); snapTw = null; } });
    };
    const wheel = (e) => {
      const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
      if (!lock && ax <= ay) return; // vertical: normal page scroll
      if (!sp.is('loop') && !root.classList.contains('is-overflow')) return; // everything fits: nothing to move
      if (!lock) from = Ctrl.getIndex(); // a new gesture
      lock = 1; clearTimeout(lockT); lockT = setTimeout(() => { lock = 0; }, 220);
      e.preventDefault(); e.stopImmediatePropagation();
      if (snapTw) { snapTw.kill(); snapTw = null; }
      if (sp.state.is(Splide.STATES.MOVING)) Move.cancel();
      if (!flashed && ax > 2) { flashed = true; flash(e.deltaX > 0 ? '[data-slider-next]' : '[data-slider-prev]'); }
      let p = Move.getPosition() - e.deltaX;
      if (!sp.is('loop')) { const a = Move.getLimit(false), b = Move.getLimit(true); p = Math.min(Math.max(a, b), Math.max(Math.min(a, b), p)); } // no swiping into the void past the ends
      if (step) { const a = Move.toPosition(range(from - 1)), b = Move.toPosition(range(from + 1)); p = Math.min(Math.max(a, b), Math.max(Math.min(a, b), p)); } // at most one slide
      Move.translate(p);
      clearTimeout(snapT); snapT = setTimeout(snap, 140);
    };
    root.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => { root.removeEventListener('wheel', wheel, { capture: true }); clearTimeout(snapT); clearTimeout(lockT); if (snapTw) snapTw.kill(); };
  };

  /* ---------- Add-on: auto scroll ---------- */
  // data-slider-autoscroll="1" = 20px/s (2 = 40px/s). Eases out and stops on hover, drag or out of view.
  // Keeps its own position: reading layout every frame made it step instead of glide.
  const autoscroll = (root, sp) => {
    const speed = parseFloat(attr(root, 'autoscroll')) || 0;
    if (!speed || RM || !window.gsap) return null;
    const Move = sp.Components.Move, Ctrl = sp.Components.Controller;
    const track = root.querySelector('.splide__track');
    let v = 0, hover = 0, drag = 0, inView = 1, pos = null;
    const enter = () => { hover = 1; }, leave = () => { hover = 0; };
    if (FINE) { track.addEventListener('pointerenter', enter); track.addEventListener('pointerleave', leave); }
    sp.on('drag', () => { drag = 1; pos = null; });
    sp.on('moved dragged shifted resized refresh', () => { drag = 0; pos = null; });
    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; pos = null; });
    io.observe(root);
    const tick = (t, dt) => {
      const target = hover || drag || !inView ? 0 : 20 * speed;
      v += (target - v) * Math.min(1, (dt / 1000) * (target ? 1.5 : 3));
      if (v <= 0.05 || drag || sp.state.is(Splide.STATES.MOVING)) { pos = null; return; }
      if (pos === null) pos = Move.getPosition();
      pos -= (v * Math.min(dt, 50)) / 1000;
      Move.translate(pos);
    };
    gsap.ticker.add(tick);
    // Auto scroll moves the list without telling Splide: sync the index before any swipe, drag or arrow click,
    // or the slider jumps back to where it started.
    const sync = () => {
      if (sp.state.is(Splide.STATES.MOVING)) return;
      const i = Move.toIndex(Move.getPosition());
      if (i !== Ctrl.getIndex()) Ctrl.setIndex(i);
    };
    const types = ['wheel', 'pointerdown', 'touchstart', 'click'];
    types.forEach((ty) => root.addEventListener(ty, sync, { capture: true, passive: true }));
    return () => {
      gsap.ticker.remove(tick); io.disconnect();
      track.removeEventListener('pointerenter', enter); track.removeEventListener('pointerleave', leave);
      types.forEach((ty) => root.removeEventListener(ty, sync, { capture: true }));
    };
  };

  /* ---------- Add-on: reveal ---------- */
  // data-slider-reveal: slides in view stagger up when the slider scrolls in from below.
  // Leaving at the bottom resets it (plays again on the way down); scrolling back up never shows it empty.
  const reveal = (root) => {
    if (!root.hasAttribute('data-slider-reveal') || RM || !window.gsap) return null;
    const rise = val(attr(root, 'reveal-y'), 40), stagger = val(attr(root, 'reveal-stagger'), 0.08), dur = val(attr(root, 'reveal-duration'), 1);
    const slides = () => [...root.querySelectorAll('.splide__slide')];
    const showAll = () => { const all = slides(); gsap.killTweensOf(all); gsap.set(all, { autoAlpha: 1, y: 0, clearProps: 'transform' }); };
    gsap.set(slides(), { autoAlpha: 0, y: rise });
    let shown = false;
    const play = () => {
      const w = innerWidth, all = slides();
      const vis = all.filter((s) => { const r = s.getBoundingClientRect(); return r.right > 0 && r.left < w; })
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      gsap.killTweensOf(all);
      gsap.set(all.filter((s) => !vis.includes(s)), { autoAlpha: 1, y: 0 });
      gsap.to(vis, { autoAlpha: 1, y: 0, duration: dur, ease: 'power3.out', stagger, clearProps: 'transform' });
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const fromBelow = e.boundingClientRect.top > 0;
      if (e.isIntersecting && !shown && (!fromBelow || e.intersectionRatio >= 0.2)) { shown = true; fromBelow ? play() : showAll(); }
      else if (!e.isIntersecting && shown && fromBelow) { shown = false; const all = slides(); gsap.killTweensOf(all); gsap.set(all, { autoAlpha: 0, y: rise }); }
    }), { threshold: [0, 0.2] });
    io.observe(root.querySelector('.splide__track') || root);
    return () => { io.disconnect(); showAll(); };
  };

  /* ---------- Add-on: parallax ---------- */
  // data-slider-parallax: media inside each slide sits scaled up and drifts against the travel direction.
  // data-slider-parallax-target (default 'img, video'), -zoom (1.2), -shift (8, xPercent, keep under (zoom - 1) / 2 * 100).
  // Measures once (and after resize/refresh), then only maths per frame: no layout reads while sliding.
  const parallax = (root, sp) => {
    if (!root.hasAttribute('data-slider-parallax') || RM || !window.gsap) return null;
    const SEL = attr(root, 'parallax-target') || 'img, video';
    const zoom = val(attr(root, 'parallax-zoom'), 1.2), shift = val(attr(root, 'parallax-shift'), 8);
    const Move = sp.Components.Move;
    const list = root.querySelector('.splide__list');
    if (list) list.style.willChange = 'transform';
    const setters = new Map();
    const setter = (el) => {
      if (!setters.has(el)) { gsap.set(el, { scale: zoom, force3D: true }); setters.set(el, gsap.quickSetter(el, 'xPercent')); }
      return setters.get(el);
    };
    const posOf = () => { const m = list && /(-?[\d.]+)px/.exec(list.style.transform); return m ? +m[1] : Move.getPosition(); };
    let map = null, base = 0, last = null, frames = 0, inView = true;
    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; if (inView) { map = null; last = null; } });
    io.observe(root);
    const build = () => {
      const L = list ? list.getBoundingClientRect().left : 0;
      base = L - posOf();
      map = [...root.querySelectorAll('.splide__slide')].map((s) => {
        const r = s.getBoundingClientRect();
        return { off: r.left - L, w: r.width, els: [...s.querySelectorAll(SEL)] };
      });
    };
    sp.on('resized refresh updated', () => { map = null; last = null; });
    const tick = () => {
      if (!inView) return;
      const pos = posOf();
      if (pos === last && ++frames % 30) return;
      if (pos === last) map = null; // idle re-check twice a second: picks up late images
      last = pos;
      if (!map) build();
      const w = innerWidth;
      map.forEach((m) => {
        const left = base + m.off + pos;
        if (left + m.w < -w * 0.25 || left > w * 1.25) return;
        const p = Math.max(-1.25, Math.min(1.25, ((left + m.w / 2) / w) * 2 - 1)); // -1 left edge, 1 right edge
        m.els.forEach((el) => setter(el)(-p * shift));
      });
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); io.disconnect(); setters.forEach((_, el) => gsap.set(el, { clearProps: 'transform' })); };
  };

  /* ---------- Add-on: edge fade ---------- */
  // data-slider-edge="fade": only slides inside the slider show. A slide fades with how much of it is inside, every frame,
  // so one at an edge (data-slider-overflow="visible") is invisible at rest and fades in as it slides in, by arrow, drag
  // or trackpad alike. No classes or CSS transitions that can lag behind. Its children fade, not the slide itself,
  // so interactions that animate the slide keep working. Slide offsets are measured once (and on resize), not per frame.
  const edge = (root, sp) => {
    if (attr(root, 'edge') !== 'fade' || !window.gsap) return null;
    const Move = sp.Components.Move, track = root.querySelector('.splide__track') || root;
    let map = null, tw = 0, inView = true, last = null;
    const measure = () => {
      const t = track.getBoundingClientRect(), pos = Move.getPosition();
      tw = t.width;
      map = [...root.querySelectorAll('.splide__slide')].map((s) => {
        const r = s.getBoundingClientRect();
        return { s, kids: [...s.children], off: r.left - t.left - pos, w: r.width, o: -1 };
      });
      last = null;
    };
    const tick = () => {
      if (!inView) return;
      if (!map) measure();
      const pos = Move.getPosition();
      if (pos === last) return; last = pos;
      map.forEach((m) => {
        const l = m.off + pos, inside = Math.max(0, Math.min(l + m.w, tw) - Math.max(l, 0)) / m.w;
        const o = Math.round(Math.min(1, Math.max(0, (inside - 0.2) / 0.75)) * 100) / 100; // fully in: 1, a sliver: 0
        if (o === m.o) return; m.o = o;
        m.kids.forEach((k) => { k.style.opacity = o === 1 ? '' : o; });
        m.s.style.pointerEvents = o < 0.5 ? 'none' : '';
      });
    };
    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; last = null; });
    io.observe(root);
    const remeasure = () => { map = null; };
    sp.on('resized refresh updated', remeasure); addEventListener('resize', remeasure);
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick); io.disconnect(); removeEventListener('resize', remeasure);
      (map || []).forEach((m) => { m.kids.forEach((k) => { k.style.opacity = ''; }); m.s.style.pointerEvents = ''; });
    };
  };

  /* ---------- Arrows ---------- */
  const arrows = (root, sp) => {
    // Arrows inside the root, plus arrows anywhere on the page that name this slider: data-slider-next="radar" + data-slider-name="radar"
    const name = attr(root, 'name');
    const find = (k) => [...new Set([...root.querySelectorAll('[data-slider-' + k + ']'), ...(name ? document.querySelectorAll('[data-slider-' + k + '="' + name + '"]') : [])])];
    const prev = find('prev'), next = find('next');
    if (!prev.length && !next.length) return null;
    // Arrows are often links with href="#": stop the click here, or Webflow / Swup scroll the page to the top
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    const goPrev = (e) => { stop(e); sp.go('<'); }, goNext = (e) => { stop(e); sp.go('>'); };
    prev.forEach((b) => b.addEventListener('click', goPrev));
    next.forEach((b) => b.addEventListener('click', goNext));
    // Non-loop sliders: disable the arrow at the ends
    const update = () => {
      if (sp.is('loop')) return;
      const C = sp.Components.Controller, fits = !root.classList.contains('is-overflow');
      prev.forEach((b) => b.classList.toggle('is-disabled', fits || C.getPrev() < 0));
      next.forEach((b) => b.classList.toggle('is-disabled', fits || C.getNext() < 0));
    };
    sp.on('mounted move moved resized overflow', update); update();
    requestAnimationFrame(update); setTimeout(update, 400); // after Splide settled the start position and overflow
    // Autoplay restarts its interval after a manual arrow click
    if (sp.Components.Autoplay && sp.options.autoplay) next.concat(prev).forEach((b) => b.addEventListener('click', () => { try { sp.Components.Autoplay.play(); } catch (e) {} }));
    return () => { prev.forEach((b) => b.removeEventListener('click', goPrev)); next.forEach((b) => b.removeEventListener('click', goNext)); };
  };

  /* ---------- Setup ---------- */
  const setup = (root) => {
    if (root._slider) return;
    root._slider = true;

    // A Collection List inside the slider wins: its wrapper is the track, its list holds the slides.
    // So a Slider component (track > list > slot) works with static slides and with a CMS list dropped in its slot.
    const dyn = root.querySelector('.w-dyn-items');
    const track = dyn ? dyn.closest('.w-dyn-list') : root.querySelector('[data-slider-track]');
    const list = dyn || root.querySelector('[data-slider-list]');
    if (!track || !list) { console.warn('[slider] needs [data-slider-track] and [data-slider-list]', root); root.classList.add('is-slider-ready'); return; }

    // data-slider-exclude-current: drop the slide that links to this page ("More projects" on a project page)
    if (root.hasAttribute('data-slider-exclude-current')) {
      const here = location.pathname.replace(/\/$/, '');
      [...list.children].forEach((s) => {
        const a = s.matches('a[href]') ? s : s.querySelector('a[href]');
        if (a && new URL(a.href, location.origin).pathname.replace(/\/$/, '') === here) s.remove();
      });
    }

    // Empty (CMS with no items): hide the whole slider unless data-slider-keep-empty
    if (!list.children.length || list.querySelector('.w-dyn-empty')) {
      if (!root.hasAttribute('data-slider-keep-empty')) root.style.display = 'none';
      root.classList.add('is-slider-ready');
      return;
    }

    // data-slider-min="4": with fewer slides it is no slider, the list keeps its own Webflow layout (a grid).
    // Dated slides are still put in date order; the arrows (inside the root or named for it) are hidden.
    const min = parseInt(attr(root, 'min'), 10) || 0;
    if (min && list.children.length < min) {
      if (attr(root, 'start') === 'upcoming' && attr(root, 'order') !== 'cms') orderByDate(list);
      const name = attr(root, 'name');
      [...root.querySelectorAll('[data-slider-prev],[data-slider-next]'), ...(name ? document.querySelectorAll('[data-slider-prev="' + name + '"],[data-slider-next="' + name + '"]') : [])]
        .forEach((b) => b.classList.add('is-disabled'));
      root.setAttribute('data-slider-static', '');
      root.classList.add('is-slider-ready');
      return;
    }

    loadSplide().then(() => {
      if (!root.isConnected || !root._slider) return;                    // page left while Splide was loading
      if (!window.Splide) { root.classList.add('is-slider-ready'); return; } // CDN blocked: show the static list

      root.classList.add('splide');
      track.classList.add('splide__track');
      list.classList.add('splide__list');
      [...list.children].forEach((s) => s.classList.add('splide__slide'));

      if (attr(root, 'start') === 'upcoming' && attr(root, 'order') !== 'cms') orderByDate(list);
      const opts = readOptions(root, list);
      const gapCss = attr(root, 'gap') === 'css';
      const zeroGap = (z) => (z ? list.style.setProperty('gap', '0px', 'important') : list.style.removeProperty('gap'));
      const sp = new Splide(root, opts);
      const cleanups = [];
      const runCleanups = () => cleanups.splice(0).forEach((c) => { try { c(); } catch (e) {} });
      // Splide's destroy() also drops every sp.on() handler, and a breakpoint destroy (data-slider-mobile="false")
      // remounts with sp.mount() when the screen grows again. So all handlers are (re)wired right before each mount,
      // or after a resize across 767px the gap doubles and step drag, arrows and fit are gone.
      const wire = () => {
      sp.on('destroy', runCleanups);
      if (gapCss) {
        // Breakpoint destroy gives the list its Webflow gap back; the remount takes it again, before Splide measures.
        // (Not on 'mounted' + refresh: refresh rebuilds the list's style attribute and wipes the zero again.)
        zeroGap(true);
        sp.on('destroy', () => zeroGap(false));
      }
      // data-slider-drag="step": a swipe moves one slide, however far or fast you drag
      if (attr(root, 'drag') === 'step') sp.on('mounted', () => {
        const C = sp.Components.Controller, toDest = C.toDest; let from = null;
        sp.on('drag', () => { from = C.getIndex(); });
        C.toDest = (d) => { const i = toDest(d); if (from === null) return i; const f = from; from = null; return Math.max(f - 1, Math.min(f + 1, i)); };
      });
      // Everything fits (e.g. 3 cards): no dragging, no arrows (finite sliders only)
      const fit = () => { if (sp.is('loop') || !sp.Components.Drag) return; sp.Components.Drag.disable(!root.classList.contains('is-overflow')); };
      sp.on('mounted resized overflow', fit);
      // While (and just after) a drag the root carries data-slider-dragged, so a click on a card at the end of a drag
      // opens nothing (drawer.js and others check it; they listen before Splide's own click guard)
      let dragT = 0;
      sp.on('drag', () => { clearTimeout(dragT); root.setAttribute('data-slider-dragged', ''); });
      sp.on('dragged', () => { clearTimeout(dragT); dragT = setTimeout(() => root.removeAttribute('data-slider-dragged'), 120); });
      // Opened on an upcoming event near the end: snap the index to the last position that still moves
      sp.on('mounted', () => { const C = sp.Components.Controller; if (!sp.is('loop') && C.getIndex() > C.getEnd()) C.setIndex(C.getEnd()); });
      sp.on('mounted', () => {
        [arrows, trackpad, autoscroll, reveal, parallax, edge].forEach((fn) => { try { const c = fn(root, sp); if (c) cleanups.push(c); } catch (e) { console.warn('[slider]', e); } });
        root.classList.add('is-slider-ready');
        // Loop clones are new elements: let other modules set up on them too (modules must be idempotent)
        App.inits.forEach((fn) => { if (fn !== init) { try { fn(root); } catch (e) {} } });
        if (window.lenis) lenis.resize();
        if (window.ScrollTrigger) ScrollTrigger.refresh();
        root.dispatchEvent(new CustomEvent('slider:ready', { bubbles: true, detail: { splide: sp } }));
      });
      };
      const mount = sp.mount.bind(sp);
      sp.mount = (...a) => { wire(); return mount(...a); };
      sp.mount();
      root.classList.add('is-slider-ready'); // also when a breakpoint destroyed it at mount (data-slider-mobile="false")
      root._sp = sp;
      root._sliderDestroy = () => {
        runCleanups();
        try { sp.destroy(true); } catch (e) {}
        delete root._sp; delete root._sliderDestroy; root._slider = false;
      };
      live.add(root);
    });
  };

  const init = (scope = document) => (scope || document).querySelectorAll('[data-slider]').forEach(setup);
  const destroy = () => { live.forEach((r) => r._sliderDestroy && r._sliderDestroy()); live.clear(); };

  if (App.register) App.register('Slider', init, destroy);
  else {
    // No core.js: register for a later core, and run on a plain Webflow site
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
