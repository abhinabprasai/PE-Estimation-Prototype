// sales routes. FL-09 screens (moved here unchanged from src/pages in the foundation pass) plus the
// placeholders the app shell generates for the rest of Sales and Returns until a route claims them.
import { ClipboardCheck, PackagePlus, Route, Timer } from "lucide-react"
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { QuotationDetail, QuotationList } from "./pages/Quotations"
import { NewOrder, OrderDetail, OrderList } from "./pages/Orders"
import { DeliveryCockpit } from "./pages/Deliveries"
import { PackingQueue, PackStation } from "./pages/Packing"
import { PodDetail, PodQueue } from "./pages/Pod"
import { LeadDetail, LeadList } from "./pages/Leads"
import { CustomerDetail, CustomerList } from "./pages/Customers"
import { BackorderWorkbench } from "./pages/Backorders"
import { RmaDetail, RmaList, RmaNew } from "./pages/Rma"
import { RmaReceipt } from "./pages/RmaReceipt"
import { RmaDisposition } from "./pages/RmaDisposition"
import { InstalledBaseDetail, InstalledBaseList } from "./pages/InstalledBase"
import { SparesFinder } from "./pages/SparesFinder"
import { LeadImport } from "./pages/fx/LeadImport"
import { QuoteToOrderPage } from "./pages/fx/QuoteToOrder"
import { KitExplodePage } from "./pages/fx/KitExplode"
import { BillingPlanPage } from "./pages/fx/BillingPlan"
import { EtoCostPage } from "./pages/fx/EtoCost"
import { AtpPartialPage } from "./pages/fx/AtpPartial"
import { ChangeCancelPage } from "./pages/fx/ChangeCancelReprice"
import { CreditDepegPage } from "./pages/fx/CreditDepeg"
import { CustomerPropertyPage } from "./pages/fx/CustomerProperty"
import { DeliveryRunPage } from "./pages/fx/DeliveryRun"
import { ShipmentDetail, ShipmentList } from "./pages/fx/Shipments"
import { ExportDocsPage } from "./pages/fx/ExportDocs"
import { PgiPage } from "./pages/fx/PgiDialogs"
import { LoadShip } from "./pages/fx/LoadShip"
import { ScaleReadoutPage } from "./pages/fx/ScaleReadout"
import { SalesReport, SalesReportsHome } from "./pages/fx/SalesReports"
import { RmaActionsPage } from "./pages/fx/RmaDialogs"
import { CreditMemoPage } from "./pages/fx/CreditMemo"
import { BillableRepairPage } from "./pages/fx/BillableRepair"
import { WarrantyExclusions } from "./pages/fx/WarrantyExclusions"

