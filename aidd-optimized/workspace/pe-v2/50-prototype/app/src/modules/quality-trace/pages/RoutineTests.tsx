// FX-QM-ROUTINE Transformer routine-test capture forms, nine types [DOC:p.86 Part E §3] (asserted).
// Capture templates render instrument-friendly entry forms with automatic pass/fail against the
// unit's design values: winding resistance, turns ratio and polarity, insulation resistance,
// no-load loss and excitation current, load loss and impedance, applied voltage (hipot), induced
// voltage with PD, oil tests, temperature rise (type test, when ordered). Every captured set
// stores instrument IDs, ambient conditions, tester badge and timestamps, which print on the FTR.
// The forms write into the open run of the unit's final test (QM-FIN-001) through the same
// action as manual entry, so the calibration interlock (E-QM-05) applies unchanged.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DetailPage } from "@/components/templates"
import { Chip, KV, RulesPanel, ScanField, type ScanOutcome } from "@/components/patterns"
import { useSlice } from "@/store"
import { fin } from "../data/actions"
import { charOutcome, fmtBounds } from "../data/derive"
import type { FinalTest, QtCharacteristic } from "../data/types"
import { Outcome, Pick, Reading, Section, report, userName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

type Vals = Record<string, string>
interface FieldDef { key: string; label: string; unit?: string; kind?: "number" | "text" | "pass" }
interface OutDef { seq: number; label: string; compute: (v: Vals) => number | "Pass" | "Fail" | undefined }
interface TypeDef { id: string; title: string; method: string; fields: FieldDef[]; outs: OutDef[]; hint: string; criteria: string }

const n = (v: string | undefined) => (v == null || v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v))
const mean = (xs: (number | undefined)[]) => (xs.every((x) => x != null) ? Math.round((xs as number[]).reduce((a, b) => a + b, 0) / xs.length * 100) / 100 : undefined)
const round = (x: number | undefined, d = 3) => (x == null ? undefined : Math.round(x * 10 ** d) / 10 ** d)

