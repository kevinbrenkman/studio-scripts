# Shelter build plan

Webflow site for Shelter (Onkruid, Asiat Park Vilvoorde). Development only, design by Onkruid (Lukas).
Webflow site: "Shelter" (shelter-ea606b). Figma: Shelter V3 (Copy), page **Final Kevin** only.
Scope: one-pager plus one detail per event (the drawer), €3.000. Base: `docs/core.md` + `docs/splide.md`.

Status: step 1 done 10 Nov 2026 (fonts, Variables, global embed, core code, Events collection, spike).

---

## 1. Decisions

| Topic | Decision |
|---|---|
| De Radar | Cards (agreed with Lukas on call) |
| Event detail | Drawer over the homepage, own URL per event, through the Swup Fragment Plugin (CHG pattern, clean rebuild) |
| Event URL | `/radar/[slug]`. Template page = Top component + its own Radar section (own collection list, same Event Card component) + Bottom component + filled drawer. Spike 10 Nov: Webflow does not allow a CMS collection list inside a component, so one "Homepage" component is impossible |
| Direct entry on an event URL | Page without intro, drawer open |
| Mobile | Stack the desktop sections, follow the one mobile frame. Drawer full width from the right |
| Content | As in the design. Lukas edits in Webflow |
| Fonts | Obscura TM Fixed (light 300, regular 400, bold 700) and Neue Haas Grotesk Text (55 Roman, 56 Italic, 65 Medium, 66 Medium Italic, 75 Bold, 76 Bold Italic) |
| Ontdek het park | https://asiatpark.be |
| Onderstroom vzw link | No URL yet (site does not exist). Leave the link out until it does |
| Colours | White, pink `#ff41c2`, blue `#00a1ff`, green `#00ff7d` as Webflow Variables. Choice kept in `sessionStorage`, not in the URL |
| iOS Safari | Colour switch tweens the body background, so the Safari 26 toolbar follows (as on Paloma). No fixed element spanning the full width at the top or bottom edge |
| JS hooks | Data attributes only, never classes (`docs/core.md` section 7) |
| Hosting | studio-scripts on GitHub via jsDelivr, pinned commit, same hash for every file |

## 2. From Lukas's prototype

The prototype lays out a 1512px frame in absolute positions and zooms it to the window. The layout is not reused.

**Take:** the 13 logo frames (SVG) plus `logo-building.jpg` and `logo-mask.svg`, the outline SVGs over the products and the reveal timing, CSS keyframes (sign-in, swing, bob, pop-in, nudge), the drawing logic (canvas, midpoint smoothing, logo coordinates 1512 x 520), images in `/assets`, the scroll arrow and the mobile ticker.

**Rebuild:** layout in flex/grid, Radar carousel and social slider with `core/slider.js`, the drawer from the CMS, colours as Variables.

**Drop:** absolute layout and zoom, its own carousel and slider code, event data in JS, colour in the URL hash.

## 3. Outlined headings

"Bouw aan Shelter", "Hang in niteshop", "Join de club", "De Radar", "Volg Shelter op...".

Figma: live text, Obscura TM Fixed Regular, 105px, line height 70px, fill = page colour, black outline. Line 2 hangs over line 1.

Within a word the letters should merge into one shape (as in Figma). Across words they should not: the next word, and line 2 as a whole, lands on top of the one before.

CSS on one text element (`-webkit-text-stroke` + `paint-order: stroke fill`) paints all strokes first and all fills after, so the whole heading merges into one shape and line 2 no longer hangs over line 1.

Fix: `data-outline-text` on the heading. A small script splits the text into one span per **word** (screen readers keep the full text through `aria-label`). Inside a word the letters merge; each next word paints its own stroke and fill after the one before, so line 2 lands on top of line 1. Lukas edits the heading as normal text.

- Stroke width in CSS = 2x the Figma stroke (half of it is covered by the fill)
- In the Designer the heading shows the merged version (no script there). Accepted
- Test against Figma: two words touching on the same line now show an outline between them. Check per heading

## 4. Draw your Shelter

- Drawing goes **under** the outline logo (logo frame 1, `fill="none"`), like a colouring book. Canvas below the SVG in z-order
- Clip the canvas to the letters with `logo-mask.svg` so colour stays inside the letters
- Strokes saved in logo coordinates (1512 x 520), so they survive resizing
- Saved in `localStorage` (open question, see below): back on the site, click draw and the previous drawing is there
- Store simplified points and cap the size, wrapped in try/catch (private mode can throw)
- Time box: 2 hours. Over that, it ships later as an add-on

Open: Kevin suggested `sessionStorage`, which is cleared when the tab closes. "See it next time you come back" needs `localStorage`. Attribute `data-draw-storage="session|local"` makes it a one-word switch.

## 5. Files and attributes

| File | What | Attributes |
|---|---|---|
| `core/core.js` 1.1.0 | `CORE_CONFIG.PLUGINS` (extra Swup plugins), no page fade on fragment visits | |
| `core/drawer.js` (new, studio wide) | Open/close, Escape, scrim click, focus trap and return, scroll lock (`data-lenis-prevent` on the panel), back button | `data-drawer`, `data-drawer-close`, `data-drawer-scrim` |
| `projects/onkruid/onkruid.js` (shared Onkruid file) | Colour switch + iOS toolbar, scroll arrow, outline text | `data-theme-set="pink"`, `data-scroll-arrow`, `data-outline-text` |
| `projects/shelter/shelter.js` | Logo intro, product reveal, sign hover building, drawing | `data-logo-intro`, `data-reveal`, `data-hover-building`, `data-draw` |

Colour mapping: Variables hold the four colours. A global embed maps `html[data-theme="pink"]` to them, so nobody edits hex codes in code.

## 6. Build steps (each ends with its test)

1. **Foundation** (2 to 3h)
   - Fonts (woff2), Variables, global embed: font smoothing, iOS no-zoom, colour mapping, outline heading style
   - Core head and footer code, `#swup` wrapper
   - Spike, 30 min: a collection list inside a component on the CMS template page. **Result: not possible** (platform limit). A collection list directly on the template page works. Drawer setup changed accordingly (section 1)
2. **Layout** (4 to 6h): all sections desktop, then mobile stacked. Copy from the design
3. **CMS and sliders** (2 to 3h): Events collection (title, slug, date label, tag Shelter/Niteshop, image, intro, body, Wanneer, Waar, Hoe laat, ticket link). Radar: `data-slider-type="loop"`, autoplay 5s through `data-slider-options`, no slider below 760px. Social: `data-slider-autoscroll="2"` (40px/s)
4. **Drawer** (3 to 4h): core 1.1.0, `core/drawer.js`, template page, fragment rules `/` <-> `/radar/:slug` and slug <-> slug swap `#drawer` only
5. **Motion** (3 to 4h): logo intro, reveal, sign, balloons, colour switch + iOS toolbar, scroll arrow, ticker, outline text
6. **Drawing** (2h cap)
7. **QA** (2h): Safari on iPhone, every Swup route, back button, reduced motion, pin the commit hash

Estimate: 18 to 24h.

## 7. Open items

- Onderstroom vzw URL (site not live yet)
- Ticket links (with the content)
- Drawing storage: session or local (section 4)
