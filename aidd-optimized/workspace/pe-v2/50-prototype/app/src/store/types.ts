// Slice state registry. Empty on purpose: each module adds its own key by augmentation inside its
// folder, so this file never changes when a module adds state:
//
//   // src/modules/materials/data/slice.ts
//   declare module "@/store/types" {
//     interface SliceStates { materials: MaterialsState }
//   }
//
// useSlice("materials") is then typed as MaterialsState everywhere.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SliceStates {}
