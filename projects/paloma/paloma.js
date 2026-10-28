/*!
 * paloma.js: Paloma site bundle (kevinbrenkman/studio-scripts)
 * Load a pinned version only (commit hash): cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<sha>/projects/paloma/paloma.js
 * Registers into the Swup shell registry (App.inits / App.destroys) from the site footer.
 *
 * Modules
 *  - EmblemMask 2.6.0 (new matte: Bianca's better model, 5s loop; same emblem size on every card, 30vw, optically +10% on square, -8% on portrait cards):  replaces HoverMask 1.1.0 (spinning SVG). Project card hover shows the
 *    thumbnail inside the spinning 3D emblem (Quy). WebGL: a grayscale matte video (white = emblem)
 *    is the alpha for the thumbnail. One H.264 file for every browser, because Safari drops the
 *    alpha of HEVC video when it is drawn to a canvas.
 *  - Jobs 1.2.0 (open/close uses the ReadMore motion): Careers page (CMS > Jobs). Tags load from the Jobs template page (CMS > Job Types), like CaseTags;
 *    rows with a Description open and close, empty Apply link falls back to hello@wearepaloma.be.
 *    Footer [data-jobs-count] shows the number of open jobs on every page (read from /careers once).
 *  - SliderFX 1.7.0 (Case Study Slider: parallax + swipe fix, no stagger; never empty when scrolling back up; parallax matches the grid: zoom 1.2, shift 8) (also keeps Splide's index in sync with auto scroll, so swipes never jump back): the cards in view slide up one by one each time the slider scrolls into view.
 *    Depth: images are scaled up in their frame and move sideways with the card's position (horizontal parallax). Hooks into CaseSlider's slider:ready event.
 *  - GridFX 1.3.0: projects grid (home + Selected projects): cards reveal on scroll and spread apart (max 20px) towards the top and
 *    bottom of the screen. Grid, case media and the video player thumbnail: images get a vertical parallax.
 *  - ArrowLinks 1.4.1 (static check only on real links; the slider heading wrapper is a div): hover motion moved to the native Webflow interaction "Arrow link hover" (tweak on the canvas).
 *    Script keeps: press scale on all arrow links, the Apply text arrow hover, links left on # visual only. Services: the hover card image is zoomed and follows the cursor.
 *  - CaseTags 1.9.0: tags 28px tall (design), default cursor; slider cards get their tags straight away. Moved here from the registered CaseTags 1.6.0 (frees a slot). Same behaviour, tags appear
 *    without the stagger.
 *  - SocialSlider 1.7.0 (page margin straight from the CSS variable, phone layout via Splide breakpoints; Splide's "…" announcer hidden on every slider). 1.6.1 (re-measures after load so the last card keeps its right margin) 1.6.0 (phone: first card left, last right, the rest centred; touch: sliding away pauses the playing card): Case Study Slider component (Social Cards and/or Media Cards). Arrows split apart when pressed
 *    and glow in the direction you slide.
 *  - MobileMenu 1.3.0 (closing = the opening played in reverse; links wait for it): menu (tablet and phone, below 992px): the glass toggle grows into the glass panel (clip from its corner), lines morph into one bar, current page in serif.
 *  - CardLoaded 1.2.0 (also social and media cards; CSS :has, no load event): project cards + case media / players: media box switches to the page background once its image loaded (no 1px line).
 *  - LogoOnMedia 1.1.0: nav logo gets data-on-media over images/videos (filter lift in the Navigation embed); keeps the logo loop playing.
 *  - LogoHover 1.0.0: hovering the nav logo brakes the spin to a stop facing forward (loop start/end), leaving spins it back up.
 *  - PlayBounce 1.0.0: big play button in the Full Video Player springs back with more bounce when the cursor leaves.
 *  - MailMagnet 1.2.0: Mail CTA email is pulled towards the cursor (flat, subtle horizontally, clamped to the window), springs back.
 *  - SliderDrag 1.0.0: all sliders. Trackpad drags the slider (settles on the nearest card, no page scroll while swiping). Auto scroll from the variant: Off / Slow (2) / Fast (4 = homepage).
 *  - MediaPoster 1.2.0 (also the Full Video Player: thumbnail + video 2px bigger per side, video hidden until first play): hides the image under a video loop once the video plays (no 1px edge). Same Splide setup as CaseSlider (loop, autoWidth, speed 1000) and the
 *    same slider:ready event, so SliderMotion (trackpad, auto scroll) and SliderFX (reveal, parallax) run on it too.
 *    Own module because CaseSlider removes slides that link to the current page (the play button is href="#").
 *  - CardRim 1.0.0: Social Card playing with sound gets the glass button rim round the video edge; drifts round,
 *    turns to the cursor on hover. Markup and CSS in the Social Card component (.social-card_rim).
 *  - SocialCard 1.8.0 (touch: thumbnail only, the video loads on tap, one at a time, pause really pauses; a Designer .case-header_tag-list is filled as is (CaseTags)). 1.7.0 (pausing restarts only the videos on screen; playing card centred through Splide; first tap: sound on at once unless the start is already buffered, play button pulses while loading; on tablet and phone the playing card glides to the middle of the screen; a click on the video toggles the sound too, drags ignored; pause mutes and keeps looping; other videos in the slider ease to a stop while one plays): Social Card component. CaseMedia plays the muted loop; Play restarts it with sound and mutes
 *    the other cards, press again to pause. Out of view or on a page change it mutes again.
 *  - TouchNoHover 1.0.0: on touch the arrow link hover interaction never fires. HlsBoost 1.3.0: iPhone/iPad play HLS natively.
 *  - CardPress 1.3.0 (dragging cancels the press, no spring): project cards (grid and slider) scale to 99% as a whole (image + info) zoom out a little while pressed and spring back on release.
 */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  App.TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches;
})();

/* ---------- TouchNoHover ---------- */
// Touch: a tap fires mouse hover events too, so the Webflow "Arrow link hover" interaction played on every tap and
// stuck. On touch, hover events never reach the arrow links (stopped on the way down, before Webflow sees them).
(() => {
  const SEL = '.arrow-link, .case-slider_heading, .case-header_more, .jobs_apply';
  let touchAt = 0;
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') touchAt = Date.now(); }, { capture: true, passive: true });
  const block = (e) => {
    const t = e.pointerType ? e.pointerType !== 'mouse' : (App.TOUCH || Date.now() - touchAt < 1000);
    if (t && e.target.closest && e.target.closest(SEL)) e.stopImmediatePropagation();
  };
  ['pointerover', 'pointerenter', 'pointerout', 'pointerleave', 'mouseover', 'mouseenter', 'mouseout', 'mouseleave']
    .forEach((n) => window.addEventListener(n, block, { capture: true }));
})();

(() => {
  window.App = window.App || { inits: [], destroys: [] };

  /* ---------- EmblemMask ---------- */
  // Matte: white emblem on black, square, H.264 MP4. Must be served with CORS (jsDelivr does).
  // Override per site without a release: put data-emblem-matte="https://..." on any element (e.g. the project card).
  const EMBLEM = {
    matte: 'https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@46960f18a1737f769cab31046b4b982cb87b558c/projects/paloma/assets/emblem-matte.mp4',
    size: 0.3,    // emblem size as a share of the viewport width: the same on every card (portrait, square, wide)
    max: 0.85,    // never more than this share of the card's shortest side (small cards, narrow screens)
    square: 0.1,  // optical boost on square cards (looks smaller there): +10% on a perfect square, fading out towards 1.6:1
    portrait: 0.08, // optical reduction on portrait cards (looks bigger there): -8% at 4:5 or taller
    fill: 0.975,  // share of the video frame the emblem fills (square crop)
  };
  const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
  const matteUrl = () => {
    const el = document.querySelector('[data-emblem-matte]');
    return (el && el.getAttribute('data-emblem-matte').trim()) || EMBLEM.matte;
  };

  // Shared across cards: one video, one WebGL canvas (only one card is hovered at a time)
  let video = null, gl = null, cv = null, prog = null, texV = null, texT = null, loc = {};
  const getVideo = () => {
    if (video) return video;
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = video.loop = video.playsInline = true;
    ['muted', 'loop', 'playsinline'].forEach((a) => video.setAttribute(a, ''));
    video.preload = 'auto';
    video.src = matteUrl();
    video.load();
    return video;
  };

  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = 'precision mediump float;varying vec2 uv;uniform sampler2D t,m;uniform vec4 c,r;' +
    'void main(){vec2 q=(uv-r.xy)/r.zw;float a=0.;' +
    'if(q.x>=0.&&q.x<=1.&&q.y>=0.&&q.y<=1.)a=texture2D(m,q).r;' +
    'a=smoothstep(.04,.96,a);gl_FragColor=vec4(texture2D(t,uv*c.xy+c.zw).rgb*a,a);}';

  const getGL = () => {
    if (gl) return gl;
    cv = document.createElement('canvas');
    cv.className = 'hover-mask';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pa = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    texT = tex(0); texV = tex(1);
    gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'm'), 1);
    loc.c = gl.getUniformLocation(prog, 'c'); loc.r = gl.getUniformLocation(prog, 'r');
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return gl;
  };

  const live = new Set();
  let warned = false;

  const setup = (card) => {
    if (card._emblem) return;
    const media = card.querySelector('.project-card_media');
    const thumb = media && media.querySelector('img');
    if (!thumb) return;

    let pic = null, raf = 0, on = false;

    // CORS copy of the thumbnail (needed to use it as a WebGL texture)
    const getPic = () => {
      const src = thumb.currentSrc || thumb.src;
      if (pic && pic._src === src) return pic;
      pic = new Image(); pic.crossOrigin = 'anonymous'; pic.decoding = 'async'; pic._src = src; pic.src = src;
      return pic;
    };

    const frame = () => {
      if (!on) return;
      if (cv.parentNode !== media || cv.nextSibling) media.appendChild(cv); // stay above HoverFlip's stack, which loads later
      const v = video, im = pic;
      if (v.readyState >= 2 && im.complete && im.naturalWidth) {
        const d = Math.min(devicePixelRatio || 1, 2);
        const w = Math.round(media.offsetWidth * d), h = Math.round(media.offsetHeight * d);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        gl.viewport(0, 0, w, h);
        try {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texT);
          if (texT._src !== im._src) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); texT._src = im._src; }
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texV);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
        } catch (e) {
          if (!warned) { warned = true; console.warn('[EmblemMask] texture blocked, check CORS on the matte and thumbnail hosts', e); }
          on = false; return;
        }
        // object-fit: cover for the thumbnail
        const ir = im.naturalWidth / im.naturalHeight, cr = w / h;
        const sx = cr > ir ? 1 : cr / ir, sy = cr > ir ? ir / cr : 1;
        gl.uniform4f(loc.c, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
        // emblem square, centred, in card uv space
        const sq = Math.max(0, 1 - Math.abs(Math.log(w / h)) / Math.log(1.6)); // 1 = square, 0 = 1.6:1 or longer
        const tall = Math.max(0, Math.min(1, (h / w - 1) / 0.25)); // 0 = square or wide, 1 = 4:5 or taller
        const px = Math.min(EMBLEM.size * innerWidth * d * (1 + EMBLEM.square * sq * (1 - tall) - EMBLEM.portrait * tall), EMBLEM.max * Math.min(w, h));
        const s = px / EMBLEM.fill, rw = s / w, rh = s / h;
        gl.uniform4f(loc.r, (1 - rw) / 2, (1 - rh) / 2, rw, rh);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      raf = requestAnimationFrame(frame);
    };

    const enter = () => {
      if (!getGL()) return;
      const v = getVideo();
      getPic();
      if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } // no flash of the previous card
      media.appendChild(cv);
      on = true;
      try { v.currentTime = 0; } catch (_) {}
      const p = v.play(); p && p.catch && p.catch(() => {});
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    };

    const leave = () => {
      on = false; cancelAnimationFrame(raf);
      if (cv && cv.parentNode === media) { if (video) video.pause(); cv.remove(); }
    };

    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card._emblem = () => {
      leave();
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      pic = null;
      delete card._emblem;
    };
    live.add(card);
  };

  const initEmblem = (scope = document) => {
    if (!fine()) return;
    const cards = (scope || document).querySelectorAll('.project-card');
    if (!cards.length) return;
    cards.forEach(setup);
    // Warm the matte once the page has settled, so the first hover is instant
    const warm = () => (window.requestIdleCallback ? requestIdleCallback(getVideo, { timeout: 2000 }) : setTimeout(getVideo, 500));
    document.readyState === 'complete' ? warm() : addEventListener('load', warm, { once: true });
  };

  App.inits.push(initEmblem);
  App.destroys.push(() => { live.forEach((c) => c._emblem && c._emblem()); live.clear(); });
  // If this file arrives after the shell's first run (async load), init the first page ourselves. setup() is idempotent.
  if (document.readyState !== 'loading') initEmblem(document);
})();

