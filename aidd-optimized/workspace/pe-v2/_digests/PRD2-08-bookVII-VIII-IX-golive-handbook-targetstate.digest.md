# Digest: PRD2-08-bookVII-VIII-IX-golive-handbook-targetstate.txt

| Field | Value |
|---|---|
| Source file | `workspace/pe-v2/00-inputs/PRD2-sections/08-bookVII-VIII-IX-golive-handbook-targetstate.txt` |
| Type | anchor section (PRD2.pdf, Enterprise ERP Unified Build Specification V1.0) |
| Who gave it | the user (project SME) |
| Date of the source | supplied 2026-10-09; document dated Jul 2026 |
| Size | PDF pp.278-312 (35 pages) |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is

Books VII (go-live supplement), VIII (design handbook), IX (target-state modules) of the anchor document.

## 2. Claims

**Scope counts:** supplemental screens 6; archetypes 8; label types 10 (9 figures); migration objects 10 (14 sheets); target-state modules 9 in Book IX, 10 in Book VIII.

- Six screens get own entries (Book VI has 78): INV-RETURN (redirect, ships no screen), INV-ITEM-SALES, INV-COUNT-DOC, INV-PLAN-SAFETY, INV-CONFIG-PERIOD, INV-CONFIG-TAX; waves 5,2,2,2,1,1. `[DOC:p.279-282 §3]` (asserted)
- Nine gap-register items map to Book I Part A sections. `[DOC:p.278 §2]` (asserted)
- Multi-plant screens (plant master, lanes, STO) build in wave 4; network engine activates only when DEC-07 fires; single plant until then. `[DOC:p.282 §4]` (asserted)
- Manifest: 7 controlled items. `[DOC:p.284 §5]` (asserted)
- Workbook: ReadMe, 10 mapping sheets (materials, customers, vendors, BOMs, routings, info records/AVL, stock with batches/serials, open SOs, POs, production orders), 24 cleansing rules, 12 OB rules, 12 scripts R-01..R-12; two mock conversions mandatory. `[DOC:p.284-285 §6]` (asserted)
- Labels: item shelf, batch, serial component, location, traveler strip, handling unit, RMA return, operator badge, calibration, nameplate. `[DOC:p.285-286 §7]` (asserted)
- Go-live gate: Book III H §7 plus Book IV additions; deferred capabilities sit in Book IV §1.2; each has an activation path. `[DOC:p.288 §8]` (asserted)
- Archetypes: List (~18 screens), Detail (~20), Workbench (~12), Wizard, Kiosk, Dashboard (six landing pages), Config, Dialog; nine states per screen; five BPMN flows; DG-2 gate. `[DOC:p.289-293 §1-2]` (asserted)
- Phasing: ten capabilities are "phased beyond first go live"; none is go-live scope. Book IX: each activates only when evidence passes under change control; no dates or phase numbers stated; timing stays with the decision register. `[DOC:p.289 §6; p.304]` (asserted)
- Book IX nine: periodic costing/material ledger, scheduling optimizer, global ATP/CTP, portals, full EDI, machine/OEE, field service, maintenance/EAM, localization; Book VIII adds advanced warehousing (EWM). `[DOC:p.300-312]` (asserted)
- Evidence: parallel quarter; 50 cross-plant promises; 2 suppliers plus 1 customer; 3-month EDI parallel run; ten field orders. `[DOC:p.300-312]` (asserted)
- Package: 10 deliverables, seven build waves, five workstreams, gates DG-1/2/3. `[DOC:p.302 §8]` (asserted)

## 3. New terms

"Build wave", "DG-1/2/3", "DEC-07", "archetype", "closure flow" (all used as document-defined).

## 4. Silences

- authority/volume: no effort, cost or dates for any Book IX module.
- boundary: no go-live versus phase assignment per module beyond "deferred".
- boundary: Book IX screen counts per module not totalled.

## 5. Conflicts

| This source says | Tag | Other | Tag | Where |
|---|---|---|---|---|
| Book VIII: "ten" target capabilities | `[DOC:p.289]` | Book IX: "nine" | `[DOC:p.304]` | internal |
| Workbook is manifest row 7 | `[DOC:p.284]` | workbook is row 4 | `[DOC:p.284]` | internal |
| Nine label samples; "remaining seven" | `[DOC:p.285]` | ten labels listed | `[DOC:p.285-286]` | internal |

## 6. Open the source again when

- You need Book IX per-module screen lists (pp.305-312) for sizing.
- You need the full seven-row manifest or R-script list (pp.284-285).

