// materials module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { materialsSlice } from "./data/slice"

export const def: ModuleDef = { group: "materials", routes, nav, built, slices: [materialsSlice as ModuleDef["slices"][number]] }

/** Inventory freeze check (E-CNT-01) for other groups' stock movements: returns the freezing count document, if any. */
export { frozenLocation } from "./data/actions"
