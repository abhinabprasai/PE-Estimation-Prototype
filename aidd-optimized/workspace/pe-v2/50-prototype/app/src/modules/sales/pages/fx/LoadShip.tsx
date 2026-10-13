// FX-OM-LOADSHIP Load and ship scan flow, TC77 handheld (/sales/load-ship) [DOC:p.96 SP-18; Book IV §2.4, §2.6].
// At the truck: scan the shipment document, then each HU in the loading sequence (SP-18). A HU that is not on the
// shipment is E-BC-08; one out of sequence needs an explicit confirmation with a reason; when every HU is scanned
// the delivery is Loaded and PGI-ready. A carrier that rejected the tender stops loading until it is reassigned.
import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { CircleCheck, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KioskPage } from "@/components/templates"
import { ScanField, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate } from "../../data/model"
import { loadScanSeq } from "../../fx/actions"
import { dlvIdOfShip, shipIdOf } from "../../fx/derive"
import { StateBar, useFxState } from "./kit"

export function LoadShip() {
  const db = useSlice("sales")
  const st = useFxState()
  const nav = useNavigate()
  const ref = useRef<ScanFieldHandle>(null)
  const eligible = db.deliveries.filter((d) => ["Quality Cleared", "Loaded"].includes(d.status))
  const [dlvId, setDlvId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ code: string; expected: string } | null>(null)
  const [reason, setReason] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const [queued, setQueued] = useState<string[]>([])
  const d = db.deliveries.find((x) => x.id === dlvId)
  const s = d ? db.fx.ship[d.id] : undefined
  const hus = d ? db.hus.filter((h) => h.deliveryId === d.id) : []
  const seq = s ? s.loadSeq.map((id) => hus.find((h) => h.id === id)).filter(Boolean) as typeof hus : []
  const next = seq.find((h) => h.status !== "Loaded")
  const online = st.state !== "offline"
  const rejected = s?.tender === "Rejected"
  const refocus = () => setTimeout(() => ref.current?.focus(), 0)

  const onScan = (code: string): ScanOutcome => {
    const v = code.trim().toUpperCase()
    if (!d) {
      const id = v.startsWith("SHP") ? dlvIdOfShip(v) : v
      const hit = eligible.find((x) => x.id === id)
      if (!hit) return { ok: false, errorCode: "E-BC-08", message: `${code} is not a shipment ready to load`, expected: `a shipment at Quality Cleared or Loaded (${eligible.map((x) => shipIdOf(x.id)).join(", ") || "none ready"})`, next: "Scan the shipment document at the dock" }
      setDlvId(hit.id)
      return { ok: true, message: `${shipIdOf(hit.id)} opened for ${db.customers.find((c) => c.id === hit.customerId)?.name}` }
    }
    if (!online) {
      setQueued((q) => [...q, v])
      return { ok: true, message: `${v} queued offline. It replays when the connection returns` }
    }
    const r = loadScanSeq(d.id, v)
    if (r.ok) { setPending(null); setMsg(null); return { ok: true, message: `${r.value} loaded (SP-18, T11)` } }
    if (r.field === "sequence") {
      const exp = next?.id ?? ""
      setPending({ code: v, expected: exp })
      return { ok: false, errorCode: "Out of sequence", message: `${v} is not next in the loading sequence`, expected: exp, next: "Scan the expected HU, or confirm out of sequence with a reason below" }
    }
    return { ok: false, errorCode: r.error.startsWith("E-BC-08") ? "E-BC-08" : "SP-18", message: r.error.replace(/^E-BC-08: /, ""), expected: next ? `${next.id} (${next.sscc})` : "an HU on this shipment", next: "Take the unit off the truck and scan the right HU" }
  }
  const replay = () => {
    if (!d) return
    const left: string[] = []
    for (const c of queued) { const r = loadScanSeq(d.id, c); if (!r.ok) left.push(c) }
    setQueued(left)
    setMsg(left.length ? `${left.length} queued scan(s) were refused on replay: ${left.join(", ")}` : "Queued scans replayed")
  }
  const ready = d?.status === "Loaded"

  return (
    <KioskPage
      title="Load and ship"
      screenId="FX-OM-LOADSHIP"
      station="Dock door"
      operator="Shipping office (TC77 handheld, no badge login in this prototype)"
      online={online}
      queued={queued.length}
      exitTo="/sales/shipments"
      banners={
        <div className="flex flex-col gap-3">
          <StateBar st={st} only={["normal", "empty", "loading", "authorization", "conflict", "offline", "degraded", "read-only"]} />
          {st.state === "degraded" && <p className="rounded-md border border-status-pending px-4 py-3 text-base">Degraded: the credit gate answers slowly. Scans still work; the gate result shows Stale until it returns.</p>}
          {st.state === "conflict" && <p role="alert" className="rounded-md border px-4 py-3 text-base">This shipment changed in the office while you were loading (simulated). Reload to continue; scanned HUs are kept.</p>}
          {rejected && <p role="alert" className="flex items-center gap-4 rounded-md bg-destructive px-4 py-3 text-base text-destructive-foreground"><span><strong>Carrier rejected the tender</strong>: {s?.rejectedReason}. Loading is stopped until the office reassigns a carrier.</span><Button asChild variant="outline" className="ml-auto h-12 bg-background text-base text-foreground"><Link to={`/sales/shipments/${shipIdOf(d!.id)}`}>Reassign carrier</Link></Button></p>}
          {pending && (
            <div role="alert" className="flex flex-wrap items-center gap-4 rounded-md border-2 border-status-exception px-4 py-3 text-base">
              <span><strong>Out of sequence.</strong> {pending.code} scanned; the plan expects {pending.expected}.</span>
              <input aria-label="Reason for loading out of sequence" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="h-12 min-w-64 flex-1 rounded-md border border-input bg-background px-3" />
              <Button className="h-12 text-base" onClick={() => {
                if (!d) return
                if (!reason.trim()) return setMsg("Enter the reason to confirm out of sequence.")
                const r = loadScanSeq(d.id, pending.code, { confirmOutOfSeq: reason.trim() })
                setMsg(r.ok ? `${r.value} loaded out of sequence; logged on the shipment` : r.error)
                if (r.ok) { setPending(null); setReason("") }
                refocus()
              }}>Confirm out of sequence</Button>
              <Button variant="ghost" className="h-12 text-base" onClick={() => { setPending(null); refocus() }}>Cancel</Button>
            </div>
          )}
          {msg && <p role="status" className="rounded-md border px-4 py-3 text-base">{msg}</p>}
        </div>
      }
      scan={st.state === "empty" || st.state === "loading" ? undefined : <ScanField ref={ref} key={d ? "hu" : "doc"} scanPoint="SP-18" label={d ? "Scan each HU at the truck" : "Scan the shipment document"} expected={!d ? "the shipment document (SHP-TBD-nnnn) at the dock" : ready ? "nothing: every HU is loaded" : rejected ? "nothing until the carrier is reassigned" : next ? `${next.id}, SSCC ${next.sscc} (load order ${seq.indexOf(next) + 1} of ${seq.length})` : "an HU"} onScan={onScan} disabled={st.state === "authorization" || st.state === "read-only" || st.state === "conflict" || (!!d && (ready || rejected))} />}
      actions={[
        ...(d ? [{ label: "Choose another shipment", onClick: () => { setDlvId(null); setPending(null); setMsg(null); refocus() } }] : []),
        ...(queued.length ? [{ label: `Replay ${queued.length} queued scan(s)`, onClick: replay, disabled: !online }] : []),
        { label: ready ? "PGI-ready: open the shipment" : "Open the shipment", primary: true, disabled: !d, onClick: () => d && nav(`/sales/shipments/${shipIdOf(d.id)}`) },
      ]}
    >
      {st.state === "loading" ? <p className="text-lg" aria-busy="true">Loading shipments…</p> : st.state === "empty" || (!d && eligible.length === 0) ? (
        <p className="rounded-lg border border-dashed p-6 text-lg">No shipment is ready to load. A shipment appears here when its pre-shipment inspection has passed (Quality Cleared).</p>
      ) : !d ? (
        <div className="flex flex-col gap-4">
          <p className="text-lg">Shipments ready to load</p>
          <ul className="grid gap-4 md:grid-cols-2">
            {eligible.map((x) => (
              <li key={x.id}><Button variant="outline" className="h-auto min-h-16 w-full flex-col items-start gap-1 p-4 text-left text-base" onClick={() => { setDlvId(x.id); refocus() }}><span className="font-semibold">{shipIdOf(x.id)} · {x.id}</span><span>{db.customers.find((c) => c.id === x.customerId)?.name}</span><span className="text-sm text-muted-foreground">{x.carrier ?? "No carrier"} · {db.fx.ship[x.id]?.tender} · {x.slot ?? "no appointment"}</span></Button></li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 text-lg">
            <span className="font-semibold">{shipIdOf(d.id)}</span><StatusBadge kind="delivery" status={d.status} size="lg" />
            <span>{db.customers.find((c) => c.id === d.customerId)?.name}</span>
          </div>
          <dl className="grid grid-cols-4 gap-4 text-base">
            <div><dt className="text-sm text-muted-foreground">Dock door</dt><dd>{d.door ?? "Not set"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Appointment</dt><dd>{d.slot ?? "Not set"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Carrier</dt><dd>{d.carrier ?? "Not assigned"} ({s?.tender})</dd></div>
            <div><dt className="text-sm text-muted-foreground">Ship date</dt><dd>{d.shipDate ? listDate(d.shipDate) : "At PGI"}</dd></div>
          </dl>
          <section aria-label="Loading sequence">
            <h2 className="mb-2 font-semibold">Loading sequence ({seq.filter((h) => h.status === "Loaded").length} of {seq.length} loaded)</h2>
            <ol className="flex flex-col gap-2">
              {seq.map((h, i) => (
                <li key={h.id} className={`flex min-h-12 items-center gap-4 rounded-lg border p-3 ${next?.id === h.id ? "border-2 border-ring" : ""}`}>
                  {h.status === "Loaded" ? <CircleCheck className="size-6 text-status-passed" aria-hidden="true" /> : <Circle className="size-6 text-muted-foreground" aria-hidden="true" />}
                  <span className="tabular w-8">{i + 1}</span><span className="w-28 font-semibold">{h.id}</span><span className="font-mono text-sm">{h.sscc}</span><span>{h.item}</span>
                  <span className="ml-auto"><StatusBadge kind="handlingUnit" status={h.status} size="lg" /></span>
                </li>
              ))}
              {seq.length === 0 && <li className="text-base text-muted-foreground">No handling units on this shipment.</li>}
            </ol>
          </section>
          {ready && <p role="status" className="rounded-md border-2 border-status-passed px-4 py-3 text-lg">Every HU is loaded. {shipIdOf(d.id)} is Loaded and PGI-ready; goods issue is posted from the shipment.</p>}
          {s && s.outOfSeq.length > 0 && <p className="text-sm text-muted-foreground">Out of sequence: {s.outOfSeq.map((o) => `${o.hu} (expected ${o.expected}: ${o.reason})`).join("; ")}</p>}
          {s && s.scanLog.length > 0 && <p className="text-sm text-muted-foreground">Last refused: {s.scanLog.filter((l) => l.result === "E-BC-08").slice(0, 2).map((l) => l.code).join(", ") || "none"}</p>}
        </div>
      )}
    </KioskPage>
  )
}
