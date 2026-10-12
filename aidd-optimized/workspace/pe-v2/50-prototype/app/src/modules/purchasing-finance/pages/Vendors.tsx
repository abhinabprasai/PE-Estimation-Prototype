// PUR-VEND-001/2 Vendors and AVL [DOC:p.267] (asserted); rules Book I G §2.
// Operational tabs with compliance panel, AVL grid with rank, qualification, FAI and quality rating.
// Primary actions: onboard through the steps (S-30), restrict or disqualify with cascade to sources (S-31, S-32).
import { useMemo, useState } from "react"
import { useParams } from "react-router"
import { ShieldAlert, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { Vendor } from "@/data/domain"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { setAvlStatus, setVendorOnboarding, setVendorQuality } from "../data/actions"
import { allAvl, allVendors, EXTRA_VENDORS, poTotal, vendorEligibility } from "../data/logic"
import { CsvButton, DocLink, Reading, report, Section, useDemoState } from "../components/common"
import { DetailFrame, ItemLink, SelectField } from "../components/bits"

type Row = Vendor & { avl: number; eligible: string; openPos: number }
const NEXT: Record<string, "Docs Pending" | "Under Review" | "Active" | undefined> = { Draft: "Docs Pending", "Docs Pending": "Under Review", "Under Review": "Active" }

export function VendorList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-VEND-001")
  const rows = useMemo<Row[]>(
    () =>
      allVendors(s).map((v) => {
        const el = vendorEligibility(v)
        return { ...v, avl: allAvl(s).filter((a) => a.vendorId === v.id).length, eligible: !el.ok ? "Blocked" : el.needsOverride ? "Override needed" : "Eligible", openPos: s.purchaseOrders.filter((p) => p.vendorId === v.id && !["Matched/Closed", "Cancelled"].includes(p.status)).length }
      }),
    [s],
  )
  const cols: Column<Row>[] = [
    { id: "id", header: "Vendor", value: (r) => r.id, mono: true, sortable: true },
    { id: "name", header: "Name", value: (r) => r.name, sortable: true },
    { id: "country", header: "Country", value: (r) => r.country, filterable: true },
    { id: "commodity", header: "Commodity", value: (r) => r.commodity, cell: (r) => <span className="line-clamp-1 max-w-[260px]">{r.commodity}</span> },
    { id: "onb", header: "Onboarding", value: (r) => r.onboarding, filterable: true, cell: (r) => <StatusBadge kind="vendorOnboarding" status={r.onboarding} size="sm" /> },
    { id: "qual", header: "Quality approval", value: (r) => r.quality, filterable: true, cell: (r) => <StatusBadge kind="vendorQuality" status={r.quality} size="sm" /> },
    { id: "elig", header: "PO eligibility", value: (r) => r.eligible, filterable: true, cell: (r) => (r.eligible === "Eligible" ? "Eligible" : <Chip kind={r.eligible === "Blocked" ? "block" : "flag"}>{r.eligible}</Chip>) },
    { id: "scar", header: "Overdue SCARs", value: (r) => r.overdueScars, align: "right", mono: true, sortable: true },
    { id: "avl", header: "AVL rows", value: (r) => r.avl, align: "right", mono: true },
    { id: "pos", header: "Open POs", value: (r) => r.openPos, align: "right", mono: true, sortable: true },
  ]
  return (
    <ListPage
      header={{
        screenId: "PUR-VEND-001/2",
        title: "Vendors and approved vendor list",
        description: "Vendor eligibility that every source decision reads: onboarding (S-30), quality approval (S-31) and AVL qualification per item (S-32).",
        actions: (
          <>
            {st.menu}
            <CsvButton filename="vendors.csv" rows={rows.map((r) => ({ Vendor: r.id, Name: r.name, Onboarding: r.onboarding, Quality: r.quality, Eligibility: r.eligible }))} />
          </>
        ),
      }}
      table={{
        rows: st.empty ? [] : rows,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/purchasing/vendors/${r.id}`,
        searchText: (r) => `${r.id} ${r.name} ${r.commodity}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "PUR-VEND-001",
        empty: { title: "No vendors", body: "Vendors are onboarded here: Draft, Docs Pending, Under Review, Active." },
      }}
      below={
        <p className="text-xs text-muted-foreground">
          {EXTRA_VENDORS.length} vendors ({EXTRA_VENDORS.map((v) => v.id).join(", ")}) are held in this module until the shared vendor master adds them (Requests to foundation R-1).
        </p>
      }
    />
  )
}

