// Placeholder for every registry screen no module route has claimed yet, so navigation is complete
// from day one: "Not built yet: <ID> <title>, wave Wn".
import { Link } from "react-router"
import { Construction } from "lucide-react"
import { Chip, ScreenIdChip } from "@/components/patterns"
import { type ScreenEntry } from "@/data/screens"
import { SPINE_DOCS } from "@/data/shared"
import { docRoute } from "@/data/domain"
import { GROUPS } from "@/data/modules"

export function NotBuilt({ screen }: { screen: ScreenEntry }) {
  const group = GROUPS.find((g) => g.id === screen.group)!
  const prefix = screen.route.split("?")[0].replace(/\/:[^/]+.*$/, "")
  const spine = SPINE_DOCS.filter((d) => d.owner === screen.group && docRoute(d.ref).startsWith(prefix + "/"))
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Construction className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">
          Not built yet: {screen.id} {screen.title}, wave {screen.wave}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <ScreenIdChip id={screen.id} />
        <Chip kind="design">{screen.archetype}</Chip>
        {screen.routeSource === "design" && <Chip kind="design" note="The specification gives no route for this entry; this path is a design value">Route is a design value</Chip>}
        {screen.flows.map((f) => (
          <span key={f} className="inline-flex h-6 items-center rounded-md border px-2 font-mono text-xs">
            {f}
          </span>
        ))}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[160px_1fr]">
        <dt className="text-muted-foreground">Module</dt>
        <dd>
          {screen.module} (folder src/modules/{screen.group}, {group.label})
        </dd>
        <dt className="text-muted-foreground">Archetype</dt>
        <dd>
          {screen.archetype} · the entry says “{screen.archetypeText}”
        </dd>
        <dt className="text-muted-foreground">Wave</dt>
        <dd>
          {screen.wave}
          {screen.waveNote ? ` (${screen.waveNote})` : ""}
        </dd>
        <dt className="text-muted-foreground">Users</dt>
        <dd>{screen.users}</dd>
        <dt className="text-muted-foreground">Postings and scans</dt>
        <dd>{screen.postings}</dd>
        <dt className="text-muted-foreground">Flows</dt>
        <dd>{screen.flowBasis || "Not tied to a flow (master data or reporting)"}</dd>
        {screen.note && (
          <>
            <dt className="text-muted-foreground">Note</dt>
            <dd>{screen.note}</dd>
          </>
        )}
      </dl>
      {spine.length > 0 && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Spine documents this screen will show</p>
          <ul className="mt-1 list-disc pl-4">
            {spine.map((d) => (
              <li key={d.ref.id}>
                <span className="font-mono">{d.ref.id}</span> {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Source: PRD screen plan [DOC:pp.245-282] (asserted). See <Link to="/coverage" className="text-link underline">coverage</Link> for what is built.
      </p>
    </div>
  )
}
