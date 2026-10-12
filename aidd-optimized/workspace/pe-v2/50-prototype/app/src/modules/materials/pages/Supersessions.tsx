// MM-SUP-001 Supersessions [DOC:p.246] (asserted); rules Book II §4.6, Book IV §7.1.
// Predecessor and successor cards, run-out policy selector, affected-document worklist, progress bar
// on remaining stock. Actions: Approve (through WF-INBOX), watch run-out, Close.
// Predecessor moves to Restricted on approval, then Obsolete on close (V-MM-20).
// Supersession has no status list in the PRD (OQ-21): the stage is text.
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailPage, DialogShell } from "@/components/templates"
import { ApprovalButton, DocumentFlowPanel, EmptyState, KV, RulesPanel, SkeletonRows } from "@/components/patterns"
import { Table, TableBody } from "@/components/ui/table"
import { fmtDate, fmtNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useSlice } from "@/store"
import { allMaterials, getMaterial, onHand } from "../data/state"
import { closeSupersession, createSupersession, executeDisposition, toggleSupTask, updateSupersession } from "../data/actions"
import type { SupersessionRecord } from "../data/types"
import { MatLink, MaterialStatus, NoStatusList, Reading, Section, TypeBadge, useListState } from "../components/common"
import { confirmRun, run } from "../components/run"

const POLICY_TEXT: Record<SupersessionRecord["policy"], string> = {
  "Use-up": "Use-up: consume predecessor stock first, then MRP switches to the successor.",
  Immediate: "Immediate: switch now; remaining predecessor stock routes to rework, scrap or return to vendor.",
  Date: "Date: switch on the effective date regardless of stock.",
}

function MatCard({ id, role }: { id: string; role: string }) {
  const s = useSlice("materials")
  const m = getMaterial(s, id)
  if (!m) return <EmptyState title={`${role} ${id} not found`} />
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{role}</p>
      <p className="flex flex-wrap items-center gap-2">
        <MatLink id={m.id} /> <TypeBadge type={m.type} />
      </p>
      <p className="text-sm">{m.description}</p>
      <MaterialStatus m={m} />
      <p className="tabular text-xs text-muted-foreground">
        On hand {fmtNumber(onHand(s, m.id))} {m.baseUom}
      </p>
    </div>
  )
}

