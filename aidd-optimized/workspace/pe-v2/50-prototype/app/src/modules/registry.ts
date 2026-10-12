// The list of module groups. Foundation-owned and pre-filled: module agents never edit it.
// Each group's index exports `def: ModuleDef` (routes, nav, slices, built claims).
import type { ModuleDef } from "@/app/module-types"
import { def as sales } from "./sales"
import { def as materials } from "./materials"
import { def as engineering } from "./engineering"
import { def as planningProduction } from "./planning-production"
import { def as qualityTrace } from "./quality-trace"
import { def as purchasingFinance } from "./purchasing-finance"
import { def as admin } from "./admin"

export const MODULES: ModuleDef[] = [sales, materials, engineering, planningProduction, qualityTrace, purchasingFinance, admin]
