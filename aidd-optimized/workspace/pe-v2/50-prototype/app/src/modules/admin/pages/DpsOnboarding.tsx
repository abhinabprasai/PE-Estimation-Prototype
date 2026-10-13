// FX-CFG-DPS-ONBOARD Denied-party interim onboarding checklist [DOC: Book III C §5]: until an automated screening service is
// selected, a person works a six-step checklist for each new customer or vendor before the party is activated. A potential or
// confirmed match goes to the review queue and the party stays inactive. Steps marked "Not applicable" need a reason.
// The checklist wording is the specification's outline; who may screen is a reading (AR-40).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, EmptyState, KV, RulesPanel } from "@/components/patterns"
import { DetailPage, DialogShell } from "@/components/templates"
import { CUSTOMERS, VENDORS } from "@/data/shared"
import { useSlice } from "@/store"
import { completeChecklist, setChecklistItem, startChecklist } from "../data/cfg-actions"
import type { DpsChecklist } from "../data/cfg-types"
import { fmtDate } from "@/lib/format"
import { Field, SimpleSelect, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

export function DpsOnboarding() {
  const [params, setParams] = useSearchParams()
  const s = useSlice("adminCfg")
  const view = useView("FX-CFG-DPS-ONBOARD")
  const [dlg, setDlg] = useState<null | "start" | { na: DpsChecklist["items"][number] } | "complete">(null)
  const [party, setParty] = useState<{ type: "Customer" | "Vendor"; id: string }>({ type: "Vendor", id: "" })
  const [result, setResult] = useState<NonNullable<DpsChecklist["result"]>>("Clear")
  const [why, setWhy] = useState("")
  const lists = view.empty ? [] : s.dpsChecklists
  const sel = lists.find((c) => c.id === params.get("checklist")) ?? lists.find((c) => !c.result) ?? lists[0]
  const done = (c: DpsChecklist) => c.items.filter((i) => i.state !== "Open").length
  const locked = !!sel?.result || !!view.writeError()
  const partyOptions = party.type === "Customer" ? CUSTOMERS.map((c) => ({ value: c.id, label: `${c.id} ${c.name}` })) : VENDORS.map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))
  const choose = (id: string) => { const n = new URLSearchParams(params); n.set("checklist", id); setParams(n, { replace: true }) }
  const hit = sel ? s.dpsHits.find((h) => h.partyId === sel.partyId && (h.state === "New" || h.state === "In review")) : undefined

  return (
    <StateFrame view={view} cols={4} emptyTitle="No checklists yet." emptyBody="Start a checklist when a customer or vendor is created." degraded="Degraded: the party master lookup is slow. Open checklists are unaffected." subject="the onboarding checklist">
      {!sel ? (
        <div className="flex flex-col gap-3"><EmptyState title="No onboarding checklists.">Each new customer or vendor gets one before activation.</EmptyState><Button className="self-start" onClick={() => setDlg("start")} disabled={!!view.writeError()}>Start a checklist</Button></div>
      ) : (
        <DetailPage
          header={{
            title: `Denied-party screening: ${sel.partyName}`,
            screenId: "FX-CFG-DPS-ONBOARD",
            crumbs: [{ label: "Configuration" }, { label: "Denied-party onboarding" }],
            description: "Interim manual screening before a customer or vendor is activated. Works until an automated screening service is chosen.",
            chips: (<><Chip kind="design" note="Route /configuration/denied-party/onboarding is a design value; checklist outline is Book III C §5">Design route</Chip><StateText tone={sel.result === "Clear" ? "default" : sel.result ? "attention" : "muted"}>{sel.result ? `Result: ${sel.result}` : `${done(sel)} of ${sel.items.length} steps done`}</StateText></>),
            actions: (<><StatePicker view={view} /><Button variant="outline" onClick={() => setDlg("start")} disabled={!!view.writeError()}>Start another</Button></>),
            primary: !sel.result ? <Button onClick={() => setDlg("complete")} disabled={!!view.writeError() || done(sel) < sel.items.length} title={done(sel) < sel.items.length ? "Finish every step first" : undefined}>Record result</Button> : undefined,
          }}
          summary={(<><KV k="Party">{sel.partyId}</KV><KV k="Type">{sel.partyType}</KV><KV k="Country">{sel.country}</KV><KV k="Completed">{sel.completedOn ? `${fmtDate(sel.completedOn)} by ${userName(sel.completedBy)}` : "Not yet"}</KV></>)}
          tabs={[
            { id: "steps", label: "Checklist", count: sel.items.length, content: (
              <div className="flex flex-col gap-3">
                {sel.result && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Completed and read-only. {sel.result === "Clear" ? "The party may be activated." : "The party stays inactive until a reviewer decides the hit."} A re-screen starts a new checklist.</p>}
                {hit && <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">Hit <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/configuration/denied-party/review?hit=${hit.id}`}>{hit.id}</Link> is in the review queue ({hit.state.toLowerCase()}).</p>}
                <ol className="flex flex-col gap-2">
                  {sel.items.map((i, n) => (
                    <li key={i.id} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
                      <span className="mt-0.5 w-5 text-sm tabular text-muted-foreground">{n + 1}</span>
                      <div className="min-w-[220px] flex-1">
                        <p className="text-sm">{i.text}</p>
                        <p className="text-xs text-muted-foreground">{i.state === "Open" ? "Open" : `${i.state}${i.by ? ` · ${userName(i.by)}` : ""}${i.on ? ` · ${fmtDate(i.on)}` : ""}`}{i.note ? ` · ${i.note}` : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        {i.state !== "Done" && <Button size="sm" variant="outline" disabled={locked} onClick={() => view.run(() => setChecklistItem(sel.id, i.id, "Done", ""))}>Mark done</Button>}
                        {i.state === "Open" && <Button size="sm" variant="ghost" disabled={locked} onClick={() => { setWhy(""); setDlg({ na: i }) }}>Not applicable</Button>}
                        {i.state !== "Open" && <Button size="sm" variant="ghost" disabled={locked} onClick={() => view.run(() => setChecklistItem(sel.id, i.id, "Open", ""))}>Reopen</Button>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) },
            { id: "all", label: "All checklists", count: lists.length, content: (
              <ul className="flex flex-col gap-1 text-sm">
                {lists.map((c) => <li key={c.id}><button className="text-link underline-offset-4 hover:underline" onClick={() => choose(c.id)}><span className="font-mono">{c.id}</span> {c.partyName}</button> <span className="text-xs text-muted-foreground">{c.partyType} · {c.result ?? `${done(c)} of ${c.items.length} steps`}</span></li>)}
              </ul>
            ) },
          ]}
        />
      )}
      <div className="mt-4"><RulesPanel rules={[["C§5-a", "Interim: a person screens each new customer and vendor against the consolidated lists before activation", "DOC: Book III C §5"], ["C§5-b", "A potential match is reviewed by a second person; the party stays inactive until decided", "DOC: Book III C §5"], ["C§5-c", "An automated screening service replaces this checklist when selected (open item)", "DOC: Book III C §5"]]} /></div>
      <DialogShell open={dlg === "start"} onOpenChange={(o) => !o && setDlg(null)} title="Start a screening checklist" consequence="Opens a six-step checklist for the party. The party stays inactive until the checklist is clear." confirmLabel="Start" onConfirm={() => { const e = view.run(() => startChecklist(party.type, party.id)); if (!e) setDlg(null); return e }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="dp-type" label="Party type"><SimpleSelect id="dp-type" value={party.type} onChange={(v) => setParty({ type: v as "Customer" | "Vendor", id: "" })} options={[{ value: "Customer", label: "Customer" }, { value: "Vendor", label: "Vendor" }]} /></Field>
          <Field id="dp-party" label="Party"><SimpleSelect id="dp-party" value={party.id} onChange={(v) => setParty({ ...party, id: v })} options={partyOptions} placeholder="Choose a party" /></Field>
        </div>
      </DialogShell>
      <DialogShell open={typeof dlg === "object" && !!dlg && "na" in dlg} onOpenChange={(o) => !o && setDlg(null)} title="Step does not apply" consequence="Marks the step Not applicable with your reason on the record." confirmLabel="Save" onConfirm={() => { if (!sel || typeof dlg !== "object" || !dlg || !("na" in dlg)) return null; const e = view.run(() => setChecklistItem(sel.id, dlg.na.id, "Not applicable", why)); if (!e) setDlg(null); return e }}>
        <Field id="dp-why" label="Why it does not apply"><Input id="dp-why" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      </DialogShell>
      <DialogShell open={dlg === "complete"} onOpenChange={(o) => !o && setDlg(null)} title="Record the screening result" consequence={result === "Clear" ? "The party may be activated." : "Sends a hit to the review queue; the party stays inactive until a reviewer decides."} confirmLabel="Record result" onConfirm={() => { if (!sel) return null; const e = view.run(() => completeChecklist(sel.id, result)); if (!e) setDlg(null); return e }}>
        <Field id="dp-res" label="Result"><SimpleSelect id="dp-res" value={result} onChange={(v) => setResult(v as typeof result)} options={[{ value: "Clear", label: "Clear: no match found" }, { value: "Potential match", label: "Potential match: needs review" }, { value: "Confirmed match", label: "Confirmed match" }]} /></Field>
      </DialogShell>
    </StateFrame>
  )
}
