/*!
 * drawer.js 1.1.1 (kevinbrenkman/studio-scripts/core)
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
 * State: html.is-drawer-open (scroll lock). Lenis stops while open. Works with core.js (Swup) and without it.
 */
(() => {
  if (window.__studioDrawer) return; window.__studioDrawer = '1.1.1';
  window.App = window.App || { inits: [], destroys: [] };
  const CFG = window.CORE_CONFIG || {};
  const html = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = RM ? 0 : 550;
  const cache = new Map();

  if (!document.getElementById('studio-drawer-css')) {
    const st = document.createElement('style');
    st.id = 'studio-drawer-css';
    st.textContent =
      // Only behaviour here; every visual state is a Webflow class (.is-open combos)
      'html.is-drawer-instant [data-drawer],html.is-drawer-instant [data-drawer] *{transition:none!important}' +
      'html.is-drawer-open{overflow:hidden}';
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

  const open = (instant) => {
    if (!drawer) return;
    tidy(drawer);
    if (instant) html.classList.add('is-drawer-instant');
    void drawer.offsetWidth; // let the closed state paint first, so it slides in
    requestAnimationFrame(() => {
      html.classList.add('is-drawer-open');
      setOpen(drawer, true);
      const panel = drawer.querySelector('[data-drawer-panel]'); if (panel) panel.scrollTop = 0;
      const btn = drawer.querySelector('[data-drawer-panel] [data-drawer-close]');
      if (btn) btn.focus({ preventScroll: true });
      if (window.lenis) lenis.stop();
      if (instant) requestAnimationFrame(() => html.classList.remove('is-drawer-instant'));
    });
  };
  const close = (fromPop) => {
    if (!html.classList.contains('is-drawer-open')) return;
    html.classList.remove('is-drawer-open');
    if (drawer) setOpen(drawer, false);
    if (window.lenis) lenis.start();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    document.title = homeTitle;
    if (fromPop) return;
    if (pushed) { pushed = false; history.back(); }                                   // opened from the home: go back
    else history.replaceState({ source: 'drawer', home: true }, '', homeUrl(drawer)); // opened directly: become the home
  };

  const place = (fresh) => {
    if (drawer && drawer !== fresh) drawer.replaceWith(fresh); else if (!drawer) document.body.appendChild(fresh);
    drawer = fresh;
  };

  const show = (url, { push = true, from = null } = {}) => fetchDoc(url).then((doc) => {
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
          if (window.lenis) { lenis.resize(); lenis.start(); lenis.scrollTo(y, { immediate: true, force: true }); lenis.stop(); }
          else scrollTo(0, y);
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
      if (link.closest('.is-dragging, [data-slider-dragged]')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      show(urlFor(link), { from: link });
      return;
    }
    if (e.target.closest('[data-drawer-close]') && drawer && drawer.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  document.addEventListener('pointerenter', (e) => {
    const link = e.target.closest && e.target.closest('[data-drawer-link]');
    if (link) fetchDoc(urlFor(link)).catch(() => {});                                  // prefetch on hover
  }, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('popstate', (e) => {
    const st = e.state;
    if (st && st.source === 'drawer' && st.drawer) { pushed = false; show(st.drawer, { push: false }); }
    else if (html.classList.contains('is-drawer-open')) { pushed = false; close(true); }
  });

  const init = () => {
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
