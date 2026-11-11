/*!
 * hover-fx.js 1.0.2 (kevinbrenkman/studio-scripts/core)
 * Small cursor effects with GSAP. Desktop (fine pointer) only, off with reduced motion. Needs GSAP (Webflow site setting).
 *
 * Magnetic  [data-magnetic]            pulled towards the cursor, springs back on leave (Paloma MailMagnet)
 *             data-magnetic-x="0.3"     share of the cursor distance it travels (x / y), default 0.3 / 0.35
 *             data-magnetic-margin="40" px around it where it already reacts
 * Follow    [data-follow="1"]          leans and drifts a little towards the cursor, wherever it is (the value = strength)
 * LinkTilt  text links                 tilt a few degrees with a bouncy ease on hover, randomly left or right.
 *                                       Every <a> with only text in it, except UI links (cards, arrows, dots, buttons...).
 *                                       Opt out: data-no-tilt. Inline links become inline-block so they can rotate.
 */
(() => {
  if (window.__studioHoverFx) return; window.__studioHoverFx = '1.0.2';
  window.App = window.App || { inits: [], destroys: [] };
  const ok = () => window.gsap && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const em = () => parseFloat(getComputedStyle(document.body).fontSize) || 16;

  /* ---------- Magnetic ---------- */
  const magnets = new Set();
  const magnet = (a) => {
    if (a._mag || !ok()) return;
    const n = (k, d) => { const v = parseFloat(a.getAttribute('data-magnetic-' + k)); return isNaN(v) ? d : v; };
    const fx = n('x', 0.3), fy = n('y', 0.35), m = n('margin', 40);
    let on = false;
    const leave = () => { on = false; gsap.to(a, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' }); };
    const move = (e) => {
      const r = a.getBoundingClientRect(), ox = gsap.getProperty(a, 'x'), oy = gsap.getProperty(a, 'y');
      const L = r.left - ox, T = r.top - oy; // resting box, so it never runs away from the cursor
      const inside = e.clientX > L - m && e.clientX < L + r.width + m && e.clientY > T - m && e.clientY < T + r.height + m;
      if (!inside) { if (on) leave(); return; }
      on = true;
      gsap.to(a, { x: (e.clientX - (L + r.width / 2)) * fx, y: (e.clientY - (T + r.height / 2)) * fy, duration: 0.8, ease: 'power3', overwrite: 'auto' });
    };
    const out = () => on && leave();
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', out);
    a._mag = () => { document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', out); gsap.killTweensOf(a); gsap.set(a, { clearProps: 'x,y' }); delete a._mag; };
    magnets.add(a);
  };

  /* ---------- Follow (balloons) ---------- */
  const followers = new Set();
  let raf = 0, mx = null, my = null;
  const followTick = () => {
    raf = 0; if (mx === null) return;
    const R = Math.max(innerWidth, innerHeight) * 0.7, maxT = 0.6 * em();
    followers.forEach((el) => {
      const k = parseFloat(el.getAttribute('data-follow')) || 1;
      const r = el.getBoundingClientRect(), ox = gsap.getProperty(el, 'x'), oy = gsap.getProperty(el, 'y');
      const dx = mx - (r.left - ox + r.width / 2), dy = my - (r.top - oy + r.height / 2);
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / R); // stronger when the cursor is close
      const cl = (v, a) => Math.max(-a, Math.min(a, v));
      el._fx.x(cl(dx * 0.05 * k * near, maxT * k));
      el._fx.y(cl(dy * 0.04 * k * near, maxT * k));
      el._fx.r((el._fx.r0 || 0) + cl((dx / R) * 8 * k * (0.4 + near), 5 * k)); // on top of its own rotation (e.g. a mobile -90deg)
    });
  };
  const onMove = (e) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(followTick); };
  const onOut = () => { mx = null; followers.forEach((el) => { el._fx.x(0); el._fx.y(0); el._fx.r(el._fx.r0 || 0); }); };
  let followOn = false;
  const follow = (el) => {
    if (el._fx || !ok()) return;
    el._fx = {
      x: gsap.quickTo(el, 'x', { duration: 1.1, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 1.1, ease: 'power3.out' }),
      r: gsap.quickTo(el, 'rotation', { duration: 1.4, ease: 'elastic.out(1, 0.5)' }),
      r0: gsap.getProperty(el, 'rotation') || 0
    };
    followers.add(el);
    if (!followOn) { followOn = true; document.addEventListener('pointermove', onMove, { passive: true }); document.documentElement.addEventListener('pointerleave', onOut); }
  };

  /* ---------- LinkTilt ---------- */
  const SKIP = '[data-no-tilt],[data-drawer-link],[data-drawer-close],[data-drawer-ticket],[data-theme-set],[data-scroll-arrow],[data-slider-prev],[data-slider-next],[data-draw-toggle],[data-magnetic],[data-logo]';
  const isTextLink = (a) => a.matches('a[href]') && !a.matches(SKIP) && !a.querySelector('img,svg,video,picture,div,canvas') && a.textContent.trim();
  const prep = (a) => { if (a._tilt) return; a._tilt = 1; if (getComputedStyle(a).display === 'inline') a.style.display = 'inline-block'; };
  const tiltIn = (e) => {
    const a = e.target.closest && e.target.closest('a'); if (!a || !ok() || (e.relatedTarget && a.contains(e.relatedTarget)) || !isTextLink(a)) return;
    prep(a);
    const dir = Math.random() < 0.5 ? -1 : 1;
    gsap.to(a, { rotation: dir * gsap.utils.random(2.5, 4.5), duration: 0.7, ease: 'elastic.out(1.1, 0.4)', overwrite: 'auto' });
  };
  const tiltOut = (e) => {
    const a = e.target.closest && e.target.closest('a'); if (!a || !a._tilt || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    gsap.to(a, { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
  };
  // Delegated: works for links added later (CMS, drawer, Swup pages)
  document.addEventListener('pointerover', tiltIn, { passive: true });
  document.addEventListener('pointerout', tiltOut, { passive: true });

  const init = (scope = document) => {
    if (!window.gsap) return;
    document.querySelectorAll('[data-magnetic]').forEach(magnet);
    document.querySelectorAll('[data-follow]').forEach(follow);
    // inline-block up front (no reflow on hover); desktop only, so phones keep their normal text wrapping
    if (ok()) (scope || document).querySelectorAll('a[href]').forEach((a) => { if (isTextLink(a)) prep(a); });
  };
  const destroy = () => {
    magnets.forEach((a) => a._mag && a._mag()); magnets.clear();
    followers.forEach((el) => { if (!el.isConnected) { gsap.killTweensOf(el); delete el._fx; followers.delete(el); } });
  };

  if (App.register) App.register('HoverFx', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
