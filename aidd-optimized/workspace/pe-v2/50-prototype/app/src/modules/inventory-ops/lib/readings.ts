// inventory-ops readings: choices made where the PRD is silent. Each shows on screen as a
// "Reading RD-IO-nn" chip (Chip kind="oq") and is logged in README "Readings". None is a PRD rule.

export const READINGS = {
  "RD-IO-01": "The PRD names a scan point for receiving (SP-01..03), putaway (SP-04), stage (SP-09), pick (SP-15), pack (SP-16), load (SP-18) and scrap (SP-21) only. Replenishment is confirmed with SP-04 (a bin transfer) and the inter-location Transfer task with SP-06.",
  "RD-IO-02": "S-23 has one end word, Done/Exception (p.215 §7.2). The badge shows that word; whether the task finished as Done or as an Exception is a separate text chip, so a supervisor can filter on it.",
  "RD-IO-03": "Who may work a task is not stated (ASM-PERM-1). The prototype lets the Receiving clerk take Receiving tasks, the Packer take Pack and Load, the Warehouse operator take the rest, and the Warehouse supervisor take any.",
  "RD-IO-04": "Assigning, releasing and re-prioritising tasks on the supervisor board is done by the Warehouse supervisor (\"supervisors balance load\", Book VIII §5.3); the PRD names no role.",
  "RD-IO-05": "Task priority values Normal, High and Urgent and the queue names Inbound, Outbound and Internal are design values.",
  "RD-IO-06": "Count plan split: \"per zone / per aisle / per item group\" is in the PRD (p.36 §7.1). Aisle is read as the first two segments of the bin (C-01), item group as the material type. A counter team is a list of counters; documents are dealt to them in turn, one counter per document.",
  "RD-IO-07": "Scrap at SP-21 needs an approved disposition (p.95). Who approves is not named for warehouse damage: the prototype uses the Warehouse supervisor with a reason (FL-04 asks a supervisor and a reason beyond a scrap threshold) and the Quality Manager for an RMA disposition (RMA-DISP).",
  "RD-IO-08": "E-DTS-04 says receipt is blocked when the vendor never acknowledged a revised STP. The prototype also blocks when the acknowledgement is Exception or Rejected, as the purchase order screen does; only Acknowledged lets the receipt through.",
  "RD-IO-09": "Certificate requirements per material (Mill Cert per Heat, CoC per Shipment, CoA, FAI Report) are a Quality-view field (p.150 §3.10). The values per material, and which STP element each certificate is checked against, are design values.",
  "RD-IO-10": "The feature list says the receipt posts #17. In the PRD #17 is the RMA receipt; the goods receipt is named only in flow text (DR 13xx Inventory / CR 2110 GR/IR, p.178), so that is what the screen shows.",
  "RD-IO-11": "Only PE Transformer has a plant. For the other three entities steps 6c and 6d show \"not applicable\" and 6e reads the RMAs of PE Transformer only.",
  "RD-IO-12": "The prototype has no general ledger. The subledger side of the tie-out is live (stock value by valuation class); the GL side equals it except for seeded differences, which are design values.",
  "RD-IO-13": "Warranty reserve balance (account 2610) is a design value. Open exposure is read from the open warranty rework orders (labor at the order's rate plus material). The PRD says \"reserve balance vs open warranty RWO exposure; top-up JE proposed\" and gives no formula.",
  "RD-IO-14": "Pair indicators (Paired, Value mismatch, Status mismatch, Not paired) and the $0.01 value tolerance are design values; the PRD says a mismatch monitor alerts Finance daily when values or statuses diverge (FL-07 field 10).",
  "RD-IO-15": "\"Executor is not approver where flagged\" (FL-06 field 13): the flagged steps are not listed. The prototype flags 5b and 9b, the two steps that post a journal.",
  "RD-IO-16": "Count autosave: a quantity is saved 600 ms after the last keystroke or when the field loses focus. The PRD says entries autosave and gives no timing.",
  "RD-IO-17": "The TC77 task area is drawn 360 px wide inside the shared kiosk template (4.7 in handheld, one column); the kiosk header and action bar stay at the template's size.",
} as const
export type ReadingId = keyof typeof READINGS
