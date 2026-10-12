// Append-only, hash-chained genealogy store helpers (C-53, [DOC:p.212 §4.2-4.3] (asserted)).
// Each event is chained per object (serial, else batch, else document): hash = h(prevHash + payload).
// Nothing here updates or deletes an event; a correction is a reversal event plus a replacement event.
// The hash function is a short non-cryptographic stand-in (design value) for the prototype.

import type { GenealogyEventId, TraceEventCode } from "@/data/domain"
import type { QtEvent } from "./types"

export const GENESIS = "00000000"

export function h(s: string): string {
  let x = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i)
    x = Math.imul(x, 0x01000193) >>> 0
  }
  return x.toString(16).padStart(8, "0")
}

export const chainKey = (e: Pick<QtEvent, "serial" | "batch" | "doc">) => e.serial ?? e.batch ?? `${e.doc.type}:${e.doc.id}`

export type NewEvent = Omit<QtEvent, "id" | "prevHash" | "hash" | "correction"> & { correction?: QtEvent["correction"] }

/** Append one event to the log (mutates `log`), computing id and the per-object hash link. */
export function appendEvent(log: QtEvent[], e: NewEvent): QtEvent {
  const key = chainKey(e)
  let prev = GENESIS
  for (let i = log.length - 1; i >= 0; i--)
    if (chainKey(log[i]) === key) {
      prev = log[i].hash
      break
    }
  const id = `GEN-TBD-${String(log.length + 1).padStart(5, "0")}` as GenealogyEventId
  const payload = [e.type, e.at, e.serial ?? "", e.batch ?? "", e.parentSerial ?? "", e.doc.type, e.doc.id, e.scanPoint ?? "", e.qty ?? "", e.evidence, e.action ?? "", e.refersTo ?? ""].join("|")
  const ev: QtEvent = { ...e, id, correction: e.correction ?? "Active", prevHash: prev, hash: h(prev + payload) }
  log.push(ev)
  return ev
}

/** Recompute every link; returns the ids whose stored hash does not match (tamper check). */
export function verifyChain(log: QtEvent[]): GenealogyEventId[] {
  const last = new Map<string, string>()
  const bad: GenealogyEventId[] = []
  for (const e of log) {
    const key = chainKey(e)
    const prev = last.get(key) ?? GENESIS
    const payload = [e.type, e.at, e.serial ?? "", e.batch ?? "", e.parentSerial ?? "", e.doc.type, e.doc.id, e.scanPoint ?? "", e.qty ?? "", e.evidence, e.action ?? "", e.refersTo ?? ""].join("|")
    if (e.prevHash !== prev || e.hash !== h(prev + payload)) bad.push(e.id)
    last.set(key, e.hash)
  }
  return bad
}

/** Effective correction state: an Active event that a later reversal points at reads as Reversed. */
export function effectiveState(log: QtEvent[], e: QtEvent): QtEvent["correction"] {
  if (e.correction !== "Active") return e.correction
  return log.some((x) => x.refersTo === e.id && x.correction === "Reversed") ? "Reversed" : "Active"
}

export const dedupeKey = (code: TraceEventCode, docId: string, serial?: string, batch?: string) => `${code}|${docId}|${serial ?? ""}|${batch ?? ""}`
