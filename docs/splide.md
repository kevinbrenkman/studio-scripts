# splide.md
Sliders for Webflow builds: Splide 4 from plain Webflow markup (static or CMS), set up with data attributes only.

File: `core/slider.js`. Source: Paloma (Nov 2026): CaseSlider, SliderMotion, SliderDrag, SliderFX, generalised.
Follows the module contract in `docs/core.md`. Also works on a plain Webflow site without Swup.

---

## 1. Load

After `core.js` (if the site uses it), before the project bundle:
```html
<script src="https://cdn.jsdelivr.net/gh/kevinbrenkman/studio-scripts@<SHA>/core/slider.js"></script>
```
Do **not** load Splide yourself. `slider.js` loads Splide 4.1.4 only on pages that have a `[data-slider]`.
Do **not** load Splide's CSS. The minimal layout CSS is injected.

---

## 2. Markup in Webflow

**CMS slider**
```
div            [data-slider]                 root (also holds arrows, headings, anything)
  Collection List Wrapper   [data-slider-track]
    Collection List         [data-slider-list]
      Collection Item       = one slide
  button       [data-slider-prev]            optional
  button       [data-slider-next]            optional
```

**Static slider**: same structure with plain divs. The direct children of `[data-slider-list]` are the slides.

Fallback: without the track/list attributes it looks for `.w-dyn-list` and `.w-dyn-items`. Set the attributes anyway, it survives a client wrapping things.

**Styling in Webflow**
- Slide width comes from Webflow (auto width is on): give the Collection Item a width (`30vw`, `24rem`, ...) and set it per breakpoint in Webflow.
- In the Designer the list shows as it is. Style the Collection List as `display: flex` with `flex-wrap: nowrap` and `overflow: hidden` on the wrapper, so the Designer looks like the live slider.
- No margins on slides: spacing is `data-slider-gap`.
- Arrows: style `.is-disabled` (non-loop sliders at the ends) and `.is-flash` (trackpad swipe feedback) as combo classes or in an embed.

---

## 3. Attributes

All on the `[data-slider]` root. Everything is optional.

**Splide**
| Attribute | Default | What |
|---|---|---|
| `data-slider-type` | `loop` | `loop`, `slide` or `fade` |
| `data-slider-auto-width` | `true` | `false` = Splide sets the width via `per-page` |
| `data-slider-per-page` | `1` | Only with `auto-width="false"` |
| `data-slider-gap` | `1.25rem` | Any CSS length, or `css`: use the list's own column-gap from the Designer (converted to em). Never combine a CSS gap on the list with a length here, the loop drifts by one gap per slide |
| `data-slider-focus` | `0` | `0` = left aligned, `center` = active slide centred |
| `data-slider-speed` | `1000` | ms |
| `data-slider-padding-left` / `-right` | `0` | Track padding, e.g. `11.67vw` to align with the grid |
| `data-slider-gap-mobile`, `-focus-mobile`, `-padding-left-mobile`, `-padding-right-mobile` | desktop value | Under 768px |
| `data-slider-pagination` | `false` | Splide dots |
| `data-slider-drag` | `true` | Mouse / touch drag |
| `data-slider-autoplay` | | Interval in ms, e.g. `5000`. Pauses on hover and focus, restarts after an arrow click. Off with reduced motion |
| `data-slider-mobile` | `true` | `false` = no slider under 768px; the list keeps its own Webflow layout (grid, stack) |
| `data-slider-name` | | Name for arrows outside the root: `data-slider-next="radar"` anywhere on the page |
| `data-slider-options` | | JSON escape hatch, merged last: `{"rewind":true,"perMove":2}`. Replaces `breakpoints` as a whole |

**Behaviour**
| Attribute | What |
|---|---|
| `data-slider-exclude-current` | Removes the slide that links to the current page ("More projects" on a project template) |
| `data-slider-keep-empty` | Keep the slider visible when the CMS list is empty. Default: hidden |
| `data-slider-trackpad="false"` | Turns off trackpad drag (on by default) |

**Add-ons**
| Attribute | What |
|---|---|
| `data-slider-autoscroll="1"` | Auto scroll at 20px/s (`2` = 40px/s). Eases out on hover, drag, or out of view |
| `data-slider-reveal` | Slides in view stagger up when the slider scrolls in from below |
| `data-slider-reveal-y` / `-stagger` / `-duration` | `40` px / `0.08` s / `1` s |
| `data-slider-parallax` | Media inside slides drifts against the travel direction |
| `data-slider-parallax-target` | Selector inside each slide, default `img, video` |
| `data-slider-parallax-zoom` / `-shift` | `1.2` / `8` (xPercent). Keep shift under `(zoom - 1) / 2 * 100` or edges show |

