// Writes to the shell slice. Each returns the store Result so a screen can show the error.
import { ProtoError, store } from "@/store"
import type { Delegation, ShellPrefs } from "./slice"
import type { ValidationItem } from "./seed"

export const shellActions = {
  setEntity: (entityId: string) => store.mutate("shell", (d) => void (d.entityId = entityId)),
  markRead: (ids: string[], read: boolean) =>
    store.mutate("shell", (d) => {
      for (const n of d.notifications) if (ids.includes(n.id)) n.read = read
    }),
  dismiss: (ids: string[]) =>
    store.mutate("shell", (d) => {
      for (const n of d.notifications) if (ids.includes(n.id)) (n.dismissed = true), (n.read = true)
    }),
  restore: (ids: string[]) =>
    store.mutate("shell", (d) => {
      for (const n of d.notifications) if (ids.includes(n.id)) n.dismissed = false
    }),
  addRecent: (q: string) =>
    store.mutate("shell", (d) => {
      const t = q.trim()
      if (!t) return
      d.recentSearches = [t, ...d.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8)
    }),
  clearRecent: () => store.mutate("shell", (d) => void (d.recentSearches = [])),
  setPrefs: (p: Partial<ShellPrefs>) => store.mutate("shell", (d) => void Object.assign(d.prefs, p)),
  addDelegation: (x: Omit<Delegation, "id">) =>
    store.mutate("shell", (d) => {
      // Standing delegation of financial approvals above $250,000 is prohibited (C-2).
      if (x.limit > 250_000) throw new ProtoError("Standing delegation of financial approvals above $250,000 is prohibited (segregation-of-duties rule). Lower the limit to $250,000 or less; approvals above that stay with you.", "limit")
      if (!x.delegate) throw new ProtoError("Choose a delegate.", "delegate")
      if (!x.from || !x.to) throw new ProtoError("A delegation needs a date range: enter both dates.", "from")
      if (x.to < x.from) throw new ProtoError("The end date is before the start date.", "to")
      d.seq += 1
      d.delegations.push({ ...x, id: `DLG-TBD-${String(d.seq).padStart(3, "0")}` })
    }),
  revokeDelegation: (id: string) => store.mutate("shell", (d) => void (d.delegations = d.delegations.filter((x) => x.id !== id))),
  setValidation: (id: string, patch: Partial<ValidationItem>) =>
    store.mutate("shell", (d) => {
      const v = d.validation.find((x) => x.id === id)
      if (v) Object.assign(v, patch)
    }),
  setFlowStep: (flowId: string, step: number) => store.mutate("shell", (d) => void (d.flowProgress[flowId] = step)),
  logPrint: (doc: string, reason?: string) =>
    store.mutate("shell", (d, ctx) => {
      d.seq += 1
      const reprint = d.printLog.some((p) => p.doc === doc)
      if (reprint && !reason?.trim()) throw new ProtoError("A reprint needs a reason.", "reason")
      d.printLog.unshift({ id: `PRT-TBD-${String(d.seq).padStart(3, "0")}`, doc, by: ctx.role, on: ctx.today, reason })
    }),
}
