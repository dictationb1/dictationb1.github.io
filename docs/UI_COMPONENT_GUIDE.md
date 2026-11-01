# UI_COMPONENT_GUIDE — Smart Dictation Player v0.0.1.b

One stylesheet, flat matte, no glass. If a component is not documented here, it
does not belong in the app.

---

## 1. Design tokens

Defined once in `assets/css/sdp-ui.css` on `:root` (dark default) and overridden
by `html[data-theme="light"]` / `body[data-theme="light"]`.

| Token | Dark | Light | Used for |
| --- | --- | --- | --- |
| `--bg-app` | `#09090B` | `#FFFFFF` | page, header |
| `--bg-card` | `#121216` | `#F4F4F5` | cards, tab bar |
| `--bg-elev` | `#18181D` | `#EDEDF0` | buttons, chips, table head |
| `--bg-sunken` | `#0C0C0F` | `#FAFAFA` | inputs, bar track |
| `--border` | `#27272A` | `#E4E4E7` | 1px hairlines |
| `--border-strong` | `#3F3F46` | `#D4D4D8` | interactive outlines |
| `--text` | `#FAFAFA` | `#09090B` | primary text |
| `--text-muted` | `#A1A1AA` | `#52525B` | labels, helper text |
| `--accent` | `#38BDF8` | `#0284C7` | primary actions, listening ring |
| `--ok` | `#10B981` | `#059669` | correct marks, writing ring |
| `--warn` | `#F59E0B` | `#B45309` | last-3-seconds ring |
| `--danger` | `#EF4444` | `#DC2626` | missed marks |
| `--header-h` | `54px` | `54px` | fixed header height |
| `--tabbar-h` | `60px` | `60px` | mobile bottom bar |
| `--rail-w` | `232px` | `232px` | desktop rail |
| `--radius` / `--radius-sm` | `14px` / `10px` | same | cards / controls |
| `--tap` | `48px` | `48px` | minimum hit target |

Rules that never change:

- `backdrop-filter: none !important` on header, cards, modals, toast, bars, pills.
- Zero shadows (`--shadow: none`); depth comes from the border + surface pair.
- No gradients except the credits shimmer sweep.
- Every interactive element is at least `48 × 48` px (`min-height: var(--tap)`).

---

## 2. Shell

**Header** — `#appHeader`: `position: fixed; top: 0; height: 54px`, flat `#09090B`
(or `#FFFFFF` in light), hairline bottom border. Left: swan SVG, `#brandName`
"Smart Dictation", `CCBE B1` badge, `#sdpVerPill` "v0.0.1.b". Right:
`? Guide`, `EN | SI`, theme toggle.

`body { padding-top: var(--header-h) }` and `#sdpScreens { padding-top: 8px }`
guarantee the first card starts at **54 + 8 = 62 px** from the viewport top,
inside the 68 px ceiling at both 390×844 and 1280×800.

**Navigation** — `< 1024px`: `#tabbar` fixed bottom, 5 equal columns, 60px.
`>= 1024px`: `#tabbar` hidden, `#sdpSideRail` fixed left (54px → bottom), 232px,
and `#sdpLayout` gets `padding-left: 232px`.

---

## 3. Components

### Card
`.card` — `background: var(--bg-card); border: 1px solid var(--border);
border-radius: var(--radius); padding: 14px`.

### Buttons
| Class | Look | Use |
| --- | --- | --- |
| `.btn` | elevated surface + strong border | secondary action |
| `.btn-primary` | accent fill, dark ink | the one obvious next step |
| `.btn-accent` | emerald fill | "Finish & check" |
| `.btn-danger` | red outline | Reset local stats only |
| `.btn-sm` | 44px tall, 13px | dense rows, chips |
| `.hbtn` | 40px header button | header actions |
| `.seg-btn` | segmented control | Paper / Typing |

