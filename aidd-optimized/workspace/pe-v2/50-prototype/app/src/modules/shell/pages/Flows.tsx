// FX-FLW-INDEX (/flows, /flows/:id) and FX-FLW-VALIDATION (/flows/validation).
// Flow steps are taken from the as-is flow models 40-models/as-is/FL-*.md (asserted) and wired to the
// registry routes, so a walkthrough clicks through the real screens. Progress is kept in the shell slice.
import { useMemo } from "react"
import { Link, useParams } from "react-router"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Chip, FamilyBadge, StatusBadge } from "@/components/patterns"
import { DetailPage } from "@/components/templates"
import { TRACE_EVENTS, type TraceEventCode } from "@/data/domain"
import { GROUPS } from "@/data/modules"
import { SCREENS, type Built } from "@/data/screens"
import { useModules } from "@/app/modules-context"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { shellActions } from "../data/actions"
import type { ValidationItem } from "../data/seed"
import { Panel } from "../kit"

interface Step {
  title: string
  role: string
  route: string
  screen: string
  change: string
  kiosk?: boolean
  scan?: string
  posting?: string
}
interface Flow {
  id: string
  letter: string
  name: string
  fl: string
  priority: string
  summary: string
  steps: Step[]
  hero?: string
}
const S = (title: string, role: string, route: string, screen: string, change: string, extra: Partial<Step> = {}): Step => ({ title, role, route, screen, change, ...extra })

const T = Object.entries(TRACE_EVENTS) as [TraceEventCode, (typeof TRACE_EVENTS)[TraceEventCode]][]
const TRACE_ROUTE: Record<string, string> = { T01: "/purchasing/orders", T02: "/inventory/batches", T03: "/quality/inspections", T04: "/inventory/batches", T05: "/production/terminal", T06: "/production/terminal", T07: "/production/terminal", T08: "/quality/final-test", T09: "/production/receipts", T10: "/sales/packing", T11: "/sales/deliveries", T12: "/sales/rma", T13: "/quality/recalls" }

