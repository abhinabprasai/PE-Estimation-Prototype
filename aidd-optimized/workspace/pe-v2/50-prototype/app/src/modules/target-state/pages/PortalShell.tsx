// FX-PTL-SHELL: portal shell, external sign-in and invitation [Book IX §4.1].
// Rules shown: a separate external identity tenant; invitation-based onboarding; per-company accounts with named users;
// multi-factor enforced; internal and external identities never share a namespace; every call carries the partner scope;
// availability tier two: a portal outage never blocks internal operations and every portal transaction has an internal fallback.
// The sign-in here is a prototype: it checks the seeded accounts and a displayed demo code; no real credential is handled.

import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, ErrorAlert, KV, RulesPanel } from "@/components/patterns"
import { DetailPage, DialogShell } from "@/components/templates"
import { CUSTOMERS, VENDORS } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { useMutate, useSlice } from "@/store"
import { Field, Loading, Tag, TargetFrame, useScreenState } from "../components"
import { nid } from "../lib"

const DECISION = "Supplier and customer portals are a Book IX target-state module (Book IX §4; DEC-05 keeps email and paper at go-live)"
const EVIDENCE = "two suppliers and one customer completing their full loops for one month without email fallback, with the disclosure audit reviewed"
const INTERNAL_DOMAIN = "pe.example"
const DEMO_CODE = "246810"
const partnerName = (kind: string, id: string) => (kind === "supplier" ? VENDORS.find((v) => v.id === id)?.name : CUSTOMERS.find((c) => c.id === id)?.name) ?? id

