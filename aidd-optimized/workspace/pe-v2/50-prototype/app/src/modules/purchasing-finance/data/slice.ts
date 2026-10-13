// purchasing-finance slice: this module's own state, registered with the root store from this folder.
// Seed in ./seed.ts (spine IDs per README); actions in ./actions.ts; calculations in ./logic.ts.

import { defineSlice, store, type SearchHit } from "@/store"
import type { AvlEntry, CostCenterId, CustomerPrice, DocLink, MaterialId } from "@/data/domain"
import { MATERIALS, TODAY, WORK_CENTERS } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import * as S from "./seed"
import * as X from "./xseed"
import type {
  AltHierarchy, AvlProposal, BidVersion, BudgetLine, ContractRec, DriverRate, DriverTemplate, FloorBreach, HierMove, InfoRec, ItemFloor, RfqScoring, ScoreHistory, SkfChange,
  SourceRow, SupDevRec, VendorTaxProfile,
} from "./xtypes"
import type {
  AddedCostCenter, AddedProfitCenter, AgreementRec, CenterDraft, CvaException, Explanation, TrueUp, AllocCycleRec, AllocRun, AvlOverlay, CeRec, CenterOverlay, GrnRec, IndexRec, JournalEntry, LlrRec,
  MrpException, PoRec, PrRec, PriceListRec, RfqRec, RfqResp, RunRec, SkfValue, StpRec, SurchargeRec, VarianceRow, VendorOverlay, WcRateRec,
} from "./types"
import { indexAt, noStandardException, poTotal, surchargeFor } from "./logic"

// ---- approval ids (request R-2): core.seq starts at 100 and the seeded request APR-TBD-0101 (LLR-2026-0011)
// already holds that id, so the first request raised anywhere would overwrite it. Until foundation moves the
// start, lift the sequence above the highest seeded id each time a request is raised (the shared engine
// keeps one counter, so this is safe for every module).
const PATCHED = Symbol.for("pe-v2.raiseApprovalSeqGuard")
const storeRef = store as unknown as Record<symbol, boolean> & { raiseApproval: typeof store.raiseApproval }
if (!storeRef[PATCHED]) {
  storeRef[PATCHED] = true
  const original = store.raiseApproval.bind(store)
  storeRef.raiseApproval = (input) => {
    const core = store.getCore()
    const highest = core.approvals.reduce((t, a) => Math.max(t, Number(a.id.slice(-4)) || 0), 0)
    if (core.seq <= highest) core.seq = Math.max(highest, 199)
    return original(input)
  }
}

export interface PurchasingFinanceState {
  requisitions: PrRec[]
  rfqs: RfqRec[]
  rfqResponses: RfqResp[]
  purchaseOrders: PoRec[]
  grns: GrnRec[]
  llrs: LlrRec[]
  stps: StpRec[]
  costEstimates: CeRec[]
  costingRuns: RunRec[]
  wcRates: WcRateRec[]
  priceLists: PriceListRec[]
  customerPrices: CustomerPrice[]
  agreements: AgreementRec[]
  surchargeRules: SurchargeRec[]
  indexValues: IndexRec[]
  allocationCycles: AllocCycleRec[]
  allocRuns: AllocRun[]
  skf: SkfValue[]
  // ---- feature-list rows (13 October 2026): xtypes.ts
  infoRecords: InfoRec[]
  sourceList: SourceRow[]
  contracts: ContractRec[]
  supplierDeviations: SupDevRec[]
  avlProposals: AvlProposal[]
  vendorTax: Record<string, VendorTaxProfile>
  bidVersions: BidVersion[]
  rfqScoring: Record<string, RfqScoring>
  driverRates: DriverRate[]
  driverTemplates: DriverTemplate[]
  itemFloors: ItemFloor[]
  floorBreaches: FloorBreach[]
  hierarchyMoves: HierMove[]
  altHierarchies: AltHierarchy[]
  skfHistory: SkfChange[]
  budgets: BudgetLine[]
  scoreHistory: ScoreHistory[]
  vendorOverlay: Record<string, VendorOverlay>
  avlOverlay: Record<string, AvlOverlay>
  avlAdded: AvlEntry[]
  centerOverlay: Record<string, CenterOverlay>
  addedCenters: AddedCostCenter[]
  addedProfitCenters: AddedProfitCenter[]
  centerDrafts: CenterDraft[]
  explanations: Explanation[]
  cvaExceptions: CvaException[]
  trueUps: TrueUp[]
  mrpExceptions: MrpException[]
  variances: VarianceRow[]
  journal: JournalEntry[]
  /** Standards stamped by a costing-run release (overlay on the shared material master). */
  standards: Record<string, { std: number; effectiveFrom: string; runId: string }>
  seq: number
}

