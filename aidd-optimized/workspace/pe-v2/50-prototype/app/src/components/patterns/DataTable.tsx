// DataTable: the one table for List, Workbench and Config screens.
// Sort (click a header), filter (per-column select), search (text over chosen fields), density
// toggle (Compact 32 px / Comfortable 40 px, remembered per table, layout.md L-3), selection for
// act-on-many queues, and the four data states: loading (skeleton rows), error (alert + retry),
// empty (nothing exists yet) and no-match (filters hide everything).

import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DensityToggle, EmptyState, ErrorAlert, SkeletonRows, rowCls, useDensity } from "./feedback"
import { cn } from "@/lib/utils"

export interface Column<R> {
  id: string
  header: string
  /** Cell renderer. Defaults to String(value(row)). */
  cell?: (row: R) => ReactNode
  /** Value used for sort, filter and default rendering. */
  value?: (row: R) => string | number | undefined | null
  sortable?: boolean
  /** Show a filter select built from the column's distinct values. */
  filterable?: boolean
  align?: "left" | "right" | "center"
  /** Tailwind width class, e.g. "w-40". */
  className?: string
  /** Numeric / identifier columns use tabular figures. */
  mono?: boolean
}

export interface DataTableProps<R> {
  rows: R[]
  columns: Column<R>[]
  rowId: (row: R) => string
  /** Fields searched by the search box; omit to hide the search box. */
  searchText?: (row: R) => string
  searchPlaceholder?: string
  /** Row link: the first column renders as a link to this route. */
  rowHref?: (row: R) => string
  onRowClick?: (row: R) => void
  /** Selection for Workbench queues. */
  selectable?: boolean
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
  /** Highlighted row (e.g. the one open in a side panel). */
  activeId?: string
  loading?: boolean
  error?: string
  onRetry?: () => void
  empty?: { title: string; body?: ReactNode }
  /** Persist density under this key ("<screen-id>"). */
  densityKey?: string
  /** Extra controls on the toolbar's right (export, new). */
  toolbar?: ReactNode
  caption?: string
  initialSort?: { id: string; dir: "asc" | "desc" }
}

export function DataTable<R>(p: DataTableProps<R>) {
  const [density, setDensity] = useDensity(p.densityKey)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState(p.initialSort)

  const valueOf = (c: Column<R>, r: R) => (c.value ? c.value(r) : undefined)
  const filterCols = p.columns.filter((c) => c.filterable && c.value)

  const visible = useMemo(() => {
    let out = p.rows
    const needle = q.trim().toLowerCase()
    if (needle && p.searchText) out = out.filter((r) => p.searchText!(r).toLowerCase().includes(needle))
    for (const [id, v] of Object.entries(filters)) {
      if (!v) continue
      const c = p.columns.find((x) => x.id === id)
      if (c) out = out.filter((r) => String(valueOf(c, r) ?? "") === v)
    }
    if (sort) {
      const c = p.columns.find((x) => x.id === sort.id)
      if (c?.value) {
        const dir = sort.dir === "asc" ? 1 : -1
        out = [...out].sort((a, b) => {
          const va = valueOf(c, a)
          const vb = valueOf(c, b)
          if (va == null) return 1
          if (vb == null) return -1
          return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * dir
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.rows, q, filters, sort])

  const sel = new Set(p.selected ?? [])
  const toggle = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    p.onSelectedChange?.([...next])
  }
  const allVisibleSelected = visible.length > 0 && visible.every((r) => sel.has(p.rowId(r)))
  const colCount = p.columns.length + (p.selectable ? 1 : 0)
  const filtered = q.trim() !== "" || Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {p.searchText && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search this list" placeholder={p.searchPlaceholder ?? "Search"} value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-64 pl-8" />
          </div>
        )}
        {filterCols.map((c) => {
          const opts = [...new Set(p.rows.map((r) => String(valueOf(c, r) ?? "")).filter(Boolean))].sort()
          return (
            <Select key={c.id} value={filters[c.id] ?? "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, [c.id]: v === "__all" ? "" : v }))}>
              <SelectTrigger size="sm" aria-label={`Filter by ${c.header}`} className="h-8 min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All {c.header.toLowerCase()}</SelectItem>
                {opts.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        })}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => (setQ(""), setFilters({}))}>
            <X aria-hidden="true" /> Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {p.loading ? "Loading" : `${visible.length} of ${p.rows.length}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {p.toolbar}
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>

      {p.error ? (
        <ErrorAlert title="This list could not be loaded" action={p.onRetry && <button className="underline" onClick={p.onRetry}>Try again</button>}>
          {p.error}
        </ErrorAlert>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            {p.caption && <caption className="sr-only">{p.caption}</caption>}
            <TableHeader className="bg-table-head">
              <TableRow>
                {p.selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all visible rows"
                      checked={allVisibleSelected}
                      onCheckedChange={(v) => p.onSelectedChange?.(v ? [...new Set([...sel, ...visible.map(p.rowId)])] : [...sel].filter((id) => !visible.some((r) => p.rowId(r) === id)))}
                    />
                  </TableHead>
                )}
                {p.columns.map((c) => {
                  const active = sort?.id === c.id
                  const Icon = !active ? ArrowUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown
                  return (
                    <TableHead key={c.id} className={cn(c.className, c.align === "right" && "text-right")} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.sortable && c.value ? (
                        <button className="inline-flex items-center gap-1 font-medium" onClick={() => setSort({ id: c.id, dir: active && sort!.dir === "asc" ? "desc" : "asc" })}>
                          {c.header}
                          <Icon className="size-3" aria-hidden="true" />
                        </button>
                      ) : (
                        c.header
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.loading ? (
                <SkeletonRows cols={colCount} />
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="p-4">
                    {filtered ? (
                      <EmptyState title="No rows match the search and filters">
                        <button className="underline" onClick={() => (setQ(""), setFilters({}))}>
                          Clear search and filters
                        </button>
                      </EmptyState>
                    ) : (
                      <EmptyState title={p.empty?.title ?? "Nothing here yet"}>{p.empty?.body}</EmptyState>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const id = p.rowId(r)
                  return (
                    <TableRow
                      key={id}
                      data-state={sel.has(id) || p.activeId === id ? "selected" : undefined}
                      className={cn(rowCls(density), p.onRowClick && "cursor-pointer")}
                      onClick={p.onRowClick ? () => p.onRowClick!(r) : undefined}
                    >
                      {p.selectable && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox aria-label={`Select ${id}`} checked={sel.has(id)} onCheckedChange={() => toggle(id)} />
                        </TableCell>
                      )}
                      {p.columns.map((c, i) => {
                        const content = c.cell ? c.cell(r) : String(valueOf(c, r) ?? "")
                        return (
                          <TableCell key={c.id} className={cn(c.align === "right" && "text-right", c.mono && "tabular font-mono", c.className)}>
                            {i === 0 && p.rowHref ? (
                              <Link to={p.rowHref(r)} className="font-medium text-link underline-offset-4 hover:underline" onClick={(e) => e.stopPropagation()}>
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