export const routes: ModuleRoute[] = [
  { path: "/sales/quotations", element: <QuotationList />, screenId: "OM-QT-001/2" },
  { path: "/sales/quotations/:id", element: <QuotationDetail />, screenId: "OM-QT-001/2" },
  { path: "/sales/orders", element: <OrderList />, screenId: "OM-SO-001/2" },
  { path: "/sales/orders/new", element: <NewOrder />, screenId: "OM-SO-001/2" },
  { path: "/sales/orders/:id", element: <OrderDetail />, screenId: "OM-SO-001/2" },
  // CTP-DLG's registry route (design value) is this order: the page embeds the planning module's Promise Dialog.
  { path: "/sales/orders/SO-2026-00402", element: <OrderDetail forId="SO-2026-00402" />, screenId: "CTP-DLG" },
  { path: "/sales/deliveries", element: <DeliveryCockpit />, screenId: "OM-DLV-001" },
  { path: "/sales/packing", element: <PackingQueue />, screenId: "OM-PACK-*" },
  // The pack station runs on the shared KioskPage + ScanField (F-01 fixed: no refocus on blur).
  { path: "/sales/packing/station/:id", element: <PackStation />, screenId: "OM-PACK-*", layout: "kiosk" },
  { path: "/sales/pod", element: <PodQueue />, screenId: "OM-POD-001" },
  { path: "/sales/pod/:id", element: <PodDetail />, screenId: "OM-POD-001" },
  { path: "/sales/leads", element: <LeadList />, screenId: "OM-LEAD-001/2" },
  { path: "/sales/leads/:id", element: <LeadDetail />, screenId: "OM-LEAD-001/2" },
  { path: "/sales/customers", element: <CustomerList />, screenId: "OM-CUST-001/2" },
  { path: "/sales/customers/:id", element: <CustomerDetail />, screenId: "OM-CUST-001/2" },
  { path: "/sales/backorders", element: <BackorderWorkbench />, screenId: "OM-BO-001" },
  { path: "/sales/rma", element: <RmaList />, screenId: "RMA-LIST/CREATE" },
  { path: "/sales/rma/new", element: <RmaNew />, screenId: "RMA-LIST/CREATE" },
  { path: "/sales/rma/receipt", element: <RmaReceipt />, screenId: "RMA-RECEIPT", layout: "kiosk" },
  { path: "/sales/rma/:id", element: <RmaDetail />, screenId: "RMA-LIST/CREATE" },
  { path: "/sales/rma/:id/disposition", element: <RmaDisposition />, screenId: "RMA-DISP" },
  { path: "/service/installed-base", element: <InstalledBaseList />, screenId: "IB-001" },
  { path: "/service/installed-base/:id", element: <InstalledBaseDetail />, screenId: "IB-001" },
  { path: "/service/spares-finder", element: <SparesFinder />, screenId: "SVC-SPF-001" },
  // ---- feature-list screens (12 October 2026): routes are design values
  { path: "/sales/leads/import", element: <LeadImport />, screenId: "FX-OM-LEADIMPORT" },
  { path: "/sales/dialogs/quote-to-order", element: <QuoteToOrderPage />, screenId: "FX-OM-QT2SO" },
  { path: "/sales/dialogs/kit-explode", element: <KitExplodePage />, screenId: "FX-OM-KIT" },
  { path: "/sales/billing-plan", element: <BillingPlanPage />, screenId: "FX-OM-BILLPLAN" },
  { path: "/sales/eto-cost", element: <EtoCostPage />, screenId: "FX-OM-EAC" },
  { path: "/sales/dialogs/atp-partial", element: <AtpPartialPage />, screenId: "FX-OM-ATP" },
  { path: "/sales/dialogs/change-cancel-reprice", element: <ChangeCancelPage />, screenId: "FX-OM-CHANGE" },
  { path: "/sales/dialogs/credit-release-depeg", element: <CreditDepegPage />, screenId: "FX-OM-CREDIT" },
  { path: "/sales/dialogs/customer-property", element: <CustomerPropertyPage />, screenId: "FX-OM-CUSTPROP" },
  { path: "/sales/deliveries/create-run", element: <DeliveryRunPage />, screenId: "FX-OM-DLVRUN" },
  { path: "/sales/shipments", element: <ShipmentList />, screenId: "OM-SHP-001/002" },
  { path: "/sales/shipments/:id", element: <ShipmentDetail />, screenId: "OM-SHP-001/002" },
  { path: "/sales/dialogs/export-docs", element: <ExportDocsPage />, screenId: "FX-OM-EXPORT" },
  { path: "/sales/dialogs/pgi", element: <PgiPage />, screenId: "FX-OM-PGI" },
  { path: "/sales/load-ship", element: <LoadShip />, screenId: "FX-OM-LOADSHIP", layout: "kiosk" },
  { path: "/sales/dialogs/scale-readout", element: <ScaleReadoutPage />, screenId: "FX-OM-SCALE" },
  { path: "/sales/reports", element: <SalesReportsHome />, screenId: "FX-OM-REPORTS" },
  { path: "/sales/reports/:id", element: <SalesReport />, screenId: "FX-OM-REPORTS" },
  { path: "/sales/dialogs/rma-actions", element: <RmaActionsPage />, screenId: "FX-RMA-DIALOGS" },
  { path: "/sales/dialogs/credit-memo", element: <CreditMemoPage />, screenId: "FX-RMA-CREDITMEMO" },
  { path: "/sales/dialogs/billable-repair", element: <BillableRepairPage />, screenId: "FX-RMA-BILLABLE" },
  { path: "/service/warranty-exclusions", element: <WarrantyExclusions />, screenId: "FX-RMA-EXCLUSIONS" },
]

export const nav: NavEntry[] = [
  { to: "/sales/orders/SO-2026-00402?ctp=1", label: "CTP promise (SO-2026-00402)", icon: Timer, module: "Planning" },
  { to: "/sales/quotations/QT-TBD-0412-V2", label: "FL-09 walked path start", icon: ClipboardCheck, module: "Sales" },
  { to: "/sales/leads/LEAD-TBD-0301", label: "Hero thread: Omaha North lead", icon: Route, module: "Sales" },
  { to: "/sales/rma/new", label: "Create RMA", icon: PackagePlus, module: "Returns" },
]

/** Screens this module has built. Ids owned here: OM-LEAD-001/2, OM-CUST-001/2, OM-QT-001/2,
 *  OM-SO-001/2, OM-BO-001, OM-DLV-001, OM-PACK-*, OM-POD-001, RMA-LIST/CREATE, RMA-RECEIPT, RMA-DISP,
 *  IB-001, SVC-SPF-001 (CTP-DLG is a Planning entry implemented here for FL-09). */
export const built: Partial<Record<string, Built>> = {
  "OM-QT-001/2": "full",
  "OM-SO-001/2": "full",
  "OM-DLV-001": "full",
  "OM-PACK-*": "full",
  "OM-POD-001": "full",
  "CTP-DLG": "partial",
  "OM-LEAD-001/2": "full",
  "OM-CUST-001/2": "full",
  "OM-BO-001": "full",
  "RMA-LIST/CREATE": "full",
  "RMA-RECEIPT": "full",
  "RMA-DISP": "full",
  "IB-001": "full",
  "SVC-SPF-001": "full",
  "FX-OM-LEADIMPORT": "full",
  "FX-OM-QT2SO": "full",
  "FX-OM-KIT": "full",
  "FX-OM-BILLPLAN": "full",
  "FX-OM-EAC": "full",
  "FX-OM-ATP": "full",
  "FX-OM-CHANGE": "full",
  "FX-OM-CREDIT": "full",
  "FX-OM-CUSTPROP": "full",
  "FX-OM-DLVRUN": "full",
  "OM-SHP-001/002": "full",
  "FX-OM-EXPORT": "full",
  "FX-OM-PGI": "full",
  "FX-OM-LOADSHIP": "full",
  "FX-OM-SCALE": "full",
  "FX-OM-REPORTS": "full",
  "FX-RMA-DIALOGS": "full",
  "FX-RMA-CREDITMEMO": "full",
  "FX-RMA-BILLABLE": "full",
  "FX-RMA-EXCLUSIONS": "full",
}
