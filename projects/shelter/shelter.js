/*!
 * shelter.js 0.9.10 (kevinbrenkman/studio-scripts/projects/shelter)
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
 *   [data-theme-set="pink"]     sets html[data-theme], kept in localStorage (like the drawing), iOS Safari toolbar follows
 * SVG
 *   img[data-inline-svg]        inlined so its white fill follows the page colour (also every logo version)
 * Fixed UI
 *   [data-scroll-arrow]         scrolls down one screen, flips up at the bottom and goes to the top
 * Cookies
 *   a[href="#cookievoorkeuren"] opens the cookie preferences (Finsweet), e.g. a link in the Cookiebeleid Rich Text
 * Tally
 *   a[href="#tally-open=ID"]    opens that Tally form as a centred popup (Onkruid's forms). Works in a Rich Text too: only
 *                               the link URL. Extra options as in Tally's own hash (&tally-width=560 ...). embed.js loads
 *                               on the first click; no page jump, no hash left in the URL.
 * Draw your Shelter (prototype: red marker on the outline logo, under the logo's black line)
 *   [data-draw-toggle]          the balloon: draw / "save it" (the drawing fades out, drawing again brings it back)
 *     data-draw-mobile="false"  hidden under 768px (Global embed CSS, bound to the Header prop "Draw on mobile")
 *   Drawing covers the whole screen, under the page content, and holds the page at the top. Live only, built by this file: the canvas inside [data-logo], the "save it" balloon, the hint with "Wissen".
 *   Strokes are stored in logo coordinates (1512 x 520) and kept in localStorage (back after a reload or a new visit).
 */
