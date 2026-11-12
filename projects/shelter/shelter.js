/*!
 * shelter.js 0.7.0 (kevinbrenkman/studio-scripts/projects/shelter)
 * Shelter motion, ported from Lukas's prototype. Attribute hooks only, no classes.
 *
 * Logo
 *   [data-logo]                 click: loop the versions, click again: lock the one showing. Plays once on load.
 *     [data-logo-base]          version 1, the fixed logo with the cut-out (optional; else: the logo image outside the slot)
 *     [data-logo-frames]        its children are the other versions (a slot: a new SVG joins the cycle)
 *     [data-logo-building]      photo inside the letters of version 1 while a [data-logo-hover] is hovered
 *   [data-logo-hover]           hovering it (mouse) shows the building (the "coming soon" sign)
 * Reveal (after the logo intro, or as soon as you scroll): html.is-revealed + 'shelter:reveal' on document
 *   [data-reveal="sign"]        grows from its nail, swings on hover
 *   [data-reveal="pop"]         pops in (the draw balloon)
 *   [data-reveal="product"]     outline drawing first, then the photo pops in, when it scrolls into view (.is-in)
 *     [data-reveal-outline]     the outline drawing inside it
 *   data-hover-tilt="-4"        on a product: scale + rotate (deg) on hover
 * Idle + hover
 *   [data-bob]                  bobs gently
 *   data-hover-grow="1.06"      grows a little on hover
 * Text
 *   [data-outline-text]         split into [data-outline-word] spans (letters merge within a word only)
 *   [data-ticker]               under 768px: scrolls as one line (its text, plus [data-ticker-add] texts)
 * Colour
 *   [data-theme-set="pink"]     sets html[data-theme], kept in sessionStorage, iOS Safari toolbar follows
 * SVG
 *   img[data-inline-svg]        inlined so its white fill follows the page colour (also every logo version)
 * Fixed UI
 *   [data-scroll-arrow]         scrolls down one screen, flips up at the bottom and goes to the top
 * Draw your Shelter (prototype: red marker on the outline logo, under the logo's black line)
 *   [data-draw-toggle]          the balloon: draw / "save it" (the drawing fades out, drawing again brings it back)
 *     data-draw-mobile="false"  hidden under 768px (Global embed CSS, bound to the Header prop "Draw on mobile")
 *   Drawing covers the whole screen and holds the page at the top. Live only, built by this file: the canvas inside [data-logo], the "save it" balloon, the hint with "Wissen".
 *   Strokes are stored in logo coordinates (1512 x 520) and kept in localStorage (back after a reload or a new visit).
 */
