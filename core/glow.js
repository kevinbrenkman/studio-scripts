/*!
 * glow.js 1.1.0 (kevinbrenkman/studio-scripts/core)
 * Cursor-following radial glow + rim light on buttons. Markup free: the layers are injected, so it works on any
 * button. Same idea as the Paloma glass buttons, without needing their nav_button markup.
 *
 * Use: add data-glow to a button, or set the selector on the script tag:
 *   <script src=".../core/glow.js" data-glow-selector=".btn"></script>
 * Per button or on the script tag (optional): data-glow-color="255,255,255"  data-glow-strength="0.18"
 * Rim light is off by default; data-glow-rim="0.6" turns a 1px border glow on.
 * Desktop only (hover + fine pointer), off with reduced motion. Swup / Barba safe: re-scans on DOM changes.
 */
(() => {
  if (window.__glow) return; window.__glow = true;
  const script = document.currentScript;
  const SEL = (script && script.getAttribute('data-glow-selector')) || '[data-glow]';
  const def = (k, v) => (script && script.getAttribute(k)) || v;
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const css = document.createElement('style');
  css.textContent =
    '.glow-fx{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .4s ease;z-index:0}' +
    '.glow-fx.is-on{opacity:1}' +
    // soft fill that sits under the cursor
    '.glow-fx_fill{position:absolute;inset:0;border-radius:inherit;background:radial-gradient(var(--glow-size,140px) circle at var(--gx,50%) var(--gy,50%),rgba(var(--glow-c),var(--glow-s)),transparent 70%)}' +
    // 1px rim that lights up on the side of the cursor
    '.glow-fx_rim{position:absolute;inset:0;border-radius:inherit;padding:1px;background:radial-gradient(calc(var(--glow-size,140px) * 1.2) circle at var(--gx,50%) var(--gy,50%),rgba(var(--glow-c),var(--glow-r)),transparent 70%);' +
    '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}' +
    '.glow-host{position:relative;isolation:isolate}' +
    '.glow-host>*:not(.glow-fx){position:relative;z-index:1}';
  document.head.appendChild(css);

  const setup = (el) => {
    if (el._glow) return; el._glow = true;
    if (getComputedStyle(el).position === 'static') el.classList.add('glow-host');
    else { el.style.isolation = 'isolate'; [...el.children].forEach((c) => { if (getComputedStyle(c).position === 'static') { c.style.position = 'relative'; c.style.zIndex = '1'; } }); }
    const fx = document.createElement('span');
    fx.className = 'glow-fx'; fx.setAttribute('aria-hidden', 'true');
    const rim = parseFloat(el.getAttribute('data-glow-rim') || def('data-glow-rim', '0')) || 0;
    fx.innerHTML = '<span class="glow-fx_fill"></span>' + (rim > 0 ? '<span class="glow-fx_rim"></span>' : '');
    fx.style.setProperty('--glow-c', el.getAttribute('data-glow-color') || def('data-glow-color', '255,255,255'));
    fx.style.setProperty('--glow-s', el.getAttribute('data-glow-strength') || def('data-glow-strength', '0.18'));
    fx.style.setProperty('--glow-r', String(rim));
    el.prepend(fx);
    let raf = 0, x = 0, y = 0;
    const paint = () => { raf = 0; fx.style.setProperty('--gx', x + 'px'); fx.style.setProperty('--gy', y + 'px'); };
    const move = (e) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top;
      fx.style.setProperty('--glow-size', Math.max(r.width, r.height) * 0.9 + 'px');
      if (!raf) raf = requestAnimationFrame(paint);
    };
    el.addEventListener('pointerenter', (e) => { move(e); fx.classList.add('is-on'); }, { passive: true });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', () => fx.classList.remove('is-on'), { passive: true });
  };

  const scan = () => document.querySelectorAll(SEL).forEach(setup);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', scan) : scan();
  // Page transitions swap the DOM: pick up new buttons
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 100); }).observe(document.documentElement, { childList: true, subtree: true });
})();