/* ---------- Jobs ---------- */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const MAIL = 'hello@wearepaloma.be';
  const PATH = '/careers';

  // Styles that only make sense with this script (open state, tags, footer counter)
  if (!document.getElementById('paloma-jobs-css')) {
    const st = document.createElement('style');
    st.id = 'paloma-jobs-css';
    st.textContent =
      '.jobs_item.is-open .jobs_plus{transform:rotate(45deg)}' +
      '[data-jobs] [data-job] .case-header_tag-list{display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:flex-end}' +
      '@media (max-width:767px){[data-jobs] [data-job] .case-header_tag-list{justify-content:flex-start}}' +
      '.jobs_item.is-static .jobs_row{cursor:default}.jobs_item.is-static .jobs_plus{visibility:hidden}' +
      '.jobs_row:focus-visible{outline:1px solid currentColor;outline-offset:4px}' +
      '.footer_count{font-size:.6em;margin-left:.15em;line-height:0}.footer_count:empty{display:none}';
    document.head.appendChild(st);
  }

  // Tags come from the Jobs template page (/job-data/{slug}, [data-case-tags] [data-tag]), same markup as CaseTags
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tagHtml = (t) => '<div class="nav_button" data-glow-button><div class="nav_button-glow" data-glow-layer="1"></div><div class="nav_button-stroke">' +
    '<div class="nav_button-stroke-gradient is-one" data-rim="0"></div><div class="nav_button-stroke-gradient is-two" data-rim="180"></div></div>' +
    '<div class="nav_button-text"><div class="nav_button-label">' + esc(t) + '</div></div></div>';
  const docs = new Map();
  const jobDoc = (slug) => {
    if (!docs.has(slug)) docs.set(slug, fetch('/job-data/' + encodeURIComponent(slug)).then((r) => (r.ok ? r.text() : ''))
      .then((h) => new DOMParser().parseFromString(h, 'text/html')).catch(() => null));
    return docs.get(slug);
  };
  const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const loadTags = (item, el) => {
    if (el._tags) return; el._tags = true;
    // Slug from the data-job-tags attribute (bound to the CMS Slug), else from the title
    const title = (item.querySelector('.jobs_title') || {}).textContent || '';
    const slug = (el.getAttribute('data-job-tags') || '').trim() || slugify(title);
    if (!slug) return;
    jobDoc(slug).then((d) => {
      if (!d || !el.isConnected) return;
      const list = [...d.querySelectorAll('[data-case-tags] [data-tag]')].map((t) => t.textContent.trim()).filter(Boolean);
      if (!list.length) return;
      const host = el.querySelector('.case-header_tag-list'); if (host) host.removeAttribute('data-tag-placeholder'); // Designer sample list (hidden live) becomes the real one // a list placed in the Designer keeps its own styles
      if (host) host.innerHTML = list.map(tagHtml).join(''); else el.innerHTML = '<div class="case-header_tag-list">' + list.map(tagHtml).join('') + '</div>';
      App.inits.forEach((fn) => { if (fn !== init) try { fn(el); } catch (_) {} }); // glass button script picks the tags up
    });
  };

  const live = new Set();
  const resize = () => { if (window.lenis) window.lenis.resize(); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); };

  const setup = (item) => {
    if (item._job) return;
    const tags = item.querySelector('[data-job-tags], .jobs_tags-wrap, .jobs_tags');
    if (tags) loadTags(item, tags);
    // Apply link: empty or # means mail Paloma, with the job in the subject
    const apply = item.querySelector('[data-job-apply]');
    const title = (item.querySelector('.jobs_title') || {}).textContent || '';
    if (apply) {
      const h = (apply.getAttribute('href') || '').trim();
      if (!h || h === '#') apply.setAttribute('href', 'mailto:' + MAIL);
      if (/^https?:/.test(apply.getAttribute('href')) && apply.host !== location.host) { apply.target = '_blank'; apply.rel = 'noopener'; }
    }
    const row = item.querySelector('[data-job-toggle]');
    const detail = item.querySelector('[data-job-detail]');
    const body = item.querySelector('.w-richtext, .rich-text');
    const hasBody = body && body.textContent.trim().length > 0 && !body.classList.contains('w-dyn-bind-empty');
    if (body && !hasBody) { body.style.display = 'none'; item.classList.add('no-desc'); }
    if (!row || !detail) return;
    if (!hasBody && !apply) { item.classList.add('is-static'); return; }

    row.setAttribute('role', 'button'); row.tabIndex = 0; row.setAttribute('aria-expanded', 'false');
    let open = false;
    // Same motion as ReadMore 1.3.0: height opens (0.5s power3.inOut), then the content fades up 8px
    const inner = detail.firstElementChild || detail;
    const tight = item.classList.contains('no-desc');
    const TIGHT = '1.5rem';
    const rowPad = getComputedStyle(row).paddingBottom;
    let tl = null;
    const set = (v) => {
      open = v; item.classList.toggle('is-open', v); row.setAttribute('aria-expanded', String(v));
      const g = window.gsap;
      if (!g) { detail.style.height = v ? 'auto' : '0px'; resize(); return; }
      if (tl) tl.kill();
      tl = g.timeline({ onComplete: resize });
      if (v) {
        g.set(inner, { opacity: 0, y: 8 });
        // No description: only the Apply link opens, so pull it closer to the intro text
        if (tight) tl.to(row, { paddingBottom: TIGHT, duration: 0.5, ease: 'power3.inOut' }, 0);
        tl.fromTo(detail, { height: detail.offsetHeight }, { height: 'auto', duration: 0.5, ease: 'power3.inOut' }, 0)
          .to(inner, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.1');
      } else {
        tl.to(inner, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.in' })
          .to(detail, { height: 0, duration: 0.45, ease: 'power3.inOut' });
        if (tight) tl.to(row, { paddingBottom: rowPad, duration: 0.45, ease: 'power3.inOut' }, '<');
        if (tight) tl.set(row, { clearProps: 'paddingBottom' });
        tl.set(inner, { clearProps: 'opacity,transform' });
      }
    };
    const click = (e) => { if (e.target.closest('a')) return; set(!open); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!open); } };
    row.addEventListener('click', click); row.addEventListener('keydown', key);
    item._job = () => { row.removeEventListener('click', click); row.removeEventListener('keydown', key); delete item._job; };
    live.add(item);
  };

  // Footer counter: count on /careers itself, otherwise fetch /careers once per visit
  let countP = null;
  const count = (scope) => {
    const here = scope.querySelectorAll('[data-jobs] [data-job]');
    if (here.length || location.pathname.replace(/\/$/, '') === PATH) return Promise.resolve(here.length);
    if (!countP) countP = fetch(PATH).then((r) => (r.ok ? r.text() : '')).then((h) =>
      new DOMParser().parseFromString(h, 'text/html').querySelectorAll('[data-jobs] [data-job]').length).catch(() => 0);
    return countP;
  };
  const fill = (n) => document.querySelectorAll('[data-jobs-count]').forEach((el) => { el.textContent = n > 0 ? '(' + n + ')' : ''; });

  function init(scope = document) {
    scope = scope || document;
    scope.querySelectorAll('[data-jobs] [data-job]').forEach(setup);
    const run = () => count(scope).then(fill);
    // Other pages: wait until the page is idle so the fetch never competes with the page itself
    if (scope.querySelector('[data-jobs]')) run();
    else (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 800));
  }

  App.inits.push(init);
  App.destroys.push(() => { live.forEach((i) => i._job && i._job()); live.clear(); });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- SliderFX ---------- */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FX = {
    rise: 60,       // px the cards travel up in the reveal
    stagger: 0.18,  // s between cards: first, second, third
    duration: 1,    // s per card
    zoom: 1.2,      // images scaled up inside their frame, room for the sideways parallax (same as the grid)
    shift: 8,       // xPercent the image moves at the screen edges (must stay under (zoom - 1) / 2 * 100)
  };

  // Hide the cards before Splide mounts, so the reveal never flashes. Only while this script runs.
  if (!RM && !document.getElementById('paloma-sliderfx-css')) {
    const st = document.createElement('style');
    st.id = 'paloma-sliderfx-css';
    st.textContent = '[data-case-slider]:not(.fx-ready) .case-slider_slide{opacity:0}';
    document.head.appendChild(st);
  }

  const live = new Set();

  document.addEventListener('slider:ready', (ev) => {
    const root = ev.target, sp = root._sp, g = window.gsap;
    if (!sp || !g || root._fx) { root.classList.add('fx-ready'); return; }
    const track = root.querySelector('.splide__track');
    const slides = () => [...root.querySelectorAll('.splide__slide')];
    const cards = () => slides().map((s) => s.querySelector('.project-card') || s.firstElementChild).filter(Boolean);

    /* Reveal: cards in view stagger up from the left, every time the slider scrolls back into view */
    let io = null;
    // Case Study Slider: no stagger (too much on case pages); the whole slider fades in with Section reveal
    if (RM || root.hasAttribute('data-social-slider')) root.classList.add('fx-ready');
    else {
      g.set(slides(), { autoAlpha: 0, y: FX.rise });
      root.classList.add('fx-ready');
      let shown = false;
      const reveal = () => {
        const w = innerWidth;
        const all = slides();
        const vis = all.filter((s) => { const r = s.getBoundingClientRect(); return r.right > 0 && r.left < w; })
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        g.killTweensOf(all);
        g.set(all.filter((s) => !vis.includes(s)), { autoAlpha: 1, y: 0 });
        g.to(vis, { autoAlpha: 1, y: 0, duration: FX.duration, ease: 'power3.out', stagger: FX.stagger, clearProps: 'transform' });
      };
      const hide = () => { const all = slides(); g.killTweensOf(all); g.set(all, { autoAlpha: 0, y: FX.rise }); };
      io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting && !shown && e.boundingClientRect.top <= 0) { // coming back from above: show straight away
          shown = true; const all = slides(); g.killTweensOf(all); g.set(all, { autoAlpha: 1, y: 0, clearProps: 'transform' });
        } else if (e.isIntersecting && e.intersectionRatio >= 0.2 && !shown) {
          shown = true;
          // Only when scrolling down (slider enters from the bottom). Scrolling back up: just show it.
          if (e.boundingClientRect.top > 0) reveal();
          else { const all = slides(); g.killTweensOf(all); g.set(all, { autoAlpha: 1, y: 0, clearProps: 'transform' }); }
        } else if (!e.isIntersecting && shown && e.boundingClientRect.top > 0) { shown = false; hide(); }
        // Reset only when it leaves at the bottom (scrolled back up past it): it plays again on the way down.
        // Leaving at the top keeps it visible, so scrolling back up never shows it empty.
      }), { threshold: [0, 0.2] });
      io.observe(track || root);
    }

    /* Depth: images sit scaled up inside their frame and slide left/right with the card's position on screen.
       Only recalculated when the slider actually moved, and only while it is in view. */
    let tick = null;
    if (!RM) {
      const Move = sp.Components.Move;
      const setX = new Map();
      const setter = (img) => {
        if (!setX.has(img)) { g.set(img, { scale: FX.zoom, force3D: true }); setX.set(img, g.quickSetter(img, 'xPercent')); }
        return setX.get(img);
      };
      let inView = true, last = null, frames = 0;
      const vio = new IntersectionObserver((e) => { inView = e[0].isIntersecting; if (inView) last = null; });
      vio.observe(root);
      tick = () => {
        if (!inView) return;
        const pos = Move.getPosition();
        if (pos === last && ++frames % 30) return; // idle: re-check twice a second (HoverFlip adds images on hover)
        last = pos;
        const w = innerWidth;
        cards().forEach((c) => {
          const r = c.getBoundingClientRect();
          if (r.right < -w * 0.25 || r.left > w * 1.25) return;
          const p = Math.max(-1.25, Math.min(1.25, ((r.left + r.width / 2) / w) * 2 - 1)); // -1 left edge, 1 right edge
          const x = -p * FX.shift; // image lags behind the card: moves against the travel direction
          c.querySelectorAll('.project-card_media img, .social-card_media > img, .social-card_media > video, .media-card_media > img, .media-card_media > video').forEach((img) => setter(img)(x));
        });
      };
      g.ticker.add(tick);

      /* Fix: auto scroll moves the list without telling Splide, so its index stays behind. A trackpad swipe
         (SliderMotion: go('>')) or a drag then started from that old index and the slider jumped back.
         Sync the index to the real position before any swipe or drag. */
      const Ctrl = sp.Components.Controller;
      const sync = () => {
        if (sp.state.is(Splide.STATES.MOVING)) return;
        const i = Move.toIndex(Move.getPosition());
        if (i !== Ctrl.getIndex()) Ctrl.setIndex(i);
      };
      ['wheel', 'pointerdown', 'touchstart'].forEach((t) => root.addEventListener(t, sync, { capture: true, passive: true }));
      root._fxStop = () => {
        vio.disconnect(); setX.forEach((_, img) => g.set(img, { clearProps: 'transform' }));
        ['wheel', 'pointerdown', 'touchstart'].forEach((t) => root.removeEventListener(t, sync, { capture: true }));
      };
    }

    root._fx = () => {
      io && io.disconnect();
      tick && g.ticker.remove(tick);
      root._fxStop && root._fxStop();
      delete root._fx;
    };
    live.add(root);
  });

  // If the slider never mounts (no slides), never leave anything hidden
  App.inits.push((scope = document) => {
    setTimeout(() => (scope || document).querySelectorAll('[data-case-slider], [data-social-slider]').forEach((r) => r.classList.add('fx-ready')), 4000);
  });
  App.destroys.push(() => { live.forEach((r) => r._fx && r._fx()); live.clear(); });
})();

