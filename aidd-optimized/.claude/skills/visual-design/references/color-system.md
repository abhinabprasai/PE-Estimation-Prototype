# Colour System Reference

## The rule that makes a colour system survive

Components reference **roles**, never palette values. A button uses `action-primary-bg`, not
`blue-600`. A palette value in a component is the mechanism by which dark mode becomes
impossible and rebranding becomes a rewrite.

Two layers:

1. **Ramps**: the raw palette. Each hue in steps, conventionally 50 (lightest) through 900
   (darkest), sometimes to 950.
2. **Roles**: semantic names mapped onto ramp steps. Roles are what the product uses. Switching
   theme means remapping roles to different ramp steps; components do not change.

## Minimum role set

| Role | Meaning |
|---|---|
| `surface-base` | The page background |
| `surface-raised` | Cards, panels resting on the page |
| `surface-overlay` | Dropdowns, popovers, modals |
| `surface-sunken` | Wells, table headers, inset areas |
| `text-primary` | Default reading colour |
| `text-secondary` | Supporting text, still fully legible |
| `text-muted` | Metadata, timestamps, placeholder-adjacent; the lowest step that still passes contrast |
| `text-on-accent` | Text sitting on a filled accent surface |
| `border-subtle` | Separators inside a group |
| `border-default` | Control and container outlines |
| `border-strong` | Emphasis, focus-adjacent, selected states |
| `action-primary-bg` / `-text` / `-hover` / `-active` / `-disabled` | The one filled action |
| `action-secondary-*` | Outlined or tinted actions |
| `action-danger-*` | Destructive actions |
| `focus-ring` | The keyboard focus indicator; one colour, product-wide |
| `status-positive` / `-warning` / `-negative` / `-info` / `-neutral`, each with `-bg`, `-border`, `-text` | Status families |
| `data-1` through `data-8` | Categorical chart series, ordered for distinguishability |

Every role needs a value in every theme. A role with no dark-mode value is where dark mode
breaks.

## Ramp construction

- Steps 50 to 900, roughly perceptually even. Constructing in a perceptual space (OKLCH or LCH)
  rather than HSL avoids the classic problem where the "same lightness" yellow and blue look
  nothing alike.
- Keep chroma low in the light steps of neutral ramps; a grey ramp with a slight hue cast (warm
  or cool) reads as intentional, whereas pure neutral grey reads as unfinished on modern displays.
  Pick one cast and hold it.
- Accessible pairings within a ramp, as a working heuristic: step 600 or darker on step 50 to 100
  backgrounds passes body-text contrast; step 500 is usually large-text-only; steps 300 and
  lighter are for surfaces and borders, never for text on light backgrounds.
- Verify every pairing; do not trust the heuristic. The maths is below.

## Contrast maths

Relative luminance for a channel value C in 0 to 1:

```
Cl = C <= 0.03928 ? C / 12.92 : ((C + 0.055) / 1.055) ^ 2.4
L  = 0.2126 * Rl + 0.7152 * Gl + 0.0722 * Bl
```

Contrast ratio between two colours:

```
ratio = (Llighter + 0.05) / (Ldarker + 0.05)
```

Range: 1:1 (identical) to 21:1 (black on white).

### Thresholds (WCAG 2.2 AA, the floor this process treats as non-negotiable)

| Content | Minimum |
|---|---|
| Body text under 18.66px regular or 24px | 4.5:1 |
| Large text (18.66px bold or 24px regular and above) | 3:1 |
| UI component boundaries needed to identify the control | 3:1 |
| Focus indicator against adjacent colours | 3:1 |
| Icons carrying meaning | 3:1 |
| Decorative graphics, disabled controls | Exempt, but see the disabled note below |

AAA (7:1 body, 4.5:1 large) is worth targeting for primary reading surfaces in products used all
day. State it as a target if you adopt it; do not claim it without measuring.

### Practical notes

- **Placeholder text** commonly fails. It is text and it needs 4.5:1. If the design wants it
  fainter than that, the real fix is that the field needs a persistent label instead of relying on
  the placeholder.
