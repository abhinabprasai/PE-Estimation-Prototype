export const meta = {
  name: 'pe-v2-full-prototype-build',
  description: 'Build all remaining PRD screens across 7 module groups, verify each against the PRD, integrate, walk all 11 flows, fix and confirm coverage',
  phases: [
    { title: 'Build', detail: '7 module groups in parallel, each in its own folder', model: 'sonnet' },
    { title: 'Verify', detail: 'independent PRD-fidelity check per group, then gap fix', model: 'sonnet' },
    { title: 'Feature map', detail: 'map the user feature list to screens and groups', model: 'sonnet' },
    { title: 'Feature build', detail: 'build feature-list gaps per group, verify', model: 'sonnet' },
    { title: 'Integrate', detail: 'full build, cross-module seams', model: 'sonnet' },
    { title: 'Walk', detail: 'one walker per flow FL-01..FL-11', model: 'sonnet' },
    { title: 'Fix & confirm', detail: 'apply walk findings, final build and coverage critic', model: 'sonnet' },
  ],
}

const ROOT = '/Users/leapfrog/Documents/PE V2 PRD/aidd-optimized'
const WS = ROOT + '/workspace/pe-v2'
const APP = WS + '/50-prototype/app'
const M = 'opus'
const MS = 'sonnet' // user decision 2026-10-12: Opus weekly limit hit; remaining stages run on Sonnet
const OPUS_FIXED = ['sales', 'materials', 'engineering', 'planning-production']

const COMMON = `You are acting as an AIDD prototype-engineer on project pe-v2. Repo root: ${ROOT}. The app is ${APP} (Vite + React + TS + Tailwind v4 + shadcn/ui, client-side mock data only). The user decided on a FULL-PRD prototype that is KEPT as a deliverable (see the end of ${WS}/PROJECT_CONFIG.md). Domain fidelity is the bar: exact PRD status names, thresholds, roles, postings and scan points. Styling stays token-driven and provisional (shadcn plus ${WS}/30-design-language/skills-md/tokens.md); don't hand-style.

Read FIRST: ${WS}/50-prototype/APP-ARCHITECTURE.md (folder ownership, templates, registry, store slices, the event bus, and the shared files you must NOT edit).

Sources of truth. Read these, not the PDF:
- ${WS}/20-research/client/2026-10-09-prd2-reference-tables.md (screens, postings #17-#38, SP-01..21, T01..T13, status lists, approval limits, roles)
- ${WS}/20-research/client/2026-10-09-prd2-flow-cards.md
- ${WS}/20-research/kb-index.md
- ${WS}/40-models/as-is/FL-*.md
- ${WS}/40-models/_tentative/erd-sketch.md (S-1..S-43 status catalog)
- ${WS}/10-discovery/glossary.md
- ${WS}/_digests/PRD2-*.digest.md
- For screen-level detail, do targeted greps of ${WS}/00-inputs/PRD2-sections/07-bookVI-screen-by-screen.txt (Book VI entries: route, layout, actions, arrivals, outputs, postings, scans) and the other section files. Read at most ~150 lines per read; never read a whole file.

Rules:
- The user's instruction is to build as per the PRD and leave parts that don't interconnect as they are. Where the PRD is silent, choose a reasonable value, show it in the UI as a reading (the existing K-chip/reading pattern), and log it.
- Never invent a PRD rule as fact.
- No [LLM] tags outside ${WS}/10-discovery/open-questions.md.
- Do not leave a dev server running.
- RESUMING: an earlier run was interrupted by a usage limit. Some files may already exist, partly written, in your folder or in the files you're asked to touch. Inspect what is there first and continue from it; do not restart or duplicate. Keep reading of sources focused on what your task needs.
- Do not run "npm run build" while other agents may be editing; instead type-check with "npx tsc -b --noEmit" or "npx tsc -p tsconfig.app.json --noEmit" and fix only errors in files you own.`

