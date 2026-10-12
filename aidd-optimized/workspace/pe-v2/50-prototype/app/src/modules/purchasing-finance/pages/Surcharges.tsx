// PRC-SUR-001 Surcharge Rules and Index Values [DOC:p.271] (asserted); rules Book I I §6.4, Book IV §5.
// Index series with immutable monthly values; rule rows per family with base index, content and
// pass-through. Actions: post monthly values (Costing), maintain rules (Pricing Manager).
// Ship-date-adjusted contracts true up at PGI through template #38.
import { useState } from "react"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, PostingPreview, RulesPanel } from "@/components/patterns"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { postIndexValue, newSurchargeVersion } from "../data/actions"
import { indexAt, surchargeFor } from "../data/logic"
import type { SurchargeRec } from "../data/types"
import { report, Section, useDemoState } from "../components/common"
import { DocLink } from "../components/common"
import { SelectField, TextField, userName, SkeletonTable } from "../components/bits"

const INDEXES = ["COMEX copper $/lb", "CRGO basis $/kg"]

export function Surcharges() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PRC-SUR-001")
  const [sec, setSec] = useState("index")
  const [dlg, setDlg] = useState<null | "post" | SurchargeRec>(null)
  const [pv, setPv] = useState({ index: INDEXES[0], month: "2026-11", value: "", source: "COMEX monthly average, first business day" })
  const [nv, setNv] = useState({ base: "", content: "", pass: "", ship: false, from: "" })
  const months = [...new Set(s.indexValues.map((v) => v.month))].sort().reverse()

  // Hero-thread true-up: SO-2026-00301 priced 2026-01, shipped 2026-08 under AGR-TBD-0048 (Ship-Date Adjusted)
  const heroRules = s.surchargeRules.filter((r) => r.itemIds.includes("FIN-TBD-20MVA") && r.shipDateAdjusted)
  const trueUp = heroRules.map((r) => {
    const a = indexAt(s.indexValues, r.index, "2026-01")?.value ?? r.baseValue
    const b = indexAt(s.indexValues, r.index, "2026-08")?.value ?? r.baseValue
    return { r, a, b, delta: Math.round((surchargeFor(r, b) - surchargeFor(r, a)) * 100) / 100 }
  })
  const trueUpTotal = Math.round(trueUp.reduce((t, x) => t + x.delta, 0) * 100) / 100

  let body: React.ReactNode
  if (st.loading) body = <SkeletonTable cols={6} rows={8} />
  else if (st.error)
    body = (
      <ErrorAlert title="Surcharge data could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
        {st.error}
      </ErrorAlert>
    )
  else if (st.empty) body = <EmptyState title="No index values or rules yet">Costing posts the first monthly value; the Pricing Manager then defines rules per product family.</EmptyState>
  else if (sec === "index")
    body = (
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Month</TableHead>
            {INDEXES.map((i) => (
              <TableHead key={i} className="text-right">
                {i}
              </TableHead>
            ))}
            <TableHead>Posted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((m) => {
            const vs = INDEXES.map((i) => s.indexValues.find((v) => v.index === i && v.month === m))
            return (
              <TableRow key={m} className="h-8 text-[13px]">
                <TableCell className="tabular">{m}</TableCell>
                {vs.map((v, i) => (
                  <TableCell key={i} className="tabular text-right">
                    {v ? fmtNumber(v.value, 2) : <span className="text-muted-foreground">Not posted</span>}
                  </TableCell>
                ))}
                <TableCell className="text-xs text-muted-foreground">
                  {vs.filter(Boolean).map((v) => `${fmtDate(v!.postedOn)} ${userName(v!.postedBy)}`)[0]}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  else if (sec === "rules")
    body = (
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Family</TableHead>
            <TableHead>Index</TableHead>
            <TableHead className="text-right">Base index</TableHead>
            <TableHead className="text-right">Content per unit</TableHead>
            <TableHead className="text-right">Pass-through</TableHead>
            <TableHead>Contract term</TableHead>
            <TableHead>Valid from</TableHead>
            <TableHead className="text-right">Surcharge today</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.surchargeRules.map((r) => {
            const cur = indexAt(s.indexValues, r.index, "2026-10")
            const superseded = s.surchargeRules.some((o) => o.id !== r.id && o.family === r.family && o.commodity === r.commodity && o.validFrom > r.validFrom)
            return (
              <TableRow key={r.id} className="h-8 text-[13px]">
                <TableCell className="font-mono">{r.id}</TableCell>
                <TableCell>{r.family}</TableCell>
                <TableCell>{r.index}</TableCell>
                <TableCell className="tabular text-right">{fmtNumber(r.baseValue, 2)}</TableCell>
                <TableCell className="tabular text-right">
                  {fmtNumber(r.contentPerUnit)} {r.contentUnit}
                </TableCell>
                <TableCell className="tabular text-right">{r.passThroughPct}%</TableCell>
                <TableCell>{r.shipDateAdjusted ? "Ship-Date Adjusted" : "Fixed at Order"}</TableCell>
                <TableCell>
                  {fmtDate(r.validFrom)} {superseded && <Chip kind="design">Later version exists</Chip>}
                </TableCell>
                <TableCell className="tabular text-right">{cur ? fmtMoney(surchargeFor(r, cur.value)) : ""}</TableCell>
                <TableCell>
                  {!superseded && (
                    <Button size="sm" variant="ghost" onClick={() => (setNv({ base: String(r.baseValue), content: String(r.contentPerUnit), pass: String(r.passThroughPct), ship: r.shipDateAdjusted, from: "" }), setDlg(r))}>
                      New version
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  else
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          <DocLink r={{ type: "salesOrder", id: "SO-2026-00301" }} /> was priced in 2026-01 under AGR-TBD-0048 (Ship-Date Adjusted) and shipped 2026-08-11. At PGI the surcharge is re-computed at the ship-month index and the difference posts.
        </p>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead className="text-right">Index at order</TableHead>
              <TableHead className="text-right">Index at ship</TableHead>
              <TableHead className="text-right">True-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trueUp.map((x) => (
              <TableRow key={x.r.id} className="h-8 text-[13px]">
                <TableCell>
                  {x.r.id} {x.r.commodity}
                </TableCell>
                <TableCell className="tabular text-right">{fmtNumber(x.a, 2)}</TableCell>
                <TableCell className="tabular text-right">{fmtNumber(x.b, 2)}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(x.delta)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PostingPreview title="True-up at PGI" lines={[{ template: 38, amount: trueUpTotal, detail: "(surcharge at ship-month index − surcharge at order-month index) per rule" }]} period="2026-08" />
        <p className="text-xs text-muted-foreground">The sales delivery screen posts it; shown here so the rule owner sees what the index drives.</p>
      </div>
    )

  return (
    <>
      <ConfigPage
        header={{
          screenId: "PRC-SUR-001",
          title: "Surcharge rules and index values",
          description: "Surcharge = (index at pricing date − base index) × content per unit × pass-through %. Monthly index values are immutable once posted.",
          actions: (
            <>
              {st.menu}
            </>
          ),
          primary: (
            <Button onClick={() => setDlg("post")}>
              <CalendarPlus aria-hidden="true" /> Post monthly value
            </Button>
          ),
        }}
        effectiveDated
        sections={[
          { id: "index", label: "Index series" },
          { id: "rules", label: "Rules by family" },
          { id: "trueup", label: "PGI true-up (#38)" },
        ]}
        section={sec}
        onSectionChange={setSec}
      >
        <div className="flex flex-col gap-4">
          {body}
          <RulesPanel
            rules={[
              ["I §6.4", "Index at pricing date minus base index, times content per unit, times pass-through %", "[DOC:p.123 §6.4]"],
              ["I §6.4", "Index history is immutable; Costing posts monthly values", "[DOC:p.123 §6.4]"],
              ["#38", "Ship-date-adjusted contracts true up at PGI: DR 1200 AR / CR 4100 surcharge element", "Part J"],
            ]}
          />
        </div>
      </ConfigPage>
      <DialogShell
        open={dlg === "post"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Post a monthly index value"
        confirmLabel="Post value"
        consequence="Posts the value for the month. Posted values cannot be edited or deleted; documents priced in that month resolve against it. Cost accountant."
        onConfirm={() => report(postIndexValue(pv.index, pv.month, Number(pv.value), pv.source), `${pv.index} ${pv.month} posted`)}
      >
        <SelectField id="pv-i" label="Index" value={pv.index} onChange={(v) => setPv({ ...pv, index: v })} options={INDEXES.map((i) => ({ value: i, label: i }))} />
        <TextField id="pv-m" label="Month (yyyy-mm)" value={pv.month} onChange={(v) => setPv({ ...pv, month: v })} />
        <TextField id="pv-v" label="Value" value={pv.value} onChange={(v) => setPv({ ...pv, value: v })} />
        <TextField id="pv-s" label="Source note" value={pv.source} onChange={(v) => setPv({ ...pv, source: v })} />
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg && typeof dlg === "object" ? `New version of ${dlg.id}` : ""}
        confirmLabel="Create version"
        consequence="Creates a new dated rule version; the current one stays in force until the new date. Pricing Manager."
        onConfirm={() => (dlg && typeof dlg === "object" ? report(newSurchargeVersion(dlg.id, { baseValue: Number(nv.base), contentPerUnit: Number(nv.content), passThroughPct: Number(nv.pass), shipDateAdjusted: nv.ship, validFrom: nv.from }), (n) => `${n} created`) : null)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="nv-b" label="Base index" value={nv.base} onChange={(v) => setNv({ ...nv, base: v })} />
          <TextField id="nv-c" label="Content per unit" value={nv.content} onChange={(v) => setNv({ ...nv, content: v })} />
          <TextField id="nv-p" label="Pass-through %" value={nv.pass} onChange={(v) => setNv({ ...nv, pass: v })} />
          <TextField id="nv-f" type="date" label="Valid from" value={nv.from} onChange={(v) => setNv({ ...nv, from: v })} />
          <div className="flex items-center gap-2">
            <Switch id="nv-s" checked={nv.ship} onCheckedChange={(c) => setNv({ ...nv, ship: c })} />
            <Label htmlFor="nv-s">Ship-Date Adjusted</Label>
          </div>
        </div>
      </DialogShell>
      <Section title="Where these values are used" className="mt-6">
        <p className="text-sm">The price simulation and every quote and order line resolve step 30 (SURC) against these rules. Purchase-side surcharges follow the info records.</p>
      </Section>
    </>
  )
}