export function Supersessions() {
  const s = useSlice("materials")
  const [sp, setSp] = useSearchParams()
  const st = useListState("MM-SUP-001")
  const list = st.empty ? [] : s.supersessions
  const id = sp.get("id") ?? list[0]?.id
  const x = list.find((r) => r.id === id)
  const newFor = sp.get("new")
  const [dlg, setDlg] = useState<null | "close" | "dispose">(null)

  const register = (
    <nav aria-label="Supersessions" className="flex flex-col gap-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">Records ({list.length})</span>
        {st.toolbar}
      </div>
      {st.loading ? (
        <Table>
          <TableBody>
            <SkeletonRows cols={1} rows={3} />
          </TableBody>
        </Table>
      ) : (
        list.map((r) => (
          <button key={r.id} onClick={() => setSp({ id: r.id })} aria-current={r.id === id ? "page" : undefined} className={cn("rounded-md border p-2 text-left text-sm", r.id === id ? "border-primary" : "hover:bg-accent")}>
            <span className="font-mono">{r.id}</span> · {r.stage}
            <span className="block text-xs text-muted-foreground">
              {r.predecessorId} to {r.successorId}
            </span>
          </button>
        ))
      )}
    </nav>
  )

  const header = {
    screenId: "MM-SUP-001",
    title: x ? `${x.id} ${x.predecessorId} to ${x.successorId}` : "Supersessions",
    chips: (
      <>
        {x && <span className="rounded-md border px-2 py-0.5 text-sm">Stage: {x.stage}</span>}
        <NoStatusList />
      </>
    ),
    actions: (
      <Button variant="outline" onClick={() => setSp({ new: "" })}>
        <Plus aria-hidden="true" /> New supersession
      </Button>
    ),
  }

  if (st.error)
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title="Supersessions could not be loaded">
          {st.error}{" "}
          <Button variant="link" onClick={st.onRetry}>
            Retry
          </Button>
        </EmptyState>
      </div>
    )

  if (!x)
    return (
      <>
        <DetailPage header={header} tabs={[{ id: "list", label: "Records", content: list.length ? register : <EmptyState title="No supersessions yet">Start one from a material's Supersede button.</EmptyState> }]} />
        <NewSupDialog pred={newFor} onClose={() => setSp({})} onCreated={(nid) => setSp({ id: nid })} />
      </>
    )

  const succ = getMaterial(s, x.successorId)
  const left = onHand(s, x.predecessorId)
  const pct = x.startQty ? Math.round(((x.startQty - left) / x.startQty) * 100) : 100
  const draft = x.stage === "Draft"
  const runout = x.stage === "Approved, run-out"
  const canClose = runout && left === 0 && x.tasks.every((t) => t.done)

  const overview = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <MatCard id={x.predecessorId} role="Predecessor" />
        <MatCard id={x.successorId} role="Successor" />
      </div>
      <Section title="Run-out policy">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sup-policy">Policy</Label>
            <Select value={x.policy} disabled={!draft} onValueChange={(v) => run(updateSupersession(x.id, { policy: v as SupersessionRecord["policy"] }), "Policy updated")}>
              <SelectTrigger id="sup-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Use-up", "Immediate", "Date"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sup-eff">Effective</Label>
            <Input id="sup-eff" type="date" value={x.effective} disabled={!draft} onChange={(e) => e.target.value && run(updateSupersession(x.id, { effective: e.target.value }), "Effective date updated")} />
          </div>
          {x.policy === "Immediate" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="sup-disp">Disposition of remaining stock</Label>
              <Select value={x.disposition} disabled={!draft} onValueChange={(v) => run(updateSupersession(x.id, { disposition: v as SupersessionRecord["disposition"] }), "Disposition updated")}>
                <SelectTrigger id="sup-disp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Rework", "Scrap", "Return to vendor"] as const).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{POLICY_TEXT[x.policy]}</p>
      </Section>
      <Section title="Remaining predecessor stock">
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-3 max-w-md" aria-label={`Run-out ${pct}%`} />
          <span className="tabular text-sm">
            {fmtNumber(left)} of {fmtNumber(x.startQty)} left ({pct}% run out)
          </span>
          <Reading id="RD-MM-18" />
        </div>
        {runout && x.policy === "Immediate" && left > 0 && (
          <Button variant="outline" className="self-start" onClick={() => setDlg("dispose")}>
            Route remaining stock to {x.disposition}
          </Button>
        )}
      </Section>
    </div>
  )
  const worklist = (
    <ul className="flex flex-col gap-2">
      {x.tasks.length === 0 && (
        <li className="text-sm text-muted-foreground">
          The worklist is generated on approval: MRP flip, buyer tasks for open POs, BOM lines per ECO effectivity, customer part cross-references and predecessor stock. <Reading id="RD-MM-30" />
        </li>
      )}
      {x.tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 rounded-md border p-2 text-sm">
          <Checkbox id={`t-${t.id}`} checked={t.done} disabled={!runout} onCheckedChange={() => run(toggleSupTask(x.id, t.id), `${t.doc} updated`)} aria-label={`${t.doc} done`} />
          <label htmlFor={`t-${t.id}`} className="flex-1">
            <span className="font-mono">{t.doc}</span> · {t.kind}
            <span className="block text-muted-foreground">{t.action}</span>
          </label>
        </li>
      ))}
    </ul>
  )
  const activity = (
    <ul className="text-sm">
      {x.activity.map((a, i) => (
        <li key={i}>
          {fmtDate(a.at)} · {a.by} · {a.text}
        </li>
      ))}
    </ul>
  )
  return (
    <>
      <DetailPage
        key={x.id}
        header={{
          ...header,
          crumbs: [{ label: "Supersessions", to: "/materials/supersessions" }, { label: x.id }],
          primary: draft ? (
            <ApprovalButton
              kind="Material change"
              subject={{ type: "material", id: x.id }}
              title={`${x.id}: supersede ${x.predecessorId} by ${x.successorId} (${x.policy})`}
              label="Send for approval"
              variant="default"
              disabled={succ?.status !== "Active"}
              disabledReason={`Successor ${x.successorId} is ${succ?.status}; it must be Active first (RD-MM-07)`}
              stay
            />
          ) : runout ? (
            <Button disabled={!canClose} title={canClose ? undefined : "V-MM-20: zero predecessor stock and every worklist item done"} onClick={() => setDlg("close")}>
              Close supersession
            </Button>
          ) : x.stage === "In approval" ? (
            <ApprovalButton kind="Material change" subject={{ type: "material", id: x.id }} title={x.id} stay />
          ) : undefined,
        }}
        summary={
          <>
            <KV k="Relationship">{x.relationship}</KV>
            <KV k="Origin">{x.originRef ?? "Material detail"}</KV>
            <KV k="Created">{fmtDate(x.createdOn)}</KV>
            <KV k={x.closedOn ? "Closed" : "Approved"}>{fmtDate(x.closedOn ?? x.approvedOn) || "Not yet"}</KV>
          </>
        }
        tabs={[
          { id: "overview", label: "Run-out", content: overview },
          { id: "worklist", label: "Affected documents", count: x.tasks.length, content: worklist },
          { id: "activity", label: "Activity", content: activity },
          { id: "records", label: "All records", count: list.length, content: register },
        ]}
        aside={
          <>
            {register}
            <p className="text-xs">Reason: {x.reason}</p>
            {draft && succ?.status !== "Active" && (
              <p className="text-xs">
                Successor is {succ?.status}; its creation request must finish first. <Reading id="RD-MM-07" />
              </p>
            )}
            <DocumentFlowPanel doc={{ type: "material", id: x.successorId }} />
          </>
        }
      />
      <RulesPanel
        rules={[
          ["§4.6", "Policies Use-up, Immediate, Date. Approval moves the predecessor Active to Restricted; MRP flips new proposals to the successor.", "[Book II §4.6]"],
          ["§4.6", "Immediate: remaining predecessor stock routes to rework, scrap or return to vendor.", "[Book II §4.6]"],
          ["V-MM-20", "Close only with zero predecessor stock and every affected document closed; the predecessor becomes Obsolete.", "[Book II §4.6]"],
          ["RD-MM-07", "Sending for approval needs an Active successor (reading).", "README Readings"],
        ]}
      />
      <DialogShell
        open={dlg === "close"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Close ${x.id}`}
        consequence={`${x.predecessorId} becomes Obsolete (terminal, read-only); ${x.successorId} carries all demand.`}
        confirmLabel="Close and make predecessor Obsolete"
        destructive
        onConfirm={() => confirmRun(closeSupersession(x.id), `${x.id} closed; ${x.predecessorId} Obsolete`)}
      />
      <DialogShell
        open={dlg === "dispose"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Disposition of ${left} ${x.predecessorId}`}
        consequence={`All remaining PE-owned ${x.predecessorId} stock routes to ${x.disposition}; the stock worklist item closes.`}
        confirmLabel={`Route to ${x.disposition}`}
        onConfirm={() => confirmRun(executeDisposition(x.id), `Routed to ${x.disposition}`)}
      />
      <NewSupDialog pred={newFor} onClose={() => setSp({ id: x.id })} onCreated={(nid) => setSp({ id: nid })} />
    </>
  )
}

