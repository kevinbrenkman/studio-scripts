/*!
 * spread.js 1.0.0 (kevinbrenkman/studio-scripts/core)
 * Scroll parallax between blocks (Paloma GridFX "spread"): each block drifts away from the middle of the screen,
 * 0 in the centre, the full amount at the top and bottom edge. Neighbouring sections open up a little as they
 * pass the edges and close again in the middle. Off with reduced motion.
 *
 *   [data-spread]        on a section (or any block). Value = px at the edge, default 20 ("" = 20). Half under 768px.
 *
 * Uses the CSS `translate` property, not `transform`: it stacks on top of Webflow (IX3) scroll reveals on the same
 * element instead of fighting them. Runs on the GSAP ticker (or rAF), only when the page actually scrolled.
 * Do not put it on the footer or the last block of a page: pushed down at the bottom edge it makes the page taller.
 */
(() => {
  if (window.__studioSpread) return; window.__studioSpread = '1.0.0';
  window.App = window.App || { inits: [], destroys: [] };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEF = 20;
  let els = [], ys = new Map(), tick = null, raf = 0, lastY = null, lastW = 0, frames = 0;

  const amount = (el) => { const v = parseFloat(el.getAttribute('data-spread')); return isNaN(v) ? DEF : v; };
  const scrollPos = () => (window.lenis ? window.lenis.scroll : window.scrollY);

  const update = () => {
    const sy = scrollPos(), w = innerWidth;
    // Only work when the page scrolled or resized (plus a re-check twice a second for late images / layout shifts)
    if (sy === lastY && w === lastW && ++frames % 30) return;
    lastY = sy; lastW = w;
    const vh = innerHeight, mid = vh / 2, k = w < 768 ? 0.5 : 1;
    els.forEach((el) => {
      if (!el.isConnected) return;
      const cur = ys.get(el) || 0, r = el.getBoundingClientRect();
      const top = r.top - cur, h = r.height; // resting position, without our own offset
      if (top > vh * 1.5 || top + h < -vh * 0.5) return;
      const n = Math.max(-1, Math.min(1, (top + h / 2 - mid) / mid)); // -1 top edge, 0 centre, 1 bottom edge
      const y = n * Math.abs(n) * el._spread * k;
      if (Math.abs(y - cur) < 0.01) return;
      ys.set(el, y); el.style.translate = '0 ' + y.toFixed(2) + 'px';
    });
  };

  const stop = () => {
    if (tick && window.gsap) gsap.ticker.remove(tick);
    if (raf) cancelAnimationFrame(raf);
    tick = null; raf = 0;
  };
  const start = () => {
    stop(); lastY = null;
    if (window.gsap) { tick = update; gsap.ticker.add(tick); }
    else { const loop = () => { update(); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
  };

  const init = () => {
    if (RM) return;
    els = [...document.querySelectorAll('[data-spread]')];
    els.forEach((el) => { el._spread = amount(el); });
    if (els.length) start(); else stop();
  };
  const destroy = () => {
    stop();
    els.forEach((el) => { if (!el.isConnected) { ys.delete(el); } });
    els = [];
  };

  if (App.register) App.register('Spread', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
