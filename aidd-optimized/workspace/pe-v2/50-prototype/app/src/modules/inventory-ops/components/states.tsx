// The nine states of a screen (normal, empty, loading, validation, authorization, conflict, offline,
// degraded, read-only). The prototype has no backend that can fail, so a selector previews each one
// (?state=...). Real conditions (the acting role, the device being offline) use the same banners.
// Writes are blocked in offline, conflict, authorization and read-only; degraded blocks only what
// the page says depends on the missing service.

import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { CloudOff, Lock, ShieldAlert, TriangleAlert, WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirstVisitLoading } from "@/components/patterns"
import { useRole } from "@/store"

export type ViewState = "normal" | "empty" | "loading" | "validation" | "authorization" | "conflict" | "offline" | "degraded" | "read-only" | "error"
export const VIEW_STATES: { id: ViewState; label: string }[] = [
  { id: "normal", label: "State: normal" },
  { id: "empty", label: "Preview: empty" },
  { id: "loading", label: "Preview: loading" },
  { id: "error", label: "Preview: load error" },
  { id: "validation", label: "Preview: validation" },
  { id: "authorization", label: "Preview: authorization" },
  { id: "conflict", label: "Preview: conflict" },
  { id: "offline", label: "Preview: offline" },
  { id: "degraded", label: "Preview: degraded" },
  { id: "read-only", label: "Preview: read-only" },
]

export interface ViewStateApi {
  state: ViewState
  loading: boolean
  empty: boolean
  error?: string
  offline: boolean
  /** True when a write may go ahead (not offline, in conflict, unauthorised or read-only). */
  canWrite: boolean
  /** Why writes are blocked, for a disabled button's title. */
  blockedWhy?: string
  degraded: boolean
  /** Show a sample validation message on forms (the "validation" preview). */
  validation: boolean
  onRetry: () => void
  /** The preview selector. */
  toolbar: ReactNode
  banners: ReactNode
  set: (s: ViewState) => void
}

/** `degradedWhat`: the service the page leans on, named in the degraded banner.
 *  `offlineQueues`: the screen queues writes while offline (handheld), so offline does not block them. */
export function useViewState(key: string, opts: { degradedWhat?: string; authorizedRoles?: string[]; terminalRecord?: boolean; offlineQueues?: boolean; conflictWhat?: string } = {}): ViewStateApi {
  const first = useFirstVisitLoading(key)
  const [sp, setSp] = useSearchParams()
  const [role] = useRole()
  const [resolved, setResolved] = useState(false)
  const raw = (sp.get("state") ?? "normal") as ViewState
  const state: ViewState = VIEW_STATES.some((s) => s.id === raw) ? raw : "normal"
  const set = (v: ViewState) => {
    const n = new URLSearchParams(sp)
    if (v === "normal") n.delete("state")
    else n.set("state", v)
    setResolved(false)
    setSp(n, { replace: true })
  }
  const roleBlocked = !!opts.authorizedRoles && !opts.authorizedRoles.includes(role)
  const conflict = state === "conflict" && !resolved
  const offline = state === "offline"
  const blockedWhy =
    offline && !opts.offlineQueues ? "Offline: this change is not queued; reconnect first"
    : conflict ? "Conflict: reload to see the other change first"
    : state === "authorization" || roleBlocked ? `Acting as ${role}: this action is not yours (see the rules)`
    : state === "read-only" || opts.terminalRecord ? "Read-only: the record is in a terminal status (C-55)"
    : undefined
  const toolbar = (
    <Select value={state} onValueChange={(v) => set(v as ViewState)}>
      <SelectTrigger size="sm" className="h-8 w-44 bg-background text-sm text-foreground" aria-label="Preview a screen state (prototype)">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VIEW_STATES.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const banners = (
    <div className="flex flex-col gap-2 empty:hidden">
      {offline && !opts.offlineQueues && (
        <Alert role="status">
          <WifiOff aria-hidden="true" />
          <AlertTitle>Offline</AlertTitle>
          <AlertDescription>The connection dropped. You can read what is loaded; changes stay disabled until you reconnect.</AlertDescription>
        </Alert>
      )}
      {state === "degraded" && (
        <Alert role="status">
          <CloudOff aria-hidden="true" />
          <AlertTitle>Degraded</AlertTitle>
          <AlertDescription>{opts.degradedWhat ?? "A supporting service is slow"}; showing the last known data from 09:02. Actions that depend on it are disabled until it answers.</AlertDescription>
        </Alert>
      )}
      {conflict && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Conflict</AlertTitle>
          <AlertDescription>
            <span>{opts.conflictWhat ?? "Another user changed this record after you opened it (Carl Halvorsen, 09:14). Your next change would overwrite theirs, so it is held."}</span>
            <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => setResolved(true)}>
              Reload their change
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(state === "authorization" || roleBlocked) && (
        <Alert role="status">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Not authorised</AlertTitle>
          <AlertDescription>
            Acting as {role}. {opts.authorizedRoles ? `This screen is changed by ${opts.authorizedRoles.join(" or ")}; ` : "Your role can read this screen; "}the controls that change records are disabled. Switch "Acting as" to continue.
          </AlertDescription>
        </Alert>
      )}
      {(state === "read-only" || opts.terminalRecord) && (
        <Alert role="status">
          <Lock aria-hidden="true" />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>This record is in a terminal status or an archived period; it opens read-only (C-55).</AlertDescription>
        </Alert>
      )}
    </div>
  )
  return {
    state,
    loading: first || state === "loading",
    empty: state === "empty",
    error: state === "error" ? "The server did not answer in time (simulated). Your filters are kept." : undefined,
    offline,
    canWrite: !blockedWhy,
    blockedWhy,
    degraded: state === "degraded",
    validation: state === "validation",
    onRetry: () => set("normal"),
    toolbar,
    banners,
    set,
  }
}
