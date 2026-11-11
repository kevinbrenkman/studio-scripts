# core.md
Studio core for Webflow builds: Swup page transitions, Lenis, GSAP, native Webflow interactions (IX3), and the module contract every other script follows.

Source: Paloma (Nov 2026), generalised. First use: Shelter.
Files: `core/core.js`, `core/ix3-reinit.js`. Shared modules in `core/` follow this contract.

---

## 1. The contract (read this first)

Every page change works like this:

```
click link
  -> old content fades out
  -> App.destroys run      (every module cleans up)
  -> #swup content swapped
  -> Webflow + IX3 reinit
  -> App.inits run(scope)  (every module sets up again, only inside the new content)
  -> new content fades in
```

Every module, in every project, follows four rules:

1. **Register, never self-start.** A module pushes an `init(scope)` into `App.inits` and a cleanup into `App.destroys`. Use `App.register(name, init, destroy)`.
2. **Query inside `scope`.** `scope.querySelectorAll(...)`, never `document.querySelectorAll(...)` for page content. Nav, footer and anything outside `#swup` is set up once, not per page.
3. **Idempotent setup.** Running `init` twice on the same element must not double up. Mark elements: `if (el._myModule) return; el._myModule = true;`
4. **Clean up everything you created.** Event listeners, observers, ScrollTriggers, Splide instances, RAF loops. GSAP tweens and ScrollTriggers created inside `App.ctx` are cleaned up for you.

If a module breaks after a page change, it broke one of these four rules.

---

## 2. Webflow setup

**Structure**
```
body
  [data-page-shell]        optional, Page Theme component, OUTSIDE #swup
  nav                      OUTSIDE #swup
  #swup                    div with ID "swup", wraps all page content
    sections...
  footer                   inside or outside, your choice (inside = swaps per page)
```

Rules:
- `#swup` must exist on **every** page with the same ID, or Swup does a full page load.
- Never put a transform (move, scale, rotate) on `#swup`. It breaks `position: fixed` children. The shell only fades opacity.
- Links that must do a full reload (external tools, Shopify, file downloads): add `data-no-swup`.

**Site settings > Custom code**

Head:
```html
<!-- core.css: hide intro elements until IX3 plays them, reduced motion, Lenis -->
<style>
  html.lenis, html.lenis body { height: auto; }
  .lenis.lenis-smooth { scroll-behavior: auto !important; }
  .lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
  .lenis.lenis-stopped { overflow: clip; }

  /* Intro: add the selectors your "Intro (first load)" interaction animates in */
  html.is-intro .nav_logo,
  html.is-intro .nav_menu-button,
  html.is-intro [data-intro] { visibility: hidden; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>

<!-- Intro on first load only (see section 5) -->
<script>
(function () {
  var h = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  h.classList.add('is-intro');
  var done = function () { h.classList.remove('is-intro'); };
  setTimeout(done, 5000);
  document.addEventListener('swup:visit:start', done, { once: true });
})();
</script>
```

Footer, **in this order** (replace `<SHA>` with the commit hash of studio-scripts you tested against):
```html
<!-- 1. GSAP: enable in Site settings > GSAP (Webflow hosts it), then: -->
<script>gsap.registerPlugin(ScrollTrigger);</script>

<!-- 2. Libraries, versions pinned -->
<script src="https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/swup@4.10.0/dist/Swup.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@swup/preload-plugin@3.2.12/dist/index.umd.js"></script>

<!-- 3. Project config (optional, only what differs from the defaults in section 3) -->
<script>window.CORE_CONFIG = { USE_THEME_TWEEN: false, NAV_BTN: '' };</script>

<!-- 4. Core -->
<script src="https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/core/core.js"></script>
<script src="https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/core/ix3-reinit.js"></script>

<!-- 5. Shared modules you need (see docs/splide.md etc.) -->
<script src="https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/core/slider.js"></script>

<!-- 6. Project bundle LAST -->
<script src="https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/projects/<project>/<project>.js"></script>
```

Always pin to a commit hash (or a tag), never `@main`. jsDelivr caches branches for up to 7 days and you lose control over what the client sees. All files on a site use the same hash.

