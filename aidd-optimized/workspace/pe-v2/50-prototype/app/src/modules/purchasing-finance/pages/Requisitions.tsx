// PUR-PR/RFQ Requisitions and RFQs [DOC:p.267] (asserted); rules Book I G §3, §4, Book IV §3.4.
// PR grid with pegs and budget results; RFQ with sealed responses, technical pass / fail before
// commercial opening, landed-cost comparison grid. Primary actions: approve expense PRs (through
// WF-INBOX), issue RFQ with STP attachments, award (writes the AVL price basis and a Draft PO).
import { Fragment, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Award, ClipboardList, Gavel, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { THRESHOLDS, type MaterialId, type VendorId } from "@/data/domain"
import { COST_CENTERS, MATERIALS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { awardRfq, cancelRequisition, cancelRfq, closeResponses, createRequisition, issueRfq, recordResponse, setRfqVendors, startRfq, technicalReview } from "../data/actions"
import { allAvl, allVendors, material, prTotal, vendorName } from "../data/logic"
import { bidFor, scoreBids, weightsOf } from "../data/xlogic"
import { reviseBid, selectBidVersion, setScoringWeights } from "../data/xactions"
import { useNineStates, writeProps, type NineStates } from "../components/states"
import type { PrRec, RfqRec, RfqResp } from "../data/types"
import { CsvButton, DocLink, Reading, report, useDemoState } from "../components/common"
import { ccName, DetailFrame, ItemLink, RecLink, SelectField, TextField, userName, VendorLink } from "../components/bits"

// ============================================================================ requisitions
type PrRow = PrRec & { value: number; budget: string }
const budgetResult = (r: PrRec) => {
  if (!r.costCenterId) return ""
  const v = prTotal(r.lines)
  return r.budgetRemaining == null ? "No budget line" : v <= r.budgetRemaining ? "Within budget" : "Over budget"
}

export function PrList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-PR-001")
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const rows = useMemo<PrRow[]>(() => s.requisitions.map((r) => ({ ...r, value: prTotal(r.lines), budget: budgetResult(r) })), [s])
  const cols: Column<PrRow>[] = [
    { id: "id", header: "Requisition", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[300px]">{r.title}</span> },
    { id: "origin", header: "Origin", value: (r) => r.origin, filterable: true },
    { id: "item", header: "Item", value: (r) => r.lines[0]?.itemId ?? "", cell: (r) => (r.lines[0] ? <ItemLink id={r.lines[0].itemId} short /> : "No lines") },
    { id: "need", header: "Need by", value: (r) => r.lines[0]?.needBy ?? "", sortable: true, cell: (r) => fmtDate(r.lines[0]?.needBy) },
    { id: "value", header: "Est. value", value: (r) => r.value, align: "right", mono: true, sortable: true, cell: (r) => fmtMoney(r.value) },
    { id: "peg", header: "Peg", value: (r) => r.lines.find((l) => l.peg)?.peg?.id ?? "", cell: (r) => { const pg = r.lines.find((l) => l.peg)?.peg; return pg ? <DocLink r={pg} /> : <span className="text-muted-foreground">Stock</span> } },
    { id: "budget", header: "Budget", value: (r) => r.budget, filterable: true, cell: (r) => (r.budget === "Over budget" ? <Chip kind="flag">Over budget</Chip> : r.budget) },
    { id: "buyer", header: "Buyer", value: (r) => userName(r.buyerId), filterable: true },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="requisition" status={r.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "PUR-PR/RFQ",
          title: "Purchase requisitions",
          description: "Demand from MRP, reorder points, manual and expense requests. Approved requisitions are grouped into POs on the Buyer Workbench or sourced through an RFQ.",
          actions: (
            <>
              {st.menu}
              <Button variant="outline" onClick={() => nav("/purchasing/rfqs")}>
                <Gavel aria-hidden="true" /> RFQs
              </Button>
              <CsvButton filename="requisitions.csv" rows={rows.map((r) => ({ PR: r.id, Title: r.title, Origin: r.origin, Value: r.value, Status: r.status, Budget: r.budget }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> New requisition
            </Button>
          ),
        }}
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/purchasing/requisitions/${r.id}`,
          searchText: (r) => `${r.id} ${r.title} ${r.lines.map((l) => l.itemId).join(" ")}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.retry,
          densityKey: "PUR-PR-001",
          initialSort: { id: "id", dir: "desc" },
          empty: { title: "No requisitions", body: "MRP creates requisitions for buy items when it converts planned orders; you can also raise one manually." },
        }}
      />
      <NewPrDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function NewPrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const [f, setF] = useState({ title: "", origin: "Manual" as PrRec["origin"], itemId: "" as MaterialId | "", qty: "", needBy: "", estPrice: "", cc: "" })
  const mt = material(f.itemId)
  const expense = f.origin === "Expense" || mt?.type === "NSTK" || mt?.type === "SERV"
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="New purchase requisition"
      confirmLabel="Create requisition"
      consequence="Creates an Open requisition. Expense requisitions go for approval on the PO ladder; MRP requisitions are pre-approved by policy."
      onConfirm={() => {
        const r = createRequisition({ title: f.title, origin: f.origin, itemId: f.itemId as MaterialId, qty: Number(f.qty), needBy: f.needBy || TODAY, estPrice: Number(f.estPrice) || mt?.stdCost || 0, costCenterId: (f.cc || undefined) as PrRec["costCenterId"] })
        const err = report(r, (id) => `${id} created`)
        if (r.ok) nav(`/purchasing/requisitions/${r.value}`)
        return err
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField id="pr-title" label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
        <SelectField id="pr-origin" label="Origin" value={f.origin} onChange={(v) => setF({ ...f, origin: v })} options={["Manual", "Expense"].map((x) => ({ value: x as PrRec["origin"], label: x }))} />
        <SelectField id="pr-item" label="Item" value={f.itemId} onChange={(v) => setF({ ...f, itemId: v, estPrice: String(material(v)?.stdCost ?? "") })} options={MATERIALS.filter((m) => ["RAW", "CONS", "PACK", "SPARE", "NSTK", "SERV", "TRADE"].includes(m.type)).map((m) => ({ value: m.id, label: `${m.id} ${m.description}` }))} />
        <TextField id="pr-qty" label={`Quantity${mt ? ` (${mt.baseUom})` : ""}`} value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
        <TextField id="pr-need" type="date" label="Need by" value={f.needBy} onChange={(v) => setF({ ...f, needBy: v })} />
        <TextField id="pr-price" label="Estimated unit price" value={f.estPrice} onChange={(v) => setF({ ...f, estPrice: v })} />
        <SelectField
          id="pr-cc"
          label={expense ? "Cost center (required)" : "Cost center (optional)"}
          value={f.cc}
          onChange={(v) => setF({ ...f, cc: v })}
          options={COST_CENTERS.map((c) => ({ value: c.id, label: `${c.id} ${c.name}${c.postable ? "" : " (summary, not postable)"}${c.status === "Blocked" ? " (Blocked)" : ""}` }))}
          hint="Mandatory for expense and MRO purchases (Book I G §3)."
        />
      </div>
    </DialogShell>
  )
}

export function PrDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-PR-002")
  const r = s.requisitions.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!r} title={id} screenId="PUR-PR/RFQ" back={{ label: "Requisitions", to: "/purchasing/requisitions" }}>
      {() => <PrBody r={r!} menu={st.menu} />}
    </DetailFrame>
  )
}
function PrBody({ r, menu }: { r: PrRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const [cancel, setCancel] = useState(false)
  const value = prTotal(r.lines)
  const needsApproval = r.origin === "Expense" || r.origin === "Manual"
  const sourceable = r.status === "Approved" || r.status === "Open"
  const primary =
    needsApproval && (r.status === "Open" || r.status === "In Approval") ? (
      <ApprovalButton kind="PO approval" subject={{ type: "requisition", id: r.id }} title={`${r.id} ${r.title}`} amount={value} variant="default" stay />
    ) : r.status === "Approved" && !r.poIds.length ? (
      <Button onClick={() => nav(`/purchasing/workbench?pr=${r.id}`)}>
        <ClipboardList aria-hidden="true" /> Group into PO
      </Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "PUR-PR/RFQ",
          title: `${r.id} · ${r.title}`,
          crumbs: [{ label: "Requisitions", to: "/purchasing/requisitions" }],
          chips: <>{needsApproval && <Reading id="OQ-PF-1" />}{r.status === "Converted" && <Reading id="OQ-PF-2" />}</>,
          actions: (
            <>
              {menu}
              {sourceable && !r.rfqId && !r.poIds.length && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const res = startRfq([r.id])
                    report(res, (q) => `${q} created`)
                    if (res.ok) nav(`/purchasing/rfqs/${res.value}`)
                  }}
                >
                  <Gavel aria-hidden="true" /> Start RFQ
                </Button>
              )}
              {["Open", "In Approval", "Approved"].includes(r.status) && (
                <Button variant="ghost" onClick={() => setCancel(true)}>
                  Cancel requisition
                </Button>
              )}
            </>
          ),
          primary,
        }}
        status={{ kind: "requisition", value: r.status }}
        doc={{ type: "requisition", id: r.id }}
        summary={
          <>
            <KV k="Origin">{r.origin}</KV>
            <KV k="Estimated value">
              <span className="tabular">{fmtMoney(value)}</span>
            </KV>
            <KV k="Requester / buyer">
              {userName(r.requesterId)} / {userName(r.buyerId)}
            </KV>
            <KV k="Suggested source">{r.suggestedVendorId ? <VendorLink id={r.suggestedVendorId} name={vendorName(s, r.suggestedVendorId)} /> : <Chip kind="flag">Source gap (E-PUR-02)</Chip>}</KV>
            {r.costCenterId && (
              <>
                <KV k="Cost center">
                  <RecLink to={`/controlling/cost-centers/${r.costCenterId}`}>{r.costCenterId}</RecLink> {ccName(r.costCenterId)}
                </KV>
                <KV k="Budget check">
                  {budgetResult(r)} · {fmtMoney(r.budgetRemaining ?? 0)} remaining <Chip kind="design" note="Budget remaining on the cost center and account comes from ACC 21; value is a design value">ACC 21</Chip>
                </KV>
              </>
            )}
            <KV k="RFQ / POs">
              <span className="flex flex-wrap gap-2">
                {r.rfqId && <DocLink r={{ type: "rfq", id: r.rfqId }} />}
                {r.poIds.map((p) => (
                  <DocLink key={p} r={{ type: "purchaseOrder", id: p }} />
                ))}
                {!r.rfqId && !r.poIds.length && "None yet"}
              </span>
            </KV>
          </>
        }
        tabs={[
          {
            id: "lines",
            label: "Lines",
            count: r.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {r.note && <p className="text-sm">{r.note}</p>}
                {r.lines.length === 0 ? (
                  <EmptyState title="No lines">Planning detail could not be read; the buyer completes the lines.</EmptyState>
                ) : (
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow>
                        <TableHead>Line</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Need by</TableHead>
                        <TableHead className="text-right">Est. price</TableHead>
                        <TableHead>Peg</TableHead>
                        <TableHead>AVL sources</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.lines.map((l) => {
                        const src = allAvl(s).filter((a) => a.itemId === l.itemId).sort((a, b) => a.rank - b.rank)
                        return (
                          <TableRow key={l.no} className="h-10 align-top text-[13px]">
                            <TableCell>{l.no}</TableCell>
                            <TableCell>
                              <ItemLink id={l.itemId} />
                            </TableCell>
                            <TableCell className="tabular text-right">
                              {fmtNumber(l.qty)} {material(l.itemId)?.baseUom}
                            </TableCell>
                            <TableCell>{fmtDate(l.needBy)}</TableCell>
                            <TableCell className="tabular text-right">{fmtMoney(l.estPrice)}</TableCell>
                            <TableCell>{l.peg ? <DocLink r={l.peg} /> : "Stock"}</TableCell>
                            <TableCell>
                              {src.length ? (
                                src.map((a) => (
                                  <div key={a.id} className="flex items-center gap-1 text-xs">
                                    #{a.rank} {vendorName(s, a.vendorId)} <StatusBadge kind="avl" status={a.status} size="sm" />
                                  </div>
                                ))
                              ) : (
                                <Chip kind="flag">No AVL source</Chip>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {[...r.activity].reverse().map((a, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["G §1.3", `RFQ by policy: new items, expiring agreements, uncontracted spend above ${fmtMoney(THRESHOLDS.rfqRequiredAbove)}`, "[DOC:p.100]"],
              ["G §3", "Cost center mandatory on expense and MRO requisitions; budget check against ACC 21", "[DOC:p.102 §3]"],
              ["C-49", "No requisition for an item with a Purchasing Block", "[DOC:p.151 §4.5]"],
            ]}
          />
        }
      />
      <DialogShell open={cancel} onOpenChange={setCancel} destructive requireReason title={`Cancel ${r.id}`} confirmLabel="Cancel requisition" consequence={`Cancels ${r.id}; MRP will raise the need again at its next run if it still exists.`} onConfirm={(reason) => report(cancelRequisition(r.id, reason), `${r.id} cancelled`)} />
    </>
  )
}

// ============================================================================ RFQs
type RfqRow = RfqRec & { responses: string; lowest?: number }
const landed = (x: RfqResp) => (x.prices[0]?.price ?? 0) * (1 + (x.freightPct + x.dutyPct) / 100)

export function RfqList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-RFQ-001")
  const nav = useNavigate()
  const rows = useMemo<RfqRow[]>(
    () =>
      s.rfqs.map((q) => {
        const rs = s.rfqResponses.filter((x) => x.rfqId === q.id)
        return { ...q, responses: `${rs.filter((x) => x.received).length} of ${q.vendorIds.length}` }
      }),
    [s],
  )
  const cols: Column<RfqRow>[] = [
    { id: "id", header: "RFQ", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[340px]">{r.title}</span> },
    { id: "item", header: "Item", value: (r) => r.lines[0]?.itemId ?? "", cell: (r) => <ItemLink id={r.lines[0]?.itemId ?? ""} short /> },
    { id: "sealed", header: "Sealed", value: (r) => (r.sealed ? "Sealed" : "Open"), filterable: true },
    { id: "due", header: "Due", value: (r) => r.dueOn, sortable: true, cell: (r) => fmtDate(r.dueOn) },
    { id: "resp", header: "Responses", value: (r) => r.responses, align: "right", mono: true },
    { id: "tech", header: "Technical review", value: (r) => (r.technicalReviewed ? "Complete" : "Pending"), filterable: true },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="rfq" status={r.status} size="sm" /> },
  ]
  return (
    <ListPage
      header={{
        screenId: "PUR-PR/RFQ",
        title: "Requests for quotation",
        crumbs: [{ label: "RFQs" }],
        description: "Sealed competitive bids. Engineering records technical pass or fail before commercial bids open; award compares landed cost.",
        actions: (
          <>
            {st.menu}
            <CsvButton filename="rfqs.csv" rows={rows.map((r) => ({ RFQ: r.id, Title: r.title, Due: r.dueOn, Responses: r.responses, Status: r.status }))} />
          </>
        ),
        primary: (
          <Button onClick={() => nav("/purchasing/requisitions")}>
            <Plus aria-hidden="true" /> Start from a requisition
          </Button>
        ),
      }}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/purchasing/rfqs/${r.id}`,
        searchText: (r) => `${r.id} ${r.title}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "PUR-RFQ-001",
        initialSort: { id: "id", dir: "desc" },
        empty: { title: "No RFQs", body: "Start an RFQ from an Open or Approved requisition when policy demands one." },
      }}
    />
  )
}

export function RfqDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("PUR-RFQ-002", { writers: "the Buyer or Purchasing Manager", degraded: "Vendor responses arrive through the supplier portal, which answered slowly: a response keyed by the vendor in the last hour may not show yet." })
  const q = s.rfqs.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!q} title={id} screenId="PUR-PR/RFQ" back={{ label: "RFQs", to: "/purchasing/rfqs" }}>
      {() => <RfqBody q={q!} st={st} />}
    </DetailFrame>
  )
}
function RfqBody({ q, st }: { q: RfqRec; st: NineStates }) {
  const menu = st.menu
  const wr = writeProps(st)
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | "issue" | "award" | "cancel" | "vendors" | { resp: VendorId } | { tech: VendorId } | { rev: VendorId }>(null)
  const rs = s.rfqResponses.filter((x) => x.rfqId === q.id)
  const sealedClosed = q.sealed && !q.technicalReviewed && q.status !== "Awarded" && q.status !== "Cancelled"
  const passed = rs.filter((x) => x.received && x.technicalPass)
  const lowest = passed.length ? passed.reduce((a, b) => (landed(b) < landed(a) ? b : a)) : undefined
  const [award, setAward] = useState<VendorId | "">("")
  const [just, setJust] = useState("")
  const [resp, setResp] = useState({ price: "", lead: "", freight: "3", duty: "0", valid: "", ba: false })
  const [tech, setTech] = useState({ pass: "pass", note: "" })
  const [vs, setVs] = useState<VendorId[]>(q.vendorIds)
  const [sealed, setSealed] = useState(q.sealed)
  const [due, setDue] = useState(q.dueOn)
  const w0 = weightsOf(s, q.id)
  const [wts, setWts] = useState({ landed: String(w0.landed), lead: String(w0.lead), quality: String(w0.quality), buyAmerica: String(w0.buyAmerica) })
  const wNum = { landed: Number(wts.landed) || 0, lead: Number(wts.lead) || 0, quality: Number(wts.quality) || 0, buyAmerica: Number(wts.buyAmerica) || 0 }
  const wSum = wNum.landed + wNum.lead + wNum.quality + wNum.buyAmerica
  const closedRfq = q.status === "Awarded" || q.status === "Cancelled"
  const scoreIds = rs.filter((x) => x.received && x.technicalPass !== false).map((x) => x.vendorId)
  const scores = scoreBids(s, q.id, scoreIds, wNum)
  const [revForm, setRevForm] = useState({ price: "", lead: "", freight: "3", duty: "0", valid: "", ba: false, note: "", dev: "" })
  const devsOf = (vid: string) => [...(bidFor(s, q.id, vid)?.deviations ?? []).map((d) => ({ key: d, text: d, ref: undefined as string | undefined })), ...s.supplierDeviations.filter((d) => d.rfqId === q.id && d.vendorId === vid && !d.withdrawn).map((d) => ({ key: d.id, text: `${d.characteristic}: ${d.kind.toLowerCase()}, ${d.original} to ${d.proposed}`, ref: d.id }))]

  const primary =
    q.status === "Draft" ? (
      <Button {...wr} onClick={() => setDlg("issue")}>
        <Send aria-hidden="true" /> Issue RFQ
      </Button>
    ) : q.status === "Responses In" ? (
      <Button onClick={() => setDlg("award")} disabled={!q.technicalReviewed || !!st.blockReason} title={st.blockReason ?? (q.technicalReviewed ? undefined : "Technical review first")}>
        <Award aria-hidden="true" /> Award
      </Button>
    ) : undefined

  return (
    <>
      {st.banner}
      <DetailPage
        header={{
          screenId: "PUR-PR/RFQ",
          title: `${q.id} · ${q.title}`,
          crumbs: [{ label: "RFQs", to: "/purchasing/rfqs" }],
          chips: <>{q.sealed && <Chip kind="design" note="Commercial bids stay sealed until Engineering records technical pass or fail">Sealed</Chip>}</>,
          actions: (
            <>
              {menu}
              {q.status === "Draft" && (
                <Button variant="outline" {...wr} onClick={() => setDlg("vendors")}>
                  Vendors and due date
                </Button>
              )}
              {q.status === "Issued" && (
                <Button variant="outline" {...wr} onClick={() => report(closeResponses(q.id), "Closed for responses")}>
                  Close for responses
                </Button>
              )}
              {q.status !== "Awarded" && q.status !== "Cancelled" && (
                <Button variant="ghost" {...wr} onClick={() => setDlg("cancel")}>
                  Cancel RFQ
                </Button>
              )}
            </>
          ),
          primary,
        }}
        status={{ kind: "rfq", value: q.status }}
        doc={{ type: "rfq", id: q.id }}
        summary={
          <>
            <KV k="Buyer">{userName(q.buyerId)}</KV>
            <KV k="Due">{fmtDate(q.dueOn)}</KV>
            <KV k="Vendors invited">{q.vendorIds.length}</KV>
            <KV k="Technical review">{q.technicalReviewed ? "Complete" : "Pending (Engineering)"}</KV>
            {q.awardedVendorId && (
              <KV k="Awarded to">
                <VendorLink id={q.awardedVendorId} name={vendorName(s, q.awardedVendorId)} />
              </KV>
            )}
            {q.awardNote && <KV k="Award note">{q.awardNote}</KV>}
            {q.cancelReason && <KV k="Cancelled because">{q.cancelReason}</KV>}
            <KV k="Requisitions">
              <span className="flex flex-wrap gap-2">
                {q.prIds.length ? q.prIds.map((p) => <DocLink key={p} r={{ type: "requisition", id: p }} />) : "None (annual agreement)"}
              </span>
            </KV>
          </>
        }
        tabs={[
          {
            id: "compare",
            label: "Responses and landed cost",
            count: rs.filter((x) => x.received).length,
            content: (
              <div className="flex flex-col gap-4">
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Technical</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Freight + duty</TableHead>
                      <TableHead className="text-right">Landed unit cost</TableHead>
                      <TableHead className="text-right">Lead time</TableHead>
                      <TableHead>Buy America</TableHead>
                      <TableHead>Valid until</TableHead>
                      <TableHead>Bid version</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.vendorIds.map((vid) => {
                      const x = rs.find((r) => r.vendorId === vid)
                      const hide = sealedClosed && x?.received
                      const vers = s.bidVersions.filter((b) => b.rfqId === q.id && b.vendorId === vid)
                      const cur = bidFor(s, q.id, vid)
                      const devs = devsOf(vid)
                      return (
                        <Fragment key={vid}>
                        <TableRow className="h-10 align-top text-[13px]">
                          <TableCell>
                            <VendorLink id={vid} name={vendorName(s, vid)} />
                          </TableCell>
                          <TableCell>{x?.received ? fmtDate(x.receivedOn) : q.status === "Draft" ? "Not issued" : "Awaiting"}</TableCell>
                          <TableCell>
                            {x?.technicalPass == null ? (x?.received ? "Pending" : "") : x.technicalPass ? "Pass" : "Fail"}
                            {x?.technicalNote && <div className="text-xs text-muted-foreground">{x.technicalNote}</div>}
                          </TableCell>
                          <TableCell className="tabular text-right">{x?.received ? (hide ? "Sealed" : fmtMoney(x.prices[0].price)) : ""}</TableCell>
                          <TableCell className="tabular text-right">{x?.received && !hide ? `${x.freightPct}% + ${x.dutyPct}%` : ""}</TableCell>
                          <TableCell className="tabular text-right font-medium">
                            {x?.received && !hide ? fmtMoney(Math.round(landed(x) * 100) / 100) : ""}
                            {lowest && x === lowest && !hide && <Chip kind="flag">Lowest landed</Chip>}
                          </TableCell>
                          <TableCell className="tabular text-right">{x?.received && !hide ? `${x.prices[0].leadDays} d` : ""}</TableCell>
                          <TableCell>{x?.received && !hide ? (x.buyAmerica ? "Yes" : "No") : ""}</TableCell>
                          <TableCell>{x?.received && !hide ? fmtDate(x.validUntil) : ""}</TableCell>
                          <TableCell>
                            {x?.received && !hide && vers.length > 0 && (
                              <select
                                aria-label={`Bid version for ${vendorName(s, vid)}`}
                                className="h-8 rounded-md border bg-background px-2 text-sm"
                                value={cur?.version}
                                disabled={closedRfq || !!st.blockReason}
                                title={st.blockReason ?? (closedRfq ? `Fixed once the RFQ is ${q.status}` : undefined)}
                                onChange={(e) => report(selectBidVersion(q.id, vid, Number(e.target.value)), `Version ${e.target.value} selected`)}
                              >
                                {vers.map((b) => (
                                  <option key={b.version} value={b.version}>
                                    v{b.version} · {fmtDate(b.receivedOn)} · {fmtMoney(b.price)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </TableCell>
                          <TableCell className="flex gap-1">
                            {(q.status === "Issued" || q.status === "Responses In") && !x?.received && (
                              <Button size="sm" variant="outline" {...wr} onClick={() => setDlg({ resp: vid })}>
                                Key response
                              </Button>
                            )}
                            {x?.received && (q.status === "Issued" || q.status === "Responses In") && (
                              <Button size="sm" variant="outline" {...wr} onClick={() => setDlg({ tech: vid })}>
                                Technical result
                              </Button>
                            )}
                            {x?.received && (q.status === "Issued" || q.status === "Responses In") && vers.length > 0 && (
                              <Button size="sm" variant="outline" {...wr} onClick={() => setDlg({ rev: vid })}>
                                Revised bid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {x?.received && !hide && (
                          <TableRow className="bg-muted/30 text-xs hover:bg-muted/30">
                            <TableCell colSpan={11}>
                              <span className="font-medium">Deviations from the RFQ package, {vendorName(s, vid)} v{cur?.version}: </span>
                              {devs.length === 0 ? (
                                <span className="text-muted-foreground">None listed: the bid meets the package as issued.</span>
                              ) : (
                                <ul className="mt-1 flex flex-col gap-1">
                                  {devs.map((d) => (
                                    <li key={d.key}>
                                      {d.ref ? <RecLink to={`/purchasing/supplier-deviations/${d.ref}`}>{d.ref}</RecLink> : <Chip kind="design" note="Listed on the bid; not a structured deviation request">Bid note</Chip>} {d.text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
                <p className="text-sm text-muted-foreground">Landed cost = price × (1 + estimated freight % + duty %) (Book I G §4). Award to anyone but the lowest landed cost needs a justification note.</p>
              </div>
            ),
          },
          {
            id: "scoring",
            label: "Weighted scoring",
            content: (
              <div className="flex flex-col gap-4">
                {sealedClosed ? (
                  <EmptyState title="Bids are sealed">Scores appear once Engineering records the technical results (FL-10 stage 8).</EmptyState>
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-5">
                      <TextField id="w-landed" label="Landed cost %" value={wts.landed} onChange={(v) => setWts({ ...wts, landed: v })} />
                      <TextField id="w-lead" label="Lead time %" value={wts.lead} onChange={(v) => setWts({ ...wts, lead: v })} />
                      <TextField id="w-quality" label="Quality rating %" value={wts.quality} onChange={(v) => setWts({ ...wts, quality: v })} />
                      <TextField id="w-ba" label="Buy America %" value={wts.buyAmerica} onChange={(v) => setWts({ ...wts, buyAmerica: v })} />
                      <div className="flex flex-col justify-end gap-1">
                        <span className={wSum === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{wSum} of 100</span>
                        <Button variant="outline" disabled={closedRfq || !!st.blockReason} title={st.blockReason ?? (closedRfq ? `Weights are fixed once the RFQ is ${q.status}` : undefined)} onClick={() => report(setScoringWeights(q.id, wNum), "Weights saved")}>
                          Save weights
                        </Button>
                      </div>
                    </div>
                    {st.validation && wSum !== 100 && <p role="alert" className="text-sm text-destructive">The weights add up to {wSum}; they must add up to 100.</p>}
                    {scores.length === 0 ? (
                      <EmptyState title="Nothing to score yet">Scoring needs at least one received response that has not failed the technical review.</EmptyState>
                    ) : (
                      <Table>
                        <TableHeader className="bg-table-head">
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Landed ({wNum.landed}%)</TableHead>
                            <TableHead className="text-right">Lead ({wNum.lead}%)</TableHead>
                            <TableHead className="text-right">Quality ({wNum.quality}%)</TableHead>
                            <TableHead className="text-right">Buy America ({wNum.buyAmerica}%)</TableHead>
                            <TableHead className="text-right">Weighted score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scores.map((sc) => (
                            <TableRow key={sc.vendorId} className="h-8 text-[13px]">
                              <TableCell className="tabular">{sc.rank}</TableCell>
                              <TableCell><VendorLink id={sc.vendorId} name={vendorName(s, sc.vendorId)} /></TableCell>
                              <TableCell className="tabular text-right">{sc.landed}</TableCell>
                              <TableCell className="tabular text-right">{sc.lead}</TableCell>
                              <TableCell className="tabular text-right">{sc.quality}</TableCell>
                              <TableCell className="tabular text-right">{sc.buyAmerica}</TableCell>
                              <TableCell className="tabular text-right font-semibold">{sc.total}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Each criterion scores 0 to 100 against the best bid; the weights come from the Book IV §3.3 table and are the buyer's to set. The lowest landed cost still decides whether an award needs a justification note. <Reading id="OQ-PF-35" /> Scores use the bid version selected for each vendor.
                    </p>
                  </>
                )}
              </div>
            ),
          },
          {
            id: "lines",
            label: "Lines and STP",
            count: q.lines.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Supplier technical package</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.lines.map((l) => {
                    const t = l.stpId ? s.stps.find((x) => x.id === l.stpId) : undefined
                    return (
                      <TableRow key={l.no} className="h-10 text-[13px]">
                        <TableCell>{l.no}</TableCell>
                        <TableCell>
                          <ItemLink id={l.itemId} />
                        </TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(l.qty)}</TableCell>
                        <TableCell>
                          {t ? (
                            <span className="flex items-center gap-2">
                              <RecLink to={`/purchasing/stp/${t.id}`}>{t.id}</RecLink> v{t.version} {t.superseded && <Chip kind="block">Superseded: attach {t.supersededBy}</Chip>}
                            </span>
                          ) : (
                            "None"
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {[...q.activity].reverse().map((a, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["FL-10 s8", "Engineering records technical pass / fail before commercial bids open", "[DOC:p.209]"],
              ["G §4", "Award writes the AVL price basis (info record) and creates a Draft PO; regret notices to the others", "[DOC:p.103 §4]"],
              ["C-22", "A superseded STP cannot attach to a new RFQ (E-DTS-03)", "[DOC:p.209 §3.3]"],
              ["C-31", "Award to a vendor whose onboarding is not Active is blocked", "[DOC:p.101]"],
            ]}
          />
        }
      />
      <DialogShell open={dlg === "issue"} onOpenChange={(o) => !o && setDlg(null)} title={`Issue ${q.id}`} confirmLabel="Issue" consequence={`Sends the RFQ with its STP attachments to ${q.vendorIds.length} vendors; responses due ${fmtDate(q.dueOn)}. Vendors and the Sealed toggle lock.`} onConfirm={() => report(issueRfq(q.id), `${q.id} issued`)} />
      <DialogShell open={dlg === "cancel"} onOpenChange={(o) => !o && setDlg(null)} destructive requireReason title={`Cancel ${q.id}`} confirmLabel="Cancel RFQ" consequence="Ends the RFQ; invited vendors are told it is withdrawn." onConfirm={(r) => report(cancelRfq(q.id, r), `${q.id} cancelled`)} />
      <DialogShell
        open={dlg === "vendors"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Vendors, sealing and due date"
        confirmLabel="Save"
        onConfirm={() => report(setRfqVendors(q.id, vs, sealed, due), "Saved")}
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">AVL plus prospects (Book I G §4).</p>
          {allVendors(s)
            .filter((v) => q.lines.some((l) => allAvl(s).some((a) => a.vendorId === v.id && a.itemId === l.itemId)) || /prospect/.test(v.commodity) || q.vendorIds.includes(v.id))
            .map((v) => (
              <label key={v.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={vs.includes(v.id)} onCheckedChange={(c) => setVs(c ? [...vs, v.id] : vs.filter((x) => x !== v.id))} />
                {v.id} {v.name} <StatusBadge kind="vendorOnboarding" status={v.onboarding} size="sm" />
              </label>
            ))}
          <div className="flex items-center gap-2">
            <Switch id="rfq-sealed" checked={sealed} onCheckedChange={setSealed} />
            <Label htmlFor="rfq-sealed">Sealed bids</Label>
          </div>
          <TextField id="rfq-due" type="date" label="Responses due" value={due} onChange={setDue} />
        </div>
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object" && "resp" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Key response from ${dlg && typeof dlg === "object" && "resp" in dlg ? vendorName(s, dlg.resp) : ""}`}
        confirmLabel="Record response"
        consequence="Stores the response sealed until technical review completes. When every invited vendor has answered, the RFQ moves to Responses In."
        onConfirm={() => {
          if (!dlg || typeof dlg !== "object" || !("resp" in dlg)) return null
          return report(recordResponse(q.id, dlg.resp, { price: Number(resp.price), leadDays: Number(resp.lead), freightPct: Number(resp.freight), dutyPct: Number(resp.duty), validUntil: resp.valid || q.dueOn, buyAmerica: resp.ba }), "Response recorded")
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="r-price" label="Unit price" value={resp.price} onChange={(v) => setResp({ ...resp, price: v })} />
          <TextField id="r-lead" label="Lead time (days)" value={resp.lead} onChange={(v) => setResp({ ...resp, lead: v })} />
          <TextField id="r-fr" label="Estimated freight %" value={resp.freight} onChange={(v) => setResp({ ...resp, freight: v })} />
          <TextField id="r-du" label="Duty %" value={resp.duty} onChange={(v) => setResp({ ...resp, duty: v })} />
          <TextField id="r-valid" type="date" label="Valid until" value={resp.valid} onChange={(v) => setResp({ ...resp, valid: v })} />
          <div className="flex items-center gap-2 pt-6">
            <Switch id="r-ba" checked={resp.ba} onCheckedChange={(c) => setResp({ ...resp, ba: c })} />
            <Label htmlFor="r-ba">Buy America compliant</Label>
          </div>
        </div>
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object" && "rev" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Revised bid from ${dlg && typeof dlg === "object" && "rev" in dlg ? vendorName(s, dlg.rev) : ""}`}
        confirmLabel="Record revised bid"
        consequence="Keeps the earlier versions and makes this the version the grid, the scores and the award read."
        onConfirm={() => {
          if (!dlg || typeof dlg !== "object" || !("rev" in dlg)) return null
          return report(
            reviseBid(q.id, dlg.rev, { price: Number(revForm.price), leadDays: Number(revForm.lead), freightPct: Number(revForm.freight), dutyPct: Number(revForm.duty), validUntil: revForm.valid || q.dueOn, buyAmerica: revForm.ba, note: revForm.note, deviations: revForm.dev.split("\n").map((x) => x.trim()).filter(Boolean) }),
            (v) => `Version ${v} recorded`,
          )
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="rv-price" label="Unit price" value={revForm.price} onChange={(v) => setRevForm({ ...revForm, price: v })} />
          <TextField id="rv-lead" label="Lead time (days)" value={revForm.lead} onChange={(v) => setRevForm({ ...revForm, lead: v })} />
          <TextField id="rv-fr" label="Estimated freight %" value={revForm.freight} onChange={(v) => setRevForm({ ...revForm, freight: v })} />
          <TextField id="rv-du" label="Duty %" value={revForm.duty} onChange={(v) => setRevForm({ ...revForm, duty: v })} />
          <TextField id="rv-valid" type="date" label="Valid until" value={revForm.valid} onChange={(v) => setRevForm({ ...revForm, valid: v })} />
          <div className="flex items-center gap-2 pt-6">
            <Switch id="rv-ba" checked={revForm.ba} onCheckedChange={(c) => setRevForm({ ...revForm, ba: c })} />
            <Label htmlFor="rv-ba">Buy America compliant</Label>
          </div>
          <TextField id="rv-note" label="What changed" value={revForm.note} onChange={(v) => setRevForm({ ...revForm, note: v })} />
          <TextField id="rv-dev" label="Deviations from the package (one per line)" value={revForm.dev} onChange={(v) => setRevForm({ ...revForm, dev: v })} />
        </div>
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object" && "tech" in dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Technical pass or fail (Engineering)"
        confirmLabel="Record result"
        consequence="Records Engineering's result against the STP. When every received response has a result, commercial bids open."
        onConfirm={() => {
          if (!dlg || typeof dlg !== "object" || !("tech" in dlg)) return null
          return report(technicalReview(q.id, dlg.tech, tech.pass === "pass", tech.note), "Technical result recorded")
        }}
      >
        <SelectField id="t-pass" label="Result" value={tech.pass} onChange={(v) => setTech({ ...tech, pass: v })} options={[{ value: "pass", label: "Pass: meets the STP" }, { value: "fail", label: "Fail: does not meet the STP" }]} />
        <TextField id="t-note" label="Technical note" value={tech.note} onChange={(v) => setTech({ ...tech, note: v })} />
      </DialogShell>
      <DialogShell
        open={dlg === "award"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Award ${q.id}`}
        confirmLabel="Award and create PO"
        consequence="Awards the RFQ, writes the AVL price basis (info record) for the winner, sends regret notices and creates a Draft PO that goes for approval on the PO ladder. A winner who is not a Qualified AVL vendor is written as Conditional, and for a QI-critical item the PO cannot go for approval until the AVL row is Qualified (E-PUR-02)."
        onConfirm={() => {
          const r = awardRfq(q.id, award as VendorId, just)
          const err = report(r, (po) => `${q.id} awarded; ${po} created`)
          if (r.ok) nav(`/purchasing/orders/${r.value}`)
          return err
        }}
      >
        <SelectField id="aw-v" label="Vendor" value={award} onChange={(v) => setAward(v)} options={passed.map((x) => ({ value: x.vendorId, label: `${vendorName(s, x.vendorId)}: landed ${fmtMoney(Math.round(landed(x) * 100) / 100)}${x === lowest ? " (lowest)" : ""}` }))} />
        {award && lowest && award !== lowest.vendorId && <TextField id="aw-j" label="Justification (not the lowest landed cost)" value={just} onChange={setJust} />}
      </DialogShell>
    </>
  )
}


