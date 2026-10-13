// FX-QM-SAMPLING Sampling state panel [DOC:p.33 §6.2; p.34 §6.4] (asserted).
// Where each plan stands in its sampling regime: AQL Normal / Tightened / Reduced, the recent
// decisions that drive the switch, skip-lot qualification per vendor, and the sample size for a
// lot. The same panel sits on the Sampling tab of each plan; this screen shows every plan together.

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Chip, DataTable, KV, RulesPanel, type Column } from "@/components/patterns"
import { THRESHOLDS } from "@/data/domain"
import { useRole, useSlice } from "@/store"
import { plans as act } from "../data/actions"
import { currentRev } from "../data/derive"
import { skipLotQualified } from "../data/intake"
import type { QtPlan } from "../data/types"
import { Reading, Section, Stat, report, vendorName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"
import { PLAN_RULES, SamplingPanel } from "./Plans"

const rows = (s: { plans: QtPlan[] }) => s.plans.filter((p) => p.revisions.some((r) => r.status === "Active") && p.type === "INC")

export function SamplingState() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-SAMPLING")
  const [role] = useRole()
  const list = rows(s)
  const [sel, setSel] = useState<string>(list.find((p) => currentRev(p).aql?.state !== "Normal")?.id ?? list[0]?.id ?? "")
  const plan = list.find((p) => p.id === sel)
  const cur = plan && currentRev(plan)
  const decided = (p: QtPlan) => s.lots.filter((l) => l.planId === p.id && l.decision && !l.skipped).length
  const streakOf = (p: QtPlan) => {
    const d = s.lots.filter((l) => l.planId === p.id && l.decision && !l.skipped).sort((a, b) => ((a.decidedOn ?? "") + a.id < (b.decidedOn ?? "") + b.id ? -1 : 1))
    let n = 0
    for (let i = d.length - 1; i >= 0 && d[i].decision === "Accepted"; i--) n++
    return n
  }
  const stateOf = (p: QtPlan) => {
    const r = currentRev(p)
    return r.sampling === "AQL Sampling" && r.aql ? r.aql.state : r.sampling === "Skip-Lot" ? "Skip-lot" : r.sampling
  }
  const cols: Column<QtPlan>[] = [
    { id: "id", header: "Plan", value: (p) => p.id, mono: true, sortable: true, cell: (p) => <Link className="text-link underline-offset-4 hover:underline" to={`/quality/inspection-plans/${p.id}`}>{p.id}</Link> },
    { id: "name", header: "Name", value: (p) => p.name },
    { id: "vendor", header: "Vendor", value: (p) => vendorName(p.vendorId), filterable: true },
    { id: "method", header: "Method", value: (p) => currentRev(p).sampling, filterable: true },
    { id: "state", header: "State", value: stateOf, filterable: true, cell: (p) => (stateOf(p) === "Tightened" ? <Chip kind="flag">Tightened</Chip> : stateOf(p)) },
    { id: "aql", header: "AQL / level", value: (p) => (currentRev(p).aql ? `${currentRev(p).aql!.value} / ${currentRev(p).aql!.level}` : "") },
    { id: "lots", header: "Decided lots", value: decided, align: "right", mono: true },
    { id: "run", header: "Accepted in a row", value: streakOf, align: "right", mono: true },
    { id: "elig", header: "Next step", value: (p) => (currentRev(p).aql?.reduceEligible ? "Reduced can be approved" : ""), cell: (p) => (currentRev(p).aql?.reduceEligible ? <Chip kind="flag">Reduced can be approved</Chip> : "") },
  ]
  const tight = list.filter((p) => currentRev(p).aql?.state === "Tightened").length
  const elig = list.filter((p) => currentRev(p).aql?.reduceEligible)
  const vendors = s.vendorLots
  return (
    <StateFrame
      ss={ss}
      title="Sampling state"
      screenId="FX-QM-SAMPLING"
      entity="sampling states"
      allowed="Quality engineer or Quality Manager"
      validation={["Enter a lot size greater than zero.", "Reduced inspection needs 10 consecutive lots accepted."]}
      conflict={{ what: "the sampling state of IP-INC-0007", mine: "Approve Reduced inspection", theirs: "A lot was rejected an hour ago; the plan is back at Normal" }}
      degraded="Lot decisions from the last hour may not be counted yet; switching is re-evaluated after every decision."
      header={{
        title: "Sampling state",
        screenId: "FX-QM-SAMPLING",
        crumbs: [{ label: "Inspection Plans", to: "/quality/inspection-plans" }, { label: "Sampling state" }],
        description: "Normal, Tightened or Reduced inspection per incoming plan, the decisions that move it, and skip-lot qualification per vendor. Switching runs after every incoming decision.",
        chips: <Reading id="QT-R25" />,
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Stat label="Incoming plans in use" value={list.length} />
          <Stat label="Tightened" value={tight} tone={tight ? "attention" : undefined} />
          <Stat label="Reduced can be approved" value={elig.length} />
          <Stat label="Vendors skip-lot qualified" value={vendors.filter((v) => skipLotQualified(v).qualified).length} />
        </div>
        {elig.length > 0 && (
          <Section title="Waiting for the Quality Manager">
            <ul className="flex flex-col gap-2 text-sm">
              {elig.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular font-medium">{p.id}</span> {p.name}: {THRESHOLDS.inspectionReduceAfterAccepted} consecutive lots accepted.
                  <Button size="sm" disabled={role !== "Quality Manager"} title={role === "Quality Manager" ? undefined : `The Quality Manager approves (acting as ${role})`} onClick={() => report(act.approveReduced(p.id), `${p.id} moves to Reduced inspection`)}>
                    Approve Reduced
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <DataTable rows={list} columns={cols} rowId={(p) => p.id} onRowClick={(p) => setSel(p.id)} activeId={sel} densityKey="QM-SMP" searchText={(p) => `${p.id} ${p.name} ${vendorName(p.vendorId)}`} empty={{ title: "No incoming plans in use", body: "Plans with AQL, skip-lot or fixed sampling appear here once active." }} />
        {plan && cur && (
          <Section title={`${plan.id}: ${plan.name}`}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KV k="Revision">{cur.rev}</KV>
              <KV k="Method">{cur.sampling}</KV>
              <KV k="State">{stateOf(plan)}</KV>
              <KV k="Switching">{cur.aql ? (cur.aql.switching ? "On" : "Off") : "Not AQL"}</KV>
            </dl>
            <SamplingPanel plan={plan} />
          </Section>
        )}
        <Section title="Vendor rating and skip-lot qualification">
          <p className="text-sm text-muted-foreground">Qualified: rating at least 98% and at least {THRESHOLDS.inspectionReduceAfterAccepted} consecutive lots accepted. A rejection or an NCR revokes it.</p>
          <DataTable
            rows={vendors}
            columns={[
              { id: "v", header: "Vendor", value: (v) => vendorName(v.vendorId), sortable: true },
              { id: "lots", header: "Lots (90 days)", value: (v) => v.lots, align: "right", mono: true },
              { id: "acc", header: "Accepted", value: (v) => v.accepted, align: "right", mono: true },
              { id: "rating", header: "Rating", value: (v) => skipLotQualified(v).rating, align: "right", mono: true, cell: (v) => `${(skipLotQualified(v).rating * 100).toFixed(1)}%` },
              { id: "streak", header: "In a row", value: (v) => skipLotQualified(v).streak, align: "right", mono: true },
              { id: "q", header: "Skip-lot", value: (v) => (skipLotQualified(v).qualified ? "Qualified" : "Not qualified"), filterable: true },
            ]}
            rowId={(v) => v.vendorId}
            empty={{ title: "No vendor lots yet" }}
          />
        </Section>
        <RulesPanel rules={PLAN_RULES.filter((r) => ["QM-P4", "QM-P8"].includes(r[0]))} />
      </div>
    </StateFrame>
  )
}
