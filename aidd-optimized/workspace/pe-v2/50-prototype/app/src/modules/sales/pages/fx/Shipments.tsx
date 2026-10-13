// OM-SHP-001/002 Shipments (/sales/shipments, /sales/shipments/:id) [DOC:p.55 Book I B §5].
// One shipment per delivery: carrier and tender, equipment and appointment, permits checklist for an
// over-dimensional load, HU list with loading sequence, pre-shipment inspection (PSI) gate, documents bundle
// (BOL, packing list, CoC, test reports, export documents) and POD capture. Shipment id SHP-TBD-nnnn follows the
// delivery number (design value).
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { useStore } from "../../data/store"
import { TODAY, listDate, money, type Delivery } from "../../data/model"
import { acceptTender, generateDoc, recordPsi, reassignCarrier, rejectTender, reorderLoadSeq, togglePermit } from "../../fx/actions"
import { countryOf, dlvIdOfShip, isExport, shipIdOf } from "../../fx/derive"
import { CARRIERS, DOC_KEYS, type DocKey } from "../../fx/model"
import { ActivityList, Reading, Section } from "../../components/ext"
import { ExportChecklist } from "./ExportDocs"
import { PgiConfirmDialog, PgiReverseDialog } from "./PgiDialogs"
import { Inline, PickField, StateBar, TextField, report, useFxState } from "./kit"
import { useFirstVisitLoading } from "@/components/patterns"

export function ShipmentList() {
  const db = useSlice("sales")
  const st = useFxState()
  const loading = useFirstVisitLoading("shipments") || st.loading
  const cname = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
  const cols: Column<Delivery>[] = [
    { id: "id", header: "Shipment", value: (d) => shipIdOf(d.id), mono: true, sortable: true },
    { id: "dlv", header: "Delivery", value: (d) => d.id, mono: true },
    { id: "cust", header: "Customer", value: (d) => cname(d.customerId), sortable: true, cell: (d) => <span className="line-clamp-1 max-w-56" title={cname(d.customerId)}>{cname(d.customerId)}</span> },
    { id: "to", header: "Ship-to", value: (d) => d.shipTo, cell: (d) => <span className="line-clamp-1 max-w-56" title={d.shipTo}>{d.shipTo}</span> },
    { id: "st", header: "Status", value: (d) => d.status, filterable: true, cell: (d) => <StatusBadge kind="delivery" status={d.status} size="sm" /> },
    { id: "car", header: "Carrier", value: (d) => d.carrier ?? "Not assigned", filterable: true },
    { id: "ten", header: "Tender", value: (d) => db.fx.ship[d.id]?.tender ?? "Not tendered", filterable: true, cell: (d) => { const t = db.fx.ship[d.id]?.tender ?? "Not tendered"; return <Badge variant={t === "Rejected" ? "destructive" : "outline"}>{t}</Badge> } },
    { id: "psi", header: "PSI", value: (d) => db.fx.ship[d.id]?.psi.state ?? "Open", filterable: true },
    { id: "cty", header: "Country", value: (d) => countryOf(d), filterable: true },
    { id: "ship", header: "Ship date", value: (d) => d.shipDate ?? "", cell: (d) => (d.shipDate ? listDate(d.shipDate) : "Not shipped"), sortable: true },
  ]
  const rejected = db.deliveries.filter((d) => db.fx.ship[d.id]?.tender === "Rejected").length
  return (
    <div className="flex flex-col gap-4">
      <StateBar st={st} />
      <ListPage<Delivery>
        header={{ title: "Shipments", screenId: "OM-SHP-001/002", description: "Every delivery becomes a shipment: carrier, equipment, permits, handling units, inspection gate, documents and POD.", actions: <><Button variant="outline" asChild><Link to="/sales/deliveries">Delivery cockpit</Link></Button><Button variant="outline" asChild><Link to="/sales/load-ship">Load and ship</Link></Button></>, chips: <><Chip kind="design" note="Shipment ids follow the delivery number; the PRD gives no format for a shipment id.">SHP id: design value</Chip>{rejected > 0 && <Badge variant="destructive">{rejected} carrier rejected</Badge>}</> }}
        table={{ rows: st.empty ? [] : db.deliveries, columns: cols, rowId: (d) => d.id, rowHref: (d) => `/sales/shipments/${shipIdOf(d.id)}`, loading, error: st.state === "offline" ? "Offline: the last list loaded is shown." : undefined, onRetry: () => st.setState("normal"), searchText: (d) => `${shipIdOf(d.id)} ${d.id} ${cname(d.customerId)} ${d.carrier ?? ""} ${d.shipTo}`, searchPlaceholder: "Search shipments", empty: { title: "No shipments", body: "Shipments appear when a delivery is created." }, initialSort: { id: "id", dir: "desc" } }}
      />
      <RulesPanel rules={SHIP_RULES} />
    </div>
  )
}

