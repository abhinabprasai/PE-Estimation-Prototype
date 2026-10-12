// MM-VAL-001 Account Determination Workbench [DOC:p.247] (asserted); rules Book II §5.2, §5.3.
// Matrix grid by event key and valuation class, version diff, simulation panel with full journal
// preview, completeness check (E-MM-21). Actions: Draft rows, Mark, Release with effective date
// (Controller, step-up MFA), Simulate. Released rows are never edited in place (C-50).
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, DataTable, EmptyState, RulesPanel, type Column } from "@/components/patterns"
import { TODAY, WAREHOUSES } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { EVENT_KEYS, SIM_TRANSACTIONS, VALUATION_CLASS_LABEL, isValuated, matrixGaps, simulate } from "../lib/rules"
import { allMaterials, getMaterial, rateOf } from "../data/state"
import { addDraftRow, candidateRows, classesInUse, discardDraftRow, liveRows, markRows, releaseMatrix, scheduledRows } from "../data/actions"
import type { AcctRow } from "../data/types"
import { Reading, Section, userName, useListState } from "../components/common"
import { confirmRun, run } from "../components/run"

const SECTIONS = [
  { id: "matrix", label: "Matrix" },
  { id: "drafts", label: "Draft and marked rows" },
  { id: "diff", label: "Version diff" },
  { id: "simulate", label: "Simulation" },
  { id: "check", label: "Completeness check" },
  { id: "history", label: "History" },
]

