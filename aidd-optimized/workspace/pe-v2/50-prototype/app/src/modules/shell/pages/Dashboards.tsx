// FX-HOME-LANDING and the four role dashboards. Figures are seeded design values chosen to agree with
// the hero thread (SO-2026-00377 line 10 at risk, batch BAT-TBD-B0301 blocked, period 2026-09 Soft Close).
// Every tile and chart reaches its source in three clicks or fewer.
import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import { Chip, FamilyBadge, StatusBadge } from "@/components/patterns"
import { DashboardCard, DashboardPage } from "@/components/templates"
import { ALL_ROLES, STATUS, routeApproval } from "@/data/domain"
import { CUSTOMERS, FISCAL_PERIODS, TODAY, WORK_CENTERS, defaultUserFor } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCore, useRole, useSlice } from "@/store"
import { ExceptionCard, Funnel, Gauge, KpiTile, Pareto, StateStage, TrendChart, VizFrame, WaterfallChart, type VizState } from "../kit"
import { ROLE_LANDING, DEFAULT_LANDING } from "../data/seed"
import { Panel } from "../kit"

function VizSwitch({ v, set }: { v: VizState; set: (v: VizState) => void }) {
  return (
    <div role="radiogroup" aria-label="Widget state" className="inline-flex gap-1 rounded-md border p-1 text-xs">
      <Chip kind="design" note="Prototype affordance: widgets show their loading, empty and degraded states">Widgets</Chip>
      {(["normal", "loading", "empty", "degraded"] as VizState[]).map((s) => (
        <button key={s} role="radio" aria-checked={v === s} onClick={() => set(s)} className={cn("h-6 rounded-md px-2 capitalize", v === s && "bg-secondary font-semibold")}>
          {s}
        </button>
      ))}
    </div>
  )
}
function Dash({ id, title, description, tiles, children }: { id: string; title: string; description: string; tiles: ReactNode; children: (v: VizState) => ReactNode }) {
  const [v, setV] = useState<VizState>("normal")
  return (
    <StateStage emptyTitle="No data yet" emptyBody="The dashboard fills once orders and postings exist." actionLabel="open this dashboard" neededRoles={["Executive"]} compact>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{title}</h1>
            <span className="inline-flex h-6 items-center rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">{id}</span>
            <Chip kind="design" note="Figures are seeded design values, consistent with the hero thread">Seeded figures</Chip>
            <div className="ml-auto">
              <VizSwitch v={v} set={setV} />
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        </header>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">{tiles}</dl>
        <div className="grid gap-4 lg:grid-cols-2">{children(v)}</div>
      </div>
    </StateStage>
  )
}
export { DashboardPage, DashboardCard }

