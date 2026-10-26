/*!
 * paloma.js: Paloma site bundle (kevinbrenkman/studio-scripts)
 * Load a pinned version only (commit hash): cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<sha>/projects/paloma/paloma.js
 * Registers into the Swup shell registry (App.inits / App.destroys) from the site footer.
 *
 * Modules
 *  - EmblemMask 2.5.0 (same emblem size on every card, 30vw, optically +10% on square, -8% on portrait cards):  replaces HoverMask 1.1.0 (spinning SVG). Project card hover shows the
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
 *  - SocialSlider 1.5.0: Case Study Slider component (Social Cards and/or Media Cards). Arrows split apart when pressed
 *    and glow in the direction you slide.
 *  - TouchGlass 1.0.0: touch devices: glass button rims parked top-left, inner glow hidden (no stray highlight).
 *  - PlayBounce 1.0.0: big play button in the Full Video Player springs back with more bounce when the cursor leaves.
 *  - MailMagnet 1.2.0: Mail CTA email is pulled towards the cursor (flat, subtle horizontally, clamped to the window), springs back.
 *  - SliderDrag 1.0.0: all sliders. Trackpad drags the slider (settles on the nearest card, no page scroll while swiping). Auto scroll from the variant: Off / Slow (2) / Fast (4 = homepage).
 *  - MediaPoster 1.2.0 (also the Full Video Player: thumbnail + video 2px bigger per side, video hidden until first play): hides the image under a video loop once the video plays (no 1px edge). Same Splide setup as CaseSlider (loop, autoWidth, speed 1000) and the
 *    same slider:ready event, so SliderMotion (trackpad, auto scroll) and SliderFX (reveal, parallax) run on it too.
 *    Own module because CaseSlider removes slides that link to the current page (the play button is href="#").
 *  - SocialCard 1.3.0 (pause mutes and keeps looping; other videos in the slider ease to a stop while one plays): Social Card component. CaseMedia plays the muted loop; Play restarts it with sound and mutes
 *    the other cards, press again to pause. Out of view or on a page change it mutes again.
 *  - CardPress 1.3.0 (dragging cancels the press, no spring): project cards (grid and slider) scale to 99% as a whole (image + info) zoom out a little while pressed and spring back on release.
 */
