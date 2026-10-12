// RMA-RECEIPT Return Receipt [DOC:p.253 Book VI; Book I A §3.5, p.24] (asserted). Kiosk, Receiving.
// Scan the RMA barcode to open (SP-19). Lines prefilled. Condition dropdown with mandatory photos
// when damaged. Receive full or partial; book unauthorized extras with a supervisor override.
// Creates quarantine stock, return inspections, serial status Returned. Posting #17 when ownership
// returns, none for customer property. Route /sales/rma/receipt is a design value.

import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { KioskFact, KioskPage } from "@/components/templates"
import { PostingPreview, ScanField, type ScanOutcome } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { USERS } from "@/data/shared/users"
import { store, useSlice } from "@/store"
import { money, product } from "../data/model"
import { CONDITIONS, type Condition } from "../data/ext-model"
import { SALEABLE_RETURN_ITEMS } from "../data/ext-seed"
import { RECEIVING_ROLES, RECEIVING_SUPERVISOR, bookUnauthorized, openForReceipt, proposeBin, receiveRma } from "../data/ext-actions"
import { Reading, RmaClassBadge } from "../components/ext"

type LineForm = { qty: number; condition: Condition; photo?: string; serial?: string; customerProperty?: boolean }
const field = "h-12 rounded-md border border-input bg-background px-3 text-base"

