// FX-MM-PLANTSRC: Plant sourcing sequence and network MRP fields [Book VII §4.1, §4.4]. One plant at
// go-live: the sourcing sequence (own production, transfer, purchase, in rank order), the transfer
// lanes and the network exceptions are configured here but stay dormant until DEC-07 (multi-plant)
// fires; MRP ignores them while it is off. The switch is a prototype control so the live behaviour
// can be exercised (RD-MM-35).

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfigPage } from "@/components/templates"
import { Chip, EmptyState, FamilyBadge, RulesPanel } from "@/components/patterns"
import { useSlice } from "@/store"
import type { SourceKind } from "../data/ext"
import { addSourcingRow, moveSourcingRow, removeSourcingRow, setDec07, setLaneActive } from "../data/ext-actions"
import { allMaterials } from "../data/state"
import { network } from "../lib/ext-rules"
import { MatLink, Reading, Section } from "../components/common"
import { useViewState } from "../components/states"
import { run } from "../components/run"

const SECTIONS = [
  { id: "sequence", label: "Sourcing sequence" },
  { id: "lanes", label: "Transfer lanes" },
  { id: "mrp", label: "Network MRP fields" },
  { id: "exceptions", label: "Network exceptions" },
]
const KINDS: SourceKind[] = ["Own production", "Transfer", "Purchase"]

