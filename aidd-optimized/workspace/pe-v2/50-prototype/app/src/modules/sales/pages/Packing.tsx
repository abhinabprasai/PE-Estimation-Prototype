// OM-PACK queue (office-dense) and pack station (floor-touch, fixed 1280 x 800, light theme only).
// Station route is not stated in the specification; /sales/packing/station/:id is a placeholder.
// The station runs on the shared KioskPage + ScanField (fixes critique F-01: no refocus on blur).
import { useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, DensityToggle, EmptyState, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { KioskPage } from "@/components/templates"
import { PostingPreview, ScanField, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { useStore } from "../data/store"
import { kg, money, product } from "../data/model"
import { huPackagingCost, huPackagingDetail } from "../data/packaging"
import { Reading } from "../components/ext"
import { cn } from "@/lib/utils"

export function PackingQueue() {
  const { db } = useStore()
  const loading = useFirstVisitLoading("packing")
  const [density, setDensity] = useState<Density>("compact")
  const [wh, setWh] = useState("All")
  const queue = db.deliveries.filter((d) => d.status === "Picking" && (wh === "All" || d.warehouse === wh))
  const warehouses = ["WH-TBD-01 Fargo, ND", "WH-TBD-02 Regina, SK", "WH-TBD-03 Winnipeg, MB"]
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Packing queue</h1>
        <label className="flex items-center gap-2 text-sm">
          Warehouse
          <select className="h-8 rounded-md border border-input bg-background px-2" value={wh} onChange={(e) => setWh(e.target.value)}>
            <option>All</option>
            {warehouses.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted-foreground">{queue.length} pack orders (deliveries at Picking with a completed picklist)</span>
        <div className="ml-auto">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>
      {!loading && queue.length === 0 ? (
        <EmptyState title="No completed picklists. Pack orders appear here when a delivery's pick is confirmed.">
          {wh !== "All" && (
            <Button variant="outline" onClick={() => setWh("All")}>
              Clear filter
            </Button>
          )}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Pack order (delivery)</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Delivery status</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>HUs</TableHead>
              <TableHead>Warehouse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={6} />
            ) : (
              queue.map((d) => {
                const c = db.customers.find((x) => x.id === d.customerId)!
                const hus = db.hus.filter((h) => h.deliveryId === d.id)
                return (
                  <TableRow key={d.id} className={rowCls(density)}>
                    <TableCell>
                      <Link className="text-link underline" to={`/sales/packing/station/${d.id}`}>
                        {d.id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-80 truncate" title={c.name}>
                      {c.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge entity="delivery" status={d.status} />
                    </TableCell>
                    <TableCell className="tabular">{d.refs.reduce((s, r) => s + r.qty, 0)}</TableCell>
                    <TableCell className="tabular">
                      {hus.filter((h) => h.status === "Closed").length} closed of {hus.length}
                    </TableCell>
                    <TableCell>{d.warehouse}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Pack orders carry no status list of their own in the entity model; the delivery's status is shown.</p>
    </div>
  )
}

export function PackStation() {
  const { id = "" } = useParams()
  const { db, actions } = useStore()
  const d = db.deliveries.find((x) => x.id === id)
  const hus = db.hus.filter((h) => h.deliveryId === id)
  const [selected, setSelected] = useState<string | null>(hus.find((h) => h.status === "Open")?.id ?? null)
  const [fail, setFail] = useState<string | null>(null)
  const [ok, setOk] = useState<{ text: string; n: number } | null>(null)
  const [reopenFor, setReopenFor] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const scanRef = useRef<ScanFieldHandle>(null)
  // Focus returns to the scan field only after an action is processed or a banner is dismissed,
  // never on blur (F-01): every button below stays reachable with Tab.
  const refocus = () => setTimeout(() => scanRef.current?.focus(), 0)

  if (!d)
    return (
      <KioskPage title="Pack station" screenId="OM-PACK-*" station="PACK-TBD-01" exitTo="/sales/packing">
        <p className="text-lg">
          Pack order {id} not found. <Link className="text-link underline" to="/sales/packing">Back to the packing queue</Link>
        </p>
      </KioskPage>
    )
  const c = db.customers.find((x) => x.id === d.customerId)!
  const serials = db.serials.filter((s) => s.deliveryId === d.id)
  const items = d.refs.flatMap((r) => {
    const l = db.orders.find((o) => o.id === r.soId)!.lines.find((x) => x.no === r.line)!
    return Array.from({ length: r.qty }, () => l.item)
  })
  const sel = hus.find((h) => h.id === selected)
  const report = (r: { ok: boolean; error?: string }, okText: string) => {
    if (!r.ok) setFail(r.error ?? "Failed")
    else {
      setFail(null)
      setOk({ text: okText, n: Date.now() })
    }
    refocus()
  }
  const nextExpected = !sel
    ? "Create an HU for the next transformer"
    : sel.status !== "Open"
      ? `${sel.id} is ${sel.status}. Create the next HU or select an Open one`
      : !sel.serial
        ? `Scan the serial for ${sel.item} into ${sel.id}`
        : sel.actualKg == null
          ? `Take a scale reading for ${sel.id}`
          : `Scan the HU label of ${sel.id} (SSCC ${sel.sscc}) to close it`
  const allClosed = hus.length === items.length && hus.every((h) => h.status === "Closed")
  // SP-17: HU label scan-back + scale weight [reference tables C SP-17, DOC:p.96]. Once the serial is in
  // and a scale reading is taken, the HU label is printed for scan-back; scanning it closes the HU (the
  // ±2% weight check runs in the close). "Close HU" stays as the keyboard path with the same checks.
  const labelMode = !!sel && sel.status === "Open" && !!sel.serial && sel.actualKg != null
  const onLabelScan = (code: string): ScanOutcome => {
    if (!sel) return { ok: false, errorCode: "SP-17", message: "no HU selected", expected: "the HU label", next: "Select an Open HU" }
    const v = code.trim().toUpperCase()
    if (v !== sel.sscc && v !== sel.id) return { ok: false, errorCode: "SP-17", message: `${v} is not the label of ${sel.id}`, expected: `SSCC ${sel.sscc} (${sel.id})`, next: "Scan the label just printed for this HU" }
    const r = actions.closeHU(sel.id)
    if (!r.ok) return { ok: false, errorCode: "SP-17", message: r.error, expected: `${kg(Math.round(sel.expectedKg * 0.98))} to ${kg(Math.round(sel.expectedKg * 1.02))}`, next: "Check the contents and re-weigh (Use next reading), then scan the label again" }
    setFail(null)
    return { ok: true, message: `${sel.id} label scanned back, weight ${kg(sel.actualKg!)} within ±2%: HU closed. Posting #27 ${money(huPackagingCost())}` }
  }
  const onScan = (code: string): ScanOutcome => {
    if (labelMode) return onLabelScan(code)
    if (!sel) return { ok: false, errorCode: "SP-16", message: "no HU selected", expected: "an Open HU to scan into", next: "Create HU, then scan the serial" }
    const r = actions.scanSerial(d.id, sel.id, code)
    if (r.ok) {
      setFail(null)
      return { ok: true, message: `${r.value} packed into ${sel.id} (SP-16, T10)` }
    }
    return { ok: false, errorCode: "SP-16", message: r.error, expected: `a serial reserved for ${d.id} (${sel.item})`, next: "Scan a serial listed under Items to pack" }
  }

  return (
    <KioskPage
      title="Pack station"
      screenId="OM-PACK-*"
      station="PACK-TBD-01"
      operator="Packer (no badge login in this prototype)"
      exitTo="/sales/packing"
      banners={
        <>
          {fail && (
            <div role="alert" className="flex items-center gap-4 rounded-md bg-destructive px-4 py-3 text-base text-destructive-foreground">
              <span className="font-semibold">Action not done.</span> <span>{fail}</span>
              <Button variant="outline" className="ml-auto h-12 bg-background text-base text-foreground" onClick={() => { setFail(null); refocus() }}>
                Dismiss
              </Button>
            </div>
          )}
          {ok && !fail && (
            <p role="status" key={ok.n} className="scan-flash rounded-md border px-4 py-3 text-base">
              {ok.text}
            </p>
          )}
        </>
      }
      scan={<ScanField ref={scanRef} key={labelMode ? "sp17" : "sp16"} scanPoint={labelMode ? "SP-17" : "SP-16"} label={labelMode ? "Scan the HU label back" : "Scan serial into the HU"} expected={nextExpected} onScan={onScan} disabled={d.status !== "Picking"} />}
      actions={[
        {
          label: "Create HU",
          disabled: d.status !== "Picking" || hus.length >= items.length,
          onClick: () => {
            const r = actions.createHU(d.id)
            if (r.ok) setSelected(r.value)
            report(r, r.ok ? `${r.value} created (Open)` : "")
          },
        },
        { label: "Close HU", disabled: !sel || sel.status !== "Open", onClick: () => sel && report(actions.closeHU(sel.id), `${sel.id} closed. HU label printed. Posting #27 shown.`) },
        { label: "Complete pack order", primary: true, disabled: d.status !== "Picking" || !allClosed, onClick: () => report(actions.completePack(d.id), "Pack order complete. Delivery Packed.") },
      ]}
    >
      <div className="flex flex-wrap items-center gap-4 text-lg">
        <span>
          Pack order <span className="font-mono">{d.id}</span> · {c.name}
        </span>
        <StatusBadge entity="delivery" status={d.status} />
      </div>
      <div className="grid grid-cols-[320px_1fr_360px] gap-8">
        <section aria-label="Items to pack" className="flex flex-col gap-2">
          <h2 className="font-semibold">Items to pack ({items.length})</h2>
          <ul className="flex flex-col gap-2">
            {serials.map((s) => (
              <li key={s.id} className="rounded-lg border p-2">
                <div className="font-mono">{s.id}</div>
                <div className="text-sm">
                  {s.item} · {product(s.item).description}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <StatusBadge entity="serial" status={s.status} /> {hus.find((h) => h.serial === s.id)?.id ?? "not packed"}
                </div>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Other serials in stock (not for this order)</h3>
          <ul className="text-sm">
            {db.serials
              .filter((s) => s.status === "Available" && items.includes(s.item))
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  {s.id} <StatusBadge entity="serial" status={s.status} />
                </li>
              ))}
          </ul>
        </section>
        <section aria-label="Scale and HU close" className="flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Scale readout (simulated) · SP-17</p>
            <p className="tabular text-3xl font-semibold">{sel?.actualKg != null ? kg(sel.actualKg) : "— kg"}</p>
            {sel && (
              <p className="text-sm">
                Expected {kg(sel.expectedKg)} · allowed ±2% ({kg(Math.round(sel.expectedKg * 0.98))} to {kg(Math.round(sel.expectedKg * 1.02))})
              </p>
            )}
            <Button variant="outline" className="mt-2 h-12 text-base" disabled={!sel || sel.status !== "Open"} onClick={() => sel && report(actions.nextReading(sel.id), "Scale reading taken")}>
              Use next reading
            </Button>
          </div>
          {labelMode && sel && <p className="rounded-lg border p-3 text-base">HU label printed for {sel.id}: SSCC <span className="font-mono">{sel.sscc}</span>. Scan it back to close (SP-17).</p>}
          <PostingPreview title="Posts at HU close" lines={[{ template: 27, amount: huPackagingCost(), detail: huPackagingDetail() }]} />
          <p className="text-sm text-muted-foreground"><Reading id="SR-24" note="Packaging bill per transformer HU (1 heavy skid, 1 accessory crate, 2 desiccant bags) is a design value; #27's basis 'backflush at standard' is the PRD's" /></p>
          {reopenFor && (
            <div className="rounded-lg border p-4">
              <label htmlFor="reopen-reason" className="block text-sm">
                Reason to reopen {reopenFor} (required)
              </label>
              <input id="reopen-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-12 w-full rounded-md border border-input bg-background px-2" />
              <div className="mt-2 flex gap-4">
                <Button
                  variant="outline"
                  className="h-12 text-base"
                  onClick={() => {
                    const r = actions.reopenHU(reopenFor, reason)
                    report(r, `${reopenFor} reopened`)
                    if (r.ok) {
                      setSelected(reopenFor)
                      setReopenFor(null)
                      setReason("")
                    }
                  }}
                >
                  Reopen HU
                </Button>
                <Button variant="ghost" className="h-12 text-base" onClick={() => { setReopenFor(null); refocus() }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
        <section aria-label="Handling units" className="flex flex-col gap-2">
          <h2 className="font-semibold">
            Handling units ({hus.length} of {items.length}) <Chip kind="k" id="K-03" note="One label at HU close, 'HU label'; no label-type list" />
          </h2>
          <ul className="flex flex-col gap-2">
            {hus.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => {
                    setSelected(h.id)
                    refocus()
                  }}
                  aria-pressed={selected === h.id}
                  className={cn("min-h-12 w-full rounded-lg border p-2 text-left", selected === h.id && "border-2 border-ring")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{h.id}</span> <StatusBadge entity="hu" status={h.status} />
                  </div>
                  <div className="font-mono text-sm">SSCC {h.sscc}</div>
                  <div className="text-sm">
                    {h.item} · └ {h.serial ?? "no serial yet"}
                  </div>
                  <div className="text-sm">
                    {h.actualKg != null ? `${kg(h.actualKg)} of ${kg(h.expectedKg)}` : `expected ${kg(h.expectedKg)}`} · HU label printed: {h.labelPrinted ? "yes" : "no"}
                  </div>
                  {h.status === "Closed" && <div className="text-xs">Posting #27 DR 5120 Packaging / CR 1360 Packaging on Hand</div>}
                </button>
                {h.status === "Closed" && d.status === "Picking" && (
                  <Button variant="ghost" className="h-12 text-base" onClick={() => setReopenFor(h.id)}>
                    Reopen {h.id} with reason
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <details className="text-sm">
        <summary className="min-h-12 cursor-pointer py-3">Rules on this screen (5)</summary>
        <ul>
          <li>R-17 HU close needs gross weight within ±2% of expected; reopen allowed until Loaded with a reason; one transformer serial per primary HU [DOC:p.31-32 §5; p.96 SP-17; p.128] (asserted)</li>
          <li>R-24 Floor devices: 48 px minimum targets, 16 px base font, scan feedback under 400 ms with sound and a visual change, no silent failure [DOC:p.241 §8.4] (asserted)</li>
          <li>R-14 #27 posts at HU close [DOC:pp.124-125 Part J] (asserted)</li>
          <li>SP-16 serial scan into HU [DOC:pp.95-96] (asserted)</li>
          <li>Focus: the scan field takes focus on arrival and after each scan, action or dismiss, never on blur, so every control is reachable by keyboard (fixes critique F-01)</li>
        </ul>
      </details>
    </KioskPage>
  )
}
