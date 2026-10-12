// DialogShell: the Dialog archetype (CTP-DLG, PRC-SIM and every confirm-before-commit step).
// Inherits the density of the screen that opened it. Any action that ends a record, posts, or fires
// a milestone names the object and the consequence before it runs, and asks for a reason where the
// specification requires one (critique F-06, F-07, F-09, F-10 pattern). One filled primary.

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface DialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** One sentence: what happens on confirm, naming the object ("Posts PGI-TBD-0071 with #25 ..."). */
  consequence?: ReactNode
  children?: ReactNode
  confirmLabel: string
  /** Return an error string to keep the dialog open, or null to close. */
  onConfirm: (reason: string) => string | null
  /** Require a reason (the field is labelled with `reasonLabel`). */
  requireReason?: boolean
  reasonLabel?: string
  destructive?: boolean
  confirmDisabled?: boolean
  /** Extra footer content on the left (secondary actions). */
  secondary?: ReactNode
  wide?: boolean
}

export function DialogShell(p: DialogShellProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const close = (o: boolean) => {
    if (!o) {
      setReason("")
      setError(null)
    }
    p.onOpenChange(o)
  }
  return (
    <Dialog open={p.open} onOpenChange={close}>
      <DialogContent className={p.wide ? "sm:max-w-3xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          {p.description && <DialogDescription>{p.description}</DialogDescription>}
        </DialogHeader>
        {p.children}
        {p.consequence && <p className="rounded-md bg-muted px-4 py-2 text-sm">{p.consequence}</p>}
        {p.requireReason && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dialog-reason">{p.reasonLabel ?? "Reason (required)"}</Label>
            <Textarea id="dialog-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error && !reason.trim()} />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          {p.secondary}
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            variant={p.destructive ? "destructive" : "default"}
            disabled={p.confirmDisabled}
            onClick={() => {
              if (p.requireReason && !reason.trim()) return setError("Enter a reason to continue.")
              const e = p.onConfirm(reason.trim())
              if (e) setError(e)
              else close(false)
            }}
          >
            {p.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
