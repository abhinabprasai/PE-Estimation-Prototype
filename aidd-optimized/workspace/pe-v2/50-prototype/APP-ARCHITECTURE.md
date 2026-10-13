# App architecture for module agents - pe-v2 prototype

> **What this is.** The rules and recipes for building screens in the full-PRD prototype at `50-prototype/app/`. It covers which folder you own, how to add a route, use a page template, seed data, add store state, and send or receive a cross-module event. Ten module groups build in parallel, so the contracts below are what keep you out of each other's way.
>
> **Where it stands.** Feature-mapper pass, 12 October 2026. The user's feature list (`00-inputs/feature-list-2026-10.md`) now defines scope together with the PRD. The registry holds 84 PRD entries (all built by the seven original groups) plus 201 feature-list entries (`src/data/screens-features.ts`, `source: "feature-list"`, built "none"), 285 in all. Every entry is routed: built screens render, and the rest show a "Not built yet" placeholder. Three new groups exist as scaffolds: `shell`, `inventory-ops`, `target-state`. `npm run build` passes with zero TypeScript errors.
>
> **What we need from you.** Build only inside `src/modules/<your group>/`. When you need a change in a shared file, write it in your group README under "Requests to foundation" and carry on without it.

Stack: Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn/ui (radix-nova), react-router 8. No backend: all state is in memory, and **Scenario reset** restores the seed. Run it with `cd 50-prototype/app && npm run dev` (port 5174). Stop the dev server when you are done.

## 1. Folder ownership

```
src/
  modules/
    sales/                 OWNER: sales agent (Sales 8 + Returns 5; holds the FL-09 build)
    materials/             OWNER: materials agent (Materials 10 + Book VII inventory 4)
    engineering/           OWNER: engineering agent (Engineering 6 + CAD and Documents 4)
    planning-production/   OWNER: planning-production agent (Planning 5 + Production 8)
    quality-trace/         OWNER: quality-trace agent (Quality 8 + Traceability 3)
    purchasing-finance/    OWNER: purchasing-finance agent (Purchasing 6 + Costing 8 + Controlling 3)
    admin/                 OWNER: admin agent (Workflow and Administration 4 + Book VII config 2, plus the feature-list config, approvals and notification pages)
    shell/                 OWNER: shell agent (global shell features, system states, notification center, profile, SSO and MFA states, error pages, role dashboards, print outputs and document previews, the component gallery, flow prototypes and handoff register). Also owns src/app/AppShell.tsx and GlobalSearch.tsx for the shell rows
    inventory-ops/         OWNER: inventory-ops agent (mobile counts, warehouse tasks, supervisor board, GRN STP delta, period-close additions, IC recon)
    target-state/          OWNER: target-state agent (every Book IX module, sidebar section "Target state (phased)")
      README.md            what the group owns, spine documents to seed, events, Requests to foundation
      index.ts(x)          exports `def: ModuleDef` (routes, nav, slices, built claims)
      routes.tsx           route array, extra nav entries, `built` claims
      pages/               your screens
      data/slice.ts        your store slice: state type, seed(), search, links, subscribe
      (any other subfolders you need: components/, lib/ ...)
    registry.ts            SHARED (lists the ten groups; pre-filled)
  app/                     SHARED: shell, sidebar, role switcher, search, placeholder, /coverage, /dev gallery
  components/ui/           SHARED: shadcn components
  components/patterns/     SHARED: StatusBadge, DataTable, DocumentFlowPanel, ApprovalButton, PostingPreview, ScanField, chips
  components/templates/    SHARED: one page template per archetype
  data/domain/             SHARED: entity types, status catalog, typed IDs, document flow, postings, scans, approval limits, roles
  data/shared/             SHARED: master data and the hero-thread spine
  data/screens.ts          SHARED: the 84-entry PRD screen registry (+ the feature-list entries below)
  data/screens-features.ts SHARED: the 201 feature-list entries (components, shell, dashboards, dialogs, config, reports, print, mobile, target state)
  data/modules.ts          SHARED: group names, PRD-module names, and SECTIONS (the sidebar sections)
  store/                   SHARED: root store, event bus, hooks
  lib/                     SHARED: cn(), formatting
  index.css                SHARED: design tokens
```

