// FX-PUR-SCORECARD Vendor performance and scorecard (/purchasing/vendor-performance); source Book I G §7 [DOC:p.107]:
// "OTD % (received vs confirmed date), quality acceptance % (IQC), price compliance (invoice vs PO), confirmation
// responsiveness, SCAR history; quarterly scorecard PDF per vendor; ratings feed AVL status proposals". The composite
// weights and bands are design values (OQ-PF-33). Route and archetype are design values.
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Printer, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel } from "@/components/patterns"
import { fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { allAvl, vendorName, vendorOf } from "../data/logic"
import { scorecardFor, SCORE_WEIGHTS, vendorsWithActivity, type Scorecard } from "../data/xlogic"
import { proposeAvlChange } from "../data/xactions"
import { CsvButton, Design, Reading, report } from "../components/common"
import { RecLink, SkeletonTable, VendorLink } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"

const BAND_TEXT: Record<Scorecard["band"], string> = { A: "A: 90 and above", B: "B: 80 to 89", C: "C: 70 to 79", D: "D: below 70", "Not rated": "Not rated" }

export function VendorPerformance() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-SCORECARD", { writers: "the Buyer proposes AVL status changes", degraded: "IQC acceptance comes from the quality service, which answered slowly: the quality measure and the composite score may be up to 24 hours old." })
  const [sel, setSel] = useState<string>("VEN-TBD-0112")
  const [dlg, setDlg] = useState<null | "pdf" | { propose: string }>(null)
  const cards = useMemo(() => vendorsWithActivity(s).map((v) => scorecardFor(s, v)), [s])
  const rated = cards.filter((c) => c.score != null)
  const avg = rated.length ? Math.round(rated.reduce((t, c) => t + (c.score as number), 0) / rated.length) : undefined
  const sc = cards.find((c) => c.vendorId === sel) ?? cards[0]
  const hist = s.scoreHistory.filter((h) => h.vendorId === sc?.vendorId).map((h) => ({ quarter: h.quarter, otd: h.otdPct, quality: h.qualityPct, price: h.pricePct }))
  const trend = sc ? [...hist, { quarter: "2026-Q4 to date", otd: sc.otdPct ?? 0, quality: sc.qualityPct ?? 0, price: sc.pricePct ?? 0 }] : []
  const avlRows = (v: string) => allAvl(s).filter((a) => a.vendorId === v)

  const body = st.loading ? (
    <SkeletonTable cols={8} rows={8} />
  ) : st.empty || !cards.length ? (
    <EmptyState title="No vendor activity yet">The scorecard needs receipts, invoices or AVL rows to measure.</EmptyState>
  ) : (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead>Band</TableHead>
          <TableHead className="text-right">On time</TableHead>
          <TableHead className="text-right">Quality</TableHead>
          <TableHead className="text-right">Price compliance</TableHead>
          <TableHead className="text-right">Confirms in (days)</TableHead>
          <TableHead className="text-right">Overdue SCARs</TableHead>
          <TableHead>AVL proposal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((c) => (
          <TableRow key={c.vendorId} className="h-10 cursor-pointer text-[13px]" data-state={c.vendorId === sel ? "selected" : undefined} onClick={() => setSel(c.vendorId)}>
            <TableCell>
              <VendorLink id={c.vendorId} name={vendorName(s, c.vendorId)} />
            </TableCell>
            <TableCell className="tabular text-right font-medium">{c.score ?? "n/a"}</TableCell>
            <TableCell>{c.band === "D" ? <Chip kind="flag">D</Chip> : c.band}</TableCell>
            <TableCell className="tabular text-right">{c.otdPct != null ? `${fmtPct(c.otdPct)} (${c.otdLines})` : <span className="text-muted-foreground">No receipts</span>}</TableCell>
            <TableCell className="tabular text-right">{c.qualityPct != null ? `${fmtPct(c.qualityPct)} (${c.qualityLots} lots)` : <span className="text-muted-foreground">Not rated</span>}</TableCell>
            <TableCell className="tabular text-right">{c.pricePct != null ? `${fmtPct(c.pricePct)} (${c.priceLines})` : <span className="text-muted-foreground">No invoices</span>}</TableCell>
            <TableCell className="tabular text-right">{c.confirmDays ?? ""}</TableCell>
            <TableCell className="tabular text-right">{c.overdueScars}</TableCell>
            <TableCell>
              {c.proposal ? (
                <Button size="sm" variant="outline" {...writeProps(st)} onClick={(e) => { e.stopPropagation(); setDlg({ propose: c.vendorId }) }}>
                  <Send aria-hidden="true" /> Propose {c.proposal}
                </Button>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  const proposeFor = typeof dlg === "object" && dlg ? dlg.propose : undefined
  const proposeCard = proposeFor ? cards.find((c) => c.vendorId === proposeFor) : undefined
  return (
    <>
      <DashboardPage
        header={{
          screenId: "FX-PUR-SCORECARD",
          title: "Vendor performance and scorecard",
          description: "Five measures per vendor from receipts, inspections and invoices. A low score proposes an AVL status change for Quality to decide.",
          chips: <Design note="Route, archetype, composite weights and bands are design values (OQ-PF-33)">Weights are design values</Design>,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="vendor-scorecard.csv" rows={cards.map((c) => ({ Vendor: c.vendorId, Score: c.score, Band: c.band, OTD: c.otdPct, Quality: c.qualityPct, PriceCompliance: c.pricePct, ConfirmDays: c.confirmDays, OverdueSCARs: c.overdueScars }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg("pdf")} disabled={!sc}>
              <Printer aria-hidden="true" /> Quarterly scorecard PDF
            </Button>
          ),
          children: st.banner,
        }}
        tiles={[
          { label: "Vendors rated", value: rated.length, hint: `${cards.length - rated.length} without data` },
          { label: "Average score", value: avg ?? "n/a", hint: "Weighted composite, 0 to 100" },
          { label: "Band D vendors", value: cards.filter((c) => c.band === "D").length, tone: cards.some((c) => c.band === "D") ? "attention" : "default", hint: "Below 70" },
          { label: "AVL proposals open", value: s.avlProposals.filter((p) => p.status === "Open").length, to: "/purchasing/avl", hint: "Waiting for Quality" },
        ]}
      >
        <DashboardCard title="Vendors" className="lg:col-span-2">
          {body}
          <p className="text-xs text-muted-foreground">
            Composite = on time {SCORE_WEIGHTS.otd}, quality {SCORE_WEIGHTS.quality}, price {SCORE_WEIGHTS.price}, confirmation {SCORE_WEIGHTS.confirm}, SCAR history {SCORE_WEIGHTS.scar}; unmeasured parts are left out and the rest re-weighted <Reading id="OQ-PF-33" />.
          </p>
        </DashboardCard>
        {sc && !st.loading && !st.empty && (
          <>
            <DashboardCard title={`${vendorName(s, sc.vendorId)}: trend by quarter`}>
              <ChartContainer config={{ otd: { label: "On time %", color: "var(--chart-1)" }, quality: { label: "Quality %", color: "var(--chart-3)" } }} className="h-56 w-full">
                <BarChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="otd" fill="var(--color-otd)" />
                  <Bar dataKey="quality" fill="var(--color-quality)" />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">2026-Q1 to Q3 are <Design note="Quarterly history before this session is seeded">design values</Design>; the last bar is live from receipts, inspections and invoices.</p>
            </DashboardCard>
            <DashboardCard title="Detail and AVL consequence">
              <dl className="grid gap-3 sm:grid-cols-2">
                <KV k="Band">{BAND_TEXT[sc.band]}</KV>
                <KV k="Vendor"><RecLink to={`/purchasing/vendors/${sc.vendorId}`}>{sc.vendorId}</RecLink></KV>
                <KV k="Quality approval">{vendorOf(s, sc.vendorId)?.quality}</KV>
                <KV k="AVL rows">{avlRows(sc.vendorId).map((a) => `${a.itemId} (${a.status})`).join(", ") || "None"}</KV>
              </dl>
              <p className="text-sm">
                {sc.proposal
                  ? `Score ${sc.score} proposes ${sc.proposal} on this vendor's AVL rows (below ${sc.proposal === "Suspended" ? 50 : 70}). Quality decides.`
                  : sc.score != null
                    ? `Score ${sc.score}: no AVL change proposed.`
                    : "Not enough data to rate."}
              </p>
            </DashboardCard>
          </>
        )}
      </DashboardPage>
      <RulesPanel
        rules={[
          ["G §7", "OTD % is received against the confirmed date; quality acceptance is the IQC result; price compliance is invoice against PO", "[DOC:p.107]"],
          ["G §7", "Ratings feed AVL status proposals; Quality decides qualification status", "[DOC:p.107]"],
          ["G §7", "A quarterly scorecard PDF per vendor", "[DOC:p.107]"],
        ]}
      />
      <DialogShell
        open={dlg === "pdf"}
        onOpenChange={(o) => !o && setDlg(null)}
        wide
        title={sc ? `Quarterly scorecard: ${vendorName(s, sc.vendorId)}` : "Scorecard"}
        confirmLabel="Print or save as PDF"
        consequence="Opens the browser print dialog; choose Save as PDF. The PDF carries the measures below for the quarter to date."
        onConfirm={() => { window.print(); return null }}
      >
        {sc && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">{vendorName(s, sc.vendorId)} · 2026-Q4 to date · score {sc.score ?? "n/a"} (band {sc.band})</p>
            <Table>
              <TableHeader className="bg-table-head">
                <TableRow>
                  <TableHead>Measure</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>On time (received vs confirmed date)</TableCell><TableCell className="tabular text-right">{sc.otdPct != null ? fmtPct(sc.otdPct) : "No receipts"}</TableCell><TableCell className="tabular text-right">{SCORE_WEIGHTS.otd}</TableCell></TableRow>
                <TableRow><TableCell>Quality acceptance (IQC)</TableCell><TableCell className="tabular text-right">{sc.qualityPct != null ? fmtPct(sc.qualityPct) : "Not rated"}</TableCell><TableCell className="tabular text-right">{SCORE_WEIGHTS.quality}</TableCell></TableRow>
                <TableRow><TableCell>Price compliance (invoice vs PO)</TableCell><TableCell className="tabular text-right">{sc.pricePct != null ? fmtPct(sc.pricePct) : "No invoices"}</TableCell><TableCell className="tabular text-right">{SCORE_WEIGHTS.price}</TableCell></TableRow>
                <TableRow><TableCell>Confirmation responsiveness (business days)</TableCell><TableCell className="tabular text-right">{sc.confirmDays ?? "n/a"}</TableCell><TableCell className="tabular text-right">{SCORE_WEIGHTS.confirm}</TableCell></TableRow>
                <TableRow><TableCell>SCAR history (overdue)</TableCell><TableCell className="tabular text-right">{sc.overdueScars}</TableCell><TableCell className="tabular text-right">{SCORE_WEIGHTS.scar}</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogShell>
      <DialogShell
        open={!!proposeFor}
        onOpenChange={(o) => !o && setDlg(null)}
        title={proposeCard ? `Propose ${proposeCard.proposal} for ${vendorName(s, proposeCard.vendorId)}` : ""}
        confirmLabel="Send to Quality"
        consequence="Creates one proposal per AVL row of this vendor for Quality to decide. Nothing changes until Quality applies it."
        onConfirm={() => {
          if (st.guard()) return st.guard()
          if (!proposeCard?.proposal) return "No proposal for this vendor."
          const rows = avlRows(proposeCard.vendorId).filter((a) => a.status !== proposeCard.proposal)
          if (!rows.length) return "Every AVL row of this vendor already has that status."
          let err: string | null = null
          let n = 0
          for (const a of rows) {
            const r = proposeAvlChange(a.id, proposeCard.proposal, `Scorecard score ${proposeCard.score} (band ${proposeCard.band}): on time ${proposeCard.otdPct ?? "n/a"}%, quality ${proposeCard.qualityPct ?? "n/a"}%`, "Scorecard")
            if (r.ok) n++
            else err = r.error
          }
          if (!n) return err
          report({ ok: true, value: n }, `${n} proposal(s) sent to Quality`)
          return null
        }}
      />
    </>
  )
}
