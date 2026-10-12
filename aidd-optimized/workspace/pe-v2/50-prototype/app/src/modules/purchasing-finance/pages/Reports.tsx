// CO-R1..R4 Controlling Reports [DOC:p.273] (asserted); report content Book I H §6 [DOC:p.115].
// R1 cost center report with rollups, R2 profit center P&L with the reconciliation column, R3 work
// center cost and rate review (over / under absorption), R4 exception report. Actions: drill to
// journal items, export. Managers see their centers, Controller sees all. Report-set archetype is a
// design value. Budget figures stand in for ACC 21 and are design values.
import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert } from "@/components/patterns"
import { COST_CENTERS, PROFIT_CENTERS, WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { sumVar } from "../data/logic"
import { PC_PNL } from "../data/seed"
import type { JournalEntry } from "../data/types"
import { CsvButton, Design, DocLink, Reading, signCls, useDemoState } from "../components/common"
import { ccName, pcName, SelectField, SkeletonTable } from "../components/bits"
import { allCenters } from "./Centers"

const PERIODS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
const REPORTS = [
  { id: "CO-R1", title: "Cost center report", text: "Actuals by account group against budget, YTD, allocations received and sent, with hierarchy rollups." },
  { id: "CO-R2", title: "Profit center P&L", text: "Revenue, COGS at standard, production variances, gross margin, allocated SG&A, operating margin; the reconciliation column proves the sum equals the entity P&L." },
  { id: "CO-R3", title: "Work center cost and rate review", text: "Actual cost against absorbed labor and overhead; over or under absorption is the input to annual rate setting." },
  { id: "CO-R4", title: "CO exception report", text: "Rule-7 fallback postings, postings to blocked centers, P&L rows missing dimensions, PC-900 balance. Target zero." },
]

export function ReportsIndex() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CO-R0")
  const ex = s.journal.filter((j) => j.rule === 7).length
  return (
    <DashboardPage
      header={{ screenId: "CO-R1..R4", title: "Controlling reports", description: "The spend and margin accountability views. Managers see their own centers; the Controller sees all.", chips: <Design note="Report-set layout is a design value" />, actions: st.menu }}
      tiles={[
        { label: "Journal lines this year", value: fmtNumber(s.journal.length) },
        { label: "Live postings this session", value: s.journal.filter((j) => j.live).length, hint: "From posting.posted events" },
        { label: "Rule-7 fallbacks", value: ex, tone: ex ? "attention" : "default", to: "/controlling/reports/CO-R4" },
        { label: "PC-900 balance (Sep)", value: fmtMoney(s.journal.filter((j) => j.profitCenterId === "PC-900" && j.period === "2026-09").reduce((t, j) => t + j.amount, 0)), hint: "Target zero after allocations" },
      ]}
    >
      {st.loading ? (
        <DashboardCard title="Reports" className="lg:col-span-2">
          <SkeletonTable cols={3} rows={4} />
        </DashboardCard>
      ) : st.error ? (
        <DashboardCard title="Reports" className="lg:col-span-2">
          <ErrorAlert title="Reports could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>{st.error}</ErrorAlert>
        </DashboardCard>
      ) : st.empty ? (
        <DashboardCard title="Reports" className="lg:col-span-2">
          <EmptyState title="No postings yet">Reports fill as the ledger receives postings.</EmptyState>
        </DashboardCard>
      ) : (
        REPORTS.map((r) => (
          <DashboardCard key={r.id} title={`${r.id} · ${r.title}`} action={<Link className="text-sm text-link underline-offset-4 hover:underline" to={`/controlling/reports/${r.id}`}>Open</Link>}>
            <p className="text-sm">{r.text}</p>
          </DashboardCard>
        ))
      )}
    </DashboardPage>
  )
}

