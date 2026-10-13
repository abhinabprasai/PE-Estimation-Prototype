// Shared building blocks for the target-state group: the phased banner, the nine-state control and
// the action guard every primary action goes through. Book IX modules are later phase; the banner on
// every screen names the decision and the evidence that governs activation (README, "Rules").

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { CloudOff, Info, Lock, ShieldAlert, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, ErrorAlert, FamilyBadge, useFirstVisitLoading } from "@/components/patterns"
import type { Family, Role } from "@/data/domain"
import { useRole } from "@/store"

export const T_STATES = ["normal", "empty", "loading", "validation", "authorization", "conflict", "offline", "degraded", "read-only"] as const
export type TState = (typeof T_STATES)[number]

export type RunResult = string | { ok: string } | void
export interface Need {
  /** Roles a rule names for this action (the PRD has no role-by-action matrix, ASM-PERM-1). */
  roles?: Role[]
  why?: string
}
export interface ScreenOpts {
  /** Text shown for the validation state (the real rule the screen enforces). */
  validation?: string
  /** What the degraded state means on this screen. */
  degraded?: string
  /** What the authorization state means on this screen. */
  auth?: string
  /** What the read-only state means on this screen. */
  readOnly?: string
  /** What "last synced" means offline. */
  offline?: string
}

export interface ScreenState {
  state: TState
  setState: (s: TState) => void
  loading: boolean
  empty: boolean
  /** read-only, authorization or loading: write controls are disabled. */
  locked: boolean
  readOnly: boolean
  opts: ScreenOpts
  rows: <T>(r: T[]) => T[]
  /** Run a write through the guard. A string result is an error shown under the banner. */
  run: (fn: () => RunResult, need?: Need) => void
  /** The guard alone: the message a write would get in the current state, or null. For dialogs that stay open. */
  guard: (need?: Need) => string | null
  msg: string | null
  setMsg: (m: string | null) => void
}

/** The nine states of a screen (normal, empty, loading, validation, authorization, conflict, offline,
 *  degraded, read-only) as a control, plus the guard writes pass through. */
export function useScreenState(key: string, opts: ScreenOpts = {}): ScreenState {
  const [state, setState] = useState<TState>("normal")
  const [msg, setMsg] = useState<string | null>(null)
  const first = useFirstVisitLoading(`ts:${key}`)
  const [role] = useRole()
  const loading = first || state === "loading"
  const guard = (need?: Need): string | null => {
    if (state === "validation") return opts.validation ?? "Validation: fix the marked fields before saving."
    if (state === "conflict") return "Conflict: this record changed after you opened it (saved by another user a moment ago). Nothing was written. Reload to take the latest version."
    if (state === "offline") return "Offline: this write needs the connection. Nothing was saved. Reads show the last synced data."
    if (state === "authorization") return opts.auth ?? "Not authorized: your role cannot change this screen."
    if (state === "read-only") return opts.readOnly ?? "Read-only: this view is for reference."
    if (need?.roles && !need.roles.includes(role)) return `Not authorized: ${need.why ?? "a rule on this screen names the role"} (${need.roles.join(" or ")}). You are acting as ${role}.`
    return null
  }
  const run = (fn: () => RunResult, need?: Need) => {
    setMsg(null)
    const g = guard(need)
    if (g) return setMsg(g)
    const r = fn()
    if (typeof r === "string") setMsg(r)
    else if (r && "ok" in r) toast.success(r.ok)
  }
  return {
    state, setState, loading, empty: state === "empty", locked: state === "read-only" || state === "authorization" || loading, readOnly: state === "read-only", opts,
    rows: <T,>(r: T[]) => (state === "empty" ? [] : r),
    run, guard, msg, setMsg,
  }
}

const LABEL: Record<TState, string> = {
  normal: "Normal", empty: "Empty", loading: "Loading", validation: "Validation", authorization: "Authorization", conflict: "Conflict", offline: "Offline", degraded: "Degraded", "read-only": "Read-only",
}

