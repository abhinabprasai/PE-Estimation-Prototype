---
description: "Run the conformance check (traceability, staleness, provenance, drift) as a script and route its findings; report blocking findings verbatim"
---
Run conformance verification for the current project: $ARGUMENTS

**Run the script. Do not read the artifacts yourself.** The four sweeps are regex, set comparison
and a dependency graph. Doing them by reading every artifact into context costs roughly 100k
tokens per run, which is why the standing cadence in CLAUDE.md 7a never actually gets run. The
script costs about 3k and it is exhaustive where you would be approximate.

1. **Run it:**

   ```
   python3 tools/conformance.py workspace/{project} --sweep {full|trace|stale|provenance|drift}
   ```

   Scope from $ARGUMENTS: "full" (default) runs all four; "trace", "stale", "provenance" or
   "drift" runs one; a REQ-ID or an artifact path passes as `--scope`.

   Exit codes: `0` clean or minor, `1` major findings, `2` blocking findings.

2. **The script writes the snapshot** to `workspace/{project}/conformance/{date}-snapshot.md` and
   appends to `conformance/metrics-history.json`, which is where the trend column comes from. You
   do not write the snapshot; you read it.

3. **Route what it found.** The script reports and never edits, and neither do you in this
   command - that independence is what makes the findings trustworthy.
   - Structural findings (a rule, a record type, a status, a permission, a requirement) go
     through `/rework`, which is the Type B path.
   - Surface findings go to the owning agent named in the finding's row.
   - A finding with no owner is itself a finding; assign one before you close this command.

4. **Update STATE.md** in the same action: the conformance record row, and the freshness table
   from the staleness sweep's results.

5. **Report back, short:**
   - the headline line from the snapshot, verbatim
   - every BLOCKING finding, verbatim, in the session and not filed quietly
   - the metrics strip with its trend column
   - the next three actions with owners

6. **If a gate is scheduled and the run was blocking,** say explicitly which of that gate's
   pre-checks now fail. A gate never runs on an unknown or blocking state.

**If the script fails to run** (no python3, or it raises), say so plainly and fall back to reading
the artifacts - but say that you are falling back, because a manual sweep is approximate and the
snapshot should record that it was one.
