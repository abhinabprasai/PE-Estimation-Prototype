// Root store public API. Read-only for module agents (see 50-prototype/APP-ARCHITECTURE.md).
export { store, defineSlice, ProtoError, type Result, type SliceDef, type StoreApi, type MutateCtx, type SearchHit, type ApprovalRequest, type CoreState } from "./core"
export { EventBus, type DomainEvents, type EventName } from "./events"
export type { SliceStates } from "./types"
export { useSlice, useMutate, useRole, useCore, useEvent, useStoreVersion } from "./hooks"
