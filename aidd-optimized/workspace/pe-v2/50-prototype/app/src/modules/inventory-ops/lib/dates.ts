// Business-day helper for the close checks (Mon-Fri; no holiday calendar in the prototype).
export function businessDaysBetween(from: string, to: string): number {
  const a = new Date(from.slice(0, 10) + "T12:00:00Z")
  const b = new Date(to.slice(0, 10) + "T12:00:00Z")
  let n = 0
  for (const d = new Date(a); d < b; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}
