// Small shared pieces for the planning-production screens: data-state preview (loading / empty /
// error), the action runner with toasts, links and labels. Token classes only.
import type { ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, EmptyState, ErrorAlert, useFirstVisitLoading } from "@/components/patterns"
import { docRoute, type DocRef } from "@/data/domain"
import { CUSTOMERS, MATERIALS, USERS } from "@/data/shared"
import { fmtNumber } from "@/lib/format"
import { store, useMutate, type MutateCtx } from "@/store"
import type { PlanningProductionState } from "./data/types"

export function useScreenState(key: string) {
  const [params, setParams] = useSearchParams()
  const first = useFirstVisitLoading(key)
  const forced = params.get("state")
  return {
    loading: first || forced === "loading",
    empty: forced === "empty",
    error: forced === "error" ? "The planning service did not answer (simulated). Nothing was changed; try again." : undefined,
    retry: () => {
      params.delete("state")
      setParams(params, { replace: true })
    },
  }
}
export type ScreenState = ReturnType<typeof useScreenState>

export function StatePreview() {
  const [params, setParams] = useSearchParams()
  const v = params.get("state") ?? "live"
  return (
    <span className="inline-flex items-center gap-1">
      <Chip kind="design" note="Prototype control: preview the loading, empty and error states of this screen">State preview</Chip>
      <Select
        value={v}
        onValueChange={(x) => {
          if (x === "live") params.delete("state")
          else params.set("state", x)
          setParams(params, { replace: true })
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-28" aria-label="Preview data state">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="live">Live data</SelectItem>
          <SelectItem value="loading">Loading</SelectItem>
          <SelectItem value="empty">Empty</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </span>
  )
}

/** Wraps a detail or board body with the loading / error / not-found states. */
export function BodyState({ state, found = true, what, back, children }: { state: ScreenState; found?: boolean; what: string; back?: { to: string; label: string }; children: ReactNode }) {
  if (state.error)
    return (
      <ErrorAlert title={`${what} could not be loaded`} action={<button className="underline" onClick={state.retry}>Try again</button>}>
        {state.error}
      </ErrorAlert>
    )
  if (state.loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  if (!found || state.empty)
    return (
      <EmptyState title={found ? `No ${what.toLowerCase()} yet` : `${what} not found`}>
        {found ? "Nothing to show for the current scenario." : "It may not exist, or the scenario was reset."}{" "}
        {back && (
          <Link className="text-link underline" to={back.to}>
            {back.label}
          </Link>
        )}
      </EmptyState>
    )
  return <>{children}</>
}

type Fn<T> = (d: PlanningProductionState, ctx: MutateCtx) => T
/** Run an action; toast the outcome. Returns the value or undefined on refusal. */
export function useAct() {
  const mutate = useMutate("planningProduction")
  return <T,>(fn: Fn<T>, ok?: string | ((v: T) => string)): T | undefined => {
    const r = mutate(fn)
    if (!r.ok) {
      toast.error(r.error)
      return undefined
    }
    const msg = typeof ok === "function" ? ok(r.value) : ok
    if (msg) toast.success(msg)
    return r.value
  }
}
/** Same, for DialogShell: returns the error text (keeps the dialog open) or null. */
export function useActDialog() {
  const mutate = useMutate("planningProduction")
  return <T,>(fn: Fn<T>, ok?: string | ((v: T) => string)): string | null => {
    const r = mutate(fn)
    if (!r.ok) return r.error
    const msg = typeof ok === "function" ? ok(r.value) : ok
    if (msg) toast.success(msg)
    return null
  }
}

export function RefLink({ r, children }: { r: DocRef; children?: ReactNode }) {
  const info = store.lookup(r)
  return (
    <Link to={info.route ?? docRoute(r)} className="font-mono text-link underline-offset-4 hover:underline">
      {children ?? r.id}
    </Link>
  )
}
export const WoLink = ({ id }: { id: string }) => <RefLink r={{ type: "productionOrder", id }} />
export const SoLink = ({ id }: { id: string }) => <RefLink r={{ type: "salesOrder", id }} />

export const matDesc = (id: string) => MATERIALS.find((m) => m.id === id)?.description ?? id
export const custName = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id
export const userName = (id: string) => USERS.find((u) => u.id === id)?.name ?? id
export const qty = (n: number) => fmtNumber(n, n % 1 ? 1 : 0)

export function Item({ id, short }: { id: string; short?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-mono text-xs">{id}</span>
      {!short && <span className="truncate text-xs text-muted-foreground">{matDesc(id)}</span>}
    </span>
  )
}

/** Activity log list. */
export function ActivityList({ items }: { items: { at: string; by: string; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {[...items].reverse().map((a, i) => (
        <li key={i} className="grid grid-cols-[96px_160px_minmax(0,1fr)] gap-2 border-b pb-2">
          <span className="tabular text-muted-foreground">{a.at}</span>
          <span className="text-muted-foreground">{a.by}</span>
          <span>{a.text}</span>
        </li>
      ))}
    </ol>
  )
}

/** Horizontal load bar: hours against capacity (overload impossible in the finite plan). */
export function LoadBar({ hours, capacity, label }: { hours: number; capacity: number; label?: string }) {
  const pct = capacity > 0 ? Math.min(100, (hours / capacity) * 100) : 0
  return (
    <div className="flex flex-col gap-1" title={label}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label ?? "Load"}>
        <div className={pct >= 95 ? "h-full bg-status-exception" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{capacity > 0 ? `${fmtNumber(hours)} / ${fmtNumber(capacity)} h` : "no capacity"}</span>
    </div>
  )
}

/** Neutral marker for a PRD fact beside a record (Firmed, Running, Milestone, Material ready, Firm
 *  reservation). Chip kind="design" is kept for values the PRD does not give. */
export function Marker({ children, note }: { children: ReactNode; note?: string }) {
  return <Badge variant="outline" title={note}>{children}</Badge>
}
