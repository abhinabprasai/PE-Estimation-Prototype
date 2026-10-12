// The registered module definitions, provided by the app shell. Lets a page read other modules'
// contributions (WF-INBOX sections, coverage claims) without importing their folders.
import { createContext, useContext } from "react"
import type { ModuleDef } from "./module-types"

export const ModulesContext = createContext<ModuleDef[]>([])
export const useModules = () => useContext(ModulesContext)
