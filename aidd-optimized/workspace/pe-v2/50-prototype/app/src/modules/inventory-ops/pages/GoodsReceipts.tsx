// FX-INV-GRN Goods receipt with the supplier technical package delta (FL-10 stage 13, FL-03).
// The list shows dock receipts waiting to be posted and the posted GRNs, each with the STP chip, the
// E-DTS-04 block and the certificate-vs-STP result. The detail shows the checklist, the STP diff for
// wrong-revision documentation, and the actions: post the receipt (hard-blocked by E-DTS-04), attach a
// certificate, accept. A GRN has no status list in the PRD: its state is text (OQ-21).
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { CircleCheck, CircleX, Info, Minus, PackageCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { OTHER_POSTINGS, docRoute } from "@/data/domain"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { L, NoList, Reading, matText, userName } from "../components/bits"
import { useViewState } from "../components/states"
import { dockView, grnIds, grnView, summarize, type ReceiptView } from "../lib/grn"
import type { CheckResult, CheckRow } from "../lib/rules"
import type { CertType } from "../data/types"
import * as A from "../data/actions"

const RESULT_ICON: Record<CheckResult, typeof Info> = { Pass: CircleCheck, Fail: CircleX, Missing: CircleX, "Wrong revision": CircleX, Note: Info, "Not applicable": Minus }

export function StpChip({ v }: { v: ReceiptView }) {
  if (!v.stp) return <span className="text-muted-foreground">No STP on this line</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" title={`${v.stp.title ?? v.stp.id}; checksum ${v.stp.checksum.slice(0, 18)}...`}>
        <PackageCheck aria-hidden="true" />
        {v.stp.id} v{v.stp.version}
      </Badge>
      {v.stp.superseded && <Chip kind="change" note={`Superseded by ${v.stp.supersededBy ?? "a later version"}`}>Superseded</Chip>}
      {v.ack ? <StatusBadge kind="stpAck" status={v.ack.status} size="sm" /> : <Chip kind="block" note="E-DTS-04: the vendor never acknowledged this version">No acknowledgement</Chip>}
    </span>
  )
}

function certText(v: ReceiptView) {
  const s = summarize(v)
  if (!s.certTotal) return "No certificate required"
  if (!v.hasRecord && v.kind === "grn") return "No record"
  return s.wrong ? `${s.pass} of ${s.certTotal} pass, ${s.wrong} wrong revision` : s.missing ? `${s.pass} of ${s.certTotal} attached` : `${s.pass} of ${s.certTotal} pass`
}
function acceptText(v: ReceiptView) {
  if (v.kind === "dock") return v.postedAs ? `Posted as ${v.postedAs}` : "Not posted"
  if (v.accepted) return `Accepted ${fmtDate(v.accepted.on)}`
  const s = summarize(v)
  return s.accept.length ? "Acceptance blocked" : "Ready to accept"
}