const GROUPS = [
  { key: 'sales', screens: 'OM-LEAD-001/2, OM-CUST-001/2, OM-BO-001, RMA-LIST/CREATE, RMA-RECEIPT (kiosk), RMA-DISP, IB-001, SVC-SPF-001. ALSO move the pack station onto the shared KioskPage + ScanField so critique F-01 (keyboard focus trap) is fixed, and keep FL-09 working.', flows: 'FL-01 (MTS O2C), FL-02 (ETO quote-to-cash: sales side), FL-05 (RMA and warranty), FL-09' },
  { key: 'materials', screens: 'MM-MAT-001 + material detail (ten views), MM-MCR-001/2, MM-MCH-001, MM-SUP-001, MM-IR-001/2, MM-SL-001, MM-VAL-001, MM-EOR-001, MM-DQ-001, INV-ITEM-SALES, INV-COUNT-DOC, INV-PLAN-SAFETY (INV-RETURN stays a redirect).', flows: 'FL-03 and FL-10 (master data side), FL-06 (counts, E&O)' },
  { key: 'engineering', screens: 'ENG-HOME-001, ENG-REQ-001, ENG-BOM-002 (EBOM editor, three panes), ENG-ECR/ECO (atomic cutover, 3 effectivity modes), MBOM-TRF, PV-001, ENG-DOC-001/2, TR-001, CAD-SYNC, CAD-IMP.', flows: 'FL-02 and FL-10 (design), IF-17 CAD connector behaviour mocked' },
  { key: 'planning-production', screens: 'PP-MRP-001 (EX-01..EX-07), PLO-001, SCH-BOARD, CTP-DLG (complete it for quotes and orders), AT-RISK, PP-WC-001/2, PP-RTG-001/2, PP-WO-001/2 (6 hard release checks), PP-DSP-001, PP-SFT-001 (kiosk, SP-07/08/10/11/12, postings #28-#30), PP-WIP-001, RWO-001, PP-SETTLE-001.', flows: 'FL-04 (plan to produce), the production side of FL-02' },
  { key: 'quality-trace', screens: 'QM-DASH-001, QM-PLAN-001/2, QM-EXEC (gate queues, SP-05/SP-14), QM-FIN-001 (routine tests with tolerances, FTR), QM-CAPA/SCAR, QM-DEV-001, QM-CAL-001, RCL-001, TRC-EXPL (trace tree, 5 levels), TRC-DASH, BC-ADMIN.', flows: 'FL-08 (recall), FL-11 (traceability), the quality gates in FL-03 and FL-04' },
  { key: 'purchasing-finance', screens: 'PUR-WB-001, PUR-VEND-001/2, PUR-PR/RFQ, PUR-PO-001/2 (approval ladder), LLR-001, PUR-EXP-001, CST-RATE-001, CST-CE-001, CST-RUN-001, PRC-PL-001, PRC-SUR-001, PRC-SIM, INV-CVA-001 (8 variance types), PRC-MARG, CO-CC/PC-001/2, CO-ALC-001/2, CO-R1..R4.', flows: 'FL-03 (P2P), FL-10 (source), FL-06 (allocations and variances), FL-07 (intercompany pricing side)' },
  { key: 'admin', screens: 'WF-INBOX (complete it: every governed action from the 27-row W.4 catalog across all flows, with delegation rules), WF-DEF, OPS-JOBS/INT (job catalog, IF-01..IF-20 interface console), CFG-CORE, INV-CONFIG-PERIOD (period control R-PER-01, E-PER-01..04), INV-CONFIG-TAX.', flows: 'FL-06 (period close), every flow that has an approval' },
]

const BUILD_SCHEMA = { type: 'object', properties: {
  built: { type: 'array', items: { type: 'string' }, description: 'screen IDs built and claimed in the registry' },
  not_built: { type: 'array', items: { type: 'string' } },
  readings: { type: 'array', items: { type: 'string' }, description: 'PRD-silent choices shown as readings' },
  requests_to_foundation: { type: 'array', items: { type: 'string' } },
  typecheck_clean_for_my_files: { type: 'boolean' },
}, required: ['built', 'not_built', 'typecheck_clean_for_my_files'] }

const GAP_SCHEMA = { type: 'object', properties: {
  gaps: { type: 'array', items: { type: 'object', properties: {
    screen: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, severity: { type: 'string', enum: ['missing', 'wrong', 'incomplete'] },
  }, required: ['screen', 'problem', 'severity'] } },
}, required: ['gaps'] }

const ISSUE_SCHEMA = { type: 'object', properties: {
  completable_end_to_end: { type: 'boolean' },
  issues: { type: 'array', items: { type: 'object', properties: {
    step: { type: 'string' }, problem: { type: 'string' }, owner_group: { type: 'string' }, files: { type: 'string' }, fix: { type: 'string' },
  }, required: ['step', 'problem', 'owner_group'] } },
}, required: ['completable_end_to_end', 'issues'] }

