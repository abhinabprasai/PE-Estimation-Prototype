// Small shared pieces for the inventory-ops screens.
import type { ReactNode } from "react"
import { Link } from "react-router"
import { Chip } from "@/components/patterns"
import { MATERIALS, USERS } from "@/data/shared"
import { READINGS, type ReadingId } from "../lib/readings"

/** A reading chip: the choice was made where the specification is silent (README "Readings"). */
export function Reading({ id }: { id: ReadingId }) {
  return <Chip kind="oq" id={id} note={READINGS[id]} />
}
/** Records with no status list in the specification show text, never a badge (OQ-21). */
export function NoList({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-medium">{text}</span>
      <Chip kind="oq" id="OQ-21" note="No status list in the specification; shown as text, not a badge" />
    </span>
  )
}
export const userName = (id?: string) => (id ? (USERS.find((u) => u.id === id)?.name ?? id) : "Unassigned")
export const matText = (id?: string) => {
  const m = MATERIALS.find((x) => x.id === id)
  return m ? `${m.id} ${m.description}` : (id ?? "")
}
export const matShort = (id?: string) => MATERIALS.find((x) => x.id === id)?.description ?? id ?? ""
export const fmtTime = (iso?: string) => (iso ? iso.slice(11, 16) : "")
export const fmtStamp = (iso?: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : "")
export const nowIso = () => new Date().toISOString().slice(0, 16)
export const L = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="text-link underline-offset-4 hover:underline">
    {children}
  </Link>
)
