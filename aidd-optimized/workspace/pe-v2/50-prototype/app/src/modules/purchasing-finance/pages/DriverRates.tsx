// FX-CST-DRIVER Parametric driver-rate tables (/costing/driver-rates); source Book I I §3.1 [DOC:p.119]: "Parametric ETO model:
// for quotes before design, the estimator enters driver quantities (core weight, copper weight, oil volume, tank steel
// weight, bushing / tap changer selections, est. labor hours per WC) against a maintained driver-rate table (e.g. $/kg CRGO
// at current commodity basis); template per product family seeded from historical actuals". Each rate change is a new dated
// version (the C-50 pattern), never an edit. Maintained by Costing (OQ-PF-28). Route and archetype are design values.
import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, StatusBadge } from "@/components/patterns"
import { OPEN_PERIOD, TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { indexAt } from "../data/logic"
import { currentRate } from "../data/xlogic"
import { addDriver, addDriverVersion, refreshEstimateRates } from "../data/xactions"
import type { DriverRate } from "../data/xtypes"
import { CsvButton, Design, Reading, report } from "../components/common"
import { RecLink, SelectField, SkeletonTable, TextField, userName } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"

const SECTIONS = [{ id: "rates", label: "Driver rates" }, { id: "templates", label: "Family templates" }, { id: "estimates", label: "Estimates on driver rates" }]

export function DriverRates() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-CST-DRIVER", { writers: "the Cost accountant or Controller", degraded: "Commodity index values are from the last monthly posting: the index-linked rates may not reflect this week's basis." })
  const [section, setSection] = useState("rates")
  const [dlg, setDlg] = useState<null | { version: DriverRate } | "add">(null)
  const [v, setV] = useState({ rate: "", from: "", note: "" })
  const [add, setAdd] = useState({ driver: "", unit: "kg", family: "", rate: "", from: TODAY, index: "" })
  const families = [...new Set(s.driverRates.map((d) => d.family))]
  const drafts = s.costEstimates.filter((c) => c.status === "Draft" && c.items.some((i) => i.source === "Driver rate"))

  const rateTable = (
    <div className="flex flex-col gap-4">
      {families.map((f) => (
        <section key={f} aria-label={f} className="rounded-lg border">
          <h2 className="border-b px-4 py-2 text-sm font-semibold">{f}</h2>
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate today</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead className="text-right">Change vs previous</TableHead>
                <TableHead>Follows index</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.driverRates.filter((d) => d.family === f).map((d) => {
                const cur = currentRate(d)
                const sorted = [...d.versions].sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                const prev = sorted.find((x) => x.validFrom < cur.validFrom)
                const idx = d.index ? indexAt(s.indexValues, d.index, OPEN_PERIOD) : undefined
                return (
                  <TableRow key={d.id} className="h-10 align-top text-[13px]">
                    <TableCell>{d.driver}<div className="font-mono text-xs text-muted-foreground">{d.id}</div></TableCell>
                    <TableCell>{d.unit}</TableCell>
                    <TableCell className="tabular text-right font-medium">{fmtMoney(cur.rate)}</TableCell>
                    <TableCell>{fmtDate(cur.validFrom)}<div className="text-xs text-muted-foreground">{cur.note}</div></TableCell>
                    <TableCell className="tabular text-right">{prev ? fmtPct((cur.rate / prev.rate - 1) * 100) : <span className="text-muted-foreground">First version</span>}</TableCell>
                    <TableCell>{d.index ? <span>{d.index}<div className="text-xs text-muted-foreground">now {idx?.value ?? "n/a"} ({OPEN_PERIOD})</div></span> : <span className="text-muted-foreground">No</span>}</TableCell>
                    <TableCell>
                      <ul className="text-xs">
                        {sorted.map((x) => <li key={x.validFrom} className="tabular">{fmtDate(x.validFrom)}: {fmtMoney(x.rate)} · {userName(x.by)}</li>)}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => { setV({ rate: "", from: "", note: "" }); setDlg({ version: d }) }}>New dated version</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  )

  const templates = (
    <div className="flex flex-col gap-4">
      {s.driverTemplates.map((t) => (
        <section key={t.id} aria-label={t.family} className="rounded-lg border">
          <h2 className="flex items-center justify-between border-b px-4 py-2 text-sm font-semibold">
            {t.family}
            <Chip kind="design" note="Template quantities are seeded from the historical actuals named here">{t.historicalWos ? `${t.historicalWos} settled WOs` : "No settled WOs yet"}</Chip>
          </h2>
          <p className="px-4 pt-2 text-sm text-muted-foreground">{t.basis}</p>
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Template quantity</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.rows.map((r) => (
                <TableRow key={r.driver} className="h-8 text-[13px]">
                  <TableCell>{r.driver}</TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(r.qty)}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">The estimator starts a parametric estimate from the template and changes the quantities on <RecLink to="/costing/estimates">Cost estimates</RecLink>; labor hours per work center are priced by the released work center rates.</p>
    </div>
  )

  const estimates = drafts.length ? (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Estimate</TableHead>
          <TableHead>Basis</TableHead>
          <TableHead className="text-right">Driver-rate lines</TableHead>
          <TableHead className="text-right">Behind today's rate</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {drafts.map((c) => {
          const lines = c.items.filter((i) => i.source === "Driver rate")
          const behind = lines.filter((i) => {
            const d = s.driverRates.find((x) => x.family.startsWith("Power transformers") && ((i.ref === "RAW-TBD-CRGO23" && x.id === "DRV-001") || (i.ref === "RAW-TBD-CTC" && x.id === "DRV-002")))
            return d && Math.abs(currentRate(d).rate - i.rate) > 0.005
          }).length
          return (
            <TableRow key={c.id} className="h-8 text-[13px]">
              <TableCell><RecLink to={`/costing/estimates/${c.id}`}>{c.id}</RecLink> <StatusBadge kind="costEstimate" status={c.status} size="sm" /></TableCell>
              <TableCell>{c.basis}</TableCell>
              <TableCell className="tabular text-right">{lines.length}</TableCell>
              <TableCell className="tabular text-right">{behind}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" disabled={!behind || !!st.blockReason} title={st.blockReason ?? (behind ? undefined : "Already at today's rates")} onClick={() => report(refreshEstimateRates(c.id), (r) => `${r.lines} line(s) refreshed, ${fmtMoney(r.delta)} change`)}>
                  <RefreshCw aria-hidden="true" /> Refresh rates
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  ) : (
    <EmptyState title="No Draft estimate uses driver rates">A Released estimate locks its values (C-35); supersede it to start a Draft at today's rates.</EmptyState>
  )

  return (
    <>
      <ConfigPage
        effectiveDated
        header={{
          screenId: "FX-CST-DRIVER",
          title: "Parametric driver rates",
          description: "The rates a parametric ETO estimate multiplies the estimator's driver quantities by.",
          chips: (
            <>
              <Design note="Route and archetype are design values; the table is Book I I §3.1" />
              <Reading id="OQ-PF-28" />
            </>
          ),
          actions: (
            <>
              {st.menu}
              <CsvButton filename="driver-rates.csv" rows={s.driverRates.map((d) => ({ Driver: d.driver, Family: d.family, Unit: d.unit, Rate: currentRate(d).rate, EffectiveFrom: currentRate(d).validFrom }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg("add")} {...writeProps(st)}>
              <Plus aria-hidden="true" /> New driver
            </Button>
          ),
          children: st.banner,
        }}
        sections={SECTIONS}
        section={section}
        onSectionChange={setSection}
      >
        {st.loading ? <SkeletonTable cols={7} rows={6} /> : st.empty ? <EmptyState title="No driver rates">Add the first driver for a product family, for example core steel in $/kg.</EmptyState> : section === "rates" ? rateTable : section === "templates" ? templates : estimates}
      </ConfigPage>
      <DialogShell
        open={!!dlg && typeof dlg === "object"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg && typeof dlg === "object" ? `New dated version: ${dlg.version.driver}` : ""}
        confirmLabel="Add version"
        consequence="Adds a version from the effective date. Earlier versions stay as they are; Draft estimates pick the new rate when refreshed, Released ones keep theirs (C-35)."
        onConfirm={() => (dlg && typeof dlg === "object" ? st.guard() ?? report(addDriverVersion(dlg.version.id, Number(v.rate), v.from, v.note), (p) => `Version added (${p > 0 ? "+" : ""}${p}%)`) : null)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="dv-rate" type="number" label={`Rate per ${dlg && typeof dlg === "object" ? dlg.version.unit : ""}`} value={v.rate} onChange={(x) => setV({ ...v, rate: x })} />
          <TextField id="dv-from" type="date" label="Effective from" value={v.from} onChange={(x) => setV({ ...v, from: x })} />
          <div className="sm:col-span-2">
            <TextField id="dv-note" label="Basis note" value={v.note} onChange={(x) => setV({ ...v, note: x })} hint="For an index-linked driver, name the index value and conversion used." />
          </div>
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: the effective date must be after the current version, and the rate above zero.</p>}
      </DialogShell>
      <DialogShell
        open={dlg === "add"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="New driver"
        confirmLabel="Add driver"
        consequence="Adds a driver with its first dated version to a product family."
        onConfirm={() => st.guard() ?? report(addDriver({ driver: add.driver, unit: add.unit, family: add.family, rate: Number(add.rate), validFrom: add.from, index: add.index || undefined }), "Driver added")}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField id="nd-driver" label="Driver" value={add.driver} onChange={(x) => setAdd({ ...add, driver: x })} />
          <TextField id="nd-unit" label="Unit" value={add.unit} onChange={(x) => setAdd({ ...add, unit: x })} />
          <SelectField id="nd-fam" label="Product family" value={add.family} onChange={(x) => setAdd({ ...add, family: x })} options={families.map((f) => ({ value: f, label: f }))} />
          <TextField id="nd-rate" type="number" label="Rate" value={add.rate} onChange={(x) => setAdd({ ...add, rate: x })} />
          <TextField id="nd-from" type="date" label="Effective from" value={add.from} onChange={(x) => setAdd({ ...add, from: x })} />
        </div>
      </DialogShell>
    </>
  )
}
