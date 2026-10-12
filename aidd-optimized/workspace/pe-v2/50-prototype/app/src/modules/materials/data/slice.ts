// materials slice: this module's own state, registered with the root store from this folder.
// Seeds the spine documents owned here (MCR-TBD-0301, RAW-TBD-OLTC Active, GRN-TBD-0301) and every
// record the materials screens show. Cross-module reactions live in `subscribe` (APP-ARCHITECTURE.md §6).

import { defineSlice, type SearchHit, type StoreApi } from "@/store"
import type { DocLink, Material, MaterialPlantData, MaterialValuation, StockStatus } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { VALUATION_CLASS, freezeMessage, freezingDoc, isValuated } from "../lib/rules"
import {
  NEW_MATERIALS,
  emptyViews,
  seedAcct,
  seedBuffers,
  seedCounts,
  seedEdits,
  seedEoPolicy,
  seedEoRuns,
  seedGrns,
  seedHistory,
  seedInfoRecords,
  seedMchs,
  seedMcrs,
  seedSafetyStock,
  seedSalesPrices,
  seedSourceList,
  seedStock,
  seedSupersessions,
  seedViews,
} from "./seed"
import { R, allMaterials, logChange, newMcrTasks, nextSeq, rateOf, type MaterialsState } from "./state"
import type { MaterialViews, McrRecord } from "./types"
import { applyFreeze, onCountDecided, onMchOrSupDecided, onPriceDecided, onSsDecided } from "./actions"

export type { MaterialsState } from "./state"

declare module "@/store/types" {
  interface SliceStates {
    materials: MaterialsState
  }
}

// ------------------------------------------------------------------ seed
function seedValuations(all: Material[], views: Record<string, MaterialViews>): MaterialValuation[] {
  const out: MaterialValuation[] = []
  for (const m of all) {
    if (!isValuated(m.type) || m.status === "Draft") continue
    const v = views[m.id]
    if (!v?.method) continue
    const std = m.stdCost
    out.push({
      materialId: m.id, plantId: "PL-TBD-01", entityId: "LE-TBD-10", valuationClass: v.valuationClass ?? VALUATION_CLASS[m.type] ?? "", method: v.method === "Standard" ? "Standard" : "MAV",
      stdCost: v.method === "Standard" ? std : undefined, mav: v.method === "Moving Average" && std != null ? Math.round(std * 1.012 * 100) / 100 : undefined, validFrom: "2026-01-01",
    })
  }
  return out
}
function seedPlant(all: Material[], views: Record<string, MaterialViews>): MaterialPlantData[] {
  return all.map((m) => ({
    materialId: m.id, plantId: "PL-TBD-01", mrpType: views[m.id]?.mrpType ?? "None", procurement: views[m.id]?.procurement ?? "Buy",
    leadTimeDays: views[m.id]?.plannedDeliveryDays ?? views[m.id]?.inHouseDays ?? 0, safetyStock: 0, status: m.status,
  }))
}

/** Fresh seed; called at start and on Scenario reset. */
export function seed(): MaterialsState {
  const created = structuredClone(NEW_MATERIALS)
  const matEdits = seedEdits()
  const all = allMaterials({ created, matEdits })
  const views = seedViews(all)
  const valuations = seedValuations(all, views)
  return {
    mcrs: seedMcrs(),
    mchs: seedMchs(),
    supersessions: seedSupersessions(),
    infoRecords: seedInfoRecords(),
    sourceList: seedSourceList(),
    acctDetermination: seedAcct(),
    countDocuments: seedCounts((id) => rateOf({ valuations, created, matEdits }, id)),
    eoRuns: seedEoRuns(),
    eoPolicy: seedEoPolicy(),
    plantData: seedPlant(all, views),
    valuations,
    created,
    matEdits,
    views,
    history: seedHistory(),
    stock: seedStock(),
    grns: seedGrns(),
    safetyStock: seedSafetyStock(),
    buffers: seedBuffers(),
    dqAssignments: [],
    salesPrices: seedSalesPrices(),
    ended: [],
    seq: 430,
  }
}

