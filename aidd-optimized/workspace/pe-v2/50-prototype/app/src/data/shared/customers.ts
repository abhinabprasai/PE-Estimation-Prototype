// Customer master shared by every module: utilities, municipals, EPC contractors, a distributor and
// industrial plants in the US and Canada. All fictitious (GUARDRAILS 7).
// IDs, names, statuses, limits and addresses are the same as the FL-09 sales seed
// (src/modules/sales/data/seed.ts), which keeps its own credit-exposure copy for the walked path.

import type { Customer } from "@/data/domain"

type Row = [Customer["id"], string, Customer["class"], Customer["status"], "USD" | "CAD", string, number, boolean, "A" | "B" | "C", string, string, string]
const ROWS: Row[] = [
  ["CUS-TBD-0031", "Prairie Ridge Electric Cooperative", "Utility", "Active", "USD", "DAP", 750000, false, "A", "PO Box 118, Minot, ND 58702", "Substation yard, 4410 County Road 12, Minot, ND 58701", "ND"],
  ["CUS-TBD-0044", "Coopérative d'électricité du Lac-Saint-Jean", "Utility", "Active", "CAD", "DAP", 1200000, false, "B", "215, rue Racine Est, Chicoutimi, QC G7H 1R9", "Poste de distribution, 1880 boul. Sacré-Cœur, Alma, QC G8B 5W1", "QC"],
  ["CUS-TBD-0052", "Northern Saskatchewan Municipal Power and Light Utility Commission, Prince Albert Regional Distribution District", "Municipal government", "Active", "CAD", "FCA", 900000, false, "B", "1084 Central Avenue, Prince Albert, SK S6V 4V7", "Operations yard, 36 River Street West, Prince Albert, SK S6V 2Z1", "SK"],
  ["CUS-TBD-0017", "O'Hara-Bell Electrical Contractors, Inc.", "EPC contractor", "Active", "USD", "EXW", 400000, false, "B", "77 Harbor Point Drive, Duluth, MN 55802", "Job site 2291, Hwy 53 & Rice Lake Rd, Duluth, MN 55811", "MN"],
  ["CUS-TBD-0009", "Volt Co.", "Distributor", "Active", "USD", "FCA", 150000, true, "C", "12 Spark Lane, Sioux Falls, SD 57104", "Dock 3, 12 Spark Lane, Sioux Falls, SD 57104", "SD"],
  ["CUS-TBD-0060", "Bluewater Ridge Solar EPC, LLC", "EPC contractor", "Prospect", "USD", "DAP", 0, false, "C", "500 Lakeview Plaza, Madison, WI 53703", "Not recorded", "WI"],
  ["CUS-TBD-0023", "Cascade Valley Public Utility District", "Utility", "On Hold", "USD", "DAP", 600000, false, "B", "900 Orchard Way, Wenatchee, WA 98801", "Service center, 4102 Malaga Hwy, Wenatchee, WA 98801", "WA"],
  ["CUS-TBD-0038", "Ironworks Mill Industrial Park Ltd.", "Industrial plant", "Blocked", "USD", "FCA", 250000, false, "C", "1 Foundry Road, Gary, IN 46402", "Gate 4, 1 Foundry Road, Gary, IN 46402", "IN"],
  ["CUS-TBD-0011", "Tri-County Rural Electric Association", "Utility", "Inactive", "USD", "DAP", 0, false, "C", "PO Box 40, Hettinger, ND 58639", "Not recorded", "ND"],
  ["CUS-TBD-0027", "Lakeshore Municipal Light & Water", "Municipal government", "Active", "USD", "DAP", 1000000, false, "A", "300 Harbor Street, Manitowoc, WI 54220", "North substation, 2600 Lake Shore Road, Manitowoc, WI 54220", "WI"],
  ["CUS-TBD-0041", "Granite Peak Mining Operations", "Industrial plant", "Active", "USD", "FCA", 500000, false, "B", "88 Ore Road, Butte, MT 59701", "Mill switchyard, 2 Continental Drive, Butte, MT 59701", "MT"],
  ["CUS-TBD-0035", "Fraser Delta Power Contractors Ltd.", "EPC contractor", "Active", "CAD", "DAP", 800000, false, "B", "4400 No. 3 Road, Richmond, BC V6X 2C2", "Site laydown, 7100 River Road, Delta, BC V4G 1B6", "BC"],
  ["CUS-TBD-0048", "Midland Plains Grid Constructors", "EPC contractor", "Active", "USD", "DAP", 5000000, false, "A", "1200 Commerce Street, Omaha, NE 68102", "Project laydown, 16500 Fort Street, Omaha, NE 68116", "NE"],
]

export const CUSTOMERS: Customer[] = ROWS.map(([id, name, cls, status, currency, incoterms, creditLimit, holdFlag, priority, billTo, shipTo, region]) => {
  const country = currency === "CAD" ? "CA" : "US"
  return {
    id, name, class: cls, status, currency, incoterms, creditLimit, holdFlag, priority,
    entityId: currency === "CAD" ? "LE-TBD-30" : "LE-TBD-10",
    priceListId: currency === "CAD" ? "PL-PRC-TBD-CA26" : "PL-PRC-TBD-US26",
    addresses: [
      { kind: "Bill-To", isDefault: true, text: billTo, country },
      { kind: "Ship-To", isDefault: true, text: shipTo, country },
    ],
    contacts: [{ name: "Purchasing desk", role: "Buyer", email: `purchasing@${id.toLowerCase()}.example` }],
    taxProfile: { exempt: cls === "Municipal government", nexus: [region] },
  }
})
