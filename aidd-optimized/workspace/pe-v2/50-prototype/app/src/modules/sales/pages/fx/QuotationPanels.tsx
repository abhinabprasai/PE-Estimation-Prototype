// Quotation panels from the feature list (OM-QT-001/2): lines with price waterfall, price source, per-line CTP chip
// and lead-time band; ETO datasheet; cost-estimate margin panel; commodity surcharge lines; budgetary watermark;
// version diff; win / loss capture [DOC:pp.50-51 Book I B §3; p.122 §6.3-6.4].
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { addDays, listDate, money, product, quoteValue, TODAY, type DB, type Quotation } from "../../data/model"
import { CtpLineChip } from "@/modules/planning-production"
import type { MaterialId } from "@/data/domain"
import { recordQuoteOutcome, setQuoteType } from "../../fx/actions"
import { isEtoLine, leadBand, marginOf, priceWaterfall, quoteExtOf } from "../../fx/derive"
import { LOSS_REASONS, MARGIN_FLOOR_PCT, MARGIN_TARGET_PCT, surchargeAmount, type LossReason } from "../../fx/model"
import { CtpChip, PriceSourceBadge, WaterfallPopover } from "../../components/fx"
import { A, Reading, Section } from "../../components/ext"
import { KitExplodeDialog } from "./KitExplode"
import { Inline, PickField, TextField, report } from "./kit"

export const BudgetaryBanner = () => (
  <div role="note" className="rounded-md border-2 border-dashed border-status-exception px-4 py-2 text-sm font-semibold tracking-wide">
    BUDGETARY: indicative price within ±25%. Not binding, no ATP, no capacity promise. A firm quotation is needed before an order.
  </div>
)