**Group ownership of the new groups.** `shell` may edit `src/app/AppShell.tsx`, `src/app/GlobalSearch.tsx` and the `/` redirect in `src/App.tsx` for the global-shell rows only (entity selector, breadcrumbs, search results page, notification bell, profile menu, role landing page). It never touches the sidebar generation or `/coverage`. `inventory-ops` and `target-state` follow the general rule.

**You may not edit any SHARED path**, nor `package.json`, `vite.config.ts`, `tsconfig*.json` or `components.json`. In particular:

- `src/App.tsx`, `src/main.tsx`, `src/index.css`
- everything under `src/app/`, `src/components/`, `src/data/`, `src/store/`, `src/lib/`, `src/hooks/`
- `src/modules/registry.ts`
- another group's folder. You may **import** from another group only through what it exports in its `index.ts(x)`. Prefer events and the shared domain to imports.

No new npm packages. If you need one, request it.

**How to request a shared change.** Add a row to "Requests to foundation" at the end of your group's README: the file, the change, and the screen or rule that needs it. Then work around it locally: extend a type by intersection, keep a helper in your folder, or use a design value with a `Chip kind="design"`. The integration pass applies the requests.

## 2. Add a route

Every registry screen already has a placeholder route at its registry path (see the table in your README). To build a screen, add a route in your `routes.tsx` with **the same path**. The shell drops the placeholder for any path a module claims.

```tsx
// src/modules/materials/routes.tsx
import { MaterialList } from "./pages/MaterialList"
export const routes: ModuleRoute[] = [
  { path: "/inventory/items", element: <MaterialList />, screenId: "MM-MAT-001" },
]
export const built = { "MM-MAT-001": "full" }   // or "partial"
```

