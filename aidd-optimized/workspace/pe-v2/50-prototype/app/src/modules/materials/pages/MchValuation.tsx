// MM-MCH-001, valuation-change variant [Book II §5.4]: valuation method (Standard / Moving Average) or
// price unit. A method change applies at a fiscal-period boundary only, in an Open period; the price
// unit cannot change inside the costing-run mark window (E-MM-22). Open goods receipts without invoice
// (GR/IR) block a move to Standard and warn on a move to Moving Average. The wizard previews the
// revaluation delta with the GL entry from account determination; the Controller approves and then
// releases the change at the boundary. The approval runs through the shared "Material change" kind
// (RD-MM-31).

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WizardPage } from "@/components/templates"
import { ApprovalButton, Chip, DataTable, type Column } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRole, useSlice } from "@/store"
import { allMaterials } from "../data/state"
import { liveRows } from "../data/actions"
import { applyValuationMch, createValuationMch } from "../data/ext-actions"
import { checkValuation, revalueMethod, type ValuationInput } from "../lib/ext-rules"
import { isValuated } from "../lib/rules"
import type { MchRecord } from "../data/types"
import { MatLink, MaterialStatus, Reading, Section, TextPostingPreview, TypeBadge } from "../components/common"
import { run } from "../components/run"

export function ValuationWizard({ preset, onDone }: { preset: string[]; onDone: (id: string) => void }) {
  const s = useSlice("materials")
  const [role] = useRole()
  const mats = useMemo(() => allMaterials(s).filter((m) => m.status !== "Obsolete" && m.status !== "Draft" && isValuated(m.type)), [s])
  const [sel, setSel] = useState<string[]>(preset.filter((id) => mats.some((m) => m.id === id)))
  const [fieldKey, setField] = useState<ValuationInput["fieldKey"]>("method")
  const [value, setValue] = useState("")
  const [apply, setApply] = useState<ValuationInput["apply"]>("Effective-dated")
  const [effective, setEffective] = useState("")
  const [reason, setReason] = useState("")
  const [eco, setEco] = useState("")
  const input: ValuationInput = { fieldKey, value, apply, effective: effective || undefined }
  const chk = useMemo(() => checkValuation(s, sel, input, TODAY), [s, sel, fieldKey, value, apply, effective]) // eslint-disable-line react-hooks/exhaustive-deps
  const good = chk.rows.filter((r) => !r.error)
  const rv = useMemo(() => (fieldKey === "method" && value && good.length ? revalueMethod(s, good.map((r) => r.materialId), value as "Standard" | "Moving Average", liveRows(s.acctDetermination)) : null), [s, fieldKey, value, good])
  const date = apply === "Immediate" ? TODAY : effective
  const cols: Column<(typeof mats)[number]>[] = [
    { id: "id", header: "Material", value: (m) => m.id, mono: true, sortable: true },
    { id: "type", header: "Type", value: (m) => m.type, filterable: true, cell: (m) => <TypeBadge type={m.type} /> },
    { id: "desc", header: "Description", value: (m) => m.description },
    { id: "status", header: "Lifecycle", value: (m) => m.status, filterable: true, cell: (m) => <MaterialStatus m={m} /> },
    { id: "cur", header: "Method / price unit", value: (m) => `${s.views[m.id]?.method ?? ""} / ${s.views[m.id]?.priceUnit ?? ""}` },
  ]
  return (
    <WizardPage
      header={{
        screenId: "MM-MCH-001",
        title: "Valuation change",
        description: "Change the valuation method or the price unit: period-boundary check, GR/IR warnings, revaluation delta with its GL entry, then Controller approval.",
        chips: <><Chip kind="design">E-MM-22</Chip><Reading id="RD-MM-31" /></>,
      }}
      finishLabel="Create valuation change"
      consequence={`Creates the change as a Draft Class 2 request with ${good.length} row(s)${rv ? ` and a revaluation delta of ${fmtMoney(rv.total)}` : ""}. Nothing is revalued now: you send it for approval, the Controller approves, and releases it at ${date || "the effective date"}.`}
      onFinish={() => {
        const r = createValuationMch({ title: "", ids: sel, input, reason, ecoRef: eco || undefined })
        if (!r.ok) return r.error
        run(r, `${r.value} created in Draft`)
        onDone(r.value)
        return null
      }}
      steps={[
        {
          id: "select",
          title: "Selection",
          validate: () => (sel.length ? null : "Choose at least one valuated material."),
          content: <DataTable densityKey="MM-MCH-001-valuation-select" rows={mats} columns={cols} rowId={(m) => m.id} selectable selected={sel} onSelectedChange={setSel} searchText={(m) => `${m.id} ${m.description}`} caption={`${sel.length} selected`} empty={{ title: "No valuated material", body: "Service and non-stock materials are not valuated." }} />,
        },
        {
          id: "define",
          title: "Change and date",
          validate: () => (!value ? "Choose the new value." : apply === "Effective-dated" && !effective ? "Choose the effective date." : chk.global[0] ?? null),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="val-field">What changes</Label>
                <Select value={fieldKey} onValueChange={(v) => (setField(v as ValuationInput["fieldKey"]), setValue(""))}>
                  <SelectTrigger id="val-field"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="method">Valuation method</SelectItem>
                    <SelectItem value="priceUnit">Price unit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="val-value">New value</Label>
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger id="val-value"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {(fieldKey === "method" ? ["Standard", "Moving Average"] : ["1", "100", "1000"]).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Apply</Label>
                <RadioGroup value={apply} onValueChange={(v) => setApply(v as ValuationInput["apply"])} className="flex gap-4">
                  {(["Immediate", "Effective-dated"] as const).map((x) => (
                    <label key={x} className="flex items-center gap-2 text-sm"><RadioGroupItem value={x} /> {x}</label>
                  ))}
                </RadioGroup>
              </div>
              {apply === "Effective-dated" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="val-eff">Effective date</Label>
                  <Input id="val-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
                </div>
              )}
              <div className="md:col-span-2 flex flex-col gap-1">
                {fieldKey === "method" ? <p className="text-xs text-muted-foreground">§5.4: a valuation method changes at a period boundary only: the first day of an Open fiscal period. Make items (SEMI, FIN) stay on Standard.</p> : <p className="text-xs text-muted-foreground">E-MM-22: the price unit cannot change while a costing run is in its mark window ({s.x.markWindow.from} to {s.x.markWindow.to}, {s.x.markWindow.run}).</p>}
                {value && chk.global.map((g, i) => <p key={i} role="alert" className="text-sm text-destructive">{g}</p>)}
              </div>
            </div>
          ),
        },
        {
          id: "checks",
          title: "Checks and GR/IR",
          validate: () => (good.length ? null : "Every row fails a check; change the selection or the value."),
          content: (
            <div className="flex flex-col gap-3">
              <p className="text-sm">{good.length} row(s) pass, {chk.rows.length - good.length} excluded. Effective {fmtDate(date)}.</p>
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Material</TableHead><TableHead>Old</TableHead><TableHead>New</TableHead><TableHead>Check</TableHead></TableRow></TableHeader>
                <TableBody>
                  {chk.rows.map((r) => (
                    <TableRow key={r.materialId} className={cn("h-8 align-top text-[13px]", r.error && "text-muted-foreground")}>
                      <TableCell><MatLink id={r.materialId} /></TableCell>
                      <TableCell>{r.old || "blank"}</TableCell>
                      <TableCell>{r.new}</TableCell>
                      <TableCell className={cn(r.error && "text-destructive")}>{r.error ? `Excluded: ${r.error}` : r.warning ? <span>Passes with a warning: {r.warning}</span> : "Passes"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {s.x.grir.length > 0 && (
                <Section title="Open goods receipts without invoice (GR/IR)">
                  <ul className="text-sm">
                    {s.x.grir.filter((g) => sel.includes(g.materialId)).map((g) => <li key={g.grnId}><MatLink id={g.materialId} /> · {g.grnId} on {g.poId} · {fmtMoney(g.value)} since {fmtDate(g.since)}</li>)}
                    {!s.x.grir.some((g) => sel.includes(g.materialId)) && <li className="text-muted-foreground">None for the selected materials.</li>}
                  </ul>
                  <p className="text-xs text-muted-foreground">A move to Standard needs these matched first; a move to Moving Average books invoice differences against the new baseline (RD-MM-32).</p>
                </Section>
              )}
            </div>
          ),
        },
        {
          id: "reval",
          title: "Revaluation and GL",
          content: fieldKey === "priceUnit" ? (
            <p className="text-sm">A price unit change is a factor: the stock value does not change, so no revaluation is posted. Prices and costs are rescaled consistently on the effective date.</p>
          ) : !rv ? (
            <p className="text-sm text-muted-foreground">Choose the new value and pass the checks to see the delta.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Material</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">After</TableHead><TableHead className="text-right">Delta</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rv.reval.map((r) => (
                    <TableRow key={r.materialId} className="h-8 text-[13px]">
                      <TableCell><MatLink id={r.materialId} /></TableCell>
                      <TableCell className="tabular text-right">{r.qty}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.from)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.to)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.delta)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TextPostingPreview title="GL preview (REVAL, from account determination)" lines={[{ transaction: `Revaluation on method change to ${value}`, debit: rv.glDebit, credit: rv.glCredit, amount: Math.abs(rv.total), detail: rv.total === 0 ? "No stock delta: nothing posts" : `${good.length} material(s), effective ${date}` }]} note="Accounts resolved through MM-VAL-001 (E-MM-21 if a key is missing)." />
            </div>
          ),
        },
        {
          id: "approval",
          title: "Approval",
          validate: () => (!reason.trim() ? "Enter the reason for the change." : null),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="val-eco">ECO reference (optional)</Label>
                <Input id="val-eco" value={eco} onChange={(e) => setEco(e.target.value)} placeholder="ECO-TBD-..." />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label htmlFor="val-reason">Reason (required)</Label>
                <Textarea id="val-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">Acting as {role}. After creation, send it for approval from the record: the shared "Material change" approval routes it, and the Controller then releases it at the period boundary.</p>
            </div>
          ),
        },
      ]}
    />
  )
}

