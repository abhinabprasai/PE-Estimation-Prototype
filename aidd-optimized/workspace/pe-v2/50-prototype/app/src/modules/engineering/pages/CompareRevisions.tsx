// FX-ENG-COMPARE Compare revisions view (Detail, design value) [DOC:p.61 §3.3 Compare Revisions].
// Side-by-side rev diff: added (green), removed (red), changed (amber), exportable: the change-evidence
// document for ECO review. Any two revisions of EBOMs that share a parent item can be compared, so a
// variant can be read against its base design as well as a revision against its predecessor.

import { useMemo } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { NoPostings } from "../components"
import { RevisionCompare } from "../RevisionCompare"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { revisionPool } from "../data/logic"

export function CompareRevisions() {
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-COMPARE")
  const [params, setParams] = useSearchParams()
  const ebomId = params.get("ebom") ?? "EBOM-TBD-0301"
  const e = s.eboms.find((x) => x.id === ebomId) ?? s.eboms[0]
  const pool = useMemo(() => revisionPool(s, e?.parentItemId), [s, e?.parentItemId])
  const cur = pool.find((o) => o.key === `${e?.id}@${e?.rev}`)
  const prior = e?.priorRevs[0] ? pool.find((o) => o.key === `${e.id}@${e.priorRevs[0].rev}`) : pool.find((o) => o.key !== cur?.key)
  const fromKey = params.get("from") ?? prior?.key ?? ""
  const toKey = params.get("to") ?? cur?.key ?? ""
  const set = (k: string, v: string) => {
    params.set(k, v)
    setParams(params, { replace: true })
  }
  const parents = [...new Set(s.eboms.filter((x) => x.usage !== "Sales").map((x) => x.parentItemId))]
  const empty = st.empty || !e
  return (
    <ScreenFrame st={st} what="Compare revisions" who="Engineers, the Engineering Manager, production, purchasing and quality read released EBOM revisions" source="DOC:p.67 §7" text={{ readonly: "Released revisions are immutable (C-14); this view only reads them.", degraded: "The revision history is served from the last snapshot; a revision released in the last few minutes may be missing." }}>
      <DetailPage
        header={{
          title: "Compare revisions",
          screenId: "FX-ENG-COMPARE",
          crumbs: [{ label: "EBOMs", to: "/engineering/boms" }, { label: "Compare revisions" }],
          description: "Pick two revisions of EBOMs for the same parent item. This is the change-evidence document for ECO review.",
          actions: <StatePreviewAll st={st} />,
          primary: e && <Button asChild><Link to={`/engineering/boms/${e.id}`}>Open {e.id} in the editor</Link></Button>,
        }}
        summary={
          e && !empty ? (
            <>
              <KV k="Parent item"><span className="font-mono">{e.parentItemId}</span></KV>
              <KV k="Subject EBOM">
                <Select value={e.id} onValueChange={(v) => { params.set("ebom", v); params.delete("from"); params.delete("to"); setParams(params, { replace: true }) }}>
                  <SelectTrigger size="sm" className="w-56" aria-label="EBOM"><SelectValue /></SelectTrigger>
                  <SelectContent>{parents.flatMap((p) => s.eboms.filter((x) => x.parentItemId === p && x.usage !== "Sales").map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {p}</SelectItem>))}</SelectContent>
                </Select>
              </KV>
              <KV k="Current status"><StatusBadge kind="ebom" status={e.status} size="sm" /></KV>
              <KV k="Revisions available">{pool.length}</KV>
            </>
          ) : undefined
        }
        tabs={[
          {
            id: "diff", label: "Differences",
            content: empty ? <EmptyState title="No EBOM to compare">Create or release an EBOM first.</EmptyState> : <RevisionCompare options={pool} fromKey={fromKey} toKey={toKey} onFrom={(k) => set("from", k)} onTo={(k) => set("to", k)} disabled={st.offline} />,
          },
          {
            id: "history", label: "Revision history", count: e ? e.priorRevs.length + 1 : 0,
            content: e && !empty ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Rev</TableHead><TableHead>Status</TableHead><TableHead>Released</TableHead><TableHead>Superseded</TableHead><TableHead>Reason for the change</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow className="h-8 text-[13px]"><TableCell className="font-mono">{e.rev}</TableCell><TableCell><StatusBadge kind="ebom" status={e.status} size="sm" /></TableCell><TableCell>{e.releasedOn ? fmtDate(e.releasedOn) : ""}</TableCell><TableCell /><TableCell>{e.baseDesign ?? "Current revision"}</TableCell></TableRow>
                    {e.priorRevs.map((r) => <TableRow key={r.rev} className="h-8 text-[13px]"><TableCell className="font-mono">{r.rev}</TableCell><TableCell><StatusBadge kind="ebom" status={r.status} size="sm" /></TableCell><TableCell>{fmtDate(r.releasedOn)}</TableCell><TableCell>{fmtDate(r.supersededOn)}</TableCell><TableCell>{r.reason}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
            ) : <EmptyState title="No history" />,
          },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={[
        ["Compare Revisions", "Side-by-side rev diff: added (green), removed (red), changed qty/fields (amber); exportable; the change-evidence document for ECO review", "DOC:p.61 §3.3"],
        ["C-14", "A Released revision is immutable; a change is a new revision through an ECO", "DOC:p.61 §3.4"],
        ["Find #", "Find # is stable across edits, so rows are matched on it", "DOC:p.60 §3.2"],
      ]} />
    </ScreenFrame>
  )
}
