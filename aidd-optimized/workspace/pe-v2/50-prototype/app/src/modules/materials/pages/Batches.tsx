// FX-MM-BATCH: Batch master [Book II §15.1]. /inventory/batches lists batches with vendor batch,
// heat number, country of origin, expiry and certificates, a search with range filters on measured
// characteristics ("all CRGO batches with core loss at or under X") and on expiry, and an Expired
// badge. /inventory/batches/:id shows one batch: certificates (E-QM-06 until the required ones
// attach), measured characteristics from incoming inspection, stock by ownership bucket, document flow.
// Consumed and Expired are not S-28 stock status rows: they are shown as text with a design chip.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { CalendarClock, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, FamilyBadge, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { daysBetween, fmtDate, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { R, getMaterial } from "../data/state"
import { batchExpired, batchStatusOf, missingCerts, type BatchRecord, type BatchStatus } from "../data/ext"
import { attachCert, runExpiryJob } from "../data/ext-actions"
import { ownerOfBucket } from "../lib/ext-rules"
import { DocLinkText, MatLink, Reading, Section, userName } from "../components/common"
import { useViewState, type ViewStateApi } from "../components/states"
import { confirmRun, run } from "../components/run"

const CERT_TYPES = ["Mill Cert per Heat", "CoA", "CoC per Shipment", "Conductivity cert"]

export function BatchStatusBadge({ status, size = "sm" }: { status: BatchStatus; size?: "sm" | "md" | "lg" }) {
  if (status === "Unrestricted" || status === "QI Hold" || status === "Blocked") return <StatusBadge kind="stock" status={status} size={size} />
  return <FamilyBadge family={status === "Expired" ? "exception" : "done"} label={status} size={size} title="§15.1 batch word; not an S-28 stock status row" />
}

/** Characteristic keys across all batches, for the range filter. */
function useCharKeys(rows: BatchRecord[]) {
  return useMemo(() => [...new Set(rows.flatMap((b) => b.characteristics.map((c) => c.key)))].sort(), [rows])
}

