# Digest: 06-bookIV-V-governance-designers-guide.txt

| Field | Value |
|---|---|
| Source file | `00-inputs/PRD2-sections/06-bookIV-V-governance-designers-guide.txt` |
| Type | anchor section (PRD2.pdf, Enterprise ERP Unified Build Specification V1.0) |
| Who gave it | the user (project SME) |
| Date of the source | supplied 2026-10-09 |
| Size | PDF pp.204-243, 40 pages |
| Extracted by | source-extractor, 2026-10-09 |

## 1. What this is
Book IV (governance) and Book V (designer's guide) of the anchor document, 40 pages, from the SME.

## 2. Claims
Scope counts: screen rows per module (Sales 9, Engineering 7, CAD 4, Material 9, MRP 5, Production 6, Quality 8, Purchasing 7, RMA 6, Costing 7, Controlling 4, Workflow 5; total 77); decisions 10; conflicts 5; ADRs 10; flows 3; gates 3; actions 15.

- Book IV outranks Books I-III; INV V3.0 and ACC V2.0 version-locked. [DOC:p.204 §1.1] (asserted)
- IN at go-live: finite capacity with CTP, standard costing, structured ETO attributes, manual carrier/POD, installed base and warranty, one plant with four legal entities, deviation/waiver. [DOC:p.204-205 §1.2] (asserted)
- Phase 2: EDI 850/855/856/810, SPC, audit. Phase 3: actual costing, configurator, carrier API IF-21, portals, IF-20 OEE, optimizer. Field service execution OUT. [DOC:p.204-205 §1.2] (asserted)
- Go-live gate needs FL-09/10/11 packs passing, zero open conflicts, signed DEC register. [DOC:p.219 §9.3] (asserted)
- New objects: schedule lines, LLR, STP, production version, DEV; test packs TC-FLA 80, TC-DTS 40, TC-TRC 40. [DOC:p.206-216] (asserted)
- Traceability events T01-T13; tree under 10 s, archive under 60 s. [DOC:p.211-212 §4] (asserted)
- ADR-01..10: modular monolith (14 contexts), PostgreSQL, Kafka-class broker, search (50k+ materials, under 500 ms), 27-row workflow catalogue. [DOC:p.217-218 §8] (asserted)
- DG-1..3; nine screen states; 15 actions, 10 at P0. [DOC:p.218-220 §9-10] (asserted)
- Book V: 26 capabilities, 36 glossary terms, 18 modules, 17 figures. [DOC:p.222-226 §2-3] (asserted)
- Phase 1 devices: 8 SR, 4 ER, 6 DS9308, 6 RS5100, 10 TC77, 15 kiosks, 5 ZT411, 3 ZD621, 2 bench scales, 1 floor scale; 21 scan points; 7 label types. [DOC:p.238-239 §8] (asserted)
- Design system: 4 brand colours, 6 status colours, 8 px grid, 14 components; scan feedback under 400 ms, 48 px targets, offline queue 4 h. [DOC:p.241-242 §8.4, §10] (asserted)

## 3. New terms
"LLR", "STP", "Production Version", "readiness chips".

## 4. Silences
- volume: no user or transaction counts.
- authority: steering committee unnamed.
- boundary: Books VI-IX absent.

## 5. Conflicts
Internal register, all Closed (C-02 absent):
- C-01: Book I infinite capacity vs Book III finite CTP; Book III controls. [DOC:p.205 §1.3]
- C-03..C-06: AVL columns, claim wording, safety stock, ATP definitions. [DOC:p.205-206 §1.3]

## 6. Open it again when
- Exact wording of any DEC row (pp.204-205).
- Screen IDs per module (pp.231-237).
- Colour hex values (p.241).
