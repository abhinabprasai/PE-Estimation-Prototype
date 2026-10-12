// PV-001 Production Versions (List + detail) [DOC:p.214 §6.1; p.256] (asserted). Grid per material and
// plant with MBOM revision, routing revision, lot range, validity and overlap validation. Pair and
// release (release through the shared approval engine, Engineering Manager); supersede through ECO cutover.

import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApprovalButton, Chip, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { MaterialId } from "@/data/domain"
import { PLANTS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { DetailState, NoPostings, RefLink, StatePreview, useActDialog, useScreenState } from "../components"
import { itemDesc, pvOverlaps, pvPairingProblems } from "../data/logic"
import { releasedRoutingsFor } from "../data/reference"
import * as act from "../data/actions"
import type { PvRecord } from "../data/types"

const plantName = (id: string) => PLANTS.find((p) => p.id === id)?.name ?? id
const RULES: [string, string, string][] = [
  ["V-PV-01", "Exactly one valid production version per material, plant, lot-size band and date; overlaps are refused", "DOC:p.214"],
  ["Pairing", "A production version pairs the Active MBOM revision with a Released routing revision; both must be released", "DOC:p.214"],
  ["Release", "The Engineering Manager releases, through the shared approval engine (C-1)", "DOC:p.256"],
  ["Supersede", "Versions are superseded through ECO cutover, not edited: at cutover each Released version pairing the superseded MBOM becomes Superseded/Obsolete (valid to the day before effectivity) and a new Released version pairs the new MBOM with the same routing and lot range", "DOC:p.256; S-18"],
  ["Use", "The selectable build definition every WO and MRP explosion uses", "DOC:p.257"],
]

export function PvList() {
  const s = useSlice("engineering")
  const st = useScreenState("PV-001-list")
  const nav = useNavigate()
  const runD = useActDialog()
  const [open, setOpen] = useState(false)
  const mats = [...new Set(s.mboms.filter((m) => m.status === "Active").map((m) => m.parentItemId))]
  const [f, setF] = useState<{ materialId: string; mbomId: string; rtg: string; from: string; to: string; validFrom: string; validTo: string }>({ materialId: mats[0] ?? "", mbomId: "", rtg: "", from: "1", to: "1", validFrom: "", validTo: "" })
  const mbomOpts = s.mboms.filter((m) => m.parentItemId === f.materialId && m.status === "Active")
  const rtgOpts = releasedRoutingsFor(f.materialId)
  const [rId, rRev] = f.rtg.split("|")
  const problems = f.mbomId && f.rtg ? pvPairingProblems(s, { mbomId: f.mbomId as never, routingId: rId as never, routingRev: rRev, materialId: f.materialId as MaterialId }) : []
  const rows = st.empty ? [] : s.productionVersions
  const columns: Column<PvRecord>[] = [
    { id: "mat", header: "Material", value: (p) => p.materialId, filterable: true, sortable: true, mono: true },
    { id: "plant", header: "Plant", value: (p) => plantName(p.plantId), filterable: true },
    { id: "id", header: "Version", value: (p) => p.id, mono: true, sortable: true },
    { id: "lot", header: "Lot range", value: (p) => p.lotSizeFrom, cell: (p) => `${p.lotSizeFrom} to ${p.lotSizeTo}`, align: "right" },
    { id: "from", header: "Valid from", value: (p) => p.validFrom, cell: (p) => fmtDate(p.validFrom), sortable: true },
    { id: "to", header: "Valid to", value: (p) => p.validTo ?? "", cell: (p) => (p.validTo ? fmtDate(p.validTo) : "Open") },
    { id: "mbom", header: "MBOM rev", value: (p) => `${p.mbomId} ${p.mbomRev}`, cell: (p) => <span><RefLink r={{ type: "mbom", id: p.mbomId }} /> rev {p.mbomRev}</span> },
    { id: "rtg", header: "Routing rev", value: (p) => `${p.routingId} ${p.routingRev}`, cell: (p) => <span className="font-mono">{p.routingId} rev {p.routingRev}</span> },
    { id: "ovl", header: "Overlap check", value: (p) => pvOverlaps(s, p).length, cell: (p) => { if (p.status === "Superseded/Obsolete") return ""; const o = pvOverlaps(s, p); return o.length ? <Chip kind="block" note={`Overlaps ${o.map((x) => x.id).join(", ")} (V-PV-01)`}>Overlaps {o.map((x) => x.id).join(", ")}</Chip> : "No overlap" } },
    { id: "status", header: "Status", value: (p) => p.status, filterable: true, cell: (p) => <StatusBadge kind="productionVersion" status={p.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage<PvRecord>
        header={{
          title: "Production versions",
          screenId: "PV-001",
          description: "One row per material and plant: which MBOM revision and routing revision build which lot sizes, and when. Overlaps are refused at release.",
          primary: <Button onClick={() => setOpen(true)}>Pair new version</Button>,
        }}
        table={{
          rows, columns, rowId: (p) => p.id, rowHref: (p) => `/engineering/production-versions/${p.id}`, searchText: (p) => `${p.id} ${p.materialId} ${p.mbomId} ${p.routingId}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "mat", dir: "asc" },
          empty: { title: "No production versions", body: "Pair an Active MBOM with a Released routing to create one." },
        }}
      />
      <RulesPanel rules={RULES} />
      <DialogShell open={open} onOpenChange={setOpen} title="Pair a new production version" confirmLabel="Create Draft version" wide
        consequence="Creates a Draft production version. It becomes selectable for work orders and MRP only after release in WF-INBOX."
        onConfirm={() => {
          let id = ""
          const e = runD((d, c) => void (id = act.createPv(d, c, { materialId: f.materialId as MaterialId, mbomId: f.mbomId, routingId: rId, routingRev: rRev, lotSizeFrom: Number(f.from), lotSizeTo: Number(f.to), validFrom: f.validFrom, validTo: f.validTo || undefined })), "Draft version created")
          if (!e) nav(`/engineering/production-versions/${id}`)
          return e
        }}
        confirmDisabled={!f.mbomId || !f.rtg || problems.length > 0}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1"><Label>Material</Label>
            <Select value={f.materialId} onValueChange={(v) => setF({ ...f, materialId: v, mbomId: "", rtg: "" })}><SelectTrigger aria-label="Material"><SelectValue /></SelectTrigger><SelectContent>{mats.map((m) => <SelectItem key={m} value={m}>{m} · {itemDesc(m)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1"><Label>MBOM (Active)</Label>
            <Select value={f.mbomId} onValueChange={(v) => setF({ ...f, mbomId: v })}><SelectTrigger aria-label="MBOM"><SelectValue placeholder="Pick" /></SelectTrigger><SelectContent>{mbomOpts.map((m) => <SelectItem key={m.id} value={m.id}>{m.id} rev {m.revision}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1"><Label>Routing (Released)</Label>
            <Select value={f.rtg} onValueChange={(v) => setF({ ...f, rtg: v })}><SelectTrigger aria-label="Routing"><SelectValue placeholder="Pick" /></SelectTrigger><SelectContent>{rtgOpts.map((r) => <SelectItem key={`${r.id}|${r.rev}`} value={`${r.id}|${r.rev}`}>{r.id} rev {r.rev}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1"><Label htmlFor="pv-from">Lot size from</Label><Input id="pv-from" type="number" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="pv-to">Lot size to</Label><Input id="pv-to" type="number" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="pv-vf">Valid from</Label><Input id="pv-vf" type="date" value={f.validFrom} onChange={(e) => setF({ ...f, validFrom: e.target.value })} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="pv-vt">Valid to (optional)</Label><Input id="pv-vt" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} /></div>
        </div>
        {problems.length > 0 && <ErrorAlert title="Pairing check">{problems.join(" ")}</ErrorAlert>}
      </DialogShell>
    </>
  )
}

export function PvDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("PV-001")
  const pv = s.productionVersions.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!pv} what={`Production version ${id}`} back={{ to: "/engineering/production-versions", label: "Back to production versions" }}>
      {pv && <PvBody pv={pv} />}
    </DetailState>
  )
}

function PvBody({ pv }: { pv: PvRecord }) {
  const s = useSlice("engineering")
  const [role] = useRole()
  const runD = useActDialog()
  const [dlg, setDlg] = useState(false)
  const [to, setTo] = useState(pv.validTo ?? "")
  const overlaps = pvOverlaps(s, pv)
  const problems = pv.status === "Draft" ? pvPairingProblems(s, pv) : []
  const blocked = [...problems, ...(overlaps.length ? [`Overlaps ${overlaps.map((o) => o.id).join(", ")} on material, plant, lot range and dates (V-PV-01). End-date the older version first.`] : [])]
  const siblings = s.productionVersions.filter((p) => p.materialId === pv.materialId && p.plantId === pv.plantId && p.id !== pv.id)
  const isEM = role === "Engineering Manager"
  let primary = null
  if (pv.status === "Draft")
    primary = <ApprovalButton kind="Production version release" subject={{ type: "productionVersion", id: pv.id }} title={`${pv.id}: ${pv.materialId} lots ${pv.lotSizeFrom}-${pv.lotSizeTo}`} label="Release" variant="default" disabled={blocked.length > 0} disabledReason={blocked.join(" ")} />
  else if (pv.status === "Released") primary = <Button disabled={!isEM} title={isEM ? undefined : "The Engineering Manager does this (switch Acting as)"} onClick={() => setDlg(true)}>End-date version</Button>
  return (
    <>
      <DetailPage
        header={{
          title: `${pv.id} ${pv.materialId}`,
          screenId: "PV-001",
          crumbs: [{ label: "Production versions", to: "/engineering/production-versions" }, { label: pv.id }],
          description: `${itemDesc(pv.materialId)} at ${plantName(pv.plantId)}, lots ${pv.lotSizeFrom} to ${pv.lotSizeTo}, valid ${fmtDate(pv.validFrom)} to ${pv.validTo ? fmtDate(pv.validTo) : "open"}.`,
          chips: overlaps.length > 0 && pv.status !== "Superseded/Obsolete" ? <Chip kind="block" note="V-PV-01">Overlap</Chip> : undefined,
          primary,
        }}
        status={{ kind: "productionVersion", value: pv.status }}
        doc={{ type: "productionVersion", id: pv.id }}
        summary={
          <>
            <KV k="MBOM"><RefLink r={{ type: "mbom", id: pv.mbomId }} /> rev {pv.mbomRev}</KV>
            <KV k="Routing"><span className="font-mono">{pv.routingId} rev {pv.routingRev}</span></KV>
            <KV k="Lot range">{pv.lotSizeFrom} to {pv.lotSizeTo}</KV>
            <KV k="Validity">{fmtDate(pv.validFrom)} to {pv.validTo ? fmtDate(pv.validTo) : "open"}</KV>
          </>
        }
        tabs={[
          {
            id: "check", label: "Overlap validation",
            content: (
              <div className="flex flex-col gap-3">
                {blocked.length ? <ErrorAlert title="Release blocked">{blocked.join(" ")}</ErrorAlert> : <p className="text-sm">No overlap with any Released version for this material and plant. Pairing is valid.</p>}
                <h3 className="text-sm font-semibold">Other versions of {pv.materialId} at {plantName(pv.plantId)}</h3>
                {siblings.length ? (
                  <ul className="flex flex-col gap-1 text-sm">{siblings.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2"><RefLink r={{ type: "productionVersion", id: p.id }} /> lots {p.lotSizeFrom} to {p.lotSizeTo}, {fmtDate(p.validFrom)} to {p.validTo ? fmtDate(p.validTo) : "open"} <StatusBadge kind="productionVersion" status={p.status} size="sm" /></li>)}</ul>
                ) : <p className="text-sm text-muted-foreground">None.</p>}
              </div>
            ),
          },
          { id: "activity", label: "Activity", count: pv.activity.length, content: <ul className="flex flex-col gap-1 text-sm">{[...pv.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul> },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={RULES} />
      <DialogShell open={dlg} onOpenChange={setDlg} title={`End-date ${pv.id}`} confirmLabel="Set Valid To" consequence={`${pv.id} stops being selectable for work orders and MRP after the chosen date; a newer version can then take over the band.`}
        onConfirm={() => runD((d, c) => act.endDatePv(d, c, pv.id, to), "Valid To set")}>
        <Label htmlFor="pv-end">Valid to</Label>
        <Input id="pv-end" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </DialogShell>
    </>
  )
}
