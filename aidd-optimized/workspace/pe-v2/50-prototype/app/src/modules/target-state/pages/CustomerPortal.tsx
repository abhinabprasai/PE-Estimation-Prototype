// Customer portal [Book IX §4.3]: FX-PTL-CUS-ORDERS order status (list and detail), FX-PTL-CUS-DRAWINGS drawing approvals with
// markup, FX-PTL-CUS-SHIP shipment tracking, dossier and e-POD, FX-PTL-CUS-RETURNS returns request.
// Order status writes nothing; drawing decisions drive the design milestone exactly as the internal capture does; the e-POD
// acknowledgement is the electronic customer signature; the returns request creates an RMA request in Draft for internal
// approval, never an authorized RMA directly.

import { useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage, WizardPage, WorkbenchPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Empty, Field, Loading, Section, Tag, TargetFrame, useScreenState } from "../components"
import { ETO_MILESTONES, RETURN_REASONS, SHIPPED_SERIALS, type CusOrder, type CusShipment, type Transmittal } from "../data/portals"
import { customerName, matDesc, nid } from "../lib"
import { PortalBar, usePortalScope } from "./PortalCommon"

const DECISION = "Supplier and customer portals are a Book IX target-state module (Book IX §4; DEC-05 keeps email and paper at go-live)"
const EVIDENCE = "two suppliers and one customer completing their full loops for one month without email fallback, with the disclosure audit reviewed"
const FALLBACK = "Portal degraded: read works, writes fall back to the internal path (email customer service). Internal operations are not affected."

// ============================================================================ orders
export function CustomerOrders() {
  const s = useSlice("targetState")
  const scope = usePortalScope("customer")
  const st = useScreenState("cus-orders", { degraded: "Promise dates are refreshed hourly and the feed is late. Dates shown are from the last good refresh.", readOnly: "Order status is read only for customers in every state." })
  const rows = s.portal.orders.filter((o) => o.customerId === scope)
  const cols: Column<CusOrder>[] = [
    { id: "id", header: "Order", value: (o) => o.id, mono: true, sortable: true },
    { id: "pj", header: "Project", value: (o) => o.project },
    { id: "s", header: "Status", value: (o) => o.status, filterable: true, cell: (o) => <StatusBadge kind="salesOrder" status={o.status} size="sm" /> },
    { id: "np", header: "Next promise date", value: (o) => o.lines.flatMap((l) => l.schedules).filter((x) => x.state !== "Shipped").map((x) => x.promise).sort()[0] ?? "", cell: (o) => { const d = o.lines.flatMap((l) => l.schedules).filter((x) => x.state !== "Shipped").map((x) => x.promise).sort()[0]; return d ? fmtDate(d) : "All shipped" } },
    { id: "r", header: "At risk", value: (o) => (o.atRisk ? "At risk" : "On track"), filterable: true, cell: (o) => (o.atRisk ? <Chip kind="flag">At risk</Chip> : "On track") },
  ]
  return (
    <>
      <PortalBar kind="customer" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage header={{ title: "Your orders", screenId: "FX-PTL-CUS-ORDERS", chips: <Chip kind="design" note="The customer portal order screens write nothing">Read only</Chip>, description: "Orders with schedule lines, promise dates, a milestone strip for engineered-to-order work, and at-risk flags with the reason in plain language." }}
        table={{ rows: st.rows(rows), columns: cols, rowId: (o) => o.id, rowHref: (o) => `/target/portals/customer/orders/${o.id}`, searchText: (o) => `${o.id} ${o.project}`, loading: st.loading, empty: { title: "No order yet", body: "Orders placed by your company appear here once confirmed." } }} />
      <RulesPanel rules={[["CUS-1", "A customer sees only its own orders, structurally.", "Book IX §4.1"], ["CUS-2", "Order status writes nothing.", "Book IX §4.3"]]} />
    </>
  )
}

