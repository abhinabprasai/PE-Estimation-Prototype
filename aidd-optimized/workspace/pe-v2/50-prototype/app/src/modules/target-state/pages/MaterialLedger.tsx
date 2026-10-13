// ML-COCKPIT-001 period cockpit, ML-MAT-001 material price analysis (list and detail), ML-CONFIG-001 configuration
// [Book IX §1]. The ledger computes what each material actually cost each period and revalues inventory and cost of sales
// at period end; standard cost stays the operational yardstick; nothing posts at actual mid period. The actual view never
// leaks into operational documents: every report here names its view.

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, KV, RulesPanel, type Column, type DataTableProps } from "@/components/patterns"
import { ConfigPage, DetailPage, DialogShell, ListPage, WorkbenchPage } from "@/components/templates"
import type { Role } from "@/data/domain"
import { LEGAL_ENTITIES } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Field, Loading, Section, Tag, TargetFrame, useScreenState } from "../components"
import { DIFF_CATS, GROUPS, ML_PERIOD, descOf, diffsOf, receiptAct, runMulti, runSingle, single, typeOf, uomOf, valClass, type MlRecord, type Single } from "../data/ledger"
import { money, num } from "../lib"

const DECISION = "Periodic actual costing and the Material Ledger is a Book IX target-state module (Book IX §1; DEC-02 keeps standard costing at go-live)"
const EVIDENCE = "one full quarter computed in parallel on production data, reconciling to the existing ledger within rounding, with the ML-MAT-001 arithmetic audited for twenty sampled materials"
const CONTROLLER = { roles: ["Controller"] as Role[], why: "posting at close and the reversal election belong to the Controller (Book IX §1.2)" }
const link = (doc: string) => (doc.startsWith("GRN") ? <Link className="text-link underline" to={`/traceability/explorer?q=${doc}`}>{doc}</Link> : doc.startsWith("WO-") ? <Link className="text-link underline" to={`/production/orders/${doc}`}>{doc}</Link> : <span>{doc}</span>)
const sgn = (n: number) => (n > 0 ? "+" : "") + money(n, 2)
const STEP_NAMES = ["Single level", "Multi level", "Revaluation preview", "Posting"]

interface Row { rec: MlRecord; res: Single; view: Single }
function useRows() {
  const s = useSlice("targetState")
  const run = s.ledger.run
  const rows: Row[] = s.ledger.records.map((rec) => {
    const res = run.single[rec.materialId] ?? single(rec)
    return { rec, res, view: run.multi[rec.materialId] ?? res }
  })
  return { s, run, rows }
}