// ------------------------------------------------------------------ search and links
function search(s: MaterialsState): SearchHit[] {
  return [
    ...allMaterials(s).map((m) => ({ title: m.id, subtitle: `Material · ${m.type} · ${m.description}`, route: R.material(m.id), ref: { type: "material" as const, id: m.id }, status: { kind: "material" as const, value: m.status }, group: "Materials" })),
    ...s.mcrs.map((r) => ({ title: r.id, subtitle: `Material creation request · ${r.stage} · ${r.description}`, route: R.mcr(r.id), ref: { type: "mcr" as const, id: r.id }, group: "Materials" })),
    ...s.grns.map((g) => ({ title: g.id, subtitle: `Goods receipt (INV) · ${g.poId} · ${g.lines.map((l) => `${l.qty} ${l.materialId}`).join(", ") || "material unresolved"}`, route: R.grn(g), ref: { type: "grn" as const, id: g.id }, group: "Materials" })),
    ...s.mchs.map((c) => ({ title: c.id, subtitle: `Material change request · ${c.stage} · ${c.title}`, route: R.mch(c.id), group: "Materials" })),
    ...s.supersessions.map((x) => ({ title: x.id, subtitle: `Supersession · ${x.stage} · ${x.predecessorId} to ${x.successorId}`, route: R.sup(x.id), group: "Materials" })),
    ...s.infoRecords.map((i) => ({ title: i.id, subtitle: `Info record · ${i.materialId} · ${i.vendorId}`, route: R.ir(i.id), group: "Purchasing" })),
    ...s.countDocuments.map((c) => ({ title: c.id, subtitle: `Count document · ${c.status} · ${c.location}`, route: R.count(c.id), group: "Inventory" })),
    ...s.safetyStock.map((r) => ({ title: `Safety stock ${r.materialId} ${r.warehouseId}`, subtitle: `Safety stock row · ${r.ss ?? r.defaultSs} ${r.uom}${r.pending ? ` · ${r.pending.changeId} pending` : ""}`, route: R.ss(`row=${r.id}`), group: "Inventory" })),
    ...s.eoRuns.map((e) => ({ title: e.id, subtitle: `E&O reserve run · ${e.period} · ${e.stage}`, route: R.eo(e.id), group: "Materials" })),
  ]
}

function links(s: MaterialsState): DocLink[] {
  const out: DocLink[] = []
  for (const r of s.mcrs) {
    if (r.originRef) out.push({ from: r.originRef, to: { type: "mcr", id: r.id }, kind: "creates", note: r.path })
    if (r.materialId && r.stage !== "Withdrawn") out.push({ from: { type: "mcr", id: r.id }, to: { type: "material", id: r.materialId }, kind: "creates" })
  }
  for (const g of s.grns) {
    out.push({ from: { type: "purchaseOrder", id: g.poId }, to: { type: "grn", id: g.id }, kind: "receives" })
    for (const l of g.lines) if (l.batchId) out.push({ from: { type: "grn", id: g.id }, to: { type: "batch", id: l.batchId }, kind: "receives", note: `${l.qty} ${l.materialId}` })
  }
  return out
}

// ------------------------------------------------------------------ cross-module reactions
/** Material behind a spine PO, for GRN events that carry no lines (RD-MM-17, request R-6). */
const PO_MATERIAL: Record<string, { materialId: Material["id"]; rate: number }> = {
  "PO-TBD-0301": { materialId: "RAW-TBD-OLTC", rate: 74500 },
  "PO-TBD-0302": { materialId: "RAW-TBD-BSH145", rate: 18900 },
  "PO-TBD-0377": { materialId: "RAW-TBD-CRGO23", rate: 3.85 },
}

