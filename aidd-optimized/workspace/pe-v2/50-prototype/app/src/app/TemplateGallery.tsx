// /dev/templates and /dev/kiosk: living examples of every template and shared pattern, filled with
// shared seed data (hero thread). Module agents copy from here. Not a PRD screen.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApprovalButton, Chip, DataTable, DocumentFlowPanel, FamilyLegend, KV, PostingPreview, ScanField, StatusBadge, type Column } from "@/components/patterns"
import { ConfigPage, DashboardCard, DashboardPage, DetailPage, DialogShell, KioskFact, KioskPage, ListPage, WizardPage, WorkbenchPage } from "@/components/templates"
import type { Material, WorkCenter } from "@/data/domain"
import { HERO, MATERIALS, SPINE_DOCS, WORK_CENTERS, materialById } from "@/data/shared"
import { fmtMoney } from "@/lib/format"

const matCols: Column<Material>[] = [
  { id: "id", header: "Material", value: (m) => m.id, sortable: true, mono: true },
  { id: "type", header: "Type", value: (m) => m.type, filterable: true, sortable: true },
  { id: "description", header: "Description", value: (m) => m.description },
  { id: "status", header: "Status", value: (m) => m.status, filterable: true, cell: (m) => <span className="flex flex-wrap gap-1"><StatusBadge kind="material" status={m.status} size="sm" />{m.blocks.map((b) => <Chip key={b.block} kind="block" note={b.reason}>{b.block}</Chip>)}</span> },
  { id: "std", header: "Standard cost", value: (m) => m.stdCost ?? null, cell: (m) => (m.stdCost == null ? "" : fmtMoney(m.stdCost)), align: "right", sortable: true, mono: true },
]
const wcCols: Column<WorkCenter>[] = [
  { id: "id", header: "Work center", value: (w) => w.id, sortable: true, mono: true },
  { id: "name", header: "Name", value: (w) => w.name, sortable: true },
  { id: "cc", header: "Cost center", value: (w) => w.costCenterId, filterable: true, mono: true },
  { id: "status", header: "Status", value: (w) => w.status, filterable: true, cell: (w) => <StatusBadge kind="workCenter" status={w.status} size="sm" /> },
  { id: "eff", header: "Efficiency", value: (w) => w.efficiencyPct, align: "right", cell: (w) => `${w.efficiencyPct}%`, mono: true },
]

const TABS = ["List", "Detail", "Workbench", "Wizard", "Dashboard", "Config", "Dialog", "Patterns"] as const

