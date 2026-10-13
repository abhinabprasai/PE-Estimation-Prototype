// FX-MM-MCHREG: Material change register and document detail [Book II §4.4, §16.1].
// /materials/change-register lists every MCH by stage, origin and effective date; the detail at
// /materials/change-register/:id shows rows, result log, approvals and the ECO link, and cancels a
// scheduled change. MCH has no status list in the PRD (OQ-21): the stage is text, never a badge.

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { Ban, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { ApprovalButton, EmptyState, KV, RulesPanel, type Column } from "@/components/patterns"
import { DOC_TYPES } from "@/data/domain"
import { fmtDate, fmtMoney } from "@/lib/format"
import { useSlice } from "@/store"
import { R } from "../data/state"
import type { MchRecord } from "../data/types"
import { cancelScheduledMch } from "../data/ext-actions"
import { DocLinkText, MatLink, NoStatusList, Reading, Section, userName } from "../components/common"
import { useViewState } from "../components/states"
import { confirmRun } from "../components/run"
import { ValuationActions } from "./MchValuation"

type Origin = "ECO" | "Valuation change" | "Mass change" | "Single change" | "Bulk import"
export function originOf(c: MchRecord, importIds: Map<string, string>): Origin {
  return importIds.has(c.id) ? "Bulk import" : c.ecoRef ? "ECO" : c.valuation ? "Valuation change" : c.rows.length + c.excluded.length > 1 ? "Mass change" : "Single change"
}
const useOrigins = () => {
  const s = useSlice("materials")
  return useMemo(() => {
    const m = new Map<string, string>()
    for (const j of s.x.imports) for (const c of j.created) if (c.kind === "MCH") m.set(c.id, j.id)
    return m
  }, [s.x.imports])
}
const effectiveOf = (c: MchRecord) => (c.apply === "Immediate" ? (c.rows.find((r) => r.appliedAt)?.appliedAt ?? c.createdOn) : (c.effective ?? ""))

export function ChangeRegister() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-MCHREG")
  const origins = useOrigins()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const rows = st.empty ? [] : s.mchs.filter((c) => (!from || effectiveOf(c) >= from) && (!to || effectiveOf(c) <= to))
  const cols: Column<MchRecord>[] = [
    { id: "id", header: "Change", value: (c) => c.id, sortable: true, mono: true, className: "w-36" },
    { id: "title", header: "Title", value: (c) => c.title },
    { id: "origin", header: "Origin", value: (c) => originOf(c, origins), filterable: true },
    { id: "cls", header: "Class", value: (c) => `Class ${c.fieldClass}`, filterable: true },
    { id: "stage", header: "Stage", value: (c) => c.stage, filterable: true, cell: (c) => <span className="rounded-md border px-2 py-0.5 text-xs">{c.stage}</span> },
    { id: "eff", header: "Effective", value: (c) => effectiveOf(c), sortable: true, cell: (c) => (c.apply === "Immediate" ? <span>Immediate · {fmtDate(effectiveOf(c))}</span> : <span>{fmtDate(c.effective)}</span>) },
    { id: "rows", header: "Rows", value: (c) => c.rows.length, align: "right", mono: true, cell: (c) => `${c.rows.length}${c.excluded.length ? ` (+${c.excluded.length})` : ""}` },
    { id: "eco", header: "ECO", value: (c) => c.ecoRef ?? "", cell: (c) => (c.ecoRef ? <DocLinkText to={DOC_TYPES.eco.route(c.ecoRef)}>{c.ecoRef}</DocLinkText> : "") },
    { id: "by", header: "Requested by", value: (c) => userName(c.createdBy), filterable: true },
  ]
  return (
    <>
      <ListPage
        header={{
          screenId: "FX-MM-MCHREG",
          title: "Material change register",
          chips: <NoStatusList />,
          description: "Every change request by stage, origin and effective date. Open one for its rows, result log, approvals and ECO link; a scheduled change can be cancelled before it applies.",
          primary: (
            <Button asChild>
              <Link to="/materials/change-requests">New change request</Link>
            </Button>
          ),
        }}
        above={
          <div className="flex flex-col gap-2">
            {st.banners}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="reg-from">Effective from</Label>
                <Input id="reg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="reg-to">Effective to</Label>
                <Input id="reg-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
              </div>
              {(from || to) && (
                <Button size="sm" variant="ghost" onClick={() => (setFrom(""), setTo(""))}>
                  Clear dates
                </Button>
              )}
            </div>
          </div>
        }
        table={{
          rows,
          columns: cols,
          rowId: (c) => c.id,
          rowHref: (c) => R.mchDoc(c.id),
          searchText: (c) => `${c.id} ${c.title} ${c.reason} ${c.ecoRef ?? ""}`,
          searchPlaceholder: "Search change, title, reason, ECO",
          loading: st.loading,
          error: st.error,
          onRetry: st.onRetry,
          toolbar: st.toolbar,
          empty: { title: "No change requests yet", body: "Create one from the change request wizard." },
          initialSort: { id: "id", dir: "desc" },
        }}
      />
      <RulesPanel
        rules={[
          ["§4.4", "Class 2 single changes and all mass changes run as MCH documents: proposed rows, approval per class, scheduled apply (immediate or effective-dated), full audit; an MCH links to an ECO when the change originates from engineering change control.", "[Book II §4.4]"],
          ["§16.1", "Every row writes the standard field-level audit with the MCH reference; the result log is downloadable.", "[Book II §16.1]"],
          ["OQ-21", "MCH has no status list in the PRD; the stage is text.", "open-questions.md"],
        ]}
      />
    </>
  )
}

