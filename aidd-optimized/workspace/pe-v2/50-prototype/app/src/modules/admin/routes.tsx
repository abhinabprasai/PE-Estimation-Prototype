// admin routes: every screen of the group at its registry path. See 50-prototype/APP-ARCHITECTURE.md
// "Add a route". OPS-JOBS/INT is a Workbench pair: /operations/jobs (registry path) and
// /operations/integrations (registry alternate path).
import { Navigate, useLocation } from "react-router"
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { WorkflowInbox } from "./pages/WorkflowInbox"
import { WorkflowDefinitions } from "./pages/WorkflowDefinitions"
import { OpsJobs } from "./pages/OpsJobs"
import { OpsIntegrations } from "./pages/OpsIntegrations"
import { CoreConfig } from "./pages/CoreConfig"
import { PeriodControl } from "./pages/PeriodControl"
import { TaxConfig } from "./pages/TaxConfig"
import { MobileApproval } from "./pages/MobileApproval"
import { ActionLanding } from "./pages/ActionLanding"
import { ApprovalDialogs } from "./pages/ApprovalDialogs"
import { AlertRules } from "./pages/AlertRules"
import { NotificationTemplates } from "./pages/NotificationTemplates"
import { AccessRecertification } from "./pages/AccessRecertification"
import { KpiDictionary } from "./pages/KpiDictionary"
import { WorkflowAnalytics } from "./pages/WorkflowAnalytics"
import { NumberSeries } from "./pages/NumberSeries"
import { RmaPolicy } from "./pages/RmaPolicy"
import { SettingsHub, SettingsSection } from "./pages/SettingsPages"
import { MaterialSettings } from "./pages/MaterialSettings"
import { PlantDetail, PlantList } from "./pages/Plants"
import { TransferLanes } from "./pages/TransferLanes"
import { Intercompany } from "./pages/Intercompany"
import { ReasonCodes } from "./pages/ReasonCodes"
import { DpsOnboarding } from "./pages/DpsOnboarding"
import { DpsReview } from "./pages/DpsReview"
import { GlMapping } from "./pages/GlMapping"

/** The shared registry lists the two Book VII config screens at /configuration/periods and /configuration/tax;
 *  the PRD gives /inventory/configuration/fiscal-periods and /inventory/configuration/tax [DOC:p.41, p.45].
 *  The page is served at the PRD URL and the registry path redirects there, keeping the query (R-7). */
