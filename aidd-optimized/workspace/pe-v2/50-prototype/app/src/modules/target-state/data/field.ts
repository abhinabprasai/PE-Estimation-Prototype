// Full Field Service Management (Book IX §7). Status path, rules and objects are the PRD's:
// service order status path New, Triaged, Scheduled, Dispatched, On Site, Work Complete, Customer Signed, Settled, Closed;
// entitlement reads contracts before warranty and is stamped at creation with its rule trail (immutable);
// warranty work settles against the reserve (overflow to warranty expense), contract work against the contract,
// everything else quotes at service rates before dispatch and the customer approves in writing or in the portal;
// a service order settles to zero open cost like a production order; van stock is a warehouse of type van per technician,
// replenished by transfer orders against min and max per spare.
// Rates (service rate, cost rate, travel), warranty term, response classes and territories are design values.

import { MATERIALS } from "@/data/shared"
import { daysBetween } from "@/lib/format"

export const SVO_PATH = ["New", "Triaged", "Scheduled", "Dispatched", "On Site", "Work Complete", "Customer Signed", "Settled", "Closed"] as const
export type SvoStatus = (typeof SVO_PATH)[number]
export const SERVICE_TYPES = ["Onsite repair", "Annual inspection", "Emergency response"]
export const SERVICE_RATE = 145
export const COST_RATE = 68
export const TRAVEL_COST_PER_KM = 0.85
export const WARRANTY_MONTHS = 24
export const NOW_F = "2026-10-09 14:30"
export const WARRANTY_RESERVE = 25000

export interface Tech { id: string; name: string; territory: string[]; skills: { skill: string; cert: string; expires: string }[]; van: string; calendar: string; status: "Active" | "On leave" }
export interface Contract { id: string; customerId: string; coverage: { kind: "Customer" | "Serial set"; serials: string[] }; cls: "A" | "B" | "C"; responseHrs: number; resolutionHrs: number; covered: string[]; billing: string; validFrom: string; validTo: string }
export interface InstalledUnit { id: string; serial: string; customerId: string; item: string; site: string; region: string; commissioned: string }
export interface SvoTask { text: string; skill: string; hrs: number; done: boolean }
export interface Svo {
  id: string; customerId: string; ibId: string; serial: string; site: string; region: string; problem: string; service: string
  entitlement: { basis: "Contract" | "Warranty" | "Billable"; ref?: string; trail: string[]; stampedAt: string }
  cls: "A" | "B" | "C" | "Standard"; responseHrs: number
  status: SvoStatus; tasks: SvoTask[]; parts: { materialId: string; qty: number; used: number }[]
  techId?: string; date?: string; startHr?: number
  quote?: { amount: number; approved: boolean; via?: "Written" | "Portal" }
  hoursLogged: number; km: number; createdAt: string; rmaId?: string; signedBy?: string; settledAmount: number
  findings: string[]; t12: { removed: string; installed: string }[]
  photos?: number
  settlement?: { origin: Svo["entitlement"]["basis"]; lines: { label: string; amount: number }[] }
}
export interface VanLine { techId: string; materialId: string; onHand: number; min: number; max: number; lastCount: string }
export interface TransferOrder { id: string; techId: string; from: string; lines: { materialId: string; qty: number }[]; createdOn: string; status: "Created" }
export interface FieldState { techs: Tech[]; contracts: Contract[]; units: InstalledUnit[]; svos: Svo[]; van: VanLine[]; transfers: TransferOrder[]; seq: number; queued: number }

export const unitOf = (u: FieldState, serial: string) => u.units.find((x) => x.serial === serial)
export const listOf = (id: string) => MATERIALS.find((m) => m.id === id)?.listPrice ?? MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
export const stdOfF = (id: string) => MATERIALS.find((m) => m.id === id)?.stdCost ?? 0
export const hrsOf = (s: Svo) => s.tasks.reduce((a, t) => a + t.hrs, 0)

