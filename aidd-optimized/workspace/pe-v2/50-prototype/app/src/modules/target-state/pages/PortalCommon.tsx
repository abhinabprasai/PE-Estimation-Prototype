// Shared header of every portal screen: the portal is an external skin over the same services; every call carries the
// partner scope and row level security confines a vendor to its own POs and a customer to its own orders (Book IX §4.1).
// The partner switch exists only in the prototype, to let a reviewer see another partner's scope.
import { Link } from "react-router"
import { Chip } from "@/components/patterns"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CUSTOMERS, VENDORS } from "@/data/shared"
import { useMutate, useSlice } from "@/store"

export function PortalBar({ kind }: { kind: "supplier" | "customer" }) {
  const s = useSlice("targetState")
  const mutate = useMutate("targetState")
  const scope = kind === "supplier" ? s.portal.scope.supplier : s.portal.scope.customer
  const who = s.portal.signedIn[kind]
  const user = s.portal.users.find((u) => u.id === who)
  const partners = kind === "supplier" ? s.portal.users.filter((u) => u.kind === "supplier").map((u) => u.partnerId) : s.portal.users.filter((u) => u.kind === "customer").map((u) => u.partnerId)
  const uniq = [...new Set(partners)]
  const name = (id: string) => (kind === "supplier" ? VENDORS.find((v) => v.id === id)?.name : CUSTOMERS.find((c) => c.id === id)?.name) ?? id
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
      <Chip kind="design">External {kind} portal skin</Chip>
      <span className="min-w-0 flex-1">
        {user ? <>Signed in as <span className="font-medium">{user.name}</span> for <span className="font-medium">{name(scope)}</span>.</> : <>Not signed in through the external identity tenant. <Link className="text-link underline" to="/target/portals/sign-in">Sign in</Link> or use the prototype partner switch.</>}{" "}
        Every call carries the scope <span className="font-mono">{scope}</span>; rows outside it are not returned.
      </span>
      <Label htmlFor="pb-partner" className="text-xs text-muted-foreground">Prototype partner</Label>
      <Select value={scope} onValueChange={(v) => mutate((d) => { d.portal.scope[kind] = v })}>
        <SelectTrigger id="pb-partner" size="sm" className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>{uniq.map((id) => <SelectItem key={id} value={id}>{name(id)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}

export function usePortalScope(kind: "supplier" | "customer") {
  const s = useSlice("targetState")
  return kind === "supplier" ? s.portal.scope.supplier : s.portal.scope.customer
}

export const CHECK_PORTAL = "The portal is an external skin: the same services, authorization engine and validations as internal screens. A portal action that could bypass one internal rule disqualifies the build."
