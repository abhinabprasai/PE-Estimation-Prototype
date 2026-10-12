// PUR-PO-001/2 Purchase Orders [DOC:pp.267-268] (asserted); rules Book I G §5, Book IV §3.3.
// List: every S-35 status, Change Pending overlay chip, LLR flag. Detail: header with quality clauses
// and Buy America state, line grid with delivery schedules, STP version chip, LLR flag, revision
// history. Actions: approve per ladder (ApprovalButton only, C-1), Send, capture confirmation and
// STP acknowledgement, revise with change summary. Receipt (SP-01..SP-03) and three-way match are
// shown here so the PO reaches its downstream statuses; they post through the shared Posting Service.
import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { FilePen, PackageCheck, Plus, Receipt, Send, ShieldAlert, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, Chip, EmptyState, KV, PostingPreview, RulesPanel, ScanField, StatusBadge, type Column } from "@/components/patterns"
import { routeApproval, THRESHOLDS } from "@/data/domain"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { cancelPo, confirmPo, expedite, issueProvided, matchInvoice, overrideRestricted, poBlocker, postGrn, revisePo, sendPo, shortClose } from "../data/actions"
import { isUnconfirmedOverdue, itemText, material, OPEN_PO, poTotal, stdOf, vendorEligibility, vendorName, vendorOf } from "../data/logic"
import type { PoRec } from "../data/types"
import { CsvButton, DocLink, OtherPostingPreview, Reading, report, Section, TextState, useDemoState } from "../components/common"
import { DetailFrame, ItemLink, RecLink, SelectField, TextField, userName, VendorLink } from "../components/bits"

type Row = PoRec & { total: number; vendor: string; nextDate?: string }

export function PoList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-PO-001")
  const [sp] = useSearchParams()
  const vendorFilter = sp.get("vendor")
  const rows = useMemo<Row[]>(
    () =>
      s.purchaseOrders
        .filter((p) => !vendorFilter || p.vendorId === vendorFilter)
        .map((p) => ({ ...p, total: poTotal(p), vendor: vendorName(s, p.vendorId), nextDate: p.lines.filter((l) => l.status === "Open" || l.status === "Partial").map((l) => l.confirmedDate ?? l.needBy).sort()[0] })),
    [s, vendorFilter],
  )
  const cols: Column<Row>[] = [
    { id: "id", header: "PO", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[320px]">{r.title}</span> },
    { id: "vendor", header: "Vendor", value: (r) => r.vendor, filterable: true },
    { id: "type", header: "Type", value: (r) => r.type, filterable: true },
    { id: "total", header: "Value", value: (r) => r.total, align: "right", mono: true, sortable: true, cell: (r) => fmtMoney(r.total, r.currency) },
    { id: "next", header: "Next date", value: (r) => r.nextDate ?? "", sortable: true, cell: (r) => (r.nextDate ? fmtDate(r.nextDate) : "") },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="purchaseOrder" status={r.status} size="sm" /> },
    {
      id: "flags",
      header: "Flags",
      value: (r) => [r.changePending && "Change Pending", r.llrId && "Long-lead", isUnconfirmedOverdue(r) && "Unconfirmed > 3 days"].filter(Boolean).join(", "),
      filterable: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.changePending && <Chip kind="change">Change Pending</Chip>}
          {r.llrId && <Chip kind="flag" note={`Long-Lead: Preliminary Revision under ${r.llrId}`}>LLR</Chip>}
          {isUnconfirmedOverdue(r) && <Chip kind="flag">Unconfirmed &gt; 3 days</Chip>}
        </span>
      ),
    },
  ]
  return (
    <ListPage
      header={{
        screenId: "PUR-PO-001/2",
        title: "Purchase orders",
        description: "Commitments to vendors from grouped requisitions, RFQ awards and long-lead releases. Approval follows the PO value ladder in WF-INBOX.",
        chips: vendorFilter ? <Chip kind="design">Vendor {vendorFilter}</Chip> : undefined,
        actions: (
          <>
            {st.menu}
            <CsvButton filename="purchase-orders.csv" rows={rows.map((r) => ({ PO: r.id, Vendor: r.vendor, Type: r.type, Value: r.total, Currency: r.currency, Status: r.status, "Change Pending": r.changePending ? "yes" : "" }))} />
          </>
        ),
        primary: (
          <Button asChild>
            <Link to="/purchasing/workbench">
              <Plus aria-hidden="true" /> Create from requisitions
            </Link>
          </Button>
        ),
      }}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/purchasing/orders/${r.id}`,
        searchText: (r) => `${r.id} ${r.title} ${r.vendor} ${r.lines.map((l) => l.itemId).join(" ")}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "PUR-PO-001",
        initialSort: { id: "id", dir: "desc" },
        empty: { title: "No purchase orders yet", body: "POs are created from approved requisitions on the Buyer Workbench or on an RFQ award." },
      }}
      below={<LadderTable />}
    />
  )
}

