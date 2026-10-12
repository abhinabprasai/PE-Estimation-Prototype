// materials routes: every screen of the group at its registry path (APP-ARCHITECTURE.md §2).
// INV-RETURN ships no screen: the shell redirects /inventory/returns to /sales/rma.
import { Navigate, useParams } from "react-router"
import { GitBranch } from "lucide-react"
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { MaterialList } from "./pages/MaterialList"
import { MaterialDetail, MaterialSalesTab } from "./pages/MaterialDetail"
import { McrDetail, McrQueue } from "./pages/Mcr"
import { MchWizard } from "./pages/Mch"
import { Supersessions } from "./pages/Supersessions"
import { InfoRecordDetail, InfoRecordList } from "./pages/InfoRecords"
import { SourceLists } from "./pages/SourceLists"
import { AccountDetermination } from "./pages/AccountDetermination"
import { EoReserve } from "./pages/EoReserve"
import { DataQuality } from "./pages/DataQuality"
import { CountDetail, CountList } from "./pages/Counts"
import { SafetyStock } from "./pages/SafetyStock"

export const routes: ModuleRoute[] = [
  { path: "/inventory/items", element: <MaterialList />, screenId: "MM-MAT-001" },
  { path: "/inventory/items/:id", element: <MaterialDetail />, screenId: "INV 2.3 + MM views" },
  { path: "/inventory/items/:id/sales", element: <MaterialSalesTab />, screenId: "INV-ITEM-SALES" },
  { path: "/materials/creation-requests", element: <McrQueue />, screenId: "MM-MCR-001/2" },
  { path: "/materials/creation-requests/:id", element: <McrDetail />, screenId: "MM-MCR-001/2" },
  { path: "/materials/change-requests", element: <MchWizard />, screenId: "MM-MCH-001" },
  { path: "/materials/supersessions", element: <Supersessions />, screenId: "MM-SUP-001" },
  { path: "/purchasing/info-records", element: <InfoRecordList />, screenId: "MM-IR-001/2" },
  { path: "/purchasing/info-records/:id", element: <InfoRecordDetail />, screenId: "MM-IR-001/2" },
  { path: "/purchasing/source-lists", element: <SourceLists />, screenId: "MM-SL-001" },
  { path: "/materials/account-determination", element: <AccountDetermination />, screenId: "MM-VAL-001" },
  { path: "/materials/eo-reserve", element: <EoReserve />, screenId: "MM-EOR-001" },
  { path: "/materials/data-quality", element: <DataQuality />, screenId: "MM-DQ-001" },
  // PRD routes [DOC:p.36 §7; p.43 §10; Book VII pp.280-281]
  { path: "/inventory/counting/count-documents", element: <CountList />, screenId: "INV-COUNT-DOC" },
  { path: "/inventory/counting/count-documents/:id", element: <CountDetail />, screenId: "INV-COUNT-DOC" },
  { path: "/inventory/planning/safety-stock", element: <SafetyStock />, screenId: "INV-PLAN-SAFETY" },
  // The registry rows still carry the earlier paths (request R-9); they redirect to the PRD routes.
  { path: "/inventory/counts", element: <Navigate to="/inventory/counting/count-documents" replace />, screenId: "INV-COUNT-DOC" },
  { path: "/inventory/counts/:id", element: <OldCountRedirect />, screenId: "INV-COUNT-DOC" },
  { path: "/inventory/safety-stock", element: <Navigate to="/inventory/planning/safety-stock" replace />, screenId: "INV-PLAN-SAFETY" },
]

function OldCountRedirect() {
  const { id = "" } = useParams()
  return <Navigate to={`/inventory/counting/count-documents/${id}`} replace />
}

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = [{ to: "/materials/creation-requests/MCR-TBD-0301", label: "Hero thread: MCR-TBD-0301 (OLTC)", icon: GitBranch, module: "Materials" }]

/** Screens this module has built. INV-RETURN stays the shell's redirect to /sales/rma (ships no screen). */
export const built: Partial<Record<string, Built>> = {
  "MM-MAT-001": "full",
  "INV 2.3 + MM views": "full",
  "MM-MCR-001/2": "full",
  "MM-MCH-001": "full",
  "MM-SUP-001": "full",
  "MM-IR-001/2": "full",
  "MM-SL-001": "full",
  "MM-VAL-001": "full",
  "MM-EOR-001": "full",
  "MM-DQ-001": "full",
  "INV-ITEM-SALES": "full",
  "INV-COUNT-DOC": "full",
  "INV-PLAN-SAFETY": "full",
}