export const TYPES: TypeDef[] = [
  {
    id: "wr", title: "Winding resistance", method: "IEEE C57.12.90 §5",
    hint: "R per phase per tap (mΩ) and winding temperature; the average per phase is compared with the design sheet.",
    criteria: "Design sheet with tolerances (±2% reading QT-R24)",
    fields: [{ key: "tap", label: "Tap position", kind: "text" }, { key: "temp", label: "Winding temperature", unit: "°C" }, { key: "a", label: "R phase A", unit: "mΩ" }, { key: "b", label: "R phase B", unit: "mΩ" }, { key: "c", label: "R phase C", unit: "mΩ" }],
    outs: [{ seq: 1, label: "Mean R per phase", compute: (v) => mean([n(v.a), n(v.b), n(v.c)]) }],
  },
  {
    id: "tr", title: "Turns ratio and polarity", method: "IEEE C57.12.90 §6",
    hint: "Ratio deviation per tap per phase (%). The largest deviation is compared with the limit; polarity is recorded.",
    criteria: "±0.5% of the nameplate ratio",
    fields: [{ key: "tap", label: "Tap position", kind: "text" }, { key: "a", label: "Deviation phase A", unit: "%" }, { key: "b", label: "Deviation phase B", unit: "%" }, { key: "c", label: "Deviation phase C", unit: "%" }, { key: "pol", label: "Polarity", kind: "pass" }],
    outs: [{ seq: 2, label: "Largest deviation", compute: (v) => { const x = [n(v.a), n(v.b), n(v.c)]; return x.every((y) => y != null) && v.pol === "Pass" ? (x as number[]).reduce((m, y) => (Math.abs(y) > Math.abs(m) ? y : m), 0) : undefined } }],
  },
  {
    id: "ir", title: "Insulation resistance", method: "IEEE C57.12.90",
    hint: "HV-LV, HV-G, LV-G at 1 minute, and the 10-minute HV-LV reading; the polarization index is calculated.",
    criteria: "Plan minimums",
    fields: [{ key: "hvlv", label: "HV-LV+G, 1 min", unit: "MΩ" }, { key: "hvg", label: "HV-G, 1 min", unit: "MΩ" }, { key: "lvg", label: "LV-G, 1 min", unit: "MΩ" }, { key: "hv10", label: "HV-LV+G, 10 min", unit: "MΩ" }],
    outs: [{ seq: 3, label: "HV-LV", compute: (v) => n(v.hvlv) }, { seq: 10, label: "HV-G", compute: (v) => n(v.hvg) }, { seq: 11, label: "LV-G", compute: (v) => n(v.lvg) }, { seq: 12, label: "Polarization index", compute: (v) => (n(v.hvlv) && n(v.hv10) ? round(n(v.hv10)! / n(v.hvlv)!, 2) : undefined) }],
  },
  {
    id: "nl", title: "No-load loss and excitation current", method: "IEEE C57.12.90 §8",
    hint: "Watts at 100% and 110% voltage, and excitation current as %I.",
    criteria: "Design guarantee ± IEEE tolerance (loss up to the guarantee +10% for a single unit)",
    fields: [{ key: "l100", label: "No-load loss at 100% V", unit: "kW" }, { key: "l110", label: "No-load loss at 110% V", unit: "kW" }, { key: "i0", label: "Excitation current", unit: "%I" }],
    outs: [{ seq: 4, label: "Loss at 100% V", compute: (v) => n(v.l100) }, { seq: 14, label: "Loss at 110% V", compute: (v) => n(v.l110) }, { seq: 13, label: "Excitation current", compute: (v) => n(v.i0) }],
  },
  {
    id: "ll", title: "Load loss and impedance", method: "IEEE C57.12.90 §9",
    hint: "Load loss at rated current and %Z at the 85 °C reference.",
    criteria: "Guarantee tolerance; %Z ±7.5% (two-winding)",
    fields: [{ key: "ll", label: "Load loss at rated current", unit: "kW" }, { key: "z", label: "Impedance at 85 °C", unit: "%Z" }],
    outs: [{ seq: 15, label: "Load loss", compute: (v) => n(v.ll) }, { seq: 5, label: "Impedance %Z", compute: (v) => n(v.z) }],
  },
  {
    id: "hp", title: "Applied voltage (hipot)", method: "IEEE C57.12.90 §10",
    hint: "Test voltage, duration and the withstand result.",
    criteria: "Withstand (attributive)",
    fields: [{ key: "kv", label: "Test voltage", unit: "kV" }, { key: "dur", label: "Duration", unit: "s" }, { key: "res", label: "Withstand result", kind: "pass" }],
    outs: [{ seq: 6, label: "Withstand", compute: (v) => (v.res === "Pass" || v.res === "Fail" ? v.res : undefined) }],
  },
  {
    id: "iv", title: "Induced voltage with PD", method: "IEEE C57.12.90 §10.7",
    hint: "Voltage, frequency, duration and partial discharge (pC) where required.",
    criteria: "Withstand and PD limits (250 pC)",
    fields: [{ key: "kv", label: "Test voltage", unit: "kV" }, { key: "hz", label: "Frequency", unit: "Hz" }, { key: "dur", label: "Duration", unit: "s" }, { key: "pd", label: "Partial discharge", unit: "pC" }, { key: "res", label: "Withstand result", kind: "pass" }],
    outs: [{ seq: 7, label: "PD / withstand", compute: (v) => (v.pd !== undefined && n(v.pd) != null ? n(v.pd) : v.res === "Pass" || v.res === "Fail" ? v.res : undefined) }],
  },
  {
    id: "oil", title: "Oil tests", method: "ASTM D877 / D1533",
    hint: "Dielectric breakdown voltage and moisture content.",
    criteria: "Plan minimums (BDV 30 kV, moisture 35 ppm)",
    fields: [{ key: "bdv", label: "BDV", unit: "kV" }, { key: "h2o", label: "Moisture", unit: "ppm" }],
    outs: [{ seq: 8, label: "BDV", compute: (v) => n(v.bdv) }, { seq: 16, label: "Moisture", compute: (v) => n(v.h2o) }],
  },
  {
    id: "tru", title: "Temperature rise (type test)", method: "IEEE C57.12.90 §11",
    hint: "Top-oil and average winding rise (K). Only when the order asks for a type test.",
    criteria: "Rating (65 K standard)",
    fields: [{ key: "oil", label: "Top-oil rise", unit: "K" }, { key: "wdg", label: "Average winding rise", unit: "K" }],
    outs: [{ seq: 9, label: "Average winding rise", compute: (v) => n(v.wdg) }],
  },
]

