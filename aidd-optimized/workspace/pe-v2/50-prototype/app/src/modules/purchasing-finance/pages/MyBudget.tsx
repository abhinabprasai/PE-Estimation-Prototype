// FX-CO-BUDGET Cost center manager budget self-view (/controlling/my-budget); source Book I H §4 [DOC:p.113]: "the Budget vs
// Actual report gains a Cost Center Manager self-view (their centers only, RBAC-scoped); over-budget indicator at CC + account
// granularity", with the completeness check "every postable cost center must have a budget row set for the fiscal year"; role
// table [DOC:p.115]: the Cost Center Manager has own-center reports and budget entry (ACC 21) for own centers. Budget figures stand
// in for ACC 21 and are design values; the journal holds six months, so the window is May to October 2026. Managers are design
// values too (OQ-PF-23). Route and archetype are design values.
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState } from "@/components/patterns"
import type { CostCenterId } from "@/data/domain"
import { fmtMoney, fmtPct } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { allCenters } from "../data/centers"
import { approveBudget, saveBudget } from "../data/xactions"
import { BUDGET_GROUPS } from "../data/xseed"
import { CsvButton, Design, Reading, report, signCls } from "../components/common"
import { SelectField, SkeletonTable, TextField } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"
import { cn } from "@/lib/utils"

const WINDOW = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]

