// FX-CVA-REPORTS Cost variance report layouts R1 to R4 (/inventory/valuation/reports, /:id); source Part A §8.3 [DOC:p.40]:
//  CVA-R1 Variance Summary by Type: 13 period columns, variance types as rows, totals row; Excel + PDF.
//  CVA-R2 PPV by Vendor: received value at standard, at actual, PPV $ and %, top contributing POs expandable.
//  CVA-R3 Production Variances by Order: WO rows with std cost of output, actual cost, MUV/LRV/LEV/OAV split, total variance,
//         settled date; subtotals by product line and by work center.
//  CVA-R4 Standard vs Actual by Item: period, standard, actual average, variance, %, GL posting ref, with filters.
// The workbench (INV-CVA-001) drills; these are the printable layouts. Excel is a CSV download here, PDF is the browser print.
// Positive variance = unfavorable (Part A §8 sign). Route and archetype are design values.
import { Fragment, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { ChevronDown, ChevronRight, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage, PageHeader } from "@/components/templates"
import { EmptyState, ErrorAlert } from "@/components/patterns"
import { PROFIT_CENTERS, WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { itemText, sumStd, sumVar, VARIANCE_TYPES, vendorName } from "../data/logic"
import { VAR_PERIODS } from "../data/seed"
import type { VarianceRow, VarianceType } from "../data/types"
import { CsvButton, DocLink, Reading, signCls } from "../components/common"
import { SelectField, SkeletonTable, TextField, VendorLink } from "../components/bits"
import { useNineStates } from "../components/states"
import { cn } from "@/lib/utils"

const REPORTS = [
  { id: "CVA-R1", title: "Variance summary by type", text: "Thirteen period columns, one row per variance type, a totals row. Excel and PDF." },
  { id: "CVA-R2", title: "PPV by vendor", text: "Received value at standard and at actual, PPV in dollars and percent, the top contributing receipts expandable." },
  { id: "CVA-R3", title: "Production variances by order", text: "One row per work order with the MUV, LRV, LEV and OAV split, subtotals by product line and by work center." },
  { id: "CVA-R4", title: "Standard versus actual by item", text: "Period, standard, actual average, variance, percent and GL posting reference across all items, with filters." },
] as const

const money = (n: number) => fmtMoney(n)
const Var = ({ v }: { v: number }) => <span className={cn("tabular", signCls(v))}>{fmtMoney(v)}</span>
const csvDownload = (name: string, rows: Record<string, string | number | undefined>[]) => <CsvButton filename={name} rows={rows} label="Excel (CSV)" />

export function CvaReportsIndex() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-CVA-REPORTS", { degraded: "Journal postings from the last hour are not in the ledger feed yet: the latest period may be incomplete." })
  const cur = VAR_PERIODS[VAR_PERIODS.length - 1]
  const inCur = s.variances.filter((v) => v.period === cur)
  return (
    <DashboardPage
      header={{
        screenId: "FX-CVA-REPORTS",
        title: "Cost variance reports",
        description: "The four printable layouts of the Cost Variance Workbench, for the period close and the audit file.",
        actions: st.menu,
        children: st.banner,
      }}
      tiles={[
        { label: `Variance lines in ${cur}`, value: fmtNumber(inCur.length) },
        { label: `Net variance in ${cur}`, value: fmtMoney(sumVar(inCur)), hint: "Positive is unfavorable" },
        { label: "Periods in R1", value: VAR_PERIODS.length },
        { label: "Layouts", value: 4 },
      ]}
    >
      {st.loading ? (
        <SkeletonTable cols={4} rows={4} />
      ) : st.empty ? (
        <EmptyState title="No variance lines yet">Variances post with receipts, invoices and order settlements.</EmptyState>
      ) : (
        REPORTS.map((r) => (
          <DashboardCard key={r.id} title={`${r.id} ${r.title}`} action={<Link className="text-sm text-link underline-offset-4 hover:underline" to={`/inventory/valuation/reports/${r.id}`}>Open</Link>}>
            <p className="text-sm text-muted-foreground">{r.text}</p>
          </DashboardCard>
        ))
      )}
    </DashboardPage>
  )
}

export function CvaReportDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates(`FX-CVA-REPORTS-${id}`, { degraded: "Journal postings from the last hour are not in the ledger feed yet: the latest period may be incomplete." })
  const rep = REPORTS.find((r) => r.id === id)
  const [periods, setPeriods] = useState("13")
  const [type, setType] = useState<VarianceType | "">("")
  const [q, setQ] = useState("")
  if (!rep)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader screenId="FX-CVA-REPORTS" title="Report not found" crumbs={[{ label: "Cost variance reports", to: "/inventory/valuation/reports" }]} />
        <ErrorAlert title={`No layout ${id}`}>The layouts are CVA-R1 to CVA-R4. <Link className="underline" to="/inventory/valuation/reports">Back to the reports</Link></ErrorAlert>
      </div>
    )
  const pl = VAR_PERIODS.slice(-Number(periods))
  const rows = s.variances.filter((v) => pl.includes(v.period))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="FX-CVA-REPORTS"
        title={`${rep.id} ${rep.title}`}
        crumbs={[{ label: "Cost variance reports", to: "/inventory/valuation/reports" }]}
        description={rep.text}
        actions={
          <>
            {st.menu}
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={st.loading || st.empty}>
              <Printer aria-hidden="true" /> PDF (print)
            </Button>
          </>
        }
      >
        {st.banner}
      </PageHeader>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44"><SelectField id="rp-p" label="Periods" value={periods} onChange={setPeriods} options={[{ value: "13", label: "13 periods" }, { value: "6", label: "Last 6" }, { value: "3", label: "Last 3" }]} /></div>
        {rep.id !== "CVA-R1" && rep.id !== "CVA-R3" && <div className="w-44"><SelectField id="rp-t" label="Variance type" value={type} onChange={setType} options={[{ value: "" as const, label: "All types" }, ...(rep.id === "CVA-R2" ? VARIANCE_TYPES.filter((t) => t.code === "PPV") : VARIANCE_TYPES).map((t) => ({ value: t.code, label: t.code }))]} /></div>}
        {rep.id === "CVA-R4" && <div className="w-56"><TextField id="rp-q" label="Item contains" value={q} onChange={setQ} /></div>}
      </div>
      {st.loading ? <SkeletonTable cols={8} rows={8} /> : st.empty || !rows.length ? <EmptyState title="No variance lines in these periods" /> : rep.id === "CVA-R1" ? <R1 rows={rows} periods={pl} /> : rep.id === "CVA-R2" ? <R2 rows={rows.filter((r) => r.type === "PPV")} /> : rep.id === "CVA-R3" ? <R3 rows={rows} /> : <R4 rows={rows} type={type} q={q} />}
      <p className="text-xs text-muted-foreground">Positive is unfavorable (actual above standard). Each number drills to its posting on the <Link className="text-link underline-offset-4 hover:underline" to="/inventory/valuation/cost-variance">Cost Variance Workbench</Link>. Excel is a CSV file; PDF is the browser print dialog.</p>
    </div>
  )
}

