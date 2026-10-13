// RenditionPreview: a drawn stand-in for the PDF rendition of a controlled document revision.
// Released renditions carry the "RELEASED Rev X + date" stamp [DOC:p.64 §5.2]; an Obsolete one is
// stamped OBSOLETE; every unreleased rendition (WIP, In Review) carries the NOT FOR MANUFACTURE
// watermark so it can never be mistaken for the released drawing (feature list, ENG-DOC-002; the
// PRD itself states only the RELEASED stamp). Markups are pins in % of the sheet; zones A-H x 1-4
// let a keyboard user place one without a pointer.

import type { MouseEvent } from "react"
import { cn } from "@/lib/utils"
import { userName } from "./data/logic"
import type { DocRecord, DocRevisionX, Redline } from "./data/types"

export const ZONE_COLS = ["A", "B", "C", "D", "E", "F", "G", "H"]
export const ZONE_ROWS = [1, 2, 3, 4]
/** Centre of a drawing zone such as "C3" in % of the sheet. */
export function zoneCentre(zone: string): { x: number; y: number } {
  const c = Math.max(0, ZONE_COLS.indexOf(zone[0] ?? "A"))
  const r = Math.max(0, Number(zone.slice(1)) - 1)
  return { x: ((c + 0.5) / ZONE_COLS.length) * 100, y: ((r + 0.5) / ZONE_ROWS.length) * 100 }
}
export function zoneOf(x: number, y: number): string {
  return `${ZONE_COLS[Math.min(7, Math.floor((x / 100) * 8))]}${Math.min(4, Math.floor((y / 100) * 4) + 1)}`
}

export const isUnreleased = (r: Pick<DocRevisionX, "status">) => r.status === "WIP" || r.status === "In Review"

export function RenditionPreview({ doc, rev, markups = [], selected, onSelect, onPlace, placing, className }: {
  doc: DocRecord
  rev: DocRevisionX
  markups?: Redline[]
  selected?: string
  onSelect?: (id: string) => void
  /** When set, a click on the sheet places a pin at that position (% of the sheet). */
  onPlace?: (x: number, y: number) => void
  placing?: boolean
  className?: string
}) {
  const unreleased = isUnreleased(rev)
  const place = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPlace || !placing) return
    const b = e.currentTarget.getBoundingClientRect()
    onPlace(Math.round(((e.clientX - b.left) / b.width) * 100), Math.round(((e.clientY - b.top) / b.height) * 100))
  }
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div
        role="img"
        aria-label={`Rendition of ${doc.id} rev ${rev.rev}, ${rev.status}${unreleased ? ", watermarked NOT FOR MANUFACTURE" : ""}`}
        onClick={place}
        className={cn("relative aspect-[17/11] w-full overflow-hidden rounded-md border-2 bg-card text-foreground", placing && "cursor-crosshair")}
      >
        {/* zone grid */}
        <div className="pointer-events-none absolute inset-2 grid grid-cols-8 grid-rows-4 border text-[10px] text-muted-foreground">
          {ZONE_ROWS.flatMap((r) => ZONE_COLS.map((c) => <span key={c + r} className="border-[0.5px] border-dashed p-0.5">{c}{r}</span>))}
        </div>
        {/* the drawn content: a tank outline, bushings and a radiator bank (a stand-in, not the real drawing) */}
        <div className="pointer-events-none absolute left-[18%] top-[30%] h-[34%] w-[40%] rounded-sm border-2 border-foreground/70" />
        <div className="pointer-events-none absolute left-[24%] top-[18%] h-[12%] w-[4%] border-2 border-foreground/70" />
        <div className="pointer-events-none absolute left-[34%] top-[18%] h-[12%] w-[4%] border-2 border-foreground/70" />
        <div className="pointer-events-none absolute left-[44%] top-[18%] h-[12%] w-[4%] border-2 border-foreground/70" />
        <div className="pointer-events-none absolute left-[60%] top-[34%] h-[26%] w-[8%] border-2 border-dashed border-foreground/70" />
        {/* title block */}
        <dl className="pointer-events-none absolute bottom-2 right-2 grid w-[34%] grid-cols-2 border bg-card text-[10px] leading-tight">
          <div className="col-span-2 border-b px-1 py-0.5 font-semibold">{doc.id} rev {rev.rev}</div>
          <div className="border-b border-r px-1">Drawn {userName(rev.titleBlock.drawnBy)}</div>
          <div className="border-b px-1">Checked {rev.titleBlock.checkedBy ? userName(rev.titleBlock.checkedBy) : "-"}</div>
          <div className="border-b border-r px-1">Approved {rev.titleBlock.approvedBy ? userName(rev.titleBlock.approvedBy) : "-"}</div>
          <div className="border-b px-1">Scale {rev.titleBlock.scale}</div>
          <div className="border-r px-1">Size {rev.titleBlock.size}</div>
          <div className="px-1">Sheet {rev.titleBlock.sheet}</div>
        </dl>
        {/* stamp and watermark */}
        {rev.status === "Released" && rev.stamp && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-sm border-2 border-status-done px-2 py-1 text-xs font-bold tracking-wide text-status-done-ink bg-status-done">{rev.stamp}</span>
        )}
        {rev.status === "Obsolete" && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] rounded-sm border-4 border-status-blocked px-4 py-2 text-4xl font-black tracking-widest text-status-cancelled-ink opacity-60">{rev.stamp ?? "OBSOLETE"}</span>
        )}
        {unreleased && (
          <span data-testid="watermark" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] whitespace-nowrap text-4xl font-black tracking-widest text-status-cancelled-ink opacity-30 sm:text-5xl">
            NOT FOR MANUFACTURE
          </span>
        )}
        {/* markup pins */}
        {markups.map((m, i) =>
          m.x != null && m.y != null ? (
            <button
              key={m.id ?? i}
              type="button"
              onClick={(e) => { e.stopPropagation(); if (m.id) onSelect?.(m.id) }}
              aria-label={`Markup ${i + 1} at ${zoneOf(m.x, m.y)}${m.resolved ? ", resolved" : ""}`}
              aria-pressed={selected === m.id}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              className={cn(
                "absolute z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-semibold",
                m.resolved ? "border-status-passed bg-status-passed-tint text-status-passed-ink" : "border-status-pending bg-status-pending-tint text-status-pending-ink",
                selected === m.id && "ring-2 ring-ring",
              )}
            >
              {i + 1}
            </button>
          ) : null,
        )}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {unreleased
          ? `Rev ${rev.rev} is ${rev.status}: its rendition is watermarked NOT FOR MANUFACTURE. The floor and customers only ever see the current Released rendition (C-18).`
          : rev.status === "Released"
            ? `Rev ${rev.rev} is the current Released rendition: stamped "${rev.stamp}". Files are frozen.`
            : rev.status === "Superseded"
              ? `Rev ${rev.rev} is Superseded: kept for history; consumers see the current Released revision, never this one (C-18).`
              : `Rev ${rev.rev} is Obsolete: stamped OBSOLETE and excluded from every pick-up point.`}
      </figcaption>
    </figure>
  )
}
