// quality-trace routes: every registry screen of the group claims its path here.
// See 50-prototype/APP-ARCHITECTURE.md "Add a route".
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { BarcodeAdmin } from "./pages/BarcodeAdmin"
import { CalibrationRegister } from "./pages/Calibration"
import { CapaDetail, CapaList, ScarDetail, ScarList } from "./pages/Capa"
import { QualityDashboard } from "./pages/Dashboard"
import { DeviationDetail, DeviationList } from "./pages/Deviations"
import { FinalTestDetail, FinalTestList } from "./pages/FinalTest"
import { InspectionDetail, InspectionQueues } from "./pages/Inspections"
import { PlanDetail, PlanList } from "./pages/Plans"
import { RecallDetail, RecallWorkbench } from "./pages/Recalls"
import { TraceDashboard } from "./pages/TraceDashboard"
import { TraceExplorer } from "./pages/TraceExplorer"

export const routes: ModuleRoute[] = [
  { path: "/quality/dashboard", element: <QualityDashboard />, screenId: "QM-DASH-001" },
  { path: "/quality/inspection-plans", element: <PlanList />, screenId: "QM-PLAN-001/2" },
  { path: "/quality/inspection-plans/:id", element: <PlanDetail />, screenId: "QM-PLAN-001/2" },
  { path: "/quality/inspections", element: <InspectionQueues />, screenId: "QM-EXEC" },
  { path: "/quality/inspections/:id", element: <InspectionDetail />, screenId: "QM-EXEC" },
  { path: "/quality/final-test", element: <FinalTestList />, screenId: "QM-FIN-001" },
  { path: "/quality/final-test/:id", element: <FinalTestDetail />, screenId: "QM-FIN-001" },
  { path: "/quality/capa", element: <CapaList />, screenId: "QM-CAPA/SCAR" },
  { path: "/quality/capa/:id", element: <CapaDetail />, screenId: "QM-CAPA/SCAR" },
  { path: "/quality/scar", element: <ScarList />, screenId: "QM-CAPA/SCAR" },
  { path: "/quality/scar/:id", element: <ScarDetail />, screenId: "QM-CAPA/SCAR" },
  { path: "/quality/deviations", element: <DeviationList />, screenId: "QM-DEV-001" },
  { path: "/quality/deviations/:id", element: <DeviationDetail />, screenId: "QM-DEV-001" },
  { path: "/quality/calibration", element: <CalibrationRegister />, screenId: "QM-CAL-001" },
  { path: "/quality/recalls", element: <RecallWorkbench />, screenId: "RCL-001" },
  { path: "/quality/recalls/:id", element: <RecallDetail />, screenId: "RCL-001" },
  { path: "/traceability/explorer", element: <TraceExplorer />, screenId: "TRC-EXPL" },
  { path: "/traceability/completeness", element: <TraceDashboard />, screenId: "TRC-DASH" },
  { path: "/configuration/barcode", element: <BarcodeAdmin />, screenId: "BC-ADMIN" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = [{ to: "/quality/scar", label: "SCAR register", module: "Quality" }]

/** Screens this module has built. */
export const built: Partial<Record<string, Built>> = {
  "QM-DASH-001": "full",
  "QM-PLAN-001/2": "full",
  "QM-EXEC": "full",
  "QM-FIN-001": "full",
  "QM-CAPA/SCAR": "full",
  "QM-DEV-001": "full",
  "QM-CAL-001": "full",
  "RCL-001": "full",
  "TRC-EXPL": "full",
  "TRC-DASH": "full",
  "BC-ADMIN": "full",
}