export function RmaReceipt() {
  const db = useSlice("sales")
  const [sp] = useSearchParams()
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [rmaId, setRmaId] = useState<string | null>(null)
  const [pendingRma] = useState(sp.get("rma"))
  const [form, setForm] = useState<Record<number, LineForm>>({})
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const [extra, setExtra] = useState(false)
  const [ex, setEx] = useState({ itemId: SALEABLE_RETURN_ITEMS[0] ?? "", serial: "", qty: 1, condition: "Undamaged" as Condition, photo: "", badge: "", reason: "" })
  const op = USERS.find((u) => u.id === operatorId)
  const r = db.rmas.find((x) => x.id === rmaId)

  const open = (code: string): ScanOutcome => {
    const res = openForReceipt(db, code)
    if (!res.ok) return { ok: false, errorCode: res.errorCode, message: res.error, expected: "the RMA barcode of an Authorized or Partially Received RMA", next: "Check the crate label; unauthorized crates go to the receiving supervisor" }
    const init: Record<number, LineForm> = {}
    for (const l of res.rma.lines) if (!l.unauthorized) init[l.no] = { qty: l.serial ? 0 : Math.max(0, l.qtyAuth - l.qtyRecd), condition: "Undamaged", customerProperty: l.customerProperty }
    setForm(init)
    setRmaId(res.rma.id)
    setBanner(null)
    return { ok: true, message: `${res.rma.id} opened: ${res.rma.lines.length} line(s)` }
  }
  const onScan = (code: string): ScanOutcome => {
    const v = code.trim().toUpperCase()
    if (!op) {
      const u = USERS.find((x) => x.badge === v)
      if (!u) return { ok: false, errorCode: "SP-07", message: `no user with badge ${v}`, expected: "your receiving badge", next: "Scan your own badge" }
      if (!u.roles.some((x) => RECEIVING_ROLES.includes(x))) return { ok: false, errorCode: "SP-07", message: `${u.name} is not assigned to receiving`, expected: "a Receiving clerk, Warehouse operator or Warehouse supervisor badge", next: "Ask a receiving operator to log in" }
      setOperatorId(u.id)
      if (pendingRma) setTimeout(() => open(pendingRma), 0)
      return { ok: true, message: `${u.name} logged in` }
    }
    if (!r) return open(v)
    const line = r.lines.find((l) => l.serial === v)
    if (line) {
      if (line.qtyRecd >= line.qtyAuth) return { ok: false, errorCode: "E-RMA-03", message: `${v} on line ${line.no} is already received`, expected: "a serial still open on this RMA", next: "Book it as an unauthorized return if a second unit arrived" }
      setForm({ ...form, [line.no]: { ...form[line.no], qty: 1, serial: v } })
      return { ok: true, message: `Serial ${v} matched line ${line.no}` }
    }
    if (v.startsWith("RMA-")) return open(v)
    return { ok: false, errorCode: "E-RMA-04", message: `${v} is not an authorized serial on ${r.id}`, expected: `one of ${r.lines.filter((l) => l.serial).map((l) => l.serial).join(", ") || "this RMA's lines (no serials)"}`, next: "Book it as an unauthorized return with a supervisor override" }
  }

  const expected = !op
    ? "Scan your badge to log in"
    : !r
      ? "Scan the RMA barcode on the crate label"
      : r.lines.some((l) => l.serial && !l.unauthorized && l.qtyRecd < l.qtyAuth && !form[l.no]?.serial)
        ? `Scan the serial for line ${r.lines.find((l) => l.serial && l.qtyRecd < l.qtyAuth && !form[l.no]?.serial)!.no}`
        : "Check the condition of each line, then Receive"
  const isSup = !!op?.roles.includes(RECEIVING_SUPERVISOR)
  const cpOf = (no: number, dflt: boolean) => form[no]?.customerProperty ?? dflt
  const posted = r ? r.lines.reduce((s, l) => s + (form[l.no] && !cpOf(l.no, l.customerProperty) ? form[l.no].qty * l.valuation : 0), 0) : 0
  const receive = () => {
    if (!r || !operatorId) return
    const res = receiveRma(r.id, operatorId, Object.entries(form).map(([line, x]) => ({ line: Number(line), qty: x.qty, condition: x.condition, photo: x.photo, serial: x.serial, customerProperty: x.customerProperty })))
    if (!res.ok) return setBanner({ ok: false, text: res.error })
    const after = store.getSlice("sales").rmas.find((x) => x.id === r.id)
    const claim = after?.freightClaim && after.freightClaim.opened && !r.freightClaim ? ` Freight claim ${after.freightClaim.claimNo} opened (damaged on arrival, PE-paid freight).` : ""
    setBanner({ ok: true, text: `${res.value} posted for ${r.id}. Stock in quarantine with QI Hold; return inspection created.${claim} Scan the next crate.` })
    setRmaId(null)
    setForm({})
  }
  const book = () => {
    if (!r || !operatorId) return
    const res = bookUnauthorized(r.id, operatorId, { itemId: ex.itemId, serial: ex.serial || undefined, qty: ex.qty, condition: ex.condition, photo: ex.photo || undefined, badge: ex.badge, reason: ex.reason })
    if (!res.ok) return setBanner({ ok: false, text: res.error })
    setBanner({ ok: true, text: `Unauthorized return booked as line ${res.value} with supervisor override. It gets its own inspection.` })
    setExtra(false)
  }

  return (
    <KioskPage
      title="Return receipt"
      screenId="RMA-RECEIPT"
      station="Dock 2, WH-TBD-01 Fargo, ND"
      operator={op?.name}
      exitTo="/sales/rma"
      banners={
        banner && (
          <div role={banner.ok ? "status" : "alert"} className={banner.ok ? "scan-flash flex items-center gap-4 rounded-md border px-4 py-3 text-base" : "flex items-center gap-4 rounded-md bg-destructive px-4 py-3 text-base text-destructive-foreground"}>
            <span>{banner.text}</span>
            <Button variant="outline" className="ml-auto h-12 bg-background text-base text-foreground" onClick={() => setBanner(null)}>
              Dismiss
            </Button>
          </div>
        )
      }
      scan={<ScanField key={!op ? "badge" : r ? `ser-${r.id}` : "rma"} scanPoint={!op ? "SP-07" : "SP-19"} label={!op ? "Badge login" : r ? "Scan serial or batch" : "Scan RMA barcode"} expected={expected} onScan={onScan} />}
      actions={
        op
          ? [
              { label: "Log out", onClick: () => { setOperatorId(null); setRmaId(null) } },
              { label: "Next RMA", disabled: !r, onClick: () => { setRmaId(null); setForm({}) } },
              { label: extra ? "Close unauthorized form" : "Book unauthorized extra", disabled: !r, onClick: () => setExtra(!extra) },
              { label: "Receive", primary: true, disabled: !r || Object.values(form).every((x) => x.qty === 0), onClick: receive },
            ]
          : []
      }
    >
      {!op ? (
        <p className="text-lg">
          Log in with your badge (Receiving clerk, Warehouse operator or Warehouse supervisor). In this prototype, Owen Pelletier's badge is BDG-7017.
        </p>
      ) : !r ? (
        <div className="flex flex-col gap-2 text-lg">
          <p>Scan the RMA barcode on the arriving crate. Only Authorized or Partially Received RMAs open here.</p>
          <p className="text-base">
            <Reading id="SR-13" note="The route /sales/rma/receipt and the station name are design values; the PRD says 'scan driven'" />
          </p>
          <p className="text-base text-muted-foreground">
            Waiting for return: {db.rmas.filter((x) => x.status === "Authorized" || x.status === "Partially Received").map((x) => x.id).join(", ") || "none"}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-8">
            <KioskFact label="RMA">{r.id}</KioskFact>
            <KioskFact label="Customer">{db.customers.find((c) => c.id === r.customerId)?.name}</KioskFact>
            <KioskFact label="Class">
              <RmaClassBadge cls={r.cls} />
            </KioskFact>
            <KioskFact label="Status">
              <StatusBadge kind="rma" status={r.status} />
            </KioskFact>
            <KioskFact label="Put away to">{r.warehouse}, QI Hold</KioskFact>
          </div>
          <table className="w-full text-base" aria-label="Lines to receive">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Line</th>
                <th>Item</th>
                <th>Serial</th>
                <th className="text-right">Open</th>
                <th>Receive qty</th>
                <th>Condition</th>
                <th>Photo</th>
                <th>Proposed bin</th>
                <th>Customer property</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.filter((l) => !l.unauthorized).map((l) => {
                const x = form[l.no] ?? { qty: 0, condition: "Undamaged" as Condition }
                const openQty = l.qtyAuth - l.qtyRecd
                const upd = (p: Partial<LineForm>) => setForm({ ...form, [l.no]: { ...x, ...p } })
                return (
                  <tr key={l.no} className="border-b">
                    <td className="py-2 tabular">{l.no}</td>
                    <td>
                      <span className="font-mono">{l.itemId}</span>
                      <span className="block text-sm text-muted-foreground">{product(l.itemId).description}{cpOf(l.no, l.customerProperty) ? " · customer property, non-valuated" : ""}</span>
                    </td>
                    <td className="font-mono">{l.serial ? (x.serial ? `${x.serial} scanned` : `${l.serial} (scan)`) : "None"}</td>
                    <td className="tabular text-right">{openQty}</td>
                    <td>
                      <input aria-label={`Receive quantity line ${l.no}`} type="number" min={0} className={`${field} w-24`} disabled={!!l.serial || openQty === 0} value={x.qty} onChange={(e) => upd({ qty: Number(e.target.value) })} />
                    </td>
                    <td>
                      <select aria-label={`Condition line ${l.no}`} className={field} value={x.condition} disabled={openQty === 0} onChange={(e) => upd({ condition: e.target.value as Condition })}>
                        {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      {x.condition === "Undamaged" ? (
                        <span className="text-sm text-muted-foreground">Not needed</span>
                      ) : x.photo ? (
                        <span className="text-sm">{x.photo}</span>
                      ) : (
                        <Button variant="outline" className="h-12 text-base" onClick={() => upd({ photo: `rcp-${r.id.toLowerCase()}-l${l.no}.jpg` })}>
                          Take photo (required)
                        </Button>
                      )}
                    </td>
                    <td className="font-mono">{openQty > 0 ? proposeBin(db, r, l.no) : ""}</td>
                    <td>
                      <label className="flex h-12 items-center gap-2">
                        <input type="checkbox" className="size-6" aria-label={`Customer property line ${l.no}`} checked={cpOf(l.no, l.customerProperty)} disabled={!isSup || openQty === 0 || l.qtyRecd > 0 || !["RC3", "RC4"].includes(r.cls)} onChange={(e) => upd({ customerProperty: e.target.checked })} />
                        <span className="text-sm">{!["RC3", "RC4"].includes(r.cls) ? "RC3 / RC4 only" : isSup ? "Supervisor may change" : "Receiving Supervisor only"}</span>
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Damaged Packaging or Damaged Product on a PE-paid return opens a freight claim (carrier, claim number, amount, status) on the RMA's Financials tab.
            <Reading id="SR-22" note="Bin proposal: the putaway rules engine (INV 15.6) is not in the prototype; bins Q1-01..Q1-08 of the RMA's quarantine zone are proposed in line order, skipping bins held by open RMAs. Freight claim amount = damaged lines at valuation" />
          </p>
          <PostingPreview title="Posts on Receive" lines={[posted ? { template: 17, amount: posted, detail: "Quantity × valuation at original issue: DR 1335 RMA Inventory / CR 5120" } : { template: 17, amount: null, notPostedReason: "Nothing valuated to receive yet, or customer property (no #17)" }]} />
          <p className="text-sm text-muted-foreground">Value at original price for reference: {money(r.lines.reduce((s, l) => s + (form[l.no]?.qty ?? 0) * l.origPrice, 0))}. Traceability event T12 is recorded with each receipt.</p>
          {extra && (
            <fieldset className="grid grid-cols-3 gap-4 rounded-lg border p-4">
              <legend className="px-1 font-semibold">Unauthorized extra (supervisor override)</legend>
              <label className="flex flex-col gap-1">Item
                <select className={field} value={ex.itemId} onChange={(e) => setEx({ ...ex, itemId: e.target.value as typeof ex.itemId })}>
                  {SALEABLE_RETURN_ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">Serial (if any)<input className={field} value={ex.serial} onChange={(e) => setEx({ ...ex, serial: e.target.value })} /></label>
              <label className="flex flex-col gap-1">Qty<input type="number" min={1} className={field} value={ex.qty} onChange={(e) => setEx({ ...ex, qty: Number(e.target.value) })} /></label>
              <label className="flex flex-col gap-1">Condition
                <select className={field} value={ex.condition} onChange={(e) => setEx({ ...ex, condition: e.target.value as Condition })}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div className="flex flex-col justify-end">
                {ex.condition !== "Undamaged" && (ex.photo ? <span>{ex.photo}</span> : <Button variant="outline" className="h-12 text-base" onClick={() => setEx({ ...ex, photo: `rcp-${r.id.toLowerCase()}-extra.jpg` })}>Take photo (required)</Button>)}
              </div>
              <label className="flex flex-col gap-1">Supervisor badge<input className={field} value={ex.badge} onChange={(e) => setEx({ ...ex, badge: e.target.value })} placeholder="BDG-7019" /></label>
              <label className="col-span-2 flex flex-col gap-1">Override reason<input className={field} value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} /></label>
              <Button variant="outline" className="h-12 self-end text-base" onClick={book}>
                Book with override
              </Button>
            </fieldset>
          )}
        </>
      )}
    </KioskPage>
  )
}
