// purchasing-finance routes. Every registry screen of this group claims its registry path here; the
// shell drops the "Not built yet" placeholder for each. See 50-prototype/APP-ARCHITECTURE.md "Add a route".
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { BuyerWorkbench, ExpediteBoard } from "./pages/Workbench"
import { VendorDetail, VendorList } from "./pages/Vendors"
import { PrDetail, PrList, RfqDetail, RfqList } from "./pages/Requisitions"
import { PoDetail, PoList } from "./pages/PurchaseOrders"
import { LlrDetail, LlrList } from "./pages/LongLead"
import { WcRates } from "./pages/WcRates"
import { CeDetail, CeList } from "./pages/CostEstimates"
import { CostingRuns } from "./pages/CostingRuns"
import { PriceListDetail, PriceListList } from "./pages/PriceLists"
import { Surcharges } from "./pages/Surcharges"
import { PriceSim } from "./pages/PriceSim"
import { CostVariance } from "./pages/CostVariance"
import { MarginAnalysis } from "./pages/Margin"
import { CenterList, CostCenterDetail, ProfitCenterDetail } from "./pages/Centers"
import { AllocationDetail, AllocationList } from "./pages/Allocations"
import { ReportDetail, ReportsIndex } from "./pages/Reports"

export const routes: ModuleRoute[] = [
  { path: "/purchasing/workbench", element: <BuyerWorkbench />, screenId: "PUR-WB-001" },
  { path: "/purchasing/vendors", element: <VendorList />, screenId: "PUR-VEND-001/2" },
  { path: "/purchasing/vendors/:id", element: <VendorDetail />, screenId: "PUR-VEND-001/2" },
  { path: "/purchasing/requisitions", element: <PrList />, screenId: "PUR-PR/RFQ" },
  { path: "/purchasing/requisitions/:id", element: <PrDetail />, screenId: "PUR-PR/RFQ" },
  { path: "/purchasing/rfqs", element: <RfqList />, screenId: "PUR-PR/RFQ" },
  { path: "/purchasing/rfqs/:id", element: <RfqDetail />, screenId: "PUR-PR/RFQ" },
  { path: "/purchasing/orders", element: <PoList />, screenId: "PUR-PO-001/2" },
  { path: "/purchasing/orders/:id", element: <PoDetail />, screenId: "PUR-PO-001/2" },
  { path: "/purchasing/long-lead", element: <LlrList />, screenId: "LLR-001" },
  { path: "/purchasing/long-lead/:id", element: <LlrDetail />, screenId: "LLR-001" },
  { path: "/purchasing/expedite", element: <ExpediteBoard />, screenId: "PUR-EXP-001" },
  { path: "/costing/work-center-rates", element: <WcRates />, screenId: "CST-RATE-001" },
  { path: "/costing/estimates", element: <CeList />, screenId: "CST-CE-001" },
  { path: "/costing/estimates/:id", element: <CeDetail />, screenId: "CST-CE-001" },
  { path: "/costing/runs", element: <CostingRuns />, screenId: "CST-RUN-001" },
  { path: "/pricing/price-lists", element: <PriceListList />, screenId: "PRC-PL-001" },
  { path: "/pricing/price-lists/:id", element: <PriceListDetail />, screenId: "PRC-PL-001" },
  { path: "/pricing/surcharges", element: <Surcharges />, screenId: "PRC-SUR-001" },
  { path: "/pricing/simulate", element: <PriceSim />, screenId: "PRC-SIM" },
  { path: "/inventory/valuation/cost-variance", element: <CostVariance />, screenId: "INV-CVA-001" },
  { path: "/pricing/margin", element: <MarginAnalysis />, screenId: "PRC-MARG" },
  { path: "/controlling/cost-centers", element: <CenterList kind="cost" />, screenId: "CO-CC/PC-001/2" },
  { path: "/controlling/cost-centers/:id", element: <CostCenterDetail />, screenId: "CO-CC/PC-001/2" },
  { path: "/controlling/profit-centers", element: <CenterList kind="profit" />, screenId: "CO-CC/PC-001/2" },
  { path: "/controlling/profit-centers/:id", element: <ProfitCenterDetail />, screenId: "CO-CC/PC-001/2" },
  { path: "/controlling/allocations", element: <AllocationList />, screenId: "CO-ALC-001/2" },
  { path: "/controlling/allocations/:id", element: <AllocationDetail />, screenId: "CO-ALC-001/2" },
  { path: "/controlling/reports", element: <ReportsIndex />, screenId: "CO-R1..R4" },
  { path: "/controlling/reports/:id", element: <ReportDetail />, screenId: "CO-R1..R4" },
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = [
  { to: "/purchasing/rfqs", label: "RFQs", module: "Purchasing" },
  { to: "/controlling/profit-centers", label: "Profit centers", module: "Controlling" },
]

/** Screens this module has built. */
export const built: Partial<Record<string, Built>> = {
  "PUR-WB-001": "full",
  "PUR-VEND-001/2": "full",
  "PUR-PR/RFQ": "full",
  "PUR-PO-001/2": "full",
  "LLR-001": "full",
  "PUR-EXP-001": "full",
  "CST-RATE-001": "full",
  "CST-CE-001": "full",
  "CST-RUN-001": "full",
  "PRC-PL-001": "full",
  "PRC-SUR-001": "full",
  "PRC-SIM": "full",
  "INV-CVA-001": "full",
  "PRC-MARG": "full",
  "CO-CC/PC-001/2": "full",
  "CO-ALC-001/2": "full",
  "CO-R1..R4": "full",
}