export function CustomerOrderDetail() {
  const { id } = useParams()
  const s = useSlice("targetState")
  const scope = usePortalScope("customer")
  const st = useScreenState("cus-order-detail")
  const o = s.portal.orders.find((x) => x.id === id)
  if (!o || o.customerId !== scope) return <><PortalBar kind="customer" /><EmptyState title="Order not found">No order {id} exists for your company. <Link className="text-link underline" to="/target/portals/customer/orders">Back to your orders</Link></EmptyState></>
  return (
    <>
      <PortalBar kind="customer" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: `Order ${o.id}`, screenId: "FX-PTL-CUS-ORDERS", crumbs: [{ label: "Your orders", to: "/target/portals/customer/orders" }, { label: o.id }], description: `${o.project} for ${customerName(o.customerId)}`, chips: <Chip kind="design">Read only</Chip> }}
        status={{ kind: "salesOrder", value: o.status }}
        summary={<><KV k="Project">{o.project}</KV><KV k="Lines">{o.lines.length}</KV><KV k="Type">{o.eto ? "Engineered to order" : "Standard"}</KV><KV k="Risk">{o.atRisk ? "At risk" : "On track"}</KV></>}
        tabs={[
          { id: "sched", label: "Schedule lines", content: st.loading ? <Loading /> : (
            <div className="flex flex-col gap-3">
              {o.atRisk && <p className="rounded-md border border-status-exception p-3 text-sm"><span className="font-semibold">At risk.</span> {o.atRisk}</p>}
              <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Requested</TableHead><TableHead>Promise date</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
                <TableBody>{o.lines.flatMap((l) => l.schedules.map((x, i) => <TableRow key={`${l.no}-${i}`}><TableCell>{l.no}</TableCell><TableCell className="whitespace-normal">{matDesc(l.materialId)}</TableCell><TableCell className="tabular text-right">{x.qty}</TableCell><TableCell>{fmtDate(x.date)}</TableCell><TableCell>{fmtDate(x.promise)}</TableCell><TableCell><Tag family={x.state === "Shipped" ? "done" : x.state === "At risk" ? "exception" : "active"} label={x.state} /></TableCell></TableRow>))}</TableBody></Table>
            </div>
          ) },
          ...(o.eto ? [{ id: "mile", label: "Milestones", content: (
            <ol className="flex flex-wrap gap-2" aria-label="Milestone strip">{ETO_MILESTONES.map((m, i) => <li key={m} aria-current={i === o.milestone ? "step" : undefined} className={`rounded-md border px-3 py-1 text-sm ${i < o.milestone ? "text-muted-foreground" : i === o.milestone ? "border-primary font-semibold" : "text-muted-foreground"}`}>{i < o.milestone ? "Done: " : i === o.milestone ? "Now: " : ""}{m}</li>)}</ol>
          ) }] : []),
        ]}
      />
    </>
  )
}

