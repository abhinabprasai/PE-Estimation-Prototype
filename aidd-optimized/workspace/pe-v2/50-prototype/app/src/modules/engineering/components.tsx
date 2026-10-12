// Small building blocks used by the engineering screens. Token classes and shared patterns only.

import type { ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Chip, EmptyState, ErrorAlert, useFirstVisitLoading } from "@/components/patterns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { docRoute, type DocRef } from "@/data/domain"
import { store, useMutate, type MutateCtx } from "@/store"
import type { EngineeringState } from "./data/slice"
import { itemInfo, userName } from "./data/logic"

/** Screen data state: first-visit loading (600 ms), plus a prototype switch (?state=loading|empty|error)
 *  so reviewers can see every state of the screen. */
export function useScreenState(key: string) {
  const [params, setParams] = useSearchParams()
  const first = useFirstVisitLoading(key)
  const forced = params.get("state")
  return {
    loading: first || forced === "loading",
    empty: forced === "empty",
    error: forced === "error" ? "The engineering service did not answer (simulated). Your data is safe; try again." : undefined,
    retry: () => {
      params.delete("state")
      setParams(params, { replace: true })
    },
  }
}

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

/** Wraps a detail or wizard body with the shared loading / error / not-found states. */
export function DetailState({ state, found, what, back, children }: { state: ReturnType<typeof useScreenState>; found: boolean; what: string; back: { to: string; label: string }; children: ReactNode }) {
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
      <EmptyState title={`${what} not found`}>
        It may have been renamed, or the scenario was reset. <Link className="text-link underline" to={back.to}>{back.label}</Link>
      </EmptyState>
    )
  return <>{children}</>
}

/** Run an engineering action; toast the outcome. Returns the error text (for DialogShell) or null. */
export function useAct() {
  const mutate = useMutate("engineering")
  return <T,>(fn: (d: EngineeringState, ctx: MutateCtx) => T, ok?: string | ((v: T) => string)): { ok: true; value: T } | { ok: false; error: string } => {
    const r = mutate(fn)
    if (!r.ok) {
      toast.error(r.error)
      return r
    }
    if (ok) toast.success(typeof ok === "function" ? ok(r.value) : ok)
    return r
  }
}
/** Same, returning only the error text: the DialogShell onConfirm contract. */
export function useActDialog() {
  const mutate = useMutate("engineering")
  return <T,>(fn: (d: EngineeringState, ctx: MutateCtx) => T, ok?: string): string | null => {
    const r = mutate(fn)
    if (!r.ok) return r.error
    if (ok) toast.success(ok)
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

export function Item({ s, id, showDesc = true }: { s: EngineeringState; id: string; showDesc?: boolean }) {
  const info = itemInfo(s, id)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Link to={`/inventory/items/${id}`} className="font-mono text-link underline-offset-4 hover:underline">
        {id}
      </Link>
      {info.placeholder && <Chip kind="flag" note="Engineering Placeholder: Draft material; blocks EBOM release (V-ENG-03)">Placeholder</Chip>}
      {showDesc && <span className="text-muted-foreground">{info.description}</span>}
    </span>
  )
}

export const User = ({ id }: { id?: string }) => <span>{userName(id)}</span>

/** Lifecycle text for records the PRD gives no status list (OQ-21): never drawn as a badge. */
export function StageText({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm font-medium">{value}</span>
      <Chip kind="oq" id="OQ-21" note="No status list in the PRD for this record; shown as text, not a badge" />
    </span>
  )
}

export const NoPostings = ({ extra }: { extra?: string }) => (
  <p className="text-xs text-muted-foreground">
    Postings and scans: none on this screen (Book VI entry, asserted).{extra ? ` ${extra}` : ""}
  </p>
)
