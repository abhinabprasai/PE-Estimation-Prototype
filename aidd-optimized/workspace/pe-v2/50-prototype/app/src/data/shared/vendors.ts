// Vendor master shared by purchasing, quality, materials and engineering. All fictitious.
// Statuses use S-30 (onboarding) and S-31 (quality approval) verbatim. Seeded so every status
// value appears at least once; VEN-TBD-0112 has two overdue SCARs, which sets Restricted (C-28).

import type { AvlEntry, Vendor } from "@/data/domain"

export const VENDORS: Vendor[] = [
  { id: "VEN-TBD-0101", name: "Northstar Electrical Steel Co.", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001", "Mill certs"], overdueScars: 0, currency: "USD", commodity: "CRGO electrical steel" },
  { id: "VEN-TBD-0102", name: "Keystone Copper Conductors", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001", "Conductivity certs"], overdueScars: 0, currency: "USD", commodity: "Copper wire, CTC, foil" },
  { id: "VEN-TBD-0103", name: "Rheinwerk Tap Changers GmbH", country: "DE", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001", "IEC 60214 type test"], overdueScars: 0, currency: "USD", commodity: "On-load tap changers" },
  { id: "VEN-TBD-0104", name: "Hanseong Porcelain & Polymer", country: "KR", onboarding: "Active", quality: "Conditional", complianceDocs: ["ISO 9001"], overdueScars: 1, currency: "USD", commodity: "HV bushings" },
  { id: "VEN-TBD-0105", name: "Great Lakes Dielectric Oils", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ASTM D3487 certs"], overdueScars: 0, currency: "USD", commodity: "Transformer oil" },
  { id: "VEN-TBD-0106", name: "Prairie Plate & Fab", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["AWS D1.1", "Mill certs"], overdueScars: 0, currency: "USD", commodity: "Tank steel plate, subcontract fabrication" },
  { id: "VEN-TBD-0107", name: "Laurentian Insulation Papers", country: "CA", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001"], overdueScars: 0, currency: "CAD", commodity: "Kraft paper, pressboard" },
  { id: "VEN-TBD-0108", name: "Heartland Radiator Works", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO 9001"], overdueScars: 0, currency: "USD", commodity: "Radiators, conservators" },
  { id: "VEN-TBD-0109", name: "Cascade Crate & Pallet", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ISPM 15"], overdueScars: 0, currency: "USD", commodity: "Packaging" },
  { id: "VEN-TBD-0110", name: "Meridian Relay & Control", country: "US", onboarding: "Under Review", quality: "Conditional", complianceDocs: ["ISO 9001"], overdueScars: 0, currency: "USD", commodity: "Protection relays, control cabinets" },
  { id: "VEN-TBD-0111", name: "Saguaro Gasket Supply", country: "MX", onboarding: "Docs Pending", quality: "Conditional", complianceDocs: [], overdueScars: 0, currency: "USD", commodity: "Gaskets, seals" },
  { id: "VEN-TBD-0112", name: "Tri-State Bushing Components", country: "US", onboarding: "Active", quality: "Restricted", complianceDocs: ["ISO 9001"], overdueScars: 2, currency: "USD", commodity: "LV bushings, terminals" },
  { id: "VEN-TBD-0113", name: "Coastal Coatings Ltd.", country: "CA", onboarding: "Active", quality: "Disqualified", complianceDocs: ["ISO 9001"], overdueScars: 3, currency: "CAD", commodity: "Paint systems" },
  { id: "VEN-TBD-0114", name: "Precision Cal Services", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["ISO/IEC 17025"], overdueScars: 0, currency: "USD", commodity: "Instrument calibration (service)" },
  { id: "VEN-TBD-0115", name: "Kitami Instrument Transformers", country: "JP", onboarding: "Draft", quality: "Conditional", complianceDocs: [], overdueScars: 0, currency: "USD", commodity: "Current transformers" },
  { id: "VEN-TBD-0116", name: "Great Plains Heavy Haul", country: "US", onboarding: "Active", quality: "Approved", complianceDocs: ["USDOT", "Insurance certificate"], overdueScars: 0, currency: "USD", commodity: "Heavy-haul freight (carrier)" },
]

export const AVL: AvlEntry[] = [
  { id: "AVL-TBD-0001", itemId: "RAW-TBD-CRGO23", vendorId: "VEN-TBD-0101", rank: 1, status: "Qualified", priceBasis: "Info record + CRGO surcharge" },
  { id: "AVL-TBD-0002", itemId: "RAW-TBD-CTC", vendorId: "VEN-TBD-0102", rank: 1, status: "Qualified", priceBasis: "Info record + copper surcharge" },
  { id: "AVL-TBD-0003", itemId: "RAW-TBD-OLTC", vendorId: "VEN-TBD-0103", rank: 1, status: "Qualified", priceBasis: "Quote per STP" },
  { id: "AVL-TBD-0004", itemId: "RAW-TBD-BSH145", vendorId: "VEN-TBD-0104", rank: 1, status: "Conditional", priceBasis: "Info record", faiRef: "FAI-TBD-0031 open" },
  { id: "AVL-TBD-0005", itemId: "RAW-TBD-OIL", vendorId: "VEN-TBD-0105", rank: 1, status: "Qualified", priceBasis: "Contract" },
  { id: "AVL-TBD-0006", itemId: "RAW-TBD-PLATE", vendorId: "VEN-TBD-0106", rank: 1, status: "Qualified", priceBasis: "Info record" },
  { id: "AVL-TBD-0007", itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0112", rank: 1, status: "Suspended", priceBasis: "Info record" },
  { id: "AVL-TBD-0008", itemId: "RAW-TBD-BSH015", vendorId: "VEN-TBD-0104", rank: 2, status: "Qualified", priceBasis: "Info record" },
  { id: "AVL-TBD-0009", itemId: "RAW-TBD-KRAFT", vendorId: "VEN-TBD-0107", rank: 1, status: "Qualified", priceBasis: "Contract" },
  { id: "AVL-TBD-0010", itemId: "RAW-TBD-RAD", vendorId: "VEN-TBD-0108", rank: 1, status: "Qualified", priceBasis: "Info record" },
]

export const vendorById = (id: string) => VENDORS.find((v) => v.id === id)
