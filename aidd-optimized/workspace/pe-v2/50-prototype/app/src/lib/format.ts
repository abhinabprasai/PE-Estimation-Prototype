// en-US formatting helpers shared by every module (same rules as the FL-09 build).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Oct 9, 2026"; "Not recorded" when empty. */
export const fmtDate = (iso?: string) => {
  if (!iso) return "Not recorded"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
export const fmtMoney = (n: number, currency: "USD" | "CAD" = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n)
export const fmtNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)
export const fmtPct = (n: number, digits = 1) => `${fmtNumber(n, digits)}%`
export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000)
