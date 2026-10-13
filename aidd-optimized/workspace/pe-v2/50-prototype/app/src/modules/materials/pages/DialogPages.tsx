// FX-MM-DIALOGS (/inventory/dialogs/material) and FX-MM-LIFECYCLE (/inventory/dialogs/lifecycle):
// the dialog archetype shown as a page. Each dialog is the same component Material Detail opens;
// here a material picker and the state selector let every dialog be opened in every state.

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/templates"
import { Chip, EmptyState, RulesPanel } from "@/components/patterns"
import { useSlice } from "@/store"
import { allMaterials, getMaterial } from "../data/state"
import { MaterialStatus, Reading, Section, TypeBadge } from "../components/common"
import { CompareTable, CopyFromDialog, DuplicateCompareDialog, ExtendToPlantDialog, FunctionBlockDialog, ImpactPanel, LIFECYCLE_DIALOGS, LifecycleDialog, lifecycleBlocker, type DialogSim, type LifecycleKind } from "../components/dialogs"
import { useViewState, type ViewStateApi } from "../components/states"
import { decideNotDuplicate } from "../data/ext-actions"
import { run } from "../components/run"

const simOf = (st: ViewStateApi): DialogSim => ({ offline: st.state === "offline", degraded: st.state === "degraded", conflict: st.state === "conflict" && !st.canWrite, readOnly: st.state === "read-only", unauthorized: st.state === "authorization" })

