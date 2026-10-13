// Small formatting helpers for the feature-list screens of quality-trace.
export const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
export function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}
/** The offline queue holds scans for 4 hours of network loss [DOC:p.94 Part F]. */
export const OFFLINE_LIMIT_MIN = 240
