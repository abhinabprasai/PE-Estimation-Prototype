// FX-INV-ICREC Intercompany pairing indicators and recon report (FL-07). One business event creates
// both documents atomically or neither [DOC:p.181 field 9]; a mismatch monitor alerts Finance when
// values or statuses diverge [field 10]; the monthly reconciliation compares the seller's IC
// receivable with the buyer's IC payable per pair and the close blocks on unexplained pairs
// [DOC: Book VIII §5.4] (asserted). Indicator names and the $0.01 tolerance are readings (RD-IO-14).
import { useState } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { CircleCheck, CircleX, TriangleAlert, Unlink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardCard, DashboardPage, DialogShell, PageHeader } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, RulesPanel } from "@/components/patterns"
import { LEGAL_ENTITIES } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { L, Reading, matShort, userName } from "../components/bits"
import { useViewState } from "../components/states"
import { icBlocksClose, icViews, VALUE_TOLERANCE, type IcKind, type IcView } from "../lib/ic"
import * as A from "../data/actions"

const KIND_BADGE: Record<IcKind, { variant: "done" | "blocked" | "pending" | "draft"; Icon: typeof CircleCheck }> = {
  Paired: { variant: "done", Icon: CircleCheck },
  "Value mismatch": { variant: "blocked", Icon: CircleX },
  "Status mismatch": { variant: "pending", Icon: TriangleAlert },
  "Not paired": { variant: "blocked", Icon: Unlink },
}
const entName = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id
const cur = (n: number, c: "USD" | "CAD") => fmtMoney(n, c)

function PairBadge({ kind }: { kind: IcKind }) {
  const { variant, Icon } = KIND_BADGE[kind]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {kind}
    </Badge>
  )
}

