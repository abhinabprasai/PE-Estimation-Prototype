// Types for the feature-list screens of quality-trace (scan exceptions, reprint, relabel, camera,
// SPC, audits, as-built, test import, stock status moves). Fields named by the specification carry
// its words; the rest are design values (README "Readings").

import type { BatchId, CapaId, ISODate, MaterialId, ScanPointCode, SerialNo, UserId, VendorId, WarehouseId } from "@/data/domain"

// ------------------------------------------------------------------ scan telemetry and print jobs (BC-ADMIN)
/** All scan events, failures included, are stored 24 months: device, user, timestamp, payload, result [DOC:p.97 Part F]. */
export interface ScanTelemetry {
  id: string
  at: string
  device: string
  userId: UserId
  sp: ScanPointCode
  payload: string
  result: "OK" | "Rejected" | "Failed" | "Queued" | "Replayed"
  error?: string
  /** Camera fallback scan (supervisors only, logged) [DOC:p.94 Part F]. */
  camera?: boolean
}

export interface PrintJob {
  id: string
  labelId: string
  template: string
  printerId: string
  requestedBy: UserId
  at: string
  status: "Failed" | "Printed" | "Cancelled"
  error: string
  attempts: number
  redirectedTo?: string
  resolvedOn?: ISODate
  resolvedBy?: UserId
}

export const REPRINT_REASONS = ["Damaged or unreadable", "Lost", "Data corrected", "Printer fault", "Template version change", "Recall hold tag"] as const
export type ReprintReason = (typeof REPRINT_REASONS)[number]
/** Label kinds for the reprint dialog. Serial and nameplate reprints need Quality approval; every reprint except location labels is watermarked DUPLICATE [DOC:p.93 Part F; p.97]. */
export const LABEL_KINDS = ["Batch label", "Serial label", "Nameplate", "HU / SSCC label", "Bin label", "Location label", "CAL instrument label", "RMA label"] as const
export type LabelKind = (typeof LABEL_KINDS)[number]
export const needsQualityApproval = (k: string) => k === "Serial label" || k === "Nameplate"
export const isDuplicateMarked = (k: string) => k !== "Location label" && k !== "Bin label"

// ------------------------------------------------------------------ identify and relabel (TC77)
export interface BinExpected {
  bin: string
  warehouseId: WarehouseId
  lines: { materialId: MaterialId; batchId: BatchId; qty: number; uom: string }[]
}
export interface RelabelRecord {
  id: string
  bin: string
  materialId?: MaterialId
  batchId?: BatchId
  qty: number
  printerId: string
  labelId?: string
  by: UserId
  on: string
  outcome: "Resolved to expected stock" | "No expected match: count exception"
  note?: string
}

// ------------------------------------------------------------------ SPC (DEC-09, Phase 2)
export interface SpcSeries {
  id: string
  characteristic: string
  planId: string
  gate: "IPQC" | "FQC"
  unit: string
  target: number
  lsl?: number
  usl?: number
  /** Individual measurements in time order. */
  points: { at: ISODate; value: number; ref: string }[]
}
export interface SpcAck {
  key: string
  by: UserId
  on: ISODate
  note: string
}

// ------------------------------------------------------------------ audits (DEC-09, Phase 2)
export type AuditType = "Internal process" | "Supplier" | "Customer" | "Certification"
export const AUDIT_TYPES: AuditType[] = ["Internal process", "Supplier", "Customer", "Certification"]
export type AuditState = "Planned" | "In progress" | "Report issued" | "Closed" | "Cancelled"
export interface AuditFinding {
  id: string
  clause: string
  text: string
  grade: "Major" | "Minor" | "Observation"
  dueOn?: ISODate
  state: "Open" | "Closed"
  capaId?: CapaId
  closedOn?: ISODate
  closeNote?: string
}
export interface AuditQuestion {
  q: string
  result?: "Conforming" | "Nonconforming" | "NA"
  note?: string
}
export interface QtAudit {
  id: string
  title: string
  type: AuditType
  scope: string
  vendorId?: VendorId
  auditorId: UserId
  auditee: string
  plannedOn: ISODate
  startedOn?: ISODate
  reportOn?: ISODate
  closedOn?: ISODate
  state: AuditState
  checklist: AuditQuestion[]
  findings: AuditFinding[]
  activity: { at: string; by: string; text: string }[]
}

// ------------------------------------------------------------------ as-built dossier (TRC)
export interface AsBuiltDossier {
  id: string
  serial: SerialNo
  revision: number
  assembledOn: ISODate
  by: UserId
  items: { key: string; label: string; ref?: string }[]
  transmittedTo?: string
  transmittalNo?: string
  transmittedOn?: ISODate
}

// ------------------------------------------------------------------ test import (DEC-08, Phase 2)
export interface TestImportLog {
  id: string
  finalTestId: string
  run: number
  template: string
  fileName: string
  rows: number
  recorded: number
  on: ISODate
  by: UserId
}

// ------------------------------------------------------------------ stock status moves per gate (INV alignment)
export interface StockMove {
  id: string
  at: ISODate
  batchId?: BatchId
  serial?: SerialNo
  from: string
  to: string
  gate: string
  source: string
  reason: string
  by: UserId | "System"
}

// ------------------------------------------------------------------ recall contact attempts (RCL-001)
export interface ContactAttempt {
  id: string
  recallId: string
  customerId: string
  at: string
  by: UserId
  channel: "Phone" | "Email" | "Letter" | "Site visit"
  contactName: string
  outcome: "Reached, acknowledged" | "Reached, will respond" | "No answer" | "Left voicemail" | "Email bounced" | "Declined"
  note: string
}
export interface PiiDisclosure {
  id: string
  recallId: string
  on: string
  by: UserId
  rows: number
  purpose: string
}

/** Pareto of quality events by cause (dashboard); design series. */
export interface ParetoRow {
  cause: string
  count: number
  cost: number
}

/** Vendor response submissions on the emailed SCAR form. */
export interface VendorResponse {
  id: string
  scarId: string
  on: string
  respondent: string
  email: string
  attachments: string[]
}
