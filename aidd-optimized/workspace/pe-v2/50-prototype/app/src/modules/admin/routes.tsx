// admin routes: every screen of the group at its registry path. See 50-prototype/APP-ARCHITECTURE.md
// "Add a route". OPS-JOBS/INT is a Workbench pair: /operations/jobs (registry path) and
// /operations/integrations (registry alternate path).
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { WorkflowInbox } from "./pages/WorkflowInbox"
import { WorkflowDefinitions } from "./pages/WorkflowDefinitions"
import { OpsJobs } from "./pages/OpsJobs"
import { OpsIntegrations } from "./pages/OpsIntegrations"
import { CoreConfig } from "./pages/CoreConfig"
import { PeriodControl } from "./pages/PeriodControl"
import { TaxConfig } from "./pages/TaxConfig"

export const routes: ModuleRoute[] = [
  { path: "/approvals", element: <WorkflowInbox />, screenId: "WF-INBOX" },
  { path: "/configuration/workflows", element: <WorkflowDefinitions />, screenId: "WF-DEF" },
  { path: "/operations/jobs", element: <OpsJobs />, screenId: "OPS-JOBS/INT" },
  { path: "/operations/integrations", element: <OpsIntegrations />, screenId: "OPS-JOBS/INT" },
  { path: "/configuration/core", element: <CoreConfig />, screenId: "CFG-CORE" },
  { path: "/configuration/periods", element: <PeriodControl />, screenId: "INV-CONFIG-PERIOD" },
  { path: "/configuration/tax", element: <TaxConfig />, screenId: "INV-CONFIG-TAX" },
]

export const nav: NavEntry[] = [{ to: "/operations/integrations", label: "Integration console", module: "Workflow and Administration" }]

/** Ids owned here: WF-INBOX, WF-DEF, OPS-JOBS/INT, CFG-CORE, INV-CONFIG-PERIOD, INV-CONFIG-TAX */
export const built: Partial<Record<string, Built>> = {
  "WF-INBOX": "full",
  "WF-DEF": "full",
  "OPS-JOBS/INT": "full",
  "CFG-CORE": "full",
  "INV-CONFIG-PERIOD": "full",
  "INV-CONFIG-TAX": "full",
}
