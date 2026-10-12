// Small building blocks used across the admin screens (kept here, not in shared patterns).
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Clock, TriangleAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Result } from "@/store"
import { userById } from "@/data/shared"
import { cn } from "@/lib/utils"
import { fmtDuration } from "../lib/time"

/** Run an action, toast its outcome; returns the error text (for DialogShell) or null. */
export function act(r: Result<string>): string | null {
  if (r.ok) {
    toast.success(r.value)
    return null
  }
  toast.error(r.error)
  return r.error
}

export function Field({ id, label, children, hint, className }: { id: string; label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SimpleSelect({ id, value, onChange, options, placeholder, className, disabled }: { id?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; className?: string; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const userName = (id?: string) => (id ? (userById(id)?.name ?? id) : "Not recorded")

/** SLA clock: age of the waiting step against its SLA; overdue reads as an escalation. */
export function SlaClock({ ageHours, slaHours, overdue, escalateTo }: { ageHours: number; slaHours: number; overdue: boolean; escalateTo?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular", overdue ? "font-semibold text-status-pending-ink" : "text-muted-foreground")}>
      {overdue ? <TriangleAlert className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
      {fmtDuration(ageHours)} of {fmtDuration(slaHours)}
      {overdue && escalateTo ? `, escalated to ${escalateTo}` : ""}
    </span>
  )
}

/** A state word for a record with no status list in the specification (OQ-21): text, not a badge. */
export function StateText({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "attention" | "muted" }) {
  return <span className={cn("text-sm", tone === "attention" && "font-semibold text-status-pending-ink", tone === "muted" && "text-muted-foreground")}>{children}</span>
}
