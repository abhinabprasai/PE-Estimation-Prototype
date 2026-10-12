// Status rendering shared by every module.
// StatusBadge: icon + status word always (color.md C-2); family per record type and status pair
// (C-4); word must be on the record's S-n list (C-3) or the badge renders a visible violation.
// LifecycleStrip: main path drawn as a chain, exits and branches listed apart (fixes critique F-02).
// Colour comes only from Badge variants, which read --status-* tokens.

import { CircleCheck, CircleDot, CircleX, Clock, OctagonPause, PencilLine, TriangleAlert, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FAMILY_LABEL, STATUS, familyOf, type Family, type RecordKind } from "@/data/domain"
import { cn } from "@/lib/utils"

export const FAMILY_ICON: Record<Family, LucideIcon> = {
  draft: PencilLine,
  pending: Clock,
  active: CircleDot,
  blocked: OctagonPause,
  done: CircleCheck,
  cancelled: CircleX,
  exception: TriangleAlert,
}

export interface StatusBadgeProps {
  /** Record type, e.g. "salesOrder" (keys of STATUS in src/data/domain/status.ts). */
  kind: RecordKind
  status: string
  /** "sm" for dense tables, "md" (default), "lg" for kiosk (floor-touch). */
  size?: "sm" | "md" | "lg"
  className?: string
}

export function StatusBadge({ kind, status, size = "md", className }: StatusBadgeProps) {
  const fam = familyOf(kind, status)
  if (!fam)
    return (
      <Badge variant="outline" className={cn("border-destructive text-destructive", className)} title={`"${status}" is not on the ${STATUS[kind].label} list (${STATUS[kind].ref})`}>
        <TriangleAlert aria-hidden="true" />
        Unknown status "{status}"
      </Badge>
    )
  return <FamilyBadge family={fam} label={status} size={size} className={className} title={`${STATUS[kind].label} · ${FAMILY_LABEL[fam]}`} />
}

/** A badge for a known family with an arbitrary label (legends, chips). Prefer StatusBadge. */
export function FamilyBadge({ family, label, size = "md", className, title }: { family: Family; label: string; size?: "sm" | "md" | "lg"; className?: string; title?: string }) {
  const Icon = FAMILY_ICON[family]
  return (
    <Badge variant={family} title={title} className={cn(size === "sm" ? "h-5" : size === "lg" ? "h-8 px-3 text-base [&>svg]:size-5!" : "h-6", className)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}

/** Lifecycle strip (C-55): the record's main path with the current status marked, then its exits. */
export function LifecycleStrip({ kind, status, className }: { kind: RecordKind; status: string; className?: string }) {
  const def = STATUS[kind] as { main: readonly string[]; exits?: readonly string[] }
  const step = (s: string) => (
    <span aria-current={s === status ? "step" : undefined} className={cn("rounded-md px-1 py-0.5", s === status ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>
      {s}
    </span>
  )
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs", className)}>
      <ol aria-label="Lifecycle, main path" className="flex flex-wrap items-center gap-1">
        {def.main.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && (
              <span aria-hidden="true" className="text-muted-foreground">
                ›
              </span>
            )}
            {step(s)}
          </li>
        ))}
      </ol>
      {def.exits && def.exits.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground">Exits and branches:</span>
          <ul aria-label="Lifecycle, exits and branches" className="flex flex-wrap items-center gap-1">
            {def.exits.map((s) => (
              <li key={s}>{step(s)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Legend of the seven families, used on /coverage and in module READMEs' screenshots. */
export function FamilyLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Status families">
      {(Object.keys(FAMILY_ICON) as Family[]).map((f) => (
        <li key={f}>
          <FamilyBadge family={f} label={FAMILY_LABEL[f]} />
        </li>
      ))}
    </ul>
  )
}
