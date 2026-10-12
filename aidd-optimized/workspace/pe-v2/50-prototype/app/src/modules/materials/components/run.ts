// Result helpers for screens: show the outcome of a materials action as a toast.
import { toast } from "sonner"
import type { Result } from "@/store"

/** Button action: toast success or the rule message. Returns true on success. */
export function run<T>(r: Result<T>, msg: string | ((v: T) => string)): boolean {
  if (!r.ok) {
    toast.error(r.error)
    return false
  }
  toast.success(typeof msg === "function" ? msg(r.value) : msg)
  return true
}

/** Dialog confirm: return the rule message to keep the dialog open, or null (and a toast) to close. */
export function confirmRun<T>(r: Result<T>, msg: string | ((v: T) => string)): string | null {
  if (!r.ok) return r.error
  toast.success(typeof msg === "function" ? msg(r.value) : msg)
  return null
}
