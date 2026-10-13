// MM-MCH-001 Material Change Requests [DOC:p.246] (asserted); rules Book II §4.4, §16.1.
// Wizard: selection, change definition, simulation grid with per-row validation, apply step with
// result log. Class 1 applies by the owner; Class 2 goes through WF-INBOX ("Material change");
// Class 3 is never editable (supersession instead). MCH has no status list (OQ-21): stage is text.
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WizardPage } from "@/components/templates"
import { ApprovalButton, DataTable, RulesPanel, type Column } from "@/components/patterns"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { FIELD_DEFS, fieldDef } from "../lib/rules"
import { allMaterials } from "../data/state"
import { applyMch, computeNew, createMch, discardMch, readField, validateMchRow, type MchRowDraft } from "../data/actions"
import type { MchRecord } from "../data/types"
import { MatLink, MaterialStatus, NoStatusList, Reading, Section, TypeBadge, userName, useListState } from "../components/common"
import { run } from "../components/run"
import { ValuationActions, ValuationWizard } from "./MchValuation"

const EDITABLE = FIELD_DEFS.filter((f) => f.cls !== 3)

export function MchWizard() {
  const s = useSlice("materials")
  const [sp, setSp] = useSearchParams()
  const [round, setRound] = useState(0)
  const preset = sp.get("materials")?.split(",").filter(Boolean) ?? []
  const presetField = sp.get("field") ?? ""
  const openId = sp.get("mch")
  const [variant, setVariant] = useState<"standard" | "valuation">(presetField === "method" || sp.get("variant") === "valuation" ? "valuation" : "standard")
  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Kind of change" className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={variant === "standard" ? "secondary" : "outline"} aria-pressed={variant === "standard"} onClick={() => setVariant("standard")}>
          Field change
        </Button>
        <Button size="sm" variant={variant === "valuation" ? "secondary" : "outline"} aria-pressed={variant === "valuation"} onClick={() => setVariant("valuation")}>
          Valuation change (§5.4)
        </Button>
      </div>
      {variant === "standard" ? (
        <Wizard key={round} preset={preset} presetField={presetField} onDone={(id) => (setRound((r) => r + 1), setSp({ mch: id }))} />
      ) : (
        <ValuationWizard key={`v${round}`} preset={preset} onDone={(id) => (setRound((r) => r + 1), setSp({ mch: id }))} />
      )}
      <MchRegister openId={openId} onOpen={(id) => setSp({ mch: id })} />
      {openId && s.mchs.some((c) => c.id === openId) && <MchRecordPanel c={s.mchs.find((c) => c.id === openId)!} />}
      <RulesPanel
        rules={[
          ["§4.4", "Class 1: owner edits, applied immediately or effective-dated. Class 2: needs approval through WF-INBOX before it applies. Class 3: never editable (type, number, base UoM after first posting).", "[Book II §4.4]"],
          ["§16.1", "The simulation grid validates every row; failing rows are excluded and listed, the rest apply with a result log.", "[Book II §16.1]"],
          ["V-MM-07", "NSTK and SERV are forced to MRP type None.", "[Book II §3.6]"],
          ["§5.4", "Standard price is mandatory for make items (SEMI, FIN).", "[Book II §5.4]"],
          ["OQ-21", "MCH has no status list in the PRD; its stage is text.", "open-questions.md"],
        ]}
      />
    </div>
  )
}

