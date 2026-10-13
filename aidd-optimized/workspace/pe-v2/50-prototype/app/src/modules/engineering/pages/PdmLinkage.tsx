// FX-CAD-PDM PDM linkage states (Detail, design value) [Book III Part G §4 Change Flow Mapping, DOC:p.198].
// For each controlled document linked to a vault object: the PDM state and its ERP effect. Four states
// the PRD maps (checked out, change order opened, release approved, obsolete) plus the connector's publish
// outcomes. The PRD gives no status list for linkage (OQ-21), so states are text, never badges. The floor
// keys off ERP effectivity, never off PDM state: a PDM release with a future ERP effectivity is normal.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { useSlice } from "@/store"
import { DlgFrame } from "../DlgFrame"
import { NoPostings, RefLink, StageText, useAct, useActDialog } from "../components"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { currentRev, docStatus, whereUsedDoc } from "../data/logic"
import * as act from "../data/actions"
import type { PdmLink, PdmState } from "../data/types"

/** PDM state to ERP effect, verbatim from the change-flow mapping [Part G §4]. */
const EFFECT: Record<PdmState, string> = {
  "In work (checked out)": "The ERP document shows In-Work at vault (informational); the released rendition is unaffected.",
  "Change order opened": "Proposal to link or create an ERP ECR (the engineer confirms); the PDM CO number is cross-referenced.",
  "Release approved": "Requires the linked ERP ECO task set to be release-ready (the connector checks via API); publishes renditions; the ERP ECO release then executes the atomic cutover. Sequenced PDM first; ERP effectivity governs the floor.",
  "Released, rendition published": "The rendition is in ERP with its checksum verified and the RELEASED stamp applied; ERP effectivity, not PDM state, decides what the floor uses.",
  "Publish failed": "Publish is queued for retry with an alert. A transport failure delivers on replay; a vault-rule failure stays Failed until the source is fixed in the vault.",
  "Obsolete in PDM": "The ERP document becomes Obsolete with the standard exclusion rules; a where-used sweep warns on active usage before it is allowed.",
  "Not linked (ERP only)": "The document lives only in the ERP repository: there is no vault object and no connector event.",
}
const ORDER: PdmState[] = ["In work (checked out)", "Change order opened", "Release approved", "Released, rendition published", "Publish failed", "Obsolete in PDM", "Not linked (ERP only)"]

