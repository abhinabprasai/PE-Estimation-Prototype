// Module-only events of quality-trace, added by augmentation (APP-ARCHITECTURE.md §6). Catalog
// entries for the ones other groups should consume are requested in README "Requests to foundation".
import type { BatchId, CustomerId, InspectionLotId, NcrId, ProductionOrderId, RecallId, SalesOrderId, SerialNo, VendorId } from "@/data/domain"

declare module "@/store/events" {
  interface DomainEvents {
    /** QM-FIN-001 Pass: FTR generated; milestone "Production Complete / Tested" fires [DOC:p.87 §4]. */
    "quality.ftrIssued": { ftrId: string; lotId: InspectionLotId; woId: ProductionOrderId; serial: SerialNo; soId: SalesOrderId }
    /** An NCR link record was opened from an inspection, a test or a return. */
    "quality.ncrCreated": { ncrId: NcrId; sourceId: string }
    /** SCAR enforcement: vendor with ≥ 2 open overdue SCARs → Restricted [DOC:p.89 §6]. */
    "quality.vendorScarRestriction": { vendorId: VendorId; overdue: number; restricted: boolean }
    /** Recall Notify → Recover: recall-class RMAs requested in bulk for the field population [DOC:p.182 FL-08]. */
    "quality.recallRmaRequested": { recallId: RecallId; customerId: CustomerId; serials: SerialNo[] }
    /** Deviation auto-expiry or exhausted quantity blocks further use. */
    "quality.deviationBlocked": { deviationId: string; scope: string[] }
    /** Recall mass hold on a batch (also sent as materials.stockStatusChanged). */
    "quality.massHoldApplied": { recallId: RecallId; batches: BatchId[]; serials: SerialNo[] }
  }
}
export {}
