// QM-FIN-001 Final Test and FTR [DOC:p.265 Book VI; Book I E §3, §4, pp.86-87] (asserted).
// Transformer test catalog with capture templates per test, run history preserved, certified report
// generator. Record runs across sessions; Pass generates the FTR and fires the milestone
// "Production Complete / Tested"; Fail routes to rework with retest scope. Scan SP-14 binds
// instruments (calibration interlock E-QM-05). Arrives from orders at the Testing status.

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, ErrorAlert, KV, PostingPreview, RulesPanel, ScanField, StatusBadge, type Column, type ScanOutcome } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { fin as act, finOutcome } from "../data/actions"
import { charOutcome, fmtBounds } from "../data/derive"
import { instrumentStatus } from "../data/seed"
import type { FinalTest, QtCharacteristic, TestRun } from "../data/types"
import type { QualityTraceState } from "../data/slice"
import { ActivityList, DocLinkText, NoList, NotFound, Outcome, Pick, Reading, Section, Stat, customerName, materialText, report, useDataState, userName } from "../components/bits"
import { NcrDialog } from "./Inspections"

export const FIN_RULES: [string, string, string][] = [
  ["QM-F1", "Characteristics materialise from the FIN plan with the unit's design values as bounds: winding resistance within the design-sheet tolerance, turns ratio ±0.5%, no-load loss at most the guarantee +10% (single unit), %Z ±7.5% (two-winding). The numeric band used for winding resistance (±2%) is a reading, QT-R24.", "DOC:p.86 §3"],
  ["QM-F2", "A run may span sessions; partial save keeps it open. Every test referencing an instrument scans its CAL label (SP-14); Overdue or Out of Service blocks with E-QM-05.", "DOC:p.86 §3; p.96 SP-14"],
  ["QM-F3", "All characteristics pass: Final Result Pass, FTR-{YYYY}-{SEQ:4} generated and attached to serial, WO and shipment set; milestone Production Complete / Tested fires.", "DOC:p.87 §4"],
  ["QM-F4", "Any fail: NCR mandatory; WO stays Testing. Disposition Rework (RWO, retest of the failed scope), Engineering Review (ECR link) or Scrap, which needs the Controller and the Engineering Manager (two people) before the result is Fail. The WO stays Testing until Pass or the scrap approval.", "DOC:p.87 §4"],
  ["QM-F5", "Run history is preserved; nothing is overwritten. The Quality Manager countersigns the FTR; the tester cannot countersign their own.", "DOC:p.87 §4"],
]

type Q = "queue" | "fail" | "ftr" | "all"
const stage = (f: FinalTest) => {
  const last = f.runs[f.runs.length - 1]
  if (f.finalResult === "Pass") return "FTR issued"
  if (f.finalResult === "Fail") return "Scrapped"
  if (f.disposition === "Scrap") return "Scrap awaiting approval"
  if (!last) return "Queued"
  if (!last.outcome) return "Run open"
  return last.outcome === "Fail" ? "Failed, rework" : "Queued"
}

