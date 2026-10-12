# Digest: 04-bookII-material-mgmt.txt

> **What this is.** A short, tagged summary of one raw source. The project reads this instead of the source.
>
> **Where it stands.** Produced by source-extractor on 2026-10-09. Not reviewed by a human.
>
> **What we need from you.** Nothing; no conflicts listed.

| Field | Value |
|---|---|
| Source file | `workspace/pe-v2/00-inputs/PRD2-sections/04-bookII-material-mgmt.txt` |
| Type | anchor section (PRD2.pdf pp.134-173) |
| Who gave it | User (self-declared SME) |
| Date of the source | 2026-10-09 (supplied) |
| Size | 40 pages |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Book II (Material Management) of the 312-page PE Transformer ERP spec, supplied by the SME: a field-level spec in Parts A-H.

## 2. Claims
All lines: `[DOC:p.n §x]` `(asserted)`.

**Scope counts:** screens/views: 12 new screens stated (p.172), 9 Material Master views, 6 reference tabs; entities: 16 rows in §18.1; material types: 9; workflows: 4 (MCR, MCH, supersession, matrix release) plus E&O run; interfaces: 2 REST families, 8 events, 12 integration flows, 8 linkage contracts; reports: 8 (MM-R1..R8).

1. 9 types: RAW, SEMI, FIN, TRADE, PACK, SPARE, CONS, SERV, NSTK; type immutable. [DOC:p.137 §2.1]
2. Screens: MM-MAT-001, MCR-001/002, SUP-001, IR-001/002, SL-001, VAL-001, MCH-001, EOR-001. [DOC:p.141-p.170]
3. Lifecycle: Draft, Data Completion, Active, Restricted, Blocked, Obsolete. [DOC:p.149 §4.1]
4. MCR tasks: 7 views/roles; parallel except Accounting last; SLA 2 business days. [DOC:p.150 §4.2]
5. Field classes 1-3; duplicate check trigram ≥ 0.9; 5 function blocks. [DOC:p.151 §4.4-4.5]
6. Matrix resolves by event key, valuation class; 6 new GL accounts (1311, 1340, 2120, 5215, 5340, 6320). [DOC:p.140, p.154]
7. Moving Average vs Standard method-change rules; period boundary only. [DOC:p.155 §5.4]
8. Info record deviation >5% alerts; last-PO basis stale >12 months. [DOC:p.157-158 §7.2-7.3]
9. Special stock: 5 buckets; consignment monthly self-billed settlement. [DOC:p.162-163 §14]
10. Serial profiles SN-FIN, SN-COMP, SN-SEMI, SN-NONE. [DOC:p.164 §15.2]
11. Migration: 2 mock loads minimum; zero Class A errors, <0.5% Class B; freeze T-5 days. [DOC:p.166-167 §16.3]
12. KPIs: completeness ≥95%, MCR P80 ≤5 days, duplicates <2/1,000. [DOC:p.167 §16.4]
13. Roadmap M1-M7 across weeks 1-26. [DOC:p.171 §20.1]
14. NFRs: 50k materials, +5k/year; 8k info records; 120k batches/year; 1.5k serials/year; ~450 fields; detail load <1.5 s P95; listing <2 s; duplicate check <500 ms; matrix <10 ms; MCH ≥50 rows/s; retention 10 years. [DOC:p.171 §20.2, p.170 §18.2]

## 3. New terms
- "MCR" / "MCH": creation / change request documents.
- "Function-specific block": additive chip blocking one document family.
- "De-Peg": formal release of SO-pegged stock.

## 4. Silences
- authority: no named people for roles.
- volume: no screen-level effort figures.
- failure: migration rollback not stated.
- boundary: PLM/CAD connector deferred to Book III.

## 5. Conflicts
None known (no other sources given).

## 6. Open the source again when
- You need the exact matrix rows (event keys, p.153-154).
- You need MCR task-by-type grid (p.150).
- You need field-level tables §3.4-3.11 (pp.142-147).
- You need entity columns (§18.1, pp.169-170).
