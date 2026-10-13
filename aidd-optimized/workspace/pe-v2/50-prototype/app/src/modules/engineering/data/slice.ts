// engineering slice: engineering requests, EBOMs, MBOMs, production versions, controlled documents,
// transmittals, ECRs, ECOs, placeholders and the mocked CAD connector (IF-17).
// See 50-prototype/APP-ARCHITECTURE.md "Add a store slice" and ../README.md.

import { defineSlice, type SearchHit, type StoreApi } from "@/store"
import type { DocLink, DocRef, EcoId, EngineeringRequestId, MaterialId, SalesOrderId, TransmittalId } from "@/data/domain"
import type {
  CadAssembly, DocRecord, EbomRecord, EcoRecord, EcrRecord, ErRecord, ImportProposal, MbomRecord, PdmLink, Placeholder, PvRecord, SyncConflict, TransmittalRecord, VaultEvent,
} from "./types"
import {
  seedCad, seedConflicts, seedDocuments, seedEboms, seedEcos, seedEcrs, seedMboms, seedPdm, seedPlaceholders, seedProposals, seedPvs, seedRequests, seedTransmittals, seedVaultEvents,
} from "./seed"
import { docStatus, pvOverlaps } from "./logic"
import { newErFromOrder, markEcrSubmitted, settleCcb } from "./actions"
import { ccbMembers } from "./logic"

export interface EngineeringState {
  requests: ErRecord[]
  eboms: EbomRecord[]
  mboms: MbomRecord[]
  productionVersions: PvRecord[]
  documents: DocRecord[]
  transmittals: TransmittalRecord[]
  ecrs: EcrRecord[]
  ecos: EcoRecord[]
  placeholders: Placeholder[]
  vaultEvents: VaultEvent[]
  conflicts: SyncConflict[]
  proposals: ImportProposal[]
  /** Current vault assemblies per EBOM (CAD vs EBOM comparison). */
  cad: CadAssembly[]
  /** ERP document to PDM vault linkage (Book III Part G §4). */
  pdm: PdmLink[]
  seq: number
}

declare module "@/store/types" {
  interface SliceStates {
    engineering: EngineeringState
  }
}

// Module-only event (catalog entry requested: R-6 in ../README.md). Fired when a customer response on a
// For Approval transmittal is Approved or Approved as Noted: the evidence for the Design Approval milestone.
declare module "@/store/events" {
  interface DomainEvents {
    "engineering.designApproved": { engineeringRequestId: EngineeringRequestId; soId: SalesOrderId; transmittalId: TransmittalId; response: string }
    /** Immediate effectivity: open WOs on the old revision go On Hold pending disposition [DOC:p.63 §4.5] (request R-11). */
    "engineering.woHoldRequested": { ecoId: EcoId; woIds: string[] }
    /** ECO cutover detail for the owning modules: MCH / supersession / Production Block (Materials, Book II §6.2
     *  ECOReleased), RWO for Rework and Stop & Rework, 5320 scrap, Use-Up watch, WO change tasks (request R-11). */
    "engineering.ecoCutover": {
      ecoId: EcoId; effectivity: "Date" | "Serial" | "Immediate"; effectiveOn: string; fromSerial?: string
      materialChanges: { from: MaterialId; to: MaterialId }[]; productionBlock: MaterialId[]
      stock: { itemId: MaterialId; qty: number; decision?: string }[]; wos: { woId: string; decision?: string }[]
    }
  }
}

/** Fresh seed; called at start and on Scenario reset. */
export function seed(): EngineeringState {
  const eboms = seedEboms()
  return {
    requests: seedRequests(),
    eboms,
    mboms: seedMboms(eboms),
    productionVersions: seedPvs(),
    documents: seedDocuments(),
    transmittals: seedTransmittals(),
    ecrs: seedEcrs(),
    ecos: seedEcos(),
    placeholders: seedPlaceholders(),
    vaultEvents: seedVaultEvents(),
    conflicts: seedConflicts(),
    proposals: seedProposals(),
    cad: seedCad(eboms),
    pdm: seedPdm(),
    seq: 500,
  }
}

