// State kit: the nine mandatory screen states (Book V section 10.3), legal-hold chip with set and
// release dialog, archived read-only banner, archive-query loading (under 60 s), period-status banner.
// Other groups adopt these: import from "@/modules/shell/kit". Nothing here reads another group.
import { useEffect, useState, type ReactNode } from "react"
import { Archive, CloudOff, Gavel, Lock, ShieldAlert, TriangleAlert, WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, EmptyState, StatusBadge } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { THRESHOLDS, type Role } from "@/data/domain"
import { store, useRole, useSlice } from "@/store"
import { cn } from "@/lib/utils"
import type { LegalHold } from "../data/slice"

// ------------------------------------------------------------------------------------------ the nine states
export type ScreenState = "normal" | "empty" | "loading" | "validation" | "authorization" | "conflict" | "offline" | "degraded" | "read-only"
export const SCREEN_STATES: { id: ScreenState; label: string; rule: string }[] = [
  { id: "normal", label: "Normal", rule: "The working view with data." },
  { id: "empty", label: "Empty", rule: "First use, with a helpful action." },
  { id: "loading", label: "Loading", rule: "Skeletons, no spinners over 300 ms." },
  { id: "validation", label: "Validation error", rule: "Inline on the field and a summary at the top." },
  { id: "authorization", label: "Authorization error", rule: "Explains the missing role, never a blank page." },
  { id: "conflict", label: "Conflict", rule: "Someone saved first; show the diff." },
  { id: "offline", label: "Offline", rule: "Kiosk banner and queue depth." },
  { id: "degraded", label: "Degraded", rule: "A dependency is down; say what still works." },
  { id: "read-only", label: "Read-only", rule: "Terminal statuses and view-only roles." },
]

export function OfflineBanner({ queued = 7, className }: { queued?: number; className?: string }) {
  return (
    <div role="status" className={cn("flex min-h-12 items-center gap-2 rounded-md bg-offline-banner-bg px-4 py-2 text-sm text-status-pending-ink", className)}>
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Offline.</strong> {queued} scans queued. They replay in order when the connection returns; the queue holds up to {THRESHOLDS.offlineQueueHours} h.
      </span>
    </div>
  )
}

export function DegradedBanner({ dependency, works, stops, className }: { dependency: string; works: string; stops: string; className?: string }) {
  return (
    <Alert className={cn("border-status-exception", className)}>
      <CloudOff aria-hidden="true" />
      <AlertTitle>Degraded: {dependency} is not responding</AlertTitle>
      <AlertDescription>
        <p>Still works: {works}.</p>
        <p>Waits for recovery: {stops}.</p>
      </AlertDescription>
    </Alert>
  )
}

export function ReadOnlyBanner({ reason, className }: { reason: ReactNode; className?: string }) {
  return (
    <div role="note" className={cn("flex items-center gap-2 rounded-md border bg-muted px-4 py-2 text-sm", className)}>
      <Lock className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Read-only.</strong> {reason}
      </span>
    </div>
  )
}

/** Period-status banner pattern. Soft Close warns and lets the posting proceed (C-42); a Closed period
 *  blocks everyone, with Reference Date offered instead (C-41); master data shows none (C-44). */
