# Digest: PRD2-07-bookVI-screen-by-screen.txt

> Produced by source-extractor on 2026-10-09. Not reviewed by a human.

| Field | Value |
|---|---|
| Source file | `00-inputs/PRD2-sections/07-bookVI-screen-by-screen.txt` |
| Type | anchor section (PRD2.pdf, Book VI) |
| Who gave it | user (project SME) |
| Date of the source | 2026-10-09 (supplied) |
| Size | PDF pp.244-277, 34 pages |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Anchor section: screen-level build plan, one entry per screen, seven waves, linkage spine.

## 2. Claims
Scope counts: counted 78 entries, matching the stated 78, in 13 module sections: Materials 10, Sales 8, Returns/Service 5, Engineering 6, CAD/Docs 4, Planning 5, Production 8, Quality 8, Purchasing 6, Costing/Pricing 8, Controlling 3, Traceability/Barcode 3, Workflow/Admin 4. "/2" entries are list+detail pairs; CO-R1..R4 is four reports. [DOC:p.244-276 §3-15] (asserted)

- Waves: W1 wks 1-4, W2 3-8, W3 6-12, W4 10-18, W5 14-20, W6 16-22, W7 20-26. [DOC:p.244 §1] (asserted)
- W1 (6 entries): controlling masters, account determination, number series, period control, tax, workflows, job console. W2 (10): materials, sales. W3 (10): engineering, documents. W4 (15): planning, production, trace explorer. W5 (12): quality, RMA, installed base, recall. W6 (20): procurement, costing, pricing, allocations. W7 (5): backorder, delivery cockpit, POD, completeness dashboard. QM-PLAN config W2, full W5; OPS-JOBS skeleton W1, hardened W7. [DOC:p.244-276 §2-15] (asserted)
- Complex, posting or scan heavy: PP-SFT-001 (SP-07, 08, 10, 11, 12; #28-30), OM-DLV-001 (#25-27, SP-18), OM-PACK (#27, SP-16/17), RMA-DISP (#18-23), RMA-RECEIPT (#17, SP-19), PP-SETTLE (#32), RWO-001 (#21, 22, 33), MM-EOR (DR 6320 CR 5340), CO-ALC (#36), PRC-SUR (#38), QM-EXEC (SP-05, 14), QM-FIN (SP-14). [DOC:p.248-276 §3-14] (asserted)
- Complex, structural: OM-SO-001/2, ENG-BOM-002 (three panes), ENG-ECR/ECO (atomic cutover), PP-WO-001/2, OM-LEAD (V-OM-40 to 42, E-OM-43). [DOC:p.249-262] (asserted)
- Simple, navigation or read only: ENG-HOME-001, QM-DASH-001, MM-DQ-001, TRC-DASH, PP-WIP-001, PRC-MARG, CO-R1..R4. [DOC:p.255-274] (asserted)
- Embedded rule specs: Lead §4.1, Spares Finder §5.1, Sales Kit BOM §6.1. [DOC:p.249-257] (asserted)
- Done means gate DG-3; each entry is one epic; referenced section wins on disagreement. [DOC:p.244, p.277] (asserted)
- Spine runs lead, quote, sales order, engineering request, EBOM, MBOM, PR/PO, production order, delivery, RMA, recall. [DOC:p.276-277 §16] (asserted)

## 3. New terms
"Arrives from"; "linkage spine"; "placeholder path".

## 4. Silences
- volume: no effort or field counts per entry.
- boundary: no team size behind the waves.
- authority: no owner named per wave.

## 5. Conflicts
- Brief says fifteen module sections; file shows 13. [DOC:p.244-275] (asserted)
- Wave table names count documents, safety stock, pricing service surfaces, close orchestration; no entries here. [DOC:p.244-245 §2] (asserted)
- "Every screen appears below" vs Book VII "Supplemental Screen Entries". [DOC:p.244, p.277] (asserted)

## 6. Open the source again when
- Reading one entry's actions, postings or scans.
- Checking an entry's exact wave.
- Re-reading the spine table (pp.276-277).
