// FX-SHL-SSO (4 routes), FX-SHL-ERRORS (6 routes), FX-SHL-DEVICES (+ 3 device views).
// Identity: OIDC primary with SAML 2.0 fallback against the corporate IdP (Entra ID assumed, confirm at
// kickoff); no local passwords for workforce accounts, so none of these pages has a password field.
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"
import { CloudOff, FileQuestion, Lock, ServerCrash, ShieldAlert, ShieldCheck, Wrench, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Chip, FamilyBadge, ScanField, StatusBadge } from "@/components/patterns"
import { DetailPage, DialogShell, KioskFact, KioskPage } from "@/components/templates"
import { USERS, WORK_CENTERS } from "@/data/shared"
import { THRESHOLDS } from "@/data/domain"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRole } from "@/store"
import { DegradedBanner, OfflineBanner, Panel, ReadOnlyBanner, StateStage } from "../kit"
import { ROLE_LANDING, DEFAULT_LANDING } from "../data/seed"
import { DEVICES } from "./Foundations"

function AuthCard({ title, children, icon, id }: { title: string; children: ReactNode; icon?: ReactNode; id: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{id}</span>
      </div>
      {children}
    </div>
  )
}
const idpChip = <Chip kind="oq" id="IdP" note="Entra ID is assumed; the design is IdP-agnostic. Confirm at kickoff.">IdP assumed: Entra ID</Chip>

// ====================================================================================== SSO entry
type Scenario = "ok" | "idp-down" | "mfa" | "no-role"
export function SsoPage() {
  const [role] = useRole()
  const [step, setStep] = useState<"idle" | "redirecting" | "landing" | "failed">("idle")
  const [scn, setScn] = useState<Scenario>("ok")
  const [pct, setPct] = useState(0)
  const nav = useNavigate()
  const user = USERS.find((u) => u.roles.includes(role)) ?? USERS[0]
  const land = ROLE_LANDING[role] ?? DEFAULT_LANDING
  useEffect(() => {
    if (step !== "redirecting") return
    setPct(0)
    const t = setInterval(() => setPct((p) => Math.min(100, p + 20)), 200)
    const d = setTimeout(() => setStep(scn === "ok" ? "landing" : "failed"), 1100)
    return () => (clearInterval(t), clearTimeout(d))
  }, [step, scn])
  return (
    <DetailPage
      header={{ title: "SSO entry", screenId: "FX-SHL-SSO", description: "Sign-in redirect and landing. The four auth states are tabs of this entry: sign-in (here), session expired, step-up and kiosk lock.", chips: idpChip, actions: <AuthLinks /> }}
      tabs={[
        {
          id: "entry",
          label: "Sign in",
          content: (
            <div className="flex flex-col gap-4">
              <AuthCard id="/auth/sso" title="Sign in to PE Transformer ERP" icon={<ShieldCheck className="size-5" aria-hidden="true" />}>
                {step === "idle" && (
                  <>
                    <p className="text-sm">Sign in with your company account. There are no local passwords for workforce accounts; your identity provider asks for multi-factor authentication.</p>
                    <Button className="h-11" onClick={() => setStep("redirecting")}>
                      Continue with company sign-in
                    </Button>
                    <label className="grid gap-1 text-xs">
                      Prototype scenario
                      <select value={scn} onChange={(e) => setScn(e.target.value as Scenario)} className="h-8 rounded-md border bg-background px-2 text-sm">
                        <option value="ok">Succeeds</option>
                        <option value="idp-down">Identity provider unavailable</option>
                        <option value="mfa">Multi-factor step not completed</option>
                        <option value="no-role">No ERP role mapped to my groups</option>
                      </select>
                    </label>
                  </>
                )}
                {step === "redirecting" && (
                  <div role="status" aria-live="polite" className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Redirecting to your identity provider</p>
                    <Progress value={pct} aria-label="Redirecting" />
                    <p className="text-xs text-muted-foreground">You will return here after you sign in.</p>
                  </div>
                )}
                {step === "landing" && (
                  <div role="status" className="flex flex-col gap-2 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="size-4" aria-hidden="true" /> Signed in as {user.name}
                    </p>
                    <p>Roles from your IdP groups: {user.roles.join(", ")}. Leaver deactivation takes at most 1 hour from the HR trigger.</p>
                    <Button onClick={() => nav(land.route)}>Continue to {land.label}</Button>
                    <Button variant="ghost" onClick={() => setStep("idle")}>
                      Start over
                    </Button>
                  </div>
                )}
                {step === "failed" && (
                  <div role="alert" className="flex flex-col gap-2 text-sm">
                    {scn === "idp-down" && (
                      <>
                        <p className="flex items-center gap-2 font-semibold text-destructive">
                          <CloudOff className="size-4" aria-hidden="true" /> The identity provider is not answering
                        </p>
                        <p>Nothing is wrong with your account. Try again in a few minutes. If the outage continues, the IT service desk can open a local break-glass account; those exist for emergencies only and every use is reviewed.</p>
                      </>
                    )}
                    {scn === "mfa" && (
                      <>
                        <p className="flex items-center gap-2 font-semibold text-destructive">
                          <ShieldAlert className="size-4" aria-hidden="true" /> Multi-factor authentication was not completed
                        </p>
                        <p>Sign-in needs your second factor at the identity provider. Start again and approve the prompt on your device.</p>
                      </>
                    )}
                    {scn === "no-role" && (
                      <>
                        <p className="flex items-center gap-2 font-semibold text-destructive">
                          <ShieldAlert className="size-4" aria-hidden="true" /> You signed in, but no ERP role is mapped to your groups
                        </p>
                        <p>Roles come from identity-provider groups. Ask your manager to request the group for your role. Until then you cannot open any screen.</p>
                      </>
                    )}
                    <Button variant="outline" onClick={() => setStep("idle")}>
                      Try again
                    </Button>
                  </div>
                )}
              </AuthCard>
              <ul className="mx-auto max-w-lg list-disc pl-4 text-xs text-muted-foreground">
                <li>OIDC is primary, SAML 2.0 is the fallback. Roles come from IdP groups mapped to ERP roles (SCIM 2.0 provisioning).</li>
                <li>Vendors and customers (portal phases) sign in through a separate external tenant; internal and external identities never share a namespace.</li>
                <li>The redirect, scenarios and timings on this page are a simulation.</li>
              </ul>
            </div>
          ),
        },
      ]}
    />
  )
}
function AuthLinks() {
  return (
    <nav aria-label="Auth states" className="flex flex-wrap gap-2 text-sm">
      {[["/auth/sso", "Sign in"], ["/auth/session-expired", "Session expired"], ["/auth/step-up", "Step-up"], ["/auth/kiosk-lock", "Kiosk lock"]].map(([to, l]) => (
        <Link key={to} to={to} className="text-link underline">
          {l}
        </Link>
      ))}
    </nav>
  )
}

