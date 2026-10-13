// Pieces shared by the handheld work queue and the supervisor board.
import { Chip, StatusBadge } from "@/components/patterns"
import type { InvTask } from "../data/types"
import { Reading } from "./bits"

/** Status badge from S-23 plus the outcome as text (RD-IO-02). */
export function TaskStatus({ t, size = "md" }: { t: Pick<InvTask, "status" | "outcome">; size?: "sm" | "md" | "lg" }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge kind="warehouseTask" status={t.status} size={size} />
      {t.outcome && (t.outcome === "Exception" ? <Chip kind="flag">Exception</Chip> : <Chip kind="design" note="Outcome of Done/Exception (RD-IO-02)">Done</Chip>)}
    </span>
  )
}
export const PriorityChip = ({ p }: { p: InvTask["priority"] }) => (p === "Normal" ? null : <Chip kind={p === "Urgent" ? "block" : "flag"} note="Priority is a design value (RD-IO-05)">{p}</Chip>)
export const ReadingIO02 = () => <Reading id="RD-IO-02" />
