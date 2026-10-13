// inventory-ops module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { inventoryOpsSlice } from "./data/slice"

export const def: ModuleDef = { group: "inventory-ops", routes, nav, built, slices: [inventoryOpsSlice as ModuleDef["slices"][number]] }