// ============================================================================ shell
export function PortalHome() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("portal-shell", { degraded: "The portal tier is degraded. Partners can read; writes fall back to the internal path (email to the buyer or customer service). Internal operations are not affected.", offline: "The external tenant is unreachable. Showing the last synced accounts. Internal operations continue; every portal transaction has an internal fallback path." })
  const [dlg, setDlg] = useState(false)
  const [f, setF] = useState({ email: "", kind: "supplier" as "supplier" | "customer", partnerId: "" })
  const [err, setErr] = useState<Record<string, string>>({})
  const partners = f.kind === "supplier" ? VENDORS.filter((v) => v.onboarding === "Active") : CUSTOMERS.filter((c) => c.status === "Active")
  const invite = () => {
    const e: Record<string, string> = {}
    const em = f.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) e.email = "Enter a valid email address."
    else if (em.endsWith("@" + INTERNAL_DOMAIN)) e.email = "Internal and external identities never share a namespace: this address belongs to the internal directory."
    else if (s.portal.users.some((u) => u.email === em && u.partnerId === f.partnerId)) e.email = "This person already has an account for this company."
    else if (s.portal.invites.some((i) => i.email === em && i.partnerId === f.partnerId && i.state === "Sent")) e.email = "An invitation to this address is already open."
    if (!f.partnerId) e.partnerId = "Choose the company the account belongs to: accounts are per company."
    setErr(e)
    if (Object.keys(e).length) return "Fix the marked fields."
    const g = st.guard()
    if (g) return g
    const r = mutate((d) => {
      d.portal.invites.unshift({ id: nid(d, "INV"), email: em, kind: f.kind, partnerId: f.partnerId, sentOn: "2026-10-09", expiresOn: "2026-10-23", state: "Sent" })
    })
    if (!r.ok) return r.error
    setF({ email: "", kind: f.kind, partnerId: "" })
    return null
  }
  const rules: [string, string][] = [
    ["Separate external identity tenant", "Partner accounts live in the external tenant below, never in the internal directory."],
    ["Invitation-based onboarding", "An account exists only after an invitation is accepted (FX-PTL-SHELL invitation page)."],
    ["Per company accounts, named users", "Each account belongs to one company and one named person."],
    ["Multi-factor enforced", "Sign-in always asks for the second factor; an account without one enrolled cannot sign in."],
    ["Partner scope on every call", "Supplier screens show only that vendor's POs; customer screens only that customer's orders."],
    ["Writes through the public APIs", "Every write uses the contract repository's API with an idempotency key; rate limits and full audit apply."],
    ["Availability tier two", "A portal outage never blocks internal operations; each portal transaction has an internal fallback path."],
  ]
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <DetailPage
        header={{ title: "Portal shell", screenId: "FX-PTL-SHELL", description: "The portals are external skins over the same services, the same authorization engine and the same validations as the internal screens.", primary: <Button disabled={st.locked} onClick={() => { setErr({}); setDlg(true) }}>Invite a partner user</Button>, actions: <><Button asChild variant="outline"><Link to="/target/portals/sign-in">External sign-in</Link></Button><Button asChild variant="outline"><Link to="/target/portals/invitation">Accept an invitation</Link></Button></> }}
        summary={<><KV k="Accounts">{s.portal.users.length}</KV><KV k="Open invitations">{s.portal.invites.filter((i) => i.state === "Sent").length}</KV><KV k="MFA enrolled">{s.portal.users.filter((u) => u.mfa === "Enrolled").length} of {s.portal.users.length}</KV><KV k="Tier">Two (internal fallback)</KV></>}
        tabs={[
          { id: "accounts", label: "External accounts", count: s.portal.users.length, content: st.loading ? <Loading /> : s.portal.users.length === 0 || st.empty ? <EmptyState title="No external account yet">Invite the first partner user.</EmptyState> : (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Account</TableHead><TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Type</TableHead><TableHead>MFA</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
              <TableBody>{s.portal.users.map((u) => <TableRow key={u.id}><TableCell className="font-mono">{u.id}</TableCell><TableCell>{u.name}<div className="text-xs text-muted-foreground">{u.email}</div></TableCell><TableCell>{partnerName(u.kind, u.partnerId)}</TableCell><TableCell>{u.kind}</TableCell><TableCell><Tag family={u.mfa === "Enrolled" ? "done" : "pending"} label={u.mfa} /></TableCell><TableCell><Tag family={u.status === "Active" ? "active" : u.status === "Invited" ? "pending" : "blocked"} label={u.status} /></TableCell></TableRow>)}</TableBody></Table>
          ) },
          { id: "invites", label: "Invitations", count: s.portal.invites.length, content: (
            <Table><TableHeader className="bg-table-head"><TableRow><TableHead>Invitation</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead><TableHead>Sent</TableHead><TableHead>Expires</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
              <TableBody>{s.portal.invites.map((i) => <TableRow key={i.id}><TableCell className="font-mono">{i.id}</TableCell><TableCell>{i.email}</TableCell><TableCell>{partnerName(i.kind, i.partnerId)}</TableCell><TableCell>{fmtDate(i.sentOn)}</TableCell><TableCell>{fmtDate(i.expiresOn)}</TableCell><TableCell><span className="flex items-center gap-2"><Tag family={i.state === "Accepted" ? "done" : i.state === "Sent" ? "pending" : "cancelled"} label={i.state} />{i.state === "Expired" && <Button size="sm" variant="outline" disabled={st.locked} onClick={() => st.run(() => { mutate((d) => { const x = d.portal.invites.find((q) => q.id === i.id)!; x.state = "Sent"; x.sentOn = "2026-10-09"; x.expiresOn = "2026-10-23" }); return { ok: "Invitation sent again" } })}>Resend</Button>}</span></TableCell></TableRow>)}</TableBody></Table>
          ) },
          { id: "rules", label: "Architecture rules", content: <ul className="grid gap-3 md:grid-cols-2">{rules.map(([t, d]) => <li key={t} className="rounded-lg border p-4"><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></li>)}</ul> },
          { id: "entry", label: "Entry points", content: (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4"><p className="mb-2 font-medium">Supplier portal</p><ul className="space-y-1 text-sm">{[["PO worklist and acknowledgement", "/target/portals/supplier/orders"], ["Deviation request", "/target/portals/supplier/deviations"], ["ASN creation", "/target/portals/supplier/asn"], ["Invoice status, scorecard and SCAR response", "/target/portals/supplier/status"]].map(([l, to]) => <li key={to}><Link className="text-link underline" to={to}>{l}</Link></li>)}</ul></div>
              <div className="rounded-lg border p-4"><p className="mb-2 font-medium">Customer portal</p><ul className="space-y-1 text-sm">{[["Order status", "/target/portals/customer/orders"], ["Drawing approvals", "/target/portals/customer/drawings"], ["Shipment tracking and e-POD", "/target/portals/customer/shipments"], ["Returns request", "/target/portals/customer/returns"]].map(([l, to]) => <li key={to}><Link className="text-link underline" to={to}>{l}</Link></li>)}</ul></div>
            </div>
          ) },
        ]}
      />
      <DialogShell open={dlg} onOpenChange={setDlg} title="Invite a partner user" confirmLabel="Send invitation" onConfirm={invite} consequence="Sends an invitation to the external tenant for one named person at one company. The account exists only after the invitation is accepted." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" id="pi-e" error={err.email}><Input id="pi-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Portal" id="pi-k"><Select value={f.kind} onValueChange={(v) => setF({ email: f.email, kind: v as "supplier" | "customer", partnerId: "" })}><SelectTrigger id="pi-k"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supplier">Supplier</SelectItem><SelectItem value="customer">Customer</SelectItem></SelectContent></Select></Field>
          <Field label="Company" id="pi-c" error={err.partnerId}><Select value={f.partnerId} onValueChange={(v) => setF({ ...f, partnerId: v })}><SelectTrigger id="pi-c"><SelectValue placeholder="Choose a company" /></SelectTrigger><SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name.slice(0, 48)}</SelectItem>)}</SelectContent></Select></Field>
        </div>
      </DialogShell>
      <RulesPanel rules={[["PTL-1", "Internal and external identities never share a namespace.", "Book IX §4.1"], ["PTL-2", "Multi-factor is enforced for every external account.", "Book IX §4.1"], ["PTL-3", "A portal outage never blocks internal operations; every portal transaction has an internal fallback path.", "Book IX §4.1"]]} />
    </>
  )
}

