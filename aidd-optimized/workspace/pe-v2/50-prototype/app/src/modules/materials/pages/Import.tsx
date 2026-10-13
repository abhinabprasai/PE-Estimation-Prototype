// FX-MM-IMPORT: Bulk import templates upload flow [Book II §16.2]. Pick the view, download its
// template, upload the filled file. The file is checked column by column against the current
// template; any difference rejects the whole file with a per-column diff. A matching file creates
// MCRs (new materials) or MCHs (changes to existing ones). The prototype reads CSV with the PRD's
// XLSX columns (RD-MM-33).

import { useRef, useState } from "react"
import { Link } from "react-router"
import { Download, FileUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader, WizardPage } from "@/components/templates"
import { Chip, DataTable, EmptyState, FamilyBadge, RulesPanel, type Column } from "@/components/patterns"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import type { ImportJob } from "../data/ext"
import { runImport, type ImportOutcome } from "../data/import-actions"
import { IMPORT_TEMPLATES, TEMPLATE_VERSION, diffColumns, parseCsv, templateOf, toCsv } from "../lib/import-templates"
import { R } from "../data/state"
import { Reading, Section, userName } from "../components/common"
import { useViewState } from "../components/states"

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function Import() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-IMPORT", { degradedWhat: "The file scanner is slow" })
  const [view, setView] = useState("Planning")
  const [fileName, setFileName] = useState("")
  const [text, setText] = useState("")
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = templateOf(view)!
  const parsed = text ? parseCsv(text) : null
  const preview = parsed && t ? diffColumns(t, parsed.header, parsed.head?.version) : []
  const viewMismatch = parsed?.head && parsed.head.view !== view
  const load = (name: string, body: string) => (setFileName(name), setText(body), setOutcome(null))
  const cols: Column<ImportJob>[] = [
    { id: "id", header: "Job", value: (j) => j.id, mono: true, sortable: true },
    { id: "view", header: "View", value: (j) => j.view, filterable: true },
    { id: "file", header: "File", value: (j) => j.fileName },
    { id: "ver", header: "Template", value: (j) => j.templateVersion, mono: true },
    { id: "on", header: "Uploaded", value: (j) => j.uploadedOn, sortable: true, cell: (j) => fmtDate(j.uploadedOn) },
    { id: "by", header: "By", value: (j) => userName(j.by) },
    { id: "rows", header: "Rows", value: (j) => j.rows, align: "right", mono: true },
    { id: "out", header: "Outcome", value: (j) => j.outcome, filterable: true, cell: (j) => <FamilyBadge family={j.outcome === "Accepted" ? "done" : "exception"} label={j.outcome} size="sm" title="Import outcome; no status list in the PRD" /> },
    {
      id: "made", header: "Created", value: (j) => j.created.length,
      cell: (j) => (j.outcome === "Rejected" ? <span className="text-muted-foreground">{j.diffs.length} column difference(s)</span> : <span>{j.created.map((c) => <Link key={c.id} to={c.kind === "MCR" ? `/materials/creation-requests/${c.id}` : R.mchDoc(c.id)} className="mr-2 font-mono text-link underline-offset-4 hover:underline">{c.id}</Link>)}{j.rowErrors > 0 && <span className="text-xs text-muted-foreground">{j.rowErrors} row(s) skipped</span>}</span>),
    },
  ]
  const history = (
    <div className="mt-8 flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Import history</h2>
      <DataTable
        rows={st.empty ? [] : s.x.imports}
        columns={cols}
        rowId={(j) => j.id}
        loading={st.loading}
        error={st.error}
        onRetry={st.onRetry}
        toolbar={st.toolbar}
        densityKey="FX-MM-IMPORT"
        empty={{ title: "No import yet", body: "Upload a filled template to start." }}
        initialSort={{ id: "on", dir: "desc" }}
      />
    </div>
  )
  const rules = (
    <RulesPanel
      rules={[
        ["§16.2", "One XLSX template per view, versioned. Upload compares columns with the current template; any column difference rejects the file with a per-column diff.", "[Book II §16.2]"],
        ["§16.2 result", "A matching file creates MCRs for new materials and MCHs for changes to existing ones, so every imported row goes through the same approval as a hand-entered one.", "[Book II §16.2]"],
        ["C-47", "Materials are created only through an MCR; an import never writes a material directly.", "erd-sketch C-47"],
      ]}
    />
  )

  if (outcome) {
    const j = outcome.job
    return (
      <>
        <div className="flex flex-col gap-4">
          <PageHeader screenId="FX-MM-IMPORT" title={`Import ${j.id}`} description={`${j.fileName} · ${j.view} template ${j.templateVersion} · ${j.rows} row(s)`} chips={<FamilyBadge family={j.outcome === "Accepted" ? "done" : "exception"} label={j.outcome} />} primary={<Button onClick={() => (setOutcome(null), setText(""), setFileName(""))}>Import another file</Button>} />
          {j.outcome === "Rejected" ? (
            <Section title="File rejected: column differences">
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Column</TableHead><TableHead>Difference</TableHead></TableRow></TableHeader>
                <TableBody>{j.diffs.map((d, n) => <TableRow key={n}><TableCell className="font-mono">{d.column}</TableCell><TableCell>{d.issue}</TableCell></TableRow>)}</TableBody>
              </Table>
              <p className="text-sm">Nothing was created. Download the current template, copy your rows into it and upload again.</p>
            </Section>
          ) : (
            <Section title="Created from this file">
              <ul className="flex flex-col gap-1 text-sm">
                {j.created.map((c) => (
                  <li key={c.id}>
                    {c.kind === "MCR" ? "Material creation request" : "Material change request"}{" "}
                    <Link to={c.kind === "MCR" ? `/materials/creation-requests/${c.id}` : R.mchDoc(c.id)} className="font-mono text-link underline-offset-4 hover:underline">{c.id}</Link>
                  </li>
                ))}
              </ul>
              {outcome.errors.length > 0 && (
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">{outcome.errors.length} row(s) skipped</p>
                  <ul className="list-disc pl-6">{outcome.errors.map((e, n) => <li key={n}>{e}</li>)}</ul>
                </div>
              )}
            </Section>
          )}
        </div>
        {history}
        {rules}
      </>
    )
  }

  return (
    <>
      {st.banners}
      <WizardPage
        header={{ screenId: "FX-MM-IMPORT", title: "Bulk import", description: "Upload a filled template: it is checked column by column, then creates creation requests or change requests.", chips: <Reading id="RD-MM-33" />, actions: <Link to="/materials/change-register" className="text-sm text-link underline-offset-4 hover:underline">Change register</Link> }}
        finishLabel="Import file"
        consequence={
          t.mode === "new"
            ? `Each valid row of ${fileName || "the file"} opens a Material Creation Request; rows that fail a rule are skipped and listed.`
            : `Each changed column of ${fileName || "the file"} opens one Material Change Request (${t.view}); rows that fail a rule are skipped and listed. Nothing is applied until the change is approved.`
        }
        onFinish={() => {
          if (!st.canWrite) return st.blockedWhy ?? "Blocked"
          if (!parsed) return "Choose a file."
          const r = runImport({ view, fileName, version: parsed.head?.version, header: parsed.header, rows: parsed.rows })
          if (!r.ok) return r.error
          setOutcome(r.value)
          toast[r.value.job.outcome === "Accepted" ? "success" : "error"](r.value.job.outcome === "Accepted" ? `${r.value.job.id}: ${r.value.job.created.length} request(s) created` : `${r.value.job.id}: file rejected, ${r.value.job.diffs.length} column difference(s)`)
          return null
        }}
        steps={[
          {
            id: "template",
            title: "Template",
            content: (
              <div className="flex max-w-xl flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="imp-view">View</Label>
                  <Select value={view} onValueChange={(v) => (setView(v), setText(""), setFileName(""))}>
                    <SelectTrigger id="imp-view"><SelectValue /></SelectTrigger>
                    <SelectContent>{IMPORT_TEMPLATES.map((x) => <SelectItem key={x.view} value={x.view}>{x.view}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-sm">{t.note}</p>
                <p className="text-sm">
                  Current template <span className="font-mono">{TEMPLATE_VERSION}</span> columns: <span className="font-mono">{t.columns.join(", ")}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => download(`${t.view.toLowerCase().replace(/\W+/g, "-")}-template-${TEMPLATE_VERSION}.csv`, toCsv(t))}>
                    <Download aria-hidden="true" /> Download empty template
                  </Button>
                  <Button variant="outline" onClick={() => download(`${t.view.toLowerCase().replace(/\W+/g, "-")}-sample-${TEMPLATE_VERSION}.csv`, toCsv(t, t.sample))}>
                    <Download aria-hidden="true" /> Download with sample rows
                  </Button>
                </div>
              </div>
            ),
          },
          {
            id: "upload",
            title: "Upload",
            validate: () => (!parsed ? "Choose a file, or use one of the sample files, to continue." : viewMismatch ? `This file is a ${parsed.head!.view} template; you chose ${view}.` : null),
            content: (
              <div className="flex max-w-3xl flex-col gap-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Choose the filled template file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (f) load(f.name, await f.text())
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <FileUp aria-hidden="true" /> Choose file
                  </Button>
                  <Button variant="ghost" onClick={() => load(`${t.view.toLowerCase()}-load.csv`, toCsv(t, t.sample))}>Use a matching sample</Button>
                  <Button variant="ghost" onClick={() => load(`${t.view.toLowerCase()}-old-v2.csv`, [`# template: ${t.view} v2`, [...t.columns.slice(0, -1), "Legacy code"].join(","), "x"].join("\n"))}>Use an outdated v2 sample</Button>
                </div>
                {!parsed ? (
                  <EmptyState title="No file chosen">Choose the filled template for {view}. Only .csv files with the template's columns are accepted.</EmptyState>
                ) : (
                  <Section title={`${fileName}: ${parsed.rows.length} data row(s)`}>
                    {preview.length > 0 ? (
                      <div role="alert" className="flex flex-col gap-1 text-sm">
                        <p className="font-medium text-destructive">Column check failed: the file will be rejected ({preview.length} difference(s))</p>
                        <ul className="list-disc pl-6">{preview.map((d, n) => <li key={n}><span className="font-mono">{d.column}</span>: {d.issue}</li>)}</ul>
                      </div>
                    ) : viewMismatch ? (
                      <p role="alert" className="text-sm text-destructive">This file is a {parsed.head!.view} template; you chose {view}.</p>
                    ) : (
                      <p className="text-sm">Columns match template {TEMPLATE_VERSION}. <Chip kind="design">Row rules run at import</Chip></p>
                    )}
                  </Section>
                )}
                {st.validation && !parsed && <p className="text-xs text-destructive">Choose a file to continue.</p>}
              </div>
            ),
          },
          {
            id: "check",
            title: "Check and import",
            content: (
              <div className="flex max-w-3xl flex-col gap-3 text-sm">
                <p>
                  File <span className="font-mono">{fileName}</span> · view {view} · {parsed?.rows.length ?? 0} data row(s).
                </p>
                {preview.length > 0 ? (
                  <p className="text-destructive">The column check failed. Importing records a rejected job with the column diff; nothing is created.</p>
                ) : (
                  <p>The column check passed. Each row is validated against the field rules (V-MM-07, V-MM-02 and the type matrix); failing rows are skipped and named.</p>
                )}
              </div>
            ),
          },
        ]}
      />
      {history}
      {rules}
    </>
  )
}
