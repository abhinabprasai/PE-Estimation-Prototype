// PRC-SIM Price Simulation [DOC:pp.271-272] (asserted); rules Book IV §5.2, Book I A §4.4.
// Inputs for customer, item, quantity and date. Output waterfall listing every access tried, the
// winning rows and the floor verdict. Actions: Simulate, Copy result reference. The same service the
// documents call, so simulation equals reality. The route itself is a design value.
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Calculator, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, PageHeader } from "@/components/templates"
import { ApprovalButton, Chip, EmptyState, ErrorAlert, RulesPanel } from "@/components/patterns"
import type { CustomerId, MaterialId } from "@/data/domain"
import { CUSTOMERS, MATERIALS, TODAY } from "@/data/shared"
import { fmtMoney, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { simulatePrice, type SimResult } from "../data/logic"
import { Design, Reading, Section, useDemoState } from "../components/common"
import { SelectField, SkeletonTable, TextField } from "../components/bits"

export function PriceSim() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PRC-SIM")
  const [sp] = useSearchParams()
  const [f, setF] = useState({
    customerId: (sp.get("customer") ?? "CUS-TBD-0048") as CustomerId,
    itemId: (sp.get("item") ?? "FIN-TBD-20MVA") as MaterialId,
    qty: "1",
    date: TODAY,
    manual: "",
    discount: "",
  })
  const [res, setRes] = useState<SimResult | null>(null)
  const [open, setOpen] = useState(false)
  const cust = CUSTOMERS.find((c) => c.id === f.customerId)
  const ref = useMemo(() => (res ? `SIM-${f.customerId}-${f.itemId}-${f.date}-${Math.round(res.net)}` : ""), [res, f])
  const run = () => {
    const r = simulatePrice(s, { customerId: f.customerId, itemId: f.itemId, qty: Number(f.qty) || 1, date: f.date, manual: f.manual ? Number(f.manual) : undefined, discountPct: f.discount ? Number(f.discount) : undefined })
    setRes(r)
    setOpen(true)
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="PRC-SIM"
        title="Price simulation"
        description="Explains a price before anyone commits to it: every access the pricing service tried, the row that won, and the margin floor verdict."
        chips={<Design note="The route /pricing/simulate is a design value; the specification names a dialog and /api/v1/pricing/simulate" />}
        actions={st.menu}
        primary={
          <Button onClick={run} disabled={st.loading || !!st.error || st.empty}>
            <Calculator aria-hidden="true" /> Simulate
          </Button>
        }
      />
      {st.loading && <SkeletonTable cols={3} rows={4} />}
      {st.error && (
        <ErrorAlert title="The pricing service could not be reached" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
          {st.error}
        </ErrorAlert>
      )}
      {st.empty && <EmptyState title="Nothing to simulate yet">Price lists, customer agreements or item defaults must exist before the pricing service can explain a price. Create them under Price lists and agreements.</EmptyState>}
      {!st.loading && !st.error && !st.empty && (
      <>
      <div className="grid max-w-[960px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField id="sim-c" label="Customer" value={f.customerId} onChange={(v) => setF({ ...f, customerId: v as CustomerId })} options={CUSTOMERS.map((c) => ({ value: c.id, label: `${c.name} (${c.currency})` }))} />
        <SelectField id="sim-i" label="Item" value={f.itemId} onChange={(v) => setF({ ...f, itemId: v as MaterialId })} options={MATERIALS.filter((m) => m.listPrice != null || m.type === "FIN").map((m) => ({ value: m.id, label: `${m.id} ${m.description}` }))} />
        <TextField id="sim-q" label="Quantity" value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
        <TextField id="sim-d" type="date" label="Pricing date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <TextField id="sim-m" label="Manual override (optional)" value={f.manual} onChange={(v) => setF({ ...f, manual: v })} />
        <TextField id="sim-x" label="Discount % (DIS1, optional)" value={f.discount} onChange={(v) => setF({ ...f, discount: v })} />
      </div>
      <p className="text-sm text-muted-foreground">
        {cust?.name}: price list {cust?.priceListId ?? "none"}, incoterms {cust?.incoterms}, currency {cust?.currency}.
      </p>
      </>
      )}
      <RulesPanel
        className="max-w-[960px]"
        rules={[
          ["A §4.4", "Base price precedence: manual, customer agreement, price list, item default; first hit wins", "[DOC:p.29 §4.4]"],
          ["IV §5", "Steps 10 PB00, 20 DIS1 (one per line), 30 SURC, 40 FRT1, 50 TAX; elements persist on the document", "[DOC:p.211 §5]"],
          ["I §6.3", "Floor PC-100 22%, PC-300 18%; a breach escalates through WF-INBOX", "[DOC:p.122 §6.3]"],
        ]}
      />
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        wide
        title={`Price for ${f.itemId}, ${cust?.name ?? f.customerId}`}
        description={`Quantity ${f.qty}, pricing date ${f.date}`}
        confirmLabel="Close"
        onConfirm={() => null}
        secondary={
          res?.ok ? (
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(ref)
                toast.success(`Reference ${ref} copied`)
              }}
            >
              <ClipboardCopy aria-hidden="true" /> Copy result reference
            </Button>
          ) : undefined
        }
      >
        {res && <Waterfall r={res} currency={cust?.currency ?? "USD"} subject={ref} />}
      </DialogShell>
    </div>
  )
}

function Waterfall({ r, currency, subject }: { r: SimResult; currency: "USD" | "CAD"; subject: string }) {
  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {r.error && <ErrorAlert title="No price">{r.error}</ErrorAlert>}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Accesses tried</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.steps.map((st) => (
            <TableRow key={st.step} className="align-top text-[13px]">
              <TableCell>
                <span className="font-mono">{st.step}</span> {st.type}
                <div className="text-xs text-muted-foreground">{st.label}</div>
              </TableCell>
              <TableCell>
                {st.accesses.map((a, i) => (
                  <div key={i} className={a.won ? "font-semibold" : "text-muted-foreground"}>
                    {a.name}: {a.result} {a.won && <Chip kind="flag">won</Chip>}
                  </div>
                ))}
                {st.note && <div className="text-xs">{st.note}</div>}
              </TableCell>
              <TableCell className="tabular text-right">{st.value == null ? "Not computed" : fmtMoney(st.value, currency)}</TableCell>
            </TableRow>
          ))}
          {r.ok && (
            <TableRow className="text-[13px] font-semibold">
              <TableCell colSpan={2}>Net price (before tax)</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(r.net, currency)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {r.ok && (
        <Section title="Floor verdict">
          <p className="text-sm">
            {r.floorVerdict}
            {r.marginPct != null && ` · margin ${fmtPct(r.marginPct)}`}
            {r.floorPct != null && ` against floor ${r.floorPct}% (${r.pcId})`}
            {r.cost != null && ` · standard cost ${fmtMoney(r.cost)}`}
            {r.pointsBelow != null && ` · ${r.pointsBelow} points below`}
          </p>
          <p className="text-xs text-muted-foreground">
            Margin basis <Reading id="OQ-PF-11" />
          </p>
          {r.floorVerdict === "Below floor" && (
            <ApprovalButton kind="Below price floor" subject={{ type: "approval", id: `${subject}:floor` }} title={`Below floor: ${subject}`} ctx={{ pointsBelowFloor: r.pointsBelow }} label="Preview the escalation route" stay />
          )}
        </Section>
      )}
    </div>
  )
}
