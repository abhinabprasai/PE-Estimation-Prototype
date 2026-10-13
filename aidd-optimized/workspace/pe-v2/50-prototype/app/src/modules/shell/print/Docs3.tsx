// Print outputs, part 3: email notification templates (list) and the eleven label classes (index and detail).
import { useState, type ReactNode } from "react"
import { Link, useParams } from "react-router"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chip } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { useSlice } from "@/store"
import { cn } from "@/lib/utils"
import { shellActions } from "../data/actions"
import { Panel } from "../kit"
import { Barcode128, QrPlaceholder } from "./parts"

// ====================================================================================== email templates
interface Tpl {
  id: string
  name: string
  trigger: string
  to: string
  subject: string
  body: string
  vars: string[]
  note?: string
}
const TPLS: Tpl[] = [
  { id: "EML-APR-REQ", name: "Approval requested", trigger: "approval.requested", to: "The next approver in the chain", subject: "Approval needed: {title}", body: "{requester} asks for your approval of {title} ({amount}). Step {step} of {steps}. You can approve or reject from this email with a signed link, or open the inbox. The link works for {hours} hours and only once.", vars: ["requester", "title", "amount", "step", "steps", "hours"], note: "Signed-link actions, expiry and already-actioned states are on the mobile approval entry." },
  { id: "EML-APR-REM", name: "Approval reminder", trigger: "Step SLA reminder cadence", to: "The current approver", subject: "Reminder: {title} waits for you", body: "{title} has waited {elapsed} hours of a {sla} hour SLA. Please decide, or delegate for your absence.", vars: ["title", "elapsed", "sla"] },
  { id: "EML-APR-ESC", name: "SLA breach escalation", trigger: "Step SLA breached", to: "The approver's manager", subject: "Escalation: {title} breached its SLA", body: "{approver} has not decided {title} within {sla} hours. It now waits for you as the role's manager.", vars: ["title", "approver", "sla"] },
  { id: "EML-APR-DEC", name: "Decision notice", trigger: "approval.decided", to: "The requester", subject: "{title}: {outcome}", body: "{approver} {outcome} {title}. Comment: {comment}.", vars: ["title", "approver", "outcome", "comment"] },
  { id: "EML-QT-ISS", name: "Quotation issued", trigger: "Quotation to Issued", to: "Customer contact", subject: "Quotation {id} from PE Transformer", body: "Please find quotation {id} attached for {project}. It is valid until {valid}. Reply to accept or ask for changes.", vars: ["id", "project", "valid"] },
  { id: "EML-SO-CNF", name: "Order confirmation", trigger: "Sales order Confirmed", to: "Customer contact", subject: "Order confirmation {id}", body: "We confirm your order {id}. The confirmation PDF is attached. The first milestone invoice request follows acceptance.", vars: ["id"] },
  { id: "EML-DLV-ASN", name: "Shipment notice", trigger: "Delivery PGI", to: "Customer contact", subject: "Shipment {delivery} is on its way", body: "Shipment {delivery} left on {date}. Carrier {carrier}. The packing list and bill of lading are attached.", vars: ["delivery", "date", "carrier"] },
  { id: "EML-PO-SENT", name: "Purchase order to vendor", trigger: "PO Sent", to: "Vendor contact", subject: "Purchase order {id}", body: "Purchase order {id} is attached. Please confirm within 3 business days. Certificates are required with each shipment.", vars: ["id"] },
  { id: "EML-RFQ-INV", name: "RFQ invite", trigger: "RFQ Issued", to: "Invited vendors", subject: "Request for quotation {id}", body: "You are invited to quote on {item}. Reply by {due} on the attached response form. The bid is sealed until technical review is complete.", vars: ["id", "item", "due"] },
  { id: "EML-RFQ-REG", name: "RFQ regret", trigger: "RFQ Awarded", to: "Bidders not awarded", subject: "RFQ {id}: outcome", body: "Thank you for your response to {id}. The award went to another bidder. We will invite you again for suitable items.", vars: ["id"] },
  { id: "EML-RMA-AUTH", name: "RMA authorized", trigger: "RMA Authorized", to: "Customer contact", subject: "Return authorized: {id}", body: "Your return {id} is authorized. Print the attached instructions and place them outside the package. Ship within {days} days.", vars: ["id", "days"] },
  { id: "EML-SCAR", name: "SCAR to vendor", trigger: "SCAR raised", to: "Vendor quality contact", subject: "Supplier corrective action request {id}", body: "A nonconformance on {item} needs your corrective action. Respond by {due} on the SCAR response form.", vars: ["id", "item", "due"] },
  { id: "EML-CAL-DUE", name: "Calibration due", trigger: "Alert at 30, 14 and 3 days", to: "Quality engineer, Test technician", subject: "Calibration due in {days} days: {instrument}", body: "{instrument} is due {due}. When overdue, the final-test interlock blocks use (E-QM-05).", vars: ["days", "instrument", "due"] },
  { id: "EML-RCL-NOT", name: "Recall external notification", trigger: "Recall Notify stage", to: "Customers in the population", subject: "Safety notice: {campaign}", body: "{text}", vars: ["campaign", "text"], note: "The text needs dual approval: Quality Manager and an executive (C-52) before it can send." },
  { id: "EML-INV-REQ", name: "Milestone invoice requested", trigger: "Milestone completed", to: "Finance", subject: "Invoice request {id}: {milestone}", body: "Milestone {milestone} on {order} is complete. Evidence is attached for review. The reviewer is not the order owner.", vars: ["id", "milestone", "order"] },
  { id: "EML-DIGEST", name: "Alert digest", trigger: "Daily digest schedule", to: "Users with digest on", subject: "Your PE alerts for {date}", body: "{count} non-critical alerts, folded by rule. Critical alerts are never held back for a digest.", vars: ["date", "count"] },
]
const SAMPLE: Record<string, string> = { requester: "Olivia Grant", title: "PO-TBD-0377", amount: "$207,900", step: "1", steps: "1", hours: "48", elapsed: "20", sla: "24", approver: "Rebecca Thorne", outcome: "approved", comment: "Within budget", id: "QT-TBD-0301-V2", project: "Omaha North 115 kV substation", valid: "Jan 11, 2026", delivery: "DLV-TBD-0031", date: "Aug 11, 2026", carrier: "Great Plains Heavy Haul", item: "RAW-TBD-OLTC", due: "Feb 6, 2026", days: "14", instrument: "Hipot tester 60 kV", campaign: "RCL-2026-001", text: "[Approved text goes here]", milestone: "Production Complete / Tested", order: "SO-2026-00301", count: "5" }
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`)

export function EmailTemplatesPage() {
  const [sel, setSel] = useState<Tpl>(TPLS[0])
  const [vals, setVals] = useState<Record<string, string>>(SAMPLE)
  return (
    <ListPage
      header={{ title: "Email notification templates", screenId: "FX-PRN-EMAIL", description: "Every outgoing email, with its trigger, recipients and the variables it fills. The preview fills sample values; edit them to see the result.", chips: <Chip kind="design" note="Wording is placeholder; the PRD names the notifications, not their text">Wording is provisional</Chip>, actions: <Link to="/configuration/notification-templates" className="text-sm text-link underline">Template manager</Link> }}
      table={{ rows: TPLS, rowId: (t) => t.id, columns: [{ id: "id", header: "Id", value: (t) => t.id, mono: true, sortable: true }, { id: "name", header: "Template", cell: (t) => <button className="text-link underline" onClick={() => setSel(t)}>{t.name}</button>, value: (t) => t.name, sortable: true }, { id: "trigger", header: "Trigger", value: (t) => t.trigger, filterable: true }, { id: "to", header: "Recipients", value: (t) => t.to, filterable: true }, { id: "vars", header: "Variables", value: (t) => t.vars.length, align: "right" }], searchText: (t) => `${t.name} ${t.trigger} ${t.subject}`, onRowClick: setSel, activeId: sel.id, empty: { title: "No template matches" } }}
      below={
        <Panel title={`Preview: ${sel.name}`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              {sel.vars.map((k) => (
                <div key={k} className="grid grid-cols-[100px_1fr] items-center gap-2">
                  <Label htmlFor={`v-${k}`} className="font-mono text-xs">
                    {`{${k}}`}
                  </Label>
                  <Input id={`v-${k}`} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="h-8" />
                </div>
              ))}
              {sel.note && <p className="text-xs text-muted-foreground">{sel.note}</p>}
              <p className="text-xs text-muted-foreground">Trigger: {sel.trigger} · To: {sel.to}</p>
            </div>
            <article aria-label="Email preview" className="flex flex-col gap-2 rounded-md border p-4 text-sm">
              <p className="text-xs text-muted-foreground">From: PE Transformer ERP &lt;no-reply&gt;</p>
              <p className="font-semibold">{fill(sel.subject, vals)}</p>
              <p>{fill(sel.body, vals)}</p>
              {sel.id === "EML-APR-REQ" && (
                <p className="flex gap-2">
                  <span className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Approve</span>
                  <span className="rounded-md border px-3 py-1">Reject</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">Sent by PE Transformer ERP. Do not forward: signed links act as you.</p>
            </article>
          </div>
          <Button variant="outline" className="self-start" onClick={() => toast.success(`Test of ${sel.id} sent to you (simulated)`)}>
            Send a test to me
          </Button>
        </Panel>
      }
    />
  )
}

// ====================================================================================== labels
export interface LabelClass {
  id: string
  name: string
  w: number
  h: number
  stock: string
  printer: string
  content: string
  scan: string
  flows: string
  source: string
}
export const LABELS: LabelClass[] = [
  { id: "hu", name: "Handling unit label", w: 4, h: 6, stock: "Coated paper, wax-resin", printer: "ZT411 (pack)", content: "PE branding block; HU number (Code128, human readable); SSCC-18 (GS1-128, AI 00) when the customer requires GS1; ship-to; gross and net weight; HU x of y; hazmat diamond when flagged; handling pictograms (this way up, keep dry)", scan: "SP-17 (print at HU close, scan back)", flows: "FL-01, FL-09", source: "[DOC:p.31 §5.4; p.240 Figure V-15]" },
  { id: "contents", name: "HU contents label", w: 4, h: 6, stock: "Coated paper, wax-resin", printer: "ZT411 (pack)", content: "Item, description, quantity, batch or serial list (or see packing list beyond 10 serials), customer PO number, SO number", scan: "SP-17", flows: "FL-09", source: "[DOC:p.31 §5.4]" },
  { id: "batch", name: "Batch label", w: 4, h: 2, stock: "Polypropylene, resin ribbon", printer: "ZT411", content: "Batch number (Code128) with optional QR of item, vendor batch and expiry; item; vendor batch or heat number; manufacture and expiry dates; quantity at print; QI status at print", scan: "SP-02 (printed label is scanned back)", flows: "FL-03, FL-11", source: "[DOC:Book I F §1; p.240 Figure V-16]" },
  { id: "item", name: "Item shelf label", w: 2, h: 1, stock: "Polypropylene, resin ribbon", printer: "ZD621", content: "Material code (Code128), item name, UoM, human readable", scan: "Shelf lookup", flows: "FL-11", source: "[DOC:Book I F §1; p.239 §8.3]" },
  { id: "serial", name: "Serial label (components)", w: 4, h: 2, stock: "Polyester, resin (durable)", printer: "ZT411", content: "Serial number (Code128, format PE-...), item, batch, date", scan: "SP-03", flows: "FL-03, FL-11", source: "[DOC:Book I F §1; p.239 §8.3]" },
  { id: "location", name: "Location / rack label", w: 4, h: 1, stock: "Reflective, long-range reads", printer: "ZT411", content: "Location code (Code128), large human-readable code, zone", scan: "SP-04, SP-20", flows: "FL-11", source: "[DOC:Book I F §1; p.239 §8.3]" },
  { id: "traveler", name: "Traveler operation strip", w: 8.5, h: 1.2, stock: "Letter laser sheets in a packet", printer: "Office laser", content: "WO and operation composite barcode WO#|OP#, work center, description, standard hours", scan: "SP-10, SP-11", flows: "FL-04", source: "[DOC:Book I D §5.4]" },
  { id: "rma", name: "RMA return label", w: 4, h: 2, stock: "On the return instructions PDF", printer: "Office laser", content: "RMA number Code128, customer, authorized serial", scan: "SP-19", flows: "FL-05", source: "[DOC:p.22 §3.3; Book I F §1]" },
  { id: "badge", name: "Operator badge", w: 3.4, h: 2.1, stock: "Badge card", printer: "Badge printer (not specified)", content: "User ID Code128, name, photo placeholder, work-center assignment", scan: "SP-07", flows: "FL-04", source: "[DOC:Book I F §1]" },
  { id: "calibration", name: "Calibration asset label", w: 1, h: 0.5, stock: "Polyester", printer: "ZD621", content: "CAL ID Code128, due date", scan: "SP-14", flows: "FL-04", source: "[DOC:Book I E §7; p.239 §8.3]" },
  { id: "nameplate", name: "Nameplate data sheet and serial plate", w: 6, h: 4, stock: "Engraved plate with PE-supplied barcode plate", printer: "Existing engraver", content: "Rating data, serial, manufacture date, barcode plate with the serial", scan: "SP-13 (nameplate verification at WC-600)", flows: "FL-04", source: "[DOC:p.238 §8.2; Book I F §1]" },
]
const DPI = 96
const U = (n: number) => Math.round(n * DPI)

/** One label rendered at physical proportion (96 px per inch). */
export function LabelArt({ c, value, scale = 1 }: { c: LabelClass; value: string; scale?: number }) {
  const body: ReactNode = (() => {
    switch (c.id) {
      case "hu":
        return (
          <div className="flex h-full flex-col gap-2 p-3 text-xs">
            <div className="flex items-center justify-between border-b-2 pb-1">
              <span className="text-lg font-bold">PE Transformer</span>
              <span className="rounded border px-1 font-bold">HU 1 of 2</span>
            </div>
            <Barcode128 value={value} height={64} />
            <p className="font-mono text-[11px]">SSCC-18 (AI 00): 00 0 1234567 000188 4</p>
            <Barcode128 value="00012345670001884" height={36} label={false} />
            <p>Ship to: Project laydown, 16500 Fort Street, Omaha, NE 68116</p>
            <p>Gross 41,620 kg · Net 41,200 kg</p>
            <div className="mt-auto flex items-end gap-3">
              <span className="flex size-14 rotate-45 items-center justify-center border-2 text-[9px] font-bold"><span className="-rotate-45">HAZMAT</span></span>
              <span className="border px-1">This way up</span>
              <span className="border px-1">Keep dry</span>
            </div>
          </div>
        )
      case "contents":
        return (
          <div className="flex h-full flex-col gap-1 p-3 text-xs">
            <p className="text-base font-bold">Contents</p>
            <p>RAW-TBD-BSH145 · HV condenser bushing 145 kV</p>
            <p>Qty 3 EA</p>
            <p>Serials: SN-TBD-BSH-0301, SN-TBD-BSH-0302, SN-TBD-BSH-0303</p>
            <p>Customer PO MP-4471-A · SO {value}</p>
            <Barcode128 value={value} height={48} className="mt-auto" />
          </div>
        )
      case "batch":
        return (
          <div className="flex h-full gap-2 p-2 text-[11px]">
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-sm font-bold">RAW-TBD-BSH145</p>
              <p>Vendor Hanseong · heat HP-26-0412</p>
              <p>Qty 9 EA · mfg 2026-04 · QI Hold</p>
              <Barcode128 value={value} height={36} className="mt-auto" />
            </div>
            <QrPlaceholder label={value} size={56} />
          </div>
        )
      case "item":
        return (
          <div className="flex h-full flex-col items-center justify-between p-1 text-[9px]">
            <p className="font-bold">RAW-TBD-OLTC</p>
            <Barcode128 value={value} height={22} label={false} />
            <p>Tap changer · EA</p>
          </div>
        )
      case "serial":
        return (
          <div className="flex h-full flex-col gap-0.5 p-2 text-[11px]">
            <p className="text-sm font-bold">Serial</p>
            <Barcode128 value={value} height={36} />
            <p>RAW-TBD-BSH145 · batch BAT-TBD-B0301 · 2026-05-04</p>
          </div>
        )
      case "location":
        return (
          <div className="flex h-full items-center justify-between gap-3 bg-muted p-2">
            <span className="text-3xl font-bold">{value}</span>
            <Barcode128 value={value} height={44} label={false} />
          </div>
        )
      case "traveler":
        return (
          <div className="flex h-full items-center justify-between gap-3 p-2 text-xs">
            <div>
              <p className="font-bold">Operation 70</p>
              <p>WC-400 Final Assembly and Fittings · 60 h</p>
            </div>
            <Barcode128 value={value} height={48} />
          </div>
        )
      case "rma":
        return (
          <div className="flex h-full flex-col gap-1 p-3 text-xs">
            <p className="text-base font-bold">RETURN</p>
            <Barcode128 value={value} height={48} />
            <p>Midland Plains Grid Constructors · authorized serial SN-TBD-BSH-0302</p>
          </div>
        )
      case "badge":
        return (
          <div className="flex h-full flex-col gap-1 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex size-14 items-center justify-center border text-[9px]">Photo</span>
              <div>
                <p className="text-sm font-bold">Anna Kowal</p>
                <p>Operator · WC-400</p>
              </div>
            </div>
            <Barcode128 value={value} height={30} className="mt-auto" />
          </div>
        )
      case "calibration":
        return (
          <div className="flex h-full flex-col items-center justify-center text-[7px] leading-none">
            <Barcode128 value={value} height={16} label={false} />
            <span>{value} · due 2026-10-23</span>
          </div>
        )
      default:
        return (
          <div className="flex h-full flex-col gap-2 p-4 text-xs">
            <p className="text-center text-lg font-bold">PE TRANSFORMER</p>
            <div className="grid grid-cols-2 gap-1">
              <span>Rating 20 MVA ONAN / 26.7 ONAF</span>
              <span>115 kV / 13.8 kV</span>
              <span>3-phase 60 Hz</span>
              <span>Mfg 2026-07</span>
              <span>Mass 41,620 kg</span>
              <span>Oil: mineral</span>
            </div>
            <div className="mt-auto flex items-end justify-between">
              <Barcode128 value={value} height={32} />
              <span className="border px-1">Serial plate</span>
            </div>
          </div>
        )
    }
  })()
  return (
    <div className="origin-top-left" style={{ width: U(c.w) * scale, height: U(c.h) * scale }}>
      <div role="img" aria-label={`${c.name} preview, ${c.w} by ${c.h} inches`} className="overflow-hidden border-2 bg-card text-card-foreground" style={{ width: U(c.w), height: U(c.h), transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {body}
      </div>
    </div>
  )
}
const DEFAULT_VALUE: Record<string, string> = { hu: "HU-TBD-0188", contents: "SO-2026-00301", batch: "BAT-TBD-B0301", item: "RAW-TBD-OLTC", serial: "SN-TBD-BSH-0301", location: "A-03-02", traveler: "WO-TBD-0301|OP70", rma: "RMA-TBD-0012", badge: "BDG-7032", calibration: "CAL-TBD-022", nameplate: "SN-TBD-20M-0301" }

export function LabelsIndexPage() {
  return (
    <DetailPage
      header={{ title: "Label layouts, print-ready", screenId: "FX-PRN-LABELS", description: "The eleven label classes at physical proportion. Open one to set its values and print. Content follows the specification's label tables; stock and printers are from section 8.3.", chips: <Chip kind="design" note="Label printer resolution is an open decision (300 dpi named for ZT411 and ZD621)">Printer DPI open</Chip> }}
      tabs={[
        {
          id: "gallery",
          label: "Gallery",
          count: LABELS.length,
          content: (
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {LABELS.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-lg border p-4">
                  <Link to={`/print/labels/${c.id}`} className="font-semibold text-link underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.w} x {c.h} in · {c.printer}
                  </p>
                  <div className="overflow-hidden">
                    <LabelArt c={c} value={DEFAULT_VALUE[c.id]} scale={c.w > 5 ? 0.4 : 0.6} />
                  </div>
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: "table",
          label: "Specification table",
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left">
                  <tr>
                    <th className="p-2">Class</th>
                    <th className="p-2">Size (in)</th>
                    <th className="p-2">Stock</th>
                    <th className="p-2">Printer</th>
                    <th className="p-2">Scan point</th>
                    <th className="p-2">Flows</th>
                  </tr>
                </thead>
                <tbody>
                  {LABELS.map((c) => (
                    <tr key={c.id} className="border-t align-top">
                      <td className="p-2">
                        <Link to={`/print/labels/${c.id}`} className="text-link underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="tabular p-2">{c.w} x {c.h}</td>
                      <td className="p-2">{c.stock}</td>
                      <td className="p-2">{c.printer}</td>
                      <td className="p-2">{c.scan}</td>
                      <td className="p-2">{c.flows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
    />
  )
}

export function LabelDetailPage() {
  const { id } = useParams()
  const c = LABELS.find((x) => x.id === id)
  const s = useSlice("shell")
  const [value, setValue] = useState(DEFAULT_VALUE[id ?? ""] ?? "")
  const [copies, setCopies] = useState("1")
  const [ask, setAsk] = useState(false)
  if (!c)
    return (
      <div className="flex flex-col gap-2">
        <p>No label class “{id}”.</p>
        <Link to="/print/labels" className="text-link underline">
          All label classes
        </Link>
      </div>
    )
  const doc = `Label ${c.id} ${value}`
  const reprint = s.printLog.some((p) => p.doc === doc)
  const go = (reason?: string) => {
    const n = Number(copies)
    if (!Number.isInteger(n) || n < 1 || n > 500) return "Copies must be a whole number from 1 to 500."
    const r = shellActions.logPrint(doc, reason)
    if (!r.ok) return r.error
    toast.success(`${n} x ${c.name} sent to ${c.printer} (simulated) and logged`)
    return null
  }
  const report = (e: string | null) => {
    if (e) toast.error(e)
  }
  return (
    <>
    <DetailPage
      header={{ title: c.name, screenId: "FX-PRN-LABELS", crumbs: [{ label: "Label layouts", to: "/print/labels" }, { label: c.name }], description: c.content, primary: <Button onClick={() => (reprint ? setAsk(true) : report(go()))}><Printer aria-hidden="true" /> {reprint ? "Reprint" : "Print"}</Button> }}
      tabs={[
        {
          id: "label",
          label: "Label",
          content: (
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
              <div className="overflow-auto">
                <LabelArt c={c} value={value} scale={c.w > 5 ? 0.7 : 1} />
              </div>
              <div className="flex max-w-md flex-col gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="lbl-value">Barcode value</Label>
                  <Input id="lbl-value" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="lbl-copies">Copies</Label>
                  <Input id="lbl-copies" inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} className="w-24" />
                </div>
                <dl className="grid gap-1 text-sm">
                  {[["Size", `${c.w} x ${c.h} in`], ["Stock", c.stock], ["Printer", c.printer], ["Scan point", c.scan], ["Flows", c.flows], ["Source", c.source]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">Code128 is the one internal symbology; GS1-128 appears only for the SSCC-18 on a handling-unit label. The preview draws format-correct bars; confirm scanning on the real printer. A reprint needs a reason.</p>
                {reprint && <p className={cn("text-sm")}>Printed before: the next print is a reprint and asks for a reason.</p>}
              </div>
            </div>
          ),
        },
        { id: "others", label: "Other classes", content: <ul className="grid gap-1 md:grid-cols-2">{LABELS.map((x) => <li key={x.id}><Link to={`/print/labels/${x.id}`} className={cn("text-link underline", x.id === c.id && "font-semibold")}>{x.name}</Link></li>)}</ul> },
      ]}
    />
    <DialogShell open={ask} onOpenChange={setAsk} title={`Reprint ${c.name}?`} consequence="This label was printed before. The reprint is logged with your reason." requireReason reasonLabel="Reason for the reprint (required)" confirmLabel="Reprint" onConfirm={(r) => go(r)} />
    </>
  )
}