// ============================================================================ queue
export function FinalTestList() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-FIN-001")
  // orders that reached Testing arrive in the queue [DOC:p.87 §4]
  useEffect(() => {
    act.pullFromOrders()
  }, [])
  const [params, setParams] = useSearchParams()
  const q = (params.get("q") as Q) ?? "queue"
  const setQ = (v: Q) => (params.set("q", v), setParams(params, { replace: true }))
  const pick = (f: FinalTest) => (q === "all" ? true : q === "ftr" ? !!f.ftrId : q === "fail" ? stage(f) === "Failed, rework" || f.finalResult === "Fail" : !f.finalResult && stage(f) !== "Failed, rework")
  const rows = ds.empty ? [] : s.finalTests.filter(pick)
  const cols: Column<FinalTest>[] = [
    { id: "id", header: "Test record", value: (f) => f.id, mono: true, sortable: true, className: "w-32" },
    { id: "serial", header: "Serial", value: (f) => f.serial, mono: true },
    { id: "item", header: "Unit", value: (f) => f.nameplate.mva, cell: (f) => <span title={materialText(f.itemId)}>{f.nameplate.mva} · {f.nameplate.voltage}</span> },
    { id: "wo", header: "Production order", value: (f) => f.woId, cell: (f) => <DocLinkText r={{ type: "productionOrder", id: f.woId }} /> },
    { id: "wos", header: "WO status", value: (f) => f.woStatusText, filterable: true },
    { id: "so", header: "Sales order", value: (f) => f.soId || "Stock order", cell: (f) => (f.soId ? <DocLinkText r={{ type: "salesOrder", id: f.soId }} /> : <span className="text-muted-foreground">Stock order</span>) },
    { id: "cust", header: "Customer", value: (f) => customerName(f.customerId) || "Stock", filterable: true },
    { id: "prom", header: "Promised", value: (f) => f.promisedOn, sortable: true, mono: true, cell: (f) => <span className={cn(!f.finalResult && f.promisedOn < TODAY && "font-semibold text-destructive")}>{f.promisedOn}</span> },
    { id: "runs", header: "Runs", value: (f) => f.runs.length, align: "right", mono: true },
    { id: "stage", header: "Stage", value: stage, filterable: true },
    { id: "ftr", header: "FTR", value: (f) => f.ftrId ?? "", mono: true },
  ]
  const tabs: { id: Q; label: string; n: number }[] = [
    { id: "queue", label: "Testing queue", n: s.finalTests.filter((f) => !f.finalResult && stage(f) !== "Failed, rework").length },
    { id: "fail", label: "Failed / rework", n: s.finalTests.filter((f) => stage(f) === "Failed, rework" || f.finalResult === "Fail").length },
    { id: "ftr", label: "FTR issued", n: s.finalTests.filter((f) => f.ftrId).length },
    { id: "all", label: "All", n: s.finalTests.length },
  ]
  const awaitingCs = s.finalTests.filter((f) => f.ftrId && !f.qmCountersign).length
  return (
    <ListPage
      header={{ title: "Final Test and FTR", screenId: "QM-FIN-001", chips: <Reading id="QT-R21" />, description: "FQC gate: transformer routine tests per IEEE C57.12.90 against each unit's design values. Units arrive here when their production order reaches Testing." }}
      above={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Stat label="Units in test" value={tabs[0].n} />
            <Stat label="Failed, awaiting retest" value={tabs[1].n} tone="attention" />
            <Stat label="FTRs awaiting countersign" value={awaitingCs} />
            <Stat label="Overdue vs promise" value={s.finalTests.filter((f) => !f.finalResult && f.promisedOn < TODAY).length} />
          </div>
          <div role="tablist" aria-label="Final test queues" className="flex flex-wrap gap-1 border-b">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={q === t.id} onClick={() => setQ(t.id)} className={cn("h-8 border-b-2 px-3 text-sm", q === t.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                {t.label} <span className="tabular text-xs">{t.n}</span>
              </button>
            ))}
          </div>
        </div>
      }
      table={{
        rows,
        columns: cols,
        rowId: (f) => f.id,
        rowHref: (f) => `/quality/final-test/${f.id}`,
        searchText: (f) => `${f.id} ${f.serial} ${f.woId} ${f.soId} ${f.ftrId ?? ""} ${customerName(f.customerId)}`,
        searchPlaceholder: "Search serial, WO, SO, FTR",
        initialSort: { id: "prom", dir: "asc" },
        loading: ds.loading,
        error: ds.error,
        onRetry: ds.retry,
        empty: { title: "No units in this queue", body: "A unit appears when its production order reaches the Testing status at WC-500." },
      }}
      below={<RulesPanel rules={FIN_RULES} />}
    />
  )
}

