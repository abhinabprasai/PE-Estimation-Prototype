// Materials state type, pure selectors and in-mutate helpers. Imported by the slice, the actions and
// the screens (no cycle: this file imports neither).

import type { MutateCtx } from "@/store"
import type { Material, MaterialPlantData, MaterialType, MaterialValuation } from "@/data/domain"
import { MATERIALS, materialById } from "@/data/shared"
import { addBusinessDays, MCR_TASK_MATRIX } from "../lib/rules"
import { U } from "./seed"
import type {
  AcctRow,
  ChangeEntry,
  CountDocRecord,
  CustomerBuffer,
  DqAssignment,
  EndedMaterial,
  SalesPriceRow,
  EoPolicy,
  EoRunRecord,
  GrnRecord,
  InfoRecordRecord,
  MaterialViews,
  MchRecord,
  McrRecord,
  McrTask,
  SafetyStockRow,
  SourceListRecord,
  StockRow,
  SupersessionRecord,
} from "./types"

export interface MaterialsState {
  mcrs: McrRecord[]
  mchs: MchRecord[]
  supersessions: SupersessionRecord[]
  infoRecords: InfoRecordRecord[]
  sourceList: SourceListRecord[]
  acctDetermination: AcctRow[]
  countDocuments: CountDocRecord[]
  eoRuns: EoRunRecord[]
  eoPolicy: EoPolicy
  plantData: MaterialPlantData[]
  valuations: MaterialValuation[]
  /** Materials created through MCRs in this prototype (C-47). */
  created: Material[]
  /** Edits to shared materials (status, blocks, profit center), merged by ID. */
  matEdits: Record<string, Partial<Material>>
  views: Record<string, MaterialViews>
  history: ChangeEntry[]
  stock: StockRow[]
  grns: GrnRecord[]
  safetyStock: SafetyStockRow[]
  buffers: CustomerBuffer[]
  dqAssignments: DqAssignment[]
  salesPrices: SalesPriceRow[]
  /** Rejected / Deleted materials (no status row, K-16): hidden from lists, kept for history. */
  ended: EndedMaterial[]
  seq: number
}

// ------------------------------------------------------------------ selectors (pure)
export function allMaterials(s: Pick<MaterialsState, "created" | "matEdits"> & { ended?: MaterialsState["ended"] }): Material[] {
  const all = [...MATERIALS.map((m) => (s.matEdits[m.id] ? { ...m, ...s.matEdits[m.id] } : m)), ...s.created]
  return s.ended?.length ? all.filter((m) => !s.ended!.some((e) => e.materialId === m.id)) : all
}
export function getMaterial(s: Pick<MaterialsState, "created" | "matEdits">, id: string): Material | undefined {
  const c = s.created.find((m) => m.id === id)
  if (c) return c
  const base = materialById(id)
  return base ? { ...base, ...s.matEdits[id] } : undefined
}
/** Current valuation rate per base UoM: released standard or moving average (§3.11). */
export function rateOf(s: Pick<MaterialsState, "valuations" | "created" | "matEdits">, id: string): number {
  const v = s.valuations.filter((x) => x.materialId === id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  if (v) return (v.method === "Standard" ? v.stdCost : v.mav) ?? getMaterial(s, id)?.stdCost ?? 0
  return getMaterial(s, id)?.stdCost ?? 0
}
export const stockOf = (s: MaterialsState, id: string) => s.stock.filter((r) => r.materialId === id)
/** PE-owned on hand (consignment is vendor-owned, §14.1). */
export const onHand = (s: MaterialsState, id: string) => stockOf(s, id).filter((r) => r.bucket !== "Consignment").reduce((a, r) => a + r.qty, 0)
export const ownValue = (s: MaterialsState, id: string) => onHand(s, id) * rateOf(s, id)

// ------------------------------------------------------------------ routes
export const R = {
  material: (id: string, tab?: string) => `/inventory/items/${id}${tab ? `?tab=${tab}` : ""}`,
  mcr: (id: string) => `/materials/creation-requests/${id}`,
  mch: (id: string) => `/materials/change-requests?mch=${id}`,
  sup: (id: string) => `/materials/supersessions?id=${id}`,
  ir: (id: string) => `/purchasing/info-records/${id}`,
  sl: (materialId: string) => `/purchasing/source-lists?material=${materialId}`,
  count: (id: string) => `/inventory/counting/count-documents/${id}`,
  counts: "/inventory/counting/count-documents",
  eo: (id?: string) => `/materials/eo-reserve${id ? `?run=${id}` : ""}`,
  ss: (q?: string) => `/inventory/planning/safety-stock${q ? `?${q}` : ""}`,
  grn: (g: GrnRecord) => (g.lines[0] ? `/inventory/items/${g.lines[0].materialId}?tab=stock&grn=${g.id}` : `/materials/data-quality`),
}

// ------------------------------------------------------------------ in-mutate helpers
export function patchMaterial(d: MaterialsState, id: string, patch: Partial<Material>) {
  const c = d.created.find((m) => m.id === id)
  if (c) Object.assign(c, patch)
  else d.matEdits[id] = { ...d.matEdits[id], ...patch }
}
export const nextSeq = (d: MaterialsState) => ++d.seq
export function logChange(d: MaterialsState, ctx: MutateCtx, materialId: string, field: string, old: string, nu: string, source: string) {
  d.history.unshift({ materialId: materialId as Material["id"], field, old, new: nu, by: ctx.userId, at: ctx.today, source })
}

const TASK_OWNERS: Record<string, `USR-${string}`> = {
  "Material steward": U.steward, Planner: U.planner, Buyer: U.buyer1, "Manufacturing engineer": U.mfgEng, "Warehouse supervisor": U.whSup, "Quality engineer": U.qe, "Cost accountant": U.costAcc, "Sales admin": U.salesAdmin,
}
/** Task checklist generated from the material type (§4.2). */
export function newMcrTasks(type: MaterialType, start: string, opts: { qi?: boolean; sellable?: boolean; buyComplete?: boolean } = {}): McrTask[] {
  return MCR_TASK_MATRIX.filter((r) => r.applies(type, { qi: true, sellable: true, ...opts })).map((r, i) => ({
    id: `T${i + 1}`, view: r.view, ownerRole: r.role, ownerUserId: TASK_OWNERS[r.role], slaDue: addBusinessDays(start, 2), done: false,
    after: r.view === "Accounting & Costing" ? ["Planning (MRP)", "Purchasing + first Info Record"] : undefined,
  }))
}
