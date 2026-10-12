// QM-CAPA/SCAR CAPA and SCAR [DOC:p.265 Book VI; Book I E §5, §6, pp.88-90] (asserted).
// CAPA with sources, root-cause method, action table and the effectiveness gate (S-25). SCAR in 8D
// structure with vendor response tracking; overdue SCARs restrict the vendor on the AVL. NCR link
// records (INV 15.4 owns the NCR) are listed here because every escalation starts from one.
// Postings and scans: none.

import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, ErrorAlert, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { STATUS, THRESHOLDS } from "@/data/domain"
import { TODAY, USERS } from "@/data/shared"
import { addDays } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { capa as act, isOverdue, ncrStage, scar as sact } from "../data/actions"
import { EIGHT_D, type CapaAction, type EightD, type QtCapa, type QtNcr, type QtScar } from "../data/types"
import { ActivityList, DocLinkText, NoList, NotFound, Pick, Reading, Section, Stat, TextField, materialText, report, useDataState, userName, vendorName } from "../components/bits"

export const CAPA_RULES: [string, string, string][] = [
  ["QM-C1", "CAPA lifecycle: Open → Analysis → Actions In Progress → Implemented → Effectiveness Check → Closed; a failed effectiveness check reopens it.", "DOC:p.88 §5"],
  ["QM-C2", "Root cause and method (5-Why, Fishbone, 8D, FMEA) are required before actions; every action needs done status and evidence before Implemented.", "DOC:p.88 §5"],
  ["QM-C3", `The effectiveness check runs at least ${THRESHOLDS.capaEffectivenessMinDays} days after implementation; only the Quality Manager closes.`, "DOC:p.88 §5"],
  ["QM-C4", "Sources: NCRs, RMA failure analysis, audits. Containment, corrective and preventive actions each carry an owner and a due date.", "DOC:p.88 §5"],
]
export const SCAR_RULES: [string, string, string][] = [
  ["QM-S1", "A SCAR is raised from a vendor-attributed NCR (Failure Attributable To = Component Supplier) in 8D structure; D1-D3 by PE, D4-D8 by the vendor.", "DOC:p.89 §6"],
  ["QM-S2", `A vendor with ${THRESHOLDS.scarOverdueRestrictsVendor} or more open overdue SCARs becomes Restricted on the AVL; resolution restores the vendor.`, "DOC:p.89 §6"],
  ["QM-S3", "D4-D8 must be complete before closing; cost recovery is recorded as a vendor credit note.", "DOC:p.89 §6"],
]

const capaNext: Partial<Record<QtCapa["status"], string>> = { Open: "Start analysis", Analysis: "Start actions", "Actions In Progress": "Mark Implemented", Implemented: "Start effectiveness check", Reopened: "Resume actions" }

