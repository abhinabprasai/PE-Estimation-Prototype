// Engineering record types. The shared entity types (src/data/domain/entities.ts) are extended by
// intersection here, as APP-ARCHITECTURE.md asks; where a shared field disagrees with the PRD word
// (design type, document security class) the PRD word wins and a foundation request is logged in
// ../README.md. Sources: Book I Part C §1-§6 [DOC:pp.58-67], Book IV §3.1 and §6.1 [DOC:pp.208-209;
// p.214], Book III Part G §3 [DOC:pp.198-199], Book VI §6-§7 [DOC:pp.254-259] (all asserted).

import type {
  Activity, ControlledDocument, DocRef, DocRevision, Ebom, EbomLine, Eco, Ecr, EngineeringRequest, Mbom, ProductionVersion, Transmittal,
} from "@/data/domain"
import type * as Id from "@/data/domain/ids"
import type { Role } from "@/data/domain"

// ---------------------------------------------------------------- engineering request (ENG-REQ-001)
/** Design type words from [DOC:p.59 §2]; the shared entity uses other words (foundation request R-1). */
export type DesignType = "New Design" | "Variant of Existing" | "Repeat"

export interface ChecklistRow {
  key: string
  item: string
  /** Linked deliverable; its status drives the row when present. */
  ref?: DocRef
  done: boolean
}

export type ErRecord = Omit<EngineeringRequest, "designType" | "checklist" | "assigneeId"> & {
  designType: DesignType
  customerId: Id.CustomerId
  itemId: Id.MaterialId
  title: string
  assigneeIds: Id.UserId[]
  customerApprovalRequired: boolean
  /** Transmittal holding the customer's Approved / Approved as Noted response. */
  customerApprovalEvidence?: Id.TransmittalId
  reviewLoops: number
  promisedShip: string
  productionLeadDays: number
  longLeadDays: number
  baseDesignEbomId?: Id.EbomId
  config: [label: string, value: string][]
  checklist: ChecklistRow[]
  /** Status held before Blocked, so Unblock returns to it. */
  statusBeforeBlock?: EngineeringRequest["status"]
}

// ---------------------------------------------------------------- EBOM (ENG-BOM-002)
export interface Alternate {
  componentId: Id.MaterialId
  rank: number
  condition: string
}
export interface LineComment {
  by: Id.UserId
  on: string
  text: string
}
export type EbomLineX = EbomLine & {
  /** Find # of the parent line; undefined = level 1 under the header item. */
  parent?: number
  refDes?: string
  phantom?: boolean
  /** Routing operation number the component is issued at (V-ENG-05). */
  consumeAtOp?: number
  drawingId?: Id.DocumentId
  alternates?: Alternate[]
  notes?: string
  printNote?: boolean
  comments?: LineComment[]
  /** Line-level effectivity for running changes: a date (YYYY-MM-DD) or a serial number [DOC:p.60 §3.2]. */
  effFrom?: string
  effTo?: string
}
export interface EbomRevision {
  rev: string
  status: "Superseded"
  releasedOn: string
  supersededOn: string
  reason: string
  lines: EbomLineX[]
}
export type EbomRecord = Omit<Ebom, "lines"> & {
  title: string
  usage: "Production" | "Sales"
  baseDesign?: string
  plantId: Id.PlantId
  lines: EbomLineX[]
  priorRevs: EbomRevision[]
  releasedOn?: string
  assigneeIds: Id.UserId[]
  /** Submitted for review by (C: an engineer cannot approve their own release). */
  submittedBy?: Id.UserId
  /** Reviewer threads that are not tied to a line. */
  reviewNotes: LineComment[]
  /** CAD assembly in the vault is newer than the released structure (IF-17 structure comparison). */
  cadAhead?: string
}

