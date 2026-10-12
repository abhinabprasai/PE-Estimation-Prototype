// ENG-BOM-001 EBOM register (the list behind ENG-BOM-002) [DOC:p.60 §3] (asserted).
// Copy From a released EBOM, and Mass Update which always ends in an ECO (C-15).

import { useState } from "react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chip, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DialogShell, ListPage } from "@/components/templates"
import type { MaterialId } from "@/data/domain"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { StatePreview, useActDialog, useScreenState } from "../components"
import { itemDesc, pickableMaterials } from "../data/logic"
import * as act from "../data/actions"
import type { EbomRecord } from "../data/types"

export function EbomList() {
  const s = useSlice("engineering")
  const st = useScreenState("ENG-BOM-001")
  const nav = useNavigate()
  const runD = useActDialog()
  const [dlg, setDlg] = useState<null | "copy" | "mass">(null)
  const released = s.eboms.filter((e) => e.status === "Released")
  const [src, setSrc] = useState<string>(released[0]?.id ?? "")
  const [er, setEr] = useState<string>("__none")
  const [from, setFrom] = useState<MaterialId>("RAW-TBD-BSH015")
  const [to, setTo] = useState<MaterialId>("SPARE-TBD-BSH145")
  const [sel, setSel] = useState<string[]>([])
  const usingFrom = released.filter((e) => e.lines.some((l) => l.componentId === from))
  const rows = st.empty ? [] : s.eboms
  const columns: Column<EbomRecord>[] = [
    { id: "id", header: "EBOM", value: (e) => e.id, sortable: true, mono: true },
    { id: "item", header: "Parent item", value: (e) => e.parentItemId, filterable: true, cell: (e) => <span className="font-mono">{e.parentItemId}</span> },
    { id: "rev", header: "Rev", value: (e) => e.rev, mono: true },
    { id: "title", header: "Title", value: (e) => e.title, cell: (e) => <span className="inline-flex flex-wrap items-center gap-1">{e.title}{e.cadAhead && <Chip kind="flag" note={e.cadAhead}>CAD ahead</Chip>}</span> },
    { id: "usage", header: "Usage", value: (e) => e.usage },
    { id: "er", header: "Engineering request", value: (e) => e.engineeringRequestId ?? "", mono: true },
    { id: "lines", header: "Lines", value: (e) => e.lines.length, align: "right", mono: true },
    { id: "rel", header: "Released", value: (e) => e.releasedOn ?? "", cell: (e) => (e.releasedOn ? fmtDate(e.releasedOn) : ""), sortable: true },
    { id: "status", header: "Status", value: (e) => e.status, filterable: true, sortable: true, cell: (e) => <StatusBadge kind="ebom" status={e.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage<EbomRecord>
        header={{
          title: "EBOMs",
          screenId: "ENG-BOM-002",
          crumbs: [{ label: "EBOM register" }],
          description: "Engineering bills of material, one record per design with its revision history. Open one to edit (Draft), review (In Review) or raise a change (Released).",
          primary: <Button onClick={() => setDlg("copy")}>Copy From released EBOM</Button>,
          actions: <Button variant="outline" onClick={() => setDlg("mass")}>Mass update (creates ECO)</Button>,
        }}
        table={{
          rows, columns, rowId: (e) => e.id, rowHref: (e) => `/engineering/boms/${e.id}`, searchText: (e) => `${e.id} ${e.parentItemId} ${e.title}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "id", dir: "desc" },
          empty: { title: "No EBOMs yet", body: "Create one with Copy From, or from an engineering request's checklist." },
        }}
      />
      <RulesPanel rules={[["C-15", "EBOM mass replace always creates an ECO; it is never a silent save", "DOC:p.61 §3.3"], ["Copy From", "Copy an entire released EBOM of a similar design, then edit deltas; provenance stored as Base Design", "DOC:p.61 §3.3"], ["C-16", "Obsolete EBOMs cannot be used in new MBOMs or orders", "DOC:p.61 §3.4"]]} />

      <DialogShell open={dlg === "copy"} onOpenChange={(o) => !o && setDlg(null)} title="Copy From a released EBOM" confirmLabel="Create Draft copy"
        consequence="Creates a new Draft EBOM, rev A, with every line of the source; the source stays unchanged."
        onConfirm={() => {
          let newId = ""
          const e = runD((d, c) => void (newId = act.copyEbom(d, c, src, er === "__none" ? undefined : er)), "Draft copy created")
          if (!e) nav(`/engineering/boms/${newId}`)
          return e
        }}>
        <Label>Source (Released only; Obsolete excluded, C-16)</Label>
        <Select value={src} onValueChange={setSrc}>
          <SelectTrigger aria-label="Source EBOM"><SelectValue /></SelectTrigger>
          <SelectContent>{released.map((e) => <SelectItem key={e.id} value={e.id}>{e.id} rev {e.rev} · {e.parentItemId}</SelectItem>)}</SelectContent>
        </Select>
        <Label>For engineering request (optional)</Label>
        <Select value={er} onValueChange={setEr}>
          <SelectTrigger aria-label="Engineering request"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None</SelectItem>
            {s.requests.filter((r) => r.status !== "Closed").map((r) => <SelectItem key={r.id} value={r.id}>{r.id} · {r.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </DialogShell>

      <DialogShell open={dlg === "mass"} onOpenChange={(o) => !o && setDlg(null)} title="Mass update: replace a component" confirmLabel="Create ECO" wide
        consequence="Creates an ECO with the replacement on every selected EBOM; nothing changes until that ECO is released (C-15)."
        onConfirm={() => {
          let ecoId = ""
          const e = runD((d, c) => void (ecoId = act.massReplace(d, c, sel, from, to)), "ECO created from mass update")
          if (!e) nav(`/engineering/change-orders/${ecoId}`)
          return e
        }}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Replace component</Label>
            <Select value={from} onValueChange={(v) => (setFrom(v as MaterialId), setSel([]))}>
              <SelectTrigger aria-label="Component to replace"><SelectValue /></SelectTrigger>
              <SelectContent>{pickableMaterials().map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{itemDesc(from)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Label>With</Label>
            <Select value={to} onValueChange={(v) => setTo(v as MaterialId)}>
              <SelectTrigger aria-label="Replacement component"><SelectValue /></SelectTrigger>
              <SelectContent>{pickableMaterials().map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{itemDesc(to)}</span>
          </div>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Released EBOMs using {from} ({usingFrom.length})</legend>
          {usingFrom.length === 0 && <p className="text-sm text-muted-foreground">No released EBOM uses this component.</p>}
          {usingFrom.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={sel.includes(e.id)} onCheckedChange={(v) => setSel((p) => (v ? [...p, e.id] : p.filter((x) => x !== e.id)))} />
              <span className="font-mono">{e.id}</span> rev {e.rev} · {e.title}
            </label>
          ))}
        </fieldset>
      </DialogShell>
    </>
  )
}
