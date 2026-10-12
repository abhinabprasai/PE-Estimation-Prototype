// QM-EXEC Inspection Execution [DOC:p.264 Book VI; Book I E §1 gates, INV 6.1 pattern] (asserted).
// Per gate queues (IQC / IPQC / OQC / RQC; FQC is QM-FIN-001) and the inspection detail:
// characteristics from the plan with pass and fail colouring, instrument fields validated against
// calibration, sample instructions, attachment slot. Actions: record results, accept or reject with
// disposition routing, create NCR. Stock status moves per gate. Scans SP-05 (sample pull) and SP-14
// (instrument binding). The route /quality/inspections/:id is a design value (registry).

import { useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, ErrorAlert, KV, RulesPanel, ScanField, StatusBadge, type Column, type ScanOutcome } from "@/components/patterns"
import { docRoute } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { createNcr, lots as act } from "../data/actions"
import { charOutcome, fmtBounds, lotAge, lotChars, lotOverdue } from "../data/derive"
import { instrumentStatus } from "../data/seed"
import { GATES, type Decision, type Disposition, type InspectionLot, type QtCharacteristic, type QtNcr } from "../data/types"
import type { QualityTraceState } from "../data/slice"
import { ActivityList, DocLinkText, NoList, NotFound, Outcome, Pick, Reading, Section, Stat, TextField, materialText, report, useDataState, userName, vendorName } from "../components/bits"

export const EXEC_RULES: [string, string, string][] = [
  ["QM-E1", "IQC: pass moves QI Hold → Unrestricted; fail moves the batch to Blocked with an NCR / return-to-vendor / scrap disposition and a vendor rating hit.", "DOC:p.84 E §1"],
  ["QM-E2", "IPQC: the operation may complete only after a pass; a fail blocks the operation (rework / NCR; Emergency ECR for design causes).", "DOC:p.84 E §1"],
  ["QM-E3", "OQC: a pass generates the CoC and enables PGI; a fail blocks the shipment and needs an NCR.", "DOC:p.84 E §1"],
  ["QM-E4", "R-QM-02: a fail on a critical characteristic rejects the whole inspection.", "DOC:p.34 §6.3"],
  ["QM-E5", "SP-05 sample pull scans the batch and the inspector badge and validates QI Hold. SP-14 binds instruments; an Overdue or Out of Service instrument blocks with E-QM-05.", "DOC:pp.95-96 Part F"],
  ["QM-E6", "Vendor test certificate upload is mandatory before Accept where the plan requires it. The inspector may only increase the sample size.", "DOC:p.34 §6.3"],
  ["QM-E7", "No-plan policy Manual Inspection: ad-hoc rows; Quality Manager sign-off is mandatory.", "DOC:p.35 §6.5"],
]

type Queue = "IQC" | "IPQC" | "OQC" | "RQC" | "decided" | "all"
const stateText = (l: InspectionLot) => l.decision ?? "Open"
const subjectText = (l: InspectionLot) => l.batchId ?? l.serials[0] ?? l.subject.id

