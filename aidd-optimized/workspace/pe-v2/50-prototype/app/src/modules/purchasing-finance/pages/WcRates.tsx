// CST-RATE-001 Work Center Rates [DOC:p.270] (asserted); rules Book I I §2.
// Grid per work center: planned costs from the budget, planned hours from capacity, computed rates,
// prior year and delta columns, simulation column. Actions: Compute, Simulate, Release with
// effective date. Released versions are never edited (C-50); confirmations absorb at these rates.
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Calculator, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, RulesPanel } from "@/components/patterns"
import type { WorkCenterId } from "@/data/domain"
import { WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { computeRateDraft, editRateDraft, releaseRates } from "../data/actions"
import { Design, Reading, report, useDemoState } from "../components/common"
import { TextField, userName, SkeletonTable } from "../components/bits"

export function WcRates() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CST-RATE-001")
  const versions = useMemo(() => [...new Set(s.wcRates.map((r) => r.validFrom))].sort().reverse(), [s])
  const [ver, setVer] = useState<string>("")
  const v = ver && versions.includes(ver) ? ver : versions[0]
  const rows = s.wcRates.filter((r) => r.validFrom === v)
  const prevVer = versions.find((x) => x < v)
  const prev = (wc: string) => s.wcRates.find((r) => r.workCenterId === wc && r.validFrom === prevVer)
  const isDraft = rows.some((r) => r.state === "Draft")
  const [sim, setSim] = useState("0")
  const [dlg, setDlg] = useState<null | "compute" | "release">(null)
  const [cf, setCf] = useState({ from: "2027-01-01", uplift: "3.5" })
  const [edit, setEdit] = useState<Record<string, string>>({})
  const simF = 1 + (Number(sim) || 0) / 100

  const body = st.loading ? (
    <SkeletonTable cols={9} rows={8} />
  ) : st.error ? (
    <ErrorAlert title="Rates could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
      {st.error}
    </ErrorAlert>
  ) : st.empty || !rows.length ? (
    <EmptyState title="No rate version yet">Compute a draft from the annual budget: planned cost-center money divided by planned productive hours.</EmptyState>
  ) : (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Work center</TableHead>
          <TableHead className="text-right">Planned labor cost</TableHead>
          <TableHead className="text-right">Overhead pool</TableHead>
          <TableHead className="text-right">Planned hours</TableHead>
          <TableHead className="text-right">Labor rate</TableHead>
          <TableHead className="text-right">Overhead rate</TableHead>
          <TableHead className="text-right">Machine rate</TableHead>
          <TableHead className="text-right">Prior year (L / OH)</TableHead>
          <TableHead className="text-right">Delta labor</TableHead>
          <TableHead className="text-right">Simulation (L / OH)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const p = prev(r.workCenterId)
          const wc = WORK_CENTERS.find((w) => w.id === r.workCenterId)
          const d = p ? ((r.laborRate - p.laborRate) / p.laborRate) * 100 : undefined
          return (
            <TableRow key={r.workCenterId} className="h-8 text-[13px]">
              <TableCell>
                <span className="font-mono">{r.workCenterId}</span> {wc?.name}
                <div className="text-xs text-muted-foreground">
                  {wc?.costCenterId} · {wc?.capacityHoursPerDay} h/day × 250 d × {wc?.efficiencyPct}%
                </div>
              </TableCell>
              <TableCell className="tabular text-right">
                {r.state === "Draft" ? (
                  <Input
                    aria-label={`${r.workCenterId} planned labor cost`}
                    className="h-8 w-28 text-right"
                    value={edit[r.workCenterId] ?? String(r.plannedLaborCost)}
                    onChange={(e) => setEdit({ ...edit, [r.workCenterId]: e.target.value })}
                    onBlur={() => {
                      const n = Number(edit[r.workCenterId])
                      if (edit[r.workCenterId] != null && n !== r.plannedLaborCost) report(editRateDraft(r.workCenterId as WorkCenterId, r.validFrom, { plannedLaborCost: n }), `${r.workCenterId} recomputed`)
                    }}
                  />
                ) : (
                  fmtMoney(r.plannedLaborCost)
                )}
              </TableCell>
              <TableCell className="tabular text-right">{fmtMoney(r.plannedOverheadPool)}</TableCell>
              <TableCell className="tabular text-right">{fmtNumber(r.plannedHours)}</TableCell>
              <TableCell className="tabular text-right font-medium">{fmtMoney(r.laborRate)}</TableCell>
              <TableCell className="tabular text-right font-medium">{fmtMoney(r.overheadRate)}</TableCell>
              <TableCell className="tabular text-right">{r.machineRate ? fmtMoney(r.machineRate) : ""}</TableCell>
              <TableCell className="tabular text-right">{p ? `${fmtMoney(p.laborRate)} / ${fmtMoney(p.overheadRate)}` : "None"}</TableCell>
              <TableCell className="tabular text-right">{d != null ? fmtPct(d) : ""}</TableCell>
              <TableCell className="tabular text-right">
                {fmtMoney(Math.round(r.laborRate * simF * 100) / 100)} / {fmtMoney(Math.round(r.overheadRate * simF * 100) / 100)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <>
      <ConfigPage
        header={{
          screenId: "CST-RATE-001",
          title: "Work center rates",
          description: "The rates every rollup, confirmation and estimate uses. Released yearly with the budget; nothing is revalued retroactively.",
          chips: <Design note="Archetype and the 250 working days per year are design values (OQ-PF-13)">Design value</Design>,
          actions: (
            <>
              {st.menu}
              <Button variant="outline" onClick={() => setDlg("compute")}>
                <Calculator aria-hidden="true" /> Compute draft
              </Button>
            </>
          ),
          primary: isDraft ? (
            <Button onClick={() => setDlg("release")}>
              <Rocket aria-hidden="true" /> Release {fmtDate(v)}
            </Button>
          ) : undefined,
        }}
        effectiveDated
        sections={versions.map((x) => ({ id: x, label: `${fmtDate(x)} · ${s.wcRates.find((r) => r.validFrom === x)?.state}` }))}
        section={v}
        onSectionChange={setVer}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-sm">
              Version effective {fmtDate(v)} · {rows[0]?.state === "Released" ? `Released by ${userName(rows[0]?.releasedBy)}` : "Draft"} {rows[0]?.state === "Released" && <Chip kind="design" note="Released versions are never edited (C-50)">Read-only</Chip>}
            </p>
            <div className="w-48">
              <TextField id="sim" label="Simulate change %" value={sim} onChange={setSim} hint="Simulation only; nothing saves." />
            </div>
          </div>
          {body}
          <RulesPanel
            rules={[
              ["I §2", "Rate = planned cost-center money ÷ planned productive hours, per work center", "[DOC:p.117 §2]"],
              ["I §2", "Rates apply to confirmations from the effective date; standards keep the rate frozen at last rollup", "[DOC:p.117 §2]"],
              ["C-50", "Effective-dated: a change is a new dated version", "erd §4"],
              ["OQ-PF-13", "Planned hours = capacity h/day × 250 working days × efficiency", "reading"],
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Over or under absorption against these rates is on <Link className="text-link underline-offset-4 hover:underline" to="/controlling/reports/CO-R3">CO-R3</Link>. Hours reading <Reading id="OQ-PF-13" />
          </p>
        </div>
      </ConfigPage>
      <DialogShell
        open={dlg === "compute"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Compute a rate draft"
        confirmLabel="Compute"
        consequence="Creates a Draft version for every work center from the latest released planned costs uplifted by the budget change; rates recompute as planned money ÷ planned hours."
        onConfirm={() => {
          const r = computeRateDraft(cf.from, Number(cf.uplift) || 0)
          if (r.ok) setVer(cf.from)
          return report(r, `Draft effective ${cf.from} computed`)
        }}
      >
        <TextField id="cf-from" type="date" label="Effective from" value={cf.from} onChange={(x) => setCf({ ...cf, from: x })} />
        <TextField id="cf-up" label="Budget change on planned costs %" value={cf.uplift} onChange={(x) => setCf({ ...cf, uplift: x })} hint={<Design note="Budget comes from ACC 21; the uplift stands in for it in the prototype" />} />
      </DialogShell>
      <DialogShell
        open={dlg === "release"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Release rates effective ${fmtDate(v)}`}
        confirmLabel="Release"
        consequence={`Releases ${rows.length} work center rates effective ${fmtDate(v)}. Confirmations absorb at them from that date; the version becomes read-only. Controller only.`}
        onConfirm={() => report(releaseRates(v), (n) => `${n} rates released`)}
      />
    </>
  )
}
