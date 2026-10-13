// FX-OM-EAC ETO order cost panel (/sales/eto-cost) [DOC:p.211 Book IV §7.6].
// Per ETO order: estimate (the released cost estimate) against committed (open POs, LLR exposure, subcontract
// commitments), actual (WIP charges) and the estimate at completion (EAC); margin at completion against the
// quoted price. EAC = actuals + remaining operations at standard + unissued material at current basis + open
// commitments not yet consumed.
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, RulesPanel } from "@/components/patterns"
import { DialogShell, PageHeader } from "@/components/templates"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { money, orderValue, type SalesOrder } from "../../data/model"
import { postWipCharge, rebaselineEto } from "../../fx/actions"
import { MARGIN_FLOOR_PCT, MARGIN_TARGET_PCT, etoTotals, type EtoCost } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { PickField, StaleTag, StateBar, StateGate, TextField, report, useFxState, type FxState } from "./kit"

const pct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`

export function EtoCostPanel({ order, cost, st }: { order: SalesOrder; cost: EtoCost; st: FxState }) {
  const quoted = orderValue(order)
  const t = etoTotals(cost, quoted)
  const [wipOpen, setWipOpen] = useState(false)
  const [baseOpen, setBaseOpen] = useState(false)
  const [line, setLine] = useState("mat")
  const [amount, setAmount] = useState("")
  const [delta, setDelta] = useState("")
  const verdict = t.macPct < MARGIN_FLOOR_PCT ? "Below the margin floor" : t.macPct < MARGIN_TARGET_PCT ? "Below target" : "On target"
  const deg = st.state === "degraded"
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Quoted price", money(quoted, order.currency), `${cost.units} unit${cost.units === 1 ? "" : "s"}`],
          ["Estimate", money(t.estimate), `${pct(t.estMarginPct)} margin as quoted`],
          ["Committed", money(t.committed), `incl. LLR exposure ${money(t.llrExposure)}`],
          ["Actual", money(t.actual), "WIP charges to date"],
          ["Remaining", money(t.remaining), "operations and unissued material"],
          ["EAC", money(t.eac), `${t.variance >= 0 ? "+" : ""}${money(t.variance)} vs estimate`],
          ["Margin at completion", `${money(t.mac)}`, `${pct(t.macPct)} · ${verdict}`],
        ].map(([k, v, h]) => (
          <div key={k} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="tabular text-lg font-semibold">{v}<StaleTag show={deg && (k === "Committed" || k === "EAC")} /></dd>
            <dd className="text-xs text-muted-foreground">{h}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        EAC = actual {money(t.actual)} + remaining {money(t.remaining)} + committed {money(t.committed)} = <strong>{money(t.eac)}</strong>.
        <Reading id="SR-28" note="Margin target 22% and floor 15% are design values: the PRD says 'margin below target' without a figure." />
      </p>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow><TableHead>Cost line</TableHead><TableHead className="text-right">Estimate</TableHead><TableHead className="text-right">Committed</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Remaining</TableHead><TableHead className="text-right">EAC</TableHead><TableHead className="text-right">Variance</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {cost.lines.map((l) => {
            const eac = l.actual + l.remaining + l.committed
            return (
              <TableRow key={l.id}>
                <TableCell>{l.label}</TableCell>
                <TableCell className="tabular text-right">{money(l.estimate)}</TableCell>
                <TableCell className="tabular text-right">{money(l.committed)}</TableCell>
                <TableCell className="tabular text-right">{money(l.actual)}</TableCell>
                <TableCell className="tabular text-right">{money(l.remaining)}</TableCell>
                <TableCell className="tabular text-right">{money(eac)}</TableCell>
                <TableCell className={`tabular text-right ${eac > l.estimate ? "text-destructive" : ""}`}>{eac - l.estimate >= 0 ? "+" : ""}{money(eac - l.estimate)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="tabular text-right">{money(t.estimate)}</TableCell>
            <TableCell className="tabular text-right">{money(t.committed)}</TableCell>
            <TableCell className="tabular text-right">{money(t.actual)}</TableCell>
            <TableCell className="tabular text-right">{money(t.remaining)}</TableCell>
            <TableCell className="tabular text-right">{money(t.eac)}</TableCell>
            <TableCell className="tabular text-right">{t.variance >= 0 ? "+" : ""}{money(t.variance)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <Section title="Long-lead risk (LLR) exposure: open commitment against its cap" action={<Chip kind="oq" id="OQ-14" note="LLR cap and cancellation fees are held on the LLR record in Planning; shown here read-only." />}>
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>LLR</TableHead><TableHead className="text-right">Cap</TableHead><TableHead className="text-right">Open PO value</TableHead><TableHead className="text-right">Cancellation fees</TableHead><TableHead className="w-48">Exposure vs cap</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader>
          <TableBody>
            {cost.llr.map((l) => {
              const exp = l.openPoValue + l.cancellationFees
              return (
                <TableRow key={l.id}>
                  <TableCell>{l.id}<span className="block text-xs text-muted-foreground">{l.label}</span></TableCell>
                  <TableCell className="tabular text-right">{money(l.cap)}</TableCell>
                  <TableCell className="tabular text-right">{money(l.openPoValue)}</TableCell>
                  <TableCell className="tabular text-right">{money(l.cancellationFees)}</TableCell>
                  <TableCell><Progress value={Math.min(100, (exp / l.cap) * 100)} aria-label={`${l.id} exposure against cap`} /><span className="text-xs text-muted-foreground">{pct((exp / l.cap) * 100)} of cap{exp > l.cap ? " (over cap)" : ""}</span></TableCell>
                  <TableCell>{l.risk}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Section>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setWipOpen(true)} disabled={!st.writable} title={st.why || undefined}>Post WIP charge</Button>
        <Button variant="outline" onClick={() => setBaseOpen(true)} disabled={!st.writable} title={st.why || undefined}>Re-baseline estimate</Button>
        <span className="text-sm text-muted-foreground">Cost estimate {cost.ceId}; estimate version {cost.baselines.length}.</span>
      </div>
      <Section title="Estimate baselines">
        <ol className="flex flex-col gap-1 text-sm">
          {[...cost.baselines].reverse().map((b) => <li key={b.version}>v{b.version} · {b.at} · {b.by} · {money(b.estimate)} · {b.reason}</li>)}
        </ol>
      </Section>
      <DialogShell open={wipOpen} onOpenChange={setWipOpen} title={`Post a WIP charge to ${order.id}`} description="A WIP charge moves cost into Actual. It consumes the uncommitted remainder first, then open commitments." consequence={`Adds ${amount ? money(Number(amount) || 0) : "the amount"} to Actual on the chosen line; EAC changes only if the charge exceeds what was remaining.`} confirmLabel="Post charge" onConfirm={() => { const e = report(postWipCharge(order.id, line, Number(amount)), "WIP charge posted"); if (!e) setAmount(""); return e }}>
        <PickField label="Cost line" value={line} onChange={setLine} options={cost.lines.map((l) => ({ value: l.id, label: l.label }))} />
        <TextField id="wip-amt" label="Amount (USD)" type="number" value={amount} onChange={setAmount} />
      </DialogShell>
      <DialogShell open={baseOpen} onOpenChange={setBaseOpen} title={`Re-baseline the estimate for ${order.id}`} description="Used when a change order or a supplier change moves the released estimate. Material is adjusted; the old baseline stays in the list." consequence={`Estimate ${money(t.estimate)} becomes ${money(t.estimate + (Number(delta) || 0))}. Margin at completion is recomputed from the new EAC.`} requireReason reasonLabel="Change order or reason (required)" confirmLabel="Re-baseline" onConfirm={(reason) => { const r = rebaselineEto(order.id, Number(delta), reason); const e = report(r, "Estimate re-baselined"); if (!e) setDelta(""); else toast.dismiss(); return e }}>
        <TextField id="base-delta" label="Change in estimate (USD, negative to reduce)" type="number" value={delta} onChange={setDelta} hint="Only Estimator, Cost accountant, Controlling analyst and Controller re-baseline." />
      </DialogShell>
    </div>
  )
}

export function EtoCostPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const [sp, setSp] = useSearchParams()
  const ids = Object.keys(db.fx.etoCost)
  const soId = sp.get("so") && ids.includes(sp.get("so")!) ? sp.get("so")! : ids.at(-1) ?? ""
  const order = db.orders.find((o) => o.id === soId)
  const cost = db.fx.etoCost[soId]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ETO order cost panel"
        screenId="FX-OM-EAC"
        description="Estimate against committed (including long-lead risk exposure), actual and the estimate at completion, with the margin at completion on the quoted price."
        actions={order ? <><Button variant="outline" asChild><Link to={`/sales/orders/${order.id}`}>Open {order.id}</Link></Button><Button variant="outline" asChild><Link to={`/sales/billing-plan?so=${order.id}`}>Billing plan</Link></Button></> : undefined}
      />
      <StateBar st={st} />
      <div className="max-w-md">
        <PickField label="ETO sales order" value={soId} onChange={(v) => setSp((p) => { const n = new URLSearchParams(p); n.set("so", v); return n }, { replace: true })} options={ids.map((id) => { const o = db.orders.find((x) => x.id === id); return { value: id, label: `${id} · ${o?.status ?? ""}` } })} />
        {order && <p className="mt-1 text-sm"><StatusBadge kind="salesOrder" status={order.status} /></p>}
      </div>
      <StateGate st={st} empty={{ title: "No ETO orders with a cost panel", body: "A cost panel opens when an ETO order is confirmed from a quotation with a released cost estimate." }}>
        {order && cost ? <EtoCostPanel order={order} cost={cost} st={st} /> : <p className="text-sm text-muted-foreground">No cost panel for this order.</p>}
      </StateGate>
      <RulesPanel rules={[
        ["EAC-1", "EAC = actuals + remaining operations at standard + unissued material at current basis + open commitments not yet consumed.", "DOC:p.211 §7.6"],
        ["EAC-2", "Committed cost includes open POs, LLR exposure and subcontract commitments.", "DOC:p.211 §7.6"],
        ["EAC-3", "A change order re-baselines the estimate; the earlier baseline stays visible.", "DOC:p.211 §7.6"],
        ["EAC-4", "Margin at completion = quoted price less EAC; shown against the target and floor (design values, reading SR-28).", "Design value"],
      ]} />
    </div>
  )
}
