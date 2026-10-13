// FX-CFG-NUMSERIES Number series delta [DOC:p.17-18 Book I §2.2; p.157 Book II §2.7, §2.3]: about 25 new document series
// (Book I), 5 more (Book II) and the nine material-type series, extending the Number Series Configuration screen
// (INV 11.3), which is an external spec (ASM-EXT-1). All are entity-aware where the companion accounting series are
// entity-aware; that mapping, the per-entity counters and the reset rules are readings (AR-30, AR-42).
// A change is a new effective-dated version; the next number never goes down.

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, KV, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { LEGAL_ENTITIES, TODAY } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { proposeNewSeries } from "../data/cfg-actions"
import type { NewSeries } from "../data/cfg-types"
import { checkFormat, inForce, nextOf, verState } from "../lib/cfg"
import { Field, StateText } from "../components/common"
import { StateFrame, StatePicker, useView, type View } from "../components/states"

const GROUPS = [
  { id: "book1", label: "Book I additions", match: (n: NewSeries) => n.group === "Book I §2.2" },
  { id: "book2", label: "Book II additions", match: (n: NewSeries) => n.group === "Book II §2.7" },
  { id: "material", label: "Material numbers", match: (n: NewSeries) => n.group === "Book II §2.3" },
]

export function NumberSeries() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "book1"
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const view = useView("FX-CFG-NUMSERIES")
  const [edit, setEdit] = useState<NewSeries | null>(null)
  const group = GROUPS.find((g) => g.id === section)
  const rows = view.empty ? [] : s.series.filter((n) => group?.match(n))

  return (
    <ConfigPage
      header={{
        title: "Number series: new series",
        screenId: "FX-CFG-NUMSERIES",
        description: `${s.series.filter(GROUPS[0].match).length} new series from Book I, ${s.series.filter(GROUPS[1].match).length} from Book II and the ${s.series.filter(GROUPS[2].match).length} material-type series. The older series stay on the core configuration set.`,
        chips: (
          <>
            <Chip kind="design" note="Route /configuration/number-series is a design value">Design route</Chip>
            <Chip kind="oq" id="OQ-30" note="Delta vs INV V3.0 / ACC V2.0, external specs (ASM-EXT-1): the Number Series Configuration screen (INV 11.3) is not in the knowledge base">External spec</Chip>
          </>
        ),
        actions: (<><StatePicker view={view} /><Button variant="outline" asChild><Link to="/configuration/core?section=numbers">Core number series</Link></Button></>),
      }}
      sections={[...GROUPS.map((g) => ({ id: g.id, label: `${g.label} (${s.series.filter(g.match).length})` })), { id: "tester", label: "Format tester" }]}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      <StateFrame view={view} cols={7} emptyTitle="No series in this group." emptyBody="The specification's series ship with the build; Scenario reset restores them." degraded="Degraded: the number allocator is slow. Allocation holds a row lock, so documents may wait a moment; no number is lost or repeated.">
        {section !== "tester" && (
          <DataTable<NewSeries>
            rows={rows}
            rowId={(n) => n.id}
            loading={view.loading}
            densityKey="FX-CFG-NUMSERIES"
            caption={group?.label}
            activeId={params.get("series") ?? undefined}
            searchText={(n) => `${n.docType} ${n.versions[0].value.format} ${n.example}`}
            searchPlaceholder="Search series"
            columns={[
              { id: "t", header: "Document type", value: (n) => n.docType, sortable: true },
              { id: "f", header: "Format in force", value: (n) => inForce(n.versions, a.instances)?.value.format ?? "", mono: true },
              { id: "e", header: "Example (spec)", value: (n) => n.example, mono: true },
              { id: "ea", header: "Counters", value: (n) => (n.entityAware ? "Per entity" : "One"), filterable: true, cell: (n) => (n.entityAware ? <span className="text-xs">Per entity: {Object.entries(n.counters).map(([k, v]) => `${LEGAL_ENTITIES.find((e) => e.id === k)?.name.replace("PE ", "")} ${v}`).join(", ")}</span> : <span className="text-xs">One counter, next {n.counters.ALL}</span>) },
              { id: "r", header: "Resets", value: (n) => checkFormat(inForce(n.versions, a.instances)?.value.format ?? "", 1).resets, filterable: true },
              { id: "nx", header: "Next version", value: (n) => nextOf(n.versions, a.instances)?.value.format ?? "", cell: (n) => { const x = nextOf(n.versions, a.instances); return x ? <span className="text-xs">{x.value.format}, next {x.value.next} from {fmtDate(x.effectiveFrom)} · <StateText tone="attention">{verState(x, n.versions, a.instances)}</StateText>{x.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${x.requestId}`}>{x.requestId}</Link></>}</span> : "" } },
              { id: "act", header: "", cell: (n) => <Button size="sm" variant="outline" disabled={verState(nextOf(n.versions, a.instances) ?? n.versions[0], n.versions, a.instances) === "Pending approval" && !!nextOf(n.versions, a.instances)} onClick={() => setEdit(n)}>Propose change</Button> },
            ]}
          />
        )}
        {section === "tester" && <Tester />}
        {section !== "tester" && <p className="max-w-3xl text-xs text-muted-foreground">Entity-aware means one counter per legal entity. Counters, the entity mapping and the next numbers are design values; formats and examples are the specification's. The 26th Book I series, Manufacturing BOM BOM-{"{TYPE}"}-{"{YYYY}"}-{"{SEQ:4}"}, is existing and unchanged, so it is not listed.</p>}
      </StateFrame>
      <RulesPanel
        rules={[
          ["§2.2", "These series extend the Number Series Configuration screen (INV 11.3); all are entity-aware where the companion accounting series are entity-aware", "DOC:p.17 Book I §2.2"],
          ["§2.3 (Book II)", "Material numbers are system-assigned from type-specific series; manual numbers are not permitted; the {GROUP} token is fixed at creation", "DOC:pp.138-139 Book II §2.3"],
          ["C-50", "A series change is a new dated version, never an in-place edit; the next number never goes down", "DOC:p.170 §18.2"],
          ["B§2", "Allocation is a pessimistic lock inside the posting transaction: gap-tolerant for performance except where finance requires gap-free", "DOC:p.185 Book III B §2.3"],
        ]}
      />
      <SeriesDialog series={edit} onClose={() => setEdit(null)} view={view} />
    </ConfigPage>
  )
}

function SeriesDialog({ series, onClose, view }: { series: NewSeries | null; onClose: () => void; view: View }) {
  const a = useSlice("admin")
  const cur = series ? inForce(series.versions, a.instances)?.value : undefined
  const [format, setFormat] = useState<string | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [from, setFrom] = useState(addDays(TODAY, 23))
  const f = format ?? cur?.format ?? ""
  const floor = series ? Math.max(...Object.values(series.counters)) : 0
  const n = next ?? String(floor)
  const chk = checkFormat(f, Number(n))
  return (
    <DialogShell
      wide
      open={!!series}
      onOpenChange={(o) => { if (!o) { setFormat(null); setNext(null); onClose() } }}
      title={`Propose change: ${series?.docType ?? ""} series`}
      consequence={series ? `Creates a new version (${f}, next ${n} from ${from}) and sends it to Plant IT in WF-INBOX. Numbers already issued and the format in force stay as they are.` : undefined}
      requireReason
      reasonLabel="Why it changes (required)"
      confirmLabel="Send for approval"
      onConfirm={(note) => view.run(() => proposeNewSeries(series!.id, f, Number(n), from, note))}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="ns-fmt" label="Format" hint="Tokens: {YYYY} {MM} {SEQ:n} {TYPE} {ENTITY} {GROUP:n} {FAMILY:n}"><Input id="ns-fmt" className="font-mono" value={f} onChange={(e) => setFormat(e.target.value)} /></Field>
        <Field id="ns-next" label="Next number" hint={`Not below ${floor}`}><Input id="ns-next" type="number" value={n} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field id="ns-from" label="Effective from"><Input id="ns-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      <dl className="grid gap-4 md:grid-cols-2">
        <KV k="Preview">{chk.ok ? <span className="font-mono">{chk.preview}</span> : <span className="text-destructive">{chk.error}</span>}</KV>
        <KV k="Counters now">{series && Object.entries(series.counters).map(([k, v]) => `${LEGAL_ENTITIES.find((e) => e.id === k)?.name ?? "All entities"}: ${v}`).join("; ")}</KV>
      </dl>
    </DialogShell>
  )
}

function Tester() {
  const [fmt, setFmt] = useState("PO-{YYYY}-{ENTITY}-{SEQ:5}")
  const [next, setNext] = useState("533")
  const chk = checkFormat(fmt, Number(next))
  return (
    <section aria-label="Format tester" className="flex max-w-2xl flex-col gap-4 rounded-lg border p-4">
      <p className="text-sm">Try a format before proposing it. The tester applies the same checks as the save.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="tt-fmt" label="Format"><Input id="tt-fmt" className="font-mono" value={fmt} onChange={(e) => setFmt(e.target.value)} /></Field>
        <Field id="tt-next" label="Next number"><Input id="tt-next" type="number" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
      {chk.ok ? <dl className="grid gap-4 md:grid-cols-2"><KV k="First number issued"><span className="font-mono text-lg">{chk.preview}</span></KV><KV k="Reset rule">{chk.resets}</KV></dl> : <p role="alert" className="text-sm text-destructive">{chk.error}</p>}
    </section>
  )
}
