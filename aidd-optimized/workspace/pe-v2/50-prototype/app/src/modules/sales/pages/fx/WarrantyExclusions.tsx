// FX-RMA-EXCLUSIONS Warranty exclusions catalog (/service/warranty-exclusions) [DOC:p.215 Book IV §7.4].
// The catalog the warranty adjudication cites when a denial is attributed to Site Conditions or Installation
// Error. Entries are effective-dated: a change makes a new version, the earlier text stays in the history, and a
// deactivated entry stays on past adjudications (C-50).
import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DialogShell } from "@/components/templates"
import { Chip, RulesPanel } from "@/components/patterns"
import { useSlice } from "@/store"
import { saveExclusion, setExclusionActive } from "../../fx/actions"
import type { Exclusion } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { PickField, StateBar, StateGate, TextField, report, useFxState } from "./kit"

const SECTIONS = [{ id: "all", label: "All exclusions" }, { id: "Site conditions", label: "Site conditions" }, { id: "Installation error", label: "Installation error" }, { id: "usage", label: "Where it is cited" }]

export function WarrantyExclusions() {
  const db = useSlice("sales")
  const st = useFxState()
  const [section, setSection] = useState("all")
  const [edit, setEdit] = useState<Exclusion | "new" | null>(null)
  const [toggle, setToggle] = useState<Exclusion | null>(null)
  const [hist, setHist] = useState<Exclusion | null>(null)
  const list = db.fx.exclusions.filter((e) => section === "all" || e.category === section)
  const cited = (code: string) => db.rmas.filter((r) => r.adjudication?.exclusion === code)
  return (
    <div className="flex flex-col gap-4">
      <StateBar st={st} />
      <ConfigPage
        header={{ title: "Warranty exclusions catalog", screenId: "FX-RMA-EXCLUSIONS", description: "Two categories: site conditions and installation error. An adjudication that denies warranty on either must cite one.", chips: <Chip kind="design" note="The PRD names the two categories; the entries are design values (Reading SR-19).">Entries: design values</Chip>, primary: <Button onClick={() => setEdit("new")} disabled={!st.writable} title={st.why || undefined}>New exclusion</Button> }}
        sections={SECTIONS}
        section={section}
        onSectionChange={setSection}
        effectiveDated
      >
        <StateGate st={st} empty={{ title: "No exclusions", body: "Without a catalog entry a denial cannot be attributed to site conditions or installation error." }}>
          {section === "usage" ? (
            <Section title="Adjudications that cite an exclusion">
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>RMA</TableHead><TableHead>Verdict</TableHead><TableHead>Exclusion</TableHead><TableHead>Justification</TableHead></TableRow></TableHeader>
                <TableBody>
                  {db.rmas.filter((r) => r.adjudication?.exclusion).map((r) => <TableRow key={r.id}><TableCell><Link className="text-link underline" to={`/sales/rma/${r.id}`}>{r.id}</Link></TableCell><TableCell>{r.adjudication!.verdict}</TableCell><TableCell>{r.adjudication!.exclusion}</TableCell><TableCell>{r.adjudication!.justification}</TableCell></TableRow>)}
                  {db.rmas.every((r) => !r.adjudication?.exclusion) && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No adjudication cites an exclusion yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Section>
          ) : (
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Code</TableHead><TableHead>Category</TableHead><TableHead>Exclusion</TableHead><TableHead>Version</TableHead><TableHead>Effective from</TableHead><TableHead>State</TableHead><TableHead>Cited by</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {list.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className="font-mono text-xs">{e.code}</TableCell><TableCell>{e.category}</TableCell><TableCell>{e.text}</TableCell><TableCell className="tabular">v{e.version}</TableCell><TableCell>{e.effectiveFrom}</TableCell>
                    <TableCell><Badge variant={e.active ? "outline" : "secondary"}>{e.active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>{cited(e.code).map((r) => r.id).join(", ") || "None"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled={!st.writable} onClick={() => setEdit(e)}>Edit</Button>{" "}
                      <Button size="sm" variant="outline" disabled={!st.writable} onClick={() => setToggle(e)}>{e.active ? "Deactivate" : "Activate"}</Button>{" "}
                      <Button size="sm" variant="ghost" onClick={() => setHist(e)}>History ({e.history.length})</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </StateGate>
      </ConfigPage>
      {edit && <EditDialog key={edit === "new" ? "new" : edit.code} ex={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {toggle && <DialogShell open onOpenChange={(o) => !o && setToggle(null)} title={`${toggle.active ? "Deactivate" : "Activate"} ${toggle.code}`} description={toggle.text} consequence={toggle.active ? "New adjudications can no longer cite it; adjudications that already cite it keep it. An open RMA that cites it blocks the change." : "New adjudications can cite it again, from today."} requireReason confirmLabel={toggle.active ? "Deactivate" : "Activate"} destructive={toggle.active} onConfirm={(r) => report(setExclusionActive(toggle.code, !toggle.active, r), `${toggle.code} ${toggle.active ? "deactivated" : "activated"}`)} />}
      {hist && <DialogShell open onOpenChange={(o) => !o && setHist(null)} title={`History of ${hist.code}`} description="Earlier versions stay readable (C-50)." confirmLabel="Close" onConfirm={() => null}>
        <ol className="flex flex-col gap-2 text-sm"><li><strong>v{hist.version} (current, from {hist.effectiveFrom})</strong>: {hist.text}</li>{[...hist.history].reverse().map((h) => <li key={h.version}>v{h.version} (from {h.effectiveFrom}, changed by {h.changedBy}): {h.text}. <span className="text-muted-foreground">{h.reason}</span></li>)}</ol>
      </DialogShell>}
      <RulesPanel rules={[
        ["EXC-1", "An adjudication denying warranty on Site Conditions or Installation Error requires an exclusion from this catalog.", "DOC:p.215 §7.4"],
        ["EXC-2", "Entries are effective-dated: a change is a new version with the reason; the history stays visible (C-50).", "C-50"],
        ["EXC-3", "Edited by the Quality Manager, Process owner or Customer Service Manager (design value, ASM-PERM-1).", "Design value"],
      ]} />
      <p className="text-xs text-muted-foreground"><Reading id="SR-19" note="Exclusion entries are design values under the PRD's two categories." /></p>
    </div>
  )
}

function EditDialog({ ex, onClose }: { ex: Exclusion | null; onClose: () => void }) {
  const [category, setCategory] = useState<Exclusion["category"]>(ex?.category ?? "Site conditions")
  const [text, setText] = useState(ex?.text ?? "")
  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()} title={ex ? `Edit ${ex.code}` : "New exclusion"} description={ex ? `Saving makes version ${ex.version + 1}; v${ex.version} stays in the history.` : "The code is assigned on save."} consequence={ex ? "Applies to adjudications from today; earlier adjudications keep the version they cited." : "Adds the exclusion as Active from today."} requireReason reasonLabel="Reason for the change (required)" confirmLabel="Save" onConfirm={(r) => report(saveExclusion(ex?.code ?? null, { category, text }, r), (c) => `${c ?? ex?.code} saved`)}>
      <PickField label="Category" value={category} onChange={(v) => setCategory(v as typeof category)} options={["Site conditions", "Installation error"]} />
      <TextField id="exc-text" label="Exclusion text" value={text} onChange={setText} />
    </DialogShell>
  )
}