/* ---------- CardPress ---------- */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SCALE = 0.99;
  let pressed = null;
  const target = (el) => el && el.closest && el.closest('.project-card, .case-slider_slide'); // grid cards and slider cards
  const media = (card) => card.querySelector('.project-card_link') || card; // whole link: image and info below it
  const down = (e) => {
    if (e.button && e.button !== 0) return;
    const card = target(e.target); if (!card || !window.gsap) return;
    pressed = media(card); sx = e.clientX; sy = e.clientY;
    gsap.to(pressed, { scale: SCALE, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
  };
  // Dragging a slider is not a press: let go at once, without the spring (that read as the info jumping)
  let sx = 0, sy = 0;
  const move = (e) => {
    if (!pressed || Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
    gsap.to(pressed, { scale: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto', clearProps: 'scale' });
    pressed = null;
  };
  document.addEventListener('pointermove', move, { passive: true });
  const up = () => {
    if (!pressed) return;
    gsap.to(pressed, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.55)', overwrite: 'auto', clearProps: 'scale' });
    pressed = null;
  };
  document.addEventListener('pointerdown', down, { passive: true });
  ['pointerup', 'pointercancel', 'dragstart'].forEach((t) => document.addEventListener(t, up, { passive: true }));
  window.addEventListener('blur', up);
  App.destroys.push(() => { if (pressed) { gsap.set(pressed, { clearProps: 'scale' }); pressed = null; } });
})();

/* ---------- GridFX ---------- */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const FX = {
    spread: 20,     // px a card (or case block) moves away at the top/bottom edge of the screen, 0 in the centre
    zoom: 1.2,      // image scale inside the frame
    shift: 9,       // yPercent the image travels at the edges (stay under (zoom - 1) / 2 * 100)
    rise: 50,       // px, reveal
  };
  let tick = null, io = null, revealed = new WeakSet();
  const stop = () => { if (tick) gsap.ticker.remove(tick); tick = null; if (io) io.disconnect(); io = null; };

  const init = (scope = document) => {
    if (!window.gsap) return;
    scope = scope || document;
    const grid = scope.querySelector('.projects-grid');
    // Case pages: loop images and videos inside the media blocks. Not the Full Video Player (it has its own controls).
    // Images in case media, plus the Full Video Player thumbnail. No video elements: the playing video stays put.
    const caseImgs = [...scope.querySelectorAll('.case-media_item img, [data-bunny-player-init] img')];
    const blocks = []; // spread on case pages removed: too much there. Grid only.
    if (!grid && !caseImgs.length && !blocks.length) return;
    stop();
    const cards = grid ? [...grid.querySelectorAll('.project-card')] : blocks;
    const links = grid ? cards.map((c) => c.querySelector('.project-card_link') || c) : []; // reveal: grid only

    /* Reveal: cards fade up as they enter, cards entering together stagger */
    if (links.length) {
      gsap.set(links.filter((l) => !revealed.has(l)), { autoAlpha: 0, y: FX.rise }); // init can run twice on first load
      let queue = [], t = 0;
      const flush = () => {
        queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        gsap.to(queue, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12, overwrite: 'auto' });
        queue = [];
      };
      io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        const l = e.target.querySelector('.project-card_link') || e.target;
        if (revealed.has(l)) return; revealed.add(l); io.unobserve(e.target);
        queue.push(l); clearTimeout(t); t = setTimeout(flush, 30);
      }), { rootMargin: '0px 0px -8% 0px' });
      cards.forEach((c) => io.observe(c));
    }

    /* Spread + image parallax, driven by each element's untransformed position on screen */
    const setY = new Map(), imgY = new Map(), ys = new Map();
    const q = (map, el, prop, unit) => { if (!map.has(el)) map.set(el, gsap.quickSetter(el, prop, unit)); return map.get(el); };
    const prep = (img) => { if (!img._fxz) { img._fxz = 1; gsap.set(img, { scale: FX.zoom, force3D: true }); } };
    const small = () => innerWidth < 768;
    let lastY = null, frames = 0;
    tick = () => {
      // Only work when the page actually scrolled (plus a re-check twice a second for late images)
      const sy = window.lenis ? window.lenis.scroll : window.scrollY;
      if (sy === lastY && ++frames % 30) return;
      lastY = sy;
      const vh = innerHeight, mid = vh / 2;
      cards.forEach((c) => {
        const cur = ys.get(c) || 0;
        const r = c.getBoundingClientRect();
        const top = r.top - cur, h = r.height;
        if (top > vh * 1.5 || top + h < -vh * 0.5) return;
        const n = Math.max(-1, Math.min(1, (top + h / 2 - mid) / mid)); // -1 top edge, 0 centre, 1 bottom edge
        const y = n * Math.abs(n) * FX.spread * (small() ? 0.5 : 1);
        // CSS translate (not transform): stacks on top of Webflow's own scroll animations instead of fighting them
        ys.set(c, y); c.style.translate = '0 ' + y.toFixed(2) + 'px';
        c.querySelectorAll('.project-card_media img').forEach((img) => { prep(img); q(imgY, img, 'yPercent', '')(-Math.max(-1, Math.min(1, n)) * FX.shift); });
      });
      caseImgs.forEach((img) => {
        const r = (img.parentElement || img).getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        const n = Math.max(-1, Math.min(1, (r.top + r.height / 2 - mid) / (mid + r.height / 2)));
        prep(img); q(imgY, img, 'yPercent', '')(-n * FX.shift);
      });
    };
    gsap.ticker.add(tick);
  };

  App.inits.push(init);
  App.destroys.push(stop);
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- ArrowLinks + Services image ---------- */
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
  const SEL = '.arrow-link:not(.is-static), .case-slider_heading:not(.is-static), .case-header_more, .jobs_apply';

  // Arrow links without a real link (Case Slider heading on case pages, link left on #): visual only.
  // Removing href makes it plain text for the browser and Swup: no pointer, no click, no motion.
  const statics = (scope = document) => (scope || document).querySelectorAll('a.arrow-link, a.case-slider_heading').forEach((a) => {
    const h = (a.getAttribute('href') || '').trim();
    if (h && h !== '#') return;
    a.removeAttribute('href'); a.classList.add('is-static'); a.style.cursor = 'default';
  });
  App.inits.push(statics);
  if (document.readyState !== 'loading') statics(document);
  // Hover motion for .arrow-link / .case-slider_heading / .case-header_more is a native Webflow
  // interaction now ("Arrow link hover", tweak it in the Interactions panel). Only the Apply text
  // arrow (Careers CMS rich text, no classes to target) stays scripted here.
  const NUDGE = 0.5;  // em the arrow moves right on hover
  const FOLLOW = 0.8; // share of that the text moves, a beat later
  const HOVER = '.jobs_apply';
  if (!document.getElementById('paloma-arrow-css')) {
    const st = document.createElement('style'); st.id = 'paloma-arrow-css';
    st.textContent = 'a.arrow-link.is-static,a.case-slider_heading.is-static{pointer-events:none}';
    document.head.appendChild(st);
  }

  // Arrow + text parts. Text arrows (Apply →) get the → and the words wrapped in spans first.
  const partsOf = (a) => {
    if (a._parts) return a._parts;
    let arrow = a.querySelector('.w-embed, svg');
    let text = a.querySelector('.arrow-link_text, .case-slider_heading-text, .case-header_more-label');
    if (!arrow) {
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      let node; while ((node = walker.nextNode())) {
        const i = node.data.lastIndexOf('→');
        if (i < 0) continue;
        const after = node.splitText(i); after.splitText(1);
        arrow = document.createElement('span'); arrow.style.display = 'inline-block';
        after.parentNode.replaceChild(arrow, after); arrow.appendChild(after);
        if (node.data.trim()) { text = document.createElement('span'); text.style.display = 'inline-block'; node.parentNode.replaceChild(text, node); text.appendChild(node); }
        break;
      }
    }
    return (a._parts = { arrow, text });
  };
  const em = (a) => parseFloat(getComputedStyle(a).fontSize) || 16;
  const move = (a, on) => {
    const { arrow, text } = partsOf(a), d = on ? em(a) * NUDGE : 0;
    if (arrow) gsap.to(arrow, { x: d, duration: on ? 0.45 : 0.5, ease: 'power3.out', overwrite: 'auto', force3D: false });
    // Whole pixels, no GPU layer: keeps the underline crisp and the same weight while it moves
    if (text) gsap.to(text, { x: d * FOLLOW, duration: 0.5, delay: on ? 0.07 : 0, ease: 'power3.out', overwrite: 'auto', snap: 'x', force3D: false });
  };
  document.addEventListener('pointerover', (e) => {
    if (!fine() || !window.gsap) return;
    const a = e.target.closest && e.target.closest(HOVER);
    if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    move(a, true);
  });
  document.addEventListener('pointerout', (e) => {
    if (!window.gsap) return;
    const a = e.target.closest && e.target.closest(HOVER);
    if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    move(a, false);
  });
  // Press: small scale, spring back. No scale on hover.
  let pressed = null;
  document.addEventListener('pointerdown', (e) => {
    const a = e.target.closest && e.target.closest(SEL);
    if (!a || !window.gsap) return;
    pressed = a; gsap.set(a, { transformOrigin: 'left center' });
    gsap.to(a, { scale: 0.99, duration: 0.25, ease: 'power3.out', overwrite: 'auto' });
  }, { passive: true });
  const up = () => {
    if (!pressed) return;
    const a = pressed; pressed = null;
    gsap.to(a, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
  };
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, up, { passive: true }));

  /* Services: hover card image zoomed in its frame and drifting towards the cursor */
  const SV = { zoom: 1.2, shift: 8 }; // shift in % of the image, stay under (zoom - 1) / 2 * 100
  if (!document.getElementById('paloma-svc-css')) {
    const st = document.createElement('style');
    st.id = 'paloma-svc-css';
    st.textContent = '[data-services] .services_card-img{scale:' + SV.zoom + ';translate:calc(var(--svc-x,0) * ' + SV.shift + '%) calc(var(--svc-y,0) * ' + SV.shift + '%)}';
    document.head.appendChild(st);
  }
  let svcTick = null;
  const svcInit = (scope = document) => {
    const root = (scope || document).querySelector('[data-services]');
    if (!root || !fine() || !window.gsap || root._svcfx) return;
    root._svcfx = true;
    let tx = 0, ty = 0, x = 0, y = 0, px = 0, py = 0, active = false;
    root.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; active = true; }, { passive: true });
    root.addEventListener('pointerleave', () => { active = false; }, { passive: true });
    svcTick = () => {
      if (active) {
        const card = document.querySelector('.services_float.is-card .services_card') || root.querySelector('.services_card');
        if (card) {
          const r = card.getBoundingClientRect();
          tx = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (r.width * 1.5)));
          ty = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (r.height * 1.5)));
        }
      } else { tx = 0; ty = 0; }
      const nx = x + (tx - x) * 0.08, ny = y + (ty - y) * 0.08;
      if (Math.abs(nx - x) < 0.0005 && Math.abs(ny - y) < 0.0005) return; // settled: no style writes
      x = nx; y = ny;
      document.documentElement.style.setProperty('--svc-x', x.toFixed(4));
      document.documentElement.style.setProperty('--svc-y', y.toFixed(4));
    };
    gsap.ticker.add(svcTick);
  };
  App.inits.push(svcInit);
  App.destroys.push(() => {
    if (svcTick) gsap.ticker.remove(svcTick); svcTick = null;
    document.querySelectorAll('[data-services]').forEach((r) => { delete r._svcfx; });
  });
  if (document.readyState !== 'loading') svcInit(document);
})();

