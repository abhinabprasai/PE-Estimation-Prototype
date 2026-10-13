// FX-PUR-AVL Approved Vendor Lists view (/purchasing/avl); source Book I G §2.2 [DOC:p.101]; Book II §7.4-7.5 for
// source determination. One AVL row per item and vendor: preferred rank, vendor part and lead time, price basis (a
// read-through onto the info record), qualification status (Qualified / Conditional / Suspended), FAI link and
// the rolling IQC quality rating. The Buyer proposes a row, the Purchasing Manager approves it, Quality sets the
// qualification. The scorecard feeds status proposals (Book I G §7). Archetype and route are design values.
import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell, ListPage } from "@/components/templates"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { AvlEntry, MaterialId, VendorId } from "@/data/domain"
import { MATERIALS, TODAY } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { setAvlStatus } from "../data/actions"
import { allAvl, allVendors, itemText, vendorName } from "../data/logic"
import { qualityRating } from "../data/compliance"
import { scorecardFor, activeInfoRecord } from "../data/xlogic"
import { addAvlRow, approveAvlRow, decideAvlProposal, proposeAvlChange, setAvlRank } from "../data/xactions"
import { CsvButton, Design, report, Section } from "../components/common"
import { ItemLink, RecLink, SelectField, TextField, VendorLink, userName } from "../components/bits"
import { useNineStates, writeProps } from "../components/states"

type Row = AvlEntry & { leadDays?: number; note?: string; vendor: string; item: string; rating?: number; lots?: number; irPrice?: string; pending: boolean; openProposal?: string }
const BUYABLE = MATERIALS.filter((m) => ["RAW", "TRADE", "PACK", "CONS", "SPARE"].includes(m.type) && m.status !== "Obsolete")