function MaterialPicker({ id, onChange, filter }: { id: string; onChange: (id: string) => void; filter?: (status: string) => boolean }) {
  const s = useSlice("materials")
  const all = useMemo(() => allMaterials(s).filter((m) => !filter || filter(m.status)), [s, filter])
  return (
    <div className="flex max-w-xl flex-col gap-1">
      <Label htmlFor="dlg-material">Material to open the dialog on</Label>
      <Select value={id} onValueChange={onChange}>
        <SelectTrigger id="dlg-material">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {all.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.id} · {m.status} · {m.description.slice(0, 50)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const STATE_NOTES: [string, string][] = [
  ["Normal", "The dialog names the object and the consequence, asks for the reason, and confirms."],
  ["Empty", "No reference found: the impact panel says so, and Obsolete or Delete may proceed."],
  ["Loading", "The where-used sweep runs first; the confirm stays disabled until it returns."],
  ["Validation", "Confirm with no reason: 'Enter a reason to continue.' The rule's own message appears under the field (for example V-MM-20)."],
  ["Authorization", "The role that presses the action is named; any other role sees the gate message and a disabled confirm."],
  ["Conflict", "Another user changed the record: the confirm is held until the change is reloaded."],
  ["Offline", "Master-data changes are not queued: confirm is disabled with the reason."],
  ["Degraded", "The where-used sweep is incomplete: the dialog says so and holds Obsolete and Delete."],
  ["Read-only", "A terminal record offers no lifecycle action."],
]

export function MaterialDialogsPage() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-DIALOGS", { degradedWhat: "Open purchase orders cannot be read" })
  const [id, setId] = useState("RAW-TBD-RAD")
  const [open, setOpen] = useState<null | "block" | "extend" | "copy" | "compare">(null)
  const [pair, setPair] = useState("DUP-0001")
  const dup = s.x.dupes.find((d) => d.id === pair) ?? s.x.dupes[0]
  const m = getMaterial(s, id)
  const sim = simOf(st)
  const body = (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Function-specific block (§4.5)" action={<Chip kind="oq" id="S-43" />}>
        <p className="text-sm">Purchasing, Sales, Production, Shipping or Posting Block as an additive chip with a reason code; each is set by its named role. The impact panel lists the documents it affects.</p>
        <Button onClick={() => setOpen("block")}>
          Set block…
        </Button>
      </Section>
      <Section title="Extend to Plant (§3.14)" action={<Chip kind="design" note="Dormant until DEC-07">Dormant until DEC-07</Chip>}>
        <p className="text-sm">Copies plant defaults and starts plant-level data completion. Enabled only when multi-plant is on: {s.x.plantSrc.dec07 ? "on now" : "off now (one plant at go-live)"}.</p>
        <Button variant="outline" onClick={() => setOpen("extend")}>
          Extend to plant…
        </Button>
      </Section>
      <Section title="Copy From checklist (§3.14)">
        <p className="text-sm">Deep copy of a template or similar material minus stock and history; only the checked field groups are copied. A near-identical description asks for the duplicate note.</p>
        <Button variant="outline" onClick={() => setOpen("copy")}>
          Copy from…
        </Button>
      </Section>
      <Section title="Duplicate side-by-side compare (§4.4)">
        <p className="text-sm">Trigram similarity at or above 0.9 within group L1. Creating anyway needs a "not a duplicate because…" note; identical manufacturer and part number is a hard block (E-MM-02).</p>
        <div className="flex items-center gap-2">
          <Select value={pair} onValueChange={setPair}>
            <SelectTrigger className="w-72" aria-label="Candidate pair">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {s.x.dupes.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.aId} / {d.bId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setOpen("compare")}>
            Compare…
          </Button>
        </div>
      </Section>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="FX-MM-DIALOGS"
        title="Material dialogs"
        description="The dialogs Material Detail and the creation request open: function-specific block, Extend to Plant, Copy From checklist and the duplicate side-by-side compare. Pick a material and a state to see each."
        actions={st.toolbar}
      />
      {st.banners}
      <MaterialPicker id={id} onChange={setId} />
      {m && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono">{m.id}</span> <TypeBadge type={m.type} /> <MaterialStatus m={m} /> {m.description}
        </p>
      )}
      {st.loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : st.empty ? (
        <EmptyState title="No material selected">Choose a material above to open a dialog on it.</EmptyState>
      ) : st.error ? (
        <EmptyState title="The materials did not load">{st.error}</EmptyState>
      ) : (
        body
      )}
      <Section title="Impact of the chosen material">
        <ImpactPanel id={id} degraded={st.degraded} />
      </Section>
      <Section title="Compare preview">
        <CompareTable aId={dup.aId} bId={dup.bId} />
      </Section>
      <Section title="How each state shows in these dialogs">
        <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
          {STATE_NOTES.map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold">{k}: </dt>
              <dd className="inline">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <FunctionBlockDialog materialId={id} open={open === "block"} onOpenChange={(o) => !o && setOpen(null)} sim={sim} />
      <ExtendToPlantDialog materialId={id} open={open === "extend"} onOpenChange={(o) => !o && setOpen(null)} sim={sim} />
      <CopyFromDialog materialId={id} open={open === "copy"} onOpenChange={(o) => !o && setOpen(null)} sim={sim} />
      <DuplicateCompareDialog
        aId={dup.aId}
        bId={dup.bId}
        open={open === "compare"}
        onOpenChange={(o) => !o && setOpen(null)}
        sim={sim}
        onNotDuplicate={(note) => {
          const r = decideNotDuplicate(dup.id, note)
          run(r, `${dup.id} recorded as not a duplicate`)
          return r.ok ? null : r.error
        }}
      />
      <RulesPanel
        rules={[
          ["§4.5", "Blocks are additive chips on an Active or Restricted material, each with reason code, set-by and date; each blocks one document family.", "[Book II §4.5]"],
          ["§3.14", "Extend to Plant needs an Active material and multi-plant enabled; Copy From copies flagged field groups only.", "[Book II §3.14]"],
          ["§4.4", "Duplicate check at 0.9 trigram similarity; creating anyway needs the note; identical MPN and manufacturer is a hard block (E-MM-02).", "[Book II §4.4]"],
        ]}
      />
      <Reading id="RD-MM-35" /> <Reading id="RD-MM-37" />
    </div>
  )
}

const CASES: Record<LifecycleKind, { text: string; pick: string }> = {
  restrict: { text: "Existing stock stays consumable and open documents finish; new demand is blocked.", pick: "RAW-TBD-RAD" },
  reinstate: { text: "Back to Active by the Materials Manager (p.149).", pick: "RAW-TBD-BSH015" },
  obsolete: { text: "V-MM-20: stock zero and an empty where-used sweep. The open references are listed and block the action.", pick: "FIN-TBD-0167PL" },
  delete: { text: "The only status where a physical delete is allowed, and only with zero references.", pick: "TRADE-TBD-ELB2" },
  recall: { text: "From Data Completion back to Draft; the creation request returns to Draft and the tasks reset.", pick: "RAW-TBD-RELAY" },
}

export function LifecycleDialogsPage() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-LIFECYCLE", { degradedWhat: "The purchasing service did not answer the open-PO check" })
  const [id, setId] = useState("RAW-TBD-RAD")
  const [kind, setKind] = useState<LifecycleKind | null>(null)
  const m = getMaterial(s, id)
  const sim = simOf(st)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="FX-MM-LIFECYCLE"
        title="Lifecycle transition and impact-sweep dialogs"
        description="Restrict, Reinstate, Mark Obsolete, Delete Draft and Recall to Draft. Each shows the where-used impact before it confirms (Book II §4.1, §4.4)."
        actions={st.toolbar}
      />
      {st.banners}
      <MaterialPicker id={id} onChange={setId} />
      {m && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono">{m.id}</span> <TypeBadge type={m.type} /> <MaterialStatus m={m} /> {m.description}
        </p>
      )}
      {st.loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : st.empty || st.error ? (
        <EmptyState title="Nothing to show">{st.error ?? "No material is selected."}</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(LIFECYCLE_DIALOGS) as LifecycleKind[]).map((k) => {
            const why = m ? lifecycleBlocker(k, m.status) : "Choose a material"
            return (
              <Section key={k} title={LIFECYCLE_DIALOGS[k].label}>
                <p className="text-sm">{CASES[k].text}</p>
                <p className="text-xs text-muted-foreground">Pressed by the {LIFECYCLE_DIALOGS[k].role}.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" disabled={!!why} title={why} onClick={() => setKind(k)}>
                    {LIFECYCLE_DIALOGS[k].label}…
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setId(CASES[k].pick)}>
                    Pick an example ({CASES[k].pick})
                  </Button>
                </div>
                {why && <p className="text-xs text-muted-foreground">{why}</p>}
              </Section>
            )
          })}
        </div>
      )}
      <Section title="Impact sweep of the chosen material">
        <ImpactPanel id={id} forObsolete degraded={st.degraded} />
      </Section>
      {kind && <LifecycleDialog kind={kind} materialId={id} open onOpenChange={(o) => !o && setKind(null)} sim={sim} />}
      <RulesPanel
        rules={[
          ["§4.1", "Draft may be deleted only with zero references; Data Completion may be recalled to Draft or rejected; Active may become Restricted, Blocked or Obsolete; Restricted may be reinstated by the Materials Manager.", "[Book II §4.1]"],
          ["V-MM-20", "Obsolete needs zero stock and every document closed; the where-used sweep must be empty.", "[Book II §4.1, §4.4]"],
          ["§4.4", "Deactivation and blocks run a where-used sweep and show the impact list before confirmation.", "[Book II §4.4]"],
          ["RD-MM-08", "Lifecycle changes are pressed by the Materials Manager (reading).", "README Readings"],
        ]}
      />
    </div>
  )
}
