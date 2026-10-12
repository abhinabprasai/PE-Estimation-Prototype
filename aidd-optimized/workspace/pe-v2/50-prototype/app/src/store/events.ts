// Cross-module event catalog. One small typed bus; events fire AFTER the emitting slice has
// committed, so a handler always sees the new state and runs its own atomic mutate.
//
// Foundation-owned catalog of spine events. A module may add its own events WITHOUT editing this
// file, by augmentation inside its folder:
//
//   declare module "@/store/events" {
//     interface DomainEvents { "materials.mcrCompleted": { mcrId: McrId; materialId: MaterialId } }
//   }
//
// Naming: "<emitting group or record>.<pastTenseVerb>". Payloads carry IDs, never whole records.

import type * as D from "@/data/domain"

export interface DomainEvents {
  // ---- sales and service
  "sales.quotationWon": { quotationId: D.QuotationId; customerId: D.CustomerId }
  "sales.orderConfirmed": { soId: D.SalesOrderId; type: D.OrderType; lines: { no: number; itemId: string; qty: number }[] }
  /** An ETO / MTO line needs design work: engineering opens an engineering request. */
  "sales.lineNeedsEngineering": { soId: D.SalesOrderId; line: number; itemId: string }
  "sales.pgiPosted": { deliveryId: D.DeliveryId; soId: D.SalesOrderId; serials: string[] }
  "sales.pgiReversed": { deliveryId: D.DeliveryId; reason: string }
  "sales.podRecorded": { podId: D.PodId; deliveryId: D.DeliveryId; exception: boolean }
  "sales.rmaReceived": { rmaId: D.RmaId; serials: string[] }
  // ---- engineering
  "engineering.ebomReleased": { ebomId: D.EbomId; parentItemId: D.MaterialId; rev: string }
  "engineering.mbomActivated": { mbomId: D.MbomId; ebomId: D.EbomId }
  "engineering.placeholderNeeded": { engineeringRequestId: D.EngineeringRequestId; description: string }
  "engineering.ecoReleased": { ecoId: D.EcoId; affected: D.DocRef[] }
  "engineering.llrApproved": { llrId: D.LlrId }
  // ---- materials
  "materials.materialActivated": { materialId: D.MaterialId; mcrId?: D.McrId }
  "materials.stockStatusChanged": { batchId: D.BatchId; from: D.StockStatus; to: D.StockStatus; reason: string }
  // ---- planning and production
  "planning.plannedOrderConverted": { plannedOrderId: D.PlannedOrderId; to: D.DocRef }
  "production.orderReleased": { woId: D.ProductionOrderId; serial?: D.SerialNo }
  "production.confirmationPosted": { woId: D.ProductionOrderId; op: number; good: number; scrap: number }
  "production.fgReceived": { woId: D.ProductionOrderId; serial?: D.SerialNo; itemId: D.MaterialId }
  "production.orderSettled": { woId: D.ProductionOrderId }
  // ---- quality and traceability
  "quality.inspectionClosed": { lotId: D.InspectionLotId; subject: D.DocRef; passed: boolean }
  "quality.recallStageChanged": { recallId: D.RecallId; stage: D.RecallStage }
  "trace.eventRecorded": { code: D.TraceEventCode; doc: D.DocRef; serial?: string; batch?: string }
  // ---- purchasing and finance
  "purchasing.poReleased": { poId: D.PurchaseOrderId; vendorId: D.VendorId }
  "purchasing.grnPosted": { grnId: D.GrnId; poId: D.PurchaseOrderId; batches: string[]; serials: string[] }
  "finance.periodStatusChanged": { entityId: D.LegalEntityId; month: string; status: D.FiscalPeriodStatus }
  /** Every ledger posting a screen makes, through the one Posting Service. */
  "posting.posted": { template: D.TemplateNo | keyof typeof D.OTHER_POSTINGS; amount: number; currency: D.Currency; source: D.DocRef }
  // ---- workflow (shared approval engine, C-1)
  "approval.requested": { requestId: D.ApprovalRequestId; kind: D.ApprovalKind; subject: D.DocRef }
  "approval.decided": { requestId: D.ApprovalRequestId; kind: D.ApprovalKind; subject: D.DocRef; outcome: "Approved" | "Rejected"; by: D.Role; reason?: string }
}

export type EventName = keyof DomainEvents
export type EventHandler<K extends EventName> = (payload: DomainEvents[K]) => void

export class EventBus {
  private handlers = new Map<string, Set<(p: unknown) => void>>()
  private log: { at: number; type: string; payload: unknown }[] = []

  on<K extends EventName>(type: K, handler: EventHandler<K>): () => void {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler as (p: unknown) => void)
    this.handlers.set(type, set)
    return () => set.delete(handler as (p: unknown) => void)
  }
  emit<K extends EventName>(type: K, payload: DomainEvents[K]) {
    this.log.push({ at: Date.now(), type, payload })
    if (this.log.length > 200) this.log.shift()
    for (const h of this.handlers.get(type) ?? []) h(payload)
  }
  /** Recent events, newest last (for the /coverage debug panel and tests). */
  recent() {
    return [...this.log]
  }
  clear() {
    this.handlers.clear()
    this.log = []
  }
}
