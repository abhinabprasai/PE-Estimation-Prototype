// FX-QM-TESTIMPORT Test-set CSV import mapping, DEC-08 (Phase 2) [DOC:p.86 Part E §3] (asserted).
// Phase 1 is manual entry with an instrument ID; Phase 2 imports a CSV from the test-set software
// through a template mapping. The import is all or nothing: any row error rejects the file, every
// error is listed (and downloadable), and nothing is recorded. Imported rows go through the same
// checks as manual entry: open run, retest scope, characteristic type, calibrated instrument of
// the right class (E-QM-05). Readings: QT-R39.

import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { WizardPage } from "@/components/templates"
import { Chip, DataTable, KV, RulesPanel, type Column } from "@/components/patterns"
import { useSlice } from "@/store"
import { importX, validateImport, type ImportRow } from "../data/extra-actions"
import type { TestImportLog } from "../data/extra-types"
import { Pick, Reading, Section, report, userName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"
import { TODAY } from "@/data/shared"

export const IMPORT_TEMPLATES = [
  { id: "TS-TPL-01", name: "Resistance, ratio and insulation set", cols: ["char_no", "value", "instrument"] },
  { id: "TS-TPL-02", name: "Loss and impedance set", cols: ["Test No", "Reading", "Device"] },
  { id: "TS-TPL-03", name: "Oil tests set", cols: ["item", "result", "tester_id"] },
] as const

const RULES: [string, string, string][] = [
  ["TI-1", "Phase 1 is manual entry with the instrument ID; Phase 2 imports a CSV from the test-set software with a template mapping; Phase 3 is a direct interface.", "DOC:p.86 Part E §3"],
  ["TI-2", "Every captured value keeps its instrument ID, and the instrument must be in calibration (E-QM-05) and of the class the characteristic needs.", "DOC:p.86 Part E §3; Book I E §7"],
  ["TI-3", "The import is all or nothing: one bad row rejects the file and lists every error; nothing is recorded.", "README QT-R39"],
  ["TI-4", "Only quantitative characteristics are imported; attributive results (hipot withstand) are entered on the unit.", "README QT-R39"],
]

const SAMPLE_OK = (t: (typeof IMPORT_TEMPLATES)[number]) =>
  t.id === "TS-TPL-02"
    ? [t.cols.join(","), "4,4.05,CAL-0104", "5,6.55,CAL-0104", "13,0.47,CAL-0104", "14,5.30,CAL-0104", "15,30.40,CAL-0104"].join("\n")
    : t.id === "TS-TPL-01"
      ? [t.cols.join(","), "10,4800,CAL-0103", "11,5200,CAL-0103", "12,2.1,CAL-0103"].join("\n")
      : [t.cols.join(","), "8,58,CAL-0107", "16,12,CAL-0108"].join("\n")
const SAMPLE_BAD = (t: (typeof IMPORT_TEMPLATES)[number]) => [t.cols.join(","), "4,4.05,CAL-0104", "99,1.0,CAL-0104", "8,57,CAL-0107", "13,abc,CAL-0104", "14,5.30,CAL-0103"].join("\n")

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const split = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
  return { headers: lines.length ? split(lines[0]) : [], rows: lines.slice(1).map(split) }
}
const guess = (headers: string[], names: string[]) => headers.find((h) => names.includes(h.toLowerCase())) ?? ""

