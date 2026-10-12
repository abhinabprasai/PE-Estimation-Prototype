// CAD-IMP CAD BOM Import (Wizard inside the EBOM editor) [DOC:p.259; Book I C §3.3; Book III G §3]
// (asserted). Mapped proposal grid with match states per line, unmatched rows offered as placeholder
// proposals, transactional commit with an error log. Source: a vault assembly extraction or a CSV upload.

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel, StatusBadge } from "@/components/patterns"
import { WizardPage } from "@/components/templates"
import { fmtDate, fmtNumber } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { toast } from "sonner"
import { DetailState, NoPostings, useScreenState } from "../components"
import * as act from "../data/actions"
import type { ImportRow } from "../data/actions"

const FIELDS = ["findNo", "partNo", "mpn", "description", "qty", "refDes"] as const
type Field = (typeof FIELDS)[number]
const FIELD_LABEL: Record<Field, string> = { findNo: "Find #", partNo: "Material code", mpn: "Manufacturer part #", description: "Description", qty: "Quantity", refDes: "Reference designator" }
const SAMPLE_CSV = `Item,Part Number,Mfr PN,Description,Qty,Ref Des
10,SEMI-TBD-CORE20,,Stacked core step-lap 20 MVA,1,
60,,HPP-145-800-FS2,HV condenser bushing 145 kV FS2,3,H1 H2 H3
70,RAW-TBD-BSH015,,LV bushing 15 kV,4,X0-X3
96,,MRC-FOT-8CH,Fiber-optic WTI 8 ch,1,WTI
98,,,Conservator flange gasket,2,`

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  const head = (lines[0] ?? "").split(",").map((h) => h.trim())
  return { head, body: lines.slice(1).map((l) => l.split(",").map((c) => c.trim())) }
}
function guess(head: string[]): Record<Field, number> {
  const find = (re: RegExp) => head.findIndex((h) => re.test(h))
  return { findNo: find(/^(item|find)/i), partNo: find(/part ?(number|no)|material/i), mpn: find(/mfr|mpn|manufacturer/i), description: find(/desc/i), qty: find(/^qty|quantity/i), refDes: find(/ref/i) }
}

export function CadImport() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("CAD-IMP")
  const e = s.eboms.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!e} what={`EBOM ${id}`} back={{ to: "/engineering/boms", label: "Back to EBOMs" }}>
      {e && <ImportWizard ebomId={e.id} />}
    </DetailState>
  )
}

