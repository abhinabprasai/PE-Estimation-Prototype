// FX-PRC-AGREEMENTS Customer price agreements (/pricing/agreements, /pricing/agreements/:id); source Book I I §6.2 [DOC:p.122]:
// "Contract container: customer, validity, scope (items / groups), rates or discount matrix off a base list, volume rebate terms
// (accrual note to ACC), attachment of signed contract. Rows surface on the item Sales tab §4.3 and resolve at precedence step 2 of
// the Pricing Service" (after a manual override, before the customer's price list). Contract term Fixed at Order / Ship-Date
// Adjusted drives the surcharge treatment (§6.4). A row below the margin floor goes through the breach chain (§6.3). The agreement
// has no status list in the specification (OQ-21): state is text. Route and archetype are design values.
import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { FilePlus2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApprovalButton, Chip, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import type { MaterialId } from "@/data/domain"
import { CUSTOMERS, MATERIALS } from "@/data/shared"
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format"
import { useSlice } from "@/store"
import { setAgreementTerm } from "../data/actions"
import { material, stdOf } from "../data/logic"
import { effectiveFloor, marginOf } from "../data/xlogic"
import { activateAgreement, addAgreementRow, attachAgreementContract, createAgreement, expireAgreement, removeAgreementRow, setAgreementRebate } from "../data/xactions"
import type { AgreementRec, ContractTerm } from "../data/types"
import { CsvButton, Design, Reading, report, Section, TextState } from "../components/common"
import { customerName, DetailFrame, ItemLink, RecLink, SelectField, TextField, userName } from "../components/bits"
import { LockedNote, StateGate, useNineStates, writeProps, type NineStates } from "../components/states"

const stateOf = (a: AgreementRec) => a.state ?? "Active"
const SELLABLE = MATERIALS.filter((m) => ["FIN", "TRADE", "SPARE"].includes(m.type) && m.status === "Active")
const CUR = (customerId: string) => CUSTOMERS.find((c) => c.id === customerId)?.currency ?? "USD"

function rowChecks(s: ReturnType<typeof useSlice<"purchasingFinance">>, a: AgreementRec) {
  const conv = CUR(a.customerId) === "CAD" ? 1.36 : 1
  return a.rows.map((r) => {
    const cost = stdOf(s, r.itemId)
    const fl = effectiveFloor(s, r.itemId)
    const margin = cost != null ? marginOf(r.price / conv, cost) : undefined
    const list = s.priceLists.find((p) => p.id === (a.baseListId ?? CUSTOMERS.find((c) => c.id === a.customerId)?.priceListId))?.rates.find((x) => x.itemId === r.itemId)?.price
    const below = fl.pct != null && margin != null && margin < fl.pct
    return { r, cost, fl, margin, below, points: below ? Math.round((fl.pct! - margin!) * 10) / 10 : 0, list, vsList: list ? Math.round((r.price / list - 1) * 1000) / 10 : undefined }
  })
}

export function AgreementList() {
  const s = useSlice("purchasingFinance")
  const nav = useNavigate()
  const st = useNineStates("FX-PRC-AGREEMENTS", { writers: "the Pricing Manager or Sales admin", validation: ["Choose the customer.", "The end date must be after the start date.", "Name the scope."] })
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ customerId: "", name: "", from: "", to: "", scope: "", term: "Fixed at Order" as ContractTerm, base: "" })
  const cols: Column<AgreementRec>[] = [
    { id: "id", header: "Agreement", value: (r) => r.id, sortable: true, mono: true },
    { id: "cust", header: "Customer", value: (r) => customerName(r.customerId), filterable: true },
    { id: "name", header: "Name", value: (r) => r.name, cell: (r) => <span className="line-clamp-2 max-w-[300px]">{r.name}</span> },
    { id: "valid", header: "Valid", value: (r) => r.validFrom, sortable: true, cell: (r) => `${fmtDate(r.validFrom)} to ${fmtDate(r.validTo)}` },
    { id: "term", header: "Contract term", value: (r) => r.contractTerm, filterable: true },
    { id: "rows", header: "Rows", value: (r) => r.rows.length, align: "right", mono: true },
    { id: "rebate", header: "Rebate", value: (r) => r.rebate ?? "None", cell: (r) => <span className="line-clamp-2 max-w-[220px]">{r.rebate ?? "None"}</span> },
    { id: "state", header: "State", value: stateOf, filterable: true, cell: (r) => <TextState value={stateOf(r)} /> },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-PRC-AGREEMENTS",
          title: "Customer price agreements",
          description: "Customer-specific prices that win over the customer's price list, with rebate terms and the signed contract.",
          chips: <Design note="Route and archetype are design values; the container is Book I I §6.2" />,
          actions: (
            <>
              {st.menu}
              <CsvButton filename="price-agreements.csv" rows={s.agreements.map((a) => ({ Agreement: a.id, Customer: a.customerId, From: a.validFrom, To: a.validTo, Term: a.contractTerm, State: stateOf(a) }))} />
            </>
          ),
          primary: (
            <Button onClick={() => setDlg(true)} {...writeProps(st)}>
              <FilePlus2 aria-hidden="true" /> New agreement
            </Button>
          ),
          children: st.banner,
        }}
        table={{
          rows: st.empty ? [] : s.agreements,
          columns: cols,
          rowId: (r) => r.id,
          rowHref: (r) => `/pricing/agreements/${r.id}`,
          searchText: (r) => `${r.id} ${r.name} ${customerName(r.customerId)}`,
          loading: st.loading,
          densityKey: "FX-PRC-AGREEMENTS",
          empty: { title: "No customer price agreements", body: "Without one, pricing resolves from the customer's price list, then the item default." },
        }}
        below={
          <RulesPanel
            rules={[
              ["I §6.2", "Agreement rows resolve at precedence step 2 of the Pricing Service", "[DOC:p.122; p.28 §4]"],
              ["I §6.4", "Contract term Fixed at Order or Ship-Date Adjusted drives the surcharge re-fire (#38 true-up at PGI)", "[DOC:p.122]"],
              ["I §6.3", "A row below the margin floor routes Pricing Manager, Sales Director, and the CFO below floor minus 5 points", "[DOC:p.122]"],
              ["OQ-21", "No status list for agreements: state shown as text", "[DOC:OQ-21]"],
            ]}
          />
        }
      />
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        title="New customer price agreement"
        confirmLabel="Create draft"
        consequence="Creates a Draft agreement. Add price rows and the signed contract, then activate it; the rows resolve in pricing only once Active."
        onConfirm={() => {
          if (st.guard()) return st.guard()
          const r = createAgreement({ customerId: f.customerId, name: f.name, validFrom: f.from, validTo: f.to, scope: f.scope, contractTerm: f.term, baseListId: f.base || undefined })
          const err = report(r, (id) => `${id} created`)
          if (r.ok) nav(`/pricing/agreements/${r.value}`)
          return err
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="ag-c" label="Customer" value={f.customerId} onChange={(v) => setF({ ...f, customerId: v })} options={CUSTOMERS.filter((c) => c.status === "Active").map((c) => ({ value: c.id, label: `${c.id} ${c.name.slice(0, 36)}` }))} />
          <TextField id="ag-n" label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
          <TextField id="ag-f" type="date" label="Valid from" value={f.from} onChange={(v) => setF({ ...f, from: v })} />
          <TextField id="ag-t" type="date" label="Valid to" value={f.to} onChange={(v) => setF({ ...f, to: v })} />
          <TextField id="ag-s" label="Scope (items or groups)" value={f.scope} onChange={(v) => setF({ ...f, scope: v })} />
          <SelectField id="ag-b" label="Base price list" value={f.base} onChange={(v) => setF({ ...f, base: v })} options={s.priceLists.filter((p) => p.status !== "Archived" && !p.transfer).map((p) => ({ value: p.id, label: `${p.id} ${p.name.slice(0, 28)}` }))} />
          <SelectField id="ag-term" label="Contract term" value={f.term} onChange={(v) => setF({ ...f, term: v })} options={[{ value: "Fixed at Order", label: "Fixed at Order" }, { value: "Ship-Date Adjusted", label: "Ship-Date Adjusted" }]} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: an overlapping agreement for the same customer is refused.</p>}
      </DialogShell>
    </>
  )
}

