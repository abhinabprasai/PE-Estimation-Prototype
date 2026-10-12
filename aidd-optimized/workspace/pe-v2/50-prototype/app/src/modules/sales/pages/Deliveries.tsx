// OM-DLV-001 Delivery cockpit. Split and merge rule IDs are not stated: rules show by name with RULE-TBD.
// "16 stages" of Flow A: not numbered anywhere; readiness flags are "per Flow A stage 7" only.
import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, DensityToggle, ErrorAlert, KV, LifecycleStrip, ReadinessFlags, RulesPanel, StatusBadge, useFirstVisitLoading, type Density } from "../components/common"
import { HORIZON_DAYS, failingFlags, postingPreview, reversalBlock, useStore } from "../data/store"
import { LIFECYCLE, addDays, listDate, money, type Delivery } from "../data/model"
import { cn } from "@/lib/utils"

export function DeliveryCockpit() {
  const { db, actions } = useStore()
  const loading = useFirstVisitLoading("deliveries")
  const [density, setDensity] = useState<Density>("compact")
  const [sp, setSp] = useSearchParams()
  const [err, setErr] = useState<string | null>(null)
  const openId = sp.get("d")
  const open = db.deliveries.find((d) => d.id === openId)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Delivery cockpit</h1>
        <span className="text-sm text-muted-foreground">
          {db.deliveries.length} deliveries · horizon {HORIZON_DAYS} days (design value; not stated in the specification)
        </span>
        <div className="ml-auto flex gap-2">
          <DensityToggle value={density} onChange={setDensity} />
          <Button
            onClick={() => {
              const r = actions.createDeliveries()
              if (!r.ok) setErr(r.error)
              else {
                setErr(null)
                toast.success(`Created ${r.value.join(", ")} at Planned.`)
                setSp({ d: r.value[0] })
              }
            }}
          >
            Run delivery creation
          </Button>
        </div>
      </div>
      {err && (
        <div className="mb-4">
          <ErrorAlert title="No delivery created" onDismiss={() => setErr(null)}>
            {err}
          </ErrorAlert>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-4">
        {LIFECYCLE.delivery.map((st) => {
          const items = db.deliveries.filter((d) => d.status === st)
          return (
            <section key={st} aria-label={`${st} column`} className="flex w-56 shrink-0 flex-col gap-2 rounded-lg bg-muted/50 p-2">
              <h2 className="flex items-center justify-between text-sm font-semibold">
                <StatusBadge entity="delivery" status={st} />
                <span className="tabular">{loading ? "…" : items.length}</span>
              </h2>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                : items.length === 0
                  ? <p className="text-xs text-muted-foreground">No deliveries at {st}.</p>
                  : items.map((d) => {
                      const c = db.customers.find((x) => x.id === d.customerId)!
                      return (
                        <button
                          key={d.id}
                          onClick={() => setSp({ d: d.id })}
                          className={cn("flex flex-col gap-1 rounded-lg border bg-background text-left text-xs", density === "compact" ? "p-2" : "p-3 text-sm")}
                        >
                          <span className="font-semibold">{d.id}</span>
                          <span className="truncate" title={c.name}>
                            {c.name}
                          </span>
                          <span className="text-muted-foreground">
                            {d.soId} · Grouped by: {d.rule}
                          </span>
                          <span className="text-muted-foreground">Not passed: {failingFlags(d).join(", ") || "none"}</span>
                        </button>
                      )
                    })}
            </section>
          )
        })}
      </div>
      <Sheet open={!!open} onOpenChange={(b) => !b && setSp({})}>
        <SheetContent className="w-[760px] overflow-y-auto data-[side=right]:sm:max-w-3xl">{open && <DeliveryPanel key={open.id} d={open} />}</SheetContent>
      </Sheet>
      <RulesPanel
        rules={[
          ["R-10", "Deliveries consume schedule lines, never raw order lines.", "DOC:p.206 §2.1"],
          ["R-11", "Mandatory split on different ship-to, Incoterms, hazmat segregation, over-dimensional units, customer no-partial flag; elective split when schedules are more than 7 days apart; every grouping stores the rule that fired (E-DLV-01).", "DOC:p.207 §2.3"],
          ["R-12", "PGI only when supply, quality, credit and documents flags are all passed; inspection blocks PGI (E-OM-07); the shipment-release credit gate cannot be bypassed by sales roles.", "DOC:p.207 §2.4; p.176 f8; p.49 §2.2"],
          ["R-13", "PGI is one atomic transaction; a failure leaves the delivery at Loaded, never half-posted.", "DOC:p.176 f9; p.208 §2.5"],
          ["R-14", "PGI posts #25 and #26 (PE-paid freight only); #27 posts at HU close.", "DOC:pp.124-125 Part J"],
          ["R-15", "PGI role is not the invoice-posting role; shipping cannot edit prices.", "DOC:p.176 f13"],
          ["R-16", "PGI reversal: Shipping Manager only, before invoice, same fiscal period, reason mandatory.", "DOC:p.208 §2.5"],
          ["R-18", "SP-18 load scan accepts only HUs on this shipment (E-BC-08).", "DOC:p.96 SP-18"],
          ["R-19", "Carrier and tracking are manual in Phase 1 (DEC-04); expected POD date = ship date + planned transit days.", "DOC:p.205 DEC-04; p.207 §2.4"],
        ]}
      />
    </div>
  )
}