export function TestImport() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-TESTIMPORT")
  const nav = useNavigate()
  const units = s.finalTests.filter((f) => !f.finalResult)
  const openUnits = units.filter((f) => f.runs.length && !f.runs[f.runs.length - 1].outcome)
  const [unit, setUnit] = useState(openUnits[0]?.id ?? "")
  const [tpl, setTpl] = useState<string>(IMPORT_TEMPLATES[1].id)
  const [file, setFile] = useState({ name: "", text: "" })
  const [map, setMap] = useState({ no: "", value: "", ins: "" })
  const t = IMPORT_TEMPLATES.find((x) => x.id === tpl)!
  const parsed = useMemo(() => parseCsv(file.text), [file.text])
  const f = s.finalTests.find((x) => x.id === unit)
  const rows: ImportRow[] = useMemo(() => {
    const ni = parsed.headers.indexOf(map.no)
    const vi = parsed.headers.indexOf(map.value)
    const ii = parsed.headers.indexOf(map.ins)
    if (ni < 0 || vi < 0 || ii < 0) return []
    return parsed.rows.map((r) => ({ seq: Number(r[ni]), value: Number(r[vi]), instrument: r[ii] ?? "" }))
  }, [parsed, map])
  const errors = useMemo(() => (unit && rows.length ? validateImport(s, unit, rows, TODAY) : []), [s, unit, rows])
  const load = (name: string, text: string) => {
    setFile({ name, text })
    const h = parseCsv(text).headers
    setMap({ no: guess(h, ["char_no", "test no", "no", "item"]), value: guess(h, ["value", "reading", "result"]), ins: guess(h, ["instrument", "device", "tester_id", "instrument_id"]) })
  }
  const download = () => {
    const blob = new Blob([`Import log for ${file.name || "file"}\n${errors.join("\n")}\n`], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${file.name || "import"}-errors.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const histCols: Column<TestImportLog>[] = [
    { id: "id", header: "Import", value: (x) => x.id, mono: true },
    { id: "unit", header: "Unit", value: (x) => x.finalTestId, cell: (x) => <Link className="text-link underline-offset-4 hover:underline" to={`/quality/final-test/${x.finalTestId}`}>{x.finalTestId}</Link> },
    { id: "run", header: "Run", value: (x) => x.run, align: "right", mono: true },
    { id: "tpl", header: "Template", value: (x) => x.template },
    { id: "file", header: "File", value: (x) => x.fileName, mono: true },
    { id: "rows", header: "Rows recorded", value: (x) => x.recorded, align: "right", mono: true, cell: (x) => `${x.recorded} of ${x.rows}` },
    { id: "on", header: "On", value: (x) => x.on, mono: true, sortable: true },
    { id: "by", header: "By", value: (x) => userName(x.by) },
  ]
  return (
    <StateFrame
      ss={ss}
      title="Test-set CSV import"
      screenId="FX-QM-TESTIMPORT"
      entity="test imports"
      allowed="Test technician or Quality Manager"
      validation={["Choose a unit with an open test run.", "Map the three columns: characteristic number, value, instrument ID.", "Fix every row error: nothing is imported until the whole file is clean."]}
      conflict={{ what: "run 1 of IL-TBD-0352", mine: "Import 5 rows into run 1", theirs: "The technician entered characteristic 4 by hand at 10:14" }}
      degraded="Calibration status may be a few minutes old; the check is repeated when you import."
      header={{
        title: "Test-set CSV import",
        screenId: "FX-QM-TESTIMPORT",
        crumbs: [{ label: "Final Test and FTR", to: "/quality/final-test" }, { label: "CSV import" }],
        description: "Phase 2 of instrument integration: import results from the test-set software into the open run of a unit, through a template mapping. All or nothing, with the instrument checked on every row.",
        chips: <><Chip kind="design" note="DEC-08, Phase 2">Phase 2</Chip><Reading id="QT-R39" /></>,
      }}
    >
      <div className="flex flex-col gap-6">
        <WizardPage
          header={{ title: "Import into a test run", description: "Four steps. Nothing is recorded until the last one." }}
          finishLabel="Import results"
          consequence={`Records ${rows.length} result(s) into the open run of ${unit || "the unit"} with their instrument IDs, ambient and tester stamps. The run is not completed; complete it on the unit.`}
          onCancel={() => nav("/quality/final-test")}
          onFinish={() => {
            const r = importX.commit(unit, rows, { template: `${t.id} ${t.name}`, fileName: file.name || "pasted.csv" })
            if (!report(r, (v) => `${v.id} imported into run ${v.run}`)) return (r as { error: string }).error
            nav(`/quality/final-test/${unit}`)
            return null
          }}
          steps={[
            {
              id: "unit",
              title: "Unit and template",
              validate: () => (!unit ? "Choose a unit with an open run." : null),
              content: (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Pick id="ti-unit" label="Unit under test" value={unit} onChange={setUnit} options={openUnits.map((u) => ({ value: u.id, label: `${u.id} · ${u.serial} · run ${u.runs[u.runs.length - 1].run}` }))} placeholder="No unit has an open run" />
                  <Pick id="ti-tpl" label="Test-set template" value={tpl} onChange={(v) => setTpl(v)} options={IMPORT_TEMPLATES.map((x) => ({ value: x.id, label: `${x.id} · ${x.name}` }))} />
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Units without an open run ({units.length - openUnits.length}) are not listed: start a run on <Link className="text-link underline-offset-4 hover:underline" to="/quality/final-test">Final Test and FTR</Link> first.
                  </p>
                  {f && (
                    <dl className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
                      <KV k="Serial">{f.serial}</KV>
                      <KV k="Plan">{`${f.planId} rev ${f.planRev}`}</KV>
                      <KV k="Results so far">{`${f.runs[f.runs.length - 1]?.results.length ?? 0} of ${f.spec.length}`}</KV>
                      <KV k="Template columns">{t.cols.join(", ")}</KV>
                    </dl>
                  )}
                </div>
              ),
            },
            {
              id: "file",
              title: "File",
              validate: () => (!parsed.rows.length ? "The file has no data rows. Choose a CSV file or paste its content." : null),
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm font-medium" htmlFor="ti-file">CSV file</label>
                    <input id="ti-file" type="file" accept=".csv,text/csv" className="text-sm" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) load(fl.name, await fl.text()) }} />
                    <Button size="sm" variant="outline" onClick={() => load(`${f?.serial ?? "unit"}_${t.id.toLowerCase()}.csv`, SAMPLE_OK(t))}>Use a clean sample file</Button>
                    <Button size="sm" variant="outline" onClick={() => load(`${f?.serial ?? "unit"}_${t.id.toLowerCase()}_errors.csv`, SAMPLE_BAD(t))}>Use a sample with errors</Button>
                  </div>
                  <Textarea aria-label="CSV content" rows={8} className="font-mono text-xs" value={file.text} onChange={(e) => load(file.name || "pasted.csv", e.target.value)} placeholder={t.cols.join(",")} />
                  <p className="text-xs text-muted-foreground">{parsed.rows.length} data row(s), {parsed.headers.length} column(s){file.name ? ` in ${file.name}` : ""}.</p>
                </div>
              ),
            },
            {
              id: "map",
              title: "Map columns",
              validate: () => {
                if (!map.no || !map.value || !map.ins) return "Map the characteristic number, the value and the instrument ID."
                if (new Set([map.no, map.value, map.ins]).size < 3) return "Each target needs a different column."
                return null
              },
              content: (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Pick id="map-no" label="Characteristic number" value={map.no} onChange={(v) => setMap({ ...map, no: v })} options={parsed.headers} />
                  <Pick id="map-val" label="Value" value={map.value} onChange={(v) => setMap({ ...map, value: v })} options={parsed.headers} />
                  <Pick id="map-ins" label="Instrument ID (CAL label)" value={map.ins} onChange={(v) => setMap({ ...map, ins: v })} options={parsed.headers} />
                  <p className="text-xs text-muted-foreground sm:col-span-3">Pre-filled from the template headers. The characteristic number is the sequence on the unit's plan (1 to {f?.spec.length ?? 16}).</p>
                </div>
              ),
            },
            {
              id: "review",
              title: "Review",
              validate: () => (errors.length ? `${errors.length} error(s): the file cannot be imported. Fix the file or the mapping and go back.` : !rows.length ? "Nothing to import." : null),
              content: (
                <div className="flex flex-col gap-3 text-sm">
                  {errors.length ? (
                    <div role="alert" className="rounded-md border border-destructive p-3">
                      <p className="font-semibold text-destructive">{errors.length} error(s). Nothing is imported until the whole file is clean.</p>
                      <ul className="mt-2 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
                      <Button size="sm" variant="outline" className="mt-2" onClick={download}>Download the error log</Button>
                    </div>
                  ) : (
                    <p className="rounded-md bg-muted p-3">All {rows.length} row(s) pass: characteristic on the plan, numeric, instrument calibrated and of the right class.</p>
                  )}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full">
                      <thead className="bg-table-head text-left"><tr><th className="p-2">Characteristic</th><th className="p-2">Value</th><th className="p-2">Instrument</th></tr></thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const c = f?.spec.find((x) => x.seq === r.seq)
                          return <tr key={i} className="border-t"><td className="p-2">{c ? `${r.seq} · ${c.name}` : `${r.seq} (not on the plan)`}</td><td className="tabular p-2">{Number.isNaN(r.value) ? "not a number" : `${r.value}${c?.uom ? ` ${c.uom}` : ""}`}</td><td className="p-2">{r.instrument}</td></tr>
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            },
          ]}
        />
        <Section title="Import history">
          <DataTable rows={s.testImports} columns={histCols} rowId={(x) => x.id} empty={{ title: "No imports yet" }} />
        </Section>
        <RulesPanel rules={RULES} />
      </div>
    </StateFrame>
  )
}
