/*!
 * paloma.js: Paloma site bundle (kevinbrenkman/studio-scripts)
 * Load a pinned version only (commit hash): cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<sha>/projects/paloma/paloma.js
 * Registers into the Swup shell registry (App.inits / App.destroys) from the site footer.
 *
 * Modules
 *  - EmblemMask 2.3.0: replaces HoverMask 1.1.0 (spinning SVG). Project card hover shows the
 *    thumbnail inside the spinning 3D emblem (Quy). WebGL: a grayscale matte video (white = emblem)
 *    is the alpha for the thumbnail. One H.264 file for every browser, because Safari drops the
 *    alpha of HEVC video when it is drawn to a canvas.
 *  - Jobs 1.2.0 (open/close uses the ReadMore motion): Careers page (CMS > Jobs). Tags load from the Jobs template page (CMS > Job Types), like CaseTags;
 *    rows with a Description open and close, empty Apply link falls back to hello@wearepaloma.be.
 *    Footer [data-jobs-count] shows the number of open jobs on every page (read from /careers once).
 *  - SliderFX 1.2.0: the cards in view slide up one by one, once, when the slider first comes into view.
 *    Depth: images are scaled up in their frame and move sideways with the card's position (horizontal parallax). Hooks into CaseSlider's slider:ready event.
 *  - GridFX 1.0.0: Selected projects grid. Cards reveal on scroll, spread apart towards the top and bottom of the
 *    screen and close up in the centre, images get a vertical parallax. Case pages: image parallax only.
 *  - ArrowLinks 1.0.0: arrow links (More about us, slider heading) scale on hover and press, arrow nudges right.
 *    Apply link: arrow nudges right. Services: the hover card image is zoomed and follows the cursor.
 *  - CardPress 1.2.0: project cards (grid and slider) scale to 99% as a whole (image + info) zoom out a little while pressed and spring back on release.
 */
