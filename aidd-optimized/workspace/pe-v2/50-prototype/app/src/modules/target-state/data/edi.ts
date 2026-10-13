// Full EDI (Book IX §5): partner profiles and envelopes. Transaction sets and their binding behavior are
// the PRD's (§5.1): 850, 860, 855, 856, 810, 997. Channels AS2 and SFTP at minimum (§5.2).
// Envelope parse states, partner stages and ack windows are design values shown with a Chip.

export type EdiSet = "850" | "860" | "855" | "856" | "810" | "997"
export const EDI_SETS: { set: EdiSet; name: string; dir: "Outbound" | "Inbound" | "Both"; binding: string }[] = [
  { set: "850", name: "Purchase order", dir: "Outbound", binding: "Generated at PO send from the PO object with the STP reference in the notes segment." },
  { set: "860", name: "Purchase order change", dir: "Outbound", binding: "A change order sends an 860 with the change summary." },
  { set: "855", name: "PO acknowledgement", dir: "Inbound", binding: "Writes the vendor confirmation per line including dates, quantities and the STP acceptance flag. Deviations raise the exception state, never silently overwrite." },
  { set: "856", name: "Advance ship notice", dir: "Inbound", binding: "Creates the inbound ASN with packages, batches or heats and quantities, pre-populating the GRN. Receipt still posts only at the dock scan." },
  { set: "810", name: "Invoice", dir: "Inbound", binding: "Creates the vendor invoice into three-way match. A duplicate number per vendor rejects with a 997 level error; matching tolerance rules unchanged." },
  { set: "997", name: "Functional acknowledgement", dir: "Both", binding: "Every envelope is functionally acknowledged; a missing 997 beyond the partner window alerts." },
]

export type EdiStage = "Draft" | "Parallel run" | "Cutover"
export interface EdiPartner {
  id: string
  vendorId: string
  mappingProfile: string
  isaQualifier: string
  isaId: string
  channel: "AS2" | "SFTP"
  endpoint: string
  certExpiry: string
  envelopeOptions: string
  ackWindowHrs: number
  sets: Record<EdiSet, boolean>
  stage: EdiStage
  parallelStart?: string
  unexplainedDiffs: number
  volumeRank: number
  version: number
  history: { at: string; by: string; text: string }[]
}

export type ParseState = "Received" | "Parsed" | "Failed" | "Rejected" | "Reprocessed"
export type AckState = "Acknowledged" | "Awaiting 997" | "997 overdue" | "Not required"
export interface EdiEnvelope {
  id: string
  partnerId: string
  dir: "Inbound" | "Outbound"
  set: EdiSet
  icn: number
  at: string
  parse: ParseState
  ack: AckState
  docs: string[]
  errors: string[]
  raw: string
  /** Exception raised by an 855 deviation (never a silent overwrite). */
  exception?: string
  audit: { at: string; by: string; text: string }[]
}

export interface EdiState {
  partners: EdiPartner[]
  envelopes: EdiEnvelope[]
  /** Invoice numbers already created, per vendor (810 duplicate check). */
  invoices: { vendorId: string; no: string }[]
}

const allSets = (on: EdiSet[]): Record<EdiSet, boolean> => ({ "850": on.includes("850"), "860": on.includes("860"), "855": on.includes("855"), "856": on.includes("856"), "810": on.includes("810"), "997": on.includes("997") })

export const REQUIRED_SEGMENTS: Record<EdiSet, string[]> = { "850": ["BEG", "PO1"], "860": ["BCH", "POC"], "855": ["BAK", "ACK"], "856": ["BSN", "HL"], "810": ["BIG", "IT1"], "997": ["AK1", "AK9"] }