(() => {
  if (window.__shelter) return; window.__shelter = '0.9.10';
  window.App = window.App || { inits: [], destroys: [] };
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  // Logo versions: the load pass starts fast and slows towards the end; the click loop holds each version longer and
  // also slows towards the end of every round (ms per version = from + (to - from) * position^curve)
  const INTRO = { from: 60, to: 220, curve: 2.2 }, LOOP = { from: 130, to: 280, curve: 2 };
  const dur = (t, i, n) => t.from + (t.to - t.from) * Math.pow(n > 1 ? i / (n - 1) : 1, t.curve);
  const KEY = 'shelter-theme';
  html.classList.add('is-shelter-js');

  if (!document.getElementById('shelter-css')) {
    const st = document.createElement('style');
    st.id = 'shelter-css';
    st.textContent = [
      // Logo: one version at a time (the Designer shows the first, see the Global embed)
      'html.is-logo-ready [data-logo-frame]{visibility:hidden}',
      'html.is-logo-ready [data-logo-frame].is-on{visibility:visible}',
      // Click area: only the letters (the logo box runs on under the intro copy, its bottom margin is negative).
      // The box lets the pointer through; a ::before over the letters (logo 01: x 19-1493, y 40-446 of 1512 x 520) takes it.
      '[data-logo]{pointer-events:none;-webkit-tap-highlight-color:transparent}',
      '[data-logo]::before{content:"";position:absolute;left:1.3%;right:1.3%;top:7.7%;bottom:14.2%;z-index:2;pointer-events:auto;cursor:pointer;border-radius:var(--_layout---radius)}',
      // Focus in the site's own style: a black ring with rounded corners round the letters, keyboard only (no blue)
      '[data-logo]:focus{outline:none}[data-logo]:focus-visible::before{outline:2px solid var(--_colors---ink);outline-offset:4px}',
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
      '[data-reveal="product"] img:not([data-reveal-outline]){will-change:opacity,transform;transition:opacity .3s ease var(--sh-d,0s),scale .7s ' + SPRING + ' var(--sh-d,0s),rotate .7s ' + SPRING + ' var(--sh-d,0s)}',
      '[data-reveal-outline]{will-change:opacity,transform;pointer-events:none;transition:opacity .3s ease var(--sh-d,0s),scale .45s ease var(--sh-d,0s)}',
      // Products play in when they scroll into view (.is-in), not all at once on load
      '[data-reveal="product"].is-in [data-reveal-outline]{opacity:0;scale:1.1}',
      '@media (hover:hover){[data-reveal="product"].is-in[data-hover-tilt]:hover{scale:1.08;rotate:var(--sh-tilt,0deg)}}',
      // Idle + hover
      '[data-bob]{animation:sh-bob 3.4s ease-in-out infinite}',
      '[data-hover-grow]{transition:scale .45s ' + SPRING + '}',
      // !important: GSAP (follow/magnetic) writes an inline scale:none, which would cancel the hover scale
      '@media (hover:hover){[data-hover-grow]:hover{scale:var(--sh-grow,1.06)!important}}',
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
      // translate/rotate (not transform), so the GSAP pop-in on transform never fights this transition
      '[data-scroll-arrow]{cursor:pointer;transition:translate .5s ' + SPRING + ',rotate .5s ' + SPRING + '}',
      '@media (hover:hover){[data-scroll-arrow]:hover{translate:0 .375em}[data-scroll-arrow].is-up:hover{translate:0 -.375em}}',
      '[data-scroll-arrow].is-up{rotate:180deg}',
      // Draw your Shelter
      '@keyframes sh-nudge{0%,100%{rotate:0deg}50%{rotate:-5deg}}',
      // Full screen while drawing (no lines cut off at the logo edge); the page is held at the top meanwhile
      // Under the whole page: a fixed canvas at z-index -1 (body made see-through while drawing; html carries the page colour).
      // The pointer is read on the document, so it draws under text, images and the logo alike
      '[data-draw-layer]{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;transition:opacity .45s ease}',
      '[data-draw-layer].is-hidden{opacity:0}',
      'html.is-drawing body{background-color:transparent!important}',
      'html.is-drawing,html.is-drawing *{touch-action:none;-webkit-user-select:none;user-select:none}',
      // Mouse: a red dot the size of the line instead of the arrow or link hand (set from JS, it follows the logo size)
      'html.is-drawing,html.is-drawing *{cursor:var(--sh-draw-cursor,crosshair)!important}',
      'html.is-drawing [data-draw-toggle],html.is-drawing [data-draw-toggle] *,html.is-drawing [data-draw-hint] button,html.is-drawing [data-theme-picker],html.is-drawing [data-theme-picker] *{cursor:pointer!important}',
      // Colour picker while drawing: an invisible zone around the dots, so a stroke can't start right next to them
      '[data-theme-picker]::before{content:"";position:absolute;inset:-.75em;z-index:-1;border-radius:50em;pointer-events:none}',
      'html.is-drawing [data-theme-picker]::before{pointer-events:auto}',
      // The scroll arrow does nothing while drawing
      'html.is-drawing [data-scroll-arrow]{pointer-events:none}',
      // The marker sits under the logo (the canvas comes first in [data-logo]); the logo lets the pointer through
      'html.is-drawing [data-logo] [data-logo-frame],html.is-drawing [data-logo] [data-logo-frames]{pointer-events:none}',
      // ...and its click area too, so the draw cursor shows (not the hand) and a line can start on the logo
      'html.is-drawing [data-logo]::before{pointer-events:none}',
      // Saved drawing: under the outline logo (version 1), as faint as the Header's "Drawing opacity" prop, scrolls with it,
      // hidden while another logo version shows or while drawing. The logo box isolates, so z-index -1 stays inside it.
      '[data-logo]{isolation:isolate}',
      '[data-draw-overlay]{position:absolute;z-index:-1;pointer-events:none}',
      'html.is-drawing [data-draw-overlay],[data-draw-overlay].is-off{visibility:hidden}',
      // The coming soon sign hangs over the logo: let the marker draw under it
      'html.is-drawing [data-reveal="sign"]{pointer-events:none}',
      // Hint (prototype): fixed at the bottom while drawing. Same font and weight as the pills
      '[data-draw-hint]{position:fixed;left:50%;bottom:calc(1.25em + env(safe-area-inset-bottom,0px));z-index:12;display:flex;gap:.375em;align-items:center;opacity:0;transform:translate(-50%,.75em);pointer-events:none;transition:opacity .25s ease,transform .35s ' + SPRING + '}',
      'html.is-drawing [data-draw-hint]{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
      '[data-outline-text].is-words-wait [data-outline-word]{display:inline-block;transition:transform .75s ' + SPRING + ',opacity .3s ease;transition-delay:calc(var(--i,0) * 70ms)}',
      '[data-outline-text].is-words-wait:not(.is-words-in) [data-outline-word]{opacity:0;transform:translateY(.3em) scale(.7)}',
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
  // Last of the intro (GSAP): the colour dots, in a short stagger, and the scroll arrow pop in together.
  // The intro copy and the pillars are a native Webflow interaction (Intro on load: copy + pillars).
  document.addEventListener('shelter:reveal', () => {
    const dots = document.querySelectorAll('[data-theme-picker] [data-theme-set]'), arrows = document.querySelectorAll('[data-scroll-arrow]');
    if (!window.gsap || RM) return;
    const from = { autoAlpha: 0, scale: 0.3 }, to = { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2.2)', clearProps: 'transform,opacity,visibility' };
    gsap.timeline({ delay: 0.9 }).fromTo(dots, from, { ...to, stagger: 0.045 }, 0).fromTo(arrows, from, to, 0);
  }, { once: true });
  // Footer (desktop): the colour dots scale out once [data-hide-dots] (the footer links under them) comes into view.
  // The footer is inside #swup: init() re-observes the new one after a page swap
  const wide = matchMedia('(min-width: 768px)');
  let dotsIO = null, away = false;
  const dotsSet = (a) => {
    if (a === away || !window.gsap) return; away = a;
    const dots = document.querySelectorAll('[data-theme-picker] [data-theme-set]');
    // The picker box stays over the footer links: let clicks through while the dots are away
    document.querySelectorAll('[data-theme-picker]').forEach((p) => { p.style.pointerEvents = a ? 'none' : ''; });
    gsap.to(dots, a
      ? { scale: 0, autoAlpha: 0, duration: 0.35, ease: 'back.in(2)', stagger: { each: 0.04, from: 'end' }, overwrite: 'auto' }
      : { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.04, overwrite: 'auto', clearProps: 'transform,opacity,visibility' });
  };
  const dotsAway = () => {
    if (dotsIO) dotsIO.disconnect();
    const mark = document.querySelector('[data-hide-dots]');
    if (!mark) { dotsSet(false); return; }
    dotsIO = new IntersectionObserver((e) => dotsSet(e[0].isIntersecting && wide.matches));
    dotsIO.observe(mark);
  };
  wide.addEventListener('change', () => { if (!wide.matches) dotsSet(false); });
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
    p.querySelectorAll('img[data-reveal-outline]').forEach(bakeOutline);
    if (RM || !('IntersectionObserver' in window)) { p.classList.add('is-in'); return; }
    if (!io) io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); seen.push(en.target); } });
      playIn();
    }, FINE ? { threshold: 0.5, rootMargin: '0px 0px -12% 0px' } : { threshold: 0.2 }); // well inside the screen (phone: the first one is already in view at load)
    io.observe(p);
  };


  /* ---------- Pillar outlines: the SVG filter baked into a bitmap, once ---------- */
  // The outline is an SVG filter (feMorphology) on the full-size product PNG (Global embed, so the Designer shows it).
  // Safari re-runs that filter on every frame the outline or its pillar animates (the fade, the pop, the 1.1 scale),
  // at 3x on a phone: the reveals stuttered and seemed to jump in late. Here the same steps run once per image in JS,
  // at screen size, and the img gets the result as a plain bitmap (filter off): a black line, see-through inside.
  // If the image can't be read (CORS) the live filter simply stays.
  const outlines = new Set();
  // Outline shape (css px): drop specks, close small gaps, hug the photo, smooth; line width; room around the image
  const OL = { open: 1, close: 4, back: 3, smooth: 1.6, line: 1.25, pad: 6 };
  // 1D running min/max in O(1) per pixel (van Herk / Gil-Werman), rectangle kernel like feMorphology, outside = transparent
  const run1 = (src, off, step, n, r, max, g, hh, dst) => {
    const k = 2 * r + 1, m = n + 2 * r;
    for (let i = 0; i < m; i++) {
      const v = i < r || i >= n + r ? 0 : src[off + (i - r) * step];
      g[i] = i % k === 0 ? v : max ? (v > g[i - 1] ? v : g[i - 1]) : (v < g[i - 1] ? v : g[i - 1]);
    }
    for (let i = m - 1; i >= 0; i--) {
      const v = i < r || i >= n + r ? 0 : src[off + (i - r) * step];
      hh[i] = i === m - 1 || (i + 1) % k === 0 ? v : max ? (v > hh[i + 1] ? v : hh[i + 1]) : (v < hh[i + 1] ? v : hh[i + 1]);
    }
    for (let x = 0; x < n; x++) { const a = hh[x], b = g[x + 2 * r]; dst[off + x * step] = max ? (a > b ? a : b) : (a < b ? a : b); }
  };
  const morph = (src, w, h, r, max) => {
    if (r < 1) return src;
    const t = new Float32Array(w * h), o = new Float32Array(w * h), L = Math.max(w, h) + 2 * r, g = new Float32Array(L), hh = new Float32Array(L);
    for (let y = 0; y < h; y++) run1(src, y * w, 1, w, r, max, g, hh, t);
    for (let x = 0; x < w; x++) run1(t, x, w, h, r, max, g, hh, o);
    return o;
  };
  // Gaussian as three box blurs (running sums), close enough for the edge smoothing
  const box1 = (src, off, step, n, r, dst) => {
    const d = 2 * r + 1; let acc = 0;
    for (let i = 0; i <= r && i < n; i++) acc += src[off + i * step];
    for (let x = 0; x < n; x++) {
      dst[off + x * step] = acc / d;
      const b = x + r + 1, a = x - r;
      if (b < n) acc += src[off + b * step];
      if (a >= 0) acc -= src[off + a * step];
    }
  };
  const blur = (src, w, h, sd) => {
    const r = Math.max(1, Math.round((Math.sqrt(4 * sd * sd + 1) - 1) / 2)); // box radius for 3 passes ~ sd
    let a = src;
    for (let pass = 0; pass < 3; pass++) {
      const t = new Float32Array(w * h), o = new Float32Array(w * h);
      for (let y = 0; y < h; y++) box1(a, y * w, 1, w, r, t);
      for (let x = 0; x < w; x++) box1(t, x, w, h, r, o);
      a = o;
    }
    return a;
  };
  const rest = () => new Promise((r) => setTimeout(r, 0)); // let the page breathe between the steps
  // Holes inside the shape (gaps between the bricks, the sofa's armrest) become shape: only the outer line is drawn
  const fillHoles = (a, w, h) => {
    const seen = new Uint8Array(w * h), st = [];
    const push = (i) => { if (!seen[i] && a[i] < 0.5) { seen[i] = 1; st.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) { const i = st.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w); }
    for (let i = 0; i < a.length; i++) if (!seen[i] && a[i] < 0.5) a[i] = 1;
    return a;
  };
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const paintOutline = async (o) => {
    const { W, H, s, e } = o, job = (o.job = (o.job || 0) + 1);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'), id = cx.createImageData(W, H), d = id.data;
    let t0 = performance.now();
    for (let i = 0, n = W * H; i < n; i++) {
      if ((i & 4095) === 0 && performance.now() - t0 > 8) { await rest(); if (job !== o.job) return; t0 = performance.now(); }
      const l = (s[i] / 255) * (1 - e[i] / 255); if (l <= 0) continue;
      d[i * 4 + 3] = l * 255; // black line only, see-through inside (no page colour to repaint when the colour fades)
    }
    cx.putImageData(id, 0, 0);
    cv.toBlob((b) => {
      if (!b || !o.img.isConnected) return;
      if (o.url) URL.revokeObjectURL(o.url);
      o.url = URL.createObjectURL(b);
      o.img.removeAttribute('srcset'); o.img.removeAttribute('sizes'); o.img.src = o.url; o.img.style.filter = 'none';
      // the bitmap has room round the photo (the line never gets cut off at the image edge)
      Object.assign(o.img.style, { left: -o.pad + 'px', top: -o.pad + 'px', width: 'calc(100% + ' + 2 * o.pad + 'px)', maxWidth: 'none' });
    }, 'image/png');
  };
  const bakeOutline = (img) => {
    if (img._bake) return; img._bake = 1;
    if (/\.svg(\?|$)/i.test(img.currentSrc || img.src)) return; // a drawn outline from the design (Outline prop): nothing to bake
    const run = () => {
      const w = img.offsetWidth, h = img.offsetHeight; if (!w || !h) { img._bake = 0; return; }
      const src = new Image(); src.crossOrigin = 'anonymous';
      const url = img.currentSrc || img.src; src.src = url + (url.includes('?') ? '&' : '?') + 'sh-outline=1'; // own request, with CORS
      src.decode().then(async () => {
        // 1. Silhouette steps at 1x (radii in css px, as the filter): alpha threshold, drop specks, close holes, step out, smooth
        const q = 1, P = 14, iw = Math.round(w * q), ih = Math.round(h * q), w1 = iw + P * 2, h1 = ih + P * 2, pad = OL.pad;
        const c1 = document.createElement('canvas'); c1.width = w1; c1.height = h1;
        const x1 = c1.getContext('2d', { willReadFrequently: true }); x1.drawImage(src, P, P, iw, ih);
        const px = x1.getImageData(0, 0, w1, h1).data; // throws on a tainted canvas: then the live filter stays
        let a = new Float32Array(w1 * h1);
        for (let i = 0; i < a.length; i++) a[i] = cl((px[i * 4 + 3] / 255) * 20 - 8);
        a = morph(a, w1, h1, OL.open * q, false); await rest(); a = morph(a, w1, h1, OL.close * q, true); await rest(); a = morph(a, w1, h1, OL.back * q, false); fillHoles(a, w1, h1); await rest();
        a = blur(a, w1, h1, OL.smooth * q); await rest(); // the threshold (x10 - 5) comes after scaling up, so the edge stays smooth
        // 2. Up to screen pixels (smooth edge), then the thin line: shape minus the shape eroded by the line width
        const k = Math.min(devicePixelRatio || 1, 2), W = Math.round((w + 2 * pad) * k), H = Math.round((h + 2 * pad) * k), sx = (iw + 2 * pad * q) / W, P0 = P - pad * q;
        const sf = new Float32Array(W * H);
        let t0 = performance.now();
        for (let y = 0; y < H; y++) {
          if (performance.now() - t0 > 8) { await rest(); t0 = performance.now(); }
          const fy = (y + 0.5) * sx - 0.5 + P0, y0 = Math.floor(fy), ty = fy - y0;
          for (let x = 0; x < W; x++) {
            const fx = (x + 0.5) * sx - 0.5 + P0, x0 = Math.floor(fx), tx = fx - x0, i = y0 * w1 + x0;
            const v = a[i] * (1 - tx) * (1 - ty) + a[i + 1] * tx * (1 - ty) + a[i + w1] * (1 - tx) * ty + a[i + w1 + 1] * tx * ty;
            sf[y * W + x] = cl(v * 10 - 5);
          }
        }
        await rest();
        const ef = morph(sf, W, H, Math.max(1, Math.round(OL.line * k)), false); await rest();
        const s8 = new Uint8ClampedArray(W * H), e8 = new Uint8ClampedArray(W * H);
        for (let i = 0; i < s8.length; i++) { s8[i] = sf[i] * 255; e8[i] = ef[i] * 255; }
        const o = { img, W, H, s: s8, e: e8, w, pad }; img._outline = o; outlines.add(o);
        paintOutline(o);
      }).catch(() => {}); // keep the live filter
    };
    const go = () => (img.complete && img.naturalWidth ? run() : img.addEventListener('load', run, { once: true }));
    // Idle time, one after the other, so it never lands on the logo intro or a scroll
    (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(go, { timeout: 2500 });
  };
  // A new width (rotation, breakpoint): bake again at the new size
  let rebakeT = 0;
  addEventListener('resize', () => {
    clearTimeout(rebakeT);
    rebakeT = setTimeout(() => outlines.forEach((o) => {
      if (!o.img.isConnected) { outlines.delete(o); return; }
      if (Math.abs(o.img.offsetWidth - o.w) > o.w * 0.15) { outlines.delete(o); o.img._bake = 0; bakeOutline(o.img); }
    }), 400);
  });

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
    }).catch(() => { img.setAttribute('data-inline-svg-failed', ''); }); // the site head shows the plain image again
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
    const show = (i) => { const f = frames(); f[cur] && f[cur].classList.remove('is-on'); cur = (i + f.length) % f.length; f[cur].classList.add('is-on'); root.dispatchEvent(new CustomEvent('logo:frame', { detail: cur })); };
    frames().forEach((f, i) => f.classList.toggle('is-on', i === 0));
    const stop = () => { clearTimeout(timer); timer = null; root.setAttribute('aria-pressed', 'false'); };
    const loop = () => {
      stop(); root.setAttribute('aria-pressed', 'true');
      const next = () => { const n = frames().length; timer = setTimeout(() => { show(cur + 1); next(); }, dur(LOOP, cur, n)); };
      next();
    };
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
      const next = () => { timer = setTimeout(() => { step++; show(step); if (step >= n) { stop(); setTimeout(reveal, 150); } else next(); }, dur(INTRO, step, n)); };
      next();
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
    el.querySelectorAll('[data-outline-word]').forEach((w, i) => w.style.setProperty('--i', i));
    wordsIn(el);
  };
  // Outline headings: the words spring up one after the other when the heading comes into view (live only)
  const wordsIO = 'IntersectionObserver' in window && !RM ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-words-in'); wordsIO.unobserve(e.target); }
  }), { threshold: 0.35 }) : null;
  const wordsIn = (el) => { if (wordsIO) { el.classList.add('is-words-wait'); wordsIO.observe(el); } };

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
    try { localStorage.setItem(KEY, name); } catch (e) {}
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
    let qd = 0; const queue = () => { if (!qd) qd = requestAnimationFrame(() => { qd = 0; update(); }); }; // once per frame, not per scroll event
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue); update();
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
  const STROKE = 26, INK = '#ff0000', W = 1512, H = 520; // prototype: line width in logo px (mouse), red marker
  const FINGER = 22; // touch: line width in screen px, about a fingertip
  const SAVE_SVG = 'https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@7c00808/projects/shelter/assets/balloon-save.svg';
  const draw = (toggle) => {
    if (toggle._draw) return;
    const root = document.querySelector('[data-logo]'); if (!root) return;
    let canvas = document.querySelector('[data-draw-layer]');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.setAttribute('data-draw-layer', ''); canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'is-hidden'; document.body.prepend(canvas); }
    const ctx = canvas.getContext('2d');
    // Hint (copy from the prototype), live only
    let hint = document.querySelector('[data-draw-hint]');
    if (!hint) {
      hint = document.createElement('div'); hint.setAttribute('data-draw-hint', ''); hint.setAttribute('role', 'status');
      hint.innerHTML = '<span>Teken op het logo \u00b7 ' + (FINE ? 'klik' : 'tap') + ' \u2018save it\u2019 om te bewaren</span><button type="button" data-draw-clear>Wissen</button>';
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
    try { const v = JSON.parse(localStorage.getItem(DKEY) || '[]'); if (Array.isArray(v)) strokes = v.filter((st) => (Array.isArray(st) ? st : st && st.p) && (Array.isArray(st) ? st : st.p).length); } catch (e) {}
    const store = () => {
      try {
        let txt = JSON.stringify(strokes);
        while (txt.length > MAX && strokes.length > 1) { strokes.shift(); txt = JSON.stringify(strokes); } // too big: oldest lines go first
        if (strokes.length) localStorage.setItem(DKEY, txt); else localStorage.removeItem(DKEY);
      } catch (e) {}
    };

    // A line is { w: width in logo px, p: points } (older saved lines are a bare points array at the mouse width)
    const strokePath = (st) => {
      const pts = Array.isArray(st) ? st : st.p;
      ctx.lineWidth = Array.isArray(st) ? STROKE : st.w;
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
      ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      strokes.forEach(strokePath);
    };
    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      if (FINE) { // the cursor dot matches the line width on screen
        const d = Math.max(6, Math.min(64, Math.round(STROKE * box().width / W))), c = d / 2 + 1, n = d + 2;
        // Thin black ring, so the dot still shows on top of lines already drawn in the same red
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '"><circle cx="' + c + '" cy="' + c + '" r="' + (d / 2) + '" fill="' + INK + '" stroke="#000" stroke-width="1.5"/></svg>';
        document.documentElement.style.setProperty('--sh-draw-cursor', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + Math.round(c) + ' ' + Math.round(c) + ', crosshair');
      }
      redraw();
    };
    // Saved drawing on top of the logo: a canvas inside [data-logo], only as big as the lines, so it scrolls with the logo
    let overlay = root.querySelector('[data-draw-overlay]');
    if (!overlay) { overlay = document.createElement('canvas'); overlay.setAttribute('data-draw-overlay', ''); overlay.setAttribute('aria-hidden', 'true'); root.appendChild(overlay); }
    const octx = overlay.getContext('2d');
    const paintOverlay = () => {
      if (!strokes.length) { overlay.width = overlay.height = 1; overlay.style.display = 'none'; return; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lw = 0;
      strokes.forEach((st) => { const pts = Array.isArray(st) ? st : st.p; lw = Math.max(lw, Array.isArray(st) ? STROKE : st.w); pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); });
      x0 -= lw; y0 -= lw; x1 += lw; y1 += lw;
      Object.assign(overlay.style, { display: 'block', left: (x0 / W * 100) + '%', top: (y0 / H * 100) + '%', width: ((x1 - x0) / W * 100) + '%', height: ((y1 - y0) / H * 100) + '%' });
      const b = box(), dpr = Math.min(2, devicePixelRatio || 1);
      overlay.width = Math.max(1, Math.round((x1 - x0) / W * b.width * dpr)); overlay.height = Math.max(1, Math.round((y1 - y0) / H * b.height * dpr));
      const sx = overlay.width / (x1 - x0), sy = overlay.height / (y1 - y0);
      octx.setTransform(sx, 0, 0, sy, -x0 * sx, -y0 * sy);
      octx.strokeStyle = INK; octx.lineCap = 'round'; octx.lineJoin = 'round';
      strokes.forEach((st) => { const pts = Array.isArray(st) ? st : st.p; octx.lineWidth = Array.isArray(st) ? STROKE : st.w; octx.beginPath(); octx.moveTo(pts[0][0], pts[0][1]); if (pts.length === 1) octx.lineTo(pts[0][0] + 0.01, pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; octx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } if (pts.length > 1) octx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); octx.stroke(); });
    };
    // Header prop "Drawing opacity" (0 = off, 100 = full) via data-draw-saved on the toggle; 25 when it is not set
    const savedOp = () => { const v = parseFloat(toggle.getAttribute('data-draw-saved')); return isNaN(v) ? 0.25 : Math.max(0, Math.min(1, v / 100)); };
    // On load the saved drawing waits (opacity 0) and fades in with the rest of the intro, once the logo sequence is done
    overlay.style.opacity = '0';
    const fadeIn = () => { overlay.style.transition = 'opacity 1s ease'; overlay.style.opacity = String(savedOp()); };
    if (html.classList.contains('is-revealed')) requestAnimationFrame(fadeIn); else document.addEventListener('shelter:reveal', fadeIn, { once: true });
    // Header prop "Draw on any logo" (data-draw-any="True"): draw on whichever logo version shows, and the saved drawing
    // stays on every version. Off (default): drawing always switches to the outline logo (version 1) and only shows there.
    const anyLogo = () => /^true$/i.test(toggle.getAttribute('data-draw-any') || '');
    const onFrame = (e) => overlay.classList.toggle('is-off', !anyLogo() && e.detail !== 0);
    root.addEventListener('logo:frame', onFrame);
    const toLogo = (e) => { const r = box(); return [Math.round((e.clientX - r.left) / r.width * W * 10) / 10, Math.round((e.clientY - r.top) / r.height * H * 10) / 10]; };
    // While drawing the whole document is the drawing surface; only the balloon and the hint stay clickable
    const UI = '[data-draw-toggle],[data-draw-hint],[data-theme-picker]';
    const isUI = (e) => e.target.closest && e.target.closest(UI);
    const down = (e) => { if (!drawing || isUI(e) || (e.button && e.button !== 0)) return; e.preventDefault(); e.stopPropagation(); live = { w: e.pointerType === 'touch' ? Math.round(FINGER * W / Math.max(1, box().width)) : STROKE, p: [toLogo(e)] }; strokes.push(live); redraw(); };
    const move = (e) => { if (!live) return; e.preventDefault(); const co = e.getCoalescedEvents ? e.getCoalescedEvents() : []; (co.length ? co : [e]).forEach((ev) => live.p.push(toLogo(ev))); redraw(); };
    const end = () => { if (live) { live = null; store(); } };
    const swallow = (e) => { if (drawing && !isUI(e)) { e.preventDefault(); e.stopPropagation(); } }; // no links, logo cycling, cards
    document.addEventListener('pointerdown', down, true);
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    document.addEventListener('click', swallow, true);
    document.addEventListener('dragstart', swallow, true);

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
        // Draw on the outline logo (version 1), or on the version that shows (Draw on any logo), and show the saved drawing again
        if (root._logoApi) { root._logoApi.stop(); if (!anyLogo()) root._logoApi.show(0); }
        // The lines grow from their saved opacity to full (no dip to nothing first)
        const from = strokes.length && overlay.style.display !== 'none' ? savedOp() : 0;
        canvas.style.transition = 'none'; canvas.style.opacity = String(from); canvas.classList.remove('is-hidden');
        setDrawing(true); size(); requestAnimationFrame(size);
        void canvas.offsetWidth; canvas.style.transition = ''; canvas.style.opacity = '';
        return;
      }
      saveOut();
    };
    // Save it: the drawing stays where it is under the logo, at full strength, then fades to the saved opacity (no gap).
    // Kept for the next round and the next visit.
    const saveOut = () => {
      store();
      overlay.style.transition = 'none'; overlay.style.opacity = '1'; paintOverlay();
      setDrawing(false); canvas.classList.add('is-hidden');
      void overlay.offsetWidth; overlay.style.transition = 'opacity .8s ease'; overlay.style.opacity = String(savedOp());
    };
    const clear = (e) => { const c = e.target.closest('[data-draw-clear]'); if (!c) return; e.preventDefault(); e.stopImmediatePropagation(); strokes = []; live = null; redraw(); store(); paintOverlay(); };
    const key = (e) => { if (e.key === 'Escape' && drawing) saveOut(); };
    toggle.addEventListener('click', click, true);
    document.addEventListener('click', clear, true);
    addEventListener('keydown', key);
    // Desktop: scrolling down while drawing saves the drawing and leaves draw mode, then the page scrolls on as usual
    const wheel = (e) => { if (drawing && FINE && e.deltaY > 4) saveOut(); };
    addEventListener('wheel', wheel, { passive: true });
    const ro = new ResizeObserver(size); ro.observe(canvas); size();
    const ro2 = new ResizeObserver(() => paintOverlay()); ro2.observe(root); paintOverlay();
    toggle.setAttribute('role', 'button'); toggle.setAttribute('aria-pressed', 'false');
    toggle._draw = () => {
      if (drawing) setDrawing(false);
      ro.disconnect(); ro2.disconnect(); root.removeEventListener('logo:frame', onFrame); toggle.removeEventListener('click', click, true); document.removeEventListener('click', clear, true); removeEventListener('keydown', key); removeEventListener('wheel', wheel);
      document.removeEventListener('pointerdown', down, true); removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      document.removeEventListener('click', swallow, true); document.removeEventListener('dragstart', swallow, true);
      canvas.remove(); hint.remove(); delete toggle._draw;
    };
  };

  /* ---------- Tally popups ---------- */
  let tallyLoad = null;
  const tallyJs = () => tallyLoad || (tallyLoad = new Promise((ok, no) => {
    if (window.Tally) return ok();
    const sc = document.createElement('script'); sc.src = 'https://tally.so/widgets/embed.js'; sc.async = true;
    sc.onload = ok; sc.onerror = () => { tallyLoad = null; no(); }; document.head.appendChild(sc);
  }));
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="#tally-open="]'); if (!a) return;
    e.preventDefault(); e.stopImmediatePropagation(); // before Swup and Lenis: no scroll to the top, no hash in the URL
    const q = new URLSearchParams(a.getAttribute('href').split('#')[1]);
    const id = q.get('tally-open'); if (!id) return;
    const o = { layout: 'modal', overlay: true };
    q.forEach((v, k) => { if (k === 'tally-open' || !k.startsWith('tally-')) return;
      o[k.slice(6).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = /^\d+$/.test(v) ? +v : v === 'true' ? true : v === 'false' ? false : v; });
    tallyJs().then(() => window.Tally && Tally.openPopup(id, o)).catch(() => { location.href = 'https://tally.so/r/' + id; });
  }, true);

  /* ---------- Cookie links: no Swup, no jump to the top ---------- */
  // Finsweet's buttons are links to "#": Swup took them as an anchor visit and scrolled to the top (Paloma had the same).
  // data-no-swup makes Swup skip them; preventDefault stops the browser's own jump to "#". Re-marked after each page change.
  const ccMark = () => document.querySelectorAll('a[fs-cc], [fs-cc] a[href="#"]').forEach((a) => a.setAttribute('data-no-swup', ''));
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[fs-cc][href="#"], [fs-cc] a[href="#"]');
    if (a) e.preventDefault();
  }, true);
  // Cookie preferences from a plain link (a Rich Text link can't carry fs-cc): a[href="#cookievoorkeuren"]
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href$="#cookievoorkeuren"]'); if (!a) return;
    e.preventDefault(); e.stopImmediatePropagation(); // before Swup and Lenis: no jump, no hash
    const btn = document.querySelector('[fs-cc="open-preferences"]');
    if (btn) { ccMark(); btn.click(); }
  }, true);

  /* ---------- Init ---------- */
  const init = (scope = document) => {
    const s = scope || document;
    ccMark();
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
    dotsAway();
    let saved = null; try { saved = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) {}
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
