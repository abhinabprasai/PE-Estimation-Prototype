// OM-PACK queue (office-dense) and pack station (floor-touch, fixed 1280 x 800, light theme only) [DOC:pp.31-33 Book I A §5].
// Queue: pack order # PK-{YYYY}-{SEQ:5}, auto-created when a picklist completes (config: per picklist / per shipment),
// statuses Not Started, In Progress, Packed, Cancelled. Station: items remaining on the left, centre scan with focus
// lock, HU tree on the right; create HU, scan item (E-PCK-02), quantity (E-PCK-03), close HU with weight within ±2%,
// short-pack by a supervisor (Short Pick, Damage, Hold), reopen, move or split contents between HUs, nest HUs,
// photos (mandatory for transformers), live scale readout.
// The station runs on the shared KioskPage + ScanField (fixes critique F-01: no refocus on blur).
import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, DensityToggle, EmptyState, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { FamilyBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { StateBar, useFxState } from "./fx/kit"
import { ScaleReadout, useScaleState } from "./fx/ScaleReadout"
import { attachPhoto, moveContents, nestHu, setPackRule, shortPack, syncPackNodes } from "../fx/actions"
import { PHOTO_KINDS, SHORT_PACK_REASONS, type PackNode } from "../fx/model"
import { KioskPage } from "@/components/templates"
import { PostingPreview, ScanField, type ScanFieldHandle, type ScanOutcome } from "@/components/patterns"
import { useStore } from "../data/store"
import { TODAY, kg, listDate, money, product, type Delivery, type HU } from "../data/model"
import { huPackagingCost, huPackagingDetail } from "../data/packaging"
import { Reading } from "../components/ext"
import { cn } from "@/lib/utils"

type PackStatus = "Not Started" | "In Progress" | "Packed" | "Cancelled"
const PACK_FAMILY = { "Not Started": "draft", "In Progress": "pending", Packed: "done", Cancelled: "cancelled" } as const
/** Pack order # follows the delivery number (design value); status derives from the delivery and its HUs. */
export const packOrderNo = (d: { id: string }, n = 0) => `PK-2026-${String(Number(d.id.slice(-4)) * 10 + n).padStart(5, "0")}`
export const packStatus = (d: Delivery, hus: HU[]): PackStatus => (["Packed", "Quality Cleared", "Loaded", "PGI", "Delivered/Closed"].includes(d.status) ? "Packed" : hus.length === 0 ? "Not Started" : "In Progress")
const PACKER = "Packer (assigned at the station)"

export function PackingQueue() {
  const { db } = useStore()
  const first = useFirstVisitLoading("packing")
  const st = useFxState()
  const loading = first || st.loading
  const [density, setDensity] = useState<Density>("compact")
  const [wh, setWh] = useState("All")
  const [err, setErr] = useState<string | null>(null)
  const rule = db.fx.packRule
  const queue = st.empty ? [] : db.deliveries.filter((d) => ["Picking", "Packed"].includes(d.status) && (wh === "All" || d.warehouse === wh))
  const rows = queue.flatMap((d) => (rule === "Per picklist" && d.refs.length > 1 ? d.refs.map((r, i) => ({ d, n: i + 1, refs: [r] })) : [{ d, n: 0, refs: d.refs }]))
  const warehouses = ["WH-TBD-01 Fargo, ND", "WH-TBD-02 Regina, SK", "WH-TBD-03 Winnipeg, MB"]
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Packing queue</h1>
        <Chip kind="design" note="Screen id OM-PACK-LIST-001, route /sales/packing [DOC:p.31 §5.2]">OM-PACK-LIST-001</Chip>
        <label className="flex items-center gap-2 text-sm">
          Warehouse
          <select className="h-8 rounded-md border border-input bg-background px-2" value={wh} onChange={(e) => setWh(e.target.value)}>
            <option>All</option>
            {warehouses.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Pack order creation rule
          <select aria-label="Pack order creation rule" className="h-8 rounded-md border border-input bg-background px-2" value={rule} disabled={!st.writable} onChange={(e) => { const r = setPackRule(e.target.value as typeof rule); setErr(r.ok ? null : r.error) }}>
            <option>Per picklist</option>
            <option>Per shipment</option>
          </select>
        </label>
        <span className="text-sm text-muted-foreground">{rows.length} pack orders</span>
        <div className="ml-auto">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>
      <div className="mb-3"><StateBar st={st} /></div>
      {err && <p role="alert" className="mb-2 text-sm text-destructive">{err}</p>}
      <p className="mb-2 text-xs text-muted-foreground">Auto-created when a picklist completes (config: per picklist / per shipment). Per picklist makes one pack order per schedule line of the delivery; per shipment makes one for the whole delivery. <Reading id="SR-39" note="Pack order numbers follow the delivery number; the PRD gives only the format PK-{YYYY}-{SEQ:5}." /></p>
      {!loading && rows.length === 0 ? (
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
              <TableHead>Customer / ship-to</TableHead>
              <TableHead>Required ship date</TableHead>
              <TableHead>Delivery status</TableHead>
              <TableHead>Pack order status</TableHead>
              <TableHead>Lines / qty outstanding</TableHead>
              <TableHead>Packer</TableHead>
              <TableHead>HUs</TableHead>
              <TableHead>Warehouse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={9} />
            ) : (
              rows.map(({ d, n, refs }) => {
                const c = db.customers.find((x) => x.id === d.customerId)!
                const hus = db.hus.filter((h) => h.deliveryId === d.id)
                const o = db.orders.find((x) => x.id === d.soId)
                const required = o?.requestedShip ?? TODAY
                const ps = packStatus(d, hus)
                const packed = hus.filter((h) => h.serial).length
                return (
                  <TableRow key={`${d.id}-${n}`} className={rowCls(density)}>
                    <TableCell>
                      <Link className="text-link underline" to={`/sales/packing/station/${d.id}`}>
                        {packOrderNo(d, n)}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{d.id} · picklist from {d.soId}</span>
                    </TableCell>
                    <TableCell className="max-w-80 truncate" title={c.name}>
                      {c.name}
                      <span className="block text-xs text-muted-foreground">{d.shipTo.split(",").slice(-2).join(",").trim()}</span>
                    </TableCell>
                    <TableCell className={cn(required <= TODAY && ps !== "Packed" && "font-semibold text-destructive")}>{listDate(required)}{required <= TODAY && ps !== "Packed" ? " (today or past)" : ""}</TableCell>
                    <TableCell>
                      <StatusBadge entity="delivery" status={d.status} />
                    </TableCell>
                    <TableCell><FamilyBadge family={PACK_FAMILY[ps]} label={ps} title="Pack order status, p.31 §5.2" /></TableCell>
                    <TableCell className="tabular">{refs.length} line(s) · {Math.max(0, refs.reduce((s, r) => s + r.qty, 0) - (n === 0 ? packed : 0))} of {refs.reduce((s, r) => s + r.qty, 0)}</TableCell>
                    <TableCell>{hus.length ? PACKER : "Not assigned"}</TableCell>
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
    </div>
  )
}

const selCls = "h-12 w-full rounded-md border border-input bg-background px-2 text-base"

/** HU tree: nesting from the pack extension (a tote in a crate, a crate on a skid). */
function HuTree({ nodes, hus, selected, onSelect, d }: { nodes: PackNode[]; hus: HU[]; selected: string | null; onSelect: (id: string) => void; d: Delivery }) {
  const { actions } = useStore()
  const render = (parent?: string, depth = 0): React.ReactNode =>
    nodes.filter((n) => n.parent === parent && hus.some((h) => h.id === n.hu)).map((n) => {
      const h = hus.find((x) => x.id === n.hu)!
      return (
        <li key={n.hu} style={{ marginLeft: depth * 16 }} className="flex flex-col gap-1">
          <button onClick={() => onSelect(h.id)} aria-pressed={selected === h.id} className={cn("min-h-12 w-full rounded-lg border p-2 text-left", selected === h.id && "border-2 border-ring")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{h.id}</span> <StatusBadge entity="hu" status={h.status} /> <span className="text-xs text-muted-foreground">{n.type}</span>
            </div>
            <div className="font-mono text-sm">SSCC {h.sscc}</div>
            <div className="text-sm">{h.item} · └ {h.serial ?? "no serial yet"}</div>
            <div className="text-sm">{h.actualKg != null ? `${kg(h.actualKg)} of ${kg(h.expectedKg)}` : `expected ${kg(h.expectedKg)}`} · HU label printed: {h.labelPrinted ? "yes" : "no"}</div>
            {n.contents.length > 0 && <div className="text-xs text-muted-foreground">Contents: {n.contents.map((c) => `${c.qty} × ${c.item}`).join(", ")}</div>}
            {h.status === "Closed" && <div className="text-xs">Posting #27 DR 5120 Packaging / CR 1360 Packaging on Hand</div>}
          </button>
          {d.status === "Picking" && h.status === "Closed" && (
            <Button variant="ghost" className="h-12 text-base" onClick={() => onSelect(`reopen:${h.id}`)}>
              Reopen {h.id} with reason
            </Button>
          )}
          {render(n.hu, depth + 1)}
        </li>
      )
    })
  void actions
  return <ul className="flex flex-col gap-2">{render(undefined)}</ul>
}

export function PackStation() {
  const { id = "" } = useParams()
  const { db, actions } = useStore()
  const sales = useSlice("sales")
  const st = useFxState()
  const [scale, setScale] = useScaleState()
  const d = db.deliveries.find((x) => x.id === id)
  const hus = db.hus.filter((h) => h.deliveryId === id)
  const [selected, setSelected] = useState<string | null>(hus.find((h) => h.status === "Open")?.id ?? null)
  const [fail, setFail] = useState<string | null>(null)
  const [failCode, setFailCode] = useState<string>("")
  const [ok, setOk] = useState<{ text: string; n: number } | null>(null)
  const [reopenFor, setReopenFor] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [shortOpen, setShortOpen] = useState(false)
  const [sp, setSp] = useState({ reason: "Short Pick" as (typeof SHORT_PACK_REASONS)[number], qty: "1", note: "" })
  const [mv, setMv] = useState({ to: "", idx: "0", qty: "1", parent: "" })
  const scanRef = useRef<ScanFieldHandle>(null)
  const huKey = hus.map((h) => h.id).join(",")
  useEffect(() => {
    if (id) syncPackNodes(id)
  }, [id, huKey])
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
  const pe = sales.fx.packExt[d.id]
  const nodes = pe?.nodes ?? []
  const sel = hus.find((h) => h.id === selected)
  const selNode = nodes.find((n) => n.hu === sel?.id)
  const report = (r: { ok: boolean; error?: string }, okText: string) => {
    if (!r.ok) { setFail(r.error ?? "Failed"); setFailCode("") }
    else {
      setFail(null)
      setOk({ text: okText, n: Date.now() })
    }
    refocus()
  }
  const online = st.state !== "offline"
  const locked = !st.writable || d.status !== "Picking"
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
  const oversize = items.some((i) => product(i).kind === "ETO" || product(i).huKg >= 14000)
  const photosNeeded = oversize ? PHOTO_KINDS.filter((k) => !pe?.photos.some((p) => p.hu === sel?.id && p.kind === k)) : []
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
    if (!online) return { ok: false, errorCode: "Offline", message: "no connection", expected: "a connection", next: "Scans are not queued at the pack station; wait for the connection to return" }
    if (labelMode) return onLabelScan(code)
    if (!sel) return { ok: false, errorCode: "E-PCK-02", message: "no HU selected", expected: "an Open HU to scan into", next: "Create HU, then scan the serial" }
    const r = actions.scanSerial(d.id, sel.id, code)
    if (r.ok) {
      setFail(null)
      return { ok: true, message: `${r.value} packed into ${sel.id} (SP-16, T10)` }
    }
    return { ok: false, errorCode: "E-PCK-02", message: r.error, expected: `a serial reserved for ${d.id} (${sel.item}), Picked status, batch as picked`, next: "Scan a serial listed under Items to pack" }
  }
  const treeSelect = (v: string) => {
    if (v.startsWith("reopen:")) setReopenFor(v.slice(7))
    else { setSelected(v); refocus() }
  }
  void failCode

  return (
    <KioskPage
      title="Pack station"
      screenId="OM-PACK-*"
      station="PACK-TBD-01"
      operator="Packer (no badge login in this prototype)"
      exitTo="/sales/packing"
      online={online}
      queued={0}
      banners={
        <div className="flex flex-col gap-3">
          <StateBar st={st} only={["normal", "empty", "loading", "validation", "authorization", "conflict", "offline", "degraded", "read-only"]} />
          {st.state === "conflict" && <p role="alert" className="rounded-md border px-4 py-3 text-base">This pack order changed in the office (simulated). Reload to continue; HUs already closed are kept.</p>}
          {st.state === "degraded" && <p className="rounded-md border border-status-pending px-4 py-3 text-base">Degraded: label printing is slow. Closing an HU still works; the label prints when the printer answers.</p>}
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
        </div>
      }
      actions={[
        {
          label: "Create HU",
          disabled: locked || hus.length >= items.length,
          onClick: () => {
            const r = actions.createHU(d.id)
            if (r.ok) setSelected(r.value)
            report(r, r.ok ? `${r.value} created (Open)` : "")
          },
        },
        { label: "Close HU", disabled: locked || !sel || sel.status !== "Open", onClick: () => sel && report(actions.closeHU(sel.id), `${sel.id} closed. HU label printed. Posting #27 shown.`) },
        { label: "Short-pack", disabled: !st.writable || d.status !== "Picking", onClick: () => setShortOpen((x) => !x) },
        { label: "Complete pack order", primary: true, disabled: locked || !allClosed, onClick: () => report(actions.completePack(d.id), "Pack order complete. Delivery Packed.") },
      ]}
    >
      <div className="flex flex-wrap items-center gap-4 text-lg">
        <span>
          Pack order <span className="font-mono">{packOrderNo(d)}</span> · {d.id} · {c.name}
        </span>
        <StatusBadge entity="delivery" status={d.status} />
        <FamilyBadge family={PACK_FAMILY[packStatus(d, hus)]} label={packStatus(d, hus)} />
        {pe?.shortPack && <Chip kind="flag" note={`${pe.shortPack.reason}: ${pe.shortPack.qty} short. ${pe.shortPack.note}`}>Short-packed: {pe.shortPack.reason}</Chip>}
      </div>
      {st.loading ? (
        <p className="text-lg" aria-busy="true">Loading the pack order…</p>
      ) : st.empty ? (
        <p className="rounded-lg border border-dashed p-6 text-lg">No lines left to pack on this pack order. Everything is packed or short-packed.</p>
      ) : (
      <div className="grid grid-cols-[300px_1fr_360px] gap-6">
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
        <section aria-label="Scan, scale and HU close" className="flex flex-col gap-4">
          <ScanField ref={scanRef} key={labelMode ? "sp17" : "sp16"} scanPoint={labelMode ? "SP-17" : "SP-16"} label={labelMode ? "Scan the HU label back" : "Scan serial into the HU"} expected={nextExpected} onScan={onScan} disabled={locked} />
          {sel ? (
            <ScaleReadout hu={sel} state={scale} setState={setScale} touch onTaken={(t) => report({ ok: true }, t)} />
          ) : (
            <div className="rounded-lg border p-4 text-base text-muted-foreground">Create or select an HU to see the scale readout.</div>
          )}
          {labelMode && sel && <p className="rounded-lg border p-3 text-base">HU label printed for {sel.id}: SSCC <span className="font-mono">{sel.sscc}</span>. Scan it back to close (SP-17).</p>}
          {shortOpen && (
            <div className="flex flex-col gap-3 rounded-lg border-2 p-4" aria-label="Short-pack">
              <h3 className="font-semibold">Short-pack (supervisor)</h3>
              <p className="text-sm text-muted-foreground">The pack order completes when every line is packed or a supervisor short-packs it. The open remainder stays on its schedule line with the Backorder flag.</p>
              <label className="flex flex-col gap-1 text-sm">Reason
                <select className={selCls} value={sp.reason} onChange={(e) => setSp({ ...sp, reason: e.target.value as typeof sp.reason })}>{SHORT_PACK_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm">Quantity short
                <input type="number" min={1} className={selCls} value={sp.qty} onChange={(e) => setSp({ ...sp, qty: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-sm">Note
                <input className={selCls} value={sp.note} onChange={(e) => setSp({ ...sp, note: e.target.value })} />
              </label>
              <div className="flex gap-4">
                <Button className="h-12 text-base" onClick={() => { const r = shortPack(d.id, sp.reason, Number(sp.qty), sp.note); report(r, `Short-packed ${sp.qty} (${sp.reason})`); if (r.ok) setShortOpen(false) }}>Record short-pack</Button>
                <Button variant="ghost" className="h-12 text-base" onClick={() => { setShortOpen(false); refocus() }}>Cancel</Button>
              </div>
            </div>
          )}
          {oversize && sel && (
            <div className="rounded-lg border p-4" aria-label="Photos">
              <h3 className="mb-2 font-semibold">Photos for {sel.id} (mandatory for transformers: four corners and the nameplate)</h3>
              <ul className="flex flex-wrap gap-2">
                {PHOTO_KINDS.map((k) => {
                  const has = pe?.photos.some((p) => p.hu === sel.id && p.kind === k)
                  return <li key={k}><Button variant={has ? "secondary" : "outline"} className="h-12 text-base" disabled={locked || has} onClick={() => report(attachPhoto(d.id, sel.id, k), `${k} attached to ${sel.id}`)}>{has ? `${k} attached` : `Attach ${k}`}</Button></li>
                })}
              </ul>
              {photosNeeded.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Still needed: {photosNeeded.join(", ")}. <Reading id="SR-40" note="The PRD says photos are config per item category; here they are required for ETO and heavy units only, and shown, not enforced, at pack completion." /></p>}
            </div>
          )}
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
        <section aria-label="Handling units" className="flex flex-col gap-3">
          <h2 className="font-semibold">
            HU tree ({hus.length} of {items.length}) <Chip kind="k" id="K-03" note="One label at HU close, 'HU label'; no label-type list" />
          </h2>
          <HuTree nodes={nodes} hus={hus} selected={selected} onSelect={treeSelect} d={d} />
          {sel && selNode && (
            <div className="flex flex-col gap-2 rounded-lg border p-3" aria-label="Nest and move contents">
              <h3 className="text-sm font-semibold">{sel.id}: nest, move or split</h3>
              <label className="flex flex-col gap-1 text-sm">Nest under
                <select className={selCls} value={mv.parent || selNode.parent || ""} disabled={locked || sel.status !== "Open"} onChange={(e) => { setMv({ ...mv, parent: e.target.value }); report(nestHu(d.id, sel.id, e.target.value), e.target.value ? `${sel.id} nested under ${e.target.value}` : `${sel.id} at the top of the tree`) }}>
                  <option value="">Top level</option>
                  {hus.filter((h) => h.id !== sel.id).map((h) => <option key={h.id} value={h.id}>{h.id}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">Contents line
                <select className={selCls} value={mv.idx} onChange={(e) => setMv({ ...mv, idx: e.target.value })}>
                  {selNode.contents.map((x, i) => <option key={i} value={i}>{x.qty} × {x.item}{x.note ? ` (${x.note})` : ""}</option>)}
                  {selNode.contents.length === 0 && <option>No contents lines</option>}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm">Move to
                  <select className={selCls} value={mv.to} onChange={(e) => setMv({ ...mv, to: e.target.value })}><option value="">Choose HU</option>{hus.filter((h) => h.id !== sel.id).map((h) => <option key={h.id} value={h.id}>{h.id}</option>)}</select>
                </label>
                <label className="flex flex-col gap-1 text-sm">Quantity (less than the line splits it)
                  <input type="number" min={1} className={selCls} value={mv.qty} onChange={(e) => setMv({ ...mv, qty: e.target.value })} />
                </label>
              </div>
              <Button variant="outline" className="h-12 text-base" disabled={locked || !mv.to || selNode.contents.length === 0} onClick={() => report(moveContents(d.id, sel.id, mv.to, Number(mv.idx), Number(mv.qty)), `Moved ${mv.qty} to ${mv.to}`)}>Move or split contents</Button>
            </div>
          )}
        </section>
      </div>
      )}
      <details className="text-sm">
        <summary className="min-h-12 cursor-pointer py-3">Rules on this screen (9)</summary>
        <ul>
          <li>R-17 HU close needs gross weight within ±2% of expected; reopen allowed until Loaded with a reason; one transformer serial per primary HU [DOC:p.31-32 §5; p.96 SP-17; p.128] (asserted)</li>
          <li>R-24 Floor devices: 48 px minimum targets, 16 px base font, scan feedback under 400 ms with sound and a visual change, no silent failure [DOC:p.241 §8.4] (asserted)</li>
          <li>R-14 #27 posts at HU close [DOC:pp.124-125 Part J] (asserted)</li>
          <li>SP-16 serial scan into HU [DOC:pp.95-96] (asserted)</li>
          <li>E-PCK-02 wrong scan: the item must be on an open pack line, the serial Picked and the batch as picked; audible reject and error banner [DOC:p.32 §5.3] (asserted)</li>
          <li>E-PCK-03 quantity cannot exceed what remains; the same limit holds for a move or split between HUs [DOC:p.32 §5.3] (asserted). Other E-PCK codes: not in the extracted specification, shown as E-PCK-TBD</li>
          <li>Complete pack order: every line packed, or a supervisor short-packs with a reason (Short Pick, Damage, Hold) [DOC:p.32 §5.3] (asserted)</li>
          <li>Ancillary: reopen HU, move contents between HUs, split a line across HUs, print the packing list (draft watermark until complete), attach photos [DOC:p.32 §5.3] (asserted)</li>
          <li>Focus: the scan field takes focus on arrival and after each scan, action or dismiss, never on blur, so every control is reachable by keyboard (fixes critique F-01)</li>
        </ul>
      </details>
    </KioskPage>
  )
}

