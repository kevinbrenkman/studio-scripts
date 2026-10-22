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
 *  - Jobs 1.1.0: Careers page (CMS > Jobs). Tags load from the Jobs template page (CMS > Job Types), like CaseTags;
 *    rows with a Description open and close, empty Apply link falls back to hello@wearepaloma.be.
 *    Footer [data-jobs-count] shows the number of open jobs on every page (read from /careers once).
 *  - SliderFX 1.1.0: Case Slider cards fade up in a stagger once, when the slider first comes into view.
 *    Perspective: cards sink towards the screen edges (arc), plus extra vertical parallax from the slider speed. Hooks into CaseSlider's slider:ready event.
 *  - CardPress 1.0.1: project cards (grid and slider) zoom out a little while pressed and spring back on release.
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
    const set = (v) => {
      open = v; item.classList.toggle('is-open', v); row.setAttribute('aria-expanded', String(v));
      const g = window.gsap;
      if (g) {
        g.killTweensOf(detail);
        if (v) g.fromTo(detail, { height: detail.offsetHeight }, { height: 'auto', duration: 0.6, ease: 'power3.inOut', onComplete: resize });
        else g.to(detail, { height: 0, duration: 0.5, ease: 'power3.inOut', onComplete: resize });
      } else { detail.style.height = v ? 'auto' : '0px'; resize(); }
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
  const fill = (n) => document.querySelectorAll('[data-jobs-count]').forEach((el) => { el.textContent = n > 0 ? String(n) : ''; });

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
    stagger: 0.08,  // s between cards
    duration: 1,    // s per card
    para: 0.035,    // speed parallax: px of vertical offset per px/s of slider speed, at the edges
    max: 36,        // px, speed parallax clamp
    arc: 48,        // px, perspective: cards sink this much at the screen edges, centre stays up. Always on, also at slow speed
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

    /* Parallax: speed of the list drives a vertical offset, edges move most, centre stays put */
    let tick = null;
    if (!RM) {
      const Move = sp.Components.Move;
      let last = Move.getPosition(), v = 0, cur = 0;
      const setters = new Map();
      const setY = (el) => { if (!setters.has(el)) setters.set(el, g.quickSetter(el, 'y', 'px')); return setters.get(el); };
      let inView = true;
      const vio = new IntersectionObserver((e) => { inView = e[0].isIntersecting; });
      vio.observe(root);
      tick = (t, dt) => {
        if (!inView || !dt) return;
        const pos = Move.getPosition();
        let d = pos - last; last = pos;
        if (Math.abs(d) > innerWidth) d = 0; // loop jump, not real movement
        const speed = (d / dt) * 1000; // px/s, negative = moving left
        v += (speed - v) * Math.min(1, dt / 120);
        cur += (v - cur) * Math.min(1, dt / 200);
        const w = innerWidth;
        cards().forEach((c) => {
          const r = c.getBoundingClientRect();
          if (r.right < -w * 0.2 || r.left > w * 1.2) return;
          const p = ((r.left + r.width / 2) / w) * 2 - 1; // -1 left edge, 0 centre, 1 right edge
          const speedY = Math.max(-FX.max, Math.min(FX.max, cur * FX.para * p));
          const arcY = FX.arc * Math.min(1, p * p); // curved surface, like the row bends away from you
          setY(c)(arcY + speedY);
        });
      };
      g.ticker.add(tick);
      root._fxStop = () => { vio.disconnect(); };
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
  const SCALE = 0.96;
  let pressed = null;
  const target = (el) => el && el.closest && el.closest('.project-card, .case-slider_slide'); // grid cards and slider cards
  const media = (card) => card.querySelector('.project-card_media') || card;
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
