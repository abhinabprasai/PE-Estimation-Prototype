// Office page templates, one per PRD archetype [DOC:pp.289-293 §1-2] (asserted).
// Density per archetype from layout.md section 2: List / Workbench / Config office-dense with the
// per-user switch; Detail / Wizard / Dashboard office-comfortable; Dialog inherits.
// Every template takes plain props and slots; none reads the store, so a module composes it with
// its own data. Kiosk and Dialog templates are in kiosk.tsx and dialog.tsx.

import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DataTable, type DataTableProps } from "@/components/patterns/DataTable"
import { DocumentFlowPanel } from "@/components/patterns/DocumentFlowPanel"
import { LifecycleStrip, StatusBadge } from "@/components/patterns/status"
import { Chip } from "@/components/patterns/chips"
import { isTerminal, type DocRef, type RecordKind } from "@/data/domain"
import { PageHeader, type PageHeaderProps } from "./PageHeader"
import { cn } from "@/lib/utils"

// ============================================================================ List
/** List: a filterable register. Header + DataTable (+ optional filters slot above the table). */
export function ListPage<R>({ header, table, above, below }: { header: PageHeaderProps; table: DataTableProps<R>; above?: ReactNode; below?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader {...header} />
      {above}
      <DataTable densityKey={header.screenId} {...table} />
      {below}
    </div>
  )
}

// ============================================================================ Detail
export interface DetailTab {
  id: string
  label: string
  content: ReactNode
  /** Count badge on the tab ("Lines 3"). */
  count?: number
}
export interface DetailPageProps {
  header: Omit<PageHeaderProps, "chips"> & { chips?: ReactNode }
  /** Record kind + status: renders the StatusBadge and LifecycleStrip (C-55). */
  status?: { kind: RecordKind; value: string }
  /** The document this page shows: renders the document-flow panel. */
  doc?: DocRef
  /** Key facts above the tabs (use <KV> inside a <dl>). */
  summary?: ReactNode
  tabs: DetailTab[]
  defaultTab?: string
  /** Extra panel in the right column above the document flow (audit, attachments). */
  aside?: ReactNode
}

/** Detail: tabbed record. Status badge + lifecycle strip in the header; terminal records are marked
 *  read-only (C-55); document flow sits in a right column on wide screens and as a tab on narrow ones. */
export function DetailPage({ header, status, doc, summary, tabs, defaultTab, aside }: DetailPageProps) {
  const terminal = status ? isTerminal(status.kind, status.value) : false
  const allTabs: DetailTab[] = doc ? [...tabs, { id: "__flow", label: "Document flow", content: <DocumentFlowPanel doc={doc} /> }] : tabs
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        {...header}
        chips={
          <>
            {status && <StatusBadge kind={status.kind} status={status.value} />}
            {terminal && <Chip kind="design" note="Terminal status: the record opens read-only (C-55)">Read-only</Chip>}
            {header.chips}
          </>
        }
      >
        {status && <LifecycleStrip kind={status.kind} status={status.value} />}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {summary && <dl className="grid max-w-[960px] grid-cols-2 gap-4 md:grid-cols-4">{summary}</dl>}
          <Tabs defaultValue={defaultTab ?? allTabs[0]?.id}>
            <TabsList>
              {allTabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className={cn(t.id === "__flow" && "xl:hidden")}>
                  {t.label}
                  {t.count != null && <span className="tabular ml-1 text-xs text-muted-foreground">{t.count}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
            {allTabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="pt-4">
                {t.content}
              </TabsContent>
            ))}
          </Tabs>
        </div>
        {(doc || aside) && (
          <aside className="hidden flex-col gap-4 xl:flex">
            {aside}
            {doc && <DocumentFlowPanel doc={doc} />}
          </aside>
        )}
      </div>
    </div>
  )
}

// ============================================================================ Workbench
export interface WorkbenchQueue {
  id: string
  label: string
  count?: number
}
/** Workbench: act-on-many queue. KPI strip, queue tabs, selectable table, bulk-action bar, and a
 *  side panel for the active row (right Sheet; never a third fixed column under 1280 px). */
