// Barcode scan points SP-01..SP-21 [DOC:pp.95-96 Part F] (asserted) and traceability events
// T01..T13 [DOC:p.211 Book IV §4.1] (asserted). Copied from the reference tables C and D.
// Platform rules: Code128 internal; offline queue 4 h; reprint needs a reason; scan feedback under
// 400 ms P95 [DOC:pp.93-97; p.131; p.242] (asserted).

import type { ScanPointCode, TraceEventCode } from "./entities"

export interface ScanPoint {
  code: ScanPointCode
  step: string
  scans: string
  validates: string
  errorCode?: string
  records: string
  trace?: TraceEventCode
  flows: string[]
}

export const SCAN_POINTS: Record<ScanPointCode, ScanPoint> = {
  "SP-01": { code: "SP-01", step: "Receiving, start GRN line", scans: "PO barcode or select; item or vendor barcode", validates: "item on PO; open qty", records: "GRN line begins", trace: "T02", flows: ["FL-03", "FL-10"] },
  "SP-02": { code: "SP-02", step: "Receiving, batch capture", scans: "new batch label printed and scanned back", validates: "label printed = record created", records: "batch record with vendor batch/heat", trace: "T02", flows: ["FL-03", "FL-11"] },
  "SP-03": { code: "SP-03", step: "Receiving, serial capture", scans: "each serial", validates: "format; uniqueness", records: "serial records, status Available / QI Hold", trace: "T02", flows: ["FL-03", "FL-11"] },
  "SP-04": { code: "SP-04", step: "Putaway", scans: "item/batch label + destination bin", validates: "bin allowed; capacity", records: "bin transfer", trace: "T04", flows: ["FL-03", "FL-11"] },
  "SP-05": { code: "SP-05", step: "QI sample pull", scans: "batch + inspector badge", validates: "QI Hold status", records: "sample qty to inspection", trace: "T03", flows: ["FL-03"] },
  "SP-06": { code: "SP-06", step: "Stock transfer ship/receive", scans: "item/batch/serial + from/to bin", validates: "transfer doc lines", records: "movements", trace: "T04", flows: ["FL-11"] },
  "SP-07": { code: "SP-07", step: "Terminal login", scans: "operator badge", validates: "active user; WC assignment", records: "session; labor attribution", flows: ["FL-04"] },
  "SP-08": { code: "SP-08", step: "Material issue to WO op", scans: "component batch/serial (+ bin)", validates: "component on op list; batch Unrestricted; FEFO/FIFO or logged override", errorCode: "E-PP-07", records: "issue posting #28; genealogy row", trace: "T05", flows: ["FL-04"] },
  "SP-09": { code: "SP-09", step: "Kit/stage delivery to WC", scans: "picklist + staging location", validates: "kit complete", records: "staged status per op", trace: "T05", flows: ["FL-04"] },
  "SP-10": { code: "SP-10", step: "Operation start", scans: "traveler op barcode", validates: "predecessors complete; QC gates clear; WO Released", records: "op In Progress; labor clock on", trace: "T07", flows: ["FL-04"] },
  "SP-11": { code: "SP-11", step: "Operation complete", scans: "traveler op barcode + qty", validates: "good + scrap + rework = started", records: "confirmation; backflush; labor; next-op signal", trace: "T07", flows: ["FL-04"] },
  "SP-12": { code: "SP-12", step: "Serialized component install", scans: "parent serial + child serial", validates: "child on BOM; child Available/Issued to this WO; not already linked", errorCode: "E-BC-05", records: "parent-child link; child In Production", trace: "T06", flows: ["FL-04"] },
  "SP-13": { code: "SP-13", step: "Nameplate verification", scans: "nameplate serial at WC-600", validates: "scanned = WO serial", errorCode: "E-BC-06", records: "verification event", flows: ["FL-04"] },
  "SP-14": { code: "SP-14", step: "Test execution", scans: "instrument CAL labels + serial", validates: "calibration current", errorCode: "E-QM-05", records: "instruments bound to test record", trace: "T08", flows: ["FL-02", "FL-04", "FL-03"] },
  "SP-15": { code: "SP-15", step: "Pick confirmation", scans: "bin + item/batch/serial + picklist", validates: "right batch per FEFO; serial Reserved", records: "pick line confirm", trace: "T04", flows: ["FL-01", "FL-09"] },
  "SP-16": { code: "SP-16", step: "Pack, add to HU", scans: "HU + item/batch/serial", validates: "on pack order; picked", records: "HU content line", trace: "T10", flows: ["FL-01", "FL-09"] },
  "SP-17": { code: "SP-17", step: "HU close and label", scans: "HU label scan-back + scale weight", validates: "weight sanity ±2%", records: "HU Closed; label printed", trace: "T10", flows: ["FL-01", "FL-09"] },
  "SP-18": { code: "SP-18", step: "Load and ship", scans: "each HU at truck + shipment doc", validates: "HU on this shipment; PSI passed; credit gate", errorCode: "E-BC-08", records: "HU Loaded; completeness enables PGI", trace: "T11", flows: ["FL-01", "FL-09"] },
  "SP-19": { code: "SP-19", step: "RMA receipt", scans: "RMA barcode + serial/batch", validates: "authorized line/serial", errorCode: "E-RMA-04", records: "return receipt lines", trace: "T12", flows: ["FL-05"] },
  "SP-20": { code: "SP-20", step: "Cycle/physical count", scans: "bin + item/batch (+ serials)", validates: "on count doc; frozen state", records: "count entry", flows: ["FL-06"] },
  "SP-21": { code: "SP-21", step: "Scrap bin confirmation", scans: "item/batch + scrap location", validates: "disposition approved", records: "scrap issue posting", trace: "T04", flows: ["FL-04", "FL-05"] },
}

