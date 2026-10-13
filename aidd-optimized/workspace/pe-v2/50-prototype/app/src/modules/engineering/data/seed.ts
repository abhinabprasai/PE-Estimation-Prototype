// Engineering seed. Spine headers owned here (src/data/shared/spine.ts) are seeded with exactly their
// IDs, statuses and dates; everything else is added so every status of every engineering record
// shows at least once. Names, numbers and dates are fictitious design values (GUARDRAILS 7).
// ID shapes follow the spine's TBD placeholders (OQ-30); ECR / ECO use the PRD format
// ECR-{YYYY}-{SEQ:4} / ECO-{YYYY}-{SEQ:4} [DOC:p.62 §4.1-4.2] (asserted).

import type { Activity, DocRef, EbomId, MaterialId, UserId } from "@/data/domain"
import { materialById } from "@/data/shared"
import { addDays } from "@/lib/format"
import type {
  CadAssembly, ChecklistRow, DocRecord, DocRevisionX, DocTypeCode, EbomLineX, EbomRecord, EcoRecord, EcrRecord, ErRecord, ImportProposal, ImportProposalLine, MbomLineX, MbomRecord,
  PdmLink, Placeholder, PvRecord, SecurityClass, SyncConflict, TitleBlock, TransmittalRecord, VaultEvent,
} from "./types"

export const RAVI: UserId = "USR-TBD-022"
export const ELENA: UserId = "USR-TBD-023"
export const HIRO: UserId = "USR-TBD-024"
export const GRACE: UserId = "USR-TBD-025"
export const PAUL: UserId = "USR-TBD-026"
export const IVAN: UserId = "USR-TBD-027"

const A = (at: string, by: string, text: string): Activity => ({ at, by, text })

/** Deterministic fake SHA-256 shown as a checksum (design value). */
export function fakeSha(s: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x1234567
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519) >>> 0
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0")
  return `sha256:${hex(h1)}${hex(h2)}…${hex(h1 ^ h2).slice(0, 4)}`
}

const uom = (id: MaterialId) => materialById(id)?.baseUom ?? "EA"
const L = (no: number, componentId: MaterialId, qty: number, x: Partial<EbomLineX> = {}): EbomLineX => ({ no, componentId, qty, uom: uom(componentId), scrapPct: 0, ...x })

// ============================================================== EBOM lines
/** 20 MVA ONAN/ONAF, 115 kV - 13.8 kV, rev B: the phase 1 released structure. */
function lines20MvaRevB(): EbomLineX[] {
  return [
    L(10, "SEMI-TBD-CORE20", 1, { consumeAtOp: 80, drawingId: "DOC-COR-00301" }),
    L(11, "RAW-TBD-CRGO23", 18600, { parent: 10, scrapPct: 2, consumeAtOp: 20, notes: "Step-lap, 7 steps" }),
    L(20, "SEMI-TBD-HVC20", 3, { consumeAtOp: 80, drawingId: "DOC-WND-00301", refDes: "Phases U, V, W" }),
    L(21, "RAW-TBD-CTC", 1450, { parent: 20, scrapPct: 3, consumeAtOp: 50 }),
    L(22, "RAW-TBD-KRAFT", 210, { parent: 20, scrapPct: 5, consumeAtOp: 50 }),
    L(30, "SEMI-TBD-LVC20", 3, { consumeAtOp: 80, drawingId: "DOC-WND-00301", refDes: "Phases u, v, w" }),
    L(31, "RAW-TBD-FOIL", 980, { parent: 30, scrapPct: 3, consumeAtOp: 40 }),
    L(32, "RAW-TBD-KRAFT", 140, { parent: 30, scrapPct: 5, consumeAtOp: 40 }),
    L(40, "SEMI-TBD-TANK20", 1, { consumeAtOp: 90, drawingId: "DOC-TNK-00301" }),
    L(41, "RAW-TBD-PLATE", 9800, { parent: 40, scrapPct: 4, consumeAtOp: 10 }),
    L(42, "RAW-TBD-RAD", 8, { parent: 40, consumeAtOp: 10, refDes: "R1-R8 (ONAF)" }),
    L(50, "RAW-TBD-OLTC", 1, { consumeAtOp: 100, refDes: "OLTC, ±10%, 17 positions", alternates: [] }),
    L(60, "RAW-TBD-BSH145", 3, { consumeAtOp: 100, refDes: "H1, H2, H3" }),
    L(70, "RAW-TBD-BSH015", 4, { consumeAtOp: 100, refDes: "X0, X1, X2, X3", alternates: [{ componentId: "SPARE-TBD-BSH145", rank: 2, condition: "Not interchangeable: LV rating; listed for audit only" }] }),
    L(80, "SPARE-TBD-GSKT20", 1, { consumeAtOp: 90, phantom: true, notes: "Hardware kit grouping: explodes into parent demand", printNote: true }),
    L(90, "RAW-TBD-OIL", 21500, { scrapPct: 1, consumeAtOp: 110 }),
  ]
}
function lines20MvaRevA(): EbomLineX[] {
  return lines20MvaRevB()
    .filter((l) => l.no !== 80)
    .map((l) => (l.no === 11 ? { ...l, qty: 18200 } : l.no === 42 ? { ...l, qty: 7, refDes: "R1-R7" } : l.no === 50 ? { ...l, refDes: "OLTC, ±5%, 9 positions" } : l))
}
function lines20MvaPhase2(): EbomLineX[] {
  const base = lines20MvaRevB().map((l) =>
    l.no === 60
      ? { ...l, comments: [{ by: HIRO, on: "2026-10-03", text: "Under review after RCL-2026-001 (flange seal leak, batch BAT-TBD-B0301). ECR-2026-0019 proposes a revised seal and a second source." }] }
      : l,
  )
  return [
    ...base,
    L(95, "RAW-TBD-CT600", 3, { consumeAtOp: 100, refDes: "Bushing CTs on H1-H3", notes: "Customer relaying spec rev 4" }),
    L(96, "RAW-TBD-PH0412", 1, { refDes: "WTI", notes: "8-channel fiber-optic winding temperature monitor, customer spec" }),
  ]
}
const pad = (core: number, foil: number, ctc: number, kraft: number, plate: number, oil: number, lvb: number, rad?: number): EbomLineX[] => [
  L(10, "RAW-TBD-CRGO23", core, { scrapPct: 2, consumeAtOp: 20 }),
  L(20, "RAW-TBD-FOIL", foil, { scrapPct: 3, consumeAtOp: 40 }),
  L(30, "RAW-TBD-CTC", ctc, { scrapPct: 3, consumeAtOp: 50 }),
  L(40, "RAW-TBD-KRAFT", kraft, { scrapPct: 5, consumeAtOp: 50 }),
  L(50, "RAW-TBD-PLATE", plate, { scrapPct: 4, consumeAtOp: 10 }),
  L(60, "RAW-TBD-OIL", oil, { scrapPct: 1, consumeAtOp: 110 }),
  L(70, "RAW-TBD-BSH015", lvb, { consumeAtOp: 100, refDes: lvb === 4 ? "X0-X3" : "X1-X3" }),
  ...(rad ? [L(80, "RAW-TBD-RAD", rad, { consumeAtOp: 10 })] : []),
]

function ebom(p: Partial<EbomRecord> & Pick<EbomRecord, "id" | "parentItemId" | "rev" | "status" | "title" | "lines" | "createdOn">): EbomRecord {
  return {
    createdBy: RAVI, activity: [], usage: "Production", plantId: "PL-TBD-01", priorRevs: [], assigneeIds: [RAVI], reviewNotes: [], ...p,
  }
}

