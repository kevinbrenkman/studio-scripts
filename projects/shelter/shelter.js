/*!
 * shelter.js 0.2.0 (kevinbrenkman/studio-scripts/projects/shelter)
 * Shelter motion, ported from Lukas's prototype. Attribute hooks only, no classes.
 *
 * Logo
 *   [data-logo]                 click: loop the versions, click again: lock the one showing. Plays once on load.
 *     [data-logo-frames]        its children are the logo versions (a slot: a new SVG joins the cycle)
 *     [data-logo-building]      photo inside the letters of version 1 while a [data-logo-hover] is hovered
 *   [data-logo-hover]           hovering it (mouse) shows the building (the "coming soon" sign)
 * Reveal (after the logo intro, or as soon as you scroll): html.is-revealed + 'shelter:reveal' on document
 *   [data-reveal="sign"]        grows from its nail, swings on hover
 *   [data-reveal="pop"]         pops in (the draw balloon)
 *   [data-reveal="product"]     outline drawing first, then the photo pops in (staggered in DOM order)
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
 */
(() => {
  if (window.__shelter) return; window.__shelter = '0.2.0';
  window.App = window.App || { inits: [], destroys: [] };
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)');
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  const INTRO_MS = 90, LOOP_MS = 130;
  const KEY = 'shelter-theme';
  html.classList.add('is-shelter-js');

  if (!document.getElementById('shelter-css')) {
    const st = document.createElement('style');
    st.id = 'shelter-css';
    st.textContent = [
      // Logo: one version at a time (the Designer shows the first, see the Global embed)
      'html.is-logo-ready [data-logo-frames]>*{visibility:hidden}',
      'html.is-logo-ready [data-logo-frames]>.is-on{visibility:visible}',
      '[data-logo]{cursor:pointer;-webkit-tap-highlight-color:transparent;outline-offset:4px}',
      '[data-logo-building]{opacity:0;transition:opacity .3s ease;pointer-events:none}',
      '[data-logo].is-building [data-logo-building]{opacity:1}',
      'html.is-logo-ready [data-logo].is-building [data-logo-frames]>*{visibility:hidden}',
      'html.is-logo-ready [data-logo].is-building [data-logo-frames]>:first-child{visibility:visible}',
      // Reveal (hidden states live in the site head so nothing flashes before this file loads)
      '@keyframes sh-sign{0%{scale:0;rotate:-3deg}60%{scale:1.04;rotate:3deg}100%{scale:1;rotate:0deg}}',
      '@keyframes sh-swing{0%,100%{rotate:0deg}25%{rotate:4deg}75%{rotate:-3deg}}',
      '@keyframes sh-pop{from{scale:0;rotate:-20deg}to{scale:1;rotate:0deg}}',
      '@keyframes sh-bob{0%,100%{translate:0 0;rotate:0deg}50%{translate:0 -.25em;rotate:-1.2deg}}',
      '[data-reveal="sign"]{transform-origin:41.4% 5.3%}',
      'html.is-revealed [data-reveal="sign"]{animation:sh-sign .65s ease-out .2s backwards}',
      '@media (hover:hover){[data-reveal="sign"]:hover{animation:sh-swing 1.6s ease-in-out infinite}}',
      'html.is-revealed [data-reveal="pop"]{animation:sh-pop .7s ' + SPRING + ' .55s backwards}',
      '[data-reveal="product"]{transition:scale .5s ' + SPRING + ',rotate .5s ' + SPRING + '}',
      '[data-reveal="product"] img:not([data-reveal-outline]){transition:opacity .3s ease var(--sh-d,0s),scale .7s ' + SPRING + ' var(--sh-d,0s),rotate .7s ' + SPRING + ' var(--sh-d,0s)}',
      '[data-reveal-outline]{pointer-events:none;transition:opacity .3s ease var(--sh-d,0s),scale .45s ease var(--sh-d,0s)}',
      'html.is-revealed [data-reveal-outline]{opacity:0;scale:1.1}',
      '@media (hover:hover){html.is-revealed [data-hover-tilt]:hover{scale:1.08;rotate:var(--sh-tilt,0deg)}}',
      // Idle + hover
      '[data-bob]{animation:sh-bob 3.4s ease-in-out infinite}',
      '[data-hover-grow]{transition:scale .45s ' + SPRING + '}',
      '@media (hover:hover){[data-hover-grow]:hover{scale:var(--sh-grow,1.06)}}',
      // Ticker (mobile)
      '@keyframes sh-ticker{to{transform:translateX(-50%)}}',
      '[data-ticker].is-ticking{overflow:hidden;white-space:nowrap}',
      '[data-ticker] [data-ticker-track]{display:inline-flex;animation:sh-ticker 18s linear infinite}',
      '[data-ticker] [data-ticker-track]>span{padding-right:1.75em}',
      // Inline SVG: white fill follows the page colour
      '[data-inline-svg-done]{color:var(--_colors---page)}',
      // Colour dots
      '[data-theme-set]{cursor:pointer;transition:scale .25s ' + SPRING + '}',
      '@media (hover:hover){[data-theme-set]:hover{scale:1.15}}',
      // Scroll arrow
      '[data-scroll-arrow]{cursor:pointer;transition:transform .5s ' + SPRING + '}',
      '@media (hover:hover){[data-scroll-arrow]:hover{transform:translateY(.375em)}[data-scroll-arrow].is-up:hover{transform:rotate(180deg) translateY(.375em)}}',
      '[data-scroll-arrow].is-up{transform:rotate(180deg)}',
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
    const frames = () => (box ? [...box.children] : []);
    if (frames().length < 2) { reveal(); return; }
    html.classList.add('is-logo-ready');
    let cur = 0, timer = null;
    const show = (i) => { const f = frames(); f[cur] && f[cur].classList.remove('is-on'); cur = (i + f.length) % f.length; f[cur].classList.add('is-on'); };
    frames().forEach((f, i) => f.classList.toggle('is-on', i === 0));
    const stop = () => { clearInterval(timer); timer = null; root.setAttribute('aria-pressed', 'false'); };
    const loop = () => { stop(); timer = setInterval(() => show(cur + 1), LOOP_MS); root.setAttribute('aria-pressed', 'true'); };
    const toggle = (e) => { if (e) e.preventDefault(); timer ? stop() : loop(); };
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
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-set]'); if (!b) return;
    e.preventDefault(); setTheme(b.getAttribute('data-theme-set'));
  });

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
    btn.addEventListener('click', click);
    addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
    btn._arrow = true;
  };

  /* ---------- Init ---------- */
  const init = (scope = document) => {
    const s = scope || document;
    s.querySelectorAll('img[data-inline-svg]').forEach(inline);
    s.querySelectorAll('[data-outline-text]').forEach(splitWords);
    s.querySelectorAll('[data-reveal="product"]').forEach((p, i) => {
      p.style.setProperty('--sh-d', (i * 0.12) + 's');
      const t = p.getAttribute('data-hover-tilt'); if (t) p.style.setProperty('--sh-tilt', t + 'deg');
    });
    s.querySelectorAll('[data-hover-grow]').forEach((el) => { const v = el.getAttribute('data-hover-grow'); if (v) el.style.setProperty('--sh-grow', v); });
    s.querySelectorAll('[data-ticker]').forEach(ticker);
    s.querySelectorAll('[data-logo]').forEach(logo);
    document.querySelectorAll('[data-scroll-arrow]').forEach(arrow); // fixed UI lives outside #swup
    let saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
    setTheme(html.getAttribute('data-theme') || saved || 'white');
  };
  const destroy = () => {
    document.querySelectorAll('[data-logo]').forEach((r) => r._logo && r._logo());
    document.querySelectorAll('[data-ticker]').forEach((r) => r._ticker && r._ticker());
  };

  if (App.register) App.register('Shelter', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
