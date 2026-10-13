// FX-INV-PCLOSE Period-close checklist additions: steps 5b, 6b, 6c, 6d, 6e, 9b and the inventory
// tie-out by valuation class. "The ACC 26.2 twelve-step checklist gains these operational sub-steps
// (auto-validated like the rest)" [DOC: Book I Part J]; "MM adds by-valuation-class tie-out (MM §13)"
// [DOC: Book III FL-06 field 12]; failed steps hold the gate, never silently pass (field 10); executor
// is not approver where flagged, reopen is dual control (field 13) (asserted). The other steps of the
// ACC 26.2 checklist belong to ACC (ASM-EXT-1) and are not shown. Hard Close itself is pressed in
// period configuration (admin).
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { CircleCheck, CircleX, Minus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, PostingPreview, RulesPanel } from "@/components/patterns"
import { INVENTORY_LABEL } from "../lib/labels"
import { LEGAL_ENTITIES } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { L, Reading, userName } from "../components/bits"
import { useViewState } from "../components/states"
import { closeKey, evaluateClose, fmtUsd, type StepResult } from "../lib/close"
import * as A from "../data/actions"

const RESULT_ICON: Record<StepResult, typeof Clock> = { Passed: CircleCheck, Held: CircleX, "Not run": Clock, "Not applicable": Minus }

