// Tree explorer: BOM, where-used, forward and backward genealogy. Multi-level, level badges, status
// dots (dot plus word), node evidence drill, lazy-load of unexpanded levels.
import { useRef, useState } from "react"
import { ChevronRight, Circle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Chip } from "@/components/patterns"
import { TRACE_EVENTS, type TraceEventCode } from "@/data/domain"
import { cn } from "@/lib/utils"

export interface TreeNode {
  id: string
  label: string
  sub?: string
  qty?: string
  /** Word beside the status dot. */
  status?: { word: string; tone: "ok" | "warn" | "bad" | "idle" }
  evidence?: { event?: TraceEventCode; rows: [string, string][] }
  children?: TreeNode[]
}
const n = (id: string, label: string, sub: string | undefined, qty: string | undefined, status: TreeNode["status"], children?: TreeNode[], evidence?: TreeNode["evidence"]): TreeNode => ({ id, label, sub, qty, status, children, evidence })
const ok = (w: string) => ({ word: w, tone: "ok" as const })
const warn = (w: string) => ({ word: w, tone: "warn" as const })
const bad = (w: string) => ({ word: w, tone: "bad" as const })
const idle = (w: string) => ({ word: w, tone: "idle" as const })

export type TreeMode = "bom" | "where-used" | "forward" | "backward"
export const TREES: Record<TreeMode, { title: string; root: TreeNode; help: string }> = {
  bom: {
    title: "BOM explosion, FIN-TBD-20MVA, EBOM-TBD-0301 rev B",
    help: "Down the structure: what goes into the unit.",
    root: n("fin", "FIN-TBD-20MVA", "Substation power transformer, 20 MVA", "1 EA", ok("Active"), [
      n("core", "SEMI-TBD-CORE20", "Stacked core, step-lap", "1 EA", ok("Active"), [n("crgo", "RAW-TBD-CRGO23", "CRGO steel 0.23 mm", "18,000 KG", ok("Active"))]),
      n("hv", "SEMI-TBD-HVC20", "HV disc winding, per phase", "3 EA", ok("Active"), [n("ctc", "RAW-TBD-CTC", "CTC conductor", "2,400 KG", ok("Active")), n("kr1", "RAW-TBD-KRAFT", "Kraft insulation paper", "310 KG", ok("Active"))]),
      n("lv", "SEMI-TBD-LVC20", "LV foil winding, per phase", "3 EA", ok("Active"), [n("foil", "RAW-TBD-FOIL", "Copper foil", "1,100 KG", ok("Active")), n("kr2", "RAW-TBD-KRAFT", "Kraft insulation paper", "190 KG", ok("Active"))]),
      n("tank", "SEMI-TBD-TANK20", "Fabricated main tank", "1 EA", ok("Active"), [n("plate", "RAW-TBD-PLATE", "Tank steel plate", "9,800 KG", ok("Active")), n("rad", "RAW-TBD-RAD", "Radiator panel bank", "10 EA", ok("Active"))]),
      n("bsh", "RAW-TBD-BSH145", "HV condenser bushing 145 kV", "3 EA", warn("Active, batch under recall")),
      n("oltc", "RAW-TBD-OLTC", "On-load tap changer, 17 positions", "1 EA", ok("Active")),
      n("oil", "RAW-TBD-OIL", "Transformer mineral oil", "11,500 L", ok("Active")),
    ]),
  },
  "where-used": {
    title: "Where used, RAW-TBD-BSH145",
    help: "Up the structure: which parents and orders use this part.",
    root: n("w0", "RAW-TBD-BSH145", "HV condenser bushing 145 kV", undefined, ok("Active"), [
      n("w1", "FIN-TBD-20MVA", "Substation power transformer, 20 MVA", "3 per unit", ok("Active"), [
        n("w2", "EBOM-TBD-0301 rev B", "Released", undefined, ok("Released"), [n("w3", "SO-2026-00301", "Phase 1, 1 unit", "3 bushings", idle("Shipped"))]),
        n("w4", "EBOM-TBD-0377 rev A", "Draft, bushing line under review after the recall", undefined, warn("Draft"), [n("w5", "SO-2026-00377", "Phase 2, 3 units", "9 bushings", ok("In Fulfillment"))]),
      ]),
      n("w6", "SPARE-TBD-BSH145", "Spare HV bushing (service stock)", "1 per spare", ok("Active")),
    ]),
  },
  backward: {
    title: "Genealogy backward, SN-TBD-20M-0301",
    help: "Backward family tree: what is in this unit and where each part came from.",
    root: n("b0", "SN-TBD-20M-0301", "Transformer serial", undefined, idle("Shipped"), [
      n("b1", "WO-TBD-0301", "Production order, routing rev B", undefined, idle("Closed (TECO)"), [
        n("b2", "SN-TBD-BSH-0301", "HV bushing, installed at WC-400 (SP-12)", "1 EA", warn("Under recall"), [
          n("b3", "BAT-TBD-B0301", "Batch of 9, vendor batch HP-26-0412", undefined, bad("Blocked"), [
            n("b4", "GRN-TBD-0301", "Goods receipt 2026-05-04", undefined, ok("Posted"), [n("b5", "PO-TBD-0302", "Hanseong Porcelain & Polymer", "$170,100", idle("Matched/Closed"), [n("b6", "VEN-TBD-0104", "Hanseong Porcelain & Polymer", undefined, warn("Conditional"))])], { event: "T02", rows: [["Receipt", "GRN-TBD-0301, 9 serials"], ["Vendor batch / heat", "HP-26-0412"], ["Certificates", "2 checksummed files"]] }),
          ], { event: "T01", rows: [["Supplier source", "VEN-TBD-0104, PO-TBD-0302 line 10"], ["STP version", "STP-000301"]] }),
        ], { event: "T06", rows: [["Parent", "SN-TBD-20M-0301"], ["Operation", "40 Final assembly"], ["Installed", "2026-07-02 by operator at WC-400"]] }),
        n("b7", "RAW-TBD-OLTC (serial)", "Tap changer, PO-TBD-0301", "1 EA", ok("In Service")),
        n("b8", "IL-TBD-0302", "Final test and FTR, SP-14", undefined, ok("Passed"), undefined, { event: "T08", rows: [["Plan", "IEEE C57.12.90 routine tests"], ["Instruments", "In calibration at test time"], ["Result", "Pass"]] }),
      ]),
    ]),
  },
  forward: {
    title: "Genealogy forward, BAT-TBD-B0301",
    help: "Forward family tree: where did this batch go, for a recall.",
    root: n("f0", "BAT-TBD-B0301", "9 HV bushings, suspect since 2026-10-02", undefined, bad("Blocked"), [
      n("f1", "SN-TBD-BSH-0301", "On SN-TBD-20M-0301 (in service)", "1 EA", warn("In the field"), [n("f2", "SN-TBD-20M-0301", "Transformer, Omaha North", undefined, ok("In Service"), [n("f3", "DLV-TBD-0031", "Delivered 2026-08-11", undefined, idle("Delivered/Closed"), [n("f4", "IB-TBD-0301", "Installed base", undefined, ok("In Service"))])])]),
      n("f5", "SN-TBD-BSH-0302", "Returned on RMA-TBD-0012", "1 EA", warn("In Inspection")),
      n("f6", "SN-TBD-BSH-0303", "On SN-TBD-20M-0301 (in service)", "1 EA", warn("In the field")),
      n("f7", "SN-TBD-BSH-0304..0309", "In stock, reserved for SO-2026-00377", "6 EA", bad("Blocked")),
    ], { event: "T13", rows: [["Campaign", "RCL-2026-001"], ["Population", "version 2, 9 bushings"], ["Holds", "6 Blocked, 3 in the field"]] }),
  },
}