export function SessionExpiredPage() {
  const [params] = useSearchParams()
  const from = params.get("from") ?? "/sales/orders/SO-2026-00377"
  return (
    <DetailPage
      header={{ title: "Session expired", screenId: "FX-SHL-SSO", description: "Shown when the identity provider session ends. Nothing is lost silently.", chips: idpChip, actions: <AuthLinks /> }}
      tabs={[
        {
          id: "expired",
          label: "Session expired",
          content: (
            <AuthCard id="/auth/session-expired" title="You were signed out" icon={<Lock className="size-5" aria-hidden="true" />}>
              <p className="text-sm">Your session ended because it was inactive or the identity provider ended it. Sign in again to return to the page you were on.</p>
              <dl className="grid gap-1 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">You will return to</dt>
                  <dd className="font-mono">{from}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Unsaved changes</dt>
                  <dd>Fields you had not saved are kept in this browser and restored when you return. Anything already saved is untouched.</dd>
                </div>
              </dl>
              <Button asChild className="h-11">
                <Link to={`/auth/sso?next=${encodeURIComponent(from)}`}>Sign in again</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Session length is set by the identity provider; the specification gives no figure for office sessions (a reading). Kiosks lock after 10 minutes of inactivity instead: <Link to="/auth/kiosk-lock" className="text-link underline">kiosk lock</Link>.
              </p>
            </AuthCard>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== step-up
const STEP_UP: { id: string; action: string; where: string; to: string; note?: string }[] = [
  { id: "pay", action: "Payment release", where: "Accounting payment run (outside this prototype)", to: "/approvals" },
  { id: "bank", action: "Vendor bank change", where: "Vendor master, banking tab", to: "/purchasing/vendors" },
  { id: "period", action: "Period reopen", where: "Period configuration", to: "/configuration/periods", note: "Reopening a Hard Closed period also needs the Controller and the CFO, two distinct users in sequence (C-43)." },
  { id: "matrix", action: "Matrix release", where: "Account determination workbench (MM section 5.3)", to: "/materials/account-determination" },
  { id: "useradmin", action: "User-admin actions", where: "Access recertification and role changes", to: "/configuration/access-recertification" },
]
export function StepUpPage() {
  const [sel, setSel] = useState(STEP_UP[2])
  const [state, setState] = useState<"ask" | "waiting" | "ok" | "denied" | "timeout">("ask")
  const [left, setLeft] = useState(60)
  const t = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (state !== "waiting") return
    setLeft(60)
    t.current = setInterval(() => setLeft((x) => (x <= 1 ? (setState("timeout"), 0) : x - 1)), 100)
    return () => {
      if (t.current) clearInterval(t.current)
    }
  }, [state])
  return (
    <DetailPage
      header={{ title: "Step-up re-authentication", screenId: "FX-SHL-SSO", description: "A second prompt for the actions that move money, change the books or change access. Your session stays; only this action asks again.", chips: idpChip, actions: <AuthLinks /> }}
      tabs={[
        {
          id: "stepup",
          label: "Step-up",
          content: (
            <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
              <nav aria-label="Protected actions">
                <ul className="flex flex-col gap-1">
                  {STEP_UP.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => (setSel(s), setState("ask"))} aria-current={sel.id === s.id ? "true" : undefined} className={cn("h-9 w-full rounded-md px-2 text-left text-sm hover:bg-accent", sel.id === s.id && "bg-secondary font-semibold")}>
                        {s.action}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <AuthCard id="/auth/step-up" title={`Confirm it is you: ${sel.action.toLowerCase()}`} icon={<ShieldAlert className="size-5" aria-hidden="true" />}>
                <p className="text-sm">{sel.where}. The identity provider asks again before this action, even though you are signed in.</p>
                {sel.note && <p className="rounded-md bg-muted p-2 text-sm">{sel.note}</p>}
                {state === "ask" && (
                  <Button className="h-11" onClick={() => setState("waiting")}>
                    Re-authenticate with the identity provider
                  </Button>
                )}
                {state === "waiting" && (
                  <div role="status" aria-live="polite" className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Approve the prompt on your device</p>
                    <Progress value={(left / 60) * 100} aria-label="Time left" />
                    <p className="text-xs text-muted-foreground">Prototype: choose the result.</p>
                    <div className="flex gap-2">
                      <Button onClick={() => setState("ok")}>Simulate approve</Button>
                      <Button variant="outline" onClick={() => setState("denied")}>
                        Simulate deny
                      </Button>
                    </div>
                  </div>
                )}
                {state === "ok" && (
                  <div role="status" className="flex flex-col gap-2 text-sm">
                    <p className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="size-4" aria-hidden="true" /> Verified
                    </p>
                    <p>
                      You can now {sel.action.toLowerCase()} for 5 minutes. <Chip kind="design" note="Validity window is not in the PRD">5 minutes: design value</Chip>
                    </p>
                    <Button asChild>
                      <Link to={sel.to}>Continue to {sel.where.split(" (")[0].toLowerCase()}</Link>
                    </Button>
                  </div>
                )}
                {state === "denied" && (
                  <div role="alert" className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-destructive">The prompt was denied</p>
                    <p>The action did not run. If it was not you, tell Plant IT; the denial is logged.</p>
                    <Button variant="outline" onClick={() => setState("ask")}>
                      Try again
                    </Button>
                  </div>
                )}
                {state === "timeout" && (
                  <div role="alert" className="flex flex-col gap-2 text-sm">
                    <p className="font-semibold text-destructive">The prompt timed out</p>
                    <Button variant="outline" onClick={() => setState("ask")}>
                      Start again
                    </Button>
                  </div>
                )}
              </AuthCard>
            </div>
          ),
        },
      ]}
    />
  )
}

// ====================================================================================== kiosk lock
export function KioskLockPage() {
  const [locked, setLocked] = useState(true)
  const [who, setWho] = useState<string | null>(null)
  return (
    <KioskPage
      title="Terminal locked"
      screenId="FX-SHL-SSO"
      station="WC-400 Final Assembly"
      operator={locked ? undefined : who ?? undefined}
      exitTo="/auth/sso"
      scan={locked ? <ScanField scanPoint="SP-07" expected="your operator badge" onScan={(code) => { const u = USERS.find((x) => x.badge === code); if (!u) return { ok: false, expected: "a badge of an active user assigned to WC-400", next: "Scan your own badge.", message: "badge not recognised" }; if (!u.workCenterIds?.includes("WC-400")) return { ok: false, expected: "a user assigned to WC-400", next: "Ask your supervisor to assign you, or use your own terminal.", message: `${u.name} is not assigned to WC-400` }; setWho(u.name); setLocked(false); return { ok: true, message: `welcome ${u.name}` } }} /> : undefined}
      actions={locked ? [] : [{ label: "Lock now", primary: true, onClick: () => setLocked(true) }]}
    >
      {locked ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-4 text-2xl font-semibold">
            <Lock className="size-8" aria-hidden="true" /> This terminal locked after {10} minutes of inactivity
          </p>
          <p className="text-base">Scan your badge to continue. The session is scoped to work center WC-400; it opens only for people assigned there. Try badge BDG-7032 (assigned) or BDG-7033 (not assigned).</p>
          <p className="text-base text-muted-foreground">Inactivity lock is 10 minutes and can be set per station class. The device itself is bound by certificate, so no shared browser session exists.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <KioskFact label="Session">Open for {who} at WC-400</KioskFact>
          <p className="text-base">Work continues where it stopped. The terminal locks again after 10 minutes without a touch or scan.</p>
        </div>
      )}
    </KioskPage>
  )
}

// ====================================================================================== errors
function ErrorFrame({ code, icon, title, children, route, actions }: { code: string; icon: ReactNode; title: string; children: ReactNode; route: string; actions?: ReactNode }) {
  return (
    <DetailPage
      header={{ title: `${code} ${title}`, screenId: "FX-SHL-ERRORS", description: "System error and degraded pages. Each says what happened, what still works and what to do next.", actions: <ErrorLinks /> }}
      tabs={[
        {
          id: "page",
          label: "Page",
          content: (
            <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border p-6">
              <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-lg font-semibold">{title}</h2>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{route}</span>
              </div>
              {children}
              <div className="flex flex-wrap gap-2">
                {actions}
                <Button asChild variant="outline">
                  <Link to="/home">Go to the home page</Link>
                </Button>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
function ErrorLinks() {
  return (
    <nav aria-label="Error pages" className="flex flex-wrap gap-2 text-sm">
      {[["403", "/errors/403"], ["404", "/errors/404"], ["500", "/errors/500"], ["Maintenance", "/errors/maintenance"], ["Degraded", "/errors/degraded"], ["WAN down", "/errors/wan-down"]].map(([l, to]) => (
        <Link key={to} to={to} className="text-link underline">
          {l}
        </Link>
      ))}
    </nav>
  )
}

export function Error403Page() {
  const [role] = useRole()
  const [params] = useSearchParams()
  const needs = (params.get("need") ?? "Controller").split(",")
  const screen = params.get("screen") ?? "MM-VAL-001 Account Determination Workbench"
  const [ask, setAsk] = useState(false)
  return (
    <ErrorFrame code="403" icon={<ShieldAlert className="size-6 text-destructive" aria-hidden="true" />} title="You do not have access to this page" route="/errors/403" actions={<Button onClick={() => setAsk(true)}>Request access</Button>}>
      <p className="text-sm">
        You are acting as <strong>{role}</strong>. <strong>{screen}</strong> needs {needs.length > 1 ? "one of the roles" : "the role"} <strong>{needs.join(", ")}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">Access follows the roles your identity provider group maps to. The specification has no role-by-action matrix (ASM-PERM-1), so the role named here is the screen entry's own user list. Releasing the matrix also asks for step-up authentication.</p>
      <DialogShell open={ask} onOpenChange={setAsk} title="Request the role?" consequence={`A request for ${needs.join(" or ")} goes to your manager and Plant IT. Nothing changes until it is approved.`} requireReason reasonLabel="Why do you need it? (required)" confirmLabel="Send request" onConfirm={() => (toast.success("Access request sent"), null)} />
    </ErrorFrame>
  )
}
export function Error404Page() {
  const [q, setQ] = useState("")
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <ErrorFrame code="404" icon={<FileQuestion className="size-6" aria-hidden="true" />} title="This page does not exist" route="/errors/404">
      <p className="text-sm">
        {loc.pathname.startsWith("/errors") ? "The address you followed" : <span className="font-mono">{loc.pathname}</span>} is not in the screen plan, or the record was deleted. Search for what you were looking for.
      </p>
      <form role="search" onSubmit={(e) => (e.preventDefault(), nav(`/search?q=${encodeURIComponent(q)}`))} className="flex gap-2">
        <label htmlFor="e404" className="sr-only">
          Search
        </label>
        <input id="e404" value={q} onChange={(e) => setQ(e.target.value)} placeholder="An id or a name" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" />
        <Button type="submit">Search</Button>
      </form>
    </ErrorFrame>
  )
}
export function Error500Page() {
  const [ref] = useState(() => `ERR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
  const nav = useNavigate()
  return (
    <ErrorFrame code="500" icon={<ServerCrash className="size-6 text-destructive" aria-hidden="true" />} title="Something went wrong on our side" route="/errors/500" actions={<Button onClick={() => nav(0)}>Try again</Button>}>
      <p className="text-sm">The request did not complete. Nothing you entered was saved by this attempt; anything already saved is safe. Postings are atomic: a failed posting leaves no half-written journal.</p>
      <p className="text-sm">
        Reference <span className="font-mono font-semibold">{ref}</span>. Quote it to Plant IT so they can find the trace.
      </p>
      <Button variant="outline" className="self-start" onClick={() => toast.info(`Reference ${ref} copied for the report`)}>
        Report this
      </Button>
    </ErrorFrame>
  )
}
export function MaintenancePage() {
  return (
    <ErrorFrame code="503" icon={<Wrench className="size-6" aria-hidden="true" />} title="Planned maintenance" route="/errors/maintenance">
      <p className="text-sm">
        The system is in a maintenance window until <strong>05:00</strong>. Planned windows are announced in the notification center ahead of time; the times shown are a design value.
      </p>
      <ul className="list-disc pl-4 text-sm">
        <li>Kiosks and handhelds keep scanning: scans queue for up to {THRESHOLDS.offlineQueueHours} h and replay in order.</li>
        <li>Office screens are unavailable until the window ends.</li>
        <li>Scheduled jobs that fall in the window run when it ends; close-critical jobs are rescheduled by the batch framework.</li>
      </ul>
    </ErrorFrame>
  )
}

const DEPS = [
  { id: "tax", name: "Tax engine", works: "Quotes, orders and POs keep saving; tax shows Pending recalculation", stops: "Final tax figures and invoice posting; the recalculation queue retries every 15 minutes" },
  { id: "broker", name: "Message broker", works: "Screens read and edit; direct actions complete", stops: "Cross-module events (for example PGI to billing) wait in the outbox and replay in order" },
  { id: "idp", name: "Identity provider", works: "Sessions already open continue until they end", stops: "New sign-ins and step-up prompts; break-glass accounts are for emergencies only" },
  { id: "printer", name: "Label and document printers", works: "Packing, weighing, HU close; documents render on screen", stops: "Printing; jobs queue and reprint needs a reason" },
] as const
export function DegradedPage() {
  const [down, setDown] = useState<string[]>(["tax"])
  const toggle = (id: string) => setDown((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  return (
    <ErrorFrame code="Degraded" icon={<CloudOff className="size-6" aria-hidden="true" />} title="A dependency is down" route="/errors/degraded">
      <p className="text-sm">One dependency down must not stop the rest of the system. The banner names it, says what still works and says what waits. Toggle a dependency to see its banner.</p>
      <ul className="flex flex-col gap-2">
        {DEPS.map((d) => (
          <li key={d.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <FamilyBadge family={down.includes(d.id) ? "exception" : "done"} label={down.includes(d.id) ? "Degraded" : "Healthy"} size="sm" />
              <span className="font-medium">{d.name}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => toggle(d.id)}>
                {down.includes(d.id) ? "Mark recovered" : "Simulate outage"}
              </Button>
            </div>
            {down.includes(d.id) && <DegradedBanner dependency={d.name.toLowerCase()} works={d.works} stops={d.stops} />}
          </li>
        ))}
      </ul>
      {down.length === 0 && <p role="status" className="text-sm">All dependencies healthy.</p>}
    </ErrorFrame>
  )
}
export function WanDownPage() {
  const [q, setQ] = useState(7)
  const [online, setOnline] = useState(false)
  useEffect(() => {
    if (online) return
    const t = setInterval(() => setQ((x) => Math.min(x + 1, 40)), 1500)
    return () => clearInterval(t)
  }, [online])
  return (
    <ErrorFrame code="WAN" icon={<WifiOff className="size-6" aria-hidden="true" />} title="Wide-area link down: read-only" route="/errors/wan-down" actions={<Button onClick={() => (setOnline(!online), setQ(online ? 7 : 0))}>{online ? "Simulate link down again" : "Simulate reconnect"}</Button>}>
      {online ? (
        <p role="status" className="text-sm">Link restored. The queued scans replayed in order; conflicts, if any, are in the scan exception queue.</p>
      ) : (
        <>
          <OfflineBanner queued={q} />
          <ReadOnlyBanner reason="The plant cannot reach the central system. You can read what is cached; changes that post or approve wait for the link." />
          <ul className="list-disc pl-4 text-sm">
            <li>Works: reading cached documents, scanning at kiosks and handhelds (queued), counting.</li>
            <li>Waits: postings, approvals, step-up prompts and anything that changes another entity.</li>
            <li>Queue holds up to {THRESHOLDS.offlineQueueHours} h of scans; past that, scanning stops and the supervisor is told.</li>
          </ul>
        </>
      )}
    </ErrorFrame>
  )
}

// ====================================================================================== devices
function Frame({ d, src, scale }: { d: (typeof DEVICES)[number]; src: string; scale: number }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border" style={{ width: d.w * scale, height: d.h * scale }}>
        <iframe title={`${d.name} view`} src={src} style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }} />
      </div>
      <figcaption className="text-xs text-muted-foreground">
        {d.name}, {d.size}
      </figcaption>
    </figure>
  )
}
export function DevicesPage() {
  const [id, setId] = useState("tc77")
  const d = DEVICES.find((x) => x.id === id)!
  const src: Record<string, string> = { desktop: "/dashboards/sales", tablet: "/dashboards/sales", tc77: "/shell/devices/tc77", wt6300: "/shell/devices/wt6300", kiosk: "/shell/devices/kiosk" }
  const scale = d.w >= 1000 ? 0.7 : d.w >= 700 ? 0.7 : 1
  return (
    <DetailPage
      header={{ title: "Responsive and device breakpoints", screenId: "FX-SHL-DEVICES", description: "Desktop, tablet, Zebra TC77 (4.7 in), Zebra WT6300 wrist terminal (about 3.2 in, ring scan, no keyboard) and the 15.6 in kiosk at 1280 x 800. Each frame is a live page at its real viewport." }}
      tabs={[
        {
          id: "preview",
          label: "Live previews",
          content: (
            <div className="flex flex-col gap-4">
              <div role="radiogroup" aria-label="Device" className="inline-flex flex-wrap gap-1 self-start rounded-md border p-1 text-sm">
                {DEVICES.map((x) => (
                  <button key={x.id} role="radio" aria-checked={id === x.id} onClick={() => setId(x.id)} className={cn("h-8 rounded-md px-3", id === x.id && "bg-secondary font-semibold")}>
                    {x.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-start gap-6">
                <Frame d={d} src={src[id]} scale={scale} />
                <div className="flex max-w-md flex-col gap-2 text-sm">
                  <p>
                    <strong>{d.mode}</strong>
                  </p>
                  <p>{d.note}</p>
                  <p className="text-xs text-muted-foreground">Source: {d.source}</p>
                  {d.id === "wt6300" && <Chip kind="oq" id="wrist">Wrist-terminal support is an open decision</Chip>}
                  <Chip kind="design" note="Handheld CSS pixel sizes are readings from the screen diagonal and resolution class">Pixel sizes are readings</Chip>
                </div>
              </div>
            </div>
          ),
        },
        {
          id: "rules",
          label: "Rules by device",
          content: (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-table-head text-left">
                  <tr>
                    <th className="p-2">Device</th>
                    <th className="p-2">Targets</th>
                    <th className="p-2">Input</th>
                    <th className="p-2">Layout</th>
                    <th className="p-2">Used at</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Desktop", "32 px controls", "Mouse and keyboard", "Sidebar, fluid content, tables dense", "Office roles"],
                    ["Tablet", "36 px controls", "Touch and keyboard", "Collapsed sidebar, sheets for side panels", "Managers, mobile approvals"],
                    ["TC77", "48 px minimum", "Touch plus built-in imager", "Single column mobile work queue; offline queue banner", "Warehouse moves, counting, putaway (10 units)"],
                    ["WT6300 + RS5100", "48 px, one action per screen", "Ring scan, no keyboard", "One task per screen; scan is the input", "Pickers and kit builders (6 units)"],
                    ["Kiosk 15.6 in", "48 px; 64 px primary", "Touch and badge scan", "1280 x 800, 64 px header, bottom action bar", "Every work center (12), pack, test (15 units)"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t">
                      {r.map((c, i) => (
                        <td key={i} className="p-2">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Unit counts are the Phase 1 device plan (Book V section 8.2). The wedge service delivers scans as events with focus lock (ADR-10).</p>
            </div>
          ),
        },
      ]}
    />
  )
}

// ---- device views (routes with the kiosk layout, shown in the frames above)
const TASKS = [
  { id: "WT-TBD-0412", what: "Putaway 9 x RAW-TBD-BSH145 to B-04-02", state: "Assigned" },
  { id: "WT-TBD-0413", what: "Move 3 x RAW-TBD-OLTC to staging WC-400", state: "Queued" },
  { id: "WT-TBD-0414", what: "Count bin A-03-02", state: "In Progress" },
  { id: "WT-TBD-0415", what: "Return to stock, 2 x RAW-TBD-RAD", state: "Done/Exception" },
]
export function Tc77View() {
  return (
    <div className="light flex min-h-screen flex-col bg-background text-base">
      <header className="flex h-12 items-center gap-2 bg-primary px-3 text-primary-foreground">
        <span className="font-semibold">Warehouse queue</span>
        <span className="ml-auto flex items-center gap-1 text-sm">Online</span>
      </header>
      <main className="flex flex-1 flex-col gap-3 p-3">
        <ScanField scanPoint="SP-04" expected="the item label, then the bin" onScan={(c) => (c.startsWith("B-") ? { ok: true, message: "bin confirmed" } : { ok: false, expected: "a bin like B-04-02", next: "Scan the bin label.", message: "not a bin" })} />
        <ul className="flex flex-col gap-2">
          {TASKS.map((t) => (
            <li key={t.id} className="flex flex-col gap-1 rounded-md border p-3">
              <span className="font-mono text-sm">{t.id}</span>
              <span>{t.what}</span>
              <StatusBadge kind="warehouseTask" status={t.state} size="lg" />
            </li>
          ))}
        </ul>
      </main>
      <footer className="flex flex-col gap-2 border-t p-3">
        <Button className="h-16 text-lg">Confirm putaway</Button>
        <Button variant="outline" className="h-12">
          Report an exception
        </Button>
      </footer>
    </div>
  )
}
export function Wt6300View() {
  return (
    <div className="light flex min-h-screen flex-col gap-2 bg-background p-2 text-base">
      <p className="text-sm font-semibold">Pick 1 of 6</p>
      <p className="text-xl font-semibold">2 x RAW-TBD-BSH145</p>
      <p className="text-sm">Bin A-03-02, batch BAT-TBD-C0412</p>
      <ScanField scanPoint="SP-15" expected="the bin, then the item" label="Ring scan" onScan={(c) => (c.startsWith("A-") ? { ok: true, message: "bin ok" } : { ok: false, expected: "bin A-03-02", next: "Scan the bin.", message: "wrong bin" })} />
      <Button className="h-16 text-lg">Confirm pick</Button>
      <Button variant="outline" className="h-12">
        Short pick
      </Button>
    </div>
  )
}
export function KioskDeviceView() {
  const wc = WORK_CENTERS.find((w) => w.id === "WC-400")!
  return (
    <KioskPage title="Final assembly" screenId="PP-SFT-001" operator="Anna Kowal" station={`${wc.id} ${wc.name}`} exitTo="/shell/devices" scan={<ScanField scanPoint="SP-10" expected="the operation barcode on the traveler" onScan={(c) => (c.includes("OP") ? { ok: true, message: "operation started" } : { ok: false, expected: "an operation barcode like WO-TBD-0377-1|OP40", next: "Scan the traveler operation barcode.", message: "not an operation" })} />} actions={[{ label: "Start operation", primary: true, onClick: () => {} }, { label: "Hold", onClick: () => {} }]}>
      <KioskFact label="Operation 40">Fit HV bushings, 3 per unit</KioskFact>
      <KioskFact label="Order">WO-TBD-0377-1, 20 MVA unit 1</KioskFact>
    </KioskPage>
  )
}
export { Panel, StateStage }