log('Building 7 module groups, ' + GROUPS.length + ' agents in parallel')

const runGroups = (gs) => pipeline(gs,
  (g) => agent(`${COMMON}

YOUR GROUP: ${g.key}. You own ONLY ${APP}/src/modules/${g.key}/ (read its README.md first: the screens, the spine documents you must seed with the same IDs, the events). Build EVERY screen in your group as a working screen on the right archetype template, at the registry route, and claim it as built:
${g.screens}
Flows your screens serve: ${g.flows}.
For each screen:
- realistic seeded data at realistic volume (PE Transformer: power transformers, MVA ratings, US and Canadian customers);
- every status of its entity visible somewhere;
- the empty, loading and error states;
- primary actions that really change state through your store slice;
- approvals only via ApprovalButton, which goes to WF-INBOX;
- journal postings shown with PostingPreview, scan points with ScanField;
- the document-flow panel linking up and down the spine;
- cross-module hand-offs via the event bus, as APP-ARCHITECTURE.md describes.
Make the hero spine thread (SO-2026-00301, the ETO order) traversable through your screens.
If you need a shared change, write it under "Requests to foundation" in your README and work around it. Do not edit shared files.
Finish with a type-check clean for your files. Return the structured result.`, { label: 'build:' + g.key, phase: 'Build', model: M, schema: BUILD_SCHEMA }),
  (built, g) => agent(`${COMMON}

You are an INDEPENDENT VERIFIER for group ${g.key}. Assume the builder cut corners. Do NOT edit any files. For each screen in this list, find what is missing or wrong versus the PRD sources:
${g.screens}
Check:
- the screen exists at its registry route and is claimed as built;
- status names match the PRD lists exactly and all are reachable or visible;
- thresholds, approval limits, roles, postings (#nn), scan points (SP-nn) and validation or error codes (V-/E- codes) match;
- the primary actions work in the store;
- the empty, loading and error states exist;
- the hero thread SO-2026-00301 resolves;
- it doesn't contradict the flow cards.
The builder reported: ${JSON.stringify(built)}.
Cite evidence as file:line and [DOC:p.n]. List only real gaps; a reading the builder marked as PRD-silent is not a gap.`, { label: 'verify:' + g.key, phase: 'Verify', model: M, schema: GAP_SCHEMA }),
  (v, g) => (v && v.gaps && v.gaps.length) ? agent(`${COMMON}

YOUR GROUP: ${g.key}. You own ONLY ${APP}/src/modules/${g.key}/. An independent verifier found these gaps. Fix every one that is real; if one is not real, say why. Gaps:
${JSON.stringify(v.gaps, null, 1)}
Finish with a type-check clean for your files. Return a short summary: fixed / disputed / remaining.`, { label: 'fix:' + g.key, phase: 'Verify', model: OPUS_FIXED.includes(g.key) ? M : MS }).then(f => ({ group: g.key, gaps: v.gaps.length, fix: f })) : ({ group: g.key, gaps: 0, fix: 'none needed' }),
)

const batch1 = await runGroups(GROUPS.slice(0, 4))
log('Batch 1 done: ' + batch1.filter(Boolean).length + '/4 groups')
const batch2 = await runGroups(GROUPS.slice(4))
const groupResults = [...batch1, ...batch2]
const okGroups = groupResults.filter(Boolean).length
log('Groups completed: ' + okGroups + '/' + GROUPS.length)
if (okGroups < 5) {
  log('Too many group builds failed; stopping before integration so the next run resumes cleanly')
  return { stopped: true, groups: groupResults }
}

