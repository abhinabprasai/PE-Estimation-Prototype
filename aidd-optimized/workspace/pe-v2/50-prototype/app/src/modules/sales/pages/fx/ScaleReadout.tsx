// FX-OM-SCALE Pack station live scale readout (/sales/dialogs/scale-readout) [DOC:p.32 §5.3; IF-20; DEC-08].
// The scale integration feeds a gross weight; the HU closes only when it is within ±2% of the expected weight
// (SP-17). Three device states: connected (live, stable detection), error (no signal: manual entry with a
// supervisor badge, flagged on the HU) and stale (last reading too old to trust: re-read first).
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { Radio, TriangleAlert, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { useSlice } from "@/store"
import { kg, type HU } from "../../data/model"
import { useStore } from "../../data/store"
import { manualWeight } from "../../fx/actions"
import { Reading } from "../../components/ext"
import { DialogPage, Inline, PickField, TextField, useFxState } from "./kit"

export type ScaleState = "connected" | "error" | "stale"
export function useScaleState(): [ScaleState, (s: ScaleState) => void] {
  const [sp, setSp] = useSearchParams()
  const raw = sp.get("scale")
  const s: ScaleState = raw === "error" || raw === "stale" ? raw : "connected"
  return [s, (v) => setSp((p) => { const n = new URLSearchParams(p); if (v === "connected") n.delete("scale"); else n.set("scale", v); return n }, { replace: true })]
}

/** The readout block: used on the pack station and in the dialog. `touch` enlarges targets for the kiosk. */
export function ScaleReadout({ hu, state, setState, touch, onTaken }: { hu: HU; state: ScaleState; setState?: (s: ScaleState) => void; touch?: boolean; onTaken?: (text: string) => void }) {
  const { actions } = useStore()
  const [live, setLive] = useState(0)
  const [stable, setStable] = useState(0)
  const last = useRef(0)
  const [age, setAge] = useState(state === "stale" ? 42 : 0)
  const [err, setErr] = useState<{ text: string } | null>(null)
  const [kgIn, setKgIn] = useState("")
  const [reason, setReason] = useState("")
  const [badge, setBadge] = useState("")
  const lo = Math.round(hu.expectedKg * 0.98)
  const hi = Math.round(hu.expectedKg * 1.02)
  useEffect(() => {
    if (state !== "connected") return
    let n = 0
    const t = setInterval(() => {
      n++
      const target = hu.actualKg ?? Math.round(hu.expectedKg * 0.9985)
      const v = n < 4 ? Math.round(target * (0.94 + n * 0.015)) : target
      setLive(v)
      setStable((x) => (v === last.current ? x + 1 : 1))
      last.current = v
    }, 700)
    return () => clearInterval(t)
  }, [state, hu.id, hu.actualKg, hu.expectedKg])
  useEffect(() => {
    if (state !== "stale") { setAge(0); return }
    setAge(42)
    const t = setInterval(() => setAge((a) => a + 1), 1000)
    return () => clearInterval(t)
  }, [state])
  const shown = state === "connected" ? live : hu.actualKg ?? 0
  const within = shown >= lo && shown <= hi
  const btn = touch ? "h-12 text-base" : ""
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" aria-label="Scale readout">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Scale readout · SP-17 · IF-20</span>
        {state === "connected" && <span className="inline-flex items-center gap-1 rounded-lg border border-status-passed px-2 text-xs"><Radio className="size-3" aria-hidden="true" /> Connected{stable >= 3 ? ", stable" : ", settling"}</span>}
        {state === "error" && <span className="inline-flex items-center gap-1 rounded-lg border border-status-blocked px-2 text-xs text-status-cancelled-ink"><WifiOff className="size-3" aria-hidden="true" /> Error: no signal from the scale</span>}
        {state === "stale" && <span className="inline-flex items-center gap-1 rounded-lg border border-status-pending px-2 text-xs text-status-pending-ink"><TriangleAlert className="size-3" aria-hidden="true" /> Stale: last update {age} s ago</span>}
        <Chip kind="design" note="The PRD names the scale integration (IF-20, DEC-08) without a protocol or a stale limit. The 10 s stale limit is a design value.">Stale after 10 s</Chip>
      </div>
      <p className={`tabular text-3xl font-semibold ${state === "stale" ? "text-muted-foreground line-through decoration-1" : ""}`} aria-live="polite">{state === "error" ? "— kg" : shown ? kg(shown) : "— kg"}</p>
      <p className="text-sm">Expected {kg(hu.expectedKg)} · allowed ±2% ({kg(lo)} to {kg(hi)}){state !== "error" && shown ? (within ? " · within the limit" : " · outside the limit: HU cannot close") : ""}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={btn} disabled={hu.status !== "Open" || state !== "connected"} title={state !== "connected" ? "Needs a connected scale" : stable < 3 ? "The reading is still settling" : undefined} onClick={() => { const r = actions.nextReading(hu.id); if (r.ok) onTaken?.("Scale reading taken"); else setErr({ text: r.error }) }}>Use next reading</Button>
        {state === "stale" && <Button className={btn} onClick={() => setState?.("connected")}>Re-read the scale</Button>}
        {state === "error" && <Button variant="outline" className={btn} onClick={() => setState?.("connected")}>Retry connection</Button>}
      </div>
      {state === "error" && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <p className="text-sm font-medium">Manual weight entry (supervisor badge; flagged on the HU)</p>
          <div className="grid gap-2 md:grid-cols-3">
            <TextField id="mw-kg" label="Gross weight (kg)" type="number" value={kgIn} onChange={setKgIn} />
            <TextField id="mw-badge" label="Supervisor badge" value={badge} onChange={setBadge} />
            <TextField id="mw-reason" label="Why the scale could not be used" value={reason} onChange={setReason} />
          </div>
          <Inline error={err} />
          <div><Button className={btn} disabled={hu.status !== "Open"} onClick={() => { const r = manualWeight(hu.id, Number(kgIn), reason, badge); if (r.ok) { setErr(null); onTaken?.(`${hu.id} weight entered manually with supervisor flag`) } else setErr({ text: r.error }) }}>Use manual weight</Button></div>
        </div>
      )}
      {state !== "error" && <Inline error={err} />}
      {setState && <p className="text-xs text-muted-foreground">Simulate the device: <button className="underline" onClick={() => setState("connected")}>connected</button> · <button className="underline" onClick={() => setState("error")}>error</button> · <button className="underline" onClick={() => setState("stale")}>stale</button></p>}
    </div>
  )
}

