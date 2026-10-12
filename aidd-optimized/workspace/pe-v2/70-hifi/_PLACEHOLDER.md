# 70-hifi/: production-intent specifications

Owners: hifi-spec-designer (specs), ui-designer (system), design-critic (critiques).
Precondition: Gate 2 passed. Scope: the prioritized list, exactly.

```
{feature}/spec.md       nine blocks; DRAFT header until all nine are present
{feature}/content.md    the dummy content set, boundary-audited
status-mapping.md       consolidated across features
critiques/              design-critique reports per feature
```

## The nine blocks

1. **Screen states**: the generic set plus one per ERD status value the feature's entities hold
2. **Screen composition**: the three hierarchy levels named, page skeleton slots, components cited
3. **Dev notes**: validation with REQ-IDs, calculations, what is server-authoritative
4. **Interaction guides**: timing, optimistic/pending/confirmed, validation, save model, keyboard
5. **Status mapping**: trigger, who may trigger, irreversibility, what each role sees
6. **Screen flow**: connections and exception paths, drawn rather than implied
7. **Content**: real copy in every state, REQ-IDs cited on rule-bearing strings
8. **Accessibility**: contrast verified, keyboard path written, announcements specified
9. **Responsive and dummy content**: adaptation per breakpoint, boundary-audited content

## Build the state enumeration table first

Feature x entity x status, one cell each, before any screen. Every cell is specified or proved
unreachable with the flow. Unproven unreachability is a missing screen, and this table is what
stops states being discovered late.

## Where the sources are, and are not

Sources are `refined-requirements.md`, the ERD (open its consequences note before designing), and
the flows. Never the archived prototype: if you find yourself opening `50-prototype/ARCHIVED/`,
stop and say why, out loud, first (GUARDRAILS 4).

## Before requesting Gate 3

Self-reconcile the status mapping against the ERD and file the check note. Run `design-critique`
across all seven lenses. Fix S1 and S2. Route Type B findings through the reconciler before
editing anything.

Delete this file once the folder holds real specs.

---

**Key.**
**Type A** a surface fix: a screen, wording, layout - **Type B** a rule change: a rule, a record type, a status, a permission, a requirement. Type B goes through the requirements document before anything is redrawn.

**S1** blocker - **S2** major, harms the task - **S3** minor - **SC** a craft judgment stated as a prediction, which goes to the next user session rather than to a fix - **S4** a preference, recorded and dropped.
