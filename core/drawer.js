/*!
 * drawer.js 1.5.0 (kevinbrenkman/studio-scripts/core)
 * Side panel with its own URL, filled from a CMS template page. Ported from the Shelter prototype (Onkruid).
 *
 * How it works
 *   - The CMS template page holds the drawer, bound to the CMS. Opened directly (/radar/slug), the drawer shows
 *     at once and the homepage loads in behind it (its #swup content is fetched), so the home is edited in one place.
 *   - On the homepage a click on [data-drawer-link] fetches that template page, takes its [data-drawer],
 *     slides it in and pushes the URL. Close, Escape, a click next to it or Back closes it again.
 *
 * Markup
 *   [data-drawer]                       wrapper (fixed, full screen)
 *     [data-drawer-close]               scrim (any element with this closes)
 *     [data-drawer-panel]               the panel (scrolls on its own)
 *       [data-drawer-close]             close button
 *       [data-drawer-ticket]            optional: hidden when its link is empty
 *   a[data-drawer-link="slug"]          a card. Value: a slug (joined to the base) or a full path
 *   Base: data-drawer-base on an ancestor, or CORE_CONFIG.DRAWER_BASE (e.g. '/radar/')
 *   Home: data-drawer-home on the drawer, or CORE_CONFIG.DRAWER_HOME, default '/'
 *
 * Styling lives in Webflow: the script only toggles the combo class .is-open on [data-drawer], its
 * [data-drawer-panel] and its scrim ([data-drawer] > [data-drawer-close]). Style the closed state on the base
 * classes and the open state on the .is-open combos (with their transitions). Keep .is-open on in the Designer.
 * Direct entry: the homepage behind it scrolls to CORE_CONFIG.DRAWER_ANCHOR ('#radar'), minus DRAWER_OFFSET (em).
 * State: html.is-drawer-open. Scroll lock: mouse devices stop Lenis + overflow hidden; touch devices block touch
 *   scrolling outside the panel, and inside it at its top or bottom (else iOS hands the swipe to the page). No root
 *   overflow change (iOS Safari: that turns its toolbars into solid bars).
 * Touch devices: the open drawer is not position:fixed but absolute, pinned at the current scroll position (the page
 *   cannot scroll meanwhile). iOS Safari 26 tints its toolbars after fixed layers; with an absolute layer it keeps its
 *   see-through toolbars. The touchmove lock is only attached while the drawer is open (a permanent non-passive
 *   touchmove listener makes all scrolling on iOS wait for JS).
 *   The scrim is stretched 25vh past the top and bottom, so the page under Safari's see-through bars is dimmed too.
 * Closed: once it has slid out the drawer gets display:none (inline, live only). iOS Safari 26 tints its toolbars
 *   from fixed elements on screen, so a closed drawer left in place kept the bars in the drawer colour.
 * Focus: the close button gets focus (and the card gets it back) only for keyboard users, so no ring after a tap.
 * Works with core.js (Swup) and without it.
 */
