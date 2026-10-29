# The Aperture design system: Drift

This is the reference for how the site looks and behaves since the Drift
redesign. The values live in `app/globals.css` (the `:root` block at the top);
this page says what each one is for, and the rules that keep new work
consistent.

The idea in one line: the whole site is a quiet walk through a dark space, so
everything that isn't a photo stays small, plain, and out of the way.

## Rules

1. **Photos keep their real shape.** Nothing is cropped to a fixed ratio,
   except the thumbnails in All photos, which are cropped only by the row they
   sit in.
2. **One corner radius.** Every photo, and every box that sits beside a photo
   (the hover caption), uses `--photo-radius`. In the 3D walk the same corner
   is drawn by the shader (`PHOTO_RADIUS` in `components/Walk.js`).
3. **Buttons are words over a hairline.** No pills, no filled buttons, no
   outlines. See [Text button](#text-button).
4. **Pink means "here" or "now".** The current section, the timeline marker,
   the drift dot when it is on, hover, keyboard focus, and the focus cursor on a
   photo. Nothing else is pink.
5. **No footer, no photo counts on the page, no scroll snapping.** The only
   glides are the two Rahul asked for: from the collage to the welcome, and from
   the welcome to the first section.
6. **External links open in a new tab.**
7. **Motion can always be turned down.** Anything that moves on its own
   respects the device's "reduce motion" setting (see [Motion](#motion)).

## Tokens

### Colour

| Token | Value | Used for | Contrast on black |
|---|---|---|---|
| `--ground` | `#000` | The page and the walk's space | |
| `--tile` | `#161618` | Placeholder behind a thumbnail while it loads | |
| `--ink` | `#F5F3EF` | Main words, hovered buttons | 18.9:1 |
| `--ink-soft` | `#E6E2DC` | Captions, links on the end screen | 16.3:1 |
| `--ink-muted` | `#CFCBC4` | Quotes, secondary lines | 13.0:1 |
| `--ink-quiet` | ink at 62% | Button and header words at rest | 7.2:1 |
| `--ink-faint` | ink at 50% | Timeline sections you are not in | 4.9:1 |
| `--hairline` | ink at 28% | The line under every button and timeline segment, the dial ring | 2.2:1 (decorative) |
| `--pink` | `#F4B6C2` | "Here" and "now" (rule 4) | 12.3:1 |

Words that sit over photos (the header, the timeline, section names) also
carry a dark text shadow, `0 1px 8px rgba(0, 0, 0, .9)`, so they stay
readable over a bright photo.

The hairline is below the 3:1 that WCAG asks of a control's outline, which is
fine because it is decoration: the words themselves are the button. Don't make
a hairline the only sign that something can be clicked.

### Type

| Role | Font | Size |
|---|---|---|
| Body, buttons, timeline | Onest (`--font-sans`), 400, 500, 700 | 13px buttons and timeline, 15 to 16px body |
| Section names, welcome, quotes, captions | Newsreader italic (`--font-serif`, class `.serif`) | Section names 44 to 92px, welcome 34 to 58px (both fluid with `clamp`) |
| Place labels | Onest, uppercase, 12px, 0.04em tracking (`.place`) | |
| Dial labels | Onest 8.5px, uppercase, 0.14em tracking; the chosen name in Newsreader italic 15px in the centre | |

Both fonts load through `next/font` with `display: swap`, so words show
straight away in the fallback font and swap in when ready.

### Shape, space, and motion

| Token | Value | Notes |
|---|---|---|
| `--photo-radius` | `8px` | Rule 2. The logo in the header is the one exception: at 18px it uses 5px so it doesn't turn into a circle. |
| `--ease` | `cubic-bezier(.2, .8, .2, 1)` | Every eased transform: titles, the dial, the cursor |
| Page gutter | `clamp(16px, 4vw, 56px)` | Header and the walk's words |
| Touch target | 44 by 44px minimum | Every button, link, and the timeline |
| Colour fades | `.3s ease` | Hover on buttons and links |
| Section name in and out | `.7s` with `--ease` | |

## Components

### Text button

Classes `.btn` and `.header__btn`. Used for All photos, Drift, Back to the walk,
Close, Previous, and Next. The header name (`.header__name`) and the end-screen
links (`.walk__links a`) follow the same pattern.

| State | Looks like |
|---|---|
| Rest | 13px words in `--ink-quiet`, 1px `--hairline` underneath, 10px gap between them |
| Hover | Words turn `--ink`, the line turns `--pink` |
| Keyboard focus | 2px pink outline, 3px away from the button |
| Pressed (Drift only) | `aria-pressed="true"`: words in `--ink`, pink line, and a breathing pink dot before the word |

```jsx
<button type="button" className="header__btn" onClick={...}>All photos</button>
```

Do: keep the label to one or two plain words. Don't: add a background, a
border all round, or an icon next to the words.

### Timeline

`Timeline` in `components/Walk.js`. Sits in the header between the name and the
buttons on a computer, and along the bottom of the screen on a phone (with a
small "back to the start" icon at its left end).

- One segment per section, as wide as that section is long, each a word over a
  hairline. The current section is `--ink` with a pink line
  (`aria-current="true"`).
- A 1px tick for every photo, and a pink marker for where you are.
- Drag it, click it, or focus it and use the arrow keys (one photo per press),
  Home, and End. Each photo you pass makes a soft click, and a short buzz on
  Android.
- For screen readers it is a slider named "Timeline of every photo", and it
  reads out where you are, for example "Reflections, photo 9 of 48".
- It fades in once the first section begins, and is hidden (and out of the Tab
  order) before then.

### Welcome and end screens

`.walk__threshold` and `.walk__exit`. Centred words over a soft radial dim of
the walk. The welcome: "Photographs by", the welcome line, the pink serif line,
and the headline, with a chevron to begin. The end: the quote and its author,
bio, the Now line, links, and a replay icon. The words come from
`content/about.json`.

Once you move past the welcome it fades out and is hidden from the Tab key, so
keyboard users never land on a button they can't see.

### Focus cursor

`components/Cursor.js`. Only for a mouse or trackpad; phones and tablets keep
their own touch behaviour.

| State | Looks like |
|---|---|
| Rest | Four corner brackets round a small cross, trailing the pointer a touch |
| Over a button or link | The brackets close in (`is-link`) |
| Over a photo | The brackets open out and turn pink, the cross shrinks (`is-focus`) |
| Pressing down | The brackets tighten, like a half-press of the shutter |

With "reduce motion" on, the brackets follow the pointer exactly instead of
trailing.

### Mode dial (right-click menu)

`components/ContextMenu.js`. Right-click anywhere (or press the menu key),
or touch and hold for half a second on a phone, and a camera mode dial opens
round the pointer or finger: a knurled ring of settings that turns. The chosen
setting sits on the right, inside pink focus-point brackets and under a pink
index mark, with its name in the middle. Settings, in order: Back to the
start, All photos, About, The making of (the behind the scenes page), and
Socials. Socials is a group: Instagram and
Bluesky (plus Email me, if an email address is set in `content/about.json`)
sit on an outer dial that fans out on the right. A group of one is shown as
that one link.

- Each scroll notch turns the ring one click (a trackpad's small steps add
  up), with the same soft click and Android vibration as the timeline
  (`lib/click.js`). The walk does not scroll while the dial is open.
- Click the centre, press Enter, or click a setting directly to go there. On
  Socials that steps onto the outer dial instead; scroll moves along it, and
  right-click or Escape steps back. A second Escape, or a click elsewhere,
  closes the dial and keyboard focus goes back to where it was.
- The arrow keys turn the dial, and focus follows the chosen setting.
- On a phone, touch and hold, then slide without lifting: the ring stays
  still and the brackets follow your finger; sliding past the edge on Socials
  reaches the outer dial; lifting chooses. Lifting without sliding leaves the
  dial open for a tap. Each notch clicks and vibrates (iPhones do not allow
  vibration). Moving your finger before the dial opens (a scroll, or dragging
  the timeline) cancels it, a quick tap still opens a photo, and the lift that
  ends a hold never opens the photo underneath. The browser's own
  press-and-hold callout and text selection are switched off on touch screens.
- While it is open the focus-point cursor hides and the ordinary pointer
  returns, so nothing sits over the dial. A right-click never opens the photo
  under it; only the main button (or a finger) does.
- The behind the scenes page has the same dial. There, Back to the start,
  About, and All photos lead back to the walk (`/`, `/#about`, `/#all`).
- The dial keeps 212px clear on the right for the outer dial, so near the
  right edge it opens a little to the left of the pointer.
- It is a `menu` with `menuitem`s, each named by its label.

### All photos

`components/AllPhotos.js`. A plain grid of every photo, section by section,
rows keeping each photo's shape. Opens over the walk as a dialog: focus moves
to "Back to the walk", Tab stays inside, Escape closes it, and focus returns to
the All photos button. If the browser can't draw the walk at all (no WebGL),
All photos is the page itself.

### Lightbox

`components/Lightbox.js`. One photo at a time, fading up out of the dark in its
own colours (`.develop`). Title and "n of N" at the top, Close at the right,
caption and place label below, Previous and Next at the bottom. Arrow keys
step, Escape closes. Focus moves to Close when it opens, Tab stays inside, and
focus goes back to the photo you opened. The photos either side are fetched in
advance so stepping is instant.

## Motion

- **Drift** (the page moving on its own) is off when you arrive. Pressing the
  welcome's chevron turns it on, except when the device asks for reduced
  motion; then the walk waits for you and the Drift button turns it on.
- Any scroll, drag, or key press pauses the drift for four seconds.
- With "reduce motion" on: the collage appears without flying in, glides are
  instant, the cue arrows and dial don't animate, and the cursor doesn't trail.

## Accessibility checklist for new work

- Every control is a real `button` or `a`, at least 44 by 44px, with words or
  an `aria-label`.
- Keyboard focus shows a pink outline; never remove it without a replacement.
- Anything hidden with opacity is also hidden with `visibility: hidden`, so it
  leaves the Tab order.
- A layer that covers the page moves focus in, keeps Tab inside, closes on
  Escape, and hands focus back (`components/useDialog.js` does all four).
- New words over photos get the dark text shadow.
- Run `npm run build && npm test`; the checks cover focus, the timeline's
  spoken value, and the no-WebGL fallback.
