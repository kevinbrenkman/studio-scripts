/*!
 * slider.js 1.4.1 (kevinbrenkman/studio-scripts/core)
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
 * Add-ons (attributes on the root): data-slider-autoscroll, data-slider-reveal, data-slider-parallax.
 * Trackpad drag is on by default (data-slider-trackpad="false" turns it off).
 * Fires 'slider:ready' on the root once mounted; the Splide instance is root._sp.
 */
(() => {
  if (window.__studioSlider) return; window.__studioSlider = '1.4.1';
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

  const readOptions = (root) => {
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
      drag: a('drag') === 'free' ? 'free' : on(a('drag'), true),
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
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const slides = [...(listOf(root) || root).children];
      const i = slides.findIndex((s) => { const el = s.matches('[data-slider-date]') ? s : s.querySelector('[data-slider-date]'); const d = el && new Date(el.getAttribute('data-slider-date')); return d && !isNaN(d) && d >= today; });
      o.start = i < 0 ? Math.max(0, slides.length - 1) : i;
    } else if (st && !isNaN(+st)) o.start = +st;
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
    let lock = 0, lockT = 0, snapT = 0, snapTw = null, flashed = false;
    const flash = (sel) => {
      const btn = root.querySelector(sel); if (!btn) return;
      btn.classList.remove('is-flash'); void btn.offsetWidth; btn.classList.add('is-flash');
      clearTimeout(btn._fl); btn._fl = setTimeout(() => btn.classList.remove('is-flash'), 500);
    };
    const snap = () => {
      flashed = false;
      const pos = Move.getPosition(), i = Move.toIndex(pos), o = { p: pos };
      snapTw = gsap.to(o, { p: Move.toPosition(i), duration: RM ? 0 : 0.6, ease: 'power3.out', onUpdate: () => Move.translate(o.p), onComplete: () => { Ctrl.setIndex(i); snapTw = null; } });
    };
    const wheel = (e) => {
      const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
      if (!lock && ax <= ay) return; // vertical: normal page scroll
      if (!sp.is('loop') && !root.classList.contains('is-overflow')) return; // everything fits: nothing to move
      lock = 1; clearTimeout(lockT); lockT = setTimeout(() => { lock = 0; }, 220);
      e.preventDefault(); e.stopImmediatePropagation();
      if (snapTw) { snapTw.kill(); snapTw = null; }
      if (sp.state.is(Splide.STATES.MOVING)) Move.cancel();
      if (!flashed && ax > 2) { flashed = true; flash(e.deltaX > 0 ? '[data-slider-next]' : '[data-slider-prev]'); }
      let p = Move.getPosition() - e.deltaX;
      if (!sp.is('loop')) { const a = Move.getLimit(false), b = Move.getLimit(true); p = Math.min(Math.max(a, b), Math.max(Math.min(a, b), p)); } // no swiping into the void past the ends
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

  /* ---------- Arrows ---------- */
  const arrows = (root, sp) => {
    // Arrows inside the root, plus arrows anywhere on the page that name this slider: data-slider-next="radar" + data-slider-name="radar"
    const name = attr(root, 'name');
    const find = (k) => [...new Set([...root.querySelectorAll('[data-slider-' + k + ']'), ...(name ? document.querySelectorAll('[data-slider-' + k + '="' + name + '"]') : [])])];
    const prev = find('prev'), next = find('next');
    if (!prev.length && !next.length) return null;
    const goPrev = (e) => { e.preventDefault(); sp.go('<'); }, goNext = (e) => { e.preventDefault(); sp.go('>'); };
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

    loadSplide().then(() => {
      if (!root.isConnected || !root._slider) return;                    // page left while Splide was loading
      if (!window.Splide) { root.classList.add('is-slider-ready'); return; } // CDN blocked: show the static list

      root.classList.add('splide');
      track.classList.add('splide__track');
      list.classList.add('splide__list');
      [...list.children].forEach((s) => s.classList.add('splide__slide'));

      const opts = readOptions(root);
      const gapCss = attr(root, 'gap') === 'css';
      const zeroGap = (z) => (z ? list.style.setProperty('gap', '0px', 'important') : list.style.removeProperty('gap'));
      if (gapCss) zeroGap(true);
      const sp = new Splide(root, opts);
      if (gapCss) {
        // Breakpoint destroy (data-slider-mobile="false") gives the list its Webflow gap back; remount takes it again
        sp.on('destroy', () => zeroGap(false));
        sp.on('mounted', () => { if (list.style.getPropertyValue('gap') !== '0px') { zeroGap(true); sp.refresh(); } });
      }
      const cleanups = [];
      // Everything fits (e.g. 3 cards): no dragging, no arrows (finite sliders only)
      const fit = () => { if (sp.is('loop') || !sp.Components.Drag) return; sp.Components.Drag.disable(!root.classList.contains('is-overflow')); };
      sp.on('mounted resized overflow', fit);
      sp.on('mounted', () => {
        [arrows, trackpad, autoscroll, reveal, parallax].forEach((fn) => { try { const c = fn(root, sp); if (c) cleanups.push(c); } catch (e) { console.warn('[slider]', e); } });
        root.classList.add('is-slider-ready');
        // Loop clones are new elements: let other modules set up on them too (modules must be idempotent)
        App.inits.forEach((fn) => { if (fn !== init) { try { fn(root); } catch (e) {} } });
        if (window.lenis) lenis.resize();
        if (window.ScrollTrigger) ScrollTrigger.refresh();
        root.dispatchEvent(new CustomEvent('slider:ready', { bubbles: true, detail: { splide: sp } }));
      });
      sp.mount();
      root.classList.add('is-slider-ready'); // also when a breakpoint destroyed it at mount (data-slider-mobile="false")
      root._sp = sp;
      root._sliderDestroy = () => {
        cleanups.forEach((c) => { try { c(); } catch (e) {} });
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
