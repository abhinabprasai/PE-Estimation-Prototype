// PostingPreview: shows the journal entries an action will post, BEFORE the user commits, using the
// specification's templates #17..#38 (src/data/domain/postings.ts). Accounts come only from the
// template; a screen supplies the template number, the amount and a detail line. Every posting goes
// through the one shared Posting Service [DOC:p.125 Part J] (asserted).

import { BookOpen } from "lucide-react"
import { POSTING_TEMPLATES, type PostingLine } from "@/data/domain"
import { fmtMoney } from "@/lib/format"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function PostingPreview({ lines, title = "Postings on commit", period, className }: { lines: PostingLine[]; title?: string; period?: string; className?: string }) {
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0)
  return (
    <section aria-label={title} className={cn("rounded-lg border", className)}>
      <h3 className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
        <BookOpen className="size-4" aria-hidden="true" /> {title}
        {period && <span className="font-normal text-muted-foreground">· fiscal period {period}</span>}
      </h3>
      <Table>
        <TableHeader className="bg-table-head">
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead>Debit</TableHead>
            <TableHead>Credit</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l, i) => {
            const t = POSTING_TEMPLATES[l.template]
            return (
              <TableRow key={i} className="h-8 text-[13px] align-top">
                <TableCell className="font-mono">#{t.no}</TableCell>
                <TableCell>
                  {t.transaction}
                  <div className="text-xs text-muted-foreground">{l.detail ?? `${t.basis}; ${t.trigger}`}</div>
                </TableCell>
                <TableCell>{t.debit}</TableCell>
                <TableCell>{t.credit}</TableCell>
                <TableCell className="tabular text-right">{l.amount == null ? <span className="text-muted-foreground">{l.notPostedReason ?? "not posted"}</span> : fmtMoney(l.amount, l.currency)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="flex justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>Posts through the shared Posting Service; templates per [DOC:pp.124-125 Part J] (asserted).</span>
        <span className="tabular">Total {fmtMoney(total, lines[0]?.currency)}</span>
      </p>
    </section>
  )
}
