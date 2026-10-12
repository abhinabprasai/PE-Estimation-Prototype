# SEED (PROVISIONAL) - layout and density - pe-v2 (Phase 2A)

> **What this is.** This file decides how tightly each kind of screen is packed. Office staff at
> desks get dense tables. Operators at shop-floor kiosks and handhelds get large touch targets for
> gloved hands. It also sets the page skeleton for each of the specification's eight screen types.
> It is for the prototype builder and for whoever writes the prototype prompt.
>
> **Where it stands.** Seed, 9 October 2026, first version. The density split is decided. Widths
> and skeletons are placeholders until the user's design language arrives.
>
> **What we need from you.** Nothing now. If a role below sits on the wrong device, name the role.

> **ASSUMPTIONS.** ASM-DEVICE-1 (which role uses which device; the device list is the
> specification's, the role-to-device pairing is our reading, see OQ-27).

**PROVISIONAL: replace, do not merge.** Widths, gutters and skeletons are replaced by the user's
design language. The density split (section 2) is a domain decision and survives the replacement.

**Precedence.** `a11y.md` overrides this file. Values come from `tokens.md`; this file never
states a value `tokens.md` lacks. `shared-specs/EngineeringSpec.md` wins on code structure.

## 1. The two environments

| Environment | Device (specification) | Source |
|---|---|---|
| *Shop floor, fixed* | *15.6 in touch kiosk, fanless, sealed front; badge-scan login; kiosk browser; 15 units* | *[DOC:p.238 §8.2] (asserted)* |
| Shop floor, fixed | Kiosk screen is full-screen at 1280 x 800, gloves-on targets, scanner-first, used standing | [DOC:p.234 §7.6] (asserted) |
| Warehouse, mobile | Zebra TC77, 4.7 in, runs the responsive web app; RS5100 ring scanner, glove-friendly | [DOC:p.238 §8.2] (asserted) |
| Floor rules | Targets at least 48 px, 16 px base font, test with gloves at arm's length | [DOC:p.241 §8.4] (asserted) |
| Office | Desktop browser for sales, engineering, purchasing, planning, costing, finance, admin | ASM-DEVICE-1 |

## 2. Density decision

The three modes and their values are in `tokens.md` section 5.

| Screen type | Mode | Domain reason |
|---|---|---|
| *List (filterable register), about 18 screens* | *office-dense, user may switch to office-comfortable* | *Office users scan many rows; dense 32 px rows with a comfortable 40 px option are the specification's own table rule [DOC:p.241 §10.1] (asserted)* |
| Workbench (act-on-many queue), about 12 | office-dense, switchable | Same table rule; queues are worked row by row [DOC:p.231 §7; p.241 §10.1] (asserted) |
| Dashboard (six landing pages) | office-comfortable | Read at a glance; worklist cards, not long grids [DOC:p.242 §10.2] (asserted) |
| Detail (tabbed record), about 20 | office-comfortable; its line tables office-dense | Forms are filled field by field; the line tables follow the table rule |
| Wizard (guided steps) | office-comfortable | Step-by-step data entry, no grid scanning |
| Config (admin) | office-dense | Admin tables of codes and settings |
| Dialog | inherits the mode of the screen that opened it | A dialog never changes density under the user |
| Kiosk (touch + scanner) | floor-touch, always | Gloved operators, standing, at arm's length [DOC:p.234 §7.6; p.241 §8.4] (asserted) |
| Any screen run on a TC77 handheld | floor-touch, always | Same gloves and scanner use, smaller screen [DOC:p.238 §8.2] (asserted) |

Screen-type counts are the specification's [DOC:pp.289-293 §1-2] (asserted). Kiosk screens it
names include the Shop Floor Terminal PP-SFT-001 [DOC:p.234 §7.6] (asserted), the Pack Station
OM-PACK-STATION-001 [DOC:p.231 §7.1] (asserted) and Return Receipt [DOC:p.236] (asserted).

**Rule L-1.** A screen's mode is set by its screen type in this table, never by its module.
Example: a Production List screen used by a scheduler at a desk is office-dense; the Shop Floor
Terminal in the same module is floor-touch.

**Rule L-2.** floor-touch never switches to a denser mode, by user choice or to fit content. If
content does not fit, it pages or scrolls. A kiosk table at 40 px rows is a violation.

**Rule L-3.** The office density switch is a per-user setting on List, Workbench and Config
screens, remembered across sessions, and labelled "Compact rows" / "Comfortable rows".

## 3. Page skeleton: office

| Region | Rule |
|---|---|
| *Entity context bar* | *Top of every screen [DOC:p.242 §10.2] (asserted); 48 px tall, `bg-primary` text `primary-foreground`* |
| Navigation | shadcn Sidebar, 256 px open, 48 px collapsed (icons with tooltips and visible focus) |
| Content | Fluid, gutter 24 px; Detail screens cap the form column at 960 px, tables run full width |
| Detail header | Record name (`title`), status badge and lifecycle strip [DOC:p.242 §10.2] (asserted), primary action at the right |
| Side panels | Audit trail and attachments as a right Sheet or a tab, never a third fixed column under 1280 px |

**Rule L-4.** One filled primary button per view (`variant="default"`); every other action is
`outline`, `ghost` or in a menu. Two filled primary buttons on one view is a violation.

## 4. Page skeleton: floor-touch

| Region | Rule |
|---|---|
| *Header* | *64 px: operator name from badge login, work center, offline indicator; no navigation menu* |
| Scan field | Always focused on load and after every scan; full width; 64 px tall |
| Task area | One task at a time; the next expected scan is stated in words |
| Action bar | Bottom of the screen, full-width buttons, 64 px primary, 48 px secondary |
| Banners | Scan failure and offline banners sit directly under the header and push content down; they never overlay the scan field |

Kiosk layout is fixed at 1280 x 800 [DOC:p.234 §7.6] (asserted). TC77 layout is a single column;
the action bar stays at the bottom within thumb reach.

**Rule L-5.** No floor-touch screen needs hover, drag, a right-click or a keyboard shortcut to
finish a task. Menus are for exceptions; one scan, one action [DOC:p.241 §8.4] (asserted).

**Rule L-6.** Kiosk screens render in the light theme only. Dark theme is offered on office
screens only.

## 5. Not in the seed

Breakpoints, order of collapse and dense-data strategies are Phase 2B (`responsive.md`).

---

**Key.**
`[DOC:p.n §x]` the client's own specification, with page and section ·
`(asserted)` written down once by the client, not yet verified by the domain authority ·
**ASM-ID** a numbered assumption in `00-inputs/assumptions.md` ·
**OQ-nn** a numbered open question in `10-discovery/open-questions.md`.
**SEED** a Phase 2A file, rewritten in Phase 2B ·
**PROVISIONAL** placeholder visuals, replaced (not merged) when the user's design language arrives.