export function PlantSourcing() {
  const s = useSlice("materials")
  const st = useViewState("FX-MM-PLANTSRC", { degradedWhat: "The plant network service is slow" })
  const [sec, setSec] = useState("sequence")
  const [mat, setMat] = useState("")
  const [plant, setPlant] = useState("PL-TBD-02")
  const [kind, setKind] = useState<SourceKind>("Transfer")
  const [from, setFrom] = useState("PL-TBD-01")
  const [lane, setLane] = useState("LANE-01")
  const p = s.x.plantSrc
  const on = p.dec07
  const exceptions = useMemo(() => network(s), [s])
  const mats = useMemo(() => allMaterials(s).filter((m) => m.status === "Active" && ["RAW", "SEMI", "FIN", "CONS", "PACK", "TRADE", "SPARE"].includes(m.type)).slice(0, 60), [s])
  const write = st.canWrite
  const rowsByKey = useMemo(() => {
    const m = new Map<string, typeof p.rows>()
    for (const r of [...p.rows].sort((a, b) => a.rank - b.rank)) {
      const k = `${r.materialId}|${r.plantId}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
  }, [p.rows])
  const laneTxt = (id?: string) => {
    const l = p.lanes.find((x) => x.id === id)
    return l ? `${l.id} ${l.from} to ${l.to}, ${l.transitDays} d ${l.mode}${l.active ? "" : " (inactive)"}` : "No lane"
  }
  return (
    <ConfigPage
      header={{
        screenId: "FX-MM-PLANTSRC",
        title: "Plant sourcing and network MRP fields",
        description: "Where each plant gets a material from, in rank order, and the plant-level planning fields the network engine reads. Dormant until DEC-07 (multi-plant) fires.",
        chips: (
          <>
            <Chip kind="oq" id="DEC-07" note="Multi-plant is a pending decision; one plant at go-live (§3.3)">DEC-07 {on ? "fired (prototype)" : "not fired"}</Chip>
            <Reading id="RD-MM-35" />
          </>
        ),
        actions: st.toolbar,
      }}
      sections={SECTIONS}
      section={sec}
      onSectionChange={setSec}
      effectiveDated
    >
      <div className="flex flex-col gap-4">
        {st.banners}
        <Alert role="status">
          <AlertTitle>{on ? "Network engine on (prototype switch)" : "Dormant: MRP ignores everything on this screen"}</AlertTitle>
          <AlertDescription>
            <span>{on ? "Transfer demand and network exceptions (EX-10) are evaluated. Extend to Plant is enabled." : "One plant at go-live (Book II §3.3). Rows are kept so they are ready the day DEC-07 fires; no planned order, transfer or exception is generated from them."}</span>
            <div className="mt-2 flex items-center gap-2">
              <Switch id="dec07" checked={on} disabled={!write} onCheckedChange={(v) => run(setDec07(v), v ? "DEC-07 switched on (prototype)" : "DEC-07 switched off")} aria-label="Multi-plant switch (DEC-07, prototype)" />
              <Label htmlFor="dec07">Multi-plant (DEC-07), prototype switch</Label>
            </div>
          </AlertDescription>
        </Alert>

        {sec === "sequence" && (
          <>
            {p.rows.length === 0 || st.empty ? (
              <EmptyState title="No sourcing sequence defined">Add a source for a material and plant: the first rank is tried first.</EmptyState>
            ) : (
              rowsByKey.map(([key, rows]) => (
                <Section key={key} title={`${rows[0].materialId} at ${rows[0].plantId}`} action={on ? <FamilyBadge family="active" label="Live" size="sm" /> : <FamilyBadge family="draft" label="Dormant" size="sm" title="Not evaluated until DEC-07" />}>
                  <Table>
                    <TableHeader className="bg-table-head"><TableRow><TableHead className="w-16">Rank</TableHead><TableHead>Source</TableHead><TableHead>From plant</TableHead><TableHead>Lane</TableHead><TableHead>Note</TableHead><TableHead className="w-32">Order</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell className="tabular">{r.rank}</TableCell>
                          <TableCell>{r.source}</TableCell>
                          <TableCell className="font-mono">{r.fromPlant ?? ""}</TableCell>
                          <TableCell>{r.source === "Transfer" ? laneTxt(r.laneId) : ""}</TableCell>
                          <TableCell className="text-muted-foreground">{r.note}</TableCell>
                          <TableCell>
                            <span className="flex gap-1">
                              <Button size="icon" variant="ghost" aria-label={`Move ${r.id} up`} disabled={!write || i === 0} title={st.blockedWhy} onClick={() => run(moveSourcingRow(r.id, -1), "Moved up")}><ArrowUp aria-hidden="true" /></Button>
                              <Button size="icon" variant="ghost" aria-label={`Move ${r.id} down`} disabled={!write || i === rows.length - 1} onClick={() => run(moveSourcingRow(r.id, 1), "Moved down")}><ArrowDown aria-hidden="true" /></Button>
                              <Button size="icon" variant="ghost" aria-label={`Remove ${r.id}`} disabled={!write} onClick={() => run(removeSourcingRow(r.id), "Source removed")}><Trash2 aria-hidden="true" /></Button>
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              ))
            )}
            <Section title="Add a source to a sequence">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ps-mat">Material</Label>
                  <Select value={mat} onValueChange={setMat}>
                    <SelectTrigger id="ps-mat" size="sm" className="h-8 w-56"><SelectValue placeholder="Choose a material" /></SelectTrigger>
                    <SelectContent>{mats.map((m) => <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ps-plant">Receiving plant</Label>
                  <Select value={plant} onValueChange={setPlant}>
                    <SelectTrigger id="ps-plant" size="sm" className="h-8 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{p.plants.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} ({x.status})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="ps-kind">Source</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
                    <SelectTrigger id="ps-kind" size="sm" className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {kind === "Transfer" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="ps-from">Supplying plant</Label>
                      <Select value={from} onValueChange={setFrom}>
                        <SelectTrigger id="ps-from" size="sm" className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{p.plants.map((x) => <SelectItem key={x.id} value={x.id}>{x.id}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="ps-lane">Lane</Label>
                      <Select value={lane} onValueChange={setLane}>
                        <SelectTrigger id="ps-lane" size="sm" className="h-8 w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>{p.lanes.map((l) => <SelectItem key={l.id} value={l.id}>{laneTxt(l.id)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button disabled={!write} title={st.blockedWhy} onClick={() => run(addSourcingRow({ materialId: mat, plantId: plant, source: kind, fromPlant: kind === "Transfer" ? from : undefined, laneId: kind === "Transfer" ? lane : undefined }), (id) => `${id} added at the end of the sequence`)}>
                  Add source
                </Button>
              </div>
              {st.validation && !mat && <p className="text-xs text-destructive">Choose a material.</p>}
            </Section>
          </>
        )}

        {sec === "lanes" && (
          <Section title="Transfer lanes">
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Lane</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Transit days</TableHead><TableHead>Mode</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.lanes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.id}</TableCell><TableCell className="font-mono">{l.from}</TableCell><TableCell className="font-mono">{l.to}</TableCell>
                    <TableCell className="tabular text-right">{l.transitDays}</TableCell><TableCell>{l.mode}</TableCell>
                    <TableCell><Switch checked={l.active} disabled={!write} onCheckedChange={(v) => run(setLaneActive(l.id, v), `${l.id} ${v ? "activated" : "deactivated"}`)} aria-label={`Lane ${l.id} active`} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">An inactive lane under a Transfer source raises EX-10 once the network engine is on. Transit days become the transfer lead time in MRP.</p>
          </Section>
        )}

        {sec === "mrp" && (
          <Section title="Network MRP fields by plant">
            <Table>
              <TableHeader className="bg-table-head"><TableRow><TableHead>Material</TableHead><TableHead>Plant</TableHead><TableHead>MRP type</TableHead><TableHead>Procurement</TableHead><TableHead className="text-right">Lead time (d)</TableHead><TableHead>Plant status</TableHead><TableHead>Transfer lead time</TableHead></TableRow></TableHeader>
              <TableBody>
                {s.plantData.filter((r) => ["RAW-TBD-CRGO23", "RAW-TBD-OIL", "SEMI-TBD-CORE20", "SEMI-TBD-TANK20", "FIN-TBD-20MVA", "RAW-TBD-OLTC"].includes(r.materialId) || r.plantId !== "PL-TBD-01").map((r) => {
                  const src = p.rows.find((x) => x.materialId === r.materialId && x.plantId === r.plantId && x.rank === 1)
                  const l = p.lanes.find((x) => x.id === src?.laneId)
                  return (
                    <TableRow key={`${r.materialId}-${r.plantId}`}>
                      <TableCell><MatLink id={r.materialId} /></TableCell><TableCell className="font-mono">{r.plantId}</TableCell><TableCell>{r.mrpType}</TableCell><TableCell>{r.procurement}</TableCell>
                      <TableCell className="tabular text-right">{r.leadTimeDays}</TableCell><TableCell>{r.status}</TableCell>
                      <TableCell>{src?.source === "Transfer" && l ? `${l.transitDays} d (${l.id})` : <span className="text-muted-foreground">{src ? `Rank 1: ${src.source}` : "Not sequenced"}</span>}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Plant rows beyond the home plant exist once a material is extended (Extend to Plant, enabled when DEC-07 fires). The home plant's MRP type and procurement come from the Planning view.</p>
          </Section>
        )}

        {sec === "exceptions" && (
          <Section title="Network exceptions (EX-10)">
            {!on ? (
              <EmptyState title="Not evaluated: DEC-07 has not fired">Switch multi-plant on above to see which sourcing rows would raise EX-10 (inactive lane, no lane, or a supplying plant without a valid production version).</EmptyState>
            ) : exceptions.length === 0 ? (
              <EmptyState title="No network exception">Every transfer source has an active lane and a supplier.</EmptyState>
            ) : (
              <Table>
                <TableHeader className="bg-table-head"><TableRow><TableHead>Code</TableHead><TableHead>Row</TableHead><TableHead>Material</TableHead><TableHead>Cause</TableHead></TableRow></TableHeader>
                <TableBody>
                  {exceptions.map((e, i) => {
                    const row = p.rows.find((r) => r.id === e.row)
                    return <TableRow key={i}><TableCell className="font-mono">{e.code}</TableCell><TableCell className="font-mono">{e.row}</TableCell><TableCell>{row && <MatLink id={row.materialId} />}</TableCell><TableCell>{e.text}</TableCell></TableRow>
                  })}
                </TableBody>
              </Table>
            )}
          </Section>
        )}
        <RulesPanel
          rules={[
            ["§4.1", "The sourcing sequence per material and plant: own production, transfer (with a lane) or purchase, tried in rank order.", "[Book VII §4.1]"],
            ["§4.4", "Network planning (transfer demand, EX-10 exceptions) is built but dormant until DEC-07; one plant at go-live.", "[Book VII §4.4]"],
            ["§3.3", "One plant at go-live: Extend to Plant is disabled until multi-plant is on.", "[Book II §3.3]"],
          ]}
        />
      </div>
    </ConfigPage>
  )
}
