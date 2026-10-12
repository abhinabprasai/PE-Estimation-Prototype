// sales module definition, read by src/modules/registry.ts. Edit freely (inside this folder).
import type { ModuleDef } from "@/app/module-types"
import { built, nav, routes } from "./routes"
import { salesSlice } from "./data/slice"
import { Fl09InboxSection } from "./pages/Approvals"

export const def: ModuleDef = {
  group: "sales",
  routes,
  nav,
  built,
  slices: [salesSlice as ModuleDef["slices"][number]],
  inboxSection: { title: "Sales: credit release and R-OM-02 (FL-09)", element: <Fl09InboxSection /> },
}
