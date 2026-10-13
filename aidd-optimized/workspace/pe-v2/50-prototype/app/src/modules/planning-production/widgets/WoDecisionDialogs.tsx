// FX-PRD-WODIALOGS: the production order decision dialogs, one component for every host (the
// PP-WO-002 detail page, the dialog page at /production/dialogs/wo-decisions).
// PRD facts: Release Short is the Planner's flag [DOC:p.74 §5.2 check 2]; On Hold needs a reason;
// cancellation dispositions finish / stop-scrap / hold, collected cost to scrap per Controller
// decision [DOC:p.179 FL-04 f11; p.75 §5.3]; close preconditions [DOC:p.78 §8.2]; reopen needs the
// Controller and reverses the settlement JE first [DOC:p.78 §8.2]; confirmation corrections carry a
// dual sign-off [DOC:p.215 §7.2]. The second signer's role and the Stop-scrap role gate are readings.

import { useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { ApprovalButton, Chip, PostingPreview } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { RefLink, useActDialog } from "../components"
import * as act from "../lib/actions"
import * as ext from "../lib/actions-ext"
import { closeChecks, shortages } from "../lib/gates"
import { woWip } from "../lib/plan"
import type { CancelDisposition, PPWorkOrder } from "../data/types"

export type WoDecisionKind = "releaseShort" | "hold" | "reversalRequest" | "reversalSign" | "soCancel" | "cancelCost" | "close" | "reopen"

export const WO_DECISION_META: { kind: WoDecisionKind; title: string; role: string; source: string; blurb: string }[] = [
  { kind: "releaseShort", title: "Release Short", role: "Planner", source: "DOC:p.74 §5.2 check 2", blurb: "Lets a Created order release with a component shortage; the Shortage badge shows and the short items go to the Expedite Board." },
  { kind: "hold", title: "Hold", role: "any role (reason mandatory)", source: "DOC:p.74 §5.3", blurb: "Stops terminal work on the order; the dispatch list flags it. The reason is mandatory." },
  { kind: "reversalRequest", title: "Confirmation reversal: request", role: "Production supervisor", source: "DOC:p.179 FL-04 f11; p.215 §7.2", blurb: "A supervisor asks to reverse the latest confirmation; nothing posts until a second person signs." },
  { kind: "reversalSign", title: "Confirmation reversal: second sign-off", role: "Scheduler, Planning Manager, Cost accountant, Controller or Quality Manager (reading), never the requester", source: "DOC:p.215 §7.2", blurb: "The second signer posts the mirror entries or rejects with a note." },
  { kind: "soCancel", title: "SO-cancellation disposition", role: "Planner or Production Scheduler (Controller for Stop-scrap with WIP)", source: "DOC:p.179 FL-04 f11", blurb: "When a sales order is cancelled, each pegged production order is finished, stopped and scrapped, or held." },
  { kind: "cancelCost", title: "WO cancel: collected cost", role: "Controller", source: "DOC:p.75 §5.3", blurb: "Shows the WIP the cancelled order carries and posts it to scrap per Controller decision." },
  { kind: "close", title: "Close preconditions", role: "Cost accountant (settlement)", source: "DOC:p.78 §8.2", blurb: "The four checks that must pass before Settle and close; the failing one is named." },
  { kind: "reopen", title: "Settled reopen with JE-reversal preview", role: "Controller approves", source: "DOC:p.78 §8.2", blurb: "A Closed (TECO) order reopens only after the Controller approves; the settlement entry is reversed first." },
]

/** A small gate list used by the close dialog. */
function Checks({ rows }: { rows: { name: string; ok: boolean; detail?: string }[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map((c) => (
        <li key={c.name} className="flex items-center gap-2">
          {c.ok ? <CheckCircle2 className="size-4 text-status-passed-ink" aria-label="Pass" /> : <XCircle className="size-4 text-status-cancelled-ink" aria-label="Fail" />}
          {c.name}
          {c.detail ? ` (${c.detail})` : ""}
        </li>
      ))}
    </ul>
  )
}

export function WoDecisionDialog({ kind, wo, cnfId, requestId, open, onOpenChange }: { kind: WoDecisionKind; wo?: PPWorkOrder; cnfId?: string; requestId?: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSlice("planningProduction")
  const [role] = useRole()
  const runD = useActDialog()
  const [disp, setDisp] = useState<CancelDisposition>("Stop-scrap")
  const [note, setNote] = useState("")
  const close = (o: boolean) => {
    if (!o) setNote("")
    onOpenChange(o)
  }
  const req = s.reversalRequests.find((r) => r.id === requestId)
  const cnf = s.confirmations.find((c) => c.id === (cnfId ?? req?.cnfId))
  const w = wo ?? s.productionOrders.find((x) => x.id === (cnf?.woId ?? req?.woId))
  if (!w) return null
  const wip = woWip(s, w.id)
  const hasCost = Math.abs(wip.total) > 0.005

  if (kind === "releaseShort") {
    const short = shortages(s, w)
    return (
      <DialogShell open={open} onOpenChange={close} title={`Release Short for ${w.id}`} confirmLabel="Set Release Short flag" requireReason reasonLabel="Why release with shortages (recorded on the order)"
        consequence={`${w.id} may release although ${short.length} component(s) are short. It carries the Shortage badge, and the short items go to the PO Expedite Board (planning.expediteRequested). Planner only.`}
        onConfirm={(r) => runD((d, c) => act.setReleaseShort(d, c, w.id, true, r), "Release Short flag set")}>
        {short.length === 0 ? <p className="text-sm text-muted-foreground">No component is short today: the standard release check passes, so the flag is not needed.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {short.map((x) => <li key={x.materialId} className="tabular"><span className="font-mono">{x.materialId}</span> need {x.need}, available {x.available}, short {x.short}{x.supplyDate ? `; supply ${x.supply} on ${fmtDate(x.supplyDate as never)}` : "; no supply"}</li>)}
          </ul>
        )}
        {role !== "Planner" && <p role="status" className="text-sm text-status-pending-ink">You are acting as {role}. Only the Planner sets this flag; confirming will be refused.</p>}
      </DialogShell>
    )
  }
  if (kind === "hold")
    return (
      <DialogShell open={open} onOpenChange={close} title={`Hold ${w.id}`} confirmLabel="Put On Hold" requireReason reasonLabel="Reason (mandatory)"
        consequence={`${w.id} goes ${w.status} → On Hold. Terminal operations stop and the dispatch list flags it; Release hold returns it to ${w.status}.`}
        onConfirm={(r) => runD((d, c) => act.holdWo(d, c, w.id, r), `${w.id} On Hold`)} />
    )
  if (kind === "reversalRequest") {
    const block = cnf ? ext.reversalBlock(s, cnf.id) : "Choose a confirmation."
    const lines = s.journal.filter((j) => j.cnfId === cnf?.id && !j.reverses)
    return (
      <DialogShell open={open} onOpenChange={close} title={`Request reversal of ${cnf?.id ?? "a confirmation"}`} confirmLabel="Request second sign-off" requireReason reasonLabel="Reason for the correction" confirmDisabled={!!block}
        consequence={`Mirror entries post only when a second person signs. Until then ${w.id} is unchanged and the request is visible on this order and on the decision page.`}
        onConfirm={(r) => runD((d, c) => cnf && ext.requestReversal(d, c, cnf.id, r), "Reversal requested: waiting for the second sign-off")}>
        {block && <p role="alert" className="text-sm text-destructive">{block}</p>}
        {cnf && <p className="tabular text-sm">{cnf.id}: op {cnf.op}, good {cnf.good}, scrap {cnf.scrap}, rework {cnf.rework}, {cnf.hours} h on {fmtDate(cnf.at)}</p>}
        {lines.length > 0 && <PostingPreview title="Mirror postings if signed" lines={lines.map((j) => ({ template: j.template as 28, amount: -j.amount, detail: `reverses ${j.id}` }))} />}
        {role !== "Production supervisor" && <p role="status" className="text-sm text-status-pending-ink">You are acting as {role}. A supervisor requests the correction.</p>}
      </DialogShell>
    )
  }
  if (kind === "reversalSign") {
    const lines = s.journal.filter((j) => j.cnfId === req?.cnfId && !j.reverses)
    return (
      <DialogShell open={open} onOpenChange={close} title={`Second sign-off on ${req?.id ?? ""}`} confirmLabel="Sign and post reversal"
        consequence={`Signing posts the mirror entries for ${req?.cnfId}, writes a reversal confirmation and returns the operation to In Progress. It cannot be undone except by confirming again.`}
        onConfirm={() => runD((d, c) => ext.decideReversal(d, c, req!.id, true, note), "Signed: reversal posted")}
        secondary={<Button variant="outline" onClick={() => {
          const e = runD((d, c) => ext.decideReversal(d, c, req!.id, false, note), "Reversal rejected")
          if (e === null) close(false)
        }}>Reject</Button>}>
        {req && <p className="text-sm">{req.requestedBy} asked on {fmtDate(req.requestedOn)}: {req.reason}</p>}
        <div className="grid gap-1">
          <Label htmlFor="rv-note">Note (required to reject)</Label>
          <Textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {lines.length > 0 && <PostingPreview title="Mirror postings" lines={lines.map((j) => ({ template: j.template as 28, amount: -j.amount, detail: `reverses ${j.id}` }))} />}
        <p className="text-xs text-muted-foreground">Different person than the requester. <Chip kind="design" note="The PRD says dual sign-off but names no second role">Reading</Chip></p>
      </DialogShell>
    )
  }
  if (kind === "soCancel" || kind === "cancelCost") {
    const eff: CancelDisposition = kind === "cancelCost" ? "Stop-scrap" : disp
    const label = eff === "Stop-scrap" ? "Stop and scrap" : eff === "Finish" ? "Finish to stock" : "Put On Hold"
    return (
      <DialogShell open={open} onOpenChange={close} wide title={kind === "cancelCost" ? `Cancel ${w.id}: collected cost` : `Sales order cancelled: disposition for ${w.id}`} confirmLabel={label} destructive={eff === "Stop-scrap"} requireReason reasonLabel={kind === "soCancel" ? "Why (the SO cancellation reference)" : "Why the order is cancelled"}
        consequence={eff === "Stop-scrap"
          ? `${w.id} becomes Cancelled (terminal) and open operations are cancelled. ${hasCost ? `${fmtMoney(wip.total)} of collected cost posts to 5320 per Controller decision.` : "No cost is collected."} Reserved serials return to Available.`
          : eff === "Finish" ? `${w.id} is unpegged from ${w.pegs.map((g) => g.soId).join(", ") || "its sales order"} and runs to completion into FG stock.` : `${w.id} goes On Hold: SO cancellation pending disposition.`}
        onConfirm={(r) => runD((d, c) => act.cancelWo(d, c, w.id, eff, r), eff === "Stop-scrap" ? `${w.id} cancelled` : eff === "Finish" ? `${w.id} unpegged; finishes to stock` : `${w.id} On Hold`)}>
        {kind === "soCancel" && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-semibold">Disposition</legend>
            <RadioGroup value={disp} onValueChange={(v) => setDisp(v as CancelDisposition)}>
              {([["Finish", "Finish: complete the unit into stock, unpegged", w.status === "Created" || !w.pegs.length], ["Stop-scrap", "Stop-scrap: cancel now; collected cost to scrap", false], ["Hold", "Hold: On Hold until the disposition is decided", w.status === "On Hold"]] as const).map(([v, l, dis]) => (
                <label key={v} className="flex items-center gap-2"><RadioGroupItem value={v} aria-label={l} disabled={dis} />{l}</label>
              ))}
            </RadioGroup>
          </fieldset>
        )}
        <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {([["Material issued (#28)", wip.material], ["Labor and overhead (#29)", wip.labor], ["Subcontract (#35)", wip.subcontract], ["WIP balance", wip.total]] as const).map(([k, v]) => (
            <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{fmtMoney(v)}</dd></div>
          ))}
        </dl>
        {eff === "Stop-scrap" && hasCost && <PostingPreview lines={[{ template: 30, amount: wip.total, detail: "Residual WIP to scrap per Controller decision" }]} />}
        {eff === "Stop-scrap" && hasCost && role !== "Controller" && <p role="status" className="text-sm text-status-pending-ink">You are acting as {role}. Collected cost settles to scrap per Controller decision: switch Acting as to Controller.</p>}
      </DialogShell>
    )
  }
  if (kind === "close") {
    const checks = closeChecks(s, w)
    return (
      <DialogShell open={open} onOpenChange={close} title={`Close ${w.id}: preconditions`} confirmLabel="Settle and close" confirmDisabled={!checks.every((c) => c.ok) || w.status !== "Completed"}
        consequence={w.status === "Completed" ? `Posts #32 to clear the WIP balance (${fmtMoney(wip.total)}) to the variance accounts and sets ${w.id} to Closed (TECO).` : `${w.id} is ${w.status}: only a Completed order closes.`}
        onConfirm={() => runD((d, c) => act.settleOrders(d, c, [w.id]), (sid) => `${sid} posted; ${w.id} Closed (TECO)`)}>
        <Checks rows={checks} />
        <p className="text-xs text-muted-foreground">Settlement is run by the Cost accountant, who must not have confirmed the order [DOC:p.263; p.179 f3].</p>
      </DialogShell>
    )
  }
  // reopen
  const st = s.settlements.find((x) => x.id === w.settlementId)
  const row = st?.orders.find((o) => o.woId === w.id)
  const je = s.journal.find((j) => j.id === row?.journalId)
  return (
    <DialogShell open={open} onOpenChange={close} wide title={`Reopen ${w.id}`} confirmLabel="Close preview" onConfirm={() => null}
      consequence={`Reopening is a Controller approval through WF-INBOX. When approved, the settlement entry ${je?.id ?? ""} is reversed first, then ${w.id} goes Closed (TECO) → Completed so costs can be corrected.`}
      secondary={w.status === "Closed (TECO)" ? <ApprovalButton kind="WO reopen" subject={{ type: "productionOrder", id: w.id }} title={`${w.id} reopen (reverses settlement ${w.settlementId ?? ""})`} label="Request reopen (Controller)" variant="default" stay /> : undefined}>
      {w.status !== "Closed (TECO)" && <p role="status" className="text-sm text-status-pending-ink">{w.id} is {w.status}: only a settled order (Closed (TECO)) can be reopened.</p>}
      {je ? (
        <>
          <p className="text-sm">Settlement <RefLink r={{ type: "settlement" as never, id: st!.id }}>{st!.id}</RefLink> posted {fmtDate(st!.postedOn)} by {st!.by}. Entry {je.id}: {je.detail}</p>
          <PostingPreview title="Reversal that posts before reopening" lines={[{ template: 32, amount: -je.amount, detail: `reverses ${je.id}; WIP returns by ${fmtMoney(-je.wip1320)}` }]} />
        </>
      ) : <p className="text-sm text-muted-foreground">No settlement entry is on file for this order.</p>}
    </DialogShell>
  )
}
