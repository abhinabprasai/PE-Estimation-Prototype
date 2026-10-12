// CST-RUN-001 Costing Runs [DOC:pp.270-271] (asserted); rules Book I I §3.2, Book II §5.
// Scope step, rollup with error list, review grid sorted by value impact with drill to itemization,
// two-step mark and release. Release stamps standards and revalues stock (INV Sec 12 #15).
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, WizardPage } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert } from "@/components/patterns"
import { MATERIAL_TYPES, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { markRun, releaseRun, rollRun } from "../data/actions"
import type { RunRec } from "../data/types"
import { OtherPostingPreview, Reading, report, Section, signCls, useDemoState } from "../components/common"
import { ItemLink, SelectField, TextField, userName, SkeletonTable } from "../components/bits"

const impact = (i: RunRec["items"][number]) => Math.round(i.onHand * (i.newStd - i.oldStd) * 100) / 100

export function CostingRuns() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CST-RUN-001")
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const [role] = useRole()
  const [runId, setRunId] = useState<string | null>(sp.get("run"))
  const [scope, setScope] = useState<RunRec["scopeKind"]>("Changed-BOM flag only")
  const [groups, setGroups] = useState<string[]>(["FIN"])
  const [eff, setEff] = useState("2026-11-01")
  const [wizKey, setWizKey] = useState(0)
  const run = s.costingRuns.find((r) => r.id === runId)
  const sorted = useMemo(() => (run ? [...run.items].sort((a, b) => Math.abs(impact(b)) - Math.abs(impact(a))) : []), [run])
  const errors = run?.items.filter((i) => i.error) ?? []
  const reval = sorted.filter((i) => !i.error).reduce((t, i) => t + impact(i), 0)

  const header = {
    screenId: "CST-RUN-001",
    title: "Costing runs",
    description: "Roll up standard costs bottom-up by low-level code, review by value impact, then mark and release. Release revalues stock on hand.",
    actions: st.menu,
  }
  if (st.loading || st.error || st.empty)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader {...header} />
        {st.loading ? (
          <SkeletonTable cols={5} rows={6} />
        ) : st.error ? (
          <ErrorAlert title="Costing runs could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
            {st.error}
          </ErrorAlert>
        ) : (
          <EmptyState title="No costing runs yet">Start the annual run, a weekly new-item run or a changed-BOM run with the wizard.</EmptyState>
        )}
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <WizardPage
        key={wizKey}
        header={{ ...header, chips: run ? <Chip kind="design" note="Run stage is a prototype word: the specification names the steps, not a status list">{run.id} · {run.stage}</Chip> : undefined }}
        steps={[
          {
            id: "scope",
            title: "Scope",
            content: run ? (
              <p className="text-sm">
                Working on <span className="font-mono">{run.id}</span>: {run.scope}. Created {fmtDate(run.createdOn)} by {userName(run.createdBy)}. Choose <Button variant="link" className="h-auto p-0" onClick={() => (setRunId(null), setSp({}), setWizKey(wizKey + 1))}>a new run</Button> instead.
              </p>
            ) : (
              <div className="flex max-w-md flex-col gap-4">
                <SelectField id="run-scope" label="Scope" value={scope} onChange={setScope} options={(["All standard-cost items", "Item groups", "Changed-BOM flag only", "New items only"] as const).map((x) => ({ value: x, label: x }))} hint="Annual cycle, weekly new-item runs, MBOM invalidation flags." />
                {scope === "Item groups" && (
                  <fieldset className="flex flex-wrap gap-4">
                    <legend className="mb-2 text-sm">Material types</legend>
                    {MATERIAL_TYPES.filter((t) => !["NSTK", "SERV"].includes(t)).map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={groups.includes(t)} onCheckedChange={(c) => setGroups(c ? [...groups, t] : groups.filter((g) => g !== t))} /> {t}
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="text-sm text-muted-foreground">Next rolls up material per MBOM with scrap, labor and overhead per routing at the released work center rates.</p>
              </div>
            ),
            validate: () => {
              if (run) return null
              const r = rollRun(scope, scope === "Item groups" ? groups : [])
              if (!r.ok) return r.error
              setRunId(r.value)
              setSp({ run: r.value }, { replace: true })
              return null
            },
          },
          {
            id: "errors",
            title: "Rollup errors",
            content: errors.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">{errors.length} item(s) did not roll up. They keep their current standard; fix the cause and roll again.</p>
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((e) => (
                      <TableRow key={e.itemId} className="h-8 text-[13px]">
                        <TableCell>
                          <ItemLink id={e.itemId} />
                        </TableCell>
                        <TableCell>{e.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm">No rollup errors: every item in scope has a basis.</p>
            ),
          },
          {
            id: "review",
            title: "Review by value impact",
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Current standard</TableHead>
                    <TableHead className="text-right">New standard</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Value impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted
                    .filter((i) => !i.error)
                    .map((i) => (
                      <TableRow key={i.itemId} className="h-8 text-[13px]">
                        <TableCell>
                          <ItemLink id={i.itemId} />
                          {s.costEstimates.find((c) => c.itemId === i.itemId && c.status === "Released") && (
                            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => nav(`/costing/estimates/${s.costEstimates.find((c) => c.itemId === i.itemId && c.status === "Released")!.id}`)}>
                              itemization
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(i.oldStd)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(i.newStd)}</TableCell>
                        <TableCell className={`tabular text-right ${signCls(i.newStd - i.oldStd)}`}>{i.oldStd ? fmtPct(((i.newStd - i.oldStd) / i.oldStd) * 100) : ""}</TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(i.onHand)}</TableCell>
                        <TableCell className={`tabular text-right ${signCls(impact(i))}`}>{fmtMoney(impact(i))}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "mark",
            title: "Mark",
            content: (
              <div className="flex flex-col gap-2 text-sm">
                <p>Marking freezes the proposed standards for release. Cost accountant marks; a different person releases <Reading id="OQ-PF-16" />.</p>
                {run?.stage === "Rolled" ? (
                  <Button className="w-fit" variant="outline" onClick={() => report(markRun(run.id), `${run.id} marked`)}>
                    Mark run (acting as {role})
                  </Button>
                ) : (
                  <p>
                    {run?.stage === "Released" ? "Released" : "Marked"} by {userName(run?.markedBy)}.
                  </p>
                )}
              </div>
            ),
            validate: () => (run && run.stage !== "Rolled" ? null : "Mark the run before release (two-step, INV 8.2)."),
          },
          {
            id: "release",
            title: "Release",
            content: (
              <div className="flex flex-col gap-4">
                {run?.stage === "Released" ? (
                  <p className="text-sm">
                    Released {fmtDate(run.releasedOn)} by {userName(run.releasedBy)}, effective {fmtDate(run.effectiveFrom)}.
                  </p>
                ) : (
                  <TextField id="run-eff" type="date" label="Effective from" value={eff} onChange={setEff} />
                )}
                <OtherPostingPreview rows={[{ key: "reval", amount: Math.round(reval * 100) / 100, detail: `${sorted.filter((i) => !i.error && impact(i) !== 0).length} items × on-hand × (new − current standard)` }]} period={TODAY.slice(0, 7)} title="Revaluation on release" />
              </div>
            ),
          },
        ]}
        finishLabel="Release standards"
        consequence={run ? `Stamps the new standards on ${sorted.filter((i) => !i.error).length} materials effective ${fmtDate(eff)} and posts revaluation of ${fmtMoney(Math.round(reval * 100) / 100)} (RVV rows land on the Cost Variance Workbench). Controller only.` : "Roll a run first."}
        onFinish={() => (run ? report(releaseRun(run.id, eff), `${run.id} released`) : "Roll a run first.")}
      />
      <Section title="Runs">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.costingRuns.map((r) => (
              <TableRow key={r.id} className="h-8 text-[13px]">
                <TableCell className="font-mono">{r.id}</TableCell>
                <TableCell>{r.scope}</TableCell>
                <TableCell>
                  {fmtDate(r.createdOn)} {userName(r.createdBy)}
                </TableCell>
                <TableCell>{r.stage}</TableCell>
                <TableCell>{fmtDate(r.effectiveFrom)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => (setRunId(r.id), setSp({ run: r.id }, { replace: true }), setWizKey(wizKey + 1))}>
                    Open in wizard
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  )
}
