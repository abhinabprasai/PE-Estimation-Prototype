// FX-INV-COUNTSHEETS Count plan: Generate Count Sheets (delta to INV 7.1). A wizard that creates one
// Count Document per counting unit (zone, aisle or item group) and deals them to a counter team.
// The documents land in the materials slice (INV-COUNT-DOC); this is the supervisor's entry to them.
// Sources: Book I Part A §7.1 [DOC:p.36] "one Count Document per counting unit, by default one per
// warehouse zone per counter team (config: per zone / per aisle / per item group)"; §7.2 Generated
// (expected quantities frozen, snapshot stored); Dev Note on the freeze (E-CNT-01, Soft Freeze);
// §7.3 role rights; SOD control (asserted).
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WizardPage, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, StatusBadge } from "@/components/patterns"
import { USERS, WAREHOUSES } from "@/data/shared"
import type { UserId } from "@/data/domain"
import { fmtMoney } from "@/lib/format"
import { useCore, useSlice, useMutate } from "@/store"
import { Reading, userName } from "../components/bits"
import { useViewState } from "../components/states"
import { previewSheets, rateOf, type SheetBasis } from "../lib/count"
import { FLOOR_COUNT_ROLES } from "../lib/rules"
import * as A from "../data/count-actions"

const BASES: { id: SheetBasis; label: string; hint: string }[] = [
  { id: "Zone", label: "Per warehouse zone", hint: "The bin's first letter: one document per zone (the PRD default)." },
  { id: "Aisle", label: "Per aisle", hint: "The first two segments of the bin, such as C-01." },
  { id: "Item group", label: "Per item group", hint: "The material type: RAW, SEMI, PACK and so on." },
]
const TYPES = ["RAW", "SEMI", "FIN", "TRADE", "PACK", "SPARE", "CONS"]

