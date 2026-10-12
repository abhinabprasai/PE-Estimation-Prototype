# Digest: PRD2-03-bookI-barcode-proc-ctrl-cost-datamodel.txt

| Field | Value |
|---|---|
| Source file | `00-inputs/PRD2-sections/03-bookI-barcode-proc-ctrl-cost-datamodel.txt` |
| Type | anchor section (PRD2.pdf, Book I, PDF pp.92-133) |
| Who gave it | User (project SME) |
| Date of the source | 2026-10-09 |
| Size | 42 pages / 53 KB |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Book I of the ERP build spec V1.0: barcoding, procurement, controlling, costing/pricing, postings, data model, roadmap, NFRs, sign-off.

## 2. Claims
Scope counts: screens 17 with IDs (volume claims 75+); entities ~22 rows; workflows not stated (18 status lifecycles volume-wide); interfaces 13 matrix rows, no IF-xx; reports 8 (CO-R1..R4 plus 4 margin) plus traceability and vendor scorecard; FL-xx not stated; scan points 21.
1. SP-01..SP-21 scan matrix; Code128 internal; offline queue 4 h; telemetry 24 months; reprint needs reason. [DOC:p.93-97 F] (asserted)
2. Genealogy tables: genealogy_event, serial_link, batch_consumption; trace tree <10 s, 5 levels. [DOC:p.98 F5] (asserted)
3. PO approval: Buyer ≤$25k, Manager ≤$250k, +Controller above, +CFO >$1M; RFQ if >$25k uncontracted; unconfirmed PO surfaces after 3 business days; price deviation >5% flags. [DOC:p.100,104 G] (asserted)
4. Screens PUR-VEND-001/002, PUR-PR-001, PUR-PO-001/002, PUR-EXP-001; subcontract PO; PO statuses (9), PR statuses (6), vendor onboarding (4), RFQ (4). [DOC:p.101-107 G] (asserted)
5. Cost/profit centers: CO-CC-001/002, CO-PC-001/002, 7 derivation rules; seed CC-1000..9000, PC-100..400, PC-900. [DOC:p.109-112 H] (asserted)
6. Allocation CO-ALC-001/002, CO-SKF-001; six drivers; run ID ALC-YYYYMM-NN. [DOC:p.114 H5] (asserted)
7. Costing: CST-RATE-001, CST-CE-001, CST-RUN-001; full run annually, new items weekly; actual costing out of Phase 1-2. [DOC:p.117-121 I] (asserted)
8. Pricing: PRC-PL-001; floors PC-100 22%, PC-300 18%; CFO if below floor by 5 pts; copper/CRGO surcharge default 100% pass-through. [DOC:p.122 I6] (asserted)
9. Postings #17-38 (22 templates); 6 close-checklist additions; WO unsettled limit 5 days. [DOC:p.124-126 J] (asserted)
10. Roadmap: M1 wks 1-4, M2 3-8, M3 6-12, M4 10-18, M5 14-20, M6 16-22, M7 20-26. [DOC:p.130 K3] (asserted)
11. NFRs: 50k items, 300 WOs/month, 2,000 SO lines/month, 40k scans/day, 1.2M journal lines/year; scan <400 ms P95; MRP <30 min; costing run <60 min; shop-floor 99.5%; audit ≤3 clicks. [DOC:p.131 K4] (asserted)
12. Sign-off: 11 Parts, 9/9 gaps, 190+ field tables, 9 signatories. [DOC:p.132 K5] (asserted)

## 3. New terms
"Scan Exception queue", "Identify & Relabel", "Peg", "CVA workbench".

## 4. Silences
- volume: no per-screen field counts, no workflow list.
- authority: no named client roles beyond titles.
- boundary: "75+" screens not itemised; no IF-xx or FL-xx IDs.

## 5. Conflicts
None known (no other source supplied).

## 6. Open the source again when
- Counting rows in the scan-point matrix (p.95-96) or status lists.
- Posting #17-38 account pairs (pp.124-125).
- Part K entity list (p.128) and integration matrix (p.129) for ERD sizing.
