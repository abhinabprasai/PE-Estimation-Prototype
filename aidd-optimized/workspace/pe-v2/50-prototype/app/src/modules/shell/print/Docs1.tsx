// Print outputs, part 1: quote, order and change confirmation, packing list and shipping addendum,
// return instructions and warranty denial letter, traveler and shop packet, final test report.
// Figures are seeded design values consistent with the hero thread (all fictitious).
import { StatusBadge } from "@/components/patterns"
import { CUSTOMERS, HERO, WORK_CENTERS } from "@/data/shared"
import { Barcode128, Block, Facts, Fine, Letterhead, Lines, Money, PrintShell, QrPlaceholder, Sheet, Signatures } from "./parts"
import { THRESHOLDS } from "@/data/domain"

const mp = CUSTOMERS.find((c) => c.id === HERO.customerId)!
const bill = mp.addresses.find((a) => a.kind === "Bill-To")!.text
const ship = mp.addresses.find((a) => a.kind === "Ship-To")!.text
const MILESTONE_ROWS = [["Order Acceptance / Down Payment", "20%", 256800], ["Design Approval", "10%", 128400], ["Major Materials Procured", "20%", 256800], ["Production Complete / Tested", "30%", 385200], ["Shipment", "15%", 192600], ["Delivery / Commissioning Support", "5%", 64200]] as const

