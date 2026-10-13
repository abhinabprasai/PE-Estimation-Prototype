# Module group: target-state

> **What this is.** The owner's guide for `src/modules/target-state/`. Every Book IX module: Full EDI, Periodic Actual Costing and Material Ledger, Advanced Scheduling Optimizer, Global Multi-Plant ATP and CTP, Supplier and Customer Portals, Machine Integration (OEE, downtime), Field Service Management, Plant Maintenance and EAM, International Localization, and Carrier Integration. New group, created by the feature mapper on 12 October 2026.
>
> **Where it stands.** All 40 screens are built and routed (13 October 2026), every one with realistic seeded data, the nine prototype states (normal, empty, loading, validation, authorization, conflict, offline, degraded, read-only) through the `Prototype state` switch in the phased banner, and working primary actions in the shared slice. Every screen carries the "Target state (phased)" banner naming its decision and its activation evidence. Type-check is clean for this folder.
>
> **What we need from you.** Build the screens below inside this folder. The sidebar section is "Target state (phased)". Deltas to core screens (promise dialog, backorder workbench, Delivery Cockpit carrier panel, terminal downtime coding) are separate entries here; wire them into the core screens through the shared domain, not by editing another group's folder (request it).

Read first: `50-prototype/APP-ARCHITECTURE.md`.

## Screens owned

