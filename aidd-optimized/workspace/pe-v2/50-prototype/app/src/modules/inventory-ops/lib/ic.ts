// Intercompany pairing indicators (FL-07, Book III Part F §3; Book VIII §5.4). One business event
// creates both documents atomically or neither [DOC:p.181 field 9]; a mismatch monitor alerts
// Finance when values or statuses diverge [field 10]; the monthly reconciliation compares the
// seller's IC receivable with the buyer's IC payable per pair and the close blocks on unexplained
// pairs [DOC: Book VIII §5.4] (asserted). The indicator names and the $0.01 tolerance are readings
// (RD-IO-14).
import type { PurchaseOrderStatus, SalesOrderStatus } from "@/data/domain"
import type { SliceStates } from "@/store"
import type { IcPair } from "../data/types"
import { round2 } from "./rules"

export const VALUE_TOLERANCE = 0.01
/** Booked rate used by the prototype for CAD (OQ-42 reading of the sales build): 1.3600 CAD per USD. */
export const BOOKED_CAD_PER_USD = 1.36

/** Buyer PO statuses that agree with each seller SO status (RD-IO-14). */
const COMPATIBLE: Partial<Record<SalesOrderStatus, PurchaseOrderStatus[]>> = {
  Draft: ["Draft"],
  Submitted: ["Draft", "In Approval"],
  "Credit Hold": ["Approved", "Sent", "Confirmed"],
  Confirmed: ["Approved", "Sent", "Confirmed"],
  "In Fulfillment": ["Sent", "Confirmed"],
  "Partially Shipped": ["Confirmed", "Partially Received"],
  Shipped: ["Confirmed", "Partially Received", "Received"],
  "Invoiced/Closed": ["Received", "Matched/Closed"],
  Cancelled: ["Cancelled"],
  Rejected: ["Cancelled", "Draft"],
}

export type IcKind = "Paired" | "Value mismatch" | "Status mismatch" | "Not paired"
export interface IcView extends IcPair {
  arUsd: number
  apUsd: number
  valueDiff: number
  fxDiff: number
  kind: IcKind
  detail: string
}

/** Buyer side from the purchasing slice where the PO exists there (live), else the stored side. */
export function livePairs(pairs: IcPair[], pf: SliceStates["purchasingFinance"]): IcPair[] {
  return pairs.map((p) => {
    const po = p.buyerPo ? pf.purchaseOrders.find((x) => x.id === p.buyerPo) : undefined
    if (!po) return p
    const ap = po.lines.filter((l) => l.status !== "Cancelled").reduce((a, l) => a + l.qty * l.price, 0)
    return { ...p, buyerPoStatus: po.status, buyerAp: round2(ap), buyerCurrency: po.currency }
  })
}

export function icIndicator(p: IcPair): { kind: IcKind; detail: string; arUsd: number; apUsd: number; valueDiff: number; fxDiff: number } {
  const arUsd = p.sellerCurrency === "CAD" ? p.sellerAr / BOOKED_CAD_PER_USD : p.sellerAr
  const apUsd = p.buyerCurrency === "CAD" ? p.buyerAp / BOOKED_CAD_PER_USD : p.buyerAp
  const valueDiff = round2(arUsd - apUsd)
  const fxDiff = p.buyerCurrency === "CAD" && p.fxToUsd ? round2(p.buyerAp * (p.fxToUsd - 1 / BOOKED_CAD_PER_USD)) : 0
  if (p.rolledBack) return { kind: "Not paired", detail: p.rolledBack.message, arUsd, apUsd, valueDiff: 0, fxDiff: 0 }
  if (Math.abs(valueDiff) > VALUE_TOLERANCE) return { kind: "Value mismatch", detail: `Seller receivable and buyer payable differ by $${Math.abs(valueDiff).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, arUsd, apUsd, valueDiff, fxDiff }
  const ok = !p.sellerSoStatus || !p.buyerPoStatus || (COMPATIBLE[p.sellerSoStatus] ?? []).includes(p.buyerPoStatus)
  if (!ok) return { kind: "Status mismatch", detail: `Seller order is ${p.sellerSoStatus}; buyer order is ${p.buyerPoStatus}`, arUsd, apUsd, valueDiff, fxDiff }
  return { kind: "Paired", detail: fxDiff ? `Paired; FX difference ${fxDiff > 0 ? "+" : ""}${fxDiff.toLocaleString("en-US", { minimumFractionDigits: 2 })} posts to 7100 at settlement` : "Both documents exist and agree", arUsd, apUsd, valueDiff, fxDiff }
}

export function icViews(pairs: IcPair[], pf: SliceStates["purchasingFinance"]): IcView[] {
  return livePairs(pairs, pf).map((p) => ({ ...p, ...icIndicator(p) }))
}
export const icBlocksClose = (p: IcView) => p.kind !== "Paired" && !p.explained