/* ---------- CaseTags (was registered script CaseTags 1.6.0) ---------- */
// Tags from the Projects template page (/project-data/{slug}, [data-case-tags] [data-tag]) into [data-tags-from].
// Slug: the attribute value, else the closest link, else the current page. data-tags-format="text" = comma list.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  // Every tag on the site (project cards, case header, jobs): 28px tall as in the design, no link cursor
  // (a tag inside a project card still opens the project, it just doesn't announce itself as its own button)
  if (!document.getElementById('paloma-tags-css')) {
    const st = document.createElement('style'); st.id = 'paloma-tags-css';
    st.textContent = '.case-header_tag-list .nav_button{display:inline-flex;align-items:center;height:2em;padding-top:0;padding-bottom:0;cursor:default}';
    document.head.appendChild(st);
  }
  const docs = App._docs = App._docs || new Map();
  App.projectDoc = App.projectDoc || ((s) => {
    if (!docs.has(s)) docs.set(s, fetch('/project-data/' + encodeURIComponent(s)).then((r) => (r.ok ? r.text() : ''))
      .then((h) => new DOMParser().parseFromString(h, 'text/html')).catch(() => null));
    return docs.get(s);
  });
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tag = (t) => '<div class="nav_button" data-glow-button><div class="nav_button-glow" data-glow-layer="1"></div><div class="nav_button-stroke">' +
    '<div class="nav_button-stroke-gradient is-one" data-rim="0"></div><div class="nav_button-stroke-gradient is-two" data-rim="180"></div></div>' +
    '<div class="nav_button-text"><div class="nav_button-label">' + esc(t) + '</div></div></div>';
  const last = (p) => (p || '').replace(/\/$/, '').split('/').pop() || '';
  const slugOf = (el) => {
    const v = (el.getAttribute('data-tags-from') || '').trim();
    if (v) return v;
    const a = el.closest('a[href]');
    if (a) { try { const s = last(new URL(a.href, location.origin).pathname); if (s) return s; } catch (_) {} }
    return last(location.pathname);
  };
  const fill = (el, slug) => App.projectDoc(slug).then((d) => {
    const list = d ? [...d.querySelectorAll('[data-case-tags] [data-tag]')].map((t) => t.textContent.trim()).filter(Boolean) : [];
    if (!list.length || !el.isConnected) return;
    if (el.getAttribute('data-tags-format') === 'text') { el.textContent = list.join(', '); return; }
    // A .case-header_tag-list placed inside the tags element in the Designer is filled as is (style it there:
    // gap, wrap, alignment); without one the list is created
    const host = el.querySelector('.case-header_tag-list'); if (host) host.removeAttribute('data-tag-placeholder'); // Designer sample list (hidden live) becomes the real one
    if (host) host.innerHTML = list.map(tag).join(''); else el.innerHTML = '<div class="case-header_tag-list">' + list.map(tag).join('') + '</div>';
    App.inits.forEach((fn) => { if (fn !== init) try { fn(el); } catch (_) {} }); // glass buttons pick the tags up
  });
  let io = null;
  function init(scope = document) {
    io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target, e.target._slug); } }), { rootMargin: '400px 0px' });
    (scope || document).querySelectorAll('[data-tags-from]').forEach((el) => {
      if (el._tags) return; el._tags = true; el._slug = slugOf(el);
      if (!el._slug) return;
      // In a slider the cards sit off-screen sideways (and clipped), so lazy loading would only fill them as they
      // slide in: fill those right away. Grid cards further down the page stay lazy.
      if (el.closest('.splide, .case-slider, [data-social-slider]')) fill(el, el._slug);
      else io.observe(el);
    });
  }
  App.inits.push(init);
  App.destroys.push(() => { if (io) { io.disconnect(); io = null; } });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- SocialCard ---------- */
// Social Card component: CaseMedia plays the muted loop ([data-case-media] on .social-card_media).
// Play ([data-social-play]) restarts the video with sound and mutes every other card; press again to mute (keeps looping).
// Leaving the screen or a page transition mutes it again, so a card never plays sound out of view.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const CARD = '[data-social-card]';
  let io = null;
  if (!document.getElementById('paloma-social-css')) {
    const st = document.createElement('style'); st.id = 'paloma-social-css';
    st.textContent = '@keyframes paloma-pulse{0%,100%{opacity:1}50%{opacity:.45}}' +
      '[data-social-card].is-loading [data-social-play]{animation:paloma-pulse .9s ease-in-out infinite}';
    document.head.appendChild(st);
  }
  const videoOf = (card) => card.querySelector('video');
  // Touch (phone, tablet): no muted loops. The card shows its thumbnail and only gets a video when you tap play,
  // one at a time; pause really pauses, sliding or scrolling away pauses it too. Desktop keeps the muted loops.
  const TOUCH = App.TOUCH;
  const lazyAttach = (card) => {
    const box = card.querySelector('[data-case-media]');
    const url = box && (box.getAttribute('data-case-media') || '').trim();
    if (!url) return null;
    const v = document.createElement('video');
    v.loop = v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.className = 'case-media_video'; v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1';
    v.addEventListener('playing', () => v.classList.add('is-revealed'), { once: true });
    const m3 = /\.m3u8(\?|$)/i.test(url);
    if (m3 && !v.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) {
      const h = new Hls({ maxBufferLength: 20 }); h.loadSource(url); h.attachMedia(v); box._lazyHls = h;
    } else v.src = url;
    box.insertBefore(v, box.querySelector('.social-card_rim'));
    return v;
  };
  const setUi = (card, on) => {
    if (!on && card.classList.contains('is-sound')) { // glow fades out (CSS is-glow-out, 0.5s)
      card.classList.add('is-glow-out'); clearTimeout(card._go); card._go = setTimeout(() => card.classList.remove('is-glow-out'), 500);
    }
    if (on) card.classList.remove('is-glow-out');
    card.classList.toggle('is-sound', on);
    const b = card.querySelector('[data-social-play]');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Pause' : 'Play with sound'); }
  };
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  // In a slider: while one card plays with sound, the other videos keep going for a moment, then slow down and
  // stop, like the auto scroll easing out. They start again (speeding up) when the sound stops.
  const others = (card) => { const sl = card.closest('[data-social-slider]'); return sl ? [...sl.querySelectorAll('video')].filter((v) => !card.contains(v)) : []; };
  const hold = (card) => {
    if (!window.gsap) return;
    others(card).forEach((v) => {
      if (v._held || v.paused) return; v._held = true; gsap.killTweensOf(v); // only the ones that are playing
      gsap.to(v, { playbackRate: 0.1, duration: 1.6, delay: 0.8, ease: 'power2.in', onComplete: () => { v.pause(); v.playbackRate = 1; } });
    });
  };
  const release = (card) => {
    const sl = card.closest('[data-social-slider]');
    if (!sl || !window.gsap || sl.querySelector('[data-social-card].is-sound')) return;
    // Only the videos on screen start again; the rest stay paused until they scroll or slide into view (CaseMedia).
    // Restarting every video in the slider at once made the page stall when you paused.
    sl.querySelectorAll('video').forEach((v) => {
      if (!v._held) return; v._held = false; gsap.killTweensOf(v); v.playbackRate = 1;
      const r = v.getBoundingClientRect();
      if (!(r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight)) return;
      if (v.paused) { v.playbackRate = 0.1; play(v); }
      gsap.to(v, { playbackRate: 1, duration: 1.2, ease: 'power2.out' });
    });
  };
  // Tablet and phone: the card that starts playing glides to the middle of the screen, so it is never half off-screen.
  // Auto scroll (SliderMotion) is paused meanwhile: it pauses on pointerenter, which is what it gets here.
  const CENTER = { maxWidth: 767, duration: 0.7, ease: 'power3.inOut' };
  const center = (card) => {
    if (!matchMedia('(max-width: ' + CENTER.maxWidth + 'px)').matches) return;
    const root = card.closest('[data-social-slider]'), sp = root && root._sp, slide = card.closest('.splide__slide');
    if (!sp || !slide) return;
    const track = root.querySelector('.splide__track');
    if (track && !root._held) { root._held = true; track.dispatchEvent(new Event('pointerenter')); }
    const S = sp.Components.Slides.get().find((x) => x.slide === slide);
    if (S) sp.go(S.isClone ? S.slideIndex : S.index); // focus is 'center' on tablet and phone
  };
  const uncenter = (card) => {
    const root = card.closest('[data-social-slider]');
    if (!root || !root._held || root.querySelector(CARD + '.is-sound')) return;
    root._held = false;
    const track = root.querySelector('.splide__track');
    if (track) track.dispatchEvent(new Event('pointerleave'));
  };
  const mute = (card) => { const v = videoOf(card); if (v) { v.muted = true; if (TOUCH) v.pause(); } setUi(card, false); release(card); uncenter(card); };

  const start = (card) => {
    if (!card._wait) center(card); // right away, also while the video is still attaching
    const v = videoOf(card) || (TOUCH ? lazyAttach(card) : null);
    if (!v) { // HLS still attaching: wait for CaseMedia to add the video, then start
      if (card._wait) return;
      card._wait = new MutationObserver(() => { if (videoOf(card)) { card._wait.disconnect(); card._wait = null; start(card); } });
      card._wait.observe(card, { childList: true, subtree: true });
      return;
    }
    document.querySelectorAll(CARD + '.is-sound').forEach((c) => c !== card && mute(c));
    // First play starts at the beginning, but only when that part is already buffered: a seek to a part that
    // still has to load made the first tap feel like nothing happened. Otherwise the sound comes on where it is.
    if (!card._heard) {
      card._heard = true;
      const b = v.buffered; let ok = false;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= 0.1 && b.end(i) > 1.5) ok = true;
      if (ok) v.currentTime = 0;
    }
    // Feedback while the sound version is still loading: the play button pulses (CSS below) until it plays
    card.classList.add('is-loading');
    const ready = () => card.classList.remove('is-loading');
    if (!v.paused && v.readyState >= 3) setTimeout(ready, 0); else { v.addEventListener('playing', ready, { once: true }); v.addEventListener('canplay', ready, { once: true }); setTimeout(ready, 8000); }
    if (v._held) { v._held = false; gsap.killTweensOf(v); v.playbackRate = 1; }
    v.muted = false; v.loop = true;
    play(v); setUi(card, true); hold(card);
  };
  // Pause = sound off: the video keeps looping muted, like the other cards
  // Touch: pause is a real pause (and muted, so no sound can carry on)
  const stop = (card) => { const v = videoOf(card); if (v) { v.muted = true; if (TOUCH) v.pause(); else if (v.paused) play(v); } setUi(card, false); release(card); uncenter(card); };
  App.socialStop = (card) => { if (card.classList.contains('is-sound')) stop(card); };

  // Play button, and a click on the video itself (same toggle). A drag in the slider is not a click: ignored when
  // the pointer moved more than DRAG px between press and release.
  const DRAG = 6;
  let down = null;
  document.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; }, { passive: true });
  document.addEventListener('click', (e) => {
    if (!e.target.closest) return;
    const b = e.target.closest('[data-social-play]');
    const m = !b && e.target.closest(CARD + ' .social-card_media');
    if (!b && !m) return;
    if (m && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG) return;
    e.preventDefault();
    const card = (b || m).closest(CARD);
    if (card) card.classList.contains('is-sound') ? stop(card) : start(card);
  });

  const init = (scope = document) => {
    const cards = (scope || document).querySelectorAll(CARD);
    if (!cards.length) return;
    if (!io) io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { const v = !TOUCH && videoOf(en.target); if (v && v.paused && !v._held && !en.target.classList.contains('is-sound')) play(v); }
      else if (en.target.classList.contains('is-sound')) mute(en.target);
    }));
    cards.forEach((c) => io.observe(c));
  };
  // Touch: keep CaseMedia off the social cards (it would start a muted loop in each). Runs before CaseMedia's init.
  const lazy = (scope = document) => {
    if (!TOUCH) return;
    (scope || document).querySelectorAll(CARD + ' [data-case-media]').forEach((box) => {
      if (box._lazy) return;
      if (box._cm && !box.querySelector('video')) try { box._cm(); } catch (_) {} // CaseMedia got there first
      box._lazy = 1;
      box._cm = () => { const h = box._lazyHls; if (h) try { h.destroy(); } catch (_) {} const v = box.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } delete box._lazyHls; };
    });
  };
  App.inits.unshift(lazy);
  if (document.readyState !== 'loading') lazy(document);
  App.inits.push(init);
  App.destroys.push(() => {
    document.querySelectorAll(CARD + ' [data-case-media]').forEach((b) => { if (b._lazy && b._cm) b._cm(); });
    document.querySelectorAll(CARD).forEach((c) => { if (c._wait) { c._wait.disconnect(); c._wait = null; } mute(c); });
    if (io) { io.disconnect(); io = null; }
  });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- CardRim ---------- */
