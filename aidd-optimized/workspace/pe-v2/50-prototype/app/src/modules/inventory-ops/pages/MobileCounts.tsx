// FX-INV-MCOUNT Mobile count entry (Zebra TC77). Blind entry, SP-20, autosave, recount by a different
// counter. KioskPage with the handheld task area (RD-IO-17). The count documents belong to the
// materials slice; this screen reads and writes them through the store (README "Integration").
// Sources: Book I Part A §7 [DOC:pp.36-37] (document lifecycle S-40, blind rule, R-CNT-02, R-CNT-03,
// zero count, unlisted batch, tolerances); Book VIII §5.3 (counting follows the document lifecycle,
// blind enforced server side); SP-20 [DOC:p.96] (asserted).
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { KioskFact, KioskPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, ScanField, StatusBadge, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { USERS } from "@/data/shared"
import type { UserId } from "@/data/domain"
import { useCore, useRole, useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { HandheldFrame } from "../components/handheld"
import { Reading, matShort, userName } from "../components/bits"
import { useViewState } from "../components/states"
import { counterView, type CounterLine } from "../lib/count"
import { FLOOR_COUNT_ROLES } from "../lib/rules"
import * as A from "../data/count-actions"

const SP20 = "SP-20"
type Pending = { docId: string; lineNo: number; qty: number }

export function MobileCounts() {
  const mats = useSlice("materials")
  const core = useCore()
  const [role, setRole] = useRole()
  const ss = useViewState("FX-INV-MCOUNT", { offlineQueues: true, degradedWhat: "The valuation service is slow, so the recount check cannot run", authorizedRoles: FLOOR_COUNT_ROLES })
  const me = core.userId
  const onFloor = FLOOR_COUNT_ROLES.includes(role)
  const [docId, setDocId] = useState<string | null>(null)
  const [openId, setOpenId] = useState("")
  const [openErr, setOpenErr] = useState<string | null>(null)
  const [vals, setVals] = useState<Record<number, string>>({})
  const [line, setLine] = useState<number | null>(null)
  const [bin, setBin] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Record<number, string>>({})
  const [errs, setErrs] = useState<Record<number, string>>({})
  const [queue, setQueue] = useState<Pending[]>([])
  const [banner, setBanner] = useState<{ title: string; body: string } | null>(null)
  const [dlg, setDlg] = useState<null | "submit" | "unlisted" | { route: string }>(null)
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const scanRef = useRef<ScanFieldHandle>(null)

  const docs = useMemo(() => A.mobileDocs(mats, role, me), [mats, role, me])
  const doc = docId ? mats.countDocuments.find((c) => c.id === docId) : undefined
  const cv = doc ? counterView(doc) : undefined
  const submitted = role === "Warehouse supervisor" ? mats.countDocuments.filter((c) => c.status === "Submitted") : []
  const writable = ss.canWrite && !ss.loading
  const refusal = doc ? A.recountRefusal(doc, me) : undefined
  const mine = !!doc && (docs.some((d) => d.id === doc.id) || doc.status === "Assigned")

  // Offline: entries wait on the device and replay when the connection returns (queue holds up to 4 h).
  useEffect(() => {
    if (ss.offline || !queue.length) return
    let ok = 0
    for (const q of queue) if (A.saveCount(q.docId, q.lineNo, q.qty).ok) ok++
    toast.success(`${ok} queued entr${ok === 1 ? "y" : "ies"} replayed`)
    setQueue([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ss.offline])

  const commit = (l: CounterLine, text: string) => {
    if (!doc || !text.trim()) return
    const qty = Number(text)
    if (!Number.isFinite(qty) || qty < 0) return setErrs((e) => ({ ...e, [l.no]: "Enter a quantity of zero or more." }))
    if (l.entered === qty && !ss.offline) return
    setErrs((e) => ({ ...e, [l.no]: "" }))
    if (ss.offline) {
      setQueue((q) => [...q.filter((x) => !(x.docId === doc.id && x.lineNo === l.no)), { docId: doc.id, lineNo: l.no, qty }])
      setSavedAt((s) => ({ ...s, [l.no]: "on the device" }))
      return
    }
    const r = A.saveCount(doc.id, l.no, qty)
    if (!r.ok) return setErrs((e) => ({ ...e, [l.no]: r.error }))
    setSavedAt((s) => ({ ...s, [l.no]: new Date().toTimeString().slice(0, 8) }))
  }
  // RD-IO-16: save 600 ms after the last keystroke, or on blur.
  const onType = (l: CounterLine, text: string) => {
    setVals((v) => ({ ...v, [l.no]: text }))
    clearTimeout(timers.current[l.no])
    timers.current[l.no] = setTimeout(() => commit(l, text), 600)
  }
  const valueOf = (l: CounterLine) => vals[l.no] ?? (l.entered != null ? String(l.entered) : "")

  const open = (id: string) => {
    setOpenErr(null)
    const c = mats.countDocuments.find((x) => x.id === id.trim().toUpperCase())
    if (!c) return setOpenErr(`${id.trim() || "That number"} is not a count document.`)
    const rf = A.recountRefusal(c, me)
    if (rf) return setOpenErr(rf)
    if (!A.mobileDocs(mats, role, me).some((d) => d.id === c.id)) return setOpenErr(`${c.id} is not assigned to you, or is not open for entry (it is ${c.status}). Counters see only their own documents (§7.3).`)
    setDocId(c.id)
    setVals({})
    setLine(null)
    setBin(null)
    setSavedAt({})
    setErrs({})
    setBanner(null)
  }
  const back = () => {
    setDocId(null)
    setBanner(null)
  }

  const onScan = (raw: string): ScanOutcome => {
    if (!doc || !cv) return { ok: false, expected: "an open count document", next: "Open a document first.", message: "No document is open" }
    const code = raw.trim().toUpperCase()
    const sel = cv.lines.find((l) => l.no === line)
    if (sel?.serialized && code.startsWith("SN-")) {
      const r = A.scanSerial(doc.id, sel.no, code)
      return r.ok ? { ok: true, message: `Serial counted on line ${sel.no}` } : { ok: false, expected: "a serial on this line", next: "Scan the next serial, or move to another line.", message: r.error }
    }
    const inBin = cv.lines.filter((l) => l.bin.toUpperCase() === code)
    if (inBin.length) {
      setBin(code)
      setLine((inBin.find((l) => l.entered == null) ?? inBin[0]).no)
      return { ok: true, message: `Bin ${code}: ${inBin.length} line(s)` }
    }
    const hit = cv.lines.filter((l) => (l.batch?.toUpperCase() === code || l.itemId.toUpperCase() === code) && (!bin || l.bin.toUpperCase() === bin))
    if (hit.length) {
      setLine(hit[0].no)
      return { ok: true, message: `${hit[0].itemId}${hit[0].batch ? ` ${hit[0].batch}` : ""} at ${hit[0].bin}: enter the quantity` }
    }
    return { ok: false, message: "Not on this count document", expected: `a bin, item or batch of ${doc.id}`, next: "Rescan the label. Stock that is on no line is added with Add unlisted batch." }
  }

  const status = (s: string) => <StatusBadge kind="countDocument" status={s} size="lg" />
  const counted = cv ? cv.lines.filter((l) => l.entered != null).length : 0

  // ---- actions per view
  const actions = []
  if (doc && cv && mine && !refusal) {
    if (doc.status === "Assigned") actions.push({ label: "Start counting", primary: true, disabled: !writable, onClick: () => { const r = A.startCounting(doc.id); if (!r.ok) toast.error(r.error); else toast.success("Counting started") } })
    if (doc.status === "Counting") {
      actions.push({ label: "Submit count", primary: true, disabled: !writable || ss.degraded || counted < cv.lines.length, onClick: () => setDlg("submit") })
      actions.push({ label: "Add unlisted batch", disabled: !writable, onClick: () => setDlg("unlisted") })
    }
    if (doc.status === "Recount") actions.push({ label: "Finish recount", primary: true, disabled: !writable || ss.degraded || counted < cv.lines.length, onClick: () => setDlg("submit") })
    actions.push({ label: "Back to documents", onClick: back })
  } else if (doc) actions.push({ label: "Back to documents", primary: true, onClick: back })

  const banners = (
    <div className="flex flex-col gap-2 empty:hidden">
      {ss.banners}
      {ss.error && <ErrorAlert title="The count list could not be loaded" action={<button className="underline" onClick={ss.onRetry}>Try again</button>}>{ss.error}</ErrorAlert>}
      {banner && <ErrorAlert title={banner.title} onDismiss={() => setBanner(null)}>{banner.body}</ErrorAlert>}
    </div>
  )

  return (
    <KioskPage
      title="Count entry"
      screenId="FX-INV-MCOUNT"
      operator={onFloor ? userName(me) : undefined}
      station="Handheld TC77"
      online={!ss.offline}
      queued={queue.length}
      exitTo="/inventory/counting/count-documents"
      banners={banners}
      scan={doc && cv && mine && !refusal && (doc.status === "Counting" || doc.status === "Recount") && ss.canWrite ? <ScanField ref={scanRef} scanPoint={SP20} expected="Scan the bin, then the item or batch label (a serial on serialized lines)" onScan={onScan} label="Bin and item or batch" /> : undefined}
      actions={actions}
    >
      <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
        <span>Preview a state</span>
        {ss.toolbar}
      </div>
      {!onFloor ? (
        <HandheldFrame>
          <p className="text-base font-semibold">Badge in to count</p>
          <p className="text-base">Counting is done by a Warehouse operator or a Warehouse supervisor. You are acting as {role}.</p>
          {FLOOR_COUNT_ROLES.map((r) => (
            <Button key={r} variant="outline" className="h-12 text-base" onClick={() => setRole(r)}>
              Badge in as {r} ({userName(USERS.find((u) => u.roles.includes(r))?.id)})
            </Button>
          ))}
        </HandheldFrame>
      ) : ss.loading ? (
        <HandheldFrame>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </HandheldFrame>
      ) : !doc || !cv ? (
        <HandheldFrame>
          <h2 className="text-lg font-semibold">Your count documents</h2>
          {openErr && <ErrorAlert title="That document is not open to you" onDismiss={() => setOpenErr(null)}>{openErr}</ErrorAlert>}
          {ss.empty || !docs.length ? (
            <EmptyState title="No count assigned to you">Documents appear here when the Warehouse supervisor assigns you and counting is open. A recount appears for the counter who did not count first.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {docs.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular font-mono text-base font-semibold">{c.id}</span>
                    {status(c.status)}
                  </div>
                  <span className="text-base">{c.location}</span>
                  <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
                    {c.blind && <Chip kind="design" note="Plan is blind: expected quantities are not sent to this device (p.37 §7.3)">Blind count</Chip>}
                    {c.status === "Recount" && <Chip kind="flag">Recount, flagged lines only</Chip>}
                  </div>
                  <Button className="h-12 text-base" disabled={ss.loading} onClick={() => open(c.id)}>Open</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="open-doc" className="text-base">Open by document number</Label>
            <div className="flex gap-2">
              <Input id="open-doc" className="h-12 font-mono text-base" value={openId} placeholder="CD-CP-2026-010-003" onChange={(e) => setOpenId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open(openId)} />
              <Button variant="outline" className="h-12 text-base" onClick={() => open(openId)}>Open</Button>
            </div>
          </div>
          {submitted.length > 0 && (
            <section aria-label="Submitted counts" className="flex flex-col gap-2 border-t pt-4">
              <h3 className="text-base font-semibold">Submitted, waiting to be routed</h3>
              {submitted.map((c) => {
                const flagged = c.lines.filter((l) => l.flags.includes("Recount Required")).length
                return (
                  <div key={c.id} className="flex flex-col gap-2 rounded-lg border p-3 text-base">
                    <span className="tabular font-mono font-semibold">{c.id}</span>
                    <span>{c.location}: {flagged ? `${flagged} line(s) beyond ±2% or ±$500, flagged Recount Required` : "all lines within tolerance"}</span>
                    <Button variant="outline" className="h-12 text-base" disabled={!writable} onClick={() => setDlg({ route: c.id })}>{flagged ? "Send to recount" : "Send to variance review"}</Button>
                  </div>
                )
              })}
            </section>
          )}
        </HandheldFrame>
      ) : refusal ? (
        <HandheldFrame>
          <ErrorAlert title="Recount refused">{refusal}</ErrorAlert>
        </HandheldFrame>
      ) : (
        <HandheldFrame>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular font-mono text-lg font-semibold">{cv.id}</span>
              {status(cv.status)}
            </div>
            <span className="text-base">{cv.location}</span>
            <span className="text-base text-muted-foreground">{cv.plan} · {counted} of {cv.lines.length} lines entered</span>
            <div className="flex flex-wrap gap-2 text-base">
              {cv.blind && <Chip kind="design" note="Expected quantities and variances are never sent to this device (server side, p.37 §7.3)">Blind: no expected quantity</Chip>}
              {cv.softFreeze ? <Chip kind="oq" id="E-CNT-01" note="Soft Freeze ON: movements post and flag the line Moved During Count, which forces a recount">Soft freeze</Chip> : <Chip kind="block" note="E-CNT-01: movements on these locations are blocked while the document is open">Locations frozen</Chip>}
              {cv.recount && <Chip kind="flag">Recount: you did not count first (R-CNT-02)</Chip>}
            </div>
          </div>
          {doc.status === "Assigned" && <p className="text-base">Press Start counting to open entry. Entry opens for the assigned counter only.</p>}
          {doc.status === "Submitted" && <KioskFact label="Submitted">The supervisor reconciles this count. You will not see expected quantities or variances.</KioskFact>}
          {(doc.status === "Counting" || doc.status === "Recount") && (
            <ul className="flex flex-col gap-3">
              {cv.lines.map((l, i) => {
                const active = line === l.no
                const err = errs[l.no] || (ss.validation && i === 0 ? "Enter a quantity of zero or more." : "")
                return (
                  <li key={l.no} className={cn("flex flex-col gap-2 rounded-lg border p-3", active && "border-primary bg-muted")}>
                    <button type="button" className="flex min-h-12 flex-col items-start text-left" onClick={() => setLine(l.no)} aria-pressed={active}>
                      <span className="text-lg font-semibold">{l.bin}</span>
                      <span className="text-base">{l.itemId} {matShort(l.itemId)}</span>
                      <span className="text-base text-muted-foreground">{l.batch ? `Batch ${l.batch} · ` : ""}{l.uom}{l.unlisted ? " · Unlisted batch" : ""}{l.movedDuringCount ? " · Moved during count" : ""}</span>
                    </button>
                    {l.serialized ? (
                      <div className="flex flex-col gap-1 text-base">
                        <span>{l.scannedSerials.length} serial(s) scanned</span>
                        {l.scannedSerials.map((s) => <span key={s} className="tabular font-mono">{s}</span>)}
                        <span className="text-muted-foreground">Scan each serial at the scan field; the count is the serials scanned.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`qty-${l.no}`} className="text-base">{cv.recount ? "Recount quantity" : "Counted quantity"} ({l.uom})</Label>
                        <Input
                          id={`qty-${l.no}`}
                          inputMode="decimal"
                          className="h-12 text-lg"
                          value={valueOf(l)}
                          disabled={!writable}
                          aria-invalid={!!err}
                          aria-describedby={`qty-${l.no}-msg`}
                          onFocus={() => setLine(l.no)}
                          onChange={(e) => onType(l, e.target.value)}
                          onBlur={() => { clearTimeout(timers.current[l.no]); commit(l, valueOf(l)) }}
                        />
                        <span id={`qty-${l.no}-msg`} aria-live="polite" className={cn("text-base", err ? "text-destructive" : "text-muted-foreground")}>
                          {err || (savedAt[l.no] ? `Saved ${savedAt[l.no]}` : l.entered != null ? "Saved" : "Not counted")}
                        </span>
                        {l.entered === 0 && !l.confirmedEmpty && (
                          <div className="flex flex-col gap-1">
                            <span className="text-base">A zero needs an explicit confirmation, not a blank.</span>
                            <Button variant="outline" className="h-12 text-base" disabled={!writable} onClick={() => { const r = A.confirmEmpty(cv.id, l.no); if (!r.ok) toast.error(r.error) }}>Confirm empty location</Button>
                          </div>
                        )}
                        {l.confirmedEmpty && <span className="text-base text-muted-foreground">Empty location confirmed</span>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-base text-muted-foreground">
            Posting on settle: count variance to 5310 Inventory Adjustment against the 13xx inventory account [DOC:p.37 §7.6]. Approval happens on the desktop{role === "Warehouse supervisor" ? <> in <Link className="text-link underline" to={`/inventory/counting/count-documents/${cv.id}`}>{cv.id}</Link></> : null}.
          </p>
          <div className="flex flex-wrap gap-2"><Reading id="RD-IO-16" /></div>
        </HandheldFrame>
      )}

      {/* submit / finish dialog */}
      <DialogShell
        open={dlg === "submit"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={doc?.status === "Recount" ? `Finish recount of ${doc?.id}` : `Submit ${doc?.id}`}
        consequence={doc?.status === "Recount" ? `Finishes the recount. If a recount differs from the first count by more than ±2% or ±$500 again, a third count is required with the supervisor and finance present (R-CNT-03). Otherwise ${doc?.id} goes to Variance Review.` : `Submits ${doc?.id} with ${cv?.lines.length} line(s). Lines beyond ±2% or ±$500 are flagged for recount by a different counter; you will not be shown which.`}
        confirmLabel={doc?.status === "Recount" ? "Finish recount" : "Submit count"}
        onConfirm={() => {
          if (!doc) return null
          if (doc.status === "Recount") {
            const r = A.finishRecount(doc.id)
            if (!r.ok) return r.error
            if (r.value.third.length) setBanner({ title: "Third count required (R-CNT-03)", body: `Line(s) ${r.value.third.join(", ")} differ from the first count again. The supervisor enters the third count with finance present; it is final.` })
            else toast.success("Recount finished")
            setDocId(null)
            return null
          }
          const r = A.submitCount(doc.id)
          if (!r.ok) return r.error
          toast.success(`${doc.id} submitted`)
          setDocId(null)
          return null
        }}
      />
      <UnlistedDialog open={dlg === "unlisted"} onClose={() => setDlg(null)} docId={doc?.id} bin={bin ?? ""} />
      <RouteDialog target={typeof dlg === "object" && dlg ? dlg.route : null} onClose={() => setDlg(null)} />
    </KioskPage>
  )
}

/** §7.4 item 4: stock found that is on no line becomes an Unlisted Batch line; the supervisor confirms it. */
function UnlistedDialog({ open, onClose, docId, bin }: { open: boolean; onClose: () => void; docId?: string; bin: string }) {
  const [f, setF] = useState({ bin, itemId: "", batch: "", qty: "" })
  useEffect(() => { if (open) setF((x) => ({ ...x, bin })) }, [open, bin])
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add unlisted batch"
      description="Stock you found that is on no line of the sheet."
      consequence={`Adds an Unlisted Batch line to ${docId ?? "the document"}. It counts only after the Warehouse supervisor confirms it, which raises a batch record correction.`}
      confirmLabel="Add line"
      onConfirm={() => {
        if (!docId) return "No document is open."
        const r = A.addUnlisted(docId, { bin: f.bin, itemId: f.itemId, batch: f.batch, qty: Number(f.qty) })
        if (!r.ok) return r.error
        toast.success(`Line ${r.value} added`)
        setF({ bin, itemId: "", batch: "", qty: "" })
        return null
      }}
    >
      <div className="grid gap-2">
        {([["bin", "Bin"], ["itemId", "Material number"], ["batch", "Batch number"], ["qty", "Quantity found"]] as const).map(([k, label]) => (
          <div key={k} className="flex flex-col gap-1">
            <Label htmlFor={`ul-${k}`}>{label}</Label>
            <Input id={`ul-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode={k === "qty" ? "decimal" : undefined} />
          </div>
        ))}
      </div>
    </DialogShell>
  )
}

/** Supervisor: a Submitted document goes to Recount (a recounter other than the first counter, R-CNT-02) or Variance Review. */
function RouteDialog({ target, onClose }: { target: string | null; onClose: () => void }) {
  const mats = useSlice("materials")
  const c = target ? mats.countDocuments.find((x) => x.id === target) : undefined
  const flagged = !!c?.lines.some((l) => l.flags.includes("Recount Required") && l.recount == null)
  const [who, setWho] = useState("")
  const eligible = USERS.filter((u) => u.roles.some((r) => FLOOR_COUNT_ROLES.includes(r)) && !c?.counterIds.includes(u.id as UserId))
  return (
    <DialogShell
      open={!!c}
      onOpenChange={(o) => !o && onClose()}
      title={flagged ? `Send ${c?.id} to recount` : `Send ${c?.id} to variance review`}
      consequence={flagged ? `Sends ${c?.id} to Recount: a different counter counts the flagged lines blind to the first count (R-CNT-02).` : `Sends ${c?.id} to Variance Review; every line is within tolerance.`}
      confirmLabel={flagged ? "Send to recount" : "Send to variance review"}
      onConfirm={() => {
        if (!c) return null
        const r = A.routeCount(c.id, (who || undefined) as UserId | undefined)
        if (!r.ok) return r.error
        toast.success(r.value ? `${c.id} sent to recount` : `${c.id} in variance review`)
        return null
      }}
    >
      {flagged && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="recounter">Recounter (not the first counter)</Label>
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger id="recounter" className="h-10 w-full"><SelectValue placeholder="Choose a counter" /></SelectTrigger>
            <SelectContent>{eligible.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.roles[0]})</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
    </DialogShell>
  )
}