- `screenId` ties the route to the registry, and the context bar uses it.
- `built` is your claim; `/coverage` and the sidebar markers read it. Keep it honest: "partial" if a state or an action is missing.
- `layout: "kiosk"` gives a full-screen floor-touch page with no sidebar. Use it for PP-SFT-001, RMA-RECEIPT and the pack station.
- Paths outside the registry (a sub-page or a wizard step) are allowed when they start with your screen's path.
- Extra sidebar links go in `nav` with the PRD module name they sit under (`module: "Production"`). The sidebar already lists every registry screen, grouped by `SECTIONS` in `data/modules.ts`: Home and dashboards; the seven original groups; Inventory operations; Print outputs; Global shell, components and handoff; Target state (phased).
- Feature-list entries (ids `FX-...`, or the feature list's own ids such as `EDI-PART-001`) are claimed the same way. Their routes are design values. A dialog entry (`/<module>/dialogs/<name>`) is built as a dialog component opened from the screens that need it **and** as a page at its route that shows the dialog in each of its states, so the route is never empty. Mobile entries (`/mobile/...`, `/sales/load-ship`) use `layout: "kiosk"`.
- Static feature-list paths such as `/sales/leads/import` sit beside parameterised ones (`/sales/leads/:id`); the router prefers the static path.
- A feature row that is a tab or panel of a screen already registered has no entry of its own. It is scope of that screen and is listed in the owning group's README.
- Do not use `/dev/*` (gallery) or `/coverage`. `/approvals` is WF-INBOX (admin); `/approvals/mobile`, `/approvals/analytics` and `/approvals/dialogs` are admin entries beneath it.

## 3. Use a template

Templates live in `@/components/templates`, one per PRD archetype. They take props and slots and never read the store. Live examples are at `/dev/templates` and `/dev/kiosk` in the running app (source: `src/app/TemplateGallery.tsx`).

| Archetype | Template | Density (layout.md §2) | Notes |
|---|---|---|---|
| List | `ListPage` | office-dense, switchable | header + `DataTable` (+ `above` / `below` slots) |
| Detail | `DetailPage` | office-comfortable; line tables dense | `status` gives the badge and lifecycle strip (C-55); `doc` gives the DocumentFlowPanel (right column at xl or above, otherwise a tab); terminal statuses get a Read-only chip |
| Workbench | `WorkbenchPage` | office-dense, switchable | KPI strip, queue tabs, selectable table with a bulk-action bar, right Sheet panel |
| Wizard | `WizardPage` | office-comfortable | stepper, Back and Next, `validate` per step; Finish states its `consequence` first |
| Kiosk | `KioskPage` + `ScanField` | floor-touch, always | 1280 x 800, 64 px header (operator, station, online), banners under the header, 64 px primary and 48 px secondary in a bottom bar, light theme only |
| Dashboard | `DashboardPage` + `DashboardCard` | office-comfortable | KPI tiles, then worklist cards and charts (`components/ui/chart.tsx`, recharts) |
| Config | `ConfigPage` | office-dense | section nav; `effectiveDated` shows the C-50 note |
| Dialog | `DialogShell` | inherits | `consequence`, `requireReason`, one primary; use it for every confirm-before-commit |

All templates use `PageHeader`: put the view's **one** filled primary action in `primary` (L-4). Everything else goes in `actions`, as outline or ghost buttons.

**Shared patterns** (`@/components/patterns`):

- `StatusBadge kind="purchaseOrder" status={po.status}` maps every S-1..S-43 status to its family (F1..F7), with icon and word. A word that is not on the record's list renders a red "Unknown status" badge, so a typo shows up at once. `LifecycleStrip` draws the main path, then exits and branches separately (fixes F-02).
- `DataTable` handles sort, filter (`filterable`), search (`searchText`), the density toggle remembered per `densityKey`, selection, and the loading, error (+ retry), empty and no-match states. Use `rowHref` for the ID link in the first column.
- `DocumentFlowPanel doc={{type, id}}` shows predecessors and successors across the whole spine.
- `ApprovalButton kind=... subject=... amount=...` is the only way to ask for an approval (C-1). It previews the route from table F: steps, delegation (absent above $250k on financial approvals, C-2) and any routing reading. It then raises the request and links to WF-INBOX. Never build your own approve or reject buttons on a module screen. React to the decision with the `approval.decided` event.
- `PostingPreview lines={[{ template: 28, amount, detail }]}` shows templates #17..#38 with their debit and credit accounts. Show it before any action that posts.
- `ScanField scanPoint="SP-08" expected="..." onScan={code => ({ok, ...})}` takes focus on mount and again after a scan or a dismiss, and **never on blur** (fixes F-01). `/` brings focus back. A failure banner names what was scanned, what was expected, the E-code and the next step.
- `Chip kind="oq" id="OQ-21"`, `kind="k" id="K-13"`, `kind="design"`, `kind="block"`, `kind="change"`, `kind="hold"`, `kind="backorder"`: markers beside a badge, never instead of one (C-5).
- `ErrorAlert`, `EmptyState`, `KV`, `RulesPanel`, `useFirstVisitLoading` (600 ms skeleton on the first visit).

**Styling rule.** Use only token classes (`bg-primary`, `text-muted-foreground`, `border-status-blocked`, `bg-table-head`, `text-link` ...) and Badge variants. Do not use hex values, arbitrary colours or new CSS. That way swapping in the user's design language is a change to `index.css` alone. Spacing steps: 1, 2, 3, 4, 6, 8, 12, 16 (tokens.md T-1).

## 4. Seed data

- **Shared masters** (`@/data/shared`): `LEGAL_ENTITIES` (4), `PLANTS`, `WAREHOUSES`, `COST_CENTERS`, `PROFIT_CENTERS`, `WORK_CENTERS` (WC-050..WC-700), `FISCAL_PERIODS`, `USERS` (one or more per role), `CUSTOMERS` (13, US and Canada), `VENDORS` (16) + `AVL`, `MATERIALS` (all 9 types), `TODAY` = 2026-10-09 and `OPEN_PERIOD` = 2026-10. Reference them by ID; never copy and edit them.
- **The hero thread** (`SPINE_DOCS`, `SPINE_LINKS`, `HERO`): Midland Plains Grid Constructors buys 20 MVA ETO transformers for the Omaha North substation. Phase 1, SO-2026-00301, runs lead → quote → SO → engineering request → EBOM → MBOM → MCR / LLR / STP → PR → RFQ → PO → GRN batch → production order → final test → delivery → POD → installed base → RMA → NCR / SCAR / CAPA → recall RCL-2026-001. Phase 2, SO-2026-00377, is the open FL-09 order; the recall's blocked bushing batch is reserved for it.
- Each spine header has an `owner` group. **Seed the full record for every header you own**, with the same ID, status and dates (your README lists them). Until you do, the DocumentFlowPanel and search show the spine header (its title and status), and `/coverage` marks it "header only".
- Add as many documents of your own as a screen needs to show every status of its records at least once. Use the ID formats in `src/data/domain/ids.ts`: the specification's format where it gives one, otherwise `PREFIX-TBD-nnnn`.
- All names and numbers are fictitious (GUARDRAILS 7). No `[LLM]` tags in the app. A reading goes on screen as `Chip kind="oq"` with an OQ number, and a design value as `Chip kind="design"`.

## 5. Add a store slice

Your slice is pre-created in `data/slice.ts`. Its state type is registered by augmentation, so `useSlice("<key>")` is typed everywhere:

```ts
declare module "@/store/types" { interface SliceStates { materials: MaterialsState } }
export const materialsSlice = defineSlice({ key: "materials", seed, search, links, subscribe })
```

- **Read:** `const s = useSlice("materials")` in a component (it re-renders on any change).
- **Write:** `store.mutate("materials", (draft, ctx) => { ...; throw new ProtoError("message", "field") })` returns `{ok, value}` or `{ok:false, error, field}`. The write is atomic: a ProtoError leaves the state untouched. In components, `useMutate("materials")` returns the same function.
- **Acting role:** `ctx.role` and `ctx.userId` inside a mutate, or `useRole()` in a component. The specification has no role-by-action matrix (ASM-PERM-1), so gate a control only where a rule names the role, and say so in the RulesPanel.
- **search(state)** returns `SearchHit[]` (`title`, `subtitle`, `route`, `ref`, `status`). It feeds global search (Ctrl K) and the status shown in every DocumentFlowPanel.
- **links(state)** returns the `DocLink[]` your records imply (for example PO → GRN). For a link created by an action, call `ctx.link({from, to, kind})` inside the mutate.
- A second slice is allowed. Declare it the same way and add it to `def.slices` in your `index.ts`.

## 6. Cross-module events

One typed bus (`src/store/events.ts`). Events fire **after** the emitting mutate commits.

```ts
// emit, inside your mutate
ctx.emit("production.fgReceived", { woId, serial, itemId })

// consume, in your slice's subscribe (runs once at start)
subscribe: (api) => {
  api.on("engineering.mbomActivated", ({ mbomId }) =>
    api.mutate("planningProduction", (draft) => { /* react */ }))
}
```

- The catalog in `events.ts` covers the spine: `sales.*`, `engineering.*`, `materials.*`, `planning.*`, `production.*`, `quality.*`, `trace.eventRecorded`, `purchasing.*`, `finance.periodStatusChanged`, `posting.posted`, `approval.requested`, `approval.decided`.
- A module-only event: add it by augmentation in your folder, `declare module "@/store/events" { interface DomainEvents { "materials.mcrTaskDone": {...} } }`. Request a catalog entry if another group must consume it.
- Payloads carry IDs, not records. A handler reads what it needs with `api.getSlice(...)`.
- Every ledger posting emits `posting.posted` with its template number. Every traceability capture emits `trace.eventRecorded` (T01..T13).
- Approvals: `api.raiseApproval({kind, subject, title, amount})` from code, or `ApprovalButton` from a screen. Then listen for `approval.decided` with your subject's `type` and `id`.
- In development, `window.__pe.store` is available in the browser console (`store.bus.recent()` lists recent events).

## 7. Rules that apply on every screen

- Status words must be verbatim from the S-1..S-43 catalog (`src/data/domain/status.ts`). A record with no list in the specification (ECR, ECO, MCR, MCH, SCAR, DEV, LLR, RMA line, approval request) shows no badge; use text plus `Chip kind="oq" id="OQ-21"`.
- Detail headers carry the badge and the lifecycle strip, and terminal records open read-only (C-55). The consequences note in `40-models/_tentative/erd-sketch.md` §4 (C-1..C-55) lists which controls a screen may never offer.
- Any action that ends a record, posts, or fires a milestone goes through `DialogShell`: it names the object and the consequence, and asks for a reason where the specification requires one.
- Kiosk screens: 48 px minimum targets, no hover-only paths, every task completable by keyboard alone.
- FL-09 is the regression baseline: its walked path (build-notes.md) must still pass.

## 8. Done checklist for a screen

1. The route claims the registry path, with `screenId` and a `built` entry.
2. The right template for the archetype, with one filled primary.
3. Seed data shows every status of the screen's main record, plus the empty, loading and error states.
4. Statuses via `StatusBadge`, approvals via `ApprovalButton`, postings via `PostingPreview`, scans via `ScanField`.
5. Search and links providers updated, so the documents show up in Ctrl K and in the DocumentFlowPanel.
6. `npm run build` passes with zero errors. No dev server is left running.

---

**Key.** **S-n / C-n / E-n** status list, consequence and entity rows in `40-models/_tentative/erd-sketch.md` · **F1..F7** status families · **L-n / T-n** rules in `30-design-language/skills-md/layout.md` and `tokens.md` · **OQ-nn** a reading in `10-discovery/open-questions.md` · **K-nn** a contradiction in `STATE.md` · **#nn** a posting template · **SP-nn** a scan point · **T01..T13** a traceability event · **FL-nn** a flow · **W1..W7** build waves.


## 9. Scope: the feature list and the registry (12 October 2026)

The user's feature list is a second source of scope. The rule is: **every feature-list row ends up visible and working**, including the target-state (Book IX) rows, which are built after the High and Medium rows. Mapping rules the feature mapper applied:

1. A row that is a screen, dialog, wizard, config page, report set, print output, mobile flow, dashboard, system state, bespoke component or target-state module has a registry entry (`screens-features.ts`) with `built: none` and a placeholder route.
2. A row that is a tab, panel, field set or behaviour of a screen already in the registry has no entry. It belongs to that screen's group, which must complete it (the group's README lists them under "Feature rows").
3. Rows for the three bespoke areas with no natural PRD home land in the shell group: the component gallery (`/components/*`), print outputs (`/print/*`) and the flow-prototype and handoff register (`/flows`).
4. A route is a design value unless the PRD gives it (`routeSource` is "design" for every feature-list entry). The sidebar groups entries under their PRD module, or under the new modules: Global Shell and System States, Home and Dashboards, Component Library, Print Outputs, Flow Prototypes and Handoff, Inventory Operations, and ten Book IX modules.
5. Rows that rest on external specs (Delta vs INV V3.0 / ACC V2.0: number series, GL account mapping) are built from what the feature list states and carry a `Chip kind="oq"` for the unknown parts (ASM-EXT-1).
6. Nothing in the feature list changes a PRD rule. Where the list and the PRD differ, the PRD wins and the difference is logged.

New folders: `src/modules/shell`, `src/modules/inventory-ops`, `src/modules/target-state`, each with `index.ts`, `routes.tsx`, `pages/`, `data/slice.ts` (a stub; slice keys `shell`, `inventoryOps`, `targetState`) and a README that tables its entries.
