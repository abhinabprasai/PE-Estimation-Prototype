// CO-SKF-001 Statistical Key Figures (/controlling/statistical-key-figures); source Book I H §5 [DOC:p.114]: "Screen CO-SKF-001:
// per CC per period: headcount, sq ft, machine hours...; import from XLSX; history kept". Driver values feed the allocation cycles
// (Headcount, Sq Ft, Machine Hours, Labor Hours, Revenue Share), maintained quarterly. The Controlling analyst maintains them
// [DOC:p.115 §6]. Import is all-or-nothing: one bad row stops the file. XLSX is read by the import service in the real system;
// the prototype takes the rows as pasted text or a CSV / TSV file. Route and archetype are design values.
import { useMemo, useRef, useState } from "react"
import { Pencil, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, ListPage } from "@/components/templates"
import { Chip, RulesPanel, type Column } from "@/components/patterns"
import type { CostCenterId } from "@/data/domain"
import { COST_CENTERS } from "@/data/shared"
import { fmtDate, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { editSkfCell, importSkf, SKF_FIELDS, startQuarter, type SkfField, type SkfImportRow } from "../data/xactions"
import type { SkfValue } from "../data/types"
import { CsvButton, Design, Reading, report, Section } from "../components/common"
import { SelectField, TextField, userName } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"

const LABEL: Record<SkfField, string> = { headcount: "Headcount", sqft: "Sq ft", machineHours: "Machine hours", laborHours: "Labor hours", revenueShare: "Revenue share %" }

/** Parse pasted workbook rows: tab or comma separated, optional header row, six columns. */
function parse(text: string): SkfImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: SkfImportRow[] = []
  lines.forEach((l, i) => {
    const c = l.split(/\t|,|;/).map((x) => x.trim())
    if (i === 0 && !/^CC-/i.test(c[0])) return // header row
    const n = (x?: string) => (x === undefined || x === "" ? NaN : Number(x.replace(/\s/g, "")))
    out.push({ line: i + 1, costCenterId: c[0]?.toUpperCase() ?? "", headcount: n(c[1]), sqft: n(c[2]), machineHours: n(c[3]), laborHours: n(c[4]), revenueShare: n(c[5]) })
  })
  return out
}