/** Entitlement: contracts first, then warranty, otherwise billable. Returns the verdict and the rule trail. */
export function entitle(f: Pick<FieldState, "contracts" | "units">, customerId: string, serial: string, service: string, onDate: string): Svo["entitlement"] {
  const trail: string[] = []
  const hit = f.contracts.find((c) => {
    const act = c.validFrom <= onDate && onDate <= c.validTo
    const cov = c.customerId === customerId && (c.coverage.kind === "Customer" || c.coverage.serials.includes(serial))
    const svc = c.covered.includes(service)
    if (c.customerId === customerId) trail.push(`Contract ${c.id}: ${act ? "valid" : `not valid on ${onDate}`}; ${cov ? "covers this serial" : "does not cover this serial"}; ${svc ? `covers "${service}"` : `does not cover "${service}"`}`)
    return act && cov && svc
  })
  if (hit) {
    trail.push("Warranty not evaluated: contracts are read before warranty")
    return { basis: "Contract", ref: hit.id, trail, stampedAt: NOW_F }
  }
  if (!trail.length) trail.push("No contract on file for this customer")
  const u = f.units.find((x) => x.serial === serial)
  if (u) {
    const [y, m, d] = u.commissioned.split("-").map(Number)
    const end = new Date(Date.UTC(y, m - 1 + WARRANTY_MONTHS, d)).toISOString().slice(0, 10)
    if (end >= onDate) {
      trail.push(`Warranty: commissioned ${u.commissioned}, term ${WARRANTY_MONTHS} months to ${end}: in warranty`)
      return { basis: "Warranty", ref: `IB ${u.id}`, trail, stampedAt: NOW_F }
    }
    trail.push(`Warranty: ended ${end}`)
  } else trail.push("Warranty: serial not found in the installed base")
  trail.push("Result: billable at service rates; quote before dispatch")
  return { basis: "Billable", trail, stampedAt: NOW_F }
}

export function costOf(s: Svo) {
  const labor = s.hoursLogged * COST_RATE
  const parts = s.parts.reduce((a, p) => a + p.used * stdOfF(p.materialId), 0)
  const travel = s.km * TRAVEL_COST_PER_KM
  return { labor, parts, travel, total: labor + parts + travel }
}
export const openCost = (s: Svo) => Math.round((costOf(s).total - s.settledAmount) * 100) / 100
export function slaRemainingHrs(s: Svo) {
  const created = new Date(s.createdAt.replace(" ", "T") + "Z").getTime()
  const now = new Date(NOW_F.replace(" ", "T") + "Z").getTime()
  return Math.round((s.responseHrs - (now - created) / 3600000) * 10) / 10
}
export const travelMin = (t: Tech, region: string) => (t.territory.includes(region) ? 45 : 180)
export const weekdays = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]
export { daysBetween }