const RULES: [string, string, string][] = [
  ["RT-1", "The Final Test plan standardizes nine routine test types; capture templates give instrument-friendly entry with automatic pass/fail against the unit's design values.", "DOC:p.86 Part E §3"],
  ["RT-2", "Every captured set stores instrument IDs, ambient conditions, tester badge and timestamps; all of them print on the FTR.", "DOC:p.86 Part E §3"],
  ["RT-3", "Phase 1 is manual entry with an instrument ID checked against calibration; an Overdue or Out of Service instrument blocks the entry (E-QM-05).", "DOC:p.86 Part E §3; Book I E §7"],
  ["RT-4", "Temperature rise is a type test: it appears only for units whose order asks for it.", "DOC:p.86 Part E §3"],
]

const PREFILL: Record<string, Record<string, number>> = {
  ir: { hvlv: 3, hvg: 10, lvg: 11 }, nl: { l100: 4, l110: 14, i0: 13 }, ll: { ll: 15, z: 5 }, hp: { res: 6 }, iv: { pd: 7 }, oil: { bdv: 8, h2o: 16 }, tru: { wdg: 9 },
}

const outcomeFor = (c: QtCharacteristic | undefined, v: number | "Pass" | "Fail" | undefined) =>
  !c || v === undefined ? undefined : charOutcome(c, typeof v === "number" ? { seq: c.seq, value: v } : { seq: c.seq, attr: v })

export function RoutineTests() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-ROUTINE")
  const [params, setParams] = useSearchParams()
  const withRuns = s.finalTests.filter((f) => f.runs.length || !f.finalResult)
  const unitId = params.get("unit") ?? s.finalTests.find((f) => f.runs.length && !f.finalResult && !f.runs[f.runs.length - 1].outcome)?.id ?? withRuns[0]?.id ?? ""
  const f = s.finalTests.find((x) => x.id === unitId)
  const setUnit = (id: string) => (params.set("unit", id), setParams(params, { replace: true }))
  const run = f?.runs[f.runs.length - 1]
  const open = !!f && !f.finalResult && !!run && !run.outcome
  return (
    <StateFrame
      ss={ss}
      title="Routine-test capture forms"
      screenId="FX-QM-ROUTINE"
      entity="routine test records"
      allowed="Test technician or Quality Manager"
      validation={["Scan a calibrated instrument of the class this test needs (SP-14).", "Enter every value of the test before you save it."]}
      conflict={{ what: "run 1 of this unit", mine: "Save the oil tests", theirs: "Another session saved the BDV 20 minutes ago" }}
      degraded="Calibration status may be a few minutes old; the interlock is checked again on save."
      header={{
        title: "Routine-test capture forms",
        screenId: "FX-QM-ROUTINE",
        crumbs: [{ label: "Final Test and FTR", to: "/quality/final-test" }, { label: "Routine tests" }],
        description: "Nine transformer routine tests, each with an entry form that checks every value against the unit's design values as you type. Saved values go into the open run of the unit's final test.",
        chips: <Reading id="QT-R44" />,
      }}
    >
      {!f ? (
        <p className="text-sm text-muted-foreground">No unit is in final test.</p>
      ) : (
        <Unit key={f.id} f={f} open={open} unitId={unitId} units={withRuns} setUnit={setUnit} locked={ss.locked} />
      )}
    </StateFrame>
  )
}

