// FX-PRD-LABOR Labor export to payroll (IF-22) review. Confirmation hours per operator flow out as a
// file for payroll; IF-22 is reserved for Phase 2 [DOC:p.215 §7.2], so the prototype produces and
// reviews the file and never transmits it. Supervisors approve confirmations before export; a
// reversed confirmation nets out through its mirror row. Corrections of an exported row export
// automatically with the next file. The batch layout, the checksum and the review states are design.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Chip, KV, RulesPanel, type Column } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { fmtDate, fmtNumber } from "@/lib/format"
import { TODAY } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { AccessNote, StateBanner, StatePreview, WoLink, useAct, useActDialog, useScreenState, userName } from "../components"
import * as ext from "../lib/actions-ext"
import type { LaborRow } from "../lib/actions-ext"

const GEN_ROLES = ["Production supervisor", "Cost accountant", "Controlling analyst"] as const

export function LaborExport() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PRD-LABOR")
  const [role] = useRole()
  const run = useAct()
  const runD = useActDialog()
  const [queue, setQueue] = useState("await")
  const [active, setActive] = useState<string | null>(null)
  const [period, setPeriod] = useState(TODAY.slice(0, 7))
  const [dlg, setDlg] = useState<null | "generate">(null)
  const [csv, setCsv] = useState<string | null>(null)
  const all = useMemo(() => (st.empty ? [] : ext.laborRows(s)), [s, st.empty])
  const by = (f: (r: LaborRow) => boolean) => all.filter(f)
  const groups: Record<string, LaborRow[]> = {
    await: by((r) => r.state === "Awaiting approval"),
    approved: by((r) => r.state === "Approved"),
    corr: by((r) => r.state === "Correction" || r.state === "Reversed"),
    exported: by((r) => r.state === "Exported"),
  }
  const rows = queue === "all" ? all : groups[queue] ?? []
  const periods = [...new Set(all.map((r) => r.at.slice(0, 7)))].sort().reverse()
  const toExport = all.filter((r) => r.at.startsWith(period) && r.state === "Approved")
  const totalH = (rs: LaborRow[]) => Math.round(rs.reduce((a, r) => a + r.hours, 0) * 10) / 10
  const isSup = role === "Production supervisor"
  const canGen = (GEN_ROLES as readonly string[]).includes(role) && !st.readOnly
  const act = all.find((r) => r.cnfId === active)

  const columns: Column<LaborRow>[] = [
    { id: "cnf", header: "Confirmation", value: (r) => r.cnfId, mono: true, sortable: true },
    { id: "wo", header: "Order / op", value: (r) => `${r.woId}/${r.op}`, cell: (r) => <><WoLink id={r.woId} /> / {r.op}</> },
    { id: "at", header: "Date", value: (r) => r.at, sortable: true, cell: (r) => fmtDate(r.at) },
    { id: "ops", header: "Operators", value: (r) => r.operators.map((o) => userName(o.userId)).join(", "), cell: (r) => <span className="text-xs">{r.operators.map((o) => userName(o.userId)).join(", ")}</span> },
    { id: "h", header: "Hours", value: (r) => r.hours, align: "right", mono: true, sortable: true, cell: (r) => <span className={r.hours < 0 ? "text-status-exception-ink" : undefined}>{r.hours}</span> },
    { id: "flags", header: "Review flags", value: (r) => r.flags.length, cell: (r) => (r.flags.length ? <Chip kind="flag" note={r.flags.join(". ")}>{r.flags.length} flag{r.flags.length > 1 ? "s" : ""}</Chip> : null) },
    { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => <span className="rounded-md border px-2 py-0.5 text-xs font-medium">{r.state}{r.batchId ? ` · ${r.batchId}` : ""}</span> },
  ]
  return (
    <>
      <WorkbenchPage<LaborRow>
        header={{
          title: "Labor export to payroll (IF-22)",
          screenId: "FX-PRD-LABOR",
          description: "Review confirmed hours by operator, approve them, and generate the file. The interface is reserved for Phase 2: the file is produced here for review and is never sent.",
          chips: <Chip kind="design" note="IF-22 payroll interface is reserved for Phase 2 [DOC:p.215 §7.2]. The batch layout and checksum are prototype values">Review only: not transmitted</Chip>,
          actions: <><StatePreview extended /><Button variant="outline" asChild><Link to="/production/settlement">Settlement run</Link></Button></>,
          primary: <Button disabled={!canGen} title={!canGen ? "The supervisor or Costing generates the file" : undefined} onClick={() => setDlg("generate")}>Generate IF-22 file</Button>,
        }}
        kpis={[
          { label: "Awaiting supervisor approval", value: `${groups.await.length}`, hint: `${totalH(groups.await)} h` },
          { label: "Approved, not exported", value: `${groups.approved.length}`, hint: `${totalH(groups.approved)} h` },
          { label: "Corrections and reversals", value: `${groups.corr.length}`, hint: "Net out in the next file" },
          { label: "Files generated", value: `${s.laborBatches.length}`, hint: s.laborBatches[0] ? `Latest ${s.laborBatches.at(-1)!.id}` : "none yet" },
        ]}
        queues={[
          { id: "await", label: "Awaiting approval", count: groups.await.length },
          { id: "approved", label: "Approved", count: groups.approved.length },
          { id: "corr", label: "Corrections", count: groups.corr.length },
          { id: "exported", label: "Exported", count: groups.exported.length },
          { id: "all", label: "All", count: all.length },
        ]}
        queue={queue} onQueueChange={setQueue}
        table={{
          rows, columns, rowId: (r) => r.cnfId, onRowClick: (r) => setActive(r.cnfId), activeId: active ?? undefined,
          searchText: (r) => `${r.cnfId} ${r.woId} ${r.operators.map((o) => userName(o.userId)).join(" ")}`, searchPlaceholder: "Search confirmation, order, operator",
          loading: st.loading, error: st.error, onRetry: st.retry,
          empty: { title: queue === "await" ? "Nothing waits for approval" : "No rows here", body: queue === "await" ? "Every confirmed hour is approved." : "Rows appear as confirmations post at the terminal." },
          toolbar: <StatePreview extended />,
        }}
        bulkActions={queue === "await" || queue === "all" ? (sel, clear) => (
          <Button size="sm" disabled={!isSup || st.readOnly} title={!isSup ? "Supervisor approves labor before export" : undefined} onClick={() => run((d, c) => ext.approveLabor(d, c, sel), (n) => `${n} confirmation(s) approved`) !== undefined && clear()}>Approve selected</Button>
        ) : undefined}
        panel={{
          open: !!act, onOpenChange: (o) => !o && setActive(null), title: `${act?.cnfId ?? ""} · ${act?.woId}/${act?.op}`, description: act ? `${act.hours} h on ${fmtDate(act.at)}` : undefined,
          content: act && (
            <div className="flex flex-col gap-3 text-sm">
              <KV k="State">{act.state}{act.batchId ? ` in ${act.batchId}` : ""}</KV>
              <KV k="Crew size">{act.conf.crewSize}</KV>
              <div><p className="font-semibold">Hours by operator</p><ul className="mt-1 flex flex-col gap-1">{act.operators.map((o) => <li key={o.userId} className="tabular flex justify-between border-b pb-1"><span>{userName(o.userId)}</span><span>{o.hours} h</span></li>)}</ul></div>
              {act.flags.length > 0 && <div><p className="font-semibold">Review flags</p><ul className="mt-1 list-disc pl-5">{act.flags.map((f) => <li key={f}>{f}</li>)}</ul></div>}
              {act.conf.reversalOf && <p>Mirror of {act.conf.reversalOf}: it cancels that confirmation in payroll.</p>}
              {act.conf.reversedBy && <p>Reversed by {act.conf.reversedBy}: both rows net to zero.</p>}
              <Button variant="outline" asChild><Link to={`/production/orders/${act.woId}`}>Open the production order</Link></Button>
            </div>
          ),
        }}
      />
      <div className="mt-6 flex flex-col gap-3">
        <StateBanner st={st} />
        <AccessNote roles={GEN_ROLES} role={role} what="Generating the IF-22 file" />
        <section aria-label="Files" className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Generated files</h2>
          {s.laborBatches.length === 0 ? <p className="text-sm text-muted-foreground">No file has been generated. Approve confirmations, then generate for a period.</p> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-table-head text-left"><tr>{["File", "Period", "Created", "By", "Rows", "Hours", "Checksum", "State", ""].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t">
                  {s.laborBatches.map((b) => (
                    <tr key={b.id}><td className="font-mono text-xs">{b.id}</td><td>{b.period}</td><td>{fmtDate(b.createdOn)}</td><td>{b.by}</td><td className="tabular">{b.rows}</td><td className="tabular">{fmtNumber(b.hours, 1)}</td><td className="font-mono text-xs">{b.checksum}</td><td>{b.status}</td>
                      <td className="text-right"><Button size="sm" variant="outline" onClick={() => setCsv(ext.csvOfBatch(s, b.id))}>Review file</Button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <RulesPanel rules={[
          ["IF-22", "Labor to payroll is reserved for Phase 2; the file is for review", "DOC:p.215 §7.2"],
          ["Approval", "Hours are approved by the supervisor before they can export", "design reading"],
          ["Corrections", "A reversed confirmation exports its mirror row; the pair nets to zero", "DOC:p.179 FL-04 f11"],
          ["Crew", "Hours split evenly over the recorded crew; when the crew is not fully recorded they go to the confirming operator", "design reading"],
        ]} />
      </div>

      <DialogShell open={dlg === "generate"} onOpenChange={(o) => !o && setDlg(null)} title="Generate IF-22 file" confirmLabel="Generate file" confirmDisabled={toExport.length === 0}
        consequence={`Writes a file of ${toExport.length} approved row(s), ${totalH(toExport)} h, for ${period}. Those rows become Exported and cannot be exported twice. The file is not transmitted: IF-22 is reserved for Phase 2.`}
        onConfirm={() => runD((d, c) => ext.generateLaborExport(d, c, period), (id) => `${id} generated`)}>
        <div className="flex items-center gap-2 text-sm">
          <span>Period</span>
          <Select value={period} onValueChange={setPeriod}><SelectTrigger size="sm" className="w-32" aria-label="Period"><SelectValue /></SelectTrigger><SelectContent>{[...new Set([TODAY.slice(0, 7), ...periods])].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
        </div>
        {toExport.length === 0 && <p role="status" className="text-sm text-status-pending-ink">No approved rows in {period}. Approve confirmations in the Awaiting approval queue first (supervisor).</p>}
      </DialogShell>
      <DialogShell open={csv !== null} onOpenChange={(o) => !o && setCsv(null)} wide title="File contents" confirmLabel="Close" onConfirm={() => null}>
        <Textarea readOnly rows={12} value={csv ?? ""} className="font-mono text-xs" aria-label="File contents" />
      </DialogShell>
    </>
  )
}