export function seedField(): FieldState {
  const techs: Tech[] = [
    { id: "TECH-TBD-01", name: "Aaron Whitlock", territory: ["ND", "MN"], skills: [{ skill: "HV bushing replacement", cert: "QUAL-TBD-HVB-12", expires: "2027-05-31" }, { skill: "Oil handling", cert: "QUAL-TBD-OIL-03", expires: "2027-01-31" }, { skill: "Electrical test", cert: "QUAL-TBD-ET-07", expires: "2026-12-31" }], van: "WH-TBD-VAN-01", calendar: "Mon-Fri 07:00-16:00", status: "Active" },
    { id: "TECH-TBD-02", name: "Brigitte Roy", territory: ["SK", "MB", "QC"], skills: [{ skill: "Tap changer service", cert: "QUAL-TBD-TCS-05", expires: "2027-03-31" }, { skill: "Oil handling", cert: "QUAL-TBD-OIL-09", expires: "2026-11-15" }, { skill: "Electrical test", cert: "QUAL-TBD-ET-11", expires: "2027-02-28" }], van: "WH-TBD-VAN-02", calendar: "Mon-Fri 07:00-16:00", status: "Active" },
    { id: "TECH-TBD-03", name: "Carlos Ibarra", territory: ["WI", "IN", "IA", "NE"], skills: [{ skill: "Leak and radiator repair", cert: "QUAL-TBD-LR-02", expires: "2027-06-30" }, { skill: "Oil handling", cert: "QUAL-TBD-OIL-14", expires: "2027-04-30" }, { skill: "Electrical test", cert: "QUAL-TBD-ET-15", expires: "2027-01-31" }], van: "WH-TBD-VAN-03", calendar: "Mon-Fri 07:00-16:00", status: "Active" },
    { id: "TECH-TBD-04", name: "Dana Petrov", territory: ["SD", "MT", "WA"], skills: [{ skill: "HV bushing replacement", cert: "QUAL-TBD-HVB-19", expires: "2027-08-31" }, { skill: "Tap changer service", cert: "QUAL-TBD-TCS-08", expires: "2026-10-31" }], van: "WH-TBD-VAN-04", calendar: "Tue-Sat 08:00-17:00", status: "On leave" },
  ]
  const contracts: Contract[] = [
    { id: "SCT-TBD-0001", customerId: "CUS-TBD-0048", coverage: { kind: "Customer", serials: [] }, cls: "A", responseHrs: 4, resolutionHrs: 48, covered: ["Emergency response", "Onsite repair"], billing: "Non-covered work at service rates, billed per visit", validFrom: "2026-10-01", validTo: "2027-09-30" },
    { id: "SCT-TBD-0003", customerId: "CUS-TBD-0027", coverage: { kind: "Serial set", serials: ["SN-TBD-5000-0188"] }, cls: "B", responseHrs: 24, resolutionHrs: 120, covered: ["Annual inspection", "Onsite repair"], billing: "Parts not covered, billed at list; labor covered", validFrom: "2026-01-01", validTo: "2026-12-31" },
    { id: "SCT-TBD-0004", customerId: "CUS-TBD-0041", coverage: { kind: "Customer", serials: [] }, cls: "C", responseHrs: 72, resolutionHrs: 240, covered: ["Annual inspection"], billing: "Repairs billable at service rates", validFrom: "2025-01-01", validTo: "2026-06-30" },
  ]
  const units: InstalledUnit[] = [
    { id: "IB-TBD-0301", serial: "SN-TBD-20M-0301", customerId: "CUS-TBD-0048", item: "FIN-TBD-20MVA", site: "Omaha North substation, NE", region: "NE", commissioned: "2026-08-28" },
    { id: "IB-TBD-0188", serial: "SN-TBD-5000-0188", customerId: "CUS-TBD-0027", item: "FIN-TBD-5000SS", site: "North substation, Manitowoc, WI", region: "WI", commissioned: "2024-05-14" },
    { id: "IB-TBD-0205", serial: "SN-TBD-2500-0205", customerId: "CUS-TBD-0031", item: "FIN-TBD-2500PM", site: "Substation yard, Minot, ND", region: "ND", commissioned: "2025-11-20" },
    { id: "IB-TBD-0212", serial: "SN-TBD-5000-0212", customerId: "CUS-TBD-0041", item: "FIN-TBD-5000SS", site: "Mill switchyard, Butte, MT", region: "MT", commissioned: "2023-03-02" },
    { id: "IB-TBD-0219", serial: "SN-TBD-1000-0219", customerId: "CUS-TBD-0017", item: "FIN-TBD-1000PM", site: "Job site 2291, Duluth, MN", region: "MN", commissioned: "2023-09-10" },
    { id: "IB-TBD-0230", serial: "SN-TBD-0167-0230", customerId: "CUS-TBD-0009", item: "FIN-TBD-0167PL", site: "Dock 3, Sioux Falls, SD", region: "SD", commissioned: "2022-04-11" },
  ]
  const f = { contracts, units }
  const mk = (n: number, customerId: string, serial: string, problem: string, service: string, status: SvoStatus, createdAt: string, tasks: SvoTask[], extra: Partial<Svo> = {}): Svo => {
    const u = units.find((x) => x.serial === serial)!
    const ent = entitle(f, customerId, serial, service, createdAt.slice(0, 10))
    const c = ent.basis === "Contract" ? contracts.find((x) => x.id === ent.ref) : undefined
    return { id: `SVO-TBD-${String(n).padStart(4, "0")}`, customerId, ibId: u.id, serial, site: u.site, region: u.region, problem, service, entitlement: { ...ent, stampedAt: createdAt }, cls: c?.cls ?? "Standard", responseHrs: c?.responseHrs ?? 72, status, tasks, parts: [], hoursLogged: 0, km: 0, createdAt, settledAmount: 0, findings: [], t12: [], ...extra }
  }
  const t = (text: string, skill: string, hrs: number, done = false): SvoTask => ({ text, skill, hrs, done })
  const svos: Svo[] = [
    mk(1, "CUS-TBD-0048", "SN-TBD-20M-0301", "HV bushing oil weep at flange (RMA-TBD-0012)", "Onsite repair", "Settled", "2026-09-24 09:10", [t("Replace HV bushing SN-TBD-BSH-0302", "HV bushing replacement", 5, true), t("Oil top-up and test", "Oil handling", 1, true)], { techId: "TECH-TBD-01", date: "2026-09-29", startHr: 8, parts: [{ materialId: "SPARE-TBD-BSH145", qty: 1, used: 1 }, { materialId: "SPARE-TBD-GSKT20", qty: 1, used: 1 }], hoursLogged: 6, km: 260, rmaId: "RMA-TBD-0012", signedBy: "Calvin Reed", settledAmount: 6 * COST_RATE + 18900 + 640 + 260 * TRAVEL_COST_PER_KM, findings: ["Flange seal leak confirmed on batch HP-26-0412"], t12: [{ removed: "SN-TBD-BSH-0302", installed: "SN-TBD-BSH-0412" }] }),
    mk(2, "CUS-TBD-0027", "SN-TBD-5000-0188", "Annual inspection, 5 MVA unit substation", "Annual inspection", "Scheduled", "2026-10-02 10:00", [t("Visual and thermographic inspection", "Electrical test", 3), t("Oil sample and DGA draw", "Oil handling", 1)], { techId: "TECH-TBD-03", date: "2026-10-13", startHr: 8, parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, used: 0 }] }),
    mk(3, "CUS-TBD-0009", "SN-TBD-0167-0230", "Oil seep at radiator header", "Onsite repair", "Triaged", "2026-10-09 08:15", [t("Locate and repair radiator seep", "Leak and radiator repair", 4), t("Oil top-up", "Oil handling", 1)], { quote: { amount: 5 * SERVICE_RATE + 640, approved: false }, parts: [{ materialId: "SPARE-TBD-GSKT20", qty: 1, used: 0 }] }),
    mk(4, "CUS-TBD-0041", "SN-TBD-5000-0212", "Tap changer position indicator stuck", "Onsite repair", "Dispatched", "2026-10-05 13:40", [t("Diagnose and service tap changer", "Tap changer service", 6)], { techId: "TECH-TBD-04", date: "2026-10-12", startHr: 8, quote: { amount: 6 * SERVICE_RATE + 3900, approved: true, via: "Written" }, parts: [{ materialId: "SPARE-TBD-OLTCK", qty: 1, used: 0 }] }),
    mk(5, "CUS-TBD-0048", "SN-TBD-20M-0301", "OLTC alarm A-17 on commissioning check", "Emergency response", "New", "2026-10-09 12:20", [t("Remote triage then onsite alarm check", "Tap changer service", 3)], {}),
    mk(6, "CUS-TBD-0017", "SN-TBD-1000-0219", "Low oil level indicator reading", "Onsite repair", "On Site", "2026-10-08 15:30", [t("Inspect gauge and top up oil", "Oil handling", 2), t("Gauge calibration check", "Electrical test", 1)], { techId: "TECH-TBD-01", date: "2026-10-09", startHr: 10, quote: { amount: 3 * SERVICE_RATE, approved: true, via: "Portal" }, hoursLogged: 1.5, km: 150 }),
    mk(7, "CUS-TBD-0027", "SN-TBD-5000-0188", "Buchholz relay nuisance trip", "Onsite repair", "Work Complete", "2026-10-06 09:00", [t("Test and reset Buchholz relay", "Electrical test", 2, true)], { techId: "TECH-TBD-03", date: "2026-10-08", startHr: 8, hoursLogged: 2.5, km: 180, findings: ["Relay contact dirty; cleaned and tested"] }),
    mk(8, "CUS-TBD-0031", "SN-TBD-2500-0205", "Nameplate illegible after paint touch-up", "Onsite repair", "Closed", "2026-08-02 11:00", [t("Replace nameplate", "Electrical test", 1, true)], { techId: "TECH-TBD-01", date: "2026-08-05", startHr: 9, hoursLogged: 1, km: 60, signedBy: "Omar Haddad", settledAmount: 68 + 51 }),
  ]
  const vl = (techId: string, materialId: string, onHand: number, min: number, max: number, lastCount = "2026-09-30"): VanLine => ({ techId, materialId, onHand, min, max, lastCount })
  const van: VanLine[] = [
    vl("TECH-TBD-01", "SPARE-TBD-BSH145", 0, 1, 2), vl("TECH-TBD-01", "SPARE-TBD-GSKT20", 3, 2, 6), vl("TECH-TBD-01", "SPARE-TBD-OLTCK", 1, 1, 3),
    vl("TECH-TBD-02", "SPARE-TBD-BSH145", 1, 1, 2), vl("TECH-TBD-02", "SPARE-TBD-GSKT20", 1, 2, 6), vl("TECH-TBD-02", "SPARE-TBD-OLTCK", 0, 1, 3),
    vl("TECH-TBD-03", "SPARE-TBD-BSH145", 1, 1, 2, "2026-09-12"), vl("TECH-TBD-03", "SPARE-TBD-GSKT20", 2, 2, 6, "2026-09-12"), vl("TECH-TBD-03", "SPARE-TBD-OLTCK", 2, 1, 3, "2026-09-12"),
    vl("TECH-TBD-04", "SPARE-TBD-BSH145", 2, 1, 2), vl("TECH-TBD-04", "SPARE-TBD-GSKT20", 4, 2, 6), vl("TECH-TBD-04", "SPARE-TBD-OLTCK", 1, 1, 3),
  ]
  return { techs, contracts, units, svos, van, transfers: [], seq: 9, queued: 0 }
}
