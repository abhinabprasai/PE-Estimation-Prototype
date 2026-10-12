# SEED (PROVISIONAL) - tokens - pe-v2 (Phase 2A)

> **What this is.** The measurements every screen of the transformer ERP prototype is built from:
> spacing, corner rounding, borders, shadows and the three density modes, plus one block of CSS
> variables a developer pastes into the shadcn/ui `globals.css`. It is for whoever builds the
> throwaway prototype and for the designer who replaces it later.
>
> **Where it stands.** Seed, 9 October 2026, first version. Built on shadcn/ui defaults plus the
> specification's own design system starter where it gives a value. Nothing visual is final.
>
> **What we need from you.** Nothing now. When your earlier prototype repo arrives, its design
> language replaces this file.

**PROVISIONAL: replace, do not merge.** When the user's design-language repo arrives, this file
is rewritten from it; only rows tagged `[DOC]` (the specification's own values) carry over.

**Precedence.** `a11y.md` overrides this file. Every other file references it and none
contradicts it. `shared-specs/EngineeringSpec.md` wins on code structure and framework.

**Inheritance.** `shared-specs/design-system.md` is an unfilled template, so nothing was inherited.
Base: shadcn/ui (React, Tailwind CSS v4, Radix), per PROJECT_CONFIG's delivery stack note.

## 1. Spacing

The specification sets an 8 px grid [DOC:p.241 §10.1] (asserted).

| Token | px | Tailwind step | Use |
|---|---|---|---|
| *space-2* | *16* | *`p-4`, `gap-4`* | *Card padding, gap between form fields* |
| space-0.5 | 4 | `1` | Half step: icon-to-label gap, badge inner padding only |
| space-1 | 8 | `2` | Table cell horizontal padding (dense), chip gaps |
| space-1.5 | 12 | `3` | Table cell horizontal padding (comfortable) |
| space-2 | 16 | `4` | Card padding, field gap, kiosk minimum gap between targets |
| space-3 | 24 | `6` | Section gap inside a page, page gutter (office) |
| space-4 | 32 | `8` | Gap between page sections, page gutter (kiosk) |
| space-6 | 48 | `12` | Kiosk target height (see section 5) |
| space-8 | 64 | `16` | Kiosk primary scan action height |

**Rule T-1.** Spacing uses only the Tailwind steps `1, 2, 3, 4, 6, 8, 12, 16`, and step `1` only
inside a badge or between an icon and its label. Any other step, or an arbitrary value like
`p-[13px]`, is a violation. Example: `gap-5` on a form is a violation; use `gap-4`.

## 2. Radius

The specification sets 6 px on cards and badges [DOC:p.241 §10.1] (asserted).

| Token | Value | Applies to |
|---|---|---|
| *`--radius` (Tailwind `rounded-lg`)* | *6 px* | *Card, Badge, Dialog, Sheet, Popover* |
| `rounded-md` | 4 px | Button, Input, Select, Textarea, Checkbox, Tabs trigger |
| `rounded-full` | pill | Switch, Avatar, Progress only |

**Rule T-2.** Three radii only. shadcn's Card ships with `rounded-xl` and Badge with `rounded-md`
in some versions: both are overridden to `rounded-lg` (6 px). A card at 10 px is a violation.

## 3. Borders

| Token | Weight | Contrast vs background | Use |
|---|---|---|---|
| *`--input`* | *1 px* | *3.25:1 on white* | *Every form control boundary (Input, Select, Checkbox, Textarea)* |
| `--border` | 1 px | decorative | Card edges, table row dividers, separators |
| `--ring` | 2 px, 2 px offset | 6.40:1 on white | Keyboard focus only |

**Rule T-3.** Two weights: 1 px and 2 px (focus). shadcn's default `--input` (#E5E5E5, 1.26:1)
fails the 3:1 control-boundary rule in `a11y.md`, so this seed raises it. Divergence from shadcn,
recorded in section 7.

## 4. Elevation

The specification: flat lists; a single shadow level, for dialogs and the scan feedback flash
[DOC:p.241 §10.1] (asserted).

| Level | Tailwind | Applies to |
|---|---|---|
| *0* | *`shadow-none`* | *Card, table, list, page sections* |
| 1 | `shadow-lg` | Dialog, AlertDialog, Sheet, Popover, DropdownMenu, Select content, scan feedback flash |

**Rule T-4.** shadcn's Card `shadow-sm` is removed. Any shadow on a card, row or list is a violation.

## 5. Density modes

The domain reason for each mode is in `layout.md` section 2. Values:

| Value | office-dense | office-comfortable | floor-touch |
|---|---|---|---|
| *Table row height* | *32 px `h-8`* | *40 px `h-10`* | *56 px `h-14`* |
| Control height (button, input, select) | 32 px `h-8` | 36 px `h-9` (shadcn default) | 48 px `h-12` minimum |
| Primary action on a scan screen | n/a | n/a | 64 px `h-16`, full width |
| Body / grid text | 13 px | 14 px | 16 px |
| Cell horizontal padding | 8 px | 12 px | 16 px |
| Icon size | 16 px | 16 px | 24 px |
| Minimum gap between two targets | 4 px | 8 px | 16 px |
| Page gutter | 24 px | 24 px | 32 px |

Table rows 32 px dense and 40 px comfortable [DOC:p.241 §10.1] (asserted); grid text 13-14 px
[DOC:p.241 §10.1] (asserted); kiosk base 16 px and 48 px minimum touch targets [DOC:p.241 §8.4]
(asserted). The 56 px row, 64 px scan action and 16 px gap are this seed's design values.

**Rule T-5.** No interactive element is smaller than its mode's control height, and none, in any
mode, is below 24 x 24 px (44 x 44 on touch). Example: a 32 px icon button in a floor-touch row
is a violation.

## 6. globals.css block (paste into the prototype)

Tailwind v4 shadcn format, hex values. Roles and contrast proof: `color.md`. Values are typed here only.

```css
:root {
  --radius: 0.375rem;                 /* 6 px: cards and badges */
  --background: #FFFFFF; --foreground: #0A0A0A; --card: #FFFFFF; --card-foreground: #0A0A0A;
  --popover: #FFFFFF; --popover-foreground: #0A0A0A;
  --primary: #1F3864;     --primary-foreground: #FFFFFF;   /* PE Blue */
  --secondary: #EDF1F8;   --secondary-foreground: #1F3864; /* PE Light */
  --muted: #EDF1F8;       --muted-foreground: #5B6270;
  --accent: #EDF1F8;      --accent-foreground: #1F3864;
  --destructive: #A33B3B;                                   /* white text on it */
  --border: #E5E5E5;      --input: #8A8F98;   --ring: #2E5FA3;
  --link: #2E5FA3;        --table-head: #D9E2F3;            /* PE Accent, PE Mid */
  /* status: hue = fill/border, ink = text+icon, tint = subtle badge background */
  --status-draft: #6B7280;     --status-draft-ink: #4B5563;     --status-draft-tint: #EDEEF0;
  --status-pending: #B58221;   --status-pending-ink: #7A5410;   --status-pending-tint: #F6F0E4;
  --status-active: #2E5FA3;    --status-active-ink: #24508C;    --status-active-tint: #E6ECF4;
  --status-blocked: #A33B3B; --status-blocked-ink: #FFFFFF; --status-done: #1F5F3F; --status-done-ink: #FFFFFF;
  --status-cancelled: #A33B3B; --status-cancelled-ink: #8A2E2E;
  --status-exception: #B58221; --status-exception-ink: #1C1917;
  --status-passed: #3E7D4E;    --status-passed-ink: #2F6A3F;    --status-passed-tint: #E8EFEA;
  --scan-success-bg: #DCE8DF;  --offline-banner-bg: #F2E9D7;
}
.dark {
  --background: #0A0A0A; --foreground: #FAFAFA; --card: #171717; --card-foreground: #FAFAFA;
  --popover: #171717; --popover-foreground: #FAFAFA;
  --primary: #9DB4E0;     --primary-foreground: #0A0A0A;
  --secondary: #262626; --secondary-foreground: #FAFAFA; --accent: #262626; --accent-foreground: #FAFAFA;
  --muted: #262626; --muted-foreground: #A1A1A1;
  --destructive: #B33A3A;
  --border: #2A2A2A;      --input: #6B7280;   --ring: #7FA6E0;
  --link: #7FA6E0;        --table-head: #1F2A3D;
  --status-draft: #9CA3AF;     --status-draft-ink: #9CA3AF;     --status-draft-tint: #212224;
  --status-pending: #E0B050;   --status-pending-ink: #E0B050;   --status-pending-tint: #2C2515;
  --status-active: #7FA6E0;    --status-active-ink: #7FA6E0;    --status-active-tint: #1D232C;
  --status-blocked: #F08080; --status-blocked-ink: #0A0A0A; --status-done: #4FAF7A; --status-done-ink: #0A0A0A;
  --status-cancelled: #F08080; --status-cancelled-ink: #F08080;
  --status-exception: #E0B050; --status-exception-ink: #0A0A0A;
  --status-passed: #6FBF83;    --status-passed-ink: #6FBF83;    --status-passed-tint: #1A271D;
  --scan-success-bg: #1E2E22;  --offline-banner-bg: #312817;
}
/* also add to the existing @theme inline block: */
@theme inline {
  --color-link: var(--link); --color-table-head: var(--table-head);
  --color-status-draft: var(--status-draft); /* ...one line per --status-* token above */
}
```

Chart and sidebar variables keep shadcn defaults in the seed; they are 2B work.
## 7. Divergences from shadcn/ui defaults

| Token | shadcn default | This seed | Why |
|---|---|---|---|
| *`--input`* | *#E5E5E5* | *#8A8F98* | *Default fails 3:1 for control boundaries (`a11y.md` A-6)* |
| `--radius` | 0.625 rem | 0.375 rem | Specification sets 6 px [DOC:p.241 §10.1] (asserted) |
| `--primary` | near-black | #1F3864 | Specification's PE Blue for headers and primary [DOC:p.241 §10.1] (asserted) |
| `--muted-foreground` | #737373 | #5B6270 | Default is 4.19:1 on PE Light #EDF1F8; fails 4.5:1 |
| Card shadow | `shadow-sm` | none | Flat lists [DOC:p.241 §10.1] (asserted) |

---

**Key.**
`[DOC:p.n §x]` the client's own specification, with page and section ·
`(asserted)` written down once by the client, not yet verified by the domain authority.
**SEED** a Phase 2A file, rewritten in Phase 2B against the corrected entity model ·
**PROVISIONAL** placeholder visuals, replaced (not merged) when the user's design language arrives.
