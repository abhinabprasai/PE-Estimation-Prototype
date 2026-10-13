// The nine screen states for the configuration screens: normal, empty, loading, validation, authorization,
// conflict, offline, degraded, read-only. Validation, conflict and authorization also arise from real actions
// (bad input, a stale version, a role that may not act); the "Prototype state" switch in the header forces the
// states that need a fault to show (loading, empty, offline, degraded, read-only, denied, conflict).

import { useCallback, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { WifiOff, ShieldAlert, TriangleAlert, Lock, GitMerge } from "lucide-react"
import type { Result } from "@/store"
import { EmptyState, ErrorAlert, SkeletonRows, useFirstVisitLoading } from "@/components/patterns"
import { Chip } from "@/components/patterns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export type ViewState = "normal" | "loading" | "empty" | "offline" | "degraded" | "readonly" | "denied" | "conflict"
const LABELS: Record<ViewState, string> = {
  normal: "Normal", loading: "Loading", empty: "Empty", offline: "Offline", degraded: "Degraded", readonly: "Read-only", denied: "No permission", conflict: "Conflict on save",
}
export interface View {
  state: ViewState
  setState: (s: ViewState) => void
  /** First visit skeleton (600 ms), or the forced loading state. */
  loading: boolean
  /** Why a write is blocked in this state, or null. */
  writeError: () => string | null
  /** Run an action: blocked states return their message; otherwise toast the outcome and return the error text or null. */
  run: (fn: () => Result<string>) => string | null
  /** True when the screen should show no records (forced empty state). */
  empty: boolean
  readOnly: boolean
  conflict: boolean
}

export function useView(screenKey: string): View {
  const [params, setParams] = useSearchParams()
  const raw = params.get("view") as ViewState | null
  const state: ViewState = raw && raw in LABELS ? raw : "normal"
  const first = useFirstVisitLoading(screenKey)
  const setState = useCallback(
    (s: ViewState) => {
      const next = new URLSearchParams(params)
      if (s === "normal") next.delete("view")
      else next.set("view", s)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )
  const writeError = useCallback((): string | null => {
    if (state === "offline") return "You are offline. Configuration changes are not queued (C-50): reconnect, then save again."
    if (state === "readonly") return "This view is read-only. Switch the prototype state back to Normal to edit."
    if (state === "denied") return "You do not have permission to change this."
    if (state === "conflict") return "Conflict: another user saved a newer version after you opened this one. Reload the page, then apply your change again."
    return null
  }, [state])
  const run = useCallback(
    (fn: () => Result<string>): string | null => {
      const w = writeError()
      if (w) {
        toast.error(w)
        return w
      }
      const r = fn()
      if (r.ok) {
        toast.success(r.value)
        return null
      }
      toast.error(r.error)
      return r.error
    },
    [writeError],
  )
  return { state, setState, loading: first || state === "loading", writeError, run, empty: state === "empty", readOnly: state === "readonly" || state === "offline", conflict: state === "conflict" }
}

/** The header control that forces a state. */
export function StatePicker({ view }: { view: View }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="proto-state" className="text-xs text-muted-foreground">Prototype state</Label>
      <Select value={view.state} onValueChange={(v) => view.setState(v as ViewState)}>
        <SelectTrigger id="proto-state" className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(LABELS) as ViewState[]).map((k) => <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Banners and the content swap for the forced states. `children` renders for normal, degraded, offline, read-only and conflict. */
export function StateFrame({ view, rows = 6, cols = 5, emptyTitle, emptyBody, degraded, subject = "this screen", children }: { view: View; rows?: number; cols?: number; emptyTitle?: string; emptyBody?: ReactNode; degraded?: string; subject?: string; children: ReactNode }) {
  const bar = view.state !== "normal" ? <div className="flex justify-end"><StatePicker view={view} /></div> : null
  if (view.state === "denied")
    return (
      <div className="flex flex-col gap-4">{bar}<ErrorAlert title={`You do not have access to ${subject}`} onDismiss={() => view.setState("normal")}>
        <span className="flex items-center gap-2"><ShieldAlert className="size-4" aria-hidden="true" /> Your role is not on the access list for this screen. Ask the owner of the screen to grant it; nothing is shown, not even a greyed-out copy (one policy engine, no UI-only hiding).</span>
      </ErrorAlert></div>
    )
  if (view.loading) return <div className="flex flex-col gap-4">{bar}<SkeletonRows cols={cols} rows={rows} /></div>
  if (view.empty) return <div className="flex flex-col gap-4">{bar}<EmptyState title={emptyTitle ?? "Nothing here yet."}>{emptyBody}</EmptyState></div>
  return (
    <div className="flex flex-col gap-4">
      {view.state === "offline" && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-offline-banner-bg px-4 py-2 text-sm text-status-pending-ink"><WifiOff className="size-4" aria-hidden="true" /> Offline: showing the last synced copy. Saving is off until the connection returns.</p>
      )}
      {view.state === "degraded" && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-offline-banner-bg px-4 py-2 text-sm text-status-pending-ink"><TriangleAlert className="size-4" aria-hidden="true" /> {degraded ?? "Degraded: a dependent service is slow. Changes save, and anything that needs it is queued and arrives late."}</p>
      )}
      {view.state === "readonly" && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm"><Lock className="size-4" aria-hidden="true" /> Read-only: you can read everything on this screen and change nothing. <Chip kind="design">Read-only</Chip></p>
      )}
      {view.state === "conflict" && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm"><GitMerge className="size-4" aria-hidden="true" /> Another user saved a newer version of a record on this screen. The next save you make is refused with a conflict message; reload to continue.</p>
      )}
      {children}
    </div>
  )
}

/** "Only the X may do this" note shown beside a disabled control. */
export const WhyDisabled = ({ children }: { children: ReactNode }) => <p className="text-xs text-muted-foreground">{children}</p>
