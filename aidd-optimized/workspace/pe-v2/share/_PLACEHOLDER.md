# share/

> **What this is.** The versions of our documents that go to you rather than stay with us: the
> brief for each review session, the handover pack, the validation pack.
>
> **Where it stands.** Written before each review.
>
> **What we need from you.** Read the brief before the session. Everything we need decided is on
> its first page.

## What belongs here

| File | When | Template |
|---|---|---|
| `gate-1-brief.md` | before the first review | `templates/share-gate-brief.md` |
| `gate-2-brief.md` | before the second review | `templates/share-gate-brief.md` |
| `gate-3-brief.md` | before validation | `templates/share-gate-brief.md` |
| `handoff-walkthrough.md` | at close | `templates/share-handoff-walkthrough.md` |

Produced with `/share {gate-1|gate-2|gate-3|walkthrough|validation}`.

Render any of them to a self-contained HTML page you can send:

```
python3 tools/render-share.py workspace/{project}/share/
```

## The rule these files exist for

No framework terms. Not glossed, not defined at the foot - absent. A document that needs someone
from our team standing next to it reading it aloud is not finished (GUARDRAILS 12). If a share
document uses the word ORPHAN, Type B, or blast radius, it is a defect.
