// Print outputs, part 2: PO / RFQ invite / regret notice, cutover paper forms, shipping documents,
// RFQ response form, count document, inspection plan, invoice supplement, as-built spares list.
import { StatusBadge } from "@/components/patterns"
import { CUSTOMERS, HERO, MATERIALS, VENDORS } from "@/data/shared"
import { THRESHOLDS } from "@/data/domain"
import { Barcode128, Block, Facts, Fine, Letterhead, Lines, Money, PrintShell, QrPlaceholder, Sheet, Signatures } from "./parts"

const mp = CUSTOMERS.find((c) => c.id === HERO.customerId)!
const ship = mp.addresses.find((a) => a.kind === "Ship-To")!.text
const v = (id: string) => VENDORS.find((x) => x.id === id)!

// ====================================================================================== PO, RFQ invite, regret
export function PurchaseOrderPrint() {
  const ns = v("VEN-TBD-0101")
  const rw = v("VEN-TBD-0103")
  const hs = v("VEN-TBD-0104")
  return (
    <PrintShell
      screenId="FX-PRN-PO"
      title="PO PDF, RFQ invite and regret notice"
      description="The purchase order sent to a vendor, the RFQ invitation, and the regret notice to bidders who did not win."
      variants={[
        {
          id: "po",
          label: "Purchase order",
          doc: "PO-TBD-0377",
          note: "PO approval ladder: Buyer up to $25k, Purchasing Manager up to $250k, then Controller, CFO above $1M.",
          render: () => (
            <Sheet>
              <Letterhead title="Purchase order" number="PO-TBD-0377" date="Oct 5, 2026" />
              <Facts rows={[["Vendor", `${ns.name} (${ns.id})`], ["Ship to", "PE Transformer receiving, Fargo, ND"], ["Payment terms", "Net 45 (design value)"], ["Incoterms", "DAP"], ["Requisition", "PR-TBD-0377"], ["Approval", "Purchasing Manager band, $207,900"]]} />
              <Lines head={["Line", "Item", "Description", "Qty", "Unit price", "Amount", "Due"]} right={[3, 4, 5]} rows={[["10", "RAW-TBD-CRGO23", "CRGO electrical steel coil, 0.23 mm, grade M-OH", "54,000 KG", <Money key="a" n={3.85} />, <Money key="b" n={207900} />, "Dec 4, 2026"]]} foot={["", "", "PO total", "", "", <Money key="t" n={207900} />, ""]} />
              <Fine>Please confirm within 3 business days. An unconfirmed PO raises an alert to the buyer. Mill certificates are required with each heat (certificate required toggle on).</Fine>
              <Signatures names={["Buyer", "Purchasing Manager"]} />
            </Sheet>
          ),
        },
        {
          id: "invite",
          label: "RFQ invite",
          doc: "RFQ-TBD-0301 invite",
          render: () => (
            <Sheet>
              <Letterhead title="Request for quotation" number="RFQ-TBD-0301" date="Jan 28, 2026" />
              <p>
                To {rw.name}, {rw.country}
              </p>
              <Facts rows={[["Item", "RAW-TBD-OLTC On-load tap changer, 115 kV class, 17 positions"], ["Quantity bands", "1, 2 to 4, 5 or more"], ["Response due", "Feb 6, 2026"], ["Technical package", "STP-000301 version 1"], ["Sealed bid", "Prices are opened only after the technical review"]]} />
              <Fine>Reply on the RFQ response form. Late responses are not opened. Deviations from the technical package must be listed. An RFQ is required for uncontracted spend above ${THRESHOLDS.rfqRequiredAbove.toLocaleString()}.</Fine>
            </Sheet>
          ),
        },
        {
          id: "regret",
          label: "Regret notice",
          doc: "RFQ-TBD-0301 regret",
          render: () => (
            <Sheet>
              <Letterhead title="Notice to bidders" number="RFQ-TBD-0301 / regret" date="Feb 12, 2026" />
              <p>
                To {hs.name}, {hs.country}
              </p>
              <p className="text-xs leading-relaxed">Thank you for your response to RFQ-TBD-0301. After technical and commercial review the award went to another bidder. Your bid is kept on file for the vendor performance record. We value the effort and will invite you again for suitable items.</p>
              <Fine>The notice names no competitor and no price. It is sent when the RFQ moves to Awarded.</Fine>
              <Signatures names={["Buyer"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== cutover forms
const FORMS = [
  { id: "receipt", name: "Receiving log (SP-01 to SP-04)", cols: ["PO", "Item", "Qty", "Vendor batch / heat", "Bin", "Received by"], when: "System unreachable at the dock" },
  { id: "issue", name: "Material issue to work order (SP-08)", cols: ["WO / op", "Component", "Batch / serial", "Qty", "Issued by", "Time"], when: "Kiosk offline longer than the 4 h queue" },
  { id: "op", name: "Operation confirmation (SP-10, SP-11)", cols: ["WO | OP", "Start", "Complete", "Good", "Scrap", "Rework"], when: "Kiosk offline longer than the 4 h queue" },
  { id: "count", name: "Count sheet (SP-20)", cols: ["Bin", "Item", "Batch", "Counted", "Counter", "Time"], when: "Handheld unavailable" },
  { id: "ship", name: "Shipment load sheet (SP-18)", cols: ["HU", "Shipment", "Loaded by", "Time", "Seal", "Remark"], when: "Dock scanner unavailable" },
] as const
export function CutoverPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-CUTOVER"
      title="Cutover fallback paper forms"
      description="Blank forms for the moments the system or a link is down at go-live. Entered later; reconciled by the supervisor."
      variants={FORMS.map((x) => ({
        id: x.id,
        label: x.name.split(" (")[0],
        doc: `Cutover form ${x.id}`,
        note: <>Use when: {x.when}. </>,
        render: () => (
          <Sheet landscape>
            <Letterhead title={x.name} number="Fallback form" />
            <Facts cols={4} rows={[["Date", "__________"], ["Station", "__________"], ["Shift", "__________"], ["Supervisor", "__________"]]} />
            <Lines head={[...x.cols]} rows={Array.from({ length: 12 }, () => x.cols.map(() => " "))} />
            <Fine>Re-enter every line in the system when it returns; mark the form Entered with the user and time. The supervisor reconciles the paper against the queue and signs below. Paper forms are kept 24 months like scan telemetry (reading).</Fine>
            <Signatures names={["Operator", "Supervisor"]} />
          </Sheet>
        ),
      }))}
    />
  )
}

// ====================================================================================== shipping documents
export function ShippingDocsPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-SHIPDOCS"
      title="BOL, CoC, certificate dossier cover and transmittal sheet"
      description="The documents that travel with a shipment and the dossier the customer receives."
      variants={[
        {
          id: "bol",
          label: "Bill of lading",
          doc: "BOL DLV-TBD-0031",
          render: () => (
            <Sheet>
              <Letterhead title="Bill of lading" number="BOL-TBD-0031" date="Aug 11, 2026" />
              <div className="flex justify-between gap-4">
                <Facts rows={[["Shipper", "PE Transformer, Fargo, ND"], ["Consignee", mp.name], ["Deliver to", ship], ["Carrier", "Great Plains Heavy Haul (VEN-TBD-0116)"], ["Incoterms", mp.incoterms], ["Special", "Over-dimensional; permit on file"]]} />
                <Barcode128 value="BOL-TBD-0031" />
              </div>
              <Lines head={["HU", "Type", "Description", "Weight (kg)"]} right={[3]} rows={[["HU-TBD-0188", "Skid", "20 MVA transformer, SN-TBD-20M-0301", "41,620"], ["HU-TBD-0189", "Crate", "Radiators and HV bushings, loose", "925"]]} foot={["", "", "Gross", "42,545"]} />
              <Signatures names={["Shipper", "Carrier", "Consignee"]} />
            </Sheet>
          ),
        },
        {
          id: "coc",
          label: "Certificate of conformance",
          doc: "CoC SN-TBD-20M-0301",
          render: () => (
            <Sheet>
              <Letterhead title="Certificate of conformance" number="CoC-TBD-0301" date="Aug 11, 2026" />
              <p className="text-xs leading-relaxed">
                We certify that serial <strong>{HERO.unitSerial}</strong>, item {HERO.itemId}, sold on {HERO.phase1Order}, was designed, built and tested to the specification on the order and passed the routine tests of IEEE C57.12.90 (final test report FTR-TBD-0301).
              </p>
              <Facts rows={[["Customer", mp.name], ["Work order", "WO-TBD-0301"], ["Drawing set", "DOC-TBD-0301-GA rev C"], ["Test report", "FTR-TBD-0301, PASS"]]} />
              <Signatures names={["Quality Manager"]} />
            </Sheet>
          ),
        },
        {
          id: "dossier",
          label: "Certificate dossier cover",
          doc: "Dossier SN-TBD-20M-0301",
          render: () => (
            <Sheet>
              <Letterhead title="Certificate dossier" number="DOS-TBD-0301" date="Aug 11, 2026" />
              <p className="text-xs">As-built record for {HERO.unitSerial}. Each file carries a checksum recorded when it was stored.</p>
              <Lines head={["#", "Document", "Reference", "Checksum (first 12)"]} rows={[["1", "Final test report", "FTR-TBD-0301", "9f2c41ab07de"], ["2", "Certificate of conformance", "CoC-TBD-0301", "41b8d0e55a13"], ["3", "General arrangement drawing rev C", "DOC-TBD-0301-GA", "c07a99e2314b"], ["4", "Mill certificates, core steel", "heat lots on GRN", "6e1d5f80b2c7"], ["5", "HV bushing certificates", "BAT-TBD-B0301 (under recall)", "d4a7120c8e95"], ["6", "Genealogy report", "T01 to T12", "3ab6e9c14f02"]]} />
              <Fine>The bushing certificates are listed with a recall flag: the batch is under RCL-2026-001.</Fine>
            </Sheet>
          ),
        },
        {
          id: "transmittal",
          label: "Transmittal sheet",
          doc: "TR-TBD-0301",
          render: () => (
            <Sheet>
              <Letterhead title="Drawing transmittal" number="TR-TBD-0301" date="Feb 27, 2026" />
              <Facts rows={[["To", mp.name], ["Purpose", "For approval"], ["Response due", "Mar 13, 2026"], ["Response received", "Approved as noted, Mar 6, 2026"]]} />
              <Lines head={["Document", "Rev", "Title"]} rows={[["DOC-TBD-0301-GA", "C", "General arrangement drawing"], ["DOC-TBD-0301-NP", "A", "Nameplate drawing"]]} />
              <Fine>The response drives the Design Approval milestone (10%). A rejection loops through revise and resubmit.</Fine>
              <Signatures names={["Customer response"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== RFQ response form
export function RfqResponsePrint() {
  const rw = v("VEN-TBD-0103")
  return (
    <PrintShell
      screenId="FX-PRN-RFQRESP"
      title="RFQ vendor response form"
      description="The form a vendor fills in for an RFQ: price by quantity band, lead time, validity and deviations."
      variants={[
        {
          id: "form",
          label: "Response form",
          doc: "RFQ-TBD-0301 response",
          render: () => (
            <Sheet>
              <Letterhead title="RFQ response" number="RFQ-TBD-0301" date="Reply by Feb 6, 2026" />
              <Facts rows={[["Vendor", `${rw.name} (${rw.id})`], ["Item", "RAW-TBD-OLTC, 17 positions, 115 kV class"], ["Technical package", "STP-000301 v1: acknowledge below"], ["Bid version", "V____"]]} />
              <Lines head={["Quantity band", "Unit price (USD)", "Freight", "Duty %", "Lead time (days)", "Valid until"]} rows={["1", "2 to 4", "5 or more"].map((b) => [b, "__________", "__________", "____", "____", "__________"])} />
              <Block title="Deviations from the technical package">
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className="h-5 border-b" />
                  ))}
                </div>
              </Block>
              <Block title="Declaration">
                <Fine>Our prices hold for the validity above. We have read the technical package and list every deviation. We understand bids are sealed until the technical review is complete.</Fine>
              </Block>
              <Signatures names={["Vendor representative"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== count document
const COUNT_LINES = [
  ["A-03-02", "RAW-TBD-BSH145", "BAT-TBD-B0301", "EA", 6],
  ["A-03-05", "RAW-TBD-OLTC", "n/a", "EA", 1],
  ["B-04-02", "RAW-TBD-RAD", "n/a", "EA", 20],
  ["C-01-01", "RAW-TBD-CRGO23", "HEAT-26-117", "KG", 41000],
] as const
export function CountDocPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-COUNT"
      title="Count document print"
      description="The count sheet in two forms: blind for counters and expected for supervisors."
      variants={[
        {
          id: "blind",
          label: "Blind",
          doc: "CNT-TBD-0007 blind",
          note: "Counters never see the expected quantity: the column does not exist on this print (C-37).",
          render: () => (
            <Sheet>
              <Letterhead title="Count document (blind)" number="CNT-TBD-0007" date="Oct 9, 2026" />
              <div className="flex justify-between gap-4">
                <Facts rows={[["Warehouse", "WH-TBD-01 Fargo, ND"], ["State", <StatusBadge key="s" kind="countDocument" status="Counting" size="sm" />], ["Counter", "__________"], ["Recounter must differ from the counter", "__________"]]} />
                <Barcode128 value="CNT-TBD-0007" />
              </div>
              <Lines head={["Bin", "Item", "Batch", "UoM", "Counted", "Time"]} rows={COUNT_LINES.map((l) => [l[0], l[1], l[2], l[3], "__________", "_____"])} />
              <Fine>Locations under an active count are frozen for movements. Recount triggers above {THRESHOLDS.countRecountPct}% or ${THRESHOLDS.countRecountAmount} variance.</Fine>
              <Signatures names={["Counter"]} />
            </Sheet>
          ),
        },
        {
          id: "expected",
          label: "Expected",
          doc: "CNT-TBD-0007 expected",
          note: "Supervisor copy: shows the expected quantity. Never handed to a counter.",
          render: () => (
            <Sheet watermark="Supervisor copy">
              <Letterhead title="Count document (expected)" number="CNT-TBD-0007" date="Oct 9, 2026" />
              <Facts rows={[["Warehouse", "WH-TBD-01 Fargo, ND"], ["State", <StatusBadge key="s" kind="countDocument" status="Counting" size="sm" />]]} />
              <Lines head={["Bin", "Item", "Batch", "UoM", "Expected", "Counted", "Variance"]} right={[4]} rows={COUNT_LINES.map((l) => [l[0], l[1], l[2], l[3], l[4].toLocaleString(), "__________", "_____"])} />
              <Fine>Variance approval: supervisor up to $2,000 per line and $10,000 per document; Controller above $25,000.</Fine>
              <Signatures names={["Supervisor"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== inspection plan
export function InspectionPlanPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-INSPPLAN"
      title="Inspection plan PDF"
      description="IP-TBD-INC-BSH revision 2: incoming inspection of HV bushings."
      variants={[
        {
          id: "plan",
          label: "Inspection plan",
          doc: "IP-TBD-INC-BSH rev 2",
          render: () => (
            <Sheet>
              <Letterhead title="Inspection plan" number="IP-TBD-INC-BSH rev 2" date="Mar 2, 2026" />
              <Facts rows={[["Item", "RAW-TBD-BSH145 HV condenser bushing, 145 kV"], ["Status", <StatusBadge key="s" kind="inspectionPlan" status="Active" size="sm" />], ["Type", "Incoming"], ["Sample", "2 of 9 (design value)"]]} />
              <Lines head={["#", "Characteristic", "Method", "Limit", "Instrument"]} rows={[["1", "Visual: porcelain, flange, oil level", "Visual", "No cracks or weeps", "None"], ["2", "Dimensions: flange and creepage", "Gauge", "Per drawing", "Caliper"], ["3", "Capacitance and tan delta", "Bridge", "Within 5% of nameplate", "CAL-TBD-014"], ["4", "Vendor test certificate present", "Document", "Mandatory before Accept", "None"]]} />
              <Fine>The inspection tightens after {THRESHOLDS.inspectionTightenRejectedOf5} rejected lots of 5 and reduces after {THRESHOLDS.inspectionReduceAfterAccepted} accepted lots. A superseded or obsolete plan opens read-only.</Fine>
              <Signatures names={["Quality engineer", "Quality Manager"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== invoice supplement
export function InvoiceSupplementPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-INVSUPP"
      title="Invoice supplement"
      description="Packing data attached to the invoice: handling units, weights and marks. Accounting prints the invoice itself."
      variants={[
        {
          id: "supp",
          label: "Supplement",
          doc: "Invoice supplement DLV-TBD-0031",
          render: () => (
            <Sheet>
              <Letterhead title="Invoice supplement: packing data" number="IR-TBD-0031 / DLV-TBD-0031" date="Aug 14, 2026" />
              <Facts rows={[["Invoice request", "IR-TBD-0031 Shipment milestone (15%)"], ["Sales order", HERO.phase1Order], ["Customer PO", "MP-4471-A"], ["Bill of lading", "BOL-TBD-0031"]]} />
              <Lines head={["HU", "Type", "Net (kg)", "Gross (kg)", "Marks"]} right={[2, 3]} rows={[["HU-TBD-0188", "Skid", "41,200", "41,620", "This way up; lifting points"], ["HU-TBD-0189", "Crate", "740", "925", "Keep dry"]]} foot={["", "Totals", "41,940", "42,545", ""]} />
              <Fine>Amounts and tax come from the invoice that Finance posts after evidence review; this page carries packing data only.</Fine>
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== spares list
export function SparesListPrint() {
  const spares = MATERIALS.filter((m) => m.type === "SPARE")
  return (
    <PrintShell
      screenId="FX-PRN-SPARES"
      title="As-built spares parts list PDF"
      description="Spare parts for SN-TBD-20M-0301 taken from its as-built record, with service-stock prices."
      variants={[
        {
          id: "spares",
          label: "Spares list",
          doc: "Spares list SN-TBD-20M-0301",
          render: () => (
            <Sheet>
              <Letterhead title="Recommended spare parts" number="SPL-TBD-0301" date="Oct 9, 2026" />
              <div className="flex justify-between gap-4">
                <Facts rows={[["Unit", HERO.unitSerial], ["Customer", mp.name], ["Installed", "Omaha North, commissioned Aug 28, 2026"], ["Installed-base record", "IB-TBD-0301"]]} />
                <QrPlaceholder label="IB-TBD-0301" />
              </div>
              <Lines head={["Part", "Description", "As-built reference", "Recommended qty", "Price"]} right={[3, 4]} rows={spares.map((s) => [s.id, s.description, s.id.includes("BSH") ? "Fitted: SN-TBD-BSH-0301..0303" : s.id.includes("OLTC") ? "Fitted: RAW-TBD-OLTC" : "Tank joint set", s.id.includes("BSH") ? "1" : "1", s.listPrice ? <Money key={s.id} n={s.listPrice} /> : "On request"])} />
              <Fine>Fitted parts come from the as-built genealogy. The HV bushing in this list is from a batch under recall RCL-2026-001: order the replacement only after the campaign names the replacement batch.</Fine>
            </Sheet>
          ),
        },
      ]}
    />
  )
}