declare module "@/store/types" {
  interface SliceStates {
    purchasingFinance: PurchasingFinanceState
  }
}

/** Fresh seed; called at start and on Scenario reset. */
export function seed(): PurchasingFinanceState {
  const c = <T,>(x: T): T => structuredClone(x)
  return {
    requisitions: c(S.SEED_PRS),
    rfqs: c(S.SEED_RFQS),
    rfqResponses: c(S.SEED_RESPONSES),
    purchaseOrders: c(S.SEED_POS),
    grns: c(S.SEED_GRNS),
    llrs: c(S.SEED_LLRS),
    stps: c(S.SEED_STPS),
    costEstimates: c(S.SEED_CES),
    costingRuns: c(S.SEED_RUNS),
    wcRates: c(S.SEED_WC_RATES),
    priceLists: c(S.SEED_PRICE_LISTS),
    customerPrices: c(S.SEED_AGREEMENTS.flatMap((a) => a.rows)),
    agreements: c(S.SEED_AGREEMENTS),
    surchargeRules: c(S.SEED_SURCHARGES),
    indexValues: c(S.SEED_INDEX_VALUES),
    allocationCycles: c(S.SEED_CYCLES),
    allocRuns: seedRuns(),
    skf: [...c(S.SEED_SKF), ...c(S.SEED_SKF).map((r) => ({ ...r, period: "2026-Q2", headcount: Math.max(0, r.headcount - 1), laborHours: Math.round(r.laborHours * 0.96), machineHours: Math.round(r.machineHours * 0.97) }))],
    infoRecords: c(X.SEED_INFO_RECORDS),
    sourceList: c(X.SEED_SOURCE_ROWS),
    contracts: c(X.SEED_CONTRACTS),
    supplierDeviations: c(X.SEED_DEVIATIONS),
    avlProposals: c(X.SEED_AVL_PROPOSALS),
    vendorTax: c(X.SEED_TAX),
    bidVersions: c(X.SEED_BID_VERSIONS),
    rfqScoring: c(X.SEED_SCORING),
    driverRates: c(X.SEED_DRIVER_RATES),
    driverTemplates: c(X.SEED_DRIVER_TEMPLATES),
    itemFloors: c(X.SEED_ITEM_FLOORS),
    floorBreaches: c(X.SEED_BREACHES),
    hierarchyMoves: c(X.SEED_MOVES),
    altHierarchies: c(X.SEED_ALT),
    skfHistory: c(X.SEED_SKF_HISTORY),
    budgets: c(X.SEED_BUDGETS),
    scoreHistory: c(X.SEED_SCORE_HISTORY),
    vendorOverlay: {},
    avlOverlay: {},
    avlAdded: [],
    centerOverlay: {
      ...Object.fromEntries(Object.entries(S.SEED_MANAGERS).map(([k, v]) => [k, { managerId: v, history: [] }])),
      "CC-9500": { status: "Blocked", managerId: S.SEED_MANAGERS["CC-9500"], history: [{ on: "2026-10-01", by: "USR-TBD-009", text: "Blocked for posting during facilities reorganisation", effective: "2026-10-01" }] },
    },
    addedCenters: c(S.SEED_ADDED_CCS),
    addedProfitCenters: [],
    centerDrafts: [],
    explanations: [],
    cvaExceptions: seedExceptions(),
    trueUps: [],
    mrpExceptions: c(S.SEED_MRP_EXCEPTIONS),
    variances: c(S.SEED_VARIANCES),
    journal: c(S.SEED_JOURNAL),
    standards: {},
    seq: 500,
  }
}