export function seedEdi(): EdiState {
  const partners: EdiPartner[] = [
    { id: "EDI-PTR-TBD-01", vendorId: "VEN-TBD-0101", mappingProfile: "MAP-TBD-NSTAR-v3", isaQualifier: "ZZ", isaId: "NSTARSTEEL", channel: "AS2", endpoint: "as2.northstar-steel.example", certExpiry: "2027-03-31", envelopeOptions: "Element *, segment ~, 997 per functional group", ackWindowHrs: 4, sets: allSets(["850", "860", "855", "856", "810", "997"]), stage: "Parallel run", parallelStart: "2026-07-15", unexplainedDiffs: 1, volumeRank: 1, version: 3, history: [{ at: "2026-07-15", by: "Plant IT", text: "Parallel run started beside the manual flow" }, { at: "2026-07-02", by: "Plant IT", text: "Version 3 released: STP reference moved to the notes segment" }] },
    { id: "EDI-PTR-TBD-02", vendorId: "VEN-TBD-0103", mappingProfile: "MAP-TBD-RHEIN-v1", isaQualifier: "ZZ", isaId: "RHEINWERKTC", channel: "SFTP", endpoint: "sftp.rheinwerk-tc.example:22", certExpiry: "2026-11-20", envelopeOptions: "Element *, segment ~, one envelope per file", ackWindowHrs: 24, sets: allSets(["850", "855", "856", "997"]), stage: "Draft", unexplainedDiffs: 0, volumeRank: 4, version: 1, history: [{ at: "2026-09-18", by: "Plant IT", text: "Profile created from the vendor's implementation guide" }] },
    { id: "EDI-PTR-TBD-03", vendorId: "VEN-TBD-0102", mappingProfile: "MAP-TBD-KEYST-v2", isaQualifier: "01", isaId: "KEYSTONECU", channel: "AS2", endpoint: "as2.keystone-cu.example", certExpiry: "2027-01-15", envelopeOptions: "Element *, segment ~, 997 per functional group", ackWindowHrs: 4, sets: allSets(["850", "855", "856", "810", "997"]), stage: "Parallel run", parallelStart: "2026-08-03", unexplainedDiffs: 0, volumeRank: 2, version: 2, history: [{ at: "2026-08-03", by: "Plant IT", text: "Parallel run started" }] },
    { id: "EDI-PTR-TBD-04", vendorId: "VEN-TBD-0106", mappingProfile: "MAP-TBD-PRAIR-v2", isaQualifier: "ZZ", isaId: "PRAIRIEPLATE", channel: "SFTP", endpoint: "sftp.prairieplate.example:22", certExpiry: "2027-06-30", envelopeOptions: "Element *, segment ~", ackWindowHrs: 12, sets: allSets(["850", "855", "856", "810", "997"]), stage: "Cutover", parallelStart: "2026-02-02", unexplainedDiffs: 0, volumeRank: 3, version: 2, history: [{ at: "2026-05-04", by: "Controller", text: "Cutover: three months reconciled to the manual flow with zero unexplained differences" }, { at: "2026-02-02", by: "Plant IT", text: "Parallel run started" }] },
  ]
  const e = (id: number, partnerId: string, dir: EdiEnvelope["dir"], set: EdiSet, icn: number, at: string, parse: ParseState, ack: AckState, raw: string, docs: string[] = [], errors: string[] = [], exception?: string): EdiEnvelope => ({
    id: `EDI-ENV-TBD-${String(id).padStart(4, "0")}`, partnerId, dir, set, icn, at, parse, ack, docs, errors, raw, exception, audit: [{ at: at.slice(0, 10), by: "System", text: `${dir} ${set} logged with control number ${String(icn).padStart(6, "0")}` }],
  })
  const N = "EDI-PTR-TBD-01"
  const K = "EDI-PTR-TBD-03"
  const P = "EDI-PTR-TBD-04"
  const envelopes: EdiEnvelope[] = [
    e(1, N, "Outbound", "850", 41, "2026-10-05 09:12", "Parsed", "Acknowledged", "ST*850*0001~BEG*00*SA*PO-TBD-0377~NTE*ADD*STP-000377 v1~PO1*10*54000*KG*3.85~SE*5*0001~", ["PO-TBD-0377"]),
    e(2, N, "Inbound", "997", 42, "2026-10-05 09:20", "Parsed", "Not required", "ST*997*0001~AK1*PO*41~AK9*A*1*1*1~SE*3*0001~"),
    e(3, N, "Inbound", "855", 43, "2026-10-06 14:02", "Parsed", "Acknowledged", "ST*855*0001~BAK*00*AC*PO-TBD-0377~ACK*IA*54000*KG*068*20261105~SE*4*0001~", ["VCONF-TBD-0377"]),
    e(4, N, "Inbound", "855", 44, "2026-10-07 10:31", "Parsed", "Acknowledged", "ST*855*0001~BAK*00*AC*PO-TBD-0371~ACK*IP*41000*KG*068*20261112~SE*4*0001~", ["VCONF-TBD-0371"], [], "Vendor changed the delivery quantity and date on PO-TBD-0371 line 10: exception raised, PO unchanged."),
    e(5, N, "Inbound", "810", 45, "2026-10-08 08:45", "Parsed", "Acknowledged", "ST*810*0001~BIG*20261008*NS-88121*PO-TBD-0371~IT1*10*41000*KG*3.85~SE*4*0001~", ["INV-TBD-NS-88121"]),
    e(6, N, "Inbound", "810", 46, "2026-10-08 16:10", "Rejected", "Acknowledged", "ST*810*0001~BIG*20261008*NS-88121*PO-TBD-0371~IT1*10*41000*KG*3.85~SE*4*0001~", [], ["Duplicate invoice number NS-88121 for this vendor: rejected with a 997 level error (AK5 R)"]),
    e(7, N, "Inbound", "856", 47, "2026-10-09 07:55", "Failed", "Awaiting 997", "ST*856*0001~BSN*00*ASN-NS-5521*20261009~SE*3*0001~", [], ["Required segment HL missing: no packages or batches, the inbound ASN cannot be created"]),
    e(8, K, "Outbound", "850", 20, "2026-10-06 11:00", "Parsed", "997 overdue", "ST*850*0001~BEG*00*SA*PO-TBD-0388~PO1*10*9000*KG*13.40~SE*4*0001~", ["PO-TBD-0388"]),
    e(9, K, "Inbound", "856", 22, "2026-10-08 13:20", "Parsed", "Acknowledged", "ST*856*0001~BSN*00*ASN-KC-0912*20261008~HL*1**S~SE*4*0001~", ["ASN-TBD-0008"]),
    e(10, K, "Inbound", "997", 23, "2026-10-08 13:40", "Parsed", "Not required", "ST*997*0001~AK1*SH*22~AK9*A*1*1*1~SE*3*0001~"),
    e(11, P, "Inbound", "855", 118, "2026-10-07 15:05", "Reprocessed", "Acknowledged", "ST*855*0001~BAK*00*AC*PO-TBD-0360~ACK*IA*6000*KG*068*20261020~SE*4*0001~", ["VCONF-TBD-0360"]),
    e(12, P, "Inbound", "810", 119, "2026-10-09 06:30", "Received", "Awaiting 997", "ST*810*0001~BIG*20261009*PP-3347*PO-TBD-0360~IT1*10*6000*KG*1.35~SE*4*0001~"),
  ]
  envelopes[10].audit.push({ at: "2026-10-07", by: "Plant IT", text: "Edited ACK segment qualifier and reprocessed (restricted edit, audited)" })
  return { partners, envelopes, invoices: [{ vendorId: "VEN-TBD-0101", no: "NS-88121" }, { vendorId: "VEN-TBD-0106", no: "PP-3302" }] }
}