(() => {
  window.App = window.App || { inits: [], destroys: [] };

  /* ---------- EmblemMask ---------- */
  // Matte: white emblem on black, square, H.264 MP4. Must be served with CORS (jsDelivr does).
  // Override per site without a release: put data-emblem-matte="https://..." on any element (e.g. the project card).
  const EMBLEM = {
    matte: 'https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@96954ed645564c3cd53c1209ccc2e21bef11c79b/projects/paloma/assets/emblem-matte.mp4',
    size: 0.7,    // emblem size as a share of the card's shortest side (width on square/tall cards, height on wide cards)
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
        const s = (EMBLEM.size * Math.min(w, h)) / EMBLEM.fill, rw = s / w, rh = s / h;
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
      if (window.gsap) gsap.from(el.querySelectorAll('[data-glow-button]'), { opacity: 0, y: 6, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
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
    if (body && !hasBody) body.style.display = 'none';
    if (!row || !detail) return;
    if (!hasBody && !apply) { item.classList.add('is-static'); return; }

    row.setAttribute('role', 'button'); row.tabIndex = 0; row.setAttribute('aria-expanded', 'false');
    let open = false;
    // Same motion as ReadMore 1.3.0: height opens (0.5s power3.inOut), then the content fades up 8px
    const inner = detail.firstElementChild || detail;
    let tl = null;
    const set = (v) => {
      open = v; item.classList.toggle('is-open', v); row.setAttribute('aria-expanded', String(v));
      const g = window.gsap;
      if (!g) { detail.style.height = v ? 'auto' : '0px'; resize(); return; }
      if (tl) tl.kill();
      tl = g.timeline({ onComplete: resize });
      if (v) {
        g.set(inner, { opacity: 0, y: 8 });
        tl.fromTo(detail, { height: detail.offsetHeight }, { height: 'auto', duration: 0.5, ease: 'power3.inOut' })
          .to(inner, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.1');
      } else {
        tl.to(inner, { opacity: 0, y: 8, duration: 0.3, ease: 'power2.in' })
          .to(detail, { height: 0, duration: 0.45, ease: 'power3.inOut' })
          .set(inner, { clearProps: 'opacity,transform' });
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
    zoom: 1.15,     // images scaled up inside their frame, room for the sideways parallax
    shift: 6,       // xPercent the image moves at the screen edges (must stay under (zoom - 1) / 2 * 100)
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

    /* Reveal: cards in view stagger up from the left, the rest are simply placed */
    let io = null;
    if (RM) root.classList.add('fx-ready');
    else {
      g.set(slides(), { autoAlpha: 0, y: FX.rise });
      root.classList.add('fx-ready');
      const reveal = () => {
        const w = innerWidth;
        const all = slides();
        const vis = all.filter((s) => { const r = s.getBoundingClientRect(); return r.right > 0 && r.left < w; })
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        g.set(all.filter((s) => !vis.includes(s)), { autoAlpha: 1, y: 0 });
        g.to(vis, { autoAlpha: 1, y: 0, duration: FX.duration, ease: 'power3.out', stagger: FX.stagger, clearProps: 'transform' });
      };
      io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); io = null; reveal(); } }, { threshold: 0.2 });
      io.observe(track || root);
    }

    /* Depth: images sit scaled up inside their frame and slide left/right with the card's position on screen.
       Position based, so it works at any speed, auto scroll included. The cards themselves never move vertically. */
    let tick = null;
    if (!RM) {
      const imgs = (c) => c._fxImgs || (c._fxImgs = [...c.querySelectorAll('.project-card_media img')]);
      const setX = new Map();
      const setter = (img) => {
        if (!setX.has(img)) { g.set(img, { scale: FX.zoom, force3D: true }); setX.set(img, g.quickSetter(img, 'xPercent')); }
        return setX.get(img);
      };
      let inView = true;
      const vio = new IntersectionObserver((e) => { inView = e[0].isIntersecting; });
      vio.observe(root);
      tick = () => {
        if (!inView) return;
        const w = innerWidth;
        cards().forEach((c) => {
          const r = c.getBoundingClientRect();
          if (r.right < -w * 0.25 || r.left > w * 1.25) return;
          const p = Math.max(-1.25, Math.min(1.25, ((r.left + r.width / 2) / w) * 2 - 1)); // -1 left edge, 1 right edge
          const x = -p * FX.shift; // image lags behind the card: moves against the travel direction
          c._fxImgs = null; // HoverFlip adds images on hover, pick them up
          imgs(c).forEach((img) => setter(img)(x));
        });
      };
      g.ticker.add(tick);
      root._fxStop = () => { vio.disconnect(); setX.forEach((_, img) => g.set(img, { clearProps: 'transform' })); };
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
    setTimeout(() => (scope || document).querySelectorAll('[data-case-slider]').forEach((r) => r.classList.add('fx-ready')), 4000);
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
    pressed = media(card);
    gsap.to(pressed, { scale: SCALE, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
  };
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
    spread: 0.09,   // share of the viewport height a card moves away at the top/bottom edge (0 in the centre)
    zoom: 1.15,     // image scale inside the frame
    shift: 6,       // yPercent the image travels at the edges (stay under (zoom - 1) / 2 * 100)
    rise: 50,       // px, reveal
  };
  let tick = null, io = null, revealed = new WeakSet();
  const stop = () => { if (tick) gsap.ticker.remove(tick); tick = null; if (io) io.disconnect(); io = null; };

  const init = (scope = document) => {
    if (!window.gsap) return;
    scope = scope || document;
    const grid = scope.querySelector('.projects-grid');
    const caseImgs = [...scope.querySelectorAll('.case-media_item img')];
    if (!grid && !caseImgs.length) return;
    stop();
    const cards = grid ? [...grid.querySelectorAll('.project-card')] : [];
    const links = cards.map((c) => c.querySelector('.project-card_link') || c);

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
    tick = () => {
      const vh = innerHeight, mid = vh / 2;
      cards.forEach((c) => {
        const cur = ys.get(c) || 0;
        const r = c.getBoundingClientRect();
        const top = r.top - cur, h = r.height;
        if (top > vh * 1.5 || top + h < -vh * 0.5) return;
        const n = Math.max(-1.5, Math.min(1.5, (top + h / 2 - mid) / mid)); // -1 top edge, 0 centre, 1 bottom edge
        const y = n * Math.abs(n) * vh * FX.spread * (small() ? 0.5 : 1);
        ys.set(c, y); q(setY, c, 'y', 'px')(y);
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
  const FULL = '.arrow-link, .case-slider_heading';
  const NUDGE = 0.3; // em the arrow moves right on hover

  const arrowOf = (a) => {
    if (a._arrow !== undefined) return a._arrow;
    let el = a.querySelector('.w-embed, svg');
    if (!el) {
      // Text arrow (Apply →): wrap the last → so it can move on its own
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      let node; while ((node = walker.nextNode())) {
        const i = node.data.lastIndexOf('→');
        if (i < 0) continue;
        const after = node.splitText(i); after.splitText(1);
        el = document.createElement('span'); el.style.display = 'inline-block';
        after.parentNode.replaceChild(el, after); el.appendChild(after); break;
      }
    }
    return (a._arrow = el || null);
  };
  const em = (a) => parseFloat(getComputedStyle(a).fontSize) || 16;

  const enter = (a) => {
    const ar = arrowOf(a);
    if (ar) gsap.to(ar, { x: em(a) * NUDGE, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    if (a.matches(FULL)) gsap.to(a, { scale: 1.03, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
  };
  const leave = (a) => {
    const ar = arrowOf(a);
    if (ar) gsap.to(ar, { x: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    if (a.matches(FULL)) gsap.to(a, { scale: 1, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };
  const SEL = FULL + ', .jobs_apply';
  document.addEventListener('pointerover', (e) => {
    if (!fine() || !window.gsap) return;
    const a = e.target.closest && e.target.closest(SEL);
    if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    if (a.matches(FULL)) gsap.set(a, { transformOrigin: 'left center' });
    enter(a);
  });
  document.addEventListener('pointerout', (e) => {
    if (!window.gsap) return;
    const a = e.target.closest && e.target.closest(SEL);
    if (!a || (e.relatedTarget && a.contains(e.relatedTarget))) return;
    leave(a);
  });
  let pressed = null;
  document.addEventListener('pointerdown', (e) => {
    const a = e.target.closest && e.target.closest(FULL);
    if (!a || !window.gsap) return;
    pressed = a; gsap.set(a, { transformOrigin: 'left center' });
    gsap.to(a, { scale: 0.97, duration: 0.25, ease: 'power3.out', overwrite: 'auto' });
  }, { passive: true });
  const up = () => {
    if (!pressed) return;
    const a = pressed; pressed = null;
    gsap.to(a, { scale: fine() && a.matches(':hover') ? 1.03 : 1, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
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
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
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
