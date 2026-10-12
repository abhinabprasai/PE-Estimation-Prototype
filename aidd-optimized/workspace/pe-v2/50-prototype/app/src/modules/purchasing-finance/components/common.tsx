// Small building blocks shared by the purchasing-finance screens. Token classes only (tokens.md).

import { useMemo, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router"
import { BookOpen, Download, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, useFirstVisitLoading } from "@/components/patterns"
import { OTHER_POSTINGS, docLabel, docRoute, type DocRef } from "@/data/domain"
import { fmtMoney } from "@/lib/format"
import type { Result } from "@/store"
import { cn } from "@/lib/utils"

/** Readings this module took where the specification is silent. Logged in the module README and
 *  requested as OQ numbers in 10-discovery/open-questions.md (Requests to foundation R-9). */
export const READINGS: Record<string, string> = {
  "OQ-PF-1": "Expense and manual requisitions route through the PO value ladder: the specification names no requisition approver [DOC:p.102].",
  "OQ-PF-2": "A requisition moves to Converted when the PO it feeds is approved (the spine seeds PR-TBD-0377 Approved while PO-TBD-0377 is In Approval).",
  "OQ-PF-3": "A PO under a long-lead release is sent only after the LLR is approved; the specification says the LLR is the authority for early POs.",
  "OQ-PF-4": "An AVL price basis of info record or contract counts as contracted for the RFQ policy above $25,000 [DOC:p.100].",
  "OQ-PF-5": "PO re-approval threshold: the total rises more than 5% or moves into a higher ladder band; [DOC:p.105] says only \"beyond threshold\".",
  "OQ-PF-6": "Over-receipt tolerance is 0% until a value is given (E-MM-11 names the block, not the tolerance).",
  "OQ-PF-7": "A rejected PO approval returns the PO to Draft; the PO status list has no Rejected.",
  "OQ-PF-8": "Quality Manager, Quality engineer or Purchasing Manager restricts or disqualifies; Disqualified suspends the vendor's AVL rows (the cascade target is not detailed).",
  "OQ-PF-9": "Price lists and allocation runs have no document type in the flow model; their approvals and postings carry an approval-type reference.",
  "OQ-PF-10": "Supersede creates the next estimate version as Draft; the Released one turns Superseded when the successor is released, so a quotable estimate always exists.",
  "OQ-PF-11": "Margin for the floor check = (net price less surcharge and freight - standard cost) / that price. PC-200 and PC-400 have no stated floor.",
  "OQ-PF-12": "Intercompany direction at go-live: PE Transformer buys merchandise from PE Grid Components (OQ-15 holds the screen question).",
  "OQ-PF-13": "Planned productive hours = capacity hours/day x 250 working days x efficiency; working days per year are not stated.",
  "OQ-PF-14": "Posting events carry no cost or profit center; the live journal shows the derivation rule per template and dimensions only where the source PO gives them.",
  "OQ-PF-15": "Long-lead release has no status list (OQ-21); Draft, Awaiting approval, Approved and Closed are shown as text.",
  "OQ-PF-16": "The person who marks a costing run cannot release it (separation of duties as in FL-03 and FL-06; not stated for costing).",
  "OQ-PF-17": "Vendor onboarding Under Review to Active is the Controller's financial release (role table p.107); earlier steps by Buyer or Purchasing Manager.",
}
export function Reading({ id }: { id: keyof typeof READINGS | string }) {
  return <Chip kind="oq" id={id} note={READINGS[id] ?? id} />
}
export function Design({ note, children }: { note: string; children?: ReactNode }) {
  return (
    <Chip kind="design" note={note}>
      {children ?? "Design value"}
    </Chip>
  )
}
/** A record with no status list (OQ-21): state as text, never a badge. */
export function TextState({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-medium">{value}</span>
      <Chip kind="oq" id="OQ-21" note="No status list in the specification for this record; state shown as text, no badge" />
    </span>
  )
}

export function DocLink({ r, label }: { r: DocRef; label?: string }) {
  return (
    <Link to={docRoute(r)} className="font-mono text-link underline-offset-4 hover:underline" title={docLabel(r)}>
      {label ?? r.id}
    </Link>
  )
}

/** Toast the outcome of an action. Returns the error string (for DialogShell) or null. */
export function report<T>(r: Result<T>, ok: string | ((v: T) => string)): string | null {
  if (r.ok) {
    toast.success(typeof ok === "function" ? ok(r.value) : ok)
    return null
  }
  toast.error(r.error)
  return r.error
}

// ------------------------------------------------------------------ data states (loading, empty, error)
export type DemoState = "normal" | "loading" | "empty" | "error"
/** First-visit skeleton plus a reviewer control to preview every data state (?state=loading|empty|error). */
export function useDemoState(key: string) {
  const [params, setParams] = useSearchParams()
  const first = useFirstVisitLoading(key)
  const forced = (params.get("state") as DemoState | null) ?? "normal"
  const set = (s: DemoState) => {
    const p = new URLSearchParams(params)
    if (s === "normal") p.delete("state")
    else p.set("state", s)
    setParams(p, { replace: true })
  }
  return {
    loading: first || forced === "loading",
    empty: forced === "empty",
    error: forced === "error" ? "The purchasing service did not answer in time (simulated). Your data is safe; nothing was changed." : undefined,
    retry: () => set("normal"),
    menu: <StateMenu value={forced} onChange={set} />,
  }
}
function StateMenu({ value, onChange }: { value: DemoState; onChange: (s: DemoState) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Preview data states">
          <SlidersHorizontal aria-hidden="true" /> States
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Preview data state</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["normal", "loading", "empty", "error"] as DemoState[]).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)} aria-checked={value === s}>
            {s === "normal" ? "Seeded data" : s === "loading" ? "Loading" : s === "empty" ? "Empty" : "Error"}
            {value === s ? " (shown)" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ------------------------------------------------------------------ postings outside templates #17..#38
/** Postings the specification names without a Part J template number (OTHER_POSTINGS) and the
 *  revaluation (INV Sec 12 #15). Same layout as PostingPreview; accounts only from the source. */
export function OtherPostingPreview({ rows, period, title = "Postings on commit" }: { rows: { key: keyof typeof OTHER_POSTINGS | "reval" | "ppv"; amount: number; detail?: string; currency?: "USD" | "CAD" }[]; period?: string; title?: string }) {
  const def = (k: (typeof rows)[number]["key"]) =>
    k === "reval"
      ? { transaction: "Revaluation at standard release (INV Sec 12 #15)", debit: "1310/1330 Inventory (or 5330 if down)", credit: "5330 Revaluation (or 1310/1330)" }
      : k === "ppv"
        ? { transaction: "Purchase price variance (Part A §8)", debit: "5210 PPV (unfavorable)", credit: "2110 GR/IR path" }
        : OTHER_POSTINGS[k]
  const total = rows.reduce((t, r) => t + r.amount, 0)
  return (
    <section aria-label={title} className="rounded-lg border">
      <h3 className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
        <BookOpen className="size-4" aria-hidden="true" /> {title}
        {period && <span className="font-normal text-muted-foreground">· fiscal period {period}</span>}
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
          {rows.map((r, i) => {
            const t = def(r.key)
            return (
              <TableRow key={i} className="h-8 align-top text-[13px]">
                <TableCell>
                  {t.transaction}
                  {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
                </TableCell>
                <TableCell>{t.debit}</TableCell>
                <TableCell>{t.credit}</TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.amount, r.currency)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="flex justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>No Part J template number: named in flow text [DOC:p.178 FL-03; p.37 §8] (asserted). Posts through the shared Posting Service.</span>
        <span className="tabular">Total {fmtMoney(total, rows[0]?.currency)}</span>
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ export
export function CsvButton({ filename, rows, label = "Export" }: { filename: string; rows: Record<string, string | number | undefined>[]; label?: string }) {
  const csv = useMemo(() => {
    if (!rows.length) return ""
    const keys = Object.keys(rows[0])
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    return [keys.map(esc).join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n")
  }, [rows])
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!csv}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`${filename} exported (${rows.length} rows)`)
      }}
    >
      <Download aria-hidden="true" /> {label}
    </Button>
  )
}

export function Section({ title, children, className, action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
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

/** Horizontal bar used for the LLR exposure tracker and budget use (value against a cap). */
export function CapBar({ value, cap, label }: { value: number; cap: number; label: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : 0
  const over = value > cap
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular">
          {fmtMoney(value)} of {fmtMoney(cap)} ({pct}%){over ? " · cap breached" : ""}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={value} aria-label={label}>
        <div className={cn("h-2 rounded-full", over ? "bg-status-blocked" : pct > 85 ? "bg-status-pending" : "bg-status-active")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export const signCls = (n: number) => (n > 0 ? "text-status-cancelled-ink" : n < 0 ? "text-status-passed-ink" : "")
/** Variance amount: positive = unfavorable (Part A §8 sign convention); word as well as colour. */
export function VarAmount({ v }: { v: number }) {
  return (
    <span className={cn("tabular", signCls(v))}>
      {fmtMoney(v)} <span className="text-xs">{v > 0 ? "unfav" : v < 0 ? "fav" : ""}</span>
    </span>
  )
}
