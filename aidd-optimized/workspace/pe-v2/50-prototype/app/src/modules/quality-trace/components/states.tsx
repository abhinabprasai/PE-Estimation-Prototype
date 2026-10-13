// The nine mandatory screen states (Book V §10.3) for the feature-list screens: normal, empty,
// loading, validation, authorization, conflict, offline, degraded, read-only. A review switch
// (`?state=`) shows each one on any screen that uses <StateFrame>; it is a design convenience
// (reading QT-R41), not a feature. Real conditions (role, device offline) use the same frames.

import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { Inbox, Lock, RefreshCw, TriangleAlert, WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, EmptyState, useFirstVisitLoading } from "@/components/patterns"
import { PageHeader, type PageHeaderProps } from "@/components/templates"
import { useRole } from "@/store"
import { Reading } from "./bits"

export const SCREEN_STATES = ["normal", "empty", "loading", "validation", "authorization", "conflict", "offline", "degraded", "read-only"] as const
export type ScreenState = (typeof SCREEN_STATES)[number]

export interface ScreenStateApi {
  state: ScreenState
  set: (s: ScreenState) => void
  /** True for the first-visit skeleton or the forced loading state. */
  loading: boolean
  /** Writes are blocked (read-only, offline, authorization). */
  locked: boolean
}

/** `key` is the screen id; the first visit shows a 600 ms skeleton, as on every other screen. */
export function useScreenState(key: string): ScreenStateApi {
  const [params, setParams] = useSearchParams()
  const first = useFirstVisitLoading(key)
  const raw = params.get("state") as ScreenState | null
  const state: ScreenState = raw && (SCREEN_STATES as readonly string[]).includes(raw) ? raw : "normal"
  const set = (s: ScreenState) => {
    if (s === "normal") params.delete("state")
    else params.set("state", s)
    setParams(params, { replace: true })
  }
  return { state, set, loading: first || state === "loading", locked: state === "read-only" || state === "offline" || state === "authorization" }
}

export function StateSwitcher({ ss }: { ss: ScreenStateApi }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span id="state-switch-label">Review state</span>
      <Select value={ss.state} onValueChange={(v) => ss.set(v as ScreenState)}>
        <SelectTrigger size="sm" className="h-7 w-40 text-xs" aria-labelledby="state-switch-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCREEN_STATES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Reading id="QT-R41" />
    </div>
  )
}

export function SkeletonBlock({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

export interface StateFrameProps {
  ss: ScreenStateApi
  title: string
  screenId: string
  /** What the screen lists, for the empty and degraded messages ("scan conflicts"). */
  entity: string
  /** Role words for the authorization state ("Plant IT or Quality IT"). */
  allowed: string
  /** Messages shown by the validation state (a summary of fields that need attention). */
  validation?: string[]
  /** The conflict state: someone changed the record while you were editing. */
  conflict?: { what: string; mine: string; theirs: string }
  degraded?: string
  /** Kiosk and handheld screens: no office page header in the replaced states. */
  bare?: boolean
  /** When given, the frame draws the header itself and children are the body only. */
  header?: PageHeaderProps
  emptyHint?: ReactNode
  children: ReactNode
}

export function StateFrame(p: StateFrameProps) {
  const [role] = useRole()
  const [kept, setKept] = useState<null | "mine" | "theirs">(null)
  const { state } = p.ss
  const head = p.header ? <PageHeader {...p.header} /> : null
  const fallback = p.bare ? null : <PageHeader title={p.title} screenId={p.screenId} />
  const sw = (
    <div className="mb-4">
      <StateSwitcher ss={p.ss} />
    </div>
  )

  if (p.ss.loading)
    return (
      <>
        {head ?? fallback}
        {sw}
        <SkeletonBlock />
      </>
    )
  if (state === "authorization")
    return (
      <>
        {head ?? fallback}
        {sw}
        <Alert variant="destructive" role="alert">
          <Lock aria-hidden="true" />
          <AlertTitle>You do not have access to {p.entity}</AlertTitle>
          <AlertDescription>
            This screen is for the {p.allowed}. You are acting as {role}. Switch "Acting as" in the top bar, or ask a {p.allowed.split(" or ")[0]} to act on it.
          </AlertDescription>
        </Alert>
      </>
    )
  if (state === "empty")
    return (
      <>
        {head ?? fallback}
        {sw}
        <EmptyState title={`No ${p.entity}`} icon={Inbox}>
          {p.emptyHint ?? `Nothing to show yet. New ${p.entity} appear here as they are created.`}
        </EmptyState>
      </>
    )

  const banners = (
    <div className="mb-4 flex flex-col gap-2">
      {state === "validation" && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{(p.validation ?? ["Required fields are missing."]).length} thing(s) need attention before you can continue</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {(p.validation ?? ["Required fields are missing."]).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {state === "conflict" && (
        <Alert role="alert" className="border-status-exception">
          <RefreshCw aria-hidden="true" />
          <AlertTitle>Someone else changed {p.conflict?.what ?? "this record"} while you were working</AlertTitle>
          <AlertDescription>
            <dl className="grid max-w-3xl gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold">Your change</dt>
                <dd>{p.conflict?.mine ?? "Your pending edit"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold">Saved by another user</dt>
                <dd>{p.conflict?.theirs ?? "A newer version"}</dd>
              </div>
            </dl>
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setKept("mine")}>
                Keep mine
              </Button>
              <Button size="sm" variant="outline" onClick={() => setKept("theirs")}>
                Take theirs
              </Button>
              {kept && <span className="text-xs">You chose to keep {kept === "mine" ? "your change" : "the other version"}; nothing was saved in this review state.</span>}
            </div>
          </AlertDescription>
        </Alert>
      )}
      {state === "offline" && (
        <div className="flex items-center gap-2 rounded-md bg-offline-banner-bg px-4 py-2 text-sm text-status-pending-ink" role="status">
          <WifiOff className="size-4" aria-hidden="true" />
          You are offline. The last loaded data is shown; changes are blocked until the connection returns.
        </div>
      )}
      {state === "degraded" && (
        <Alert role="status" className="border-status-exception">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Some data is delayed</AlertTitle>
          <AlertDescription>{p.degraded ?? `The ${p.entity} service is slow; figures may be a few minutes old. Actions still work.`}</AlertDescription>
        </Alert>
      )}
      {state === "read-only" && (
        <div className="flex items-center gap-2 text-sm">
          <Chip kind="design" note="The record is closed or you have view-only access; controls are off">
            Read-only
          </Chip>
          <span className="text-muted-foreground">Controls are off. Closed records stay readable and exportable.</span>
        </div>
      )}
    </div>
  )

  return (
    <>
      {head}
      {sw}
      {banners}
      <fieldset disabled={p.ss.locked} className="min-w-0 border-0 p-0">
        {p.children}
      </fieldset>
    </>
  )
}
