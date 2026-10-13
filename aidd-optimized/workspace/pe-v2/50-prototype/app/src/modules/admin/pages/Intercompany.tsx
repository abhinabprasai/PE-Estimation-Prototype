// FX-CFG-IC Intercompany relationships and transfer pricing [DOC: Book III F §3-4]: relationships are directed
// pairs (seller, buyer) with a transfer price list, IC account pair and tax treatment; the transfer price is cost plus a
// Controller-owned, effective-dated markup with documented rationale; price rows are never overwritten. A new pair or markup
// change is approved before it can trade (AR-39). Pairing is atomic: a partial configuration rolls the pair back (saga SAGA-0016).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, DataTable, RulesPanel } from "@/components/patterns"
import { ConfigPage, DialogShell } from "@/components/templates"
import { LEGAL_ENTITIES, TODAY } from "@/data/shared"
import { addDays, fmtDate } from "@/lib/format"
import { useCore, useSlice } from "@/store"
import { addPair, addTransferPrice, proposeMarkup } from "../data/cfg-actions"
import type { IcMarkup, IcPair, IcPrice } from "../data/cfg-types"
import { can, inForce, nextOf, verState } from "../lib/cfg"
import { Field, SimpleSelect, StateText } from "../components/common"
import { StateFrame, StatePicker, useView } from "../components/states"

const ent = (id: string) => LEGAL_ENTITIES.find((e) => e.id === id)?.name ?? id