function subscribe(api: StoreApi) {
  // Engineering placeholder: number reserved, material + MCR with tasks (§4.3; RD-MM-04, RD-MM-05)
  api.on("engineering.placeholderNeeded", ({ engineeringRequestId, description }) =>
    api.mutate("materials", (d, ctx) => {
      const n = nextSeq(d)
      const materialId = `RAW-TBD-P${n}` as Material["id"]
      const mcrId = `MCR-TBD-0${n}` as McrRecord["id"]
      const m: Material = { id: materialId, materialNo: materialId, type: "RAW", description, groups: ["RAW"], baseUom: "EA", status: "Data Completion", blocks: [], batchFlag: false, valuationClass: "VC-3000", profitCenterId: "PC-200" }
      d.created.push(m)
      d.views[materialId] = emptyViews(m, ["BSH Components"])
      d.mcrs.unshift({
        id: mcrId, materialId, originRef: { type: "engineeringRequest", id: engineeringRequestId }, requestedType: "RAW", description, path: "Engineering Placeholder", stage: "Tasks open", open: true,
        createdOn: ctx.today, createdBy: ctx.userId, group: "BSH Components", uom: "EA", tasks: newMcrTasks("RAW", ctx.today),
        activity: [{ at: ctx.today, by: "System", text: `Placeholder from ${engineeringRequestId}; number ${materialId} reserved; tasks generated` }],
      })
      logChange(d, ctx, materialId, "Record", "", "Number reserved (placeholder)", mcrId)
    }),
  )

  // GRN posted (INV): record the receipt; stock to QI Hold when QI at receipt is ON (§3.10)
  api.on("purchasing.grnPosted", ({ grnId, poId, batches, serials }) =>
    api.mutate("materials", (d, ctx) => {
      if (d.grns.some((g) => g.id === grnId)) return
      const known = PO_MATERIAL[poId]
      if (!known) {
        d.grns.unshift({ id: grnId, poId, vendorId: "VEN-TBD-0000", on: TODAY, lines: [], unresolved: true, note: `Batches ${batches.join(", ") || "none"}; ${serials.length} serials` })
        return
      }
      const qi = d.views[known.materialId]?.qiReceipt ?? true
      const status: StockStatus = qi ? "QI Hold" : "Unrestricted"
      const qty = serials.length || 1
      // The receipt has already posted in purchasing, so a frozen bin cannot refuse it: it is kept as
      // an interim movement on the count line (soft freeze) or noted as an E-CNT-01 exception (RD-MM-20).
      const bin = qi ? "QI-01" : "A-01-01"
      const frz = freezingDoc(d.countDocuments, "WH-TBD-01", bin)
      let note: string | undefined
      if (frz && frz.softFreeze) note = applyFreeze(d, ctx, "WH-TBD-01", bin, known.materialId, qty)
      else if (frz) note = `${freezeMessage(bin, frz.id)} Receipt posted upstream; listed as a count exception.`
      d.grns.unshift({ id: grnId, poId, vendorId: "VEN-TBD-0000", on: TODAY, lines: [{ materialId: known.materialId, qty, batchId: batches[0], serials, status, value: qty * known.rate }], note })
      d.stock.push({ id: `STK-${nextSeq(d)}`, materialId: known.materialId, warehouseId: "WH-TBD-01", bin, batchId: batches[0], serials, status, qty, bucket: "Own", grnId, lastMovement: TODAY })
    }),
  )

  // Inspection closed: QI Hold to Unrestricted (passed) or Blocked (failed); tell other modules
  api.on("quality.inspectionClosed", ({ lotId, subject, passed }) => {
    const s = api.getSlice("materials")
    const hit = (r: MaterialsState["stock"][number]) =>
      r.status === "QI Hold" && ((subject.type === "batch" && r.batchId === subject.id) || (subject.type === "grn" && r.grnId === subject.id) || (subject.type === "serial" && !!r.serials?.includes(subject.id)))
    if (!s.stock.some(hit)) return
    api.mutate("materials", (d, ctx) => {
      for (const r of d.stock) {
        if (!hit(r)) continue
        const to: StockStatus = passed ? "Unrestricted" : "Blocked"
        r.status = to
        r.lastMovement = ctx.today
        if (r.batchId) ctx.emit("materials.stockStatusChanged", { batchId: r.batchId as `BAT-${string}`, from: "QI Hold", to, reason: `${lotId} ${passed ? "accepted" : "rejected"}` })
      }
    })
  })

  // Approvals raised from this module's screens use subject {type: "material", id: <record id>} (README R-2)
  api.on("approval.requested", ({ kind, subject }) => {
    if (subject.type !== "material" || kind !== "Material change") return
    api.mutate("materials", (d, ctx) => {
      const c = d.mchs.find((x) => x.id === subject.id)
      if (c && c.stage === "Draft") {
        c.stage = "In approval"
        c.activity.unshift({ at: ctx.today, by: ctx.role, text: "Sent for approval through WF-INBOX" })
      }
      const sup = d.supersessions.find((x) => x.id === subject.id)
      if (sup && sup.stage === "Draft") {
        sup.stage = "In approval"
        sup.activity.unshift({ at: ctx.today, by: ctx.role, text: "Sent for approval through WF-INBOX" })
      }
    })
  })
  api.on("approval.decided", ({ kind, subject, outcome, requestId, reason }) => {
    if (subject.type !== "material") return
    if (kind === "Material change") onMchOrSupDecided(api, subject.id, outcome, requestId, reason)
    if (kind === "Count variance") onCountDecided(api, subject.id, outcome, requestId, reason)
    if (kind === "Safety stock change") onSsDecided(api, subject.id, outcome, requestId)
    if (kind === "Price change on sales tab" || kind === "Below price floor") onPriceDecided(api, subject.id, outcome, requestId)
  })
}

export const materialsSlice = defineSlice({
  key: "materials",
  seed,
  search,
  links,
  subscribe,
})

/** Shared materials referenced by this slice (for the README coverage note). */
export const SHARED_MATERIAL_COUNT = MATERIALS.length
