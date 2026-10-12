// Small building blocks shared by the materials screens. Token classes and shared patterns only.

import type { ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, FamilyBadge, StatusBadge, useFirstVisitLoading } from "@/components/patterns"
import type { Family, Material, MaterialType } from "@/data/domain"
import { userById } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { READINGS, type IrStatus, type ReadingId, type SlaState } from "../lib/rules"
import { R } from "../data/state"

/** A PRD-silent choice shown on screen; logged in README "Readings". */
export function Reading({ id }: { id: ReadingId }) {
  return (
    <Chip kind="design" note={READINGS[id]}>
      Reading {id}
    </Chip>
  )
}
/** MCR, MCH and supersession have no status list in the PRD (OQ-21): text, never a badge. */
export function NoStatusList() {
  return <Chip kind="oq" id="OQ-21" note="The PRD gives no status list for this record; its stage is shown as text, never as a status badge." />
}

export function TypeBadge({ type }: { type: MaterialType }) {
  return (
    <Badge variant="outline" className="font-mono" title="Material type (immutable, §2.1)">
      {type}
    </Badge>
  )
}

/** Lifecycle badge (S-42) with function-specific block chips beside it (S-43, C-5). */
export function MaterialStatus({ m, size = "sm" }: { m: Pick<Material, "status" | "blocks">; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge kind="material" status={m.status} size={size} />
      {m.blocks.map((b) => (
        <Chip key={b.block} kind="block" note={`${b.reason} (set ${b.on})`}>
          {b.block}
        </Chip>
      ))}
    </span>
  )
}

export function MatLink({ id, tab, children }: { id: string; tab?: string; children?: ReactNode }) {
  return (
    <Link to={R.material(id, tab)} className="font-mono text-link underline-offset-4 hover:underline">
      {children ?? id}
    </Link>
  )
}
export function DocLinkText({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-mono text-link underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}
export const userName = (id?: string) => (id ? (userById(id)?.name ?? id) : "Not assigned")

export function Completeness({ pct, active }: { pct: number; active?: boolean }) {
  return (
    <span className="flex min-w-28 items-center gap-2" title={`${pct}% of mandatory-for-use fields populated (§16.4)`}>
      <Progress value={pct} className="h-2 w-16" aria-label={`Completeness ${pct}%`} />
      <span className={cn("tabular text-xs", pct < 100 && active && "font-semibold text-destructive")}>{pct}%</span>
    </span>
  )
}

const IR_FAMILY: Record<IrStatus, Family> = { Active: "active", Expired: "done", Blocked: "blocked" }
/** Info record status (p.158) is not in the S catalog yet (RD-MM-09, request R-1). */
export function IrStatusBadge({ status }: { status: IrStatus }) {
  return <FamilyBadge family={IR_FAMILY[status]} label={status} size="sm" title="Info record status [DOC:p.158] (asserted); not yet an S-row" />
}

const SLA_FAMILY: Record<SlaState, Family> = { "On time": "active", "Due today": "pending", Breached: "exception", Done: "done" }
/** SLA aging (2 business days per task, §4.2). This is aging, not a record status. */
export function SlaTag({ state, due }: { state: SlaState; due?: string }) {
  return <FamilyBadge family={SLA_FAMILY[state]} label={state === "Done" ? "Done" : `${state}${due ? ` · due ${due}` : ""}`} size="sm" title="SLA aging, 2 business days per task" />
}

/** Postings named in Book II / Book I without a #17-#38 template number (E&O reserve, count
 *  adjustment, goods receipt). Same layout as PostingPreview (request R-5 to let it take these). */
export function TextPostingPreview({ title = "Postings on commit", lines, note }: { title?: string; lines: { transaction: string; debit: string; credit: string; amount: number; detail?: string }[]; note: string }) {
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <section aria-label={title} className="rounded-lg border">
      <h3 className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
        <BookOpen className="size-4" aria-hidden="true" /> {title}
      </h3>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Transaction</TableHead>
            <TableHead>Debit</TableHead>
            <TableHead>Credit</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={i} className="h-8 align-top text-[13px]">
              <TableCell>
                {l.transaction}
                {l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}
              </TableCell>
              <TableCell>{l.debit}</TableCell>
              <TableCell>{l.credit}</TableCell>
              <TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="flex justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>{note}</span>
        <span className="tabular">Total {fmtMoney(total)}</span>
      </p>
    </section>
  )
}

/** List data states: first-visit loading, plus a preview switch for the empty and error states
 *  (design: the prototype has no backend that can fail). */
export function useListState(key: string) {
  const loading = useFirstVisitLoading(key)
  const [sp, setSp] = useSearchParams()
  const preview = sp.get("preview") ?? "live"
  const set = (v: string) => {
    const n = new URLSearchParams(sp)
    if (v === "live") n.delete("preview")
    else n.set("preview", v)
    setSp(n, { replace: true })
  }
  const toolbar = (
    <Select value={preview} onValueChange={set}>
      <SelectTrigger size="sm" className="h-8 w-40" aria-label="Preview a data state (prototype)">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="live">Live data</SelectItem>
        <SelectItem value="empty">Preview: empty</SelectItem>
        <SelectItem value="error">Preview: load error</SelectItem>
      </SelectContent>
    </Select>
  )
  return {
    loading,
    empty: preview === "empty",
    error: preview === "error" ? "The server did not answer in time (simulated). Your filters are kept." : undefined,
    onRetry: () => set("live"),
    toolbar,
  }
}

export function Section({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-lg border p-4", className)}>
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {action}
      </h2>
      {children}
    </section>
  )
}

/** Field row for view tabs: label, value, field class and owner (§3.2, §4.4). */
export function FieldRow({ label, children, cls, owner }: { label: string; children: ReactNode; cls?: 1 | 2 | 3; owner?: string }) {
  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-2 border-b py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">
        {label}
        {cls && <span className="ml-1 text-xs">· Class {cls}</span>}
        {owner && <span className="block text-xs">{owner}</span>}
      </dt>
      <dd className="min-w-0">{children ?? <span className="text-muted-foreground">Not recorded</span>}</dd>
    </div>
  )
}
export const show = (v: unknown) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? undefined : Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v))
