# Motion Tokens

Motion is specified by naming tokens, never by describing feel. "Slides in nicely" is not
implementable; `motion-medium` with `ease-decelerate` is.

## Duration

| Token | ms | Use |
|---|---|---|
| `motion-instant` | 0 to 50 | State changes that should feel like nothing happened between them |
| `motion-fast` | 100 to 150 | Hover, focus, small toggles, icon swaps, tooltip appear |
| `motion-medium` | 200 to 250 | Dropdowns, popovers, accordions, tab content, inline expand |
| `motion-slow` | 300 to 400 | Modals, drawers, page-level transitions, large surface moves |
| `motion-deliberate` | 500 to 700 | Only where the user should notice something arrived without acting: an alert entering, a background completion surfacing |

Above 400ms an interface starts to feel slow no matter how pleasant the curve. The exception is
motion the user did not initiate, where a slower entrance is a courtesy that gives them time to
look up.

Scale duration with distance and size. A 40px dropdown and a full-screen drawer using the same
duration means one of them is wrong: the small one drags or the large one snaps.

## Easing

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | cubic-bezier(0.4, 0.0, 0.2, 1) | Movement within the viewport, both ends visible. The default |
| `ease-decelerate` | cubic-bezier(0.0, 0.0, 0.2, 1) | Entering: fast start, gentle settle. Things arriving |
| `ease-accelerate` | cubic-bezier(0.4, 0.0, 1, 1) | Exiting: gentle start, fast departure. Things leaving |
| `ease-emphasized` | cubic-bezier(0.2, 0.0, 0, 1) | Large, important transitions that should feel considered |
| `linear` | linear | Progress indicators, spinners, anything continuous. Never for movement |

Exit is roughly 30 percent faster than entry, in every pairing. Nobody wants to watch a dialog
leave, and a symmetrical dismissal feels sluggish even when the entrance felt right.

Springs are an alternative to bezier curves and are appropriate for direct-manipulation gestures
(drag, swipe) where the motion should carry momentum. For state transitions in application UI,
bezier curves are more predictable and easier to specify. If springs are used, specify stiffness
and damping, not "bouncy".

## What may animate

| Property | Verdict |
|---|---|
| `opacity` | Yes. Compositor-only, cheap |
| `transform` (translate, scale, rotate) | Yes. Compositor-only, cheap |
| `filter`, `backdrop-filter` | Sparingly. Expensive on low-end hardware, which is what internal tools run on |
| `width`, `height`, `top`, `left`, `margin`, `padding` | No. Layout properties force reflow every frame and jank |
| `color`, `background-color`, `border-color` | Yes for short durations. Paint-only, acceptable at `motion-fast` |
| `box-shadow` | Avoid animating directly; animate the opacity of a shadow pseudo-element instead |

Height animation for accordions is the common exception people reach for. Prefer a transform or
a grid-template-rows technique; if height must animate, keep it under `motion-medium` and accept
it will not be smooth on weak hardware.

## Choreography

When several things move at once:

- **Stagger sparingly.** 20 to 40ms between items, and only for the first six or so. A staggered
  list of forty rows means the last row arrives half a second late, every time the user filters.
- **One focal point.** If three regions animate simultaneously, the eye has nowhere to go and the
  motion has communicated nothing.
- **Continuity over appearance.** If an element persists across a transition, move it rather than
  fading one out and another in. The user tracks the object and understands the change.
- **Enter and exit are not the same choreography.** Content that expands downward collapses
  upward; a panel entering from the right leaves to the right.

## Loading motion

| Case | Treatment |
|---|---|
| Skeleton | A slow shimmer, 1.2 to 1.8s per cycle, low contrast. Fast shimmer reads as alarm |
| Indeterminate bar | Continuous, `linear`, roughly 1.5 to 2s per traverse |
| Spinner | 0.6 to 1s per rotation, `linear`. Faster reads as panic, slower reads as stuck |
| Progress bar | Value-driven only. Never animate a fake advance, and never sit at 90 percent |
| Optimistic pending | A static pending treatment beats an animated one. The row is not loading, it is provisional |

## Reduced motion

`prefers-reduced-motion: reduce` means vestibular safety, not the absence of feedback. The
mapping:

| Normal | Reduced |
|---|---|
| Slide, scale, or move | Cross-fade at `motion-fast`, or an instant change |
| Parallax, auto-playing background motion | Removed entirely |
| Staggered entry | All at once |
| Looping decorative animation | Static |
| Progress and loading indicators | Kept. These convey system state and removing them removes information |
| Attention-directing motion (an alert arriving) | Kept as an instant appearance plus a static emphasis treatment |

The test: with reduced motion on, is any information lost? If yes, that information was encoded
in motion alone, which was already a defect.

## Hard limits

- Nothing flashes more than three times per second (WCAG 2.3.1). This is a seizure risk.
- Any motion that starts automatically, lasts more than five seconds, and runs alongside other
  content needs a pause, stop, or hide control (WCAG 2.2.2).
- No motion blocks input. The user can always click through or past a transition; a 400ms
  animation that swallows a click is a 400ms freeze from the user's point of view.
- Transitions must be interruptible. A user who toggles twice quickly gets the second state, not
  a queue.
