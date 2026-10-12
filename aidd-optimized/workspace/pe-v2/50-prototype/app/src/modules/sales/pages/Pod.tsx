// OM-POD-001/002. Claim status: the PRD gives no list, so claims show type, value, carrier reference and
// resolution path, with no status badge. N in "missing POD after expected date + N days alerts" is not
// stated: aging is shown in days and no row is coloured by an invented N.
import { useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DensityToggle, DetailHeader, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { useStore } from "../data/store"
import { LIFECYCLE, TODAY, daysBetween, listDate, money } from "../data/model"

export function PodQueue() {
  const { db } = useStore()
  const loading = useFirstVisitLoading("pod")
  const [density, setDensity] = useState<Density>("compact")
  const [status, setStatus] = useState("All")
  const [q, setQ] = useState("")
  const rows = db.pods.filter((p) => {
    const d = db.deliveries.find((x) => x.id === p.deliveryId)!
    const c = db.customers.find((x) => x.id === d.customerId)!
    return (status === "All" || p.status === status) && (!q || `${p.id} ${d.id} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  })
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">POD and claims</h1>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select className="h-8 rounded-md border border-input bg-background px-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            {LIFECYCLE.pod.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Search
          <Input className="h-8 w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder="POD, delivery or customer" />
        </label>
        <span className="text-sm text-muted-foreground">{rows.length} rows</span>
        <div className="ml-auto">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">Alert threshold N not set in the specification. Aging is shown in days past the expected date; no row is highlighted.</p>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>POD</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead className="text-right">Aging (days past expected)</TableHead>
            <TableHead>Claim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <SkeletonRows cols={7} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState title="No POD rows match this filter.">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus("All")
                      setQ("")
                    }}
                  >
                    Clear filter
                  </Button>
                </EmptyState>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((p) => {
              const d = db.deliveries.find((x) => x.id === p.deliveryId)!
              const c = db.customers.find((x) => x.id === d.customerId)!
              const aging = p.status === "Expected" ? Math.max(0, daysBetween(p.expectedDate, TODAY)) : null
              return (
                <TableRow key={p.id} className={rowCls(density)}>
                  <TableCell>
                    <Link className="text-link underline" to={`/sales/pod/${p.id}`}>
                      {p.id}
                    </Link>
                  </TableCell>
                  <TableCell>{d.id}</TableCell>
                  <TableCell className="max-w-80 truncate" title={c.name}>
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge entity="pod" status={p.status} />
                  </TableCell>
                  <TableCell>{listDate(p.expectedDate)}</TableCell>
                  <TableCell className="tabular text-right">{aging == null ? "—" : aging}</TableCell>
                  <TableCell>{p.claim ? `${p.claim.id} · ${p.claim.type}` : "—"}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function PodDetail() {
  const { id = "" } = useParams()
  const { db, actions } = useStore()
  const p = db.pods.find((x) => x.id === id)
  const [f, setF] = useState({ receiver: "", date: TODAY, condition: "No damage", notes: "", docName: "", claimQty: "", claimValue: "", carrierRef: "" })
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null)
  const [stub, setStub] = useState<string | null>(null)
  if (!p) return <ErrorAlert title="POD not found">No POD {id} in this prototype. It may have been removed by a PGI reversal. Open the POD queue.</ErrorAlert>
  const d = db.deliveries.find((x) => x.id === p.deliveryId)!
  const c = db.customers.find((x) => x.id === d.customerId)!
  const claimType = f.condition === "Shortage" ? "shortage" : f.condition === "Refusal" ? "refusal" : "damage"
  return (
    <div className="max-w-[960px]">
      <DetailHeader
        title={p.id}
        entity="pod"
        status={p.status}
        sub={
          <p className="text-sm">
            Delivery <Link className="text-link underline" to={`/sales/deliveries?d=${d.id}`}>{d.id}</Link> <StatusBadge entity="delivery" status={d.status} /> · {c.name}
          </p>
        }
      />
      {err && (
        <div className="mb-4">
          <ErrorAlert title="POD not recorded" onDismiss={() => setErr(null)}>
            {err.msg}
          </ErrorAlert>
        </div>
      )}
      <dl className="mb-6 grid grid-cols-3 gap-4">
        <KV k="Expected date (ship date + transit)">{p.expectedDate}</KV>
        <KV k="Ship date">{d.shipDate ?? "Not recorded"}</KV>
        <KV k="Carrier / PRO/BOL #">
          {d.carrier ?? "Not recorded"} / {d.pro ?? "Not recorded"}
        </KV>
        <KV k="Receiver">{p.receiver ?? "Not recorded"}</KV>
        <KV k="POD date">{p.date ?? "Not recorded"}</KV>
        <KV k="Condition">{p.condition ?? "Not recorded"}</KV>
        <KV k="Signed document">{p.docName ?? "Not recorded"}</KV>
        <KV k="Delivery/Commissioning milestone">{p.milestoneFired ? "Fired (once)" : "Not fired"}</KV>
        {p.notes && <KV k="Condition notes">{p.notes}</KV>}
      </dl>

      {p.status === "Expected" && (
        <form
          className="mb-6 grid grid-cols-2 gap-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const r = actions.recordPOD(p.id, {
              receiver: f.receiver,
              date: f.date,
              condition: f.condition,
              notes: f.notes,
              docName: f.docName,
              claimType: f.condition === "No damage" ? undefined : claimType,
              claimQty: f.claimQty ? Number(f.claimQty) : undefined,
              claimValue: f.claimValue ? Number(f.claimValue) : undefined,
              carrierRef: f.carrierRef,
            })
            if (!r.ok) setErr({ msg: r.error, field: r.field })
            else {
              setErr(null)
              toast.success("POD recorded.")
            }
          }}
        >
          <h2 className="col-span-2 font-semibold">Record POD</h2>
          <div className="flex flex-col gap-1">
            <Label htmlFor="receiver">Receiver name</Label>
            <Input id="receiver" aria-invalid={err?.field === "receiver"} value={f.receiver} onChange={(e) => setF({ ...f, receiver: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pdate">POD date</Label>
            <Input id="pdate" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cond">Condition</Label>
            <select id="cond" className="h-9 rounded-md border border-input bg-background px-2" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
              <option>No damage</option>
              <option>Damage</option>
              <option>Shortage</option>
              <option>Refusal</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="doc">Signed document (filename only; upload is a stub)</Label>
            <Input id="doc" placeholder="signed-bol.pdf" value={f.docName} onChange={(e) => setF({ ...f, docName: e.target.value })} />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="notes">Condition notes</Label>
            <Input id="notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          {f.condition !== "No damage" && (
            <fieldset className="col-span-2 grid grid-cols-3 gap-4 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Open claim ({claimType})</legend>
              <div className="flex flex-col gap-1">
                <Label htmlFor="cq">Quantity</Label>
                <Input id="cq" type="number" value={f.claimQty} onChange={(e) => setF({ ...f, claimQty: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="cv">or value (USD)</Label>
                <Input id="cv" type="number" aria-invalid={err?.field === "claimValue"} value={f.claimValue} onChange={(e) => setF({ ...f, claimValue: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="cr">Carrier claim reference</Label>
                <Input id="cr" aria-invalid={err?.field === "carrierRef"} value={f.carrierRef} onChange={(e) => setF({ ...f, carrierRef: e.target.value })} />
              </div>
            </fieldset>
          )}
          <div className="col-span-2">
            <Button type="submit">Record POD</Button>
          </div>
        </form>
      )}

      {p.claim && (
        <section className="mb-6 rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Claim {p.claim.id}</h2>
          <p className="mb-2 text-xs text-muted-foreground">Claim status is not listed in the specification; no badge is shown.</p>
          <dl className="grid grid-cols-4 gap-4">
            <KV k="Type">{p.claim.type}</KV>
            <KV k="Quantity or value">{p.claim.value != null ? <span className="tabular">{money(p.claim.value)}</span> : `${p.claim.qty} unit(s)`}</KV>
            <KV k="Carrier claim reference">{p.claim.carrierRef}</KV>
            <KV k="Resolution">{p.claim.resolution ?? "Not resolved"}</KV>
          </dl>
          {p.status === "Exception" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {["Create credit memo request (ACC)", "Create redelivery", "Create repair (RMA path)"].map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  onClick={() => {
                    const res = actions.resolveClaim(p.id, r)
                    if (!res.ok) setErr({ msg: res.error })
                    else setStub(`${r}: stub. Claims reuse the RMA and credit paths, which are not built here. The POD is now Resolved/Closed.`)
                  }}
                >
                  {r}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

      <h2 className="mb-2 font-semibold">Activity</h2>
      <ul className="space-y-1 text-sm">
        {[...p.activity].reverse().map((a, i) => (
          <li key={i}>
            <span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}
          </li>
        ))}
      </ul>
      <Dialog open={!!stub} onOpenChange={() => setStub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stub</DialogTitle>
            <DialogDescription>{stub}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <RulesPanel
        rules={[
          ["R-19", "Expected POD date = ship date + planned transit days; carrier manual (DEC-04).", "DOC:p.205 DEC-04; p.207 §2.4"],
          ["R-20", "POD or site acceptance fires the Delivery/Commissioning milestone exactly once; claims reuse RMA and credit paths, never parallel ones.", "DOC:p.207 §2.4"],
          ["R-23", "Detail header carries a status badge and a lifecycle strip.", "DOC:p.242 §10.2"],
        ]}
      />
    </div>
  )
}
