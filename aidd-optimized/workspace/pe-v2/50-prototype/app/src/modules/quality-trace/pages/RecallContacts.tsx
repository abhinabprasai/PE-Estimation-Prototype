// RCL-001 contact-attempt log and PII disclosure log [DOC:p.182 FL-08 field 4; Book IV §9] (asserted).
// Customers are contacted after the dual-approved notification (C-52). Every attempt is logged
// per customer with channel, person, outcome and note; the export of the customer list is a PII
// disclosure that asks for a purpose and is logged (README QT-R38).

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DialogShell } from "@/components/templates"
import { Chip, DataTable, EmptyState, type Column } from "@/components/patterns"
import { useRole, useSlice } from "@/store"
import { contactX } from "../data/extra-actions"
import type { ContactAttempt, PiiDisclosure } from "../data/extra-types"
import type { QtRecall } from "../data/types"
import { Pick, Reading, Section, customerName, report, userName } from "../components/bits"

const CHANNELS: ContactAttempt["channel"][] = ["Phone", "Email", "Letter", "Site visit"]
const OUTCOMES: ContactAttempt["outcome"][] = ["Reached, acknowledged", "Reached, will respond", "No answer", "Left voicemail", "Email bounced", "Declined"]
const REACHED = new Set<ContactAttempt["outcome"]>(["Reached, acknowledged"])

export function ContactLog({ r }: { r: QtRecall }) {
  const s = useSlice("qualityTrace")
  const [role] = useRole()
  const [dlg, setDlg] = useState<string | null | undefined>(undefined)
  const rows = s.contacts.filter((c) => c.recallId === r.id)
  const open = r.stage !== "Identify" && r.stage !== "Contain"
  const customers = [...new Set(r.population.filter((p) => p.customerId).map((p) => p.customerId as string))]
  const per = customers.map((c) => {
    const mine = rows.filter((x) => x.customerId === c).sort((a, b) => a.at.localeCompare(b.at))
    return { c, n: mine.length, last: mine[mine.length - 1], reached: mine.some((x) => REACHED.has(x.outcome)) }
  })
  const cols: Column<ContactAttempt>[] = [
    { id: "at", header: "When", value: (x) => x.at, mono: true, sortable: true, cell: (x) => x.at.replace("T", " ") },
    { id: "cus", header: "Customer", value: (x) => customerName(x.customerId), filterable: true },
    { id: "ch", header: "Channel", value: (x) => x.channel, filterable: true },
    { id: "who", header: "Person contacted", value: (x) => x.contactName },
    { id: "out", header: "Outcome", value: (x) => x.outcome, filterable: true, cell: (x) => (REACHED.has(x.outcome) ? x.outcome : <Chip kind="flag">{x.outcome}</Chip>) },
    { id: "by", header: "Logged by", value: (x) => userName(x.by) },
    { id: "note", header: "Note", value: (x) => x.note },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={`Contact attempts (${rows.length})`}
        action={
          <span className="inline-flex items-center gap-2">
            <Reading id="QT-R38" />
            <Button size="sm" disabled={!open} onClick={() => setDlg(null)}>
              Log contact attempt
            </Button>
          </span>
        }
      >
        {!open && <p className="text-sm text-muted-foreground">Customers are contacted after the dual-approved notification (C-52). This campaign is at {r.stage}.</p>}
        {customers.length === 0 ? (
          <EmptyState title="No customers in the population">Units in the field name the customers to contact.</EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {per.map((p) => (
              <li key={p.c} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  <span className="block font-medium">{customerName(p.c)}</span>
                  <span className="block text-muted-foreground">{p.n ? `${p.n} attempt(s); last: ${p.last.channel}, ${p.last.outcome}` : "Not contacted yet"}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  {p.reached ? <Chip kind="design">Reached</Chip> : p.n ? <Chip kind="flag">Not reached</Chip> : <Chip kind="flag">No attempt</Chip>}
                  <Button size="sm" variant="outline" disabled={!open} onClick={() => setDlg(p.c)}>
                    Log attempt
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <DataTable
        rows={rows}
        columns={cols}
        rowId={(x) => x.id}
        searchText={(x) => `${x.contactName} ${x.note} ${customerName(x.customerId)}`}
        searchPlaceholder="Search contact, note, customer"
        initialSort={{ id: "at", dir: "desc" }}
        empty={{ title: "No contact attempts yet", body: open ? "Log each phone call, email, letter or site visit so no customer is lost." : "Available once the notification is approved." }}
      />
      {dlg !== undefined && <ContactDialog r={r} customers={customers} defaultCustomer={dlg ?? ""} role={role} onClose={() => setDlg(undefined)} />}
    </div>
  )
}

function ContactDialog({ r, customers, defaultCustomer, role, onClose }: { r: QtRecall; customers: string[]; defaultCustomer: string; role: string; onClose: () => void }) {
  const [cus, setCus] = useState(defaultCustomer)
  const [ch, setCh] = useState<ContactAttempt["channel"]>("Phone")
  const [who, setWho] = useState("")
  const [out, setOut] = useState<ContactAttempt["outcome"]>("Reached, acknowledged")
  const [note, setNote] = useState("")
  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Log contact attempt for ${r.id}`}
      description={`You are acting as ${role}. Each attempt stays on the record, reached or not.`}
      consequence={`Adds one attempt to the campaign's contact log and to its activity. Customer ${cus ? customerName(cus) : "(choose)"} is marked Reached only after an acknowledged contact.`}
      confirmLabel="Log attempt"
      onConfirm={() => {
        const x = contactX.add({ recallId: r.id, customerId: cus, channel: ch, contactName: who, outcome: out, note })
        return report(x, (id) => `${id} logged`) ? null : (x as { error: string }).error
      }}
    >
      <div className="grid gap-3 text-sm">
        <Pick id="cc" label="Customer" value={cus} onChange={setCus} options={customers.map((c) => ({ value: c, label: customerName(c) }))} />
        <Pick id="cch" label="Channel" value={ch} onChange={setCh} options={CHANNELS} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="cwho">Person contacted</Label>
          <Input id="cwho" value={who} onChange={(e) => setWho(e.target.value)} />
        </div>
        <Pick id="cout" label="Outcome" value={out} onChange={setOut} options={OUTCOMES} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="cnote">Note</Label>
          <Textarea id="cnote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </DialogShell>
  )
}

export function PiiLog({ recallId }: { recallId: string }) {
  const s = useSlice("qualityTrace")
  const rows = s.piiLog.filter((x) => x.recallId === recallId)
  const cols: Column<PiiDisclosure>[] = [
    { id: "on", header: "When", value: (x) => x.on, mono: true, cell: (x) => x.on.replace("T", " ") },
    { id: "by", header: "By", value: (x) => userName(x.by) },
    { id: "rows", header: "Rows", value: (x) => x.rows, align: "right", mono: true },
    { id: "purpose", header: "Purpose", value: (x) => x.purpose },
  ]
  return (
    <Section title={`PII disclosure log (${rows.length})`}>
      <DataTable rows={rows} columns={cols} rowId={(x) => x.id} empty={{ title: "No disclosures", body: "Every export of the customer list is logged here with its purpose." }} />
    </Section>
  )
}
