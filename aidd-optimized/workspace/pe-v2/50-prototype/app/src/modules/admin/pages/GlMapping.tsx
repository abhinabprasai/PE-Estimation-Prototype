// FX-CFG-GLMAP GL account mapping [DOC: Book I §2.4; Book II §2.6]: 22 new accounts proposed by the specification,
// each tied to a stable mapping key that posting rules read. The Controller confirms or remaps each once; a remap changes the
// account number, never the key, so no posting rule changes. Account number ranges are checked against the account type.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, RulesPanel } from "@/components/patterns"
import { DialogShell, WorkbenchPage } from "@/components/templates"
import { useSearchParams } from "react-router"
import { useCore, useSlice } from "@/store"
import { confirmGl, remapGl } from "../data/cfg-actions"
import type { GlAccount } from "../data/cfg-types"
import { can, glRangeNote } from "../lib/cfg"
import { fmtDateTime } from "../lib/time"
import { Field, StateText, userName } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

type Q = "Proposed" | "Confirmed" | "Remapped" | "all"

export function GlMapping() {
  const [params, setParams] = useSearchParams()
  const s = useSlice("adminCfg")
  const { role } = useCore()
  const view = useView("FX-CFG-GLMAP")
  const [q, setQ] = useState<Q>("Proposed")
  const [remap, setRemap] = useState<GlAccount | null>(null)
  const [acct, setAcct] = useState("")
  const keyParam = params.get("key")
  const active = s.gl.find((g) => g.key === keyParam)
  const rows = (view.empty ? [] : s.gl).filter((g) => q === "all" || g.status === q)
  const allowed = can.gl(role) && !view.writeError()
  const count = (st: Q) => s.gl.filter((g) => st === "all" || g.status === st).length
  const setKey = (k?: string) => { const n = new URLSearchParams(params); if (k) n.set("key", k); else n.delete("key"); setParams(n, { replace: true }) }
  return (
    <StateFrame view={view} cols={7} emptyTitle="No accounts to map." emptyBody="The 22 accounts come from the specification; Scenario reset restores them." degraded="Degraded: the chart of accounts sync is delayed. Mapping keys are unaffected." subject="GL mapping">
      <WorkbenchPage<GlAccount>
        header={{
          title: "GL account mapping",
          screenId: "FX-CFG-GLMAP",
          description: "The 22 new accounts the specification proposes, each behind a stable mapping key. The Controller confirms an account or remaps it once; posting rules read the key.",
          chips: <Chip kind="design" note="Route /configuration/gl-mapping is a design value; the account list is Book I §2.4 and Book II §2.6">Design route</Chip>,
          actions: <StatePicker view={view} />,
        }}
        kpis={[{ label: "Proposed", value: count("Proposed"), hint: "waiting for the Controller" }, { label: "Confirmed", value: count("Confirmed") }, { label: "Remapped", value: count("Remapped") }, { label: "Total new accounts", value: count("all") }]}
        queues={(["Proposed", "Confirmed", "Remapped", "all"] as Q[]).map((x) => ({ id: x, label: x === "all" ? "All" : x, count: count(x) }))}
        queue={q}
        onQueueChange={(x) => setQ(x as Q)}
        bulkActions={(sel, clear) => <Button size="sm" disabled={!allowed} title={can.gl(role) ? undefined : "The Controller confirms GL accounts"} onClick={() => { if (!view.run(() => confirmGl(sel))) clear() }}>Confirm selected as proposed</Button>}
        table={{
          rows,
          rowId: (g) => g.key,
          loading: view.loading,
          selectable: allowed,
          onRowClick: (g) => setKey(g.key),
          activeId: active?.key,
          caption: "GL account mapping",
          densityKey: "FX-CFG-GLMAP",
          searchText: (g) => `${g.key} ${g.account} ${g.name} ${g.usedBy}`,
          searchPlaceholder: "Search accounts",
          initialSort: { id: "acct", dir: "asc" },
          columns: [
            { id: "acct", header: "Account", value: (g) => g.account, mono: true, sortable: true },
            { id: "name", header: "Name", value: (g) => g.name, sortable: true },
            { id: "type", header: "Type", value: (g) => g.type, filterable: true },
            { id: "key", header: "Mapping key", value: (g) => g.key, mono: true },
            { id: "use", header: "Used by", value: (g) => g.usedBy, className: "max-w-[260px]" },
            { id: "book", header: "Source", value: (g) => g.book, filterable: true },
            { id: "st", header: "State", value: (g) => g.status, cell: (g) => <StateText tone={g.status === "Proposed" ? "attention" : "default"}>{g.status}{g.status === "Remapped" ? ` (was ${g.proposed})` : ""}</StateText> },
          ],
        }}
        panel={{
          open: !!active,
          onOpenChange: (o) => !o && setKey(),
          title: active ? `${active.account} ${active.name}` : "",
          description: active?.key,
          content: active && (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Type</dt><dd>{active.type}</dd></div>
                <div><dt className="text-xs text-muted-foreground">State</dt><dd>{active.status}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Used by</dt><dd>{active.usedBy}</dd></div>
              </dl>
              {glRangeNote(active.account, active.type) && <p role="status" className="rounded-md bg-muted px-3 py-2 text-xs">{glRangeNote(active.account, active.type)}</p>}
              <div className="flex gap-2">
                <Button disabled={!allowed || active.status !== "Proposed"} title={active.status !== "Proposed" ? "Already decided; remap to change it" : undefined} onClick={() => view.run(() => confirmGl([active.key]))}>Confirm {active.account}</Button>
                <Button variant="outline" disabled={!allowed} onClick={() => { setAcct(""); setRemap(active) }}>Remap</Button>
              </div>
              {!can.gl(role) && <p className="text-xs text-muted-foreground">Only the Controller confirms or remaps a GL account.</p>}
              <section aria-label="History"><h3 className="text-sm font-semibold">History</h3>
                <ul className="mt-1 flex flex-col gap-1 text-xs">{active.history.map((h, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDateTime(h.at)}</span> {h.what} · {h.by === "PRD seed" || h.by === "Scheduler" ? h.by : userName(h.by)}</li>)}</ul>
              </section>
            </div>
          ),
        }}
      />
      <div className="mt-4"><RulesPanel rules={[["§2.4", "Sixteen new accounts for RMA, rework, subcontract, warranty, variances and allocation clearing; the Controller confirms each", "DOC: Book I §2.4"], ["§2.6", "Six more for consignment, spare parts and E&O; 1311 is memo only and never in the trial balance", "DOC: Book II §2.6"], ["C-50", "Remap changes the number, not the mapping key, so no posting rule changes", "DOC:p.170"]]} /></div>
      <DialogShell open={!!remap} onOpenChange={(o) => !o && setRemap(null)} title={`Remap ${remap?.key ?? ""}`} consequence={remap ? `Points ${remap.key} at a different four-digit account. Postings after today use it; earlier postings keep ${remap.account}.` : undefined} requireReason reasonLabel="Why it is remapped (required)" confirmLabel="Remap" onConfirm={(n) => (remap ? view.run(() => remapGl(remap.key, Number(acct), n)) : null)}>
        <Field id="gl-new" label="New account number" hint={remap ? `Currently ${remap.account}` : undefined}><Input id="gl-new" inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value)} /></Field>
      </DialogShell>
    </StateFrame>
  )
}
