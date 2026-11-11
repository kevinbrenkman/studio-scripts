/*!
 * video-loop.js 1.0.0 (kevinbrenkman/studio-scripts/core)
 * Muted looping video over an image, no controls, no sound. Ported from Paloma's CaseMedia, simplified.
 *
 * Markup
 *   img[data-video-loop="https://…/clip.mp4"]     the image is the still frame until the video plays
 *   or any box[data-video-loop="…"] with an img inside (the video covers the box)
 *   Empty attribute = image only.
 *   URL: an MP4 (short loops), or an HLS .m3u8 playlist (e.g. Bunny Stream); hls.js loads only when needed.
 *
 * Behaviour: gets ready 300px before view, plays only while on screen, pauses when it leaves, fades in once
 * it really plays. On an img the script wraps it in a span so the video can sit on top (same size, same corners).
 * Works with marquee.js clones and Swup (App.inits / App.destroys).
 */
(() => {
  if (window.__studioVideoLoop) return; window.__studioVideoLoop = '1.0.0';
  window.App = window.App || { inits: [], destroys: [] };
  const HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = new Set();

  if (!document.getElementById('studio-video-loop-css')) {
    const st = document.createElement('style');
    st.id = 'studio-video-loop-css';
    st.textContent =
      '[data-video-loop-wrap]{position:relative;display:block;flex:none;overflow:hidden;line-height:0}' +
      '[data-video-loop-wrap]>img{display:block}' +
      'video[data-video-loop-video]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s linear;pointer-events:none}' +
      'video[data-video-loop-video].is-playing{opacity:1}';
    document.head.appendChild(st);
  }

  let hlsP = null;
  const loadHls = () => hlsP || (hlsP = new Promise((ok, no) => {
    if (window.Hls) return ok(window.Hls);
    const s = document.createElement('script'); s.src = HLS_SRC; s.onload = () => ok(window.Hls); s.onerror = no;
    document.head.appendChild(s);
  }));

  // An img can't hold a video: wrap it in a span that takes over its place in the layout
  const boxFor = (el) => {
    if (el.tagName !== 'IMG') return el;
    const p = el.parentElement;
    if (p && p.hasAttribute('data-video-loop-wrap')) return p;
    const w = document.createElement('span');
    w.setAttribute('data-video-loop-wrap', '');
    const cs = getComputedStyle(el);
    w.style.borderRadius = cs.borderRadius;
    el.replaceWith(w); w.appendChild(el);
    return w;
  };

  const setup = (el) => {
    const url = (el.getAttribute('data-video-loop') || '').trim();
    if (!url || el._vl) return;
    const box = boxFor(el);
    box.querySelectorAll('video[data-video-loop-video]').forEach((v) => v.remove()); // copied by a clone (marquee)
    let v = null, hls = null, seen = false, dead = false;

    const attach = () => {
      if (v || dead) return;
      const m3 = /\.m3u8(\?|$)/i.test(url);
      const probe = document.createElement('video');
      const native = !m3 || probe.canPlayType('application/vnd.apple.mpegurl');
      if (!native && !window.Hls) { loadHls().then(() => { if (!dead) attach(); play(); }).catch(() => {}); return; }
      v = probe;
      v.muted = v.loop = v.playsInline = true;
      ['muted', 'loop', 'playsinline'].forEach((a) => v.setAttribute(a, ''));
      v.setAttribute('aria-hidden', 'true'); v.setAttribute('data-video-loop-video', ''); v.preload = 'auto';
      v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
      if (!native && window.Hls && Hls.isSupported()) { hls = new Hls({ maxBufferLength: 10 }); hls.loadSource(url); hls.attachMedia(v); }
      else v.src = url;
      box.appendChild(v);
    };
    const play = () => { if (!v || !seen || RM) return; const p = v.play(); if (p && p.catch) p.catch(() => {}); };

    const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) attach(); }), { rootMargin: '300px' });
    const vis = new IntersectionObserver((es) => es.forEach((e) => {
      seen = e.isIntersecting;
      if (seen) { attach(); play(); } else if (v) v.pause();
    }));
    near.observe(box); vis.observe(box);

    el._vl = () => {
      dead = true; near.disconnect(); vis.disconnect();
      if (hls) try { hls.destroy(); } catch (_) {}
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
      delete el._vl; live.delete(el);
    };
    live.add(el);
  };

  const init = (scope = document) => (scope || document).querySelectorAll('[data-video-loop]').forEach(setup);
  const destroy = () => { live.forEach((el) => el._vl && el._vl()); live.clear(); };
  // marquee.js calls this after it cloned its items, so the clones get their own video
  App.videoLoop = init;

  if (App.register) App.register('VideoLoop', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
