// FX-BC-CAMERA Supervisor camera-fallback scanning mode [DOC:p.94 Part F §2] (asserted).
// When the laser imager cannot read a label, a Warehouse or Production supervisor may scan with the
// device camera: slower, supervisors only, and every camera scan is logged to scan telemetry
// (flagged Camera). The camera view is drawn in the prototype; a code the "camera" cannot decode is
// typed by hand and still goes through the scan point's validation (README QT-R36). KioskPage with
// the task area at the handheld width.

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { Camera, ScanLine } from "lucide-react"
import { KioskPage, KioskFact } from "@/components/templates"
import { ErrorAlert } from "@/components/patterns"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { SCAN_POINTS, type ScanPointCode } from "@/data/domain"
import { USERS } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { cameraX } from "../data/extra-actions"
import { HandheldFrame } from "../components/handheld"
import { StateFrame, useScreenState } from "../components/states"
import { cn } from "@/lib/utils"

const POINTS: ScanPointCode[] = ["SP-04", "SP-06", "SP-15", "SP-18", "SP-20"]
const SAMPLES = ["BAT-TBD-CT1003", "SN-TBD-5M-0388", "BIN-TBD-F-02-01", "HU-TBD-0052-1"]
const DECODE_MS = 1800 // slower than the laser imager (design value; the specification says only "slower")

export function CameraScan() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-BC-CAMERA")
  const [role] = useRole()
  const supervisor = role === "Warehouse supervisor" || role === "Production supervisor"
  const operator = USERS.find((u) => u.roles.includes(role))?.name
  const [sp, setSp] = useState<ScanPointCode>("SP-04")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  const recent = s.telemetry.filter((t) => t.camera).slice(0, 5)
  const offline = ss.state === "offline"
  const capture = () => {
    setErr(null)
    setLast(null)
    if (!code.trim()) return setErr("Hold the label in the frame, or type the code the camera could not read.")
    setBusy(1)
    let p = 0
    timer.current = setInterval(() => {
      p += 100 / (DECODE_MS / 100)
      setBusy(Math.min(100, p))
      if (p >= 100) {
        if (timer.current) clearInterval(timer.current)
        setBusy(0)
        const r = cameraX.scan(sp, code)
        if (!r.ok) return setErr(r.error)
        if (!r.value.accepted) return setErr(r.value.message)
        setLast(r.value.code)
        setCode("")
      }
    }, 100)
  }
  return (
    <KioskPage
      title="Camera scan"
      screenId="FX-BC-CAMERA"
      operator={operator}
      station="Handheld TC77 (camera)"
      online={!offline}
      queued={2}
      exitTo="/configuration/barcode"
      banners={err ? <ErrorAlert title="Camera scan not accepted" onDismiss={() => setErr(null)}>{err}</ErrorAlert> : undefined}
      actions={supervisor && !ss.locked ? [{ label: busy ? "Reading..." : "Capture", primary: true, onClick: capture, disabled: busy > 0 }] : []}
    >
      <StateFrame ss={ss} bare title="Camera scan" screenId="FX-BC-CAMERA" entity="camera scans" allowed="Warehouse supervisor or Production supervisor" validation={["Hold the label in the frame, or type the code.", "Choose the scan point."]} conflict={{ what: "the bin BIN-TBD-F-02-01", mine: "Scan BAT-TBD-K0602 into the bin", theirs: "The bin was moved to staging while the camera read the label" }} degraded="The camera is slow in low light: reads may take longer than usual.">
        {!supervisor ? (
          <ErrorAlert title="Camera fallback is for supervisors">
            Camera scanning is limited to a Warehouse supervisor or Production supervisor and every scan is logged. You are acting as {role}. Switch "Acting as" to continue.
          </ErrorAlert>
        ) : (
          <HandheldFrame device="Zebra TC77 camera, 4.7 in">
            <div className="flex flex-col gap-4">
              <p className="text-base">Use this only when the imager cannot read the label. Camera scans are slower and are logged with your name.</p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="cam-sp" className="text-base">Scan point</Label>
                <select id="cam-sp" className="h-12 rounded-md border bg-background px-3 text-base" value={sp} onChange={(e) => setSp(e.target.value as ScanPointCode)} disabled={ss.locked}>
                  {POINTS.map((p) => <option key={p} value={p}>{p} · {SCAN_POINTS[p].step}</option>)}
                </select>
              </div>
              <div className={cn("relative flex h-40 items-center justify-center rounded-lg border-2 border-dashed bg-muted", busy > 0 && "border-primary")} role="img" aria-label="Camera view: align the label inside the frame">
                <Camera className="size-10 text-muted-foreground" aria-hidden="true" />
                <ScanLine className={cn("absolute size-8 text-primary", busy > 0 ? "animate-pulse" : "opacity-40")} aria-hidden="true" />
                <span className="absolute bottom-2 text-sm text-muted-foreground">{busy > 0 ? "Hold steady..." : "Align the label inside the frame"}</span>
              </div>
              {busy > 0 && <Progress value={busy} aria-label="Reading the label" />}
              <div className="flex flex-col gap-1">
                <Label htmlFor="cam-code" className="text-base">Code in the frame</Label>
                <Input id="cam-code" className="h-12 text-lg" value={code} onChange={(e) => setCode(e.target.value)} disabled={ss.locked || busy > 0} placeholder="Type it if the camera cannot decode it" onKeyDown={(e) => e.key === "Enter" && capture()} />
                <div className="flex flex-wrap gap-2 pt-1">
                  {SAMPLES.map((x) => (
                    <button key={x} type="button" className="min-h-12 rounded-md border px-3 text-sm" onClick={() => setCode(x)} disabled={ss.locked}>{x}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Sample labels stand in for what the camera sees.</p>
              </div>
              {last && <KioskFact label="Read and accepted">{last}</KioskFact>}
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Camera scans, newest first</span>
                {recent.length === 0 && <span className="text-muted-foreground">None yet.</span>}
                {recent.map((t) => <span key={t.id} className="tabular">{t.at.slice(11, 16)} · {t.sp} · {t.payload} · {t.result}</span>)}
                <Link className="text-link underline-offset-4 hover:underline" to="/configuration/barcode?s=telemetry">Open scan telemetry</Link>
              </div>
            </div>
          </HandheldFrame>
        )}
      </StateFrame>
    </KioskPage>
  )
}
