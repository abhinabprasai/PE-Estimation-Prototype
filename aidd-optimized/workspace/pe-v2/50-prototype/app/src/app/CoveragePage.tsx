// /coverage: reads the screen registry (src/data/screens.ts) and each module's `built` claims, and
// shows built and unbuilt counts per PRD module, per flow and per wave, plus the full list.
import { Link } from "react-router"
import { Progress } from "@/components/ui/progress"
import { DataTable, FamilyLegend, type Column } from "@/components/patterns"
import { PageHeader } from "@/components/templates"
import { FLOWS, SCREENS, type Built, type ScreenEntry } from "@/data/screens"
import { GROUPS } from "@/data/modules"
import { SPINE_DOCS, HERO } from "@/data/shared"
import { docRoute } from "@/data/domain"
import { store } from "@/store"
import { useModules } from "./modules-context"

type Row = ScreenEntry & { effective: Built; claimedBy?: string }

function CountTable({ title, rows }: { title: string; rows: { key: string; label: string; total: number; full: number; partial: number }[] }) {
  return (
    <section aria-label={title} className="rounded-lg border">
      <h2 className="border-b px-4 py-2 text-sm font-semibold">{title}</h2>
      <table className="w-full text-[13px]">
        <thead className="bg-table-head text-left">
          <tr className="h-8">
            <th className="px-2 font-medium">{title.replace("By ", "")}</th>
            <th className="px-2 text-right font-medium">Entries</th>
            <th className="px-2 text-right font-medium">Built</th>
            <th className="px-2 text-right font-medium">Partial</th>
            <th className="px-2 text-right font-medium">Not built</th>
            <th className="w-32 px-2 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="h-8 border-t">
              <td className="px-2">{r.label}</td>
              <td className="tabular px-2 text-right">{r.total}</td>
              <td className="tabular px-2 text-right">{r.full}</td>
              <td className="tabular px-2 text-right">{r.partial}</td>
              <td className="tabular px-2 text-right">{r.total - r.full - r.partial}</td>
              <td className="px-2">
                <Progress value={r.total ? ((r.full + r.partial * 0.5) / r.total) * 100 : 0} aria-label={`${r.label} progress`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function CoveragePage() {
  const modules = useModules()
  const rows: Row[] = SCREENS.map((s) => {
    const claim = modules.find((m) => m.built[s.id])
    return { ...s, effective: claim?.built[s.id] ?? s.built, claimedBy: claim?.group }
  })
  const count = (list: Row[]) => ({ total: list.length, full: list.filter((r) => r.effective === "full").length, partial: list.filter((r) => r.effective === "partial").length })
  const all = count(rows)
  const moduleNames = [...new Set(SCREENS.map((s) => s.module))]
  const byModule = moduleNames.map((m) => ({ key: m, label: m, ...count(rows.filter((r) => r.module === m)) }))
  const byFlow = FLOWS.map((f) => ({ key: f.id, label: `${f.id} ${f.name}`, ...count(rows.filter((r) => r.flows.includes(f.id))) }))
  const byGroup = GROUPS.map((g) => ({ key: g.id, label: `${g.label} (src/modules/${g.id})`, ...count(rows.filter((r) => r.group === g.id)) }))
  const waves = ["W1", "W2", "W3", "W4", "W5", "W6", "W7"]
  const byWave = waves.map((w) => ({ key: w, label: w, ...count(rows.filter((r) => r.wave === w)) }))

  const columns: Column<Row>[] = [
    { id: "id", header: "Screen", value: (r) => r.id, sortable: true, mono: true },
    { id: "title", header: "Title", value: (r) => r.title, sortable: true },
    { id: "module", header: "Module", value: (r) => r.module, filterable: true, sortable: true },
    { id: "archetype", header: "Archetype", value: (r) => r.archetype, filterable: true },
    { id: "wave", header: "Wave", value: (r) => r.wave, filterable: true, sortable: true },
    { id: "flows", header: "Flows", value: (r) => r.flows.join(", ") },
    { id: "source", header: "Source", value: (r) => (r.source === "feature-list" ? "Feature list" : "PRD plan"), filterable: true },
    { id: "built", header: "Built", value: (r) => r.effective, filterable: true, sortable: true },
    { id: "route", header: "Route", value: (r) => r.route, cell: (r) => <Link to={r.route.replace(/:id/g, "TBD")} className="font-mono text-xs text-link underline">{r.route}</Link> },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prototype coverage"
        description={`All ${all.total} entries: the PRD screen plan (84: Book VI 78 + Book VII 6) and ${all.total - 84} feature-list entries (components, shell, dashboards, dialogs, config, reports, print, mobile flows, Book IX target state). Built ${all.full}, partial ${all.partial}, not built ${all.total - all.full - all.partial}. INV-RETURN ships no screen (ASM-SCOPE-1).`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CountTable title="By PRD module" rows={byModule} />
        <CountTable title="By flow" rows={byFlow} />
        <CountTable title="By module group (folder)" rows={byGroup} />
        <CountTable title="By wave" rows={byWave} />
      </div>
      <section aria-label="Hero thread" className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Hero thread: {HERO.project}</h2>
        <p className="text-sm text-muted-foreground">
          ETO, {HERO.customerId}, {HERO.itemId}. Phase 1 {HERO.phase1Order} runs the whole spine to recall {HERO.recall}; phase 2 {HERO.phase2Order} is the open FL-09 order. Owner = the module that seeds the full record.
        </p>
        <ol className="mt-2 grid gap-1 text-sm md:grid-cols-2">
          {SPINE_DOCS.map((d) => {
            const info = store.lookup(d.ref)
            return (
              <li key={d.ref.id} className="flex flex-wrap gap-2">
                <span className="tabular w-6 text-muted-foreground">P{d.phase}</span>
                <Link to={docRoute(d.ref)} className="font-mono text-link underline">
                  {d.ref.id}
                </Link>
                <span className="text-muted-foreground">{d.owner}</span>
                {!info.known || !store.search().some((h) => h.ref?.id === d.ref.id) ? <span className="text-xs italic text-muted-foreground">header only</span> : null}
              </li>
            )
          })}
        </ol>
      </section>
      <section aria-label="Status families" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Status families (TENTATIVE, OQ-18)</h2>
        <FamilyLegend />
      </section>
      <DataTable<Row> rows={rows} columns={columns} rowId={(r) => r.id} searchText={(r) => `${r.id} ${r.title} ${r.module}`} densityKey="coverage" caption="All screen entries" />
    </div>
  )
}