export function IntercompanyRecon() {
  const io = useSlice("inventoryOps")
  const pf = useSlice("purchasingFinance")
  const [sp] = useSearchParams()
  const [month, setMonth] = useState("2026-09")
  const [dlg, setDlg] = useState<IcView | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<IcKind | "all">("all")
  const focus = sp.get("pair")
  const ss = useViewState("FX-INV-ICREC", {
    degradedWhat: "The mismatch monitor feed is slow",
    authorizedRoles: ["Controller", "Cost accountant", "Controlling analyst"],
    terminalRecord: month <= "2026-08" && io.icRecon.some((r) => r.month === month),
  })

  const header = {
    title: "Intercompany pairing and reconciliation",
    screenId: "FX-INV-ICREC",
    description: "Every intercompany sale is a seller order and a buyer order created together, or neither. This report compares the seller's IC receivable with the buyer's IC payable per pair; a pair that does not agree blocks the month's close until Finance explains it.",
    crumbs: [{ label: "Intercompany" }],
  }
  if (ss.loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader {...header} />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const all = ss.empty ? [] : icViews(io.icPairs, pf)
  const views = all.filter((p) => p.month === month)
  const shown = views.filter((p) => filter === "all" || p.kind === filter)
  const count = (k: IcKind) => views.filter((p) => p.kind === k).length
  const blocking = views.filter(icBlocksClose)
  const run = io.icRecon.find((r) => r.month === month)
  const writable = ss.canWrite && !ss.degraded
  const why = ss.blockedWhy ?? (ss.degraded ? "The mismatch monitor feed is degraded" : undefined)
  const sumUsd = (f: (p: IcView) => number) => views.filter((p) => !p.rolledBack).reduce((a, p) => a + f(p), 0)
  const arTot = sumUsd((p) => p.arUsd)
  const apTot = sumUsd((p) => p.apUsd)
  const fxTot = sumUsd((p) => p.fxDiff)

  const doRun = () => {
    const r = A.runIcRecon(month)
    if (!r.ok) {
      setErr(r.error)
      toast.error(r.error)
      return
    }
    setErr(null)
    toast.success(blocking.length ? `Reconciliation run: ${blocking.length} pair(s) still block the close` : "Reconciliation run: every pair agrees or is explained")
  }
  const download = () => {
    const lines = [
      `Intercompany reconciliation, ${month}${run ? ` (run ${run.at.replace("T", " ")} by ${userName(run.by)})` : " (not run)"}`,
      "Pair\tSeller\tBuyer\tItem\tQty\tSeller AR (USD)\tBuyer AP (USD)\tDifference\tIndicator\tExplained",
      ...views.map((p) => [p.id, entName(p.sellerEntityId), entName(p.buyerEntityId), p.itemId, p.qty, p.arUsd.toFixed(2), p.apUsd.toFixed(2), p.valueDiff.toFixed(2), p.kind, p.explained ? p.explained.reason : ""].join("\t")),
    ]
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `ic-recon-${month}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Recon report downloaded")
  }

  const fullHeader = {
    ...header,
    actions: (
      <>
        {ss.toolbar}
        <Button variant="outline" onClick={download} disabled={!views.length}>Download recon report</Button>
      </>
    ),
    primary: (
      <Button disabled={!writable || !views.length} title={why} onClick={doRun}>
        {run ? "Re-run reconciliation" : "Run reconciliation"}
      </Button>
    ),
    children: (
      <div className="flex flex-col gap-2">
        {ss.banners}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ic-month">Month</Label>
            <Select value={month} onValueChange={(v) => { setMonth(v); setErr(null); setFilter("all") }}>
              <SelectTrigger id="ic-month" size="sm" className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{["2026-10", "2026-09", "2026-08"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ic-filter">Indicator</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as IcKind | "all")}>
              <SelectTrigger id="ic-filter" size="sm" className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All indicators</SelectItem>
                {(Object.keys(KIND_BADGE) as IcKind[]).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Reading id="RD-IO-14" />
        </div>
      </div>
    ),
  }

  return (
    <>
      <DashboardPage
        header={fullHeader}
        tiles={[
          { label: "Pairs this month", value: views.length, hint: `${count("Paired")} paired` },
          { label: "Value mismatch", value: count("Value mismatch"), tone: count("Value mismatch") ? "attention" : "default", hint: `Over $${VALUE_TOLERANCE.toFixed(2)}` },
          { label: "Status mismatch", value: count("Status mismatch"), tone: count("Status mismatch") ? "attention" : "default", hint: "Seller and buyer orders disagree" },
          { label: "Not paired", value: count("Not paired"), tone: count("Not paired") ? "attention" : "default", hint: "Rolled back; neither document exists" },
        ]}
      >
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2 text-sm">
            {blocking.length === 0 ? <CircleCheck className="size-4" aria-hidden="true" /> : <CircleX className="size-4 text-destructive" aria-hidden="true" />}
            <span className="font-medium">{blocking.length === 0 ? `${month}: every pair agrees or is explained; the intercompany step of the close is clear.` : `${blocking.length} pair(s) block the ${month} close until explained.`}</span>
            <span className="text-muted-foreground">{run ? `Reconciliation run ${run.at.replace("T", " ")} by ${userName(run.by)}.` : "Not run for this month."}</span>
          </div>
          {err && <ErrorAlert title="That did not go through" onDismiss={() => setErr(null)}>{err}</ErrorAlert>}
          {ss.error ? (
            <ErrorAlert title="The pairs could not be loaded" action={<button className="underline" onClick={ss.onRetry}>Try again</button>}>{ss.error}</ErrorAlert>
          ) : views.length === 0 ? (
            <EmptyState title="No intercompany pairs">{`No intercompany orders for ${month}.`}</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <caption className="sr-only">Intercompany pairs for {month}</caption>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Pair</TableHead>
                    <TableHead>Seller to buyer</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Seller receivable</TableHead>
                    <TableHead className="text-right">Buyer payable</TableHead>
                    <TableHead className="text-right">Difference (USD)</TableHead>
                    <TableHead>Indicator</TableHead>
                    <TableHead className="min-w-52">Explanation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.id} className={`align-top text-[13px] ${focus === p.id ? "bg-muted" : ""}`}>
                      <TableCell className="font-mono">{p.id}</TableCell>
                      <TableCell>{entName(p.sellerEntityId)} to {entName(p.buyerEntityId)}</TableCell>
                      <TableCell>
                        {p.sellerSo ? <div><L to={`/sales/orders/${p.sellerSo}`}>{p.sellerSo}</L> <span className="text-muted-foreground">{p.sellerSoStatus}</span></div> : <div className="text-muted-foreground">No seller order</div>}
                        {p.buyerPo ? <div><L to={`/purchasing/orders/${p.buyerPo}`}>{p.buyerPo}</L> <span className="text-muted-foreground">{p.buyerPoStatus}</span></div> : <div className="text-muted-foreground">No buyer order</div>}
                      </TableCell>
                      <TableCell>{p.itemId}<div className="text-muted-foreground">{matShort(p.itemId)} x {p.qty}</div></TableCell>
                      <TableCell className="tabular text-right">{p.rolledBack ? "-" : cur(p.sellerAr, p.sellerCurrency)}</TableCell>
                      <TableCell className="tabular text-right">{p.rolledBack ? "-" : cur(p.buyerAp, p.buyerCurrency)}</TableCell>
                      <TableCell className={p.kind === "Value mismatch" ? "tabular text-right font-semibold text-destructive" : "tabular text-right"}>{p.rolledBack ? "-" : p.valueDiff === 0 ? fmtMoney(0) : `${p.valueDiff > 0 ? "+" : ""}${fmtMoney(p.valueDiff)}`}</TableCell>
                      <TableCell>
                        <PairBadge kind={p.kind} />
                        {p.kind !== "Paired" && !p.explained && <div className="mt-1"><Chip kind="block">Blocks close</Chip></div>}
                      </TableCell>
                      <TableCell>
                        <div>{p.detail}</div>
                        {p.note && <div className="text-muted-foreground">{p.note}</div>}
                        {p.rolledBack && <div className="text-muted-foreground">Incident {p.rolledBack.incident}</div>}
                        {p.explained ? (
                          <div className="mt-1">Explained by {userName(p.explained.by)}, {p.explained.at.replace("T", " ")}: {p.explained.reason}</div>
                        ) : (
                          p.kind !== "Paired" && <Button className="mt-1" size="sm" variant="outline" disabled={!writable} title={why} onClick={() => (setErr(null), setDlg(p))}>Explain</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shown.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No pair has the indicator {filter}.</TableCell></TableRow>}
                </TableBody>
                <TableFooter>
                  <TableRow className="text-[13px]">
                    <TableCell colSpan={4}>Total in USD (paired documents; CAD at the booked rate 1.3600)</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(arTot)}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(apTot)}</TableCell>
                    <TableCell className="tabular text-right">{fmtMoney(arTot - apTot)}</TableCell>
                    <TableCell colSpan={2}>FX difference to 7100 at settlement: {fmtMoney(fxTot)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>
        <DashboardCard title="Reconciliation history">
          {io.icRecon.length ? (
            <ul className="text-sm">
              {[...io.icRecon].sort((a, b) => b.at.localeCompare(a.at)).map((r) => <li key={r.month + r.at}>{r.month}: run {r.at.replace("T", " ")} by {userName(r.by)}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No reconciliation has been run.</p>}
        </DashboardCard>
        <DashboardCard title="Mismatch monitor (FL-07 field 10)">
          <p className="text-sm text-muted-foreground">A daily check alerts Finance when a pair's values or statuses diverge. This month it flags {count("Value mismatch") + count("Status mismatch")} pair(s) and {count("Not paired")} rolled-back pairing(s).</p>
        </DashboardCard>
      </DashboardPage>
      <RulesPanel
        rules={[
          ["Pairing", "One business event creates both the seller order and the buyer order atomically, or neither; a failure rolls both back.", "[DOC:p.181 FL-07 f9]"],
          ["Monitor", "A mismatch monitor alerts Finance when values or statuses diverge between the paired documents.", "[DOC:p.181 FL-07 f10]"],
          ["Recon", "The monthly reconciliation compares the seller's IC receivable with the buyer's IC payable per pair; the close blocks on unexplained pairs.", "[DOC: Book VIII §5.4]"],
          ["Price", "A buyer price above the transfer price list needs the Controller on both sides.", "[DOC: Book III Part F §3]"],
          ["FX", "A CAD side is booked at the booked rate; the difference to the closing rate posts to 7100 at settlement.", "[DOC: Book VIII §5.4]"],
        ]}
      />
      <DialogShell
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Explain pair ${dlg?.id ?? ""}`}
        consequence={`Records why this pair differs (${dlg?.kind}). It stops blocking the ${month} close once explained; the documents themselves are not changed.`}
        confirmLabel="Record explanation"
        requireReason
        reasonLabel="Reason for the difference and the correcting action (required)"
        onConfirm={(reason) => {
          if (!dlg) return null
          const r = A.explainIcPair(dlg.id, reason)
          if (!r.ok) return r.error
          toast.success(`${dlg.id} explained`)
          return null
        }}
      />
    </>
  )
}
