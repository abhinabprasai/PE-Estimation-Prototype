// KioskPage: floor-touch template for the shop-floor terminal, pack station, return receipt and any
// handheld (TC77) screen. Rules from layout.md section 4 and tokens.md section 5:
// - 1280 x 800 frame, light theme only (L-6), 16 px base text, no navigation menu
// - 64 px header: operator (badge login), work center / station, online / offline indicator
// - banners (scan failure, offline) sit under the header and push content down, never overlay
// - one task at a time; the next expected scan stated in words (use <ScanField>)
// - bottom action bar, full-width buttons: 64 px primary, 48 px secondary, 16 px gaps
// - targets at least 48 px; no hover, drag, right-click or shortcut needed to finish (L-5)
// - focus: the ScanField takes focus on mount and after a scan or dismiss, never on blur (F-01);
//   every control is reachable by Tab.

import type { ReactNode } from "react"
import { Link } from "react-router"
import { LogOut, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface KioskAction {
  label: string
  onClick: () => void
  disabled?: boolean
  /** Exactly one primary per screen. */
  primary?: boolean
  destructive?: boolean
}

export interface KioskPageProps {
  /** Screen title, e.g. "Pack station". */
  title: string
  screenId?: string
  operator?: string
  station?: string
  online?: boolean
  queued?: number
  /** Scan failure / info banners, rendered under the header. */
  banners?: ReactNode
  /** The ScanField. */
  scan?: ReactNode
  /** The single current task. */
  children: ReactNode
  actions?: KioskAction[]
  /** Where "Exit" goes (an office route). */
  exitTo?: string
}

export function KioskPage({ title, screenId, operator, station, online = true, queued = 0, banners, scan, children, actions = [], exitTo = "/" }: KioskPageProps) {
  return (
    <div className="light flex min-h-screen justify-center bg-muted text-base">
      <div className="flex min-h-[800px] w-full max-w-[1280px] flex-col bg-background">
        <header className="flex h-16 items-center gap-4 bg-primary px-8 text-primary-foreground">
          <span className="text-lg font-semibold">{title}</span>
          {screenId && <span className="font-mono text-sm opacity-90">{screenId}</span>}
          {station && <span className="text-base">Station: {station}</span>}
          <span className="ml-auto text-base">{operator ? `Operator: ${operator}` : "Scan your badge to log in (SP-07)"}</span>
          <span className="flex items-center gap-2 text-base" aria-live="polite">
            {online ? <Wifi className="size-6" aria-hidden="true" /> : <WifiOff className="size-6" aria-hidden="true" />}
            {online ? "Online" : `Offline: ${queued} scans queued`}
          </span>
          <Button asChild variant="outline" className="h-12 bg-background text-base text-foreground">
            <Link to={exitTo}>
              <LogOut aria-hidden="true" /> Exit
            </Link>
          </Button>
        </header>
        {!online && <div className="flex h-12 items-center gap-2 bg-offline-banner-bg px-8 text-status-pending-ink">Offline: {queued} scans queued. Scans replay when the connection returns (queue holds up to 4 h).</div>}
        {banners && <div className="px-8 pt-4">{banners}</div>}
        <main className="flex flex-1 flex-col gap-8 px-8 py-8">
          {scan}
          <section aria-label="Current task" className="flex flex-col gap-4">
            {children}
          </section>
        </main>
        {actions.length > 0 && (
          <footer className="flex gap-4 border-t px-8 py-4">
            {actions.map((a) => (
              <Button
                key={a.label}
                onClick={a.onClick}
                disabled={a.disabled}
                variant={a.primary ? (a.destructive ? "destructive" : "default") : "outline"}
                className={cn("flex-1 text-base", a.primary ? "h-16 text-lg" : "h-12")}
              >
                {a.label}
              </Button>
            ))}
          </footer>
        )}
      </div>
    </div>
  )
}

/** Big read-only fact for kiosk task areas (16 px label, 24 px value). */
export function KioskFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-base text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{children}</span>
    </div>
  )
}