// ============================================================================ sign in
export function PortalSignIn() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const nav = useNavigate()
  const st = useScreenState("portal-signin", { offline: "The external identity tenant is unreachable. Nobody can sign in to the portal; internal users are not affected. Use the email or phone fallback path." })
  const [step, setStep] = useState<"email" | "mfa" | "done">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [fails, setFails] = useState(0)
  const [error, setError] = useState("")
  const user = s.portal.users.find((u) => u.email === email.trim().toLowerCase())
  const next = () => {
    setError("")
    const g = st.guard()
    if (g) return setError(g)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter your email address.")
    if (email.trim().toLowerCase().endsWith("@" + INTERNAL_DOMAIN)) return setError("Internal staff sign in through the internal single sign-on, not the partner portal: the two identity namespaces never mix.")
    if (!user) return setError("We could not sign you in with those details. Check the address, or ask your contact at PE for an invitation.")
    if (user.status === "Locked") return setError("This account is locked after failed attempts. Contact your PE contact to unlock it.")
    if (user.status === "Invited") return setError("This account has an open invitation. Accept the invitation first.")
    if (user.mfa !== "Enrolled") return setError("Multi-factor is required and not enrolled for this account. Finish enrolment from the invitation.")
    setStep("mfa")
  }
  const verify = () => {
    setError("")
    if (!/^\d{6}$/.test(code)) return setError("The code is six digits.")
    if (code !== DEMO_CODE) {
      const n = fails + 1
      setFails(n)
      if (n >= 3 && user) { mutate((d) => { const u = d.portal.users.find((q) => q.id === user.id)!; u.status = "Locked" }); setStep("email"); return setError("Three wrong codes: the account is now locked. Contact your PE contact.") }
      return setError(`That code is not right. ${3 - n} attempt${3 - n === 1 ? "" : "s"} left.`)
    }
    if (!user) return
    mutate((d) => { d.portal.signedIn[user.kind] = user.id; d.portal.scope[user.kind] = user.partnerId })
    setStep("done")
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
        <h1 className="text-xl font-semibold">External sign-in <span className="rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">FX-PTL-SHELL</span></h1>
        <p className="text-sm text-muted-foreground">Partner accounts sign in through the external identity tenant, with a second factor every time. This is a prototype: it checks the seeded accounts and the demo code shown below.</p>
        {error && <ErrorAlert title="Sign-in failed" onDismiss={() => setError("")}>{error}</ErrorAlert>}
        {step === "email" && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); next() }}>
            <Field label="Work email" id="si-e" hint="Try elena.marsh@northstar-steel.example (supplier) or creed@midlandplains.example (customer)"><Input id="si-e" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button type="submit" disabled={st.state === "loading"}>Continue</Button>
          </form>
        )}
        {step === "mfa" && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); verify() }}>
            <Field label="Authenticator code" id="si-c" hint={`Prototype only: the demo code is ${DEMO_CODE}`}><Input id="si-c" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Button type="submit">Verify and sign in</Button>
            <Button type="button" variant="ghost" onClick={() => { setStep("email"); setCode("") }}>Use a different account</Button>
          </form>
        )}
        {step === "done" && user && (
          <div className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
            <p>Signed in as <span className="font-semibold">{user.name}</span> for {partnerName(user.kind, user.partnerId)}. Scope <span className="font-mono">{user.partnerId}</span> is set on every call.</p>
            <Button onClick={() => nav(user.kind === "supplier" ? "/target/portals/supplier/orders" : "/target/portals/customer/orders")}>Go to your {user.kind} portal</Button>
          </div>
        )}
        <p className="text-sm"><Link className="text-link underline" to="/target/portals">Back to the portal shell</Link></p>
      </div>
    </>
  )
}

