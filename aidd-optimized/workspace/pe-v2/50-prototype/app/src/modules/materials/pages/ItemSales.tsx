// INV-ITEM-SALES Material master Sales tab, /inventory/items/{id} Sales view, Detail
// [Book VII p.280; Book I Part A §4, DOC:pp.28-30] (asserted). Sales Admin edits, Pricing Manager
// approves. Three blocks: A sales data fields, B price list assignments with margin columns, C
// customer-specific prices. Actions: add assignments and customer prices as dated rows, Mass Update
// creating new rows, Export, Price Simulation (the §4.4 waterfall). Below-floor rows and changes
// above ±5% route approval (W.4) through the shared engine (RD-MM-13).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { ApprovalButton, FamilyBadge, StatusBadge } from "@/components/patterns"
import type { Family } from "@/data/domain"
import { CUSTOMERS, HERO, SPINE_DOCS, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { store, useRole, useSlice } from "@/store"
import { PRICE_CHANGE_PCT, marginFloor, marginPct } from "../lib/rules"
import { getMaterial, rateOf } from "../data/state"
import { addSalesPrice, massUpdatePrices, priceCheck, priceWaterfall, withdrawSalesPrice } from "../data/actions"
import type { SalesPriceRow, SalesPriceStatus } from "../data/types"
import { DocLinkText, FieldRow, Reading, Section, show } from "../components/common"
import { confirmRun, run } from "../components/run"

const FAM: Record<SalesPriceStatus, Family> = { Draft: "draft", "Pending Approval": "pending", Active: "active", Expired: "done", Rejected: "cancelled" }
/** Price lists are mastered in Costing and Pricing (Part I §6); the tab edits this item's rates on them. */
const PRICE_LISTS = [
  { id: "PL-PRC-TBD-US26", currency: "USD" as const },
  { id: "PL-PRC-TBD-CA26", currency: "CAD" as const },
  { id: "PL-PRC-TBD-US27", currency: "USD" as const },
  { id: "PL-PRC-TBD-GC27", currency: "USD" as const },
]
const EDITORS = ["Sales admin", "Pricing Manager"]
const tomorrow = () => {
  const d = new Date(TODAY + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function ItemSalesTab({ materialId }: { materialId: string }) {
  const s = useSlice("materials")
  const [role] = useRole()
  const m = getMaterial(s, materialId)!
  const v = s.views[materialId]
  const [dlg, setDlg] = useState<null | "list" | "customer" | "mass" | "sim">(null)
  const [sel, setSel] = useState<string[]>([])
  const [f, setF] = useState({ key: "", price: "", from: tomorrow(), to: "", agreement: "" })
  const [mass, setMass] = useState({ pct: "", from: tomorrow() })
  const [sim, setSim] = useState({ customer: CUSTOMERS[0].id as string, qty: "1", date: TODAY })
  const std = rateOf(s, materialId)
  const floor = marginFloor(m.profitCenterId)
  const rows = s.salesPrices.filter((r) => r.materialId === materialId)
  const effStatus = (r: SalesPriceRow): SalesPriceStatus => (r.status === "Active" && r.validTo && r.validTo < TODAY ? "Expired" : r.status)
  const editor = EDITORS.includes(role)

  const margin = (r: SalesPriceRow) => {
    if (!std) return <span className="text-muted-foreground">No standard</span>
    const mg = marginPct(r.price, std)
    const below = floor != null && mg < floor
    return (
      <span className={cn(below && "font-semibold text-destructive")} title={floor != null ? `Floor ${floor}% (${m.profitCenterId})` : "No floor for this product line"}>
        {mg.toFixed(1)}%{below && " below floor"}
      </span>
    )
  }
  const approval = (r: SalesPriceRow) =>
    r.status === "Pending Approval" && r.approvalKind ? (
      <ApprovalButton
        kind={r.approvalKind}
        subject={{ type: "material", id: r.id }}
        title={`${r.id}: ${m.id} ${r.kind === "Price list" ? r.priceListId : r.customerId} ${fmtMoney(r.price, r.currency)} from ${r.validFrom}`}
        amount={r.price}
        currency={r.currency}
        ctx={r.approvalKind === "Below price floor" && std && floor != null ? { pointsBelowFloor: Math.round((floor - marginPct(r.price, std)) * 10) / 10 } : undefined}
        stay
      />
    ) : r.approvalRef ? (
      <span className="text-xs">{r.approvalRef}</span>
    ) : null
  const grid = (kind: SalesPriceRow["kind"]) => {
    const list = rows.filter((r) => r.kind === kind).sort((a, b) => (a.priceListId ?? a.customerId ?? "").localeCompare(b.priceListId ?? b.customerId ?? "") || b.validFrom.localeCompare(a.validFrom))
    if (!list.length) return <p className="text-sm text-muted-foreground">{kind === "Price list" ? "This item is on no price list." : "No customer-specific prices."}</p>
    return (
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>{kind === "Price list" ? "Price list" : "Customer"}</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead>Valid</TableHead>
            {kind === "Price list" ? <TableHead>Qty breaks</TableHead> : <TableHead>Source agreement</TableHead>}
            <TableHead className="text-right">Margin @ standard</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Approval</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => (
            <TableRow key={r.id} className="h-8 text-[13px]">
              <TableCell>
                <Checkbox aria-label={`Select ${r.id}`} disabled={effStatus(r) !== "Active"} checked={sel.includes(r.id)} onCheckedChange={(x) => setSel(x ? [...sel, r.id] : sel.filter((y) => y !== r.id))} />
              </TableCell>
              <TableCell className="font-mono">{kind === "Price list" ? r.priceListId : `${r.customerId} ${CUSTOMERS.find((c) => c.id === r.customerId)?.name ?? ""}`}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(r.price, r.currency)}</TableCell>
              <TableCell>
                {fmtDate(r.validFrom)} to {r.validTo ? fmtDate(r.validTo) : "open"}
              </TableCell>
              <TableCell className="text-xs">{kind === "Price list" ? (r.breaks.length ? r.breaks.map((b) => `${b.fromQty}+ ${fmtMoney(b.price, r.currency)}`).join("; ") : "") : show(r.agreement)}</TableCell>
              <TableCell className="tabular text-right">{margin(r)}</TableCell>
              <TableCell>
                <FamilyBadge family={FAM[effStatus(r)]} label={effStatus(r)} size="sm" title={r.note} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {approval(r)}
                  {editor && (r.status === "Draft" || r.status === "Pending Approval") && (
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => run(withdrawSalesPrice(r.id), `${r.id} withdrawn`)}>
                      Withdraw
                    </Button>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // preview of the approval need for the row being added
  const draftKind = dlg === "list" || dlg === "customer" ? (dlg === "list" ? "Price list" : "Customer") : undefined
  const chk = draftKind && f.key && Number(f.price) > 0 ? priceCheck(s, { materialId, kind: draftKind, priceListId: dlg === "list" ? f.key : undefined, customerId: dlg === "customer" ? f.key : undefined, price: Number(f.price), validFrom: f.from }) : undefined
  const listCur = PRICE_LISTS.find((p) => p.id === f.key)?.currency ?? CUSTOMERS.find((c) => c.id === f.key)?.currency ?? "USD"
  const wf = dlg === "sim" ? priceWaterfall(s, materialId, sim.customer, Number(sim.qty) || 1, sim.date, CUSTOMERS.find((c) => c.id === sim.customer)?.priceListId) : undefined

  // sales order lines that reference the item (kept from the earlier tab: the downstream consumer)
  const salesDb = (() => {
    try {
      return store.getSlice("sales")
    } catch {
      return undefined
    }
  })()
  const soLines = (salesDb?.orders ?? []).flatMap((o) => o.lines.filter((l) => l.item === m.id).map((l) => ({ o, l })))
  const spineSos = m.id === HERO.itemId ? SPINE_DOCS.filter((d) => d.ref.type === "salesOrder" && !soLines.some((x) => x.o.id === d.ref.id)) : []

  const exportCsv = () => {
    const head = "Row,Kind,Price list / customer,Currency,Price,Valid from,Valid to,Margin %,Status"
    const body = rows.map((r) => [r.id, r.kind, r.priceListId ?? r.customerId, r.currency, r.price, r.validFrom, r.validTo ?? "", std ? marginPct(r.price, std).toFixed(1) : "", effStatus(r)].join(","))
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }))
    a.download = `${m.id}-sales-prices.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!editor || !v?.sellable} onClick={() => (setF({ key: PRICE_LISTS[0].id, price: "", from: tomorrow(), to: "", agreement: "" }), setDlg("list"))}>
          Add price list assignment
        </Button>
        <Button variant="outline" disabled={!editor || !v?.sellable} onClick={() => (setF({ key: CUSTOMERS[0].id, price: "", from: tomorrow(), to: "", agreement: "" }), setDlg("customer"))}>
          Add customer price
        </Button>
        <Button variant="outline" disabled={!editor || !sel.length} onClick={() => setDlg("mass")}>
          Mass update ({sel.length})
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          Export
        </Button>
        <Button variant="outline" onClick={() => setDlg("sim")}>
          Price simulation
        </Button>
        <Reading id="RD-MM-13" />
        {!editor && <span className="text-xs text-muted-foreground">Acting as {role}: Sales Admin edits, Pricing Manager approves.</span>}
      </div>
      <Section title="A. Sales data">
        <dl className="max-w-3xl">
          <FieldRow label="Sellable" cls={2} owner="Sales admin">
            {v?.sellable ? "Yes" : "No"} <DocLinkText to={`/materials/change-requests?materials=${m.id}&field=sellable`}>Change via MCH</DocLinkText>
          </FieldRow>
          <FieldRow label="Sales UoM">{show(v?.salesUom) ?? <span className="text-muted-foreground">Not recorded</span>}</FieldRow>
          <FieldRow label="Tax category">{show(v?.salesTaxCategory) ?? <span className="text-muted-foreground">Not recorded</span>}</FieldRow>
          <FieldRow label="Warranty (months)">{show(v?.warrantyMonths) ?? <span className="text-muted-foreground">Not recorded</span>}</FieldRow>
          <FieldRow label="Item default (pricing method)">{m.listPrice ? `${fmtMoney(m.listPrice)} fixed price` : <span className="text-muted-foreground">Not recorded</span>}</FieldRow>
          <FieldRow label="Current standard / margin floor">
            {std ? fmtMoney(std) : "No standard"} · {floor != null ? `${floor}% (${m.profitCenterId})` : `no floor for ${m.profitCenterId}`}
          </FieldRow>
        </dl>
      </Section>
      <Section title="B. Price list assignments">{grid("Price list")}</Section>
      <Section title="C. Customer-specific prices">{grid("Customer")}</Section>
      <Section title={`Sales order lines referencing ${m.id} (${soLines.length + spineSos.length})`}>
        {soLines.length + spineSos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{v?.sellable ? "No sales order line references this item yet." : "Not sellable: no quotation or order line can reference it."}</p>
        ) : (
          <ul className="text-sm">
            {spineSos.map((d) => (
              <li key={d.ref.id}>
                <DocLinkText to={`/sales/orders/${d.ref.id}`}>{d.ref.id}</DocLinkText> · line 10 · {HERO.customerId} · {d.status && <StatusBadge kind="salesOrder" status={d.status.value} size="sm" />}
              </li>
            ))}
            {soLines.map(({ o, l }) => (
              <li key={`${o.id}-${l.no}`}>
                <DocLinkText to={`/sales/orders/${o.id}`}>{o.id}</DocLinkText> · line {l.no} · {o.customerId} · {l.qty} at {fmtMoney(l.unitPrice, o.currency === "CAD" ? "CAD" : "USD")} · <StatusBadge kind="soLine" status={l.status} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <DialogShell
        open={dlg === "list" || dlg === "customer"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg === "list" ? `Add price list assignment for ${m.id}` : `Add customer price for ${m.id}`}
        consequence={
          chk?.kind
            ? `Saved as Pending Approval: ${chk.kind === "Below price floor" ? `margin ${chk.margin?.toFixed(1)}% is below the ${chk.floor}% floor` : `change ${chk.changePct?.toFixed(1)}% exceeds ±${PRICE_CHANGE_PCT}%`}. It applies after approval in WF-INBOX; the row in force stays until then.`
            : "A new dated row; the row in force is closed the day before it starts. History is never edited."
        }
        confirmLabel="Add row"
        onConfirm={() =>
          confirmRun(
            addSalesPrice({
              materialId, kind: dlg === "list" ? "Price list" : "Customer", priceListId: dlg === "list" ? f.key : undefined, customerId: dlg === "customer" ? f.key : undefined, currency: listCur, price: Number(f.price), validFrom: f.from, validTo: f.to || undefined,
              agreement: f.agreement || undefined,
            }),
            (r) => (r.kind ? `${r.id} waits for approval (${r.kind}); send it from the grid` : `${r.id} added`),
          )
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="sp-key">{dlg === "list" ? "Price list" : "Customer"}</Label>
            <Select value={f.key} onValueChange={(x) => setF({ ...f, key: x })}>
              <SelectTrigger id="sp-key">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dlg === "list"
                  ? PRICE_LISTS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id} ({p.currency})
                      </SelectItem>
                    ))
                  : CUSTOMERS.filter((c) => c.status === "Active").map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.currency})
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sp-price">Unit price ({listCur})</Label>
            <Input id="sp-price" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sp-from">Valid from</Label>
            <Input id="sp-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sp-to">Valid to (blank = open)</Label>
            <Input id="sp-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          {dlg === "customer" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="sp-ag">Source agreement</Label>
              <Input id="sp-ag" value={f.agreement} onChange={(e) => setF({ ...f, agreement: e.target.value })} />
            </div>
          )}
          {chk && (
            <p className="text-sm md:col-span-2">
              Margin @ standard {chk.margin != null ? `${chk.margin.toFixed(1)}%` : "not computed (no standard)"}
              {chk.prev ? `; change against ${fmtMoney(chk.prev.price, chk.prev.currency)} in force: ${chk.changePct?.toFixed(1)}%` : "; no row in force"}.
            </p>
          )}
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "mass"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Mass update ${sel.length} row(s)`}
        consequence="Creates new dated rows at the adjusted price; existing rows are closed the day before, never edited. Rows above ±5% or below the floor wait for approval."
        confirmLabel="Create rows"
        onConfirm={() => confirmRun(massUpdatePrices(sel, Number(mass.pct), mass.from), (r) => (setSel([]), `${r.length} row(s) created, ${r.filter((x) => x.kind).length} waiting for approval`))}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="mu-pct">Adjustment %</Label>
            <Input id="mu-pct" inputMode="decimal" value={mass.pct} onChange={(e) => setMass({ ...mass, pct: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mu-from">Valid from</Label>
            <Input id="mu-from" type="date" value={mass.from} onChange={(e) => setMass({ ...mass, from: e.target.value })} />
          </div>
        </div>
      </DialogShell>
      <DialogShell open={dlg === "sim"} onOpenChange={(o) => !o && setDlg(null)} title={`Price simulation for ${m.id}`} description="Enter customer, quantity and date; the waterfall resolves exactly as a document would (§4.4)." confirmLabel="Close" wide onConfirm={() => null}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sim-c">Customer</Label>
            <Select value={sim.customer} onValueChange={(x) => setSim({ ...sim, customer: x })}>
              <SelectTrigger id="sim-c">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMERS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sim-q">Quantity</Label>
            <Input id="sim-q" inputMode="decimal" value={sim.qty} onChange={(e) => setSim({ ...sim, qty: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sim-d">Pricing date</Label>
            <Input id="sim-d" type="date" value={sim.date} onChange={(e) => setSim({ ...sim, date: e.target.value })} />
          </div>
        </div>
        {wf && (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wf.levels.map((l) => (
                <TableRow key={l.level} className={cn("h-8 text-[13px]", wf.won === l && "bg-muted font-semibold")}>
                  <TableCell>
                    {l.level}
                    {wf.won === l && " (wins)"}
                  </TableCell>
                  <TableCell className="tabular text-right">{l.price != null ? fmtMoney(l.price) : ""}</TableCell>
                  <TableCell>{l.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {wf?.error && <p className="text-sm text-destructive">{wf.error}</p>}
      </DialogShell>
    </div>
  )
}