// ====================================================================================== landing
export function HomePage() {
  const [role] = useRole()
  const core = useCore()
  const sh = useSlice("shell")
  const me = defaultUserFor(role)
  const land = ROLE_LANDING[role] ?? DEFAULT_LANDING
  const mine = core.approvals.filter((a) => !a.outcome && a.steps.some((s) => !s.decided && s.role === role))
  const open = core.approvals.filter((a) => !a.outcome)
  const unread = sh.notifications.filter((n) => !n.dismissed && !n.read)
  const [q, setQ] = useState("")
  const groups = Array.from(new Set(ALL_ROLES.map((r) => (ROLE_LANDING[r] ?? DEFAULT_LANDING).label)))
  return (
    <div className="flex flex-col gap-6">
      <DashboardPage
        header={{
          title: `Good day, ${me.name.split(" ")[0]}`,
          screenId: "FX-HOME-LANDING",
          description: `Acting as ${role}. Today is ${fmtDate(TODAY)}. Your landing page is ${land.label}.`,
          chips: <Chip kind="design" note="The PRD gives no role-to-page table">Role mapping is a reading</Chip>,
          primary: (
            <Link to={land.route} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Open {land.label}
            </Link>
          ),
        }}
        tiles={[
          { label: "Waiting for my role", value: mine.length, hint: "Approvals inbox", to: "/approvals", tone: mine.length ? "attention" : "default" },
          { label: "Open approvals, all roles", value: open.length, to: "/approvals" },
          { label: "Unread notifications", value: unread.length, to: "/notifications", tone: unread.some((n) => n.severity === "Critical") ? "attention" : "default" },
          { label: "Critical alerts", value: unread.filter((n) => n.severity === "Critical").length, to: "/notifications" },
        ]}
      >
        <DashboardCard title="My approvals" action={<Link to="/approvals" className="text-xs text-link underline">Open inbox</Link>}>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waits for {role}. Switch the acting role to see another queue.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {mine.slice(0, 5).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-mono text-xs">{a.id}</span> {a.title}
                  <span className="ml-1 text-xs text-muted-foreground">{a.kind}{a.amount ? ` · $${a.amount.toLocaleString()}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
        <DashboardCard title="Latest notifications" action={<Link to="/notifications" className="text-xs text-link underline">All</Link>}>
          <ul className="flex flex-col gap-2">
            {sh.notifications.filter((n) => !n.dismissed).slice(0, 4).map((n) => (
              <li key={n.id} className="text-sm">
                <Link to={n.link} className="text-link underline">
                  {n.title}
                </Link>
                <span className="ml-1 text-xs text-muted-foreground">{n.severity}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard title="Dashboards">
          <ul className="grid gap-1 text-sm">
            {[["/dashboards/executive", "Executive"], ["/dashboards/sales", "Sales"], ["/dashboards/production", "Production"], ["/dashboards/inventory", "Inventory"], ["/quality/dashboard", "Quality"], ["/materials/data-quality", "Data quality"]].map(([to, l]) => (
              <li key={to}>
                <Link to={to} className="text-link underline">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard title="Regression baseline">
          <p className="text-sm">The sales-order-to-delivery flow (FL-09) stays reachable: the open quotation QT-TBD-0412-V2.</p>
          <Link to="/sales/quotations/QT-TBD-0412-V2" className="text-sm text-link underline">
            Open quotation QT-TBD-0412-V2
          </Link>
        </DashboardCard>
      </DashboardPage>
      <Panel title={`Role to landing page mapping (${ALL_ROLES.length} roles)`}>
        <p className="text-sm text-muted-foreground">Where each role lands after sign-in. {groups.length} different pages. Your row is marked.</p>
        <input aria-label="Filter roles" placeholder="Filter by role or page" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs rounded-md border bg-background px-2 text-sm" />
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-table-head text-left">
              <tr>
                <th className="p-2">Role</th>
                <th className="p-2">Lands on</th>
                <th className="p-2">Screen</th>
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.filter((r) => `${r} ${(ROLE_LANDING[r] ?? DEFAULT_LANDING).label}`.toLowerCase().includes(q.toLowerCase())).map((r) => {
                const l = ROLE_LANDING[r] ?? DEFAULT_LANDING
                return (
                  <tr key={r} className={cn("border-t", r === role && "bg-secondary")}>
                    <td className="p-2">
                      {r}
                      {r === role && <span className="ml-1 text-xs font-semibold">(you)</span>}
                    </td>
                    <td className="p-2">
                      <Link to={l.route} className="text-link underline">
                        {l.label}
                      </Link>
                    </td>
                    <td className="p-2 font-mono text-xs">{l.screen}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Six landing pages are named in Book VIII (Executive, Inventory, Finance, Production, Quality, Sales). Finance has no screen of its own here because accounting screens are outside this build; Finance roles land on the closest queue.</p>
      </Panel>
    </div>
  )
}

// ====================================================================================== executive
const PCS = [
  { pc: "PC-100 Distribution Transformers", margin: 24.1, floor: 22 },
  { pc: "PC-200 Power Transformers", margin: 21.8, floor: undefined },
  { pc: "PC-300 Grid Components", margin: 19.2, floor: 18 },
  { pc: "PC-400 Service and Repair", margin: 31.5, floor: undefined },
]
export function ExecutiveDashboardPage() {
  const core = useCore()
  const per = FISCAL_PERIODS.find((p) => p.entityId === "LE-TBD-10" && p.status === "Soft Close")
  const items = [
    ["Inventory close run: pre-close validation", true],
    ["Draft GRNs cleared", false],
    ["Open counts closed", true],
    ["Unsettled production orders", false],
    ["Intercompany reconciliation", true],
    ["Warranty reserve accrual (#24)", true],
    ["E&O reserve run", true],
  ] as const
  return (
    <Dash
      id="FX-DASH-EXEC"
      title="Executive dashboard"
      description="Bookings, billings and backlog, on-time delivery, margin, WIP, quality and close status. Every figure drills to its source in three clicks or fewer."
      tiles={
        <>
          <KpiTile label="Bookings, month to date" value="$3.9M" delta="+$1.1M on September" data={[1.8, 2.2, 2.9, 3.1, 3.9]} asOf="Oct 9" to="/sales/orders" />
          <KpiTile label="Billings, month to date" value="$2.1M" delta="2 milestone invoices pending" data={[0.9, 1.2, 1.5, 1.9, 2.1]} asOf="Oct 9" to="/sales/billing-plan" />
          <KpiTile label="Backlog" value="$14.2M" delta="+4.1%" data={[10.4, 11.2, 11.9, 12.5, 13.8, 14.2]} asOf="Oct 9" to="/sales/orders" />
          <KpiTile label="On-time delivery" value="91%" delta="-2 pts, target 95%" good={false} data={[96, 95, 94, 93, 92, 91]} asOf="Oct 9" to="/production/at-risk" />
        </>
      }
    >
      {(v) => (
        <>
          <VizFrame title="Backlog and bookings, last 6 months ($M)" state={v} onExport={() => {}} table={{ head: ["Month", "Backlog", "Bookings"], rows: [["May", 10.4, 2.1], ["Jun", 11.2, 3.5], ["Jul", 11.9, 2.4], ["Aug", 12.5, 2.9], ["Sep", 13.8, 3.2], ["Oct MTD", 14.2, 3.9]] }} drill={[{ label: "Executive", to: "/dashboards/executive" }, { label: "Sales orders", to: "/sales/orders" }, { label: "SO-2026-00377", to: "/sales/orders/SO-2026-00377" }]}>
            <TrendChart series={[{ label: "Backlog", points: [10.4, 11.2, 11.9, 12.5, 13.8, 14.2] }, { label: "Bookings", points: [2.1, 3.5, 2.4, 2.9, 3.2, 3.9] }]} unit="M" />
          </VizFrame>
          <VizFrame title="Gross margin by profit center" state={v} restated="September restated after a standard-cost update" table={{ head: ["Profit center", "Margin %", "Floor %"], rows: PCS.map((p) => [p.pc, p.margin, p.floor ?? "none"]) }} drill={[{ label: "Executive", to: "/dashboards/executive" }, { label: "Margin analysis", to: "/pricing/margin" }, { label: "Margin floors", to: "/pricing/margin-floors" }]}>
            <ul className="flex flex-col gap-2">
              {PCS.map((p) => (
                <li key={p.pc} className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center justify-between">
                    {p.pc}
                    <span className="tabular font-semibold">{p.margin}%</span>
                  </span>
                  <span className="h-2 rounded-sm bg-muted">
                    <span className="block h-2 rounded-sm bg-status-active" style={{ width: `${Math.min(100, p.margin * 2.5)}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground">{p.floor ? `Floor ${p.floor}%: ${p.margin >= p.floor ? "above" : "below"} (${(p.margin - p.floor).toFixed(1)} pts)` : "No floor in the PRD for this profit center"}</span>
                </li>
              ))}
            </ul>
          </VizFrame>
          <VizFrame title="Work in progress ($M)" state={v} table={{ head: ["Step", "$M"], rows: [["Opening WIP", 6.1], ["Issues", 2.4], ["Labor and overhead", 1.1], ["Completions", -2.8], ["Closing WIP", 6.8]] }} drill={[{ label: "Executive", to: "/dashboards/executive" }, { label: "WIP report", to: "/production/wip" }, { label: "Production orders", to: "/production/orders" }]}>
            <WaterfallChart steps={[{ label: "Open", value: 6.1, total: true }, { label: "Issues", value: 2.4 }, { label: "Labor", value: 1.1 }, { label: "Complete", value: -2.8 }, { label: "Close", value: 6.8, total: true }]} />
          </VizFrame>
          <VizFrame title="Quality" state={v} drill={[{ label: "Executive", to: "/dashboards/executive" }, { label: "Quality dashboard", to: "/quality/dashboard" }, { label: "NCR-TBD-0044", to: "/quality/capa" }]}>
            <div className="grid grid-cols-2 gap-4">
              <Gauge value={92} target={95} label="First-pass yield" />
              <div className="flex flex-col justify-center gap-1 text-sm">
                <p>
                  <span className="tabular text-2xl font-semibold">3</span> open NCRs
                </p>
                <p>
                  <span className="tabular text-2xl font-semibold">1</span> recall in <StatusBadge kind="recall" status="Contain" size="sm" />
                </p>
                <Link to="/quality/recalls" className="text-xs text-link underline">
                  RCL-2026-001
                </Link>
              </div>
            </div>
          </VizFrame>
          <DashboardCard title={`Close status: period ${per?.month ?? "2026-09"}`} className="lg:col-span-2">
            <p className="flex items-center gap-2 text-sm">
              <StatusBadge kind="fiscalPeriod" status={per?.status ?? "Soft Close"} size="sm" /> {items.filter((i) => i[1]).length} of {items.length} checklist items done. Two blockers keep the period from Hard Close.
            </p>
            <ul className="grid gap-1 md:grid-cols-2">
              {items.map(([l, done]) => (
                <li key={l} className="flex items-center gap-2 text-sm">
                  <FamilyBadge family={done ? "done" : "blocked"} label={done ? "Done" : "Blocker"} size="sm" /> {l}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Hard Close is set by the Controller after the checklist is green. {core.approvals.filter((a) => !a.outcome).length} approvals are open across the company. <Link to="/configuration/periods" className="text-link underline">Period configuration</Link></p>
          </DashboardCard>
        </>
      )}
    </Dash>
  )
}

