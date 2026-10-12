// Small building blocks for the sales and service screens beyond FL-09. Token classes only.
import type { ReactNode } from "react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Chip } from "@/components/patterns/chips"
import { FamilyBadge } from "@/components/patterns/status"
import { LEAD_STAGES, LEAD_STAGE_FAMILY, type LeadStage, type RmaClass } from "../data/ext-model"
import { cn } from "@/lib/utils"

/** A reading the PRD does not settle: shown on screen, logged in the sales README "Readings". */
export function Reading({ id, note }: { id: string; note: string }) {
  return (
    <Chip kind="design" note={note}>
      Reading {id}
    </Chip>
  )
}

/** Lead stage: a PRD list (p.249 §4.1) not yet in the shared catalog (Request FR-1); drawn with the family badge. */
export function LeadStageBadge({ stage, size }: { stage: LeadStage; size?: "sm" | "md" }) {
  return <FamilyBadge family={LEAD_STAGE_FAMILY[stage]} label={stage} size={size} title={`Lead stage (p.249 §4.1): ${LEAD_STAGES.join(" → ")}`} />
}

/** Return class badge. The PRD colours (RC1 blue, RC2 teal, RC3 orange, RC4 purple) wait for tokens (Request FR-6). */
export function RmaClassBadge({ cls }: { cls: RmaClass }) {
  return (
    <Badge variant="outline" className="font-mono" title={`Return class ${cls} (p.21 §3.1)`}>
      {cls}
    </Badge>
  )
}

export function A({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("text-link underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  )
}

export function Section({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-2 rounded-lg border p-4", className)}>
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {action}
      </h2>
      {children}
    </section>
  )
}

export function ActivityList({ items }: { items: { at: string; by: string; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex flex-col gap-1 text-sm" aria-label="Activity, newest first">
      {[...items].reverse().map((a, i) => (
        <li key={i}>
          <span className="tabular text-muted-foreground">{a.at}</span> · {a.by} · {a.text}
        </li>
      ))}
    </ol>
  )
}

/** Quick-stat pill used on registers (RMA-LIST quick stats, pipeline summary). */
export function StatPill({ label, value, active, onClick, tone }: { label: string; value: ReactNode; active?: boolean; onClick?: () => void; tone?: "attention" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm", active && "border-primary font-semibold", tone === "attention" && "border-status-exception")}
    >
      {label} <span className="tabular font-semibold">{value}</span>
    </button>
  )
}
