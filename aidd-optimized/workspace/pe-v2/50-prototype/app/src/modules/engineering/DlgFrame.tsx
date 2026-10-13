// DlgFrame: a DialogShell that can also be drawn inline. The dialog entries of the feature list
// (/engineering/dialogs/...) are built as a dialog component opened from the screens that need it AND
// as a page at the route that shows the same dialog in each of its states, so the embedded form is
// the same markup as the modal (APP-ARCHITECTURE.md section 2).

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogShell, type DialogShellProps } from "@/components/templates"

export type DlgFrameProps = Omit<DialogShellProps, "open" | "onOpenChange"> & {
  open?: boolean
  onOpenChange?: (o: boolean) => void
  /** Draw inline (the page at the dialog's route) instead of as a modal. */
  embedded?: boolean
  /** Disable the primary and say why (offline, read-only, authorization). */
  blockedReason?: ReactNode
  /** Footer extras for the embedded form only (modal uses `secondary`). */
  onCancel?: () => void
}

export function DlgFrame({ embedded, open, onOpenChange, blockedReason, onCancel, ...p }: DlgFrameProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  if (!embedded)
    return (
      <DialogShell
        {...p}
        open={!!open}
        onOpenChange={onOpenChange ?? (() => {})}
        confirmDisabled={p.confirmDisabled || !!blockedReason}
        consequence={blockedReason ? <>{p.consequence} <span className="font-medium">Blocked: {blockedReason}</span></> : p.consequence}
      />
    )
  return (
    <section role="group" aria-label={p.title} className="flex w-full max-w-3xl flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{p.title}</h2>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      </header>
      {p.children}
      {p.consequence && <p className="rounded-md bg-muted px-4 py-2 text-sm">{p.consequence}</p>}
      {blockedReason && <p role="status" className="text-sm font-medium">Blocked: {blockedReason}</p>}
      {p.requireReason && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${p.title}-reason`}>{p.reasonLabel ?? "Reason (required)"}</Label>
          <Textarea id={`${p.title}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error && !reason.trim()} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <footer className="flex flex-wrap justify-end gap-2">
        {p.secondary}
        <Button variant="outline" onClick={() => { setError(null); onCancel?.() }}>Cancel</Button>
        <Button
          variant={p.destructive ? "destructive" : "default"}
          disabled={p.confirmDisabled || !!blockedReason}
          onClick={() => {
            if (p.requireReason && !reason.trim()) return setError("Enter a reason to continue.")
            const e = p.onConfirm(reason.trim())
            setError(e)
          }}
        >
          {p.confirmLabel}
        </Button>
      </footer>
    </section>
  )
}
