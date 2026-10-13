// FX-QM-INVALIGN Inventory quality screens alignment: stock status moves per gate
// [DOC:p.84 Part E §1 gates; Book II stock statuses; FL-03] (asserted).
// One place that shows what quality does to stock: QI Hold clears by an inspection decision, Blocked
// and Quarantine are quality blocks, release is a Quality Manager act. The gate table states the
// move each gate makes on pass and on fail; the ledger lists every move with its source (README QT-R34).

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { WorkbenchPage, DialogShell } from "@/components/templates"
import { Chip, KV, RulesPanel, StatusBadge, type Column, type DataTableProps } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { useRole, useSlice } from "@/store"
import { stockX } from "../data/extra-actions"
import type { StockMove } from "../data/extra-types"
import { GATES, type QtBatch } from "../data/types"
import { DocLinkText, Pick, Reading, materialText, report, userName, vendorName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["SS-1", "Incoming stock of a QI-required item posts to QI Hold; the IQC decision moves it to Unrestricted (accepted) or Blocked (rejected).", "DOC:p.84 Part E §1; Book II"],
  ["SS-2", "Blocked and Quarantine stock cannot be issued, picked or shipped; Unrestricted stock can.", "DOC:Book II stock statuses"],
  ["SS-3", "A recall mass hold blocks all on-hand affected stock in one action; released from the campaign, not from here.", "DOC:p.182 FL-08"],
  ["SS-4", "A quality block is a Quality engineer or Quality Manager act; release to Unrestricted is a Quality Manager act and needs a reason.", "README QT-R34"],
  ["SS-5", "QI Hold clears only by an inspection decision. There is no manual QI Hold release.", "DOC:p.84 Part E §1"],
]

type Q = "hold" | "blocked" | "quarantine" | "unrestricted" | "moves"

