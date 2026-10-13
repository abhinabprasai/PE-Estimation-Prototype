// FX-PUR-POLINE page at /purchasing/dialogs/po-line (design value): shows the two PO dialogs in each of the nine screen
// states so the route is never empty. "Normal" opens the real dialog against the chosen PO and writes to it; every other
// state is a simulation that shows how the same dialog behaves (blocked, notice, or validation preview) and never writes.
// The dialogs themselves live in components/PoLineDialogs.tsx and are opened from the PO detail (PUR-PO-001/2).
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/templates"
import { Chip, RulesPanel } from "@/components/patterns"
import { useSlice } from "@/store"
import { OPEN_PO, vendorName, vendorOf } from "../data/logic"
import { Design, Section } from "../components/common"
import { SelectField } from "../components/bits"
import { PoLineShortCloseDialog, RestrictedVendorOverrideDialog } from "../components/PoLineDialogs"
import { NINE, type NineState } from "../components/states"

export function PoLineDialogsPage() {
  const s = useSlice("purchasingFinance")
  const closable = s.purchaseOrders.filter((p) => ["Sent", "Confirmed", "Partially Received"].includes(p.status) && p.lines.some((l) => l.received > 0 && (l.status === "Partial" || l.status === "Open")))
  const restricted = s.purchaseOrders.filter((p) => OPEN_PO(p) && ["Restricted", "Disqualified"].includes(vendorOf(s, p.vendorId)?.quality ?? ""))
  const [poA, setPoA] = useState(closable[0]?.id ?? "")
  const [poB, setPoB] = useState(restricted[0]?.id ?? "")
  const [open, setOpen] = useState<null | { kind: "short" | "override"; state: NineState }>(null)
  const a = s.purchaseOrders.find((p) => p.id === poA)
  const b = s.purchaseOrders.find((p) => p.id === poB)
  const line = a?.lines.find((l) => l.received > 0 && (l.status === "Partial" || l.status === "Open"))
  const states = (kind: "short" | "override", disabled: boolean) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {NINE.filter((n) => n.id !== "loading" && n.id !== "empty").map((n) => (
        <Button key={n.id} size="sm" variant={n.id === "normal" ? "default" : "outline"} disabled={disabled} onClick={() => setOpen({ kind, state: n.id })}>
          {n.id === "normal" ? "Normal (writes)" : n.label.split(" (")[0]}
        </Button>
      ))}
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        screenId="FX-PUR-POLINE"
        title="PO line dialogs"
        description="Short-close a PO line and override a Restricted vendor, shown in each screen state. Open them for real from the PO detail."
        chips={<Design note="This page and its route are design values; the dialogs are the feature-list row" />}
      />
      <p className="text-sm text-muted-foreground">
        Loading and empty are page states, not dialog states: a dialog opens only on a loaded PO, so they are not offered here. The other seven are.
      </p>
      <Section title="Short-close a PO line">
        <div className="max-w-md">
          <SelectField id="pl-a" label="PO with a partly received line" value={poA} onChange={setPoA} options={closable.map((p) => ({ value: p.id, label: `${p.id} · ${vendorName(s, p.vendorId)}` }))} hint={closable.length ? "Purchasing Manager only. Normal writes to the PO." : "No partly received PO is left: reset the scenario."} />
        </div>
        {states("short", !a || !line)}
      </Section>
      <Section title="Restricted-vendor override">
        <div className="max-w-md">
          <SelectField id="pl-b" label="PO to a Restricted or Disqualified vendor" value={poB} onChange={setPoB} options={restricted.map((p) => ({ value: p.id, label: `${p.id} · ${vendorName(s, p.vendorId)} · ${vendorOf(s, p.vendorId)?.quality}` }))} hint="Purchasing Manager only. A Disqualified vendor has no override." />
        </div>
        {states("override", !b)}
        <Chip kind="design" note="Each new PO to a Restricted vendor needs its own override (C-32)">One override per PO</Chip>
      </Section>
      {a && line && <PoLineShortCloseDialog open={open?.kind === "short"} onOpenChange={(o) => !o && setOpen(null)} po={a} line={line.no} state={open?.state === "normal" ? undefined : open?.state} />}
      {b && <RestrictedVendorOverrideDialog open={open?.kind === "override"} onOpenChange={(o) => !o && setOpen(null)} po={b} state={open?.state === "normal" ? undefined : open?.state} />}
      <RulesPanel
        rules={[
          ["G §1", "Lines close at full receipt and invoice; short-close with a reason is allowed to the Purchasing Manager", "[DOC:p.100]"],
          ["C-32", "Restricted blocks new POs without a Purchasing Manager override; Disqualified hard-blocks", "[DOC:p.101 §2.1]"],
          ["C-1", "Neither dialog approves anything: approval stays in WF-INBOX", "[DOC:p.11 §W.4]"],
        ]}
      />
    </div>
  )
}
