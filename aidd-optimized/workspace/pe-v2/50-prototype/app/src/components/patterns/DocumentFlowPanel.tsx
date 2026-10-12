// DocumentFlowPanel: the linkage spine around one document [DOC:pp.276-277 §16] (asserted).
// Predecessors (what led here) and successors (what this created), walked transitively from three
// sources: the seeded spine (src/data/shared/spine.ts), links each module slice derives from its
// records (SliceDef.links) and links added at runtime (MutateCtx.link). Each node shows its ID,
// type, status badge and link kind; documents no module has seeded yet are marked "not seeded".

import { Link } from "react-router"
import { ArrowDownRight, ArrowUpLeft, GitBranch } from "lucide-react"
import { docLabel, refKey, walk, type DocLink, type DocRef } from "@/data/domain"
import { store, useStoreVersion } from "@/store"
import { StatusBadge } from "./status"
import { cn } from "@/lib/utils"

function dedupe(links: DocLink[]) {
  const seen = new Set<string>()
  return links.filter((l) => {
    const k = `${refKey(l.from)}>${refKey(l.to)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function Node({ r, kind, note, depth }: { r: DocRef; kind: string; note?: string; depth: number }) {
  const info = store.lookup(r)
  return (
    <li className="flex flex-col gap-1 border-l-2 py-1 pl-2" style={{ marginLeft: `${(depth - 1) * 12}px` }}>
      <span className="text-xs text-muted-foreground">
        {kind}
        {note ? ` · ${note}` : ""}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Link to={info.route} className="font-mono text-sm text-link underline-offset-4 hover:underline">
          {r.id}
        </Link>
        <span className="text-xs text-muted-foreground">{docLabel(r)}</span>
        {info.status && <StatusBadge kind={info.status.kind} status={info.status.value} size="sm" />}
        {!info.known && <span className="text-xs text-muted-foreground italic">not seeded yet</span>}
      </span>
    </li>
  )
}

export function DocumentFlowPanel({ doc, className, maxDepth = 12 }: { doc: DocRef; className?: string; maxDepth?: number }) {
  useStoreVersion()
  const links = dedupe(store.allLinks())
  const up = walk(links, doc, "up", maxDepth)
  const down = walk(links, doc, "down", maxDepth, new Set(up.map((u) => refKey(u.link.from))))
  return (
    <section aria-label="Document flow" className={cn("flex flex-col gap-3 rounded-lg border p-4", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <GitBranch className="size-4" aria-hidden="true" /> Document flow
      </h2>
      <div>
        <h3 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowUpLeft className="size-3" aria-hidden="true" /> Predecessors ({up.length})
        </h3>
        {up.length === 0 ? (
          <p className="text-sm text-muted-foreground">None. This document starts its chain.</p>
        ) : (
          <ul className="mt-1">
            {up.map(({ link, depth }) => (
              <Node key={refKey(link.from) + depth} r={link.from} kind={`${link.kind} →`} note={link.note} depth={depth} />
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-md bg-muted px-2 py-1 font-mono text-sm" aria-current="true">
        {doc.id} <span className="font-sans text-xs text-muted-foreground">{docLabel(doc)} (this document)</span>
      </div>
      <div>
        <h3 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowDownRight className="size-3" aria-hidden="true" /> Successors ({down.length})
        </h3>
        {down.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-1">
            {down.map(({ link, depth }) => (
              <Node key={refKey(link.to) + depth} r={link.to} kind={`→ ${link.kind}`} note={link.note} depth={depth} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
