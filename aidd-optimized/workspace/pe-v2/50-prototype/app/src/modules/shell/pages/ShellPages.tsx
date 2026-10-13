// FX-SHL-NAV, FX-SHL-SEARCH, FX-SHL-NOTIF, FX-SHL-PROFILE: shell navigation, search results,
// notification center and the user profile with preferences and delegation.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Bell, ChevronsLeft, ChevronsRight, History, Search as SearchIcon } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, EmptyState, FamilyBadge, StatusBadge, type Column } from "@/components/patterns"
import { ConfigPage, DetailPage, WorkbenchPage } from "@/components/templates"
import { ROLE_GROUPS, type Family } from "@/data/domain"
import { FISCAL_PERIODS, LEGAL_ENTITIES, SPINE_DOCS, USERS } from "@/data/shared"
import { SCREENS } from "@/data/screens"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRole, useSlice } from "@/store"
import { shellActions } from "../data/actions"
import { ALERT_CATALOG, ROLE_LANDING, DEFAULT_LANDING, type Notification, type Severity } from "../data/seed"
import { crumbsFor } from "../lib/crumbs"
import { RESULT_KINDS, buildCorpus, didYouMean, runSearch, type ResultKind, type SearchResult } from "../lib/search"
import { PeriodStatusBanner, StateStage } from "../kit"
import { Panel } from "../kit"

// ====================================================================================== navigation
const TOP: { name: string; children: string[]; reading?: boolean }[] = [
  { name: "Home / Dashboards", children: ["Executive", "Inventory", "Finance", "Production", "Quality", "Sales"] },
  { name: "Sales", children: ["Leads & Opportunities", "Customers", "Quotations", "Sales Orders", "Backorders", "Deliveries & Shipments", "Delivery Cockpit", "Packing", "RMA / Returns", "Spares Finder", "Sales Reports"] },
  { name: "Engineering", children: ["Engineering Items", "Engineering BOMs", "CAD Documents", "Change Requests (ECR)", "Change Orders (ECO)", "Production Versions", "Where-Used", "Engineering Reports"] },
  { name: "Materials", children: ["Material Master", "Creation Requests (MCR)", "Change Requests (MCH)", "Supersessions", "Info Records", "Source Lists", "Account Determination", "E&O Reserve", "Data Quality"] },
  { name: "Production", children: ["Production Dashboard", "MRP Workbench", "Planned Orders", "Production Orders", "Dispatch List", "Shop Floor Terminal", "Work Centers", "Routings", "Rework Orders", "WIP Report", "Production Reports"] },
  { name: "Quality", children: ["Quality Dashboard", "Inspection Plans", "Incoming / In-Process / Final / Pre-Shipment", "Stock Hold & Release", "NCR", "CAPA", "SCAR", "Deviations & Waivers", "Calibration", "Recall Campaigns", "CoC"] },
  { name: "Inventory", children: ["As built per INV V3.0 navigation, unchanged"] },
  { name: "Purchasing", children: ["Vendors", "Approved Vendor Lists", "Purchase Requisitions", "RFQs", "Purchase Orders", "Long-Lead Releases", "Expedite Board", "Vendor Performance"] },
  { name: "Costing & Pricing", children: ["Cost Estimates", "Costing Runs", "Work Center Rates", "Price Lists", "Customer Price Agreements", "Commodity Surcharges", "Margin Analysis"] },
  { name: "Controlling", children: ["Cost Centers", "Profit Centers", "Hierarchies", "Allocation Cycles", "Reports"] },
  { name: "Approvals", children: ["Inbox", "Mobile approval", "Analytics"], reading: true },
  { name: "Configuration", children: ["Core configuration", "Workflows", "Alert rules", "Periods", "Tax"], reading: true },
]