// ---------------------------------------------------------------- placeholders (V-ENG-03)
export interface Placeholder {
  id: Id.MaterialId
  description: string
  category: string
  uom: string
  estCost: number
  targetVendorId?: Id.VendorId
  ebomId: Id.EbomId
  line: number
  engineerId: Id.UserId
  createdOn: string
  /** S-42 material lifecycle words. */
  status: "Draft" | "Active"
  mcrId?: Id.McrId
  /** Raised by the CAD connector new-part flow (IF-17) instead of the editor. */
  fromCad?: boolean
}

// ---------------------------------------------------------------- MBOM (MBOM-TRF)
export type MbomLineX = EbomLineX & { operation?: string; backflush?: boolean; mfgAdd?: boolean; fromPhantom?: number }
export type MbomRecord = Omit<Mbom, "lines"> & {
  ebomRev: string
  plantId: Id.PlantId
  routingId: Id.RoutingId
  routingRev: string
  lines: MbomLineX[]
  releasedOn: string
  releasedBy: Id.UserId
  supersededOn?: string
  costingInvalidated: boolean
  activity: Activity[]
}

// ---------------------------------------------------------------- production version (PV-001)
export type PvRecord = ProductionVersion & {
  routingRev: string
  mbomRev: string
  createdOn: string
  activity: Activity[]
}

// ---------------------------------------------------------------- controlled documents (ENG-DOC-001/2)
/** Type codes from [DOC:p.64 §5.1]. */
export type DocTypeCode = "GA" | "NP" | "SCH" | "WND" | "COR" | "TNK" | "TP" | "WI" | "TC" | "CERT"
export type SecurityClass = "Internal" | "Customer-Shareable" | "Restricted"
export interface TitleBlock {
  drawnBy: Id.UserId
  checkedBy?: Id.UserId
  approvedBy?: Id.UserId
  scale: string
  sheet: string
  size: "A" | "B" | "C" | "D" | "E"
  project?: string
}
/** Native file accepted at check-in: max 500 MB, checksum stored, virus-scanned [DOC:p.64 §5.1]. */
export interface NativeFile {
  name: string
  sizeMb: number
  checksum: string
  scan: "Clean"
}
/** A markup pinned on the PDF rendition while a revision is In Review (position in % of the sheet). */
export type Redline = LineComment & { id?: string; page?: number; x?: number; y?: number; resolved?: boolean; resolvedBy?: Id.UserId }
export type DocRevisionX = DocRevision & {
  native: string[]
  nativeFiles?: NativeFile[]
  rendition?: string
  stamp?: string
  titleBlock: TitleBlock
  releasedOn?: string
  redlines: Redline[]
  /** Reviewer approvals recorded while In Review; release stays the Engineering Manager's action [DOC:p.64 §5.2]. */
  reviewerApprovals?: { by: Id.UserId; on: string; note?: string }[]
  checksum: string
}
export type DocRecord = Omit<ControlledDocument, "type" | "security" | "revisions"> & {
  typeCode: DocTypeCode
  security: SecurityClass
  revisions: DocRevisionX[]
  createdOn: string
  activity: Activity[]
  /** Linked deliverable of an engineering request. */
  engineeringRequestId?: Id.EngineeringRequestId
}

// ---------------------------------------------------------------- transmittals (TR-001)
export type TransmittalPurpose = "For Approval" | "For Construction" | "As-Built"
/** Customer response words exactly as [DOC:p.64 §5.2]; the shared type uses other spellings (foundation request R-12). */
export type TrResponse = "Approved" | "Approved as Noted" | "Revise & Resubmit"
export type TransmittalRecord = Omit<Transmittal, "responses"> & {
  responses: { recipient: string; response: TrResponse; on: string }[]
  customerId: Id.CustomerId
  engineeringRequestId?: Id.EngineeringRequestId
  soId?: Id.SalesOrderId
  purpose: TransmittalPurpose
  /** Revisions sent, frozen at send: document id + rev. */
  revsSent: { documentId: Id.DocumentId; rev: string }[]
  note?: string
  sentBy: Id.UserId
  createdOn: string
  activity: Activity[]
}

