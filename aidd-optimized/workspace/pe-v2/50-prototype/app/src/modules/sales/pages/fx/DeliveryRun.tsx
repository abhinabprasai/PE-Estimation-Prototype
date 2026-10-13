// FX-OM-DLVRUN Delivery creation run wizard (/sales/deliveries/create-run) [DOC:p.207 Book IV §2.3].
// Horizon and scope -> simulated grouping, every group with the id of the split or merge rule that fired
// (E-DLV-01) -> create -> result log. Mandatory splits: ship-to, Incoterms, hazmat, over-dimensional, no-partial;
// elective: schedules more than N days apart, equipment type, weight over vehicle capacity.
import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, WizardPage } from "@/components/templates"
import { Chip, RulesPanel } from "@/components/patterns"
import { useSlice } from "@/store"
import { addDays, listDate, TODAY } from "../../data/model"
import { executeRun } from "../../fx/actions"
import { simulateRun, defaultRunOpts, type RunOpts } from "../../fx/derive"
import { DATE_WINDOW_DAYS, DELIVERY_RULES, VEHICLE_CAPACITY_KG, ruleById } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { PickField, StateBar, StateGate, TextField, useFxState } from "./kit"

type Res = ReturnType<typeof executeRun> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never

export function RuleChip({ id }: { id: string }) {
  const r = ruleById(id)
  return <span title={r ? `${r.name} [${r.source}]` : "Rule not recorded"} className="inline-flex h-6 items-center rounded-lg border bg-background px-2 font-mono text-xs">{id}</span>
}

