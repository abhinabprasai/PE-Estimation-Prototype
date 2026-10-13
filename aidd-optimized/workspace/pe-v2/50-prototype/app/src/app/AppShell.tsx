// App shell: prototype banner, entity context bar (screen id, record, acting role, search, reset)
// and the sidebar over all PRD modules, grouped by module group. Navigation is generated from the
// screen registry (84 PRD entries plus the feature-list entries), so every entry is reachable from day one; module `nav` entries
// add shortcuts. Foundation-owned.

import { useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { BarChart3, Bell, ChevronRight, Circle, CircleCheck, CircleDashed, Inbox, LayoutTemplate, UserRound, type LucideIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ROLE_GROUPS, type Role } from "@/data/domain"
import { SECTIONS } from "@/data/modules"
import { SCREENS, screenForPath, type Built } from "@/data/screens"
import { OPEN_PERIOD, TODAY, defaultUserFor } from "@/data/shared"
import { fmtDate } from "@/lib/format"
import { store, useRole, useSlice } from "@/store"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { LEGAL_ENTITIES } from "@/data/shared"
import { crumbsFor } from "@/modules/shell/lib/crumbs"
import { shellActions } from "@/modules/shell/data/actions"
import { GlobalSearch } from "./GlobalSearch"
import { useModules } from "./modules-context"
import { cn } from "@/lib/utils"

export function PrototypeBanner() {
  return (
    <div role="note" className="bg-status-exception px-4 py-1 text-center text-sm font-semibold text-status-exception-ink">
      Prototype of the full PRD, kept as a deliverable. Built to be corrected; nothing here is confirmed. Identifiers with TBD are placeholders (Reading OQ-30).
    </div>
  )
}

function RoleSwitcher() {
  const [role, setRole] = useRole()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="acting-role" className="text-sm whitespace-nowrap">
        Acting as
      </label>
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger id="acting-role" className="w-56 bg-background text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[70vh]">
          {(Object.keys(ROLE_GROUPS) as (keyof typeof ROLE_GROUPS)[]).map((g) => (
            <SelectGroup key={g}>
              <SelectLabel>{g}</SelectLabel>
              {ROLE_GROUPS[g].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <span className="hidden text-xs opacity-90 2xl:inline">{defaultUserFor(role).name}</span>
    </div>
  )
}

/** Entity selector (every screen carries it, ACC section 2). The choice lives in the shell slice. */
function EntitySelector() {
  const sh = useSlice("shell")
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="entity-select" className="text-sm whitespace-nowrap">
        Entity
      </label>
      <Select value={sh.entityId} onValueChange={(v) => shellActions.setEntity(v)}>
        <SelectTrigger id="entity-select" className="w-48 bg-background text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEGAL_ENTITIES.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Notification bell with the unread count, and the profile link. */
function BellAndProfile() {
  const sh = useSlice("shell")
  const [role] = useRole()
  const unread = sh.notifications.filter((n) => !n.dismissed && !n.read).length
  const critical = sh.notifications.some((n) => !n.dismissed && !n.read && n.severity === "Critical")
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon" className="relative text-foreground" aria-label={`Notifications, ${unread} unread${critical ? ", including critical" : ""}`}>
        <Link to="/notifications">
          <Bell aria-hidden="true" />
          {unread > 0 && <span className="tabular absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">{unread}</span>}
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon" className="text-foreground" aria-label={`Profile and preferences, ${defaultUserFor(role).name}`}>
        <Link to="/profile">
          <UserRound aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}

function Crumbs() {
  const loc = useLocation()
  const trail = crumbsFor(loc.pathname)
  if (trail.length < 2) return null
  return (
    <Breadcrumb className="print:hidden">
      <BreadcrumbList>
        {trail.map((c, i) => (
          <span key={i} className="contents">
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>{c.to && i < trail.length - 1 ? <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{c.label}</BreadcrumbPage>}</BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function ContextBar() {
  const loc = useLocation()
  const [confirm, setConfirm] = useState(false)
  const screen = screenForPath(loc.pathname)
  const record = decodeURIComponent(loc.pathname.split("/").filter(Boolean).at(-1) ?? "")
  const showRecord = /[A-Z]{2,}-/.test(record)
  return (
    <header className="sticky top-0 z-20 flex min-h-12 print:hidden flex-wrap items-center gap-4 bg-primary px-6 py-2 text-primary-foreground">
      <SidebarTrigger className="text-primary-foreground" />
      <span className="font-semibold">PE Transformer ERP</span>
      {screen && (
        <span>
          <span className="font-mono text-sm">{screen.id}</span> {screen.title}
        </span>
      )}
      {showRecord && <span className="tabular font-mono text-sm">{record}</span>}
      <span className="text-xs opacity-90">
        Today: {fmtDate(TODAY)} · open period {OPEN_PERIOD}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <GlobalSearch />
        <EntitySelector />
        <RoleSwitcher />
        <BellAndProfile />
        <Button variant="outline" className="text-foreground" onClick={() => setConfirm(true)}>
          Scenario reset
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the seed data?</AlertDialogTitle>
            <AlertDialogDescription>Every module's data returns to the seed. Everything changed in this session is lost. The acting role stays.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => store.reset()}>Restore seed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}

const BUILT_ICON: Record<Built, LucideIcon> = { full: CircleCheck, partial: Circle, none: CircleDashed }
const BUILT_LABEL: Record<Built, string> = { full: "built", partial: "partly built", none: "not built yet" }

function AppSidebar() {
  const loc = useLocation()
  const modules = useModules()
  const current = screenForPath(loc.pathname)
  const builtOf = (id: string, base: Built): Built => modules.find((m) => m.built[id])?.built[id] ?? base
  const linkFor = (route: string) => (route.includes(":") ? route.replace(/\/:[^/]+.*$/, "") : route)
  return (
    <Sidebar className="top-auto">
      <SidebarContent className="pt-16 pb-8">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={loc.pathname === "/approvals"}>
                <Link to="/approvals">
                  <Inbox aria-hidden="true" /> <span>Approvals inbox</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={loc.pathname === "/coverage"}>
                <Link to="/coverage">
                  <BarChart3 aria-hidden="true" /> <span>Coverage</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={loc.pathname === "/dev/templates"}>
                <Link to="/dev/templates">
                  <LayoutTemplate aria-hidden="true" /> <span>Template gallery</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {SECTIONS.map((g) => {
          const groupScreens = SCREENS.filter((s) => g.modules.includes(s.module))
          const prdModules = g.modules.filter((m) => groupScreens.some((s) => s.module === m))
          const extra = modules.flatMap((m) => m.nav)
          return (
            <SidebarGroup key={g.id}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {prdModules.map((pm) => {
                    const screens = groupScreens.filter((s) => s.module === pm)
                    const open = screens.some((s) => s.id === current?.id)
                    return (
                      <Collapsible key={pm} defaultOpen={open} className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton>
                              <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                              <span>{pm}</span>
                              <span className="tabular ml-auto text-xs text-muted-foreground">{screens.length}</span>
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {screens.map((s) => {
                                const b = builtOf(s.id, s.built)
                                const Icon = BUILT_ICON[b]
                                return (
                                  <SidebarMenuSubItem key={s.id}>
                                    <SidebarMenuSubButton asChild isActive={current?.id === s.id}>
                                      <Link to={linkFor(s.route)} title={`${s.id} · ${s.archetype} · ${s.wave} · ${BUILT_LABEL[b]}`}>
                                        <Icon aria-label={BUILT_LABEL[b]} className={cn("size-3", b === "none" && "text-muted-foreground")} />
                                        <span className={cn(b === "none" && "text-muted-foreground")}>{s.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                )
                              })}
                              {extra
                                .filter((e) => e.module === pm)
                                .map((e) => (
                                  <SidebarMenuSubItem key={e.to}>
                                    <SidebarMenuSubButton asChild isActive={loc.pathname + loc.search === e.to}>
                                      <Link to={e.to}>
                                        {e.icon && <e.icon className="size-3" aria-hidden="true" />}
                                        <span>{e.label}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
    </Sidebar>
  )
}

export function OfficeLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ContextBar />
        <main className="p-6">
          <div className="mb-4">
            <Crumbs />
          </div>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
