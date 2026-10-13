// INV 2.3 + MM views: Material Detail, ten views [DOC:p.245] (asserted); fields per Book II §3.4-3.13.
// Tabs General, Units, Planning, Purchasing, Production, Warehouse, Quality, Accounting and Costing
// (with the GL preview panel), Sales (INV-ITEM-SALES), Stock overview and References.
// View owners edit Class 1 fields in place; Class 2 changes run as an MCH; Class 3 never (§4.4).
import { useState, type ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { Calculator, Pencil, Printer, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell } from "@/components/templates"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Chip, EmptyState, KV, PostingPreview, RulesPanel, StatusBadge } from "@/components/patterns"
import type { MaterialStatus as MStatus } from "@/data/domain"
import { TODAY, USERS, WAREHOUSES } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useRole, useSlice } from "@/store"
import { SIM_TRANSACTIONS, TYPE_BEHAVIOR, resolveRow, VALUATION_CLASS_LABEL, completeness, fieldDef, isValuated, simulate } from "../lib/rules"
import { getMaterial, onHand, ownValue, rateOf, R } from "../data/state"
import { endMaterial, irStatus, liveRows, saveClass1, whereUsedSweep } from "../data/actions"
import type { MaterialViews } from "../data/types"
import { Completeness, DocLinkText, FieldRow, IrStatusBadge, Reading, Section, TypeBadge, show, userName } from "../components/common"
import { ItemSalesTab } from "./ItemSales"
import { CopyFromDialog, ExtendToPlantDialog, FunctionBlockDialog, LIFECYCLE_DIALOGS, LifecycleDialog, lifecycleBlocker, type LifecycleKind } from "../components/dialogs"
import { SimulateGlDialog } from "../components/simulate"
import { ssAlerts, ssEffective } from "../lib/rules"
import { confirmRun } from "../components/run"

const VIEW_TABS = ["general", "units", "planning", "purchasing", "production", "warehouse", "quality", "accounting", "sales", "stock", "references"] as const

