// CO-CC/PC-001/2 Cost and Profit Center Masters [DOC:p.273] (asserted); rules Book I H §1, §2.
// Hierarchy tree editor with effective-dated moves, master fields with owner and validity, where-used
// check before deactivation. Actions: maintain, move with history, block for posting. Controlling
// analyst drafts, Controller approves (H §6). Rule-7 fallbacks land on CO-R4.
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Ban, FolderTree, MoveRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { CostCenterId } from "@/data/domain"
import { COST_CENTERS, PROFIT_CENTERS, TODAY, USERS, WAREHOUSES, WORK_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { centerAction } from "../data/actions"
import type { PurchasingFinanceState } from "../data/slice"
import { CsvButton, report, Section, useDemoState } from "../components/common"
import { DetailFrame, RecLink, SelectField, TextField, userName } from "../components/bits"

interface Center {
  id: CostCenterId
  name: string
  parentId?: CostCenterId
  postable: boolean
  entityId: string
  defaultProfitCenterId?: string
  managerId?: string
  status: "Active" | "Blocked" | "Inactive"
  validFrom: string
  validTo?: string
  depth: number
}
export function allCenters(s: PurchasingFinanceState): Center[] {
  const base = [...COST_CENTERS, ...s.addedCenters].map((c) => {
    const o = s.centerOverlay[c.id]
    return { ...c, managerId: o?.managerId ?? ("managerId" in c ? c.managerId : undefined), status: o?.status ?? c.status, parentId: o?.parentId ?? c.parentId, depth: 0 }
  })
  const depth = (c: (typeof base)[number]): number => (c.parentId ? 1 + depth(base.find((x) => x.id === c.parentId) ?? { ...c, parentId: undefined }) : 0)
  // order as a tree: roots, then their children
  const out: Center[] = []
  const walk = (parent: string | undefined) =>
    base
      .filter((c) => c.parentId === parent)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((c) => {
        out.push({ ...c, depth: depth(c) } as Center)
        walk(c.id)
      })
  walk(undefined)
  return out
}
const whereUsed = (s: PurchasingFinanceState, id: string) => {
  const wcs = WORK_CENTERS.filter((w) => w.costCenterId === id).map((w) => w.id)
  const whs = WAREHOUSES.filter((w) => w.costCenterId === id).map((w) => w.id)
  const prs = s.requisitions.filter((r) => r.costCenterId === id && ["Open", "In Approval", "Approved"].includes(r.status)).map((r) => r.id)
  const cycles = s.allocationCycles.filter((c) => c.senderCostCenterIds.includes(id as CostCenterId) || c.receiverCostCenterIds.includes(id as CostCenterId)).map((c) => c.id)
  return { wcs, whs, prs, cycles, total: wcs.length + whs.length + prs.length + cycles.length }
}

export function CenterList({ kind }: { kind: "cost" | "profit" }) {
  const s = useSlice("purchasingFinance")
  const st = useDemoState(kind === "cost" ? "CO-CC-001" : "CO-PC-001")
  const nav = useNavigate()
  const centers = useMemo(() => allCenters(s), [s])
  const ccCols: Column<Center>[] = [
    { id: "id", header: "Cost center", value: (r) => r.id, mono: true, cell: (r) => <span style={{ paddingLeft: `${r.depth * 16}px` }} className="font-mono">{r.id}</span> },
    { id: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className={r.postable ? undefined : "font-semibold"}>{r.name}</span> },
    { id: "post", header: "Node", value: (r) => (r.postable ? "Postable" : "Summary"), filterable: true },
    { id: "pc", header: "Default profit center", value: (r) => r.defaultProfitCenterId ?? "", filterable: true },
    { id: "mgr", header: "Manager", value: (r) => userName(r.managerId) },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, cell: (r) => `${fmtDate(r.validFrom)} to ${r.validTo ? fmtDate(r.validTo) : "open"}` },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="costCenter" status={r.status} size="sm" /> },
  ]
  const pcCols: Column<(typeof PROFIT_CENTERS)[number]>[] = [
    { id: "id", header: "Profit center", value: (r) => r.id, mono: true },
    { id: "name", header: "Name", value: (r) => r.name },
    { id: "scope", header: "Scope", value: (r) => r.scope },
    { id: "floor", header: "Price floor", value: (r) => r.priceFloorPct ?? "", align: "right", cell: (r) => (r.priceFloorPct != null ? `${r.priceFloorPct}%` : <span className="text-muted-foreground">Not stated</span>) },
    { id: "ccs", header: "Cost centers defaulting here", value: (r) => centers.filter((c) => c.defaultProfitCenterId === r.id).length, align: "right", mono: true },
    { id: "status", header: "Status", value: (r) => r.status, cell: (r) => <StatusBadge kind="costCenter" status={r.status} size="sm" /> },
  ]
  const header = {
    screenId: "CO-CC/PC-001/2",
    title: kind === "cost" ? "Cost centers" : "Profit centers",
    crumbs: kind === "profit" ? [{ label: "Profit centers" }] : undefined,
    description: "The dimensions every posting derives. Hierarchy changes are effective-dated and keep their history.",
    actions: (
      <>
        {st.menu}
        <Button variant="outline" onClick={() => nav(kind === "cost" ? "/controlling/profit-centers" : "/controlling/cost-centers")}>
          <FolderTree aria-hidden="true" /> {kind === "cost" ? "Profit centers" : "Cost centers"}
        </Button>
        <CsvButton filename={`${kind}-centers.csv`} rows={kind === "cost" ? centers.map((c) => ({ Id: c.id, Name: c.name, Parent: c.parentId, Postable: c.postable ? "yes" : "no", PC: c.defaultProfitCenterId, Status: c.status })) : PROFIT_CENTERS.map((p) => ({ Id: p.id, Name: p.name, Floor: p.priceFloorPct, Status: p.status }))} />
      </>
    ),
  }
  if (kind === "profit")
    return (
      <ListPage
        header={header}
        table={{ rows: st.empty ? [] : PROFIT_CENTERS, columns: pcCols, rowId: (r) => r.id, rowHref: (r) => `/controlling/profit-centers/${r.id}`, loading: st.loading, error: st.error, onRetry: st.retry, densityKey: "CO-PC-001", empty: { title: "No profit centers", body: "Profit centers are seeded in wave 1." } }}
      />
    )
  return (
    <ListPage
      header={header}
      table={{
        rows: st.empty ? [] : centers,
        columns: ccCols,
        rowId: (r) => r.id,
        rowHref: (r) => `/controlling/cost-centers/${r.id}`,
        searchText: (r) => `${r.id} ${r.name}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "CO-CC-001",
        caption: "Tree order: summary nodes in bold, children indented",
        empty: { title: "No cost centers", body: "Cost centers are seeded in wave 1." },
      }}
    />
  )
}

export function CostCenterDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CO-CC-002")
  const c = allCenters(s).find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!c} title={id} screenId="CO-CC/PC-001/2" back={{ label: "Cost centers", to: "/controlling/cost-centers" }}>
      {() => <CcBody c={c!} menu={st.menu} />}
    </DetailFrame>
  )
}
function CcBody({ c, menu }: { c: Center; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | "Block" | "Unblock" | "Deactivate" | "Move" | "Maintain">(null)
  const [f, setF] = useState({ parentId: c.parentId ?? "", managerId: c.managerId ?? "", effective: "2026-11-01" })
  const wu = whereUsed(s, c.id)
  const hist = s.centerOverlay[c.id]?.history ?? []
  const children = allCenters(s).filter((x) => x.parentId === c.id)
  const spend = s.journal.filter((j) => j.costCenterId === c.id && j.period === "2026-09").reduce((t, j) => t + j.amount, 0)
  return (
    <>
      <DetailPage
        header={{
          screenId: "CO-CC/PC-001/2",
          title: `${c.id} · ${c.name}`,
          crumbs: [{ label: "Cost centers", to: "/controlling/cost-centers" }],
          chips: <>{!c.postable && <Chip kind="design" note="Summary node: not postable (V-CO-01)">Summary node</Chip>}</>,
          actions: (
            <>
              {menu}
              <Button variant="outline" onClick={() => setDlg("Move")}>
                <MoveRight aria-hidden="true" /> Move
              </Button>
              {c.status === "Active" && (
                <Button variant="outline" onClick={() => setDlg("Block")}>
                  <Ban aria-hidden="true" /> Block for posting
                </Button>
              )}
              {c.status === "Blocked" && (
                <Button variant="outline" onClick={() => setDlg("Unblock")}>
                  Unblock
                </Button>
              )}
              {c.status !== "Inactive" && (
                <Button variant="ghost" onClick={() => setDlg("Deactivate")}>
                  Deactivate
                </Button>
              )}
              <Button variant="ghost" onClick={() => nav(`/controlling/reports/CO-R1?cc=${c.id}`)}>
                Cost center report
              </Button>
            </>
          ),
          primary: c.status !== "Inactive" ? <Button onClick={() => setDlg("Maintain")}>Maintain</Button> : undefined,
        }}
        status={{ kind: "costCenter", value: c.status }}
        summary={
          <>
            <KV k="Parent">{c.parentId ? <RecLink to={`/controlling/cost-centers/${c.parentId}`}>{c.parentId}</RecLink> : "Root"}</KV>
            <KV k="Entity">{c.entityId}</KV>
            <KV k="Default profit center">{c.defaultProfitCenterId ? <RecLink to={`/controlling/profit-centers/${c.defaultProfitCenterId}`}>{c.defaultProfitCenterId}</RecLink> : "None"}</KV>
            <KV k="Manager (owner)">{userName(c.managerId)}</KV>
            <KV k="Validity">
              {fmtDate(c.validFrom)} to {c.validTo ? fmtDate(c.validTo) : "open"}
            </KV>
            <KV k="Postable">{c.postable ? "Yes" : "No (summary)"}</KV>
            <KV k="September actuals">{fmtMoney(spend)}</KV>
            <KV k="Children">{children.length}</KV>
          </>
        }
        tabs={[
          {
            id: "where",
            label: "Where used",
            count: wu.total,
            content: (
              <Section title="Where-used check (before deactivation)">
                <ul className="text-sm">
                  <li>Work centers: {wu.wcs.join(", ") || "none"}</li>
                  <li>Warehouses: {wu.whs.join(", ") || "none"}</li>
                  <li>Open requisitions: {wu.prs.join(", ") || "none"}</li>
                  <li>Allocation cycles: {wu.cycles.join(", ") || "none"}</li>
                  <li>Child centers: {children.map((x) => x.id).join(", ") || "none"}</li>
                </ul>
              </Section>
            ),
          },
          {
            id: "history",
            label: "History",
            count: hist.length,
            content: hist.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Recorded</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...hist].reverse().map((h, i) => (
                    <TableRow key={i} className="h-8 text-[13px]">
                      <TableCell>{fmtDate(h.on)}</TableCell>
                      <TableCell>{fmtDate(h.effective)}</TableCell>
                      <TableCell>{userName(h.by)}</TableCell>
                      <TableCell>{h.text}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No changes recorded. Moves, blocks and owner changes are kept here with their effective date.</p>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["H §1", "Postable leaves only; summary nodes roll up (V-CO-01)", "[DOC:p.111 §1]"],
              ["H §2", "Hierarchy moves are effective-dated with history; where-used check before deactivation", "[DOC:p.111 §2]"],
              ["H §6", "Controlling analyst drafts; Controller approves masters and hierarchy changes", "[DOC:p.115 §6]"],
              ["C-50", "Masters show no period warnings; changes are dated (C-44, C-50)", "erd §4"],
            ]}
          />
        }
      />
      <DialogShell
        open={!!dlg}
        onOpenChange={(o) => !o && setDlg(null)}
        destructive={dlg === "Deactivate"}
        title={`${dlg} ${c.id}`}
        confirmLabel={dlg ?? ""}
        consequence={
          dlg === "Block"
            ? `New postings to ${c.id} are refused; postings that slip through land on CO-R4.`
            : dlg === "Deactivate"
              ? wu.total
                ? `Where-used check fails: ${wu.total} open use(s). Clear them first.`
                : `${c.id} becomes Inactive from the effective date.`
              : dlg === "Move"
                ? "Moves the center under the new parent from the effective date; rollups change from then and history is kept."
                : dlg === "Unblock"
                  ? "Postings are accepted again."
                  : "Updates the owner; recorded with its effective date."
        }
        onConfirm={() => report(centerAction(c.id, dlg!, { parentId: (f.parentId || undefined) as CostCenterId | undefined, managerId: f.managerId || undefined, effective: f.effective, whereUsed: dlg === "Deactivate" ? wu.total : 0 }), `${c.id}: ${dlg} recorded`)}
      >
        <TextField id="cc-eff" type="date" label="Effective from" value={f.effective} onChange={(v) => setF({ ...f, effective: v })} />
        {dlg === "Move" && (
          <SelectField id="cc-par" label="New parent" value={f.parentId} onChange={(v) => setF({ ...f, parentId: v })} options={allCenters(s).filter((x) => !x.postable && x.id !== c.id).map((x) => ({ value: x.id, label: `${x.id} ${x.name}` }))} />
        )}
        {dlg === "Maintain" && <SelectField id="cc-mgr" label="Manager" value={f.managerId} onChange={(v) => setF({ ...f, managerId: v })} options={USERS.map((u) => ({ value: u.id, label: `${u.name} (${u.roles[0]})` }))} />}
      </DialogShell>
    </>
  )
}

export function ProfitCenterDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CO-PC-002")
  const p = PROFIT_CENTERS.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!p} title={id} screenId="CO-CC/PC-001/2" back={{ label: "Profit centers", to: "/controlling/profit-centers" }}>
      {() => (
        <DetailPage
          header={{ screenId: "CO-CC/PC-001/2", title: `${p!.id} · ${p!.name}`, crumbs: [{ label: "Profit centers", to: "/controlling/profit-centers" }], actions: st.menu }}
          status={{ kind: "costCenter", value: p!.status }}
          summary={
            <>
              <KV k="Scope">{p!.scope}</KV>
              <KV k="Price floor">{p!.priceFloorPct != null ? `${p!.priceFloorPct}%` : "Not stated"}</KV>
              <KV k="As of">{fmtDate(TODAY)}</KV>
            </>
          }
          tabs={[
            {
              id: "ccs",
              label: "Cost centers",
              content: (
                <ul className="text-sm">
                  {allCenters(s)
                    .filter((c) => c.defaultProfitCenterId === p!.id)
                    .map((c) => (
                      <li key={c.id}>
                        <RecLink to={`/controlling/cost-centers/${c.id}`}>{c.id}</RecLink> {c.name}
                      </li>
                    ))}
                </ul>
              ),
            },
          ]}
          aside={<RulesPanel rules={[["H §6", "CFO owns profit center structure changes", "[DOC:p.115 §6]"], ["PC-900", "Corporate / Unassigned: target zero balance (CO-R4)", "[DOC:p.111]"]]} />}
        />
      )}
    </DetailFrame>
  )
}