export function AgreementDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PRC-AGREEMENTS-2", { writers: "the Pricing Manager or Sales admin" })
  const a = s.agreements.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!a} title={id} screenId="FX-PRC-AGREEMENTS" back={{ label: "Price agreements", to: "/pricing/agreements" }}>
      {() => <AgreementBody a={a!} st={st} />}
    </DetailFrame>
  )
}

function AgreementBody({ a, st }: { a: AgreementRec; st: NineStates }) {
  const s = useSlice("purchasingFinance")
  const [dlg, setDlg] = useState<null | "row" | "rebate" | "attach" | "end">(null)
  const [row, setRow] = useState({ itemId: "" as MaterialId | "", price: "" })
  const [tiers, setTiers] = useState<{ aboveAmount: string; pct: string }[]>([])
  const [file, setFile] = useState("")
  const [term, setTerm] = useState<ContractTerm>(a.contractTerm)
  const state = stateOf(a)
  const ro = state === "Expired" || st.state === "readonly"
  const checks = useMemo(() => rowChecks(s, a), [s, a])
  const breaches = checks.filter((c) => c.below)
  const worst = breaches.reduce((w, c) => Math.max(w, c.points), 0)
  const primary =
    state === "Draft" ? (
      breaches.length ? (
        <ApprovalButton kind="Below price floor" subject={{ type: "approval", id: `${a.id}:floor` }} title={`${a.id} ${a.name}: ${breaches.length} row(s) below floor`} ctx={{ pointsBelowFloor: worst }} variant="default" stay disabled={!!st.blockReason || !a.attachment || !a.rows.length} disabledReason={st.blockReason ?? (!a.attachment ? "Attach the signed contract first" : !a.rows.length ? "Add a row first" : undefined)} label="Request activation below floor" />
      ) : (
        <Button onClick={() => report(activateAgreement(a.id), `${a.id} active`)} {...writeProps(st)}>Activate agreement</Button>
      )
    ) : state === "Active" ? (
      <Button variant="default" onClick={() => setDlg("row")} {...writeProps(st)}><Plus aria-hidden="true" /> Add price row</Button>
    ) : undefined
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-PRC-AGREEMENTS",
          title: `${a.id} · ${a.name}`,
          crumbs: [{ label: "Price agreements", to: "/pricing/agreements" }],
          chips: (
            <>
              {state === "Expired" && <Chip kind="design" note="A terminal record opens read-only (C-55)">Read-only</Chip>}
              {breaches.length > 0 && <Chip kind="flag" note="Rows below the margin floor need the breach chain before activation">{breaches.length} row(s) below floor</Chip>}
            </>
          ),
          actions: (
            <>
              {st.menu}
              {state === "Draft" && <Button variant="outline" {...writeProps(st)} onClick={() => setDlg("row")}><Plus aria-hidden="true" /> Add price row</Button>}
              {!ro && <Button variant="outline" {...writeProps(st)} onClick={() => { setTiers((a.rebateTiers ?? []).map((t) => ({ aboveAmount: String(t.aboveAmount), pct: String(t.pct) }))); setDlg("rebate") }}>Rebate terms</Button>}
              {!ro && <Button variant="outline" {...writeProps(st)} onClick={() => { setFile(a.attachment); setDlg("attach") }}>Signed contract</Button>}
              {state === "Active" && <Button variant="ghost" {...writeProps(st)} onClick={() => setDlg("end")}>End agreement</Button>}
            </>
          ),
          primary,
          children: st.banner,
        }}
        summary={
          <>
            <KV k="State"><TextState value={state} /></KV>
            <KV k="Customer"><RecLink to={`/sales/customers/${a.customerId}`}>{a.customerId}</RecLink> {customerName(a.customerId)}</KV>
            <KV k="Validity">{fmtDate(a.validFrom)} to {fmtDate(a.validTo)}</KV>
            <KV k="Scope">{a.scope}</KV>
            <KV k="Base list">{a.baseListId ? <RecLink to={`/pricing/price-lists/${a.baseListId}`}>{a.baseListId}</RecLink> : "Customer's price list"}{a.discountPct ? ` less ${a.discountPct}%` : ""}</KV>
            <KV k="Signed contract">{a.attachment || <span className="text-status-blocked-ink">Not attached</span>}</KV>
          </>
        }
        tabs={[
          {
            id: "rows",
            label: "Price rows",
            count: a.rows.length,
            content: (
              <StateGate st={st} cols={7} emptyTitle="No price rows" emptyBody="Add the first customer-specific price.">
                {a.rows.length ? (
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Agreement price</TableHead>
                        <TableHead className="text-right">List price</TableHead>
                        <TableHead className="text-right">Versus list</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead>Floor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checks.map((c) => (
                        <TableRow key={c.r.itemId} className="h-10 align-top text-[13px]">
                          <TableCell><ItemLink id={c.r.itemId} /></TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(c.r.price, CUR(a.customerId))}</TableCell>
                          <TableCell className="tabular text-right">{c.list ? fmtMoney(c.list, CUR(a.customerId)) : <span className="text-muted-foreground">Not on list</span>}</TableCell>
                          <TableCell className="tabular text-right">{c.vsList != null ? fmtPct(c.vsList) : ""}</TableCell>
                          <TableCell className="tabular text-right">{c.margin != null ? fmtPct(c.margin) : <span className="text-muted-foreground">No standard</span>}</TableCell>
                          <TableCell>
                            {c.fl.pct != null ? `${c.fl.pct}% (${c.fl.level})` : <span className="text-muted-foreground">None stated</span>}
                            {c.below && <div><Chip kind="block">{c.points} points below</Chip></div>}
                          </TableCell>
                          <TableCell>
                            {state === "Draft" && <Button size="sm" variant="ghost" aria-label={`Remove ${c.r.itemId}`} {...writeProps(st)} onClick={() => report(removeAgreementRow(a.id, c.r.itemId), "Row removed")}><Trash2 aria-hidden="true" /></Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState title="No price rows">Add the first customer-specific price.</EmptyState>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Margin = (price less standard cost) / price in USD terms <Reading id="OQ-PF-11" />. Rows resolve at step 2 of the Pricing Service once the agreement is Active.</p>
              </StateGate>
            ),
          },
          {
            id: "terms",
            label: "Terms",
            content: (
              <div className="flex flex-col gap-4">
                <Section title="Contract term (surcharge treatment)">
                  <div className="flex max-w-lg items-end gap-2">
                    <SelectField id="agr-term" label="Contract term" value={term} onChange={setTerm} options={(["Fixed at Order", "Ship-Date Adjusted"] as const).map((x) => ({ value: x, label: x }))} hint="Ship-Date Adjusted contracts true up the surcharge at PGI through template #38." />
                    <Button variant="outline" disabled={term === a.contractTerm || ro || !!st.blockReason} title={st.blockReason ?? undefined} onClick={() => report(setAgreementTerm(a.id, term), "Contract term saved")}>Save</Button>
                  </div>
                </Section>
                <Section title="Volume rebate terms">
                  {a.rebateTiers?.length ? (
                    <ul className="text-sm">{a.rebateTiers.map((t) => <li key={t.aboveAmount}>{t.pct}% rebate above {fmtMoney(t.aboveAmount)} shipped</li>)}</ul>
                  ) : (
                    <p className="text-sm">{a.rebate ?? "No rebate."}</p>
                  )}
                  <p className="text-xs text-muted-foreground">The rebate is accrued by Accounting: this screen records the terms and sends the accrual note to ACC; nothing posts here.</p>
                </Section>
                <Section title="Signed contract">
                  <p className="text-sm">{a.attachment || "Not attached: required before activation."}</p>
                </Section>
              </div>
            ),
          },
          {
            id: "history",
            label: "History",
            count: a.history?.length ?? 0,
            content: a.history?.length ? (
              <ul className="flex flex-col gap-1 text-sm">{[...a.history].reverse().map((h, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(h.on)}</span> · {userName(h.by)} · {h.text}</li>)}</ul>
            ) : (
              <EmptyState title="No history recorded" />
            ),
          },
        ]}
        aside={ro ? <LockedNote>{state === "Expired" ? "An expired agreement is read-only." : "Read-only view."}</LockedNote> : <p className="text-xs text-muted-foreground">Activation by the Pricing Manager is a reading <Reading id="OQ-PF-37" />.</p>}
      />
      <DialogShell open={dlg === "row"} onOpenChange={(o) => !o && setDlg(null)} title={`Add a price row to ${a.id}`} confirmLabel="Add row" consequence={`Adds a customer-specific price valid ${fmtDate(a.validFrom)} to ${fmtDate(a.validTo)}. A row below the margin floor makes the agreement need the breach approval before activation.`} onConfirm={() => st.guard() ?? report(addAgreementRow(a.id, row.itemId as MaterialId, Number(row.price)), "Row added")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField id="ar-i" label="Item" value={row.itemId} onChange={(v) => setRow({ ...row, itemId: v })} options={SELLABLE.map((m) => ({ value: m.id, label: `${m.id} ${m.description.slice(0, 32)}` }))} />
          <TextField id="ar-p" type="number" label={`Price (${CUR(a.customerId)})`} value={row.price} onChange={(v) => setRow({ ...row, price: v })} />
        </div>
        {st.validation && <p role="alert" className="text-sm text-destructive">Preview: a price of zero or an item already on the agreement is refused.</p>}
        {row.itemId && row.price && material(row.itemId) && (() => {
          const cost = stdOf(s, row.itemId as string)
          const fl = effectiveFloor(s, row.itemId as string)
          const m = cost != null ? marginOf(Number(row.price) / (CUR(a.customerId) === "CAD" ? 1.36 : 1), cost) : undefined
          return <p className="text-sm">Margin {m != null ? fmtPct(m) : "n/a (no standard)"}; floor {fl.pct != null ? `${fl.pct}% (${fl.level})` : "none stated"}{fl.pct != null && m != null && m < fl.pct ? ` : ${Math.round((fl.pct - m) * 10) / 10} points below` : ""}.</p>
        })()}
      </DialogShell>
      <DialogShell
        open={dlg === "rebate"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Rebate terms for ${a.id}`}
        confirmLabel="Save terms"
        consequence="Records the volume rebate tiers and sends the accrual note to ACC. Leave empty for none."
        onConfirm={() => st.guard() ?? report(setAgreementRebate(a.id, tiers.filter((t) => t.aboveAmount !== "" || t.pct !== "").map((t) => ({ aboveAmount: Number(t.aboveAmount), pct: Number(t.pct) }))), "Rebate terms saved")}
      >
        <div className="flex flex-col gap-2">
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <TextField id={`rb-a-${i}`} type="number" label="Above (shipped $)" value={t.aboveAmount} onChange={(v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, aboveAmount: v } : x)))} />
              <TextField id={`rb-p-${i}`} type="number" label="Rebate %" value={t.pct} onChange={(v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, pct: v } : x)))} />
              <Button variant="ghost" size="sm" aria-label="Remove tier" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setTiers([...tiers, { aboveAmount: "", pct: "" }])}><Plus aria-hidden="true" /> Add tier</Button>
        </div>
      </DialogShell>
      <DialogShell open={dlg === "attach"} onOpenChange={(o) => !o && setDlg(null)} title={`Signed contract for ${a.id}`} confirmLabel="Attach" consequence="Attaches the signed contract PDF to the agreement; activation needs it." onConfirm={() => st.guard() ?? report(attachAgreementContract(a.id, file), "Contract attached")}>
        <TextField id="at-f" label="File name (PDF)" value={file} onChange={setFile} hint="The prototype records the file name; the file store is not simulated." />
      </DialogShell>
      <DialogShell open={dlg === "end"} onOpenChange={(o) => !o && setDlg(null)} destructive title={`End ${a.id}`} confirmLabel="End agreement" consequence="Ends the agreement today; later orders resolve from the customer's price list. Orders already priced keep their price. This ends the record." onConfirm={() => st.guard() ?? report(expireAgreement(a.id), `${a.id} ended`)} />
    </>
  )
}
