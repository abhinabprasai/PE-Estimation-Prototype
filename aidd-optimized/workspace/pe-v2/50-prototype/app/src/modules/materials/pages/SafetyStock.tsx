// INV-PLAN-SAFETY-001 Safety stock maintenance, /inventory/planning/safety-stock, Config grid
// [DOC:p.43 §10; Book VII p.281] (asserted): grid per material and warehouse with inherited defaults
// grayed, customer buffer rows, seasonal multiplier columns and reserved Suggested SS / Service Level
// columns. Planners (and Inventory Admin, RD-MM-12) edit inline with reason codes; deltas above a
// quarter route to the Planning Manager through WF-INBOX. ROP, Available and the reorder proposal per
// §10.2; alerts and SS-EX-01 per §10.4. Effective SS in month m = base SS x multiplier[m] (§10.3).
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage } from "@/components/templates"
import { ApprovalButton, Chip, DataTable, FamilyBadge, KV, RulesPanel, type Column } from "@/components/patterns"
import { CUSTOMERS } from "@/data/shared"
import { fmtDate, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRole, useSlice } from "@/store"
import { MONTHS, SS_APPROVAL_PCT, available, monthIndex, reorderPoint, reorderProposal, ssAlerts, ssBase, ssDeltaPct, ssEffective } from "../lib/rules"
import { getMaterial } from "../data/state"
import { changeMultipliers, changeSs, resetToDefault, withdrawSsChange } from "../data/actions"
import type { SafetyStockRow, SsReason } from "../data/types"
import { MatLink, Reading, Section, userName, useListState } from "../components/common"
import { run } from "../components/run"

const REASONS: SsReason[] = ["Demand Change", "Lead Time Change", "Service Level Change", "New Item", "Annual Review"]
const SEV_FAMILY = { Critical: "exception", Warning: "pending", Info: "draft" } as const
const SECTIONS = [
  { id: "grid", label: "Warehouse rows" },
  { id: "seasonal", label: "Seasonal profiles" },
  { id: "buffers", label: "Customer buffers" },
  { id: "exceptions", label: "Exceptions (SS-EX-01)" },
]
const FILTERS = [
  { id: "all", label: "All" },
  { id: "below", label: "Below safety stock" },
  { id: "rop", label: "Below reorder point" },
  { id: "pending", label: "Pending approval" },
] as const

