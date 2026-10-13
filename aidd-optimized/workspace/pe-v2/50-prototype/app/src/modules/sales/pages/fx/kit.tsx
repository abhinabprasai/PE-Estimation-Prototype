// Shared building blocks for the feature-list screens: the nine-state bar (normal, empty, loading,
// validation, authorization, conflict, offline, degraded, read-only), a result helper that turns a store
// Result into a toast or an error string, form fields, and the page that shows a dialog in each state.
import { useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { CloudOff, Gauge, GitMerge, Lock, ShieldAlert, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/templates"
import { EmptyState, RulesPanel } from "@/components/patterns"
import { useRole } from "@/store"
import type { Result } from "@/store"
import { FX_STATES, type FxScreenState } from "../../fx/model"
import { Reading } from "../../components/ext"

// ---------------------------------------------------------------------------- the nine states
export interface FxState {
  state: FxScreenState
  setState: (s: FxScreenState) => void
  /** False when the state forbids writes: authorization, conflict, offline, read-only. */
  writable: boolean
  /** The reason shown on a disabled control. */
  why: string
  loading: boolean
  empty: boolean
  validation: boolean
}
const WHY: Partial<Record<FxScreenState, string>> = {
  authorization: "Your role cannot change this record. Switch Acting as, or ask the owner role.",
  conflict: "Another user changed this record after you opened it. Reload before you continue.",
  offline: "Offline: this change needs a connection. Nothing is queued for this action.",
  "read-only": "This record is closed or its period is locked. It opens read-only.",
}
/** Reads `?state=` (one of the nine). Pages use it to show the state; `writable` gates the primary actions. */
export function useFxState(): FxState {
  const [sp, setSp] = useSearchParams()
  const raw = sp.get("state") as FxScreenState | null
  const state: FxScreenState = raw && (FX_STATES as readonly string[]).includes(raw) ? raw : "normal"
  const setState = (s: FxScreenState) =>
    setSp((p) => {
      const n = new URLSearchParams(p)
      if (s === "normal") n.delete("state")
      else n.set("state", s)
      return n
    }, { replace: true })
  return { state, setState, writable: !["authorization", "conflict", "offline", "read-only"].includes(state), why: WHY[state] ?? "", loading: state === "loading", empty: state === "empty", validation: state === "validation" }
}

const STATE_COPY: Record<FxScreenState, { icon?: typeof Lock; title: string; body: string }> = {
  normal: { title: "", body: "" },
  empty: { title: "Empty state", body: "Nothing to show yet. The empty state says why and what to do next." },
  loading: { title: "Loading state", body: "Skeleton rows stand in for the content; the layout does not move when the data arrives." },
  validation: { icon: TriangleAlert, title: "Validation state", body: "Submit with a missing or invalid entry to see the message next to its field and in the action result. Forms that can show it up front (billing plan, run horizon) start with their message." },
  authorization: { icon: ShieldAlert, title: "Authorization state", body: "The acting role may read but not change this. Controls stay visible and disabled, each with its reason." },
  conflict: { icon: GitMerge, title: "Conflict state", body: "The record changed after it was opened (simulated). Reload to see the current values; your entries are kept." },
  offline: { icon: CloudOff, title: "Offline state", body: "No connection (simulated). Reads show the last values; writes are refused with the reason." },
  degraded: { icon: Gauge, title: "Degraded state", body: "A dependency answers slowly or with old data (simulated). Values carry a Stale tag; writes still work." },
  "read-only": { icon: Lock, title: "Read-only state", body: "The record is terminal or the period is locked: opens read-only, no edit controls (C-55)." },
}

/** Selector for the nine states plus the banner for the one chosen. Place it under the page header. */
export function StateBar({ st, only }: { st: FxState; only?: FxScreenState[] }) {
  const list = only ?? [...FX_STATES]
  const c = STATE_COPY[st.state]
  const Icon = c.icon
  return (
    <div className="flex flex-col gap-2" data-testid="state-bar">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Label htmlFor="fx-state" className="text-muted-foreground">Show state</Label>
        <Select value={st.state} onValueChange={(v) => st.setState(v as FxScreenState)}>
          <SelectTrigger id="fx-state" className="w-44" aria-label="Show state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Reading id="SR-30" note="The nine states are the feature list's state matrix. The selector is a prototype device; the real app reaches each state by itself." />
      </div>
      {st.state !== "normal" && st.state !== "empty" && st.state !== "loading" && (
        <Alert className={st.state === "degraded" || st.state === "offline" ? "border-status-pending" : st.state === "validation" ? "border-status-exception" : undefined}>
          {Icon && <Icon aria-hidden="true" />}
          <AlertTitle>{c.title}</AlertTitle>
          <AlertDescription>
            {c.body}
            {st.state === "conflict" && (
              <Button size="sm" variant="outline" className="ml-2" onClick={() => st.setState("normal")}>Reload</Button>
            )}
            {st.state === "offline" && (
              <Button size="sm" variant="outline" className="ml-2" onClick={() => st.setState("normal")}>Retry connection</Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** Renders loading and empty for the state, otherwise its children. */
export function StateGate({ st, empty, children }: { st: FxState; empty?: { title: string; body?: ReactNode }; children: ReactNode }) {
  if (st.loading)
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  if (st.empty) return <EmptyState title={empty?.title ?? "Nothing here yet"}>{empty?.body ?? "No records match. Change the scope or create the first one."}</EmptyState>
  return <>{children}</>
}

export const StaleTag = ({ show }: { show: boolean }) => (show ? <span className="ml-1 rounded border border-status-pending px-1 text-xs text-status-pending-ink" title="Degraded state: value may be old">Stale</span> : null)

// ---------------------------------------------------------------------------- results and fields
/** Store Result to a DialogShell return: toast on success, error text on failure. */
export function report<T>(r: Result<T>, ok: string | ((v: T) => string)): string | null {
  if (r.ok) {
    toast.success(typeof ok === "function" ? ok(r.value) : ok)
    return null
  }
  return r.error
}
export function reportInline<T>(r: Result<T>, ok: string | ((v: T) => string), setErr: (e: { text: string; field?: string } | null) => void): boolean {
  if (r.ok) {
    toast.success(typeof ok === "function" ? ok(r.value) : ok)
    setErr(null)
    return true
  }
  setErr({ text: r.error, field: r.field })
  return false
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function TextField({ id, label, value, onChange, error, hint, type = "text", placeholder, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: ReactNode; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} placeholder={placeholder} disabled={disabled} />
    </Field>
  )
}

export function PickField({ label, value, onChange, options, error, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] | readonly string[]; error?: string | null; disabled?: boolean; placeholder?: string }) {
  const opts = (options as (string | { value: string; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o))
  return (
    <Field label={label} error={error}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={placeholder ?? "Choose"} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function Inline({ error, onDismiss }: { error: { text: string; field?: string } | null; onDismiss?: () => void }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
      {error.text}
      {onDismiss && <button className="ml-2 underline" onClick={onDismiss}>Dismiss</button>}
    </p>
  )
}

/** Disabled-with-reason wrapper for a button. */
export function Gate({ ok, why, children }: { ok: boolean; why?: string; children: (disabled: boolean, title?: string) => ReactNode }) {
  return <>{children(!ok, ok ? undefined : why)}</>
}

// ---------------------------------------------------------------------------- dialog showcase page
export interface DialogCard {
  id: string
  title: string
  body: ReactNode
  /** The button label that opens the dialog. */
  open: string
  render: (open: boolean, onOpenChange: (o: boolean) => void, st: FxState) => ReactNode
}
/** A page at a dialog's registry route: the dialogs, each opened against the live seeded records, with the nine-state bar. */
export function DialogPage({ screenId, title, description, cards, rules, context, st, extra, chips }: { screenId: string; title: string; description: ReactNode; cards: DialogCard[]; rules?: [string, string, string][]; context?: ReactNode; st: FxState; extra?: ReactNode; chips?: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} screenId={screenId} description={description} chips={chips} />
      <StateBar st={st} />
      {context}
      <StateGate st={st} empty={{ title: "No record to act on", body: "Pick a record in the scope above; the dialog needs one." }}>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <section key={c.id} aria-label={c.title} className="flex flex-col gap-2 rounded-lg border p-4">
              <h2 className="text-sm font-semibold">{c.title}</h2>
              <div className="text-sm text-muted-foreground">{c.body}</div>
              <div>
                <Button variant="outline" onClick={() => setOpenId(c.id)} disabled={!st.writable} title={st.writable ? undefined : st.why}>{c.open}</Button>
              </div>
              {c.render(openId === c.id, (o) => setOpenId(o ? c.id : null), st)}
            </section>
          ))}
        </div>
        {extra}
      </StateGate>
      {rules && <RulesPanel rules={rules} />}
    </div>
  )
}

/** The acting role as a small line, for the authorization state. */
export function ActingAs() {
  const [role] = useRole()
  return <span className="text-xs text-muted-foreground">Acting as {role}</span>
}
