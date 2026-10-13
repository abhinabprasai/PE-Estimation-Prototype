// target-state routes: every screen of the group at its registry path. See 50-prototype/APP-ARCHITECTURE.md "Add a route".
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { EdiMonitor, EdiPartnerDetail, EdiPartners } from "./pages/Edi"
import { MlCockpit, MlConfig, MlMaterialDetail, MlMaterials } from "./pages/MaterialLedger"
import { OptBench, OptProfiles, OptRuns } from "./pages/Optimizer"
import { GatpBackorders, GatpPromiseDialogPage, GatpSequences, GatpSimulator } from "./pages/Gatp"
import { PortalHome, PortalInvitation, PortalSignIn } from "./pages/PortalShell"
import { SupplierASN, SupplierDeviations, SupplierPOs, SupplierStatus } from "./pages/SupplierPortal"
import { CustomerDrawings, CustomerOrderDetail, CustomerOrders, CustomerReturns, CustomerShipments } from "./pages/CustomerPortal"
import { DowntimeLog, MachineCoreDeltas, OeeDashboard, SignalMapping, TerminalDowntime } from "./pages/Machine"
import { DispatchBoard, FieldMobile, ServiceContracts, ServiceOrderDetail, ServiceOrders, Technicians, VanStock } from "./pages/Field"
import { EquipmentDetail, EquipmentList, MaintBoard, MaintDashboard, MaintOrderDetail, MaintOrders, MaintPlans } from "./pages/Maint"
import { CarrierIntegration, LocCountries, TaxRegimes } from "./pages/Global"

export const routes: ModuleRoute[] = [
  { path: "/target/edi/partners", element: <EdiPartners />, screenId: "EDI-PART-001" },
  { path: "/target/edi/partners/:id", element: <EdiPartnerDetail />, screenId: "EDI-PART-001" },
  { path: "/target/edi/monitor", element: <EdiMonitor />, screenId: "EDI-MON-001" },
  { path: "/target/material-ledger/cockpit", element: <MlCockpit />, screenId: "ML-COCKPIT-001" },
  { path: "/target/material-ledger/materials", element: <MlMaterials />, screenId: "ML-MAT-001" },
  { path: "/target/material-ledger/materials/:id", element: <MlMaterialDetail />, screenId: "ML-MAT-001" },
  { path: "/target/material-ledger/config", element: <MlConfig />, screenId: "ML-CONFIG-001" },
  { path: "/target/optimizer/runs", element: <OptRuns />, screenId: "OPT-RUN-001" },
  { path: "/target/optimizer/profiles", element: <OptProfiles />, screenId: "OPT-PROF-001" },
  { path: "/target/optimizer/benchmark", element: <OptBench />, screenId: "OPT-BENCH-001" },
  { path: "/target/gatp/sequence", element: <GatpSequences />, screenId: "GATP-SEQ-001" },
  { path: "/target/gatp/simulator", element: <GatpSimulator />, screenId: "GATP-SIM-001" },
  { path: "/target/gatp/promise-dialog", element: <GatpPromiseDialogPage />, screenId: "FX-GATP-PROMISE" },
  { path: "/target/gatp/backorders", element: <GatpBackorders />, screenId: "FX-GATP-BACKORDER" },
  { path: "/target/portals", element: <PortalHome />, screenId: "FX-PTL-SHELL" },
  { path: "/target/portals/sign-in", element: <PortalSignIn />, screenId: "FX-PTL-SHELL" },
  { path: "/target/portals/invitation", element: <PortalInvitation />, screenId: "FX-PTL-SHELL" },
  { path: "/target/portals/supplier/orders", element: <SupplierPOs />, screenId: "FX-PTL-SUP-PO" },
  { path: "/target/portals/supplier/deviations", element: <SupplierDeviations />, screenId: "FX-PTL-SUP-DEV" },
  { path: "/target/portals/supplier/asn", element: <SupplierASN />, screenId: "FX-PTL-SUP-ASN" },
  { path: "/target/portals/supplier/status", element: <SupplierStatus />, screenId: "FX-PTL-SUP-STATUS" },
  { path: "/target/portals/customer/orders", element: <CustomerOrders />, screenId: "FX-PTL-CUS-ORDERS" },
  { path: "/target/portals/customer/orders/:id", element: <CustomerOrderDetail />, screenId: "FX-PTL-CUS-ORDERS" },
  { path: "/target/portals/customer/drawings", element: <CustomerDrawings />, screenId: "FX-PTL-CUS-DRAWINGS" },
  { path: "/target/portals/customer/shipments", element: <CustomerShipments />, screenId: "FX-PTL-CUS-SHIP" },
  { path: "/target/portals/customer/returns", element: <CustomerReturns />, screenId: "FX-PTL-CUS-RETURNS" },
  { path: "/target/machine/signal-mapping", element: <SignalMapping />, screenId: "MI-MAP-001" },
  { path: "/target/machine/downtime", element: <DowntimeLog />, screenId: "DT-LOG-001" },
  { path: "/target/machine/oee", element: <OeeDashboard />, screenId: "OEE-DASH-001" },
  { path: "/target/machine/terminal-downtime", element: <TerminalDowntime />, layout: "kiosk", screenId: "FX-MI-TERMINAL" },
  { path: "/target/machine/core-deltas", element: <MachineCoreDeltas />, screenId: "FX-MI-DELTAS" },
  { path: "/target/field-service/orders", element: <ServiceOrders />, screenId: "SVO-001" },
  { path: "/target/field-service/orders/:id", element: <ServiceOrderDetail />, screenId: "SVO-001" },
  { path: "/target/field-service/dispatch", element: <DispatchBoard />, screenId: "DSP-BOARD-001" },
  { path: "/target/field-service/mobile", element: <FieldMobile />, layout: "kiosk", screenId: "FX-FSM-MOBILE" },
  { path: "/target/field-service/van-stock", element: <VanStock />, screenId: "FX-FSM-VAN" },
  { path: "/target/field-service/contracts", element: <ServiceContracts />, screenId: "FX-FSM-CONTRACTS" },
  { path: "/target/field-service/technicians", element: <Technicians />, screenId: "FX-FSM-CONTRACTS" },
  { path: "/target/maintenance/equipment", element: <EquipmentList />, screenId: "EQ-001" },
  { path: "/target/maintenance/equipment/:id", element: <EquipmentDetail />, screenId: "EQ-001" },
  { path: "/target/maintenance/plans", element: <MaintPlans />, screenId: "MPLAN-001" },
  { path: "/target/maintenance/orders", element: <MaintOrders />, screenId: "MO-001" },
  { path: "/target/maintenance/orders/:id", element: <MaintOrderDetail />, screenId: "MO-001" },
  { path: "/target/maintenance/board", element: <MaintBoard />, screenId: "MAINT-BOARD-001" },
  { path: "/target/maintenance/dashboard", element: <MaintDashboard />, screenId: "FX-EAM-DASH" },
  { path: "/target/localization/countries", element: <LocCountries />, screenId: "LOC-COUNTRY-001" },
  { path: "/target/localization/tax-regimes", element: <TaxRegimes />, screenId: "FX-LOC-TAXREGIME" },
  { path: "/target/carrier/integration", element: <CarrierIntegration />, screenId: "FX-CAR-INTEGRATION" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = []

/** Screens this module has built. Keys are registry ids (see README). */
export const built: Partial<Record<string, Built>> = Object.fromEntries(
  [...new Set(routes.map((r) => r.screenId!))].map((id) => [id, "full" as Built]),
)
