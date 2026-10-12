// More small building blocks for the purchasing-finance screens: name lookups, links, form fields,
// and the detail-page frame for loading, error and not-found states. Token classes only.

import type { ReactNode } from "react"
import { Link } from "react-router"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, ErrorAlert, SkeletonRows } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { Button } from "@/components/ui/button"
import { Table, TableBody } from "@/components/ui/table"
import { COST_CENTERS, CUSTOMERS, PROFIT_CENTERS, userById } from "@/data/shared"
import { itemText } from "../data/logic"

export const userName = (id?: string) => (id ? (userById(id)?.name ?? id) : "Not recorded")
export const customerName = (id?: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id ?? ""
export const ccName = (id?: string) => COST_CENTERS.find((c) => c.id === id)?.name ?? id ?? ""
export const pcName = (id?: string) => PROFIT_CENTERS.find((c) => c.id === id)?.name ?? id ?? ""

export function ItemLink({ id, short }: { id: string; short?: boolean }) {
  return (
    <span className="inline-flex flex-col">
      <Link to={`/inventory/items/${id}`} className="font-mono text-link underline-offset-4 hover:underline">
        {id}
      </Link>
      {!short && <span className="text-xs text-muted-foreground">{itemText(id)}</span>}
    </span>
  )
}
export function VendorLink({ id, name }: { id: string; name?: string }) {
  return (
    <Link to={`/purchasing/vendors/${id}`} className="text-link underline-offset-4 hover:underline">
      <span className="font-mono">{id}</span>
      {name && <span> {name}</span>}
    </Link>
  )
}
export function RecLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-mono text-link underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}

export function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
export function TextField({ id, label, value, onChange, type = "text", hint, placeholder }: { id: string; label: string; value: string | number; onChange: (v: string) => void; type?: string; hint?: ReactNode; placeholder?: string }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
export function SelectField<T extends string>({ id, label, value, onChange, options, hint }: { id: string; label: string; value: T | ""; onChange: (v: T) => void; options: { value: T; label: string }[]; hint?: ReactNode }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Frame for a detail route: the loading skeleton, the error state and the not-found state. */
export function DetailFrame({ loading, error, onRetry, found, title, screenId, back, children }: { loading: boolean; error?: string; onRetry: () => void; found: boolean; title: string; screenId: string; back: { label: string; to: string }; children: () => ReactNode }) {
  if (loading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeader title={title} screenId={screenId} crumbs={[back]} />
        <SkeletonTable cols={5} rows={6} />
      </div>
    )
  if (error)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} screenId={screenId} crumbs={[back]} />
        <ErrorAlert title="Could not load this record" action={<Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}>
          {error}
        </ErrorAlert>
      </div>
    )
  if (!found)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={title} screenId={screenId} crumbs={[back]} />
        <EmptyState title={`${title} not found`}>
          It may have been created in another session; Scenario reset restores the seed. <Link className="text-link underline-offset-4 hover:underline" to={back.to}>Back to {back.label}</Link>
        </EmptyState>
      </div>
    )
  return <>{children()}</>
}

export const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")))

/** SkeletonRows renders table rows; this wraps them in a table so the markup stays valid. */
export function SkeletonTable({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <Table aria-busy="true" aria-label="Loading">
      <TableBody>
        <SkeletonRows cols={cols} rows={rows} />
      </TableBody>
    </Table>
  )
}