// ============================================================================ queues
export function InspectionQueues() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-EXEC")
  const [params, setParams] = useSearchParams()
  const q = (params.get("gate") as Queue) ?? "IQC"
  const setQ = (g: Queue) => {
    params.set("gate", g)
    setParams(params, { replace: true })
  }
  const open = s.lots.filter((l) => !l.decision)
  const rows = ds.empty ? [] : s.lots.filter((l) => (q === "all" ? true : q === "decided" ? !!l.decision : l.gate === q && !l.decision))
  const cols: Column<InspectionLot>[] = [
    { id: "id", header: "Inspection", value: (l) => l.id, sortable: true, mono: true, className: "w-32" },
    { id: "gate", header: "Gate", value: (l) => l.gate, filterable: true, className: "w-16" },
    { id: "subject", header: "Arrived from", value: (l) => l.subject.id, cell: (l) => <DocLinkText r={l.subject} /> },
    { id: "item", header: "Item", value: (l) => l.itemId, cell: (l) => <span title={materialText(l.itemId)}>{l.itemId}</span> },
    { id: "batch", header: "Batch / serial", value: subjectText, mono: true },
    { id: "vendor", header: "Vendor", value: (l) => vendorName(l.vendorId), filterable: true },
    { id: "plan", header: "Plan", value: (l) => (l.adHoc ? "Manual (no plan)" : `${l.planId} rev ${l.planRev}`), cell: (l) => (l.adHoc ? <Chip kind="flag">Manual (no plan)</Chip> : `${l.planId} rev ${l.planRev}`) },
    { id: "sample", header: "Lot / sample", value: (l) => l.sampleSize, cell: (l) => `${l.lotSize.toLocaleString("en-US")} / ${l.sampleSize}`, align: "right", mono: true },
    {
      id: "age", header: "Age", value: (l) => lotAge(l, TODAY), sortable: true, align: "right", mono: true,
      cell: (l) => <span className={cn(lotOverdue(l, TODAY) && "font-semibold text-destructive")}>{lotAge(l, TODAY)} d{lotOverdue(l, TODAY) ? ` (SLA ${l.slaDays} d)` : ""}</span>,
    },
    { id: "state", header: "Decision", value: stateText, filterable: true, cell: (l) => <span>{stateText(l)}{l.disposition ? ` · ${l.disposition}` : ""}</span> },
    { id: "stock", header: "Stock", value: (l) => s.batches.find((b) => b.id === l.batchId)?.stock ?? "", cell: (l) => { const b = s.batches.find((x) => x.id === l.batchId); return b ? <StatusBadge kind="stock" status={b.stock} size="sm" /> : null } },
  ]
  const queues: { id: Queue; label: string; count: number }[] = [
    ...(["IQC", "IPQC", "OQC", "RQC"] as const).map((g) => ({ id: g, label: GATES.find((x) => x.gate === g)!.label, count: open.filter((l) => l.gate === g).length })),
    { id: "decided", label: "Decided", count: s.lots.filter((l) => l.decision).length },
    { id: "all", label: "All", count: s.lots.length },
  ]
  return (
    <ListPage
      header={{
        title: "Inspection Execution",
        screenId: "QM-EXEC",
        description: "Per-gate queues of open inspections. Inspections arrive from GRN QI rows, routing checkpoints, shipment gates and RMA receipts; final tests (FQC) run in Final Test and FTR.",
        actions: (
          <Button variant="outline" asChild>
            <Link to="/quality/final-test">FQC queue: Final Test and FTR</Link>
          </Button>
        ),
        chips: <Reading id="QT-R01" />,
      }}
      above={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Stat label="Open inspections" value={open.length} />
            <Stat label="Over SLA" value={open.filter((l) => lotOverdue(l, TODAY)).length} tone="attention" />
            <Stat label="Sample not pulled (IQC)" value={open.filter((l) => l.gate === "IQC" && !l.samplePulled).length} />
            <Stat label="Batches on QI Hold" value={s.batches.filter((b) => b.stock === "QI Hold").length} />
            <span className="self-center"><Reading id="QT-R03" /></span>
          </div>
          <div role="tablist" aria-label="Gate queues" className="flex flex-wrap gap-1 border-b">
            {queues.map((x) => (
              <button key={x.id} role="tab" aria-selected={q === x.id} onClick={() => setQ(x.id)} className={cn("h-8 border-b-2 px-3 text-sm", q === x.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                {x.label} <span className="tabular text-xs">{x.count}</span>
              </button>
            ))}
          </div>
        </div>
      }
      table={{
        rows,
        columns: cols,
        rowId: (l) => l.id,
        rowHref: (l) => `/quality/inspections/${l.id}`,
        searchText: (l) => `${l.id} ${l.subject.id} ${l.itemId} ${l.batchId ?? ""} ${l.serials.join(" ")} ${vendorName(l.vendorId)}`,
        searchPlaceholder: "Search inspection, GRN, batch, serial",
        loading: ds.loading,
        error: ds.error,
        onRetry: ds.retry,
        initialSort: { id: "age", dir: "desc" },
        empty: { title: q === "decided" ? "Nothing decided yet" : "Queue is clear", body: "New inspections open automatically when a gate trigger fires (GRN line of a QI-required item, a checkpoint operation, a shipment, an RMA receipt)." },
      }}
      below={<RulesPanel rules={EXEC_RULES} />}
    />
  )
}

// ============================================================================ detail
export function InspectionDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-EXEC-D")
  const [role] = useRole()
  const l = s.lots.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "accept" | "reject" | "ncr">(null)
  if (ds.error) return <ErrorAlert title="Could not load the inspection" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!l) {
    const fin = s.finalTests.find((x) => x.id === id)
    if (fin) return <NotFound what="gate inspection" id={`${id} (this is a final test)`} back={{ to: `/quality/final-test/${id}`, label: `Open ${id} in Final Test and FTR` }} />
    return <NotFound what="inspection" id={id} back={{ to: "/quality/inspections", label: "Back to Inspection Execution" }} />
  }
  const chars = lotChars(s, l)
  const batch = s.batches.find((b) => b.id === l.batchId)
  const serial = l.serials.length ? s.serials.find((x) => x.id === l.serials[0]) : undefined
  const outcomes = chars.map((c) => charOutcome(c, l.results.find((r) => r.seq === c.seq)))
  const recorded = l.results.length
  const anyFail = outcomes.includes("Fail")
  const critFail = chars.some((c, i) => c.critical && outcomes[i] === "Fail")
  const gate = GATES.find((g) => g.gate === l.gate)!
  const decided = !!l.decision
  const status = batch ? { kind: "stock" as const, value: batch.stock } : serial ? { kind: "serial" as const, value: serial.status } : undefined

  return (
    <>
      <DetailPage
        header={{
          title: `${l.id} · ${gate.label}`,
          screenId: "QM-EXEC",
          crumbs: [{ label: "Inspection Execution", to: `/quality/inspections?gate=${l.gate}` }, { label: l.id }],
          description: `${materialText(l.itemId)}${l.vendorId ? ` from ${vendorName(l.vendorId)}` : ""}. Pass: ${gate.pass}. Fail: ${gate.fail}.`,
          chips: (
            <>
              <NoList text={l.decision ? `${l.decision}${l.disposition ? ` · ${l.disposition}` : ""}` : "Open"} />
              {l.adHoc && <Chip kind="flag" note="No-plan policy Manual Inspection: Quality Manager sign-off mandatory">Manual inspection</Chip>}
              {lotOverdue(l, TODAY) && <Chip kind="flag">Over SLA ({l.slaDays} d)</Chip>}
              {decided && <Chip kind="design" note="Results are permanent once decided">Read-only</Chip>}
            </>
          ),
          primary: decided ? undefined : (
            <Button onClick={() => setDlg(critFail ? "reject" : "accept")} disabled={recorded < chars.length}>
              {critFail ? "Reject inspection" : "Accept inspection"}
            </Button>
          ),
          actions: (
            <>
              {!decided && !critFail && (
                <Button variant="outline" onClick={() => setDlg("reject")} disabled={recorded < chars.length}>
                  Reject
                </Button>
              )}
              {!l.ncrId && (anyFail || decided) && (
                <Button variant="outline" onClick={() => setDlg("ncr")}>
                  Create NCR
                </Button>
              )}
            </>
          ),
        }}
        status={status}
        doc={{ type: "inspectionLot", id: l.id }}
        summary={
          <>
            <KV k="Arrived from"><DocLinkText r={l.subject} /></KV>
            <KV k="Plan">{l.adHoc ? "Manual (no plan)" : <Link className="text-link underline-offset-4 hover:underline" to={`/quality/inspection-plans/${l.planId}`}>{`${l.planId} rev ${l.planRev}`}</Link>}</KV>
            <KV k="Batch / serials">{batch ? <DocLinkText r={{ type: "batch", id: batch.id }} label={`${batch.id}${batch.vendorBatch ? ` (${batch.vendorBatch})` : ""}`} /> : l.serials.join(", ") || "None"}</KV>
            <KV k="Lot / sample">{`${l.lotSize.toLocaleString("en-US")} / ${l.sampleSize}`}</KV>
            <KV k="Inspector">{userName(l.inspectorId)}</KV>
            <KV k="Opened">{`${l.createdOn} · ${lotAge(l, TODAY)} d`}</KV>
            <KV k="Results">{`${recorded} of ${chars.length} recorded`}</KV>
            <KV k="Decision">{l.decision ? `${l.decision} ${l.decidedOn} by ${userName(l.decidedBy)}` : "Open"}</KV>
          </>
        }
        tabs={[
          { id: "exec", label: "Execute", content: <Execute l={l} chars={chars} s={s} /> },
          {
            id: "links", label: "NCR and deviation",
            content: <Links l={l} s={s} />,
          },
          { id: "activity", label: "Activity", content: <ActivityList items={l.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={EXEC_RULES} /> },
        ]}
      />
      <DecideDialog l={l} open={dlg === "accept" || dlg === "reject"} decision={dlg === "reject" ? "Rejected" : "Accepted"} anyFail={anyFail} onClose={() => setDlg(null)} role={role} s={s} />
      <NcrDialog sourceId={l.id} open={dlg === "ncr"} onClose={() => setDlg(null)} defaults={{ title: `${chars.find((_c, i) => outcomes[i] === "Fail")?.name ?? "Nonconformance"} on ${subjectText(l)}`, attributable: l.vendorId ? "Component Supplier" : "Production" }} />
    </>
  )
}