(() => {
  if (window.__studioDrawer) return; window.__studioDrawer = '1.5.0';
  window.App = window.App || { inits: [], destroys: [] };
  const CFG = window.CORE_CONFIG || {};
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = RM ? 0 : 550;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches; // mouse: Lenis + overflow lock; touch: touchmove lock
  let kbd = false; // last input was the keyboard
  addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') kbd = true; }, true);
  addEventListener('pointerdown', () => { kbd = false; }, true);
  const cache = new Map();

  if (!document.getElementById('studio-drawer-css')) {
    const st = document.createElement('style');
    st.id = 'studio-drawer-css';
    st.textContent =
      // Only behaviour here; every visual state is a Webflow class (.is-open combos)
      'html.is-drawer-instant [data-drawer],html.is-drawer-instant [data-drawer] *{transition:none!important}' +
      '@media (hover:hover) and (pointer:fine){html.is-drawer-open{overflow:hidden}}' +
      '[data-drawer-panel]:focus{outline:none}';
    document.head.appendChild(st);
  }

  const base = (el) => (el.closest('[data-drawer-base]') || {}).dataset?.drawerBase || CFG.DRAWER_BASE || '';
  const urlFor = (link) => {
    const v = link.getAttribute('data-drawer-link') || '';
    if (!v) return link.href;
    return new URL(v.startsWith('/') || /^https?:/.test(v) ? v : base(link).replace(/\/?$/, '/') + v, location.origin).href;
  };
  const homeUrl = (d) => new URL((d && d.getAttribute('data-drawer-home')) || CFG.DRAWER_HOME || '/', location.origin).href;

  const fetchDoc = (url) => {
    if (!cache.has(url)) {
      cache.set(url, fetch(url, { credentials: 'same-origin' })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((t) => new DOMParser().parseFromString(t, 'text/html'))
        .catch((e) => { cache.delete(url); throw e; }));
    }
    return cache.get(url);
  };

  let drawer = null, returnFocus = null, pushed = false, homeTitle = document.title;

  const parts = (d) => [d, ...d.querySelectorAll('[data-drawer-panel]'), ...[...d.children].filter((c) => c.matches('[data-drawer-close],[data-drawer-scrim]'))];
  const setOpen = (d, on) => {
    parts(d).forEach((el) => el.classList.toggle('is-open', on));
    const p = d.querySelector('[data-drawer-panel]');
    if (p) { p.setAttribute('data-lenis-prevent', ''); if (on) p.removeAttribute('inert'); else p.setAttribute('inert', ''); }
  };
  const tidy = () => {};
  let parkT = 0;
  // Touch: pin the drawer as an absolute layer at the scroll position instead of a fixed one (see the header)
  // innerHeight stops above Safari's floating toolbar, so the scrim is stretched past both edges: the page that shows
  // through the see-through bars is dimmed too (one tone instead of a light strip under the bar)
  const scrimOf = (d) => d && d.querySelector(':scope > [data-drawer-close]');
  const pin = (d) => {
    if (FINE || !d) return;
    Object.assign(d.style, { position: 'absolute', top: scrollY + 'px', bottom: 'auto', height: innerHeight + 'px' });
    const s = scrimOf(d); if (s) Object.assign(s.style, { top: '-25vh', bottom: '-25vh' });
  };
  const unpin = (d) => {
    if (!d) return;
    ['position', 'top', 'bottom', 'height'].forEach((k) => d.style.removeProperty(k));
    const s = scrimOf(d); if (s) ['top', 'bottom'].forEach((k) => s.style.removeProperty(k));
  };
  // Touch lock: no page scroll while open. Inside the panel a swipe only goes through while the panel itself can still
  // scroll that way; at its top or bottom (or when it all fits) iOS would otherwise hand the swipe to the page
  let touchY = 0;
  const touchStart = (e) => { touchY = e.touches[0] ? e.touches[0].clientY : 0; };
  const blockTouch = (e) => {
    const p = e.target.closest && e.target.closest('[data-drawer-panel]');
    if (p && e.touches.length === 1) {
      const dy = e.touches[0].clientY - touchY;
      const top = p.scrollTop <= 0, end = p.scrollTop + p.clientHeight >= p.scrollHeight - 1;
      if (!((dy > 0 && top) || (dy < 0 && end))) return; // the panel scrolls itself
    }
    if (e.cancelable) e.preventDefault();
  };
  const touchLock = (on) => {
    if (FINE) return;
    if (on) { document.addEventListener('touchstart', touchStart, { passive: true }); document.addEventListener('touchmove', blockTouch, { passive: false }); }
    else { document.removeEventListener('touchstart', touchStart); document.removeEventListener('touchmove', blockTouch); }
  };
  const park = (d) => { clearTimeout(parkT); touchLock(false); parkT = setTimeout(() => { if (d && !d.classList.contains('is-open')) { d.style.display = 'none'; unpin(d); } }, DUR + 60); };
  const unpark = (d) => { clearTimeout(parkT); if (d) { d.style.removeProperty('display'); pin(d); } touchLock(true); };

  const open = (instant) => {
    if (!drawer) return;
    tidy(drawer); unpark(drawer);
    if (instant) html.classList.add('is-drawer-instant');
    void drawer.offsetWidth; // let the closed state paint first, so it slides in
    requestAnimationFrame(() => {
      html.classList.add('is-drawer-open');
      setOpen(drawer, true);
      const panel = drawer.querySelector('[data-drawer-panel]'); if (panel) panel.scrollTop = 0;
      // Keyboard: focus the close button. Touch/mouse: focus the panel itself (screen readers land in it, no ring)
      const btn = drawer.querySelector('[data-drawer-panel] [data-drawer-close]');
      if (kbd && btn) btn.focus({ preventScroll: true });
      else if (panel) { if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1'); panel.focus({ preventScroll: true }); }
      if (window.lenis && FINE) lenis.stop();
      if (instant) requestAnimationFrame(() => html.classList.remove('is-drawer-instant'));
    });
  };
  const close = (fromPop) => {
    if (!html.classList.contains('is-drawer-open')) return;
    html.classList.remove('is-drawer-open');
    if (drawer) { setOpen(drawer, false); park(drawer); }
    if (window.lenis) lenis.start();
    if (returnFocus && returnFocus.isConnected && kbd) returnFocus.focus({ preventScroll: true });
    else if (document.activeElement && drawer && drawer.contains(document.activeElement)) document.activeElement.blur();
    returnFocus = null;
    document.title = homeTitle;
    if (fromPop) return;
    if (pushed) { pushed = false; goingBack(); history.back(); }                      // opened from the home: go back
    else history.replaceState({ source: 'drawer', home: true }, '', homeUrl(drawer)); // opened directly: become the home
  };

  // history.back() lands a moment later (popstate). A card tapped in that moment would be closed again by that popstate,
  // or its new entry popped: wait for the back to land first, then open
  let backDone = null, backing = null;
  const goingBack = () => {
    backing = new Promise((res) => { backDone = () => { backDone = null; backing = null; res(); }; });
    setTimeout(() => backDone && backDone(), 500); // safety: a back that never fires
  };
  const place = (fresh) => {
    if (drawer && drawer !== fresh) drawer.replaceWith(fresh); else if (!drawer) document.body.appendChild(fresh);
    drawer = fresh;
  };

  const show = (url, opts = {}) => (backing && opts.push !== false ? backing.then(() => show(url, opts)) : showNow(url, opts));
  const showNow = (url, { push = true, from = null } = {}) => fetchDoc(url).then((doc) => {
    const d = doc.querySelector('[data-drawer]'); if (!d) { location.href = url; return; }
    const wasOpen = html.classList.contains('is-drawer-open');
    const fresh = document.importNode(d, true);
    setOpen(fresh, wasOpen); // the template page has .is-open on (Designer): start closed so it slides in
    place(fresh);
    returnFocus = from || returnFocus;
    if (push) {
      // Mark the current entry as ours too, so Back lands here without Swup reloading the page
      if (!pushed && !wasOpen) history.replaceState(Object.assign({}, history.state, { source: 'drawer', home: true }), '', location.href);
      history.pushState({ source: 'drawer', drawer: url }, '', url); pushed = true;
    }
    document.title = doc.title || document.title;
    open(wasOpen);
  }).catch(() => { location.href = url; });

  // Direct entry on a template page: drawer at once, the home loads in behind it
  const loadHome = () => {
    const target = document.querySelector('#swup');
    if (!target || target.children.length) return;
    fetchDoc(homeUrl(drawer)).then((doc) => {
      const src = doc.querySelector('#swup'); if (!src) return;
      homeTitle = doc.title || homeTitle;
      target.innerHTML = src.innerHTML;
      App.inits.forEach((fn) => { try { fn(target); } catch (e) { console.warn('[drawer]', e); } });
      // Put the homepage behind it at the spot the drawer belongs to (the Radar), as in the design
      const sel = (drawer && drawer.getAttribute('data-drawer-anchor')) || CFG.DRAWER_ANCHOR;
      const anchor = sel && document.querySelector(sel);
      if (anchor) {
        // Lenis caches the page height (the template page was short), so resize first; images that load
        // later move the anchor, so settle again while the drawer is still open (the page can't scroll then)
        const go = () => {
          if (!anchor.isConnected || !html.classList.contains('is-drawer-open')) return;
          const fs = parseFloat(getComputedStyle(document.body).fontSize) || 16;
          const y = Math.max(0, anchor.getBoundingClientRect().top + scrollY - (parseFloat(CFG.DRAWER_OFFSET) || 0) * fs);
          if (window.lenis) { lenis.resize(); lenis.start(); lenis.scrollTo(y, { immediate: true, force: true }); if (FINE) lenis.stop(); }
          else scrollTo(0, y);
          if (!FINE && drawer) drawer.style.top = scrollY + 'px'; // touch: keep the pinned drawer on screen
        };
        requestAnimationFrame(go);
        [250, 800, 1600].forEach((t) => setTimeout(go, t));
        if (document.readyState !== 'complete') addEventListener('load', go, { once: true });
        target.querySelectorAll('img').forEach((im) => { if (!im.complete) im.addEventListener('load', go, { once: true }); });
      }
      if (window.Webflow && Webflow.require) { try { Webflow.require('ix2') && Webflow.require('ix2').init(); } catch (e) {} }
    }).catch((e) => console.warn('[drawer] home did not load', e));
  };

  // Events (once, on the document: survive Swup swaps)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-drawer-link]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      if (link.closest('.is-dragging, [data-slider-dragged]')) { e.preventDefault(); e.stopImmediatePropagation(); return; } // end of a slider drag, not a click
      e.preventDefault(); e.stopImmediatePropagation();
      show(urlFor(link), { from: link });
      return;
    }
    if (e.target.closest('[data-drawer-close]') && drawer && drawer.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  const prefetch = (e) => {
    const link = e.target.closest && e.target.closest('[data-drawer-link]');
    if (link) fetchDoc(urlFor(link)).catch(() => {});
  };
  document.addEventListener('pointerenter', prefetch, true);                           // prefetch on hover
  document.addEventListener('touchstart', prefetch, { passive: true, capture: true }); // and on the finger going down
  // Phones: fetch the cards that come near the screen in idle time, so a tap opens at once (no wait, no second tap)
  const near = !FINE && 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return; near.unobserve(en.target);
    (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => fetchDoc(urlFor(en.target)).catch(() => {}));
  }), { rootMargin: '400px 0px' }) : null;
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('popstate', (e) => {
    if (backDone) { backDone(); return; } // our own close
    const st = e.state;
    if (st && st.source === 'drawer' && st.drawer) { pushed = false; show(st.drawer, { push: false }); }
    else if (html.classList.contains('is-drawer-open')) { pushed = false; close(true); }
  });

  const init = (scope = document) => {
    if (near) (scope || document).querySelectorAll('[data-drawer-link]').forEach((l) => near.observe(l));
    const d = document.querySelector('[data-drawer]');
    if (d && !drawer) {
      drawer = d;
      if (location.href !== homeUrl(d)) { history.replaceState({ source: 'drawer', drawer: location.href }, '', location.href); open(true); loadHome(); }
    }
  };
  const destroy = () => { if (drawer) { html.classList.remove('is-drawer-open'); if (window.lenis) lenis.start(); drawer.remove(); drawer = null; } };

  if (App.register) App.register('Drawer', init, destroy);
  else {
    App.inits.push(init); App.destroys.push(destroy);
    if (!window.Swup) document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => init()) : init();
  }
})();
