// Handheld frame: the Zebra TC77 (4.7 in, about 360 x 640 CSS px) task area inside the KioskPage
// shell (design value; the shell stays the shared kiosk template). Tokens only.
import type { ReactNode } from "react"
import { Chip } from "@/components/patterns"

export function HandheldFrame({ device = "Zebra TC77, 4.7 in", children }: { device?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Chip kind="design" note="The handheld task area is drawn at the device width inside the shared kiosk template">{device}</Chip>
      <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl border-2 p-4" role="group" aria-label={`Handheld view, ${device}`}>
        {children}
      </div>
    </div>
  )
}
