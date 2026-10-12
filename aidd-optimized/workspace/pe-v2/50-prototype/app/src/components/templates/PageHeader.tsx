// Page header shared by the office templates: breadcrumb, title, screen-id chip, provenance chips,
// description, and the action area. One filled primary per view (layout.md L-4): pass it as
// `primary`; everything else goes in `actions` as outline / ghost buttons.

import type { ReactNode } from "react"
import { Link } from "react-router"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { ScreenIdChip } from "@/components/patterns/chips"
import { screenById } from "@/data/screens"

export interface PageHeaderProps {
  title: ReactNode
  /** Registry id, e.g. "MM-MAT-001"; shows the chip and the module breadcrumb. */
  screenId?: string
  description?: ReactNode
  /** Breadcrumb trail after the module, e.g. [{label: "Materials", to: "/inventory/items"}]. */
  crumbs?: { label: string; to?: string }[]
  chips?: ReactNode
  /** Secondary actions (outline / ghost). */
  actions?: ReactNode
  /** The view's single filled primary action. */
  primary?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, screenId, description, crumbs, chips, actions, primary, children }: PageHeaderProps) {
  const s = screenId ? screenById(screenId) : undefined
  return (
    <header className="mb-6 flex flex-col gap-2 border-b pb-4">
      {(s || crumbs) && (
        <Breadcrumb>
          <BreadcrumbList>
            {s && (
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={s.route.split("?")[0].replace(/\/:[^/]+.*$/, "")}>{s.module}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {crumbs?.map((c, i) => (
              <span key={i} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>{c.to ? <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{c.label}</BreadcrumbPage>}</BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {screenId && <ScreenIdChip id={screenId} />}
        {chips}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
          {primary}
        </div>
      </div>
      {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      {children}
    </header>
  )
}