/** Banner for the phased state, the nine-state switch and the banner each state calls for. */
export function TargetFrame({ st, decision, evidence, hideSwitch }: { st: ScreenState; decision: string; evidence: string; hideSwitch?: boolean }) {
  const s = st.state
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm">
        <Chip kind="design">Target state (phased)</Chip>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{decision}.</span> <span className="text-muted-foreground">Activation evidence: {evidence}</span>
        </span>
        {!hideSwitch && (
          <span className="flex items-center gap-2">
            <Label htmlFor="ts-state" className="text-xs text-muted-foreground">Prototype state</Label>
            <Select value={s} onValueChange={(v) => { st.setState(v as TState); st.setMsg(null) }}>
              <SelectTrigger id="ts-state" size="sm" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{T_STATES.map((t) => <SelectItem key={t} value={t}>{LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </span>
        )}
      </div>
      {s === "authorization" && <ErrorAlert title="Not authorized">{st.opts.auth ?? "Your role cannot change this screen. You can still read it."}</ErrorAlert>}
      {s === "conflict" && (
        <ErrorAlert title="Conflict" action={<button className="underline" onClick={() => { st.setState("normal"); st.setMsg(null) }}>Reload latest version</button>}>
          Someone else saved this record after you opened it. Your change is held, not lost: reload, compare, then re-apply.
        </ErrorAlert>
      )}
      {s === "offline" && (
        <Alert><CloudOff aria-hidden="true" /><AlertTitle>Offline</AlertTitle><AlertDescription>{st.opts.offline ?? "Showing the last synced data. Writes wait for the connection; nothing is queued silently."}</AlertDescription></Alert>
      )}
      {s === "degraded" && (
        <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Degraded</AlertTitle><AlertDescription>{st.opts.degraded ?? "A source is slow or partly unavailable. Showing the last good data (47 minutes old). Writes still work."}</AlertDescription></Alert>
      )}
      {s === "read-only" && (
        <Alert><Lock aria-hidden="true" /><AlertTitle>Read-only</AlertTitle><AlertDescription>{st.opts.readOnly ?? "This view is for reference. Write controls are disabled."}</AlertDescription></Alert>
      )}
      {s === "validation" && (
        <Alert><ShieldAlert aria-hidden="true" /><AlertTitle>Validation</AlertTitle><AlertDescription>{st.opts.validation ?? "Fix the marked fields before saving."} Press the primary action to see the message.</AlertDescription></Alert>
      )}
      {s === "empty" && <p className="text-sm text-muted-foreground">Empty state: nothing exists yet for this view.</p>}
      {st.msg && <ErrorAlert title="Not done" onDismiss={() => st.setMsg(null)}>{st.msg}</ErrorAlert>}
    </div>
  )
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="flex items-center justify-between text-sm font-semibold">{title}{action}</h2>
      {children}
    </section>
  )
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string | null; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

/** A badge for a status word that has a list in Book IX but not in the S-1..S-43 catalog:
 *  the word is the PRD's, the family is a reading (OQ-18 families are tentative). */
export function Tag({ family, label }: { family: Family; label: string }) {
  return <FamilyBadge family={family} label={label} />
}

export const OQ_NOTE = "Status family is a reading: the S-1..S-43 catalog has no list for this record"

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"><Info className="mb-1 size-4" aria-hidden="true" />{children}</p>
}

export function Btn({ onClick, children, disabled, variant = "outline", size = "sm" }: { onClick: () => void; children: ReactNode; disabled?: boolean; variant?: "outline" | "default" | "ghost" | "destructive"; size?: "sm" | "default" }) {
  return <Button variant={variant} size={size} disabled={disabled} onClick={onClick}>{children}</Button>
}

/** Seeded PRNG so a run with the same inputs reproduces the same numbers (OPT determinism, OEE seed). */
export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
export const r2 = (n: number) => Math.round(n * 100) / 100