export function ReportDetail() {
  const { id = "" } = useParams()
  const st = useDemoState(`CO-R-${id}`)
  const meta = REPORTS.find((r) => r.id === id)
  const header = {
    screenId: "CO-R1..R4",
    title: meta ? `${meta.id} · ${meta.title}` : id,
    crumbs: [{ label: "Reports", to: "/controlling/reports" }],
    description: meta?.text,
    chips: <Design note="Report layout is a design value" />,
    actions: st.menu,
  }
  if (!meta)
    return (
      <DashboardPage header={header}>
        <DashboardCard title="Not found" className="lg:col-span-2">
          <EmptyState title={`No report ${id}`}>Choose CO-R1 to CO-R4 from the report set.</EmptyState>
        </DashboardCard>
      </DashboardPage>
    )
  if (st.loading || st.error || st.empty)
    return (
      <DashboardPage header={header}>
        <DashboardCard title={meta.title} className="lg:col-span-2">
          {st.loading ? <SkeletonTable cols={6} rows={8} /> : st.error ? <ErrorAlert title="Report could not run" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>{st.error}</ErrorAlert> : <EmptyState title="No data for this report">Nothing has posted in the selected period.</EmptyState>}
        </DashboardCard>
      </DashboardPage>
    )
  if (id === "CO-R1") return <R1 header={header} />
  if (id === "CO-R2") return <R2 header={header} />
  if (id === "CO-R3") return <R3 header={header} />
  return <R4 header={header} />
}

type Header = React.ComponentProps<typeof DashboardPage>["header"]

function JournalDrill({ rows, title, open, onOpenChange }: { rows: JournalEntry[]; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={title} description={`${rows.length} journal items (ACC 10 filters)`} confirmLabel="Close" onConfirm={() => null}>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Journal</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>CC / PC</TableHead>
              <TableHead className="text-right">Rule</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((j) => (
              <TableRow key={j.id} className="h-8 text-[13px]">
                <TableCell className="font-mono">{j.id}</TableCell>
                <TableCell>{fmtDate(j.on)}</TableCell>
                <TableCell>
                  {j.text} {j.live && <Chip kind="design">Live</Chip>}
                </TableCell>
                <TableCell>{j.source ? <DocLink r={j.source} /> : j.template}</TableCell>
                <TableCell>
                  {j.costCenterId ?? "none"} / {j.profitCenterId ?? "none"}
                </TableCell>
                <TableCell className="tabular text-right">{j.rule}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(j.amount, j.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DialogShell>
  )
}

// ---------------------------------------------------------------- CO-R1
function R1({ header }: { header: Header }) {
  const s = useSlice("purchasingFinance")
  const [sp] = useSearchParams()
  const [role] = useRole()
  const [cc, setCc] = useState(sp.get("cc") ?? "CC-1000")
  const [period, setPeriod] = useState("2026-09")
  const [drill, setDrill] = useState<JournalEntry[] | null>(null)
  const centers = allCenters(s)
  const leaves = (id: string): string[] => {
    const kids = centers.filter((c) => c.parentId === id)
    return kids.length ? kids.flatMap((k) => leaves(k.id)) : [id]
  }
  const scope = leaves(cc)
  const jr = (p: string) => s.journal.filter((j) => j.costCenterId && scope.includes(j.costCenterId) && j.period === p && j.template === "ACC expense")
  const groups = [...new Set(s.journal.filter((j) => j.template === "ACC expense").map((j) => j.text))].filter((t) => / \d{4}-\d{4}$/.test(t))
  const budgetOf = (g: string) => Math.round(["2026-05", "2026-06", "2026-07"].reduce((t, p) => t + jr(p).filter((j) => j.text === g).reduce((u, j) => u + j.amount, 0), 0) / 3)
  const ytdPeriods = PERIODS.filter((p) => p <= period)
  const rows = groups.map((g) => {
    const actual = jr(period).filter((j) => j.text === g).reduce((t, j) => t + j.amount, 0)
    const budget = budgetOf(g)
    const ytd = ytdPeriods.reduce((t, p) => t + jr(p).filter((j) => j.text === g).reduce((u, j) => u + j.amount, 0), 0)
    return { g, actual, budget, ytd }
  })
  const runs = s.allocRuns.filter((r) => r.period === period && r.state === "Posted")
  const received = runs.flatMap((r) => r.lines).filter((l) => scope.includes(l.receiverId)).reduce((t, l) => t + l.amount, 0)
  const sent = runs.flatMap((r) => r.lines).filter((l) => scope.includes(l.senderId)).reduce((t, l) => t + l.amount, 0)
  const tot = rows.reduce((t, r) => ({ actual: t.actual + r.actual, budget: t.budget + r.budget, ytd: t.ytd + r.ytd }), { actual: 0, budget: 0, ytd: 0 })
  return (
    <DashboardPage header={{ ...header, actions: <>{header.actions}<CsvButton filename={`co-r1-${cc}-${period}.csv`} rows={rows.map((r) => ({ Group: r.g, Actual: r.actual, Budget: r.budget, Variance: r.actual - r.budget, YTD: r.ytd }))} /></> }}>
      <DashboardCard title="Selection" className="lg:col-span-2">
        <div className="flex flex-wrap gap-4">
          <div className="w-72">
            <SelectField id="r1-cc" label="Cost center (summary nodes roll up)" value={cc} onChange={setCc} options={centers.map((c) => ({ value: c.id, label: `${"· ".repeat(c.depth)}${c.id} ${c.name}` }))} />
          </div>
          <div className="w-40">
            <SelectField id="r1-p" label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
          </div>
          <p className="self-end text-sm text-muted-foreground">
            Acting as {role}. Cost center managers see their own centers; the Controller sees all. Rolling up {scope.length} postable center(s).
          </p>
        </div>
      </DashboardCard>
      <DashboardCard title={`${cc} ${ccName(cc)} · ${period}`} className="lg:col-span-2">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Account group</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Variance %</TableHead>
              <TableHead className="text-right">YTD actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.g} className="h-8 cursor-pointer text-[13px]" onClick={() => setDrill(jr(period).filter((j) => j.text === r.g))}>
                <TableCell className="text-link underline-offset-4 hover:underline">{r.g}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.actual)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.budget)}</TableCell>
                <TableCell className={`tabular text-right ${signCls(r.actual - r.budget)}`}>{fmtMoney(r.actual - r.budget)}</TableCell>
                <TableCell className="tabular text-right">{r.budget ? fmtPct(((r.actual - r.budget) / r.budget) * 100) : ""}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.ytd)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="h-8 text-[13px] font-semibold">
              <TableCell>Primary costs</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(tot.actual)}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(tot.budget)}</TableCell>
              <TableCell className={`tabular text-right ${signCls(tot.actual - tot.budget)}`}>{fmtMoney(tot.actual - tot.budget)}</TableCell>
              <TableCell className="tabular text-right">{tot.budget ? fmtPct(((tot.actual - tot.budget) / tot.budget) * 100) : ""}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(tot.ytd)}</TableCell>
            </TableRow>
            <TableRow className="h-8 text-[13px]">
              <TableCell>Allocations received (#36)</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(received)}</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
            <TableRow className="h-8 text-[13px]">
              <TableCell>Allocations sent (#36)</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(-sent)}</TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Budget: <Design note="Budget comes from ACC 21; the prototype uses the May to July average as a stand-in" /> Choose a row to drill to its journal items.
        </p>
      </DashboardCard>
      <JournalDrill rows={drill ?? []} open={!!drill} onOpenChange={(o) => !o && setDrill(null)} title={`Journal items for ${cc}, ${period}`} />
    </DashboardPage>
  )
}