// Social Card playing with sound: the glass rim of the buttons runs round the video edge. Markup in the Designer:
// .social-card_rim [data-card-rim] inside .social-card_media, with the two nav_button-stroke-gradient highlights
// (data-rim 0 and 180, same as the glass buttons). Shown by CSS while .is-sound; this only moves the highlights.
// It drifts round slowly on its own (also on phones, so the playing card keeps shining) and turns towards the
// cursor while you hover the card.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const RIM = {
    drift: 30,        // degrees a second when not following the cursor (one lap in 12s)
    follow: 0.12,     // how quickly it turns to the cursor (share of the gap per frame at 60fps)
    margin: 40,       // px around the card that still counts as hovering
    rest: -135,       // start angle: top left, like the buttons at rest
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAN_HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const live = new Set();
  let px = null, py = null, on = false;
  const edge = (w, h, deg) => { // point on the box edge in that direction, from the centre
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const k = Math.min(Math.abs(c) > 1e-6 ? (w / 2) / Math.abs(c) : Infinity, Math.abs(s) > 1e-6 ? (h / 2) / Math.abs(s) : Infinity);
    return { x: w / 2 + c * k, y: h / 2 + s * k };
  };
  const gap = (d) => ((d % 360) + 540) % 360 - 180; // shortest turn
  const move = (e) => { px = e.clientX; py = e.clientY; };
  const tick = (time, dt) => {
    const d = Math.min(dt, 50) / 1000;
    live.forEach((r) => {
      if (!r.el.isConnected) { live.delete(r); return; }
      if (!r.card.classList.contains('is-sound') && !r.card.classList.contains('is-glow-out')) return;
      const w = r.el.offsetWidth, h = r.el.offsetHeight;
      let hover = false;
      if (CAN_HOVER && px !== null) {
        const b = r.el.getBoundingClientRect(), m = RIM.margin;
        if (px > b.left - m && px < b.right + m && py > b.top - m && py < b.bottom + m) {
          hover = true;
          const to = Math.atan2(py - (b.top + b.height / 2), px - (b.left + b.width / 2)) * 180 / Math.PI;
          r.a += gap(to - r.a) * (1 - Math.pow(1 - RIM.follow, d * 60));
        }
      }
      if (!hover && !RM) r.a += RIM.drift * d;
      r.hl.forEach((g) => { const p = edge(w, h, r.a + g.off); g.x(p.x); g.y(p.y); });
    });
    if (!live.size) stop();
  };
  const start = () => { if (on || !window.gsap) return; on = true; gsap.ticker.add(tick); if (CAN_HOVER) window.addEventListener('pointermove', move, { passive: true }); };
  const stop = () => { if (!on) return; on = false; gsap.ticker.remove(tick); window.removeEventListener('pointermove', move); };
  const setup = (el) => {
    if (el._cr || !window.gsap) return;
    const card = el.closest('[data-social-card]');
    if (!card) return;
    el._cr = true;
    const hl = [...el.querySelectorAll('[data-rim]')].map((g) => {
      gsap.set(g, { left: 0, top: 0, xPercent: -50, yPercent: -50 });
      return { off: parseFloat(g.dataset.rim) || 0, x: gsap.quickSetter(g, 'x', 'px'), y: gsap.quickSetter(g, 'y', 'px') };
    });
    const r = { el, card, hl, a: RIM.rest };
    hl.forEach((g) => { const p = edge(el.offsetWidth, el.offsetHeight, r.a + g.off); g.x(p.x); g.y(p.y); });
    live.add(r);
  };
  const init = (scope = document) => { (scope || document).querySelectorAll('[data-card-rim]').forEach(setup); if (live.size) start(); };
  App.inits.push(init);
  App.destroys.push(() => { live.forEach((r) => { delete r.el._cr; }); live.clear(); stop(); });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- MediaPoster ---------- */
// Case Media, Case Media Text, Social Card, Media Card: once the video loop plays, hide the image under it
// (it could peek out 1px at the edge). Waits for the video fade-in (MediaReveal) before hiding.
(() => {
  if (document.getElementById('paloma-poster-css')) return;
  const st = document.createElement('style'); st.id = 'paloma-poster-css';
  st.textContent = '[data-case-media]:has(> video.is-revealed) > img{visibility:hidden;transition:visibility 0s linear 1s}' +
    // Video 1px bigger on every side (the box clips it): no background line at the edge from sub-pixel rounding
    '[data-case-media]{overflow:hidden}[data-case-media]>video.case-media_video{top:-1px!important;left:-1px!important;right:auto!important;bottom:auto!important;width:calc(100% + 2px)!important;height:calc(100% + 2px)!important}' +
    // Full Video Player: thumbnail and video 2px bigger on every side, so the player's background never shows at the edge
    '.bunny-player .bunny-player__placeholder,.bunny-player .bunny-player__video{top:-2px!important;left:-2px!important;width:calc(100% + 4px)!important;height:calc(100% + 4px)!important;max-width:none}' +
    // Video hidden until first play: on iPhone the (empty, black) native HLS video sat on top of the thumbnail
    '[data-bunny-player-init]:not([data-player-activated="true"]) .bunny-player__video{opacity:0}';
  document.head.appendChild(st);
})();

