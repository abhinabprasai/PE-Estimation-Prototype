// shell module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { shellSlice } from "./data/slice"

export const def: ModuleDef = { group: "shell", routes, nav, built, slices: [shellSlice as ModuleDef["slices"][number]] }
