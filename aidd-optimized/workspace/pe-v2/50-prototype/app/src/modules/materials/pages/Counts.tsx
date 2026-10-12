// INV-COUNT-DOC Count documents: INV-COUNT-DOC-001 (listing) and INV-COUNT-DOC-002 (detail) at
// /inventory/counting/count-documents, List + detail + mobile entry [DOC:p.36 §7; Book VII p.280]
// (asserted). Counters restricted, supervisor reconciles, Finance approves bands. Rules from Book I
// Part A §7: Generate Count Sheets on a count plan (§7.1), S-40 lifecycle and inventory freeze
// E-CNT-01 (§7.2), role access (§7.3), reconciliation incl. third count R-CNT-03, unlisted batches,
// serial lists and zero-count confirmation (§7.4), tolerance and approval ladder (§7.5), one stock
// adjustment per document and the plan write-back (§7.6). Count entry at SP-20. FL-06.
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, Chip, EmptyState, KV, RulesPanel, ScanField, StatusBadge, type Column } from "@/components/patterns"
import type { Role, UserId } from "@/data/domain"
import { USERS, WAREHOUSES } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCore, useRole, useSlice } from "@/store"
import { COUNT_RULES, countLadder, docVariance, lineVariance, planState, serialRecon } from "../lib/rules"
import { getMaterial, R, type MaterialsState } from "../data/state"
import {
  abcOf,
  addUnlistedBatch,
  assignCounter,
  confirmEmpty,
  confirmUnlisted,
  counterMaySee,
  enterCount,
  enterThirdCount,
  finishRecount,
  forceRecount,
  generateCountSheets,
  postCount,
  reassignCounter,
  rejectCountLines,
  routeCount,
  scanSerial,
  startCounting,
  submitCount,
  voidCount,
} from "../data/actions"
import type { CountDocRecord, CountLine } from "../data/types"
import { MatLink, Reading, Section, TextPostingPreview, userName, useListState } from "../components/common"
import { confirmRun, run } from "../components/run"

type Row = CountDocRecord & { net: number; abs: number; counted: number }
const COUNTER_USERS = USERS.filter((u) => u.roles.includes("Warehouse operator") || u.roles.includes("Warehouse supervisor"))
const FINANCE_USERS = USERS.filter((u) => u.roles.some((r) => r === "Controller" || r === "Cost accountant" || r === "CFO"))
/** §7.3: only the counter role is restricted; the supervisor and finance see expected and variances. */
const isCounter = (role: Role) => role === "Warehouse operator"