export function MaterialDetail({ tab: forcedTab }: { tab?: string }) {
  const { id = "" } = useParams()
  const [sp] = useSearchParams()
  const s = useSlice("materials")
  const [role] = useRole()
  const m = getMaterial(s, id)
  const v = s.views[id]
  const [dlg, setDlg] = useState<null | "block" | "edit" | "end" | "sim" | "extend" | "copy">(null)
  const [lc, setLc] = useState<LifecycleKind | null>(null)
  const [to] = useState<MStatus | "">("")
  const [editKey, setEditKey] = useState<keyof MaterialViews>("longText")
  const [editVal, setEditVal] = useState("")
  const tab = forcedTab ?? sp.get("tab") ?? "general"

  if (!m)
    return (
      <EmptyState title={`Material ${id} not found`}>
        It may have been withdrawn with its Draft MCR. <Link to="/inventory/items" className="text-link underline">Back to the material list</Link>
      </EmptyState>
    )
  const comp = completeness(m, v)
  const ended = s.ended.find((e) => e.materialId === m.id)
  const impact = whereUsedSweep(s, m.id, TODAY)
  const impactList = (title: string) => (
    <Section title={`${title} (${impact.length})`}>
      {impact.length ? (
        <ul className="max-h-48 overflow-y-auto text-sm">
          {impact.map((x, i) => (
            <li key={i}>
              {x.kind} · <span className="font-mono">{x.ref}</span>
              {x.note && ` · ${x.note}`}
              {x.open && to === "Obsolete" && x.kind !== "Stock" && <span className="text-destructive"> · blocks Obsolete (V-MM-20)</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No references found.</p>
      )}
    </Section>
  )
  const mcr = s.mcrs.find((r) => r.materialId === m.id)
  const openMcr = mcr && mcr.open ? mcr : undefined
  const terminal = m.status === "Obsolete" || !!ended
  const lcKinds = (Object.keys(LIFECYCLE_DIALOGS) as LifecycleKind[]).filter((k) => k !== "delete" && !lifecycleBlocker(k, m.status))

  const startEdit = (key: keyof MaterialViews) => {
    setEditKey(key)
    setEditVal(String((v as unknown as Record<string, unknown>)?.[key] ?? ""))
    setDlg("edit")
  }
  /** One field row with its class marker and the edit affordance for its class. */
  const F = ({ k, label, children }: { k?: keyof MaterialViews | "profitCenterId" | "materialNo" | "type" | "baseUom"; label: string; children?: ReactNode }) => {
    const f = k ? fieldDef(k) : undefined
    return (
      <FieldRow label={label} cls={f?.cls} owner={f?.owner}>
        <span className="flex flex-wrap items-center gap-2">
          {children ?? <span className="text-muted-foreground">Not recorded</span>}
          {!terminal && f?.cls === 1 && role === f.owner && (
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => startEdit(k as keyof MaterialViews)} aria-label={`Edit ${label}`}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
          )}
          {!terminal && f?.cls === 1 && role !== f.owner && <span className="text-xs text-muted-foreground">Read-only here; edited by the {f.owner} (§3.2)</span>}
          {!terminal && f?.cls === 2 && (
            <Link to={`/materials/change-requests?materials=${m.id}&field=${k}`} className="text-xs text-link underline-offset-4 hover:underline">
              Change via MCH
            </Link>
          )}
          {f?.cls === 3 && <span className="text-xs text-muted-foreground">Never editable; change by supersession</span>}
        </span>
      </FieldRow>
    )
  }
  const dl = (children: ReactNode) => <dl className="max-w-3xl">{children}</dl>
  if (!v)
    return (
      <EmptyState title={`${m.id} has no view data`}>
        The views of this material were not loaded. <Link to="/inventory/items" className="text-link underline">Back to the list</Link>
      </EmptyState>
    )

  const general = dl(
    <>
      <F label="Material number" k="materialNo">
        <span className="font-mono">{m.materialNo}</span>
      </F>
      <F label="Material type" k="type">
        <TypeBadge type={m.type} />
      </F>
      <F label="Short description">{m.description}</F>
      <F label="Long description" k="longText">
        {show(v.longText)}
      </F>
      <F label="Material group (L1 / L2 / L3)">{show(v.groupPath.join(" / "))}</F>
      <F label="Legacy code">{show(v.legacyCode)}</F>
      <F label="Manufacturer parts">{v.mfrParts.length ? v.mfrParts.map((p) => `${p.manufacturer} ${p.mpn}${p.preferred ? " (preferred)" : ""}`).join("; ") : undefined}</F>
      <F label="Characteristics">{v.characteristics.length ? v.characteristics.map((c) => `${c.key}: ${c.value}`).join("; ") : undefined}</F>
      <F label="HTS / Schedule B">{show([v.hts, v.scheduleB].filter(Boolean).join(" / "))}</F>
      <F label="Country of origin">{show(v.coo)}</F>
      <F label="Hazardous">{v.hazardous ? `Yes, ${v.hazmat ?? "class not recorded"}` : "No"}</F>
      <F label="Buy America relevant">{show(v.buyAmerica)}</F>
      <F label="Steward" k="stewardId">
        {userName(v.stewardId)}
      </F>
      <F label="Buyer" k="buyerId">
        {userName(v.buyerId)}
      </F>
      <F label="Planner" k="plannerId">
        {userName(v.plannerId)}
      </F>
      <div className="mt-4 rounded-md border p-3 text-xs">
        <p className="mb-1 font-semibold">Type behaviour for {m.type} (Book II §2.2)</p>
        <p>
          Inventory {TYPE_BEHAVIOR[m.type].inventory} · Sellable default {TYPE_BEHAVIOR[m.type].sellableDefault} · Batch {TYPE_BEHAVIOR[m.type].batchDefault} · Serial {TYPE_BEHAVIOR[m.type].serialDefault} · QI {TYPE_BEHAVIOR[m.type].qiDefault} · Costing{" "}
          {TYPE_BEHAVIOR[m.type].costing} · Producible {TYPE_BEHAVIOR[m.type].producible}
        </p>
      </div>
    </>,
  )
  const units = dl(
    <>
      <F label="Base UoM" k="baseUom">
        <span className="font-mono">{m.baseUom}</span> {v.hasPostings ? <span className="text-xs text-muted-foreground">(locked after first posting, E-MM-04)</span> : <span className="text-xs text-muted-foreground">(editable until first posting)</span>}
      </F>
      <F label="Alternative UoMs">{v.altUoms.length ? v.altUoms.map((a) => `1 ${a.uom} = ${fmtNumber(a.num / a.den, 4)} ${m.baseUom} (${a.usage})`).join("; ") : undefined}</F>
      <F label="Net / gross weight">{v.netWeight != null ? `${v.netWeight} / ${v.grossWeight} ${v.weightUom}` : undefined}</F>
      <F label="Dimensions L x W x H">{show(v.dims)}</F>
      <F label="Volume">{show(v.volume)}</F>
    </>,
  )
  const planning = dl(
    <>
      <F label="MRP type" k="mrpType">
        {v.mrpType}
      </F>
      <F label="Procurement type" k="procurement">
        {v.procurement}
      </F>
      <F label="Special procurement">{show(v.specialProc)}</F>
      <F label="Lot sizing" k="lotSizing">
        {v.lotSizing}
      </F>
      <F label="Planned delivery time (days)" k="plannedDeliveryDays">
        {show(v.plannedDeliveryDays)}
      </F>
      <F label="GR processing time (days)" k="grProcDays">
        {show(v.grProcDays)}
      </F>
      <F label="In-house production (days)">{show(v.inHouseDays)}</F>
      <F label="Planning time fence (days)">{show(v.fenceDays)}</F>
      <F label="Scrap %">{show(v.scrapPct)}</F>
      <F label="Backflush">{show(v.backflush)}</F>
      <F label="Issue method">{show(v.issueMethod)}</F>
      <F label="Strategy">{show(v.strategy)}</F>
      <F label="ABC / XYZ">{show([v.abc, v.xyz].filter(Boolean).join(" / "))}</F>
      <F label="Reorder point / max stock">{v.reorderPoint != null ? `${v.reorderPoint} / ${v.maxStock} ${m.baseUom}` : undefined}</F>
    </>,
  )
  const ssRows = s.safetyStock.filter((r) => r.materialId === m.id)
  const planningTab = (
    <div className="flex flex-col gap-4">
      {planning}
      <Section title={`Safety stock by warehouse (${ssRows.length})`} action={<DocLinkText to={R.ss(`material=${m.id}`)}>Open INV-PLAN-SAFETY</DocLinkText>}>
        {ssRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No safety stock row for this material. It is set per warehouse on INV-PLAN-SAFETY.</p>
        ) : (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Safety stock</TableHead>
                <TableHead className="text-right">Item default</TableHead>
                <TableHead className="text-right">ADU</TableHead>
                <TableHead className="text-right">Lead time (d)</TableHead>
                <TableHead className="text-right">Max stock</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ssRows.map((r) => (
                <TableRow key={r.id} className="h-8 text-[13px]">
                  <TableCell className="font-mono">
                    <DocLinkText to={R.ss(`row=${r.id}`)}>{r.warehouseId}</DocLinkText>
                  </TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(ssEffective(r))} {r.uom}</TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(r.defaultSs)}</TableCell>
                  <TableCell className="tabular text-right">{r.adu}</TableCell>
                  <TableCell className="tabular text-right">{r.ltDays}</TableCell>
                  <TableCell className="tabular text-right">{fmtNumber(r.maxStock)}</TableCell>
                  <TableCell className="text-xs">{ssAlerts(r).map((a) => a.code).join(", ") || <span className="text-muted-foreground">None</span>}</TableCell>
                  <TableCell>{r.pending ? <Chip kind="change">{r.pending.changeId}</Chip> : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">Read-only here: Planner or Warehouse supervisor edits on INV-PLAN-SAFETY; a change above 25% goes to the Planning Manager (§10.1).</p>
      </Section>
    </div>
  )
  const irs = s.infoRecords.filter((x) => x.materialId === m.id)
  const sl = s.sourceList.filter((x) => x.materialId === m.id)
  const purchasing = (
    <div className="flex flex-col gap-4">
      {dl(
        <>
          <F label="Purchase UoM">{show(v.purchUom)}</F>
          <F label="Minimum order quantity">{show(v.moq)}</F>
          <F label="Over-delivery tolerance %" k="overTolPct">
            {show(v.overTolPct)}
          </F>
          <F label="Under-delivery tolerance %">{show(v.underTolPct)}</F>
          <F label="GR-based invoice verification">{show(v.grBasedIv)}</F>
          <F label="Source determination policy">{show(v.sourcePolicy)}</F>
          <F label="Quality clauses">{show(v.qualityClauses)}</F>
          <F label="Purchasing text" k="purchText">
            {show(v.purchText)}
          </F>
          <F label="Tax category (purchase)">{show(v.taxCategory)}</F>
        </>,
      )}
      <Section title={`Info records (${irs.length})`} action={<DocLinkText to={`/purchasing/info-records?material=${m.id}`}>Open MM-IR-001</DocLinkText>}>
        {irs.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Info record</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Lead time (d)</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {irs.map((x) => (
                <TableRow key={x.id} className="h-8 text-[13px]">
                  <TableCell><DocLinkText to={R.ir(x.id)}>{x.id}</DocLinkText></TableCell>
                  <TableCell className="font-mono">{x.vendorId}</TableCell>
                  <TableCell className="tabular text-right">{fmtMoney(x.price, x.currency)} per {x.priceUnit} {m.baseUom}</TableCell>
                  <TableCell className="tabular text-right">{x.leadDays}</TableCell>
                  <TableCell>{fmtDate(x.validFrom)}{x.validTo ? ` to ${fmtDate(x.validTo)}` : " onward"}</TableCell>
                  <TableCell><IrStatusBadge status={irStatus(s, x.id, TODAY)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No info record. The MCR Purchasing task creates the first one.</p>
        )}
      </Section>
      <Section title={`Source list (${sl.length} rows)`} action={<DocLinkText to={R.sl(m.id)}>Open MM-SL-001</DocLinkText>}>
        {sl.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Fixed</TableHead>
                <TableHead>MRP relevant</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sl.map((r) => (
                <TableRow key={`${r.vendorId}-${r.validFrom}`} className="h-8 text-[13px]">
                  <TableCell className="font-mono">{r.vendorId}</TableCell>
                  <TableCell>{fmtDate(r.validFrom)}{r.validTo ? ` to ${fmtDate(r.validTo)}` : " onward"}</TableCell>
                  <TableCell>{r.fixed ? "Fixed" : "No"}</TableCell>
                  <TableCell>{r.mrpRelevant ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.blocked ? <Chip kind="block">Blocked</Chip> : "Valid"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No source list rows; the policy decides the source.</p>
        )}
        <p className="text-xs text-muted-foreground">Read-only here; the Buyer maintains info records and the Purchasing Manager the source list (§7.2, §7.4).</p>
      </Section>
    </div>
  )
  const ebomAhead = s.x.ebomAhead.find((e) => e.materialId === m.id)
  const productionFields = dl(
    <>
      <F label="Production scheduler">{userName(v.schedulerId)}</F>
      <F label="Default issue warehouse">{show(v.issueWarehouse)}</F>
      <F label="Batch size">{show(v.batchSize)}</F>
      <F label="Serialization point">{show(v.serializationAt)}</F>
      <F label="Batch creation point">{show(v.batchAt)}</F>
      <F label="MBOM">{v.mbomRef ? <DocLinkText to={`/engineering/mbom-transform/${v.mbomRef}`}>{v.mbomRef}</DocLinkText> : undefined}</F>
      <F label="Routing">{show(v.routingRef)}</F>
      <F label="Work notes">{show(v.workNotes)}</F>
    </>,
  )
  const production = (
    <div className="flex flex-col gap-4">
      {ebomAhead && (
        <Alert role="status">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>EBOM is ahead of the MBOM</AlertTitle>
          <AlertDescription>
            <span>
              <DocLinkText to={`/engineering/boms/${ebomAhead.ebomRef}`}>{ebomAhead.ebomRef}</DocLinkText> rev {ebomAhead.ebomRev} is newer than the active <DocLinkText to={`/engineering/mbom-transform/${ebomAhead.mbomRef}`}>{ebomAhead.mbomRef}</DocLinkText> rev {ebomAhead.mbomRev}. {ebomAhead.note} Production keeps using the active MBOM until Engineering activates the next one (Engineering owns this; shown here for information).
            </span>
          </AlertDescription>
        </Alert>
      )}
      {productionFields}
    </div>
  )
  const warehouse = dl(
    <>
      <F label="Default warehouse / bin">{show([v.defaultWarehouse, v.defaultBin].filter(Boolean).join(" / "))}</F>
      <F label="Putaway strategy">{show(v.putaway)}</F>
      <F label="Picking strategy">{show(v.picking)}</F>
      <F label="Storage conditions">{show(v.storage)}</F>
      <F label="Shelf life (days)">{show(v.shelfLifeDays)}</F>
      <F label="Count class">{show(v.countClass)}</F>
    </>,
  )
  const quality = dl(
    <>
      <F label="QI at receipt">{v.qiReceipt ? "On: receipts post to QI Hold" : "Off: receipts post Unrestricted"}</F>
      <F label="QI in production">{show(v.qiProduction)}</F>
      <F label="Certificates required">{show(v.certs)}</F>
      <F label="Vendor qualification required">{show(v.vendorQualReq)}</F>
      <F label="Batch requirements">{show(v.batchReqs)}</F>
      <F label="Inspection plans">{show(v.plans)}</F>
    </>,
  )

  // GL preview panel (Book VI p.245): matrix resolution for this material's valuation class
  const vc = v.valuationClass
  const rate = rateOf(s, m.id)
  const live = liveRows(s.acctDetermination)
  const checkKeys = Array.from(new Set(SIM_TRANSACTIONS.flatMap((t) => t.legs.map((l) => l.key))))
  const glGaps = checkKeys.filter((k) => !resolveRow(live, k, vc))
  const sims = SIM_TRANSACTIONS.filter((t) => ["grn", "issue", "pgi", "adj-", "scrap"].includes(t.id)).map((t) => ({ t, legs: simulate(live, t.id, vc, rate) }))
  const val = s.valuations.filter((x) => x.materialId === m.id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  // E&O Reserve % (read-only, §3.11 [DOC:p.147]): the rate applied by the last posted E&O run
  const eoRun = s.eoRuns.filter((r) => r.stage === "Posted").sort((a, b) => (b.postedOn ?? "").localeCompare(a.postedOn ?? ""))[0]
  const eoRow = eoRun?.rows.find((r) => r.materialId === m.id)
  const eoNow = eoRow && eoRun ? { pct: eoRow.pct, bucket: eoRow.bucket, run: eoRun.id } : undefined
  const accounting = (
    <div className="flex flex-col gap-4">
      {dl(
        <>
          <F label="Valuation class" k="valuationClass">
            {vc ? VALUATION_CLASS_LABEL[vc] ?? vc : isValuated(m.type) ? undefined : `${m.type} is not valuated`}
          </F>
          <F label="Valuation method" k="method">
            {show(v.method)}
          </F>
          <F label="Current rate">{isValuated(m.type) && rate ? `${fmtMoney(rate)} per ${v.priceUnit} ${m.baseUom}` : undefined}</F>
          <F label="Price unit">{v.priceUnit}</F>
          <F label="Profit center" k="profitCenterId">
            {m.profitCenterId}
          </F>
          <F label="Overhead group">{show(v.overheadGroup)}</F>
          <F label="Costing lot size">{show(v.costingLotSize)}</F>
          <F label="Do not cost">{show(v.doNotCost)}</F>
          <F label="E&O reserve %">{eoNow ? `${eoNow.pct}% (${eoNow.bucket}), run ${eoNow.run}` : isValuated(m.type) ? "0% (no reserve applied by the last posted run)" : undefined}</F>
          <F label="Future / previous standard">{v.futureStd || v.prevStd ? `${v.futureStd ? fmtMoney(v.futureStd) : "none"} / ${v.prevStd ? fmtMoney(v.prevStd) : "none"}` : undefined}</F>
        </>,
      )}
      {val.length > 0 && (
        <Section title="Valuation history (effective-dated, C-50)">
          <ul className="text-sm">
            {val.map((x, i) => (
              <li key={i}>
                {fmtDate(x.validFrom)} · {x.method} · {x.method === "Standard" ? fmtMoney(x.stdCost ?? 0) : fmtMoney(x.mav ?? 0)} · {x.valuationClass} · {x.entityId}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {isValuated(m.type) && (
        <Section title="GL preview: how this material posts" action={<DocLinkText to="/materials/account-determination">MM-VAL-001 (read only)</DocLinkText>}>
          <p role="status" className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", glGaps.length && "border-status-blocked")}>
            {glGaps.length ? <TriangleAlert className="size-4" aria-hidden="true" /> : null}
            {glGaps.length ? `GL determination check failed (E-MM-21): ${[...new Set(glGaps)].join(", ")} do not resolve for class ${vc ?? "none"}. Activation and postings would be refused.` : `GL determination check passed: every event key (${checkKeys.length}) resolves for class ${vc ?? "none"}.`}
          </p>
          <p className="text-xs text-muted-foreground">Resolved through the released account determination matrix, exact (key + class + qualifier), then key + class, then key only (Book II §5.2). One base unit at the current rate.</p>
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>Debit (key / account)</TableHead>
                <TableHead>Credit (key / account)</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sims.map(({ t, legs }) => (
                <TableRow key={t.id} className="h-8 text-[13px]">
                  <TableCell>{t.label}</TableCell>
                  {legs.map((l, i) => (
                    <TableCell key={i} className={cn(!l.account && "text-destructive")}>
                      {l.key} · {l.account ?? "E-MM-21 gap: no row resolves"} {l.rowId && <span className="text-xs text-muted-foreground">({l.rowId})</span>}
                    </TableCell>
                  ))}
                  <TableCell className="tabular text-right">{fmtMoney(rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {m.type === "RAW" && <PostingPreview title="Template posting on issue to a work order" lines={[{ template: 28, amount: rate, detail: `1 ${m.baseUom} ${m.id} at ${fmtMoney(rate)}, SP-08 or backflush` }]} />}
          {m.type === "FIN" && <PostingPreview title="Template posting on shipment" lines={[{ template: 25, amount: rate, detail: `1 ${m.baseUom} ${m.id} at standard` }]} />}
        </Section>
      )}
    </div>
  )

  // INV-ITEM-SALES: Book I Part A §4 sales tab (pages/ItemSales.tsx)
  const sales = <ItemSalesTab materialId={m.id} />

  const grnFocus = sp.get("grn")
  const stock = s.stock.filter((r) => r.materialId === m.id)
  const grns = s.grns.filter((g) => g.lines.some((l) => l.materialId === m.id))
  const stockTab = (
    <div className="flex flex-col gap-4">
      {stock.length === 0 ? (
        <EmptyState title="No stock">Nothing on hand in any warehouse, bucket or status.</EmptyState>
      ) : (
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Warehouse / bin</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Serials</TableHead>
              <TableHead>Stock status</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Last movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map((r) => (
              <TableRow key={r.id} className={cn("h-8 text-[13px]", grnFocus && r.grnId === grnFocus && "bg-muted")}>
                <TableCell className="font-mono">
                  {r.warehouseId} / {r.bin}
                </TableCell>
                <TableCell>{r.batchId ? <DocLinkText to={`/traceability/explorer?q=${r.batchId}`}>{r.batchId}</DocLinkText> : ""}</TableCell>
                <TableCell className="text-xs">{r.serials?.join(", ")}</TableCell>
                <TableCell>
                  <StatusBadge kind="stock" status={r.status} size="sm" />
                </TableCell>
                <TableCell>{r.bucket}</TableCell>
                <TableCell className="tabular text-right">
                  {fmtNumber(r.qty)} {m.baseUom}
                </TableCell>
                <TableCell className="text-xs">
                  {r.grnId && <span className="font-mono">{r.grnId}</span>} {r.pegRef && <span className="font-mono">{r.pegRef}</span>}
                </TableCell>
                <TableCell>{fmtDate(r.lastMovement)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        PE-owned on hand {fmtNumber(onHand(s, m.id))} {m.baseUom}, value {fmtMoney(ownValue(s, m.id))}. Consignment is vendor-owned and not valued (§14.1). Status moves QI Hold to Unrestricted or Blocked when the inspection closes.
      </p>
      {grns.length > 0 && (
        <Section title="Goods receipts (INV)">
          <ul className="flex flex-col gap-2 text-sm">
            {grns.map((g) => (
              <li key={g.id} className={cn("rounded-md border p-2", grnFocus === g.id && "border-primary")}>
                <span className="font-mono font-semibold">{g.id}</span> · {fmtDate(g.on)} · PO <DocLinkText to={`/purchasing/orders/${g.poId}`}>{g.poId}</DocLinkText> · {g.vendorId}
                {g.lines
                  .filter((l) => l.materialId === m.id)
                  .map((l, i) => (
                    <div key={i} className="text-xs">
                      {l.qty} {m.baseUom}
                      {l.batchId && ` · batch ${l.batchId}`}
                      {l.vendorBatch && ` (vendor batch ${l.vendorBatch})`} · received to <StatusBadge kind="stock" status={l.status} size="sm" /> · {fmtMoney(l.value)}
                    </div>
                  ))}
                {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )

  const hist = s.history.filter((h) => h.materialId === m.id)
  const sups = s.supersessions.filter((x) => x.predecessorId === m.id || x.successorId === m.id)
  const references = (
    <div className="flex flex-col gap-4">
      <Section title="Documents">
        {v.documents.length ? (
          <ul className="text-sm">
            {v.documents.map((d) => (
              <li key={d.id}>
                <DocLinkText to={`/engineering/documents/${d.id}`}>{d.id}</DocLinkText> {d.title} · {d.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No linked documents.</p>
        )}
      </Section>
      <Section title="Where used">
        {v.whereUsed.length ? (
          <ul className="text-sm">
            {v.whereUsed.map((w, i) => (
              <li key={i}>
                <span className="font-mono">{w.ref}</span> · {w.kind}
                {w.note && ` · ${w.note}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Not used on any BOM, routing or order.</p>
        )}
      </Section>
      <Section title="Creation and supersession">
        <ul className="text-sm">
          {mcr && (
            <li>
              <DocLinkText to={R.mcr(mcr.id)}>{mcr.id}</DocLinkText> · {mcr.path} · {mcr.stage}
            </li>
          )}
          {sups.map((x) => (
            <li key={x.id}>
              <DocLinkText to={R.sup(x.id)}>{x.id}</DocLinkText> · {x.predecessorId} to {x.successorId} · {x.stage}
            </li>
          ))}
          {!mcr && !sups.length && <li className="text-muted-foreground">Migrated record; no MCR or supersession.</li>}
        </ul>
      </Section>
      <Section title={`Change history (${hist.length}, immutable)`}>
        {hist.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old</TableHead>
                <TableHead>New</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hist.map((h, i) => (
                <TableRow key={i} className="h-8 text-[13px]">
                  <TableCell>{fmtDate(h.at)}</TableCell>
                  <TableCell>{h.field}</TableCell>
                  <TableCell>{h.old}</TableCell>
                  <TableCell>{h.new}</TableCell>
                  <TableCell>{userName(h.by)}</TableCell>
                  <TableCell className="font-mono text-xs">{h.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No changes recorded.</p>
        )}
      </Section>
    </div>
  )

  const tabs = [
    { id: "general", label: "General", content: general },
    { id: "units", label: "Units", content: units },
    { id: "planning", label: "Planning", content: planningTab },
    { id: "purchasing", label: "Purchasing", content: purchasing },
    { id: "production", label: "Production", content: production },
    { id: "warehouse", label: "Warehouse", content: warehouse },
    { id: "quality", label: "Quality", content: quality },
    { id: "accounting", label: "Accounting and Costing", content: accounting },
    { id: "sales", label: "Sales", content: sales },
    { id: "stock", label: "Stock overview", content: stockTab, count: stock.length },
    { id: "references", label: "References", content: references },
  ]
  const ed = fieldDef(editKey)

  return (
    <>
      <DetailPage
        key={`${m.id}-${tab}`}
        header={{
          screenId: tab === "sales" ? "INV-ITEM-SALES" : "INV 2.3 + MM views",
          title: `${m.id} ${m.description}`,
          crumbs: [{ label: "Material list", to: "/inventory/items" }, { label: m.id }],
          chips: (
            <>
              <TypeBadge type={m.type} />
              {m.blocks.map((b) => (
                <Chip key={b.block} kind="block" note={`${b.reason} (set ${b.on})`}>
                  {b.block}
                </Chip>
              ))}
            </>
          ),
          primary: openMcr ? (
            <Button asChild>
              <Link to={R.mcr(openMcr.id)}>Open {openMcr.id} to complete and activate</Link>
            </Button>
          ) : !terminal ? (
            <Button asChild>
              <Link to={`/materials/supersessions?new=${m.id}`}>Supersede</Link>
            </Button>
          ) : undefined,
          actions: (
            <>
              {!terminal && lcKinds.map((k) => (
                <Button key={k} variant="outline" onClick={() => setLc(k)}>
                  {LIFECYCLE_DIALOGS[k].label}
                </Button>
              ))}
              {!terminal && (m.status === "Data Completion" || m.status === "Draft") && (
                <Button variant="outline" onClick={() => setDlg("end")}>
                  {m.status === "Data Completion" ? "Reject material" : "Delete draft"}
                </Button>
              )}
              {(m.status === "Active" || m.status === "Restricted") && (
                <Button variant="outline" onClick={() => setDlg("block")}>
                  Set block
                </Button>
              )}
              <Button variant="outline" onClick={() => setDlg("copy")}>
                Copy from
              </Button>
              <Button variant="outline" onClick={() => setDlg("extend")} title={s.x.plantSrc.dec07 ? undefined : "One plant at go-live (Book II §3.3): the dialog explains and stays disabled until DEC-07 fires"}>
                Extend to plant
              </Button>
              {isValuated(m.type) && (
                <Button variant="outline" onClick={() => setDlg("sim")}>
                  <Calculator aria-hidden="true" /> Simulate GL
                </Button>
              )}
              <Button variant="ghost" onClick={() => toast.success(`Label for ${m.id} sent to the default label printer (simulated)`)}>
                <Printer aria-hidden="true" /> Print label
              </Button>
            </>
          ),
        }}
        status={{ kind: "material", value: m.status }}
        doc={{ type: "material", id: m.id }}
        summary={
          <>
            <KV k="Completeness">
              <Completeness pct={comp.pct} active={m.status === "Active"} />
            </KV>
            <KV k="On hand">
              {fmtNumber(onHand(s, m.id))} {m.baseUom}
            </KV>
            <KV k="Stock value">{fmtMoney(ownValue(s, m.id))}</KV>
            <KV k="Plants">{s.plantData.filter((p) => p.materialId === m.id).map((p) => p.plantId).join(", ") || "PL-TBD-01"} · {WAREHOUSES.length} warehouses</KV>
            {ended && (
              <KV k={ended.how}>
                {fmtDate(ended.on)} by {userName(ended.by)}: {ended.reason} <Reading id="RD-MM-23" />
              </KV>
            )}
          </>
        }
        tabs={tabs}
        defaultTab={VIEW_TABS.includes(tab as (typeof VIEW_TABS)[number]) ? tab : "general"}
        aside={
          comp.missing.length > 0 ? (
            <Section title={`Missing for use (${comp.missing.length})`}>
              <ul className="list-disc pl-4 text-xs">
                {comp.missing.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <Reading id="RD-MM-16" />
            </Section>
          ) : undefined
        }
      />
      <RulesPanel
        rules={[
          ["§4.4", "Class 1 fields are edited in place by the owning role; Class 2 changes run as an MCH with approval; Class 3 (type, number, base UoM after first posting) never change.", "[Book II §4.4]"],
          ["§4.1", "Lifecycle per S-42: Data Completion becomes Active only through MCR activation, or ends as Rejected; a Draft with zero references may be deleted; Active, Restricted and Blocked may become Obsolete when stock is zero and the where-used sweep is empty (V-MM-20).", "[Book II §4.1, §4.4]"],
          ["§3.2", "Only the owning role's screens edit a field group; every other view is read-only.", "[Book II §3.2]"],
          ["§4.5", "Blocks are additive chips set by their named role on Active or Restricted materials.", "[Book II §4.5]"],
          ["RD-MM-08", "Lifecycle changes on this screen are pressed by the Materials Manager (reading).", "README Readings"],
          ["C-55", "Obsolete is terminal: the record opens read-only.", "erd-sketch §4"],
        ]}
      />
      <DialogShell
        open={dlg === "end"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={m.status === "Data Completion" ? `Reject ${m.id}` : `Delete draft ${m.id}`}
        description={`Acting as ${role}. Rejected and Deleted are transitions with no status row (K-16).`}
        consequence={m.status === "Data Completion" ? `${m.id} ends: its MCR closes as Rejected and the material leaves every list. The change history keeps the record.` : `${m.id} is physically deleted; allowed only with zero references.`}
        requireReason
        destructive
        wide
        confirmLabel={m.status === "Data Completion" ? "Reject material" : "Delete draft"}
        onConfirm={(reason) => confirmRun(endMaterial(m.id, m.status === "Data Completion" ? "Rejected" : "Deleted", reason), `${m.id} ${m.status === "Data Completion" ? "rejected" : "deleted"}`)}
      >
        {impactList("References")}
        <Reading id="RD-MM-23" />
      </DialogShell>
      {lc && <LifecycleDialog kind={lc} materialId={m.id} open onOpenChange={(o) => !o && setLc(null)} />}
      <FunctionBlockDialog materialId={m.id} open={dlg === "block"} onOpenChange={(o) => !o && setDlg(null)} />
      <ExtendToPlantDialog materialId={m.id} open={dlg === "extend"} onOpenChange={(o) => !o && setDlg(null)} />
      <CopyFromDialog materialId={m.id} open={dlg === "copy"} onOpenChange={(o) => !o && setDlg(null)} />
      <SimulateGlDialog materialId={m.id} open={dlg === "sim"} onOpenChange={(o) => !o && setDlg(null)} />
      <DialogShell
        open={dlg === "edit"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Edit ${ed?.label ?? editKey}`}
        description={`Class 1 field owned by the ${ed?.owner}. Saved in place and written to the change history.`}
        confirmLabel="Save view"
        onConfirm={() => confirmRun(saveClass1(m.id, editKey, editVal), `${ed?.label} saved`)}
      >
        <Label htmlFor="ed-val">{ed?.label}</Label>
        {ed?.options ? (
          <Select value={editVal} onValueChange={setEditVal}>
            <SelectTrigger id="ed-val">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ed.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : editKey === "stewardId" || editKey === "buyerId" || editKey === "plannerId" ? (
          <Select value={editVal} onValueChange={setEditVal}>
            <SelectTrigger id="ed-val">
              <SelectValue placeholder="Choose a person" />
            </SelectTrigger>
            <SelectContent>
              {USERS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.roles.join(", ")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input id="ed-val" value={editVal} inputMode={ed?.numeric ? "decimal" : undefined} onChange={(e) => setEditVal(e.target.value)} />
        )}
      </DialogShell>
    </>
  )
}

/** /inventory/items/:id/sales (INV-ITEM-SALES): the detail opened on its Sales tab. */
export function MaterialSalesTab() {
  return <MaterialDetail tab="sales" />
}
