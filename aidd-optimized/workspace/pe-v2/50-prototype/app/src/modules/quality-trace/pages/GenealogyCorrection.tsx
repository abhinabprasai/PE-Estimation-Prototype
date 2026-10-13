// FX-TRC-CORRECTION Genealogy correction pair flow [DOC:p.211 Book IV §4.2-4.3; C-53] (asserted).
// Genealogy is append-only and hash-chained: a wrong event is never edited. A correction appends a
// reversal of the original and a replacement event that both refer to it, with a reason. Three
// steps: find the event, define the replacement, review the pair before it is appended. A reversal
// with no replacement shows on the completeness dashboard as an unresolved correction; this flow
// closes it (README QT-R43).

import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { WizardPage } from "@/components/templates"
import { Chip, DataTable, KV, RulesPanel, type Column } from "@/components/patterns"
import { useSlice } from "@/store"
import { traceOps } from "../data/actions"
import { effectiveState } from "../data/chain"
import type { QtEvent } from "../data/types"
import { Reading, Section, TextField, report } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["GC-1", "Genealogy is append-only and hash-chained per object; nothing is updated or deleted (C-53).", "DOC:p.211 Book IV §4.2"],
  ["GC-2", "A correction is a reversal event plus a replacement event, both referencing the original, each stamped with who and when.", "DOC:p.212 Book IV §4.3"],
  ["GC-3", "A reversal with no replacement is an unresolved correction on the completeness dashboard; this flow resolves it.", "DOC:p.212 Book IV §4.3"],
  ["GC-4", "The correction needs a reason; the Quality IT, Quality Manager, Quality engineer or Production supervisor may make it.", "README QT-R43"],
]
const fmt = (e: QtEvent) => `${e.type} · ${e.serial ?? e.batch ?? e.doc.id}${e.qty != null ? ` · qty ${e.qty}` : ""}`

