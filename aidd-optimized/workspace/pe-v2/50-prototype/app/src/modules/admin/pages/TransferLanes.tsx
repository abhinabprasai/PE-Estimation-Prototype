// MP-LANE-001 Transfer Lanes [DOC:pp.282-283 Book VII §4]: "/configuration/transfer-lanes, from-plant, to-plant, transit time,
// transport mode, lane calendar, cost per unit weight. One row per direction; a lane stops new transfer proposals when
// deactivated, open transfers continue." Planning Manager maintains lanes (reading, AR-32). Network behaviors wait for DEC-07.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, RulesPanel } from "@/components/patterns"
import { DialogShell, ListPage } from "@/components/templates"
import { fmtDateTime } from "../lib/time"
import { useCore, useSlice } from "@/store"
import { saveLane, toggleLane, type LaneDraft } from "../data/cfg-actions"
import type { Lane } from "../data/cfg-types"
import { can } from "../lib/cfg"
import { Field, SimpleSelect, StateText, userName, act } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const MODES = ["Truck", "Rail", "Air", "Ocean"] as const
const blank = (from: string, to: string): LaneDraft => ({ fromPlant: from, toPlant: to, transitDays: 3, mode: "Truck", calendar: "Carrier calendar, Mon-Fri", costPerKg: 0.15 })