function Wizard({ preset, presetField, onDone }: { preset: string[]; presetField: string; onDone: (id: string) => void }) {
  const s = useSlice("materials")
  const mats = useMemo(() => allMaterials(s).filter((m) => m.status !== "Obsolete"), [s])
  const [sel, setSel] = useState<string[]>(preset)
  const [fieldKey, setField] = useState(EDITABLE.some((f) => f.key === presetField) ? presetField : "plannedDeliveryDays")
  const [mode, setMode] = useState<MchRecord["mode"]>("Set")
  const [value, setValue] = useState("")
  const [find, setFind] = useState("")
  const [apply, setApply] = useState<MchRecord["apply"]>("Immediate")
  const [effective, setEffective] = useState("")
  const [reason, setReason] = useState("")
  const [eco, setEco] = useState("")
  const [title, setTitle] = useState("")
  const f = fieldDef(fieldKey)!
  const rows: MchRowDraft[] = sel.map((id) => {
    const old = readField(s, id, fieldKey)
    const nu = computeNew(old, mode, value, find)
    return { materialId: id, old, new: nu, error: value === "" ? "Enter the new value" : validateMchRow(s, id, fieldKey, nu) }
  })
  const good = rows.filter((r) => !r.error).length
  const cols: Column<(typeof mats)[number]>[] = [
    { id: "id", header: "Material", value: (m) => m.id, mono: true, sortable: true },
    { id: "type", header: "Type", value: (m) => m.type, filterable: true, cell: (m) => <TypeBadge type={m.type} /> },
    { id: "desc", header: "Description", value: (m) => m.description },
    { id: "status", header: "Lifecycle", value: (m) => m.status, filterable: true, cell: (m) => <MaterialStatus m={m} /> },
    { id: "cur", header: `Current ${f.label}`, value: (m) => readField(s, m.id, fieldKey) },
  ]
  return (
    <WizardPage
      header={{
        screenId: "MM-MCH-001",
        title: "Material change request",
        description: "Single or mass change of governed fields, simulated row by row before anything applies.",
        chips: <NoStatusList />,
      }}
      steps={[
        {
          id: "select",
          title: "Selection",
          validate: () => (sel.length ? null : "Choose at least one material."),
          content: (
            <DataTable
              densityKey="MM-MCH-001-select"
              rows={mats}
              columns={cols}
              rowId={(m) => m.id}
              selectable
              selected={sel}
              onSelectedChange={setSel}
              searchText={(m) => `${m.id} ${m.description}`}
              caption={`${sel.length} selected`}
            />
          ),
        },
        {
          id: "define",
          title: "Change definition",
          validate: () => (value === "" ? "Enter the new value." : mode === "Find/replace" && !find ? "Enter the text to find." : null),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="mch-field">Field</Label>
                <Select value={fieldKey} onValueChange={(v) => (setField(v), setValue(""))}>
                  <SelectTrigger id="mch-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITABLE.map((x) => (
                      <SelectItem key={x.key} value={x.key}>
                        {x.label} · Class {x.cls} · {x.view}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Class {f.cls}: {f.cls === 1 ? "applies on your confirmation" : "needs approval in WF-INBOX before it applies"}. Owner {f.owner}.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as MchRecord["mode"])} className="flex gap-4">
                  {(["Set", ...(f.numeric ? ["Adjust %"] : []), ...(!f.options && !f.numeric ? ["Find/replace"] : [])] as MchRecord["mode"][]).map((x) => (
                    <label key={x} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={x} /> {x}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {mode === "Find/replace" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="mch-find">Find</Label>
                  <Input id="mch-find" value={find} onChange={(e) => setFind(e.target.value)} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Label htmlFor="mch-val">{mode === "Adjust %" ? "Adjust by %" : mode === "Find/replace" ? "Replace with" : "New value"}</Label>
                {f.options && mode === "Set" ? (
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger id="mch-val">
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="mch-val" value={value} inputMode={f.numeric ? "decimal" : undefined} onChange={(e) => setValue(e.target.value)} />
                )}
              </div>
            </div>
          ),
        },
        {
          id: "simulate",
          title: "Simulation",
          validate: () => (good ? null : "Every row fails validation; change the definition."),
          content: (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {good} row(s) pass, {rows.length - good} excluded.
              </p>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Old</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.materialId} className={cn("h-8 text-[13px]", r.error && "text-muted-foreground")}>
                      <TableCell>
                        <MatLink id={r.materialId} />
                      </TableCell>
                      <TableCell>{r.old || "blank"}</TableCell>
                      <TableCell>{r.new}</TableCell>
                      <TableCell className={cn(r.error ? "text-destructive" : "")}>{r.error ? `Excluded: ${r.error}` : "Passes"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ),
        },
        {
          id: "apply",
          title: "Apply",
          validate: () => (!reason.trim() ? "Enter the reason for the change." : apply === "Effective-dated" && !effective ? "Choose the effective date." : null),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label htmlFor="mch-title">Title</Label>
                <Input id="mch-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${f.label}: ${good} materials`} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Apply</Label>
                <RadioGroup value={apply} onValueChange={(v) => setApply(v as MchRecord["apply"])} className="flex gap-4">
                  {(["Immediate", "Effective-dated"] as const).map((x) => (
                    <label key={x} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={x} /> {x}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {apply === "Effective-dated" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="mch-eff">Effective date</Label>
                  <Input id="mch-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Label htmlFor="mch-eco">ECO reference (optional)</Label>
                <Input id="mch-eco" value={eco} onChange={(e) => setEco(e.target.value)} placeholder="ECO-TBD-..." />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label htmlFor="mch-reason">Reason (required)</Label>
                <Textarea id="mch-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          ),
        },
      ]}
      finishLabel={f.cls === 1 ? "Create and apply" : "Create change request"}
      consequence={
        f.cls === 1
          ? `Creates the MCH and applies ${good} row(s) of ${f.label} ${apply === "Immediate" ? "now" : `on ${effective || "the effective date"}`}; ${rows.length - good} excluded rows are listed in the log.`
          : `Creates the MCH in Draft with ${good} row(s); send it for approval from the record below. Nothing applies until WF-INBOX approves.`
      }
      onFinish={() => {
        const r = createMch({ title, fieldKey, mode, rows, apply, effective: effective || undefined, reason, ecoRef: eco || undefined })
        if (!r.ok) return r.error
        if (f.cls === 1) run(applyMch(r.value), apply === "Immediate" ? `${r.value} applied` : `${r.value} scheduled for ${effective}`)
        else run(r, `${r.value} created in Draft`)
        onDone(r.value)
        return null
      }}
    />
  )
}

function MchRegister({ openId, onOpen }: { openId: string | null; onOpen: (id: string) => void }) {
  const s = useSlice("materials")
  const st = useListState("MM-MCH-001-register")
  const cols: Column<MchRecord>[] = [
    { id: "id", header: "MCH", value: (c) => c.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (c) => c.title },
    { id: "cls", header: "Class", value: (c) => c.fieldClass, filterable: true },
    { id: "rows", header: "Rows", value: (c) => c.rows.length, align: "right", mono: true, cell: (c) => `${c.rows.length}${c.excluded.length ? ` (+${c.excluded.length} excluded)` : ""}` },
    { id: "apply", header: "Apply", value: (c) => (c.apply === "Immediate" ? "Immediate" : `Effective ${c.effective}`) },
    { id: "stage", header: "Stage", value: (c) => c.stage, filterable: true },
    { id: "by", header: "Requested by", value: (c) => userName(c.createdBy) },
    { id: "on", header: "Created", value: (c) => c.createdOn, sortable: true, cell: (c) => fmtDate(c.createdOn) },
  ]
  return (
    <Section title={`Change requests (${s.mchs.length})`}>
      <DataTable
        densityKey="MM-MCH-001-register"
        rows={st.empty ? [] : s.mchs}
        columns={cols}
        rowId={(c) => c.id}
        activeId={openId ?? undefined}
        onRowClick={(c) => onOpen(c.id)}
        loading={st.loading}
        error={st.error}
        onRetry={st.onRetry}
        toolbar={st.toolbar}
        empty={{ title: "No change requests yet", body: "Run the wizard above to create one." }}
        initialSort={{ id: "on", dir: "desc" }}
      />
    </Section>
  )
}

function MchRecordPanel({ c }: { c: MchRecord }) {
  const download = () => {
    const blob = new Blob([[`${c.id} ${c.title}`, `Stage: ${c.stage}`, ...c.log, ...c.excluded.map((x) => `excluded ${x.materialId}: ${x.reason}`)].join("\n")], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${c.id}-log.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Section
      title={`${c.id} ${c.title}`}
      action={
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border px-2 py-0.5 text-xs font-normal">Stage: {c.stage}</span>
          {c.fieldClass === 2 && !c.valuation && (c.stage === "Draft" || c.stage === "In approval") && (
            <ApprovalButton kind="Material change" subject={{ type: "material", id: c.id }} title={`${c.id}: ${c.title} (${c.rows.length} rows)`} variant="default" stay />
          )}
          {c.fieldClass === 1 && c.stage === "Draft" && (
            <Button size="sm" onClick={() => run(applyMch(c.id), `${c.id} applied`)}>
              Apply now
            </Button>
          )}
          {c.stage === "Scheduled" && !c.valuation && (
            <Button size="sm" variant="outline" onClick={() => run(applyMch(c.id, true), `${c.id} applied now`)}>
              Apply now (before {c.effective})
            </Button>
          )}
          {c.stage === "Draft" && (
            <Button size="sm" variant="ghost" onClick={() => run(discardMch(c.id), `${c.id} discarded`)}>
              Discard
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={download}>
            <Download aria-hidden="true" /> Download log
          </Button>
        </span>
      }
    >
      <p className="text-sm">
        Class {c.fieldClass} · {c.mode} · {c.apply === "Immediate" ? "Immediate" : `Effective ${c.effective}`} · Reason: {c.reason}
        {c.ecoRef && ` · ${c.ecoRef}`}
      </p>
      {c.valuation && <ValuationActions c={c} />}
      {c.fieldKey === "sellable" && c.rows.some((r) => r.new === "Yes") && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Sellable ON where the type default is OFF is governed: Sales Admin and Materials Manager approve it as a Class 2 change (§3.12, §4.4). <Reading id="RD-MM-28" />
        </p>
      )}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Old</TableHead>
            <TableHead>New</TableHead>
            <TableHead>Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.rows.map((r) => (
            <TableRow key={r.materialId} className="h-8 text-[13px]">
              <TableCell>
                <MatLink id={r.materialId} />
              </TableCell>
              <TableCell>{r.field}</TableCell>
              <TableCell>{r.old || "blank"}</TableCell>
              <TableCell>{r.new}</TableCell>
              <TableCell>{r.appliedAt ? fmtDate(r.appliedAt) : ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {c.excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Excluded: {c.excluded.map((x) => `${x.materialId} (${x.reason})`).join("; ")}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold">Result log</p>
          <ul className="text-xs">{c.log.length ? c.log.map((l, i) => <li key={i}>{l}</li>) : <li className="text-muted-foreground">Nothing applied yet.</li>}</ul>
        </div>
        <div>
          <p className="text-xs font-semibold">Activity</p>
          <ul className="text-xs">
            {c.activity.map((a, i) => (
              <li key={i}>
                {fmtDate(a.at)} · {a.by} · {a.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

