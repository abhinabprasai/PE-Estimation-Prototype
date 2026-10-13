// FX-MM-REPORTS: Material management reports MM-R1 to MM-R8 [Book II §17]. /materials/reports is the
// index (one card per report with its headline number); /materials/reports/:id runs one report as a
// sortable, filterable table with CSV export. Reports are read-only (R2 first asks for a material).

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardCard, DashboardPage, ListPage } from "@/components/templates"
import { Chip, EmptyState, RulesPanel, type Column } from "@/components/patterns"
import { fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { allMaterials } from "../data/state"
import { REPORTS, reportById, toCsv, type Cell, type ReportCol } from "../lib/reports"
import { MatLink, Reading } from "../components/common"
import { useViewState } from "../components/states"

function saveCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsIndex() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-REPORTS", { degradedWhat: "The reporting mart is behind by a day" })
  const built = useMemo(() => REPORTS.map((r) => ({ r, res: r.needsMaterial ? undefined : r.build(s, {}) })), [s])
  return (
    <DashboardPage
      header={{
        screenId: "FX-MM-REPORTS",
        title: "Material management reports",
        description: "Eight read-only reports on the material master: completeness, where-used, sourcing coverage, slow-moving stock, supersession, consignment, special stock and the lifecycle funnel. Open one to filter, drill and export.",
        chips: <Reading id="RD-MM-32" />,
        actions: st.toolbar,
      }}
      tiles={built.filter((b) => b.res).slice(0, 4).map(({ r, res }) => ({ label: `${r.id} ${res!.headline.label}`, value: res!.headline.value, to: `/materials/reports/${r.id}` }))}
    >
      <div className="col-span-full flex flex-col gap-2 empty:hidden">{st.banners}</div>
      {st.empty ? (
        <div className="col-span-full"><EmptyState title="No report is available">Your role has no report access, or the mart has not loaded.</EmptyState></div>
      ) : (
        built.map(({ r, res }) => (
          <DashboardCard key={r.id} title={`${r.id} ${r.title}`} action={<Button size="sm" variant="outline" asChild><Link to={`/materials/reports/${r.id}`}>Open</Link></Button>}>
            <p className="text-sm text-muted-foreground">{r.content}</p>
            <p className="tabular text-sm">{res ? <><span className="text-2xl font-semibold">{res.headline.value}</span> <span className="text-muted-foreground">{res.headline.label}</span></> : <span className="text-muted-foreground">Choose a material to run it</span>}</p>
            {r.links && <p className="flex flex-wrap gap-3 text-xs">{r.links.map((l) => <Link key={l.to} to={l.to} className="text-link underline-offset-4 hover:underline">{l.label}</Link>)}</p>}
          </DashboardCard>
        ))
      )}
    </DashboardPage>
  )
}

export function ReportDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const def = reportById(id)
  const st = useViewState(`FX-MM-REPORTS-${id}`, { degradedWhat: "The reporting mart is behind by a day" })
  const [material, setMaterial] = useState("RAW-TBD-CRGO23")
  const mats = useMemo(() => allMaterials(s).slice(0, 80), [s])
  const res = useMemo(() => def?.build(s, { material }), [def, s, material])
  if (!def || !res)
    return (
      <EmptyState title={`Report ${id} was not found`}>
        <Link to="/materials/reports" className="text-link underline-offset-4 hover:underline">Back to the reports</Link>
      </EmptyState>
    )
  const cols: Column<Record<string, Cell>>[] = res.columns.map((c: ReportCol, i) => ({
    id: c.id,
    header: c.header,
    value: (row) => row[c.id] as string | number,
    sortable: true,
    filterable: c.filterable,
    mono: c.kind === "num" || c.kind === "money" || c.kind === "mat",
    align: c.kind === "num" || c.kind === "money" ? "right" : "left",
    cell: (row) => {
      const v = row[c.id]
      if (c.kind === "mat" && v) return <MatLink id={String(v)} />
      if (c.kind === "money") return typeof v === "number" ? fmtMoney(v) : String(v)
      if (c.kind === "num") return typeof v === "number" ? fmtNumber(v, Number.isInteger(v) ? 0 : 2) : String(v)
      const to = i === 0 ? res.href?.(row) : undefined
      return to ? <Link to={to} className="text-link underline-offset-4 hover:underline">{String(v)}</Link> : String(v ?? "")
    },
  }))
  return (
    <ListPage
      header={{
        screenId: "FX-MM-REPORTS",
        title: `${def.id} ${def.title}`,
        crumbs: [{ label: "Reports", to: "/materials/reports" }, { label: def.id }],
        description: def.content,
        chips: <Chip kind="design">Headline: {res.headline.label} {res.headline.value}</Chip>,
        actions: (
          <Button variant="outline" disabled={!!st.error || st.empty} onClick={() => saveCsv(`${def.id.toLowerCase()}.csv`, toCsv(res))}>
            <Download aria-hidden="true" /> Export CSV
          </Button>
        ),
      }}
      above={
        <div className="flex flex-col gap-3">
          {st.banners}
          {def.needsMaterial && (
            <div className="flex max-w-sm flex-col gap-1">
              <Label htmlFor="rep-mat">Material</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger id="rep-mat" size="sm" className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{mats.map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      }
      table={{
        rows: st.empty ? [] : res.rows,
        columns: cols,
        rowId: (r) => JSON.stringify(r),
        searchText: (r) => Object.values(r).join(" "),
        searchPlaceholder: "Search this report",
        loading: st.loading,
        error: st.error,
        onRetry: st.onRetry,
        toolbar: st.toolbar,
        densityKey: `FX-MM-REPORTS-${id}`,
        empty: { title: def.needsMaterial ? "Nothing references this material" : "Nothing to report", body: def.needsMaterial ? "No BOM, plan, price row, info record or source list row uses it." : "No row meets this report's criteria." },
      }}
      below={
        <div className="flex flex-col gap-4">
          {res.notes.length > 0 && <ul className="mt-2 list-disc pl-6 text-xs text-muted-foreground">{res.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <RulesPanel rules={[[def.id, def.content, "[Book II §17]"], ["Read-only", "Reports never change a record; each row links to the screen that does.", "design"]]} />
        </div>
      }
    />
  )
}
