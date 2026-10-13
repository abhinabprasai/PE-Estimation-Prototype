// FX-PUR-SUPDEV Supplier deviation request record (/purchasing/supplier-deviations, /:id); source Book IV E-DTS-04 [DOC:p.209]
// and Book IX supplier portal [DOC Book IX]: a vendor-proposed alternate or concession against a PO line and an STP
// characteristic creates a Supplier Deviation record routed to Engineering and Quality (workflow W.4 addition). Both must
// accept; one rejection closes it. The record has no status list in the specification (OQ-21): its state is derived text.
// Route and archetype are design values.
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { FilePlus2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { allVendors, vendorName } from "../data/logic"
import { decideDeviation, deviationState, submitDeviation, withdrawDeviation } from "../data/xactions"
import type { DeviationDecision, DeviationKind, SupDevRec } from "../data/xtypes"
import { CsvButton, Design, DocLink, Reading, report, Section, TextState } from "../components/common"
import { DetailFrame, RecLink, SelectField, TextField, userName, VendorLink } from "../components/bits"
import { LockedNote, StateGate, useNineStates, writeProps, type NineStates } from "../components/states"

const stateOf = (d: SupDevRec) => deviationState(d)
const Decision = ({ d }: { d: DeviationDecision }) => (
  <span className={d.state === "Rejected" ? "font-medium text-status-cancelled-ink" : d.state === "Accepted" ? "font-medium text-status-passed-ink" : "text-muted-foreground"}>
    {d.state}
    {d.on ? ` · ${fmtDate(d.on)}` : ""}
  </span>
)

export function DeviationList() {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const st = useNineStates("FX-PUR-SUPDEV", { writers: "the Buyer records it; Engineering and Quality decide", validation: ["Name the STP characteristic.", "State both the specified and the proposed value.", "Link the deviation to a PO line or an RFQ."] })
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ vendorId: "", poId: "", poLine: "10", stpId: "", characteristic: "", kind: "Alternate" as DeviationKind, original: "", proposed: "", reason: "", price: "", lead: "" })
  const cols: Column<SupDevRec>[] = [
    { id: "id", header: "Deviation", value: (r) => r.id, sortable: true, mono: true },
    { id: "vendor", header: "Vendor", value: (r) => vendorName(s, r.vendorId), filterable: true },
    { id: "kind", header: "Type", value: (r) => r.kind, filterable: true },
    { id: "ch", header: "Characteristic", value: (r) => r.characteristic, cell: (r) => <span className="line-clamp-2 max-w-[220px]">{r.characteristic}</span> },
    { id: "on", header: "Against", value: (r) => r.poId ?? r.rfqId ?? "", cell: (r) => (r.poId ? `${r.poId}${r.poLine ? ` line ${r.poLine}` : ""}` : r.rfqId) },
    { id: "eng", header: "Engineering", value: (r) => r.engineering.state, filterable: true, cell: (r) => <Decision d={r.engineering} /> },
    { id: "qual", header: "Quality", value: (r) => r.quality.state, filterable: true, cell: (r) => <Decision d={r.quality} /> },
    { id: "state", header: "State", value: stateOf, filterable: true, cell: (r) => <TextState value={stateOf(r)} /> },
    { id: "sub", header: "Submitted", value: (r) => r.submittedOn, sortable: true, cell: (r) => fmtDate(r.submittedOn) },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-PUR-SUPDEV",
          title: "Supplier deviation requests",
          description: "A vendor's proposed alternate, concession or deviation against a PO line and an STP characteristic.",
          chips: <Design note="Route and archetype are design values; routing to Engineering and Quality is Book IV E-DTS-04" />,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="supplier-deviations.csv" rows={s.supplierDeviations.map((d) => ({ Deviation: d.id, Vendor: d.vendorId, Type: d.kind, Characteristic: d.characteristic, State: stateOf(d) }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg(true)} {...writeProps(st)}>
              <FilePlus2 aria-hidden="true" /> Record a deviation
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : s.supplierDeviations,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/purchasing/supplier-deviations/${r.id}`,
          searchText: (r) => `${r.id} ${r.vendorId} ${r.characteristic} ${r.poId ?? ""}`,
          loading: st.loading,
          densityKey: "FX-PUR-SUPDEV",
          empty: { title: "No supplier deviations", body: "A vendor raises one from the supplier portal, or the Buyer records it on the vendor's behalf." },
        }}
        below={
          <RulesPanel
            rules={[
              ["E-DTS-04", "A vendor-proposed alternate or deviation creates a Supplier Deviation record routed to Engineering and Quality", "[DOC:p.131]"],
              ["W.4", "Engineering and Quality each decide; both must accept", "[DOC:W.4 addition]"],
              ["C-23", "Receipt stays blocked while the vendor's STP acknowledgement is an Exception", "[DOC:p.209]"],
              ["OQ-21", "No status list: the state shows as text", "[DOC:OQ-21]"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        wide
        title="Record a supplier deviation"
        confirmLabel="Submit to Engineering and Quality"
        consequence="Creates the record and routes it to Engineering and Quality. Nothing changes on the PO line until both accept."
        onConfirm={() => {
          if (st.guard()) return st.guard()
          const r = submitDeviation({ vendorId: f.vendorId as never, poId: f.poId || undefined, poLine: f.poId ? Number(f.poLine) : undefined, stpId: f.stpId || undefined, characteristic: f.characteristic, kind: f.kind, original: f.original, proposed: f.proposed, reason: f.reason, priceDelta: f.price ? Number(f.price) : undefined, leadDaysDelta: f.lead ? Number(f.lead) : undefined })
          const err = report(r, (id) => `${id} submitted`)
          if (r.ok) nav(`/purchasing/supplier-deviations/${r.value}`)
          return err
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="sd-v" label="Vendor" value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v })} options={allVendors(s).filter((v) => v.onboarding === "Active").map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))} />
          <SelectField id="sd-k" label="Type" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={(["Alternate", "Concession", "Deviation"] as const).map((x) => ({ value: x, label: x }))} />
          <SelectField id="sd-po" label="PO" value={f.poId} onChange={(v) => setF({ ...f, poId: v })} options={s.purchaseOrders.filter((p) => !f.vendorId || p.vendorId === f.vendorId).filter((p) => !["Cancelled", "Matched/Closed"].includes(p.status)).map((p) => ({ value: p.id, label: `${p.id} ${p.title.slice(0, 40)}` }))} />
          <TextField id="sd-line" type="number" label="PO line" value={f.poLine} onChange={(v) => setF({ ...f, poLine: v })} />
          <SelectField id="sd-stp" label="STP" value={f.stpId} onChange={(v) => setF({ ...f, stpId: v })} options={s.stps.filter((t) => !t.superseded).map((t) => ({ value: t.id, label: `${t.id} v${t.version}` }))} />
          <TextField id="sd-ch" label="STP characteristic" value={f.characteristic} onChange={(v) => setF({ ...f, characteristic: v })} />
          <TextField id="sd-o" label="Specified" value={f.original} onChange={(v) => setF({ ...f, original: v })} />
          <TextField id="sd-p" label="Proposed" value={f.proposed} onChange={(v) => setF({ ...f, proposed: v })} />
          <TextField id="sd-pr" type="number" label="Price change per unit (optional)" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
          <TextField id="sd-l" type="number" label="Lead time change, days (optional)" value={f.lead} onChange={(v) => setF({ ...f, lead: v })} />
          <div className="sm:col-span-2">
            <TextField id="sd-r" label="Vendor's reason" value={f.reason} onChange={(v) => setF({ ...f, reason: v })} />
          </div>
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a missing specified or proposed value, or a PO line that is not on the PO, is refused.</p>}
      </DialogShell>
    </>
  )
}

export function DeviationDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-SUPDEV-2", { writers: "Engineering and Quality decide their own side" })
  const d = s.supplierDeviations.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!d} title={id} screenId="FX-PUR-SUPDEV" back={{ label: "Supplier deviations", to: "/purchasing/supplier-deviations" }}>
      {() => <DeviationBody d={d!} st={st} />}
    </DetailFrame>
  )
}

function DeviationBody({ d, st }: { d: SupDevRec; st: NineStates }) {
  const s = useSlice("purchasingFinance")
  const [role] = useRole()
  const [dlg, setDlg] = useState<null | { side: "engineering" | "quality"; outcome: "Accepted" | "Rejected" } | "withdraw">(null)
  const [note, setNote] = useState("")
  const state = stateOf(d)
  const closed = state === "Accepted" || state === "Rejected" || state === "Withdrawn"
  const ENG = ["Engineer", "Engineering Manager", "Manufacturing engineer"]
  const QUAL = ["Quality engineer", "Quality Manager"]
  const side = (k: "engineering" | "quality", label: string, roles: string[]) => {
    const dec = d[k]
    const mine = roles.includes(role)
    return (
      <Section title={label} key={k}>
        <p className="text-sm"><Decision d={dec} /> {dec.by ? `· ${userName(dec.by)}` : ""}</p>
        {dec.note && <p className="text-sm text-muted-foreground">{dec.note}</p>}
        {dec.state === "Pending" && !closed && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!mine || !!st.blockReason} title={!mine ? `${label} decides: switch Acting as to ${roles[0]}` : st.blockReason ?? undefined} onClick={() => { setNote(""); setDlg({ side: k, outcome: "Accepted" }) }}>Accept</Button>
            <Button size="sm" variant="outline" disabled={!mine || !!st.blockReason} title={!mine ? `${label} decides: switch Acting as to ${roles[0]}` : st.blockReason ?? undefined} onClick={() => { setNote(""); setDlg({ side: k, outcome: "Rejected" }) }}>Reject</Button>
          </div>
        )}
      </Section>
    )
  }
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-PUR-SUPDEV",
          title: `${d.id} · ${d.characteristic}`,
          crumbs: [{ label: "Supplier deviations", to: "/purchasing/supplier-deviations" }],
          chips: closed ? <Chip kind="design" note="A closed record opens read-only (C-55)">Read-only</Chip> : undefined,
          actions: (
            <>
              {st.menu}
              {!closed && <Button variant="ghost" {...writeProps(st)} onClick={() => setDlg("withdraw")}>Withdraw</Button>}
            </>
          ),
          children: st.banner,
        }}
        summary={
          <>
            <KV k="State"><TextState value={state} /></KV>
            <KV k="Type">{d.kind}</KV>
            <KV k="Vendor"><VendorLink id={d.vendorId} name={vendorName(s, d.vendorId)} /></KV>
            <KV k="Submitted">{fmtDate(d.submittedOn)} · {d.submittedBy === "Vendor portal" ? "Vendor portal" : `recorded by ${userName(d.submittedBy)}`}</KV>
            <KV k="Against">{d.poId ? <span className="flex gap-2"><DocLink r={{ type: "purchaseOrder", id: d.poId }} />{d.poLine ? `line ${d.poLine}` : ""}</span> : d.rfqId ? <DocLink r={{ type: "rfq", id: d.rfqId }} /> : "None"}</KV>
            <KV k="STP">{d.stpId ? <RecLink to={`/purchasing/stp/${d.stpId}`}>{d.stpId}</RecLink> : "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "request",
            label: "Request and routing",
            content: (
              <StateGate st={st} cols={3} emptyTitle="Nothing to show">
                <div className="flex flex-col gap-4">
                  <Section title="Specified against proposed">
                    <Table>
                      <TableHeader className="bg-table-head">
                        <TableRow>
                          <TableHead>Characteristic</TableHead>
                          <TableHead>Specified (STP)</TableHead>
                          <TableHead>Proposed by the vendor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="text-[13px]">
                          <TableCell>{d.characteristic}</TableCell>
                          <TableCell>{d.original}</TableCell>
                          <TableCell className="font-medium">{d.proposed}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p className="text-sm">Vendor's reason: {d.reason}</p>
                    <p className="text-sm text-muted-foreground">
                      Commercial effect: {d.priceDelta != null ? `${d.priceDelta > 0 ? "+" : ""}${fmtMoney(d.priceDelta)} per unit` : "no price change stated"}; {d.leadDaysDelta != null && d.leadDaysDelta !== 0 ? `${d.leadDaysDelta > 0 ? "+" : ""}${d.leadDaysDelta} days lead time` : "no lead time change stated"}.
                    </p>
                    {d.attachments.length > 0 && <p className="text-sm">Attachments: {d.attachments.join(", ")}</p>}
                  </Section>
                  <div className="grid gap-4 md:grid-cols-2">
                    {side("engineering", "Engineering decision", ENG)}
                    {side("quality", "Quality decision", QUAL)}
                  </div>
                  <p className="text-xs text-muted-foreground">Both sides must accept; one rejection closes the request. When both accept, the vendor's Exception on the STP is recorded as Acknowledged <Reading id="OQ-PF-27" />.</p>
                </div>
              </StateGate>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            count: d.activity.length,
            content: d.activity.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {[...d.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}
              </ul>
            ) : (
              <EmptyState title="No activity" />
            ),
          },
        ]}
        aside={closed ? <LockedNote>{state} records are read-only.</LockedNote> : undefined}
      />
      <DialogShell
        open={!!dlg && dlg !== "withdraw"}
        onOpenChange={(o) => !o && setDlg(null)}
        requireReason={!!dlg && dlg !== "withdraw" && dlg.outcome === "Rejected"}
        destructive={!!dlg && dlg !== "withdraw" && dlg.outcome === "Rejected"}
        title={dlg && dlg !== "withdraw" ? `${dlg.outcome === "Accepted" ? "Accept" : "Reject"} for ${dlg.side === "engineering" ? "Engineering" : "Quality"}` : ""}
        confirmLabel="Record decision"
        consequence={dlg && dlg !== "withdraw" && dlg.outcome === "Rejected" ? "A rejection closes the request and tells the vendor why." : "Records your side's acceptance. The request is accepted when both sides have accepted."}
        onConfirm={(r) => (!dlg || dlg === "withdraw" ? null : st.guard() ?? report(decideDeviation(d.id, dlg.side, dlg.outcome, r || note), `${d.id} ${dlg.outcome.toLowerCase()} by ${dlg.side}`))}
      >
        {dlg && dlg !== "withdraw" && dlg.outcome === "Accepted" && <TextField id="dv-note" label="Note (optional)" value={note} onChange={setNote} />}
      </DialogShell>
      <DialogShell open={dlg === "withdraw"} onOpenChange={(o) => !o && setDlg(null)} title={`Withdraw ${d.id}`} confirmLabel="Withdraw" destructive consequence="Ends the request without a decision. A request already decided cannot be withdrawn." onConfirm={() => st.guard() ?? report(withdrawDeviation(d.id), `${d.id} withdrawn`)} />
    </>
  )
}