export function TransferLanes() {
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const view = useView("MP-LANE-001")
  const [edit, setEdit] = useState<Lane | "new" | null>(null)
  const [d, setD] = useState<LaneDraft | null>(null)
  const [off, setOff] = useState<Lane | null>(null)
  const plants = s.plants.map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))
  const draft = d ?? (edit && edit !== "new" ? { fromPlant: edit.fromPlant, toPlant: edit.toPlant, transitDays: edit.transitDays, mode: edit.mode, calendar: edit.calendar, costPerKg: edit.costPerKg } : blank(s.plants[0]?.id ?? "", s.plants[1]?.id ?? ""))
  const set = (p: Partial<LaneDraft>) => setD({ ...draft, ...p })
  const pname = (id: string) => s.plants.find((p) => p.id === id)?.code ?? id
  const rows = view.empty ? [] : s.lanes
  const allowed = can.lane(role) && !view.writeError()
  const close = () => { setEdit(null); setD(null) }
  return (
    <div className="flex flex-col gap-4">
      <StateFrame view={view} cols={7} emptyTitle="No transfer lanes." emptyBody="With one plant there is nothing to ship between. Add lanes once a second plant is active." degraded="Degraded: the carrier calendar service is slow. Lanes keep their stored calendar." subject="the lane table">
        <ListPage<Lane>
          header={{
            title: "Transfer lanes",
            screenId: "MP-LANE-001",
            description: "One row per direction between two plants: transit time, mode, calendar and cost per kilogram. Deactivating a lane stops new transfer proposals; open transfers continue.",
            chips: <Chip kind="design" note="Route /configuration/transfer-lanes is a design value; the screen is Book VII §4">Design route</Chip>,
            actions: <StatePicker view={view} />,
            primary: <Button onClick={() => setEdit("new")} disabled={!allowed} title={can.lane(role) ? undefined : "The Planning Manager maintains lanes"}>New lane</Button>,
          }}
          above={<p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Multi-plant activates on <Chip kind="oq" id="DEC-07" note="Until DEC-07 fires there is one plant and one implicit lane; these rows are ready for it">DEC-07</Chip>. A lane in one direction does not give the reverse: define both.</p>}
          table={{
            rows,
            rowId: (l) => l.id,
            loading: view.loading,
            caption: "Transfer lanes",
            densityKey: "MP-LANE-001",
            searchText: (l) => `${l.id} ${pname(l.fromPlant)} ${pname(l.toPlant)} ${l.mode}`,
            searchPlaceholder: "Search lanes",
            columns: [
              { id: "id", header: "Lane", value: (l) => l.id, mono: true, sortable: true },
              { id: "from", header: "From plant", value: (l) => pname(l.fromPlant), filterable: true },
              { id: "to", header: "To plant", value: (l) => pname(l.toPlant), filterable: true },
              { id: "d", header: "Transit (days)", value: (l) => l.transitDays, align: "right", mono: true, sortable: true },
              { id: "m", header: "Mode", value: (l) => l.mode, filterable: true },
              { id: "c", header: "Calendar", value: (l) => l.calendar },
              { id: "k", header: "Cost per kg", value: (l) => l.costPerKg, align: "right", mono: true, cell: (l) => `$${l.costPerKg.toFixed(2)}` },
              { id: "st", header: "State", value: (l) => (l.active ? "Active" : "Inactive"), filterable: true, cell: (l) => <StateText tone={l.active ? "default" : "muted"}>{l.active ? "Active" : "Inactive"}</StateText> },
              { id: "a", header: "", cell: (l) => (
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setEdit(l)}>Edit</Button>
                  {l.active ? <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setOff(l)}>Deactivate</Button> : <Button size="sm" variant="outline" disabled={!allowed} onClick={() => view.run(() => toggleLane(l.id, true))}>Activate</Button>}
                </span>
              ) },
            ],
          }}
          below={
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Lane history</summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {s.lanes.flatMap((l) => l.history.map((h) => ({ l, h }))).sort((a, b) => b.h.at.localeCompare(a.h.at)).map(({ l, h }, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDateTime(h.at)}</span> <span className="font-mono">{l.id}</span> {h.what} · {h.by === "PRD seed" || h.by === "Scheduler" ? h.by : userName(h.by)}</li>)}
              </ul>
            </details>
          }
        />
      </StateFrame>
      <RulesPanel rules={[["§4-a", "Lane: from-plant, to-plant, transit time, transport mode, lane calendar, cost per unit weight; one row per direction", "DOC:pp.282-283 §4 MP-LANE-001"], ["§4-b", "Deactivating a lane stops new transfer proposals only; open transfers continue", "DOC:pp.282-283 §4 MP-LANE-001"], ["F§2", "No table added from this point may assume a single plant", "DOC: Book III F §2"]]} />
      <DialogShell
        open={!!edit}
        onOpenChange={(o) => !o && close()}
        title={edit === "new" ? "New lane" : `Edit lane ${edit ? edit.id : ""}`}
        consequence="Saves the lane at once; it takes effect for the next transfer proposal. Open transfers keep their transit time."
        confirmLabel="Save lane"
        onConfirm={() => { const e = view.run(() => saveLane(draft, edit && edit !== "new" ? edit.id : undefined)); if (!e) close(); return e }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ln-from" label="From plant"><SimpleSelect id="ln-from" value={draft.fromPlant} onChange={(v) => set({ fromPlant: v })} options={plants} /></Field>
          <Field id="ln-to" label="To plant"><SimpleSelect id="ln-to" value={draft.toPlant} onChange={(v) => set({ toPlant: v })} options={plants} /></Field>
          <Field id="ln-days" label="Transit time (days)"><Input id="ln-days" type="number" min={1} value={draft.transitDays} onChange={(e) => set({ transitDays: Number(e.target.value) })} /></Field>
          <Field id="ln-mode" label="Transport mode"><SimpleSelect id="ln-mode" value={draft.mode} onChange={(v) => set({ mode: v as LaneDraft["mode"] })} options={MODES.map((m) => ({ value: m, label: m }))} /></Field>
          <Field id="ln-cal" label="Lane calendar"><Input id="ln-cal" value={draft.calendar} onChange={(e) => set({ calendar: e.target.value })} /></Field>
          <Field id="ln-cost" label="Cost per kg ($)" hint="Cost per unit weight; the unit is a reading (kg)"><Input id="ln-cost" type="number" min={0} step="0.01" value={draft.costPerKg} onChange={(e) => set({ costPerKg: Number(e.target.value) })} /></Field>
        </div>
      </DialogShell>
      <DialogShell open={!!off} onOpenChange={(o) => !o && setOff(null)} title={`Deactivate ${off?.id ?? ""}`} consequence="New transfer proposals stop using this lane. Transfers already open continue on it." confirmLabel="Deactivate" destructive onConfirm={() => (off ? act(toggleLane(off.id, false)) : null)} />
    </div>
  )
}
void act
