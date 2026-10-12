// BC-ADMIN Label and Scan Administration [DOC:p.274 Book VI; Book I F, pp.93-97] (asserted).
// Printer registry per station, label template versions, scan point policy toggles (SP-01..SP-21),
// reprint audit log, scan exception queue for offline conflicts. Actions: register devices, publish
// templates, resolve scan exceptions. Arrives from the Configuration area. Postings and scans: none.

import { useState } from "react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, DataTable, ErrorAlert, RulesPanel, type Column } from "@/components/patterns"
import { SCAN_POINTS, type ScanPointCode } from "@/data/domain"
import { useSlice } from "@/store"
import { bc } from "../data/actions"
import type { LabelTemplate, Printer, Reprint, ScanException } from "../data/types"
import { Pick, Section, TextField, report, useDataState, userName, SkeletonTable } from "../components/bits"

export const BC_RULES: [string, string, string][] = [
  ["BC-1", "Twenty-one scan points SP-01..SP-21, each validating a defined condition and writing its traceability event.", "DOC:pp.95-96 Part F"],
  ["BC-2", "Label templates are versioned; publishing a draft retires the previous published version. Printed labels keep the version they were printed with.", "DOC:pp.93-94 Part F"],
  ["BC-3", "Every reprint needs a reason and is audit-logged with user, printer and time.", "DOC:pp.93-97 Part F"],
  ["BC-4", "Handhelds queue scans offline for up to 4 hours; a conflict at sync lands in the scan exception queue.", "DOC:p.96 Part F"],
]

const SECTIONS = [
  { id: "printers", label: "Printers" },
  { id: "templates", label: "Label templates" },
  { id: "policies", label: "Scan point policies" },
  { id: "reprints", label: "Reprint log" },
  { id: "exceptions", label: "Scan exceptions" },
]

export function BarcodeAdmin() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("BC-ADMIN")
  const [params, setParams] = useSearchParams()
  const sec = params.get("s") ?? "printers"
  const openEx = s.scanExceptions.filter((x) => !x.resolvedOn).length
  return (
    <ConfigPage
      header={{
        title: "Label and Scan Administration",
        screenId: "BC-ADMIN",
        description: "The print and scan infrastructure: devices per station, label templates, scan point policies and the offline-conflict queue. Plant IT owns it.",
        chips: openEx ? <Chip kind="flag">{openEx} scan exceptions open</Chip> : undefined,
      }}
      sections={SECTIONS.map((x) => (x.id === "exceptions" ? { ...x, label: `Scan exceptions (${openEx})` } : x))}
      section={sec}
      onSectionChange={(v) => (params.set("s", v), setParams(params, { replace: true }))}
      effectiveDated={sec === "templates"}
    >
      {ds.error ? (
        <ErrorAlert title="Could not load the configuration" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
      ) : ds.loading ? (
        <SkeletonTable cols={5} />
      ) : (
        <div className="flex flex-col gap-4">
          {sec === "printers" && <Printers rows={ds.empty ? [] : s.printers} />}
          {sec === "templates" && <Templates rows={ds.empty ? [] : s.labelTemplates} />}
          {sec === "policies" && <Policies />}
          {sec === "reprints" && <Reprints rows={ds.empty ? [] : s.reprints} />}
          {sec === "exceptions" && <Exceptions rows={ds.empty ? [] : s.scanExceptions} />}
          <RulesPanel rules={BC_RULES} />
        </div>
      )}
    </ConfigPage>
  )
}