/** Control-number continuity per partner and direction: the gaps between the lowest and highest number. */
export function continuity(env: EdiEnvelope[], partnerId: string) {
  const inbound = env.filter((x) => x.partnerId === partnerId && x.dir === "Inbound").map((x) => x.icn).sort((a, b) => a - b)
  if (inbound.length < 2) return { from: inbound[0], to: inbound.at(-1), gaps: [] as number[] }
  const gaps: number[] = []
  for (let n = inbound[0]; n <= inbound.at(-1)!; n++) if (!inbound.includes(n)) gaps.push(n)
  return { from: inbound[0], to: inbound.at(-1), gaps }
}

/** A deliberately small parser: checks the required segments of the set and the 810 duplicate rule. */
export function parseEnvelope(raw: string, set: EdiSet, vendorId: string, invoices: EdiState["invoices"]): { ok: boolean; errors: string[]; invoiceNo?: string } {
  const segs = raw.split("~").map((s) => s.trim()).filter(Boolean).map((s) => s.split("*")[0])
  const errors = REQUIRED_SEGMENTS[set].filter((r) => !segs.includes(r)).map((r) => `Required segment ${r} missing`)
  let invoiceNo: string | undefined
  if (set === "810") {
    const big = raw.split("~").find((s) => s.startsWith("BIG*"))
    invoiceNo = big?.split("*")[2]
    if (invoiceNo && invoices.some((i) => i.vendorId === vendorId && i.no === invoiceNo)) errors.push(`Duplicate invoice number ${invoiceNo} for this vendor: rejected with a 997 level error`)
  }
  return { ok: errors.length === 0, errors, invoiceNo }
}
