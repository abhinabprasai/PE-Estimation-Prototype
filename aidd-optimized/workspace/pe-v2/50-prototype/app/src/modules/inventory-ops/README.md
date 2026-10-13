# Module group: inventory-ops

> **What this is.** The owner's guide for `src/modules/inventory-ops/`. Inventory Operations (gap closure): mobile counts, warehouse tasks, the supervisor board, the GRN delta for the supplier technical package, period-close additions and the intercompany recon. New group, created by the feature mapper on 12 October 2026.
>
> **Where it stands.** All seven screens built (routes wired 13 Oct 2026). The count documents (INV-COUNT-DOC, `/inventory/counts`) and safety stock are already built in `materials`: link to them, do not rebuild them. Mobile screens use `layout: "kiosk"` (TC77 is a handheld; no sidebar).
>
> **What we need from you.** Build the screens below inside this folder. Counts, GRN and period close touch `materials`, `admin` (period control) and `purchasing-finance`: use events and the shared domain rather than imports.

Read first: `50-prototype/APP-ARCHITECTURE.md`.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-INV-MCOUNT | Mobile count entry (TC77) | `/mobile/counts` | Kiosk (design value) | W6 | FL-06 | Inventory Operations (Gap Closure) | full |
| FX-INV-COUNTSHEETS | Count plan: Generate Count Sheets | `/inventory-ops/count-sheets` | Wizard (design value) | W6 | FL-06 | Inventory Operations (Gap Closure) | full |
| FX-INV-WTASKS | Warehouse task mobile work queue | `/mobile/warehouse-tasks` | Kiosk (design value) | W6 | FL-03, FL-09 | Inventory Operations (Gap Closure) | full |
| FX-INV-WBOARD | Warehouse task supervisor board | `/inventory-ops/task-board` | Workbench (design value) | W6 | - | Inventory Operations (Gap Closure) | full |
| FX-INV-GRN | Goods receipt with supplier technical package delta | `/inventory-ops/goods-receipts`, `/inventory-ops/goods-receipts/:id` | List (design value) | W6 | FL-10, FL-03 | Inventory Operations (Gap Closure) | full |
| FX-INV-PCLOSE | Period-close checklist additions | `/inventory-ops/period-close` | Detail (design value) | W6 | FL-06 | Inventory Operations (Gap Closure) | full |
| FX-INV-ICREC | Intercompany pairing indicators and recon report | `/inventory-ops/intercompany-recon` | Dashboard (design value) | W6 | FL-07 | Inventory Operations (Gap Closure) | full |

## State

Slice key `inventoryOps` (InventoryOpsState): warehouse tasks, dock receipts, GRN certificate checks, close runs and tie-out explanations, intercompany pairs, count plan runs. Counts themselves stay in `materials`. Readings RD-IO-01..17 are defined in `lib/readings.ts` and shown on screen as reading chips; they are design values where the PRD is silent.

## Cross-module events

Module-only events (augmented in `data/slice.ts`): inventoryOps.taskCompleted, countSubmitted, countSheetsGenerated, receiptPosted, closeValidated. Consumes purchasing.grnPosted. Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder.

## Rules

- Status words verbatim from the S-1..S-43 catalog; a record with no list in the specification shows no badge (APP-ARCHITECTURE section 7).
- Where the PRD is silent, choose a value, show it as a reading (`Chip kind="oq"`), and log it. Never state an invented rule as fact.
- Every feature row for this group (below) must end up visible and working.

## Requests to foundation

| ID | File | Change | Needed by |
|---|---|---|---|
