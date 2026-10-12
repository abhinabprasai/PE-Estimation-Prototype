# conformance/

Conformance snapshots produced by process-evaluation (gate-reviewer), on the standing cadence:
end of every phase, before every gate, after every Type B correction, and weekly during Phases
2B and 3. Run on demand with `/verify`.

Each snapshot: `{yyyy-mm-dd}-snapshot.md` with the four-sweep headline (traceability,
staleness, provenance, drift), the findings table with owners, and the metrics strip with
trends. Keep the last three; archive older ones to `conformance/ARCHIVE/`.

The traceability matrix itself lives at `60-requirements/traceability.md`
(templates/traceability-matrix.md is the seed). The matrix is an index of citations that
already exist in the artifacts; an empty cell that must be hand-invented to fill means the
real defect is an uncited artifact.

A snapshot older than its cadence is itself a finding, and `/phase-status` reports it.
