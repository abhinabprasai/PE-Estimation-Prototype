// FX-FND-TOKENS, FX-FND-ARCH, FX-FND-STATES, FX-FND-ARCHETYPES: the foundation gallery pages.
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { DetailPage } from "@/components/templates"
import { Chip, FamilyBadge, FamilyLegend } from "@/components/patterns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FAMILIES, FAMILY_LABEL, STATUS } from "@/data/domain"
import { ARCHETYPES, SCREENS, type Archetype } from "@/data/screens"
import { cn } from "@/lib/utils"
import { ArchivedBanner, ArchiveQueryLoading, DegradedBanner, LegalHoldControl, OfflineBanner, PeriodStatusBanner, ReadOnlyBanner, SCREEN_STATES, StateStage, AuthorizationError, ConflictDiff, ValidationSummary } from "../kit"
import { Panel } from "../kit"

// ====================================================================================== tokens
const SWATCHES: [string, string, string][] = [
  ["Primary (PE Blue)", "bg-primary text-primary-foreground", "Entity context bar, primary action, active step"],
  ["Secondary (PE Light)", "bg-secondary text-secondary-foreground", "Selected row, segmented control"],
  ["Muted", "bg-muted text-muted-foreground", "Quiet panels, notes"],
  ["Table head (PE Mid)", "bg-table-head text-foreground", "Table header row"],
  ["Destructive", "bg-destructive text-destructive-foreground", "Errors, destructive confirm"],
  ["Card", "bg-card text-card-foreground border", "Cards and dialogs"],
]
const STATUS_TOKENS: [string, string, string, string][] = [
  ["Draft (F1)", "bg-status-draft", "text-status-draft-ink", "bg-status-draft-tint"],
  ["Pending approval (F2)", "bg-status-pending", "text-status-pending-ink", "bg-status-pending-tint"],
  ["Active or in progress (F3)", "bg-status-active", "text-status-active-ink", "bg-status-active-tint"],
  ["Blocked or on hold (F4)", "bg-status-blocked", "text-status-blocked-ink", "bg-muted"],
  ["Done (F5)", "bg-status-done", "text-status-done-ink", "bg-muted"],
  ["Cancelled or rejected (F6)", "bg-status-cancelled", "text-status-cancelled-ink", "bg-muted"],
  ["Exception (F7)", "bg-status-exception", "text-status-exception-ink", "bg-muted"],
  ["Passed (test result)", "bg-status-passed", "text-status-passed-ink", "bg-status-passed-tint"],
]
const TYPE_SCALE: [string, string, string][] = [
  ["Page", "text-2xl font-semibold", "24 / 32, 600: page title, one per page"],
  ["Title", "text-xl font-semibold", "20 / 28, 600: detail header record name"],
  ["Title small", "text-lg font-semibold", "18 / 28, 600: card titles"],
  ["Body large", "text-base", "16 / 24: dialog body; the kiosk base size"],
  ["Body", "text-sm", "14 / 20: forms, comfortable tables"],
  ["Body dense", "text-[13px]", "13 / 20: dense tables"],
  ["Caption", "text-xs", "12 / 16: helper text, timestamps"],
]
const SPACING = [1, 2, 3, 4, 6, 8, 12, 16]
export const DEVICES: { id: string; name: string; size: string; w: number; h: number; mode: string; note: string; source: string }[] = [
  { id: "desktop", name: "Desktop office", size: "1280 px and wider", w: 1280, h: 800, mode: "office-dense or office-comfortable", note: "Sidebar 256 px; content gutter 24 px; Detail form column capped at 960 px", source: "layout.md section 5" },
  { id: "tablet", name: "Tablet", size: "768 to 1279 px", w: 768, h: 1024, mode: "office-comfortable", note: "Sidebar collapses to icons; side panels become a right Sheet, never a third fixed column", source: "Design value" },
  { id: "tc77", name: "Zebra TC77, 4.7 in", size: "about 360 x 640 CSS px", w: 360, h: 640, mode: "floor-touch, single column", note: "Mobile work queue for warehouse moves, counting and putaway; IP67; runs the responsive web app", source: "[DOC:p.238 §8.2]" },
  { id: "wt6300", name: "Zebra WT6300 wrist, about 3.2 in", size: "about 240 x 320 CSS px", w: 240, h: 320, mode: "floor-touch, one action per screen", note: "Ring scanner RS5100, glove-friendly, no keyboard; wrist-terminal support is an open decision", source: "[DOC:p.238 §8.2] + feature list" },
  { id: "kiosk", name: "Kiosk, 15.6 in", size: "1280 x 800 fixed", w: 1280, h: 800, mode: "floor-touch, light theme only", note: "64 px header; bottom action bar with 64 px primary and 48 px secondary; no navigation menu", source: "[DOC:p.234 §7.6]" },
]

