// FX-MM-DUPES: Duplicate merge steward queue [Book IV §7.1]. Candidates come from the matching job
// (review at 0.9, auto-flag at 0.97). The steward sees usage counts for both materials, picks the
// survivor, reads the reference-rewrite worklist and any blockers, then either records "not a
// duplicate" or merges. A merge is a supersession specialization and is irreversible.

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { Chip, EmptyState, FamilyBadge, RulesPanel, type Column } from "@/components/patterns"
import { fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import type { DupeCandidate } from "../data/ext"
import { decideNotDuplicate, mergeDuplicates } from "../data/ext-actions"
import { getMaterial, R } from "../data/state"
import { mergeBlockers, mergeWorklist, usageCounts, type UsageCounts } from "../lib/ext-rules"
import { CompareTable } from "../components/dialogs"
import { MatLink, MaterialStatus, Reading, Section, TypeBadge, userName } from "../components/common"
import { useViewState } from "../components/states"
import { confirmRun } from "../components/run"
import { Link } from "react-router"

const QUEUES = [
  { id: "open", label: "Open" },
  { id: "auto", label: "Auto-flagged (0.97 and above)" },
  { id: "not", label: "Not a duplicate" },
  { id: "merged", label: "Merged" },
]

function Usage({ id, u }: { id: string; u: UsageCounts }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
      <p className="font-mono font-semibold">{id}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">On hand</dt><dd className="tabular text-right">{fmtNumber(u.stockQty)}</dd>
        <dt className="text-muted-foreground">Stock rows</dt><dd className="tabular text-right">{u.stockRows}</dd>
        <dt className="text-muted-foreground">Where used</dt><dd className="tabular text-right">{u.whereUsed}</dd>
        <dt className="text-muted-foreground">Open documents</dt><dd className="tabular text-right">{u.openDocs}</dd>
        <dt className="text-muted-foreground">Info records</dt><dd className="tabular text-right">{u.infoRecords}</dd>
        <dt className="text-muted-foreground">Source list rows</dt><dd className="tabular text-right">{u.sourceRows}</dd>
        <dt className="text-muted-foreground">Price rows</dt><dd className="tabular text-right">{u.priceRows}</dd>
      </dl>
    </div>
  )
}

