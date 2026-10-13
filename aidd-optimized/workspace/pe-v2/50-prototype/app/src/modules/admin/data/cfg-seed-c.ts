// Seed: denied-party screening (Book III C §5), email-action links (W.1; Book IV §7.7), sagas (Book III B §2.3).

import { uid } from "./seed"
import type { ActionLink, DpsChecklist, DpsHit, Saga } from "./cfg-types"

export const DPS_ITEMS_CUSTOMER = [
  "Search the legal name and every trade name on the consolidated screening lists",
  "Search each owner of 25% or more and each named signatory",
  "Check the bill-to and ship-to countries against embargoed destinations",
  "Record the end use and end user statement",
  "Attach the screening result (PDF or screenshot) to the party record",
  "A second person reviews any potential match before the party is activated",
]
export const DPS_ITEMS_VENDOR = [
  "Search the legal name and every trade name on the consolidated screening lists",
  "Search each owner of 25% or more and each named signatory",
  "Check the vendor country and the ship-from sites against embargoed destinations",
  "Confirm the beneficial ownership declaration is on file",
  "Attach the screening result (PDF or screenshot) to the party record",
  "A second person reviews any potential match before the vendor is activated",
]
const mk = (id: string, partyType: "Customer" | "Vendor", partyId: string, partyName: string, country: string, done: number, extra: Partial<DpsChecklist> = {}): DpsChecklist => {
  const items = (partyType === "Customer" ? DPS_ITEMS_CUSTOMER : DPS_ITEMS_VENDOR).map((text, n) => ({ id: `${id}-${n + 1}`, text, state: n < done ? ("Done" as const) : ("Open" as const), ...(n < done ? { by: uid(partyType === "Customer" ? "Sales admin" : "Buyer"), on: "2026-10-06" } : {}) }))
  return { id, partyType, partyId, partyName, country, items, ...extra }
}
export function seedDpsChecklists(): DpsChecklist[] {
  return [
    mk("DPC-001", "Customer", "CUS-TBD-0060", "Bluewater Ridge Solar EPC, LLC", "US", 3),
    mk("DPC-002", "Vendor", "VEN-TBD-0110", "Meridian Relay & Control", "US", 5),
    mk("DPC-003", "Vendor", "VEN-TBD-0111", "Saguaro Gasket Supply", "MX", 0),
    mk("DPC-004", "Vendor", "VEN-TBD-0116", "Great Plains Heavy Haul", "US", 6, { result: "Clear", completedBy: uid("Buyer"), completedOn: "2026-09-30" }),
  ]
}
export function seedDpsHits(): DpsHit[] {
  const h = (id: string, partyType: DpsHit["partyType"], partyId: string, partyName: string, list: string, listedName: string, score: number, runOn: string, extra: Partial<DpsHit> = {}): DpsHit => ({ id, partyType, partyId, partyName, list, listedName, score, runOn, state: "New", ...extra })
  return [
    h("DPH-0007", "Vendor", "VEN-TBD-0111", "Saguaro Gasket Supply", "Entity List (design value)", "Saguaro Gaskets y Sellos S.A.", 91, "2026-10-08"),
    h("DPH-0006", "Customer", "CUS-TBD-0060", "Bluewater Ridge Solar EPC, LLC", "Specially Designated Nationals (design value)", "Blue Water Ridge Trading Co.", 64, "2026-10-07", { state: "In review", reviewer: uid("Controller") }),
    h("DPH-0005", "Vendor", "VEN-TBD-0115", "Kitami Instrument Transformers", "Denied Persons List (design value)", "Kitami Instruments Ltd.", 58, "2026-10-02", { state: "Cleared", reviewer: uid("Controller"), decision: "Different company: Kitami Instrument Transformers is in Hokkaido, listed party is in Dubai; registration numbers differ.", decidedOn: "2026-10-03" }),
    h("DPH-0004", "Customer", "CUS-TBD-0038", "Ironworks Mill Industrial Park Ltd.", "Unverified List (design value)", "Iron Works Mill Park", 88, "2026-09-12", { state: "Confirmed match", reviewer: uid("Controller"), decision: "Confirmed by registration number and address; customer is Blocked.", decidedOn: "2026-09-14" }),
  ]
}

// Signed links in approval emails. The tokens are opaque and fictitious.
export function seedLinks(): ActionLink[] {
  const l = (token: string, requestId: string, forRole: ActionLink["forRole"], action: ActionLink["action"], issuedAt: string, expiresAt: string, extra: Partial<ActionLink> = {}): ActionLink => ({ token, requestId, forRole, forUser: uid(forRole), action, issuedAt, expiresAt, ...extra })
  return [
    l("k3Qx9v-Lm2Rt7-Nb4Ww", "APR-TBD-5001", "Quality Manager", "Approve", "2026-10-07T10:20", "2026-10-14T10:20"),
    l("p8Zd2a-Hs5Vc1-Je6Yu", "APR-TBD-5001", "Quality Manager", "Reject", "2026-10-07T10:20", "2026-10-14T10:20"),
    l("e1Ta7m-Fw3Kb9-Qr0Xz", "APR-TBD-5002", "Production supervisor", "Approve", "2026-09-29T09:00", "2026-10-06T09:00"),
    l("w6Gn4c-Pu8Ld2-Hy5Sv", "APR-TBD-5003", "Engineering Manager", "Approve", "2026-09-29T09:00", "2026-10-13T09:00", { usedAt: "2026-09-30T16:10", usedBy: uid("Engineering Manager") }),
    l("z2Bf5r-Kt1Mj8-Va3Co", "APR-TBD-5005", "Pricing Manager", "Approve", "2026-10-08T14:10", "2026-10-15T14:10"),
  ]
}

