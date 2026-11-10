/*!
 * marquee.js 1.1.0 (kevinbrenkman/studio-scripts/core)
 * Endless strip that keeps moving (also on hover). Drag eases toward the finger, a throw carries on
 * and glides back to cruising speed. Ported from the Shelter prototype (Onkruid). No dependencies.
 *
 * Markup
 *   [data-marquee]                  root (clips, gets cursor grab)
 *     [data-marquee-track]          the row of items (flex + gap in Webflow). Fallback: first child.
 *
 * Options (attributes on the root)
 *   data-marquee-speed="40"         px per second at a 16px root font size (scales with the em layout). Default 40
 *   data-marquee-direction="left"   left | right. Default left
 *   data-marquee-drag="false"       no dragging
 *   data-marquee-mobile="false"     off under 768px: the track keeps its own Webflow layout (e.g. a grid)
 */
(() => {
  if (window.__studioMarquee) return; window.__studioMarquee = '1.1.0';
  window.App = window.App || { inits: [], destroys: [] };

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)');
  const live = new Set();

  if (!document.getElementById('studio-marquee-css')) {
    const st = document.createElement('style');
    st.id = 'studio-marquee-css';
    st.textContent =
      '[data-marquee].is-marquee{overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab}' +
      '[data-marquee].is-marquee.is-dragging{cursor:grabbing}' +
      '[data-marquee].is-marquee [data-marquee-track],[data-marquee].is-marquee>:first-child{will-change:transform;flex-wrap:nowrap}' +
      '[data-marquee].is-marquee img{pointer-events:none;-webkit-user-drag:none}';
    document.head.appendChild(st);
  }

  const setup = (root) => {
    if (root._marquee) return;
    const track = root.querySelector('[data-marquee-track]') || root.firstElementChild;
    if (!track || !track.children.length) return;
    const a = (k) => root.getAttribute('data-marquee-' + k);
    const offMobile = a('mobile') === 'false';
    const dir = a('direction') === 'right' ? 1 : -1;
    const base = parseFloat(a('speed')) || 40;
    const canDrag = a('drag') !== 'false';

    let on = false, raf = 0, clones = [], setW = 0, x = 0, v = 0, cruise = 0;
    let dragging = false, target = 0, startX = 0, startOffset = 0, lastX = 0, lastT = 0, dragV = 0, last = 0;

    const measure = () => {
      const fs = parseFloat(getComputedStyle(root).fontSize) || 16;
      cruise = dir * base * (fs / 16);
      if (!dragging) v = cruise;
      // One set = distance from the first item to its first clone (includes the gap)
      const first = track.children[0], firstClone = clones[0];
      setW = firstClone ? firstClone.offsetLeft - first.offsetLeft : 0;
    };
    const fill = () => {
      clones.forEach((c) => c.remove()); clones = [];
      const items = [...track.children];
      // Enough copies to cover the root twice, so the loop never shows a gap
      let copies = 1, w = track.scrollWidth || 1;
      while (w * (copies + 1) < root.offsetWidth * 2 && copies < 10) copies++;
      for (let i = 0; i < copies; i++) items.forEach((el) => {
        const c = el.cloneNode(true);
        c.setAttribute('aria-hidden', 'true'); c.querySelectorAll('img').forEach((im) => { im.alt = ''; im.loading = 'eager'; });
        c.querySelectorAll('a,button').forEach((f) => f.setAttribute('tabindex', '-1'));
        track.appendChild(c); clones.push(c);
      });
      measure();
    };
    const render = () => {
      if (!setW) return;
      const tx = ((x % setW) - setW) % setW; // keep it in (-setW, 0]
      track.style.transform = `translate3d(${tx}px,0,0)`;
    };
    const tick = (now) => {
      const dt = Math.min(now - last, 64) / 1000; last = now;
      if (dragging) x += (target - x) * (1 - Math.exp(-dt * 22));          // follow the finger with a short ease
      else if (!RM) { v += (cruise - v) * (1 - Math.exp(-dt * 0.9)); x += v * dt; } // throw decays to cruise
      render();
      raf = requestAnimationFrame(tick);
    };

    const down = (e) => {
      if (!canDrag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      dragging = true; startX = lastX = e.clientX; startOffset = target = x; lastT = performance.now(); dragV = 0;
      root.setPointerCapture(e.pointerId); root.classList.add('is-dragging');
    };
    const move = (e) => {
      if (!dragging) return;
      target = startOffset + (e.clientX - startX);
      const now = performance.now(), dt = Math.max(now - lastT, 1) / 1000;
      dragV = dragV * 0.7 + ((e.clientX - lastX) / dt) * 0.3; // smoothed pointer velocity for the throw
      lastX = e.clientX; lastT = now;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      v = performance.now() - lastT > 90 ? cruise : Math.max(-3600, Math.min(3600, dragV * 1.2)); // a finger that stopped doesn't throw
      root.classList.remove('is-dragging');
    };
    const onResize = () => { if (on) { measure(); render(); } };

    const start = () => {
      if (on) return; on = true;
      root.classList.add('is-marquee');
      fill(); last = performance.now(); raf = requestAnimationFrame(tick);
      // Images that load later change the set width
      track.querySelectorAll('img').forEach((im) => { if (!im.complete) im.addEventListener('load', onResize, { once: true }); });
    };
    const stop = () => {
      if (!on) return; on = false;
      cancelAnimationFrame(raf); clones.forEach((c) => c.remove()); clones = [];
      track.style.transform = ''; root.classList.remove('is-marquee', 'is-dragging'); x = 0;
    };
    const sync = () => (offMobile && MOBILE.matches ? stop() : start());

    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    addEventListener('resize', onResize);
    MOBILE.addEventListener('change', sync);
    sync();

    root._marquee = () => {
      stop();
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up);
      removeEventListener('resize', onResize); MOBILE.removeEventListener('change', sync);
      delete root._marquee;
    };
    live.add(root);
  };

  const init = (scope = document) => (scope || document).querySelectorAll('[data-marquee]').forEach(setup);
  const destroy = () => { live.forEach((r) => r._marquee && r._marquee()); live.clear(); };

  if (App.register) App.register('Marquee', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