/** Items with no standard cost yet: each lands on the exception list with an alert to the Cost accountant. */
function seedExceptions(): CvaException[] {
  return MATERIALS.filter((m) => ["RAW", "SEMI", "FIN", "SPARE", "TRADE", "PACK"].includes(m.type) && m.stdCost == null).map((m, i) => ({
    id: `CVX-${String(i + 1).padStart(3, "0")}`, itemId: m.id, text: "No standard — costing run required", source: { type: "material", id: m.id }, on: TODAY, alertTo: "Cost accountant" as const,
  }))
}

/** Posted allocation runs for Aug and Sep 2026, with one rerun (reversal + replacement retained). */
function seedRuns(): AllocRun[] {
  const out: AllocRun[] = []
  const mk = (period: string, cyc: AllocCycleRec, nn: number, extra: Partial<AllocRun> = {}): AllocRun => {
    const lines = computeAllocation(cyc, period, S.SEED_SKF)
    return { id: `ALC-${period.replace("-", "")}-${String(nn).padStart(2, "0")}`, cycleId: cyc.id, period, state: "Posted", postedOn: `${period}-30`, postedBy: "USR-TBD-009", lines, total: Math.round(lines.reduce((t, l) => t + l.amount, 0) * 100) / 100, ...extra }
  }
  for (const [i, cyc] of S.SEED_CYCLES.entries()) out.push(mk("2026-08", cyc, i + 1))
  for (const [i, cyc] of S.SEED_CYCLES.entries()) out.push(mk("2026-09", cyc, i + 1, cyc.id === "ALC-CYC-04" ? { state: "Reversed", reversedBy: "ALC-202609-05" } : {}))
  out.push(mk("2026-09", S.SEED_CYCLES[3], 5, { replaces: "ALC-202609-04", postedOn: "2026-10-02" }))
  return out
}

const DRIVER_KEY = { "Sq Ft": "sqft", Headcount: "headcount", "Machine Hours": "machineHours", "Labor Hours": "laborHours", "Revenue Share": "revenueShare" } as const
/** Driver-proportional shares rounded to cents, remainder to the largest receiver [DOC:p.114 §5] (asserted). */
export function computeAllocation(cyc: AllocCycleRec, period: string, skf: SkfValue[]) {
  const out: { segment: number; senderId: CostCenterId; receiverId: CostCenterId; driverValue: number; amount: number }[] = []
  for (const seg of cyc.segments)
    for (const sender of seg.senderIds) {
      const bal = S.SENDER_BALANCES[period]?.[sender] ?? 0
      const vals = seg.receiverIds.map((r) => {
        if (seg.driver === "Fixed %") return { r, v: seg.fixedPct?.[r] ?? 0 }
        const row = skf.find((k) => k.costCenterId === r)
        return { r, v: row ? row[DRIVER_KEY[seg.driver]] : 0 }
      })
      const total = vals.reduce((t, x) => t + x.v, 0) || 1
      const lines = vals.map(({ r, v }) => ({ segment: seg.no, senderId: sender, receiverId: r, driverValue: v, amount: Math.floor((bal * v * 100) / total) / 100 }))
      const rem = Math.round((bal - lines.reduce((t, l) => t + l.amount, 0)) * 100) / 100
      const big = lines.reduce((a, b) => (b.amount > a.amount ? b : a), lines[0])
      if (big) big.amount = Math.round((big.amount + rem) * 100) / 100
      out.push(...lines)
    }
  return out
}

const matPc = (id: MaterialId) => MATERIALS.find((m) => m.id === id)?.profitCenterId

