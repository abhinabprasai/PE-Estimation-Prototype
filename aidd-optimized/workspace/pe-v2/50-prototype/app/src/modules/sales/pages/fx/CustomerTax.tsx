// OM-CUST-001/2 Tax tab detail [DOC:pp.45-46 Book I A §11.1-11.4]: tax registrations per jurisdiction, default tax
// code, exemption certificates (read-only embed of ACC 19.2), use-tax accrual (a vendor toggle, shown read-only
// here), tax address role, and how this customer's tax resolves along the determination precedence.
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DialogShell } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { useRole, useSlice } from "@/store"
import { addTaxRegistration, saveTaxProfile } from "../../fx/actions"
import type { TaxProfile } from "../../fx/model"
import { Reading, Section } from "../../components/ext"
import { Inline, PickField, StateBar, StateGate, TextField, report, useFxState } from "./kit"

const TAX_CODES = [
  { value: "S1", label: "S1 Sales tax (default for sales documents)" },
  { value: "S1-CA", label: "S1-CA Sales tax, Canada (GST/HST jurisdictions)" },
  { value: "E-IC", label: "E-IC Intercompany, exempt" },
  { value: "Z-EXP", label: "Z-EXP Zero-rated export (needs export documents)" },
]

export function TaxProfilePanel({ custId, writable }: { custId: string; writable: boolean }) {
  const db = useSlice("sales")
  const [role] = useRole()
  const t = db.fx.tax[custId]
  const c = db.customers.find((x) => x.id === custId)
  const [regOpen, setRegOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [err, setErr] = useState<{ text: string } | null>(null)
  if (!t || !c) return <p className="text-sm text-muted-foreground">No tax profile for this customer.</p>
  const shipState = (c.shipTo.match(/,\s*([A-Z]{2})\s+[A-Z0-9]/)?.[1] ?? "") || (c.currency === "CAD" ? "SK" : "")
  const cert = t.certificates.find((x) => x.state === shipState) ?? t.certificates[0]
  const certOk = cert?.status === "Verified" && cert.validTo >= "2026-10-09"
  const nexus = t.nexusStates.includes(shipState) || t.nexusStates.length > 0
  const steps: { n: number; label: string; result: string; hit: boolean }[] = [
    { n: 1, label: "Document-line manual override", result: "Finance only, reason mandatory, flagged Override. None on this customer's lines.", hit: false },
    { n: 2, label: "Exemption certificate for the ship-to state", result: !cert ? "No certificate on file." : certOk ? `Certificate ${cert.id} (${cert.state}) is Verified and valid to ${cert.validTo}: exemption code applies, Avalara returns $0 for exempt lines.` : `Certificate ${cert.id} is ${cert.status}${cert.status === "Expired" ? ` (valid to ${cert.validTo})` : ""}: not used; tax is charged.`, hit: !!cert && certOk },
    { n: 3, label: "Customer tax profile", result: `Default tax code ${t.defaultTaxCode}; ${t.registrations.length} registration(s); tax address role ${t.addressRole}.`, hit: !(cert && certOk) },
    { n: 4, label: "Item tax data (Tax Category, Avalara product tax code)", result: "Read from each item's Sales tab.", hit: false },
    { n: 5, label: "Jurisdiction and nexus", result: nexus ? `Ship-to ${shipState || "not recorded"}: PE collects tax where it has nexus (${t.nexusStates.join(", ")}).` : "No nexus on the ship-to state: tax $0 with reason Non-Nexus.", hit: false },
    { n: 6, label: "Failover when Avalara is unreachable", result: "Rate override with the Override badge; the document posts and queues for recalculation every 15 minutes.", hit: false },
  ]
  const canEdit = writable && ["Finance (credit)", "Controller", "CFO", "Customer Service Manager"].includes(role)
  return (
    <div className="flex flex-col gap-4">
      <Inline error={err} onDismiss={() => setErr(null)} />
      <Section title="Tax registrations" action={<Button size="sm" variant="outline" onClick={() => setRegOpen(true)} disabled={!writable}>Add registration</Button>}>
        <Table>
          <TableHeader className="bg-table-head"><TableRow><TableHead>Jurisdiction</TableHead><TableHead>Registration #</TableHead><TableHead>Type</TableHead><TableHead>Verified</TableHead></TableRow></TableHeader>
          <TableBody>
            {t.registrations.map((r) => <TableRow key={r.jurisdiction + r.number}><TableCell>{r.jurisdiction}</TableCell><TableCell className="font-mono text-xs">{r.number}</TableCell><TableCell>{r.type}</TableCell><TableCell>{r.verified ? "Verified" : "Not verified"}</TableCell></TableRow>)}
            {t.registrations.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No registration yet. Tax registration numbers print on invoices where required.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Section>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Profile" action={<Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!canEdit} title={canEdit ? undefined : "Tax profile edits: Finance roles or the Customer Service Manager"}>Edit</Button>}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Default tax code</dt><dd>{t.defaultTaxCode}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Tax address role</dt><dd>{t.addressRole}{t.addressRole === "Bill-To" ? " (services)" : " (default)"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Nexus states</dt><dd>{t.nexusStates.join(", ") || "None"}</dd></div>
            <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Use tax accrual (vendor field)</dt><dd className="flex items-center gap-2"><Switch checked={t.useTaxAccrual} disabled aria-label="Use tax accrual, vendor field, not applicable to a customer" />Not applicable to a customer</dd></div>
          </dl>
          {t.note && <p className="text-sm text-muted-foreground">{t.note}</p>}
        </Section>
        <Section title="Exemption certificates" action={<Button size="sm" variant="outline" asChild><Link to="/configuration/tax">Add in ACC 19.2</Link></Button>}>
          <Table>
            <TableHeader className="bg-table-head"><TableRow><TableHead>Certificate</TableHead><TableHead>State</TableHead><TableHead>Status</TableHead><TableHead>Valid to</TableHead></TableRow></TableHeader>
            <TableBody>
              {t.certificates.map((x) => <TableRow key={x.id}><TableCell>{x.id}<span className="block text-xs text-muted-foreground">{x.reason}</span></TableCell><TableCell>{x.state}</TableCell><TableCell><Badge variant={x.status === "Verified" ? "outline" : "destructive"}>{x.status}</Badge></TableCell><TableCell>{x.validTo}</TableCell></TableRow>)}
              {t.certificates.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No exemption certificate. The customer is taxable where PE has nexus.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">Read-only embed of the accounting records (ACC 19.2). Add deep-links there <Chip kind="oq" id="ASM-EXT-1" note="ACC V2.0 is an external specification." /></p>
        </Section>
      </div>
      <Section title="How tax resolves for this customer (determination precedence)">
        <ol className="flex flex-col gap-1 text-sm">
          {steps.map((s) => <li key={s.n} className={s.hit ? "font-medium" : ""}><span className="tabular mr-2 inline-block w-4 text-muted-foreground">{s.n}</span>{s.label}: {s.result}{s.hit ? " (decides)" : ""}</li>)}
        </ol>
        <p className="text-xs text-muted-foreground">Each step fills only what the previous steps left empty [DOC:p.45 §11.1]. Tax is estimated on quote and order save and committed at invoice post. <Reading id="SR-38" note="Default tax code list is a design set around the PRD's S1, U1 and E-IC codes; the Canadian code is a design value." /></p>
      </Section>
      <AddRegistration open={regOpen} onOpenChange={setRegOpen} custId={custId} />
      <EditProfile open={editOpen} onOpenChange={setEditOpen} custId={custId} t={t} />
    </div>
  )
}

function AddRegistration({ open, onOpenChange, custId }: { open: boolean; onOpenChange: (o: boolean) => void; custId: string }) {
  const [j, setJ] = useState("")
  const [n, setN] = useState("")
  const [ty, setTy] = useState<TaxProfile["registrations"][number]["type"]>("Sales tax permit")
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title="Add a tax registration" description="State or province and the registration number; it prints on invoices where required." consequence="Adds the registration as Not verified. Finance verifies it before it is relied on for exemption." confirmLabel="Add registration" onConfirm={() => { const e = report(addTaxRegistration(custId, j, n, ty), "Registration added"); if (!e) { setJ(""); setN("") } return e }}>
      <TextField id="tr-j" label="Jurisdiction" value={j} onChange={setJ} placeholder="Nebraska sales tax" />
      <TextField id="tr-n" label="Registration #" value={n} onChange={setN} />
      <PickField label="Type" value={ty} onChange={(v) => setTy(v as typeof ty)} options={["Sales tax permit", "GST/HST", "QST", "PST"]} />
    </DialogShell>
  )
}
function EditProfile({ open, onOpenChange, custId, t }: { open: boolean; onOpenChange: (o: boolean) => void; custId: string; t: TaxProfile }) {
  const [code, setCode] = useState(t.defaultTaxCode)
  const [role, setRole] = useState<TaxProfile["addressRole"]>(t.addressRole)
  return (
    <DialogShell open={open} onOpenChange={onOpenChange} title="Edit the tax profile" consequence="The new default code and address role apply to documents from today; documents already issued keep their tax." requireReason confirmLabel="Save profile" onConfirm={(r) => { const e = report(saveTaxProfile(custId, { defaultTaxCode: code, addressRole: role }, r), "Tax profile saved"); if (e) toast.dismiss(); return e }}>
      <PickField label="Default tax code" value={code} onChange={setCode} options={TAX_CODES} />
      <PickField label="Tax address role" value={role} onChange={(v) => setRole(v as typeof role)} options={[{ value: "Ship-To", label: "Ship-To (default)" }, { value: "Bill-To", label: "Bill-To (services)" }]} />
    </DialogShell>
  )
}

/** The tax tab with its nine-state bar. */
export function TaxTab({ custId }: { custId: string }) {
  const st = useFxState()
  return (
    <div className="flex flex-col gap-4">
      <StateBar st={st} />
      <StateGate st={st} empty={{ title: "No tax profile yet", body: "The tax profile is completed at activation: registrations, default tax code, address role." }}>
        <TaxProfilePanel custId={custId} writable={st.writable} />
      </StateGate>
    </div>
  )
}