(() => {
  if (window.__shelter) return; window.__shelter = '0.7.0';
  window.App = window.App || { inits: [], destroys: [] };
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const INTRO_MS = 90, LOOP_MS = 130;
  const KEY = 'shelter-theme';
  html.classList.add('is-shelter-js');

  if (!document.getElementById('shelter-css')) {
    const st = document.createElement('style');
    st.id = 'shelter-css';
    st.textContent = [
      // Logo: one version at a time (the Designer shows the first, see the Global embed)
      'html.is-logo-ready [data-logo-frame]{visibility:hidden}',
      'html.is-logo-ready [data-logo-frame].is-on{visibility:visible}',
      '[data-logo]{cursor:pointer;-webkit-tap-highlight-color:transparent;outline-offset:4px}',
      '[data-logo-building]{opacity:0;transition:opacity .3s ease;pointer-events:none}',
      '[data-logo].is-building [data-logo-building]{opacity:1}',
      'html.is-logo-ready [data-logo].is-building [data-logo-frame]{visibility:hidden}',
      'html.is-logo-ready [data-logo].is-building [data-logo-base]{visibility:visible}',
      // Reveal (hidden states live in the site head so nothing flashes before this file loads)
      '@keyframes sh-sign{0%{scale:0;rotate:-3deg}60%{scale:1.04;rotate:3deg}100%{scale:1;rotate:0deg}}',
      '@keyframes sh-swing{0%,100%{rotate:0deg}25%{rotate:4deg}75%{rotate:-3deg}}',
      '@keyframes sh-pop{from{scale:0;rotate:-20deg}to{scale:1;rotate:0deg}}',
      '@keyframes sh-bob{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -.25em;rotate:-1.2deg}}',
      '[data-reveal="sign"]{transform-origin:41.4% 5.3%}',
      'html.is-revealed [data-reveal="sign"]{animation:sh-sign .65s ease-out .2s backwards}',
      // Hover keeps sh-sign first in the list: the browser then keeps that (finished) entrance as is instead of
      // replaying it when the mouse leaves. Only the swing is added and removed (prototype: entrance on load only).
      '@media (hover:hover){[data-reveal="sign"]:hover{animation:sh-swing 1.6s ease-in-out infinite}html.is-revealed [data-reveal="sign"]:hover{animation:sh-sign .65s ease-out .2s backwards,sh-swing 1.6s ease-in-out infinite}}',
      'html.is-revealed [data-reveal="pop"]{animation:sh-pop .7s ' + SPRING + ' .55s backwards}',
      '[data-reveal="product"]{transition:scale .5s ' + SPRING + ',rotate .5s ' + SPRING + '}',
      '[data-reveal="product"] img:not([data-reveal-outline]){transition:opacity .3s ease var(--sh-d,0s),scale .7s ' + SPRING + ' var(--sh-d,0s),rotate .7s ' + SPRING + ' var(--sh-d,0s)}',
      '[data-reveal-outline]{pointer-events:none;transition:opacity .3s ease var(--sh-d,0s),scale .45s ease var(--sh-d,0s)}',
      // Products play in when they scroll into view (.is-in), not all at once on load
      '[data-reveal="product"].is-in [data-reveal-outline]{opacity:0;scale:1.1}',
      '@media (hover:hover){[data-reveal="product"].is-in[data-hover-tilt]:hover{scale:1.08;rotate:var(--sh-tilt,0deg)}}',
      // Idle + hover
      '[data-bob]{animation:sh-bob 3.4s ease-in-out infinite}',
      '[data-hover-grow]{transition:scale .45s ' + SPRING + '}',
      '@media (hover:hover){[data-hover-grow]:hover{scale:var(--sh-grow,1.06)}}',
      // Ticker (mobile)
      '@keyframes sh-ticker{to{transform:translateX(-50%)}}',
      '[data-ticker].is-ticking{overflow:hidden;white-space:nowrap}',
      '[data-ticker] [data-ticker-track]{display:inline-flex;animation:sh-ticker 18s linear infinite}',
      '[data-ticker] [data-ticker-track]>span{padding-right:1em}',
      // Inline SVG: white fill follows the page colour
      '[data-inline-svg-done]{color:var(--_colors---page)}',
      // Colour dots
      '[data-theme-set]{cursor:pointer;transition:scale .25s ' + SPRING + '}',
      '@media (hover:hover){[data-theme-set]:hover{scale:1.15}}',
      // Scroll arrow
      '[data-scroll-arrow]{cursor:pointer;transition:transform .5s ' + SPRING + '}',
      '@media (hover:hover){[data-scroll-arrow]:hover{transform:translateY(.375em)}[data-scroll-arrow].is-up:hover{transform:rotate(180deg) translateY(.375em)}}',
      '[data-scroll-arrow].is-up{transform:rotate(180deg)}',
      // Draw your Shelter
      '@keyframes sh-nudge{0%,100%{rotate:0deg}50%{rotate:-5deg}}',
      // Full screen while drawing (no lines cut off at the logo edge); the page is held at the top meanwhile
      '[data-draw-layer]{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:1;pointer-events:none;transition:opacity .45s ease}',
      '[data-draw-layer].is-hidden{opacity:0}',
      'html.is-drawing [data-draw-layer]{pointer-events:auto;touch-action:none;cursor:crosshair}',
      // The marker sits under the logo (the canvas comes first in [data-logo]); the logo lets the pointer through
      'html.is-drawing [data-logo] [data-logo-frame],html.is-drawing [data-logo] [data-logo-frames]{pointer-events:none}',
      // The coming soon sign hangs over the logo: let the marker draw under it
      'html.is-drawing [data-reveal="sign"]{pointer-events:none}',
      // Hint (prototype): fixed at the bottom while drawing. Same font and weight as the pills
      '[data-draw-hint]{position:fixed;left:50%;bottom:calc(1.25em + env(safe-area-inset-bottom,0px));z-index:12;display:flex;gap:.375em;align-items:center;opacity:0;transform:translate(-50%,.75em);pointer-events:none;transition:opacity .25s ease,transform .35s ' + SPRING + '}',
      'html.is-drawing [data-draw-hint]{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
      '[data-draw-hint]>*{box-sizing:border-box;height:2em;margin:0;padding:0 .8em;display:inline-flex;align-items:center;border:2px solid var(--_colors---ink);border-radius:50em;font-family:var(--_typography---font-round);font-weight:400;font-size:1.25em;line-height:1;letter-spacing:-.03em;white-space:nowrap}',
      '[data-draw-hint]>span{background:var(--_colors---ink);color:var(--_colors---page)}',
      '[data-draw-hint]>button{background:var(--_colors---page);color:var(--_colors---ink);cursor:pointer;transition:transform .25s ' + SPRING + '}',
      '@media (hover:hover){[data-draw-hint]>button:hover{transform:scale(1.06)}}',
      '@media (max-width:767px){[data-draw-hint]{bottom:calc(4.75em + env(safe-area-inset-bottom,0px));flex-direction:column}[data-draw-hint]>*{font-size:.9375em;height:2.1333em}}',
      '[data-draw-toggle]{cursor:pointer}',
      '[data-draw-toggle]>[data-draw-save]{display:none}',
      'html.is-drawing [data-draw-toggle]{z-index:8;scale:1.06;animation:sh-nudge 1.6s ease-in-out infinite}',
      // Same trick as the sign: keep the (finished) pop-in in the list so it does not replay after drawing
      'html.is-revealed.is-drawing [data-draw-toggle]{animation:sh-pop .7s ' + SPRING + ' .55s backwards,sh-nudge 1.6s ease-in-out infinite}',
      'html.is-drawing [data-draw-toggle]>:not([data-draw-save]){display:none!important}',
      'html.is-drawing [data-draw-toggle]>[data-draw-save]{display:block!important}',
      '@media (prefers-reduced-motion:reduce){html.is-drawing [data-draw-toggle]{animation:none!important}}',
      '@media (prefers-reduced-motion:reduce){[data-bob],[data-ticker] [data-ticker-track],html.is-revealed [data-reveal]{animation:none!important}}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ---------- Reveal ---------- */
  let revealed = html.classList.contains('is-revealed');
  const reveal = () => {
    if (revealed) return; revealed = true;
    html.classList.add('is-revealed');
    document.dispatchEvent(new CustomEvent('shelter:reveal'));
  };
  addEventListener('scroll', () => { if (scrollY > 4) reveal(); }, { passive: true });
  addEventListener('wheel', (e) => { if (e.deltaY > 0) reveal(); }, { passive: true });
  addEventListener('touchmove', reveal, { passive: true });
  addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) reveal(); });

  /* ---------- Products: play in on scroll into view (after the logo intro) ---------- */
  let seen = [], io = null;
  const playIn = () => {
    if (!revealed || !seen.length) return;
    // Stagger the ones that come in together. Wait for the photo (lazy images can land after the pop, then it just appears)
    seen.forEach((p, i) => {
      const img = p.querySelector('img:not([data-reveal-outline])');
      const go = () => { p.style.setProperty('--sh-d', (i * 0.12) + 's'); requestAnimationFrame(() => p.classList.add('is-in')); };
      if (!img || (img.complete && img.naturalWidth)) go();
      else { let done = false; const once = () => { if (!done) { done = true; go(); } }; img.addEventListener('load', once, { once: true }); img.addEventListener('error', once, { once: true }); setTimeout(once, 2500); }
    });
    seen = [];
  };
  document.addEventListener('shelter:reveal', playIn);
  const product = (p) => {
    if (p._in) return; p._in = true;
    p.querySelectorAll('img').forEach((im) => { im.loading = 'eager'; }); // three photos: load them up front so the pop plays with the photo
    if (RM || !('IntersectionObserver' in window)) { p.classList.add('is-in'); return; }
    if (!io) io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); seen.push(en.target); } });
      playIn();
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
    io.observe(p);
  };

  /* ---------- Inline SVG ---------- */
  const svgCache = new Map();
  const inline = (img) => {
    if (img._inl || !img.src || !/\.svg(\?|$)/i.test(img.src)) return; img._inl = true;
    if (!svgCache.has(img.src)) svgCache.set(img.src, fetch(img.src).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));
    svgCache.get(img.src).then((txt) => {
      if (!img.isConnected) return;
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const svg = doc.documentElement; if (!svg || svg.nodeName.toLowerCase() !== 'svg') return;
      svg.querySelectorAll('[fill]').forEach((n) => { if (/^(#fff(fff)?|white)$/i.test(n.getAttribute('fill'))) n.setAttribute('fill', 'currentColor'); });
      svg.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); // ids repeat across versions
      // Figma exports sometimes hold empty paths with a layer name as path data (d="Vector"): drop them (console errors)
      svg.querySelectorAll('path').forEach((n) => { if (!/^\s*[Mm]/.test(n.getAttribute('d') || '')) n.remove(); });
      [...img.attributes].forEach((a) => { if (!['src', 'srcset', 'sizes', 'loading', 'alt', 'width', 'height'].includes(a.name)) svg.setAttribute(a.name, a.value); });
      svg.setAttribute('data-inline-svg-done', '');
      if (img.alt) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', img.alt); } else svg.setAttribute('aria-hidden', 'true');
      if (img.classList.contains('is-on')) svg.classList.add('is-on');
      img.replaceWith(document.importNode(svg, true));
    }).catch(() => {});
  };

  /* ---------- Logo ---------- */
  const logo = (root) => {
    if (root._logo) return;
    const box = root.querySelector('[data-logo-frames]');
    const outside = [...root.querySelectorAll('img, svg')].filter((i) => (!box || !box.contains(i)) && !(i.parentElement && i.parentElement.closest('svg')));
    // Version 1 (fixed, outside the slot): the hook, or else the first image outside the slot that is not the photo
    if (box) [...box.querySelectorAll('[data-logo-base]')].forEach((f) => f.removeAttribute('data-logo-base')); // versions in the slot are never the base
    let base = outside.find((i) => i.hasAttribute('data-logo-base')) || outside.find((i) => !i.hasAttribute('data-logo-building'));
    if (base) base.setAttribute('data-logo-base', '');
    // Building photo: the hook, or else the other image outside the slot
    if (!root.querySelector('[data-logo-building]')) { const b = outside.find((i) => i !== base); if (b) b.setAttribute('data-logo-building', ''); }
    const frames = () => [root.querySelector('[data-logo-base]'), ...(box ? box.children : [])].filter(Boolean).map((f) => { f.setAttribute('data-logo-frame', ''); return f; });
    if (frames().length < 2) { reveal(); return; }
    html.classList.add('is-logo-ready');
    let cur = 0, timer = null;
    const show = (i) => { const f = frames(); f[cur] && f[cur].classList.remove('is-on'); cur = (i + f.length) % f.length; f[cur].classList.add('is-on'); };
    frames().forEach((f, i) => f.classList.toggle('is-on', i === 0));
    const stop = () => { clearInterval(timer); timer = null; root.setAttribute('aria-pressed', 'false'); };
    const loop = () => { stop(); timer = setInterval(() => show(cur + 1), LOOP_MS); root.setAttribute('aria-pressed', 'true'); };
    const toggle = (e) => { if (html.classList.contains('is-drawing')) return; if (e) e.preventDefault(); timer ? stop() : loop(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); };
    if (!root.hasAttribute('role')) root.setAttribute('role', 'button');
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
    root.addEventListener('click', toggle);
    root.addEventListener('keydown', key);
    // Every version gets inlined, so its fill follows the page colour
    frames().forEach((f) => { if (f.tagName === 'IMG') inline(f); });

    if (RM || revealed) reveal();
    else {
      let step = 0;
      const n = frames().length;
      timer = setInterval(() => { step++; show(step); if (step >= n) { stop(); setTimeout(reveal, 150); } }, INTRO_MS);
    }

    // Delegated, so it keeps working when the sign image is swapped for its inline SVG
    const on = (e) => { if (e.pointerType === 'mouse' && e.target.closest('[data-logo-hover]') && !html.classList.contains('is-drawing')) root.classList.add('is-building'); };
    const off = (e) => { const h = e.target.closest('[data-logo-hover]'); if (h && !h.contains(e.relatedTarget)) root.classList.remove('is-building'); };
    document.addEventListener('pointerover', on); document.addEventListener('pointerout', off);
    root._logoApi = { show, stop };
    root._logo = () => {
      stop(); root.removeEventListener('click', toggle); root.removeEventListener('keydown', key);
      document.removeEventListener('pointerover', on); document.removeEventListener('pointerout', off);
      delete root._logo;
    };
  };

  /* ---------- Outline text: one span per word ---------- */
  const splitWords = (el) => {
    if (el._split) return; el._split = true;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach((t) => {
      const parts = t.textContent.split(/(\s+)/);
      if (parts.length < 2 && !parts[0].trim()) return;
      const frag = document.createDocumentFragment();
      parts.forEach((p) => {
        if (!p) return;
        if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
        else { const s = document.createElement('span'); s.setAttribute('data-outline-word', ''); s.setAttribute('aria-hidden', 'true'); s.textContent = p; frag.appendChild(s); }
      });
      t.replaceWith(frag);
    });
  };

  /* ---------- Ticker (mobile) ---------- */
  const ticker = (el) => {
    if (el._ticker) return;
    const original = el.innerHTML;
    const text = (n) => { const c = n.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith(' ')); return c.textContent.replace(/\s+/g, ' ').trim(); };
    const sync = () => {
      if (MOBILE.matches && !el.classList.contains('is-ticking')) {
        const items = [text(el), ...[...document.querySelectorAll('[data-ticker-add]')].map(text)].filter(Boolean);
        const set = items.map((t) => '<span>' + t.replace(/</g, '&lt;') + '</span>').join('');
        el.innerHTML = '<span data-ticker-track>' + set + set + '</span>';
        el.classList.add('is-ticking');
      } else if (!MOBILE.matches && el.classList.contains('is-ticking')) { el.innerHTML = original; el.classList.remove('is-ticking'); }
    };
    MOBILE.addEventListener('change', sync); sync();
    el._ticker = () => { MOBILE.removeEventListener('change', sync); if (el.classList.contains('is-ticking')) { el.innerHTML = original; el.classList.remove('is-ticking'); } delete el._ticker; };
  };

  /* ---------- Colour ---------- */
  const setTheme = (name) => {
    if (!name) return;
    html.setAttribute('data-theme', name);
    try { sessionStorage.setItem(KEY, name); } catch (e) {}
    // iOS Safari tints its toolbar from the page background / theme-color
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      let m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      m.content = bg;
    });
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === name ? 'true' : 'false'));
  };
  // Capture + stop: the dots are links with href="#", so nothing else (Swup, anchor scrolling) jumps to the top
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-set]'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); setTheme(b.getAttribute('data-theme-set'));
  }, true);

  /* ---------- Scroll arrow ---------- */
  const arrow = (btn) => {
    if (btn._arrow) return;
    const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    const update = () => { const up = atBottom(); btn.classList.toggle('is-up', up); btn.setAttribute('aria-label', up ? 'Terug naar boven' : 'Scroll naar beneden'); };
    const click = (e) => {
      e.preventDefault(); reveal();
      const to = atBottom() ? 0 : scrollY + innerHeight * 0.85;
      if (window.lenis && !RM) lenis.scrollTo(to, { duration: 1.1 }); else scrollTo({ top: to, behavior: RM ? 'auto' : 'smooth' });
    };
    btn.addEventListener('click', (e) => { e.stopImmediatePropagation(); click(e); }, true);
    addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
    btn._arrow = true;
  };

  /* ---------- Sign: keeps swinging after the hover and settles ---------- */
  // While hovered the CSS swing runs (1.6s: 0, 4deg, -3deg, 0). On leave it would stop dead, so this picks up the angle
  // it was at and lets it swing out in smaller and smaller arcs.
  const SWING = [[0, 0], [0.25, 4], [0.75, -3], [1, 0]];
  const swingAt = (t) => { // eased angle at 0..1 of the CSS swing
    for (let i = 1; i < SWING.length; i++) {
      const [t1, a1] = SWING[i], [t0, a0] = SWING[i - 1];
      if (t <= t1) { const k = (t - t0) / (t1 - t0), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; return a0 + (a1 - a0) * e; }
    }
    return 0;
  };
  let swingFrom = 0;
  document.addEventListener('pointerover', (e) => {
    const s = e.target.closest && e.target.closest('[data-reveal="sign"]');
    if (!s || (e.relatedTarget && s.contains(e.relatedTarget)) || e.pointerType !== 'mouse') return;
    if (s._settle) { s._settle.cancel(); s._settle = null; }
    swingFrom = performance.now();
  });
  document.addEventListener('pointerout', (e) => {
    const s = e.target.closest && e.target.closest('[data-reveal="sign"]');
    if (!s || (e.relatedTarget && s.contains(e.relatedTarget)) || e.pointerType !== 'mouse' || RM || !s.animate) return;
    const t = ((performance.now() - swingFrom) % 1600) / 1600, a = swingAt(t);
    const dir = t < 0.25 || t > 0.75 ? 1 : -1; // where it was heading
    const amp = Math.max(Math.abs(a), 2.5);
    const peaks = [a, dir * amp * 0.8, -dir * amp * 0.5, dir * amp * 0.28, -dir * amp * 0.12, 0];
    s._settle = s.animate(peaks.map((deg, i) => ({ rotate: deg + 'deg', offset: i / (peaks.length - 1), easing: 'ease-in-out' })), { duration: 2000 });
    s._settle.onfinish = () => { s._settle = null; };
  });

  /* ---------- Draw your Shelter ---------- */
  const STROKE = 26, INK = '#ff0000', W = 1512, H = 520; // prototype: line width in logo px, red marker
  const SAVE_SVG = 'https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@7c00808/projects/shelter/assets/balloon-save.svg';
  const draw = (toggle) => {
    if (toggle._draw) return;
    const root = document.querySelector('[data-logo]'); if (!root) return;
    let canvas = root.querySelector('[data-draw-layer]');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.setAttribute('data-draw-layer', ''); canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'is-hidden'; root.prepend(canvas); }
    const ctx = canvas.getContext('2d');
    // Hint (copy from the prototype), live only
    let hint = document.querySelector('[data-draw-hint]');
    if (!hint) {
      hint = document.createElement('div'); hint.setAttribute('data-draw-hint', ''); hint.setAttribute('role', 'status');
      hint.innerHTML = '<span>Teken op het logo \u00b7 klik \u2018save it\u2019 om te bewaren</span><button type="button" data-draw-clear>Wissen</button>';
      document.body.appendChild(hint);
    }
    // No "save it" image in the Designer yet: add the prototype's (pinned), styled like the draw image
    if (!toggle.querySelector('[data-draw-save]')) {
      const first = toggle.firstElementChild, im = document.createElement('img');
      im.src = SAVE_SVG; im.alt = 'Save it'; im.setAttribute('data-draw-save', ''); im.setAttribute('data-inline-svg', ''); im.setAttribute('data-bob', '');
      if (first) im.className = first.getAttribute('class') || '';
      toggle.appendChild(im); inline(im);
    }
    let strokes = [], drawing = false, live = null;
    // Kept in this browser (localStorage), so the drawing is still there after a reload or another visit
    const DKEY = 'shelter-drawing', MAX = 400000;
    try { const v = JSON.parse(localStorage.getItem(DKEY) || '[]'); if (Array.isArray(v)) strokes = v.filter((st) => Array.isArray(st) && st.length); } catch (e) {}
    const store = () => {
      try {
        let txt = JSON.stringify(strokes);
        while (txt.length > MAX && strokes.length > 1) { strokes.shift(); txt = JSON.stringify(strokes); } // too big: oldest lines go first
        if (strokes.length) localStorage.setItem(DKEY, txt); else localStorage.removeItem(DKEY);
      } catch (e) {}
    };

    const strokePath = (pts) => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { // smooth through the midpoints
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.stroke();
    };
    // The canvas covers the screen; strokes stay in logo coordinates (relative to [data-logo]), so they keep their place
    const box = () => root.getBoundingClientRect();
    const redraw = () => {
      const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width), b = box(), c = canvas.getBoundingClientRect();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * b.width / W, 0, 0, dpr * b.height / H, dpr * (b.left - c.left), dpr * (b.top - c.top));
      ctx.strokeStyle = INK; ctx.lineWidth = STROKE; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      strokes.forEach(strokePath);
    };
    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      redraw();
    };
    const toLogo = (e) => { const r = box(); return [Math.round((e.clientX - r.left) / r.width * W * 10) / 10, Math.round((e.clientY - r.top) / r.height * H * 10) / 10]; };
    const down = (e) => { if (!drawing) return; e.preventDefault(); e.stopPropagation(); canvas.setPointerCapture(e.pointerId); live = [toLogo(e)]; strokes.push(live); redraw(); };
    const move = (e) => { if (!live) return; const co = e.getCoalescedEvents ? e.getCoalescedEvents() : []; (co.length ? co : [e]).forEach((ev) => live.push(toLogo(ev))); redraw(); };
    const end = () => { if (live) { live = null; store(); } };
    const swallow = (e) => { if (drawing) { e.preventDefault(); e.stopPropagation(); } }; // no logo cycling while drawing
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('click', swallow);

    const setDrawing = (on) => {
      drawing = on;
      html.classList.toggle('is-drawing', on);
      root.classList.remove('is-building');
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', on ? 'Save it: tekening bewaren' : 'Draw your Shelter: teken op het logo');
      // Hold the page at the top while drawing. Mouse: Lenis stops. Touch: the canvas covers the screen with touch-action:none,
      // so nothing scrolls (no lenis.stop there: its overflow lock turns the iOS Safari toolbars into solid bars)
      if (on) { if (window.lenis) lenis.scrollTo(0, { immediate: true, force: true }); else scrollTo(0, 0); }
      if (window.lenis && FINE) on ? lenis.stop() : lenis.start();
    };
    const click = (e) => {
      e.preventDefault(); e.stopImmediatePropagation(); reveal();
      if (!drawing) {
        // Always draw on the outline logo (version 1), and show the saved drawing again
        if (root._logoApi) { root._logoApi.stop(); root._logoApi.show(0); }
        canvas.classList.remove('is-hidden'); setDrawing(true); size(); requestAnimationFrame(size);
        return;
      }
      setDrawing(false); canvas.classList.add('is-hidden'); store(); // save it: fades out, kept for the next round and the next visit
    };
    const clear = (e) => { const c = e.target.closest('[data-draw-clear]'); if (!c) return; e.preventDefault(); e.stopImmediatePropagation(); strokes = []; live = null; redraw(); store(); };
    const key = (e) => { if (e.key === 'Escape' && drawing) { setDrawing(false); canvas.classList.add('is-hidden'); } };
    toggle.addEventListener('click', click, true);
    document.addEventListener('click', clear, true);
    addEventListener('keydown', key);
    const ro = new ResizeObserver(size); ro.observe(canvas); size();
    toggle.setAttribute('role', 'button'); toggle.setAttribute('aria-pressed', 'false');
    toggle._draw = () => {
      if (drawing) setDrawing(false);
      ro.disconnect(); toggle.removeEventListener('click', click, true); document.removeEventListener('click', clear, true); removeEventListener('keydown', key);
      canvas.remove(); hint.remove(); delete toggle._draw;
    };
  };

  /* ---------- Init ---------- */
  const init = (scope = document) => {
    const s = scope || document;
    document.querySelectorAll('img[data-inline-svg]').forEach(inline); // also the fixed UI outside #swup
    s.querySelectorAll('[data-outline-text]').forEach(splitWords);
    s.querySelectorAll('[data-reveal="product"]').forEach((p) => {
      const t = p.getAttribute('data-hover-tilt'); if (t) p.style.setProperty('--sh-tilt', t + 'deg');
      product(p);
    });
    s.querySelectorAll('[data-hover-grow]').forEach((el) => { const v = el.getAttribute('data-hover-grow'); if (v) el.style.setProperty('--sh-grow', v); });
    s.querySelectorAll('[data-ticker]').forEach(ticker);
    s.querySelectorAll('[data-logo]').forEach(logo);
    s.querySelectorAll('[data-draw-toggle]').forEach(draw);
    document.querySelectorAll('[data-scroll-arrow]').forEach(arrow); // fixed UI lives outside #swup
    let saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
    setTheme(html.getAttribute('data-theme') || saved || 'white');
  };
  const destroy = () => {
    document.querySelectorAll('[data-logo]').forEach((r) => r._logo && r._logo());
    document.querySelectorAll('[data-ticker]').forEach((r) => r._ticker && r._ticker());
    document.querySelectorAll('[data-draw-toggle]').forEach((r) => r._draw && r._draw());
  };

  if (App.register) App.register('Shelter', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
