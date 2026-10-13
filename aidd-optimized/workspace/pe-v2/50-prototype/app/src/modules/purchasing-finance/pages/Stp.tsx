// FX-PUR-STP Supplier Technical Package view (/purchasing/stp, /purchasing/stp/:id); source Book IV §3.3 [DOC:p.209]:
// STP-{SEQ:6}, drawing and spec revisions frozen as a package with a SHA-256 manifest, vendor acknowledgement per version
// (S-19: Acknowledged / Exception / Rejected), a superseded version cannot attach to a new document (E-DTS-03, C-22),
// receipt is blocked without acknowledgement (E-DTS-04, C-23). The STP has no status list of its own (OQ-21): the version
// and the supersession are shown as text. Route and archetype are design values.
import { useState } from "react"
import { useParams } from "react-router"
import { Download, FilePlus2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DetailPage, DialogShell, ListPage } from "@/components/templates"
import { Chip, EmptyState, KV, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import { newStpVersion } from "../data/actions"
import { allVendors, itemText, vendorName } from "../data/logic"
import { CLAUSES } from "../data/xlogic"
import { deviationState, recordStpAck } from "../data/xactions"
import type { StpRec } from "../data/types"
import { CsvButton, Design, DocLink, report, Section } from "../components/common"
import { DetailFrame, ItemLink, RecLink, SelectField, TextField } from "../components/bits"
import { StateGate, useNineStates, writeProps, type NineStates } from "../components/states"

export function StpList() {
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-STP", { writers: "Engineering or the Buyer creates versions", degraded: "The document server did not return drawing metadata: revisions show as recorded at release." })
  const usedCount = (t: StpRec) => s.purchaseOrders.filter((p) => p.lines.some((l) => l.stpId === t.id)).length + s.rfqs.filter((q) => q.lines.some((l) => l.stpId === t.id)).length
  const cols: Column<StpRec>[] = [
    { id: "id", header: "Package", value: (r) => r.id, sortable: true, mono: true },
    { id: "ver", header: "Version", value: (r) => r.version, align: "right", sortable: true, mono: true },
    { id: "title", header: "Title", value: (r) => r.title, cell: (r) => <span className="line-clamp-2 max-w-[340px]">{r.title}</span> },
    { id: "item", header: "Item", value: (r) => r.itemId, cell: (r) => <ItemLink id={r.itemId} short /> },
    { id: "cl", header: "Clauses", value: (r) => r.clauses.join(" "), cell: (r) => r.clauses.join(", ") },
    { id: "ack", header: "Acknowledgements", value: (r) => r.acknowledgements.map((a) => a.status).join(", ") || "None", cell: (r) => (r.acknowledgements.length ? <span className="flex flex-wrap gap-1">{r.acknowledgements.map((a) => <StatusBadge key={a.vendorId} kind="stpAck" status={a.status} size="sm" />)}</span> : <span className="text-muted-foreground">None yet</span>) },
    { id: "state", header: "Version state", value: (r) => (r.superseded ? "Superseded" : "Current"), filterable: true, cell: (r) => (r.superseded ? <Chip kind="block">Superseded by {r.supersededBy}</Chip> : "Current") },
    { id: "used", header: "Used on", value: usedCount, align: "right", mono: true },
  ]
  return (
    <ListPage
      header={{
        screenId: "FX-PUR-STP",
        title: "Supplier technical packages",
        description: "The frozen drawings, specifications and quality clauses a vendor quotes and builds to.",
        chips: <Design note="Route and archetype are design values; the package rules are Book IV §3.3" />,
        actions: (
          <>
            {st.menu}
            <CsvButton filename="stp.csv" rows={s.stps.map((t) => ({ Package: t.id, Version: t.version, Item: t.itemId, Superseded: t.superseded ? "yes" : "no", Checksum: t.checksum }))} />
          </>
        ),
        children: st.banner,
      }}
      table={{
        rows: st.empty ? [] : s.stps,
        columns: cols,
        rowId: (r) => r.id,
        rowHref: (r) => `/purchasing/stp/${r.id}`,
        searchText: (r) => `${r.id} ${r.title} ${r.itemId}`,
        loading: st.loading,
        densityKey: "FX-PUR-STP",
        empty: { title: "No supplier technical packages", body: "Engineering issues a package with a long-lead release or when an RFQ needs the technical basis." },
      }}
      below={
        <RulesPanel
          rules={[
            ["E-DTS-03", "A superseded STP cannot attach to a new RFQ or PO line", "[DOC:p.209 §3.3]"],
            ["E-DTS-04", "Receipt is blocked until the vendor acknowledges the package; deviations route to Engineering and Quality", "[DOC:p.209 §3.3]"],
            ["C-22", "A new version supersedes the old one; open POs move to it", "[DOC:p.209]"],
          ]}
        />
      }
    />
  )
}

export function StpDetail() {
  const { id = "" } = useParams()
  const s = useSlice("purchasingFinance")
  const st = useNineStates("FX-PUR-STP-2", { writers: "Engineering or the Buyer" })
  const t = s.stps.find((x) => x.id === id)
  return (
    <DetailFrame loading={st.loading} error={undefined} onRetry={st.retry} found={!!t} title={id} screenId="FX-PUR-STP" back={{ label: "Supplier technical packages", to: "/purchasing/stp" }}>
      {() => <StpBody t={t!} st={st} />}
    </DetailFrame>
  )
}

function StpBody({ t, st }: { t: StpRec; st: NineStates }) {
  const s = useSlice("purchasingFinance")
  const [dlg, setDlg] = useState<null | "version" | "ack">(null)
  const [change, setChange] = useState("")
  const [ack, setAck] = useState({ vendorId: "", status: "" as "Acknowledged" | "Exception" | "Rejected" | "" })
  const chain = s.stps.filter((x) => x.itemId === t.itemId).sort((a, b) => a.version - b.version)
  const pos = s.purchaseOrders.flatMap((p) => p.lines.filter((l) => l.stpId === t.id).map((l) => ({ p, l })))
  const rfqs = s.rfqs.flatMap((q) => q.lines.filter((l) => l.stpId === t.id).map((l) => ({ q, l })))
  const devs = s.supplierDeviations.filter((d) => d.stpId === t.id)
  const vendors = [...new Set([...t.acknowledgements.map((a) => a.vendorId), ...pos.map((x) => x.p.vendorId), ...rfqs.flatMap((x) => x.q.vendorIds)])]
  const ro = t.superseded || st.state === "readonly"
  const download = () => {
    const blob = new Blob([JSON.stringify({ id: t.id, version: t.version, item: t.itemId, drawings: t.drawingRevisions, specs: t.specs, clauses: t.clauses, manifest: t.checksum }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${t.id}-manifest.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <DetailPage
        header={{
          screenId: "FX-PUR-STP",
          title: `${t.id} · ${t.title}`,
          crumbs: [{ label: "Supplier technical packages", to: "/purchasing/stp" }],
          chips: (
            <>
              <span className="text-sm font-medium">Version {t.version}</span>
              {t.superseded && <Chip kind="block">Superseded by {t.supersededBy}</Chip>}
              {t.superseded && <Chip kind="design" note="A superseded version is read-only (C-55)">Read-only</Chip>}
            </>
          ),
          actions: (
            <>
              {st.menu}
              <Button variant="outline" onClick={download}>
                <Download aria-hidden="true" /> Manifest
              </Button>
              {!t.superseded && (
                <Button variant="outline" {...writeProps(st)} onClick={() => setDlg("ack")}>
                  <MailCheck aria-hidden="true" /> Record acknowledgement
                </Button>
              )}
            </>
          ),
          primary: !t.superseded ? (
            <Button onClick={() => setDlg("version")} {...writeProps(st)}>
              <FilePlus2 aria-hidden="true" /> New version
            </Button>
          ) : undefined,
          children: st.banner,
        }}
        doc={{ type: "stp", id: t.id }}
        summary={
          <>
            <KV k="Item"><ItemLink id={t.itemId} /></KV>
            <KV k="Created">{fmtDate(t.createdOn)}</KV>
            <KV k="Long-lead release">{t.llrId ? <RecLink to={`/purchasing/long-lead/${t.llrId}`}>{t.llrId}</RecLink> : "None"}</KV>
            <KV k="Quality clauses">{t.clauses.join(", ")}</KV>
            <KV k="Used on">{pos.length} PO line(s), {rfqs.length} RFQ line(s)</KV>
          </>
        }
        tabs={[
          {
            id: "contents",
            label: "Package contents",
            content: (
              <StateGate st={st} cols={3} emptyTitle="Package not available">
                <div className="flex flex-col gap-4">
                  <Section title="Drawing revisions (frozen)">
                    <ul className="list-disc pl-5 text-sm">{t.drawingRevisions.map((d) => <li key={d}>{d}</li>)}</ul>
                  </Section>
                  <Section title="Specifications">
                    <ul className="list-disc pl-5 text-sm">{t.specs.map((d) => <li key={d}>{d}</li>)}</ul>
                  </Section>
                  <Section title="Quality clauses">
                    <ul className="flex flex-col gap-1 text-sm">{t.clauses.map((c) => <li key={c}><span className="font-semibold">{c}</span> {CLAUSES[c]?.name}: <span className="text-muted-foreground">{CLAUSES[c]?.detail}</span></li>)}</ul>
                  </Section>
                  <Section title="Manifest">
                    <p className="break-all font-mono text-xs">{t.checksum}</p>
                    <p className="text-xs text-muted-foreground">SHA-256 over the package files, shown with the download so a vendor can check what it received [DOC:p.209 §3.3].</p>
                  </Section>
                </div>
              </StateGate>
            ),
          },
          {
            id: "versions",
            label: "Versions",
            count: chain.length,
            content: (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Drawings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chain.map((x) => (
                    <TableRow key={x.id} className="h-8 text-[13px]">
                      <TableCell><RecLink to={`/purchasing/stp/${x.id}`}>{x.id}</RecLink></TableCell>
                      <TableCell className="tabular text-right">{x.version}</TableCell>
                      <TableCell>{fmtDate(x.createdOn)}</TableCell>
                      <TableCell>{x.superseded ? `Superseded by ${x.supersededBy}` : "Current"}</TableCell>
                      <TableCell>{x.drawingRevisions.join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ),
          },
          {
            id: "ack",
            label: "Acknowledgements",
            count: t.acknowledgements.length,
            content: vendors.length ? (
              <Table>
                <TableHeader className="bg-table-head">
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Acknowledgement (S-19)</TableHead>
                    <TableHead>On</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => {
                    const a = t.acknowledgements.find((x) => x.vendorId === v)
                    return (
                      <TableRow key={v} className="h-8 text-[13px]">
                        <TableCell>{vendorName(s, v)}</TableCell>
                        <TableCell>{a ? <StatusBadge kind="stpAck" status={a.status} size="sm" /> : <span className="text-muted-foreground">No acknowledgement</span>}</TableCell>
                        <TableCell>{a ? fmtDate(a.on) : ""}</TableCell>
                        <TableCell>{a?.status === "Acknowledged" ? "Allowed" : t.superseded ? "Not applicable" : "Blocked until acknowledged (E-DTS-04)"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No vendor is attached to this package yet">It reaches a vendor on an RFQ or a PO line.</EmptyState>
            ),
          },
          {
            id: "used",
            label: "Used on",
            count: pos.length + rfqs.length,
            content:
              pos.length + rfqs.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {rfqs.map(({ q, l }) => <li key={q.id + l.no}><DocLink r={{ type: "rfq", id: q.id }} /> line {l.no} · {itemText(l.itemId)}</li>)}
                  {pos.map(({ p, l }) => <li key={p.id + l.no}><DocLink r={{ type: "purchaseOrder", id: p.id }} /> line {l.no} · {vendorName(s, p.vendorId)}</li>)}
                </ul>
              ) : (
                <EmptyState title="Not used on any RFQ or PO line" />
              ),
          },
          {
            id: "dev",
            label: "Supplier deviations",
            count: devs.length,
            content: devs.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {devs.map((d) => (
                  <li key={d.id} className="rounded-md border px-4 py-2">
                    <RecLink to={`/purchasing/supplier-deviations/${d.id}`}>{d.id}</RecLink> · {vendorName(s, d.vendorId)} · {d.characteristic}: {d.original} to {d.proposed} · <span className="font-medium">{deviationState(d)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No deviation proposed against this package" />
            ),
          },
        ]}
        aside={
          ro ? <p className="text-xs text-muted-foreground">Read-only: {t.superseded ? `superseded by ${t.supersededBy}` : "view only"}.</p> : undefined
        }
      />
      <DialogShell
        open={dlg === "version"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`New version of ${t.id}`}
        confirmLabel="Create version"
        consequence={`Creates version ${t.version + 1} with a new manifest checksum and supersedes ${t.id} (C-22). Open POs on it move to the new version and need the vendor's acknowledgement again before receipt.`}
        onConfirm={() => st.guard() ?? report(newStpVersion(t.id, change), (n) => `${n} created`)}
      >
        <TextField id="stp-change" label="What changed" value={change} onChange={setChange} />
      </DialogShell>
      <DialogShell
        open={dlg === "ack"}
        onOpenChange={(o) => !o && setDlg(null)}
        title={`Record the vendor's acknowledgement of ${t.id}`}
        confirmLabel="Record"
        consequence="Stores the vendor's answer on this version. Acknowledged lets receipt through; Exception or Rejected keeps it blocked until a supplier deviation is accepted or the package changes."
        onConfirm={() => st.guard() ?? (ack.status ? report(recordStpAck(t.id, ack.vendorId, ack.status), "Acknowledgement recorded") : "Choose the vendor's answer.")}
      >
        <SelectField id="ack-v" label="Vendor" value={ack.vendorId} onChange={(v) => setAck({ ...ack, vendorId: v })} options={allVendors(s).filter((v) => vendors.includes(v.id) || v.onboarding === "Active").slice(0, 40).map((v) => ({ value: v.id, label: `${v.id} ${v.name}` }))} />
        <SelectField id="ack-s" label="Answer" value={ack.status} onChange={(v) => setAck({ ...ack, status: v })} options={[{ value: "Acknowledged", label: "Acknowledged" }, { value: "Exception", label: "Exception" }, { value: "Rejected", label: "Rejected" }]} />
      </DialogShell>
    </>
  )
}
