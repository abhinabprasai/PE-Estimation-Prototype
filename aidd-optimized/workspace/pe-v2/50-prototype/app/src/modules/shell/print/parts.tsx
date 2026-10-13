// Building blocks for the print outputs: the paper sheet, letterhead, Code128 barcode, key-value grid,
// line table, signature block and the print shell with the reprint-needs-a-reason rule.
import { useState, type ReactNode } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/patterns"
import { DetailPage, DialogShell } from "@/components/templates"
import { LEGAL_ENTITIES } from "@/data/shared"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { shellActions } from "../data/actions"
import { useSlice } from "@/store"

// ---------------------------------------------------------------------------------------- Code128 B
const P = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ")
export function code128(text: string): string[] {
  const codes = [104, ...[...text].map((c) => Math.max(0, c.charCodeAt(0) - 32))]
  const sum = codes.reduce((s, c, i) => s + c * (i === 0 ? 1 : i), 0)
  return [...codes, sum % 103, 106].map((c) => P[c])
}
/** A Code128 barcode as SVG. Prototype rendering: format-correct bars, not validated on a scanner. */
export function Barcode128({ value, height = 40, label = true, className }: { value: string; height?: number; label?: boolean; className?: string }) {
  const bars = code128(value)
  let x = 0
  const rects: { x: number; w: number }[] = []
  for (const p of bars)
    [...p].forEach((d, i) => {
      const w = Number(d)
      if (i % 2 === 0) rects.push({ x, w })
      x += w
    })
  const total = x + 20
  return (
    <figure className={cn("inline-flex flex-col items-center", className)}>
      <svg viewBox={`0 0 ${total} ${height}`} role="img" aria-label={`Code128 barcode ${value}`} preserveAspectRatio="none" style={{ height, width: Math.max(120, total * 1.4) }}>
        {rects.map((r, i) => (
          <rect key={i} x={r.x + 10} y={0} width={r.w} height={height} className="fill-foreground" />
        ))}
      </svg>
      {label && <figcaption className="font-mono text-[10px] tracking-wider">{value}</figcaption>}
    </figure>
  )
}
export function QrPlaceholder({ label, size = 56 }: { label: string; size?: number }) {
  return (
    <div role="img" aria-label={`QR code for ${label}`} className="grid shrink-0 grid-cols-7 grid-rows-7 gap-px border p-0.5" style={{ width: size, height: size }}>
      {Array.from({ length: 49 }).map((_, i) => (
        <span key={i} className={(i * 7 + (i % 5) + label.length) % 3 === 0 || [0, 1, 7, 6, 5, 13, 42, 43, 35, 48, 47, 41].includes(i) ? "bg-foreground" : "bg-background"} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------- sheet parts
export function Letterhead({ entityId = "LE-TBD-10", title, number, date }: { entityId?: string; title: string; number?: string; date?: string }) {
  const le = LEGAL_ENTITIES.find((e) => e.id === entityId)!
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 pb-3">
      <div>
        <p className="text-lg font-bold">{le.name}</p>
        <p className="text-xs text-muted-foreground">Fargo, ND · {le.country === "CA" ? "Canada" : "United States"} · {le.id}</p>
        <p className="text-[10px] text-muted-foreground">Letterhead placeholder: the final letterhead is an open decision</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold uppercase">{title}</p>
        {number && <p className="font-mono text-sm">{number}</p>}
        {date && <p className="text-xs">{date}</p>}
      </div>
    </header>
  )
}
export function Sheet({ children, watermark, landscape, className }: { children: ReactNode; watermark?: string; landscape?: boolean; className?: string }) {
  return (
    <article className={cn("print-sheet relative mx-auto flex flex-col gap-4 border bg-card p-8 text-sm text-card-foreground", landscape ? "w-full max-w-[1056px]" : "w-full max-w-[816px]", className)}>
      {watermark && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold uppercase text-muted-foreground opacity-15">
          {watermark}
        </span>
      )}
      {children}
    </article>
  )
}
export function Block({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-1", className)}>
      {title && <h3 className="border-b text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>}
      {children}
    </section>
  )
}
export function Facts({ rows, cols = 2 }: { rows: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-1", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4")}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <dt className="text-[10px] uppercase text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
export function Lines({ head, rows, right = [], foot }: { head: string[]; rows: (string | number | ReactNode)[][]; right?: number[]; foot?: (string | ReactNode)[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-y bg-table-head text-left">
          {head.map((h, i) => (
            <th key={h} className={cn("px-1 py-1", right.includes(i) && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b align-top">
            {r.map((c, j) => (
              <td key={j} className={cn("px-1 py-1", right.includes(j) && "tabular text-right")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
        {foot && (
          <tr className="border-b font-semibold">
            {foot.map((c, j) => (
              <td key={j} className={cn("px-1 py-1", right.includes(j) && "tabular text-right")}>
                {c}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  )
}
export function Signatures({ names }: { names: string[] }) {
  return (
    <div className="mt-4 grid gap-6" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((n) => (
        <div key={n} className="flex flex-col gap-1">
          <span className="h-8 border-b" />
          <span className="text-[10px] uppercase text-muted-foreground">{n}, name, signature, date</span>
        </div>
      ))}
    </div>
  )
}
export const Money = ({ n }: { n: number }) => <span className="tabular">{n.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
export const Fine = ({ children }: { children: ReactNode }) => <p className="text-[10px] leading-snug text-muted-foreground">{children}</p>

// ---------------------------------------------------------------------------------------- print shell
export interface PrintVariant {
  id: string
  label: string
  /** Document id for the print log (reprint needs a reason). */
  doc: string
  render: () => ReactNode
  note?: ReactNode
}
const PRINT_CSS = `@media print { body * { visibility: hidden !important; } .print-sheet, .print-sheet * { visibility: visible !important; } .print-sheet { position: absolute; left: 0; top: 0; width: 100% !important; max-width: none !important; border: 0 !important; } }`
export function PrintShell({ screenId, title, description, variants, chips }: { screenId: string; title: string; description: string; variants: PrintVariant[]; chips?: ReactNode }) {
  const [id, setId] = useState(variants[0].id)
  const v = variants.find((x) => x.id === id) ?? variants[0]
  const s = useSlice("shell")
  const [ask, setAsk] = useState(false)
  const reprint = s.printLog.some((p) => p.doc === v.doc)
  const doPrint = (reason?: string) => {
    const r = shellActions.logPrint(v.doc, reason)
    if (!r.ok) return r.error
    toast.success(`${v.label} sent to the print dialog and logged`)
    setTimeout(() => window.print(), 50)
    return null
  }
  const log = s.printLog.filter((p) => p.doc === v.doc)
  return (
    <>
      <style>{PRINT_CSS}</style>
      <DetailPage
        header={{
          title,
          screenId,
          description,
          chips: (
            <>
              <Chip kind="design" note="Routes, layout and wording of print outputs are design values; the PRD fixes the contents where cited">Print layout is provisional</Chip>
              {chips}
            </>
          ),
          primary: (
            <Button onClick={() => (reprint ? setAsk(true) : doPrint())}>
              <Printer aria-hidden="true" /> {reprint ? "Reprint" : "Print"}
            </Button>
          ),
        }}
        tabs={[
          {
            id: "doc",
            label: "Document",
            content: (
              <div className="flex flex-col gap-4">
                {variants.length > 1 && (
                  <div role="tablist" aria-label="Document variants" className="flex flex-wrap gap-1 border-b">
                    {variants.map((x) => (
                      <button key={x.id} role="tab" aria-selected={id === x.id} onClick={() => setId(x.id)} className={cn("h-8 border-b-2 px-3 text-sm", id === x.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                )}
                {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
                <div className="overflow-x-auto bg-muted p-4">{v.render()}</div>
              </div>
            ),
          },
          {
            id: "log",
            label: "Print log",
            count: log.length,
            content: (
              <div className="max-w-2xl text-sm">
                <p className="mb-2">Every print is logged. A reprint needs a reason (platform rule). Printing here uses the browser print dialog.</p>
                {log.length === 0 ? (
                  <p className="text-muted-foreground">Not printed yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {log.map((l) => (
                      <li key={l.id}>
                        <span className="font-mono text-xs">{l.id}</span> {l.on} by {l.by}
                        {l.reason && <span className="text-muted-foreground"> · reason: {l.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
        ]}
      />
      <DialogShell open={ask} onOpenChange={setAsk} title={`Reprint ${v.label}?`} consequence="This document was printed before. The reprint is logged with your reason." requireReason reasonLabel="Reason for the reprint (required)" confirmLabel="Reprint" onConfirm={(r) => doPrint(r)} />
    </>
  )
}