// ---------------------------------------------------------------- ECR / ECO (ENG-ECR/ECO)
export type EcrSource = "Engineering" | "Production" | "Quality (NCR link)" | "Purchasing" | "Sales" | "RMA/Field Failure"
export type EcrClass = "Safety/Regulatory" | "Cost Reduction" | "Quality/CAPA" | "Supply Continuity" | "Customer Request" | "Documentation Only"
export type EcrPriority = "Emergency" | "Urgent" | "Standard"
/** Stage text: the PRD gives no ECR status list (OQ-21), so this is never drawn as a badge. */
export type EcrStage = "Draft" | "Submitted to CCB" | "Approved" | "Rejected" | "Deferred"
export interface EcrImpact {
  openWos: { id: string; rev: string; note: string }[]
  stock: { itemId: Id.MaterialId; qty: number; value: number }[]
  openPos: { id: string; qty: number; value: number }[]
  openSoLines: { id: string; line: number; customerId: Id.CustomerId }[]
  costCurrent: number
  costSimulated?: number
  customers: { customerId: Id.CustomerId; serials: string }[]
}
/** Proposed structural change carried from ECR to ECO and applied at cutover. */
export interface EbomChange {
  ebomId: Id.EbomId
  ops: ({ kind: "replace"; line: number; componentId: Id.MaterialId } | { kind: "qty"; line: number; qty: number } | { kind: "add"; line: EbomLineX } | { kind: "remove"; line: number })[]
}
export type EcrRecord = Omit<Ecr, "ccbOutcome"> & {
  source: EcrSource
  sourceRef?: DocRef
  requestedBy: Id.UserId
  raisedOn: string
  description: string
  reason: string
  classification: EcrClass
  priority: EcrPriority
  stage: EcrStage
  impact: EcrImpact
  narrative: string
  risk: string
  changes: EbomChange[]
  docChanges: Id.DocumentId[]
  ccbOutcome?: "Approve" | "Reject" | "Defer"
  ccbReason?: string
  /** CCB member votes, recorded per member [DOC:p.62 §4.1]. */
  votes?: CcbVote[]
  /** Date the CCB request was raised; Emergency ECRs are due within 24 hours of it. */
  submittedOn?: string
  ccbDueBy?: string
  ecoId?: Id.EcoId
  activity: Activity[]
}
export type CcbVoteValue = "Approve" | "Reject" | "Defer"
export interface CcbVote {
  role: Role
  vote: CcbVoteValue
  by: Id.UserId
  on: string
  reason?: string
}
export type EffectivityMode = "Date" | "Serial" | "Immediate"
export type StockDisposition = "Use-Up" | "Rework" | "Scrap" | "Return to Vendor (RTV)"
export type WoDisposition = "Complete As-Is" | "Incorporate Change" | "Stop & Rework"
export type LlrDecision = "Proceed" | "Change order to vendor" | "Stop with exposure booking"
export type EcoTaskX = { no: number; text: string; ownerRole: Role; done: boolean; due: string; doneBy?: Id.UserId; doneOn?: string; mandatory?: boolean; link?: string }
export type EcoRecord = Omit<Eco, "effectivity" | "dispositions" | "tasks"> & {
  title: string
  effectivity: EffectivityMode
  fromSerial?: string
  stockDispositions: { itemId: Id.MaterialId; onHand: number; value: number; decision?: StockDisposition }[]
  woDispositions: { woId: string; rev: string; decision?: WoDisposition }[]
  llrImpacts: { llrId: Id.LlrId; poId: string; itemId: Id.MaterialId; decision?: LlrDecision }[]
  tasks: EcoTaskX[]
  changes: EbomChange[]
  docChanges: Id.DocumentId[]
  /** Stage text (OQ-21): no ECO status list in the PRD. "Awaiting effectivity" = release approved, cutover on the effectivity date (reading R-ECR-5). */
  stage: "Open" | "Awaiting effectivity" | "Released"
  /** MBOM revisions regenerated by the "Update MBOM" task: held on the ECO and activated at cutover. */
  stagedMboms?: MbomRecord[]
  /** Immediate effectivity: On Hold requested for the open WOs on the old revision. */
  woHoldRequestedOn?: string
  /** Supersessions where a component is replaced: MCH rows / supersession requests to Materials at cutover. */
  materialChanges?: { from: Id.MaterialId; to: Id.MaterialId }[]
  /** Documents the dispositions and cutover hand to owning modules (RWO, scrap, RTV, routing, plan, MCH). */
  handoffs?: { what: string; owner: string; ref?: string }[]
  createdOn: string
  releasedOn?: string
  releasedBy?: Id.UserId
  /** Revisions this ECO created at cutover, for the evidence panel. */
  cutover?: { ref: DocRef; from: string; to: string }[]
  activity: Activity[]
}