export function DeliveryRunPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const nav = useNavigate()
  const [o, setO] = useState<RunOpts>({ ...defaultRunOpts(), horizonDays: 14 })
  const [mode, setMode] = useState<"On demand" | "Nightly">("On demand")
  const [res, setRes] = useState<Res | null>(null)
  const sim = useMemo(() => simulateRun(db, o), [db, o])
  const whs = [...new Set(db.orders.flatMap((x) => x.lines.map((l) => l.warehouse)))]
  const custs = db.customers.filter((c) => c.status === "Active")
  const scope = `${o.warehouses.length ? o.warehouses.join(", ") : "all warehouses"}; ${o.customers.length ? `${o.customers.length} customer(s)` : "all customers"}`
  const cname = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
  const toggle = (key: "warehouses" | "customers", v: string) => setO((x) => ({ ...x, [key]: x[key].includes(v) ? x[key].filter((y) => y !== v) : [...x[key], v] }))
  const header = { title: "Delivery creation run", screenId: "FX-OM-DLVRUN", description: "Turns allocated schedule lines inside the horizon into Planned deliveries. Every grouping stores the rule that fired.", chips: <Chip kind="design" note="The PRD says every split or merge stores a rule and that E-DLV-01 names it, but gives no rule ids. The ids below are design values (Reading SR-26)." >Rule ids: design values</Chip>, actions: <Button variant="outline" asChild><Link to="/sales/deliveries">Delivery cockpit</Link></Button> }

  if (res)
    return (
      <div className="flex flex-col gap-4">
        <WizardResult header={header} res={res} cname={cname} onAgain={() => setRes(null)} onOpen={() => nav("/sales/deliveries")} />
      </div>
    )
  return (
    <div className="flex flex-col gap-4">
      {(st.loading || st.empty) && <PageHeader {...header} />}
      <StateBar st={st} />
      <StateGate st={st} empty={{ title: "Nothing due", body: "No allocated schedule lines are waiting for a delivery." }}>
        <WizardPage
          header={header}
          finishLabel={`Create ${sim.groups.length} deliver${sim.groups.length === 1 ? "y" : "ies"}`}
          consequence={`Creates ${sim.groups.reduce((s, g) => s + g.soIds.length, 0)} Planned delivery record(s) from ${sim.groups.length} group(s), moves their schedule lines to Delivery Due and writes the run log. Nothing is released or picked.`}
          onCancel={() => nav("/sales/deliveries")}
          onFinish={() => {
            if (!st.writable) return st.why
            const r = executeRun(o, mode, scope)
            if (!r.ok) return r.error
            toast.success(`${r.value.runId}: ${r.value.created.length} deliveries created`)
            setRes(r.value as Res)
            return null
          }}
          steps={[
            {
              id: "scope", title: "Horizon and scope",
              validate: () => (o.horizonDays < 1 || o.horizonDays > 60 ? "Horizon is between 1 and 60 days." : o.windowDays < 0 ? "The date window cannot be negative." : null),
              content: (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextField id="run-h" label="Horizon (days)" type="number" value={String(o.horizonDays)} onChange={(v) => setO({ ...o, horizonDays: Number(v) })} hint={`Schedule lines due to ${listDate(addDays(TODAY, o.horizonDays))}`} error={st.validation ? "Enter a horizon between 1 and 60 days." : null} />
                    <TextField id="run-w" label="Date window for a merge or elective split (days)" type="number" value={String(o.windowDays)} onChange={(v) => setO({ ...o, windowDays: Number(v) })} hint={`PRD default N = ${DATE_WINDOW_DAYS}`} />
                    <PickField label="Run mode" value={mode} onChange={(v) => setMode(v as typeof mode)} options={["On demand", "Nightly"]} />
                  </div>
                  <div className="flex items-center gap-2"><Checkbox id="run-m" checked={o.allowMerge} onCheckedChange={(c) => setO({ ...o, allowMerge: !!c })} /><Label htmlFor="run-m" className="font-normal">Allow merging schedule lines from different orders of the same customer</Label></div>
                  <fieldset className="flex flex-col gap-1"><legend className="mb-1 text-sm font-medium">Warehouses (none ticked = all)</legend>{whs.map((w) => <div key={w} className="flex items-center gap-2"><Checkbox id={`w-${w}`} checked={o.warehouses.includes(w)} onCheckedChange={() => toggle("warehouses", w)} /><Label htmlFor={`w-${w}`} className="font-normal">{w}</Label></div>)}</fieldset>
                  <fieldset className="flex flex-col gap-1"><legend className="mb-1 text-sm font-medium">Customers (none ticked = all)</legend><div className="grid gap-1 md:grid-cols-2">{custs.map((c) => <div key={c.id} className="flex items-center gap-2"><Checkbox id={`c-${c.id}`} checked={o.customers.includes(c.id)} onCheckedChange={() => toggle("customers", c.id)} /><Label htmlFor={`c-${c.id}`} className="font-normal">{c.name}{c.noPartial ? " (no-partial)" : ""}</Label></div>)}</div></fieldset>
                </div>
              ),
            },
            {
              id: "sim", title: "Simulated grouping",
              validate: () => (sim.groups.length === 0 ? `Nothing to create: no allocated schedule line is due within ${o.horizonDays} days (${sim.considered} considered, ${sim.held.length} held). Widen the horizon or the scope.` : null),
              content: (
                <div className="flex flex-col gap-4">
                  <p className="text-sm">{sim.considered} allocated schedule line(s) considered. {sim.groups.length} group(s) would be created; {sim.held.length} held back. Nothing is written yet.</p>
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Group</TableHead><TableHead>Customer and ship-to</TableHead><TableHead>Orders</TableHead><TableHead>Lines</TableHead><TableHead className="text-right">Weight</TableHead><TableHead>Rule</TableHead><TableHead>E-DLV-01 explanation</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sim.groups.map((g) => (
                        <TableRow key={g.key}>
                          <TableCell className="font-mono text-xs">{g.key}</TableCell>
                          <TableCell>{cname(g.customerId)}<span className="block text-xs text-muted-foreground">{g.shipTo} · {g.incoterms}</span></TableCell>
                          <TableCell>{g.soIds.join(", ")}</TableCell>
                          <TableCell>{g.items.map((x) => `${x.soId.slice(-5)}/${x.line}/${x.sched} ×${x.qty}`).join(", ")}</TableCell>
                          <TableCell className="tabular text-right">{g.items.reduce((s, x) => s + x.kg, 0).toLocaleString("en-US")} kg</TableCell>
                          <TableCell><RuleChip id={g.ruleId} /></TableCell>
                          <TableCell className="text-sm">E-DLV-01 {g.ruleId}: {g.why}{g.mergeGroup ? ` Merge group ${g.mergeGroup}.` : ""}</TableCell>
                        </TableRow>
                      ))}
                      {sim.groups.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No group in this horizon and scope.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  {sim.held.length > 0 && (
                    <Section title="Held back by a rule">
                      <ul className="flex flex-col gap-1 text-sm">{sim.held.map((h) => <li key={h.key}><span className="font-mono">{h.key}</span> <RuleChip id={h.ruleId} /> {h.why}</li>)}</ul>
                    </Section>
                  )}
                  <p className="text-xs text-muted-foreground">Vehicle capacity {VEHICLE_CAPACITY_KG.toLocaleString("en-US")} kg is a design value (<Reading id="SR-26" note="The PRD says 'weight over vehicle capacity' without a figure." />).</p>
                </div>
              ),
            },
            {
              id: "create", title: "Create",
              content: (
                <div className="flex flex-col gap-2 text-sm">
                  <p>Run mode <strong>{mode}</strong>, horizon <strong>{o.horizonDays} days</strong>, scope {scope}.</p>
                  <p><strong>{sim.groups.reduce((s, g) => s + g.soIds.length, 0)}</strong> delivery record(s) in <strong>{sim.groups.length}</strong> group(s). A merge group becomes one delivery per order, linked by its merge group id (the delivery record is single-order).</p>
                  <p className="text-muted-foreground">After creation the cockpit shows each delivery at Planned with its rule explanation.</p>
                </div>
              ),
            },
          ]}
        />
      </StateGate>
      <RulesPanel rules={[
        ["E-DLV-01", "Every split or merge decision stores the rule that fired and the message names it.", "DOC:p.207 §2.3"],
        ...DELIVERY_RULES.map((r): [string, string, string] => [r.id, r.name, r.source]),
        ["DLV-1", "Deliveries consume schedule lines, never raw order lines; only allocated (pegged) lines are grouped.", "DOC:p.206 §2.1"],
      ]} />
    </div>
  )
}

