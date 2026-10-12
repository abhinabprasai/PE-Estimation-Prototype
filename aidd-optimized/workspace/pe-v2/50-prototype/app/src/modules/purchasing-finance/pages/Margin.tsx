// PRC-MARG Margin Analysis [DOC:p.272] (asserted); rules Book I I §7, Book IV §7.6.
// Quote margin register, three-view order margin (quoted against estimate, standard at PGI, actual at
// settlement), price realization decomposition, floor breach register with aging. Actions: drill to
// documents, export. The dashboard archetype is a design value.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert } from "@/components/patterns"
import { CUSTOMERS, PROFIT_CENTERS, TODAY } from "@/data/shared"
import { daysBetween, fmtMoney, fmtPct } from "@/lib/format"
import { material } from "../data/logic"
import { SEED_ORDER_MARGINS, SEED_QUOTE_MARGINS } from "../data/seed"
import { CsvButton, Design, DocLink, Reading, signCls, useDemoState } from "../components/common"
import { customerName, SkeletonTable } from "../components/bits"

const pct = (price: number, cost?: number) => (cost == null || !price ? undefined : ((price - cost) / price) * 100)
const floorOf = (itemId: string) => PROFIT_CENTERS.find((p) => p.id === material(itemId)?.profitCenterId)?.priceFloorPct

