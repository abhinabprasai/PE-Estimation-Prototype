// target-state module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { targetStateSlice } from "./data/slice"

export const def: ModuleDef = { group: "target-state", routes, nav, built, slices: [targetStateSlice as ModuleDef["slices"][number]] }