// ---------------------------------------------------------------- sagas (Book III B §2.3)
export function seedSagas(): Saga[] {
  const it = uid("Plant IT")
  return [
    {
      id: "SAGA-0017", interfaceId: "IF-12", name: "RMA disposition outcome: Restock with credit", correlationId: "COR-5C21-RMA13", startedAt: "2026-10-09T09:40", doc: { type: "rma", id: "RMA-TBD-0013" }, state: "Failed",
      steps: [
        { n: 1, name: "Post #18 RMA restock (1335 to 1330/1310)", module: "Inventory / ACC", compensator: "Reverse posting #18 with a same-period reversal journal", state: "Done", at: "2026-10-09T09:40" },
        { n: 2, name: "Update serial status (Returned to In Stock)", module: "Traceability", compensator: "Restore serial status Returned and re-link the RMA", state: "Done", at: "2026-10-09T09:41" },
        { n: 3, name: "Create credit memo request CMR", module: "Sales", compensator: "Cancel the CMR with reason \"saga compensation\"", state: "Done", at: "2026-10-09T09:41" },
        { n: 4, name: "Send credit request to ACC (IF-09)", module: "ACC", compensator: "Void the ACC credit request by correlation id", state: "Failed", at: "2026-10-09T09:42", error: "ACC credit note service returned 503 after 5 attempts; message is in the dead-letter queue" },
        { n: 5, name: "Close RMA settlement step", module: "Sales", compensator: "Reopen the settlement step (Controller)", state: "Pending" },
      ],
      log: [{ at: "2026-10-09T09:42", by: "Scheduler", what: "Step 4 failed after retries; saga parked for an operator" }],
    },
    {
      id: "SAGA-0016", interfaceId: "IF-14", name: "Intercompany pairing: seller SO and buyer PO", correlationId: "COR-8A04-IC0031", startedAt: "2026-10-08T14:02", state: "Compensated",
      steps: [
        { n: 1, name: "Create seller sales order (PE Grid Components)", module: "Sales", compensator: "Cancel the seller SO", state: "Compensated", at: "2026-10-08T14:02" },
        { n: 2, name: "Create buyer purchase order (PE Transformer)", module: "Purchasing", compensator: "Cancel the buyer PO", state: "Compensated", at: "2026-10-08T14:02" },
        { n: 3, name: "Validate IC relationship and transfer price list", module: "Configuration", compensator: "None: read-only check", state: "Failed", at: "2026-10-08T14:03", error: "No transfer price row for TRADE-TBD-ELB on IC-02 (partial configuration)" },
        { n: 4, name: "Link the pair and post IC AR/AP", module: "ACC", compensator: "Reverse IC journals", state: "Skipped" },
      ],
      log: [
        { at: "2026-10-08T14:03", by: "Scheduler", what: "Step 3 failed; compensating steps 2 and 1 (rollback on partial config error)" },
        { at: "2026-10-08T14:04", by: "Scheduler", what: "Compensated: neither side of the pair exists, as the atomic pairing rule requires" },
      ],
    },
    {
      id: "SAGA-0015", interfaceId: "IF-12", name: "RMA disposition outcome: Scrap", correlationId: "COR-5C21-RMA11", startedAt: "2026-10-07T11:15", doc: { type: "rma", id: "RMA-TBD-0011" }, state: "Completed",
      steps: [
        { n: 1, name: "Post #20 RMA scrap (5320 from 1335)", module: "Inventory / ACC", compensator: "Reverse posting #20", state: "Done", at: "2026-10-07T11:15" },
        { n: 2, name: "Update serial status (Scrapped)", module: "Traceability", compensator: "Restore serial status Returned", state: "Done", at: "2026-10-07T11:16" },
        { n: 3, name: "Close RMA settlement step", module: "Sales", compensator: "Reopen the settlement step (Controller)", state: "Done", at: "2026-10-07T11:16" },
      ],
      log: [],
    },
    {
      id: "SAGA-0018", interfaceId: "IF-12", name: "RMA disposition outcome: Replacement at zero price", correlationId: "COR-5C21-RMA14", startedAt: "2026-10-09T14:48", doc: { type: "rma", id: "RMA-TBD-0014" }, state: "Running",
      steps: [
        { n: 1, name: "Create replacement sales order at zero price", module: "Sales", compensator: "Cancel the replacement SO", state: "Done", at: "2026-10-09T14:48" },
        { n: 2, name: "Reserve stock for the replacement", module: "Inventory", compensator: "Release the reservation", state: "Pending" },
        { n: 3, name: "Post #21 warranty settlement when the order ships", module: "Inventory / ACC", compensator: "Reverse posting #21", state: "Pending" },
      ],
      log: [],
    },
  ].map((x) => ({ ...x, log: x.log.length ? x.log : [{ at: x.startedAt, by: it, what: "Saga started" }] })) as Saga[]
}
