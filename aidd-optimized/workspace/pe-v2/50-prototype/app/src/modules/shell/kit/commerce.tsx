// Commerce components: approval strip, price waterfall, ETO milestone strip, diff viewer, GL preview,
// RFQ comparison grid.
import { useMemo, useState, type ReactNode } from "react"
import { ArrowRight, Check, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip, FamilyBadge } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { POSTING_TEMPLATES, THRESHOLDS, routeApproval, type ApprovalKind, type Family, type Role, type TemplateNo } from "@/data/domain"
import { VENDORS } from "@/data/shared"
import { fmtMoney, fmtPct } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel } from "./record"

// ====================================================================================== approval strip
export type StepState = "Approved" | "Current" | "Waiting" | "Rejected"
export interface StripStep {
  role: string
  state: StepState
  by?: string
  on?: string
  comment?: string
  slaHours: number
  elapsedHours: number
  delegate?: string
}
const STEP_FAMILY: Record<StepState, Family> = { Approved: "done", Current: "active", Waiting: "draft", Rejected: "cancelled" }
export function stepsFor(kind: ApprovalKind, ctx: { amount?: number } = {}, current = 0): StripStep[] {
  const r = routeApproval(kind, ctx)
  return r.steps.map((role, i) => ({ role, state: i < current ? "Approved" : i === current ? "Current" : "Waiting", slaHours: 24, elapsedHours: i === current ? 20 : 0, by: i < current ? "Prior approver" : undefined, on: i < current ? "2026-10-08" : undefined }))
}
const DELEGATES = ["Hiro Tanaka", "Derek Achterberg", "Carl Halvorsen", "Patrick Doyle"]

/** Approval strip: chain, current step, SLA clock, act buttons, delegation (barred above $250k on financial
 *  approvals, C-2), parallel CCB votes, recall before first approval, reject with mandatory comment.
 *  Requests are raised with ApprovalButton, never from here: the strip shows and acts on a raised request. */
