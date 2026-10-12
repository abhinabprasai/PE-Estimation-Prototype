// Date-time helpers for the admin screens. Times are local wall-clock strings ("2026-10-09T15:00");
// the prototype clock is NOW in data/seed.ts.
import { fmtDate } from "@/lib/format"

function ms(iso: string): number {
  const base = iso.length === 10 ? `${iso}T00:00` : iso.slice(0, 16)
  return Date.parse(`${base}:00Z`)
}

export const hoursBetween = (a: string, b: string) => (ms(b) - ms(a)) / 3_600_000

export function addHours(iso: string, h: number): string {
  const d = new Date(ms(iso) + h * 3_600_000)
  return d.toISOString().slice(0, 16)
}

/** "Oct 9, 2026 15:00" */
export const fmtDateTime = (iso?: string) => (iso ? `${fmtDate(iso)}${iso.length > 10 ? ` ${iso.slice(11, 16)}` : ""}` : "Not recorded")

/** "3 d 4 h" / "5 h" / "40 min" */
export function fmtDuration(hours: number): string {
  const h = Math.abs(hours)
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${Math.round(h)} h`
  const d = Math.floor(h / 24)
  const rest = Math.round(h - d * 24)
  return rest ? `${d} d ${rest} h` : `${d} d`
}

export const monthOf = (date: string) => date.slice(0, 7)
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}
export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
export const fmtMonth = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