export function NavigationPage() {
  const s = useSlice("shell")
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<string | null>("Sales")
  const [path, setPath] = useState("/sales/orders/SO-2026-00377")
  const entity = LEGAL_ENTITIES.find((e) => e.id === s.entityId)
  const periods = FISCAL_PERIODS.filter((p) => p.entityId === s.entityId)
  const cur = periods.find((p) => p.status === "Soft Close") ?? periods[0]
  const trail = crumbsFor(path)
  return (
    <DetailPage
      header={{ title: "App shell, sidebar, entity selector and breadcrumbs", screenId: "FX-SHL-NAV", description: "The frame around every screen: 12 top-level modules with children, the entity selector, collapse and responsive behaviour, and breadcrumbs." }}
      tabs={[
        {
          id: "sidebar",
          label: "Sidebar",
          content: (
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
              <nav aria-label="Sidebar model" className={cn("flex flex-col gap-1 rounded-lg border p-2 transition-all", collapsed ? "w-14" : "w-72")}>
                <Button variant="ghost" size="sm" className="self-end" aria-pressed={collapsed} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                  {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
                </Button>
                <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
                  {TOP.map((t, i) => (
                    <li key={t.name}>
                      <button title={t.name} aria-expanded={open === t.name} onClick={() => setOpen(open === t.name ? null : t.name)} className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent", open === t.name && "bg-secondary font-semibold")}>
                        <span className="tabular w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                        {!collapsed && <span className="truncate">{t.name}</span>}
                      </button>
                      {!collapsed && open === t.name && (
                        <ul className="ml-7 flex flex-col py-1 text-xs text-muted-foreground">
                          {t.children.map((c) => (
                            <li key={c} className="py-0.5">
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex max-w-2xl flex-col gap-4 text-sm">
                <p>
                  The sidebar holds 12 top-level modules. Ten come from the specification's navigation table (Book V section 3.1); <strong>Approvals</strong> and <strong>Configuration</strong> are readings so the count matches the feature list. <Chip kind="oq" id="nav-12">Two modules are a reading</Chip>
                </p>
                <ul className="list-disc pl-4">
                  <li>256 px open, 48 px collapsed with icons and tooltips and a visible focus ring.</li>
                  <li>Under 768 px the sidebar becomes a drawer opened from the menu button in the context bar.</li>
                  <li>The running app's sidebar is generated from the screen registry; this page is its specification.</li>
                </ul>
                <p>
                  Use the real sidebar at the left, or <Link to="/coverage" className="text-link underline">the coverage page</Link>, to see every screen.
                </p>
              </div>
            </div>
          ),
        },
        {
          id: "entity",
          label: "Entity selector",
          content: (
            <div className="grid max-w-3xl gap-4">
              <Panel title="Entity selector">
                <p className="text-sm">Every screen carries the entity selector (ACC section 2). It sits in the context bar at the top of the app; the same control is here.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="entity-demo">Entity</Label>
                  <select id="entity-demo" value={s.entityId} onChange={(e) => shellActions.setEntity(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                    {LEGAL_ENTITIES.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.id})
                      </option>
                    ))}
                  </select>
                </div>
                {entity && (
                  <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Country</dt>
                      <dd>{entity.country}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Currency</dt>
                      <dd>{entity.currency}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Role</dt>
                      <dd>{entity.role}</dd>
                    </div>
                  </dl>
                )}
                <p className="text-xs text-muted-foreground">One fiscal-period record per entity per month: the period shown below follows the selected entity.</p>
                {cur && <PeriodStatusBanner period={cur.month} status={cur.status} postingDate={cur.status === "Hard Close" ? `${cur.month}-28` : undefined} />}
                {cur && cur.status === "Open" && <p className="text-sm">Period {cur.month} is Open: no banner.</p>}
                <Chip kind="oq" id="entity-filter" note="The specification does not say which lists filter by entity">Which lists filter by entity: reading</Chip>
              </Panel>
            </div>
          ),
        },
        {
          id: "crumbs",
          label: "Breadcrumbs",
          content: (
            <div className="flex max-w-3xl flex-col gap-4">
              <p className="text-sm">Breadcrumbs come from the screen registry: home, section, PRD module, screen, then the record id. Try a path:</p>
              <select aria-label="Sample path" value={path} onChange={(e) => setPath(e.target.value)} className="h-9 max-w-md rounded-md border bg-background px-2 text-sm">
                {["/sales/orders/SO-2026-00377", "/production/orders/WO-TBD-0301", "/purchasing/orders/PO-TBD-0377", "/quality/final-test", "/dashboards/executive", "/components/diff-viewer"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <Breadcrumb>
                <BreadcrumbList>
                  {trail.map((c, i) => (
                    <span key={i} className="contents">
                      {i > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>{c.to && i < trail.length - 1 ? <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{c.label}</BreadcrumbPage>}</BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <p className="text-xs text-muted-foreground">The last crumb is the current page and is not a link; earlier crumbs that name a section or module are labels, not links, because they have no page of their own.</p>
            </div>
          ),
        },
        {
          id: "responsive",
          label: "Collapse and responsive",
          content: (
            <div className="max-w-3xl text-sm">
              <ul className="list-disc pl-4">
                <li>Desktop 1280 px and wider: sidebar open, content fluid with a 24 px gutter.</li>
                <li>Tablet: sidebar collapsed to icons; side panels open as a right sheet.</li>
                <li>Handhelds and kiosk: no navigation menu at all (floor-touch templates).</li>
              </ul>
              <Link to="/shell/devices" className="mt-2 inline-block text-link underline">
                Device previews
              </Link>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== search
const Mark = ({ text, q }: { text: string; q: string }) => {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-status-pending-tint px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get("q") ?? ""
  const [draft, setDraft] = useState(q)
  const [kind, setKind] = useState<ResultKind | "All">("All")
  const [busy, setBusy] = useState(false)
  const s = useSlice("shell")
  const nav = useNavigate()
  useEffect(() => setDraft(q), [q])
  useEffect(() => {
    if (!q) return
    setBusy(true)
    const t = setTimeout(() => setBusy(false), 250)
    return () => clearTimeout(t)
  }, [q])
  const corpus = useMemo(buildCorpus, [s])
  const results = useMemo(() => runSearch(corpus, q), [corpus, q])
  const counts = RESULT_KINDS.map((k) => ({ k, n: results.filter((r) => r.kind === k).length }))
  const shown = results.filter((r) => kind === "All" || r.kind === kind)
  const submit = (v: string) => {
    shellActions.addRecent(v)
    setParams(v ? { q: v } : {})
    setKind("All")
  }
  const suggestions = didYouMean(corpus, q)
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Search everywhere</h1>
          <span className="inline-flex h-6 items-center rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">FX-SHL-SEARCH</span>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">Materials (also by legacy code), documents, customers, vendors, serials and batches. Press Ctrl K anywhere for the quick finder; this page shows every result.</p>
        <form
          role="search"
          onSubmit={(e) => (e.preventDefault(), submit(draft))}
          className="flex max-w-2xl gap-2"
        >
          <label htmlFor="search-q" className="sr-only">
            Search
          </label>
          <Input id="search-q" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="An id, a name, a legacy code or a vendor batch" className="h-9" />
          <Button type="submit">
            <SearchIcon aria-hidden="true" /> Search
          </Button>
        </form>
      </header>
      <StateStage emptyTitle="No recent searches" emptyBody="Searches you run appear here so you can repeat them." actionLabel="search this entity" neededRoles={["Plant IT"]} stops="Serial and batch lookup; documents and masters still search" dependency="the search index" works="Id lookup on masters and documents" compact>
        {!q ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recent searches" actions={s.recentSearches.length > 0 && <Button variant="ghost" size="sm" onClick={() => shellActions.clearRecent()}>Clear</Button>}>
              {s.recentSearches.length === 0 ? (
                <EmptyState title="No recent searches" icon={History}>Searches you run appear here.</EmptyState>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {s.recentSearches.map((r) => (
                    <li key={r}>
                      <Button variant="outline" size="sm" onClick={() => submit(r)}>
                        <History aria-hidden="true" /> {r}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="What you can search">
              <ul className="list-disc pl-4 text-sm">
                <li>Material ids and the legacy code (try 10-4471)</li>
                <li>Document ids: SO-2026-00377, PO-TBD-0377, RCL-2026-001</li>
                <li>Customers and vendors by id or name</li>
                <li>Serials and batches: SN-TBD-20M-0301, BAT-TBD-B0301, vendor batch HP-26-0412</li>
              </ul>
            </Panel>
          </div>
        ) : busy ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-8 w-1/3" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex max-w-2xl flex-col gap-3">
            <EmptyState title={`No results for "${q}"`} icon={SearchIcon}>
              <p>Check the spelling, remove a word, or try the legacy code or the vendor batch number.</p>
            </EmptyState>
            {suggestions.length > 0 && (
              <p className="text-sm">
                Did you mean{" "}
                {suggestions.map((x) => (
                  <Button key={x} variant="link" className="h-auto p-0 pr-2" onClick={() => submit(x)}>
                    {x}
                  </Button>
                ))}
              </p>
            )}
            <Button variant="outline" className="self-start" onClick={() => submit("")}>
              Clear the search
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div role="tablist" aria-label="Result type" className="flex flex-wrap gap-1 border-b">
              {[{ k: "All" as const, n: results.length }, ...counts].map(({ k, n }) => (
                <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("h-8 border-b-2 px-3 text-sm", kind === k ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                  {k} <span className="tabular text-xs">{n}</span>
                </button>
              ))}
            </div>
            <ul aria-label="Results" className="flex flex-col">
              {shown.slice(0, 60).map((r: SearchResult) => (
                <li key={r.kind + r.id + r.route} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{r.kind}</span>
                  <Link to={r.route} className="font-mono text-link underline">
                    <Mark text={r.id} q={q} />
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    <Mark text={r.subtitle} q={q} />
                  </span>
                  {r.extra?.startsWith("legacy") && <Chip kind="design" note="Legacy code lookup uses a design-value map">{r.extra}</Chip>}
                  {r.status && <StatusBadge kind={r.status.kind} status={r.status.value} size="sm" />}
                </li>
              ))}
            </ul>
            {shown.length > 60 && <p className="text-xs text-muted-foreground">Showing 60 of {shown.length}. Narrow the query.</p>}
            <p className="text-xs text-muted-foreground">
              {results.length} results across {SPINE_DOCS.length} spine documents, masters and module records.{" "}
              <button className="text-link underline" onClick={() => nav("/home")}>
                Back to home
              </button>
            </p>
          </div>
        )}
      </StateStage>
    </div>
  )
}

// ====================================================================================== notifications
const SEV_FAMILY: Record<Severity, Family> = { Critical: "blocked", Warning: "exception", Info: "active" }
export function SeverityBadge({ s }: { s: Severity }) {
  return <FamilyBadge family={SEV_FAMILY[s]} label={s} size="sm" />
}
export function NotificationsPage() {
  const s = useSlice("shell")
  const [view, setView] = useState<"inbox" | "catalog" | "digest">("inbox")
  const [queue, setQueue] = useState("unread")
  const [active, setActive] = useState<Notification | null>(null)
  const all = s.notifications
  const live = all.filter((n) => !n.dismissed)
  const rows =
    queue === "unread" ? live.filter((n) => !n.read) : queue === "critical" ? live.filter((n) => n.severity === "Critical") : queue === "folded" ? live.filter((n) => n.folded > 1) : queue === "dismissed" ? all.filter((n) => n.dismissed) : live
  const folded = live.reduce((a, n) => a + Math.max(0, n.folded - 1), 0)
  const digestable = live.filter((n) => n.severity !== "Critical")
  const cols: Column<Notification>[] = [
    { id: "sev", header: "Severity", cell: (n) => <SeverityBadge s={n.severity} />, value: (n) => n.severity, sortable: true },
    { id: "title", header: "Notification", cell: (n) => <button className={cn("text-left text-link underline", !n.read && "font-semibold")} onClick={() => (setActive(n), shellActions.markRead([n.id], true))}>{n.title}</button>, value: (n) => n.title, sortable: true },
    { id: "rule", header: "W.2 rule", value: (n) => n.rule, filterable: true },
    { id: "src", header: "Source", value: (n) => n.source, filterable: true },
    { id: "folded", header: "Deduped", cell: (n) => (n.folded > 1 ? <span className="tabular">{n.folded} raises folded</span> : <span className="text-muted-foreground">single</span>), value: (n) => n.folded, align: "right", sortable: true },
    { id: "on", header: "Raised", value: (n) => n.on, sortable: true },
    { id: "read", header: "Read", cell: (n) => (n.read ? "Read" : <span className="font-semibold">Unread</span>), value: (n) => (n.read ? "Read" : "Unread") },
  ]
  if (view === "catalog")
    return (
      <div className="flex flex-col gap-4">
        <ViewSwitch view={view} setView={setView} />
        <Panel title="W.2 alert catalog: every alert named across the Books registers here">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-table-head text-left">
                <tr>
                  <th className="p-2">Rule</th>
                  <th className="p-2">Severity</th>
                  <th className="p-2">Trigger</th>
                  <th className="p-2">Recipients</th>
                  <th className="p-2">Dedupe window</th>
                  <th className="p-2">Digest</th>
                </tr>
              </thead>
              <tbody>
                {ALERT_CATALOG.map((a) => (
                  <tr key={a.rule} className="border-t align-top">
                    <td className="p-2 font-medium">
                      <Link to={a.screen} className="text-link underline">
                        {a.rule}
                      </Link>
                    </td>
                    <td className="p-2">
                      <SeverityBadge s={a.severity} />
                    </td>
                    <td className="p-2">{a.trigger}</td>
                    <td className="p-2">{a.recipients}</td>
                    <td className="p-2">{a.dedupe}</td>
                    <td className="p-2">{a.digest ? "Digest allowed" : "Immediate only"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Rule shape: event or scheduled condition, scope filter, severity, recipients, channels (in-app, email; SMS reserved) and a dedupe window. Severity names, dedupe windows and recipients here are design values (the PRD lists the rules, not their parameters). Rules are edited in <Link to="/configuration/alert-rules" className="text-link underline">Alert rules configuration</Link>.
          </p>
        </Panel>
      </div>
    )
  if (view === "digest")
    return (
      <div className="flex flex-col gap-4">
        <ViewSwitch view={view} setView={setView} />
        <Panel title={`Daily digest preview: ${digestable.length} non-critical items`}>
          <p className="text-sm">Non-critical severities can arrive as a digest (your preference: Warning {s.prefs.digest.Warning}, Info {s.prefs.digest.Info}). Critical always arrives immediately. <Link to="/profile" className="text-link underline">Change digest preferences</Link></p>
          <ul className="flex flex-col gap-2">
            {digestable.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
                <SeverityBadge s={n.severity} /> <Link to={n.link} className="text-link underline">{n.title}</Link>
                {n.folded > 1 && <span className="text-xs text-muted-foreground">({n.folded} raises folded into one line)</span>}
              </li>
            ))}
            {digestable.length === 0 && <li className="text-sm text-muted-foreground">Nothing to digest.</li>}
          </ul>
        </Panel>
      </div>
    )
  return (
    <div className="flex flex-col gap-4">
      <ViewSwitch view={view} setView={setView} />
      <StateStage emptyTitle="All clear" emptyBody="No notifications. Rules in the W.2 catalog raise them when a condition is met." actionLabel="manage alert rules" neededRoles={["Process owner"]} compact>
        <WorkbenchPage
          header={{
            title: "Notification center",
            screenId: "FX-SHL-NOTIF",
            description: "Severity, digest, dedupe and deep links. Every alert in the W.2 catalog lands here; repeated raises of one rule fold into one line.",
            primary: (
              <Button onClick={() => (shellActions.markRead(live.map((n) => n.id), true), toast.success("All marked read"))}>
                <Bell aria-hidden="true" /> Mark all read
              </Button>
            ),
          }}
          kpis={[
            { label: "Unread", value: live.filter((n) => !n.read).length },
            { label: "Critical", value: live.filter((n) => n.severity === "Critical").length, hint: "Always immediate" },
            { label: "Raises folded by dedupe", value: folded },
            { label: "Rules in the catalog", value: ALERT_CATALOG.length },
          ]}
          queues={[
            { id: "unread", label: "Unread", count: live.filter((n) => !n.read).length },
            { id: "all", label: "All", count: live.length },
            { id: "critical", label: "Critical", count: live.filter((n) => n.severity === "Critical").length },
            { id: "folded", label: "Folded duplicates", count: live.filter((n) => n.folded > 1).length },
            { id: "dismissed", label: "Dismissed", count: all.filter((n) => n.dismissed).length },
          ]}
          queue={queue}
          onQueueChange={setQueue}
          table={{ rows, columns: cols, rowId: (n) => n.id, searchText: (n) => `${n.title} ${n.rule} ${n.body}`, empty: { title: queue === "unread" ? "You are caught up" : "Nothing in this queue", body: "New alerts appear here as rules fire." } }}
          bulkActions={(ids, clear) => (
            <>
              <Button size="sm" variant="outline" onClick={() => (shellActions.markRead(ids, true), clear())}>
                Mark read
              </Button>
              <Button size="sm" variant="outline" onClick={() => (shellActions.markRead(ids, false), clear())}>
                Mark unread
              </Button>
              {queue === "dismissed" ? (
                <Button size="sm" variant="outline" onClick={() => (shellActions.restore(ids), clear())}>
                  Restore
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => (shellActions.dismiss(ids), clear())}>
                  Dismiss
                </Button>
              )}
            </>
          )}
          panel={{
            open: !!active,
            onOpenChange: (o) => !o && setActive(null),
            title: active?.title ?? "",
            description: active ? `${active.rule} · ${active.source} · ${active.on}` : undefined,
            content: active && (
              <div className="flex flex-col gap-3 text-sm">
                <SeverityBadge s={active.severity} />
                <p>{active.body}</p>
                {active.folded > 1 && <p className="text-xs text-muted-foreground">{active.folded} raises of this rule inside its dedupe window were folded into this one.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={active.link}>Open the source</Link>
                  </Button>
                  <Button variant="outline" onClick={() => (shellActions.dismiss([active.id]), setActive(null))}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ),
          }}
        />
      </StateStage>
    </div>
  )
}
function ViewSwitch({ view, setView }: { view: "inbox" | "catalog" | "digest"; setView: (v: "inbox" | "catalog" | "digest") => void }) {
  return (
    <div role="tablist" aria-label="Notification views" className="flex gap-1 self-start rounded-md border p-1 text-sm">
      {([["inbox", "Inbox"], ["digest", "Digest preview"], ["catalog", "Alert catalog (W.2)"]] as const).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("h-7 rounded-md px-3", view === k && "bg-secondary font-semibold")}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ====================================================================================== profile
const SCOPES = ["PO approval", "Long-lead release", "RMA approval", "Count variance", "All approvals up to the limit"]
export function ProfilePage() {
  const s = useSlice("shell")
  const [role] = useRole()
  const me = useMemo(() => USERS.find((u) => u.roles.includes(role)) ?? USERS[0], [role])
  const [section, setSection] = useState("delegation")
  const [f, setF] = useState({ delegate: "", from: "2026-10-12", to: "2026-10-23", limit: "100000", scope: SCOPES[0] })
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null)
  const limit = Number(f.limit)
  const over = !Number.isNaN(limit) && limit > 250_000
  const save = () => {
    const r = shellActions.addDelegation({ delegate: f.delegate, from: f.from, to: f.to, limit: Number.isNaN(limit) ? 0 : limit, scope: f.scope })
    if (!r.ok) return setErr({ field: r.field, msg: r.error })
    setErr(null)
    toast.success("Delegation saved and logged")
    setF({ ...f, delegate: "" })
  }
  const setAllDensity = (d: "compact" | "comfortable") => {
    shellActions.setPrefs({ density: d })
    try {
      localStorage.setItem("pe-proto-density:default", d)
      for (const sc of SCREENS) localStorage.setItem(`pe-proto-density:${sc.id}`, d)
    } catch {
      /* storage unavailable: preference lives in memory only */
    }
    toast.success(`Table density: ${d} rows`)
  }
  const landing = ROLE_LANDING[role] ?? DEFAULT_LANDING
  return (
    <ConfigPage
      header={{ title: "User profile and preferences", screenId: "FX-SHL-PROFILE", description: `${me.name}, acting as ${role}. Delegation with a date range, notification digest and table density.`, chips: <Chip kind="design">Profile fields are design values</Chip> }}
      sections={[{ id: "delegation", label: "Delegation" }, { id: "digest", label: "Notification digest" }, { id: "display", label: "Display" }, { id: "landing", label: "Landing page" }]}
      section={section}
      onSectionChange={setSection}
    >
      <StateStage emptyTitle="No delegation" emptyBody="You have not delegated any approvals." actionLabel="change this profile" neededRoles={["Plant IT"]} compact>
        {section === "delegation" && (
          <div className="flex max-w-3xl flex-col gap-4">
            <Panel title="Delegate my approvals while I am away">
              <p className="text-sm">A delegate acts for you between two dates; every action they take is logged as delegated (W.1).</p>
              <p role="note" className="rounded-md bg-muted p-2 text-sm">
                Standing delegation of financial approvals above $250,000 is prohibited (segregation-of-duties rule). Approvals above that limit stay with you.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="dlg-delegate">Delegate</Label>
                  <select id="dlg-delegate" value={f.delegate} onChange={(e) => setF({ ...f, delegate: e.target.value })} aria-invalid={err?.field === "delegate"} className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="">Choose a person</option>
                    {USERS.filter((u) => u.id !== me.id).map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}, {u.roles[0]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dlg-scope">Covers</Label>
                  <select id="dlg-scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm">
                    {SCOPES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dlg-from">From</Label>
                  <Input id="dlg-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-invalid={err?.field === "from"} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dlg-to">To</Label>
                  <Input id="dlg-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-invalid={err?.field === "to"} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dlg-limit">Largest approval the delegate may act on (USD)</Label>
                  <Input id="dlg-limit" inputMode="numeric" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} aria-invalid={over || err?.field === "limit"} />
                  {over && (
                    <p role="alert" className="text-xs text-destructive">
                      Standing delegation of financial approvals above $250,000 is prohibited. Lower the limit to $250,000 or less.
                    </p>
                  )}
                </div>
              </div>
              {err && !over && (
                <p role="alert" className="text-sm text-destructive">
                  {err.msg}
                </p>
              )}
              <Button className="self-start" onClick={save}>
                Save delegation
              </Button>
            </Panel>
            <Panel title="Active and planned delegations">
              {s.delegations.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {s.delegations.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{d.delegate}</strong> · {d.from} to {d.to} · up to ${d.limit.toLocaleString()} · {d.scope}
                      <Button size="sm" variant="outline" className="ml-auto" onClick={() => shellActions.revokeDelegation(d.id)}>
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
        {section === "digest" && (
          <Panel title="How I receive alerts" className="max-w-3xl">
            <p className="text-sm">Critical alerts are always immediate. Non-critical severities can arrive as a digest (W.2 alert-fatigue control).</p>
            {(["Critical", "Warning", "Info"] as const).map((sv) => (
              <div key={sv} className="flex flex-wrap items-center gap-2">
                <SeverityBadge s={sv} />
                <label htmlFor={`dig-${sv}`} className="sr-only">
                  Delivery for {sv}
                </label>
                <select id={`dig-${sv}`} value={s.prefs.digest[sv]} disabled={sv === "Critical"} onChange={(e) => shellActions.setPrefs({ digest: { ...s.prefs.digest, [sv]: e.target.value as typeof s.prefs.digest.Info } })} className="h-9 rounded-md border bg-background px-2 text-sm">
                  {(sv === "Critical" ? ["Immediate"] : ["Immediate", "Hourly digest", "Daily digest"]).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                {sv === "Critical" && <span className="text-xs text-muted-foreground">Cannot be digested</span>}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Switch id="ch-app" checked={s.prefs.channels.inApp} onCheckedChange={(v) => shellActions.setPrefs({ channels: { ...s.prefs.channels, inApp: v } })} />
              <Label htmlFor="ch-app">In-app</Label>
              <Switch id="ch-mail" checked={s.prefs.channels.email} onCheckedChange={(v) => shellActions.setPrefs({ channels: { ...s.prefs.channels, email: v } })} />
              <Label htmlFor="ch-mail">Email</Label>
              <Switch id="ch-sms" checked={false} disabled />
              <Label htmlFor="ch-sms">SMS (reserved)</Label>
            </div>
            <p className="text-xs text-muted-foreground">Digest cadences (hourly, daily) are design values.</p>
          </Panel>
        )}
        {section === "display" && (
          <Panel title="Table density" className="max-w-3xl">
            <p className="text-sm">Dense rows are 32 px and comfortable rows 40 px (Book IV section 7.7). Applies to every table; each table also keeps its own toggle.</p>
            <div role="radiogroup" aria-label="Table density" className="inline-flex gap-1 rounded-md border p-1 text-sm">
              {(["compact", "comfortable"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={s.prefs.density === d} onClick={() => setAllDensity(d)} className={cn("h-8 rounded-md px-3", s.prefs.density === d && "bg-secondary font-semibold")}>
                  {d === "compact" ? "Dense, 32 px" : "Comfortable, 40 px"}
                </button>
              ))}
            </div>
          </Panel>
        )}
        {section === "landing" && (
          <Panel title="Landing page" className="max-w-3xl">
            <p className="text-sm">
              As <strong>{role}</strong> you land on <Link to={landing.route} className="text-link underline">{landing.label}</Link>. The mapping for every role is on <Link to="/home" className="text-link underline">the home page</Link>.
            </p>
            <div role="radiogroup" aria-label="Landing choice" className="inline-flex gap-1 rounded-md border p-1 text-sm">
              {(["role", "last"] as const).map((d) => (
                <button key={d} role="radio" aria-checked={s.prefs.landing === d} onClick={() => shellActions.setPrefs({ landing: d })} className={cn("h-8 rounded-md px-3", s.prefs.landing === d && "bg-secondary font-semibold")}>
                  {d === "role" ? "My role's landing page" : "Where I left off"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Roles in the specification: {Object.values(ROLE_GROUPS).flat().length}. Role groups are listed in the acting-role menu.</p>
          </Panel>
        )}
      </StateStage>
    </ConfigPage>
  )
}
