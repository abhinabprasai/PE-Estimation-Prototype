# SEED (PROVISIONAL) - colour and the status sketch - pe-v2 (Phase 2A)

> **What this is.** Which colour does which job in the transformer ERP prototype, the measured
> contrast proving each text colour is readable, and a first sketch of how every record status
> looks. Each status gets a colour, an icon and a badge shape, so it reads correctly with no
> colour at all. It is for the prototype builder and the designer who takes over.
>
> **Where it stands.** Seed, 9 October 2026, first version. The status sketch is TENTATIVE: it
> groups 40 status meanings into 7 families from the tentative entity model, which nobody has
> corrected yet. The final map is written in Phase 2B from the corrected status lists.
>
> **What we need from you.** Nothing now. If a status family looks wrong, name its row (F1 to F7).

> **ASSUMPTIONS.** None of the register entries. The family grouping is open question OQ-18; the
> colour per family is OQ-25; the reading of the specification's "§11" colour pointer is OQ-26.

**PROVISIONAL: replace, do not merge.** Brand roles are replaced by the user's design language
(pending). The six status hues are the specification's and stay. The family-to-colour pairing is
this seed's and is redone in 2B.

**Precedence.** `a11y.md` overrides this file. Values are typed once, in `tokens.md` section 6;
this file names roles and proves contrast. `shared-specs/EngineeringSpec.md` wins on code.

## 1. Specification palette

Brand: PE Blue #1F3864 (headers, primary), PE Accent #2E5FA3 (links, section heads), Light
#EDF1F8 (fills), Mid #D9E2F3 (table heads) [DOC:p.241 §10.1] (asserted). Status: Draft/neutral
gray #6B7280, In progress/review amber #B58221, Blocked/error red #A33B3B, Active/passed green
#3E7D4E, Info/released blue #2E5FA3, Terminal dark green #1F5F3F, "used consistently across every
lifecycle" [DOC:p.241 §10.1] (asserted). The lifecycle tables also use yellow, purple, teal and
dark red: that clash is **K-13** in STATE.md, recorded and not resolved here. This seed uses only
the six named hues; yellow, purple, teal and dark red appear nowhere in it.

## 2. Roles

| Role token | Light | Dark | Job |
|---|---|---|---|
| *`--primary`* | *#1F3864* | *#9DB4E0* | *The one filled button per view, entity context bar* |
| `--link` | #2E5FA3 | #7FA6E0 | Links and section heads; always underlined on hover and focus |
| `--muted` / `--accent` | #EDF1F8 | #262626 | Fills, hover rows, selected row |
| `--table-head` | #D9E2F3 | #1F2A3D | Table header row background |
| `--destructive` | #A33B3B | #B33A3A | Destructive buttons only, never decoration |
| `--status-passed` | #3E7D4E | #6FBF83 | Passed results (inspection, scan success); not a status family |

## 3. Verified contrast table

Measured with the WCAG 2.x relative-luminance formula on the hex values in `tokens.md`. Text needs
4.5:1; icons and control boundaries need 3:1.

| Foreground | Background | Ratio | Need | Result |
|---|---|---|---|---|
| *#FFFFFF on `--primary` #1F3864* | *button* | *11.62* | *4.5* | *pass* |
| #FFFFFF on primary hover #354C74 (`/90`) | button hover | 8.62 | 4.5 | pass |
| #FFFFFF on `--destructive` #A33B3B / hover #AC4F4F | button | 6.47 / 5.27 | 4.5 | pass |
| `--primary` #1F3864 on `--accent` #EDF1F8 | ghost hover | 10.25 | 4.5 | pass |
| `--muted-foreground` #5B6270 on white / #EDF1F8 / #D9E2F3 | text | 6.13 / 5.41 / 4.71 | 4.5 | pass |
| `--link` #2E5FA3 on white / #EDF1F8 | link | 6.40 / 5.65 | 4.5 | pass |
| `--input` #8A8F98 on white | control edge | 3.25 | 3.0 | pass |
| `--ring` #2E5FA3 on white | focus ring | 6.40 | 3.0 | pass |
| Dark: #0A0A0A on `--primary` #9DB4E0 / hover #8EA3CB | button | 9.46 / 7.78 | 4.5 | pass |
| Dark: #FFFFFF on `--destructive` #B33A3A / hover #A23535 | button | 5.86 / 6.78 | 4.5 | pass |
| Dark: `--muted-foreground` #A1A1A1 on #171717 / #262626 | text | 6.94 / 5.86 | 4.5 | pass |
| Dark: `--input` #6B7280 on #0A0A0A | control edge | 4.10 | 3.0 | pass |
| Specification amber #B58221 as text on white | text | 3.40 | 4.5 | **fail: never used as text** |
| Specification gray #6B7280 / green #3E7D4E on their 12% tints | text | 4.16 / 4.23 | 4.5 | **fail: ink tokens used instead** |
| shadcn default `--muted-foreground` #737373 on #EDF1F8 | text | 4.19 | 4.5 | **fail: replaced** |

Status badge proofs are in the sketch table below (column "Text ratio").

**Rule C-1.** The six specification status hues are used as fills, borders and tints only. Badge
text and icons use the family's `-ink` token. Example: amber #B58221 text on a white page is a
violation (3.40:1).

