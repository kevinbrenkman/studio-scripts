# studio-scripts

Reusable front-end scripts for Kevin Brenkman studio projects, served via jsDelivr.

- `core/` shared modules, used across projects
  - `core.js` Swup page transitions + Lenis + GSAP + App module registry
  - `ix3-reinit.js` native Webflow interactions (IX3) after a Swup swap
  - `slider.js` Splide sliders from Webflow markup, attribute driven
  - `glow.js` cursor-following glow on buttons
- `docs/` how to use them. Start a new build from `docs/core.md`.
  - `core.md` setup, module contract, module template, pitfalls, new project checklist
  - `splide.md` sliders
- `projects/<client>/` per-project bundles

Always load a pinned version (commit hash or tag), never `@main`:
`https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/core/core.js`
