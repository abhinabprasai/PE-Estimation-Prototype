// ScanField: the scan input for kiosk and handheld screens (SP-01..SP-21).
//
// Focus rule (fixes critique F-01, a11y floor "every task is completable by keyboard alone"):
// the field takes focus on mount, and focus returns to it ONLY after a scan is processed or a
// failure banner is dismissed. It NEVER pulls focus back on blur, so a keyboard user can Tab to any
// button on the screen and press it. A visible "Return to scan" button and the "/" shortcut (when
// focus is not in another input) bring focus back on demand.
//
// Feedback per [DOC:p.241 §8.4] (asserted): success = green row flash + "Scanned" text (+ one beep);
// failure = red banner naming what was scanned, what was expected, the E-code and the next action
// (+ two low beeps). Banners sit under the field and push content down; they never cover it.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Check, ScanLine, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SCAN_POINTS } from "@/data/domain"
import type { ScanPointCode } from "@/data/domain"
import { cn } from "@/lib/utils"

export type ScanOutcome = { ok: true; message: string } | { ok: false; errorCode?: string; expected: string; next: string; message?: string }

export interface ScanFieldProps {
  scanPoint: ScanPointCode
  /** The next expected scan, in words ("Scan the HU label"). */
  expected: string
  onScan: (code: string) => ScanOutcome
  /** Beep on success / failure (WebAudio; silent where unavailable). */
  sound?: boolean
  disabled?: boolean
  label?: string
}

export interface ScanFieldHandle {
  focus: () => void
}

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const play = (freq: number, at: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      g.gain.value = 0.05
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + 0.09)
    }
    if (ok) play(1200, 0)
    else {
      play(300, 0)
      play(300, 0.14)
    }
    setTimeout(() => ctx.close(), 400)
  } catch {
    /* no audio */
  }
}

export const ScanField = forwardRef<ScanFieldHandle, ScanFieldProps>(function ScanField(p, ref) {
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [last, setLast] = useState<{ code: string; outcome: ScanOutcome; n: number } | null>(null)
  const sp = SCAN_POINTS[p.scanPoint]
  const focus = () => input.current?.focus()
  useImperativeHandle(ref, () => ({ focus }))

  // Focus on mount only.
  useEffect(() => {
    focus()
  }, [])
  // "/" returns focus to the scan field unless the user is typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const submit = () => {
    const code = value.trim()
    if (!code) return
    const outcome = p.onScan(code)
    if (p.sound !== false) beep(outcome.ok)
    setLast({ code, outcome, n: (last?.n ?? 0) + 1 })
    setValue("")
    if (outcome.ok) focus() // after a processed scan
  }

  const failed = last && !last.outcome.ok ? (last.outcome as Extract<ScanOutcome, { ok: false }>) : null

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`scan-${p.scanPoint}`} className="flex items-center gap-2 text-base font-medium">
        <ScanLine className="size-6" aria-hidden="true" />
        {p.label ?? sp.step} <span className="font-mono text-sm text-muted-foreground">{p.scanPoint}</span>
      </label>
      <p className="text-base" id={`scan-${p.scanPoint}-expected`}>
        Next: {p.expected}
      </p>
      <div className="flex gap-4">
        <input
          id={`scan-${p.scanPoint}`}
          ref={input}
          value={value}
          disabled={p.disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit()
          }}
          aria-describedby={`scan-${p.scanPoint}-expected scan-${p.scanPoint}-feedback`}
          autoComplete="off"
          className="h-16 w-full rounded-md border border-input bg-background px-4 font-mono text-xl"
          placeholder="Scan or type the barcode, then Enter"
        />
        <Button type="button" variant="outline" className="h-16 px-6 text-base" onClick={submit} disabled={p.disabled}>
          Enter
        </Button>
      </div>
      <div id={`scan-${p.scanPoint}-feedback`} aria-live="assertive">
        {last?.outcome.ok && (
          <div key={last.n} className="scan-flash flex h-14 items-center gap-2 rounded-md border px-4 text-base">
            <Check className="size-6" aria-hidden="true" /> Scanned <span className="font-mono">{last.code}</span>: {last.outcome.message}
          </div>
        )}
        {failed && (
          <div role="alert" className="flex flex-col gap-2 rounded-md bg-destructive px-4 py-3 text-base text-destructive-foreground">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-6" aria-hidden="true" />
              {failed.errorCode ?? sp.errorCode ?? "Scan refused"}: {failed.message ?? "this scan is not valid here"}
            </p>
            <p>
              Scanned <span className="font-mono">{last!.code}</span>. Expected {failed.expected}.
            </p>
            <p>Next: {failed.next}</p>
            <Button
              variant="outline"
              className={cn("h-12 self-start bg-background text-base text-foreground")}
              onClick={() => {
                setLast(null)
                focus() // after a dismiss
              }}
            >
              Dismiss and scan again
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Validates: {sp.validates}. Press <kbd className="rounded border px-1">/</kbd> or use <button className="underline" onClick={focus}>Return to scan</button> to go back to the field.
      </p>
    </div>
  )
})
