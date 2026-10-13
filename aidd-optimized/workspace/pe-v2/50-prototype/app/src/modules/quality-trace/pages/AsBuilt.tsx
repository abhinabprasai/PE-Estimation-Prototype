// FX-TRC-ASBUILT As-built record and certificate dossier [DOC:p.212 Book IV §4.3-4.4; p.84-87 Book I E] (asserted).
// One click per serial assembles the as-built bill of material (batch and serial genealogy by
// backward trace), the Final Test Report, the certificate of conformance, material certificates,
// the deviations disclosed and the nameplate record. A dossier is a numbered revision for a serial;
// it is transmitted to the customer with a transmittal number. The cover and transmittal sheet
// print from the print outputs (README QT-R40).

import { useState } from "react"
import { Link, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { useRole, useSlice } from "@/store"
import { asBuiltX } from "../data/extra-actions"
import type { AsBuiltDossier } from "../data/extra-types"
import { backward, flatten } from "../data/trace"
import { ActivityList, DocLinkText, NoList, NotFound, Pick, Reading, Stat, TextField, report, userName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["AB-1", "The as-built record is the backward trace of one serial: batches, component serials, receipts and purchase orders, from the append-only genealogy (C-53).", "DOC:p.212 Book IV §4.4"],
  ["AB-2", "The certificate dossier is one click per serial and needs a Final Test Report countersigned by the Quality Manager.", "DOC:p.211 Book IV §4.3"],
  ["AB-3", "Deviations and waivers that cover any part of the unit are disclosed in the dossier.", "DOC:p.215 Book IV §7.3"],
  ["AB-4", "A change to the genealogy after assembly makes a new revision; a transmitted revision is never edited.", "README QT-R40"],
]

// ============================================================================ list
export function AsBuiltList() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-TRC-ASBUILT")
  const [role] = useRole()
  const [dlg, setDlg] = useState(false)
  const eligible = s.finalTests.filter((f) => f.finalResult === "Pass" && f.qmCountersign)
  const canAssemble = ["Quality Manager", "Quality engineer", "Document control"].includes(role)
  const cols: Column<AsBuiltDossier>[] = [
    { id: "id", header: "Dossier", value: (d) => d.id, mono: true, sortable: true },
    { id: "serial", header: "Serial", value: (d) => d.serial, mono: true, cell: (d) => <DocLinkText r={{ type: "serial", id: d.serial }} /> },
    { id: "rev", header: "Revision", value: (d) => d.revision, align: "right", mono: true },
    { id: "on", header: "Assembled", value: (d) => d.assembledOn, mono: true, sortable: true },
    { id: "by", header: "By", value: (d) => userName(d.by) },
    { id: "items", header: "Contents", value: (d) => d.items.length, align: "right", mono: true },
    { id: "tx", header: "Transmitted", value: (d) => (d.transmittedOn ? "Transmitted" : "Not sent"), filterable: true, cell: (d) => (d.transmittedOn ? `${d.transmittedOn} to ${d.transmittedTo}` : <Chip kind="flag">Not sent</Chip>) },
  ]
  return (
    <>
      <StateFrame ss={ss} title="As-built records" screenId="FX-TRC-ASBUILT" entity="as-built dossiers" allowed="Quality Manager, Quality engineer or Document control" validation={["Choose a unit whose Final Test Report is countersigned."]} conflict={{ what: "dossier ABD-TBD-0001", mine: "Transmit revision 1", theirs: "Revision 2 was assembled after a genealogy correction" }} degraded="Certificate files are slow to attach; the dossier lists them as pending until they arrive.">
        <ListPage
          header={{
            title: "As-built records",
            screenId: "FX-TRC-ASBUILT",
            crumbs: [{ label: "Traceability" }, { label: "As-built" }],
            description: "The certificate dossier for each shipped unit: as-built bill of material, test report, certificates and disclosed deviations, in numbered revisions.",
            chips: <Reading id="QT-R40" />,
            primary: <Button disabled={!canAssemble || ss.locked} onClick={() => setDlg(true)}>Assemble dossier</Button>,
            actions: <Button variant="outline" asChild><Link to="/traceability/explorer">Trace Explorer</Link></Button>,
          }}
          above={
            <div className="flex flex-wrap gap-2">
              <Stat label="Dossiers" value={s.asBuiltDossiers.length} />
              <Stat label="Not yet transmitted" value={s.asBuiltDossiers.filter((d) => !d.transmittedOn).length} tone={s.asBuiltDossiers.some((d) => !d.transmittedOn) ? "attention" : undefined} />
              <Stat label="Units ready for a dossier" value={eligible.filter((f) => !s.asBuiltDossiers.some((d) => d.serial === f.serial)).length} />
              {!canAssemble && <span className="self-center text-xs text-muted-foreground">Assembling is for the Quality Manager, Quality engineer or Document control; you are acting as {role}.</span>}
            </div>
          }
          table={{ rows: ss.state === "empty" ? [] : s.asBuiltDossiers, columns: cols, rowId: (d) => d.id, rowHref: (d) => `/traceability/as-built/${d.id}`, searchText: (d) => `${d.id} ${d.serial}`, searchPlaceholder: "Search dossier or serial", initialSort: { id: "on", dir: "desc" }, empty: { title: "No dossiers yet", body: "Assemble one for a unit whose Final Test Report is countersigned." } }}
        />
      </StateFrame>
      {dlg && <AssembleDialog onClose={() => setDlg(false)} />}
    </>
  )
}