export function QuoteLines({ q, db, writable }: { q: Quotation; db: DB; writable: boolean }) {
  const c = db.customers.find((x) => x.id === q.customerId)!
  const ext = quoteExtOf(db, q)
  const [err, setErr] = useState<{ text: string } | null>(null)
  const [kit, setKit] = useState(false)
  const draft = q.status === "Draft" || q.status === "Internal Review"
  const surch = ext.surcharges.map((s) => ({ s, amt: surchargeAmount(s) * (q.lines.find((l) => l.no === s.line)?.qty ?? 1) }))
  const surchTotal = surch.reduce((a, x) => a + x.amt, 0)
  return (
    <div className="flex flex-col gap-3">
      {ext.type === "Budgetary" && <BudgetaryBanner />}
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow className="h-8"><TableHead>Line</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit price</TableHead><TableHead>Price source</TableHead><TableHead className="text-right">Lead time</TableHead><TableHead>Promise</TableHead><TableHead className="text-right">Line value</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {q.lines.map((l) => {
            const p = product(l.item)
            const wf = priceWaterfall(l.item, l.price, "Quotation", c.currency, { eto: isEtoLine(l.item), ce: ext.ceId })
            const weeks = ext.leadTimeWeeks[l.no]
            const band = leadBand(weeks ?? 8)
            const ctp = ext.ctp[l.no] ?? { state: "Not required" as const }
            return (
              <TableRow key={l.no} className="text-[13px] align-top">
                <TableCell className="tabular">{l.no}</TableCell>
                <TableCell>{l.item}<div className="text-xs text-muted-foreground">{p.description}{l.note ? ` · ${l.note}` : ""}</div></TableCell>
                <TableCell className="tabular text-right">{l.qty}</TableCell>
                <TableCell className="tabular text-right">{money(l.price, c.currency)}</TableCell>
                <TableCell><div className="flex flex-col items-start gap-1"><PriceSourceBadge source={wf.source} /><WaterfallPopover steps={wf.steps} source={wf.source} currency={c.currency} label={`${q.id} line ${l.no}`} /></div></TableCell>
                <TableCell className="tabular text-right">{ext.type === "Budgetary" ? `${band.low} to ${band.high} wk` : `${weeks ?? "n/a"} wk`}{ext.type === "Budgetary" && <div className="text-xs text-muted-foreground">band ±25%</div>}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {ext.type === "Firm" && (p.kind === "MTO" || p.kind === "ETO") ? (
                      <>
                        <CtpLineChip doc={{ type: "quotation", id: q.id }} line={l.no} itemId={l.item as MaterialId} qty={l.qty} customerId={q.customerId} orderType={p.kind} requestedDate={addDays(TODAY, (weeks ?? 8) * 7)} quoteType="Firm" />
                        {ctp.state === "Feasible" && <span className="text-xs text-muted-foreground">Feasible {ctp.date}</span>}
                      </>
                    ) : <CtpChip c={ctp} />}
                  </div>
                </TableCell>
                <TableCell className="tabular text-right">{money(l.price * l.qty, c.currency)}</TableCell>
              </TableRow>
            )
          })}
          {surch.map(({ s, amt }) => (
            <TableRow key={`${s.line}-${s.kind}`} className="bg-muted/30 text-[13px] align-top">
              <TableCell className="tabular">{s.line}.S</TableCell>
              <TableCell colSpan={4}>{s.kind} surcharge, line {s.line}<div className="text-xs text-muted-foreground">{s.index} · base {s.basis.toFixed(2)} at {s.basisDate} → {s.current.toFixed(2)} now; ({s.current.toFixed(2)} − {s.basis.toFixed(2)}) × {s.contentPerUnit.toLocaleString("en-US")} {s.unit} × 100% pass-through × {q.lines.find((l) => l.no === s.line)?.qty ?? 1} unit(s)</div></TableCell>
              <TableCell colSpan={2}><Chip kind="design" note="Fixed at order vs ship-date adjusted is a contract term (p.122 §6.4); shown as fixed at quote issue.">Fixed at order</Chip></TableCell>
              <TableCell className="tabular text-right">{money(amt, c.currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow><TableCell colSpan={7}>Total{surch.length ? " including commodity surcharges" : ""}</TableCell><TableCell className="tabular text-right">{money(quoteValue(q) + surchTotal, c.currency)}</TableCell></TableRow>
        </TableFooter>
      </Table>
      <Inline error={err} onDismiss={() => setErr(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setKit(true)} disabled={!draft || !writable} title={!draft ? `${q.id} is ${q.status}: issued content is locked. Revise first.` : undefined}>Add a sales kit line</Button>
        {draft && <TypeSwitch q={q} ext={ext} writable={writable} />}
        <Reading id="SR-29" note="Waterfall steps are rebuilt from the line price: a price under the list rate reads as a customer agreement, at list as the price list, ETO lines come from the cost estimate." />
      </div>
      <KitExplodeDialog docType="quotation" docId={q.id} open={kit} onOpenChange={setKit} />
    </div>
  )
}

function TypeSwitch({ q, ext, writable }: { q: Quotation; ext: ReturnType<typeof quoteExtOf>; writable: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  const set = (t: "Budgetary" | "Firm") => { const r = setQuoteType(q.id, t); if (r.ok) { toast.success(`Quote type: ${t}`); setErr(null) } else setErr(r.error) }
  return (
    <>
      <span className="text-sm">Quote type <strong>{ext.type}</strong></span>
      {q.status === "Draft" && <Button variant="outline" disabled={!writable} onClick={() => set(ext.type === "Firm" ? "Budgetary" : "Firm")}>Make {ext.type === "Firm" ? "Budgetary (±25%)" : "Firm (binding)"}</Button>}
      {err && <span role="alert" className="text-sm text-destructive">{err}</span>}
    </>
  )
}

export function QuoteEto({ q, db }: { q: Quotation; db: DB }) {
  const ext = quoteExtOf(db, q)
  const etoLines = q.lines.filter((l) => isEtoLine(l.item))
  if (etoLines.length === 0) return <p className="text-sm text-muted-foreground">No ETO line on this quotation. The configuration panel appears for ETO and configured lines.</p>
  return (
    <div className="flex flex-col gap-4">
      {etoLines.map((l) => {
        const sheet = ext.datasheet?.[l.no] ?? Object.fromEntries(Object.entries(q.config ?? {}))
        return (
          <section key={l.no} aria-label={`Datasheet line ${l.no}`} className="rounded-lg border">
            <h3 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">Technical data sheet · line {l.no} · {l.item}</h3>
            {Object.keys(sheet).length === 0 ? <p className="p-4 text-sm text-muted-foreground">No configuration attributes captured. Fill the requirement panel on the lead.</p> : (
              <dl className="grid gap-x-8 gap-y-1 p-4 text-sm md:grid-cols-2">
                {Object.entries(sheet).map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-dotted py-1"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>)}
              </dl>
            )}
            <p className="px-4 pb-3 text-xs text-muted-foreground">Attributes save as structured data, print on the quote's technical data sheet and copy forward to the sales order and the engineering request [DOC:p.50 §3.2].</p>
          </section>
        )
      })}
    </div>
  )
}

export function QuoteMargin({ q, db }: { q: Quotation; db: DB }) {
  const c = db.customers.find((x) => x.id === q.customerId)!
  const ext = quoteExtOf(db, q)
  const rows = q.lines.map((l) => {
    const cost = ext.costPerUnit[l.no] ?? 0
    return { l, cost, m: marginOf(l.price, cost) }
  })
  const worst = rows.reduce((a, r) => (r.m.pct < a ? r.m.pct : a), 100)
  const route = worst < MARGIN_FLOOR_PCT - 5 ? "Pricing Manager, then Sales Director, then CFO (below floor by more than 5 points)" : worst < MARGIN_FLOOR_PCT ? "Pricing Manager, then Sales Director (below floor)" : worst < MARGIN_TARGET_PCT ? "Internal Review: estimator and pricing approval (below target)" : "No approval needed: on target"
  const eto = q.lines.some((l) => isEtoLine(l.item))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{eto ? <>Cost estimate link: <strong>{ext.ceId ?? "None"}</strong>{ext.type === "Firm" && !ext.ceId ? " (mandatory for a Firm ETO quote)" : ""}.</> : "Catalogue lines cost at standard cost. No cost estimate link is needed."} <Reading id="SR-28" note="Target 22% and floor 15% are design values. The PRD gives floors per product class in the annual plan (examples 22% and 18%)." /></p>
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead className="text-right">Estimate cost / unit</TableHead><TableHead className="text-right">Price / unit</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Margin %</TableHead><TableHead>Floor check</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(({ l, cost, m }) => (
            <TableRow key={l.no}>
              <TableCell>{l.no} · {l.item}</TableCell><TableCell className="tabular text-right">{money(cost, c.currency)}</TableCell><TableCell className="tabular text-right">{money(l.price, c.currency)}</TableCell><TableCell className="tabular text-right">{money(m.margin, c.currency)}</TableCell><TableCell className="tabular text-right">{m.pct.toFixed(1)}%</TableCell>
              <TableCell>{m.verdict === "on target" ? `On target (${MARGIN_TARGET_PCT}%)` : m.verdict === "below target" ? `Below target ${MARGIN_TARGET_PCT}%` : `Below floor ${MARGIN_FLOOR_PCT}%`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm"><strong>Approval route:</strong> {route}. Every approval stores its justification; breaches go to the monthly breach register [DOC:p.122 §6.3].</p>
    </div>
  )
}

export function QuoteVersions({ q, db }: { q: Quotation; db: DB }) {
  const chain = (() => {
    let head = q
    while (head.predecessor) { const p = db.quotations.find((x) => x.id === head.predecessor); if (!p) break; head = p }
    const out = [head]
    while (out.at(-1)!.successor) { const n = db.quotations.find((x) => x.id === out.at(-1)!.successor); if (!n) break; out.push(n) }
    return out
  })()
  const [a, setA] = useState(chain.length > 1 ? chain[chain.length - 2].id : q.id)
  const [b, setB] = useState(q.id)
  const qa = db.quotations.find((x) => x.id === a)
  const qb = db.quotations.find((x) => x.id === b)
  const nos = [...new Set([...(qa?.lines ?? []), ...(qb?.lines ?? [])].map((l) => l.no))].sort((x, y) => x - y)
  const cur = db.customers.find((x) => x.id === q.customerId)?.currency ?? "USD"
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Version chain">
        {chain.map((v, i) => <li key={v.id} className="flex items-center gap-2">{i > 0 && <span aria-hidden="true">→</span>}<Link className="text-link underline" to={`/sales/quotations/${v.id}`}>{v.id}</Link><Badge variant="outline">{v.status}</Badge></li>)}
      </ol>
      {chain.length < 2 ? <p className="text-sm text-muted-foreground">Single version: nothing to compare. Revise an Issued quotation to create V{q.version + 1}; the diff is side by side.</p> : (
        <>
          <div className="grid max-w-2xl gap-3 md:grid-cols-2"><PickField label="Compare" value={a} onChange={setA} options={chain.map((v) => v.id)} /><PickField label="With" value={b} onChange={setB} options={chain.map((v) => v.id)} /></div>
          {qa && qb && (
            <Table aria-label="Side-by-side version diff">
              <TableHeader className="bg-table-head"><TableRow><TableHead>Line</TableHead><TableHead>{qa.id} item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead>{qb.id} item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {nos.map((n) => {
                  const x = qa.lines.find((l) => l.no === n)
                  const y = qb.lines.find((l) => l.no === n)
                  const changed = !x || !y || x.item !== y.item || x.qty !== y.qty || x.price !== y.price
                  return (
                    <TableRow key={n} className={changed ? "bg-muted/60" : ""}>
                      <TableCell className="tabular">{n}</TableCell>
                      <TableCell>{x?.item ?? "Not on this version"}</TableCell><TableCell className="tabular text-right">{x?.qty ?? ""}</TableCell><TableCell className="tabular text-right">{x ? money(x.price, cur) : ""}</TableCell>
                      <TableCell>{y?.item ?? "Not on this version"}</TableCell><TableCell className="tabular text-right">{y?.qty ?? ""}</TableCell><TableCell className="tabular text-right">{y ? money(y.price, cur) : ""}</TableCell>
                      <TableCell>{!x ? "Added" : !y ? "Removed" : changed ? [x.item !== y.item ? "Item" : "", x.qty !== y.qty ? "Quantity" : "", x.price !== y.price ? `Price ${money(y.price - x.price, cur)}` : ""].filter(Boolean).join(", ") : "Same"}</TableCell>
                    </TableRow>
                  )
                })}
                <TableRow><TableCell>Header</TableCell><TableCell colSpan={3}>Valid until {listDate(qa.validUntil)} · total {money(quoteValue(qa), cur)} · {qa.status}</TableCell><TableCell colSpan={3}>Valid until {listDate(qb.validUntil)} · total {money(quoteValue(qb), cur)} · {qb.status}</TableCell><TableCell>{quoteValue(qa) !== quoteValue(qb) ? `Total ${money(quoteValue(qb) - quoteValue(qa), cur)}` : "Same total"}</TableCell></TableRow>
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}

export function LossDialog({ q, open, onOpenChange }: { q: Quotation; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState<LossReason | "">("")
  const [notes, setNotes] = useState("")
  const [competitor, setCompetitor] = useState("")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title={`Record loss on ${q.id}`} description="A loss reason is required: Price, Lead Time, Technical, Relationship, No-Bid or Other with notes." consequence={`Moves ${q.id} Issued → Lost. The linked lead goes to Lost when no other quotation is still open. The reason feeds the Quote funnel Pareto.`} confirmLabel="Record loss" destructive
      onConfirm={() => { const r = recordQuoteOutcome(q.id, "Lost", { reason: reason || undefined, notes, competitor }); return report(r, "Loss recorded") }}>
      <PickField label="Loss reason" value={reason} onChange={(v) => setReason(v as LossReason)} options={LOSS_REASONS} />
      <div className="flex flex-col gap-1"><label htmlFor="loss-notes" className="text-sm font-medium">Notes{reason === "Other" ? " (required for Other)" : ""}</label><Textarea id="loss-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <TextField id="loss-comp" label="Competitor, if known" value={competitor} onChange={setCompetitor} />
    </DialogShell>
  )
}

export function QuoteWinLoss({ q, db, onLoss, onWin }: { q: Quotation; db: DB; onLoss: () => void; onWin: () => void }) {
  const wl = db.fx.quoteExt[q.id]?.winLoss
  return (
    <div className="flex flex-col gap-3">
      {wl ? (
        <Section title={`Recorded: ${wl.outcome}`}>
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><div><dt className="text-xs text-muted-foreground">Outcome</dt><dd>{wl.outcome}</dd></div><div><dt className="text-xs text-muted-foreground">Reason</dt><dd>{wl.reason ?? "Not applicable"}</dd></div><div><dt className="text-xs text-muted-foreground">Recorded</dt><dd>{wl.at} by {wl.by}</dd></div><div><dt className="text-xs text-muted-foreground">Competitor</dt><dd>{wl.competitor ?? "Not recorded"}</dd></div></dl>
          <p className="text-sm">{wl.notes || "No notes."}</p>
        </Section>
      ) : q.lossReason ? <p className="text-sm">Loss reason: {q.lossReason}</p> : <p className="text-sm text-muted-foreground">No outcome recorded. Win or loss is recorded on an Issued quotation.</p>}
      {q.status === "Issued" && <div className="flex gap-2"><Button onClick={onWin}>Record win</Button><Button variant="outline" onClick={onLoss}>Record loss</Button></div>}
      <p className="text-xs text-muted-foreground">Won is also the lead's Won; a recorded win lets the quotation convert to an order (R-8). See <A to="/sales/reports/funnel">Quote funnel</A>.</p>
    </div>
  )
}