function NewSupDialog({ pred, onClose, onCreated }: { pred: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const s = useSlice("materials")
  const mats = allMaterials(s)
  const [p, setP] = useState(pred ?? "")
  const [succ, setSucc] = useState("")
  const [policy, setPolicy] = useState<SupersessionRecord["policy"]>("Use-up")
  const [eff, setEff] = useState("")
  const [rel, setRel] = useState<SupersessionRecord["relationship"]>("One-for-One")
  const pm = getMaterial(s, p || pred || "")
  return (
    <DialogShell
      open={pred !== null}
      onOpenChange={(o) => !o && onClose()}
      title="New supersession"
      description="Started by the Materials Manager from a material's Supersede button, an ECO task or a duplicate merge."
      consequence="Creates the supersession in Draft; nothing changes on either material until it is approved in WF-INBOX."
      requireReason
      confirmLabel="Create supersession"
      onConfirm={(reason) =>
        confirmRun(createSupersession({ predecessorId: p || pred || "", successorId: succ, policy, effective: eff || "2026-11-01", relationship: rel, reason }), (id) => {
          setTimeout(() => onCreated(id), 0)
          return `${id} created in Draft`
        })
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ns-pred">Predecessor</Label>
          <Select value={p || pred || ""} onValueChange={setP}>
            <SelectTrigger id="ns-pred">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {mats
                .filter((m) => ["Active", "Restricted", "Blocked"].includes(m.status))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id} {m.description}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ns-succ">Successor</Label>
          <Select value={succ} onValueChange={setSucc}>
            <SelectTrigger id="ns-succ">
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {mats
                .filter((m) => m.id !== (p || pred) && m.status !== "Obsolete" && (!pm || m.type === pm.type))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id} {m.description} ({m.status})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ns-policy">Run-out policy</Label>
          <Select value={policy} onValueChange={(v) => setPolicy(v as SupersessionRecord["policy"])}>
            <SelectTrigger id="ns-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["Use-up", "Immediate", "Date"] as const).map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ns-rel">Relationship</Label>
          <Select value={rel} onValueChange={(v) => setRel(v as SupersessionRecord["relationship"])}>
            <SelectTrigger id="ns-rel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="One-for-One">One-for-One</SelectItem>
              <SelectItem value="One-for-Many">One-for-Many</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ns-eff">Effective</Label>
          <Input id="ns-eff" type="date" value={eff} onChange={(e) => setEff(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{POLICY_TEXT[policy]}</p>
      {pred && (
        <p className="text-xs">
          From <Link className="text-link underline" to={`/inventory/items/${pred}`}>{pred}</Link>
        </p>
      )}
    </DialogShell>
  )
}
