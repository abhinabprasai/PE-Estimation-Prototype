// adminCfg slice: the feature-list configuration screens (alert rules, notification templates, recertification,
// KPI dictionary, number series delta, RMA policy, quality no-plan policy, material settings, plants, lanes,
// intercompany, reason codes, denied-party screening, GL mapping, email-action links, sagas).
// Approval-backed changes keep only the request id; the decision is read off the admin engine queue.

import { defineSlice, type SearchHit } from "@/store"
import { LEGAL_ENTITIES } from "@/data/shared"
import { seedAlerts, seedKpis, seedRecert, seedTemplates } from "./cfg-seed-a"
import { seedCharClasses, seedGl, seedIc, seedLanes, seedMatGroups, seedNoPlan, seedPlants, seedReasons, seedRmaReasons, seedSerialProfiles, seedSeriesNew, seedTypeMatrix } from "./cfg-seed-b"
import { seedDpsChecklists, seedDpsHits, seedLinks, seedSagas } from "./cfg-seed-c"
import type { CfgState } from "./cfg-types"

declare module "@/store/types" {
  interface SliceStates {
    adminCfg: CfgState
  }
}

export function seedCfg(): CfgState {
  const ic = seedIc()
  return {
    alerts: seedAlerts(), templates: seedTemplates(), recert: seedRecert(), kpis: seedKpis(), series: seedSeriesNew(), rmaReasons: seedRmaReasons(), noPlan: seedNoPlan(),
    matGroups: seedMatGroups(), charClasses: seedCharClasses(), serialProfiles: seedSerialProfiles(), typeMatrix: seedTypeMatrix(),
    plants: seedPlants(), lanes: seedLanes(), icPairs: ic.pairs, icMarkups: ic.markups, icPrices: ic.prices, reasons: seedReasons(),
    dpsChecklists: seedDpsChecklists(), dpsHits: seedDpsHits(), gl: seedGl(), links: seedLinks(), sagas: seedSagas(), seq: 100,
  }
}

const entityName = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id

function search(s: CfgState): SearchHit[] {
  const out: SearchHit[] = []
  for (const r of s.alerts) out.push({ group: "admin", title: `${r.id} ${r.name}`, subtitle: `Alert rule · ${r.severity} · ${r.enabled ? "enabled" : "disabled"}`, route: `/configuration/alert-rules?rule=${r.id}` })
  for (const t of s.templates) out.push({ group: "admin", title: `${t.id} ${t.name}`, subtitle: `Notification template · ${t.event}`, route: `/configuration/notification-templates?tpl=${t.id}` })
  for (const k of s.kpis) out.push({ group: "admin", title: `${k.id} ${k.name}`, subtitle: `KPI dictionary · owner ${k.owner}`, route: `/configuration/kpi-dictionary?kpi=${k.id}` })
  for (const p of s.plants) out.push({ group: "admin", title: `${p.id} ${p.name}`, subtitle: `Plant · ${entityName(p.entityId)} · ${p.state}`, route: `/configuration/plants/${p.id}` })
  for (const n of s.series) out.push({ group: "admin", title: `${n.docType} number series`, subtitle: `${n.versions[0].value.format} · ${n.group}`, route: `/configuration/number-series?series=${n.id}` })
  for (const g of s.gl) out.push({ group: "admin", title: `GL ${g.account} ${g.name}`, subtitle: `GL mapping · ${g.key} · ${g.status}`, route: `/configuration/gl-mapping?key=${g.key}` })
  for (const h of s.dpsHits) out.push({ group: "admin", title: `${h.id} ${h.partyName}`, subtitle: `Denied-party hit · ${h.state}`, route: `/configuration/denied-party/review?hit=${h.id}` })
  for (const g of s.sagas) out.push({ group: "admin", title: `${g.id} ${g.name}`, subtitle: `Saga · ${g.state}`, route: `/operations/integrations?saga=${g.id}` })
  return out
}

export const adminCfgSlice = defineSlice({ key: "adminCfg", seed: seedCfg, search, links: () => [] })
