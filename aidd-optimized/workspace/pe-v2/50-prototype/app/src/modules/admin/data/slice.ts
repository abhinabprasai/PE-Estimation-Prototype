// admin slice: workflow definitions (WF-DEF), the admin engine queue for W.4 rows the shared engine
// has no kind for (R-1), delegations and the audit trail (WF-INBOX), job runs, interface messages
// and incidents (OPS-JOBS/INT), fiscal periods (INV-CONFIG-PERIOD), tax configuration
// (INV-CONFIG-TAX) and the core configuration set (CFG-CORE).
// The shared approval engine itself lives in the store core (src/store/core.ts, C-1).

import { defineSlice, store, type SearchHit } from "@/store"
import type { ApprovalRequestId, DocLink, DocRef, TemplateNo } from "@/data/domain"
import { LEGAL_ENTITIES } from "@/data/shared"
import { INTERFACES, W4 } from "./catalog"
import { NOW, seedAll } from "./seed"
import type { WfInstance } from "./types"

export type AdminState = ReturnType<typeof seedAll>

declare module "@/store/types" {
  interface SliceStates {
    admin: AdminState
  }
}

// Module-only events (augmentation; no other group consumes them yet - see README).
declare module "@/store/events" {
  interface DomainEvents {
    /** A request on the admin engine queue was decided (W.4 rows with no shared-engine kind). */
    "admin.workflowDecided": { requestId: ApprovalRequestId; wfId: string; subject: DocRef | { id: string; route: string }; outcome: "Approved" | "Rejected" | "Recalled"; by: string }
    /** A CFG-CORE setting got a new effective-dated version. */
    "admin.configChanged": { settingId: string; value: string; effectiveFrom: string }
  }
}

export function seed(): AdminState {
  return seedAll()
}

const entityName = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id
export const subjectRoute = (i: WfInstance) => ("ref" in i.subject ? undefined : i.subject.loose.route)

function search(s: AdminState): SearchHit[] {
  const out: SearchHit[] = []
  for (const i of s.instances)
    out.push({ group: "admin", title: i.id, subtitle: `${i.kindLabel} · ${"ref" in i.subject ? i.subject.ref.id : i.subject.loose.id} · ${i.outcome ?? "Pending"}`, route: `/approvals?req=${i.id}`, ref: { type: "approval", id: i.id } })
  for (const a of store.getCore().approvals)
    out.push({ group: "admin", title: a.id, subtitle: `${a.kind} · ${a.subject.id} · ${a.outcome ?? "Pending"}`, route: `/approvals?req=${a.id}`, ref: { type: "approval", id: a.id } })
  for (const w of W4) out.push({ group: "admin", title: `${w.id} ${w.workflow}`, subtitle: `Workflow definition · owner ${w.owner}`, route: `/configuration/workflows?wf=${w.id}` })
  for (const f of INTERFACES) out.push({ group: "admin", title: `${f.id} ${f.name}`, subtitle: `Interface · ${f.flow}`, route: `/operations/integrations?if=${f.id}` })
  for (const p of s.periods)
    out.push({ group: "admin", title: p.id, subtitle: `Fiscal period ${p.month} · ${entityName(p.entityId)} · ${p.status}`, route: `/configuration/periods?p=${p.id}`, status: { kind: "fiscalPeriod", value: p.status } })
  for (const r of s.runs) out.push({ group: "admin", title: r.id, subtitle: `Job run ${r.jobId} · ${r.state}`, route: `/operations/jobs?run=${r.id}` })
  return out
}

/** Approval request → the document it approves, for both engines (DocumentFlowPanel). */
function links(s: AdminState): DocLink[] {
  const out: DocLink[] = []
  for (const i of s.instances) if ("ref" in i.subject) out.push({ from: { type: "approval", id: i.id }, to: i.subject.ref, kind: "approves", note: i.kindLabel })
  for (const a of store.getCore().approvals) out.push({ from: { type: "approval", id: a.id }, to: a.subject, kind: "approves", note: a.kind })
  return out
}

export const adminSlice = defineSlice({
  key: "admin",
  seed,
  search,
  links,
  subscribe: (api) => {
    // Audit trail entries for requests raised on the shared engine (WF-INBOX history).
    api.on("approval.requested", ({ requestId }) =>
      api.mutate("admin", (d, ctx) => {
        d.audit.push({ at: NOW, requestId, action: "Raised", by: ctx.userId, role: ctx.role, channel: "In-app" })
      }),
    )
    // Postings made while a period is reopened are tagged Reopened Posting [DOC:p.42 §9.3 step 5].
    api.on("posting.posted", ({ template, amount, currency, source }) =>
      api.mutate("admin", (d) => {
        for (const p of d.periods)
          if (p.reopen && !p.reopen.closedAt)
            d.tagged.push({ at: NOW, periodId: p.id, template: typeof template === "number" ? `#${template as TemplateNo}` : String(template), amount, currency, source, tag: "Reopened Posting" })
      }),
    )
  },
})
