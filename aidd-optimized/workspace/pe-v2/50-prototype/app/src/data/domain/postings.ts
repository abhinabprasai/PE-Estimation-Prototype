// Journal posting templates #17..#38 [DOC:pp.124-125 Part J] (asserted), copied from
// 20-research/client/2026-10-09-prd2-reference-tables.md table B. Every template posts through the
// one shared Posting Service [DOC:p.125] (asserted); no module posts to the ledger directly.
// PostingPreview renders these; it never invents an account.

export type TemplateNo = 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38

export interface PostingTemplate {
  no: TemplateNo
  transaction: string
  debit: string
  credit: string
  basis: string
  trigger: string
  screen: string
  flows: string[]
}

export const POSTING_TEMPLATES: Record<TemplateNo, PostingTemplate> = {
  17: { no: 17, transaction: "RMA receipt (PE ownership)", debit: "1335 RMA Inventory", credit: "5120 COGS reversal", basis: "qty x valuation at original issue", trigger: "RMA receipt post", screen: "RMA-RECEIPT", flows: ["FL-05"] },
  18: { no: 18, transaction: "RMA restock", debit: "1330/1310 Inventory", credit: "1335 RMA Inventory", basis: "valuation", trigger: "disposition Restock", screen: "RMA-DISP", flows: ["FL-05"] },
  19: { no: 19, transaction: "RMA credit note", debit: "4100 Revenue (+2300 tax reversal)", credit: "1200 AR; 4910 restocking fee portion", basis: "credit value", trigger: "credit note from CMR (ACC 4)", screen: "RMA-DISP", flows: ["FL-05"] },
  20: { no: 20, transaction: "RMA scrap", debit: "5320 Scrap and Waste", credit: "1335 RMA Inventory", basis: "valuation", trigger: "disposition Scrap", screen: "RMA-DISP", flows: ["FL-05"] },
  21: { no: 21, transaction: "Warranty repair settlement", debit: "2610 Warranty Reserve (overflow 6300)", credit: "1325 WIP-Rework", basis: "actual repair cost", trigger: "RWO close (warranty)", screen: "RMA-DISP, RWO-001", flows: ["FL-05"] },
  22: { no: 22, transaction: "Billable repair", debit: "5130 COGS-Service / 1200 AR", credit: "1325 WIP-Rework / 4150 + 2300", basis: "cost; invoice value", trigger: "RWO close + service invoice", screen: "RMA-DISP, RWO-001", flows: ["FL-05"] },
  23: { no: 23, transaction: "Replacement shipment (warranty)", debit: "6300 Warranty Expense", credit: "1330 FG", basis: "standard cost", trigger: "PGI on $0 replacement SO", screen: "RMA-DISP", flows: ["FL-05"] },
  24: { no: 24, transaction: "Warranty reserve accrual", debit: "6300 Warranty Expense", credit: "2610 Warranty Reserve", basis: "accrual % x FG shipments", trigger: "month-end recurring JE", screen: "none named", flows: ["FL-05", "FL-06"] },
  25: { no: 25, transaction: "PGI, sales shipment", debit: "5120 COGS", credit: "1330 FG", basis: "qty x standard", trigger: "shipment post", screen: "OM-DLV-001", flows: ["FL-01", "FL-02", "FL-09"] },
  26: { no: 26, transaction: "Freight out accrual", debit: "6410 Freight Out", credit: "2100 AP accrual", basis: "quoted freight", trigger: "PGI on PE-paid terms", screen: "OM-DLV-001", flows: ["FL-01", "FL-09"] },
  27: { no: 27, transaction: "Packing materials consumption", debit: "5120 COGS (packaging)", credit: "1360 Packaging on Hand", basis: "backflush at standard", trigger: "HU close", screen: "OM-PACK-*, OM-DLV-001", flows: ["FL-01", "FL-09"] },
  28: { no: 28, transaction: "Material issue to WO", debit: "1320 WIP", credit: "1310 RM", basis: "qty x valuation", trigger: "SP-08 / backflush", screen: "PP-SFT-001", flows: ["FL-02", "FL-04"] },
  29: { no: 29, transaction: "Labor + overhead applied", debit: "1320 WIP", credit: "7500 Absorption", basis: "hours x standard rates", trigger: "operation confirmation", screen: "PP-SFT-001", flows: ["FL-04"] },
  30: { no: 30, transaction: "Operation scrap", debit: "5320 Scrap and Waste", credit: "1320 WIP", basis: "scrapped value", trigger: "confirmation scrap qty", screen: "PP-SFT-001", flows: ["FL-04"] },
  31: { no: 31, transaction: "FG production receipt", debit: "1330 FG", credit: "1320 WIP", basis: "good qty x standard", trigger: "receive to stock", screen: "not named in Book VI", flows: ["FL-02", "FL-04"] },
  32: { no: 32, transaction: "WO settlement variances", debit: "5220/5230/5240/5250 variances", credit: "1320 WIP", basis: "per Part A §8 formulas", trigger: "order close", screen: "PP-SETTLE-001", flows: ["FL-02", "FL-04"] },
  33: { no: 33, transaction: "Rework (production-caused)", debit: "1325 WIP-Rework to parent 1320", credit: "various", basis: "actuals", trigger: "RWO settlement", screen: "RWO-001", flows: ["FL-04"] },
  34: { no: 34, transaction: "Subcontract provision", debit: "1315 Subcontract at Vendor", credit: "1310 RM", basis: "valuation", trigger: "issue to subcontractor", screen: "none named", flows: ["FL-02", "FL-03", "FL-04"] },
  35: { no: 35, transaction: "Subcontract receipt", debit: "1320 WIP", credit: "2110 GR/IR + 1315", basis: "PO price + provided material; variance to 5260", trigger: "GRN subcontract", screen: "none named", flows: ["FL-02", "FL-03", "FL-04"] },
  36: { no: 36, transaction: "Allocation cycle", debit: "receiver CC 7500", credit: "sender CC 7500", basis: "driver share", trigger: "period-end run; net zero", screen: "CO-ALC-001/2", flows: ["FL-06"] },
  37: { no: 37, transaction: "Milestone invoice", debit: "1200 AR", credit: "2600 Contract Liability (or 4100 per ASC 606 timing)", basis: "milestone %", trigger: "invoice request post", screen: "none named", flows: ["FL-02"] },
  38: { no: 38, transaction: "Surcharge adjustment at PGI", debit: "1200 AR", credit: "4100 (surcharge element)", basis: "index delta", trigger: "ship-date-adjusted contracts", screen: "PRC-SUR-001", flows: ["FL-02"] },
}

/** Postings named only in flow text (no template number) [DOC:p.176; p.178; pp.181-182; p.247] (asserted). */
export const OTHER_POSTINGS = {
  grn: { transaction: "Goods receipt", debit: "13xx Inventory (or MAV)", credit: "2110 GR/IR", flows: ["FL-03"] },
  match: { transaction: "Three-way match", debit: "2110 GR/IR", credit: "2100 AP (IPV to 5210)", flows: ["FL-03"] },
  invoice: { transaction: "Customer invoice", debit: "1200 AR", credit: "4100 Revenue + 2300 Tax", flows: ["FL-01"] },
  eoReserve: { transaction: "E&O reserve", debit: "6320", credit: "5340", flows: ["FL-06"] },
} as const

/** One proposed journal line set, as PostingPreview shows it before the user commits. */
export interface PostingLine {
  template: TemplateNo
  amount: number | null // null = not posted (with reason)
  currency?: "USD" | "CAD"
  detail?: string
  notPostedReason?: string
}