- **Disabled controls** are exempt from contrast requirements, which is a trap: exempt does not
  mean unreadable is acceptable, and a disabled control the user cannot read is a dead end. Aim
  for 3:1 and always pair disabled state with a stated reason nearby.
- **Text on images or gradients** must meet contrast against the worst pixel behind it, not the
  average. Use a scrim.
- **Brand colours that fail** become accents, borders, or backgrounds behind large text. They do
  not become body text, and this is not negotiable against a brand guideline
  (GUARDRAILS 11).
- Check the hover and active variants too. A hover state that darkens the background without
  adjusting the text is a contrast failure that only exists for the second the user is on it, and
  it is exactly when they are reading.

## Status colour

Status colour is domain-mapped, not word-mapped. Ask which statuses are good news, which need
action, and which are terminal. Do not infer from the English.

| Family | Typical use | Encoding |
|---|---|---|
| positive | Completed, approved, in good standing | Colour + check-like icon + word |
| warning | Needs attention, approaching a limit, pending someone | Colour + alert icon + word |
| negative | Failed, rejected, overdue, blocked | Colour + distinct icon + word |
| info | In progress, informational | Colour + icon + word |
| neutral | Draft, archived, and the large majority of statuses | Low-chroma treatment + word |

Rules:
- **Never colour alone.** Around 8 percent of men and 0.5 percent of women have a colour vision
  deficiency; red and green are the common confusion, which is precisely the pair most products
  use for the most consequential distinction. Every status carries a word, and where space forbids
  a word, a distinct shape.
- **Do not exceed five families.** With fifteen ERD statuses, group into families and
  differentiate within a family by label. Fifteen hues is a legend nobody reads.
- **Terminal statuses look terminal.** A visual difference (muted fill, different border
  treatment) between "still moving" and "finished forever" saves more support calls than any
  other single status decision.
- **Test in greyscale.** Print or desaturate the screen: if two statuses become identical, the
  encoding has failed.

## Chart and categorical colour

- Categorical series need distinguishability under colour vision deficiency and in greyscale.
  Order `data-1` through `data-n` so that the first three or four are maximally separated, because
  most charts use three or four.
- Do not reuse status colours for categorical data in the same product; a green series next to a
  green status badge means two different things in one glance.
- Sequential data uses a single-hue ramp varying in lightness; diverging data uses two hues with a
  neutral midpoint, and the midpoint must be the domain's meaningful zero, not the data's mean.
- Never rely on a legend alone where direct labelling fits.

## Dark mode

Not an inversion. Specific rules:

- **Elevation flips.** In light mode, higher elevation casts a shadow. In dark mode, shadows are
  nearly invisible; higher surfaces get *lighter*. Carrying the light ramp across is why dark
  modes go flat.
- **Reduce chroma and avoid pure black.** Saturated colour on dark backgrounds vibrates. Use a
  dark neutral (roughly step 900 to 950, not #000) as `surface-base`, and desaturate accents.
- **Pure white text is too harsh.** `text-primary` at roughly 90 percent of white reads better
  over long sessions.
- **Re-verify every contrast pairing.** Contrast is not symmetric under inversion; a pairing that
  passed at 4.6:1 in light mode can fail in dark.
- **Semantic colours shift.** The light-mode negative red is often too dark to read on a dark
  surface; each status family needs its own dark-mode values.
- Respect `prefers-color-scheme` and let the user override it. Store the override.

## High contrast and forced colours

Windows High Contrast Mode and forced-colours modes replace the palette entirely. Anything
communicated by a background colour with no border disappears. Give status badges and selected
states a border, not just a fill, so they survive. Test one screen in forced-colours mode; it
finds problems nothing else does.

## Verification procedure

1. Build the role table with concrete values per theme.
2. Compute contrast for every text role against every surface role it can legally appear on. Fix
   the ramp step, not the individual instance.
3. Compute contrast for every control boundary and the focus ring against adjacent surfaces.
4. Desaturate a populated screen. Confirm nothing meaningful vanished.
5. Simulate deuteranopia and protanopia on a populated screen with statuses and a chart.
6. Repeat 2 through 5 for dark mode.
7. Record the verified table in `30-design-language/skills-md/color.md`, values included, so a
   reviewer can check a build against it rather than against an impression.