const FL_FILE = WS + '/00-inputs/feature-list-2026-10.md'
phase('Feature map')
const MAP_SCHEMA = { type: 'object', properties: {
  groups: { type: 'array', items: { type: 'object', properties: {
    key: { type: 'string' },
    features: { type: 'array', items: { type: 'string' }, description: 'feature-list rows this group must build or complete, each with its route' },
  }, required: ['key', 'features'] } },
  registry_added: { type: 'number' },
}, required: ['groups'] }
const fmap = await agent(`${COMMON}

The user has supplied a FEATURE LIST: ${FL_FILE}. Read it in full. Together with the PRD, it now defines the prototype's scope: every row must end up visible and working in the prototype. Rows marked target-state (Book IX) are later-phase but still in scope; build them after the High and Medium rows.
You are the FEATURE MAPPER, and you may edit shared files (registry, nav, module registry).
1. Compare every feature-list row with the screen registry (src/data/screens.ts) and with what is actually built in src/modules/*.
2. For every row that has no registry entry (components, global shell, dashboards, system states, dialogs, config pages, reports, print outputs, mobile flows, target-state modules), add one: id, title, route, archetype, module, wave, flows, built:false. Give it a placeholder route, so navigation shows it. Add sidebar nav for the new modules: Home & dashboards, Inventory operations, Print outputs, and the Book IX target-state modules grouped under one "Target state (phased)" section.
3. Create these new module group folders, following APP-ARCHITECTURE.md (routes.tsx, pages/, data/slice.ts, README.md with its feature rows) and register them:
   - shell: global shell features, system states, notification center, profile, SSO and MFA states, error pages, role dashboards, print outputs / document previews, the bespoke-component gallery;
   - inventory-ops: mobile counts, warehouse tasks, the supervisor board, GRN STP delta, period-close additions, IC recon;
   - target-state: every Book IX module.
   Then update APP-ARCHITECTURE.md.
4. Run "npm run build"; it must pass.
5. Return, for every group, the feature rows it must still build or complete. The groups are: sales, materials, engineering, planning-production, quality-trace, purchasing-finance, admin, shell, inventory-ops, target-state. A row counts as complete only if the existing screen really covers its scope text; otherwise list it with the missing parts.`, { label: 'feature-map', phase: 'Feature map', model: MS, schema: MAP_SCHEMA })

phase('Feature build')
const featGroups = (fmap && fmap.groups ? fmap.groups : []).filter(g => g.features && g.features.length)
log('Feature-list work: ' + featGroups.map(g => g.key + ' ' + g.features.length).join(', '))
const runFeat = (gs) => pipeline(gs,
  (g) => agent(`${COMMON}

FEATURE LIST: ${FL_FILE}. YOUR GROUP: ${g.key}. You own ONLY ${APP}/src/modules/${g.key}/ (read its README.md first). Build or complete EVERY one of these feature-list rows so its scope text is visibly and functionally present. Use the shared templates and patterns, put each one at its registry route, and claim it as built:
${g.features.map(f => '- ' + f).join('\n')}
Give each one realistic seeded data, the nine states where relevant (normal, empty, loading, validation, authorization, conflict, offline, degraded, read-only), and working primary actions. Kiosk and mobile views go on KioskPage at the device sizes named in the list. If you need a shared change, write it under "Requests to foundation" in your README and work around it. Finish with a type-check clean for your files.`, { label: 'feat:' + g.key, phase: 'Feature build', model: MS }),
  (r, g) => agent(`${COMMON}

INDEPENDENT FEATURE VERIFIER for group ${g.key}. Do NOT edit files. Check every row below against the code: is its full scope text present and working, at a claimed registry route? Report only real gaps, with file evidence.
${g.features.map(f => '- ' + f).join('\n')}`, { label: 'feat-verify:' + g.key, phase: 'Feature build', model: MS, schema: GAP_SCHEMA }),
  (v, g) => (v && v.gaps && v.gaps.length) ? agent(`${COMMON}

YOUR GROUP: ${g.key}. You own ONLY ${APP}/src/modules/${g.key}/. Fix every real gap the feature verifier found (feature list: ${FL_FILE}):
${JSON.stringify(v.gaps, null, 1)}
Finish with a type-check clean for your files. Return fixed / disputed / remaining.`, { label: 'feat-fix:' + g.key, phase: 'Feature build', model: MS }) : 'none needed',
)
const featA = await runFeat(featGroups.slice(0, 5))
const featB = await runFeat(featGroups.slice(5))
log('Feature build done: ' + [...featA, ...featB].filter(Boolean).length + '/' + featGroups.length + ' groups')

phase('Integrate')
const integration = await agent(`${COMMON}

All module groups have finished building, including the feature-list work (feature list: ${WS}/00-inputs/feature-list-2026-10.md). You are the INTEGRATOR, and you may now edit shared files. Steps:
1. Run "npm run build" in ${APP} and fix every TypeScript and build error, in any file.
2. Act on every "Requests to foundation" in src/modules/*/README.md: implement it, or mark it declined with a reason.
3. Check that cross-module event wiring is consistent: every emitted event has its consumers registered, and the hero thread SO-2026-00301 runs lead → quote → SO → engineering request → EBOM → MBOM → PR/PO → production order → final test → delivery → RMA → recall with consistent IDs.
4. Check the screen registry: every one of the 83 buildable entries is claimed as built (INV-RETURN is a redirect). List any that are not.
5. Run "npm run build" again; it must pass. Start "npm run dev" briefly to confirm it boots, then stop it.
Update ${WS}/50-prototype/build-notes.md with an Integration section. Return: build pass/fail, unbuilt registry entries, requests handled, and seams fixed.`, { label: 'integrate', phase: 'Integrate', model: MS })