function AssembleDialog({ onClose }: { onClose: () => void }) {
  const s = useSlice("qualityTrace")
  const [serial, setSerial] = useState("")
  const f = s.finalTests.filter((x) => x.finalResult === "Pass")
  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title="Assemble certificate dossier"
      consequence={`Collects the backward trace, the Final Test Report, the certificate of conformance and the deviations of ${serial || "the unit"} into the next revision. Nothing is sent to the customer yet.`}
      confirmLabel="Assemble"
      onConfirm={() => {
        const r = asBuiltX.assemble(serial)
        return report(r, (id) => `${id} assembled`) ? null : (r as { error: string }).error
      }}
    >
      <Pick id="ab-serial" label="Serial" value={serial} onChange={setSerial} options={f.map((x) => ({ value: x.serial, label: `${x.serial} · ${x.ftrId}${x.qmCountersign ? "" : " (not countersigned)"}` }))} />
    </DialogShell>
  )
}

// ============================================================================ detail
export function AsBuiltDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-TRC-ASBUILT")
  const [role] = useRole()
  const [dlg, setDlg] = useState(false)
  const [to, setTo] = useState("")
  const d = s.asBuiltDossiers.find((x) => x.id === id)
  if (!d) return <NotFound what="dossier" id={id} back={{ to: "/traceability/as-built", label: "Back to as-built records" }} />
  const serial = s.serials.find((x) => x.id === d.serial)
  const f = s.finalTests.find((x) => x.serial === d.serial)
  const tree = backward({ genealogy: s.genealogy, batches: s.batches, serials: s.serials, deviations: s.deviations }, { type: "serial", id: d.serial })
  const nodes = flatten(tree)
  const revs = s.asBuiltDossiers.filter((x) => x.serial === d.serial).sort((a, b) => b.revision - a.revision)
  const latest = revs[0].id === d.id
  const canSend = ["Quality Manager", "Document control"].includes(role) && !d.transmittedOn && !ss.locked
  const sent = !!d.transmittedOn
  return (
    <>
      <StateFrame ss={ss} title={d.id} screenId="FX-TRC-ASBUILT" entity="as-built dossiers" allowed="Quality Manager, Quality engineer or Document control" validation={["Name the recipient before you transmit."]} conflict={{ what: d.id, mine: "Transmit", theirs: "Another user transmitted it a minute ago" }} degraded="Material certificate files may show as pending for a few minutes.">
        <DetailPage
          header={{
            title: `${d.id} · ${d.serial} rev ${d.revision}`,
            screenId: "FX-TRC-ASBUILT",
            crumbs: [{ label: "As-built records", to: "/traceability/as-built" }, { label: d.id }],
            description: `Certificate dossier for ${serial?.materialId ?? d.serial}, assembled ${d.assembledOn} by ${userName(d.by)}.`,
            chips: (
              <>
                <NoList text={sent ? "Transmitted" : "Assembled"} />
                {sent && <Chip kind="design" note="A transmitted revision is never edited">Read-only</Chip>}
                {!latest && <Chip kind="flag">Superseded by {revs[0].id}</Chip>}
                <Reading id="QT-R40" />
              </>
            ),
            primary: sent ? undefined : <Button disabled={!canSend} title={canSend ? undefined : `Transmitting is for the Quality Manager or Document control; you are acting as ${role}`} onClick={() => setDlg(true)}>Transmit to customer</Button>,
            actions: (
              <>
                <Button variant="outline" asChild><Link to={`/traceability/explorer?q=${d.serial}`}>Open trace tree</Link></Button>
                <Button variant="outline" asChild><Link to="/print/shipping-documents">Cover and transmittal sheet</Link></Button>
              </>
            ),
          }}
          status={serial ? { kind: "serial", value: serial.status } : undefined}
          summary={
            <>
              <KV k="Serial"><DocLinkText r={{ type: "serial", id: d.serial }} /></KV>
              <KV k="Revision">{`${d.revision} of ${revs.length}`}</KV>
              <KV k="Final Test Report">{f?.ftrId ?? "None"}</KV>
              <KV k="Countersigned">{f?.qmCountersign ? `${f.qmCountersign.on} by ${userName(f.qmCountersign.by)}` : "Not countersigned"}</KV>
              <KV k="Transmitted to">{d.transmittedTo ?? "Not sent"}</KV>
              <KV k="Transmittal">{d.transmittalNo ? `${d.transmittalNo} · ${d.transmittedOn}` : "None"}</KV>
              <KV k="Genealogy nodes">{nodes.length}</KV>
              <KV k="Status of unit">{serial ? <StatusBadge kind="serial" status={serial.status} size="sm" /> : "Unknown"}</KV>
            </>
          }
          tabs={[
            {
              id: "contents", label: "Contents", count: d.items.length,
              content: (
                <ul className="flex flex-col gap-2 text-sm">
                  {d.items.map((i) => (
                    <li key={i.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                      <span className="font-medium">{i.label}</span>
                      {i.ref && (i.key === "ftr" && f ? <Link className="text-link underline-offset-4 hover:underline" to={`/quality/final-test/${f.id}`}>{i.ref}</Link> : i.key === "coc" ? <Link className="text-link underline-offset-4 hover:underline" to={`/quality/inspections/${i.ref}`}>{i.ref}</Link> : <span>{i.ref}</span>)}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: "bom", label: "As-built bill of material", count: nodes.length,
              content: (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-table-head text-left"><tr><th className="p-2">Level</th><th className="p-2">Item</th><th className="p-2">Detail</th><th className="p-2">Deviations</th></tr></thead>
                    <tbody>
                      {nodes.map((n) => (
                        <tr key={n.key} className="border-t">
                          <td className="tabular p-2">{n.depth}</td>
                          <td className="p-2" style={{ paddingLeft: `${8 + n.depth * 16}px` }}>{n.doc ? <DocLinkText r={n.doc} label={n.label} /> : n.label}{n.removed && <> <Chip kind="flag">Removed</Chip></>}</td>
                          <td className="p-2 text-muted-foreground">{n.sub ?? ""}{n.note ? ` ${n.note}` : ""}</td>
                          <td className="p-2">{n.deviations?.join(", ") ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              id: "revs", label: "Revisions", count: revs.length,
              content: (
                <ul className="flex flex-col gap-2 text-sm">
                  {revs.map((r) => <li key={r.id} className="rounded-lg border p-3"><Link className="text-link underline-offset-4 hover:underline" to={`/traceability/as-built/${r.id}`}>{r.id}</Link> rev {r.revision} · assembled {r.assembledOn} · {r.transmittedOn ? `transmitted ${r.transmittedOn} (${r.transmittalNo})` : "not transmitted"}</li>)}
                </ul>
              ),
            },
            { id: "activity", label: "Activity", content: <ActivityList items={[{ at: d.assembledOn, by: userName(d.by), text: `Revision ${d.revision} assembled` }, ...(d.transmittedOn ? [{ at: d.transmittedOn, by: "Document control", text: `Transmitted to ${d.transmittedTo} as ${d.transmittalNo}` }] : [])]} /> },
            { id: "rules", label: "Rules", content: <RulesPanel rules={RULES} /> },
          ]}
        />
      </StateFrame>
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        title={`Transmit ${d.id}`}
        consequence={`Sends revision ${d.revision} of the dossier for ${d.serial} to the recipient and issues a transmittal number. The revision becomes read-only.`}
        confirmLabel="Transmit"
        onConfirm={() => {
          const r = asBuiltX.transmit(d.id, to)
          return report(r, "Dossier transmitted") ? null : (r as { error: string }).error
        }}
      >
        <TextField id="tx-to" label="Recipient" value={to} onChange={setTo} placeholder="Customer, document control" />
      </DialogShell>
    </>
  )
}