export function PdmLinkage() {
  const s = useSlice("engineering")
  const st = useStates("FX-CAD-PDM")
  const run = useAct()
  const runD = useActDialog()
  const [params, setParams] = useSearchParams()
  const [obs, setObs] = useState(false)
  const id = params.get("link") ?? s.pdm[0]?.id
  const l = s.pdm.find((x) => x.id === id)
  const doc = l ? s.documents.find((d) => d.id === l.documentId) : undefined
  const writable = !st.offline && !st.readonly && !st.degraded
  const blockers = l ? act.pdmReadiness(s, l) : []
  const used = doc ? whereUsedDoc(s, doc.id) : []
  const events = l ? s.vaultEvents.filter((e) => e.ref?.id === l.documentId) : []
  const counts = (k: PdmState) => s.pdm.filter((x) => x.state === k).length

  let primary = null
  if (l && writable) {
    if (l.state === "Change order opened") primary = <Button onClick={() => run((x, c) => act.confirmPdmEcr(x, c, l.id), (v) => `ECR ${v} created and cross-referenced`)} disabled={!!l.linkedEcr}>Confirm ECR proposal</Button>
    else if (l.state === "Release approved") primary = <Button onClick={() => run((x, c) => act.pdmRelease(x, c, l.id), "Rendition published")} title={blockers.length ? blockers.join(" ") : undefined}>Run release round-trip</Button>
    else if (l.state === "Publish failed") primary = <Button onClick={() => run((x, c) => act.pdmReplay(x, c, l.id), (n) => (n > 0 ? "Publish replayed and delivered" : "Replayed: still blocked by a vault rule"))}>Replay publish</Button>
    else if (l.state === "Obsolete in PDM") primary = <Button onClick={() => setObs(true)}>Obsolete the ERP document</Button>
  }
  return (
    <ScreenFrame st={st} what="PDM linkage" who="Engineers and the Engineering Manager act on linkage; the connector service account writes it" source="Book III Part G §4"
      text={{
        degraded: "The vault connector (IF-17) is behind: states may be older than the vault. Release, replay and ECR actions are disabled until it recovers.",
        readonly: "Read-only: linkage can be read, but nothing is sent to the vault or changed in ERP.",
        conflict: "The vault reports a newer state than the one you opened (for example the change order closed). Reload to see it.",
      }}>
      <DetailPage
        header={{
          title: "PDM linkage states",
          screenId: "FX-CAD-PDM",
          crumbs: [{ label: "CAD sync", to: "/engineering/cad-sync" }, { label: "PDM linkage" }],
          description: "Where each controlled document stands in the vault and what that means in the ERP. The floor keys off ERP effectivity, never off PDM state.",
          actions: <StatePreviewAll st={st} />,
          primary,
          chips: <Chip kind="design" note="The feature list leaves the SolidWorks PDM baseline open; the mapping is the PRD's, the connector is mocked">Mocked connector</Chip>,
        }}
        summary={
          l && !st.empty ? (
            <>
              <KV k="Document">{doc ? <RefLink r={{ type: "document", id: doc.id }} /> : l.documentId} {doc && <StatusBadge kind="document" status={docStatus(doc)} size="sm" />}</KV>
              <KV k="PDM state"><StageText value={l.state} /></KV>
              <KV k="Vault object">{l.vaultPath ? <span className="font-mono text-xs">{l.vaultPath}</span> : "None"} {l.vaultRev && <>rev {l.vaultRev}</>}</KV>
              <KV k="PDM change order">{l.pdmCo ?? "None"}</KV>
              <KV k="Linked ERP records">{l.linkedEcr ? <RefLink r={{ type: "ecr", id: l.linkedEcr }} /> : "No ECR"}{l.linkedEco && <> · <RefLink r={{ type: "eco", id: l.linkedEco }} /></>}</KV>
              <KV k="Last event">{l.lastEvent ?? "None"}</KV>
            </>
          ) : undefined
        }
        tabs={[
          {
            id: "link", label: "Linkage",
            content:
              !l || st.empty ? <EmptyState title="No document is linked to the vault">Links appear when the connector sees a vault object for a controlled document.</EmptyState> : (
                <div className="flex max-w-4xl flex-col gap-4">
                  <PdmStrip l={l} />
                  <p className="rounded-md bg-muted px-4 py-2 text-sm"><span className="font-medium">ERP effect.</span> {EFFECT[l.state]}</p>
                  {l.note && <p className="text-sm">{l.note}</p>}
                  {l.state === "Release approved" && (
                    <div className="rounded-md border px-4 py-2 text-sm">
                      <p className="font-medium">Release readiness (linked ERP ECO {l.linkedEco ?? "none"})</p>
                      {blockers.length ? <ul className="list-disc pl-6">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : <p>The ERP ECO task set is release-ready.</p>}
                      <p className="mt-1 text-muted-foreground">PDM releases first, ERP effectivity governs the floor; a PDM release with a future effectivity date is normal, not an error.</p>
                    </div>
                  )}
                  {l.state === "Obsolete in PDM" && (
                    <div className="rounded-md border px-4 py-2 text-sm">
                      <p className="font-medium">Where-used sweep</p>
                      {used.length ? <p>Active usage found: {used.map((u) => <span key={u.type + u.id} className="mr-2"><RefLink r={u} /></span>)}. Obsoleting excludes this document from those records.</p> : <p>No EBOM line, transmittal or request references this document.</p>}
                    </div>
                  )}
                  {events.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">Vault events for this document</h3>
                      <ul className="flex flex-col gap-1 text-sm">{events.map((e) => <li key={e.id}><span className="font-mono">{e.at}</span> · {e.kind} · {e.state}{e.error ? ` · ${e.error}` : ""} · <span className="font-mono">{e.vaultTx}</span></li>)}</ul>
                      <Button variant="link" asChild className="px-0"><Link to="/engineering/cad-sync">Open the sync monitor</Link></Button>
                    </div>
                  )}
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Activity</h3>
                    <ul className="flex flex-col gap-1 text-sm">{l.activity.length ? [...l.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}</li>) : <li className="text-muted-foreground">No linkage activity yet.</li>}</ul>
                  </div>
                </div>
              ),
          },
          {
            id: "all", label: "All links", count: s.pdm.length,
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{ORDER.map((k) => `${counts(k)} ${k.toLowerCase()}`).filter((x) => !x.startsWith("0 ")).join(" · ")}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead>Link</TableHead><TableHead>Document</TableHead><TableHead>ERP status</TableHead><TableHead>Vault rev</TableHead><TableHead>PDM state</TableHead><TableHead>PDM CO</TableHead><TableHead>Last event</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {s.pdm.map((x) => {
                        const d = s.documents.find((y) => y.id === x.documentId)
                        return (
                          <TableRow key={x.id} className="h-8 text-[13px]">
                            <TableCell><button className="font-mono text-link underline-offset-4 hover:underline" onClick={() => { params.set("link", x.id); setParams(params, { replace: true }) }}>{x.id}</button></TableCell>
                            <TableCell className="font-mono">{x.documentId}</TableCell>
                            <TableCell>{d ? `${docStatus(d)} rev ${currentRev(d).rev}` : ""}</TableCell>
                            <TableCell className="font-mono">{x.vaultRev ?? ""}</TableCell>
                            <TableCell>{x.state}</TableCell>
                            <TableCell className="font-mono">{x.pdmCo ?? ""}</TableCell>
                            <TableCell className="font-mono">{x.lastEvent ?? ""}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ),
          },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={[
        ["Checked out", EFFECT["In work (checked out)"], "Part G §4"],
        ["Change order opened", EFFECT["Change order opened"], "Part G §4"],
        ["Release approved", EFFECT["Release approved"], "Part G §4"],
        ["Obsolete in PDM", EFFECT["Obsolete in PDM"], "Part G §4"],
        ["Sequencing", "The shop floor keys off ERP effectivity, never off PDM state", "Part G §4 build note"],
      ]} />
      {l && (
        <DlgFrame open={obs} onOpenChange={setObs} title={`Obsolete ${l.documentId} in ERP`} confirmLabel="Obsolete document" destructive requireReason reasonLabel="Reason (required)"
          consequence={`The document becomes Obsolete and is excluded from every pick-up point${used.length ? `; active usage found on ${used.length} record${used.length === 1 ? "" : "s"}` : ""}. Obsolete is terminal.`}
          onConfirm={(reason) => { const e = runD((x, c) => act.pdmObsolete(x, c, l.id, reason), "ERP document obsoleted"); return e }}
        >
          <p className="text-sm">The vault marked this object obsolete; the ERP follows only after this confirmation.</p>
        </DlgFrame>
      )}
    </ScreenFrame>
  )
}

/** The path a linked document takes through the PDM states, current one marked in words. */
function PdmStrip({ l }: { l: PdmLink }) {
  const path: PdmState[] = ["In work (checked out)", "Change order opened", "Release approved", "Released, rendition published"]
  const exits: PdmState[] = ["Publish failed", "Obsolete in PDM", "Not linked (ERP only)"]
  return (
    <div className="flex flex-col gap-2 text-sm" aria-label="PDM state path">
      <ol className="flex flex-wrap gap-2">
        {path.map((p, i) => <li key={p} className={`rounded-md border px-3 py-1 ${p === l.state ? "border-2 font-semibold" : "text-muted-foreground"}`} aria-current={p === l.state ? "step" : undefined}>{i + 1}. {p}{p === l.state ? " (current)" : ""}</li>)}
      </ol>
      <ul className="flex flex-wrap gap-2">
        {exits.map((p) => <li key={p} className={`rounded-md border border-dashed px-3 py-1 ${p === l.state ? "border-2 font-semibold" : "text-muted-foreground"}`}>{p}{p === l.state ? " (current)" : ""}</li>)}
      </ul>
    </div>
  )
}
