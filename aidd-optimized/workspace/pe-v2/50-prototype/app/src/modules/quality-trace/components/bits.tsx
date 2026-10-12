// Small building blocks shared by the quality-trace screens. Token classes only.
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Link, useSearchParams } from "react-router"
import { CircleCheck, CircleMinus, CircleX } from "lucide-react"
import { Chip, SkeletonRows, useFirstVisitLoading } from "@/components/patterns"
import { Table, TableBody } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { docRoute, type DocRef } from "@/data/domain"
import { CUSTOMERS, materialById, userById, vendorById } from "@/data/shared"
import { store } from "@/store"
import { cn } from "@/lib/utils"
import { READINGS, type ReadingId } from "../data/readings"

export const userName = (id?: string) => (id ? (userById(id)?.name ?? id) : "Not recorded")
export const vendorName = (id?: string) => (id ? (vendorById(id)?.name ?? id) : "")
export const customerName = (id?: string) => (id ? (CUSTOMERS.find((c) => c.id === id)?.name ?? id) : "")
export const materialText = (id?: string) => (id ? (materialById(id)?.description ?? id) : "")

/** A reading chip: the choice was made where the specification is silent (README "Readings"). */
export function Reading({ id }: { id: ReadingId }) {
  return <Chip kind="oq" id={id} note={READINGS[id]} />
}
/** Records with no status list in the specification show text, never a badge (OQ-21). */
export function NoList({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-medium">{text}</span>
      <Chip kind="oq" id="OQ-21" note="No status list in the specification; shown as text, not a badge" />
    </span>
  )
}

export function Outcome({ value }: { value?: "Pass" | "Fail" | "NA" }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not recorded</span>
  const Icon = value === "Pass" ? CircleCheck : value === "Fail" ? CircleX : CircleMinus
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium", value === "Pass" ? "bg-status-passed-tint text-status-passed-ink" : value === "Fail" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
      <Icon className="size-3" aria-hidden="true" />
      {value}
    </span>
  )
}

/** Document link with the live title from the store (falls back to the id). */
export function DocLinkText({ r, label }: { r: DocRef; label?: string }) {
  return (
    <Link to={docRoute(r)} className="text-link underline-offset-4 hover:underline">
      {label ?? r.id}
    </Link>
  )
}
export const lookupStatus = (r: DocRef) => store.lookup(r).status

/** Data-state simulation for review: `?sim=error` or `?sim=empty` on any quality-trace screen, plus
 *  the 600 ms first-visit skeleton (design convenience, not a specification feature). */
export function useDataState(key: string) {
  const [params, setParams] = useSearchParams()
  const loading = useFirstVisitLoading(key)
  const sim = params.get("sim")
  const [retried, setRetried] = useState(false)
  return {
    loading,
    error: sim === "error" && !retried ? "The quality service did not answer (simulated with ?sim=error)." : undefined,
    empty: sim === "empty",
    retry: () => {
      setRetried(true)
      params.delete("sim")
      setParams(params, { replace: true })
    },
  }
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
export function TextField({ id, label, value, onChange, type = "text", hint, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; hint?: ReactNode; placeholder?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
export function Pick<T extends string>({ id, label, value, onChange, options, placeholder }: { id: string; label?: string; value: T | "" | undefined; onChange: (v: T) => void; options: (T | { value: T; label: string })[]; placeholder?: string }) {
  const sel = (
    <Select value={value || undefined} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger id={id} size="sm" className="h-8 min-w-36" aria-label={label ?? placeholder}>
        <SelectValue placeholder={placeholder ?? "Choose"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value
          return (
            <SelectItem key={v} value={v}>
              {typeof o === "string" ? o : o.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
  return label ? (
    <Field label={label} htmlFor={id}>
      {sel}
    </Field>
  ) : (
    sel
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {action}
      </h2>
      {children}
    </section>
  )
}

export function NotFound({ what, id, back }: { what: string; id?: string; back: { to: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
      <p className="font-medium">
        No {what} {id}
      </p>
      <Link to={back.to} className="text-sm text-link underline-offset-4 hover:underline">
        {back.label}
      </Link>
    </div>
  )
}

/** Show the outcome of an action as a toast; returns true on success. */
export function report<T>(r: { ok: true; value: T } | { ok: false; error: string; field?: string }, ok: string | ((v: T) => string)) {
  if (r.ok) toast.success(typeof ok === "function" ? ok(r.value) : ok)
  else toast.error(r.error)
  return r.ok
}

/** Activity log (newest first). */
export function ActivityList({ items }: { items: { at: string; by: string; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity recorded.</p>
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {[...items].reverse().map((a, i) => (
        <li key={i} className="flex gap-3 border-b pb-2 last:border-0">
          <span className="tabular w-24 shrink-0 text-muted-foreground">{a.at.slice(0, 10)}</span>
          <span className="w-36 shrink-0 text-muted-foreground">{a.by}</span>
          <span>{a.text}</span>
        </li>
      ))}
    </ol>
  )
}

/** Small statistic pill used in list headers. */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "attention" }) {
  return (
    <div className={cn("rounded-lg border px-4 py-2", tone === "attention" && "border-status-exception")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
    </div>
  )
}

/** Skeleton rows wrapped in a table (SkeletonRows renders <tr> elements). */
export function SkeletonTable({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <Table>
      <TableBody>
        <SkeletonRows cols={cols} rows={rows} />
      </TableBody>
    </Table>
  )
}