function WizardResult({ header, res, cname, onAgain, onOpen }: { header: object; res: Res; cname: (id: string) => string; onAgain: () => void; onOpen: () => void }) {
  const db = useSlice("sales")
  void header
  void cname
  return (
    <>
      <h1 className="text-xl font-semibold">Delivery creation run: result log</h1>
      <p className="text-sm">{res.runId}: {res.created.length} deliver{res.created.length === 1 ? "y" : "ies"} created at Planned; {res.held.length} schedule line(s) held.</p>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Delivery</TableHead><TableHead>Order</TableHead><TableHead>Rule</TableHead><TableHead>Explanation</TableHead></TableRow></TableHeader>
        <TableBody>
          {res.created.map((c) => (
            <TableRow key={c.deliveryId}>
              <TableCell><Link className="text-link underline" to={`/sales/deliveries?d=${c.deliveryId}`}>{c.deliveryId}</Link></TableCell>
              <TableCell>{c.soIds.join(", ")}</TableCell>
              <TableCell><RuleChip id={c.ruleId} /></TableCell>
              <TableCell className="text-sm">{db.deliveries.find((d) => d.id === c.deliveryId)?.activity[0]?.text}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2"><Button onClick={onOpen}>Open delivery cockpit</Button><Button variant="outline" onClick={onAgain}>Run again</Button></div>
    </>
  )
}
