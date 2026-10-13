// FX-CAD-COMPARE CAD vs EBOM structure comparison (Detail, design value) [DOC:p.198 §3 Structure
// comparison; DOC:p.259]. The vault assembly is compared with the ERP EBOM on demand: lines added in
// CAD, removed from CAD, quantity changed. The ERP EBOM is never rewritten by the connector: a
// Draft EBOM takes the extraction as an import proposal (CAD-IMP, engineer confirmed); a Released EBOM
// needs an ECR for any structural change (C-14); or the engineer records that no change is needed.

import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { DlgFrame } from "../DlgFrame"
import { NoPostings, RefLink, useAct, useActDialog } from "../components"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { cadDiff, userName, type CadDiffRow } from "../data/logic"
import * as act from "../data/actions"

const TINT: Record<CadDiffRow["kind"], string> = { "Added in CAD": "bg-status-passed-tint", "Removed from CAD": "bg-destructive/10", "Qty changed": "bg-status-pending-tint", Same: "" }

export function CadCompare() {
  const s = useSlice("engineering")
  const st = useStates("FX-CAD-COMPARE")
  const run = useAct()
  const runD = useActDialog()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [dlg, setDlg] = useState(false)
  const [onlyDiff, setOnlyDiff] = useState(true)
  const asmId = params.get("asm") ?? s.cad[0]?.id
  const asm = s.cad.find((c) => c.id === asmId)
  const e = asm ? s.eboms.find((x) => x.id === asm.ebomId) : undefined
  const rows = useMemo(() => (asm && e && !st.empty ? cadDiff(e, asm) : []), [asm, e, st.empty])
  const n = (k: CadDiffRow["kind"]) => rows.filter((r) => r.kind === k).length
  const diffs = rows.length - n("Same")
  const shown = onlyDiff ? rows.filter((r) => r.kind !== "Same") : rows
  const behind = !!asm && asm.vaultRev !== asm.alignedRev
  const writable = !st.offline && !st.readonly && !st.degraded
  const draft = e?.status === "Draft"
  const stage = () => {
    if (!asm) return
    const r = run((x, c) => act.stageAssembly(x, c, asm.id), "Extraction staged as an import proposal")
    if (r.ok && e) nav(`/engineering/boms/${e.id}/import`)
  }
  return (
    <ScreenFrame st={st} what="CAD vs EBOM comparison" who="Engineers and the Engineering Manager read the comparison; the connector service account writes assemblies" source="DOC:p.198 §3"
      text={{ degraded: "The vault extraction is from the last delivered event (IF-17 is behind), so CAD may be newer than shown. Actions that depend on it are disabled until the connector recovers.", readonly: "Read-only: the comparison can be read and exported, but not acted on.", conflict: "The EBOM changed after you opened this comparison (another engineer committed an import). Reload to compare against the current structure." }}>
      <DetailPage
        header={{
          title: "CAD vs EBOM structure comparison",
          screenId: "FX-CAD-COMPARE",
          crumbs: [{ label: "CAD sync", to: "/engineering/cad-sync" }, { label: "Structure comparison" }],
          description: "The vault assembly set against the ERP EBOM, line by line, matched on material code. The connector never rewrites an EBOM: you decide what to bring across.",
          actions: <StatePreviewAll st={st} />,
          primary: asm && e ? (draft ? <Button disabled={!writable || diffs === 0} title={diffs === 0 ? "The structures already match" : undefined} onClick={stage}>Stage as import proposal</Button> : <Button disabled={!writable || diffs === 0} title={diffs === 0 ? "The structures already match" : undefined} onClick={() => nav(`/engineering/change-requests/new?affected=ebom:${e.id}`)}>Raise ECR for the difference</Button>) : undefined,
        }}
        status={e ? { kind: "ebom", value: e.status } : undefined}
        doc={e ? { type: "ebom", id: e.id } : undefined}
        summary={
          asm && e && !st.empty ? (
            <>
              <KV k="Vault assembly">
                <Select value={asm.id} onValueChange={(v) => { params.set("asm", v); setParams(params, { replace: true }) }}>
                  <SelectTrigger size="sm" className="w-56" aria-label="Vault assembly"><SelectValue /></SelectTrigger>
                  <SelectContent>{s.cad.map((c) => <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>)}</SelectContent>
                </Select>
              </KV>
              <KV k="ERP EBOM"><RefLink r={{ type: "ebom", id: e.id }} /> rev {e.rev} <StatusBadge kind="ebom" status={e.status} size="sm" /></KV>
              <KV k="Vault revision">{asm.vaultRev} (aligned at {asm.alignedRev}) {behind ? <Chip kind="flag" note="The vault is ahead of the revision the ERP structure was last aligned with">CAD ahead</Chip> : <Chip kind="design" note="No newer vault revision since the last alignment">In step</Chip>}</KV>
              <KV k="Last check-in">{asm.checkedInAt} · {asm.vaultTx}</KV>
              <KV k="Differences">{diffs} ({n("Added in CAD")} added, {n("Removed from CAD")} removed, {n("Qty changed")} quantity)</KV>
            </>
          ) : undefined
        }
        tabs={[
          {
            id: "diff", label: "Structure", count: diffs,
            content:
              !asm || !e || st.empty ? (
                <EmptyState title="No vault assembly to compare">An assembly appears here after the connector extracts one for an EBOM (CAD-SYNC).</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDiff} onChange={(ev) => setOnlyDiff(ev.target.checked)} />Only differences</label>
                    <Button variant="outline" size="sm" disabled={!writable} onClick={() => setDlg(true)}>{asm.reviewed ? "Review again" : "Mark reviewed, no change needed"}</Button>
                    <Button variant="ghost" size="sm" asChild><Link to="/engineering/cad-sync">Open the sync monitor</Link></Button>
                  </div>
                  {asm.reviewed && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Reviewed by {userName(asm.reviewed.by)} on {asm.reviewed.on}: {asm.reviewed.note}</p>}
                  {!draft && diffs > 0 && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">{e.id} is {e.status}: it cannot be edited (C-14). A structural difference goes through an ECR; a difference that needs no change is recorded with a note.</p>}
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-table-head"><TableRow><TableHead>Difference</TableHead><TableHead>Material code</TableHead><TableHead>Description</TableHead><TableHead className="text-right">ERP qty</TableHead><TableHead className="text-right">CAD qty</TableHead><TableHead className="text-right">ERP find #</TableHead><TableHead className="text-right">CAD find #</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {shown.map((r) => (
                          <TableRow key={r.key} className={cn("h-8 text-[13px]", TINT[r.kind])}>
                            <TableCell className="font-medium">{r.kind}</TableCell>
                            <TableCell className="font-mono">{r.partNo || "(no code: placeholder)"}</TableCell>
                            <TableCell>{r.description}</TableCell>
                            <TableCell className="text-right font-mono">{r.erpQty != null ? fmtNumber(r.erpQty, 2) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{r.cadQty != null ? fmtNumber(r.cadQty, 2) : ""}</TableCell>
                            <TableCell className="text-right font-mono">{r.erpLine ?? ""}</TableCell>
                            <TableCell className="text-right font-mono">{r.cadLine ?? ""}</TableCell>
                          </TableRow>
                        ))}
                        {!shown.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">The vault assembly and the EBOM match line for line.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">Each difference is named in words as well as tinted. Rows are matched on material code; the Find # of each side is shown for reference.</p>
                </div>
              ),
          },
          {
            id: "all", label: "All assemblies", count: s.cad.length,
            content: (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Assembly</TableHead><TableHead>EBOM</TableHead><TableHead>Vault rev</TableHead><TableHead>Aligned rev</TableHead><TableHead>Differences</TableHead><TableHead>Reviewed</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {s.cad.map((c) => {
                      const eb = s.eboms.find((x) => x.id === c.ebomId)
                      const d = eb ? cadDiff(eb, c).filter((r) => r.kind !== "Same").length : 0
                      return (
                        <TableRow key={c.id} className="h-8 text-[13px]">
                          <TableCell><button className="font-mono text-link underline-offset-4 hover:underline" onClick={() => { params.set("asm", c.id); setParams(params, { replace: true }) }}>{c.id}</button></TableCell>
                          <TableCell className="font-mono">{c.ebomId}</TableCell>
                          <TableCell className="font-mono">{c.vaultRev}</TableCell>
                          <TableCell className="font-mono">{c.alignedRev}</TableCell>
                          <TableCell>{d === 0 ? "None" : `${d} line${d === 1 ? "" : "s"}`}</TableCell>
                          <TableCell>{c.reviewed ? `Yes, ${c.reviewed.on}` : "No"}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ),
          },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={[
        ["Structure comparison", "The vault assembly is compared with the ERP EBOM: added, removed and quantity-changed lines; the engineer decides what is imported", "DOC:p.198 §3"],
        ["C-14", "A Released EBOM is immutable: a structural difference needs an ECR", "DOC:p.61 §3.4"],
        ["IF-17", "The PDM connector is mocked in the prototype; assemblies are seeded", "ASM-EXT-1"],
      ]} />
      {asm && <ReviewDialog open={dlg} onOpenChange={setDlg} asmId={asm.id} runD={runD} />}
    </ScreenFrame>
  )
}

function ReviewDialog({ open, onOpenChange, asmId, runD }: { open: boolean; onOpenChange: (o: boolean) => void; asmId: string; runD: ReturnType<typeof useActDialog> }) {
  const [note, setNote] = useState("")
  return (
    <DlgFrame
      open={open} onOpenChange={onOpenChange} title={`Record review of ${asmId}`} confirmLabel="Record review"
      consequence="Clears the CAD ahead flag on the EBOM and records who reviewed it and why no change is needed. No line is changed."
      onConfirm={() => {
        const e = runD((x, c) => act.reviewCad(x, c, asmId, note), "Review recorded; CAD ahead cleared")
        if (!e) { setNote(""); onOpenChange(false) }
        return e
      }}
    >
      <Label htmlFor="cad-note">Why no structure change is needed</Label>
      <Textarea id="cad-note" value={note} onChange={(e) => setNote(e.target.value)} />
    </DlgFrame>
  )
}
