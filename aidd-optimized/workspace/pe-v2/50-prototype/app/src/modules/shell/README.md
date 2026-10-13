# Module group: shell

> **What this is.** The owner's guide for `src/modules/shell/`. Global shell features, system states, notification center, profile, SSO and MFA states, error pages, role dashboards, print outputs and document previews, and the bespoke-component gallery. It is a new group, created by the feature mapper on 12 October 2026 from the user's feature list.
>
> **Where it stands.** All 56 entries above are built (13 October 2026) and claimed `full` in `routes.tsx`. Shared kit in `kit/` (states, record, viz, tree, floor, commerce), print documents in `print/`, pages in `pages/`, store slice `shell` (notifications, entity, recents). Type-check is clean for this folder. The shell edits (entity selector, breadcrumbs, bell, search) are in `src/app/AppShell.tsx`.
>
> **What we need from you.** Build the screens below inside this folder. The shell itself (`src/app/AppShell.tsx`, `GlobalSearch.tsx`) belongs to this group for the rows that change it (entity selector, breadcrumbs, search results, notification bell, profile menu, role landing page at `/`). Make those edits small and keep the sidebar generated from the registry. Anything else outside this folder goes under "Requests to foundation".

Read first: `50-prototype/APP-ARCHITECTURE.md`. Live examples of every template: `/dev/templates`.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| FX-FND-TOKENS | Design tokens and responsive breakpoints | `/components/tokens` | Detail (design value) | W1 | - | Project Setup & Design Foundations | full |
| FX-FND-ARCH | Archetype map and traceability | `/components/archetype-map` | Detail (design value) | W1 | - | Project Setup & Design Foundations | full |
| FX-FND-STATES | Nine mandatory states and legal hold | `/components/state-kit` | Detail (design value) | W1 | - | Project Setup & Design Foundations | full |
| FX-FND-ARCHETYPES | Eight archetypes as component sets | `/components/archetypes` | Detail (design value) | W1 | - | Project Setup & Design Foundations | full |
| FX-CMP-STATUS | Status badge and lifecycle strip | `/components/status-lifecycle` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-CONTEXT | Entity context bar, audit trail and attachments | `/components/context-audit` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-READY | Readiness chips | `/components/readiness-chips` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-APPROVAL | Approval strip | `/components/approval-strip` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-WATERFALL | Price waterfall panel | `/components/price-waterfall` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-SCAN | Scan input and feedback flash | `/components/scan-feedback` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-TREE | Tree explorer | `/components/tree-explorer` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-MILESTONE | Milestone strip (ETO) | `/components/milestone-strip` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-DIFF | Diff viewer | `/components/diff-viewer` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-GL | GL preview panel | `/components/gl-preview` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-EXCEPTION | Exception worklist card and SLA aging | `/components/exception-cards` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-KIOSK | Kiosk control set | `/components/kiosk-controls` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-GANTT | Finite schedule, Gantt and capacity bars | `/components/schedule-gantt` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-BOARD | Board and pipeline cards | `/components/kanban` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-RFQGRID | Comparison grid (RFQ) | `/components/rfq-comparison` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-TESTROW | Test characteristic row and calibration interlock | `/components/test-characteristic` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-DATAVIZ | Data-viz set | `/components/data-viz` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-SIM | Simulation and preview pattern | `/components/simulation-preview` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-TAX | Line tax override dialog and tax-status badges | `/components/tax-override` | Dialog (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-COMPLETE | Data completeness bar and function-block chips | `/components/completeness` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-CMP-GUIDE | Component documentation and usage guidelines | `/components/guidelines` | Detail (design value) | W1 | - | Bespoke Domain Component Library | full |
| FX-SHL-NAV | App shell, sidebar, entity selector and breadcrumbs | `/shell/navigation` | Detail (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-SEARCH | Global search results | `/search` | List (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-NOTIF | Notification center | `/notifications` | Workbench (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-PROFILE | User profile and preferences | `/profile` | Config (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-SSO | SSO entry, session and step-up MFA states | `/auth/sso`, `/auth/session-expired`, `/auth/step-up`, `/auth/kiosk-lock` | Detail (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-ERRORS | System error and degraded pages | `/errors/403`, `/errors/404`, `/errors/500`, `/errors/maintenance`, `/errors/degraded`, `/errors/wan-down` | Detail (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-SHL-DEVICES | Responsive and device breakpoints | `/shell/devices` | Detail (design value) | W1 | - | Global Shell, Navigation & System States | full |
| FX-HOME-LANDING | Role landing page | `/home` | Dashboard (design value) | W1 | - | Home & Role Dashboards | full |
| FX-DASH-EXEC | Executive dashboard | `/dashboards/executive` | Dashboard (design value) | W7 | - | Home & Role Dashboards | full |
| FX-DASH-SALES | Sales dashboard | `/dashboards/sales` | Dashboard (design value) | W7 | FL-01, FL-02 | Home & Role Dashboards | full |
| FX-DASH-PROD | Production dashboard | `/dashboards/production` | Dashboard (design value) | W7 | FL-04 | Home & Role Dashboards | full |
| FX-DASH-INV | Inventory dashboard (safety-stock breach tile) | `/dashboards/inventory` | Dashboard (design value) | W7 | - | Home & Role Dashboards | full |
| FX-PRN-QUOTE | Quote PDF (commercial, ETO datasheet, terms) | `/print/quote` | Detail (design value) | W7 | FL-01, FL-02 | Print Outputs, Documents & Notifications | full |
| FX-PRN-ORDER | Order and change confirmation PDFs | `/print/order-confirmation` | Detail (design value) | W7 | FL-01, FL-02 | Print Outputs, Documents & Notifications | full |
| FX-PRN-PACKLIST | Packing list and transformer shipping addendum | `/print/packing-list` | Detail (design value) | W7 | FL-09 | Print Outputs, Documents & Notifications | full |
| FX-PRN-RETURN | Return instructions PDF and warranty denial letter | `/print/return-instructions` | Detail (design value) | W7 | FL-05 | Print Outputs, Documents & Notifications | full |
| FX-PRN-TRAVELER | Traveler and shop packet | `/print/traveler` | Detail (design value) | W7 | FL-04 | Print Outputs, Documents & Notifications | full |
| FX-PRN-FTR | Final Test Report (FTR) | `/print/ftr` | Detail (design value) | W7 | FL-04, FL-02 | Print Outputs, Documents & Notifications | full |
| FX-PRN-PO | PO PDF, RFQ invite and regret notice | `/print/purchase-order` | Detail (design value) | W7 | FL-03, FL-10 | Print Outputs, Documents & Notifications | full |
| FX-PRN-CUTOVER | Cutover fallback paper forms | `/print/cutover-forms` | Detail (design value) | W7 | - | Print Outputs, Documents & Notifications | full |
| FX-PRN-SHIPDOCS | BOL, CoC, certificate dossier cover and transmittal sheet | `/print/shipping-documents` | Detail (design value) | W7 | FL-09, FL-02 | Print Outputs, Documents & Notifications | full |
| FX-PRN-RFQRESP | RFQ vendor response form | `/print/rfq-response` | Detail (design value) | W7 | FL-03, FL-10 | Print Outputs, Documents & Notifications | full |
| FX-PRN-COUNT | Count document print (blind and expected) | `/print/count-document` | Detail (design value) | W7 | FL-06 | Print Outputs, Documents & Notifications | full |
| FX-PRN-INSPPLAN | Inspection plan PDF | `/print/inspection-plan` | Detail (design value) | W7 | - | Print Outputs, Documents & Notifications | full |
| FX-PRN-INVSUPP | Invoice supplement (packing data) | `/print/invoice-supplement` | Detail (design value) | W7 | FL-09 | Print Outputs, Documents & Notifications | full |
| FX-PRN-SPARES | As-built spares parts list PDF | `/print/spares-list` | Detail (design value) | W7 | FL-05 | Print Outputs, Documents & Notifications | full |
| FX-PRN-EMAIL | Email notification templates | `/print/email-templates` | List (design value) | W7 | - | Print Outputs, Documents & Notifications | full |
| FX-PRN-LABELS | Label layouts, print-ready (11 classes) | `/print/labels`, `/print/labels/:id` | Detail (design value) | W7 | FL-11 | Print Outputs, Documents & Notifications | full |
| FX-FLW-INDEX | Flow prototypes A to G and portal / field-service | `/flows`, `/flows/:id` | Detail (design value) | W7 | FL-01, FL-02, FL-03, FL-04, FL-05, FL-09, FL-10, FL-11 | Flow Prototypes, Validation & Handoff | full |
| FX-FLW-VALIDATION | Validation and handoff register | `/flows/validation` | Detail (design value) | W7 | - | Flow Prototypes, Validation & Handoff | full |
## Feature rows owned (beyond the entries above)

The entries above carry one feature row each. Also owned here, as behaviour of the registered screens: the nine mandatory states on every screen (Book V section 10.3; build them once in the state kit and reuse); the readiness, approval, price-waterfall, GL-preview, diff, tree and data-viz components must also be used by the module screens that need them (the gallery documents them; the modules adopt them).


## State

Slice key `shell` (ShellState). A stub: replace it with the group's records.

## Cross-module events

None yet. Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder.

## Rules

- Status words verbatim from the S-1..S-43 catalog; a record with no list in the specification shows no badge (APP-ARCHITECTURE section 7).
- Where the PRD is silent, choose a value, show it as a reading (`Chip kind="oq"`), and log it. Never state an invented rule as fact.
- Every feature row for this group (below) must end up visible and working.

## Requests to foundation

| ID | File | Change | Needed by |
|---|---|---|---|
| R-1 | `src/App.tsx` | Point `/` at the role landing page (`/home`) once FX-HOME-LANDING is built. Until then `/` stays on the FL-09 quotation (regression baseline). | FX-HOME-LANDING |
