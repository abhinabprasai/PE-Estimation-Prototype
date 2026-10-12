// Typed identifiers. Template-literal types, so a plain string literal in seed data type-checks
// without casts, while a value of the wrong family ("PO-..." where an SO is expected) does not.
//
// Formats: where the specification gives a format it is used (SO-{YYYY}-{SEQ:5}, LLR-{YYYY}-{SEQ:4},
// STP-{SEQ:6}, RCL-{YYYY}-{SEQ:3}, DEV-{YYYY}-{SEQ:4}, CD-{plan}-{SEQ:3}, ALC-{YYYYMM}-{NN}).
// Every other format is a placeholder carrying "TBD" (OQ-30), the convention the FL-09 build set.

// ---- organisation and master data ----
export type LegalEntityId = `LE-${string}`
export type PlantId = `PL-${string}`
export type WarehouseId = `WH-${string}`
export type BinId = `BIN-${string}`
export type CostCenterId = `CC-${string}`
export type ProfitCenterId = `PC-${string}`
export type WorkCenterId = `WC-${string}`
export type UserId = `USR-${string}`
export type CustomerId = `CUS-${string}`
export type VendorId = `VEN-${string}`
export type MaterialId = `${"RAW" | "SEMI" | "FIN" | "TRADE" | "PACK" | "SPARE" | "CONS" | "SERV" | "NSTK"}-${string}`
export type SerialNo = `SN-${string}`
export type BatchId = `BAT-${string}`
export type InstrumentId = `INS-${string}`
export type FiscalPeriodId = `FP-${string}`

// ---- sales and service ----
export type LeadId = `LEAD-${string}`
export type OpportunityId = `OPP-${string}`
export type QuotationId = `QT-${string}`
export type SalesOrderId = `SO-${string}`
export type DeliveryId = `DLV-${string}`
export type HandlingUnitId = `HU-${string}`
export type PodId = `POD-${string}`
export type ClaimId = `CLM-${string}`
export type InvoiceRequestId = `IR-${string}`
export type PgiId = `PGI-${string}`
export type RmaId = `RMA-${string}`
export type InstalledBaseId = `IB-${string}`

// ---- engineering ----
export type EngineeringRequestId = `ER-${string}`
export type EbomId = `EBOM-${string}`
export type MbomId = `MBOM-${string}`
export type ProductionVersionId = `PV-${string}`
export type DocumentId = `DOC-${string}`
export type TransmittalId = `TR-${string}`
export type EcrId = `ECR-${string}`
export type EcoId = `ECO-${string}`
export type LlrId = `LLR-${string}`
export type StpId = `STP-${string}`

// ---- planning and production ----
export type PlannedOrderId = `PLO-${string}`
export type RoutingId = `RTG-${string}`
export type ProductionOrderId = `WO-${string}`
export type ConfirmationId = `CNF-${string}`
export type ReworkOrderId = `RWO-${string}`
export type SettlementRunId = `SET-${string}`
export type MrpRunId = `MRP-${string}`
export type WarehouseTaskId = `WT-${string}`

// ---- quality and traceability ----
export type InspectionPlanId = `IP-${string}`
export type InspectionLotId = `IL-${string}`
export type NcrId = `NCR-${string}`
export type CapaId = `CAPA-${string}`
export type ScarId = `SCAR-${string}`
export type DeviationId = `DEV-${string}`
export type RecallId = `RCL-${string}`
export type GenealogyEventId = `GEN-${string}`
export type CountDocumentId = `CD-${string}`

// ---- purchasing, costing, controlling ----
export type RequisitionId = `PR-${string}`
export type RfqId = `RFQ-${string}`
export type PurchaseOrderId = `PO-${string}`
export type GrnId = `GRN-${string}`
export type InfoRecordId = `IRC-${string}`
export type AvlEntryId = `AVL-${string}`
export type CostEstimateId = `CE-${string}`
export type CostingRunId = `CR-${string}`
export type PriceListId = `PL-PRC-${string}`
export type SurchargeRuleId = `SUR-${string}`
export type AllocationCycleId = `ALC-${string}`
export type JournalId = `JE-${string}`

// ---- material governance ----
export type McrId = `MCR-${string}`
export type MchId = `MCH-${string}`
export type SupersessionId = `SUP-${string}`
export type EoRunId = `EOR-${string}`

// ---- workflow ----
export type ApprovalRequestId = `APR-${string}`
