// Supplier portal [Book IX §4.2]: FX-PTL-SUP-PO PO worklist and acknowledgement, FX-PTL-SUP-DEV deviation request,
// FX-PTL-SUP-ASN ASN creation, FX-PTL-SUP-STATUS invoice and payment status, scorecard and SCAR response.
// Same validations as the internal screens: an acknowledgement that differs from the order raises an exception and never
// overwrites it; STP version acceptance is explicit or a deviation request; the ASN pre-populates the GRN but receipt still
// posts only at the dock scan; invoice status is read only.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DashboardCard, DashboardPage, DetailPage, DialogShell, WizardPage, WorkbenchPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Empty, Field, Loading, Tag, TargetFrame, useScreenState } from "../components"
import { D8, type SupLine, type SupPo } from "../data/portals"
import { matDesc, money, nid, num, vendorName } from "../lib"
import { PortalBar, usePortalScope } from "./PortalCommon"

const DECISION = "Supplier and customer portals are a Book IX target-state module (Book IX §4; DEC-05 keeps email and paper at go-live)"
const EVIDENCE = "two suppliers and one customer completing their full loops for one month without email fallback, with the disclosure audit reviewed"
const FALLBACK = "Portal degraded: read works, writes fall back to the internal path (email your buyer). Internal operations are not affected."
const STP_CHARS: Record<string, string[]> = {
  "STP-000377": ["C1 Core loss at most 0.85 W/kg at 1.7 T", "C2 Thickness 0.23 mm, plus or minus 0.02", "C3 Insulation coating class C5"],
  "STP-000378": ["C1 17 tap positions", "C2 Basic insulation level 550 kV", "C3 Motor drive voltage 230 V"],
  "STP-000302": ["C1 Flange seal material fluoroelastomer", "C2 Creepage distance 25 mm per kV", "C3 Rated current 800 A"],
  "STP-000366": ["C1 Strand count and transposition pitch", "C2 Epoxy bond strength"],
  "STP-000361": ["C1 Core loss at most 0.85 W/kg at 1.7 T"],
}
const charsFor = (stp: string) => STP_CHARS[stp] ?? ["C1 Dimensional tolerance per the drawing package"]
const openStatus = (s: SupPo["status"]) => s !== "Received"
const earliest = (l: SupLine) => l.schedules[0]?.date ?? ""
const differs = (l: SupLine) => !!l.ack && (l.ack.qty !== l.qty || l.ack.price !== l.price || l.ack.date !== earliest(l))