export function PeriodStatusBanner({ period = "2026-09", status = "Soft Close", postingDate, masterData, className }: { period?: string; status?: "Open" | "Soft Close" | "Hard Close" | "Year-End Closed"; postingDate?: string; masterData?: boolean; className?: string }) {
  if (masterData || status === "Open") return null
  const soft = status === "Soft Close"
  return (
    <Alert variant={soft ? "default" : "destructive"} className={cn(soft ? "border-status-pending" : "border-destructive", className)}>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        Period {period} <StatusBadge kind="fiscalPeriod" status={status} size="sm" />
      </AlertTitle>
      <AlertDescription>
        {soft ? (
          <>
            <p>Period {period} is closing: posting requires month-end review. Your posting is allowed, logged, and included in month-end review (E-PER-02, warning not blocking).</p>
          </>
        ) : (
          <>
            <p>
              Posting date {postingDate ?? "2026-09-30"} falls in period {period}, status {status === "Year-End Closed" ? "Closed" : "Closed"}. Post to the current open period and set Reference Date if needed (E-PER-01).
            </p>
            <p>Reopening a Hard Closed period needs the Controller and the CFO, two distinct users in sequence (C-43).</p>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function ArchivedBanner({ archivedOn = "2019-12-31", className }: { archivedOn?: string; className?: string }) {
  return (
    <div role="note" className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-muted px-4 py-2 text-sm", className)}>
      <Archive className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Archived, read-only.</strong> This record moved to the archive on {archivedOn}. Archives are queryable and cannot be changed. Transactional data stays online 7 years; genealogy and quality evidence 10 years.
      </span>
    </div>
  )
}

/** Extended archive-query loading: an archive query may take up to 60 s, so it shows progress, elapsed
 *  time, and a cancel. `speed` accelerates the demo clock (default 12x). */
export function ArchiveQueryLoading({ onDone, onCancel, speed = 12 }: { onDone?: () => void; onCancel?: () => void; speed?: number }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setT((x) => x + 1), 1000 / speed)
    return () => clearInterval(h)
  }, [speed])
  useEffect(() => {
    if (t >= 52) onDone?.()
  }, [t, onDone])
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-lg border p-4">
      <p className="text-sm font-medium">Querying the archive</p>
      <Progress value={Math.min(100, (t / 52) * 100)} aria-label="Archive query progress" />
      <p className="tabular text-xs text-muted-foreground">
        {Math.min(t, 52)} s of an expected 60 s maximum. Archive queries run in the background; you can leave this page and the result waits in your notifications.
      </p>
      {onCancel && (
        <Button variant="outline" size="sm" className="self-start" onClick={onCancel}>
          Cancel query
        </Button>
      )}
    </div>
  )
}

export function AuthorizationError({ action = "release a Credit Hold", role, needed = ["Finance (credit)"], className }: { action?: string; role: Role | string; needed?: string[]; className?: string }) {
  return (
    <div role="alert" className={cn("flex max-w-xl flex-col gap-2 rounded-lg border border-destructive p-6", className)}>
      <ShieldAlert className="size-6 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">You cannot {action}</h2>
      <p className="text-sm">
        You are acting as <strong>{role}</strong>. This needs {needed.length > 1 ? "one of the roles" : "the role"} <strong>{needed.join(", ")}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">Ask a holder of that role, or open the approvals inbox to route the request. The specification has no role-by-action matrix, so which roles may act on a screen is a reading (ASM-PERM-1).</p>
    </div>
  )
}

