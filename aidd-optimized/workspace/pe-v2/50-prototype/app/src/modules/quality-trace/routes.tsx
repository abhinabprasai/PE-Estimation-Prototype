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
import { AsBuiltDetail, AsBuiltList } from "./pages/AsBuilt"
import { AuditDetail, AuditList } from "./pages/Audits"
import { CameraScan } from "./pages/CameraScan"
import { GenealogyCorrection } from "./pages/GenealogyCorrection"
import { Relabel } from "./pages/Relabel"
import { ReprintGovernance } from "./pages/ReprintGovernance"
import { RoutineTests } from "./pages/RoutineTests"
import { SamplingState } from "./pages/Sampling"
import { ScanExceptionQueue } from "./pages/ScanExceptions"
import { ScarVendorResponse } from "./pages/ScarResponse"
import { SpcCharts } from "./pages/Spc"
import { StockStatusMoves } from "./pages/StockStatus"
import { TestImport } from "./pages/TestImport"
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
  // feature-list screens (routes are design values)
  { path: "/configuration/barcode/scan-exceptions", element: <ScanExceptionQueue />, screenId: "FX-BC-EXCEPTIONS" },
  { path: "/configuration/barcode/reprint", element: <ReprintGovernance />, screenId: "FX-BC-REPRINT" },
  { path: "/mobile/relabel", element: <Relabel />, layout: "kiosk", screenId: "FX-BC-RELABEL" },
  { path: "/mobile/camera-scan", element: <CameraScan />, layout: "kiosk", screenId: "FX-BC-CAMERA" },
  { path: "/quality/sampling", element: <SamplingState />, screenId: "FX-QM-SAMPLING" },
  { path: "/quality/stock-status", element: <StockStatusMoves />, screenId: "FX-QM-INVALIGN" },
  { path: "/quality/test-import", element: <TestImport />, screenId: "FX-QM-TESTIMPORT" },
  { path: "/quality/routine-tests", element: <RoutineTests />, screenId: "FX-QM-ROUTINE" },
  { path: "/quality/scar-response", element: <ScarVendorResponse />, screenId: "FX-QM-SCARRESP" },
  { path: "/quality/spc", element: <SpcCharts />, screenId: "FX-QM-SPC" },
  { path: "/quality/audits", element: <AuditList />, screenId: "FX-QM-AUDIT" },
  { path: "/quality/audits/:id", element: <AuditDetail />, screenId: "FX-QM-AUDIT" },
  { path: "/traceability/as-built", element: <AsBuiltList />, screenId: "FX-TRC-ASBUILT" },
  { path: "/traceability/as-built/:id", element: <AsBuiltDetail />, screenId: "FX-TRC-ASBUILT" },
  { path: "/traceability/genealogy-correction", element: <GenealogyCorrection />, screenId: "FX-TRC-CORRECTION" },
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
  "FX-BC-EXCEPTIONS": "full",
  "FX-BC-REPRINT": "full",
  "FX-BC-RELABEL": "full",
  "FX-BC-CAMERA": "full",
  "FX-QM-SAMPLING": "full",
  "FX-QM-INVALIGN": "full",
  "FX-QM-TESTIMPORT": "full",
  "FX-QM-ROUTINE": "full",
  "FX-QM-SCARRESP": "full",
  "FX-QM-SPC": "full",
  "FX-QM-AUDIT": "full",
  "FX-TRC-ASBUILT": "full",
  "FX-TRC-CORRECTION": "full",
}
