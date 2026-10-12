// PP-SETTLE-001 Settlement Run [DOC:p.78 §8.2; p.263 Book VI] (asserted). Wizard.
// Eligible order list, per-order variance preview split by cause (5220 / 5230 / 5240 / 5250),
// post step with journal links. Post drives every order's WIP balance to exactly zero (#32).
// Reopen of a settled order needs the Controller (WO detail, WF-INBOX) and reverses first.

import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, PostingPreview, RulesPanel, StatusBadge } from "@/components/patterns"
import { WizardPage } from "@/components/templates"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useCore, useRole, useSlice } from "@/store"
import { BodyState, StatePreview, WoLink, qty, useActDialog, useScreenState } from "../components"
import * as act from "../lib/actions"
import { closeChecks, unsettledBreach } from "../lib/gates"
import { variances } from "../lib/plan"

export function SettlementRun() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-SETTLE-001")
  const runD = useActDialog()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const completed = st.empty ? [] : s.productionOrders.filter((w) => w.status === "Completed")
  const eligible = completed.filter((w) => act.settlementEligible(s, w))
  const [sel, setSel] = useState<string[]>(() => eligible.map((w) => w.id))
  const [posted, setPosted] = useState<string | null>(params.get("run"))
  const chosen = eligible.filter((w) => sel.includes(w.id))
  const prev = chosen.map((w) => ({ w, v: variances(s, w) }))
  const total = prev.reduce((a, x) => a + x.v.residual, 0)
  const run = s.settlements.find((x) => x.id === posted)
  const [role] = useRole()
  const core = useCore()
  const sod = act.settlementSod(s, role, core.userId, chosen.map((w) => w.id))

  if (run) {
    return (
      <div className="flex flex-col gap-4">
        <WizardPage
          header={{ title: `Settlement run ${run.id}`, screenId: "PP-SETTLE-001", description: `Posted ${fmtDate(run.postedOn)} by ${run.by} for period ${run.period}.${run.reversed ? ` Partly reversed ${run.reversed.on} for reopen.` : ""}`, actions: <StatePreview /> }}
          steps={[{
            id: "done", title: "Posted",
            content: (
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead className="text-right">5220 material usage</TableHead><TableHead className="text-right">5230 labor rate</TableHead><TableHead className="text-right">5240 labor efficiency</TableHead><TableHead className="text-right">5250 overhead absorption</TableHead><TableHead>Journal</TableHead><TableHead>Order status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {run.orders.map((o) => {
                    const w = s.productionOrders.find((x) => x.id === o.woId)
                    return (
                      <TableRow key={o.woId}>
                        <TableCell><WoLink id={o.woId} /></TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(o.mat)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(o.lrv)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(o.lev)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(o.oav)}</TableCell>
                        <TableCell className="font-mono text-xs">{o.journalId}{run.reversed?.journalIds.length ? <span className="block text-muted-foreground">reversal {run.reversed.journalIds.join(", ")}</span> : null}</TableCell>
                        <TableCell>{w && <StatusBadge kind="productionOrder" status={w.status} size="sm" />}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ),
          }]}
          finishLabel="New settlement run"
          consequence="Every order above carries zero WIP; variances sit on 5220 to 5250 with the production cost center of the primary work center."
          onFinish={() => (setPosted(null), nav("/production/settlement", { replace: true }), null)}
        />
      </div>
    )
  }

  return (
    <BodyState state={st} what="Settlement run">
      <WizardPage
        header={{
          title: "Settlement run",
          screenId: "PP-SETTLE-001",
          description: `Month-end run for ${TODAY.slice(0, 7)}: residual WIP of each Completed order clears to the variance accounts split by cause. Posted by the Cost accountant; the Controller reopens. Previous runs: ${s.settlements.map((x) => x.id).join(", ")}.`,
          actions: <StatePreview />,
          children: sod ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{sod}</p> : undefined,
        }}
        steps={[
          {
            id: "pick", title: "Eligible orders",
            validate: () => (chosen.length ? null : "Select at least one eligible order."),
            content: completed.length === 0 ? (
              <EmptyState title="No Completed orders">Orders become eligible after FG receipt (#31) with all operations confirmed and inspections closed.</EmptyState>
            ) : (
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead className="w-10" /><TableHead>Order</TableHead><TableHead>Item</TableHead><TableHead>Completed</TableHead><TableHead>Close checks</TableHead><TableHead className="text-right">WIP to clear</TableHead></TableRow></TableHeader>
                <TableBody>
                  {completed.map((w) => {
                    const checks = closeChecks(s, w)
                    const ok = checks.every((c) => c.ok)
                    return (
                      <TableRow key={w.id}>
                        <TableCell><Checkbox aria-label={`Select ${w.id}`} disabled={!ok} checked={sel.includes(w.id) && ok} onCheckedChange={(v) => setSel(v ? [...sel, w.id] : sel.filter((x) => x !== w.id))} /></TableCell>
                        <TableCell><WoLink id={w.id} /></TableCell>
                        <TableCell className="font-mono text-xs">{w.itemId}</TableCell>
                        <TableCell className="tabular text-xs">{fmtDate(w.completedOn)} {unsettledBreach(w) && <Chip kind="flag" note="Completed more than 5 days and not settled">&gt; 5 d</Chip>}</TableCell>
                        <TableCell className="text-sm">{ok ? "All pass" : checks.filter((c) => !c.ok).map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("; ")}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(variances(s, w).residual)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "preview", title: "Variance preview",
            content: (
              <div className="flex flex-col gap-4">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Order</TableHead><TableHead className="text-right">Std / actual hours</TableHead><TableHead className="text-right">5220 material usage</TableHead><TableHead className="text-right">5230 labor rate</TableHead><TableHead className="text-right">5240 labor efficiency</TableHead><TableHead className="text-right">5250 overhead absorption</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {prev.map(({ w, v }) => (
                      <TableRow key={w.id}>
                        <TableCell><WoLink id={w.id} /></TableCell>
                        <TableCell className="tabular text-right">{qty(v.stdHours)} / {qty(v.actHours)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(v.mat)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(v.lrv)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(v.lev)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(v.oav)}</TableCell>
                        <TableCell className="tabular text-right font-semibold">{fmtMoney(v.residual)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground">Positive = unfavorable (debit the variance account); negative = favorable (credit). Labor is applied by #29 at standard rates, so the labor rate variance carries no WIP residual in the prototype <Chip kind="design" note="Actual payroll rates are not in scope of the prototype">Design value</Chip>.</p>
              </div>
            ),
          },
          {
            id: "post", title: "Post",
            content: <PostingPreview lines={prev.map(({ w, v }) => ({ template: 32 as const, amount: v.residual, detail: `${w.id}: 5220 ${fmtMoney(v.mat)} · 5240 ${fmtMoney(v.lev)} · 5250 ${fmtMoney(v.oav)}` }))} period={TODAY.slice(0, 7)} />,
          },
        ]}
        finishLabel={`Post ${chosen.length} settlement(s)`}
        consequence={`Posts #32 for ${chosen.length} order(s), ${fmtMoney(total)} in total; each order's WIP becomes exactly zero and its status Closed (TECO). Reopening later needs the Controller and reverses the settlement first.`}
        onFinish={() => runD((d, c) => act.settleOrders(d, c, chosen.map((w) => w.id)), (id) => (setPosted(id), `${id} posted`))}
      />
      <RulesPanel className="mt-6" rules={[
        ["§8.2", "Close is allowed when all ops are confirmed or cancelled, all inspections closed, FG received or scrap-disposed", "DOC:p.78 §8.2"],
        ["§8.2", "Settlement clears residual WIP to 5220 / 5230 / 5240 / 5250 split by cause; after settlement WIP is exactly zero by construction", "DOC:p.78 §8.2"],
        ["§9", "Production rework orders merge into the parent before its settlement", "DOC:p.79 §9"],
        ["Close", "Completed more than 5 days and not settled is a breach on the close checklist", "DOC:p.126; p.179"],
        ["Roles", "Cost accountant posts the run; Controller reopens; whoever confirmed an order's operations does not settle it (WO confirm is not settlement approve)", "DOC:p.263 Book VI; p.179 FL-04 f3"],
      ]} />
    </BodyState>
  )
}
