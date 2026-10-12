// MM-IR-001/2 Purchasing Info Records [DOC:p.247] (asserted); rules Book II §7.2, §7.3.
// Grid by material and vendor; detail with price rows, scales, surcharge link, rolling actuals panel.
// Actions: new row from RFQ award or manual (manual above 5% waits for the Purchasing Manager),
// Expire, Export. Invoice deviation over 5% raises a buyer alert. FL-03 source side.
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Download, Plus, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { AVL, TODAY, vendorById } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { IR_DEVIATION_PCT, IR_STALE_MONTHS, monthsBetween, type IrStatus } from "../lib/rules"
import { allMaterials, getMaterial, R } from "../data/state"
import { ACTIVE_VENDORS, addPriceRow, createIr, currentPrice, expireIr, irStatus, withdrawPriceRow } from "../data/actions"
import type { InfoRecordRecord, IrSource } from "../data/types"
import { DocLinkText, IrStatusBadge, MatLink, Reading, Section, userName, useListState } from "../components/common"
import { confirmRun } from "../components/run"

type Row = InfoRecordRecord & { status: IrStatus; cur?: number; vendorName: string; alert: boolean }

/** Invoice vs basis deviation (> 5% raises a buyer alert, Book VI p.247). */
const deviation = (ir: InfoRecordRecord) => {
  const inv = ir.actuals.find((a) => a.kind === "Last invoice")
  const basis = currentPrice(ir, TODAY)?.price ?? ir.price
  return inv ? ((inv.price - basis) / basis) * 100 : 0
}

