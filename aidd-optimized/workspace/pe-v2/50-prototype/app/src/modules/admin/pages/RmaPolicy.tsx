// FX-CFG-RMAPOLICY RMA policy configuration [DOC:pp.26-27 Book I A §3.10]: "RMA Policy Matrix (Configuration)": approval
// routing by class, value and warranty; restocking fee defaults by reason; receipt-to-inspection SLA 5 business days;
// reopen window 30 days after Closed (Controller only); no-reference credit basis list price less 20% (config).
// Every change is a new dated version approved by the policy owner (AR-15); posting-gating fees add the Controller.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { TODAY } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { proposeRestock } from "../data/cfg-actions"
import type { RmaReason } from "../data/cfg-types"
import { inForce, nextOf, verState } from "../lib/cfg"
import { Field, StateText } from "../components/common"
import { SettingsTable } from "../components/SettingsTable"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

const MATRIX: [string, string, string][] = [
  ["RC1 / RC2, expected credit up to $10,000", "Customer Service Manager", "Single step"],
  ["Any RC3, or any warranty claim", "Customer Service Manager, then Quality Manager", "Two sequential steps"],
  ["Expected credit above $50,000", "+ Controller", "Appended step"],
  ["Goodwill replacement (out of warranty)", "+ Controller, any value", "Posts to COGS without revenue"],
]

export function RmaPolicy() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "matrix"
  const view = useView("FX-CFG-RMAPOLICY")
  return (
    <ConfigPage
      header={{
        title: "RMA policy",
        screenId: "FX-CFG-RMAPOLICY",
        description: "The policy matrix the RMA module reads: who approves a return, the restocking fee by reason, the inspection SLA and the reopen window.",
        chips: <Chip kind="design" note="Route /configuration/rma-policy is a design value; the matrix is Book I A §3.10">Design route</Chip>,
        actions: <StatePicker view={view} />,
      }}
      sections={[{ id: "matrix", label: "Approval matrix" }, { id: "restocking", label: "Restocking defaults" }, { id: "sla", label: "SLA and reopen window" }, { id: "noref", label: "No-reference returns" }]}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      <StateFrame view={view} cols={5} emptyTitle="No policy rows." emptyBody="The RMA policy ships with the specification defaults; Scenario reset restores them." degraded="Degraded: the approval engine is slow. Changes still save and are routed when it recovers.">
        {section === "matrix" && (
          <div className="flex flex-col gap-2">
            <DataTable
              rows={MATRIX}
              rowId={(m) => m[0]}
              densityKey="FX-CFG-RMAPOLICY-matrix"
              caption="RMA approval matrix"
              columns={[{ id: "c", header: "Case", value: (m) => m[0] }, { id: "a", header: "Approval", value: (m) => m[1] }, { id: "n", header: "Note", value: (m) => m[2] }]}
            />
            <p className="max-w-3xl text-sm">The matrix runs as workflow WF-07 on the approvals queue. Its steps, conditions and SLAs are versioned in <Link className="text-link underline-offset-4 hover:underline" to="/configuration/workflows?wf=WF-07">the workflow definition</Link>; a change there follows the same effective-dating.</p>
          </div>
        )}
        {section === "restocking" && <Restocking view={view} />}
        {section === "sla" && <SettingsTable ids={["SET-RMA-INSP", "SET-RMA-REOPEN"]} view={view} caption="RMA SLA and reopen" densityKey="FX-CFG-RMAPOLICY-sla" />}
        {section === "noref" && (
          <div className="flex flex-col gap-2">
            <SettingsTable ids={["SET-RMA-NOREF", "SET-RMA-RESTOCK"]} view={view} caption="No-reference returns" densityKey="FX-CFG-RMAPOLICY-noref" />
            <p className="max-w-3xl text-sm">A return without a reference document needs Customer Service Manager approval regardless of value. Controller approval is mandatory for any credit, and a serial unknown to the system is flagged Unverified Serial with warranty Denied as Unauthorized Return [DOC:p.26 §3.9].</p>
          </div>
        )}
      </StateFrame>
      <RulesPanel
        rules={[
          ["§3.10-a", "RC1/RC2 up to $10,000: Customer Service Manager. Any RC3 or warranty claim: + Quality Manager. Credit above $50,000: + Controller. Goodwill replacement: + Controller at any value", "DOC:p.27 §3.10"],
          ["§3.10-b", "Restocking fee defaults: Customer Convenience 15%, Wrong Item Ordered 10%, else 0%; editable per RMA within role limits", "DOC:p.27 §3.10"],
          ["§3.10-c", "Receipt-to-inspection SLA 5 business days, breach alerts to the Quality Manager; reopen window 30 days after Closed, Controller only", "DOC:p.27 §3.10"],
          ["§3.9", "No Reference: credit basis falls back to the current price list less 20% (config); Controller approval is mandatory for any credit", "DOC:p.27 §3.9"],
        ]}
      />
    </ConfigPage>
  )
}