export function TokensPage() {
  const [d, setD] = useState<"dense" | "comfortable" | "floor">("dense")
  const h = d === "dense" ? "h-8 text-[13px]" : d === "comfortable" ? "h-10 text-sm" : "h-14 text-base"
  return (
    <DetailPage
      header={{ title: "Design tokens and responsive breakpoints", screenId: "FX-FND-TOKENS", description: "The measurements and colours every screen is built from. Provisional: the user's design language replaces index.css and nothing else changes.", chips: <Chip kind="design">Provisional tokens</Chip> }}
      tabs={[
        {
          id: "colour",
          label: "Colour",
          content: (
            <div className="flex flex-col gap-6">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SWATCHES.map(([n, c, u]) => (
                  <li key={n} className={cn("rounded-lg p-4 text-sm", c)}>
                    <p className="font-semibold">{n}</p>
                    <p className="text-xs">{u}</p>
                  </li>
                ))}
              </ul>
              <Panel title="Status colours: hue, ink and tint">
                <ul className="grid gap-2 md:grid-cols-2">
                  {STATUS_TOKENS.map(([n, hue, ink, tint]) => (
                    <li key={n} className="flex items-center gap-2 text-sm">
                      <span className={cn("size-6 rounded-md border", hue)} aria-hidden="true" />
                      <span className={cn("size-6 rounded-md border", tint)} aria-hidden="true" />
                      <span className={cn("font-semibold", ink)}>Aa</span>
                      {n}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Colour never carries meaning alone: every status is an icon plus a word (C-2). Seven families F1 to F7 are tentative (OQ-18).</p>
                <FamilyLegend />
              </Panel>
            </div>
          ),
        },
        {
          id: "type",
          label: "Type and spacing",
          content: (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Type scale (Inter, 13 to 14 px office; 16 px kiosk)">
                {TYPE_SCALE.map(([n, cls, note]) => (
                  <div key={n} className="border-b py-1">
                    <p className={cls}>{n}: Transformer order SO-2026-00377</p>
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                ))}
                <Chip kind="design" note="The PRD names Inter 13-14 px and 16 px kiosk; the font actually loaded is the shadcn default">Font file is provisional</Chip>
              </Panel>
              <Panel title="Spacing, 8 px grid (T-1) and radius (T-2)">
                <ul className="flex flex-col gap-1">
                  {SPACING.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      <span className="tabular w-16 font-mono text-xs">step {s}</span>
                      <span className="h-3 rounded-sm bg-primary" style={{ width: s * 4 }} />
                      <span className="tabular text-xs text-muted-foreground">{s * 4} px</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="flex h-10 w-20 items-center justify-center rounded-lg border">6 px</span>
                  <span className="flex h-10 w-20 items-center justify-center rounded-md border">4 px</span>
                  <span className="flex h-10 w-20 items-center justify-center rounded-full border">pill</span>
                </div>
              </Panel>
            </div>
          ),
        },
        {
          id: "density",
          label: "Density",
          content: (
            <Panel title="Three density modes (tokens.md section 5)">
              <div role="radiogroup" aria-label="Density" className="inline-flex gap-1 rounded-md border p-1 text-xs">
                {(["dense", "comfortable", "floor"] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={d === m} onClick={() => setD(m)} className={cn("h-6 rounded-md px-2", d === m && "bg-secondary font-semibold")}>
                    {m === "dense" ? "Office dense, 32 px rows" : m === "comfortable" ? "Office comfortable, 40 px rows" : "Floor touch, 56 px rows"}
                  </button>
                ))}
              </div>
              <table className="w-full">
                <thead className="bg-table-head text-left text-sm">
                  <tr>
                    <th className="px-2">Item</th>
                    <th className="px-2">Description</th>
                    <th className="px-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {["RAW-TBD-CRGO23|CRGO steel 0.23 mm|54,000", "RAW-TBD-OLTC|Tap changer|3", "RAW-TBD-BSH145|HV bushing 145 kV|9", "RAW-TBD-RAD|Radiator bank|30"].map((r) => {
                    const [a, b, c] = r.split("|")
                    return (
                      <tr key={a} className={cn("border-t", h)}>
                        <td className="px-2 font-mono">{a}</td>
                        <td className="px-2">{b}</td>
                        <td className="tabular px-2 text-right">{c}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">A kiosk table at 40 px rows is a violation. Controls: 32 px dense, 36 px comfortable, 48 px floor, 64 px for a scan primary.</p>
            </Panel>
          ),
        },
        {
          id: "breakpoints",
          label: "Breakpoints",
          content: (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-table-head text-left">
                    <tr>
                      <th className="p-2">Device class</th>
                      <th className="p-2">Viewport</th>
                      <th className="p-2">Density</th>
                      <th className="p-2">Layout</th>
                      <th className="p-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEVICES.map((x) => (
                      <tr key={x.id} className="border-t align-top">
                        <td className="p-2 font-medium">{x.name}</td>
                        <td className="p-2">{x.size}</td>
                        <td className="p-2">{x.mode}</td>
                        <td className="p-2">{x.note}</td>
                        <td className="p-2 text-xs text-muted-foreground">{x.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm">
                Previews of each device class: <Link to="/shell/devices" className="text-link underline">Responsive and device breakpoints</Link>. Pixel sizes for the handhelds are readings (OQ pending); the 1280 x 800 kiosk and the 4.7 in and 3.2 in diagonals are from the PRD.
              </p>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== archetype map
const TEMPLATE: Record<Archetype, string> = { List: "ListPage", Detail: "DetailPage", Workbench: "WorkbenchPage", Wizard: "WizardPage", Kiosk: "KioskPage + ScanField", Dashboard: "DashboardPage", Config: "ConfigPage", Dialog: "DialogShell" }
const DENSITY: Record<Archetype, string> = { List: "office-dense (switchable)", Detail: "office-comfortable; line tables dense", Workbench: "office-dense (switchable)", Wizard: "office-comfortable", Kiosk: "floor-touch, always", Dashboard: "office-comfortable", Config: "office-dense", Dialog: "inherits" }
const DECISIONS: [string, string, string, string][] = [
  ["DEC-01", "Scheduling at go-live", "Resolved. Book III Part E controls: finite-capacity buckets, batch resources, freeze horizons and CTP with soft capacity reservation. Drag rescheduling Phase 2; solver Phase 3.", "Go-live"],
  ["DEC-02", "Actual costing", "Standard costing at go-live and Phase 2. Periodic actual costing and material ledger is a Phase 3 decision gate; per-order and per-batch actuals are captured now.", "Phase 3 gate"],
  ["DEC-03", "Product configuration", "Structured ETO attributes, template designs and Copy From variant authoring. Configurable 150% BOMs, option rules and routings are Phase 3.", "Phase 3"],
  ["DEC-04", "Carrier and TMS", "Manual carrier selection, PRO/BOL capture, freight accrual #26 and POD capture. Carrier API (IF-21) is Phase 3. Freight claims are in scope.", "Phase 3"],
  ["DEC-05", "Supplier and customer electronic integration", "Phase 2: supplier EDI 850/855/856/810 for top-volume vendors. Phase 3: supplier and customer portals. Phase 1 works without these channels.", "Phase 2 and 3"],
  ["DEC-06", "Field service and installed base", "Installed-base record and warranty entitlement are in at go-live because RMA adjudication depends on them. Field service execution is out until a Phase 3 decision.", "Phase 3"],
  ["DEC-07", "Multi-plant and global first delivery", "One manufacturing plant and four legal entities at go-live; intercompany flow FL-07 live. Plant-2 activation needs a signed steering decision plus the FL-04/FL-07/FL-08 multi-plant test packs.", "On steering decision"],
  ["DEC-08", "Machine and test-equipment integration", "Phase 1 manual capture with instrument-ID binding and calibration interlock. Phase 2 CSV import from test sets. Phase 3 direct interfaces (IF-20).", "Phase 2 and 3"],
  ["DEC-09", "Quality maturity", "Phase 2: SPC and audit management. Control plans, FMEA, APQP and PPAP only where a customer contract demands them. Deviation and waiver control is in at go-live.", "Phase 2"],
  ["DEC-10", "Application architecture", "Modular monolith with enforced bounded contexts, one relational database with schema per context, log-based event broker with transactional outbox. Approved through the ADR set.", "Go-live"],
]
export function ArchetypeMapPage() {
  const [sel, setSel] = useState<Archetype>("List")
  const [q, setQ] = useState("")
  const [src, setSrc] = useState<"all" | "prd" | "feature-list">("all")
  const counts = useMemo(() => ARCHETYPES.map((a) => ({ a, prd: SCREENS.filter((s) => s.archetype === a && (s.source ?? "prd") === "prd").length, fx: SCREENS.filter((s) => s.archetype === a && s.source === "feature-list").length })), [])
  const list = SCREENS.filter((s) => s.archetype === sel && (src === "all" || (s.source ?? "prd") === src) && `${s.id} ${s.title}`.toLowerCase().includes(q.toLowerCase()))
  const total = SCREENS.length
  return (
    <DetailPage
      header={{ title: "Archetype map and traceability", screenId: "FX-FND-ARCH", description: `The eight archetypes mapped to the ${total} registered screens: 84 from the PRD screen plan and the rest from the feature list. Counts are computed from the registry.` }}
      tabs={[
        {
          id: "map",
          label: "Map",
          content: (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-table-head text-left">
                    <tr>
                      <th className="p-2">Archetype</th>
                      <th className="p-2">Template</th>
                      <th className="p-2">Density</th>
                      <th className="p-2 text-right">PRD screens</th>
                      <th className="p-2 text-right">Feature-list screens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map(({ a, prd, fx }) => (
                      <tr key={a} className={cn("border-t", sel === a && "bg-secondary")}>
                        <td className="p-2">
                          <button className="font-medium text-link underline" onClick={() => setSel(a)}>
                            {a}
                          </button>
                        </td>
                        <td className="p-2 font-mono text-xs">{TEMPLATE[a]}</td>
                        <td className="p-2">{DENSITY[a]}</td>
                        <td className="tabular p-2 text-right">{prd}</td>
                        <td className="tabular p-2 text-right">{fx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                The PRD sizes the archetypes as List about 18 screens, Detail about 20, Workbench about 12, with Wizard, Kiosk, Dashboard (six landing pages), Config and Dialog beside them (Book VIII). The registry counts differ because a "List + detail" pair is counted once under the archetype the entry names first.
              </p>
              <Panel title={`${sel}: screens mapped`} actions={<span className="tabular text-xs">{list.length} shown</span>}>
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Filter screens" placeholder="Filter by id or title" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs" />
                  <div role="radiogroup" aria-label="Source" className="inline-flex gap-1 rounded-md border p-1 text-xs">
                    {(["all", "prd", "feature-list"] as const).map((s) => (
                      <button key={s} role="radio" aria-checked={src === s} onClick={() => setSrc(s)} className={cn("h-6 rounded-md px-2", src === s && "bg-secondary font-semibold")}>
                        {s === "all" ? "All" : s === "prd" ? "PRD" : "Feature list"}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="grid max-h-96 gap-1 overflow-y-auto md:grid-cols-2">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-baseline gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                      <Link to={s.route.replace(/\/:[^/]+.*$/, "")} className="text-link underline">
                        {s.title}
                      </Link>
                      <span className="ml-auto text-xs text-muted-foreground">{s.wave}</span>
                    </li>
                  ))}
                  {list.length === 0 && <li className="text-sm text-muted-foreground">No screens match.</li>}
                </ul>
              </Panel>
            </div>
          ),
        },
        {
          id: "dec",
          label: "Decisions DEC-01..10",
          content: (
            <div className="flex flex-col gap-3 text-sm">
              <p className="max-w-3xl">The scope decision register (Book IV section 1.2) is the controlling scope baseline. Changing any row is a steering-committee change-control action, not an editorial one. Each row below is shown as recorded in the PRD; the prototype follows them as written.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-table-head text-left">
                    <tr>
                      <th className="p-2">ID</th>
                      <th className="p-2">Decision</th>
                      <th className="p-2">Go-live commitment and phase trigger</th>
                      <th className="p-2">Trigger</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DECISIONS.map(([id, name, outcome, trig]) => (
                      <tr key={id} className="border-t align-top">
                        <td className="p-2 font-mono text-xs">{id}</td>
                        <td className="p-2 font-medium">{name}</td>
                        <td className="p-2">{outcome}</td>
                        <td className="p-2">{trig}</td>
                        <td className="p-2">Confirmed</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          id: "trace",
          label: "Traceability",
          content: (
            <div className="max-w-3xl text-sm">
              <p>Every screen id keeps one chain from the specification to the build: requirement, Book VI entry, screen id, route, archetype, template, flows, postings and scans. The coverage page lists the chain per screen and its built state.</p>
              <ol className="mt-2 list-decimal pl-4">
                <li>Book VI entry or feature-list row names the screen id.</li>
                <li>The registry entry gives the route, archetype, wave and flows.</li>
                <li>The archetype fixes the template, density and the nine states.</li>
                <li>The module claims the route and the built state.</li>
              </ol>
              <h3 className="mt-4 font-semibold">Naming conventions</h3>
              <dl className="mt-1 grid gap-x-4 gap-y-1 md:grid-cols-[14rem_1fr]">
                <dt className="font-medium">Requirement ID</dt>
                <dd className="font-mono text-xs">REQ-{"{VOL}"}-{"{SECTION}"}-{"{SEQ}"} (Book III, requirements traceability). Parsed mechanically from field tables, validation codes, posting rules, status transitions, buttons, interfaces and NFRs.</dd>
                <dt className="font-medium">RTM row</dt>
                <dd>Requirement, design or build ticket, test case ID(s), latest result, defects, acceptance status. A row without a test case is a visible gap; the target is zero at M7 exit.</dd>
                <dt className="font-medium">Test case ID</dt>
                <dd className="font-mono text-xs">Ranges reserved per flow, plus TC-MM-, TC-VAL-, TC-CAD-, TC-SEC-, TC-OPS-. IDs stay stable across runs.</dd>
                <dt className="font-medium">Frame ID</dt>
                <dd className="font-mono text-xs">{"{SCREEN-ID} / {view} / {state}"}, for example OM-SO-002 / detail / conflict (Book V section 10.4). One page per screen, one frame per state, so RTM linkage is mechanical.</dd>
                <dt className="font-medium">Handoff rule</dt>
                <dd>Every frame links its spec section in the description. A frame without a spec link fails design review at DG-2.</dd>
                <dt className="font-medium">States per screen</dt>
                <dd>Nine: normal, empty, loading, validation error, authorization error, conflict, offline, degraded, read-only.</dd>
              </dl>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/coverage">Open the coverage page</Link>
              </Button>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== state kit
const SAMPLE_ROWS = [
  ["SO-2026-00377", "Midland Plains Grid Constructors", "In Fulfillment", "$3,852,000"],
  ["SO-2026-00301", "Midland Plains Grid Constructors", "Shipped", "$1,284,000"],
  ["SO-2026-00402", "Prairie Ridge Electric Cooperative", "Confirmed", "$78,400"],
]
function SampleTable() {
  return (
    <table className="w-full text-sm">
      <thead className="bg-table-head text-left">
        <tr>
          <th className="p-2">Order</th>
          <th className="p-2">Customer</th>
          <th className="p-2">Status</th>
          <th className="p-2 text-right">Value</th>
        </tr>
      </thead>
      <tbody>
        {SAMPLE_ROWS.map((r) => (
          <tr key={r[0]} className="h-8 border-t">
            <td className="p-2 font-mono">{r[0]}</td>
            <td className="p-2">{r[1]}</td>
            <td className="p-2">{r[2]}</td>
            <td className="tabular p-2 text-right">{r[3]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
export function StateKitPage() {
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState(false)
  return (
    <DetailPage
      header={{ title: "Nine mandatory states and legal hold", screenId: "FX-FND-STATES", description: "Every screen ships with all nine states (Book V section 10.3). The kit builds each once; module screens adopt it with StateStage and the banners below.", chips: <Chip kind="design">Shared kit</Chip> }}
      tabs={[
        {
          id: "nine",
          label: "Nine states",
          content: (
            <div className="flex flex-col gap-4">
              <StateStage emptyTitle="No orders yet" emptyBody="Create the first sales order or convert a won quotation." emptyAction={<Button size="sm">New sales order</Button>} actionLabel="release this order" neededRoles={["Finance (credit)"]}>
                <SampleTable />
              </StateStage>
              <ul className="grid gap-2 text-sm md:grid-cols-3">
                {SCREEN_STATES.map((s, i) => (
                  <li key={s.id} className="rounded-md border p-2">
                    <span className="tabular mr-1 font-mono text-xs">{i + 1}</span>
                    <strong>{s.label}</strong>
                    <p className="text-xs text-muted-foreground">{s.rule}</p>
                  </li>
                ))}
              </ul>
            </div>
          ),
        },
        {
          id: "individual",
          label: "Parts",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Validation: inline and summary">
                <ValidationSummary errors={[{ field: "Ship-to", message: "Choose a ship-to address." }, { field: "Quantity", message: "Enter a whole number above 0." }]} />
              </Panel>
              <Panel title="Authorization error">
                <AuthorizationError role="Sales rep" action="release a Credit Hold" needed={["Finance (credit)"]} />
              </Panel>
              <Panel title="Conflict">
                <ConflictDiff fields={[{ field: "Requested delivery date", mine: "2027-03-22", theirs: "2027-03-15" }]} />
              </Panel>
              <Panel title="Offline, degraded and read-only banners">
                <OfflineBanner queued={7} />
                <DegradedBanner dependency="the label printer queue" works="Packing, weighing, HU close; reprint is queued" stops="Printing the HU label until the ZT411 answers" />
                <ReadOnlyBanner reason="This sales order is Invoiced/Closed. Terminal statuses open read-only (C-55)." />
              </Panel>
            </div>
          ),
        },
        {
          id: "hold",
          label: "Legal hold and archive",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Legal hold chip with set and release dialog">
                <p className="text-sm">A legal hold suspends any purge on one object. Setting and releasing both need a reason, written to the audit trail.</p>
                <div className="flex flex-col gap-2">
                  <LegalHoldControl object="batch:BAT-TBD-B0301" objectLabel="Batch BAT-TBD-B0301" />
                  <LegalHoldControl object="serial:SN-TBD-20M-0301" objectLabel="Serial SN-TBD-20M-0301" />
                  <LegalHoldControl object="quality:NCR-TBD-0044" objectLabel="NCR-TBD-0044" readOnly />
                </div>
                <p className="text-xs text-muted-foreground">The third object is view-only: the control is disabled, the chip stays visible.</p>
              </Panel>
              <Panel title="Archived record: read-only banner">
                <ArchivedBanner archivedOn="2019-12-31" />
                <fieldset disabled className="contents">
                  <SampleTable />
                </fieldset>
              </Panel>
              <Panel title="Archive query loading (under 60 s)">
                {!q ? (
                  <Button variant="outline" className="self-start" onClick={() => (setQ(true), setLoaded(false))}>
                    Query the archive for 2019 sales orders
                  </Button>
                ) : loaded ? (
                  <p role="status" className="text-sm">14,206 archived orders found. Results open read-only.</p>
                ) : (
                  <ArchiveQueryLoading onDone={() => setLoaded(true)} onCancel={() => setQ(false)} />
                )}
                <p className="text-xs text-muted-foreground">The demo clock runs 12 times faster than real time.</p>
              </Panel>
            </div>
          ),
        },
        {
          id: "period",
          label: "Period banner",
          content: (
            <div className="flex max-w-3xl flex-col gap-4">
              <p className="text-sm">Shown on any screen that posts. Open: no banner. Soft Close: warns, never blocks (C-42). Hard Close and Year-End Closed: block everyone, offer Reference Date (C-41). Master data screens show none (C-44).</p>
              <PeriodStatusBanner period="2026-10" status="Open" />
              <p className="text-xs text-muted-foreground">Period 2026-10 is Open: no banner.</p>
              <PeriodStatusBanner period="2026-09" status="Soft Close" />
              <PeriodStatusBanner period="2026-08" status="Hard Close" postingDate="2026-08-28" />
              <PeriodStatusBanner period="2025-12" status="Year-End Closed" postingDate="2025-12-30" />
              <PeriodStatusBanner period="2026-09" status="Soft Close" masterData />
              <p className="text-xs text-muted-foreground">Last: a master data screen in a Soft Close period shows nothing.</p>
              <p className="text-sm">
                Statuses are the S-41 words: {STATUS.fiscalPeriod.statuses.join(", ")}.
              </p>
            </div>
          ),
        },
        {
          id: "adopt",
          label: "Adopt it",
          content: (
            <div className="max-w-3xl text-sm">
              <p>No module screen currently has the offline, degraded and authorization-error states. Adopt them in one line each:</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{`import { StateStage, PeriodStatusBanner, LegalHoldControl } from "@/modules/shell/kit"

<StateStage emptyTitle="No orders" actionLabel="release a hold" neededRoles={["Finance (credit)"]}>
  {normal body}
</StateStage>`}</pre>
              <p className="mt-2">
                <FamilyBadge family="draft" label="State preview" size="sm" /> is a prototype affordance for reviewers; a product screen shows the one state it is in.
              </p>
              <p className="mt-2">Which roles may act on a screen is not in the specification (ASM-PERM-1), so a screen names the role in its authorization error as a reading.</p>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== archetypes as component sets
const ANATOMY: Record<Archetype, { parts: string[]; states: string; examples: string[] }> = {
  List: { parts: ["Page header with one filled primary", "Filter and search bar", "Dense table with sort, selection and density toggle", "Row action menu", "Pager or virtual scroll"], states: "Empty with a create action; no-match with a clear-filters action", examples: ["OM-QT-001/2", "PUR-PO-001/2", "MM-MAT-001"] },
  Detail: { parts: ["Entity context bar", "Status badge and lifecycle strip", "Summary facts", "Tabs (views)", "Right column: document flow, audit trail, attachments"], states: "Terminal statuses open read-only; conflict shows the diff", examples: ["OM-SO-001/2", "ENG-REQ-001", "QM-FIN-001"] },
  Workbench: { parts: ["KPI strip", "Queue tabs with counts", "Selectable table with bulk-action bar", "Right Sheet for the active row", "Exception cards with SLA aging"], states: "Empty queue says what cleared it", examples: ["WF-INBOX", "OM-BO-001", "PP-MRP-001"] },
  Wizard: { parts: ["Stepper", "Per-step validation", "Simulation step: per-row checks and effect summary", "Finish names its consequence first"], states: "Nothing posts until Finish; a banner says so", examples: ["MBOM-TRF", "PP-SETTLE-001", "MM-EOR-001"] },
  Kiosk: { parts: ["64 px header: operator, station, online", "Scan field, always focused", "One task at a time", "Bottom action bar: 64 px primary, 48 px secondary"], states: "Offline banner with queue depth; scan failure banner with E-code", examples: ["PP-SFT-001", "OM-PACK-*", "RMA-RECEIPT"] },
  Dashboard: { parts: ["KPI tiles with sparkline and as-of chip", "Worklist cards", "Charts with a data table behind each", "Drill to source in 3 clicks or fewer"], states: "Loading, empty and degraded per widget", examples: ["QM-DASH-001", "TRC-DASH", "FX-HOME-LANDING"] },
  Config: { parts: ["Section navigation", "Effective-dated tables", "Changes create a new dated version (C-50)", "Approval for released configuration"], states: "Read-only for roles without edit rights", examples: ["CFG-CORE", "WF-DEF", "BC-ADMIN"] },
  Dialog: { parts: ["Names the object", "States the consequence", "Reason field where the specification requires one", "One filled primary"], states: "Validation inline; confirm disabled until valid", examples: ["CTP-DLG", "PRC-SIM", "FX-CMP-TAX"] },
}
export function ArchetypesPage() {
  const [a, setA] = useState<Archetype>("List")
  const x = ANATOMY[a]
  return (
    <DetailPage
      header={{ title: "Eight archetypes as component sets", screenId: "FX-FND-ARCHETYPES", description: "List, Detail with views, Workbench, Wizard with simulation, Kiosk, Dashboard, Governed Config and Decision Dialog. Each is one template in the build." }}
      tabs={[
        {
          id: "sets",
          label: "Component sets",
          content: (
            <div className="flex flex-col gap-4">
              <div role="tablist" aria-label="Archetype" className="flex flex-wrap gap-1 border-b">
                {ARCHETYPES.map((k) => (
                  <button key={k} role="tab" aria-selected={a === k} onClick={() => setA(k)} className={cn("h-8 border-b-2 px-3 text-sm", a === k ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={`${a}: anatomy`} actions={<span className="font-mono text-xs">{TEMPLATE[a]}</span>}>
                  <ol className="list-decimal pl-4 text-sm">
                    {x.parts.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ol>
                  <p className="text-sm">
                    <strong>Density:</strong> {DENSITY[a]}
                  </p>
                  <p className="text-sm">
                    <strong>States:</strong> {x.states}
                  </p>
                  <p className="text-sm">
                    <strong>Example screens:</strong> {x.examples.join(", ")}
                  </p>
                  <Link to="/dev/templates" className="text-sm text-link underline">
                    Live template examples
                  </Link>
                </Panel>
                <Panel title={`${a}: wireframe`}>
                  <Wireframe a={a} />
                </Panel>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
function Wireframe({ a }: { a: Archetype }) {
  const bar = (w: string, k?: string) => <div className={cn("h-3 rounded-sm bg-muted", w, k)} />
  const header = (
    <div className="flex items-center gap-2 border-b pb-2">
      {bar("w-1/3")}
      <div className="ml-auto h-6 w-16 rounded-md bg-primary" />
    </div>
  )
  const rows = (n: number) => Array.from({ length: n }).map((_, i) => <div key={i} className="flex gap-2 border-t py-1">{bar("w-1/5")}{bar("w-2/5")}{bar("w-1/6")}</div>)
  return (
    <div role="img" aria-label={`${a} wireframe`} className="flex flex-col gap-2 rounded-md border p-3">
      {header}
      {a === "List" && (
        <>
          <div className="flex gap-2">{bar("w-1/4")}{bar("w-1/6")}</div>
          <div className="h-5 bg-table-head" />
          {rows(5)}
        </>
      )}
      {a === "Detail" && (
        <>
          <div className="h-4 w-2/3 rounded-sm bg-secondary" />
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <div className="flex flex-col gap-1">{bar("w-full")}{bar("w-5/6")}{bar("w-2/3")}{rows(3)}</div>
            <div className="flex flex-col gap-1 rounded-md border p-1">{bar("w-full")}{bar("w-2/3")}</div>
          </div>
        </>
      )}
      {a === "Workbench" && (
        <>
          <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-8 rounded-md border" />)}</div>
          <div className="flex gap-1">{bar("w-12")}{bar("w-12")}{bar("w-12")}</div>
          {rows(4)}
        </>
      )}
      {a === "Wizard" && (
        <>
          <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <div key={i} className={cn("h-6 w-16 rounded-md border", i === 2 && "border-primary")} />)}</div>
          <div className="h-20 rounded-md border" />
          <div className="h-5 rounded-md bg-muted" />
        </>
      )}
      {a === "Kiosk" && (
        <>
          <div className="h-8 rounded-md bg-primary" />
          <div className="h-10 rounded-md border" />
          <div className="h-14 rounded-md border" />
          <div className="flex gap-2"><div className="h-10 flex-1 rounded-md bg-primary" /><div className="h-8 w-20 rounded-md border" /></div>
        </>
      )}
      {a === "Dashboard" && (
        <>
          <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md border" />)}</div>
          <div className="grid grid-cols-2 gap-1"><div className="h-20 rounded-md border" /><div className="h-20 rounded-md border" /></div>
        </>
      )}
      {a === "Config" && (
        <div className="grid grid-cols-[1fr_3fr] gap-2">
          <div className="flex flex-col gap-1">{bar("w-full")}{bar("w-full")}{bar("w-full")}</div>
          <div>{rows(4)}</div>
        </div>
      )}
      {a === "Dialog" && (
        <div className="mx-auto flex w-3/4 flex-col gap-2 rounded-md border p-2 shadow-lg">
          {bar("w-1/2")}
          {bar("w-full")}
          <div className="h-5 rounded-md bg-muted" />
          <div className="flex justify-end gap-1"><div className="h-5 w-12 rounded-md border" /><div className="h-5 w-12 rounded-md bg-primary" /></div>
        </div>
      )}
    </div>
  )
}
export { FAMILIES, FAMILY_LABEL }
