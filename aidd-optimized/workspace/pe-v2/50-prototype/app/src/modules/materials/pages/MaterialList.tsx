// MM-MAT-001 Material Listing [DOC:p.245] (asserted); fields per Book II §3.1. A register of every
// material across the nine types. "New material" always starts an MCR (C-47), never a bare record.
// Bulk bar: Assign Buyer/Planner/Steward, Set Block, Add to Change Request, Export. Quick stat pills:
// Draft, In Data Completion, Active with Missing Info Record, Restricted, Blocked, Obsolete with Stock
// [DOC:p.141 §3.1] (asserted); a pill filters the list. "My Materials" per role (RD-MM-24).
import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Download, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogShell, ListPage } from "@/components/templates"
import { Chip, RulesPanel, type Column } from "@/components/patterns"
import type { Material, MaterialBlock } from "@/data/domain"
import { USERS } from "@/data/shared"
import { fmtMoney, fmtNumber } from "@/lib/format"
import { TODAY } from "@/data/shared"
import { useCore, useRole, useSlice } from "@/store"
import { BLOCK_SETTER, completeness, isValuated } from "../lib/rules"
import { allMaterials, onHand, ownValue, rateOf, R, type MaterialsState } from "../data/state"
import { irStatus, saveClass1, setBlock } from "../data/actions"
import { Completeness, MaterialStatus, Reading, TypeBadge, userName, useListState } from "../components/common"

type Row = Material & { group: string; pct: number; qty: number; value: number; steward?: string; buyer?: string; planner?: string; rate: number; legacy?: string; method?: string }
const OWNER_FIELDS = { stewardId: "Steward", buyerId: "Buyer", plannerId: "Planner" } as const
type OwnerField = keyof typeof OWNER_FIELDS
/** Active buy material with no Active info record (pill "Active with Missing Info Record"). */
const missingIr = (s: MaterialsState, r: Row) =>
  r.status === "Active" && isValuated(r.type) && r.type !== "SEMI" && r.type !== "FIN" && (s.views[r.id]?.procurement ?? "Buy") !== "Make" && !s.infoRecords.some((x) => x.materialId === r.id && irStatus(s, x.id, TODAY) === "Active")
const PILLS: { id: string; label: string; test: (s: MaterialsState, r: Row) => boolean }[] = [
  { id: "draft", label: "Draft", test: (_s, r) => r.status === "Draft" },
  { id: "dc", label: "In Data Completion", test: (_s, r) => r.status === "Data Completion" },
  { id: "noir", label: "Active with Missing Info Record", test: missingIr },
  { id: "restricted", label: "Restricted", test: (_s, r) => r.status === "Restricted" },
  { id: "blocked", label: "Blocked", test: (_s, r) => r.status === "Blocked" },
  { id: "obsstock", label: "Obsolete with Stock", test: (_s, r) => r.status === "Obsolete" && r.qty > 0 },
]

function exportCsv(rows: Row[]) {
  const head = ["Material", "Type", "Description", "Lifecycle", "Blocks", "Group", "Base UoM", "Completeness %", "On hand", "Value USD"]
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const body = rows.map((r) => [r.id, r.type, r.description, r.status, r.blocks.map((b) => b.block).join("; "), r.group, r.baseUom, r.pct, r.qty, r.value.toFixed(2)].map(esc).join(","))
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "materials.csv"
  a.click()
  URL.revokeObjectURL(a.href)
}