export function GenealogyCorrection() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-TRC-CORRECTION")
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [pick, setPick] = useState(params.get("event") ?? "")
  const [batch, setBatch] = useState("")
  const [serial, setSerial] = useState("")
  const [qty, setQty] = useState("")
  const [why, setWhy] = useState("")
  const candidates = useMemo(() => s.genealogy.filter((e) => e.correction === "Active"), [s.genealogy])
  const orig = s.genealogy.find((e) => e.id === pick)
  const reversed = (e: QtEvent) => effectiveState(s.genealogy, e) === "Reversed"
  const unresolved = (e: QtEvent) => reversed(e) && !s.genealogy.some((x) => x.refersTo === e.id && x.correction === "Replacement")
  const bNew = batch.trim() || orig?.batch
  const sNew = serial.trim() || orig?.serial
  const qNew = qty.trim() === "" ? orig?.qty : Number(qty)
  const changes = [
    orig && bNew !== orig.batch ? `Batch ${orig.batch ?? "none"} → ${bNew}` : "",
    orig && sNew !== orig.serial ? `Serial ${orig.serial ?? "none"} → ${sNew}` : "",
    orig && qNew !== orig.qty ? `Quantity ${orig.qty ?? "none"} → ${qNew}` : "",
  ].filter(Boolean)
  const cols: Column<QtEvent>[] = [
    { id: "id", header: "Event", value: (e) => e.id, mono: true, sortable: true },
    { id: "type", header: "Code", value: (e) => e.type, filterable: true },
    { id: "obj", header: "Serial / batch", value: (e) => e.serial ?? e.batch ?? "", mono: true },
    { id: "doc", header: "Document", value: (e) => e.doc.id, mono: true },
    { id: "at", header: "At", value: (e) => e.at, mono: true, sortable: true, cell: (e) => e.at.slice(0, 16).replace("T", " ") },
    { id: "sp", header: "Scan point", value: (e) => e.scanPoint ?? "" },
    { id: "state", header: "State", value: (e) => (unresolved(e) ? "Reversed, no replacement" : reversed(e) ? "Reversed" : "Active"), filterable: true, cell: (e) => (unresolved(e) ? <Chip kind="flag">Reversed, no replacement</Chip> : "Active") },
  ]
  return (
    <StateFrame
      ss={ss}
      title="Genealogy correction"
      screenId="FX-TRC-CORRECTION"
      entity="genealogy events"
      allowed="Quality IT, Quality Manager, Quality engineer or Production supervisor"
      validation={["Choose the event to correct.", "State the reason for the correction.", "Change at least one value."]}
      conflict={{ what: "event GEN-TBD-00071", mine: "Append a correction pair", theirs: "Another user already reversed it; only the replacement is missing" }}
      degraded="The hash chain is verified in the background; the pair is appended now and checked within a minute."
      header={undefined}
    >
      <div className="flex flex-col gap-6">
        <WizardPage
          header={{
            title: "Correct a genealogy event",
            screenId: "FX-TRC-CORRECTION",
            crumbs: [{ label: "Trace Explorer", to: "/traceability/explorer" }, { label: "Correction pair" }],
            description: "A wrong event is never edited. The flow appends a reversal of the original and a replacement, with your reason.",
            chips: <Reading id="QT-R43" />,
          }}
          finishLabel="Append correction pair"
          consequence={orig ? `Appends a reversal of ${orig.id} and a replacement ${orig.type} event (${changes.join("; ") || "no value changed"}), both referring to ${orig.id}, hash-chained and stamped with your name. ${orig.id} stays on the record.` : "Appends a reversal and a replacement event."}
          onCancel={() => nav("/traceability/explorer")}
          onFinish={() => {
            const r = traceOps.correct(pick, { batch: bNew as never, serial: sNew as never, qty: qNew, evidence: why })
            if (!report(r, (id) => `Correction pair appended; replacement ${id}`)) return (r as { error: string }).error
            nav(`/traceability/explorer?q=${sNew ?? bNew ?? ""}`)
            return null
          }}
          steps={[
            {
              id: "find",
              title: "Find the event",
              validate: () => (!orig ? "Choose the event to correct." : null),
              content: (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">Only an Active event can be corrected. Events with a reversal and no replacement are marked: they are the unresolved corrections.</p>
                  <DataTable rows={candidates} columns={cols} rowId={(e) => e.id} activeId={pick} onRowClick={(e) => setPick(e.id)} densityKey="TRC-COR" searchText={(e) => `${e.id} ${e.type} ${e.serial ?? ""} ${e.batch ?? ""} ${e.doc.id} ${e.evidence}`} searchPlaceholder="Search by event, serial, batch or document" initialSort={{ id: "at", dir: "desc" }} empty={{ title: "No active events" }} />
                  {orig && <p className="rounded-md bg-muted p-3 text-sm">Selected {orig.id}: {fmt(orig)}. {orig.evidence}</p>}
                </div>
              ),
            },
            {
              id: "replace",
              title: "Define the replacement",
              validate: () => (!changes.length ? "Change at least one value: batch, serial or quantity." : !why.trim() ? "State the reason for the correction." : null),
              content: orig ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField id="gc-batch" label="Batch" value={batch} onChange={setBatch} placeholder={orig.batch ?? "none"} hint="Leave empty to keep the original" />
                  <TextField id="gc-serial" label="Serial" value={serial} onChange={setSerial} placeholder={orig.serial ?? "none"} hint="Leave empty to keep the original" />
                  <TextField id="gc-qty" label="Quantity" type="number" value={qty} onChange={setQty} placeholder={orig.qty != null ? String(orig.qty) : "none"} hint="Leave empty to keep the original" />
                  <div className="flex flex-col gap-1 sm:col-span-3">
                    <Label htmlFor="gc-why">Reason for the correction (required)</Label>
                    <Textarea id="gc-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What was wrong, and how it was found" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Go back and choose an event.</p>
              ),
            },
            {
              id: "review",
              title: "Review the pair",
              content: orig ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <Section title="Original (stays)">
                    <dl className="grid gap-2 text-sm"><KV k="Event">{orig.id}</KV><KV k="Record">{fmt(orig)}</KV><KV k="At">{orig.at.slice(0, 16).replace("T", " ")}</KV><KV k="Hash">{orig.hash}</KV></dl>
                  </Section>
                  <Section title="Reversal (new)">
                    <dl className="grid gap-2 text-sm"><KV k="Cancels">{orig.id}</KV><KV k="Record">{fmt(orig)}</KV><KV k="Reason">{why || "Not given"}</KV></dl>
                    {unresolved(orig) && <p className="text-xs text-muted-foreground">A reversal already exists; only the replacement is appended.</p>}
                  </Section>
                  <Section title="Replacement (new)">
                    <dl className="grid gap-2 text-sm"><KV k="Refers to">{orig.id}</KV><KV k="Record">{`${orig.type} · ${sNew ?? bNew ?? orig.doc.id}${qNew != null ? ` · qty ${qNew}` : ""}`}</KV><KV k="Changes">{changes.join("; ") || "None"}</KV></dl>
                  </Section>
                  <p className="text-xs text-muted-foreground md:col-span-3">Both new events are hash-chained to the object's last event. The completeness dashboard re-runs after the pair is appended. <Link className="text-link underline-offset-4 hover:underline" to="/traceability/completeness">Completeness dashboard</Link></p>
                </div>
              ) : null,
            },
          ]}
        />
        <RulesPanel rules={RULES} />
      </div>
    </StateFrame>
  )
}
