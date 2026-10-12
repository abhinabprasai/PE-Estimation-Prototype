// CST-CE-001 Cost Estimates [DOC:p.270] (asserted); rules Book I I §3.1.
// Basis selector (released structures, draft structures, parametric model), itemized cost tree with
// source badges, comparison against standard and last actuals. Actions: Estimate, Release (makes it
// quotable), Supersede. A Released estimate locks its values (C-35).
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Calculator, CopyPlus, Plus, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { MaterialId } from "@/data/domain"
import { MATERIALS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { createEstimate, overrideCostItem, reEstimate, releaseEstimate, supersedeEstimate } from "../data/actions"
import { ceComponents, stdOf } from "../data/logic"
import type { CeRec } from "../data/types"
import { CsvButton, DocLink, Reading, report, Section, signCls, useDemoState } from "../components/common"
import { DetailFrame, ItemLink, SelectField, TextField, userName } from "../components/bits"

export function CeList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CST-CE-001")
  const [open, setOpen] = useState(false)
  const cols: Column<CeRec>[] = [
    { id: "id", header: "Estimate", value: (r) => r.id, mono: true, sortable: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[320px]">{r.title}</span> },
    { id: "item", header: "Item", value: (r) => r.itemId, filterable: true, cell: (r) => <ItemLink id={r.itemId} short /> },
    { id: "basis", header: "Basis", value: (r) => r.basis, filterable: true },
    { id: "ver", header: "Version", value: (r) => r.version, align: "right", mono: true },
    { id: "total", header: "Total cost", value: (r) => r.total, align: "right", mono: true, sortable: true, cell: (r) => fmtMoney(r.total) },
    { id: "quote", header: "Quotation", value: (r) => r.quotationId ?? "", cell: (r) => (r.quotationId ? <DocLink r={{ type: "quotation", id: r.quotationId }} /> : "") },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="costEstimate" status={r.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "CST-CE-001",
          title: "Cost estimates",
          description: "The cost basis under every firm ETO price. Only a Released estimate is quotable.",
          actions: (
            <>
              {st.menu}
              <CsvButton filename="cost-estimates.csv" rows={s.costEstimates.map((r) => ({ Estimate: r.id, Item: r.itemId, Basis: r.basis, Material: r.material, Labor: r.labor, Overhead: r.overhead, Subcontract: r.subcontract, Total: r.total, Status: r.status }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> New estimate
            </Button>
          ),
        }}
        table={{
          rows: st.empty ? [] : s.costEstimates,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/costing/estimates/${r.id}`,
          searchText: (r) => `${r.id} ${r.title} ${r.itemId} ${r.quotationId ?? ""}`,
          loading: st.loading,
          error: st.error,
          onRetry: st.retry,
          densityKey: "CST-CE-001",
          initialSort: { id: "id", dir: "desc" },
          empty: { title: "No cost estimates", body: "Quote lines for ETO and engineered items ask for an estimate; start one here." },
        }}
      />
      <NewCe open={open} onOpenChange={setOpen} />
    </>
  )
}

function NewCe({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const [f, setF] = useState({ itemId: "FIN-TBD-20MVA" as MaterialId, basis: "Parametric ETO model" as CeRec["basis"], title: "", quote: "" })
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="New cost estimate"
      confirmLabel="Create draft"
      consequence="Creates a Draft estimate from the chosen basis. Estimate, review the itemization, then release it to make it quotable."
      onConfirm={() => {
        const r = createEstimate(f.itemId, f.basis, f.title, f.quote || undefined)
        const e = report(r, (id) => `${id} created`)
        if (r.ok) nav(`/costing/estimates/${r.value}`)
        return e
      }}
    >
      <SelectField id="ce-item" label="Item" value={f.itemId} onChange={(v) => setF({ ...f, itemId: v as MaterialId })} options={MATERIALS.filter((m) => m.type === "FIN" || m.type === "SEMI").map((m) => ({ value: m.id, label: `${m.id} ${m.description}` }))} />
      <SelectField
        id="ce-basis"
        label="Basis"
        value={f.basis}
        onChange={(v) => setF({ ...f, basis: v })}
        options={(["Released MBOM + routing", "Draft EBOM", "Parametric ETO model"] as const).map((x) => ({ value: x, label: x }))}
        hint="Released structures, draft structures, or the parametric model when no design exists yet (Book I I §3.1)."
      />
      <TextField id="ce-title" label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <TextField id="ce-q" label="Quotation (optional)" value={f.quote} onChange={(v) => setF({ ...f, quote: v })} placeholder="QT-TBD-0000-V1" />
    </DialogShell>
  )
}

export function CeDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CST-CE-002")
  const c = s.costEstimates.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!c} title={id} screenId="CST-CE-001" back={{ label: "Cost estimates", to: "/costing/estimates" }}>
      {() => <CeBody c={c!} menu={st.menu} />}
    </DetailFrame>
  )
}

const SRC_VARIANT: Record<string, "default" | "secondary" | "outline"> = { Standard: "secondary", "AVL basis": "outline", "Manual override": "default", "Driver rate": "outline", "WC rate": "secondary" }

function CeBody({ c, menu }: { c: CeRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | "estimate" | "release" | "supersede" | number>(null)
  const [drivers, setDrivers] = useState(c.drivers ?? [])
  const [ov, setOv] = useState({ rate: "", note: "" })
  const draft = c.status === "Draft"
  const std = stdOf(s, c.itemId)
  const groups = useMemo(() => (["Material", "Labor", "Overhead", "Subcontract"] as const).map((k) => ({ k, items: c.items.map((it, i) => ({ it, i })).filter(({ it }) => it.component === k) })), [c])
  const predecessor = s.costEstimates.find((x) => x.supersededBy === c.id)
  const primary = draft ? (
    <Button onClick={() => setDlg("release")}>
      <Rocket aria-hidden="true" /> Release
    </Button>
  ) : c.status === "Released" && !c.supersededBy ? (
    <Button onClick={() => setDlg("supersede")}>
      <CopyPlus aria-hidden="true" /> Supersede
    </Button>
  ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "CST-CE-001",
          title: `${c.id} · ${c.title}`,
          crumbs: [{ label: "Cost estimates", to: "/costing/estimates" }],
          chips: (
            <>
              <span className="text-sm">Version {c.version}</span>
              {c.supersededBy && (
                <Chip kind="change" note="Successor version">
                  Successor {c.supersededBy}
                </Chip>
              )}
              {(c.supersededBy || predecessor) && <Reading id="OQ-PF-10" />}
            </>
          ),
          actions: (
            <>
              {menu}
              {draft && c.basis === "Parametric ETO model" && (
                <Button variant="outline" onClick={() => setDlg("estimate")}>
                  <Calculator aria-hidden="true" /> Estimate from drivers
                </Button>
              )}
              {c.supersededBy && (
                <Button variant="outline" onClick={() => nav(`/costing/estimates/${c.supersededBy}`)}>
                  Open successor
                </Button>
              )}
            </>
          ),
          primary,
        }}
        status={{ kind: "costEstimate", value: c.status }}
        doc={{ type: "costEstimate", id: c.id }}
        summary={
          <>
            <KV k="Item">
              <ItemLink id={c.itemId} />
            </KV>
            <KV k="Basis">{c.basis}</KV>
            <KV k="Total cost">
              <span className="tabular text-lg font-semibold">{fmtMoney(c.total)}</span>
            </KV>
            <KV k="Created / released">
              {fmtDate(c.createdOn)} {userName(c.createdBy)} / {c.releasedOn ? fmtDate(c.releasedOn) : "not released"}
            </KV>
            {ceComponents(c).map((x) => (
              <KV key={x.k} k={x.k}>
                <span className="tabular">
                  {fmtMoney(x.v)} <span className="text-xs text-muted-foreground">{c.total ? fmtPct((x.v / c.total) * 100) : ""}</span>
                </span>
              </KV>
            ))}
          </>
        }
        tabs={[
          {
            id: "tree",
            label: "Itemized cost",
            count: c.items.length,
            content: (
              <div className="flex flex-col gap-4">
                {c.drivers && (
                  <Section title="Parametric drivers">
                    <p className="text-sm">{c.drivers.map((d) => `${d.name} ${fmtNumber(d.qty)} ${d.unit}`).join(" · ")}</p>
                  </Section>
                )}
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Element</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => [
                      <TableRow key={g.k} className="h-8 bg-muted text-[13px] font-semibold">
                        <TableCell colSpan={4}>{g.k}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(g.items.reduce((t, x) => t + x.it.value, 0))}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>,
                      ...g.items.map(({ it, i }) => (
                        <TableRow key={i} className="h-8 text-[13px]">
                          <TableCell className="pl-6">
                            {it.text}
                            {it.note && <div className="text-xs text-muted-foreground">{it.note}</div>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{it.ref}</TableCell>
                          <TableCell className="tabular text-right">
                            {fmtNumber(it.qty)} {it.unit}
                          </TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(it.rate)}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(it.value)}</TableCell>
                          <TableCell>
                            <Badge variant={SRC_VARIANT[it.source] ?? "outline"}>{it.source}</Badge>
                          </TableCell>
                          <TableCell>
                            {draft && (
                              <Button size="sm" variant="ghost" onClick={() => (setOv({ rate: String(it.rate), note: it.note ?? "" }), setDlg(i))}>
                                Override
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )),
                    ])}
                  </TableBody>
                </Table>
              </div>
            ),
          },
          {
            id: "compare",
            label: "Comparison",
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>View</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Against this estimate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { k: "This estimate", v: c.total },
                    { k: "Current standard (material master)", v: std },
                    { k: "Last actual, settled WO of the same or similar design", v: c.lastActual },
                    ...(predecessor ? [{ k: `Previous version ${predecessor.id}`, v: predecessor.total }] : []),
                  ].map((x) => (
                    <TableRow key={x.k} className="h-8 text-[13px]">
                      <TableCell>{x.k}</TableCell>
                      <TableCell className="tabular text-right">{x.v != null ? fmtMoney(x.v) : "Not available"}</TableCell>
                      <TableCell className={`tabular text-right ${x.v != null ? signCls(x.v - c.total) : ""}`}>{x.v != null && x.k !== "This estimate" ? `${fmtMoney(x.v - c.total)} (${fmtPct(((x.v - c.total) / c.total) * 100)})` : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["I §3.1", "Parametric: driver quantities × maintained driver rates when no design exists yet", "[DOC:p.119 §3.1]"],
              ["I §3.1", "A manual override needs a note and shows a source badge", "[DOC:p.119 §3.1]"],
              ["C-35", "Release makes the estimate quotable and locks its values", "erd §4"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg === "estimate"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Estimate from drivers"
        confirmLabel="Re-estimate"
        consequence="Recomputes the driven material quantities × driver rates and the totals. The draft stays a draft."
        onConfirm={() => report(reEstimate(c.id, drivers), "Re-estimated")}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {drivers.map((d, i) => (
            <TextField key={d.name} id={`drv-${i}`} label={`${d.name} (${d.unit})`} value={String(d.qty)} onChange={(v) => setDrivers(drivers.map((x, j) => (j === i ? { ...x, qty: Number(v) || 0 } : x)))} />
          ))}
        </div>
      </DialogShell>
      <DialogShell open={dlg === "release"} onOpenChange={(o) => !o && setDlg(null)} title={`Release ${c.id}`} confirmLabel="Release" consequence={`Makes ${c.id} quotable at ${fmtMoney(c.total)} and locks its values (C-35).${predecessor ? ` ${predecessor.id} becomes Superseded.` : ""}`} onConfirm={() => report(releaseEstimate(c.id), `${c.id} released`)} />
      <DialogShell
        open={dlg === "supersede"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Supersede ${c.id}`}
        confirmLabel="Create successor"
        consequence={`Creates version ${c.version + 1} as a Draft copy. ${c.id} stays Released and quotable until the successor is released.`}
        onConfirm={() => {
          const r = supersedeEstimate(c.id)
          const e = report(r, (n) => `${n} created`)
          if (r.ok) nav(`/costing/estimates/${r.value}`)
          return e
        }}
      >
        <Reading id="OQ-PF-10" />
      </DialogShell>
      <DialogShell
        open={typeof dlg === "number"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={typeof dlg === "number" ? `Override: ${c.items[dlg]?.text}` : "Override"}
        confirmLabel="Apply override"
        consequence="Replaces the rate on this element; the source badge becomes Manual override and the note is kept."
        onConfirm={() => (typeof dlg === "number" ? report(overrideCostItem(c.id, dlg, Number(ov.rate), ov.note), "Override applied") : null)}
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm" htmlFor="ov-rate">
            Rate
          </label>
          <Input id="ov-rate" value={ov.rate} onChange={(e) => setOv({ ...ov, rate: e.target.value })} />
          <TextField id="ov-note" label="Note (required)" value={ov.note} onChange={(v) => setOv({ ...ov, note: v })} />
        </div>
      </DialogShell>
    </>
  )
}