// ============================================================================ invitation
export function PortalInvitation() {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const st = useScreenState("portal-invite", { validation: "Validation: set up the second factor with the demo code and accept the terms to finish." })
  const open = s.portal.invites.filter((i) => i.state !== "Accepted")
  const [id, setId] = useState(open[0]?.id ?? "")
  const inv = s.portal.invites.find((i) => i.id === id)
  const [code, setCode] = useState("")
  const [terms, setTerms] = useState(false)
  const [msg, setMsg] = useState("")
  const [done, setDone] = useState(false)
  const accept = () => {
    setMsg("")
    const g = st.guard()
    if (g) return setMsg(g)
    if (!inv) return setMsg("Choose an invitation.")
    if (inv.state === "Expired" || inv.expiresOn < "2026-10-09") return setMsg(`This invitation expired on ${fmtDate(inv.expiresOn)}. Ask your PE contact to send a new one.`)
    if (code !== DEMO_CODE) return setMsg("The authenticator code does not match. Multi-factor must be enrolled before the account is created.")
    if (!terms) return setMsg("Accept the portal terms to continue.")
    mutate((d) => {
      const i = d.portal.invites.find((q) => q.id === inv.id)!
      i.state = "Accepted"
      const u = d.portal.users.find((q) => q.email === i.email && q.partnerId === i.partnerId)
      if (u) { u.status = "Active"; u.mfa = "Enrolled" }
      else d.portal.users.push({ id: nid(d, "PU"), name: i.email.split("@")[0], email: i.email, kind: i.kind, partnerId: i.partnerId, mfa: "Enrolled", status: "Active" })
    })
    setDone(true)
  }
  return (
    <>
      <TargetFrame st={st} decision={DECISION} evidence={EVIDENCE} />
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-8">
        <h1 className="text-xl font-semibold">Accept your invitation <span className="rounded-md border bg-muted px-2 font-mono text-xs text-muted-foreground">FX-PTL-SHELL</span></h1>
        {st.loading ? <Loading rows={3} /> : open.length === 0 || st.empty ? <EmptyState title="No open invitation">All invitations are accepted. Ask an administrator to send one from the portal shell.</EmptyState> : done ? (
          <div className="rounded-lg border p-4 text-sm"><p className="font-medium">Your account is active.</p><p>Multi-factor is enrolled. <Link className="text-link underline" to="/target/portals/sign-in">Sign in</Link>.</p></div>
        ) : (
          <>
            {msg && <ErrorAlert title="Not done" onDismiss={() => setMsg("")}>{msg}</ErrorAlert>}
            <Field label="Invitation (prototype picker)" id="in-i"><Select value={id} onValueChange={setId}><SelectTrigger id="in-i"><SelectValue /></SelectTrigger><SelectContent>{open.map((i) => <SelectItem key={i.id} value={i.id}>{i.email} ({i.state})</SelectItem>)}</SelectContent></Select></Field>
            {inv && <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4"><KV k="Company">{partnerName(inv.kind, inv.partnerId)}</KV><KV k="Portal">{inv.kind}</KV><KV k="Sent">{fmtDate(inv.sentOn)}</KV><KV k="Expires">{fmtDate(inv.expiresOn)} {inv.state === "Expired" && <Chip kind="flag">Expired</Chip>}</KV></dl>}
            <Field label="Authenticator code" id="in-c" hint={`Set up your authenticator app, then enter its code. Prototype only: the demo code is ${DEMO_CODE}`}><Input id="in-c" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <label className="flex items-start gap-2 text-sm"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} />I accept the portal terms of use.</label>
            <Button disabled={st.locked} onClick={accept}>Create my account</Button>
          </>
        )}
      </div>
    </>
  )
}
