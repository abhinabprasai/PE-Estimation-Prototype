// FL-09 adapters over the shared components. The FL-09 pages call StatusBadge / LifecycleStrip with
// their own `Entity` names; these map them to the shared status catalog's record kinds, so FL-09
// badges and strips now come from src/components/patterns (one source for every module).
import type { ReactNode } from "react"
import { CircleCheck, CircleX } from "lucide-react"
import { LifecycleStrip as SharedStrip, StatusBadge as SharedBadge } from "@/components/patterns/status"
import type { RecordKind } from "@/data/domain"
import { cn } from "@/lib/utils"
import type { Entity, FlagState, Flags } from "../data/model"

export { Chip } from "@/components/patterns/chips"
export { DensityToggle, EmptyState, ErrorAlert, KV, RulesPanel, SkeletonRows, rowCls, useFirstVisitLoading, type Density } from "@/components/patterns/feedback"

const KIND: Record<Entity, RecordKind> = {
  customer: "customer",
  quotation: "quotation",
  order: "salesOrder",
  soline: "soLine",
  schedule: "scheduleLine",
  delivery: "delivery",
  hu: "handlingUnit",
  pod: "pod",
  serial: "serial",
}

export function StatusBadge({ entity, status, className }: { entity: Entity; status: string; className?: string }) {
  return <SharedBadge kind={KIND[entity]} status={status} className={className} />
}

export function LifecycleStrip({ entity, status }: { entity: Entity; status: string }) {
  return <SharedStrip kind={KIND[entity]} status={status} />
}

export function FlagPill({ name, state }: { name: string; state: FlagState }) {
  const ok = state === "passed"
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-lg border px-2 text-xs", ok ? "border-status-passed bg-status-passed-tint text-status-passed-ink" : "border-status-draft text-status-draft-ink")}>
      {ok ? <CircleCheck className="size-3" aria-hidden="true" /> : <CircleX className="size-3" aria-hidden="true" />}
      {name}: {state}
    </span>
  )
}
export function ReadinessFlags({ flags }: { flags: Flags }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="Readiness flags per Flow A stage 7">
      {(Object.keys(flags) as (keyof Flags)[]).map((k) => (
        <FlagPill key={k} name={k} state={flags[k]} />
      ))}
    </div>
  )
}

export function DetailHeader({ title, entity, status, chips, actions, sub }: { title: string; entity: Entity; status: string; chips?: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <StatusBadge entity={entity} status={status} />
        {chips}
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      {sub}
      <LifecycleStrip entity={entity} status={status} />
    </div>
  )
}