/** The PO value ladder from table F (Book I G §5.2; [DOC:p.11 §W.4; p.104]). */
function LadderTable({ amount }: { amount?: number }) {
  const bands = [
    { to: 25_000, label: "Up to $25,000", steps: "Buyer" },
    { to: 250_000, label: "$25,000 to $250,000", steps: "Purchasing Manager" },
    { to: 1_000_000, label: "$250,000 to $1,000,000", steps: "Purchasing Manager, then Controller" },
    { to: Infinity, label: "Above $1,000,000", steps: "Purchasing Manager, Controller, then CFO" },
  ]
  const hit = amount == null ? -1 : bands.findIndex((b) => amount <= b.to)
  return (
    <Section title="PO approval ladder (table F)">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>PO value</TableHead>
            <TableHead>Approvers, in sequence</TableHead>
            <TableHead>Delegation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bands.map((b, i) => (
            <TableRow key={b.label} className="h-8 text-[13px]" aria-current={i === hit ? "true" : undefined}>
              <TableCell className={i === hit ? "font-semibold" : undefined}>
                {b.label} {i === hit && <Chip kind="flag">this PO</Chip>}
              </TableCell>
              <TableCell>{b.steps}</TableCell>
              <TableCell>{b.to > 250_000 ? "Not allowed above $250,000 on financial approvals (C-2)" : "Allowed"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

export function PoDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-PO-002")
  const p = s.purchaseOrders.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!p} title={id} screenId="PUR-PO-001/2" back={{ label: "Purchase orders", to: "/purchasing/orders" }}>
      {() => <PoBody p={p!} menu={st.menu} />}
    </DetailFrame>
  )
}

function PoBody({ p, menu }: { p: PoRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const [role] = useRole()
  const [dlg, setDlg] = useState<null | "send" | "confirm" | "revise" | "cancel" | "short" | "override" | "grn" | "match" | "provide" | "expedite">(null)
  const total = poTotal(p)
  const v = vendorOf(s, p.vendorId)
  const el = vendorEligibility(v)
  const blocker = poBlocker(s, p)
  const llr = p.llrId ? s.llrs.find((l) => l.id === p.llrId) : undefined
  const route = routeApproval("PO approval", { amount: total })
  const grns = s.grns.filter((g) => g.poId === p.id)
  const terminal = p.status === "Matched/Closed" || p.status === "Cancelled"

  let primary: React.ReactNode = null
  if (p.status === "Draft")
    primary = <ApprovalButton kind="PO approval" subject={{ type: "purchaseOrder", id: p.id }} title={`${p.id} ${vendorName(s, p.vendorId)}: ${p.title}`} amount={total} currency={p.currency} variant="default" disabled={!!blocker} disabledReason={blocker ?? undefined} stay />
  else if (p.status === "In Approval") primary = <ApprovalButton kind="PO approval" subject={{ type: "purchaseOrder", id: p.id }} title={p.title} amount={total} currency={p.currency} variant="default" stay />
  else if (p.status === "Approved")
    primary = (
      <Button onClick={() => setDlg("send")}>
        <Send aria-hidden="true" /> Send to vendor
      </Button>
    )
  else if (p.status === "Sent" || (p.changePending && (p.status === "Confirmed" || p.status === "Partially Received")))
    primary = (
      <Button onClick={() => setDlg("confirm")}>
        <PackageCheck aria-hidden="true" /> Capture confirmation
      </Button>
    )
  else if (p.status === "Confirmed" || p.status === "Partially Received")
    primary = (
      <Button onClick={() => setDlg("grn")}>
        <Truck aria-hidden="true" /> Post goods receipt
      </Button>
    )
  else if (p.status === "Received")
    primary = (
      <Button onClick={() => setDlg("match")}>
        <Receipt aria-hidden="true" /> Match invoice
      </Button>
    )

  const actions = (
    <>
      {menu}
      {!terminal && p.status !== "Received" && (
        <Button variant="outline" onClick={() => setDlg("revise")}>
          <FilePen aria-hidden="true" /> {p.status === "Draft" ? "Edit lines" : "Revise"}
        </Button>
      )}
      {OPEN_PO(p) && !["Draft", "In Approval", "Approved"].includes(p.status) && (
        <Button variant="outline" onClick={() => setDlg("expedite")}>
          Expedite
        </Button>
      )}
      {el.needsOverride && !p.restrictedOverride && !terminal && (
        <Button variant="outline" onClick={() => setDlg("override")}>
          <ShieldAlert aria-hidden="true" /> Restricted override
        </Button>
      )}
      {p.type === "Subcontract" && p.provided?.some((x) => !x.issued) && ["Sent", "Confirmed", "Partially Received"].includes(p.status) && (
        <Button variant="outline" onClick={() => setDlg("provide")}>
          Issue provided components
        </Button>
      )}
      {p.status === "Partially Received" && (
        <Button variant="outline" onClick={() => setDlg("short")}>
          Short-close
        </Button>
      )}
      {!terminal && p.status !== "Received" && !p.lines.some((l) => l.received > 0) && (
        <Button variant="ghost" onClick={() => setDlg("cancel")}>
          Cancel PO
        </Button>
      )}
    </>
  )

  return (
    <>
      <DetailPage
        header={{
          screenId: "PUR-PO-001/2",
          title: `${p.id} · ${p.title}`,
          crumbs: [{ label: "Purchase orders", to: "/purchasing/orders" }],
          chips: (
            <>
              {p.changePending && <Chip kind="change">Change Pending</Chip>}
              {p.llrId && <Chip kind="flag" note="PO lines carry Long-Lead: Preliminary Revision (Book IV §3.2)">Long-Lead: Preliminary Revision</Chip>}
              {p.revision > 0 && <Chip kind="design" note="Revision number of the PO change order">Rev {p.revision}</Chip>}
              {isUnconfirmedOverdue(p) && <Chip kind="flag">Unconfirmed more than 3 business days</Chip>}
              {p.status === "Draft" && p.activity.some((a) => /Rejected/.test(a.text)) && <Reading id="OQ-PF-7" />}
            </>
          ),
          actions,
          primary,
        }}
        status={{ kind: "purchaseOrder", value: p.status }}
        doc={{ type: "purchaseOrder", id: p.id }}
        summary={
          <>
            <KV k="Vendor">
              <VendorLink id={p.vendorId} name={vendorName(s, p.vendorId)} />
            </KV>
            <KV k="Value">
              <span className="tabular">{fmtMoney(total, p.currency)}</span>
            </KV>
            <KV k="Type">{p.type}</KV>
            <KV k="Buyer">{userName(p.buyerId)}</KV>
            <KV k="Quality clauses">{p.qualityClauses.length ? p.qualityClauses.join(", ") : "None"}</KV>
            <KV k="Buy America">{p.buyAmerica ? "Required: certificate at receipt" : "Not required"}</KV>
            <KV k={llr ? "Long-lead release" : "Ship to"}>{llr ? <span className="flex flex-col"><RecLink to={`/purchasing/long-lead/${llr.id}`}>{llr.id}</RecLink><TextState value={llr.state} /></span> : p.shipToWarehouseId}</KV>
            <KV k="Sent / confirmed">{[p.sentOn ? fmtDate(p.sentOn) : "Not sent", p.confirmedOn ? fmtDate(p.confirmedOn) : "Not confirmed"].join(" / ")}</KV>
          </>
        }
        tabs={[
          {
            id: "lines",
            label: "Lines",
            count: p.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {blocker && !terminal && (
                  <p role="status" className="rounded-md border border-status-blocked px-4 py-2 text-sm">
                    <span className="font-semibold">Blocked: </span>
                    {blocker}
                  </p>
                )}
                {p.restrictedOverride && (
                  <p className="text-sm text-muted-foreground">
                    Restricted-vendor override by {userName(p.restrictedOverride.by)} on {fmtDate(p.restrictedOverride.on)}: {p.restrictedOverride.reason}
                  </p>
                )}
                <LinesTable p={p} />
                {p.type === "Subcontract" && p.provided && (
                  <Section title="Provided components (subcontract)">
                    <ul className="text-sm">
                      {p.provided.map((x) => (
                        <li key={x.itemId}>
                          {x.itemId} {itemText(x.itemId)} × {fmtNumber(x.qty)} · {x.issued ? "issued to vendor (#34 posted)" : "not yet issued"}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {p.ic && (
                  <Section title="Intercompany pair (FL-07)" action={<Reading id="OQ-PF-12" />}>
                    <p className="text-sm">
                      Seller entity {p.ic.sellerEntityId}; paired seller sales order <span className="font-mono">{p.ic.pairedSo}</span>; prices from transfer list{" "}
                      <RecLink to={`/pricing/price-lists/${p.ic.transferPriceListId}`}>{p.ic.transferPriceListId}</RecLink>.
                    </p>
                    <IcCheck p={p} />
                  </Section>
                )}
              </div>
            ),
          },
          {
            id: "approval",
            label: "Approval",
            content: (
              <div className="flex flex-col gap-4">
                <Section title="Route for this PO">
                  <p className="text-sm">
                    {route.rule}. Steps: {route.steps.join(" → ")}. Delegation {route.delegationAllowed ? "allowed" : "not allowed (above $250,000, C-2)"}. Source {route.source}.
                  </p>
                  <p className="text-sm text-muted-foreground">Approval happens only in WF-INBOX (C-1). A rejection returns the PO to Draft <Reading id="OQ-PF-7" />.</p>
                </Section>
                <LadderTable amount={total} />
              </div>
            ),
          },
          {
            id: "receipts",
            label: "Receipts and match",
            count: grns.length,
            content: (
              <div className="flex flex-col gap-4">
                {grns.length === 0 ? (
                  <EmptyState title="No goods receipts yet">Receipts post at the dock (SP-01 to SP-03) once the PO is Sent or Confirmed.</EmptyState>
                ) : (
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow>
                        <TableHead>GRN</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">PO price</TableHead>
                        <TableHead className="text-right">Standard</TableHead>
                        <TableHead>Batches / serials</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grns.flatMap((g) =>
                        g.lines.map((l) => (
                          <TableRow key={g.id + l.poLine} className="h-8 text-[13px]">
                            <TableCell>
                              <DocLink r={{ type: "grn", id: g.id }} />
                            </TableCell>
                            <TableCell>{fmtDate(g.on)}</TableCell>
                            <TableCell>{l.poLine}</TableCell>
                            <TableCell className="tabular text-right">{fmtNumber(l.qty)}</TableCell>
                            <TableCell className="tabular text-right">{fmtMoney(l.price, p.currency)}</TableCell>
                            <TableCell className="tabular text-right">{fmtMoney(l.std, p.currency)}</TableCell>
                            <TableCell className="font-mono text-xs">{[...g.batches, ...g.serials].join(", ") || "None"}</TableCell>
                          </TableRow>
                        )),
                      )}
                    </TableBody>
                  </Table>
                )}
                {p.invoice && (
                  <p className="text-sm">
                    Vendor invoice <span className="font-mono">{p.invoice.no}</span> matched on {fmtDate(p.invoice.on)}: {p.invoice.lines.map((l) => `line ${l.line} at ${fmtMoney(l.price, p.currency)}`).join("; ")}.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  GRN and three-way match belong to INV and ACC (ASM-EXT-1); they are shown here so the PO reaches Received and Matched/Closed. Variances land on the{" "}
                  <RecLink to="/inventory/valuation/cost-variance">Cost Variance Workbench</RecLink>.
                </p>
              </div>
            ),
          },
          {
            id: "revisions",
            label: "Revisions",
            count: p.revisions.length,
            content: p.revisions.length ? (
              <div className="flex flex-col gap-4">
                {p.revisions.map((r) => (
                  <Section key={r.rev} title={`Revision ${r.rev} · ${fmtDate(r.on)} · ${userName(r.by)}`} action={r.reapproval ? <Chip kind="change">Re-approval</Chip> : <Chip kind="design">Re-confirmation only</Chip>}>
                    <Table>
                      <TableHeader className="bg-table-head">
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Old</TableHead>
                          <TableHead>New</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.changes.map((c) => (
                          <TableRow key={c.field} className="h-8 text-[13px]">
                            <TableCell>{c.field}</TableCell>
                            <TableCell className="tabular">{c.old}</TableCell>
                            <TableCell className="tabular">{c.new}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Section>
                ))}
                {p.ecoImpact?.map((e) => (
                  <p key={e.ecoId} className="text-sm">
                    <Chip kind="change">{e.ecoId}</Chip> {fmtDate(e.on)}: {e.note}
                  </p>
                ))}
              </div>
            ) : (
              <EmptyState title="No revisions">An edit after the PO is sent creates a revision with a change summary (Book I G §5.3).</EmptyState>
            ),
          },
          {
            id: "expedite",
            label: "Expedite log",
            count: p.expedite.length,
            content: p.expedite.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {p.expedite.map((e, i) => (
                  <li key={i} className="rounded-md border px-4 py-2">
                    <span className="font-medium">{e.kind}</span> · {fmtDate(e.on)} · {userName(e.by)}
                    {e.line != null && ` · line ${e.line}`}
                    {e.newDate && ` · ${fmtDate(e.newDate)}`}
                    <div className="text-muted-foreground">{e.text}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No vendor contacts logged">Promises, push-outs, pull-ins and escalations recorded on the Expedite Board appear here.</EmptyState>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {[...p.activity].reverse().map((a, i) => (
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
              ["C-1", "Approval only through the shared engine (WF-INBOX)", "[DOC:p.11 §W.4]"],
              ["C-31", "No PO before vendor onboarding is Active", "[DOC:p.101 §2.1]"],
              ["C-32", "Restricted needs a Purchasing Manager override; Disqualified hard-blocks", "[DOC:p.101 §2.1]"],
              ["C-23", "Receipt is blocked when the vendor never acknowledged the STP (E-DTS-04)", "[DOC:p.209 §3.3]"],
              ["G §5.3", `Revision re-approval above ${THRESHOLDS.poPriceDeviationPct}% value increase or a higher ladder band`, "reading OQ-PF-5"],
              ["Acting", `You act as ${role}`, "role switcher"],
            ]}
          />
        }
      />
      <PoDialogs p={p} dlg={dlg} setDlg={setDlg} total={total} />
    </>
  )
}

function LinesTable({ p }: { p: PoRec }) {
  const s = useSlice("purchasingFinance")
  return (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Line</TableHead>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Unit price</TableHead>
          <TableHead>Schedules</TableHead>
          <TableHead>Confirmed</TableHead>
          <TableHead className="text-right">Received</TableHead>
          <TableHead>STP</TableHead>
          <TableHead>Line status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {p.lines.map((l) => {
          const stp = l.stpId ? s.stps.find((t) => t.id === l.stpId) : undefined
          const ack = stp?.acknowledgements.find((a) => a.vendorId === p.vendorId)
          return (
            <TableRow key={l.no} className="h-10 align-top text-[13px]">
              <TableCell className="tabular">{l.no}</TableCell>
              <TableCell>
                <ItemLink id={l.itemId} />
                {l.peg && (
                  <div className="text-xs">
                    pegged to <DocLink r={l.peg} />
                  </div>
                )}
                {l.llrFlag && <Chip kind="flag">Long-Lead: Preliminary Revision</Chip>}
              </TableCell>
              <TableCell className="tabular text-right">
                {fmtNumber(l.qty)} {material(l.itemId)?.baseUom}
              </TableCell>
              <TableCell className="tabular text-right">{fmtMoney(l.price, p.currency)}</TableCell>
              <TableCell>
                {l.schedules.map((x) => (
                  <div key={x.no} className="tabular text-xs">
                    {x.no}: {fmtNumber(x.qty)} on {fmtDate(x.date)}
                  </div>
                ))}
              </TableCell>
              <TableCell className="tabular">{l.confirmedDate ? fmtDate(l.confirmedDate) : "Not confirmed"}</TableCell>
              <TableCell className="tabular text-right">{fmtNumber(l.received)}</TableCell>
              <TableCell>
                {stp ? (
                  <span className="flex flex-col gap-1">
                    <RecLink to={`/purchasing/long-lead/${stp.id}`}>
                      {stp.id} v{stp.version}
                    </RecLink>
                    {stp.superseded && <Chip kind="block">Superseded</Chip>}
                    {ack ? <StatusBadge kind="stpAck" status={ack.status} size="sm" /> : <span className="text-xs text-muted-foreground">No acknowledgement</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge kind="poLine" status={l.status} size="sm" />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** Intercompany price check against the transfer list (FL-07); a deviation goes to WF-INBOX. */
function IcCheck({ p }: { p: PoRec }) {
  const s = useSlice("purchasingFinance")
  const tl = s.priceLists.find((x) => x.id === p.ic?.transferPriceListId)
  const dev = p.lines
    .map((l) => ({ l, tp: tl?.rates.find((r) => r.itemId === l.itemId)?.price }))
    .filter((x) => x.tp != null && Math.abs(x.l.price - x.tp) >= 0.01)
  if (!dev.length) return <p className="text-sm text-muted-foreground">All line prices equal the transfer price list.</p>
  return (
    <div className="flex flex-col gap-2 text-sm">
      {dev.map(({ l, tp }) => (
        <p key={l.no}>
          Line {l.no}: PO price {fmtMoney(l.price)} differs from transfer price {fmtMoney(tp!)}.
        </p>
      ))}
      <ApprovalButton kind="Intercompany price deviation" subject={{ type: "purchaseOrder", id: p.id }} title={`${p.id} intercompany price deviation`} amount={poTotal(p)} label="Request price deviation approval" stay />
    </div>
  )
}

type DlgKey = "send" | "confirm" | "revise" | "cancel" | "short" | "override" | "grn" | "match" | "provide" | "expedite"
function PoDialogs({ p, dlg, setDlg, total }: { p: PoRec; dlg: DlgKey | null; setDlg: (d: DlgKey | null) => void; total: number }) {
  const s = useSlice("purchasingFinance")
  const close = (o: boolean) => !o && setDlg(null)
  const openLines = p.lines.filter((l) => l.status !== "Cancelled")
  // confirmation
  const [dates, setDates] = useState<Record<number, string>>({})
  const [ack, setAck] = useState<"" | "Acknowledged" | "Exception" | "Rejected">("")
  // revise
  const [rev, setRev] = useState<Record<number, { qty: string; price: string; date: string }>>({})
  // receipt
  const [gLine, setGLine] = useState<number | null>(null)
  const [gQty, setGQty] = useState("")
  const [gBatch, setGBatch] = useState("")
  const [gSerials, setGSerials] = useState<string[]>([])
  // match
  const [inv, setInv] = useState("")
  const [invPrices, setInvPrices] = useState<Record<number, string>>({})
  // expedite
  const [xKind, setXKind] = useState<"Promise" | "Push out" | "Pull in" | "Escalate" | "Call" | "Email">("Call")
  const [xLine, setXLine] = useState("")
  const [xDate, setXDate] = useState("")
  const [xText, setXText] = useState("")

  const hasStp = openLines.some((l) => l.stpId)
  const grnLine = p.lines.find((l) => l.no === gLine)
  const grnMat = grnLine ? material(grnLine.itemId) : undefined
  const qtyN = Number(gQty) || 0
  const std = grnLine ? (stdOf(s, grnLine.itemId) ?? grnLine.price) : 0

  return (
    <>
      <DialogShell
        open={dlg === "send"}
        onOpenChange={close}
        title={`Send ${p.id} to the vendor`}
        confirmLabel="Send"
        consequence={`Sends ${p.id} (${fmtMoney(total, p.currency)}) to ${vendorName(s, p.vendorId)} as PDF (IF-01), moves it to Sent and records traceability event T01. Nothing posts at creation.${p.llrId ? ` Lines go out flagged Long-Lead: Preliminary Revision under ${p.llrId}.` : ""}`}
        onConfirm={() => report(sendPo(p.id), `${p.id} sent`)}
      >
        {p.llrId && (
          <p className="text-sm">
            Sent only once {p.llrId} is approved <Reading id="OQ-PF-3" />.
          </p>
        )}
      </DialogShell>

      <DialogShell
        open={dlg === "confirm"}
        onOpenChange={close}
        title={`Capture vendor confirmation for ${p.id}`}
        confirmLabel="Record confirmation"
        consequence={`Stores the vendor-confirmed date per line (IF-02)${p.status === "Sent" ? " and moves the PO to Confirmed" : " and clears Change Pending"}.${hasStp ? " Records the vendor's STP acknowledgement (S-19)." : ""}`}
        onConfirm={() => report(confirmPo(p.id, dates, ack || undefined), `${p.id} confirmation captured`)}
      >
        <div className="flex flex-col gap-2">
          {openLines.map((l) => (
            <TextField key={l.no} id={`cd-${l.no}`} type="date" label={`Line ${l.no} confirmed date (need by ${fmtDate(l.needBy)})`} value={dates[l.no] ?? l.confirmedDate ?? ""} onChange={(v) => setDates({ ...dates, [l.no]: v })} />
          ))}
          {hasStp && (
            <SelectField
              id="stp-ack"
              label="STP acknowledgement from the vendor"
              value={ack}
              onChange={setAck}
              options={[
                { value: "Acknowledged", label: "Acknowledged" },
                { value: "Exception", label: "Exception" },
                { value: "Rejected", label: "Rejected" },
              ]}
              hint="Receipt is hard-blocked until the vendor acknowledges the package (E-DTS-04, C-23)."
            />
          )}
        </div>
      </DialogShell>

      <DialogShell
        open={dlg === "revise"}
        onOpenChange={close}
        wide
        title={p.status === "Draft" ? `Edit ${p.id}` : `Revise ${p.id} (change order)`}
        confirmLabel={p.status === "Draft" ? "Save" : "Create revision"}
        consequence={
          p.status === "Draft"
            ? "Updates the draft lines. The approval route follows the new value."
            : `Creates revision ${p.revision + 1} with a change summary, sets Change Pending and resets confirmation on changed lines. A value increase above ${THRESHOLDS.poPriceDeviationPct}% or into a higher ladder band raises a new PO approval in WF-INBOX.`
        }
        onConfirm={() => {
          const changes = Object.entries(rev).map(([no, c]) => ({ line: Number(no), qty: c.qty ? Number(c.qty) : undefined, price: c.price ? Number(c.price) : undefined, date: c.date || undefined }))
          return report(revisePo(p.id, changes), (v) => (v.reapproval ? `${p.id} revised; re-approval raised in WF-INBOX` : `${p.id} updated`))
        }}
      >
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Line</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Need-by date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openLines.map((l) => {
              const c = rev[l.no] ?? { qty: "", price: "", date: "" }
              const set = (k: "qty" | "price" | "date", v: string) => setRev({ ...rev, [l.no]: { ...c, [k]: v } })
              return (
                <TableRow key={l.no}>
                  <TableCell className="tabular">
                    {l.no} <span className="text-xs text-muted-foreground">{l.itemId}</span>
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`Line ${l.no} quantity`} placeholder={String(l.qty)} value={c.qty} onChange={(e) => set("qty", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`Line ${l.no} price`} placeholder={String(l.price)} value={c.price} onChange={(e) => set("price", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`Line ${l.no} date`} type="date" value={c.date} onChange={(e) => set("date", e.target.value)} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {p.status !== "Draft" && (
          <p className="text-xs text-muted-foreground">
            Re-approval threshold reading <Reading id="OQ-PF-5" />
          </p>
        )}
      </DialogShell>

      <DialogShell open={dlg === "cancel"} onOpenChange={close} destructive requireReason title={`Cancel ${p.id}`} confirmLabel="Cancel PO" consequence={`Cancels ${p.id} and every line; the requisitions it came from stay open for re-sourcing. This ends the record.`} onConfirm={(r) => report(cancelPo(p.id, r), `${p.id} cancelled`)} />
      <DialogShell open={dlg === "short"} onOpenChange={close} requireReason title={`Short-close ${p.id}`} confirmLabel="Short-close" consequence="Closes the open quantity: received lines keep what arrived, open lines are cancelled, and the PO moves to Received for matching. Purchasing Manager only." onConfirm={(r) => report(shortClose(p.id, r), `${p.id} short-closed`)} />
      <DialogShell open={dlg === "override"} onOpenChange={close} requireReason title={`Restricted-vendor override for ${p.id}`} confirmLabel="Record override" consequence={`${vendorName(s, p.vendorId)} is Restricted. The override is recorded on the PO and lets it go for approval (C-32). Purchasing Manager only.`} onConfirm={(r) => report(overrideRestricted(p.id, r), "Override recorded")} />

      <DialogShell
        open={dlg === "provide"}
        onOpenChange={close}
        title={`Issue provided components for ${p.id}`}
        confirmLabel="Issue to vendor"
        consequence="Moves the provided components to stock At Subcontractor and posts the subcontract provision."
        onConfirm={() => report(issueProvided(p.id), "Components issued; #34 posted")}
      >
        <PostingPreview lines={[{ template: 34, amount: Math.round((p.provided ?? []).filter((x) => !x.issued).reduce((t, x) => t + x.qty * (stdOf(s, x.itemId) ?? 0), 0) * 100) / 100, detail: "Provided components at standard" }]} period={TODAY.slice(0, 7)} />
      </DialogShell>

      <DialogShell
        open={dlg === "grn"}
        onOpenChange={(o) => {
          if (!o) {
            setGLine(null)
            setGQty("")
            setGBatch("")
            setGSerials([])
          }
          close(o)
        }}
        wide
        title={`Goods receipt against ${p.id}`}
        confirmLabel="Post goods receipt"
        confirmDisabled={gLine == null}
        consequence={grnLine ? `Posts ${qtyN || 0} ${grnMat?.baseUom ?? ""} of ${grnLine.itemId} to QI Hold, records T02 and emits the receipt to quality and traceability.` : "Scan the PO and the item first."}
        onConfirm={() => {
          if (gLine == null) return "Scan the PO and item first (SP-01)."
          return report(postGrn(p.id, { line: gLine, qty: qtyN, batch: (gBatch || undefined) as `BAT-${string}` | undefined, serials: gSerials as `SN-${string}`[] }), (g) => `${g} posted`)
        }}
      >
        <div className="flex flex-col gap-4">
          <ScanField
            scanPoint="SP-01"
            expected={gLine == null ? `PO barcode ${p.id}, then an item barcode on it` : `Line ${gLine} selected; scan another item to switch`}
            onScan={(code) => {
              if (code === p.id) return { ok: true, message: `${p.id} recognised; scan the item barcode` }
              const l = openLines.find((x) => x.itemId === code && x.received < x.qty)
              if (l) {
                setGLine(l.no)
                setGQty(String(l.qty - l.received))
                return { ok: true, message: `Line ${l.no} ${l.itemId}: open ${l.qty - l.received}` }
              }
              return { ok: false, errorCode: "E-MM-11", expected: `${p.id} or one of ${openLines.map((x) => x.itemId).join(", ")}`, next: "Scan an item on this PO with open quantity, or call the buyer." }
            }}
          />
          {grnLine && (
            <>
              <TextField id="grn-qty" label={`Quantity received (open ${grnLine.qty - grnLine.received})`} value={gQty} onChange={setGQty} hint={<>Over-receipt tolerance 0% <Reading id="OQ-PF-6" /></>} />
              {grnMat?.batchFlag && (
                <ScanField
                  scanPoint="SP-02"
                  expected={gBatch ? `Batch ${gBatch} captured` : "Scan back the printed batch label (BAT-...)"}
                  onScan={(code) => {
                    if (!/^BAT-/.test(code)) return { ok: false, expected: "a batch label starting BAT-", next: "Print the label and scan it back." }
                    setGBatch(code)
                    return { ok: true, message: `Batch ${code} captured` }
                  }}
                />
              )}
              {grnMat?.serialProfileId && (
                <ScanField
                  scanPoint="SP-03"
                  expected={`Serial ${gSerials.length + 1} of ${qtyN}`}
                  onScan={(code) => {
                    if (!/^SN-/.test(code)) return { ok: false, errorCode: "E-TRC-01", expected: "a serial starting SN-", next: "Scan the serial plate." }
                    if (gSerials.includes(code)) return { ok: false, errorCode: "E-TRC-02", expected: "a serial not yet captured", next: "Scan the next unit." }
                    setGSerials([...gSerials, code])
                    return { ok: true, message: `${code} captured (${gSerials.length + 1} of ${qtyN})` }
                  }}
                />
              )}
              <OtherPostingPreview
                period={TODAY.slice(0, 7)}
                rows={[
                  { key: "grn", amount: Math.round(qtyN * grnLine.price * 100) / 100, detail: `${qtyN} × ${fmtMoney(grnLine.price)} PO price` },
                  ...(Math.abs(grnLine.price - std) >= 0.01 ? [{ key: "ppv" as const, amount: Math.round((grnLine.price - std) * qtyN * 100) / 100, detail: `(PO ${grnLine.price} − standard ${std}) × ${qtyN}` }] : []),
                ]}
              />
            </>
          )}
        </div>
      </DialogShell>

      <DialogShell
        open={dlg === "match"}
        onOpenChange={close}
        title={`Three-way match for ${p.id}`}
        confirmLabel="Match and close"
        consequence={`Matches PO, receipts and invoice, posts DR 2110 GR/IR / CR 2100 AP with any invoice price variance to 5210, and moves ${p.id} to Matched/Closed. AP clerk; the PO creator cannot approve the invoice.`}
        onConfirm={() => report(matchInvoice(p.id, inv, Object.fromEntries(Object.entries(invPrices).filter(([, v]) => v).map(([k, v]) => [Number(k), Number(v)]))), `${p.id} matched`)}
      >
        <div className="flex flex-col gap-2">
          <TextField id="inv-no" label="Vendor invoice number" value={inv} onChange={setInv} />
          {p.lines
            .filter((l) => l.status === "Received")
            .map((l) => (
              <TextField key={l.no} id={`inv-${l.no}`} label={`Line ${l.no} invoice unit price (PO ${l.price})`} value={invPrices[l.no] ?? ""} onChange={(v) => setInvPrices({ ...invPrices, [l.no]: v })} placeholder={String(l.price)} />
            ))}
          <OtherPostingPreview rows={[{ key: "match", amount: p.lines.filter((l) => l.status === "Received").reduce((t, l) => t + (Number(invPrices[l.no]) || l.price) * l.received, 0) }]} period={TODAY.slice(0, 7)} />
        </div>
      </DialogShell>

      <DialogShell
        open={dlg === "expedite"}
        onOpenChange={close}
        title={`Expedite ${p.id}`}
        confirmLabel="Record"
        consequence="Logs the vendor contact. A promise updates the confirmed date; a push-out or pull-in moves the schedule and feeds promise revalidation."
        onConfirm={() => report(expedite(p.id, { kind: xKind, line: xLine ? Number(xLine) : undefined, newDate: xDate || undefined, text: xText }), "Expedite recorded")}
      >
        <ExpediteFields kind={xKind} setKind={setXKind} line={xLine} setLine={setXLine} date={xDate} setDate={setXDate} text={xText} setText={setXText} lines={openLines.map((l) => l.no)} />
      </DialogShell>
    </>
  )
}

export function ExpediteFields(p: {
  kind: "Promise" | "Push out" | "Pull in" | "Escalate" | "Call" | "Email"
  setKind: (k: "Promise" | "Push out" | "Pull in" | "Escalate" | "Call" | "Email") => void
  line: string
  setLine: (v: string) => void
  date: string
  setDate: (v: string) => void
  text: string
  setText: (v: string) => void
  lines: number[]
}) {
  const dated = p.kind === "Promise" || p.kind === "Push out" || p.kind === "Pull in"
  return (
    <div className="flex flex-col gap-2">
      <SelectField id="x-kind" label="Action" value={p.kind} onChange={p.setKind} options={(["Promise", "Push out", "Pull in", "Escalate", "Call", "Email"] as const).map((k) => ({ value: k, label: k }))} />
      {dated && <SelectField id="x-line" label="Line" value={p.line} onChange={p.setLine} options={p.lines.map((n) => ({ value: String(n), label: `Line ${n}` }))} />}
      {dated && <TextField id="x-date" type="date" label="New date" value={p.date} onChange={p.setDate} />}
      <TextField id="x-text" label="Note (vendor contact, what was agreed)" value={p.text} onChange={p.setText} />
    </div>
  )
}