// ============================================================================ detail
export function FinalTestDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-FIN-002")
  const [dlg, setDlg] = useState<null | "complete" | "ncr" | "dispose" | "countersign" | "scrap">(null)
  const f = s.finalTests.find((x) => x.id === id)
  if (ds.error) return <ErrorAlert title="Could not load the test record" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!f) return <NotFound what="final test record" id={id} back={{ to: "/quality/final-test", label: "Back to Final Test and FTR" }} />
  const ser = s.serials.find((x) => x.id === f.serial)
  const run = f.runs[f.runs.length - 1]
  const open = run && !run.outcome
  const failed = run?.outcome === "Fail" && !f.finalResult
  const primary = f.finalResult ? (
    f.ftrId && !f.qmCountersign ? <Button onClick={() => setDlg("countersign")}>Countersign {f.ftrId}</Button> : undefined
  ) : open ? (
    <Button onClick={() => setDlg("complete")}>Complete run {run.run}</Button>
  ) : failed && !f.ncrId ? (
    <Button onClick={() => setDlg("ncr")}>Create NCR (mandatory)</Button>
  ) : failed && f.disposition === "Scrap" ? (
    <Button onClick={() => setDlg("scrap")}>Approve scrap ({f.scrapApprovals?.length ?? 0} of 2)</Button>
  ) : failed && f.disposition !== "Rework" ? (
    <Button onClick={() => setDlg("dispose")}>Record disposition</Button>
  ) : (
    <Button onClick={() => report(act.startRun(f.id), `Run ${(run?.run ?? 0) + 1} started`)}>{failed ? `Start retest run ${run.run + 1}` : `Start run ${(run?.run ?? 0) + 1}`}</Button>
  )
  return (
    <>
      <DetailPage
        header={{
          title: `${f.id} · Final test ${f.serial}`,
          screenId: "QM-FIN-001",
          crumbs: [{ label: "Final Test and FTR", to: "/quality/final-test" }, { label: f.id }],
          description: `${materialText(f.itemId)} for ${customerName(f.customerId) || "stock"}. Plan ${f.planId} rev ${f.planRev}; WO ${f.woId} is ${f.woStatusText}.`,
          chips: (
            <>
              <NoList text={f.finalResult ? `Final result ${f.finalResult}` : open ? `Run ${run.run} open` : failed ? `Run ${run.run} failed` : "Awaiting run"} />
              {f.ftrId && <Chip kind="design" note="Final Test Report">{f.ftrId}</Chip>}
              {f.typeTestOrdered && <Chip kind="change" note="Temperature rise type test ordered">Type test ordered</Chip>}
            </>
          ),
          primary,
          actions: (
            <>
              {failed && f.ncrId && !f.scrapApprovals?.length && (
                <Button variant="outline" onClick={() => setDlg("dispose")}>
                  Change disposition
                </Button>
              )}
              {f.ftrId && (
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer aria-hidden="true" /> Print FTR
                </Button>
              )}
            </>
          ),
        }}
        status={ser ? { kind: "serial", value: ser.status } : undefined}
        doc={{ type: "inspectionLot", id: f.id }}
        summary={
          <>
            <KV k="Rating">{f.nameplate.mva}</KV>
            <KV k="Voltage">{f.nameplate.voltage}</KV>
            <KV k="Impedance / cooling">{`${f.nameplate.impedance} · ${f.nameplate.cooling}`}</KV>
            <KV k="Taps">{f.nameplate.taps}</KV>
            <KV k="Sales order">{f.soId ? <DocLinkText r={{ type: "salesOrder", id: f.soId }} /> : "Stock order (no customer yet)"}</KV>
            <KV k="Production order"><DocLinkText r={{ type: "productionOrder", id: f.woId }} /></KV>
            <KV k="Promised">{f.promisedOn}</KV>
            <KV k="FTR">{f.ftrId ? `${f.ftrId} · ${f.ftrIssuedOn}` : "Not issued"}</KV>
          </>
        }
        defaultTab={open || !f.runs.length || failed ? "run" : f.ftrId ? "ftr" : "catalog"}
        tabs={[
          { id: "run", label: open ? `Run ${run.run} capture` : "Capture", content: <Capture f={f} s={s} /> },
          { id: "catalog", label: "Test catalog", count: f.spec.length, content: <Catalog f={f} /> },
          { id: "history", label: "Run history", count: f.runs.length, content: <History f={f} s={s} /> },
          { id: "ftr", label: "FTR", content: <Ftr f={f} s={s} /> },
          { id: "activity", label: "Activity", content: <ActivityList items={f.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={FIN_RULES} /> },
        ]}
      />
      {run && (
        <DialogShell
          open={dlg === "complete"}
          onOpenChange={(o) => !o && setDlg(null)}
          title={`Complete run ${run.run} on ${f.serial}`}
          consequence={(() => {
            const o = finOutcome(f, run.run)
            if (!o.complete) return `Not every characteristic in scope is recorded (${o.results.filter((x) => !x.r).map((x) => x.c.seq).join(", ")}). Save partial results and come back in a later session.`
            return o.failed.length
              ? `Run ${run.run} closes as FAIL on ${o.failed.join(", ")}. An NCR is mandatory; WO ${f.woId} stays Testing; the retest covers only the failed scope.`
              : `Run ${run.run} closes as PASS. The FTR is generated and attached to ${f.serial}, ${f.woId} and the shipment set; the milestone Production Complete / Tested fires on ${f.soId}. T08 is written to the genealogy.`
          })()}
          confirmLabel="Complete run"
          onConfirm={() => {
            const r = act.completeRun(f.id)
            return report(r, (o) => (o === "Pass" ? "All pass: FTR issued, milestone fired" : "Run failed: create the NCR")) ? null : (r as { error: string }).error
          }}
        >
          <p className="text-xs text-muted-foreground">
            FTR timing and countersign order are a reading <Reading id="QT-R10" />
          </p>
        </DialogShell>
      )}
      <NcrDialog sourceId={f.id} open={dlg === "ncr"} onClose={() => setDlg(null)} defaults={{ title: `${run ? finOutcome(f, run.run).failed.map((n) => f.spec.find((c) => c.seq === n)?.name).join(", ") : "Final test"} fail on ${f.serial}`, attributable: "Production" }} />
      <DisposeDialog f={f} open={dlg === "dispose"} onClose={() => setDlg(null)} />
      <DialogShell
        open={dlg === "scrap"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Approve scrap of ${f.serial}`}
        consequence={`Records your approval as ${f.scrapApprovals?.some((a) => a.role === "Controller") ? "the Engineering Manager" : "the Controller or the Engineering Manager"}. Final result becomes Fail only when both have approved (two different people); production then posts the scrap on confirmation (#30).`}
        confirmLabel="Approve scrap"
        destructive
        onConfirm={() => {
          const r = act.approveScrap(f.id)
          return report(r, "Scrap approval recorded") ? null : (r as { error: string }).error
        }}
      >
        <ul className="text-sm">
          {(f.scrapApprovals ?? []).map((a) => (
            <li key={a.role}>{a.role}: {userName(a.by)} · {a.on}</li>
          ))}
          {!f.scrapApprovals?.length && <li className="text-muted-foreground">No approval yet. Needs the Controller and the Engineering Manager.</li>}
        </ul>
        <p className="text-xs text-muted-foreground">
          Recorded on this screen <Reading id="QT-R18" />
        </p>
      </DialogShell>
      <DialogShell
        open={dlg === "countersign"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Countersign ${f.ftrId}`}
        consequence={`Adds the Quality Manager countersignature to ${f.ftrId}. The tester (${userName(f.testerSigned)}) cannot countersign their own report.`}
        confirmLabel="Countersign"
        onConfirm={() => {
          const r = act.countersign(f.id)
          return report(r, "Countersigned") ? null : (r as { error: string }).error
        }}
      />
    </>
  )
}

function Catalog({ f }: { f: FinalTest }) {
  return (
    <div className="flex flex-col gap-2">
    <p className="text-xs text-muted-foreground">
      Bounds follow the design sheet and the specification (turns ratio ±0.5%, loss +10%, %Z ±7.5%). The winding-resistance band and the bands on excitation current and the 110% V and load-loss rows are design values <Reading id="QT-R24" />.
    </p>
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Test</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Capture template</TableHead>
          <TableHead>Design value</TableHead>
          <TableHead>Tolerance band</TableHead>
          <TableHead>Instrument class</TableHead>
          <TableHead>Critical</TableHead>
          {f.runs.map((r) => (
            <TableHead key={r.run}>Run {r.run}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {f.spec.map((c) => (
          <TableRow key={c.seq}>
            <TableCell className="tabular">{c.seq}</TableCell>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-muted-foreground">{c.method}</TableCell>
            <TableCell className="text-muted-foreground">{c.parameter}</TableCell>
            <TableCell className="tabular">{c.target != null ? `${c.target} ${c.uom ?? ""}` : ""}</TableCell>
            <TableCell className="tabular">{fmtBounds(c)}</TableCell>
            <TableCell>{c.instrumentClass ?? ""}</TableCell>
            <TableCell>{c.critical ? "Yes" : "No"}</TableCell>
            {f.runs.map((r) => {
              const res = r.results.find((x) => x.seq === c.seq)
              return (
                <TableCell key={r.run} className="tabular">
                  {res ? (
                    <span className="inline-flex items-center gap-1">
                      {res.value ?? res.attr}
                      <Outcome value={charOutcome(c, res)} />
                    </span>
                  ) : r.retestScope && !r.retestScope.includes(c.seq) ? (
                    <span className="text-muted-foreground">not in scope</span>
                  ) : (
                    ""
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}

function Capture({ f, s }: { f: FinalTest; s: QualityTraceState }) {
  const run = f.runs[f.runs.length - 1]
  const open = run && !run.outcome
  if (f.finalResult) return <p className="text-sm">Final result {f.finalResult}. Run history is preserved under Run history; nothing can be captured on a decided unit.</p>
  if (!open)
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>{run ? `Run ${run.run} closed as ${run.outcome}.` : "No run yet."} {run?.outcome === "Fail" ? (f.disposition === "Rework" ? `Rework ${f.rwoId ?? "requested from Production planning"} is open; start the retest run when the unit is back at WC-500 (scope: ${finOutcome(f, run.run).failed.join(", ")}).` : f.disposition === "Scrap" ? `Scrap is awaiting the Controller and the Engineering Manager (${f.scrapApprovals?.length ?? 0} of 2).` : f.disposition === "Engineering Review" ? `Engineering Review ${f.ecrId ? `linked to ${f.ecrId}` : "requested: ECR to follow"}; no retest until the review returns.` : "Create the NCR and record the disposition before a retest.") : "Start a run to capture results."}</p>
        {f.ncrId && <p>NCR: <DocLinkText r={{ type: "ncr", id: f.ncrId }} />{f.rwoId && <> · Rework order: <DocLinkText r={{ type: "reworkOrder", id: f.rwoId }} /></>}</p>}
      </div>
    )
  const scope = finOutcome(f, run.run).scope
  const bind = (code: string): ScanOutcome => {
    const r = act.bindInstrument(f.id, code)
    return r.ok ? { ok: true, message: `${r.value?.label} ${r.value?.type} bound to run ${run.run}.` } : { ok: false, errorCode: r.error.includes("E-QM-05") ? "E-QM-05" : undefined, expected: "the CAL label of a calibrated instrument", next: "Use another instrument of the same class or have it calibrated (QM-CAL-001).", message: r.error }
  }
  const neededClasses = [...new Set(f.spec.filter((c) => scope.includes(c.seq) && c.instrumentClass).map((c) => c.instrumentClass!))]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="SP-14 instrument binding">
          <ScanField scanPoint="SP-14" expected="Scan each instrument's CAL label" onScan={bind} label="Instrument CAL label" />
          <ul className="flex flex-col gap-1 text-sm">
            {neededClasses.map((cls) => {
              const bound = run.instruments.map((i) => s.instruments.find((x) => x.id === i)!).find((i) => i.type === cls)
              const cands = s.instruments.filter((i) => i.type === cls)
              return (
                <li key={cls} className="flex flex-wrap items-center gap-2">
                  <span className="w-28 font-medium">{cls}</span>
                  {bound ? (
                    <>
                      {bound.label} <StatusBadge kind="instrument" status={instrumentStatus(bound, TODAY)} size="sm" />
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      not bound · available: {cands.map((c) => `${c.label} (${instrumentStatus(c, TODAY)})`).join(", ") || "none"}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>
        <Section title={`Run ${run.run}`}>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <KV k="Sessions">{run.sessions.join(", ")}</KV>
            <KV k="Tester">{userName(run.testerId)}</KV>
            <KV k="Ambient">{run.ambient}</KV>
            <KV k="Scope">{run.retestScope ? `Retest of ${run.retestScope.join(", ")}` : "Full routine set"}</KV>
          </dl>
          <p className="text-xs text-muted-foreground">Each Save is a partial save; the run stays open across sessions until you complete it.</p>
        </Section>
      </div>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Test</TableHead>
            <TableHead>Tolerance</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="w-20"><span className="sr-only">Save</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {f.spec.filter((c) => scope.includes(c.seq)).map((c) => (
            <CaptureRow key={`${run.run}-${c.seq}`} f={f} run={run} c={c} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CaptureRow({ f, run, c }: { f: FinalTest; run: TestRun; c: QtCharacteristic }) {
  const r = run.results.find((x) => x.seq === c.seq)
  const [val, setVal] = useState(r?.value?.toString() ?? "")
  const [attr, setAttr] = useState<"Pass" | "Fail" | "">(r?.attr === "NA" ? "" : (r?.attr ?? ""))
  const out = charOutcome(c, r)
  return (
    <TableRow className={cn(out === "Fail" && "bg-destructive/5")}>
      <TableCell className="tabular">{c.seq}</TableCell>
      <TableCell className="font-medium">
        {c.name} <span className="block text-xs text-muted-foreground">{c.parameter}</span>
      </TableCell>
      <TableCell className="tabular">{fmtBounds(c)}</TableCell>
      <TableCell>
        {c.charType === "Quantitative" ? (
          <span className="inline-flex items-center gap-1">
            <Input aria-label={`Value for ${c.name}`} className="h-8 w-28" type="number" value={val} onChange={(e) => setVal(e.target.value)} />
            <span className="text-xs text-muted-foreground">{c.uom}</span>
          </span>
        ) : (
          <Pick id={`fa-${c.seq}`} placeholder="Pass / Fail" value={attr} onChange={setAttr} options={["Pass", "Fail"] as ("Pass" | "Fail")[]} />
        )}
      </TableCell>
      <TableCell>
        <Outcome value={out} />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" onClick={() => report(act.record(f.id, c.seq, c.charType === "Quantitative" ? { value: val.trim() === "" ? undefined : Number(val) } : { attr: attr || undefined }), `${c.name} saved`)}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  )
}

function History({ f, s }: { f: FinalTest; s: QualityTraceState }) {
  if (!f.runs.length) return <p className="text-sm text-muted-foreground">No runs yet.</p>
  return (
    <div className="flex flex-col gap-4">
      {[...f.runs].reverse().map((r) => (
        <Section key={r.run} title={`Run ${r.run} · ${r.outcome ?? "open"}${r.retestScope ? ` · retest scope ${r.retestScope.join(", ")}` : ""}`}>
          <p className="text-sm text-muted-foreground">
            Sessions {r.sessions.join(", ")} · tester {userName(r.testerId)} · {r.ambient} · instruments {r.instruments.map((i) => s.instruments.find((x) => x.id === i)?.label).join(", ") || "none"}
          </p>
          <Table>
            <TableBody>
              {r.results.map((res) => {
                const c = f.spec.find((x) => x.seq === res.seq)!
                return (
                  <TableRow key={res.seq}>
                    <TableCell className="tabular w-10">{res.seq}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="tabular">{res.value != null ? `${res.value} ${c.uom ?? ""}` : res.attr}</TableCell>
                    <TableCell className="tabular">{fmtBounds(c)}</TableCell>
                    <TableCell><Outcome value={charOutcome(c, res)} /></TableCell>
                    <TableCell className="tabular text-muted-foreground">{res.at}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Section>
      ))}
    </div>
  )
}

function Ftr({ f, s }: { f: FinalTest; s: QualityTraceState }) {
  if (!f.ftrId) return <p className="text-sm text-muted-foreground">The FTR is generated when a run completes with every characteristic passed.</p>
  const pass = [...f.runs].reverse().find((r) => r.outcome === "Pass")!
  const ins = [...new Set(f.runs.flatMap((r) => r.instruments))].map((i) => s.instruments.find((x) => x.id === i)!)
  return (
    <article aria-label={`Final Test Report ${f.ftrId}`} className="flex max-w-[960px] flex-col gap-4 rounded-lg border p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
        <h2 className="text-lg font-semibold">Final Test Report {f.ftrId}</h2>
        <span className="text-sm text-muted-foreground">Issued {f.ftrIssuedOn} · plan {f.planId} rev {f.planRev}</span>
      </header>
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KV k="Serial">{f.serial}</KV>
        <KV k="Rating">{f.nameplate.mva}</KV>
        <KV k="Voltage">{f.nameplate.voltage}</KV>
        <KV k="Customer">{customerName(f.customerId)}</KV>
        <KV k="Sales order">{f.soId}</KV>
        <KV k="Production order">{f.woId}</KV>
        <KV k="Final result">Pass</KV>
        <KV k="Runs">{f.runs.length}</KV>
      </dl>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Test</TableHead>
            <TableHead>Guarantee / limit</TableHead>
            <TableHead>Measured</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {f.spec.map((c) => {
            const res = [...f.runs].reverse().map((r) => r.results.find((x) => x.seq === c.seq)).find(Boolean)
            return (
              <TableRow key={c.seq}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="tabular">{fmtBounds(c)}</TableCell>
                <TableCell className="tabular">{res?.value != null ? `${res.value} ${c.uom ?? ""}` : res?.attr}</TableCell>
                <TableCell><Outcome value={charOutcome(c, res)} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">Instruments (calibration due): {ins.map((i) => `${i.label} ${i.type} (${i.dueOn})`).join("; ")}</p>
      <footer className="grid grid-cols-2 gap-4 border-t pt-2 text-sm">
        <span>Tested by {userName(f.testerSigned ?? pass.testerId)} · {f.ftrIssuedOn}</span>
        <span>{f.qmCountersign ? `Countersigned by ${userName(f.qmCountersign.by)} · ${f.qmCountersign.on}` : "Awaiting Quality Manager countersign"}</span>
      </footer>
      <p className="text-xs text-muted-foreground">
        Attached to {f.serial}, <DocLinkText r={{ type: "productionOrder", id: f.woId }} /> and the shipment set of {f.soId}.
      </p>
    </article>
  )
}

function DisposeDialog({ f, open, onClose }: { f: FinalTest; open: boolean; onClose: () => void }) {
  const [d, setD] = useState<NonNullable<FinalTest["disposition"]>>("Rework")
  const [ecr, setEcr] = useState("")
  const ecrs = useSlice("engineering").ecrs
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Disposition of failed test on ${f.serial}`}
      consequence={
        d === "Rework"
          ? `Asks Production planning for a rework order against ${f.ncrId} (the number arrives when it drafts the RWO); the retest covers only the failed characteristics.`
          : d === "Scrap"
            ? `Starts the scrap approval: the Controller and the Engineering Manager both approve before the final result is Fail and the unit is scrapped. Production then posts the scrap on confirmation (#30).`
            : ecr
              ? `Links the unit to ${ecr} and holds it for an engineering review; no retest until it returns.`
              : "Requests an ECR from Engineering for the design values and holds the unit; no retest until the review returns."
      }
      confirmLabel="Record disposition"
      wide
      requireReason
      destructive={d === "Scrap"}
      onConfirm={(reason) => {
        const r = act.dispose(f.id, d, reason, { ecrId: ecr })
        return report(r, `Disposition ${d}`) ? null : (r as { error: string }).error
      }}
    >
      <Pick id="fin-disp" label="Disposition" value={d} onChange={setD} options={["Rework", "Engineering Review", "Scrap"] as NonNullable<FinalTest["disposition"]>[]} />
      {d === "Engineering Review" && (
        <Pick id="fin-ecr" label="ECR link (optional)" value={ecr || undefined} onChange={setEcr} placeholder="Request a new ECR" options={ecrs.map((e) => ({ value: e.id, label: `${e.id} · ${e.title}` }))} />
      )}
      {d === "Scrap" && (
        <>
          <PostingPreview lines={[{ template: 30, amount: null, notPostedReason: "Posted by production when the scrap quantity is confirmed", detail: `${f.woId} ${f.serial}` }]} title="Posting downstream" />
          <p className="text-xs text-muted-foreground">
            Dual sign-off (Controller + Engineering Manager) recorded here <Reading id="QT-R18" />
          </p>
        </>
      )}
    </DialogShell>
  )
}