function Unit({ f, open, unitId, units, setUnit, locked }: { f: FinalTest; open: boolean; unitId: string; units: FinalTest[]; setUnit: (id: string) => void; locked: boolean }) {
  const run = f.runs[f.runs.length - 1]
  const [vals, setVals] = useState<Record<string, Vals>>({})
  const bound = useMemo(() => (run ? run.instruments : []), [run])
  const s = useSlice("qualityTrace")
  const bind = (code: string): ScanOutcome => {
    const r = fin.bindInstrument(f.id, code)
    return r.ok ? { ok: true, message: `${r.value?.label} ${r.value?.type} bound to run ${run?.run}.` } : { ok: false, errorCode: r.error.includes("E-QM-05") ? "E-QM-05" : undefined, expected: "the CAL label of a calibrated instrument", next: "Use another instrument of the same class or have it calibrated.", message: r.error }
  }
  const scopeSeqs = run?.retestScope
  const recorded = (seq: number) => run?.results.find((x) => x.seq === seq)
  const seed = (t: TypeDef): Vals => {
    // prefill from the results the run already holds, by field
    const v: Vals = {}
    for (const [key, seq] of Object.entries(PREFILL[t.id] ?? {})) {
      const r = recorded(seq)
      if (r?.value != null) v[key] = String(r.value)
      else if (r?.attr && (r.attr === "Pass" || r.attr === "Fail")) v[key] = r.attr
    }
    return v
  }
  const typeFor = (t: TypeDef) => t.outs.some((o) => f.spec.some((c) => c.seq === o.seq))
  const tabs = TYPES.map((t, i) => {
    const present = typeFor(t)
    const outs = t.outs.filter((o) => f.spec.some((c) => c.seq === o.seq))
    const done = outs.length > 0 && outs.every((o) => recorded(o.seq))
    return {
      id: t.id,
      label: `${i + 1}. ${t.title.split(" (")[0]}`,
      count: undefined,
      content: !present ? (
        <Section title={t.title}>
          <p className="text-sm">This test is not on this unit's plan{t.id === "tru" ? ": the order does not ask for a type test" : ""}.</p>
        </Section>
      ) : (
        <TestForm key={`${f.id}-${t.id}-${run?.run}-${run?.results.length}`} t={t} f={f} open={open} locked={locked} vals={vals[t.id] ?? seed(t)} setVals={(v) => setVals({ ...vals, [t.id]: v })} done={done} inScope={!scopeSeqs || outs.some((o) => scopeSeqs.includes(o.seq))} />
      ),
    }
  })
  const classes = [...new Set(f.spec.filter((c) => c.instrumentClass).map((c) => c.instrumentClass!))]
  const ins = bound.map((id) => s.instruments.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x)
  return (
    <DetailPage
      header={{
        title: `${f.serial} · ${f.id}`,
        description: `${f.nameplate.mva}, ${f.nameplate.voltage}, ${f.nameplate.cooling}, Z ${f.nameplate.impedance}. Plan ${f.planId} rev ${f.planRev}.`,
        actions: <Pick id="rt-unit" value={unitId} onChange={setUnit} options={units.map((u) => ({ value: u.id, label: `${u.id} · ${u.serial}` }))} placeholder="Choose a unit" />,
        primary: <Button asChild><Link to={`/quality/final-test/${f.id}`}>Open the final test</Link></Button>,
        chips: f.finalResult ? <Chip kind="design" note="The final result is recorded; nothing can be captured">Read-only</Chip> : !open ? <Chip kind="flag">No open run</Chip> : <Chip kind="design">{`Run ${run.run}`}</Chip>,
      }}
      summary={
        <>
          <KV k="Plan">{`${f.planId} rev ${f.planRev}`}</KV>
          <KV k="Ambient conditions">{run?.ambient ?? "Recorded when a run starts"}</KV>
          <KV k="Tester badge">{run ? userName(run.testerId) : "Not started"}</KV>
          <KV k="Sessions">{run ? run.sessions.join(", ") : "None"}</KV>
          <KV k="Instruments bound">{ins.length ? ins.map((i) => i.label).join(", ") : "None yet"}</KV>
          <KV k="Final result">{f.finalResult ?? "Open"}</KV>
        </>
      }
      defaultTab="wr"
      tabs={[
        ...tabs,
        {
          id: "inst", label: "Instruments",
          content: (
            <div className="flex flex-col gap-4">
              {open ? <ScanField scanPoint="SP-14" expected="Scan each instrument's CAL label before capturing" onScan={bind} label="Instrument CAL label" /> : <p className="text-sm text-muted-foreground">Start a run on the final test to bind instruments.</p>}
              <p className="text-sm">Classes this unit's tests need: {classes.join(", ")}.</p>
              <ul className="text-sm">
                {ins.map((i) => <li key={i.id}>{i.label} · {i.name} ({i.type}) · {i.status}</li>)}
                {!ins.length && <li className="text-muted-foreground">No instrument is bound to the run.</li>}
              </ul>
            </div>
          ),
        },
        { id: "rules", label: "Rules", content: <RulesPanel rules={RULES} /> },
      ]}
    />
  )
}

