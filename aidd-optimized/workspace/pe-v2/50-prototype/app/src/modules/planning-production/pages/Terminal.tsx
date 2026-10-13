// PP-SFT-001 Shop Floor Terminal [DOC:p.76 §6; p.262 Book VI] (asserted). Kiosk, floor-touch.
// Badge in (SP-07), start (SP-10), scan materials (SP-08), install child serials (SP-12), complete
// with quantities (SP-11), request inspection, hold / andon, offline banner with queue depth.
// Postings per confirmation event: #28 issue / backflush, #29 labor + overhead, #30 scrap.
// Zero typing on the standard path: quantities and hours default to the started quantity and standard.

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip, PostingPreview, ScanField, StatusBadge, type ScanOutcome } from "@/components/patterns"
import { KioskFact, KioskPage, type KioskAction } from "@/components/templates"
import type { UserId } from "@/data/domain"
import { MATERIALS, SPINE_LINKS, USERS } from "@/data/shared"
import type { User } from "@/data/domain"
import { store, useMutate, useSlice, type MutateCtx } from "@/store"
import { BodyState, matDesc, qty, useScreenState, Marker } from "../components"
import * as act from "../lib/actions"
import * as ext from "../lib/actions-ext"
import { CaptureEntry, OvenBatch } from "../widgets/KioskViews"
import { allWorkCenters, laborRateOf, ohRateOf, opHours } from "../lib/plan"
import type { PPOperation, PPWorkOrder, PlanningProductionState } from "../data/types"

type Mode = "work" | "install-parent" | "install-child" | "complete-scan" | "complete-qty" | "hold" | "nameplate"
type Pending = { text: string; fn: (d: PlanningProductionState, c: MutateCtx) => unknown }
const stdOf = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
const FLOOR_ROLES = ["Operator", "Production supervisor", "Test technician"]

/** Drawing / work-instruction viewer: the terminal renders the current released document [DOC:p.73 §4; p.76 §6]. */
function DocsDialog({ s, target, onClose }: { s: PlanningProductionState; target: { wo: PPWorkOrder; op: PPOperation } | null; onClose: () => void }) {
  if (!target) return null
  const { wo, op } = target
  const rtg = s.routings.find((r) => r.id === wo.routingId && r.rev === wo.routingRev)
  const wi = rtg?.opsDetail.find((o) => o.no === op.no)?.wiDocIds ?? []
  const drawings = wo.orderType === "ETO" ? [...new Set(SPINE_LINKS.filter((l) => l.to.type === "document").map((l) => l.to.id))].slice(0, 3) : []
  const docs = [...wi.map((id) => ({ id, kind: "Work instruction" })), ...drawings.map((id) => ({ id, kind: "Drawing" }))]
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="light max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Drawings and work instructions · {wo.id}/{op.no}</DialogTitle>
          <DialogDescription>Current released revision only (routing {wo.routingId} rev {wo.routingRev}, frozen at release).</DialogDescription>
        </DialogHeader>
        {docs.length === 0 && <p className="text-base text-muted-foreground">No work instruction is linked to op {op.no} on routing {wo.routingId} rev {wo.routingRev}. The operation text applies: {op.text}.</p>}
        <div className="flex flex-col gap-4">
          {docs.map((d) => {
            const info = store.lookup({ type: "document", id: d.id })
            return (
              <section key={d.id} className="flex flex-col gap-2 rounded-md border p-4">
                <p className="text-base"><span className="font-mono">{d.id}</span> · {d.kind} · {info.title ?? "released revision from Document Control"}{info.status ? ` · ${info.status.value}` : ""}</p>
                <div className="flex h-64 items-center justify-center rounded-md bg-muted text-muted-foreground" role="img" aria-label={`${d.id} PDF`}>PDF of the released revision renders here (prototype)</div>
              </section>
            )
          })}
        </div>
        <Button className="h-12 self-start" variant="outline" onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  )
}

