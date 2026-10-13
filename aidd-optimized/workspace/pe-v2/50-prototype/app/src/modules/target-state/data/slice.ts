// target-state slice: every Book IX module's records in one slice (key `targetState`). Seeds are fictitious design
// values, built on the shared masters (VENDORS, CUSTOMERS, MATERIALS, WORK_CENTERS). See ../README.md.
import { defineSlice, type SearchHit } from "@/store"
import { type EdiState, seedEdi } from "./edi"
import { type LedgerState, seedLedger } from "./ledger"
import { type GatpState, type OptState, seedGatp, seedOpt } from "./network"
import { type PortalState, seedPortals } from "./portals"
import { type MachineState, seedMachine } from "./machine"
import { type FieldState, seedField } from "./field"
import { type MaintState, seedMaint } from "./maint"
import { type CarrierState, type LocState, seedCarrier, seedLoc } from "./global"

export interface TargetStateState {
  /** Id sequence for records created in this module. */
  seq: number
  edi: EdiState
  ledger: LedgerState
  opt: OptState
  gatp: GatpState
  portal: PortalState
  machine: MachineState
  field: FieldState
  maint: MaintState
  loc: LocState
  carrier: CarrierState
}

declare module "@/store/types" {
  interface SliceStates {
    targetState: TargetStateState
  }
}

const hit = (group: string, title: string, subtitle: string, route: string): SearchHit => ({ group, title, subtitle, route })

export const targetStateSlice = defineSlice({
  key: "targetState",
  seed: (): TargetStateState => ({
    seq: 1, edi: seedEdi(), ledger: seedLedger(), opt: seedOpt(), gatp: seedGatp(), portal: seedPortals(), machine: seedMachine(), field: seedField(), maint: seedMaint(), loc: seedLoc(), carrier: seedCarrier(),
  }),
  search: (s) => [
    ...s.edi.partners.map((p) => hit("Full EDI", p.id, `EDI partner ${p.vendorId}, ${p.channel}, ${p.stage}`, `/target/edi/partners/${p.id}`)),
    ...s.edi.envelopes.map((e) => hit("Full EDI", e.id, `${e.dir} ${e.set}, control ${e.icn}, ${e.parse}`, "/target/edi/monitor")),
    ...s.opt.runs.map((r) => hit("Optimizer", r.id, `Optimizer run ${r.status}`, "/target/optimizer/runs")),
    ...s.field.svos.map((v) => hit("Field service", v.id, `Service order ${v.status}, ${v.entitlement.basis}: ${v.problem}`, `/target/field-service/orders/${v.id}`)),
    ...s.maint.equipment.filter((e) => e.type !== "Location").map((e) => hit("Maintenance", e.id, `Equipment: ${e.name}`, `/target/maintenance/equipment/${e.id}`)),
    ...s.maint.orders.map((m) => hit("Maintenance", m.id, `${m.type} maintenance order ${m.status}: ${m.desc}`, `/target/maintenance/orders/${m.id}`)),
    ...s.loc.countries.map((c) => hit("Localization", c.name, "Country activation checklist", "/target/localization/countries")),
  ],
  links: () => [],
})
