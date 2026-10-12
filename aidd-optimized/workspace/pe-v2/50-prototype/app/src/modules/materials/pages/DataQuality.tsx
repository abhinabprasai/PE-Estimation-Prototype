// MM-DQ-001 Data Quality Dashboard [DOC:p.248] (asserted); KPIs and targets per Book II §16.4.
// Tiles for completeness, MCR cycle time, duplicates, stale sourcing, governance exceptions and
// PC-900 count, each with a drill list. Action: assign owners (worklist assignments).
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardCard, DashboardPage } from "@/components/templates"
import { EmptyState, ErrorAlert, RulesPanel, SkeletonRows } from "@/components/patterns"
import { Table, TableBody } from "@/components/ui/table"
import type { UserId } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { DUPLICATE_THRESHOLD, ESCALATE_TO, businessDaysBetween, completeness, isValuated, monthsBetween, similarity, slaState } from "../lib/rules"
import { allMaterials, R } from "../data/state"
import { assignDq } from "../data/actions"
import { DocLinkText, MatLink, Reading, userName, useListState } from "../components/common"
import { run } from "../components/run"

type Item = { key: string; ref: string; to: string; text: string }

export function DataQuality() {
  const s = useSlice("materials")
  const st = useListState("MM-DQ-001")
  const [open, setOpen] = useState<string>("completeness")
  const k = useMemo(() => {
    const mats = allMaterials(s)
    const active = mats.filter((m) => m.status === "Active")
    const wip = mats.filter((m) => m.status === "Data Completion")
    const comp = (ms: typeof mats) => ms.map((m) => ({ m, ...completeness(m, s.views[m.id]) }))
    const ca = comp(active)
    const cw = comp([...active, ...wip])
    const avg = (xs: { pct: number }[]) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length) : 100)
    const done = s.mcrs.filter((r) => r.activatedOn).map((r) => ({ r, d: businessDaysBetween(r.createdOn, r.activatedOn!) })).sort((a, b) => a.d - b.d)
    const p80 = done.length ? done[Math.min(done.length - 1, Math.ceil(done.length * 0.8) - 1)].d : 0
    const dups: { a: string; b: string; score: number }[] = []
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]
        const b = active[j]
        if ((s.views[a.id]?.groupPath[0] ?? "x") !== (s.views[b.id]?.groupPath[0] ?? "y")) continue
        const sc = similarity(a.description, b.description)
        if (sc >= DUPLICATE_THRESHOLD) dups.push({ a: a.id, b: b.id, score: sc })
      }
    const buy = active.filter((m) => isValuated(m.type) && s.views[m.id]?.procurement !== "Make")
    const stale = buy.filter((m) => {
      const irs = s.infoRecords.filter((x) => x.materialId === m.id)
      if (!irs.length) return false
      return irs.every((x) => {
        const po = x.actuals.find((a) => a.kind === "Last PO")
        return monthsBetween(po?.on ?? x.validFrom, TODAY) > 12
      })
    })
    const gov = s.mchs.filter((c) => c.fieldClass === 2 && c.rows.some((r) => r.appliedAt) && !c.approvalRefs.length)
    // MCR task SLA breaches escalate to the role's manager and appear here (§4.2 [DOC:p.150], RD-MM-27)
    const breaches = s.mcrs.filter((r) => r.open && r.stage === "Tasks open").flatMap((r) => r.tasks.filter((t) => slaState(t, TODAY) === "Breached").map((t) => ({ r, t })))
    const pc900 = mats.filter((m) => isValuated(m.type) && m.status !== "Obsolete" && m.profitCenterId === "PC-900")
    return {
      completeness: {
        label: "Completeness (Active)",
        value: `${avg(ca)}%`,
        hint: `Target 100% Active; ${avg(cw)}% incl. Data Completion (target 95%)`,
        bad: ca.some((x) => x.pct < 100),
        items: cw.filter((x) => x.pct < 100).map((x): Item => ({ key: `completeness:${x.m.id}`, ref: x.m.id, to: R.material(x.m.id), text: `${x.pct}% ${x.m.status}: ${x.missing.slice(0, 3).join("; ")}` })),
      },
      cycle: {
        label: "MCR cycle time P80",
        value: `${p80} days`,
        hint: "Target P80 at most 5 business days",
        bad: p80 > 5,
        items: done.filter((x) => x.d > 5).map((x): Item => ({ key: `cycle:${x.r.id}`, ref: x.r.id, to: R.mcr(x.r.id), text: `${x.d} business days, ${x.r.requestedType}, ${x.r.description}` })),
      },
      duplicates: {
        label: "Duplicate candidates",
        value: dups.length,
        hint: `Similarity at or above 0.9 in the same group L1; ${active.length ? ((dups.length / active.length) * 1000).toFixed(1) : 0} per 1,000 Active (target under 2 per quarter)`,
        bad: active.length ? (dups.length / active.length) * 1000 >= 2 : false,
        items: dups.map((d): Item => ({ key: `dup:${d.a}:${d.b}`, ref: d.a, to: R.material(d.a), text: `${d.a} and ${d.b}, similarity ${d.score.toFixed(2)}` })),
      },
      stale: {
        label: "Stale sourcing",
        value: `${buy.length ? Math.round((stale.length / buy.length) * 100) : 0}%`,
        hint: `${stale.length} of ${buy.length} buy materials with only a basis older than 12 months (target under 5%)`,
        bad: buy.length ? stale.length / buy.length >= 0.05 : false,
        items: stale.map((m): Item => ({ key: `stale:${m.id}`, ref: m.id, to: `/purchasing/info-records?material=${m.id}`, text: m.description })),
      },
      governance: {
        label: "Governance exceptions",
        value: gov.length,
        hint: "Class 2 changes applied without a linked approval (target 0)",
        bad: gov.length > 0,
        items: gov.map((c): Item => ({ key: `gov:${c.id}`, ref: c.id, to: R.mch(c.id), text: c.title })),
      },
      sla: {
        label: "MCR task SLA breaches",
        value: breaches.length,
        hint: "Tasks past their 2-business-day SLA; each escalates to the owning role's manager (target 0)",
        bad: breaches.length > 0,
        items: breaches.map(({ r, t }): Item => ({ key: `sla:${r.id}:${t.id}`, ref: r.id, to: R.mcr(r.id), text: `${t.view} (${t.ownerRole}, ${userName(t.ownerUserId)}) due ${t.slaDue}; escalated to the ${ESCALATE_TO[t.ownerRole] ?? "Materials Manager"}` })),
      },
      pc900: {
        label: "PC-900 materials",
        value: pc900.length,
        hint: "Valuated materials on the fallback profit center (target 0)",
        bad: pc900.length > 0,
        items: pc900.map((m): Item => ({ key: `pc900:${m.id}`, ref: m.id, to: R.material(m.id, "accounting"), text: `${m.type} ${m.description}` })),
      },
    }
  }, [s])

  const ownerOf = (key: string) => s.dqAssignments.find((a) => a.key === key)
  const card = (id: keyof typeof k) => {
    const x = k[id]
    return (
      <DashboardCard
        key={id}
        title={`${x.label} (${x.items.length})`}
        className={cn(open === id && "border-primary")}
        action={
          <Button size="sm" variant="ghost" onClick={() => setOpen(id)}>
            Open list
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">{x.hint}</p>
        {open === id &&
          (x.items.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {x.items.map((it) => {
                const own = ownerOf(it.key)
                return (
                  <li key={it.key} className="flex flex-wrap items-center gap-2 border-b py-1 last:border-b-0">
                    {it.ref.startsWith("MCR") || it.ref.startsWith("MCH") ? <DocLinkText to={it.to}>{it.ref}</DocLinkText> : <MatLink id={it.ref} />}
                    <span className="min-w-0 flex-1 text-xs">{it.text}</span>
                    <Select value={own?.userId ?? ""} onValueChange={(u) => run(assignDq(it.key, u as UserId), `Assigned to ${userName(u)}`)}>
                      <SelectTrigger size="sm" className="h-7 w-44" aria-label={`Owner for ${it.ref}`}>
                        <SelectValue placeholder="Assign owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {USERS.filter((u) => u.roles.some((r) => ["Material steward", "Materials Manager", "Buyer", "Planner", "Cost accountant"].includes(r))).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.roles[0]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState title="No exceptions">This KPI is on target.</EmptyState>
          ))}
      </DashboardCard>
    )
  }
  const ids = Object.keys(k) as (keyof typeof k)[]
  return (
    <>
      <DashboardPage
        header={{
          screenId: "MM-DQ-001",
          title: "Data quality",
          description: "Monthly review of master-data health. Open a list, then assign an owner to each exception.",
          actions: st.toolbar,
          chips: <Reading id="RD-MM-16" />,
        }}
        tiles={st.loading || st.error || st.empty ? undefined : ids.map((id) => ({ label: k[id].label, value: k[id].value, hint: k[id].hint, tone: k[id].bad ? ("attention" as const) : ("default" as const) }))}
      >
        {st.loading ? (
          <Table className="lg:col-span-2">
            <TableBody>
              <SkeletonRows cols={3} rows={6} />
            </TableBody>
          </Table>
        ) : st.error ? (
          <div className="lg:col-span-2">
            <ErrorAlert title="Dashboard could not load" action={<Button size="sm" variant="outline" onClick={st.onRetry}>Retry</Button>}>
              {st.error}
            </ErrorAlert>
          </div>
        ) : st.empty ? (
          <div className="lg:col-span-2">
            <EmptyState title="No materials to measure">KPIs appear once materials exist.</EmptyState>
          </div>
        ) : (
          ids.map(card)
        )}
      </DashboardPage>
      <p className="mt-4 text-xs text-muted-foreground">{s.dqAssignments.length} worklist assignment(s) this session.</p>
      <RulesPanel
        rules={[
          ["§16.4", "Completeness 100% for Active (95% including Data Completion); MCR cycle P80 at most 5 business days; duplicates under 2 per 1,000 Active per quarter; stale sourcing under 5%; governance exceptions 0; PC-900 materials 0.", "[Book II §16.4]"],
          ["§4.2", "An MCR task SLA breach escalates to the role's manager and appears on this dashboard.", "[Book II §4.2]"],
          ["RD-MM-16 / RD-MM-27", "Completeness uses a subset of each view's mandatory fields; the manager per role for SLA escalation is a reading.", "README Readings"],
        ]}
      />
    </>
  )
}
