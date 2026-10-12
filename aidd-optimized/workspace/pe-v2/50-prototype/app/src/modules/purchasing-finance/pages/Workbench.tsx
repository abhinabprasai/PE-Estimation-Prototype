// PUR-WB-001 Buyer Workbench [DOC:p.266-267] (asserted); rules Book I G §1.
// PR queue by buyer code, MRP exceptions for buy items, unconfirmed PO list, source gaps.
// Primary actions: source and group PRs into POs; jump to RFQ where policy demands.
// PUR-EXP-001 Expedite Board [DOC:p.268] (asserted); rules Book I G §7: cards for reschedule and
// past-due exceptions with pegged order exposure, action log per vendor contact; record promises,
// push and pull dates, escalate.
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Gavel, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkbenchPage } from "@/components/templates"
import { Chip, KV, StatusBadge, type Column } from "@/components/patterns"
import { THRESHOLDS, type VendorId } from "@/data/domain"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { expedite, groupIntoPos, startRfq } from "../data/actions"
import { allAvl, businessDaysBetween, isUnconfirmedOverdue, itemText, poTotal, prTotal, vendorEligibility, vendorName, vendorOf } from "../data/logic"
import type { MrpException } from "../data/types"
import { DocLink, Reading, report, Section, useDemoState } from "../components/common"
import { ItemLink, SelectField, userName } from "../components/bits"
import { TODAY } from "@/data/shared"
import { ExpediteFields } from "./PurchaseOrders"

type Queue = "prs" | "exceptions" | "unconfirmed" | "gaps"
interface Row {
  id: string
  queue: Queue
  doc: { type: "requisition" | "purchaseOrder" | "plannedOrder"; id: string }
  itemId: string
  text: string
  value: number
  date?: string
  vendorId?: string
  status?: { kind: "requisition" | "purchaseOrder"; value: string }
  buyerId: string
  flag?: string
}
const BUYERS = [
  { value: "all", label: "All buyer codes" },
  { value: "USR-TBD-039", label: "B01 Olivia Grant" },
  { value: "USR-TBD-040", label: "B02 Ahmed Karimi" },
]