function Restocking({ view }: { view: View }) {
  const c = useSlice("adminCfg")
  const a = useSlice("admin")
  const [edit, setEdit] = useState<RmaReason | null>(null)
  const [pct, setPct] = useState("")
  const [from, setFrom] = useState(addDays(TODAY, 23))
  return (
    <>
      <DataTable<RmaReason>
        rows={view.empty ? [] : c.rmaReasons}
        rowId={(r) => r.id}
        loading={view.loading}
        densityKey="FX-CFG-RMAPOLICY-restock"
        caption="Restocking fee defaults by reason"
        columns={[
          { id: "r", header: "Reason code", value: (r) => r.reason, sortable: true },
          { id: "p", header: "Restocking fee", value: (r) => inForce(r.versions, a.instances)?.value.restockPct ?? 0, align: "right", mono: true, sortable: true, cell: (r) => `${inForce(r.versions, a.instances)?.value.restockPct}%` },
          { id: "n", header: "Next version", value: (r) => nextOf(r.versions, a.instances)?.value.restockPct ?? "", cell: (r) => { const n = nextOf(r.versions, a.instances); return n ? <span className="text-xs">{n.value.restockPct}% from {fmtDate(n.effectiveFrom)} · <StateText tone="attention">{verState(n, r.versions, a.instances)}</StateText>{n.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${n.requestId}`}>{n.requestId}</Link></>}</span> : "" } },
          { id: "f", header: "Freight paid by", value: (r) => r.freightPaidBy, filterable: true },
          { id: "s", header: "Source", value: (r) => r.source, cell: (r) => (r.source === "PRD" ? <span className="text-xs">PRD §3.1, §3.10</span> : <Chip kind="design">Freight payer</Chip>) },
          { id: "act", header: "", cell: (r) => <Button size="sm" variant="outline" disabled={!!nextOf(r.versions, a.instances) && verState(nextOf(r.versions, a.instances)!, r.versions, a.instances) === "Pending approval"} onClick={() => setEdit(r)}>Propose change</Button> },
        ]}
      />
      <p className="mt-2 max-w-3xl text-xs text-muted-foreground">The specification says the reason "drives restocking fee default and who pays freight" but gives the freight rule only in outline; the payer column is a design value (AR-41). The fee posts to 4910 on credit, so the Controller joins the approval.</p>
      <DialogShell
        open={!!edit}
        onOpenChange={(o) => { if (!o) { setPct(""); setEdit(null) } }}
        title={`Propose change: restocking fee for ${edit?.reason ?? ""}`}
        consequence={edit ? `Creates a new version (${pct || "new"}% from ${from}) and sends it to the Customer Service Manager, then the Controller. RMAs already created keep their fee.` : undefined}
        requireReason
        reasonLabel="Why it changes (required)"
        confirmLabel="Send for approval"
        onConfirm={(note) => view.run(() => proposeRestock(edit!.id, Number(pct), from, note))}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field id="rs-pct" label="New fee (%)" hint={edit ? `In force: ${inForce(edit.versions, a.instances)?.value.restockPct}%` : undefined}><Input id="rs-pct" type="number" min={0} max={50} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          <Field id="rs-from" label="Effective from"><Input id="rs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        </div>
      </DialogShell>
    </>
  )
}