// ---------------------------------------------------------------- CO-R2
function R2({ header }: { header: Header }) {
  const s = useSlice("purchasingFinance")
  const [sga, setSga] = useState(true)
  const [period, setPeriod] = useState("2026-09")
  const pcs = PROFIT_CENTERS
  const prodVar = (pc: string) => sumVar(s.variances.filter((v) => v.profitCenterId === pc && v.period === period && ["MUV", "LRV", "LEV", "OAV", "SPV", "PPV", "IPV"].includes(v.type)))
  const sgaCCs = ["CC-3000", "CC-4000", "CC-5000", "CC-9100", "CC-9200", "CC-9300", "CC-9400", "CC-9500"]
  const sgaTotal = s.journal.filter((j) => j.period === period && j.costCenterId && sgaCCs.includes(j.costCenterId)).reduce((t, j) => t + j.amount, 0)
  const revTotal = pcs.reduce((t, p) => t + (PC_PNL[p.id]?.revenue ?? 0), 0)
  const cols = pcs.map((p) => {
    const rev = PC_PNL[p.id]?.revenue ?? 0
    const cogs = PC_PNL[p.id]?.cogs ?? 0
    const pv = prodVar(p.id)
    const gm = rev - cogs - pv
    const alloc = sga && revTotal ? Math.round((sgaTotal * rev) / revTotal) : 0
    return { p, rev, cogs, pv, gm, alloc, om: gm - alloc }
  })
  const unalloc = sga ? 0 : sgaTotal
  const sum = (k: "rev" | "cogs" | "pv" | "gm" | "alloc" | "om") => cols.reduce((t, c) => t + c[k], 0)
  const entity = { rev: sum("rev"), cogs: sum("cogs"), pv: sum("pv"), gm: sum("gm"), alloc: sga ? sum("alloc") : 0, om: sum("gm") - sgaTotal }
  const lines: { k: string; f: (c: (typeof cols)[number]) => number; e: number }[] = [
    { k: "Revenue", f: (c) => c.rev, e: entity.rev },
    { k: "COGS at standard", f: (c) => -c.cogs, e: -entity.cogs },
    { k: "Production and purchase variances", f: (c) => -c.pv, e: -entity.pv },
    { k: "Gross margin", f: (c) => c.gm, e: entity.gm },
    { k: "Allocated SG&A (revenue share)", f: (c) => -c.alloc, e: -(sga ? sgaTotal : 0) },
    { k: "Operating margin", f: (c) => c.om, e: entity.om + unalloc },
  ]
  return (
    <DashboardPage header={header}>
      <DashboardCard title="Selection" className="lg:col-span-2">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <SelectField id="r2-p" label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="r2-sga" checked={sga} onCheckedChange={setSga} />
            <Label htmlFor="r2-sga">Allocate SG&A to profit centers</Label>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard title={`Profit center P&L · ${period}`} className="lg:col-span-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Line</TableHead>
                {cols.map((c) => (
                  <TableHead key={c.p.id} className="text-right">
                    {c.p.id}
                    <div className="text-xs font-normal">{c.p.name}</div>
                  </TableHead>
                ))}
                <TableHead className="text-right">Sum of PCs</TableHead>
                <TableHead className="text-right">Entity P&L</TableHead>
                <TableHead className="text-right">Reconciliation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const sumPc = cols.reduce((t, c) => t + l.f(c), 0) - (l.k === "Operating margin" && !sga ? sgaTotal : 0)
                const diff = Math.round(sumPc - l.e)
                return (
                  <TableRow key={l.k} className={`h-8 text-[13px] ${l.k.includes("margin") ? "font-semibold" : ""}`}>
                    <TableCell>{l.k}</TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.p.id} className="tabular text-right">
                        {fmtMoney(l.f(c))}
                      </TableCell>
                    ))}
                    <TableCell className="tabular text-right">{fmtMoney(sumPc)}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(l.e)}</TableCell>
                    <TableCell className="tabular text-right">{diff === 0 ? "0 (reconciles)" : <Chip kind="flag">{fmtMoney(diff)}</Chip>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Revenue and COGS by profit center are <Design note="Revenue and COGS come from ACC; monthly values are design values" />. Variances come from the Cost Variance Workbench. {!sga && "SG&A not allocated: it sits in the entity column only."}
        </p>
      </DashboardCard>
    </DashboardPage>
  )
}