export function StockStatusMoves() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-INVALIGN")
  const [role] = useRole()
  const [q, setQ] = useState<Q>("hold")
  const [activeId, setActive] = useState<string | null>(null)
  const [dlg, setDlg] = useState<"Unrestricted" | "Blocked" | "Quarantine" | null>(null)
  const active = s.batches.find((b) => b.id === activeId)
  const stockQ: Record<Exclude<Q, "moves">, QtBatch["stock"]> = { hold: "QI Hold", blocked: "Blocked", quarantine: "Quarantine", unrestricted: "Unrestricted" }
  const count = (st: QtBatch["stock"]) => s.batches.filter((b) => b.stock === st).length
  const rows = s.batches.filter((b) => q !== "moves" && b.stock === stockQ[q])
  const recallOf = (id: string) => s.recalls.find((r) => r.stage !== "Closed" && r.suspect.batches.includes(id as never))
  const openLot = (id: string) => s.lots.find((l) => l.batchId === id && !l.decision)
  const cols: Column<QtBatch>[] = [
    { id: "id", header: "Batch", value: (b) => b.id, mono: true, sortable: true },
    { id: "mat", header: "Material", value: (b) => b.materialId, cell: (b) => <span title={materialText(b.materialId)}>{b.materialId}</span> },
    { id: "vendor", header: "Vendor batch", value: (b) => b.vendorBatch ?? "", mono: true },
    { id: "vend", header: "Vendor", value: (b) => vendorName(b.vendorId), filterable: true },
    { id: "qty", header: "Qty", value: (b) => b.qtyReceived, align: "right", mono: true },
    { id: "stock", header: "Stock status", value: (b) => b.stock, cell: (b) => <StatusBadge kind="stock" status={b.stock} size="sm" /> },
    { id: "why", header: "Why", value: (b) => (recallOf(b.id)?.id ?? openLot(b.id)?.id ?? ""), cell: (b) => (recallOf(b.id) ? <span>Recall {recallOf(b.id)!.id}</span> : openLot(b.id) ? <span>Inspection {openLot(b.id)!.id}</span> : <span className="text-muted-foreground">Quality block</span>) },
    { id: "since", header: "Last move", value: (b) => s.stockMoves.find((m) => m.batchId === b.id)?.at ?? "", mono: true },
  ]
  const moveCols: Column<StockMove>[] = [
    { id: "at", header: "Date", value: (m) => m.at, mono: true, sortable: true },
    { id: "subj", header: "Batch / serial", value: (m) => m.batchId ?? m.serial ?? "", mono: true },
    { id: "from", header: "From", value: (m) => m.from, filterable: true },
    { id: "to", header: "To", value: (m) => m.to, filterable: true },
    { id: "gate", header: "Gate", value: (m) => m.gate, filterable: true },
    { id: "src", header: "Source", value: (m) => m.source, mono: true },
    { id: "reason", header: "Reason", value: (m) => m.reason },
    { id: "by", header: "By", value: (m) => (m.by === "System" ? "System" : userName(m.by)) },
  ]
  const canBlock = role === "Quality engineer" || role === "Quality Manager"
  return (
    <>
      <StateFrame
        ss={ss}
        title="Stock status moves"
        screenId="FX-QM-INVALIGN"
        entity="stock status moves"
        allowed="Quality engineer or Quality Manager"
        validation={["A stock status move needs a reason.", "Choose Blocked or Quarantine."]}
        conflict={{ what: "batch BAT-TBD-K0921", mine: "Move to Blocked", theirs: "Warehouse issued 40 kg against it at 10:05" }}
        degraded="Stock quantities come from Inventory and may be a few minutes old; status moves still apply at once."
      >
        <WorkbenchPage
          header={{
            title: "Stock status moves",
            screenId: "FX-QM-INVALIGN",
            crumbs: [{ label: "Quality" }, { label: "Stock status" }],
            description: "What each gate does to stock, and the batches quality is holding. QI Hold clears by an inspection; Blocked and Quarantine are quality blocks; release is a Quality Manager act.",
            chips: <Reading id="QT-R34" />,
            actions: (
              <Button variant="outline" asChild>
                <Link to="/quality/inspections">Inspection queues</Link>
              </Button>
            ),
          }}
          kpis={[
            { label: "On QI Hold", value: count("QI Hold"), hint: "Waiting for an inspection decision" },
            { label: "Blocked", value: count("Blocked") },
            { label: "Quarantine", value: count("Quarantine") },
            { label: "Moves this month", value: s.stockMoves.filter((m) => m.at.slice(0, 7) === TODAY.slice(0, 7)).length },
          ]}
          queues={[
            { id: "hold", label: "QI Hold", count: count("QI Hold") },
            { id: "blocked", label: "Blocked", count: count("Blocked") },
            { id: "quarantine", label: "Quarantine", count: count("Quarantine") },
            { id: "unrestricted", label: "Unrestricted", count: count("Unrestricted") },
            { id: "moves", label: "Move ledger", count: s.stockMoves.length },
          ]}
          queue={q}
          onQueueChange={(v) => setQ(v as Q)}
          table={
            q === "moves"
              ? ({ rows: s.stockMoves, columns: moveCols, rowId: (m: StockMove) => m.id, densityKey: "QM-SMV", initialSort: { id: "at", dir: "desc" }, empty: { title: "No moves" } } as unknown as DataTableProps<QtBatch>)
              : {
                  rows,
                  columns: cols,
                  rowId: (b) => b.id,
                  activeId: activeId ?? undefined,
                  onRowClick: (b) => setActive(b.id),
                  densityKey: "QM-STK",
                  searchText: (b) => `${b.id} ${b.materialId} ${b.vendorBatch ?? ""} ${vendorName(b.vendorId)}`,
                  searchPlaceholder: "Search batch, material, vendor batch",
                  empty: { title: `Nothing on ${stockQ[q]}`, body: "Batches appear here as gates and quality blocks move them." },
                }
          }
          panel={{
            open: !!active,
            onOpenChange: (o) => !o && setActive(null),
            title: active ? active.id : "",
            description: active ? materialText(active.materialId) : undefined,
            content: active ? (
              <div className="flex flex-col gap-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <KV k="Stock status"><StatusBadge kind="stock" status={active.stock} /></KV>
                  <KV k="Quantity">{active.qtyReceived}</KV>
                  <KV k="Vendor">{vendorName(active.vendorId) || "Own production"}</KV>
                  <KV k="Trace"><DocLinkText r={{ type: "batch", id: active.id }} /></KV>
                </dl>
                {recallOf(active.id) && <p>Held by recall <Link className="text-link underline-offset-4 hover:underline" to={`/quality/recalls/${recallOf(active.id)!.id}`}>{recallOf(active.id)!.id}</Link>. Release it from the campaign.</p>}
                {openLot(active.id) && <p>Waiting for inspection <Link className="text-link underline-offset-4 hover:underline" to={`/quality/inspections/${openLot(active.id)!.id}`}>{openLot(active.id)!.id}</Link>. QI Hold clears only by that decision.</p>}
                <div className="flex flex-wrap gap-2">
                  {(active.stock === "Unrestricted" || active.stock === "Blocked" || active.stock === "Quarantine") && (
                    <>
                      {active.stock !== "Blocked" && active.stock === "Unrestricted" && (
                        <Button disabled={ss.locked || !canBlock} onClick={() => setDlg("Blocked")}>Block stock</Button>
                      )}
                      {active.stock === "Unrestricted" && (
                        <Button variant="outline" disabled={ss.locked || !canBlock} onClick={() => setDlg("Quarantine")}>Quarantine</Button>
                      )}
                      {active.stock !== "Unrestricted" && (
                        <Button disabled={ss.locked || role !== "Quality Manager"} onClick={() => setDlg("Unrestricted")}>Release to Unrestricted</Button>
                      )}
                      {active.stock === "Blocked" && (
                        <Button variant="outline" disabled={ss.locked || !canBlock} onClick={() => setDlg("Quarantine")}>Move to Quarantine</Button>
                      )}
                      {active.stock === "Quarantine" && (
                        <Button variant="outline" disabled={ss.locked || !canBlock} onClick={() => setDlg("Blocked")}>Move to Blocked</Button>
                      )}
                    </>
                  )}
                </div>
                {!canBlock && <p className="text-xs text-muted-foreground">Quality blocks are for the Quality engineer or Quality Manager; you are acting as {role}.</p>}
                <h3 className="text-sm font-semibold">Moves of this batch</h3>
                <ul className="flex flex-col gap-1">
                  {s.stockMoves.filter((m) => m.batchId === active.id).map((m) => (
                    <li key={m.id}>{m.at}: {m.from} → {m.to} ({m.gate}, {m.source}). {m.reason}</li>
                  ))}
                  {s.stockMoves.every((m) => m.batchId !== active.id) && <li className="text-muted-foreground">No recorded moves.</li>}
                </ul>
              </div>
            ) : null,
          }}
        />
        <div className="mt-6 flex flex-col gap-4">
          <section aria-labelledby="gate-moves" className="flex flex-col gap-2">
            <h2 id="gate-moves" className="text-base font-semibold">Stock status per gate</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left">
                  <tr><th className="p-2">Gate</th><th className="p-2">Trigger</th><th className="p-2">On pass</th><th className="p-2">On fail</th></tr>
                </thead>
                <tbody>
                  {GATES.map((g) => (
                    <tr key={g.gate} className="border-t">
                      <td className="p-2 font-medium">{g.label}</td>
                      <td className="p-2">{g.trigger}</td>
                      <td className="p-2">{g.pass}</td>
                      <td className="p-2">{g.fail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Serials follow the same idea: a returned unit is held at QI Hold until its return inspection (RQC) decides the disposition.</p>
          </section>
          <RulesPanel rules={RULES} />
        </div>
      </StateFrame>
      {active && dlg && <MoveDialog key={`${active.id}${dlg}`} batch={active} to={dlg} onClose={() => setDlg(null)} />}
    </>
  )
}

function MoveDialog({ batch, to, onClose }: { batch: QtBatch; to: "Unrestricted" | "Blocked" | "Quarantine"; onClose: () => void }) {
  const [t, setT] = useState(to)
  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${to === "Unrestricted" ? "Release" : "Move"} ${batch.id}`}
      consequence={`Moves ${batch.id} from ${batch.stock} to ${t}${t === "Unrestricted" ? ": the stock can be issued and picked again" : ": the stock cannot be issued, picked or shipped"}. The move is logged with your reason and Inventory is told.`}
      confirmLabel={t === "Unrestricted" ? "Release stock" : `Move to ${t}`}
      destructive={t !== "Unrestricted"}
      requireReason
      onConfirm={(reason) => {
        const r = stockX.move(batch.id, t, reason)
        return report(r, `${batch.id} is now ${t}`) ? null : (r as { error: string }).error
      }}
    >
      {to !== "Unrestricted" && <Pick id="mv-to" label="Move to" value={t} onChange={(v) => setT(v as typeof t)} options={["Blocked", "Quarantine"].filter((x) => x !== batch.stock)} />}
      {batch.stock === "Blocked" && to !== "Unrestricted" && <Chip kind="design">Blocked to Quarantine keeps the stock held</Chip>}
    </DialogShell>
  )
}