const SHIP_RULES: [string, string, string][] = [
  ["SHP-1", "Carrier and tracking are manual in Phase 1 (DEC-04); a rejected tender sends the shipment back to carrier assignment before loading.", "DOC:p.205 DEC-04; p.55 §5"],
  ["SHP-2", "An over-dimensional load carries a permits checklist; the load plan and the documents gate read it.", "DOC:p.55 §5"],
  ["SHP-3", "The pre-shipment inspection is a gate: pass makes Quality Cleared and generates the CoC (INV 15.5); fail blocks PGI (E-OM-07).", "DOC:p.176; INV 15.3"],
  ["SHP-4", "The BOL uses VICS format and needs carrier and PRO/BOL #; the packing list is a draft until the pack order is complete.", "DOC:p.55 §5.1"],
  ["SHP-5", "POD is captured once; an exception opens a carrier claim.", "DOC:p.208 §2.6"],
]

export function ShipmentDetail() {
  const { id } = useParams()
  const dlvId = dlvIdOfShip(id ?? "")
  const { db, role } = useStore()
  const st = useFxState()
  const nav = useNavigate()
  const d = db.deliveries.find((x) => x.id === dlvId)
  const s = db.fx.ship[dlvId]
  const [err, setErr] = useState<{ text: string } | null>(null)
  const [pgi, setPgi] = useState(false)
  const [rev, setRev] = useState(false)
  const [reassign, setReassign] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  if (!d || !s)
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={`No shipment ${id}`}>The shipment id follows its delivery number. <Link className="text-link underline" to="/sales/shipments">Back to shipments</Link></EmptyState>
      </div>
    )
  const hus = db.hus.filter((h) => h.deliveryId === d.id)
  const o = db.orders.find((x) => x.id === d.soId)!
  const c = db.customers.find((x) => x.id === d.customerId)!
  const pod = db.pods.find((p) => p.deliveryId === d.id)
  const terminal = d.status === "Delivered/Closed"
  const w = st.writable && !terminal
  const act = (r: { ok: boolean } & ({ ok: true } | { ok: false; error: string }), ok: string) => { if (r.ok) { toast.success(ok); setErr(null) } else setErr({ text: (r as { error: string }).error }) }
  const orderedHus = s.loadSeq.map((h) => hus.find((x) => x.id === h)).filter(Boolean) as typeof hus

  return (
    <>
      <DetailPage
        header={{
          title: `Shipment ${shipIdOf(d.id)}`, screenId: "OM-SHP-001/002", crumbs: [{ label: "Shipments", to: "/sales/shipments" }, { label: shipIdOf(d.id) }],
          description: `${c.name} · ${d.shipTo}`,
          actions: <>
            <Button variant="outline" asChild><Link to={`/sales/deliveries?d=${d.id}`}>Open in cockpit</Link></Button>
            {d.status === "PGI" && <Button variant="outline" onClick={() => setRev(true)} disabled={!w}>Reverse PGI</Button>}
          </>,
          primary: d.status === "Loaded" ? <Button onClick={() => setPgi(true)} disabled={!w} title={st.why || undefined}>Post goods issue</Button> : ["Quality Cleared"].includes(d.status) ? <Button onClick={() => nav("/sales/load-ship")}>Open load and ship</Button> : undefined,
          chips: <>{isExport(d) && <Badge variant="outline">Export: {countryOf(d)}</Badge>}{s.tender === "Rejected" && <Badge variant="destructive">Carrier rejected</Badge>}{d.forcePgiFail && <Chip kind="flag" note="Prototype: this delivery fails the PGI post once.">PGI fault set</Chip>}</>,
        }}
        status={{ kind: "delivery", value: d.status }}
        doc={{ type: "delivery", id: d.id }}
        summary={<>
          <KV k="Sales order"><Link className="text-link underline" to={`/sales/orders/${o.id}`}>{o.id}</Link></KV>
          <KV k="Incoterms / freight">{d.incoterms} · {d.freightPaidBy}</KV>
          <KV k="Carrier">{d.carrier ?? "Not assigned"}{d.pro ? ` · ${d.pro}` : ""}</KV>
          <KV k="Tender">{s.tender}</KV>
        </>}
        tabs={[
          { id: "carrier", label: "Carrier and equipment", content: (
            <div className="flex flex-col gap-4">
              <StateBar st={st} />
              <Inline error={err} onDismiss={() => setErr(null)} />
              {s.tender === "Rejected" && <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">{d.carrier} rejected the tender: {s.rejectedReason}. Reassign a carrier before loading.</p>}
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <KV k="Equipment">{d.equipment ?? "Not set on the load plan"}</KV>
                <KV k="Dock door">{d.door ?? "Not set"}</KV>
                <KV k="Appointment">{d.slot ?? "Not set"}</KV>
                <KV k="Planned transit">{d.transitDays != null ? `${d.transitDays} days` : "Not recorded"}</KV>
                <KV k="Freight">{d.freight != null ? money(d.freight) : "Not recorded"}</KV>
                <KV k="Warehouse">{d.warehouse}</KV>
                <KV k="Ship date">{d.shipDate ? listDate(d.shipDate) : "Not shipped"}</KV>
                <KV k="Weight of load">{hus.reduce((a, h) => a + (h.actualKg ?? h.expectedKg), 0).toLocaleString("en-US")} kg</KV>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!w || !d.carrier || s.tender === "Accepted"} onClick={() => act(acceptTender(d.id), `${d.carrier} accepted`)}>Carrier accepted</Button>
                <Button variant="outline" disabled={!w || !d.carrier || s.tender === "Rejected"} onClick={() => setRejectOpen(true)}>Carrier rejected</Button>
                <Button disabled={!w} onClick={() => setReassign(true)}>{s.tender === "Rejected" ? "Reassign carrier" : "Assign or change carrier"}</Button>
                <Button variant="ghost" asChild><Link to={`/sales/deliveries?d=${d.id}`}>Edit the full load plan in the cockpit</Link></Button>
              </div>
              <Section title="Carrier history"><ActivityList items={s.carrierHistory} /></Section>
            </div>
          ) },
          { id: "permits", label: "Permits", count: s.permitItems.length, content: (
            s.permitItems.length === 0 ? <EmptyState title="No permits needed">The load is not over-dimensional, so no permits checklist applies.</EmptyState> : (
              <div className="flex flex-col gap-2">
                <p className="text-sm">{d.permits.length} of {s.permitItems.length} done. The load plan reads this checklist; it locks after PGI.</p>
                {s.permitItems.map((p) => (
                  <div key={p} className="flex items-center gap-2"><Checkbox id={`pm-${p}`} checked={d.permits.includes(p)} disabled={!w || ["PGI", "Delivered/Closed"].includes(d.status)} onCheckedChange={() => act(togglePermit(d.id, p), p)} /><Label htmlFor={`pm-${p}`} className="font-normal">{p}</Label></div>
                ))}
              </div>
            )
          ) },
          { id: "hus", label: "Handling units", count: hus.length, content: (
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Load order</TableHead><TableHead>HU</TableHead><TableHead>SSCC</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Move</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {orderedHus.map((h, i) => (
                  <TableRow key={h.id}>
                    <TableCell className="tabular">{i + 1}</TableCell><TableCell>{h.id}</TableCell><TableCell className="font-mono text-xs">{h.sscc}</TableCell><TableCell>{h.item}</TableCell>
                    <TableCell className="tabular text-right">{h.expectedKg.toLocaleString("en-US")} kg</TableCell><TableCell className="tabular text-right">{h.actualKg != null ? `${h.actualKg.toLocaleString("en-US")} kg` : "Not weighed"}</TableCell>
                    <TableCell><StatusBadge kind="handlingUnit" status={h.status} size="sm" /></TableCell>
                    <TableCell className="whitespace-nowrap"><Button size="icon" variant="ghost" aria-label={`Move ${h.id} earlier`} disabled={!w || i === 0 || h.status === "Loaded"} onClick={() => act(reorderLoadSeq(d.id, h.id, -1), "Sequence changed")}><ArrowUp aria-hidden="true" /></Button><Button size="icon" variant="ghost" aria-label={`Move ${h.id} later`} disabled={!w || i === orderedHus.length - 1 || h.status === "Loaded"} onClick={() => act(reorderLoadSeq(d.id, h.id, 1), "Sequence changed")}><ArrowDown aria-hidden="true" /></Button></TableCell>
                  </TableRow>
                ))}
                {hus.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No handling units yet: the pack order is not packed.</TableCell></TableRow>}
              </TableBody>
            </Table>
          ) },
          { id: "psi", label: "PSI gate", content: <PsiPanel d={d} st={st} role={role} /> },
          { id: "docs", label: "Documents bundle", content: (
            <div className="flex flex-col gap-3">
              <Inline error={err} onDismiss={() => setErr(null)} />
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Document</TableHead><TableHead>State</TableHead><TableHead>Generated</TableHead><TableHead>Needs</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {DOC_KEYS.map((k) => {
                    const x = s.docs[k]
                    return (
                      <TableRow key={k}>
                        <TableCell>{k}</TableCell><TableCell>{x.state}{x.state === "Draft" ? " (watermarked)" : ""}</TableCell><TableCell>{x.at ? `${x.at} · ${x.by}` : "Not yet"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{NEEDS[k]}</TableCell>
                        <TableCell><Button size="sm" variant="outline" disabled={!w || x.state === "Generated" || (k === "Export documents" && !s.export)} onClick={() => act(generateDoc(d.id, k as DocKey), `${k} generated`)}>Generate</Button></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) },
          { id: "export", label: "Export documents", content: <ExportChecklist d={d} st={st} /> },
          { id: "pod", label: "POD", content: <PodPanel d={d} pod={pod} writable={w} /> },
          { id: "activity", label: "Activity", content: <ActivityList items={d.activity} /> },
        ]}
      />
      <PgiConfirmDialog d={d} open={pgi} onOpenChange={setPgi} />
      <PgiReverseDialog d={d} open={rev} onOpenChange={setRev} />
      <DialogShell open={rejectOpen} onOpenChange={setRejectOpen} title={`Carrier rejected: ${shipIdOf(d.id)}`} description={d.carrier} consequence="Marks the tender Rejected. Loading is refused until a carrier is reassigned." requireReason reasonLabel="Why did the carrier reject the tender? (required)" confirmLabel="Record rejection" destructive onConfirm={(r) => report(rejectTender(d.id, r), "Rejection recorded")} />
      <ReassignDialog d={d} open={reassign} onOpenChange={setReassign} />
      <div className="mt-4"><RulesPanel rules={SHIP_RULES} /></div>
    </>
  )
}

const NEEDS: Record<DocKey, string> = {
  BOL: "Carrier and PRO/BOL # (VICS format)",
  "Packing list": "Delivery released; draft until packed",
  CoC: "Pre-shipment inspection passed (E-OM-07)",
  "Test reports (FTR)": "Final test report on file",
  "Export documents": "Export checklist prepared",
}

export function ReassignDialog({ d, open, onOpenChange }: { d: Delivery; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [carrier, setCarrier] = useState("")
  const [pro, setPro] = useState(d.pro ?? "")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={`${d.carrier ? "Reassign" : "Assign"} carrier for ${shipIdOf(d.id)}`} description={d.carrier ? `Currently ${d.carrier}` : "No carrier yet"} consequence="Tenders the shipment to the new carrier, clears a rejection and updates the documents flag (carrier and PRO/BOL # present)." confirmLabel="Tender to carrier"
      onConfirm={() => report(reassignCarrier(d.id, carrier, pro), `Tendered to ${carrier}`)}>
      <PickField label="Carrier" value={carrier} onChange={setCarrier} options={CARRIERS.filter((x) => x !== d.carrier)} />
      <TextField id="rc-pro" label="PRO / BOL #" value={pro} onChange={setPro} hint="Manual in Phase 1 (DEC-04)." />
    </DialogShell>
  )
}

function PsiPanel({ d, st, role }: { d: Delivery; st: ReturnType<typeof useFxState>; role: string }) {
  const db = useSlice("sales")
  const s = db.fx.ship[d.id]
  const [reason, setReason] = useState("")
  const [err, setErr] = useState<{ text: string } | null>(null)
  const act = (res: "Passed" | "Failed") => { const r = recordPsi(d.id, res, reason); if (r.ok) { toast.success(`Pre-shipment inspection ${res.toLowerCase()}`); setErr(null) } else setErr({ text: r.error }) }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">Pre-shipment inspection: <strong>{s.psi.state}</strong>{s.psi.at ? ` on ${s.psi.at} by ${s.psi.by}` : ""}. {s.psi.cocId ? `Certificate of Conformance ${s.psi.cocId} generated.` : ""}{s.psi.reason ? ` Reason: ${s.psi.reason}.` : ""}</p>
      <p className="text-sm text-muted-foreground">A pass moves the delivery Packed → Quality Cleared and generates the CoC; a fail blocks PGI (E-OM-07). Recorded by Inspector, Quality engineer or Quality Manager; you are acting as {role}.</p>
      <TextField id="psi-reason" label="Reason (required for a fail)" value={reason} onChange={setReason} />
      <Inline error={err} />
      <div className="flex gap-2"><Button disabled={!st.writable || d.status !== "Packed" || s.psi.state === "Passed"} onClick={() => act("Passed")} title={d.status !== "Packed" ? `Recorded on a Packed delivery; this one is ${d.status}` : undefined}>Record pass</Button><Button variant="outline" disabled={!st.writable || d.status !== "Packed"} onClick={() => act("Failed")}>Record fail</Button></div>
    </div>
  )
}

function PodPanel({ d, pod, writable }: { d: Delivery; pod: ReturnType<typeof useSlice<"sales">>["pods"][number] | undefined; writable: boolean }) {
  const { actions } = useStore()
  const [f, setF] = useState({ receiver: "", date: TODAY, condition: "No damage", notes: "", carrierRef: "", claimValue: "" })
  const [err, setErr] = useState<{ text: string } | null>(null)
  if (!pod) return <EmptyState title="No POD yet">The POD row opens at Expected when goods issue posts. The expected date is ship date plus planned transit days.</EmptyState>
  if (pod.status !== "Expected")
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>POD {pod.id}: <StatusBadge kind="pod" status={pod.status} /> received by {pod.receiver ?? "not recorded"} on {pod.date ? listDate(pod.date) : "not recorded"}, condition {pod.condition ?? "not recorded"}.</p>
        {pod.claim && <p>Claim {pod.claim.id}: {pod.claim.type}, carrier ref {pod.claim.carrierRef}{pod.claim.resolution ? `, resolved: ${pod.claim.resolution}` : ""}.</p>}
        <Link className="text-link underline" to={`/sales/pod/${pod.id}`}>Open POD and claims</Link>
      </div>
    )
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-sm">POD {pod.id} is Expected on {listDate(pod.expectedDate)}. Capture it once.</p>
      <TextField id="pod-rcv" label="Receiver name" value={f.receiver} onChange={(v) => setF({ ...f, receiver: v })} />
      <TextField id="pod-date" label="Delivery date" type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
      <PickField label="Condition" value={f.condition} onChange={(v) => setF({ ...f, condition: v })} options={["No damage", "Damage", "Shortage", "Refusal"]} />
      {f.condition !== "No damage" && (<><TextField id="pod-ref" label="Carrier claim reference" value={f.carrierRef} onChange={(v) => setF({ ...f, carrierRef: v })} /><TextField id="pod-val" label="Claim value" type="number" value={f.claimValue} onChange={(v) => setF({ ...f, claimValue: v })} /></>)}
      <TextField id="pod-notes" label="Notes" value={f.notes} onChange={(v) => setF({ ...f, notes: v })} />
      <Inline error={err} />
      <div><Button disabled={!writable || d.status !== "PGI"} onClick={() => {
        const r = actions.recordPOD(pod.id, { receiver: f.receiver, date: f.date, condition: f.condition, notes: f.notes, docName: "", claimType: f.condition === "Shortage" ? "shortage" : f.condition === "Refusal" ? "refusal" : "damage", claimValue: Number(f.claimValue) || undefined, carrierRef: f.carrierRef })
        if (r.ok) { toast.success("POD recorded"); setErr(null) } else setErr({ text: r.error })
      }}>Record POD</Button></div>
      <Reading id="OQ-32" note="POD exception resolves to Delivered/Closed once the claim is resolved." />
    </div>
  )
}