export function Duplicates() {
  const s = useSlice("materials")
  const [role] = useRole()
  const st = useViewState("FX-MM-DUPES", { degradedWhat: "The matching job result is stale", authorizedRoles: ["Material steward", "Materials Manager"] })
  const [queue, setQueue] = useState("open")
  const [openId, setOpenId] = useState<string | null>(null)
  const [survivor, setSurvivor] = useState<string>("")
  const [dlg, setDlg] = useState<"not" | "merge" | null>(null)
  const [typed, setTyped] = useState("")
  const cand = s.x.dupes.find((d) => d.id === openId)
  const all = st.empty ? [] : s.x.dupes
  const inQueue = (d: DupeCandidate) => (queue === "open" ? !d.decision : queue === "auto" ? !d.decision && d.score >= 0.97 : queue === "not" ? d.decision?.kind === "Not a duplicate" : d.decision?.kind === "Merged")
  const rows = all.filter(inQueue)
  const cols: Column<DupeCandidate>[] = [
    { id: "id", header: "Candidate", value: (d) => d.id, sortable: true, mono: true },
    { id: "a", header: "Material A", value: (d) => d.aId, cell: (d) => <MatLink id={d.aId} /> },
    { id: "b", header: "Material B", value: (d) => d.bId, cell: (d) => <MatLink id={d.bId} /> },
    { id: "score", header: "Score", value: (d) => d.score, sortable: true, align: "right", mono: true, cell: (d) => d.score.toFixed(2) },
    { id: "flag", header: "Flag", value: (d) => (d.score >= 0.97 ? "Auto-flagged" : "Review"), filterable: true, cell: (d) => (d.score >= 0.97 ? <Chip kind="flag">Auto-flag</Chip> : <span className="text-muted-foreground">Review</span>) },
    { id: "basis", header: "Match basis", value: (d) => d.basis },
    { id: "dec", header: "Decision", value: (d) => d.decision?.kind ?? "Open", filterable: true },
  ]
  const ua = cand ? usageCounts(s, cand.aId) : undefined
  const ub = cand ? usageCounts(s, cand.bId) : undefined
  const surv = survivor || (cand ? (getMaterial(s, cand.aId)?.status === "Active" ? cand.aId : getMaterial(s, cand.bId)?.status === "Active" ? cand.bId : cand.aId) : "")
  const loser = cand ? (surv === cand.aId ? cand.bId : cand.aId) : ""
  const blockers = useMemo(() => (cand && surv ? mergeBlockers(s, loser, surv) : []), [s, cand, surv, loser])
  const worklist = useMemo(() => (cand && surv ? mergeWorklist(s, loser, surv) : []), [s, cand, surv, loser])
  const open = (id: string) => {
    setOpenId(id)
    setSurvivor("")
    setTyped("")
  }
  const merged = s.x.dupes.filter((d) => d.decision?.kind === "Merged").length
  return (
    <>
      <WorkbenchPage
        header={{
          screenId: "FX-MM-DUPES",
          title: "Duplicate merge queue",
          description: "Candidates the matching job found. Compare, choose the survivor, and either record that they are different parts or merge: references are rewritten, stock moves to the survivor, and the other material becomes a supersession.",
          chips: <Reading id="RD-MM-37" />,
          actions: <Button variant="outline" asChild><Link to="/materials/supersessions">Supersessions</Link></Button>,
        }}
        kpis={[
          { label: "Open candidates", value: s.x.dupes.filter((d) => !d.decision).length },
          { label: "Auto-flagged", value: s.x.dupes.filter((d) => !d.decision && d.score >= 0.97).length, hint: "Score 0.97 and above" },
          { label: "Merged", value: merged },
          { label: "Marked not a duplicate", value: s.x.dupes.filter((d) => d.decision?.kind === "Not a duplicate").length },
        ]}
        queues={QUEUES.map((q) => ({ ...q, count: all.filter((d) => (q.id === "open" ? !d.decision : q.id === "auto" ? !d.decision && d.score >= 0.97 : q.id === "not" ? d.decision?.kind === "Not a duplicate" : d.decision?.kind === "Merged")).length }))}
        queue={queue}
        onQueueChange={setQueue}
        table={{
          rows,
          columns: cols,
          rowId: (d) => d.id,
          onRowClick: (d) => open(d.id),
          activeId: openId ?? undefined,
          searchText: (d) => `${d.id} ${d.aId} ${d.bId} ${d.basis}`,
          searchPlaceholder: "Search candidate, material, basis",
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          densityKey: "FX-MM-DUPES",
          empty: { title: queue === "open" ? "No duplicate candidates" : "Nothing here yet", body: queue === "open" ? "The matching job found no pair above 0.9." : "Decided candidates appear in this queue." },
          initialSort: { id: "score", dir: "desc" },
        }}
        panel={{
          open: !!cand,
          onOpenChange: (o) => !o && setOpenId(null),
          title: cand ? `${cand.id}: ${cand.aId} and ${cand.bId}` : "Candidate",
          description: cand ? `Score ${cand.score.toFixed(2)}. ${cand.basis}` : undefined,
          content: cand && ua && ub && (
            <div className="flex flex-col gap-4 p-4">
              {st.banners}
              {cand.decision && (
                <p role="status" className="rounded-md border px-3 py-2 text-sm">
                  <FamilyBadge family={cand.decision.kind === "Merged" ? "done" : "active"} label={cand.decision.kind} size="sm" /> by {userName(cand.decision.by)} on {cand.decision.on}. {cand.decision.note}
                  {cand.decision.supersessionId && <> Supersession <Link className="text-link underline-offset-4 hover:underline" to={R.sup(cand.decision.supersessionId)}>{cand.decision.supersessionId}</Link>.</>}
                  <span className="block text-xs text-muted-foreground">A decided candidate is read-only. A mistake is corrected by a new supersession, never by editing this decision.</span>
                </p>
              )}
              <CompareTable aId={cand.aId} bId={cand.bId} />
              <div className="grid gap-3 md:grid-cols-2">
                <Usage id={cand.aId} u={ua} />
                <Usage id={cand.bId} u={ub} />
              </div>
              {!cand.decision && (
                <>
                  <Section title="Survivor">
                    <RadioGroup value={surv} onValueChange={setSurvivor} className="gap-2" aria-label="Survivor">
                      {[cand.aId, cand.bId].map((id) => {
                        const m = getMaterial(s, id)
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <RadioGroupItem id={`sv-${id}`} value={id} />
                            <Label htmlFor={`sv-${id}`} className="flex flex-wrap items-center gap-2 font-normal">
                              <span className="font-mono">{id}</span>
                              {m && <TypeBadge type={m.type} />}
                              {m && <MaterialStatus m={m} />}
                            </Label>
                          </div>
                        )
                      })}
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">{loser} would become Restricted and be superseded by {surv}. The survivor must be Active.</p>
                  </Section>
                  <Section title={`Reference-rewrite worklist (${worklist.length})`}>
                    {worklist.length === 0 ? (
                      <EmptyState title="Nothing references the other material">The merge only records the supersession.</EmptyState>
                    ) : (
                      <Table>
                        <TableHeader className="bg-table-head"><TableRow><TableHead>Reference</TableHead><TableHead>Kind</TableHead><TableHead>Action</TableHead><TableHead>Done by</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {worklist.map((w, i) => (
                            <TableRow key={i}><TableCell className="font-mono">{w.ref}</TableCell><TableCell>{w.kind}</TableCell><TableCell>{w.action}</TableCell><TableCell>{w.auto ? "The merge" : "Task for its owner"}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <p className="text-xs text-muted-foreground">BOM lines are rewritten through ECO tasks, price rows are re-keyed with approval, info records merge keeping the better basis, stock transfers batch by batch with a genealogy continuity event [Book IV §7.1].</p>
                  </Section>
                  {blockers.length > 0 && (
                    <Section title={`Merge blocked by ${blockers.length} unresolved reference(s)`} className="border-status-blocked">
                      <ul className="flex flex-col gap-1 text-sm">
                        {blockers.map((b, i) => (
                          <li key={i}><span className="font-mono">{b.ref}</span>: {b.text}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="destructive" disabled={!st.canWrite || blockers.length > 0} title={st.blockedWhy ?? (blockers.length ? "Resolve the blockers first" : undefined)} onClick={() => setDlg("merge")}>
                      Merge into {surv}
                    </Button>
                    <Button variant="outline" disabled={!st.canWrite} title={st.blockedWhy} onClick={() => setDlg("not")}>
                      Not a duplicate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Acting as {role}. Merging and deciding are the steward's call (Material steward or Materials Manager).</p>
                </>
              )}
            </div>
          ),
        }}
      />
      {cand && (
        <>
          <DialogShell
            open={dlg === "not"}
            onOpenChange={(o) => !o && setDlg(null)}
            title={`Not a duplicate: ${cand.aId} and ${cand.bId}`}
            consequence={`${cand.id} leaves the queue and the pair is not offered again. Both materials stay as they are.`}
            requireReason
            reasonLabel="Not a duplicate because..."
            confirmLabel="Record decision"
            confirmDisabled={!st.canWrite}
            onConfirm={(note) => (st.canWrite ? confirmRun(decideNotDuplicate(cand.id, note), `${cand.id} marked not a duplicate`) : (st.blockedWhy ?? "Blocked"))}
          />
          <DialogShell
            open={dlg === "merge"}
            onOpenChange={(o) => (!o && setDlg(null), !o && setTyped(""))}
            title={`Merge ${loser} into ${surv}`}
            description="This cannot be undone."
            consequence={`${loser} becomes Restricted and is superseded by ${surv} (a supersession is created, run-out starts). ${worklist.filter((w) => w.auto).length} reference(s) are rewritten now and ${worklist.filter((w) => !w.auto).length} task(s) go to their owners. Stock moves to ${surv} with a genealogy continuity event.`}
            destructive
            confirmLabel="Merge materials"
            confirmDisabled={!st.canWrite || typed.trim().toUpperCase() !== "MERGE"}
            onConfirm={() => (st.canWrite ? confirmRun(mergeDuplicates(cand.id, surv, typed), (id) => `Merged: ${id} created`) : (st.blockedWhy ?? "Blocked"))}
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="merge-typed">Type MERGE to confirm</Label>
              <Input id="merge-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-invalid={st.validation && typed.trim().toUpperCase() !== "MERGE" ? true : undefined} />
              {st.validation && <p className="text-xs text-destructive">Type MERGE to confirm: a merge cannot be undone.</p>}
            </div>
          </DialogShell>
        </>
      )}
      <RulesPanel
        rules={[
          ["§7.1", "Duplicate candidates: trigram similarity on description and manufacturer part within group L1; at or above 0.9 is reviewed, at or above 0.97 is flagged automatically.", "[Book IV §7.1]"],
          ["§7.1 merge", "A merge is a supersession specialization: usage counts, a survivor, a reference-rewrite worklist and an irreversible-merge confirmation. Unresolvable references block it.", "[Book IV §7.1]"],
          ["V-MM-02", "Material type and base UoM are immutable, so a pair that differs in either cannot merge.", "[Book II §2.1]"],
        ]}
      />
    </>
  )
}
