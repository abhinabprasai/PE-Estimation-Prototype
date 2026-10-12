// Root store. One in-memory store (no backend) that composes module slices.
//
// - Each module registers its slice from its own folder (src/modules/<group>/data/slice.ts) through
//   its index.ts; src/modules/registry.ts lists the groups. Nothing outside a module's folder
//   changes when the module adds state.
// - Every write is atomic: `mutate(key, fn)` runs fn on a structuredClone of the slice and either
//   commits the whole clone or, when fn throws ProtoError, changes nothing and returns the error
//   (the FL-09 build's R-13 behaviour, kept for every slice).
// - Cross-module effects go through the typed event bus (./events.ts). Events queued inside a
//   mutate are emitted after the commit; handlers run their own mutate on their own slice.
// - The core slice holds what is shared by all modules: acting role and user, runtime document
//   links (the document-flow graph beyond the seeded spine) and the shared approval engine.

import type { ApprovalKind, ApprovalRequestId, ApprovalRoute, ApprovalStep, DocLink, DocRef, RecordKind, Role, UserId } from "@/data/domain"
import { docLabel, docRoute, routeApproval, sameRef, type ApprovalContext } from "@/data/domain"
import { SPINE_DOCS, SPINE_LINKS, TODAY, defaultUserFor } from "@/data/shared"
import { EventBus, type DomainEvents, type EventName } from "./events"
import type { SliceStates } from "./types"

export class ProtoError extends Error {
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string; field?: string }

/** A search hit for the global search (Ctrl/Cmd+K). */
export interface SearchHit {
  title: string
  subtitle?: string
  route: string
  ref?: DocRef
  /** Status for DocumentFlowPanel and search results (record kind + verbatim status). */
  status?: { kind: RecordKind; value: string }
  group: string
}

/** Context handed to a slice's mutate function. */
export interface MutateCtx {
  /** Queue a cross-module event; it is emitted only if this mutate commits. */
  emit<K extends EventName>(type: K, payload: DomainEvents[K]): void
  /** Add a document-flow link (predecessor -> successor); committed with this mutate. */
  link(link: DocLink): void
  role: Role
  userId: UserId
  today: string
}

export interface SliceDef<K extends keyof SliceStates> {
  key: K
  /** Fresh seed. Called at start and on Scenario reset. */
  seed: () => SliceStates[K]
  /** Subscribe to other modules' events. Called once after every slice is registered. */
  subscribe?: (api: StoreApi) => void
  /** Global search provider over this slice's documents. */
  search?: (state: SliceStates[K]) => SearchHit[]
  /** Document links derived from this slice's records (in addition to SPINE_LINKS and runtime links). */
  links?: (state: SliceStates[K]) => DocLink[]
}

// ------------------------------------------------------------------ shared approval engine (C-1)
/** No status list exists for approval requests (OQ-21): outcome is text, never a badge. */
export interface ApprovalRequest {
  id: ApprovalRequestId
  kind: ApprovalKind
  subject: DocRef
  title: string
  amount?: number
  currency?: "USD" | "CAD"
  route: ApprovalRoute
  steps: ApprovalStep[]
  raisedBy: Role
  raisedOn: string
  note?: string
  outcome?: "Approved" | "Rejected"
}

export interface CoreState {
  role: Role
  userId: UserId
  links: DocLink[]
  approvals: ApprovalRequest[]
  seq: number
}

function seedCore(): CoreState {
  return {
    role: "Sales rep",
    userId: defaultUserFor("Sales rep").id,
    links: [],
    seq: 100,
    approvals: [
      mkRequest("APR-TBD-0101", "Long-lead release", { type: "llr", id: "LLR-2026-0011" }, "LLR-2026-0011 CRGO steel and 3 OLTCs, phase 2", 612000, "Engineering Manager", "2026-09-30", { riskClass: "Medium" }),
      mkRequest("APR-TBD-0102", "PO approval", { type: "purchaseOrder", id: "PO-TBD-0377" }, "PO-TBD-0377 Northstar Electrical Steel, CRGO 54,000 kg", 207900, "Buyer", "2026-10-05"),
      mkRequest("APR-TBD-0103", "Recall external notification", { type: "recall", id: "RCL-2026-001" }, "RCL-2026-001 customer notification text (draft for Notify stage)", undefined, "Quality Manager", "2026-10-08"),
      {
        ...mkRequest("APR-TBD-0099", "Long-lead release", { type: "llr", id: "LLR-2026-0004" }, "LLR-2026-0004 CRGO steel and OLTC, phase 1", 420000, "Engineering Manager", "2026-01-26"),
        steps: [
          { role: "Engineering Manager", decided: { outcome: "Approved", by: "USR-TBD-024", on: "2026-01-26" } },
          { role: "Purchasing Manager", decided: { outcome: "Approved", by: "USR-TBD-041", on: "2026-01-26" } },
          { role: "Controller", decided: { outcome: "Approved", by: "USR-TBD-009", on: "2026-01-27" } },
        ],
        outcome: "Approved",
      },
    ],
  }
}

