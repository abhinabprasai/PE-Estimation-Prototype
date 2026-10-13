// Capture-template and nameplate rules shared by the terminal actions (actions.ts) and the builder
// (actions-ext.ts). Kept apart so the two action files do not import each other in a cycle.
import type { WorkCenterId } from "@/data/domain"
import type { PPOperation, PPWorkOrder, PlanningProductionState } from "../data/types"
import type { CaptureField, CaptureTemplate } from "../data/extra"

export const publishedTemplateFor = (d: Pick<PlanningProductionState, "captureTemplates">, wcId: string) => d.captureTemplates.find((t) => t.status === "Published" && t.wcIds.includes(wcId as WorkCenterId))
export type CaptureIssue = { field: CaptureField; level: "missing" | "hard" | "soft"; text: string }
export function captureIssues(t: CaptureTemplate | undefined, values: Record<string, string> | undefined): CaptureIssue[] {
  const out: CaptureIssue[] = []
  for (const f of t?.fields ?? []) {
    const v = (values?.[f.label] ?? "").trim()
    if (!v) {
      if (f.required) out.push({ field: f, level: "missing", text: `${f.label} is required` })
      continue
    }
    if (f.kind === "number") {
      const n = Number(v.replace(/,/g, ""))
      if (!Number.isFinite(n)) out.push({ field: f, level: "hard", text: `${f.label} must be a number` })
      else if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) out.push({ field: f, level: f.limit === "soft" ? "soft" : "hard", text: `${f.label} ${n} is outside ${f.min ?? "…"} to ${f.max ?? "…"}${f.unit ? ` ${f.unit}` : ""}` })
    }
    if (f.kind === "pass-fail" && !["Pass", "Fail"].includes(v)) out.push({ field: f, level: "hard", text: `${f.label} is Pass or Fail` })
    if (f.kind === "choice" && f.options && !f.options.includes(v)) out.push({ field: f, level: "hard", text: `${f.label} must be one of ${f.options.join(", ")}` })
  }
  return out
}

/** Missing required fields block Complete at the terminal (checked inside completeOp through this). */
export function captureBlock(d: Pick<PlanningProductionState, "captureTemplates">, o: PPOperation): string | null {
  const t = publishedTemplateFor(d, o.workCenterId)
  const bad = captureIssues(t, o.capture).filter((i) => i.level !== "soft")
  return bad.length ? `Data capture (${t?.name} v${t?.version}): ${bad.map((b) => b.text).join("; ")}.` : null
}

export const NAMEPLATE_KEY = "Nameplate verified (SP-13)"
export const needsNameplate = (o: Pick<PPOperation, "text">) => /SP-13/.test(o.text)
export const verifiedSerials = (o: Pick<PPOperation, "capture">) => (o.capture?.[NAMEPLATE_KEY] ?? "").split(",").map((x) => x.trim()).filter(Boolean)
export function nameplateRemaining(w: PPWorkOrder, o: PPOperation) {
  const ok = new Set(verifiedSerials(o))
  return w.serials.filter((s) => !ok.has(s))
}