// ====================================================================================== quote
export function QuotePrint() {
  return (
    <PrintShell
      screenId="FX-PRN-QUOTE"
      title="Quote PDF"
      description="Commercial quote, ETO datasheet and terms and conditions for QT-TBD-0301-V2."
      variants={[
        {
          id: "commercial",
          label: "Commercial quote",
          doc: "QT-TBD-0301-V2 commercial",
          render: () => (
            <Sheet>
              <Letterhead title="Quotation" number="QT-TBD-0301-V2" date="Dec 12, 2025" />
              <Facts rows={[["Customer", mp.name], ["Customer id", mp.id], ["Bill to", bill], ["Ship to", ship], ["Incoterms", mp.incoterms], ["Valid for", "30 days (design value)"]]} />
              <Block title="Scope">
                <Lines head={["Line", "Item", "Description", "Qty", "Unit price", "Amount"]} right={[3, 4, 5]} rows={[["10", HERO.itemId, "Substation power transformer, ONAN/ONAF, 20 MVA, 115 kV - 13.8 kV, OLTC 17 positions (ETO)", "1 EA", <Money key="a" n={1284000} />, <Money key="b" n={1284000} />]]} foot={["", "", "Total before tax and freight", "", "", <Money key="t" n={1284000} />]} />
              </Block>
              <Block title="Billing milestones (must total 100%)">
                <Lines head={["Milestone", "Share", "Amount"]} right={[1, 2]} rows={MILESTONE_ROWS.map((m) => [m[0], m[1], <Money key={m[0]} n={m[2]} />])} />
              </Block>
              <Fine>Prices exclude sales tax. Tax is estimated at quotation save and recalculated at order. This quotation supersedes QT-TBD-0301-V1.</Fine>
              <Signatures names={["For PE Transformer", "Accepted for Midland Plains Grid Constructors"]} />
            </Sheet>
          ),
        },
        {
          id: "datasheet",
          label: "ETO datasheet",
          doc: "QT-TBD-0301-V2 datasheet",
          note: "Seeded ratings are design values; the engineering request owns the real ones.",
          render: () => (
            <Sheet>
              <Letterhead title="Technical datasheet" number="QT-TBD-0301-V2 / datasheet" date="Dec 12, 2025" />
              <Block title="Ratings">
                <Facts cols={3} rows={[["Rated power", "20 MVA ONAN / 26.7 MVA ONAF"], ["Voltage, HV / LV", "115 kV / 13.8 kV"], ["Phases and frequency", "Three-phase, 60 Hz"], ["Tap changer", "On-load, 17 positions"], ["Cooling", "ONAN / ONAF"], ["Impedance", "8.5% (design value)"], ["Insulating liquid", "Mineral oil"], ["Standards", "IEEE C57.12.00, C57.12.90"], ["Tests", "Routine tests per IEEE C57.12.90; FTR with each unit"]]} />
              </Block>
              <Block title="Major components">
                <Lines head={["Component", "Specification"]} rows={[["HV bushings", "3 x 145 kV, 800 A"], ["LV bushings", "3 x 15 kV, 3,000 A"], ["Tap changer", "RAW-TBD-OLTC, 115 kV class"], ["Radiators", "10 panel banks, hot-dip galvanized"], ["Finish", "ANSI 70 gray polyurethane"]]} />
              </Block>
              <Fine>Dimensions, weights and loss guarantees follow the approved drawing set after Design Approval. Drawings go to the customer by transmittal.</Fine>
            </Sheet>
          ),
        },
        {
          id: "terms",
          label: "Terms and conditions",
          doc: "QT-TBD-0301-V2 terms",
          note: "Clause wording is placeholder text; the legal text is not in the PRD.",
          render: () => (
            <Sheet>
              <Letterhead title="Terms and conditions" number="T&C placeholder" />
              <ol className="list-decimal pl-5 text-xs leading-relaxed">
                {["Prices and validity. Prices are in USD, valid for the period on the quotation.", "Payment. Milestone billing per the plan on the quotation. Each invoice follows evidence of the milestone.", "Delivery. Per the Incoterms stated; over-dimensional units ship on their own delivery.", "Changes. After Design Release a change goes through an engineering change and a sales change order with a cost and schedule quote.", "Warranty. Per the RMA and warranty policy in force at shipment; exclusions are listed in the warranty exclusions catalog.", "Title and risk. Pass per the Incoterms.", "Governing law. To be set by Legal."].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              <Fine>The text of each clause is a placeholder for Legal to supply. Which clauses print for which customer class is a reading.</Fine>
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== order and change confirmation
export function OrderPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-ORDER"
      title="Order and change confirmation PDFs"
      description="Confirmation of SO-2026-00301 and the confirmation of a change after Design Release."
      variants={[
        {
          id: "order",
          label: "Order confirmation",
          doc: "SO-2026-00301 confirmation",
          render: () => (
            <Sheet>
              <Letterhead title="Order confirmation" number="SO-2026-00301" date="Jan 8, 2026" />
              <Facts rows={[["Customer", mp.name], ["Customer PO", "MP-4471-A"], ["Quotation", "QT-TBD-0301-V2"], ["Requested delivery", "Aug 2026"], ["Bill to", bill], ["Ship to", ship]]} />
              <Lines head={["Line", "Item", "Description", "Qty", "Amount"]} right={[3, 4]} rows={[["10", HERO.itemId, "Substation power transformer, 20 MVA, 115 kV - 13.8 kV", "1 EA", <Money key="a" n={1284000} />]]} foot={["", "", "Order total", "", <Money key="t" n={1284000} />]} />
              <Block title="Billing plan">
                <Lines head={["Milestone", "Share", "Amount"]} right={[1, 2]} rows={MILESTONE_ROWS.map((m) => [m[0], m[1], <Money key={m[0]} n={m[2]} />])} />
              </Block>
              <Fine>Acceptance of this confirmation fires the Order Acceptance milestone: invoice request for 20%.</Fine>
            </Sheet>
          ),
        },
        {
          id: "change",
          label: "Change confirmation",
          doc: "SO-2026-00377 change confirmation",
          render: () => (
            <Sheet>
              <Letterhead title="Change confirmation" number="SO-2026-00377 / SCO-TBD-0003" date="Oct 9, 2026" />
              <Facts rows={[["Order", "SO-2026-00377 (phase 2)"], ["Change origin", "ECR via engineering: bushing change after recall RCL-2026-001"], ["Customer", mp.name], ["Requested by", "Engineering Manager, accepted by customer"]]} />
              <Lines head={["Field", "Before", "After"]} rows={[["Line 10 HV bushing", "RAW-TBD-BSH145 batch BAT-TBD-B0301", "RAW-TBD-BSH145 replacement batch (to be received)"], ["Delivery date", "Mar 15, 2027", "Mar 29, 2027"], ["Price", <Money key="a" n={3852000} />, <Money key="b" n={3868500} />]]} />
              <Fine>A configuration change after Design Release goes through an ECR then a Sales Change Order. The change is effective when the customer accepts; the earlier confirmation stays on file.</Fine>
              <Signatures names={["Customer acceptance"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== packing list
const HUS = [
  { hu: "HU-TBD-0188", type: "Skid", dims: "5.2 x 2.9 x 3.4 m", tare: 420, net: 41200, lines: [["FIN-TBD-20MVA", "20 MVA transformer, oil drained", "SN-TBD-20M-0301", "1 EA"]] },
  { hu: "HU-TBD-0189", type: "Crate", dims: "1.8 x 1.2 x 1.4 m", tare: 185, net: 740, lines: [["RAW-TBD-RAD", "Radiator panel banks, shipped loose", "see packing list", "10 EA"], ["RAW-TBD-BSH145", "HV bushings, shipped loose", "SN-TBD-BSH-0301..0303", "3 EA"]] },
]
export function PackingListPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-PACKLIST"
      title="Packing list and transformer shipping addendum"
      description="Letter-size packing list grouped by handling unit and the transformer addendum."
      variants={[
        {
          id: "list",
          label: "Packing list",
          doc: "Packing list DLV-TBD-0031",
          note: "A draft watermark prints until the pack order is complete.",
          render: () => (
            <Sheet watermark="Draft">
              <Letterhead title="Packing list" number="DLV-TBD-0031" date="Aug 11, 2026" />
              <Facts cols={3} rows={[["Sales order", "SO-2026-00301"], ["Customer PO", "MP-4471-A"], ["Shipment", "DLV-TBD-0031"], ["Ship to", ship], ["Incoterms", mp.incoterms], ["Date", "Aug 11, 2026"]]} />
              {HUS.map((h) => (
                <Block key={h.hu} title={`${h.hu} · ${h.type} · ${h.dims} · tare ${h.tare} kg · net ${h.net.toLocaleString()} kg · gross ${(h.tare + h.net).toLocaleString()} kg`}>
                  <Lines head={["Item", "Description", "Batch / serial", "Qty"]} rows={h.lines} />
                </Block>
              ))}
              <Facts cols={4} rows={[["HUs", "2"], ["Net", "41,940 kg"], ["Gross", "42,545 kg"], ["Special instructions", "Keep dry; lift at marked points"]]} />
              <Signatures names={["Packer"]} />
            </Sheet>
          ),
        },
        {
          id: "addendum",
          label: "Transformer addendum",
          doc: "Shipping addendum DLV-TBD-0031",
          note: "Photos are mandatory for transformers: four corner shots and the nameplate.",
          render: () => (
            <Sheet>
              <Letterhead title="Transformer shipping addendum" number="DLV-TBD-0031 / SN-TBD-20M-0301" date="Aug 11, 2026" />
              <Facts rows={[["Serial", "SN-TBD-20M-0301"], ["Nameplate verified (SP-13)", "Scanned equals work-order serial"], ["Oil", "Drained, nitrogen blanket 3 psi"], ["Impact recorder", "Fitted, 3-axis"], ["Over-dimensional", "Yes: own delivery (mandatory split)"], ["Lifting points", "4, marked yellow"]]} />
              <Block title="Photo checklist">
                <ul className="grid grid-cols-5 gap-2 text-xs">
                  {["Corner 1", "Corner 2", "Corner 3", "Corner 4", "Nameplate"].map((p) => (
                    <li key={p} className="flex h-16 items-center justify-center border text-center">
                      {p}
                      <br />
                      attached
                    </li>
                  ))}
                </ul>
              </Block>
              <Fine>Weight sanity at HU close is within ±{THRESHOLDS.huWeightTolerancePct}% of the expected weight (SP-17).</Fine>
              <Signatures names={["Packer", "Quality (pre-shipment)", "Carrier"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== return instructions
export function ReturnPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-RETURN"
      title="Return instructions PDF and warranty denial letter"
      description="After an RMA is authorized: the return instructions with the RMA barcode; and the letter when a warranty claim is denied."
      variants={[
        {
          id: "instructions",
          label: "Return instructions",
          doc: "Return instructions RMA-TBD-0012",
          render: () => (
            <Sheet>
              <Letterhead title="Return instructions" number="RMA-TBD-0012" date="Sep 24, 2026" />
              <div className="flex items-center justify-between gap-4">
                <Facts rows={[["Customer", mp.name], ["Item", "SN-TBD-BSH-0302 HV bushing 145 kV"], ["Class", "RC3, warranty"], ["Ship the part to", "PE Transformer returns dock, Fargo, ND"]]} />
                <Barcode128 value="RMA-TBD-0012" />
              </div>
              <Block title="How to return">
                <ol className="list-decimal pl-5 text-xs leading-relaxed">
                  <li>Mark the oil weep location and photograph the flange before removal.</li>
                  <li>Pack the bushing upright in the supplied crate; keep the oil level indicator visible.</li>
                  <li>Attach this page outside the crate. We scan the barcode at receipt (SP-19) against the authorized serial.</li>
                  <li>Ship within 30 days of authorization; after that the RMA can be reopened only by a manager.</li>
                </ol>
              </Block>
              <Fine>Restocking fees and credit follow the RMA policy in force; no-reference credit is capped below list by policy.</Fine>
            </Sheet>
          ),
        },
        {
          id: "denial",
          label: "Warranty denial letter",
          doc: "Warranty denial RMA-TBD-0019",
          note: "Exclusion wording comes from the warranty exclusions catalog; the text below is placeholder.",
          render: () => (
            <Sheet>
              <Letterhead title="Warranty claim decision" number="RMA-TBD-0019" date="Oct 9, 2026" />
              <p>
                To {CUSTOMERS[0].name}, <span className="text-muted-foreground">{CUSTOMERS[0].addresses[0].text}</span>
              </p>
              <p>
                Warranty claim status: <StatusBadge kind="warrantyClaim" status="Denied" size="sm" />
              </p>
              <p className="text-xs leading-relaxed">
                After inspection of the returned unit we could not accept the claim under warranty. Reason: damage consistent with an installation fault, which is excluded under the warranty terms (exclusion catalog entry, placeholder wording). The unit can be repaired as a billable repair; a quote follows and needs your approval before work starts.
              </p>
              <Fine>The decision was made by the Quality Manager on the inspection record. You may reply within the period stated in your warranty terms.</Fine>
              <Signatures names={["Quality Manager"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== traveler
const OPS = [
  [10, "WC-100", "Cut CRGO laminations, step-lap", 38],
  [20, "WC-110", "Stack and clamp core", 26],
  [30, "WC-200", "Wind LV foil coils", 52],
  [40, "WC-210", "Wind HV disc coils", 64],
  [50, "WC-230", "Dry coils, vapor phase", 48],
  [60, "WC-300", "Core and coil assembly", 40],
  [70, "WC-400", "Fit bushings, tap changer, radiators (SP-12 for serialized parts)", 60],
  [80, "WC-500", "Routine tests, FTR (SP-14)", 30],
] as const
export function TravelerPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-TRAVELER"
      title="Traveler and shop packet"
      description="Work-order cover with barcodes, then one operation sheet per operation with its own barcode. Laser letter sheets in a packet."
      variants={[
        {
          id: "cover",
          label: "Cover sheet",
          doc: "Traveler cover WO-TBD-0301",
          render: () => (
            <Sheet>
              <Letterhead title="Work order traveler" number="WO-TBD-0301" date="Apr 6, 2026" />
              <div className="flex items-start justify-between gap-4">
                <Facts rows={[["Item", HERO.itemId], ["Serial", HERO.unitSerial], ["Sales order / customer", `${HERO.phase1Order} / ${mp.name}`], ["Quantity", "1"], ["Start / due", "Apr 6, 2026 / Jul 31, 2026"], ["Routing / MBOM", "RTG-TBD-20MVA rev B / MBOM-TBD-0301 rev B"]]} />
                <div className="flex flex-col items-center gap-2">
                  <Barcode128 value="WO-TBD-0301" />
                  <QrPlaceholder label="WO-TBD-0301" />
                </div>
              </div>
              <Block title="Revision block">
                <Lines head={["Rev", "Date", "Change", "By"]} rows={[["A", "Mar 18, 2026", "Released from EBOM rev B", "Engineering Manager"], ["B", "Mar 24, 2026", "MBOM transformed; routing rev B", "Manufacturing engineer"]]} />
              </Block>
              <Fine>Scan the operation barcode on each sheet to start and complete (SP-10, SP-11). Predecessors must be complete and quality gates clear.</Fine>
            </Sheet>
          ),
        },
        {
          id: "ops",
          label: "Operation sheets",
          doc: "Traveler operations WO-TBD-0301",
          render: () => (
            <div className="flex flex-col gap-4">
              {OPS.slice(0, 3).map(([n, wc, text, h]) => {
                const w = WORK_CENTERS.find((x) => x.id === wc)!
                return (
                  <Sheet key={n}>
                    <Letterhead title={`Operation ${n}`} number={`WO-TBD-0301 | OP${n}`} />
                    <div className="flex items-center justify-between gap-4">
                      <Facts rows={[["Work center", `${wc} ${w.name}`], ["Description", text], ["Standard hours", `${h} h`], ["Work instruction", `WI-TBD-${n}`]]} />
                      <Barcode128 value={`WO-TBD-0301|OP${n}`} />
                    </div>
                    <Facts cols={4} rows={[["Operator", "________"], ["Start", "________"], ["Complete", "________"], ["Good / scrap / rework", "__ / __ / __"]]} />
                  </Sheet>
                )
              })}
              <p className="text-xs text-muted-foreground">Operations 40 to 80 print the same way: {OPS.slice(3).map((o) => `${o[0]} ${o[1]}`).join(", ")}.</p>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== FTR
const TESTS = [
  ["Turns ratio, all taps", "±0.5%", "within 0.2%", "Pass", "CAL-TBD-014"],
  ["Winding resistance, HV and LV", "per design", "within 2% of design", "Pass", "CAL-TBD-031"],
  ["No-load loss at rated voltage", "max 21.5 kW", "20.9 kW", "Pass", "CAL-TBD-040"],
  ["Load loss at rated current", "max 98 kW", "95.1 kW", "Pass", "CAL-TBD-040"],
  ["Impedance voltage", "8.5% ± 7.5%", "8.4%", "Pass", "CAL-TBD-040"],
  ["Applied voltage (hipot)", "no breakdown", "no breakdown", "Pass", "CAL-TBD-022"],
  ["Induced voltage", "no breakdown", "no breakdown", "Pass", "CAL-TBD-022"],
] as const
export function FtrPrint() {
  return (
    <PrintShell
      screenId="FX-PRN-FTR"
      title="Final Test Report"
      description="Generated when the final test passes; it also fires the Production Complete / Tested milestone (30%)."
      variants={[
        {
          id: "ftr",
          label: "FTR",
          doc: "FTR SN-TBD-20M-0301",
          note: "Limits and results are seeded design values for the hero unit.",
          render: () => (
            <Sheet>
              <Letterhead title="Final test report" number="FTR-TBD-0301" date="Jul 28, 2026" />
              <Facts cols={3} rows={[["Serial", HERO.unitSerial], ["Item", HERO.itemId], ["Work order", "WO-TBD-0301"], ["Customer", mp.name], ["Standard", "IEEE C57.12.90 routine tests"], ["Test lab", "WC-500 Test Lab"]]} />
              <Lines head={["Test", "Limit", "Result", "Verdict", "Instrument"]} rows={TESTS.map((t) => t as unknown as string[])} />
              <Block title="Instruments bound to this test (SP-14)">
                <Lines head={["Id", "Instrument", "Calibration due", "State at test time"]} rows={[["CAL-TBD-014", "Ratio bridge TTR-3", "Feb 14, 2027", "In Cal"], ["CAL-TBD-022", "Hipot tester 60 kV", "Oct 23, 2026", "In Cal"], ["CAL-TBD-031", "Winding resistance meter", "Sep 30, 2026", "In Cal"], ["CAL-TBD-040", "Power analyzer", "Aug 15, 2026", "In Cal"]]} />
              </Block>
              <p className="text-sm font-semibold">Overall result: PASS</p>
              <Fine>Calibration was current for every instrument when the test ran. A later lapse does not change this report but flags it for review.</Fine>
              <Signatures names={["Test technician", "Quality engineer"]} />
            </Sheet>
          ),
        },
      ]}
    />
  )
}