export const purchasingFinanceSlice = defineSlice({
  key: "purchasingFinance",
  seed,
  search: (s): SearchHit[] => {
    const g = "Purchasing and finance"
    return [
      ...s.requisitions.map((r): SearchHit => ({ title: r.id, subtitle: `Purchase requisition · ${r.title}`, route: `/purchasing/requisitions/${r.id}`, ref: { type: "requisition", id: r.id }, status: { kind: "requisition", value: r.status }, group: g })),
      ...s.rfqs.map((r): SearchHit => ({ title: r.id, subtitle: `RFQ · ${r.title}`, route: `/purchasing/rfqs/${r.id}`, ref: { type: "rfq", id: r.id }, status: { kind: "rfq", value: r.status }, group: g })),
      ...s.purchaseOrders.map((p): SearchHit => ({ title: p.id, subtitle: `Purchase order · ${p.title} · ${fmtMoney(poTotal(p), p.currency)}`, route: `/purchasing/orders/${p.id}`, ref: { type: "purchaseOrder", id: p.id }, status: { kind: "purchaseOrder", value: p.status }, group: g })),
      ...s.llrs.map((l): SearchHit => ({ title: l.id, subtitle: `Long-lead release · ${l.title} · ${l.state}`, route: `/purchasing/long-lead/${l.id}`, ref: { type: "llr", id: l.id }, group: g })),
      ...s.stps.map((t): SearchHit => ({ title: t.id, subtitle: `Supplier technical package · ${t.title}${t.superseded ? " · superseded" : ""}`, route: `/purchasing/stp/${t.id}`, ref: { type: "stp", id: t.id }, group: g })),
      ...s.costEstimates.map((c): SearchHit => ({ title: c.id, subtitle: `Cost estimate · ${c.title} · ${fmtMoney(c.total)}`, route: `/costing/estimates/${c.id}`, ref: { type: "costEstimate", id: c.id }, status: { kind: "costEstimate", value: c.status }, group: g })),
      ...s.priceLists.map((p): SearchHit => ({ title: p.id, subtitle: `Price list · ${p.name}`, route: `/pricing/price-lists/${p.id}`, status: { kind: "priceList", value: p.status }, group: g })),
      ...s.grns.filter((x) => !["GRN-TBD-0301"].includes(x.id)).map((x): SearchHit => ({ title: x.id, subtitle: `Goods receipt for ${x.poId} · ${x.on}`, route: `/purchasing/orders/${x.poId}`, ref: { type: "grn", id: x.id }, group: g })),
      ...s.contracts.map((c): SearchHit => ({ title: c.id, subtitle: `${c.kind} · ${c.title} · ${c.state}`, route: `/purchasing/contracts/${c.id}`, group: g })),
      ...s.supplierDeviations.map((d): SearchHit => ({ title: d.id, subtitle: `Supplier deviation · ${d.characteristic} · ${d.vendorId}`, route: `/purchasing/supplier-deviations/${d.id}`, group: g })),
      ...s.agreements.map((a): SearchHit => ({ title: a.id, subtitle: `Customer price agreement · ${a.name}`, route: `/pricing/agreements/${a.id}`, group: g })),
      ...s.allocationCycles.map((c): SearchHit => ({ title: c.id, subtitle: `Allocation cycle · ${c.name}`, route: `/controlling/allocations/${c.id}`, group: g })),
      ...s.costingRuns.map((r): SearchHit => ({ title: r.id, subtitle: `Costing run · ${r.scope} · ${r.stage}`, route: `/costing/runs?run=${r.id}`, group: g })),
    ]
  },
  links: (s): DocLink[] => {
    const out: DocLink[] = []
    for (const r of s.requisitions) {
      for (const l of r.lines) if (l.peg) out.push({ from: l.peg, to: { type: "requisition", id: r.id }, kind: l.peg.type === "plannedOrder" ? "sources" : "pegs", note: `line ${l.no}` })
      for (const p of r.poIds) out.push({ from: { type: "requisition", id: r.id }, to: { type: "purchaseOrder", id: p }, kind: "sources" })
      if (r.rfqId) out.push({ from: { type: "requisition", id: r.id }, to: { type: "rfq", id: r.rfqId }, kind: "sources" })
    }
    for (const q of s.rfqs) {
      for (const p of q.poIds) out.push({ from: { type: "rfq", id: q.id }, to: { type: "purchaseOrder", id: p }, kind: "sources", note: "award" })
      for (const l of q.lines) if (l.stpId) out.push({ from: { type: "stp", id: l.stpId }, to: { type: "rfq", id: q.id }, kind: "references" })
    }
    for (const p of s.purchaseOrders) {
      if (p.llrId) out.push({ from: { type: "llr", id: p.llrId }, to: { type: "purchaseOrder", id: p.id }, kind: "authorises" })
      for (const l of p.lines) if (l.stpId) out.push({ from: { type: "stp", id: l.stpId }, to: { type: "purchaseOrder", id: p.id }, kind: "references", note: `line ${l.no}` })
    }
    for (const g of s.grns) out.push({ from: { type: "purchaseOrder", id: g.poId }, to: { type: "grn", id: g.id }, kind: "receives" })
    for (const l of s.llrs) {
      out.push({ from: { type: "engineeringRequest", id: l.engineeringRequestId }, to: { type: "llr", id: l.id }, kind: "authorises" })
      for (const t of l.stpIds) out.push({ from: { type: "llr", id: l.id }, to: { type: "stp", id: t }, kind: "references" })
    }
    for (const t of s.stps) if (t.supersededBy) out.push({ from: { type: "stp", id: t.id }, to: { type: "stp", id: t.supersededBy }, kind: "revises" })
    for (const c of s.costEstimates) {
      if (c.quotationId) out.push({ from: { type: "costEstimate", id: c.id }, to: { type: "quotation", id: c.quotationId }, kind: "prices" })
      if (c.supersededBy) out.push({ from: { type: "costEstimate", id: c.id }, to: { type: "costEstimate", id: c.supersededBy }, kind: "revises" })
    }
    return out
  },
  subscribe: (api) => {
    // ---- a request raised through ApprovalButton moves the subject into its waiting status
    api.on("approval.requested", ({ kind, subject, requestId }) => {
      api.mutate("purchasingFinance", (d, ctx) => {
        if (kind === "PO approval" && subject.type === "purchaseOrder") {
          const p = d.purchaseOrders.find((x) => x.id === subject.id)
          if (p?.status === "Draft") p.status = "In Approval"
          p?.activity.push({ at: ctx.today, by: ctx.role, text: `Sent for approval (${requestId})` })
        }
        if (kind === "PO approval" && subject.type === "requisition") {
          const r = d.requisitions.find((x) => x.id === subject.id)
          if (r?.status === "Open") r.status = "In Approval"
          r?.activity.push({ at: ctx.today, by: ctx.role, text: `Sent for approval (${requestId})` })
        }
        if (kind === "Long-lead release" && subject.type === "llr") {
          const l = d.llrs.find((x) => x.id === subject.id)
          if (l?.state === "Draft") l.state = "Awaiting approval"
        }
        if ((kind === "Price list approval" || kind === "Below price floor") && subject.type === "approval") {
          const pl = d.priceLists.find((x) => x.id === subject.id.split(":")[0])
          if (pl && pl.status === "Draft") pl.status = "Pending Approval"
          pl?.history.push({ on: ctx.today, by: ctx.userId, text: `${kind} requested (${requestId})` })
        }
      })
    })

    // ---- shared approval engine (C-1): react to decisions on this module's subjects
    api.on("approval.decided", (e) => {
      const { subject, outcome, kind, reason } = e
      if (kind === "PO approval" && subject.type === "purchaseOrder")
        api.mutate("purchasingFinance", (d, ctx) => {
          const p = d.purchaseOrders.find((x) => x.id === subject.id)
          if (!p) return
          if (p.status !== "In Approval") {
            p.activity.push({ at: ctx.today, by: e.by, text: `Revision ${p.revision} ${outcome} (${e.requestId})${outcome === "Approved" ? "; re-transmit and capture the vendor's re-confirmation" : ""}` })
            return
          }
          if (outcome === "Approved") {
            p.status = "Approved"
            p.changePending = false
            for (const prId of p.prIds) {
              const pr = d.requisitions.find((r) => r.id === prId)
              if (pr && pr.status === "Approved") {
                pr.status = "Converted"
                pr.activity.push({ at: ctx.today, by: "System", text: `Converted: ${p.id} approved (${e.requestId})` })
              }
            }
          } else p.status = "Draft"
          p.activity.push({ at: ctx.today, by: e.by, text: `${e.requestId} ${outcome}${reason ? `: ${reason}` : ""}` })
        })
      if (kind === "PO approval" && subject.type === "requisition")
        api.mutate("purchasingFinance", (d, ctx) => {
          const r = d.requisitions.find((x) => x.id === subject.id)
          if (!r || r.status !== "In Approval") return
          r.status = outcome === "Approved" ? "Approved" : "Rejected"
          r.activity.push({ at: ctx.today, by: e.by, text: `${e.requestId} ${outcome}${reason ? `: ${reason}` : ""}` })
        })
      if (kind === "Long-lead release" && subject.type === "llr") {
        const r = api.mutate("purchasingFinance", (d) => {
          const l = d.llrs.find((x) => x.id === subject.id)
          if (!l || l.state !== "Awaiting approval") return false
          if (outcome === "Approved") {
            const req = store.getCore().approvals.find((a) => a.id === e.requestId)
            l.state = "Approved"
            l.acceptedCancellation = l.cancellationFees
            l.approvals = (req?.steps ?? []).filter((st) => st.decided).map((st) => ({ role: st.role, on: st.decided!.on }))
            return true
          }
          l.state = "Draft"
          return false
        })
        if (r.ok && r.value) api.emit("engineering.llrApproved", { llrId: subject.id as `LLR-${string}` })
      }
      if ((kind === "Price list approval" || kind === "Below price floor") && subject.type === "approval")
        api.mutate("purchasingFinance", (d, ctx) => {
          const pl = d.priceLists.find((x) => x.id === subject.id.split(":")[0])
          if (!pl || pl.status !== "Pending Approval") return
          if (outcome === "Approved") {
            for (const other of d.priceLists) if (other.id !== pl.id && other.code === pl.code && other.entityId === pl.entityId && other.status === "Active" && other.validFrom < pl.validFrom && pl.validFrom <= ctx.today) other.status = "Archived"
            pl.status = "Active"
          } else pl.status = "Draft"
          pl.history.push({ on: ctx.today, by: ctx.userId, text: `${kind} ${outcome}${reason ? `: ${reason}` : ""} (${e.requestId})` })
        })
      if (kind === "Below price floor" && subject.type === "approval") {
        const key = subject.id.split(":")[0]
        api.mutate("purchasingFinance", (d, ctx) => {
          const a = d.agreements.find((x) => x.id === key)
          if (a && a.state === "Draft") {
            if (outcome === "Approved") a.state = "Active"
            a.history = [...(a.history ?? []), { on: ctx.today, by: ctx.userId, text: `Activation below the floor ${outcome}${reason ? `: ${reason}` : ""} (${e.requestId})` }]
          }
          const b = d.floorBreaches.find((x) => x.id === key)
          if (b && b.status === "Pending") {
            b.status = outcome === "Approved" ? "Approved" : "Rejected"
            b.approvedBy = `${outcome === "Approved" ? "Approved" : "Declined"} through ${e.requestId} (${ctx.today})`
            if (reason) b.justification = `${b.justification} Decision note: ${reason}`
          }
        })
      }
      if (kind === "Intercompany price deviation" && subject.type === "purchaseOrder")
        api.mutate("purchasingFinance", (d, ctx) => {
          const p = d.purchaseOrders.find((x) => x.id === subject.id)
          if (p) p.activity.push({ at: ctx.today, by: e.by, text: `Intercompany price deviation ${outcome} (${e.requestId})` })
        })
    })

    // ---- MRP converts a planned order into a requisition (FL-03 step 1; MRP PRs pre-approved by policy)
    api.on("planning.plannedOrderConverted", ({ plannedOrderId, to }) => {
      if (to.type !== "requisition") return
      const plan = api.hasSlice("planningProduction")
        ? ((api.getSlice("planningProduction" as never) as unknown as { plannedOrders?: { id: string; materialId: MaterialId; qty: number; finish: string }[] }).plannedOrders ?? []).find((x) => x.id === plannedOrderId)
        : undefined
      api.mutate("purchasingFinance", (d, ctx) => {
        if (d.requisitions.some((r) => r.id === to.id)) return
        d.requisitions.unshift({
          id: to.id as `PR-${string}`, title: `From planned order ${plannedOrderId}`, status: "Approved", origin: "MRP", createdOn: ctx.today, createdBy: ctx.userId,
          activity: [{ at: ctx.today, by: "System", text: `Created from ${plannedOrderId} (planning.plannedOrderConverted); MRP PRs pre-approved by policy` }],
          entityId: "LE-TBD-10", requesterId: ctx.userId, buyerId: "USR-TBD-039", poIds: [],
          lines: plan ? [{ no: 10, itemId: plan.materialId, qty: plan.qty, needBy: plan.finish, estPrice: MATERIALS.find((m) => m.id === plan.materialId)?.stdCost ?? 0, peg: { type: "plannedOrder", id: plannedOrderId } }] : [],
          note: plan ? undefined : "Planned order detail not readable from planning; lines to be completed by the buyer",
        })
      })
    })

    // ---- engineering change reaches open purchase documents (FL-10 stage 12)
    api.on("engineering.ecoReleased", ({ ecoId, affected }) => {
      const items = affected.filter((a) => a.type === "material").map((a) => a.id)
      if (!items.length) return
      api.mutate("purchasingFinance", (d, ctx) => {
        for (const p of d.purchaseOrders) {
          if (["Matched/Closed", "Cancelled", "Received"].includes(p.status)) continue
          if (!p.lines.some((l) => items.includes(l.itemId))) continue
          p.changePending = true
          p.ecoImpact = [...(p.ecoImpact ?? []), { ecoId, on: ctx.today, note: "Drawing changed after PO issue: PO Change task raised (Part C §4.2)" }]
          p.activity.push({ at: ctx.today, by: "System", text: `${ecoId} affects this PO; Change Pending` })
          if (p.llrId) {
            const l = d.llrs.find((x) => x.id === p.llrId)
            if (l && !l.ecoImpacts.some((x) => x.ecoId === ecoId && x.poId === p.id)) l.ecoImpacts.push({ ecoId, poId: p.id })
          }
        }
      })
    })

    // ---- every ledger posting: the journal the controlling reports and CVA drill to
    api.on("posting.posted", ({ template, amount, currency, source }) => {
      api.mutate("purchasingFinance", (d) => {
        const tpl = String(template)
        const rule: JournalEntry["rule"] =
          tpl === "reval" ? 3 : template === "grn" || template === "match" || template === 28 || template === 34 ? 3 : template === 29 || template === 30 || template === 32 || template === 33 || template === 35 ? 2 : template === 36 ? 1 : typeof template === "number" && template >= 17 && template <= 27 ? 4 : 4
        let pc: JournalEntry["profitCenterId"]
        let cc: CostCenterId | undefined
        if (tpl === "reval") cc = "CC-2000"
        if (source.type === "purchaseOrder" || source.type === "grn") {
          const po = d.purchaseOrders.find((p) => p.id === source.id || d.grns.some((g) => g.id === source.id && g.poId === p.id))
          pc = po ? matPc(po.lines[0]?.itemId) : undefined
          cc = "CC-2000"
        }
        d.seq += 1
        d.journal.push({ id: `JE-TBD-L${d.seq}`, on: TODAY, period: TODAY.slice(0, 7), template: typeof template === "number" ? `#${template}` : tpl === "reval" ? "REVAL" : template, text: `Posting ${typeof template === "number" ? `#${template}` : tpl === "reval" ? "REVAL" : template} from ${source.id}`, amount, currency, source, costCenterId: cc, profitCenterId: pc, rule, live: true })
      })
    })

    // ---- WO settlement variances (#32): production settles MUV, LRV, LEV and OAV per order; the workbench reads them live
    api.on("production.orderSettled", ({ woId }) => {
      if (!api.hasSlice("planningProduction")) return
      const pp = api.getSlice("planningProduction" as never) as unknown as {
        settlements?: { id: string; period: string; postedOn: string; reversed?: unknown; orders: { woId: string; mat: number; lrv: number; lev: number; oav: number }[] }[]
        productionOrders?: { id: string; itemId: MaterialId; qty: number; costStd: { material: number; labor: number; overhead: number; hours: number }; operations: { workCenterId: string; actualHours: number; status: string }[] }[]
      }
      const st = [...(pp.settlements ?? [])].reverse().find((x) => !x.reversed && x.orders.some((o) => o.woId === woId))
      const row = st?.orders.find((o) => o.woId === woId)
      const w = pp.productionOrders?.find((o) => o.id === woId)
      if (!st || !row || !w) return
      api.mutate("purchasingFinance", (d, ctx) => {
        if (d.variances.some((v) => v.source.id === woId && v.journalId && v.id.startsWith("VAR-WO-"))) return
        const je = [...d.journal].reverse().find((j) => j.template === "#32" && j.source?.id === woId)
        const lead = [...w.operations].filter((o) => o.status !== "Cancelled").sort((a, b) => b.actualHours - a.actualHours)[0]
        const wc = WORK_CENTERS.find((x) => x.id === lead?.workCenterId)
        const pc = MATERIALS.find((x) => x.id === w.itemId)?.profitCenterId ?? "PC-900"
        const parts: [VarianceRow["type"], number, number, boolean][] = [
          ["MUV", row.mat, w.costStd.material, false],
          ["LRV", row.lrv, w.costStd.labor, true],
          ["LEV", row.lev, w.costStd.labor, true],
          ["OAV", row.oav, w.costStd.overhead, true],
        ]
        for (const [type, v, stdBasis, byWc] of parts) {
          if (Math.abs(v) < 0.005) continue
          d.seq += 1
          d.variances.push({
            id: `VAR-WO-${type}-${d.seq}`, type, period: st.period, on: ctx.today, itemId: w.itemId, workCenterId: byWc ? (wc?.id as VarianceRow["workCenterId"]) : undefined, qty: w.qty,
            stdBasis: Math.round(stdBasis * 100) / 100, actual: Math.round((stdBasis + v) * 100) / 100, variance: Math.round(v * 100) / 100, source: { type: "productionOrder", id: woId },
            journalId: je?.id ?? (`JE-TBD-L${d.seq}` as const), costCenterId: (wc?.costCenterId ?? "CC-1300") as CostCenterId, profitCenterId: pc,
          })
        }
        // a settlement of an item with no standard goes on the CVA exception list (Part A §8.4)
        if (MATERIALS.find((x) => x.id === w.itemId)?.stdCost == null) noStandardException(d, w.itemId, { type: "productionOrder", id: woId }, ctx.today)
      })
    })

    // ---- #38 true-up at PGI for Ship-Date Adjusted contracts (PRC-SUR-001): reprice the surcharge at the ship-month index
    api.on("sales.pgiPosted", ({ deliveryId, soId }) => {
      if (!api.hasSlice("sales")) return
      const sales = api.getSlice("sales" as never) as unknown as {
        orders?: { id: string; customerId: string; created: string; lines: { no: number; item: string; qty: number }[] }[]
        deliveries?: { id: string; shipDate?: string; refs: { line: number; qty: number }[] }[]
      }
      const so = sales.orders?.find((o) => o.id === soId)
      const dl = sales.deliveries?.find((x) => x.id === deliveryId)
      if (!so || !dl) return
      const posted = api.mutate("purchasingFinance", (d, ctx) => {
        if (d.trueUps.some((t) => t.deliveryId === deliveryId)) return 0
        const orderMonth = so.created.slice(0, 7)
        const shipMonth = (dl.shipDate ?? ctx.today).slice(0, 7)
        const lines: TrueUp["lines"] = []
        let agreementId = ""
        for (const ref of dl.refs) {
          const sl = so.lines.find((l) => l.no === ref.line)
          if (!sl) continue
          // the contract: a customer agreement row covering the item, ship-date adjusted
          const agr = d.agreements.find((a) => a.contractTerm === "Ship-Date Adjusted" && a.customerId === so.customerId && a.rows.some((r) => r.itemId === sl.item && r.validFrom <= so.created && (!r.validTo || r.validTo >= so.created)))
          if (!agr) continue
          agreementId = agr.id
          for (const rule of d.surchargeRules.filter((r) => r.shipDateAdjusted && r.itemIds.includes(sl.item as MaterialId))) {
            const a = indexAt(d.indexValues, rule.index, orderMonth)
            const b = indexAt(d.indexValues, rule.index, shipMonth)
            if (!a || !b) continue
            const delta = Math.round((surchargeFor(rule, b.value) - surchargeFor(rule, a.value)) * ref.qty * 100) / 100
            lines.push({ line: sl.no, itemId: sl.item as MaterialId, qty: ref.qty, ruleId: rule.id, indexAtOrder: a.value, indexAtShip: b.value, delta })
          }
        }
        if (!lines.length) return 0
        const total = Math.round(lines.reduce((t, l) => t + l.delta, 0) * 100) / 100
        d.seq += 1
        d.trueUps.unshift({ id: `TRU-${d.seq}`, deliveryId, soId, customerId: so.customerId, agreementId, orderMonth, shipMonth, lines, total, on: ctx.today })
        return total
      })
      if (posted.ok && posted.value) api.emit("posting.posted", { template: 38, amount: posted.value, currency: "USD", source: { type: "delivery", id: deliveryId } })
    })
  },
})
