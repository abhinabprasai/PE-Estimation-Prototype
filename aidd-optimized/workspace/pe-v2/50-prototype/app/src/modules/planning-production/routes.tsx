// planning-production routes: every registry screen of the group, at its registry path.
// See 50-prototype/APP-ARCHITECTURE.md "Add a route".
import { Timer } from "lucide-react"
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { MrpWorkbench, PlannedOrderList } from "./pages/Mrp"
import { AtRiskBoard, PromiseChecks, ScheduleBoard } from "./pages/Planning"
import { RoutingDetail, RoutingList, WorkCenterDetail, WorkCenterList } from "./pages/MasterData"
import { ProductionOrderDetail, ProductionOrderList } from "./pages/ProductionOrders"
import { DispatchList, WipBoard } from "./pages/Floor"
import { ShopFloorTerminal } from "./pages/Terminal"
import { ReworkDetail, ReworkList } from "./pages/Rework"
import { SettlementRun } from "./pages/Settlement"
import { RunMrpDialogPage } from "./pages/RunMrp"
import { ScenarioBoard } from "./pages/Scenarios"
import { PromiseReliability, WorkCenterLoad } from "./pages/LoadReliability"
import { StoDetail, StoList } from "./pages/Transport"
import { SchedulingMasters } from "./pages/Constraints"
import { CaptureBuilder } from "./pages/CaptureTemplates"
import { WoDecisionsPage } from "./pages/WoDecisions"
import { LaborExport } from "./pages/LaborExport"
import { ReceiptsPage } from "./pages/Receipts"
import { ReportDetail, ReportsIndex } from "./pages/Reports"

export const routes: ModuleRoute[] = [
  { path: "/production/mrp", element: <MrpWorkbench />, screenId: "PP-MRP-001" },
  { path: "/production/planned-orders", element: <PlannedOrderList />, screenId: "PLO-001" },
  { path: "/production/schedule", element: <ScheduleBoard />, screenId: "SCH-BOARD" },
  { path: "/production/at-risk", element: <AtRiskBoard />, screenId: "AT-RISK" },
  { path: "/production/at-risk/promise", element: <PromiseChecks />, screenId: "CTP-DLG" },
  { path: "/production/work-centers", element: <WorkCenterList />, screenId: "PP-WC-001/2" },
  { path: "/production/work-centers/:id", element: <WorkCenterDetail />, screenId: "PP-WC-001/2" },
  { path: "/production/routings", element: <RoutingList />, screenId: "PP-RTG-001/2" },
  { path: "/production/routings/:id", element: <RoutingDetail />, screenId: "PP-RTG-001/2" },
  { path: "/production/orders", element: <ProductionOrderList />, screenId: "PP-WO-001/2" },
  { path: "/production/orders/:id", element: <ProductionOrderDetail />, screenId: "PP-WO-001/2" },
  { path: "/production/dispatch", element: <DispatchList />, screenId: "PP-DSP-001" },
  { path: "/production/terminal", element: <ShopFloorTerminal />, screenId: "PP-SFT-001", layout: "kiosk" },
  { path: "/production/wip", element: <WipBoard />, screenId: "PP-WIP-001" },
  { path: "/production/rework", element: <ReworkList />, screenId: "RWO-001" },
  { path: "/production/rework/:id", element: <ReworkDetail />, screenId: "RWO-001" },
  { path: "/production/settlement", element: <SettlementRun />, screenId: "PP-SETTLE-001" },
  // Feature-list entries (routes are design values)
  { path: "/production/dialogs/run-mrp", element: <RunMrpDialogPage />, screenId: "FX-PLN-RUNMRP" },
  { path: "/production/schedule/scenarios", element: <ScenarioBoard />, screenId: "FX-PLN-SCENARIOS" },
  { path: "/production/work-center-load", element: <WorkCenterLoad />, screenId: "FX-PLN-LOAD" },
  { path: "/production/promise-reliability", element: <PromiseReliability />, screenId: "FX-PLN-RELIABILITY" },
  { path: "/production/transport-orders", element: <StoList />, screenId: "STO-001" },
  { path: "/production/transport-orders/:id", element: <StoDetail />, screenId: "STO-001" },
  { path: "/production/scheduling-masters", element: <SchedulingMasters />, screenId: "FX-PLN-CONSTRAINTS" },
  { path: "/production/capture-templates", element: <CaptureBuilder />, screenId: "FX-PRD-CAPTURE" },
  { path: "/production/dialogs/wo-decisions", element: <WoDecisionsPage />, screenId: "FX-PRD-WODIALOGS" },
  { path: "/production/labor-export", element: <LaborExport />, screenId: "FX-PRD-LABOR" },
  { path: "/production/receipts", element: <ReceiptsPage />, screenId: "FX-PRD-RECEIPT" },
  { path: "/production/reports", element: <ReportsIndex />, screenId: "FX-PRD-REPORTS" },
  { path: "/production/reports/:id", element: <ReportDetail />, screenId: "FX-PRD-REPORTS" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = [{ to: "/production/at-risk/promise", label: "Promise checks (CTP, all quotes and orders)", icon: Timer, module: "Planning" }]

/** Screens this module has built. CTP-DLG is "partial": the dialog, its rules and the planner's host
 *  page are here, but the registry route (/sales/orders/SO-2026-00402?ctp=1) belongs to the sales
 *  module, and the dialog is not yet embedded on the sales quote and order pages (README request R-1). */
export const built: Partial<Record<string, Built>> = {
  "PP-MRP-001": "full",
  "PLO-001": "full",
  "SCH-BOARD": "full",
  "CTP-DLG": "partial",
  "AT-RISK": "full",
  "PP-WC-001/2": "full",
  "PP-RTG-001/2": "full",
  "PP-WO-001/2": "full",
  "PP-DSP-001": "full",
  "PP-SFT-001": "full",
  "PP-WIP-001": "full",
  "RWO-001": "full",
  "PP-SETTLE-001": "full",
  "FX-PLN-RUNMRP": "full",
  "FX-PLN-SCENARIOS": "full",
  "FX-PLN-LOAD": "full",
  "FX-PLN-RELIABILITY": "full",
  "STO-001": "full",
  "FX-PLN-CONSTRAINTS": "full",
  "FX-PRD-CAPTURE": "full",
  "FX-PRD-WODIALOGS": "full",
  "FX-PRD-LABOR": "full",
  "FX-PRD-RECEIPT": "full",
  "FX-PRD-REPORTS": "full",
}
