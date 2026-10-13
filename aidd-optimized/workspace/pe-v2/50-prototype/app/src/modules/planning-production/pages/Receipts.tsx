// FX-PRD-RECEIPT FG production receipt and subcontract operation views [DOC:p.78 §8.1; Book VI].
// FG receipt: after the final operation and a passed Final Test, Receive to Stock posts #31 at the
// released standard, to STAGE-OUT (auto-reserved to the pegged sales order) or FG stock. Subcontract
// operation: material provided to the vendor is issued (#34, Subcontract at Vendor 1315) and the
// received service posts #35 against the PO. The subcontract record layout and the vendors are seeded.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Chip, PostingPreview, RulesPanel, type Column } from "@/components/patterns"
import { DataTable } from "@/components/patterns/DataTable"
import { DialogShell, PageHeader } from "@/components/templates"
import { VENDORS } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { AccessNote, ActivityList, Item, SoLink, StateBanner, StatePreview, WoLink, qty, useActDialog, useScreenState } from "../components"
import * as act from "../lib/actions"
import * as ext from "../lib/actions-ext"
import { goodQty, stdTotal } from "../lib/plan"
import type { SubcontractOp } from "../data/extra"
import type { PPWorkOrder } from "../data/types"

const vendor = (id: string) => VENDORS.find((v) => v.id === id)?.name ?? id
const Tag = ({ s }: { s: string }) => <span className="inline-flex rounded-md border px-2 py-0.5 text-xs font-medium">{s}</span>