export function BatchList() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-BATCH", { degradedWhat: "Incoming-inspection results are not refreshing" })
  const [mat, setMat] = useState("all")
  const [stat, setStat] = useState("all")
  const [key, setKey] = useState("")
  const [lo, setLo] = useState("")
  const [hi, setHi] = useState("")
  const [expFrom, setExpFrom] = useState("")
  const [expTo, setExpTo] = useState("")
  const [expiredOnly, setExpiredOnly] = useState(false)
  const keys = useCharKeys(s.x.batches)
  const mats = useMemo(() => [...new Set(s.x.batches.map((b) => b.materialId))].sort(), [s.x.batches])
  const charOf = (b: BatchRecord) => b.characteristics.find((c) => c.key === key)
  const rows = st.empty
    ? []
    : s.x.batches.filter((b) => {
        const eff = batchStatusOf(b, TODAY)
        if (mat !== "all" && b.materialId !== mat) return false
        if (stat !== "all" && eff !== stat) return false
        if (expiredOnly && eff !== "Expired") return false
        if (expFrom && (!b.expiry || b.expiry < expFrom)) return false
        if (expTo && (!b.expiry || b.expiry > expTo)) return false
        if (key) {
          const c = charOf(b)
          if (!c) return false
          if (lo !== "" && c.value < Number(lo)) return false
          if (hi !== "" && c.value > Number(hi)) return false
        }
        return true
      })
  const filtered = !!(key || expFrom || expTo || expiredOnly || mat !== "all" || stat !== "all")
  const expiredCount = s.x.batches.filter((b) => batchStatusOf(b, TODAY) === "Expired").length
  const cols: Column<BatchRecord>[] = [
    { id: "id", header: "Batch", value: (b) => b.id, sortable: true, mono: true },
    { id: "mat", header: "Material", value: (b) => b.materialId, sortable: true, cell: (b) => <MatLink id={b.materialId} /> },
    { id: "vb", header: "Vendor batch", value: (b) => b.vendorBatch ?? "", mono: true },
    { id: "heat", header: "Heat no.", value: (b) => b.heatNo ?? "", mono: true },
    { id: "coo", header: "CoO", value: (b) => b.coo ?? "", filterable: true },
    { id: "rec", header: "Received", value: (b) => b.receiptDate, sortable: true, cell: (b) => fmtDate(b.receiptDate) },
    {
      id: "exp", header: "Expiry", value: (b) => b.expiry ?? "", sortable: true,
      cell: (b) => (b.expiry ? <span className="tabular">{fmtDate(b.expiry)}{!batchExpired(b, TODAY) && daysBetween(TODAY, b.expiry) <= 30 && <span className="ml-1 text-xs text-muted-foreground">in {daysBetween(TODAY, b.expiry)} d</span>}</span> : <span className="text-muted-foreground">No expiry</span>),
    },
    { id: "st", header: "Status", value: (b) => batchStatusOf(b, TODAY), filterable: true, cell: (b) => <BatchStatusBadge status={batchStatusOf(b, TODAY)} /> },
    {
      id: "cert", header: "Certificates", value: (b) => b.certs.length,
      cell: (b) => {
        const miss = missingCerts(b, s.views[b.materialId]?.certs ?? [])
        return miss.length ? <Chip kind="flag">{miss.length} missing (E-QM-06)</Chip> : <span className="text-muted-foreground">{b.certs.length} attached</span>
      },
    },
    ...(key ? [{ id: "ch", header: key, value: (b: BatchRecord) => charOf(b)?.value ?? null, align: "right" as const, mono: true, sortable: true, cell: (b: BatchRecord) => { const c = charOf(b); return c ? `${c.value} ${c.unit}` : "" } }] : []),
  ]
  const canWrite = st.canWrite
  return (
    <ListPage
      header={{
        screenId: "FX-MM-BATCH",
        title: "Batch master",
        description: "Vendor batch, heat number, country of origin, expiry, certificates and measured characteristics. Search by characteristic range or expiry; FEFO picks the earliest expiry first (V-MM-09).",
        chips: <Chip kind="oq" id="FL-08 FL-11" note="Batch lineage feeds the recall flow (FL-08) and the CRGO core-loss trace (FL-11)">Feeds FL-08, FL-11</Chip>,
        primary: undefined,
        actions: (
          <Button variant="outline" disabled={!canWrite} title={st.blockedWhy} onClick={() => run(runExpiryJob(), (n) => `Expiry job: ${n} batch(es) moved to Expired, their stock to Blocked`)}>
            <CalendarClock aria-hidden="true" /> Run expiry job
          </Button>
        ),
      }}
      above={
        <div className="flex flex-col gap-3">
          {st.banners}
          {expiredCount > 0 && !st.empty && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <FamilyBadge family="exception" label="Expired" size="sm" /> {expiredCount} batch(es) are past their expiry date. The nightly job moves their stock to Blocked and raises an alert.
              <Button size="sm" variant="ghost" onClick={() => setExpiredOnly((v) => !v)}>{expiredOnly ? "Show all" : "Show only these"}</Button>
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3" role="search" aria-label="Batch range filters">
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-mat">Material</Label>
              <Select value={mat} onValueChange={setMat}>
                <SelectTrigger id="bf-mat" size="sm" className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All materials</SelectItem>
                  {mats.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-stat">Status</Label>
              <Select value={stat} onValueChange={setStat}>
                <SelectTrigger id="bf-stat" size="sm" className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["all", "Unrestricted", "QI Hold", "Blocked", "Expired", "Consumed"].map((x) => <SelectItem key={x} value={x}>{x === "all" ? "All statuses" : x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-key">Characteristic</Label>
              <Select value={key || "none"} onValueChange={(v) => setKey(v === "none" ? "" : v)}>
                <SelectTrigger id="bf-key" size="sm" className="h-8 w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any (no range)</SelectItem>
                  {keys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-lo">At least</Label>
              <Input id="bf-lo" type="number" step="any" value={lo} disabled={!key} onChange={(e) => setLo(e.target.value)} className="h-8 w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-hi">At most</Label>
              <Input id="bf-hi" type="number" step="any" value={hi} disabled={!key} onChange={(e) => setHi(e.target.value)} className="h-8 w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-ef">Expiry from</Label>
              <Input id="bf-ef" type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} className="h-8 w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="bf-et">Expiry to</Label>
              <Input id="bf-et" type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} className="h-8 w-36" />
            </div>
            {filtered && (
              <Button size="sm" variant="ghost" onClick={() => { setMat("all"); setStat("all"); setKey(""); setLo(""); setHi(""); setExpFrom(""); setExpTo(""); setExpiredOnly(false) }}>
                Clear filters
              </Button>
            )}
          </div>
          {key && (
            <p className="text-xs text-muted-foreground">
              {rows.length} batch(es) with {key}{lo !== "" ? ` at least ${lo}` : ""}{hi !== "" ? ` at most ${hi}` : ""}. Values are copied from incoming inspection and are read-only here.
            </p>
          )}
        </div>
      }
      table={{
        rows,
        columns: cols,
        rowId: (b) => b.id,
        rowHref: (b) => R.batch(b.id),
        searchText: (b) => `${b.id} ${b.materialId} ${b.vendorBatch ?? ""} ${b.heatNo ?? ""} ${b.poId ?? ""} ${b.grnId ?? ""}`,
        searchPlaceholder: "Search batch, material, vendor batch, heat, PO, GRN",
        loading: st.loading,
        error: st.error,
        onRetry: st.onRetry,
        toolbar: st.toolbar,
        densityKey: "FX-MM-BATCH",
        empty: { title: filtered ? "No batch matches the filters" : "No batches yet", body: filtered ? "Widen the range or clear the filters." : "Batches appear when a batch-managed material is received." },
        initialSort: { id: "rec", dir: "desc" },
      }}
      below={
        <RulesPanel
          rules={[
            ["§15.1", "A batch carries vendor batch, heat number, country of origin, manufacturing date, expiry and the certificates the material's Quality view requires; measured characteristics come from incoming inspection.", "[Book II §15.1]"],
            ["E-QM-06", "A GRN cannot accept a batch until its required certificate (mill cert per heat for CRGO and copper) is attached.", "[Book II §15.1]"],
            ["V-MM-09", "FEFO picks the earliest expiry first for shelf-life materials.", "[Book II §3.9]"],
            ["§15.1 job", "The nightly job sets Expired at the expiry date, moves the stock to Blocked and raises an alert.", "[Book II §15.1]"],
          ]}
        />
      }
    />
  )
}

function AttachCertDialog({ batch, open, onOpenChange, st }: { batch: BatchRecord; open: boolean; onOpenChange: (o: boolean) => void; st: ViewStateApi }) {
  const [name, setName] = useState(CERT_TYPES[0])
  const [ref, setRef] = useState("")
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Attach certificate to ${batch.id}`}
      description={`${batch.materialId}${batch.heatNo ? ` · heat ${batch.heatNo}` : ""}`}
      consequence={`The certificate is attached to ${batch.id} and logged on the material's history. A QI Hold waiting on the certificate (E-QM-06) can then proceed to inspection.`}
      confirmLabel="Attach certificate"
      confirmDisabled={!st.canWrite}
      onConfirm={() => (st.canWrite ? confirmRun(attachCert(batch.id, name, ref), `Certificate ${ref} attached`) : (st.blockedWhy ?? "Blocked"))}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cert-type">Certificate type</Label>
          <Select value={name} onValueChange={setName}>
            <SelectTrigger id="cert-type"><SelectValue /></SelectTrigger>
            <SelectContent>{CERT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cert-ref">Certificate reference</Label>
          <Input id="cert-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="MTR-H-7790" aria-invalid={st.validation && !ref ? true : undefined} />
          {st.validation && !ref && <p className="text-xs text-destructive">Enter the certificate reference (at least 4 characters).</p>}
        </div>
      </div>
    </DialogShell>
  )
}

export function BatchDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const st = useViewState("FX-MM-BATCH-detail", { degradedWhat: "Incoming-inspection results are not refreshing" })
  const [attach, setAttach] = useState(false)
  const b = s.x.batches.find((x) => x.id === id)
  if (!b)
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={`Batch ${id} was not found`}>
          <Link to="/inventory/batches" className="text-link underline-offset-4 hover:underline">Back to the batch master</Link>
        </EmptyState>
      </div>
    )
  const eff = batchStatusOf(b, TODAY)
  const mat = getMaterial(s, b.materialId)
  const required = s.views[b.materialId]?.certs ?? []
  const miss = missingCerts(b, required)
  const stock = s.stock.filter((r) => r.batchId === b.id)
  const terminal = eff === "Consumed"
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-MM-BATCH",
          title: `Batch ${b.id}`,
          crumbs: [{ label: "Batch master", to: "/inventory/batches" }, { label: b.id }],
          description: `${b.materialId}${mat ? ` · ${mat.description}` : ""}`,
          chips: (
            <>
              {(eff === "Expired" || eff === "Consumed") && <BatchStatusBadge status={eff} size="md" />}
              {miss.length > 0 && <Chip kind="block">E-QM-06: {miss.join(", ")} required</Chip>}
            </>
          ),
          actions: (
            <Button variant="outline" disabled={!st.canWrite || terminal} title={st.blockedWhy} onClick={() => setAttach(true)}>
              <Plus aria-hidden="true" /> Attach certificate
            </Button>
          ),
        }}
        status={eff === "Unrestricted" || eff === "QI Hold" || eff === "Blocked" ? { kind: "stock", value: eff } : undefined}
        doc={{ type: "batch", id: b.id as `BAT-${string}` }}
        summary={
          <>
            <KV k="Material"><MatLink id={b.materialId} /></KV>
            <KV k="Vendor batch">{b.vendorBatch ?? "Not recorded"}</KV>
            <KV k="Heat number">{b.heatNo ?? "Not applicable"}</KV>
            <KV k="Country of origin">{b.coo ?? "Not recorded"}</KV>
            <KV k="Manufactured">{fmtDate(b.mfgDate)}</KV>
            <KV k="Received">{fmtDate(b.receiptDate)}</KV>
            <KV k="Expiry">{b.expiry ? fmtDate(b.expiry) : "No expiry"}</KV>
            <KV k="Vendor">{b.vendorId ?? "Not recorded"}</KV>
          </>
        }
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="flex max-w-[960px] flex-col gap-4">
                {st.banners}
                {b.alert && (
                  <p role="status" className="rounded-md border border-status-exception px-3 py-2 text-sm">{b.alert}</p>
                )}
                <Section title="Source documents">
                  <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <KV k="Purchase order">{b.poId ? <DocLinkText to={`/purchasing/orders/${b.poId}`}>{b.poId}</DocLinkText> : "None"}</KV>
                    <KV k="Goods receipt">{b.grnId ?? "None"}</KV>
                    <KV k="Status word">{eff}</KV>
                  </dl>
                  <p className="text-xs text-muted-foreground">Consumed and Expired are batch words from §15.1; the stock status of any remaining quantity is one of the S-28 rows.</p>
                </Section>
              </div>
            ),
          },
          {
            id: "certs",
            label: "Certificates",
            count: b.certs.length,
            content: (
              <Section title="Certificates attached" action={<Reading id="RD-MM-32" />}>
                {required.length > 0 && <p className="text-sm">Required by the Quality view of {b.materialId}: {required.join(", ")}.</p>}
                {b.certs.length === 0 ? (
                  <EmptyState title="No certificate attached">{miss.length ? `GRN accept is held (E-QM-06) until ${miss.join(", ")} is attached.` : "This material requires none."}</EmptyState>
                ) : (
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Attached</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {b.certs.map((c) => (
                        <TableRow key={c.ref}><TableCell>{c.name}</TableCell><TableCell className="font-mono">{c.ref}</TableCell><TableCell>{fmtDate(c.attachedOn)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
            ),
          },
          {
            id: "chars",
            label: "Characteristics",
            count: b.characteristics.length,
            content: (
              <Section title="Measured characteristics (incoming inspection)">
                {b.characteristics.length === 0 ? (
                  <EmptyState title="No measurement recorded">The inspection has not closed for this batch.</EmptyState>
                ) : (
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Characteristic</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Unit</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {b.characteristics.map((c) => (
                        <TableRow key={c.key}><TableCell>{c.key}</TableCell><TableCell className="tabular text-right">{fmtNumber(c.value, 2)}</TableCell><TableCell>{c.unit}</TableCell><TableCell>{c.source}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
            ),
          },
          {
            id: "stock",
            label: "Stock and owner",
            count: stock.length,
            content: (
              <Section title="Stock held in this batch">
                {stock.length === 0 ? (
                  <EmptyState title="No stock on hand">The batch is fully consumed or has not been put away.</EmptyState>
                ) : (
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Bin</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Status</TableHead><TableHead>Bucket</TableHead><TableHead>Owner</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stock.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.warehouseId} / {r.bin}</TableCell>
                          <TableCell className="tabular text-right">{fmtNumber(r.qty)}</TableCell>
                          <TableCell><StatusBadge kind="stock" status={r.status} size="sm" /></TableCell>
                          <TableCell>{r.bucket}</TableCell>
                          <TableCell>{ownerOfBucket(r.bucket, r.pegRef)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <p className="text-xs text-muted-foreground">Entered by {userName(s.history.find((h) => h.materialId === b.materialId)?.by)} last; stock moves only through goods movements.</p>
              </Section>
            ),
          },
        ]}
      />
      <AttachCertDialog batch={b} open={attach} onOpenChange={setAttach} st={st} />
      <div className="mt-4">{st.toolbar}</div>
    </>
  )
}
