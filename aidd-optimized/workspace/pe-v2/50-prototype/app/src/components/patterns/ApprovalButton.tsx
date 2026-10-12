// ApprovalButton: the only way a screen asks for an approval (C-1: one shared engine, no
// module-specific approval UI). It previews the route from table F before sending (approver steps,
// whether delegation is allowed, any reading), raises the request in the shared engine, and links
// to WF-INBOX (/approvals?req=...). While a request is open it shows where it waits instead.
// The decision itself happens only in WF-INBOX; the module reacts to the "approval.decided" event.

import { Link, useNavigate } from "react-router"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { routeApproval, sameRef, type ApprovalContext, type ApprovalKind, type DocRef } from "@/data/domain"
import { fmtMoney } from "@/lib/format"
import { store, useCore } from "@/store"
import { Chip } from "./chips"

export interface ApprovalButtonProps {
  kind: ApprovalKind
  subject: DocRef
  title: string
  amount?: number
  currency?: "USD" | "CAD"
  ctx?: ApprovalContext
  label?: string
  /** "default" makes it the view's one filled primary (L-4); "outline" otherwise. */
  variant?: "default" | "outline"
  disabled?: boolean
  disabledReason?: string
  /** Stay on the page after sending (default navigates to the inbox item). */
  stay?: boolean
}

export function ApprovalButton(p: ApprovalButtonProps) {
  const core = useCore()
  const nav = useNavigate()
  const open = core.approvals.find((a) => !a.outcome && a.kind === p.kind && sameRef(a.subject, p.subject))
  const last = core.approvals.find((a) => a.outcome && a.kind === p.kind && sameRef(a.subject, p.subject))
  const route = routeApproval(p.kind, { amount: p.amount, ...p.ctx })

  if (open) {
    const waiting = open.steps.find((s) => !s.decided)
    return (
      <Link to={`/approvals?req=${open.id}`} className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm text-link underline-offset-4 hover:underline">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {open.id} waits for {waiting?.role}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={p.variant ?? "outline"} disabled={p.disabled} title={p.disabled ? p.disabledReason : undefined}>
            <ShieldCheck aria-hidden="true" />
            {p.label ?? "Send for approval"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 text-sm" align="end">
          <p className="font-semibold">{p.kind}</p>
          <p className="text-muted-foreground">{p.title}</p>
          {p.amount != null && <p className="tabular mt-1">{fmtMoney(p.amount, p.currency)}</p>}
          <ol className="mt-2 list-decimal pl-4">
            {route.steps.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            {route.rule} {route.source} (asserted)
          </p>
          <p className="mt-1 text-xs">{route.delegationAllowed ? "Delegation allowed." : "Delegation not allowed: financial approval above $250,000 (C-2)."}</p>
          {route.reading && (
            <div className="mt-2">
              <Chip kind="design" note={route.reading}>
                Routing reading
              </Chip>
              <p className="mt-1 text-xs text-muted-foreground">{route.reading}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                const req = store.raiseApproval({ kind: p.kind, subject: p.subject, title: p.title, amount: p.amount, currency: p.currency, ctx: p.ctx })
                if (!p.stay) nav(`/approvals?req=${req.id}`)
              }}
            >
              Send to {route.steps[0]}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {last && (
        <span className="text-xs text-muted-foreground">
          Last request {last.id}: {last.outcome}
        </span>
      )}
    </span>
  )
}