export function StatisticalKeyFigures() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("CO-SKF-001", { writers: "the Controlling analyst", degraded: "Live hours from confirmations are delayed: only the quarterly table values are shown.", validation: ["Row 4: CC-9000 is a summary node; key figures belong to postable centers.", "Row 7: headcount must be a whole number."] })
  const periods = [...new Set(s.skf.map((r) => r.period))].sort().reverse()
  const [period, setPeriod] = useState(periods[0] ?? "2026-Q3")
  const per = periods.includes(period) ? period : periods[0]
  const [dlg, setDlg] = useState<null | "import" | "start" | { edit: SkfValue }>(null)
  const [field, setField] = useState<SkfField | "">("")
  const [val, setVal] = useState("")
  const [txt, setTxt] = useState("")
  const [fileNote, setFileNote] = useState("")
  const [qtr, setQtr] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const rows = useMemo(() => s.skf.filter((r) => r.period === per).sort((a, b) => a.costCenterId.localeCompare(b.costCenterId)), [s.skf, per])
  const parsed = useMemo(() => parse(txt), [txt])
  const shareTotal = rows.reduce((t, r) => t + r.revenueShare, 0)
  const cols: Column<SkfValue>[] = [
    { id: "cc", header: "Cost center", value: (r) => r.costCenterId, sortable: true, cell: (r) => <span><span className="font-mono">{r.costCenterId}</span> <span className="text-muted-foreground">{COST_CENTERS.find((c) => c.id === r.costCenterId)?.name}</span></span> },
    ...SKF_FIELDS.map((f): Column<SkfValue> => ({ id: f, header: LABEL[f], value: (r) => r[f], sortable: true, align: "right", cell: (r) => <span className="tabular">{fmtNumber(r[f])}</span> })),
    { id: "edit", header: "", value: () => "", cell: (r) => <Button size="sm" variant="ghost" aria-label={`Edit key figures of ${r.costCenterId}`} {...writeProps(st)} onClick={() => { setField(""); setVal(""); setDlg({ edit: r }) }}><Pencil aria-hidden="true" /></Button> },
  ]
  const history = s.skfHistory.filter((h) => h.period === per).slice(0, 25)
  return (
    <>
      <ListPage
        header={{
          screenId: "CO-SKF-001",
          title: "Statistical key figures",
          description: "The driver values the allocation cycles use, per cost center and quarter. History is kept.",
          chips: <><Design note="Route and archetype are design values; the screen id and columns are Book I H §5" /><Reading id="OQ-PF-40" /></>,
          actions: (
            <>
              {st.menu}
              <div className="w-36"><SelectField id="skf-p" label="" value={per} onChange={setPeriod} options={periods.map((p) => ({ value: p, label: p }))} /></div>
              <Button variant="outline" size="sm" {...writeProps(st)} onClick={() => { setQtr(""); setDlg("start") }}><Plus aria-hidden="true" /> New quarter</Button>
              <CsvButton filename={`skf-${per}.csv`} rows={rows.map((r) => ({ CostCenter: r.costCenterId, Headcount: r.headcount, SqFt: r.sqft, MachineHours: r.machineHours, LaborHours: r.laborHours, RevenueSharePct: r.revenueShare }))} />
            </>
          ),
          primary: (
            <Button onClick={() => { setTxt(""); setFileNote(""); setDlg("import") }} {...writeProps(st)}>
              <Upload aria-hidden="true" /> Import from workbook
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.costCenterId + r.period,
          searchText: (r) => `${r.costCenterId} ${COST_CENTERS.find((c) => c.id === r.costCenterId)?.name}`,
          loading: st.loading,
          densityKey: "CO-SKF-001",
          empty: { title: "No key figures for this quarter", body: "Start the quarter from the previous one, or import the workbook." },
        }}
        above={
          rows.length > 0 && !st.loading && !st.empty && Math.round(shareTotal) !== 100 && shareTotal > 0 ? (
            <p role="status" className="rounded-md border px-4 py-2 text-sm">
              <Chip kind="flag">Check</Chip> Revenue shares in {per} add up to {fmtNumber(shareTotal, 1)}%, not 100%: a Revenue Share allocation would not distribute the whole balance.
            </p>
          ) : undefined
        }
        below={
          <div className="flex flex-col gap-4">
            <Section title={`Change history, ${per} (${history.length})`}>
              {history.length ? (
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>On</TableHead>
                      <TableHead>Cost center</TableHead>
                      <TableHead>Figure</TableHead>
                      <TableHead className="text-right">Old</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Via</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id} className="h-8 text-[13px]">
                        <TableCell>{fmtDate(h.on)}</TableCell>
                        <TableCell>{h.costCenterId}</TableCell>
                        <TableCell>{LABEL[h.field as SkfField] ?? h.field}</TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(h.old)}</TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(h.new)}</TableCell>
                        <TableCell>{userName(h.by)}</TableCell>
                        <TableCell>{h.via}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No changes recorded for this quarter yet.</p>
              )}
            </Section>
            <RulesPanel
              rules={[
                ["H §5", "Driver value source: this table, maintained quarterly (hours may also come live from confirmations)", "[DOC:p.114]"],
                ["H §5", "Per cost center per period; import from XLSX; history kept", "[DOC:p.114]"],
                ["H §6", "The Controlling analyst maintains key figures; the Controller posts the cycles", "[DOC:p.115]"],
                ["V-CO-01", "Summary nodes are not postable, so they carry no key figures", "[DOC:p.111]"],
              ]}
            />
          </div>
        }
      />
      <DialogShell
        open={!!dlg && typeof dlg === "object"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg && typeof dlg === "object" ? `Edit ${dlg.edit.costCenterId}, ${dlg.edit.period}` : ""}
        confirmLabel="Save value"
        consequence="Changes the value and keeps the old one in the history. A posted allocation run is not restated: rerun the cycle to use it."
        onConfirm={() => (dlg && typeof dlg === "object" ? st.guard() ?? (field ? report(editSkfCell(dlg.edit.costCenterId as CostCenterId, dlg.edit.period, field, Number(val)), "Saved") : "Choose the figure to change.") : null)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="sk-f" label="Figure" value={field} onChange={setField} options={SKF_FIELDS.map((f) => ({ value: f, label: `${LABEL[f]}${dlg && typeof dlg === "object" ? ` (now ${fmtNumber(dlg.edit[f])})` : ""}` }))} />
          <TextField id="sk-v" type="number" label="New value" value={val} onChange={setVal} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: headcount and square feet are whole numbers; revenue share is a percentage up to 100.</p>}
      </DialogShell>
      <DialogShell
        open={dlg === "import"}
        onOpenChange={(o) => !o && setDlg(null)}
        wide
        title={`Import key figures into ${per}`}
        confirmLabel={`Import ${parsed.length} row(s)`}
        confirmDisabled={!parsed.length}
        consequence="Applies every row or none: one bad row stops the file and nothing changes. Changed values keep their old value in the history."
        onConfirm={() => st.guard() ?? report(importSkf(per, parsed), (r) => `${r.rows} rows read, ${r.changes} value(s) changed`)}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Columns: cost center, headcount, sq ft, machine hours, labor hours, revenue share %. A header row is skipped. Copy the rows from the workbook and paste them, or choose a CSV or TSV file.</p>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" className="text-sm" aria-label="Choose a workbook file" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (/\.xlsx$/i.test(f.name)) return setFileNote(`${f.name}: .xlsx workbooks are read by the import service; in the prototype copy the rows from Excel and paste them below.`)
            setFileNote(`${f.name} read`)
            setTxt(await f.text())
          }} />
          {fileNote && <p role="status" className="text-xs text-muted-foreground">{fileNote}</p>}
          <label htmlFor="sk-txt" className="text-sm font-medium">Rows</label>
          <textarea id="sk-txt" className="h-40 w-full rounded-md border bg-background p-2 font-mono text-xs" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={"CC-1100\t14\t18000\t4200\t6400\t0"} />
          {parsed.length > 0 && (
            <p className="text-sm">
              {parsed.length} row(s) read. {parsed.filter((r) => !COST_CENTERS.some((c) => c.id === r.costCenterId)).length} unknown cost center(s).
            </p>
          )}
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "start"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Start a quarter"
        confirmLabel="Start quarter"
        consequence={`Copies every row of ${periods[0] ?? "the latest quarter"} as the starting point; then edit or import the changes.`}
        onConfirm={() => st.guard() ?? report(startQuarter(qtr), (n) => { setPeriod(qtr); return `${qtr} started with ${n} rows` })}
      >
        <TextField id="sk-q" label="Quarter" value={qtr} onChange={setQtr} placeholder="2026-Q4" hint="Format year, dash, Q and the quarter number" />
      </DialogShell>
    </>
  )
}
