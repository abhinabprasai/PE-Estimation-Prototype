// FX-BC-RELABEL Identify and Relabel, mobile flow on the Zebra TC77 [DOC:p.97 Part F "Unlabeled stock
// exception"] (asserted): found stock without a label. A supervisor scans the bin, the flow resolves
// the stock against the expected inventory of that bin, prints the label and logs the exception,
// which feeds the count-accuracy metric. KioskPage with the task area at the handheld width.

import { useRef, useState } from "react"
import { Link } from "react-router"
import { KioskPage, KioskFact } from "@/components/templates"
import { ErrorAlert, ScanField, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRole, useSlice } from "@/store"
import { USERS } from "@/data/shared"
import { materialText } from "../components/bits"
import { HandheldFrame } from "../components/handheld"
import { StateFrame, useScreenState } from "../components/states"
import { relabelX } from "../data/extra-actions"
import { cn } from "@/lib/utils"

type Step = "bin" | "match" | "done"

export function Relabel() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-BC-RELABEL")
  const [role] = useRole()
  const supervisor = role === "Warehouse supervisor" || role === "Production supervisor"
  const operator = USERS.find((u) => u.roles.includes(role))?.name
  const [step, setStep] = useState<Step>("bin")
  const [bin, setBin] = useState("")
  const [line, setLine] = useState<number | "none" | null>(null)
  const [qty, setQty] = useState("")
  const [note, setNote] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; matched: boolean; batchId?: string } | null>(null)
  const scanRef = useRef<ScanFieldHandle>(null)
  const online = s.printers.filter((p) => p.active && (!p.health || p.health === "Online"))
  const printer = online.find((p) => p.labelTypes.includes("Batch label"))?.id ?? online[0]?.id ?? ""
  const expected = s.binExpected.find((b) => b.bin === bin)
  const thisMonth = s.relabels.filter((r) => r.on.slice(0, 7) === "2026-10")
  const unmatched = thisMonth.filter((r) => !r.batchId).length

  const onScan = (code: string): ScanOutcome => {
    const c = code.trim().toUpperCase()
    const b = s.binExpected.find((x) => x.bin === c)
    if (!b) return { ok: false, expected: "A bin label such as BIN-TBD-F-02-01", next: `${c} is not a known bin. Rescan the bin label, or check the list under the scan field.`, message: `Scanned ${c}` }
    setBin(b.bin)
    setLine(null)
    setQty("")
    setErr(null)
    setStep("match")
    return { ok: true, message: `Bin ${b.bin}: ${b.lines.length} expected stock line(s)` }
  }
  const submit = () => {
    setErr(null)
    const r = relabelX.resolve({ bin, lineIndex: line === "none" || line == null ? null : line, qty: Number(qty), printerId: printer, note })
    if (!r.ok) return setErr(r.error)
    setResult(r.value)
    setStep("done")
  }
  const reset = () => {
    setStep("bin")
    setBin("")
    setLine(null)
    setQty("")
    setNote("")
    setResult(null)
    setErr(null)
    setTimeout(() => scanRef.current?.focus(), 0)
  }

  return (
    <KioskPage
      title="Identify and Relabel"
      screenId="FX-BC-RELABEL"
      operator={operator}
      station="Handheld TC77"
      online={ss.state !== "offline"}
      queued={3}
      exitTo="/configuration/barcode"
      banners={err ? <ErrorAlert title="Could not log the relabel" onDismiss={() => setErr(null)}>{err}</ErrorAlert> : undefined}
      scan={
        step === "bin" && supervisor && !ss.locked ? (
          <ScanField ref={scanRef} scanPoint="SP-20" expected="Scan the bin label where you found unlabeled stock" onScan={onScan} label="Bin label" />
        ) : undefined
      }
      actions={
        step === "match" && supervisor
          ? [
              { label: result ? "Done" : line === "none" ? "Log count exception" : "Print label and log", primary: true, onClick: submit, disabled: ss.locked || line == null || !Number(qty) },
              { label: "Change bin", onClick: reset },
            ]
          : step === "done"
            ? [{ label: "Relabel more stock", primary: true, onClick: reset }]
            : []
      }
    >
      <StateFrame ss={ss} bare title="Identify and Relabel" screenId="FX-BC-RELABEL" entity="relabel records" allowed="Warehouse supervisor or Production supervisor" validation={["Choose which expected stock line the found stock matches.", "Enter the quantity found."]} conflict={{ what: `stock of ${bin || "BIN-TBD-F-02-01"}`, mine: "Match to BAT-TBD-K0602, 188 kg", theirs: "A count posted 12 minutes ago set this bin to 176 kg" }} degraded="Printing is delayed: the batch label printer answers slowly, labels may take about a minute.">
        {!supervisor ? (
          <ErrorAlert title="Identify and Relabel is a supervisor flow">
            Found stock without a label is resolved by a Warehouse supervisor or Production supervisor. You are acting as {role}. Switch "Acting as" to continue.
          </ErrorAlert>
        ) : (
          <HandheldFrame>
            {step === "bin" && (
              <div className="flex flex-col gap-4">
                <p className="text-base">Found stock without a label? Scan the bin it is in. The flow checks what the system expects there.</p>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Bins on this floor</span>
                  {s.binExpected.map((b) => (
                    <span key={b.bin} className="tabular">{b.bin} · {b.lines.length ? b.lines.map((l) => l.batchId).join(", ") : "empty"}</span>
                  ))}
                </div>
                <KioskFact label="Unlabeled-stock exceptions this month">{thisMonth.length} ({unmatched} with no match)</KioskFact>
              </div>
            )}
            {step === "match" && expected && (
              <div className="flex flex-col gap-4">
                <KioskFact label="Bin">{expected.bin}</KioskFact>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-base font-medium">What matches the stock you found?</legend>
                  {expected.lines.map((l, i) => (
                    <label key={l.batchId} className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 text-base", line === i && "border-primary bg-muted")}>
                      <input type="radio" name="match" className="mt-1 size-5" checked={line === i} onChange={() => setLine(i)} />
                      <span>
                        <span className="block font-medium">{l.batchId}</span>
                        <span className="block text-sm text-muted-foreground">{materialText(l.materialId)} · expected {l.qty.toLocaleString("en-US")} {l.uom}</span>
                      </span>
                    </label>
                  ))}
                  <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-base", line === "none" && "border-primary bg-muted")}>
                    <input type="radio" name="match" className="size-5" checked={line === "none"} onChange={() => setLine("none")} />
                    <span>None of these{!expected.lines.length ? " (the bin should be empty)" : ""}</span>
                  </label>
                </fieldset>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="rl-qty" className="text-base">Quantity found</Label>
                  <Input id="rl-qty" inputMode="decimal" className="h-12 text-lg" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="rl-note" className="text-base">Note (optional)</Label>
                  <Input id="rl-note" className="h-12 text-base" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                {line !== "none" && <p className="text-sm text-muted-foreground">The label prints on {printer || "no online printer"} and the exception is logged.</p>}
                {line === "none" && <p className="text-sm text-muted-foreground">No label is printed. The stock goes to the count team as an exception.</p>}
              </div>
            )}
            {step === "done" && result && (
              <div className="flex flex-col gap-3">
                <KioskFact label={result.matched ? "Label printed" : "Count exception logged"}>{result.matched ? result.batchId : result.id}</KioskFact>
                <p className="text-base">{result.matched ? `Stock resolved to ${result.batchId} in ${bin}. Exception ${result.id} is logged and feeds the count-accuracy metric.` : `Nothing in ${bin} matches. ${result.id} is logged for the count team.`}</p>
                <Link className="text-link underline-offset-4 hover:underline" to="/configuration/barcode?s=telemetry">See the scan in telemetry</Link>
              </div>
            )}
          </HandheldFrame>
        )}
      </StateFrame>
    </KioskPage>
  )
}
