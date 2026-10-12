// purchasing-finance module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { purchasingFinanceSlice } from "./data/slice"

export const def: ModuleDef = { group: "purchasing-finance", routes, nav, built, slices: [purchasingFinanceSlice as ModuleDef["slices"][number]] }
