// FX-PUR-SUBCON Subcontract PO variant (/purchasing/subcontract-orders, /:id); source Book I G §6 [DOC:p.106] and
// Book I D §10 [DOC:p.93]: PO type Subcontract, the line is a service item (the operation) with a components-provided list;
// the issue to the vendor prints a provision shipping document and posts #34 (DR 1315 Subcontract Material at Vendor,
// CR 1310); stock shows "At Subcontractor {vendor}"; the receipt posts #35 (service at PO price plus provided material
// returning to order WIP) with the variance to standard subcontract cost on 5260 (SPV). Route and archetype are design values.
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Factory, Printer, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, PostingPreview, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { MaterialId, VendorId } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { issueProvided, postGrn } from "../data/actions"
import { allVendors, itemText, poTotal, providedValue, stdOf, subcontractStd, vendorName } from "../data/logic"
import { createSubcontractPo } from "../data/xactions"
import type { PoRec } from "../data/types"
import { CsvButton, Design, DocLink, Reading, report, Section, VarAmount } from "../components/common"
import { DetailFrame, ItemLink, RecLink, SelectField, TextField, VendorLink } from "../components/bits"
import { LockedNote, StateGate, useNineStates, writeProps, type NineStates } from "../components/states"

const SERVICES = MATERIALS.filter((m) => m.type === "SERV")
const PROVIDABLE = MATERIALS.filter((m) => ["RAW", "SEMI", "CONS"].includes(m.type))

/** At Subcontractor: provided quantity issued to the vendor and not yet consumed by receipts. */
function atVendor(p: PoRec) {
  const l = p.lines[0]
  const share = l && l.qty ? Math.min(1, l.received / l.qty) : 0
  return (p.provided ?? []).map((x) => ({ ...x, atVendor: x.issued ? Math.round(x.qty * (1 - share)) : 0, consumed: x.issued ? Math.round(x.qty * share) : 0 }))
}
function spv(s: ReturnType<typeof useSlice<"purchasingFinance">>, p: PoRec) {
  const l = p.lines[0]
  if (!l) return 0
  return Math.round((l.price - subcontractStd(s, p, l)) * l.received * 100) / 100
}

