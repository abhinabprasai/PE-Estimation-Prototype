// CO-ALC-001/2 Allocation Cycles [DOC:p.273] (asserted); rules Book I H §5.
// Ordered segments with senders, receivers and drivers; statistical key figure grid; run preview with
// the rounding rule visible. Actions: define, preview, post, rerun (replaces with both retained).
// Posts template #36, net zero at entity level. Analyst defines, Controller posts.
import { useMemo, useState } from "react"
import { useParams } from "react-router"
import { Plus, RotateCcw, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage, DetailPage, DialogShell } from "@/components/templates"
import { Chip, EmptyState, ErrorAlert, KV, PostingPreview, RulesPanel } from "@/components/patterns"
import type { CostCenterId } from "@/data/domain"
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format"
import { useSlice } from "@/store"
import { addSegment, defineCycle, editSkf, postAllocation, removeSegment, rerunAllocation } from "../data/actions"
import { computeAllocation } from "../data/slice"
import { SENDER_BALANCES } from "../data/seed"
import type { AllocCycleRec, AllocSegment, Driver } from "../data/types"
import { Reading, report, Section, TextState, useDemoState } from "../components/common"
import { ccName, DetailFrame, RecLink, SelectField, TextField, userName, SkeletonTable } from "../components/bits"
import { allCenters } from "./Centers"

const PERIODS = ["2026-08", "2026-09", "2026-10"]
const DRIVERS: Driver[] = ["Fixed %", "Headcount", "Sq Ft", "Machine Hours", "Labor Hours", "Revenue Share"]