function ToPrd({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

export const routes: ModuleRoute[] = [
  { path: "/approvals", element: <WorkflowInbox />, screenId: "WF-INBOX" },
  { path: "/configuration/workflows", element: <WorkflowDefinitions />, screenId: "WF-DEF" },
  { path: "/operations/jobs", element: <OpsJobs />, screenId: "OPS-JOBS/INT" },
  { path: "/operations/integrations", element: <OpsIntegrations />, screenId: "OPS-JOBS/INT" },
  { path: "/configuration/core", element: <CoreConfig />, screenId: "CFG-CORE" },
  { path: "/inventory/configuration/fiscal-periods", element: <PeriodControl />, screenId: "INV-CONFIG-PERIOD" },
  { path: "/inventory/configuration/tax", element: <TaxConfig />, screenId: "INV-CONFIG-TAX" },
  { path: "/approvals/mobile", element: <MobileApproval />, screenId: "FX-WF-MOBILE" },
  { path: "/approvals/action/:token", element: <ActionLanding />, screenId: "FX-WF-MOBILE" },
  { path: "/approvals/dialogs", element: <ApprovalDialogs />, screenId: "FX-WF-DIALOGS" },
  { path: "/approvals/analytics", element: <WorkflowAnalytics />, screenId: "FX-WF-ANALYTICS" },
  { path: "/configuration/alert-rules", element: <AlertRules />, screenId: "FX-WF-ALERTS" },
  { path: "/configuration/notification-templates", element: <NotificationTemplates />, screenId: "FX-WF-NOTIFTPL" },
  { path: "/configuration/access-recertification", element: <AccessRecertification />, screenId: "FX-WF-RECERT" },
  { path: "/configuration/kpi-dictionary", element: <KpiDictionary />, screenId: "FX-WF-KPI" },
  { path: "/configuration/number-series", element: <NumberSeries />, screenId: "FX-CFG-NUMSERIES" },
  { path: "/configuration/rma-policy", element: <RmaPolicy />, screenId: "FX-CFG-RMAPOLICY" },
  { path: "/configuration/settings", element: <SettingsHub />, screenId: "FX-CFG-SETTINGS" },
  { path: "/configuration/settings/sales", element: <SettingsSection section="sales" />, screenId: "FX-CFG-SETTINGS" },
  { path: "/configuration/settings/production", element: <SettingsSection section="production" />, screenId: "FX-CFG-SETTINGS" },
  { path: "/configuration/settings/engineering", element: <SettingsSection section="engineering" />, screenId: "FX-CFG-SETTINGS" },
  { path: "/configuration/settings/quality", element: <SettingsSection section="quality" />, screenId: "FX-CFG-SETTINGS" },
  { path: "/configuration/material-settings", element: <MaterialSettings />, screenId: "FX-CFG-MATERIAL" },
  { path: "/configuration/plants", element: <PlantList />, screenId: "MP-PLANT-001" },
  { path: "/configuration/plants/:id", element: <PlantDetail />, screenId: "MP-PLANT-001" },
  { path: "/configuration/transfer-lanes", element: <TransferLanes />, screenId: "MP-LANE-001" },
  { path: "/configuration/intercompany", element: <Intercompany />, screenId: "FX-CFG-IC" },
  { path: "/configuration/reason-codes", element: <ReasonCodes />, screenId: "FX-CFG-REASONS" },
  { path: "/configuration/denied-party/onboarding", element: <DpsOnboarding />, screenId: "FX-CFG-DPS-ONBOARD" },
  { path: "/configuration/denied-party/review", element: <DpsReview />, screenId: "FX-CFG-DPS-REVIEW" },
  { path: "/configuration/gl-mapping", element: <GlMapping />, screenId: "FX-CFG-GLMAP" },
  { path: "/configuration/periods", element: <ToPrd to="/inventory/configuration/fiscal-periods" />, screenId: "INV-CONFIG-PERIOD" },
  { path: "/configuration/tax", element: <ToPrd to="/inventory/configuration/tax" />, screenId: "INV-CONFIG-TAX" },
]

export const nav: NavEntry[] = [{ to: "/operations/integrations", label: "Integration console", module: "Workflow and Administration" }]

/** Ids owned here: the six PRD screens plus the 18 feature-list rows (FX-*, MP-PLANT-001, MP-LANE-001). */
export const built: Partial<Record<string, Built>> = {
  "WF-INBOX": "full",
  "WF-DEF": "full",
  "OPS-JOBS/INT": "full",
  "CFG-CORE": "full",
  "INV-CONFIG-PERIOD": "full",
  "INV-CONFIG-TAX": "full",
  "FX-WF-MOBILE": "full",
  "FX-WF-DIALOGS": "full",
  "FX-WF-ALERTS": "full",
  "FX-WF-NOTIFTPL": "full",
  "FX-WF-RECERT": "full",
  "FX-WF-KPI": "full",
  "FX-WF-ANALYTICS": "full",
  "FX-CFG-NUMSERIES": "full",
  "FX-CFG-RMAPOLICY": "full",
  "FX-CFG-SETTINGS": "full",
  "FX-CFG-MATERIAL": "full",
  "MP-PLANT-001": "full",
  "MP-LANE-001": "full",
  "FX-CFG-IC": "full",
  "FX-CFG-REASONS": "full",
  "FX-CFG-DPS-ONBOARD": "full",
  "FX-CFG-DPS-REVIEW": "full",
  "FX-CFG-GLMAP": "full",
}
