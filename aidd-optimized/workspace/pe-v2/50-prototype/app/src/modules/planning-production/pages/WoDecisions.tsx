// FX-PRD-WODIALOGS: the production order decision dialogs at /production/dialogs/wo-decisions.
// Each dialog is the same component the PP-WO-002 detail page opens (widgets/WoDecisionDialogs.tsx).
// This page lets a planner or supervisor open any of them against an eligible order, shows the
// reversal requests waiting for a second sign-off, and lists the states each dialog handles.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, EmptyState, RulesPanel } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { StateBanner, StatePreview, WoLink, matDesc, useScreenState } from "../components"
import * as act from "../lib/actions"
import * as ext from "../lib/actions-ext"
import { shortages } from "../lib/gates"
import { woWip } from "../lib/plan"
import { WO_DECISION_META, WoDecisionDialog, type WoDecisionKind } from "../widgets/WoDecisionDialogs"
import type { PPWorkOrder, PlanningProductionState } from "../data/types"

/** Orders on which each decision can be taken today. */
function eligible(s: PlanningProductionState, kind: WoDecisionKind): PPWorkOrder[] {
  const open = s.productionOrders.filter((w) => act.isOpenWo(w))
  switch (kind) {
    case "releaseShort": return s.productionOrders.filter((w) => w.status === "Created" && shortages(s, w).length > 0)
    case "hold": return open.filter((w) => ["Created", "Released", "In Progress", "Testing"].includes(w.status))
    case "reversalRequest": return open.filter((w) => s.confirmations.some((c) => c.woId === w.id && !ext.reversalBlock(s, c.id)))
    case "reversalSign": return s.productionOrders.filter((w) => s.reversalRequests.some((r) => r.woId === w.id && r.status === "Awaiting second sign-off"))
    case "soCancel": return open.filter((w) => w.pegs.length > 0)
    case "cancelCost": return open.filter((w) => Math.abs(woWip(s, w.id).total) > 0.005)
    case "close": return s.productionOrders.filter((w) => w.status === "Completed")
    case "reopen": return s.productionOrders.filter((w) => w.status === "Closed (TECO)")
  }
}