// ============================================================================ cockpit
export function MlCockpit() {
  const { s, run, rows } = useRows()
  const mutate = useMutate("targetState")
  const st = useScreenState("ml-cockpit", { validation: "Validation: a step needs the earlier steps done; posting needs the preview and a Controller.", degraded: "The goods-receipt feed is late: receipts of the last two days may be missing from the single level step. Showing the last complete extract." })
  const [queue, setQueue] = useState("materials")
  const [openId, setOpenId] = useState<string | null>(null)
  const [post, setPost] = useState(false)
  const done = run.steps.map((x) => x.status === "Done")
  const ent = s.ledger.config.entities[0]
  const reversal = s.ledger.config.reversal[ent.entityId]
  const parked = run.worklist.filter((w) => w.open)
  const classes = ["3000 Raw materials", "7900 Semi-finished goods"].map((c) => {
    const rs = rows.filter((r) => valClass(r.rec.materialId) === c && r.view.pup != null)
    return { c, inv: rs.reduce((a, r) => a + r.view.toEnding, 0), cogs: rs.reduce((a, r) => a + r.view.toCogs, 0), rolled: rs.reduce((a, r) => a + r.view.toRolled, 0) }
  })
  const totInv = classes.reduce((a, c) => a + c.inv, 0)
  const totCogs = classes.reduce((a, c) => a + c.cogs, 0)

  const doStep = (n: number) => st.run(() => {
    if (n > 1 && !done[n - 2]) return `Run step ${n - 1} (${STEP_NAMES[n - 2]}) first: the steps run in the PRD's binding order.`
    if (done[n - 1]) return `Step ${n} is done. Restart it to recompute; finished steps are never recomputed on their own.`
    if (n === 4) {
      if (ent.mode === "Not active") return `${ent.entityId} is not active for the Material Ledger. Activate it in ML-CONFIG-001 first.`
      setPost(true)
      return
    }
    const r = mutate((d) => {
      const L = d.ledger
      if (n === 1) {
        L.run.single = runSingle(L.records)
        L.run.worklist = L.records.filter((x) => L.run.single[x.materialId].parked).map((x, i) => ({ id: `MLW-TBD-${String(i + 1).padStart(3, "0")}`, materialId: x.materialId, reason: L.run.single[x.materialId].parked!, owner: "Cost accountant", open: true }))
      }
      if (n === 2) {
        const out = runMulti(L.records, L.config.toleranceCent, L.config.maxIterations)
        L.run.multi = out.multi
        L.run.iterations = out.iterations
      }
      L.run.steps[n - 1] = { status: "Done", at: "2026-10-09 14:30" }
    })
    return r.ok ? { ok: `Step ${n} (${STEP_NAMES[n - 1]}) done` } : r.error
  }, n === 4 ? CONTROLLER : undefined)

  const restart = (n: number) => st.run(() => {
    mutate((d) => {
      for (let i = n - 1; i < 4; i++) d.ledger.run.steps[i] = { status: "Not started" }
      if (n <= 1) { d.ledger.run.single = {}; d.ledger.run.worklist = [] }
      if (n <= 2) { d.ledger.run.multi = {}; d.ledger.run.iterations = [] }
      d.ledger.run.journal = undefined
    })
    return { ok: `Step ${n} restarted; steps before it keep their results` }
  })
  const doPost = () => {
    const g = st.guard(CONTROLLER)
    if (g) return g
    const r = mutate((d) => {
      const e = d.ledger.config.entities[0]
      const amt = Math.abs(totInv) + Math.abs(totCogs)
      d.ledger.run.journal = { id: `MLJ-TBD-${ML_PERIOD}-01`, entityId: e.entityId, at: "2026-10-09", reversal: !!d.ledger.config.reversal[e.entityId], mode: e.mode === "Live" ? "Live" : "Parallel", amount: amt }
      d.ledger.run.steps[3] = { status: "Done", at: "2026-10-09 14:30" }
    })
    return r.ok ? null : r.error
  }
  const cols: Column<Row>[] = [
    { id: "m", header: "Material", value: (r) => r.rec.materialId, mono: true, sortable: true },
    { id: "d", header: "Description", value: (r) => descOf(r.rec.materialId) },
    { id: "g", header: "Material group", value: (r) => r.rec.group, filterable: true },
    { id: "l", header: "LLC", value: (r) => r.rec.llc, mono: true },
    { id: "p", header: "Periodic unit price", align: "right", value: (r) => r.view.pup ?? "", cell: (r) => (r.view.pup == null ? <Tag family="exception" label="Not distributed" /> : money(r.view.pup, 4)) },
    { id: "s", header: "Standard", align: "right", value: (r) => r.view.std, cell: (r) => money(r.view.std, 2) },
    { id: "i", header: "Inventory delta", align: "right", value: (r) => r.view.toEnding, cell: (r) => (r.view.pup == null ? "Not revalued" : sgn(r.view.toEnding)) },
    { id: "c", header: "Cost of sales delta", align: "right", value: (r) => r.view.toCogs, cell: (r) => (r.view.pup == null ? "Not revalued" : sgn(r.view.toCogs)) },
  ]
  const wcols: Column<(typeof run.worklist)[number]>[] = [
    { id: "id", header: "Worklist entry", value: (w) => w.id, mono: true },
    { id: "m", header: "Material", value: (w) => w.materialId, mono: true },
    { id: "r", header: "Why parked", value: (w) => w.reason },
    { id: "o", header: "Owner", value: (w) => w.owner },
    { id: "s", header: "State", value: (w) => (w.open ? "Open" : "Resolved"), cell: (w) => <Tag family={w.open ? "exception" : "done"} label={w.open ? "Open" : "Resolved"} /> },
  ]
  const detail = rows.find((r) => r.rec.materialId === openId)
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{
          title: `Material Ledger cockpit, period ${ML_PERIOD}`, screenId: "ML-COCKPIT-001",
          chips: <Chip kind="design" note="Valuation view named on every report (Book IX §1.1)">View: periodic actual</Chip>,
          description: "Single level, multi level, revaluation preview, posting. The run restarts per step without recomputing finished steps. Standard cost stays the yardstick during the period; nothing posts at actual mid period.",
          children: (
            <div className="flex flex-col gap-3">
              <ol aria-label="Run steps" className="grid gap-2 md:grid-cols-4">
                {STEP_NAMES.map((nm, i) => (
                  <li key={nm} className="flex flex-col gap-2 rounded-lg border p-3">
                    <span className="flex items-center justify-between text-sm font-semibold">Step {i + 1}: {nm}<Tag family={done[i] ? "done" : "draft"} label={done[i] ? "Done" : "Not started"} /></span>
                    <span className="text-xs text-muted-foreground">{i === 0 ? "Periodic unit price per material" : i === 1 ? "By ascending low level code; circular consumption iterates to one cent" : i === 2 ? "Inventory and cost of sales deltas by valuation class" : `One revaluation journal for ${ent.entityId}${reversal ? ", reversing" : ""}`}</span>
                    <span className="flex gap-2"><Button size="sm" variant={!done[i] && (i === 0 || done[i - 1]) ? "default" : "outline"} disabled={st.locked} onClick={() => doStep(i + 1)}>{i === 3 ? "Post at close" : "Run step"}</Button><Button size="sm" variant="ghost" disabled={st.locked || !done[i]} onClick={() => restart(i + 1)}>Restart</Button></span>
                  </li>
                ))}
              </ol>
              <div className="overflow-x-auto rounded-lg border">
                <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Material group</TableHead>{STEP_NAMES.map((n) => <TableHead key={n}>{n}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{GROUPS.map((g) => { const pk = parked.filter((w) => rows.find((r) => r.rec.materialId === w.materialId)?.rec.group === g).length; return (
                    <TableRow key={g}><TableCell>{g}</TableCell>{[0, 1, 2, 3].map((i) => <TableCell key={i}>{!done[i] ? <span className="text-muted-foreground">Not started</span> : i === 0 && pk ? <Tag family="exception" label={`Done, ${pk} parked`} /> : <Tag family="done" label="Done" />}</TableCell>)}</TableRow>) })}</TableBody></Table>
              </div>
              {run.iterations.length > 0 && <p className="text-sm">Circular consumption at level {run.iterations.map((x) => x.level).join(", ")} resolved in {run.iterations.map((x) => x.n).join(", ")} iterations (largest remaining change {run.iterations.map((x) => money(x.delta, 4)).join(", ")}, tolerance one cent).</p>}
              {done[2] && (
                <Section title="Revaluation preview by valuation class (before anything posts)">
                  <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Valuation class</TableHead><TableHead className="text-right">Inventory delta</TableHead><TableHead className="text-right">Cost of sales delta</TableHead><TableHead className="text-right">Rolled to receiving materials</TableHead></TableRow></TableHeader>
                    <TableBody>{classes.map((c) => <TableRow key={c.c}><TableCell>{c.c}</TableCell><TableCell className="tabular text-right">{sgn(c.inv)}</TableCell><TableCell className="tabular text-right">{sgn(c.cogs)}</TableCell><TableCell className="tabular text-right">{sgn(c.rolled)}</TableCell></TableRow>)}
                      <TableRow className="font-semibold"><TableCell>Total</TableCell><TableCell className="tabular text-right">{sgn(totInv)}</TableCell><TableCell className="tabular text-right">{sgn(totCogs)}</TableCell><TableCell /></TableRow></TableBody></Table>
                  <p className="text-xs text-muted-foreground">Posting lines: positive inventory delta debits 13xx by valuation class and credits MLINV; positive cost of sales delta debits MLCOGS and credits MLINV; negative deltas reverse. Event keys MLINV and MLCOGS resolve through the account determination matrix. <Chip kind="oq" id="OQ-TS02" note="The matrix rows for MLINV and MLCOGS are not in the PRD; ML-CONFIG-001 shows design rows" /></p>
                </Section>
              )}
              {run.journal && <p className="rounded-md border p-3 text-sm"><span className="font-semibold">{run.journal.id}</span> for {run.journal.entityId}: {run.journal.mode === "Live" ? "revaluation journal posted" : "parallel result recorded, no journal posted to the ledger"}{run.journal.reversal ? ", with reversal accounting elected" : ""}. Amount {money(run.journal.amount, 2)}.</p>}
            </div>
          ),
        }}
        kpis={[{ label: "Materials in the run", value: rows.length }, { label: "Not distributed", value: parked.length, hint: "Parked with a worklist entry" }, { label: "Inventory delta", value: done[0] ? sgn(totInv) : "Not run" }, { label: "Cost of sales delta", value: done[0] ? sgn(totCogs) : "Not run" }]}
        queues={[{ id: "materials", label: "Materials", count: rows.length }, { id: "worklist", label: "Error worklist", count: parked.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={queue === "worklist" ? ({ rows: st.rows(run.worklist), columns: wcols, rowId: (w: (typeof run.worklist)[number]) => w.id, loading: st.loading, empty: { title: "No parked material", body: "Zero or negative denominators park a material here after step 1." } } as unknown as DataTableProps<Row>) : { rows: st.rows(rows), columns: cols, rowId: (r) => r.rec.materialId, onRowClick: (r) => setOpenId(r.rec.materialId), activeId: openId ?? undefined, searchText: (r) => `${r.rec.materialId} ${descOf(r.rec.materialId)}`, loading: st.loading, empty: { title: "No material in this period", body: "The period record holds one row per material, plant and period." } }}
        panel={{ open: !!detail, onOpenChange: (o) => !o && setOpenId(null), title: detail?.rec.materialId ?? "", description: detail ? descOf(detail.rec.materialId) : undefined, content: detail && <div className="flex flex-col gap-3 text-sm"><p>{detail.view.parked ?? `Periodic unit price ${money(detail.view.pup!, 4)} against standard ${money(detail.view.std, 2)}.`}</p><Link className="text-link underline" to={`/target/material-ledger/materials/${detail.rec.materialId}`}>Open the arithmetic in ML-MAT-001</Link></div> }}
      />
      <DialogShell open={post} onOpenChange={setPost} title="Post revaluation at close" confirmLabel={ent.mode === "Live" ? "Post journal" : "Record parallel result"} onConfirm={doPost} consequence={ent.mode === "Live" ? `Posts one revaluation journal for ${ent.entityId} for ${ML_PERIOD}${reversal ? " with reversal accounting elected by the Controller" : ""}. Close checklist step 8b.` : `${ent.entityId} is in parallel: the result is recorded for reconciliation with the existing ledger and no journal posts.`}>
        <p className="text-sm">Inventory delta {sgn(totInv)}, cost of sales delta {sgn(totCogs)}. The actual view never leaks into operational documents.</p>
      </DialogShell>
      <RulesPanel rules={[["ML-1", "Periodic unit price = (beginning actual value + receipt actual value) / (beginning quantity + receipt quantity).", "Book IX §1.2"], ["ML-2", "Zero or negative denominators park the material in Not distributed with a worklist entry, never a division fault.", "Book IX §1.2"], ["ML-3", "Circular consumption within a level resolves iteratively to one cent per material.", "Book IX §1.2"], ["ML-4", "One revaluation journal per entity at period close; reversal option elected by the Controller.", "Book IX §1.2"]]} />
    </>
  )
}

// ============================================================================ by material
export function MlMaterials() {
  const { rows } = useRows()
  const st = useScreenState("ml-materials")
  const cols: Column<Row>[] = [
    { id: "m", header: "Material", value: (r) => r.rec.materialId, mono: true, sortable: true },
    { id: "d", header: "Description", value: (r) => descOf(r.rec.materialId) },
    { id: "t", header: "Type", value: (r) => typeOf(r.rec.materialId), filterable: true },
    { id: "g", header: "Material group", value: (r) => r.rec.group, filterable: true },
    { id: "b", header: "Beginning qty", align: "right", value: (r) => r.res.begQty, cell: (r) => num(r.res.begQty) },
    { id: "r", header: "Receipt qty", align: "right", value: (r) => r.res.recQty, cell: (r) => num(r.res.recQty) },
    { id: "e", header: "Ending qty", align: "right", value: (r) => r.res.endQty, cell: (r) => num(r.res.endQty) },
    { id: "p", header: "Periodic unit price", align: "right", value: (r) => r.view.pup ?? "", cell: (r) => (r.view.pup == null ? <Tag family="exception" label="Not distributed" /> : money(r.view.pup, 4)) },
    { id: "s", header: "Standard", align: "right", value: (r) => r.res.std, cell: (r) => money(r.res.std, 2) },
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage header={{ title: "Material Ledger by material", screenId: "ML-MAT-001", chips: <Chip kind="design">View: periodic actual</Chip>, description: `Period ${ML_PERIOD}. One period record per material, plant and period. Open a material to check the unit price by hand.` }}
        table={{ rows: st.rows(rows), columns: cols, rowId: (r) => r.rec.materialId, rowHref: (r) => `/target/material-ledger/materials/${r.rec.materialId}`, searchText: (r) => `${r.rec.materialId} ${descOf(r.rec.materialId)}`, loading: st.loading, empty: { title: "No ledger period record", body: "Records appear when a period is activated for an entity." } }} />
    </>
  )
}

export function MlMaterialDetail() {
  const { id } = useParams()
  const { run, rows, s } = useRows()
  const st = useScreenState("ml-material-detail")
  const row = rows.find((r) => r.rec.materialId === id)
  if (!row) return <EmptyState title="Material not in the ledger">No period record for {id}. <Link className="text-link underline" to="/target/material-ledger/materials">Back to the list</Link></EmptyState>
  const { rec, res } = row
  const v = run.multi[rec.materialId]
  const dif = diffsOf(rec)
  const std = res.std
  const uom = uomOf(rec.materialId)
  const stdBeg = rec.begQty * std
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: `${rec.materialId}: ${descOf(rec.materialId)}`, screenId: "ML-MAT-001", crumbs: [{ label: "By material", to: "/target/material-ledger/materials" }, { label: rec.materialId }], chips: <><Chip kind="design">View: periodic actual</Chip>{res.parked && <Tag family="exception" label="Not distributed" />}</>, description: `Period ${ML_PERIOD}, plant ${rec.plantId}, ${rec.group}, low level code ${rec.llc}.` }}
        summary={<><KV k="Periodic unit price">{res.pup == null ? "Not distributed" : money(res.pup, 4)}</KV><KV k="Standard">{money(std, 2)} per {uom}</KV><KV k="Ending quantity">{num(res.endQty)} {uom}</KV><KV k="Legal view (standard)">Variances expensed as today</KV></>}
        tabs={[
          { id: "arith", label: "Unit price derivation", content: st.loading ? <Loading /> : (
            <div className="flex max-w-3xl flex-col gap-3 text-sm">
              <p className="font-medium">Step one, single level, as arithmetic you can check by hand</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Beginning: {num(rec.begQty)} {uom} at actual {money(rec.begValAct, 2)}.</li>
                <li>Receipts: {num(res.recQty)} {uom} at actual {money(res.recAct, 2)}.</li>
                <li>Denominator: {num(rec.begQty)} + {num(res.recQty)} = <span className="tabular font-semibold">{num(res.denom)}</span>.</li>
                {res.parked ? <li className="font-semibold text-destructive">{res.parked}. The material is parked in Not distributed with a worklist entry; no price is computed.</li> : (
                  <>
                    <li>Periodic unit price: ({money(rec.begValAct, 2)} + {money(res.recAct, 2)}{res.inherited ? ` + ${money(res.inherited, 2)} inherited` : ""}) / {num(res.denom)} = <span className="tabular font-semibold">{money(res.pup!, 4)}</span>.</li>
                    <li>Against standard {money(std, 2)}: difference per unit {sgn(res.pup! - std)}; total to distribute {sgn(res.total)} = {num(res.denom)} x {sgn(res.pup! - std)}.</li>
                    <li>Distribution: to ending inventory {num(res.endQty)} {uom}: {sgn(res.toEnding)}; to consumption {num(res.consQty)} {uom}: {sgn(res.toConsumption)} (of which rolled to receiving materials {sgn(res.toRolled)}, to cost of sales {sgn(res.toCogs)}).</li>
                  </>
                )}
              </ol>
              {v && v.inherited !== 0 && <p>Step two (multi level) added {sgn(v.inherited)} inherited from consumed materials; the price above uses it.</p>}
              <p className="text-muted-foreground">Standard value of beginning stock {money(stdBeg, 2)}; standard value of receipts {money(res.recQty * std, 2)}.</p>
            </div>
          ) },
          { id: "lines", label: "Receipts and consumption", content: (
            <div className="flex flex-col gap-4">
              <Section title="Receipt lines by category">
                {rec.receipts.length === 0 ? <p className="text-sm text-muted-foreground">No receipt in the period.</p> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Source document</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Actual value</TableHead><TableHead>Basis</TableHead></TableRow></TableHeader>
                  <TableBody>{rec.receipts.map((r, i) => <TableRow key={i}><TableCell>{link(r.doc)}</TableCell><TableCell>{r.cat}</TableCell><TableCell className="tabular text-right">{num(r.qty)}</TableCell><TableCell className="tabular text-right">{money(receiptAct(r), 2)}</TableCell><TableCell className="text-xs">{r.cat === "Purchase receipt" ? `corrected to invoice price ${money(r.inv ?? 0, 2)} (PO ${money(r.po ?? 0, 2)}${r.fx ? `, exchange ${sgn(r.fx)}` : ""})` : r.cat === "Production receipt" ? `settled order actual ${money(r.actual ?? 0, 2)}` : `sending plant actual ${money(r.actual ?? 0, 2)}`}</TableCell></TableRow>)}</TableBody></Table>}
              </Section>
              <Section title="Consumption lines by category">
                {rec.consumption.length === 0 ? <p className="text-sm text-muted-foreground">No consumption in the period.</p> : <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Source document</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Receiving material</TableHead></TableRow></TableHeader>
                  <TableBody>{rec.consumption.map((c, i) => <TableRow key={i}><TableCell>{link(c.doc)}</TableCell><TableCell>{c.cat}</TableCell><TableCell className="tabular text-right">{num(c.qty)}</TableCell><TableCell>{c.toMaterial ? <Link className="text-link underline" to={`/target/material-ledger/materials/${c.toMaterial}`}>{c.toMaterial}</Link> : "Cost of sales"}</TableCell></TableRow>)}</TableBody></Table>}
              </Section>
            </div>
          ) },
          { id: "diff", label: "Difference categories", content: (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Collected single level</TableHead><TableHead>Matrix row</TableHead></TableRow></TableHeader>
              <TableBody>{DIFF_CATS.map((c) => <TableRow key={c}><TableCell>{c}</TableCell><TableCell className="tabular text-right">{sgn(dif[c])}</TableCell><TableCell className="font-mono text-xs">{s.ledger.config.mapping.find((m) => m.category === c)?.matrixRow}</TableCell></TableRow>)}
                <TableRow className="font-semibold"><TableCell>Total collected</TableCell><TableCell className="tabular text-right">{sgn(DIFF_CATS.reduce((a, c) => a + dif[c], 0))}</TableCell><TableCell /></TableRow></TableBody></Table>
          ) },
          { id: "views", label: "Valuation views", content: (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>View</TableHead><TableHead className="text-right">Unit value</TableHead><TableHead className="text-right">Ending value</TableHead><TableHead>Use</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Legal at standard</TableCell><TableCell className="tabular text-right">{money(std, 4)}</TableCell><TableCell className="tabular text-right">{money(res.endQty * std, 2)}</TableCell><TableCell>Variances expensed as today; operational documents</TableCell></TableRow>
                <TableRow><TableCell>Periodic actual</TableCell><TableCell className="tabular text-right">{res.pup == null ? "n/a" : money(res.pup, 4)}</TableCell><TableCell className="tabular text-right">{res.pup == null ? "n/a" : money(res.endQty * res.pup, 2)}</TableCell><TableCell>Reporting and period-end revaluation only; never in operational documents</TableCell></TableRow>
              </TableBody></Table>
          ) },
        ]}
      />
    </>
  )
}