// ====================================================================================== sales
export function SalesDashboardPage() {
  const holds = CUSTOMERS.filter((c) => c.holdFlag || c.status === "On Hold" || c.status === "Blocked")
  return (
    <Dash
      id="FX-DASH-SALES"
      title="Sales dashboard"
      description="Open order book, at-risk lines, quote funnel and credit holds."
      tiles={
        <>
          <KpiTile label="Open order book" value="$9.6M" delta="14 open orders" data={[7.2, 7.9, 8.4, 9.1, 9.6]} asOf="Oct 9" to="/sales/orders" />
          <KpiTile label="At-risk lines" value="3" delta="1 promise cannot be met" good={false} asOf="Oct 9" to="/production/at-risk" />
          <KpiTile label="Quotes issued, open" value="9" delta="3 expire within 7 days" asOf="Oct 9" to="/sales/quotations" />
          <KpiTile label="Credit holds" value={String(holds.length)} delta="customers on hold, blocked or flagged" good={false} asOf="Oct 9" to="/sales/customers" />
        </>
      }
    >
      {(v) => (
        <>
          <VizFrame title="Quote funnel (quotation statuses)" state={v} table={{ head: ["Status", "Count"], rows: [["Draft", 18], ["Internal Review", 11], ["Issued", 9], ["Won", 6]] }} drill={[{ label: "Sales dashboard", to: "/dashboards/sales" }, { label: "Quotations", to: "/sales/quotations" }, { label: "QT-TBD-0412-V2", to: "/sales/quotations/QT-TBD-0412-V2" }]}>
            <Funnel stages={[{ label: STATUS.quotation.main[0], value: 18 }, { label: STATUS.quotation.main[1], value: 11 }, { label: STATUS.quotation.main[2], value: 9 }, { label: STATUS.quotation.main[3], value: 6 }]} />
          </VizFrame>
          <VizFrame title="Open order book by status ($M)" state={v} drill={[{ label: "Sales dashboard", to: "/dashboards/sales" }, { label: "Sales orders", to: "/sales/orders" }, { label: "SO-2026-00377", to: "/sales/orders/SO-2026-00377" }]} table={{ head: ["Status", "$M"], rows: [["Confirmed", 2.4], ["In Fulfillment", 5.1], ["Partially Shipped", 1.3], ["Credit Hold", 0.8]] }}>
            <Pareto data={[{ label: "In Fulf.", value: 5.1 }, { label: "Confirmed", value: 2.4 }, { label: "Part. Ship", value: 1.3 }, { label: "Cr. Hold", value: 0.8 }]} />
          </VizFrame>
          <ExceptionCard title="At-risk lines" code="AT-RISK" count={3} bands={[{ label: "0 to 2 d", count: 1, tone: "fresh" }, { label: "3 to 5 d", count: 1, tone: "aging" }, { label: "over 5 d", count: 1, tone: "breach" }]} owner="Sales admin" action="Open at-risk promises" to="/production/at-risk" pills={[{ label: "SO-2026-00377 line 10", value: "bushings blocked" }]} />
          <DashboardCard title="Credit holds and blocks">
            <ul className="flex flex-col gap-2">
              {holds.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/sales/customers/${c.id}`} className="text-link underline">
                    {c.name}
                  </Link>
                  <StatusBadge kind="customer" status={c.status} size="sm" />
                  {c.holdFlag && <Chip kind="hold" />}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Finance, not Sales, releases a Credit Hold (C-12).</p>
          </DashboardCard>
        </>
      )}
    </Dash>
  )
}

// ====================================================================================== production
const LOAD = [["WC-050", 72], ["WC-100", 88], ["WC-110", 64], ["WC-200", 94], ["WC-210", 108], ["WC-220", 71], ["WC-230", 96], ["WC-300", 58], ["WC-310", 49], ["WC-320", 77], ["WC-400", 91], ["WC-500", 83], ["WC-600", 0], ["WC-700", 45]] as const
export function ProductionDashboardPage() {
  const counts = [["Created", 6], ["Released", 9], ["In Progress", 12], ["Testing", 3], ["Completed", 4], ["On Hold", 2]] as const
  return (
    <Dash
      id="FX-DASH-PROD"
      title="Production dashboard"
      description="Order status, late orders, work-center load, scrap and WIP aging."
      tiles={
        <>
          <KpiTile label="Orders in progress" value="12" delta="36 open in all" asOf="Oct 9" to="/production/orders" />
          <KpiTile label="Late orders" value="4" delta="1 held by recall" good={false} asOf="Oct 9" to="/production/at-risk" />
          <KpiTile label="Scrap, month to date" value="1.8%" delta="target under 2%" data={[2.4, 2.1, 1.9, 1.8]} asOf="Oct 9" to="/production/reports" />
          <KpiTile label="Unsettled over 5 days" value="2" delta="blocks close" good={false} asOf="Oct 9" to="/production/settlement" />
        </>
      }
    >
      {(v) => (
        <>
          <VizFrame title="Order status (production order statuses)" state={v} table={{ head: ["Status", "Orders"], rows: counts.map((c) => [c[0], c[1]]) }} drill={[{ label: "Production dashboard", to: "/dashboards/production" }, { label: "Production orders", to: "/production/orders" }, { label: "WO-TBD-0371-1", to: "/production/orders" }]}>
            <ul className="flex flex-col gap-1">
              {counts.map(([s, n]) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className="w-32"><StatusBadge kind="productionOrder" status={s} size="sm" /></span>
                  <span className="h-4 rounded-sm bg-status-active" style={{ width: `${n * 6}%` }} />
                  <span className="tabular">{n}</span>
                </li>
              ))}
            </ul>
          </VizFrame>
          <VizFrame title="Work-center load, next 5 days (% of finite capacity)" state={v} table={{ head: ["Work center", "Load %"], rows: LOAD.map((l) => [l[0], l[1]]) }} drill={[{ label: "Production dashboard", to: "/dashboards/production" }, { label: "Work-center load", to: "/production/work-center-load" }, { label: "Schedule board", to: "/production/schedule" }]}>
            <ul className="grid gap-1 md:grid-cols-2">
              {LOAD.map(([wc, l]) => {
                const w = WORK_CENTERS.find((x) => x.id === wc)!
                return (
                  <li key={wc} className="flex items-center gap-2 text-xs">
                    <span className="w-14 font-mono">{wc}</span>
                    <span className="h-3 flex-1 rounded-sm bg-muted">
                      <span className={cn("block h-3 rounded-sm", l > 100 ? "bg-status-blocked" : l > 85 ? "bg-status-pending" : "bg-status-active")} style={{ width: `${Math.min(100, l)}%` }} />
                    </span>
                    <span className="tabular w-24 text-right">{w.status === "Maintenance" ? "Maintenance" : `${l}%${l > 100 ? " over" : ""}`}</span>
                  </li>
                )
              })}
            </ul>
          </VizFrame>
          <VizFrame title="Scrap by cause" state={v} table={{ head: ["Cause", "Units"], rows: [["Winding damage", 5], ["Weld defect", 4], ["Paint", 2], ["Other", 1]] }} drill={[{ label: "Production dashboard", to: "/dashboards/production" }, { label: "Production reports", to: "/production/reports" }, { label: "Rework orders", to: "/production/rework" }]}>
            <Pareto data={[{ label: "Winding", value: 5 }, { label: "Weld", value: 4 }, { label: "Paint", value: 2 }, { label: "Other", value: 1 }]} />
          </VizFrame>
          <VizFrame title="WIP aging (days since last movement)" state={v} table={{ head: ["Age", "$M"], rows: [["0 to 5 d", 4.2], ["6 to 15 d", 1.9], ["16 to 30 d", 0.5], ["over 30 d", 0.2]] }} drill={[{ label: "Production dashboard", to: "/dashboards/production" }, { label: "WIP board", to: "/production/wip" }, { label: "Production orders", to: "/production/orders" }]}>
            <Funnel stages={[{ label: "0 to 5 d", value: 42 }, { label: "6 to 15 d", value: 19 }, { label: "16 to 30 d", value: 5 }, { label: "over 30 d", value: 2 }]} />
          </VizFrame>
        </>
      )}
    </Dash>
  )
}

// ====================================================================================== inventory
const BREACH = [
  { id: "RAW-TBD-CRGO23", name: "CRGO steel 0.23 mm", onHand: 41000, safety: 60000, unit: "KG", note: "PR-TBD-0377 approved; PO-TBD-0377 in approval" },
  { id: "RAW-TBD-BSH145", name: "HV bushing 145 kV", onHand: 0, safety: 6, unit: "EA", note: "6 in stock are Blocked by recall RCL-2026-001" },
  { id: "RAW-TBD-OLTC", name: "Tap changer, 17 positions", onHand: 1, safety: 2, unit: "EA", note: "LLR-2026-0011 waiting in the approvals inbox" },
]
export function InventoryDashboardPage() {
  const stock = [["Unrestricted", 72], ["QI Hold", 9], ["Blocked", 14], ["Quarantine", 5]] as const
  return (
    <Dash
      id="FX-DASH-INV"
      title="Inventory dashboard"
      description="Stock by status, open counts and receipts, with the safety-stock breach tile."
      tiles={
        <>
          <div className="flex flex-col rounded-lg border border-status-exception p-4">
            <dt className="text-sm text-muted-foreground">Safety-stock breaches</dt>
            <dd className="tabular text-3xl font-semibold">
              <Link to="/inventory/safety-stock" className="text-link underline-offset-4 hover:underline">
                {BREACH.length}
              </Link>
            </dd>
            <dd className="text-xs">items below safety stock <FamilyBadge family="exception" label="Attention" size="sm" /></dd>
          </div>
          <KpiTile label="Stock value" value="$23.6M" delta="+1.2% on September" data={[21.8, 22.4, 22.9, 23.3, 23.6]} asOf="Oct 9" to="/inventory/items" />
          <KpiTile label="Open count documents" value="3" delta="1 beyond SLA" good={false} asOf="Oct 9" to="/inventory/counts" />
          <KpiTile label="Draft GRNs" value="1" delta="blocks period close" good={false} asOf="Oct 9" to="/inventory/counts" />
        </>
      }
    >
      {(v) => (
        <>
          <DashboardCard title="Safety-stock breaches" className="lg:col-span-2">
            <table className="w-full text-sm">
              <thead className="bg-table-head text-left">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">On hand</th>
                  <th className="p-2 text-right">Safety stock</th>
                  <th className="p-2 text-right">Shortfall</th>
                  <th className="p-2">Why and what is moving</th>
                </tr>
              </thead>
              <tbody>
                {BREACH.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">
                      <Link to={`/inventory/items/${b.id}`} className="font-mono text-link underline">
                        {b.id}
                      </Link>
                      <div className="text-xs text-muted-foreground">{b.name}</div>
                    </td>
                    <td className="tabular p-2 text-right">{b.onHand.toLocaleString()} {b.unit}</td>
                    <td className="tabular p-2 text-right">{b.safety.toLocaleString()} {b.unit}</td>
                    <td className="tabular p-2 text-right font-semibold text-status-cancelled-ink">{(b.safety - b.onHand).toLocaleString()} {b.unit}</td>
                    <td className="p-2 text-xs">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">Breach means on hand plus confirmed inbound is below safety stock for the plant (Book I A §10.4). A change to a safety-stock level of more than {25}% needs the Planning Manager.{" "}
              <Link to="/inventory/safety-stock/exceptions" className="text-link underline">Safety-stock exception report</Link></p>
          </DashboardCard>
          <VizFrame title="Stock by status (units, thousands)" state={v} table={{ head: ["Status", "Share %"], rows: stock.map((s) => [s[0], s[1]]) }} drill={[{ label: "Inventory dashboard", to: "/dashboards/inventory" }, { label: "Stock status", to: "/quality/stock-status" }, { label: "BAT-TBD-B0301", to: "/inventory/batches" }]}>
            <ul className="flex flex-col gap-1">
              {stock.map(([s, n]) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className="w-32"><StatusBadge kind="stock" status={s} size="sm" /></span>
                  <span className="h-4 rounded-sm bg-status-active" style={{ width: `${n}%` }} />
                  <span className="tabular">{n}%</span>
                </li>
              ))}
            </ul>
          </VizFrame>
          <ExceptionCard title="Count and receipt exceptions" code="INV" count={4} bands={[{ label: "0 to 2 d", count: 2, tone: "fresh" }, { label: "3 days", count: 1, tone: "aging" }, { label: "over 5 d", count: 1, tone: "breach" }]} owner="Warehouse supervisor" action="Open counts" to="/inventory/counts" pills={[{ label: "Recount", value: "1" }]} />
        </>
      )}
    </Dash>
  )
}
export { routeApproval }
