// Handheld frame: the Zebra TC77 (4.7 in, one column, about 360 px wide) task area inside the
// KioskPage shell (design value, RD-IO-17). Tokens only.
import type { ReactNode } from "react"
import { Reading } from "./bits"

export function HandheldFrame({ children, label = "Handheld view, Zebra TC77 4.7 in" }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Zebra TC77, 4.7 in <Reading id="RD-IO-17" />
      </div>
      <div role="group" aria-label={label} className="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border-2 p-4">
        {children}
      </div>
    </div>
  )
}