const G = "Engineering"
function search(s: EngineeringState): SearchHit[] {
  return [
    ...s.requests.map((r) => ({ title: r.id, subtitle: `Engineering request · ${r.status} · ${r.title}`, route: `/engineering/requests/${r.id}`, ref: { type: "engineeringRequest" as const, id: r.id }, status: { kind: "engineeringRequest" as const, value: r.status }, group: G })),
    ...s.eboms.map((e) => ({ title: e.id, subtitle: `EBOM · rev ${e.rev} · ${e.status} · ${e.title}`, route: `/engineering/boms/${e.id}`, ref: { type: "ebom" as const, id: e.id }, status: { kind: "ebom" as const, value: e.status }, group: G })),
    ...s.mboms.map((m) => ({ title: m.id, subtitle: `MBOM · rev ${m.revision} · ${m.status} · ${m.parentItemId}`, route: `/engineering/mbom-transform/${m.id}`, ref: { type: "mbom" as const, id: m.id }, status: { kind: "mbom" as const, value: m.status }, group: G })),
    ...s.productionVersions.map((p) => ({ title: p.id, subtitle: `Production version · ${p.status} · ${p.materialId} lots ${p.lotSizeFrom}-${p.lotSizeTo}`, route: `/engineering/production-versions/${p.id}`, ref: { type: "productionVersion" as const, id: p.id }, status: { kind: "productionVersion" as const, value: p.status }, group: G })),
    ...s.documents.map((d) => ({ title: d.id, subtitle: `Document · rev ${d.revisions[d.revisions.length - 1].rev} · ${docStatus(d)} · ${d.title}`, route: `/engineering/documents/${d.id}`, ref: { type: "document" as const, id: d.id }, status: { kind: "document" as const, value: docStatus(d) }, group: G })),
    ...s.transmittals.map((t) => ({ title: t.id, subtitle: `Transmittal · ${t.purpose} · ${t.responses.length ? t.responses[t.responses.length - 1].response : t.sentOn ? "Awaiting response" : "Not sent"}`, route: `/engineering/transmittals/${t.id}`, ref: { type: "transmittal" as const, id: t.id }, group: G })),
    ...s.ecrs.map((e) => ({ title: e.id, subtitle: `ECR · ${e.stage} · ${e.title}`, route: `/engineering/change-requests/${e.id}`, ref: { type: "ecr" as const, id: e.id }, group: G })),
    ...s.ecos.map((e) => ({ title: e.id, subtitle: `ECO · ${e.stage} · ${e.effectivity} effectivity · ${e.title}`, route: `/engineering/change-orders/${e.id}`, ref: { type: "eco" as const, id: e.id }, group: G })),
  ]
}

function links(s: EngineeringState): DocLink[] {
  const out: DocLink[] = []
  const L = (from: DocRef, kind: DocLink["kind"], to: DocRef, note?: string) => out.push({ from, to, kind, note })
  for (const r of s.requests) {
    const er: DocRef = { type: "engineeringRequest", id: r.id }
    L({ type: "salesOrder", id: r.soId }, "triggers", er, `line ${r.soLine}`)
    for (const c of r.checklist) if (c.ref && c.ref.type !== "costEstimate") L(er, "delivers", c.ref, c.item)
    for (const c of r.checklist) if (c.ref?.type === "costEstimate") L(c.ref, "prices", er, "cost estimate deliverable")
  }
  for (const e of s.eboms) {
    if (e.engineeringRequestId) L({ type: "engineeringRequest", id: e.engineeringRequestId }, "delivers", { type: "ebom", id: e.id })
    const base = e.baseDesign?.match(/EBOM-(?:[A-Z]+-)?\d+/)?.[0]
    if (base && base !== e.id) L({ type: "ebom", id: base }, "revises", { type: "ebom", id: e.id }, e.baseDesign)
  }
  for (const p of s.placeholders) L({ type: "ebom", id: p.ebomId }, "creates", { type: "material", id: p.id }, `placeholder, line ${p.line}`)
  for (const m of s.mboms) L({ type: "ebom", id: m.ebomId }, "transforms to", { type: "mbom", id: m.id }, `EBOM rev ${m.ebomRev}`)
  for (const p of s.productionVersions) L({ type: "mbom", id: p.mbomId }, "paired in", { type: "productionVersion", id: p.id }, `${p.routingId} rev ${p.routingRev}`)
  for (const t of s.transmittals) {
    for (const d of t.documentIds) L({ type: "document", id: d }, "delivers", { type: "transmittal", id: t.id }, t.purpose)
  }
  for (const e of s.ecrs) {
    if (e.sourceRef) L(e.sourceRef, "escalates", { type: "ecr", id: e.id }, e.source)
    if (e.ecoId) L({ type: "ecr", id: e.id }, "creates", { type: "eco", id: e.ecoId })
  }
  for (const e of s.ecos) {
    for (const c of e.changes) L({ type: "eco", id: e.id }, "revises", { type: "ebom", id: c.ebomId })
    for (const dId of e.docChanges) L({ type: "eco", id: e.id }, "revises", { type: "document", id: dId })
  }
  return out
}

