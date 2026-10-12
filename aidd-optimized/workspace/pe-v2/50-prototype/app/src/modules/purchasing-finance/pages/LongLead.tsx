// LLR-001 Long Lead Releases [DOC:p.268] (asserted); rules Book IV §3.2 (LLR), §3.3 (STP).
// Item list with caps, risk class, exposure tracker bar, linked POs, ECO impact panel. Primary
// actions: approve with exposure acceptance (WF-INBOX), close on final release or full disposition.
// The LLR has no status list (OQ-21): its state shows as text. The STP detail shares the route
// because the document flow sends STP links here.
import { useMemo, useState } from "react"
import { useParams } from "react-router"
import { FilePlus2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, Chip, DocumentFlowPanel, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { closeLlr, decideEcoImpact, newStpVersion } from "../data/actions"
import { llrRunningExposure, poTotal, vendorName } from "../data/logic"
import type { LlrRec, StpRec } from "../data/types"
import { CapBar, CsvButton, DocLink, Reading, report, Section, TextState, useDemoState } from "../components/common"
import { DetailFrame, ItemLink, RecLink, SelectField, TextField } from "../components/bits"

type Row = LlrRec & { running: number }

export function LlrList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("LLR-001")
  const rows = useMemo<Row[]>(() => s.llrs.map((l) => ({ ...l, running: llrRunningExposure(s, l) })), [s])
  const cols: Column<Row>[] = [
    { id: "id", header: "Release", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[320px]">{r.title}</span> },
    { id: "so", header: "Sales order", value: (r) => r.soId, cell: (r) => <DocLink r={{ type: "salesOrder", id: r.soId }} /> },
    { id: "risk", header: "Risk class", value: (r) => r.riskClass, filterable: true },
    { id: "cap", header: "Value cap", value: (r) => r.valueCap.amount, align: "right", mono: true, sortable: true, cell: (r) => fmtMoney(r.valueCap.amount) },
    { id: "exp", header: "Running exposure", value: (r) => r.running, align: "right", mono: true, sortable: true, cell: (r) => <span className={r.running > r.valueCap.amount ? "text-status-cancelled-ink" : undefined}>{fmtMoney(r.running)}</span> },
    { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => r.state },
  ]
  return (
    <ListPage
      header={{
        screenId: "LLR-001",
        title: "Long-lead releases",
        description: "Authority for early POs on ETO orders before engineering releases the design. Exposure feeds ETO committed cost.",
        chips: <Chip kind="oq" id="OQ-21" note="No status list in the specification for the long-lead release; state shown as text" />,
        actions: (
          <>
            {st.menu}
            <CsvButton filename="long-lead-releases.csv" rows={rows.map((r) => ({ LLR: r.id, SO: r.soId, Cap: r.valueCap.amount, Exposure: r.running, State: r.state }))} />
          </>
        ),
      }}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/purchasing/long-lead/${r.id}`,
        searchText: (r) => `${r.id} ${r.title} ${r.soId}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "LLR-001",
        empty: { title: "No long-lead releases", body: "FL-10 stage 5 decisions on ETO orders create releases here." },
      }}
      below={<StpTable />}
    />
  )
}

