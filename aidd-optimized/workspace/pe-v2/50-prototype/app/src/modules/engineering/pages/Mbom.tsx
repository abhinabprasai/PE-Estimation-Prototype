// MBOM-TRF MBOM Transform (Wizard from a released EBOM) [DOC:p.66 §6; p.256] (asserted), with the
// MBOM register and detail it produces. Steps: phantom resolution preview, operation mapping
// validation, manufacturing additions, scrap review, release (sets the costing invalidation flag).
// Routes /engineering/mbom-transform/new[/:ebomId] and the register are design values (registry note).

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, ListPage, WizardPage } from "@/components/templates"
import { fmtDate, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCore, useRole, useSlice } from "@/store"
import type { UserId } from "@/data/domain"
import { DetailState, Item, NoPostings, RefLink, StatePreview, useActDialog, useScreenState } from "../components"
import { applyOps, ebomAhead, nextRev, userName } from "../data/logic"
import { releasedRoutingsFor, routingFor } from "../data/reference"
import { MFG_ADDS_20MVA, mbomLinesFrom } from "../data/seed"
import * as act from "../data/actions"
import type { MbomLineX, MbomRecord } from "../data/types"

const RULES: [string, string, string][] = [
  ["Source", "The transform starts from a Released EBOM revision; Obsolete EBOMs cannot be used (C-16)", "DOC:p.66 §6"],
  ["Phantoms", "Phantom lines are resolved: their components explode into the parent's demand", "DOC:p.66 §6"],
  ["V-ENG-05", "Every line maps Consume At Operation to an operation of a Released routing before release", "DOC:p.61"],
  ["Additions", "Manufacturing adds packaging, consumables and allowances that engineering does not design", "DOC:p.66 §6"],
  ["Scrap", "Scrap % defaults from the EBOM; production may adjust it with Engineering approval", "DOC:p.66 §6 step 5"],
  ["ECO", "An MBOM regenerated for an ECO is held on the ECO and releases with it at the atomic cutover", "DOC:p.62 §4.2"],
  ["Release", "Release makes the MBOM Active, supersedes the prior Active revision and sets the costing invalidation flag", "DOC:p.256"],
  ["Dev note", "An MBOM older than the source EBOM's current Released revision shows an EBOM-ahead banner", "DOC:p.66"],
]