function Execute({ l, chars, s }: { l: InspectionLot; chars: QtCharacteristic[]; s: QualityTraceState }) {
  const [cert, setCert] = useState("")
  const [size, setSize] = useState(String(l.sampleSize))
  const decided = !!l.decision
  const needsSample = l.gate === "IQC" && !l.samplePulled && !decided
  const pull = (code: string): ScanOutcome => {
    const badge = USERS.find((u) => u.badge?.toUpperCase() === code.trim().toUpperCase())
    if (badge) return { ok: true, message: `Badge ${badge.badge} (${badge.name}) read. Now scan batch ${l.batchId}.` }
    const r = act.pullSample(l.id, code)
    return r.ok ? { ok: true, message: `Sample of ${l.sampleSize} pulled from ${l.batchId}. T03 recorded.` } : { ok: false, expected: `batch label ${l.batchId}`, next: "Scan the batch label on the QI Hold stock, then record results.", message: r.error }
  }
  const bind = (code: string): ScanOutcome => {
    const r = act.bindInstrument(l.id, code)
    return r.ok ? { ok: true, message: `${r.value} bound to ${l.id}; calibration current.` } : { ok: false, errorCode: r.error.includes("E-QM-05") ? "E-QM-05" : undefined, expected: "a CAL-#### label of an In Cal or Due Soon instrument", next: "Use another calibrated instrument or ask the calibration owner.", message: r.error }
  }
  return (
    <div className="flex flex-col gap-4">
      {!decided && (
        <div className="grid gap-4 lg:grid-cols-2">
          {l.gate === "IQC" && (
            <Section title="SP-05 QI sample pull">
              {needsSample ? (
                <ScanField scanPoint="SP-05" expected={`Scan batch ${l.batchId} (badge then batch)`} onScan={pull} label="Batch label or inspector badge" />
              ) : (
                <p className="text-sm">Sample of {l.sampleSize} pulled {l.samplePulled?.on} by {userName(l.samplePulled?.by)}.</p>
              )}
              <div className="flex items-end gap-2">
                <TextField id="sample-size" label="Sample size (increase only)" type="number" value={size} onChange={setSize} />
                <Button variant="outline" size="sm" onClick={() => report(act.setSampleSize(l.id, Number(size)), `Sample size ${size}`)}>
                  Set
                </Button>
              </div>
            </Section>
          )}
          <Section title="SP-14 instrument binding">
            <ScanField scanPoint="SP-14" expected="Scan the instrument CAL label" onScan={bind} disabled={needsSample} label="Instrument CAL label" />
            <ul className="flex flex-wrap gap-2 text-sm">
              {l.instruments.map((iid) => {
                const ins = s.instruments.find((x) => x.id === iid)!
                return (
                  <li key={iid} className="inline-flex items-center gap-1">
                    {ins.label} {ins.type}
                    <StatusBadge kind="instrument" status={instrumentStatus(ins, TODAY)} size="sm" />
                  </li>
                )
              })}
              {!l.instruments.length && <li className="text-muted-foreground">No instrument bound yet.</li>}
            </ul>
          </Section>
        </div>
      )}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Characteristic</TableHead>
            <TableHead>Specification</TableHead>
            <TableHead>Sample instruction</TableHead>
            <TableHead>Instrument</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Outcome</TableHead>
            {!decided && <TableHead className="w-20"><span className="sr-only">Save</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {chars.map((c) => (
            <ResultRowEditor key={c.seq} l={l} c={c} s={s} disabled={decided || needsSample} />
          ))}
        </TableBody>
      </Table>
      {needsSample && <p className="text-sm text-muted-foreground">Pull the sample (SP-05) before recording incoming results.</p>}
      <Section title="Attachments">
        {l.certificate ? (
          <p className="text-sm">Vendor certificate: {l.certificate}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{chars.some((c) => c.certRequired) ? "Vendor test certificate upload is mandatory before Accept." : "No certificate attached."}</p>
        )}
        {!decided && (
          <div className="flex items-end gap-2">
            <TextField id="cert" label="Certificate file" value={cert} onChange={setCert} placeholder="HP-26-0412 routine test certificate.pdf" />
            <Button variant="outline" size="sm" onClick={() => report(act.attachCertificate(l.id, cert), "Certificate attached") && setCert("")}>
              Attach
            </Button>
          </div>
        )}
      </Section>
    </div>
  )
}

function ResultRowEditor({ l, c, s, disabled }: { l: InspectionLot; c: QtCharacteristic; s: QualityTraceState; disabled: boolean }) {
  const r = l.results.find((x) => x.seq === c.seq)
  const [val, setVal] = useState(r?.value?.toString() ?? "")
  const [attr, setAttr] = useState<"Pass" | "Fail" | "NA" | "">(r?.attr ?? "")
  const [ins, setIns] = useState<string>(r?.instrumentId ?? l.instruments.find((i) => s.instruments.find((x) => x.id === i)?.type === c.instrumentClass) ?? "")
  const out = charOutcome(c, r)
  const candidates = s.instruments.filter((i) => !c.instrumentClass || i.type === c.instrumentClass)
  return (
    <TableRow className={cn(out === "Fail" && "bg-destructive/5")}>
      <TableCell className="tabular">{c.seq}</TableCell>
      <TableCell className="font-medium">
        {c.name}
        {c.critical && <span className="ml-2"><Chip kind="flag" note="R-QM-02">Critical</Chip></span>}
        <div className="text-xs text-muted-foreground">{c.method}</div>
      </TableCell>
      <TableCell className="tabular">{fmtBounds(c)}</TableCell>
      <TableCell className="text-muted-foreground">{c.sampleInstruction ?? ""}</TableCell>
      <TableCell>
        {c.instrumentClass ? (
          disabled ? (
            s.instruments.find((x) => x.id === r?.instrumentId)?.label ?? c.instrumentClass
          ) : (
            <Pick id={`ins-${l.id}-${c.seq}`} placeholder={c.instrumentClass} value={ins} onChange={setIns} options={candidates.map((i) => ({ value: i.id, label: `${i.label} · ${instrumentStatus(i, TODAY)}` }))} />
          )
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell>
        {disabled ? (
          <span className="tabular">{r ? (c.charType === "Quantitative" ? `${r.value} ${c.uom ?? ""}` : r.attr) : ""}</span>
        ) : c.charType === "Quantitative" ? (
          <Input aria-label={`Value for ${c.name}`} className="h-8 w-28" type="number" value={val} onChange={(e) => setVal(e.target.value)} />
        ) : (
          <Pick id={`attr-${l.id}-${c.seq}`} placeholder="Pass / Fail" value={attr} onChange={(v) => setAttr(v)} options={["Pass", "Fail", "NA"] as const as unknown as ("Pass" | "Fail" | "NA")[]} />
        )}
      </TableCell>
      <TableCell>
        <Outcome value={out} />
      </TableCell>
      {!disabled && (
        <TableCell>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              report(act.record(l.id, c.seq, c.charType === "Quantitative" ? { value: val.trim() === "" ? undefined : Number(val), instrumentId: (ins || undefined) as never } : { attr: attr || undefined, instrumentId: (ins || undefined) as never }), `Characteristic ${c.seq} recorded`)
            }
          >
            Save
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

function Links({ l, s }: { l: InspectionLot; s: QualityTraceState }) {
  const ncr = s.ncrs.find((n) => n.id === l.ncrId)
  const approved = s.deviations.filter((d) => d.state === "Approved" && (!d.vendorId || d.vendorId === l.vendorId))
  const [devId, setDevId] = useState(l.deviationId ?? "")
  const dev = s.deviations.find((d) => d.id === l.deviationId)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="NCR (INV 15.4)">
        {ncr ? (
          <div className="flex flex-col gap-1 text-sm">
            <Link className="text-link underline-offset-4 hover:underline" to={docRoute({ type: "ncr", id: ncr.id })}>{ncr.id}</Link>
            <span>{ncr.title}</span>
            <span className="text-muted-foreground">{ncr.severity} · {ncr.stage} · attributable to {ncr.attributableTo}</span>
            {ncr.capaId && <DocLinkText r={{ type: "capa", id: ncr.capaId }} />}
            {ncr.scarId && <DocLinkText r={{ type: "scar", id: ncr.scarId }} />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No NCR. A failed characteristic or a reject decision should raise one.</p>
        )}
      </Section>
      <Section title="Deviation (use as is)">
        {dev ? (
          <p className="text-sm">
            Accepted under <DocLinkText r={{ type: "deviation", id: dev.id }} /> ({dev.state}): {dev.characteristic}, spec {dev.specValue}, accepted {dev.acceptedValue}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Link an Approved deviation to accept a failed characteristic as is.</p>
        )}
        {!l.decision && (
          <div className="flex items-end gap-2">
            <Pick id="dev-link" label="Approved deviation" value={devId} onChange={setDevId} options={approved.map((d) => ({ value: d.id, label: `${d.id} · ${d.title}` }))} placeholder={approved.length ? "Choose" : "None approved"} />
            <Button variant="outline" size="sm" disabled={!devId} onClick={() => report(act.linkDeviation(l.id, devId), `${devId} linked`)}>
              Link
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/quality/deviations">Request a deviation</Link>
            </Button>
          </div>
        )}
      </Section>
    </div>
  )
}

function DecideDialog({ l, open, decision, anyFail, onClose, role, s }: { l: InspectionLot; open: boolean; decision: Decision; anyFail: boolean; onClose: () => void; role: string; s: QualityTraceState }) {
  const [disp, setDisp] = useState<Disposition | "">(decision === "Accepted" && anyFail ? "Use as is under deviation" : "")
  const moves = l.gate === "IQC" || l.gate === "RQC"
  const consequence =
    decision === "Accepted"
      ? `${l.id} is Accepted${disp ? ` (${disp})` : ""}. ${moves && l.batchId ? `Batch ${l.batchId} moves QI Hold → Unrestricted. ` : ""}${l.gate === "IPQC" ? "The operation may complete. " : l.gate === "OQC" ? "The CoC is generated and PGI is enabled. " : ""}T0${l.gate === "IQC" ? "3" : "8"} is written to the genealogy; results become permanent.`
      : `${l.id} is Rejected (${disp || "choose a disposition"}). ${moves && l.batchId ? `Batch ${l.batchId} moves to Blocked. ` : ""}${l.gate === "IQC" ? "The vendor rating takes the hit. " : l.gate === "OQC" ? "The shipment stays blocked. " : ""}Create the NCR next.`
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={decision === "Accepted" ? `Accept ${l.id}` : `Reject ${l.id}`}
      consequence={consequence}
      confirmLabel={decision === "Accepted" ? "Accept" : "Reject"}
      destructive={decision === "Rejected"}
      requireReason={decision === "Rejected" || !!l.adHoc}
      onConfirm={(reason) => {
        const r = act.decide(l.id, decision, disp || undefined, reason)
        return report(r, `${l.id} ${decision}`) ? null : (r as { error: string }).error
      }}
    >
      <div className="flex flex-col gap-2 text-sm">
        {decision === "Rejected" ? (
          <Pick id="disp" label="Disposition" value={disp} onChange={setDisp} options={["Return to vendor", "Scrap", "Rework"] as Disposition[]} />
        ) : anyFail ? (
          <p>
            A non-critical characteristic failed. Accept only under the linked deviation{" "}
            {l.deviationId ? <DocLinkText r={{ type: "deviation", id: l.deviationId }} /> : <strong>(none linked yet)</strong>}.
          </p>
        ) : null}
        {l.adHoc && <p>Manual inspection: only the Quality Manager may sign off (acting as {role}).</p>}
        {s.batches.find((b) => b.id === l.batchId) && (
          <p className="inline-flex items-center gap-2">
            Stock now <StatusBadge kind="stock" status={s.batches.find((b) => b.id === l.batchId)!.stock} size="sm" />
          </p>
        )}
      </div>
    </DialogShell>
  )
}

export function NcrDialog({ sourceId, open, onClose, defaults }: { sourceId: string; open: boolean; onClose: () => void; defaults: { title: string; attributable: QtNcr["attributableTo"] } }) {
  const [title, setTitle] = useState(defaults.title)
  const [severity, setSeverity] = useState<QtNcr["severity"]>("Major")
  const [attr, setAttr] = useState<QtNcr["attributableTo"]>(defaults.attributable)
  const [desc, setDesc] = useState("")
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Create NCR from ${sourceId}`}
      description="The NCR record lives in INV 15.4; this creates the link record and escalation path (CAPA, SCAR)."
      consequence={`Creates an NCR at Open linked to ${sourceId}; Component Supplier attribution enables the SCAR path.`}
      confirmLabel="Create NCR"
      onConfirm={() => {
        const r = createNcr({ type: "inspectionLot", id: sourceId }, { title, severity, description: desc, attributableTo: attr })
        return report(r, (id) => `${id} created`) ? null : (r as { error: string }).error
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="ncr-title" label="Title" value={title} onChange={setTitle} />
        <Pick id="ncr-sev" label="Severity" value={severity} onChange={setSeverity} options={["Critical", "Major", "Minor"] as QtNcr["severity"][]} />
        <Pick id="ncr-attr" label="Failure attributable to" value={attr} onChange={setAttr} options={["Component Supplier", "Production", "Design", "Not determined"] as QtNcr["attributableTo"][]} />
        <TextField id="ncr-desc" label="Description" value={desc} onChange={setDesc} />
      </div>
      <p className="text-xs text-muted-foreground">
        Severity and stage words are a reading <Reading id="QT-R02" />
      </p>
    </DialogShell>
  )
}
