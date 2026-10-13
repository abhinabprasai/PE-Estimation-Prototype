// Bulk import templates (Book II §16.2): one template per view, versioned. The PRD names XLSX files;
// the prototype exports and reads CSV with the same columns (RD-MM-33). The first line is
// "# template: <view> <version>". A file whose columns differ from the current template is rejected
// whole with a per-column diff; a file that matches creates MCRs (new materials) or MCHs (changes).

export const TEMPLATE_VERSION = "v3"

export interface ImportTemplate {
  view: string
  /** "new" creates MCRs (C-47: creation only through an MCR); "change" creates one MCH per changed column. */
  mode: "new" | "change"
  columns: string[]
  /** For "change": CSV column to MaterialViews / material field key. */
  fieldKeys?: Record<string, string>
  sample: string[][]
  note: string
}

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    view: "General", mode: "new", note: "New materials: each valid row opens a Material Creation Request.",
    columns: ["Description", "Type", "Group L1", "Group L2", "Base UoM", "Manufacturer", "Manufacturer part", "Serial profile"],
    sample: [
      ["Cooling fan 400 mm, 480 V, IP55", "RAW", "BSH Components", "Auxiliary", "EA", "Fabrik Motoren", "FM-FAN-400-480", ""],
      ["Gasket kit, bushing flange, 145 kV", "RAW", "BSH Components", "Seals", "EA", "Hanbit Power", "HPP-GSK-145", ""],
    ],
  },
  {
    view: "Planning", mode: "change", note: "Planning fields on existing materials: each changed column opens one MCH.",
    columns: ["Material", "MRP type", "Procurement type", "Lot sizing", "Planned delivery time (days)", "GR processing time (days)"],
    fieldKeys: { "MRP type": "mrpType", "Procurement type": "procurement", "Lot sizing": "lotSizing", "Planned delivery time (days)": "plannedDeliveryDays", "GR processing time (days)": "grProcDays" },
    sample: [
      ["RAW-TBD-CRGO23", "", "", "", "42", ""],
      ["RAW-TBD-CTC", "", "", "", "35", "2"],
      ["RAW-TBD-OIL", "", "", "", "0", ""],
    ],
  },
  {
    view: "Purchasing", mode: "change", note: "Purchasing fields on existing materials.",
    columns: ["Material", "Over-delivery tolerance %", "Purchasing text"],
    fieldKeys: { "Over-delivery tolerance %": "overTolPct", "Purchasing text": "purchText" },
    sample: [["RAW-TBD-CRGO23", "5", "Mill cert per heat with each coil"]],
  },
  {
    view: "Accounting and Costing", mode: "change", note: "Class 2 fields: the Controller path applies (a method change uses the valuation variant of the change wizard instead).",
    columns: ["Material", "Valuation class", "Profit center"],
    fieldKeys: { "Valuation class": "valuationClass", "Profit center": "profitCenterId" },
    sample: [["RAW-TBD-CTC", "", "PC-200"]],
  },
  {
    view: "Sales", mode: "change", note: "Sellable flag on existing materials (Class 2).",
    columns: ["Material", "Sellable"],
    fieldKeys: { Sellable: "sellable" },
    sample: [["SPARE-TBD-BSH145", "Yes"]],
  },
]
export const templateOf = (view: string) => IMPORT_TEMPLATES.find((t) => t.view === view)

// ------------------------------------------------------------------ CSV
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export function toCsv(t: ImportTemplate, rows: string[][] = []) {
  return [`# template: ${t.view} ${TEMPLATE_VERSION}`, t.columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")
}
export function parseCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length)
  const parseLine = (l: string) => {
    const out: string[] = []
    let cur = ""
    let q = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (q) {
        if (c === '"' && l[i + 1] === '"') (cur += '"', i++)
        else if (c === '"') q = false
        else cur += c
      } else if (c === '"') q = true
      else if (c === ",") (out.push(cur), (cur = ""))
      else cur += c
    }
    out.push(cur)
    return out.map((x) => x.trim())
  }
  let head: { view: string; version: string } | undefined
  if (lines[0]?.startsWith("#")) {
    const m = /#\s*template:\s*(.+?)\s+(v\d+)\s*$/i.exec(lines[0])
    if (m) head = { view: m[1], version: m[2].toLowerCase() }
    lines.shift()
  }
  const header = lines.length ? parseLine(lines[0]) : []
  return { head, header, rows: lines.slice(1).map(parseLine) }
}
/** Per-column diff against the current template (§16.2): any difference rejects the file. */
export function diffColumns(t: ImportTemplate, header: string[], version?: string) {
  const out: { column: string; issue: string }[] = []
  if (version && version !== TEMPLATE_VERSION) out.push({ column: "Template version", issue: `File is ${version}; the current template is ${TEMPLATE_VERSION}` })
  for (const c of t.columns) if (!header.includes(c)) out.push({ column: c, issue: "Column missing: it is part of the current template" })
  for (const h of header) if (!t.columns.includes(h)) out.push({ column: h || "(blank)", issue: "Column not in the current template (removed or renamed)" })
  return out
}
