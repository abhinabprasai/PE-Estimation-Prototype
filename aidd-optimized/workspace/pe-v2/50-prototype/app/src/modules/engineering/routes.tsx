// engineering routes. Each registry path is claimed here with its screenId; sub-pages (new, wizard
// steps) start with their screen's path. See 50-prototype/APP-ARCHITECTURE.md "Add a route".
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { EngineeringHome } from "./pages/Home"
import { RequestDetail, RequestList } from "./pages/Requests"
import { EbomList } from "./pages/Eboms"
import { EbomEditor } from "./pages/EbomEditor"
import { EcoDetail, EcoList, EcrDetail, EcrList, EcrNew } from "./pages/Changes"
import { MbomDetail, MbomList, MbomTransform } from "./pages/Mbom"
import { PvDetail, PvList } from "./pages/ProductionVersions"
import { DocDetail, DocList } from "./pages/Documents"
import { TrDetail, TrList, TrNew } from "./pages/Transmittals"
import { CadSync } from "./pages/CadSync"
import { CadImport } from "./pages/CadImport"

export const routes: ModuleRoute[] = [
  { path: "/engineering", element: <EngineeringHome />, screenId: "ENG-HOME-001" },
  { path: "/engineering/requests", element: <RequestList />, screenId: "ENG-REQ-001" },
  { path: "/engineering/requests/:id", element: <RequestDetail />, screenId: "ENG-REQ-001" },
  { path: "/engineering/boms", element: <EbomList />, screenId: "ENG-BOM-002" },
  { path: "/engineering/boms/:id", element: <EbomEditor />, screenId: "ENG-BOM-002" },
  { path: "/engineering/boms/:id/import", element: <CadImport />, screenId: "CAD-IMP" },
  { path: "/engineering/change-requests", element: <EcrList />, screenId: "ENG-ECR/ECO" },
  { path: "/engineering/change-requests/new", element: <EcrNew />, screenId: "ENG-ECR/ECO" },
  { path: "/engineering/change-requests/:id", element: <EcrDetail />, screenId: "ENG-ECR/ECO" },
  { path: "/engineering/change-orders", element: <EcoList />, screenId: "ENG-ECR/ECO" },
  { path: "/engineering/change-orders/:id", element: <EcoDetail />, screenId: "ENG-ECR/ECO" },
  { path: "/engineering/mbom-transform", element: <MbomList />, screenId: "MBOM-TRF" },
  { path: "/engineering/mbom-transform/new", element: <MbomTransform />, screenId: "MBOM-TRF" },
  { path: "/engineering/mbom-transform/new/:ebomId", element: <MbomTransform />, screenId: "MBOM-TRF" },
  { path: "/engineering/mbom-transform/:id", element: <MbomDetail />, screenId: "MBOM-TRF" },
  { path: "/engineering/production-versions", element: <PvList />, screenId: "PV-001" },
  { path: "/engineering/production-versions/:id", element: <PvDetail />, screenId: "PV-001" },
  { path: "/engineering/documents", element: <DocList />, screenId: "ENG-DOC-001/2" },
  { path: "/engineering/documents/:id", element: <DocDetail />, screenId: "ENG-DOC-001/2" },
  { path: "/engineering/transmittals", element: <TrList />, screenId: "TR-001" },
  { path: "/engineering/transmittals/new", element: <TrNew />, screenId: "TR-001" },
  { path: "/engineering/transmittals/:id", element: <TrDetail />, screenId: "TR-001" },
  { path: "/engineering/cad-sync", element: <CadSync />, screenId: "CAD-SYNC" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = []

/** Screens this module has built. */
export const built: Partial<Record<string, Built>> = {
  "ENG-HOME-001": "full",
  "ENG-REQ-001": "full",
  "ENG-BOM-002": "full",
  "ENG-ECR/ECO": "full",
  "MBOM-TRF": "full",
  "PV-001": "full",
  "ENG-DOC-001/2": "full",
  "TR-001": "full",
  "CAD-SYNC": "full",
  "CAD-IMP": "full",
}
