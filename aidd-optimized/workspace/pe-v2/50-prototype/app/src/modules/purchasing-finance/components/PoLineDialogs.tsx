// FX-PUR-POLINE: the two PO dialogs the feature list names, built once and opened from the PO detail and from the
// showcase page /purchasing/dialogs/po-line (which shows each in the nine screen states).
//  - Short-close a PO line: closes the open quantity of one line with a reason; Purchasing Manager only
//    [DOC:p.100 §1 step 7 "short-close with reason allowed (Purchasing Manager)"; p.107 role table].
//  - Restricted-vendor override: a Restricted vendor blocks new POs unless the Purchasing Manager overrides, per PO
//    with a reason [DOC:p.101 §2.1; p.107; C-32]. A Disqualified vendor is a hard block with no override.
import { DialogShell } from "@/components/templates"
import { Chip, KV, StatusBadge } from "@/components/patterns"
import { fmtMoney, fmtNumber } from "@/lib/format"
import { useRole, useSlice } from "@/store"
import { overrideRestricted } from "../data/actions"
import { shortCloseLine } from "../data/xactions"
import { vendorName, vendorOf } from "../data/logic"
import { complianceOf } from "../data/compliance"
import type { PoRec } from "../data/types"
import { Reading, report } from "./common"
import type { NineState } from "./states"

/** What a simulated state does to a dialog: the reason it blocks the confirm, or a notice shown inside it. */
export function dialogState(state: NineState | undefined, role: string, writer: string, extra?: { poRevision?: number }) {
  switch (state) {
    case "authorization": return { block: `Acting as ${role}: this is done by ${writer}.`, notice: undefined }
    case "offline": return { block: "You are offline: the change cannot be saved until the connection returns.", notice: undefined }
    case "readonly": return { block: "This PO is closed or read-only: nothing can be changed.", notice: undefined }
    case "conflict": return { block: `PO revision ${(extra?.poRevision ?? 0) + 1} was saved by another user while this dialog was open. Reload before you continue.`, notice: undefined }
    case "degraded": return { block: null, notice: "Receipt quantities come from the inventory service, which answered slowly: check the received quantity on the PO before you confirm." }
    case "validation": return { block: null, notice: "Preview of validation: a reason is required, and a line with nothing received cannot be short-closed." }
    default: return { block: null, notice: undefined }
  }
}

export function PoLineShortCloseDialog({ open, onOpenChange, po, line, state }: { open: boolean; onOpenChange: (o: boolean) => void; po: PoRec; line?: number; state?: NineState }) {
  const [role] = useRole()
  const l = po.lines.find((x) => x.no === line)
  const openQty = l ? l.qty - l.received : 0
  const g = dialogState(state, role, "the Purchasing Manager", { poRevision: po.revision })
  const lastOpen = po.lines.filter((x) => x.status !== "Cancelled" && x.no !== line && ["Open", "Partial"].includes(x.status)).length === 0
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      requireReason
      reasonLabel="Reason for closing the open quantity (required)"
      title={`Short-close ${po.id} line ${line ?? ""}`}
      description={l ? `${l.itemId}: ordered ${fmtNumber(l.qty)}, received ${fmtNumber(l.received)}` : undefined}
      confirmLabel="Short-close line"
      confirmDisabled={!!g.block || !l}
      consequence={
        l
          ? `Closes the open quantity of ${fmtNumber(openQty)} (${fmtMoney(openQty * l.price, po.currency)}): the line is ordered as received, the open commitment ends and MRP no longer counts it as supply.${lastOpen ? ` No line stays open, so ${po.id} moves to Received for matching.` : ""} Purchasing Manager only.`
          : "Choose a line."
      }
      onConfirm={(r) => g.block ?? (l ? report(shortCloseLine(po.id, l.no, r), (n) => `Line ${l.no} short-closed (${n} closed)`) : "Choose a line.")}
    >
      {l && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <KV k="Ordered">{fmtNumber(l.qty)}</KV>
          <KV k="Received">{fmtNumber(l.received)}</KV>
          <KV k="Open, to be closed"><span className="font-medium">{fmtNumber(openQty)}</span></KV>
        </dl>
      )}
      {g.block && <p role="alert" className="text-sm text-destructive">{g.block}</p>}
      {g.notice && <p role="status" className="text-sm text-muted-foreground">{g.notice}</p>}
      <p className="text-xs text-muted-foreground">Reading <Reading id="OQ-PF-38" />.</p>
    </DialogShell>
  )
}

export function RestrictedVendorOverrideDialog({ open, onOpenChange, po, state }: { open: boolean; onOpenChange: (o: boolean) => void; po: PoRec; state?: NineState }) {
  const s = useSlice("purchasingFinance")
  const [role] = useRole()
  const v = vendorOf(s, po.vendorId)
  const comp = v ? complianceOf(v) : undefined
  const g = dialogState(state, role, "the Purchasing Manager", { poRevision: po.revision })
  const disq = v?.quality === "Disqualified"
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      requireReason
      reasonLabel="Reason for ordering from a Restricted vendor (required)"
      title={`Restricted-vendor override for ${po.id}`}
      description={v ? `${vendorName(s, po.vendorId)} · quality approval ${v.quality}` : undefined}
      confirmLabel="Record override"
      confirmDisabled={!!g.block || disq}
      consequence={disq ? `${vendorName(s, po.vendorId)} is Disqualified: new POs are hard-blocked and no override exists (C-32).` : `Records the override on ${po.id} only, with your name and the reason, and lets it go for approval. Each new PO to this vendor needs its own override (C-32). Purchasing Manager only.`}
      onConfirm={(r) => g.block ?? (disq ? "A Disqualified vendor cannot be overridden." : report(overrideRestricted(po.id, r), "Override recorded"))}
    >
      {v && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <KV k="Quality approval"><StatusBadge kind="vendorQuality" status={v.quality} size="sm" /></KV>
          <KV k="Overdue SCARs">{v.overdueScars}</KV>
          <KV k="Insurance / ISO expiry">{comp?.insuranceExpiry ? "on file" : "none"} / {comp?.isoExpiry ? "on file" : "none"}</KV>
        </dl>
      )}
      {po.restrictedOverride && <p className="text-sm"><Chip kind="flag">Existing override</Chip> {po.restrictedOverride.reason}</p>}
      {g.block && <p role="alert" className="text-sm text-destructive">{g.block}</p>}
      {g.notice && <p role="status" className="text-sm text-muted-foreground">{g.notice}</p>}
    </DialogShell>
  )
}
