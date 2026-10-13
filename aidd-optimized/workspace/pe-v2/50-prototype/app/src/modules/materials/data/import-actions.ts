// Bulk import (Book II §16.2): a file is checked column by column against the current template.
// Any column difference rejects the whole file with the diff. A matching file creates MCRs (new
// materials, C-47) or one MCH per changed column; rows that fail a rule are counted and named.

import { ProtoError, store, type MutateCtx } from "@/store"
import type { Material } from "@/data/domain"
import { diffColumns, templateOf, TEMPLATE_VERSION } from "../lib/import-templates"
import { createMchIn, createMcrIn, readField, validateMchRow, type MchRowDraft } from "./actions"
import { fieldDef } from "../lib/rules"
import { getMaterial, nextSeq, type MaterialsState } from "./state"
import type { ImportJob } from "./ext"

const mutate = <T>(fn: (d: MaterialsState, ctx: MutateCtx) => T) => store.mutate("materials", fn)
const need = (ok: unknown, msg: string, field?: string) => {
  if (!ok) throw new ProtoError(msg, field)
}

export interface ImportInput {
  view: string
  fileName: string
  version?: string
  header: string[]
  rows: string[][]
}
export interface ImportOutcome {
  job: ImportJob
  errors: string[]
}

export function runImport(i: ImportInput) {
  return mutate((d, ctx): ImportOutcome => {
    const t = templateOf(i.view)
    need(t, "Choose the view the file belongs to.", "view")
    need(i.fileName.trim(), "Choose a file.", "file")
    need(i.header.length > 0, "The file has no header row.", "file")
    const id = `IMP-${String(nextSeq(d)).padStart(4, "0")}`
    const diffs = diffColumns(t!, i.header, i.version)
    const base = { id, view: i.view, fileName: i.fileName, templateVersion: i.version ?? TEMPLATE_VERSION, uploadedOn: ctx.today, by: ctx.userId, rows: i.rows.length }
    if (diffs.length) {
      const job: ImportJob = { ...base, outcome: "Rejected", diffs, created: [], rowErrors: 0 }
      d.x.imports.unshift(job)
      return { job, errors: [] }
    }
    const errors: string[] = []
    const created: ImportJob["created"] = []
    const col = (r: string[], name: string) => r[i.header.indexOf(name)] ?? ""
    if (t!.mode === "new") {
      i.rows.forEach((r, n) => {
        try {
          const type = col(r, "Type") as Material["type"]
          const mcrId = createMcrIn(d, ctx, {
            type, description: col(r, "Description"), groupL1: col(r, "Group L1"), groupL2: col(r, "Group L2"), uom: col(r, "Base UoM") || "EA", path: "Migration",
            manufacturer: col(r, "Manufacturer") || undefined, mpn: col(r, "Manufacturer part") || undefined, duplicateNote: "Bulk import row; steward reviews duplicates in the creation request",
          })
          created.push({ kind: "MCR", id: mcrId })
        } catch (e) {
          if (!(e instanceof ProtoError)) throw e
          errors.push(`Row ${n + 2}: ${e.message}`)
        }
      })
    } else {
      for (const c of t!.columns.filter((x) => x !== "Material")) {
        const key = t!.fieldKeys![c]
        const drafts: MchRowDraft[] = []
        i.rows.forEach((r, n) => {
          const v = col(r, c)
          const mid = col(r, "Material")
          if (!v) return
          if (!getMaterial(d, mid)) {
            errors.push(`Row ${n + 2}: material ${mid || "(blank)"} not found`)
            return
          }
          const err = validateMchRow(d, mid, key, v)
          if (err) errors.push(`Row ${n + 2} (${mid}, ${c}): ${err}`)
          else drafts.push({ materialId: mid, old: readField(d, mid, key), new: v })
        })
        if (!drafts.length) continue
        need(fieldDef(key), `Field ${c} is not changeable.`)
        const mchId = createMchIn(d, ctx, { title: `Bulk import ${i.fileName}: ${c}`, fieldKey: key, mode: "Set", rows: drafts, apply: "Immediate", reason: `Bulk import ${id} (${i.fileName})` })
        created.push({ kind: "MCH", id: mchId })
      }
    }
    need(created.length > 0 || errors.length === 0, `No row could be imported: ${errors[0]}`)
    const job: ImportJob = { ...base, outcome: "Accepted", diffs: [], created, rowErrors: errors.length }
    d.x.imports.unshift(job)
    return { job, errors }
  })
}
