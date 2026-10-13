// The nine mandatory screen states (Book V §10.3) for the feature-list screens of this group:
// normal, empty, loading, validation, authorization, conflict, offline, degraded, read-only.
// Reviewers pick one with "State preview" (?state=...); the same banners appear for real when an
// action hits a rule (validation, conflict) or a record is terminal (read-only).

import type { ReactNode } from "react"
import { useSearchParams } from "react-router"
import { CloudOff, GitMerge, Lock, ShieldX, TriangleAlert } from "lucide-react"
import { Chip, EmptyState, ErrorAlert } from "@/components/patterns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useScreenState } from "./components"

export type PreviewState = "live" | "loading" | "empty" | "validation" | "denied" | "conflict" | "offline" | "degraded" | "readonly" | "error"
const LABEL: Record<PreviewState, string> = {
  live: "Normal", loading: "Loading", empty: "Empty", validation: "Validation", denied: "Authorization", conflict: "Conflict", offline: "Offline", degraded: "Degraded", readonly: "Read-only", error: "Error",
}

export function useStates(key: string) {
  const base = useScreenState(key)
  const [params, setParams] = useSearchParams()
  const f = params.get("state")
  return {
    ...base,
    offline: f === "offline",
    degraded: f === "degraded",
    readonly: f === "readonly",
    denied: f === "denied",
    conflict: f === "conflict",
    validation: f === "validation",
    preview: (f ?? "live") as PreviewState,
    set: (v: PreviewState) => {
      if (v === "live") params.delete("state")
      else params.set("state", v)
      setParams(params, { replace: true })
    },
  }
}
export type States = ReturnType<typeof useStates>
/** The flags a banner or a dialog needs; a modal opened from a live screen passes none. */
export type StateFlags = Partial<Pick<States, "offline" | "degraded" | "readonly" | "conflict" | "validation" | "denied" | "empty">>

/** Prototype control: switch the screen between its nine states. */
export function StatePreviewAll({ st }: { st: States }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Chip kind="design" note="Prototype control: preview the nine screen states (normal, empty, loading, validation, authorization, conflict, offline, degraded, read-only) plus a service error">State preview</Chip>
      <Select value={st.preview} onValueChange={(v) => st.set(v as PreviewState)}>
        <SelectTrigger size="sm" className="h-8 w-36" aria-label="Preview screen state">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(LABEL) as PreviewState[]).map((k) => <SelectItem key={k} value={k}>{LABEL[k]}</SelectItem>)}
        </SelectContent>
      </Select>
    </span>
  )
}

export interface BannerText {
  validation?: string
  conflict?: string
  degraded?: string
  readonly?: string
  offline?: string
}
/** Banners for the states that keep the screen visible. Under the header, above the content (never overlaying). */
export function StateBanners({ st, text }: { st: StateFlags; text?: BannerText }) {
  return (
    <>
      {st.offline && (
        <Alert role="status">
          <CloudOff aria-hidden="true" />
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>{text?.offline ?? "Showing the data last loaded. Actions that write are disabled until the connection returns; nothing you do here is lost or queued silently."}</AlertDescription>
        </Alert>
      )}
      {st.degraded && (
        <Alert role="status">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Degraded: connector delayed</AlertTitle>
          <AlertDescription>{text?.degraded ?? "The CAD/PDM connector (IF-17) is behind. Data from the vault may be older than shown; ERP data is current. Vault events queue and replay when it recovers."}</AlertDescription>
        </Alert>
      )}
      {st.readonly && (
        <Alert role="status">
          <Lock aria-hidden="true" />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>{text?.readonly ?? "This view is read-only for your role or because the record is released. Nothing on it can be changed here."}</AlertDescription>
        </Alert>
      )}
      {st.conflict && (
        <Alert variant="destructive" role="alert">
          <GitMerge aria-hidden="true" />
          <AlertTitle>Conflict: changed by someone else</AlertTitle>
          <AlertDescription>{text?.conflict ?? "Another user changed this record after you opened it. Reload to see their version; your unsaved choices are kept in the form until you do."}</AlertDescription>
        </Alert>
      )}
      {st.validation && (
        <ErrorAlert title="Fix this before you continue">{text?.validation ?? "A required choice is missing or breaks a rule. The message names the field and the rule."}</ErrorAlert>
      )}
    </>
  )
}

/** The designed denied experience: names who may use the screen and how to continue. */
export function DeniedState({ what, who, source }: { what: string; who: string; source?: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6" role="alert">
      <ShieldX className="size-4 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">You cannot open {what} with this role</p>
      <p className="text-sm text-muted-foreground">{who} {source && <span>[{source}]</span>}. Use Acting as (top bar) to switch role, or ask the Engineering Manager to grant access.</p>
    </div>
  )
}

/** Loading skeleton for pages without a DataTable. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-full max-w-3xl" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

/** Wraps a page body: error, loading and denied replace it; the other states add banners above it. */
export function ScreenFrame({ st, what, who, source, text, handleLoading = true, banners = true, children }: { st: States; what: string; who: string; source?: string; text?: BannerText; handleLoading?: boolean; banners?: boolean; children: ReactNode }) {
  if (st.denied) return <DeniedState what={what} who={who} source={source} />
  if (st.error)
    return (
      <ErrorAlert title={`${what} could not be loaded`} action={<button className="underline" onClick={st.retry}>Try again</button>}>
        {st.error}
      </ErrorAlert>
    )
  if (handleLoading && st.loading) return <PageSkeleton />
  return (
    <div className="flex flex-col gap-4">
      {banners && <StateBanners st={st} text={text} />}
      {children}
    </div>
  )
}

export { EmptyState }
