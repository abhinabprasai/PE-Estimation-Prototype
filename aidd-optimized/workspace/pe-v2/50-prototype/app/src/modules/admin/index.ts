// admin module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import type { LegalEntityId } from "@/data/domain"
import { store } from "@/store"
import { built, nav, routes } from "./routes"
import { adminSlice } from "./data/slice"
import { checkPostingDate as check, type GateResult } from "./lib/period"

export const def: ModuleDef = { group: "admin", routes, nav, built, slices: [adminSlice as ModuleDef["slices"][number]] }

/** The posting-date gate for other modules [DOC:p.41 §9.1]: validates a posting date against the live
 *  period table (INV-CONFIG-PERIOD) and the module behavior matrix. `transaction` is a row name of the
 *  matrix, e.g. "Sales PGI / shipment"; returns post / warn (E-PER-02) / block (E-PER-01, E-PER-04). */
export function checkPostingDate(entityId: LegalEntityId, date: string, transaction?: string): GateResult {
  return check(store.getSlice("admin").periods, entityId, date, transaction)
}
export type { GateResult }