export function ScaleReadoutDialog({ hu, open, onOpenChange }: { hu: HU; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, setState] = useState<ScaleState>("connected")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} wide title={`Scale readout for ${hu.id}`} description={`${hu.item}, SSCC ${hu.sscc}. Status ${hu.status}.`} consequence="Takes the reading onto the HU. Closing the HU still checks the weight against ±2% of expected (SP-17)." confirmLabel="Done" onConfirm={() => null}>
      <ScaleReadout hu={hu} state={state} setState={setState} />
    </DialogShell>
  )
}

export function ScaleReadoutPage() {
  const db = useSlice("sales")
  const st = useFxState()
  const open = db.hus.filter((h) => h.status === "Open")
  const [id, setId] = useState(open[0]?.id ?? db.hus[0]?.id ?? "")
  const [scale, setScale] = useScaleState()
  const hu = db.hus.find((h) => h.id === id)
  return (
    <DialogPage
      screenId="FX-OM-SCALE"
      title="Pack station scale readout"
      description="The live weight from the scale integration, in its three device states. The readout sits on the pack station beside the HU being closed."
      st={st}
      chips={<Reading id="SR-32" note="Scale protocol, stale limit and the three states come from the feature list; the PRD names only the integration (IF-20)." />}
      context={<div className="max-w-xl"><PickField label="Handling unit" value={id} onChange={setId} options={db.hus.filter((h) => h.status === "Open" || h.id === id).map((h) => ({ value: h.id, label: `${h.id} · ${h.deliveryId} · ${h.status}` }))} /></div>}
      cards={hu ? [{ id: "dlg", title: "Readout dialog", open: "Open readout dialog", body: "The same readout as a dialog, for use from the office pack screen.", render: (o, c) => <ScaleReadoutDialog hu={hu} open={o} onOpenChange={c} /> }] : []}
      extra={hu ? <div className="mt-4"><h2 className="mb-2 text-sm font-semibold">Readout on the station</h2><ScaleReadout hu={hu} state={scale} setState={setScale} /></div> : null}
      rules={[
        ["SP-17", "HU close needs a gross weight within ±2% of expected; the scale feeds it, manual entry needs a supervisor flag.", "DOC:p.32 §5.3; p.96"],
        ["SCL-1", "Connected: live value with stable detection; Error: no signal, manual entry only; Stale: the last reading is too old, re-read before it is used.", "Feature list (design value)"],
      ]}
    />
  )
}
