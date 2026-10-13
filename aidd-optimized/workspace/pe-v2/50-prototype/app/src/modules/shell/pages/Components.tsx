// The bespoke component gallery pages, /components/*: one page per component with the component,
// its nine states and its usage. Every component lives in ../kit and is adopted by module screens.
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Chip, FamilyBadge, StatusBadge, LifecycleStrip } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STATUS, type RecordKind } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRole } from "@/store"
import {
  ApprovalStrip, AttachmentPanel, AuditTrail, BOARDS, CHARACTERISTICS, CompletenessBar, DIFF_SETS, DiffViewer, EntityContextBar, ExceptionCard, FINANCE_ROLES, GlPreview, KanbanBoard, KioskControlSet,
  MilestoneStrip, Panel, PriceWaterfall, READINESS_SAMPLE, ReadinessChips, RfqGrid, ScanFeedbackDemo, ScheduleGantt, SimulationPreview, TAX_LINES, TaxBadge, TaxOverrideDialog,
  TestCharacteristicRow, TreeExplorer, WATERFALL_DEFAULT, ConflictDiff, KpiTile, Pareto, TrendChart, Funnel, WaterfallChart, Gauge, VizFrame, stepsFor, type TaxLine, type VizState, type GlLine,
} from "../kit"
import { Gallery } from "./gallery"

