// inventory-ops routes: every screen of the group at its registry path. See 50-prototype/APP-ARCHITECTURE.md
// "Add a route". Mobile entries use the kiosk layout (TC77 handheld, no sidebar).
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { CountSheets } from "./pages/CountSheets"
import { GrnDetail, GrnList } from "./pages/GoodsReceipts"
import { IntercompanyRecon } from "./pages/IntercompanyRecon"
import { MobileCounts } from "./pages/MobileCounts"
import { PeriodClose } from "./pages/PeriodClose"
import { TaskBoard } from "./pages/TaskBoard"
import { WarehouseTasks } from "./pages/WarehouseTasks"

export const routes: ModuleRoute[] = [
  { path: "/mobile/counts", element: <MobileCounts />, layout: "kiosk", screenId: "FX-INV-MCOUNT" },
  { path: "/inventory-ops/count-sheets", element: <CountSheets />, screenId: "FX-INV-COUNTSHEETS" },
  { path: "/mobile/warehouse-tasks", element: <WarehouseTasks />, layout: "kiosk", screenId: "FX-INV-WTASKS" },
  { path: "/inventory-ops/task-board", element: <TaskBoard />, screenId: "FX-INV-WBOARD" },
  { path: "/inventory-ops/goods-receipts", element: <GrnList />, screenId: "FX-INV-GRN" },
  { path: "/inventory-ops/goods-receipts/:id", element: <GrnDetail />, screenId: "FX-INV-GRN" },
  { path: "/inventory-ops/period-close", element: <PeriodClose />, screenId: "FX-INV-PCLOSE" },
  { path: "/inventory-ops/intercompany-recon", element: <IntercompanyRecon />, screenId: "FX-INV-ICREC" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = []

/** Screens this module has built. Keys are registry ids (see README). */
export const built: Partial<Record<string, Built>> = {
  "FX-INV-MCOUNT": "full",
  "FX-INV-COUNTSHEETS": "full",
  "FX-INV-WTASKS": "full",
  "FX-INV-WBOARD": "full",
  "FX-INV-GRN": "full",
  "FX-INV-PCLOSE": "full",
  "FX-INV-ICREC": "full",
}