// ---------------------------------------------------------------- R1
function R1({ rows, periods }: { rows: VarianceRow[]; periods: string[] }) {
  const types = VARIANCE_TYPES.filter((t) => rows.some((r) => r.type === t.code))
  const cell = (t: VarianceType, p: string) => sumVar(rows.filter((r) => r.type === t && r.period === p))
  const data = types.map((t) => ({ t, vals: periods.map((p) => cell(t.code, p)), total: sumVar(rows.filter((r) => r.type === t.code)) }))
  const totals = periods.map((p) => sumVar(rows.filter((r) => r.period === p)))
  return (
    <DashboardCard title="Variance summary by type" action={csvDownload("cva-r1.csv", data.map((d) => ({ Type: d.t.code, ...Object.fromEntries(periods.map((p, i) => [p, d.vals[i]])), Total: d.total })))}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Type</TableHead>
              {periods.map((p) => <TableHead key={p} className="text-right">{p}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.t.code} className="h-8 text-[13px]">
                <TableCell title={d.t.name}><span className="font-semibold">{d.t.code}</span> <span className="text-xs text-muted-foreground">{d.t.account}</span></TableCell>
                {d.vals.map((v, i) => <TableCell key={i} className="text-right"><Var v={v} /></TableCell>)}
                <TableCell className="text-right font-medium"><Var v={d.total} /></TableCell>
              </TableRow>
            ))}
            <TableRow className="h-8 border-t-2 bg-muted text-[13px] font-semibold">
              <TableCell>Total</TableCell>
              {totals.map((v, i) => <TableCell key={i} className="text-right"><Var v={v} /></TableCell>)}
              <TableCell className="text-right"><Var v={sumVar(rows)} /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </DashboardCard>
  )
}

