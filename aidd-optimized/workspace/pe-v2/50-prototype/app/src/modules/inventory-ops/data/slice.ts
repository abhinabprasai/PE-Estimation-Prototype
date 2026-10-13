// inventory-ops slice: warehouse tasks (the mobile work queue and the supervisor board), dock
// receipts and the certificate side of goods receipts, period-close sign-offs and the tie-out
// explanations, and the intercompany pairs. Counts live in the materials slice (documents stay the
// system of record); this module reads and writes them through the store, see actions.ts.
// See 50-prototype/APP-ARCHITECTURE.md "Add a store slice".
import { defineSlice, type SearchHit } from "@/store"
import { seedInventoryOps } from "./seed"
import type { InventoryOpsState } from "./types"

export type { InventoryOpsState }

declare module "@/store/types" {
  interface SliceStates {
    inventoryOps: InventoryOpsState
  }
}

// Module-only events (augmentation). Another group may consume them; see README "Cross-module events".
declare module "@/store/events" {
  interface DomainEvents {
    /** A warehouse task reached Done/Exception (outcome Done or Exception). */
    "inventoryOps.taskCompleted": { taskId: string; type: string; outcome: "Done" | "Exception" }
    /** A count document was submitted, or a recount finished, from the handheld. */
    "inventoryOps.countSubmitted": { docId: string; recount: boolean }
    /** Count sheets were generated from the Count Plan wizard. */
    "inventoryOps.countSheetsGenerated": { planId: string; docIds: string[] }
    /** A dock receipt became a GRN. */
    "inventoryOps.receiptPosted": { receiptId: string; grnId: string; poId: string }
    /** A close-checklist validation ran for an entity and month. */
    "inventoryOps.closeValidated": { entityId: string; month: string; held: number }
  }
}

function search(s: InventoryOpsState): SearchHit[] {
  const g = "inventory-ops"
  return [
    ...s.tasks.map((t) => ({ group: g, title: t.id, subtitle: `Warehouse task · ${t.type} · ${t.docLabel}${t.outcome ? ` · ${t.outcome}` : ""}`, route: `/inventory-ops/task-board?task=${t.id}`, status: { kind: "warehouseTask" as const, value: t.status } })),
    ...s.inbound.map((r) => ({ group: g, title: r.id, subtitle: `Dock receipt · ${r.poId} line ${r.line} · ${r.qty}${r.postedAs ? ` · posted as ${r.postedAs}` : ""}`, route: `/inventory-ops/goods-receipts/${r.id}` })),
    ...s.icPairs.map((p) => ({ group: g, title: p.id, subtitle: `Intercompany pair · ${p.itemId} × ${p.qty} · ${p.month}`, route: `/inventory-ops/intercompany-recon?pair=${p.id}` })),
  ]
}

export const inventoryOpsSlice = defineSlice({
  key: "inventoryOps",
  seed: (): InventoryOpsState => seedInventoryOps(),
  search,
  links: () => [],
  subscribe: (api) => {
    // A GRN posted on the purchase order screen gets its certificate checklist here, with nothing attached yet.
    api.on("purchasing.grnPosted", ({ grnId }) =>
      api.mutate("inventoryOps", (d) => {
        if (!d.grnChecks.some((c) => c.grnId === grnId)) d.grnChecks.push({ grnId, certs: [] })
      }),
    )
  },
})
