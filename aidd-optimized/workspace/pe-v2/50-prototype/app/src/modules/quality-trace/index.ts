// quality-trace module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { qualityTraceSlice } from "./data/slice"

export const def: ModuleDef = { group: "quality-trace", routes, nav, built, slices: [qualityTraceSlice as ModuleDef["slices"][number]] }
