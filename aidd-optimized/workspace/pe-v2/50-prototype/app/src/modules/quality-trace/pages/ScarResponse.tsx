// FX-QM-SCARRESP SCAR vendor response form (external) [DOC:p.89 Part E §6] (asserted).
// PE fills D1-D3 (team, problem, containment expected); the vendor responds D4-D8 through an
// emailed form (a portal comes in Phase 3), by the response due date, with escalation when overdue.
// This page is what the vendor sees. The reviewer bar above the form is for the prototype only:
// it picks which emailed SCAR is open. The form needs no PE sign-in; submitting records the
// response as the vendor's on the SCAR (README QT-R42).

import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogShell } from "@/components/templates"
import { Chip, RulesPanel } from "@/components/patterns"
import { TODAY } from "@/data/shared"
import { daysBetween } from "@/lib/format"
import { useSlice } from "@/store"
import { isOverdue } from "../data/actions"
import { scarX } from "../data/extra-actions"
import { EIGHT_D, type QtScar } from "../data/types"
import { Pick, Reading, Section, report, vendorName } from "../components/bits"
import { StateFrame, useScreenState } from "../components/states"

const RULES: [string, string, string][] = [
  ["SR-1", "PE fills D1-D3 (team, problem description, containment expected); the vendor responds D4-D8 through an emailed form. A supplier portal comes in Phase 3.", "DOC:p.89 Part E §6"],
  ["SR-2", "The SCAR has a response due date; an overdue SCAR is escalated, and a vendor with two or more open overdue SCARs becomes AVL Restricted.", "DOC:p.89 Part E §6"],
  ["SR-3", "The response is complete only when D4-D8 are filled in; PE reviews it and closes the SCAR, with cost recovery if agreed.", "DOC:p.89 Part E §6"],
]
const HINT: Record<string, string> = {
  D4: "What caused the problem, and why was it not caught? Show the analysis (5-Why, fishbone, 8D).",
  D5: "The permanent corrective action you chose, with the owner.",
  D6: "What was implemented and how you verified it works. Name the evidence.",
  D7: "What stops this from recurring on other products, lines and plants.",
  D8: "Closure statement and the people who contributed.",
}
const VENDOR = EIGHT_D.filter((x) => x.by === "Vendor")