export function ReceiptsPage() {
  const s = useSlice("planningProduction")
  const st = useScreenState("FX-PRD-RECEIPT")
  const [role] = useRole()
  const runD = useActDialog()
  const [tab, setTab] = useState("fg")
  const [recv, setRecv] = useState<PPWorkOrder | null>(null)
  const [sub, setSub] = useState<{ op: SubcontractOp; mode: "send" | "receive" } | null>(null)
  const [q, setQ] = useState("")
  const [detail, setDetail] = useState<string | null>(null)
  const rows = useMemo(() => (st.empty ? [] : s.productionOrders.filter((w) => w.fgReceivedOn || (["In Progress", "Testing"].includes(w.status) && w.operations.every((o) => o.status === "Completed" || o.status === "Cancelled")))), [s, st.empty])
  const subs = st.empty ? [] : s.subcontracts
  const wh = ext.STO_WAREHOUSE_ROLES.includes(role as never) || role === "Production supervisor"
  const receiptJe = (id: string) => s.journal.find((j) => j.template === 31 && j.source.id === id && !j.reverses)
  const open = subs.find((x) => x.id === detail)

  const fgCols: Column<PPWorkOrder>[] = [
    { id: "wo", header: "Order", value: (w) => w.id, sortable: true, cell: (w) => <WoLink id={w.id} /> },
    { id: "item", header: "Item", value: (w) => w.itemId, cell: (w) => <Item id={w.itemId} /> },
    { id: "good", header: "Good qty", value: (w) => goodQty(w), align: "right", mono: true },
    { id: "ser", header: "Serials", value: (w) => w.serials.join(" "), cell: (w) => <span className="font-mono text-xs">{w.serials.length > 1 ? `${w.serials[0]} +${w.serials.length - 1}` : w.serials[0] ?? ""}</span> },
    { id: "ft", header: "Final Test", value: (w) => (w.testPassed ? "Passed" : "Pending"), filterable: true },
    { id: "dest", header: "To", value: (w) => (w.pegs[0] ? `STAGE-OUT, reserved ${w.pegs[0].soId}` : "WH-TBD-01 FG"), cell: (w) => (w.pegs[0] ? <span className="text-xs">STAGE-OUT · <SoLink id={w.pegs[0].soId} /></span> : <span className="text-xs">WH-TBD-01 FG</span>) },
    { id: "val", header: "Receipt value (#31)", value: (w) => receiptJe(w.id)?.amount ?? 0, align: "right", mono: true, cell: (w) => (receiptJe(w.id) ? fmtMoney(receiptJe(w.id)!.amount) : "") },
    { id: "on", header: "Received", value: (w) => w.fgReceivedOn ?? "", sortable: true, cell: (w) => (w.fgReceivedOn ? fmtDate(w.fgReceivedOn) : <Tag s="Ready to receive" />) },
    { id: "act", header: "", cell: (w) => (!w.fgReceivedOn ? <Button size="sm" variant="outline" disabled={st.readOnly} onClick={() => setRecv(w)}>Receive to stock</Button> : null) },
  ]
  const subCols: Column<SubcontractOp>[] = [
    { id: "id", header: "Subcontract op", value: (x) => x.id, mono: true, sortable: true },
    { id: "wo", header: "Order / op", value: (x) => `${x.woId}/${x.op}`, cell: (x) => <><WoLink id={x.woId} /> / {x.op}</> },
    { id: "svc", header: "Service", value: (x) => x.service },
    { id: "ven", header: "Vendor", value: (x) => x.vendorId, filterable: true, cell: (x) => <span className="text-xs">{vendor(x.vendorId)}<span className="block font-mono">{x.poRef}</span></span> },
    { id: "qty", header: "Sent / received / qty", value: (x) => x.qty, align: "right", mono: true, cell: (x) => `${x.sentQty} / ${x.receivedQty} / ${x.qty}` },
    { id: "back", header: "Expected back", value: (x) => x.expectedBack, sortable: true, cell: (x) => <span className={x.expectedBack < "2026-10-09" && x.status !== "Received" ? "text-status-exception-ink" : undefined}>{fmtDate(x.expectedBack)}</span> },
    { id: "st", header: "Status", value: (x) => x.status, filterable: true, cell: (x) => <Tag s={x.status} /> },
    { id: "act", header: "", cell: (x) => (
      <span className="inline-flex gap-1">
        {x.sentQty < x.qty && <Button size="sm" variant="outline" disabled={!wh || st.readOnly} title={!wh ? "Warehouse issues material to the vendor" : undefined} onClick={() => (setSub({ op: x, mode: "send" }), setQ(String(x.qty - x.sentQty)))}>Send material</Button>}
        {x.receivedQty < x.sentQty && <Button size="sm" variant="outline" disabled={!wh || st.readOnly} title={!wh ? "Warehouse receives from the vendor" : undefined} onClick={() => (setSub({ op: x, mode: "receive" }), setQ(String(x.sentQty - x.receivedQty)))}>Receive</Button>}
        <Button size="sm" variant="ghost" onClick={() => setDetail(x.id)}>Open</Button>
      </span>
    ) },
  ]
  const n = Number(q)
  const matVal = sub ? sub.op.providedMaterial.reduce((a, m) => a + (m.value * (n || 0)) / sub.op.qty, 0) : 0
  const svcVal = sub ? (n || 0) * sub.op.unitPrice : 0
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="FG receipts and subcontract operations"
        screenId="FX-PRD-RECEIPT"
        description="Finished units into stock with #31, and operations done by a vendor with material issued (#34) and service received (#35)."
        chips={<Chip kind="design" note="The subcontract operation record (sent, received, expected back) is a prototype layout; the postings #34 and #35 are the PRD's">Subcontract record: design</Chip>}
        actions={<><StatePreview extended /><Button variant="outline" asChild><Link to="/production/orders">Production orders</Link></Button></>}
      />
      <StateBanner st={st} />
      <AccessNote roles={[...ext.STO_WAREHOUSE_ROLES, "Production supervisor"]} role={role} what="Receiving finished goods and moving subcontract material" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fg">FG production receipts ({rows.length})</TabsTrigger>
          <TabsTrigger value="sub">Subcontract operations ({subs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="fg" className="pt-4">
          <DataTable<PPWorkOrder> rows={rows} columns={fgCols} rowId={(w) => w.id} densityKey="FX-PRD-RECEIPT-fg" searchText={(w) => `${w.id} ${w.itemId} ${w.serials.join(" ")}`} searchPlaceholder="Search order, item, serial"
            loading={st.loading} error={st.error} onRetry={st.retry} empty={{ title: "No receipts waiting", body: "Orders appear here when the final operation is confirmed and Final Test has passed." }} initialSort={{ id: "on", dir: "desc" }} />
        </TabsContent>
        <TabsContent value="sub" className="pt-4">
          <DataTable<SubcontractOp> rows={subs} columns={subCols} rowId={(x) => x.id} densityKey="FX-PRD-RECEIPT-sub" searchText={(x) => `${x.id} ${x.woId} ${x.poRef} ${x.service}`} searchPlaceholder="Search subcontract, order, PO"
            loading={st.loading} error={st.error} onRetry={st.retry} empty={{ title: "No subcontract operations", body: "A routing operation flagged as subcontract creates one when its order releases." }} initialSort={{ id: "back", dir: "asc" }} />
        </TabsContent>
      </Tabs>
      <RulesPanel rules={[
        ["#31", "FG receipt at released standard: DR finished goods, CR WIP; to STAGE-OUT and auto-reserved for a pegged order", "DOC:p.78 §8.1"],
        ["C-26", "A receipt is refused until Final Test has passed", "DOC:p.78; C-26"],
        ["#34", "Material issued to a subcontractor moves to Subcontract at Vendor (1315)", "DOC:pp.124-125 Part J #34"],
        ["#35", "Subcontract receipt posts the service at PO price plus provided material to WIP; the price variance posts at invoice", "DOC:pp.124-125 Part J #35"],
      ]} />

      <DialogShell open={!!recv} onOpenChange={(o) => !o && setRecv(null)} title={`Receive ${recv?.id} to stock`} confirmLabel="Post receipt"
        consequence={recv ? `Posts #31 for ${goodQty(recv)} good × ${recv.itemId} to ${recv.pegs.length ? `STAGE-OUT, reserved to ${recv.pegs[0].soId} line ${recv.pegs[0].line}` : "WH-TBD-01 FG"}; status becomes Completed.` : undefined}
        onConfirm={() => runD((d, c) => act.receiveToStock(d, c, recv!.id), `${recv?.id} received; Completed`)}>
        {recv && <>
          {!recv.testPassed && <p role="alert" className="text-sm text-destructive">Final Test has not passed: the receipt will be refused (C-26).</p>}
          <PostingPreview lines={[{ template: 31, amount: (stdTotal(recv.costStd) / recv.qty) * goodQty(recv), detail: `${goodQty(recv)} × ${fmtMoney(stdTotal(recv.costStd) / recv.qty)}` }]} />
        </>}
      </DialogShell>

      <DialogShell open={!!sub} onOpenChange={(o) => !o && setSub(null)} title={sub?.mode === "send" ? `Send material for ${sub?.op.id}` : `Receive from vendor for ${sub?.op.id}`} confirmLabel={sub?.mode === "send" ? "Issue to vendor" : "Post receipt"}
        consequence={sub?.mode === "send" ? `Issues the provided material to ${sub ? vendor(sub.op.vendorId) : ""}: it moves to Subcontract at Vendor (1315) and stays valued until the service comes back.` : "Posts the service at PO price plus the provided material to order WIP and clears the vendor account."}
        onConfirm={() => runD((d, c) => (sub!.mode === "send" ? ext.sendSubcontract(d, c, sub!.op.id, n) : ext.receiveSubcontract(d, c, sub!.op.id, n)), sub?.mode === "send" ? "Material issued to the vendor" : "Received")}>
        {sub && <>
          <div className="grid max-w-40 gap-1"><Label htmlFor="sub-q">Quantity</Label><Input id="sub-q" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <p className="text-sm">{sub.op.service}. Provided material: {sub.op.providedMaterial.map((m) => `${m.materialId} × ${qty(m.qty)}`).join(", ")}.</p>
          {n > 0 && <PostingPreview lines={sub.mode === "send" ? [{ template: 34, amount: matVal, detail: `${n} × ${sub.op.service}` }] : [{ template: 35, amount: matVal + svcVal, detail: `service ${fmtMoney(svcVal)} + material ${fmtMoney(matVal)}` }]} />}
        </>}
      </DialogShell>
      <DialogShell open={!!open} onOpenChange={(o) => !o && setDetail(null)} wide title={open ? `${open.id} · ${open.service}` : ""} confirmLabel="Close" onConfirm={() => null}>
        {open && <><p className="text-sm">{vendor(open.vendorId)} · {open.poRef} · order <WoLink id={open.woId} /> op {open.op} · {fmtMoney(open.unitPrice)} per unit</p><ActivityList items={open.activity} /></>}
      </DialogShell>
    </div>
  )
}