export function InfoRecordList() {
  const s = useSlice("materials")
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const st = useListState("MM-IR-001")
  const material = sp.get("material")
  const rows = useMemo<Row[]>(
    () =>
      s.infoRecords
        .filter((x) => !material || x.materialId === material)
        .map((x) => ({ ...x, status: irStatus(s, x.id, TODAY), cur: currentPrice(x, TODAY)?.price, vendorName: vendorById(x.vendorId)?.name ?? x.vendorId, alert: Math.abs(deviation(x)) > IR_DEVIATION_PCT })),
    [s, material],
  )
  const cols: Column<Row>[] = [
    { id: "id", header: "Info record", value: (r) => r.id, mono: true, sortable: true },
    { id: "mat", header: "Material", value: (r) => r.materialId, sortable: true, cell: (r) => <MatLink id={r.materialId} /> },
    { id: "vendor", header: "Vendor", value: (r) => r.vendorName, filterable: true, cell: (r) => `${r.vendorId} ${r.vendorName}` },
    { id: "entity", header: "Entity", value: (r) => r.entityId, filterable: true },
    { id: "price", header: "Price", value: (r) => r.cur ?? r.price, align: "right", mono: true, sortable: true, cell: (r) => (r.cur != null ? `${fmtMoney(r.cur, r.currency)} / ${r.priceUnit}` : "No valid row") },
    { id: "lead", header: "Lead time", value: (r) => r.leadDays, align: "right", mono: true, cell: (r) => `${r.leadDays} d` },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, cell: (r) => `${fmtDate(r.validFrom)} to ${r.validTo ? fmtDate(r.validTo) : "open"}` },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <IrStatusBadge status={r.status} /> },
    {
      id: "flags",
      header: "Flags",
      value: (r) => (r.alert ? "Invoice deviation" : r.priceRows.some((p) => p.pending) ? "Manual price pending" : ""),
      filterable: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.alert && <Chip kind="flag">Invoice deviation {deviation(r).toFixed(1)}%</Chip>}
          {r.priceRows.some((p) => p.pending) && <Chip kind="change">Manual price pending</Chip>}
        </span>
      ),
    },
  ]
  const exportCsv = () => {
    const lines = ["Info record,Material,Vendor,Entity,Price,Currency,Price unit,Lead days,Valid from,Valid to,Status", ...rows.map((r) => [r.id, r.materialId, r.vendorId, r.entityId, r.cur ?? "", r.currency, r.priceUnit, r.leadDays, r.validFrom, r.validTo ?? "", r.status].join(","))]
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }))
    a.download = "info-records.csv"
    a.click()
  }
  return (
    <>
      <ListPage
        header={{
          screenId: "MM-IR-001/2",
          title: material ? `Info records for ${material}` : "Purchasing info records",
          description: "The price and lead-time basis MRP and PO pricing consume, one active record per material, vendor and entity (V-MM-30).",
          chips: <Reading id="RD-MM-09" />,
          primary: (
            <Button onClick={() => setSp(material ? { material, new: "1" } : { new: "1" })}>
              <Plus aria-hidden="true" /> New info record
            </Button>
          ),
          actions: (
            <>
              {material && (
                <Button variant="ghost" onClick={() => setSp({})}>
                  Show all materials
                </Button>
              )}
              <Button variant="outline" onClick={exportCsv}>
                <Download aria-hidden="true" /> Export
              </Button>
            </>
          ),
        }}
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => R.ir(r.id),
          searchText: (r) => `${r.id} ${r.materialId} ${r.vendorId} ${r.vendorName} ${r.vendorPart ?? ""}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          empty: { title: "No info records", body: "The first info record is created by the buyer's MCR task or an RFQ award." },
          initialSort: { id: "mat", dir: "asc" },
        }}
      />
      <IrRules />
      <NewIrDialog open={sp.get("new") === "1"} material={material ?? ""} onClose={() => setSp(material ? { material } : {})} onCreated={(id) => nav(R.ir(id))} />
    </>
  )
}

function IrRules() {
  return (
    <RulesPanel
      rules={[
        ["V-MM-30", "One active info record per material, vendor and entity; vendor onboarding must be Active.", "[Book II §7.2]"],
        ["V-MM-31", "Price rows are effective-dated and never overlap; history is never edited (C-50).", "[Book II §7.2]"],
        ["§7.2", "A new row comes from an RFQ award or is entered manually; manual prices are approved by the Purchasing Manager.", "[DOC:p.247]"],
        ["§7.3", `Invoice deviation over ${IR_DEVIATION_PCT}% raises a buyer alert; a last-PO basis older than ${IR_STALE_MONTHS} months is stale.`, "[DOC:p.247; Book II §7.3]"],
        ["RD-MM-09", "Info record status Active / Expired / Blocked is shown with a family badge until the catalog row exists.", "README Readings"],
      ]}
    />
  )
}

function NewIrDialog({ open, material, onClose, onCreated }: { open: boolean; material: string; onClose: () => void; onCreated: (id: string) => void }) {
  const s = useSlice("materials")
  const [mat, setMat] = useState(material)
  const [ven, setVen] = useState("")
  const [price, setPrice] = useState("")
  const [lead, setLead] = useState("")
  const [source, setSource] = useState<IrSource>("RFQ Award")
  const [ref, setRef] = useState("")
  const [vpart, setVpart] = useState("")
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New info record"
      consequence="Creates the record with its first price row valid from today; MRP and PO pricing use it at once."
      confirmLabel="Create info record"
      onConfirm={() =>
        confirmRun(createIr({ materialId: mat || material, vendorId: ven, price: Number(price), leadDays: Number(lead), source, ref: ref || undefined, vendorPart: vpart || undefined }), (id) => {
          setTimeout(() => onCreated(id), 0)
          return `${id} created`
        })
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-mat">Material</Label>
          <Select value={mat || material} onValueChange={setMat}>
            <SelectTrigger id="ni-mat">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {allMaterials(s)
                .filter((m) => m.status !== "Obsolete" && m.status !== "Draft")
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id} {m.description}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-ven">Vendor (onboarding Active)</Label>
          <Select value={ven} onValueChange={setVen}>
            <SelectTrigger id="ni-ven">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_VENDORS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.id} {v.name} ({v.quality})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-price">Price per unit</Label>
          <Input id="ni-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-lead">Planned delivery time (days)</Label>
          <Input id="ni-lead" inputMode="numeric" value={lead} onChange={(e) => setLead(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-src">Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v as IrSource)}>
            <SelectTrigger id="ni-src">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["RFQ Award", "Contract", "Manual"] as const).map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-ref">Reference (RFQ or contract)</Label>
          <Input id="ni-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ni-vp">Vendor part number</Label>
          <Input id="ni-vp" value={vpart} onChange={(e) => setVpart(e.target.value)} />
        </div>
      </div>
    </DialogShell>
  )
}

export function InfoRecordDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const ir = s.infoRecords.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "row" | "expire">(null)
  const [price, setPrice] = useState("")
  const [from, setFrom] = useState(TODAY)
  const [source, setSource] = useState<IrSource>("RFQ Award")
  const [ref, setRef] = useState("")
  if (!ir)
    return (
      <EmptyState title={`Info record ${id} not found`}>
        <Link to="/purchasing/info-records" className="text-link underline">
          Back to the list
        </Link>
      </EmptyState>
    )
  const status = irStatus(s, ir.id, TODAY)
  const cur = currentPrice(ir, TODAY)
  const v = vendorById(ir.vendorId)
  const avl = AVL.find((a) => a.itemId === ir.materialId && a.vendorId === ir.vendorId)
  const m = getMaterial(s, ir.materialId)
  const dev = deviation(ir)
  const lastPo = ir.actuals.find((a) => a.kind === "Last PO")
  const stale = lastPo ? monthsBetween(lastPo.on, TODAY) > IR_STALE_MONTHS : false
  const basis = cur?.price ?? ir.price
  const np = Number(price)
  const delta = np > 0 ? (Math.abs(np - basis) / basis) * 100 : 0
  const rfqRef = ir.priceRows.find((r) => r.source === "RFQ Award" && r.ref?.startsWith("RFQ-"))?.ref
  return (
    <>
      <DetailPage
        header={{
          screenId: "MM-IR-001/2",
          title: `${ir.id} ${ir.materialId} from ${ir.vendorId}`,
          crumbs: [{ label: "Info records", to: "/purchasing/info-records" }, { label: ir.id }],
          chips: (
            <>
              <IrStatusBadge status={status} />
              {Math.abs(dev) > IR_DEVIATION_PCT && <Chip kind="flag">Buyer alert: invoice deviation {dev.toFixed(1)}%</Chip>}
              {stale && <Chip kind="flag">Stale basis: last PO over {IR_STALE_MONTHS} months</Chip>}
            </>
          ),
          primary:
            status !== "Blocked" ? (
              <Button onClick={() => (setPrice(""), setRef(""), setDlg("row"))}>
                <Plus aria-hidden="true" /> New price row
              </Button>
            ) : undefined,
          actions:
            status === "Active" ? (
              <Button variant="outline" onClick={() => setDlg("expire")}>
                Expire
              </Button>
            ) : undefined,
        }}
        summary={
          <>
            <KV k="Material">
              <MatLink id={ir.materialId} /> {m?.description}
            </KV>
            <KV k="Vendor">
              {v?.name ?? ir.vendorId}
              {v && (
                <span className="ml-1 inline-flex gap-1">
                  <StatusBadge kind="vendorOnboarding" status={v.onboarding} size="sm" />
                  <StatusBadge kind="vendorQuality" status={v.quality} size="sm" />
                </span>
              )}
            </KV>
            <KV k="AVL">{avl ? <StatusBadge kind="avl" status={avl.status} size="sm" /> : "No AVL row"}</KV>
            <KV k="Current price">{cur ? `${fmtMoney(cur.price, ir.currency)} per ${ir.priceUnit} ${m?.baseUom ?? ""}` : "No valid row"}</KV>
            <KV k="Planned delivery">{ir.leadDays} days</KV>
            <KV k="Entity">{ir.entityId}</KV>
            <KV k="Incoterms / freight">{[ir.incoterms, ir.freightPct != null ? `${ir.freightPct}%` : undefined].filter(Boolean).join(" · ") || "Not set"}</KV>
            <KV k="MOQ / rounding">{[ir.moq, ir.rounding].filter((x) => x != null).join(" / ") || "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "prices",
            label: "Price rows",
            count: ir.priceRows.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Valid from</TableHead>
                    <TableHead>Valid to</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...ir.priceRows].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).map((r) => (
                    <TableRow key={r.id} className="h-8 text-[13px]">
                      <TableCell className="font-mono">
                        {r.id} {r.id === cur?.id && <Chip kind="design" note="The row valid today">Current</Chip>}
                      </TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.price, ir.currency)}</TableCell>
                      <TableCell>{fmtDate(r.validFrom)}</TableCell>
                      <TableCell>{r.validTo ? fmtDate(r.validTo) : "Open"}</TableCell>
                      <TableCell>
                        {r.source} {r.pending && <Chip kind="change" note="Manual price above 5% delta waits for the Purchasing Manager (request R-3)">Waiting for Purchasing Manager</Chip>}
                        {r.pending && (
                          <Button size="sm" variant="ghost" className="ml-1 h-6 px-2" onClick={() => confirmRun(withdrawPriceRow(ir.id, r.id), `${r.id} withdrawn`)}>
                            Withdraw
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{r.ref?.startsWith("RFQ-") ? <DocLinkText to={`/purchasing/rfqs/${r.ref}`}>{r.ref}</DocLinkText> : r.ref}</TableCell>
                      <TableCell>{userName(r.createdBy)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "scales",
            label: "Scales and surcharge",
            content: (
              <div className="flex flex-col gap-4">
                {ir.scales.length ? (
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow>
                        <TableHead>From quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ir.scales.map((x) => (
                        <TableRow key={x.fromQty} className="h-8 text-[13px]">
                          <TableCell className="tabular">{x.fromQty.toLocaleString()}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(x.price, ir.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No quantity scales.</p>
                )}
                <p className="text-sm">Surcharge: {ir.surcharge ? <DocLinkText to="/pricing/surcharges">{ir.surcharge}</DocLinkText> : "None linked"}</p>
              </div>
            ),
          },
          {
            id: "actuals",
            label: "Rolling actuals",
            content: (
              <Section title="Rolling actuals">
                {ir.actuals.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {ir.actuals.map((a) => {
                      const d = ((a.price - basis) / basis) * 100
                      return (
                        <li key={a.kind} className="flex flex-wrap items-center gap-2">
                          <span className="w-28 text-muted-foreground">{a.kind}</span>
                          <span className="font-mono">{a.doc}</span> {fmtMoney(a.price, ir.currency)} on {fmtDate(a.on)}
                          {Math.abs(d) > IR_DEVIATION_PCT && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <TriangleAlert className="size-4" aria-hidden="true" /> {d.toFixed(1)}% against basis
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No purchase history yet.</p>
                )}
              </Section>
            ),
          },
        ]}
        doc={rfqRef ? { type: "rfq", id: rfqRef } : { type: "material", id: ir.materialId }}
      />
      <IrRules />
      <DialogShell
        open={dlg === "row"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`New price row on ${ir.id}`}
        description={`Current basis ${fmtMoney(basis, ir.currency)}. Rows are effective-dated; the current row closes the day before the new one starts.`}
        consequence={
          source === "Manual" && delta > IR_DEVIATION_PCT
            ? `Manual price ${delta.toFixed(1)}% from basis: the row is saved waiting for the Purchasing Manager and does not price anything until approved.`
            : `The row prices MRP proposals and POs from ${fmtDate(from)}.`
        }
        confirmLabel="Add price row"
        onConfirm={() => confirmRun(addPriceRow(ir.id, { price: np, validFrom: from, source, ref: ref || undefined }), (r) => (r.pending ? "Saved; waiting for the Purchasing Manager" : "Price row added"))}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr-src">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as IrSource)}>
              <SelectTrigger id="pr-src">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["RFQ Award", "Contract", "Manual"] as const).map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr-ref">Reference</Label>
            <Input id="pr-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={source === "RFQ Award" ? "RFQ-TBD-..." : ""} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr-price">Price ({ir.currency})</Label>
            <Input id="pr-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pr-from">Valid from</Label>
            <Input id="pr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "expire"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Expire ${ir.id}`}
        consequence={`Every open price row ends today; ${ir.vendorId} stops being a priced source for ${ir.materialId}. History stays visible.`}
        destructive
        confirmLabel="Expire info record"
        onConfirm={() => confirmRun(expireIr(ir.id), `${ir.id} expired`)}
      />
    </>
  )
}