export function BuyerWorkbench() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-WB-001")
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [queue, setQueue] = useState<Queue>("prs")
  const [buyer, setBuyer] = useState("all")
  const [active, setActive] = useState<string | null>(sp.get("pr"))
  const [vendorFor, setVendorFor] = useState<Record<string, VendorId>>({})
  const mine = (b: string) => buyer === "all" || b === buyer

  const all = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const r of s.requisitions) {
      if ((r.status === "Approved" || r.status === "Open" || r.status === "In Approval") && !r.poIds.length) {
        const gap = !r.suggestedVendorId || !allAvl(s).some((a) => r.lines.some((l) => l.itemId === a.itemId) && a.status !== "Suspended")
        const row: Row = { id: r.id, queue: gap ? "gaps" : "prs", doc: { type: "requisition", id: r.id }, itemId: r.lines[0]?.itemId ?? "", text: r.title, value: prTotal(r.lines), date: r.lines[0]?.needBy, vendorId: r.suggestedVendorId, status: { kind: "requisition", value: r.status }, buyerId: r.buyerId }
        if (row.value > THRESHOLDS.rfqRequiredAbove && !r.rfqId) {
          const avl = allAvl(s).find((a) => a.vendorId === r.suggestedVendorId && r.lines.some((l) => l.itemId === a.itemId))
          if (!avl || !/info record|contract|award/i.test(avl.priceBasis)) row.flag = "RFQ by policy"
        }
        if (r.rfqId) row.flag = `RFQ ${r.rfqId}`
        out.push(row)
      }
    }
    for (const x of s.mrpExceptions.filter((e) => !e.done))
      out.push({ id: x.id, queue: "exceptions", doc: x.poId ? { type: "purchaseOrder", id: x.poId } : { type: "plannedOrder", id: x.peg?.id ?? "" }, itemId: x.itemId, text: `${x.code} ${x.text}`, value: 0, date: x.suggestedDate, buyerId: x.buyerId, flag: x.code })
    for (const p of s.purchaseOrders.filter((p) => p.status === "Sent"))
      out.push({ id: p.id, queue: "unconfirmed", doc: { type: "purchaseOrder", id: p.id }, itemId: p.lines[0]?.itemId ?? "", text: p.title, value: poTotal(p), date: p.sentOn, vendorId: p.vendorId, status: { kind: "purchaseOrder", value: p.status }, buyerId: p.buyerId, flag: isUnconfirmedOverdue(p) ? `${businessDaysBetween(p.sentOn!, TODAY)} business days` : undefined })
    return out
  }, [s])
  const rows = all.filter((r) => r.queue === queue && mine(r.buyerId))
  const count = (q: Queue) => all.filter((r) => r.queue === q && mine(r.buyerId)).length
  const act = all.find((r) => r.id === active)
  const pr = act?.doc.type === "requisition" ? s.requisitions.find((r) => r.id === act.id) : undefined

  const cols: Column<Row>[] = [
    { id: "id", header: queue === "exceptions" ? "Exception" : "Document", value: (r) => r.id, mono: true, sortable: true, cell: (r) => (r.queue === "exceptions" ? r.id : <DocLink r={r.doc} />) },
    { id: "item", header: "Item", value: (r) => r.itemId, cell: (r) => <ItemLink id={r.itemId} /> },
    { id: "text", header: "Description", value: (r) => r.text, cell: (r) => <span className="line-clamp-2 max-w-[300px]">{r.text}</span> },
    { id: "vendor", header: "Source", value: (r) => vendorName(s, r.vendorId), cell: (r) => (r.vendorId ? vendorName(s, r.vendorId) : <Chip kind="flag">No source</Chip>) },
    { id: "value", header: "Value", value: (r) => r.value, align: "right", mono: true, sortable: true, cell: (r) => (r.value ? fmtMoney(r.value) : "") },
    { id: "date", header: queue === "unconfirmed" ? "Sent" : queue === "exceptions" ? "Suggested date" : "Need by", value: (r) => r.date ?? "", sortable: true, cell: (r) => fmtDate(r.date) },
    { id: "buyer", header: "Buyer", value: (r) => userName(r.buyerId), filterable: true },
    { id: "status", header: "Status", value: (r) => r.status?.value ?? "", cell: (r) => (r.status ? <StatusBadge kind={r.status.kind} status={r.status.value} size="sm" /> : "") },
    { id: "flag", header: "Flags", value: (r) => r.flag ?? "", filterable: true, cell: (r) => (r.flag ? <Chip kind="flag">{r.flag}</Chip> : "") },
  ]

  return (
    <WorkbenchPage
      header={{
        screenId: "PUR-WB-001",
        title: "Buyer workbench",
        description: "Source approved requisitions and group them into POs, one per vendor. Policy sends new items, expiring agreements and uncontracted spend above $25,000 to an RFQ.",
        chips: <Reading id="OQ-PF-4" />,
        actions: (
          <>
            {st.menu}
            <div className="w-56">
              <SelectField id="wb-buyer" label="Buyer code" value={buyer} onChange={setBuyer} options={BUYERS} />
            </div>
            <Button variant="outline" onClick={() => nav("/purchasing/expedite")}>
              Expedite board
            </Button>
          </>
        ),
      }}
      kpis={[
        { label: "Requisitions to source", value: count("prs"), hint: "Approved or awaiting approval, no PO yet" },
        { label: "MRP exceptions (buy items)", value: count("exceptions"), hint: "EX-01, EX-02, EX-03, EX-06" },
        { label: "Unconfirmed POs", value: all.filter((r) => r.queue === "unconfirmed" && r.flag && mine(r.buyerId)).length, hint: `Sent more than ${THRESHOLDS.unconfirmedPoBusinessDays} business days` },
        { label: "Source gaps", value: count("gaps"), hint: "No AVL source (E-PUR-02)" },
      ]}
      queues={[
        { id: "prs", label: "Requisition queue", count: count("prs") },
        { id: "exceptions", label: "MRP exceptions", count: count("exceptions") },
        { id: "unconfirmed", label: "Unconfirmed POs", count: count("unconfirmed") },
        { id: "gaps", label: "Source gaps", count: count("gaps") },
      ]}
      queue={queue}
      onQueueChange={(q) => setQueue(q as Queue)}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        onRowClick: (r) => setActive(r.id),
        activeId: active ?? undefined,
        searchText: (r) => `${r.id} ${r.text} ${r.itemId}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        empty: { title: "Queue is clear", body: "Nothing waits in this queue for the selected buyer code." },
      }}
      bulkActions={
        queue === "prs" || queue === "gaps"
          ? (sel, clear) => (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    const r = groupIntoPos(sel, vendorFor)
                    report(r, (ids) => `${ids.length} draft PO(s) created: ${ids.join(", ")}`)
                    if (r.ok) {
                      clear()
                      if (r.value.length === 1) nav(`/purchasing/orders/${r.value[0]}`)
                    }
                  }}
                >
                  <Layers aria-hidden="true" /> Group into POs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const r = startRfq(sel)
                    report(r, (id) => `${id} created`)
                    if (r.ok) nav(`/purchasing/rfqs/${r.value}`)
                  }}
                >
                  <Gavel aria-hidden="true" /> Start RFQ
                </Button>
              </>
            )
          : undefined
      }
      panel={{
        open: !!act,
        onOpenChange: (o) => {
          if (!o) {
            setActive(null)
            if (sp.get("pr")) setSp({}, { replace: true })
          }
        },
        title: act ? act.id : "",
        description: act?.text,
        content: act ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4">
              <KV k="Item">
                <ItemLink id={act.itemId} />
              </KV>
              <KV k="Date">{fmtDate(act.date)}</KV>
            </dl>
            {pr && (
              <Section title="Choose the source">
                {allAvl(s)
                  .filter((a) => pr.lines.some((l) => l.itemId === a.itemId))
                  .sort((a, b) => a.rank - b.rank)
                  .map((a) => {
                    const el = vendorEligibility(vendorOf(s, a.vendorId))
                    return (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="src" checked={(vendorFor[pr.id] ?? pr.suggestedVendorId) === a.vendorId} onChange={() => setVendorFor({ ...vendorFor, [pr.id]: a.vendorId })} disabled={a.status === "Suspended" || !el.ok} />
                        #{a.rank} {vendorName(s, a.vendorId)} <StatusBadge kind="avl" status={a.status} size="sm" /> <span className="text-xs text-muted-foreground">{a.priceBasis}</span>
                        {!el.ok && <Chip kind="block">{vendorOf(s, a.vendorId)?.onboarding !== "Active" ? "Not Active" : "Disqualified"}</Chip>}
                        {el.needsOverride && <Chip kind="flag">Restricted</Chip>}
                      </label>
                    )
                  })}
                {!allAvl(s).some((a) => pr.lines.some((l) => l.itemId === a.itemId)) && <p className="text-sm">No AVL source for {pr.lines[0]?.itemId}: start an RFQ with prospects or AVL qualification (E-PUR-02).</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pr.status !== "Approved"}
                    onClick={() => {
                      const r = groupIntoPos([pr.id], vendorFor)
                      report(r, (ids) => `${ids.join(", ")} created`)
                      if (r.ok) nav(`/purchasing/orders/${r.value[0]}`)
                    }}
                  >
                    Create PO
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => nav(`/purchasing/requisitions/${pr.id}`)}>
                    Open requisition
                  </Button>
                </div>
              </Section>
            )}
            {act.queue === "exceptions" && <ExceptionActions x={s.mrpExceptions.find((e) => e.id === act.id)!} />}
            {act.queue === "unconfirmed" && (
              <Button variant="outline" onClick={() => nav(`/purchasing/orders/${act.id}`)}>
                Open PO to capture confirmation
              </Button>
            )}
          </div>
        ) : null,
      }}
    />
  )
}

function ExceptionActions({ x }: { x: MrpException }) {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const p = x.poId ? s.purchaseOrders.find((q) => q.id === x.poId) : undefined
  const [kind, setKind] = useState<"Promise" | "Push out" | "Pull in" | "Escalate" | "Call" | "Email">(x.code === "EX-03" ? "Push out" : x.code === "EX-02" ? "Pull in" : "Promise")
  const [line, setLine] = useState(String(x.line ?? ""))
  const [date, setDate] = useState(x.suggestedDate ?? "")
  const [text, setText] = useState("")
  if (!p)
    return (
      <Section title="New requirement without supply">
        <p className="text-sm">{x.text}. Raise or source a requisition for {x.itemId}.</p>
        <Button size="sm" variant="outline" onClick={() => nav("/purchasing/requisitions")}>
          Requisitions
        </Button>
      </Section>
    )
  return (
    <Section title={`Act on ${p.id} with ${vendorName(s, p.vendorId)}`}>
      {x.peg && (
        <p className="text-sm">
          Pegged to <DocLink r={x.peg} />. Open value on the PO {fmtMoney(p.lines.reduce((t, l) => t + (l.qty - l.received) * l.price, 0))}.
        </p>
      )}
      <ExpediteFields kind={kind} setKind={setKind} line={line} setLine={setLine} date={date} setDate={setDate} text={text} setText={setText} lines={p.lines.map((l) => l.no)} />
      <Button size="sm" onClick={() => report(expedite(p.id, { kind, line: line ? Number(line) : undefined, newDate: date || undefined, text }, x.id), "Recorded; exception closed where the action resolves it")}>
        Record
      </Button>
    </Section>
  )
}

// ============================================================================ PUR-EXP-001
export function ExpediteBoard() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-EXP-001")
  const nav = useNavigate()
  const [queue, setQueue] = useState("reschedule")
  const [active, setActive] = useState<string | null>(null)
  const xs = s.mrpExceptions.filter((x) => x.poId)
  const done = (x: MrpException) => !!x.done
  const q = (id: string) => xs.filter((x) => (id === "done" ? done(x) : !done(x) && (id === "pastdue" ? x.code === "EX-06" : x.code !== "EX-06")))
  const rows = q(queue)
  const act = xs.find((x) => x.id === active)
  const po = act ? s.purchaseOrders.find((p) => p.id === act.poId) : undefined
  const cols: Column<MrpException>[] = [
    { id: "id", header: "Exception", value: (r) => r.id, mono: true },
    { id: "code", header: "Code", value: (r) => r.code, filterable: true, cell: (r) => <Chip kind={r.code === "EX-06" ? "flag" : "change"}>{r.code}</Chip> },
    { id: "po", header: "PO", value: (r) => r.poId ?? "", cell: (r) => <DocLink r={{ type: "purchaseOrder", id: r.poId! }} /> },
    { id: "vendor", header: "Vendor", value: (r) => vendorName(s, s.purchaseOrders.find((p) => p.id === r.poId)?.vendorId), filterable: true },
    { id: "item", header: "Item", value: (r) => r.itemId, cell: (r) => <ItemLink id={r.itemId} /> },
    { id: "text", header: "Exception", value: (r) => r.text },
    { id: "peg", header: "Pegged order", value: (r) => r.peg?.id ?? "", cell: (r) => (r.peg ? <DocLink r={r.peg} /> : "Stock") },
    {
      id: "exp",
      header: "Open value",
      align: "right",
      mono: true,
      sortable: true,
      value: (r) => {
        const p = s.purchaseOrders.find((x) => x.id === r.poId)
        const l = p?.lines.find((x) => x.no === r.line)
        return l ? (l.qty - l.received) * l.price : 0
      },
      cell: (r) => {
        const p = s.purchaseOrders.find((x) => x.id === r.poId)
        const l = p?.lines.find((x) => x.no === r.line)
        return l ? fmtMoney((l.qty - l.received) * l.price, p?.currency) : ""
      },
    },
    { id: "date", header: "Suggested date", value: (r) => r.suggestedDate ?? "", sortable: true, cell: (r) => fmtDate(r.suggestedDate) },
  ]
  return (
    <WorkbenchPage
      header={{
        screenId: "PUR-EXP-001",
        title: "Expedite board",
        description: "Reschedule and past-due exceptions on open POs with the order each one serves. Updated supply dates feed promise revalidation.",
        actions: (
          <>
            {st.menu}
            <Button variant="outline" onClick={() => nav("/purchasing/workbench")}>
              Buyer workbench
            </Button>
          </>
        ),
      }}
      kpis={[
        { label: "Reschedule (EX-02 / EX-03)", value: q("reschedule").length },
        { label: "Past due (EX-06)", value: q("pastdue").length },
        { label: "Customer orders exposed", value: new Set(xs.filter((x) => !done(x) && x.peg?.type === "salesOrder").map((x) => x.peg!.id)).size, hint: "Distinct pegged sales orders" },
        { label: "Resolved this session", value: q("done").length },
      ]}
      queues={[
        { id: "reschedule", label: "Reschedule", count: q("reschedule").length },
        { id: "pastdue", label: "Past due", count: q("pastdue").length },
        { id: "done", label: "Resolved", count: q("done").length },
      ]}
      queue={queue}
      onQueueChange={setQueue}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        onRowClick: (r) => setActive(r.id),
        activeId: active ?? undefined,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        searchText: (r) => `${r.id} ${r.poId} ${r.itemId} ${r.text}`,
        empty: { title: "No exceptions here", body: "MRP raises reschedule and past-due exceptions on buy items at each run." },
      }}
      panel={{
        open: !!act,
        onOpenChange: (o) => !o && setActive(null),
        title: act ? `${act.code} on ${act.poId}` : "",
        description: act?.text,
        content:
          act && po ? (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4">
                <KV k="Vendor">{vendorName(s, po.vendorId)}</KV>
                <KV k="Item">{itemText(act.itemId)}</KV>
                {po.lines
                  .filter((l) => l.no === act.line)
                  .map((l) => (
                    <KV key={l.no} k={`Line ${l.no}`}>
                      {fmtNumber(l.qty - l.received)} open · need {fmtDate(l.needBy)} · confirmed {l.confirmedDate ? fmtDate(l.confirmedDate) : "none"}
                    </KV>
                  ))}
              </dl>
              {!act.done ? <ExceptionActions x={act} /> : <p className="text-sm">Resolved.</p>}
              <Section title={`Action log with ${vendorName(s, po.vendorId)}`}>
                {s.purchaseOrders
                  .filter((p) => p.vendorId === po.vendorId)
                  .flatMap((p) => p.expedite.map((e) => ({ ...e, po: p.id })))
                  .reverse()
                  .map((e, i) => (
                    <p key={i} className="text-sm">
                      <span className="tabular text-muted-foreground">{fmtDate(e.on)}</span> · {e.po} · {e.kind}
                      {e.newDate ? ` ${fmtDate(e.newDate)}` : ""} · {e.text}
                    </p>
                  ))}
                {!s.purchaseOrders.some((p) => p.vendorId === po.vendorId && p.expedite.length) && <p className="text-sm text-muted-foreground">No contacts logged with this vendor yet.</p>}
              </Section>
            </div>
          ) : null,
      }}
    />
  )
}
