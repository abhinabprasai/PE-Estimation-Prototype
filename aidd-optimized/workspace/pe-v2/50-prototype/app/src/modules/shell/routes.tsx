// shell routes: every screen of the group at its registry path. See 50-prototype/APP-ARCHITECTURE.md.
import type { ModuleRoute, NavEntry } from "@/app/module-types"
import type { Built } from "@/data/screens"
import { ArchetypeMapPage, ArchetypesPage, StateKitPage, TokensPage } from "./pages/Foundations"
import {
  ApprovalStripPage, CompletenessPage, ContextAuditPage, DataVizPage, DiffViewerPage, ExceptionCardsPage, GlPreviewPage, GuidelinesPage, KanbanPage, KioskControlsPage, MilestonePage, PriceWaterfallPage,
  ReadinessPage, RfqComparisonPage, ScanFeedbackPage, ScheduleGanttPage, SimulationPage, StatusLifecyclePage, TaxOverridePage, TestCharacteristicPage, TreeExplorerPage,
} from "./pages/Components"
import { NavigationPage, NotificationsPage, ProfilePage, SearchPage } from "./pages/ShellPages"
import { DegradedPage, DevicesPage, Error403Page, Error404Page, Error500Page, KioskDeviceView, KioskLockPage, MaintenancePage, SessionExpiredPage, SsoPage, StepUpPage, Tc77View, Wt6300View, WanDownPage } from "./pages/SystemPages"
import { DashboardRoutes } from "./pages/dashboard-routes"
import { CutoverPrint, CountDocPrint, InspectionPlanPrint, InvoiceSupplementPrint, PurchaseOrderPrint, RfqResponsePrint, ShippingDocsPrint, SparesListPrint } from "./print/Docs2"
import { FtrPrint, OrderPrint, PackingListPrint, QuotePrint, ReturnPrint, TravelerPrint } from "./print/Docs1"
import { EmailTemplatesPage, LabelDetailPage, LabelsIndexPage } from "./print/Docs3"
import { FlowPage, FlowsIndexPage, ValidationPage } from "./pages/Flows"

const r = (path: string, element: ModuleRoute["element"], screenId: string, layout?: ModuleRoute["layout"]): ModuleRoute => ({ path, element, screenId, layout })

