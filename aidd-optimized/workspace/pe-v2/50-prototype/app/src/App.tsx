// App root: registers every module's slices, then builds the route table from the module routes
// plus a "Not built yet" placeholder for every registry path no module has claimed.
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MODULES } from "@/modules/registry"
import { SCREENS, screenPaths, type ScreenEntry } from "@/data/screens"
import { store } from "@/store"
import { ModulesContext } from "@/app/modules-context"
import { OfficeLayout, PrototypeBanner } from "@/app/AppShell"
import { NotBuilt } from "@/app/NotBuilt"
import { CoveragePage } from "@/app/CoveragePage"
import { KioskExample, TemplateGallery } from "@/app/TemplateGallery"

// ---- one-time registration (before first render)
for (const m of MODULES) for (const s of m.slices) store.register(s)
store.start()
// Development only: the store on window for console checks (window.__pe.store.getSlice("sales")).
if (import.meta.env.DEV) Object.assign(window, { __pe: { store } })

const moduleRoutes = MODULES.flatMap((m) => m.routes)
const claimed = new Set(moduleRoutes.map((r) => r.path))
const placeholders: { path: string; screen: ScreenEntry }[] = SCREENS.flatMap((s) => screenPaths(s).filter((p) => !claimed.has(p)).map((path) => ({ path, screen: s })))

function Redirect({ to }: { to: string }) {
  const params = useParams()
  return <Navigate to={to.replace(/:(\w+)/g, (_, k) => params[k] ?? "")} replace />
}

function AppRoutes() {
  const loc = useLocation()
  const kiosk = [...moduleRoutes.filter((r) => r.layout === "kiosk"), { path: "/dev/kiosk", element: <KioskExample /> }]
  const isKiosk = kiosk.some((r) => matches(r.path, loc.pathname))
  if (isKiosk)
    return (
      <Routes>
        {kiosk.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Routes>
    )
  return (
    <OfficeLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/sales/quotations/QT-TBD-0412-V2" replace />} />
        <Route path="/coverage" element={<CoveragePage />} />
        <Route path="/dev/templates" element={<TemplateGallery />} />
        {moduleRoutes
          .filter((r) => r.layout !== "kiosk")
          .map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        {placeholders.map(({ path, screen }) =>
          screen.id === "INV-RETURN" ? (
            <Route key={path} path={path} element={<Redirect to="/sales/rma" />} />
          ) : (
            <Route key={path} path={path} element={<NotBuilt screen={screen} />} />
          ),
        )}
        <Route path="*" element={<p>This address is not in the screen plan. Use the sidebar or search (Ctrl K).</p>} />
      </Routes>
    </OfficeLayout>
  )
}

function matches(pattern: string, pathname: string) {
  return new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "/?$").test(pathname)
}

export default function App() {
  return (
    <ModulesContext.Provider value={MODULES}>
      <TooltipProvider>
        <BrowserRouter>
          <PrototypeBanner />
          <AppRoutes />
          <Toaster theme="light" position="bottom-right" />
        </BrowserRouter>
      </TooltipProvider>
    </ModulesContext.Provider>
  )
}