export function MaterialList() {
  const s = useSlice("materials")
  const nav = useNavigate()
  const st = useListState("MM-MAT-001")
  const [selected, setSelected] = useState<string[]>([])
  const [dlg, setDlg] = useState<"owner" | "block" | null>(null)
  const [owner, setOwner] = useState<string>("USR-TBD-020")
  const [ownerField, setOwnerField] = useState<OwnerField>("stewardId")
  const [pill, setPill] = useState<string | null>(null)
  const [mine, setMine] = useState(false)
  const [role] = useRole()
  const me = useCore().userId
  const [block, setBlk] = useState<MaterialBlock>("Purchasing Block")
  const [plant, setPlant] = useState("all")
  const plantsOf = (id: string) => s.plantData.filter((p) => p.materialId === id)
  const plantIds = [...new Set(s.plantData.map((p) => p.plantId))].sort()
  const rows = useMemo<Row[]>(
    () =>
      allMaterials(s).map((m) => {
        const v = s.views[m.id]
        return {
          ...m, group: v?.groupPath.join(" / ") ?? "", pct: completeness(m, v).pct, qty: onHand(s, m.id), value: ownValue(s, m.id), steward: v?.stewardId, buyer: v?.buyerId, planner: v?.plannerId,
          rate: isValuated(m.type) ? rateOf(s, m.id) : 0, legacy: v?.legacyCode, method: v?.method,
        }
      }),
    [s],
  )
  const cols: Column<Row>[] = [
    { id: "id", header: "Material", value: (r) => r.id, sortable: true, mono: true, className: "w-44" },
    { id: "type", header: "Type", value: (r) => r.type, filterable: true, sortable: true, cell: (r) => <TypeBadge type={r.type} />, className: "w-20" },
    { id: "desc", header: "Description", value: (r) => r.description, sortable: true },
    { id: "status", header: "Lifecycle", value: (r) => r.status, filterable: true, sortable: true, cell: (r) => <MaterialStatus m={r} /> },
    { id: "group", header: "Material group", value: (r) => r.group, sortable: true, cell: (r) => <span className="text-xs">{r.group || "Not classified"}</span> },
    {
      id: "plant", header: "Plants", value: (r) => plantsOf(r.id).map((p) => p.plantId).join(" "),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {plantsOf(r.id).map((p) => (
            <Chip key={p.plantId} kind="design" note={`Plant ${p.plantId}: ${p.status}, ${p.mrpType}, ${p.procurement}, lead time ${p.leadTimeDays} d`}>
              {p.plantId}{p.status !== "Active" ? ` (${p.status})` : ""}
            </Chip>
          ))}
        </span>
      ),
    },
    { id: "pct", header: "Completeness", value: (r) => r.pct, sortable: true, cell: (r) => <Completeness pct={r.pct} active={r.status === "Active"} /> },
    { id: "qty", header: "On hand", value: (r) => r.qty, sortable: true, align: "right", mono: true, cell: (r) => (r.qty ? `${fmtNumber(r.qty)} ${r.baseUom}` : "") },
    { id: "value", header: "Stock value", value: (r) => r.value, sortable: true, align: "right", mono: true, cell: (r) => (r.value ? fmtMoney(r.value) : "") },
    { id: "cost", header: "Std cost / MAV", value: (r) => r.rate, sortable: true, align: "right", mono: true, cell: (r) => (r.rate ? <span title={r.method === "Standard" ? "Released standard" : "Moving average"}>{fmtMoney(r.rate)} {r.method === "Standard" ? "Std" : "MAV"}</span> : "") },
    { id: "buyer", header: "Buyer", value: (r) => userName(r.buyer), filterable: true },
    { id: "planner", header: "Planner", value: (r) => userName(r.planner), filterable: true },
    { id: "steward", header: "Steward", value: (r) => userName(r.steward), filterable: true },
    { id: "legacy", header: "Legacy code", value: (r) => r.legacy ?? "", mono: true },
  ]
  const ownsAny = rows.some((r) => r.steward === me || r.buyer === me || r.planner === me)
  const pillDef = PILLS.find((p) => p.id === pill)
  const visible = st.empty ? [] : rows.filter((r) => (!pillDef || pillDef.test(s, r)) && (!mine || r.steward === me || r.buyer === me || r.planner === me) && (plant === "all" || plantsOf(r.id).some((p) => p.plantId === plant)))
  const applyBulk = (fn: (id: string) => { ok: boolean; error?: string }) => {
    const res = selected.map((id) => ({ id, r: fn(id) }))
    const bad = res.filter((x) => !x.r.ok)
    if (bad.length) return `${bad.length} of ${res.length} not changed. ${bad[0].id}: ${bad[0].r.error}`
    toast.success(`${res.length} material(s) updated`)
    setSelected([])
    return null
  }
  return (
    <>
      <ListPage
        header={{
          screenId: "MM-MAT-001",
          title: "Materials",
          description: "Every material across the nine types. A new material always starts as a material creation request (C-47): the number is reserved in Draft and the views are completed by their owners.",
          primary: (
            <Button asChild>
              <Link to="/materials/creation-requests?new=1">
                <Plus aria-hidden="true" /> New material request
              </Link>
            </Button>
          ),
          actions: (
            <Button variant="outline" onClick={() => exportCsv(visible)}>
              <Download aria-hidden="true" /> Export
            </Button>
          ),
        }}
        above={
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <ul className="flex flex-wrap gap-2 text-xs" aria-label="Quick stats">
                {PILLS.map((p) => (
                  <li key={p.id}>
                    <Button size="sm" variant={pill === p.id ? "secondary" : "outline"} className="h-7 rounded-full" aria-pressed={pill === p.id} onClick={() => setPill(pill === p.id ? null : p.id)}>
                      {p.label} {rows.filter((r) => p.test(s, r)).length}
                    </Button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant={mine ? "secondary" : "ghost"} aria-pressed={mine} disabled={!ownsAny} title={ownsAny ? undefined : `${role}: you own no material as steward, buyer or planner`} onClick={() => setMine(!mine)}>
                My Materials
              </Button>
              <Reading id="RD-MM-24" />
              <div className="flex items-center gap-2">
                <Label htmlFor="ml-plant" className="text-xs">Plant</Label>
                <Select value={plant} onValueChange={setPlant}>
                  <SelectTrigger id="ml-plant" size="sm" className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plants</SelectItem>
                    {plantIds.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selected.length > 0 && (
              <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm">
                <span className="font-medium">{selected.length} selected</span>
                <Button size="sm" variant="outline" onClick={() => setDlg("owner")}>
                  Assign Buyer / Planner / Steward
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDlg("block")}>
                  Set block
                </Button>
                <Button size="sm" variant="outline" onClick={() => nav(`/materials/change-requests?materials=${selected.join(",")}`)}>
                  Add to change request
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </div>
            )}
          </div>
        }
        table={{
          rows: visible,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => R.material(r.id),
          selectable: true,
          selected,
          onSelectedChange: setSelected,
          searchText: (r) => `${r.id} ${r.description} ${r.group} ${r.type} ${r.legacy ?? ""}`,
          searchPlaceholder: "Search number, description, group, legacy code",
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          empty: { title: "No materials yet", body: "Materials appear here once a creation request reserves their number." },
          toolbar: st.toolbar,
          initialSort: { id: "id", dir: "asc" },
        }}
      />
      <DialogShell
        open={dlg === "owner"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Assign ${OWNER_FIELDS[ownerField].toLowerCase()} to ${selected.length} material(s)`}
        consequence={`Writes the ${OWNER_FIELDS[ownerField].toLowerCase()} field (Class 1, General view, owned by the Material steward) on each selected material and logs it in the change history.`}
        confirmLabel={`Assign ${OWNER_FIELDS[ownerField].toLowerCase()}`}
        onConfirm={() => applyBulk((id) => saveClass1(id, ownerField, owner))}
      >
        <Label htmlFor="bulk-field">Owner field</Label>
        <Select value={ownerField} onValueChange={(v) => (setOwnerField(v as OwnerField), setOwner(""))}>
          <SelectTrigger id="bulk-field">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(OWNER_FIELDS) as OwnerField[]).map((k) => (
              <SelectItem key={k} value={k}>
                {OWNER_FIELDS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor="bulk-owner">{OWNER_FIELDS[ownerField]}</Label>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger id="bulk-owner">
            <SelectValue placeholder="Choose a user" />
          </SelectTrigger>
          <SelectContent>
            {USERS.filter((u) =>
              ownerField === "stewardId" ? u.roles.includes("Material steward") || u.roles.includes("Materials Manager") : ownerField === "buyerId" ? u.roles.includes("Buyer") || u.roles.includes("Purchasing Manager") : u.roles.includes("Planner") || u.roles.includes("Planning Manager"),
            ).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.roles[0]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogShell>
      <DialogShell
        open={dlg === "block"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Set a block on ${selected.length} material(s)`}
        consequence={`${block} stops: ${BLOCK_SETTER[block].blocks}. Set by the ${BLOCK_SETTER[block].role}.`}
        requireReason
        confirmLabel="Set block"
        onConfirm={(reason) => applyBulk((id) => setBlock(id, block, reason))}
      >
        <Label htmlFor="bulk-block">Block</Label>
        <Select value={block} onValueChange={(v) => setBlk(v as MaterialBlock)}>
          <SelectTrigger id="bulk-block">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BLOCK_SETTER) as MaterialBlock[]).map((b) => (
              <SelectItem key={b} value={b}>
                {b} (set by {BLOCK_SETTER[b].role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogShell>
      <RulesPanel
        rules={[
          ["C-47", "A material is created only through an MCR; there is no create-material form.", "[DOC:p.245; Book II §4.2]"],
          ["S-42", "Lifecycle Draft, Data Completion, Active, Restricted, Blocked, Obsolete; function-specific blocks are chips beside the badge.", "[Book II §4.1, §4.5]"],
          ["§4.5", "Each block is set by its named role: Purchasing Manager, Sales Director, Engineering Manager, Quality Manager, Controller.", "[Book II §4.5]"],
          ["V-MM-01", "Active requires every mandatory-for-use field of the applicable views; completeness below 100% on an Active material is shown in red.", "[Book II §16.4]"],
          ["§14.1", "On hand counts PE-owned stock; consignment is vendor-owned and excluded from the value.", "[Book II §14.1]"],
        ]}
      />
    </>
  )
}

