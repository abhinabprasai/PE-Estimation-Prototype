// shell slice: notifications, legal holds, profile preferences, search recents, validation register,
// flow walkthrough progress and the active legal entity. Everything is a design-seeded record; no
// status words here need an S-n list (a record with no list shows no badge).
import { defineSlice, ProtoError } from "@/store"
import { TODAY } from "@/data/shared"
import { NOTIFICATION_SEED, VALIDATION_SEED, type Notification, type ValidationItem } from "./seed"

export interface LegalHold {
  id: string
  object: string
  objectLabel: string
  setBy: string
  setOn: string
  reason: string
  releasedOn?: string
  releasedBy?: string
  releaseReason?: string
}
export interface Delegation {
  id: string
  delegate: string
  from: string
  to: string
  /** Largest financial approval the delegate may act on (USD). */
  limit: number
  scope: string
}
export interface ShellPrefs {
  density: "compact" | "comfortable"
  digest: Record<"Critical" | "Warning" | "Info", "Immediate" | "Hourly digest" | "Daily digest">
  channels: { inApp: boolean; email: boolean }
  language: "en" | "fr"
  landing: "role" | "last"
}
export interface FlowProgress {
  [flowId: string]: number
}
export interface ShellState {
  seq: number
  /** Active legal entity; "ALL" shows every entity. */
  entityId: string
  notifications: Notification[]
  legalHolds: LegalHold[]
  delegations: Delegation[]
  prefs: ShellPrefs
  recentSearches: string[]
  validation: ValidationItem[]
  flowProgress: FlowProgress
  /** Print log: reprint needs a reason (platform rule). */
  printLog: { id: string; doc: string; by: string; on: string; reason?: string }[]
}

declare module "@/store/types" {
  interface SliceStates {
    shell: ShellState
  }
}

export const seedShell = (): ShellState => ({
  seq: 100,
  entityId: "LE-TBD-10",
  notifications: NOTIFICATION_SEED.map((n) => ({ ...n })),
  legalHolds: [
    { id: "LH-TBD-001", object: "batch:BAT-TBD-B0301", objectLabel: "Batch BAT-TBD-B0301 (HV bushings)", setBy: "Quality Manager", setOn: "2026-10-02", reason: "Recall RCL-2026-001: suspend any purge of genealogy and quality evidence" },
  ],
  delegations: [{ id: "DLG-TBD-001", delegate: "Hiro Tanaka", from: "2026-10-12", to: "2026-10-23", limit: 100000, scope: "PO approval, Long-lead release" }],
  prefs: { density: "compact", digest: { Critical: "Immediate", Warning: "Hourly digest", Info: "Daily digest" }, channels: { inApp: true, email: true }, language: "en", landing: "role" },
  recentSearches: ["BAT-TBD-B0301", "20 MVA", "Midland Plains", "SN-TBD-20M-0301"],
  validation: VALIDATION_SEED.map((v) => ({ ...v })),
  flowProgress: {},
  printLog: [{ id: "PRT-TBD-001", doc: "Packing list, DLV-TBD-0031", by: "Kim Yoder", on: "2026-08-11" }],
})

export const shellSlice = defineSlice({
  key: "shell",
  seed: seedShell,
  search: (s) => s.notifications.filter((n) => !n.dismissed).map((n) => ({ title: n.title, subtitle: `Notification · ${n.severity} · ${n.source}`, route: n.link, group: "Notifications" })),
  links: () => [],
})

// ---- mutations (components call store.mutate("shell", ...) through these helpers)
export { ProtoError, TODAY }