// ===================================================================================== register
export function MbomList() {
  const s = useSlice("engineering")
  const st = useScreenState("MBOM-TRF-list")
  const nav = useNavigate()
  const rows = st.empty ? [] : s.mboms
  const columns: Column<MbomRecord>[] = [
    { id: "id", header: "MBOM", value: (m) => m.id, sortable: true, mono: true },
    { id: "item", header: "Parent item", value: (m) => m.parentItemId, filterable: true, mono: true },
    { id: "rev", header: "Rev", value: (m) => m.revision, mono: true },
    { id: "ebom", header: "From EBOM", value: (m) => `${m.ebomId} rev ${m.ebomRev}`, cell: (m) => <span className="inline-flex flex-wrap items-center gap-1"><RefLink r={{ type: "ebom", id: m.ebomId }} /> rev {m.ebomRev}{ebomAhead(s, m) && <Chip kind="flag" note={ebomAhead(s, m)}>EBOM ahead</Chip>}</span> },
    { id: "rtg", header: "Routing", value: (m) => `${m.routingId} rev ${m.routingRev}`, mono: true },
    { id: "plant", header: "Plant", value: (m) => m.plantId, filterable: true, mono: true },
    { id: "lines", header: "Lines", align: "right", value: (m) => m.lines.length },
    { id: "rel", header: "Released", value: (m) => m.releasedOn, sortable: true, cell: (m) => fmtDate(m.releasedOn) },
    { id: "status", header: "Status", value: (m) => m.status, filterable: true, cell: (m) => <StatusBadge kind="mbom" status={m.status} size="sm" /> },
  ]
  return (
    <>
      <ListPage<MbomRecord>
        header={{
          title: "MBOM transform",
          screenId: "MBOM-TRF",
          description: "Manufacturing BOMs derived from released EBOM revisions. Start the transform from a released EBOM; the Active revision feeds production versions.",
          primary: <Button onClick={() => nav("/engineering/mbom-transform/new")}>Transform a released EBOM</Button>,
        }}
        table={{
          rows, columns, rowId: (m) => m.id, rowHref: (m) => `/engineering/mbom-transform/${m.id}`, searchText: (m) => `${m.id} ${m.ebomId} ${m.parentItemId}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "rel", dir: "desc" },
          empty: { title: "No MBOMs yet", body: "Release an EBOM, then transform it here." },
        }}
      />
      <RulesPanel rules={RULES} />
    </>
  )
}

// ===================================================================================== detail
export function MbomDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("MBOM-TRF-detail")
  const m = s.mboms.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!m} what={`MBOM ${id}`} back={{ to: "/engineering/mbom-transform", label: "Back to MBOMs" }}>
      {m && <MbomBody m={m} />}
    </DetailState>
  )
}

function MbomBody({ m }: { m: MbomRecord }) {
  const s = useSlice("engineering")
  const nav = useNavigate()
  const ahead = ebomAhead(s, m)
  const pvs = s.productionVersions.filter((p) => p.mbomId === m.id)
  const ops = routingFor(m.routingId, m.routingRev)?.ops ?? []
  const byOp = ops.map((o) => ({ o, lines: m.lines.filter((l) => l.operation === String(o.op)) })).filter((g) => g.lines.length)
  return (
    <>
      <DetailPage
        header={{
          title: `${m.id} rev ${m.revision}`,
          screenId: "MBOM-TRF",
          crumbs: [{ label: "MBOM transform", to: "/engineering/mbom-transform" }, { label: m.id }],
          description: `Manufacturing BOM for ${m.parentItemId}, from ${m.ebomId} rev ${m.ebomRev}, routing ${m.routingId} rev ${m.routingRev}, plant ${m.plantId}.`,
          chips: (
            <>
              {ahead && <Chip kind="flag" note={ahead}>EBOM ahead</Chip>}
              {m.costingInvalidated && <Chip kind="change" note="Set on release; the next cost rollup re-reads this MBOM">Costing invalidation flag</Chip>}
            </>
          ),
          primary: m.status === "Active" && ahead ? <Button onClick={() => nav(`/engineering/mbom-transform/new/${m.ebomId}`)}>Regenerate from current EBOM</Button> : undefined,
        }}
        status={{ kind: "mbom", value: m.status }}
        doc={{ type: "mbom", id: m.id }}
        summary={
          <>
            <KV k="Source EBOM"><RefLink r={{ type: "ebom", id: m.ebomId }} /> rev {m.ebomRev}</KV>
            <KV k="Routing"><span className="font-mono">{m.routingId} rev {m.routingRev}</span> <Chip kind="design" note="Routing mirror until planning-production exports routings (R-3)">mirror</Chip></KV>
            <KV k="Released">{fmtDate(m.releasedOn)} by {userName(m.releasedBy)}</KV>
            <KV k="Superseded">{m.supersededOn ? fmtDate(m.supersededOn) : "No"}</KV>
            <KV k="Production versions">{pvs.length ? pvs.map((p) => <span key={p.id} className="mr-2"><RefLink r={{ type: "productionVersion", id: p.id }} /></span>) : "None"}</KV>
          </>
        }
        tabs={[
          {
            id: "lines", label: "Lines by operation", count: m.lines.length,
            content: (
              <div className="flex flex-col gap-4">
                {ahead && <ErrorAlert title="EBOM ahead">{ahead}. Regenerate through the transform wizard.</ErrorAlert>}
                {byOp.map(({ o, lines }) => (
                  <section key={o.op} className="rounded-lg border">
                    <h3 className="border-b px-4 py-2 text-sm font-semibold">Op {o.op} · {o.wc} · {o.text}</h3>
                    <LinesTable s={s} lines={lines} />
                  </section>
                ))}
              </div>
            ),
          },
          { id: "activity", label: "Activity", count: m.activity.length, content: <ul className="flex flex-col gap-1 text-sm">{[...m.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul> },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={RULES} />
    </>
  )
}

function LinesTable({ s, lines, edit }: { s: ReturnType<typeof useSlice<"engineering">>; lines: MbomLineX[]; edit?: (l: MbomLineX) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-table-head"><TableRow><TableHead>Find #</TableHead><TableHead>Component</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">Scrap %</TableHead><TableHead>Origin</TableHead><TableHead>Backflush</TableHead>{edit && <TableHead>Edit</TableHead>}</TableRow></TableHeader>
        <TableBody>
          {lines.map((l) => (
            <TableRow key={`${l.no}-${l.componentId}`} className="h-8 text-[13px]">
              <TableCell className="font-mono">{l.no}</TableCell>
              <TableCell><Item s={s} id={l.componentId} /></TableCell>
              <TableCell className="tabular text-right">{fmtNumber(l.qty, 2)}</TableCell>
              <TableCell>{l.uom}</TableCell>
              <TableCell className="tabular text-right">{fmtNumber(l.scrapPct, 1)}</TableCell>
              <TableCell>{l.mfgAdd ? "Manufacturing addition" : l.fromPhantom ? `From phantom line ${l.fromPhantom}` : "EBOM"}</TableCell>
              <TableCell>{l.backflush ? "Yes" : "No"}</TableCell>
              {edit && <TableCell>{edit(l)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ===================================================================================== wizard
export function MbomTransform() {
  const { ebomId } = useParams()
  const [params] = useSearchParams()
  const s = useSlice("engineering")
  const core = useCore()
  const [role] = useRole()
  const nav = useNavigate()
  const runD = useActDialog()
  const eco = s.ecos.find((x) => x.id === params.get("eco") && x.stage === "Open")
  const released = s.eboms.filter((e) => e.status === "Released" && (!eco || eco.changes.some((c) => c.ebomId === e.id)))
  const [src, setSrc] = useState(ebomId && released.some((e) => e.id === ebomId) ? ebomId : (released[0]?.id ?? ""))
  const e = s.eboms.find((x) => x.id === src)
  const change = eco?.changes.find((c) => c.ebomId === src)
  const sourceLines = useMemo(() => (e ? (change ? applyOps(s, e.lines, change.ops).lines : e.lines) : []), [e, change, s])
  const sourceRev = e ? (change ? nextRev(e.rev) : e.rev) : ""
  const [scrapApproval, setScrapApproval] = useState<{ by: UserId; key: string } | null>(null)
  const routings = e ? releasedRoutingsFor(e.parentItemId) : []
  const [rtgKey, setRtgKey] = useState(routings[0] ? `${routings[0].id}|${routings[0].rev}` : "")
  const [rtgId, rtgRev] = rtgKey.split("|")
  const routing = routingFor(rtgId ?? "", rtgRev ?? "")
  const resolved = useMemo(() => mbomLinesFrom(sourceLines), [sourceLines])
  const [lines, setLines] = useState<MbomLineX[]>(() => mbomLinesFrom(sourceLines))
  const [adds, setAdds] = useState<MbomLineX[]>(MFG_ADDS_20MVA)
  const [addOn, setAddOn] = useState<number[]>(MFG_ADDS_20MVA.map((l) => l.no))
  const prior = s.mboms.filter((m) => m.ebomId === src && m.status === "Active")
  const opNos = new Set((routing?.ops ?? []).map((o) => String(o.op)))
  const unmapped = lines.filter((l) => !l.operation || !opNos.has(l.operation))
  const phantoms = e?.lines.filter((l) => l.phantom) ?? []

  const pickSource = (id: string) => {
    setSrc(id)
    const x = s.eboms.find((y) => y.id === id)
    const r = x ? releasedRoutingsFor(x.parentItemId)[0] : undefined
    setRtgKey(r ? `${r.id}|${r.rev}` : "")
    const ch = eco?.changes.find((c) => c.ebomId === id)
    setLines(x ? mbomLinesFrom(ch ? applyOps(s, x.lines, ch.ops).lines : x.lines) : [])
    setScrapApproval(null)
  }
  const setLine = (no: number, patch: Partial<MbomLineX>) => setLines((ls) => ls.map((l) => (l.no === no ? { ...l, ...patch } : l)))
  const finalLines = [...lines, ...adds.filter((a) => addOn.includes(a.no))]
  const changedScrap = act.scrapChanges(sourceLines, lines)
  const scrapKey = changedScrap.map((l) => `${l.no}:${l.scrapPct}`).join("|")
  const approvedNow = !!scrapApproval && scrapApproval.key === scrapKey

  if (!released.length)
    return <EmptyState title="No released EBOM to transform">Release an EBOM first. <Link className="text-link underline" to="/engineering/boms">Open the EBOM register</Link></EmptyState>

  return (
    <>
      <WizardPage
        header={{
          title: eco ? `MBOM transform for ${eco.id}` : "MBOM transform", screenId: "MBOM-TRF", crumbs: [{ label: "MBOM transform", to: "/engineering/mbom-transform" }, { label: "New" }],
          description: eco ? `Regenerate the MBOM from ${src} rev ${sourceRev} as ${eco.id} changes it. The result is held on ${eco.id} and becomes Active at its atomic cutover.` : "Turn a released EBOM revision into the Active manufacturing BOM for a plant.",
        }}
        onCancel={() => nav(eco ? `/engineering/change-orders/${eco.id}` : "/engineering/mbom-transform")}
        finishLabel={eco ? `Stage MBOM on ${eco.id}` : "Release MBOM"}
        consequence={eco
          ? <>Stages the MBOM for {e?.parentItemId} from {src} rev {sourceRev} with {finalLines.length} lines on {eco.id} and completes its "Update MBOM" task. Nothing changes for production until the ECO cuts over; then it becomes Active{prior.length ? `, supersedes ${prior.map((m) => m.id).join(", ")}` : ""} and the production versions that pair it are superseded.</>
          : <>Creates the Active MBOM for {e?.parentItemId} from {src} rev {e?.rev} with {finalLines.length} lines{prior.length ? `, supersedes ${prior.map((m) => m.id).join(", ")}` : ""}, and sets the costing invalidation flag.</>}
        onFinish={() => {
          let id = ""
          const err = runD((d, c) => void (id = act.releaseMbom(d, c, { ebomId: src, routingId: rtgId, routingRev: rtgRev, lines: finalLines, ecoId: eco?.id, scrapApprovedBy: approvedNow ? scrapApproval!.by : undefined })), eco ? `MBOM staged on ${eco.id}` : "MBOM released (Active)")
          if (!err) nav(eco ? `/engineering/change-orders/${eco.id}` : `/engineering/mbom-transform/${id}`)
          return err
        }}
        steps={[
          {
            id: "phantom", title: "Phantom resolution preview",
            validate: () => (!e ? "Pick a released EBOM." : !routing ? "Pick a Released routing revision." : null),
            content: (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label>Released EBOM (Obsolete excluded, C-16)</Label>
                    <Select value={src} onValueChange={pickSource}>
                      <SelectTrigger aria-label="Released EBOM"><SelectValue /></SelectTrigger>
                      <SelectContent>{released.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} rev {x.rev} · {x.parentItemId}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Routing (Released revisions only)</Label>
                    <Select value={rtgKey} onValueChange={setRtgKey}>
                      <SelectTrigger aria-label="Routing"><SelectValue placeholder="No released routing" /></SelectTrigger>
                      <SelectContent>{routings.map((r) => <SelectItem key={`${r.id}|${r.rev}`} value={`${r.id}|${r.rev}`}>{r.id} rev {r.rev}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground"><Chip kind="design" note="Routing mirror until planning-production exports routings (R-3)">mirror</Chip> {routings.length} released routing{routings.length === 1 ? "" : "s"} for {e?.parentItemId}</span>
                  </div>
                </div>
                {prior.length > 0 && <p className="rounded-md bg-muted px-4 py-2 text-sm">{prior.map((m) => m.id).join(", ")} is Active for this EBOM and will be Superseded on release.</p>}
                <p className="text-sm">{phantoms.length ? `${phantoms.length} phantom line${phantoms.length > 1 ? "s" : ""} resolved: ${phantoms.map((p) => `${p.no} ${p.componentId}`).join(", ")}. Their demand flattens into the parent.` : "No phantom lines on this EBOM."} {resolved.length} lines after resolution.</p>
                <LinesTable s={s} lines={resolved} />
              </div>
            ),
          },
          {
            id: "ops", title: "Operation mapping validation",
            validate: () => (unmapped.length ? `Unmapped lines: ${unmapped.map((l) => l.no).join(", ")}. Map every line to an operation of ${rtgId} rev ${rtgRev} (V-ENG-05).` : null),
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-sm">{unmapped.length ? <><Chip kind="block">{unmapped.length} unmapped</Chip> Resolve each line below. Lines inherit Consume At Operation from the EBOM.</> : "Every line maps to an operation of the routing."}</p>
                <LinesTable s={s} lines={lines} edit={(l) => (
                  <Select value={l.operation && opNos.has(l.operation) ? l.operation : ""} onValueChange={(v) => setLine(l.no, { operation: v })}>
                    <SelectTrigger size="sm" className={cn("h-8 w-64", (!l.operation || !opNos.has(l.operation)) && "border-status-blocked")} aria-label={`Operation for line ${l.no}`}><SelectValue placeholder="Unmapped: pick an operation" /></SelectTrigger>
                    <SelectContent>{routing?.ops.map((o) => <SelectItem key={o.op} value={String(o.op)}>{o.op} {o.text}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            ),
          },
          {
            id: "adds", title: "Manufacturing additions",
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-sm">Packaging, consumables and allowances added by manufacturing engineering. <Chip kind="design" note="Addition quantities are design values for this prototype">quantities</Chip></p>
                <LinesTable s={s} lines={adds} edit={(l) => (
                  <span className="flex items-center gap-2">
                    <Checkbox aria-label={`Include line ${l.no}`} checked={addOn.includes(l.no)} onCheckedChange={(v) => setAddOn((p) => (v ? [...p, l.no] : p.filter((x) => x !== l.no)))} />
                    <Input aria-label={`Quantity line ${l.no}`} className="h-8 w-24" type="number" value={l.qty} onChange={(x) => setAdds((a) => a.map((y) => (y.no === l.no ? { ...y, qty: Number(x.target.value) } : y)))} />
                    <label className="flex items-center gap-1 text-xs"><Checkbox checked={!!l.backflush} onCheckedChange={(v) => setAdds((a) => a.map((y) => (y.no === l.no ? { ...y, backflush: !!v } : y)))} />Backflush</label>
                  </span>
                )} />
              </div>
            ),
          },
          {
            id: "scrap", title: "Scrap review",
            validate: () =>
              finalLines.some((l) => !Number.isFinite(l.scrapPct) || l.scrapPct < 0 || l.scrapPct >= 100) ? "Scrap % must be 0 or more and below 100."
              : changedScrap.length && !approvedNow ? `Scrap % changed on line${changedScrap.length > 1 ? "s" : ""} ${changedScrap.map((l) => l.no).join(", ")}: Engineering approval is needed before release.` : null,
            content: (
              <div className="flex flex-col gap-3">
                <p className="text-sm">Scrap factors default from the EBOM (costing-relevant). Production may adjust them for this plant's process with Engineering approval.</p>
                <LinesTable s={s} lines={lines} edit={(l) => {
                  const base = sourceLines.find((x) => x.no === l.no)?.scrapPct
                  return (
                    <span className="flex items-center gap-2">
                      <Input aria-label={`Scrap % line ${l.no}`} className="h-8 w-20" type="number" min={0} value={l.scrapPct} onChange={(x) => setLine(l.no, { scrapPct: Number(x.target.value) })} />
                      {base != null && base !== l.scrapPct && <Chip kind="change" note={`EBOM default ${base}%`}>changed</Chip>}
                    </span>
                  )
                }} />
                {changedScrap.length > 0 && (
                  <section aria-label="Engineering approval of scrap changes" className="flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm">
                    <span>{changedScrap.length} scrap change{changedScrap.length > 1 ? "s" : ""} from the EBOM default ({changedScrap.map((l) => `line ${l.no}`).join(", ")}).</span>
                    {approvedNow
                      ? <span>Approved by {userName(scrapApproval!.by)} (Engineering).</span>
                      : <Button size="sm" variant="outline" disabled={role !== "Engineering Manager"} title={role !== "Engineering Manager" ? "Engineering approves scrap changes: switch Acting as to Engineering Manager" : undefined} onClick={() => setScrapApproval({ by: core.userId, key: scrapKey })}>Approve scrap changes (Engineering)</Button>}
                    <Chip kind="design" note="The PRD says 'with Engineering approval' but names no approver and the shared engine has no approval kind for it; the Engineering Manager approves here (reading R-MBOM-2)">approver</Chip>
                  </section>
                )}
              </div>
            ),
          },
          {
            id: "release", title: "Release",
            content: (
              <dl className="grid gap-4 md:grid-cols-3">
                <KV k="Source">{src} rev {sourceRev}{eco ? ` (as changed by ${eco.id})` : ""}</KV>
                <KV k="Scrap changes">{changedScrap.length ? `${changedScrap.length}, approved by ${approvedNow ? userName(scrapApproval!.by) : "nobody yet"}` : "None"}</KV>
                <KV k="Routing">{rtgId} rev {rtgRev}</KV>
                <KV k="Lines">{finalLines.length} ({lines.length} EBOM, {finalLines.length - lines.length} manufacturing)</KV>
                <KV k="Supersedes">{prior.length ? prior.map((m) => m.id).join(", ") : "Nothing (first MBOM)"}</KV>
                <KV k="Costing">Invalidation flag set for {e?.parentItemId}</KV>
              </dl>
            ),
          },
        ]}
      />
      <NoPostings />
    </>
  )
}
