// MM-SL-001 Source Lists [DOC:p.247] (asserted); rules Book II §7.4, determination order §7.5.
// Per-material grid of vendor rows with validity, Fixed, Blocked and MRP relevance. Actions: Add row,
// Fix source for period, Block source. The determination preview applies the binding §7.5 order.
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPage, DialogShell } from "@/components/templates"
import { Chip, DataTable, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { AVL, TODAY, vendorById } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { getMaterial, R } from "../data/state"
import { ACTIVE_VENDORS, addSourceRow, blockSource, currentPrice, fixSource, irStatus, toggleMrpRelevant } from "../data/actions"
import type { SourceListRecord } from "../data/types"
import { DocLinkText, IrStatusBadge, MatLink, MaterialStatus, Section, useListState } from "../components/common"
import { confirmRun, run } from "../components/run"

const validToday = (r: { validFrom: string; validTo?: string }) => r.validFrom <= TODAY && (!r.validTo || r.validTo >= TODAY)

export function SourceLists() {
  const s = useSlice("materials")
  const [sp, setSp] = useSearchParams()
  const st = useListState("MM-SL-001")
  const candidates = useMemo(() => [...new Set([...s.sourceList.map((r) => r.materialId), ...s.infoRecords.map((r) => r.materialId)])].sort(), [s])
  const material = sp.get("material") ?? "RAW-TBD-OLTC"
  const m = getMaterial(s, material)
  const v = s.views[material]
  const rows = st.empty ? [] : s.sourceList.filter((r) => r.materialId === material)
  const [dlg, setDlg] = useState<null | "add" | { block: SourceListRecord }>(null)
  const [ven, setVen] = useState("")
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState("2026-12-31")
  const [mrp, setMrp] = useState(true)

  const irFor = (vendorId: string) => s.infoRecords.find((x) => x.materialId === material && x.vendorId === vendorId)
  // §7.5 binding order
  const policy = v?.sourcePolicy ?? "AVL Rank"
  const fixed = rows.find((r) => r.fixed && !r.blocked && r.mrpRelevant && validToday(r))
  const blockedV = new Set(rows.filter((r) => r.blocked && validToday(r)).map((r) => r.vendorId))
  const avlRanked = AVL.filter((a) => a.itemId === material && a.status !== "Suspended" && !blockedV.has(a.vendorId)).sort((a, b) => a.rank - b.rank)
  const eligible = avlRanked.filter((a) => {
    const ir = irFor(a.vendorId)
    return ir && irStatus(s, ir.id, TODAY) === "Active"
  })
  const determination =
    policy === "Source List Fixed" && fixed
      ? { vendor: fixed.vendorId, why: "Source list: Fixed vendor for the period (policy Source List Fixed, MRP relevant)" }
      : eligible[0]
        ? { vendor: eligible[0].vendorId, why: `AVL rank ${eligible[0].rank} with an Active info record${eligible[0].rank === 1 ? "" : " (next by rank)"}` }
        : fixed
          ? { vendor: fixed.vendorId, why: "Fixed source list row (no AVL entry for this material)" }
          : undefined

  const cols: Column<SourceListRecord>[] = [
    { id: "vendor", header: "Vendor", value: (r) => r.vendorId, cell: (r) => `${r.vendorId} ${vendorById(r.vendorId)?.name ?? ""}` },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, sortable: true, cell: (r) => `${fmtDate(r.validFrom)} to ${r.validTo ? fmtDate(r.validTo) : "open"}` },
    { id: "fixed", header: "Fixed", value: (r) => (r.fixed ? "Fixed" : ""), cell: (r) => (r.fixed ? <Chip kind="design" note="The one Fixed source of the period (V-MM-34)">Fixed</Chip> : "") },
    { id: "blocked", header: "Blocked", value: (r) => (r.blocked ? "Blocked" : ""), cell: (r) => (r.blocked ? <Chip kind="block" note={r.note}>Blocked source</Chip> : "") },
    {
      id: "mrp",
      header: "MRP relevant",
      value: (r) => (r.mrpRelevant ? "Yes" : "No"),
      cell: (r) => <Switch checked={r.mrpRelevant} onCheckedChange={() => run(toggleMrpRelevant(r.id), "MRP relevance changed")} aria-label={`MRP relevant ${r.vendorId}`} />,
    },
    {
      id: "ir",
      header: "Info record",
      value: (r) => irFor(r.vendorId)?.id ?? "",
      cell: (r) => {
        const ir = irFor(r.vendorId)
        return ir ? (
          <span className="flex items-center gap-1">
            <DocLinkText to={R.ir(ir.id)}>{ir.id}</DocLinkText> <IrStatusBadge status={irStatus(s, ir.id, TODAY)} />
          </span>
        ) : (
          <span className="text-destructive">None (V-MM-33)</span>
        )
      },
    },
    {
      id: "avl",
      header: "AVL",
      value: (r) => AVL.find((a) => a.itemId === material && a.vendorId === r.vendorId)?.status ?? "",
      cell: (r) => {
        const a = AVL.find((x) => x.itemId === material && x.vendorId === r.vendorId)
        return a ? (
          <span className="flex items-center gap-1">
            rank {a.rank} <StatusBadge kind="avl" status={a.status} size="sm" />
          </span>
        ) : (
          "No AVL row"
        )
      },
    },
    { id: "note", header: "Note", value: (r) => r.note ?? "" },
    {
      id: "act",
      header: "Actions",
      cell: (r) => (
        <span className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={r.blocked} onClick={() => run(fixSource(r.id), (cleared) => (r.fixed ? "Fixed flag removed" : `Fixed for the period${cleared.length ? `; ${cleared.join(", ")} unfixed` : ""}`))}>
            {r.fixed ? "Unfix" : "Fix for period"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (r.blocked ? run(blockSource(r.id, ""), "Block removed") : setDlg({ block: r }))}>
            {r.blocked ? "Unblock" : "Block source"}
          </Button>
        </span>
      ),
    },
  ]
  return (
    <>
      <DetailPage
        key={material}
        header={{
          screenId: "MM-SL-001",
          title: `Source list ${material}`,
          description: "Period-based declaration of valid supply sources; the governance layer MRP and buyers obey.",
          crumbs: [{ label: "Source lists" }, { label: material }],
          primary: (
            <Button onClick={() => (setVen(""), setDlg("add"))}>
              <Plus aria-hidden="true" /> Add row
            </Button>
          ),
          actions: (
            <Select value={material} onValueChange={(x) => setSp({ material: x })}>
              <SelectTrigger className="w-72" aria-label="Material">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id} {getMaterial(s, id)?.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
        }}
        status={m ? { kind: "material", value: m.status } : undefined}
        doc={{ type: "material", id: material }}
        summary={
          <>
            <KV k="Material">
              <MatLink id={material} /> {m && <MaterialStatus m={m} />}
            </KV>
            <KV k="Source determination policy">{policy}</KV>
            <KV k="Vendor qualification required">{v?.vendorQualReq ? "Yes" : "No"}</KV>
            <KV k="Source today (§7.5)">{determination ? <span className="font-mono">{determination.vendor}</span> : <span className="text-destructive">None: PR flagged EX-09</span>}</KV>
          </>
        }
        tabs={[
          {
            id: "grid",
            label: "Vendor rows",
            count: rows.length,
            content: (
              <div className="flex flex-col gap-4">
                <DataTable
                  densityKey="MM-SL-001"
                  rows={rows}
                  columns={cols}
                  rowId={(r) => r.id}
                  loading={st.loading}
                  error={st.error}
                  onRetry={st.onRetry}
                  toolbar={st.toolbar}
                  empty={{ title: `No source list rows for ${material}`, body: "Without rows the policy falls back to AVL rank with an Active info record." }}
                />
                <Section title="Source determination today (binding order, Book II §7.5)">
                  <ol className="list-decimal pl-4 text-sm">
                    <li>Source list Fixed vendor for the period, when policy is Source List Fixed and the row is MRP relevant: {fixed ? fixed.vendorId : "none"}.</li>
                    <li>AVL rank 1 with an Active info record (default policy AVL Rank): {eligible.find((a) => a.rank === 1)?.vendorId ?? "none"}.</li>
                    <li>Any AVL vendor with an Active info record, by rank: {eligible.map((a) => `${a.vendorId} (rank ${a.rank})`).join(", ") || "none"}.</li>
                    <li>No eligible source: the PR is flagged EX-09 and the buyer starts an RFQ or AVL qualification.</li>
                  </ol>
                  <p className="text-sm font-medium">{determination ? `Result: ${determination.vendor}. ${determination.why}.` : "Result: no valid source of supply (EX-09)."}</p>
                  {blockedV.size > 0 && <p className="text-xs text-muted-foreground">Blocked this period, hard block at PO entry (E-MM-35): {[...blockedV].join(", ")}.</p>}
                </Section>
              </div>
            ),
          },
        ]}
      />
      <RulesPanel
        rules={[
          ["V-MM-33", "A row's vendor must hold an Active info record, and an AVL row where qualification is required.", "[Book II §7.4]"],
          ["V-MM-34", "Exactly one Fixed source per period; fixing a row unfixes an overlapping one.", "[Book II §7.4]"],
          ["E-MM-35", "Blocked is an explicit negative regardless of AVL; hard block at PO entry.", "[Book II §7.4]"],
          ["§7.4", "MRP relevant OFF rows are for spot buys only; MRP ignores them.", "[Book II §7.4]"],
          ["§7.5", "Determination order: fixed source list row, AVL rank 1 with Active info record, any AVL vendor by rank, else EX-09.", "[Book II §7.5]"],
        ]}
      />
      <DialogShell
        open={dlg === "add"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Add source row for ${material}`}
        consequence="Adds the vendor as a valid source for the period; MRP uses it when MRP relevant."
        confirmLabel="Add row"
        onConfirm={() => confirmRun(addSourceRow({ materialId: material, vendorId: ven, validFrom: from, validTo: to || undefined, mrpRelevant: mrp }), "Source row added")}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="sl-ven">Vendor</Label>
            <Select value={ven} onValueChange={setVen}>
              <SelectTrigger id="sl-ven">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_VENDORS.map((x) => {
                  const ir = irFor(x.id)
                  return (
                    <SelectItem key={x.id} value={x.id}>
                      {x.id} {x.name} {ir ? `(${ir.id}, ${irStatus(s, ir.id, TODAY)}, ${currentPrice(ir, TODAY)?.price ?? "no price"})` : "(no info record)"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sl-from">Valid from</Label>
            <Input id="sl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sl-to">Valid to</Label>
            <Input id="sl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={mrp} onCheckedChange={setMrp} /> MRP relevant
          </label>
        </div>
      </DialogShell>
      <DialogShell
        open={typeof dlg === "object" && dlg !== null}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Block ${typeof dlg === "object" && dlg ? dlg.block.vendorId : ""} for ${material}`}
        consequence="This vendor may not supply this material in the period regardless of AVL; PO entry is hard-blocked (E-MM-35). A Fixed flag on the row is removed."
        requireReason
        destructive
        confirmLabel="Block source"
        onConfirm={(reason) => (typeof dlg === "object" && dlg ? confirmRun(blockSource(dlg.block.id, reason), "Source blocked") : null)}
      />
    </>
  )
}