function CounterSelect({ value, onChange, exclude, label }: { value: string; onChange: (v: string) => void; exclude?: string[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {COUNTER_USERS.filter((u) => !exclude?.includes(u.id)).map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name} ({u.roles[0]})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CountList() {
  const s = useSlice("materials")
  const [role] = useRole()
  const userId = useCore().userId
  const st = useListState("INV-COUNT-DOC")
  const [gen, setGen] = useState(false)
  const [wh, setWh] = useState<string>("WH-TBD-02")
  const [blind, setBlind] = useState(true)
  const [soft, setSoft] = useState(true)
  const counter = isCounter(role)
  const docs = s.countDocuments.filter((c) => counterMaySee(c, role, userId))
  const rows = useMemo<Row[]>(() => docs.map((c) => { const v = docVariance(c); return { ...c, net: v.net, abs: v.abs, counted: c.lines.filter((l) => l.count != null).length } }), [docs])
  const plans = [...new Set(s.countDocuments.map((c) => c.planId))].sort().reverse()
  const cols: Column<Row>[] = [
    { id: "id", header: "Count document", value: (r) => r.id, mono: true, sortable: true },
    { id: "plan", header: "Count plan", value: (r) => r.planId, filterable: true },
    { id: "loc", header: "Location", value: (r) => r.location },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="countDocument" status={r.status} size="sm" /> },
    { id: "lines", header: "Lines counted", value: (r) => r.counted, align: "right", mono: true, cell: (r) => `${r.counted} / ${r.lines.length}` },
    { id: "counter", header: "Counter", value: (r) => r.counterIds.map(userName).join(", ") },
    // §7.3: the counter role never sees variance columns
    ...(counter ? [] : [{ id: "net", header: "Net variance", value: (r: Row) => r.net, align: "right" as const, mono: true, sortable: true, cell: (r: Row) => (r.counted ? fmtMoney(r.net) : "") }]),
    { id: "snap", header: "Snapshot", value: (r) => r.snapshotAt, sortable: true, cell: (r) => fmtDate(r.snapshotAt) },
    { id: "posted", header: "Adjustment", value: (r) => r.adjustmentRef ?? "", mono: true },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "INV-COUNT-DOC",
          title: "Count documents",
          description: counter
            ? "INV-COUNT-DOC-001. Your count documents in Counting or Recount. Expected quantities stay hidden on blind plans."
            : "INV-COUNT-DOC-001. Count documents generated from count plans: blind entry, recount by a different counter beyond tolerance, approval per the value bands, then one stock adjustment per document.",
          chips: counter ? <Reading id="RD-MM-25" /> : undefined,
          primary: role === "Warehouse supervisor" ? <Button onClick={() => setGen(true)}>Generate count sheets</Button> : undefined,
        }}
        above={
          counter ? undefined : (
            <Section title="Count plans">
              <ul className="flex flex-wrap gap-2 text-sm">
                {plans.map((p) => {
                  const ps = planState(s.countDocuments, p)
                  return (
                    <li key={p} className="rounded-md border px-3 py-1">
                      <span className="font-mono">{p}</span>: {ps.done} of {ps.total} documents Posted or Void · {ps.posted ? <StatusBadge kind="countDocument" status="Posted" size="sm" /> : "plan open"}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )
        }
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => R.count(r.id),
          searchText: (r) => `${r.id} ${r.location} ${r.lines.map((l) => l.itemId).join(" ")}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          empty: { title: counter ? "No count assigned to you" : "No count documents", body: counter ? "Documents appear here when the supervisor assigns you and counting is open." : "Documents appear when a count plan generates them." },
          initialSort: { id: "id", dir: "desc" },
        }}
      />
      <CountRules />
      <DialogShell
        open={gen}
        onOpenChange={setGen}
        title="Generate count sheets"
        consequence={`Creates a new count plan for ${wh} with one Generated document per zone. Expected quantities are frozen at the snapshot and the bins are frozen for movements (E-CNT-01) until the documents are approved${soft ? "; with Soft Freeze ON movements post and flag the line Moved During Count" : ""}.`}
        confirmLabel="Generate"
        onConfirm={() => confirmRun(generateCountSheets({ warehouseId: wh, blind, softFreeze: soft }), (r) => `${r.planId}: ${r.ids.length} document(s) generated${r.skipped ? `; ${r.skipped} bin row(s) already under count skipped` : ""}`)}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="gen-wh">Warehouse</Label>
            <Select value={wh} onValueChange={setWh}>
              <SelectTrigger id="gen-wh">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSES.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={blind} onCheckedChange={(x) => setBlind(!!x)} /> Blind count (counters never see expected quantities)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={soft} onCheckedChange={(x) => setSoft(!!x)} /> Soft Freeze (movements post and flag Moved During Count instead of being blocked)
          </label>
          <p className="text-xs text-muted-foreground">
            One document per zone. <Reading id="RD-MM-26" />
          </p>
        </div>
      </DialogShell>
    </>
  )
}

function CountRules() {
  return (
    <RulesPanel
      rules={[
        ["S-40", "Generated, Assigned, Counting, Submitted, Recount, Variance Review, Approved, Posted, Void; Void only before counting.", "[DOC:p.36 §7.2]"],
        ["E-CNT-01", "While a document over a location is Generated through Variance Review, movements on it are blocked; with Soft Freeze ON they post and flag the line Moved During Count, which forces a recount.", "[DOC:p.36 §7.2 Dev Note]"],
        ["§7.3", "Counters see only their documents in Counting or Recount, never Expected Qty on a blind plan and never variance columns; the supervisor sees both.", "[DOC:pp.36-37 §7.3]"],
        ["§7.5", `Lines beyond ±${COUNT_RULES.recountPct}% or ±$${COUNT_RULES.recountAmount} auto-flag Recount Required; a zero against non-zero expected needs Confirm Empty Location.`, "[DOC:p.37 §7.4-7.5]"],
        ["R-CNT-02 / R-CNT-03", "The recount is done by a different counter, blind to the first count; a recount that differs again beyond threshold forces a third count with supervisor and finance present, and the third count is final.", "[DOC:pp.36-37 §7.2, §7.4]"],
        ["§7.5", `Supervisor alone up to $${COUNT_RULES.supervisorLine.toLocaleString()} per line and $${COUNT_RULES.supervisorDoc.toLocaleString()} per document; above that or on any class-A variance, Supervisor then Finance Manager; document net variance above $${COUNT_RULES.controllerDoc.toLocaleString()} adds the Controller. ABC tolerances A 0.5% / B 2% / C 5% auto-approve.`, "[DOC:p.37 §7.5]"],
        ["§7.6", "Post creates one stock adjustment per document; the plan reaches Posted when all its documents are Posted or Void.", "[DOC:pp.37-38 §7.6]"],
        ["RD-MM-14 / RD-MM-15 / RD-MM-19 / RD-MM-25", "Engine stand-ins for the Finance Manager and Controller steps, counter roles, third-count entry and counter visibility are readings.", "README Readings"],
      ]}
    />
  )
}

/** The PRD ladder (§7.5) and the request sent to the shared engine (RD-MM-14). */
function ladderFor(s: MaterialsState, c: CountDocRecord) {
  const lad = countLadder(c, (id) => abcOf(s, id))
  // the engine adds its second step when a line is above the supervisor band; a class-A variance is
  // passed as such so the Finance step is not lost (request R-8)
  const lineAmount = lad.band === "Supervisor" ? lad.maxLine : Math.max(lad.maxLine, COUNT_RULES.supervisorLine + 0.01)
  return { lad, amount: Math.round(lad.abs * 100) / 100, lineAmount: Math.round(lineAmount * 100) / 100 }
}

export function CountDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const [role] = useRole()
  const userId = useCore().userId
  const c = s.countDocuments.find((x) => x.id === id)
  const [active, setActive] = useState<number | null>(null)
  const [qty, setQty] = useState("")
  const [counter, setCounter] = useState<string>("USR-TBD-018")
  const [recounter, setRecounter] = useState<string>("")
  const [witness, setWitness] = useState<string>(FINANCE_USERS[0]?.id ?? "")
  const [dlg, setDlg] = useState<null | "void" | "reject" | "post" | "force" | "reassign" | "unlisted" | "third">(null)
  const [pick, setPick] = useState<number[]>([])
  const [ub, setUb] = useState({ bin: "", itemId: "", batch: "", qty: "" })
  if (!c)
    return (
      <EmptyState title={`Count document ${id} not found`}>
        <Link to={R.counts} className="text-link underline">
          Back to count documents
        </Link>
      </EmptyState>
    )
  const counterRole = isCounter(role)
  if (!counterMaySee(c, role, userId))
    return (
      <EmptyState title={`${c.id} is not open to you`}>
        Counters see only documents assigned to them while they are in Counting or Recount (§7.3). <Reading id="RD-MM-25" />{" "}
        <Link to={R.counts} className="text-link underline">
          Back to your count documents
        </Link>
      </EmptyState>
    )
  const v = docVariance(c)
  const { lad, amount, lineAmount } = ladderFor(s, c)
  const entry = c.status === "Counting" || c.status === "Recount"
  // §7.3: expected hidden from the counter on blind plans (data withheld, not styled away); variances never
  const hideExpected = counterRole && c.blind
  const hideVariance = counterRole
  const flagged = (l: CountLine) => l.flags.includes("Recount Required")
  const linesForEntry = c.status === "Recount" ? c.lines.filter(flagged) : c.lines
  const activeLine = c.lines.find((l) => l.no === active)
  const unconfirmed = c.lines.filter((l) => l.flags.includes("Unlisted Batch") && !l.unlistedConfirmed)
  const thirdOpen = c.lines.filter((l) => l.flags.includes("Third Count Required") && l.thirdCount == null)
  const supervisor = role === "Warehouse supervisor"
  const save = () => {
    if (!activeLine) return
    if (run(enterCount(c.id, activeLine.no, Number(qty)), `Line ${activeLine.no}: ${qty} ${activeLine.uom}`)) {
      setQty("")
      const nextLine = linesForEntry.find((l) => l.no !== activeLine.no && (c.status === "Recount" ? l.recount == null : l.count == null))
      setActive(nextLine?.no ?? null)
    }
  }
  const shortage = v.lines.filter((x) => x.value < 0).reduce((a, x) => a - x.value, 0)
  const surplus = v.lines.filter((x) => x.value > 0).reduce((a, x) => a + x.value, 0)
  const posting = (
    <TextPostingPreview
      title="Stock adjustment on post"
      lines={[
        ...(shortage ? [{ transaction: "Count adjustment, shortage", debit: "5310 Inventory adjustment (ADJ)", credit: "13xx Inventory (STOCK)", amount: Math.round(shortage * 100) / 100 }] : []),
        ...(surplus ? [{ transaction: "Count adjustment, surplus", debit: "13xx Inventory (STOCK)", credit: "5310 Inventory adjustment (ADJ)", amount: Math.round(surplus * 100) / 100 }] : []),
      ]}
      note="One adjustment per document (§7.6); accounts resolve through MM-VAL-001 keys STOCK and ADJ; cost center from the warehouse, profit center from the item product line."
    />
  )
  const primary =
    c.status === "Generated" ? (
      <Button onClick={() => run(assignCounter(c.id, counter as UserId), `Assigned to ${userName(counter)}`)}>Assign counter</Button>
    ) : c.status === "Assigned" ? (
      <Button onClick={() => run(startCounting(c.id), "Counting started")}>Start counting</Button>
    ) : c.status === "Counting" ? (
      <Button onClick={() => run(submitCount(c.id), "Submitted")}>Submit count</Button>
    ) : c.status === "Submitted" && supervisor ? (
      <Button onClick={() => run(routeCount(c.id, (recounter || undefined) as UserId | undefined), "Routed")}>Reconcile and route</Button>
    ) : c.status === "Recount" ? (
      thirdOpen.length && supervisor ? (
        <Button onClick={() => (setActive(thirdOpen[0].no), setQty(""), setDlg("third"))}>Enter third count</Button>
      ) : (
        <Button onClick={() => run(finishRecount(c.id), (r) => (r.third.length ? `Third count required on line ${r.third.join(", ")} (R-CNT-03)` : "Recount finished"))}>Finish recount</Button>
      )
    ) : c.status === "Variance Review" && !counterRole ? (
      <ApprovalButton
        kind="Count variance"
        subject={{ type: "material", id: c.id }}
        title={`${c.id} ${c.location}: ${lad.band} band, net ${fmtMoney(v.net)}, absolute ${fmtMoney(lad.abs)}`}
        amount={amount}
        ctx={{ lineAmount }}
        label="Approve variances"
        variant="default"
        disabled={unconfirmed.length > 0}
        disabledReason={`Confirm the unlisted batch line(s) ${unconfirmed.map((l) => l.no).join(", ")} first`}
        stay
      />
    ) : c.status === "Approved" && supervisor ? (
      <Button onClick={() => setDlg("post")}>Post adjustment</Button>
    ) : undefined

  const serialLines = c.lines.filter((l) => l.expectedSerials)
  return (
    <>
      <DetailPage
        header={{
          screenId: "INV-COUNT-DOC",
          title: `${c.id} ${c.zone}`,
          description: "INV-COUNT-DOC-002",
          crumbs: [{ label: "Count documents", to: R.counts }, { label: c.id }],
          chips: (
            <>
              {c.blind && <Chip kind="design" note="Counters never see expected quantities on this plan (§7.3)">Blind count</Chip>}
              <Chip kind="flag" note={c.softFreeze ? "Movements on these bins post and flag the line Moved During Count" : "Movements on these bins are blocked with E-CNT-01 until the document leaves Variance Review"}>
                {c.softFreeze ? "Soft freeze" : "Hard freeze"}
              </Chip>
            </>
          ),
          primary,
          actions: supervisor ? (
            <>
              {c.status === "Generated" && (
                <>
                  <CounterSelect value={counter} onChange={setCounter} label="Counter" />
                  <Button variant="outline" onClick={() => setDlg("void")}>
                    Void
                  </Button>
                </>
              )}
              {c.status === "Submitted" && c.lines.some((l) => flagged(l) && l.recount == null) && <CounterSelect value={recounter} onChange={setRecounter} exclude={c.counterIds} label="Recounter (R-CNT-02)" />}
              {(c.status === "Assigned" || c.status === "Counting" || c.status === "Recount") && (
                <Button variant="outline" onClick={() => (setRecounter(""), setDlg("reassign"))}>
                  {c.status === "Recount" ? "Assign recounter" : "Reassign counter"}
                </Button>
              )}
              {(c.status === "Submitted" || c.status === "Variance Review") && (
                <Button variant="outline" onClick={() => (setPick([]), setRecounter(""), setDlg("force"))}>
                  Force recount
                </Button>
              )}
              {c.status === "Variance Review" && (
                <Button variant="outline" onClick={() => (setPick([]), setDlg("reject"))}>
                  Reject lines
                </Button>
              )}
            </>
          ) : undefined,
        }}
        status={{ kind: "countDocument", value: c.status }}
        summary={
          <>
            <KV k="Count plan">{c.planId}</KV>
            <KV k="Location">{c.location}</KV>
            <KV k="Counter">{c.counterIds.map(userName).join(", ") || "Not assigned"}</KV>
            {(c.status === "Recount" || c.recounterId) && <KV k="Recounter">{userName(c.recounterId)}</KV>}
            <KV k="Snapshot">{fmtDate(c.snapshotAt)}</KV>
            {!hideVariance && (
              <>
                <KV k="Net variance">{fmtMoney(v.net)}</KV>
                <KV k="Absolute variance">{fmtMoney(v.abs)}</KV>
                <KV k="Largest line">{fmtMoney(v.maxLine)}</KV>
              </>
            )}
            <KV k="Adjustment">{c.adjustmentRef ? `${c.adjustmentRef} on ${fmtDate(c.postedOn)}` : c.voidReason ? `Void: ${c.voidReason}` : "Not posted"}</KV>
          </>
        }
        tabs={[
          {
            id: "lines",
            label: entry ? (c.status === "Recount" ? "Recount entry" : "Count entry") : "Lines",
            count: c.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {entry && (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <ScanField
                      scanPoint="SP-20"
                      label="Count entry"
                      expected={activeLine ? (activeLine.expectedSerials ? `Scan the serials on line ${activeLine.no}, or scan the next bin` : `Enter the quantity for line ${activeLine.no}, or scan the next bin`) : "Scan the bin or the item / batch label"}
                      onScan={(code) => {
                        const k = code.trim().toUpperCase()
                        if (activeLine?.expectedSerials && k.startsWith("SN-")) {
                          const r = scanSerial(c.id, activeLine.no, k)
                          return r.ok ? { ok: true, message: `${k} scanned on line ${activeLine.no}` } : { ok: false, message: r.error, expected: "a serial not yet scanned on this line", next: "Scan the next serial or the next bin" }
                        }
                        const l = linesForEntry.find((x) => x.bin.toUpperCase() === k || x.itemId.toUpperCase() === k || (x.batch ?? "").toUpperCase() === k)
                        if (!l)
                          return {
                            ok: false,
                            expected: `a bin or item on ${c.id}${c.status === "Recount" ? " flagged Recount Required" : ""}: ${linesForEntry.map((x) => x.bin).join(", ")}`,
                            next: "Scan a bin from this document, or record an unlisted batch",
                            message: `${code} is not on this count document`,
                          }
                        setActive(l.no)
                        setQty("")
                        return { ok: true, message: `Line ${l.no}: ${l.bin} ${l.itemId}${l.batch ? ` batch ${l.batch}` : ""}` }
                      }}
                    />
                    {activeLine && !activeLine.flags.includes("Third Count Required") && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cnt-qty">
                            Line {activeLine.no} {activeLine.itemId} ({activeLine.uom})
                          </Label>
                          <Input id="cnt-qty" inputMode="decimal" className="h-12 w-48 text-base" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
                        </div>
                        <Button className="h-12" disabled={qty === ""} onClick={save}>
                          Save {c.status === "Recount" ? "recount" : "count"}
                        </Button>
                        {c.status === "Counting" && (
                          <Button variant="outline" className="h-12" onClick={() => run(confirmEmpty(c.id, activeLine.no), `Line ${activeLine.no}: empty location confirmed`)}>
                            Confirm Empty Location
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => (setUb({ bin: activeLine?.bin ?? "", itemId: activeLine?.itemId ?? "", batch: "", qty: "" }), setDlg("unlisted"))}>
                        Record unlisted batch
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Acting as {role}. {c.status === "Recount" ? "The recount is entered by the assigned recounter, never the first counter (R-CNT-02)." : "Counting is open to the assigned counter."} <Reading id="RD-MM-15" />
                      </p>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead>Item / batch</TableHead>
                      {!hideExpected && <TableHead className="text-right">Expected</TableHead>}
                      {!hideExpected && <TableHead className="text-right">Interim movements</TableHead>}
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Recount</TableHead>
                      <TableHead className="text-right">Third count</TableHead>
                      {!hideVariance && <TableHead className="text-right">Variance</TableHead>}
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.lines.map((l) => {
                      const lv = lineVariance(l)
                      return (
                        <TableRow key={l.no} className={cn("h-8 text-[13px]", active === l.no && "bg-muted")} onClick={() => entry && linesForEntry.includes(l) && (setActive(l.no), setQty(""))}>
                          <TableCell>{l.no}</TableCell>
                          <TableCell className="font-mono">{l.bin}</TableCell>
                          <TableCell>
                            <MatLink id={l.itemId} /> <span className="text-xs text-muted-foreground">{getMaterial(s, l.itemId)?.description}</span>
                            {l.batch && <div className="font-mono text-xs">{l.batch}</div>}
                            {!counterRole && <span className="text-xs text-muted-foreground"> ABC {abcOf(s, l.itemId)}</span>}
                          </TableCell>
                          {!hideExpected && <TableCell className="tabular text-right">{`${fmtNumber(l.expected)} ${l.uom}`}</TableCell>}
                          {!hideExpected && <TableCell className="tabular text-right">{l.interim ? fmtNumber(l.interim) : ""}</TableCell>}
                          {/* the recounter is blind to the first count (§7.2) */}
                          <TableCell className="tabular text-right">{c.status === "Recount" && counterRole ? (l.count != null ? "Hidden" : "") : l.count != null ? fmtNumber(l.count) : ""}</TableCell>
                          <TableCell className="tabular text-right">{l.recount != null ? fmtNumber(l.recount) : ""}</TableCell>
                          <TableCell className="tabular text-right">{l.thirdCount != null ? `${fmtNumber(l.thirdCount)} (${userName(l.thirdWitness)})` : ""}</TableCell>
                          {!hideVariance && <TableCell className={cn("tabular text-right", lv.counted && lv.qty !== 0 && "font-semibold")}>{!lv.counted ? "" : `${lv.qty > 0 ? "+" : ""}${fmtNumber(lv.qty, 2)} · ${fmtMoney(lv.value)}`}</TableCell>}
                          <TableCell>
                            <span className="flex flex-wrap items-center gap-1">
                              {l.flags.map((f) => (
                                <Chip key={f} kind={f === "Auto-Approved" ? "design" : "flag"}>
                                  {f}
                                </Chip>
                              ))}
                              {l.confirmedEmpty && <Chip kind="design">Confirmed empty</Chip>}
                              {l.flags.includes("Unlisted Batch") &&
                                (l.unlistedConfirmed ? (
                                  <span className="text-xs">Supervisor confirmed</span>
                                ) : supervisor ? (
                                  <Button size="sm" variant="outline" className="h-6 px-2" onClick={(e) => (e.stopPropagation(), run(confirmUnlisted(c.id, l.no), `Line ${l.no} confirmed; batch record correction raised`))}>
                                    Confirm batch
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Waits for the supervisor</span>
                                ))}
                              {l.lineDecision && <span className="text-xs">{l.lineDecision}</span>}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {serialLines.length > 0 && (
                  <Section title="Serial reconciliation (§7.4)">
                    <ul className="flex flex-col gap-1 text-sm">
                      {serialLines.map((l) => {
                        const r = serialRecon(l)!
                        return (
                          <li key={l.no}>
                            Line {l.no} {l.itemId}: scanned {(l.scannedSerials ?? []).length}
                            {!hideExpected && ` of ${l.expectedSerials!.length}`}.{" "}
                            {!hideVariance && (
                              <>
                                Missing: {r.missing.length ? <span className="font-mono">{r.missing.join(", ")}</span> : "none"}. Found but unexpected: {r.unexpected.length ? <span className="font-mono">{r.unexpected.join(", ")}</span> : "none"}.
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </Section>
                )}
                {!hideVariance && (c.status === "Variance Review" || c.status === "Approved" || c.status === "Posted") && posting}
                {!hideVariance && c.status === "Variance Review" && (
                  <Section title={`Approval ladder: ${lad.band} band`}>
                    <p className="text-sm">
                      PRD steps: {lad.steps.join(" then ")}. {lad.why.length ? `Because of ${lad.why.join("; ")}.` : "Within the supervisor band."} Lines auto-approved within the ABC tolerance are outside the ladder.
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      The shared engine routes Warehouse supervisor{lad.band === "Supervisor" ? "" : " then Controller (standing in for the Finance Manager" + (lad.band === "Controller" ? " and the third approval" : "") + ")"}. <Reading id="RD-MM-14" />
                    </p>
                  </Section>
                )}
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <ul className="text-sm">
                {c.activity.map((a, i) => (
                  <li key={i}>
                    {fmtDate(a.at)} · {a.by} · {a.text}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
        doc={c.lines[0] ? { type: "material", id: c.lines[0].itemId } : undefined}
      />
      <CountRules />
      <DialogShell
        open={dlg === "void"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Void ${c.id}`}
        consequence={`${c.id} ends as Void before counting; the zone's bins are released from the freeze and nothing posts.`}
        requireReason
        destructive
        confirmLabel="Void document"
        onConfirm={(reason) => confirmRun(voidCount(c.id, reason), `${c.id} void`)}
      />
      <DialogShell
        open={dlg === "reassign"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={c.status === "Recount" ? `Assign the recounter on ${c.id}` : `Reassign the counter on ${c.id}`}
        consequence={c.status === "Recount" ? "The recounter must differ from the first counter (R-CNT-02); mobile entry opens for that user only." : "Entry moves to the new counter; counts already entered stay."}
        confirmLabel="Assign"
        onConfirm={() => confirmRun(reassignCounter(c.id, recounter as UserId), `Assigned to ${userName(recounter)}`)}
      >
        <CounterSelect value={recounter} onChange={setRecounter} exclude={c.counterIds} label="Counter" />
      </DialogShell>
      <DialogShell
        open={dlg === "force"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Force a recount on ${c.id}`}
        consequence="The chosen lines are recounted by a different counter, blind to the first count; the document moves to Recount."
        requireReason
        confirmLabel="Force recount"
        onConfirm={(reason) => confirmRun(forceRecount(c.id, pick, recounter as UserId, reason), "Sent to Recount")}
      >
        <LinePicker lines={c.lines} pick={pick} setPick={setPick} />
        <CounterSelect value={recounter} onChange={setRecounter} exclude={c.counterIds} label="Recounter (R-CNT-02)" />
      </DialogShell>
      <DialogShell
        open={dlg === "reject"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Reject lines on ${c.id}`}
        consequence="Rejected lines are cleared and the document returns to Counting for a fresh count."
        requireReason
        confirmLabel="Reject lines"
        onConfirm={(reason) => confirmRun(rejectCountLines(c.id, pick, reason), "Lines reopened for counting")}
      >
        <LinePicker lines={c.lines} pick={pick} setPick={setPick} />
      </DialogShell>
      <DialogShell
        open={dlg === "third"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Third count on ${c.id} (R-CNT-03)`}
        consequence="The third count is final for the line. It is entered by the supervisor with a finance witness present and named."
        confirmLabel="Save third count"
        onConfirm={() => confirmRun(enterThirdCount(c.id, active ?? 0, Number(qty), witness as UserId), `Third count saved on line ${active}`)}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="tc-line">Line</Label>
            <Select value={String(active ?? "")} onValueChange={(x) => setActive(Number(x))}>
              <SelectTrigger id="tc-line">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {thirdOpen.map((l) => (
                  <SelectItem key={l.no} value={String(l.no)}>
                    Line {l.no} {l.bin} {l.itemId}: count {l.count}, recount {l.recount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tc-qty">Third count</Label>
            <Input id="tc-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="tc-w">Finance witness</Label>
            <Select value={witness} onValueChange={setWitness}>
              <SelectTrigger id="tc-w">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCE_USERS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.roles[0]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Reading id="RD-MM-19" />
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "unlisted"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Record an unlisted batch on ${c.id}`}
        consequence="Adds an Unlisted Batch line with expected 0. The supervisor confirms it before approval, which raises the batch record correction (§7.4)."
        confirmLabel="Add line"
        onConfirm={() => confirmRun(addUnlistedBatch(c.id, { bin: ub.bin, itemId: ub.itemId.trim().toUpperCase(), batch: ub.batch, qty: Number(ub.qty) }), "Unlisted batch line added")}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["bin", "Bin"],
              ["itemId", "Material"],
              ["batch", "Batch found"],
              ["qty", "Quantity"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`ub-${k}`}>{l}</Label>
              <Input id={`ub-${k}`} value={ub[k]} inputMode={k === "qty" ? "decimal" : undefined} onChange={(e) => setUb({ ...ub, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "post"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Post ${c.id}`}
        consequence={`Posts one stock adjustment for ${c.id}: net ${fmtMoney(v.net)}. The document becomes Posted (terminal); the plan reaches Posted when all its documents are Posted or Void.`}
        confirmLabel="Post adjustment"
        wide
        onConfirm={() => confirmRun(postCount(c.id), `${c.id} posted`)}
      >
        {posting}
      </DialogShell>
    </>
  )
}

function LinePicker({ lines, pick, setPick }: { lines: CountLine[]; pick: number[]; setPick: (x: number[]) => void }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {lines.map((l) => (
        <li key={l.no}>
          <label className="flex items-center gap-2">
            <Checkbox checked={pick.includes(l.no)} onCheckedChange={(x) => setPick(x ? [...pick, l.no] : pick.filter((n) => n !== l.no))} />
            Line {l.no} {l.bin} {l.itemId} · {fmtMoney(lineVariance(l).value)}
          </label>
        </li>
      ))}
    </ul>
  )
}
