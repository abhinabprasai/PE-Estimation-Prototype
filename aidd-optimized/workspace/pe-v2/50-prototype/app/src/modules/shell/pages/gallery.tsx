// Shared frame for the component gallery pages (/components/*): a Detail page with Component, States
// and Usage tabs, so every bespoke component shows its nine states and where it is used.
import type { ReactNode } from "react"
import { Link } from "react-router"
import { DetailPage } from "@/components/templates"
import { Chip } from "@/components/patterns"
import { StateStage, type StateStageProps } from "../kit"

export interface GalleryProps {
  id: string
  title: string
  description: string
  /** Where the component appears (Book V section 10.2). */
  where: string
  /** Behaviour source. */
  source: string
  rules: string[]
  /** Module screens that adopt it. */
  adopted: { label: string; to: string }[]
  preview: ReactNode
  /** Props for the nine-state stage; the preview is the normal state. */
  stage?: Partial<StateStageProps>
  /** Skip the state tab (component pages that are themselves the state kit). */
  noStates?: boolean
  extraTabs?: { id: string; label: string; content: ReactNode }[]
  chips?: ReactNode
}
export type { StateStageProps }

export function Gallery(p: GalleryProps) {
  return (
    <DetailPage
      header={{
        title: p.title,
        screenId: p.id,
        description: p.description,
        chips: (
          <>
            <Chip kind="design" note="Route and archetype for gallery pages are design values (feature list)">Component gallery</Chip>
            {p.chips}
          </>
        ),
        actions: (
          <Link to="/components/guidelines" className="text-sm text-link underline">
            Usage guidelines
          </Link>
        ),
      }}
      tabs={[
        { id: "component", label: "Component", content: p.preview },
        ...(p.noStates ? [] : [{ id: "states", label: "Nine states", content: <StateStage {...p.stage}>{p.preview}</StateStage> }]),
        ...(p.extraTabs ?? []),
        {
          id: "usage",
          label: "Usage",
          content: (
            <div className="flex max-w-3xl flex-col gap-4 text-sm">
              <dl className="grid gap-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Where it appears</dt>
                  <dd>{p.where}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Behaviour source</dt>
                  <dd>{p.source} (asserted)</dd>
                </div>
              </dl>
              <div>
                <h3 className="mb-1 font-semibold">Rules</h3>
                <ul className="list-disc pl-4">
                  {p.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Adopted by</h3>
                <ul className="list-disc pl-4">
                  {p.adopted.map((a) => (
                    <li key={a.to}>
                      <Link to={a.to} className="text-link underline">
                        {a.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-muted-foreground">Import from <code>@/modules/shell/kit</code>. Colour comes from tokens only; swapping the design language is a change to <code>index.css</code>.</p>
            </div>
          ),
        },
      ]}
    />
  )
}
