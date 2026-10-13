// Small blocks the feature-list work adds to the existing quotation, order, customer and delivery screens:
// price waterfall, price-source badge, CTP chip, readiness chips, the six-slice ETO milestone strip.
import { CircleCheck, CircleDashed, CircleX, Minus } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { money } from "../data/model"
import { SIX_SLICE_LABELS, type ReadinessChip, type WaterStep } from "../fx/derive"
import type { BillingPlan, QuoteExt } from "../fx/model"

export function PriceSourceBadge({ source }: { source: string }) {
  const short = source.includes("agreement") ? "Customer agreement" : source.includes("Price list") ? "Price list" : source.includes("Cost estimate") ? "Cost estimate" : source.includes("Manual") ? "Manual" : source
  return <Badge variant="outline" title={`Price source: ${source}`}>{short}</Badge>
}

export function WaterfallTable({ steps, currency }: { steps: WaterStep[]; currency: "USD" | "CAD" }) {
  return (
    <Table aria-label="Price waterfall">
      <TableHeader className="bg-table-head"><TableRow><TableHead>Step</TableHead><TableHead>Level</TableHead><TableHead>What was found</TableHead><TableHead className="text-right">Value</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {steps.map((s) => (
          <TableRow key={s.type} className={cn(s.won && "bg-muted/60 font-medium")}>
            <TableCell className="font-mono text-xs">{s.type}</TableCell><TableCell>{s.label}</TableCell><TableCell className="text-sm">{s.note}</TableCell>
            <TableCell className="tabular text-right">{s.value != null ? (s.type === "DIS1" ? `${s.value}%` : money(s.value, currency)) : "None"}</TableCell>
            <TableCell>{s.won ? <Badge>Won</Badge> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** A button-like trigger that opens the waterfall for one line (PB00 steps 1 to 4, then the discount). */
export function WaterfallPopover({ steps, source, currency, label }: { steps: WaterStep[]; source: string; currency: "USD" | "CAD"; label: string }) {
  return (
    <Popover>
      <PopoverTrigger className="rounded-md border px-2 py-0.5 text-xs underline-offset-4 hover:underline" aria-label={`Price waterfall for ${label}`}>Waterfall</PopoverTrigger>
      <PopoverContent className="w-[640px] max-w-[92vw] text-sm" align="end">
        <p className="mb-2 font-semibold">Price waterfall for {label}</p>
        <p className="mb-2 text-xs text-muted-foreground">Pricing Service precedence, first hit wins: manual, customer price, price list with breaks, item default; then the discount [DOC:p.45 Part A §4.4]. Source: {source}.</p>
        <WaterfallTable steps={steps} currency={currency} />
      </PopoverContent>
    </Popover>
  )
}

const CTP_CLS: Record<QuoteExt["ctp"][number]["state"], string> = { Feasible: "border-status-passed", Pending: "border-status-pending", "Not required": "", "Band only": "border-dashed" }
export function CtpChip({ c }: { c: QuoteExt["ctp"][number] }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-lg border px-2 text-xs whitespace-nowrap", CTP_CLS[c.state])} title={c.constraint}>
      CTP: {c.state}{c.date ? ` ${c.date}` : ""}
    </span>
  )
}

const READY_ICON = { ready: CircleCheck, "not ready": CircleX, "n/a": Minus } as const
const READY_LABEL = { supply: "Supply", credit: "Credit", quality: "Quality", documents: "Documents" } as const
export function ReadinessChips({ chips }: { chips: ReadinessChip[] }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="Order readiness: supply, credit, quality, documents">
      {chips.map((c) => {
        const Icon = READY_ICON[c.state]
        return (
          <span key={c.key} title={c.why} className={cn("inline-flex h-6 items-center gap-1 rounded-lg border px-2 text-xs", c.state === "ready" ? "border-status-passed bg-status-passed-tint text-status-passed-ink" : c.state === "not ready" ? "border-status-draft text-status-draft-ink" : "text-muted-foreground")}>
            <Icon className="size-3" aria-hidden="true" />{READY_LABEL[c.key]}: {c.state}
          </span>
        )
      })}
    </div>
  )
}

/** The six ETO milestones as slices of the contract, each with its invoice-request state. */
export function MilestoneStrip({ plan, soId }: { plan: BillingPlan; soId: string }) {
  if (plan.kind !== "Milestone") return <p className="text-sm text-muted-foreground">{plan.kind} billing: one invoice request at {plan.kind === "On Shipment" ? "goods issue" : "delivery confirmation"}. <Link className="text-link underline" to={`/sales/billing-plan?so=${soId}`}>Billing plan</Link></p>
  return (
    <div className="flex flex-col gap-2" aria-label="ETO milestone strip">
      <ol className="flex w-full overflow-hidden rounded-lg border text-xs">
        {plan.milestones.map((m, i) => {
          const done = m.state !== "Planned"
          return (
            <li key={m.id} style={{ flexGrow: m.pct }} className={cn("flex min-w-20 flex-col gap-0.5 border-l p-2 first:border-l-0", done ? "bg-status-passed-tint" : "")} title={`${m.label}: ${m.trigger}`}>
              <span className="flex items-center gap-1 font-semibold">{done ? <CircleCheck className="size-3" aria-hidden="true" /> : <CircleDashed className="size-3" aria-hidden="true" />}{m.pct}%</span>
              <span className="line-clamp-2">{SIX_SLICE_LABELS[i] ?? m.label}</span>
              <span className="text-muted-foreground">{m.state === "Planned" ? "Planned" : m.state === "Invoiced" ? "Invoiced" : `IR ${m.irId ?? ""}`}</span>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-muted-foreground">Invoice requests are raised when a trigger fires and go to Finance; no invoice is posted from the order. <Link className="text-link underline" to={`/sales/billing-plan?so=${soId}`}>Open the billing plan</Link></p>
    </div>
  )
}
