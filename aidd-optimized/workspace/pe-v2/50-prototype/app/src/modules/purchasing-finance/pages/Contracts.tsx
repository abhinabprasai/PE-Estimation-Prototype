// FX-PUR-CONTRACT Contract and scheduling agreement pricing object (/purchasing/contracts, /purchasing/contracts/:id);
// source Book II §7.3 [DOC:p.157]: "Contract / scheduling agreement price when one exists (Phase 2 object; field reserved)".
// A contract fixes price scales per item for a validity period; a scheduling agreement adds dated delivery schedule lines
// that are released against POs. The PO price determination reads it before the info record and stamps Price Source =
// Contract. The record has no status list in the specification (OQ-21): state is text. Route and archetype are design values.
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { CalendarClock, FilePlus2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import type { MaterialId, VendorId } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { allVendors, itemText, vendorName } from "../data/logic"
import { lineSource } from "../data/xlogic"
import { activateContract, addContractScale, closeContract, createContract, releaseAgainstContract } from "../data/xactions"
import type { ContractKind, ContractRec } from "../data/xtypes"
import { CsvButton, Design, DocLink, Reading, report, Section, TextState } from "../components/common"
import { DetailFrame, ItemLink, SelectField, TextField, userName, VendorLink } from "../components/bits"
import { LockedNote, StateGate, useNineStates, writeProps, type NineStates } from "../components/states"

const BUYABLE = MATERIALS.filter((m) => ["RAW", "TRADE", "PACK", "CONS", "SPARE"].includes(m.type) && m.status !== "Obsolete")
const released = (c: ContractRec, itemId: string) => c.releases.filter((r) => r.itemId === itemId && r.state !== "Planned").reduce((t, r) => t + r.qty, 0)

export function ContractList() {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const st = useNineStates("FX-PUR-CONTRACT", { writers: "the Buyer creates, the Purchasing Manager activates", validation: ["Title is required.", "The end date must be after the start date.", "Enter the contract price."] })
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ kind: "Contract" as ContractKind, title: "", vendorId: "" as VendorId | "", from: "", to: "", itemId: "" as MaterialId | "", qty: "", price: "" })
  const cols: Column<ContractRec>[] = [
    { id: "id", header: "Contract", value: (r) => r.id, sortable: true, mono: true },
    { id: "kind", header: "Type", value: (r) => r.kind, filterable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[340px]">{r.title}</span> },
    { id: "vendor", header: "Vendor", value: (r) => vendorName(s, r.vendorId), filterable: true },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, sortable: true, cell: (r) => `${fmtDate(r.validFrom)} to ${fmtDate(r.validTo)}` },
    { id: "items", header: "Items", value: (r) => r.items.length, align: "right", mono: true },
    { id: "state", header: "State", value: (r) => r.state, filterable: true, cell: (r) => <TextState value={r.state} /> },
    { id: "used", header: "Released", value: (r) => r.items.reduce((t, i) => t + released(r, i.itemId), 0), align: "right", cell: (r) => r.items.map((i) => `${fmtNumber(released(r, i.itemId))} of ${fmtNumber(i.targetQty)} ${i.unit}`).join("; ") },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-PUR-CONTRACT",
          title: "Contracts and scheduling agreements",
          description: "Negotiated prices that rank above the info record in purchase price determination.",
          chips: <Design note="A Phase 2 object in the specification (field reserved on the PO price source); route and archetype are design values">Phase 2 object</Design>,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="contracts.csv" rows={s.contracts.map((c) => ({ Contract: c.id, Type: c.kind, Vendor: c.vendorId, From: c.validFrom, To: c.validTo, State: c.state }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg(true)} {...writeProps(st)}>
              <FilePlus2 aria-hidden="true" /> New contract
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : s.contracts,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/purchasing/contracts/${r.id}`,
          searchText: (r) => `${r.id} ${r.title} ${r.vendorId} ${vendorName(s, r.vendorId)}`,
          loading: st.loading,
          densityKey: "FX-PUR-CONTRACT",
          empty: { title: "No contracts yet", body: "A contract is created after an RFQ award or a price review. Until one exists the PO price comes from the info record." },
        }}
        below={
          <RulesPanel
            rules={[
              ["II §7.3", "PO price order: manual, contract or scheduling agreement, info record, last PO; the source is stamped on the line", "[DOC:p.157]"],
              ["II §7.2", "Surcharge linkage prints the index delta as a separate PO condition line", "[DOC:p.157]"],
              ["C-31", "No release to a vendor whose onboarding is not Active", "[DOC:p.101]"],
              ["OQ-21", "No status list for the contract: state shown as text", "[DOC:OQ-21]"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        title="New contract"
        confirmLabel="Create draft"
        consequence="Creates a Draft contract with one item and one price. Add scale rows, then the Purchasing Manager activates it. Nothing is ordered."
        onConfirm={() => {
          if (st.guard()) return st.guard()
          const r = createContract({ kind: f.kind, title: f.title, vendorId: f.vendorId as VendorId, validFrom: f.from, validTo: f.to, itemId: f.itemId as MaterialId, targetQty: Number(f.qty), price: Number(f.price) })
          const err = report(r, (id) => `${id} created`)
          if (r.ok) nav(`/purchasing/contracts/${r.value}`)
          return err
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="ct-kind" label="Type" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: "Contract", label: "Contract" }, { value: "Scheduling agreement", label: "Scheduling agreement (with delivery schedule lines)" }]} />
          <TextField id="ct-title" label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
          <SelectField id="ct-ven" label="Vendor" value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v })} options={allVendors(s).filter((v) => v.onboarding === "Active").map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))} />
          <SelectField id="ct-item" label="Item" value={f.itemId} onChange={(v) => setF({ ...f, itemId: v })} options={BUYABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 36)}` }))} />
          <TextField id="ct-from" type="date" label="Valid from" value={f.from} onChange={(v) => setF({ ...f, from: v })} />
          <TextField id="ct-to" type="date" label="Valid to" value={f.to} onChange={(v) => setF({ ...f, to: v })} />
          <TextField id="ct-qty" type="number" label="Target quantity" value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
          <TextField id="ct-price" type="number" label="Contract price (first scale row)" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: an overlapping contract for the same vendor and item is refused.</p>}
      </DialogShell>
    </>
  )
}

