// FX-OM-PGI PGI confirmation and PGI reversal dialogs (/sales/dialogs/pgi) [DOC:p.208 Book IV §2.5].
// PGI is one atomic post: gate checks (supply, quality, credit, documents), then #25 and #26 (PE-paid freight);
// a failure leaves the delivery at Loaded. Reversal: Shipping Manager only, before the invoice, in the same fiscal
// period, with a reason; it mirrors the postings and withdraws the invoice request.
import { useState } from "react"
import { Link } from "react-router"
import { CircleCheck, CircleX } from "lucide-react"
import { DialogShell } from "@/components/templates"
import { PostingPreview } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { OPEN_PERIOD } from "../../data/model"
import { useSlice } from "@/store"
import { useStore, failingFlags, postingPreview, reversalBlock } from "../../data/store"
import { shipIdOf } from "../../fx/derive"
import type { Delivery } from "../../data/model"
import { DialogPage, PickField, report, useFxState } from "./kit"

function GateRow({ ok, label, why }: { ok: boolean; label: string; why: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CircleCheck className="mt-0.5 size-4 text-status-passed" aria-hidden="true" /> : <CircleX className="mt-0.5 size-4 text-destructive" aria-hidden="true" />}
      <span><strong>{label}</strong>: {ok ? "passed" : "not passed"}. <span className="text-muted-foreground">{why}</span></span>
    </li>
  )
}

export function PgiConfirmDialog({ d, open, onOpenChange }: { d: Delivery; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db, actions } = useStore()
  const prev = postingPreview(db, d)
  const ship = db.fx.ship[d.id]
  const fail = failingFlags(d)
  const exportMissing = ship?.export?.some((e) => e.state === "Not started") ?? false
  const blocked = d.status !== "Loaded" ? `Post goods issue needs the delivery at Loaded; ${d.id} is ${d.status}.` : fail.length ? `Blocked: readiness flags not passed: ${fail.join(", ")} (R-12).` : null
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Confirm PGI for ${d.id}`} description={`${shipIdOf(d.id)} to ${d.shipTo}`}
      consequence={<>Posts goods issue as one atomic transaction: {d.id} Loaded → PGI, handling units and serials → Shipped, #25{prev.p26.amount != null ? " and #26" : ""} posted in period {OPEN_PERIOD}, an invoice request created for Finance and a POD row opened at Expected. If anything fails, nothing is posted and the delivery stays at Loaded.</>}
      confirmLabel="Post goods issue" confirmDisabled={!!blocked}
      onConfirm={() => report(actions.pgi(d.id), (id) => `${id} posted. Invoice request handed to Finance.`)}>
      {blocked && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{blocked}</p>}
      <ul className="flex flex-col gap-1" aria-label="Gate checks">
        <GateRow ok={d.flags.supply === "passed"} label="Supply" why="Every schedule line on the delivery is allocated and picked." />
        <GateRow ok={d.flags.quality === "passed"} label="Quality" why={ship?.psi.state === "Passed" ? `Pre-shipment inspection passed ${ship.psi.at}; CoC ${ship.psi.cocId}.` : ship?.psi.state === "Failed" ? `Inspection failed: ${ship.psi.reason}. PGI blocked (E-OM-07).` : "Pre-shipment inspection not recorded (E-OM-07)."} />
        <GateRow ok={d.flags.credit === "passed"} label="Credit" why="The shipment-release credit gate; sales roles cannot bypass it (p.49)." />
        <GateRow ok={d.flags.documents === "passed"} label="Documents" why={d.carrier && d.pro ? `Carrier ${d.carrier}, ${d.pro}.` : "Carrier and PRO/BOL # missing on the load plan."} />
        {ship?.export && <GateRow ok={!exportMissing} label="Export documents" why={exportMissing ? "Export checklist has items Not started." : "Export checklist complete."} />}
      </ul>
      <PostingPreview period={OPEN_PERIOD} lines={[
        { template: 25, amount: prev.p25.amount, detail: prev.p25.detail },
        { template: 26, amount: prev.p26.amount, detail: prev.p26.detail || prev.p26.text, notPostedReason: prev.p26.amount == null ? "customer-paid freight" : undefined },
      ]} />
      {d.forcePgiFail && <p className="text-sm text-status-pending-ink">Prototype: this delivery is set to fail the post (posting service unavailable) so the atomic rollback can be seen.</p>}
    </DialogShell>
  )
}

export function PgiReverseDialog({ d, open, onOpenChange }: { d: Delivery; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db, actions, role } = useStore()
  const block = reversalBlock(db, d, role)
  const o = db.orders.find((x) => x.id === d.soId)!
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Reverse PGI ${d.pgiId ?? ""} on ${d.id}`} description={`Posted ${d.shipDate ?? ""} in fiscal period ${d.pgiPeriod ?? "not recorded"}; open period ${OPEN_PERIOD}.`}
      consequence={`Posts the mirror of #25, #26 and #27, returns serials Shipped → Reserved and handling units to Loaded, withdraws invoice request ${d.irId ?? ""} and moves ${d.id} PGI → Packed. Allowed only before the invoice and in the same fiscal period.`}
      requireReason reasonLabel="Reason for the reversal (required)" confirmLabel="Reverse PGI" destructive confirmDisabled={d.status !== "PGI"}
      onConfirm={(reason) => report(actions.reversePGI(d.id, reason), "PGI reversed; invoice request withdrawn")}>
      <ul className="flex flex-col gap-1" aria-label="Reversal checks">
        <GateRow ok={d.status === "PGI"} label="Status" why={`${d.id} is ${d.status}; reversal applies at PGI.`} />
        <GateRow ok={!o.invoicePosted} label="Invoice" why={o.invoicePosted ? "An invoice is posted: use credit and rebill or an RMA." : "No invoice posted for the order."} />
        <GateRow ok={d.pgiPeriod === OPEN_PERIOD} label="Fiscal period" why={`PGI period ${d.pgiPeriod ?? "n/a"}, open period ${OPEN_PERIOD}.`} />
        <GateRow ok={role === "Shipping Manager"} label="Role" why={`Shipping Manager only. You are acting as ${role}.`} />
      </ul>
      {block && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{block}</p>}
    </DialogShell>
  )
}

