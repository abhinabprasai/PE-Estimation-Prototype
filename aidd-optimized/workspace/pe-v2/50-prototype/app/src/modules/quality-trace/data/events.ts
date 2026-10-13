// Module-only events of quality-trace, added by augmentation (APP-ARCHITECTURE.md §6). Catalog
// entries for the ones other groups should consume are requested in README "Requests to foundation".
import type { BatchId, CustomerId, DocRef, InspectionLotId, NcrId, ProductionOrderId, RecallId, SalesOrderId, SerialNo, VendorId } from "@/data/domain"

declare module "@/store/events" {
  interface DomainEvents {
    /** A gate trigger (GRN line, routing checkpoint, shipment gate, RMA receipt) opened an inspection [DOC:p.264 QM-EXEC]. */
    "quality.inspectionOpened": { lotId: InspectionLotId; gate: "IQC" | "IPQC" | "OQC" | "RQC"; subject: DocRef }
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
    /** QM-FIN-001 Rework disposition: planning-production drafts the RWO for the failed scope. */
    "quality.reworkRequested": { ncrId: NcrId; woId: ProductionOrderId; serial: SerialNo; retestScope: number[] }
    /** QM-FIN-001 Engineering Review disposition: engineering is asked for an ECR for the failed unit. */
    "quality.ecrRequested": { ncrId: NcrId; woId: ProductionOrderId; serial: SerialNo; reason: string }
    /** Recall mass hold on a batch (also sent as materials.stockStatusChanged). */
    "quality.massHoldApplied": { recallId: RecallId; batches: BatchId[]; serials: SerialNo[] }
  }
}
export {}