// ---------------------------------------------------------------- CAD connector (CAD-SYNC, IF-17)
/** Delivery states for vault events: the PRD names retry and replay but no state list (reading R-CAD-1). */
export type VaultEventState = "Delivered" | "Retrying" | "Failed" | "Queued"
export interface VaultEvent {
  id: string
  at: string
  vaultTx: string
  kind: "Check-in" | "Release" | "New part" | "Assembly extraction" | "Attribute sync" | "Rendition publish"
  object: string
  ref?: DocRef
  state: VaultEventState
  attempts: number
  error?: string
  /** Import proposal staged for CAD-IMP. */
  proposalId?: string
}
export interface SyncConflict {
  id: string
  materialId: Id.MaterialId
  field: "Description" | "Mass" | "Material group" | "UoM" | "Revision"
  erpValue: string
  pdmValue: string
  /** System of record for the field (Part G §2). */
  owner: "ERP" | "PDM"
  resolverRole: Role
  raisedOn: string
  vaultTx: string
  resolved?: { value: string; by: Id.UserId; on: string; side: "ERP" | "PDM" }
}
export interface ImportProposalLine {
  findNo: number
  partNo: string
  mpn?: string
  description: string
  qty: number
  refDes?: string
}
export interface ImportProposal {
  id: string
  ebomId: Id.EbomId
  source: "Vault assembly extraction" | "CSV upload"
  vaultTx?: string
  createdOn: string
  lines: ImportProposalLine[]
  committed?: { on: string; by: Id.UserId; added: number; placeholders: number }
}

// ---------------------------------------------------------------- CAD vs EBOM comparison (FX-CAD-COMPARE, IF-17)
/** Current vault assembly for an EBOM; the connector extracts it on demand or at PDM release [DOC:p.198 §3]. */
export interface CadAssembly {
  id: string
  ebomId: Id.EbomId
  vaultRev: string
  /** Vault revision the ERP structure was last aligned with. */
  alignedRev: string
  vaultTx: string
  checkedInAt: string
  lines: ImportProposalLine[]
  /** Comparison reviewed with no structure change needed (clears the CAD-ahead banner). */
  reviewed?: { on: string; by: Id.UserId; note: string }
}

// ---------------------------------------------------------------- PDM linkage (FX-CAD-PDM, Book III Part G §4)
/** The four PDM states the PRD maps to an ERP effect, plus the connector's publish outcomes and the unlinked case.
 *  The PRD gives no status list for linkage (OQ-21): shown as text, never as a badge. */
export type PdmState =
  | "In work (checked out)"
  | "Change order opened"
  | "Release approved"
  | "Released, rendition published"
  | "Publish failed"
  | "Obsolete in PDM"
  | "Not linked (ERP only)"
export interface PdmLink {
  id: string
  documentId: Id.DocumentId
  vaultPath?: string
  vaultRev?: string
  state: PdmState
  /** PDM change order number, cross-referenced to the ERP ECR. */
  pdmCo?: string
  linkedEcr?: Id.EcrId
  linkedEco?: Id.EcoId
  lastEvent?: string
  note?: string
  activity: Activity[]
}

/** Sales-kit header: a material of type KIT, non-stocked and non-valuated by default [DOC:p.256 §6.1]. */
export interface KitHeader {
  id: Id.MaterialId
  description: string
  stocked: boolean
}