export function ChangeRegisterDetail() {
  const { id = "" } = useParams()
  const s = useSlice("materials")
  const st = useViewState("FX-MM-MCHREG-detail")
  const origins = useOrigins()
  const [cancel, setCancel] = useState(false)
  const c = s.mchs.find((x) => x.id === id)
  if (!c)
    return (
      <EmptyState title={`Change request ${id} not found`}>
        <Link to="/materials/change-register" className="text-link underline">
          Back to the register
        </Link>
      </EmptyState>
    )
  const origin = originOf(c, origins)
  const terminal = ["Applied", "Applied with errors", "Rejected", "Cancelled"].includes(c.stage)
  const download = () => {
    const blob = new Blob([[`${c.id} ${c.title}`, `Stage: ${c.stage}`, ...c.log, ...c.excluded.map((x) => `excluded ${x.materialId}: ${x.reason}`)].join("\n")], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${c.id}-log.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const rows = (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Old</TableHead>
            <TableHead>New</TableHead>
            <TableHead>Applied</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.rows.map((r) => (
            <TableRow key={r.materialId} className="h-8 text-[13px]">
              <TableCell>
                <MatLink id={r.materialId} />
              </TableCell>
              <TableCell>{r.field}</TableCell>
              <TableCell>{r.old || "blank"}</TableCell>
              <TableCell>{r.new}</TableCell>
              <TableCell>{r.appliedAt ? fmtDate(r.appliedAt) : "Not yet"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {c.excluded.length > 0 && (
        <Section title={`Excluded rows (${c.excluded.length})`}>
          <ul className="text-sm">
            {c.excluded.map((x) => (
              <li key={x.materialId}>
                <MatLink id={x.materialId} /> · {x.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
  const val = c.valuation && (
    <Section title={`${c.valuation.kind}: effect (§5.4)`}>
      <p className="text-sm">
        Effective {fmtDate(c.valuation.effective)}. {c.valuation.kind === "Method change" ? `Revaluation delta ${fmtMoney(c.valuation.totalDelta)}: Dr ${c.valuation.glDebit} / Cr ${c.valuation.glCredit}.` : "Price unit recomputed factor-consistently; stock value is unchanged."}
      </p>
      <ul className="text-xs">
        {c.valuation.reval.map((r) => (
          <li key={r.materialId}>
            <MatLink id={r.materialId} /> · {r.qty} on hand · {fmtMoney(r.from)} to {fmtMoney(r.to)} · delta {fmtMoney(r.delta)} {r.note && `· ${r.note}`}
          </li>
        ))}
      </ul>
      {c.valuation.controllerApplied && <p className="text-xs">Released by the Controller on {fmtDate(c.valuation.controllerApplied.on)}.</p>}
    </Section>
  )
  const valActions = c.valuation && <ValuationActions c={c} disabled={!st.canWrite} why={st.blockedWhy} />
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-MM-MCHREG",
          title: `${c.id} ${c.title}`,
          crumbs: [{ label: "Change register", to: "/materials/change-register" }, { label: c.id }],
          chips: (
            <>
              <NoStatusList />
              <span className="rounded-md border px-2 py-0.5 text-xs">Stage: {c.stage}</span>
              <span className="rounded-md border px-2 py-0.5 text-xs">{origin}</span>
            </>
          ),
          primary:
            c.stage === "Scheduled" ? (
              <Button variant="destructive" disabled={!st.canWrite} title={st.blockedWhy} onClick={() => setCancel(true)}>
                <Ban aria-hidden="true" /> Cancel scheduled change
              </Button>
            ) : undefined,
          actions: (
            <>
              <Button variant="outline" asChild>
                <Link to={R.mch(c.id)}>Open in the wizard</Link>
              </Button>
              <Button variant="outline" onClick={download}>
                <Download aria-hidden="true" /> Download log
              </Button>
              {c.fieldClass === 2 && (c.stage === "Draft" || c.stage === "In approval") && <ApprovalButton kind="Material change" subject={{ type: "material", id: c.id }} title={`${c.id}: ${c.title} (${c.rows.length} rows)`} stay disabled={!st.canWrite} disabledReason={st.blockedWhy} />}
            </>
          ),
          description: st.banners ? undefined : undefined,
        }}
        summary={
          <>
            <KV k="Class">{`Class ${c.fieldClass} · ${c.mode}`}</KV>
            <KV k="Effective">{c.apply === "Immediate" ? "Immediate" : fmtDate(c.effective)}</KV>
            <KV k="Requested by">{userName(c.createdBy)}</KV>
            <KV k="ECO">{c.ecoRef ? <DocLinkText to={DOC_TYPES.eco.route(c.ecoRef)}>{c.ecoRef}</DocLinkText> : "None (not from engineering change control)"}</KV>
          </>
        }
        tabs={[
          { id: "rows", label: "Rows", count: c.rows.length, content: <div className="flex flex-col gap-3">{st.banners}{val}{valActions}{rows}</div> },
          {
            id: "log",
            label: "Result log",
            content: c.log.length ? (
              <ul className="text-sm">
                {c.log.map((l, i) => (
                  <li key={i} className="font-mono text-xs">
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing applied yet">{c.stage === "Scheduled" ? `The change applies on ${fmtDate(c.effective)}.` : "The log fills when rows are applied."}</EmptyState>
            ),
          },
          {
            id: "approvals",
            label: "Approvals and activity",
            content: (
              <div className="flex flex-col gap-3 text-sm">
                <p>
                  {c.approvalRefs.length ? (
                    <>Approval requests: {c.approvalRefs.map((a) => <Link key={a} to={`/approvals?req=${a}`} className="mr-2 font-mono text-link underline">{a}</Link>)}</>
                  ) : c.fieldClass === 1 ? "Class 1: applied by the owner role; no approval." : "No approval raised yet."}
                </p>
                <ul>
                  {c.activity.map((a, i) => (
                    <li key={i}>
                      {fmtDate(a.at)} · {a.by} · {a.text}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Reason: {c.reason}</p>
              </div>
            ),
          },
        ]}
      />
      {terminal && <p className="mt-2 text-xs text-muted-foreground">This change is {c.stage.toLowerCase()}: it opens read-only. A mistake is reversed by a new change request, never by editing this one.</p>}
      <DialogShell
        open={cancel}
        onOpenChange={setCancel}
        title={`Cancel scheduled change ${c.id}`}
        description={`${c.rows.length} row(s) of ${c.rows[0]?.field ?? "the field"} would have applied on ${fmtDate(c.effective)}.`}
        consequence={`${c.id} is cancelled: nothing applies, the rows stay as they are today, and the cancellation is logged. A cancelled change cannot be restarted; raise a new one.`}
        requireReason
        destructive
        confirmLabel="Cancel scheduled change"
        onConfirm={(reason) => (st.canWrite ? confirmRun(cancelScheduledMch(c.id, reason), `${c.id} cancelled`) : (st.blockedWhy ?? "Blocked"))}
      />
      <Reading id="RD-MM-31" />
    </>
  )
}