export function VendorDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PUR-VEND-002")
  const v = allVendors(s).find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!v} title={id} screenId="PUR-VEND-001/2" back={{ label: "Vendors", to: "/purchasing/vendors" }}>
      {() => <VendorBody v={v!} menu={st.menu} />}
    </DetailFrame>
  )
}

function VendorBody({ v, menu }: { v: Vendor; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const [dlg, setDlg] = useState<null | "onb" | "qual">(null)
  const [to, setTo] = useState<"Approved" | "Conditional" | "Restricted" | "Disqualified" | "">("")
  const next = NEXT[v.onboarding]
  const avl = allAvl(s).filter((a) => a.vendorId === v.id)
  const pos = s.purchaseOrders.filter((p) => p.vendorId === v.id)
  const el = vendorEligibility(v)
  const hist = s.vendorOverlay[v.id]?.history ?? []
  return (
    <>
      <DetailPage
        header={{
          screenId: "PUR-VEND-001/2",
          title: `${v.id} · ${v.name}`,
          crumbs: [{ label: "Vendors", to: "/purchasing/vendors" }],
          chips: (
            <>
              <StatusBadge kind="vendorQuality" status={v.quality} />
              {!el.ok && <Chip kind="block">No new POs</Chip>}
              {el.needsOverride && <Chip kind="flag">Override needed for POs</Chip>}
            </>
          ),
          actions: (
            <>
              {menu}
              <Button variant="outline" onClick={() => setDlg("qual")}>
                <ShieldAlert aria-hidden="true" /> Change quality approval
              </Button>
            </>
          ),
          primary: next ? (
            <Button onClick={() => setDlg("onb")}>
              <UserCheck aria-hidden="true" /> Move to {next}
            </Button>
          ) : undefined,
        }}
        status={{ kind: "vendorOnboarding", value: v.onboarding }}
        summary={
          <>
            <KV k="Country / currency">
              {v.country} / {v.currency}
            </KV>
            <KV k="Commodity">{v.commodity}</KV>
            <KV k="PO eligibility">{el.ok ? (el.needsOverride ? "Purchasing Manager override per PO" : "Eligible") : el.reason}</KV>
            <KV k="Overdue SCARs">{v.overdueScars}</KV>
          </>
        }
        tabs={[
          {
            id: "avl",
            label: "AVL",
            count: avl.length,
            content: avl.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>AVL row</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>FAI</TableHead>
                    <TableHead>Price basis</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avl.map((a) => (
                    <TableRow key={a.id} className="h-10 align-top text-[13px]">
                      <TableCell className="font-mono">{a.id}</TableCell>
                      <TableCell>
                        <ItemLink id={a.itemId} />
                      </TableCell>
                      <TableCell className="tabular text-right">{a.rank}</TableCell>
                      <TableCell>
                        <StatusBadge kind="avl" status={a.status} size="sm" />
                        {a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}
                      </TableCell>
                      <TableCell>{a.faiRef ?? "Not recorded"}</TableCell>
                      <TableCell>{a.priceBasis}</TableCell>
                      <TableCell>
                        <AvlMenu id={a.id} status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Not on the AVL yet">An RFQ award or a qualification adds AVL rows (Conditional until first-article inspection passes).</EmptyState>
            ),
          },
          {
            id: "compliance",
            label: "Compliance",
            count: v.complianceDocs.length,
            content: (
              <Section title="Compliance documents">
                {v.complianceDocs.length ? (
                  <ul className="list-disc pl-6 text-sm">
                    {v.complianceDocs.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">None attached. W-9 or equivalent, insurance and ISO certificates are needed before review.</p>
                )}
              </Section>
            ),
          },
          {
            id: "pos",
            label: "Purchase orders",
            count: pos.length,
            content: pos.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.map((p) => (
                    <TableRow key={p.id} className="h-8 text-[13px]">
                      <TableCell>
                        <DocLink r={{ type: "purchaseOrder", id: p.id }} />
                      </TableCell>
                      <TableCell>{p.title}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(poTotal(p), p.currency)}</TableCell>
                      <TableCell>
                        <StatusBadge kind="purchaseOrder" status={p.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No purchase orders with this vendor" />
            ),
          },
          {
            id: "history",
            label: "History",
            count: hist.length,
            content: hist.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {[...hist].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{fmtDate(h.on)}</span> · {h.role} · {h.text}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No changes this session">Onboarding steps and quality changes are logged here with who and when.</EmptyState>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["C-31", "No PO before onboarding is Active", "[DOC:p.101 §2.1]"],
              ["C-32", "Restricted: Purchasing Manager override per PO. Disqualified: new POs hard-blocked", "[DOC:p.101 §2.1]"],
              ["OQ-PF-8", "Disqualified suspends the vendor's AVL rows (cascade)", "reading"],
              ["OQ-PF-17", "Under Review to Active is the Controller's financial release", "reading"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg === "onb"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Move ${v.name} to ${next}`}
        confirmLabel={`Move to ${next}`}
        consequence={next === "Active" ? `Financial release: ${v.name} becomes orderable (C-31). Controller only.` : `Onboarding moves from ${v.onboarding} to ${next}.`}
        onConfirm={() => report(setVendorOnboarding(v.id, next!), `${v.id} ${next}`)}
      >
        <p className="text-sm">
          Who does which step <Reading id="OQ-PF-17" />
        </p>
      </DialogShell>
      <DialogShell
        open={dlg === "qual"}
        onOpenChange={(o) => !o && setDlg(null)}
        requireReason
        destructive={to === "Disqualified"}
        title={`Quality approval for ${v.name}`}
        confirmLabel="Record change"
        consequence={
          to === "Disqualified"
            ? `Hard-blocks new POs to ${v.name} and suspends its ${avl.filter((a) => a.status !== "Suspended").length} AVL row(s). Open draft POs are flagged.`
            : to === "Restricted"
              ? "Every new PO needs a Purchasing Manager override (C-32)."
              : "Changes the vendor's quality approval."
        }
        onConfirm={(r) => (to ? report(setVendorQuality(v.id, to, r), (n) => `Quality ${to}${n ? `; ${n} AVL row(s) suspended` : ""}`) : "Choose the new approval.")}
      >
        <SelectField id="vq" label={`New approval (now ${v.quality})`} value={to} onChange={setTo} options={(["Approved", "Conditional", "Restricted", "Disqualified"] as const).filter((x) => x !== v.quality).map((x) => ({ value: x, label: x }))} hint={<>Quality Manager, Quality engineer or Purchasing Manager <Reading id="OQ-PF-8" /></>} />
      </DialogShell>
    </>
  )
}

function AvlMenu({ id, status }: { id: string; status: string }) {
  const [to, setTo] = useState<"Qualified" | "Conditional" | "Suspended" | "">("")
  return (
    <div className="flex items-center gap-1">
      <SelectField id={`avl-${id}`} label="Set qualification" value={to} onChange={setTo} options={(["Qualified", "Conditional", "Suspended"] as const).filter((x) => x !== status).map((x) => ({ value: x, label: x }))} />
      <Button size="sm" variant="outline" className="mt-5" disabled={!to} onClick={() => to && report(setAvlStatus(id, to), `${id} ${to}`)}>
        Apply
      </Button>
    </div>
  )
}
