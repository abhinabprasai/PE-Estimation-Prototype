// Cost center list merged with this module's overlay (moves, status, manager) and added centers. Shared by the
// controlling screens (masters, hierarchy, reports, budgets).
import type { CostCenterId } from "@/data/domain"
import { COST_CENTERS } from "@/data/shared"
import type { PurchasingFinanceState } from "./slice"

export interface Center {
  id: CostCenterId
  name: string
  parentId?: CostCenterId
  postable: boolean
  entityId: string
  defaultProfitCenterId?: string
  managerId?: string
  status: "Active" | "Blocked" | "Inactive"
  validFrom: string
  validTo?: string
  depth: number
}
export function allCenters(s: PurchasingFinanceState): Center[] {
  const base = [...COST_CENTERS, ...s.addedCenters].map((c) => {
    const o = s.centerOverlay[c.id]
    return { ...c, managerId: o?.managerId ?? ("managerId" in c ? c.managerId : undefined), status: o?.status ?? c.status, parentId: o?.parentId ?? c.parentId, depth: 0 }
  })
  const depth = (c: (typeof base)[number]): number => (c.parentId ? 1 + depth(base.find((x) => x.id === c.parentId) ?? { ...c, parentId: undefined }) : 0)
  // order as a tree: roots, then their children
  const out: Center[] = []
  const walk = (parent: string | undefined) =>
    base
      .filter((c) => c.parentId === parent)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((c) => {
        out.push({ ...c, depth: depth(c) } as Center)
        walk(c.id)
      })
  walk(undefined)
  return out
}