---

## 3. core.js

Source: `core/core.js`. Do not paste it into Webflow, load it from jsDelivr (section 2). Change behaviour per project through `window.CORE_CONFIG`, never by editing the file for one client.

| Key | Default | What |
|---|---|---|
| `CONTAINER` | `'#swup'` | Swup container |
| `THEME` | `'[data-page-shell]'` | Page Theme component outside `#swup`. No-ops if absent. |
| `NAV_BTN` | `'a[data-glow-button]'` | Nav items whose colour follows the theme, or `''` |
| `TWEEN_EXTRA` | `'[data-theme-tween]'` | Other elements outside `#swup` that crossfade colour |
| `USE_THEME_TWEEN` | `true` | `false` = plain fade out / fade in |
| `FADE_OUT` / `FADE_IN` | `0.45` / `0.6` | Seconds |
| `THEME_FADE` / `NAV_FADE` | `0.9` / `0.6` | Colour crossfade, seconds |
| `THEME_PAUSE` | `0.5` | How far into the crossfade the new content starts fading in |
| `EASE` | `'power2.inOut'` | Theme ease |
| `LENIS` | `{ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true }` | Lenis options (`autoRaf` is always off, GSAP drives it) |

What it gives you:
- `App.register(name, init, destroy)` and the page lifecycle from section 1
- `App.ctx`: a `gsap.context` per page. GSAP tweens and ScrollTriggers created synchronously inside an `init` are reverted on page leave. Anything created later (after a fetch, a promise, an event) is NOT in it: clean that up in `destroy`.
- `window.lenis`, `window.swup`
- Theme crossfade between Page Theme variants
- Webflow reinit (forms, tabs, `data-wf-page`), scroll handling through Lenis, anchor links
- Reduced motion: no Lenis, instant transitions

Needed per page: the Page Theme variant (if you use themes) lives on `[data-page-shell]`, outside `#swup`. Webflow's `body:has()` rules switch the theme variables.

---

## 4. ix3-reinit.js

Source: `core/ix3-reinit.js`. Native Webflow interactions (IX3) register once on first load and die after a Swup swap. This keeps a copy of the registration and replays it after every swap. Without it, any interaction built in the Interactions panel works on the first page only.

[Pitfall] It patches Webflow internals (`ix3.getInstance`). If Webflow changes IX3, this is the first thing that breaks. Test it after every Webflow runtime update.

---

## 5. Intro on first load

Pattern: build the intro as a native interaction named **"Intro (first load)"** (page load trigger). The head script adds `html.is-intro`, the CSS hides those elements until the interaction plays them in. Swup page changes never replay it, because the class is gone by then.

- Adding an element to the intro? Add its selector to the `html.is-intro` CSS too, or it flashes.
- Safety net: class is removed after 5s whatever happens.
- Reduced motion: no intro.

---

## 6. Module template

Copy this for every new module. Shared across projects: `core/<name>.js` plus a doc in `docs/`. One project only: inside `projects/<project>/<project>.js`.

```js
/* ModuleName 1.0.0: one line on what it does.
   Markup: [data-module-name] on the wrapper. Options: data-module-name-speed="1.2"
   Scope: page content only (inside #swup). */
(() => {
  const SEL = '[data-module-name]';
  const live = new Set();

  const setup = (el) => {
    if (el._moduleName) return;          // idempotent
    const speed = parseFloat(el.dataset.moduleNameSpeed) || 1;

    // GSAP / ScrollTrigger here: created inside App.ctx, reverted automatically on page leave
    gsap.from(el, { autoAlpha: 0, y: 24, duration: 0.8 * speed, scrollTrigger: { trigger: el, start: 'top 85%' } });

    // Anything NOT GSAP needs manual cleanup
    const onEnter = () => {};
    el.addEventListener('pointerenter', onEnter);

    el._moduleName = () => {
      el.removeEventListener('pointerenter', onEnter);
      delete el._moduleName;
    };
    live.add(el);
  };

  const init = (scope = document) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    scope.querySelectorAll(SEL).forEach(setup);
  };

  const destroy = () => { live.forEach((el) => el._moduleName && el._moduleName()); live.clear(); };

  App.register('ModuleName', init, destroy);
})();
```