export function PgiPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const ready = db.deliveries.filter((x) => x.status === "Loaded")
  const posted = db.deliveries.filter((x) => x.status === "PGI")
  const [pid, setPid] = useState(ready[0]?.id ?? db.deliveries[0]?.id ?? "")
  const [rid, setRid] = useState(posted.find((x) => x.pgiPeriod === OPEN_PERIOD)?.id ?? posted[0]?.id ?? "")
  const pd = db.deliveries.find((x) => x.id === pid)
  const rd = db.deliveries.find((x) => x.id === rid)
  const label = (x: Delivery) => `${shipIdOf(x.id)} · ${x.id} · ${x.status}${x.status === "PGI" ? ` · ${x.pgiPeriod}` : ""}`
  return (
    <DialogPage
      screenId="FX-OM-PGI"
      title="PGI confirmation and reversal"
      description="The two dialogs on a shipment: post goods issue when every gate is green, and reverse it before the invoice in the same period."
      st={st}
      cards={[
        ...(pd ? [{ id: "pgi", title: "Confirm PGI", open: "Open confirmation", body: <div className="flex flex-col gap-2"><PickField label="Delivery" value={pid} onChange={setPid} options={db.deliveries.filter((x) => x.status !== "Delivered/Closed").map((x) => ({ value: x.id, label: label(x) }))} /><span className="flex items-center gap-2"><StatusBadge kind="delivery" status={pd.status} /><Link className="text-link underline" to={`/sales/shipments/${shipIdOf(pd.id)}`}>Open shipment</Link></span></div>, render: (o: boolean, c: (o: boolean) => void) => <PgiConfirmDialog d={pd} open={o} onOpenChange={c} /> }] : []),
        ...(rd ? [{ id: "rev", title: "Reverse PGI", open: "Open reversal", body: <div className="flex flex-col gap-2"><PickField label="Delivery at PGI" value={rid} onChange={setRid} options={posted.map((x) => ({ value: x.id, label: label(x) }))} /><span>Shipping Manager only, before invoice, same fiscal period.</span></div>, render: (o: boolean, c: (o: boolean) => void) => <PgiReverseDialog d={rd} open={o} onOpenChange={c} /> }] : []),
      ]}
      rules={[
        ["R-12", "PGI only when supply, quality, credit and documents flags are all passed; inspection blocks PGI (E-OM-07).", "DOC:p.207 §2.4"],
        ["R-13", "PGI is one atomic transaction; a failure leaves the delivery at Loaded, never half-posted.", "DOC:p.208 §2.5"],
        ["R-14", "PGI posts #25 and #26 (PE-paid freight only); #27 posts at HU close.", "DOC:pp.124-125 Part J"],
        ["R-16", "PGI reversal: Shipping Manager only, before invoice, same fiscal period, reason mandatory.", "DOC:p.208 §2.5"],
      ]}
    />
  )
}