/** Sender, receiver, driver and account range for one segment (Book I H §5). Used by Define and Add segment. */
function SegmentFields({ v, onChange }: { v: SegForm; onChange: (v: SegForm) => void }) {
  const s = useSlice("purchasingFinance")
  const leaves = allCenters(s).filter((c) => c.postable && c.status !== "Inactive")
  const toggle = (k: "senders" | "receivers", id: string) => onChange({ ...v, [k]: v[k].includes(id) ? v[k].filter((x) => x !== id) : [...v[k], id] })
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        {(["senders", "receivers"] as const).map((k) => (
          <fieldset key={k} className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
            <legend className="px-1 text-sm font-medium">{k === "senders" ? "Senders" : "Receivers"}</legend>
            {leaves.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={v[k].includes(c.id)} onChange={() => toggle(k, c.id)} />
                <span className="font-mono">{c.id}</span> {c.name}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SelectField id="seg-drv" label="Driver" value={v.driver} onChange={(d) => onChange({ ...v, driver: d })} options={DRIVERS.map((d) => ({ value: d, label: d }))} />
        <TextField id="seg-acc" label="Account range" value={v.accountRange} onChange={(x) => onChange({ ...v, accountRange: x })} hint="For example 6000-6999" />
      </div>
      {v.driver === "Fixed %" && (
        <div className="grid grid-cols-3 gap-2">
          {v.receivers.map((r) => (
            <TextField key={r} id={`seg-fx-${r}`} label={`${r} %`} value={v.fixed[r] ?? ""} onChange={(x) => onChange({ ...v, fixed: { ...v.fixed, [r]: x } })} />
          ))}
        </div>
      )}
    </div>
  )
}
export interface SegForm {
  senders: string[]
  receivers: string[]
  driver: Driver
  accountRange: string
  fixed: Record<string, string>
}
const emptySeg = (): SegForm => ({ senders: [], receivers: [], driver: "Headcount", accountRange: "6000-6999", fixed: {} })
const segInput = (v: SegForm) => ({
  senderIds: v.senders as AllocSegment["senderIds"],
  receiverIds: v.receivers as AllocSegment["receiverIds"],
  driver: v.driver,
  accountRange: v.accountRange,
  fixedPct: v.driver === "Fixed %" ? Object.fromEntries(v.receivers.map((r) => [r, Number(v.fixed[r] ?? 0)])) : undefined,
})

export function AllocationList() {
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CO-ALC-001")
  const [sec, setSec] = useState("cycles")
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [defining, setDefining] = useState(false)
  const [nm, setNm] = useState("")
  const [seg, setSeg] = useState<SegForm>(emptySeg())
  const cycles = [...s.allocationCycles].sort((a, b) => a.sequence - b.sequence)
  let body: React.ReactNode
  if (st.loading) body = <SkeletonTable cols={6} rows={5} />
  else if (st.error)
    body = (
      <ErrorAlert title="Allocation cycles could not be loaded" action={<Button size="sm" variant="outline" onClick={st.retry}>Retry</Button>}>
        {st.error}
      </ErrorAlert>
    )
  else if (st.empty) body = <EmptyState title="No allocation cycles defined">Use Define cycle to add ordered segments of senders, account range, receivers and a driver.</EmptyState>
  else if (sec === "cycles")
    body = (
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="text-right">Sequence</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Senders</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-right">Receivers</TableHead>
            {PERIODS.map((p) => (
              <TableHead key={p}>{p}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles.map((c) => (
            <TableRow key={c.id} className="h-8 text-[13px]">
              <TableCell className="tabular text-right">{c.sequence}</TableCell>
              <TableCell>
                <RecLink to={`/controlling/allocations/${c.id}`}>{c.id}</RecLink> {c.name}
              </TableCell>
              <TableCell>{c.senderCostCenterIds.join(", ")}</TableCell>
              <TableCell>{c.driver}</TableCell>
              <TableCell className="tabular text-right">{c.receiverCostCenterIds.length}</TableCell>
              {PERIODS.map((p) => {
                const runs = s.allocRuns.filter((r) => r.cycleId === c.id && r.period === p)
                const posted = runs.find((r) => r.state === "Posted")
                return <TableCell key={p}>{posted ? `Posted ${fmtMoney(posted.total)}${runs.some((r) => r.state === "Reversed") ? " (rerun)" : ""}` : "Not run"}</TableCell>
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  else
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Statistical key figures, quarter 2026-Q3. Values feed the driver shares of every cycle. Controlling analyst or Controller.</p>
        <Table>
          <TableHeader className="bg-table-head">
            <TableRow>
              <TableHead>Cost center</TableHead>
              <TableHead className="text-right">Headcount</TableHead>
              <TableHead className="text-right">Sq ft</TableHead>
              <TableHead className="text-right">Machine hours</TableHead>
              <TableHead className="text-right">Labor hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.skf.map((k) => (
              <TableRow key={k.costCenterId} className="h-8 text-[13px]">
                <TableCell>
                  <span className="font-mono">{k.costCenterId}</span> {ccName(k.costCenterId)}
                </TableCell>
                {(["headcount", "sqft", "machineHours", "laborHours"] as const).map((f) => {
                  const key = `${k.costCenterId}:${f}`
                  return (
                    <TableCell key={f} className="text-right">
                      <Input
                        aria-label={`${k.costCenterId} ${f}`}
                        className="ml-auto h-8 w-24 text-right"
                        value={edit[key] ?? String(k[f])}
                        onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                        onBlur={() => {
                          if (edit[key] != null && Number(edit[key]) !== k[f]) report(editSkf(k.costCenterId, f, Number(edit[key])), `${k.costCenterId} ${f} saved`)
                        }}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  return (
    <ConfigPage
      header={{
        screenId: "CO-ALC-001/2",
        title: "Allocation cycles",
        description: "Period-end distribution of shared costs (close checklist step 5b). Cycles run in their defined order and net to zero at entity level.",
        actions: st.menu,
        primary: (
          <Button onClick={() => setDefining(true)}>
            <Plus aria-hidden="true" /> Define cycle
          </Button>
        ),
      }}
      sections={[
        { id: "cycles", label: "Cycles in sequence" },
        { id: "skf", label: "Statistical key figures" },
      ]}
      section={sec}
      onSectionChange={setSec}
    >
      <div className="flex flex-col gap-4">
        {body}
        <DialogShell
          open={defining}
          onOpenChange={(o) => !o && setDefining(false)}
          wide
          title="Define an allocation cycle"
          confirmLabel="Define cycle"
          consequence="Adds the cycle at the end of the sequence with its first segment. It posts only when the Controller runs it. The Controlling analyst defines; a cycle with a posted run keeps its definition."
          onConfirm={() => {
            const r = defineCycle({ name: nm, ...segInput(seg) })
            const err = report(r, (id) => `${id} defined`)
            if (!err) (setNm(""), setSeg(emptySeg()), setDefining(false))
            return err
          }}
        >
          <TextField id="cyc-name" label="Cycle name" value={nm} onChange={setNm} />
          <SegmentFields v={seg} onChange={setSeg} />
        </DialogShell>
        <RulesPanel
          rules={[
            ["H §5", "Cycles run in defined order; segments: senders, account range, receivers, driver", "[DOC:p.114 §5]"],
            ["H §5", "Shares rounded to the cent; the remainder goes to the largest receiver", "[DOC:p.114 §5]"],
            ["H §5", "Rerun reverses and reposts; both runs are retained", "[DOC:p.114 §5]"],
            ["#36", "DR receiver CC 7500 / CR sender CC 7500; net zero at entity level", "Part J"],
          ]}
        />
      </div>
    </ConfigPage>
  )
}

export function AllocationDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useDemoState("CO-ALC-002")
  const c = s.allocationCycles.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={st.error} onRetry={st.retry} found={!!c} title={id} screenId="CO-ALC-001/2" back={{ label: "Allocation cycles", to: "/controlling/allocations" }}>
      {() => <CycleBody c={c!} menu={st.menu} />}
    </DetailFrame>
  )
}

function CycleBody({ c, menu }: { c: AllocCycleRec; menu: React.ReactNode }) {
  const s = useSlice("purchasingFinance")
  const [period, setPeriod] = useState("2026-10")
  const [dlg, setDlg] = useState<null | "post" | "rerun" | "segment">(null)
  const [seg, setSeg] = useState<SegForm>(emptySeg())
  const preview = useMemo(() => computeAllocation(c, period, s.skf), [c, period, s.skf])
  const total = Math.round(preview.reduce((t, l) => t + l.amount, 0) * 100) / 100
  const senderTotal = c.senderCostCenterIds.reduce((t, x) => t + (SENDER_BALANCES[period]?.[x] ?? 0), 0)
  const runs = s.allocRuns.filter((r) => r.cycleId === c.id).sort((a, b) => b.id.localeCompare(a.id))
  const posted = runs.find((r) => r.period === period && r.state === "Posted")
  const state = posted ? "Posted" : runs.some((r) => r.period === period && r.state === "Reversed") ? "Reversed" : "Defined"
  return (
    <>
      <DetailPage
        header={{
          screenId: "CO-ALC-001/2",
          title: `${c.id} · ${c.name}`,
          crumbs: [{ label: "Allocation cycles", to: "/controlling/allocations" }],
          chips: (
            <>
              <TextState value={`${state} for ${period}`} />
              <Reading id="OQ-PF-9" />
            </>
          ),
          actions: (
            <>
              {menu}
              <div className="w-36">
                <SelectField id="alc-p" label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
              </div>
              {posted && (
                <Button variant="outline" onClick={() => setDlg("rerun")}>
                  <RotateCcw aria-hidden="true" /> Rerun
                </Button>
              )}
            </>
          ),
          primary: !posted ? (
            <Button onClick={() => setDlg("post")}>
              <Send aria-hidden="true" /> Post {period}
            </Button>
          ) : undefined,
        }}
        summary={
          <>
            <KV k="Sequence">{c.sequence}</KV>
            <KV k="Entity">{c.entityId}</KV>
            <KV k="Sender balance">{fmtMoney(senderTotal)}</KV>
            <KV k="Preview total">
              {fmtMoney(total)} {Math.abs(total - senderTotal) < 0.005 ? <Chip kind="design">Net zero</Chip> : <Chip kind="flag">Does not net</Chip>}
            </KV>
          </>
        }
        tabs={[
          {
            id: "preview",
            label: "Run preview",
            count: preview.length,
            content: (
              <div className="flex flex-col gap-4">
                <p className="text-sm">Rounding rule: each receiver's share is rounded down to the cent; the remainder goes to the largest receiver so the run nets to zero.</p>
                <Table>
                  <TableHeader className="bg-table-head">
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead className="text-right">Driver value</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((l, i) => (
                      <TableRow key={i} className="h-8 text-[13px]">
                        <TableCell>{l.segment}</TableCell>
                        <TableCell className="font-mono">{l.senderId}</TableCell>
                        <TableCell>
                          <span className="font-mono">{l.receiverId}</span> {ccName(l.receiverId)}
                        </TableCell>
                        <TableCell className="tabular text-right">{fmtNumber(l.driverValue)}</TableCell>
                        <TableCell className="tabular text-right">{fmtMoney(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PostingPreview lines={[{ template: 36, amount: total, detail: `${preview.length} receiver lines; senders credited ${fmtMoney(senderTotal)}` }]} period={period} />
              </div>
            ),
          },
          {
            id: "segments",
            label: "Segments",
            count: c.segments.length,
            content: (
              <div className="flex flex-col gap-2">
              <div>
                <Button size="sm" variant="outline" onClick={() => setDlg("segment")}>
                  <Plus aria-hidden="true" /> Add segment
                </Button>
              </div>
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead>Senders</TableHead>
                    <TableHead>Accounts</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Receivers</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.segments.map((g) => (
                    <TableRow key={g.no} className="align-top text-[13px]">
                      <TableCell>{g.no}</TableCell>
                      <TableCell>{g.senderIds.map((x: CostCenterId) => `${x} ${ccName(x)}`).join(", ")}</TableCell>
                      <TableCell>{g.accountRange}</TableCell>
                      <TableCell>{g.driver}</TableCell>
                      <TableCell>{g.receiverIds.join(", ")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" aria-label={`Remove segment ${g.no}`} onClick={() => report(removeSegment(c.id, g.no), `Segment ${g.no} removed`)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ),
          },
          {
            id: "runs",
            label: "Runs",
            count: runs.length,
            content: runs.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id} className="h-8 text-[13px]">
                      <TableCell className="font-mono">{r.id}</TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell>
                        {fmtDate(r.postedOn)} {userName(r.postedBy)}
                      </TableCell>
                      <TableCell className="tabular text-right">{fmtMoney(r.total)}</TableCell>
                      <TableCell>
                        {r.state}
                        {r.reversedBy && ` by ${r.reversedBy}`}
                        {r.replaces && ` (replaces ${r.replaces})`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Never run" />
            ),
          },
        ]}
        aside={<Section title="Cycle state"><p className="text-sm">Allocation cycles have no status list in the specification; Defined, Posted and Reversed are prototype words shown as text (OQ-21).</p></Section>}
      />
      <DialogShell open={dlg === "post"} onOpenChange={(o) => !o && setDlg(null)} title={`Post ${c.id} for ${period}`} confirmLabel="Post" consequence={`Posts ${fmtMoney(total)} through template #36 from ${c.senderCostCenterIds.join(", ")} to ${c.receiverCostCenterIds.length} receivers, net zero at entity level. Earlier cycles in the sequence must be posted first. Controller only.`} onConfirm={() => report(postAllocation(c.id, period), (rid) => `${rid} posted`)}>
        <PostingPreview lines={[{ template: 36, amount: total }]} period={period} />
      </DialogShell>
      <DialogShell
        open={dlg === "segment"}
        onOpenChange={(o) => !o && setDlg(null)}
        wide
        title={`Add a segment to ${c.id}`}
        confirmLabel="Add segment"
        consequence="Appends a segment to the cycle. Allowed only while the cycle has no posted run. Controlling analyst."
        onConfirm={() => {
          const err = report(addSegment(c.id, segInput(seg)), "Segment added")
          if (!err) (setSeg(emptySeg()), setDlg(null))
          return err
        }}
      >
        <SegmentFields v={seg} onChange={setSeg} />
      </DialogShell>
      <DialogShell open={dlg === "rerun"} onOpenChange={(o) => !o && setDlg(null)} title={`Rerun ${c.id} for ${period}`} confirmLabel="Reverse and repost" consequence={`Reverses ${posted?.id} (${fmtMoney(posted?.total ?? 0)}) and posts a replacement at the current key figures (${fmtMoney(total)}). Both runs are retained. Controller only.`} onConfirm={() => report(rerunAllocation(c.id, period), (rid) => `${rid} replaces ${posted?.id}`)}>
        <PostingPreview lines={[{ template: 36, amount: -(posted?.total ?? 0), detail: `Reversal of ${posted?.id}` }, { template: 36, amount: total, detail: "Replacement" }]} period={period} />
      </DialogShell>
    </>
  )
}