function mkRequest(id: ApprovalRequestId, kind: ApprovalKind, subject: DocRef, title: string, amount: number | undefined, raisedBy: Role, raisedOn: string, ctx: ApprovalContext = {}): ApprovalRequest {
  const route = routeApproval(kind, { amount, ...ctx })
  return { id, kind, subject, title, amount, currency: "USD", route, steps: route.steps.map((role) => ({ role })), raisedBy, raisedOn }
}

// ------------------------------------------------------------------ the store
type Listener = () => void

class RootStore {
  private defs = new Map<string, SliceDef<keyof SliceStates>>()
  private slices = new Map<string, unknown>()
  private core: CoreState = seedCore()
  private listeners = new Set<Listener>()
  private version = 0
  private subscribed = false
  readonly bus = new EventBus()

  // ---- registration
  register<K extends keyof SliceStates>(def: SliceDef<K>) {
    // Re-registration happens on hot reload in development: keep the state, take the new def.
    const again = this.defs.has(def.key)
    this.defs.set(def.key, def as unknown as SliceDef<keyof SliceStates>)
    if (!again) this.slices.set(def.key, def.seed())
  }
  /** Wire every slice's event subscriptions. Called once by the app after registration. */
  start() {
    if (this.subscribed) return
    this.subscribed = true
    for (const d of this.defs.values()) d.subscribe?.(this.api)
  }

  // ---- reading
  getSlice<K extends keyof SliceStates>(key: K): SliceStates[K] {
    if (!this.slices.has(key)) throw new Error(`Slice "${String(key)}" is not registered`)
    return this.slices.get(key) as SliceStates[K]
  }
  hasSlice(key: string) {
    return this.slices.has(key)
  }
  getCore() {
    return this.core
  }
  getVersion = () => this.version
  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  // ---- writing
  mutate<K extends keyof SliceStates, T>(key: K, fn: (draft: SliceStates[K], ctx: MutateCtx) => T): Result<T> {
    const draft = structuredClone(this.getSlice(key))
    const events: [EventName, unknown][] = []
    const links: DocLink[] = []
    const ctx: MutateCtx = {
      emit: (type, payload) => void events.push([type, payload]),
      link: (l) => void links.push(l),
      role: this.core.role,
      userId: this.core.userId,
      today: TODAY,
    }
    try {
      const value = fn(draft, ctx)
      this.slices.set(key, draft)
      if (links.length) this.core = { ...this.core, links: [...this.core.links, ...links] }
      this.bump()
      for (const [t, p] of events) this.bus.emit(t, p as never)
      return { ok: true, value }
    } catch (e) {
      if (e instanceof ProtoError) return { ok: false, error: e.message, field: e.field }
      throw e
    }
  }
  setRole(role: Role) {
    this.core = { ...this.core, role, userId: defaultUserFor(role).id }
    this.bump()
  }
  addLinks(...links: DocLink[]) {
    this.core = { ...this.core, links: [...this.core.links, ...links] }
    this.bump()
  }

