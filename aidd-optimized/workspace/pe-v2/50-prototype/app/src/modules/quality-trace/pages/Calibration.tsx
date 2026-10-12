// QM-CAL-001 Calibration Register [DOC:p.266 Book VI; Book I E §7, p.90] (asserted).
// Instrument grid with due-date colours (S-26), certificate uploads, measurements-at-risk report.
// Actions: record calibrations; the out-of-service toggle interlocks every SP-14 scan (E-QM-05).
// Postings and scans: none here; SP-14 on the test screens checks this register.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, ListPage } from "@/components/templates"
import { KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { STATUS, THRESHOLDS } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { daysBetween } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cal as act, measurementsAtRisk } from "../data/actions"
import { instrumentStatus } from "../data/seed"
import type { QtInstrument } from "../data/types"
import { Outcome, Pick, Reading, Section, Stat, TextField, report, useDataState, userName } from "../components/bits"

export const CAL_RULES: [string, string, string][] = [
  ["QM-K1", `Statuses In Cal, Due Soon, Overdue, Out of Service; alerts at ${THRESHOLDS.calibrationAlertDays.join(" / ")} days before due.`, "DOC:p.90 §7"],
  ["QM-K2", "E-QM-05: an Overdue or Out of Service instrument cannot be referenced by any test (SP-14 interlock).", "DOC:p.90 §7; p.96 SP-14"],
  ["QM-K3", "Each calibration records result, certificate and lab; a pass resets the due date by the interval.", "DOC:p.90 §7"],
  ["QM-K4", "A failed calibration takes the instrument out of service and flags every measurement since the last good calibration for review (measurements at risk).", "DOC:p.90 §7"],
]

export function CalibrationRegister() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-CAL-001")
  const [params, setParams] = useSearchParams()
  const insId = params.get("ins")
  const rows = ds.empty ? [] : s.instruments
  const st = (i: QtInstrument) => instrumentStatus(i, TODAY)
  const setIns = (v?: string) => {
    if (v) params.set("ins", v)
    else params.delete("ins")
    setParams(params, { replace: true })
  }
  const cols: Column<QtInstrument>[] = [
    { id: "label", header: "CAL label", value: (i) => i.label, mono: true, sortable: true, cell: (i) => <button className="text-link underline-offset-4 hover:underline" onClick={() => setIns(i.id)}>{i.label}</button> },
    { id: "name", header: "Instrument", value: (i) => i.name },
    { id: "type", header: "Class", value: (i) => i.type, filterable: true },
    { id: "range", header: "Range", value: (i) => i.range },
    { id: "loc", header: "Location", value: (i) => i.location, filterable: true },
    { id: "last", header: "Last calibrated", value: (i) => i.lastCalOn, mono: true, sortable: true },
    {
      id: "due", header: "Due", value: (i) => i.dueOn, mono: true, sortable: true,
      cell: (i) => {
        const d = daysBetween(TODAY, i.dueOn)
        return <span className={cn(d < 0 && "font-semibold text-destructive", d >= 0 && d <= 30 && "font-semibold")}>{i.dueOn} <span className="text-xs text-muted-foreground">({d < 0 ? `${-d} d over` : `${d} d`})</span></span>
      },
    },
    { id: "status", header: "Status", value: st, filterable: true, sortable: true, cell: (i) => <StatusBadge kind="instrument" status={st(i)} size="sm" /> },
    { id: "owner", header: "Owner", value: (i) => userName(i.ownerId) },
  ]
  const ins = s.instruments.find((i) => i.id === insId || i.label === insId)
  return (
    <>
      <ListPage
        header={{
          title: "Calibration Register",
          screenId: "QM-CAL-001",
          description: "Every instrument a test can reference. Test screens validate each SP-14 scan against this register.",
          chips: <Reading id="QT-R05" />,
        }}
        above={
          <div className="flex flex-wrap gap-2">
            {STATUS.instrument.statuses.map((x) => (
              <Stat key={x} label={x} value={s.instruments.filter((i) => st(i) === x).length} tone={x === "Overdue" || x === "Out of Service" ? "attention" : undefined} />
            ))}
            <Stat label={`Alerts due (${THRESHOLDS.calibrationAlertDays.join("/")} d)`} value={s.instruments.filter((i) => (THRESHOLDS.calibrationAlertDays as readonly number[]).includes(daysBetween(TODAY, i.dueOn))).length} />
          </div>
        }
        table={{
          rows, columns: cols, rowId: (i) => i.id, activeId: ins?.id, onRowClick: (i) => setIns(i.id),
          searchText: (i) => `${i.label} ${i.id} ${i.name} ${i.type} ${i.location}`, searchPlaceholder: "Search label, instrument, class",
          loading: ds.loading, error: ds.error, onRetry: ds.retry, initialSort: { id: "due", dir: "asc" },
          empty: { title: "No instruments registered", body: "Register instruments before any test can bind one through SP-14." },
        }}
        below={<RulesPanel rules={CAL_RULES} />}
      />
      <Sheet open={!!ins} onOpenChange={(o) => !o && setIns()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">{ins && <InstrumentPanel i={ins} />}</SheetContent>
      </Sheet>
    </>
  )
}

