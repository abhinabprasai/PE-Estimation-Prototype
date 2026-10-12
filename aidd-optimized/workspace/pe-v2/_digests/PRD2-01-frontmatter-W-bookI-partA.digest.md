# Digest: PRD2-01-frontmatter-W-bookI-partA

| Field | Value |
|---|---|
| Source file | `00-inputs/PRD2-sections/01-frontmatter-W-bookI-partA.txt` |
| Type | anchor section (PRD2.pdf) |
| Who gave it | User, project SME |
| Date of the source | Document V1.0 July 2026; supplied 2026-10-09 |
| Size | PDF pp.1-46 of 312 |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Anchor-document opening: front matter, module index, Section W workflow engine, Book I Part A (nine inventory gap items).

## 2. Claims
Scope counts: screens 15 IDs; entities not stated (16 new GL accounts); workflows 27 (W.4); interfaces 1 (IF-17); reports 5 named (CVA-R1..R4, SS-EX-01); flows FL-01..06, 08..11 (10).

All claims `[DOC:p.n §x]` `(asserted)`.

1. Nine Books; 78 screen entries, seven build waves (p.8)
2. W.1 one shared approval engine; no module-specific approvals; delegation above $250k financial approvals prohibited (pp.10-11 §W)
3. PO ladder: Buyer ≤$25k, Purchasing Mgr ≤$250k, Controller, CFO >$1M (p.11 §W.4)
4. 16 new GL accounts (1315-7500) (pp.19 §2.4)
5. RMA: classes RC1-RC4; 8-step flow; approval ≤$10,000 CS Mgr, RC3/warranty +Quality Mgr, >$50,000 +Controller; goodwill +Controller (pp.21,27 §3)
6. RMA: 5 business-day receipt-to-inspection SLA; reopen 30 days; restocking 15%/10%/0%; no-reference credit at list less 20% (pp.26-27 §3.8-3.10)
7. RMA: 11 status rows; screens RMA-001..004 (pp.22-26)
8. Sales tab pricing waterfall: 5 steps; price change >±5% needs approval; E-SAL-01 (pp.28-29 §4)
9. Packing: HU statuses Open, Closed, Loaded, Shipped; gross weight tolerance ±2%; HU label 4×6 in ZPL (pp.31-32 §5)
10. Inspection plans: types INC/INP/FIN/PSI/RMA; ANSI/ASQ Z1.4; AQL 0.65-4.0; tighten at 2 of 5 rejected; reduce after 10 accepted; skip-lot N=5, ≥98% (pp.33-35 §6)
11. Count documents: 9 statuses; recount ±2% or ±$500; supervisor ≤$2,000/line, ≤$10,000/doc; Controller >$25,000; ABC 0.5/2/5% (pp.36-37 §7)
12. CVA: 8 variance types (PPV, IPV, MUV, LRV, LEV, OAV, SPV, RVV); drill ≤3 clicks; 13 period columns; Pareto top 10 (pp.39-40 §8)
13. Fiscal: R-PER-01 one Open, max one Soft Close; reopen needs Controller+CFO; errors E-PER-01..04 (pp.41-42 §9)
14. Safety stock: >25% change needs Planning Mgr; ADU trailing 90 days; breached ≥3 times/90 days; SS-BREACH (pp.43-44 §10)
15. Tax: Avalara default; 6-step precedence; nexus alert at 80%; Phase 1 US+Canada (pp.45-46 §11)

## 3. New terms
"QI Hold" (return stock status); "Soft Freeze" (count lock); "DELTA to INV x.x" (change marker).

## 4. Silences
- volume: no user counts or transaction volumes
- boundary: INV/ACC external specs not included

## 5. Conflicts
None known.

## 6. Open it again when
- Exact W.4 rows/owners are needed (p.11-12).
- GL posting tables for RMA dispositions are needed (p.25).
- Tolerance bands are needed (p.37).