type Row = PoRec & { vendor: string; total: number; spvAmt: number; issued: string; atV: number }
export function SubcontractList() {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const st = useNineStates("FX-PUR-SUBCON", { writers: "the Buyer or Purchasing Manager", degraded: "The production service did not return the work order operations: the operation link shows the pegged sales order only." })
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ vendorId: "" as VendorId | "", serviceItemId: "" as MaterialId | "", qty: "", price: "", needBy: "", compId: "" as MaterialId | "", compQty: "", so: "" })
  const rows: Row[] = useMemo(
    () => s.purchaseOrders.filter((p) => p.type === "Subcontract").map((p) => ({ ...p, vendor: vendorName(s, p.vendorId), total: poTotal(p), spvAmt: spv(s, p), issued: !p.provided?.length ? "No components" : p.provided.every((x) => x.issued) ? "Issued" : p.provided.some((x) => x.issued) ? "Part issued" : "Not issued", atV: atVendor(p).reduce((t, x) => t + x.atVendor, 0) })),
    [s],
  )
  const cols: Column<Row>[] = [
    { id: "id", header: "PO", value: (r) => r.id, sortable: true, mono: true },
    { id: "vendor", header: "Subcontractor", value: (r) => r.vendor, filterable: true },
    { id: "op", header: "Operation (service item)", value: (r) => r.lines[0]?.itemId ?? "", cell: (r) => <ItemLink id={r.lines[0].itemId} /> },
    { id: "peg", header: "Pegged to", value: (r) => r.lines[0]?.peg?.id ?? "", cell: (r) => (r.lines[0]?.peg ? <DocLink r={r.lines[0].peg} /> : <span className="text-muted-foreground">None</span>) },
    { id: "qty", header: "Quantity", value: (r) => r.lines[0]?.qty ?? 0, align: "right", cell: (r) => `${fmtNumber(r.lines[0].received)} of ${fmtNumber(r.lines[0].qty)}` },
    { id: "iss", header: "Components", value: (r) => r.issued, filterable: true },
    { id: "atv", header: "At subcontractor", value: (r) => r.atV, align: "right", mono: true },
    { id: "spv", header: "SPV to date", value: (r) => r.spvAmt, align: "right", cell: (r) => <VarAmount v={r.spvAmt} /> },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="purchaseOrder" status={r.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-PUR-SUBCON",
          title: "Subcontract orders",
          description: "Purchase orders for an outside operation: the vendor holds our components until the processed item comes back.",
          chips: <Design note="Route and archetype are design values; the subcontract rules are Book I G §6" />,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="subcontract-orders.csv" rows={rows.map((r) => ({ PO: r.id, Vendor: r.vendorId, Operation: r.lines[0]?.itemId, Status: r.status, Components: r.issued, AtSubcontractor: r.atV }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg(true)} {...writeProps(st)}>
              <Factory aria-hidden="true" /> New subcontract PO
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/purchasing/subcontract-orders/${r.id}`,
          searchText: (r) => `${r.id} ${r.vendor} ${r.lines[0]?.itemId}`,
          loading: st.loading,
          densityKey: "FX-PUR-SUBCON",
          empty: { title: "No subcontract orders", body: "Create one from a work order's subcontract operation or directly with a service item and the components to provide." },
        }}
        below={
          <RulesPanel
            rules={[
              ["G §6", "PO Type Subcontract: the line references a service item and a components-provided list", "[DOC:p.106]"],
              ["#34", "Issue to subcontractor: DR 1315 Subcontract Material at Vendor, CR 1310 Raw Materials, at valuation", "[DOC:p.106; p.178]"],
              ["#35", "Receipt: DR 1320 WIP, CR 2110 GR/IR at PO price, plus provided material from 1315; variance to 5260", "[DOC:p.106; p.178]"],
              ["A §8", "SPV = (invoice price - standard subcontract cost) x quantity", "[DOC:p.37 §8.1]"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        wide
        title="New subcontract PO"
        confirmLabel="Create draft PO"
        consequence="Creates a Draft PO of type Subcontract with the operation line and the components to provide. It goes for approval on the PO ladder; nothing posts until the components are issued."
        onConfirm={() => {
          if (st.guard()) return st.guard()
          const r = createSubcontractPo({ vendorId: f.vendorId as VendorId, serviceItemId: f.serviceItemId as MaterialId, qty: Number(f.qty), price: Number(f.price), needBy: f.needBy, provided: f.compId ? [{ itemId: f.compId as MaterialId, qty: Number(f.compQty) }] : [], pegSo: f.so || undefined })
          const err = report(r, (id) => `${id} created`)
          if (r.ok) nav(`/purchasing/subcontract-orders/${r.value}`)
          return err
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="sc-v" label="Subcontractor" value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v })} options={allVendors(s).filter((v) => v.onboarding === "Active").map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))} />
          <SelectField id="sc-i" label="Operation (service item)" value={f.serviceItemId} onChange={(v) => setF({ ...f, serviceItemId: v })} options={SERVICES.map((m) => ({ value: m.id, label: `${m.id} ${m.description}` }))} />
          <TextField id="sc-q" type="number" label="Service quantity" value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
          <TextField id="sc-p" type="number" label="Service price per unit" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
          <TextField id="sc-d" type="date" label="Need by" value={f.needBy} onChange={(v) => setF({ ...f, needBy: v })} />
          <TextField id="sc-so" label="Pegged sales order (optional)" value={f.so} onChange={(v) => setF({ ...f, so: v })} />
          <SelectField id="sc-c" label="Component provided" value={f.compId} onChange={(v) => setF({ ...f, compId: v })} options={PROVIDABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 32)}` }))} />
          <TextField id="sc-cq" type="number" label="Quantity provided" value={f.compQty} onChange={(v) => setF({ ...f, compQty: v })} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: the line must be a service item, and the need-by date must be after today.</p>}
      </DialogShell>
    </>
  )
}

export function SubcontractDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-SUBCON-2", { writers: "the Buyer, Receiving or Warehouse" })
  const p = s.purchaseOrders.find((x) => x.id === id && x.type === "Subcontract")
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!p} title={id} screenId="FX-PUR-SUBCON" back={{ label: "Subcontract orders", to: "/purchasing/subcontract-orders" }}>
      {() => <SubBody p={p!} st={st} />}
    </DetailFrame>
  )
}