export function seedEboms(): EbomRecord[] {
  return [
    ebom({
      id: "EBOM-TBD-0301", parentItemId: "FIN-TBD-20MVA", rev: "B", status: "Released", title: "EBOM FIN-TBD-20MVA, Omaha North, rev B", createdOn: "2026-01-19",
      engineeringRequestId: "ER-TBD-0301", lines: lines20MvaRevB(), releasedOn: "2026-03-18", assigneeIds: [RAVI, ELENA], submittedBy: RAVI, baseDesign: "New design",
      priorRevs: [{ rev: "A", status: "Superseded", releasedOn: "2026-02-20", supersededOn: "2026-03-18", reason: "Customer tap-range change (TR-298 Revise & Resubmit)", lines: lines20MvaRevA() }],
      activity: [
        A("2026-01-19", "Engineer", "Created from ER-TBD-0301 (New Design)"),
        A("2026-02-20", "Engineering Manager", "Rev A released"),
        A("2026-03-12", "Engineer", "Rev B submitted for review: OLTC ±10% 17 positions, ONAF radiators 8"),
        A("2026-03-18", "Engineering Manager", "Rev B released; rev A Superseded"),
      ],
    }),
    ebom({
      id: "EBOM-TBD-0377", parentItemId: "FIN-TBD-20MVA", rev: "A", status: "Draft", title: "EBOM FIN-TBD-20MVA, phase 2, rev A", createdOn: "2026-07-02",
      engineeringRequestId: "ER-TBD-0377", lines: lines20MvaPhase2(), assigneeIds: [ELENA, RAVI], baseDesign: "Copy From EBOM-TBD-0301 rev B",
      cadAhead: "Vault assembly PE-20MVA-PH2-ASM is at A.3; this EBOM was last aligned with A.1",
      activity: [A("2026-07-02", "Engineer", "Copied from EBOM-TBD-0301 rev B (Copy From); provenance stored as Base Design"), A("2026-09-18", "Engineer", "Placeholder RAW-TBD-PH0412 created inline; MCR requested"), A("2026-10-03", "Engineering Manager", "Bushing line 60 put under review after RCL-2026-001")],
    }),
    ebom({
      id: "EBOM-00366", parentItemId: "FIN-TBD-20MVA", rev: "A", status: "In Review", title: "EBOM FIN-TBD-20MVA variant, Alma 120 kV - 25 kV", createdOn: "2026-08-04",
      engineeringRequestId: "ER-TBD-0366", lines: lines20MvaRevB().map((l) => (l.no === 21 ? { ...l, qty: 1390 } : l)), assigneeIds: [RAVI], submittedBy: RAVI, baseDesign: "Variant of EBOM-TBD-0301 rev B",
      reviewNotes: [{ by: HIRO, on: "2026-10-07", text: "Check HV conductor mass against 120 kV BIL 550 kV clearance; waiting on customer GA approval." }],
      activity: [A("2026-08-04", "Engineer", "Created as a variant of EBOM-TBD-0301 rev B"), A("2026-10-06", "Engineer", "Submitted for review")],
    }),
    ebom({
      id: "EBOM-00312", parentItemId: "FIN-TBD-7500MTO", rev: "A", status: "In Review", title: "EBOM FIN-TBD-7500MTO, Lakeshore North substation", createdOn: "2026-10-07",
      engineeringRequestId: "ER-2026-0402", lines: pad(5200, 1200, 600, 120, 3600, 4800, 4, 4), assigneeIds: [RAVI], submittedBy: RAVI, baseDesign: "Variant of EBOM-00310 rev A",
      activity: [A("2026-10-07", "Engineer", "Created as variant; CAD import IMP-TBD-0039 committed"), A("2026-10-08", "Engineer", "Submitted for review")],
    }),
    ebom({
      id: "EBOM-00310", parentItemId: "FIN-TBD-7500MTO", rev: "A", status: "Released", title: "EBOM FIN-TBD-7500MTO, stainless tank, Prince Albert", createdOn: "2026-08-05",
      engineeringRequestId: "ER-2026-0389", lines: pad(5200, 1200, 600, 120, 3600, 4800, 4, 4), releasedOn: "2026-08-21", submittedBy: RAVI,
      cadAhead: "Vault assembly PE-7500-PA-ASM is at B.1; this released rev A was aligned with A.4",
      activity: [A("2026-08-21", "Engineering Manager", "Released")],
    }),
    ebom({
      id: "EBOM-00288", parentItemId: "FIN-TBD-5000SS", rev: "C", status: "Released", title: "EBOM FIN-TBD-5000SS, secondary unit substation, rev C", createdOn: "2025-11-03",
      lines: pad(7400, 700, 900, 160, 4800, 9800, 3, 6).map((l) => (l.no === 10 ? { ...l, notes: "Alternate grade M-OH accepted per ECO-2026-0007 (loss delta +0.4%)" } : l)), releasedOn: "2026-09-01", submittedBy: ELENA, assigneeIds: [ELENA],
      priorRevs: [
        { rev: "B", status: "Superseded", releasedOn: "2026-05-08", supersededOn: "2026-09-01", reason: "ECO-2026-0007 cost reduction (date effectivity 2026-09-01)", lines: pad(7600, 700, 900, 160, 4800, 9800, 3, 6) },
        { rev: "A", status: "Superseded", releasedOn: "2025-11-20", supersededOn: "2026-05-08", reason: "Radiator count raised for 55 °C rise", lines: pad(7600, 700, 900, 160, 4800, 9800, 3, 5) },
      ],
      activity: [A("2026-09-01", "Engineering Manager", "Rev C released atomically by ECO-2026-0007 at date effectivity")],
    }),
    ebom({
      id: "EBOM-00290", parentItemId: "FIN-TBD-2500PM", rev: "A", status: "Released", title: "EBOM FIN-TBD-2500PM, pad-mount base design 2026", createdOn: "2026-02-02",
      lines: pad(2600, 520, 310, 60, 1900, 2400, 4), releasedOn: "2026-03-02", submittedBy: ELENA, assigneeIds: [ELENA], baseDesign: "New design (replaces EBOM-TBD-0244)",
      activity: [A("2026-03-02", "Engineering Manager", "Released; EBOM-TBD-0244 Superseded")],
    }),
    ebom({
      id: "EBOM-TBD-0244", parentItemId: "FIN-TBD-2500PM", rev: "D", status: "Superseded", title: "EBOM FIN-TBD-2500PM, pad-mount legacy design", createdOn: "2023-04-11",
      lines: pad(2750, 540, 320, 65, 2050, 2500, 4), releasedOn: "2024-06-14", activity: [A("2026-03-02", "System", "Superseded by EBOM-00290 rev A; historical WOs keep this revision")],
    }),
    ebom({
      id: "EBOM-00102", parentItemId: "FIN-TBD-0050PL", rev: "F", status: "Obsolete", title: "EBOM FIN-TBD-0050PL, 50 kVA pole-mount (legacy)", createdOn: "2019-09-30",
      lines: [L(10, "RAW-TBD-CRGO23", 140, { scrapPct: 2 }), L(20, "RAW-TBD-FOIL", 32), L(30, "RAW-TBD-OIL", 120)], releasedOn: "2022-01-10",
      activity: [A("2026-01-15", "Engineering Manager", "Design retired: blocked from new MBOMs and orders (C-16)")],
    }),
    ebom({ id: "EBOM-00295", parentItemId: "FIN-TBD-1000PM", rev: "B", status: "Released", title: "EBOM FIN-TBD-1000PM, pad-mount 1,000 kVA", createdOn: "2025-06-02", lines: pad(1250, 260, 150, 30, 1100, 1250, 4), releasedOn: "2025-09-19", submittedBy: ELENA }),
    ebom({ id: "EBOM-00296", parentItemId: "FIN-TBD-0167PL", rev: "C", status: "Released", title: "EBOM FIN-TBD-0167PL, pole-mount 167 kVA", createdOn: "2025-03-10", lines: [L(10, "RAW-TBD-CRGO23", 320, { scrapPct: 2, consumeAtOp: 20 }), L(20, "RAW-TBD-FOIL", 70, { consumeAtOp: 40 }), L(30, "RAW-TBD-CTC", 40, { consumeAtOp: 50 }), L(40, "RAW-TBD-OIL", 260, { consumeAtOp: 110 }), L(50, "RAW-TBD-BSH015", 2, { consumeAtOp: 100, refDes: "X1, X2" })], releasedOn: "2025-07-01", submittedBy: RAVI }),
    ebom({ id: "EBOM-00305", parentItemId: "SEMI-TBD-CORE20", rev: "A", status: "Released", title: "EBOM SEMI-TBD-CORE20, stacked core 20 MVA", createdOn: "2026-01-26", lines: [L(10, "RAW-TBD-CRGO23", 18600, { scrapPct: 2, consumeAtOp: 20 })], releasedOn: "2026-02-20", submittedBy: RAVI }),
    ebom({ id: "EBOM-00306", parentItemId: "SEMI-TBD-HVC20", rev: "B", status: "Released", title: "EBOM SEMI-TBD-HVC20, HV disc winding", createdOn: "2026-01-26", lines: [L(10, "RAW-TBD-CTC", 1450, { scrapPct: 3, consumeAtOp: 50 }), L(20, "RAW-TBD-KRAFT", 210, { scrapPct: 5, consumeAtOp: 50 })], releasedOn: "2026-03-18", submittedBy: RAVI }),
    ebom({ id: "EBOM-00307", parentItemId: "SEMI-TBD-LVC20", rev: "A", status: "Released", title: "EBOM SEMI-TBD-LVC20, LV foil winding", createdOn: "2026-01-26", lines: [L(10, "RAW-TBD-FOIL", 980, { scrapPct: 3, consumeAtOp: 40 }), L(20, "RAW-TBD-KRAFT", 140, { scrapPct: 5, consumeAtOp: 40 })], releasedOn: "2026-02-20", submittedBy: ELENA }),
    ebom({ id: "EBOM-00308", parentItemId: "SEMI-TBD-TANK20", rev: "A", status: "Released", title: "EBOM SEMI-TBD-TANK20, main tank", createdOn: "2026-01-27", lines: [L(10, "RAW-TBD-PLATE", 9800, { scrapPct: 4, consumeAtOp: 10 }), L(20, "RAW-TBD-RAD", 8, { consumeAtOp: 10 }), L(30, "CONS-TBD-WELD", 85, { consumeAtOp: 10 })], releasedOn: "2026-02-24", submittedBy: ELENA }),
    ebom({ id: "EBOM-00315", parentItemId: "SEMI-TBD-CORE25", rev: "A", status: "Draft", title: "EBOM SEMI-TBD-CORE25, stacked core 2,500 kVA", createdOn: "2026-09-29", lines: [L(10, "RAW-TBD-CRGO23", 2600, { scrapPct: 2 })], assigneeIds: [ELENA] }),
    ebom({
      id: "EBOM-00384", parentItemId: "FIN-TBD-5000SS", rev: "A", status: "Draft", title: "EBOM FIN-TBD-5000SS variant, Delta BC 34.5 kV", createdOn: "2026-09-14",
      engineeringRequestId: "ER-2026-0384", lines: pad(7400, 700, 900, 160, 4800, 9800, 3, 6).map((l) => (l.no === 60 ? { ...l, qty: 0 } : l)), assigneeIds: [ELENA], baseDesign: "Variant of EBOM-00288 rev C",
      activity: [A("2026-09-14", "Engineer", "Created as a variant of EBOM-00288 rev C; oil quantity pending tank redesign")],
    }),
    // Sales kits: BOM with usage Sales, single level, components only, no phantoms, no nested kits [DOC:p.256 §6.1].
    ebom({
      id: "EBOM-00331", parentItemId: "KIT-TBD-COMM20" as MaterialId, rev: "A", status: "Released", usage: "Sales", title: "Commissioning kit, 20 MVA substation transformer", createdOn: "2026-03-02",
      lines: [L(10, "SPARE-TBD-GSKT20", 1), L(20, "CONS-TBD-PAINT", 4), L(30, "PACK-TBD-DESIC", 6)], releasedOn: "2026-03-20", submittedBy: RAVI, assigneeIds: [RAVI], baseDesign: "New design",
      activity: [A("2026-03-20", "Engineering Manager", "Released through the standard BOM review path (usage Sales)")],
    }),
    ebom({
      id: "EBOM-00332", parentItemId: "KIT-TBD-SPARES20" as MaterialId, rev: "A", status: "Released", usage: "Sales", title: "Recommended spares package, 20 MVA substation transformer", createdOn: "2026-03-04",
      engineeringRequestId: "ER-TBD-0301", lines: [L(10, "SPARE-TBD-BSH145", 1), L(20, "SPARE-TBD-OLTCK", 1), L(30, "SPARE-TBD-GSKT20", 2)], releasedOn: "2026-03-26", submittedBy: ELENA, assigneeIds: [ELENA], baseDesign: "New design",
      activity: [A("2026-03-26", "Engineering Manager", "Released; referenced from the ER-TBD-0301 deliverables (recommended spares package)")],
    }),
    ebom({
      id: "EBOM-00333", parentItemId: "KIT-TBD-HW5000" as MaterialId, rev: "A", status: "Draft", usage: "Sales", title: "Installation hardware set, 5 MVA secondary unit substation", createdOn: "2026-10-05",
      lines: [L(10, "PACK-TBD-CRATE", 1), L(20, "CONS-TBD-PAINT", 2, { phantom: true, notes: "Grouped hardware (phantom): not allowed in a sales kit" })], assigneeIds: [ELENA],
      activity: [A("2026-10-05", "Engineer", "Created for the secondary unit substation catalog line")],
    }),
  ]
}

// ============================================================== placeholders (V-ENG-03)
export function seedPlaceholders(): Placeholder[] {
  return [
    { id: "RAW-TBD-PH0412", description: "Fiber-optic winding temperature monitor, 8 channels", category: "RAW", uom: "EA", estCost: 14800, targetVendorId: "VEN-TBD-0110", ebomId: "EBOM-TBD-0377", line: 96, engineerId: ELENA, createdOn: "2026-09-18", status: "Draft" },
    { id: "RAW-TBD-CT600", description: "Bushing current transformer, 600:5 MR", category: "RAW", uom: "EA", estCost: 2150, targetVendorId: "VEN-TBD-0115", ebomId: "EBOM-TBD-0377", line: 95, engineerId: ELENA, createdOn: "2026-10-01", status: "Draft" },
    { id: "RAW-TBD-OLTC", description: "On-load tap changer, 115 kV class, 17 positions", category: "RAW", uom: "EA", estCost: 74500, targetVendorId: "VEN-TBD-0103", ebomId: "EBOM-TBD-0301", line: 50, engineerId: RAVI, createdOn: "2026-01-20", status: "Active", mcrId: "MCR-TBD-0301" },
  ]
}

// ============================================================== MBOMs (MBOM-TRF)
export function mbomLinesFrom(lines: EbomLineX[], adds: MbomLineX[] = []): MbomLineX[] {
  const phantomNos = new Set(lines.filter((l) => l.phantom).map((l) => l.no))
  const out: MbomLineX[] = lines
    .filter((l) => !l.phantom)
    .map((l) => ({ ...l, parent: l.parent && phantomNos.has(l.parent) ? undefined : l.parent, fromPhantom: l.parent && phantomNos.has(l.parent) ? l.parent : undefined, operation: l.consumeAtOp ? String(l.consumeAtOp) : undefined, backflush: !l.parent && l.uom !== "EA" }))
  // A phantom line with no children of its own flattens into its parent as one demand line.
  for (const p of lines.filter((l) => l.phantom)) if (!lines.some((c) => c.parent === p.no)) out.push({ ...p, phantom: false, fromPhantom: p.no, operation: p.consumeAtOp ? String(p.consumeAtOp) : undefined })
  return [...out.sort((a, b) => a.no - b.no), ...adds]
}
export const MFG_ADDS_20MVA: MbomLineX[] = [
  { ...L(900, "PACK-TBD-SKID", 1, { consumeAtOp: 140 }), mfgAdd: true, operation: "140" },
  { ...L(910, "PACK-TBD-CRATE", 3, { consumeAtOp: 140 }), mfgAdd: true, operation: "140" },
  { ...L(920, "PACK-TBD-DESIC", 12, { consumeAtOp: 140 }), mfgAdd: true, operation: "140" },
  { ...L(930, "CONS-TBD-WELD", 85, { consumeAtOp: 10 }), mfgAdd: true, operation: "10", backflush: true },
  { ...L(940, "CONS-TBD-PAINT", 60, { consumeAtOp: 130 }), mfgAdd: true, operation: "130", backflush: true },
  { ...L(950, "RAW-TBD-OIL", 400, { consumeAtOp: 140, notes: "Oil top-up allowance" }), mfgAdd: true, operation: "140" },
]
const MFG_ADDS_PAD: MbomLineX[] = MFG_ADDS_20MVA.filter((l) => l.no !== 910).map((l) => (l.no === 950 ? { ...l, qty: 60 } : l.no === 930 ? { ...l, qty: 22 } : l.no === 940 ? { ...l, qty: 18 } : l))