/** Approval and Controller release for a valuation-change MCH (used by the wizard page and the register detail). */
export function ValuationActions({ c, disabled, why }: { c: MchRecord; disabled?: boolean; why?: string }) {
  const [role] = useRole()
  const v = c.valuation
  if (!v) return null
  const released = !!v.controllerApplied
  return (
    <Section title={`${v.kind}: approval and release`}>
      <div className="flex flex-wrap items-center gap-2">
        {(c.stage === "Draft" || c.stage === "In approval") && (
          <ApprovalButton kind="Material change" subject={{ type: "material", id: c.id }} title={`${c.id}: ${c.title} (${c.rows.length} rows, effective ${v.effective})`} variant="default" stay disabled={disabled} disabledReason={why} />
        )}
        {(c.stage === "Approved" || c.stage === "Scheduled") && !released && (
          <Button disabled={disabled || role !== "Controller"} title={why ?? (role !== "Controller" ? "The Controller releases a valuation change" : undefined)} onClick={() => run(applyValuationMch(c.id), `${c.id} released`)}>
            Release as Controller
          </Button>
        )}
        {(c.stage === "Approved" || c.stage === "Scheduled") && !released && v.effective > TODAY && (
          <Button variant="outline" disabled={disabled || role !== "Controller"} title="Prototype shortcut: pretend the period boundary has arrived" onClick={() => run(applyValuationMch(c.id, true), `${c.id} released at the boundary`)}>
            Simulate reaching {fmtDate(v.effective)}
          </Button>
        )}
        {released && <span className="text-sm">Released by the Controller on {fmtDate(v.controllerApplied!.on)}.</span>}
      </div>
      <p className="text-xs text-muted-foreground">Applies at the period boundary {fmtDate(v.effective)}: before it, release is refused with E-MM-22 / §5.4. {role !== "Controller" && "Switch Acting as to the Controller to release."} <Link to="/materials/account-determination" className="text-link underline-offset-4 hover:underline">Account determination</Link></p>
    </Section>
  )
}
