// FX-MM-CONSIGN: Consignment settlement run [Book II §14.2]. Monthly, per vendor: the unsettled
// withdrawals of a closed period are priced from the info record basis valid on the withdrawal
// date, previewed as a self-billing document (ACC-6), and posted. A deviation at true-up posts to
// 5215 and needs the Controller. Withdrawals already billed show their settlement and are read-only.

import { useMemo, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, WizardPage } from "@/components/templates"
import { Button } from "@/components/ui/button"
import { Chip, DataTable, EmptyState, RulesPanel, type Column } from "@/components/patterns"
import { vendorById } from "@/data/shared"
import { TODAY } from "@/data/shared"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import type { Settlement } from "../data/ext"
import { runSettlement, settlementLines } from "../data/ext-actions"
import { MatLink, Reading, Section, TextPostingPreview, userName } from "../components/common"
import { useViewState } from "../components/states"

const vname = (id: string) => `${id} ${vendorById(id)?.name ?? ""}`.trim()

export function ConsignmentSettlement() {
  const s = useSlice("materials")
  const [role] = useRole()
  const st = useViewState("FX-MM-CONSIGN", { degradedWhat: "The info record price service is slow", authorizedRoles: ["Cost accountant", "Controller"] })
  const periods = useMemo(() => [...new Set(s.x.withdrawals.map((w) => w.on.slice(0, 7)))].sort(), [s.x.withdrawals])
  const vendors = useMemo(() => [...new Set(s.x.withdrawals.map((w) => w.vendorId))], [s.x.withdrawals])
  const [vendor, setVendor] = useState<string>(vendors[0] ?? "")
  const [period, setPeriod] = useState(periods.filter((p) => p < TODAY.slice(0, 7)).at(-1) ?? periods[0] ?? "")
  const [trueUp, setTrueUp] = useState("0")
  const [doneId, setDoneId] = useState<string | null>(null)
  const lines = settlementLines(s, vendor, period)
  const total = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100
  const already = s.x.settlements.find((x) => x.vendorId === vendor && x.period === period)
  const tu = Number(trueUp) || 0
  const closed = period < TODAY.slice(0, 7)
  const unsettledByVendor = useMemo(
    () => vendors.map((v) => ({ vendor: v, qty: s.x.withdrawals.filter((w) => w.vendorId === v && !w.settledIn).length, open: s.x.withdrawals.filter((w) => w.vendorId === v && !w.settledIn).reduce((a, w) => a + w.qty * (settlementLines(s, v, w.on.slice(0, 7)).find((l) => l.withdrawalId === w.id)?.basis ?? 0), 0) })),
    [s, vendors],
  )
  const memo = s.stock.filter((r) => r.bucket === "Consignment")
  const cols: Column<Settlement>[] = [
    { id: "id", header: "Settlement", value: (x) => x.id, mono: true, sortable: true },
    { id: "v", header: "Vendor", value: (x) => vname(x.vendorId), filterable: true },
    { id: "p", header: "Period", value: (x) => x.period, mono: true, sortable: true },
    { id: "n", header: "Lines", value: (x) => x.lines.length, align: "right", mono: true },
    { id: "t", header: "Billed", value: (x) => x.total, align: "right", mono: true, cell: (x) => fmtMoney(x.total) },
    { id: "tu", header: "True-up (5215)", value: (x) => x.trueUp, align: "right", mono: true, cell: (x) => (x.trueUp ? fmtMoney(x.trueUp) : "None") },
    { id: "on", header: "Posted", value: (x) => x.postedOn, cell: (x) => `${fmtDate(x.postedOn)} by ${userName(x.by)}` },
    { id: "b", header: "Self-bill", value: (x) => x.billRef },
  ]
  const history = (
    <div className="mt-8 flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Settlement history</h2>
      <DataTable rows={st.empty ? [] : s.x.settlements} columns={cols} rowId={(x) => x.id} loading={st.loading} error={st.error} onRetry={st.onRetry} toolbar={st.toolbar} densityKey="FX-MM-CONSIGN" empty={{ title: "No settlement posted yet" }} initialSort={{ id: "p", dir: "desc" }} />
    </div>
  )
  const posted = doneId ? s.x.settlements.find((x) => x.id === doneId) : undefined
  if (posted)
    return (
      <>
        <div className="flex flex-col gap-4">
          <PageHeader
            screenId="FX-MM-CONSIGN"
            title={`Settlement ${posted.id} posted`}
            description={`${vname(posted.vendorId)} · period ${posted.period} · ${posted.lines.length} withdrawal(s) · ${posted.billRef}`}
            chips={<Chip kind="design">Posted {fmtDate(posted.postedOn)}</Chip>}
            primary={<Button onClick={() => (setDoneId(null), setTrueUp("0"))}>Settle another vendor or period</Button>}
          />
          <Section title="Billed lines">
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Withdrawal</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Basis / unit</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {posted.lines.map((l) => (
                  <TableRow key={l.withdrawalId}><TableCell className="font-mono">{l.withdrawalId}</TableCell><TableCell><MatLink id={l.materialId} /></TableCell><TableCell className="tabular text-right">{fmtNumber(l.qty)}</TableCell><TableCell className="tabular text-right">{fmtMoney(l.basis)}</TableCell><TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="tabular text-right text-sm font-semibold">Total {fmtMoney(posted.total)}{posted.trueUp ? ` · true-up ${fmtMoney(posted.trueUp)} to 5215` : ""}</p>
          </Section>
        </div>
        {history}
      </>
    )
  return (
    <>
      {st.banners}
      <WizardPage
        header={{
          screenId: "FX-MM-CONSIGN",
          title: "Consignment settlement run",
          description: "Month-end, per vendor: price the withdrawals from the info record basis, preview the self-billing document, post. The memo balance against 2120 clears as lines settle.",
          chips: <Reading id="RD-MM-34" />,
          actions: <Link to="/inventory/special-stock" className="text-sm text-link underline-offset-4 hover:underline">Special stock</Link>,
        }}
        finishLabel={`Post settlement`}
        consequence={`Posts the settlement for ${vendor || "the vendor"} ${period}: ${lines.length} withdrawal(s) billed ${fmtMoney(total)} through self-billing${tu ? `, with a true-up of ${fmtMoney(tu)} to 5215` : ""}. It cannot be edited afterwards; a mistake is reversed by a correcting document.`}
        onFinish={() => {
          if (!st.canWrite) return st.blockedWhy ?? "Blocked"
          const r = runSettlement(vendor, period, tu)
          if (!r.ok) return r.error
          setDoneId(r.value)
          toast.success(`${r.value} posted: ${fmtMoney(total)} billed to ${vendor}`)
          return null
        }}
        steps={[
          {
            id: "scope",
            title: "Vendor and period",
            validate: () => (!vendor ? "Choose a vendor." : !period ? "Choose a period." : !closed ? `Period ${period} has not ended: withdrawals settle after month-end.` : already ? `Period ${period} is already settled for ${vendor} (${already.id}).` : lines.length === 0 ? `No unsettled withdrawals for ${vendor} in ${period}.` : null),
            content: (
              <div className="flex max-w-xl flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cs-vendor">Vendor</Label>
                  <Select value={vendor} onValueChange={setVendor}>
                    <SelectTrigger id="cs-vendor"><SelectValue /></SelectTrigger>
                    <SelectContent>{vendors.map((v) => <SelectItem key={v} value={v}>{vname(v)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cs-period">Period</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger id="cs-period"><SelectValue /></SelectTrigger>
                    <SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{p}{p >= TODAY.slice(0, 7) ? " (open: not settleable yet)" : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!closed && <p role="alert" className="text-sm text-destructive">Period {period} has not ended: withdrawals settle after month-end.</p>}
                {already && <p role="status" className="text-sm">Already settled as {already.id} on {fmtDate(already.postedOn)}.</p>}
                <Section title="Unsettled withdrawals by vendor">
                  <ul className="text-sm">
                    {unsettledByVendor.map((u) => (
                      <li key={u.vendor} className="flex justify-between border-b py-1 last:border-b-0"><span>{vname(u.vendor)}</span><span className="tabular">{u.qty} withdrawal(s)</span></li>
                    ))}
                  </ul>
                </Section>
              </div>
            ),
          },
          {
            id: "preview",
            title: "Withdrawals and basis",
            validate: () => (lines.length === 0 ? "Nothing to settle for this vendor and period." : lines.find((l) => !l.ir) ? `No info record basis is valid on the withdrawal date of ${lines.find((l) => !l.ir)!.withdrawalId}.` : null),
            content:
              lines.length === 0 ? (
                <EmptyState title="Nothing to settle">No unsettled withdrawals for {vendor} in {period}.</EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  <Table>
                    <TableHeader className="bg-table-head">
                      <TableRow><TableHead>Withdrawal</TableHead><TableHead>Date</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Consumed by</TableHead><TableHead>Info record</TableHead><TableHead className="text-right">Basis / unit</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l) => (
                        <TableRow key={l.withdrawalId}>
                          <TableCell className="font-mono">{l.withdrawalId}</TableCell>
                          <TableCell>{fmtDate(l.on)}</TableCell>
                          <TableCell><MatLink id={l.materialId} /></TableCell>
                          <TableCell className="tabular text-right">{fmtNumber(l.qty)} {l.uom}</TableCell>
                          <TableCell className="font-mono">{l.ref}</TableCell>
                          <TableCell>{l.ir ? <Link to={`/purchasing/info-records/${l.ir}`} className="font-mono text-link underline-offset-4 hover:underline">{l.ir}</Link> : <Chip kind="block">No basis</Chip>}</TableCell>
                          <TableCell className="tabular text-right">{l.ir ? fmtMoney(l.basis) : ""}</TableCell>
                          <TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="tabular text-right text-sm font-semibold">Self-billing total {fmtMoney(total)}</p>
                  <p className="text-xs text-muted-foreground">Each line uses the basis valid on its withdrawal date; a withdrawal earlier in the month keeps its earlier price.</p>
                </div>
              ),
          },
          {
            id: "post",
            title: "Self-bill and posting",
            validate: () => (tu !== 0 && role !== "Controller" ? `A true-up to 5215 is approved by the Controller; you are acting as ${role}.` : null),
            content: (
              <div className="flex max-w-3xl flex-col gap-4">
                <div className="flex max-w-xs flex-col gap-1">
                  <Label htmlFor="cs-tu">True-up to 5215 (vendor invoice deviation, USD)</Label>
                  <Input id="cs-tu" type="number" step="0.01" value={trueUp} onChange={(e) => setTrueUp(e.target.value)} aria-invalid={st.validation ? true : undefined} />
                  <p className="text-xs text-muted-foreground">Leave 0 unless the vendor's invoice deviates from the self-bill. Rare by design; the Controller approves it.</p>
                  {st.validation && <p className="text-xs text-destructive">A true-up is entered by the Controller only.</p>}
                </div>
                <TextPostingPreview
                  title="Postings on settlement (ACC-6 self-billing)"
                  note="Accounts from §14.2: memo liability 2120; deviation 5215. The AP side is a design value."
                  lines={[
                    { transaction: `Settle ${lines.length} withdrawal(s), ${vendor} ${period}`, debit: "2120 Consignment Payable", credit: "2100 AP (self-bill)", amount: total, detail: "Clears the memo balance for the period; invoice raised by PE under ACC-6" },
                    ...(tu !== 0 ? [{ transaction: "True-up on vendor deviation", debit: tu > 0 ? "5215 Consignment Variance" : "2100 AP (self-bill)", credit: tu > 0 ? "2100 AP (self-bill)" : "5215 Consignment Variance", amount: Math.abs(tu), detail: "Controller approval" }] : []),
                  ]}
                />
                <p className="text-sm">Acting as {role}. Settlement is posted by the Cost accountant or the Controller.</p>
              </div>
            ),
          },
        ]}
      />
      <div className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Consignment position (memo, vendor-owned)</h2>
        {memo.length === 0 ? (
          <EmptyState title="No consignment stock" />
        ) : (
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Material</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">On hand (memo)</TableHead><TableHead className="text-right">Unsettled withdrawals</TableHead></TableRow></TableHeader>
            <TableBody>
              {memo.map((r) => {
                const w = s.x.withdrawals.filter((x) => x.materialId === r.materialId && !x.settledIn)
                return (
                  <TableRow key={r.id}>
                    <TableCell><MatLink id={r.materialId} /></TableCell>
                    <TableCell>{r.pegRef ?? ""}</TableCell>
                    <TableCell className="tabular text-right">{fmtNumber(r.qty)}</TableCell>
                    <TableCell className="tabular text-right">{w.length} ({fmtNumber(w.reduce((a, x) => a + x.qty, 0))})</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
      {history}
      <RulesPanel
        rules={[
          ["§14.2", "Consignment settles monthly per vendor: withdrawals in the period are priced from the info record basis valid on the withdrawal date and billed by self-billing (ACC-6).", "[Book II §14.2]"],
          ["§14.2 true-up", "A deviation between the self-bill and the vendor invoice posts to 5215 with Controller approval.", "[Book II §14.2]"],
          ["§14.1", "Consignment stock is vendor-owned and has no commitment value until it is withdrawn.", "[Book II §14.1]"],
        ]}
      />
    </>
  )
}