// ============================================================================ config
export function MlConfig() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("ml-config", { auth: "Not authorized: only the Controller releases Material Ledger configuration (Book IX §1.2)." })
  const [section, setSection] = useState("activation")
  const cfg = s.ledger.config
  const [draft, setDraft] = useState(() => ({ entities: cfg.entities.map((e) => ({ ...e })), reversal: { ...cfg.reversal }, tol: String(cfg.toleranceCent), iter: String(cfg.maxIterations), mapping: cfg.mapping.map((m) => ({ ...m })) }))
  const [rel, setRel] = useState(false)
  const [eff, setEff] = useState("2026-11-01")
  const [evid, setEvid] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify({ entities: cfg.entities, reversal: cfg.reversal, tol: String(cfg.toleranceCent), iter: String(cfg.maxIterations), mapping: cfg.mapping })
  const goingLive = draft.entities.some((e, i) => e.mode === "Live" && cfg.entities[i].mode !== "Live")
  const release = (reason: string) => {
    const g = st.guard(CONTROLLER)
    if (g) return g
    if (eff <= "2026-10-09") return "The effective date must be after today: configuration is effective-dated and never edited in place (C-50)."
    const tol = Number(draft.tol)
    if (!Number.isFinite(tol) || tol <= 0 || tol > 100) return "Tolerance must be a positive number of cents (the PRD states one cent)."
    if (goingLive && !evid) return "Going live needs the activation evidence recorded: a full quarter in parallel reconciling within rounding, and 20 sampled materials audited."
    const r = mutate((d) => {
      const c = d.ledger.config
      c.entities = draft.entities.map((e) => ({ ...e, effectiveFrom: e.effectiveFrom }))
      c.reversal = { ...draft.reversal }
      c.toleranceCent = tol
      c.maxIterations = Number(draft.iter) || 20
      c.mapping = draft.mapping
      const v = c.versions[0].v + 1
      c.versions.unshift({ v, at: "2026-10-09", by: "Controller", text: reason, effectiveFrom: eff })
    })
    return r.ok ? null : r.error
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ConfigPage
        effectiveDated
        header={{ title: "Material Ledger configuration", screenId: "ML-CONFIG-001", description: "Activation per entity, difference category mapping to matrix rows, reversal election and tolerance values. Effective dated, released through a ceremony.", primary: <Button disabled={st.locked || !dirty} onClick={() => setRel(true)}>Release new version</Button> }}
        sections={[{ id: "activation", label: "Entity activation" }, { id: "mapping", label: "Difference mapping" }, { id: "reversal", label: "Reversal election" }, { id: "tol", label: "Tolerance" }, { id: "history", label: "Versions" }]}
        section={section}
        onSectionChange={setSection}
      >
        {section === "activation" && (
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Entity</TableHead><TableHead>Mode</TableHead><TableHead>Effective from</TableHead></TableRow></TableHeader>
            <TableBody>{draft.entities.map((e, i) => <TableRow key={e.entityId}><TableCell>{e.entityId} {LEGAL_ENTITIES.find((x) => x.id === e.entityId)?.name}</TableCell>
              <TableCell><Select value={e.mode} disabled={st.locked} onValueChange={(v) => setDraft({ ...draft, entities: draft.entities.map((x, j) => (j === i ? { ...x, mode: v as typeof e.mode } : x)) })}><SelectTrigger aria-label={`Mode for ${e.entityId}`} className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Not active">Not active</SelectItem><SelectItem value="Parallel">Parallel</SelectItem><SelectItem value="Live">Live</SelectItem></SelectContent></Select></TableCell>
              <TableCell>{fmtDate(e.effectiveFrom)}</TableCell></TableRow>)}</TableBody></Table>
        )}
        {section === "mapping" && (
          <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Difference category</TableHead><TableHead>Matrix row</TableHead><TableHead>Event key</TableHead></TableRow></TableHeader>
            <TableBody>{draft.mapping.map((m, i) => <TableRow key={m.category}><TableCell>{m.category}</TableCell><TableCell><Input aria-label={`Matrix row for ${m.category}`} className="w-44 font-mono" value={m.matrixRow} disabled={st.locked} onChange={(e) => setDraft({ ...draft, mapping: draft.mapping.map((x, j) => (j === i ? { ...x, matrixRow: e.target.value } : x)) })} /></TableCell>
              <TableCell><Select value={m.eventKey} disabled={st.locked} onValueChange={(v) => setDraft({ ...draft, mapping: draft.mapping.map((x, j) => (j === i ? { ...x, eventKey: v as "MLINV" | "MLCOGS" } : x)) })}><SelectTrigger aria-label={`Event key for ${m.category}`} className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MLINV">MLINV</SelectItem><SelectItem value="MLCOGS">MLCOGS</SelectItem></SelectContent></Select></TableCell></TableRow>)}</TableBody></Table>
        )}
        {section === "reversal" && (
          <div className="flex max-w-xl flex-col gap-3">
            <p className="text-sm text-muted-foreground">The Controller elects reversal accounting for the actual view per entity (Book IX §1.2 step four).</p>
            {draft.entities.map((e) => <label key={e.entityId} className="flex items-center justify-between rounded-lg border p-3 text-sm">{e.entityId} {LEGAL_ENTITIES.find((x) => x.id === e.entityId)?.name}<Switch checked={!!draft.reversal[e.entityId]} disabled={st.locked} onCheckedChange={(v) => setDraft({ ...draft, reversal: { ...draft.reversal, [e.entityId]: v } })} aria-label={`Reversal for ${e.entityId}`} /></label>)}
          </div>
        )}
        {section === "tol" && (
          <div className="grid max-w-md gap-3">
            <Field label="Circular consumption tolerance (cents per material)" id="mlc-t" hint="The PRD states one cent"><Input id="mlc-t" inputMode="decimal" value={draft.tol} disabled={st.locked} onChange={(e) => setDraft({ ...draft, tol: e.target.value })} /></Field>
            <Field label="Maximum iterations" id="mlc-i" hint="Design value, so the iteration always stops"><Input id="mlc-i" inputMode="numeric" value={draft.iter} disabled={st.locked} onChange={(e) => setDraft({ ...draft, iter: e.target.value })} /></Field>
            <Chip kind="design">Maximum iterations is a design value</Chip>
          </div>
        )}
        {section === "history" && <ul className="space-y-2 text-sm">{cfg.versions.map((v) => <li key={v.v} className="rounded-lg border p-3"><span className="font-semibold">Version {v.v}</span> effective {fmtDate(v.effectiveFrom)}; released {fmtDate(v.at)} by {v.by}. {v.text}</li>)}</ul>}
      </ConfigPage>
      <DialogShell open={rel} onOpenChange={setRel} title="Release Material Ledger configuration" requireReason reasonLabel="What changed and why (required)" confirmLabel="Release version" onConfirm={release} consequence={`Creates version ${cfg.versions[0].v + 1} effective on the date below. History stays visible; nothing is edited in place.${goingLive ? " An entity moves to Live: its period close will post the revaluation journal." : ""}`}>
        <div className="flex flex-col gap-3">
          <Field label="Effective from" id="mlc-e"><Input id="mlc-e" type="date" value={eff} onChange={(e) => setEff(e.target.value)} /></Field>
          {goingLive && <label className="flex items-start gap-2 text-sm"><Checkbox checked={evid} onCheckedChange={(v) => setEvid(!!v)} />Activation evidence is recorded: one full quarter in parallel reconciling to the existing ledger within rounding, ML-MAT-001 arithmetic audited for twenty sampled materials.</label>}
        </div>
      </DialogShell>
    </>
  )
}