function subscribe(api: StoreApi) {
  // ETO / MTO line confirmed: the engineering request is created automatically [DOC:p.255] (asserted).
  api.on("sales.lineNeedsEngineering", ({ soId, line, itemId }) =>
    api.mutate("engineering", (d, ctx) => {
      if (d.requests.some((r) => r.soId === soId && r.soLine === line)) return
      const sales = api.hasSlice("sales") ? (api.getSlice("sales") as unknown as { orders?: { id: string; customerId: string; lines?: { no: number; promisedShip?: string; requestedShip?: string }[] }[] }) : undefined
      const so = sales?.orders?.find((o) => o.id === soId)
      newErFromOrder(d, ctx, { soId, line, itemId: itemId as MaterialId, customerId: (so?.customerId ?? "CUS-TBD-0048") as never, promisedShip: so?.lines?.find((l) => l.no === line)?.promisedShip ?? so?.lines?.find((l) => l.no === line)?.requestedShip })
    }),
  )

  // ECR submitted: raising the CCB request in the shared engine moves the ECR to "Submitted to CCB".
  api.on("approval.requested", ({ kind, subject }) => {
    if (kind === "ECR (CCB)" && subject.type === "ecr") api.mutate("engineering", (d, ctx) => markEcrSubmitted(d, ctx, subject.id))
  })

  // Shared approval engine outcomes (C-1): EBOM release, production version release, ECR (CCB).
  api.on("approval.decided", ({ kind, subject, outcome, reason, by }) => {
    if (kind === "EBOM release" && subject.type === "ebom")
      api.mutate("engineering", (d, ctx) => {
        const e = d.eboms.find((x) => x.id === subject.id)
        if (!e || e.status !== "In Review") return
        if (outcome === "Approved") {
          e.status = "Released"
          e.releasedOn = ctx.today
          e.activity.push({ at: ctx.today, by, text: `Released (approved in WF-INBOX); rev ${e.rev} is now immutable (C-14)` })
          ctx.emit("engineering.ebomReleased", { ebomId: e.id, parentItemId: e.parentItemId, rev: e.rev })
        } else {
          e.status = "Draft"
          e.reviewNotes.push({ by: ctx.userId, on: ctx.today, text: `Rejected: ${reason ?? "no reason"}` })
          e.activity.push({ at: ctx.today, by, text: `Rejected back to Draft: ${reason ?? ""}` })
        }
      })
    if (kind === "Production version release" && subject.type === "productionVersion")
      api.mutate("engineering", (d, ctx) => {
        const pv = d.productionVersions.find((x) => x.id === subject.id)
        if (!pv || pv.status !== "Draft") return
        if (outcome === "Rejected") return void pv.activity.push({ at: ctx.today, by, text: `Release rejected: ${reason ?? ""}` })
        const clash = pvOverlaps(d, pv)
        if (clash.length) return void pv.activity.push({ at: ctx.today, by: "System", text: `Approved, but not released: overlaps ${clash.map((c) => c.id).join(", ")} (V-PV-01). End-date the older version, then send again.` })
        pv.status = "Released"
        pv.activity.push({ at: ctx.today, by, text: "Released (approved in WF-INBOX)" })
      })
    if (kind === "ECR (CCB)" && subject.type === "ecr")
      api.mutate("engineering", (d, ctx) => {
        const e = d.ecrs.find((x) => x.id === subject.id)
        if (!e || e.ecoId || e.stage !== "Submitted to CCB") return
        // The engine route carries the Engineering Manager (+ Controller above $10k); record their votes,
        // then settle with the members who vote on the ECR (Quality Manager, Production Manager).
        const engineRoles = ccbMembers(e.costDelta).filter((r) => r === "Engineering Manager" || r === "Controller")
        const cast = outcome === "Approved" ? engineRoles.map((role) => ({ role, vote: "Approve" as const })) : [{ role: by, vote: "Reject" as const }]
        e.votes = [...(e.votes ?? []).filter((v) => !cast.some((c) => c.role === v.role)), ...cast.map((c) => ({ ...c, by: ctx.userId, on: ctx.today, reason: c.vote === "Reject" ? reason : undefined }))]
        e.activity.push({ at: ctx.today, by, text: `WF-INBOX: ${outcome}${reason ? `. ${reason}` : ""} (${cast.map((c) => c.role).join(", ")})` })
        settleCcb(d, ctx, e)
      })
  })

  // A placeholder's MCR completed in Materials: the line is no longer a Draft placeholder (V-ENG-03).
  api.on("materials.materialActivated", ({ materialId, mcrId }) =>
    api.mutate("engineering", (d, ctx) => {
      for (const p of d.placeholders)
        if (p.id === materialId || (mcrId && p.mcrId === mcrId)) {
          p.status = "Active"
          if (mcrId) p.mcrId = mcrId
          d.eboms.find((e) => e.id === p.ebomId)?.activity.push({ at: ctx.today, by: "System", text: `Placeholder ${p.id} Active (${mcrId ?? "MCR"} completed)` })
        }
    }),
  )
}

export const engineeringSlice = defineSlice({ key: "engineering", seed, search, links, subscribe })
