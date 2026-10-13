// FX-BC-REPRINT Reprint governance dialog [DOC:p.93, p.97 Part F] (asserted).
// Any label reprint needs a reason code. Serial and nameplate reprints also need Quality approval
// (duplicate nameplate risk). Reprints are watermarked DUPLICATE except location labels. Built as a
// dialog (opened from BC-ADMIN and from the Final Test screens) and as a page at its route that
// shows the dialog in each of its states.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DialogShell } from "@/components/templates"
import { Chip, DataTable, RulesPanel, type Column } from "@/components/patterns"
import { ShieldCheck } from "lucide-react"
import { useRole, useSlice } from "@/store"
import { reprintX } from "../data/extra-actions"
import { isDuplicateMarked, LABEL_KINDS, needsQualityApproval, REPRINT_REASONS } from "../data/extra-types"
import type { Reprint } from "../data/types"
import type { QualityTraceState } from "../data/slice"
import { Pick, Reading, Section, TextField, report, userName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

export const REPRINT_RULES: [string, string, string][] = [
  ["RP-1", "Any label reprint requires a reason code.", "DOC:p.97 Part F"],
  ["RP-2", "Serial and nameplate reprints additionally require Quality approval (duplicate nameplate risk).", "DOC:p.97 Part F"],
  ["RP-3", "Reprints watermark DUPLICATE, except location labels. Print service: reprint with reason and audit.", "DOC:p.93 Part F"],
  ["RP-4", "Every reprint is audit-logged with user, printer and time. Printed labels keep the template version they were printed with.", "DOC:pp.93-97 Part F"],
]

const printerSupports = (labelTypes: string[], kind: string) => labelTypes.some((t) => t.toLowerCase().startsWith(kind.toLowerCase().split(" ")[0]))
export function templateFor(s: Pick<QualityTraceState, "labelTemplates">, kind: string) {
  const map: Record<string, string> = { "Batch label": "Batch label", "Serial label": "Serial label", Nameplate: "Nameplate verification", "HU / SSCC label": "HU / SSCC label (GS1-128)", "Bin label": "Bin label", "CAL instrument label": "CAL instrument label", "RMA label": "RMA label" }
  const t = s.labelTemplates.find((x) => x.name === map[kind])
  const pub = t?.versions.find((v) => v.state === "Published")
  return t && pub ? `${t.name} v${pub.v}` : `${kind} (4 x 1)`
}

/** The DUPLICATE watermark preview: what the printed label will carry. */
export function WatermarkPreview({ labelId, kind }: { labelId: string; kind: string }) {
  const dup = isDuplicateMarked(kind)
  return (
    <div className="relative flex h-24 max-w-xs items-center justify-between overflow-hidden rounded-md border-2 border-dashed px-4" role="img" aria-label={`Label preview for ${labelId || "the label"}${dup ? ", marked DUPLICATE" : ", no watermark"}`}>
      <div>
        <p className="tabular text-sm font-semibold">{labelId || "LABEL-ID"}</p>
        <p className="text-xs text-muted-foreground">{kind || "Label"}</p>
      </div>
      <div className="h-12 w-24 bg-foreground/80" aria-hidden="true" />
      {dup ? <span className="absolute inset-0 flex -rotate-12 items-center justify-center text-2xl font-bold tracking-widest text-destructive/60">DUPLICATE</span> : <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">Location label: no watermark</span>}
    </div>
  )
}

export function ReprintDialog({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; defaults?: { labelId?: string; kind?: string; reasonCode?: string } }) {
  const s = useSlice("qualityTrace")
  const [labelId, setLabelId] = useState(defaults?.labelId ?? "")
  const [kind, setKind] = useState<string>(defaults?.kind ?? "Batch label")
  const [reasonCode, setReasonCode] = useState<string>(defaults?.reasonCode ?? "")
  const [note, setNote] = useState("")
  const online = s.printers.filter((p) => p.active && (!p.health || p.health === "Online"))
  const fit = online.filter((p) => printerSupports(p.labelTypes, kind))
  const options = (fit.length ? fit : online).map((p) => ({ value: p.id, label: `${p.id} · ${p.station}` }))
  const [printerId, setPrinterId] = useState("")
  const printer = options.some((o) => o.value === printerId) ? printerId : (options[0]?.value ?? "")
  const awaiting = needsQualityApproval(kind)
  const template = templateFor(s, kind)
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Reprint a label"
      description="A reprint is audited. The label prints with the template version shown and, except for location labels, the word DUPLICATE."
      consequence={
        awaiting
          ? `Sends the ${kind.toLowerCase()} reprint for ${labelId || "the label"} to the Quality Manager for approval. It prints on ${printer || "the chosen printer"} only after approval, marked DUPLICATE.`
          : `Prints ${labelId || "the label"} on ${printer || "the chosen printer"} as ${template}${isDuplicateMarked(kind) ? ", marked DUPLICATE" : ", with no watermark"}, and writes the reprint to the audit log.`
      }
      confirmLabel={awaiting ? "Send for Quality approval" : "Reprint"}
      onConfirm={() => {
        const r = reprintX.request({ labelId, kind, reasonCode, note, printerId: printer, template })
        if (!r.ok) return r.error
        report(r, (v) => (v.awaiting ? `${v.id} waits for Quality approval` : `${v.id} printed and logged`))
        return null
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="rp-label" label="Label ID" value={labelId} onChange={setLabelId} placeholder="SN-TBD-5M-0388" hint="Scan the label or type its ID" />
        <Pick id="rp-kind" label="Label kind" value={kind} onChange={setKind} options={[...LABEL_KINDS]} />
        <Pick id="rp-reason" label="Reason code (required)" value={reasonCode} onChange={setReasonCode} options={[...REPRINT_REASONS]} placeholder="Choose a reason" />
        <Pick id="rp-prn" label="Printer" value={printer} onChange={setPrinterId} options={options} placeholder="No online printer" />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="rp-note">Note {reasonCode === "Data corrected" ? "(required: say what was corrected)" : "(optional)"}</Label>
          <Textarea id="rp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {awaiting && (
        <Alert>
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Quality approval needed</AlertTitle>
          <AlertDescription>Serial and nameplate reprints risk a duplicate nameplate, so the Quality Manager approves before anything prints. <Reading id="QT-R31" /></AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <WatermarkPreview labelId={labelId} kind={kind} />
        <span className="text-xs text-muted-foreground">Template {template} <Reading id="QT-R30" /></span>
      </div>
    </DialogShell>
  )
}

/** Reprints waiting for the Quality Manager. */
export function ApprovalQueue({ rows }: { rows: Reprint[] }) {
  const [role] = useRole()
  const [target, setTarget] = useState<{ r: Reprint; approve: boolean } | null>(null)
  const [note, setNote] = useState("")
  const isQm = role === "Quality Manager"
  if (!rows.length) return <p className="text-sm text-muted-foreground">No serial or nameplate reprint is waiting for approval.</p>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="tabular font-medium">{r.id}</span>
            <span>{r.kind} {r.labelId}</span>
            <span className="text-muted-foreground">{r.reasonCode} · requested by {userName(r.by)} · {r.on.slice(0, 16).replace("T", " ")}</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" disabled={!isQm} title={isQm ? undefined : "The Quality Manager approves (acting as " + role + ")"} onClick={() => (setNote(""), setTarget({ r, approve: true }))}>Approve</Button>
              <Button size="sm" variant="outline" disabled={!isQm} onClick={() => (setNote(""), setTarget({ r, approve: false }))}>Reject</Button>
            </span>
          </li>
        ))}
      </ul>
      {!isQm && <p className="text-xs text-muted-foreground">Approve and Reject are for the Quality Manager. Switch "Acting as" to continue.</p>}
      <DialogShell
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`${target?.approve ? "Approve" : "Reject"} reprint ${target?.r.id}`}
        consequence={target?.approve ? `Prints ${target.r.labelId} on ${target.r.printerId}, marked DUPLICATE, and logs your approval.` : `Nothing prints. ${target?.r.labelId} keeps its current label and the rejection is logged.`}
        confirmLabel={target?.approve ? "Approve and print" : "Reject reprint"}
        destructive={!target?.approve}
        onConfirm={() => {
          if (!target) return null
          const x = reprintX.decide(target.r.id, target.approve, note)
          return report(x, target.approve ? "Approved and printed" : "Reprint rejected") ? null : (x as { error: string }).error
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="rp-dec-note">Note{target?.approve ? " (optional)" : " (required)"}</Label>
          <Textarea id="rp-dec-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </DialogShell>
    </>
  )
}