// ---------------------------------------------------------------- CO-R3
function R3({ header }: { header: Header }) {
  const s = useSlice("purchasingFinance")
  const [period, setPeriod] = useState("2026-09")
  const [drill, setDrill] = useState<JournalEntry[] | null>(null)
  const rate = (wc: string) => s.wcRates.filter((r) => r.workCenterId === wc && r.state === "Released").sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
  const rows = useMemo(
    () =>
      [...new Set(WORK_CENTERS.map((w) => w.costCenterId))].map((cc) => {
        const wcs = WORK_CENTERS.filter((w) => w.costCenterId === cc)
        const actual = s.journal.filter((j) => j.costCenterId === cc && j.period === period).reduce((t, j) => t + j.amount, 0)
        const skf = s.skf.find((k) => k.costCenterId === cc)
        const hours = skf ? Math.round(skf.laborHours / 3) : 0
        const r = wcs.map((w) => rate(w.id)).filter(Boolean)
        const lr = r.length ? r.reduce((t, x) => t + x!.laborRate, 0) / r.length : 0
        const or = r.length ? r.reduce((t, x) => t + x!.overheadRate, 0) / r.length : 0
        const absorbed = Math.round(hours * (lr + or))
        return { cc, wcs: wcs.map((w) => w.id).join(", "), actual, hours, lr, or, absorbed, diff: absorbed - actual }
      }),
    [s, period],
  )
  return (
    <DashboardPage header={header}>
      <DashboardCard title="Selection" className="lg:col-span-2">
        <div className="w-40">
          <SelectField id="r3-p" label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
        </div>
      </DashboardCard>
      <DashboardCard title={`Absorption by production cost center · ${period}`} className="lg:col-span-2">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Cost center</TableHead>
              <TableHead>Work centers</TableHead>
              <TableHead className="text-right">Actual cost</TableHead>
              <TableHead className="text-right">Confirmed hours</TableHead>
              <TableHead className="text-right">Labor + OH rate</TableHead>
              <TableHead className="text-right">Absorbed (#29)</TableHead>
              <TableHead className="text-right">Over / (under)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.cc} className="h-8 cursor-pointer text-[13px]" onClick={() => setDrill(s.journal.filter((j) => j.costCenterId === r.cc && j.period === period))}>
                <TableCell className="text-link underline-offset-4 hover:underline">
                  {r.cc} {ccName(r.cc)}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.wcs}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.actual)}</TableCell>
                <TableCell className="tabular text-right">{fmtNumber(r.hours)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.lr + r.or)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.absorbed)}</TableCell>
                <TableCell className={`tabular text-right ${signCls(-r.diff)}`}>{fmtMoney(r.diff)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Hours are a third of the quarter's labor-hour key figure <Design note="Confirmed hours per month are derived from the SKF; confirmations belong to production" />. Under-absorption feeds the next{" "}
          <Link className="text-link underline-offset-4 hover:underline" to="/costing/work-center-rates">
            rate setting
          </Link>
          .
        </p>
      </DashboardCard>
      <JournalDrill rows={drill ?? []} open={!!drill} onOpenChange={(o) => !o && setDrill(null)} title={`Journal items, ${period}`} />
    </DashboardPage>
  )
}