export function AccountDetermination() {
  const s = useSlice("materials")
  const st = useListState("MM-VAL-001")
  const [section, setSection] = useState("matrix")
  const [dlg, setDlg] = useState(false)
  const [eff, setEff] = useState(TODAY)
  const [mfa, setMfa] = useState(false)
  const rows = st.empty ? [] : s.acctDetermination
  const live = liveRows(rows)
  const inUse = useMemo(() => classesInUse(s), [s])
  const gaps = matrixGaps(candidateRows(rows), inUse)
  const liveGaps = matrixGaps(live, inUse)
  const drafts = rows.filter((r) => r.state === "Draft" || r.state === "Marked")
  const version = Math.max(0, ...live.map((r) => r.version))
  const classes = [...new Set([...inUse.keys(), ...Object.keys(VALUATION_CLASS_LABEL)])].sort()

  // draft form
  const [ek, setEk] = useState("STOCK")
  const [vc, setVc] = useState("__none")
  const [q, setQ] = useState("")
  const [dr, setDr] = useState("")
  const [cr, setCr] = useState("")
  // simulation
  const [tx, setTx] = useState("grn")
  const [svc, setSvc] = useState("VC-3000")
  const [sq, setSq] = useState("")
  const [amt, setAmt] = useState("10000")
  const [basis, setBasis] = useState<"live" | "candidate">("live")
  const [simMat, setSimMat] = useState("RAW-TBD-CRGO23")
  const [simQty, setSimQty] = useState("1000")
  const [simBy, setSimBy] = useState<"qty" | "value">("qty")
  const [simDate, setSimDate] = useState(TODAY)

  const cols: Column<AcctRow>[] = [
    { id: "key", header: "Event key", value: (r) => r.eventKey, filterable: true, sortable: true, mono: true },
    { id: "vc", header: "Valuation class", value: (r) => r.valuationClass ?? "(any: key-only row)", filterable: true, sortable: true },
    { id: "q", header: "Qualifier", value: (r) => r.qualifier ?? "" },
    { id: "dr", header: "Debit", value: (r) => r.drKey },
    { id: "cr", header: "Credit", value: (r) => r.crKey },
    { id: "v", header: "Version", value: (r) => r.version, align: "right", mono: true },
    { id: "from", header: "Valid from", value: (r) => r.validFrom ?? "", cell: (r) => fmtDate(r.validFrom) },
    { id: "row", header: "Row ID", value: (r) => r.id, mono: true },
  ]
  const content = () => {
    if (st.loading || st.error || !rows.length)
      return (
        <DataTable densityKey="MM-VAL-001" rows={rows} columns={cols} rowId={(r) => r.id} loading={st.loading} error={st.error} onRetry={st.onRetry} toolbar={st.toolbar} empty={{ title: "No matrix rows", body: "Draft rows to build the first version." }} />
      )
    switch (section) {
      case "matrix":
        return (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Rows valid today: {live.length}, highest version {version}. Every journal line stores the matrix row that resolved it.
            </p>
            {scheduledRows(rows).length > 0 && (
              <p className="text-sm">
                Scheduled: {scheduledRows(rows).length} released row(s) take effect later ({[...new Set(scheduledRows(rows).map((r) => fmtDate(r.validFrom)))].join(", ")}); until then postings resolve to the rows shown here.
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Event key</TableHead>
                    {[...inUse.keys()].sort().map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {EVENT_KEYS.map((k) => (
                    <TableRow key={k.key} className="h-8 text-[13px]">
                      <TableCell className="font-mono" title={k.firesOn}>
                        {k.key}
                      </TableCell>
                      {[...inUse.keys()].sort().map((c) => {
                        const exact = live.find((r) => r.eventKey === k.key && r.valuationClass === c && !r.qualifier)
                        const any = live.find((r) => r.eventKey === k.key && !r.valuationClass && !r.qualifier)
                        const hit = exact ?? any
                        return (
                          <TableCell key={c} className={cn("text-xs", !hit && "text-destructive")}>
                            {hit ? `${hit.drKey.split(" ")[0]} / ${hit.crKey.split(" ")[0]}${exact ? "" : " (key)"}` : "Gap"}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTable densityKey="MM-VAL-001" rows={live} columns={cols} rowId={(r) => r.id} searchText={(r) => `${r.eventKey} ${r.valuationClass ?? ""} ${r.drKey} ${r.crKey}`} toolbar={st.toolbar} />
          </div>
        )
      case "drafts":
        return (
          <div className="flex flex-col gap-4">
            <Section title="Draft a row">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="d-ek">Event key</Label>
                  <Select value={ek} onValueChange={setEk}>
                    <SelectTrigger id="d-ek">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_KEYS.map((k) => (
                        <SelectItem key={k.key} value={k.key}>
                          {k.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="d-vc">Valuation class</Label>
                  <Select value={vc} onValueChange={setVc}>
                    <SelectTrigger id="d-vc">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Any (key-only)</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c} value={c}>
                          {VALUATION_CLASS_LABEL[c] ?? c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="d-q">Qualifier</Label>
                  <Input id="d-q" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="d-dr">Debit account</Label>
                  <Input id="d-dr" value={dr} onChange={(e) => setDr(e.target.value)} placeholder="e.g. 1310 Raw Materials" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="d-cr">Credit account</Label>
                  <Input id="d-cr" value={cr} onChange={(e) => setCr(e.target.value)} />
                </div>
              </div>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => run(addDraftRow({ eventKey: ek, valuationClass: vc === "__none" ? undefined : vc, qualifier: q || undefined, drKey: dr, crKey: cr }), "Draft row added") && (setDr(""), setCr(""), setQ(""))}
              >
                Draft row
              </Button>
            </Section>
            {drafts.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Key / class / qualifier</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((r) => (
                    <TableRow key={r.id} className="h-8 text-[13px]">
                      <TableCell className="font-mono">{r.id}</TableCell>
                      <TableCell>
                        {r.eventKey} / {r.valuationClass ?? "any"} / {r.qualifier ?? "none"}
                        {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                      </TableCell>
                      <TableCell>{r.drKey}</TableCell>
                      <TableCell>{r.crKey}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell>{userName(r.createdBy)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => run(discardDraftRow(r.id), "Row discarded")}>
                          Discard
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No draft rows">Draft a row above; mark, then release.</EmptyState>
            )}
          </div>
        )
      case "diff": {
        const marked = rows.filter((r) => r.state === "Marked" || r.state === "Draft")
        return marked.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Key / class / qualifier</TableHead>
                <TableHead>Released v{version}</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marked.map((r) => {
                const old = live.find((x) => x.eventKey === r.eventKey && x.valuationClass === r.valuationClass && x.qualifier === r.qualifier)
                return (
                  <TableRow key={r.id} className="h-8 text-[13px]">
                    <TableCell>
                      {r.eventKey} / {r.valuationClass ?? "any"} / {r.qualifier ?? "none"}
                    </TableCell>
                    <TableCell>{old ? `${old.drKey} / ${old.crKey}` : "none"}</TableCell>
                    <TableCell>
                      {r.drKey} / {r.crKey}
                    </TableCell>
                    <TableCell>
                      {old ? "Replaces" : "Adds"} ({r.state})
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No difference">The candidate equals released version {version}.</EmptyState>
        )
      }
      case "simulate": {
        // material, transaction and qty or value -> journal with dimensions (§5.3; Part H §3 rules 2-4, RD-MM-29)
        const sm = simMat === "__class" ? undefined : getMaterial(s, simMat)
        const smv = sm ? s.views[sm.id] : undefined
        const rate = sm ? rateOf(s, sm.id) : 0
        const simAmount = sm && simBy === "qty" ? Math.round((Number(simQty) || 0) * rate * 100) / 100 : Number(amt) || 0
        const simVc = sm ? smv?.valuationClass : svc === "__none" ? undefined : svc
        const atDate = basis === "live" ? liveRows(rows, simDate) : candidateRows(rows)
        const wh = WAREHOUSES.find((w) => w.id === (smv?.defaultWarehouse ?? "WH-TBD-01"))
        const dims = (account?: string) => {
          const bs = !!account && /^[12]/.test(account)
          const pc = sm?.profitCenterId ?? "PC-900"
          if (tx === "pgi") return { cc: "", pc, rule: "4 Sales documents: PC only" }
          if (tx === "settle") return { cc: bs ? "" : "Work center CC (from the WO)", pc, rule: "2 WO posting" }
          return { cc: bs ? "" : wh?.costCenterId ?? "CC-9000", pc, rule: bs ? "3 Inventory movement (balance sheet: PC only)" : "3 Inventory movement" }
        }
        const legs = simulate(atDate, tx, simVc, simAmount, sq || undefined)
        return (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label htmlFor="s-mat">Material</Label>
                <Select value={simMat} onValueChange={setSimMat}>
                  <SelectTrigger id="s-mat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__class">No material: pick a valuation class</SelectItem>
                    {allMaterials(s)
                      .filter((m) => isValuated(m.type) && m.status !== "Obsolete")
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.id} {m.description}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {sm && (
                <>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="s-by">Enter</Label>
                    <Select value={simBy} onValueChange={(x) => setSimBy(x as "qty" | "value")}>
                      <SelectTrigger id="s-by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qty">Quantity ({sm.baseUom})</SelectItem>
                        <SelectItem value="value">Value (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {simBy === "qty" && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="s-qty">Quantity at {fmtMoney(rate)}</Label>
                      <Input id="s-qty" inputMode="decimal" value={simQty} onChange={(e) => setSimQty(e.target.value)} />
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-date">Posting date</Label>
                <Input id="s-date" type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} />
              </div>
            </div>
            {sm && (
              <p className="text-xs text-muted-foreground">
                {sm.id}: valuation class {simVc ?? "none"}, product line {sm.profitCenterId}, default warehouse {wh?.id} (cost center {wh?.costCenterId}). <Reading id="RD-MM-29" />
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-5">
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label htmlFor="s-tx">Transaction</Label>
                <Select value={tx} onValueChange={setTx}>
                  <SelectTrigger id="s-tx">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIM_TRANSACTIONS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!sm && <div className="flex flex-col gap-1">
                <Label htmlFor="s-vc">Valuation class</Label>
                <Select value={svc} onValueChange={setSvc}>
                  <SelectTrigger id="s-vc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}
              <div className="flex flex-col gap-1">
                <Label htmlFor="s-q">Qualifier</Label>
                <Input id="s-q" value={sq} onChange={(e) => setSq(e.target.value)} />
              </div>
              {(!sm || simBy === "value") && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="s-amt">Amount (USD)</Label>
                  <Input id="s-amt" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Matrix basis">
              {(["live", "candidate"] as const).map((b) => (
                <Button key={b} size="sm" variant={basis === b ? "secondary" : "ghost"} role="radio" aria-checked={basis === b} onClick={() => setBasis(b)}>
                  {b === "live" ? `Released, valid on ${fmtDate(simDate)}` : "Candidate (released + marked)"}
                </Button>
              ))}
            </div>
            <section aria-label="Journal preview" className="rounded-lg border">
              <h3 className="border-b px-4 py-2 text-sm font-semibold">Journal preview</h3>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Side</TableHead>
                    <TableHead>Event key</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Resolved by row</TableHead>
                    <TableHead>Cost center</TableHead>
                    <TableHead>Profit center</TableHead>
                    <TableHead>Derivation rule</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legs.map((l, i) => (
                    <TableRow key={i} className={cn("h-8 text-[13px]", !l.account && "text-destructive")}>
                      <TableCell>{l.side}</TableCell>
                      <TableCell className="font-mono">{l.key}</TableCell>
                      <TableCell>{l.account ?? "E-MM-21: no row resolves"}</TableCell>
                      <TableCell className="font-mono">{l.rowId ? `${l.rowId} (v${rows.find((r) => r.id === l.rowId)?.version ?? ""})` : ""}</TableCell>
                      <TableCell className="font-mono">{dims(l.account).cc || "None"}</TableCell>
                      <TableCell className="font-mono">{dims(l.account).pc}</TableCell>
                      <TableCell className="text-xs">{dims(l.account).rule}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">Resolution order: key + class + qualifier, then key + class, then key only (Book II §5.2), using the version valid at the posting date (§5.3). Dimensions per Part H §3; balance-sheet accounts carry the profit center only. Debit / credit leg pairing per transaction is a design mapping.</p>
            </section>
          </div>
        )
      }
      case "check":
        return (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Every event key against every valuation class in use ({inUse.size} classes, from non-obsolete valuated materials). Released: {liveGaps.length} gap(s). Candidate: {gaps.length} gap(s).
            </p>
            {gaps.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Event key</TableHead>
                    <TableHead>Valuation class</TableHead>
                    <TableHead>Materials affected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((g) => (
                    <TableRow key={`${g.key}-${g.vc}`} className="h-8 text-[13px] text-destructive">
                      <TableCell className="font-mono">{g.key}</TableCell>
                      <TableCell>{g.vc}</TableCell>
                      <TableCell className="text-xs">{g.materials.join(", ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Complete">Every key resolves for every class in use; release is not blocked by E-MM-21.</EmptyState>
            )}
          </div>
        )
      default:
        return <DataTable densityKey="MM-VAL-001-hist" rows={rows.filter((r) => r.state === "Superseded" || r.state === "Released")} columns={[...cols, { id: "state", header: "State", value: (r) => r.state, filterable: true }]} rowId={(r) => r.id} initialSort={{ id: "v", dir: "desc" }} />
    }
  }
  const markedCount = rows.filter((r) => r.state === "Marked").length
  return (
    <>
      <ConfigPage
        header={{
          screenId: "MM-VAL-001",
          title: "Account determination",
          description: "The account resolution every posting uses. The Controller drafts, marks and releases with an effective date; historical postings never restate.",
          chips: gaps.length ? <Chip kind="flag">{gaps.length} gap(s) block release (E-MM-21)</Chip> : undefined,
          primary: (
            <Button disabled={!markedCount} onClick={() => (setMfa(false), setDlg(true))}>
              Release with effective date
            </Button>
          ),
          actions: (
            <Button variant="outline" disabled={!rows.some((r) => r.state === "Draft")} onClick={() => run(markRows(), (n) => `${n} row(s) marked`)}>
              Mark drafts
            </Button>
          ),
        }}
        sections={SECTIONS}
        section={section}
        onSectionChange={setSection}
        effectiveDated
      >
        {content()}
      </ConfigPage>
      <RulesPanel
        rules={[
          ["§5.2", "Event keys are a closed list; resolution is (key + class + qualifier), then (key + class), then (key).", "[Book II §5.2]"],
          ["§5.3", "Two-step mark and release, with simulation before release; the Controller releases with step-up MFA.", "[DOC:p.247; Book II §5.3]"],
          ["E-MM-21", "Release is blocked while any event key x valuation class in use does not resolve.", "[Book II §5.3]"],
          ["C-50", "Released rows are never edited or deleted; a change is a new version from its effective date.", "erd-sketch §4"],
          ["RD-MM-11", "Step-up MFA is an attestation checkbox in the prototype.", "README Readings"],
        ]}
      />
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        title={`Release ${markedCount} marked row(s) as version ${version + 1}`}
        description="Controller only."
        consequence={`Version ${version + 1} resolves every posting from ${fmtDate(eff)}; replaced rows stay valid until that date and are superseded from it. Postings dated before it keep resolving to the rows they use today.`}
        confirmLabel="Release matrix"
        confirmDisabled={!mfa}
        onConfirm={() => confirmRun(releaseMatrix(eff, mfa), (v) => `Version ${v} released, effective ${fmtDate(eff)}`)}
      >
        <Label htmlFor="rel-eff">Effective date</Label>
        <Input id="rel-eff" type="date" value={eff} onChange={(e) => setEff(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={mfa} onCheckedChange={(c) => setMfa(c === true)} /> I confirm the step-up verification for this release
        </label>
        <Reading id="RD-MM-11" />
        {gaps.length > 0 && <p className="text-sm text-destructive">E-MM-21: {gaps.length} gap(s) remain; release will be refused.</p>}
      </DialogShell>
    </>
  )
}