/* ---------- SocialSlider ---------- */
// Splide's screen reader announcer (.splide__sr) shows "…" while sliding when Splide's own CSS isn't loaded: hide it
// visually, it stays readable for screen readers. Applies to every Splide slider on the site.
if (!document.getElementById('paloma-splide-sr')) {
  const st = document.createElement('style'); st.id = 'paloma-splide-sr';
  st.textContent = '.splide__sr{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;border:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}';
  document.head.appendChild(st);
}
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const live = new Set();
  let loading = null;
  const loadSplide = () => loading || (loading = window.Splide ? Promise.resolve() : new Promise((res) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js';
    sc.onload = sc.onerror = res; document.head.appendChild(sc);
  }));

  const setup = (root) => {
    if (root._ss) return; root._ss = 1;
    // Slides = the Social Card instances. Webflow wraps slot content in its own div, so the list is whatever
    // holds the cards and the track is its parent (Splide needs the list as a direct child of the track).
    const CARD = '[data-social-card], [data-media-card]';
    const first = root.querySelector(CARD);
    const slide0 = first && first.parentElement; // the card component's instance root
    const list = slide0 && slide0.parentElement;
    const track = list && list.parentElement;
    const slides = list ? [...list.children].filter((c) => c.querySelector(CARD)) : [];
    // Each arrow is its own nav glass button (rim reflections, glow, magnetic, press: site footer script)
    root.querySelectorAll('[data-social-prev], [data-social-next]').forEach((a) => a.setAttribute('data-glow-button', ''));
    if (!track || !list || !slides.length) { root.style.display = 'none'; return; }
    if (slides.length < 2) { root.classList.add('is-single', 'fx-ready'); return; }
    loadSplide().then(() => {
      if (!root.isConnected || !window.Splide) return;
      root.classList.add('splide'); track.classList.add('splide__track'); list.classList.add('splide__list');
      slides.forEach((s) => s.classList.add('splide__slide'));
      // Auto scroll comes from the component variant (Off / Slow / Fast); SliderMotion reads data-autoscroll
      // Fast = 4 (80px a second, same as the homepage slider), Slow = 2 (40px a second)
      const VAR = /^data-wf--.*slider.*--variant$/; // only this slider's own variant, not e.g. Page Theme
      let variant = '';
      for (let el = root; el && el !== document.body && !variant; el = el.parentElement) {
        const at = [...el.attributes].find((x) => VAR.test(x.name)); if (at) variant = at.value;
      }
      const auto = /fast/.test(variant) ? 4 : /slow/.test(variant) ? 2 : 0;
      // Infinite (loop) only when it auto scrolls: a loop clones every card, and every clone is another video
      // player. Tablet and phone: the cards sit centred (start on the second card when there are 3 or more).
      // Desktop: left aligned on the page margin (Variables > Responsive > Page Margin).
      // Padding is the CSS variable itself (not a value read once at start), so it always follows the breakpoint.
      // Phone layout through Splide's breakpoints, so it can't get stuck on the layout of the moment it started.
      const pm = 'var(--_responsive---page-margin, 1.25rem)';
      // Phone: the cards between first and last sit centred; the first stays on the left page margin and the last
      // on the right one (trimSpace), so there is no empty space before the first or after the last.
      const sp = new Splide(root, {
        type: auto ? 'loop' : 'slide', autoWidth: true, gap: '1.5625rem', arrows: false, pagination: false, speed: 1000,
        focus: 0, trimSpace: true,
        padding: { left: pm, right: auto ? 0 : pm },
        breakpoints: { 767: { focus: 'center' } },
      });
      // Touch: sliding to another card pauses the one that plays
      if (App.TOUCH) sp.on('move', (dest) => {
        root.querySelectorAll('[data-social-card].is-sound').forEach((c) => {
          const S = sp.Components.Slides.get().find((x) => x.slide === c.closest('.splide__slide'));
          if (S && (S.isClone ? S.slideIndex : S.index) !== dest && App.socialStop) App.socialStop(c);
        });
      });
      sp.on('mounted', () => {
        // Loop clones copy the DOM: drop videos CaseMedia already attached, the inits below give them their own
        root.querySelectorAll('.splide__slide--clone video').forEach((v) => v.remove());
        App.inits.forEach((fn) => { if (fn !== init) try { fn(root); } catch (_) {} });
        window.lenis && lenis.resize();
      });
      sp.mount();
      root._sp = sp; live.add(root);
      // Card widths can change after mount (fonts, images, the column calc): measure again, so the last card keeps
      // its page margin on the right instead of ending against the screen edge
      const remeasure = () => { if (root.isConnected) try { sp.refresh(); } catch (_) {} };
      if (document.readyState !== 'complete') window.addEventListener('load', remeasure, { once: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
      setTimeout(remeasure, 1500);
      const go = (e) => {
        const b = e.target.closest && e.target.closest('[data-social-prev], [data-social-next]');
        if (!b || !root.contains(b)) return;
        e.preventDefault();
        sp.go(b.hasAttribute('data-social-next') ? '>' : '<');
      };
      root.addEventListener('click', go);
      // Press: the arrows split into two separate buttons. Both get the same rounded corners all round, the pressed
      // one slides out a little; both snap back on release. No shrink on press (the glass script's 95% is undone here).
      // 'left' + radii, because the glass script owns x/y (magnetic) and scale (press).
      const R = '0.75rem';
      const arrows = [...root.querySelectorAll('[data-social-prev], [data-social-next]')];
      const CORNERS = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
      const split = (btn, on) => {
        if (!window.gsap) return;
        arrows.forEach((a) => {
          const next = a.hasAttribute('data-social-next'), me = a === btn;
          const v = { duration: on ? 0.25 : 0.7, ease: on ? 'power3.out' : 'elastic.out(1, 0.55)', overwrite: 'auto' };
          if (on) { CORNERS.forEach((k) => { v[k] = R; }); v.left = me ? (next ? 6 : -6) : 0; }
          else {
            const rest = next ? ['0rem', R, R, '0rem'] : [R, '0rem', '0rem', R];
            CORNERS.forEach((k, i) => { v[k] = rest[i]; }); v.left = 0;
            v.onComplete = () => gsap.set(a, { clearProps: 'left,' + CORNERS.join(',') });
          }
          gsap.to(a, v);
        });
        if (on) setTimeout(() => { gsap.killTweensOf(btn, 'scale'); gsap.set(btn, { scale: 1 }); }, 0);
      };
      let held = null;
      const down = (e) => { const b = e.target.closest && e.target.closest('[data-social-prev], [data-social-next]'); if (!b || !root.contains(b)) return; held = b; split(b, true); };
      const up = () => { if (held) { split(held, false); held = null; } };
      root.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, up));
      // Moving the slider (drag, swipe, arrows) makes the arrow of that direction glow for a moment
      const Move = sp.Components.Move;
      const flash = (btn) => { if (!btn) return; btn.classList.remove('is-flash'); void btn.offsetWidth; btn.classList.add('is-flash'); clearTimeout(btn._fl); btn._fl = setTimeout(() => btn.classList.remove('is-flash'), 500); };
      sp.on('move', (index, prev, dest) => {
        const to = Move.toPosition(dest, true), from = Move.getPosition();
        flash(root.querySelector(to < from ? '[data-social-next]' : '[data-social-prev]'));
      });
      root._ssStop = () => {
        root.removeEventListener('click', go); root.removeEventListener('pointerdown', down);
        ['pointerup', 'pointercancel'].forEach((t) => document.removeEventListener(t, up));
      };
      root.setAttribute('data-autoscroll', String(auto));
      root.dispatchEvent(new CustomEvent('slider:ready', { bubbles: true }));
    });
  };
  const init = (scope = document) => (scope || document).querySelectorAll('[data-social-slider]').forEach(setup);
  App.inits.push(init);
  App.destroys.push(() => {
    live.forEach((r) => { try { r._ssStop && r._ssStop(); r._sp.destroy(true); } catch (_) {} });
    live.clear();
  });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- SliderDrag ---------- */
// Every slider (homepage, More Cases, Case Study Slider): a horizontal trackpad swipe drags the slider with your
// fingers, you can go back mid-swipe, and when you let go it settles on the nearest card. While swiping sideways
// the page doesn't scroll up and down (Lenis and the native scroll get nothing). Replaces SliderMotion's
// one-swipe-one-card. If the slider has arrows, the one in the swipe direction glows.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const live = new Set();
  document.addEventListener('slider:ready', (ev) => {
    const root = ev.target, sp = root._sp;
    if (!sp || root._drag || !window.gsap || !window.Splide) return;
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
      snapTw = gsap.to(o, { p: Move.toPosition(i), duration: 0.6, ease: 'power3.out', onUpdate: () => Move.translate(o.p), onComplete: () => { Ctrl.setIndex(i); snapTw = null; } });
    };
    const wheel = (e) => {
      const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
      if (!lock && ax <= ay) return; // vertical: normal page scroll
      lock = 1; clearTimeout(lockT); lockT = setTimeout(() => { lock = 0; }, 220);
      e.preventDefault(); e.stopImmediatePropagation();
      if (snapTw) { snapTw.kill(); snapTw = null; }
      if (sp.state.is(Splide.STATES.MOVING)) Move.cancel();
      if (!flashed && ax > 2) { flashed = true; flash(e.deltaX > 0 ? '[data-social-next]' : '[data-social-prev]'); }
      Move.translate(Move.getPosition() - e.deltaX);
      clearTimeout(snapT); snapT = setTimeout(snap, 140);
    };
    root.addEventListener('wheel', wheel, { capture: true, passive: false });
    root._drag = () => { root.removeEventListener('wheel', wheel, { capture: true }); if (snapTw) snapTw.kill(); delete root._drag; };
    live.add(root);
  });
  App.destroys.push(() => { live.forEach((r) => r._drag && r._drag()); live.clear(); });
})();

/* ---------- MailMagnet ---------- */
// Mail CTA: the big email address is pulled towards the cursor (magnetic, flat, no tilt) and springs back on leave.
// Active within MARGIN px around the link. Desktop only, off with reduced motion.
// Every move starts a fresh tween (overwrite auto), so a leave spring never kills the next hover.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const FX = {
    followX: 0.04, // share of the cursor distance the link travels horizontally
    followY: 0.18, // share of the cursor distance the link travels vertically
    margin: 60,    // px around the link where it already reacts
  };
  const ok = () => matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = new Set();
  const setup = (a) => {
    if (a._mm || !window.gsap || !ok()) return;
    let on = false;
    const move = (e) => {
      const r = a.getBoundingClientRect(), m = FX.margin;
      const ox = gsap.getProperty(a, 'x'), oy = gsap.getProperty(a, 'y');
      // resting box (without the current offset), so it never runs away from the cursor
      const L = r.left - ox, T = r.top - oy;
      const inside = e.clientX > L - m && e.clientX < L + r.width + m && e.clientY > T - m && e.clientY < T + r.height + m;
      if (!inside) { if (on) leave(); return; }
      on = true;
      const dx = e.clientX - (L + r.width / 2), dy = e.clientY - (T + r.height / 2);
      // never push the text past the window edges
      const minX = Math.min(0, -L), maxX = Math.max(0, innerWidth - (L + r.width));
      const x = Math.max(minX, Math.min(maxX, dx * FX.followX));
      gsap.to(a, { x, y: dy * FX.followY, duration: 0.8, ease: 'power3', overwrite: 'auto' });
    };
    const leave = () => {
      on = false;
      gsap.to(a, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
    };
    const out = () => on && leave();
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', out);
    a._mm = () => {
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', out);
      gsap.killTweensOf(a); gsap.set(a, { clearProps: 'transform' }); delete a._mm;
    };
    live.add(a);
  };
  const init = (scope = document) => (scope || document).querySelectorAll('.mail-cta_link').forEach(setup);
  App.inits.push(init);
  App.destroys.push(() => { live.forEach((a) => typeof a._mm === 'function' && a._mm()); live.clear(); });
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- PlayBounce ---------- */
// Full Video Player big play button: a bouncier spring back when the cursor leaves (the glass button script's
// default is elastic.out(1, 0.3) over 1.6s). Mirrors that script's release test (resting box + 12px), then takes
// over the x/y tween one tick later, so the glass script's own release is replaced, not fought.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const BOUNCE = {
    ease: 'elastic.out(1, 0.4)',     // amplitude, period: higher amplitude + shorter period = more wobble
    duration: 1.6,
    margin: 12,                      // same release margin as the glass button script
  };
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const live = new Set();
  const setup = (btn) => {
    if (btn._pb || !window.gsap) return; btn._pb = true;
    const inner = btn.querySelector('[data-magnetic-inner-target]');
    let engaged = false;
    const move = (e) => {
      const r = btn.getBoundingClientRect();
      const ox = gsap.getProperty(btn, 'x') || 0, oy = gsap.getProperty(btn, 'y') || 0;
      const cx = r.left + r.width / 2 - ox, cy = r.top + r.height / 2 - oy;
      const dx = e.clientX - cx, dy = e.clientY - cy, m = BOUNCE.margin;
      const out = btn.dataset.glowShape === 'circle'
        ? Math.hypot(dx, dy) > btn.offsetWidth / 2 + m
        : Math.abs(dx) > btn.offsetWidth / 2 + m || Math.abs(dy) > btn.offsetHeight / 2 + m;
      if (!out) { engaged = true; return; }
      if (!engaged) return;
      engaged = false;
      setTimeout(() => {
        gsap.to(btn, { x: 0, y: 0, ease: BOUNCE.ease, duration: BOUNCE.duration, overwrite: 'auto' });
        if (inner) gsap.to(inner, { x: 0, y: 0, ease: BOUNCE.ease, duration: BOUNCE.duration + 0.3, overwrite: 'auto' });
      }, 0);
    };
    window.addEventListener('pointermove', move, { passive: true });
    btn._pbOff = () => { window.removeEventListener('pointermove', move); delete btn._pb; };
    live.add(btn);
  };
  const init = (scope = document) => (scope || document).querySelectorAll('.bunny-player__big-btn[data-glow-button]').forEach(setup);
  App.inits.push(init);
  App.destroys.push(() => { live.forEach((b) => b._pbOff && b._pbOff()); live.clear(); });
  if (document.readyState !== 'loading') init(document);
})();


