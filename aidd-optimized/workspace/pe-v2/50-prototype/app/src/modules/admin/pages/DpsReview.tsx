// FX-CFG-DPS-REVIEW Denied-party screening review queue [DOC: Book III C §5]: potential matches from the interim checklist or a
// later list run wait here. A second person takes a hit into review and decides: Cleared (false positive, with the basis) or
// Confirmed match (the party must be set to Blocked). Decisions are not edited afterwards. Reviewer = Controller (AR-40);
// the reviewer cannot be the person who ran part of the screening.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Chip, RulesPanel } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { decideHit, takeHit } from "../data/cfg-actions"
import type { DpsHit } from "../data/cfg-types"
import { can } from "../lib/cfg"
import { Field, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

type Q = "open" | "Cleared" | "Confirmed match" | "all"

export function DpsReview() {
  const [params, setParams] = useSearchParams()
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const view = useView("FX-CFG-DPS-REVIEW")
  const [q, setQ] = useState<Q>("open")
  const [dlg, setDlg] = useState<null | "Cleared" | "Confirmed match">(null)
  const [reason, setReason] = useState("")
  const active = s.dpsHits.find((h) => h.id === params.get("hit"))
  const all = view.empty ? [] : s.dpsHits
  const isOpen = (h: DpsHit) => h.state === "New" || h.state === "In review"
  const rows = all.filter((h) => (q === "all" ? true : q === "open" ? isOpen(h) : h.state === q))
  const allowed = can.dps(role) && !view.writeError()
  const setHit = (id?: string) => { const n = new URLSearchParams(params); if (id) n.set("hit", id); else n.delete("hit"); setParams(n, { replace: true }) }
  return (
    <StateFrame view={view} cols={7} emptyTitle="Nothing to review." emptyBody="Potential matches appear here after a screening run or an onboarding checklist." degraded="Degraded: the consolidated lists are one day old. Review continues on the data shown." subject="the review queue">
      <WorkbenchPage<DpsHit>
        header={{
          title: "Denied-party review queue",
          screenId: "FX-CFG-DPS-REVIEW",
          description: "Potential matches against the consolidated screening lists. A second person decides each: cleared with the basis recorded, or confirmed so the party is blocked.",
          chips: <Chip kind="design" note="Route /configuration/denied-party/review is a design value; match scores and list names are seed values (AR-40)">Design route</Chip>,
          actions: <StatePicker view={view} />,
        }}
        kpis={[{ label: "New", value: all.filter((h) => h.state === "New").length, hint: "not yet taken" }, { label: "In review", value: all.filter((h) => h.state === "In review").length }, { label: "Cleared", value: all.filter((h) => h.state === "Cleared").length }, { label: "Confirmed matches", value: all.filter((h) => h.state === "Confirmed match").length, hint: "parties blocked" }]}
        queues={[{ id: "open", label: "Open", count: all.filter(isOpen).length }, { id: "Cleared", label: "Cleared", count: all.filter((h) => h.state === "Cleared").length }, { id: "Confirmed match", label: "Confirmed", count: all.filter((h) => h.state === "Confirmed match").length }, { id: "all", label: "All", count: all.length }]}
        queue={q}
        onQueueChange={(x) => setQ(x as Q)}
        table={{
          rows,
          rowId: (h) => h.id,
          loading: view.loading,
          onRowClick: (h) => setHit(h.id),
          activeId: active?.id,
          caption: "Denied-party hits",
          densityKey: "FX-CFG-DPS-REVIEW",
          searchText: (h) => `${h.id} ${h.partyName} ${h.listedName} ${h.list}`,
          searchPlaceholder: "Search hits",
          empty: { title: q === "open" ? "No open hits." : "No hits in this view.", body: "Every hit is decided." },
          initialSort: { id: "score", dir: "desc" },
          columns: [
            { id: "id", header: "Hit", value: (h) => h.id, mono: true },
            { id: "p", header: "Party", value: (h) => h.partyName, cell: (h) => <span>{h.partyName}<span className="block text-xs text-muted-foreground">{h.partyType} {h.partyId}</span></span> },
            { id: "l", header: "Listed name", value: (h) => h.listedName, className: "max-w-[220px]", cell: (h) => <span>{h.listedName}<span className="block text-xs text-muted-foreground">{h.list}</span></span> },
            { id: "score", header: "Match score", value: (h) => h.score, align: "right", mono: true, sortable: true, cell: (h) => `${h.score}%` },
            { id: "run", header: "Screened", value: (h) => h.runOn, sortable: true, cell: (h) => fmtDate(h.runOn) },
            { id: "st", header: "State", value: (h) => h.state, filterable: true, cell: (h) => <StateText tone={isOpen(h) ? "attention" : "muted"}>{h.state}{h.reviewer ? ` · ${userName(h.reviewer)}` : ""}</StateText> },
          ],
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setHit(),
          title: active ? `${active.id} ${active.partyName}` : "",
          description: active ? `${active.partyType} ${active.partyId}` : undefined,
          content: active && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Our party</dt><dd>{active.partyName}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Listed party</dt><dd>{active.listedName}</dd></div>
                <div><dt className="text-xs text-muted-foreground">List</dt><dd>{active.list}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Match score</dt><dd className="tabular">{active.score}%</dd></div>
              </dl>
              {active.decision && <p className="rounded-md bg-muted px-3 py-2 text-sm"><strong>{active.state}</strong> on {active.decidedOn ? fmtDate(active.decidedOn) : ""}: {active.decision}</p>}
              {active.state === "Confirmed match" && <p role="status" className="text-sm">The party must be set to Blocked in the {active.partyType.toLowerCase()} master: <Link className="text-link underline-offset-4 hover:underline" to={active.partyType === "Customer" ? "/sales/customers" : "/purchasing/vendors"}>open the {active.partyType.toLowerCase()} list</Link>.</p>}
              {isOpen(active) && (
                <div className="flex flex-wrap gap-2">
                  {active.state === "New" && <Button disabled={!allowed} onClick={() => view.run(() => takeHit(active.id))}>Take into review</Button>}
                  {active.state === "In review" && <><Button disabled={!allowed} onClick={() => { setReason(""); setDlg("Cleared") }}>Clear as false positive</Button><Button variant="outline" disabled={!allowed} onClick={() => { setReason(""); setDlg("Confirmed match") }}>Confirm match</Button></>}
                </div>
              )}
              {isOpen(active) && !can.dps(role) && <p className="text-xs text-muted-foreground">Only the Controller reviews a hit (reading AR-40; the specification names no reviewer).</p>}
              <Link className="text-sm text-link underline-offset-4 hover:underline" to="/configuration/denied-party/onboarding">Open the onboarding checklist</Link>
            </div>
          ),
        }}
      />
      <div className="mt-4"><RulesPanel rules={[["C§5-a", "A potential match is reviewed by a second person before the party is activated", "DOC: Book III C §5"], ["C§5-b", "The decision and its basis are kept; a decision is not edited, the party is re-screened instead", "DOC: Book III C §5"]]} /></div>
      <DialogShell open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg === "Cleared" ? `Clear ${active?.id ?? ""}` : `Confirm match ${active?.id ?? ""}`} consequence={dlg === "Cleared" ? "Records a false positive; the party may be activated." : "Records a confirmed match; the party must then be set to Blocked."} destructive={dlg === "Confirmed match"} confirmLabel={dlg === "Cleared" ? "Clear hit" : "Confirm match"} onConfirm={() => { if (!active || !dlg) return null; const e = view.run(() => decideHit(active.id, dlg, reason)); if (!e) setDlg(null); return e }}>
        <Field id="dr-why" label="Basis for the decision" hint="Names, registration numbers and addresses compared. At least 20 characters."><Textarea id="dr-why" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </DialogShell>
    </StateFrame>
  )
}