export function ScarVendorResponse() {
  const s = useSlice("qualityTrace")
  const ss = useScreenState("FX-QM-SCARRESP")
  const [params, setParams] = useSearchParams()
  const emailed = s.scars
  const id = params.get("scar") ?? emailed.find((x) => x.open && !x.respondedOn)?.id ?? emailed[0]?.id ?? ""
  const scar = emailed.find((x) => x.id === id)
  const pick = (v: string) => (params.set("scar", v), setParams(params, { replace: true }))
  return (
    <StateFrame
      ss={ss}
      title="SCAR response form"
      screenId="FX-QM-SCARRESP"
      entity="SCAR response forms"
      allowed="vendor contact named on the SCAR"
      validation={["Fill in D4 to D8.", "Enter your name and a valid email address."]}
      conflict={{ what: "this SCAR", mine: "Submit D4 to D8", theirs: "PE quality closed the SCAR this morning after a phone agreement" }}
      degraded="The attachment scan is slow; files may take a minute to show as attached."
      header={{
        title: "SCAR response form",
        screenId: "FX-QM-SCARRESP",
        crumbs: [{ label: "SCAR register", to: "/quality/scar" }, { label: "Vendor response form" }],
        description: "The page the vendor reaches from the emailed link. The picker below is for review only.",
        chips: <><Chip kind="design" note="External page: the vendor needs no PE sign-in">External</Chip><Reading id="QT-R42" /></>,
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-wrap items-end gap-3 rounded-lg border border-dashed p-3 text-sm">
          <Mail className="size-4" aria-hidden="true" />
          <Pick id="sr-pick" label="Emailed SCAR (review only)" value={id} onChange={pick} options={emailed.map((x) => ({ value: x.id, label: `${x.id} · ${vendorName(x.vendorId)} · ${x.open ? (x.respondedOn ? "responded" : "awaiting response") : "closed"}` }))} />
          <Link className="pb-2 text-link underline-offset-4 hover:underline" to={`/quality/scar/${id}`}>Internal SCAR record</Link>
        </div>
        {scar ? <Form key={scar.id} scar={scar} locked={ss.locked} /> : <p className="text-sm text-muted-foreground">No SCAR has been emailed.</p>}
        <RulesPanel rules={RULES} />
      </div>
    </StateFrame>
  )
}

function Form({ scar, locked }: { scar: QtScar; locked: boolean }) {
  const s = useSlice("qualityTrace")
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(VENDOR.map((x) => [x.d, scar.sections[x.d] ?? ""])))
  const [who, setWho] = useState("")
  const [email, setEmail] = useState("")
  const [files, setFiles] = useState<string[]>([])
  const [file, setFile] = useState("")
  const [dlg, setDlg] = useState(false)
  const [draft, setDraft] = useState(false)
  const [errs, setErrs] = useState<string[]>([])
  const closed = !scar.open
  const over = isOverdue(scar, TODAY)
  const left = daysBetween(TODAY, scar.dueOn)
  const sent = s.vendorResponses.filter((x) => x.scarId === scar.id)
  const full = VENDOR.every((x) => scar.sections[x.d]?.trim()) && !!scar.respondedOn
  const readOnly = closed || locked
  const check = () => {
    const e: string[] = []
    for (const x of VENDOR) if (!vals[x.d].trim()) e.push(`${x.d} ${x.title} is required.`)
    if (!who.trim()) e.push("Enter your name.")
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.push("Enter a valid email address.")
    setErrs(e)
    return e.length === 0
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4 rounded-xl border p-6" aria-label={`SCAR ${scar.id} response form`}>
      <header className="flex flex-col gap-1 border-b pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supplier Corrective Action Request</p>
        <h2 className="text-xl font-semibold">{scar.id}: {scar.title.replace(/^SCAR: /, "")}</h2>
        <p className="text-sm text-muted-foreground">To {vendorName(scar.vendorId)} · issued {scar.issuedOn} · response due <strong className="text-foreground">{scar.dueOn}</strong></p>
      </header>
      {closed && (
        <Alert role="status">
          <AlertTitle>This SCAR is closed</AlertTitle>
          <AlertDescription>PE quality closed it on {scar.closedOn}. The form is read-only; contact the PE quality engineer to reopen it.</AlertDescription>
        </Alert>
      )}
      {!closed && over && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Response overdue by {-left} day(s)</AlertTitle>
          <AlertDescription>The SCAR has been escalated to PE purchasing. Two open overdue SCARs restrict a vendor on the approved vendor list.</AlertDescription>
        </Alert>
      )}
      {!closed && !over && !full && <p className="text-sm text-muted-foreground">{left >= 0 ? `${left} day(s) left to respond.` : ""}</p>}
      {full && !closed && (
        <Alert role="status">
          <AlertTitle>Response received {scar.respondedOn}</AlertTitle>
          <AlertDescription>PE quality is reviewing it. You will be contacted if anything is unclear. You can still add detail below and send it again.</AlertDescription>
        </Alert>
      )}
      <Section title="Completed by PE quality (D1 to D3)">
        <dl className="grid gap-3 text-sm">
          {EIGHT_D.filter((x) => x.by === "PE").map((x) => (
            <div key={x.d}>
              <dt className="font-medium">{x.d} · {x.title}</dt>
              <dd className="text-muted-foreground">{scar.sections[x.d] ?? "Not recorded"}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (check()) setDlg(true) }} noValidate>
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <legend className="mb-2 text-base font-semibold">Your response (D4 to D8)</legend>
          {VENDOR.map((x) => (
            <div key={x.d} className="flex flex-col gap-1">
              <Label htmlFor={`sr-${x.d}`}>{x.d} · {x.title}</Label>
              <p id={`sr-${x.d}-h`} className="text-xs text-muted-foreground">{HINT[x.d]}</p>
              <Textarea id={`sr-${x.d}`} rows={3} aria-describedby={`sr-${x.d}-h`} aria-invalid={errs.some((m) => m.startsWith(x.d))} value={vals[x.d]} onChange={(e) => setVals({ ...vals, [x.d]: e.target.value })} />
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sr-file">Attach evidence (file name)</Label>
            <div className="flex gap-2">
              <Input id="sr-file" value={file} onChange={(e) => setFile(e.target.value)} placeholder="line2_gas_alarm_log.pdf" />
              <Button type="button" variant="outline" disabled={!file.trim()} onClick={() => (setFiles([...files, file.trim()]), setFile(""))}>Add</Button>
            </div>
            {files.length > 0 && <ul className="text-sm">{files.map((f) => <li key={f}>{f} <Button type="button" size="sm" variant="ghost" onClick={() => setFiles(files.filter((x) => x !== f))}>Remove</Button></li>)}</ul>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sr-who">Your name</Label>
              <Input id="sr-who" value={who} onChange={(e) => setWho(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sr-mail">Your email</Label>
              <Input id="sr-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </fieldset>
        {errs.length > 0 && (
          <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
            <p className="font-semibold text-destructive">{errs.length} thing(s) need attention</p>
            <ul className="list-disc pl-5">{errs.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={readOnly}>Submit response</Button>
          <Button type="button" variant="outline" disabled={readOnly} onClick={() => setDraft(true)}>Save draft</Button>
          {draft && <span className="text-sm text-muted-foreground" role="status">Draft kept on this page for this visit; nothing is sent to PE.</span>}
        </div>
      </form>
      {sent.length > 0 && (
        <Section title="Responses received">
          <ul className="text-sm">{sent.map((r) => <li key={r.id}>{r.on.replace("T", " ")} · {r.respondent} ({r.email}){r.attachments.length ? ` · ${r.attachments.join(", ")}` : ""}</li>)}</ul>
        </Section>
      )}
      <DialogShell
        open={dlg}
        onOpenChange={setDlg}
        title={`Send your response to ${scar.id}`}
        consequence={`Sends D4 to D8 to PE quality with your name and email${files.length ? ` and ${files.length} attachment(s)` : ""}. PE reviews it and closes the SCAR; you can send an update until then.`}
        confirmLabel="Send response"
        onConfirm={() => {
          const r = scarX.submit(scar.id, { sections: vals, respondent: who, email, attachments: files })
          return report(r, "Response sent to PE quality") ? null : (r as { error: string }).error
        }}
      />
    </article>
  )
}
