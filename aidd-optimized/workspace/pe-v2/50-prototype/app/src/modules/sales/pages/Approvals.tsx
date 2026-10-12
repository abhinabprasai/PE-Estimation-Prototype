// WF-INBOX. Approval request status: the PRD gives no list (OQ-21). Pending items and an activity
// entry after a decision are shown; no status badge on approval items.
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, DensityToggle, EmptyState, ErrorAlert, RulesPanel, SkeletonRows, StatusBadge, rowCls, useFirstVisitLoading, type Density } from "../components/common"
import { useStore } from "../data/store"
import { listDate, money, type Approval } from "../data/model"

export function ApprovalsInbox() {
  const { db, role, actions } = useStore()
  const loading = useFirstVisitLoading("approvals")
  const [density, setDensity] = useState<Density>("compact")
  const [err, setErr] = useState<string | null>(null)
  const [raise, setRaise] = useState<Approval | null>(null)
  const [limit, setLimit] = useState("")
  const [stub, setStub] = useState<string | null>(null)
  const mine = db.approvals.filter((a) => !a.decided && a.forRoles.includes(role))
  const decided = db.approvals.filter((a) => a.decided)

  const decide = (a: Approval, d: "release" | "reject" | "approve" | "raise", newLimit?: number) => {
    const r = actions.decide(a.id, d, newLimit)
    if (!r.ok) {
      setErr(r.error)
      return false
    }
    setErr(null)
    toast.success("Decision recorded.")
    return true
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Approvals inbox</h1>
        <span className="text-sm">
          Queue for <strong>{role}</strong> · {mine.length} waiting
        </span>
        <div className="ml-auto">
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        One shared approval engine (R-3): every approve, release and reject decision happens here. Credit releases go to Finance (credit); Controller only raises limits <Chip kind="oq" id="OQ-33" />. Switch "Acting as" to see another role's queue.
      </p>
      {err && (
        <div className="mb-4">
          <ErrorAlert title="Decision not recorded" onDismiss={() => setErr(null)}>
            {err}
          </ErrorAlert>
        </div>
      )}
      {!loading && mine.length === 0 ? (
        <EmptyState title="Nothing waiting for you. Credit releases and no-quote order approvals for your role appear here." />
      ) : (
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows cols={7} rows={6} />
            ) : (
              mine.map((a) => {
                const o = db.orders.find((x) => x.id === a.soId)!
                const c = db.customers.find((x) => x.id === o.customerId)!
                const over = a.amount > 250000
                return (
                  <TableRow key={a.id} className={rowCls(density)}>
                    <TableCell>
                      {a.kind}
                      <div className="text-xs text-muted-foreground">{a.id}</div>
                    </TableCell>
                    <TableCell>
                      <Link className="text-link underline" to={`/sales/orders/${o.id}`}>
                        {o.id}
                      </Link>{" "}
                      <StatusBadge entity="order" status={o.status} />
                    </TableCell>
                    <TableCell className="max-w-64 truncate" title={c.name}>
                      {c.name} {c.creditHold && <Chip kind="hold" />}
                    </TableCell>
                    <TableCell className="tabular text-right">{money(a.amount, a.currency)}</TableCell>
                    <TableCell className="max-w-72 text-xs whitespace-normal">{a.reason}</TableCell>
                    <TableCell>{listDate(a.raised)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {a.kind === "Credit Release" && role === "Finance (credit)" && (
                          <>
                            <Button size="sm" onClick={() => decide(a, "release")}>
                              Release
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "reject")}>
                              Reject
                            </Button>
                            <Chip kind="oq" id="OQ-28" note="Finance Reject sets the order to Cancelled" />
                          </>
                        )}
                        {a.kind === "Credit Release" && role === "Controller" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLimit(String(c.creditLimit + 50000))
                              setRaise(a)
                            }}
                          >
                            Raise limit
                          </Button>
                        )}
                        {a.kind !== "Credit Release" && (
                          <>
                            <Button size="sm" onClick={() => decide(a, "approve")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide(a, "reject")}>
                              Reject
                            </Button>
                          </>
                        )}
                        {over ? (
                          <span className="text-xs">
                            Delegation not allowed above $250,000 <Chip kind="oq" id="OQ-29" note="The $250,000 no-delegation rule is read as applying to credit release items" />
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setStub("Delegation is a stub in this prototype: the shared approval engine's delegate list is not built.")}>
                            Delegate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}
      <h2 className="mt-8 mb-2 font-semibold">Decided (activity)</h2>
      {decided.length === 0 ? (
        <p className="text-sm text-muted-foreground">No decisions yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {decided.map((a) => (
            <li key={a.id}>
              <span className="tabular text-muted-foreground">{a.decided!.on}</span> · {a.kind} · {a.soId}: {a.decided!.text}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!raise} onOpenChange={() => setRaise(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise credit limit (Controller)</DialogTitle>
            <DialogDescription>The credit check reruns at the new limit. If it still fails, nothing changes.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="limit">New credit limit</Label>
          <Input id="limit" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaise(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (raise && decide(raise, "raise", Number(limit))) setRaise(null)
              }}
            >
              Raise limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!stub} onOpenChange={() => setStub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not built in this prototype</DialogTitle>
            <DialogDescription>{stub}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <RulesPanel
        rules={[
          ["R-2", "Sales roles cannot release credit holds; release, reject and raise-limit live in the Finance queue; raise limit is Controller only.", "DOC:p.49 §2.2; p.176 f13"],
          ["R-3", "One shared approval engine; no module-specific approval UI.", "DOC:p.10 W.1"],
          ["R-4", "No delegation of financial approvals above $250,000 (Delegate absent, not disabled).", "DOC:pp.10-11 §W"],
          ["R-5", "Direct-entry orders above $250,000.00 without a quote need Sales Director approval (R-OM-02).", "DOC:p.52 §4.1"],
        ]}
      />
    </div>
  )
}

/** WF-INBOX section name used by the app shell (FL-09 keeps its own credit and R-OM-02 queue). */
export { ApprovalsInbox as Fl09InboxSection }