export function MarginAnalysis() {
  const st = useDemoState("PRC-MARG")
  const quotes = SEED_QUOTE_MARGINS.map((q) => ({ ...q, margin: pct(q.price, q.cost)!, floor: q.floorPct ?? floorOf(q.itemId) }))
  const breaches = quotes.filter((q) => q.floor != null && q.margin < q.floor)
  const orders = SEED_ORDER_MARGINS
  const won = quotes.filter((q) => q.outcome === "Won")
  const avgWon = won.length ? won.reduce((t, q) => t + q.margin, 0) / won.length : 0
  const realization = quotes
    .filter((q) => material(q.itemId)?.listPrice)
    .map((q) => {
      const list = material(q.itemId)!.listPrice! * (CUSTOMERS.find((c) => c.id === q.customerId)?.currency === "CAD" ? 1.36 : 1)
      return { name: q.quoteId.replace("QT-TBD-", ""), list: Math.round(list), price: q.price, gap: Math.round(q.price - list), pctOfList: (q.price / list) * 100 }
    })
  const header = {
    screenId: "PRC-MARG",
    title: "Margin analysis",
    description: "The closed loop from quote to actual: what was quoted against the estimate, what the standard said at shipment, and what the order really cost at settlement.",
    chips: <Design note="Archetype (dashboard) not extracted from the specification" />,
    actions: (
      <>
        {st.menu}
        <CsvButton filename="quote-margin-register.csv" rows={quotes.map((q) => ({ Quote: q.quoteId, Customer: customerName(q.customerId), Item: q.itemId, Price: q.price, Cost: q.cost, Margin: q.margin.toFixed(1), Floor: q.floor ?? "", Outcome: q.outcome }))} />
      </>
    ),
  }
  if (st.loading || st.error || st.empty)
    return (
      <DashboardPage header={header}>
        <DashboardCard title="Margin analysis" className="lg:col-span-2">
          {st.loading ? (
            <SkeletonTable cols={6} rows={6} />
          ) : st.error ? (
            <ErrorAlert title="Margin data could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
              {st.error}
            </ErrorAlert>
          ) : (
            <EmptyState title="No quotes or settled orders yet">Margins appear once quotes are priced against a released estimate or standard.</EmptyState>
          )}
        </DashboardCard>
      </DashboardPage>
    )
  return (
    <DashboardPage
      header={header}
      tiles={[
        { label: "Quotes in register", value: quotes.length },
        { label: "Average margin, won quotes", value: fmtPct(avgWon) },
        { label: "Floor breaches", value: breaches.length, tone: breaches.length ? "attention" : "default", hint: "Below the profit center floor" },
        { label: "Hero order actual vs estimate", value: fmtMoney((orders[0].actual ?? 0) - (orders[0].estimate ?? 0)), hint: "SO-2026-00301, unfavorable when positive" },
      ]}
    >
      <DashboardCard title="Quote margin register" className="lg:col-span-2">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Quote</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Cost basis</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Floor</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((q) => (
              <TableRow key={q.quoteId} className="h-8 text-[13px]">
                <TableCell>
                  <DocLink r={{ type: "quotation", id: q.quoteId }} />
                </TableCell>
                <TableCell>{customerName(q.customerId)}</TableCell>
                <TableCell className="font-mono">{q.itemId}</TableCell>
                <TableCell>{q.ceId ? <DocLink r={{ type: "costEstimate", id: q.ceId }} /> : "Standard"}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(q.price)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(q.cost)}</TableCell>
                <TableCell className="tabular text-right">
                  {fmtPct(q.margin)} {q.floor != null && q.margin < q.floor && <Chip kind="flag">Below floor</Chip>}
                </TableCell>
                <TableCell className="tabular text-right">{q.floor != null ? `${q.floor}%` : <span className="text-muted-foreground">Not stated</span>}</TableCell>
                <TableCell>{q.outcome}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Margin basis <Reading id="OQ-PF-11" />
        </p>
      </DashboardCard>
      <DashboardCard title="Order margin three ways" className="lg:col-span-2">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Order line</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Quoted vs estimate</TableHead>
              <TableHead className="text-right">Standard at PGI</TableHead>
              <TableHead className="text-right">Actual at settlement</TableHead>
              <TableHead className="text-right">Actual − estimate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.soId + o.line} className="h-8 text-[13px]">
                <TableCell>
                  <DocLink r={{ type: "salesOrder", id: o.soId }} /> line {o.line}
                </TableCell>
                <TableCell className="tabular text-right">{fmtMoney(o.price)}</TableCell>
                <TableCell className="tabular text-right">{o.estimate != null ? `${fmtMoney(o.estimate)} (${fmtPct(pct(o.price, o.estimate)!)})` : "None"}</TableCell>
                <TableCell className="tabular text-right">{o.standardAtPgi != null ? `${fmtMoney(o.standardAtPgi)} (${fmtPct(pct(o.price, o.standardAtPgi)!)})` : "Not shipped"}</TableCell>
                <TableCell className="tabular text-right">{o.actual != null ? `${fmtMoney(o.actual)} (${fmtPct(pct(o.price, o.actual)!)})` : "Not settled"}</TableCell>
                <TableCell className={`tabular text-right ${o.actual != null && o.estimate != null ? signCls(o.actual - o.estimate) : ""}`}>{o.actual != null && o.estimate != null ? fmtMoney(o.actual - o.estimate) : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DashboardCard>
      <DashboardCard title="Price realization against list">
        {realization.length ? (
          <ChartContainer config={{ list: { label: "List", color: "var(--chart-1)" }, price: { label: "Quoted", color: "var(--chart-3)" } }} className="h-64 w-full">
            <BarChart data={realization}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="list" fill="var(--color-list)" />
              <Bar dataKey="price" fill="var(--color-price)" />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No list-priced quotes.</p>
        )}
        <ul className="text-xs text-muted-foreground">
          {realization.map((r) => (
            <li key={r.name}>
              {r.name}: {fmtPct(r.pctOfList)} of list ({fmtMoney(r.gap)})
            </li>
          ))}
        </ul>
      </DashboardCard>
      <DashboardCard title={`Floor breach register (${breaches.length})`}>
        {breaches.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead className="text-right">Points below</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches.map((q) => {
                const d = q.approval?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1]
                return (
                  <TableRow key={q.quoteId} className="h-8 text-[13px]">
                    <TableCell>
                      <DocLink r={{ type: "quotation", id: q.quoteId }} />
                    </TableCell>
                    <TableCell className="tabular text-right">{(q.floor! - q.margin).toFixed(1)}</TableCell>
                    <TableCell>{q.approval ?? <Chip kind="flag">No approval recorded</Chip>}</TableCell>
                    <TableCell className="tabular text-right">{d ? `${daysBetween(d, TODAY)} d` : "Open"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm">No quote sits below its floor.</p>
        )}
      </DashboardCard>
    </DashboardPage>
  )
}