// ============================================================================ CAPA + NCR register
export function CapaList() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-CAPA")
  const [params, setParams] = useSearchParams()
  const ncrId = params.get("ncr")
  const tab = ncrId || params.get("tab") === "ncr" ? "ncr" : "capa"
  const setTab = (t: string) => {
    params.delete("ncr")
    params.set("tab", t)
    setParams(params, { replace: true })
  }
  const nav = useNavigate()
  const capaCols: Column<QtCapa>[] = [
    { id: "id", header: "CAPA", value: (c) => c.id, mono: true, sortable: true, className: "w-32" },
    { id: "title", header: "Title", value: (c) => c.title },
    { id: "status", header: "Status", value: (c) => c.status, filterable: true, sortable: true, cell: (c) => <StatusBadge kind="capa" status={c.status} size="sm" /> },
    { id: "src", header: "Sources", value: (c) => c.sources.map((x) => x.id).join(", "), cell: (c) => <span className="flex flex-wrap gap-1">{c.sources.map((x) => <DocLinkText key={x.id} r={x} />)}</span> },
    { id: "method", header: "Method", value: (c) => c.method ?? "", filterable: true },
    { id: "actions", header: "Actions done", value: (c) => c.actions.filter((a) => a.done).length, cell: (c) => `${c.actions.filter((a) => a.done).length} / ${c.actions.length}`, align: "right", mono: true },
    { id: "owner", header: "Owner", value: (c) => userName(c.ownerId) },
    { id: "opened", header: "Opened", value: (c) => c.openedOn, sortable: true, mono: true },
  ]
  const ncrCols: Column<QtNcr>[] = [
    { id: "id", header: "NCR", value: (n) => n.id, mono: true, sortable: true, cell: (n) => <button className="text-link underline-offset-4 hover:underline" onClick={() => (params.set("ncr", n.id), setParams(params, { replace: true }))}>{n.id}</button> },
    { id: "title", header: "Title", value: (n) => n.title },
    { id: "sev", header: "Severity", value: (n) => n.severity, filterable: true },
    { id: "stage", header: "Stage", value: (n) => n.stage, filterable: true },
    { id: "src", header: "Source", value: (n) => n.source.id, cell: (n) => <DocLinkText r={n.source} /> },
    { id: "attr", header: "Attributable to", value: (n) => n.attributableTo, filterable: true },
    { id: "vendor", header: "Vendor", value: (n) => vendorName(n.vendorId) },
    { id: "esc", header: "Escalated to", value: (n) => [n.capaId, n.scarId].filter(Boolean).join(", "), cell: (n) => <span className="flex gap-2">{n.capaId && <DocLinkText r={{ type: "capa", id: n.capaId }} />}{n.scarId && <DocLinkText r={{ type: "scar", id: n.scarId }} />}</span> },
    { id: "opened", header: "Opened", value: (n) => n.openedOn, sortable: true, mono: true },
  ]
  const ncr = s.ncrs.find((n) => n.id === ncrId)
  const header = {
    title: "CAPA and SCAR",
    screenId: "QM-CAPA/SCAR",
    description: "Corrective and preventive actions from NCRs, RMA failure analysis and audits. Supplier corrective actions (SCAR) are on their own register.",
    actions: (
      <Button variant="outline" asChild>
        <Link to="/quality/scar">SCAR register</Link>
      </Button>
    ),
  }
  const tabs = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUS.capa.statuses.map((st) => (
          <span key={st} className="inline-flex items-center gap-1 text-sm">
            <StatusBadge kind="capa" status={st} size="sm" />
            <span className="tabular text-muted-foreground">{s.capas.filter((c) => c.status === st).length}</span>
          </span>
        ))}
      </div>
      <div role="tablist" aria-label="Register" className="flex gap-1 border-b">
        {[["capa", `CAPA ${s.capas.length}`], ["ncr", `NCR links ${s.ncrs.length}`]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-8 border-b-2 px-3 text-sm", tab === id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <>
      {tab === "capa" ? (
        <ListPage
          header={header}
          above={tabs}
          table={{
            rows: ds.empty ? [] : s.capas, columns: capaCols, rowId: (c) => c.id, rowHref: (c) => `/quality/capa/${c.id}`,
            searchText: (c) => `${c.id} ${c.title} ${c.sources.map((x) => x.id).join(" ")}`, loading: ds.loading, error: ds.error, onRetry: ds.retry,
            empty: { title: "No CAPAs", body: "Open a CAPA from an NCR on the NCR links tab." },
          }}
          below={<RulesPanel rules={CAPA_RULES} />}
        />
      ) : (
        <ListPage
          header={header}
          above={
            <>
              {tabs}
              <p className="text-sm text-muted-foreground">
                NCR records are owned by INV 15.4; these are the link records that start escalations. <Reading id="QT-R02" />
              </p>
            </>
          }
          table={{
            rows: ds.empty ? [] : s.ncrs, columns: ncrCols, rowId: (n) => n.id, activeId: ncrId ?? undefined,
            searchText: (n) => `${n.id} ${n.title} ${n.source.id} ${vendorName(n.vendorId)}`, loading: ds.loading, error: ds.error, onRetry: ds.retry,
            empty: { title: "No NCRs", body: "NCRs are created from failed inspections, final tests and returns." },
          }}
        />
      )}
      <Sheet open={!!ncr} onOpenChange={(o) => !o && (params.delete("ncr"), setParams(params, { replace: true }))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {ncr && (
            <>
              <SheetHeader>
                <SheetTitle>{ncr.id}</SheetTitle>
                <SheetDescription>{ncr.title}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <dl className="grid grid-cols-2 gap-4">
                  <KV k="Severity">{ncr.severity}</KV>
                  <KV k="Stage"><NoList text={ncr.stage} /></KV>
                  <KV k="Source"><DocLinkText r={ncr.source} /></KV>
                  <KV k="Opened">{ncr.openedOn}</KV>
                  <KV k="Item">{ncr.itemId ? `${ncr.itemId} · ${materialText(ncr.itemId)}` : "None"}</KV>
                  <KV k="Batch / serial">{ncr.batchId ?? ncr.serial ?? "None"}</KV>
                  <KV k="Attributable to">{ncr.attributableTo}</KV>
                  <KV k="Vendor">{vendorName(ncr.vendorId) || "None"}</KV>
                </dl>
                <p className="text-sm">{ncr.description}</p>
                <div className="flex flex-wrap gap-2">
                  {ncr.capaId ? (
                    <Button variant="outline" asChild><Link to={`/quality/capa/${ncr.capaId}`}>Open {ncr.capaId}</Link></Button>
                  ) : (
                    <Button onClick={() => report(act.open(ncr.id), (id) => (nav(`/quality/capa/${id}`), `${id} opened`))}>Open CAPA</Button>
                  )}
                  {ncr.scarId ? (
                    <Button variant="outline" asChild><Link to={`/quality/scar/${ncr.scarId}`}>Open {ncr.scarId}</Link></Button>
                  ) : (
                    <Button variant="outline" disabled={ncr.attributableTo !== "Component Supplier"} title={ncr.attributableTo !== "Component Supplier" ? "SCAR needs a Component Supplier attribution" : undefined} onClick={() => report(sact.raise(ncr.id), (id) => (nav(`/quality/scar/${id}`), `${id} issued`))}>
                      Raise SCAR
                    </Button>
                  )}
                  {ncr.stage === "Open" && <Button variant="outline" onClick={() => report(ncrStage(ncr.id, "Dispositioned"), "Dispositioned")}>Mark dispositioned</Button>}
                  {ncr.stage === "Dispositioned" && <Button variant="outline" onClick={() => report(ncrStage(ncr.id, "Closed"), "NCR closed")}>Close NCR</Button>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

// ============================================================================ CAPA detail
export function CapaDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-CAPA-D")
  const c = s.capas.find((x) => x.id === id)
  const [dlg, setDlg] = useState<null | "advance" | "eff">(null)
  if (ds.error) return <ErrorAlert title="Could not load the CAPA" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!c) return <NotFound what="CAPA" id={id} back={{ to: "/quality/capa", label: "Back to CAPA and SCAR" }} />
  const earliest = c.implementedOn ? addDays(c.implementedOn, THRESHOLDS.capaEffectivenessMinDays) : undefined
  const recalls = s.recalls.filter((r) => r.capaId === c.id)
  return (
    <>
      <DetailPage
        header={{
          title: `${c.id} · ${c.title}`,
          screenId: "QM-CAPA/SCAR",
          crumbs: [{ label: "CAPA", to: "/quality/capa" }, { label: c.id }],
          description: c.problem,
          primary:
            c.status === "Effectiveness Check" ? (
              <Button onClick={() => setDlg("eff")}>Record effectiveness</Button>
            ) : capaNext[c.status] ? (
              <Button onClick={() => setDlg("advance")}>{capaNext[c.status]}</Button>
            ) : undefined,
          chips: c.status === "Reopened" ? <Reading id="QT-R16" /> : undefined,
        }}
        status={{ kind: "capa", value: c.status }}
        doc={{ type: "capa", id: c.id }}
        summary={
          <>
            <KV k="Owner">{userName(c.ownerId)}</KV>
            <KV k="Opened">{c.openedOn}</KV>
            <KV k="Method">{c.method ?? "Not chosen"}</KV>
            <KV k="Implemented">{c.implementedOn ?? "Not yet"}</KV>
            <KV k="Effectiveness check from">{earliest ?? "After implementation"}</KV>
            <KV k="Effectiveness">{c.effectiveness?.result ?? "Not checked"}</KV>
            <KV k="Sources">{c.sources.map((x) => x.id).join(", ")}</KV>
            <KV k="Recall">{recalls.map((r) => r.id).join(", ") || "None"}</KV>
          </>
        }
        tabs={[
          { id: "analysis", label: "Root cause", content: <Analysis c={c} /> },
          { id: "actions", label: "Actions", count: c.actions.length, content: <Actions c={c} /> },
          {
            id: "sources", label: "Sources", count: c.sources.length,
            content: (
              <ul className="flex flex-col gap-2 text-sm">
                {c.sources.map((x) => {
                  const n = s.ncrs.find((y) => y.id === x.id)
                  return (
                    <li key={x.id}>
                      <DocLinkText r={x} /> {n ? `· ${n.title} · ${n.severity} · from ${n.source.id}` : ""}
                    </li>
                  )
                })}
              </ul>
            ),
          },
          {
            id: "eff", label: "Effectiveness",
            content: (
              <div className="flex flex-col gap-2 text-sm">
                <p>Earliest check: {earliest ?? "set when implemented"} ({THRESHOLDS.capaEffectivenessMinDays} days after implementation).</p>
                {c.effectiveness && <p>Method: {c.effectiveness.method} · check on {c.effectiveness.checkOn} · result {c.effectiveness.result ?? "pending"}</p>}
              </div>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={c.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={CAPA_RULES} /> },
        ]}
      />
      <DialogShell
        open={dlg === "advance"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`${capaNext[c.status]}: ${c.id}`}
        consequence={`${c.id} moves from ${c.status} to ${c.status === "Implemented" ? "Effectiveness Check" : c.status === "Open" ? "Analysis" : c.status === "Analysis" || c.status === "Reopened" ? "Actions In Progress" : "Implemented"}.`}
        confirmLabel="Confirm"
        onConfirm={() => {
          const r = act.advance(c.id)
          return report(r, "CAPA progressed") ? null : (r as { error: string }).error
        }}
      />
      <EffDialog c={c} open={dlg === "eff"} onClose={() => setDlg(null)} />
    </>
  )
}

function Analysis({ c }: { c: QtCapa }) {
  const [method, setMethod] = useState<QtCapa["method"] | "">(c.method ?? "")
  const [rc, setRc] = useState(c.rootCause ?? "")
  const editable = ["Open", "Analysis", "Reopened"].includes(c.status)
  return (
    <div className="flex max-w-[960px] flex-col gap-4">
      <Pick id="rc-method" label="Root cause method" value={method} onChange={setMethod} options={["5-Why", "Fishbone", "8D", "FMEA"] as NonNullable<QtCapa["method"]>[]} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="rc-text">Root cause</Label>
        <Textarea id="rc-text" value={rc} onChange={(e) => setRc(e.target.value)} disabled={!editable} rows={5} />
      </div>
      {editable && (
        <div>
          <Button variant="outline" onClick={() => report(act.setAnalysis(c.id, method || undefined, rc), "Root cause saved")}>
            Save analysis
          </Button>
        </div>
      )}
    </div>
  )
}

function Actions({ c }: { c: QtCapa }) {
  const [a, setA] = useState<Omit<CapaAction, "id" | "done">>({ type: "Corrective", description: "", ownerId: c.ownerId, dueOn: addDays(TODAY, 30) })
  const [ev, setEv] = useState<Record<string, string>>({})
  const quality = USERS.filter((u) => u.roles.some((r) => ["Quality engineer", "Quality Manager", "Inspector", "Buyer", "Engineer", "Production supervisor"].includes(r)))
  const open = !["Closed", "Effectiveness Check"].includes(c.status)
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Done</TableHead>
            <TableHead>Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.actions.map((x) => (
            <TableRow key={x.id}>
              <TableCell className="tabular">{x.id}</TableCell>
              <TableCell>{x.type}</TableCell>
              <TableCell>{x.description}</TableCell>
              <TableCell>{userName(x.ownerId)}</TableCell>
              <TableCell className={cn("tabular", !x.done && x.dueOn < TODAY && "font-semibold text-destructive")}>{x.dueOn}</TableCell>
              <TableCell>
                <Checkbox checked={x.done} disabled aria-label={`${x.id} done`} />
              </TableCell>
              <TableCell>
                {x.done ? (
                  x.evidence
                ) : open ? (
                  <span className="flex items-center gap-2">
                    <Input aria-label={`Evidence for ${x.id}`} className="h-8 w-48" value={ev[x.id] ?? ""} onChange={(e) => setEv({ ...ev, [x.id]: e.target.value })} placeholder="Evidence file or reference" />
                    <Button size="sm" variant="outline" onClick={() => report(act.completeAction(c.id, x.id, ev[x.id] ?? ""), `${x.id} done`)}>
                      Done
                    </Button>
                  </span>
                ) : (
                  ""
                )}
              </TableCell>
            </TableRow>
          ))}
          {!c.actions.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">No actions yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {open && (
        <Section title="Add action">
          <div className="grid gap-4 sm:grid-cols-4">
            <Pick id="ca-type" label="Type" value={a.type} onChange={(v) => setA({ ...a, type: v })} options={["Containment", "Corrective", "Preventive"] as CapaAction["type"][]} />
            <TextField id="ca-desc" label="Action" value={a.description} onChange={(v) => setA({ ...a, description: v })} />
            <Pick id="ca-owner" label="Owner" value={a.ownerId} onChange={(v) => setA({ ...a, ownerId: v })} options={quality.map((u) => ({ value: u.id, label: u.name }))} />
            <TextField id="ca-due" label="Due" type="date" value={a.dueOn} onChange={(v) => setA({ ...a, dueOn: v })} />
          </div>
          <div>
            <Button variant="outline" onClick={() => report(act.addAction(c.id, a), "Action added") && setA({ ...a, description: "" })}>
              Add action
            </Button>
          </div>
        </Section>
      )}
    </div>
  )
}

function EffDialog({ c, open, onClose }: { c: QtCapa; open: boolean; onClose: () => void }) {
  const [res, setRes] = useState<"Pass" | "Fail">("Pass")
  const [method, setMethod] = useState(c.effectiveness?.method ?? "Recurrence review over 90 days")
  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Effectiveness check: ${c.id}`}
      consequence={res === "Pass" ? `${c.id} closes. Only the Quality Manager may close a CAPA.` : `${c.id} goes to Reopened; corrective and preventive actions reopen, containment stays done.`}
      confirmLabel={res === "Pass" ? "Close CAPA" : "Reopen CAPA"}
      destructive={res === "Fail"}
      onConfirm={() => {
        const r = act.effectiveness(c.id, res, method)
        return report(r, res === "Pass" ? "CAPA Closed" : "CAPA Reopened") ? null : (r as { error: string }).error
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Pick id="eff-res" label="Result" value={res} onChange={setRes} options={["Pass", "Fail"] as ("Pass" | "Fail")[]} />
        <TextField id="eff-method" label="Method" value={method} onChange={setMethod} />
      </div>
    </DialogShell>
  )
}

// ============================================================================ SCAR register
const scarState = (x: QtScar) => (!x.open ? "Closed" : x.respondedOn ? "Response received" : isOverdue(x, TODAY) ? "Overdue" : "Awaiting vendor")

export function ScarList() {
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-SCAR")
  const [last, setLast] = useState<{ vendorId: string; overdue: number; restricted: boolean }[] | null>(null)
  const vendors = [...new Set(s.scars.map((x) => x.vendorId))].map((v) => ({ v, overdue: s.scars.filter((x) => x.vendorId === v && isOverdue(x, TODAY)).length, open: s.scars.filter((x) => x.vendorId === v && x.open).length }))
  const cols: Column<QtScar>[] = [
    { id: "id", header: "SCAR", value: (x) => x.id, mono: true, sortable: true, className: "w-32" },
    { id: "title", header: "Title", value: (x) => x.title },
    { id: "vendor", header: "Vendor", value: (x) => vendorName(x.vendorId), filterable: true },
    { id: "ncr", header: "NCRs", value: (x) => x.ncrIds.join(", "), cell: (x) => <span className="flex gap-1">{x.ncrIds.map((n) => <DocLinkText key={n} r={{ type: "ncr", id: n }} />)}</span> },
    { id: "issued", header: "Issued", value: (x) => x.issuedOn, sortable: true, mono: true },
    { id: "due", header: "Response due", value: (x) => x.dueOn, sortable: true, mono: true, cell: (x) => <span className={cn(isOverdue(x, TODAY) && "font-semibold text-destructive")}>{x.dueOn}</span> },
    { id: "state", header: "State", value: scarState, filterable: true },
    { id: "rec", header: "Recovery", value: (x) => x.recovery?.amount ?? 0, align: "right", mono: true, cell: (x) => (x.recovery ? `$${x.recovery.amount.toLocaleString("en-US")}` : "") },
  ]
  return (
    <ListPage
      header={{
        title: "SCAR register",
        screenId: "QM-CAPA/SCAR",
        crumbs: [{ label: "SCAR" }],
        description: "Supplier corrective action requests in 8D structure. Vendors answer D4-D8 (portal in Phase 3; today by email, recorded here).",
        chips: <><NoList text="SCAR state" /><Reading id="QT-R15" /><Reading id="QT-R20" /></>,
        primary: <Button onClick={() => { const r = sact.enforce(); if (report(r, "AVL enforcement run")) setLast(r.ok ? r.value : null) }}>Run AVL enforcement</Button>,
        actions: <Button variant="outline" asChild><Link to="/quality/capa">CAPA register</Link></Button>,
      }}
      above={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <Stat key={v.v} label={vendorName(v.v)} value={`${v.overdue} overdue / ${v.open} open`} tone={v.overdue >= THRESHOLDS.scarOverdueRestrictsVendor ? "attention" : undefined} />
            ))}
          </div>
          {last && (
            <p role="status" className="text-sm">
              Enforcement result: {last.filter((x) => x.restricted).map((x) => `${vendorName(x.vendorId)} Restricted (${x.overdue} overdue)`).join("; ") || "no vendor restricted"}. Sent to purchasing for the AVL.
            </p>
          )}
        </div>
      }
      table={{
        rows: ds.empty ? [] : s.scars, columns: cols, rowId: (x) => x.id, rowHref: (x) => `/quality/scar/${x.id}`,
        searchText: (x) => `${x.id} ${x.title} ${vendorName(x.vendorId)} ${x.ncrIds.join(" ")}`, loading: ds.loading, error: ds.error, onRetry: ds.retry,
        empty: { title: "No SCARs", body: "Raise a SCAR from a vendor-attributed NCR." },
      }}
      below={<RulesPanel rules={SCAR_RULES} />}
    />
  )
}

export function ScarDetail() {
  const { id } = useParams()
  const s = useSlice("qualityTrace")
  const ds = useDataState("QM-SCAR-D")
  const x = s.scars.find((y) => y.id === id)
  const [draft, setDraft] = useState<Partial<Record<EightD, string>>>({})
  const [dlg, setDlg] = useState<null | "close" | "esc">(null)
  const [amount, setAmount] = useState("")
  const [cn2, setCn2] = useState("")
  if (ds.error) return <ErrorAlert title="Could not load the SCAR" action={<Button variant="outline" size="sm" onClick={ds.retry}>Retry</Button>}>{ds.error}</ErrorAlert>
  if (!x) return <NotFound what="SCAR" id={id} back={{ to: "/quality/scar", label: "Back to SCAR register" }} />
  return (
    <>
      <DetailPage
        header={{
          title: `${x.id} · ${x.title}`,
          screenId: "QM-CAPA/SCAR",
          crumbs: [{ label: "SCAR", to: "/quality/scar" }, { label: x.id }],
          description: `${vendorName(x.vendorId)} · issued ${x.issuedOn} · response due ${x.dueOn}`,
          chips: (
            <>
              <NoList text={scarState(x)} />
              {isOverdue(x, TODAY) && <Chip kind="flag">Overdue</Chip>}
            </>
          ),
          primary: x.open ? <Button onClick={() => setDlg("close")}>Close SCAR</Button> : undefined,
          actions: x.open ? (
            <>
              <Button variant="outline" onClick={() => report(sact.respond(x.id, draft), "Vendor response recorded") && setDraft({})}>
                Record vendor response
              </Button>
              <Button variant="outline" onClick={() => setDlg("esc")}>Escalate</Button>
            </>
          ) : undefined,
        }}
        doc={{ type: "scar", id: x.id }}
        summary={
          <>
            <KV k="Vendor">{vendorName(x.vendorId)}</KV>
            <KV k="NCRs">{x.ncrIds.join(", ")}</KV>
            <KV k="Responded">{x.respondedOn ?? "No response"}</KV>
            <KV k="Closed">{x.closedOn ?? "Open"}</KV>
          </>
        }
        tabs={[
          {
            id: "8d", label: "8D",
            content: (
              <div className="flex max-w-[960px] flex-col gap-4">
                {EIGHT_D.map((d) => {
                  const vendorPart = d.by === "Vendor"
                  const editable = x.open && vendorPart
                  return (
                    <div key={d.d} className="flex flex-col gap-1">
                      <Label htmlFor={`8d-${d.d}`}>
                        {d.d} {d.title} <span className="text-xs font-normal text-muted-foreground">by {d.by === "PE" ? "PE" : "vendor"}</span>
                      </Label>
                      {editable && !x.sections[d.d] ? (
                        <Textarea id={`8d-${d.d}`} rows={2} value={draft[d.d] ?? ""} onChange={(e) => setDraft({ ...draft, [d.d]: e.target.value })} placeholder="Vendor's answer" />
                      ) : (
                        <p id={`8d-${d.d}`} className={cn("rounded-md border px-3 py-2 text-sm", !x.sections[d.d] && "text-muted-foreground")}>{x.sections[d.d] ?? "Not answered"}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ),
          },
          {
            id: "esc", label: "Escalations", count: x.escalations.length,
            content: x.escalations.length ? (
              <ul className="flex flex-col gap-2 text-sm">{x.escalations.map((e, i) => <li key={i}><span className="tabular text-muted-foreground">{e.on}</span> {e.text}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">No escalations.</p>
            ),
          },
          { id: "activity", label: "Activity", content: <ActivityList items={x.activity} /> },
          { id: "rules", label: "Rules", content: <RulesPanel rules={SCAR_RULES} /> },
        ]}
      />
      <DialogShell
        open={dlg === "close"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Close ${x.id}`}
        consequence={`Closes the SCAR. D4-D8 must be answered. ${amount ? `A cost recovery of $${Number(amount).toLocaleString("en-US")} is recorded against ${vendorName(x.vendorId)}.` : "No cost recovery recorded."} The vendor's overdue count drops on the next AVL enforcement.`}
        confirmLabel="Close SCAR"
        onConfirm={() => {
          const r = sact.close(x.id, amount ? { amount: Number(amount), creditNote: cn2 || undefined } : undefined)
          return report(r, `${x.id} closed`) ? null : (r as { error: string }).error
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="rec-amt" label="Cost recovery (USD)" type="number" value={amount} onChange={setAmount} />
          <TextField id="rec-cn" label="Vendor credit note" value={cn2} onChange={setCn2} />
        </div>
      </DialogShell>
      <DialogShell
        open={dlg === "esc"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Escalate ${x.id}`}
        consequence="Logs the escalation on the SCAR; it shows on the vendor's quality record."
        confirmLabel="Escalate"
        requireReason
        reasonLabel="Escalation note (required)"
        onConfirm={(t) => {
          const r = sact.escalate(x.id, t)
          return report(r, "Escalation logged") ? null : (r as { error: string }).error
        }}
      />
    </>
  )
}
