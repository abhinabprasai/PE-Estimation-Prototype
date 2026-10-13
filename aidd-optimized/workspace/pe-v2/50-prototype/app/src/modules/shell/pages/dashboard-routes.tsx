// Routes for the home page and the four dashboards.
import type { ModuleRoute } from "@/app/module-types"
import { ExecutiveDashboardPage, HomePage, InventoryDashboardPage, ProductionDashboardPage, SalesDashboardPage } from "./Dashboards"

export const DashboardRoutes: ModuleRoute[] = [
  { path: "/home", element: <HomePage />, screenId: "FX-HOME-LANDING" },
  { path: "/dashboards/executive", element: <ExecutiveDashboardPage />, screenId: "FX-DASH-EXEC" },
  { path: "/dashboards/sales", element: <SalesDashboardPage />, screenId: "FX-DASH-SALES" },
  { path: "/dashboards/production", element: <ProductionDashboardPage />, screenId: "FX-DASH-PROD" },
  { path: "/dashboards/inventory", element: <InventoryDashboardPage />, screenId: "FX-DASH-INV" },
]
