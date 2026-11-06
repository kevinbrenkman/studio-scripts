/*!
 * core.js 1.0.0 (kevinbrenkman/studio-scripts/core)
 * Swup page transitions + Lenis + GSAP + App module registry. Docs: docs/core.md
 * Needs, loaded before this file: gsap + ScrollTrigger, lenis, Swup, @swup/preload-plugin.
 * Per-project config: set window.CORE_CONFIG before this script, e.g.
 *   <script>window.CORE_CONFIG = { USE_THEME_TWEEN: false, NAV_BTN: '' };</script>
 */
(() => {
  /* ===================== CONFIG (override per project via window.CORE_CONFIG) ===================== */
  const C = Object.assign({
    CONTAINER: '#swup',
    THEME: '[data-page-shell]',        // Page Theme component outside #swup. Not using themes? Leave it, it no-ops.
    NAV_BTN: 'a[data-glow-button]',    // nav items whose colour follows the theme, or ''
    TWEEN_EXTRA: '[data-theme-tween]', // anything else outside #swup whose colour should crossfade
    USE_THEME_TWEEN: true,             // false = no colour crossfade, just fade out / fade in
    FADE_OUT: 0.45,
    THEME_FADE: 0.9,
    NAV_FADE: 0.6,
    THEME_PAUSE: 0.5,                  // how far into the crossfade the new content starts fading in
    FADE_IN: 0.6,
    EASE: 'power2.inOut',
    LENIS: { lerp: 0.12, wheelMultiplier: 1, smoothWheel: true }
  }, window.CORE_CONFIG || {});
  const { CONTAINER, THEME, NAV_BTN, TWEEN_EXTRA, USE_THEME_TWEEN, FADE_OUT, THEME_FADE, NAV_FADE, THEME_PAUSE, FADE_IN, EASE } = C;
  const LENIS_OPTIONS = Object.assign({}, C.LENIS, { autoRaf: false }); // GSAP ticker drives Lenis, always
  if (window.App && App._core) return; // loaded twice: keep the first
  /* ================================================================================================= */

  /* ---------- App registry ---------- */
  window.App = window.App || { inits: [], destroys: [] };
  App._core = '1.0.0';
  App.ctx = null; // gsap.context for the current page: tweens + ScrollTriggers made in it are reverted on page leave

  const runInits = (scope) => {
    App.ctx = gsap.context(() => {}, scope);
    App.inits.forEach((fn) => { try { App.ctx.add(() => fn(scope)); } catch (e) { console.warn('[init]', e); } });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };
  const runDestroys = () => {
    App.destroys.forEach((fn) => { try { fn(); } catch (e) { console.warn('[destroy]', e); } });
    if (App.ctx) { App.ctx.revert(); App.ctx = null; }
  };

  // Module helper: App.register('Name', init(scope), destroy())
  // Handles late loading: if the shell already ran, the module inits on the current page itself.
  App.register = (name, init, destroy) => {
    App.inits.push(init);
    if (destroy) App.destroys.push(destroy);
    if (App._booted) {
      const scope = document.querySelector(CONTAINER) || document;
      try { (App.ctx ? App.ctx.add(() => init(scope)) : init(scope)); } catch (e) { console.warn('[' + name + ']', e); }
    }
  };

  /* ---------- Lenis: one instance for the session, driven by the GSAP ticker ---------- */
  // Never lenis.stop() during a page transition: it sets overflow: clip on <html> and the browser jumps to top
  // while the old page is still fading out.
  const inEditor = !!(window.Webflow && window.Webflow.env && window.Webflow.env('editor'));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;
  if (window.Lenis && !inEditor && !reducedMotion) {
    lenis = new Lenis(LENIS_OPTIONS);
    window.lenis = lenis;
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  }

  const findTarget = (hash) => {
    if (!hash) return null;
    try { return document.querySelector(hash) || document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (_) { return document.getElementById(decodeURIComponent(hash.slice(1))); }
  };

  /* ---------- Theme crossfade ---------- */
  const colourTargets = () => {
    const sel = [NAV_BTN, TWEEN_EXTRA].filter(Boolean).join(',');
    const extras = sel ? [...document.querySelectorAll(sel)].filter((el) => !el.closest(CONTAINER)) : [];
    return [document.body, ...extras];
  };
  const readColours = (el) => { const cs = getComputedStyle(el); return { backgroundColor: cs.backgroundColor, color: cs.color }; };

  // Swup never swaps the Page Theme (outside #swup), so copy the incoming page's variant onto it
  const copyTheme = (doc) => {
    const current = document.querySelector(THEME);
    const next = doc ? doc.querySelector(THEME) : null;
    if (!current || !next) return;
    current.className = next.className;
    const isVariant = (name) => name.startsWith('data-wf--');
    [...current.attributes].forEach((a) => { if (isVariant(a.name)) current.removeAttribute(a.name); });
    [...next.attributes].forEach((a) => { if (isVariant(a.name)) current.setAttribute(a.name, a.value); });
  };

  const applyTheme = (doc, path) => {
    if (!USE_THEME_TWEEN) { copyTheme(doc); if (window.NavState && path) NavState.update(path, true); return; }
    const all = colourTargets();
    gsap.killTweensOf(all, 'backgroundColor,color');
    const from = all.map(readColours);
    all.forEach((el) => { el.style.transition = 'none'; });
    gsap.set(all, { clearProps: 'backgroundColor,color' });

    copyTheme(doc);
    if (window.NavState && path) NavState.update(path, true);

    const to = all.map(readColours);
    all.forEach((el, i) => {
      gsap.fromTo(el, from[i], {
        ...to[i], duration: el === document.body ? THEME_FADE : NAV_FADE, ease: EASE,
        onComplete: () => { gsap.set(el, { clearProps: 'backgroundColor,color' }); el.style.transition = ''; }
      });
    });
  };

  /* ---------- Webflow reinit (forms, tabs, sliders, IX2) ---------- */
  const reinitWebflow = (wfPage) => {
    if (wfPage) document.documentElement.setAttribute('data-wf-page', wfPage);
    if (!window.Webflow) return;
    try { Webflow.destroy(); Webflow.ready(); } catch (e) {}
    try { Webflow.require('ix2') && Webflow.require('ix2').init(); } catch (e) {}
  };

  /* ---------- Swup ---------- */
  // Preload on hover. preloadInitialPage off: the landing page is not downloaded a second time.
  const swup = new Swup({
    containers: [CONTAINER],
    animationSelector: false,
    ignoreVisit: (url, { el } = {}) => !!(el && el.closest('[data-no-swup]')),
    plugins: [new SwupPreloadPlugin({ preloadInitialPage: false })]
  });
  window.swup = swup;

  let incomingDoc = null, incomingWfPage = null, incomingPath = null;
  swup.hooks.on('visit:start', (visit) => {
    incomingDoc = null; incomingWfPage = null;
    incomingPath = new URL(visit.to.url, location.origin).pathname;
  });
  swup.hooks.on('page:load', (visit, { page }) => {
    incomingDoc = new DOMParser().parseFromString(page.html, 'text/html');
    incomingWfPage = incomingDoc.documentElement.getAttribute('data-wf-page');
  });

  // 1. Out: opacity only (a transform breaks position: fixed children)
  swup.hooks.replace('animation:out:await', async () => {
    await gsap.to(CONTAINER, { autoAlpha: 0, duration: reducedMotion ? 0 : FADE_OUT, ease: 'power2.in' });
  });

  // 2. Swap: old content invisible AND new page loaded
  swup.hooks.before('content:replace', runDestroys);
  swup.hooks.on('content:replace', () => {
    gsap.set(CONTAINER, { autoAlpha: 0 }); // no one-frame flash
    applyTheme(incomingDoc, incomingPath);
    reinitWebflow(incomingWfPage);
    runInits(document.querySelector(CONTAINER));
  });

  // Scroll after the swap, through Lenis so its position never drifts
  swup.hooks.replace('content:scroll', (visit) => {
    const target = visit.scroll && visit.scroll.target ? findTarget(visit.scroll.target) : null;
    if (lenis) { lenis.resize(); lenis.scrollTo(target || 0, { immediate: true, force: true }); }
    else if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  });

  // Same-page anchors: smooth through Lenis
  swup.hooks.replace('scroll:anchor', (visit, { hash }) => {
    const target = findTarget(hash);
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.2 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });

  // 3. In: starts partway through the colour crossfade
  swup.hooks.replace('animation:in:await', async () => {
    await gsap.to(CONTAINER, {
      autoAlpha: 1,
      duration: reducedMotion ? 0 : FADE_IN,
      delay: reducedMotion || !USE_THEME_TWEEN ? 0 : THEME_PAUSE,
      ease: 'power2.out'
    });
  });

  swup.hooks.on('visit:end', () => { if (lenis) lenis.resize(); });

  /* ---------- First load ---------- */
  const boot = () => { App._booted = true; runInits(document.querySelector(CONTAINER) || document); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  // Images and fonts change page height after load
  window.addEventListener('load', () => { if (lenis) lenis.resize(); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
})();
