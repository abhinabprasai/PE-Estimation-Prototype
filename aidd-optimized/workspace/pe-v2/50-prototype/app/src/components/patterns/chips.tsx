// Markers that sit BESIDE a status badge, never replacing it (color.md C-5), and the prototype's
// provenance chips: "Reading OQ-nn" (a reading held in 10-discovery/open-questions.md) and
// "K-nn" (a contradiction recorded in STATE.md). These are the patterns the FL-09 build used.

import { Ban, FilePen, GitCompare, Info, TriangleAlert, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ChipKind = "oq" | "k" | "hold" | "backorder" | "block" | "change" | "flag" | "design"

const CFG: Record<ChipKind, { icon: LucideIcon; cls: string }> = {
  oq: { icon: Info, cls: "border-foreground/40 text-foreground" },
  k: { icon: GitCompare, cls: "border-foreground/40 text-foreground" },
  design: { icon: Info, cls: "border-dashed border-foreground/40 text-muted-foreground" },
  hold: { icon: Ban, cls: "border-status-blocked text-status-cancelled-ink" },
  block: { icon: Ban, cls: "border-status-blocked text-status-cancelled-ink" },
  backorder: { icon: TriangleAlert, cls: "border-status-exception text-status-pending-ink" },
  flag: { icon: TriangleAlert, cls: "border-status-exception text-status-pending-ink" },
  change: { icon: FilePen, cls: "border-status-pending text-status-pending-ink" },
}

/**
 * kind "oq": `Reading OQ-nn`; "k": contradiction id; "design": a design value (not from the PRD);
 * "hold" / "block": F4 outline with Ban (credit hold, function-specific blocks);
 * "change": F2 outline with FilePen (Change Pending overlay); "backorder" / "flag": F7 outline.
 */
export function Chip({ kind, id, note, children }: { kind: ChipKind; id?: string; note?: string; children?: ReactNode }) {
  const { icon: Icon, cls } = CFG[kind]
  const text =
    children ??
    (kind === "oq" ? `Reading ${id}` : kind === "k" ? id : kind === "hold" ? "Credit hold flag" : kind === "backorder" ? "Backorder" : kind === "change" ? "Change Pending" : kind === "design" ? "Design value" : id)
  return (
    <span title={note} className={cn("inline-flex h-6 items-center gap-1 rounded-lg border bg-background px-2 text-xs font-medium whitespace-nowrap", cls)}>
      <Icon className="size-3" aria-hidden="true" />
      {text}
      {note && <span className="sr-only">: {note}</span>}
    </span>
  )
}

/** Screen-id chip used in page headers: "OM-SO-001/2". */
export function ScreenIdChip({ id }: { id: string }) {
  return <span className="inline-flex h-6 items-center rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">{id}</span>
}