(() => {
  window.App = window.App || { inits: [], destroys: [] };

  /* ---------- EmblemMask ---------- */
  // Matte: white emblem on black, square, H.264 MP4. Must be served with CORS (jsDelivr does).
  // Override per site without a release: put data-emblem-matte="https://..." on any element (e.g. the project card).
  const EMBLEM = {
    matte: 'https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@96954ed645564c3cd53c1209ccc2e21bef11c79b/projects/paloma/assets/emblem-matte.mp4',
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
      el.innerHTML = '<div class="case-header_tag-list">' + list.map(tagHtml).join('') + '</div>';
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
    st.textContent = '.case-header_tag-list .nav_button{display:inline-flex;align-items:center;height:1.75rem;padding-top:0;padding-bottom:0;cursor:default}';
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
    el.innerHTML = '<div class="case-header_tag-list">' + list.map(tag).join('') + '</div>';
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
  const videoOf = (card) => card.querySelector('video');
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
      if (v._held) return; v._held = true; gsap.killTweensOf(v);
      gsap.to(v, { playbackRate: 0.1, duration: 1.6, delay: 0.8, ease: 'power2.in', onComplete: () => { v.pause(); v.playbackRate = 1; } });
    });
  };
  const release = (card) => {
    const sl = card.closest('[data-social-slider]');
    if (!sl || !window.gsap || sl.querySelector('[data-social-card].is-sound')) return;
    sl.querySelectorAll('video').forEach((v) => {
      if (!v._held) return; v._held = false; gsap.killTweensOf(v);
      if (v.paused) { v.playbackRate = 0.1; play(v); }
      gsap.to(v, { playbackRate: 1, duration: 1.2, ease: 'power2.out' });
    });
  };
  const mute = (card) => { const v = videoOf(card); if (v) v.muted = true; setUi(card, false); release(card); };

  const start = (card) => {
    const v = videoOf(card);
    if (!v) { // HLS still attaching: wait for CaseMedia to add the video, then start
      if (card._wait) return;
      card._wait = new MutationObserver(() => { if (videoOf(card)) { card._wait.disconnect(); card._wait = null; start(card); } });
      card._wait.observe(card, { childList: true, subtree: true });
      return;
    }
    document.querySelectorAll(CARD + '.is-sound').forEach((c) => c !== card && mute(c));
    if (!card._heard) { card._heard = true; v.currentTime = 0; } // first play starts at the beginning
    if (v._held) { v._held = false; gsap.killTweensOf(v); v.playbackRate = 1; }
    v.muted = false; v.loop = true;
    play(v); setUi(card, true); hold(card);
  };
  // Pause = sound off: the video keeps looping muted, like the other cards
  const stop = (card) => { const v = videoOf(card); if (v) { v.muted = true; if (v.paused) play(v); } setUi(card, false); release(card); };

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-social-play]');
    if (!b) return;
    e.preventDefault();
    const card = b.closest(CARD);
    if (card) card.classList.contains('is-sound') ? stop(card) : start(card);
  });

  const init = (scope = document) => {
    const cards = (scope || document).querySelectorAll(CARD);
    if (!cards.length) return;
    if (!io) io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { const v = videoOf(en.target); if (v && v.paused && !v._held && !en.target.classList.contains('is-sound')) play(v); }
      else if (en.target.classList.contains('is-sound')) mute(en.target);
    }));
    cards.forEach((c) => io.observe(c));
  };
  App.inits.push(init);
  App.destroys.push(() => {
    document.querySelectorAll(CARD).forEach((c) => { if (c._wait) { c._wait.disconnect(); c._wait = null; } mute(c); });
    if (io) { io.disconnect(); io = null; }
  });
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
      const sp = new Splide(root, {
        type: 'loop', autoWidth: true, gap: '1.5625rem', focus: 0, arrows: false, pagination: false, speed: 1000,
        padding: { left: '1.25rem', right: 0 },
      });
      sp.on('mounted', () => {
        // Loop clones copy the DOM: drop videos CaseMedia already attached, the inits below give them their own
        root.querySelectorAll('.splide__slide--clone video').forEach((v) => v.remove());
        App.inits.forEach((fn) => { if (fn !== init) try { fn(root); } catch (_) {} });
        window.lenis && lenis.resize();
      });
      sp.mount();
      root._sp = sp; live.add(root);
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
      // Auto scroll comes from the component variant (Off / Slow / Fast); SliderMotion reads data-autoscroll
      // Fast = 4 (80px a second, same as the homepage slider), Slow = 2 (40px a second)
      const VAR = /^data-wf--.*slider.*--variant$/; // only this slider's own variant, not e.g. Page Theme
      let variant = '';
      for (let el = root; el && el !== document.body && !variant; el = el.parentElement) {
        const at = [...el.attributes].find((x) => VAR.test(x.name)); if (at) variant = at.value;
      }
      root.setAttribute('data-autoscroll', /fast/.test(variant) ? '4' : /slow/.test(variant) ? '2' : '0');
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
      e.preventDefault(); e.stopPropagation();
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

/* ---------- TouchGlass ---------- */
// Touch devices: the glass button script only positions the rim highlights and inner glow while a mouse hovers,
// so on a phone they sat at their unpositioned CSS spot (a stray round highlight inside the button). Here: rims
// parked at the resting angle (top-left, same as on desktop when not hovered), inner glow hidden.
(() => {
  window.App = window.App || { inits: [], destroys: [] };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (!document.getElementById('paloma-touchglass-css')) {
    const st = document.createElement('style'); st.id = 'paloma-touchglass-css';
    st.textContent = '[data-glow-button] [data-glow-layer],[data-glow-button] .nav_button-glow{display:none}';
    document.head.appendChild(st);
  }
  const REST = -135;
  const edge = (w, h, deg, circle) => {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    if (circle) return { x: w / 2 + c * (w / 2), y: h / 2 + s * (h / 2) };
    const k = Math.min(Math.abs(c) > 1e-6 ? (w / 2) / Math.abs(c) : Infinity, Math.abs(s) > 1e-6 ? (h / 2) / Math.abs(s) : Infinity);
    return { x: w / 2 + c * k, y: h / 2 + s * k };
  };
  const place = (btn) => {
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h || !window.gsap) return;
    const circle = btn.dataset.glowShape === 'circle';
    btn.querySelectorAll('[data-rim]').forEach((r) => {
      const p = edge(w, h, REST + (parseFloat(r.dataset.rim) || 0), circle);
      gsap.set(r, { left: 0, top: 0, xPercent: -50, yPercent: -50, x: p.x, y: p.y });
    });
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((e) => place(e.target))) : null;
  const init = (scope = document) => (scope || document).querySelectorAll('[data-glow-button]').forEach((b) => {
    place(b);
    if (ro && !b._tg) { b._tg = true; ro.observe(b); }
  });
  App.inits.push(init);
  // Tags and service tags are added later by other modules: catch those too
  const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.matches && n.matches('[data-glow-button]')) init(n.parentNode); else if (n.querySelector && n.querySelector('[data-glow-button]')) init(n);
  })));
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') init(document);
})();