function StpTable() {
  const s = useSlice("purchasingFinance")
  return (
    <Section title="Supplier technical packages">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>STP</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Acknowledgements</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.stps.map((t) => (
            <TableRow key={t.id} className="h-8 text-[13px]">
              <TableCell>
                <RecLink to={`/purchasing/long-lead/${t.id}`}>{t.id}</RecLink>
              </TableCell>
              <TableCell>{t.title}</TableCell>
              <TableCell>
                v{t.version} {t.superseded && <Chip kind="block">Superseded by {t.supersededBy}</Chip>}
              </TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {t.acknowledgements.length ? t.acknowledgements.map((a) => <StatusBadge key={a.vendorId} kind="stpAck" status={a.status} size="sm" />) : <span className="text-muted-foreground">None yet</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

export function LlrDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("LLR-002")
  if (id.startsWith("STP-")) {
    const t = s.stps.find((x) => x.id === id)
    return (
      <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!t} title={id} screenId="LLR-001" back={{ label: "Long-lead releases", to: "/purchasing/long-lead" }}>
        {() => <StpBody t={t!} />}
      </DetailFrame>
    )
  }
  const l = s.llrs.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!l} title={id} screenId="LLR-001" back={{ label: "Long-lead releases", to: "/purchasing/long-lead" }}>
      {() => <LlrBody l={l!} menu={st.menu} />}
    </DetailFrame>
  )
}

function LlrBody({ l, menu }: { l: LlrRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const [closeOpen, setCloseOpen] = useState(false)
  const [impact, setImpact] = useState<{ ecoId: string; poId: string } | null>(null)
  const [decision, setDecision] = useState<"Proceed" | "Change order to vendor" | "Stop with exposure booking" | "">("")
  const [booked, setBooked] = useState("")
  const running = llrRunningExposure(s, l)
  const pos = s.purchaseOrders.filter((p) => p.llrId === l.id)
  const readOnly = l.state === "Closed"
  const primary =
    l.state === "Draft" || l.state === "Awaiting approval" ? (
      <ApprovalButton kind="Long-lead release" subject={{ type: "llr", id: l.id }} title={`${l.id} ${l.title}`} amount={running} ctx={{ riskClass: l.riskClass }} variant="default" label="Send for approval with exposure" stay />
    ) : l.state === "Approved" ? (
      <Button onClick={() => setCloseOpen(true)}>
        <Lock aria-hidden="true" /> Close release
      </Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "LLR-001",
          title: `${l.id} · ${l.title}`,
          crumbs: [{ label: "Long-lead releases", to: "/purchasing/long-lead" }],
          chips: (
            <>
              <TextState value={l.state} />
              <Reading id="OQ-PF-15" />
              {readOnly && <Chip kind="design" note="Closed release: read-only">Read-only</Chip>}
            </>
          ),
          actions: menu,
          primary,
        }}
        doc={{ type: "llr", id: l.id }}
        summary={
          <>
            <KV k="Sales order">
              <DocLink r={{ type: "salesOrder", id: l.soId }} />
            </KV>
            <KV k="Engineering request">
              <DocLink r={{ type: "engineeringRequest", id: l.engineeringRequestId }} />
            </KV>
            <KV k="Risk class">{l.riskClass}</KV>
            <KV k="Revision basis">{l.revisionBasis}</KV>
            <KV k="Cancellation fees">{fmtMoney(l.cancellationFees)}</KV>
            <KV k="Accepted exposure">{l.acceptedCancellation != null ? fmtMoney(l.acceptedCancellation) : "Not yet accepted"}</KV>
            <KV k="Approvals">{l.approvals.length ? l.approvals.map((a) => `${a.role} ${fmtDate(a.on)}`).join("; ") : "None yet"}</KV>
            {l.closedOn && <KV k="Closed">{fmtDate(l.closedOn)}: {l.closeNote}</KV>}
          </>
        }
        tabs={[
          {
            id: "exposure",
            label: "Items and exposure",
            content: (
              <div className="flex flex-col gap-4">
                <CapBar value={running} cap={l.valueCap.amount} label="Running exposure (open LLR PO value + cancellation fees) against the value cap" />
                {running > l.valueCap.amount && <p className="text-sm">E-DTS-02: a further PO under this release is blocked until the cap is raised by a new approval.</p>}
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity cap (release total)</TableHead>
                      <TableHead className="text-right">Value cap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {l.itemIds.map((i) => (
                      <TableRow key={i} className="h-10 text-[13px]">
                        <TableCell>
                          <ItemLink id={i} />
                        </TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(l.qtyCap)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(l.valueCap.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ),
          },
          {
            id: "pos",
            label: "Linked POs",
            count: pos.length,
            content: pos.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.map((p) => (
                    <TableRow key={p.id} className="h-8 text-[13px]">
                      <TableCell>
                        <DocLink r={{ type: "purchaseOrder", id: p.id }} />
                      </TableCell>
                      <TableCell>{vendorName(s, p.vendorId)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(poTotal(p), p.currency)}</TableCell>
                      <TableCell>
                        <StatusBadge kind="purchaseOrder" status={p.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Chip kind="flag">Long-Lead: Preliminary Revision</Chip> {p.changePending && <Chip kind="change">Change Pending</Chip>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No POs under this release yet">POs placed under the release carry the Long-Lead: Preliminary Revision flag.</EmptyState>
            ),
          },
          {
            id: "eco",
            label: "ECO impact",
            count: l.ecoImpacts.length,
            content: l.ecoImpacts.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>ECO</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead className="text-right">Exposure booked</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {l.ecoImpacts.map((x) => (
                    <TableRow key={x.ecoId + x.poId} className="h-10 text-[13px]">
                      <TableCell>
                        <DocLink r={{ type: "eco", id: x.ecoId }} />
                      </TableCell>
                      <TableCell>
                        <DocLink r={{ type: "purchaseOrder", id: x.poId }} />
                      </TableCell>
                      <TableCell>{x.decision ? `${x.decision} (${fmtDate(x.on)})` : <Chip kind="change">Decision needed</Chip>}</TableCell>
                      <TableCell className="tabular text-right">{x.exposureBooked ? fmtMoney(x.exposureBooked) : ""}</TableCell>
                      <TableCell>
                        {!x.decision && !readOnly && (
                          <Button size="sm" variant="outline" onClick={() => setImpact({ ecoId: x.ecoId, poId: x.poId })}>
                            Decide
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No engineering change affects this release">When an ECO changes an item on a PO under this release, the impact lands here for a commercial decision.</EmptyState>
            ),
          },
          {
            id: "stp",
            label: "Technical packages",
            count: l.stpIds.length,
            content: l.stpIds.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {l.stpIds.map((t) => (
                  <li key={t}>
                    <RecLink to={`/purchasing/long-lead/${t}`}>{t}</RecLink> {s.stps.find((x) => x.id === t)?.title}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No STP attached" />
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["IV §3.2", "Running exposure = open LLR PO value + cancellation fees; cap breach blocks further POs (E-DTS-02)", "[DOC:p.209 §3.2]"],
              ["IV §3.2", "Approval records the accepted cancellation exposure; Controller above threshold", "[DOC:p.209 §3.2]"],
              ["IV §3.2", "Close on final release (no-change path) or full disposition of every PO impact", "[DOC:p.209 §3.2]"],
              ["OQ-PF-3", "A PO under the release is sent only after it is approved", "reading"],
            ]}
          />
        }
      />
      <DialogShell
        open={closeOpen}
        onOpenChange={setCloseOpen}
        requireReason
        reasonLabel="Closing note (final release or disposition summary)"
        title={`Close ${l.id}`}
        confirmLabel="Close release"
        consequence={`Ends ${l.id}: no further POs can be placed under it. Running exposure ${fmtMoney(running)} drops out of ETO committed cost.`}
        onConfirm={(r) => report(closeLlr(l.id, r), `${l.id} closed`)}
      />
      <DialogShell
        open={!!impact}
        onOpenChange={(o) => !o && setImpact(null)}
        title={`Commercial decision: ${impact?.ecoId} on ${impact?.poId}`}
        confirmLabel="Record decision"
        consequence="Records the decision on the release and the PO. Proceed clears Change Pending; a change order goes through PO revision; stop books the exposure."
        onConfirm={() => (impact && decision ? report(decideEcoImpact(l.id, impact.ecoId, impact.poId, decision, Number(booked) || 0), "Decision recorded") : "Choose a decision.")}
      >
        <SelectField id="eco-dec" label="Decision" value={decision} onChange={setDecision} options={(["Proceed", "Change order to vendor", "Stop with exposure booking"] as const).map((x) => ({ value: x, label: x }))} />
        {decision === "Stop with exposure booking" && <TextField id="eco-book" label="Exposure booked" value={booked} onChange={setBooked} />}
      </DialogShell>
    </>
  )
}

function StpBody({ t }: { t: StpRec }) {
  const s = useSlice("purchasingFinance")
  const [open, setOpen] = useState(false)
  const [change, setChange] = useState("")
  const users = s.purchaseOrders.filter((p) => p.lines.some((l) => l.stpId === t.id))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="LLR-001"
        title={`${t.id} · ${t.title}`}
        crumbs={[{ label: "Long-lead releases", to: "/purchasing/long-lead" }, { label: "Supplier technical package" }]}
        chips={
          <>
            <span className="text-sm font-medium">Version {t.version}</span>
            {t.superseded && <Chip kind="block">Superseded by {t.supersededBy}</Chip>}
          </>
        }
        primary={
          !t.superseded ? (
            <Button onClick={() => setOpen(true)}>
              <FilePlus2 aria-hidden="true" /> New version
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KV k="Item">
              <ItemLink id={t.itemId} />
            </KV>
            <KV k="Created">{fmtDate(t.createdOn)}</KV>
            <KV k="Long-lead release">{t.llrId ? <RecLink to={`/purchasing/long-lead/${t.llrId}`}>{t.llrId}</RecLink> : "None"}</KV>
            <KV k="Quality clauses">{t.clauses.join(", ")}</KV>
          </dl>
          <Section title="Package contents">
            <p className="text-sm">Drawings: {t.drawingRevisions.join("; ")}</p>
            <p className="text-sm">Specifications: {t.specs.join("; ")}</p>
            <p className="break-all font-mono text-xs">Manifest {t.checksum}</p>
          </Section>
          <Section title="Vendor acknowledgements (S-19)">
            {t.acknowledgements.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {t.acknowledgements.map((a) => (
                  <li key={a.vendorId} className="flex items-center gap-2">
                    {vendorName(s, a.vendorId)} <StatusBadge kind="stpAck" status={a.status} size="sm" /> {fmtDate(a.on)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">No vendor has acknowledged this package. Receipt against it is blocked (E-DTS-04).</p>
            )}
          </Section>
          <Section title="Used on purchase orders">
            {users.length ? users.map((p) => <DocLink key={p.id} r={{ type: "purchaseOrder", id: p.id }} />) : <p className="text-sm text-muted-foreground">None</p>}
          </Section>
        </div>
        <DocumentFlowPanel doc={{ type: "stp", id: t.id }} />
      </div>
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={`New version of ${t.id}`}
        confirmLabel="Create version"
        consequence={`Creates version ${t.version + 1} with a new manifest checksum and supersedes ${t.id} (C-22). Open POs on it move to the new version and need the vendor's acknowledgement again before receipt.`}
        onConfirm={() => report(newStpVersion(t.id, change), (n) => `${n} created`)}
      >
        <TextField id="stp-change" label="What changed" value={change} onChange={setChange} />
      </DialogShell>
    </div>
  )
}