export function AvlView() {
  const s = useSlice("purchasingFinance")
  const [role] = useRole()
  const st = useNineStates("FX-PUR-AVL", { writers: "the Buyer proposes, the Purchasing Manager approves, Quality sets qualification", degraded: "IQC acceptance ratings come from the quality service, which answered slowly: the Quality rating column may be up to 24 hours old." })
  const [open, setOpen] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | "add" | "rank" | "propose">(null)
  const [add, setAdd] = useState({ itemId: "" as MaterialId | "", vendorId: "" as VendorId | "", rank: "1", basis: "", lead: "" })
  const [rank, setRank] = useState("1")
  const [prop, setProp] = useState({ to: "" as "Qualified" | "Conditional" | "Suspended" | "", reason: "" })
  const [qualTo, setQualTo] = useState<"Qualified" | "Conditional" | "Suspended" | "">("")

  const rows: Row[] = useMemo(
    () =>
      allAvl(s).map((a) => {
        const q = qualityRating(a.vendorId)
        const ir = activeInfoRecord(s, a.vendorId, a.itemId, TODAY)
        return {
          ...a, vendor: vendorName(s, a.vendorId), item: itemText(a.itemId), rating: q?.pct, lots: q?.lots,
          irPrice: ir ? `${ir.price} / ${ir.unit} (${ir.id})` : undefined, pending: !!a.note?.includes("approval pending"), openProposal: s.avlProposals.find((p) => p.avlId === a.id && p.status === "Open")?.id,
        }
      }),
    [s],
  )
  const sel = rows.find((r) => r.id === open)
  const byItem = (itemId: string) => rows.filter((r) => r.itemId === itemId).sort((a, b) => a.rank - b.rank)
  const openProps = s.avlProposals.filter((p) => p.status === "Open")

  const cols: Column<Row>[] = [
    { id: "item", header: "Item", value: (r) => r.itemId, sortable: true, cell: (r) => <ItemLink id={r.itemId} /> },
    { id: "vendor", header: "Vendor", value: (r) => r.vendor, sortable: true, filterable: true, cell: (r) => <VendorLink id={r.vendorId} name={r.vendor} /> },
    { id: "rank", header: "Rank", value: (r) => r.rank, sortable: true, align: "right", mono: true },
    { id: "status", header: "Qualification", value: (r) => r.status, filterable: true, cell: (r) => <span className="flex flex-col items-start gap-1"><StatusBadge kind="avl" status={r.status} size="sm" />{r.status === "Conditional" && <span className="text-xs text-muted-foreground">Receipts forced to 100% inspection</span>}{r.pending && <Chip kind="flag">Approval pending</Chip>}</span> },
    { id: "fai", header: "FAI", value: (r) => r.faiRef ?? "", cell: (r) => r.faiRef ?? <span className="text-muted-foreground">Not required</span> },
    { id: "basis", header: "Price basis", value: (r) => r.priceBasis, cell: (r) => <span className="flex flex-col"><span>{r.priceBasis}</span>{r.irPrice && <span className="text-xs text-muted-foreground">Info record {r.irPrice}</span>}</span> },
    { id: "lead", header: "Lead time", value: (r) => r.leadDays ?? "", align: "right", cell: (r) => (r.leadDays ? `${r.leadDays} d` : <span className="text-muted-foreground">Info record</span>) },
    { id: "rating", header: "Quality rating", value: (r) => r.rating ?? "", align: "right", cell: (r) => (r.rating != null ? `${r.rating}% of ${r.lots} lots` : <span className="text-muted-foreground">Not rated</span>) },
    { id: "prop", header: "Proposal", value: (r) => (r.openProposal ? "Open" : ""), filterable: true, cell: (r) => (r.openProposal ? <Chip kind="flag">Open</Chip> : "") },
  ]

  const addOk = add.itemId && add.vendorId
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-PUR-AVL",
          title: "Approved vendor lists",
          description: "Who may supply what, in rank order. The AVL keeps qualification; the info record keeps the commercial terms (Book II §7.2).",
          chips: <Design note="Route and archetype of this view are design values; the AVL columns are Book I G §2.2" />,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="avl.csv" rows={rows.map((r) => ({ Row: r.id, Item: r.itemId, Vendor: r.vendorId, Rank: r.rank, Status: r.status, FAI: r.faiRef, Basis: r.priceBasis }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg("add")} {...writeProps(st)}>
              <Plus aria-hidden="true" /> Add AVL row
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : rows,
          columns: cols,
          rowId: (r) => r.id,
          onRowClick: (r) => setOpen(r.id),
          searchText: (r) => `${r.id} ${r.itemId} ${r.item} ${r.vendorId} ${r.vendor}`,
          loading: st.loading,
          densityKey: "FX-PUR-AVL",
          empty: { title: "No AVL rows", body: "An RFQ award or a Buyer proposal adds the first row. A new row is Conditional until first-article inspection passes." },
        }}
        above={
          openProps.length > 0 ? (
            <Section title={`Status proposals waiting for Quality (${openProps.length})`} action={<Chip kind="design" note="The scorecard proposes; Quality qualifies (Book I G §7 role table)">Scorecard feed</Chip>}>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Proposal</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openProps.map((p) => (
                    <TableRow key={p.id} className="h-8 text-[13px]">
                      <TableCell className="font-mono">{p.id}</TableCell>
                      <TableCell>{p.avlId} · {p.itemId} · {vendorName(s, p.vendorId)}</TableCell>
                      <TableCell>to {p.to}</TableCell>
                      <TableCell>{p.reason}</TableCell>
                      <TableCell>{p.source} · {userName(p.by)} · {fmtDate(p.on)}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="outline" {...writeProps(st)} onClick={() => report(decideAvlProposal(p.id, true), `${p.avlId} set ${p.to}`)}>Apply</Button>
                        <Button size="sm" variant="ghost" {...writeProps(st)} onClick={() => report(decideAvlProposal(p.id, false), "Proposal declined")}>Decline</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">Applying is Quality's decision (Quality Manager or Quality engineer). You act as {role}.</p>
            </Section>
          ) : undefined
        }
        below={
          <RulesPanel
            rules={[
              ["G §2.2", "Item plus vendor is the AVL row key; rank 1 is the vendor MRP source determination uses", "[DOC:p.101]"],
              ["G §2.2", "Conditional means first article pending: receipts are forced to 100% inspection", "[DOC:p.101]"],
              ["C-31", "Only an Active vendor goes on the AVL", "[DOC:p.101 §2.1]"],
              ["E-PUR-02", "A QI-critical item goes only to a Qualified AVL vendor", "reading OQ-PF-18"],
              ["II §7.2", "Price basis and lead time are read-throughs onto the active info record", "[DOC:p.158]"],
              ["G §7", "Buyer proposes, Purchasing Manager approves, Quality sets qualification status", "[DOC:p.107]"],
            ]}
          />
        }
      />

      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.id} · {sel.item}</SheetTitle>
                <SheetDescription>{sel.vendor}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <KV k="Qualification"><StatusBadge kind="avl" status={sel.status} size="sm" /></KV>
                  <KV k="Preferred rank">{sel.rank}</KV>
                  <KV k="Price basis">{sel.priceBasis}</KV>
                  <KV k="Info record">{sel.irPrice ?? "None active"}</KV>
                  <KV k="FAI">{sel.faiRef ?? "Not required"}</KV>
                  <KV k="Quality rating">{sel.rating != null ? `${sel.rating}% of ${sel.lots} lots` : "Not rated"}</KV>
                </dl>
                {sel.note && <p className="text-sm text-muted-foreground">{sel.note}</p>}
                <Section title="Source determination for this item">
                  <ol className="list-decimal pl-5 text-sm">
                    {byItem(sel.itemId).map((r) => (
                      <li key={r.id} className={r.id === sel.id ? "font-semibold" : ""}>
                        Rank {r.rank}: {r.vendor} <StatusBadge kind="avl" status={r.status} size="sm" />
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted-foreground">Order: source-list fixed vendor, AVL rank 1 with an active info record, any AVL vendor by rank; none gives EX-09 (Book II §7.5).</p>
                </Section>
                <Section title="Scorecard">
                  {(() => {
                    const sc = scorecardFor(s, sel.vendorId)
                    return (
                      <p className="text-sm">
                        <RecLink to="/purchasing/vendor-performance">Vendor performance</RecLink>: score {sc.score ?? "n/a"} (band {sc.band}). {sc.proposal ? `The scorecard proposes ${sc.proposal}.` : "No change proposed."}
                      </p>
                    )
                  })()}
                </Section>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" {...writeProps(st)} onClick={() => { setRank(String(sel.rank)); setDlg("rank") }}>Change rank</Button>
                  <Button variant="outline" {...writeProps(st)} onClick={() => setDlg("propose")} disabled={!!st.blockReason || !!sel.openProposal}>Propose status change</Button>
                  {sel.pending && <Button {...writeProps(st)} onClick={() => report(approveAvlRow(sel.id), `${sel.id} approved`)}>Approve row (Purchasing Manager)</Button>}
                </div>
                <div className="flex items-end gap-2">
                  <SelectField id="avl-q" label="Set qualification (Quality)" value={qualTo} onChange={setQualTo} options={(["Qualified", "Conditional", "Suspended"] as const).filter((x) => x !== sel.status).map((x) => ({ value: x, label: x }))} />
                  <Button variant="outline" disabled={!qualTo || !!st.blockReason} title={st.blockReason ?? undefined} onClick={() => qualTo && report(setAvlStatus(sel.id, qualTo), `${sel.id} ${qualTo}`)}>Apply</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DialogShell
        open={dlg === "add"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Add an AVL row"
        confirmLabel="Add row"
        confirmDisabled={!addOk}
        consequence="Adds the row as Conditional: first-article inspection is pending and receipts are forced to 100% inspection. The Purchasing Manager approves a Buyer's proposal."
        onConfirm={() => st.guard() ?? report(addAvlRow({ itemId: add.itemId as MaterialId, vendorId: add.vendorId as VendorId, rank: Number(add.rank), priceBasis: add.basis, leadDays: Number(add.lead) || 0 }), (id) => `${id} added`)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="avl-item" label="Item" value={add.itemId} onChange={(v) => setAdd({ ...add, itemId: v })} options={BUYABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 40)}` }))} />
          <SelectField id="avl-ven" label="Vendor" value={add.vendorId} onChange={(v) => setAdd({ ...add, vendorId: v })} options={allVendors(s).filter((v) => v.onboarding === "Active").map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))} hint="Only an Active vendor (C-31)" />
          <TextField id="avl-rank" label="Preferred rank" type="number" value={add.rank} onChange={(v) => setAdd({ ...add, rank: v })} />
          <TextField id="avl-lead" label="Lead time (days)" type="number" value={add.lead} onChange={(v) => setAdd({ ...add, lead: v })} />
          <div className="sm:col-span-2">
            <TextField id="avl-basis" label="Price basis" value={add.basis} onChange={(v) => setAdd({ ...add, basis: v })} hint="Info record, contract or award reference, for example Info record IR-004213" />
          </div>
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a duplicate item and vendor is refused, and the vendor must be Active.</p>}
      </DialogShell>
      <DialogShell open={dlg === "rank"} onOpenChange={(o) => !o && setDlg(null)} title={`Change rank of ${open ?? ""}`} confirmLabel="Save rank" consequence="MRP source determination uses rank 1; changing it changes which vendor new requisitions propose." onConfirm={() => st.guard() ?? report(setAvlRank(open!, Number(rank)), "Rank saved")}>
        <TextField id="avl-newrank" label="Preferred rank" type="number" value={rank} onChange={setRank} />
      </DialogShell>
      <DialogShell
        open={dlg === "propose"}
        onOpenChange={(o) => !o && setDlg(null)}
        requireReason
        reasonLabel="Reason for the proposal (required)"
        title={`Propose a status change for ${open ?? ""}`}
        confirmLabel="Send proposal to Quality"
        consequence="Quality decides qualification status; nothing changes until a Quality Manager or Quality engineer applies it."
        onConfirm={(r) => st.guard() ?? (prop.to ? report(proposeAvlChange(open!, prop.to, r, "Buyer"), "Proposal sent") : "Choose the proposed status.")}
      >
        <SelectField id="avl-pto" label="Proposed status" value={prop.to} onChange={(v) => setProp({ ...prop, to: v })} options={(["Qualified", "Conditional", "Suspended"] as const).filter((x) => x !== sel?.status).map((x) => ({ value: x, label: x }))} />
      </DialogShell>
    </>
  )
}