export function WorkbenchPage<R>({
  header,
  kpis,
  queues,
  queue,
  onQueueChange,
  table,
  bulkActions,
  panel,
}: {
  header: PageHeaderProps
  kpis?: { label: string; value: ReactNode; hint?: string }[]
  queues?: WorkbenchQueue[]
  queue?: string
  onQueueChange?: (id: string) => void
  table: DataTableProps<R>
  /** Rendered when rows are selected; receives the selected ids. */
  bulkActions?: (selected: string[], clear: () => void) => ReactNode
  /** Side panel content for the active row; `open` controlled by the page. */
  panel?: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; content: ReactNode }
}) {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader {...header} />
      {kpis && (
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">{k.label}</dt>
              <dd className="tabular text-2xl font-semibold">{k.value}</dd>
              {k.hint && <dd className="text-xs text-muted-foreground">{k.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
      {queues && (
        <div role="tablist" aria-label="Queues" className="flex flex-wrap gap-1 border-b">
          {queues.map((q) => (
            <button
              key={q.id}
              role="tab"
              aria-selected={queue === q.id}
              onClick={() => onQueueChange?.(q.id)}
              className={cn("h-8 border-b-2 px-3 text-sm", queue === q.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}
            >
              {q.label}
              {q.count != null && <span className="tabular ml-1 text-xs">{q.count}</span>}
            </button>
          ))}
        </div>
      )}
      {bulkActions && selected.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          {bulkActions(selected, () => setSelected([]))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        </div>
      )}
      <DataTable densityKey={header.screenId} selectable={!!bulkActions} selected={selected} onSelectedChange={setSelected} {...table} />
      {panel && (
        <Sheet open={panel.open} onOpenChange={panel.onOpenChange}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{panel.title}</SheetTitle>
              {panel.description && <SheetDescription>{panel.description}</SheetDescription>}
            </SheetHeader>
            <div className="px-4 pb-4">{panel.content}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ============================================================================ Wizard
export interface WizardStep {
  id: string
  title: string
  content: ReactNode
  /** Return an error message to block Next, or null to continue. */
  validate?: () => string | null
}
/** Wizard: guided steps with a stepper, Back / Next, and a Finish that names its consequence
 *  before it runs (critique pattern for actions that post, end a record or fire a milestone). */
export function WizardPage({
  header,
  steps,
  finishLabel,
  consequence,
  onFinish,
  onCancel,
}: {
  header: PageHeaderProps
  steps: WizardStep[]
  finishLabel: string
  /** What Finish will do, in one sentence, shown on the last step. */
  consequence: ReactNode
  onFinish: () => string | null
  onCancel?: () => void
}) {
  const [i, setI] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const step = steps[i]
  const last = i === steps.length - 1
  const next = () => {
    const e = step.validate?.() ?? null
    setError(e)
    if (e) return
    if (last) {
      const r = onFinish()
      setError(r)
    } else setI(i + 1)
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader {...header} />
      <ol aria-label="Steps" className="flex flex-wrap gap-2">
        {steps.map((s, n) => (
          <li key={s.id} aria-current={n === i ? "step" : undefined} className={cn("flex h-8 items-center gap-2 rounded-md border px-3 text-sm", n === i ? "border-primary font-semibold" : n < i ? "text-muted-foreground" : "text-muted-foreground")}>
            <span className="tabular flex size-5 items-center justify-center rounded-full border text-xs">{n < i ? <Check className="size-3" aria-hidden="true" /> : n + 1}</span>
            {s.title}
          </li>
        ))}
      </ol>
      <section aria-label={step.title} className="max-w-[960px] rounded-lg border p-6">
        <h2 className="mb-4 text-base font-semibold">
          Step {i + 1} of {steps.length}: {step.title}
        </h2>
        {step.content}
      </section>
      {last && <p className="max-w-[960px] rounded-md bg-muted px-4 py-2 text-sm">{consequence}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex max-w-[960px] gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="outline" className="ml-auto" disabled={i === 0} onClick={() => (setError(null), setI(i - 1))}>
          <ChevronLeft aria-hidden="true" /> Back
        </Button>
        <Button onClick={next}>
          {last ? finishLabel : "Next"} {!last && <ChevronRight aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}

// ============================================================================ Dashboard
/** Dashboard: landing page read at a glance. KPI tiles, then worklist cards and chart slots. */
export function DashboardPage({
  header,
  tiles,
  children,
}: {
  header: PageHeaderProps
  tiles?: { label: string; value: ReactNode; hint?: string; to?: string; tone?: "default" | "attention" }[]
  /** Worklist cards and charts; wrap each in <DashboardCard>. */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader {...header} />
      {tiles && (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-lg border p-4", t.tone === "attention" && "border-status-exception")}>
              <dt className="text-sm text-muted-foreground">{t.label}</dt>
              <dd className="tabular text-3xl font-semibold">{t.to ? <Link to={t.to} className="text-link underline-offset-4 hover:underline">{t.value}</Link> : t.value}</dd>
              {t.hint && <dd className="text-xs text-muted-foreground">{t.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </div>
  )
}
export function DashboardCard({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-2 rounded-lg border p-4", className)}>
      <h2 className="flex items-center justify-between text-sm font-semibold">
        {title}
        {action}
      </h2>
      {children}
    </section>
  )
}

// ============================================================================ Config
/** Config: admin tables of codes and settings, office-dense. Section nav on the left; effective-dated
 *  records are never edited in place (C-50) and master data shows no period warnings (C-44). */
export function ConfigPage({
  header,
  sections,
  section,
  onSectionChange,
  children,
  effectiveDated,
}: {
  header: PageHeaderProps
  sections?: { id: string; label: string }[]
  section?: string
  onSectionChange?: (id: string) => void
  children: ReactNode
  /** Show the "changes create a new dated version" note. */
  effectiveDated?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader {...header} />
      {effectiveDated && (
        <p className="text-sm text-muted-foreground">Changes create a new dated version; history stays visible (C-50). Released configuration may need an approval through WF-INBOX.</p>
      )}
      <div className={cn("grid gap-6", sections && "md:grid-cols-[200px_minmax(0,1fr)]")}>
        {sections && (
          <nav aria-label="Configuration sections">
            <ul className="flex flex-col gap-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onSectionChange?.(s.id)}
                    aria-current={section === s.id ? "page" : undefined}
                    className={cn("h-8 w-full rounded-md px-2 text-left text-sm", section === s.id ? "bg-secondary font-semibold text-secondary-foreground" : "hover:bg-accent")}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