// ============================================================================ PO worklist
interface PoRow { po: SupPo; l: SupLine }
export function SupplierPOs() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("supplier")
  const st = useScreenState("sup-po", { degraded: FALLBACK, offline: "You are offline. The worklist shows the last synced orders; acknowledgements wait for the connection. Your buyer can take the acknowledgement by email in the meantime." })
  const [queue, setQueue] = useState("todo")
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, { qty: string; date: string; price: string; stp: boolean }>>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const pos = s.portal.pos.filter((p) => p.vendorId === scope)
  const rows: PoRow[] = pos.flatMap((po) => po.lines.map((l) => ({ po, l })))
  const key = (p: SupPo, l: SupLine) => `${p.id}/${l.no}`
  const shown = rows.filter((r) => (queue === "todo" ? !r.l.ack && openStatus(r.po.status) : queue === "done" ? !!r.l.ack : true))
  const po = pos.find((p) => p.id === openId)
  const field = (p: SupPo, l: SupLine) => form[key(p, l)] ?? { qty: String(l.qty), date: earliest(l), price: String(l.price), stp: false }
  const setField = (p: SupPo, l: SupLine, patch: Partial<ReturnType<typeof field>>) => setForm({ ...form, [key(p, l)]: { ...field(p, l), ...patch } })
  const ack = (p: SupPo, l: SupLine) => st.run(() => {
    const f = field(p, l)
    const e: Record<string, string> = {}
    const qty = Number(f.qty), price = Number(f.price)
    if (!Number.isFinite(qty) || qty <= 0) e.qty = "Quantity must be greater than zero."
    if (!f.date) e.date = "Enter the confirmed date."
    else if (f.date < "2026-10-09") e.date = "The confirmed date cannot be in the past."
    if (!Number.isFinite(price) || price <= 0) e.price = "Price must be greater than zero."
    if (!f.stp) e.stp = `Accept STP ${l.stp.id} version ${l.stp.version} explicitly, or raise a deviation request.`
    setErr({ [key(p, l)]: Object.values(e)[0] ?? "" })
    if (Object.keys(e).length) return Object.values(e)[0]
    const r = mutate((d) => {
      const dp = d.portal.pos.find((q) => q.id === p.id)!
      const dl = dp.lines.find((q) => q.no === l.no)!
      dl.ack = { qty, date: f.date, price, stpAccepted: true, at: "2026-10-09", by: d.portal.users.find((u) => u.id === d.portal.signedIn.supplier)?.name ?? "Portal user" }
      if (dp.lines.every((x) => x.ack && !(x.ack.qty !== x.qty || x.ack.price !== x.price || x.ack.date !== earliest(x))) && dp.status === "Sent") dp.status = "Confirmed"
    })
    if (!r.ok) return r.error
    const diff = qty !== l.qty || price !== l.price || f.date !== earliest(l)
    return { ok: diff ? "Acknowledgement saved. It differs from the order, so it is raised as an exception for your buyer; the order is unchanged." : "Line acknowledged as ordered" }
  })
  const cols: Column<PoRow>[] = [
    { id: "po", header: "PO", value: (r) => r.po.id, mono: true, sortable: true },
    { id: "l", header: "Line", value: (r) => r.l.no, align: "right" },
    { id: "m", header: "Item", value: (r) => r.l.materialId, cell: (r) => <span>{r.l.materialId}<span className="block text-xs text-muted-foreground">{matDesc(r.l.materialId).slice(0, 46)}</span></span> },
    { id: "q", header: "Qty", align: "right", value: (r) => r.l.qty, cell: (r) => `${num(r.l.qty)} ${r.l.uom}` },
    { id: "pr", header: "Price", align: "right", value: (r) => r.l.price, cell: (r) => money(r.l.price, 2) },
    { id: "d", header: "Schedule", value: (r) => earliest(r.l), sortable: true, cell: (r) => r.l.schedules.map((x) => fmtDate(x.date)).join(", ") },
    { id: "stp", header: "STP", value: (r) => `${r.l.stp.id} v${r.l.stp.version}`, cell: (r) => <Chip kind="design" note="Supplier technical package version for this line">{r.l.stp.id} v{r.l.stp.version}</Chip> },
    { id: "s", header: "PO status", value: (r) => r.po.status, filterable: true, cell: (r) => <StatusBadge kind="purchaseOrder" status={r.po.status} size="sm" /> },
    { id: "a", header: "Acknowledgement", value: (r) => (r.l.ack ? (differs(r.l) ? "Exception" : "Acknowledged") : "Open"), filterable: true, cell: (r) => (r.l.ack ? (differs(r.l) ? <Tag family="exception" label="Exception: differs" /> : <Tag family="done" label="Acknowledged" />) : <Tag family="pending" label="To acknowledge" />) },
  ]
  return (
    <>
      <PortalBar kind="supplier" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <WorkbenchPage
        header={{ title: "Purchase orders", screenId: "FX-PTL-SUP-PO", description: "Open POs with lines, schedules and the STP version. Acknowledge each line with quantity, date, price and explicit STP version acceptance, or raise a deviation request." }}
        kpis={[{ label: "Open PO lines", value: rows.filter((r) => openStatus(r.po.status)).length }, { label: "To acknowledge", value: rows.filter((r) => !r.l.ack && openStatus(r.po.status)).length }, { label: "Exceptions", value: rows.filter((r) => differs(r.l)).length, hint: "Differ from the order" }, { label: "Deviation requests", value: s.portal.deviations.filter((d) => d.vendorId === scope).length }]}
        queues={[{ id: "todo", label: "To acknowledge", count: rows.filter((r) => !r.l.ack && openStatus(r.po.status)).length }, { id: "done", label: "Acknowledged", count: rows.filter((r) => !!r.l.ack).length }, { id: "all", label: "All lines", count: rows.length }]}
        queue={queue}
        onQueueChange={setQueue}
        table={{ rows: st.rows(shown), columns: cols, rowId: (r) => key(r.po, r.l), onRowClick: (r) => setOpenId(r.po.id), activeId: po && openId ? undefined : undefined, searchText: (r) => `${r.po.id} ${r.l.materialId}`, loading: st.loading, empty: { title: "No order in this queue", body: "Only POs sent to your company appear here; drafts and orders in approval are not visible to suppliers." } }}
        panel={{ open: !!po, onOpenChange: (o) => !o && setOpenId(null), title: po ? `PO ${po.id}` : "", description: po ? `Sent ${fmtDate(po.sentOn)} to ${vendorName(po.vendorId)}` : undefined,
          content: po && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge kind="purchaseOrder" status={po.status} /><Button variant="outline" size="sm" onClick={() => toast.success(`Download started: ${po.drawing.name} (${po.drawing.size}). Checksum ${po.drawing.checksum}`)}>Download drawing package</Button><span className="font-mono text-xs">{po.drawing.checksum}</span></div>
              {po.lines.map((l) => { const f = field(po, l); return (
                <section key={l.no} aria-label={`Line ${l.no}`} className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="font-medium">Line {l.no}: {matDesc(l.materialId)}</p>
                  <p className="text-sm text-muted-foreground">{num(l.qty)} {l.uom} at {money(l.price, 2)}; schedule {l.schedules.map((x) => `${num(x.qty)} on ${fmtDate(x.date)}`).join("; ")}. <Chip kind="design">{l.stp.id} v{l.stp.version}</Chip></p>
                  {l.ack ? (
                    <p className="text-sm">Acknowledged on {fmtDate(l.ack.at)} by {l.ack.by}: {num(l.ack.qty)} on {fmtDate(l.ack.date)} at {money(l.ack.price, 2)}; STP version accepted. {differs(l) && <span className="font-semibold text-destructive">Differs from the order: exception raised for the buyer.</span>}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Quantity" id={`aq-${l.no}`}><Input id={`aq-${l.no}`} inputMode="numeric" value={f.qty} onChange={(e) => setField(po, l, { qty: e.target.value })} /></Field>
                        <Field label="Date" id={`ad-${l.no}`}><Input id={`ad-${l.no}`} type="date" value={f.date} onChange={(e) => setField(po, l, { date: e.target.value })} /></Field>
                        <Field label="Price" id={`ap-${l.no}`}><Input id={`ap-${l.no}`} inputMode="decimal" value={f.price} onChange={(e) => setField(po, l, { price: e.target.value })} /></Field>
                      </div>
                      <label className="flex items-start gap-2 text-sm"><Checkbox checked={f.stp} onCheckedChange={(v) => setField(po, l, { stp: !!v })} />I accept STP {l.stp.id} version {l.stp.version}.</label>
                      {err[key(po, l)] && <p role="alert" className="text-xs text-destructive">{err[key(po, l)]}</p>}
                      <div className="flex gap-2"><Button size="sm" disabled={st.locked} onClick={() => ack(po, l)}>Acknowledge line</Button><Button asChild size="sm" variant="outline"><Link to={`/target/portals/supplier/deviations?po=${po.id}&line=${l.no}`}>Request a deviation</Link></Button></div>
                    </div>
                  )}
                </section>) })}
            </div>
          ) }}
      />
      <RulesPanel rules={[["SUP-1", "Acknowledgement per line: quantity, date, price, and explicit STP version acceptance or a deviation request.", "Book IX §4.2"], ["SUP-2", "A deviation raises the exception state and never silently overwrites the order.", "Book IX §5.1 (855 binding), same rule"], ["SUP-3", "A vendor sees only its own POs, structurally.", "Book IX §4.1"]]} />
    </>
  )
}