const TONE_CLS: Record<NonNullable<TreeNode["status"]>["tone"], string> = { ok: "fill-status-passed text-status-passed-ink", warn: "fill-status-pending text-status-pending-ink", bad: "fill-status-blocked text-status-cancelled-ink", idle: "fill-status-draft text-status-draft-ink" }

function Row({ node, level, expanded, toggle, select, selected, loading }: { node: TreeNode; level: number; expanded: Set<string>; toggle: (id: string, hasKids: boolean) => void; select: (n: TreeNode) => void; selected?: string; loading: Set<string> }) {
  const has = !!node.children?.length
  const open = expanded.has(node.id)
  return (
    <li role="treeitem" aria-expanded={has ? open : undefined} aria-level={level + 1}>
      <div className={cn("flex items-center gap-2 rounded-md py-1 pr-2", selected === node.id && "bg-secondary")} style={{ paddingLeft: level * 20 }}>
        {has ? (
          <button aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`} onClick={() => toggle(node.id, true)} className="flex size-6 items-center justify-center rounded">
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden="true" />
          </button>
        ) : (
          <span className="size-6" />
        )}
        <span className="rounded border px-1 font-mono text-xs" title={`Level ${level}`}>
          L{level}
        </span>
        <button onClick={() => select(node)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
          <span className="font-mono">{node.label}</span>
          {node.sub && <span className="truncate text-xs text-muted-foreground">{node.sub}</span>}
        </button>
        {node.qty && <span className="tabular text-xs">{node.qty}</span>}
        {node.status && (
          <span className={cn("flex items-center gap-1 text-xs", TONE_CLS[node.status.tone].split(" ")[1])}>
            <Circle className={cn("size-3", TONE_CLS[node.status.tone].split(" ")[0])} aria-hidden="true" />
            {node.status.word}
          </span>
        )}
      </div>
      {has && open && (
        <ul role="group">
          {loading.has(node.id) ? (
            <li className="flex flex-col gap-1 py-1" style={{ paddingLeft: (level + 1) * 20 }} aria-busy="true">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </li>
          ) : (
            node.children!.map((c) => <Row key={c.id} node={c} level={level + 1} expanded={expanded} toggle={toggle} select={select} selected={selected} loading={loading} />)
          )}
        </ul>
      )}
    </li>
  )
}

export function TreeExplorer({ initial = "bom" }: { initial?: TreeMode }) {
  const [mode, setMode] = useState<TreeMode>(initial)
  const t = TREES[mode]
  const [expanded, setExpanded] = useState<Set<string>>(new Set([t.root.id]))
  const [loaded, setLoaded] = useState<Set<string>>(new Set([t.root.id]))
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<TreeNode | null>(null)
  const started = useRef(performance.now())
  const [ms, setMs] = useState(0)
  const reset = (m: TreeMode) => {
    setMode(m)
    setExpanded(new Set([TREES[m].root.id]))
    setLoaded(new Set([TREES[m].root.id]))
    setLoading(new Set())
    setSel(null)
    started.current = performance.now()
    setMs(0)
  }
  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else {
      next.add(id)
      if (!loaded.has(id)) {
        // lazy load: deeper levels arrive on first expand
        setLoading((l) => new Set(l).add(id))
        setTimeout(() => {
          setLoading((l) => {
            const x = new Set(l)
            x.delete(id)
            return x
          })
          setLoaded((l) => new Set(l).add(id))
          setMs(Math.round(performance.now() - started.current))
        }, 350)
      }
    }
    setExpanded(next)
  }
  const expandAll = () => {
    const all = new Set<string>()
    const walk = (x: TreeNode) => {
      if (x.children?.length) all.add(x.id)
      x.children?.forEach(walk)
    }
    walk(t.root)
    setExpanded(all)
    setLoaded(all)
    setMs(Math.round(performance.now() - started.current))
  }
  const depth = (x: TreeNode): number => 1 + Math.max(0, ...(x.children ?? []).map(depth))
  return (
    <section aria-label="Tree explorer" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <header className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{t.title}</h3>
          <div role="radiogroup" aria-label="Tree mode" className="inline-flex gap-1 rounded-md border p-1 text-xs">
            {(["bom", "where-used", "backward", "forward"] as TreeMode[]).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => reset(m)} className={cn("h-6 rounded-md px-2", mode === m && "bg-secondary font-semibold")}>
                {m === "bom" ? "BOM" : m === "where-used" ? "Where used" : m === "backward" ? "Genealogy back" : "Genealogy forward"}
              </button>
            ))}
          </div>
          <button className="text-xs text-link underline" onClick={expandAll}>
            Expand all levels
          </button>
        </header>
        <p className="text-xs text-muted-foreground">{t.help}</p>
        <ul role="tree" aria-label={t.title}>
          <Row node={t.root} level={0} expanded={expanded} toggle={toggle} select={setSel} selected={sel?.id} loading={loading} />
        </ul>
        <p className="tabular text-xs text-muted-foreground">
          {depth(t.root)} levels in this tree · last load {ms} ms · target under 10 s for 5 levels (Book V section 9). Levels beyond the root load when you expand them.
        </p>
      </div>
      <aside aria-label="Node evidence" className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Node evidence</h3>
        {sel ? (
          <>
            <p className="font-mono text-sm">{sel.label}</p>
            <p className="text-xs text-muted-foreground">{sel.sub}</p>
            {sel.evidence ? (
              <>
                {sel.evidence.event && (
                  <p className="text-xs">
                    <Chip kind="design">{sel.evidence.event}</Chip> {TRACE_EVENTS[sel.evidence.event].name}: {TRACE_EVENTS[sel.evidence.event].capturedAt}
                  </p>
                )}
                <dl className="flex flex-col gap-1 text-sm">
                  {sel.evidence.rows.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No captured event on this node; it is a structure line.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a node to see the evidence behind it.</p>
        )}
      </aside>
    </section>
  )
}