export function ReprintLog({ rows }: { rows: Reprint[] }) {
  const cols: Column<Reprint>[] = [
    { id: "id", header: "Reprint", value: (r) => r.id, mono: true, sortable: true },
    { id: "label", header: "Label", value: (r) => r.labelId, mono: true },
    { id: "kind", header: "Kind", value: (r) => r.kind ?? "", filterable: true },
    { id: "tpl", header: "Template", value: (r) => r.template, filterable: true },
    { id: "reason", header: "Reason", value: (r) => r.reasonCode ?? "", filterable: true, cell: (r) => <span title={r.reason}>{r.reasonCode ?? r.reason}</span> },
    { id: "dup", header: "Watermark", value: (r) => (r.watermark === false ? "None" : "DUPLICATE"), filterable: true },
    { id: "state", header: "State", value: (r) => r.state ?? "Printed", filterable: true, cell: (r) => (r.state === "Awaiting Quality approval" ? <Chip kind="flag">Awaiting Quality approval</Chip> : <span>{r.state ?? "Printed"}{r.approvedBy ? ` · approved ${userName(r.approvedBy)}` : ""}</span>) },
    { id: "prn", header: "Printer", value: (r) => r.printerId, filterable: true },
    { id: "by", header: "By", value: (r) => userName(r.by) },
    { id: "on", header: "On", value: (r) => r.on, mono: true, sortable: true },
  ]
  return <DataTable rows={rows} columns={cols} rowId={(r) => r.id} densityKey="BC-RPR" searchText={(r) => `${r.labelId} ${r.reason} ${r.kind ?? ""}`} initialSort={{ id: "on", dir: "desc" }} empty={{ title: "No reprints logged" }} />
}