// ============================================================================ drawings
const DECISIONS = ["Approved", "Approved as noted", "Revise and resubmit"] as const
export function CustomerDrawings() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("customer")
  const st = useScreenState("cus-drawings", { degraded: FALLBACK, validation: "Validation: Approved as noted and Revise and resubmit need at least one markup comment; revise also needs a reason." })
  const [openId, setOpenId] = useState<string | null>(null)
  const [dec, setDec] = useState<(typeof DECISIONS)[number] | null>(null)
  const [text, setText] = useState("")
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const svg = useRef<SVGSVGElement>(null)
  const rows = s.portal.transmittals.filter((t) => t.customerId === scope)
  const t = rows.find((x) => x.id === openId)
  const locked = !!t?.response
  const cols: Column<Transmittal>[] = [
    { id: "id", header: "Transmittal", value: (x) => x.id, mono: true, sortable: true },
    { id: "so", header: "Order", value: (x) => x.soId },
    { id: "d", header: "Drawings", value: (x) => x.docs.map((q) => q.id).join(", ") },
    { id: "due", header: "Response due", value: (x) => x.dueOn, sortable: true, cell: (x) => fmtDate(x.dueOn) },
    { id: "r", header: "Your response", value: (x) => x.response?.decision ?? "Awaiting your response", filterable: true, cell: (x) => (x.response ? <Tag family={x.response.decision === "Revise and resubmit" ? "exception" : "done"} label={x.response.decision} /> : <Tag family="pending" label="Awaiting your response" />) },
  ]
  const addPin = () => st.run(() => {
    if (!t) return "Open a transmittal first."
    if (locked) return "This transmittal has a response; markup is locked."
    if (!text.trim()) return "Type the comment first."
    mutate((d) => { const x = d.portal.transmittals.find((q) => q.id === t.id)!; x.pins.push({ n: x.pins.length + 1, x: pos.x, y: pos.y, text: text.trim() }) })
    setText("")
  })
  const decide = (reason: string) => {
    const g = st.guard()
    if (g) return g
    if (!t || !dec) return "Choose a decision."
    if ((dec === "Approved as noted" || dec === "Revise and resubmit") && t.pins.length === 0) return `${dec} needs at least one markup comment so engineering knows what to change.`
    const r = mutate((d) => { d.portal.transmittals.find((q) => q.id === t.id)!.response = { decision: dec, at: "2026-10-09", by: d.portal.users.find((u) => u.id === d.portal.signedIn.customer)?.name ?? "Portal user" }; void reason })
    return r.ok ? null : r.error
  }
  return (
    <>
      <PortalBar kind="customer" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{ title: "Drawing approvals", screenId: "FX-PTL-CUS-DRAWINGS", description: "Transmittal packages with the released renditions. Comment and mark up, then respond: Approved, Approved as noted, or Revise and resubmit. The response drives the design milestone exactly as the internal capture does." }}
        kpis={[{ label: "Awaiting your response", value: rows.filter((x) => !x.response).length }, { label: "Approved", value: rows.filter((x) => x.response && x.response.decision !== "Revise and resubmit").length }, { label: "Sent back", value: rows.filter((x) => x.response?.decision === "Revise and resubmit").length }, { label: "Markup comments", value: rows.reduce((a, x) => a + x.pins.length, 0) }]}
        table={{ rows: st.rows(rows), columns: cols, rowId: (x) => x.id, onRowClick: (x) => setOpenId(x.id), activeId: openId ?? undefined, loading: st.loading, searchText: (x) => `${x.id} ${x.soId}`, empty: { title: "No drawing package", body: "Packages appear when engineering sends them for your approval." } }}
        panel={{ open: !!t, onOpenChange: (o) => !o && setOpenId(null), title: t?.id ?? "", description: t ? `For order ${t.soId}, sent ${fmtDate(t.sentOn)}, response due ${fmtDate(t.dueOn)}` : undefined,
          content: t && (
            <div className="flex flex-col gap-4">
              <Section title="Released renditions"><ul className="flex flex-col gap-1 text-sm">{t.docs.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2"><span className="font-mono">{d.id}</span> rev {d.rev}: {d.title}<span className="font-mono text-xs text-muted-foreground">{d.checksum}</span><Button size="sm" variant="outline" onClick={() => toast.success(`Download started: ${d.id} rev ${d.rev}`)}>Download</Button></li>)}</ul></Section>
              <Section title={locked ? "Markup (locked)" : "Markup: click the drawing to place a pin"}>
                <svg ref={svg} role="img" aria-label="Drawing rendition with markup pins" viewBox="0 0 100 70" className="w-full rounded-lg border bg-background text-muted-foreground" onClick={(e) => { if (locked || !svg.current) return; const r = svg.current.getBoundingClientRect(); setPos({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 70) }) }}>
                  <rect x="4" y="4" width="92" height="62" fill="none" stroke="currentColor" strokeWidth="0.4" />
                  <rect x="30" y="18" width="40" height="30" fill="none" stroke="currentColor" strokeWidth="0.6" />
                  <line x1="30" y1="48" x2="70" y2="48" stroke="currentColor" strokeWidth="0.3" /><line x1="40" y1="18" x2="40" y2="10" stroke="currentColor" strokeWidth="0.3" /><line x1="60" y1="18" x2="60" y2="10" stroke="currentColor" strokeWidth="0.3" />
                  <rect x="64" y="56" width="30" height="8" fill="none" stroke="currentColor" strokeWidth="0.3" /><text x="66" y="61" fontSize="2.6" fill="currentColor">{t.docs[0].id} rev {t.docs[0].rev}</text>
                  {t.pins.map((p) => <g key={p.n}><circle cx={p.x} cy={(p.y * 70) / 70} r="2.2" className="fill-primary" /><text x={p.x} y={p.y + 0.9} textAnchor="middle" fontSize="2.6" className="fill-primary-foreground">{p.n}</text></g>)}
                  {!locked && <circle cx={pos.x} cy={pos.y} r="1.4" fill="none" stroke="currentColor" strokeDasharray="1 1" strokeWidth="0.3" />}
                </svg>
                {!locked && <div className="flex gap-2"><Input aria-label="Markup comment" placeholder={`Comment at ${pos.x}, ${pos.y}`} value={text} onChange={(e) => setText(e.target.value)} /><Button variant="outline" disabled={st.locked} onClick={addPin}>Add comment</Button></div>}
                {t.pins.length === 0 ? <p className="text-sm text-muted-foreground">No comment yet.</p> : <ol className="list-decimal space-y-1 pl-5 text-sm">{t.pins.map((p) => <li key={p.n}>{p.text} <span className="text-xs text-muted-foreground">(at {p.x}, {p.y})</span></li>)}</ol>}
              </Section>
              {locked ? (
                <p className="rounded-md border p-3 text-sm"><span className="font-semibold">{t.response!.decision}</span> by {t.response!.by} on {fmtDate(t.response!.at)}. {t.response!.decision === "Revise and resubmit" ? "The design milestone stays open and engineering revises." : "The drawing approval milestone fires once, as it does for the internal capture."}</p>
              ) : <div className="flex flex-wrap gap-2">{DECISIONS.map((d, i) => <Button key={d} variant={i === 0 ? "default" : "outline"} disabled={st.locked} onClick={() => setDec(d)}>{d}</Button>)}</div>}
            </div>
          ) }}
      />
      {dec && t && <DialogShell open onOpenChange={(o) => !o && setDec(null)} title={`${dec}: ${t.id}`} requireReason={dec === "Revise and resubmit"} reasonLabel="What must change (required)" confirmLabel={`Send: ${dec}`} onConfirm={decide} consequence={dec === "Revise and resubmit" ? "Sends the package back to engineering. The design milestone stays open until you approve a revision." : "Records your decision and fires the drawing approval milestone, exactly as the internal capture does. It cannot be changed afterward."} />}
      <RulesPanel rules={[["CUS-3", "Approved, approved as noted, or revise and resubmit, driving the design milestone exactly as the internal capture does.", "Book IX §4.3"]]} />
    </>
  )
}