function InstrumentPanel({ i }: { i: QtInstrument }) {
  const s = useSlice("qualityTrace")
  const [dlg, setDlg] = useState<null | "cal" | "oos">(null)
  const [res, setRes] = useState<"Pass" | "Fail">("Pass")
  const [cert, setCert] = useState("")
  const [lab, setLab] = useState("Precision Cal Services (ISO/IEC 17025)")
  const st = instrumentStatus(i, TODAY)
  const risk = measurementsAtRisk(s, i.id)
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {i.label} · {i.name} <StatusBadge kind="instrument" status={st} size="sm" />
        </SheetTitle>
        <SheetDescription>{i.id} · {i.range} · {i.location}{i.workCenterId ? ` · ${i.workCenterId}` : ""}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDlg("cal")}>Record calibration</Button>
          <Button variant="outline" onClick={() => setDlg("oos")}>{i.outOfService ? "Return to service" : "Take out of service"}</Button>
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <KV k="Interval">{`${i.intervalDays} days`}</KV>
          <KV k="Last calibrated">{i.lastCalOn}</KV>
          <KV k="Due">{i.dueOn}</KV>
          <KV k="Owner">{userName(i.ownerId)}</KV>
          {i.outOfService && <KV k="Out of service">{`${i.outOfService.on}: ${i.outOfService.reason}`}</KV>}
        </dl>
        <Section title="Calibration history and certificates">
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow><TableHead>Date</TableHead><TableHead>Result</TableHead><TableHead>Certificate</TableHead><TableHead>Lab</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...i.events].reverse().map((e, n) => (
                <TableRow key={n}>
                  <TableCell className="tabular">{e.on}</TableCell>
                  <TableCell><Outcome value={e.result} /></TableCell>
                  <TableCell>{e.certificate}</TableCell>
                  <TableCell className="text-muted-foreground">{e.lab}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title={`Measurements at risk (${risk.length})`}>
          <p className="text-xs text-muted-foreground">Every result captured with this instrument since its last good calibration. Review them if the next calibration fails.</p>
          {risk.length ? (
            <Table>
              <TableBody>
                {risk.map((r, n) => (
                  <TableRow key={n}>
                    <TableCell><Link className="text-link underline-offset-4 hover:underline" to={r.route}>{r.doc}</Link></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="tabular">{r.subject}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{r.on}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No measurement references this instrument since its last good calibration.</p>
          )}
        </Section>
      </div>
      <DialogShell
        open={dlg === "cal"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Record calibration of ${i.label}`}
        consequence={res === "Pass" ? `${i.label} returns to In Cal; next due date ${i.intervalDays} days from today.` : `${i.label} goes Out of Service; ${risk.length} measurement(s) since the last good calibration are flagged for review. SP-14 will refuse it (E-QM-05).`}
        confirmLabel="Record"
        destructive={res === "Fail"}
        onConfirm={() => {
          const r = act.record(i.id, res, cert, lab)
          if (report(r, `Calibration ${res} recorded`)) setCert("")
          return r.ok ? null : r.error
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Pick id="cal-res" label="Result" value={res} onChange={setRes} options={["Pass", "Fail"] as ("Pass" | "Fail")[]} />
          <TextField id="cal-cert" label="Certificate file" value={cert} onChange={setCert} placeholder={`${i.label}-${TODAY}.pdf`} />
          <TextField id="cal-lab" label="Lab" value={lab} onChange={setLab} />
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "oos"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={i.outOfService ? `Return ${i.label} to service` : `Take ${i.label} out of service`}
        consequence={i.outOfService ? "Returns the instrument to its due-date status without a calibration. This is a logged override for the Quality Manager." : "From now on every SP-14 scan of this instrument is refused (E-QM-05) until it is returned to service or calibrated."}
        confirmLabel={i.outOfService ? "Return to service" : "Take out of service"}
        requireReason
        destructive={!i.outOfService}
        onConfirm={(reason) => {
          const r = act.toggleOos(i.id, reason)
          return report(r, i.outOfService ? "Returned to service" : "Out of service") ? null : (r as { error: string }).error
        }}
      />
    </>
  )
}