export function SafetyStock() {
  const s = useSlice("materials")
  const [role] = useRole()
  const [sp, setSp] = useSearchParams()
  const st = useListState("INV-PLAN-SAFETY")
  const [section, setSection] = useState("grid")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const matFilter = sp.get("material")
  const openId = sp.get("row")
  const mon = monthIndex()
  const all = useMemo(() => s.safetyStock.filter((r) => !matFilter || r.materialId === matFilter), [s, matFilter])
  const has = (r: SafetyStockRow, code: string) => ssAlerts(r).some((a) => a.code === code)
  const q: Record<string, SafetyStockRow[]> = {
    all,
    below: all.filter((r) => has(r, "Below Safety Stock")),
    rop: all.filter((r) => has(r, "Below Reorder Point")),
    pending: all.filter((r) => r.pending),
  }
  const exceptions = all.flatMap((r) => ssAlerts(r).filter((a) => a.code === "SS-EX-01" || a.code === "W-SS-02").map((a) => ({ r, a })))
  const row = s.safetyStock.find((r) => r.id === openId)
  const select = (r: SafetyStockRow) => setSp(matFilter ? { material: matFilter, row: r.id } : { row: r.id })

  const cols: Column<SafetyStockRow>[] = [
    { id: "m", header: "Material", value: (r) => r.materialId, sortable: true, mono: true },
    { id: "wh", header: "Warehouse", value: (r) => r.warehouseId, filterable: true },
    {
      id: "ss",
      header: "Base SS",
      value: (r) => ssBase(r),
      align: "right",
      mono: true,
      cell: (r) => (r.ss == null ? <span className="text-muted-foreground" title="Blank row inherits the item default (§10.3)">{fmtNumber(r.defaultSs)} (default)</span> : fmtNumber(r.ss)),
    },
    { id: "mult", header: `x ${MONTHS[mon]}`, value: (r) => r.multipliers?.[mon] ?? 1, align: "right", mono: true, cell: (r) => <span className={cn(!r.multipliers && "text-muted-foreground")}>{(r.multipliers?.[mon] ?? 1).toFixed(2)}</span> },
    { id: "eff", header: "Effective SS", value: (r) => ssEffective(r), align: "right", mono: true, sortable: true, cell: (r) => `${fmtNumber(ssEffective(r))} ${r.uom}` },
    { id: "sug", header: "Suggested SS", value: () => "", align: "right", cell: () => <span className="text-muted-foreground" title="Reserved for the Phase 2 statistical engine (§10.2)">Phase 2</span> },
    { id: "sl", header: "Service level", value: () => "", align: "right", cell: () => <span className="text-muted-foreground" title="Reserved for the Phase 2 statistical engine (§10.2)">Phase 2</span> },
    { id: "adu", header: "ADU", value: (r) => r.adu, align: "right", mono: true },
    { id: "lt", header: "LT days", value: (r) => r.ltDays, align: "right", mono: true },
    { id: "rop", header: "ROP", value: (r) => reorderPoint(r), align: "right", mono: true, sortable: true },
    { id: "av", header: "Available", value: (r) => available(r), align: "right", mono: true, sortable: true, cell: (r) => `${fmtNumber(available(r))} ${r.uom}` },
    { id: "oo", header: "On order", value: (r) => r.onOrder, align: "right", mono: true },
    { id: "prop", header: "Proposal", value: (r) => reorderProposal(r), align: "right", mono: true, cell: (r) => (reorderProposal(r) ? fmtNumber(reorderProposal(r)) : "") },
    {
      id: "alerts",
      header: "Alerts",
      value: (r) => ssAlerts(r).map((a) => a.code).join(", "),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {ssAlerts(r)
            .filter((a) => a.severity !== "Info")
            .map((a, i) => (
              <FamilyBadge key={i} family={SEV_FAMILY[a.severity]} label={a.code} size="sm" title={a.text} />
            ))}
          {r.pending && <Chip kind="change">Change pending</Chip>}
        </span>
      ),
    },
  ]

  const content =
    section === "grid" ? (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter rows">
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "secondary" : "ghost"} role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} ({q[f.id].length})
            </Button>
          ))}
        </div>
        <DataTable
          densityKey="INV-PLAN-SAFETY"
          rows={st.empty ? [] : q[filter]}
          columns={cols}
          rowId={(r) => r.id}
          activeId={openId ?? undefined}
          onRowClick={select}
          searchText={(r) => `${r.materialId} ${r.warehouseId}`}
          loading={st.loading}
          error={st.error}
          onRetry={st.onRetry}
          toolbar={st.toolbar}
          empty={{ title: "No rows", body: "Nothing in this filter right now." }}
        />
        {row ? <RowEditor key={row.id} row={row} role={role} onClose={() => setSp(matFilter ? { material: matFilter } : {})} /> : <p className="text-sm text-muted-foreground">Select a row to edit it inline.</p>}
      </div>
    ) : section === "seasonal" ? (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Twelve monthly multipliers per row (default 1.0). Effective SS in month m = base SS x multiplier[m]; the current month is {MONTHS[mon]}. <Reading id="RD-MM-22" />
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Material / warehouse</TableHead>
                <TableHead className="text-right">Base SS</TableHead>
                {MONTHS.map((x, i) => (
                  <TableHead key={x} className={cn("text-right", i === mon && "font-semibold")}>
                    {x}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((r) => (
                <TableRow key={r.id} className={cn("h-8 cursor-pointer text-[13px]", r.id === openId && "bg-muted")} onClick={() => (select(r), setSection("grid"))}>
                  <TableCell className="font-mono">
                    {r.materialId} · {r.warehouseId}
                  </TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(ssBase(r))}</TableCell>
                  {MONTHS.map((x, i) => (
                    <TableCell key={x} className={cn("tabular text-right", !r.multipliers && "text-muted-foreground", i === mon && "font-semibold")}>
                      {(r.multipliers?.[i] ?? 1).toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    ) : section === "buffers" ? (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Per-customer reservation buffers: a standing material reservation (source type Customer Buffer) that renews as stock is consumed and reduces Available (§10.3).</p>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Reserved buffer</TableHead>
              <TableHead>Valid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.buffers
              .filter((b) => !matFilter || b.materialId === matFilter)
              .map((b) => (
                <TableRow key={b.id} className="h-8 text-[13px]">
                  <TableCell>{CUSTOMERS.find((c) => c.id === b.customerId)?.name ?? b.customerId}</TableCell>
                  <TableCell>
                    <MatLink id={b.materialId} />
                  </TableCell>
                  <TableCell>{b.warehouseId}</TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(b.qty)}</TableCell>
                  <TableCell>
                    {fmtDate(b.validFrom)} to {b.validTo ? fmtDate(b.validTo) : "open"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">SS-EX-01: SS above max stock level, SS with zero ADU (dead buffer), never breached in 12 months (over-buffered), breached three or more times in 90 days (under-buffered); W-SS-02 above the shelf-life cap.</p>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="text-right">Breaches 90 d / 12 m</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exceptions.map(({ r, a }, i) => (
              <TableRow key={i} className="h-8 cursor-pointer text-[13px]" onClick={() => (select(r), setSection("grid"))}>
                <TableCell className="font-mono">
                  {r.materialId} · {r.warehouseId}
                </TableCell>
                <TableCell>
                  <FamilyBadge family={SEV_FAMILY[a.severity]} label={a.code} size="sm" />
                </TableCell>
                <TableCell>{a.text}</TableCell>
                <TableCell className="tabular text-right">
                  {r.breaches90} / {r.breaches12m}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )

  return (
    <>
      <ConfigPage
        header={{
          screenId: "INV-PLAN-SAFETY",
          title: matFilter ? `Safety stock for ${matFilter}` : "Safety stock",
          description: `INV-PLAN-SAFETY-001. Safety stock per item and warehouse: the floor MRP protects and the line projection reports draw. ${q.below.length} row(s) below safety stock, ${q.pending.length} change(s) waiting for the Planning Manager.`,
          chips: <Reading id="RD-MM-12" />,
          actions: matFilter ? (
            <Button variant="ghost" onClick={() => setSp({})}>
              Show all
            </Button>
          ) : undefined,
        }}
        sections={SECTIONS}
        section={section}
        onSectionChange={setSection}
      >
        {content}
      </ConfigPage>
      <RulesPanel
        rules={[
          ["§10.2", "ROP = ADU x lead time + effective safety stock; Available = on hand - reserved - QI Hold - Blocked; proposal when Available + On order is at or below ROP: max - available - on order, at least the reorder qty, rounded up to the multiple.", "[DOC:pp.43-44 §10.2]"],
          ["§10.3", "A blank warehouse row inherits the item default (grayed). Effective SS in month m = base SS x multiplier[m].", "[DOC:p.43 §10.3]"],
          ["§10.1", `Every change carries a reason code; a change above ${SS_APPROVAL_PCT}% (including a reset to default) goes to the Planning Manager.`, "[DOC:p.43 §10.1]"],
          ["§10.4", "Below Safety Stock (Available < effective SS) is Critical; Below Reorder Point is a Warning; SS-EX-01 and W-SS-02 per the exceptions section.", "[DOC:p.44 §10.4]"],
          ["RD-MM-12 / RD-MM-22", "Inventory Admin stand-in; reserved Phase 2 columns and seasonal-profile approval.", "README Readings"],
        ]}
      />
    </>
  )
}

function RowEditor({ row, role, onClose }: { row: SafetyStockRow; role: string; onClose: () => void }) {
  const s = useSlice("materials")
  const [mode, setMode] = useState<"value" | "seasonal" | "reset">("value")
  const [newSs, setNewSs] = useState("")
  const [mult, setMult] = useState<string[]>(() => MONTHS.map((_, i) => String(row.multipliers?.[i] ?? 1)))
  const [reason, setReason] = useState<SsReason>("Demand Change")
  const [note, setNote] = useState("")
  const m = getMaterial(s, row.materialId)
  const base = ssBase(row)
  const preview =
    mode === "value" && newSs !== ""
      ? ssDeltaPct(base, row.multipliers, Number(newSs), row.multipliers)
      : mode === "seasonal"
        ? ssDeltaPct(base, row.multipliers, base, mult.map(Number))
        : mode === "reset" && row.ss != null
          ? ssDeltaPct(base, row.multipliers, row.defaultSs, row.multipliers)
          : undefined
  const save = () => {
    const r = mode === "value" ? changeSs(row.id, Number(newSs), reason, note) : mode === "seasonal" ? changeMultipliers(row.id, mult.map(Number), reason, note) : resetToDefault(row.id, reason, note)
    if (run(r, (x) => (x.pending ? `${x.changeId} waits for the Planning Manager; send it for approval` : "Safety stock changed"))) setNewSs("")
  }
  return (
    <section aria-label={`Edit ${row.materialId} at ${row.warehouseId}`} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {row.materialId} at {row.warehouseId} <span className="text-sm font-normal text-muted-foreground">{m?.description}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <dl className="grid gap-3 md:grid-cols-3">
        <KV k="Material">
          <MatLink id={row.materialId} tab="planning" />
        </KV>
        <KV k="Base / effective SS">
          {fmtNumber(base)} / {fmtNumber(ssEffective(row))} {row.uom} {row.ss == null && "(item default)"}
        </KV>
        <KV k="Reorder point">{fmtNumber(reorderPoint(row))}</KV>
        <KV k="Available">
          {fmtNumber(available(row))} = {fmtNumber(row.onHand)} - {fmtNumber(row.reserved)} reserved - {fmtNumber(row.qiHold)} QI Hold - {fmtNumber(row.blocked)} Blocked
        </KV>
        <KV k="Reorder proposal">{reorderProposal(row) ? `${fmtNumber(reorderProposal(row))} (min ${row.reorderQty}, multiple ${row.orderMultiple})` : "None"}</KV>
        <KV k="Max stock">{fmtNumber(row.maxStock)}</KV>
      </dl>
      <ul className="flex flex-col gap-1 text-sm">
        {ssAlerts(row).map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <FamilyBadge family={SEV_FAMILY[a.severity]} label={a.code} size="sm" /> {a.text}
          </li>
        ))}
      </ul>
      {row.pending ? (
        <Section title={`Change ${row.pending.changeId} waiting`}>
          <p className="text-sm">
            {row.pending.reset ? `Reset to the item default ${fmtNumber(row.defaultSs)}` : row.pending.newMultipliers ? `Seasonal profile ${row.pending.newMultipliers.map((x) => x.toFixed(2)).join(" / ")}` : `${fmtNumber(base)} to ${fmtNumber(row.pending.newSs ?? base)}`} ({row.pending.reason}, delta {row.pending.pct.toFixed(1)}%) by {userName(row.pending.by)} on {fmtDate(row.pending.on)}. {row.pending.note}
          </p>
          <div className="flex flex-wrap gap-2">
            <ApprovalButton kind="Safety stock change" subject={{ type: "material", id: row.pending.changeId }} title={`${row.pending.changeId}: ${row.materialId} ${row.warehouseId} safety stock change, delta ${row.pending.pct.toFixed(1)}%`} variant="default" stay />
            <Button variant="ghost" onClick={() => run(withdrawSsChange(row.id), "Change withdrawn")}>
              Withdraw change
            </Button>
          </div>
        </Section>
      ) : (
        <Section title="Edit">
          <p className="text-xs text-muted-foreground">Acting as {role}. Planner or inventory admin edits with a reason code; a change above {SS_APPROVAL_PCT}% waits for the Planning Manager.</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Change type">
            {(
              [
                ["value", "Safety stock"],
                ["seasonal", "Seasonal profile"],
                ["reset", "Reset to item default"],
              ] as const
            ).map(([k, l]) => (
              <Button key={k} size="sm" variant={mode === k ? "secondary" : "ghost"} role="radio" aria-checked={mode === k} disabled={k === "reset" && row.ss == null} onClick={() => setMode(k)}>
                {l}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {mode === "value" && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="ss-new">New base safety stock ({row.uom})</Label>
                <Input id="ss-new" inputMode="decimal" value={newSs} onChange={(e) => setNewSs(e.target.value)} />
              </div>
            )}
            {mode === "seasonal" && (
              <div className="grid grid-cols-4 gap-2 md:col-span-2 md:grid-cols-12">
                {MONTHS.map((x, i) => (
                  <div key={x} className="flex flex-col gap-1">
                    <Label htmlFor={`ss-m-${i}`}>{x}</Label>
                    <Input id={`ss-m-${i}`} inputMode="decimal" value={mult[i]} onChange={(e) => setMult(mult.map((v, j) => (j === i ? e.target.value : v)))} />
                  </div>
                ))}
              </div>
            )}
            {mode === "reset" && <p className="text-sm">The row will inherit the item default {fmtNumber(row.defaultSs)} {row.uom}.</p>}
            <div className="flex flex-col gap-1">
              <Label htmlFor="ss-reason">Reason code</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as SsReason)}>
                <SelectTrigger id="ss-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <Label htmlFor="ss-note">Note</Label>
              <Textarea id="ss-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {preview != null && (
            <p className="text-sm">
              Largest change {preview.toFixed(1)}%: {preview > SS_APPROVAL_PCT ? "routes to the Planning Manager in WF-INBOX before it applies." : "applies at once."}
            </p>
          )}
          <div>
            <Button disabled={mode === "value" && newSs === ""} onClick={save}>
              Save change
            </Button>
          </div>
        </Section>
      )}
      <Section title="History">
        {row.history.length ? (
          <ul className="text-sm">
            {row.history.map((h, i) => (
              <li key={i}>
                {fmtDate(h.on)} · {h.what ?? "Safety stock"} · {fmtNumber(h.old)} to {fmtNumber(h.new)} · {h.reason} · {userName(h.by)}
                {h.approval && ` · ${h.approval}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No changes recorded.</p>
        )}
      </Section>
    </section>
  )
}