export function ShopFloorTerminal() {
  const s = useSlice("planningProduction")
  const st = useScreenState("PP-SFT-001")
  const [docsFor, setDocsFor] = useState<{ wo: PPWorkOrder; op: PPOperation } | null>(null)
  const [sup, setSup] = useState({ badge: "", reason: "" })
  const mutate = useMutate("planningProduction")
  const [params, setParams] = useSearchParams()
  const wc = params.get("wc") ?? ""
  const station = allWorkCenters(s).find((w) => w.id === wc)
  const [operator, setOperator] = useState<User | null>(null)
  const [crew, setCrew] = useState<User[]>([])
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState<Pending[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("work")
  const [parent, setParent] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: "override" | "fifo" | "info" | "error"; code?: string; text: string } | null>(null)
  const [overrideBy, setOverrideBy] = useState("")
  const [overrideWhy, setOverrideWhy] = useState("")
  const [form, setForm] = useState({ good: "", scrap: "0", rework: "0", hours: "", scrapReason: "" })
  const [addingCrew, setAddingCrew] = useState(false)
  const [lastCode, setLastCode] = useState("")
  const [batchOpen, setBatchOpen] = useState(false)

  const queue = useMemo(() => (wc ? act.wcQueue(s, wc) : []), [s, wc])
  const cur = sel ? queue.find((x) => `${x.wo.id}/${x.op.no}` === sel) ?? (() => {
    const [woId, no] = sel.split("/")
    const wo = s.productionOrders.find((w) => w.id === woId)
    const op = wo?.operations.find((o) => o.no === Number(no))
    return wo && op ? { wo, op } : undefined
  })() : undefined

  /** Run now, or queue when offline (replayed in order when the connection returns). */
  const exec = (text: string, fn: Pending["fn"]): { ok: true } | { ok: false; error: string; field?: string } => {
    if (!online) {
      setQueued((q) => [...q, { text, fn }])
      return { ok: true }
    }
    const r = mutate(fn)
    return r.ok ? { ok: true } : { ok: false, error: r.error, field: r.field }
  }
  const goOnline = () => {
    setOnline(true)
    const errs: string[] = []
    for (const p of queued) {
      const r = mutate(p.fn)
      if (!r.ok) errs.push(`${p.text}: ${r.error}`)
    }
    setBanner({ kind: errs.length ? "error" : "info", text: errs.length ? `Replayed ${queued.length - errs.length} of ${queued.length}. Refused: ${errs.join("; ")}` : `Replayed ${queued.length} queued scan(s); duplicates are ignored by event ID.` })
    setQueued([])
  }

  // ---------------------------------------------------------------- loading / error
  if (st.loading || st.error) {
    return (
      <KioskPage title="Shop floor terminal" screenId="PP-SFT-001" station={station ? `${station.id} ${station.name}` : "not set"} exitTo="/production/dispatch">
        <BodyState state={st} what="Terminal queue">{null}</BodyState>
      </KioskPage>
    )
  }
  // ---------------------------------------------------------------- station and badge
  if (!station) {
    return (
      <KioskPage title="Shop floor terminal" screenId="PP-SFT-001" station="not set" exitTo="/production/dispatch">
        <p className="text-lg">Select this kiosk's work center (kiosk configuration).</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {allWorkCenters(s).filter((w) => w.status !== "Inactive").map((w) => (
            <Button key={w.id} variant="outline" className="h-16 flex-col text-base" onClick={() => (params.set("wc", w.id), setParams(params, { replace: true }))}>
              <span className="font-mono">{w.id}</span><span className="text-sm">{w.name}</span>
            </Button>
          ))}
        </div>
      </KioskPage>
    )
  }
  const badge = (code: string): ScanOutcome => {
    const u = USERS.find((x) => x.badge === code || x.id === code)
    if (!u) return { ok: false, expected: "an operator badge (BDG-7nnn)", next: "Scan your own badge or ask the supervisor", message: `${code} is not an active badge` }
    if (!u.roles.some((r) => FLOOR_ROLES.includes(r))) return { ok: false, expected: "a floor badge (operator, test technician, supervisor)", next: "Use an operator badge", message: `${u.name} is ${u.roles.join(", ")}` }
    const sup = u.roles.includes("Production supervisor")
    if (!sup && !(u.workCenterIds ?? []).includes(wc as never)) return { ok: false, expected: `an operator assigned to ${wc}`, next: "Ask the supervisor to assign you or to override", message: `${u.name} is assigned to ${(u.workCenterIds ?? []).join(", ") || "no work center"}` }
    if (!operator) setOperator(u)
    else if (!crew.some((c) => c.id === u.id) && u.id !== operator.id) setCrew([...crew, u])
    setAddingCrew(false)
    return { ok: true, message: `${u.name} clocked in at ${wc}${sup && !(u.workCenterIds ?? []).includes(wc as never) ? " (supervisor)" : ""}` }
  }
  if (!operator || addingCrew) {
    return (
      <KioskPage title="Shop floor terminal" screenId="PP-SFT-001" station={`${station.id} ${station.name}`} operator={operator?.name} online={online} queued={queued.length} exitTo="/production/dispatch"
        scan={<ScanField scanPoint="SP-07" expected={addingCrew ? "Scan the next crew member's badge" : `Scan your badge (operators assigned to ${wc}, e.g. ${USERS.find((u) => (u.workCenterIds ?? []).includes(wc as never) && u.roles.includes("Operator"))?.badge ?? "BDG-7031"})`} onScan={badge} />}
        actions={addingCrew ? [{ label: "Done adding crew", onClick: () => setAddingCrew(false), primary: true }] : []}>
        <p className="text-muted-foreground">Badge login validates the active user and the work-center assignment; the session carries labor attribution. Multi-operator crews clock in one badge after another.</p>
      </KioskPage>
    )
  }
  const crewIds = [operator, ...crew].map((u) => u.id as UserId)
  const lockOf = (op: PPOperation) => act.qualificationCheck(s, operator.id, op.requiredSkill)
  const header = { title: "Shop floor terminal", screenId: "PP-SFT-001", station: `${station.id} ${station.name}`, operator: [operator, ...crew].map((u) => u.name).join(", "), online, queued: queued.length, exitTo: "/production/dispatch" }
  const banners = (
    <>
      {station.status !== "Active" && <div role="alert" className="mb-2 rounded-md border border-status-blocked p-3">{station.id} is {station.status}{station.maintenanceUntil ? ` until ${station.maintenanceUntil}` : ""}: new dispatch is blocked (operations cannot start); nothing is scheduled here.</div>}
      {queue.some((x) => x.op.status === "Not Started" && lockOf(x.op)) && <div role="alert" className="mb-2 rounded-md border border-status-blocked p-3"><span className="mr-2 font-mono">SP-07</span>Qualification interlock: {[...new Set(queue.filter((x) => x.op.status === "Not Started" && lockOf(x.op)).map((x) => lockOf(x.op)))].join("; ")}. Operations flagged with that skill are locked for this login.</div>}
      {banner && (
        <div role={banner.kind === "info" ? "status" : "alert"} className={`mb-2 flex flex-col gap-2 rounded-md border p-3 ${banner.kind === "info" ? "" : "border-status-blocked"}`}>
          <span>{banner.code && <span className="mr-2 font-mono">{banner.code}</span>}{banner.text}</span>
          {banner.kind === "override" && (
            <div className="flex flex-wrap items-end gap-2">
              <span className="grid gap-1"><Label htmlFor="ovr-by">Supervisor badge</Label><Input id="ovr-by" className="h-12 w-48 text-base" value={overrideBy} onChange={(e) => setOverrideBy(e.target.value)} placeholder="BDG-7031" /></span>
              <span className="grid flex-1 gap-1"><Label htmlFor="ovr-why">Override reason</Label><Input id="ovr-why" className="h-12 text-base" value={overrideWhy} onChange={(e) => setOverrideWhy(e.target.value)} /></span>
              <Button className="h-12" variant="outline" onClick={() => issue(lastCode, { overrideBy, overrideReason: overrideWhy })}>Override and raise NCR</Button>
            </div>
          )}
          {banner.kind === "fifo" && (
            <div className="flex flex-wrap gap-2">
              {["Older batch not reachable (bin blocked)", "Customer-specified batch", "Older batch damaged"].map((r) => <Button key={r} variant="outline" className="h-12" onClick={() => issue(lastCode, { fifoReason: r })}>{r}</Button>)}
            </div>
          )}
          <Button variant="ghost" className="h-12 self-start" onClick={() => setBanner(null)}>Dismiss</Button>
        </div>
      )}
    </>
  )

  // ---------------------------------------------------------------- queue
  if (!cur) {
    const actions: KioskAction[] = [
      { label: "Open next operation", primary: true, disabled: !queue.length, onClick: () => queue[0] && (setSel(`${queue[0].wo.id}/${queue[0].op.no}`), setMode("work")) },
      ...(station.batchResource ? [{ label: batchOpen ? "Back to queue" : "Oven load (batch)", onClick: () => setBatchOpen((v) => !v) }] : []),
      { label: "Add crew member", onClick: () => setAddingCrew(true) },
      { label: online ? "Simulate offline" : "Reconnect and replay", onClick: () => (online ? setOnline(false) : goOnline()) },
      { label: "Log out", onClick: () => (setOperator(null), setCrew([])) },
    ]
    return (
      <KioskPage {...header} banners={banners} actions={actions}>
        <h2 className="text-xl font-semibold">{batchOpen ? `Oven load at ${station.id}` : `Queue at ${station.id} (${queue.length})`}</h2>
        {batchOpen && <OvenBatch s={s} wcId={station.id} crewIds={crewIds} exec={exec} notify={(kind, text) => setBanner({ kind, text })} />}
        <ul className={batchOpen ? "hidden" : "flex flex-col gap-2"}>
          {queue.map(({ wo, op }) => {
            const ready = op.staged || op.components.every((c) => c.issue === "backflush" || c.issued >= c.qtyPerUnit * wo.qty)
            const lock = op.status === "Not Started" ? lockOf(op) : null
            return (
              <li key={`${wo.id}/${op.no}`} className="flex items-stretch gap-2">
                <button className="grid min-h-16 flex-1 grid-cols-[48px_180px_minmax(0,1fr)_120px_200px] items-center gap-4 rounded-md border px-4 text-left text-base" onClick={() => (setSel(`${wo.id}/${op.no}`), setMode("work"), setBanner(null))}>
                  <span className="tabular text-lg">{op.sequence}</span>
                  <span className="font-mono">{wo.id}/{op.no}</span>
                  <span className="truncate">{op.text} · {wo.serials[0] ?? matDesc(wo.itemId)}</span>
                  <span className="tabular">{qty(opHours(op))} h std</span>
                  <span className="flex flex-wrap gap-1">
                    {op.status === "In Progress" && <Marker>Running</Marker>}
                    {ready ? <Marker note="All components staged">Material ready</Marker> : <Chip kind="backorder">Not staged</Chip>}
                    {(wo.status === "On Hold" || op.andon) && <Chip kind="hold">{op.andon ? op.andon.reason : "WO On Hold"}</Chip>}
                    {lock && <Chip kind="block" note={lock}>Locked: {op.requiredSkill}</Chip>}
                  </span>
                </button>
                <Button variant="outline" className="h-auto min-h-16 w-40 text-base" onClick={() => setDocsFor({ wo, op })}>Drawing / WI</Button>
              </li>
            )
          })}
          {!queue.length && <li className="text-lg text-muted-foreground">Nothing queued at this work center.</li>}
        </ul>
        <DocsDialog s={s} target={docsFor} onClose={() => setDocsFor(null)} />
      </KioskPage>
    )
  }

  // ---------------------------------------------------------------- one operation
  const { wo, op } = cur
  const key = `${wo.id}/${op.no}`
  const started = act.startedQty(wo, op.no)
  const stdH = (op.setupHours + op.runHours) * op.crew
  const serialComps = op.components.filter((c) => c.serialized)
  const back = () => (setSel(null), setMode("work"), setParent(null), setBanner(null))
  function issue(code: string, extra: { overrideBy?: string; overrideReason?: string; fifoReason?: string } = {}): ScanOutcome {
    setLastCode(code)
    const r = exec(`Issue ${code} to ${key}`, (d, c) => act.issueMaterial(d, c, wo.id, op.no, code, extra))
    if (r.ok) {
      setBanner(extra.overrideReason ? { kind: "info", text: `Override logged; NCR raised automatically for ${code}.` } : null)
      return { ok: true, message: online ? `issued to op ${op.no} (#28, T05)` : "queued offline" }
    }
    if (r.field === "E-PP-07") setBanner({ kind: "override", code: "E-PP-07", text: `${r.error} Hard block. A supervisor override creates an NCR automatically.` })
    else if (r.field === "FIFO") setBanner({ kind: "fifo", text: r.error })
    return { ok: false, errorCode: r.field && r.field.startsWith("E-") ? r.field : undefined, expected: `a component of op ${op.no}: ${op.components.map((c) => c.materialId).join(", ") || "none"}`, next: r.field === "FIFO" ? "Scan the older batch or log an override reason" : r.field === "E-PP-07" ? "Scan the right material or get a supervisor override" : "Check the label and scan again", message: r.error }
  }
  const onScan = (code: string): ScanOutcome => {
    if (mode === "work" && op.status === "Not Started") {
      if (code !== key) return { ok: false, expected: `traveler op barcode ${key}`, next: "Scan the barcode on this operation's sheet", message: `${code} is not this operation` }
      const why = act.startCheck(s, wo.id, op.no) ?? lockOf(op)
      if (why) return { ok: false, errorCode: lockOf(op) ? "E-QAL" : undefined, expected: "an operation that can start", next: lockOf(op) ? `A qualified operator (${op.requiredSkill}) badges in` : "Finish the predecessor or clear the gate", message: why }
      const r = exec(`Start ${key}`, (d, c) => act.startOp(d, c, wo.id, op.no, crewIds))
      return r.ok ? { ok: true, message: `op ${op.no} In Progress; labor clock on for ${crewIds.length} (SP-10)` } : { ok: false, expected: key, next: "See the message", message: r.error }
    }
    if (mode === "nameplate") {
      const left = ext.nameplateRemaining(wo, op)
      const r = exec(`Nameplate ${code} at ${key}`, (d, c) => ext.verifyNameplate(d, c, wo.id, op.no, code))
      if (r.ok) {
        if (left.length <= 1) setMode("work")
        return { ok: true, message: left.length > 1 ? `plate matches ${code}; ${left.length - 1} unit(s) left` : "every nameplate verified (SP-13)" }
      }
      return { ok: false, errorCode: r.field === "E-BC-06" ? "E-BC-06" : undefined, expected: `the nameplate serial of ${wo.id}: ${left.slice(0, 3).join(", ")}`, next: "Check the plate against the order. A wrong plate stops the line: call the supervisor", message: r.error }
    }
    if (mode === "work") return issue(code)
    if (mode === "install-parent") {
      if (!wo.serials.includes(code as never)) return { ok: false, errorCode: "E-BC-05", expected: `parent serial ${wo.serials.join(" or ")}`, next: "Scan the nameplate serial of this unit", message: `${code} is not this order's serial` }
      setParent(code)
      setMode("install-child")
      return { ok: true, message: "parent accepted; scan the child serial" }
    }
    if (mode === "install-child") {
      const r = exec(`Install ${code} in ${parent}`, (d, c) => act.installSerial(d, c, wo.id, op.no, parent!, code))
      if (r.ok) {
        setMode("work")
        setParent(null)
        return { ok: true, message: `installed in ${parent} (T06)` }
      }
      return { ok: false, errorCode: "E-BC-05", expected: `a ${serialComps.map((c) => c.materialId).join("/")} serial Available or issued to ${wo.id}`, next: "Scan another child serial", message: r.error }
    }
    if (mode === "complete-scan") {
      if (code !== key) return { ok: false, expected: `traveler op barcode ${key}`, next: "Scan this operation's barcode again to complete", message: `${code} is not this operation` }
      setForm({ good: String(started), scrap: "0", rework: "0", hours: String(Math.round(stdH * 10) / 10), scrapReason: "" })
      setSup({ badge: "", reason: "" })
      setMode("complete-qty")
      return { ok: true, message: "enter good / scrap / rework" }
    }
    return { ok: false, expected: "nothing in this step", next: "Use the buttons below", message: "No scan expected" }
  }

  const g = Number(form.good), sc = Number(form.scrap), rw = Number(form.rework), hrs = Number(form.hours)
  const lr = laborRateOf(wo.costStd), oh = ohRateOf(wo.costStd)
  const needs = act.supervisorNeeds(op, started, { scrap: sc, hours: hrs })
  const confirm = () => {
    const uuid = `evt-${wo.id}-${op.no}-${Date.now()}`
    const r = exec(`Complete ${key}`, (d, c) => act.completeOp(d, c, wo.id, op.no, { good: g, scrap: sc, rework: rw, scrapReason: form.scrapReason || undefined, hours: hrs, eventUuid: uuid, offlineReplay: !online, supervisorBadge: needs.length ? sup.badge : undefined, supervisorReason: needs.length ? sup.reason : undefined }))
    if (!r.ok) return setBanner({ kind: "error", text: r.error })
    setBanner({ kind: "info", text: online ? `Op ${op.no} confirmed: #29${sc ? ", #30" : ""}${op.components.some((c) => c.issue === "backflush") ? ", #28 backflush" : ""} posted${rw ? "; rework order opened" : ""}. Next-op staging signal sent.` : "Confirmation queued offline; it replays with its event ID." })
    back()
  }

  const scanPoint = op.status === "Not Started" || mode === "complete-scan" ? (mode === "complete-scan" ? "SP-11" : "SP-10") : mode.startsWith("install") ? "SP-12" : mode === "nameplate" ? "SP-13" : "SP-08"
  const expected =
    op.status === "Not Started" ? `Scan the traveler op barcode ${key}` :
    mode === "install-parent" ? `Scan the parent serial (${wo.serials.join(", ")})` :
    mode === "install-child" ? `Scan the child serial (${serialComps.map((c) => c.materialId).join(", ")})` :
    mode === "complete-scan" ? `Scan ${key} again to complete` :
    mode === "nameplate" ? `Scan the nameplate serial: ${ext.nameplateRemaining(wo, op).slice(0, 3).join(", ")}` :
    `Scan a component label: ${op.components.filter((c) => c.issue === "manual").map((c) => c.materialId).join(", ") || "no scan-issued components"}`
  const showScan = mode !== "complete-qty" && mode !== "hold" && wo.status !== "On Hold"
  const qcWaiting = !!op.qcGate && op.inspection?.result !== "Passed" && op.inspection?.result !== "Conditional pass"

  const actions: KioskAction[] =
    mode === "complete-qty"
      ? [
          { label: "Post confirmation", primary: true, onClick: confirm },
          { label: "Back", onClick: () => setMode("work") },
        ]
      : mode === "hold"
        ? [{ label: "Back", primary: true, onClick: () => setMode("work") }]
        : op.status === "Not Started"
          ? [
              { label: "Start operation", primary: true, disabled: !!act.startCheck(s, wo.id, op.no) || !!lockOf(op), onClick: () => onScan(key) },
              { label: "Hold / Andon", onClick: () => setMode("hold") },
              { label: "Back to queue", onClick: back },
            ]
          : [
              { label: mode === "complete-scan" ? "Waiting for SP-11 scan" : "Complete operation", primary: true, disabled: mode === "complete-scan" || qcWaiting || wo.status === "On Hold", onClick: () => setMode("complete-scan") },
              ...(op.qcGate ? [{ label: op.inspection && !op.inspection.result ? `Inspection ${op.inspection.id} pending` : op.inspection?.result === "Passed" ? "Inspection passed" : op.inspection?.result === "Conditional pass" ? "Conditional pass" : "Request inspection", disabled: !!op.inspection && op.inspection.result !== "Failed", onClick: () => { const r = exec(`Request inspection ${key}`, (d, c) => act.requestInspection(d, c, wo.id, op.no)); setBanner(r.ok ? { kind: "info", text: "Inspection requested; Complete stays disabled until the result is posted." } : { kind: "error", text: r.error }) } }] : []),
              ...(ext.needsNameplate(op) ? [{ label: mode === "nameplate" ? "Cancel nameplate check" : `Verify nameplate (SP-13)${ext.nameplateRemaining(wo, op).length ? "" : ": done"}`, disabled: !ext.nameplateRemaining(wo, op).length && mode !== "nameplate", onClick: () => setMode(mode === "nameplate" ? "work" : "nameplate") }] : []),
              ...(serialComps.length ? [{ label: mode.startsWith("install") ? "Cancel install" : "Install serial (SP-12)", onClick: () => (setMode(mode.startsWith("install") ? "work" : "install-parent"), setParent(null)) }] : []),
              { label: op.andon ? "Clear hold" : "Hold / Andon", onClick: () => (op.andon ? (exec(`Clear andon ${key}`, (d, c) => act.clearAndon(d, c, wo.id, op.no)), undefined) : setMode("hold")) },
              { label: "Back to queue", onClick: back },
            ]

  return (
    <KioskPage {...header} banners={banners} actions={actions}
      scan={showScan ? <ScanField key={`${key}-${scanPoint}-${mode}`} scanPoint={scanPoint} expected={expected} onScan={onScan} /> : undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold">{key}</h2>
        <StatusBadge kind="productionOrder" status={wo.status} size="lg" />
        <span className="text-lg">Op {op.status}</span>
        {op.andon && <Chip kind="hold">Andon: {op.andon.reason}</Chip>}
        {wo.status === "On Hold" && <Chip kind="hold" note={wo.holdReason}>WO On Hold: {wo.holdReason}</Chip>}
        {op.requiredSkill && <Chip kind={lockOf(op) ? "block" : "design"} note={lockOf(op) ?? `${operator.name} is qualified`}>Skill: {op.requiredSkill}</Chip>}
      </div>
      {op.status === "Not Started" && (act.startCheck(s, wo.id, op.no) || lockOf(op)) && <p role="alert" className="text-base text-destructive">Cannot start: {act.startCheck(s, wo.id, op.no) ?? `qualification interlock (SP-07): ${lockOf(op)}`}.</p>}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <KioskFact label="Item">{wo.itemId}</KioskFact>
        <KioskFact label="Serial">{wo.serials.length > 1 ? `${wo.serials.length} units` : wo.serials[0] ?? "n/a"}</KioskFact>
        <KioskFact label="Started qty">{started}</KioskFact>
        <KioskFact label="Std crew hours">{qty(stdH)}</KioskFact>
      </div>
      <p className="text-lg">{op.text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-12" onClick={() => setDocsFor({ wo, op })}>Drawings and work instructions (rev {wo.routingRev})</Button>
        <Button asChild variant="ghost" className="h-12"><Link to={`/production/orders/${wo.id}`}>Order detail</Link></Button>
      </div>
      <DocsDialog s={s} target={docsFor} onClose={() => setDocsFor(null)} />

      {mode === "hold" && (
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold">Hold reason (pauses labor, flags dispatch, notifies the supervisor)</p>
          <div className="grid grid-cols-2 gap-4">
            {act.HOLD_REASONS.map((r) => (
              <Button key={r} variant="outline" className="h-16 text-base" onClick={() => {
                const res = exec(`Andon ${key}`, (d, c) => act.raiseAndon(d, c, wo.id, op.no, `${r}${r === "Machine down" ? `: ${station.name}` : ""}`))
                setBanner(res.ok ? { kind: "info", text: `Hold raised: ${r}${r === "Machine down" ? "; maintenance list notified" : ""}` } : { kind: "error", text: res.error })
                setMode("work")
              }}>{r}</Button>
            ))}
          </div>
        </div>
      )}

      {op.status !== "Not Started" && mode !== "hold" && mode !== "complete-qty" && (
        <>
          <section aria-label="Components" className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Components at this operation</h3>
            {op.components.length === 0 && <p className="text-muted-foreground">No components mapped to this operation.</p>}
            {op.components.map((c) => {
              const need = c.qtyPerUnit * wo.qty
              const done = c.issued >= need
              return (
                <div key={c.materialId} className={`flex min-h-12 flex-wrap items-center gap-4 rounded-md border px-4 ${done ? "bg-status-passed-tint" : ""}`}>
                  <span className="font-mono">{c.materialId}</span>
                  <span className="flex-1 truncate">{matDesc(c.materialId)}</span>
                  <span className="tabular">{qty(c.issued)} / {qty(need)}</span>
                  <span>{c.issue === "backflush" ? "Backflush at confirmation" : c.serialized ? "Serial (SP-08 / SP-12)" : done ? "Scanned" : "Scan batch"}</span>
                  <span className="font-mono text-sm text-muted-foreground">{c.lots.join(", ")}</span>
                </div>
              )
            })}
          </section>
          {(() => {
            const tpl = ext.publishedTemplateFor(s, op.workCenterId)
            if (tpl) return <CaptureEntry template={tpl} values={op.capture} onSet={(label, value) => { const r = exec(`Capture ${label}`, (d, c) => ext.captureField(d, c, wo.id, op.no, label, value)); return r.ok ? null : r.error }} />
            return op.captureTemplate ? (
              <section aria-label="Data capture" className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold">Data capture</h3>
                <div className="grid grid-cols-3 gap-4">
                  {op.captureTemplate.map((f) => (
                    <span key={f} className="grid gap-1">
                      <Label htmlFor={`cap-${f}`} className="text-base">{f}</Label>
                      <Input id={`cap-${f}`} className="h-12 text-base" defaultValue={op.capture?.[f] ?? ""} onBlur={(e) => e.target.value !== (op.capture?.[f] ?? "") && exec(`Capture ${f}`, (d, c) => act.captureValue(d, c, wo.id, op.no, f, e.target.value))} />
                    </span>
                  ))}
                </div>
              </section>
            ) : null
          })()}
          {ext.needsNameplate(op) && (
            <section aria-label="Nameplate verification" className="flex flex-col gap-2 rounded-md border p-4">
              <h3 className="text-lg font-semibold">Nameplate verification <span className="font-mono text-sm font-normal">SP-13</span></h3>
              <p className="text-base">{ext.nameplateRemaining(wo, op).length ? `Scan each unit's nameplate before Complete: ${ext.verifiedSerials(op).length} of ${wo.serials.length} verified. A plate that does not match the order serial stops with E-BC-06.` : `All ${wo.serials.length} nameplate(s) match the order serial.`}</p>
              {ext.verifiedSerials(op).length > 0 && <p className="font-mono text-sm text-muted-foreground">{ext.verifiedSerials(op).join(", ")}</p>}
            </section>
          )}
          {op.qcGate && <p className="text-base">QC gate: {op.qcGate}. {op.inspection ? `${op.inspection.id} ${op.inspection.result ?? "waiting for result"}${op.inspection.restriction ? `. Restriction: ${op.inspection.restriction}` : ""}` : "Request the inspection; Complete is disabled until the result is posted."}</p>}
        </>
      )}

      {mode === "complete-qty" && (
        <section aria-label="Complete operation" className="flex flex-col gap-4">
          <p className="text-lg">Good + scrap + rework must equal the started quantity {started}.</p>
          <div className="grid grid-cols-4 gap-4">
            {(["good", "scrap", "rework", "hours"] as const).map((k) => (
              <span key={k} className="grid gap-1">
                <Label htmlFor={`cq-${k}`} className="text-base capitalize">{k === "hours" ? `Crew hours (std ${qty(stdH)})` : k}</Label>
                <Input id={`cq-${k}`} type="number" min={0} className="h-12 text-lg" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </span>
            ))}
          </div>
          {sc > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Scrap reason">
              {act.SCRAP_REASONS.map((r) => <Button key={r} role="radio" aria-checked={form.scrapReason === r} variant={form.scrapReason === r ? "secondary" : "outline"} className="h-12" onClick={() => setForm({ ...form, scrapReason: r })}>{r}</Button>)}
            </div>
          )}
          {g + sc + rw !== started && <p role="alert" className="text-destructive">Sum is {g + sc + rw}; it must be {started}.</p>}
          {needs.length > 0 && (
            <div role="alert" className="flex flex-col gap-2 rounded-md border border-status-blocked p-3">
              <p className="text-base">Supervisor needed: {needs.join("; ")}.</p>
              <div className="flex flex-wrap items-end gap-2">
                <span className="grid gap-1"><Label htmlFor="sup-badge">Supervisor badge</Label><Input id="sup-badge" className="h-12 w-48 text-base" value={sup.badge} onChange={(e) => setSup({ ...sup, badge: e.target.value })} placeholder="BDG-7031" /></span>
                <span className="grid flex-1 gap-1"><Label htmlFor="sup-why">Supervisor reason</Label><Input id="sup-why" className="h-12 text-base" value={sup.reason} onChange={(e) => setSup({ ...sup, reason: e.target.value })} /></span>
              </div>
              <span><Chip kind="design" note={`Scrap threshold ${Math.round(act.SCRAP_SUPERVISOR_PCT * 100)}% of the started quantity is a design value; the ±20% hours guardrail is the PRD's`}>Reading</Chip></span>
            </div>
          )}
          <PostingPreview lines={[
            ...op.components.filter((c) => c.issue === "backflush").map((c) => ({ template: 28 as const, amount: c.qtyPerUnit * (g + rw) * stdOf(c.materialId), detail: `Backflush ${c.materialId} × ${qty(c.qtyPerUnit * (g + rw))} at standard` })),
            { template: 29, amount: hrs * (lr + oh), detail: `${hrs} h × (${lr.toFixed(2)} labor + ${oh.toFixed(2)} overhead)` },
            ...(sc > 0 ? [{ template: 30 as const, amount: act.scrapValue(s, wo, started, sc), detail: `${sc} scrapped, ${form.scrapReason || "reason required"}: component value scrapped (material per started unit)` }] : []),
          ]} />
        </section>
      )}
    </KioskPage>
  )
}
