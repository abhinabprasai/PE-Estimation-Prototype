# Digest: 05-bookIII-enterprise-completeness.txt

| Field | Value |
|---|---|
| Source file | `workspace/pe-v2/00-inputs/PRD2-sections/05-bookIII-enterprise-completeness.txt` |
| Type | anchor section (PRD2.pdf, Book III) |
| Who gave it | the project SME (self-declared) |
| Date of the source | supplied 2026-10-09 |
| Size | PDF pages 174-203 (30 pages, ~76 KB text) |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is

Book III of the anchor spec (PE Transformer ERP, V1.0): cross-cutting closure flows, integration, security, resilience, scheduling, multi-plant, CAD connector and acceptance, supplied by the SME.

## 2. Claims

Scope counts: flows 8 (FL-01..08); interfaces 20 (IF-01..20); screens not stated (one integration console named); entities 4 legal entities, 3 new objects (RCL, QAL, TOOL); test classes 9.

| # | Claim | Tag | Conf |
|---|---|---|---|
| 1 | Eight flows, each on a 15-field template: MTS O2C, ETO quote-to-cash, P2P, plan-to-produce, RMA, period close, intercompany, recall | `[DOC:p.176 §A]` | (asserted) |
| 2 | Test ranges: O2C 001-060, ETO 001-080, P2P 001-070, PTP 001-070, RMA 001-050, CLS 001-040, ICO 001-030, RCL 001-030, CAD 001-030 | `[DOC:pp.177-199 §A,G]` | (asserted) |
| 3 | PO approval ladder: Buyer ≤$25k, PM ≤$250k, Controller, CFO >$1M | `[DOC:p.178 FL-03]` | (asserted) |
| 4 | Recall object RCL is the only net-new functional object; built in M5 | `[DOC:p.183 FL-08]` | (asserted) |
| 5 | Tiers: T1 99.5%, RTO 1 h, RPO 0; T2 99.0%, 4 h, 15 min; T3 24 h/24 h | `[DOC:p.190 §D2]` | (asserted) |
| 6 | Region DR: RPO ≤15 min, RTO ≤4 h; 35-day PITR | `[DOC:p.190 §D3]` | (asserted) |
| 7 | NFRs: scan <400 ms P95, PGI <2 s, MRP <30 min, trace tree <10 s, CTP <10 s, plant reschedule <5 min | `[DOC:pp.191-193 §D5,E3]` | (asserted) |
| 8 | Capacity: 3× scan-peak headroom; retention 7 yr transactional, 10 yr genealogy | `[DOC:pp.189,191 §C6,D6]` | (asserted) |
| 9 | Kafka-class broker, REST /api/v1, idempotency keys 7 days, topics retained 30 days, DLQ after 24 h | `[DOC:pp.184-185 §B2]` | (asserted) |
| 10 | Security: OIDC/SAML, SCIM, leaver deactivation 1 h, quarterly recertification | `[DOC:pp.188-189 §C]` | (asserted) |
| 11 | One plant, four legal entities; plant 2 and international are pre-specified packages | `[DOC:p.195 §F]` | (asserted) |
| 12 | Toolchain baseline SolidWorks PDM Professional; connector IF-17; floor follows ERP effectivity | `[DOC:pp.198-199 §G]` | (asserted) |
| 13 | Migration: two mock conversions minimum, mock 2 zero manual fixes; freeze T-5/T-1; 40-case smoke pack; 20-serial trace checks | `[DOC:pp.201-202 §H]` | (asserted) |
| 14 | 9 test classes; sign-off lists 12 roles; training ≥95%; hypercare three closes | `[DOC:pp.200-203 §H]` | (asserted) |

## 3. New terms

"CTP", "hypercare", "closure template".

## 4. Silences

- volume: no user or transaction counts.
- authority: IdP and CAD toolchain undecided.
- after: no M1-M7 dates or costs.

## 5. Conflicts

None known; no other source named.

## 6. Open it again when

- You need any FL-nn's 15 fields (pages 176-183).
- You need the IF-01..20 owners and controls (pages 185-186).
- You need Phase 1/2/3 scheduling scope (page 194).
- You need migration object list (page 201).