export function PeriodClose() {
  const admin = useSlice("admin")
  const materials = useSlice("materials")
  const pf = useSlice("purchasingFinance")
  const pp = useSlice("planningProduction")
  const sales = useSlice("sales")
  const io = useSlice("inventoryOps")
  const [entityId, setEntityId] = useState<string>("LE-TBD-10")
  const [month, setMonth] = useState("2026-09")
  const [err, setErr] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | { sign: string } | "topup" | { explain: string }>(null)
  const periods = admin.periods.filter((p) => p.entityId === entityId && p.month >= "2026-07" && p.month <= "2026-10").sort((a, b) => b.month.localeCompare(a.month))
  const period = admin.periods.find((p) => p.entityId === entityId && p.month === month)
  const closed = period?.status === "Hard Close" || period?.status === "Year-End Closed"
  const ss = useViewState("FX-INV-PCLOSE", { degradedWhat: "The ACC checklist read API is slow, so steps may show the last result", authorizedRoles: ["Controller", "CFO", "Cost accountant", "Controlling analyst"], terminalRecord: closed })

  if (ss.loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader title="Period close checklist" screenId="FX-INV-PCLOSE" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full max-w-[1100px]" />
      </div>
    )

  const view = period && !ss.empty ? evaluateClose(entityId, month, { admin, materials, pf, pp, sales, io }) : undefined
  const key = closeKey(entityId, month)
  const ran = io.closeRuns.find((r) => r.key === key)
  const entityName = LEGAL_ENTITIES.find((e) => e.id === entityId)?.name
  const writable = ss.canWrite && !closed && !ss.degraded
  const why = ss.blockedWhy ?? (closed ? "The period is Hard Closed: it opens read-only" : ss.degraded ? "The checklist read API is degraded" : undefined)
  const unresolvedTie = view?.tie.filter((r) => r.open).length ?? 0

  const run = <T,>(r: { ok: true; value: T } | { ok: false; error: string }, msg: string | ((v: T) => string)) => {
    if (!r.ok) {
      setErr(r.error)
      toast.error(r.error)
      return false
    }
    setErr(null)
    toast.success(typeof msg === "function" ? msg(r.value) : msg)
    return true
  }

  const report = () => {
    if (!view) return
    const lines = [
      `Close report: ${entityName}, ${month} (${period?.status})`,
      `Validated: ${ran ? `${ran.at.replace("T", " ")} by ${userName(ran.by)}` : "not run"}`,
      `Unresolved items: ${view.unresolved}`,
      "",
      ...view.steps.map((s) => `${s.id}\t${s.label}\t${s.result}\t${s.detail}${s.signoff ? `\tsigned off by ${userName(s.signoff.by)}` : ""}`),
      "",
      "Inventory tie-out by valuation class (subledger / GL / difference)",
      ...view.tie.map((r) => `${r.vc} ${r.label}\t${r.account}\t${r.subledger}\t${r.gl}\t${r.diff}`),
    ]
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `close-report-${entityId}-${month}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Close report downloaded")
  }

  const header = {
    title: "Period close checklist",
    screenId: "FX-INV-PCLOSE",
    description: "The operational steps the PRD adds to the ACC 26.2 close checklist: 5b allocations, 6b inventory period closed, 6c WIP, 6d production orders settled, 6e RMA aging, 9b warranty reserve, and the inventory tie-out by valuation class. Each step reads its owner's report; a held step holds the gate.",
    crumbs: [{ label: "Period close" }],
    actions: (
      <>
        {ss.toolbar}
        <Button variant="outline" onClick={report} disabled={!view}>Download close report</Button>
        <Button variant="outline" asChild><Link to="/inventory/configuration/fiscal-periods">Period configuration</Link></Button>
      </>
    ),
    primary: <Button disabled={!view || !writable} title={why} onClick={() => run(A.runCloseValidation(entityId, month), (v) => `Validated: ${v.held} of ${v.steps} step(s) held`)}>{ran ? "Re-run validation" : "Run validation"}</Button>,
    children: (
      <div className="flex flex-col gap-2">
        {ss.banners}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pc-entity">Legal entity</Label>
            <Select value={entityId} onValueChange={(v) => { setEntityId(v); setErr(null) }}>
              <SelectTrigger id="pc-entity" size="sm" className="h-8 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{LEGAL_ENTITIES.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pc-month">Fiscal period</Label>
            <Select value={month} onValueChange={(v) => { setMonth(v); setErr(null) }}>
              <SelectTrigger id="pc-month" size="sm" className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.month}>{p.month} ({p.status})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
    ),
  }

  if (!period || !view)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} primary={undefined} />
        {ss.error ? <ErrorAlert title="The checklist could not be loaded" action={<button className="underline" onClick={ss.onRetry}>Try again</button>}>{ss.error}</ErrorAlert> : <EmptyState title="No close checklist yet">{period ? "Nothing to show for this period." : `${entityName} has no period record for ${month}.`}</EmptyState>}
      </div>
    )

  const step = (id: string) => view.steps.find((s) => s.id === id)!
  const shortfall = view.warranty?.shortfall ?? 0

  const checklist = (
    <div className="flex flex-col gap-3">
      {err && <ErrorAlert title="That did not go through" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
        {view.unresolved === 0 ? <CircleCheck className="size-4" aria-hidden="true" /> : <CircleX className="size-4 text-destructive" aria-hidden="true" />}
        <span className="font-medium">{view.unresolved === 0 ? "Zero unresolved items: ready for Hard Close." : `${view.unresolved} unresolved item(s) hold the gate to Hard Close.`}</span>
        <span className="text-muted-foreground">{ran ? `Last validated ${ran.at.replace("T", " ")} by ${userName(ran.by)}.` : "Not validated yet for this period: run the validation."} Hard Close is pressed by the Controller in period configuration.</span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <caption className="sr-only">Close checklist additions for {entityName}, {month}</caption>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead className="w-12">Step</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Validation (PRD)</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>What the report says</TableHead>
              <TableHead className="min-w-44">Sign-off and actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.steps.map((s) => {
              const Icon = RESULT_ICON[s.result]
              return (
                <TableRow key={s.id} className="align-top text-[13px]">
                  <TableCell className="font-mono font-semibold">{s.id}{!s.addition && <div className="text-xs font-normal text-muted-foreground">FL-06</div>}</TableCell>
                  <TableCell className="font-medium">{s.label}{s.flagged && <> <Reading id="RD-IO-15" /></>}</TableCell>
                  <TableCell className="text-muted-foreground">{s.validation}</TableCell>
                  <TableCell><span className={s.result === "Held" ? "inline-flex items-center gap-1 font-medium text-destructive" : "inline-flex items-center gap-1"}><Icon className="size-4" aria-hidden="true" />{s.result}</span></TableCell>
                  <TableCell>{s.detail}{s.link && <div><L to={s.link.to}>{s.link.label}</L></div>}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {s.flagged && s.signoff && <span>Signed off by {userName(s.signoff.by)}{s.signoff.note ? `: ${s.signoff.note}` : ""}</span>}
                      {s.flagged && !s.signoff && s.result === "Passed" && <Button size="sm" variant="outline" disabled={!writable} title={why} onClick={() => (setErr(null), setDlg({ sign: s.id }))}>Sign off</Button>}
                      {s.flagged && !s.signoff && s.result !== "Passed" && <span className="text-muted-foreground">Sign-off after the step passes</span>}
                      {s.id === "9b" && shortfall > 0 && <Button size="sm" disabled={!writable} title={why} onClick={() => (setErr(null), setDlg("topup"))}>Post top-up (#24)</Button>}
                      {s.executor && <span className="text-xs text-muted-foreground">Executed by {userName(s.executor)}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  const tie = (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-sm text-muted-foreground">The inventory subledger by valuation class must tie to the 13xx accounts at every close, so a mapping error shows as a class-level difference, not a plug [DOC: Book II §13]. The subledger is live stock value (own stock at the valuation rate); the GL side is a design value that equals it except where a difference is seeded. <Reading id="RD-IO-12" /></p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <caption className="sr-only">Inventory tie-out by valuation class</caption>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Valuation class</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Subledger</TableHead>
              <TableHead className="text-right">GL</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Explanation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.tie.map((r) => (
              <TableRow key={r.vc} className="align-top text-[13px]">
                <TableCell className="font-medium">{r.vc} {r.label}</TableCell>
                <TableCell className="font-mono">{r.account}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.subledger)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.gl)}</TableCell>
                <TableCell className={r.open ? "tabular text-right font-semibold text-destructive" : "tabular text-right"}>{r.diff === 0 ? fmtMoney(0) : `${r.diff > 0 ? "+" : ""}${fmtMoney(r.diff)}`}</TableCell>
                <TableCell>
                  {r.diffs.map((d, i) => (
                    <div key={i} className="mb-1">
                      <span>{d.cause}</span>
                      {d.resolvedAt ? <div className="text-muted-foreground">Explained by {userName(d.resolvedBy)}: {d.resolution}</div> : <div><Chip kind="block">Unexplained</Chip></div>}
                    </div>
                  ))}
                  {r.open && <Button size="sm" variant="outline" disabled={!writable} title={why} onClick={() => (setErr(null), setDlg({ explain: r.vc }))}>Explain</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="text-[13px]">
              <TableCell colSpan={2}>Total own stock (1310, 1330, 1340, 1360)</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(view.tie.reduce((a, r) => a + r.subledger, 0))}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(view.tie.reduce((a, r) => a + r.gl, 0))}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(view.tie.reduce((a, r) => a + r.diff, 0))}</TableCell>
              <TableCell>{unresolvedTie ? `${unresolvedTie} class(es) unexplained` : "All classes tie or are explained"}</TableCell>
            </TableRow>
            <TableRow className="text-[13px]"><TableCell colSpan={2}>In transit (1350), not compared by class</TableCell><TableCell className="tabular text-right">{fmtMoney(view.inTransit)}</TableCell><TableCell colSpan={3} /></TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )

  const history = (
    <div className="flex max-w-3xl flex-col gap-4 text-sm">
      <section aria-label="Validation runs">
        <h3 className="mb-1 font-semibold">Validation runs</h3>
        {io.closeRuns.filter((r) => r.key === key).length ? io.closeRuns.filter((r) => r.key === key).map((r) => <p key={r.at}>{r.at.replace("T", " ")} by {userName(r.by)}</p>) : <p className="text-muted-foreground">Not run for this period.</p>}
      </section>
      <section aria-label="Sign-offs">
        <h3 className="mb-1 font-semibold">Sign-offs</h3>
        {view.steps.filter((s) => s.signoff).length ? view.steps.filter((s) => s.signoff).map((s) => <p key={s.id}>Step {s.id} {s.signoff!.at.replace("T", " ")} by {userName(s.signoff!.by)}{s.signoff!.note ? `: ${s.signoff!.note}` : ""}</p>) : <p className="text-muted-foreground">None yet.</p>}
      </section>
      <section aria-label="Period history">
        <h3 className="mb-1 font-semibold">Period record</h3>
        {period.history.map((h, i) => <p key={i}>{h.at.replace("T", " ")} {h.from} to {h.to} by {userName(h.by)}{h.note ? ` (${h.note})` : ""}</p>)}
      </section>
    </div>
  )

  return (
    <>
      <DetailPage
        header={header}
        status={{ kind: "fiscalPeriod", value: period.status }}
        summary={
          <>
            <KV k="Entity">{entityName}</KV>
            <KV k="Fiscal period">{month}</KV>
            <KV k="Inventory period (INV 8.3)">{INVENTORY_LABEL[period.status]}</KV>
            <KV k="Unresolved items">{view.unresolved}</KV>
          </>
        }
        tabs={[
          { id: "steps", label: "Checklist additions", content: checklist, count: view.steps.length },
          { id: "tie", label: "Inventory tie-out", content: tie, count: view.tie.length },
          { id: "history", label: "Runs and sign-offs", content: history },
        ]}
      />
      <RulesPanel
        rules={[
          ["5b", "All active allocation cycles have a posted run for the period.", "[DOC: Book I Part J]"],
          ["6b", "Inventory period closed: INV 8.3 status = Closed for the period (Open / Closing / Closed map to Open / Soft Close / Hard Close).", "[DOC:p.41 §9.1]"],
          ["6c", "WIP reconciliation: the sum of open WO WIP equals GL 1320 + 1325 balances.", "[DOC: Book I Part J]"],
          ["6d", "No WO in Completed status older than 5 days unsettled.", "[DOC: Book I Part J]"],
          ["6e", "RMA aging review: no RMA in Settling with posted-document gaps.", "[DOC: Book I Part J]"],
          ["9b", "Warranty reserve adequacy: reserve balance vs open warranty RWO exposure; a top-up JE is proposed (#24, DR 6300 / CR 2610).", "[DOC: Book I Part J]"],
          ["§13", "The inventory subledger by valuation class ties to the 13xx accounts at every close.", "[DOC: Book II §13]"],
          ["FL-06", "Failed steps hold the gate and never pass silently; executor is not approver where flagged; Hard Close needs zero unresolved items and an archived close report.", "[DOC:pp.180-181 FL-06 f9-f13]"],
        ]}
      />
      <DialogShell
        open={typeof dlg === "object" && !!dlg && "sign" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Sign off step ${typeof dlg === "object" && dlg && "sign" in dlg ? dlg.sign : ""}`}
        consequence={`Records your approval of step ${typeof dlg === "object" && dlg && "sign" in dlg ? dlg.sign : ""} for ${entityName}, ${month}. The person who executed the step cannot approve it (FL-06 field 13).`}
        confirmLabel="Sign off"
        onConfirm={() => {
          if (typeof dlg !== "object" || !dlg || !("sign" in dlg)) return null
          const r = A.signOffStep(entityId, month, dlg.sign, "")
          if (!r.ok) return r.error
          toast.success(`Step ${dlg.sign} signed off`)
          return null
        }}
      />
      <DialogShell
        open={dlg === "topup"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Post the warranty reserve top-up for ${month}`}
        consequence={`Posts template #24 for ${fmtUsd(shortfall)}: the open warranty exposure ${fmtUsd(view.warranty?.exposure ?? 0)} less the reserve ${fmtUsd(view.warranty?.reserve ?? 0)}. A different person signs off step 9b.`}
        confirmLabel="Post top-up"
        onConfirm={() => {
          const r = A.postWarrantyTopUp(entityId, month)
          if (!r.ok) return r.error
          toast.success(`${r.value.je} posted: ${fmtUsd(r.value.amount)}`)
          return null
        }}
      >
        <PostingPreview lines={[{ template: 24, amount: shortfall, detail: `Reserve ${fmtUsd(view.warranty?.reserve ?? 0)} vs open warranty RWO exposure ${fmtUsd(view.warranty?.exposure ?? 0)}` }]} />
      </DialogShell>
      <DialogShell
        open={typeof dlg === "object" && !!dlg && "explain" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Explain the ${typeof dlg === "object" && dlg && "explain" in dlg ? dlg.explain : ""} difference`}
        consequence="Records the explanation and the correcting action for the class. The close gate clears when every class ties or is explained."
        confirmLabel="Record explanation"
        requireReason
        reasonLabel="Explanation and correcting action (required)"
        onConfirm={(reason) => {
          if (typeof dlg !== "object" || !dlg || !("explain" in dlg)) return null
          const r = A.explainTieDiff(entityId, month, dlg.explain, reason)
          if (!r.ok) return r.error
          toast.success(`${dlg.explain} explained`)
          return null
        }}
      />
      {step("6b").result === "Held" && !closed && <span className="sr-only">Step 6b is held</span>}
    </>
  )
}
