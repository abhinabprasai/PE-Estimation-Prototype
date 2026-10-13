// FX-ENG-ITEMS Engineering items view (List, design value). The items engineering works with: every
// parent and component on an EBOM, plus placeholder parts and sales-kit headers, with what the
// material master and the BOMs say about each. The material master itself is MM-MAT-001 (materials).

import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Chip, RulesPanel, StatusBadge, type Column } from "@/components/patterns"
import { ListPage } from "@/components/templates"
import { useSlice } from "@/store"
import { NoPostings, RefLink } from "../components"
import { ScreenFrame, StatePreviewAll, useStates } from "../states"
import { engineeringItems, type EngItem } from "../data/logic"

export function EngineeringItems() {
  const s = useSlice("engineering")
  const st = useStates("FX-ENG-ITEMS")
  const nav = useNavigate()
  const rows = st.empty ? [] : engineeringItems(s)
  const columns: Column<EngItem>[] = [
    { id: "id", header: "Item", value: (r) => r.id, sortable: true, mono: true },
    { id: "desc", header: "Description", value: (r) => r.description, cell: (r) => <span className="inline-flex flex-wrap items-center gap-1">{r.description}{r.placeholder && <Chip kind="flag" note="Engineering Placeholder: Draft material; blocks EBOM release (V-ENG-03)">Placeholder</Chip>}{r.kit && <Chip kind="design" note="Sales kit header: material type KIT, non-stocked (foundation request R-13)">Kit header</Chip>}{r.hasBlock && <Chip kind="block" note="A function-specific block is set in the material master">Blocked</Chip>}</span> },
    { id: "type", header: "Type", value: (r) => r.type, filterable: true },
    { id: "mb", header: "Make / Buy", value: (r) => r.makeBuy, filterable: true },
    { id: "status", header: "Item status", value: (r) => r.status, filterable: true, sortable: true, cell: (r) => (r.kit ? <span className="text-sm text-muted-foreground">n/a</span> : <StatusBadge kind="material" status={r.status} size="sm" />) },
    { id: "used", header: "On EBOMs", value: (r) => r.usedIn, align: "right", sortable: true, mono: true },
    { id: "parent", header: "Parent of", value: (r) => r.parentOf, align: "right", sortable: true, mono: true },
    { id: "rel", header: "Released EBOM", value: (r) => r.releasedEbom ?? "", cell: (r) => (r.releasedEbom ? <RefLink r={{ type: "ebom", id: r.releasedEbom }} /> : r.makeBuy === "Make" && !r.kit ? <span className="text-destructive">none (blocks parent release, V-ENG-06)</span> : <span className="text-muted-foreground">n/a</span>) },
  ]
  return (
    <ScreenFrame st={st} what="Engineering items" who="Engineers, the Engineering Manager, production, purchasing and quality" source="DOC:p.67 §7" handleLoading={false}
      text={{ readonly: "Item data is read-only here: items are created and changed in Materials (MCR) and by placeholder requests from the EBOM editor." }}>
      <ListPage<EngItem>
        header={{
          title: "Engineering items",
          screenId: "FX-ENG-ITEMS",
          crumbs: [{ label: "Engineering items" }],
          description: "Every item that appears on an EBOM, as engineering sees it: status, make or buy, how many BOMs hold it and whether a made part has its own released EBOM. Open one in the Where-Used explorer.",
          actions: <StatePreviewAll st={st} />,
          primary: <Button onClick={() => nav("/engineering/where-used")}>Open Where-Used explorer</Button>,
        }}
        table={{
          rows, columns, rowId: (r) => r.id, rowHref: (r) => `/engineering/where-used?item=${r.id}`, searchText: (r) => `${r.id} ${r.description} ${r.type}`,
          loading: st.loading, error: st.error, onRetry: st.retry, initialSort: { id: "id", dir: "asc" }, densityKey: "FX-ENG-ITEMS",
          empty: { title: "No items on any EBOM yet", body: "Items appear here as soon as they are placed on an EBOM or created as placeholders." },
        }}
      />
      <NoPostings />
      <RulesPanel rules={[
        ["V-ENG-03", "Release is blocked while any placeholder remains Draft", "DOC:p.60 §3.2"],
        ["V-ENG-06", "Make items must themselves carry a released EBOM before parent release", "DOC:p.61 §3.2"],
        ["Kit header", "A sales kit header is a material of type KIT, non-stocked and non-valuated by default", "DOC:p.256 §6.1"],
      ]} />
    </ScreenFrame>
  )
}