export function seedMboms(eboms: EbomRecord[]): MbomRecord[] {
  const e = (id: string) => eboms.find((x) => x.id === id)!
  const m = (p: Omit<MbomRecord, "activity" | "costingInvalidated" | "plantId"> & Partial<MbomRecord>): MbomRecord => ({ plantId: "PL-TBD-01", costingInvalidated: false, activity: [], ...p })
  return [
    m({ id: "MBOM-TBD-0301", ebomId: "EBOM-TBD-0301", ebomRev: "B", parentItemId: "FIN-TBD-20MVA", revision: "B", status: "Active", routingId: "RTG-TBD-20MVA", routingRev: "B", lines: mbomLinesFrom(e("EBOM-TBD-0301").lines, MFG_ADDS_20MVA), releasedOn: "2026-03-24", releasedBy: GRACE, activity: [A("2026-03-24", "Manufacturing engineer", "Transformed from EBOM-TBD-0301 rev B; MBOM-TBD-0300 Superseded; costing invalidation flag set"), A("2026-03-31", "System", "Costing run picked up the invalidation flag")] }),
    m({ id: "MBOM-TBD-0300", ebomId: "EBOM-TBD-0301", ebomRev: "A", parentItemId: "FIN-TBD-20MVA", revision: "A", status: "Superseded", routingId: "RTG-TBD-20MVA", routingRev: "A", lines: mbomLinesFrom(e("EBOM-TBD-0301").priorRevs[0].lines, MFG_ADDS_20MVA), releasedOn: "2026-02-24", releasedBy: GRACE, supersededOn: "2026-03-24" }),
    m({ id: "MBOM-TBD-0288", ebomId: "EBOM-00288", ebomRev: "B", parentItemId: "FIN-TBD-5000SS", revision: "B", status: "Active", routingId: "RTG-TBD-5000SS", routingRev: "C", lines: mbomLinesFrom(e("EBOM-00288").priorRevs[0].lines, MFG_ADDS_PAD), releasedOn: "2026-05-12", releasedBy: GRACE, activity: [A("2026-09-01", "System", "EBOM ahead: EBOM-00288 released rev C (ECO-2026-0007); regenerate through MBOM-TRF")] }),
    m({ id: "MBOM-TBD-0287", ebomId: "EBOM-00288", ebomRev: "A", parentItemId: "FIN-TBD-5000SS", revision: "A", status: "Superseded", routingId: "RTG-TBD-5000SS", routingRev: "C", lines: mbomLinesFrom(e("EBOM-00288").priorRevs[1].lines, MFG_ADDS_PAD), releasedOn: "2025-11-27", releasedBy: GRACE, supersededOn: "2026-05-12" }),
    m({ id: "MBOM-TBD-0290", ebomId: "EBOM-00290", ebomRev: "A", parentItemId: "FIN-TBD-2500PM", revision: "A", status: "Active", routingId: "RTG-TBD-2500PM", routingRev: "B", lines: mbomLinesFrom(e("EBOM-00290").lines, MFG_ADDS_PAD), releasedOn: "2026-03-09", releasedBy: GRACE }),
    m({ id: "MBOM-TBD-0244", ebomId: "EBOM-TBD-0244", ebomRev: "D", parentItemId: "FIN-TBD-2500PM", revision: "D", status: "Superseded", routingId: "RTG-TBD-2500PM", routingRev: "B", lines: mbomLinesFrom(e("EBOM-TBD-0244").lines, MFG_ADDS_PAD), releasedOn: "2024-06-20", releasedBy: GRACE, supersededOn: "2026-03-09" }),
    m({ id: "MBOM-TBD-0295", ebomId: "EBOM-00295", ebomRev: "B", parentItemId: "FIN-TBD-1000PM", revision: "B", status: "Active", routingId: "RTG-TBD-1000PM", routingRev: "A", lines: mbomLinesFrom(e("EBOM-00295").lines, MFG_ADDS_PAD), releasedOn: "2025-09-24", releasedBy: GRACE }),
    m({ id: "MBOM-TBD-0296", ebomId: "EBOM-00296", ebomRev: "C", parentItemId: "FIN-TBD-0167PL", revision: "C", status: "Active", routingId: "RTG-TBD-0167PL", routingRev: "B", lines: mbomLinesFrom(e("EBOM-00296").lines), releasedOn: "2025-07-08", releasedBy: GRACE }),
    m({ id: "MBOM-TBD-0310", ebomId: "EBOM-00310", ebomRev: "A", parentItemId: "FIN-TBD-7500MTO", revision: "A", status: "Active", routingId: "RTG-TBD-7500", routingRev: "A", lines: mbomLinesFrom(e("EBOM-00310").lines, MFG_ADDS_PAD), releasedOn: "2026-08-26", releasedBy: GRACE }),
  ]
}

// ============================================================== production versions (PV-001)
export function seedPvs(): PvRecord[] {
  const p = (x: Omit<PvRecord, "plantId" | "activity"> & Partial<PvRecord>): PvRecord => ({ plantId: "PL-TBD-01", activity: [], ...x })
  return [
    p({ id: "PV-TBD-0301", materialId: "FIN-TBD-20MVA", lotSizeFrom: 1, lotSizeTo: 3, validFrom: "2026-03-25", mbomId: "MBOM-TBD-0301", mbomRev: "B", routingId: "RTG-TBD-20MVA", routingRev: "B", status: "Released", createdOn: "2026-03-25", activity: [A("2026-03-25", "Engineering Manager", "Released; PV-TBD-0300 Superseded/Obsolete")] }),
    p({ id: "PV-TBD-0300", materialId: "FIN-TBD-20MVA", lotSizeFrom: 1, lotSizeTo: 3, validFrom: "2026-02-25", validTo: "2026-03-24", mbomId: "MBOM-TBD-0300", mbomRev: "A", routingId: "RTG-TBD-20MVA", routingRev: "A", status: "Superseded/Obsolete", createdOn: "2026-02-25" }),
    p({ id: "PV-TBD-0288", materialId: "FIN-TBD-5000SS", lotSizeFrom: 1, lotSizeTo: 5, validFrom: "2026-05-12", mbomId: "MBOM-TBD-0288", mbomRev: "B", routingId: "RTG-TBD-5000SS", routingRev: "C", status: "Released", createdOn: "2026-05-12" }),
    p({ id: "PV-TBD-0290", materialId: "FIN-TBD-2500PM", lotSizeFrom: 1, lotSizeTo: 10, validFrom: "2026-03-09", mbomId: "MBOM-TBD-0290", mbomRev: "A", routingId: "RTG-TBD-2500PM", routingRev: "B", status: "Released", createdOn: "2026-03-09", activity: [A("2026-03-09", "Engineering Manager", "Released (prototype routing, small lots)")] }),
    p({ id: "PV-TBD-0291", materialId: "FIN-TBD-2500PM", lotSizeFrom: 11, lotSizeTo: 50, validFrom: "2026-04-01", mbomId: "MBOM-TBD-0290", mbomRev: "A", routingId: "RTG-TBD-2500PS", routingRev: "A", status: "Released", createdOn: "2026-04-01", activity: [A("2026-04-01", "Engineering Manager", "Released (series routing, lots of 11 to 50)")] }),
    p({ id: "PV-TBD-0292", materialId: "FIN-TBD-2500PM", lotSizeFrom: 1, lotSizeTo: 10, validFrom: "2027-01-04", mbomId: "MBOM-TBD-0290", mbomRev: "A", routingId: "RTG-TBD-2500PM", routingRev: "C", status: "Draft", createdOn: "2026-10-05", activity: [A("2026-10-05", "Manufacturing engineer", "Paired MBOM-TBD-0290 rev A with RTG-TBD-2500PM rev C (new winding fixture)")] }),
    p({ id: "PV-TBD-0295", materialId: "FIN-TBD-1000PM", lotSizeFrom: 1, lotSizeTo: 25, validFrom: "2025-09-24", mbomId: "MBOM-TBD-0295", mbomRev: "B", routingId: "RTG-TBD-1000PM", routingRev: "A", status: "Released", createdOn: "2025-09-24" }),
    p({ id: "PV-TBD-0296", materialId: "FIN-TBD-0167PL", lotSizeFrom: 1, lotSizeTo: 200, validFrom: "2025-07-08", mbomId: "MBOM-TBD-0296", mbomRev: "C", routingId: "RTG-TBD-0167PL", routingRev: "B", status: "Released", createdOn: "2025-07-08" }),
    p({ id: "PV-TBD-0310", materialId: "FIN-TBD-7500MTO", lotSizeFrom: 1, lotSizeTo: 2, validFrom: "2026-08-26", mbomId: "MBOM-TBD-0310", mbomRev: "A", routingId: "RTG-TBD-7500", routingRev: "A", status: "Released", createdOn: "2026-08-26" }),
  ]
}

// ============================================================== controlled documents (ENG-DOC-001/2)
const TB = (drawnBy: UserId, x: Partial<TitleBlock> = {}): TitleBlock => ({ drawnBy, scale: "1:20", sheet: "1 of 1", size: "D", ...x })
const native = (id: string, rev: string, code: DocTypeCode) =>
  code === "WI" || code === "TP" || code === "TC" || code === "CERT" ? [`${id}_${rev}.docx`] : [`${id}_${rev}.SLDDRW`, `${id}_${rev}.STEP`]
function rev(id: string, code: DocTypeCode, r: string, status: DocRevisionX["status"], on: string, by: UserId, x: Partial<DocRevisionX> = {}): DocRevisionX {
  const released = status === "Released" || status === "Superseded" || status === "Obsolete"
  return {
    rev: r, status, files: native(id, r, code), native: native(id, r, code), rendition: released || status === "In Review" ? `${id}_${r}.pdf` : undefined,
    stamp: status === "Obsolete" ? `OBSOLETE Rev ${r}` : released ? `RELEASED Rev ${r} ${on}` : undefined,
    titleBlock: TB(by, { checkedBy: released ? HIRO : undefined, approvedBy: released ? HIRO : undefined, ...(code === "WI" || code === "TP" || code === "TC" || code === "CERT" ? { scale: "NTS", size: "A" as const } : {}) }),
    releasedOn: released ? on : undefined, redlines: [], checksum: fakeSha(`${id}${r}`), ...x,
  }
}
function doc(id: DocRecord["id"], typeCode: DocTypeCode, title: string, security: SecurityClass, createdOn: string, revisions: DocRevisionX[], linkedTo: DocRef[], x: Partial<DocRecord> = {}): DocRecord {
  return { id, typeCode, title, security, createdOn, revisions, linkedTo, activity: [], ...x }
}
const so301: DocRef = { type: "salesOrder", id: "SO-2026-00301" }
const fin20: DocRef = { type: "material", id: "FIN-TBD-20MVA" }

