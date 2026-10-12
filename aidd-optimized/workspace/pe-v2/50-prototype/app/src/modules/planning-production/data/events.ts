// Module-only events of the planning-production group, added to the shared catalog by augmentation
// (APP-ARCHITECTURE.md §6). Other groups may consume them; catalog entries are requested in README.
import type { DocRef, MaterialId, ProductionOrderId, SalesOrderId, WorkCenterId, WorkCenterStatus } from "@/data/domain"

declare module "@/store/events" {
  interface DomainEvents {
    /** CTP-DLG decision on a quote line or order line [DOC:p.193 §4] (asserted). Sales logs it on the document. */
    "planning.promiseDecided": { doc: DocRef; line: number; decision: "Accepted" | "Declined" | "Planner review"; shipDate?: string; binding?: string; reservation?: "Soft" | "Firm"; snapshotId?: string }
    /** A promise is at risk (revalidation) [DOC:p.193 §4-§5]. */
    "planning.atRiskRaised": { soId: SalesOrderId; line: number; projected: string; trigger: string }
    /** Recovery decision logged against the order [DOC:p.193 §5]. */
    "planning.recoveryDecided": { soId: SalesOrderId; line: number; recovery: string; by: string }
    /** Re-promise unavoidable: the sales change order path is triggered (promise changes only there). */
    "planning.salesChangeOrderRequested": { soId: SalesOrderId; line: number; proposedDate: string; reason: string }
    /** EX-02 / EX-06 expedite written to the PO Expedite Board (PUR-EXP-001). */
    "planning.expediteRequested": { itemId: MaterialId; supply?: DocRef; needDate: string; exceptionId: string }
    /** EX-07: engineering exception for a make item without a released BOM or routing. */
    "planning.engineeringExceptionOpened": { itemId: MaterialId; reason: string; exceptionId: string }
    /** EX-09: buyer starts an RFQ or AVL qualification. */
    "planning.sourcingRequested": { itemId: MaterialId; exceptionId: string }
    /** Published schedule with its snapshot ID (SCH-BOARD). */
    "planning.schedulePublished": { snapshotId: string; moves: number }
    /** Work-center status change (Maintenance warns the scheduler) [DOC:p.71 §2]. */
    "production.workCenterStatusChanged": { wcId: WorkCenterId; status: WorkCenterStatus }
    /** QC gate: Request Inspection creates an in-process (IP-INP) or final inspection [DOC:p.76 §6]. */
    "production.inspectionRequested": { woId: ProductionOrderId | string; op: number; gate: string; inspectionId: string; subject: DocRef }
    /** Wrong-material supervisor override creates an NCR automatically (E-PP-07) [DOC:p.76 §6]. */
    "production.ncrRaised": { ncrId: string; woId: ProductionOrderId; op: number; scanned: string; reason: string }
    /** Hold / Andon at the terminal; machine-down notifies the maintenance list. */
    "production.andonRaised": { woId: ProductionOrderId; op: number; wcId: WorkCenterId; reason: string }
    /** Release check 5: item released without a standard cost goes on the CVA exception list [DOC:p.74 §5.2]. Costing consumes it (README request R-6). */
    "production.cvaExceptionRaised": { cvaId: string; itemId: MaterialId; woId: ProductionOrderId }
    /** Consumed here: a confirmed PO delivery date moved later (supply slip on a pegged PO, a revalidation
     *  trigger [DOC:p.193 §4]). Purchasing emits it (README request R-7). */
    "purchasing.poDeliveryDateChanged": { poId: string; itemId: MaterialId; newDate: string; soId?: SalesOrderId }
    /** Rework order created or extended from a terminal rework quantity or a test failure. */
    "production.reworkOrderCreated": { rwoId: string; origin: DocRef }
  }
}
export {}
