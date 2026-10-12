// MM-EOR-001 Excess and Obsolete Reserve Run [DOC:p.248] (asserted); rules Book II §17.3. FL-06.
// Wizard: policy table, compute (run preview grid with per-material reserve deltas and drill to the
// slow-moving evidence), review, post. Posts DR 6320 / CR 5340 on build and the reverse on release;
// valuation only, never a quantity change.
import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WizardPage } from "@/components/templates"
import { DataTable, EmptyState, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { MaterialType } from "@/data/domain"
import { MATERIAL_TYPES } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { EO_BUCKETS, isValuated } from "../lib/rules"
import { allMaterials, getMaterial } from "../data/state"
import { addEoOverride, computeEo, postEo, reviewEo, setEoRate } from "../data/actions"
import type { EoRunRecord } from "../data/types"
import { MatLink, Reading, Section, TextPostingPreview, useListState } from "../components/common"
import { run } from "../components/run"

type EoRow = EoRunRecord["rows"][number]

export function EoReserve() {
  const s = useSlice("materials")
  const [role] = useRole()
  const [sp, setSp] = useSearchParams()
  const st = useListState("MM-EOR-001")
  const [round, setRound] = useState(0)
  const [period, setPeriod] = useState("2026-Q3")
  const [runId, setRunId] = useState<string | undefined>()
  const [drill, setDrill] = useState<string | null>(null)
  const [ovMat, setOvMat] = useState("")
  const [ovPct, setOvPct] = useState("")
  const [ovReason, setOvReason] = useState("")
  const runRec = s.eoRuns.find((r) => r.id === runId)
  const viewRun = s.eoRuns.find((r) => r.id === sp.get("run"))
  const build = (r?: EoRunRecord) => (r ? r.rows.filter((x) => x.reserveDelta > 0).reduce((a, x) => a + x.reserveDelta, 0) : 0)
  const release = (r?: EoRunRecord) => (r ? r.rows.filter((x) => x.reserveDelta < 0).reduce((a, x) => a - x.reserveDelta, 0) : 0)

  const rowCols: Column<EoRow>[] = [
    { id: "m", header: "Material", value: (r) => r.materialId, sortable: true, cell: (r) => <MatLink id={r.materialId} /> },
    { id: "type", header: "Type", value: (r) => getMaterial(s, r.materialId)?.type ?? "", filterable: true },
    { id: "bucket", header: "Age bucket", value: (r) => r.bucket, filterable: true },
    { id: "last", header: "Last movement", value: (r) => r.lastMovement, sortable: true, cell: (r) => fmtDate(r.lastMovement) },
    { id: "value", header: "Stock value", value: (r) => r.value, align: "right", mono: true, sortable: true, cell: (r) => fmtMoney(r.value) },
    { id: "pct", header: "Rate", value: (r) => r.pct, align: "right", mono: true, cell: (r) => `${r.pct}%` },
    { id: "res", header: "Reserve", value: (r) => r.reserve, align: "right", mono: true, cell: (r) => fmtMoney(r.reserve) },
    { id: "ex", header: "Existing", value: (r) => r.existing, align: "right", mono: true, cell: (r) => fmtMoney(r.existing) },
    { id: "d", header: "Delta", value: (r) => r.reserveDelta, align: "right", mono: true, sortable: true, cell: (r) => <span className={r.reserveDelta < 0 ? "text-status-active-ink" : ""}>{fmtMoney(r.reserveDelta)}</span> },
    {
      id: "ev",
      header: "Evidence",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setDrill(r.materialId)}>
          Slow-moving evidence
        </Button>
      ),
    },
  ]
  const grid = (r?: EoRunRecord) =>
    r ? (
      <DataTable densityKey="MM-EOR-001" rows={r.rows} columns={rowCols} rowId={(x) => x.materialId} searchText={(x) => x.materialId} initialSort={{ id: "d", dir: "desc" }} empty={{ title: "Nothing to reserve", body: "No valuated stock ages past 6 months and no prior reserve to release." }} />
    ) : (
      <EmptyState title="Not computed yet">Compute the run for the period to see the reserve deltas.</EmptyState>
    )
  const posting = (r?: EoRunRecord) => (
    <TextPostingPreview
      lines={[
        ...(build(r) ? [{ transaction: "E&O reserve build", debit: "6320", credit: "5340", amount: Math.round(build(r) * 100) / 100, detail: `${r?.rows.filter((x) => x.reserveDelta > 0).length} materials` }] : []),
        ...(release(r) ? [{ transaction: "E&O reserve release", debit: "5340", credit: "6320", amount: Math.round(release(r) * 100) / 100, detail: `${r?.rows.filter((x) => x.reserveDelta < 0).length} materials` }] : []),
      ]}
      note="DR 6320 CR 5340 on build, reverse on release [DOC:p.248]. Valuation only; no quantity moves."
    />
  )

  const policyStep = (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        Policy {s.eoPolicy.version}, valid from {fmtDate(s.eoPolicy.validFrom)}. <Reading id="RD-MM-10" />
      </p>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Type</TableHead>
            {EO_BUCKETS.slice(1).map((b) => (
              <TableHead key={b} className="text-right">
                {b}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MATERIAL_TYPES.filter(isValuated).map((t) => (
            <TableRow key={t} className="h-8 text-[13px]">
              <TableCell className="font-mono">{t}</TableCell>
              {([0, 1, 2] as const).map((i) => (
                <TableCell key={i} className="text-right">
                  <Input
                    aria-label={`${t} ${EO_BUCKETS[i + 1]} %`}
                    className="ml-auto h-7 w-20 text-right"
                    inputMode="decimal"
                    defaultValue={s.eoPolicy.rates[t as MaterialType][i]}
                    key={`${t}-${i}-${s.eoPolicy.version}`}
                    onBlur={(e) => Number(e.target.value) !== s.eoPolicy.rates[t as MaterialType][i] && run(setEoRate(t as MaterialType, i, Number(e.target.value)), "Policy updated; new version")}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Under 6 months reserves 0%. Rates are edited by the Controller; each change creates a new policy version.</p>
      <Section title={`Overrides (${s.eoPolicy.overrides.length})`}>
        <ul className="text-sm">
          {s.eoPolicy.overrides.map((o) => (
            <li key={o.materialId}>
              <MatLink id={o.materialId} /> {o.pct}% · {o.reason}
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-4">
          <Select value={ovMat} onValueChange={setOvMat}>
            <SelectTrigger aria-label="Override material">
              <SelectValue placeholder="Material" />
            </SelectTrigger>
            <SelectContent>
              {allMaterials(s)
                .filter((m) => isValuated(m.type))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input aria-label="Override %" placeholder="%" inputMode="decimal" value={ovPct} onChange={(e) => setOvPct(e.target.value)} />
          <Input aria-label="Override reason" placeholder="Reason" value={ovReason} onChange={(e) => setOvReason(e.target.value)} />
          <Button variant="outline" onClick={() => run(addEoOverride(ovMat, Number(ovPct), ovReason), "Override saved") && (setOvPct(""), setOvReason(""))}>
            Add override
          </Button>
        </div>
      </Section>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <WizardPage
        key={round}
        header={{
          screenId: "MM-EOR-001",
          title: "Excess and obsolete reserve run",
          description: `Quarterly computation and posting of the E&O inventory reserve. Acting as ${role}; the run is done by the Controller.`,
        }}
        steps={[
          { id: "policy", title: "Policy table", content: policyStep },
          {
            id: "compute",
            title: "Compute",
            validate: () => (runRec && runRec.stage !== "Posted" ? null : "Compute the run first."),
            content: (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="eo-period">Period</Label>
                    <Select value={period} onValueChange={setPeriod}>
                      <SelectTrigger id="eo-period" className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["2026-Q3", "2026-Q4"].map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => {
                    const r = computeEo(runRec && runRec.stage !== "Posted" ? runRec.id : undefined, period)
                    if (run(r, (id) => `${id} computed`) && r.ok) setRunId(r.value)
                  }}>
                    {runRec ? "Recompute" : "Compute"}
                  </Button>
                  {runRec && (
                    <span className="text-sm">
                      {runRec.id} · {runRec.stage} · build {fmtMoney(build(runRec))}, release {fmtMoney(release(runRec))}
                    </span>
                  )}
                </div>
                {grid(runRec)}
              </div>
            ),
          },
          {
            id: "review",
            title: "Review",
            validate: () => {
              if (!runRec) return "Compute the run first."
              if (runRec.stage === "Computed") {
                const r = reviewEo(runRec.id)
                return r.ok ? null : r.error
              }
              return null
            },
            content: (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Materials</dt>
                    <dd className="tabular text-xl font-semibold">{runRec?.rows.length ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Reserve build</dt>
                    <dd className="tabular text-xl font-semibold">{fmtMoney(build(runRec))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Reserve release</dt>
                    <dd className="tabular text-xl font-semibold">{fmtMoney(release(runRec))}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total reserve after run</dt>
                    <dd className="tabular text-xl font-semibold">{fmtMoney(runRec?.rows.reduce((a, x) => a + x.reserve, 0) ?? 0)}</dd>
                  </div>
                </dl>
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead className="text-right">Materials</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...EO_BUCKETS, "No stock"].map((b) => {
                      const rs = runRec?.rows.filter((x) => x.bucket === b) ?? []
                      if (!rs.length) return null
                      return (
                        <TableRow key={b} className="h-8 text-[13px]">
                          <TableCell>{b}</TableCell>
                          <TableCell className="tabular text-right">{rs.length}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(rs.reduce((a, x) => a + x.value, 0))}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(rs.reduce((a, x) => a + x.reserveDelta, 0))}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground">Next marks the run Reviewed.</p>
              </div>
            ),
          },
          { id: "post", title: "Post", content: posting(runRec) },
        ]}
        finishLabel="Post reserve"
        consequence={runRec ? `Posts ${runRec.id}: build ${fmtMoney(build(runRec))} (DR 6320 / CR 5340) and release ${fmtMoney(release(runRec))} (reverse) in the open period. A posted run is final.` : "Compute and review the run first."}
        onFinish={() => {
          if (!runRec) return "Compute the run first."
          const r = postEo(runRec.id)
          if (!r.ok) return r.error
          run(r, `${runRec.id} posted`)
          setSp({ run: runRec.id })
          setRunId(undefined)
          setRound((x) => x + 1)
          return null
        }}
      />
      <Section title={`Runs (${s.eoRuns.length})`}>
        <DataTable
          densityKey="MM-EOR-001-runs"
          rows={st.empty ? [] : s.eoRuns}
          columns={[
            { id: "id", header: "Run", value: (r) => r.id, mono: true },
            { id: "p", header: "Period", value: (r) => r.period },
            { id: "pol", header: "Policy", value: (r) => r.policyVersion },
            { id: "stage", header: "Stage", value: (r) => r.stage, filterable: true },
            { id: "b", header: "Build", value: (r) => build(r), align: "right", mono: true, cell: (r) => fmtMoney(build(r)) },
            { id: "rel", header: "Release", value: (r) => release(r), align: "right", mono: true, cell: (r) => fmtMoney(release(r)) },
            { id: "je", header: "Journal", value: (r) => r.journalRef ?? "", mono: true },
            { id: "on", header: "Posted", value: (r) => r.postedOn ?? "", cell: (r) => fmtDate(r.postedOn) },
          ]}
          rowId={(r) => r.id}
          activeId={viewRun?.id}
          onRowClick={(r) => setSp({ run: r.id })}
          loading={st.loading}
          error={st.error}
          onRetry={st.onRetry}
          toolbar={st.toolbar}
          empty={{ title: "No runs yet", body: "The first quarterly run appears here once computed." }}
        />
        {viewRun && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              {viewRun.id} · {viewRun.stage}
            </h3>
            {grid(viewRun)}
            {viewRun.stage === "Posted" && posting(viewRun)}
          </div>
        )}
      </Section>
      <RulesPanel
        rules={[
          ["§17.3", "Quarterly run by the Controller: compute from age buckets (6, 12, 24+ months since last movement) and the policy table, review, post.", "[DOC:p.248; Book II §17.3]"],
          ["§17.3", "DR 6320 CR 5340 on build, reverse on release; valuation only.", "[DOC:p.248]"],
          ["RD-MM-10", "Reserve percentages per type and bucket are design values.", "README Readings"],
          ["§14.1", "Consignment and customer-property stock are not PE-owned and are excluded.", "[Book II §14.1]"],
        ]}
      />
      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Slow-moving evidence: {drill}</SheetTitle>
            <SheetDescription>Stock rows and their last movement date.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-4 text-sm">
            {s.stock
              .filter((r) => r.materialId === drill)
              .map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                  <span className="font-mono">
                    {r.warehouseId} / {r.bin}
                  </span>
                  {r.batchId && <span className="font-mono">{r.batchId}</span>}
                  <StatusBadge kind="stock" status={r.status} size="sm" /> {r.bucket} · {fmtNumber(r.qty)} · last movement {fmtDate(r.lastMovement)}
                </div>
              ))}
            {drill && <MatLink id={drill} tab="stock">Open stock overview</MatLink>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