**What needs manual cleanup (not covered by App.ctx):**
- `addEventListener` on elements, `window` or `document`
- `IntersectionObserver`, `ResizeObserver`, `MutationObserver`
- `requestAnimationFrame` loops
- Splide / Swiper instances (`splide.destroy()`)
- Video players, HLS instances (`hls.destroy()`)
- Anything on `window` (timers, globals)

**Touch vs hover:** gate hover effects with
```js
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
```

---

## 7. Attribute conventions

| Pattern | Use |
|---|---|
| `data-<module>` | Marks an element for a module. One attribute per module. |
| `data-<module>-<option>` | Options per element, read via `el.dataset`. |
| `data-no-swup` | Link does a full page load. |
| `data-theme-tween` | Element outside `#swup` whose colour crossfades with the theme. |
| `data-page-shell` | Page Theme component (outside `#swup`). |
| `data-lenis-prevent` | Scrollable element inside the page (modal, menu) that Lenis must not hijack. |
| `data-intro` | Element hidden until the intro interaction plays it in. |

No classes as JS hooks. Classes are for styling, attributes for behaviour, so a client renaming a class never breaks a script.

---

## 8. Pitfalls (all hit on XRDS or Paloma)

1. **Lenis.stop() during transitions** jumps the page to the top while the old page is still visible. Never do it.
2. **Transform on `#swup`** breaks every `position: fixed` child (menus, modals, sticky elements). Opacity only.
3. **Missing `data-wf-page` swap** breaks Webflow forms and native interactions on the new page. The shell handles it.
4. **Webflow forms after a swap** only work because of `Webflow.destroy(); Webflow.ready();`. Test every form via a Swup visit, not only on a hard refresh.
5. **ScrollTrigger positions wrong after swap**: images loading late. Call `ScrollTrigger.refresh()` after images inside the module load if a module depends on exact positions.
6. **Module works on refresh, dies after navigation**: it queries `document` instead of `scope`, or it self-starts instead of registering.
7. **Module runs twice**: setup is not idempotent.
8. **Late-loading script** (async, deferred): `App.register` inits it on the current page. Do not add your own `DOMContentLoaded` listener.
9. **CMS links to unpublished items** 404 under Swup the same as anywhere. Check every CMS list link before launch (3 on Paloma).
10. **Webflow Designer/Editor**: Lenis is off in the Editor. Do not test smooth scroll there.

---

## 9. Starting a new project (Shelter checklist)

1. Wrap all page content in a div with ID `swup`, on every page and template.
2. Paste the head block and footer block from section 2. Set `CORE_CONFIG`.
3. Decide: theme crossfade yes or no. No themes? `USE_THEME_TWEEN: false`.
4. Set `NAV_BTN` in `CORE_CONFIG` to the project's nav link selector, or `''`.
5. Build the "Intro (first load)" interaction if the design has one; add its selectors to the `is-intro` CSS.
6. Add the global embed (on canvas, in the Global component) with at least:
   ```css
   body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
   a { color: inherit; }   /* links are never Webflow blue */
   @media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }   /* iOS: no zoom on focus */
   ```
7. Create `studio-scripts/projects/<project>/<project>.js`, add modules with `App.register`.
8. Test: hard refresh on every page, then click through every page via Swup, back button, anchor links, every form.
9. Pin the commit hash in the footer before handover (same hash for every studio-scripts file).

---

## 10. Next files (in this order, only when a project needs them)

- `splide.md`: done, see `docs/splide.md`
- `video.md`: Bunny/HLS player, alpha video, media poster
- `nav.md`: mobile menu, nav state, logo on media
- `effects.md`: image trail, hover flip, magnetic, card rim, media reveal

Changelog
- 1.0.0 (Nov 2026): extracted from Paloma into `core/core.js` + `core/ix3-reinit.js`, configurable via `window.CORE_CONFIG`. Added `App.register`, `App.ctx` (gsap.context per page), `data-no-swup`, reduced motion in the shell, `USE_THEME_TWEEN` switch.
