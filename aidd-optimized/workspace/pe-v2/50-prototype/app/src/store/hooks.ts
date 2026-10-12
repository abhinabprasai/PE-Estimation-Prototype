// React bindings for the root store.
import { useCallback, useEffect, useSyncExternalStore } from "react"
import type { Role } from "@/data/domain"
import { store, type MutateCtx, type Result } from "./core"
import type { DomainEvents, EventName } from "./events"
import type { SliceStates } from "./types"

/** Re-render on any store change. */
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, store.getVersion)
}

/** Read one module slice (typed by the module's SliceStates augmentation). */
export function useSlice<K extends keyof SliceStates>(key: K): SliceStates[K] {
  useStoreVersion()
  return store.getSlice(key)
}

/** Atomic write to one slice. Returns ok/error; never throws for a ProtoError. */
export function useMutate<K extends keyof SliceStates>(key: K) {
  return useCallback(<T>(fn: (draft: SliceStates[K], ctx: MutateCtx) => T): Result<T> => store.mutate(key, fn), [key])
}

export function useRole(): [Role, (r: Role) => void] {
  useStoreVersion()
  return [store.getCore().role, (r: Role) => store.setRole(r)]
}

export function useCore() {
  useStoreVersion()
  return store.getCore()
}

/** Subscribe a component to a cross-module event for its lifetime (UI reactions only; state
 *  reactions belong in a slice's `subscribe`). */
export function useEvent<K extends EventName>(type: K, handler: (p: DomainEvents[K]) => void) {
  useEffect(() => store.bus.on(type, handler), [type, handler])
}
