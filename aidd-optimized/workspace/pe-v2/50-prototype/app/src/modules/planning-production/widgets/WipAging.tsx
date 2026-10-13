// WIP aging: open order value by age bucket and stalled orders (no confirmation in N days) [DOC:p.82
// Book I D §12 "WIP Aging"]. Used on the WIP board (PP-WIP-001) and as a production report.
import { useState } from "react"
import { Link } from "react-router"
import { Chip } from "@/components/patterns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { WoLink } from "../components"
import { AGE_BUCKETS, STALLED_DAYS, wipAging } from "../lib/reports"

export function WipAging({ empty }: { empty?: boolean }) {
  const s = useSlice("planningProduction")
  const [n, setN] = useState(String(STALLED_DAYS))
  const rows = empty ? [] : wipAging(s, Number(n))
  const total = rows.reduce((a, r) => a + r.value, 0)
  const stalled = rows.filter((r) => r.stalled)
  return (
    <section aria-label="WIP aging" className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">WIP aging</h2>
        <span className="text-sm text-muted-foreground">Open order value by age since release; {rows.length} open orders, {fmtMoney(total)}.</span>
        <span className="ml-auto flex items-center gap-2 text-sm">
          Stalled after
          <Select value={n} onValueChange={setN}><SelectTrigger size="sm" className="w-24" aria-label="Stalled after days"><SelectValue /></SelectTrigger><SelectContent>{["3", "5", "7", "10"].map((x) => <SelectItem key={x} value={x}>{x} days</SelectItem>)}</SelectContent></Select>
          <Chip kind="design" note="The PRD says no confirmation in N days without giving N; 5 is the prototype's value">N is a reading</Chip>
        </span>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No open orders carry WIP.</p> : (
        <>
          <ul className="grid gap-2 sm:grid-cols-4">
            {AGE_BUCKETS.map(([label]) => {
              const b = rows.filter((r) => r.bucket === label)
              const v = b.reduce((a, r) => a + r.value, 0)
              return (
                <li key={label} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="tabular text-lg font-semibold">{fmtMoney(v)}</p>
                  <p className="tabular text-xs text-muted-foreground">{b.length} order(s) · {total ? Math.round((v / total) * 100) : 0}%</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation"><div className="h-full bg-primary" style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
                </li>
              )
            })}
          </ul>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-table-head text-left"><tr>{["Order", "Age (days)", "Bucket", "WIP value", "Last confirmation", "Idle (days)", ""].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody className="[&_td]:px-3 [&_td]:py-1.5 [&_tr]:border-t">
                {rows.map((r) => (
                  <tr key={r.wo.id}>
                    <td><WoLink id={r.wo.id} /></td><td className="tabular">{r.age}</td><td>{r.bucket}</td><td className="tabular">{fmtMoney(r.value)}</td>
                    <td className="tabular">{r.lastConfirmed ? fmtDate(r.lastConfirmed) : "none yet"}</td><td className="tabular">{r.idleDays}</td>
                    <td>{r.stalled && <Chip kind="flag" note={`No confirmation in ${n} days or more`}>Stalled</Chip>}{r.wo.status === "On Hold" && <Chip kind="hold" note={r.wo.holdReason}>Hold</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{stalled.length} stalled order(s). <Link className="text-link underline" to="/production/dispatch">Open the dispatch list</Link> to resequence or clear an andon.</p>
        </>
      )}
    </section>
  )
}
