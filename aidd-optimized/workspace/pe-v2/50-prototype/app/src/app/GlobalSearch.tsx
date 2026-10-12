// Global search (Ctrl/Cmd+K or the header button): documents from every module slice's search
// provider, the seeded spine headers, shared master data, and the screen registry.
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { StatusBadge } from "@/components/patterns"
import { docLabel, docRoute, refKey } from "@/data/domain"
import { CUSTOMERS, MATERIALS, SPINE_DOCS, VENDORS } from "@/data/shared"
import { SCREENS } from "@/data/screens"
import { store, useStoreVersion, type SearchHit } from "@/store"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const version = useStoreVersion()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const groups = useMemo(() => {
    const docs: SearchHit[] = [...store.search()]
    const seen = new Set(docs.filter((d) => d.ref).map((d) => refKey(d.ref!)))
    for (const s of SPINE_DOCS)
      if (!seen.has(refKey(s.ref))) docs.push({ title: s.ref.id, subtitle: `${docLabel(s.ref)} · ${s.title}`, route: docRoute(s.ref), ref: s.ref, status: s.status, group: "Hero thread (spine)" })
    const master: SearchHit[] = [
      ...CUSTOMERS.map((c) => ({ title: c.id, subtitle: `Customer · ${c.name}`, route: `/sales/customers/${c.id}`, status: { kind: "customer" as const, value: c.status }, group: "Master data" })),
      ...VENDORS.map((v) => ({ title: v.id, subtitle: `Vendor · ${v.name}`, route: `/purchasing/vendors/${v.id}`, status: { kind: "vendorOnboarding" as const, value: v.onboarding }, group: "Master data" })),
      ...MATERIALS.map((m) => ({ title: m.id, subtitle: `Material ${m.type} · ${m.description}`, route: `/inventory/items/${m.id}`, status: { kind: "material" as const, value: m.status }, group: "Master data" })),
    ]
    const screens: SearchHit[] = SCREENS.filter((s) => !s.route.includes(":")).map((s) => ({ title: `${s.id} ${s.title}`, subtitle: `${s.module} · ${s.archetype} · ${s.wave}`, route: s.route, group: "Screens" }))
    const byGroup = new Map<string, SearchHit[]>()
    for (const h of [...docs, ...master, ...screens]) byGroup.set(h.group, [...(byGroup.get(h.group) ?? []), h])
    return [...byGroup.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, open])

  return (
    <>
      <Button variant="outline" className="h-8 w-56 justify-start bg-background text-muted-foreground" onClick={() => setOpen(true)} aria-keyshortcuts="Control+K Meta+K">
        <Search aria-hidden="true" /> Search documents
        <kbd className="ml-auto rounded border px-1 text-xs">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search documents" description="Search every document, master record and screen">
        <Command>
          <CommandInput placeholder="Type an ID, a name or a screen" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No match.</CommandEmpty>
            {groups.map(([g, hits]) => (
              <CommandGroup key={g} heading={g}>
                {hits.map((h) => (
                  <CommandItem
                    key={g + h.title + h.route}
                    value={`${h.title} ${h.subtitle ?? ""}`}
                    onSelect={() => {
                      setOpen(false)
                      nav(h.route)
                    }}
                  >
                    <span className="font-mono text-sm">{h.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                    {h.status && <StatusBadge kind={h.status.kind} status={h.status.value} size="sm" className="ml-auto" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