export function CountSheets() {
  const mats = useSlice("materials")
  const io = useSlice("inventoryOps")
  const core = useCore()
  const writeIo = useMutate("inventoryOps")
  const ss = useViewState("FX-INV-COUNTSHEETS", { degradedWhat: "Valuation rates are slow, so the value column may be out of date", authorizedRoles: ["Warehouse supervisor"] })
  const [wh, setWh] = useState<string>(WAREHOUSES[0].id)
  const [basis, setBasis] = useState<SheetBasis>("Zone")
  const [types, setTypes] = useState<string[]>([])
  const [planId, setPlanId] = useState("")
  const [blind, setBlind] = useState(true)
  const [soft, setSoft] = useState(true)
  const [sod, setSod] = useState(true)
  const [team, setTeam] = useState<string[]>([])
  const [result, setResult] = useState<{ planId: string; ids: string[]; skipped: number } | null>(null)

  const counters = USERS.filter((u) => u.roles.some((r) => FLOOR_COUNT_ROLES.includes(r)))
  const pv = previewSheets(mats, { warehouseId: wh, basis, types }, (id) => rateOf(mats, id))
  const nextPlan = (() => {
    const plans = [...new Set(mats.countDocuments.map((c) => c.planId))].sort()
    return `CP-2026-0${Number(plans[plans.length - 1]?.slice(-2) ?? "10") + 1}`
  })()
  const total = pv.units.reduce((a, u) => a + u.value, 0)
  const lines = pv.units.reduce((a, u) => a + u.rows.length, 0)

  if (ss.loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader title="Generate count sheets" screenId="FX-INV-COUNTSHEETS" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full max-w-[960px]" />
      </div>
    )

  const header = {
    title: "Generate count sheets",
    screenId: "FX-INV-COUNTSHEETS",
    description: "Creates one count document per counting unit from a count plan, freezes the expected quantities at a snapshot and deals the documents to a counter team. The documents open in Count documents (INV-COUNT-DOC) and on the handheld.",
    actions: ss.toolbar,
    chips: <Chip kind="oq" id="RD-IO-06" note="Aisle and item group readings; counter team dealing" />,
    children: ss.banners,
    crumbs: [{ label: "Generate count sheets" }],
  }

  if (result)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        <section aria-label="Result" className="flex max-w-[960px] flex-col gap-3 rounded-lg border p-6">
          <h2 className="text-base font-semibold">{result.planId}: {result.ids.length} count document(s) generated</h2>
          <p className="text-sm text-muted-foreground">Expected quantities are frozen at the snapshot. Bins are frozen for movements (E-CNT-01){soft ? ", or flagged Moved During Count with Soft Freeze ON" : ""} until the documents are approved.{result.skipped ? ` ${result.skipped} bin row(s) already under an open count document were skipped.` : ""}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {result.ids.map((id) => {
              const c = mats.countDocuments.find((x) => x.id === id)
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/inventory/counting/count-documents/${id}`}>{id}</Link>
                  {c && <StatusBadge kind="countDocument" status={c.status} size="sm" />}
                  <span className="text-muted-foreground">{c?.location}{c?.counterIds[0] ? ` · ${userName(c.counterIds[0])}` : ""}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResult(null)}>Generate another plan</Button>
            <Button asChild><Link to="/mobile/counts">Open the handheld count entry</Link></Button>
          </div>
        </section>
      </div>
    )

  const history = [...new Set(mats.countDocuments.map((c) => c.planId))].sort().reverse()
  return (
    <WizardPage
      header={header}
      finishLabel="Generate count sheets"
      consequence={`Creates ${pv.units.length} count document(s) for ${wh} in plan ${planId.trim() || nextPlan}: ${lines} line(s), ${fmtMoney(total)} at current valuation. Expected quantities are frozen at the snapshot and the bins are frozen for movements (E-CNT-01) until the documents are approved${soft ? "; with Soft Freeze ON movements post and flag the line Moved During Count" : ""}. ${team.length ? `Documents are dealt to ${team.map(userName).join(", ")} and start Assigned.` : "Documents start Generated; assign counters next."}`}
      onFinish={() => {
        if (ss.error) return ss.error
        if (!ss.canWrite) return ss.blockedWhy ?? "Not allowed."
        const r = A.generateSheets({ warehouseId: wh, basis, types, planId, blind, softFreeze: soft, team: team as UserId[] })
        if (!r.ok) return r.error
        writeIo((d, ctx) => { d.countPlans.unshift({ planId: r.value.planId, at: `${ctx.today}T12:00`, by: ctx.userId, warehouseId: wh, basis, team: team as UserId[], blind, softFreeze: soft, docIds: r.value.ids, skipped: r.value.skipped }) })
        toast.success(`${r.value.planId}: ${r.value.ids.length} document(s) generated`)
        setResult(r.value)
        return null
      }}
      steps={[
        {
          id: "scope",
          title: "Plan and scope",
          validate: () => (ss.validation ? "Choose a warehouse and a counting unit to continue." : !wh ? "Choose a warehouse." : null),
          content: (
            <div className="grid gap-4">
              <div className="grid gap-1 md:max-w-sm">
                <Label htmlFor="cs-wh">Warehouse</Label>
                <Select value={wh} onValueChange={setWh}>
                  <SelectTrigger id="cs-wh" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{WAREHOUSES.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1 md:max-w-sm">
                <Label htmlFor="cs-plan">Count plan number (optional)</Label>
                <Input id="cs-plan" value={planId} placeholder={`${nextPlan} (next)`} onChange={(e) => setPlanId(e.target.value)} />
                <span className="text-xs text-muted-foreground">Existing plans: {history.join(", ")}. Documents are numbered CD-{"{plan}"}-{"{SEQ:3}"}.</span>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">One document per</legend>
                {BASES.map((b) => (
                  <label key={b.id} className="flex items-start gap-2 text-sm">
                    <input type="radio" name="basis" className="mt-1" checked={basis === b.id} onChange={() => setBasis(b.id)} />
                    <span><span className="font-medium">{b.label}</span> <span className="text-muted-foreground">{b.hint}</span>{b.id !== "Zone" && <> <Reading id="RD-IO-06" /></>}</span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Material types to count (none ticked counts every type)</legend>
                <div className="flex flex-wrap gap-4">
                  {TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={types.includes(t)} onCheckedChange={(v) => setTypes(v ? [...types, t] : types.filter((x) => x !== t))} aria-label={`Count ${t}`} />
                      {t}
                    </label>
                  ))}
                </div>
              </fieldset>
              {io.countPlans.length > 0 && <p className="text-xs text-muted-foreground">Generated from this screen: {io.countPlans.map((p) => `${p.planId} (${p.docIds.length} documents, ${p.basis.toLowerCase()})`).join("; ")}.</p>}
            </div>
          ),
        },
        {
          id: "rules",
          title: "Counting rules and counter team",
          validate: () => {
            if (sod && team.includes(core.userId)) return `Separation of duties is ON: ${userName(core.userId)} generates these documents and cannot count them (p.37 §7.3).`
            return null
          },
          content: (
            <div className="grid gap-4">
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={blind} onCheckedChange={setBlind} aria-label="Blind count" />
                <span><span className="font-medium">Blind count.</span> Counters never receive the expected quantity: it is not sent to the handheld, not hidden by styling (p.37 §7.3).</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={soft} onCheckedChange={setSoft} aria-label="Soft freeze" />
                <span><span className="font-medium">Soft Freeze.</span> ON: movements on the counted bins post and the line is flagged Moved During Count, which forces a recount. OFF: movements are blocked (E-CNT-01 "Location is frozen for counting").</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={sod} onCheckedChange={setSod} aria-label="Separation of duties" />
                <span><span className="font-medium">Separation of duties.</span> The person who generates the documents cannot count them.</span>
              </label>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Counter team (one counter per document, dealt in turn) <Reading id="RD-IO-06" /></legend>
                {counters.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={team.includes(u.id)} onCheckedChange={(v) => setTeam(v ? [...team, u.id] : team.filter((x) => x !== u.id))} aria-label={`Counter ${u.name}`} />
                    {u.name} <span className="text-muted-foreground">{u.roles[0]}</span>
                  </label>
                ))}
                <span className="text-xs text-muted-foreground">Leave empty to assign counters later; documents then start Generated.</span>
              </fieldset>
            </div>
          ),
        },
        {
          id: "preview",
          title: "Preview the documents",
          validate: () => (!pv.units.length ? (pv.total ? `Every bin with stock in ${wh} is already under an open count document (E-CNT-01).` : `No countable stock in ${wh}.`) : null),
          content: ss.empty || !pv.units.length ? (
            <EmptyState title="Nothing to generate">{pv.total ? `All ${pv.total} bin row(s) are already under an open count document (E-CNT-01). Void or finish those first.` : `No countable stock in ${wh}. Consignment, customer property and in-transit stock is not counted.`}</EmptyState>
          ) : (
            <div className="grid gap-3">
              {ss.error && <ErrorAlert title="The preview could not be built">{ss.error}</ErrorAlert>}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Counting unit</TableHead>
                      <TableHead className="text-right">Bins</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Value at valuation</TableHead>
                      <TableHead>Counter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pv.units.map((u, i) => (
                      <TableRow key={u.key} className="h-8 text-[13px]">
                        <TableCell className="font-mono">CD-{planId.trim() || nextPlan}-{String(i + 1).padStart(3, "0")}</TableCell>
                        <TableCell>{u.label}</TableCell>
                        <TableCell className="tabular text-right">{u.bins}</TableCell>
                        <TableCell className="tabular text-right">{u.rows.length}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(u.value)}</TableCell>
                        <TableCell>{team.length ? userName(team[i % team.length]) : <span className="text-muted-foreground">Assign later</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pv.skipped > 0 && <p className="text-sm text-muted-foreground">{pv.skipped} bin row(s) are skipped: they are already under an open count document (E-CNT-01).</p>}
              <p className="text-sm text-muted-foreground">{blind ? "Blind" : "Not blind"} · {soft ? "Soft Freeze ON" : "Soft Freeze OFF (movements blocked)"} · snapshot taken on generation; late valuation changes do not skew entered documents (§7.4 item 2).</p>
            </div>
          ),
        },
      ]}
    />
  )
}
