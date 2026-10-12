// Small shared building blocks: alerts, empty state, key-value, rules panel, loading.
// Carried over from the FL-09 build's components/common.tsx so every module uses the same ones.

import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown, Inbox, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

export function ErrorAlert({ title, children, onDismiss, action }: { title: string; children: ReactNode; onDismiss?: () => void; action?: ReactNode }) {
  return (
    <Alert variant="destructive" role="alert" className="border-destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div>{children}</div>
        <div className="mt-1 flex gap-4">
          {action}
          {onDismiss && (
            <button className="underline" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({ title, children, icon: Icon = Inbox }: { title: string; children?: ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** Rules enforced on a screen, with their source; collapsed by default. */
export function RulesPanel({ rules, className }: { rules: [id: string, text: string, source: string][]; className?: string }) {
  return (
    <Collapsible className={className ?? "mt-8 rounded-lg border"}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium">
        Rules on this screen ({rules.length}) – enforced as written in the PRD, all (asserted), none confirmed
        <ChevronDown className="size-4" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1 border-t px-4 py-2 text-sm">
          {rules.map(([id, text, src]) => (
            <li key={id}>
              <span className="font-semibold">{id}</span> {text} <span className="text-muted-foreground">[{src}] (asserted)</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

const visited = new Set<string>()
/** Simulated first-visit loading: true for 600 ms the first time a key is seen this session. */
export function useFirstVisitLoading(key: string) {
  const [loading, setLoading] = useState(!visited.has(key))
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      visited.add(key)
      setLoading(false)
    }, 600)
    return () => clearTimeout(t)
  }, [key, loading])
  return loading
}

export function SkeletonRows({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} aria-hidden="true">
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export type Density = "compact" | "comfortable"
const DENSITY_KEY = "pe-proto-density"
/** Per-user density setting, remembered across sessions (layout.md L-3). */
export function useDensity(scope = "default"): [Density, (d: Density) => void] {
  const read = (): Density => {
    try {
      return (localStorage.getItem(`${DENSITY_KEY}:${scope}`) as Density) || "compact"
    } catch {
      return "compact"
    }
  }
  const [d, setD] = useState<Density>(read)
  const set = (v: Density) => {
    setD(v)
    try {
      localStorage.setItem(`${DENSITY_KEY}:${scope}`, v)
    } catch {
      /* storage unavailable: keep in memory */
    }
  }
  return [d, set]
}
export function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  return (
    <div role="radiogroup" aria-label="Row density" className="inline-flex gap-1 rounded-md border p-1 text-xs">
      {(["compact", "comfortable"] as const).map((d) => (
        <button key={d} role="radio" aria-checked={value === d} onClick={() => onChange(d)} className={value === d ? "h-6 rounded-md bg-secondary px-2 font-semibold" : "h-6 rounded-md px-2"}>
          {d === "compact" ? "Compact rows" : "Comfortable rows"}
        </button>
      ))}
    </div>
  )
}
/** Row classes per density (tokens.md section 5: 32 px dense, 40 px comfortable). */
export const rowCls = (d: Density) => (d === "compact" ? "h-8 text-[13px]" : "h-10 text-sm")