export function TemplateGallery() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get("t") as (typeof TABS)[number]) ?? "List"
  const [dialog, setDialog] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const so = SPINE_DOCS.find((d) => d.ref.id === HERO.phase1Order)!
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Templates" className="flex flex-wrap gap-2 border-b pb-2">
        <span className="text-sm font-semibold">Template gallery (not a PRD screen):</span>
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={t === tab ? "secondary" : "ghost"} onClick={() => setParams({ t })}>
            {t}
          </Button>
        ))}
        <Button size="sm" variant="ghost" asChild>
          <Link to="/dev/kiosk">Kiosk</Link>
        </Button>
      </nav>

      {tab === "List" && (
        <ListPage<Material>
          header={{ title: "Material listing (example)", screenId: "MM-MAT-001", description: "ListPage + DataTable over shared MATERIALS: search, sort, filter, density, empty and no-match states.", primary: <Button>New material creation request</Button> }}
          table={{ rows: MATERIALS, columns: matCols, rowId: (m) => m.id, searchText: (m) => `${m.id} ${m.description}`, rowHref: (m) => `/inventory/items/${m.id}`, empty: { title: "No materials yet" } }}
        />
      )}

      {tab === "Detail" && (
        <DetailPage
          header={{ title: so.ref.id, screenId: "OM-SO-001/2", crumbs: [{ label: "Sales orders", to: "/sales/orders" }, { label: so.ref.id }], actions: <ApprovalButton kind="No-quote sales order" subject={so.ref} title={so.title} amount={1284000} stay />, primary: <Button>Primary action</Button> }}
          status={so.status}
          doc={so.ref}
          summary={
            <>
              <KV k="Customer">{HERO.customerId}</KV>
              <KV k="Item">{HERO.itemId}</KV>
              <KV k="Order value">{fmtMoney(1284000)}</KV>
              <KV k="Type">ETO</KV>
            </>
          }
          tabs={[
            { id: "lines", label: "Lines", count: 1, content: <p className="text-sm">Line 10: 1 x {materialById(HERO.itemId)?.description}</p> },
            { id: "postings", label: "Postings", content: <PostingPreview period="2026-08" lines={[{ template: 25, amount: 948600, detail: "1 x FIN-TBD-20MVA at order cost (ETO)" }, { template: 26, amount: 18400 }, { template: 37, amount: 192600, detail: "Delivery milestone 15%" }]} /> },
          ]}
        />
      )}

      {tab === "Workbench" && (
        <WorkbenchPage<WorkCenter>
          header={{ title: "Dispatch (example)", screenId: "PP-DSP-001", description: "WorkbenchPage: KPI strip, queues, selectable table, bulk bar, side panel." }}
          kpis={[{ label: "Work centers", value: WORK_CENTERS.length }, { label: "In maintenance", value: WORK_CENTERS.filter((w) => w.status === "Maintenance").length, hint: "blocks new dispatch" }]}
          queues={[{ id: "all", label: "All", count: WORK_CENTERS.length }]}
          queue="all"
          table={{ rows: WORK_CENTERS, columns: wcCols, rowId: (w) => w.id, searchText: (w) => `${w.id} ${w.name}`, onRowClick: (w) => setPanel(w.id), activeId: panel ?? undefined }}
          bulkActions={(ids, clear) => (
            <Button size="sm" variant="outline" onClick={() => (toast(`Would act on ${ids.join(", ")}`), clear())}>
              Example bulk action
            </Button>
          )}
          panel={{ open: !!panel, onOpenChange: (o) => !o && setPanel(null), title: panel ?? "", content: <p className="text-sm">{WORK_CENTERS.find((w) => w.id === panel)?.function}</p> }}
        />
      )}

      {tab === "Wizard" && (
        <WizardPage
          header={{ title: "Settlement run (example)", screenId: "PP-SETTLE-001" }}
          steps={[
            { id: "scope", title: "Scope", content: <p className="text-sm">Choose orders to settle.</p> },
            { id: "review", title: "Review variances", content: <PostingPreview lines={[{ template: 32, amount: 4120, detail: "WO-TBD-0301 usage variance" }]} /> },
          ]}
          finishLabel="Post settlement"
          consequence="Posts #32 for WO-TBD-0301 in period 2026-10 and sets it to Closed (TECO)."
          onFinish={() => (toast("Example only"), null)}
        />
      )}

      {tab === "Dashboard" && (
        <DashboardPage header={{ title: "Quality dashboard (example)", screenId: "QM-DASH-001" }} tiles={[{ label: "Open recalls", value: 1, to: "/quality/recalls", tone: "attention" }, { label: "Open CAPA", value: 1 }, { label: "Instruments due", value: 0 }, { label: "SCARs overdue", value: 3 }]}>
          <DashboardCard title="Worklist">
            <p className="text-sm">RCL-2026-001 at Contain</p>
          </DashboardCard>
          <DashboardCard title="Status families">
            <FamilyLegend />
          </DashboardCard>
        </DashboardPage>
      )}

      {tab === "Config" && (
        <ConfigPage header={{ title: "Work center rates (example)", screenId: "CST-RATE-001" }} sections={[{ id: "rates", label: "Rates" }]} section="rates" effectiveDated>
          <DataTable<WorkCenter> rows={WORK_CENTERS} columns={wcCols} rowId={(w) => w.id} densityKey="CST-RATE-001" />
        </ConfigPage>
      )}

      {tab === "Dialog" && (
        <div className="flex flex-col gap-4">
          <Button className="self-start" onClick={() => setDialog(true)}>
            Open DialogShell
          </Button>
          <DialogShell
            open={dialog}
            onOpenChange={setDialog}
            title="Reverse PGI on DLV-TBD-0031"
            consequence="Posts the mirror of #25 and #26, sets the delivery to Packed and withdraws IR-TBD-0031."
            requireReason
            destructive
            confirmLabel="Reverse PGI"
            onConfirm={(reason) => (toast(`Example only: ${reason}`), null)}
          />
        </div>
      )}

      {tab === "Patterns" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <DocumentFlowPanel doc={{ type: "recall", id: HERO.recall }} />
          <div className="flex flex-col gap-4">
            <FamilyLegend />
            <div className="flex flex-wrap gap-2">
              <Chip kind="oq" id="OQ-21" />
              <Chip kind="k" id="K-13" />
              <Chip kind="hold" />
              <Chip kind="change" />
              <Chip kind="block">Purchasing Block</Chip>
              <Chip kind="design" />
            </div>
            <ApprovalButton kind="PO approval" subject={{ type: "purchaseOrder", id: "PO-TBD-0377" }} title="PO-TBD-0377 CRGO steel" amount={207900} />
          </div>
        </div>
      )}
    </div>
  )
}

export function KioskExample() {
  const [weight, setWeight] = useState("")
  return (
    <KioskPage title="Pack station (example)" screenId="OM-PACK-*" operator="Luis Ortega" station="WC-700 Packing" exitTo="/dev/templates"
      scan={
        <ScanField
          scanPoint="SP-16"
          expected="scan the transformer serial for HU-TBD-0203"
          onScan={(code) => (code.startsWith("SN-") || code.startsWith("PE-") ? { ok: true, message: "added to HU-TBD-0203" } : { ok: false, errorCode: "SP-16", expected: "a serial reserved for this pack order", next: "scan a serial listed below", message: "not a reserved serial" })}
        />
      }
      actions={[{ label: "Take scale reading", onClick: () => setWeight("4,312 kg") }, { label: "Close HU", onClick: () => toast("Example only"), primary: true }]}
    >
      <div className="grid grid-cols-3 gap-8">
        <KioskFact label="HU">HU-TBD-0203</KioskFact>
        <KioskFact label="Expected weight">4,310 kg ±2%</KioskFact>
        <KioskFact label="Scale reading">{weight || "Not taken"}</KioskFact>
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="kiosk-note">Note (Tab here and back: the scan field never steals focus)</Label>
        <Input id="kiosk-note" className="h-12 text-base" />
      </div>
    </KioskPage>
  )
}
