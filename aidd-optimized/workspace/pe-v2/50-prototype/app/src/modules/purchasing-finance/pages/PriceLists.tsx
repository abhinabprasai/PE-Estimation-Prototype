// PRC-PL-001 Price Lists and Agreements [DOC:p.271] (asserted); rules Book I I §6.1, §6.2, §6.3.
// List headers with basis and rounding rules, rate rows with validity and margin columns, agreement
// container with scope and rebate terms. Actions: maintain rates through dated rows, mass update
// creating new rows, approve (WF-INBOX). Transfer prices are Controlling's only (FL-07).
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Archive, Copy, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage, PageHeader } from "@/components/templates"
import { ApprovalButton, Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import type { MaterialId } from "@/data/domain"
import { CUSTOMERS, LEGAL_ENTITIES, PROFIT_CENTERS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { addRateRow, archiveList, massUpdateList, setAgreementTerm } from "../data/actions"
import { material, stdOf } from "../data/logic"
import type { AgreementRec, ContractTerm, PriceListRec } from "../data/types"
import { CsvButton, Reading, report, Section, useDemoState } from "../components/common"
import { customerName, DetailFrame, ItemLink, RecLink, SelectField, TextField, userName } from "../components/bits"

const entityName = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id

export function PriceListList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PRC-PL-001")
  const cols: Column<PriceListRec>[] = [
    { id: "id", header: "Price list", value: (r) => r.id, mono: true, sortable: true },
    { id: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className="line-clamp-2 max-w-[300px]">{r.name}</span> },
    { id: "code", header: "Code", value: (r) => r.code, filterable: true },
    { id: "entity", header: "Entity", value: (r) => r.entityId, filterable: true },
    { id: "cur", header: "Currency", value: (r) => r.currency, filterable: true },
    { id: "basis", header: "Basis", value: (r) => r.basis, cell: (r) => (r.derivation ? `${r.basis}: ${r.derivation}` : r.basis) },
    { id: "round", header: "Rounding", value: (r) => r.rounding },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, sortable: true, cell: (r) => `${fmtDate(r.validFrom)} to ${r.validTo ? fmtDate(r.validTo) : "open"}` },
    { id: "rows", header: "Rows", value: (r) => r.rates.length, align: "right", mono: true },
    { id: "status", header: "Status", value: (r) => r.status, filterable: true, cell: (r) => <StatusBadge kind="priceList" status={r.status} size="sm" /> },
  ]
  return (
    <ListPage
      header={{
        screenId: "PRC-PL-001",
        title: "Price lists and agreements",
        description: "The rates the pricing service resolves: manual override, then customer agreement, then the customer's price list, then the item default.",
        actions: (
          <>
            {st.menu}
            <CsvButton filename="price-lists.csv" rows={s.priceLists.map((r) => ({ List: r.id, Code: r.code, Entity: r.entityId, Currency: r.currency, Status: r.status, From: r.validFrom, To: r.validTo }))} />
          </>
        ),
      }}
      table={{
        rows: st.empty ? [] : s.priceLists,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/pricing/price-lists/${r.id}`,
        searchText: (r) => `${r.id} ${r.name} ${r.code}`,
        loading: st.loading,
        error: st.error,
        onRetry: st.retry,
        densityKey: "PRC-PL-001",
        empty: { title: "No price lists", body: "Create the first list by mass update from a base list, or maintain manual rates." },
      }}
      below={
        <Section title="Customer agreements">
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Agreement</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Contract term</TableHead>
                <TableHead>Rebate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.agreements.map((a) => (
                <TableRow key={a.id} className="h-8 text-[13px]">
                  <TableCell>
                    <RecLink to={`/pricing/price-lists/${a.id}`}>{a.id}</RecLink>
                  </TableCell>
                  <TableCell>{customerName(a.customerId)}</TableCell>
                  <TableCell>{a.scope}</TableCell>
                  <TableCell>
                    {fmtDate(a.validFrom)} to {fmtDate(a.validTo)}
                  </TableCell>
                  <TableCell>{a.contractTerm}</TableCell>
                  <TableCell>{a.rebate ?? "None"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      }
    />
  )
}

export function PriceListDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("PRC-PL-002")
  if (id.startsWith("AGR-")) {
    const a = s.agreements.find((x) => x.id === id)
    return (
      <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!a} title={id} screenId="PRC-PL-001" back={{ label: "Price lists", to: "/pricing/price-lists" }}>
        {() => <AgreementBody a={a!} />}
      </DetailFrame>
    )
  }
  const pl = s.priceLists.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!pl} title={id} screenId="PRC-PL-001" back={{ label: "Price lists", to: "/pricing/price-lists" }}>
      {() => <PlBody pl={pl!} menu={st.menu} />}
    </DetailFrame>
  )
}

function PlBody({ pl, menu }: { pl: PriceListRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const [dlg, setDlg] = useState<null | "row" | "mass" | "archive">(null)
  const [row, setRow] = useState({ itemId: "" as MaterialId | "", price: "", from: "" })
  const [mass, setMass] = useState({ pct: "4.5", from: "2027-01-01", name: "" })
  const conv = pl.currency === "CAD" ? 1.36 : 1
  const rows = useMemo(
    () =>
      pl.rates.map((r) => {
        const m = material(r.itemId)
        const cost = stdOf(s, r.itemId)
        const floor = PROFIT_CENTERS.find((p) => p.id === m?.profitCenterId)?.priceFloorPct
        const margin = cost != null && r.price ? ((r.price / conv - cost) / (r.price / conv)) * 100 : undefined
        return { ...r, cost, floor, margin, below: floor != null && margin != null && margin < floor, pc: m?.profitCenterId }
      }),
    [pl, s, conv],
  )
  const below = rows.filter((r) => r.below)
  const worst = below.reduce((w, r) => Math.max(w, (r.floor ?? 0) - (r.margin ?? 0)), 0)
  const terminal = pl.status === "Archived"
  const primary =
    pl.status === "Draft" || pl.status === "Pending Approval" ? (
      below.length ? (
        <ApprovalButton kind="Below price floor" subject={{ type: "approval", id: `${pl.id}:floor` }} title={`${pl.id} ${pl.name}: ${below.length} row(s) below floor`} ctx={{ pointsBelowFloor: worst }} variant="default" stay />
      ) : (
        <ApprovalButton kind="Price list approval" subject={{ type: "approval", id: `${pl.id}:list` }} title={`${pl.id} ${pl.name}`} variant="default" stay />
      )
    ) : !terminal && !pl.transfer ? (
      <Button onClick={() => setDlg("row")}>
        <Plus aria-hidden="true" /> New dated row
      </Button>
    ) : pl.transfer ? (
      <Button onClick={() => setDlg("row")}>
        <Plus aria-hidden="true" /> New transfer price row
      </Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "PRC-PL-001",
          title: `${pl.id} · ${pl.name}`,
          crumbs: [{ label: "Price lists", to: "/pricing/price-lists" }],
          chips: (
            <>
              {pl.transfer && <Chip kind="design" note="Transfer prices are maintained by Controlling only (FL-07)">Transfer prices</Chip>}
              <Reading id="OQ-PF-9" />
            </>
          ),
          actions: (
            <>
              {menu}
              {(pl.status === "Draft" || pl.status === "Pending Approval") && (
                <Button variant="outline" onClick={() => setDlg("row")}>
                  <Plus aria-hidden="true" /> New dated row
                </Button>
              )}
              {!pl.transfer && (
                <Button variant="outline" onClick={() => setDlg("mass")}>
                  <Copy aria-hidden="true" /> Mass update
                </Button>
              )}
              {pl.status === "Active" && !pl.transfer && (
                <Button variant="ghost" onClick={() => setDlg("archive")}>
                  <Archive aria-hidden="true" /> Archive
                </Button>
              )}
            </>
          ),
          primary,
        }}
        status={{ kind: "priceList", value: pl.status }}
        summary={
          <>
            <KV k="Code">{pl.code}</KV>
            <KV k="Entity">{entityName(pl.entityId)}</KV>
            <KV k="Currency">{pl.currency}</KV>
            <KV k="Validity">
              {fmtDate(pl.validFrom)} to {pl.validTo ? fmtDate(pl.validTo) : "open"}
            </KV>
            <KV k="Basis">{pl.derivation ? `${pl.basis}: ${pl.derivation}` : pl.basis}</KV>
            <KV k="Rounding">{pl.rounding}</KV>
            <KV k="Assigned customers">{CUSTOMERS.filter((c) => c.priceListId === pl.id).length}</KV>
            <KV k="Rows below floor">{below.length ? <Chip kind="flag">{below.length} below floor</Chip> : "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "rates",
            label: "Rate rows",
            count: pl.rates.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Valid from</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Standard cost (USD)</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Floor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.itemId + r.validFrom} className="h-8 text-[13px]">
                      <TableCell>
                        <ItemLink id={r.itemId} />
                      </TableCell>
                      <TableCell>{fmtDate(r.validFrom)}</TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.price, pl.currency)}</TableCell>
                      <TableCell className="tabular text-right">{r.cost != null ? fmtMoney(r.cost) : "No standard"}</TableCell>
                      <TableCell className="tabular text-right">
                        {r.margin != null ? fmtPct(r.margin) : ""} {r.below && <Chip kind="flag">Below floor</Chip>}
                      </TableCell>
                      <TableCell className="tabular text-right">{r.floor != null ? `${r.floor}% (${r.pc})` : <span className="text-muted-foreground">Not stated</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "history",
            label: "History",
            count: pl.history.length,
            content: (
              <ul className="flex flex-col gap-1 text-sm">
                {[...pl.history].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="tabular text-muted-foreground">{fmtDate(h.on)}</span> · {userName(h.by)} · {h.text}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
        aside={
          <RulesPanel
            rules={[
              ["I §6.1", "Rates are dated rows; a change is a new row, never an overwrite (C-50)", "[DOC:p.122 §6.1]"],
              ["I §6.3", "Floors: PC-100 22%, PC-300 18%; below floor goes Pricing Manager then Sales Director, more than 5 points + CFO", "[DOC:p.122 §6.3]"],
              ["FL-07", "Transfer price lists are maintained by Controlling only", "[DOC:p.181]"],
              ["OQ-PF-11", "Margin = (price − standard cost) / price; CAD lists converted at 1.36", "reading"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg === "row"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`New dated row on ${pl.id}`}
        confirmLabel="Add row"
        consequence={pl.status === "Active" ? "Adds the row and sends the Active list to Pending Approval: the change rides the approval." : "Adds an effective-dated row; rows never overlap."}
        onConfirm={() => report(addRateRow(pl.id, row.itemId as MaterialId, Number(row.price), row.from), "Row added")}
      >
        <SelectField id="r-item" label="Item" value={row.itemId} onChange={(v) => setRow({ ...row, itemId: v })} options={[...new Set(pl.rates.map((r) => r.itemId))].map((i) => ({ value: i, label: `${i} ${material(i)?.description ?? ""}` }))} />
        <TextField id="r-price" label={`Price (${pl.currency})`} value={row.price} onChange={(v) => setRow({ ...row, price: v })} />
        <TextField id="r-from" type="date" label="Valid from" value={row.from} onChange={(v) => setRow({ ...row, from: v })} />
      </DialogShell>
      <DialogShell
        open={dlg === "mass"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Mass update from ${pl.id}`}
        confirmLabel="Create draft list"
        consequence={`Creates a new Draft list with new dated rows: every rate × (1 + change %), rounded ${pl.rounding.toLowerCase()}. ${pl.id} is unchanged until the new list is approved and its date arrives.`}
        onConfirm={() => {
          const r = massUpdateList(pl.id, Number(mass.pct), mass.from, mass.name)
          const e = report(r, (n) => `${n} created`)
          if (r.ok) nav(`/pricing/price-lists/${r.value}`)
          return e
        }}
      >
        <TextField id="m-pct" label="Change %" value={mass.pct} onChange={(v) => setMass({ ...mass, pct: v })} />
        <TextField id="m-from" type="date" label="Valid from" value={mass.from} onChange={(v) => setMass({ ...mass, from: v })} />
        <TextField id="m-name" label="Name (optional)" value={mass.name} onChange={(v) => setMass({ ...mass, name: v })} />
      </DialogShell>
      <DialogShell open={dlg === "archive"} onOpenChange={(o) => !o && setDlg(null)} title={`Archive ${pl.id}`} confirmLabel="Archive" consequence="Ends the list; the pricing service no longer resolves it. Lists still assigned to customers cannot be archived." onConfirm={() => report(archiveList(pl.id), `${pl.id} archived`)} />
    </>
  )
}

function AgreementBody({ a }: { a: AgreementRec }) {
  const [term, setTerm] = useState<ContractTerm>(a.contractTerm)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="PRC-PL-001"
        title={`${a.id} · ${a.name}`}
        crumbs={[{ label: "Price lists", to: "/pricing/price-lists" }, { label: "Agreement" }]}
        chips={<Chip kind="design" note="Agreements have no status list in the specification; validity dates govern">Valid {fmtDate(a.validFrom)} to {fmtDate(a.validTo)}</Chip>}
        primary={
          <Button disabled={term === a.contractTerm} onClick={() => report(setAgreementTerm(a.id, term), "Contract term saved")}>
            Save contract term
          </Button>
        }
      />
      <dl className="grid max-w-[960px] grid-cols-2 gap-4 md:grid-cols-4">
        <KV k="Customer">
          <RecLink to={`/sales/customers/${a.customerId}`}>{a.customerId}</RecLink> {customerName(a.customerId)}
        </KV>
        <KV k="Scope">{a.scope}</KV>
        <KV k="Rebate terms">{a.rebate ?? "None"}</KV>
        <KV k="Signed agreement">{a.attachment}</KV>
      </dl>
      <div className="max-w-sm">
        <SelectField id="agr-term" label="Contract term (surcharge treatment)" value={term} onChange={setTerm} options={(["Fixed at Order", "Ship-Date Adjusted"] as const).map((x) => ({ value: x, label: x }))} hint="Ship-Date Adjusted contracts true up the surcharge at PGI through template #38." />
      </div>
      <Section title="Customer-specific prices">
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Valid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.rows.map((r) => (
              <TableRow key={r.itemId} className="h-8 text-[13px]">
                <TableCell>
                  <ItemLink id={r.itemId} />
                </TableCell>
                <TableCell className="tabular text-right">{fmtMoney(r.price, CUSTOMERS.find((c) => c.id === a.customerId)?.currency)}</TableCell>
                <TableCell>
                  {fmtDate(r.validFrom)} to {r.validTo ? fmtDate(r.validTo) : "open"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  )
}