const EQUIPMENT = ["Flatbed", "Step deck", "Lowboy trailer", "Removable gooseneck (RGN)"]
const PERMITS = ["Oversize/overweight permit", "Escort vehicle arranged", "Route survey done"]

function DeliveryPanel({ d }: { d: Delivery }) {
  const { db, role, actions } = useStore()
  const c = db.customers.find((x) => x.id === d.customerId)!
  const hus = db.hus.filter((h) => h.deliveryId === d.id)
  const serials = db.serials.filter((s) => s.deliveryId === d.id)
  const [err, setErr] = useState<string | null>(null)
  const [scan, setScan] = useState("")
  const [scanFail, setScanFail] = useState<string | null>(null)
  const [scanOk, setScanOk] = useState<string | null>(null)
  const [pgiOpen, setPgiOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [revOpen, setRevOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [stub, setStub] = useState<string | null>(null)
  const [lp, setLp] = useState({
    equipment: d.equipment ?? "",
    door: d.door ?? "",
    slot: d.slot ?? "",
    carrier: d.carrier ?? "",
    pro: d.pro ?? "",
    transitDays: d.transitDays != null ? String(d.transitDays) : "",
    freight: d.freight != null ? String(d.freight) : "",
    permits: d.permits,
  })
  useEffect(() => {
    if (!posting) return
    const t = setTimeout(() => {
      const r = actions.pgi(d.id)
      setPosting(false)
      setPgiOpen(false)
      if (!r.ok) setErr(r.error)
      else {
        setErr(null)
        toast.success(`Goods issue posted ${r.value}.`)
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [posting, actions, d.id])

  const run = (r: { ok: boolean; error?: string }, msg?: string) => {
    if (!r.ok) setErr(r.error ?? "Action failed")
    else {
      setErr(null)
      if (msg) toast.success(msg)
    }
  }
  const fails = failingFlags(d)
  const prev = postingPreview(db, d)
  const revBlock = reversalBlock(db, d, role)
  const preLoad = !["PGI", "Delivered/Closed"].includes(d.status)
  const pod = db.pods.find((p) => p.deliveryId === d.id)

  return (
    <div className="flex flex-col gap-4 p-4">
      <SheetHeader className="p-0">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {d.id} <StatusBadge entity="delivery" status={d.status} />
        </SheetTitle>
        <SheetDescription>
          {c.name} · order <Link className="text-link underline" to={`/sales/orders/${d.soId}`}>{d.soId}</Link>
        </SheetDescription>
      </SheetHeader>
      <LifecycleStrip entity="delivery" status={d.status} />
      {err && (
        <ErrorAlert title={d.forcePgiFail && err.startsWith("Goods issue not posted") ? "PGI failed" : "Action not done"} onDismiss={() => setErr(null)}>
          {err}
        </ErrorAlert>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <KV k="Ship-to">{d.shipTo}</KV>
        <KV k="Incoterms">{d.incoterms}</KV>
        <KV k="Grouped by">
          {d.rule} · {d.ruleId}
        </KV>
        <KV k="Warehouse">{d.warehouse}</KV>
        <KV k="Readiness flags (per Flow A stage 7)">
          <ReadinessFlags flags={d.flags} />
        </KV>
        <KV k="Expected POD date (ship date + transit)">{d.shipDate && d.transitDays != null ? addDays(d.shipDate, d.transitDays) : "Not recorded"}</KV>
      </dl>

      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          Contents (schedule lines) <Chip kind="k" id="K-19" note="Deliveries consume schedule lines (Book IV outranks Book I)" />
        </h3>
        <ul className="text-sm">
          {d.refs.map((r) => {
            const o = db.orders.find((x) => x.id === r.soId)!
            const l = o.lines.find((x) => x.no === r.line)!
            const s = l.schedules.find((x) => x.no === r.sched)!
            return (
              <li key={`${r.line}-${r.sched}`} className="flex flex-wrap items-center gap-2">
                {r.soId} line {r.line} / schedule {r.sched}: {r.qty} × {l.item} <StatusBadge entity="schedule" status={s.status} />
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Handling units and serials</h3>
        {hus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No HUs yet. HUs are created at the pack station.</p>
        ) : (
          <ul className="text-sm">
            {hus.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                {h.id} · SSCC <span className="tabular">{h.sscc}</span> · {h.serial ?? "no serial"} <StatusBadge entity="hu" status={h.status} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 flex flex-wrap gap-2 text-sm">
          Serials:{" "}
          {serials.map((s) => (
            <span key={s.id} className="flex items-center gap-1">
              {s.id} <StatusBadge entity="serial" status={s.status} />
            </span>
          ))}
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        {d.status === "Planned" && <Button onClick={() => run(actions.release(d.id), "Released to warehouse.")}>Release to warehouse</Button>}
        {d.status === "Released" && <Button onClick={() => run(actions.confirmPick(d.id), "Pick confirmed.")}>Confirm pick (SP-15 stub)</Button>}
        {d.status === "Picking" && (
          <Button asChild>
            <Link to={`/sales/packing/station/${d.id}`}>Open pack station</Link>
          </Button>
        )}
        {d.status === "Packed" && <Button onClick={() => run(actions.passInspection(d.id), "Inspection passed.")}>Pass inspection (QM-EXEC stub)</Button>}
        <Button variant="outline" onClick={() => setStub("Print documents is a stub. No EDI dispatch advice is sent; carrier is manual per DEC-04.")}>
          Print documents
        </Button>
        <Chip kind="k" id="K-11" note="No EDI dispatch advice; carrier manual per DEC-04" />
      </section>

      {preLoad && (
        <section className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-semibold">Load plan (carrier typed by hand, DEC-04)</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Equipment type
              <select className="h-8 rounded-md border border-input bg-background px-2" value={lp.equipment} onChange={(e) => setLp({ ...lp, equipment: e.target.value })}>
                <option value="">Not set</option>
                {EQUIPMENT.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Dock door
              <Input value={lp.door} onChange={(e) => setLp({ ...lp, door: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Appointment slot
              <Input value={lp.slot} placeholder="2026-10-13 08:00–10:00" onChange={(e) => setLp({ ...lp, slot: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Carrier
              <Input value={lp.carrier} onChange={(e) => setLp({ ...lp, carrier: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              PRO/BOL #
              <Input value={lp.pro} onChange={(e) => setLp({ ...lp, pro: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Planned transit days
              <Input type="number" value={lp.transitDays} onChange={(e) => setLp({ ...lp, transitDays: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Quoted freight ({d.freightPaidBy})
              <Input type="number" value={lp.freight} placeholder="Not recorded" onChange={(e) => setLp({ ...lp, freight: e.target.value })} />
            </label>
            <fieldset className="text-sm">
              <legend>Permit checklist</legend>
              {PERMITS.map((p) => (
                <label key={p} className="flex items-center gap-2">
                  <input type="checkbox" checked={lp.permits.includes(p)} onChange={(e) => setLp({ ...lp, permits: e.target.checked ? [...lp.permits, p] : lp.permits.filter((x) => x !== p) })} />
                  {p}
                </label>
              ))}
            </fieldset>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Documents flag passes when carrier and PRO/BOL # are recorded <Chip kind="oq" id="OQ-32" />
          </p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() =>
              run(
                actions.saveLoadPlan(d.id, {
                  equipment: lp.equipment,
                  door: lp.door,
                  slot: lp.slot,
                  carrier: lp.carrier,
                  pro: lp.pro,
                  transitDays: lp.transitDays === "" ? undefined : Number(lp.transitDays),
                  freight: lp.freight === "" ? null : Number(lp.freight),
                  permits: lp.permits,
                }),
                "Load plan saved.",
              )
            }
          >
            Save load plan
          </Button>
        </section>
      )}
      {!preLoad && (
        <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          <KV k="Equipment / door / slot">
            {d.equipment ?? "Not recorded"} / {d.door ?? "Not recorded"} / {d.slot ?? "Not recorded"}
          </KV>
          <KV k="Carrier / PRO/BOL #">
            {d.carrier ?? "Not recorded"} / {d.pro ?? "Not recorded"}
          </KV>
          <KV k="Freight">{d.freight == null ? "Not recorded" : <span className="tabular">{money(d.freight, c.currency)} ({d.freightPaidBy})</span>}</KV>
          <KV k="Transit days">{d.transitDays ?? "Not recorded"}</KV>
        </dl>
      )}
      {preLoad && (
        <p className="text-sm">
          Freight on record: {d.freight == null ? "Not recorded" : <span className="tabular">{money(d.freight, c.currency)}</span>}
        </p>
      )}

      {["Quality Cleared", "Loaded"].includes(d.status) && (
        <section className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-semibold">SP-18 load scan at the truck</h3>
          {scanFail && (
            <div className="mb-2">
              <ErrorAlert title="Scan failed" onDismiss={() => setScanFail(null)}>
                {scanFail}
              </ErrorAlert>
            </div>
          )}
          {scanOk && <p className="scan-flash mb-2 rounded-md p-1 text-sm" role="status">{scanOk}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const r = actions.loadScan(d.id, scan)
              if (!r.ok) {
                setScanFail(r.error)
                setScanOk(null)
              } else {
                setScanFail(null)
                setScanOk(`${r.value} loaded.`)
              }
              setScan("")
            }}
          >
            <Label htmlFor="loadscan" className="sr-only">
              Scan HU or SSCC
            </Label>
            <Input id="loadscan" placeholder="Scan HU ID or SSCC" value={scan} onChange={(e) => setScan(e.target.value)} />
            <Button type="submit" variant="outline">
              Scan
            </Button>
          </form>
          <ul className="mt-2 text-sm">
            {hus.map((h) => (
              <li key={h.id}>
                {h.status === "Loaded" ? "☑" : "☐"} {h.id} ({h.status})
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.status === "Loaded" && (
        <section className="rounded-lg border p-3">
          <Button disabled={fails.length > 0} onClick={() => setPgiOpen(true)}>
            Post goods issue
          </Button>
          {fails.length > 0 && <p className="mt-1 text-sm">Post goods issue is disabled: readiness flags not passed: {fails.join(", ")} (R-12).</p>}
        </section>
      )}

      {(d.status === "PGI" || d.pgiId) && (
        <section className="rounded-lg border p-3 text-sm">
          <h3 className="mb-1 font-semibold">Goods issue</h3>
          {d.pgiId && (
            <p>
              {d.pgiId} on {d.shipDate} · fiscal period {d.pgiPeriod}
            </p>
          )}
          {d.irId && <p>Invoice request {d.irId} created at PGI{d.irWithdrawn ? "; withdrawn after PGI reversal" : " and handed to Finance (ACC)"}.</p>}
          {pod && (
            <p>
              POD <Link className="text-link underline" to={`/sales/pod/${pod.id}`}>{pod.id}</Link> <StatusBadge entity="pod" status={pod.status} />
            </p>
          )}
          {d.status === "PGI" &&
            (revBlock ? (
              <p className="mt-2 text-muted-foreground">{revBlock}</p>
            ) : (
              <Button variant="outline" className="mt-2" onClick={() => setRevOpen(true)}>
                Reverse PGI
              </Button>
            ))}
        </section>
      )}

      <section>
        <h3 className="mb-1 text-sm font-semibold">Activity</h3>
        <ul className="space-y-1 text-xs">
          {[...d.activity].reverse().map((a, i) => (
            <li key={i}>
              <span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={pgiOpen} onOpenChange={(b) => !posting && setPgiOpen(b)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Post goods issue · {d.id}</DialogTitle>
            <DialogDescription>One atomic transaction: stock, serials, journal and invoice request together. Posting preview:</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            <li>
              {prev.p25.text}: <span className="tabular font-semibold">{money(prev.p25.amount)}</span>
              <div className="text-xs text-muted-foreground">{prev.p25.detail}</div>
            </li>
            <li>
              {prev.p26.text}
              {prev.p26.amount != null && (
                <>
                  : <span className="tabular font-semibold">{money(prev.p26.amount)}</span>
                </>
              )}
              {prev.p26.detail && <div className="text-xs text-muted-foreground">{prev.p26.detail}</div>}
            </li>
            <li>Serials Reserved → Shipped; HUs Loaded → Shipped; POD row created at Expected; invoice request created.</li>
            <li>Fiscal period: 2026-10. #27 posted earlier at each HU close.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" disabled={posting} onClick={() => setPgiOpen(false)}>
              Cancel
            </Button>
            <Button disabled={posting} onClick={() => setPosting(true)}>
              {posting ? "Posting goods issue…" : "Confirm and post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse PGI · {d.id}</DialogTitle>
            <DialogDescription>Atomic mirror of #25/#26/#27. Serials Shipped → Reserved, HUs → Loaded, delivery → Packed, invoice request withdrawn. A reason is required.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="revreason">Reason</Label>
          <Input id="revreason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const r = actions.reversePGI(d.id, reason)
                if (!r.ok) setErr(r.error)
                else {
                  setRevOpen(false)
                  setErr(null)
                  toast.success("PGI reversed.")
                }
              }}
            >
              Reverse PGI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!stub} onOpenChange={() => setStub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not built in this prototype</DialogTitle>
            <DialogDescription>{stub}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">Delivery list dates: shipped {listDate(d.shipDate)}.</p>
    </div>
  )
}