// ============================================================================ shipments
export function CustomerShipments() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("customer")
  const st = useScreenState("cus-ship", { degraded: "The carrier tracking feed is late. Carrier references and POD state may be hours old.", validation: "Validation: type your name and confirm receipt to sign." })
  const rows = s.portal.shipments.filter((x) => x.customerId === scope)
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null)
  const sh = rows.find((x) => x.id === openId)
  const [name, setName] = useState("")
  const [ok, setOk] = useState(false)
  const [damage, setDamage] = useState(false)
  const sign = () => st.run(() => {
    if (!sh) return "Choose a shipment."
    if (!name.trim()) return "Type your name: it is your electronic signature."
    if (!ok) return "Confirm that you received the shipment."
    const r = mutate((d) => { const x = d.portal.shipments.find((q) => q.id === sh.id)!; x.pod = damage ? "Exception" : "Received"; x.signedBy = name.trim(); x.signedAt = "2026-10-09" })
    if (!r.ok) return r.error
    setName(""); setOk(false)
    return { ok: damage ? "Receipt recorded with damage: a claim opens internally" : "Receipt acknowledged and signed" }
  })
  const cols: Column<CusShipment>[] = [
    { id: "d", header: "Delivery", value: (x) => x.deliveryId, mono: true, sortable: true },
    { id: "so", header: "Order", value: (x) => x.soId },
    { id: "s", header: "Delivery status", value: (x) => x.status, filterable: true, cell: (x) => <StatusBadge kind="delivery" status={x.status} size="sm" /> },
    { id: "c", header: "Carrier reference", value: (x) => `${x.carrier} ${x.pro}`, cell: (x) => <span>{x.carrier}<span className="block font-mono text-xs">{x.pro}</span></span> },
    { id: "hu", header: "HUs", value: (x) => x.hus.length, align: "right" },
    { id: "p", header: "POD", value: (x) => x.pod, filterable: true, cell: (x) => <StatusBadge kind="pod" status={x.pod} size="sm" /> },
  ]
  return (
    <>
      <PortalBar kind="customer" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <ListPage
        header={{ title: "Shipments", screenId: "FX-PTL-CUS-SHIP", description: "Deliveries, handling units, carrier references and POD state, the document dossier (packing list, certificate of conformance, final test report), and the electronic proof of delivery where you sign." }}
        table={{ rows: st.rows(rows), columns: cols, rowId: (x) => x.id, onRowClick: (x) => setOpenId(x.id), activeId: openId ?? undefined, searchText: (x) => `${x.deliveryId} ${x.soId} ${x.pro}`, loading: st.loading, empty: { title: "No shipment yet", body: "Shipments appear once a delivery is planned for your orders." } }}
        below={sh && (
          <section aria-label={`Shipment ${sh.deliveryId}`} className="grid gap-6 rounded-lg border p-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold">{sh.deliveryId} for {sh.soId}</h2>
              <dl className="grid grid-cols-2 gap-3"><KV k="Carrier">{sh.carrier}</KV><KV k="Carrier reference">{sh.pro}</KV><KV k="Handling units">{sh.hus.join(", ")}</KV><KV k="POD state"><StatusBadge kind="pod" status={sh.pod} /></KV></dl>
              <Section title="Document dossier">
                <ul className="flex flex-col gap-1 text-sm">{sh.dossier.map((d) => <li key={d.name} className="flex flex-wrap items-center gap-2"><Tag family="done" label={d.kind} />{d.name}<span className="font-mono text-xs text-muted-foreground">{d.checksum}</span><Button size="sm" variant="outline" onClick={() => toast.success(`Download started: ${d.name}`)}>Download</Button></li>)}</ul>
                <p className="text-xs text-muted-foreground">The final test report is available once final test closes; checksums let you verify what you downloaded.</p>
              </Section>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold">Proof of delivery</h2>
              {sh.pod === "Expected" && (sh.status === "Delivered/Closed" || sh.status === "PGI" || sh.status === "Loaded") ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">When the shipment arrives, acknowledge receipt here. Your typed name is your electronic signature.</p>
                  <Field label="Your name" id="ep-n"><Input id="ep-n" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={ok} onCheckedChange={(v) => setOk(!!v)} />I received this shipment.</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={damage} onCheckedChange={(v) => setDamage(!!v)} />There is damage or a shortage.</label>
                  <div><Button disabled={st.locked} onClick={sign}>Sign e-POD</Button></div>
                </div>
              ) : sh.pod === "Expected" ? <Empty>The proof of delivery opens when the shipment is loaded. Current status: {sh.status}.</Empty> : <p className="rounded-md border p-3 text-sm">POD {sh.pod}{sh.signedBy ? `, signed by ${sh.signedBy} on ${fmtDate(sh.signedAt)}` : ""}.</p>}
            </div>
          </section>
        )}
      />
    </>
  )
}