export function Intercompany() {
  const [params, setParams] = useSearchParams()
  const section = params.get("section") ?? "pairs"
  const s = useSlice("adminCfg")
  const a = useSlice("admin")
  const { role } = useCore()
  const view = useView("FX-CFG-IC")
  const [dlg, setDlg] = useState<null | "pair" | "price" | { markup: IcMarkup }>(null)
  const [p, setP] = useState({ seller: LEGAL_ENTITIES[0].id as string, buyer: LEGAL_ENTITIES[1].id as string, priceList: "", tax: "Taxable at transfer price; no withholding" })
  const [pr, setPr] = useState({ pair: s.icPairs[0]?.id ?? "", material: "", price: "", from: addDays(TODAY, 1) })
  const [mk, setMk] = useState({ pct: "", rationale: "", from: addDays(TODAY, 23) })
  const allowed = can.transferPrice(role) && !view.writeError()
  const pending = (x: IcPair) => (x.requestId ? a.instances.find((i) => i.id === x.requestId)?.outcome : undefined)
  const pairState = (x: IcPair) => (x.requestId && !pending(x) ? "Pending approval" : x.live || pending(x) === "Approved" ? "Trading" : x.requestId ? "Rejected" : "Defined, not trading")
  return (
    <ConfigPage
      header={{
        title: "Intercompany and transfer pricing",
        screenId: "FX-CFG-IC",
        description: "Directed seller and buyer pairs, their transfer price lists and the Controller's markup table. A pair trades only when its configuration is complete and approved.",
        chips: <Chip kind="design" note="Route /configuration/intercompany is a design value; the rules are Book III F §3-4">Design route</Chip>,
        actions: <StatePicker view={view} />,
        primary: <Button onClick={() => setDlg("pair")} disabled={!allowed} title={can.transferPrice(role) ? undefined : "Controlling maintains intercompany configuration"}>New pair</Button>,
      }}
      sections={[{ id: "pairs", label: "Relationships" }, { id: "markups", label: "Markup table" }, { id: "prices", label: "Transfer prices" }]}
      section={section}
      onSectionChange={(id) => setParams({ section: id })}
      effectiveDated
    >
      <StateFrame view={view} cols={6} emptyTitle="No intercompany relationships." emptyBody="Define a pair to let one entity sell to another." degraded="Degraded: the intercompany matching job is delayed. Configuration is unaffected." subject="intercompany configuration">
        {section === "pairs" && (
          <DataTable<IcPair>
            rows={view.empty ? [] : s.icPairs}
            rowId={(x) => x.id}
            loading={view.loading}
            densityKey="FX-CFG-IC-pairs"
            caption="Intercompany pairs"
            columns={[
              { id: "id", header: "Pair", value: (x) => x.id, mono: true },
              { id: "se", header: "Seller", value: (x) => ent(x.seller) },
              { id: "bu", header: "Buyer", value: (x) => ent(x.buyer) },
              { id: "pl", header: "Transfer price list", value: (x) => x.priceList, mono: true },
              { id: "ac", header: "IC account pair", value: (x) => x.accountPair, className: "max-w-[220px]" },
              { id: "tx", header: "Tax treatment", value: (x) => x.taxTreatment, className: "max-w-[240px]" },
              { id: "st", header: "State", value: (x) => pairState(x), filterable: true, cell: (x) => <span className="text-xs"><StateText tone={pairState(x) === "Trading" ? "default" : "attention"}>{pairState(x)}</StateText>{x.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${x.requestId}`}>{x.requestId}</Link></>}</span> },
            ]}
          />
        )}
        {section === "markups" && (
          <>
            <DataTable<IcMarkup>
              rows={view.empty ? [] : s.icMarkups}
              rowId={(m) => m.id}
              loading={view.loading}
              densityKey="FX-CFG-IC-markups"
              caption="Transfer price markups"
              columns={[
                { id: "pair", header: "Pair", value: (m) => m.pairId, mono: true, filterable: true },
                { id: "fam", header: "Product family", value: (m) => m.family },
                { id: "pct", header: "Markup", value: (m) => inForce(m.versions, a.instances)?.value.markupPct ?? 0, align: "right", mono: true, cell: (m) => { const v = inForce(m.versions, a.instances); return v ? `${v.value.markupPct}%` : <span className="text-xs text-muted-foreground">Not yet in force</span> } },
                { id: "why", header: "Rationale", value: (m) => inForce(m.versions, a.instances)?.value.rationale ?? "", className: "max-w-[280px]" },
                { id: "nx", header: "Next version", value: (m) => nextOf(m.versions, a.instances)?.value.markupPct ?? "", cell: (m) => { const n = nextOf(m.versions, a.instances); return n ? <span className="text-xs">{n.value.markupPct}% from {fmtDate(n.effectiveFrom)} · <StateText tone="attention">{verState(n, m.versions, a.instances)}</StateText>{n.requestId && <> · <Link className="font-mono text-link underline-offset-4 hover:underline" to={`/approvals?req=${n.requestId}`}>{n.requestId}</Link></>}</span> : "" } },
                { id: "a", header: "", cell: (m) => <Button size="sm" variant="outline" disabled={!allowed} onClick={() => { setMk({ pct: "", rationale: "", from: addDays(TODAY, 23) }); setDlg({ markup: m }) }}>Propose change</Button> },
              ]}
            />
            <p className="mt-2 max-w-3xl text-xs text-muted-foreground">Markups are owned by the Controller and effective-dated; a change needs the rationale (tax compliance file) and goes to the CFO when the Controller raises it, otherwise to the Controller (AR-39). Transfers already priced keep their price.</p>
          </>
        )}
        {section === "prices" && (
          <>
            <div className="mb-2"><Button variant="outline" onClick={() => setDlg("price")} disabled={!allowed}>Add transfer price</Button></div>
            <DataTable<IcPrice>
              rows={view.empty ? [] : s.icPrices}
              rowId={(x) => x.id}
              loading={view.loading}
              densityKey="FX-CFG-IC-prices"
              caption="Transfer price rows"
              columns={[
                { id: "pair", header: "Pair", value: (x) => x.pairId, mono: true, filterable: true },
                { id: "mat", header: "Material", value: (x) => x.material, mono: true, sortable: true },
                { id: "pr", header: "Price", value: (x) => x.price, align: "right", mono: true, cell: (x) => `${x.currency} ${x.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
                { id: "vf", header: "Valid from", value: (x) => x.validFrom, sortable: true, cell: (x) => fmtDate(x.validFrom) },
                { id: "vt", header: "Valid to", value: (x) => x.validTo ?? "", cell: (x) => (x.validTo ? fmtDate(x.validTo) : <StateText>Open</StateText>) },
              ]}
            />
            <p className="mt-2 max-w-3xl text-xs text-muted-foreground">A price row is never overwritten: a new row closes the open one the day before it starts. A material with no row for the pair fails the pairing and rolls it back (SAGA-0016, <Link className="text-link underline-offset-4 hover:underline" to="/operations/integrations?saga=SAGA-0016">saga view</Link>).</p>
          </>
        )}
      </StateFrame>
      <RulesPanel rules={[["F§3", "Intercompany relationship: directed pair, transfer price list, IC account pair, tax treatment", "DOC: Book III F §3"], ["F§4", "Transfer price = cost plus a Controller-owned effective-dated markup with documented rationale; rows are never overwritten", "DOC: Book III F §4"], ["F§3-b", "Pairing is atomic: both documents exist or neither does", "DOC: Book III F §3"]]} />
      <DialogShell open={dlg === "pair"} onOpenChange={(o) => !o && setDlg(null)} title="New intercompany pair" consequence="Raises the pair for approval. It cannot trade until it is approved, and a pair is directed: the reverse is defined separately." confirmLabel="Send for approval" onConfirm={() => { const e = view.run(() => addPair(p.seller, p.buyer, p.priceList, p.tax)); if (!e) setDlg(null); return e }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ic-se" label="Seller"><SimpleSelect id="ic-se" value={p.seller} onChange={(v) => setP({ ...p, seller: v })} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>
          <Field id="ic-bu" label="Buyer"><SimpleSelect id="ic-bu" value={p.buyer} onChange={(v) => setP({ ...p, buyer: v })} options={LEGAL_ENTITIES.map((e) => ({ value: e.id, label: e.name }))} /></Field>
          <Field id="ic-pl" label="Transfer price list" hint="For example ICPL-TBD-PT-GC"><Input id="ic-pl" value={p.priceList} onChange={(e) => setP({ ...p, priceList: e.target.value })} /></Field>
          <Field id="ic-tx" label="Tax treatment"><Input id="ic-tx" value={p.tax} onChange={(e) => setP({ ...p, tax: e.target.value })} /></Field>
        </div>
      </DialogShell>
      <DialogShell open={dlg === "price"} onOpenChange={(o) => !o && setDlg(null)} title="Add transfer price" consequence="Adds a dated price row; the open row for the same material ends the day before." confirmLabel="Add price" onConfirm={() => { const e = view.run(() => addTransferPrice(pr.pair, pr.material, Number(pr.price), pr.from)); if (!e) setDlg(null); return e }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ip-pair" label="Pair"><SimpleSelect id="ip-pair" value={pr.pair} onChange={(v) => setPr({ ...pr, pair: v })} options={s.icPairs.map((x) => ({ value: x.id, label: `${x.id} ${x.seller} to ${x.buyer}` }))} /></Field>
          <Field id="ip-mat" label="Material"><Input id="ip-mat" value={pr.material} onChange={(e) => setPr({ ...pr, material: e.target.value })} /></Field>
          <Field id="ip-price" label="Price"><Input id="ip-price" type="number" min={0} step="0.01" value={pr.price} onChange={(e) => setPr({ ...pr, price: e.target.value })} /></Field>
          <Field id="ip-from" label="Valid from"><Input id="ip-from" type="date" value={pr.from} onChange={(e) => setPr({ ...pr, from: e.target.value })} /></Field>
        </div>
      </DialogShell>
      <DialogShell open={typeof dlg === "object" && !!dlg} onOpenChange={(o) => !o && setDlg(null)} title={typeof dlg === "object" && dlg ? `Propose markup change: ${dlg.markup.pairId} ${dlg.markup.family}` : ""} consequence={`Creates a new dated version (${mk.pct || "new"}% from ${mk.from}) and sends it for approval.`} requireReason reasonLabel="Why it changes (required)" confirmLabel="Send for approval" onConfirm={(note) => { if (typeof dlg !== "object" || !dlg) return null; const e = view.run(() => proposeMarkup(dlg.markup.id, Number(mk.pct), mk.rationale, mk.from, note)); if (!e) setDlg(null); return e }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="mk-pct" label="New markup (%)" hint={typeof dlg === "object" && dlg ? `In force: ${inForce(dlg.markup.versions, a.instances)?.value.markupPct ?? "none"}%` : undefined}><Input id="mk-pct" type="number" min={0} max={40} value={mk.pct} onChange={(e) => setMk({ ...mk, pct: e.target.value })} /></Field>
          <Field id="mk-from" label="Effective from"><Input id="mk-from" type="date" value={mk.from} onChange={(e) => setMk({ ...mk, from: e.target.value })} /></Field>
          <Field id="mk-why" label="Rationale (tax compliance file reference)" className="md:col-span-2"><Input id="mk-why" value={mk.rationale} onChange={(e) => setMk({ ...mk, rationale: e.target.value })} /></Field>
        </div>
      </DialogShell>
    </ConfigPage>
  )
}