phase('Walk')
const FLOWS = ['Feature-list Prototype A sales order to delivery FL-01/09', 'Feature-list Prototype B engineering to procurement FL-10', 'Feature-list Prototype C plan to produce incl kiosk FL-04', 'Feature-list Prototype G ETO quote to cash FL-02: lead with prior-build search, quote datasheet, SO milestone strip, engineering request, transmittal approval loop, milestone invoice request', 'FL-01 MTS order to cash', 'FL-02 ETO quote to cash', 'FL-03 procure to pay', 'FL-04 plan to produce', 'FL-05 RMA and warranty', 'FL-06 period close', 'FL-07 intercompany', 'FL-08 recall', 'FL-09 sales order to delivery', 'FL-10 design to source', 'FL-11 end-to-end traceability']
const walks = await parallel(FLOWS.map((fl, wi) => () => agent(`${COMMON}

You are a FLOW WALKER for ${fl}. Do NOT edit files. Read the flow's reference file in ${WS}/40-models/as-is/ and its flow card, then trace the flow end to end through the app source: every step's screen, action, store transition, event hand-off, posting and scan point. Trace through the code paths; if it helps, you may start "npm run dev" on a port other than 5174 and stop it afterwards. Answer: can a user complete this flow end to end in the prototype? List every break, missing step, wrong status or wrong threshold. For each, give the owning module group (sales, materials, engineering, planning-production, quality-trace, purchasing-finance, admin, or shared), the files, and a concrete fix.`, { label: 'walk:' + (fl.startsWith('Feature-list') ? 'Proto-' + fl.split(' ')[2] : fl.split(' ')[0]), phase: 'Walk', model: MS, schema: ISSUE_SCHEMA })))

const allIssues = walks.filter(Boolean).flatMap((w, i) => (w.issues || []).map(x => ({ flow: FLOWS[i], ...x })))
log(allIssues.length + ' flow issues found across ' + walks.filter(Boolean).length + ' walks')

phase('Fix & confirm')
const fixes = allIssues.length ? await agent(`${COMMON}

You are the INTEGRATION FIXER, and you may edit any file. Fix every issue the flow walkers found, so each flow is completable end to end. Where a fix needs a PRD rule the PRD doesn't state, show it as a reading and log it. Issues:
${JSON.stringify(allIssues, null, 1)}
Then run "npm run build" (it must pass) and update build-notes.md with a "Flow walk fixes" section. Return fixed / not fixed with reasons.`, { label: 'fix:flows', phase: 'Fix & confirm', model: MS }) : 'no issues'

const critic = await agent(`${COMMON}

You are the COMPLETENESS CRITIC. Measure against BOTH the PRD and the user's feature list ${WS}/00-inputs/feature-list-2026-10.md: every feature row must be present. Do NOT edit files except ${WS}/50-prototype/coverage.md, which you regenerate from the registry: every registry entry (PRD screens plus feature-list rows) with its built status, plus a per-flow row with completable yes/no. Run "npm run build" and report the result. Then ask: what is still missing? Look for screens claimed as built that are actually thin stubs, flows not completable, PRD status lists not represented, postings #17-#38, scan points SP-01..21 and trace events T01..T13 that appear nowhere, and approval rows from W.4 that are unreachable. Be specific and honest: a thin screen is a finding.`, { label: 'critic', phase: 'Fix & confirm', model: MS, schema: { type: 'object', properties: {
  build_passes: { type: 'boolean' }, built_count: { type: 'number' }, total_buildable: { type: 'number' },
  flows_completable: { type: 'array', items: { type: 'string' } }, flows_not_completable: { type: 'array', items: { type: 'string' } },
  thin_or_missing: { type: 'array', items: { type: 'string' } },
}, required: ['build_passes', 'built_count', 'total_buildable', 'thin_or_missing'] } })

return { groups: groupResults, integration, walkIssues: allIssues.length, fixes, critic }