// ============================================================================ deviations
export function SupplierDeviations() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("supplier")
  const [sp] = useSearchParams()
  const st = useScreenState("sup-dev", { validation: "Validation: choose a PO line and the STP characteristic; describe the proposal in at least 20 characters; a concession needs evidence attached.", degraded: FALLBACK })
  const pos = s.portal.pos.filter((p) => p.vendorId === scope && openStatus(p.status))
  const [f, setF] = useState({ po: sp.get("po") ?? "", line: sp.get("line") ?? "", char: "", type: "Alternate" as "Alternate" | "Concession", proposal: "", qty: "", file: "" })
  const [err, setErr] = useState<Record<string, string>>({})
  const [done, setDone] = useState("")
  const po = pos.find((p) => p.id === f.po)
  const line = po?.lines.find((l) => String(l.no) === f.line)
  const mine = s.portal.deviations.filter((d) => d.vendorId === scope)
  const submit = () => st.run(() => {
    const e: Record<string, string> = {}
    if (!po) e.po = "Choose a PO."
    if (po && !line) e.line = "Choose a line."
    if (!f.char) e.char = "Choose the STP characteristic the proposal is against."
    if (f.proposal.trim().length < 20) e.proposal = "Describe the proposal in at least 20 characters."
    const q = Number(f.qty)
    if (line && (!Number.isFinite(q) || q <= 0 || q > line.qty)) e.qty = `Quantity affected is 1 to ${line.qty}.`
    if (f.type === "Concession" && !f.file.trim()) e.file = "A concession needs evidence attached (file name)."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    let id = ""
    const r = mutate((d) => {
      d.portal.seq += 1
      id = `DEV-2026-${String(d.portal.seq).padStart(4, "0")}`
      d.portal.deviations.unshift({ id, vendorId: scope, poId: po!.id, lineNo: line!.no, stpChar: f.char, type: f.type, proposal: f.proposal.trim(), qty: q, attachment: f.file.trim() || undefined, createdOn: "2026-10-09", routedTo: ["Engineering", "Quality"], by: d.portal.users.find((u) => u.id === d.portal.signedIn.supplier)?.name ?? "Portal user" })
      d.portal.pos.find((p) => p.id === po!.id)!.lines.find((l) => l.no === line!.no)!.deviationId = id
    })
    if (!r.ok) return r.error
    setDone(id)
    setF({ ...f, char: "", proposal: "", qty: "", file: "" })
    return { ok: `Deviation record ${id} created and routed to engineering and quality` }
  })
  return (
    <>
      <PortalBar kind="supplier" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: "Deviation request", screenId: "FX-PTL-SUP-DEV", description: "A structured alternate or concession proposal against a PO line and an STP characteristic. It creates the supplier deviation record, routed to engineering and quality." }}
        summary={<><KV k="Supplier">{vendorName(scope)}</KV><KV k="Open requests">{mine.length}</KV><KV k="Routing">Engineering and Quality</KV><KV k="Record format">DEV-yyyy-nnnn</KV></>}
        tabs={[
          { id: "new", label: "New request", content: st.loading ? <Loading /> : (
            <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
              <Field label="PO" id="dv-p" error={err.po}><Select value={f.po} onValueChange={(v) => setF({ ...f, po: v, line: "", char: "" })}><SelectTrigger id="dv-p"><SelectValue placeholder="Choose a PO" /></SelectTrigger><SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Line" id="dv-l" error={err.line}><Select value={f.line} onValueChange={(v) => setF({ ...f, line: v, char: "" })}><SelectTrigger id="dv-l"><SelectValue placeholder="Choose a line" /></SelectTrigger><SelectContent>{(po?.lines ?? []).map((l) => <SelectItem key={l.no} value={String(l.no)}>{l.no}: {l.materialId}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="STP characteristic" id="dv-c" error={err.char}><Select value={f.char} onValueChange={(v) => setF({ ...f, char: v })} disabled={!line}><SelectTrigger id="dv-c"><SelectValue placeholder={line ? "Choose a characteristic" : "Choose a line first"} /></SelectTrigger><SelectContent>{(line ? charsFor(line.stp.id) : []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Type" id="dv-t"><Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as "Alternate" | "Concession" })}><SelectTrigger id="dv-t"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Alternate">Alternate (a different material or process)</SelectItem><SelectItem value="Concession">Concession (accept as is)</SelectItem></SelectContent></Select></Field>
              <div className="sm:col-span-2"><Field label="Proposal" id="dv-pr" error={err.proposal}><Textarea id="dv-pr" rows={4} value={f.proposal} onChange={(e) => setF({ ...f, proposal: e.target.value })} /></Field></div>
              <Field label={`Quantity affected${line ? ` (up to ${line.qty})` : ""}`} id="dv-q" error={err.qty}><Input id="dv-q" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
              <Field label={f.type === "Concession" ? "Evidence file (required)" : "Supporting file (optional)"} id="dv-f" error={err.file}><Input id="dv-f" value={f.file} placeholder="measurement-report.pdf" onChange={(e) => setF({ ...f, file: e.target.value })} /></Field>
              <div className="sm:col-span-2 flex items-center gap-3"><Button disabled={st.locked} onClick={submit}>Submit deviation request</Button>{done && <span role="status" className="text-sm">Created {done}. <Link className="text-link underline" to="/target/portals/supplier/orders">Back to orders</Link></span>}</div>
            </div>
          ) },
          { id: "mine", label: "My requests", count: mine.length, content: mine.length === 0 || st.empty ? <Empty>No deviation request yet. A request against a line stays visible here with its routing.</Empty> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Record</TableHead><TableHead>PO line</TableHead><TableHead>STP characteristic</TableHead><TableHead>Type</TableHead><TableHead>Routed to</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
              <TableBody>{mine.map((d) => <TableRow key={d.id}><TableCell className="font-mono">{d.id}</TableCell><TableCell>{d.poId} / {d.lineNo}</TableCell><TableCell className="max-w-xs whitespace-normal text-sm">{d.stpChar}</TableCell><TableCell>{d.type}</TableCell><TableCell>{d.routedTo.join(", ")}</TableCell><TableCell className="text-sm">Awaiting engineering and quality <Chip kind="oq" id="OQ-21" note="The deviation record has no status list in the specification" /></TableCell></TableRow>)}</TableBody></Table>
          ) },
        ]}
      />
    </>
  )
}