// ============================================================================ returns
export function CustomerReturns() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("customer")
  const st = useScreenState("cus-returns", { degraded: FALLBACK, validation: "Validation: choose a shipped serial, a reason, and describe the problem in at least 20 characters." })
  const serials = SHIPPED_SERIALS.filter((x) => x.customerId === scope)
  const open = (serial: string) => s.portal.returns.some((r) => r.serial === serial)
  const [f, setF] = useState({ serial: "", reason: "", desc: "", contact: "" })
  const [created, setCreated] = useState("")
  const steps = [
    { id: "s", title: "Shipped serial", content: serials.length === 0 ? <Empty>Your company has no shipped serial on record.</Empty> : (
      <Field label="Serial number" id="rt-s" hint="Only units shipped to your company are listed."><Select value={f.serial} onValueChange={(v) => setF({ ...f, serial: v })}><SelectTrigger id="rt-s"><SelectValue placeholder="Choose a serial" /></SelectTrigger><SelectContent>{serials.map((x) => <SelectItem key={x.serial} value={x.serial}>{x.serial}: {x.item} (shipped {fmtDate(x.shipped)}){open(x.serial) ? " , request open" : ""}</SelectItem>)}</SelectContent></Select></Field>), validate: () => (!f.serial ? "Choose the serial you want to return." : open(f.serial) ? `A return request for ${f.serial} is already open.` : null) },
    { id: "r", title: "Reason", content: (
      <div className="flex flex-col gap-3"><Field label="Reason code" id="rt-r"><Select value={f.reason} onValueChange={(v) => setF({ ...f, reason: v })}><SelectTrigger id="rt-r"><SelectValue placeholder="Choose a reason" /></SelectTrigger><SelectContent>{RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="What is wrong" id="rt-d" hint="At least 20 characters"><Textarea id="rt-d" rows={4} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
        <Chip kind="oq" id="OQ-TS07" note="The PRD says the request uses reason codes; the list of codes is not given. These are design values" /></div>), validate: () => (!f.reason ? "Choose a reason code." : f.desc.trim().length < 20 ? "Describe the problem in at least 20 characters." : null) },
    { id: "c", title: "Contact", content: <Field label="Contact name and phone or email" id="rt-c"><Input id="rt-c" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>, validate: () => (!f.contact.trim() ? "Tell us who to contact." : null) },
  ]
  const finish = () => {
    const g = st.guard()
    if (g) return g
    let id = ""
    const r = mutate((d) => { id = nid(d, "RMAREQ"); d.portal.returns.unshift({ id, customerId: scope, serial: f.serial, reason: f.reason, description: f.desc.trim(), contact: f.contact.trim(), createdOn: "2026-10-09", status: "Draft" }) })
    if (!r.ok) return r.error
    setCreated(id)
    return null
  }
  const mine = s.portal.returns.filter((x) => x.customerId === scope)
  return (
    <>
      <PortalBar kind="customer" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      {st.loading ? <Loading /> : created ? (
        <div className="flex max-w-2xl flex-col gap-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">Return request {created} sent</h1><p className="flex items-center gap-2 text-sm">Status <StatusBadge kind="rma" status="Draft" /></p><p className="text-sm">Our team reviews it. A return is authorized only after internal approval; this request is never an authorized return by itself.</p><div><Button onClick={() => { setCreated(""); setF({ serial: "", reason: "", desc: "", contact: "" }) }}>Request another</Button></div></div>
      ) : (
        <WizardPage header={{ title: "Request a return", screenId: "FX-PTL-CUS-RETURNS", description: "Start a return against a shipped serial with a reason code. It creates the RMA request in Draft for internal approval, never an authorized RMA directly." }} steps={steps} finishLabel="Send return request" consequence="Creates an RMA request in Draft for internal approval. Nothing is authorized until our team approves it." onFinish={finish} />
      )}
      {mine.length > 0 && <div className="mt-6"><Section title="Your return requests"><Table><TableHeader className="bg-table-head"><TableRow><TableHead>Request</TableHead><TableHead>Serial</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{mine.map((r) => <TableRow key={r.id}><TableCell className="font-mono">{r.id}</TableCell><TableCell>{r.serial}</TableCell><TableCell>{r.reason}</TableCell><TableCell><StatusBadge kind="rma" status={r.status} size="sm" /></TableCell></TableRow>)}</TableBody></Table></Section></div>}
    </>
  )
}