| Screen ID | Title | Route | Archetype | Wave | Flows | Feature-list section | Built |
|---|---|---|---|---|---|---|---|
| EDI-PART-001 | EDI partner profiles | `/target/edi/partners`, `/target/edi/partners/:id` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| EDI-MON-001 | EDI envelope monitor and reprocessing | `/target/edi/monitor` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| ML-COCKPIT-001 | Material Ledger cockpit | `/target/material-ledger/cockpit` | Workbench (design value) | W7 | FL-06 | Target-state modules (Book IX) | full |
| ML-MAT-001 | Material Ledger by material | `/target/material-ledger/materials`, `/target/material-ledger/materials/:id` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| ML-CONFIG-001 | Material Ledger configuration | `/target/material-ledger/config` | Config (design value) | W7 | - | Target-state modules (Book IX) | full |
| OPT-RUN-001 | Optimizer run | `/target/optimizer/runs` | Workbench (design value) | W7 | FL-04 | Target-state modules (Book IX) | full |
| OPT-PROF-001 | Optimizer profiles | `/target/optimizer/profiles` | Config (design value) | W7 | - | Target-state modules (Book IX) | full |
| OPT-BENCH-001 | Optimizer benchmark | `/target/optimizer/benchmark` | Dashboard (design value) | W7 | - | Target-state modules (Book IX) | full |
| GATP-SEQ-001 | Global ATP sourcing sequence | `/target/gatp/sequence` | Config (design value) | W7 | - | Target-state modules (Book IX) | full |
| GATP-SIM-001 | Global ATP simulator | `/target/gatp/simulator` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-GATP-PROMISE | Promise dialog, extended (network) | `/target/gatp/promise-dialog` | Dialog (design value) | W7 | FL-01, FL-02 | Target-state modules (Book IX) | full |
| FX-GATP-BACKORDER | Backorder workbench, network delta | `/target/gatp/backorders` | Workbench (design value) | W7 | FL-09 | Target-state modules (Book IX) | full |
| FX-PTL-SHELL | Portal shell, external sign-in and invitation | `/target/portals`, `/target/portals/sign-in`, `/target/portals/invitation` | Detail (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-PTL-SUP-PO | Supplier PO worklist with acknowledgement | `/target/portals/supplier/orders` | Workbench (design value) | W7 | FL-03 | Target-state modules (Book IX) | full |
| FX-PTL-SUP-DEV | Supplier deviation request (portal) | `/target/portals/supplier/deviations` | Detail (design value) | W7 | FL-03 | Target-state modules (Book IX) | full |
| FX-PTL-SUP-ASN | Supplier ASN creation | `/target/portals/supplier/asn` | Wizard (design value) | W7 | FL-03 | Target-state modules (Book IX) | full |
| FX-PTL-SUP-STATUS | Supplier invoice and payment status, scorecard and SCAR response | `/target/portals/supplier/status` | Dashboard (design value) | W7 | FL-03, FL-08 | Target-state modules (Book IX) | full |
| FX-PTL-CUS-ORDERS | Customer order status | `/target/portals/customer/orders`, `/target/portals/customer/orders/:id` | List (design value) | W7 | FL-01 | Target-state modules (Book IX) | full |
| FX-PTL-CUS-DRAWINGS | Customer drawing approvals with markup | `/target/portals/customer/drawings` | Workbench (design value) | W7 | FL-02 | Target-state modules (Book IX) | full |
| FX-PTL-CUS-SHIP | Customer shipment tracking, dossier and e-POD | `/target/portals/customer/shipments` | List (design value) | W7 | FL-09 | Target-state modules (Book IX) | full |
| FX-PTL-CUS-RETURNS | Customer returns request | `/target/portals/customer/returns` | Wizard (design value) | W7 | FL-05 | Target-state modules (Book IX) | full |
| MI-MAP-001 | Machine signal mapping | `/target/machine/signal-mapping` | Config (design value) | W7 | - | Target-state modules (Book IX) | full |
| DT-LOG-001 | Downtime log | `/target/machine/downtime` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| OEE-DASH-001 | OEE dashboard | `/target/machine/oee` | Dashboard (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-MI-TERMINAL | Terminal downtime reason coding | `/target/machine/terminal-downtime` | Kiosk (design value) | W7 | FL-04 | Target-state modules (Book IX) | full |
| FX-MI-DELTAS | Machine-integration deltas to core screens | `/target/machine/core-deltas` | Detail (design value) | W7 | - | Target-state modules (Book IX) | full |
| SVO-001 | Service orders | `/target/field-service/orders`, `/target/field-service/orders/:id` | List (design value) | W7 | FL-05 | Target-state modules (Book IX) | full |
| DSP-BOARD-001 | Field dispatch board | `/target/field-service/dispatch` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-FSM-MOBILE | Field service mobile execution set | `/target/field-service/mobile` | Kiosk (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-FSM-VAN | Van stock replenishment | `/target/field-service/van-stock` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-FSM-CONTRACTS | Service contracts and technician resources | `/target/field-service/contracts`, `/target/field-service/technicians` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| EQ-001 | Equipment register | `/target/maintenance/equipment`, `/target/maintenance/equipment/:id` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| MPLAN-001 | Maintenance plans | `/target/maintenance/plans` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| MO-001 | Maintenance orders | `/target/maintenance/orders`, `/target/maintenance/orders/:id` | List (design value) | W7 | - | Target-state modules (Book IX) | full |
| MAINT-BOARD-001 | Maintenance board | `/target/maintenance/board` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-EAM-DASH | Maintenance dashboard (MTBF, MTTR) | `/target/maintenance/dashboard` | Dashboard (design value) | W7 | - | Target-state modules (Book IX) | full |
| LOC-COUNTRY-001 | Country activation cockpit | `/target/localization/countries` | Workbench (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-LOC-TAXREGIME | Tax regime configuration extension | `/target/localization/tax-regimes` | Config (design value) | W7 | - | Target-state modules (Book IX) | full |
| FX-CAR-INTEGRATION | Carrier rating, tendering, tracking and e-POD (IF-21) | `/target/carrier/integration` | Workbench (design value) | W7 | FL-09 | Target-state modules (Book IX) | full |

## State

Slice key `targetState` (`TargetStateState`): one slice, ten parts. `edi`, `ledger`, `opt`, `gatp`, `portal`, `machine`, `field`, `maint`, `loc`, `carrier`. Seeds are in `data/*.ts`; rules that change records are functions over the slice draft (`fieldOps.ts`, `maintOps.ts`, `lib.ts` `raiseBreakdown`) so the screens that share them (service order detail, dispatch board, mobile set; maintenance order detail, board, plans; downtime log, core deltas) behave the same way.

## Where the modules touch each other (inside the group)

- Machine integration to maintenance: a down state beyond the hard-down threshold, or the terminal hold reason machine down, calls `raiseBreakdown`, which creates (or reuses) the open breakdown order on the machine that governs the work center. The work center then shows Maintenance status (S-20) through `wcStatusOf`. Completing the breakdown order closes the open downtime on that work center and returns the machine state to run.
- Maintenance to the finite schedule: every open order reserves its window as blocked capacity (`syncBlock`); the board flags overlap with production blocks.
- Field service: van stock lines are decremented by the scan of a part on the mobile set; the van stock screen proposes transfers against min and max and receipt tops the van up.

## Cross-module events

None yet. Event catalog: `src/store/events.ts`. Add a module-only event by augmentation in this folder.

## Readings and design values to log in open-questions.md

These are choices made where the PRD is silent. Each shows on screen as a design value or a reading chip. They are listed here for the integration pass to log as OQ rows (this group does not edit the shared file).

- Machine integration: grace 5 min before a down state opens a record, hard-down threshold 30 min, reconciliation tolerance 2 percent, shift times (06:00, 14:00, 22:00), reason tree contents, the scan point SP-06 used for a part scan from van stock (the PRD names none), the instrument ids used in the final test demo.
- Field service: service rate $145 per hour, cost rate $68, travel $0.85 per km, warranty term 24 months, warranty reserve $25,000, response and resolution hours per class (A 4/48, B 24/120, C 72/240), eight-hour technician day, monthly van count interval 30 days, who may record a go or release (Controller).
- Maintenance: criticality classes A/B/C, labor rate $62, horizon default 14 days, operating hours 16 per day and 90 days for MTBF and MTTR, review thresholds (MTBF under 500 h or MTTR over 8 h), the maintenance order status words reuse the production order path (On Hold and Cancelled included).
- Localization: the roles that may release a regime (Controller, CFO), editing a released regime opens a new draft version effective 2027-01-01 or later while the old one stays in force.
- Carrier: carrier names, rates and equipment classes; IF-21 is simulated.

## Rules

- Status words verbatim from the S-1..S-43 catalog; a record with no list in the specification shows no badge (APP-ARCHITECTURE section 7). Service order, maintenance order, downtime, tender and layer statuses are the PRD's own words shown through `Tag` with a family reading (OQ-18).
- Where the PRD is silent, choose a value, show it as a reading (`Chip kind="oq"` or `kind="design"`), and log it (list above).
- Every feature row for this group (above) is visible and working. Honest limits: drag assignment on the dispatch board is mouse only (the panel is the keyboard path); the mobile set is a 1280 x 800 `KioskPage` (the feature list names no other device size); the carrier interface, gateway and solver are simulated.

## Requests to foundation

| ID | File | Change | Needed by |
|---|---|---|---|
| TS-1 | `src/data/domain/status.ts` | Optional: add lists for service order (New ... Closed) and maintenance order (production order path) so the status family stops being a reading and the DetailPage lifecycle strip can be used. | SVO-001, MO-001 |
| TS-2 | `10-discovery/open-questions.md` | Log the readings listed above as OQ rows. | integration pass |
| TS-3 | Delivery Cockpit (sales) and core screens | Surface the carrier panel (FX-CAR-INTEGRATION), the network promise dialog and the machine-integration deltas inside the owning screens; each is built here as a page and a component. | integration pass |