export function WoDecisionsPage() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PRD-WODIALOGS")
  const [role] = useRole()
  const [params] = useSearchParams()
  const [kind, setKind] = useState<WoDecisionKind | null>(null)
  const [woId, setWoId] = useState(params.get("wo") ?? "")
  const [reqId, setReqId] = useState<string | undefined>()
  const [cnfId, setCnfId] = useState("")
  const rows = useMemo(() => WO_DECISION_META.map((m) => ({ ...m, orders: eligible(s, m.kind) })), [s])
  const cur = kind ? rows.find((r) => r.kind === kind)! : null
  const target = cur ? (cur.orders.find((w) => w.id === woId) ?? cur.orders[0]) : undefined
  const cnfs = target ? s.confirmations.filter((c) => c.woId === target.id && !ext.reversalBlock(s, c.id)) : []
  const pending = s.reversalRequests.filter((r) => r.status === "Awaiting second sign-off")
  const decided = s.reversalRequests.filter((r) => r.status !== "Awaiting second sign-off")

  const open = (k: WoDecisionKind, w?: PPWorkOrder, req?: string) => {
    setKind(k)
    if (w) setWoId(w.id)
    setReqId(req)
    setCnfId("")
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Production order decisions"
        screenId="FX-PRD-WODIALOGS"
        description="Release Short, hold, confirmation reversal with a second sign-off, sales-order cancellation, cancel cost, close preconditions and a settled reopen with the journal entry it reverses. Each opens the same dialog as the production order page."
        chips={<Chip kind="design" note="The PRD requires a dual sign-off on confirmation corrections but names no second role; the list of second signers is a reading">Second signer: reading</Chip>}
        actions={<><StatePreview extended /><Button variant="outline" asChild><Link to="/production/orders">Production orders</Link></Button></>}
      />
      <StateBanner st={st} />
      {st.loading ? <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading"><div className="h-24 rounded-lg border" /><div className="h-24 rounded-lg border" /></div>
        : st.error ? <p role="alert" className="rounded-md border border-status-blocked px-4 py-2 text-sm">{st.error} <button className="underline" onClick={st.retry}>Try again</button></p>
        : st.empty ? <EmptyState title="No decisions waiting">No production order is in a state that needs one of these decisions.</EmptyState> : (
        <>
          <section aria-label="Decisions" className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-table-head text-left"><tr><th scope="col" className="px-3 py-2">Decision</th><th scope="col" className="px-3 py-2">Who decides</th><th scope="col" className="px-3 py-2">Orders eligible now</th><th scope="col" className="px-3 py-2" /></tr></thead>
              <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t">
                {rows.map((r) => (
                  <tr key={r.kind}>
                    <td><span className="font-medium">{r.title}</span><span className="block max-w-md text-xs text-muted-foreground">{r.blurb} [{r.source}]</span></td>
                    <td className="text-xs">{r.role}{r.role.startsWith(role) ? <Chip kind="design" note="You are acting in this role">You</Chip> : null}</td>
                    <td className="tabular">{r.orders.length === 0 ? <span className="text-muted-foreground">none</span> : r.orders.slice(0, 4).map((w, i) => <span key={w.id}>{i > 0 && ", "}<WoLink id={w.id} /></span>)}{r.orders.length > 4 && ` +${r.orders.length - 4}`}</td>
                    <td className="text-right"><Button size="sm" variant="outline" disabled={st.readOnly || r.orders.length === 0} title={st.readOnly ? "Changes are refused in this state" : r.orders.length === 0 ? "No eligible order" : undefined} onClick={() => open(r.kind, r.orders[0], r.kind === "reversalSign" ? s.reversalRequests.find((q) => q.woId === r.orders[0].id && q.status === "Awaiting second sign-off")?.id : undefined)}>Open dialog</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {cur && target && (
            <section aria-label="Dialog target" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
              <span className="font-semibold">{cur.title}</span>
              <span className="text-muted-foreground">on</span>
              <Select value={target.id} onValueChange={(v) => { setWoId(v); if (cur.kind === "reversalSign") setReqId(s.reversalRequests.find((q) => q.woId === v && q.status === "Awaiting second sign-off")?.id) }}>
                <SelectTrigger size="sm" className="h-8 w-64" aria-label="Production order"><SelectValue /></SelectTrigger>
                <SelectContent>{cur.orders.map((w) => <SelectItem key={w.id} value={w.id}>{w.id} · {matDesc(w.itemId)} · {w.status}</SelectItem>)}</SelectContent>
              </Select>
              {cur.kind === "reversalRequest" && (
                <Select value={cnfId || cnfs[0]?.id} onValueChange={setCnfId}>
                  <SelectTrigger size="sm" className="h-8 w-56" aria-label="Confirmation"><SelectValue placeholder="Confirmation" /></SelectTrigger>
                  <SelectContent>{cnfs.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} · op {c.op}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </section>
          )}
          {cur && !target && <EmptyState title="Nothing eligible">No order qualifies for {cur.title} right now.</EmptyState>}

          <section aria-label="Reversal requests" className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Confirmation reversals</h2>
            {pending.length + decided.length === 0 ? <p className="text-sm text-muted-foreground">No reversal has been requested. A supervisor requests one from a production order; it waits here for a second person.</p> : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-table-head text-left"><tr>{["Request", "Confirmation", "Order", "Requested by", "Reason", "Status", ""].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t">
                    {[...pending, ...decided].map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-xs">{r.id}</td><td className="font-mono text-xs">{r.cnfId}</td><td><WoLink id={r.woId} /></td>
                        <td>{r.requestedBy}<span className="block text-xs text-muted-foreground">{fmtDate(r.requestedOn)}</span></td>
                        <td className="max-w-64 text-xs">{r.reason}{r.decisionNote ? ` · ${r.decisionNote}` : ""}</td>
                        <td>{r.status}{r.signedBy ? <span className="block text-xs text-muted-foreground">{r.signedBy}{r.reversalId ? ` · ${r.reversalId}` : ""}</span> : null}</td>
                        <td className="text-right">{r.status === "Awaiting second sign-off" && <Button size="sm" variant="outline" disabled={st.readOnly} onClick={() => open("reversalSign", s.productionOrders.find((w) => w.id === r.woId), r.id)}>Review</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <RulesPanel
            rules={[
              ["Release Short", "Planner flag lets a Created order release with a shortage; Shortage badge; short items to the Expedite Board", "DOC:p.74 §5.2"],
              ["On Hold", "A reason is mandatory; Release hold returns the previous status", "DOC:p.74 §5.3"],
              ["Reversal", "Latest confirmation first, before FG receipt; mirror entries; a different person signs", "DOC:p.179 FL-04 f11; p.215 §7.2"],
              ["Cancel", "Finish, stop-scrap or hold; collected cost to scrap per Controller decision", "DOC:p.179 FL-04 f11; p.75 §5.3"],
              ["Close", "All ops confirmed or cancelled, inspections closed, FG received or scrap-disposed, rework settled", "DOC:p.78 §8.2"],
              ["Reopen", "Controller approval; the settlement entry is reversed first", "DOC:p.78 §8.2"],
              ["States", "Normal, empty, loading, error, offline, degraded, read-only and conflict come from the State preview. Authorization: each dialog names the role and refuses another with the next step", "design"],
            ]}
          />
        </>
      )}
      {cur && target && kind && <WoDecisionDialog kind={kind} wo={target} cnfId={cnfId || (kind === "reversalRequest" ? cnfs[0]?.id : undefined)} requestId={reqId ?? (kind === "reversalSign" ? s.reversalRequests.find((q) => q.woId === target.id && q.status === "Awaiting second sign-off")?.id : undefined)} open onOpenChange={(o) => !o && setKind(null)} />}
    </div>
  )
}