/* ---------- MobileMenu ---------- */
// Menu (Navigation component, tablet and phone, below 992px): the glass toggle [data-nav-toggle] opens the glass panel
// [data-nav-menu]. Lines: the outer two slide into the middle one, which stretches into a single bar (close icon).
// Closes on a link, the toggle, Escape, a page change and when the screen gets wider than a phone.
// Current page: .is-current on the matching .nav_menu-link (href, or data-nav-match="/projects" for the sections under it),
// which swaps in the long serif label (CSS in the Navigation embed).
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  // reverse: closing speed vs opening (1 = same). pickFade / pickDim: other links dim after a link tap (time / opacity). pickHold: how long
  // the tapped page name stays alone in the open panel before it shrinks back.
  const FX = { open: 0.5, reverse: 0.9, stagger: 0.05, rise: 18, pickFade: 0.45, pickHold: 0.55, pickDim: 0.5 };
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clean = (p) => (p || '').replace(/\/$/, '') || '/';
  let wired = false, open = false, tl = null, fade = null, itemTw = null, hold = null, picked = null, toggle, menu, lines;

  const markCurrent = () => {
    if (!menu) return;
    const path = clean(location.pathname);
    menu.querySelectorAll('.nav_menu-link').forEach((a) => {
      const raw = a.getAttribute('href') || '';
      let on = false;
      if (raw && raw[0] !== '#') on = clean(new URL(a.href, location.origin).pathname) === path;
      const m = a.dataset.navMatch;
      if (!on && m) on = m.split(',').some((p) => { p = clean(p.trim()); return p !== '/' && (path === p || path.startsWith(p + '/')); });
      a.classList.toggle('is-current', on);
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
  };

  const items = () => [...menu.querySelectorAll('.nav_menu-link, .nav_menu-jobs')];
  // Clip the panel down to the toggle's box (same corner radius), so opening grows the toggle into the panel
  const R = 7;
  const toggleClip = () => {
    const p = menu.getBoundingClientRect(), t = toggle.getBoundingClientRect();
    const v = [t.top - p.top, p.right - t.right, p.bottom - t.bottom, t.left - p.left].map((n) => Math.max(0, n).toFixed(1) + 'px');
    return 'inset(' + v.join(' ') + ' round ' + R + 'px)';
  };
  const FULL = 'inset(0px 0px 0px 0px round ' + R + 'px)';
  // One timeline for both directions: closing plays the opening in reverse (a bit quicker), so it is exactly as
  // smooth as the opening. Returns a promise that resolves once the menu is fully closed (links wait for it).
  const setOpen = (v, instant) => {
    if (!menu || v === open) return Promise.resolve();
    open = v;
    toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
    menu.setAttribute('aria-hidden', v ? 'false' : 'true');
    document.documentElement.classList.toggle('is-menu-open', v);
    const fast = instant || calm();
    if (v) {
      if (window.lenis) window.lenis.stop();
      if (tl) tl.kill();
      if (fade) fade.kill();
      if (hold) hold.kill();
      menu.classList.remove('is-leaving');
      menu.querySelectorAll('.is-picked').forEach((el) => el.classList.remove('is-picked'));
      const [a, b, c] = lines;
      const gap = b && a ? b.offsetTop - a.offsetTop : 5;
      toggle.classList.add('is-open'); // its own glass hides: the panel is the glass now
      gsap.set(menu, { autoAlpha: 1, clipPath: toggleClip() });
      gsap.set(items(), { autoAlpha: 0, y: FX.rise });
      tl = gsap.timeline()
        .to(menu, { clipPath: FULL, duration: FX.open * 1.3, ease: 'expo.inOut' }, 0)
        .to(a, { y: gap, autoAlpha: 0, duration: 0.3, ease: 'power2.inOut' }, 0)
        .to(c, { y: -gap, autoAlpha: 0, duration: 0.3, ease: 'power2.inOut' }, 0)
        .to(b, { scaleX: 27 / 22, duration: 0.35, ease: 'power3.out' }, 0.1);
      // Links: their own tween (not in the timeline), so closing can fade them out right away while the panel
      // shrinks, instead of the reversed timeline first waiting for them
      if (itemTw) itemTw.kill();
      itemTw = gsap.to(items(), { autoAlpha: 1, y: 0, duration: FX.open, ease: 'power3.out', stagger: FX.stagger, delay: fast ? 0 : FX.open * 0.6 });
      if (fast) { tl.progress(1); itemTw.progress(1); }
      return Promise.resolve();
    }
    return new Promise((done) => {
      // Back at the button: panel glass fades out while the button's own glass fades in (0.2s CSS), never both
      const finish = () => {
        toggle.classList.remove('is-open');
        fade = gsap.to(menu, { autoAlpha: 0, duration: fast ? 0 : 0.2, ease: 'none', onComplete: () => {
          menu.classList.remove('is-leaving');
          menu.querySelectorAll('.is-picked').forEach((el) => el.classList.remove('is-picked'));
          if (window.lenis) window.lenis.start();
          done();
        } });
      };
      if (itemTw) itemTw.kill();
      if (hold) hold.kill();
      const all = items(), keep = picked && all.includes(picked) ? picked : null; picked = null;
      const reverse = () => tl.timeScale(FX.reverse).eventCallback('onReverseComplete', finish).reverse();
      if (!tl || fast) { gsap.set(all, { autoAlpha: 0 }); if (tl) tl.progress(0).pause(); finish(); return; }
      if (!keep) {
        // Closed with the button / Escape: links fade, panel shrinks back into the button straight away
        itemTw = gsap.to(all, { autoAlpha: 0, duration: 0.2, ease: 'power1.in', overwrite: true });
        return reverse();
      }
      // Closed from a link: the other links fade out completely, the page we're going to stays alone in the panel
      // for a moment, then the panel shrinks back into the button and wipes it away. Navigation waits for all of it.
      menu.classList.add('is-leaving'); keep.classList.add('is-picked');
      // Other links dim to FX.pickDim (labels via CSS below, the jobs line here), then the panel wipes them away
      itemTw = gsap.to(all.filter((el) => el !== keep && !el.classList.contains('nav_menu-link')), { opacity: FX.pickDim, duration: FX.pickFade, ease: 'power2.out', overwrite: true });
      hold = gsap.delayedCall(FX.pickHold, reverse);
    });
  };

  const wire = () => {
    toggle = document.querySelector('[data-nav-toggle]');
    menu = document.querySelector('[data-nav-menu]');
    if (!toggle || !menu || !window.gsap) return false;
    lines = [...toggle.querySelectorAll('.nav_toggle-line')];
    gsap.set(menu, { autoAlpha: 0 });
    // Press feedback: while a link is held, the other links dim (labels, since GSAP owns the links' inline opacity)
    if (!document.getElementById('paloma-menu-press-css')) {
      const st = document.createElement('style'); st.id = 'paloma-menu-press-css';
      st.textContent = '.nav_menu-label{transition:opacity ' + FX.pickFade + 's ease}'
        + '.nav_menu-links:has(.nav_menu-link:active) .nav_menu-link:not(:active) .nav_menu-label,'
        + '[data-nav-menu].is-leaving .nav_menu-link:not(.is-picked) .nav_menu-label{opacity:' + FX.pickDim + '}';
      document.head.appendChild(st);
    }
    toggle.addEventListener('click', () => setOpen(!open));
    toggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } });
    // A link in the menu: close first, then go (Swup would otherwise swap the page while the menu is still open).
    // Capture phase on window: runs before Swup's own link handler (Swup listens on document).
    window.addEventListener('click', (e) => {
      if (!open) return;
      // Tap outside the panel (and not on the toggle): close, and swallow the tap so nothing underneath fires
      // Exception: the nav logo always goes home (menu closes first, like a menu link)
      const logo = e.target.closest && e.target.closest('.nav_logo');
      if (!logo && !menu.contains(e.target) && !toggle.contains(e.target)) {
        e.preventDefault(); e.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      const link = logo || (e.target.closest && e.target.closest('a'));
      if (!link || (!logo && !menu.contains(link))) return;
      const href = link.getAttribute('href') || '';
      if (e.metaKey || e.ctrlKey || e.shiftKey || link.target === '_blank') return;
      e.preventDefault(); e.stopImmediatePropagation();
      picked = link;
      const go = link.hasAttribute('data-not-ready') || !href || href[0] === '#' || clean(new URL(link.href, location.origin).pathname) === clean(location.pathname) ? null : link.href;
      setOpen(false).then(() => { if (go) window.swup ? window.swup.navigate(go) : (location.href = go); });
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setOpen(false); toggle.focus(); } });
    matchMedia('(max-width: 991px)').addEventListener('change', (e) => { if (!e.matches) setOpen(false, true); });
    if (window.swup) window.swup.hooks.on('visit:start', () => setOpen(false));
    return true;
  };

  const init = () => {
    if (!wired) wired = wire();
    markCurrent();
  };
  App.inits.push(init);
  if (document.readyState !== 'loading') init();
})();

// iOS Safari only applies :active (Webflow Pressed state) to links when a touchstart listener exists
document.addEventListener('touchstart', () => {}, { passive: true });

/* ---------- HlsBoost ---------- */
// Video quality that fits the player. Bunny playlists list 360p first and native HLS starts there (blurry), so every
// player and CaseMedia loop goes through hls.js and we pick the start quality ourselves.
// 1.2.0: a paused video stops downloading. 1.1.0: the quality follows the size of the video on screen (capLevelToPlayerSize, at most 2x pixel density), so a
// 220px social card on a phone gets about 480p instead of 1080p, while a full-width player still gets 1080p.
// On phones the muted loops buffer less ahead. Prefetch picks the same quality the player will pick, per video.
// Browsers without hls.js support (iOS before 17.1) keep native playback.
(() => {
  const H = window.Hls;
  if (!H || !H.isSupported || !H.isSupported()) return;
  const PHONE = window.innerWidth < 768;
  const FX = {
    minBitrate: 1000000,                                            // never below this (about 480p on Bunny)
    maxDpr: 2,                                                      // pixel density counted when matching quality to size
    estimate: () => (window.innerWidth >= 1200 ? 12000000 : 6000000), // assumed bandwidth at start
    loopBuffer: PHONE ? 6 : 10,                                     // seconds a muted loop buffers ahead
    prefetchViewports: PHONE ? 1 : 2,                               // prefetch videos within this many screens from the top
    prefetchSegments: PHONE ? 1 : 2,                                // segments per video (~2 to 4 s each)
    prefetchMax: PHONE ? 3 : 6,                                     // at most this many videos per page
  };
  Object.assign(H.DefaultConfig, {
    abrEwmaDefaultEstimate: FX.estimate(), minAutoBitrate: FX.minBitrate, testBandwidth: false,
    capLevelToPlayerSize: true, maxDevicePixelRatio: FX.maxDpr,
  });
  // Muted loops (CaseMedia asks for a short buffer): cap it further on phones
  class PalomaHls extends H {
    constructor(c = {}) {
      const loop = c.maxBufferLength && c.maxBufferLength <= 10;
      super(loop ? Object.assign({}, c, { maxBufferLength: Math.min(c.maxBufferLength, FX.loopBuffer), maxMaxBufferLength: FX.loopBuffer * 2 }) : c);
    }
    // A paused video stops downloading (scrolled away, slid away, paused by hand); it picks up again on play
    attachMedia(m) {
      super.attachMedia(m);
      m._hls = this;
      if (m._pl) return; m._pl = 1;
      m.addEventListener('pause', () => { const h = m._hls; if (!h || m.seeking) return; try { h.stopLoad(); m._stopped = 1; } catch (_) {} });
      m.addEventListener('play', () => { const h = m._hls; if (!h || !m._stopped) return; m._stopped = 0; try { if (h.levels && h.levels.length) h.startLoad(m.currentTime); } catch (_) {} });
    }
  }
  window.Hls = PalomaHls;
  // The players check canPlayType for native HLS first; answering "no" sends them to hls.js
  // Not on iPhone / iPad: there several hls.js players at once froze the picture while the sound went on.
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const orig = HTMLMediaElement.prototype.canPlayType;
  if (!IOS) HTMLMediaElement.prototype.canPlayType = function (t) { return /mpegurl/i.test(t || '') ? '' : orig.call(this, t); };

  // Prefetch: the same quality hls.js will pick for that element (smallest rendition covering its size, within the
  // start estimate and above minBitrate)
  const slow = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ''))); };
  const done = new Set();
  const abs = (u, base) => new URL(u, base).href;
  const pick = (master, base, el) => {
    const lines = master.split(/\r?\n/), out = [];
    lines.forEach((l, i) => {
      const bw = /BANDWIDTH=(\d+)/.exec(l), res = /RESOLUTION=(\d+)x(\d+)/.exec(l);
      if (bw && lines[i + 1]) out.push({ bw: +bw[1], w: res ? +res[1] : 0, h: res ? +res[2] : 0, url: abs(lines[i + 1].trim(), base) });
    });
    if (!out.length) return '';
    out.sort((a, b) => a.bw - b.bw);
    const r = el.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, FX.maxDpr);
    const cw = r.width * d, ch = r.height * d, cap = FX.estimate() * 0.95;
    const fit = out.find((v) => v.w >= cw || v.h >= ch) || out[out.length - 1];
    const ok = out.filter((v) => v.bw >= FX.minBitrate && v.bw <= cap && v.bw <= fit.bw);
    return (ok.pop() || out.find((v) => v.bw >= FX.minBitrate) || fit).url;
  };
  const warm = async (src, el) => {
    if (done.has(src)) return; done.add(src);
    try {
      const master = await (await fetch(src)).text();
      const variant = /#EXT-X-STREAM-INF/.test(master) ? pick(master, src, el) : src;
      if (!variant) return;
      const list = variant === src ? master : await (await fetch(variant)).text();
      const segs = list.split(/\r?\n/).filter((l) => l && l[0] !== '#').slice(0, FX.prefetchSegments);
      for (const sg of segs) await fetch(abs(sg, variant));
    } catch (_) {}
  };
  const run = () => {
    if (slow()) return;
    const limit = window.innerHeight * FX.prefetchViewports;
    const els = [...document.querySelectorAll('#swup [data-case-media], #swup [data-player-src]')]
      .filter((el) => !(App.TOUCH && el.closest('[data-social-card]')))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.top < limit && r.right > 0 && r.left < window.innerWidth && !el.closest('.splide__slide--clone'); })
      .filter((el) => /\.m3u8(\?|$)/i.test((el.getAttribute('data-case-media') || el.getAttribute('data-player-src') || '').trim()))
      .slice(0, FX.prefetchMax);
    els.reduce((p, el) => p.then(() => warm((el.getAttribute('data-case-media') || el.getAttribute('data-player-src')).trim(), el)), Promise.resolve());
  };
  const later = () => (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 1500));
  window.App = window.App || { inits: [], destroys: [] };
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  App.inits.push(() => { if (document.readyState === 'complete') setTimeout(later, 1200); }); // after a Swup page change
})();