// ============================================================================ ASN wizard
export function SupplierASN() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("supplier")
  const st = useScreenState("sup-asn", { degraded: FALLBACK, validation: "Validation: ship date, quantities within open schedule quantity, a batch or heat and a certificate on every line, every line in a package." })
  const pos = s.portal.pos.filter((p) => p.vendorId === scope && (p.status === "Confirmed" || p.status === "Partially Received" || p.status === "Sent"))
  const [h, setH] = useState({ po: "", ship: "2026-10-12", carrier: "", track: "" })
  const [qty, setQty] = useState<Record<string, string>>({})
  const [bc, setBc] = useState<Record<string, { batch: string; cert: string }>>({})
  const [pk, setPk] = useState<Record<string, string>>({})
  const [pkgType, setPkgType] = useState("Pallet")
  const [created, setCreated] = useState("")
  const po = pos.find((p) => p.id === h.po)
  const openSched = (p: SupPo) => p.lines.flatMap((l) => l.schedules.map((x) => { const shipped = s.portal.asns.filter((a) => a.poId === p.id).flatMap((a) => a.lines).filter((q) => q.poLine === l.no && q.schedule === x.date).reduce((a, q) => a + q.qty, 0); return { l, date: x.date, open: x.qty - shipped, key: `${l.no}|${x.date}` } })).filter((x) => x.open > 0)
  const sched = po ? openSched(po) : []
  const chosen = sched.filter((x) => Number(qty[x.key]) > 0)
  const steps = [
    { id: "h", title: "Shipment header", content: (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Purchase order" id="as-p"><Select value={h.po} onValueChange={(v) => { setH({ ...h, po: v }); setQty({}) }}><SelectTrigger id="as-p"><SelectValue placeholder="Choose a PO" /></SelectTrigger><SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Ship date" id="as-d"><Input id="as-d" type="date" value={h.ship} onChange={(e) => setH({ ...h, ship: e.target.value })} /></Field>
        <Field label="Carrier" id="as-c"><Input id="as-c" value={h.carrier} onChange={(e) => setH({ ...h, carrier: e.target.value })} /></Field>
        <Field label="Tracking or bill of lading" id="as-t"><Input id="as-t" value={h.track} onChange={(e) => setH({ ...h, track: e.target.value })} /></Field>
      </div>), validate: () => (!h.po ? "Choose the purchase order." : h.ship < "2026-10-09" ? "The ship date cannot be in the past." : !h.carrier.trim() ? "Name the carrier." : null) },
    { id: "l", title: "Lines against open schedules", content: sched.length === 0 ? <Empty>No open schedule on this PO: everything is already on an ASN.</Empty> : (
      <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>Schedule</TableHead><TableHead className="text-right">Open</TableHead><TableHead>Ship now</TableHead></TableRow></TableHeader>
        <TableBody>{sched.map((x) => <TableRow key={x.key}><TableCell>{x.l.no}: {x.l.materialId}</TableCell><TableCell>{fmtDate(x.date)}</TableCell><TableCell className="tabular text-right">{num(x.open)} {x.l.uom}</TableCell><TableCell><Input aria-label={`Ship quantity for line ${x.l.no} ${x.date}`} className="w-28" inputMode="numeric" value={qty[x.key] ?? ""} onChange={(e) => setQty({ ...qty, [x.key]: e.target.value })} /></TableCell></TableRow>)}</TableBody></Table>),
      validate: () => { if (chosen.length === 0) return "Enter a quantity on at least one schedule."; const over = sched.find((x) => Number(qty[x.key]) > x.open); return over ? `Line ${over.l.no} on ${over.date}: at most ${over.open} is open.` : null } },
    { id: "b", title: "Batch or heat and certificate", content: (
      <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>Batch or heat</TableHead><TableHead>Certificate file</TableHead></TableRow></TableHeader>
        <TableBody>{chosen.map((x) => <TableRow key={x.key}><TableCell>{x.l.no}: {qty[x.key]} {x.l.uom}</TableCell><TableCell><Input aria-label={`Batch for line ${x.l.no}`} value={bc[x.key]?.batch ?? ""} onChange={(e) => setBc({ ...bc, [x.key]: { batch: e.target.value, cert: bc[x.key]?.cert ?? "" } })} /></TableCell><TableCell><Input aria-label={`Certificate for line ${x.l.no}`} placeholder="mill-cert.pdf" value={bc[x.key]?.cert ?? ""} onChange={(e) => setBc({ ...bc, [x.key]: { batch: bc[x.key]?.batch ?? "", cert: e.target.value } })} /></TableCell></TableRow>)}</TableBody></Table>),
      validate: () => { const m = chosen.find((x) => !bc[x.key]?.batch?.trim() || !bc[x.key]?.cert?.trim()); return m ? `Line ${m.l.no}: a batch or heat number and a certificate are required.` : null } },
    { id: "p", title: "Package structure", content: (
      <div className="flex flex-col gap-3">
        <Field label="Package type" id="as-pt"><Select value={pkgType} onValueChange={setPkgType}><SelectTrigger id="as-pt" className="w-48"><SelectValue /></SelectTrigger><SelectContent>{["Pallet", "Coil on skid", "Crate", "Box"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>
        <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>Package number</TableHead></TableRow></TableHeader>
          <TableBody>{chosen.map((x) => <TableRow key={x.key}><TableCell>{x.l.no}: {qty[x.key]} {x.l.uom}</TableCell><TableCell><Input aria-label={`Package for line ${x.l.no}`} className="w-40" placeholder="PKG-1" value={pk[x.key] ?? ""} onChange={(e) => setPk({ ...pk, [x.key]: e.target.value })} /></TableCell></TableRow>)}</TableBody></Table>
      </div>), validate: () => (chosen.find((x) => !pk[x.key]?.trim()) ? "Put every line in a package." : null) },
  ]
  const finish = () => {
    const g = st.guard()
    if (g) return g
    let id = ""
    const r = mutate((d) => {
      id = nid(d, "ASN")
      const pkgs: Record<string, number[]> = {}
      for (const x of chosen) (pkgs[pk[x.key].trim()] ??= []).push(x.l.no)
      d.portal.asns.unshift({ id, vendorId: scope, poId: h.po, shipDate: h.ship, carrier: h.carrier.trim(), tracking: h.track.trim(), createdOn: "2026-10-09", lines: chosen.map((x) => ({ poLine: x.l.no, schedule: x.date, qty: Number(qty[x.key]), batch: bc[x.key].batch.trim(), cert: bc[x.key].cert.trim() })), packages: Object.entries(pkgs).map(([n, lines]) => ({ id: n, type: pkgType, lines })) })
    })
    if (!r.ok) return r.error
    setCreated(id)
    return null
  }
  return (
    <>
      <PortalBar kind="supplier" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      {created ? (
        <div className="flex max-w-2xl flex-col gap-3 rounded-lg border p-6"><h1 className="text-xl font-semibold">ASN {created} created</h1><p className="text-sm">The inbound ASN now pre-populates the goods receipt. Receipt still posts only at the dock scan; nothing is received until then.</p>
          <div className="flex gap-2"><Button onClick={() => { setCreated(""); setH({ po: "", ship: "2026-10-12", carrier: "", track: "" }); setQty({}); setBc({}); setPk({}) }}>Create another</Button><Button asChild variant="outline"><Link to="/target/portals/supplier/orders">Back to orders</Link></Button></div></div>
      ) : st.loading ? <Loading /> : (
        <WizardPage header={{ title: "Create an advance ship notice", screenId: "FX-PTL-SUP-ASN", description: "Shipment header, lines against open PO schedules, batch or heat and certificate per line, package structure. It creates the inbound ASN that pre-populates the GRN." }} steps={steps} finishLabel="Create ASN" consequence="Creates the inbound ASN for the purchasing and receiving teams. It pre-populates the GRN; receipt posts only at the dock scan." onFinish={finish} />
      )}
    </>
  )
}

// ============================================================================ status
export function SupplierStatus() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = usePortalScope("supplier")
  const st = useScreenState("sup-status", { degraded: "The invoice matching feed is late: match states may be a day old. Showing the last good data. Writes (SCAR responses) still work.", validation: "Validation: the 8D response needs D1 to D5 completed before it can be submitted." })
  const [scar, setScar] = useState<string | null>(null)
  const [d8, setD8] = useState<Record<string, string>>({})
  const inv = s.portal.invoices.filter((i) => i.vendorId === scope)
  const card = s.portal.scorecards.find((c) => c.vendorId === scope)
  const scars = s.portal.scars.filter((x) => x.vendorId === scope)
  const sc = scars.find((x) => x.id === scar)
  const cfg: ChartConfig = { onTime: { label: "On time %", color: "var(--chart-3)" }, quality: { label: "Quality %", color: "var(--chart-5)" } }
  const submit = (_r: string) => {
    const g = st.guard()
    if (g) return g
    const miss = D8.slice(0, 5).find((k) => !(d8[k] ?? "").trim())
    if (miss) return `${miss} is required before the response can be submitted.`
    const r = mutate((d) => { const x = d.portal.scars.find((q) => q.id === sc!.id)!; x.d8 = { ...x.d8, ...d8 }; x.state = "Response submitted"; x.submittedOn = "2026-10-09" })
    return r.ok ? null : r.error
  }
  return (
    <>
      <PortalBar kind="supplier" />
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DashboardPage
        header={{ title: "Invoices, payments, scorecard and SCARs", screenId: "FX-PTL-SUP-STATUS", description: "Invoice and payment status is read only: the match state per invoice, the discrepancy in plain words, and the remittance history. The scorecard shows your on-time and quality ratings. SCAR responses use the 8D structure." }}
        tiles={[{ label: "Invoices held", value: inv.filter((i) => i.match.startsWith("Held") || i.match.startsWith("Rejected")).length, tone: inv.some((i) => i.match.startsWith("Held")) ? "attention" : "default" }, { label: "On time", value: card ? `${card.onTime}%` : "No rating" }, { label: "Quality", value: card ? `${card.quality}%` : "No rating" }, { label: "Open SCARs", value: scars.filter((x) => x.state !== "Response submitted").length, tone: scars.some((x) => x.state === "Overdue") ? "attention" : "default" }]}
      >
        <DashboardCard title="Invoice match state and payment (read only)" className="lg:col-span-2">
          {st.loading ? <Loading /> : inv.length === 0 || st.empty ? <Empty>No invoice from your company yet.</Empty> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Invoice</TableHead><TableHead>PO</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Match state</TableHead><TableHead>What it means</TableHead><TableHead>Remittance</TableHead></TableRow></TableHeader>
              <TableBody>{inv.map((i) => <TableRow key={i.id}><TableCell className="font-mono">{i.id}</TableCell><TableCell>{i.poId}</TableCell><TableCell className="tabular text-right">{money(i.amount, 2)}</TableCell><TableCell><Tag family={i.match === "Matched" ? "done" : i.match === "Awaiting receipt" ? "pending" : "exception"} label={i.match} /></TableCell><TableCell className="max-w-md whitespace-normal text-sm">{i.reason}</TableCell><TableCell className="text-sm">{i.remits.length ? i.remits.map((r) => `${fmtDate(r.date)}: ${money(r.amount, 2)} (${r.ref})`).join("; ") : i.paid ? "Paid" : "Not paid yet"}</TableCell></TableRow>)}</TableBody></Table>
          )}
          <p className="text-xs text-muted-foreground">Match states follow the three-way match. <Chip kind="oq" id="OQ-TS06" note="The PRD lists no match-state words; these are readings of three-way match outcomes" /></p>
        </DashboardCard>
        <DashboardCard title="Scorecard">
          {card ? (
            <>
              <ChartContainer config={cfg} className="h-48 w-full"><LineChart data={card.trend}><CartesianGrid vertical={false} /><XAxis dataKey="m" tickLine={false} axisLine={false} /><YAxis domain={[70, 100]} width={32} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line isAnimationActive={false} dataKey="onTime" stroke="var(--color-onTime)" strokeWidth={2} dot /><Line isAnimationActive={false} dataKey="quality" stroke="var(--color-quality)" strokeWidth={2} strokeDasharray="4 4" dot /></LineChart></ChartContainer>
              <p className="text-xs text-muted-foreground">On-time delivery (solid) and quality acceptance (dashed), last six months.</p>
            </>
          ) : <Empty>No rating yet for your company.</Empty>}
        </DashboardCard>
        <DashboardCard title="Open SCARs and 8D responses">
          {scars.length === 0 || st.empty ? <Empty>No SCAR open against your company.</Empty> : (
            <ul className="flex flex-col gap-2">{scars.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="font-mono">{x.id}</span><span className="min-w-0 flex-1">{x.title}</span><span>Due {fmtDate(x.due)}</span><Tag family={x.state === "Overdue" ? "exception" : x.state === "Open" ? "pending" : "done"} label={x.state} />{x.state !== "Response submitted" && <Button size="sm" disabled={st.locked} onClick={() => { setD8(x.d8); setScar(x.id) }}>Respond (8D)</Button>}</li>)}</ul>
          )}
          <p className="text-xs text-muted-foreground">SCAR has no status list in the specification. <Chip kind="oq" id="OQ-21" /></p>
        </DashboardCard>
      </DashboardPage>
      {sc && <DialogShell open onOpenChange={(o) => !o && setScar(null)} wide title={`8D response to ${sc.id}`} description={sc.title} confirmLabel="Submit response" onConfirm={submit} consequence={`Sends your 8D response to Quality for ${sc.id}. Quality reviews it; the SCAR stays open until they accept.`}>
        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">{D8.map((k, i) => <Field key={k} label={`${k}${i < 5 ? " (required)" : ""}`} id={`d8-${i}`}><Textarea id={`d8-${i}`} rows={2} value={d8[k] ?? ""} onChange={(e) => setD8({ ...d8, [k]: e.target.value })} /></Field>)}</div>
        <p className="text-xs text-muted-foreground">Required steps D1 to D5 are a reading. <Chip kind="oq" id="OQ-TS05" note="The PRD says the responses use the 8D structure; it does not say which steps must be complete to submit" /></p>
      </DialogShell>}
    </>
  )
}