function SubBody({ p, st }: { p: PoRec; st: NineStates }) {
  const s = useSlice("purchasingFinance")
  const [dlg, setDlg] = useState<null | "issue" | "receive" | "doc">(null)
  const [qty, setQty] = useState("")
  const l = p.lines[0]
  const comps = atVendor(p)
  const std = l ? subcontractStd(s, p, l) : 0
  const spvAmt = spv(s, p)
  const canIssue = ["Sent", "Confirmed", "Partially Received"].includes(p.status) && !!p.provided?.some((x) => !x.issued)
  const canReceive = ["Confirmed", "Partially Received"].includes(p.status) && l && l.received < l.qty
  const q = Number(qty) || 0
  const provVal = l ? providedValue(s, p, l, q) : 0
  const terminal = p.status === "Matched/Closed" || p.status === "Cancelled"
  const primary = canIssue ? (
    <Button onClick={() => setDlg("issue")} {...writeProps(st)}><Truck aria-hidden="true" /> Issue components to vendor</Button>
  ) : canReceive ? (
    <Button onClick={() => { setQty(String(l.qty - l.received)); setDlg("receive") }} {...writeProps(st)}>Receive processed item</Button>
  ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-PUR-SUBCON",
          title: `${p.id} · ${p.title}`,
          crumbs: [{ label: "Subcontract orders", to: "/purchasing/subcontract-orders" }],
          chips: terminal ? <Chip kind="design" note="Terminal records open read-only (C-55)">Read-only</Chip> : undefined,
          actions: (
            <>
              {st.menu}
              <Button variant="outline" onClick={() => setDlg("doc")} disabled={!comps.length}><Printer aria-hidden="true" /> Provision shipping document</Button>
              <Button asChild variant="ghost"><RecLink to={`/purchasing/orders/${p.id}`}>Open as purchase order</RecLink></Button>
            </>
          ),
          primary,
          children: st.banner,
        }}
        status={{ kind: "purchaseOrder", value: p.status }}
        doc={{ type: "purchaseOrder", id: p.id }}
        summary={
          <>
            <KV k="Subcontractor"><VendorLink id={p.vendorId} name={vendorName(s, p.vendorId)} /></KV>
            <KV k="Operation">{l ? <ItemLink id={l.itemId} /> : "None"}</KV>
            <KV k="Quantity">{l ? `${fmtNumber(l.received)} of ${fmtNumber(l.qty)} ${l.itemId.startsWith("SERV") ? "units of service" : ""}` : ""}</KV>
            <KV k="PO price / standard">{l ? <span className="tabular">{fmtMoney(l.price, p.currency)} / {fmtMoney(std, p.currency)}</span> : ""}</KV>
            <KV k="SPV to date"><VarAmount v={spvAmt} /></KV>
            <KV k="Pegged to">{l?.peg ? <DocLink r={l.peg} /> : "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "components",
            label: "Components provided",
            count: comps.length,
            content: (
              <StateGate st={st} cols={5} emptyTitle="No components provided" emptyBody="The vendor supplies all material for this operation.">
                <div className="flex flex-col gap-4">
                  {comps.length ? (
                    <Table>
                      <TableHeader className="bg-table-head">
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="text-right">Provided</TableHead>
                          <TableHead>Issue (#34)</TableHead>
                          <TableHead className="text-right">Consumed by receipts</TableHead>
                          <TableHead className="text-right">At subcontractor</TableHead>
                          <TableHead className="text-right">Value at standard</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comps.map((x) => (
                          <TableRow key={x.itemId} className="h-8 text-[13px]">
                            <TableCell><ItemLink id={x.itemId} /></TableCell>
                            <TableCell className="tabular text-right">{fmtNumber(x.qty)}</TableCell>
                            <TableCell>{x.issued ? "Issued to vendor" : "Not yet issued"}</TableCell>
                            <TableCell className="tabular text-right">{fmtNumber(x.consumed)}</TableCell>
                            <TableCell className="tabular text-right font-medium">{fmtNumber(x.atVendor)}</TableCell>
                            <TableCell className="tabular text-right">{fmtMoney(x.qty * (stdOf(s, x.itemId) ?? 0))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState title="No components provided">The vendor supplies all material for this operation.</EmptyState>
                  )}
                  <p className="text-sm text-muted-foreground">Stock stays on the books At Subcontractor {vendorName(s, p.vendorId)} (account 1315) until the processed item is received; the receipt consumes the provided components in proportion.</p>
                </div>
              </StateGate>
            ),
          },
          {
            id: "receipts",
            label: "Receipts and variance",
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-sm">
                  Service price {l ? fmtMoney(l.price, p.currency) : ""} against standard subcontract cost {fmtMoney(std, p.currency)} per unit <Reading id="OQ-PF-20" />. SPV to date <VarAmount v={spvAmt} />: unfavorable when the price is above standard.
                </p>
                {s.grns.filter((g) => g.poId === p.id).length ? (
                  <ul className="text-sm">{s.grns.filter((g) => g.poId === p.id).map((g) => <li key={g.id}><DocLink r={{ type: "grn", id: g.id }} /> {fmtDate(g.on)}: {g.lines.map((x) => `${fmtNumber(x.qty)} at ${fmtMoney(x.price, p.currency)}`).join(", ")}</li>)}</ul>
                ) : (
                  <EmptyState title="No receipt yet">The receipt posts #35 and consumes the provided components.</EmptyState>
                )}
                <p className="text-xs text-muted-foreground">Variances land on the <RecLink to="/inventory/valuation/cost-variance">Cost Variance Workbench</RecLink> as SPV on account 5260.</p>
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity",
            content: <ul className="flex flex-col gap-1 text-sm">{[...p.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul>,
          },
        ]}
        aside={terminal ? <LockedNote>A {p.status} PO is read-only.</LockedNote> : undefined}
      />
      <DialogShell
        open={dlg === "issue"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Issue components for ${p.id}`}
        confirmLabel="Issue to vendor"
        consequence="Moves the provided components to stock At Subcontractor, prints the provision shipping document and posts #34."
        onConfirm={() => st.guard() ?? report(issueProvided(p.id), "Components issued; #34 posted")}
      >
        <PostingPreview lines={[{ template: 34, amount: Math.round((p.provided ?? []).filter((x) => !x.issued).reduce((t, x) => t + x.qty * (stdOf(s, x.itemId) ?? 0), 0) * 100) / 100, detail: "Provided components at valuation" }]} period={TODAY.slice(0, 7)} />
      </DialogShell>
      <DialogShell
        open={dlg === "receive"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Receive processed item on ${p.id}`}
        confirmLabel="Post receipt"
        consequence="Receives the operation completion, consumes the provided components in proportion and posts #35. The variance to standard subcontract cost goes to 5260."
        onConfirm={() => st.guard() ?? report(postGrn(p.id, { line: 10, qty: q, serials: [] }), "Receipt posted; #35")}
      >
        <TextField id="sr-q" type="number" label={`Quantity received (open ${l ? l.qty - l.received : 0})`} value={qty} onChange={setQty} />
        <PostingPreview lines={[{ template: 35, amount: Math.round(((l?.price ?? 0) * q + provVal) * 100) / 100, detail: `${fmtNumber(q)} at ${fmtMoney(l?.price ?? 0, p.currency)} plus provided material ${fmtMoney(provVal)}` }]} period={TODAY.slice(0, 7)} />
      </DialogShell>
      <DialogShell open={dlg === "doc"} onOpenChange={(o) => !o && setDlg(null)} title="Provision shipping document" confirmLabel="Print" consequence="The document goes with the truck; the vendor signs for the quantities." onConfirm={() => { window.print(); return null }}>
        <Section title={`To ${vendorName(s, p.vendorId)} · for ${p.id}`}>
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Operation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comps.map((x) => (
                <TableRow key={x.itemId} className="text-[13px]">
                  <TableCell>{x.itemId} {itemText(x.itemId)}</TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(x.qty)}</TableCell>
                  <TableCell>{l ? itemText(l.itemId) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Provided material remains the property of PE; account 1315.</p>
        </Section>
      </DialogShell>
    </>
  )
}
