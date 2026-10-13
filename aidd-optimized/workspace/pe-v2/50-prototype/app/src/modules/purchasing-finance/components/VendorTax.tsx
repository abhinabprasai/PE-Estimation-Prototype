// PUR-VEND-001/2 tab "Tax profile" [Part A §11.3]: tax registrations by jurisdiction, default tax code, the
// exemption certificate state (a read-only embed of ACC 19.2 records), use-tax accrual and the tax address role
// (Ship-To by default, Bill-To for services). Maintained by Finance roles <Reading OQ-PF-31>.
import { useState } from "react"
import { Link } from "react-router"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Chip, EmptyState, KV } from "@/components/patterns"
import { fmtDate } from "@/lib/format"
import { useSlice } from "@/store"
import type { TaxRegistration, VendorTaxProfile } from "../data/xtypes"
import { saveVendorTax } from "../data/xactions"
import { TAX_CODES } from "../data/xseed"
import { Reading, report, Section } from "./common"
import { SelectField, TextField, userName } from "./bits"
import { writeProps, type NineStates } from "./states"

const KINDS: TaxRegistration["kind"][] = ["State sales/use tax", "Province GST/HST", "VAT / other"]

export function VendorTaxTab({ vendorId, st }: { vendorId: string; st?: NineStates }) {
  const s = useSlice("purchasingFinance")
  const prof = s.vendorTax[vendorId] as VendorTaxProfile | undefined
  const [edit, setEdit] = useState(false)
  const wr = st ? writeProps(st) : {}
  if (!prof && !edit)
    return (
      <div className="flex flex-col items-start gap-2">
        <EmptyState title="No tax profile yet">Registrations, the default tax code and the use-tax setting are held here and read by AP at invoice entry.</EmptyState>
        <Button {...wr} onClick={() => setEdit(true)}>Create tax profile</Button>
      </div>
    )
  return edit ? (
    <TaxForm vendorId={vendorId} initial={prof} onDone={() => setEdit(false)} />
  ) : (
    <div className="flex flex-col gap-4">
      <Section title="Registrations" action={<Button size="sm" variant="outline" {...wr} onClick={() => setEdit(true)}>Edit tax profile</Button>}>
        {prof!.registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registrations on file.</p>
        ) : (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Registration number</TableHead>
                <TableHead>Kind</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prof!.registrations.map((r) => (
                <TableRow key={r.jurisdiction} className="h-8 text-[13px]">
                  <TableCell className="font-medium">{r.jurisdiction}</TableCell>
                  <TableCell className="font-mono">{r.number}</TableCell>
                  <TableCell>{r.kind}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title="Defaults">
        <dl className="grid gap-3 sm:grid-cols-3">
          <KV k="Default tax code">{prof!.defaultTaxCode}</KV>
          <KV k="Use-tax accrual">{prof!.useTaxAccrual ? "On: AP accrues use tax where the vendor charges none" : "Off"}</KV>
          <KV k="Tax address role">{prof!.taxAddressRole === "Ship-To" ? "Ship-To (default, goods)" : "Bill-To (services)"}</KV>
          <KV k="Last saved">{prof!.updatedOn ? `${fmtDate(prof!.updatedOn)} by ${userName(prof!.updatedBy)}` : "Not recorded"}</KV>
        </dl>
        <p className="text-xs text-muted-foreground">Maintained by the Controller or an AP clerk <Reading id="OQ-PF-31" /></p>
      </Section>
      <Section
        title="Exemption certificates (from accounting)"
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/configuration/tax">Add in accounting</Link>
          </Button>
        }
      >
        {prof!.certificates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificate on file. Purchases from this vendor are taxed or accrued per the default code.</p>
        ) : (
          <Table>
            <TableHeader className="bg-table-head">
              <TableRow>
                <TableHead>Certificate</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prof!.certificates.map((c) => (
                <TableRow key={c.id} className="h-8 text-[13px]">
                  <TableCell className="font-mono">{c.id}</TableCell>
                  <TableCell>{c.jurisdiction}</TableCell>
                  <TableCell>
                    {c.state}
                    {c.state === "Expired" && <> <Chip kind="block">Expired: tax applies</Chip></>}
                    {c.state === "Pending" && <> <Chip kind="flag">Not yet verified</Chip></>}
                  </TableCell>
                  <TableCell>{c.expires ? fmtDate(c.expires) : "No date"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">Read-only here: certificates are records of ACC 19.2, which owns their upload and verification.</p>
      </Section>
    </div>
  )
}

function TaxForm({ vendorId, initial, onDone }: { vendorId: string; initial?: VendorTaxProfile; onDone: () => void }) {
  const [regs, setRegs] = useState<TaxRegistration[]>(initial?.registrations ?? [])
  const [code, setCode] = useState(initial?.defaultTaxCode ?? TAX_CODES[1])
  const [accrual, setAccrual] = useState(initial?.useTaxAccrual ?? false)
  const [role, setRole] = useState<"Ship-To" | "Bill-To">(initial?.taxAddressRole ?? "Ship-To")
  const [err, setErr] = useState<string | null>(null)
  const setReg = (i: number, p: Partial<TaxRegistration>) => setRegs(regs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <Section title="Edit tax profile">
      <div className="flex flex-col gap-4">
        {regs.map((r, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[120px_1fr_200px_auto]">
            <TextField id={`tr-j-${i}`} label="Jurisdiction" value={r.jurisdiction} onChange={(v) => setReg(i, { jurisdiction: v.toUpperCase() })} />
            <TextField id={`tr-n-${i}`} label="Registration number" value={r.number} onChange={(v) => setReg(i, { number: v })} />
            <SelectField id={`tr-k-${i}`} label="Kind" value={r.kind} onChange={(v) => setReg(i, { kind: v })} options={KINDS.map((k) => ({ value: k, label: k }))} />
            <Button variant="ghost" size="sm" onClick={() => setRegs(regs.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button variant="outline" size="sm" onClick={() => setRegs([...regs, { jurisdiction: "", number: "", kind: "State sales/use tax" }])}>
            <Plus aria-hidden="true" /> Add registration
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField id="tax-code" label="Default tax code" value={code} onChange={setCode} options={TAX_CODES.map((c) => ({ value: c, label: c }))} />
          <SelectField id="tax-role" label="Tax address role" value={role} onChange={setRole} options={[{ value: "Ship-To", label: "Ship-To (default)" }, { value: "Bill-To", label: "Bill-To (services)" }]} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="tax-accrual" checked={accrual} onCheckedChange={setAccrual} />
          <Label htmlFor="tax-accrual">Use-tax accrual when the vendor charges no tax</Label>
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const e = report(saveVendorTax(vendorId, { registrations: regs, defaultTaxCode: code, useTaxAccrual: accrual, taxAddressRole: role }), "Tax profile saved")
              if (e) setErr(e)
              else onDone()
            }}
          >
            Save tax profile
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </Section>
  )
}