export function ValidationSummary({ errors, className }: { errors: { field: string; message: string }[]; className?: string }) {
  if (!errors.length) return null
  return (
    <Alert variant="destructive" role="alert" className={cn("border-destructive", className)}>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{errors.length} fields need attention</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {errors.map((e) => (
            <li key={e.field}>
              <a href={`#field-${e.field}`} className="underline">
                {e.field}
              </a>
              : {e.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

export interface ConflictField {
  field: string
  mine: string
  theirs: string
  base?: string
}
/** Conflict state: someone saved first. Side-by-side diff with a choice per field. */
export function ConflictDiff({ savedBy = "Marco Reyes", savedAt = "09:42", fields, onResolve }: { savedBy?: string; savedAt?: string; fields: ConflictField[]; onResolve?: (choice: Record<string, "mine" | "theirs">) => void }) {
  const [choice, setChoice] = useState<Record<string, "mine" | "theirs">>(Object.fromEntries(fields.map((f) => [f.field, "theirs" as const])))
  const [done, setDone] = useState(false)
  return (
    <section aria-label="Conflict" className="flex flex-col gap-2 rounded-lg border border-status-exception p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-4" aria-hidden="true" /> {savedBy} saved this record at {savedAt}, before your save
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-table-head text-left">
            <tr>
              <th className="p-2">Field</th>
              <th className="p-2">Your change</th>
              <th className="p-2">Saved by {savedBy}</th>
              <th className="p-2">Keep</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.field} className="border-t">
                <td className="p-2 font-medium">{f.field}</td>
                <td className="p-2">{f.mine}</td>
                <td className="p-2">{f.theirs}</td>
                <td className="p-2">
                  <div role="radiogroup" aria-label={`Keep for ${f.field}`} className="inline-flex gap-1 rounded-md border p-1 text-xs">
                    {(["mine", "theirs"] as const).map((c) => (
                      <button key={c} role="radio" aria-checked={choice[f.field] === c} disabled={done} onClick={() => setChoice({ ...choice, [f.field]: c })} className={cn("h-6 rounded-md px-2", choice[f.field] === c && "bg-secondary font-semibold")}>
                        {c === "mine" ? "Mine" : "Theirs"}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={done}
          onClick={() => {
            setDone(true)
            onResolve?.(choice)
          }}
        >
          Save with these choices
        </Button>
        <Button variant="outline" disabled={done}>
          Discard my changes
        </Button>
        {done && <span role="status" className="text-sm">Saved as a new version; the earlier version stays in the Activity tab.</span>}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------------------------------ legal hold
/** Legal hold suspends any purge per object [DOC:p.191 Part C section 6] (asserted). Who may set or
 *  release it is not stated: shown as a reading. */
export function LegalHoldChip({ hold }: { hold: LegalHold }) {
  return (
    <span title={`Set ${hold.setOn} by ${hold.setBy}: ${hold.reason}`} className="inline-flex h-6 items-center gap-1 rounded-lg border border-status-blocked bg-background px-2 text-xs font-medium text-status-cancelled-ink">
      <Gavel className="size-3" aria-hidden="true" /> Legal hold since {hold.setOn}
    </span>
  )
}

/** Chip plus the set / release dialog for one object. Reads and writes the shell slice. */
export function LegalHoldControl({ object, objectLabel, readOnly }: { object: string; objectLabel: string; readOnly?: boolean }) {
  const s = useSlice("shell")
  const [role] = useRole()
  const [open, setOpen] = useState(false)
  const active = s.legalHolds.find((h) => h.object === object && !h.releasedOn)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {active ? <LegalHoldChip hold={active} /> : <span className="text-xs text-muted-foreground">No legal hold</span>}
      <Button variant="outline" size="sm" disabled={readOnly} onClick={() => setOpen(true)}>
        {active ? "Release legal hold" : "Set legal hold"}
      </Button>
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={active ? `Release the legal hold on ${objectLabel}?` : `Set a legal hold on ${objectLabel}?`}
        consequence={active ? "Releasing lets the retention purge run on this object again. The release is written to the audit trail with your reason." : "While the hold is set, no purge or archive deletion can remove this object or its genealogy and quality evidence."}
        requireReason
        reasonLabel={active ? "Reason for release (required)" : "Reason for the hold (required)"}
        confirmLabel={active ? "Release hold" : "Set hold"}
        destructive={!!active}
        secondary={<Chip kind="oq" id="legal-hold role" note="The specification does not name who may set or release a legal hold">Who may set it: reading</Chip>}
        onConfirm={(reason) => {
          const r = store.mutate("shell", (d, ctx) => {
            if (active) {
              const h = d.legalHolds.find((x) => x.id === active.id)!
              h.releasedOn = ctx.today
              h.releasedBy = role
              h.releaseReason = reason
            } else {
              d.seq += 1
              d.legalHolds.push({ id: `LH-TBD-${String(d.seq).padStart(3, "0")}`, object, objectLabel, setBy: role, setOn: ctx.today, reason })
            }
          })
          return r.ok ? null : r.error
        }}
      />
    </span>
  )
}

// ------------------------------------------------------------------------------------------ the stage
/** Wraps a screen body and lets a reviewer switch it through the nine states. `children` is the normal
 *  state; every other state is rendered by the kit. Use on any module screen:
 *  <StateStage emptyAction={...} fields={...}>{normal body}</StateStage> */
export interface StateStageProps {
  children: ReactNode
  initial?: ScreenState
  emptyTitle?: string
  emptyBody?: ReactNode
  emptyAction?: ReactNode
  conflictFields?: ConflictField[]
  neededRoles?: string[]
  actionLabel?: string
  dependency?: string
  works?: string
  stops?: string
  compact?: boolean
  /** Lock the stage to one state (no switcher). */
  fixed?: ScreenState
}
export function StateStage({
  children,
  initial = "normal",
  emptyTitle = "Nothing here yet",
  emptyBody = "Create the first record to start. The list fills as work arrives.",
  emptyAction,
  conflictFields,
  neededRoles = ["Controller"],
  actionLabel = "change this record",
  dependency = "the tax engine",
  works = "Browse, search, print and create drafts",
  stops = "Tax recalculation and posting until the engine returns",
  compact,
  fixed,
}: StateStageProps) {
  const [state, setState] = useState<ScreenState>(fixed ?? initial)
  const [role] = useRole()
  const cur = fixed ?? state
  const fields = conflictFields ?? [
    { field: "Requested delivery date", mine: "2027-03-22", theirs: "2027-03-15" },
    { field: "Customer PO number", mine: "MP-4471-B", theirs: "MP-4471-A" },
  ]
  const body = (() => {
    switch (cur) {
      case "empty":
        return (
          <EmptyState title={emptyTitle}>
            <p>{emptyBody}</p>
            {emptyAction && <div className="mt-2">{emptyAction}</div>}
          </EmptyState>
        )
      case "loading":
        return (
          <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2">
            <Skeleton className="h-8 w-1/3" />
            {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )
      case "validation":
        return (
          <div className="flex flex-col gap-4">
            <ValidationSummary
              errors={[
                { field: "Quantity", message: "Enter a whole number above 0." },
                { field: "Ship-to", message: "Choose a ship-to address." },
              ]}
            />
            <div className="grid max-w-md gap-2">
              <label htmlFor="field-Quantity" className="text-sm font-medium">
                Quantity
              </label>
              <input id="field-Quantity" aria-invalid="true" defaultValue="0" className="h-8 rounded-md border border-destructive px-2 text-sm" />
              <p className="text-xs text-destructive">Enter a whole number above 0.</p>
            </div>
            <div className="opacity-60">{children}</div>
          </div>
        )
      case "authorization":
        return <AuthorizationError action={actionLabel} role={role} needed={neededRoles} />
      case "conflict":
        return (
          <div className="flex flex-col gap-4">
            <ConflictDiff fields={fields} />
            <div className="opacity-60">{children}</div>
          </div>
        )
      case "offline":
        return (
          <div className="flex flex-col gap-4">
            <OfflineBanner />
            {children}
          </div>
        )
      case "degraded":
        return (
          <div className="flex flex-col gap-4">
            <DegradedBanner dependency={dependency} works={works} stops={stops} />
            {children}
          </div>
        )
      case "read-only":
        return (
          <div className="flex flex-col gap-4">
            <ReadOnlyBanner reason="Terminal status or a view-only role: nothing on this screen can be changed." />
            <fieldset disabled className="contents">
              {children}
            </fieldset>
          </div>
        )
      default:
        return children
    }
  })()
  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <div role="radiogroup" aria-label="Preview screen state" className="flex flex-wrap items-center gap-1 rounded-md border p-1 text-xs">
          <Chip kind="design" note="State preview is a prototype affordance, not a product control">State preview</Chip>
          {SCREEN_STATES.map((s) => (
            <button key={s.id} role="radio" aria-checked={cur === s.id} title={s.rule} onClick={() => setState(s.id)} className={cn("h-6 rounded-md px-2", cur === s.id ? "bg-secondary font-semibold" : "text-muted-foreground")}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div>{body}</div>
      {!fixed && <p className="text-xs text-muted-foreground">{SCREEN_STATES.find((s) => s.id === cur)?.rule}</p>}
    </div>
  )
}
