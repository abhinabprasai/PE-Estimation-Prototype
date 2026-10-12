// TR-001 Transmittals (Wizard + register) [DOC:p.65 §5.2; p.258] (asserted). Document picker
// restricted to released revisions, recipient and purpose fields, response capture with the three
// customer outcomes. Recording Approved or Approved as Noted is the customer approval evidence that
// drives the Design Approval milestone on the ETO order.

import { useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Chip, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { DetailPage, DialogShell, ListPage, WizardPage } from "@/components/templates"
import { CUSTOMERS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { DetailState, NoPostings, RefLink, StageText, StatePreview, useActDialog, useScreenState } from "../components"
import { releasedRev, userName } from "../data/logic"
import * as act from "../data/actions"
import type { TransmittalPurpose, TransmittalRecord, TrResponse } from "../data/types"

const customerName = (id: string) => CUSTOMERS.find((c) => c.id === id)?.name ?? id
const PURPOSES: TransmittalPurpose[] = ["For Approval", "For Construction", "As-Built"]
const RESPONSES: TrResponse[] = ["Approved", "Approved as Noted", "Revise & Resubmit"]
const trState = (t: TransmittalRecord) => (!t.sentOn ? "Not sent" : t.purpose !== "For Approval" ? "Sent (no response expected)" : t.responses.length ? t.responses[t.responses.length - 1].response : "Awaiting response")
const RULES: [string, string, string][] = [
  ["Picker", "Only released revisions can be sent", "DOC:p.258"],
  ["Restricted", "Restricted (export-controlled) documents are visible only to users with the EAR flag; customers hold none, so they are not offered (reading R-DOC-3)", "DOC:p.64 §5.1"],
  ["Purpose", "For Approval, For Construction, As-Built", "DOC:p.65 §5.2"],
  ["Responses", "Approved, Approved as Noted, Revise & Resubmit", "DOC:p.258"],
  ["Milestone", "Approved or Approved as Noted is the customer approval evidence for the Design Approval milestone; Revise & Resubmit returns the request to In Design", "DOC:p.258; p.59 §2"],
  ["Status", "No transmittal status list in the PRD: state is shown as text", "OQ-21"],
]

export function TrList() {
  const s = useSlice("engineering")
  const st = useScreenState("TR-001-list")
  const nav = useNavigate()
  const rows = st.empty ? [] : s.transmittals
  const columns: Column<TransmittalRecord>[] = [
    { id: "id", header: "Transmittal", value: (t) => t.id, sortable: true, mono: true },
    { id: "cust", header: "Customer", value: (t) => customerName(t.customerId), filterable: true },
    { id: "purpose", header: "Purpose", value: (t) => t.purpose, filterable: true },
    { id: "docs", header: "Revisions sent", value: (t) => t.revsSent.length, cell: (t) => t.revsSent.map((r) => `${r.documentId} ${r.rev}`).join(", ") },
    { id: "er", header: "Engineering request", value: (t) => t.engineeringRequestId ?? "", mono: true },
    { id: "sent", header: "Sent", value: (t) => t.sentOn ?? "", cell: (t) => fmtDate(t.sentOn), sortable: true },
    { id: "state", header: "Response", value: (t) => trState(t), filterable: true },
  ]
  return (
    <>
      <ListPage<TransmittalRecord>
        header={{
          title: "Transmittals",
          screenId: "TR-001",
          description: "Packages of released drawings sent to customers, with the response that drives the Design Approval milestone.",
          primary: <Button onClick={() => nav("/engineering/transmittals/new")}>New transmittal</Button>,
          chips: <Chip kind="oq" id="OQ-21" note="No transmittal status list in the PRD; the response is shown as text" />,
        }}
        table={{
          rows, columns, rowId: (t) => t.id, rowHref: (t) => `/engineering/transmittals/${t.id}`, searchText: (t) => `${t.id} ${customerName(t.customerId)} ${t.documentIds.join(" ")}`,
          loading: st.loading, error: st.error, onRetry: st.retry, toolbar: <StatePreview />, initialSort: { id: "sent", dir: "desc" },
          empty: { title: "No transmittals", body: "Send released drawings to a customer from here or from an engineering request." },
        }}
      />
      <RulesPanel rules={RULES} />
    </>
  )
}

export function TrNew() {
  const s = useSlice("engineering")
  const [params] = useSearchParams()
  const nav = useNavigate()
  const runD = useActDialog()
  const er = s.requests.find((r) => r.id === params.get("er"))
  const preDoc = params.get("doc")
  const [customerId, setCustomerId] = useState<string>(er?.customerId ?? "CUS-TBD-0048")
  const [purpose, setPurpose] = useState<TransmittalPurpose>("For Approval")
  const [recipients, setRecipients] = useState(`${customerName(er?.customerId ?? "CUS-TBD-0048")}, project engineering`)
  const [note, setNote] = useState("")
  const [erId, setErId] = useState(er?.id ?? "__none")
  const pickable = s.documents.filter((d) => releasedRev(d) && d.security !== "Restricted")
  const restricted = s.documents.filter((d) => releasedRev(d) && d.security === "Restricted")
  const [docs, setDocs] = useState<string[]>(() => (preDoc ? [preDoc] : er ? pickable.filter((d) => d.engineeringRequestId === er.id && d.security === "Customer-Shareable").map((d) => d.id) : []))
  const chosenEr = s.requests.find((r) => r.id === erId)
  return (
    <WizardPage
      header={{ title: "New transmittal", screenId: "TR-001", crumbs: [{ label: "Transmittals", to: "/engineering/transmittals" }, { label: "New" }], description: "Pick released revisions, name the recipients and the purpose, then send." }}
      onCancel={() => nav("/engineering/transmittals")}
      finishLabel="Send package"
      consequence={`Sends ${docs.length} released revision${docs.length === 1 ? "" : "s"} ${purpose} to ${customerName(customerId)}. The revisions sent are frozen on the transmittal.${purpose === "For Approval" && chosenEr?.customerApprovalRequired && chosenEr.status === "In Design" ? ` ${chosenEr.id} moves to Customer Review.` : ""}`}
      onFinish={() => {
        let id = ""
        const e = runD((d, c) => void (id = act.sendTransmittal(d, c, { erId: chosenEr?.id, customerId: customerId as never, soId: chosenEr?.soId, purpose, recipients: recipients.split(";").map((x) => x.trim()).filter(Boolean), documentIds: docs, note })), "Package sent")
        if (!e) nav(`/engineering/transmittals/${id}`)
        return e
      }}
      steps={[
        {
          id: "docs", title: "Documents (released revisions only)",
          validate: () => (docs.length ? null : "Pick at least one document."),
          content: (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>For engineering request (optional)</Label>
                <Select value={erId} onValueChange={(v) => { setErId(v); const r = s.requests.find((x) => x.id === v); if (r) { setCustomerId(r.customerId); setRecipients(`${customerName(r.customerId)}, project engineering`) } }}>
                  <SelectTrigger aria-label="Engineering request"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">None</SelectItem>{s.requests.filter((r) => r.status !== "Closed").map((r) => <SelectItem key={r.id} value={r.id}>{r.id} · {r.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead className="w-10" /><TableHead>Document</TableHead><TableHead>Title</TableHead><TableHead>Released rev</TableHead><TableHead>Security</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pickable.map((d) => (
                      <TableRow key={d.id} className="h-8 text-[13px]">
                        <TableCell><Checkbox aria-label={`Send ${d.id}`} checked={docs.includes(d.id)} onCheckedChange={(v) => setDocs((p) => (v ? [...p, d.id] : p.filter((x) => x !== d.id)))} /></TableCell>
                        <TableCell className="font-mono">{d.id}</TableCell>
                        <TableCell>{d.title}</TableCell>
                        <TableCell className="font-mono">{releasedRev(d)?.rev}</TableCell>
                        <TableCell>{d.security}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {restricted.length > 0 && <p className="text-xs text-muted-foreground">Not offered: {restricted.length} Restricted (export-controlled) document{restricted.length === 1 ? "" : "s"}. Documents with no released revision are not listed.</p>}
            </div>
          ),
        },
        {
          id: "to", title: "Recipients and purpose",
          validate: () => (recipients.trim() ? null : "Enter a recipient."),
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1"><Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger aria-label="Customer"><SelectValue /></SelectTrigger><SelectContent>{CUSTOMERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-col gap-1"><Label>Purpose</Label>
                <Select value={purpose} onValueChange={(v) => setPurpose(v as TransmittalPurpose)}><SelectTrigger aria-label="Purpose"><SelectValue /></SelectTrigger><SelectContent>{PURPOSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="tr-rcp">Recipients (separate with ;)</Label><Input id="tr-rcp" value={recipients} onChange={(e) => setRecipients(e.target.value)} /></div>
              <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="tr-note">Cover note</Label><Textarea id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
          ),
        },
        {
          id: "review", title: "Review and send",
          content: (
            <dl className="grid gap-4 md:grid-cols-2">
              <KV k="Customer">{customerName(customerId)}</KV>
              <KV k="Purpose">{purpose}</KV>
              <KV k="Recipients">{recipients}</KV>
              <KV k="Revisions">{docs.map((id) => `${id} rev ${releasedRev(s.documents.find((d) => d.id === id)!)?.rev}`).join(", ")}</KV>
              <KV k="Engineering request">{chosenEr?.id ?? "None"}</KV>
            </dl>
          ),
        },
      ]}
    />
  )
}

export function TrDetail() {
  const { id = "" } = useParams()
  const s = useSlice("engineering")
  const st = useScreenState("TR-001")
  const t = s.transmittals.find((x) => x.id === id)
  return (
    <DetailState state={st} found={!!t} what={`Transmittal ${id}`} back={{ to: "/engineering/transmittals", label: "Back to transmittals" }}>
      {t && <TrBody t={t} />}
    </DetailState>
  )
}

function TrBody({ t }: { t: TransmittalRecord }) {
  const s = useSlice("engineering")
  const runD = useActDialog()
  const [open, setOpen] = useState(false)
  const [resp, setResp] = useState<TrResponse>("Approved")
  const pending = t.recipients.filter((r) => !t.responses.some((x) => x.recipient === r))
  const [who, setWho] = useState(pending[0] ?? "")
  const er = s.requests.find((r) => r.id === t.engineeringRequestId)
  const canRespond = t.purpose === "For Approval" && !!t.sentOn && pending.length > 0
  return (
    <>
      <DetailPage
        header={{
          title: `${t.id} ${t.purpose}`,
          screenId: "TR-001",
          crumbs: [{ label: "Transmittals", to: "/engineering/transmittals" }, { label: t.id }],
          description: `${t.revsSent.length} revision${t.revsSent.length === 1 ? "" : "s"} to ${customerName(t.customerId)}, sent ${fmtDate(t.sentOn)} by ${userName(t.sentBy)}.${t.note ? ` ${t.note}` : ""}`,
          chips: (
            <>
              <StageText value={trState(t)} />
              {er && er.customerApprovalEvidence === t.id && <Chip kind="change" note="Customer approval evidence on the ETO order (Design Approval milestone)">Design approval evidence</Chip>}
            </>
          ),
          primary: canRespond ? <Button onClick={() => setOpen(true)}>Record response</Button> : undefined,
        }}
        doc={{ type: "transmittal", id: t.id }}
        summary={
          <>
            <KV k="Customer">{customerName(t.customerId)}</KV>
            <KV k="Sales order">{t.soId ? <RefLink r={{ type: "salesOrder", id: t.soId }} /> : "None"}</KV>
            <KV k="Engineering request">{er ? <span className="inline-flex flex-wrap items-center gap-1"><RefLink r={{ type: "engineeringRequest", id: er.id }} /><StatusBadge kind="engineeringRequest" status={er.status} size="sm" /></span> : "None"}</KV>
            <KV k="Recipients">{t.recipients.join("; ")}</KV>
          </>
        }
        tabs={[
          {
            id: "docs", label: "Revisions sent", count: t.revsSent.length,
            content: (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-table-head"><TableRow><TableHead>Document</TableHead><TableHead>Rev sent</TableHead><TableHead>Current status</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {t.revsSent.map((r) => {
                      const d = s.documents.find((x) => x.id === r.documentId)
                      const v = d?.revisions.find((x) => x.rev === r.rev)
                      const cur = d ? releasedRev(d) : undefined
                      return (
                        <TableRow key={r.documentId} className="h-8 text-[13px]">
                          <TableCell><RefLink r={{ type: "document", id: r.documentId }} /></TableCell>
                          <TableCell className="font-mono">{r.rev}</TableCell>
                          <TableCell>{v && <StatusBadge kind="document" status={v.status} size="sm" />}</TableCell>
                          <TableCell>{cur && cur.rev !== r.rev ? `Rev ${cur.rev} is now released; send again if the customer needs it.` : ""}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ),
          },
          {
            id: "resp", label: "Responses", count: t.responses.length,
            content: t.purpose !== "For Approval" ? <p className="text-sm text-muted-foreground">{t.purpose} packages take no approval response.</p> : t.responses.length ? (
              <ul className="flex flex-col gap-1 text-sm">{t.responses.map((r) => <li key={r.recipient}><span className="font-medium">{r.response}</span> from {r.recipient}, {fmtDate(r.on)}</li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">Awaiting the customer's response.</p>,
          },
          { id: "activity", label: "Activity", count: t.activity.length, content: <ul className="flex flex-col gap-1 text-sm">{[...t.activity].reverse().map((a, i) => <li key={i}><span className="tabular text-muted-foreground">{fmtDate(a.at)}</span> · {a.by} · {a.text}</li>)}</ul> },
        ]}
      />
      <NoPostings />
      <RulesPanel rules={RULES} />
      <DialogShell open={open} onOpenChange={setOpen} title={`Record the customer's response on ${t.id}`} confirmLabel="Record response"
        consequence={resp === "Revise & Resubmit" ? `${er?.id ?? "The engineering request"} returns to In Design and its review loop count goes up by one.` : `Records ${resp} as the customer approval evidence on ${t.soId ?? "the order"}; this drives the Design Approval milestone.`}
        onConfirm={() => runD((d, c) => act.recordResponse(d, c, t.id, resp, who), "Response recorded")}>
        <Label>Recipient</Label>
        <Select value={who} onValueChange={setWho}><SelectTrigger aria-label="Recipient"><SelectValue /></SelectTrigger><SelectContent>{pending.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Response</legend>
          {RESPONSES.map((r) => <label key={r} className="flex items-center gap-2 text-sm"><input type="radio" name="resp" checked={resp === r} onChange={() => setResp(r)} />{r}</label>)}
        </fieldset>
      </DialogShell>
    </>
  )
}
