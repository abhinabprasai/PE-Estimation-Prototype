// FX-MM-SSSTAT: Statistical safety stock activation [Book I Part A §10.2, Phase 2]. The PRD reserves
// the "Suggested SS" and "Service Level" columns empty at go-live. This wizard switches the
// statistical method on: choose a service level per ABC class, preview the suggested safety stock per
// row (Z x demand sigma x sqrt(lead time), capped by shelf life), and activate. Suggestions stay
// read-only beside the planner's value; they never overwrite it. Flagged as not in the current build.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, WizardPage } from "@/components/templates"
import { Chip, EmptyState, FamilyBadge, RulesPanel } from "@/components/patterns"
import { fmtDate, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { ssEffective } from "../lib/rules"
import { Z_TABLE, statSuggestion } from "../lib/ext-rules"
import type { AbcClass, StatSafety } from "../data/ext"
import { activateStatistical, deactivateStatistical } from "../data/ext-actions"
import { MatLink, Reading, Section, userName } from "../components/common"
import { useViewState } from "../components/states"
import { run } from "../components/run"

const CLASSES: AbcClass[] = ["A", "B", "C"]

export function SsStatistical() {
  const s = useSlice("materials")
  const [role] = useRole()
  const st = useViewState("FX-MM-SSSTAT", { degradedWhat: "Demand history is not refreshing", authorizedRoles: ["Planning Manager"] })
  const x = s.x.stat
  const [levels, setLevels] = useState<StatSafety["levels"]>(x.levels)
  const eligible = useMemo(() => s.safetyStock.filter((r) => r.adu > 0), [s.safetyStock])
  const [picked, setPicked] = useState<string[]>(() => eligible.map((r) => r.id))
  const preview = useMemo(
    () => s.safetyStock.filter((r) => picked.includes(r.id)).map((r) => ({ r, abc: (s.views[r.materialId]?.abc ?? "A") as AbcClass, xyz: s.views[r.materialId]?.xyz, ...statSuggestion(r, (s.views[r.materialId]?.abc ?? "A") as AbcClass, s.views[r.materialId]?.xyz, levels) })),
    [s, picked, levels],
  )
  const monotone = levels.A >= levels.B && levels.B >= levels.C

  if (x.active && !st.empty)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          screenId="FX-MM-SSSTAT"
          title="Statistical safety stock"
          chips={<><FamilyBadge family="active" label="Activated" size="md" title="Prototype state of this method; not a record status" /><Chip kind="oq" id="Phase 2" note="The PRD reserves Suggested SS and Service Level as empty columns until Phase 2">Phase 2</Chip><Reading id="RD-MM-36" /></>}
          description={`Activated ${fmtDate(x.activatedOn)} by ${userName(x.by)}. Suggestions sit beside the planner's value in the safety-stock grid and never overwrite it.`}
          primary={<Button asChild><Link to="/inventory/planning/safety-stock">Open safety stock maintenance</Link></Button>}
          actions={
            <Button variant="outline" disabled={!st.canWrite} title={st.blockedWhy} onClick={() => run(deactivateStatistical(), "Statistical method switched off; suggestions cleared")}>
              Switch off
            </Button>
          }
        />
        {st.banners}
        <Section title="Service levels in force">
          <dl className="grid grid-cols-3 gap-4 text-sm">
            {CLASSES.map((c) => <div key={c}><dt className="text-muted-foreground">Class {c}</dt><dd className="tabular">{(x.levels[c] * 100).toFixed(1)}%</dd></div>)}
          </dl>
        </Section>
        <Section title={`Suggested safety stock (${Object.keys(x.suggestions).length} rows, read-only)`}>
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow><TableHead>Material</TableHead><TableHead>Warehouse</TableHead><TableHead className="text-right">Current SS</TableHead><TableHead className="text-right">Suggested SS</TableHead><TableHead className="text-right">Service level</TableHead><TableHead className="text-right">Z</TableHead><TableHead className="text-right">Sigma (units/day)</TableHead><TableHead>Note</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {s.safetyStock.filter((r) => x.suggestions[r.id]).map((r) => {
                const g = x.suggestions[r.id]
                return (
                  <TableRow key={r.id}>
                    <TableCell><MatLink id={r.materialId} /></TableCell><TableCell className="font-mono">{r.warehouseId}</TableCell>
                    <TableCell className="tabular text-right">{fmtNumber(ssEffective(r))}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{fmtNumber(g.suggested)}</TableCell>
                    <TableCell className="tabular text-right">{(g.level * 100).toFixed(1)}%</TableCell>
                    <TableCell className="tabular text-right">{g.z.toFixed(2)}</TableCell>
                    <TableCell className="tabular text-right">{g.sigma}</TableCell>
                    <TableCell>{g.capped ? <Chip kind="flag">Capped by shelf life (W-SS-02)</Chip> : ""}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Section>
      </div>
    )

  return (
    <>
      {st.banners}
      <WizardPage
        header={{
          screenId: "FX-MM-SSSTAT",
          title: "Statistical safety stock activation",
          description: "Switch on the statistical method: service levels by ABC class, a preview of the suggested safety stock per row, then activate.",
          chips: <><Chip kind="oq" id="Phase 2" note="Suggested SS and Service Level are reserved empty in the current build">Phase 2, not in the current build</Chip><Reading id="RD-MM-36" /></>,
          actions: <>{st.toolbar}<Button variant="outline" asChild><Link to="/inventory/safety-stock/exceptions">Exception report</Link></Button></>,
        }}
        finishLabel="Activate statistical method"
        consequence={`Fills the Suggested SS and Service Level columns for ${preview.length} row(s) in the safety-stock grid. The planner's safety stock is not changed; only the Planning Manager can activate or switch it off.`}
        onFinish={() => {
          if (!st.canWrite) return st.blockedWhy ?? "Blocked"
          const r = activateStatistical(levels, picked)
          if (!r.ok) return r.error
          toast.success(`Statistical method active: ${r.value} suggestion(s) filled`)
          return null
        }}
        steps={[
          {
            id: "levels",
            title: "Service levels",
            validate: () => (monotone ? null : "Service levels must not fall from class A to C (A at least B at least C)."),
            content: (
              <div className="flex max-w-xl flex-col gap-4">
                <p className="text-sm">Target probability of not stocking out during lead time, per ABC class (class from the Planning view).</p>
                {CLASSES.map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <Label htmlFor={`lv-${c}`} className="w-24">Class {c}</Label>
                    <Select value={String(levels[c])} onValueChange={(v) => setLevels({ ...levels, [c]: Number(v) })}>
                      <SelectTrigger id={`lv-${c}`} size="sm" className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{Z_TABLE.map((z) => <SelectItem key={z.level} value={String(z.level)}>{(z.level * 100).toFixed(1)}% (Z {z.z})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
                {!monotone && <p role="alert" className="text-sm text-destructive">Service levels must not fall from class A to C (A at least B at least C).</p>}
                {st.validation && <p className="text-xs text-destructive">Class A must be at least class B, and B at least C.</p>}
              </div>
            ),
          },
          {
            id: "rows",
            title: "Rows and preview",
            validate: () => (preview.length === 0 ? "Choose at least one row with demand (ADU above zero)." : null),
            content:
              eligible.length === 0 ? (
                <EmptyState title="No row has demand">Rows with ADU zero are skipped: there is no variation to model.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPicked(eligible.map((r) => r.id))}>Select all</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
                  </div>
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow><TableHead className="w-10" /><TableHead>Material</TableHead><TableHead>ABC / XYZ</TableHead><TableHead className="text-right">ADU</TableHead><TableHead className="text-right">Lead time (d)</TableHead><TableHead className="text-right">Current SS</TableHead><TableHead className="text-right">Suggested SS</TableHead><TableHead>Note</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligible.map((r) => {
                        const abc = (s.views[r.materialId]?.abc ?? "A") as AbcClass
                        const g = statSuggestion(r, abc, s.views[r.materialId]?.xyz, levels)
                        const on = picked.includes(r.id)
                        return (
                          <TableRow key={r.id}>
                            <TableCell><Checkbox checked={on} onCheckedChange={(v) => setPicked(v ? [...picked, r.id] : picked.filter((i) => i !== r.id))} aria-label={`Include ${r.materialId} ${r.warehouseId}`} /></TableCell>
                            <TableCell><MatLink id={r.materialId} /> <span className="font-mono text-xs text-muted-foreground">{r.warehouseId}</span></TableCell>
                            <TableCell>{abc} / {s.views[r.materialId]?.xyz ?? "Y"}</TableCell>
                            <TableCell className="tabular text-right">{r.adu}</TableCell>
                            <TableCell className="tabular text-right">{r.ltDays}</TableCell>
                            <TableCell className="tabular text-right">{fmtNumber(ssEffective(r))}</TableCell>
                            <TableCell className="tabular text-right font-semibold">{fmtNumber(g.suggested)}</TableCell>
                            <TableCell>{g.capped ? <Chip kind="flag">Capped (W-SS-02)</Chip> : g.suggested > ssEffective(r) * 1.25 ? <span className="text-xs text-muted-foreground">Above current by over 25%</span> : ""}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground">Suggested SS = Z(service level) x sigma(daily demand) x sqrt(lead time); sigma = ADU x variation by XYZ class (design values, RD-MM-36); shelf-life items are capped at shelf life / 2 x ADU.</p>
                </div>
              ),
          },
          {
            id: "activate",
            title: "Activate",
            validate: () => (role !== "Planning Manager" ? `Activating statistical safety stock is done by the Planning Manager; you are acting as ${role}.` : null),
            content: (
              <div className="flex max-w-3xl flex-col gap-3 text-sm">
                <Alert role="status">
                  <AlertTitle>Ready to activate</AlertTitle>
                  <AlertDescription>
                    {preview.length} row(s), service levels A {(levels.A * 100).toFixed(1)}%, B {(levels.B * 100).toFixed(1)}%, C {(levels.C * 100).toFixed(1)}%.
                    {preview.some((p) => p.capped) && ` ${preview.filter((p) => p.capped).length} row(s) are capped by shelf life.`}
                  </AlertDescription>
                </Alert>
                <p>Acting as {role}. The planner keeps editing the safety-stock value; a change above 25% still goes to the Planning Manager.</p>
              </div>
            ),
          },
        ]}
      />
      <RulesPanel
        rules={[
          ["§10.2", "Suggested SS and Service Level columns are reserved empty in the grid at go-live; the statistical method arrives in Phase 2.", "[Book I A §10.2]"],
          ["W-SS-02", "For shelf-life materials the safety stock may not exceed shelf life / 2 x ADU.", "[Book I A §10.4]"],
          ["RD-MM-36", "Demand variation by XYZ class and the service levels per class are design values.", "README Readings"],
        ]}
      />
    </>
  )
}