// ============================================================================ page at /configuration/barcode/reprint
export function ReprintGovernance() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-BC-REPRINT")
  const [dlg, setDlg] = useState<null | { labelId: string; kind: string; reasonCode: string }>(null)
  const waiting = s.reprints.filter((r) => r.state === "Awaiting Quality approval")
  const cases = [
    { title: "Batch label, torn in the aisle", kind: "Batch label", labelId: "BAT-TBD-CT1003", reasonCode: "Damaged or unreadable", note: "Prints at once, marked DUPLICATE." },
    { title: "Nameplate verification label", kind: "Nameplate", labelId: "SN-TBD-5M-0388", reasonCode: "Lost", note: "Waits for Quality approval before anything prints." },
    { title: "Location label", kind: "Location label", labelId: "LOC-TBD-D-01", reasonCode: "Printer fault", note: "Prints at once with no watermark." },
  ]
  return (
    <>
      <StateFrame
        ss={ss}
        title="Reprint governance"
        screenId="FX-BC-REPRINT"
        entity="reprints"
        allowed="Plant IT or Quality Manager"
        validation={["Choose a reason code.", "Enter the label ID.", "Choose an online printer."]}
        conflict={{ what: "reprint RPR-TBD-0308", mine: "Approve and print the nameplate label", theirs: "The Quality Manager rejected it at 09:12" }}
        degraded="The label print service is slow: a reprint may take about a minute to leave the queue."
        header={{
          title: "Reprint governance",
          screenId: "FX-BC-REPRINT",
          crumbs: [{ label: "Label and Scan Administration", to: "/configuration/barcode" }, { label: "Reprint" }],
          description: "Every reprint needs a reason code. Serial and nameplate reprints also need Quality approval. Reprints are marked DUPLICATE, except location labels. The same dialog opens from Label and Scan Administration.",
          chips: <Reading id="QT-R30" />,
          primary: <Button onClick={() => setDlg({ labelId: "", kind: "Batch label", reasonCode: "" })}>Reprint a label</Button>,
          actions: (
            <Button variant="outline" asChild>
              <Link to="/configuration/barcode?s=reprints">Reprint log in administration</Link>
            </Button>
          ),
        }}
      >
        <div className="flex flex-col gap-6">
          <Section title="The dialog in each case">
            <div className="grid gap-4 md:grid-cols-3">
              {cases.map((c) => (
                <div key={c.title} className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-muted-foreground">{c.note}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip kind="design">{needsQualityApproval(c.kind) ? "Quality approval" : "No approval"}</Chip>
                    <Chip kind="design">{isDuplicateMarked(c.kind) ? "DUPLICATE" : "No watermark"}</Chip>
                  </div>
                  <WatermarkPreview labelId={c.labelId} kind={c.kind} />
                  <Button variant="outline" className="self-start" onClick={() => setDlg({ labelId: c.labelId, kind: c.kind, reasonCode: c.reasonCode })}>Open the dialog</Button>
                </div>
              ))}
            </div>
          </Section>
          <Section title={`Waiting for Quality approval (${waiting.length})`}>
            <ApprovalQueue rows={waiting} />
          </Section>
          <Section title="Reprint log">
            <ReprintLog rows={s.reprints} />
          </Section>
          <RulesPanel rules={REPRINT_RULES} />
        </div>
      </StateFrame>
      {dlg && <ReprintDialog key={`${dlg.labelId}${dlg.kind}`} open onOpenChange={(o) => !o && setDlg(null)} defaults={dlg} />}
    </>
  )
}