### Chips and pills
`.pill` / `.chip` — 999px radius, `aria-pressed="true"` flips to accent fill.
Always drive state through `aria-pressed` (or `aria-selected` for tabs); CSS
does the rest and screen readers stay correct.

### Inputs
`.input` — 48px tall, sunken background, strong border. `select.input` uses the
same shell. `#typeInput` is special: 56px tall, 20px text, 2px accent border,
created only in Typing mode.

### Beat ring
```html
<svg class="ring" viewBox="0 0 80 80">
  <circle class="ring-track" cx="40" cy="40" r="34"></circle>
  <circle id="beatRing" cx="40" cy="40" r="34" stroke="#38BDF8" fill="none"
          stroke-width="6" stroke-linecap="round" transform="rotate(-90 40 40)"></circle>
</svg>
```
The engine sets `stroke-dasharray="213.63"` and animates `stroke-dashoffset`
(`C × (1 − fraction)`), plus the `stroke` attribute for phase colour. The bar
below (`#beatBar`) mirrors the same fraction and colour.

### Self-check table
`#resultsTable` — sticky header, `.mark-btn` per row with
`data-mark="correct"|"missed"` and `aria-pressed`. Row class `is-correct` /
`is-missed` colours the word. `.r-diff` shows what the student typed in Typing
mode.

### Guide modal
`#guideModal` is a full-screen scrim with a bottom sheet on phones
(`align-items: flex-end`) and a centred card on `>= 720px`. Four `<li>` steps
with a 3px accent left border. `#guideLangPill` toggles language in place.

### Data toast
`#sdpDataToast`: `position: fixed; right: 10px; bottom: calc(var(--tabbar-h) + 12px);
max-height: 26px; pointer-events: none;` — text is `Loaded · N KB` or
`Offline ready · 0 KB`. It shows once per load, holds 2,400 ms, then
`.toast-hidden` fades it out in 400 ms. It is never clickable, so it cannot cover
a control.

### Credits shimmer
`.credits-pill` — uppercase 11.5px accent text in a hairline capsule; the `::after`
pseudo-element sweeps a 45%-wide light band (`@keyframes sdp-shimmer`, 3.4s,
infinite) and is disabled under `prefers-reduced-motion: reduce`. Text is always
exactly `CREDITS GOES TO Hansana`. It lives in `#creditFoot` on Home — never as a
floating badge over the player.

---

## 4. Sinhala typography

```css
@font-face { font-family: 'Noto Sans Sinhala'; font-weight: 400;
  src: url('../fonts/NotoSansSinhala-Regular.woff2') format('woff2'); font-display: swap; }
```

`../fonts/…` resolves from `assets/css/` to `assets/fonts/…`, i.e. the preserved
`./assets/fonts/` files. Applied to `.word-si`, `.si`, `[lang="si"]`, the credit
line in Sinhala mode, guide bodies and hint output. Latin text keeps Inter.

---

## 5. Language purity (W7)

`SDP.Views.applyLang('en'|'si')` rewrites every `[data-i18n]` node from
`STRINGS_EN` / `STRINGS_SI`, sets `<html lang>`, repaints the language pills and
re-renders dynamic regions (Home, Words, Practice, Guide, Settings, results).

- **EN mode:** no Sinhala characters anywhere in chrome. The only Sinhala on
  screen is the vocabulary card's `.word-si` meaning.
- **SI mode:** all chrome, buttons, labels, guide and beat states are natural
  Sri Lankan Sinhala. Proper nouns (`CCBE B1`, `Hansana`, `Ms. Sumodya Sewmini`,
  `Ayya01`, `Alice`, `ElevenLabs`), the IPA and the English target words are
  never translated.

Adding a string is a three-step change: add the key to `STRINGS_EN`, add the same
key to `STRINGS_SI`, then use `data-i18n="key"` or `Views.t('key')`.

---

## 6. Restyle in minutes