/* ---------- SocialPoster ---------- */
// Social Card thumbnail: the Thumbnail URL prop ([data-poster], e.g. a Bunny thumbnail.jpg link) wins; otherwise the
// Thumbnail image; if that's empty too, a Bunny Video URL gives its own thumbnail (same folder, thumbnail.jpg).
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const empty = (img) => { const s = img.getAttribute('src') || ''; return !s || /placeholder/i.test(s); };
  const bunnyThumb = (u) => (/b-cdn\.net\/.+\/(playlist\.m3u8|play_\d+p\.mp4)/.test(u || '') ? u.replace(/[^/]+$/, 'thumbnail.jpg') : '');
  const set = (img, url) => { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = url; };
  const init = (scope = document) => (scope || document).querySelectorAll('.social-card_media').forEach((m) => {
    const img = m.querySelector('img'); if (!img) return;
    const own = (m.getAttribute('data-poster') || '').trim();
    if (own) return set(img, own);
    if (empty(img)) { const t = bunnyThumb(m.getAttribute('data-case-media')); if (t) set(img, t); }
  });
  App.inits.push(init);
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- NotReady (staging only) ---------- */
// On webflow.io only: links that go nowhere yet (href="#", or a page that returns 404) get a not-allowed cursor and
// do nothing when clicked, so the client can tell which pages aren't ready. Covers the navigation and the project
// cards (homepage, overview, sliders, also slider clones). Never runs on the custom domain.
(() => {
  if (!/\.webflow\.io$/.test(location.hostname)) return;
  window.App = window.App || { inits: [], destroys: [] };
  if (!document.getElementById('paloma-notready-css')) {
    const st = document.createElement('style'); st.id = 'paloma-notready-css';
    st.textContent = '[data-not-ready],[data-not-ready] *{cursor:not-allowed!important}';
    document.head.appendChild(st);
  }
  const NAV = '.navigation a[href], [data-nav-menu] a[href]';
  const CARDS = '.project-card a[href], a.project-card[href], a.project-card_link[href]';
  const cache = new Map(); // path -> Promise<boolean ok>
  const bad = new Set();   // paths known to 404
  const check = (path) => {
    if (!cache.has(path)) cache.set(path, fetch(path, { method: 'HEAD' }).then((r) => r.ok).catch(() => true));
    return cache.get(path);
  };
  const pathOf = (a) => { try { const u = new URL(a.href); return u.origin === location.origin ? u.pathname : null; } catch (_) { return null; } };
  const skip = (a) => a.closest('.nav_logo, [data-nav-toggle]') || a.target === '_blank';
  const markPath = (path) => document.querySelectorAll(NAV + ',' + CARDS).forEach((a) => { if (pathOf(a) === path) a.setAttribute('data-not-ready', ''); });
  const scan = () => document.querySelectorAll(NAV + ',' + CARDS).forEach((a) => {
    if (skip(a)) return;
    const h = a.getAttribute('href').trim();
    if (h === '#' || h === '') return a.setAttribute('data-not-ready', '');
    const path = pathOf(a);
    if (!path || (a.hash && path === location.pathname)) return;
    if (bad.has(path)) return a.setAttribute('data-not-ready', '');
    check(path).then((ok) => { if (!ok) { bad.add(path); markPath(path); } });
  });
  // Sliders clone their cards after init: scan again a moment later
  const init = () => { scan(); setTimeout(scan, 1500); };
  // Capture phase, before Swup and the menu: a not-ready link does nothing (in the menu it just closes the menu)
  window.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const path = pathOf(a);
    if (!a.hasAttribute('data-not-ready') && !(path && bad.has(path) && a.matches(NAV + ',' + CARDS))) return;
    e.preventDefault();
    if (!a.closest('[data-nav-menu]')) e.stopImmediatePropagation();
  }, true);
  App.inits.push(init);
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- CardLoaded ---------- */
// Project cards: the media box is filled with the theme text colour while the image loads. Once the image is in,
// the box switches to the page background, so a sub-pixel edge between image and box (seen as a 1px pink/violet
// line while scrolling) can no longer show.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  if (!document.getElementById('paloma-cardloaded-css')) {
    const st = document.createElement('style'); st.id = 'paloma-cardloaded-css';
    // 1.2.0: any media box holding a thumbnail or video gets the page background straight away (CSS, no load event
    // to miss: the load listener never fired for lazy images that were already in, so the pink stayed)
    st.textContent = '.project-card_media.is-loaded,.case-media_item.is-loaded,.bunny-player.is-loaded,' +
      ':is(.project-card_media,.case-media_item,.social-card_media,.media-card_media,.bunny-player):has(img[src]:not([src=""]),video)' +
      '{background-color:var(--_theme---background)!important}';
    document.head.appendChild(st);
  }
  const mark = (m) => {
    if (m._cl) return; m._cl = true;
    const img = m.querySelector('img'), vid = img ? null : m.querySelector('video');
    const done = () => m.classList.add('is-loaded');
    if (img) { if (img.complete && img.naturalWidth) return done(); return img.addEventListener('load', done, { once: true }); }
    if (vid) { if (vid.readyState >= 2) return done(); return vid.addEventListener('loadeddata', done, { once: true }); }
    done();
  };
  const init = (scope = document) => (scope || document).querySelectorAll('.project-card_media, .case-media_item, .bunny-player').forEach(mark);
  App.inits.push(init);
  if (document.readyState !== 'loading') init(document);
})();

/* ---------- LogoOnMedia ---------- */
// Nav glass logo: data-on-media on .nav_logo while it sits over an image or video (like NavOnMedia does for the
// buttons), so the Navigation embed can give it a lift there (brightness + soft shadow, see --logo-filter-media).
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const MEDIA = '#swup img, #swup video, #swup [data-nav-media]', MIN = 60;
  let media = [], raf = 0;
  const scan = () => { media = [...document.querySelectorAll(MEDIA)].filter((el) => !el.closest('[data-nav-ignore]')); };
  const check = () => {
    raf = 0;
    const logo = document.querySelector('.navigation .nav_logo');
    if (!logo) return;
    const r = logo.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = media.some((el) => {
      const q = el.getBoundingClientRect();
      if (q.width < MIN || q.height < MIN || x < q.left || x > q.right || y < q.top || y > q.bottom) return false;
      const st = getComputedStyle(el); return st.visibility !== 'hidden' && +st.opacity > 0.05;
    });
    logo.toggleAttribute('data-on-media', hit);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(check); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  // Keep the logo loop running: other scripts pause videos that scroll out of view or during transitions,
  // and some of them catch the logo too. Any pause while the tab is visible is undone.
  const keep = () => {
    const v = document.querySelector('.nav_logo-video');
    if (!v || v._keep) return; v._keep = true;
    const play = () => { if (!v._hold && document.visibilityState === 'visible' && v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } };
    v.addEventListener('pause', () => setTimeout(play, 50));
    v.addEventListener('ended', play);
    document.addEventListener('visibilitychange', play);
    setInterval(play, 2000);
    play();
  };
  App.inits.push(() => { scan(); queue(); keep(); });
  keep();
  App.destroys.push(() => { media = []; });
  if (document.readyState !== 'loading') { scan(); queue(); }
})();

/* ---------- LogoHover ---------- */
// Nav glass logo, desktop: hovering brakes the spinning loop to a stop exactly where it faces forward (the start/end
// frame of the loop), like the sliders easing out on hover. Leaving spins it back up.
// Physics-style braking: the playback rate follows sqrt(2 * BRAKE * time left), so it slows down smoothly and lands on
// the end frame; far from the end it first speeds up (up to MAX) so you never wait long.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  const BRAKE = 0.55;  // rate units per second: lower = longer, softer stop
  const MAX = 2;       // fastest it spins while heading for the stop
  const MIN = 0.07;    // browsers don't go much slower than this
  const RAMP = 0.9;    // s to spin back up to normal speed after leaving
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let wired = false;
  const wire = () => {
    const logo = document.querySelector('.navigation .nav_logo');
    const v = logo && logo.querySelector('.nav_logo-video');
    if (!v || !window.gsap) return false;
    let raf = 0, rate = 1, last = 0, spin = null;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const brake = (t) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
      const d = v.duration || 5;
      let left = d - v.currentTime; if (left < 0) left += d;
      if (left < 0.03 || (rate <= MIN + 0.001 && left < 0.08)) { v.pause(); v.currentTime = 0; stop(); return; }
      const target = Math.max(MIN, Math.min(MAX, Math.sqrt(2 * BRAKE * left)));
      rate += (target - rate) * Math.min(1, dt * 6); // smooth towards the braking curve
      v.playbackRate = rate;
      raf = requestAnimationFrame(brake);
    };
    logo.addEventListener('pointerenter', () => {
      if (spin) { spin.kill(); spin = null; }
      v._hold = true; rate = v.paused ? MIN : (v.playbackRate || 1); last = 0;
      if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      stop(); raf = requestAnimationFrame(brake);
    });
    logo.addEventListener('pointerleave', () => {
      stop(); v._hold = false;
      const o = { r: Math.max(MIN, v.playbackRate || MIN) };
      v.playbackRate = o.r;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      spin = gsap.to(o, { r: 1, duration: RAMP, ease: 'power2.in', onUpdate: () => { v.playbackRate = o.r; } });
    });
    return true;
  };
  App.inits.push(() => { if (!wired) wired = wire(); });
  if (document.readyState !== 'loading') wired = wire();
})();
