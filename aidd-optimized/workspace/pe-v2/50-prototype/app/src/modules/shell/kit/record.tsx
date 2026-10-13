// Record-level components: entity context bar, audit trail, attachment panel, readiness chips,
// completeness bar, tax-status badges and override dialog, exception worklist card.
import { useRef, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { Camera, Check, FileText, Paperclip, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Chip, FamilyBadge, StatusBadge } from "@/components/patterns"
import { DialogShell } from "@/components/templates"
import { ROLE_GROUPS, type Family, type RecordKind } from "@/data/domain"
import { LEGAL_ENTITIES, MATERIALS } from "@/data/shared"
import { fmtMoney } from "@/lib/format"
import { useRole } from "@/store"
import { cn } from "@/lib/utils"

export function Panel({ title, children, actions, className }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-2 rounded-lg border p-4", className)}>
      <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {actions}
      </h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------------- entity context bar
export interface ContextBarProps {
  entityId?: string
  recordType: string
  recordId: string
  title?: string
  status?: { kind: RecordKind; value: string }
  owner?: string
  period?: string
  flags?: ReactNode
}
/** Entity context bar: legal entity, record, status, owner and open period at the top of a record. */
export function EntityContextBar({ entityId = "LE-TBD-10", recordType, recordId, title, status, owner, period = "2026-10", flags }: ContextBarProps) {
  const le = LEGAL_ENTITIES.find((e) => e.id === entityId)
  return (
    <div role="group" aria-label="Entity context" className="flex min-h-12 flex-wrap items-center gap-4 rounded-md bg-primary px-4 py-2 text-primary-foreground">
      <span className="text-sm">
        <span className="opacity-90">Entity</span> <strong>{le?.name ?? entityId}</strong> <span className="font-mono text-xs opacity-90">{entityId}</span>
      </span>
      <span className="text-sm">
        {recordType} <span className="tabular font-mono font-semibold">{recordId}</span>
        {title && <span className="opacity-90"> · {title}</span>}
      </span>
      {status && (
        <span className="rounded-md bg-background px-1 text-foreground">
          <StatusBadge kind={status.kind} status={status.value} size="sm" />
        </span>
      )}
      {flags}
      <span className="ml-auto text-xs opacity-90">
        {owner && <>Owner {owner} · </>}Open period {period}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------------- audit trail
export interface AuditEntry {
  at: string
  user: string
  role: string
  action: string
  channel?: "In-app" | "Email" | "Mobile" | "Kiosk" | "System"
  comment?: string
  /** Reopened posting tag (period reopen window). */
  tag?: string
}
export const SAMPLE_AUDIT: AuditEntry[] = [
  { at: "2026-10-09 08:14", user: "Dana Whitfield", role: "Sales rep", action: "Submitted for approval", channel: "In-app" },
  { at: "2026-10-09 08:31", user: "Graham Stout", role: "Sales Director", action: "Approved", channel: "Email", comment: "Signed-link action, step 1 of 1" },
  { at: "2026-10-09 09:02", user: "System", role: "System", action: "Credit check passed", channel: "System", comment: "Exposure within limit" },
  { at: "2026-10-09 09:40", user: "Marco Reyes", role: "Sales admin", action: "Changed requested date 2027-03-22 to 2027-03-15", channel: "In-app" },
  { at: "2026-10-09 10:05", user: "Victor Lindqvist", role: "Controller", action: "Posting in reopened period", channel: "In-app", tag: "Reopened Posting" },
]
/** Immutable activity trail: append-only, no edit or delete controls exist (ACC section 2). */
export function AuditTrail({ entries = SAMPLE_AUDIT }: { entries?: AuditEntry[] }) {
  const [q, setQ] = useState("")
  const shown = entries.filter((e) => `${e.user} ${e.action} ${e.comment ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Panel title="Activity" actions={<Chip kind="design" note="Append-only; no edit or delete exists">Immutable</Chip>}>
      <Input aria-label="Filter activity" placeholder="Filter by user or action" value={q} onChange={(e) => setQ(e.target.value)} className="h-8" />
      <ol className="flex flex-col gap-2">
        {shown.length === 0 && <li className="text-sm text-muted-foreground">No activity matches.</li>}
        {shown.map((e, i) => (
          <li key={i} className="border-l-2 pl-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular font-mono text-xs text-muted-foreground">{e.at}</span>
              <strong>{e.user}</strong>
              <span className="text-xs text-muted-foreground">{e.role}</span>
              {e.channel && <span className="rounded border px-1 text-xs">{e.channel}</span>}
              {e.tag && <Chip kind="flag">{e.tag}</Chip>}
            </div>
            <p>{e.action}</p>
            {e.comment && <p className="text-xs text-muted-foreground">{e.comment}</p>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">Every action records user, timestamp, channel and comment. Approval history renders here too (W.1).</p>
    </Panel>
  )
}

// ---------------------------------------------------------------------------------- attachment panel
export interface Attachment {
  name: string
  size: string
  by: string
  on: string
  sha: string
  photo?: boolean
}
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, "0") + (Math.imul(h, 2654435761) >>> 0).toString(16).padStart(8, "0")
}
export function AttachmentPanel({ initial, photoCapture = true, readOnly }: { initial?: Attachment[]; photoCapture?: boolean; readOnly?: boolean }) {
  const [files, setFiles] = useState<Attachment[]>(
    initial ?? [
      { name: "GA-drawing-revC.pdf", size: "2.4 MB", by: "Paul Leblanc", on: "2026-02-27", sha: hash("GA-drawing-revC.pdf") },
      { name: "customer-PO-MP-4471.pdf", size: "310 KB", by: "Dana Whitfield", on: "2026-06-12", sha: hash("customer-PO-MP-4471.pdf") },
    ],
  )
  const input = useRef<HTMLInputElement>(null)
  const add = (name: string, size: string, photo?: boolean) => setFiles((f) => [{ name, size, by: "You", on: "2026-10-09", sha: hash(name + f.length), photo }, ...f])
  return (
    <Panel title="Attachments" actions={<span className="tabular text-xs text-muted-foreground">{files.length} files</span>}>
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.name + f.sha} className="flex flex-wrap items-center gap-2 text-sm">
            {f.photo ? <Camera className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
            <span className="font-medium">{f.name}</span>
            <span className="text-xs text-muted-foreground">
              {f.size} · {f.by} · {f.on}
            </span>
            <span title="SHA-256, recorded at upload" className="tabular ml-auto font-mono text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline size-3" aria-hidden="true" />
              {f.sha.slice(0, 12)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Each file carries a checksum recorded at upload. Released document files are write-once.</p>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" className="sr-only" aria-label="Choose a file" onChange={(e) => e.target.files?.[0] && add(e.target.files[0].name, `${Math.max(1, Math.round(e.target.files[0].size / 1024))} KB`)} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <Paperclip aria-hidden="true" /> Add file
          </Button>
          {photoCapture && (
            <Button variant="outline" size="sm" onClick={() => add(`photo-${files.length + 1}.jpg`, "1.8 MB", true)}>
              <Camera aria-hidden="true" /> Take photo
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------------- readiness chips
export type Readiness = "Ready" | "Partial" | "Blocked" | "Not checked"
const READY_FAMILY: Record<Readiness, Family> = { Ready: "done", Partial: "pending", Blocked: "blocked", "Not checked": "draft" }
export interface ReadyItem {
  key: "Supply" | "Credit" | "Quality" | "Docs"
  state: Readiness
  evidence: { label: string; value: string; ok?: boolean }[]
  link?: string
}
export const READINESS_SAMPLE: Record<string, ReadyItem[]> = {
  "Sales order": [
    { key: "Supply", state: "Partial", evidence: [{ label: "Line 10 ATP", value: "2 of 3 units confirmed", ok: false }, { label: "PO-TBD-0377", value: "In Approval", ok: false }], link: "/sales/orders/SO-2026-00377" },
    { key: "Credit", state: "Ready", evidence: [{ label: "Exposure", value: "$1,920,000 of $5,000,000", ok: true }, { label: "Credit Hold", value: "none", ok: true }] },
    { key: "Quality", state: "Not checked", evidence: [{ label: "Final test", value: "Not yet planned" }] },
    { key: "Docs", state: "Ready", evidence: [{ label: "Customer drawings", value: "Approved as noted (TR-TBD-0301)", ok: true }] },
  ],
  Delivery: [
    { key: "Supply", state: "Ready", evidence: [{ label: "Picked", value: "all HU lines", ok: true }] },
    { key: "Credit", state: "Blocked", evidence: [{ label: "Credit gate (SP-18)", value: "Credit Hold flag on customer", ok: false }] },
    { key: "Quality", state: "Ready", evidence: [{ label: "Pre-shipment inspection", value: "Passed", ok: true }] },
    { key: "Docs", state: "Partial", evidence: [{ label: "CoC", value: "Draft", ok: false }, { label: "Packing list", value: "Draft watermark until pack order complete", ok: false }] },
  ],
  "WO release": [
    { key: "Supply", state: "Blocked", evidence: [{ label: "HV bushing 145 kV", value: "Batch BAT-TBD-B0301 Blocked (recall)", ok: false }] },
    { key: "Credit", state: "Ready", evidence: [{ label: "Order", value: "Confirmed", ok: true }] },
    { key: "Quality", state: "Ready", evidence: [{ label: "Calibration", value: "All instruments In Cal", ok: true }] },
    { key: "Docs", state: "Ready", evidence: [{ label: "Production version", value: "PV-TBD-0301 Released", ok: true }] },
  ],
}
export function ReadinessChips({ items }: { items: ReadyItem[] }) {
  return (
    <ul aria-label="Readiness" className="flex flex-wrap gap-2">
      {items.map((it) => (
        <li key={it.key}>
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded-lg" aria-label={`${it.key}: ${it.state}. Show evidence`}>
                <FamilyBadge family={READY_FAMILY[it.state]} label={`${it.key}: ${it.state}`} size="md" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm">
              <p className="mb-2 font-semibold">{it.key} evidence</p>
              <dl className="flex flex-col gap-1">
                {it.evidence.map((e) => (
                  <div key={e.label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{e.label}</dt>
                    <dd className="flex items-center gap-1 text-right">
                      {e.ok != null && (e.ok ? <Check className="size-3" aria-label="ok" /> : <span aria-label="not ok">!</span>)}
                      {e.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {it.link && (
                <Link to={it.link} className="mt-2 inline-block text-link underline">
                  Open the source document
                </Link>
              )}
            </PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------------- completeness
export const FUNCTION_BLOCKS = ["Purchasing Block", "Sales Block", "Production Block", "Shipping Block", "Posting Block"] as const
const VIEWS = ["Basic", "Purchasing", "Sales", "Production", "Shipping", "Accounting"] as const
/** Completeness per view from the seed fields. A design computation: the specification names the bar, not the weights. */
export function completenessOf(id: string) {
  const m = MATERIALS.find((x) => x.id === id)
  if (!m) return { pct: 0, views: [] as { view: string; done: boolean }[] }
  const done: Record<(typeof VIEWS)[number], boolean> = {
    Basic: !!m.description && !!m.baseUom && m.groups.length > 0,
    Purchasing: m.type === "FIN" || m.stdCost != null,
    Sales: m.listPrice != null || m.type !== "FIN",
    Production: m.type === "RAW" || m.type === "TRADE" || m.serialProfileId != null,
    Shipping: m.batchFlag || m.type !== "FIN",
    Accounting: !!m.valuationClass && m.stdCost != null,
  }
  const views = VIEWS.map((v) => ({ view: v, done: done[v] }))
  return { pct: Math.round((views.filter((v) => v.done).length / views.length) * 100), views }
}
export function CompletenessBar({ materialId, blocks = [] }: { materialId: string; blocks?: (typeof FUNCTION_BLOCKS)[number][] }) {
  const c = completenessOf(materialId)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Progress value={c.pct} aria-label={`Completeness ${c.pct} percent`} className="max-w-xs" />
        <span className="tabular text-sm font-semibold">{c.pct}%</span>
        <Chip kind="design" note="Weights are not in the specification">Equal weight per view</Chip>
      </div>
      <ul aria-label="Views" className="flex flex-wrap gap-1 text-xs">
        {c.views.map((v) => (
          <li key={v.view} className={cn("rounded border px-2 py-0.5", v.done ? "border-status-passed text-status-passed-ink" : "border-status-pending text-status-pending-ink")}>
            {v.done ? "Done" : "Open"}: {v.view}
          </li>
        ))}
      </ul>
      <ul aria-label="Function-specific blocks" className="flex flex-wrap gap-1">
        {blocks.length === 0 && <li className="text-xs text-muted-foreground">No function-specific block</li>}
        {blocks.map((b) => (
          <li key={b}>
            <Chip kind="block">{b}</Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------------- tax override
export type TaxStatus = "Override" | "Pending recalculation" | "Recalculated"
const TAX_FAMILY: Record<TaxStatus, Family> = { Override: "exception", "Pending recalculation": "pending", Recalculated: "done" }
export const TaxBadge = ({ status }: { status: TaxStatus }) => <FamilyBadge family={TAX_FAMILY[status]} label={status} size="sm" />
export const FINANCE_ROLES: string[] = [...ROLE_GROUPS.Finance]
export interface TaxLine {
  id: string
  doc: string
  item: string
  base: number
  rate: number
  status: TaxStatus
  reason?: string
}
export const TAX_LINES: TaxLine[] = [
  { id: "q1", doc: "Quotation QT-TBD-0412-V2 line 10", item: "FIN-TBD-2500PM", base: 78400, rate: 0.0725, status: "Recalculated" },
  { id: "s1", doc: "Sales order SO-2026-00377 line 10", item: "FIN-TBD-20MVA", base: 3852000, rate: 0.0, status: "Pending recalculation" },
  { id: "p1", doc: "Purchase order PO-TBD-0377 line 10", item: "RAW-TBD-CRGO23", base: 207900, rate: 0.05, status: "Override", reason: "Exemption certificate on file" },
]
export function TaxOverrideDialog({ line, open, onOpenChange, onApply }: { line: TaxLine; open: boolean; onOpenChange: (o: boolean) => void; onApply: (rate: number, reason: string) => void }) {
  const [role] = useRole()
  const [rate, setRate] = useState(String((line.rate * 100).toFixed(2)))
  const allowed = FINANCE_ROLES.includes(role)
  const n = Number(rate)
  const bad = rate.trim() === "" || Number.isNaN(n) || n < 0 || n > 20
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Override tax on this line"
      description={`${line.doc}. System tax ${(line.rate * 100).toFixed(2)}% on ${fmtMoney(line.base)}.`}
      consequence={`Sets the line to Override with your reason on the audit trail. The tax engine will not recalculate this line until you clear the override.`}
      requireReason
      reasonLabel="Reason for the override (required)"
      confirmLabel="Apply override"
      confirmDisabled={!allowed}
      secondary={<Chip kind="oq" id="tax-override role" note="Feature list says Finance-only; the PRD role matrix is absent">Finance-only: reading</Chip>}
      onConfirm={(reason) => {
        if (!allowed) return `Only Finance roles may override tax. You are acting as ${role}.`
        if (bad) return "Enter a tax rate between 0 and 20 percent."
        onApply(n / 100, reason)
        return null
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="tax-rate">Override rate (%)</Label>
        <Input id="tax-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-invalid={bad} className="max-w-32" />
        {bad && <p className="text-xs text-destructive">Enter a tax rate between 0 and 20 percent.</p>}
        {!allowed && (
          <p role="alert" className="text-sm text-destructive">
            This control is for Finance roles ({FINANCE_ROLES.join(", ")}). You are acting as {role}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Tax after override: {fmtMoney(line.base * (bad ? line.rate : n / 100))}</p>
      </div>
    </DialogShell>
  )
}

// ---------------------------------------------------------------------------------- exception card
export interface AgingBand {
  label: string
  count: number
  tone: "fresh" | "aging" | "breach"
}
const TONE: Record<AgingBand["tone"], string> = { fresh: "border-status-passed text-status-passed-ink", aging: "border-status-pending text-status-pending-ink", breach: "border-status-blocked text-status-cancelled-ink" }
const TONE_WORD: Record<AgingBand["tone"], string> = { fresh: "Within SLA", aging: "Near SLA", breach: "SLA breached" }
export function ExceptionCard({ title, code, count, bands, owner, action, onAction, pills, to }: { title: string; code: string; count: number; bands: AgingBand[]; owner: string; action: string; onAction?: () => void; pills?: { label: string; value: string }[]; to?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>
          {title} <span className="font-mono text-xs text-muted-foreground">{code}</span>
        </span>
        <span className="tabular text-2xl">{count}</span>
      </h3>
      <ul aria-label="Aging" className="flex flex-wrap gap-1">
        {bands.map((b) => (
          <li key={b.label} className={cn("rounded-lg border px-2 py-0.5 text-xs", TONE[b.tone])}>
            {b.label}: <span className="tabular font-semibold">{b.count}</span> ({TONE_WORD[b.tone]})
          </li>
        ))}
      </ul>
      {pills && (
        <ul aria-label="Quick stats" className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          {pills.map((p) => (
            <li key={p.label} className="rounded-full bg-muted px-2 py-0.5">
              {p.label} {p.value}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Owner: <span className="text-foreground">{owner}</span>
        {to ? (
          <Button asChild size="sm" className="ml-auto">
            <Link to={to}>{action}</Link>
          </Button>
        ) : (
          <Button size="sm" className="ml-auto" onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </section>
  )
}
