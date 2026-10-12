// engineering module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { engineeringSlice } from "./data/slice"

export const def: ModuleDef = { group: "engineering", routes, nav, built, slices: [engineeringSlice as ModuleDef["slices"][number]] }
