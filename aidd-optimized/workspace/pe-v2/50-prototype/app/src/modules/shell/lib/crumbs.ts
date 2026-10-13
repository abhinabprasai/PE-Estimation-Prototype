// Breadcrumb trail for the current path, derived from the screen registry: section, PRD module, screen,
// then the record id when the last segment is one. Used by AppShell and /shell/navigation.
import { SECTIONS } from "@/data/modules"
import { screenForPath } from "@/data/screens"

export interface Crumb {
  label: string
  to?: string
}
export function crumbsFor(pathname: string): Crumb[] {
  const s = screenForPath(pathname)
  if (!s) return [{ label: "Home", to: "/home" }]
  const section = SECTIONS.find((x) => x.modules.includes(s.module))
  const base = s.route.split("?")[0].replace(/\/:[^/]+.*$/, "")
  const out: Crumb[] = [{ label: "Home", to: "/home" }]
  if (section && section.id !== "home") out.push({ label: section.label })
  if (s.module !== "Home and Dashboards") out.push({ label: s.module })
  const last = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "")
  const isRecord = /[A-Z]{2,}-/.test(last) && pathname.replace(/\/$/, "") !== base
  out.push({ label: s.title, to: isRecord ? base : undefined })
  if (isRecord) out.push({ label: last })
  return out
}