// ====================================================================================== status and lifecycle
const KINDS = Object.keys(STATUS) as RecordKind[]
export function StatusLifecyclePage() {
  const [kind, setKind] = useState<RecordKind>("salesOrder")
  const def = STATUS[kind] as { ref: string; label: string; statuses: readonly string[]; main: readonly string[]; source: string }
  const [cur, setCur] = useState<string>(def.main[1] ?? def.statuses[0])
  const pick = (k: RecordKind) => {
    setKind(k)
    const d = STATUS[k] as { statuses: readonly string[]; main: readonly string[] }
    setCur(d.main[1] ?? d.statuses[0])
  }
  const idx = def.main.indexOf(cur)
  const dates = ["2026-09-02", "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02", "2026-10-07", "2026-10-09"]
  return (
    <Gallery
      id="FX-CMP-STATUS"
      title="Status badge and lifecycle strip"
      description={`Colours for every lifecycle in the status catalog (${KINDS.length} lists, S-1 to S-43) and the timeline strip variant. The feature list says 18 lifecycles; the catalog is the authority, so all ${KINDS.length} are shown.`}
      where="Every Detail header; lifecycle tables throughout; colours section 10.1 (Book V section 10.2)"
      source="[DOC:p.242 §10.2; p.241 §10.1]"
      rules={["Icon plus word on every badge; colour is never alone (C-2).", "A word not on the record's list renders an Unknown status badge, so a typo is visible (C-3).", "Family is chosen per record type and status pair, not per word (C-4).", "A record with no status list in the specification shows no badge: text plus an OQ chip (OQ-21).", "Terminal statuses open read-only (C-55)."]}
      adopted={[{ label: "Sales orders (every Detail header)", to: "/sales/orders" }, { label: "Production orders", to: "/production/orders" }, { label: "Purchase orders", to: "/purchasing/orders" }]}
      stage={{ compact: true }}
      preview={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs">
              Lifecycle
              <select value={kind} onChange={(e) => pick(e.target.value as RecordKind)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {(STATUS[k] as { ref: string }).ref} {(STATUS[k] as { label: string }).label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-muted-foreground">
              {def.ref} {def.source}
            </span>
          </div>
          <Panel title="Badges">
            <ul className="flex flex-wrap gap-2">
              {def.statuses.map((s) => (
                <li key={s}>
                  <button onClick={() => setCur(s)} aria-pressed={cur === s} className="rounded-lg" aria-label={`Show ${s} in the strip`}>
                    <StatusBadge kind={kind} status={s} />
                  </button>
                </li>
              ))}
              <li>
                <StatusBadge kind={kind} status="Not a status" />
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">The last badge is the deliberate violation: a word that is not on the list.</p>
          </Panel>
          <Panel title="Lifecycle strip">
            <LifecycleStrip kind={kind} status={cur} />
          </Panel>
          <Panel title="Timeline strip variant">
            <ol aria-label="Timeline" className="flex flex-wrap gap-2">
              {def.main.map((s, i) => (
                <li key={s} className={cn("flex min-w-28 flex-col rounded-md border p-2 text-xs", s === cur && "border-primary", idx >= 0 && i > idx && "text-muted-foreground")}>
                  <span className="font-semibold">{s}</span>
                  <span className="tabular">{idx >= 0 && i <= idx ? dates[i] : "not yet"}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      }
    />
  )
}

// ====================================================================================== context, audit, attachments
export function ContextAuditPage() {
  return (
    <Gallery
      id="FX-CMP-CONTEXT"
      title="Entity context bar, audit trail and attachments"
      description="The bar at the top of a record, the immutable Activity tab, and the attachment panel with checksum note and photo capture."
      where="Entity context bar on every screen; audit trail and attachment panel on every Detail (Book V section 10.2)"
      source="[DOC:p.242 §10.2; ACC section 2; Book I C §5]"
      rules={["The Activity tab is append-only: no edit and no delete control exists.", "Every action records user, timestamp, channel and comment.", "Each attachment carries a checksum recorded at upload; released document files are write-once.", "Photo capture is mandatory for transformers (four corner shots and the nameplate) on the packing screen."]}
      adopted={[{ label: "Sales order detail", to: "/sales/orders/SO-2026-00377" }, { label: "Controlled documents", to: "/engineering/documents" }]}
      preview={
        <div className="flex flex-col gap-4">
          <EntityContextBar entityId="LE-TBD-10" recordType="Sales order" recordId="SO-2026-00377" title="Omaha North phase 2" status={{ kind: "salesOrder", value: "In Fulfillment" }} owner="Dana Whitfield" />
          <div className="grid gap-4 lg:grid-cols-2">
            <AuditTrail />
            <AttachmentPanel />
          </div>
        </div>
      }
    />
  )
}

// ====================================================================================== readiness
export function ReadinessPage() {
  return (
    <Gallery
      id="FX-CMP-READY"
      title="Readiness chips"
      description="Supply, credit, quality and docs chips with a hover or click evidence popover, on the sales order, the delivery and the work-order release."
      where="Sales order, delivery, WO release (Book V section 10.2)"
      source="[DOC:p.242 §10.2; Book IV §2; Book I D §5.2]"
      rules={["Each chip is a word plus an icon: Ready, Partial, Blocked, Not checked (the four chip words are design values).", "The popover lists the evidence and links to the source document; it opens on click, Enter or hover.", "Readiness informs; it never replaces the gate that blocks (the credit gate at SP-18 still blocks the load)."]}
      adopted={[{ label: "Delivery cockpit", to: "/sales/deliveries" }, { label: "Production orders (release)", to: "/production/orders" }]}
      chips={<Chip kind="design">Chip words are design values</Chip>}
      preview={
        <div className="flex flex-col gap-4">
          {Object.entries(READINESS_SAMPLE).map(([k, items]) => (
            <Panel key={k} title={k}>
              <ReadinessChips items={items} />
            </Panel>
          ))}
        </div>
      }
    />
  )
}

// ====================================================================================== approval strip
export function ApprovalStripPage() {
  return (
    <Gallery
      id="FX-CMP-APPROVAL"
      title="Approval strip"
      description="The chain, the current step, the SLA clock, act buttons, delegation, parallel CCB votes, recall and reject-with-comment."
      where="Everything in W.4 (Book V section 10.2)"
      source="[DOC:p.242 §10.2; Section W W.1, W.4; Book IV §7.7]"
      rules={["Requests are raised with ApprovalButton, never from a module screen: the strip only shows and acts on a raised request (C-1).", "Delegation is a per-user delegate with a date range; standing delegation of financial approvals above $250,000 is prohibited (C-2).", "The initiator may recall before the first approval; a rejection returns with a mandatory comment; resubmission preserves history.", "SLA hours per step are configurable and a breach escalates to the role's manager: the 24 h shown is a design value.", "CCB votes are parallel; membership and quorum are not listed in the PRD (reading)."]}
      adopted={[{ label: "Approvals inbox", to: "/approvals" }, { label: "Purchase orders", to: "/purchasing/orders" }, { label: "Change requests (CCB)", to: "/engineering/change-requests" }]}
      chips={<Chip kind="design">SLA hours: design value</Chip>}
      stage={{ neededRoles: ["Purchasing Manager"], actionLabel: "approve this PO" }}
      preview={
        <div className="flex flex-col gap-4">
          <ApprovalStrip kind="PO approval" amount={207900} title="PO-TBD-0377 · $207,900 · Purchasing Manager band" />
          <ApprovalStrip kind="PO approval" amount={1_350_000} title="PO above $1M: delegation is barred" initial={stepsFor("PO approval", { amount: 1_350_000 }, 1)} />
          <ApprovalStrip kind="ECR (CCB)" amount={0} title="ECR with parallel CCB votes" parallel={{ label: "CCB votes", quorum: 2, members: ["Hiro Tanaka", "Grace Mwangi", "Patrick Doyle"] }} />
        </div>
      }
    />
  )
}

// ====================================================================================== price waterfall
export function PriceWaterfallPage() {
  return (
    <Gallery
      id="FX-CMP-WATERFALL"
      title="Price waterfall panel"
      description="Condition steps 10 to 50, the price-source badge, the margin-floor verdict and the hover waterfall."
      where="Quote and sales order lines; price simulation (Book V section 10.2)"
      source="[DOC:p.242 §10.2; Book I A §4.4; Book IV §5; p.122 §6.3]"
      rules={["Floors: PC-100 22%, PC-300 18%. Below the floor: Pricing Manager, then Sales Director; more than 5 points below adds the CFO (C-36).", "Below-floor entry shows the approval route and requires a justification.", "Freight and tax sit below the margin line: margin is on the net price against standard cost."]}
      adopted={[{ label: "Quotations", to: "/sales/quotations" }, { label: "Price simulation", to: "/pricing/simulate" }, { label: "Margin floors", to: "/pricing/margin-floors" }]}
      preview={
        <div className="flex flex-col gap-4">
          <PriceWaterfall />
          <PriceWaterfall initial={{ ...WATERFALL_DEFAULT, base: 112, qty: 400, stdCost: 64, discountPct: 24, surchargePct: 0, freight: 600, taxPct: 0, profitCenter: "PC-300", source: "Customer agreement" }} />
        </div>
      }
    />
  )
}

// ====================================================================================== scan feedback
export function ScanFeedbackPage() {
  return (
    <Gallery
      id="FX-CMP-SCAN"
      title="Scan input and feedback flash"
      description="The focus-locked scan field, the success flash, the E-code failure banner, the offline queue banner and the supervisor badge override."
      where="All kiosk and mobile screens (section 8.4)"
      source="[DOC:p.241 §8.4; Book I F §4]"
      rules={["The field owns input; a scan is an event, not keystrokes into a form field (ADR-10).", "Focus returns after a scan or a dismissed banner, never on blur (F-01). / brings it back.", "Success is a flash plus the word Scanned; failure is a red banner naming what was scanned, what was expected, the E-code and the next action.", "Offline: an amber banner with the queue depth; the queue holds up to 4 h.", "An override needs a supervisor badge scan and is logged."]}
      adopted={[{ label: "Shop floor terminal", to: "/production/terminal" }, { label: "Pack station", to: "/sales/packing" }, { label: "Return receipt", to: "/sales/rma/receipt" }]}
      noStates
      preview={
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Online">
            <ScanFeedbackDemo />
          </Panel>
          <Panel title="Offline: scans queue">
            <ScanFeedbackDemo offline />
          </Panel>
        </div>
      }
    />
  )
}

// ====================================================================================== tree
export function TreeExplorerPage() {
  return (
    <Gallery
      id="FX-CMP-TREE"
      title="Tree explorer: BOM, where-used, genealogy"
      description="Multi-level tree with level badges, status dots, forward and backward family-tree modes, node evidence and lazy-loaded levels."
      where="EBOM, traceability, where-used (section 9; Book I C §3)"
      source="[DOC:p.242 §10.2; section 9; Book I C §3.1]"
      rules={["Five levels load in under 10 s; the archive path may take up to 60 s with a progress state.", "Each node shows a dot and a word for its status, never colour alone.", "Evidence on a node names the traceability event (T01 to T13) it comes from."]}
      adopted={[{ label: "Where-used explorer", to: "/engineering/where-used" }, { label: "Trace explorer", to: "/traceability/explorer" }, { label: "EBOM editor", to: "/engineering/boms" }]}
      stage={{ compact: true }}
      preview={<TreeExplorer />}
    />
  )
}

// ====================================================================================== milestone
export function MilestonePage() {
  return (
    <Gallery
      id="FX-CMP-MILESTONE"
      title="Milestone strip (ETO)"
      description="Six billing milestones with percentages and evidence status, and the invoice-request state."
      where="ETO orders (Book V section 10.2)"
      source="[DOC:p.242 §10.2; Book I A §4.4 (Milestone Billing Plan)]"
      rules={["Default template 20 / 10 / 20 / 30 / 15 / 5 percent; editable per order and must total 100%.", "Milestone completion creates an invoice request in a Finance queue; the invoice is not auto-posted.", "The evidence reviewer is not the sales order owner (FL-02). Reversal only by credit note."]}
      adopted={[{ label: "Billing plan editor", to: "/sales/billing-plan" }, { label: "Sales order detail", to: "/sales/orders" }]}
      preview={<MilestoneStrip />}
    />
  )
}

// ====================================================================================== diff viewer
export function DiffViewerPage() {
  return (
    <Gallery
      id="FX-CMP-DIFF"
      title="Diff viewer"
      description="Revision compare, PO revision summary, mass-change before and after grid, and the conflict side-by-side."
      where="EBOM compare, PO revisions, mass change (Book I C §3.3; Book II §16.1)"
      source="[DOC:p.242 §10.2; Book I C §3.3; Book II §16.1]"
      rules={["Added, Removed and Changed are words plus a style, never colour alone.", "Unchanged rows can be hidden.", "The conflict state shows your change beside the version saved first and asks for a choice per field."]}
      adopted={[{ label: "Compare revisions", to: "/engineering/compare-revisions" }, { label: "Material change requests", to: "/materials/change-requests" }]}
      preview={
        <div className="flex flex-col gap-4">
          <DiffViewer />
          <ConflictDiff fields={[{ field: "Requested delivery date", mine: "2027-03-22", theirs: "2027-03-15" }]} />
          <p className="text-xs text-muted-foreground">Sets available: {Object.keys(DIFF_SETS).join(", ")}.</p>
        </div>
      }
    />
  )
}

// ====================================================================================== GL preview
const GL_RMA: GlLine[] = [
  { template: 17, amount: 18900, cc: "CC-2000", pc: "PC-400", matrixRow: "Matrix row MM-VAL-001 / 17: RMA receipt, PE ownership" },
  { template: 18, amount: 18900, cc: "CC-2000", pc: "PC-400", matrixRow: "Matrix row MM-VAL-001 / 18: restock disposition" },
]
export function GlPreviewPage() {
  return (
    <Gallery
      id="FX-CMP-GL"
      title="GL preview panel"
      description="The journal a posting will create: accounts, cost and profit centers, the rule that fired and the matrix row it came from."
      where="All posting screens (Book V section 10.2)"
      source="[DOC:p.242 §10.2; Book I H §3; Book II §3.11]"
      rules={["Accounts come only from the posting templates #17 to #38; nothing is invented.", "Every posting goes through the one Posting Service; the preview posts nothing.", "Debits equal credits on every line."]}
      adopted={[{ label: "Delivery cockpit (PGI)", to: "/sales/deliveries" }, { label: "Account determination", to: "/materials/account-determination" }]}
      preview={
        <div className="flex flex-col gap-4">
          <GlPreview />
          <GlPreview lines={GL_RMA} period="2026-10" />
        </div>
      }
    />
  )
}

// ====================================================================================== exception cards
export function ExceptionCardsPage() {
  return (
    <Gallery
      id="FX-CMP-EXCEPTION"
      title="Exception worklist card and SLA aging"
      description="Count, aging colour, owner and a one-click action, with quick-stat pills; reused on every workbench."
      where="All workbenches: MRP EX-, expedite, data quality, CO-R4 (Book V section 10.2)"
      source="[DOC:p.242 §10.2]"
      rules={["Aging is a word as well as a colour: Within SLA, Near SLA, SLA breached.", "Aging band limits come from the owning rule; the bands shown are design values.", "One primary action per card; it deep-links into the filtered queue."]}
      adopted={[{ label: "MRP workbench", to: "/production/mrp" }, { label: "Expedite board", to: "/purchasing/expedite" }, { label: "Data quality dashboard", to: "/materials/data-quality" }]}
      chips={<Chip kind="design">Aging bands: design values</Chip>}
      preview={
        <div className="grid gap-4 md:grid-cols-2">
          <ExceptionCard title="MRP exceptions" code="EX-" count={14} bands={[{ label: "0 to 2 d", count: 8, tone: "fresh" }, { label: "3 to 5 d", count: 4, tone: "aging" }, { label: "over 5 d", count: 2, tone: "breach" }]} owner="Planner" action="Open the queue" to="/production/mrp" pills={[{ label: "Expedite", value: "5" }, { label: "Cancel", value: "3" }]} />
          <ExceptionCard title="Unconfirmed POs" code="PUR" count={3} bands={[{ label: "0 to 2 d", count: 1, tone: "fresh" }, { label: "3 days, escalate", count: 2, tone: "breach" }]} owner="Buyer" action="Open expedite board" to="/purchasing/expedite" pills={[{ label: "Value", value: "$381K" }]} />
          <ExceptionCard title="Data quality" code="DQ" count={22} bands={[{ label: "0 to 2 d", count: 12, tone: "fresh" }, { label: "3 to 5 d", count: 10, tone: "aging" }]} owner="Material steward" action="Open data quality" to="/materials/data-quality" pills={[{ label: "Placeholders", value: "2" }]} />
          <ExceptionCard title="Variance review" code="CO-R4" count={4} bands={[{ label: "over 5 d", count: 4, tone: "breach" }]} owner="Controlling analyst" action="Open variances" to="/controlling/reports" />
        </div>
      }
    />
  )
}

// ====================================================================================== kiosk controls
export function KioskControlsPage() {
  return (
    <Gallery
      id="FX-CMP-KIOSK"
      title="Kiosk control set"
      description="48 px and larger targets, big start and complete, numeric keypad, hold and andon, badge login, crew clock-in and high contrast."
      where="Kiosk screens (Book V sections 7.6 and 8.4)"
      source="[DOC:p.234 §7.6; p.241 §8.4]"
      rules={["Targets at least 48 px; the primary on a scan screen is 64 px.", "No hover, drag, right-click or shortcut is needed to finish a task; every control is reachable by Tab.", "The kiosk is 1280 x 800, light theme only; high contrast adds borders and weight."]}
      adopted={[{ label: "Shop floor terminal", to: "/production/terminal" }, { label: "Pack station", to: "/sales/packing" }]}
      stage={{ compact: true }}
      preview={
        <>
          <KioskControlSet />
          <p className="mt-4 text-sm">
            Full-screen kiosk template: <Link to="/dev/kiosk" className="text-link underline">/dev/kiosk</Link> and device views on <Link to="/shell/devices" className="text-link underline">Responsive and device breakpoints</Link>.
          </p>
        </>
      }
    />
  )
}

// ====================================================================================== gantt
export function ScheduleGanttPage() {
  return (
    <Gallery
      id="FX-CMP-GANTT"
      title="Finite schedule, Gantt and capacity bars"
      description="Work-center buckets per day, load bars, the freeze horizon, maintenance windows, the sandbox banner and a move through an action menu to a validation dialog."
      where="Schedule board (Book III E §2-3)"
      source="[DOC:Book III E §2-3; p.69 and p.71 work centers]"
      rules={["Capacity is finite: load above 100% of capacity at 85% efficiency is a warning on a move.", "Moves inside the freeze horizon and into maintenance windows are errors.", "Sandbox changes never touch the live schedule until published.", "The shift length is not in the PRD: daily buckets are shown (reading)."]}
      adopted={[{ label: "Schedule board", to: "/production/schedule" }, { label: "Work center load", to: "/production/work-center-load" }]}
      stage={{ compact: true }}
      chips={<Chip kind="design">Freeze horizon 3 days: design value</Chip>}
      preview={<ScheduleGantt />}
    />
  )
}

// ====================================================================================== kanban
export function KanbanPage() {
  return (
    <Gallery
      id="FX-CMP-BOARD"
      title="Board and pipeline cards"
      description="The WIP board, the lead pipeline and the delivery status pipeline."
      where="Book VI sections 4 and 9"
      source="[DOC:Book VI §4, §9]"
      rules={["Column names are the record's own status words where a list exists (S-21 production order, S-6 delivery).", "Where no list exists (leads) no status badge is shown and the stages are design values.", "Every move works from a menu as well as by drag."]}
      adopted={[{ label: "WIP board", to: "/production/wip" }, { label: "Leads", to: "/sales/leads" }, { label: "Delivery cockpit", to: "/sales/deliveries" }]}
      stage={{ compact: true }}
      preview={
        <div className="flex flex-col gap-4">
          {BOARDS.map((b) => (
            <KanbanBoard key={b.id} def={b} />
          ))}
        </div>
      }
    />
  )
}

// ====================================================================================== rfq
export function RfqComparisonPage() {
  return (
    <Gallery
      id="FX-CMP-RFQGRID"
      title="Comparison grid (RFQ)"
      description="Vendors as columns, quantity bands, landed-cost normalisation, the lowest highlighted, weighted scoring, bid versions, deviations and the sealed to technical to commercial stage."
      where="RFQ comparison (Book I G §4; Book IV §3.4)"
      source="[DOC:Book I G §4; Book IV §3.4; p.100 §G]"
      rules={["Sealed: no prices visible. Technical review by Engineering comes before commercial bids open.", "RFQ is required above $25,000 uncontracted spend.", "Weights and scoring curves are design values; the award goes through the PO approval ladder."]}
      adopted={[{ label: "Requisitions and RFQs", to: "/purchasing/requisitions" }, { label: "Buyer workbench", to: "/purchasing/workbench" }]}
      stage={{ compact: true }}
      preview={<RfqGrid />}
    />
  )
}

// ====================================================================================== test row
export function TestCharacteristicPage() {
  return (
    <Gallery
      id="FX-CMP-TESTROW"
      title="Test characteristic row and calibration interlock"
      description="Automatic pass or fail, instrument binding and the calibration-expired block E-QM-05, with run history."
      where="Final test (Book I A §6.3; E §4, §7; F §3 SP-14)"
      source="[DOC:Book I A §6.3; E §4, §7; F §3 SP-14]"
      rules={["The instrument must be calibration-current at the time of the test (E-QM-05).", "Due Soon alerts at 30, 14 and 3 days; Overdue and Out of Service block entry.", "Results captured with an instrument that later lapses stay flagged."]}
      adopted={[{ label: "Final test and FTR", to: "/quality/final-test" }, { label: "Calibration register", to: "/quality/calibration" }, { label: "Routine test forms", to: "/quality/routine-tests" }]}
      stage={{ compact: true }}
      preview={
        <div className="flex flex-col gap-4">
          {CHARACTERISTICS.map((c, i) => (
            <TestCharacteristicRow key={c.name} c={c} history={i === 1 ? [{ run: 1, value: 22.4 }] : undefined} />
          ))}
          <p className="text-sm text-muted-foreground">Choose CAL-TBD-031 (Overdue) or CAL-TBD-040 (Out of Service) to see the block.</p>
        </div>
      }
    />
  )
}

// ====================================================================================== data viz
export function DataVizPage() {
  const [state, setState] = useState<VizState>("normal")
  const defects = [{ label: "Leak", value: 18 }, { label: "Paint", value: 11 }, { label: "Dim.", value: 7 }, { label: "Label", value: 4 }, { label: "Other", value: 2 }]
  return (
    <Gallery
      id="FX-CMP-DATAVIZ"
      title="Data-viz set"
      description="KPI tile with sparkline, Pareto, trend, funnel, waterfall and gauge; drill in three clicks or fewer; as-of chip, restated marker and export disclosure."
      where="Dashboards (Book VIII Archetype 6; Book IV §7.5)"
      source="[DOC:Book VIII Archetype 6; Book IV §7.5]"
      rules={["Every number reaches its source document in three clicks or fewer.", "Each chart has a data table behind it and an accessible label; no meaning by colour alone.", "Loading, empty and degraded states per widget; degraded shows the last good snapshot and its as-of time.", "A figure restated after publication carries a Restated marker.", "Exporting confirms the disclosure and is logged."]}
      adopted={[{ label: "Executive dashboard", to: "/dashboards/executive" }, { label: "Quality dashboard", to: "/quality/dashboard" }, { label: "Production dashboard", to: "/dashboards/production" }]}
      noStates
      preview={
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Widget state" className="inline-flex gap-1 self-start rounded-md border p-1 text-xs">
            {(["normal", "loading", "empty", "degraded"] as VizState[]).map((s) => (
              <button key={s} role="radio" aria-checked={state === s} onClick={() => setState(s)} className={cn("h-6 rounded-md px-2 capitalize", state === s && "bg-secondary font-semibold")}>
                {s}
              </button>
            ))}
          </div>
          <dl className="grid gap-4 md:grid-cols-3">
            <KpiTile label="Backlog" value="$14.2M" delta="+4.1% on last month" data={[10.4, 11.2, 11.9, 12.5, 13.8, 14.2]} asOf="Oct 9" to="/sales/orders" />
            <KpiTile label="On-time delivery" value="91%" delta="-2 pts" good={false} data={[96, 95, 94, 93, 92, 91]} asOf="Oct 9" />
            <KpiTile label="Gross margin" value="23.4%" delta="restated for Sept" data={[22, 23, 24, 23, 23.5, 23.4]} asOf="Oct 9" restated />
          </dl>
          <div className="grid gap-4 lg:grid-cols-2">
            <VizFrame title="Pareto: final-test defects" state={state} onExport={() => {}} table={{ head: ["Cause", "Count"], rows: defects.map((d) => [d.label, d.value]) }} drill={[{ label: "Quality dashboard", to: "/quality/dashboard" }, { label: "Defect list", to: "/quality/inspections" }, { label: "NCR-TBD-0044", to: "/quality" }]}>
              <Pareto data={defects} />
            </VizFrame>
            <VizFrame title="Trend: on-time delivery %" state={state} restated="Sept restated after a late POD" table={{ head: ["Month", "Actual", "Target"], rows: [["May", 96, 95], ["Jun", 95, 95], ["Jul", 94, 95], ["Aug", 93, 95], ["Sep", 92, 95], ["Oct", 91, 95]] }}>
              <TrendChart series={[{ label: "On-time delivery", points: [96, 95, 94, 93, 92, 91] }]} target={95} unit="%" />
            </VizFrame>
            <VizFrame title="Funnel: quotes" state={state} table={{ head: ["Stage", "Count"], rows: [["Drafted", 120], ["Issued", 84], ["Won", 31]] }}>
              <Funnel stages={[{ label: "Drafted", value: 120 }, { label: "Issued", value: 84 }, { label: "Won", value: 31 }]} />
            </VizFrame>
            <VizFrame title="Waterfall: order book change ($M)" state={state} table={{ head: ["Step", "$M"], rows: [["Opening", 12.8], ["New orders", 3.9], ["Shipped", -2.1], ["Cancelled", -0.4], ["Closing", 14.2]] }}>
              <WaterfallChart steps={[{ label: "Opening", value: 12.8, total: true }, { label: "New", value: 3.9 }, { label: "Shipped", value: -2.1 }, { label: "Cancel", value: -0.4 }, { label: "Closing", value: 14.2, total: true }]} />
            </VizFrame>
            <VizFrame title="Gauge: first-pass yield" state={state}>
              <Gauge value={92} target={95} label="First-pass yield" />
            </VizFrame>
          </div>
        </div>
      }
    />
  )
}

// ====================================================================================== simulation
export function SimulationPage() {
  return (
    <Gallery
      id="FX-CMP-SIM"
      title="Simulation and preview pattern"
      description="Per-row validation, an effect summary and a banner saying that nothing posts."
      where="Wizard with simulation (Book VIII Archetype 4)"
      source="[DOC:Book VIII Archetype 4; p.43-44 §10 safety stock]"
      rules={["Nothing posts or changes during a simulation, and the banner says so.", "Each row validates on its own; Apply is blocked while any row has an error.", "A safety-stock change above 25% needs the Planning Manager."]}
      adopted={[{ label: "Price simulation", to: "/pricing/simulate" }, { label: "Safety stock", to: "/inventory/safety-stock" }, { label: "E&O reserve run", to: "/materials/eo-reserve" }]}
      stage={{ compact: true }}
      preview={<SimulationPreview />}
    />
  )
}

// ====================================================================================== tax override
function DialogFrame({ title, children, note }: { title: string; children: React.ReactNode; note: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-lg">
      <p className="text-xs text-muted-foreground">{note}</p>
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  )
}
export function TaxOverridePage() {
  const [role] = useRole()
  const [lines, setLines] = useState<TaxLine[]>(TAX_LINES)
  const [open, setOpen] = useState<TaxLine | null>(null)
  const finance = FINANCE_ROLES.includes(role)
  return (
    <Gallery
      id="FX-CMP-TAX"
      title="Line tax override dialog and tax-status badges"
      description="Finance-only override with a reason, and the Override, Pending recalculation and Recalculated badges on quote, order and PO lines."
      where="Quote, sales order and PO lines (Book I A §11.1)"
      source="[DOC:Book I A §11.1]"
      rules={["Override is for Finance roles; others see why they cannot.", "The reason is required and goes on the audit trail.", "An overridden line is not recalculated until the override is cleared.", "Which Finance roles may override is a reading (ASM-PERM-1)."]}
      adopted={[{ label: "Quotations", to: "/sales/quotations" }, { label: "Sales orders", to: "/sales/orders" }, { label: "Purchase orders", to: "/purchasing/orders" }, { label: "Tax configuration", to: "/configuration/tax" }]}
      noStates
      chips={<Chip kind="oq" id="tax role">Finance-only: reading</Chip>}
      preview={
        <div className="flex flex-col gap-6">
          <Panel title={`Lines (you are acting as ${role}: ${finance ? "Finance roles may override" : "override is disabled for you"})`}>
            <table className="w-full text-sm">
              <thead className="bg-table-head text-left">
                <tr>
                  <th className="p-2">Line</th>
                  <th className="p-2 text-right">Base</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Tax</th>
                  <th className="p-2">Tax status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">
                      {l.doc}
                      {l.reason && <div className="text-xs text-muted-foreground">Reason: {l.reason}</div>}
                    </td>
                    <td className="tabular p-2 text-right">{fmtMoney(l.base)}</td>
                    <td className="tabular p-2 text-right">{(l.rate * 100).toFixed(2)}%</td>
                    <td className="tabular p-2 text-right">{fmtMoney(l.base * l.rate)}</td>
                    <td className="p-2">
                      <TaxBadge status={l.status} />
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => setOpen(l)}>
                        Override tax
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {open && (
            <TaxOverrideDialog
              key={open.id}
              line={open}
              open
              onOpenChange={(o) => !o && setOpen(null)}
              onApply={(rate, reason) => setLines((ls) => ls.map((x) => (x.id === open.id ? { ...x, rate, status: "Override", reason } : x)))}
            />
          )}
          <div>
            <h2 className="mb-2 text-sm font-semibold">The dialog in each state</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <DialogFrame title="Override tax on this line" note="Finance role, valid input">
                <p className="text-sm">Override rate (%) 0.00 · Reason: Exemption certificate on file</p>
                <Button size="sm" className="self-start">Apply override</Button>
              </DialogFrame>
              <DialogFrame title="Override tax on this line" note="Not a Finance role">
                <p role="alert" className="text-sm text-destructive">This control is for Finance roles ({FINANCE_ROLES.join(", ")}). You are acting as Sales rep.</p>
                <Button size="sm" className="self-start" disabled>Apply override</Button>
              </DialogFrame>
              <DialogFrame title="Override tax on this line" note="Validation: rate out of range, reason missing">
                <p className="text-xs text-destructive">Enter a tax rate between 0 and 20 percent.</p>
                <p role="alert" className="text-sm text-destructive">Enter a reason to continue.</p>
              </DialogFrame>
              <DialogFrame title="Tax engine unavailable" note="Degraded">
                <p className="text-sm">The tax engine is not answering. Lines show Pending recalculation; override still works and is logged. The recalculation queue retries every 15 minutes.</p>
              </DialogFrame>
            </div>
          </div>
        </div>
      }
    />
  )
}

// ====================================================================================== completeness
export function CompletenessPage() {
  const rows: { id: string; blocks: ("Purchasing Block" | "Sales Block" | "Production Block" | "Shipping Block" | "Posting Block")[] }[] = [
    { id: "FIN-TBD-20MVA", blocks: [] },
    { id: "SEMI-TBD-CORE25", blocks: ["Production Block"] },
    { id: "RAW-TBD-BSH015", blocks: ["Purchasing Block"] },
    { id: "TRADE-TBD-FCI", blocks: ["Sales Block", "Posting Block"] },
    { id: "RAW-TBD-CT600", blocks: [] },
  ]
  return (
    <Gallery
      id="FX-CMP-COMPLETE"
      title="Data completeness bar and function-block chips"
      description="Material completeness as a percentage by view, and the Purchasing, Sales, Production, Shipping and Posting block chips."
      where="Material detail and listing (Book II §3.1, §4.5)"
      source="[DOC:Book II §3.1, §4.5; p.151 §4.5]"
      rules={["A function-specific block is a chip beside the lifecycle badge, never instead of it (C-5, C-49).", "The percentage counts views done; the weights are not in the PRD, so every view counts equally (reading)."]}
      adopted={[{ label: "Material listing", to: "/inventory/items" }, { label: "Material detail", to: "/inventory/items/FIN-TBD-20MVA" }]}
      chips={<Chip kind="design">Equal weight per view</Chip>}
      preview={
        <div className="flex flex-col gap-4">
          {rows.map((r) => {
            const m = MATERIALS.find((x) => x.id === r.id)
            return (
              <Panel key={r.id} title={`${r.id} ${m?.description ?? ""}`} actions={m && <StatusBadge kind="material" status={m.status} size="sm" />}>
                <CompletenessBar materialId={r.id} blocks={r.blocks} />
              </Panel>
            )
          })}
        </div>
      }
    />
  )
}

// ====================================================================================== guidelines
const GUIDE: { name: string; to: string; kit: string; where: string; dos: string; donts: string }[] = [
  { name: "Status badge and lifecycle strip", to: "/components/status-lifecycle", kit: "StatusBadge, LifecycleStrip (patterns)", where: "Every Detail header", dos: "Use the record kind and the exact S-n word.", donts: "Invent a status word or show a badge for a record with no list." },
  { name: "Entity context bar, audit trail, attachments", to: "/components/context-audit", kit: "EntityContextBar, AuditTrail, AttachmentPanel", where: "Every Detail", dos: "Show checksums; keep the trail append-only.", donts: "Offer edit or delete on activity." },
  { name: "Readiness chips", to: "/components/readiness-chips", kit: "ReadinessChips", where: "SO, delivery, WO release", dos: "Link evidence to the source document.", donts: "Use a chip in place of a blocking gate." },
  { name: "Approval strip", to: "/components/approval-strip", kit: "ApprovalStrip (shows) and ApprovalButton (raises)", where: "W.4 workflows", dos: "Raise requests with ApprovalButton.", donts: "Build your own approve or reject buttons on a module screen." },
  { name: "Price waterfall", to: "/components/price-waterfall", kit: "PriceWaterfall, MarginVerdict", where: "Quote and SO lines", dos: "Show the route when below the floor.", donts: "Hide the margin verdict." },
  { name: "Scan input and feedback", to: "/components/scan-feedback", kit: "ScanField, ScanFeedbackDemo", where: "Kiosk and mobile", dos: "Take focus on mount and after a scan.", donts: "Pull focus on blur; put a scan target in a form field." },
  { name: "Tree explorer", to: "/components/tree-explorer", kit: "TreeExplorer", where: "EBOM, trace", dos: "Lazy-load deeper levels.", donts: "Load five levels slowly without a skeleton." },
  { name: "Milestone strip", to: "/components/milestone-strip", kit: "MilestoneStrip", where: "ETO orders", dos: "Total 100%.", donts: "Auto-post an invoice." },
  { name: "Diff viewer", to: "/components/diff-viewer", kit: "DiffViewer, ConflictDiff", where: "Compare, conflict", dos: "Word plus style for each change.", donts: "Colour alone." },
  { name: "GL preview", to: "/components/gl-preview", kit: "GlPreview, PostingPreview", where: "Posting screens", dos: "Show before commit.", donts: "Invent an account." },
  { name: "Exception worklist card", to: "/components/exception-cards", kit: "ExceptionCard", where: "Workbenches", dos: "One action; aging as a word.", donts: "More than one primary." },
  { name: "Kiosk control set", to: "/components/kiosk-controls", kit: "KioskControlSet, NumericKeypad", where: "Kiosk", dos: "48 px and up.", donts: "Hover-only paths." },
  { name: "Finite schedule", to: "/components/schedule-gantt", kit: "ScheduleGantt", where: "Schedule board", dos: "Validate every move.", donts: "Drag with no menu alternative." },
  { name: "Board and pipeline", to: "/components/kanban", kit: "KanbanBoard", where: "WIP, leads, delivery", dos: "Use the status words as columns.", donts: "Badge a record with no status list." },
  { name: "RFQ comparison", to: "/components/rfq-comparison", kit: "RfqGrid", where: "RFQ", dos: "Keep bids sealed until technical review.", donts: "Show prices early." },
  { name: "Test characteristic row", to: "/components/test-characteristic", kit: "TestCharacteristicRow", where: "Final test", dos: "Block on E-QM-05.", donts: "Accept a result from an uncalibrated instrument." },
  { name: "Data-viz set", to: "/components/data-viz", kit: "VizFrame, KpiTile, Pareto, TrendChart, Funnel, WaterfallChart, Gauge", where: "Dashboards", dos: "As-of chip; table behind each chart.", donts: "Colour-only series." },
  { name: "Simulation and preview", to: "/components/simulation-preview", kit: "SimulationPreview", where: "Wizards", dos: "Say that nothing posts.", donts: "Apply with an error row." },
  { name: "Line tax override", to: "/components/tax-override", kit: "TaxOverrideDialog, TaxBadge", where: "Quote, SO, PO lines", dos: "Require a reason.", donts: "Let a non-Finance role apply it." },
  { name: "Completeness and blocks", to: "/components/completeness", kit: "CompletenessBar", where: "Material", dos: "Chip beside the badge.", donts: "Replace the lifecycle badge." },
  { name: "Nine states and legal hold", to: "/components/state-kit", kit: "StateStage, LegalHoldControl, PeriodStatusBanner, OfflineBanner, DegradedBanner", where: "Every screen", dos: "Design all nine states.", donts: "A blank page for an authorization error." },
]
export function GuidelinesPage() {
  const [q, setQ] = useState("")
  const list = useMemo(() => GUIDE.filter((g) => `${g.name} ${g.kit} ${g.where}`.toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <DetailPage
      header={{ title: "Component documentation and usage guidelines", screenId: "FX-CMP-GUIDE", description: "One row per component: where it is used, the code to import, what to do and what to avoid." }}
      tabs={[
        {
          id: "components",
          label: "Components",
          count: GUIDE.length,
          content: (
            <div className="flex flex-col gap-2">
              <Input aria-label="Filter components" placeholder="Filter by name, code or screen" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-sm" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-table-head text-left">
                    <tr>
                      <th className="p-2">Component</th>
                      <th className="p-2">Import</th>
                      <th className="p-2">Where</th>
                      <th className="p-2">Do</th>
                      <th className="p-2">Do not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((g) => (
                      <tr key={g.name} className="border-t align-top">
                        <td className="p-2">
                          <Link to={g.to} className="text-link underline">
                            {g.name}
                          </Link>
                        </td>
                        <td className="p-2 font-mono text-xs">{g.kit}</td>
                        <td className="p-2">{g.where}</td>
                        <td className="p-2">{g.dos}</td>
                        <td className="p-2">{g.donts}</td>
                      </tr>
                    ))}
                    {list.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          No component matches.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          id: "rules",
          label: "House rules",
          content: (
            <ul className="max-w-3xl list-disc pl-4 text-sm">
              <li>Use only token classes: no hex values, no arbitrary colours, no new CSS (spacing steps 1, 2, 3, 4, 6, 8, 12, 16).</li>
              <li>Status is icon plus word; a status badge is never colour alone (C-2).</li>
              <li>Any action that ends a record, posts or fires a milestone goes through DialogShell and names the consequence.</li>
              <li>Kiosk: 48 px targets, no hover-only path, every task finished by keyboard alone.</li>
              <li>Where the PRD is silent, choose a value, show it as a reading chip and log it.</li>
              <li>Import the kit from <code>@/modules/shell/kit</code>; do not copy components into a module.</li>
            </ul>
          ),
        },
        {
          id: "figma",
          label: "Naming",
          content: (
            <p className="max-w-3xl text-sm">
              One library file holds tokens, components, icons and status colours; no local styles in feature files. Frame names carry the screen id and the state, for example <code>OM-SO-002 / detail / conflict</code>, so requirement linkage is mechanical (Book V section 10.4). A frame without a spec link fails design review at gate DG-2.
            </p>
          ),
        },
      ]}
    />
  )
}

export { FamilyBadge }