## 4. TENTATIVE status sketch (7 families, shadcn Badge)

Families and their member meanings: `40-models/_tentative/status-encoding-input.md` (F1 to F7).
Each family gets three channels besides colour: the status word itself, an icon (lucide-react,
shipped with shadcn), and a fill style.

| Family | Fill style | Hue / ink / tint tokens | Icon | Text ratio light / dark | Example label |
|---|---|---|---|---|---|
| *F1 Draft* | *outline: 1 px border, white fill* | *`draft` gray, ink #4B5563* | *`PencilLine`* | *7.56 / 7.80* | *Draft (material) [DOC:p.149] (asserted)* |
| F2 Pending approval | subtle: tint fill, no border | `pending` amber, ink #7A5410, tint #F6F0E4 | `Clock` | 5.96 / 7.59 | In Review (EBOM) [DOC:p.61] (asserted) |
| F3 Active or in progress | subtle: tint fill, no border | `active` blue, ink #24508C, tint #E6ECF4 | `CircleDot` | 6.79 / 6.35 | Released (work order) [DOC:p.74] (asserted) |
| F4 Blocked or on hold | solid: hue fill | `blocked` red, ink #FFFFFF | `OctagonPause` | 6.47 / 7.64 | Credit Hold (sales order) [DOC:p.54] (asserted) |
| F5 Done | solid: hue fill | `done` dark green, ink #FFFFFF | `CircleCheck` | 7.59 / 7.30 | Invoiced / Closed (sales order) [DOC:p.54] (asserted) |
| F6 Cancelled or rejected | outline: 1 px border, white fill | `cancelled` red, ink #8A2E2E | `CircleX` | 8.36 / 7.64 | Cancelled (work order) [DOC:p.75] (asserted) |
| F7 Exception | solid: hue fill | `exception` amber, ink #1C1917 | `TriangleAlert` | 5.15 / 9.89 | Exception (POD) [DOC:p.207] (asserted) |

Light ratios are ink on tint (subtle), ink on white (outline) or ink on hue (solid). Dark ratios
are the `.dark` ink on its tint, on #0A0A0A, or #0A0A0A on the hue.

Why blue for F3 and not the specification's "Active" green: F3 (active) and F5 (done, dark green)
would then differ only in lightness, which fails at kiosk distance. Green stays for passed results.
This is a divergence from the specification's label, carried as OQ-25 and related to K-13.

**Greyscale check.** In greyscale F4 red and F5 dark green solids are near-identical (luminance
0.112 and 0.088). They stay distinct by icon (`OctagonPause` vs `CircleCheck`) and by the status
word. Every pair of families differs in at least two of: status word, icon, fill style.

**Rule C-2.** A badge always shows icon plus the status word, both. Icon-only or colour-only
status is a violation, at every density.

**Rule C-3.** The badge text is the record's own status name, verbatim from the entity model's
status list (`erd-sketch.md` S-1 to S-43). A status word not on that record's list is a violation.

**Rule C-4.** Family is chosen per record type and status pair, never per word. "Closed" on a
handling unit (contents locked, still moving) is F3; "Closed" on a CAPA is F5
[DOC:p.31; p.88] (asserted).

**Rule C-5.** Markers that sit beside the main status render as a separate small chip, never
replacing the badge: function blocks (Purchasing Block and the rest, [DOC:p.151 §4.5]
(asserted)) use the F4 outline with `Ban`; Change Pending uses the F2 outline with `FilePen`
[DOC:p.104] (asserted); count line flags and the Shortage badge use the F7 outline with
`TriangleAlert` [DOC:p.36; p.74] (asserted).

shadcn implementation: extend `badgeVariants` (cva) with one variant per family named
`draft`, `pending`, `active`, `blocked`, `done`, `cancelled`, `exception`, each using the tokens
above; the component takes the status word as children and the icon as a required prop.

## 5. Scan feedback and banners

Success is a single beep plus a green flash of the scanned row; failure is a double low beep plus
a red banner naming what was scanned, what was expected, the E-code and the next action
[DOC:p.241 §8.4] (asserted). Offline shows a persistent amber banner with queue depth
[DOC:p.241 §8.4] (asserted).

| Surface | Background | Text | Ratio | Extra channel |
|---|---|---|---|---|
| *Scan success row* | *`--scan-success-bg` #DCE8DF* | *#0A0A0A* | *15.70* | *`Check` icon, "Scanned" text, beep* |
| Scan failure banner | `--destructive` #A33B3B | #FFFFFF | 6.47 | `TriangleAlert`, written reason, double beep |
| Offline banner | `--offline-banner-bg` #F2E9D7 | ink #7A5410 | 5.61 | `WifiOff`, "Offline: n scans queued" |

---

**Key.**
`[DOC:p.n §x]` the client's own specification, with page and section ·
`(asserted)` written down once by the client, not yet verified by the domain authority ·
**K-nn** a row in `STATE.md > Open contradictions` · **OQ-nn** a row in
`10-discovery/open-questions.md` · **F1 to F7** status families in `status-encoding-input.md`.
**TENTATIVE** a sketch meant to be corrected · **SEED** a Phase 2A file, rewritten in Phase 2B ·
**PROVISIONAL** placeholder visuals, replaced (not merged) when the user's design language arrives.