export const FLOWS: Flow[] = [
  {
    id: "a", letter: "A", name: "Sales order to delivery", fl: "FL-01 / FL-09", priority: "High", hero: "SO-2026-00377", summary: "Confirm schedule lines, peg supply, work backorders, create deliveries, pick, pack, inspect, load, post goods issue and record proof of delivery.",
    steps: [
      S("Confirm each schedule line", "System on order confirm", "/sales/orders/SO-2026-00377", "OM-SO-001/2", "Schedule line Open to Confirmed"),
      S("Peg or allocate supply", "System", "/sales/orders/SO-2026-00377", "OM-SO-001/2", "Confirmed to Allocated/Pegged"),
      S("Work backorders and re-promise", "Sales Director approves reallocation", "/sales/backorders", "OM-BO-001", "Backorder flag when Confirmed is below Requested"),
      S("Run delivery creation", "Shipping", "/sales/deliveries", "OM-DLV-001", "Schedule line to Delivery Due; delivery Planned"),
      S("Release to warehouse and pick", "Warehouse", "/sales/deliveries", "OM-DLV-001", "Planned, Released, Picking", { scan: "SP-15" }),
      S("Pack into handling units", "Packers", "/sales/packing", "OM-PACK-*", "Delivery Packed; HU Open to Closed", { kiosk: true, scan: "SP-16, SP-17", posting: "#27" }),
      S("Pre-shipment inspection", "Quality", "/quality/inspections", "QM-EXEC", "Packed to Quality Cleared"),
      S("Plan the load and load the truck", "Shipping", "/sales/deliveries", "OM-DLV-001", "Loaded; HU Loaded", { scan: "SP-18" }),
      S("Post goods issue when green", "Shipping", "/sales/deliveries", "OM-DLV-001", "Loaded to PGI; expected POD row", { posting: "#25, #26" }),
      S("Record proof of delivery", "Shipping office", "/sales/pod", "OM-POD-001", "POD Expected to Received or Exception"),
      S("Resolve a claim", "Customer service", "/sales/pod", "OM-POD-001", "POD Exception to Resolved/Closed"),
    ],
  },
  {
    id: "b", letter: "B", name: "Engineering to procurement", fl: "FL-10", priority: "High", hero: "ER-TBD-0377", summary: "From an engineering request through placeholders, long-lead release, supplier technical package, RFQ, PO and receipt with provenance.",
    steps: [
      S("Trigger: ETO order, ECO, obsolescence, NCR or make/buy review", "System", "/engineering/requests", "ENG-REQ-001", "Engineering request created"),
      S("Preliminary design with placeholders", "Engineering", "/engineering/boms", "ENG-BOM-002", "Release level Preliminary; placeholder MCRs open"),
      S("Create the material", "MCR task owners", "/materials/creation-requests", "MM-MCR-001/2", "MCR to Active material"),
      S("Decide make or buy and source strategy", "Not named", "/purchasing/source-lists", "MM-SL-001", "Decision recorded"),
      S("Decide a long-lead release", "Engineering Manager, Purchasing Manager; Controller above $100k or High risk", "/purchasing/long-lead", "LLR-001", "LLR approved"),
      S("Build the supplier technical package", "Not named", "/purchasing/stp", "FX-PUR-STP", "STP version created, immutable, checksummed"),
      S("Determine the source", "Buyer", "/purchasing/vendors", "PUR-VEND-001/2", "Eligible source and reason"),
      S("Run RFQ and technical bid", "Buyer; Engineering for technical pass", "/purchasing/rfqs", "PUR-PR/RFQ", "RFQ to Awarded"),
      S("Approve PR and budget", "Approvers", "/approvals", "WF-INBOX", "PR to Approved"),
      S("Create and release the PO", "Buyer", "/purchasing/orders", "PUR-PO-001/2", "Released revision; transmission record"),
      S("Capture supplier acknowledgement", "Buyer", "/purchasing/orders", "PUR-PO-001/2", "Line Acknowledged, Exception or Rejected"),
      S("Handle engineering change", "Engineering, Buyer", "/engineering/change-requests", "ENG-ECR/ECO", "Per-line disposition before effectivity"),
      S("Receive with provenance", "Receiving", "/inventory/batches", "Batch master", "Traceability starts", { scan: "SP-01, SP-02, SP-03" }),
      S("Inspect against the STP", "Quality", "/quality/inspections", "QM-EXEC", "Accept, conditional, reject, RTV, NCR or SCAR"),
      S("Release to production", "System", "/inventory/batches", "Batch master", "Stock to Unrestricted with lineage"),
      S("Close", "Buyer, Engineering", "/purchasing/long-lead", "LLR-001", "LLR closed"),
    ],
  },
  {
    id: "c", letter: "C", name: "Plan to produce, including the kiosk", fl: "FL-04", priority: "High", hero: "WO-TBD-0377-1", summary: "MRP and exceptions, planned orders, release, dispatch, the shop-floor kiosk, checkpoints and final test, rework, receipt, settlement and WIP.",
    steps: [
      S("Run MRP and work the exceptions", "Planner", "/production/mrp", "PP-MRP-001", "Proposal set published with a run id"),
      S("Firm and convert planned orders", "Planner", "/production/planned-orders", "PLO-001", "Planned order to production order draft or PR"),
      S("Release the production order", "Production Scheduler", "/production/orders", "PP-WO-001/2", "Created to Released; serial generated"),
      S("Sequence work at each work center", "Not named", "/production/dispatch", "PP-DSP-001", "Dispatch queue updated"),
      S("Badge in, start, issue material, install child serials", "Operator", "/production/terminal", "PP-SFT-001", "Released to In Progress", { kiosk: true, scan: "SP-07, SP-08, SP-10, SP-12", posting: "#28" }),
      S("Complete the operation with quantities", "Operator", "/production/terminal", "PP-SFT-001", "Confirmation posted", { kiosk: true, scan: "SP-11" }),
      S("Inspect at checkpoints and final test", "Not named", "/quality/final-test", "QM-FIN-001", "In Progress to Testing", { scan: "SP-14" }),
      S("Rework when needed", "Not named", "/production/rework", "RWO-001", "Open, In Progress, Completed, Settled"),
      S("Receive finished goods", "System", "/production/receipts", "PP-SFT-001", "Testing to Completed"),
      S("Settle", "Not named, approval at close", "/production/settlement", "PP-SETTLE-001", "Completed to Closed (TECO)"),
      S("Reconcile WIP", "Not named", "/production/wip", "PP-WIP-001", "No status change"),
    ],
  },
  {
    id: "d", letter: "D", name: "Procure to pay", fl: "FL-03", priority: "Medium", hero: "PO-TBD-0377", summary: "Requisition, source, RFQ, PO approval, send and confirm, receive, inspect, match and pay.",
    steps: [
      S("Raise a requisition", "Planner or requester", "/purchasing/requisitions", "PUR-PR/RFQ", "PR Open to In Approval to Approved"),
      S("Resolve the source", "Buyer", "/purchasing/vendors", "PUR-VEND-001/2", "Vendor must be Active"),
      S("Run an RFQ where policy demands", "Buyer", "/purchasing/rfqs", "PUR-PR/RFQ", "RFQ Draft, Issued, Responses In, Awarded"),
      S("Group PRs into a PO and approve it", "Buyer, approvers", "/purchasing/orders", "PUR-PO-001/2", "PO Draft to In Approval to Approved", { posting: "approval ladder" }),
      S("Send the PO and capture vendor confirmation", "Buyer", "/purchasing/orders", "PUR-PO-001/2", "Approved, Sent, Confirmed"),
      S("Receive goods", "Receiving", "/inventory/batches", "Batch master", "Partially Received or Received; stock to QI Hold", { scan: "SP-01 to SP-04" }),
      S("Inspect incoming goods", "Not named", "/quality/inspections", "QM-EXEC", "QI Hold to released or rejected", { scan: "SP-05" }),
      S("Match the vendor invoice", "AP", "/purchasing/orders", "PUR-PO-001/2", "PO to Matched/Closed (accounting spec outside this build)"),
    ],
  },
  {
    id: "e", letter: "E", name: "End-to-end traceability", fl: "FL-11", priority: "Medium", hero: "SN-TBD-20M-0301", summary: "The thirteen traceability events from supplier source to recall, walked on the hero unit.",
    steps: T.map(([code, e]) => S(`${code} ${e.name}`, "System, append-only", TRACE_ROUTE[code], "TRC-EXPL", e.capturedAt, { scan: e.evidence.length > 40 ? undefined : undefined })),
  },
  {
    id: "f", letter: "F", name: "RMA and warranty", fl: "FL-05", priority: "Medium", hero: "RMA-TBD-0012", summary: "Create, approve, issue return instructions, receive, inspect, disposition, settle and close.",
    steps: [
      S("Create the RMA from invoice, sales order or serial", "Customer service", "/sales/rma", "RMA-LIST/CREATE", "RMA Draft"),
      S("Submit and approve", "CS Manager; Quality Manager (RC3); Controller", "/approvals", "WF-INBOX", "Draft, Pending Approval, Authorized or Rejected"),
      S("Issue return instructions with barcode", "Customer service", "/print/return-instructions", "FX-PRN-RETURN", "RMA Authorized"),
      S("Receive the return", "Receiving", "/sales/rma/receipt", "RMA-RECEIPT", "Partially Received or Received; serial Returned", { kiosk: true, scan: "SP-19", posting: "#17" }),
      S("Inspect each line", "Quality", "/sales/rma", "RMA-DISP", "Received to In Inspection"),
      S("Propose and approve disposition; adjudicate warranty", "Inspector proposes", "/sales/rma", "RMA-DISP", "In Inspection, Disposition Pending, Settling", { posting: "#18 to #23" }),
      S("Execute settlement documents", "System, Finance", "/production/rework", "RWO-001", "Credit memo, replacement, rework or scrap created"),
      S("Close", "System", "/sales/rma", "RMA-LIST/CREATE", "Settling to Closed"),
    ],
  },
  {
    id: "g", letter: "G", name: "ETO quote to cash", fl: "FL-02", priority: "High", hero: "SO-2026-00301", summary: "Leads with a prior-build search, then the quote datasheet, the sales order milestone strip, the engineering request, the transmittal approval loop and the milestone invoice request.",
    steps: [
      S("Search for a prior build", "Estimator", "/search?q=20 MVA", "FX-SHL-SEARCH", "Find FIN-TBD-20MVA and its earlier orders"),
      S("Issue the quote with the datasheet", "Sales", "/print/quote", "FX-PRN-QUOTE", "Quote Draft, Internal Review, Issued, Won"),
      S("Confirm the sales order and read the milestone strip", "Sales", "/components/milestone-strip", "FX-CMP-MILESTONE", "Sales order Draft, Submitted, Confirmed"),
      S("Engineering request created and designed", "Engineering", "/engineering/requests", "ENG-REQ-001", "Open, In Design"),
      S("Send drawings: the transmittal approval loop", "Engineering", "/engineering/transmittals", "TR-001", "In Design, Customer Review, Released"),
      S("Milestone invoice request", "Finance", "/sales/billing-plan", "FX-OM-BILLPLAN", "Milestone invoiced after evidence review", { posting: "#37" }),
    ],
  },
  {
    id: "portal", letter: "P", name: "Portal walkthrough", fl: "Target state", priority: "Low", summary: "Supplier and customer portals (phased). Separate identity tenant; internal and external identities never share a namespace.",
    steps: [
      S("Invitation and external sign-in", "Vendor or customer", "/target/portals", "FX-PTL-SHELL", "External account activated"),
      S("Supplier acknowledges a PO", "Vendor", "/target/portals/supplier/orders", "FX-PTL-SUP-PO", "Line Acknowledged"),
      S("Supplier creates an ASN", "Vendor", "/target/portals/supplier/asn", "FX-PTL-SUP-ASN", "ASN sent"),
      S("Customer approves drawings with markup", "Customer", "/target/portals/customer/drawings", "FX-PTL-CUS-DRAWINGS", "Customer Review to Released"),
      S("Customer tracks a shipment and receives the dossier", "Customer", "/target/portals/customer/shipments", "FX-PTL-CUS-SHIP", "e-POD recorded"),
      S("Customer requests a return", "Customer", "/target/portals/customer/returns", "FX-PTL-CUS-RETURNS", "RMA Draft"),
    ],
  },
  {
    id: "field", letter: "S", name: "Field-service walkthrough", fl: "Target state", priority: "Low", summary: "Service contracts, the technician's mobile execution set and van stock replenishment (phased).",
    steps: [
      S("Service contract and technician resources", "Service manager", "/target/field-service/contracts", "FX-FSM-CONTRACTS", "Contract active"),
      S("Technician executes a job on the mobile set", "Technician", "/target/field-service/mobile", "FX-FSM-MOBILE", "Job completed on a handheld", { kiosk: true }),
      S("Van stock replenished", "Warehouse", "/target/field-service/van-stock", "FX-FSM-VAN", "Transfer posted"),
    ],
  },
]

