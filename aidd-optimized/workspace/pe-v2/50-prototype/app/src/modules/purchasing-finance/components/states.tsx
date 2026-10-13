// The nine screen states for the feature-list screens of this group: normal, empty, loading, validation,
// authorization, conflict, offline, degraded, read-only. A reviewer previews them from the "States"
// menu (or ?state=...). Writes are disabled (with the reason) in every state that cannot save, so the
// primary action never silently fails. Token classes only.

import type { ReactNode } from "react"
import { useSearchParams } from "react-router"
import { CloudOff, Lock, RefreshCw, ShieldAlert, SlidersHorizontal, TriangleAlert, Eye, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState, useFirstVisitLoading } from "@/components/patterns"
import { useRole } from "@/store"
import { SkeletonTable } from "./bits"

export type NineState = "normal" | "empty" | "loading" | "validation" | "authorization" | "conflict" | "offline" | "degraded" | "readonly"
export const NINE: { id: NineState; label: string }[] = [
  { id: "normal", label: "Normal (seeded data)" },
  { id: "empty", label: "Empty" },
  { id: "loading", label: "Loading" },
  { id: "validation", label: "Validation errors" },
  { id: "authorization", label: "Authorization (no rights)" },
  { id: "conflict", label: "Conflict (changed by another user)" },
  { id: "offline", label: "Offline" },
  { id: "degraded", label: "Degraded (feed delayed)" },
  { id: "readonly", label: "Read-only" },
]

export interface NineOptions {
  /** What the degraded state says is delayed on this screen. */
  degraded?: string
  /** The validation messages shown in the validation state. */
  validation?: string[]
  /** Roles named by the PRD as the writers of this screen (for the authorization message). */
  writers?: string
}

/** The nine states for one screen. `blockReason` is non-null whenever a write must not run. */
export function useNineStates(key: string, o: NineOptions = {}) {
  const [params, setParams] = useSearchParams()
  const [role] = useRole()
  const first = useFirstVisitLoading(key)
  const raw = params.get("state")
  const forced = (NINE.some((n) => n.id === raw) ? raw : raw === "error" ? "degraded" : "normal") as NineState
  const set = (s: NineState) => {
    const p = new URLSearchParams(params)
    if (s === "normal") p.delete("state")
    else p.set("state", s)
    setParams(p, { replace: true })
  }
  const blockReason =
    forced === "offline"
      ? "You are offline: changes cannot be saved until the connection returns."
      : forced === "readonly"
        ? "This view is read-only: the record is closed or you have view access only."
        : forced === "authorization"
          ? `Acting as ${role}: you do not hold the rights to change this${o.writers ? ` (${o.writers})` : ""}.`
          : forced === "conflict"
            ? "Another user saved a newer version of this record. Reload the latest version before you change it."
            : null
  const banner = <StateBanner state={forced} role={role} o={o} onReload={() => set("normal")} />
  return {
    state: forced,
    loading: first || forced === "loading",
    empty: forced === "empty",
    validation: forced === "validation",
    blockReason,
    /** Return from a DialogShell onConfirm: the reason string while a write is blocked, else null. */
    guard: (): string | null => blockReason,
    set,
    retry: () => set("normal"),
    banner,
    menu: <StateMenu value={forced} onChange={set} />,
  }
}
export type NineStates = ReturnType<typeof useNineStates>

function StateMenu({ value, onChange }: { value: NineState; onChange: (s: NineState) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Preview the nine screen states">
          <SlidersHorizontal aria-hidden="true" /> States
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Preview screen state</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NINE.map((n) => (
          <DropdownMenuItem key={n.id} onSelect={() => onChange(n.id)} aria-checked={value === n.id}>
            {n.label}
            {value === n.id ? " (shown)" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StateBanner({ state, role, o, onReload }: { state: NineState; role: string; o: NineOptions; onReload: () => void }) {
  const wrap = (icon: ReactNode, title: string, body: ReactNode, destructive = false, action?: ReactNode) => (
    <Alert variant={destructive ? "destructive" : "default"} className="mt-2">
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div>{body}</div>
        {action && <div className="mt-1">{action}</div>}
      </AlertDescription>
    </Alert>
  )
  switch (state) {
    case "offline":
      return wrap(<CloudOff aria-hidden="true" />, "Offline", "Reading works from the last loaded data. Saving, approving and posting are disabled until the connection returns; nothing you typed is sent.")
    case "readonly":
      return wrap(<Eye aria-hidden="true" />, "Read-only", "Controls that change data are disabled. A closed or terminal record opens read-only (C-55).")
    case "authorization":
      return wrap(<ShieldAlert aria-hidden="true" />, "You cannot change this", `Acting as ${role}. ${o.writers ? `Changes here are made by ${o.writers}.` : "Switch Acting as to a role that holds the right."} Reading stays available.`, true)
    case "conflict":
      return wrap(<RefreshCw aria-hidden="true" />, "Changed by another user", "Someone saved a newer version while this page was open. Your edit is kept in the form but cannot be saved over theirs.", true, <Button size="sm" variant="outline" onClick={onReload}>Reload latest version</Button>)
    case "degraded":
      return wrap(<TriangleAlert aria-hidden="true" />, "Some data is delayed", o.degraded ?? "A feeding service answered slowly; figures can be up to 24 hours old. Actions that do not depend on them still work.")
    case "validation":
      return wrap(
        <FileWarning aria-hidden="true" />,
        "Fix these before saving",
        <ul className="list-disc pl-4">{(o.validation ?? ["A required field is empty.", "A date is outside the allowed range."]).map((m) => <li key={m}>{m}</li>)}</ul>,
        true,
      )
    default:
      return null
  }
}

/** The empty-state explanation line for a screen that is read-only because it is terminal. */
export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Lock className="size-4" aria-hidden="true" /> {children}
    </p>
  )
}

/** Body gate: the loading skeleton and the empty state come before the content; every other state is a banner plus disabled writes. */
export function StateGate({ st, cols = 6, rows = 6, emptyTitle, emptyBody, children }: { st: NineStates; cols?: number; rows?: number; emptyTitle: string; emptyBody?: ReactNode; children: ReactNode }) {
  if (st.loading) return <SkeletonTable cols={cols} rows={rows} />
  if (st.empty) return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
  return <>{children}</>
}
/** Props that disable a write control with the reason in the tooltip while the state blocks writes. */
export const writeProps = (st: NineStates) => (st.blockReason ? { disabled: true, title: st.blockReason } : {})
