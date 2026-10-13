// FX-PRC-FLOORS Margin floors and floor-breach approval (/pricing/margin-floors); source Book I I §6.3 [DOC:p.122]:
// product line (PC) floor from the annual plan (PC-100 22%, PC-300 18%), optional stricter item override, quote / SO / price
// rows below floor route Pricing Manager -> Sales Director -> (below floor minus 5 points) CFO, every approval stores a
// justification, and a breach register is reported monthly. PC-200 and PC-400 state no floor (OQ-PF-11). The approval itself is
// the shared engine (ApprovalButton "Below price floor", C-1). Route and archetype are design values.
import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApprovalButton, Chip, EmptyState } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import type { MaterialId } from "@/data/domain"
import { MATERIALS, PROFIT_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { itemText, stdOf } from "../data/logic"
import { breachRoute, effectiveFloor, marginOf } from "../data/xlogic"
import { registerBreach, removeItemFloor, setItemFloor, updateBreachJustification } from "../data/xactions"
import type { FloorBreach } from "../data/xtypes"
import { CsvButton, Design, Reading, report, Section } from "../components/common"
import { customerName, ItemLink, RecLink, SelectField, SkeletonTable, TextField, userName } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"

const SECTIONS = [{ id: "floors", label: "Floors" }, { id: "check", label: "Floor check" }, { id: "register", label: "Breach register" }]
const SELLABLE = MATERIALS.filter((m) => ["FIN", "TRADE", "SPARE"].includes(m.type) && m.status === "Active")
const stBadge = (b: FloorBreach) => (b.status === "Pending" ? <Chip kind="flag">Pending</Chip> : <span className={b.status === "Approved" ? "font-medium text-status-passed-ink" : "font-medium text-status-cancelled-ink"}>{b.status}</span>)

export function MarginFloors() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PRC-FLOORS", { writers: "the Pricing Manager sets item floors; approvals go through WF-INBOX", degraded: "Standard costs come from the costing service, which answered slowly: margins may use last week's standard." })
  const [section, setSection] = useState("floors")
  const [dlg, setDlg] = useState<null | "item" | { just: FloorBreach }>(null)
  const [fl, setFl] = useState({ itemId: "" as MaterialId | "", pct: "", note: "" })
  const [just, setJust] = useState("")
  const [sim, setSim] = useState({ itemId: "" as MaterialId | "", price: "", source: "Quote" as "Quote" | "Sales order" | "Price list row" | "Agreement row", ref: "", just: "" })
  const [month, setMonth] = useState("all")

  const months = [...new Set(s.floorBreaches.map((b) => b.on.slice(0, 7)))].sort().reverse()
  const regRows = s.floorBreaches.filter((b) => month === "all" || b.on.startsWith(month))
  const simItem = sim.itemId ? (sim.itemId as string) : ""
  const cost = simItem ? stdOf(s, simItem) : undefined
  const floor = simItem ? effectiveFloor(s, simItem) : undefined
  const price = Number(sim.price)
  const margin = cost != null && price > 0 ? marginOf(price, cost) : undefined
  const below = floor?.pct != null && margin != null && margin < floor.pct
  const points = below ? Math.round((floor!.pct! - margin!) * 10) / 10 : 0
  const pcRows = useMemo(
    () => [...PROFIT_CENTERS, ...s.addedProfitCenters.map((p) => ({ id: p.id, name: p.name, scope: p.scope, status: p.status, priceFloorPct: p.priceFloorPct }))].filter((p) => p.status === "Active"),
    [s.addedProfitCenters],
  )

  const floorsView = (
    <div className="flex flex-col gap-6">
      <Section title="Product line floors (annual plan)" action={<Reading id="OQ-PF-11" />}>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Profit center</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Floor</TableHead>
              <TableHead>Breach route</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pcRows.map((p) => (
              <TableRow key={p.id} className="h-8 text-[13px]">
                <TableCell><RecLink to={`/controlling/profit-centers/${p.id}`}>{p.id}</RecLink> {p.name}</TableCell>
                <TableCell>{p.scope}</TableCell>
                <TableCell className="tabular text-right">{p.priceFloorPct != null ? `${p.priceFloorPct}%` : <span className="text-muted-foreground">None stated</span>}</TableCell>
                <TableCell>{p.priceFloorPct != null ? "Pricing Manager, Sales Director, and the CFO when more than 5 points below" : "No floor: no breach"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">The annual plan sets these; they change through the profit center master (CFO approves, <RecLink to="/controlling/profit-centers">Profit centers</RecLink>).</p>
      </Section>
      <Section
        title={`Item overrides (${s.itemFloors.length})`}
        action={<Button size="sm" variant="outline" {...writeProps(st)} onClick={() => { setFl({ itemId: "", pct: "", note: "" }); setDlg("item") }}><Plus aria-hidden="true" /> Set item floor</Button>}
      >
        {s.itemFloors.length ? (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Item floor</TableHead>
                <TableHead>Profit center floor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Set</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.itemFloors.map((f) => {
                const pc = PROFIT_CENTERS.find((p) => p.id === effectiveFloor(s, f.itemId).pc)
                return (
                  <TableRow key={f.itemId} className="h-8 text-[13px]">
                    <TableCell><ItemLink id={f.itemId} /></TableCell>
                    <TableCell className="tabular text-right font-medium">{f.floorPct}%</TableCell>
                    <TableCell>{pc?.priceFloorPct != null ? `${pc.id} ${pc.priceFloorPct}%` : `${pc?.id ?? ""} none stated`}</TableCell>
                    <TableCell>{f.note}</TableCell>
                    <TableCell>{fmtDate(f.on)} · {userName(f.setBy)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" aria-label={`Remove floor of ${f.itemId}`} {...writeProps(st)} onClick={() => report(removeItemFloor(f.itemId), "Item floor removed")}><Trash2 aria-hidden="true" /></Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No item overrides">An item floor is optional and must be stricter than its profit center's.</EmptyState>
        )}
      </Section>
    </div>
  )

  const check = (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">Test a price against the floor, then register the breach so it can go for approval. The floor check also runs on price list rows, agreement rows, quotes and sales order lines.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectField id="fc-i" label="Item" value={sim.itemId} onChange={(v) => setSim({ ...sim, itemId: v })} options={SELLABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 34)}` }))} />
        <TextField id="fc-p" type="number" label="Net price (USD, after surcharge and freight)" value={sim.price} onChange={(v) => setSim({ ...sim, price: v })} />
        <SelectField id="fc-s" label="Source" value={sim.source} onChange={(v) => setSim({ ...sim, source: v })} options={(["Quote", "Sales order", "Price list row", "Agreement row"] as const).map((x) => ({ value: x, label: x }))} />
        <TextField id="fc-r" label="Reference (quote, order or row)" value={sim.ref} onChange={(v) => setSim({ ...sim, ref: v })} />
        <div className="sm:col-span-2"><TextField id="fc-j" label="Justification (stored with the approval)" value={sim.just} onChange={(v) => setSim({ ...sim, just: v })} /></div>
      </div>
      {simItem && (
        <div role="status" className="rounded-md border px-4 py-3 text-sm">
          <p>{itemText(simItem)}: standard cost {cost != null ? fmtMoney(cost) : "none"}; floor {floor?.pct != null ? `${floor.pct}% (${floor.level})` : "none stated"}.</p>
          {margin != null && <p className="font-medium">Margin {fmtPct(margin)} {floor?.pct == null ? "(no floor to breach)" : below ? `: ${points} points below the floor. Route: ${breachRoute(points).join(" then ")}.` : ": meets the floor."}</p>}
        </div>
      )}
      <div>
        <Button disabled={!below || !!st.blockReason} title={st.blockReason ?? (below ? undefined : "Only a price below the floor is registered")} onClick={() => report(registerBreach({ source: sim.source, ref: sim.ref, itemId: sim.itemId as MaterialId, price, cost: cost ?? 0, justification: sim.just }), (id) => { setSection("register"); return `${id} registered` })}>
          Register breach
        </Button>
      </div>
      {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a justification and a reference are required before the request goes.</p>}
    </div>
  )

  const register = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="w-48"><SelectField id="rg-m" label="Month" value={month} onChange={setMonth} options={[{ value: "all", label: "All months" }, ...months.map((x) => ({ value: x, label: x }))]} /></div>
        <CsvButton filename={`floor-breach-register-${month}.csv`} rows={regRows.map((b) => ({ Breach: b.id, Date: b.on, Source: b.source, Ref: b.ref, Item: b.itemId, Price: b.price, Cost: b.cost, MarginPct: b.marginPct, FloorPct: b.floorPct, PointsBelow: b.points, Route: b.route.join(" > "), Status: b.status, Justification: b.justification }))} label="Monthly report" />
      </div>
      {regRows.length ? (
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Breach</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Margin / floor</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Justification</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {regRows.map((b) => (
              <TableRow key={b.id} className="h-10 align-top text-[13px]">
                <TableCell><span className="font-mono">{b.id}</span><div className="text-xs text-muted-foreground">{fmtDate(b.on)}</div></TableCell>
                <TableCell>{b.source} {b.ref}<div className="text-xs text-muted-foreground">{b.customerId ? customerName(b.customerId) : ""}</div></TableCell>
                <TableCell><ItemLink id={b.itemId} short /></TableCell>
                <TableCell className="tabular text-right">{fmtPct(b.marginPct)} / {b.floorPct}%<div className="text-xs text-muted-foreground">{b.points} points below</div></TableCell>
                <TableCell>{b.route.join(" → ")}</TableCell>
                <TableCell className="max-w-[260px]">{b.justification}{b.approvedBy && <div className="text-xs text-muted-foreground">{b.approvedBy}</div>}</TableCell>
                <TableCell>{stBadge(b)}</TableCell>
                <TableCell className="flex flex-col gap-1">
                  {b.status === "Pending" && (
                    <>
                      <ApprovalButton kind="Below price floor" subject={{ type: "approval", id: `${b.id}:floor` }} title={`${b.id} ${b.source} ${b.ref}: ${b.points} points below floor. ${b.justification}`} ctx={{ pointsBelowFloor: b.points }} stay disabled={!!st.blockReason} disabledReason={st.blockReason ?? undefined} />
                      <Button size="sm" variant="ghost" {...writeProps(st)} onClick={() => { setJust(b.justification); setDlg({ just: b }) }}>Edit justification</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState title="No breaches in this month">A quote, order line or price row below its floor appears here with its route and justification.</EmptyState>
      )}
    </div>
  )

  return (
    <>
      <ConfigPage
        header={{
          screenId: "FX-PRC-FLOORS",
          title: "Margin floors and floor-breach approval",
          description: "Where the product line and item floors sit, what happens below them, and the register that shows every breach.",
          chips: (
            <>
              <Design note="Route and archetype are design values; floors and chain are Book I I §6.3" />
              <Chip kind="design" note="Approval happens in WF-INBOX (C-1)">Approval: WF-INBOX</Chip>
            </>
          ),
          actions: st.menu,
          children: st.banner,
        }}
        sections={SECTIONS}
        section={section}
        onSectionChange={setSection}
      >
        {st.loading ? <SkeletonTable cols={6} rows={6} /> : st.empty ? <EmptyState title="No floors or breaches">Floors come from the annual plan; the register fills as prices fall below them.</EmptyState> : section === "floors" ? floorsView : section === "check" ? check : register}
      </ConfigPage>
      <DialogShell
        open={dlg === "item"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Set an item floor"
        confirmLabel="Save floor"
        consequence="Applies a stricter floor to this item from today; breaches of it follow the same chain. Pricing Manager only."
        onConfirm={() => st.guard() ?? report(setItemFloor(fl.itemId, Number(fl.pct), fl.note), "Item floor saved")}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="if-i" label="Item" value={fl.itemId} onChange={(v) => setFl({ ...fl, itemId: v })} options={SELLABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 30)}` }))} />
          <TextField id="if-p" type="number" label="Floor %" value={fl.pct} onChange={(v) => setFl({ ...fl, pct: v })} />
          <div className="sm:col-span-2"><TextField id="if-n" label="Reason for the stricter floor" value={fl.note} onChange={(v) => setFl({ ...fl, note: v })} /></div>
        </div>
      </DialogShell>
      <DialogShell
        open={!!dlg && typeof dlg === "object"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={dlg && typeof dlg === "object" ? `Justification for ${dlg.just.id}` : ""}
        confirmLabel="Save"
        consequence="The justification travels with the approval request and stays on the register."
        onConfirm={() => (dlg && typeof dlg === "object" ? st.guard() ?? report(updateBreachJustification(dlg.just.id, just), "Justification saved") : null)}
      >
        <TextField id="bj" label="Justification" value={just} onChange={setJust} />
      </DialogShell>
    </>
  )
}