// ====================================================================================== index
export function FlowsIndexPage() {
  const s = useSlice("shell")
  return (
    <DetailPage
      header={{ title: "Flow prototypes A to G, portal and field service", screenId: "FX-FLW-INDEX", description: "Each flow is a guided walkthrough over the real screens, taken from the as-is flow models. Open a step to go to its screen; mark it walked to track progress.", chips: <Chip kind="design" note="Flow lettering A to G is the feature list's">Letters from the feature list</Chip>, actions: <Link to="/flows/validation" className="text-sm text-link underline">Validation register</Link> }}
      tabs={[
        {
          id: "flows",
          label: "Flows",
          count: FLOWS.length,
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left">
                  <tr>
                    <th className="p-2">Flow</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">PRD flow</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2 text-right">Steps</th>
                    <th className="p-2">Walked</th>
                  </tr>
                </thead>
                <tbody>
                  {FLOWS.map((f) => {
                    const done = s.flowProgress[f.id] ?? 0
                    return (
                      <tr key={f.id} className="border-t align-top">
                        <td className="p-2 font-semibold">{f.letter}</td>
                        <td className="p-2">
                          <Link to={`/flows/${f.id}`} className="text-link underline">
                            {f.name}
                          </Link>
                          <p className="max-w-xl text-xs text-muted-foreground">{f.summary}</p>
                        </td>
                        <td className="p-2">{f.fl}</td>
                        <td className="p-2">{f.priority}</td>
                        <td className="tabular p-2 text-right">{f.steps.length}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Progress value={(done / f.steps.length) * 100} className="w-24" aria-label={`${f.name} progress`} />
                            <span className="tabular text-xs">
                              {done}/{f.steps.length}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== one flow
export function FlowPage() {
  const { id } = useParams()
  const f = FLOWS.find((x) => x.id === id)
  const s = useSlice("shell")
  if (!f)
    return (
      <div className="flex flex-col gap-2">
        <p>No flow “{id}”.</p>
        <Link to="/flows" className="text-link underline">
          All flows
        </Link>
      </div>
    )
  const done = s.flowProgress[f.id] ?? 0
  const next = Math.min(done, f.steps.length - 1)
  return (
    <DetailPage
      header={{
        title: `Flow ${f.letter}: ${f.name}`,
        screenId: "FX-FLW-INDEX",
        crumbs: [{ label: "Flows", to: "/flows" }, { label: f.name }],
        description: f.summary,
        chips: (
          <>
            <Chip kind="design">{f.fl}</Chip>
            {f.hero && <Chip kind="design">Hero record {f.hero}</Chip>}
          </>
        ),
        primary: (
          <Button asChild>
            <Link to={f.steps[next].route}>{done === 0 ? "Start the walkthrough" : done >= f.steps.length ? "Walked: open the last step" : `Continue at step ${next + 1}`}</Link>
          </Button>
        ),
        actions: (
          <Button variant="outline" onClick={() => shellActions.setFlowStep(f.id, 0)}>
            Reset progress
          </Button>
        ),
      }}
      tabs={[
        {
          id: "walk",
          label: "Walkthrough",
          count: f.steps.length,
          content: (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Progress value={(done / f.steps.length) * 100} className="max-w-xs" aria-label="Progress" />
                <span className="tabular text-sm">
                  {done} of {f.steps.length} steps walked
                </span>
              </div>
              <ol className="flex flex-col gap-2">
                {f.steps.map((st, i) => {
                  const isDone = i < done
                  return (
                    <li key={i} aria-current={i === next && done < f.steps.length ? "step" : undefined} className={cn("flex flex-wrap items-start gap-3 rounded-md border p-3", i === next && done < f.steps.length && "border-primary")}>
                      <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border text-sm">{isDone ? <Check className="size-4" aria-label="walked" /> : i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{st.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {st.role} · <span className="font-mono">{st.screen}</span> · {st.change}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-1 text-xs">
                          {st.kiosk && <Chip kind="design" note="Opens on the kiosk or handheld layout">Kiosk step</Chip>}
                          {st.scan && <span className="rounded border px-1">Scan {st.scan}</span>}
                          {st.posting && <span className="rounded border px-1">Posting {st.posting}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={st.route}>Open screen</Link>
                        </Button>
                        <Button size="sm" variant={isDone ? "ghost" : "default"} onClick={() => shellActions.setFlowStep(f.id, isDone ? i : i + 1)}>
                          {isDone ? "Unmark" : "Mark walked"}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ),
        },
        {
          id: "roles",
          label: "Roles and screens",
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Roles in this flow">
                <ul className="list-disc pl-4 text-sm">
                  {Array.from(new Set(f.steps.map((x) => x.role))).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Roles are as the flow model names them; a step marked Not named has no role in the PRD.</p>
              </Panel>
              <Panel title="Screens in this flow">
                <ul className="list-disc pl-4 text-sm">
                  {Array.from(new Set(f.steps.map((x) => x.screen))).map((r) => (
                    <li key={r} className="font-mono text-xs">
                      {r}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== validation register
const VSTATES: ValidationItem["state"][] = ["Not started", "In progress", "Findings open", "Passed"]
const V_FAMILY = { "Not started": "draft", "In progress": "active", "Findings open": "exception", Passed: "done" } as const
export function ValidationPage() {
  const s = useSlice("shell")
  const modules = useModules()
  const rows = useMemo(
    () =>
      GROUPS.map((g) => {
        const screens = SCREENS.filter((x) => x.group === g.id)
        const claim = (id: string, base: Built): Built => modules.find((m) => m.built[id])?.built[id] ?? base
        const full = screens.filter((x) => claim(x.id, x.built) === "full").length
        const partial = screens.filter((x) => claim(x.id, x.built) === "partial").length
        return { g, n: screens.length, full, partial }
      }),
    [modules],
  )
  const kinds = Array.from(new Set(s.validation.map((v) => v.kind)))
  return (
    <DetailPage
      header={{ title: "Validation and handoff register", screenId: "FX-FLW-VALIDATION", description: "Kiosk and scanner usability, the accessibility pass, design QA, screen spec cards and the DG-2 developer handoff per module. States are yours to set.", chips: <Chip kind="design">Register items are design values</Chip> }}
      tabs={[
        {
          id: "register",
          label: "Register",
          count: s.validation.length,
          content: (
            <div className="flex flex-col gap-6">
              {kinds.map((k) => (
                <Panel key={k} title={k}>
                  <ul className="flex flex-col gap-2">
                    {s.validation.filter((v) => v.kind === k).map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0">
                        <span className="font-mono text-xs">{v.id}</span>
                        <div className="min-w-0 flex-1">
                          <Link to={v.route} className="text-link underline">
                            {v.subject}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {v.owner} · {v.note}
                          </p>
                        </div>
                        <FamilyBadge family={V_FAMILY[v.state]} label={v.state} size="sm" />
                        {v.findings > 0 && <span className="tabular text-xs">{v.findings} findings</span>}
                        <label className="sr-only" htmlFor={`vs-${v.id}`}>
                          State of {v.id}
                        </label>
                        <select id={`vs-${v.id}`} value={v.state} onChange={(e) => shellActions.setValidation(v.id, { state: e.target.value as ValidationItem["state"], findings: e.target.value === "Passed" ? 0 : v.findings })} className="h-8 rounded-md border bg-background px-2 text-xs">
                          {VSTATES.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          ),
        },
        {
          id: "handoff",
          label: "DG-2 handoff per module",
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left">
                  <tr>
                    <th className="p-2">Module group</th>
                    <th className="p-2 text-right">Screens</th>
                    <th className="p-2 text-right">Built</th>
                    <th className="p-2 text-right">Partly built</th>
                    <th className="p-2">Spec cards</th>
                    <th className="p-2">DG-2</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ g, n, full, partial }) => (
                    <tr key={g.id} className="border-t">
                      <td className="p-2">{g.label}</td>
                      <td className="tabular p-2 text-right">{n}</td>
                      <td className="tabular p-2 text-right">{full}</td>
                      <td className="tabular p-2 text-right">{partial}</td>
                      <td className="p-2">
                        <Progress value={n ? ((full + partial / 2) / n) * 100 : 0} className="w-24" aria-label={`${g.label} spec cards`} />
                      </td>
                      <td className="p-2">
                        <FamilyBadge family={full === n && n > 0 ? "done" : full > 0 ? "active" : "draft"} label={full === n && n > 0 ? "Ready for handoff" : full > 0 ? "In build" : "Not started"} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 max-w-3xl text-xs text-muted-foreground">Counts come from the registry and each group's built claims, so they move as groups finish. Every frame links its spec section; a frame without a spec link fails design review (gate DG-2). Spec cards follow Book IV section 9.4: fields, actions with visibility rules, the nine states, drill-through and accessibility.</p>
            </div>
          ),
        },
        {
          id: "status",
          label: "Status words check",
          content: (
            <div className="max-w-3xl text-sm">
              <p>A badge for a word that is not on the record's list renders an Unknown status badge, so a typo is visible. Example of the check:</p>
              <p className="mt-2 flex gap-2">
                <StatusBadge kind="salesOrder" status="Credit Hold" /> <StatusBadge kind="salesOrder" status="Credit hold" />
              </p>
              <p className="mt-2 text-xs text-muted-foreground">The second is wrong by one letter of case and is flagged.</p>
            </div>
          ),
        },
      ]}
    />
  )
}