function TestForm({ t, f, open, locked, vals, setVals, done, inScope }: { t: TypeDef; f: FinalTest; open: boolean; locked: boolean; vals: Vals; setVals: (v: Vals) => void; done: boolean; inScope: boolean }) {
  const outs = t.outs.filter((o) => f.spec.some((c) => c.seq === o.seq))
  const run = f.runs[f.runs.length - 1]
  const computed = outs.map((o) => ({ o, c: f.spec.find((c) => c.seq === o.seq)!, v: o.compute(vals) }))
  const need = [...new Set(computed.map((x) => x.c.instrumentClass).filter(Boolean))] as string[]
  const sl = useSlice("qualityTrace")
  const missing = open ? need.filter((cl) => !run.instruments.some((id) => sl.instruments.find((i) => i.id === id)?.type === cl)) : []
  const [err, setErr] = useState<string | null>(null)
  const disabled = !open || locked || !inScope
  const save = () => {
    setErr(null)
    const ready = computed.filter((x) => x.v !== undefined)
    if (!ready.length) return setErr("Enter the values of this test first.")
    for (const x of ready) {
      const r = fin.record(f.id, x.o.seq, typeof x.v === "number" ? { value: x.v } : { attr: x.v as "Pass" | "Fail" })
      if (!r.ok) return setErr(r.error)
    }
    report({ ok: true as const, value: null }, `${t.title} saved to run ${run.run}`)
  }
  return (
    <div className="flex flex-col gap-4">
      <Section title={`${t.title} · ${t.method}`} action={done ? <Chip kind="design">Recorded in this run</Chip> : undefined}>
        <p className="text-sm text-muted-foreground">{t.hint} Criteria: {t.criteria}.</p>
        {!inScope && <p className="text-sm">Outside this retest's scope: only the failed characteristics are tested again.</p>}
        <fieldset disabled={disabled} className="grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {t.fields.map((fd) =>
            fd.kind === "pass" ? (
              <Pick key={fd.key} id={`${t.id}-${fd.key}`} label={fd.label} value={(vals[fd.key] as "Pass" | "Fail") ?? ""} onChange={(v) => setVals({ ...vals, [fd.key]: v })} options={["Pass", "Fail"] as ("Pass" | "Fail")[]} />
            ) : (
              <div key={fd.key} className="flex flex-col gap-1">
                <Label htmlFor={`${t.id}-${fd.key}`}>{fd.label}{fd.unit ? ` (${fd.unit})` : ""}</Label>
                <Input id={`${t.id}-${fd.key}`} className="h-9 tabular" inputMode={fd.kind === "text" ? undefined : "decimal"} value={vals[fd.key] ?? ""} onChange={(e) => setVals({ ...vals, [fd.key]: e.target.value })} />
              </div>
            ),
          )}
        </fieldset>
      </Section>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left"><tr><th className="p-2">Result</th><th className="p-2">Entered</th><th className="p-2">Design value / limit</th><th className="p-2">Pass / fail</th><th className="p-2">In the run</th></tr></thead>
          <tbody>
            {computed.map(({ o, c, v }) => {
              const rec = run?.results.find((x) => x.seq === o.seq)
              return (
                <tr key={o.seq} className="border-t">
                  <td className="p-2">{o.label} <span className="text-xs text-muted-foreground">(characteristic {o.seq})</span></td>
                  <td className="tabular p-2">{v === undefined ? "" : `${v}${typeof v === "number" && c.uom ? ` ${c.uom}` : ""}`}</td>
                  <td className="p-2">{fmtBounds(c)}{c.instrumentClass ? ` · ${c.instrumentClass}` : ""}</td>
                  <td className="p-2"><Outcome value={outcomeFor(c, v)} /></td>
                  <td className="tabular p-2">{rec ? `${rec.value ?? rec.attr}${rec.value != null && c.uom ? ` ${c.uom}` : ""}` : ""}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {missing.length > 0 && <p className="text-sm text-destructive" role="status">Bind a calibrated {missing.join(" and ")} instrument on the Instruments tab (SP-14) before you save.</p>}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disabled} onClick={save}>Save {t.title.split(" (")[0].toLowerCase()}</Button>
        {!open && <span className="text-sm text-muted-foreground">{f.finalResult ? "The final result is recorded: read-only." : "Start a run on the final test first."}</span>}
      </div>
    </div>
  )
}