function ImportWizard({ ebomId }: { ebomId: string }) {
  const s = useSlice("engineering")
  const mutate = useMutate("engineering")
  const nav = useNavigate()
  const e = s.eboms.find((x) => x.id === ebomId)!
  const staged = s.proposals.filter((p) => p.ebomId === ebomId && !p.committed)
  const [source, setSource] = useState<string>(staged[0]?.id ?? "csv")
  const [csv, setCsv] = useState(SAMPLE_CSV)
  const parsed = useMemo(() => parseCsv(csv), [csv])
  const [map, setMap] = useState<Record<Field, number>>(() => guess(parseCsv(SAMPLE_CSV).head))
  const [errorLog, setErrorLog] = useState<string | null>(null)
  const raw = useMemo(() => {
    if (source !== "csv") return s.proposals.find((p) => p.id === source)?.lines ?? []
    return parsed.body.map((c) => ({
      findNo: Number(c[map.findNo] ?? 0), partNo: map.partNo >= 0 ? (c[map.partNo] ?? "") : "", mpn: map.mpn >= 0 ? c[map.mpn] || undefined : undefined,
      description: map.description >= 0 ? (c[map.description] ?? "") : "", qty: Number(c[map.qty] ?? 0), refDes: map.refDes >= 0 ? c[map.refDes] || undefined : undefined,
    }))
  }, [source, s.proposals, parsed, map])
  const rows: ImportRow[] = useMemo(() => act.matchRows(s, ebomId, raw), [s, ebomId, raw])
  const [accepted, setAccepted] = useState<number[] | null>(null)
  const acc = accepted ?? rows.filter((r) => r.state !== "Error").map((r) => r.findNo)

  if (e.status !== "Draft")
    return (
      <EmptyState title={`${e.id} rev ${e.rev} is ${e.status}`}>
        Import adds lines to a Draft EBOM only{e.status === "Released" ? "; a Released EBOM is immutable (C-14), so raise an ECR" : ""}. <Link className="text-link underline" to={`/engineering/boms/${e.id}`}>Back to the EBOM</Link>
      </EmptyState>
    )

  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.state] = (m[r.state] ?? 0) + 1), m), {})
  return (
    <>
      <WizardPage
        header={{
          title: `CAD BOM import into ${e.id}`,
          screenId: "CAD-IMP",
          crumbs: [{ label: "EBOMs", to: "/engineering/boms" }, { label: e.id, to: `/engineering/boms/${e.id}` }, { label: "Import" }],
          description: `${e.title}, rev ${e.rev}.`,
          chips: <><StatusBadge kind="ebom" status={e.status} size="sm" /><Chip kind="design" note="IF-17 PDM connector mocked; vault proposals come from CAD-SYNC">Mocked connector</Chip></>,
        }}
        onCancel={() => nav(`/engineering/boms/${e.id}`)}
        finishLabel="Commit all or nothing"
        consequence={`Commits ${acc.length} accepted line${acc.length === 1 ? "" : "s"} to ${e.id} in one transaction: matched lines update or add, unmatched lines become Draft placeholders with an MCR each. If any accepted line is in error, nothing changes and the error log is shown.`}
        onFinish={() => {
          let pid = source !== "csv" ? source : undefined
          const r = mutate((d, c) => {
            if (!pid) pid = act.stageCsvProposal(d, c, ebomId, rows)
            return act.commitImport(d, c, ebomId, rows, acc, pid)
          })
          if (!r.ok) {
            setErrorLog(r.error)
            return "Commit refused. See the error log."
          }
          toast.success(`Imported: ${r.value.added} new lines, ${r.value.placeholders} placeholders`)
          nav(`/engineering/boms/${e.id}`)
          return null
        }}
        steps={[
          {
            id: "source", title: "Source and column mapping",
            validate: () => (!raw.length ? "The source has no lines." : source === "csv" && (map.qty < 0 || map.findNo < 0) ? "Map at least Find # and Quantity." : null),
            content: (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label>Source</Label>
                  <Select value={source} onValueChange={(v) => { setSource(v); setAccepted(null) }}>
                    <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {staged.map((p) => <SelectItem key={p.id} value={p.id}>{p.source} {p.id} · {p.vaultTx} · {fmtDate(p.createdOn)} · {p.lines.length} lines</SelectItem>)}
                      <SelectItem value="csv">CSV upload</SelectItem>
                    </SelectContent>
                  </Select>
                  {staged.length === 0 && <span className="text-xs text-muted-foreground">No vault extraction staged for {e.id}. Fire one from <Link className="text-link underline" to="/engineering/cad-sync">CAD sync</Link>, or paste a CSV.</span>}
                </div>
                {source === "csv" && (
                  <>
                    <div className="flex flex-col gap-1"><Label htmlFor="csv">CSV content (first row is the header)</Label><Textarea id="csv" className="min-h-40 font-mono text-xs" value={csv} onChange={(x) => { setCsv(x.target.value); setMap(guess(parseCsv(x.target.value).head)); setAccepted(null) }} /></div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {FIELDS.map((f) => (
                        <div key={f} className="flex flex-col gap-1">
                          <Label>{FIELD_LABEL[f]}</Label>
                          <Select value={String(map[f])} onValueChange={(v) => { setMap({ ...map, [f]: Number(v) }); setAccepted(null) }}>
                            <SelectTrigger aria-label={`Column for ${FIELD_LABEL[f]}`}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="-1">Not mapped</SelectItem>{parsed.head.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ),
          },
          {
            id: "match", title: "Match and accept",
            validate: () => (acc.length ? null : "Accept at least one line."),
            content: (
              <div className="flex flex-col gap-3">
                <p className="flex flex-wrap gap-2 text-sm">{Object.entries(counts).map(([k, n]) => <Chip key={k} kind={k === "Error" ? "block" : k.startsWith("Unmatched") ? "flag" : k === "Changed" ? "change" : "design"}>{k}: {n}</Chip>)}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead className="w-10">Accept</TableHead><TableHead>Find #</TableHead><TableHead>CAD part</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Ref des</TableHead><TableHead>Match state</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.findNo}-${r.description}`} className="h-8 text-[13px]">
                          <TableCell><Checkbox aria-label={`Accept find ${r.findNo}`} checked={acc.includes(r.findNo)} onCheckedChange={(v) => setAccepted(v ? [...acc, r.findNo] : acc.filter((x) => x !== r.findNo))} /></TableCell>
                          <TableCell className="font-mono">{r.findNo}</TableCell>
                          <TableCell className="font-mono">{r.partNo || (r.mpn ? `MPN ${r.mpn}` : "None")}</TableCell>
                          <TableCell>{r.description}</TableCell>
                          <TableCell className="tabular text-right">{fmtNumber(r.qty, 2)}</TableCell>
                          <TableCell>{r.refDes ?? ""}</TableCell>
                          <TableCell>{r.state === "Error" ? <Chip kind="block">Error</Chip> : r.state.startsWith("Unmatched") ? <Chip kind="flag">Placeholder proposal</Chip> : r.state}</TableCell>
                          <TableCell className="text-muted-foreground">{r.matchId && r.matchId !== r.partNo ? `${r.matchId}. ` : ""}{r.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">Error rows are not accepted by default. Accepting one makes the whole commit fail with an error log; nothing is written partially.</p>
                {rows.some((r) => r.state === "Error") && <div><Button variant="outline" size="sm" onClick={() => downloadErrorLog(e.id, rows, acc, errorLog)}><Download aria-hidden="true" />Download error log (CSV)</Button></div>}
              </div>
            ),
          },
          {
            id: "commit", title: "Commit",
            content: (
              <div className="flex flex-col gap-4">
                <dl className="grid gap-4 md:grid-cols-3">
                  <KV k="Accepted lines">{acc.length} of {rows.length}</KV>
                  <KV k="New placeholders">{rows.filter((r) => acc.includes(r.findNo) && r.state.startsWith("Unmatched")).length}</KV>
                  <KV k="Accepted errors">{rows.filter((r) => acc.includes(r.findNo) && r.state === "Error").length}</KV>
                </dl>
                {errorLog && (
                  <ErrorAlert title="Error log: commit refused, nothing changed" action={<Button variant="outline" size="sm" onClick={() => downloadErrorLog(e.id, rows, acc, errorLog)}><Download aria-hidden="true" />Download error log</Button>}>{errorLog}</ErrorAlert>
                )}
              </div>
            ),
          },
        ]}
      />
      <NoPostings />
      <RulesPanel
        rules={[
          ["Match", "Lines match by material code, then by manufacturer part number; anything else is offered as a placeholder proposal", "DOC:p.259"],
          ["Placeholder", "Each accepted unmatched line becomes a Draft placeholder with an MCR; the EBOM cannot release while it stays Draft (V-ENG-03)", "DOC:p.61"],
          ["Commit", "Transactional: all accepted lines commit together or nothing does, with an error log", "DOC:p.259"],
          ["C-14", "Import changes a Draft EBOM only; a Released EBOM changes through an ECO", "erd-sketch C-14"],
        ]}
      />
    </>
  )
}

/** Downloadable error log [DOC:p.61 §3.3]: every row in error, whether it was accepted, and the refusal text. */
function downloadErrorLog(ebomId: string, rows: ImportRow[], accepted: number[], refusal: string | null) {
  const q = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const lines = [
    ["EBOM", "Find #", "CAD part", "MPN", "Description", "Qty", "Ref des", "Accepted", "Error"].map(q).join(","),
    ...rows.filter((r) => r.state === "Error").map((r) => [ebomId, r.findNo, r.partNo, r.mpn, r.description, r.qty, r.refDes, accepted.includes(r.findNo) ? "Yes" : "No", r.note].map(q).join(",")),
  ]
  if (refusal) lines.push("", q(`Commit refused: ${refusal}`))
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${ebomId}-cad-import-error-log.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
