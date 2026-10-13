// planning-production module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { planningProductionSlice } from "./data/slice"

export const def: ModuleDef = { group: "planning-production", routes, nav, built, slices: [planningProductionSlice as ModuleDef["slices"][number]] }

/** CTP-DLG for other groups: render <PromiseDialog id="CTP-TBD-0402" open onOpenChange={...} /> on a
 *  quote or order line (README request R-1). */
export { PromiseDialog } from "./pages/Planning"
/** Per-line CTP chip for quote and order lines (sales module, README request R-1). */
export { CtpLineChip, type CtpLineChipProps } from "./widgets/CtpLineChip"
