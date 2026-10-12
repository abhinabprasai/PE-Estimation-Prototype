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

export const routes: ModuleRoute[] = [
  { path: "/sales/quotations", element: <QuotationList />, screenId: "OM-QT-001/2" },
  { path: "/sales/quotations/:id", element: <QuotationDetail />, screenId: "OM-QT-001/2" },
  { path: "/sales/orders", element: <OrderList />, screenId: "OM-SO-001/2" },
  { path: "/sales/orders/new", element: <NewOrder />, screenId: "OM-SO-001/2" },
  { path: "/sales/orders/:id", element: <OrderDetail />, screenId: "OM-SO-001/2" },
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
}
