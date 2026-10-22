/*!
 * paloma.js: Paloma site bundle (kevinbrenkman/studio-scripts)
 * Load a tagged version only: cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@vX.Y.Z/projects/paloma/paloma.js
 * Registers into the Swup shell registry (App.inits / App.destroys) from the site footer.
 *
 * Modules
 *  - EmblemMask 2.0.0: replaces HoverMask 1.1.0 (spinning SVG). Project card hover shows the
 *    thumbnail inside the spinning 3D emblem (alpha video, Quy). Canvas: video alpha masks the thumbnail.
 */
(() => {
  window.App = window.App || { inits: [], destroys: [] };

  /* ---------- EmblemMask ---------- */
  // Swap to Paloma's own Bunny pull zone before launch. Never Bunny Stream: it re-encodes and drops the alpha.
  const EMBLEM = {
    hevc: 'https://kevin-brenkman.b-cdn.net/paloma%20temp/paloma-emblem-square-prores-1.mov', // Safari / iOS (HEVC with alpha)
    webm: 'https://kevin-brenkman.b-cdn.net/paloma%20temp/paloma-emblem.webm',               // everyone else (VP9 alpha)
    size: 0.55,    // emblem width as a share of the card width (same as HoverMask)
    fill: 0.975,   // share of the video frame the emblem fills (square crop)
  };

  const isApple = () => {
    const u = navigator.userAgent;
    return /iP(hone|ad|od)/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ||
      (/Safari/.test(u) && !/Chrome|Chromium|Edg|OPR|Firefox|Android/.test(u));
  };
  const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;

  // One shared video for every card: only one card is hovered at a time.
  // No crossOrigin on purpose: Bunny sends no CORS headers for video, and drawing to a visible canvas doesn't need them.
  let video = null;
  const getVideo = () => {
    if (video) return video;
    video = document.createElement('video');
    video.muted = video.loop = video.playsInline = true;
    ['muted', 'loop', 'playsinline'].forEach((a) => video.setAttribute(a, ''));
    video.preload = 'auto';
    video.src = isApple() ? EMBLEM.hevc : EMBLEM.webm;
    video.load();
    return video;
  };

  const live = new Set();

  const setup = (card) => {
    if (card._emblem) return;
    const media = card.querySelector('.project-card_media');
    const thumb = media && media.querySelector('img');
    if (!thumb) return;

    let cv = null, ctx = null, pic = null, raf = 0, on = false;

    // Thumbnail drawn once per size into its own canvas (object-fit: cover)
    const paint = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(media.offsetWidth * d), h = Math.round(media.offsetHeight * d);
      cv.width = w; cv.height = h;
      pic = document.createElement('canvas'); pic.width = w; pic.height = h;
      const iw = thumb.naturalWidth, ih = thumb.naturalHeight;
      if (!iw) return;
      const s = Math.max(w / iw, h / ih);
      pic.getContext('2d').drawImage(thumb, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
    };

    const frame = () => {
      if (!on) return;
      const v = video;
      if (v.readyState >= 2 && pic) {
        const w = cv.width, h = cv.height, s = (EMBLEM.size * w) / EMBLEM.fill;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(v, (w - s) / 2, (h - s) / 2, s, s);
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(pic, 0, 0);
      }
      raf = requestAnimationFrame(frame);
    };

    const enter = () => {
      const v = getVideo();
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'hover-mask';
        cv.setAttribute('aria-hidden', 'true');
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
        ctx = cv.getContext('2d');
      }
      paint();
      media.appendChild(cv); // appended last, so it sits above HoverFlip's stack
      on = true;
      try { v.currentTime = 0; } catch (_) {}
      const p = v.play(); p && p.catch && p.catch(() => {});
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    };

    const leave = () => {
      on = false; cancelAnimationFrame(raf);
      if (video) video.pause();
      if (cv) { ctx.clearRect(0, 0, cv.width, cv.height); cv.remove(); }
    };

    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card._emblem = () => {
      leave();
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      cv = ctx = pic = null;
      delete card._emblem;
    };
    live.add(card);
  };

  const initEmblem = (scope = document) => {
    if (!fine()) return;
    const cards = (scope || document).querySelectorAll('.project-card');
    if (!cards.length) return;
    cards.forEach(setup);
    // Warm the video once the page has settled, so the first hover is instant
    const warm = () => (window.requestIdleCallback ? requestIdleCallback(getVideo, { timeout: 2000 }) : setTimeout(getVideo, 500));
    document.readyState === 'complete' ? warm() : addEventListener('load', warm, { once: true });
  };

  App.inits.push(initEmblem);
  // If this file arrives after the shell's first run (async load), init the first page ourselves. setup() is idempotent.
  if (document.readyState !== 'loading') initEmblem(document);
  App.destroys.push(() => { live.forEach((c) => c._emblem && c._emblem()); live.clear(); });
})();