export function ApprovalStrip({ kind = "PO approval", amount = 207900, financial, initial, parallel, title }: { kind?: ApprovalKind; amount?: number; financial?: boolean; initial?: StripStep[]; parallel?: { label: string; quorum: number; members: string[] }; title?: string }) {
  const route = routeApproval(kind, { amount, financial })
  const [steps, setSteps] = useState<StripStep[]>(initial ?? stepsFor(kind, { amount }))
  const [history, setHistory] = useState<string[]>([])
  const [reject, setReject] = useState(false)
  const [delegating, setDelegating] = useState(false)
  const [recalled, setRecalled] = useState(false)
  const [votes, setVotes] = useState<Record<string, "Approve" | "Reject" | undefined>>({})
  const [delegate, setDelegate] = useState(DELEGATES[0])
  const idx = steps.findIndex((s) => s.state === "Current")
  const anyApproved = steps.some((s) => s.state === "Approved")
  const log = (t: string) => setHistory((h) => [t, ...h])
  const approve = () => {
    setSteps((ss) => ss.map((s, i) => (i === idx ? { ...s, state: "Approved", by: s.delegate ?? s.role, on: "2026-10-09" } : i === idx + 1 ? { ...s, state: "Current" } : s)))
    log(`${steps[idx].role} approved${steps[idx].delegate ? ` (delegate ${steps[idx].delegate})` : ""}`)
  }
  const yes = parallel ? Object.values(votes).filter((v) => v === "Approve").length : 0
  const no = parallel ? Object.values(votes).filter((v) => v === "Reject").length : 0
  return (
    <section aria-label={title ?? "Approval strip"} className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{title ?? `${kind}${amount ? ` · ${fmtMoney(amount)}` : ""}`}</h3>
        <span className="text-xs text-muted-foreground">{route.rule}</span>
        <span className="text-xs text-muted-foreground">{route.source}</span>
        {route.reading && <Chip kind="oq" id="approver" note={route.reading}>Routing reading</Chip>}
      </header>
      {recalled ? (
        <p role="status" className="rounded-md bg-muted p-2 text-sm">
          Recalled by the initiator before the first approval. The request returns to Draft; history stays.
          <Button size="sm" variant="outline" className="ml-2" onClick={() => (setRecalled(false), setSteps(stepsFor(kind, { amount })), log("Resubmitted; earlier history preserved"))}>
            Resubmit
          </Button>
        </p>
      ) : (
        <ol aria-label="Approval chain" className="flex flex-wrap items-stretch gap-2">
          {steps.map((s, i) => {
            const left = s.slaHours - s.elapsedHours
            const breached = s.state === "Current" && left < 0
            return (
              <li key={s.role + i} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />}
                <div className={cn("flex min-w-44 flex-col gap-1 rounded-md border p-2 text-sm", s.state === "Current" && "border-primary")} aria-current={s.state === "Current" ? "step" : undefined}>
                  <span className="font-medium">{s.role}</span>
                  <FamilyBadge family={STEP_FAMILY[s.state]} label={s.state} size="sm" />
                  {s.state === "Current" && (
                    <span className={cn("tabular flex items-center gap-1 text-xs", breached ? "text-status-cancelled-ink" : "text-muted-foreground")}>
                      <Clock className="size-3" aria-hidden="true" />
                      {breached ? `SLA breached by ${-left} h: escalates to the ${s.role}'s manager` : `${left} h left of ${s.slaHours} h`}
                    </span>
                  )}
                  {s.delegate && <span className="text-xs">Delegate: {s.delegate}</span>}
                  {s.on && (
                    <span className="text-xs text-muted-foreground">
                      {s.by}, {s.on}
                    </span>
                  )}
                  {s.comment && <span className="text-xs">“{s.comment}”</span>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {parallel && (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" aria-hidden="true" /> {parallel.label}: {yes} approve, {no} reject, quorum {parallel.quorum} of {parallel.members.length}
            <Chip kind="oq" id="CCB quorum" note="CCB membership and quorum are not listed in the PRD">Quorum reading</Chip>
          </p>
          <ul className="flex flex-wrap gap-2">
            {parallel.members.map((m) => (
              <li key={m} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                {m}
                {votes[m] ? (
                  <FamilyBadge family={votes[m] === "Approve" ? "done" : "cancelled"} label={votes[m] === "Approve" ? "Approved" : "Rejected"} size="sm" />
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setVotes({ ...votes, [m]: "Approve" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setVotes({ ...votes, [m]: "Reject" })}>
                      Reject
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {yes >= parallel.quorum && <p role="status" className="text-sm">Quorum reached: the ECR is approved (all votes recorded on the Activity tab).</p>}
        </div>
      )}
      {!recalled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={idx < 0} onClick={approve}>
            <Check aria-hidden="true" /> Approve
          </Button>
          <Button variant="outline" disabled={idx < 0} onClick={() => setReject(true)}>
            Reject with comment
          </Button>
          <Button variant="outline" disabled={idx < 0} onClick={() => setDelegating(true)}>
            Delegate
          </Button>
          <Button variant="ghost" disabled={anyApproved || idx < 0} title={anyApproved ? "The initiator may recall only before the first approval" : undefined} onClick={() => (setRecalled(true), log("Recalled by initiator"))}>
            Recall
          </Button>
          {anyApproved && <span className="text-xs text-muted-foreground">Recall closed: a step has approved.</span>}
        </div>
      )}
      {history.length > 0 && (
        <ul aria-label="History" className="text-xs text-muted-foreground">
          {history.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
      <DialogShell
        open={reject}
        onOpenChange={setReject}
        title="Reject this request?"
        consequence="The request returns to the responsible step with your comment. Resubmission keeps the history."
        requireReason
        reasonLabel="Comment (required)"
        confirmLabel="Reject"
        destructive
        onConfirm={(c) => {
          setSteps((ss) => ss.map((s, i) => (i === idx ? { ...s, state: "Rejected", comment: c } : s)))
          log(`${steps[idx]?.role} rejected: ${c}`)
          return null
        }}
      />
      <DialogShell
        open={delegating}
        onOpenChange={setDelegating}
        title={`Delegate the ${steps[idx]?.role ?? ""} step`}
        consequence={route.delegationAllowed ? "The delegate acts for you; every action is logged as delegated." : undefined}
        confirmLabel="Delegate"
        confirmDisabled={!route.delegationAllowed}
        onConfirm={() => {
          setSteps((ss) => ss.map((s, i) => (i === idx ? { ...s, delegate } : s)))
          log(`${steps[idx]?.role} delegated to ${delegate}`)
          return null
        }}
      >
        {route.delegationAllowed ? (
          <div className="grid gap-2">
            <Label htmlFor="strip-delegate">Delegate</Label>
            <select id="strip-delegate" value={delegate} onChange={(e) => setDelegate(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              {DELEGATES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            Standing delegation of financial approvals above $250,000 is prohibited (segregation-of-duties rule, C-2). This request is {fmtMoney(amount)}. The step stays with {steps[idx]?.role}.
          </p>
        )}
      </DialogShell>
    </section>
  )
}

// ====================================================================================== price waterfall
export interface WaterfallInput {
  base: number
  qty: number
  discountPct: number
  surchargePct: number
  freight: number
  taxPct: number
  stdCost: number
  profitCenter: "PC-100" | "PC-300" | "PC-200"
  source: "Price list" | "Customer agreement" | "Manual"
}
export const WATERFALL_DEFAULT: WaterfallInput = { base: 78400, qty: 2, discountPct: 4, surchargePct: 3.2, freight: 1850, taxPct: 7.25, stdCost: 61200, profitCenter: "PC-100", source: "Price list" }
export function waterfall(i: WaterfallInput) {
  const base = i.base * i.qty
  const discount = -(base * i.discountPct) / 100
  const surcharge = ((base + discount) * i.surchargePct) / 100
  const net = base + discount + surcharge
  const freight = i.freight
  const taxable = net + freight
  const tax = (taxable * i.taxPct) / 100
  const total = taxable + tax
  const margin = net > 0 ? ((net - i.stdCost * i.qty) / net) * 100 : 0
  const floor = (THRESHOLDS.priceFloorPct as Record<string, number>)[i.profitCenter]
  return { steps: [{ no: 10, name: "Base price", amount: base }, { no: 20, name: "Discount", amount: discount }, { no: 30, name: "Commodity surcharge", amount: surcharge }, { no: 40, name: "Freight", amount: freight }, { no: 50, name: "Tax", amount: tax }], net, total, margin, floor }
}
export function MarginVerdict({ margin, floor }: { margin: number; floor?: number }) {
  if (floor == null) return <Chip kind="oq" id="floor" note="Only PC-100 and PC-300 have floors in the PRD">No floor for this profit center</Chip>
  const pts = floor - margin
  if (pts <= 0) return <FamilyBadge family="done" label={`At or above the ${floor}% floor`} />
  if (pts <= 5) return <FamilyBadge family="pending" label={`${pts.toFixed(1)} pts below floor: Pricing Manager, then Sales Director`} />
  return <FamilyBadge family="blocked" label={`${pts.toFixed(1)} pts below floor: Pricing Manager, Sales Director and CFO`} />
}
export function PriceWaterfall({ initial = WATERFALL_DEFAULT, editable = true }: { initial?: WaterfallInput; editable?: boolean }) {
  const [v, setV] = useState(initial)
  const w = waterfall(v)
  const max = Math.max(...w.steps.map((s) => Math.abs(s.amount)), w.total)
  const num = (k: keyof WaterfallInput) => (
    <div className="grid gap-1">
      <Label htmlFor={`wf-${k}`} className="text-xs capitalize">
        {k === "discountPct" ? "Discount %" : k === "surchargePct" ? "Surcharge %" : k === "taxPct" ? "Tax %" : k}
      </Label>
      <Input id={`wf-${k}`} type="number" step="any" value={v[k] as number} disabled={!editable} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="h-8 w-28" />
    </div>
  )
  return (
    <section aria-label="Price waterfall" className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Price waterfall, condition steps 10 to 50</h3>
        <span className="rounded border px-2 py-0.5 text-xs">Price source: {v.source}</span>
        <MarginVerdict margin={w.margin} floor={w.floor} />
      </header>
      {editable && (
        <div className="flex flex-wrap gap-4">
          {num("base")}
          {num("qty")}
          {num("discountPct")}
          {num("surchargePct")}
          {num("freight")}
          {num("taxPct")}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-table-head text-left">
          <tr>
            <th className="p-2">Step</th>
            <th className="p-2">Condition</th>
            <th className="p-2 text-right">Amount</th>
            <th className="w-1/2 p-2">Waterfall (hover or focus a bar)</th>
          </tr>
        </thead>
        <tbody>
          {w.steps.map((s) => (
            <tr key={s.no} className="border-t">
              <td className="tabular p-2 font-mono">{s.no}</td>
              <td className="p-2">{s.name}</td>
              <td className="tabular p-2 text-right">{fmtMoney(s.amount)}</td>
              <td className="p-2">
                <div tabIndex={0} title={`${s.no} ${s.name}: ${fmtMoney(s.amount)} (${((Math.abs(s.amount) / max) * 100).toFixed(0)}% of the largest step)`} aria-label={`${s.name} ${fmtMoney(s.amount)}`} className="h-4 rounded-sm bg-status-active" style={{ width: `${Math.max(2, (Math.abs(s.amount) / max) * 100)}%`, opacity: s.amount < 0 ? 0.5 : 1 }} />
              </td>
            </tr>
          ))}
          <tr className="border-t bg-muted font-semibold">
            <td className="p-2" colSpan={2}>
              Net price before freight and tax · margin {fmtPct(w.margin)} on standard cost
            </td>
            <td className="tabular p-2 text-right">{fmtMoney(w.net)}</td>
            <td className="p-2 text-right">Total {fmtMoney(w.total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Floors: PC-100 {THRESHOLDS.priceFloorPct["PC-100"]}%, PC-300 {THRESHOLDS.priceFloorPct["PC-300"]}%. Below the floor the price routes Pricing Manager, then Sales Director; more than 5 points below adds the CFO (C-36). Step numbering 10 to 50 is the feature list's; the condition names are a reading.</p>
    </section>
  )
}

// ====================================================================================== milestone strip
export interface Milestone {
  name: string
  pct: number
  trigger: string
  evidence: string
  state: "Not due" | "Evidence in review" | "Invoice requested" | "Invoiced"
}
export const MILESTONES: Milestone[] = [
  { name: "Order Acceptance / Down Payment", pct: 20, trigger: "Sales order status Confirmed", evidence: "Signed order confirmation", state: "Invoiced" },
  { name: "Design Approval", pct: 10, trigger: "Customer drawing approval milestone complete", evidence: "Approved drawing transmittal", state: "Invoiced" },
  { name: "Major Materials Procured", pct: 20, trigger: "All long-lead POs confirmed", evidence: "PO confirmations report", state: "Invoice requested" },
  { name: "Production Complete / Tested", pct: 30, trigger: "Final Test passed (FTR issued)", evidence: "Certified test report", state: "Evidence in review" },
  { name: "Shipment", pct: 15, trigger: "PGI posted", evidence: "BOL", state: "Not due" },
  { name: "Delivery / Commissioning Support", pct: 5, trigger: "POD or site acceptance", evidence: "POD", state: "Not due" },
]
const MS_FAMILY: Record<Milestone["state"], Family> = { "Not due": "draft", "Evidence in review": "pending", "Invoice requested": "active", Invoiced: "done" }
export function MilestoneStrip({ orderTotal = 1284000, milestones = MILESTONES, onRequest }: { orderTotal?: number; milestones?: Milestone[]; onRequest?: (name: string) => void }) {
  const [ms, setMs] = useState(milestones)
  const total = ms.reduce((s, m) => s + m.pct, 0)
  return (
    <section aria-label="Milestone strip" className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Billing milestones, ETO order · total {total}% {total !== 100 && <Chip kind="flag">Must total 100%</Chip>}</h3>
      <div role="list" className="flex h-8 overflow-hidden rounded-md border" aria-label="Milestone slices">
        {ms.map((m) => (
          <div key={m.name} role="listitem" title={`${m.name} ${m.pct}%`} style={{ width: `${m.pct}%` }} className={cn("flex items-center justify-center border-r text-xs font-semibold last:border-r-0", m.state === "Invoiced" ? "bg-status-done text-status-done-ink" : m.state === "Invoice requested" ? "bg-status-active-tint text-status-active-ink" : m.state === "Evidence in review" ? "bg-status-pending-tint text-status-pending-ink" : "bg-muted text-muted-foreground")}>
            {m.pct}%
          </div>
        ))}
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {ms.map((m, i) => (
          <li key={m.name} className="flex flex-col gap-1 rounded-md border p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular font-mono text-xs">{i + 1}</span>
              <span className="font-medium">{m.name}</span>
              <FamilyBadge family={MS_FAMILY[m.state]} label={m.state} size="sm" />
              <span className="tabular ml-auto">{fmtMoney((orderTotal * m.pct) / 100)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trigger: {m.trigger} · Evidence: {m.evidence}
            </p>
            {m.state === "Evidence in review" && (
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => {
                  setMs((x) => x.map((y, j) => (j === i ? { ...y, state: "Invoice requested" } : y)))
                  onRequest?.(m.name)
                }}
              >
                Request invoice (Finance reviews evidence and posts)
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Milestone completion creates an invoice request in a Finance queue; the invoice is not auto-posted. The reviewer is not the sales order owner (FL-02). Reversal only by credit note.</p>
    </section>
  )
}

// ====================================================================================== diff viewer
export interface DiffRow {
  key: string
  label: string
  before?: string
  after?: string
}
export const DIFF_SETS: Record<string, { title: string; rows: DiffRow[] }> = {
  "EBOM revision": {
    title: "EBOM-TBD-0301 rev A to rev B",
    rows: [
      { key: "10", label: "10 Core, CRGO 0.23 mm", before: "54,000 kg", after: "54,000 kg" },
      { key: "20", label: "20 Tap changer", before: "RAW-TBD-OLTC, 13 positions", after: "RAW-TBD-OLTC, 17 positions" },
      { key: "30", label: "30 HV bushing 145 kV", before: "3 x RAW-TBD-BSH145", after: "3 x RAW-TBD-BSH145" },
      { key: "40", label: "40 Radiator bank", before: "8 panels", after: "10 panels" },
      { key: "50", label: "50 Oil conservator", before: undefined, after: "1 x conservator, 900 L" },
      { key: "60", label: "60 Pressure relief, 15 psi", before: "1 x", after: undefined },
    ],
  },
  "PO revision": {
    title: "PO-TBD-0377 rev 0 to rev 1 summary",
    rows: [
      { key: "qty", label: "Quantity", before: "54,000 kg", after: "54,000 kg" },
      { key: "price", label: "Unit price", before: "$3.85 / kg", after: "$3.85 / kg" },
      { key: "date", label: "Delivery date", before: "2026-12-04", after: "2026-11-20" },
      { key: "inc", label: "Incoterms", before: "FCA", after: "DAP" },
      { key: "terms", label: "Payment terms", before: "Net 45", after: "Net 30" },
    ],
  },
  "MCH before/after": {
    title: "Mass change MCH-TBD-0007: 3 materials",
    rows: [
      { key: "a", label: "RAW-TBD-BSH145 safety stock", before: "6", after: "8" },
      { key: "b", label: "RAW-TBD-CRGO23 safety stock", before: "60,000 kg", after: "75,000 kg" },
      { key: "c", label: "RAW-TBD-OLTC lead time", before: "84 days", after: "84 days" },
    ],
  },
}
const diffKind = (r: DiffRow) => (r.before == null ? "Added" : r.after == null ? "Removed" : r.before !== r.after ? "Changed" : "Same")
export function DiffViewer({ set = "EBOM revision", changesOnly: initialChanges = false }: { set?: string; changesOnly?: boolean }) {
  const [name, setName] = useState(set)
  const [changesOnly, setChangesOnly] = useState(initialChanges)
  const d = DIFF_SETS[name]
  const rows = useMemo(() => d.rows.filter((r) => !changesOnly || diffKind(r) !== "Same"), [d, changesOnly])
  const counts = d.rows.reduce((a, r) => ({ ...a, [diffKind(r)]: (a[diffKind(r) as keyof typeof a] ?? 0) + 1 }), {} as Record<string, number>)
  return (
    <section aria-label="Diff viewer" className="flex flex-col gap-2 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{d.title}</h3>
        <select aria-label="Compare set" value={name} onChange={(e) => setName(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
          {Object.keys(DIFF_SETS).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={changesOnly} onChange={(e) => setChangesOnly(e.target.checked)} /> Changes only
        </label>
        <span className="tabular text-xs text-muted-foreground">
          {counts.Added ?? 0} added, {counts.Removed ?? 0} removed, {counts.Changed ?? 0} changed
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left">
            <tr>
              <th className="p-2">Line</th>
              <th className="p-2">Before</th>
              <th className="p-2">After</th>
              <th className="p-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const k = diffKind(r)
              return (
                <tr key={r.key} className="border-t">
                  <td className="p-2">{r.label}</td>
                  <td className={cn("p-2", k === "Removed" || k === "Changed" ? "line-through decoration-1" : "")}>{r.before ?? <span className="text-muted-foreground">none</span>}</td>
                  <td className={cn("p-2", k !== "Same" && "font-semibold")}>{r.after ?? <span className="text-muted-foreground">none</span>}</td>
                  <td className="p-2">
                    <FamilyBadge family={k === "Added" ? "active" : k === "Removed" ? "cancelled" : k === "Changed" ? "pending" : "draft"} label={k} size="sm" />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No differences.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Change is shown by a word and a style, never colour alone (C-2). The conflict state uses the same grid with your change beside the saved one.</p>
    </section>
  )
}

// ====================================================================================== GL preview
export interface GlLine {
  template: TemplateNo
  amount: number
  cc?: string
  pc?: string
  matrixRow: string
}
export const GL_SAMPLE: GlLine[] = [
  { template: 25, amount: 3_672_000, cc: "CC-1700", pc: "PC-200", matrixRow: "Matrix row MM-VAL-001 / 25: movement PGI x valuation class FIN" },
  { template: 26, amount: 1_850, cc: "CC-1700", pc: "PC-100", matrixRow: "Matrix row MM-VAL-001 / 26: freight out, PE-paid terms" },
  { template: 27, amount: 940, cc: "CC-1700", pc: "PC-100", matrixRow: "Matrix row MM-VAL-001 / 27: packaging backflush" },
]
/** GL preview: the journal a posting will create, with CC/PC, the rule that fired (template number) and the
 *  account-determination matrix row it came from. Accounts come only from templates #17..#38. */
export function GlPreview({ lines = GL_SAMPLE, period = "2026-10", children }: { lines?: GlLine[]; period?: string; children?: ReactNode }) {
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <Panel title={`GL preview · period ${period}`} actions={<Chip kind="design" note="Nothing posts from a preview">Nothing posts yet</Chip>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left">
            <tr>
              <th className="p-2">Rule</th>
              <th className="p-2">Debit</th>
              <th className="p-2">Credit</th>
              <th className="p-2">CC / PC</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2">Matrix row lineage</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const t = POSTING_TEMPLATES[l.template]
              return (
                <tr key={i} className="border-t align-top">
                  <td className="p-2">
                    <span className="font-mono">#{t.no}</span> {t.transaction}
                  </td>
                  <td className="p-2">DR {t.debit}</td>
                  <td className="p-2">CR {t.credit}</td>
                  <td className="p-2 font-mono text-xs">
                    {l.cc ?? "none"} / {l.pc ?? "none"}
                  </td>
                  <td className="tabular p-2 text-right">{fmtMoney(l.amount)}</td>
                  <td className="p-2 text-xs text-muted-foreground">{l.matrixRow}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Debits equal credits for every line. Posts through the one Posting Service.</span>
        <span className="tabular">Journal total {fmtMoney(total)}</span>
      </p>
      {children}
    </Panel>
  )
}

// ====================================================================================== RFQ comparison grid
type Stage = "Sealed" | "Technical" | "Commercial"
const STAGES: Stage[] = ["Sealed", "Technical", "Commercial"]
interface Bid {
  vendorId: string
  version: number
  bands: number[]
  freight: number
  dutyPct: number
  leadDays: number
  terms: string
  quality: number
  deviations: string[]
  technical: "Pass" | "Pass with deviations" | "Fail"
}
const BANDS = ["1", "2 to 4", "5 or more"]
const BIDS: Bid[] = [
  { vendorId: "VEN-TBD-0103", version: 2, bands: [74500, 72900, 70200], freight: 2400, dutyPct: 0, leadDays: 84, terms: "Net 45", quality: 92, deviations: [], technical: "Pass" },
  { vendorId: "VEN-TBD-0104", version: 1, bands: [71800, 69900, 67400], freight: 3900, dutyPct: 2.5, leadDays: 98, terms: "Net 30", quality: 70, deviations: ["Oil sampling valve differs from STP item 7", "Test report format not IEC 60214"], technical: "Pass with deviations" },
  { vendorId: "VEN-TBD-0112", version: 1, bands: [69900, 68800, 66000], freight: 1200, dutyPct: 0, leadDays: 70, terms: "Net 30", quality: 45, deviations: ["Contact material not as specified"], technical: "Fail" },
]
export function RfqGrid() {
  const [stage, setStage] = useState<Stage>("Commercial")
  const [band, setBand] = useState(0)
  const [w, setW] = useState({ price: 40, delivery: 25, quality: 20, terms: 15 })
  const [ver, setVer] = useState<Record<string, number>>({})
  const sealed = stage === "Sealed"
  const showPrice = stage === "Commercial"
  const qtyAt = [1, 3, 6][band]
  const landed = (b: Bid) => b.bands[band] + (b.freight / qtyAt) + (b.bands[band] * b.dutyPct) / 100
  const rows = BIDS.map((b) => ({ b, v: VENDORS.find((x) => x.id === b.vendorId)!, landed: landed(b) }))
  const low = Math.min(...rows.filter((r) => r.b.technical !== "Fail").map((r) => r.landed))
  const sum = w.price + w.delivery + w.quality + w.terms || 1
  const score = (r: (typeof rows)[number]) => {
    const priceS = (low / r.landed) * 100
    const delS = Math.max(0, 100 - (r.b.leadDays - 70) * 1.5)
    const termS = r.b.terms === "Net 45" ? 100 : 80
    return (priceS * w.price + delS * w.delivery + r.b.quality * w.quality + termS * w.terms) / sum
  }
  const wInput = (k: keyof typeof w) => (
    <div className="grid gap-1">
      <Label htmlFor={`w-${k}`} className="text-xs capitalize">
        {k} weight
      </Label>
      <Input id={`w-${k}`} type="number" value={w[k]} onChange={(e) => setW({ ...w, [k]: Math.max(0, Number(e.target.value)) })} className="h-8 w-20" />
    </div>
  )
  return (
    <section aria-label="RFQ comparison" className="flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-4">
        <h3 className="text-sm font-semibold">RFQ-TBD-0301: tap changers, three vendors</h3>
        <ol aria-label="Stage" className="flex items-center gap-1 text-xs">
          {STAGES.map((s, i) => (
            <li key={s} aria-current={s === stage ? "step" : undefined} className={cn("rounded-md border px-2 py-1", s === stage ? "border-primary bg-primary font-semibold text-primary-foreground" : STAGES.indexOf(stage) > i ? "text-muted-foreground" : "")}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        <Button size="sm" variant="outline" disabled={stage === "Commercial"} onClick={() => setStage(STAGES[STAGES.indexOf(stage) + 1])}>
          {stage === "Sealed" ? "Close sealed window" : "Open commercial bids"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStage("Sealed")}>
          Reset to sealed
        </Button>
      </header>
      <p className="text-xs text-muted-foreground">{sealed ? "Sealed: bids are received and hidden. Nobody sees prices." : stage === "Technical" ? "Technical review first: Engineering passes or fails each bid before commercial bids are opened." : "Commercial: prices are open. Technical failures cannot be awarded."}</p>
      <div className="flex flex-wrap items-end gap-4">
        <div role="radiogroup" aria-label="Quantity band" className="inline-flex gap-1 rounded-md border p-1 text-xs">
          {BANDS.map((b, i) => (
            <button key={b} role="radio" aria-checked={band === i} onClick={() => setBand(i)} className={cn("h-6 rounded-md px-2", band === i && "bg-secondary font-semibold")}>
              Qty {b}
            </button>
          ))}
        </div>
        {wInput("price")}
        {wInput("delivery")}
        {wInput("quality")}
        {wInput("terms")}
        <Chip kind="design" note="Weights and scoring curves are not in the PRD">Scoring weights: design values</Chip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left">
            <tr>
              <th className="p-2">Criterion</th>
              {rows.map((r) => (
                <th key={r.b.vendorId} className="p-2">
                  {r.v.name}
                  <div className="flex items-center gap-1 text-xs font-normal">
                    <label htmlFor={`bv-${r.b.vendorId}`} className="sr-only">
                      Bid version
                    </label>
                    <select id={`bv-${r.b.vendorId}`} value={ver[r.b.vendorId] ?? r.b.version} onChange={(e) => setVer({ ...ver, [r.b.vendorId]: Number(e.target.value) })} className="h-6 rounded border bg-background px-1">
                      {Array.from({ length: r.b.version }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Bid V{n}
                        </option>
                      ))}
                    </select>
                    {(ver[r.b.vendorId] ?? r.b.version) < r.b.version && <span className="text-muted-foreground">superseded</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-2">Technical review</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="p-2">
                  {sealed ? <span className="text-muted-foreground">Sealed</span> : <FamilyBadge family={r.b.technical === "Pass" ? "done" : r.b.technical === "Fail" ? "blocked" : "pending"} label={r.b.technical} size="sm" />}
                </td>
              ))}
            </tr>
            <tr className="border-t">
              <td className="p-2">Unit price, qty {BANDS[band]}</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="tabular p-2">
                  {showPrice ? fmtMoney(r.b.bands[band]) : <span className="text-muted-foreground">Sealed</span>}
                </td>
              ))}
            </tr>
            <tr className="border-t">
              <td className="p-2">Landed cost per unit (price, freight spread, duty)</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className={cn("tabular p-2", showPrice && r.b.technical !== "Fail" && r.landed === low && "bg-status-passed-tint font-semibold")}>
                  {showPrice ? (
                    <>
                      {fmtMoney(r.landed)} {r.landed === low && r.b.technical !== "Fail" && <span className="ml-1 text-xs">Lowest</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sealed</span>
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-t">
              <td className="p-2">Lead time</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="tabular p-2">
                  {sealed ? <span className="text-muted-foreground">Sealed</span> : `${r.b.leadDays} days`}
                </td>
              ))}
            </tr>
            <tr className="border-t">
              <td className="p-2">Payment terms</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="p-2">
                  {showPrice ? r.b.terms : <span className="text-muted-foreground">Sealed</span>}
                </td>
              ))}
            </tr>
            <tr className="border-t font-semibold">
              <td className="p-2">Weighted score</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="tabular p-2">
                  {showPrice ? (r.b.technical === "Fail" ? <span className="font-normal text-muted-foreground">Not scored: technical fail</span> : score(r).toFixed(1)) : <span className="font-normal text-muted-foreground">Sealed</span>}
                </td>
              ))}
            </tr>
            <tr className="border-t align-top">
              <td className="p-2">Deviations from the STP</td>
              {rows.map((r) => (
                <td key={r.b.vendorId} className="p-2 text-xs">
                  {sealed ? <span className="text-muted-foreground">Sealed</span> : r.b.deviations.length === 0 ? "None" : <ul className="list-disc pl-4">{r.b.deviations.map((d) => <li key={d}>{d}</li>)}</ul>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" aria-hidden="true" /> RFQ is required above ${THRESHOLDS.rfqRequiredAbove.toLocaleString()} uncontracted spend. Award goes through the PO approval ladder.
      </p>
    </section>
  )
}
export type { Role }