// ---------------------------------------------------------------- R2
function R2({ rows }: { rows: VarianceRow[] }) {
  const s = useSlice("purchasingFinance")
  const [open, setOpen] = useState<string[]>([])
  const vendors = useMemo(() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of rows) m.set(r.vendorId ?? "none", [...(m.get(r.vendorId ?? "none") ?? []), r])
    return [...m.entries()].map(([v, rs]) => ({ v, rs, std: sumStd(rs), act: Math.round(rs.reduce((t, r) => t + r.actual, 0) * 100) / 100, ppv: sumVar(rs) })).sort((a, b) => Math.abs(b.ppv) - Math.abs(a.ppv))
  }, [rows])
  const top = (rs: VarianceRow[]) => {
    const m = new Map<string, { ref: VarianceRow["source"]; v: number }>()
    for (const r of rs) m.set(r.source.id, { ref: r.source, v: (m.get(r.source.id)?.v ?? 0) + r.variance })
    return [...m.values()].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 5)
  }
  return (
    <DashboardCard title="PPV by vendor" action={csvDownload("cva-r2.csv", vendors.map((d) => ({ Vendor: d.v, ReceivedAtStandard: d.std, ReceivedAtActual: d.act, PPV: d.ppv, PPVPct: d.std ? Math.round((d.ppv / d.std) * 10000) / 100 : 0 })))}>
      {vendors.length ? (
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead />
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Received at standard</TableHead>
              <TableHead className="text-right">Received at actual</TableHead>
              <TableHead className="text-right">PPV $</TableHead>
              <TableHead className="text-right">PPV %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((d) => (
              <Fragment key={d.v}>
                <TableRow className="h-8 text-[13px]">
                  <TableCell>
                    <Button size="sm" variant="ghost" aria-expanded={open.includes(d.v)} aria-label={`Top contributing receipts for ${d.v}`} onClick={() => setOpen(open.includes(d.v) ? open.filter((x) => x !== d.v) : [...open, d.v])}>
                      {open.includes(d.v) ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                    </Button>
                  </TableCell>
                  <TableCell>{d.v === "none" ? "No vendor" : <VendorLink id={d.v} name={vendorName(s, d.v)} />}</TableCell>
                  <TableCell className="tabular text-right">{money(d.std)}</TableCell>
                  <TableCell className="tabular text-right">{money(d.act)}</TableCell>
                  <TableCell className="text-right"><Var v={d.ppv} /></TableCell>
                  <TableCell className={cn("tabular text-right", signCls(d.ppv))}>{d.std ? fmtPct((d.ppv / d.std) * 100, 2) : ""}</TableCell>
                </TableRow>
                {open.includes(d.v) && (
                  <TableRow className="bg-muted text-[13px]">
                    <TableCell />
                    <TableCell colSpan={5}>
                      <p className="mb-1 text-xs font-medium">Top contributing receipts</p>
                      <ul>{top(d.rs).map((t) => <li key={t.ref.id} className="flex gap-4"><DocLink r={t.ref} /> <Var v={t.v} /></li>)}</ul>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState title="No PPV in these periods" />
      )}
    </DashboardCard>
  )
}

// ---------------------------------------------------------------- R3
interface WoRow { id: string; item?: string; qty: number; std: number; act: number; muv: number; lrv: number; lev: number; oav: number; total: number; on: string; pc: string; wc?: string }
function R3({ rows }: { rows: VarianceRow[] }) {
  const wos = useMemo(() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of rows.filter((x) => x.source.type === "productionOrder")) m.set(r.source.id, [...(m.get(r.source.id) ?? []), r])
    return [...m.entries()].map(([id, rs]): WoRow => {
      const by = (t: VarianceType) => sumVar(rs.filter((r) => r.type === t))
      const sd = (t: VarianceType) => rs.find((r) => r.type === t)?.stdBasis ?? 0
      const std = sd("MUV") + sd("LRV") + sd("OAV")
      const total = rs.reduce((t, r) => t + r.variance, 0)
      const lead = rs.find((r) => r.workCenterId)
      return { id, item: rs[0].itemId, qty: rs.find((r) => r.type === "MUV")?.qty ?? 1, std: Math.round(std * 100) / 100, act: Math.round((std + total) * 100) / 100, muv: by("MUV"), lrv: by("LRV"), lev: by("LEV"), oav: by("OAV"), total: Math.round(total * 100) / 100, on: rs[0].on, pc: rs[0].profitCenterId, wc: lead?.workCenterId }
    }).sort((a, b) => b.on.localeCompare(a.on))
  }, [rows])
  const group = (key: (w: WoRow) => string) => {
    const m = new Map<string, WoRow[]>()
    for (const w of wos) m.set(key(w), [...(m.get(key(w)) ?? []), w])
    return [...m.entries()].map(([k, ws]) => ({ k, n: ws.length, std: ws.reduce((t, w) => t + w.std, 0), act: ws.reduce((t, w) => t + w.act, 0), total: ws.reduce((t, w) => t + w.total, 0) })).sort((a, b) => a.k.localeCompare(b.k))
  }
  const byPc = group((w) => w.pc)
  const byWc = group((w) => w.wc ?? "none")
  return (
    <div className="flex flex-col gap-4">
      <DashboardCard title={`Production variances by order (${wos.length})`} action={csvDownload("cva-r3.csv", wos.map((w) => ({ WO: w.id, Item: w.item, Qty: w.qty, StdCost: w.std, ActualCost: w.act, MUV: w.muv, LRV: w.lrv, LEV: w.lev, OAV: w.oav, Total: w.total, Settled: w.on })))}>
        {wos.length ? (
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-table-head">
                <TableRow>
                  <TableHead>Work order</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Output qty</TableHead>
                  <TableHead className="text-right">Std cost of output</TableHead>
                  <TableHead className="text-right">Actual cost</TableHead>
                  <TableHead className="text-right">MUV</TableHead>
                  <TableHead className="text-right">LRV</TableHead>
                  <TableHead className="text-right">LEV</TableHead>
                  <TableHead className="text-right">OAV</TableHead>
                  <TableHead className="text-right">Total variance</TableHead>
                  <TableHead>Settled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wos.map((w) => (
                  <TableRow key={w.id} className="h-8 text-[13px]">
                    <TableCell><DocLink r={{ type: "productionOrder", id: w.id }} /></TableCell>
                    <TableCell className="max-w-[200px] truncate" title={itemText(w.item)}>{w.item}</TableCell>
                    <TableCell className="tabular text-right">{fmtNumber(w.qty)}</TableCell>
                    <TableCell className="tabular text-right">{money(w.std)}</TableCell>
                    <TableCell className="tabular text-right">{money(w.act)}</TableCell>
                    <TableCell className="text-right"><Var v={w.muv} /></TableCell>
                    <TableCell className="text-right"><Var v={w.lrv} /></TableCell>
                    <TableCell className="text-right"><Var v={w.lev} /></TableCell>
                    <TableCell className="text-right"><Var v={w.oav} /></TableCell>
                    <TableCell className="text-right font-medium"><Var v={w.total} /></TableCell>
                    <TableCell>{fmtDate(w.on)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="No settled production orders in these periods" />
        )}
      </DashboardCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard title="Subtotals by product line">
          <SubTable rows={byPc.map((g) => ({ ...g, label: `${g.k} ${PROFIT_CENTERS.find((p) => p.id === g.k)?.name ?? ""}` }))} />
        </DashboardCard>
        <DashboardCard title="Subtotals by work center">
          <SubTable rows={byWc.map((g) => ({ ...g, label: `${g.k} ${WORK_CENTERS.find((w) => w.id === g.k)?.name ?? "Material only"}` }))} />
          <p className="text-xs text-muted-foreground">An order counts under the work center of its largest labor variance line.</p>
        </DashboardCard>
      </div>
    </div>
  )
}
function SubTable({ rows }: { rows: { label: string; n: number; std: number; act: number; total: number }[] }) {
  return (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Group</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Std cost</TableHead>
          <TableHead className="text-right">Actual cost</TableHead>
          <TableHead className="text-right">Variance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((g) => (
          <TableRow key={g.label} className="h-8 text-[13px]">
            <TableCell>{g.label}</TableCell>
            <TableCell className="tabular text-right">{g.n}</TableCell>
            <TableCell className="tabular text-right">{money(g.std)}</TableCell>
            <TableCell className="tabular text-right">{money(g.act)}</TableCell>
            <TableCell className="text-right"><Var v={g.total} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------- R4
function R4({ rows, type, q }: { rows: VarianceRow[]; type: VarianceType | ""; q: string }) {
  const data = useMemo(() => {
    const m = new Map<string, VarianceRow[]>()
    for (const r of rows.filter((x) => x.itemId && (!type || x.type === type) && (!q || `${x.itemId} ${itemText(x.itemId)}`.toLowerCase().includes(q.toLowerCase())))) {
      const k = `${r.period}|${r.itemId}|${r.type}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()].map(([k, rs]) => {
      const [period, itemId, t] = k.split("|")
      const qty = rs.reduce((a, r) => a + r.qty, 0) || 1
      const std = rs.reduce((a, r) => a + r.stdBasis, 0)
      const act = rs.reduce((a, r) => a + r.actual, 0)
      const v = sumVar(rs)
      return { period, itemId, t, stdU: std / qty, actU: act / qty, v, pct: std ? (v / std) * 100 : 0, je: rs[0].journalId }
    }).sort((a, b) => b.period.localeCompare(a.period) || a.itemId.localeCompare(b.itemId))
  }, [rows, type, q])
  const shown = data.slice(0, 200)
  return (
    <DashboardCard title={`Standard versus actual by item (${data.length} lines)`} action={csvDownload("cva-r4.csv", data.map((d) => ({ Period: d.period, Item: d.itemId, Type: d.t, Standard: d.stdU, ActualAvg: d.actU, Variance: d.v, Pct: Math.round(d.pct * 100) / 100, GL: d.je })))}>
      {shown.length ? (
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-table-head">
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Standard (unit)</TableHead>
                <TableHead className="text-right">Actual average (unit)</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>GL posting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((d) => (
                <TableRow key={d.period + d.itemId + d.t} className="h-8 text-[13px]">
                  <TableCell>{d.period}</TableCell>
                  <TableCell title={itemText(d.itemId)}>{d.itemId}</TableCell>
                  <TableCell>{d.t}</TableCell>
                  <TableCell className="tabular text-right">{fmtMoney(d.stdU)}</TableCell>
                  <TableCell className="tabular text-right">{fmtMoney(d.actU)}</TableCell>
                  <TableCell className="text-right"><Var v={d.v} /></TableCell>
                  <TableCell className={cn("tabular text-right", signCls(d.v))}>{fmtPct(d.pct, 2)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.je}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.length > shown.length && <p className="p-2 text-xs text-muted-foreground">Showing the latest {shown.length} of {data.length} lines; the Excel export carries all of them.</p>}
        </div>
      ) : (
        <EmptyState title="No lines match the filters" />
      )}
      <p className="text-xs text-muted-foreground">Items missing a standard land on the exception list, not here <Reading id="OQ-PF-25" />.</p>
    </DashboardCard>
  )
}