export const routes: ModuleRoute[] = [
  // foundations and component gallery
  r("/components/tokens", <TokensPage />, "FX-FND-TOKENS"),
  r("/components/archetype-map", <ArchetypeMapPage />, "FX-FND-ARCH"),
  r("/components/state-kit", <StateKitPage />, "FX-FND-STATES"),
  r("/components/archetypes", <ArchetypesPage />, "FX-FND-ARCHETYPES"),
  r("/components/status-lifecycle", <StatusLifecyclePage />, "FX-CMP-STATUS"),
  r("/components/context-audit", <ContextAuditPage />, "FX-CMP-CONTEXT"),
  r("/components/readiness-chips", <ReadinessPage />, "FX-CMP-READY"),
  r("/components/approval-strip", <ApprovalStripPage />, "FX-CMP-APPROVAL"),
  r("/components/price-waterfall", <PriceWaterfallPage />, "FX-CMP-WATERFALL"),
  r("/components/scan-feedback", <ScanFeedbackPage />, "FX-CMP-SCAN"),
  r("/components/tree-explorer", <TreeExplorerPage />, "FX-CMP-TREE"),
  r("/components/milestone-strip", <MilestonePage />, "FX-CMP-MILESTONE"),
  r("/components/diff-viewer", <DiffViewerPage />, "FX-CMP-DIFF"),
  r("/components/gl-preview", <GlPreviewPage />, "FX-CMP-GL"),
  r("/components/exception-cards", <ExceptionCardsPage />, "FX-CMP-EXCEPTION"),
  r("/components/kiosk-controls", <KioskControlsPage />, "FX-CMP-KIOSK"),
  r("/components/schedule-gantt", <ScheduleGanttPage />, "FX-CMP-GANTT"),
  r("/components/kanban", <KanbanPage />, "FX-CMP-BOARD"),
  r("/components/rfq-comparison", <RfqComparisonPage />, "FX-CMP-RFQGRID"),
  r("/components/test-characteristic", <TestCharacteristicPage />, "FX-CMP-TESTROW"),
  r("/components/data-viz", <DataVizPage />, "FX-CMP-DATAVIZ"),
  r("/components/simulation-preview", <SimulationPage />, "FX-CMP-SIM"),
  r("/components/tax-override", <TaxOverridePage />, "FX-CMP-TAX"),
  r("/components/completeness", <CompletenessPage />, "FX-CMP-COMPLETE"),
  r("/components/guidelines", <GuidelinesPage />, "FX-CMP-GUIDE"),
  // global shell and system states
  r("/shell/navigation", <NavigationPage />, "FX-SHL-NAV"),
  r("/search", <SearchPage />, "FX-SHL-SEARCH"),
  r("/notifications", <NotificationsPage />, "FX-SHL-NOTIF"),
  r("/profile", <ProfilePage />, "FX-SHL-PROFILE"),
  r("/auth/sso", <SsoPage />, "FX-SHL-SSO"),
  r("/auth/session-expired", <SessionExpiredPage />, "FX-SHL-SSO"),
  r("/auth/step-up", <StepUpPage />, "FX-SHL-SSO"),
  r("/auth/kiosk-lock", <KioskLockPage />, "FX-SHL-SSO", "kiosk"),
  r("/errors/403", <Error403Page />, "FX-SHL-ERRORS"),
  r("/errors/404", <Error404Page />, "FX-SHL-ERRORS"),
  r("/errors/500", <Error500Page />, "FX-SHL-ERRORS"),
  r("/errors/maintenance", <MaintenancePage />, "FX-SHL-ERRORS"),
  r("/errors/degraded", <DegradedPage />, "FX-SHL-ERRORS"),
  r("/errors/wan-down", <WanDownPage />, "FX-SHL-ERRORS"),
  r("/shell/devices", <DevicesPage />, "FX-SHL-DEVICES"),
  r("/shell/devices/tc77", <Tc77View />, "FX-SHL-DEVICES", "kiosk"),
  r("/shell/devices/wt6300", <Wt6300View />, "FX-SHL-DEVICES", "kiosk"),
  r("/shell/devices/kiosk", <KioskDeviceView />, "FX-SHL-DEVICES", "kiosk"),
  // home and dashboards
  ...DashboardRoutes,
  // print outputs
  r("/print/quote", <QuotePrint />, "FX-PRN-QUOTE"),
  r("/print/order-confirmation", <OrderPrint />, "FX-PRN-ORDER"),
  r("/print/packing-list", <PackingListPrint />, "FX-PRN-PACKLIST"),
  r("/print/return-instructions", <ReturnPrint />, "FX-PRN-RETURN"),
  r("/print/traveler", <TravelerPrint />, "FX-PRN-TRAVELER"),
  r("/print/ftr", <FtrPrint />, "FX-PRN-FTR"),
  r("/print/purchase-order", <PurchaseOrderPrint />, "FX-PRN-PO"),
  r("/print/cutover-forms", <CutoverPrint />, "FX-PRN-CUTOVER"),
  r("/print/shipping-documents", <ShippingDocsPrint />, "FX-PRN-SHIPDOCS"),
  r("/print/rfq-response", <RfqResponsePrint />, "FX-PRN-RFQRESP"),
  r("/print/count-document", <CountDocPrint />, "FX-PRN-COUNT"),
  r("/print/inspection-plan", <InspectionPlanPrint />, "FX-PRN-INSPPLAN"),
  r("/print/invoice-supplement", <InvoiceSupplementPrint />, "FX-PRN-INVSUPP"),
  r("/print/spares-list", <SparesListPrint />, "FX-PRN-SPARES"),
  r("/print/email-templates", <EmailTemplatesPage />, "FX-PRN-EMAIL"),
  r("/print/labels", <LabelsIndexPage />, "FX-PRN-LABELS"),
  r("/print/labels/:id", <LabelDetailPage />, "FX-PRN-LABELS"),
  // flows
  r("/flows", <FlowsIndexPage />, "FX-FLW-INDEX"),
  r("/flows/validation", <ValidationPage />, "FX-FLW-VALIDATION"),
  r("/flows/:id", <FlowPage />, "FX-FLW-INDEX"),
]

/** Extra sidebar entries (the registry already lists every screen of this group). */
export const nav: NavEntry[] = []

/** Screens this module has built. Keys are registry ids (see README). */
export const built: Partial<Record<string, Built>> = Object.fromEntries(Array.from(new Set(routes.map((x) => x.screenId!))).map((id) => [id, "full" as Built]))
