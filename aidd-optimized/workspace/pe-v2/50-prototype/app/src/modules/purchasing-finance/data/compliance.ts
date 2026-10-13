// Vendor compliance panel data (Book I G §2.1 [DOC:p.101]): W-9, insurance certificate and expiry, ISO 9001
// certificate and expiry, conflict minerals statement, Buy America capability per ship-from site; expiring
// documents alert at 30 days. The vendor master holds document names only, so dates and sites are design
// values (fictitious) kept here; today's date is the shared TODAY.

import type { ISODate, Vendor } from "@/data/domain"
import { store } from "@/store"

export interface ShipFromSite {
  site: string
  country: string
  buyAmerica: boolean
  doc?: string
}
export interface VendorCompliance {
  w9: boolean
  insuranceExpiry?: ISODate
  isoExpiry?: ISODate
  conflictMinerals: boolean
  sites: ShipFromSite[]
}
const site = (s: string, country: string, buyAmerica: boolean, doc?: string): ShipFromSite => ({ site: s, country, buyAmerica, doc })
const US_CERT = "Buy America certificate on file"

export const COMPLIANCE: Record<string, VendorCompliance> = {
  "VEN-TBD-0101": { w9: true, insuranceExpiry: "2027-03-31", isoExpiry: "2027-06-30", conflictMinerals: true, sites: [site("Gary, IN", "US", true, US_CERT), site("Weirton, WV", "US", true, US_CERT)] },
  "VEN-TBD-0102": { w9: true, insuranceExpiry: "2027-01-15", isoExpiry: "2027-02-28", conflictMinerals: true, sites: [site("Fort Wayne, IN", "US", true, US_CERT)] },
  "VEN-TBD-0103": { w9: false, insuranceExpiry: "2027-05-31", isoExpiry: "2027-04-30", conflictMinerals: true, sites: [site("Regensburg", "DE", false)] },
  "VEN-TBD-0104": { w9: false, insuranceExpiry: "2026-11-02", isoExpiry: "2027-01-31", conflictMinerals: true, sites: [site("Busan", "KR", false)] },
  "VEN-TBD-0105": { w9: true, insuranceExpiry: "2027-02-28", conflictMinerals: true, sites: [site("Tulsa, OK", "US", true, US_CERT)] },
  "VEN-TBD-0106": { w9: true, insuranceExpiry: "2027-04-30", isoExpiry: "2026-10-30", conflictMinerals: true, sites: [site("Sioux Falls, SD", "US", true, US_CERT), site("Fargo, ND", "US", true, US_CERT)] },
  "VEN-TBD-0107": { w9: false, insuranceExpiry: "2027-01-31", isoExpiry: "2027-03-31", conflictMinerals: true, sites: [site("Trois-Rivières, QC", "CA", false)] },
  "VEN-TBD-0108": { w9: true, insuranceExpiry: "2027-06-30", isoExpiry: "2027-05-31", conflictMinerals: true, sites: [site("Kansas City, MO", "US", true, US_CERT)] },
  "VEN-TBD-0109": { w9: true, insuranceExpiry: "2027-02-28", conflictMinerals: false, sites: [site("Spokane, WA", "US", true)] },
  "VEN-TBD-0110": { w9: true, insuranceExpiry: "2027-03-31", isoExpiry: "2027-03-31", conflictMinerals: false, sites: [site("Milwaukee, WI", "US", false)] },
  "VEN-TBD-0111": { w9: false, conflictMinerals: false, sites: [site("Nogales, Sonora", "MX", false)] },
  "VEN-TBD-0112": { w9: true, insuranceExpiry: "2026-10-20", isoExpiry: "2027-01-31", conflictMinerals: true, sites: [site("Dayton, OH", "US", true, US_CERT)] },
  "VEN-TBD-0113": { w9: false, insuranceExpiry: "2026-12-31", isoExpiry: "2027-02-28", conflictMinerals: true, sites: [site("Windsor, ON", "CA", false)] },
  "VEN-TBD-0114": { w9: true, insuranceExpiry: "2027-07-31", conflictMinerals: true, sites: [site("Minneapolis, MN", "US", true)] },
  "VEN-TBD-0115": { w9: false, conflictMinerals: false, sites: [site("Nagoya", "JP", false)] },
  "VEN-TBD-0116": { w9: true, insuranceExpiry: "2027-01-31", conflictMinerals: true, sites: [site("Fargo, ND", "US", true)] },
  "VEN-TBD-0120": { w9: true, conflictMinerals: true, sites: [site("Fargo, ND", "US", true, "Intercompany: same legal group")] },
  "VEN-TBD-0121": { w9: true, conflictMinerals: false, sites: [site("Columbus, OH", "US", false)] },
  "VEN-TBD-0122": { w9: false, isoExpiry: "2027-02-28", conflictMinerals: false, sites: [site("Kanazawa", "JP", false)] },
  "VEN-TBD-0123": { w9: true, isoExpiry: "2027-01-31", conflictMinerals: true, sites: [site("Des Moines, IA", "US", true, US_CERT)] },
  "VEN-TBD-0124": { w9: false, conflictMinerals: false, sites: [site("Pittsburgh, PA", "US", false)] },
  "VEN-TBD-0125": { w9: false, isoExpiry: "2027-04-30", conflictMinerals: true, sites: [site("Saint-Laurent, QC", "CA", false)] },
}
export const complianceOf = (v: Pick<Vendor, "id" | "country">): VendorCompliance => COMPLIANCE[v.id] ?? { w9: false, conflictMinerals: false, sites: [] }

const daysBetween = (a: ISODate, b: ISODate) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86_400_000)
/** Expiring documents alert at 30 days (and stay flagged once expired). */
export function complianceAlerts(c: VendorCompliance, today: ISODate, windowDays = 30) {
  const out: { doc: string; on: ISODate; days: number }[] = []
  for (const [doc, on] of [["Insurance certificate", c.insuranceExpiry], ["ISO 9001 certificate", c.isoExpiry]] as const) {
    if (!on) continue
    const days = daysBetween(today, on)
    if (days <= windowDays) out.push({ doc, on, days })
  }
  return out
}
/** Rolling IQC acceptance % per vendor from the quality module's inspection results (auto, Book I G §2.2). */
export function qualityRating(vendorId: string): { pct: number; lots: number } | undefined {
  if (!store.hasSlice("qualityTrace")) return undefined
  const vl = (store.getSlice("qualityTrace" as never) as unknown as { vendorLots?: { vendorId: string; lots: number; accepted: number }[] }).vendorLots?.find((x) => x.vendorId === vendorId)
  return vl && vl.lots > 0 ? { pct: Math.round((vl.accepted / vl.lots) * 1000) / 10, lots: vl.lots } : undefined
}
