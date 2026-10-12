// Packaging consumed into a transformer HU at close: posting #27 "Packing materials consumption",
// DR 5120 COGS (packaging) / CR 1360 Packaging on Hand, basis "backflush at standard" [DOC:pp.124-125,
// reference tables B #27] (asserted). The packaging bill per HU is not in the PRD: one heavy skid, one
// accessory crate and two desiccant bags per transformer HU is reading SR-24.
import { materialById } from "@/data/shared/materials"

export const HU_PACKAGING: { item: string; qty: number }[] = [
  { item: "PACK-TBD-SKID", qty: 1 },
  { item: "PACK-TBD-CRATE", qty: 1 },
  { item: "PACK-TBD-DESIC", qty: 2 },
]
/** Backflush at standard: sum of packaging quantity × standard cost. */
export const huPackagingCost = () => Math.round(HU_PACKAGING.reduce((s, p) => s + p.qty * (materialById(p.item)?.stdCost ?? 0), 0) * 100) / 100
export const huPackagingDetail = () => HU_PACKAGING.map((p) => `${p.qty} × ${p.item}`).join(" + ") + " backflushed at standard"
