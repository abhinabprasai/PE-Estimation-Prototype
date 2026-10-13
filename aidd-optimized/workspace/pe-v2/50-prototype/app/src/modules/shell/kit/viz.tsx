// Data-viz set (KPI tile with sparkline, Pareto, trend, funnel, waterfall, gauge) and the simulation /
// preview pattern. Charts are token-coloured SVG with a data table behind each one; every viz has
// loading, empty and degraded states, an as-of chip, a restated marker and an export disclosure.
import { useId, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { Download, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip, EmptyState } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { THRESHOLDS } from "@/data/domain"
import { cn } from "@/lib/utils"

export type VizState = "normal" | "loading" | "empty" | "degraded"

export function VizFrame({ title, asOf = "2026-10-09 06:00", restated, state = "normal", onExport, drill, children, table }: { title: string; asOf?: string; restated?: string; state?: VizState; onExport?: () => void; drill?: { label: string; to: string }[]; children: ReactNode; table?: { head: string[]; rows: (string | number)[][] } }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">As of {asOf}</span>
        {restated && <Chip kind="flag" note={restated}>Restated</Chip>}
        {onExport && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
            <Download aria-hidden="true" /> Export
          </Button>
        )}
      </header>
      {state === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : state === "empty" ? (
        <EmptyState title="No data in this range">Choose a wider period, or check that the source documents are posted.</EmptyState>
      ) : state === "degraded" ? (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-status-exception p-3 text-sm">
          <TriangleAlert className="size-4" aria-hidden="true" /> Showing the last good snapshot, as of {asOf}. The reporting feed is delayed; the figures can lag the source documents.
        </div>
      ) : (
        children
      )}
      {state === "normal" && table && (
        <details className="text-xs">
          <summary className="cursor-pointer text-link underline">Show as table</summary>
          <table className="mt-1 w-full">
            <thead>
              <tr className="text-left">
                {table.head.map((h) => (
                  <th key={h} className="p-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {r.map((c, j) => (
                    <td key={j} className="tabular p-1">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {drill && state === "normal" && (
        <nav aria-label="Drill path" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          Drill ({drill.length} clicks to the source document):
          {drill.map((d, i) => (
            <span key={d.label} className="flex items-center gap-1">
              {i > 0 && "›"}
              <Link to={d.to} className="text-link underline">
                {i + 1}. {d.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={`Export ${title}?`}
        description="The export leaves the system as a file."
        consequence="Exports can include customer and cost data. By confirming you accept that the file is handled under the data-protection policy; the export is logged with your name."
        confirmLabel="Export and accept"
        onConfirm={() => {
          onExport?.()
          setDone(true)
          return null
        }}
      />
      {done && <p role="status" className="text-xs">Export prepared and logged.</p>}
    </section>
  )
}

// ----------------------------------------------------------------------------- sparkline and KPI tile
export function Sparkline({ data, className, label }: { data: number[]; className?: string; label?: string }) {
  const w = 100
  const h = 28
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label ?? `Trend, ${data.length} points from ${data[0]} to ${data[data.length - 1]}`} className={cn("h-7 w-24", className)}>
      <polyline points={pts} fill="none" strokeWidth="2" className="stroke-status-active" />
    </svg>
  )
}
export function KpiTile({ label, value, delta, good, data, to, asOf, restated }: { label: string; value: string; delta?: string; good?: boolean; data?: number[]; to?: string; asOf?: string; restated?: boolean }) {
  const body = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular text-3xl font-semibold">{value}</dd>
      <dd className="flex items-center justify-between gap-2 text-xs">
        {delta && <span className={cn(good === false ? "text-status-cancelled-ink" : "text-status-passed-ink")}>{delta}</span>}
        {data && <Sparkline data={data} />}
      </dd>
      <dd className="flex gap-1 text-xs text-muted-foreground">
        {asOf && <span>as of {asOf}</span>}
        {restated && <Chip kind="flag">Restated</Chip>}
      </dd>
    </>
  )
  return to ? (
    <Link to={to} className="flex flex-col rounded-lg border p-4 hover:bg-accent">
      {body}
    </Link>
  ) : (
    <div className="flex flex-col rounded-lg border p-4">{body}</div>
  )
}

// ----------------------------------------------------------------------------- Pareto
export function Pareto({ data }: { data: { label: string; value: number }[] }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, d) => s + d.value, 0)
  const max = sorted[0]?.value ?? 1
  let acc = 0
  const bw = 100 / sorted.length
  const line = sorted.map((d, i) => `${i * bw + bw / 2},${100 - ((acc += d.value) / total) * 100}`).join(" ")
  return (
    <svg viewBox="0 0 100 110" role="img" aria-label={`Pareto: ${sorted.map((d) => `${d.label} ${d.value}`).join(", ")}`} className="h-48 w-full">
      {sorted.map((d, i) => (
        <g key={d.label}>
          <rect x={i * bw + 1} y={100 - (d.value / max) * 100} width={bw - 2} height={(d.value / max) * 100} className="fill-status-active" />
          <text x={i * bw + bw / 2} y={108} textAnchor="middle" className="fill-foreground" fontSize="4">
            {d.label}
          </text>
        </g>
      ))}
      <polyline points={line} fill="none" strokeWidth="1.2" className="stroke-status-pending" />
    </svg>
  )
}

// ----------------------------------------------------------------------------- trend
export function TrendChart({ series, target, unit = "" }: { series: { label: string; points: number[] }[]; target?: number; unit?: string }) {
  const all = series.flatMap((s) => s.points)
  const min = Math.min(...all, target ?? Infinity)
  const max = Math.max(...all, target ?? -Infinity)
  const y = (v: number) => 95 - ((v - min) / (max - min || 1)) * 85
  const dashes = ["", "4 2"]
  return (
    <div>
      <svg viewBox="0 0 100 100" role="img" aria-label={`Trend: ${series.map((s) => `${s.label} from ${s.points[0]}${unit} to ${s.points.at(-1)}${unit}`).join("; ")}`} className="h-48 w-full">
        {target != null && <line x1="0" x2="100" y1={y(target)} y2={y(target)} strokeWidth="0.6" strokeDasharray="2 2" className="stroke-muted-foreground" />}
        {series.map((s, k) => (
          <polyline key={s.label} points={s.points.map((v, i) => `${(i / (s.points.length - 1)) * 100},${y(v)}`).join(" ")} fill="none" strokeWidth="1.4" strokeDasharray={dashes[k % 2]} className={k === 0 ? "stroke-status-active" : "stroke-status-pending"} />
        ))}
      </svg>
      <ul className="flex flex-wrap gap-3 text-xs">
        {series.map((s, k) => (
          <li key={s.label}>{k === 0 ? "Solid line" : "Dashed line"}: {s.label}</li>
        ))}
        {target != null && <li>Dotted: target {target}{unit}</li>}
      </ul>
    </div>
  )
}

// ----------------------------------------------------------------------------- funnel
export function Funnel({ stages }: { stages: { label: string; value: number; to?: string }[] }) {
  const top = stages[0]?.value ?? 1
  return (
    <ol aria-label="Funnel" className="flex flex-col gap-1">
      {stages.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0">{s.label}</span>
          <div className="h-6 rounded-sm bg-status-active" style={{ width: `${Math.max(4, (s.value / top) * 100)}%` }} />
          <span className="tabular">{s.value}</span>
          {i > 0 && <span className="tabular text-xs text-muted-foreground">{Math.round((s.value / stages[i - 1].value) * 100)}% of previous</span>}
        </li>
      ))}
    </ol>
  )
}

// ----------------------------------------------------------------------------- waterfall chart
export function WaterfallChart({ steps }: { steps: { label: string; value: number; total?: boolean }[] }) {
  let run = 0
  const bars = steps.map((s) => {
    const start = s.total ? 0 : run
    run = s.total ? s.value : run + s.value
    return { ...s, start, end: run }
  })
  const max = Math.max(...bars.flatMap((b) => [b.start, b.end]))
  const bw = 100 / bars.length
  return (
    <svg viewBox="0 0 100 110" role="img" aria-label={`Waterfall: ${steps.map((s) => `${s.label} ${s.value}`).join(", ")}`} className="h-48 w-full">
      {bars.map((b, i) => {
        const y1 = 100 - (Math.max(b.start, b.end) / max) * 95
        const hgt = (Math.abs(b.end - b.start) / max) * 95
        return (
          <g key={b.label}>
            <rect x={i * bw + 2} y={y1} width={bw - 4} height={Math.max(1, hgt)} className={b.total ? "fill-primary" : b.value < 0 ? "fill-status-blocked" : "fill-status-active"} />
            <text x={i * bw + bw / 2} y={108} textAnchor="middle" className="fill-foreground" fontSize="3.6">
              {b.label}
            </text>
            <text x={i * bw + bw / 2} y={y1 - 1.5} textAnchor="middle" className="fill-foreground" fontSize="3.4">
              {b.value < 0 ? "-" : ""}
              {Math.abs(b.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ----------------------------------------------------------------------------- gauge
export function Gauge({ value, min = 0, max = 100, target, label, unit = "%" }: { value: number; min?: number; max?: number; target?: number; label: string; unit?: string }) {
  const id = useId()
  const frac = Math.min(1, Math.max(0, (value - min) / (max - min)))
  const ang = Math.PI * (1 - frac)
  const cx = 50
  const cy = 50
  const r = 40
  const arc = (f: number) => `${cx + r * Math.cos(Math.PI * (1 - f))},${cy - r * Math.sin(Math.PI * (1 - f))}`
  const tf = target != null ? (target - min) / (max - min) : null
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" role="img" aria-labelledby={id} className="h-28 w-full max-w-56">
        <title id={id}>{`${label}: ${value}${unit}${target != null ? `, target ${target}${unit}` : ""}`}</title>
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`} fill="none" strokeWidth="8" className="stroke-muted" />
        <path d={`M ${arc(0)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(ang)},${cy - r * Math.sin(ang)}`} fill="none" strokeWidth="8" className={target != null && value < target ? "stroke-status-pending" : "stroke-status-passed"} />
        {tf != null && <line x1={cx + (r - 6) * Math.cos(Math.PI * (1 - tf))} y1={cy - (r - 6) * Math.sin(Math.PI * (1 - tf))} x2={cx + (r + 6) * Math.cos(Math.PI * (1 - tf))} y2={cy - (r + 6) * Math.sin(Math.PI * (1 - tf))} strokeWidth="1.5" className="stroke-foreground" />}
        <text x="50" y="52" textAnchor="middle" className="fill-foreground" fontSize="12" fontWeight="600">
          {value}
          {unit}
        </text>
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {label}
        {target != null && ` · target ${target}${unit} (${value >= target ? "met" : "short by " + (target - value).toFixed(1) + unit})`}
      </figcaption>
    </figure>
  )
}

// ====================================================================================== simulation / preview
interface SimRow {
  id: string
  item: string
  current: number
  proposed: string
}
const SIM_SEED: SimRow[] = [
  { id: "r1", item: "RAW-TBD-BSH145 safety stock (EA)", current: 6, proposed: "8" },
  { id: "r2", item: "RAW-TBD-CRGO23 safety stock (KG)", current: 60000, proposed: "75000" },
  { id: "r3", item: "RAW-TBD-OLTC safety stock (EA)", current: 2, proposed: "2" },
  { id: "r4", item: "RAW-TBD-RAD safety stock (EA)", current: 20, proposed: "-4" },
  { id: "r5", item: "RAW-TBD-OIL safety stock (L)", current: 12000, proposed: "abc" },
]
/** Simulation / preview: per-row validation, effect summary, and a banner that says nothing posts. */
export function SimulationPreview() {
  const [rows, setRows] = useState(SIM_SEED)
  const [ran, setRan] = useState(false)
  const [applied, setApplied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const check = (r: SimRow) => {
    const n = Number(r.proposed)
    if (r.proposed.trim() === "" || Number.isNaN(n)) return { level: "Error" as const, text: "Enter a number." }
    if (n < 0) return { level: "Error" as const, text: "Safety stock cannot be negative." }
    const pct = r.current ? Math.abs(((n - r.current) / r.current) * 100) : 0
    if (pct > THRESHOLDS.safetyStockChangePct) return { level: "Warning" as const, text: `${pct.toFixed(0)}% change: above ${THRESHOLDS.safetyStockChangePct}%, needs the Planning Manager's approval.` }
    return { level: "OK" as const, text: pct === 0 ? "No change." : `${pct.toFixed(0)}% change.` }
  }
  const res = rows.map(check)
  const errors = res.filter((r) => r.level === "Error").length
  const warns = res.filter((r) => r.level === "Warning").length
  return (
    <section aria-label="Simulation" className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Mass change: safety stock, 5 rows</h3>
      <p role="note" className="rounded-md bg-muted p-2 text-sm font-medium">
        Preview only. Nothing posts and no record changes until you apply, and applying stays blocked while any row has an error.
      </p>
      <table className="w-full text-sm">
        <thead className="bg-table-head text-left">
          <tr>
            <th className="p-2">Row</th>
            <th className="p-2 text-right">Current</th>
            <th className="p-2">Proposed</th>
            <th className="p-2">Check</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.item}</td>
              <td className="tabular p-2 text-right">{r.current.toLocaleString()}</td>
              <td className="p-2">
                <input aria-label={`Proposed for ${r.item}`} aria-invalid={res[i].level === "Error"} value={r.proposed} onChange={(e) => (setRows(rows.map((x) => (x.id === r.id ? { ...x, proposed: e.target.value } : x))), setRan(false), setApplied(false))} className={cn("h-8 w-28 rounded-md border px-2", res[i].level === "Error" && "border-destructive")} />
              </td>
              <td className={cn("p-2", res[i].level === "Error" && "text-destructive", res[i].level === "Warning" && "text-status-pending-ink")}>
                {res[i].level}: {res[i].text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setRan(true)}>
          Run simulation
        </Button>
        <Button disabled={!ran || errors > 0} onClick={() => setConfirm(true)}>
          Apply changes
        </Button>
        {errors > 0 && <span className="text-sm text-destructive">Fix {errors} row{errors > 1 ? "s" : ""} to apply.</span>}
      </div>
      {ran && (
        <div role="status" className="rounded-md border p-3 text-sm">
          <p className="font-semibold">Effect summary</p>
          <ul className="list-disc pl-4">
            <li>{res.filter((r) => r.level === "OK").length} rows would change directly.</li>
            <li>{warns} rows need the Planning Manager before they take effect.</li>
            <li>{errors} rows are invalid and would be skipped.</li>
          </ul>
        </div>
      )}
      {applied && <p role="status" className="text-sm">Applied. The valid rows changed and {warns} request(s) went to the Planning Manager.</p>}
      <DialogShell open={confirm} onOpenChange={setConfirm} title="Apply 5 safety-stock rows?" consequence={`${res.filter((r) => r.level === "OK").length} rows change now; ${warns} go to the Planning Manager.`} confirmLabel="Apply" onConfirm={() => (setApplied(true), null)} />
    </section>
  )
}
