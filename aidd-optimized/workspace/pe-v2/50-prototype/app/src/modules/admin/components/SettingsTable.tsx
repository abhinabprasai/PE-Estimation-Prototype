// A table of CFG-CORE settings with the propose-change dialog, shared by the RMA policy and the four settings pages.
// Each change is a new effective-dated version approved by the setting's owner (AR-15, C-50); the setting rows and
// their PRD values live in the admin slice (data/seed.ts) and are the same rows CFG-CORE shows.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { TODAY } from "@/data/shared"
import { addDays } from "@/lib/format"
import { useSlice } from "@/store"
import { proposeSetting } from "../data/actions"
import type { Setting } from "../data/types"
import { Field, SimpleSelect, StateText, userName } from "./common"
import type { View } from "./states"

export const inForce = (x: Setting) => x.versions.filter((v) => (v.state === "Active" || v.state === "Scheduled") && v.effectiveFrom <= TODAY).at(-1)
export const nextVersion = (x: Setting) => x.versions.find((v) => (v.state === "Pending approval" || v.state === "Scheduled") && v.effectiveFrom > TODAY)
const OPTIONS: Record<string, string[]> = { "SET-SD-PACK": ["Per picklist", "Per shipment"] }

export function SettingsTable({ section, ids, view, caption, densityKey }: { section?: string; ids?: string[]; view: View; caption: string; densityKey: string }) {
  const s = useSlice("admin")
  const [editing, setEditing] = useState<Setting | null>(null)
  const rows = view.empty ? [] : s.settings.filter((x) => (section ? x.section === section : true) && (ids ? ids.includes(x.id) : true))
  return (
    <>
      <DataTable<Setting>
        rows={rows}
        rowId={(x) => x.id}
        loading={view.loading}
        densityKey={densityKey}
        caption={caption}
        empty={{ title: "No settings here." }}
        columns={[
          { id: "label", header: "Setting", value: (x) => x.label, sortable: true, className: "max-w-[320px]" },
          { id: "value", header: "In force", value: (x) => inForce(x)?.value ?? "", cell: (x) => <span className="font-medium">{inForce(x)?.value}</span>, className: "max-w-[300px]" },
          { id: "next", header: "Next version", value: (x) => nextVersion(x)?.value ?? "", cell: (x) => { const n = nextVersion(x); return n ? <span className="text-xs">{n.value} from {n.effectiveFrom} · <StateText tone={n.state === "Pending approval" ? "attention" : "muted"}>{n.state}</StateText>{n.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${n.requestId}`}>{n.requestId}</Link></>}</span> : "" } },
          { id: "owner", header: "Owner", value: (x) => x.owner, filterable: true },
          { id: "src", header: "Source", value: (x) => x.source, cell: (x) => <span className="text-xs">[{x.source.includes("§") && !x.source.startsWith("p") ? x.source : `DOC:${x.source}`}]</span> },
          { id: "hist", header: "Versions", value: (x) => x.versions.length, align: "right", mono: true },
          { id: "act", header: "", cell: (x) => <Button size="sm" variant="outline" disabled={x.versions.some((v) => v.state === "Pending approval")} title={x.versions.some((v) => v.state === "Pending approval") ? "A change is already waiting for approval" : undefined} onClick={() => setEditing(x)}>Propose change</Button> },
        ]}
      />
      <ChangeDialog setting={editing} onClose={() => setEditing(null)} view={view} />
    </>
  )
}

function ChangeDialog({ setting, onClose, view }: { setting: Setting | null; onClose: () => void; view: View }) {
  const [value, setValue] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const steps = setting ? (setting.gatesPosting && setting.owner !== "Controller" ? `${setting.owner}, then the Controller` : setting.owner) : ""
  const opts = setting ? OPTIONS[setting.id] : undefined
  return (
    <DialogShell
      open={!!setting}
      onOpenChange={(o) => { if (!o) { setValue(""); onClose() } }}
      title={`Propose change: ${setting?.label ?? ""}`}
      consequence={setting ? `Creates a new version (${value || "new value"} from ${from}) and sends it to the ${steps} in WF-INBOX. The value in force (${inForce(setting)?.value}) stays until then.` : undefined}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => view.run(() => proposeSetting(setting!.id, value, from, note))}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field id="chg-val" label="New value">{opts ? <SimpleSelect id="chg-val" value={value} onChange={setValue} options={opts.map((o) => ({ value: o, label: o }))} placeholder={inForce(setting!)?.value} /> : <Input id="chg-val" value={value} onChange={(e) => setValue(e.target.value)} placeholder={setting ? inForce(setting)?.value : ""} />}</Field>
        <Field id="chg-from" label="Effective from"><Input id="chg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      {setting && <ol className="text-xs text-muted-foreground">{setting.versions.map((v) => <li key={v.changeId}>{v.value} · from {v.effectiveFrom} · {v.state} · {v.by === "PRD seed" ? "PRD seed" : userName(v.by)} · {v.note}</li>)}</ol>}
    </DialogShell>
  )
}