// ---------------------------------------------------------------- CO-R4
function R4({ header }: { header: Header }) {
  const s = useSlice("purchasingFinance")
  const [drill, setDrill] = useState<JournalEntry[] | null>(null)
  const centers = allCenters(s)
  const rule7 = s.journal.filter((j) => j.rule === 7)
  const blocked = s.journal.filter((j) => j.costCenterId && (centers.find((c) => c.id === j.costCenterId)?.status === "Blocked" || COST_CENTERS.find((c) => c.id === j.costCenterId)?.status === "Blocked") && j.period === "2026-10")
  const missing = s.journal.filter((j) => !j.profitCenterId || (!j.costCenterId && j.template !== "grn" && j.template !== "match"))
  const pc900 = PERIODS.map((p) => ({ p, v: s.journal.filter((j) => j.profitCenterId === "PC-900" && j.period === p).reduce((t, j) => t + j.amount, 0) - s.allocRuns.filter((r) => r.period === p && r.state === "Posted").reduce((t, r) => t + r.total, 0) }))
  const sections = [
    { k: "Rule-7 fallback postings", rows: rule7, note: "Derivation fell back to the default; reassign to a real center" },
    { k: "Postings to blocked centers", rows: blocked, note: "Posted while the center was Blocked for posting" },
    { k: "Rows missing dimensions", rows: missing, note: "Should be structurally zero; live postings without a source PO carry none" },
  ]
  return (
    <DashboardPage
      header={header}
      tiles={[
        ...sections.map((x) => ({ label: x.k, value: x.rows.length, tone: x.rows.length ? ("attention" as const) : ("default" as const), hint: "Target zero" })),
        { label: "PC-900 balance after allocations (Sep)", value: fmtMoney(pc900.find((x) => x.p === "2026-09")!.v), hint: `${pcName("PC-900")}: target zero` },
      ]}
    >
      {sections.map((x) => (
        <DashboardCard key={x.k} title={`${x.k} (${x.rows.length})`} action={x.rows.length ? <Button size="sm" variant="outline" onClick={() => setDrill(x.rows)}>Drill</Button> : undefined}>
          <p className="text-sm text-muted-foreground">{x.note}.</p>
          <ul className="text-sm">
            {x.rows.slice(0, 6).map((j) => (
              <li key={j.id}>
                <span className="font-mono">{j.id}</span> {fmtDate(j.on)} · {j.text} · {fmtMoney(j.amount, j.currency)}
              </li>
            ))}
            {!x.rows.length && <li>None.</li>}
          </ul>
        </DashboardCard>
      ))}
      <DashboardCard title="PC-900 balance by period">
        <Table>
          <TableBody>
            {pc900.map((x) => (
              <TableRow key={x.p} className="h-8 text-[13px]">
                <TableCell>{x.p}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(x.v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Corporate costs less what the allocation cycles distributed. Dimension derivation per template <Reading id="OQ-PF-14" />
        </p>
      </DashboardCard>
      <JournalDrill rows={drill ?? []} open={!!drill} onOpenChange={(o) => !o && setDrill(null)} title="Exception journal items" />
    </DashboardPage>
  )
}
