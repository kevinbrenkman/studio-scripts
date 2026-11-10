/*!
 * drawer.js 1.0.0 (kevinbrenkman/studio-scripts/core)
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
 * State: html.is-drawer-open. Lenis stops while open. Works with core.js (Swup) and without it.
 */
(() => {
  if (window.__studioDrawer) return; window.__studioDrawer = '1.0.0';
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
      // Closed (only with the script running: in the Designer the drawer stays visible)
      'html:not(.is-drawer-open) [data-drawer]{visibility:hidden;pointer-events:none;transition:visibility 0s linear ' + DUR + 'ms}' +
      '[data-drawer]>[data-drawer-close]{transition:opacity .35s ease}' +
      'html:not(.is-drawer-open) [data-drawer]>[data-drawer-close]{opacity:0}' +
      '[data-drawer-panel]{transition:transform ' + DUR + 'ms cubic-bezier(.2,.9,.25,1)}' +
      'html:not(.is-drawer-open) [data-drawer-panel]{transform:translateX(calc(100% + 2.5em))}' +
      '@media (max-width:767px){html:not(.is-drawer-open) [data-drawer-panel]{transform:translateY(calc(100% + 2em))}}' +
      'html.is-drawer-instant [data-drawer],html.is-drawer-instant [data-drawer] *{transition:none!important}' +
      'html.is-drawer-open{overflow:hidden}' +
      '@media (hover:hover){[data-drawer-panel] [data-drawer-close]:hover{transform:rotate(90deg)}}' +
      '[data-drawer-ticket][hidden]{display:none!important}';
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

  const tidy = (d) => {
    const t = d.querySelector('[data-drawer-ticket]') || d.querySelector('[data-drawer-panel] a[href]:not([data-drawer-close])');
    if (t) { const h = t.getAttribute('href'); if (!h || h === '#') t.hidden = true; }
    const p = d.querySelector('[data-drawer-panel]'); if (p) p.setAttribute('data-lenis-prevent', '');
  };

  const open = (instant) => {
    if (!drawer) return;
    tidy(drawer);
    if (instant) html.classList.add('is-drawer-instant');
    void drawer.offsetWidth; // let the closed state paint first, so it slides in
    requestAnimationFrame(() => {
      html.classList.add('is-drawer-open');
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
    place(document.importNode(d, true));
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