export function ContractDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-CONTRACT-2", { writers: "the Buyer creates, the Purchasing Manager activates and closes" })
  const c = s.contracts.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!c} title={id} screenId="FX-PUR-CONTRACT" back={{ label: "Contracts", to: "/purchasing/contracts" }}>
      {() => <ContractBody c={c!} st={st} />}
    </DetailFrame>
  )
}

function ContractBody({ c, st }: { c: ContractRec; st: NineStates }) {
  const s = useSlice("purchasingFinance")
  const [dlg, setDlg] = useState<null | "activate" | "close" | "scale" | "release">(null)
  const [scale, setScale] = useState({ from: "", price: "" })
  const [rel, setRel] = useState({ itemId: c.items[0]?.itemId ?? "", qty: "", date: "", plannedNo: undefined as number | undefined })
  const terminal = c.state === "Expired" || c.state === "Closed"
  const ro = terminal || st.state === "readonly"
  const usedBy = useMemo(
    () => s.purchaseOrders.flatMap((p) => p.lines.map((l) => ({ p, l, src: lineSource(s, p, l) }))).filter((x) => x.src.kind === "Contract" && x.src.ref === c.id),
    [s, c.id],
  )
  const primary =
    c.state === "Draft" ? (
      <Button onClick={() => setDlg("activate")} {...writeProps(st)}>Activate contract</Button>
    ) : c.state === "Active" ? (
      <Button onClick={() => { setRel({ itemId: c.items[0].itemId, qty: "", date: "", plannedNo: undefined }); setDlg("release") }} {...writeProps(st)}>
        <Plus aria-hidden="true" /> Release against contract
      </Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-PUR-CONTRACT",
          title: `${c.id} · ${c.title}`,
          crumbs: [{ label: "Contracts", to: "/purchasing/contracts" }],
          chips: (
            <>
              {terminal && <Chip kind="design" note="Terminal records open read-only (C-55)">Read-only</Chip>}
              <Design note="Phase 2 object in the specification" />
            </>
          ),
          actions: (
            <>
              {st.menu}
              {c.state === "Draft" && <Button variant="outline" {...writeProps(st)} onClick={() => setDlg("scale")}>Add scale row</Button>}
              {c.state === "Active" && <Button variant="ghost" {...writeProps(st)} onClick={() => setDlg("close")}>Close early</Button>}
            </>
          ),
          primary,
          children: st.banner,
        }}
        summary={
          <>
            <KV k="State"><TextState value={c.state} /></KV>
            <KV k="Type">{c.kind}</KV>
            <KV k="Vendor"><VendorLink id={c.vendorId} name={vendorName(s, c.vendorId)} /></KV>
            <KV k="Validity">{fmtDate(c.validFrom)} to {fmtDate(c.validTo)}</KV>
            <KV k="Currency">{c.currency}</KV>
            <KV k="Created">{fmtDate(c.createdOn)} · {userName(c.createdBy)}</KV>
          </>
        }
        tabs={[
          {
            id: "items",
            label: "Items and price scales",
            count: c.items.length,
            content: (
              <StateGate st={st} cols={5} emptyTitle="No items" emptyBody="Add an item with a price scale.">
                <div className="flex flex-col gap-4">
                  {c.items.map((it) => (
                    <Section key={it.itemId} title={`${it.itemId} ${itemText(it.itemId)}`} action={<span className="text-xs font-normal text-muted-foreground">{fmtNumber(released(c, it.itemId))} of {fmtNumber(it.targetQty)} {it.unit} released</span>}>
                      <Table>
                        <TableHeader className="bg-table-head">
                          <TableRow>
                            <TableHead className="text-right">From quantity ({it.unit})</TableHead>
                            <TableHead className="text-right">Unit price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {it.scales.map((x) => (
                            <TableRow key={x.fromQty} className="h-8 text-[13px]">
                              <TableCell className="tabular text-right">{fmtNumber(x.fromQty)}</TableCell>
                              <TableCell className="tabular text-right">{fmtMoney(x.price, c.currency)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-xs text-muted-foreground">The deepest satisfied break applies at PO pricing (Book II §7.2). {it.surchargeIndex ? `Surcharge linkage: ${it.surchargeIndex}; the index delta prints as a separate PO condition line.` : "No surcharge linkage."}</p>
                    </Section>
                  ))}
                </div>
              </StateGate>
            ),
          },
          {
            id: "releases",
            label: c.kind === "Scheduling agreement" ? "Delivery schedule lines" : "Releases",
            count: c.releases.length,
            content: c.releases.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Delivery date</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>PO line</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.releases.map((r) => (
                    <TableRow key={r.no} className="h-8 text-[13px]">
                      <TableCell className="tabular">{r.no}</TableCell>
                      <TableCell><ItemLink id={r.itemId} short /></TableCell>
                      <TableCell className="tabular text-right">{fmtNumber(r.qty)}</TableCell>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell>{r.poId ? <><DocLink r={{ type: "purchaseOrder", id: r.poId }} /> line {r.poLine}</> : <span className="text-muted-foreground">Not released</span>}</TableCell>
                      <TableCell>
                        {r.state === "Planned" && c.state === "Active" && (
                          <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => { setRel({ itemId: r.itemId, qty: String(r.qty), date: r.date, plannedNo: r.no }); setDlg("release") }}>
                            <CalendarClock aria-hidden="true" /> Release
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Nothing released yet">{c.kind === "Scheduling agreement" ? "Planned delivery schedule lines appear here; releasing one creates a Draft PO line at the scale price." : "Each release creates a Draft PO at the contract price."}</EmptyState>
            ),
          },
          {
            id: "used",
            label: "POs priced by this contract",
            count: usedBy.length,
            content: usedBy.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Price source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usedBy.map(({ p, l, src }) => (
                    <TableRow key={p.id + l.no} className="h-8 text-[13px]">
                      <TableCell><DocLink r={{ type: "purchaseOrder", id: p.id }} /></TableCell>
                      <TableCell>{l.no}</TableCell>
                      <TableCell className="tabular text-right">{fmtNumber(l.qty)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(l.price, p.currency)}</TableCell>
                      <TableCell>{src.kind} <span className="text-xs text-muted-foreground">{src.text}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No PO line is priced by this contract">A PO line takes the contract price when the vendor, item and PO date fall inside an Active contract and the price equals the scale price.</EmptyState>
            ),
          },
          {
            id: "history",
            label: "History",
            count: c.history.length,
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {[...c.history].reverse().map((h, i) => (
                  <li key={i}><span className="tabular text-muted-foreground">{fmtDate(h.on)}</span> · {userName(h.by)} · {h.text}</li>
                ))}
              </ul>
            ),
          },
        ]}
        aside={
          <>
            {ro && <LockedNote>{terminal ? `A ${c.state} contract is read-only.` : "Read-only view."}</LockedNote>}
            <p className="text-xs text-muted-foreground">Activation by the Purchasing Manager is a reading <Reading id="OQ-PF-26" />. The PO price source order is Book II §7.3.</p>
          </>
        }
      />
      <DialogShell open={dlg === "activate"} onOpenChange={(o) => !o && setDlg(null)} title={`Activate ${c.id}`} confirmLabel="Activate" consequence={`${c.id} becomes the price source Contract for ${vendorName(s, c.vendorId)} from ${fmtDate(c.validFrom)} to ${fmtDate(c.validTo)}. Its prices are then fixed. Purchasing Manager only.`} onConfirm={() => st.guard() ?? report(activateContract(c.id), `${c.id} active`)} />
      <DialogShell open={dlg === "close"} onOpenChange={(o) => !o && setDlg(null)} requireReason destructive title={`Close ${c.id} early`} confirmLabel="Close contract" consequence="Ends the contract today. POs already released keep their price; new POs fall back to the info record. This ends the record." onConfirm={(r) => st.guard() ?? report(closeContract(c.id, r), `${c.id} closed`)} />
      <DialogShell open={dlg === "scale"} onOpenChange={(o) => !o && setDlg(null)} title={`Add a scale row to ${c.id}`} confirmLabel="Add row" consequence="Adds a quantity break; the deepest satisfied break applies at PO pricing." onConfirm={() => st.guard() ?? report(addContractScale(c.id, c.items[0].itemId, Number(scale.from), Number(scale.price)), "Scale row added")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="sc-from" type="number" label="From quantity" value={scale.from} onChange={(v) => setScale({ ...scale, from: v })} />
          <TextField id="sc-price" type="number" label="Unit price" value={scale.price} onChange={(v) => setScale({ ...scale, price: v })} />
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "release"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Release against ${c.id}`}
        confirmLabel="Create Draft PO"
        consequence="Creates a Draft PO for this vendor with the line priced from the contract scale (price source Contract). It goes for approval on the PO ladder like any PO."
        onConfirm={() => st.guard() ?? report(releaseAgainstContract(c.id, { itemId: rel.itemId as MaterialId, qty: Number(rel.qty), date: rel.date, plannedNo: rel.plannedNo }), (po) => `${po} created`)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="rl-item" label="Item" value={rel.itemId} onChange={(v) => setRel({ ...rel, itemId: v })} options={c.items.map((i) => ({ value: i.itemId, label: `${i.itemId} ${itemText(i.itemId).slice(0, 30)}` }))} />
          <TextField id="rl-qty" type="number" label="Quantity" value={rel.qty} onChange={(v) => setRel({ ...rel, qty: v })} />
          <TextField id="rl-date" type="date" label="Delivery date" value={rel.date} onChange={(v) => setRel({ ...rel, date: v })} />
        </div>
      </DialogShell>
    </>
  )
}