export function MyBudget() {
  const s = useSlice("purchasingFinance")
  const core = useCore()
  const st = useNineStates("FX-CO-BUDGET", { writers: "the center's manager, or the Controller", degraded: "Budget figures come from the budgeting module (ACC 21), which answered slowly: they may be up to a day old." })
  const centers = allCenters(s)
  const all = core.role === "Controller" || core.role === "CFO" || core.role === "Controlling analyst"
  const mine = centers.filter((c) => c.postable && (all || c.managerId === core.userId))
  const [cc, setCc] = useState<string>("all")
  const [fy, setFy] = useState("2027")
  const [dlg, setDlg] = useState<null | { cc: CostCenterId; group: string; current: number }>(null)
  const [amt, setAmt] = useState("")
  const sel = cc === "all" ? mine : mine.filter((c) => c.id === cc)
  const ids = new Set(sel.map((c) => c.id as string))

  const data = useMemo(() => {
    const lines = s.budgets.filter((b) => b.fy === 2026 && ids.has(b.costCenterId))
    return BUDGET_GROUPS.map(([group]) => {
      const annual = lines.filter((b) => b.group === group).reduce((t, b) => t + b.annual, 0)
      const budget = Math.round((annual / 12) * WINDOW.length)
      const actual = s.journal.filter((j) => ids.has(j.costCenterId ?? "") && j.text === group && WINDOW.includes(j.period)).reduce((t, j) => t + j.amount, 0)
      return { group, annual, budget, actual, variance: actual - budget, pct: budget ? (actual / budget) * 100 : 0 }
    })
  }, [s, ids])
  const tot = data.reduce((t, d) => ({ annual: t.annual + d.annual, budget: t.budget + d.budget, actual: t.actual + d.actual }), { annual: 0, budget: 0, actual: 0 })
  const perCc = useMemo(
    () => sel.map((c) => {
      const b = s.budgets.filter((x) => x.fy === 2026 && x.costCenterId === c.id).reduce((t, x) => t + x.annual, 0)
      const budget = Math.round((b / 12) * WINDOW.length)
      const actual = s.journal.filter((j) => j.costCenterId === c.id && WINDOW.includes(j.period)).reduce((t, j) => t + j.amount, 0)
      return { id: c.id, name: c.name, budget, actual, pct: budget ? (actual / budget) * 100 : 0 }
    }),
    [s, sel],
  )
  const monthly = WINDOW.map((p) => ({ period: p.slice(5), actual: s.journal.filter((j) => ids.has(j.costCenterId ?? "") && j.period === p).reduce((t, j) => t + j.amount, 0), budget: Math.round(tot.annual / 12) }))
  const overLines = data.filter((d) => d.pct > 105).length
  const next = Number(fy)
  const completeness = mine.map((c) => ({ c, lines: s.budgets.filter((b) => b.costCenterId === c.id && b.fy === next) }))
  const missing = completeness.filter((x) => x.lines.length < BUDGET_GROUPS.length)

  return (
    <>
      <DashboardPage
        header={{
          screenId: "FX-CO-BUDGET",
          title: "My cost center budget",
          description: all ? `Acting as ${core.role}: every postable cost center is in view.` : `Acting as ${core.role}: the cost centers where you are the named manager.`,
          chips: <><Design note="Budget figures stand in for ACC 21; route and archetype are design values">Budget: design values</Design><Reading id="OQ-PF-23" /></>,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="my-budget.csv" rows={data.map((d) => ({ Group: d.group, AnnualBudget: d.annual, WindowBudget: d.budget, Actual: d.actual, Variance: d.variance }))} />
            </>
          ),
          children: st.banner,
        }}
        tiles={[
          { label: "Centers in view", value: sel.length, hint: sel.map((c) => c.id).slice(0, 4).join(", ") },
          { label: "Actual, May to October", value: fmtMoney(tot.actual) },
          { label: "Budget for the same months", value: fmtMoney(tot.budget), hint: "Annual / 12 x 6 (design)" },
          { label: "Used", value: tot.budget ? fmtPct((tot.actual / tot.budget) * 100) : "n/a", tone: tot.budget && tot.actual / tot.budget > 1.05 ? "attention" : "default", hint: overLines ? `${overLines} account group(s) over budget` : "No account group over budget" },
        ]}
      >
        {st.loading ? (
          <SkeletonTable cols={6} rows={5} />
        ) : st.empty || !mine.length ? (
          <div className="lg:col-span-2">
            <EmptyState title="No cost centers to show">{st.empty ? "Nothing to show in this preview state." : `Acting as ${core.role}: you see the cost centers where you are the named manager, and none is assigned to you. Switch Acting as to a cost center manager (for example the Production supervisor) or to the Controller.`}</EmptyState>
          </div>
        ) : (
          <>
            <DashboardCard title="Budget against actual by account group" className="lg:col-span-2" action={<div className="w-56"><SelectField id="mb-cc" label="" value={cc} onChange={setCc} options={[{ value: "all", label: "All centers in view" }, ...mine.map((c) => ({ value: c.id, label: `${c.id} ${c.name}` }))]} /></div>}>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Account group</TableHead>
                    <TableHead className="text-right">Annual budget</TableHead>
                    <TableHead className="text-right">Budget to date</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead>Indicator</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.group} className="h-8 text-[13px]">
                      <TableCell>{d.group}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(d.annual)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(d.budget)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(d.actual)}</TableCell>
                      <TableCell className={cn("tabular text-right", signCls(d.variance))}>{fmtMoney(d.variance)}</TableCell>
                      <TableCell className="tabular text-right">{d.budget ? fmtPct(d.pct) : ""}</TableCell>
                      <TableCell>{d.pct > 105 ? <Chip kind="flag">Over budget</Chip> : d.pct > 95 ? <Chip kind="design" note="Between 95% and 105% of budget to date">Watch</Chip> : "Within budget"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted text-[13px] font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(tot.annual)}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(tot.budget)}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(tot.actual)}</TableCell>
                    <TableCell className={cn("tabular text-right", signCls(tot.actual - tot.budget))}>{fmtMoney(tot.actual - tot.budget)}</TableCell>
                    <TableCell className="tabular text-right">{tot.budget ? fmtPct((tot.actual / tot.budget) * 100) : ""}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">The over-budget indicator evaluates at cost center and account level; the 105% line is a <Design note="The PRD names the indicator, not the percentage">design value</Design>.</p>
            </DashboardCard>
            <DashboardCard title="Month by month">
              <ChartContainer config={{ actual: { label: "Actual", color: "var(--chart-1)" }, budget: { label: "Budget", color: "var(--chart-3)" } }} className="h-56 w-full">
                <BarChart data={monthly}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="actual" fill="var(--color-actual)" />
                  <Bar dataKey="budget" fill="var(--color-budget)" />
                </BarChart>
              </ChartContainer>
            </DashboardCard>
            <DashboardCard title="By cost center">
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Center</TableHead>
                    <TableHead className="text-right">Budget to date</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perCc.map((p) => (
                    <TableRow key={p.id} className="h-8 text-[13px]">
                      <TableCell>{p.id} {p.name}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(p.budget)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(p.actual)}</TableCell>
                      <TableCell className={cn("tabular text-right", p.pct > 105 && "font-semibold text-status-cancelled-ink")}>{fmtPct(p.pct)}{p.pct > 105 ? " over" : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DashboardCard>
            <DashboardCard title={`Budget entry for FY${fy}`} className="lg:col-span-2" action={<div className="w-28"><SelectField id="mb-fy" label="" value={fy} onChange={setFy} options={[{ value: "2027", label: "FY2027" }, { value: "2026", label: "FY2026" }]} /></div>}>
              <p className="text-sm">
                {missing.length ? <><Chip kind="flag">Incomplete</Chip> {missing.length} of {mine.length} center(s) have no complete FY{fy} budget: {missing.slice(0, 8).map((m) => m.c.id).join(", ")}{missing.length > 8 ? "..." : ""}.</> : <>Every center in view has a complete FY{fy} budget.</>} The budget cycle checks that every postable cost center has a budget row.
              </p>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Center</TableHead>
                    {BUDGET_GROUPS.map(([g]) => <TableHead key={g} className="text-right">{g.split(" ")[0]}</TableHead>)}
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completeness.map(({ c, lines }) => (
                    <TableRow key={c.id} className="h-8 text-[13px]">
                      <TableCell>{c.id} {c.name}</TableCell>
                      {BUDGET_GROUPS.map(([g]) => {
                        const l = lines.find((x) => x.group === g)
                        return (
                          <TableCell key={g} className="tabular text-right">
                            <button className="underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60" disabled={!!st.blockReason || (c.managerId !== core.userId && core.role !== "Controller")} title={st.blockReason ?? (c.managerId !== core.userId && core.role !== "Controller" ? "Budget entry is the center manager's or the Controller's" : undefined)} onClick={() => { setAmt(l ? String(l.annual) : ""); setDlg({ cc: c.id as CostCenterId, group: g, current: l?.annual ?? 0 }) }}>
                              {l ? fmtMoney(l.annual) : <span className="text-status-blocked-ink">Missing</span>}
                            </button>
                          </TableCell>
                        )
                      })}
                      <TableCell>{lines.length < BUDGET_GROUPS.length ? "Incomplete" : lines.every((l) => l.status === "Approved") ? "Approved" : "Draft"}</TableCell>
                      <TableCell>
                        {core.role === "Controller" && lines.length > 0 && lines.some((l) => l.status === "Draft") && <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => report(approveBudget(c.id as CostCenterId, next), `${c.id} FY${fy} approved`)}>Approve</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">The manager enters a draft; the Controller approves <Reading id="OQ-PF-34" />. Click an amount to enter or change it.</p>
            </DashboardCard>
          </>
        )}
      </DashboardPage>
      <DialogShell
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg ? `${dlg.cc} · ${dlg.group} · FY${fy}` : ""}
        confirmLabel="Save budget line"
        consequence="Saves the annual amount as a draft for the Controller to approve (a Controller's own entry is approved). The over-budget indicator then uses it."
        onConfirm={() => (dlg ? st.guard() ?? report(saveBudget(dlg.cc, next, dlg.group, Number(amt)), "Budget line saved") : null)}
      >
        <TextField id="mb-a" type="number" label="Annual amount (USD)" value={amt} onChange={setAmt} hint={dlg?.current ? `Now ${fmtMoney(dlg.current)}` : "No amount yet"} />
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: the amount must be a number from 0 and the center must be one you manage.</p>}
      </DialogShell>
    </>
  )
}
