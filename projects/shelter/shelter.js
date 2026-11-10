/*!
 * shelter.js 0.1.0 (kevinbrenkman/studio-scripts/projects/shelter)
 * Shelter motion, ported from Lukas's prototype. Attribute hooks only.
 *
 *   [data-logo]                 the big logo (click: loop the versions, click again: lock the one showing)
 *     [data-logo-frames]        its children are the logo versions (a slot: add an SVG and it joins the cycle)
 *     [data-logo-building]      photo shown inside the letters of version 1 while a [data-logo-hover] is hovered
 *   [data-logo-hover]           hovering it (mouse) shows the building in the logo (the "coming soon" sign)
 *   [data-scroll-arrow]         fixed arrow: scrolls down one screen, flips up at the bottom and goes to the top
 *
 * Fires 'shelter:reveal' on document (and html.is-revealed) when the logo intro is done or you start scrolling.
 */
(() => {
  if (window.__shelter) return; window.__shelter = '0.1.0';
  window.App = window.App || { inits: [], destroys: [] };
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const INTRO_MS = 90, LOOP_MS = 130;

  if (!document.getElementById('shelter-css')) {
    const st = document.createElement('style');
    st.id = 'shelter-css';
    st.textContent =
      // Logo: one version at a time (the Designer shows the first, see the Global embed)
      'html.is-logo-ready [data-logo-frames]>*{visibility:hidden}' +
      'html.is-logo-ready [data-logo-frames]>.is-on{visibility:visible}' +
      '[data-logo]{cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '[data-logo-building]{opacity:0;transition:opacity .3s ease;pointer-events:none}' +
      '[data-logo].is-building [data-logo-building]{opacity:1}' +
      'html.is-logo-ready [data-logo].is-building [data-logo-frames]>*{visibility:hidden}' +
      'html.is-logo-ready [data-logo].is-building [data-logo-frames]>:first-child{visibility:visible}' +
      // Scroll arrow
      '[data-scroll-arrow]{cursor:pointer;transition:transform .5s ' + SPRING + '}' +
      '@media (hover:hover){[data-scroll-arrow]:hover{transform:translateY(.375em)}[data-scroll-arrow].is-up:hover{transform:rotate(180deg) translateY(.375em)}}' +
      '[data-scroll-arrow].is-up{transform:rotate(180deg)}';
    document.head.appendChild(st);
  }

  /* ---------- Reveal: after the logo intro, or as soon as you scroll ---------- */
  let revealed = false;
  const reveal = () => {
    if (revealed) return; revealed = true;
    html.classList.add('is-revealed');
    document.dispatchEvent(new CustomEvent('shelter:reveal'));
  };
  const onWheel = (e) => { if (e.deltaY > 0) reveal(); };
  const onKey = (e) => { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) reveal(); };
  const onScroll = () => { if (scrollY > 4) reveal(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('wheel', onWheel, { passive: true });
  addEventListener('touchmove', reveal, { passive: true });
  addEventListener('keydown', onKey);

  /* ---------- Logo ---------- */
  const logo = (root) => {
    if (root._logo) return;
    const box = root.querySelector('[data-logo-frames]');
    const frames = box ? [...box.children] : [];
    if (frames.length < 2) { reveal(); return; }
    html.classList.add('is-logo-ready');
    let cur = 0, timer = null;
    const show = (i) => { frames[cur].classList.remove('is-on'); cur = (i + frames.length) % frames.length; frames[cur].classList.add('is-on'); };
    frames.forEach((f, i) => f.classList.toggle('is-on', i === 0));
    const stop = () => { clearInterval(timer); timer = null; root.setAttribute('aria-pressed', 'false'); };
    const loop = () => { stop(); timer = setInterval(() => show(cur + 1), LOOP_MS); root.setAttribute('aria-pressed', 'true'); };
    const toggle = (e) => { if (e) e.preventDefault(); timer ? stop() : loop(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); };
    if (!root.hasAttribute('role')) root.setAttribute('role', 'button');
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
    root.addEventListener('click', toggle);
    root.addEventListener('keydown', key);

    // On load: one fast pass through all versions, back to the first, then reveal the page
    if (RM || revealed) reveal();
    else {
      let step = 0;
      timer = setInterval(() => {
        step++; show(step);
        if (step >= frames.length) { stop(); setTimeout(reveal, 150); }
      }, INTRO_MS);
    }

    // Hovering the sign shows the building inside the letters (version 1)
    const hovers = [...document.querySelectorAll('[data-logo-hover]')];
    const on = (e) => { if (e.pointerType === 'mouse' && !html.classList.contains('is-drawing')) root.classList.add('is-building'); };
    const off = () => root.classList.remove('is-building');
    hovers.forEach((h) => { h.addEventListener('pointerenter', on); h.addEventListener('pointerleave', off); });

    root._logo = () => {
      stop(); root.removeEventListener('click', toggle); root.removeEventListener('keydown', key);
      hovers.forEach((h) => { h.removeEventListener('pointerenter', on); h.removeEventListener('pointerleave', off); });
      delete root._logo;
    };
  };

  /* ---------- Scroll arrow ---------- */
  const arrow = (btn) => {
    if (btn._arrow) return;
    const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    const update = () => {
      const up = atBottom();
      btn.classList.toggle('is-up', up);
      btn.setAttribute('aria-label', up ? 'Terug naar boven' : 'Scroll naar beneden');
    };
    const click = (e) => {
      e.preventDefault(); reveal();
      const to = atBottom() ? 0 : scrollY + innerHeight * 0.85;
      if (window.lenis && !RM) lenis.scrollTo(to, { duration: 1.1 });
      else scrollTo({ top: to, behavior: RM ? 'auto' : 'smooth' });
    };
    btn.addEventListener('click', click);
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    btn._arrow = () => { btn.removeEventListener('click', click); removeEventListener('scroll', update); removeEventListener('resize', update); delete btn._arrow; };
  };

  const init = (scope = document) => {
    (scope || document).querySelectorAll('[data-logo]').forEach(logo);
    document.querySelectorAll('[data-scroll-arrow]').forEach(arrow); // fixed UI lives outside #swup
  };
  const destroy = () => {
    document.querySelectorAll('[data-logo]').forEach((r) => r._logo && r._logo());
  };

  if (App.register) App.register('Shelter', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
