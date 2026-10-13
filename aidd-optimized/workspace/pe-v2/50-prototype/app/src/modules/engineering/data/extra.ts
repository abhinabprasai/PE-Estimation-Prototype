// Design values behind the engineering reports (FX-ENG-REPORTS). The PRD names the five reports and
// their content [DOC:p.67 §7] but supplies no data; whatever the seeded records cannot answer is held
// here and shown with a "Design value" chip. Names, dates and numbers are fictitious.

import type { DesignType, EcrClass } from "./types"

/** Average design hours by design type: the store records no hours, so these are design values. */
export const DESIGN_HOURS: Record<DesignType, number> = { "New Design": 420, "Variant of Existing": 140, Repeat: 6 }

/** Released change records before the seed starts, so duration percentiles have a population. */
export const CHANGE_HISTORY: { ecr: string; eco: string; raisedOn: string; releasedOn: string; emergency: boolean; classification: EcrClass }[] = [
  { ecr: "ECR-2025-0031", eco: "ECO-2025-0021", raisedOn: "2025-11-03", releasedOn: "2025-11-26", emergency: false, classification: "Cost Reduction" },
  { ecr: "ECR-2025-0034", eco: "ECO-2025-0022", raisedOn: "2025-11-17", releasedOn: "2025-12-19", emergency: false, classification: "Supply Continuity" },
  { ecr: "ECR-2025-0036", eco: "ECO-2025-0024", raisedOn: "2025-12-02", releasedOn: "2025-12-04", emergency: true, classification: "Safety/Regulatory" },
  { ecr: "ECR-2026-0002", eco: "ECO-2026-0001", raisedOn: "2026-01-14", releasedOn: "2026-02-12", emergency: false, classification: "Customer Request" },
  { ecr: "ECR-2026-0005", eco: "ECO-2026-0002", raisedOn: "2026-02-09", releasedOn: "2026-03-02", emergency: false, classification: "Quality/CAPA" },
  { ecr: "ECR-2026-0007", eco: "ECO-2026-0003", raisedOn: "2026-03-11", releasedOn: "2026-04-28", emergency: false, classification: "Cost Reduction" },
  { ecr: "ECR-2026-0008", eco: "ECO-2026-0004", raisedOn: "2026-04-06", releasedOn: "2026-04-08", emergency: true, classification: "Safety/Regulatory" },
  { ecr: "ECR-2026-0009", eco: "ECO-2026-0005", raisedOn: "2026-05-19", releasedOn: "2026-06-23", emergency: false, classification: "Documentation Only" },
]

/** Nearest-rank percentile of a list of numbers. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const v = [...values].sort((a, b) => a - b)
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))]
}
export const quarterOf = (iso: string) => `${iso.slice(0, 4)} Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`