function Printers({ rows }: { rows: Printer[] }) {
  const [open, setOpen] = useState(false)
  const [o, setO] = useState({ station: "", model: "Zebra ZT411 203 dpi", address: "", labelTypes: "Batch label" })
  const cols: Column<Printer>[] = [
    { id: "id", header: "Device", value: (p) => p.id, mono: true, sortable: true },
    { id: "station", header: "Station", value: (p) => p.station, sortable: true },
    { id: "wc", header: "Work center", value: (p) => p.workCenterId ?? "", filterable: true },
    { id: "model", header: "Model", value: (p) => p.model, filterable: true },
    { id: "addr", header: "Address", value: (p) => p.address, mono: true },
    { id: "labels", header: "Label types", value: (p) => p.labelTypes.join(", ") },
    { id: "reg", header: "Registered", value: (p) => p.registeredOn, mono: true },
    { id: "active", header: "Active", value: (p) => (p.active ? "Active" : "Inactive"), filterable: true, cell: (p) => <Switch checked={p.active} aria-label={`${p.id} active`} onCheckedChange={() => report(bc.togglePrinter(p.id), `${p.id} ${p.active ? "deactivated" : "activated"}`)} /> },
  ]
  return (
    <>
      <DataTable rows={rows} columns={cols} rowId={(p) => p.id} densityKey="BC-PRN" searchText={(p) => `${p.id} ${p.station} ${p.address}`} toolbar={<Button size="sm" onClick={() => setOpen(true)}>Register device</Button>} empty={{ title: "No devices registered", body: "Register the first printer for a station." }} />
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title="Register device"
        consequence={`Adds the printer at ${o.station || "the station"} (${o.address || "address"}) to the registry; label jobs for its label types route to it.`}
        confirmLabel="Register"
        onConfirm={() => {
          const r = bc.registerPrinter({ ...o, labelTypes: o.labelTypes.split(",").map((x) => x.trim()).filter(Boolean) })
          return report(r, "Device registered") ? null : (r as { error: string }).error
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="pr-st" label="Station" value={o.station} onChange={(v) => setO({ ...o, station: v })} placeholder="Receiving dock 2" />
          <TextField id="pr-model" label="Model" value={o.model} onChange={(v) => setO({ ...o, model: v })} />
          <TextField id="pr-addr" label="Network address" value={o.address} onChange={(v) => setO({ ...o, address: v })} placeholder="10.20.4.40" />
          <TextField id="pr-lt" label="Label types" value={o.labelTypes} onChange={(v) => setO({ ...o, labelTypes: v })} hint="Comma separated" />
        </div>
      </DialogShell>
    </>
  )
}

function Templates({ rows }: { rows: LabelTemplate[] }) {
  const [draftFor, setDraftFor] = useState<LabelTemplate | null>(null)
  const [change, setChange] = useState("")
  return (
    <>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Template</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Symbology</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Draft</TableHead>
            <TableHead>History</TableHead>
            <TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => {
            const pub = t.versions.find((v) => v.state === "Published")
            const dr = t.versions.find((v) => v.state === "Draft")
            return (
              <TableRow key={t.id}>
                <TableCell className="tabular">{t.id}</TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.symbology}</TableCell>
                <TableCell>{pub ? `v${pub.v} · ${pub.on}` : "None"}</TableCell>
                <TableCell>{dr ? <span>v{dr.v}: {dr.change} <span className="text-xs text-muted-foreground">({userName(dr.by)})</span></span> : ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.versions.filter((v) => v.state === "Retired").map((v) => `v${v.v}`).join(", ") || "None retired"}</TableCell>
                <TableCell className="flex gap-2">
                  {dr ? (
                    <Button size="sm" onClick={() => report(bc.publish(t.id), `${t.id} v${dr.v} published`)}>Publish v{dr.v}</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setDraftFor(t)}>New version</Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <DialogShell
        open={!!draftFor}
        onOpenChange={(o) => !o && setDraftFor(null)}
        title={`New version of ${draftFor?.name}`}
        consequence="Creates a Draft version; the Published one keeps printing until you publish."
        confirmLabel="Create draft"
        onConfirm={() => {
          if (!draftFor) return null
          const r = bc.newDraft(draftFor.id, change)
          if (r.ok) setChange("")
          return report(r, "Draft created") ? null : (r as { error: string }).error
        }}
      >
        <TextField id="tpl-change" label="Change" value={change} onChange={setChange} placeholder="Add GS1 AI (10) batch to the 2D code" />
      </DialogShell>
    </>
  )
}

function Policies() {
  const s = useSlice("qualityTrace")
  return (
    <Table>
      <TableHeader className="bg-table-head">
        <TableRow>
          <TableHead>Scan point</TableHead>
          <TableHead>Step</TableHead>
          <TableHead>Validates</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Offline allowed</TableHead>
          <TableHead>Override needs reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {s.scanPolicies.map((p) => {
          const sp = SCAN_POINTS[p.sp as ScanPointCode]
          return (
            <TableRow key={p.sp}>
              <TableCell className="tabular font-medium">{p.sp}</TableCell>
              <TableCell>{sp.step}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{sp.validates}{sp.errorCode ? ` (${sp.errorCode})` : ""}</TableCell>
              <TableCell>{sp.trace ?? ""}</TableCell>
              {(["enabled", "offlineAllowed", "overrideNeedsReason"] as const).map((f) => (
                <TableCell key={f}>
                  <Switch checked={p[f]} aria-label={`${p.sp} ${f}`} onCheckedChange={() => report(bc.togglePolicy(p.sp, f), `${p.sp} updated`)} />
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function Reprints({ rows }: { rows: Reprint[] }) {
  const s = useSlice("qualityTrace")
  const [o, setO] = useState({ label: "", template: s.labelTemplates[0]?.name ?? "", printer: s.printers.find((p) => p.active)?.id ?? "", reason: "" })
  const cols: Column<Reprint>[] = [
    { id: "id", header: "Reprint", value: (r) => r.id, mono: true, sortable: true },
    { id: "label", header: "Label", value: (r) => r.labelId, mono: true },
    { id: "tpl", header: "Template", value: (r) => r.template, filterable: true },
    { id: "prn", header: "Printer", value: (r) => r.printerId, filterable: true },
    { id: "by", header: "By", value: (r) => userName(r.by) },
    { id: "on", header: "On", value: (r) => r.on, sortable: true, mono: true },
    { id: "reason", header: "Reason", value: (r) => r.reason },
  ]
  return (
    <>
      <Section title="Reprint a label">
        <div>
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField id="rp-label" label="Label ID" value={o.label} onChange={(v) => setO({ ...o, label: v })} />
            <Pick id="rp-tpl" label="Template" value={o.template} onChange={(v) => setO({ ...o, template: v })} options={s.labelTemplates.map((t) => t.name)} />
            <Pick id="rp-prn" label="Printer" value={o.printer} onChange={(v) => setO({ ...o, printer: v })} options={s.printers.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.id} · ${p.station}` }))} />
            <TextField id="rp-reason" label="Reason (required)" value={o.reason} onChange={(v) => setO({ ...o, reason: v })} />
          </div>
        </div>
        <div>
          <Button onClick={() => report(bc.reprint(o.label, o.template, o.printer, o.reason), "Reprint sent and logged") && setO({ ...o, label: "", reason: "" })}>Reprint</Button>
        </div>
      </Section>
      <DataTable rows={rows} columns={cols} rowId={(r) => r.id} densityKey="BC-RPR" searchText={(r) => `${r.labelId} ${r.reason}`} initialSort={{ id: "on", dir: "desc" }} empty={{ title: "No reprints logged" }} />
    </>
  )
}

function Exceptions({ rows }: { rows: ScanException[] }) {
  const [res, setRes] = useState<ScanException | null>(null)
  const [choice, setChoice] = useState("Accept the offline scan; replay it in capture order")
  const cols: Column<ScanException>[] = [
    { id: "id", header: "Exception", value: (x) => x.id, mono: true, sortable: true },
    { id: "sp", header: "Scan point", value: (x) => x.sp, filterable: true, cell: (x) => `${x.sp} · ${SCAN_POINTS[x.sp].step}` },
    { id: "dev", header: "Device", value: (x) => x.device, filterable: true },
    { id: "cap", header: "Captured", value: (x) => x.capturedAt, mono: true, sortable: true },
    { id: "sync", header: "Synced", value: (x) => x.syncedAt, mono: true },
    { id: "code", header: "Scanned", value: (x) => x.code, mono: true },
    { id: "conf", header: "Conflict", value: (x) => x.conflict },
    { id: "state", header: "State", value: (x) => (x.resolvedOn ? "Resolved" : "Open"), filterable: true, cell: (x) => (x.resolvedOn ? <span className="text-muted-foreground">Resolved {x.resolvedOn}: {x.resolution}</span> : <Button size="sm" variant="outline" onClick={() => setRes(x)}>Resolve</Button>) },
  ]
  return (
    <>
      <DataTable rows={rows} columns={cols} rowId={(x) => x.id} densityKey="BC-SCX" searchText={(x) => `${x.code} ${x.device} ${x.conflict}`} empty={{ title: "No scan exceptions", body: "Offline conflicts at sync appear here." }} />
      <DialogShell
        open={!!res}
        onOpenChange={(o) => !o && setRes(null)}
        title={`Resolve ${res?.id}`}
        consequence={`Closes the exception for ${res?.code} on ${res?.device}. Any genealogy fix goes through a correction pair in the Trace Explorer.`}
        confirmLabel="Resolve"
        onConfirm={() => {
          if (!res) return null
          const r = bc.resolveScan(res.id, choice)
          return report(r, "Scan exception resolved") ? null : (r as { error: string }).error
        }}
      >
        <Pick id="scx-res" label="Resolution" value={choice} onChange={setChoice} options={["Accept the offline scan; replay it in capture order", "Discard as duplicate; keep the original", "Reject the scan; operator to rescan", "Escalate to Quality IT for a correction pair"]} />
      </DialogShell>
    </>
  )
}