export const TRACE_EVENTS: Record<TraceEventCode, { name: string; capturedAt: string; evidence: string }> = {
  T01: { name: "Supplier source", capturedAt: "PO release (FL-10 stage 10)", evidence: "vendor, site, PO line, manufacturer/MPN, STP version" },
  T02: { name: "Receipt identity", capturedAt: "GRN (SP-01 to 03)", evidence: "GRN, internal batch/serial, vendor batch/heat, qty, CoO, dates, certificate checksums" },
  T03: { name: "Incoming quality", capturedAt: "inspection close", evidence: "plan + revision, sample, results, instrument (SP-14), inspector, disposition, NCR/SCAR" },
  T04: { name: "Stock movement", capturedAt: "SP-04/06/15/21", evidence: "from/to bin, stock status, ownership, batch/serial/HU, qty, user/device" },
  T05: { name: "Reservation/issue", capturedAt: "SP-08/09", evidence: "SO/WO/op, material, batch/serial, qty, bin, operator, event ID" },
  T06: { name: "Parent-child install/remove", capturedAt: "SP-12 + rework removals", evidence: "parent, child, op, installed/removed, reason" },
  T07: { name: "Operation confirmation", capturedAt: "SP-10/11", evidence: "WO/op, MBOM + routing revisions, good/scrap/rework, labor, tool/machine" },
  T08: { name: "Test/inspection", capturedAt: "final test / IPQC", evidence: "serial, plan revision, run, results, calibration state, tester" },
  T09: { name: "Finished receipt", capturedAt: "FG receipt", evidence: "serial, WO, standard cost version, location, quality status" },
  T10: { name: "Pack/HU", capturedAt: "SP-16/17", evidence: "HU/SSCC, contents, weights, label IDs, seals" },
  T11: { name: "Ship/deliver", capturedAt: "SP-18 + PGI + POD", evidence: "shipment, BOL, carrier, customer, site, PGI doc, POD, condition" },
  T12: { name: "Return/service", capturedAt: "SP-19 + RMA/RWO events", evidence: "RMA, condition, repair/removal/install, replacement serial, disposition" },
  T13: { name: "Recall/containment", capturedAt: "FL-08 campaign actions", evidence: "campaign, population version, holds, notifications, recovery, effectiveness" },
}