All add-ons are off with reduced motion.

---

## 4. Examples

**"More projects" on a CMS template page**
```
[data-slider]
data-slider-exclude-current
data-slider-gap="1.25rem"
data-slider-padding-left="11.67vw"
data-slider-padding-left-mobile="1.25rem"
data-slider-reveal
data-slider-parallax
data-slider-parallax-target=".project-card_media img"
```

**Logo or image ticker**
```
[data-slider]
data-slider-autoscroll="1"
data-slider-drag="false"
data-slider-gap="3rem"
```

**Classic one-at-a-time with arrows, stops at the ends**
```
[data-slider]
data-slider-type="slide"
data-slider-auto-width="false"
data-slider-per-page="1"
```

---

## 5. For other modules

- When a slider is mounted, `slider:ready` fires on the root (bubbles). The Splide instance is `root._sp` (also `event.detail.splide`).
- After mount, every other `App.init` runs again with the slider root as scope, so modules also set up on the loop **clones**. That only works if your module is idempotent (`docs/core.md`, rule 3).
- Listen for `slider:ready` with a document listener registered once, and clean up in your module's `destroy`:

```js
(() => {
  const live = new Set();
  document.addEventListener('slider:ready', (e) => {
    const root = e.target, sp = root._sp;
    if (root._myAddon) return;
    const onMove = () => { /* ... */ };
    sp.on('move', onMove);
    root._myAddon = () => { sp.off('move', onMove); delete root._myAddon; };
    live.add(root);
  });
  App.register('MyAddon', () => {}, () => { live.forEach((r) => r._myAddon && r._myAddon()); live.clear(); });
})();
```

---

## 6. Pitfalls (all hit on Paloma)

1. **Reading layout every frame** (`getBoundingClientRect`, `Move.getPosition()`) right after Splide moves the list stutters on phones. Parallax and auto scroll measure once and read the transform instead. Keep it that way when you extend them.
2. **Auto scroll moves the list without telling Splide.** The index stays behind and the next swipe or arrow click jumps back. `slider.js` syncs the index before any wheel, pointer, touch or click. If you add another way to move the slider, sync it too.
3. **Videos in loop clones** play double and double the bandwidth. If slides hold autoplay video, remove or pause video inside `.splide__slide--clone` in your project module.
4. **Webflow interactions on clones** do not bind (IX3 registered before the clones existed). Do slide hover effects in JS, or accept they only work on the originals.
5. **Splide's "…" announcer** shows on screen without Splide's CSS. Already hidden visually in `slider.js`, still readable for screen readers.
6. **Loop with few slides**: with auto width, a loop needs enough slides to fill the screen width twice, or gaps show at the edges. Use `data-slider-type="slide"` for short lists.
7. **Slide width in %** inside a flex list with auto width gives inconsistent results. Use `vw`, `rem` or `px`.
8. **Page left while Splide was still loading**: handled (it checks `isConnected`). Do not remove that check when editing.

---

## 7. Test checklist

1. Hard refresh: slider shows, no flash of the unstyled list.
2. Drag with mouse, swipe on phone, swipe with trackpad (sideways swipe must not scroll the page).
3. Arrows, and the ends on a `slide` type.
4. Navigate away and back via Swup: slider rebuilds, no double slides, no console errors.
5. Reduced motion on (macOS: Accessibility > Display > Reduce motion): no auto scroll, no reveal, no parallax.
6. Empty CMS list: slider hidden.

Changelog
- 1.1.1 (Nov 2026, Shelter): `data-slider-gap="css"`. Splide owns the gap while mounted and the list's CSS gap is zeroed, given back on breakpoint destroy. Fixes the loop offset and drift when the list also had a CSS gap.
- 1.1.0 (Nov 2026, Shelter): `data-slider-autoplay`, `data-slider-mobile="false"`, `data-slider-name` for outside arrows. Layout CSS only while Splide is mounted (`.is-initialized`), so a destroyed slider keeps its Webflow layout. Works inside a Webflow component slot: the slot content holds `[data-slider-track]` (or the Collection List Wrapper) and the list.
- 1.0.0 (Nov 2026): extracted from Paloma. One file, attribute driven, own arrows, add-ons opt in.
