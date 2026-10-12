# Digest: PRD2-02-bookI-sales-eng-prod-quality.txt

| Field | Value |
|---|---|
| Source file | `00-inputs/PRD2-sections/02-bookI-sales-eng-prod-quality.txt` |
| Type | anchor section (PRD2.pdf pp.47-91) |
| Who gave it | user / SME |
| Date of the source | 2026-10-09 |
| Size | 45 pages (p.65 blank) |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Book I of the ERP spec: Sales (Part B), Engineering (C), Production/MRP (D), Quality (E), supplied by the SME.

## 2. Claims
Scope counts: screen IDs 30 (OM 8, ENG 7, PP 11, QM 4); entities not stated; workflows not stated (lifecycles named); interfaces (IF-xx) not stated; reports 17 named (Sales 6, Eng 5, Prod 6) plus QM-CAL-R2; flows (FL-xx) not stated.

All lines: `[DOC:section]` (asserted).

1. 5 SO types: MTS, ETO, MTO, Service, Replacement; RMA-linked only (R-OM-04) [DOC:p.48 §1]
2. SO statuses 8; quote statuses 7; EBOM 5; WO 7; CAPA 7 [DOC:pp.51,54,61,74-75,88]
3. Credit check at 4 points; unpaid >30 days blocks; Controller releases [DOC:p.49 §2.2]
4. No-quote orders above $250k need Sales Director (R-OM-02) [DOC:p.52 §4.1]
5. ETO billing milestones: 20/10/20/30/15/5% =100% [DOC:p.53 §4.4]
6. Budgetary quotes ±25%; validity default 30 days [DOC:p.50 §3.1]
7. Validations/errors: V-OM-01, E-OM-02, E-OM-07, V-ENG-03/04/05/06, E-PP-01/03/04/07, E-QM-05 [DOC:various]
8. Roles: Sales 7, Engineering 5, Quality 5 [DOC:pp.56,67,91]
9. ECR priority Emergency 24h CCB SLA; CCB adds Controller if cost delta >$10k [DOC:p.62 §4.1]
10. 3 effectivity modes; ECO atomic release [DOC:pp.62-63]
11. Document types 10; native files max 500 MB [DOC:p.64 §5.1]
12. 14 work centers WC-050 to WC-700 seeded; default efficiency 85% [DOC:pp.69,71]
13. MRP exceptions EX-01 to EX-07; nightly run [DOC:p.72 §3]
14. WO release gates: 6 hard checks [DOC:p.74 §5.2]
15. Postings: COGS/FG, freight accrual, WIP, variances 5220-5250, rework, subcontract; labor guardrail ±20% [DOC:pp.55,76,78-80]
16. Scheduling: Phase 1-3; instrument integration Phase 1-3 [DOC:pp.81,86]
17. Tests: turns ratio ±0.5%, %Z ±7.5%, no-load loss +10%, rise 65K [DOC:p.86 §3]
18. CAPA check ≥30 days; SCAR: 2 overdue restrict vendor; calibration alerts 30/14/3 days [DOC:pp.88-90]
19. Phase 3: EDI, customer portal, vendor portal, title-block extraction [DOC:pp.49,67,86,89]

## 3. New terms
"Release Short", "EBOM ahead", "MFG-Add", "Engineering Placeholder", "TECO", "STAGE-OUT", "peg" (all used as spec terms).

## 4. Silences
- volume: no order, BOM or user volumes
- boundary: entities not enumerated; no IF-xx interface list
- exception: p.65 blank (likely figure)
- authority: price-floor and discount limits unspecified

## 5. Conflicts
None known (no other source provided).

## 6. Open the source again when
- You need exact milestone, ECR, or MRP exception tables (pp.53, 62, 72).
- You need field-level specs for any screen.
- Posting accounts (pp.55, 76, 78-80) are needed.
- Page 65 content is needed (blank in extraction).