// ============================================================================ list
export function GrnList() {
  const pf = useSlice("purchasingFinance")
  const mats = useSlice("materials")
  const io = useSlice("inventoryOps")
  const ss = useViewState("FX-INV-GRN", { degradedWhat: "The STP service is slow, so acknowledgement states may be out of date" })
  const rows = ss.empty ? [] : grnIds(pf, mats).map((id) => grnView(pf, mats, io, id)!).filter(Boolean).sort((a, b) => b.on.localeCompare(a.on) || b.id.localeCompare(a.id))
  const dock = ss.empty ? [] : io.inbound.map((r) => dockView(pf, io, r.id)!).filter(Boolean)
  const cols: Column<ReceiptView>[] = [
    { id: "id", header: "Goods receipt", value: (r) => r.id, sortable: true, mono: true },
    { id: "po", header: "PO", value: (r) => r.poId, sortable: true, cell: (r) => (r.poMissing ? r.poId : <L to={`/purchasing/orders/${r.poId}`}>{r.poId}</L>) },
    { id: "vendor", header: "Vendor", value: (r) => r.vendorName, sortable: true, filterable: true },
    { id: "on", header: "Received", value: (r) => r.on, sortable: true, cell: (r) => fmtDate(r.on) },
    { id: "item", header: "Material", value: (r) => r.itemId, cell: (r) => `${r.qty.toLocaleString("en-US")} ${r.uom} ${matText(r.itemId)}` },
    { id: "stp", header: "STP", value: (r) => r.stp?.id ?? "None", filterable: true, cell: (r) => <StpChip v={r} /> },
    { id: "certs", header: "Certificates vs STP", value: (r) => certText(r), cell: (r) => <span>{certText(r)}</span> },
    { id: "accept", header: "Acceptance", value: (r) => acceptText(r), filterable: true, cell: (r) => (acceptText(r) === "Acceptance blocked" ? <Chip kind="block" note="E-QM-06 or wrong-revision documentation">Acceptance blocked</Chip> : <span>{acceptText(r)}</span>) },
  ]
  return (
    <ListPage<ReceiptView>
      header={{
        title: "Goods receipts",
        screenId: "FX-INV-GRN",
        description: "Receipts against purchase orders with the supplier technical package: the STP version and the vendor's acknowledgement, the E-DTS-04 hard block, and the check of each certificate against what the STP requires.",
        actions: ss.toolbar,
        chips: <Reading id="RD-IO-10" />,
        children: ss.banners,
      }}
      above={
        <section aria-label="Dock receipts" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Dock receipts waiting to be posted <span className="tabular text-muted-foreground">{dock.filter((d) => !d.postedAs).length}</span></h2>
          {ss.loading ? (
            <Skeleton className="h-24 w-full" />
          ) : !dock.length ? (
            <EmptyState title="Nothing waiting at the dock">Deliveries appear here when Receiving identifies them against a purchase order (SP-01).</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Dock receipt</TableHead>
                    <TableHead>PO and line</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>STP</TableHead>
                    <TableHead>E-DTS-04</TableHead>
                    <TableHead>Certificates vs STP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dock.map((d) => {
                    const s = summarize(d)
                    return (
                      <TableRow key={d.id} className="h-8 text-[13px]">
                        <TableCell><Link className="font-mono font-medium text-link underline-offset-4 hover:underline" to={`/inventory-ops/goods-receipts/${d.id}`}>{d.id}</Link></TableCell>
                        <TableCell>{d.poId} line {d.line}</TableCell>
                        <TableCell>{d.vendorName}</TableCell>
                        <TableCell>{d.qty.toLocaleString("en-US")} {d.uom} {matText(d.itemId)}</TableCell>
                        <TableCell><StpChip v={d} /></TableCell>
                        <TableCell>{d.postedAs ? <span className="text-muted-foreground">Posted as {d.postedAs}</span> : s.post.length ? <Chip kind="block" note={s.post[0].found}>Receipt blocked</Chip> : <span>Clear</span>}</TableCell>
                        <TableCell>{certText(d)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      }
      table={{
        rows,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/inventory-ops/goods-receipts/${r.id}`,
        searchText: (r) => `${r.id} ${r.poId} ${r.vendorName} ${r.itemId} ${r.stp?.id ?? ""}`,
        searchPlaceholder: "Search receipts, POs, vendors, STPs",
        loading: ss.loading,
        error: ss.error,
        onRetry: ss.onRetry,
        empty: { title: "No goods receipts yet", body: "A receipt is posted from a dock receipt or from the purchase order." },
        initialSort: { id: "on", dir: "desc" },
        caption: "Posted goods receipts",
      }}
    />
  )
}

// ============================================================================ detail
export function GrnDetail() {
  const { id = "" } = useParams()
  const pf = useSlice("purchasingFinance")
  const mats = useSlice("materials")
  const io = useSlice("inventoryOps")
  const nav = useNavigate()
  const ss = useViewState(`FX-INV-GRN-${id}`, { degradedWhat: "The STP service is slow, so acknowledgement states may be out of date" })
  const v = id.startsWith("RCV-") ? dockView(pf, io, id) : grnView(pf, mats, io, id)
  const [err, setErr] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | "post" | "accept" | { attach: CheckRow }>(null)
  const [batch, setBatch] = useState("")
  const [f, setF] = useState({ docNo: "", cites: "" })

  if (ss.loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader title={`Goods receipt ${id}`} screenId="FX-INV-GRN" />
        <Skeleton className="h-32 w-full max-w-[960px]" />
      </div>
    )
  if (!v)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={`Goods receipt ${id}`} screenId="FX-INV-GRN" crumbs={[{ label: "Goods receipts", to: "/inventory-ops/goods-receipts" }]} />
        <EmptyState title={`${id} is not a goods receipt or a dock receipt`}>Open the list to find one.</EmptyState>
      </div>
    )

  const s = summarize(v)
  const dock = v.kind === "dock"
  const writable = ss.canWrite
  const blockedPost = s.post[0]
  const header = {
    title: dock ? `Dock receipt ${v.id}` : `Goods receipt ${v.id}`,
    screenId: "FX-INV-GRN",
    description: dock ? `${v.poId} line ${v.line}, delivery note ${v.deliveryNote} at dock ${v.dock}. Not yet a goods receipt: nothing is in stock until it posts.` : `${v.poId}${v.poMissing ? "" : ""}, received ${fmtDate(v.on)}. ${v.note ?? ""}`,
    crumbs: [{ label: "Goods receipts", to: "/inventory-ops/goods-receipts" }, { label: v.id }],
    actions: ss.toolbar,
    chips: (
      <>
        <NoList text={dock ? (v.postedAs ? `Posted as ${v.postedAs}` : "Dock receipt") : v.accepted ? "Accepted" : "Posted, QI Hold"} />
        <StpChip v={v} />
        {dock && blockedPost && <Chip kind="block" note="E-DTS-04: receipt is hard-blocked until the vendor acknowledges the revised package">E-DTS-04 block</Chip>}
        {!dock && v.accepted && <Chip kind="design" note="An accepted receipt is read-only">Read-only</Chip>}
      </>
    ),
    primary: dock && !v.postedAs ? <Button disabled={!writable} title={ss.blockedWhy} onClick={() => (setErr(null), setDlg("post"))}>Post receipt</Button> : !dock && !v.accepted ? <Button disabled={!writable} title={ss.blockedWhy} onClick={() => (setErr(null), setDlg("accept"))}>Accept receipt</Button> : undefined,
  }

  const checklist = (
    <div className="flex flex-col gap-3">
      {ss.banners}
      {err && <ErrorAlert title="That did not go through" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
      {dock && !v.postedAs && blockedPost && (
        <ErrorAlert title="E-DTS-04: receipt is hard-blocked" action={!v.poMissing ? <L to={`/purchasing/orders/${v.poId}`}>Open {v.poId} to capture the acknowledgement</L> : undefined}>
          {v.stp ? `The vendor never acknowledged ${v.stp.id} version ${v.stp.version} (${blockedPost.found}). ` : ""}The receipt cannot post (C-23). <Reading id="RD-IO-08" />
        </ErrorAlert>
      )}
      {!dock && !v.hasRecord && <ErrorAlert title="No certificate record">This receipt was posted before the checklist existed here. Attach the certificates to start it.</ErrorAlert>}
      {s.accept.length > 0 && !v.accepted && (
        <ErrorAlert title="Acceptance is blocked">
          {s.accept.map((a) => (a.diff ? `${a.label} cites ${a.diff.found}; the STP requires ${a.diff.required} of ${a.diff.drawing}.` : `${a.label}: ${a.found.toLowerCase()} (${a.code}).`)).join(" ")}
        </ErrorAlert>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <caption className="sr-only">Certificate-vs-STP checklist</caption>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Found</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.rows.map((r) => {
              const Icon = RESULT_ICON[r.result]
              const bad = r.result === "Fail" || r.result === "Missing" || r.result === "Wrong revision"
              const certRow = v.required.includes(r.id)
              return (
                <TableRow key={r.id} className="align-top text-[13px]">
                  <TableCell className="font-medium">{r.label}{r.code && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.code}</span>}</TableCell>
                  <TableCell>{r.required}</TableCell>
                  <TableCell>
                    {r.found}
                    {r.diff && (
                      <dl className="mt-1 grid max-w-xs grid-cols-[auto_1fr] gap-x-3 rounded-md border p-2 text-xs" aria-label="STP diff">
                        <dt className="text-muted-foreground">Drawing</dt><dd className="font-mono">{r.diff.drawing}</dd>
                        <dt className="text-muted-foreground">STP requires</dt><dd className="font-mono font-semibold">{r.diff.required}</dd>
                        <dt className="text-muted-foreground">Certificate cites</dt><dd className="font-mono font-semibold text-destructive">{r.diff.found}</dd>
                      </dl>
                    )}
                  </TableCell>
                  <TableCell><span className={bad ? "inline-flex items-center gap-1 font-medium text-destructive" : "inline-flex items-center gap-1"}><Icon className="size-4" aria-hidden="true" />{r.result}</span></TableCell>
                  <TableCell>
                    {certRow && !v.accepted && !v.postedAs?.length && (
                      <Button size="sm" variant="outline" disabled={!writable} title={ss.blockedWhy} onClick={() => (setErr(null), setF({ docNo: "", cites: "" }), setDlg({ attach: r }))}>{r.result === "Missing" ? "Attach" : "Replace"}</Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {v.accepted && <p className="text-sm text-muted-foreground">Accepted by {userName(v.accepted.by)} on {fmtDate(v.accepted.on)}{v.accepted.note ? `: ${v.accepted.note}` : ""}.</p>}
    </div>
  )

  const receipt = (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Vendor batch / heat</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="h-8 text-[13px]">
              <TableCell>{matText(v.itemId)}</TableCell>
              <TableCell className="tabular text-right">{v.qty.toLocaleString("en-US")} {v.uom}</TableCell>
              <TableCell className="font-mono">{v.batch ?? (dock ? "assigned at posting (SP-02)" : "none")}</TableCell>
              <TableCell className="font-mono">{v.vendorBatch ?? "none"}</TableCell>
              <TableCell className="tabular text-right">{v.value != null ? fmtMoney(v.value, v.currency) : "n/a"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {v.serials.length > 0 && <p className="text-sm text-muted-foreground">{v.serials.length} serial(s): {v.serials.slice(0, 3).join(", ")}{v.serials.length > 3 ? ", ..." : ""}</p>}
      <section aria-label="Posting" className="rounded-lg border">
        <h3 className="border-b px-4 py-2 text-sm font-semibold">{dock ? "Posting on commit" : "Posting made"} <Reading id="RD-IO-10" /></h3>
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>Transaction</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow className="h-8 text-[13px]">
              <TableCell>{OTHER_POSTINGS.grn.transaction}<div className="text-xs text-muted-foreground">Named in the FL-03 flow text [DOC:p.178]; no template number</div></TableCell>
              <TableCell>{OTHER_POSTINGS.grn.debit}</TableCell>
              <TableCell>{OTHER_POSTINGS.grn.credit}</TableCell>
              <TableCell className="tabular text-right">{v.value != null ? fmtMoney(v.value, v.currency) : "n/a"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">Stock enters QI Hold when quality inspection at receipt is ON; traceability event T02 records the receipt identity (GRN, batch, vendor batch, certificate checksums).</p>
      </section>
    </div>
  )

  const stpTab = v.stp ? (
    <dl className="grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-3">
      <KV k="Package"><Link className="text-link underline-offset-4 hover:underline" to={docRoute({ type: "stp", id: v.stp.id })}>{v.stp.id} version {v.stp.version}</Link></KV>
      <KV k="Superseded">{v.stp.superseded ? `Yes, by ${v.stp.supersededBy ?? "a later version"}` : "No, current"}</KV>
      <KV k="Vendor acknowledgement">{v.ack ? <StatusBadge kind="stpAck" status={v.ack.status} size="sm" /> : "Never acknowledged"} {v.ack && <span className="text-muted-foreground">{fmtDate(v.ack.on)}</span>}</KV>
      <KV k="Drawings and revisions">{v.stp.drawingRevisions.join("; ")}</KV>
      <KV k="Specifications">{v.stp.specs.join("; ")}</KV>
      <KV k="Quality clauses">{v.stp.clauses.join(", ")}</KV>
      <KV k="Manifest checksum"><span className="break-all font-mono text-xs">{v.stp.checksum}</span></KV>
    </dl>
  ) : (
    <EmptyState title="No STP on this purchase order line">A supplier technical package is required on long-lead and engineered lines. Certificates are still checked against the material's requirements.</EmptyState>
  )

  return (
    <>
      <DetailPage
        header={header}
        doc={dock ? undefined : { type: "grn", id: v.id }}
        summary={
          <>
            <KV k="Purchase order">{v.poMissing ? v.poId : <L to={`/purchasing/orders/${v.poId}`}>{v.poId}</L>}{v.line ? ` line ${v.line}` : ""}</KV>
            <KV k="Vendor">{v.vendorName}</KV>
            <KV k={dock ? "Arrived" : "Received"}>{fmtDate(v.on)}</KV>
            <KV k="Material">{matText(v.itemId)}</KV>
          </>
        }
        tabs={[
          { id: "certs", label: "Certificates vs STP", content: checklist, count: v.rows.length },
          { id: "receipt", label: "Receipt and posting", content: receipt },
          { id: "stp", label: "Supplier technical package", content: stpTab },
        ]}
      />
      <RulesPanel
        rules={[
          ["E-DTS-04", "Receipt against a PO whose vendor never acknowledged a revised STP hard-blocks. The prototype also blocks Exception and Rejected acknowledgements (RD-IO-08).", "[DOC:p.209 §3.3]"],
          ["C-23", "Receipt is hard-blocked when the vendor never acknowledged a revised STP; the receiving screen shows E-DTS-04 and cannot post.", "[DOC:p.209 §3.3]"],
          ["E-QM-06", "GRN blocks Accept until the certificates the material requires are attached.", "[DOC:p.150 §3.10]"],
          ["STP diff", "Wrong-revision documentation at receipt blocks acceptance with the STP diff shown.", "[DOC:p.210 §3.3]"],
          ["E-DTS-03", "A superseded STP cannot attach to new documents.", "[DOC:p.209 §3.3]"],
          ["T02", "Receipt identity is captured at the GRN: GRN, batch, vendor batch, quantity, dates, certificate checksums.", "[DOC:p.211 §4.1]"],
        ]}
      />
      <DialogShell
        open={dlg === "post"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Post ${v.id}`}
        consequence={`Posts a goods receipt for ${v.qty.toLocaleString("en-US")} ${v.uom} ${v.itemId} against ${v.poId} line ${v.line}: DR 13xx Inventory / CR 2110 GR/IR${v.value != null ? ` for ${fmtMoney(v.value, v.currency)}` : ""}, stock to QI Hold, traceability event T02. If the vendor never acknowledged the STP the receipt is hard-blocked (E-DTS-04).`}
        confirmLabel="Post receipt"
        onConfirm={() => {
          const r = A.postReceipt(v.id, batch)
          if (!r.ok) return r.error
          toast.success(`${r.value.grnId} posted`)
          nav(`/inventory-ops/goods-receipts/${r.value.grnId}`)
          return null
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="grn-batch">Batch label printed and scanned back (SP-02)</Label>
          <Input id="grn-batch" className="font-mono" value={batch} placeholder="BAT-TBD-R1009" onChange={(e) => setBatch(e.target.value)} />
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "accept"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Accept ${v.id}`}
        consequence={`Accepts the documentation of ${v.id}. Acceptance is blocked until every required certificate is attached and matches the STP; the receipt is read-only afterwards.`}
        confirmLabel="Accept receipt"
        onConfirm={() => {
          const r = A.acceptReceipt(v.id, "")
          if (!r.ok) return r.error
          toast.success(`${v.id} accepted`)
          return null
        }}
      />
      <DialogShell
        open={typeof dlg === "object" && !!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={typeof dlg === "object" && dlg ? `${dlg.attach.result === "Missing" ? "Attach" : "Replace"} ${dlg.attach.label}` : ""}
        consequence="Attaches the vendor's document to the receipt and re-checks it against the STP."
        confirmLabel="Attach certificate"
        onConfirm={() => {
          if (typeof dlg !== "object" || !dlg) return null
          const r = A.attachCert(dock ? { receiptId: v.id } : { grnId: v.id }, { type: dlg.attach.id as CertType, docNo: f.docNo, cites: f.cites })
          if (!r.ok) return r.error
          toast.success("Certificate attached")
          return null
        }}
      >
        <div className="grid gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="cert-no">Certificate document number</Label>
            <Input id="cert-no" className="font-mono" value={f.docNo} onChange={(e) => setF({ ...f, docNo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cert-cites">{typeof dlg === "object" && dlg?.attach.id === "Mill Cert per Heat" ? "Heat number on the certificate" : "Drawing and revision it cites (optional)"}</Label>
            <Input id="cert-cites" className="font-mono" value={f.cites} placeholder={typeof dlg === "object" && dlg?.attach.id === "Mill Cert per Heat" ? "PPF-H-5512" : v.stp?.drawingRevisions[0] ?? "DWG-TBD-BSH015 rev D"} onChange={(e) => setF({ ...f, cites: e.target.value })} />
          </div>
        </div>
      </DialogShell>
    </>
  )
}
