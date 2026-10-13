// IB-001 unknown-site worklist with bulk site assignment [DOC:p.215 Book IV §7.4]. Units bought by an EPC contractor ship to
// a job site; the installed base keeps "Not recorded" until Customer Service assigns the real site. Select many, assign one.
import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { WorkbenchPage, DialogShell } from "@/components/templates"
import { Chip, RulesPanel, type Column } from "@/components/patterns"
import { StatusBadge } from "@/components/patterns/status"
import { useSlice } from "@/store"
import { listDate, product, TODAY } from "../../data/model"
import type { Ib } from "../../data/ext-model"
import { assignSites } from "../../fx/actions"
import { PickField, StateBar, TextField, report, useFxState } from "./kit"

export const isUnknownSite = (i: Ib) => (!i.site || i.site === "Not recorded") && !["Scrapped", "Returned"].includes(i.status)

export function UnknownSiteWorklist() {
  const db = useSlice("sales")
  const st = useFxState()
  const [dlg, setDlg] = useState<string[] | null>(null)
  const [pick, setPick] = useState("")
  const [free, setFree] = useState("")
  const rows = st.empty ? [] : db.ib.filter(isUnknownSite)
  const cname = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
  const cols: Column<Ib>[] = [
    { id: "id", header: "Record", value: (i) => i.id, mono: true, sortable: true },
    { id: "serial", header: "Serial", value: (i) => i.serial, mono: true },
    { id: "unit", header: "Unit", value: (i) => product(i.itemId).description, className: "max-w-60 truncate" },
    { id: "cust", header: "Owner", value: (i) => cname(i.customerId), filterable: true, className: "max-w-60 truncate" },
    { id: "ship", header: "Shipped", value: (i) => i.shipDate, cell: (i) => listDate(i.shipDate), sortable: true },
    { id: "age", header: "Days unknown", align: "right", value: (i) => Math.round((new Date(TODAY).getTime() - new Date(i.shipDate).getTime()) / 86400000), sortable: true },
    { id: "status", header: "Status", value: (i) => i.status, cell: (i) => <StatusBadge kind="installedBase" status={i.status} size="sm" /> },
    { id: "war", header: "Warranty basis", value: (i) => i.warrantyBasis },
  ]
  const ids = dlg ?? []
  const owners = [...new Set(ids.map((id) => db.ib.find((i) => i.id === id)?.customerId).filter(Boolean))] as string[]
  const sites = owners.flatMap((o) => (db.custExt[o]?.addresses ?? []).filter((a) => a.kind === "Ship-To").map((a) => ({ value: a.text, label: `${cname(o)}: ${a.site}, ${a.text}` })))
  return (
    <div className="flex flex-col gap-4">
      <StateBar st={st} />
      <WorkbenchPage<Ib>
        header={{ title: "Installed base: unknown-site worklist", screenId: "IB-001", description: "Units whose installation site is not recorded. Assign the real site to many at once; the unit's history keeps the assignment.", chips: <Chip kind="design" note="The PRD names the worklist in the feature list only; the rule is the design value of Reading SR-41.">Worklist: design value</Chip>, actions: <Button variant="outline" asChild><Link to="/service/installed-base">Back to the installed base</Link></Button> }}
        kpis={[{ label: "Unknown site", value: rows.length }, { label: "Oldest (days)", value: rows.length ? Math.max(...rows.map((i) => Math.round((new Date(TODAY).getTime() - new Date(i.shipDate).getTime()) / 86400000))) : 0 }, { label: "Owners", value: new Set(rows.map((r) => r.customerId)).size }]}
        table={{ rows, columns: cols, rowId: (i) => i.id, loading: st.loading, searchText: (i) => `${i.id} ${i.serial} ${cname(i.customerId)}`, rowHref: (i) => `/service/installed-base/${i.id}`, densityKey: "ib-unknown-site", empty: { title: "Every unit has a site", body: "Units bought by contractors appear here until their final site is recorded." } }}
        bulkActions={(sel) => <Button size="sm" onClick={() => { setDlg(sel); setPick(""); setFree("") }} disabled={!st.writable} title={st.why || undefined}>Assign site to {sel.length}</Button>}
      />
      <DialogShell open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={`Assign a site to ${ids.length} unit(s)`} description={ids.join(", ")} consequence={`Sets the same installed site on all ${ids.length} record(s) and adds the assignment to each unit's history. The units leave this worklist.`} confirmLabel="Assign site"
        onConfirm={() => report(assignSites(ids, free.trim() || pick), (n) => `${n} unit(s) assigned`)}>
        {sites.length > 0 && <PickField label="Ship-to address of the owner" value={pick} onChange={(v) => { setPick(v); setFree("") }} options={sites} />}
        <TextField id="site-free" label="Or type the site" value={free} onChange={setFree} hint="Substation, address and city." />
      </DialogShell>
      <RulesPanel rules={[
        ["IB-1", "Every shipped transformer has an installed base record created at PGI; the site is the delivery's ship-to unless it is a contractor job site.", "DOC:p.215 §7.4"],
        ["IB-2", "An unknown site stays on the worklist until Customer Service assigns one; assignment is logged on the unit.", "Design value (SR-41)"],
      ]} />
    </div>
  )
}
