// Readings: choices made where the specification is silent. Each shows on screen as a reading chip
// and is logged in README "Readings" (to be numbered into 10-discovery/open-questions.md by the
// integration pass). None is a specification rule.
export const READINGS = {
  "QT-R01": "An inspection record has no status list in the specification; it shows as open until a decision (Accepted / Rejected) is recorded, and the subject's stock or serial status carries the badge.",
  "QT-R02": "NCR is owned by INV 15.4 (not supplied); the funnel uses the stage words Open / Dispositioned / Closed and severities Critical / Major / Minor.",
  "QT-R03": "SLA for the age colouring: IQC 3 days, IPQC and OQC 1 day; RQC uses the specification's 5 business days from RMA receipt to inspection.",
  "QT-R04": "Vendor quality flag threshold: rolling 90-day lot acceptance below 95%. The specification says vendors below threshold are flagged but gives no number.",
  "QT-R05": "Instrument status boundaries: Due Soon within 30 days of the due date (the first alert), Overdue after it. Alerts at 30 / 14 / 3 days are as specified.",
  "QT-R06": "Recall stage moves Contain → Notify when the external notification text is approved in WF-INBOX; Identify → Contain on mass hold; Notify → Recover when the recall-class RMAs are created.",
  "QT-R07": "Recall-class RMAs are requested one per customer through the event quality.recallRmaRequested; the sales module creates the RMA record.",
  "QT-R08": "Deviation approval needs the Quality Manager and the Engineering Manager (two people). WF-INBOX has no deviation approval kind yet, so the two approvals are recorded on this screen.",
  "QT-R09": "Plan approval In Review → Active is recorded by the Quality Manager on this screen; WF-INBOX has no inspection-plan approval kind yet.",
  "QT-R10": "The FTR is issued when the tester completes a run with every characteristic passed; the milestone fires then. The Quality Manager countersigns afterwards on the same record.",
  "QT-R11": "Partial recovery sign-off (Quality Manager + executive) is recorded on this screen; WF-INBOX has no kind for it yet.",
  "QT-R12": "The trace tree shows five levels: unit, component, material batch, goods receipt, purchase order (backward); batch, component, unit, shipment, customer site (forward).",
  "QT-R13": "Coverage % = accepted traceability postings ÷ postings from the daily control run, less open orphan and missing events found since.",
  "QT-R14": "The genealogy hash is a short non-cryptographic stand-in for the prototype; the chain verifies per object.",
  "QT-R15": "A SCAR is overdue when it is open, has no vendor response, and its due date has passed.",
  "QT-R16": "A Reopened CAPA resumes at Actions In Progress; corrective and preventive actions are reopened, containment actions stay done.",
  "QT-R17": "Recall population locations are In field, In stock, WIP, In transit and Returned.",
  "QT-R18": "Final test disposition Scrap needs the Controller and the Engineering Manager [DOC:p.87]; recorded by the Quality Manager here until WF-INBOX has a kind for it.",
  "QT-R19": "Cost of quality, FPY and vendor acceptance figures on the dashboard are seeded summaries; live GL figures come from ACC (ASM-EXT-1).",
  "QT-R20": "SCAR has no status list; the register shows the words Awaiting vendor, Response received, Overdue and Closed as text.",
  "QT-R21": "Final test queue stage words (Queued, Run open, Failed, rework, FTR issued, Scrapped) are derived from the runs, shown as text.",
  "QT-R22": "Coverage below 99.5% marks the completeness tile for attention; the specification gives no coverage target.",
  "QT-R23": "Recall-class RMA numbers come from the sales module (it drafts the RMA when the campaign enters Recover); this module records the request and links the RMA back by serial.",
} as const
export type ReadingId = keyof typeof READINGS