  // ---- shared approval engine
  raiseApproval(input: { kind: ApprovalKind; subject: DocRef; title: string; amount?: number; currency?: "USD" | "CAD"; ctx?: ApprovalContext; note?: string }): ApprovalRequest {
    const existing = this.core.approvals.find((a) => !a.outcome && a.kind === input.kind && sameRef(a.subject, input.subject))
    if (existing) return existing
    const route = routeApproval(input.kind, { amount: input.amount, ...input.ctx })
    const id = `APR-TBD-${String(++this.core.seq).padStart(4, "0")}` as ApprovalRequestId
    const req: ApprovalRequest = {
      id, kind: input.kind, subject: input.subject, title: input.title, amount: input.amount, currency: input.currency ?? "USD",
      route, steps: route.steps.map((role) => ({ role })), raisedBy: this.core.role, raisedOn: TODAY, note: input.note,
    }
    this.core = { ...this.core, approvals: [req, ...this.core.approvals] }
    this.bump()
    this.bus.emit("approval.requested", { requestId: id, kind: req.kind, subject: req.subject })
    return req
  }
  /** Decide the current step. Refuses when the acting role is not the step's role. */
  decideApproval(id: ApprovalRequestId, outcome: "Approved" | "Rejected", reason?: string): Result<ApprovalRequest> {
    const req = this.core.approvals.find((a) => a.id === id)
    if (!req) return { ok: false, error: `Approval request ${id} not found.` }
    if (req.outcome) return { ok: false, error: `${id} is already decided (${req.outcome}).` }
    const stepIdx = req.steps.findIndex((s) => !s.decided)
    const step = req.steps[stepIdx]
    if (step.role !== this.core.role) return { ok: false, error: `This step waits for the ${step.role}. Switch "Acting as" to ${step.role} to decide it.` }
    if (outcome === "Rejected" && !reason?.trim()) return { ok: false, error: "A reason is required to reject.", field: "reason" }
    // Separation of duties: two distinct users in sequence (C-43 and similar).
    if (req.steps.some((s) => s.decided?.by === this.core.userId)) return { ok: false, error: "The same person cannot decide two steps of one request." }
    const steps = req.steps.map((s, i) => (i === stepIdx ? { ...s, decided: { outcome, by: this.core.userId, on: TODAY, reason } } : s))
    const done = outcome === "Rejected" || steps.every((s) => s.decided)
    const next: ApprovalRequest = { ...req, steps, outcome: done ? outcome : undefined }
    this.core = { ...this.core, approvals: this.core.approvals.map((a) => (a.id === id ? next : a)) }
    this.bump()
    if (done) this.bus.emit("approval.decided", { requestId: id, kind: req.kind, subject: req.subject, outcome, by: this.core.role, reason })
    return { ok: true, value: next }
  }

  // ---- derived
  allLinks(): DocLink[] {
    const out = [...SPINE_LINKS, ...this.core.links]
    for (const [key, d] of this.defs) if (d.links) out.push(...d.links(this.slices.get(key) as never))
    return out
  }
  private searchCache: { version: number; hits: SearchHit[] } | null = null
  search(): SearchHit[] {
    if (this.searchCache?.version === this.version) return this.searchCache.hits
    const out: SearchHit[] = []
    for (const [key, d] of this.defs) if (d.search) out.push(...d.search(this.slices.get(key) as never))
    this.searchCache = { version: this.version, hits: out }
    return out
  }

  /** Resolve a document reference to a title, route and status: module slices first (live
   *  state), then the seeded spine header. `known` is false when nobody has seeded it yet. */
  lookup(r: DocRef): { title: string; subtitle?: string; route: string; status?: SearchHit["status"]; known: boolean } {
    const hit = this.search().find((h) => h.ref && sameRef(h.ref, r))
    if (hit) return { title: hit.title, subtitle: hit.subtitle, route: hit.route, status: hit.status, known: true }
    const sp = SPINE_DOCS.find((x) => sameRef(x.ref, r))
    if (sp) return { title: r.id, subtitle: `${docLabel(r)} · ${sp.title}`, route: docRoute(r), status: sp.status, known: true }
    return { title: r.id, subtitle: docLabel(r), route: docRoute(r), known: false }
  }

  // ---- reset
  reset() {
    for (const [key, d] of this.defs) this.slices.set(key, d.seed())
    const { role, userId } = this.core
    this.core = { ...seedCore(), role, userId }
    this.bump()
  }

  private bump() {
    this.version++
    for (const l of this.listeners) l()
  }

  /** The narrow API handed to slice subscriptions. */
  readonly api = {
    on: this.bus.on.bind(this.bus),
    emit: this.bus.emit.bind(this.bus),
    mutate: <K extends keyof SliceStates, T>(key: K, fn: (draft: SliceStates[K], ctx: MutateCtx) => T) => this.mutate(key, fn),
    getSlice: <K extends keyof SliceStates>(key: K) => this.getSlice(key),
    hasSlice: (key: string) => this.hasSlice(key),
    raiseApproval: (input: Parameters<RootStore["raiseApproval"]>[0]) => this.raiseApproval(input),
  }
}

export type StoreApi = RootStore["api"]
export const store = new RootStore()

/** Helper so a module file reads `export const slice = defineSlice({...})`. */
export const defineSlice = <K extends keyof SliceStates>(def: SliceDef<K>) => def

// Development: a change to the store core reloads the page, so no module holds a stale store.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