export function seedDocuments(): DocRecord[] {
  const proj = (p: string) => ({ project: p })
  return [
    doc("DOC-TBD-0301-GA", "GA", "General arrangement, 20 MVA ONAN/ONAF, Omaha North", "Customer-Shareable", "2026-02-02", [
      rev("DOC-TBD-0301-GA", "GA", "A", "Superseded", "2026-02-09", RAVI, { titleBlock: TB(RAVI, proj("SO-2026-00301 line 10")) }),
      rev("DOC-TBD-0301-GA", "GA", "B", "Superseded", "2026-02-18", RAVI, { titleBlock: TB(RAVI, { ...proj("SO-2026-00301 line 10"), checkedBy: HIRO, approvedBy: HIRO }) }),
      rev("DOC-TBD-0301-GA", "GA", "C", "Released", "2026-02-27", RAVI, { titleBlock: TB(RAVI, { ...proj("SO-2026-00301 line 10"), checkedBy: ELENA, approvedBy: HIRO, sheet: "1 of 3" }) }),
    ], [fin20, so301, { type: "ebom", id: "EBOM-TBD-0301" }], { engineeringRequestId: "ER-TBD-0301", activity: [A("2026-02-27", "Engineering Manager", "Rev C released; rendition stamped RELEASED Rev C 2026-02-27"), A("2026-02-27", "Document control", "Sent on TR-TBD-0301 For Approval")] }),
    doc("DOC-NP-00301", "NP", "Nameplate, 20 MVA, Omaha North", "Customer-Shareable", "2026-02-03", [rev("DOC-NP-00301", "NP", "A", "Superseded", "2026-02-12", ELENA), rev("DOC-NP-00301", "NP", "B", "Released", "2026-03-16", ELENA, { titleBlock: TB(ELENA, { scale: "1:1", size: "B", checkedBy: RAVI, approvedBy: HIRO }) })], [fin20, so301], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-SCH-00301", "SCH", "Electrical schematic and wiring, 20 MVA control cabinet", "Customer-Shareable", "2026-02-04", [rev("DOC-SCH-00301", "SCH", "A", "Released", "2026-03-10", RAVI, { titleBlock: TB(RAVI, { scale: "NTS", sheet: "1 of 6", checkedBy: ELENA, approvedBy: HIRO }) })], [fin20, so301], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-COR-00301", "COR", "Core and coil design sheet, 20 MVA", "Internal", "2026-01-22", [rev("DOC-COR-00301", "COR", "A", "Released", "2026-02-19", RAVI)], [fin20, { type: "material", id: "SEMI-TBD-CORE20" }, { type: "ebom", id: "EBOM-TBD-0301" }], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-WND-00301", "WND", "Winding diagrams HV disc and LV foil, 20 MVA", "Internal", "2026-01-22", [rev("DOC-WND-00301", "WND", "A", "Released", "2026-02-19", ELENA)], [fin20, { type: "material", id: "SEMI-TBD-HVC20" }, { type: "material", id: "SEMI-TBD-LVC20" }], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-TNK-00301", "TNK", "Tank fabrication drawings, 20 MVA main tank", "Internal", "2026-01-23", [rev("DOC-TNK-00301", "TNK", "A", "Superseded", "2026-02-10", ELENA), rev("DOC-TNK-00301", "TNK", "B", "Released", "2026-02-24", ELENA, { titleBlock: TB(ELENA, { sheet: "1 of 9", size: "E", checkedBy: RAVI, approvedBy: HIRO }) })], [fin20, { type: "material", id: "SEMI-TBD-TANK20" }], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-TP-00301", "TP", "Test plan, routine tests IEEE C57.12.90, 20 MVA", "Customer-Shareable", "2026-02-05", [rev("DOC-TP-00301", "TP", "A", "Released", "2026-03-13", RAVI)], [fin20, so301], { engineeringRequestId: "ER-TBD-0301" }),
    doc("DOC-GA-00377", "GA", "General arrangement, 20 MVA phase 2 (bushing change)", "Customer-Shareable", "2026-07-06", [rev("DOC-GA-00377", "GA", "A", "WIP", "2026-07-06", ELENA, { checkedOutBy: ELENA, checkedOutSince: "2026-10-06", titleBlock: TB(ELENA, proj("SO-2026-00377 line 10")) })], [fin20, { type: "salesOrder", id: "SO-2026-00377" }, { type: "ebom", id: "EBOM-TBD-0377" }], { engineeringRequestId: "ER-TBD-0377", activity: [A("2026-10-06", "Engineer", "Checked out by Elena Petrova")] }),
    doc("DOC-NP-00377", "NP", "Nameplate, 20 MVA phase 2, serials 0377-1 to 0377-3", "Customer-Shareable", "2026-07-06", [rev("DOC-NP-00377", "NP", "A", "In Review", "2026-10-02", ELENA, { titleBlock: TB(ELENA, { scale: "1:1", size: "B" }), redlines: [
      { id: "MK-0001", by: HIRO, on: "2026-10-05", text: "Add CSA mark field is not needed (US site); confirm BIL 450 kV on HV line.", page: 1, x: 62, y: 38 },
      { id: "MK-0002", by: RAVI, on: "2026-10-06", text: "Serial range reads 0377-1 to 0377-3; match the order line.", page: 1, x: 30, y: 62, resolved: true, resolvedBy: ELENA },
      { id: "MK-0003", by: HIRO, on: "2026-10-07", text: "Impedance tolerance must read +/-7.5% per the quote.", page: 1, x: 82, y: 14 },
    ] })], [fin20, { type: "salesOrder", id: "SO-2026-00377" }], { engineeringRequestId: "ER-TBD-0377" }),
    doc("DOC-TP-00377", "TP", "Test plan, phase 2 units incl. witness heat run", "Customer-Shareable", "2026-08-12", [rev("DOC-TP-00377", "TP", "A", "WIP", "2026-08-12", RAVI)], [fin20, { type: "salesOrder", id: "SO-2026-00377" }], { engineeringRequestId: "ER-TBD-0377" }),
    doc("DOC-GA-00366", "GA", "General arrangement, 20 MVA, Alma 120 kV - 25 kV", "Customer-Shareable", "2026-08-06", [rev("DOC-GA-00366", "GA", "A", "Released", "2026-09-25", RAVI, { titleBlock: TB(RAVI, { ...proj("SO-2026-00366 line 10"), approvedBy: HIRO, checkedBy: ELENA }) })], [fin20, { type: "salesOrder", id: "SO-2026-00366" }], { engineeringRequestId: "ER-TBD-0366" }),
    doc("DOC-GA-00384", "GA", "General arrangement, 5 MVA, Delta BC 34.5 kV", "Customer-Shareable", "2026-09-15", [rev("DOC-GA-00384", "GA", "A", "WIP", "2026-09-15", ELENA)], [{ type: "material", id: "FIN-TBD-5000SS" }], { engineeringRequestId: "ER-2026-0384" }),
    doc("DOC-GA-00371", "GA", "General arrangement, 5 MVA, Minot substation", "Customer-Shareable", "2026-08-20", [rev("DOC-GA-00371", "GA", "A", "WIP", "2026-08-20", RAVI)], [{ type: "material", id: "FIN-TBD-5000SS" }], { engineeringRequestId: "ER-2026-0371" }),
    doc("DOC-GA-00389", "GA", "General arrangement, 7.5 MVA pad-mount, stainless tank", "Customer-Shareable", "2026-08-05", [rev("DOC-GA-00389", "GA", "A", "Released", "2026-08-19", RAVI)], [{ type: "material", id: "FIN-TBD-7500MTO" }, { type: "salesOrder", id: "SO-2026-00389" }], { engineeringRequestId: "ER-2026-0389" }),
    doc("DOC-GA-00402", "GA", "General arrangement, 7.5 MVA pad-mount, Lakeshore North", "Customer-Shareable", "2026-10-07", [rev("DOC-GA-00402", "GA", "A", "WIP", "2026-10-07", RAVI)], [{ type: "material", id: "FIN-TBD-7500MTO" }, { type: "salesOrder", id: "SO-2026-00402" }], { engineeringRequestId: "ER-2026-0402" }),
    doc("DOC-GA-00352", "GA", "General arrangement, 5 MVA, Butte mill switchyard (as-built)", "Customer-Shareable", "2026-05-04", [rev("DOC-GA-00352", "GA", "A", "Released", "2026-05-11", ELENA)], [{ type: "material", id: "FIN-TBD-5000SS" }], { engineeringRequestId: "ER-TBD-0352" }),
    doc("DOC-GA-00288", "GA", "General arrangement, 5 MVA secondary unit substation", "Customer-Shareable", "2025-11-03", [rev("DOC-GA-00288", "GA", "C", "Superseded", "2026-05-08", ELENA), rev("DOC-GA-00288", "GA", "D", "Released", "2026-09-01", ELENA)], [{ type: "material", id: "FIN-TBD-5000SS" }, { type: "ebom", id: "EBOM-00288" }]),
    doc("DOC-GA-00290", "GA", "General arrangement, 2,500 kVA pad-mount", "Customer-Shareable", "2026-02-02", [rev("DOC-GA-00290", "GA", "A", "Released", "2026-03-02", ELENA), rev("DOC-GA-00290", "GA", "B", "In Review", "2026-10-06", ELENA, { redlines: [{ id: "MK-0004", by: HIRO, on: "2026-10-07", text: "Cover flange plate 16 mm per ECO-2026-0009; update weld symbol W4.", page: 1, x: 40, y: 34 }] })], [{ type: "material", id: "FIN-TBD-2500PM" }, { type: "ebom", id: "EBOM-00290" }]),
    doc("DOC-GA-00244", "GA", "General arrangement, 2,500 kVA pad-mount (legacy)", "Customer-Shareable", "2023-04-11", [rev("DOC-GA-00244", "GA", "D", "Superseded", "2024-06-14", ELENA)], [{ type: "ebom", id: "EBOM-TBD-0244" }]),
    doc("DOC-GA-00102", "GA", "General arrangement, 50 kVA pole-mount (legacy)", "Customer-Shareable", "2019-09-30", [rev("DOC-GA-00102", "GA", "F", "Obsolete", "2026-01-15", RAVI)], [{ type: "ebom", id: "EBOM-00102" }], { activity: [A("2026-01-15", "Engineering Manager", "Obsoleted; stamped OBSOLETE and excluded from all pick-up points")] }),
    doc("DOC-NP-00296", "NP", "Nameplate, 167 kVA pole-mount", "Customer-Shareable", "2025-03-10", [rev("DOC-NP-00296", "NP", "A", "Released", "2025-07-01", RAVI, { titleBlock: TB(RAVI, { scale: "1:1", size: "A", checkedBy: ELENA, approvedBy: HIRO }) }), rev("DOC-NP-00296", "NP", "B", "In Review", "2026-09-30", RAVI, { titleBlock: TB(RAVI, { scale: "1:1", size: "A" }) })], [{ type: "material", id: "FIN-TBD-0167PL" }, { type: "ebom", id: "EBOM-00296" }]),
    doc("DOC-WI-00410", "WI", "Work instruction: vapor phase drying cycle, 20 MVA active part", "Internal", "2025-10-01", [rev("DOC-WI-00410", "WI", "B", "Superseded", "2026-01-12", GRACE), rev("DOC-WI-00410", "WI", "C", "Released", "2026-03-20", GRACE)], [{ type: "material", id: "FIN-TBD-20MVA" }]),
    doc("DOC-WI-00415", "WI", "Work instruction: HV bushing installation and torque sequence, 145 kV", "Internal", "2025-10-01", [rev("DOC-WI-00415", "WI", "A", "Superseded", "2026-01-12", GRACE), rev("DOC-WI-00415", "WI", "B", "Released", "2026-03-20", GRACE), rev("DOC-WI-00415", "WI", "C", "In Review", "2026-10-05", GRACE, { redlines: [{ id: "MK-0005", by: HIRO, on: "2026-10-06", text: "Add flange seal inspection step from CAPA-TBD-0015 containment.", page: 1, x: 50, y: 55 }] })], [{ type: "material", id: "RAW-TBD-BSH145" }]),
    doc("DOC-TC-00003", "TC", "Terms and conditions template, engineered transformers (US)", "Customer-Shareable", "2025-01-06", [rev("DOC-TC-00003", "TC", "A", "Released", "2025-01-20", PAUL)], []),
    doc("DOC-CERT-00007", "CERT", "Routine test certificate template, IEEE C57.12.90", "Customer-Shareable", "2025-02-11", [rev("DOC-CERT-00007", "CERT", "A", "Superseded", "2025-03-01", PAUL), rev("DOC-CERT-00007", "CERT", "B", "Released", "2026-01-08", PAUL)], []),
    doc("DOC-SCH-00097", "SCH", "Protection relay settings and firmware map (export-controlled)", "Restricted", "2026-04-14", [rev("DOC-SCH-00097", "SCH", "A", "Released", "2026-05-02", RAVI)], [{ type: "material", id: "FIN-TBD-20MVA" }]),
  ]
}

// ============================================================== transmittals (TR-001)
export function seedTransmittals(): TransmittalRecord[] {
  return [
    { id: "TR-298", documentIds: ["DOC-TBD-0301-GA", "DOC-NP-00301"], revsSent: [{ documentId: "DOC-TBD-0301-GA", rev: "B" }, { documentId: "DOC-NP-00301", rev: "A" }], recipients: ["Midland Plains Grid Constructors, project engineering"], customerId: "CUS-TBD-0048", engineeringRequestId: "ER-TBD-0301", soId: "SO-2026-00301", purpose: "For Approval", sentOn: "2026-02-18", sentBy: PAUL, createdOn: "2026-02-18", responses: [{ recipient: "Midland Plains Grid Constructors, project engineering", response: "Revise & Resubmit", on: "2026-02-24" }], note: "Customer changed tap range to ±10% in 17 positions", activity: [A("2026-02-18", "Document control", "Sent For Approval"), A("2026-02-24", "Document control", "Response recorded: Revise & Resubmit; engineering request back to In Design")] },
    { id: "TR-TBD-0301", documentIds: ["DOC-TBD-0301-GA", "DOC-NP-00301", "DOC-SCH-00301"], revsSent: [{ documentId: "DOC-TBD-0301-GA", rev: "C" }, { documentId: "DOC-NP-00301", rev: "A" }, { documentId: "DOC-SCH-00301", rev: "A" }], recipients: ["Midland Plains Grid Constructors, project engineering"], customerId: "CUS-TBD-0048", engineeringRequestId: "ER-TBD-0301", soId: "SO-2026-00301", purpose: "For Approval", sentOn: "2026-02-27", sentBy: PAUL, createdOn: "2026-02-27", responses: [{ recipient: "Midland Plains Grid Constructors, project engineering", response: "Approved as Noted", on: "2026-03-06" }], note: "Approval drawings to Midland Plains", activity: [A("2026-02-27", "Document control", "Sent For Approval"), A("2026-03-06", "Document control", "Response recorded: Approved as Noted; design approval milestone evidence on SO-2026-00301")] },
    { id: "TR-326", documentIds: ["DOC-TBD-0301-GA", "DOC-TP-00301"], revsSent: [{ documentId: "DOC-TBD-0301-GA", rev: "C" }, { documentId: "DOC-TP-00301", rev: "A" }], recipients: ["Midland Plains Grid Constructors, site construction"], customerId: "CUS-TBD-0048", engineeringRequestId: "ER-TBD-0301", soId: "SO-2026-00301", purpose: "For Construction", sentOn: "2026-03-20", sentBy: PAUL, createdOn: "2026-03-20", responses: [], activity: [A("2026-03-20", "Document control", "Sent For Construction")] },
    { id: "TR-366", documentIds: ["DOC-GA-00366"], revsSent: [{ documentId: "DOC-GA-00366", rev: "A" }], recipients: ["Coopérative d'électricité du Lac-Saint-Jean, ingénierie"], customerId: "CUS-TBD-0044", engineeringRequestId: "ER-TBD-0366", soId: "SO-2026-00366", purpose: "For Approval", sentOn: "2026-09-28", sentBy: PAUL, createdOn: "2026-09-28", responses: [], activity: [A("2026-09-28", "Document control", "Sent For Approval; engineering request to Customer Review")] },
    { id: "TR-389", documentIds: ["DOC-GA-00389"], revsSent: [{ documentId: "DOC-GA-00389", rev: "A" }], recipients: ["Northern Saskatchewan Municipal Power and Light Utility Commission, engineering"], customerId: "CUS-TBD-0052", engineeringRequestId: "ER-2026-0389", soId: "SO-2026-00389", purpose: "For Approval", sentOn: "2026-08-19", sentBy: PAUL, createdOn: "2026-08-19", responses: [{ recipient: "Northern Saskatchewan Municipal Power and Light Utility Commission, engineering", response: "Approved", on: "2026-08-20" }], activity: [A("2026-08-20", "Document control", "Response recorded: Approved")] },
    { id: "TR-352", documentIds: ["DOC-GA-00352"], revsSent: [{ documentId: "DOC-GA-00352", rev: "A" }], recipients: ["Granite Peak Mining Operations, maintenance"], customerId: "CUS-TBD-0041", engineeringRequestId: "ER-TBD-0352", soId: "SO-2026-00352", purpose: "As-Built", sentOn: "2026-06-30", sentBy: PAUL, createdOn: "2026-06-30", responses: [], activity: [A("2026-06-30", "Document control", "Sent As-Built")] },
  ]
}

// ============================================================== engineering requests (ENG-REQ-001)
const CHECK = (rows: [key: string, item: string, ref?: DocRef, done?: boolean][]): ChecklistRow[] => rows.map(([key, item, ref, done]) => ({ key, item, ref, done: !!done }))
/** Deliverables generated from design type [DOC:p.59 §2] (asserted). Repeat needs no engineering. */
export function checklistFor(designType: ErRecord["designType"], refs: Partial<Record<string, DocRef>> = {}, done: string[] = []): ChecklistRow[] {
  const rows: [string, string][] = [
    ["ga", "GA drawing"], ["np", "Nameplate drawing"], ["sch", "Electrical schematic"], ["cor", "Core & coil design sheet"], ["wnd", "Winding diagrams"],
    ["tnk", "Tank/fabrication drawings"], ["acc", "Accessories list"], ["tp", "Test plan"], ["ebom", "EBOM"], ["mbom", "MBOM"], ["ce", "Cost estimate"],
  ]
  const use = designType === "Repeat" ? rows.filter(([k]) => k === "mbom") : rows
  return CHECK(use.map(([k, item]) => [k, item, refs[k], done.includes(k)]))
}
const cfg20 = (hv: string, lv: string, oltc: string, bil: string): [string, string][] => [
  ["Rating", "20 MVA ONAN / 26.7 MVA ONAF"], ["HV / LV", `${hv} / ${lv}`], ["Vector group", "YNd1"], ["Frequency", "60 Hz"], ["Impedance", "9.5% at 20 MVA"],
  ["Tap changer", oltc], ["HV BIL", bil], ["Cooling", "ONAN/ONAF, 2 fan groups"], ["Temperature rise", "65 °C winding"], ["Standard", "IEEE C57.12.00"],
]
const cfg5 = (hv: string): [string, string][] => [["Rating", "5 MVA ONAN"], ["HV / LV", `${hv} / 4.16 kV`], ["Vector group", "Dyn1"], ["Frequency", "60 Hz"], ["Tap changer", "De-energized, ±2 x 2.5%"], ["Standard", "IEEE C57.12.00"]]
const cfg75: [string, string][] = [["Rating", "7.5 MVA"], ["HV / LV", "24.94 kV / 600Y/347 V"], ["Tank", "Stainless steel 304L"], ["Frequency", "60 Hz"], ["Standard", "CSA C227.4"]]

function er(p: Omit<ErRecord, "due" | "activity" | "createdBy" | "reviewLoops"> & Partial<ErRecord>): ErRecord {
  return { createdBy: "USR-TBD-002", reviewLoops: 0, activity: [], due: addDays(p.promisedShip, -(p.productionLeadDays + p.longLeadDays)), ...p }
}
const d = (id: string): DocRef => ({ type: "document", id })

export function seedRequests(): ErRecord[] {
  return [
    er({
      id: "ER-TBD-0301", soId: "SO-2026-00301", soLine: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", title: "Design: 20 MVA ONAN/ONAF, 115 kV - 13.8 kV, OLTC 17 positions",
      designType: "New Design", status: "Closed", releaseLevel: "Released for Production", assigneeIds: [RAVI, ELENA], customerApprovalRequired: true, customerApprovalEvidence: "TR-TBD-0301", reviewLoops: 1,
      promisedShip: "2026-08-10", productionLeadDays: 98, longLeadDays: 45, createdOn: "2026-01-12", config: cfg20("115 kV", "13.8 kV", "OLTC ±10%, 17 positions", "450 kV"),
      checklist: checklistFor("New Design", { ga: d("DOC-TBD-0301-GA"), np: d("DOC-NP-00301"), sch: d("DOC-SCH-00301"), cor: d("DOC-COR-00301"), wnd: d("DOC-WND-00301"), tnk: d("DOC-TNK-00301"), tp: d("DOC-TP-00301"), ebom: { type: "ebom", id: "EBOM-TBD-0301" }, mbom: { type: "mbom", id: "MBOM-TBD-0301" }, ce: { type: "costEstimate", id: "CE-TBD-0301" } }, ["acc", "ce"]),
      activity: [
        A("2026-01-12", "System", "Created automatically at SO-2026-00301 confirmation (ETO line 10)"),
        A("2026-01-13", "Engineering Manager", "Assigned Ravi Shankar (electrical) and Elena Petrova (mechanical); status In Design"),
        A("2026-01-26", "Engineering Manager", "Release level Long-Lead Purchase Release (LLR): LLR-2026-0004"),
        A("2026-02-18", "Document control", "TR-298 sent; Customer Review"),
        A("2026-02-24", "Document control", "Revise & Resubmit (tap range); back to In Design"),
        A("2026-02-27", "Document control", "TR-TBD-0301 sent; Customer Review"),
        A("2026-03-06", "Document control", "Approved as Noted; design approval milestone evidence recorded"),
        A("2026-03-20", "Engineering Manager", "Released for Production"),
        A("2026-03-25", "Engineering Manager", "Closed: every deliverable done"),
      ],
    }),
    er({
      id: "ER-TBD-0377", soId: "SO-2026-00377", soLine: 10, customerId: "CUS-TBD-0048", itemId: "FIN-TBD-20MVA", title: "Design: phase 2, three units from rev B with bushing change",
      designType: "Variant of Existing", baseDesignEbomId: "EBOM-TBD-0301", status: "In Design", releaseLevel: "Long-Lead Purchase Release (LLR)", assigneeIds: [ELENA, RAVI], customerApprovalRequired: true,
      promisedShip: "2027-03-15", productionLeadDays: 98, longLeadDays: 45, createdOn: "2026-06-15", config: cfg20("115 kV", "13.8 kV", "OLTC ±10%, 17 positions", "450 kV"),
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00377"), np: d("DOC-NP-00377"), sch: d("DOC-SCH-00301"), cor: d("DOC-COR-00301"), wnd: d("DOC-WND-00301"), tnk: d("DOC-TNK-00301"), tp: d("DOC-TP-00377"), ebom: { type: "ebom", id: "EBOM-TBD-0377" } }),
      readings: ["OQ-21"],
      activity: [
        A("2026-06-15", "System", "Created automatically at SO-2026-00377 confirmation (ETO line 10)"),
        A("2026-06-16", "Engineering Manager", "Variant of Existing: base design EBOM-TBD-0301 rev B; assigned Elena Petrova, Ravi Shankar"),
        A("2026-09-30", "Engineering Manager", "Release level Long-Lead Purchase Release (LLR): LLR-2026-0011 sent for approval"),
        A("2026-10-03", "Engineering Manager", "Bushing line under review after RCL-2026-001"),
      ],
    }),
    er({
      id: "ER-TBD-0366", soId: "SO-2026-00366", soLine: 10, customerId: "CUS-TBD-0044", itemId: "FIN-TBD-20MVA", title: "Design: 20 MVA variant, 120 kV - 25 kV, Alma substation",
      designType: "Variant of Existing", baseDesignEbomId: "EBOM-TBD-0301", status: "Customer Review", releaseLevel: "Preliminary / RFQ Package", assigneeIds: [RAVI], customerApprovalRequired: true,
      promisedShip: "2027-05-28", productionLeadDays: 98, longLeadDays: 45, createdOn: "2026-08-03", config: cfg20("120 kV", "25 kV", "OLTC ±10%, 17 positions", "550 kV"),
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00366"), ebom: { type: "ebom", id: "EBOM-00366" } }, ["sch", "cor", "wnd"]),
      activity: [A("2026-08-03", "System", "Created automatically at SO-2026-00366 confirmation"), A("2026-09-28", "Document control", "TR-366 sent For Approval; Customer Review")],
    }),
    er({
      id: "ER-2026-0384", soId: "SO-2026-00384", soLine: 10, customerId: "CUS-TBD-0035", itemId: "FIN-TBD-5000SS", title: "Design: 5 MVA variant, 34.5 kV, Delta BC",
      designType: "Variant of Existing", baseDesignEbomId: "EBOM-00288", status: "In Design", releaseLevel: "Concept", assigneeIds: [ELENA], customerApprovalRequired: false,
      promisedShip: "2027-01-22", productionLeadDays: 63, longLeadDays: 35, createdOn: "2026-09-12", config: cfg5("34.5 kV"),
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00384"), ebom: { type: "ebom", id: "EBOM-00384" } }),
      activity: [A("2026-09-12", "System", "Created automatically at SO-2026-00384 confirmation"), A("2026-09-13", "Engineering Manager", "Assigned Elena Petrova; customer approval loop off (EPC contractor, standard design)")],
    }),
    er({
      id: "ER-2026-0371", soId: "SO-2026-00371", soLine: 10, customerId: "CUS-TBD-0031", itemId: "FIN-TBD-5000SS", title: "Design: 5 MVA substation unit, Minot, seismic bracing",
      designType: "Variant of Existing", baseDesignEbomId: "EBOM-00288", status: "Blocked", statusBeforeBlock: "In Design", blockedReason: "Customer has not supplied the site seismic zone and anchorage data (requested 2026-09-02)",
      releaseLevel: "Concept", assigneeIds: [RAVI], customerApprovalRequired: true, promisedShip: "2026-12-18", productionLeadDays: 63, longLeadDays: 35, createdOn: "2026-08-19", config: cfg5("69 kV"),
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00371") }),
      activity: [A("2026-08-19", "System", "Created automatically at SO-2026-00371 confirmation"), A("2026-09-02", "Engineering Manager", "Blocked: waiting for site seismic data")],
    }),
    er({
      id: "ER-2026-0389", soId: "SO-2026-00389", soLine: 10, customerId: "CUS-TBD-0052", itemId: "FIN-TBD-7500MTO", title: "Design: 7.5 MVA pad-mount, stainless tank, Prince Albert",
      designType: "Variant of Existing", status: "Released", releaseLevel: "Released for Production", assigneeIds: [RAVI], customerApprovalRequired: true, customerApprovalEvidence: "TR-389",
      promisedShip: "2026-11-20", productionLeadDays: 49, longLeadDays: 28, createdOn: "2026-08-03", config: cfg75,
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00389"), ebom: { type: "ebom", id: "EBOM-00310" }, mbom: { type: "mbom", id: "MBOM-TBD-0310" }, ce: { type: "costEstimate", id: "CE-TBD-0389" } }, ["np", "sch", "cor", "wnd", "tnk", "acc"]),
      activity: [A("2026-08-03", "System", "Created automatically at SO-2026-00389 confirmation (MTO line)"), A("2026-08-20", "Document control", "TR-389 Approved"), A("2026-08-26", "Engineering Manager", "Released for Production")],
    }),
    er({
      id: "ER-2026-0402", soId: "SO-2026-00402", soLine: 10, customerId: "CUS-TBD-0027", itemId: "FIN-TBD-7500MTO", title: "Design: 7.5 MVA pad-mount, Lakeshore North substation",
      designType: "Variant of Existing", baseDesignEbomId: "EBOM-00310", status: "Open", releaseLevel: "Concept", assigneeIds: [], customerApprovalRequired: false,
      promisedShip: "2026-11-30", productionLeadDays: 49, longLeadDays: 28, createdOn: "2026-10-06", config: cfg75,
      checklist: checklistFor("Variant of Existing", { ga: d("DOC-GA-00402"), ebom: { type: "ebom", id: "EBOM-00312" } }),
      activity: [A("2026-10-06", "System", "Created automatically at SO-2026-00402 confirmation (MTO line); waiting for assignment")],
    }),
    er({
      id: "ER-TBD-0352", soId: "SO-2026-00352", soLine: 10, customerId: "CUS-TBD-0041", itemId: "FIN-TBD-5000SS", title: "Repeat: 5 MVA secondary unit substation, Butte mill",
      designType: "Repeat", baseDesignEbomId: "EBOM-00288", status: "Closed", releaseLevel: "Released for Production", assigneeIds: [], customerApprovalRequired: false,
      promisedShip: "2026-06-26", productionLeadDays: 63, longLeadDays: 0, createdOn: "2026-04-21", config: cfg5("13.8 kV"),
      checklist: checklistFor("Repeat", { mbom: { type: "mbom", id: "MBOM-TBD-0288" } }),
      activity: [A("2026-04-21", "System", "Created at SO-2026-00352 confirmation; Repeat design: request auto-completed and the MBOM released immediately")],
    }),
  ]
}

// ============================================================== ECR / ECO (ENG-ECR/ECO)
export function seedEcrs(): EcrRecord[] {
  const base = (x: Omit<EcrRecord, "affected" | "emergency" | "impactSnapshot" | "activity" | "docChanges"> & Partial<EcrRecord>): EcrRecord => ({
    affected: [], emergency: x.priority === "Emergency", impactSnapshot: "", activity: [], docChanges: [], ...x,
  })
  return [
    base({
      id: "ECR-2026-0020", title: "OLTC diverter: replace contact spring after field flashover", source: "RMA/Field Failure", requestedBy: "USR-TBD-036", raisedOn: "2026-10-07",
      description: "Replace the diverter switch contact spring on the 17-position OLTC with the reinforced spring kit.", reason: "Flashover in the diverter compartment on a field unit; spring fatigue found at teardown (safety).",
      classification: "Safety/Regulatory", priority: "Emergency", stage: "Submitted to CCB", submittedOn: "2026-10-07", ccbDueBy: "2026-10-08",
      votes: [{ role: "Quality Manager", vote: "Approve", by: "USR-TBD-037", on: "2026-10-07" }],
      affected: [{ type: "material", id: "RAW-TBD-OLTC" }],
      impact: { openWos: [], stock: [], openPos: [], openSoLines: [], costCurrent: 0, customers: [] },
      narrative: "Spring kit is a drop-in replacement; no drawing change.", risk: "High until decided: units in the field run on the old spring.", costDelta: 2400, changes: [],
      activity: [A("2026-10-07", "Quality engineer", "Raised from a field failure"), A("2026-10-07", "Quality engineer", "Submitted to CCB: Engineering Manager, Quality Manager, Production supervisor; Emergency, decision due by 2026-10-08 (24 h)"), A("2026-10-07", "Quality Manager", "CCB vote: Quality Manager Approve")],
    }),
    base({
      id: "ECR-2026-0019", title: "HV bushing 145 kV: revised flange seal and second source", source: "Quality (NCR link)", sourceRef: { type: "ncr", id: "NCR-TBD-0044" }, requestedBy: "USR-TBD-036", raisedOn: "2026-10-04",
      description: "Replace the flange seal arrangement on the 145 kV condenser bushing (H1-H3) with the FS2 double O-ring design, and qualify a second source.", reason: "Oil weep at flange on SN-TBD-BSH-0302 (RMA-TBD-0012); root cause suspected in vendor batch HP-26-0412. CAPA-TBD-0015 containment through RCL-2026-001.",
      classification: "Quality/CAPA", priority: "Urgent", stage: "Draft",
      affected: [{ type: "ebom", id: "EBOM-TBD-0301" }, { type: "document", id: "DOC-TBD-0301-GA" }, { type: "material", id: "RAW-TBD-BSH145" }, { type: "document", id: "DOC-WI-00415" }],
      impact: { openWos: [], stock: [{ itemId: "RAW-TBD-BSH145", qty: 6, value: 113400 }], openPos: [], openSoLines: [{ id: "SO-2026-00377", line: 10, customerId: "CUS-TBD-0048" }], costCurrent: 1_022_480, costSimulated: 1_036_880, customers: [{ customerId: "CUS-TBD-0048", serials: "SN-TBD-20M-0301 (3 bushings in the field)" }] },
      narrative: "Phase 2 has not started production (planned orders only), so the change can take effect from the first phase 2 serial. Phase 1 unit stays on rev B; field units handled by the recall.", risk: "Medium: seal design is catalog at the vendor; second source needs first article inspection.",
      costDelta: 14400, changes: [{ ebomId: "EBOM-TBD-0301", ops: [{ kind: "replace", line: 60, componentId: "SPARE-TBD-BSH145" }] }], docChanges: ["DOC-WI-00415"],
      activity: [A("2026-10-04", "Quality engineer", "Raised from NCR-TBD-0044 (Propose Change)")],
    }),
    base({
      id: "ECR-2026-0016", title: "Phase 2 HV BIL raised to 550 kV at customer request", source: "Sales", sourceRef: { type: "salesOrder", id: "SO-2026-00377" }, requestedBy: "USR-TBD-001", raisedOn: "2026-10-08",
      description: "Customer asks for 550 kV BIL on the HV winding for the three phase 2 units.", reason: "Utility interconnection study for Omaha North requires higher BIL.", classification: "Customer Request", priority: "Standard", stage: "Draft",
      affected: [{ type: "ebom", id: "EBOM-00306" }, { type: "document", id: "DOC-WND-00301" }],
      impact: { openWos: [], stock: [], openPos: [{ id: "PO-TBD-0377", qty: 54000, value: 207900 }], openSoLines: [{ id: "SO-2026-00377", line: 10, customerId: "CUS-TBD-0048" }], costCurrent: 38_750, costSimulated: 44_100, customers: [] },
      narrative: "Needs a Sales Change Order after Design Release (FL-02 exception).", risk: "High: geometry still moving on HV winding.", costDelta: 5350, changes: [{ ebomId: "EBOM-00306", ops: [{ kind: "qty", line: 10, qty: 1520 }] }],
    }),
    base({
      id: "ECR-2026-0017", title: "Traveler note: torque values on radiator flange bolts", source: "Production", requestedBy: "USR-TBD-031", raisedOn: "2026-10-02",
      description: "Print torque values (M16: 210 N·m) on the traveler for line 42 radiators.", reason: "Two leaks at radiator flanges in final test this quarter.", classification: "Documentation Only", priority: "Standard", stage: "Draft",
      affected: [{ type: "ebom", id: "EBOM-00308" }], impact: { openWos: [], stock: [], openPos: [], openSoLines: [], costCurrent: 58_200, costSimulated: 58_200, customers: [] }, narrative: "", risk: "Low", costDelta: 0, changes: [],
    }),
    base({
      id: "ECR-2026-0015", title: "Tank cover flange plate 12 mm to 16 mm after pressure test failure", source: "Quality (NCR link)", requestedBy: "USR-TBD-036", raisedOn: "2026-09-29",
      description: "Increase cover flange plate thickness on the 2,500 kVA pad-mount tank.", reason: "Permanent deformation at 1.5 x design pressure on two units (safety).", classification: "Safety/Regulatory", priority: "Emergency", stage: "Approved", ccbOutcome: "Approve", ecoId: "ECO-2026-0009",
      affected: [{ type: "ebom", id: "EBOM-00290" }, { type: "document", id: "DOC-GA-00290" }],
      impact: { openWos: [{ id: "WO-TBD-0466", rev: "EBOM-00290 rev A", note: "In Progress, op 10 complete" }, { id: "WO-TBD-0471", rev: "EBOM-00290 rev A", note: "Released, not started" }], stock: [{ itemId: "RAW-TBD-PLATE", qty: 14200, value: 19170 }], openPos: [], openSoLines: [{ id: "SO-2026-00316", line: 20, customerId: "CUS-TBD-0027" }], costCurrent: 30_480, costSimulated: 30_682, customers: [{ customerId: "CUS-TBD-0027", serials: "SN-TBD-25P-0451, SN-TBD-25P-0452" }] },
      narrative: "Emergency: CCB decided within 24 h.", risk: "High until released", costDelta: 202, changes: [{ ebomId: "EBOM-00290", ops: [{ kind: "qty", line: 50, qty: 2050 }] }], docChanges: ["DOC-GA-00290"],
      activity: [A("2026-09-29", "Quality engineer", "Raised as Emergency"), A("2026-09-30", "Engineering Manager", "CCB: Approve (within 24 h); ECO-2026-0009 spawned")],
    }),
    base({
      id: "ECR-2026-0014", title: "Core steel: reduce stacked core mass for no-load loss target", source: "Engineering", requestedBy: RAVI, raisedOn: "2026-09-15",
      description: "Reduce CRGO mass on the 20 MVA stacked core by 350 kg with the 7-step step-lap joint.", reason: "Phase 2 guaranteed no-load loss; cost reduction.", classification: "Cost Reduction", priority: "Standard", stage: "Approved", ccbOutcome: "Approve", ecoId: "ECO-2026-0008",
      affected: [{ type: "ebom", id: "EBOM-00305" }, { type: "document", id: "DOC-COR-00301" }, { type: "material", id: "RAW-TBD-CRGO23" }],
      impact: { openWos: [], stock: [{ itemId: "RAW-TBD-CRGO23", qty: 22400, value: 86240 }], openPos: [{ id: "PO-TBD-0377", qty: 54000, value: 207900 }], openSoLines: [{ id: "SO-2026-00377", line: 10, customerId: "CUS-TBD-0048" }], costCurrent: 96_400, costSimulated: 95_053, customers: [] },
      narrative: "Touches the long-lead CRGO under LLR-2026-0011: commercial decision per PO required.", risk: "Medium: parametric spec stable.", costDelta: -1347, changes: [{ ebomId: "EBOM-00305", ops: [{ kind: "qty", line: 10, qty: 18250 }] }], docChanges: ["DOC-COR-00301"],
      activity: [A("2026-09-15", "Engineer", "Raised"), A("2026-09-22", "Engineering Manager", "CCB: Approve; ECO-2026-0008 spawned")],
    }),
    base({
      id: "ECR-2026-0013", title: "Nameplate: add CSA mark and bilingual text for Canadian orders", source: "Sales", requestedBy: "USR-TBD-004", raisedOn: "2026-09-08",
      description: "Bilingual nameplate (English / French) with CSA mark for the 167 kVA pole-mount.", reason: "Canadian utility orders (Quebec).", classification: "Customer Request", priority: "Standard", stage: "Approved", ccbOutcome: "Approve", ecoId: "ECO-2026-0010",
      affected: [{ type: "ebom", id: "EBOM-00296" }, { type: "document", id: "DOC-NP-00296" }],
      impact: { openWos: [{ id: "WO-TBD-0480", rev: "EBOM-00296 rev C", note: "Released, lot of 40" }], stock: [], openPos: [], openSoLines: [], costCurrent: 5_410, costSimulated: 5_418, customers: [] },
      narrative: "Serial effectivity: units from SN-TBD-0167-1142 carry the new plate.", risk: "Low", costDelta: 8, changes: [], docChanges: ["DOC-NP-00296"],
      activity: [A("2026-09-08", "Customer Service Manager", "Raised"), A("2026-09-12", "Engineering Manager", "CCB: Approve; ECO-2026-0010 spawned")],
    }),
    base({
      id: "ECR-2026-0012", title: "CRGO alternate grade on 5 MVA core (cost reduction)", source: "Purchasing", requestedBy: "USR-TBD-041", raisedOn: "2026-07-20",
      description: "Accept the M-OH grade from the second mill on the 5 MVA unit core and trim core mass by 200 kg.", reason: "Mill surcharge on the current grade; loss delta +0.4% inside guarantee.", classification: "Cost Reduction", priority: "Standard", stage: "Approved", ccbOutcome: "Approve", ecoId: "ECO-2026-0007",
      affected: [{ type: "ebom", id: "EBOM-00288" }, { type: "document", id: "DOC-GA-00288" }],
      impact: { openWos: [], stock: [{ itemId: "RAW-TBD-CRGO23", qty: 22400, value: 86240 }], openPos: [], openSoLines: [], costCurrent: 149_900, costSimulated: 149_130, customers: [] },
      narrative: "", risk: "Low", costDelta: -770, changes: [{ ebomId: "EBOM-00288", ops: [{ kind: "qty", line: 10, qty: 7400 }] }], docChanges: ["DOC-GA-00288"],
      activity: [A("2026-07-28", "Engineering Manager", "CCB: Approve; ECO-2026-0007 spawned")],
    }),
    base({
      id: "ECR-2026-0011", title: "LV bushing 15 kV: move to second source", source: "Purchasing", requestedBy: "USR-TBD-039", raisedOn: "2026-09-23",
      description: "Make VEN-TBD-0104 the rank 1 source for RAW-TBD-BSH015.", reason: "VEN-TBD-0112 Restricted (two overdue SCARs); Purchasing Block on the material.", classification: "Supply Continuity", priority: "Urgent", stage: "Deferred", ccbOutcome: "Defer", ccbReason: "Wait for SCAR responses due 2026-10-16 before changing the design source.",
      affected: [{ type: "material", id: "RAW-TBD-BSH015" }], impact: { openWos: [], stock: [{ itemId: "RAW-TBD-BSH015", qty: 46, value: 57040 }], openPos: [], openSoLines: [], costCurrent: 1_240, costSimulated: 1_310, customers: [] }, narrative: "", risk: "Medium", costDelta: 70, changes: [],
      activity: [A("2026-09-25", "Engineering Manager", "CCB: Defer (recorded before the shared engine; reason kept)")],
    }),
    base({
      id: "ECR-2026-0010", title: "Thinner tank plate on 5 MVA unit (cost reduction)", source: "Engineering", requestedBy: ELENA, raisedOn: "2026-06-30",
      description: "Tank plate from 12 mm to 10 mm on the 5 MVA unit.", reason: "Weight and cost.", classification: "Cost Reduction", priority: "Standard", stage: "Rejected", ccbOutcome: "Reject", ccbReason: "Fails the seismic qualification margin for West Coast utilities.",
      affected: [{ type: "ebom", id: "EBOM-00288" }], impact: { openWos: [], stock: [], openPos: [], openSoLines: [], costCurrent: 149_900, costSimulated: 148_600, customers: [] }, narrative: "", risk: "High", costDelta: -1300, changes: [],
      activity: [A("2026-07-07", "Engineering Manager", "CCB: Reject")],
    }),
  ]
}

export function seedEcos(): EcoRecord[] {
  return [
    {
      id: "ECO-2026-0007", ecrIds: ["ECR-2026-0012"], title: "CRGO alternate grade, 5 MVA core", effectivity: "Date", effectiveOn: "2026-09-01", stage: "Released", createdOn: "2026-07-28", releasedOn: "2026-09-01", releasedBy: HIRO,
      stockDispositions: [{ itemId: "RAW-TBD-CRGO23", onHand: 22400, value: 86240, decision: "Use-Up" }], woDispositions: [], llrImpacts: [],
      tasks: [
        { no: 1, text: "Revise EBOM-00288 to rev C", ownerRole: "Engineer", done: true, due: "2026-08-15", doneBy: ELENA, doneOn: "2026-08-12" },
        { no: 2, text: "Revise drawing DOC-GA-00288 to rev D", ownerRole: "Engineer", done: true, due: "2026-08-15", doneBy: ELENA, doneOn: "2026-08-13" },
        { no: 3, text: "Run costing simulation", ownerRole: "Cost accountant", done: true, due: "2026-08-20", doneBy: "USR-TBD-011", doneOn: "2026-08-19" },
        { no: 4, text: "Update MBOM (regenerate through MBOM-TRF)", ownerRole: "Manufacturing engineer", done: true, due: "2026-08-25", doneBy: GRACE, doneOn: "2026-08-25", link: "/engineering/mbom-transform/MBOM-TBD-0288" },
        { no: 5, text: "Notify purchasing", ownerRole: "Buyer", done: true, due: "2026-08-25", doneBy: "USR-TBD-039", doneOn: "2026-08-21" },
      ],
      changes: [{ ebomId: "EBOM-00288", ops: [{ kind: "qty", line: 10, qty: 7400 }] }], docChanges: ["DOC-GA-00288"],
      cutover: [{ ref: { type: "ebom", id: "EBOM-00288" }, from: "B", to: "C" }, { ref: { type: "document", id: "DOC-GA-00288" }, from: "C", to: "D" }],
      activity: [A("2026-09-01", "Engineering Manager", "Released atomically at date effectivity 2026-09-01")],
    },
    {
      id: "ECO-2026-0008", ecrIds: ["ECR-2026-0014"], title: "Stacked core mass reduction, 20 MVA", effectivity: "Date", effectiveOn: "2026-11-02", stage: "Open", createdOn: "2026-09-22",
      stockDispositions: [{ itemId: "RAW-TBD-CRGO23", onHand: 22400, value: 86240 }], woDispositions: [], llrImpacts: [{ llrId: "LLR-2026-0011", poId: "PO-TBD-0377", itemId: "RAW-TBD-CRGO23" }],
      tasks: [
        { no: 1, text: "Revise EBOM-00305 to rev B", ownerRole: "Engineer", done: true, due: "2026-10-06", doneBy: RAVI, doneOn: "2026-10-01" },
        { no: 2, text: "Revise drawing DOC-COR-00301", ownerRole: "Engineer", done: false, due: "2026-10-13" },
        { no: 3, text: "Run costing simulation", ownerRole: "Cost accountant", done: true, due: "2026-10-06", doneBy: "USR-TBD-011", doneOn: "2026-10-02" },
        { no: 4, text: "Update MBOM", ownerRole: "Manufacturing engineer", done: false, due: "2026-10-20" },
        { no: 5, text: "Notify purchasing", ownerRole: "Buyer", done: false, due: "2026-10-13" },
        { no: 6, text: "Customer re-approval (design was customer-approved)", ownerRole: "Document control", done: false, due: "2026-10-27", mandatory: true, link: "/engineering/transmittals/new" },
      ],
      changes: [{ ebomId: "EBOM-00305", ops: [{ kind: "qty", line: 10, qty: 18250 }] }], docChanges: ["DOC-COR-00301"], activity: [A("2026-09-22", "System", "Spawned from ECR-2026-0014; customer re-approval task auto-added")],
    },
    {
      id: "ECO-2026-0009", ecrIds: ["ECR-2026-0015"], title: "Tank cover flange plate 16 mm, 2,500 kVA (Emergency)", effectivity: "Immediate", stage: "Open", createdOn: "2026-09-30", woHoldRequestedOn: "2026-09-30",
      stockDispositions: [{ itemId: "RAW-TBD-PLATE", onHand: 14200, value: 19170, decision: "Use-Up" }],
      woDispositions: [{ woId: "WO-TBD-0466", rev: "EBOM-00290 rev A", decision: "Stop & Rework" }, { woId: "WO-TBD-0471", rev: "EBOM-00290 rev A" }], llrImpacts: [],
      tasks: [
        { no: 1, text: "Revise EBOM-00290 to rev B", ownerRole: "Engineer", done: true, due: "2026-10-01", doneBy: ELENA, doneOn: "2026-09-30" },
        { no: 2, text: "Revise drawing DOC-GA-00290 to rev B", ownerRole: "Engineer", done: true, due: "2026-10-01", doneBy: ELENA, doneOn: "2026-10-06" },
        { no: 3, text: "Update routing (pressure test hold point)", ownerRole: "Manufacturing engineer", done: true, due: "2026-10-02", doneBy: GRACE, doneOn: "2026-10-02" },
        { no: 4, text: "Update inspection plan", ownerRole: "Quality engineer", done: false, due: "2026-10-03" },
        { no: 5, text: "Quality Manager joint release (Immediate effectivity)", ownerRole: "Quality Manager", done: false, due: "2026-10-03", mandatory: true },
      ],
      changes: [{ ebomId: "EBOM-00290", ops: [{ kind: "qty", line: 50, qty: 2050 }] }], docChanges: ["DOC-GA-00290"],
      activity: [A("2026-09-30", "System", "Spawned from ECR-2026-0015 (Emergency); joint release task added for Immediate effectivity")],
    },
    {
      id: "ECO-2026-0010", ecrIds: ["ECR-2026-0013"], title: "Bilingual CSA nameplate, 167 kVA pole-mount", effectivity: "Serial", fromSerial: "SN-TBD-0167-1142", stage: "Open", createdOn: "2026-09-12",
      stockDispositions: [], woDispositions: [{ woId: "WO-TBD-0480", rev: "EBOM-00296 rev C", decision: "Incorporate Change" }], llrImpacts: [],
      tasks: [
        { no: 1, text: "Revise drawing DOC-NP-00296 to rev B", ownerRole: "Engineer", done: true, due: "2026-09-30", doneBy: RAVI, doneOn: "2026-09-30" },
        { no: 2, text: "Notify purchasing (nameplate blanks)", ownerRole: "Buyer", done: true, due: "2026-10-02", doneBy: "USR-TBD-040", doneOn: "2026-10-01" },
        { no: 3, text: "Update inspection plan (nameplate check)", ownerRole: "Quality engineer", done: true, due: "2026-10-03", doneBy: "USR-TBD-036", doneOn: "2026-10-03" },
      ],
      changes: [], docChanges: ["DOC-NP-00296"], activity: [A("2026-09-12", "System", "Spawned from ECR-2026-0013")],
    },
  ]
}

// ============================================================== CAD connector (CAD-SYNC, CAD-IMP)
export function seedVaultEvents(): VaultEvent[] {
  const v = (id: string, at: string, vaultTx: string, kind: VaultEvent["kind"], object: string, state: VaultEvent["state"], x: Partial<VaultEvent> = {}): VaultEvent => ({ id, at, vaultTx, kind, object, state, attempts: state === "Delivered" ? 1 : state === "Queued" ? 0 : 3, ...x })
  return [
    v("VE-TBD-10421", "2026-10-09 08:42", "VTX-884213", "Assembly extraction", "PE-20MVA-PH2-ASM rev A.3", "Delivered", { ref: { type: "ebom", id: "EBOM-TBD-0377" }, proposalId: "IMP-TBD-0041" }),
    v("VE-TBD-10420", "2026-10-09 08:40", "VTX-884207", "Check-in", "PE-20MVA-PH2-GA.SLDDRW A.3", "Delivered", { ref: { type: "document", id: "DOC-GA-00377" } }),
    v("VE-TBD-10418", "2026-10-09 07:55", "VTX-884188", "Rendition publish", "DOC-NP-00296 rev B", "Failed", { ref: { type: "document", id: "DOC-NP-00296" }, error: "Title block mismatch: Checked By empty in CAD properties, vault attribute 'R. Shankar'. Publish blocked." }),
    v("VE-TBD-10417", "2026-10-09 07:51", "VTX-884180", "Attribute sync", "RAW-TBD-BSH145 part card", "Delivered", { ref: { type: "material", id: "RAW-TBD-BSH145" } }),
    v("VE-TBD-10415", "2026-10-08 16:20", "VTX-884101", "New part", "Fiber-optic WTI, 8 ch (no ERP number)", "Delivered", { ref: { type: "material", id: "RAW-TBD-PH0412" } }),
    v("VE-TBD-10412", "2026-10-08 15:02", "VTX-884077", "Rendition publish", "DOC-WI-00415 rev C", "Retrying", { ref: { type: "document", id: "DOC-WI-00415" }, error: "ERP endpoint timeout (HTTP 504); next retry in 10 min" }),
    v("VE-TBD-10409", "2026-10-08 11:37", "VTX-884002", "Release", "PE-2500PM-GA.SLDDRW B", "Failed", { ref: { type: "document", id: "DOC-GA-00290" }, error: "Broken external reference: PE-2500PM-COVER.SLDPRT missing from the release set; vault rule blocked release." }),
    v("VE-TBD-10405", "2026-10-08 09:14", "VTX-883951", "Check-in", "PE-7500-GA.SLDDRW A.2", "Delivered", { ref: { type: "document", id: "DOC-GA-00402" } }),
    v("VE-TBD-10401", "2026-10-07 17:48", "VTX-883890", "Assembly extraction", "PE-7500-LKS-ASM rev A.1", "Delivered", { ref: { type: "ebom", id: "EBOM-00312" }, proposalId: "IMP-TBD-0039" }),
    v("VE-TBD-10398", "2026-10-07 14:05", "VTX-883842", "Attribute sync", "SEMI-TBD-TANK20 part card", "Delivered", { ref: { type: "material", id: "SEMI-TBD-TANK20" } }),
    v("VE-TBD-10396", "2026-10-07 10:31", "VTX-883811", "Check-in", "PE-5000-DLT-GA.SLDDRW A.1", "Queued", { ref: { type: "document", id: "DOC-GA-00384" } }),
    v("VE-TBD-10390", "2026-10-06 16:12", "VTX-883740", "Attribute sync", "RAW-TBD-RAD part card", "Delivered", { ref: { type: "material", id: "RAW-TBD-RAD" } }),
    v("VE-TBD-10384", "2026-10-06 09:03", "VTX-883655", "Check-in", "PE-20MVA-PH2-NP.SLDDRW A", "Delivered", { ref: { type: "document", id: "DOC-NP-00377" } }),
    v("VE-TBD-10377", "2026-10-05 13:40", "VTX-883560", "Attribute sync", "SEMI-TBD-HVC20 part card", "Delivered", { ref: { type: "material", id: "SEMI-TBD-HVC20" } }),
  ]
}
export function seedConflicts(): SyncConflict[] {
  return [
    { id: "CF-TBD-0071", materialId: "RAW-TBD-BSH145", field: "Description", erpValue: "HV condenser bushing, 145 kV, 800 A", pdmValue: "HV condenser bushing 145 kV 800 A, FS2 flange seal", owner: "PDM", resolverRole: "Engineer", raisedOn: "2026-10-09", vaultTx: "VTX-884180" },
    { id: "CF-TBD-0070", materialId: "SEMI-TBD-TANK20", field: "Mass", erpValue: "11,850 kg", pdmValue: "12,040 kg", owner: "PDM", resolverRole: "Engineer", raisedOn: "2026-10-07", vaultTx: "VTX-883842" },
    { id: "CF-TBD-0069", materialId: "RAW-TBD-RAD", field: "UoM", erpValue: "EA", pdmValue: "SET", owner: "ERP", resolverRole: "Material steward", raisedOn: "2026-10-06", vaultTx: "VTX-883740" },
    { id: "CF-TBD-0066", materialId: "SEMI-TBD-HVC20", field: "Material group", erpValue: "Transformers", pdmValue: "Windings", owner: "ERP", resolverRole: "Material steward", raisedOn: "2026-10-05", vaultTx: "VTX-883560", resolved: { value: "Transformers", by: "USR-TBD-020", on: "2026-10-05", side: "ERP" } },
    { id: "CF-TBD-0061", materialId: "SEMI-TBD-CORE20", field: "Description", erpValue: "Stacked core, step-lap, 20 MVA three-limb", pdmValue: "Stacked core, step-lap 7, 20 MVA three-limb", owner: "PDM", resolverRole: "Engineer", raisedOn: "2026-09-30", vaultTx: "VTX-883102", resolved: { value: "Stacked core, step-lap, 20 MVA three-limb", by: RAVI, on: "2026-10-01", side: "ERP" } },
  ]
}
export function seedProposals(): ImportProposal[] {
  return [
    {
      id: "IMP-TBD-0041", ebomId: "EBOM-TBD-0377", source: "Vault assembly extraction", vaultTx: "VTX-884213", createdOn: "2026-10-09",
      lines: [
        { findNo: 10, partNo: "SEMI-TBD-CORE20", description: "Stacked core, step-lap, 20 MVA", qty: 1 },
        { findNo: 20, partNo: "SEMI-TBD-HVC20", description: "HV disc winding, 115 kV", qty: 3, refDes: "U, V, W" },
        { findNo: 30, partNo: "SEMI-TBD-LVC20", description: "LV foil winding, 13.8 kV", qty: 3 },
        { findNo: 40, partNo: "SEMI-TBD-TANK20", description: "Main tank, 20 MVA", qty: 1 },
        { findNo: 50, partNo: "RAW-TBD-OLTC", description: "OLTC 17 positions", qty: 1 },
        { findNo: 60, partNo: "", mpn: "HPP-145-800-FS2", description: "HV condenser bushing 145 kV 800 A, FS2 flange seal", qty: 3, refDes: "H1, H2, H3" },
        { findNo: 70, partNo: "RAW-TBD-BSH015", description: "LV bushing 15 kV", qty: 4, refDes: "X0-X3" },
        { findNo: 90, partNo: "RAW-TBD-OIL", description: "Mineral oil", qty: 21600 },
        { findNo: 95, partNo: "RAW-TBD-CT600", description: "Bushing CT 600:5 MR", qty: 3, refDes: "H1-H3" },
        { findNo: 96, partNo: "", mpn: "MRC-FOT-8CH", description: "Fiber-optic winding temperature monitor, 8 ch", qty: 1 },
        { findNo: 97, partNo: "", description: "Lifting lug, cast, 6 t", qty: 0 },
      ],
    },
    {
      id: "IMP-TBD-0039", ebomId: "EBOM-00312", source: "Vault assembly extraction", vaultTx: "VTX-883890", createdOn: "2026-10-07",
      lines: [{ findNo: 10, partNo: "RAW-TBD-CRGO23", description: "CRGO 0.23", qty: 5200 }], committed: { on: "2026-10-07", by: RAVI, added: 8, placeholders: 0 },
    },
  ]
}

/** All EBOM ids that are Released (for pickers that exclude Obsolete, C-16). */
export const isUsableEbom = (e: EbomRecord) => e.status !== "Obsolete"
export type { EbomId }


// ============================================================== CAD assemblies (FX-CAD-COMPARE, IF-17)
export function seedCad(eboms: EbomRecord[]): CadAssembly[] {
  const e = (id: string) => eboms.find((x) => x.id === id)!
  const asLine = (l: EbomLineX): ImportProposalLine => ({ findNo: l.no, partNo: l.componentId as string, description: itemDescription(l.componentId), qty: l.qty, refDes: l.refDes })
  // Phase 2 draft: the vault assembly is at A.3; the engineer last aligned with A.1.
  const ph2 = e("EBOM-TBD-0377").lines.map(asLine).map((l) => (l.findNo === 42 ? { ...l, qty: 10, refDes: "R1-R10 (ONAF)" } : l)).filter((l) => l.findNo !== 80)
  ph2.push({ findNo: 98, partNo: "RAW-TBD-CT600", description: "Neutral bushing CT 600:5 MR", qty: 1, refDes: "X0" })
  // Released 7500 MTO: newer vault revision B.1 changes a radiator count and adds a lifting lug.
  const mto = e("EBOM-00310").lines.map(asLine).map((l) => (l.partNo === "RAW-TBD-RAD" ? { ...l, qty: l.qty + 2 } : l))
  mto.push({ findNo: 90, partNo: "RAW-TBD-PLATE", description: "Tank steel plate, A572 Gr. 50, 12 mm (lifting lug blank)", qty: 120 })
  // Lakeshore: in sync.
  const lks = e("EBOM-00312").lines.map(asLine)
  return [
    { id: "PE-20MVA-PH2-ASM", ebomId: "EBOM-TBD-0377" as never, vaultRev: "A.3", alignedRev: "A.1", vaultTx: "VTX-884213", checkedInAt: "2026-10-09 08:42", lines: ph2 },
    { id: "PE-7500-PA-ASM", ebomId: "EBOM-00310" as never, vaultRev: "B.1", alignedRev: "A.4", vaultTx: "VTX-884166", checkedInAt: "2026-10-09 06:58", lines: mto },
    { id: "PE-7500-LKS-ASM", ebomId: "EBOM-00312" as never, vaultRev: "A.1", alignedRev: "A.1", vaultTx: "VTX-883890", checkedInAt: "2026-10-07 17:48", lines: lks },
  ]
}
const itemDescription = (id: string) => materialById(id)?.description ?? id

// ============================================================== PDM linkage (FX-CAD-PDM, Book III Part G §4)
export function seedPdm(): PdmLink[] {
  const k = (id: string, documentId: string, x: Partial<PdmLink>): PdmLink => ({ id, documentId: documentId as never, state: "In work (checked out)", activity: [], ...x })
  return [
    k("PL-TBD-001", "DOC-TBD-0301-GA", { vaultPath: "$/Transformers/20MVA/OmahaNorth/PE-20MVA-GA.SLDDRW", vaultRev: "C", state: "Released, rendition published", lastEvent: "2026-02-27 11:20", note: "Checksum verified; stamped RELEASED Rev C", activity: [A("2026-02-27", "System", "PDM release approved; rendition published to ERP (checksum verified)")] }),
    k("PL-TBD-002", "DOC-GA-00377", { vaultPath: "$/Transformers/20MVA/Phase2/PE-20MVA-PH2-GA.SLDDRW", vaultRev: "A.3", state: "In work (checked out)", lastEvent: "2026-10-09 08:40", note: "Checked out in the vault by Elena Petrova; the ERP document shows In-Work (informational). The released rendition is unaffected.", activity: [A("2026-10-06", "System", "Checked out at vault; ERP shows In-Work")] }),
    k("PL-TBD-003", "DOC-GA-00290", { vaultPath: "$/Transformers/PadMount/2500/PE-2500PM-GA.SLDDRW", vaultRev: "B", state: "Release approved", pdmCo: "PDM-CO-2231", linkedEco: "ECO-2026-0009" as never, lastEvent: "2026-10-08 11:37", note: "PDM release approved; the release set is blocked by a vault rule (broken external reference). ERP ECO tasks must be release-ready first.", activity: [A("2026-10-08", "System", "PDM release approved; waiting on the linked ERP ECO task set")] }),
    k("PL-TBD-004", "DOC-NP-00296", { vaultPath: "$/Transformers/PoleMount/167/PE-167PL-NP.SLDDRW", vaultRev: "B", state: "Publish failed", lastEvent: "2026-10-09 07:55", note: "Title block mismatch: Checked By empty in CAD properties. Publish blocked until the vault attribute is corrected.", activity: [A("2026-10-09", "System", "Rendition publish failed; queued for retry with alert")] }),
    k("PL-TBD-005", "DOC-WI-00415", { vaultPath: "$/WorkInstructions/HV-bushing-install.docx", vaultRev: "C", state: "Publish failed", lastEvent: "2026-10-08 15:02", note: "ERP endpoint timeout (HTTP 504). Transport failure: replay delivers it.", activity: [A("2026-10-08", "System", "Rendition publish failed: ERP endpoint timeout; retry queued")] }),
    k("PL-TBD-006", "DOC-GA-00288", { vaultPath: "$/Transformers/5MVA/SecondaryUnitSub/PE-5000SS-GA.SLDDRW", vaultRev: "D", state: "Change order opened", pdmCo: "PDM-CO-2240", lastEvent: "2026-10-09 09:15", note: "A PDM change order was opened on a released drawing. The connector proposes linking or creating an ERP ECR; the engineer confirms.", activity: [A("2026-10-09", "System", "PDM change order PDM-CO-2240 opened; ECR proposal waiting for the engineer")] }),
    k("PL-TBD-007", "DOC-GA-00244", { vaultPath: "$/Archive/PadMount/2500/PE-2500PM-LEGACY-GA.SLDDRW", vaultRev: "D", state: "Obsolete in PDM", lastEvent: "2026-10-09 10:02", note: "Marked obsolete in the vault. The ERP document follows only after the where-used sweep.", activity: [A("2026-10-09", "System", "Obsolete in PDM; ERP where-used sweep pending")] }),
    k("PL-TBD-008", "DOC-TC-00003", { state: "Not linked (ERP only)", note: "Terms and conditions template: authored in the ERP repository, no vault object.", activity: [] }),
  ]
}