**Different accent colour (e.g. teal).**
1. `--accent: #14B8A6;` in `:root` (and `#0D9488` in light).
2. `grep -n "38BDF8" assets/css/sdp-ui.css` — update the shimmer gradient stops.
3. `data/sdp-dictation-engine.js`: `ringColor()` listening value.
4. `node tests/check.cjs && node tests/browser.cjs`.

**Taller header (e.g. 62px).**
1. `--header-h: 62px` in `:root`.
2. `#appHeader { height: var(--header-h) }` already follows the token.
3. Re-check the first-card offset: `62 + 8 = 70px` breaks the 68px ceiling, so
   reduce `#sdpScreens` top padding to `6px`. G5 asserts the ceiling.

**Rounder cards.**
`--radius: 18px; --radius-sm: 12px;` — nothing else hardcodes a radius.

**Sinhala-first default.**
`data/sdp-data-sync.js` → `defaultSettings().lang = 'si'`, and set
`<html lang="si">` in `index.html`. Then G3's purity test still passes because
`applyLang` is driven by settings, not by the static attribute.

---

## 7. Accessibility floor

- Landmarks: `<header>`, `<nav aria-label="Sections">`, `<main>`.
- Tabs expose `aria-selected`; the hidden screens get `aria-hidden="true"`.
- The guide is `role="dialog" aria-modal="true"` and moves focus to
  `#btnGuideClose` when it opens.
- `#beatStateText` and `#sdpDataToast` are `aria-live="polite"`.
- Focus is visible everywhere (`:focus-visible` 2px accent outline).
- Colour is never the only signal: marks carry `✅` / `❌` and words.

---

## 8. The About card (fifth settings section)

Settings is six `.set-card` sections in this order — the studio vault is always
sixth and last, collapsed:

| # | Section id | Audience |
| --- | --- | --- |
| 1 | study | student |
| 2 | display | student |
| 3 | audio | student |
| 4 | `#setProgress` (data & updates) | student |
| 5 | `#aboutCard` | student |
| 6 | `#studioAccordion` | lecturer only |

`#aboutCard` carries the version, the build date, a link to the `/data`
transparency page, the audience line and its own `.credit-foot` block — the
same `.credits-pill` (`CREDITS GOES TO Hansana`) and `.credit-line` used by
`#creditFoot` on Home. The ids are unique; the *content* must stay byte-equal:

```
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 / Lesandu
```

Never render this as a `position: fixed` badge over the cockpit — G7.2c/G7.2d
fail the build if the credits appear on `#screen-player` or if the footer
computes to `fixed`.

## 9. Empty and broken states are stated, never faked

| State | Home | Words tab | Engine |
| --- | --- | --- | --- |
| 0 words in the bank | `#bankEmpty` visible, `#btnStart` disabled, mastered shows `—` | `#dictEmpty` visible | `startDictation` refuses and toasts |
| corrupt progress | counters fall back to 0 | cards still render | `Data.progress()` returns defaults |
| corrupt settings | paper mode, defaults | — | `setMode` reads defaults |
| offline | shell from SW cache | cards from cached payload | audio falls back to TTS |

## 10. Typing mode submits on Enter

`#typeInput` accepts `Enter` (and `keyCode 13`) in **listening or writing**
phase: the value is stored on the item, the draft is saved, and the beat
advances — or finishes if it was the last word. Nothing else is bound to the
keyboard, and no other focus call exists.

## 11. The pre-paint cloak

`index.html` carries exactly one `<style id="sdpCloak">` block, under 400 bytes:

```
html,body{margin:0;background:#09090B;color:#FAFAFA;…}.screen{display:none!important}
.screen.active{display:block!important}
```

It exists so a budget Android on 2G never flashes five stacked screens before
`sdp-ui.css` arrives. It is the *only* allowed inline style in the app shell
(G9.3d enforces the 400-byte cap and the selector allow-list), and it carries no
layout rules — every real rule lives in the single stylesheet. The `/data`
transparency page is a standalone document and keeps its own inline sheet
(G9.3e).
